/**
 * Marina Lease Cash Flow Engine
 * 
 * Generates cash flow projections from contract charges with support for:
 * - Multiple pricing basis types (per foot/month, flat monthly, seasonal, etc.)
 * - Pro-rata calculations for partial periods
 * - Seasonal charges with configurable month ranges
 * - Escalation methods (fixed step, index-linked)
 * - Supports future multi-asset-type expansion (marina, multifamily, retail)
 */

import { db } from "./db";
import { contractCharges, leases, tenants, marinaLocations } from "@shared/schema";
import { eq, and, gte, lte, isNull, or } from "drizzle-orm";
import { 
  startOfMonth, 
  endOfMonth, 
  eachMonthOfInterval, 
  differenceInDays,
  addYears,
  getMonth,
  getYear,
  format,
  isWithinInterval,
  parseISO,
  isBefore,
  isAfter
} from "date-fns";

// ============================================================================
// TYPES
// ============================================================================

export type BasisType = 'per_ft_per_month' | 'per_ft_per_year' | 'per_month' | 'per_year' | 'per_day' | 'per_season';
export type ChargeFrequency = 'monthly' | 'annual' | 'seasonal' | 'daily' | 'one_time';
export type EscalationType = 'none' | 'fixed_step' | 'index_linked';

export interface CashFlowPeriod {
  periodId: string;
  periodDate: string;
  year: number;
  month: number;
  label: string;
  charges: ChargeLineItem[];
  totalAmount: number;
  proRataFactor?: number;
}

export interface ChargeLineItem {
  chargeId: string;
  chargeType: string;
  chargeName: string;
  basisType: BasisType;
  baseAmount: number;
  calculatedAmount: number;
  boatLength?: number;
  proRataFactor: number;
  isPartialPeriod: boolean;
  daysInPeriod: number;
  seasonApplied: boolean;
  escalationApplied: boolean;
  escalationAmount?: number;
}

export interface CashFlowGenerationParams {
  leaseId: string;
  startDate?: Date;
  endDate?: Date;
  includeEscalation?: boolean;
  yearsToProject?: number;
}

export interface CashFlowSummary {
  leaseId: string;
  tenantName: string;
  vesselName?: string;
  boatLength?: number;
  leaseStart: string;
  leaseEnd?: string;
  periods: CashFlowPeriod[];
  totalProjectedRevenue: number;
  annualizedRevenue: number;
  chargeTypeSummary: Record<string, number>;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get the number of days in a month
 */
function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

/**
 * Calculate pro-rata factor for partial period
 */
function calculateProRataFactor(
  periodStart: Date,
  periodEnd: Date,
  chargeStart: Date,
  chargeEnd: Date | null
): { factor: number; activeDays: number; totalDays: number; isPartial: boolean } {
  const totalDays = differenceInDays(periodEnd, periodStart) + 1;
  
  // Determine actual start/end within period
  const actualStart = isBefore(chargeStart, periodStart) ? periodStart : chargeStart;
  const actualEnd = chargeEnd && isBefore(chargeEnd, periodEnd) ? chargeEnd : periodEnd;
  
  // If charge ends before period starts or starts after period ends
  if ((chargeEnd && isBefore(chargeEnd, periodStart)) || isAfter(chargeStart, periodEnd)) {
    return { factor: 0, activeDays: 0, totalDays, isPartial: false };
  }
  
  const activeDays = differenceInDays(actualEnd, actualStart) + 1;
  const factor = activeDays / totalDays;
  const isPartial = factor < 1;
  
  return { factor, activeDays, totalDays, isPartial };
}

/**
 * Check if a month falls within a seasonal range
 */
function isInSeasonalRange(month: number, seasonStartMonth: number | null, seasonEndMonth: number | null): boolean {
  if (seasonStartMonth === null || seasonEndMonth === null) {
    return true; // No seasonal restriction
  }
  
  // Handle wrap-around (e.g., Nov-Apr for winter season)
  if (seasonStartMonth <= seasonEndMonth) {
    return month >= seasonStartMonth && month <= seasonEndMonth;
  } else {
    // Wrap around year boundary
    return month >= seasonStartMonth || month <= seasonEndMonth;
  }
}

/**
 * Apply escalation to base amount
 */
function applyEscalation(
  baseAmount: number,
  escalationMethod: EscalationType,
  escalationValue: number | null,
  escalationStartDate: Date | null,
  currentPeriodDate: Date
): { amount: number; escalationApplied: boolean; escalationAmount: number } {
  if (escalationMethod === 'none' || !escalationValue || !escalationStartDate) {
    return { amount: baseAmount, escalationApplied: false, escalationAmount: 0 };
  }
  
  // Check if escalation should apply
  if (isBefore(currentPeriodDate, escalationStartDate)) {
    return { amount: baseAmount, escalationApplied: false, escalationAmount: 0 };
  }
  
  // Calculate years since escalation start
  const yearsSinceStart = Math.floor(
    (currentPeriodDate.getTime() - escalationStartDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000)
  );
  
  let escalatedAmount = baseAmount;
  
  if (escalationMethod === 'fixed_step') {
    // Fixed percentage increase per year
    escalatedAmount = baseAmount * Math.pow(1 + escalationValue / 100, yearsSinceStart);
  } else if (escalationMethod === 'index_linked') {
    // For CPI/index-linked, would need external data source
    // For now, use the value as annual % increase
    escalatedAmount = baseAmount * Math.pow(1 + escalationValue / 100, yearsSinceStart);
  }
  
  const escalationAmount = escalatedAmount - baseAmount;
  
  return { 
    amount: escalatedAmount, 
    escalationApplied: yearsSinceStart > 0, 
    escalationAmount 
  };
}

/**
 * Convert basis type amount to monthly equivalent
 */
function convertToMonthlyAmount(
  amount: number,
  basisType: BasisType,
  boatLength?: number,
  daysInMonth?: number
): number {
  switch (basisType) {
    case 'per_ft_per_month':
      return amount * (boatLength || 1);
    
    case 'per_ft_per_year':
      return (amount * (boatLength || 1)) / 12;
    
    case 'per_month':
      return amount;
    
    case 'per_year':
      return amount / 12;
    
    case 'per_day':
      return amount * (daysInMonth || 30);
    
    case 'per_season':
      // Assume 6-month season, convert to monthly
      return amount / 6;
    
    default:
      return amount;
  }
}

// ============================================================================
// MAIN ENGINE
// ============================================================================

/**
 * Generate cash flow projection for a lease
 */
export async function generateLeaseCashFlow(
  params: CashFlowGenerationParams
): Promise<CashFlowSummary> {
  const { leaseId, startDate, endDate, includeEscalation = true, yearsToProject = 1 } = params;
  
  // Fetch lease with tenant info
  const leaseData = await db
    .select({
      lease: leases,
      tenant: tenants,
    })
    .from(leases)
    .leftJoin(tenants, eq(leases.tenantId, tenants.id))
    .where(eq(leases.id, leaseId))
    .limit(1);
  
  if (leaseData.length === 0) {
    throw new Error(`Lease not found: ${leaseId}`);
  }
  
  const { lease, tenant } = leaseData[0];
  
  // Fetch all charges for this lease
  const charges = await db
    .select()
    .from(contractCharges)
    .where(
      and(
        eq(contractCharges.leaseId, leaseId),
        eq(contractCharges.isActive, true)
      )
    );
  
  // Determine projection date range
  const projectionStart = startDate || 
    (lease.leaseCommencement ? parseISO(lease.leaseCommencement.toString()) : new Date());
  
  const defaultEnd = addYears(projectionStart, yearsToProject);
  const projectionEnd = endDate || 
    (lease.leaseExpiration ? parseISO(lease.leaseExpiration.toString()) : defaultEnd);
  
  // Get boat length for per-foot calculations (from lease slipLength or tenant boatLength)
  const boatLength = parseFloat(lease.slipLength?.toString() || tenant?.boatLength?.toString() || '0') || undefined;
  
  // Generate monthly periods
  const months = eachMonthOfInterval({
    start: startOfMonth(projectionStart),
    end: endOfMonth(projectionEnd)
  });
  
  const periods: CashFlowPeriod[] = [];
  let totalProjectedRevenue = 0;
  const chargeTypeSummary: Record<string, number> = {};
  
  for (const monthDate of months) {
    const year = getYear(monthDate);
    const month = getMonth(monthDate);
    const periodStart = startOfMonth(monthDate);
    const periodEnd = endOfMonth(monthDate);
    const daysInMonth = getDaysInMonth(year, month);
    
    const periodId = format(monthDate, 'yyyy-MM');
    const label = format(monthDate, 'MMM yyyy');
    
    const periodCharges: ChargeLineItem[] = [];
    let periodTotal = 0;
    
    for (const charge of charges) {
      // Check seasonal applicability
      const isInSeason = isInSeasonalRange(
        month,
        charge.seasonStartMonth,
        charge.seasonEndMonth
      );
      
      if (!isInSeason) {
        continue;
      }
      
      // Determine charge date range
      const chargeStart = charge.chargeStartDate 
        ? parseISO(charge.chargeStartDate.toString())
        : projectionStart;
      const chargeEnd = charge.chargeEndDate 
        ? parseISO(charge.chargeEndDate.toString())
        : null;
      
      // Calculate pro-rata factor
      const proRata = calculateProRataFactor(
        periodStart,
        periodEnd,
        chargeStart,
        chargeEnd
      );
      
      if (proRata.factor === 0) {
        continue;
      }
      
      // Convert to monthly amount
      const baseAmount = parseFloat(charge.amount?.toString() || '0');
      const monthlyAmount = convertToMonthlyAmount(
        baseAmount,
        charge.basisType as BasisType,
        boatLength,
        daysInMonth
      );
      
      // Apply escalation if applicable
      let finalAmount = monthlyAmount;
      let escalationApplied = false;
      let escalationAmount = 0;
      
      if (includeEscalation && charge.escalationMethod && charge.escalationMethod !== 'none') {
        const escalation = applyEscalation(
          monthlyAmount,
          charge.escalationMethod as EscalationType,
          parseFloat(charge.escalationValue?.toString() || '0'),
          charge.escalationStartDate ? parseISO(charge.escalationStartDate.toString()) : null,
          monthDate
        );
        finalAmount = escalation.amount;
        escalationApplied = escalation.escalationApplied;
        escalationAmount = escalation.escalationAmount;
      }
      
      // Apply pro-rata
      const calculatedAmount = finalAmount * proRata.factor;
      
      periodCharges.push({
        chargeId: charge.id,
        chargeType: charge.chargeType,
        chargeName: charge.chargeName || charge.chargeType,
        basisType: charge.basisType as BasisType,
        baseAmount,
        calculatedAmount,
        boatLength,
        proRataFactor: proRata.factor,
        isPartialPeriod: proRata.isPartial,
        daysInPeriod: proRata.activeDays,
        seasonApplied: charge.seasonStartMonth !== null,
        escalationApplied,
        escalationAmount
      });
      
      periodTotal += calculatedAmount;
      
      // Update charge type summary
      const summaryKey = charge.chargeType;
      chargeTypeSummary[summaryKey] = (chargeTypeSummary[summaryKey] || 0) + calculatedAmount;
    }
    
    if (periodCharges.length > 0) {
      periods.push({
        periodId,
        periodDate: format(monthDate, 'yyyy-MM-dd'),
        year,
        month: month + 1, // 1-indexed for display
        label,
        charges: periodCharges,
        totalAmount: periodTotal
      });
      
      totalProjectedRevenue += periodTotal;
    }
  }
  
  // Calculate annualized revenue
  const monthsInProjection = periods.length;
  const annualizedRevenue = monthsInProjection > 0 
    ? (totalProjectedRevenue / monthsInProjection) * 12 
    : 0;
  
  // Construct vessel name from tenant boat info
  const vesselInfo = [tenant?.boatMake, tenant?.boatYear].filter(Boolean).join(' ');
  
  return {
    leaseId,
    tenantName: tenant?.name || 'Unknown Tenant',
    vesselName: vesselInfo || undefined,
    boatLength,
    leaseStart: lease.leaseCommencement?.toString() || '',
    leaseEnd: lease.leaseExpiration?.toString() || undefined,
    periods,
    totalProjectedRevenue,
    annualizedRevenue,
    chargeTypeSummary
  };
}

/**
 * Generate cash flows for all leases in a location/project
 */
export async function generateLocationCashFlows(
  locationId: string,
  startDate?: Date,
  endDate?: Date
): Promise<CashFlowSummary[]> {
  // Get all active leases for the location
  const locationLeases = await db
    .select({ id: leases.id })
    .from(leases)
    .where(eq(leases.locationId, locationId));
  
  const summaries: CashFlowSummary[] = [];
  
  for (const lease of locationLeases) {
    try {
      const summary = await generateLeaseCashFlow({
        leaseId: lease.id,
        startDate,
        endDate
      });
      summaries.push(summary);
    } catch (error) {
      console.error(`Error generating cash flow for lease ${lease.id}:`, error);
    }
  }
  
  return summaries;
}

/**
 * Get aggregated monthly totals across all leases in a location
 */
export async function getLocationMonthlySummary(
  locationId: string,
  startDate?: Date,
  endDate?: Date
): Promise<{
  periods: Array<{
    periodId: string;
    label: string;
    totalRevenue: number;
    leaseCount: number;
    byChargeType: Record<string, number>;
  }>;
  totalRevenue: number;
}> {
  const cashFlows = await generateLocationCashFlows(locationId, startDate, endDate);
  
  // Aggregate by period
  const periodMap = new Map<string, {
    periodId: string;
    label: string;
    totalRevenue: number;
    leaseCount: number;
    byChargeType: Record<string, number>;
  }>();
  
  for (const summary of cashFlows) {
    for (const period of summary.periods) {
      const existing = periodMap.get(period.periodId) || {
        periodId: period.periodId,
        label: period.label,
        totalRevenue: 0,
        leaseCount: 0,
        byChargeType: {}
      };
      
      existing.totalRevenue += period.totalAmount;
      existing.leaseCount += 1;
      
      for (const charge of period.charges) {
        existing.byChargeType[charge.chargeType] = 
          (existing.byChargeType[charge.chargeType] || 0) + charge.calculatedAmount;
      }
      
      periodMap.set(period.periodId, existing);
    }
  }
  
  const periods = Array.from(periodMap.values()).sort((a, b) => 
    a.periodId.localeCompare(b.periodId)
  );
  
  const totalRevenue = periods.reduce((sum, p) => sum + p.totalRevenue, 0);
  
  return { periods, totalRevenue };
}

// ============================================================================
// CRUD OPERATIONS FOR CONTRACT CHARGES
// ============================================================================

export interface CreateChargeInput {
  leaseId: string;
  chargeType: string;
  chargeName?: string;
  basisType: BasisType;
  amount: number;
  frequency?: ChargeFrequency;
  seasonStartMonth?: number;
  seasonEndMonth?: number;
  chargeStartDate?: string;
  chargeEndDate?: string;
  escalationMethod?: EscalationType;
  escalationValue?: number;
  escalationStartDate?: string;
  notes?: string;
  metadata?: Record<string, any>;
}

export async function createContractCharge(input: CreateChargeInput) {
  const result = await db.insert(contractCharges).values({
    leaseId: input.leaseId,
    chargeType: input.chargeType as any,
    chargeName: input.chargeName,
    basisType: input.basisType as any,
    amount: input.amount.toString(),
    frequency: (input.frequency || 'monthly') as any,
    seasonStartMonth: input.seasonStartMonth,
    seasonEndMonth: input.seasonEndMonth,
    chargeStartDate: input.chargeStartDate,
    chargeEndDate: input.chargeEndDate,
    escalationMethod: (input.escalationMethod || 'none') as any,
    escalationValue: input.escalationValue?.toString(),
    escalationStartDate: input.escalationStartDate,
    notes: input.notes,
    metadata: input.metadata,
    isActive: true
  }).returning();
  
  return result[0];
}

export async function getChargesForLease(leaseId: string) {
  return db
    .select()
    .from(contractCharges)
    .where(eq(contractCharges.leaseId, leaseId));
}

export async function updateContractCharge(
  chargeId: string, 
  updates: Partial<CreateChargeInput>
) {
  const updateData: Record<string, any> = { updatedAt: new Date() };
  
  if (updates.chargeType) updateData.chargeType = updates.chargeType;
  if (updates.chargeName !== undefined) updateData.chargeName = updates.chargeName;
  if (updates.basisType) updateData.basisType = updates.basisType;
  if (updates.amount !== undefined) updateData.amount = updates.amount.toString();
  if (updates.frequency) updateData.frequency = updates.frequency;
  if (updates.seasonStartMonth !== undefined) updateData.seasonStartMonth = updates.seasonStartMonth;
  if (updates.seasonEndMonth !== undefined) updateData.seasonEndMonth = updates.seasonEndMonth;
  if (updates.chargeStartDate !== undefined) updateData.chargeStartDate = updates.chargeStartDate;
  if (updates.chargeEndDate !== undefined) updateData.chargeEndDate = updates.chargeEndDate;
  if (updates.escalationMethod) updateData.escalationMethod = updates.escalationMethod;
  if (updates.escalationValue !== undefined) updateData.escalationValue = updates.escalationValue?.toString();
  if (updates.escalationStartDate !== undefined) updateData.escalationStartDate = updates.escalationStartDate;
  if (updates.notes !== undefined) updateData.notes = updates.notes;
  if (updates.metadata !== undefined) updateData.metadata = updates.metadata;
  
  const result = await db
    .update(contractCharges)
    .set(updateData)
    .where(eq(contractCharges.id, chargeId))
    .returning();
  
  return result[0];
}

export async function deleteContractCharge(chargeId: string) {
  return db
    .delete(contractCharges)
    .where(eq(contractCharges.id, chargeId));
}

export async function deactivateContractCharge(chargeId: string) {
  return db
    .update(contractCharges)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(contractCharges.id, chargeId))
    .returning();
}
