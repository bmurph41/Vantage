/**
 * Lease Cashflow Engine for Valuator
 * 
 * Deterministic calculation functions for tenant lease modeling.
 * Handles base rent, escalations, recoveries, percentage rent, and concessions.
 */

import { differenceInMonths, differenceInDays, addMonths, endOfMonth, startOfMonth, format } from "date-fns";

// ============================================
// TYPES
// ============================================

export type LeaseType = "NNN" | "MOD_GROSS" | "FULL_GROSS" | "ABSOLUTE_NNN" | "OTHER";
export type RentInputUnit = "PSF_YEAR" | "PER_MONTH" | "PER_YEAR";
export type EscalationType = "NONE" | "PERCENT" | "FIXED_DOLLAR" | "DOLLAR_PSF_YEAR" | "CPI" | "CPI_CAP_FLOOR" | "SCHEDULE";
export type RecoveryMethod = "PRO_RATA" | "BASE_YEAR_STOP" | "EXPENSE_STOP_PSF" | "FIXED_MONTHLY" | "FIXED_ANNUAL";
export type BreakpointType = "NATURAL" | "ARTIFICIAL";
export type SettlementFrequency = "MONTHLY" | "QUARTERLY" | "ANNUAL";
export type ConcessionType = "FREE_RENT" | "DISCOUNT_PERCENT" | "DISCOUNT_FIXED" | "OTHER";

export interface HealthStatus {
  score: number;
  status: "Strong" | "Stable" | "Watch" | "At Risk";
  factors: {
    monthsToExpiration: number;
    leaseTypeBonus: number;
    renewalBonus: number;
    totalScore: number;
  };
  tooltip: string;
}

export interface MonthlyScheduleRow {
  monthEnd: string;
  monthStart: string;
  daysInMonth: number;
  daysActive: number;
  prorationFactor: number;
  baseRent: number;
  escalationApplied: boolean;
  escalationPeriod: number;
  effectiveRentRate: number;
  recoveriesTotal: number;
  percentageRent: number;
  isSettlementMonth: boolean;
  concessionAmount: number;
  grossRentTotal: number;
  isPartialMonth: boolean;
  termType: "INITIAL" | "OPTION";
  optionIndex?: number;
  notes: string[];
}

export interface AnnualRollup {
  year: number;
  baseRent: number;
  recoveries: number;
  percentageRent: number;
  concessions: number;
  grossRent: number;
  months: number;
}

export interface LeaseScheduleOutput {
  leaseId: string;
  tenantName: string;
  monthlySchedule: MonthlyScheduleRow[];
  annualRollups: AnnualRollup[];
  totals: {
    baseRent: number;
    recoveries: number;
    percentageRent: number;
    concessions: number;
    grossRent: number;
  };
  metadata: {
    horizonStart: string;
    horizonEnd: string;
    totalMonths: number;
    sf: number;
    leaseType: LeaseType;
  };
}

// ============================================
// HEALTH SCORE CALCULATION
// ============================================

export interface LeaseHealthInput {
  leaseEndDate: string;
  leaseType: LeaseType;
  assumeRenewal?: boolean;
  renewalProbability?: number;
}

export function calculateLeaseHealth(input: LeaseHealthInput): HealthStatus {
  const today = new Date();
  const endDate = new Date(input.leaseEndDate);
  const monthsToExpiration = differenceInMonths(endDate, today);
  
  // Base score from time to expiration
  let baseScore: number;
  if (monthsToExpiration < 0) {
    baseScore = 10; // Expired
  } else if (monthsToExpiration <= 5) {
    baseScore = 20;
  } else if (monthsToExpiration <= 11) {
    baseScore = 35;
  } else if (monthsToExpiration <= 23) {
    baseScore = 55;
  } else if (monthsToExpiration <= 35) {
    baseScore = 70;
  } else {
    baseScore = 80;
  }
  
  // Lease type bonus
  let leaseTypeBonus = 0;
  switch (input.leaseType) {
    case "ABSOLUTE_NNN": leaseTypeBonus = 10; break;
    case "NNN": leaseTypeBonus = 7; break;
    case "MOD_GROSS": leaseTypeBonus = 3; break;
    case "FULL_GROSS": leaseTypeBonus = 0; break;
    default: leaseTypeBonus = 0;
  }
  
  // Renewal bonus
  let renewalBonus = 0;
  if (input.assumeRenewal) {
    renewalBonus = 5;
    if (input.renewalProbability) {
      renewalBonus += Math.min(10, input.renewalProbability * 10);
    }
  }
  
  // Calculate total score (clamped 0-100)
  const totalScore = Math.min(100, Math.max(0, baseScore + leaseTypeBonus + renewalBonus));
  
  // Determine status
  let status: "Strong" | "Stable" | "Watch" | "At Risk";
  if (totalScore >= 80) status = "Strong";
  else if (totalScore >= 55) status = "Stable";
  else if (totalScore >= 35) status = "Watch";
  else status = "At Risk";
  
  // Build tooltip
  const tooltipParts: string[] = [];
  if (monthsToExpiration < 0) {
    tooltipParts.push(`Expired ${Math.abs(monthsToExpiration)} months ago`);
  } else {
    tooltipParts.push(`Expires in ${monthsToExpiration} months`);
  }
  tooltipParts.push(`Lease type: ${input.leaseType}`);
  if (input.assumeRenewal) {
    tooltipParts.push(`Renewal assumed${input.renewalProbability ? ` (${(input.renewalProbability * 100).toFixed(0)}% prob)` : ""}`);
  }
  
  return {
    score: totalScore,
    status,
    factors: {
      monthsToExpiration,
      leaseTypeBonus,
      renewalBonus,
      totalScore,
    },
    tooltip: tooltipParts.join("\n"),
  };
}

// ============================================
// RENT CALCULATIONS
// ============================================

export function calculateMonthlyRent(
  unit: RentInputUnit,
  value: number,
  sf: number
): number {
  switch (unit) {
    case "PSF_YEAR":
      return (value * sf) / 12;
    case "PER_MONTH":
      return value;
    case "PER_YEAR":
      return value / 12;
    default:
      return 0;
  }
}

export function calculateAnnualizedRent(
  unit: RentInputUnit,
  value: number,
  sf: number
): number {
  switch (unit) {
    case "PSF_YEAR":
      return value * sf;
    case "PER_MONTH":
      return value * 12;
    case "PER_YEAR":
      return value;
    default:
      return 0;
  }
}

// ============================================
// ESCALATION CALCULATIONS
// ============================================

export function calculateEscalatedRent(
  baseMonthlyRent: number,
  escalationType: EscalationType,
  escalationValue: number | null,
  escalationFrequencyMonths: number | null,
  monthsFromStart: number,
  sf: number,
  cpiAssumptionPercent?: number
): { rent: number; periodsElapsed: number; escalationApplied: boolean } {
  if (escalationType === "NONE" || !escalationValue || !escalationFrequencyMonths) {
    return { rent: baseMonthlyRent, periodsElapsed: 0, escalationApplied: false };
  }
  
  const periodsElapsed = Math.floor(monthsFromStart / escalationFrequencyMonths);
  
  if (periodsElapsed === 0) {
    return { rent: baseMonthlyRent, periodsElapsed: 0, escalationApplied: false };
  }
  
  let escalatedRent: number;
  
  switch (escalationType) {
    case "PERCENT":
      // Compounded percentage increase
      escalatedRent = baseMonthlyRent * Math.pow(1 + escalationValue / 100, periodsElapsed);
      break;
      
    case "FIXED_DOLLAR":
      // Flat dollar step-ups (applies to monthly rent)
      escalatedRent = baseMonthlyRent + (periodsElapsed * escalationValue);
      break;
      
    case "DOLLAR_PSF_YEAR":
      // $/SF/year step-ups
      escalatedRent = baseMonthlyRent + (periodsElapsed * (escalationValue * sf / 12));
      break;
      
    case "CPI":
      // Use CPI assumption or default to escalation value
      const cpiRate = cpiAssumptionPercent || escalationValue;
      escalatedRent = baseMonthlyRent * Math.pow(1 + cpiRate / 100, periodsElapsed);
      break;
      
    case "CPI_CAP_FLOOR":
      // CPI with cap/floor would need additional params
      escalatedRent = baseMonthlyRent * Math.pow(1 + escalationValue / 100, periodsElapsed);
      break;
      
    default:
      escalatedRent = baseMonthlyRent;
  }
  
  return {
    rent: escalatedRent,
    periodsElapsed,
    escalationApplied: true,
  };
}

// ============================================
// PRORATION CALCULATIONS
// ============================================

export function calculateProration(
  monthStart: Date,
  monthEnd: Date,
  leaseStart: Date,
  leaseEnd: Date
): { daysActive: number; daysInMonth: number; factor: number } {
  const daysInMonth = differenceInDays(monthEnd, monthStart) + 1;
  
  // Determine active period within month
  const activeStart = leaseStart > monthStart ? leaseStart : monthStart;
  const activeEnd = leaseEnd < monthEnd ? leaseEnd : monthEnd;
  
  if (activeStart > monthEnd || activeEnd < monthStart) {
    return { daysActive: 0, daysInMonth, factor: 0 };
  }
  
  const daysActive = differenceInDays(activeEnd, activeStart) + 1;
  const factor = daysActive / daysInMonth;
  
  return { daysActive, daysInMonth, factor };
}

// ============================================
// PERCENTAGE RENT CALCULATIONS
// ============================================

export function calculateNaturalBreakpoint(
  annualBaseRent: number,
  overagePercent: number
): number {
  if (overagePercent <= 0) return 0;
  return annualBaseRent / overagePercent;
}

export function calculatePercentageRent(
  sales: number,
  breakpoint: number,
  overagePercent: number
): number {
  const overage = Math.max(0, sales - breakpoint);
  return overage * overagePercent;
}

export function isSettlementMonth(
  month: number, // 0-11
  frequency: SettlementFrequency
): boolean {
  switch (frequency) {
    case "MONTHLY":
      return true;
    case "QUARTERLY":
      return [2, 5, 8, 11].includes(month); // Mar, Jun, Sep, Dec
    case "ANNUAL":
      return month === 11; // December
    default:
      return false;
  }
}

// ============================================
// KPI CALCULATIONS
// ============================================

export interface LeaseKpisInput {
  leases: Array<{
    id: string;
    sf: number;
    leaseStartDate: string;
    leaseEndDate: string;
    status: string;
    baseRentInputUnit: RentInputUnit;
    baseRentInputValue: number;
    percentRentEnabled?: boolean;
    recoveriesMonthly?: number;
    percentRentMtd?: number;
    percentRentYtd?: number;
  }>;
}

export function calculateLeaseKpis(input: LeaseKpisInput) {
  const today = new Date();
  
  let totalBaseRentMonthly = 0;
  let totalRecoveriesMonthly = 0;
  let totalPercentRentMtd = 0;
  let totalPercentRentYtd = 0;
  let totalSf = 0;
  let weightedRentSum = 0;
  let activeLeaseCount = 0;
  let expiringCount = 0;
  let expiredCount = 0;
  
  for (const lease of input.leases) {
    const startDate = new Date(lease.leaseStartDate);
    const endDate = new Date(lease.leaseEndDate);
    
    // Skip archived
    if (lease.status === "ARCHIVED") continue;
    
    // Determine status
    if (endDate < today) {
      expiredCount++;
      continue;
    }
    
    const monthsToExpiration = differenceInMonths(endDate, today);
    if (monthsToExpiration <= 12 && startDate <= today) {
      expiringCount++;
    }
    
    if (startDate <= today && endDate >= today) {
      activeLeaseCount++;
      
      const monthlyRent = calculateMonthlyRent(
        lease.baseRentInputUnit,
        lease.baseRentInputValue,
        lease.sf
      );
      
      totalBaseRentMonthly += monthlyRent;
      totalSf += lease.sf;
      weightedRentSum += monthlyRent * 12; // Annualized
      
      // Add recoveries if provided
      if (lease.recoveriesMonthly) {
        totalRecoveriesMonthly += lease.recoveriesMonthly;
      }
      
      // Add % rent if provided
      if (lease.percentRentMtd) {
        totalPercentRentMtd += lease.percentRentMtd;
      }
      if (lease.percentRentYtd) {
        totalPercentRentYtd += lease.percentRentYtd;
      }
    }
  }
  
  const weightedAvgRentPsf = totalSf > 0 ? weightedRentSum / totalSf : 0;
  
  return {
    totalBaseRentMonthly,
    totalRecoveriesMonthly,
    totalPercentRentMtd,
    totalPercentRentYtd,
    weightedAvgRentPsf,
    totalSf,
    activeLeaseCount,
    expiringCount,
    expiredCount,
  };
}

// ============================================
// FULL SCHEDULE CALCULATION
// ============================================

export interface LeaseScheduleInput {
  lease: {
    id: string;
    tenantName: string;
    sf: number;
    leaseType: LeaseType;
    leaseStartDate: string;
    leaseEndDate: string;
    rentCommencementDate?: string | null;
  };
  rentTerms: Array<{
    termType: "INITIAL" | "OPTION";
    optionIndex?: number | null;
    termStartDate: string;
    termEndDate: string;
    baseRentInputUnit: RentInputUnit;
    baseRentInputValue: number;
    escalationType: EscalationType;
    escalationValue?: number | null;
    escalationFrequencyMonths?: number | null;
    escalationCapPercent?: number | null;
    escalationFloorPercent?: number | null;
  }>;
  recoveries: Array<{
    recoveryType: string;
    method: RecoveryMethod;
    amount?: number | null;
    psfAmount?: number | null;
    expenseGrowthRatePercent?: number | null;
  }>;
  percentageRent: {
    enabled: boolean;
    breakpointType?: BreakpointType;
    breakpointAmountAnnual?: number | null;
    overagePercent?: number | null;
    settlementFrequency?: SettlementFrequency;
  } | null;
  sales: Array<{
    periodEndDate: string;
    grossSales: number;
  }>;
  concessions: Array<{
    concessionType: ConcessionType;
    startDate: string;
    endDate: string;
    value: number;
  }>;
  rolloverAssumptions: {
    assumeRenewal: boolean;
    downtimeMonths?: number;
  } | null;
  horizonMonths?: number;
  cpiAssumptionPercent?: number;
}

export function calculateLeaseSchedule(input: LeaseScheduleInput): LeaseScheduleOutput {
  const { lease, rentTerms, recoveries, percentageRent, sales, concessions, rolloverAssumptions } = input;
  const horizonMonths = input.horizonMonths || 120;
  const cpiAssumptionPercent = input.cpiAssumptionPercent || 2.5;
  
  const monthlySchedule: MonthlyScheduleRow[] = [];
  const leaseStart = new Date(lease.leaseStartDate);
  const rentStart = lease.rentCommencementDate ? new Date(lease.rentCommencementDate) : leaseStart;
  
  // Determine terms to use (initial + options if assume renewal)
  const termsToUse = [...rentTerms].sort((a, b) => {
    if (a.termType === "INITIAL") return -1;
    if (b.termType === "INITIAL") return 1;
    return (a.optionIndex || 0) - (b.optionIndex || 0);
  });
  
  // Filter to only include terms we should use
  const activeTerms = rolloverAssumptions?.assumeRenewal 
    ? termsToUse 
    : termsToUse.filter(t => t.termType === "INITIAL");
  
  // Calculate end date based on active terms
  const lastTerm = activeTerms[activeTerms.length - 1];
  const effectiveEndDate = lastTerm ? new Date(lastTerm.termEndDate) : new Date(lease.leaseEndDate);
  
  // Build sales lookup
  const salesByMonth = new Map<string, number>();
  for (const sale of sales) {
    const key = sale.periodEndDate.slice(0, 7); // YYYY-MM
    salesByMonth.set(key, (salesByMonth.get(key) || 0) + sale.grossSales);
  }
  
  // Calculate schedule month by month
  let currentDate = new Date(leaseStart);
  currentDate.setDate(1); // Start of month
  
  let totals = {
    baseRent: 0,
    recoveries: 0,
    percentageRent: 0,
    concessions: 0,
    grossRent: 0,
  };
  
  for (let i = 0; i < horizonMonths; i++) {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    
    // Check if we're past the effective lease end
    if (monthStart > effectiveEndDate) break;
    
    // Find active term for this month
    const activeTerm = activeTerms.find(t => {
      const termStart = new Date(t.termStartDate);
      const termEnd = new Date(t.termEndDate);
      return monthStart >= termStart && monthStart <= termEnd;
    });
    
    if (!activeTerm) {
      currentDate = addMonths(currentDate, 1);
      continue;
    }
    
    const termStart = new Date(activeTerm.termStartDate);
    const termEnd = new Date(activeTerm.termEndDate);
    
    // Calculate proration
    const proration = calculateProration(monthStart, monthEnd, termStart, termEnd);
    
    if (proration.factor === 0) {
      currentDate = addMonths(currentDate, 1);
      continue;
    }
    
    // Calculate base rent with escalations
    const baseMonthlyRent = calculateMonthlyRent(
      activeTerm.baseRentInputUnit,
      activeTerm.baseRentInputValue,
      lease.sf
    );
    
    const monthsFromTermStart = differenceInMonths(monthStart, termStart);
    const escalationResult = calculateEscalatedRent(
      baseMonthlyRent,
      activeTerm.escalationType,
      activeTerm.escalationValue || null,
      activeTerm.escalationFrequencyMonths || null,
      monthsFromTermStart,
      lease.sf,
      cpiAssumptionPercent
    );
    
    let monthlyRent = escalationResult.rent * proration.factor;
    
    // Apply concessions
    let concessionAmount = 0;
    for (const con of concessions) {
      const conStart = new Date(con.startDate);
      const conEnd = new Date(con.endDate);
      
      if (monthStart >= conStart && monthEnd <= conEnd) {
        switch (con.concessionType) {
          case "FREE_RENT":
            concessionAmount = monthlyRent;
            monthlyRent = 0;
            break;
          case "DISCOUNT_PERCENT":
            concessionAmount = monthlyRent * (con.value / 100);
            monthlyRent -= concessionAmount;
            break;
          case "DISCOUNT_FIXED":
            concessionAmount = Math.min(con.value, monthlyRent);
            monthlyRent -= concessionAmount;
            break;
        }
      }
    }
    
    // Calculate recoveries
    let recoveriesTotal = 0;
    for (const rec of recoveries) {
      switch (rec.method) {
        case "FIXED_MONTHLY":
          recoveriesTotal += (rec.amount || 0) * proration.factor;
          break;
        case "FIXED_ANNUAL":
          recoveriesTotal += ((rec.amount || 0) / 12) * proration.factor;
          break;
        // PRO_RATA and STOP methods would need additional project-level data
      }
    }
    
    // Calculate percentage rent
    let percentRent = 0;
    let isSettlement = false;
    
    if (percentageRent?.enabled && percentageRent.overagePercent) {
      const monthKey = format(monthStart, "yyyy-MM");
      const monthlySales = salesByMonth.get(monthKey) || 0;
      
      if (percentageRent.settlementFrequency) {
        isSettlement = isSettlementMonth(monthStart.getMonth(), percentageRent.settlementFrequency);
      }
      
      if (monthlySales > 0) {
        const annualizedRent = calculateAnnualizedRent(
          activeTerm.baseRentInputUnit,
          activeTerm.baseRentInputValue,
          lease.sf
        );
        
        const breakpoint = percentageRent.breakpointType === "ARTIFICIAL" && percentageRent.breakpointAmountAnnual
          ? percentageRent.breakpointAmountAnnual / 12
          : calculateNaturalBreakpoint(annualizedRent, percentageRent.overagePercent) / 12;
        
        percentRent = calculatePercentageRent(
          monthlySales,
          breakpoint,
          percentageRent.overagePercent
        );
      }
    }
    
    const grossRentTotal = monthlyRent + recoveriesTotal + percentRent;
    
    // Build schedule row
    const row: MonthlyScheduleRow = {
      monthEnd: format(monthEnd, "yyyy-MM-dd"),
      monthStart: format(monthStart, "yyyy-MM-dd"),
      daysInMonth: proration.daysInMonth,
      daysActive: proration.daysActive,
      prorationFactor: proration.factor,
      baseRent: monthlyRent,
      escalationApplied: escalationResult.escalationApplied && monthsFromTermStart > 0,
      escalationPeriod: escalationResult.periodsElapsed,
      effectiveRentRate: escalationResult.rent,
      recoveriesTotal,
      percentageRent: percentRent,
      isSettlementMonth: isSettlement,
      concessionAmount,
      grossRentTotal,
      isPartialMonth: proration.factor < 1,
      termType: activeTerm.termType,
      optionIndex: activeTerm.optionIndex || undefined,
      notes: [],
    };
    
    // Add notes
    if (row.isPartialMonth) row.notes.push("Prorated month");
    if (row.escalationApplied) row.notes.push(`Escalation period ${row.escalationPeriod}`);
    if (row.concessionAmount > 0) row.notes.push("Concession applied");
    
    monthlySchedule.push(row);
    
    // Update totals
    totals.baseRent += row.baseRent;
    totals.recoveries += row.recoveriesTotal;
    totals.percentageRent += row.percentageRent;
    totals.concessions += row.concessionAmount;
    totals.grossRent += row.grossRentTotal;
    
    currentDate = addMonths(currentDate, 1);
  }
  
  // Build annual rollups
  const annualRollups: AnnualRollup[] = [];
  const yearMap = new Map<number, AnnualRollup>();
  
  for (const row of monthlySchedule) {
    const year = new Date(row.monthEnd).getFullYear();
    
    if (!yearMap.has(year)) {
      yearMap.set(year, {
        year,
        baseRent: 0,
        recoveries: 0,
        percentageRent: 0,
        concessions: 0,
        grossRent: 0,
        months: 0,
      });
    }
    
    const rollup = yearMap.get(year)!;
    rollup.baseRent += row.baseRent;
    rollup.recoveries += row.recoveriesTotal;
    rollup.percentageRent += row.percentageRent;
    rollup.concessions += row.concessionAmount;
    rollup.grossRent += row.grossRentTotal;
    rollup.months++;
  }
  
  annualRollups.push(...Array.from(yearMap.values()).sort((a, b) => a.year - b.year));
  
  return {
    leaseId: lease.id,
    tenantName: lease.tenantName,
    monthlySchedule,
    annualRollups,
    totals,
    metadata: {
      horizonStart: monthlySchedule[0]?.monthStart || lease.leaseStartDate,
      horizonEnd: monthlySchedule[monthlySchedule.length - 1]?.monthEnd || lease.leaseEndDate,
      totalMonths: monthlySchedule.length,
      sf: lease.sf,
      leaseType: lease.leaseType,
    },
  };
}

export default {
  calculateLeaseHealth,
  calculateMonthlyRent,
  calculateAnnualizedRent,
  calculateEscalatedRent,
  calculateProration,
  calculateNaturalBreakpoint,
  calculatePercentageRent,
  isSettlementMonth,
  calculateLeaseKpis,
  calculateLeaseSchedule,
};
