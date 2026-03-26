import { db } from "./db";
import { 
  rraTenants as tenants, 
  rraLeases as leases, 
  rraLeaseLineItems as leaseLineItems,
  rraPeriods as periods, 
  rraLeaseCashFlows as leaseCashFlows, 
  rraPnlRackRevenue as pnlRackRevenue, 
  rraMoveEvents as moveEvents,
  rraMarinaLocations as marinaLocations,
  rraStorageLocations as storageLocations,
  rraProjectDetailsConfig as projectDetailsConfig,
  rraRenewalReminders,
  rraTenants,
  rraLeases,
  rraStorageLocations,
  type RraTenant as Tenant,
  type RraLease as Lease,
  type RraLeaseLineItem as LeaseLineItem,
  type InsertRraLeaseLineItem as InsertLeaseLineItem,
  type RraPeriod as Period,
  type RraMoveEvent as MoveEvent,
  type InsertRraTenant as InsertTenant,
  type InsertRraLease as InsertLease,
  type CreateRraLeaseWithTenant as CreateLeaseWithTenant,
  type RraMonthlySummary as MonthlySummary,
  type RraLeaseWithTenant as LeaseWithTenant,
  type RraMarinaLocation as MarinaLocation,
  type InsertRraMarinaLocation as InsertMarinaLocation,
  type RraStorageLocation as StorageLocation,
  type InsertRraStorageLocation as InsertStorageLocation,
} from "@shared/schema";
import { convertToMonthlyRent, getMonthsFromContractTerm } from "./rateConversion";
import { eq, and, gte, lte, sql, desc, asc, isNull, isNotNull, or, inArray } from "drizzle-orm";
import { format, parse, endOfMonth, startOfMonth, addMonths, subMonths, differenceInDays, startOfYear, isBefore, isAfter } from "date-fns";
import { getAssetStrategy, type AssetClassStrategy, type LeaseRecord, type TenantRecord } from "./assetStrategies";

// ============================================================================
// MULTI-ASSET HELPERS
// ============================================================================

/**
 * Resolve the display unit type for a lease, respecting the asset class strategy.
 * For marina: returns storageType (Wet Slip, Dry Rack, etc.)
 * For other classes: returns unitTypeCustom or storageType fallback
 */
export function resolveUnitType(lease: any, assetClass?: string | null): string {
  const strategy = getAssetStrategy(assetClass);
  return strategy.resolveUnitType(lease as LeaseRecord);
}

/**
 * Resolve the primary dimension for rate calculations.
 * For marina: boatLength → slipLength → unitDimension1
 * For self-storage: unitDimension1 (square footage)
 * For CRE: unitDimension1 (square footage)
 */
export function resolveUnitDimension(lease: any, tenant?: any, assetClass?: string | null): number | null {
  const strategy = getAssetStrategy(assetClass);
  return strategy.resolveUnitDimension(lease as LeaseRecord, tenant as TenantRecord);
}

/**
 * Get the asset class for a location by ID. Cached per request.
 */
const locationAssetClassCache = new Map<string, string>();

export async function getLocationAssetClass(locationId: string): Promise<string> {
  if (locationAssetClassCache.has(locationId)) {
    return locationAssetClassCache.get(locationId)!;
  }
  const [loc] = await db
    .select({ assetClass: marinaLocations.assetClass })
    .from(marinaLocations)
    .where(eq(marinaLocations.id, locationId))
    .limit(1);
  const ac = loc?.assetClass || 'marina';
  locationAssetClassCache.set(locationId, ac);
  return ac;
}

// ============================================================================
// PHASE 1 - NEW TYPES FOR AS-OF DATE & YTD SUPPORT
// ============================================================================

export type MonthlySummaryMode = "FULL_PERIOD" | "YTD";

export interface GetMonthlySummaryOptions {
  startDate?: Date;
  endDate?: Date;
  asOfDate?: Date;
  mode?: MonthlySummaryMode;
  locationId?: string | null;
}

// ============================================================================
// PHASE 1 - NEW TYPES FOR PER-LEASE CASH FLOW MATRIX
// ============================================================================

export interface LeaseCashFlowMatrixRow {
  leaseId: string;
  tenantName: string;
  storageType: string | null;
  leaseCommencement: string; // ISO date
  leaseExpiration: string | null;
  marinaLocationName: string | null;
  periodCashFlows: {
    periodId: string;
    periodLabel: string;
    periodDate: string; // ISO date
    rentAmount: number;
    isActiveInPeriod: boolean;
  }[];
}

export interface LeaseCashFlowMatrixResponse {
  periods: {
    periodId: string;
    label: string;
    periodDate: string; // ISO date
  }[];
  rows: LeaseCashFlowMatrixRow[];
}

// ============================================================================
// PHASE 1 - NEW TYPES FOR DATA QUALITY VALIDATION
// ============================================================================

export type DataQualitySeverity = "INFO" | "WARNING" | "ERROR";

export type DataQualityCategory =
  | "LEASE_DATES"
  | "COI"
  | "LEASE_AMOUNT"
  | "TENANT_DATA"
  | "OVERLAPPING_LEASES"
  | "MISC";

export interface DataQualityIssue {
  id: string;
  severity: DataQualitySeverity;
  category: DataQualityCategory;
  message: string;
  leaseId?: string;
  tenantId?: string;
  locationId?: string;
  marinaLocationId?: string;
  metadata?: Record<string, string | number | null>;
}

export interface DataQualitySummary {
  issues: DataQualityIssue[];
  countsBySeverity: Record<DataQualitySeverity, number>;
  countsByCategory: Record<string, number>;
}

// ============================================================================
// DATE UTILITY FUNCTIONS
// ============================================================================

/**
 * Build LeaseKey as: "TenantName|yyyyMMdd|yyyyMMdd"
 */
export function buildLeaseKey(tenantName: string, start: Date, endOrNull: Date | null): string {
  const startStr = format(start, "yyyyMMdd");
  const end = endOrNull ?? new Date(2099, 11, 31); // Dec 31, 2099
  const endStr = format(end, "yyyyMMdd");
  return `${tenantName}|${startStr}|${endStr}`;
}

/**
 * Calculate number of days between two dates (inclusive)
 * Excel DATEDIF "d" includes both start and end dates, so we add 1
 */
export function diffInDays(start: Date, end: Date): number {
  return Math.abs(differenceInDays(end, start)) + 1;
}

/**
 * Calculate number of months using Excel DATEDIF semantics:
 * months = (yearEnd - yearStart)*12 + (monthEnd - monthStart)
 * If dayEnd >= dayStart, add +1
 */
export function diffInMonthsInclusive(start: Date, end: Date): number {
  const yearDiff = end.getFullYear() - start.getFullYear();
  const monthDiff = end.getMonth() - start.getMonth();
  let months = yearDiff * 12 + monthDiff;
  
  if (end.getDate() >= start.getDate()) {
    months += 1;
  }
  
  return Math.max(1, months);
}

/**
 * Get end of month date
 */
export function getEndOfMonth(date: Date): Date {
  return endOfMonth(date);
}

/**
 * Generate array of end-of-month dates between min and max (inclusive)
 */
export function generateMonthlyRange(minDate: Date, maxDate: Date): Date[] {
  const months: Date[] = [];
  let current = endOfMonth(minDate);
  const end = endOfMonth(maxDate);
  
  while (current <= end) {
    months.push(current);
    current = endOfMonth(addMonths(current, 1));
  }
  
  return months;
}

/**
 * Get month label (e.g., "Jan 2024")
 */
export function getMonthLabel(date: Date): string {
  return format(date, "MMM yyyy");
}

// ============================================================================
// PERIOD MANAGEMENT
// ============================================================================

/**
 * Ensure periods exist between min and max dates
 * Creates missing EOM periods and returns all periods in range
 */
export async function ensurePeriodsBetween(minDate: Date, maxDate: Date): Promise<Period[]> {
  const monthDates = generateMonthlyRange(minDate, maxDate);
  
  // Check which periods already exist
  const existingPeriods = await db.query.periods.findMany({
    where: and(
      gte(periods.periodDate, minDate.toISOString().split('T')[0]),
      lte(periods.periodDate, maxDate.toISOString().split('T')[0])
    ),
  });
  
  const existingDateStrs = new Set(existingPeriods.map(p => p.periodDate));
  
  // Insert missing periods
  const toInsert = monthDates
    .filter(date => !existingDateStrs.has(date.toISOString().split('T')[0]))
    .map(date => ({
      periodDate: date.toISOString().split('T')[0],
      label: getMonthLabel(date),
      year: date.getFullYear(),
      month: date.getMonth() + 1, // 1-12
    }));
  
  if (toInsert.length > 0) {
    // Use onConflictDoNothing to handle race conditions and date format mismatches
    await db.insert(periods).values(toInsert).onConflictDoNothing();
  }
  
  // Return all periods in range
  return await db.query.periods.findMany({
    where: and(
      gte(periods.periodDate, minDate.toISOString().split('T')[0]),
      lte(periods.periodDate, maxDate.toISOString().split('T')[0])
    ),
    orderBy: [asc(periods.periodDate)],
  });
}

/**
 * Get or create period for a specific date
 */
export async function getOrCreatePeriod(date: Date): Promise<Period> {
  const eomDate = endOfMonth(date);
  const dateStr = eomDate.toISOString().split('T')[0];
  
  const existing = await db.query.periods.findFirst({
    where: eq(periods.periodDate, dateStr),
  });
  
  if (existing) {
    return existing;
  }
  
  // Use onConflictDoNothing and then fetch to handle race conditions
  await db.insert(periods).values({
    periodDate: dateStr,
    label: getMonthLabel(eomDate),
    year: eomDate.getFullYear(),
    month: eomDate.getMonth() + 1,
  }).onConflictDoNothing();
  
  // Fetch the period (either newly created or existing from race condition)
  const result = await db.query.periods.findFirst({
    where: eq(periods.periodDate, dateStr),
  });
  
  return result!;
}

// ============================================================================
// LEASE OPERATIONS
// ============================================================================

/**
 * Get default date range for cash flow generation when lease has no commencement date.
 * Uses Jan 1 - Dec 31 of current year as fallback.
 */
function getDefaultCashFlowDateRange(): { startDate: Date; endDate: Date } {
  const currentYear = new Date().getFullYear();
  return {
    startDate: new Date(currentYear, 0, 1), // Jan 1
    endDate: new Date(currentYear, 11, 31), // Dec 31
  };
}

/**
 * Create a new lease with tenant
 */
export async function createLeaseWithTenant(data: CreateLeaseWithTenant): Promise<LeaseWithTenant> {
  // Create tenant first
  const [tenant] = await db.insert(tenants).values(data.tenant).returning();
  
  // Determine if lease is incomplete (missing commencement or amount)
  const hasLeaseCommencement = !!data.lease.leaseCommencement;
  const hasLeaseAmount = !!data.lease.leaseAmount;
  const isIncompleteLease = !hasLeaseCommencement || !hasLeaseAmount;
  
  // Track if we're using default dates for cash flow generation
  let usesDefaultDates = false;
  
  // Calculate lease fields only if we have complete data
  let startDate: Date | null = null;
  let endDate: Date | null = null;
  let cashFlowStartDate: Date | null = null;
  let cashFlowEndDate: Date | null = null;
  let leaseKey: string;
  let numDays: number | null = null;
  let numMonths: number | null = null;
  let totalContractValue: number | null = null;
  let leaseAmount: number | null = null;
  let totalMonthlyRent: number | null = null;
  
  if (hasLeaseCommencement) {
    startDate = new Date(data.lease.leaseCommencement!);
    endDate = data.lease.leaseExpiration 
      ? new Date(data.lease.leaseExpiration) 
      : new Date(2099, 11, 31);
    cashFlowStartDate = startDate;
    cashFlowEndDate = endDate;
    numDays = diffInDays(startDate, endDate);
    numMonths = diffInMonthsInclusive(startDate, endDate);
  } else if (hasLeaseAmount) {
    // Use default dates for cash flow generation when amount exists but no commencement
    const defaults = getDefaultCashFlowDateRange();
    cashFlowStartDate = defaults.startDate;
    cashFlowEndDate = defaults.endDate;
    usesDefaultDates = true;
    numMonths = 12; // Full year
  }
  
  if (hasLeaseAmount) {
    leaseAmount = parseFloat(data.lease.leaseAmount!.toString());
    const additionalCharge1 = data.lease.additionalCharge1 ? parseFloat(data.lease.additionalCharge1.toString()) : 0;
    const additionalCharge2 = data.lease.additionalCharge2 ? parseFloat(data.lease.additionalCharge2.toString()) : 0;
    const additionalCharge3 = data.lease.additionalCharge3 ? parseFloat(data.lease.additionalCharge3.toString()) : 0;
    totalMonthlyRent = leaseAmount + additionalCharge1 + additionalCharge2 + additionalCharge3;
    
    if (numMonths !== null) {
      totalContractValue = totalMonthlyRent * numMonths;
    }
  }
  
  // Generate lease key - use UUID for incomplete leases
  if (isIncompleteLease) {
    leaseKey = `${tenant.name}|${data.lease.locationId || 'NOLOC'}|${crypto.randomUUID()}`;
  } else {
    leaseKey = buildLeaseKey(tenant.name, startDate!, data.lease.leaseExpiration ? endDate : null);
  }
  
  // Create lease
  const additionalCharge1 = data.lease.additionalCharge1 ? parseFloat(data.lease.additionalCharge1.toString()) : 0;
  const additionalCharge2 = data.lease.additionalCharge2 ? parseFloat(data.lease.additionalCharge2.toString()) : 0;
  const additionalCharge3 = data.lease.additionalCharge3 ? parseFloat(data.lease.additionalCharge3.toString()) : 0;
  
  const [lease] = await db.insert(leases).values({
    tenantId: tenant.id,
    locationId: data.lease.locationId || null,
    leaseCommencement: data.lease.leaseCommencement || null,
    leaseExpiration: data.lease.leaseExpiration || null,
    leaseAmount: leaseAmount !== null ? leaseAmount.toString() : null,
    rateType: data.lease.rateType || null,
    contractTerm: data.lease.contractTerm || null,
    storageType: data.lease.storageType || "Wet Slip",
    unitTypeCustom: (data.lease as any).unitTypeCustom || null,
    unitDimension1: (data.lease as any).unitDimension1 ? String((data.lease as any).unitDimension1) : null,
    unitDimension2: (data.lease as any).unitDimension2 ? String((data.lease as any).unitDimension2) : null,
    boatType: data.lease.boatType || null,
    unitLocation: data.lease.unitLocation || null,
    unitNumber: data.lease.unitNumber || null,
    boatDimensions: data.lease.boatDimensions || null,
    slipLength: data.lease.slipLength ? data.lease.slipLength.toString() : null,
    slipWidth: data.lease.slipWidth ? data.lease.slipWidth.toString() : null,
    leaseOnFile: data.lease.leaseOnFile ?? null,
    coiOnFile: data.lease.coiOnFile ?? null,
    coiExpiration: data.lease.coiExpiration || null,
    hasDiscount: data.lease.hasDiscount ?? false,
    discountType: data.lease.discountType || null,
    discountValue: data.lease.discountValue ? data.lease.discountValue.toString() : null,
    additionalCharge1: additionalCharge1.toString(),
    additionalCharge2: additionalCharge2.toString(),
    additionalCharge3: additionalCharge3.toString(),
    leaseKey,
    numDays,
    numMonths,
    totalContractValue: totalContractValue !== null ? totalContractValue.toString() : null,
    isActive: true,
    isIncomplete: isIncompleteLease,
    usesDefaultDates,
  }).returning();
  
  // Generate periods and cash flows if we have dates (actual or default) and a monthly rent
  if (cashFlowStartDate && cashFlowEndDate && totalMonthlyRent !== null) {
    await generateLeaseCashFlows(lease.id, cashFlowStartDate, cashFlowEndDate, totalMonthlyRent);
  }
  
  return {
    ...lease,
    tenant,
  };
}

// ===== Normalization utilities for updateLease =====

/** 
 * Normalize optional numeric fields for storage: 
 * - undefined = no change (field not in payload)
 * - "" or null = cleared (intentionally empty)
 * - number/string = parsed value as string
 */
function normalizeOptionalNumber(value: string | number | null | undefined): string | null | undefined {
  if (value === undefined) return undefined; // Not in payload = no change
  if (value === null || value === "") return null; // Cleared
  // Remove commas and parse
  const cleaned = typeof value === 'string' ? value.replace(/,/g, '').trim() : value;
  const num = parseFloat(cleaned.toString());
  if (isNaN(num)) return null;
  return num.toString();
}

/** 
 * Normalize optional date fields for storage:
 * - undefined = no change (field not in payload)
 * - "" or null = cleared (intentionally empty)
 * - valid date string = normalized ISO date (YYYY-MM-DD)
 */
function normalizeDateString(value: string | null | undefined): string | null | undefined {
  if (value === undefined) return undefined; // Not in payload = no change
  if (value === null || value === "") return null; // Cleared
  const trimmed = value.trim();
  if (!trimmed) return null;
  const date = new Date(trimmed);
  if (isNaN(date.getTime())) return null;
  // Return as YYYY-MM-DD for consistent comparison
  return trimmed;
}

/** Check if a value represents a valid positive amount (> 0) */
function isValidPositiveAmount(value: string | null | undefined): boolean {
  if (value === null || value === undefined || value === "") return false;
  const num = parseFloat(value);
  return !isNaN(num) && num > 0;
}

/** Check if a value represents a valid non-negative amount (>= 0, including 0) */
function isValidNonNegativeAmount(value: string | null | undefined): boolean {
  if (value === null || value === undefined || value === "") return false;
  const num = parseFloat(value);
  return !isNaN(num) && num >= 0;
}

/** Check if a value represents a valid date */
function isValidDateValue(value: string | null | undefined): boolean {
  if (value === null || value === undefined || value === "") return false;
  const date = new Date(value);
  return !isNaN(date.getTime());
}

/** 
 * Compare two nullable numeric strings for equality
 * Treats null, undefined, "", and "0" as equivalent for charges
 */
function areEqualNullableAmounts(a: string | null | undefined, b: string | null | undefined): boolean {
  // Normalize: null, undefined, "", "0", "0.00" -> null
  const normalizeForComparison = (v: string | null | undefined): string | null => {
    if (v === undefined || v === null || v === "") return null;
    const num = parseFloat(v);
    if (isNaN(num) || num === 0) return null; // Treat 0 as null/empty
    return num.toString(); // Normalize to consistent numeric string
  };
  return normalizeForComparison(a) === normalizeForComparison(b);
}

/** Compare two nullable date strings for equality (null == "" == null) */
function areEqualNullableDates(a: string | null | undefined, b: string | null | undefined): boolean {
  const normalizedA = (a === undefined || a === null || a === "") ? null : a;
  const normalizedB = (b === undefined || b === null || b === "") ? null : b;
  if (normalizedA === null && normalizedB === null) return true;
  if (normalizedA === null || normalizedB === null) return false;
  // Compare as dates to handle format differences
  const dateA = new Date(normalizedA);
  const dateB = new Date(normalizedB);
  return dateA.getTime() === dateB.getTime();
}

/**
 * Update an existing lease
 */
export async function updateLease(
  leaseId: string, 
  tenantData: Partial<InsertTenant>, 
  leaseData: Partial<InsertLease>
): Promise<LeaseWithTenant> {
  // Get existing lease with tenant
  const existing = await db.query.rraLeases.findFirst({
    where: eq(leases.id, leaseId),
    with: { tenant: true },
  });
  
  if (!existing) {
    throw new Error("Lease not found");
  }
  
  // Update tenant if data provided
  if (Object.keys(tenantData).length > 0) {
    await db.update(tenants)
      .set({ ...tenantData, updatedAt: new Date() })
      .where(eq(tenants.id, existing.tenantId));
  }
  
  // Update lease if data provided
  const hasLeaseUpdates = Object.keys(leaseData).length > 0;
  if (hasLeaseUpdates) {
    // Normalize incoming values
    const normalizedCommencement = normalizeDateString(leaseData.leaseCommencement);
    const normalizedExpiration = normalizeDateString(leaseData.leaseExpiration);
    const normalizedAmount = normalizeOptionalNumber(leaseData.leaseAmount);
    const normalizedCharge1 = normalizeOptionalNumber(leaseData.additionalCharge1);
    const normalizedCharge2 = normalizeOptionalNumber(leaseData.additionalCharge2);
    const normalizedCharge3 = normalizeOptionalNumber(leaseData.additionalCharge3);
    
    // Build effective values by merging normalized input with existing data
    // undefined means "no change", so use existing value
    const effectiveCommencement = normalizedCommencement !== undefined 
      ? normalizedCommencement 
      : existing.leaseCommencement;
    const effectiveExpiration = normalizedExpiration !== undefined 
      ? normalizedExpiration 
      : existing.leaseExpiration;
    const effectiveAmount = normalizedAmount !== undefined 
      ? normalizedAmount 
      : existing.leaseAmount;
    const effectiveCharge1 = normalizedCharge1 !== undefined 
      ? normalizedCharge1 
      : existing.additionalCharge1;
    const effectiveCharge2 = normalizedCharge2 !== undefined 
      ? normalizedCharge2 
      : existing.additionalCharge2;
    const effectiveCharge3 = normalizedCharge3 !== undefined 
      ? normalizedCharge3 
      : existing.additionalCharge3;
    
    // Determine completeness
    const hasValidCommencement = isValidDateValue(effectiveCommencement);
    const hasValidAmount = isValidPositiveAmount(effectiveAmount);
    const isIncompleteLease = !hasValidCommencement || !hasValidAmount;
    const wasIncomplete = existing.isIncomplete;
    
    // Track default dates usage for cash flow generation
    let usesDefaultDates = false;
    let cashFlowStartDate: Date | null = null;
    let cashFlowEndDate: Date | null = null;
    
    // Calculate derived fields only if we have complete data
    let startDate: Date | null = null;
    let endDate: Date | null = null;
    let numDays: number | null = null;
    let numMonths: number | null = null;
    let totalMonthlyRent: number | null = null;
    let totalContractValue: string | null = null;
    
    if (hasValidCommencement) {
      startDate = new Date(effectiveCommencement!);
      endDate = effectiveExpiration 
        ? new Date(effectiveExpiration) 
        : new Date(2099, 11, 31);
      cashFlowStartDate = startDate;
      cashFlowEndDate = endDate;
      numDays = diffInDays(startDate, endDate);
      numMonths = diffInMonthsInclusive(startDate, endDate);
      usesDefaultDates = false;
    } else if (hasValidAmount) {
      // Use default dates for cash flow generation when amount exists but no commencement
      const defaults = getDefaultCashFlowDateRange();
      cashFlowStartDate = defaults.startDate;
      cashFlowEndDate = defaults.endDate;
      usesDefaultDates = true;
      numMonths = 12; // Full year
    }
    
    if (hasValidAmount) {
      const leaseAmount = parseFloat(effectiveAmount!);
      const charge1 = parseFloat(effectiveCharge1 || "0");
      const charge2 = parseFloat(effectiveCharge2 || "0");
      const charge3 = parseFloat(effectiveCharge3 || "0");
      totalMonthlyRent = leaseAmount + charge1 + charge2 + charge3;
      
      if (numMonths !== null) {
        totalContractValue = (totalMonthlyRent * numMonths).toString();
      }
    }
    
    // Determine lease key
    const tenantName = tenantData.name || existing.tenant.name;
    let leaseKey: string;
    if (isIncompleteLease) {
      // Keep existing key if already incomplete, otherwise generate new one
      leaseKey = wasIncomplete 
        ? existing.leaseKey 
        : `${tenantName}|${existing.locationId || 'NOLOC'}|${crypto.randomUUID()}`;
    } else {
      leaseKey = buildLeaseKey(tenantName, startDate!, effectiveExpiration ? endDate : null);
    }
    
    // Determine what actually changed for cash flow decisions
    // A field is "changed" only if it was provided in the payload AND differs from existing
    const commencementChanged = normalizedCommencement !== undefined && 
      !areEqualNullableDates(normalizedCommencement, existing.leaseCommencement);
    const expirationChanged = normalizedExpiration !== undefined && 
      !areEqualNullableDates(normalizedExpiration, existing.leaseExpiration);
    const amountChanged = normalizedAmount !== undefined && 
      !areEqualNullableAmounts(normalizedAmount, existing.leaseAmount);
    const charge1Changed = normalizedCharge1 !== undefined && 
      !areEqualNullableAmounts(normalizedCharge1, existing.additionalCharge1);
    const charge2Changed = normalizedCharge2 !== undefined && 
      !areEqualNullableAmounts(normalizedCharge2, existing.additionalCharge2);
    const charge3Changed = normalizedCharge3 !== undefined && 
      !areEqualNullableAmounts(normalizedCharge3, existing.additionalCharge3);
    
    const cashFlowFieldsChanged = commencementChanged || expirationChanged || 
      amountChanged || charge1Changed || charge2Changed || charge3Changed;
    const transitionedToComplete = wasIncomplete && !isIncompleteLease;
    const transitionedToIncomplete = !wasIncomplete && isIncompleteLease;
    
    // Build the update payload - only include fields that have normalized values
    const updatePayload: Record<string, any> = {
      leaseKey,
      numDays,
      numMonths,
      totalContractValue,
      isIncomplete: isIncompleteLease,
      usesDefaultDates,
      updatedAt: new Date(),
    };
    
    // Add normalized fields only if they were provided (not undefined)
    if (normalizedCommencement !== undefined) {
      updatePayload.leaseCommencement = normalizedCommencement;
    }
    if (normalizedExpiration !== undefined) {
      updatePayload.leaseExpiration = normalizedExpiration;
    }
    if (normalizedAmount !== undefined) {
      updatePayload.leaseAmount = normalizedAmount;
    }
    if (normalizedCharge1 !== undefined) {
      updatePayload.additionalCharge1 = normalizedCharge1;
    }
    if (normalizedCharge2 !== undefined) {
      updatePayload.additionalCharge2 = normalizedCharge2;
    }
    if (normalizedCharge3 !== undefined) {
      updatePayload.additionalCharge3 = normalizedCharge3;
    }
    
    // Copy over any other lease fields that were provided (non-financial fields)
    const financialFields = ['leaseCommencement', 'leaseExpiration', 'leaseAmount', 
      'additionalCharge1', 'additionalCharge2', 'additionalCharge3'];
    for (const [key, value] of Object.entries(leaseData)) {
      if (!financialFields.includes(key) && value !== undefined) {
        updatePayload[key] = value;
      }
    }
    
    await db.update(leases)
      .set(updatePayload)
      .where(eq(leases.id, leaseId));
    
    // Handle cash flows - now supports default dates for incomplete leases with amounts
    const hasCashFlowDates = cashFlowStartDate !== null && cashFlowEndDate !== null;
    const hasAmount = totalMonthlyRent !== null;
    const needsCashFlowRegeneration = hasCashFlowDates && hasAmount &&
      (cashFlowFieldsChanged || transitionedToComplete || 
       (usesDefaultDates !== existing.usesDefaultDates));
    
    // Determine if we should delete cash flows (no amount anymore)
    const shouldDeleteCashFlows = !hasAmount;
    
    if (shouldDeleteCashFlows) {
      // No amount: delete all cash flows
      await db.delete(leaseCashFlows).where(eq(leaseCashFlows.leaseId, leaseId));
    } else if (needsCashFlowRegeneration) {
      // Regenerate cash flows (with actual or default dates)
      await db.delete(leaseCashFlows).where(eq(leaseCashFlows.leaseId, leaseId));
      await generateLeaseCashFlows(leaseId, cashFlowStartDate!, cashFlowEndDate!, totalMonthlyRent!);
    }
    // If no relevant changes, don't touch cash flows (preserves existing data)
  }
  
  // Return updated lease with tenant
  const updated = await db.query.rraLeases.findFirst({
    where: eq(leases.id, leaseId),
    with: { tenant: true },
  });
  
  return updated as LeaseWithTenant;
}

/**
 * Get all leases with tenant data, filtered by organizationIds and optionally by locationId
 */
export async function getAllLeasesWithTenants(filters?: {
  state?: string;
  isActive?: boolean;
  storageType?: string;
  page?: number;
  pageSize?: number;
  organizationIds?: string[];
  locationId?: string;
}): Promise<{ leases: LeaseWithTenant[]; total: number }> {
  const conditions = [];
  
  if (filters?.isActive !== undefined) {
    conditions.push(eq(leases.isActive, filters.isActive));
  }
  
  if (filters?.storageType) {
    conditions.push(eq(leases.storageType, filters.storageType as any));
  }
  
  // Get allowed location IDs based on organization access
  let allowedLocationIds: string[] = [];
  if (filters?.organizationIds && filters.organizationIds.length > 0) {
    const allowedLocations = await db
      .select({ id: marinaLocations.id })
      .from(marinaLocations)
      .where(inArray(marinaLocations.organizationId, filters.organizationIds));
    
    allowedLocationIds = allowedLocations.map(l => l.id);
    
    if (allowedLocationIds.length === 0) {
      return { leases: [], total: 0 };
    }
  }
  
  // Filter by specific locationId if provided (must still be in allowed locations)
  if (filters?.locationId) {
    // Verify the locationId is in the allowed list (security check)
    if (allowedLocationIds.length > 0 && !allowedLocationIds.includes(filters.locationId)) {
      return { leases: [], total: 0 }; // User doesn't have access to this location
    }
    conditions.push(eq(leases.locationId, filters.locationId));
  } else if (allowedLocationIds.length > 0) {
    // Otherwise filter by all allowed locations
    conditions.push(inArray(leases.locationId, allowedLocationIds));
  }
  
  const allLeases = await db.query.rraLeases.findMany({
    where: conditions.length > 0 ? and(...conditions) : undefined,
    with: { tenant: true },
    orderBy: [desc(leases.createdAt)],
  });
  
  // Filter by state on tenant if needed
  let filtered = allLeases;
  if (filters?.state) {
    filtered = allLeases.filter(l => l.tenant.state === filters.state);
  }
  
  // Pagination - pageSize of -1 or 0 means no pagination (return all)
  const page = filters?.page || 1;
  const pageSize = filters?.pageSize || 50;
  const noPagination = pageSize <= 0;
  
  let paginatedLeases: typeof filtered;
  if (noPagination) {
    paginatedLeases = filtered;
  } else {
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    paginatedLeases = filtered.slice(start, end);
  }
  
  // Fetch line items for all paginated leases in a single query
  const leaseIds = paginatedLeases.map(l => l.id);
  let lineItemsMap = new Map<string, LeaseLineItem[]>();
  
  if (leaseIds.length > 0) {
    const allLineItems = await db
      .select()
      .from(leaseLineItems)
      .where(inArray(leaseLineItems.leaseId, leaseIds));
    
    // Group line items by leaseId
    for (const item of allLineItems) {
      const existing = lineItemsMap.get(item.leaseId) || [];
      existing.push(item);
      lineItemsMap.set(item.leaseId, existing);
    }
  }
  
  // Attach line items to each lease
  const leasesWithLineItems = paginatedLeases.map(lease => ({
    ...lease,
    lineItems: lineItemsMap.get(lease.id) || [],
  }));
  
  return {
    leases: leasesWithLineItems as LeaseWithTenant[],
    total: filtered.length,
  };
}

/**
 * Delete a lease and its associated tenant (hard delete)
 * Also removes related cash flows
 */
export async function deleteLease(leaseId: string): Promise<void> {
  // Get the tenant ID before deleting the lease
  const leaseToDelete = await db.select({ tenantId: leases.tenantId })
    .from(leases)
    .where(eq(leases.id, leaseId))
    .limit(1);
  
  if (leaseToDelete.length === 0) {
    return; // Lease not found, nothing to delete
  }
  
  const tenantId = leaseToDelete[0].tenantId;
  
  // Delete cash flows first (foreign key constraint)
  await db.delete(leaseCashFlows)
    .where(eq(leaseCashFlows.leaseId, leaseId));
  
  // Delete the lease
  await db.delete(leases)
    .where(eq(leases.id, leaseId));
  
  // Delete the tenant
  await db.delete(tenants)
    .where(eq(tenants.id, tenantId));
}

/**
 * Bulk delete multiple leases and their associated tenants (hard delete)
 * Also removes related cash flows
 * Verifies all lease IDs exist and belong to the user's organization
 * Throws error if ANY lease is unauthorized
 */
export async function bulkDeleteLeases(leaseIds: string[], organizationId: string): Promise<number> {
  if (!leaseIds || leaseIds.length === 0) {
    return 0;
  }
  
  if (!organizationId) {
    throw new Error("Organization ID is required for authorization");
  }
  
  // Verify all leases exist and belong to accessible locations, get tenant IDs
  const existingLeases = await db.select({ 
      id: leases.id,
      tenantId: leases.tenantId,
      locationId: leases.locationId,
      organizationId: marinaLocations.organizationId 
    })
    .from(leases)
    .innerJoin(marinaLocations, eq(leases.locationId, marinaLocations.id))
    .where(inArray(leases.id, leaseIds));
  
  // Check if we found all requested leases
  if (existingLeases.length !== leaseIds.length) {
    const foundIds = new Set(existingLeases.map(l => l.id));
    const missingIds = leaseIds.filter(id => !foundIds.has(id));
    throw new Error(`Lease(s) not found: ${missingIds.join(', ')}`);
  }
  
  // Check if ALL leases belong to the user's organization
  const unauthorizedLeases = existingLeases.filter(l => l.organizationId !== organizationId);
  if (unauthorizedLeases.length > 0) {
    throw new Error(`Access denied: You do not have permission to delete ${unauthorizedLeases.length} lease(s)`);
  }
  
  // Get tenant IDs to delete
  const tenantIds = existingLeases.map(l => l.tenantId);
  
  // Delete cash flows first (foreign key constraint)
  await db.delete(leaseCashFlows)
    .where(inArray(leaseCashFlows.leaseId, leaseIds));
  
  // Delete the leases
  await db.delete(leases)
    .where(inArray(leases.id, leaseIds));
  
  // Delete the tenants
  if (tenantIds.length > 0) {
    await db.delete(tenants)
      .where(inArray(tenants.id, tenantIds));
  }
  
  return leaseIds.length;
}

/**
 * Bulk update multiple leases with the same field values
 * Only updates non-null/undefined fields provided in the updates object
 */
export async function bulkUpdateLeases(
  leaseIds: string[], 
  updates: {
    // Location
    unitLocation?: string;
    unitNumber?: string;
    // Financial
    leaseAmount?: number;
    baseRent2?: number;
    baseRent3?: number;
    additionalCharge1?: number;
    additionalCharge2?: number;
    additionalCharge3?: number;
    // Dates
    commencementDate?: string;
    expirationDate?: string;
    // Slip dimensions
    slipLength?: number;
    slipWidth?: number;
    // Classification
    storageType?: string;
    slipStatus?: string;
    rateType?: string;
    contractTerm?: string;
    boatType?: string;
    // Documentation
    leaseOnFile?: boolean;
    coiOnFile?: boolean;
    coiExpiration?: string;
    // Discount
    hasDiscount?: boolean;
    discountType?: "PERCENT_OFF" | "FLAT_RATE" | "AMOUNT_OFF";
    discountValue?: string;
  },
  organizationId: string
): Promise<number> {
  if (!leaseIds || leaseIds.length === 0) {
    return 0;
  }
  
  if (!organizationId) {
    throw new Error("Organization ID is required for authorization");
  }
  
  // Verify all leases exist and belong to accessible locations
  const existingLeases = await db.select({ 
      id: leases.id,
      locationId: leases.locationId,
      organizationId: marinaLocations.organizationId 
    })
    .from(leases)
    .innerJoin(marinaLocations, eq(leases.locationId, marinaLocations.id))
    .where(
      and(
        inArray(leases.id, leaseIds),
        eq(leases.isActive, true)
      )
    );
  
  // Check if we found all requested leases
  if (existingLeases.length !== leaseIds.length) {
    const foundIds = new Set(existingLeases.map(l => l.id));
    const missingIds = leaseIds.filter(id => !foundIds.has(id));
    throw new Error(`Lease(s) not found or inactive: ${missingIds.join(', ')}`);
  }
  
  // Check if ALL leases belong to the user's organization
  const unauthorizedLeases = existingLeases.filter(l => l.organizationId !== organizationId);
  if (unauthorizedLeases.length > 0) {
    throw new Error(`Access denied: You do not have permission to update ${unauthorizedLeases.length} lease(s)`);
  }
  
  // Build the update object with only provided fields
  const updateFields: Record<string, any> = { updatedAt: new Date() };
  
  // Location - physical location text field (e.g., "A Dock", "Slip 23")
  if (updates.unitLocation !== undefined) {
    updateFields.unitLocation = updates.unitLocation || null;
  }
  if (updates.unitNumber !== undefined) {
    updateFields.unitNumber = updates.unitNumber || null;
  }
  
  // Financial
  if (updates.leaseAmount !== undefined) {
    updateFields.leaseAmount = updates.leaseAmount.toString();
  }
  if (updates.baseRent2 !== undefined) {
    updateFields.baseRent2 = updates.baseRent2.toString();
  }
  if (updates.baseRent3 !== undefined) {
    updateFields.baseRent3 = updates.baseRent3.toString();
  }
  if (updates.additionalCharge1 !== undefined) {
    updateFields.additionalCharge1 = updates.additionalCharge1.toString();
  }
  if (updates.additionalCharge2 !== undefined) {
    updateFields.additionalCharge2 = updates.additionalCharge2.toString();
  }
  if (updates.additionalCharge3 !== undefined) {
    updateFields.additionalCharge3 = updates.additionalCharge3.toString();
  }
  
  // Dates - map API field names to database column names
  // Store as simple date strings to avoid timezone issues
  if (updates.commencementDate !== undefined) {
    updateFields.leaseCommencement = updates.commencementDate;
  }
  if (updates.expirationDate !== undefined) {
    updateFields.leaseExpiration = updates.expirationDate;
  }
  
  // Slip dimensions
  if (updates.slipLength !== undefined) {
    updateFields.slipLength = updates.slipLength.toString();
  }
  if (updates.slipWidth !== undefined) {
    updateFields.slipWidth = updates.slipWidth.toString();
  }
  
  // Classification
  if (updates.storageType !== undefined) {
    updateFields.storageType = updates.storageType;
  }
  if (updates.slipStatus !== undefined) {
    updateFields.slipStatus = updates.slipStatus;
  }
  if (updates.rateType !== undefined) {
    updateFields.rateType = updates.rateType;
  }
  if (updates.contractTerm !== undefined) {
    updateFields.contractTerm = updates.contractTerm;
  }
  if (updates.boatType !== undefined) {
    updateFields.boatType = updates.boatType;
  }
  
  // If rateType is being changed, recalculate leaseAmount to monthly rent for each lease
  // This requires fetching each lease's data and applying the conversion
  // IMPORTANT: We interpret the stored leaseAmount using the OLD rate type (what was stored)
  // and convert it to monthly rent. If a new leaseAmount is provided in updates, we use
  // that value interpreted in the NEW rate type instead.
  if (updates.rateType !== undefined) {
    // Fetch lease data needed for conversion (including current rateType and slip dimensions)
    const leasesForConversion = await db.select({
      id: leases.id,
      leaseAmount: leases.leaseAmount,
      rateType: leases.rateType, // The OLD rate type for interpretation
      numMonths: leases.numMonths,
      contractTerm: leases.contractTerm,
      leaseCommencement: leases.leaseCommencement,
      leaseExpiration: leases.leaseExpiration,
      slipLength: leases.slipLength,
      slipWidth: leases.slipWidth,
    })
    .from(leases)
    .where(inArray(leases.id, leaseIds));
    
    // Also fetch tenant data for boat dimensions (via lease -> tenant relationship)
    const leasesWithTenants = await db.select({
      leaseId: leases.id,
      tenantId: leases.tenantId,
      boatLength: tenants.boatLength,
    })
    .from(leases)
    .innerJoin(tenants, eq(leases.tenantId, tenants.id))
    .where(inArray(leases.id, leaseIds));
    
    const tenantByLeaseId = new Map(leasesWithTenants.map(t => [t.leaseId, t]));
    
    // Update each lease with converted leaseAmount ONLY if rateType is actually changing
    for (const lease of leasesForConversion) {
      // Normalize rate types for comparison (null, undefined, "" are all treated as "no rate type")
      const oldRateType = (lease.rateType || "").trim();
      const newRateType = (updates.rateType || "").trim();
      
      // Skip conversion if rateType is not actually changing
      // This prevents the bug where saving the same rateType repeatedly divides the amount
      if (oldRateType === newRateType) {
        continue;
      }
      
      // Determine the raw amount to convert:
      // - If updates.leaseAmount is provided, use it (in the NEW rate basis)
      // - Otherwise, use the stored leaseAmount (in the OLD rate basis)
      const hasNewAmount = updates.leaseAmount !== undefined;
      const rawAmount = hasNewAmount 
        ? updates.leaseAmount 
        : (lease.leaseAmount ? parseFloat(lease.leaseAmount) : 0);
      
      if (rawAmount <= 0) continue;
      
      const tenant = tenantByLeaseId.get(lease.id);
      const boatLength = tenant?.boatLength ? parseFloat(tenant.boatLength) : null;
      
      // Get slip dimensions for fallback in per-foot calculations
      const slipLength = lease.slipLength ? parseFloat(lease.slipLength) : null;
      const slipWidth = lease.slipWidth ? parseFloat(lease.slipWidth) : null;
      
      // For per-foot calculations, use boat length if available, otherwise use slip length
      const effectiveLength = boatLength || slipLength;
      
      // Calculate numMonths from dates - prioritize date calculation over stored value
      let numMonths: number | null = null;
      if (lease.leaseCommencement && lease.leaseExpiration) {
        const startDate = new Date(lease.leaseCommencement + 'T12:00:00');
        const endDate = new Date(lease.leaseExpiration + 'T12:00:00');
        const monthsDiff = (endDate.getFullYear() - startDate.getFullYear()) * 12 + 
                          (endDate.getMonth() - startDate.getMonth()) + 1;
        numMonths = Math.max(1, monthsDiff);
      } else if (lease.numMonths) {
        numMonths = lease.numMonths;
      }
      
      // Use contract term from update if provided, otherwise use existing
      const effectiveContractTerm = updates.contractTerm || lease.contractTerm;
      
      // Determine which rate type to use for conversion:
      // - If new amount provided, interpret it in the NEW rate type
      // - If using stored amount, interpret it in the OLD rate type
      const rateTypeForConversion = hasNewAmount ? updates.rateType : lease.rateType;
      
      // Convert to monthly rent using the appropriate rate basis
      const monthlyRent = convertToMonthlyRent({
        rawAmount,
        rateType: rateTypeForConversion,
        numMonths,
        boatLength: effectiveLength,
        slipLength,
        slipWidth,
        contractTerm: effectiveContractTerm,
      });
      
      // Update this lease's leaseAmount to the normalized monthly rent
      await db.update(leases)
        .set({ 
          leaseAmount: monthlyRent.toFixed(2),
          updatedAt: new Date()
        })
        .where(eq(leases.id, lease.id));
    }
    
    // Remove leaseAmount from updateFields since we handled it per-lease
    delete updateFields.leaseAmount;
  }
  
  // Documentation
  if (updates.leaseOnFile !== undefined) {
    updateFields.leaseOnFile = updates.leaseOnFile;
  }
  if (updates.coiOnFile !== undefined) {
    updateFields.coiOnFile = updates.coiOnFile;
  }
  if (updates.coiExpiration !== undefined) {
    updateFields.coiExpiration = updates.coiExpiration || null;
  }
  
  // Discount
  if (updates.hasDiscount !== undefined) {
    updateFields.hasDiscount = updates.hasDiscount;
    // If setting hasDiscount to false, clear the discount type and value
    if (!updates.hasDiscount) {
      updateFields.discountType = null;
      updateFields.discountValue = null;
    }
  }
  if (updates.discountType !== undefined) {
    updateFields.discountType = updates.discountType;
  }
  if (updates.discountValue !== undefined) {
    updateFields.discountValue = updates.discountValue;
  }
  
  // Perform the initial bulk update
  await db.update(leases)
    .set(updateFields)
    .where(inArray(leases.id, leaseIds));
  
  // If dates or amount changed, recalculate numMonths, totalContractValue AND regenerate cash flows
  if (updates.commencementDate !== undefined || updates.expirationDate !== undefined || 
      updates.leaseAmount !== undefined || updates.baseRent2 !== undefined || updates.baseRent3 !== undefined) {
    // Fetch updated leases to recalculate
    const updatedLeases = await db.select({
      id: leases.id,
      leaseCommencement: leases.leaseCommencement,
      leaseExpiration: leases.leaseExpiration,
      leaseAmount: leases.leaseAmount,
      baseRent2: leases.baseRent2,
      baseRent3: leases.baseRent3,
    })
    .from(leases)
    .where(inArray(leases.id, leaseIds));
    
    // Update each lease with recalculated values and regenerate cash flows
    for (const lease of updatedLeases) {
      // Calculate total monthly rent (sum of all rent columns)
      const baseRent1 = lease.leaseAmount ? parseFloat(lease.leaseAmount) : 0;
      const rent2 = lease.baseRent2 ? parseFloat(lease.baseRent2) : 0;
      const rent3 = lease.baseRent3 ? parseFloat(lease.baseRent3) : 0;
      const totalMonthlyRent = baseRent1 + rent2 + rent3;
      
      if (lease.leaseCommencement && lease.leaseExpiration && totalMonthlyRent > 0) {
        const startDate = new Date(lease.leaseCommencement + 'T12:00:00');
        const endDate = new Date(lease.leaseExpiration + 'T12:00:00');
        
        // Calculate number of months
        const monthsDiff = (endDate.getFullYear() - startDate.getFullYear()) * 12 + 
                          (endDate.getMonth() - startDate.getMonth()) + 1;
        const numMonths = Math.max(1, monthsDiff);
        
        // Calculate total contract value
        const totalContractValue = totalMonthlyRent * numMonths;
        
        // Update the lease with calculated values
        // Also clear usesDefaultDates since user has now set explicit dates
        await db.update(leases)
          .set({
            numMonths,
            totalContractValue: totalContractValue.toString(),
            usesDefaultDates: false, // Clear default dates flag when user updates dates
            isIncomplete: false, // No longer incomplete if has dates and amount
          })
          .where(eq(leases.id, lease.id));
        
        // Regenerate cash flows: delete old ones and create new ones
        await db.delete(leaseCashFlows).where(eq(leaseCashFlows.leaseId, lease.id));
        await generateLeaseCashFlows(lease.id, startDate, endDate, totalMonthlyRent);
      } else if (totalMonthlyRent === 0) {
        // No rent amount - delete all cash flows for this lease
        await db.delete(leaseCashFlows).where(eq(leaseCashFlows.leaseId, lease.id));
      }
    }
  }
  
  return leaseIds.length;
}

/**
 * Reset/clear all data for a project (leases, tenants, cash flows, storage locations)
 * This is a destructive operation - all data will be permanently deleted
 * Wrapped in a transaction to ensure atomicity
 */
export async function resetProjectData(locationId: string): Promise<{ deletedLeases: number; deletedStorageLocations: number }> {
  return await db.transaction(async (tx) => {
    // Get all lease IDs for this location
    const locationLeases = await tx.select({ id: leases.id })
      .from(leases)
      .where(eq(leases.locationId, locationId));
    
    const leaseIds = locationLeases.map(l => l.id);
    
    let deletedLeases = 0;
    let deletedStorageLocations = 0;
    
    if (leaseIds.length > 0) {
      // Delete cash flows for these leases
      await tx.delete(leaseCashFlows)
        .where(inArray(leaseCashFlows.leaseId, leaseIds));
      
      // Get tenant IDs from these leases
      const leaseTenants = await tx.select({ tenantId: leases.tenantId })
        .from(leases)
        .where(inArray(leases.id, leaseIds));
      
      const tenantIds = leaseTenants.map(l => l.tenantId).filter(Boolean) as string[];
      
      // Delete leases
      await tx.delete(leases)
        .where(inArray(leases.id, leaseIds));
      
      deletedLeases = leaseIds.length;
      
      // Delete tenants (if they exist)
      if (tenantIds.length > 0) {
        await tx.delete(tenants)
          .where(inArray(tenants.id, tenantIds));
      }
    }
    
    // Delete storage locations for this project
    const locationStorages = await tx.select({ id: storageLocations.id })
      .from(storageLocations)
      .where(eq(storageLocations.projectId, locationId));
    
    const storageIds = locationStorages.map(s => s.id);
    
    if (storageIds.length > 0) {
      await tx.delete(storageLocations)
        .where(inArray(storageLocations.id, storageIds));
      
      deletedStorageLocations = storageIds.length;
    }
    
    // Delete PNL rack revenue entries
    await tx.delete(pnlRackRevenue)
      .where(eq(pnlRackRevenue.locationId, locationId));
    
    // Delete move events
    await tx.delete(moveEvents)
      .where(eq(moveEvents.locationId, locationId));
    
    return {
      deletedLeases,
      deletedStorageLocations,
    };
  });
}

// ============================================================================
// CASH FLOW GENERATION
// ============================================================================

/**
 * Generate lease cash flows for a given lease and date range
 * Pro-rates partial months based on days active in the month
 */
export async function generateLeaseCashFlows(
  leaseId: string, 
  startDate: Date, 
  endDate: Date, 
  monthlyRent: number
): Promise<void> {
  // Ensure periods exist
  const allPeriods = await ensurePeriodsBetween(startDate, endDate);
  
  // Generate cash flow for each period with pro-rated amounts
  const cashFlowData = allPeriods.map(period => {
    // Period date is the 1st of the month (e.g., "2025-01-01")
    const periodDate = new Date(period.periodDate + 'T12:00:00');
    const periodYear = periodDate.getFullYear();
    const periodMonth = periodDate.getMonth();
    
    // Calculate the start and end of this month
    const monthStart = new Date(periodYear, periodMonth, 1);
    const monthEnd = new Date(periodYear, periodMonth + 1, 0); // Last day of month
    const totalDaysInMonth = monthEnd.getDate();
    
    // Normalize lease dates (startDate and endDate are already Date objects)
    const leaseStart = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
    const leaseEnd = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
    
    // Calculate the overlap between lease period and this month
    const activeStart = leaseStart > monthStart ? leaseStart : monthStart;
    const activeEnd = leaseEnd < monthEnd ? leaseEnd : monthEnd;
    
    // Check if lease is active in this period at all
    if (activeStart > activeEnd) {
      return {
        leaseId,
        periodId: period.id,
        rentAmount: "0",
        isActiveInPeriod: false,
      };
    }
    
    // Calculate active days (inclusive of both start and end dates)
    const activeDays = Math.floor((activeEnd.getTime() - activeStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    
    // Pro-rate the rent based on days active
    const proRatedRent = (activeDays / totalDaysInMonth) * monthlyRent;
    
    return {
      leaseId,
      periodId: period.id,
      rentAmount: proRatedRent.toFixed(2),
      isActiveInPeriod: activeDays > 0,
    };
  });
  
  if (cashFlowData.length > 0) {
    // Use onConflictDoNothing to handle re-imports gracefully
    await db.insert(leaseCashFlows).values(cashFlowData).onConflictDoNothing();
  }
}

/**
 * Backfill cash flows for existing incomplete leases that have amounts but no commencement dates.
 * Uses Jan 1 - Dec 31 of current year as default date range.
 * Optionally filter by projectId.
 */
export async function backfillCashFlowsForIncompleteLeasesWithAmounts(projectId?: string): Promise<{
  processedCount: number;
  generatedCount: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let generatedCount = 0;
  
  // Find incomplete leases with amounts but no commencement dates
  const conditions = [
    eq(leases.isIncomplete, true),
    isNotNull(leases.leaseAmount),
    isNull(leases.leaseCommencement),
  ];
  
  if (projectId) {
    conditions.push(eq(leases.locationId, projectId));
  }
  
  const incompleteLeasesWithAmounts = await db.query.rraLeases.findMany({
    where: and(...conditions),
    with: { tenant: true },
  });
  
  const { startDate, endDate } = getDefaultCashFlowDateRange();
  
  for (const lease of incompleteLeasesWithAmounts) {
    try {
      // Calculate total monthly rent
      const leaseAmount = parseFloat(lease.leaseAmount || "0");
      const charge1 = parseFloat(lease.additionalCharge1 || "0");
      const charge2 = parseFloat(lease.additionalCharge2 || "0");
      const charge3 = parseFloat(lease.additionalCharge3 || "0");
      const totalMonthlyRent = leaseAmount + charge1 + charge2 + charge3;
      
      if (totalMonthlyRent <= 0) {
        continue; // Skip leases with zero or negative rent
      }
      
      // Delete existing cash flows (in case of re-run)
      await db.delete(leaseCashFlows).where(eq(leaseCashFlows.leaseId, lease.id));
      
      // Generate new cash flows with default dates
      await generateLeaseCashFlows(lease.id, startDate, endDate, totalMonthlyRent);
      
      // Update lease to mark it as using default dates
      await db.update(leases)
        .set({ 
          usesDefaultDates: true,
          numMonths: 12,
          totalContractValue: (totalMonthlyRent * 12).toString(),
          updatedAt: new Date(),
        })
        .where(eq(leases.id, lease.id));
      
      generatedCount++;
    } catch (error: any) {
      errors.push(`Lease ${lease.id} (${lease.tenant?.name || 'Unknown'}): ${error.message}`);
    }
  }
  
  return {
    processedCount: incompleteLeasesWithAmounts.length,
    generatedCount,
    errors,
  };
}

/**
 * Regenerate all cash flows for a project
 * This deletes and recreates cash flow records for all leases in the project
 */
export async function regenerateAllCashFlowsForProject(projectId: string): Promise<{
  processedCount: number;
  generatedCount: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let generatedCount = 0;
  
  // Get all leases for this project with valid dates and amounts
  const projectLeases = await db.query.rraLeases.findMany({
    where: eq(leases.locationId, projectId),
    with: { tenant: true },
  });
  
  for (const lease of projectLeases) {
    try {
      // Calculate base lease amount - must convert from total to monthly for seasonal/annual rates
      const rawLeaseAmount = parseFloat(lease.leaseAmount || "0");
      const baseRent2 = parseFloat(lease.baseRent2 || "0");
      const baseRent3 = parseFloat(lease.baseRent3 || "0");
      
      // Delete existing cash flows for this lease
      await db.delete(leaseCashFlows).where(eq(leaseCashFlows.leaseId, lease.id));
      
      // Determine date range for cash flows
      let startDate: Date;
      let endDate: Date;
      
      if (lease.leaseCommencement && lease.leaseExpiration) {
        // Use actual lease dates
        startDate = new Date(lease.leaseCommencement + 'T12:00:00');
        endDate = new Date(lease.leaseExpiration + 'T12:00:00');
      } else {
        // Use default dates (Jan 1 - Dec 31 of current year)
        const { startDate: defaultStart, endDate: defaultEnd } = getDefaultCashFlowDateRange();
        startDate = defaultStart;
        endDate = defaultEnd;
        
        // Mark as using default dates
        await db.update(leases)
          .set({ usesDefaultDates: true, updatedAt: new Date() })
          .where(eq(leases.id, lease.id));
      }
      
      // Calculate numMonths for pro-rating seasonal rates
      const monthsDiff = (endDate.getFullYear() - startDate.getFullYear()) * 12 + 
                        (endDate.getMonth() - startDate.getMonth()) + 1;
      const numMonths = Math.max(1, monthsDiff);
      
      // For seasonal/annual rate types, leaseAmount is the TOTAL for the period, not monthly
      // Convert to monthly rent for cash flow generation
      let monthlyBaseRent = rawLeaseAmount;
      if (lease.rateType && numMonths > 0) {
        const isSeasonalOrAnnual = lease.rateType.includes('/season') || 
                                    lease.rateType.includes('/yr') ||
                                    lease.rateType.includes('/year');
        if (isSeasonalOrAnnual) {
          monthlyBaseRent = rawLeaseAmount / numMonths;
        }
      }
      
      // Total monthly rent includes additional charges (which are assumed monthly)
      const totalMonthlyRent = monthlyBaseRent + baseRent2 + baseRent3;
      
      if (totalMonthlyRent <= 0) {
        continue; // Skip leases with zero or negative rent
      }
      
      // For seasonal leases, totalContractValue should be the season total (rawLeaseAmount)
      // For monthly leases, totalContractValue = monthly × months
      const isSeasonalOrAnnual = lease.rateType && (
        lease.rateType.includes('/season') || 
        lease.rateType.includes('/yr') ||
        lease.rateType.includes('/year')
      );
      const totalContractValue = isSeasonalOrAnnual 
        ? rawLeaseAmount + (baseRent2 + baseRent3) * numMonths
        : totalMonthlyRent * numMonths;
      
      await db.update(leases)
        .set({
          numMonths,
          totalContractValue: totalContractValue.toString(),
          updatedAt: new Date(),
        })
        .where(eq(leases.id, lease.id));
      
      // Generate new cash flows with correct monthly rent
      await generateLeaseCashFlows(lease.id, startDate, endDate, totalMonthlyRent);
      
      generatedCount++;
    } catch (error: any) {
      errors.push(`Lease ${lease.id} (${lease.tenant?.name || 'Unknown'}): ${error.message}`);
    }
  }
  
  return {
    processedCount: projectLeases.length,
    generatedCount,
    errors,
  };
}

// ============================================================================
// MONTHLY SUMMARY
// ============================================================================

/**
 * Get monthly summary data for rent roll cash flows
 * PHASE 1: Extended with as-of date & YTD support
 */
export async function getMonthlySummary(params?: {
  from?: string;
  to?: string;
  locationId?: string;
} | GetMonthlySummaryOptions): Promise<MonthlySummary[]> {
  // Support both old params (for backward compatibility) and new options
  let from: Date;
  let to: Date;
  let asOfDate: Date | undefined;
  let mode: MonthlySummaryMode | undefined;
  let locationId: string | undefined;
  
  if (params && 'mode' in params) {
    // New options interface
    const options = params as GetMonthlySummaryOptions;
    
    if (options.mode === "YTD") {
      // YTD mode: from Jan 1 of current year through today (or asOfDate if provided)
      const referenceDate = options.asOfDate || new Date();
      from = startOfYear(referenceDate);
      to = referenceDate;
    } else {
      // FULL_PERIOD mode or no mode
      from = options.startDate || new Date(2024, 0, 1);
      to = options.endDate || new Date(2026, 11, 31);
      
      // Cap at asOfDate if provided
      if (options.asOfDate && to > options.asOfDate) {
        to = options.asOfDate;
      }
    }
    
    asOfDate = options.asOfDate;
    mode = options.mode;
    locationId = options.locationId;
  } else {
    // Old params interface (backward compatibility)
    from = params?.from 
      ? parse(params.from, "yyyy-MM", new Date())
      : new Date(2024, 0, 1);
    
    to = params?.to 
      ? parse(params.to, "yyyy-MM", new Date())
      : new Date(2026, 11, 31);
    
    locationId = params?.locationId;
  }
  
  // Get all periods in range, filtered by asOfDate if provided
  let periodWhere = and(
    gte(periods.periodDate, endOfMonth(from).toISOString().split('T')[0]),
    lte(periods.periodDate, endOfMonth(to).toISOString().split('T')[0])
  );
  
  if (asOfDate) {
    periodWhere = and(
      periodWhere,
      lte(periods.periodDate, endOfMonth(asOfDate).toISOString().split('T')[0])
    );
  }
  
  const allPeriods = await db.query.periods.findMany({
    where: periodWhere,
    orderBy: [asc(periods.periodDate)],
  });
  
  const summary: MonthlySummary[] = [];
  let prevRentRollCountByNetMoves = 0;
  
  for (const period of allPeriods) {
    const periodDate = new Date(period.periodDate);
    const periodStart = startOfMonth(periodDate).toISOString().split('T')[0];
    const periodEnd = period.periodDate;
    
    // Total contracted revenue (sum of active lease cash flows)
    // Filter by locationId if provided by joining with leases table
    let cashFlowsQuery = db
      .select({
        total: sql<string>`COALESCE(SUM(${leaseCashFlows.rentAmount}::numeric), 0)`,
        count: sql<number>`COUNT(DISTINCT ${leaseCashFlows.leaseId})`,
      })
      .from(leaseCashFlows);
    
    if (locationId) {
      cashFlowsQuery = cashFlowsQuery.innerJoin(leases, eq(leaseCashFlows.leaseId, leases.id));
    }
    
    const cashFlowConditions = [
      eq(leaseCashFlows.periodId, period.id),
      eq(leaseCashFlows.isActiveInPeriod, true)
    ];
    if (locationId) {
      cashFlowConditions.push(eq(leases.locationId, locationId));
    }
    
    const cashFlowsResult = await cashFlowsQuery.where(and(...cashFlowConditions));
    
    const totalContractedRevenue = cashFlowsResult[0]?.total || "0";
    // Ensure rentRollCount is a number, not a string (SQL may return string)
    const rentRollCount = Number(cashFlowsResult[0]?.count) || 0;
    
    // P&L rack revenue
    const pnlResult = await db.query.pnlRackRevenue.findFirst({
      where: eq(pnlRackRevenue.periodId, period.id),
    });
    const pnlRackRevenueAmount = pnlResult?.amount || null;
    
    // Delta
    const delta = pnlRackRevenueAmount 
      ? (parseFloat(pnlRackRevenueAmount) - parseFloat(totalContractedRevenue)).toString()
      : null;
    
    // Move-ins: count of leases whose leaseCommencement falls within this month
    // Move-outs: count of leases whose leaseExpiration falls within this month
    const moveInConditions = [
      gte(leases.leaseCommencement, periodStart),
      lte(leases.leaseCommencement, periodEnd)
    ];
    if (locationId) {
      moveInConditions.push(eq(leases.locationId, locationId));
    }
    
    const moveIns = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(leases)
      .where(and(...moveInConditions));
    
    const moveOutConditions = [
      isNotNull(leases.leaseExpiration),
      gte(leases.leaseExpiration, periodStart),
      lte(leases.leaseExpiration, periodEnd)
    ];
    if (locationId) {
      moveOutConditions.push(eq(leases.locationId, locationId));
    }
    
    const moveOuts = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(leases)
      .where(and(...moveOutConditions));
    
    // Ensure all counts are numbers, not strings (SQL may return strings)
    const moveInsCount = Number(moveIns[0]?.count) || 0;
    const moveOutsCount = Number(moveOuts[0]?.count) || 0;
    const netMoves = moveInsCount - moveOutsCount;
    
    // Rent roll count by net moves (cumulative)
    if (summary.length === 0) {
      // First period: use actual rent roll count as base
      prevRentRollCountByNetMoves = rentRollCount;
    } else {
      prevRentRollCountByNetMoves = prevRentRollCountByNetMoves + netMoves;
    }
    
    const rentRollCountByNetMoves = prevRentRollCountByNetMoves;
    const discrepancy = rentRollCountByNetMoves - rentRollCount;
    
    summary.push({
      periodId: period.id,
      periodDate: period.periodDate,
      label: period.label,
      year: period.year,
      month: period.month,
      totalContractedRevenue,
      pnlRackRevenue: pnlRackRevenueAmount,
      delta,
      rentRollCount,
      moveIns: moveInsCount,
      moveOuts: moveOutsCount,
      netMoves,
      rentRollCountByNetMoves,
      discrepancy,
    });
  }
  
  return summary;
}

// ============================================================================
// P&L RACK REVENUE
// ============================================================================

/**
 * Upsert P&L rack revenue for multiple periods
 */
export async function upsertPnlRackRevenue(data: Array<{ periodDate: string; amount: number }>): Promise<void> {
  for (const item of data) {
    const period = await getOrCreatePeriod(new Date(item.periodDate));
    
    const existing = await db.query.pnlRackRevenue.findFirst({
      where: eq(pnlRackRevenue.periodId, period.id),
    });
    
    if (existing) {
      await db.update(pnlRackRevenue)
        .set({ amount: item.amount.toString() })
        .where(eq(pnlRackRevenue.periodId, period.id));
    } else {
      await db.insert(pnlRackRevenue).values({
        periodId: period.id,
        amount: item.amount.toString(),
      });
    }
  }
}

// ============================================================================
// MOVE EVENTS
// ============================================================================

/**
 * Create a move event
 */
export async function createMoveEvent(data: {
  direction: "IN" | "OUT";
  customerName?: string;
  checkedAt?: string;
  eventDate?: string;
  leaseId?: string;
  locationId?: string;
  orgId?: string;
  reason?: string;
  notes?: string;
  vesselLoa?: number;
  subtotal?: number;
  sourceSheet?: string;
}): Promise<MoveEvent> {
  const dateStr = data.eventDate || data.checkedAt || new Date().toISOString().split('T')[0];

  const [event] = await db.insert(moveEvents).values({
    direction: data.direction,
    eventDate: dateStr,
    leaseId: data.leaseId || "unknown",
    locationId: data.locationId || null,
    orgId: data.orgId || "org-1",
    reason: data.reason || (data.customerName ? `Move ${data.direction.toLowerCase()} - ${data.customerName}` : undefined),
    notes: data.notes || (data.sourceSheet ? `Source: ${data.sourceSheet}` : undefined),
  }).returning();

  return event;
}

/**
 * Get all move events with filters
 */
export interface MoveEventsSummary {
  totalMoveIns: number;
  totalMoveOuts: number;
  netChange: number;
  avgVesselSize: number | null;
  totalRevenue: number;
}

export async function getAllMoveEvents(filters?: {
  direction?: "IN" | "OUT";
  year?: number;
  locationId?: string;
  page?: number;
  pageSize?: number;
}): Promise<{ events: MoveEvent[]; total: number; summary: MoveEventsSummary }> {
  const conditions = [];

  if (filters?.direction) {
    conditions.push(eq(moveEvents.direction, filters.direction));
  }

  if (filters?.year) {
    conditions.push(sql`EXTRACT(YEAR FROM ${moveEvents.eventDate}::date) = ${filters.year}`);
  }

  if (filters?.locationId) {
    conditions.push(eq(moveEvents.locationId, filters.locationId));
  }

  const allEvents = await db
    .select()
    .from(moveEvents)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(moveEvents.eventDate));

  const page = filters?.page || 1;
  const pageSize = filters?.pageSize || 50;
  const start = (page - 1) * pageSize;
  const end = start + pageSize;

  // Calculate summary stats from all events (not just paginated)
  const totalMoveIns = allEvents.filter(e => e.direction === "IN").length;
  const totalMoveOuts = allEvents.filter(e => e.direction === "OUT").length;
  const netChange = totalMoveIns - totalMoveOuts;

  const avgVesselSize = null;
  const totalRevenue = 0;
  
  return {
    events: allEvents.slice(start, end),
    total: allEvents.length,
    summary: {
      totalMoveIns,
      totalMoveOuts,
      netChange,
      avgVesselSize,
      totalRevenue,
    },
  };
}

// ============================================================================
// ADDRESS HEAT MAP
// ============================================================================

/**
 * Get address heat map data grouped by state or city
 */
export async function getAddressHeatMap(
  groupBy: "state" | "city",
  locationId?: string
): Promise<Array<{ label: string; count: number }>> {
  const field = groupBy === "state" ? tenants.state : tenants.city;
  
  // If locationId is provided, filter by tenants with leases in that location
  if (locationId) {
    const results = await db
      .select({
        label: field,
        count: sql<number>`COUNT(DISTINCT ${tenants.id})`,
      })
      .from(tenants)
      .innerJoin(leases, eq(leases.tenantId, tenants.id))
      .where(
        and(
          eq(leases.locationId, locationId),
          sql`${field} IS NOT NULL AND ${field} != ''`
        )
      )
      .groupBy(field)
      .orderBy(desc(sql`COUNT(DISTINCT ${tenants.id})`));
    
    return results.map(r => ({
      label: r.label || "Unknown",
      count: r.count,
    }));
  }
  
  // No location filter - show all tenants
  const results = await db
    .select({
      label: field,
      count: sql<number>`COUNT(*)`,
    })
    .from(tenants)
    .where(sql`${field} IS NOT NULL AND ${field} != ''`)
    .groupBy(field)
    .orderBy(desc(sql`COUNT(*)`));
  
  return results.map(r => ({
    label: r.label || "Unknown",
    count: r.count,
  }));
}

// ============================================================================
// REVENUE BY STORAGE TYPE
// ============================================================================

export interface RevenueByStorageType {
  storageType: string;
  totalRevenue: string;
  leaseCount: number;
}

/**
 * Get revenue breakdown by storage type for a date range
 */
export async function getRevenueByStorageType(
  startDate: string,
  endDate: string,
  locationId?: string,
  filterOptions?: KpiFilterOptions
): Promise<RevenueByStorageType[]> {
  const whereConditions = [
    gte(periods.periodDate, startDate),
    lte(periods.periodDate, endDate)
  ];

  if (locationId) {
    whereConditions.push(eq(leases.locationId, locationId));
  } else {
    // Build project filter conditions including organization scoping for executive dashboard
    const projectFilter = buildProjectFilterConditions(marinaLocations, filterOptions);
    whereConditions.push(projectFilter);
  }

  // Use COALESCE(unitTypeCustom, storageType) so non-marina asset classes group by their custom unit type
  const unitTypeExpr = sql<string>`COALESCE(${leases.unitTypeCustom}, ${leases.storageType}::text)`;

  const results = await db
    .select({
      storageType: unitTypeExpr,
      totalRevenue: sql<string>`COALESCE(SUM(${leaseCashFlows.rentAmount}), 0)`,
      leaseCount: sql<number>`COUNT(DISTINCT ${leases.id})`,
    })
    .from(leaseCashFlows)
    .innerJoin(leases, eq(leaseCashFlows.leaseId, leases.id))
    .innerJoin(marinaLocations, eq(leases.locationId, marinaLocations.id))
    .innerJoin(periods, eq(leaseCashFlows.periodId, periods.id))
    .where(and(...whereConditions))
    .groupBy(unitTypeExpr)
    .orderBy(desc(sql`SUM(${leaseCashFlows.rentAmount})`));

  // Calculate total revenue for percentage calculation
  const total = results.reduce((sum, r) => sum + parseFloat(r.totalRevenue || "0"), 0);

  return results.map(r => {
    const revenue = parseFloat(r.totalRevenue || "0");
    return {
      storageType: r.storageType || "Unknown",
      totalRevenue: r.totalRevenue || "0",
      leaseCount: r.leaseCount || 0,
      percentage: total > 0 ? (revenue / total) * 100 : 0,
    };
  });
}

// ============================================================================
// EXECUTIVE DASHBOARD METRICS
// ============================================================================

export interface ExecutiveDashboardMetrics {
  totalRevenue: string;
  totalStorageRevenue: string;
  activeLeases: number;
  totalLeases: number;
  occupancyRate: number;
  averageLeaseValue: string;
  totalMoveIns: number;
  totalMoveOuts: number;
  netMoveChange: number;
}

export interface KpiFilterOptions {
  projectIds?: string[];
  projectType?: "OWNED" | "DEAL" | "ALL";
  organizationIds?: string[];
  // Unified KPI filter parameters
  seasonMode?: "overall" | "annual" | "seasonal" | "winter" | "shortTerm";
  storageType?: string; // "all" or specific storage type name
}

/**
 * Build project filter conditions for executive dashboard queries
 */
function buildProjectFilterConditions(
  locationTableRef: typeof marinaLocations,
  options?: KpiFilterOptions
) {
  const conditions: any[] = [eq(locationTableRef.includeInExecutive, true)];
  
  // Organization scoping - essential for multi-tenant security
  if (options?.organizationIds && options.organizationIds.length > 0) {
    conditions.push(inArray(locationTableRef.organizationId, options.organizationIds));
  }
  
  if (options?.projectIds && options.projectIds.length > 0) {
    conditions.push(inArray(locationTableRef.id, options.projectIds));
  }
  
  if (options?.projectType && options.projectType !== "ALL") {
    conditions.push(eq(locationTableRef.projectType, options.projectType));
  }
  
  return and(...conditions);
}

/**
 * Build contract term filter condition based on seasonMode.
 * Maps UI seasonMode values to the actual contract terms in the database.
 * 
 * Business logic:
 * - "overall": Show ALL leases (no filter)
 * - "annual": Show ONLY Annual leases
 * - "seasonal": Show Seasonal + Annual + Short-term (all leases generating summer revenue)
 * - "winter": Show Winter + Annual + Short-term (all leases generating winter revenue)
 * - "shortTerm": Show ONLY short-term leases
 */
function buildContractTermCondition(
  leaseTableRef: typeof leases,
  seasonMode?: string
): ReturnType<typeof eq> | null {
  if (!seasonMode || seasonMode === "overall") {
    return null; // No filter for overall mode
  }
  
  // Term mappings - Seasonal and Winter include Annual + short-term since those generate revenue in all periods
  const termMappings: Record<string, string[]> = {
    "annual": ["Annual"],
    "seasonal": ["Seasonal/Summer", "6-Months", "3-Months", "Annual", "Monthly", "Weekly", "Daily/Nightly"],
    "winter": ["Winter", "Annual", "Monthly", "Weekly", "Daily/Nightly"],
    "shortTerm": ["Monthly", "Weekly", "Daily/Nightly"],
  };
  
  const terms = termMappings[seasonMode];
  if (!terms || terms.length === 0) {
    return null;
  }
  
  return inArray(leaseTableRef.contractTerm, terms);
}

/**
 * Build storage type filter condition.
 * Requires joining with storageLocations table.
 */
function buildStorageTypeCondition(
  storageLocationTableRef: typeof storageLocations,
  storageType?: string
): ReturnType<typeof eq> | null {
  if (!storageType || storageType === "all") {
    return null; // No filter for all types
  }
  
  return eq(storageLocationTableRef.storageType, storageType);
}

/**
 * Get executive dashboard KPIs for a date range
 */
export async function getExecutiveDashboardMetrics(
  orgId: string,
  startDate: string,
  endDate: string,
  filterOptions?: KpiFilterOptions
): Promise<ExecutiveDashboardMetrics> {
  // Build filter with orgId for tenant isolation
  const baseFilterCondition = buildProjectFilterConditions(marinaLocations, filterOptions);
  const filterCondition = and(
    eq(marinaLocations.orgId, orgId),
    baseFilterCondition || sql`1=1`
  );
  const contractTermCondition = buildContractTermCondition(leases, filterOptions?.seasonMode);
  const storageTypeCondition = buildStorageTypeCondition(storageLocations, filterOptions?.storageType);
  
  // Parse date range into year/month bounds for RRA schema filtering
  const startDateObj = new Date(startDate);
  const endDateObj = new Date(endDate);
  const startYear = startDateObj.getFullYear();
  const startMonth = startDateObj.getMonth() + 1; // 1-indexed
  const endYear = endDateObj.getFullYear();
  const endMonth = endDateObj.getMonth() + 1;
  
  // Build year/month range condition for cash flows
  const buildYearMonthCondition = () => {
    return sql`(
      (${leaseCashFlows.year} > ${startYear} OR (${leaseCashFlows.year} = ${startYear} AND ${leaseCashFlows.month} >= ${startMonth}))
      AND
      (${leaseCashFlows.year} < ${endYear} OR (${leaseCashFlows.year} = ${endYear} AND ${leaseCashFlows.month} <= ${endMonth}))
    )`;
  };
  
  // Build combined filter conditions
  const buildLeaseConditions = (...additionalConditions: (ReturnType<typeof eq> | null)[]) => {
    const conditions = [filterCondition];
    if (contractTermCondition) conditions.push(contractTermCondition);
    additionalConditions.forEach(c => { if (c) conditions.push(c); });
    return and(...conditions);
  };
  
  // When storageType filter is specified, we need to join with storageLocations
  const hasStorageTypeFilter = filterOptions?.storageType && filterOptions.storageType !== "all";
  
  const [revenueData, leaseData, moveEventData, capacityData, storageRevenueData] = await Promise.all([
    // Revenue query - uses year/month columns directly (RRA schema)
    hasStorageTypeFilter
      ? db
          .select({
            totalRevenue: sql<string>`COALESCE(SUM(${leaseCashFlows.amount}), 0)`,
          })
          .from(leaseCashFlows)
          .innerJoin(leases, eq(leaseCashFlows.leaseId, leases.id))
          .innerJoin(marinaLocations, eq(leases.locationId, marinaLocations.id))
          .innerJoin(storageLocations, eq(leases.storageLocationId, storageLocations.id))
          .where(
            and(
              buildYearMonthCondition(),
              filterCondition,
              contractTermCondition,
              storageTypeCondition
            )
          )
      : db
          .select({
            totalRevenue: sql<string>`COALESCE(SUM(${leaseCashFlows.amount}), 0)`,
          })
          .from(leaseCashFlows)
          .innerJoin(leases, eq(leaseCashFlows.leaseId, leases.id))
          .innerJoin(marinaLocations, eq(leases.locationId, marinaLocations.id))
          .where(
            and(
              buildYearMonthCondition(),
              buildLeaseConditions()
            )
          ),
    
    // Lease count query - count leases active DURING the selected period
    // Both totalLeases and activeLeases are filtered by the period
    // A lease is active during a period if:
    // - isActive = true (database flag)
    // - It started (leaseCommencement) on or before the end of the period
    // - It has not expired (leaseExpiration is NULL or >= start of the period)
    // activeLeases additionally excludes certain slipStatus values
    hasStorageTypeFilter
      ? db
          .select({
            totalLeases: sql<number>`CAST(COUNT(*) AS INTEGER)`,
            activeLeases: sql<number>`CAST(COALESCE(SUM(CASE 
              WHEN (${leases.slipStatus} IS NULL OR ${leases.slipStatus} NOT IN ('Vacant', 'Unusable', 'Occupied; Not-Paying'))
              THEN 1 ELSE 0 END), 0) AS INTEGER)`,
          })
          .from(leases)
          .innerJoin(marinaLocations, eq(leases.locationId, marinaLocations.id))
          .innerJoin(storageLocations, eq(leases.storageLocationId, storageLocations.id))
          .where(
            and(
              filterCondition,
              eq(leases.isActive, true),
              contractTermCondition,
              storageTypeCondition,
              sql`(${leases.leaseCommencement} IS NULL OR ${leases.leaseCommencement} <= ${endDate})`,
              sql`(${leases.leaseExpiration} IS NULL OR ${leases.leaseExpiration} >= ${startDate})`
            )
          )
      : db
          .select({
            totalLeases: sql<number>`CAST(COUNT(*) AS INTEGER)`,
            activeLeases: sql<number>`CAST(COALESCE(SUM(CASE 
              WHEN (${leases.slipStatus} IS NULL OR ${leases.slipStatus} NOT IN ('Vacant', 'Unusable', 'Occupied; Not-Paying'))
              THEN 1 ELSE 0 END), 0) AS INTEGER)`,
          })
          .from(leases)
          .innerJoin(marinaLocations, eq(leases.locationId, marinaLocations.id))
          .where(
            and(
              buildLeaseConditions(),
              eq(leases.isActive, true),
              sql`(${leases.leaseCommencement} IS NULL OR ${leases.leaseCommencement} <= ${endDate})`,
              sql`(${leases.leaseExpiration} IS NULL OR ${leases.leaseExpiration} >= ${startDate})`
            )
          ),
    
    // Move events query
    hasStorageTypeFilter
      ? db
          .select({
            moveIns: sql<number>`CAST(COUNT(CASE WHEN ${leases.leaseCommencement} >= ${startDate} AND ${leases.leaseCommencement} <= ${endDate} THEN 1 END) AS INTEGER)`,
            moveOuts: sql<number>`CAST(COUNT(CASE WHEN ${leases.leaseExpiration} >= ${startDate} AND ${leases.leaseExpiration} <= ${endDate} AND ${leases.leaseExpiration} IS NOT NULL THEN 1 END) AS INTEGER)`,
          })
          .from(leases)
          .innerJoin(marinaLocations, eq(leases.locationId, marinaLocations.id))
          .innerJoin(storageLocations, eq(leases.storageLocationId, storageLocations.id))
          .where(and(filterCondition, contractTermCondition, storageTypeCondition))
      : db
          .select({
            moveIns: sql<number>`CAST(COUNT(CASE WHEN ${leases.leaseCommencement} >= ${startDate} AND ${leases.leaseCommencement} <= ${endDate} THEN 1 END) AS INTEGER)`,
            moveOuts: sql<number>`CAST(COUNT(CASE WHEN ${leases.leaseExpiration} >= ${startDate} AND ${leases.leaseExpiration} <= ${endDate} AND ${leases.leaseExpiration} IS NOT NULL THEN 1 END) AS INTEGER)`,
          })
          .from(leases)
          .innerJoin(marinaLocations, eq(leases.locationId, marinaLocations.id))
          .where(buildLeaseConditions()),
    
    // Capacity query - filter by storage type when specified
    hasStorageTypeFilter
      ? db
          .select({
            totalCapacity: sql<number>`COALESCE(SUM(${storageLocations.capacity}), 0)`,
          })
          .from(storageLocations)
          .innerJoin(marinaLocations, eq(storageLocations.projectId, marinaLocations.id))
          .where(
            and(
              filterCondition,
              eq(storageLocations.isActive, true),
              storageTypeCondition
            )
          )
      : db
          .select({
            totalCapacity: sql<number>`COALESCE(SUM(${storageLocations.capacity}), 0)`,
          })
          .from(storageLocations)
          .innerJoin(marinaLocations, eq(storageLocations.projectId, marinaLocations.id))
          .where(
            and(
              filterCondition,
              eq(storageLocations.isActive, true)
            )
          ),
    
    // Storage revenue query - only include leases active DURING the selected period
    // A lease is active during a period if:
    // - isActive = true (database flag)
    // - It started (leaseCommencement) on or before the end of the period
    // - It has not expired (leaseExpiration is NULL or >= start of the period)
    hasStorageTypeFilter
      ? db
          .select({
            leaseAmount: leases.leaseAmount,
            rateType: leases.rateType,
            numMonths: leases.numMonths,
            contractTerm: leases.contractTerm,
            leaseCommencement: leases.leaseCommencement,
            leaseExpiration: leases.leaseExpiration,
          })
          .from(leases)
          .innerJoin(marinaLocations, eq(leases.locationId, marinaLocations.id))
          .innerJoin(storageLocations, eq(leases.storageLocationId, storageLocations.id))
          .where(
            and(
              filterCondition,
              eq(leases.isActive, true),
              contractTermCondition,
              storageTypeCondition,
              sql`(${leases.leaseCommencement} IS NULL OR ${leases.leaseCommencement} <= ${endDate})`,
              sql`(${leases.leaseExpiration} IS NULL OR ${leases.leaseExpiration} >= ${startDate})`
            )
          )
      : db
          .select({
            leaseAmount: leases.leaseAmount,
            rateType: leases.rateType,
            numMonths: leases.numMonths,
            contractTerm: leases.contractTerm,
            leaseCommencement: leases.leaseCommencement,
            leaseExpiration: leases.leaseExpiration,
          })
          .from(leases)
          .innerJoin(marinaLocations, eq(leases.locationId, marinaLocations.id))
          .where(
            and(
              buildLeaseConditions(),
              eq(leases.isActive, true),
              sql`(${leases.leaseCommencement} IS NULL OR ${leases.leaseCommencement} <= ${endDate})`,
              sql`(${leases.leaseExpiration} IS NULL OR ${leases.leaseExpiration} >= ${startDate})`
            )
          ),
  ]);

  const totalRevenue = revenueData[0]?.totalRevenue || "0";
  const totalLeases = leaseData[0]?.totalLeases || 0;
  const activeLeases = leaseData[0]?.activeLeases || 0;
  const moveIns = moveEventData[0]?.moveIns || 0;
  const moveOuts = moveEventData[0]?.moveOuts || 0;
  const totalCapacity = capacityData[0]?.totalCapacity || 0;

  // Calculate Total Storage Revenue using rate type semantics
  // Mirrors frontend calculateTotalValue() and calculateEffectiveNumMonths() logic
  const isAnnualContract = (contractTerm: string | null): boolean => {
    if (!contractTerm) return false;
    const term = contractTerm.toLowerCase();
    return term === 'annual' || term === 'yearly' || term === '12 month' || term === '12 months';
  };
  
  const calculateEffectiveNumMonths = (
    contractTerm: string | null,
    numMonths: number | null,
    leaseCommencement: string | null,
    leaseExpiration: string | null
  ): number => {
    if (isAnnualContract(contractTerm)) {
      return 12;
    }
    if (numMonths && numMonths > 0) {
      return numMonths;
    }
    if (leaseCommencement && leaseExpiration) {
      const start = new Date(leaseCommencement);
      const end = new Date(leaseExpiration);
      const yearDiff = end.getFullYear() - start.getFullYear();
      const monthDiff = end.getMonth() - start.getMonth();
      let months = yearDiff * 12 + monthDiff;
      if (end.getDate() >= start.getDate()) {
        months += 1;
      }
      return Math.max(1, months);
    }
    const term = (contractTerm || '').toLowerCase();
    if (term.includes('summer') || term.includes('winter') || term.includes('seasonal')) {
      return 6;
    }
    // Default to 12 months (annual) when no date or term information is available
    // This ensures leases with valid monthly rates still contribute to revenue
    return 12;
  };
  
  const isSeasonalOrAnnualRateType = (rateType: string | null | undefined): boolean => {
    if (!rateType) return false;
    const rt = rateType.toLowerCase();
    return rt.includes('/season') || rt.includes('/yr') || rt.includes('/year') || 
           rt.includes('per season') || rt.includes('per year') || rt === 'annual' ||
           rt.includes('$/ft/season') || rt.includes('$/ft/yr');
  };
  
  let totalStorageRevenueNum = 0;
  for (const lease of storageRevenueData) {
    const baseRent = lease.leaseAmount ? parseFloat(lease.leaseAmount) : 0;
    
    if (isSeasonalOrAnnualRateType(lease.rateType)) {
      totalStorageRevenueNum += baseRent;
    } else {
      const effectiveMonths = calculateEffectiveNumMonths(
        lease.contractTerm,
        lease.numMonths,
        lease.leaseCommencement,
        lease.leaseExpiration
      );
      totalStorageRevenueNum += baseRent * effectiveMonths;
    }
  }

  // Occupancy Rate = Active Leases / Total Leasable Spaces (from storage locations capacity)
  // Fallback to totalLeases when storage location capacity isn't configured
  const denominator = totalCapacity > 0 ? totalCapacity : totalLeases;
  const occupancyRate = denominator > 0 ? (activeLeases / denominator) * 100 : 0;
  // Average Lease Value = Sum of individual lease values / Count of active leases
  // Uses the same rate type semantics as totalStorageRevenue for proper weighted average
  const activeLeaseCount = storageRevenueData.length;
  const averageLeaseValue = activeLeaseCount > 0 
    ? (totalStorageRevenueNum / activeLeaseCount).toFixed(2)
    : "0";

  return {
    totalRevenue,
    totalStorageRevenue: totalStorageRevenueNum.toFixed(2),
    activeLeases,
    totalLeases,
    occupancyRate: Math.round(occupancyRate * 10) / 10,
    averageLeaseValue,
    totalMoveIns: moveIns,
    totalMoveOuts: moveOuts,
    netMoveChange: moveIns - moveOuts,
  };
}

// ============================================================================
// KPI MODAL DETAIL ENDPOINTS
// ============================================================================

export interface ProjectLeases {
  projectId: string;
  projectName: string;
  projectType: "OWNED" | "DEAL";
  activeLeases: number;
  totalLeases: number;
  vacantSlips: number;
  unusableSlips: number;
  notPayingSlips: number;
}

export interface ProjectRevenue {
  projectId: string;
  projectName: string;
  projectType: "OWNED" | "DEAL";
  revenue: string;
  leaseCount: number;
  percentage: number;
}

export interface MonthlyRevenue {
  month: string;
  revenue: string;
  leaseCount: number;
}

export interface StorageTypeRevenue {
  storageType: string;
  revenue: string;
  leaseCount: number;
  percentage: number;
}

/**
 * Get active leases breakdown by project for Active Leases Modal
 */
export async function getExecutiveLeasesByProject(
  orgId: string,
  startDate: string,
  endDate: string,
  filterOptions?: KpiFilterOptions & { storageTypes?: string[] }
): Promise<ProjectLeases[]> {
  const baseFilterCondition = buildProjectFilterConditions(marinaLocations, filterOptions);
  const filterCondition = and(
    eq(marinaLocations.orgId, orgId),
    baseFilterCondition || sql`1=1`
  );
  
  const hasStorageTypeFilter = filterOptions?.storageTypes && filterOptions.storageTypes.length > 0;
  
  const query = hasStorageTypeFilter
    ? db
        .select({
          projectId: marinaLocations.id,
          projectName: marinaLocations.name,
          projectType: marinaLocations.projectType,
          totalLeases: sql<number>`CAST(COUNT(*) AS INTEGER)`,
          activeLeases: sql<number>`CAST(COALESCE(SUM(CASE 
            WHEN (${leases.slipStatus} IS NULL OR ${leases.slipStatus} NOT IN ('Vacant', 'Unusable', 'Occupied; Not-Paying'))
            THEN 1 ELSE 0 END), 0) AS INTEGER)`,
          vacantSlips: sql<number>`CAST(COALESCE(SUM(CASE WHEN ${leases.slipStatus} = 'Vacant' THEN 1 ELSE 0 END), 0) AS INTEGER)`,
          unusableSlips: sql<number>`CAST(COALESCE(SUM(CASE WHEN ${leases.slipStatus} = 'Unusable' THEN 1 ELSE 0 END), 0) AS INTEGER)`,
          notPayingSlips: sql<number>`CAST(COALESCE(SUM(CASE WHEN ${leases.slipStatus} = 'Occupied; Not-Paying' THEN 1 ELSE 0 END), 0) AS INTEGER)`,
        })
        .from(leases)
        .innerJoin(marinaLocations, eq(leases.locationId, marinaLocations.id))
        .innerJoin(storageLocations, eq(leases.storageLocationId, storageLocations.id))
        .where(
          and(
            filterCondition,
            eq(leases.isActive, true),
            sql`(${leases.leaseCommencement} IS NULL OR ${leases.leaseCommencement} <= ${endDate})`,
            sql`(${leases.leaseExpiration} IS NULL OR ${leases.leaseExpiration} >= ${startDate})`,
            inArray(storageLocations.storageType, filterOptions.storageTypes!)
          )
        )
        .groupBy(marinaLocations.id, marinaLocations.name, marinaLocations.projectType)
    : db
        .select({
          projectId: marinaLocations.id,
          projectName: marinaLocations.name,
          projectType: marinaLocations.projectType,
          totalLeases: sql<number>`CAST(COUNT(*) AS INTEGER)`,
          activeLeases: sql<number>`CAST(COALESCE(SUM(CASE 
            WHEN (${leases.slipStatus} IS NULL OR ${leases.slipStatus} NOT IN ('Vacant', 'Unusable', 'Occupied; Not-Paying'))
            THEN 1 ELSE 0 END), 0) AS INTEGER)`,
          vacantSlips: sql<number>`CAST(COALESCE(SUM(CASE WHEN ${leases.slipStatus} = 'Vacant' THEN 1 ELSE 0 END), 0) AS INTEGER)`,
          unusableSlips: sql<number>`CAST(COALESCE(SUM(CASE WHEN ${leases.slipStatus} = 'Unusable' THEN 1 ELSE 0 END), 0) AS INTEGER)`,
          notPayingSlips: sql<number>`CAST(COALESCE(SUM(CASE WHEN ${leases.slipStatus} = 'Occupied; Not-Paying' THEN 1 ELSE 0 END), 0) AS INTEGER)`,
        })
        .from(leases)
        .innerJoin(marinaLocations, eq(leases.locationId, marinaLocations.id))
        .where(
          and(
            filterCondition,
            eq(leases.isActive, true),
            sql`(${leases.leaseCommencement} IS NULL OR ${leases.leaseCommencement} <= ${endDate})`,
            sql`(${leases.leaseExpiration} IS NULL OR ${leases.leaseExpiration} >= ${startDate})`
          )
        )
        .groupBy(marinaLocations.id, marinaLocations.name, marinaLocations.projectType);

  const results = await query;

  return results.map(r => ({
    projectId: r.projectId,
    projectName: r.projectName || "Unknown",
    projectType: r.projectType as "OWNED" | "DEAL",
    activeLeases: r.activeLeases,
    totalLeases: r.totalLeases,
    vacantSlips: r.vacantSlips,
    unusableSlips: r.unusableSlips,
    notPayingSlips: r.notPayingSlips,
  }));
}

/**
 * Get revenue breakdown by project for Total Revenue Modal
 */
export async function getExecutiveRevenueByProject(
  orgId: string,
  startDate: string,
  endDate: string,
  filterOptions?: KpiFilterOptions & { storageTypes?: string[] }
): Promise<ProjectRevenue[]> {
  const baseFilterCondition = buildProjectFilterConditions(marinaLocations, filterOptions);
  const filterCondition = and(
    eq(marinaLocations.orgId, orgId),
    baseFilterCondition || sql`1=1`
  );
  
  const hasStorageTypeFilter = filterOptions?.storageTypes && filterOptions.storageTypes.length > 0;
  
  const query = hasStorageTypeFilter
    ? db
        .select({
          projectId: marinaLocations.id,
          projectName: marinaLocations.name,
          projectType: marinaLocations.projectType,
          leaseAmount: leases.leaseAmount,
          rateType: leases.rateType,
          numMonths: leases.numMonths,
          contractTerm: leases.contractTerm,
          leaseCommencement: leases.leaseCommencement,
          leaseExpiration: leases.leaseExpiration,
        })
        .from(leases)
        .innerJoin(marinaLocations, eq(leases.locationId, marinaLocations.id))
        .innerJoin(storageLocations, eq(leases.storageLocationId, storageLocations.id))
        .where(
          and(
            filterCondition,
            eq(leases.isActive, true),
            sql`(${leases.leaseCommencement} IS NULL OR ${leases.leaseCommencement} <= ${endDate})`,
            sql`(${leases.leaseExpiration} IS NULL OR ${leases.leaseExpiration} >= ${startDate})`,
            inArray(storageLocations.storageType, filterOptions.storageTypes!)
          )
        )
    : db
        .select({
          projectId: marinaLocations.id,
          projectName: marinaLocations.name,
          projectType: marinaLocations.projectType,
          leaseAmount: leases.leaseAmount,
          rateType: leases.rateType,
          numMonths: leases.numMonths,
          contractTerm: leases.contractTerm,
          leaseCommencement: leases.leaseCommencement,
          leaseExpiration: leases.leaseExpiration,
        })
        .from(leases)
        .innerJoin(marinaLocations, eq(leases.locationId, marinaLocations.id))
        .where(
          and(
            filterCondition,
            eq(leases.isActive, true),
            sql`(${leases.leaseCommencement} IS NULL OR ${leases.leaseCommencement} <= ${endDate})`,
            sql`(${leases.leaseExpiration} IS NULL OR ${leases.leaseExpiration} >= ${startDate})`
          )
        );

  const leaseData = await query;

  const isAnnualContract = (contractTerm: string | null): boolean => {
    if (!contractTerm) return false;
    const term = contractTerm.toLowerCase();
    return term === 'annual' || term === 'yearly' || term === '12 month' || term === '12 months';
  };
  
  const calculateEffectiveNumMonths = (
    contractTerm: string | null,
    numMonths: number | null,
    leaseCommencement: string | null,
    leaseExpiration: string | null
  ): number => {
    if (isAnnualContract(contractTerm)) return 12;
    if (numMonths && numMonths > 0) return numMonths;
    if (leaseCommencement && leaseExpiration) {
      const start = new Date(leaseCommencement);
      const end = new Date(leaseExpiration);
      const yearDiff = end.getFullYear() - start.getFullYear();
      const monthDiff = end.getMonth() - start.getMonth();
      let months = yearDiff * 12 + monthDiff;
      if (end.getDate() >= start.getDate()) months += 1;
      return Math.max(1, months);
    }
    const term = (contractTerm || '').toLowerCase();
    if (term.includes('summer') || term.includes('winter') || term.includes('seasonal')) return 6;
    return 12;
  };
  
  const isSeasonalOrAnnualRateType = (rateType: string | null | undefined): boolean => {
    if (!rateType) return false;
    const rt = rateType.toLowerCase();
    return rt.includes('/season') || rt.includes('/yr') || rt.includes('/year') || 
           rt.includes('per season') || rt.includes('per year') || rt === 'annual' ||
           rt.includes('$/ft/season') || rt.includes('$/ft/yr');
  };

  const projectRevenueMap = new Map<string, { name: string; type: string; revenue: number; count: number }>();
  
  for (const lease of leaseData) {
    const baseRent = lease.leaseAmount ? parseFloat(String(lease.leaseAmount)) : 0;
    let leaseRevenue = 0;
    
    if (isSeasonalOrAnnualRateType(lease.rateType)) {
      leaseRevenue = baseRent;
    } else {
      const effectiveMonths = calculateEffectiveNumMonths(
        lease.contractTerm,
        lease.numMonths,
        lease.leaseCommencement,
        lease.leaseExpiration
      );
      leaseRevenue = baseRent * effectiveMonths;
    }
    
    const existing = projectRevenueMap.get(lease.projectId);
    if (existing) {
      existing.revenue += leaseRevenue;
      existing.count += 1;
    } else {
      projectRevenueMap.set(lease.projectId, {
        name: lease.projectName || "Unknown",
        type: lease.projectType || "OWNED",
        revenue: leaseRevenue,
        count: 1,
      });
    }
  }

  const totalRevenue = Array.from(projectRevenueMap.values()).reduce((sum, p) => sum + p.revenue, 0);

  return Array.from(projectRevenueMap.entries()).map(([id, data]) => ({
    projectId: id,
    projectName: data.name,
    projectType: data.type as "OWNED" | "DEAL",
    revenue: data.revenue.toFixed(2),
    leaseCount: data.count,
    percentage: totalRevenue > 0 ? (data.revenue / totalRevenue) * 100 : 0,
  })).sort((a, b) => parseFloat(b.revenue) - parseFloat(a.revenue));
}

/**
 * Get monthly revenue breakdown for Total Revenue Modal
 * Correctly distributes annual/seasonal rates across months
 */
export async function getExecutiveRevenueByMonth(
  orgId: string,
  startDate: string,
  endDate: string,
  filterOptions?: KpiFilterOptions & { storageTypes?: string[] }
): Promise<MonthlyRevenue[]> {
  const baseFilterCondition = buildProjectFilterConditions(marinaLocations, filterOptions);
  const filterCondition = and(
    eq(marinaLocations.orgId, orgId),
    baseFilterCondition || sql`1=1`
  );
  
  const hasStorageTypeFilter = filterOptions?.storageTypes && filterOptions.storageTypes.length > 0;
  
  const query = hasStorageTypeFilter
    ? db
        .select({
          leaseAmount: leases.leaseAmount,
          rateType: leases.rateType,
          numMonths: leases.numMonths,
          contractTerm: leases.contractTerm,
          leaseCommencement: leases.leaseCommencement,
          leaseExpiration: leases.leaseExpiration,
        })
        .from(leases)
        .innerJoin(marinaLocations, eq(leases.locationId, marinaLocations.id))
        .innerJoin(storageLocations, eq(leases.storageLocationId, storageLocations.id))
        .where(
          and(
            filterCondition,
            eq(leases.isActive, true),
            sql`(${leases.leaseCommencement} IS NULL OR ${leases.leaseCommencement} <= ${endDate})`,
            sql`(${leases.leaseExpiration} IS NULL OR ${leases.leaseExpiration} >= ${startDate})`,
            inArray(storageLocations.storageType, filterOptions.storageTypes!)
          )
        )
    : db
        .select({
          leaseAmount: leases.leaseAmount,
          rateType: leases.rateType,
          numMonths: leases.numMonths,
          contractTerm: leases.contractTerm,
          leaseCommencement: leases.leaseCommencement,
          leaseExpiration: leases.leaseExpiration,
        })
        .from(leases)
        .innerJoin(marinaLocations, eq(leases.locationId, marinaLocations.id))
        .where(
          and(
            filterCondition,
            eq(leases.isActive, true),
            sql`(${leases.leaseCommencement} IS NULL OR ${leases.leaseCommencement} <= ${endDate})`,
            sql`(${leases.leaseExpiration} IS NULL OR ${leases.leaseExpiration} >= ${startDate})`
          )
        );

  const leaseData = await query;
  
  const isSeasonalOrAnnualRateType = (rateType: string | null | undefined): boolean => {
    if (!rateType) return false;
    const rt = rateType.toLowerCase();
    return rt.includes('/season') || rt.includes('/yr') || rt.includes('/year') || 
           rt.includes('per season') || rt.includes('per year') || rt === 'annual' ||
           rt.includes('$/ft/season') || rt.includes('$/ft/yr');
  };

  const isAnnualContract = (contractTerm: string | null): boolean => {
    if (!contractTerm) return false;
    const term = contractTerm.toLowerCase();
    return term === 'annual' || term === 'yearly' || term === '12 month' || term === '12 months';
  };
  
  const getEffectiveMonthsForLease = (
    contractTerm: string | null,
    numMonths: number | null,
    leaseCommencement: string | null,
    leaseExpiration: string | null
  ): number => {
    if (isAnnualContract(contractTerm)) return 12;
    if (numMonths && numMonths > 0) return numMonths;
    if (leaseCommencement && leaseExpiration) {
      const start = new Date(leaseCommencement);
      const end = new Date(leaseExpiration);
      const yearDiff = end.getFullYear() - start.getFullYear();
      const monthDiff = end.getMonth() - start.getMonth();
      let months = yearDiff * 12 + monthDiff;
      if (end.getDate() >= start.getDate()) months += 1;
      return Math.max(1, months);
    }
    const term = (contractTerm || '').toLowerCase();
    if (term.includes('summer') || term.includes('winter') || term.includes('seasonal')) return 6;
    return 12;
  };

  const start = new Date(startDate);
  const end = new Date(endDate);
  const months: MonthlyRevenue[] = [];
  
  let current = new Date(start.getFullYear(), start.getMonth(), 1);
  while (current <= end) {
    const monthLabel = current.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    let monthRevenue = 0;
    let activeLeaseCount = 0;
    
    for (const lease of leaseData) {
      const baseRent = lease.leaseAmount ? parseFloat(String(lease.leaseAmount)) : 0;
      
      if (isSeasonalOrAnnualRateType(lease.rateType)) {
        const effectiveMonths = getEffectiveMonthsForLease(
          lease.contractTerm,
          lease.numMonths,
          lease.leaseCommencement,
          lease.leaseExpiration
        );
        monthRevenue += baseRent / effectiveMonths;
      } else {
        monthRevenue += baseRent;
      }
      activeLeaseCount += 1;
    }
    
    months.push({
      month: monthLabel,
      revenue: monthRevenue.toFixed(2),
      leaseCount: activeLeaseCount,
    });
    
    current.setMonth(current.getMonth() + 1);
  }
  
  return months;
}

/**
 * Get revenue breakdown by storage type for Total Revenue Modal
 */
export async function getExecutiveRevenueByStorageTypeModal(
  orgId: string,
  startDate: string,
  endDate: string,
  filterOptions?: KpiFilterOptions
): Promise<StorageTypeRevenue[]> {
  const baseFilterCondition = buildProjectFilterConditions(marinaLocations, filterOptions);
  const filterCondition = and(
    eq(marinaLocations.orgId, orgId),
    baseFilterCondition || sql`1=1`
  );
  
  const query = db
    .select({
      storageType: leases.storageType,
      leaseAmount: leases.leaseAmount,
      rateType: leases.rateType,
      numMonths: leases.numMonths,
      contractTerm: leases.contractTerm,
      leaseCommencement: leases.leaseCommencement,
      leaseExpiration: leases.leaseExpiration,
    })
    .from(leases)
    .innerJoin(marinaLocations, eq(leases.locationId, marinaLocations.id))
    .where(
      and(
        filterCondition,
        eq(leases.isActive, true),
        sql`(${leases.leaseCommencement} IS NULL OR ${leases.leaseCommencement} <= ${endDate})`,
        sql`(${leases.leaseExpiration} IS NULL OR ${leases.leaseExpiration} >= ${startDate})`
      )
    );

  const leaseData = await query;

  const isAnnualContract = (contractTerm: string | null): boolean => {
    if (!contractTerm) return false;
    const term = contractTerm.toLowerCase();
    return term === 'annual' || term === 'yearly' || term === '12 month' || term === '12 months';
  };
  
  const calculateEffectiveNumMonths = (
    contractTerm: string | null,
    numMonths: number | null,
    leaseCommencement: string | null,
    leaseExpiration: string | null
  ): number => {
    if (isAnnualContract(contractTerm)) return 12;
    if (numMonths && numMonths > 0) return numMonths;
    if (leaseCommencement && leaseExpiration) {
      const start = new Date(leaseCommencement);
      const end = new Date(leaseExpiration);
      const yearDiff = end.getFullYear() - start.getFullYear();
      const monthDiff = end.getMonth() - start.getMonth();
      let months = yearDiff * 12 + monthDiff;
      if (end.getDate() >= start.getDate()) months += 1;
      return Math.max(1, months);
    }
    const term = (contractTerm || '').toLowerCase();
    if (term.includes('summer') || term.includes('winter') || term.includes('seasonal')) return 6;
    return 12;
  };
  
  const isSeasonalOrAnnualRateType = (rateType: string | null | undefined): boolean => {
    if (!rateType) return false;
    const rt = rateType.toLowerCase();
    return rt.includes('/season') || rt.includes('/yr') || rt.includes('/year') || 
           rt.includes('per season') || rt.includes('per year') || rt === 'annual' ||
           rt.includes('$/ft/season') || rt.includes('$/ft/yr');
  };

  const typeRevenueMap = new Map<string, { revenue: number; count: number }>();
  
  for (const lease of leaseData) {
    const baseRent = lease.leaseAmount ? parseFloat(String(lease.leaseAmount)) : 0;
    let leaseRevenue = 0;
    
    if (isSeasonalOrAnnualRateType(lease.rateType)) {
      leaseRevenue = baseRent;
    } else {
      const effectiveMonths = calculateEffectiveNumMonths(
        lease.contractTerm,
        lease.numMonths,
        lease.leaseCommencement,
        lease.leaseExpiration
      );
      leaseRevenue = baseRent * effectiveMonths;
    }
    
    const storageType = lease.storageType || "Unknown";
    const existing = typeRevenueMap.get(storageType);
    if (existing) {
      existing.revenue += leaseRevenue;
      existing.count += 1;
    } else {
      typeRevenueMap.set(storageType, { revenue: leaseRevenue, count: 1 });
    }
  }

  const totalRevenue = Array.from(typeRevenueMap.values()).reduce((sum, t) => sum + t.revenue, 0);

  return Array.from(typeRevenueMap.entries()).map(([type, data]) => ({
    storageType: type,
    revenue: data.revenue.toFixed(2),
    leaseCount: data.count,
    percentage: totalRevenue > 0 ? (data.revenue / totalRevenue) * 100 : 0,
  })).sort((a, b) => parseFloat(b.revenue) - parseFloat(a.revenue));
}

/**
 * Get executive revenue trend (aggregated monthly data)
 */
export async function getExecutiveRevenueTrend(
  orgId: string,
  startDate: string,
  endDate: string,
  filterOptions?: KpiFilterOptions
): Promise<RevenueTrendDataPoint[]> {
  // Build filter with orgId for tenant isolation
  const baseFilterCondition = buildProjectFilterConditions(marinaLocations, filterOptions);
  const filterCondition = and(
    eq(marinaLocations.orgId, orgId),
    baseFilterCondition || sql`1=1`
  );
  
  const startDateObj = new Date(startDate);
  const endDateObj = new Date(endDate);
  const startYear = startDateObj.getFullYear();
  const startMonth = startDateObj.getMonth() + 1;
  const endYear = endDateObj.getFullYear();
  const endMonth = endDateObj.getMonth() + 1;
  
  const result = await db
    .select({
      year: leaseCashFlows.year,
      month: leaseCashFlows.month,
      totalRevenue: sql<string>`COALESCE(SUM(${leaseCashFlows.amount}), 0)`,
      leaseCount: sql<number>`CAST(COUNT(DISTINCT ${leaseCashFlows.leaseId}) AS INTEGER)`,
    })
    .from(leaseCashFlows)
    .innerJoin(leases, eq(leaseCashFlows.leaseId, leases.id))
    .innerJoin(marinaLocations, eq(leases.locationId, marinaLocations.id))
    .where(
      and(
        sql`(
          (${leaseCashFlows.year} > ${startYear} OR (${leaseCashFlows.year} = ${startYear} AND ${leaseCashFlows.month} >= ${startMonth}))
          AND
          (${leaseCashFlows.year} < ${endYear} OR (${leaseCashFlows.year} = ${endYear} AND ${leaseCashFlows.month} <= ${endMonth}))
        )`,
        filterCondition
      )
    )
    .groupBy(leaseCashFlows.year, leaseCashFlows.month)
    .orderBy(leaseCashFlows.year, leaseCashFlows.month);
  
  return result.map(row => ({
    periodDate: `${row.year}-${String(row.month).padStart(2, '0')}-01`,
    periodLabel: new Date(row.year, row.month - 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
    revenue: row.totalRevenue,
    leaseCount: row.leaseCount,
  }));
}

/**
 * Get executive revenue trend by storage type
 */
export async function getExecutiveRevenueTrendByStorageType(
  orgId: string,
  startDate: string,
  endDate: string,
  filterOptions?: KpiFilterOptions & { storageTypes?: string[] }
): Promise<RevenueTrendByStorageType> {
  const total = await getExecutiveRevenueTrend(orgId, startDate, endDate, filterOptions);
  return {
    total,
    byStorageType: {},
    storageTypes: [],
  };
}

/**
 * Get executive ancillary revenue trend (placeholder)
 */
export async function getExecutiveAncillaryRevenueTrend(
  orgId: string,
  startDate: string,
  endDate: string,
  filterOptions?: KpiFilterOptions
): Promise<AncillaryRevenueTrendDataPoint[]> {
  return [];
}

/**
 * Get executive transient revenue trend (placeholder)
 */
export async function getExecutiveTransientRevenueTrend(
  orgId: string,
  startDate: string,
  endDate: string,
  filterOptions?: KpiFilterOptions
): Promise<RevenueTrendDataPoint[]> {
  return [];
}

/**
 * Get available storage types for executive dashboard filters
 */
export async function getExecutiveAvailableStorageTypes(
  orgId: string,
  projectIds?: string[]
): Promise<string[]> {
  // Build conditions with orgId for tenant isolation
  const conditions = [eq(marinaLocations.orgId, orgId)];
  
  if (projectIds?.length) {
    conditions.push(inArray(marinaLocations.id, projectIds));
  } else {
    conditions.push(eq(marinaLocations.includeInExecutive, true));
  }
  
  const result = await db
    .selectDistinct({ storageType: storageLocations.storageType })
    .from(storageLocations)
    .innerJoin(marinaLocations, eq(storageLocations.projectId, marinaLocations.id))
    .where(and(...conditions));
  
  return result.map(r => r.storageType).filter(Boolean) as string[];
}

export interface RevenueTrendDataPoint {
  periodDate: string;
  periodLabel: string;
  revenue: string;
  leaseCount: number;
}

export interface AncillaryRevenueTrendDataPoint {
  periodDate: string;
  periodLabel: string;
  electricRevenue: string;
  liveaboardRevenue: string;
  otherRevenue: string;
  totalAncillaryRevenue: string;
}

export interface StorageTypeRevenueTrendDataPoint {
  periodDate: string;
  periodLabel: string;
  storageType: string;
  revenue: string;
  leaseCount: number;
}

export interface RevenueTrendByStorageType {
  total: RevenueTrendDataPoint[];
  byStorageType: Record<string, RevenueTrendDataPoint[]>;
  storageTypes: string[];
}

/**
 * Get revenue trend data for charts (monthly breakdown)
 */
export async function getRevenueTrendData(
  startDate: string,
  endDate: string,
  filterOptions?: KpiFilterOptions
): Promise<RevenueTrendDataPoint[]> {
  // Build filter conditions for project-level filtering
  const whereConditions: any[] = [
    gte(periods.periodDate, startDate),
    lte(periods.periodDate, endDate),
    eq(marinaLocations.includeInExecutive, true)
  ];
  
  if (filterOptions?.projectIds && filterOptions.projectIds.length > 0) {
    whereConditions.push(inArray(marinaLocations.id, filterOptions.projectIds));
  }
  
  if (filterOptions?.projectType && filterOptions.projectType !== "ALL") {
    whereConditions.push(eq(marinaLocations.projectType, filterOptions.projectType));
  }
  
  // Add organization scoping if provided
  if (filterOptions?.organizationIds && filterOptions.organizationIds.length > 0) {
    whereConditions.push(inArray(marinaLocations.organizationId, filterOptions.organizationIds));
  }
  
  // Query revenue aggregated by period using INNER JOINs to only get periods with actual data
  const results = await db
    .select({
      periodDate: periods.periodDate,
      periodLabel: periods.label,
      revenue: sql<string>`COALESCE(SUM(${leaseCashFlows.rentAmount}), 0)`,
      leaseCount: sql<number>`COUNT(DISTINCT ${leaseCashFlows.leaseId})`,
    })
    .from(leaseCashFlows)
    .innerJoin(periods, eq(leaseCashFlows.periodId, periods.id))
    .innerJoin(leases, eq(leaseCashFlows.leaseId, leases.id))
    .innerJoin(marinaLocations, eq(leases.locationId, marinaLocations.id))
    .where(and(...whereConditions))
    .groupBy(periods.id, periods.periodDate, periods.label)
    .orderBy(asc(periods.periodDate));

  return results.map(r => ({
    periodDate: r.periodDate,
    periodLabel: r.periodLabel,
    revenue: r.revenue || "0",
    leaseCount: r.leaseCount || 0,
  }));
}

/**
 * Get revenue trend data with storage type breakdown for comparison charts.
 * Returns both total revenue trend and per-storage-type trends for selected storage types.
 */
export async function getRevenueTrendByStorageType(
  startDate: string,
  endDate: string,
  storageTypes?: string[],
  filterOptions?: KpiFilterOptions
): Promise<RevenueTrendByStorageType> {
  // Build filter conditions for project-level filtering
  const baseConditions: any[] = [
    gte(periods.periodDate, startDate),
    lte(periods.periodDate, endDate),
    eq(marinaLocations.includeInExecutive, true)
  ];
  
  if (filterOptions?.projectIds && filterOptions.projectIds.length > 0) {
    baseConditions.push(inArray(marinaLocations.id, filterOptions.projectIds));
  }
  
  if (filterOptions?.projectType && filterOptions.projectType !== "ALL") {
    baseConditions.push(eq(marinaLocations.projectType, filterOptions.projectType));
  }
  
  if (filterOptions?.organizationIds && filterOptions.organizationIds.length > 0) {
    baseConditions.push(inArray(marinaLocations.organizationId, filterOptions.organizationIds));
  }

  // Get total revenue trend (existing logic)
  const totalResults = await db
    .select({
      periodDate: periods.periodDate,
      periodLabel: periods.label,
      revenue: sql<string>`COALESCE(SUM(${leaseCashFlows.rentAmount}), 0)`,
      leaseCount: sql<number>`COUNT(DISTINCT ${leaseCashFlows.leaseId})`,
    })
    .from(leaseCashFlows)
    .innerJoin(periods, eq(leaseCashFlows.periodId, periods.id))
    .innerJoin(leases, eq(leaseCashFlows.leaseId, leases.id))
    .innerJoin(marinaLocations, eq(leases.locationId, marinaLocations.id))
    .where(and(...baseConditions))
    .groupBy(periods.id, periods.periodDate, periods.label)
    .orderBy(asc(periods.periodDate));

  const total = totalResults.map(r => ({
    periodDate: r.periodDate,
    periodLabel: r.periodLabel,
    revenue: r.revenue || "0",
    leaseCount: r.leaseCount || 0,
  }));

  // If no storage types specified, return only total
  if (!storageTypes || storageTypes.length === 0) {
    return {
      total,
      byStorageType: {},
      storageTypes: [],
    };
  }

  // Query revenue by storage type and period
  const storageTypeConditions = [...baseConditions, inArray(leases.storageType, storageTypes)];
  
  const storageTypeResults = await db
    .select({
      periodDate: periods.periodDate,
      periodLabel: periods.label,
      storageType: leases.storageType,
      revenue: sql<string>`COALESCE(SUM(${leaseCashFlows.rentAmount}), 0)`,
      leaseCount: sql<number>`COUNT(DISTINCT ${leaseCashFlows.leaseId})`,
    })
    .from(leaseCashFlows)
    .innerJoin(periods, eq(leaseCashFlows.periodId, periods.id))
    .innerJoin(leases, eq(leaseCashFlows.leaseId, leases.id))
    .innerJoin(marinaLocations, eq(leases.locationId, marinaLocations.id))
    .where(and(...storageTypeConditions))
    .groupBy(periods.id, periods.periodDate, periods.label, leases.storageType)
    .orderBy(asc(periods.periodDate));

  // Group results by storage type
  const byStorageType: Record<string, RevenueTrendDataPoint[]> = {};
  
  for (const r of storageTypeResults) {
    const storageType = r.storageType || "Unknown";
    if (!byStorageType[storageType]) {
      byStorageType[storageType] = [];
    }
    byStorageType[storageType].push({
      periodDate: r.periodDate,
      periodLabel: r.periodLabel,
      revenue: r.revenue || "0",
      leaseCount: r.leaseCount || 0,
    });
  }

  // Ensure all requested storage types are in the result (even if empty)
  for (const st of storageTypes) {
    if (!byStorageType[st]) {
      byStorageType[st] = [];
    }
  }

  return {
    total,
    byStorageType,
    storageTypes: Object.keys(byStorageType),
  };
}

/**
 * Get ancillary revenue trend data (electric, liveaboard, other fees) by period.
 * This complements the storage revenue trend to provide complete revenue picture.
 */
export async function getAncillaryRevenueTrendData(
  startDate: string,
  endDate: string,
  filterOptions?: KpiFilterOptions
): Promise<AncillaryRevenueTrendDataPoint[]> {
  // Build filter conditions
  const whereConditions: any[] = [
    gte(leaseLineItems.startDate, startDate),
    lte(leaseLineItems.endDate, endDate),
    eq(marinaLocations.includeInExecutive, true)
  ];
  
  if (filterOptions?.projectIds && filterOptions.projectIds.length > 0) {
    whereConditions.push(inArray(marinaLocations.id, filterOptions.projectIds));
  }
  
  if (filterOptions?.projectType && filterOptions.projectType !== "ALL") {
    whereConditions.push(eq(marinaLocations.projectType, filterOptions.projectType));
  }
  
  if (filterOptions?.organizationIds && filterOptions.organizationIds.length > 0) {
    whereConditions.push(inArray(marinaLocations.organizationId, filterOptions.organizationIds));
  }
  
  // Query ancillary fees (electric, liveaboard, other) from lease line items
  // Group by period date extracted from line item dates
  const results = await db
    .select({
      periodDate: sql<string>`DATE_TRUNC('month', ${leaseLineItems.startDate})::date`,
      electricRevenue: sql<string>`COALESCE(SUM(CASE WHEN ${leaseLineItems.lineType} = 'electric' THEN ${leaseLineItems.amount} ELSE 0 END), 0)`,
      liveaboardRevenue: sql<string>`COALESCE(SUM(CASE WHEN ${leaseLineItems.lineType} = 'liveaboard' THEN ${leaseLineItems.amount} ELSE 0 END), 0)`,
      otherRevenue: sql<string>`COALESCE(SUM(CASE WHEN ${leaseLineItems.lineType} = 'other' THEN ${leaseLineItems.amount} ELSE 0 END), 0)`,
    })
    .from(leaseLineItems)
    .innerJoin(leases, eq(leaseLineItems.leaseId, leases.id))
    .innerJoin(marinaLocations, eq(leases.locationId, marinaLocations.id))
    .where(and(...whereConditions))
    .groupBy(sql`DATE_TRUNC('month', ${leaseLineItems.startDate})`)
    .orderBy(sql`DATE_TRUNC('month', ${leaseLineItems.startDate})`);
  
  return results.map(r => {
    const electric = parseFloat(r.electricRevenue || "0");
    const liveaboard = parseFloat(r.liveaboardRevenue || "0");
    const other = parseFloat(r.otherRevenue || "0");
    const periodDate = new Date(r.periodDate);
    const periodLabel = periodDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    
    return {
      periodDate: r.periodDate,
      periodLabel,
      electricRevenue: electric.toFixed(2),
      liveaboardRevenue: liveaboard.toFixed(2),
      otherRevenue: other.toFixed(2),
      totalAncillaryRevenue: (electric + liveaboard + other).toFixed(2),
    };
  });
}

/**
 * Get transient/short-term revenue trend (Daily/Nightly, Weekly, Monthly contract terms).
 * Returns storage revenue from short-term leases only.
 */
export async function getTransientRevenueTrendData(
  startDate: string,
  endDate: string,
  filterOptions?: KpiFilterOptions
): Promise<RevenueTrendDataPoint[]> {
  // Short-term contract terms (transient)
  const shortTermContractTerms = ['Monthly', 'Weekly', 'Daily/Nightly'];
  
  const whereConditions: any[] = [
    gte(periods.periodDate, startDate),
    lte(periods.periodDate, endDate),
    eq(marinaLocations.includeInExecutive, true),
    inArray(leases.contractTerm, shortTermContractTerms)
  ];
  
  if (filterOptions?.projectIds && filterOptions.projectIds.length > 0) {
    whereConditions.push(inArray(marinaLocations.id, filterOptions.projectIds));
  }
  
  if (filterOptions?.projectType && filterOptions.projectType !== "ALL") {
    whereConditions.push(eq(marinaLocations.projectType, filterOptions.projectType));
  }
  
  if (filterOptions?.organizationIds && filterOptions.organizationIds.length > 0) {
    whereConditions.push(inArray(marinaLocations.organizationId, filterOptions.organizationIds));
  }
  
  const results = await db
    .select({
      periodDate: periods.periodDate,
      periodLabel: periods.label,
      revenue: sql<string>`COALESCE(SUM(${leaseCashFlows.rentAmount}), 0)`,
      leaseCount: sql<number>`COUNT(DISTINCT ${leaseCashFlows.leaseId})`,
    })
    .from(leaseCashFlows)
    .innerJoin(periods, eq(leaseCashFlows.periodId, periods.id))
    .innerJoin(leases, eq(leaseCashFlows.leaseId, leases.id))
    .innerJoin(marinaLocations, eq(leases.locationId, marinaLocations.id))
    .where(and(...whereConditions))
    .groupBy(periods.id, periods.periodDate, periods.label)
    .orderBy(asc(periods.periodDate));
  
  return results.map(r => ({
    periodDate: r.periodDate,
    periodLabel: r.periodLabel,
    revenue: r.revenue || "0",
    leaseCount: r.leaseCount || 0,
  }));
}

// ============================================================================
// MARINA LOCATIONS CRUD
// ============================================================================

/**
 * Get all marina locations filtered by organizationIds
 */
export async function getAllLocations(organizationIds?: string[]): Promise<MarinaLocation[]> {
  if (organizationIds && organizationIds.length > 0) {
    return await db
      .select()
      .from(marinaLocations)
      .where(inArray(marinaLocations.organizationId, organizationIds))
      .orderBy(asc(marinaLocations.name));
  }
  return await db.select().from(marinaLocations).orderBy(asc(marinaLocations.name));
}

/**
 * Get active marina locations only, filtered by organizationIds
 */
export async function getActiveLocations(organizationIds?: string[]): Promise<MarinaLocation[]> {
  const conditions = [eq(marinaLocations.isActive, true)];
  
  if (organizationIds && organizationIds.length > 0) {
    conditions.push(inArray(marinaLocations.organizationId, organizationIds));
  }
  
  return await db
    .select()
    .from(marinaLocations)
    .where(and(...conditions))
    .orderBy(asc(marinaLocations.name));
}

/**
 * Get a single location by ID
 */
export async function getLocationById(id: string): Promise<MarinaLocation | undefined> {
  const results = await db.select().from(marinaLocations).where(eq(marinaLocations.id, id));
  return results[0];
}

/**
 * Create a new marina location
 */
export async function createLocation(data: InsertMarinaLocation): Promise<MarinaLocation> {
  const results = await db.insert(marinaLocations).values(data).returning();
  return results[0];
}

/**
 * Update an existing marina location
 */
export async function updateLocation(id: string, data: Partial<InsertMarinaLocation>): Promise<MarinaLocation> {
  const results = await db
    .update(marinaLocations)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(marinaLocations.id, id))
    .returning();
  return results[0];
}

/**
 * Delete a marina location (only if no leases are assigned)
 */
export async function deleteLocation(id: string): Promise<void> {
  const assignedLeases = await db
    .select({ count: sql<number>`count(*)` })
    .from(leases)
    .where(eq(leases.locationId, id));
  
  if (assignedLeases[0]?.count > 0) {
    throw new Error(`Cannot delete location: ${assignedLeases[0].count} lease(s) are assigned to this location`);
  }
  
  await db.delete(marinaLocations).where(eq(marinaLocations.id, id));
}

/**
 * Get location occupancy statistics
 */
export interface LocationOccupancy {
  locationId: string;
  locationName: string;
  capacity: number | null;
  activeLeases: number;
  occupancyRate: number;
  totalRevenue: string;
}

export async function getLocationOccupancy(startDate: string, endDate: string): Promise<LocationOccupancy[]> {
  const results = await db
    .select({
      locationId: marinaLocations.id,
      locationName: marinaLocations.name,
      capacity: marinaLocations.capacity,
      activeLeases: sql<number>`COUNT(DISTINCT CASE WHEN ${leases.isActive} THEN ${leases.id} END)`,
      totalRevenue: sql<string>`COALESCE(SUM(${leaseCashFlows.rentAmount}), 0)`,
    })
    .from(marinaLocations)
    .leftJoin(leases, eq(leases.locationId, marinaLocations.id))
    .leftJoin(leaseCashFlows, eq(leaseCashFlows.leaseId, leases.id))
    .leftJoin(periods, and(
      eq(leaseCashFlows.periodId, periods.id),
      gte(periods.periodDate, startDate),
      lte(periods.periodDate, endDate)
    ))
    .where(eq(marinaLocations.isActive, true))
    .groupBy(marinaLocations.id, marinaLocations.name, marinaLocations.capacity)
    .orderBy(desc(sql`SUM(${leaseCashFlows.rentAmount})`));

  return results.map(r => ({
    locationId: r.locationId,
    locationName: r.locationName,
    capacity: r.capacity,
    activeLeases: r.activeLeases || 0,
    occupancyRate: r.capacity ? (r.activeLeases || 0) / r.capacity : 0,
    totalRevenue: r.totalRevenue || "0",
  }));
}

/**
 * Get comprehensive project hub metrics for all locations
 * Shows key stats for project selection view
 */
export interface ProjectHubMetrics {
  locationId: string;
  name: string;
  code: string | null;
  description: string | null;
  projectType: "OWNED" | "DEAL";
  status: string | null;
  targetNOI: string | null;
  capacity: number | null;
  activeLeaseCount: number;
  totalLeaseCount: number;
  occupancyRate: number;
  monthlyRevenue: string;
  trailing12MonthRevenue: string;
  nextExpirationDate: string | null;
  upcomingExpirations: number;
  includeInExecutive: boolean;
}

export async function getProjectHubMetrics(organizationIds?: string[]): Promise<ProjectHubMetrics[]> {
  const now = new Date();
  const currentMonthEnd = endOfMonth(now).toISOString().split('T')[0];
  const oneYearAgo = endOfMonth(subMonths(now, 12)).toISOString().split('T')[0];
  const threeMonthsOut = endOfMonth(addMonths(now, 3)).toISOString().split('T')[0];

  const conditions = [eq(marinaLocations.isActive, true)];
  
  if (organizationIds && organizationIds.length > 0) {
    conditions.push(inArray(marinaLocations.organizationId, organizationIds));
  }

  const results = await db
    .select({
      locationId: marinaLocations.id,
      name: marinaLocations.name,
      code: marinaLocations.code,
      description: marinaLocations.description,
      projectType: marinaLocations.projectType,
      status: marinaLocations.status,
      targetNOI: marinaLocations.targetNOI,
      capacity: marinaLocations.capacity,
      includeInExecutive: marinaLocations.includeInExecutive,
      activeLeaseCount: sql<number>`COUNT(DISTINCT CASE WHEN ${leases.isActive} THEN ${leases.id} END)`,
      totalLeaseCount: sql<number>`COUNT(DISTINCT ${leases.id})`,
      monthlyRevenue: sql<string>`COALESCE(SUM(DISTINCT CASE WHEN ${leases.isActive} THEN ${leases.leaseAmount} ELSE 0 END), 0)`,
      trailing12Revenue: sql<string>`COALESCE(
        (SELECT SUM(${leaseCashFlows.rentAmount}) 
         FROM ${leaseCashFlows} 
         INNER JOIN ${leases} l2 ON ${leaseCashFlows.leaseId} = l2.id
         INNER JOIN ${periods} p2 ON ${leaseCashFlows.periodId} = p2.id
         WHERE l2.location_id = ${marinaLocations.id}
         AND p2.period_date BETWEEN ${oneYearAgo} AND ${currentMonthEnd}),
        0
      )`,
      nextExpirationDate: sql<string>`MIN(CASE WHEN ${leases.leaseExpiration} IS NOT NULL THEN ${leases.leaseExpiration} END)`,
      upcomingExpirations: sql<number>`COUNT(DISTINCT CASE 
        WHEN ${leases.leaseExpiration} IS NOT NULL 
        AND ${leases.leaseExpiration} <= ${threeMonthsOut}
        AND ${leases.isActive} THEN ${leases.id} 
      END)`,
    })
    .from(marinaLocations)
    .leftJoin(leases, eq(leases.locationId, marinaLocations.id))
    .where(and(...conditions))
    .groupBy(
      marinaLocations.id, 
      marinaLocations.name, 
      marinaLocations.code,
      marinaLocations.description,
      marinaLocations.projectType,
      marinaLocations.status,
      marinaLocations.targetNOI,
      marinaLocations.capacity,
      marinaLocations.includeInExecutive,
      marinaLocations.createdAt
    )
    .orderBy(desc(marinaLocations.projectType), desc(marinaLocations.createdAt));

  return results.map(r => ({
    locationId: r.locationId,
    name: r.name,
    code: r.code,
    description: r.description,
    projectType: r.projectType as "OWNED" | "DEAL",
    status: r.status,
    targetNOI: r.targetNOI?.toString() || null,
    capacity: r.capacity,
    activeLeaseCount: r.activeLeaseCount || 0,
    totalLeaseCount: r.totalLeaseCount || 0,
    occupancyRate: r.capacity ? (r.activeLeaseCount || 0) / r.capacity : 0,
    monthlyRevenue: r.monthlyRevenue?.toString() || "0",
    trailing12MonthRevenue: r.trailing12Revenue?.toString() || "0",
    nextExpirationDate: r.nextExpirationDate,
    upcomingExpirations: r.upcomingExpirations || 0,
    includeInExecutive: r.includeInExecutive || false,
  }));
}

// ============================================================================
// PHASE 1 - PER-LEASE CASH FLOW MATRIX
// ============================================================================

/**
 * Get per-lease cash flow matrix showing all leases vs periods
 * Excel-style pivot view for institutional analysis
 */
export async function getLeaseCashFlowMatrix(options?: {
  startDate?: Date;
  endDate?: Date;
  locationId?: string | null;
}): Promise<LeaseCashFlowMatrixResponse> {
  const from = options?.startDate || new Date(2024, 0, 1);
  const to = options?.endDate || new Date(2026, 11, 31);
  
  // Get all periods in range
  const allPeriods = await db.query.periods.findMany({
    where: and(
      gte(periods.periodDate, endOfMonth(from).toISOString().split('T')[0]),
      lte(periods.periodDate, endOfMonth(to).toISOString().split('T')[0])
    ),
    orderBy: [asc(periods.periodDate)],
  });
  
  if (allPeriods.length === 0) {
    return { periods: [], rows: [] };
  }
  
  const periodIds = allPeriods.map(p => p.id);
  
  // Get all cash flows in range with lease, tenant, and location info
  let cashFlowQuery = db
    .select({
      leaseId: leaseCashFlows.leaseId,
      periodId: leaseCashFlows.periodId,
      rentAmount: leaseCashFlows.rentAmount,
      isActiveInPeriod: leaseCashFlows.isActiveInPeriod,
      tenantName: tenants.name,
      storageType: leases.storageType,
      leaseCommencement: leases.leaseCommencement,
      leaseExpiration: leases.leaseExpiration,
      locationId: leases.locationId,
      locationName: marinaLocations.name,
    })
    .from(leaseCashFlows)
    .innerJoin(leases, eq(leaseCashFlows.leaseId, leases.id))
    .innerJoin(tenants, eq(leases.tenantId, tenants.id))
    .leftJoin(marinaLocations, eq(leases.locationId, marinaLocations.id))
    .where(inArray(leaseCashFlows.periodId, periodIds));
  
  // Apply location filter if provided
  if (options?.locationId) {
    cashFlowQuery = cashFlowQuery.where(eq(leases.locationId, options.locationId)) as any;
  }
  
  const cashFlows = await cashFlowQuery;
  
  // Group by lease
  const leaseMap = new Map<string, {
    leaseId: string;
    tenantName: string;
    storageType: string | null;
    leaseCommencement: string;
    leaseExpiration: string | null;
    marinaLocationName: string | null;
    flows: Map<string, { rentAmount: string; isActiveInPeriod: boolean }>;
  }>();
  
  for (const flow of cashFlows) {
    if (!leaseMap.has(flow.leaseId)) {
      leaseMap.set(flow.leaseId, {
        leaseId: flow.leaseId,
        tenantName: flow.tenantName,
        storageType: flow.storageType,
        leaseCommencement: flow.leaseCommencement,
        leaseExpiration: flow.leaseExpiration,
        marinaLocationName: flow.locationName,
        flows: new Map(),
      });
    }
    
    leaseMap.get(flow.leaseId)!.flows.set(flow.periodId, {
      rentAmount: flow.rentAmount,
      isActiveInPeriod: flow.isActiveInPeriod,
    });
  }
  
  // Build response
  const rows: LeaseCashFlowMatrixRow[] = Array.from(leaseMap.values()).map(lease => ({
    leaseId: lease.leaseId,
    tenantName: lease.tenantName,
    storageType: lease.storageType,
    leaseCommencement: lease.leaseCommencement,
    leaseExpiration: lease.leaseExpiration,
    marinaLocationName: lease.marinaLocationName,
    periodCashFlows: allPeriods.map(period => {
      const flow = lease.flows.get(period.id);
      return {
        periodId: period.id,
        periodLabel: period.label,
        periodDate: period.periodDate,
        rentAmount: flow ? parseFloat(flow.rentAmount) : 0,
        isActiveInPeriod: flow?.isActiveInPeriod || false,
      };
    }),
  }));
  
  const periodsResponse = allPeriods.map(p => ({
    periodId: p.id,
    label: p.label,
    periodDate: p.periodDate,
  }));
  
  return { periods: periodsResponse, rows };
}

// ============================================================================
// PHASE 1 - DATA QUALITY VALIDATION
// ============================================================================

/**
 * Perform data quality validation checks on leases and tenants
 * Returns issues categorized by severity and category for institutional compliance
 */
export async function getDataQualitySummary(options?: {
  locationId?: string | null;
  asOfDate?: Date;
}): Promise<DataQualitySummary> {
  const issues: DataQualityIssue[] = [];
  const today = options?.asOfDate || new Date();
  const todayStr = format(today, "yyyy-MM-dd");
  
  // Fetch all leases with tenant data
  let leasesQuery = db
    .select({
      leaseId: leases.id,
      tenantId: tenants.id,
      tenantName: tenants.name,
      leaseCommencement: leases.leaseCommencement,
      leaseExpiration: leases.leaseExpiration,
      leaseAmount: leases.leaseAmount,
      isActive: leases.isActive,
      coiOnFile: leases.coiOnFile,
      coiExpiration: leases.coiExpiration,
      contractTerm: leases.contractTerm,
      storageType: leases.storageType,
      locationId: leases.locationId,
      tenantState: tenants.state,
      boatSize: tenants.boatSize,
    })
    .from(leases)
    .innerJoin(tenants, eq(leases.tenantId, tenants.id));
  
  if (options?.locationId) {
    leasesQuery = leasesQuery.where(eq(leases.locationId, options.locationId)) as any;
  }
  
  const allLeases = await leasesQuery;
  
  // CHECK 1: LEASE_DATES - Expiration before commencement
  for (const lease of allLeases) {
    if (lease.leaseExpiration && lease.leaseCommencement) {
      const commencementDate = new Date(lease.leaseCommencement);
      const expirationDate = new Date(lease.leaseExpiration);
      
      if (expirationDate < commencementDate) {
        issues.push({
          id: `lease-dates-${lease.leaseId}-invalid`,
          severity: "ERROR",
          category: "LEASE_DATES",
          message: `Lease expiration (${lease.leaseExpiration}) is before commencement (${lease.leaseCommencement})`,
          leaseId: lease.leaseId,
          tenantId: lease.tenantId,
          locationId: lease.locationId,
          metadata: {
            tenantName: lease.tenantName,
            commencement: lease.leaseCommencement,
            expiration: lease.leaseExpiration,
          },
        });
      }
    }
    
    // Missing expiration for certain contract terms
    if (!lease.leaseExpiration && 
        (lease.contractTerm === "Seasonal" || lease.contractTerm === "Winter Storage")) {
      issues.push({
        id: `lease-dates-${lease.leaseId}-missing-exp`,
        severity: "WARNING",
        category: "LEASE_DATES",
        message: `${lease.contractTerm} lease missing expiration date`,
        leaseId: lease.leaseId,
        tenantId: lease.tenantId,
        locationId: lease.locationId,
        metadata: {
          tenantName: lease.tenantName,
          contractTerm: lease.contractTerm,
        },
      });
    }
  }
  
  // CHECK 2: COI - Certificate of Insurance issues
  for (const lease of allLeases) {
    // COI on file but no expiration
    if (lease.coiOnFile && !lease.coiExpiration) {
      issues.push({
        id: `coi-${lease.leaseId}-missing-exp`,
        severity: "WARNING",
        category: "COI",
        message: `COI marked on file but missing expiration date`,
        leaseId: lease.leaseId,
        tenantId: lease.tenantId,
        locationId: lease.locationId,
        metadata: {
          tenantName: lease.tenantName,
        },
      });
    }
    
    // Active lease with expired COI
    if (lease.isActive && lease.coiExpiration && lease.coiExpiration < todayStr) {
      issues.push({
        id: `coi-${lease.leaseId}-expired`,
        severity: "ERROR",
        category: "COI",
        message: `Active lease has expired COI (${lease.coiExpiration})`,
        leaseId: lease.leaseId,
        tenantId: lease.tenantId,
        locationId: lease.locationId,
        metadata: {
          tenantName: lease.tenantName,
          coiExpiration: lease.coiExpiration,
        },
      });
    }
  }
  
  // CHECK 3: LEASE_AMOUNT - Invalid amounts
  for (const lease of allLeases) {
    if (lease.isActive && parseFloat(lease.leaseAmount) <= 0) {
      issues.push({
        id: `lease-amount-${lease.leaseId}-invalid`,
        severity: "ERROR",
        category: "LEASE_AMOUNT",
        message: `Active lease has invalid amount: ${lease.leaseAmount}`,
        leaseId: lease.leaseId,
        tenantId: lease.tenantId,
        locationId: lease.locationId,
        metadata: {
          tenantName: lease.tenantName,
          leaseAmount: lease.leaseAmount,
        },
      });
    }
  }
  
  // CHECK 4: TENANT_DATA - Missing or invalid tenant data
  for (const lease of allLeases) {
    // Missing or invalid state
    if (!lease.tenantState || lease.tenantState.length !== 2) {
      issues.push({
        id: `tenant-data-${lease.tenantId}-state`,
        severity: "WARNING",
        category: "TENANT_DATA",
        message: `Missing or invalid state code for tenant: ${lease.tenantName}`,
        leaseId: lease.leaseId,
        tenantId: lease.tenantId,
        locationId: lease.locationId,
        metadata: {
          tenantName: lease.tenantName,
          state: lease.tenantState || "null",
        },
      });
    }
    
    // Missing boat size for wet/lift slips
    if ((lease.storageType === "Wet Slip" || lease.storageType === "Lift Slip") && 
        !lease.boatSize) {
      issues.push({
        id: `tenant-data-${lease.tenantId}-boatsize`,
        severity: "WARNING",
        category: "TENANT_DATA",
        message: `Missing boat size for ${lease.storageType} tenant: ${lease.tenantName}`,
        leaseId: lease.leaseId,
        tenantId: lease.tenantId,
        locationId: lease.locationId,
        metadata: {
          tenantName: lease.tenantName,
          storageType: lease.storageType,
        },
      });
    }
  }
  
  // CHECK 5: OVERLAPPING_LEASES - Same tenant with overlapping periods
  const tenantLeaseMap = new Map<string, typeof allLeases>();
  for (const lease of allLeases) {
    if (!tenantLeaseMap.has(lease.tenantId)) {
      tenantLeaseMap.set(lease.tenantId, []);
    }
    tenantLeaseMap.get(lease.tenantId)!.push(lease);
  }
  
  for (const [tenantId, tenantLeases] of tenantLeaseMap) {
    if (tenantLeases.length < 2) continue;
    
    for (let i = 0; i < tenantLeases.length; i++) {
      for (let j = i + 1; j < tenantLeases.length; j++) {
        const lease1 = tenantLeases[i];
        const lease2 = tenantLeases[j];
        
        // Only check same storage type
        if (lease1.storageType !== lease2.storageType) continue;
        
        const start1 = new Date(lease1.leaseCommencement);
        const end1 = lease1.leaseExpiration ? new Date(lease1.leaseExpiration) : new Date(2099, 11, 31);
        const start2 = new Date(lease2.leaseCommencement);
        const end2 = lease2.leaseExpiration ? new Date(lease2.leaseExpiration) : new Date(2099, 11, 31);
        
        // Check for overlap
        if (start1 <= end2 && start2 <= end1) {
          issues.push({
            id: `overlapping-${lease1.leaseId}-${lease2.leaseId}`,
            severity: "WARNING",
            category: "OVERLAPPING_LEASES",
            message: `Overlapping ${lease1.storageType} leases for ${lease1.tenantName}`,
            leaseId: lease1.leaseId,
            tenantId,
            locationId: lease1.locationId,
            metadata: {
              tenantName: lease1.tenantName,
              lease1Start: lease1.leaseCommencement,
              lease1End: lease1.leaseExpiration || "ongoing",
              lease2Start: lease2.leaseCommencement,
              lease2End: lease2.leaseExpiration || "ongoing",
            },
          });
        }
      }
    }
  }
  
  // Compute summary counts
  const countsBySeverity: Record<DataQualitySeverity, number> = {
    "INFO": 0,
    "WARNING": 0,
    "ERROR": 0,
  };
  
  const countsByCategory: Record<string, number> = {
    "LEASE_DATES": 0,
    "COI": 0,
    "LEASE_AMOUNT": 0,
    "TENANT_DATA": 0,
    "OVERLAPPING_LEASES": 0,
    "MISC": 0,
  };
  
  for (const issue of issues) {
    countsBySeverity[issue.severity]++;
    countsByCategory[issue.category]++;
  }
  
  return {
    issues,
    countsBySeverity,
    countsByCategory,
  };
}

// ============================================================================
// FILE IMPORT
// ============================================================================

export interface ParsedFileData {
  headers: string[];
  rows: Record<string, any>[];
  rowCount: number;
}

export interface ColumnMapping {
  fileColumn: string;
  dbField: string;
}

export interface ImportResult {
  success: boolean;
  tenantsCreated: number;
  leasesCreated: number;
  errors: string[];
}

/**
 * Parse uploaded Excel or CSV file
 */
export async function parseUploadedFile(
  fileBuffer: Buffer,
  fileName: string
): Promise<ParsedFileData> {
  const XLSX = await import('xlsx');
  
  let workbook: any;
  
  // Parse based on file type
  if (fileName.endsWith('.csv')) {
    const csvText = fileBuffer.toString('utf-8');
    workbook = XLSX.read(csvText, { type: 'string' });
  } else {
    // Excel file (.xlsx, .xls)
    workbook = XLSX.read(fileBuffer, { type: 'buffer' });
  }
  
  // Get first sheet
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  
  // Convert to JSON
  const jsonData = XLSX.utils.sheet_to_json(sheet, { defval: '' });
  
  if (jsonData.length === 0) {
    throw new Error('File is empty or has no data');
  }
  
  // Extract headers from first row
  const headers = Object.keys(jsonData[0] as Record<string, any>);
  
  return {
    headers,
    rows: jsonData as Record<string, any>[],
    rowCount: jsonData.length,
  };
}

/**
 * Execute import with column mappings
 */
export async function executeImport(
  rows: Record<string, any>[],
  columnMappings: ColumnMapping[]
): Promise<ImportResult> {
  const errors: string[] = [];
  let tenantsCreated = 0;
  let leasesCreated = 0;
  
  // Create mapping lookup
  const mappingLookup = new Map<string, string>();
  for (const mapping of columnMappings) {
    mappingLookup.set(mapping.dbField, mapping.fileColumn);
  }
  
  // Process each row
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 1;
    
    try {
      // Extract tenant data
      const tenantName = row[mappingLookup.get('tenantName') || '']?.toString().trim();
      if (!tenantName) {
        errors.push(`Row ${rowNum}: Missing tenant name`);
        continue;
      }
      
      const boatName = row[mappingLookup.get('boatName') || '']?.toString().trim() || null;
      const boatType = row[mappingLookup.get('boatType') || '']?.toString().trim() || null;
      const boatLoa = row[mappingLookup.get('boatLoa') || '']?.toString().trim() || null;
      const address = row[mappingLookup.get('address') || '']?.toString().trim() || null;
      const city = row[mappingLookup.get('city') || '']?.toString().trim() || null;
      const state = row[mappingLookup.get('state') || '']?.toString().trim() || null;
      const zip = row[mappingLookup.get('zip') || '']?.toString().trim() || null;
      
      // Extract lease data
      const leaseCommencementStr = row[mappingLookup.get('leaseCommencement') || '']?.toString().trim();
      const leaseExpirationStr = row[mappingLookup.get('leaseExpiration') || '']?.toString().trim() || null;
      const leaseAmountStr = row[mappingLookup.get('leaseAmount') || '']?.toString().trim();
      const storageType = row[mappingLookup.get('storageType') || '']?.toString().trim() || 'Wet Slip';
      
      if (!leaseCommencementStr) {
        errors.push(`Row ${rowNum}: Missing lease commencement date`);
        continue;
      }
      
      if (!leaseAmountStr) {
        errors.push(`Row ${rowNum}: Missing lease amount`);
        continue;
      }
      
      // Parse dates
      const leaseCommencement = parseImportDate(leaseCommencementStr);
      const leaseExpiration = leaseExpirationStr ? parseImportDate(leaseExpirationStr) : null;
      
      if (!leaseCommencement) {
        errors.push(`Row ${rowNum}: Invalid lease commencement date: ${leaseCommencementStr}`);
        continue;
      }
      
      // Parse amount
      const leaseAmount = parseFloat(leaseAmountStr.replace(/[^0-9.-]/g, ''));
      if (isNaN(leaseAmount) || leaseAmount <= 0) {
        errors.push(`Row ${rowNum}: Invalid lease amount: ${leaseAmountStr}`);
        continue;
      }
      
      // Create tenant
      const [tenant] = await db.insert(tenants).values({
        name: tenantName,
        boatName,
        boatType,
        boatLoa,
        address,
        city,
        state,
        zip,
      }).returning();
      
      tenantsCreated++;
      
      // Calculate lease fields
      const startDate = new Date(leaseCommencement);
      const endDate = leaseExpiration ? new Date(leaseExpiration) : new Date(2099, 11, 31);
      const leaseKey = buildLeaseKey(tenantName, startDate, leaseExpiration ? endDate : null);
      const numDays = diffInDays(startDate, endDate);
      const numMonths = diffInMonthsInclusive(startDate, endDate);
      const totalContractValue = leaseAmount * numMonths;
      
      // Create lease
      await db.insert(leases).values({
        tenantId: tenant.id,
        leaseCommencement,
        leaseExpiration,
        leaseAmount: leaseAmount.toString(),
        contractTerm: `${numMonths} months`,
        storageType: storageType,
        leaseKey,
        numDays,
        numMonths,
        totalContractValue: totalContractValue.toString(),
      });
      
      leasesCreated++;
      
      // Generate cash flows for the lease
      await generateLeaseCashFlows(tenant.id);
      
    } catch (error: any) {
      errors.push(`Row ${rowNum}: ${error.message}`);
    }
  }
  
  return {
    success: errors.length === 0,
    tenantsCreated,
    leasesCreated,
    errors,
  };
}

/**
 * Parse date from various formats
 */
function parseImportDate(dateStr: string): string | null {
  if (!dateStr) return null;
  
  try {
    // Try ISO format first (YYYY-MM-DD)
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return dateStr;
    }
    
    // Try MM/DD/YYYY
    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dateStr)) {
      const [month, day, year] = dateStr.split('/');
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
    
    // Try Excel serial date number
    const serialDate = parseFloat(dateStr);
    if (!isNaN(serialDate) && serialDate > 40000) {
      // Excel epoch is 1899-12-30
      const excelEpoch = new Date(1899, 11, 30);
      const date = new Date(excelEpoch.getTime() + serialDate * 86400000);
      return format(date, 'yyyy-MM-dd');
    }
    
    // Try parsing with date-fns
    const parsed = parse(dateStr, 'M/d/yyyy', new Date());
    if (parsed && !isNaN(parsed.getTime())) {
      return format(parsed, 'yyyy-MM-dd');
    }
    
    return null;
  } catch {
    return null;
  }
}

// ============================================================================
// STORAGE LOCATIONS SERVICE
// ============================================================================

/**
 * Get all storage locations for a specific project
 */
export async function getStorageLocationsByProject(projectId: string): Promise<StorageLocation[]> {
  return await db
    .select()
    .from(storageLocations)
    .where(eq(storageLocations.projectId, projectId))
    .orderBy(asc(storageLocations.name));
}

/**
 * Get a single storage location by ID
 */
export async function getStorageLocationById(id: string): Promise<StorageLocation | undefined> {
  const results = await db
    .select()
    .from(storageLocations)
    .where(eq(storageLocations.id, id))
    .limit(1);
  
  return results[0];
}

/**
 * Create a new storage location
 */
export async function createStorageLocation(data: InsertStorageLocation): Promise<StorageLocation> {
  const results = await db
    .insert(storageLocations)
    .values(data)
    .returning();
  
  return results[0];
}

/**
 * Update an existing storage location
 */
export async function updateStorageLocation(
  id: string,
  data: Partial<InsertStorageLocation>
): Promise<StorageLocation | undefined> {
  const results = await db
    .update(storageLocations)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(storageLocations.id, id))
    .returning();
  
  return results[0];
}

/**
 * Delete a storage location
 */
export async function deleteStorageLocation(id: string): Promise<boolean> {
  const results = await db
    .delete(storageLocations)
    .where(eq(storageLocations.id, id))
    .returning();
  
  return results.length > 0;
}

// ============================================================================
// PROJECT DETAILS CONFIGURATION FUNCTIONS
// ============================================================================

/**
 * Get project details configuration for a specific project
 * Returns default configuration if none exists
 */
export async function getProjectDetailsConfig(projectId: string) {
  const config = await db.query.projectDetailsConfig.findFirst({
    where: eq(projectDetailsConfig.projectId, projectId),
  });
  
  // Return default configuration if none exists
  if (!config) {
    return {
      projectId,
      enabledStorageTypes: [], // Start with all unchecked
      enabledRateTypes: [], // Start with all unchecked
      enabledContractTerms: [], // Start with all unchecked
      enabledSlipStatuses: ['Occupied', 'Vacant', 'Unusable', 'Liveaboard', 'Service', 'Sales', 'Occupied; Not-Paying', 'Small Boat/Dinghy', 'Commercial', 'Rental Boat', 'Boat Club', 'Transient'], // All checked by default
    };
  }
  
  return config;
}

/**
 * Create or update project details configuration
 */
export async function upsertProjectDetailsConfig(
  projectId: string,
  data: {
    enabledStorageTypes?: string[];
    dualSeasonStorageTypes?: string[];
    enabledRateTypes?: string[];
    enabledContractTerms?: string[];
    enabledSlipStatuses?: string[];
  }
) {
  // Check if configuration already exists
  const existing = await db.query.projectDetailsConfig.findFirst({
    where: eq(projectDetailsConfig.projectId, projectId),
  });
  
  if (existing) {
    // Update existing configuration
    const results = await db
      .update(projectDetailsConfig)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(projectDetailsConfig.projectId, projectId))
      .returning();
    
    return results[0];
  } else {
    // Create new configuration
    const results = await db
      .insert(projectDetailsConfig)
      .values({
        projectId,
        ...data,
      })
      .returning();
    
    return results[0];
  }
}

// ============================================================================
// MOVE EVENTS DRILL-DOWN
// ============================================================================

export type MoveEventType = "move-in" | "move-out";

export interface MoveEventLeaseDetail {
  leaseId: string;
  tenantName: string;
  boatSize: string | null;
  boatDimensions: string | null;
  contractTerm: string | null;
  rateType: string | null;
  leaseAmount: string;
  storageType: string | null;
  unitLocation: string | null;
  unitNumber: string | null;
  leaseCommencement: string;
  leaseExpiration: string | null;
  projectName: string | null;
}

export interface MoveEventsByStorageLocation {
  storageLocation: string;
  count: number;
  leases: MoveEventLeaseDetail[];
}

export interface MoveEventsByStorageType {
  storageType: string;
  count: number;
  locations: MoveEventsByStorageLocation[];
}

export interface MoveEventsDetailResponse {
  eventType: MoveEventType;
  totalCount: number;
  storageTypes: MoveEventsByStorageType[];
}

/**
 * Get detailed move events drill-down data
 * Groups by storage type, then by storage location, with individual lease details
 */
export async function getMoveEventsDetail(
  eventType: MoveEventType,
  startDate: string,
  endDate: string,
  filterOptions?: KpiFilterOptions
): Promise<MoveEventsDetailResponse> {
  // Determine which date column to filter on
  const dateColumn = eventType === "move-in" ? leases.leaseCommencement : leases.leaseExpiration;
  
  // Build the where clause with project filter conditions
  const projectFilter = buildProjectFilterConditions(marinaLocations, filterOptions);
  const whereConditions = [
    gte(dateColumn, startDate),
    lte(dateColumn, endDate),
    projectFilter, // Uses includeInExecutive + organization scoping
  ];
  
  // For move-outs, ensure leaseExpiration is not null
  if (eventType === "move-out") {
    whereConditions.push(sql`${leases.leaseExpiration} IS NOT NULL`);
  }
  
  // Fetch leases with tenant and project information
  const results = await db
    .select({
      leaseId: leases.id,
      tenantName: tenants.name,
      boatSize: tenants.boatSize,
      boatLength: tenants.boatLength,
      boatWidth: tenants.boatWidth,
      boatDimensions: leases.boatDimensions,
      contractTerm: leases.contractTerm,
      rateType: leases.rateType,
      leaseAmount: leases.leaseAmount,
      storageType: leases.storageType,
      unitLocation: leases.unitLocation,
      unitNumber: leases.unitNumber,
      leaseCommencement: leases.leaseCommencement,
      leaseExpiration: leases.leaseExpiration,
      projectName: marinaLocations.name,
      projectType: marinaLocations.projectType,
    })
    .from(leases)
    .innerJoin(tenants, eq(leases.tenantId, tenants.id))
    .leftJoin(marinaLocations, eq(leases.locationId, marinaLocations.id))
    .where(and(...whereConditions));
  
  // Note: includeInExecutive filtering happens at the database level via whereConditions
  // This keeps both OWNED and DEAL projects that are marked for executive dashboard
  const filteredResults = results;
  
  // Group by storage type, then by storage location
  const storageTypeMap = new Map<string, Map<string, MoveEventLeaseDetail[]>>();
  
  for (const row of filteredResults) {
    const storageType = row.storageType || "Unknown";
    const storageLocation = row.unitLocation || "Unassigned";
    
    // Format boat size - prefer boatDimensions, fallback to calculated from length/width
    let boatSizeDisplay: string | null = row.boatDimensions;
    if (!boatSizeDisplay && row.boatLength) {
      const width = row.boatWidth ? ` x ${row.boatWidth}'` : "";
      boatSizeDisplay = `${row.boatLength}'${width}`;
    }
    
    const leaseDetail: MoveEventLeaseDetail = {
      leaseId: row.leaseId,
      tenantName: row.tenantName,
      boatSize: boatSizeDisplay,
      boatDimensions: row.boatDimensions,
      contractTerm: row.contractTerm,
      rateType: row.rateType,
      leaseAmount: row.leaseAmount,
      storageType: row.storageType,
      unitLocation: row.unitLocation,
      unitNumber: row.unitNumber,
      leaseCommencement: row.leaseCommencement,
      leaseExpiration: row.leaseExpiration,
      projectName: row.projectName,
    };
    
    if (!storageTypeMap.has(storageType)) {
      storageTypeMap.set(storageType, new Map());
    }
    
    const locationMap = storageTypeMap.get(storageType)!;
    if (!locationMap.has(storageLocation)) {
      locationMap.set(storageLocation, []);
    }
    
    locationMap.get(storageLocation)!.push(leaseDetail);
  }
  
  // Convert maps to arrays
  const storageTypes: MoveEventsByStorageType[] = [];
  
  for (const [storageType, locationMap] of storageTypeMap.entries()) {
    const locations: MoveEventsByStorageLocation[] = [];
    
    for (const [location, leaseList] of locationMap.entries()) {
      locations.push({
        storageLocation: location,
        count: leaseList.length,
        leases: leaseList,
      });
    }
    
    // Sort locations by count descending
    locations.sort((a, b) => b.count - a.count);
    
    storageTypes.push({
      storageType,
      count: locations.reduce((sum, loc) => sum + loc.count, 0),
      locations,
    });
  }
  
  // Sort storage types by count descending
  storageTypes.sort((a, b) => b.count - a.count);
  
  return {
    eventType,
    totalCount: filteredResults.length,
    storageTypes,
  };
}

// ============================================================================
// EXECUTIVE DASHBOARD DRILL-DOWN FUNCTIONS
// ============================================================================

/**
 * Get revenue breakdown by project for executive dashboard
 */
export async function getRevenueByProject(startDate: string, endDate: string, filterOptions?: KpiFilterOptions) {
  // Build project filter conditions including organization scoping
  const projectFilter = buildProjectFilterConditions(marinaLocations, filterOptions);
  
  // Aggregate revenue and lease counts per project using window functions to prevent inflation
  const results = await db
    .select({
      projectId: marinaLocations.id,
      projectName: marinaLocations.name,
      projectType: marinaLocations.projectType,
      revenue: sql<string>`COALESCE(SUM(CASE WHEN ${periods.periodDate} >= ${startDate} AND ${periods.periodDate} <= ${endDate} THEN ${leaseCashFlows.rentAmount} ELSE 0 END), 0)`,
      leaseCount: sql<number>`COUNT(DISTINCT CASE WHEN ${periods.periodDate} >= ${startDate} AND ${periods.periodDate} <= ${endDate} THEN ${leases.id} ELSE NULL END)`,
    })
    .from(marinaLocations)
    .leftJoin(leases, eq(leases.locationId, marinaLocations.id))
    .leftJoin(leaseCashFlows, eq(leaseCashFlows.leaseId, leases.id))
    .leftJoin(periods, eq(leaseCashFlows.periodId, periods.id))
    .where(projectFilter)
    .groupBy(marinaLocations.id, marinaLocations.name, marinaLocations.projectType);

  // Sort by revenue in JavaScript
  const sorted = results.sort((a, b) => parseFloat(b.revenue) - parseFloat(a.revenue));
  const totalRevenue = sorted.reduce((sum, r) => sum + parseFloat(r.revenue), 0);

  return sorted.map(r => ({
    ...r,
    percentage: totalRevenue > 0 ? (parseFloat(r.revenue) / totalRevenue) * 100 : 0,
  }));
}

/**
 * Get revenue breakdown by month for executive dashboard
 */
export async function getRevenueByMonth(startDate: string, endDate: string, filterOptions?: KpiFilterOptions) {
  // Build project filter conditions including organization scoping
  const projectFilter = buildProjectFilterConditions(marinaLocations, filterOptions);
  
  const results = await db
    .select({
      month: sql<string>`TO_CHAR(${periods.periodDate}, 'FMMonth YYYY')`,
      sortKey: sql<string>`TO_CHAR(${periods.periodDate}, 'YYYY-MM')`,
      revenue: sql<number>`ROUND(COALESCE(SUM(${leaseCashFlows.rentAmount}), 0), 0)`,
      leaseCount: sql<number>`CAST(COUNT(DISTINCT ${leaseCashFlows.leaseId}) AS INTEGER)`,
    })
    .from(leaseCashFlows)
    .innerJoin(leases, eq(leaseCashFlows.leaseId, leases.id))
    .innerJoin(marinaLocations, eq(leases.locationId, marinaLocations.id))
    .innerJoin(periods, eq(leaseCashFlows.periodId, periods.id))
    .where(
      and(
        projectFilter,
        gte(periods.periodDate, startDate),
        lte(periods.periodDate, endDate)
      )
    )
    .groupBy(sql`TO_CHAR(${periods.periodDate}, 'YYYY-MM')`, sql`TO_CHAR(${periods.periodDate}, 'FMMonth YYYY')`)
    .orderBy(sql`TO_CHAR(${periods.periodDate}, 'YYYY-MM')`);

  // Remove sortKey from response
  return results.map(({ sortKey, ...rest }) => rest);
}

/**
 * Get revenue breakdown by month and by project for executive dashboard filtering
 */
export async function getRevenueByMonthByProject(startDate: string, endDate: string, filterOptions?: KpiFilterOptions) {
  // Build project filter conditions including organization scoping
  const projectFilter = buildProjectFilterConditions(marinaLocations, filterOptions);
  
  const results = await db
    .select({
      projectId: marinaLocations.id,
      projectName: marinaLocations.name,
      month: sql<string>`TO_CHAR(${periods.periodDate}, 'FMMonth YYYY')`,
      sortKey: sql<string>`TO_CHAR(${periods.periodDate}, 'YYYY-MM')`,
      revenue: sql<number>`ROUND(COALESCE(SUM(${leaseCashFlows.rentAmount}), 0), 0)`,
      leaseCount: sql<number>`CAST(COUNT(DISTINCT ${leaseCashFlows.leaseId}) AS INTEGER)`,
    })
    .from(marinaLocations)
    .leftJoin(leases, eq(leases.locationId, marinaLocations.id))
    .leftJoin(leaseCashFlows, eq(leaseCashFlows.leaseId, leases.id))
    .leftJoin(periods, eq(leaseCashFlows.periodId, periods.id))
    .where(
      and(
        projectFilter,
        gte(periods.periodDate, startDate),
        lte(periods.periodDate, endDate)
      )
    )
    .groupBy(
      marinaLocations.id,
      marinaLocations.name,
      sql`TO_CHAR(${periods.periodDate}, 'YYYY-MM')`,
      sql`TO_CHAR(${periods.periodDate}, 'FMMonth YYYY')`
    )
    .orderBy(sql`TO_CHAR(${periods.periodDate}, 'YYYY-MM')`);

  // Remove sortKey from response
  return results.map(({ sortKey, ...rest }) => rest);
}

/**
 * Get lease breakdown by project for executive dashboard
 */
export async function getLeasesByProject(options?: KpiFilterOptions) {
  // Get current snapshot of leases grouped by project (not time-bound)
  // This matches the main dashboard KPI which shows current active leases
  
  // Build filter conditions using the same logic as other executive dashboard functions
  const filterConditions = buildProjectFilterConditions(marinaLocations, options);
  
  const results = await db
    .select({
      projectId: marinaLocations.id,
      projectName: marinaLocations.name,
      projectType: marinaLocations.projectType,
      activeLeases: sql<number>`CAST(COALESCE(SUM(CASE WHEN ${leases.isActive} = true AND (${leases.slipStatus} IS NOT NULL AND ${leases.slipStatus} NOT IN ('Vacant', 'Unusable', 'Occupied; Not-Paying')) THEN 1 ELSE 0 END), 0) AS INTEGER)`,
      totalLeases: sql<number>`CAST(COUNT(${leases.id}) AS INTEGER)`,
      vacantSlips: sql<number>`CAST(COALESCE(SUM(CASE WHEN ${leases.slipStatus} = 'Vacant' THEN 1 ELSE 0 END), 0) AS INTEGER)`,
      unusableSlips: sql<number>`CAST(COALESCE(SUM(CASE WHEN ${leases.slipStatus} = 'Unusable' THEN 1 ELSE 0 END), 0) AS INTEGER)`,
      notPayingSlips: sql<number>`CAST(COALESCE(SUM(CASE WHEN ${leases.slipStatus} = 'Occupied; Not-Paying' THEN 1 ELSE 0 END), 0) AS INTEGER)`,
    })
    .from(marinaLocations)
    .leftJoin(leases, eq(leases.locationId, marinaLocations.id))
    .where(filterConditions)
    .groupBy(marinaLocations.id, marinaLocations.name, marinaLocations.projectType);

  // Sort in JavaScript to avoid aggregate duplication in ORDER BY
  return results.sort((a, b) => b.activeLeases - a.activeLeases);
}

/**
 * Get occupancy breakdown by project for executive dashboard
 */
export async function getOccupancyByProject(filterOptions?: KpiFilterOptions) {
  // Build project filter conditions including organization scoping
  const projectFilter = buildProjectFilterConditions(marinaLocations, filterOptions);
  
  // Get current occupancy snapshot grouped by project (not time-bound)
  // This matches the main dashboard KPI which shows current occupancy rate
  const results = await db
    .select({
      projectId: marinaLocations.id,
      projectName: marinaLocations.name,
      projectType: marinaLocations.projectType,
      activeLeases: sql<number>`CAST(COALESCE(SUM(CASE WHEN ${leases.isActive} = true AND (${leases.slipStatus} IS NOT NULL AND ${leases.slipStatus} NOT IN ('Vacant', 'Unusable', 'Occupied; Not-Paying')) THEN 1 ELSE 0 END), 0) AS INTEGER)`,
      totalCapacity: sql<number>`CAST(COALESCE((SELECT SUM(${storageLocations.capacity}) FROM ${storageLocations} WHERE ${storageLocations.projectId} = ${marinaLocations.id} AND ${storageLocations.isActive} = true), 0) AS INTEGER)`,
      activeStorageLocations: sql<number>`CAST(COALESCE((SELECT COUNT(*) FROM ${storageLocations} WHERE ${storageLocations.projectId} = ${marinaLocations.id} AND ${storageLocations.isActive} = true), 0) AS INTEGER)`,
      totalStorageLocations: sql<number>`CAST(COALESCE((SELECT COUNT(*) FROM ${storageLocations} WHERE ${storageLocations.projectId} = ${marinaLocations.id}), 0) AS INTEGER)`,
    })
    .from(marinaLocations)
    .leftJoin(leases, eq(leases.locationId, marinaLocations.id))
    .where(projectFilter)
    .groupBy(marinaLocations.id, marinaLocations.name, marinaLocations.projectType);

  // Sort in JavaScript and calculate occupancy rate
  return results
    .map(r => ({
      ...r,
      occupancyRate: r.totalCapacity > 0 ? (r.activeLeases / r.totalCapacity) * 100 : 0,
    }))
    .sort((a, b) => b.occupancyRate - a.occupancyRate);
}

/**
 * Get storage location occupancy details for a specific project
 */
export async function getStorageLocationsOccupancy(projectId: string) {
  const results = await db
    .select({
      locationId: storageLocations.id,
      locationName: storageLocations.name,
      capacity: storageLocations.capacity,
      isActive: storageLocations.isActive,
      activeLeases: sql<number>`CAST(COALESCE(COUNT(CASE WHEN ${leases.isActive} = true AND (${leases.slipStatus} IS NOT NULL AND ${leases.slipStatus} NOT IN ('Vacant', 'Unusable', 'Occupied; Not-Paying')) THEN 1 END), 0) AS INTEGER)`,
    })
    .from(storageLocations)
    .leftJoin(leases, eq(leases.locationId, storageLocations.id))
    .where(eq(storageLocations.projectId, projectId))
    .groupBy(storageLocations.id, storageLocations.name, storageLocations.capacity, storageLocations.isActive)
    .orderBy(storageLocations.name);

  return results.map(r => ({
    ...r,
    occupancyRate: r.capacity && r.capacity > 0 ? (r.activeLeases / r.capacity) * 100 : 0,
  }));
}

/**
 * Get average lease value breakdown by project for executive dashboard
 * Uses leaseAmount (contract value) to match Total Storage Revenue calculation
 */
export async function getAvgLeaseValueByProject(startDate: string, endDate: string, filterOptions?: KpiFilterOptions) {
  // Build project filter conditions including organization scoping
  const projectFilter = buildProjectFilterConditions(marinaLocations, filterOptions);
  
  // Query leases directly with their contract data (same as totalStorageRevenue calculation)
  const leaseData = await db
    .select({
      projectId: marinaLocations.id,
      projectName: marinaLocations.name,
      projectType: marinaLocations.projectType,
      leaseId: leases.id,
      isActive: leases.isActive,
      slipStatus: leases.slipStatus,
      leaseAmount: leases.leaseAmount,
      rateType: leases.rateType,
      contractTerm: leases.contractTerm,
      numMonths: leases.numMonths,
      leaseCommencement: leases.leaseCommencement,
      leaseExpiration: leases.leaseExpiration,
    })
    .from(marinaLocations)
    .leftJoin(leases, eq(leases.locationId, marinaLocations.id))
    .where(projectFilter);

  // Aggregate by project using the same logic as totalStorageRevenue
  const projectMap = new Map<string, {
    projectName: string;
    projectType: string | null;
    totalRevenue: number;
    activeLeases: number;
    leaseValues: number[];
  }>();

  for (const row of leaseData) {
    if (!projectMap.has(row.projectId)) {
      projectMap.set(row.projectId, {
        projectName: row.projectName,
        projectType: row.projectType,
        totalRevenue: 0,
        activeLeases: 0,
        leaseValues: [],
      });
    }
    
    const stats = projectMap.get(row.projectId)!;
    
    // Skip if no lease (from LEFT JOIN)
    if (!row.leaseId) continue;
    
    const baseRent = row.leaseAmount ? parseFloat(row.leaseAmount) : 0;
    
    // Calculate lease value using same logic as totalStorageRevenue
    let leaseValue = 0;
    if (isSeasonalOrAnnualRateType(row.rateType)) {
      leaseValue = baseRent;
    } else {
      const effectiveMonths = calculateEffectiveNumMonths(
        row.contractTerm,
        row.numMonths,
        row.leaseCommencement,
        row.leaseExpiration
      );
      leaseValue = baseRent * effectiveMonths;
    }
    
    stats.totalRevenue += leaseValue;
    
    // Count as active if isActive=true and slipStatus is valid
    const validSlipStatuses = row.slipStatus && 
      !['Vacant', 'Unusable', 'Occupied; Not-Paying'].includes(row.slipStatus);
    if (row.isActive && validSlipStatuses) {
      stats.activeLeases += 1;
      if (leaseValue > 0) {
        stats.leaseValues.push(leaseValue);
      }
    }
  }

  // Convert to result array
  const results = Array.from(projectMap.entries()).map(([projectId, stats]) => ({
    projectId,
    projectName: stats.projectName,
    projectType: stats.projectType,
    totalRevenue: stats.totalRevenue.toFixed(2),
    activeLeases: stats.activeLeases,
    minLeaseValue: stats.leaseValues.length > 0 ? Math.min(...stats.leaseValues).toFixed(2) : "0",
    maxLeaseValue: stats.leaseValues.length > 0 ? Math.max(...stats.leaseValues).toFixed(2) : "0",
    avgLeaseValue: stats.activeLeases > 0 
      ? (stats.totalRevenue / stats.activeLeases).toFixed(2)
      : "0",
  }));

  // Sort by total revenue descending
  results.sort((a, b) => parseFloat(b.totalRevenue) - parseFloat(a.totalRevenue));

  return results;
}

/**
 * Get average lease value breakdown by storage type for executive dashboard
 * Uses leaseAmount (contract value) to match Total Storage Revenue calculation
 */
export async function getAvgLeaseValueByStorageType(startDate: string, endDate: string, filterOptions?: KpiFilterOptions) {
  // Build project filter conditions including organization scoping
  const projectFilter = buildProjectFilterConditions(marinaLocations, filterOptions);
  
  // Query leases directly with their contract data (same as totalStorageRevenue calculation)
  const leaseData = await db
    .select({
      leaseId: leases.id,
      storageType: leases.storageType,
      isActive: leases.isActive,
      slipStatus: leases.slipStatus,
      leaseAmount: leases.leaseAmount,
      rateType: leases.rateType,
      contractTerm: leases.contractTerm,
      numMonths: leases.numMonths,
      leaseCommencement: leases.leaseCommencement,
      leaseExpiration: leases.leaseExpiration,
    })
    .from(marinaLocations)
    .innerJoin(leases, eq(leases.locationId, marinaLocations.id))
    .where(projectFilter);

  // Aggregate by storage type using the same logic as totalStorageRevenue
  const storageTypeMap = new Map<string, {
    totalRevenue: number;
    activeLeases: number;
    leaseValues: number[];
  }>();

  for (const lease of leaseData) {
    const storageType = lease.storageType || "Unassigned";
    const baseRent = lease.leaseAmount ? parseFloat(lease.leaseAmount) : 0;
    
    // Calculate lease value using same logic as totalStorageRevenue
    let leaseValue = 0;
    if (isSeasonalOrAnnualRateType(lease.rateType)) {
      leaseValue = baseRent;
    } else {
      const effectiveMonths = calculateEffectiveNumMonths(
        lease.contractTerm,
        lease.numMonths,
        lease.leaseCommencement,
        lease.leaseExpiration
      );
      leaseValue = baseRent * effectiveMonths;
    }
    
    if (!storageTypeMap.has(storageType)) {
      storageTypeMap.set(storageType, {
        totalRevenue: 0,
        activeLeases: 0,
        leaseValues: [],
      });
    }
    
    const stats = storageTypeMap.get(storageType)!;
    stats.totalRevenue += leaseValue;
    
    // Count as active if isActive=true and slipStatus is valid
    const validSlipStatuses = lease.slipStatus && 
      !['Vacant', 'Unusable', 'Occupied; Not-Paying'].includes(lease.slipStatus);
    if (lease.isActive && validSlipStatuses) {
      stats.activeLeases += 1;
      if (leaseValue > 0) {
        stats.leaseValues.push(leaseValue);
      }
    }
  }

  // Convert to result array
  const results = Array.from(storageTypeMap.entries()).map(([storageType, stats]) => ({
    storageType,
    totalRevenue: stats.totalRevenue.toFixed(2),
    activeLeases: stats.activeLeases,
    minLeaseValue: stats.leaseValues.length > 0 ? Math.min(...stats.leaseValues).toFixed(2) : "0",
    maxLeaseValue: stats.leaseValues.length > 0 ? Math.max(...stats.leaseValues).toFixed(2) : "0",
    avgLeaseValue: stats.activeLeases > 0 
      ? (stats.totalRevenue / stats.activeLeases).toFixed(2)
      : "0",
  }));

  // Sort by total revenue descending
  results.sort((a, b) => parseFloat(b.totalRevenue) - parseFloat(a.totalRevenue));

  return results;
}

/**
 * Get average lease value breakdown by storage type for a specific project
 * Uses leaseAmount (contract value) to match Total Storage Revenue calculation
 * Supports optional filtering by contract term and storage type to sync with unified KPI filters
 */
export async function getProjectAvgLeaseValueByStorageType(
  projectId: string, 
  startDate: string, 
  endDate: string,
  options?: {
    contractTermFilter?: string; // "overall" | "annual" | "seasonal" | "winter" | "shortTerm"
    storageTypeFilter?: string;  // "all" or specific storage type
  }
) {
  // Query leases directly with their contract data (same as totalStorageRevenue calculation)
  const leaseData = await db
    .select({
      leaseId: leases.id,
      storageType: leases.storageType,
      isActive: leases.isActive,
      slipStatus: leases.slipStatus,
      leaseAmount: leases.leaseAmount,
      rateType: leases.rateType,
      contractTerm: leases.contractTerm,
      numMonths: leases.numMonths,
      leaseCommencement: leases.leaseCommencement,
      leaseExpiration: leases.leaseExpiration,
    })
    .from(leases)
    .where(eq(leases.locationId, projectId));

  // Helper to check if a lease matches the contract term filter
  const matchesContractTermFilter = (leaseContractTerm: string | null): boolean => {
    if (!options?.contractTermFilter || options.contractTermFilter === "overall") {
      return true;
    }
    
    const term = (leaseContractTerm || "").toLowerCase();
    switch (options.contractTermFilter) {
      case "annual":
        return term === "annual";
      case "seasonal":
        return term === "seasonal" || term === "summer";
      case "winter":
        return term === "winter";
      case "shortTerm":
        return term === "short-term" || term === "short term" || term === "shortterm";
      default:
        return true;
    }
  };

  // Helper to check if a rate type is seasonal or annual
  const isSeasonalOrAnnualRateType = (rateType: string | null | undefined): boolean => {
    if (!rateType) return false;
    const rt = rateType.toLowerCase();
    return rt.includes('/season') || rt.includes('/yr') || rt.includes('season') || rt.includes('annual') || rt.includes('year');
  };

  // Helper to calculate effective number of months for a lease
  const calculateEffectiveNumMonths = (
    contractTerm: string | null,
    numMonths: number | null,
    leaseCommencement: string | null,
    leaseExpiration: string | null
  ): number => {
    if (numMonths && numMonths > 0) return numMonths;
    const term = (contractTerm || "").toLowerCase();
    if (term === "annual") return 12;
    if (term === "seasonal" || term === "summer") return 6;
    if (term === "winter") return 6;
    return 12; // default to 12 months
  };

  // Aggregate by storage type using the same logic as totalStorageRevenue
  const storageTypeMap = new Map<string, {
    totalRevenue: number;
    activeLeases: number;
    leaseValues: number[];
  }>();

  for (const lease of leaseData) {
    const storageType = lease.storageType || "Unassigned";
    
    // Apply storage type filter
    if (options?.storageTypeFilter && options.storageTypeFilter !== "all") {
      if (storageType !== options.storageTypeFilter) {
        continue;
      }
    }
    
    // Apply contract term filter
    if (!matchesContractTermFilter(lease.contractTerm)) {
      continue;
    }
    
    const baseRent = lease.leaseAmount ? parseFloat(lease.leaseAmount) : 0;
    
    // Calculate lease value using same logic as totalStorageRevenue
    let leaseValue = 0;
    if (isSeasonalOrAnnualRateType(lease.rateType)) {
      leaseValue = baseRent;
    } else {
      const effectiveMonths = calculateEffectiveNumMonths(
        lease.contractTerm,
        lease.numMonths,
        lease.leaseCommencement,
        lease.leaseExpiration
      );
      leaseValue = baseRent * effectiveMonths;
    }
    
    if (!storageTypeMap.has(storageType)) {
      storageTypeMap.set(storageType, {
        totalRevenue: 0,
        activeLeases: 0,
        leaseValues: [],
      });
    }
    
    const stats = storageTypeMap.get(storageType)!;
    stats.totalRevenue += leaseValue;
    
    // Count as active if isActive=true and slipStatus is valid
    const validSlipStatuses = lease.slipStatus && 
      !['Vacant', 'Unusable', 'Occupied; Not-Paying'].includes(lease.slipStatus);
    if (lease.isActive && validSlipStatuses) {
      stats.activeLeases += 1;
      if (leaseValue > 0) {
        stats.leaseValues.push(leaseValue);
      }
    }
  }

  // Convert to result array
  const results = Array.from(storageTypeMap.entries()).map(([storageType, stats]) => ({
    storageType,
    totalRevenue: stats.totalRevenue.toFixed(2),
    activeLeases: stats.activeLeases,
    minLeaseValue: stats.leaseValues.length > 0 ? Math.min(...stats.leaseValues).toFixed(2) : "0",
    maxLeaseValue: stats.leaseValues.length > 0 ? Math.max(...stats.leaseValues).toFixed(2) : "0",
    avgLeaseValue: stats.activeLeases > 0 
      ? (stats.totalRevenue / stats.activeLeases).toFixed(2)
      : "0",
  }));

  // Sort by total revenue descending
  results.sort((a, b) => parseFloat(b.totalRevenue) - parseFloat(a.totalRevenue));

  return results;
}

// ============================================================================
// PROJECT-SCOPED ANALYTICS (LOCATION OVERVIEW)
// ============================================================================

export interface ProjectKPIs {
  totalRevenue: string;
  totalStorageRevenue: string;
  activeLeases: number;
  occupancyRate: number;
  avgLeaseValue: string;
  totalCapacity: number;
  totalLeaseAmount: string;
  hasLeases: boolean;
  hasCapacity: boolean;
  hasDates: boolean;
  // New fields for data quality indicators
  totalLeaseCount: number;
  leasesWithDefaultDates: number;
  leasesWithCashFlows: number;
}

/**
 * Get project KPIs for a specific location and date range
 */
export async function getProjectKPIs(
  locationId: string,
  startDate: string,
  endDate: string
): Promise<ProjectKPIs> {
  // Parse start/end dates to extract year/month for filtering cash flows
  const startParsed = new Date(startDate);
  const endParsed = new Date(endDate);
  const startYear = startParsed.getFullYear();
  const startMonth = startParsed.getMonth() + 1;
  const endYear = endParsed.getFullYear();
  const endMonth = endParsed.getMonth() + 1;
  
  const [revenueData, leaseData, cashFlowLeaseData, capacityData, configData, storageRevenueData] = await Promise.all([
    // Query revenue from cash flows using year/month columns (RRA schema)
    // Use YYYYMM range predicate for precise date filtering
    db
      .select({
        totalRevenue: sql<string>`CAST(COALESCE(SUM(${leaseCashFlows.amount}), 0) AS NUMERIC(12,2))`,
      })
      .from(leaseCashFlows)
      .innerJoin(leases, eq(leaseCashFlows.leaseId, leases.id))
      .where(
        and(
          eq(leases.locationId, locationId),
          sql`(${leaseCashFlows.year} * 100 + ${leaseCashFlows.month}) >= ${startYear * 100 + startMonth}`,
          sql`(${leaseCashFlows.year} * 100 + ${leaseCashFlows.month}) <= ${endYear * 100 + endMonth}`
        )
      ),
    
    // Count leases: active, total, with dates, with default dates
    // totalLeaseAmount includes only active leases OR leases with default dates (contributing to cash flows)
    db
      .select({
        activeLeases: sql<number>`CAST(COUNT(CASE WHEN ${leases.isActive} = true THEN 1 END) AS INTEGER)`,
        totalLeaseAmount: sql<string>`CAST(COALESCE(SUM(CASE WHEN ${leases.isActive} = true OR ${leases.usesDefaultDates} = true THEN ${leases.leaseAmount} ELSE 0 END), 0) AS NUMERIC(12,2))`,
        leasesWithDates: sql<number>`CAST(COUNT(CASE WHEN ${leases.leaseCommencement} IS NOT NULL THEN 1 END) AS INTEGER)`,
        totalLeaseCount: sql<number>`CAST(COUNT(*) AS INTEGER)`,
        leasesWithDefaultDates: sql<number>`CAST(COUNT(CASE WHEN ${leases.usesDefaultDates} = true THEN 1 END) AS INTEGER)`,
      })
      .from(leases)
      .where(eq(leases.locationId, locationId)),
    
    // Count leases that have cash flows (used to determine if data exists)
    db
      .select({
        leasesWithCashFlows: sql<number>`CAST(COUNT(DISTINCT ${leaseCashFlows.leaseId}) AS INTEGER)`,
      })
      .from(leaseCashFlows)
      .innerJoin(leases, eq(leaseCashFlows.leaseId, leases.id))
      .where(
        and(
          eq(leases.locationId, locationId),
          sql`(${leaseCashFlows.year} * 100 + ${leaseCashFlows.month}) >= ${startYear * 100 + startMonth} AND (${leaseCashFlows.year} * 100 + ${leaseCashFlows.month}) <= ${endYear * 100 + endMonth}`
        )
      ),
    
    db
      .select({
        totalCapacity: sql<number>`CAST(COALESCE(SUM(${storageLocations.capacity}), 0) AS INTEGER)`,
      })
      .from(storageLocations)
      .where(
        and(
          eq(storageLocations.projectId, locationId),
          eq(storageLocations.isActive, true)
        )
      ),
      
    // Check marina_locations for capacity field (legacy support)
    db
      .select({
        marinaCapacity: marinaLocations.capacity,
      })
      .from(marinaLocations)
      .where(eq(marinaLocations.id, locationId)),
    
    // Fetch all active leases to calculate Total Storage Revenue
    // Using rate type semantics: for seasonal/annual, leaseAmount is total; for monthly, multiply by numMonths
    // Include contractTerm and dates to calculate effective numMonths like frontend does
    db
      .select({
        leaseAmount: leases.leaseAmount,
        rateType: leases.rateType,
        numMonths: leases.numMonths,
        contractTerm: leases.contractTerm,
        leaseCommencement: leases.leaseCommencement,
        leaseExpiration: leases.leaseExpiration,
      })
      .from(leases)
      .where(
        and(
          eq(leases.locationId, locationId),
          eq(leases.isActive, true)
        )
      ),
  ]);

  const totalRevenueNum = parseFloat(revenueData[0]?.totalRevenue || "0");
  const activeLeases = leaseData[0]?.activeLeases || 0;
  const totalLeaseAmountNum = parseFloat(leaseData[0]?.totalLeaseAmount || "0");
  const leasesWithDates = leaseData[0]?.leasesWithDates || 0;
  const totalLeaseCount = leaseData[0]?.totalLeaseCount || 0;
  const leasesWithDefaultDates = leaseData[0]?.leasesWithDefaultDates || 0;
  const leasesWithCashFlows = cashFlowLeaseData[0]?.leasesWithCashFlows || 0;
  
  // Calculate Total Storage Revenue using rate type semantics
  // Mirrors frontend calculateTotalValue() and calculateEffectiveNumMonths() logic
  
  // Check if contract term indicates annual contract
  const isAnnualContract = (contractTerm: string | null): boolean => {
    if (!contractTerm) return false;
    const term = contractTerm.toLowerCase();
    return term === 'annual' || term === 'yearly' || term === '12 month' || term === '12 months';
  };
  
  // Calculate effective number of months based on contract term and lease dates
  // Mirrors frontend calculateEffectiveNumMonths() exactly
  const calculateEffectiveNumMonths = (
    contractTerm: string | null,
    numMonths: number | null,
    leaseCommencement: string | null,
    leaseExpiration: string | null
  ): number => {
    // Annual contracts always use 12 months
    if (isAnnualContract(contractTerm)) {
      return 12;
    }
    
    // Use stored numMonths if valid
    if (numMonths && numMonths > 0) {
      return numMonths;
    }
    
    // Calculate from lease dates if available
    if (leaseCommencement && leaseExpiration) {
      const start = new Date(leaseCommencement);
      const end = new Date(leaseExpiration);
      const yearDiff = end.getFullYear() - start.getFullYear();
      const monthDiff = end.getMonth() - start.getMonth();
      let months = yearDiff * 12 + monthDiff;
      if (end.getDate() >= start.getDate()) {
        months += 1;
      }
      return Math.max(1, months);
    }
    
    // Default to 6 months for seasonal contract terms if no data available
    const term = (contractTerm || '').toLowerCase();
    if (term.includes('summer') || term.includes('winter') || term.includes('seasonal')) {
      return 6;
    }
    
    // For leases with no date/term info, default to 1 month for display purposes
    // This ensures lease amounts show up in KPIs rather than being zeroed out
    return 1;
  };
  
  // For seasonal/annual rates: leaseAmount is already the total storage revenue
  // For monthly rates: leaseAmount × numMonths = total storage revenue
  const isSeasonalOrAnnualRateType = (rateType: string | null | undefined): boolean => {
    if (!rateType) return false;
    const rt = rateType.toLowerCase();
    return rt.includes('/season') || rt.includes('/yr') || rt.includes('/year') || 
           rt.includes('per season') || rt.includes('per year') || rt === 'annual' ||
           rt.includes('$/ft/season') || rt.includes('$/ft/yr');
  };
  
  let totalStorageRevenueNum = 0;
  for (const lease of storageRevenueData) {
    const baseRent = lease.leaseAmount ? parseFloat(lease.leaseAmount) : 0;
    
    // Check if rate type indicates seasonal/annual (mirrors frontend exactly)
    // isSeasonalOrAnnualRateType checks rateType only, not contractTerm
    if (isSeasonalOrAnnualRateType(lease.rateType)) {
      // For seasonal/annual rate types, leaseAmount IS the total storage revenue
      totalStorageRevenueNum += baseRent;
    } else {
      // For monthly/unknown rate types, multiply by effective numMonths to get total
      // If effectiveMonths is 0 (unknown contract), this adds 0 to total (matches frontend)
      const effectiveMonths = calculateEffectiveNumMonths(
        lease.contractTerm,
        lease.numMonths,
        lease.leaseCommencement,
        lease.leaseExpiration
      );
      totalStorageRevenueNum += baseRent * effectiveMonths;
    }
  }
  
  // Use storage_locations capacity first, fall back to marina_locations.capacity
  const storageCapacity = capacityData[0]?.totalCapacity || 0;
  const marinaCapacity = configData[0]?.marinaCapacity || 0;
  const totalCapacity = storageCapacity > 0 ? storageCapacity : marinaCapacity;

  // For display purposes, use leasesWithCashFlows as active count if no traditional active leases
  // This handles incomplete leases that have revenue but aren't marked isActive
  const displayActiveLeases = activeLeases > 0 ? activeLeases : leasesWithCashFlows;
  
  const occupancyRate = totalCapacity > 0 ? (displayActiveLeases / totalCapacity) * 100 : 0;
  
  // Calculate avg lease value using same rate type semantics as totalStorageRevenue
  // This gives a proper weighted average of individual lease values
  // Use displayActiveLeases as denominator when available (handles incomplete lease data)
  // Fall back to storageRevenueData.length if displayActiveLeases is 0
  const activeLeaseCount = displayActiveLeases > 0 ? displayActiveLeases : storageRevenueData.length;
  const avgLeaseValueNum = activeLeaseCount > 0 
    ? totalStorageRevenueNum / activeLeaseCount
    : 0;

  return {
    totalRevenue: totalRevenueNum.toFixed(2),
    totalStorageRevenue: totalStorageRevenueNum.toFixed(2),
    activeLeases: displayActiveLeases,
    occupancyRate: Math.round(occupancyRate * 10) / 10,
    avgLeaseValue: avgLeaseValueNum.toFixed(2),
    totalCapacity,
    totalLeaseAmount: totalLeaseAmountNum.toFixed(2),
    // hasLeases is true if there are any leases with cash flows OR any leases at all with amounts
    hasLeases: leasesWithCashFlows > 0 || totalLeaseCount > 0,
    hasCapacity: totalCapacity > 0,
    hasDates: leasesWithDates > 0,
    // New data quality indicators
    totalLeaseCount,
    leasesWithDefaultDates,
    leasesWithCashFlows,
  };
}

export interface ProjectMoveEvents {
  moveIns: number;
  moveOuts: number;
  netChange: number;
  avgVesselSize: number | null;
}

/**
 * Get move events (move-ins, move-outs, net change) for a specific location and date range
 */
export async function getProjectMoveEvents(
  locationId: string,
  startDate: string,
  endDate: string
): Promise<ProjectMoveEvents> {
  const [moveEventData] = await db
    .select({
      moveIns: sql<number>`CAST(COUNT(CASE WHEN ${leases.leaseCommencement} >= ${startDate} AND ${leases.leaseCommencement} <= ${endDate} THEN 1 END) AS INTEGER)`,
      moveOuts: sql<number>`CAST(COUNT(CASE WHEN ${leases.leaseExpiration} >= ${startDate} AND ${leases.leaseExpiration} <= ${endDate} AND ${leases.leaseExpiration} IS NOT NULL THEN 1 END) AS INTEGER)`,
    })
    .from(leases)
    .where(eq(leases.locationId, locationId));

  // Calculate average vessel size from all tenants with boatLength data for this location's leases
  const [vesselData] = await db
    .select({
      avgLoa: sql<number>`AVG(${tenants.boatLength})`,
    })
    .from(leases)
    .innerJoin(tenants, eq(leases.tenantId, tenants.id))
    .where(
      and(
        eq(leases.locationId, locationId),
        isNotNull(tenants.boatLength)
      )
    );

  const moveIns = moveEventData?.moveIns || 0;
  const moveOuts = moveEventData?.moveOuts || 0;
  const avgVesselSize = vesselData?.avgLoa ? Math.round(vesselData.avgLoa * 10) / 10 : null;

  return {
    moveIns,
    moveOuts,
    netChange: moveIns - moveOuts,
    avgVesselSize,
  };
}

export interface ProjectMoveEventLeaseDetail {
  id: string;
  customerName: string;
  vesselName: string | null;
  loa: number | null;
  leaseAmount: string | null;
  unitLocation: string | null;
  storageType: string | null;
  contractTerm: string | null;
  eventDate: string;
}

/**
 * Get detailed list of move-in or move-out leases for drill-down
 */
export async function getProjectMoveEventLeases(
  locationId: string,
  startDate: string,
  endDate: string,
  eventType: "move-in" | "move-out"
): Promise<ProjectMoveEventLeaseDetail[]> {
  const dateField = eventType === "move-in" ? leases.leaseCommencement : leases.leaseExpiration;
  
  const results = await db
    .select({
      id: leases.id,
      boatDimensions: leases.boatDimensions,
      leaseAmount: leases.leaseAmount,
      unitLocation: leases.unitLocation,
      storageType: leases.storageType,
      contractTerm: leases.contractTerm,
      eventDate: dateField,
      tenantName: tenants.name,
      boatLength: tenants.boatLength,
    })
    .from(leases)
    .leftJoin(tenants, eq(leases.tenantId, tenants.id))
    .where(
      and(
        eq(leases.locationId, locationId),
        gte(dateField, startDate),
        lte(dateField, endDate),
        eventType === "move-out" ? isNotNull(leases.leaseExpiration) : sql`1=1`
      )
    )
    .orderBy(asc(leases.storageType), asc(dateField));

  return results.map(r => ({
    id: r.id,
    customerName: r.tenantName || "Unknown",
    vesselName: r.boatDimensions,
    loa: r.boatLength ? parseFloat(r.boatLength.toString()) : null,
    leaseAmount: r.leaseAmount,
    unitLocation: r.unitLocation,
    storageType: r.storageType,
    contractTerm: r.contractTerm,
    eventDate: r.eventDate || "",
  }));
}

export interface ProjectRevenueTrendDataPoint {
  month: string;
  revenue: string;
  leaseCount: number;
}

/**
 * Get monthly revenue trend for a specific location and date range
 */
export async function getProjectRevenueTrend(
  locationId: string,
  startDate: string,
  endDate: string
): Promise<ProjectRevenueTrendDataPoint[]> {
  const results = await db
    .select({
      periodDate: periods.periodDate,
      periodLabel: periods.label,
      revenue: sql<string>`CAST(COALESCE(SUM(${leaseCashFlows.rentAmount}), 0) AS NUMERIC(12,2))`,
      leaseCount: sql<number>`CAST(COUNT(DISTINCT ${leaseCashFlows.leaseId}) AS INTEGER)`,
    })
    .from(periods)
    .leftJoin(
      leaseCashFlows,
      eq(leaseCashFlows.periodId, periods.id)
    )
    .leftJoin(leases, eq(leaseCashFlows.leaseId, leases.id))
    .where(
      and(
        gte(periods.periodDate, startDate),
        lte(periods.periodDate, endDate),
        or(
          sql`${leaseCashFlows.id} IS NULL`,
          eq(leases.locationId, locationId)
        )
      )
    )
    .groupBy(periods.id, periods.periodDate, periods.label)
    .orderBy(asc(periods.periodDate));

  return results.map(r => ({
    month: r.periodLabel,
    revenue: parseFloat(r.revenue || "0").toFixed(2),
    leaseCount: r.leaseCount || 0,
  }));
}

export interface ProjectRevenueByStorage {
  storageType: string;
  revenue: string;
  leaseCount: number;
  percentage: number;
}

/**
 * Get revenue distribution by storage type for a specific location and date range
 */
export async function getProjectRevenueByStorage(
  locationId: string,
  startDate: string,
  endDate: string
): Promise<ProjectRevenueByStorage[]> {
  const results = await db
    .select({
      storageType: leases.storageType,
      totalRevenue: sql<string>`CAST(COALESCE(SUM(${leaseCashFlows.rentAmount}), 0) AS NUMERIC(12,2))`,
      leaseCount: sql<number>`CAST(COUNT(DISTINCT ${leases.id}) AS INTEGER)`,
    })
    .from(leaseCashFlows)
    .innerJoin(leases, eq(leaseCashFlows.leaseId, leases.id))
    .innerJoin(periods, eq(leaseCashFlows.periodId, periods.id))
    .where(
      and(
        eq(leases.locationId, locationId),
        gte(periods.periodDate, startDate),
        lte(periods.periodDate, endDate)
      )
    )
    .groupBy(leases.storageType)
    .orderBy(desc(sql<string>`CAST(COALESCE(SUM(${leaseCashFlows.rentAmount}), 0) AS NUMERIC(12,2))`));

  const total = results.reduce((sum, r) => sum + parseFloat(r.totalRevenue || "0"), 0);

  return results.map(r => {
    const revenue = parseFloat(r.totalRevenue || "0");
    return {
      storageType: r.storageType || "Unknown",
      revenue: revenue.toFixed(2),
      leaseCount: r.leaseCount || 0,
      percentage: total > 0 ? (revenue / total) * 100 : 0,
    };
  });
}

// ============================================================================
// POSTED RATE & POTENTIAL REVENUE CALCULATIONS
// ============================================================================

/**
 * Get average boat length per storage location (for per-foot rate calculations)
 * Includes ALL active leases with valid boat length data (not just paying tenants)
 * Falls back to a reasonable default (30 ft) when no boat length data is available
 */
export async function getAverageBoatLengthByStorageLocation(projectId: string): Promise<Map<string, number>> {
  const DEFAULT_BOAT_LENGTH = 30; // Default boat length when no data available
  
  const results = await db
    .select({
      storageLocationId: leases.storageLocationId,
      avgBoatLength: sql<string>`CAST(AVG(CASE WHEN ${tenants.boatSize} IS NOT NULL AND ${tenants.boatSize}::numeric > 0 THEN ${tenants.boatSize}::numeric ELSE NULL END) AS NUMERIC(10,2))`,
      count: sql<number>`CAST(COUNT(CASE WHEN ${tenants.boatSize} IS NOT NULL AND ${tenants.boatSize}::numeric > 0 THEN 1 ELSE NULL END) AS INTEGER)`,
    })
    .from(leases)
    .innerJoin(tenants, eq(leases.tenantId, tenants.id))
    .where(
      and(
        eq(leases.locationId, projectId),
        eq(leases.isActive, true),
        isNotNull(leases.storageLocationId)
      )
    )
    .groupBy(leases.storageLocationId);

  const avgLengthMap = new Map<string, number>();
  for (const row of results) {
    if (row.storageLocationId) {
      // Use actual average if available, otherwise use default
      const avgLength = row.avgBoatLength ? parseFloat(row.avgBoatLength) : DEFAULT_BOAT_LENGTH;
      avgLengthMap.set(row.storageLocationId, avgLength > 0 ? avgLength : DEFAULT_BOAT_LENGTH);
    }
  }
  return avgLengthMap;
}

export interface StorageLocationRevenue {
  storageLocationId: string;
  storageLocationName: string;
  storageType: string | null;
  capacity: number | null;
  occupiedCount: number;
  postedRate: number | null;
  postedRateType: string | null;
  avgBoatLength: number | null;
  potentialMonthlyRevenue: number;
  actualMonthlyRevenue: number;
  economicVacancy: number;
  occupancyVacancy: number;
  discountAmount: number;
}

/**
 * Calculate potential revenue vs actual revenue per storage location
 * Handles different rate types (per month, per foot/month, per season, per foot/season, per year)
 * Economic Vacancy = Potential Revenue - Actual Revenue
 */
export async function getStorageLocationRevenueAnalysis(
  projectId: string,
  startDate: string,
  endDate: string
): Promise<StorageLocationRevenue[]> {
  // Get all storage locations for this project
  const storageLocationsList = await db
    .select()
    .from(storageLocations)
    .where(eq(storageLocations.projectId, projectId));

  // Get average boat length per storage location
  const avgBoatLengthMap = await getAverageBoatLengthByStorageLocation(projectId);

  // Get actual revenue per storage location for the date range
  const actualRevenueData = await db
    .select({
      storageLocationId: leases.storageLocationId,
      totalRevenue: sql<string>`CAST(COALESCE(SUM(${leaseCashFlows.rentAmount}), 0) AS NUMERIC(12,2))`,
      occupiedCount: sql<number>`CAST(COUNT(DISTINCT ${leases.id}) AS INTEGER)`,
    })
    .from(leaseCashFlows)
    .innerJoin(leases, eq(leaseCashFlows.leaseId, leases.id))
    .innerJoin(periods, eq(leaseCashFlows.periodId, periods.id))
    .where(
      and(
        eq(leases.locationId, projectId),
        eq(leases.isActive, true),
        isNotNull(leases.storageLocationId),
        gte(periods.periodDate, startDate),
        lte(periods.periodDate, endDate)
      )
    )
    .groupBy(leases.storageLocationId);

  // Create a map of actual revenue by storage location ID
  const actualRevenueMap = new Map<string, { revenue: number; occupiedCount: number }>();
  for (const row of actualRevenueData) {
    if (row.storageLocationId) {
      actualRevenueMap.set(row.storageLocationId, {
        revenue: parseFloat(row.totalRevenue || "0"),
        occupiedCount: row.occupiedCount || 0,
      });
    }
  }

  // Calculate number of months in the date range
  const start = new Date(startDate + "T12:00:00");
  const end = new Date(endDate + "T12:00:00");
  const monthsInRange = Math.max(1, (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()) + 1);

  const results: StorageLocationRevenue[] = [];

  for (const loc of storageLocationsList) {
    const postedRate = loc.postedRate ? parseFloat(loc.postedRate) : null;
    const rateType = loc.postedRateType;
    const capacity = loc.capacity;
    const avgBoatLength = avgBoatLengthMap.get(loc.id) || null;
    const actualData = actualRevenueMap.get(loc.id) || { revenue: 0, occupiedCount: 0 };

    let potentialMonthlyRevenue = 0;

    // Only calculate potential revenue if we have both posted rate and capacity
    if (postedRate !== null && postedRate > 0 && capacity !== null && capacity > 0) {
      // Calculate monthly rate based on rate type
      // Default boat length for per-foot calculations
      const DEFAULT_BOAT_LENGTH = 30;
      let monthlyRate = 0;
      
      // Normalize rate type - handle common variations
      const normalizedRateType = (rateType || "Per Month").toLowerCase().trim();
      
      if (normalizedRateType.includes("foot") && normalizedRateType.includes("month")) {
        // Per Foot/Month, $/ft./mo., Per ft/mo, etc.
        const lengthForCalc = avgBoatLength || DEFAULT_BOAT_LENGTH;
        monthlyRate = postedRate * lengthForCalc;
      } else if (normalizedRateType.includes("foot") && normalizedRateType.includes("season")) {
        // Per Foot/Season - assume 6-month season
        const lengthForCalc = avgBoatLength || DEFAULT_BOAT_LENGTH;
        monthlyRate = (postedRate * lengthForCalc) / 6;
      } else if (normalizedRateType.includes("foot") && normalizedRateType.includes("year")) {
        // Per Foot/Year
        const lengthForCalc = avgBoatLength || DEFAULT_BOAT_LENGTH;
        monthlyRate = (postedRate * lengthForCalc) / 12;
      } else if (normalizedRateType.includes("season")) {
        // Per Season - assume 6-month season
        monthlyRate = postedRate / 6;
      } else if (normalizedRateType.includes("year") || normalizedRateType.includes("annual")) {
        // Per Year, Annual
        monthlyRate = postedRate / 12;
      } else if (normalizedRateType.includes("flat") || normalizedRateType.includes("fixed")) {
        // Flat Fee - treat as monthly
        monthlyRate = postedRate;
      } else if (normalizedRateType.includes("sf") || normalizedRateType.includes("sq")) {
        // Square foot rate - need slip dimensions, approximate with default
        // For now, treat as monthly flat rate (requires slip size data for accuracy)
        monthlyRate = postedRate;
      } else {
        // Default: Per Month, Monthly, $/mo., etc.
        monthlyRate = postedRate;
      }

      // Potential revenue = monthly rate × capacity × number of months
      potentialMonthlyRevenue = monthlyRate * capacity * monthsInRange;
    }

    const economicVacancy = Math.max(0, potentialMonthlyRevenue - actualData.revenue);
    const occupancyVacancy = capacity ? Math.max(0, capacity - actualData.occupiedCount) : 0;
    const discountAmount = economicVacancy; // Simplified - actual calculation would factor in lease discounts

    results.push({
      storageLocationId: loc.id,
      storageLocationName: loc.name,
      storageType: loc.storageType,
      capacity: capacity,
      occupiedCount: actualData.occupiedCount,
      postedRate: postedRate,
      postedRateType: rateType,
      avgBoatLength: avgBoatLength,
      potentialMonthlyRevenue: potentialMonthlyRevenue,
      actualMonthlyRevenue: actualData.revenue,
      economicVacancy: economicVacancy,
      occupancyVacancy: occupancyVacancy,
      discountAmount: discountAmount,
    });
  }

  return results;
}

export interface EconomicVacancyMetrics {
  totalPotentialRevenue: number;
  totalActualRevenue: number;
  totalEconomicVacancy: number;
  economicVacancyPercentage: number;
  occupancyVacancy: number;
  totalCapacity: number;
  totalOccupied: number;
  byStorageLocation: StorageLocationRevenue[];
}

/**
 * Get aggregated economic vacancy metrics for a project
 */
export async function getEconomicVacancyMetrics(
  projectId: string,
  startDate: string,
  endDate: string
): Promise<EconomicVacancyMetrics> {
  const byStorageLocation = await getStorageLocationRevenueAnalysis(projectId, startDate, endDate);

  let totalPotentialRevenue = 0;
  let totalActualRevenue = 0;
  let totalCapacity = 0;
  let totalOccupied = 0;

  for (const loc of byStorageLocation) {
    totalPotentialRevenue += loc.potentialMonthlyRevenue;
    totalActualRevenue += loc.actualMonthlyRevenue;
    totalCapacity += loc.capacity || 0;
    totalOccupied += loc.occupiedCount;
  }

  const totalEconomicVacancy = Math.max(0, totalPotentialRevenue - totalActualRevenue);
  const economicVacancyPercentage = totalPotentialRevenue > 0 
    ? (totalEconomicVacancy / totalPotentialRevenue) * 100 
    : 0;
  const occupancyVacancy = Math.max(0, totalCapacity - totalOccupied);

  return {
    totalPotentialRevenue,
    totalActualRevenue,
    totalEconomicVacancy,
    economicVacancyPercentage,
    occupancyVacancy,
    totalCapacity,
    totalOccupied,
    byStorageLocation,
  };
}

// ============================================================================
// LEASE LINE ITEMS CRUD OPERATIONS
// ============================================================================

/**
 * Get all line items for a lease
 */
export async function getLeaseLineItems(leaseId: string): Promise<LeaseLineItem[]> {
  const items = await db
    .select()
    .from(leaseLineItems)
    .where(eq(leaseLineItems.leaseId, leaseId))
    .orderBy(asc(leaseLineItems.lineType));
  return items;
}

/**
 * Get a single line item by ID
 */
export async function getLeaseLineItemById(id: string): Promise<LeaseLineItem | null> {
  const [item] = await db
    .select()
    .from(leaseLineItems)
    .where(eq(leaseLineItems.id, id));
  return item || null;
}

/**
 * Create a new line item for a lease
 */
export async function createLeaseLineItem(data: InsertLeaseLineItem): Promise<LeaseLineItem> {
  const [item] = await db
    .insert(leaseLineItems)
    .values(data)
    .returning();
  return item;
}

/**
 * Create multiple line items for a lease (bulk import)
 */
export async function createLeaseLineItemsBulk(items: InsertLeaseLineItem[]): Promise<LeaseLineItem[]> {
  if (items.length === 0) return [];
  const created = await db
    .insert(leaseLineItems)
    .values(items)
    .returning();
  return created;
}

/**
 * Update a line item
 */
export async function updateLeaseLineItem(
  id: string, 
  data: Partial<InsertLeaseLineItem>
): Promise<LeaseLineItem | null> {
  const [updated] = await db
    .update(leaseLineItems)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(leaseLineItems.id, id))
    .returning();
  return updated || null;
}

/**
 * Delete a line item
 */
export async function deleteLeaseLineItem(id: string): Promise<boolean> {
  const result = await db
    .delete(leaseLineItems)
    .where(eq(leaseLineItems.id, id));
  return result.rowCount ? result.rowCount > 0 : false;
}

/**
 * Delete all line items for a lease
 */
export async function deleteLeaseLineItemsByLeaseId(leaseId: string): Promise<number> {
  const result = await db
    .delete(leaseLineItems)
    .where(eq(leaseLineItems.leaseId, leaseId));
  return result.rowCount || 0;
}

/**
 * Get total revenue from line items for a lease
 */
export async function getLeaseLineItemsTotal(leaseId: string): Promise<number> {
  const items = await getLeaseLineItems(leaseId);
  return items.reduce((sum, item) => sum + parseFloat(item.amount || "0"), 0);
}

/**
 * Get all line items for multiple leases (for batch loading)
 */
export async function getLineItemsForLeases(leaseIds: string[]): Promise<Map<string, LeaseLineItem[]>> {
  if (leaseIds.length === 0) return new Map();
  
  const items = await db
    .select()
    .from(leaseLineItems)
    .where(inArray(leaseLineItems.leaseId, leaseIds))
    .orderBy(asc(leaseLineItems.lineType));
  
  const map = new Map<string, LeaseLineItem[]>();
  for (const item of items) {
    const existing = map.get(item.leaseId) || [];
    existing.push(item);
    map.set(item.leaseId, existing);
  }
  return map;
}

// ============================================================================
// SEASONAL OCCUPANCY SERVICE
// ============================================================================

export type SeasonType = "summer" | "winter" | "annual";

export interface SeasonDateRange {
  start: Date;
  end: Date;
  seasonType: SeasonType;
  days: number;
}

export interface SeasonCalendar {
  year: number;
  summer: SeasonDateRange;
  winter: SeasonDateRange; // Note: winter may span two calendar years
  totalDays: number;
}

export interface OccupancySpan {
  leaseId: string;
  tenantId: string;
  tenantName: string;
  slipAssignment: string | null;
  seasonType: SeasonType;
  amount: number;
  startDate: Date;
  endDate: Date;
  days: number;
  lineItemId?: string;
  lineItemType?: string;
}

export interface SeasonalOccupancyMetrics {
  summerOccupancy: number; // Unique slips occupied in summer
  winterOccupancy: number; // Unique slips occupied in winter
  annualOccupancy: number; // Slips occupied year-round
  totalCapacity: number;
  summerOccupancyRate: number; // Percentage
  winterOccupancyRate: number; // Percentage
  overallOccupancyRate: number; // Blended slip-days weighted percentage
  summerSlips: string[]; // List of slip assignments for summer
  winterSlips: string[]; // List of slip assignments for winter
  annualSlips: string[]; // List of slip assignments for annual
  summerRevenue: number;
  winterRevenue: number;
  annualRevenue: number;
  totalRevenue: number;
  overlappingSlips: SlipOverlapWarning[];
}

export interface SlipOverlapWarning {
  slipAssignment: string;
  seasonType: SeasonType;
  leases: { leaseId: string; tenantName: string; dateRange: string }[];
}

/**
 * Parse MM/DD date string and return a Date for a given year
 */
function parseSeasonDate(mmdd: string | null, year: number, defaultMonth: number, defaultDay: number): Date {
  if (!mmdd) {
    return new Date(year, defaultMonth - 1, defaultDay);
  }
  const parts = mmdd.split("/");
  if (parts.length !== 2) {
    return new Date(year, defaultMonth - 1, defaultDay);
  }
  const month = parseInt(parts[0], 10);
  const day = parseInt(parts[1], 10);
  if (isNaN(month) || isNaN(day)) {
    return new Date(year, defaultMonth - 1, defaultDay);
  }
  return new Date(year, month - 1, day);
}

/**
 * Build a SeasonCalendar for a project/year based on configured season dates
 */
export function buildSeasonCalendar(
  seasonStartDate: string | null,
  seasonEndDate: string | null,
  winterStartDate: string | null,
  winterEndDate: string | null,
  year: number
): SeasonCalendar {
  // Default season dates if not configured:
  // Summer: May 1 - October 31
  // Winter: November 1 - April 30 (spans year boundary)
  
  const summerStart = parseSeasonDate(seasonStartDate, year, 5, 1); // May 1
  const summerEnd = parseSeasonDate(seasonEndDate, year, 10, 31); // October 31
  
  // Winter spans year boundary - starts in current year, ends in next year
  const winterStart = parseSeasonDate(winterStartDate, year, 11, 1); // November 1
  const winterEnd = parseSeasonDate(winterEndDate, year + 1, 4, 30); // April 30 of next year
  
  const summerDays = differenceInDays(summerEnd, summerStart) + 1;
  const winterDays = differenceInDays(winterEnd, winterStart) + 1;

  return {
    year,
    summer: {
      start: summerStart,
      end: summerEnd,
      seasonType: "summer",
      days: summerDays,
    },
    winter: {
      start: winterStart,
      end: winterEnd,
      seasonType: "winter",
      days: winterDays,
    },
    totalDays: summerDays + winterDays,
  };
}

/**
 * Determine which season type a line item belongs to based on its type
 */
function getSeasonTypeFromLineItem(lineType: string): SeasonType {
  switch (lineType) {
    case "winter_slip":
      return "winter";
    case "summer_slip":
    case "seasonal_slip":
      return "summer";
    case "annual_slip":
      return "annual";
    default:
      return "annual"; // Non-slip items like liveaboard, electric default to annual
  }
}

/**
 * Check if a line item type represents a slip (affects occupancy)
 */
function isSlipLineItem(lineType: string): boolean {
  return ["winter_slip", "summer_slip", "seasonal_slip", "annual_slip"].includes(lineType);
}

/**
 * Normalize leases and line items into OccupancySpan records
 */
export async function buildOccupancySpans(
  projectId: string,
  calendar: SeasonCalendar
): Promise<OccupancySpan[]> {
  // Get all leases for this project with their tenants and line items
  const projectLeases = await db.query.rraLeases.findMany({
    where: eq(leases.locationId, projectId),
    with: {
      tenant: true,
    },
  });

  const leaseIds = projectLeases.map(l => l.id);
  const lineItemsMap = await getLineItemsForLeases(leaseIds);
  
  const spans: OccupancySpan[] = [];
  
  for (const lease of projectLeases) {
    const leaseLineItemsList = lineItemsMap.get(lease.id) || [];
    
    // If lease has line items, use them for seasonal occupancy
    if (leaseLineItemsList.length > 0) {
      for (const item of leaseLineItemsList) {
        // Only count slip-related line items for occupancy
        if (!isSlipLineItem(item.lineType)) continue;
        
        const seasonType = getSeasonTypeFromLineItem(item.lineType);
        
        // Determine date range - use line item dates if available, else use lease dates
        let startDate: Date;
        let endDate: Date;
        
        if (item.startDate && item.endDate) {
          startDate = new Date(item.startDate);
          endDate = new Date(item.endDate);
        } else if (seasonType === "summer") {
          startDate = calendar.summer.start;
          endDate = calendar.summer.end;
        } else if (seasonType === "winter") {
          startDate = calendar.winter.start;
          endDate = calendar.winter.end;
        } else {
          // Annual - use full year or lease dates
          startDate = lease.leaseCommencement ? new Date(lease.leaseCommencement) : calendar.summer.start;
          endDate = lease.leaseExpiration ? new Date(lease.leaseExpiration) : calendar.winter.end;
        }
        
        spans.push({
          leaseId: lease.id,
          tenantId: lease.tenantId,
          tenantName: lease.tenant?.name || "Unknown",
          slipAssignment: item.slipAssignment || lease.unitNumber,
          seasonType,
          amount: parseFloat(item.amount || "0"),
          startDate,
          endDate,
          days: differenceInDays(endDate, startDate) + 1,
          lineItemId: item.id,
          lineItemType: item.lineType,
        });
      }
    } else {
      // No line items - use the lease itself
      // Determine season based on lease dates or default to annual
      const leaseStart = lease.leaseCommencement ? new Date(lease.leaseCommencement) : null;
      const leaseEnd = lease.leaseExpiration ? new Date(lease.leaseExpiration) : null;
      
      if (!leaseStart) continue; // Skip leases without dates
      
      // Determine if this is a summer-only, winter-only, or annual lease based on dates
      let seasonType: SeasonType = "annual";
      const leaseAmount = parseFloat(lease.leaseAmount || "0");
      
      // Check if lease dates roughly match summer or winter season
      if (leaseEnd) {
        const leaseDays = differenceInDays(leaseEnd, leaseStart) + 1;
        // If lease is ~6 months or less, try to categorize by season
        if (leaseDays <= 200) {
          const summerOverlap = getDateOverlapDays(leaseStart, leaseEnd, calendar.summer.start, calendar.summer.end);
          const winterOverlap = getDateOverlapDays(leaseStart, leaseEnd, calendar.winter.start, calendar.winter.end);
          
          if (summerOverlap > winterOverlap && summerOverlap > leaseDays * 0.7) {
            seasonType = "summer";
          } else if (winterOverlap > summerOverlap && winterOverlap > leaseDays * 0.7) {
            seasonType = "winter";
          }
        }
      }
      
      spans.push({
        leaseId: lease.id,
        tenantId: lease.tenantId,
        tenantName: lease.tenant?.name || "Unknown",
        slipAssignment: lease.unitNumber,
        seasonType,
        amount: leaseAmount,
        startDate: leaseStart,
        endDate: leaseEnd || calendar.winter.end,
        days: leaseEnd ? differenceInDays(leaseEnd, leaseStart) + 1 : calendar.totalDays,
      });
    }
  }
  
  return spans;
}

/**
 * Calculate days of overlap between two date ranges
 */
function getDateOverlapDays(start1: Date, end1: Date, start2: Date, end2: Date): number {
  const overlapStart = start1 > start2 ? start1 : start2;
  const overlapEnd = end1 < end2 ? end1 : end2;
  
  if (overlapStart > overlapEnd) return 0;
  return differenceInDays(overlapEnd, overlapStart) + 1;
}

/**
 * Detect overlapping slip assignments within the same season
 */
function detectSlipOverlaps(spans: OccupancySpan[]): SlipOverlapWarning[] {
  const warnings: SlipOverlapWarning[] = [];
  
  // Group spans by slip assignment and season
  const slipSeasonGroups = new Map<string, OccupancySpan[]>();
  
  for (const span of spans) {
    if (!span.slipAssignment) continue;
    
    const key = `${span.slipAssignment}|${span.seasonType}`;
    const existing = slipSeasonGroups.get(key) || [];
    existing.push(span);
    slipSeasonGroups.set(key, existing);
  }
  
  // Check for overlaps within each group
  const entries = Array.from(slipSeasonGroups.entries());
  for (const [key, groupSpans] of entries) {
    if (groupSpans.length <= 1) continue;
    
    // For now, any multiple assignments to same slip in same season is a warning
    // More sophisticated overlap detection could check actual date ranges
    const [slipAssignment, seasonType] = key.split("|");
    
    warnings.push({
      slipAssignment,
      seasonType: seasonType as SeasonType,
      leases: groupSpans.map((s: OccupancySpan) => ({
        leaseId: s.leaseId,
        tenantName: s.tenantName,
        dateRange: `${format(s.startDate, "MMM d")} - ${format(s.endDate, "MMM d, yyyy")}`,
      })),
    });
  }
  
  return warnings;
}

/**
 * Calculate seasonal occupancy metrics for a project
 */
export async function getSeasonalOccupancyMetrics(
  projectId: string,
  year: number
): Promise<SeasonalOccupancyMetrics> {
  // Get project season configuration
  const project = await db.query.rraMarinaLocations.findFirst({
    where: eq(marinaLocations.id, projectId),
  });
  
  if (!project) {
    throw new Error("Project not found");
  }
  
  // Build season calendar
  const calendar = buildSeasonCalendar(
    project.seasonStartDate,
    project.seasonEndDate,
    project.winterStartDate,
    project.winterEndDate,
    year
  );
  
  // Get all occupancy spans
  const spans = await buildOccupancySpans(projectId, calendar);
  
  // Collect unique slips by season
  const summerSlips = new Set<string>();
  const winterSlips = new Set<string>();
  const annualSlips = new Set<string>();
  
  let summerRevenue = 0;
  let winterRevenue = 0;
  let annualRevenue = 0;
  
  for (const span of spans) {
    const slip = span.slipAssignment?.trim();
    
    if (span.seasonType === "summer") {
      if (slip) summerSlips.add(slip);
      summerRevenue += span.amount;
    } else if (span.seasonType === "winter") {
      if (slip) winterSlips.add(slip);
      winterRevenue += span.amount;
    } else if (span.seasonType === "annual") {
      // Annual counts toward both seasons
      if (slip) {
        summerSlips.add(slip);
        winterSlips.add(slip);
        annualSlips.add(slip);
      }
      annualRevenue += span.amount;
    }
  }
  
  const totalCapacity = project.capacity || 0;
  
  // Calculate occupancy rates
  const summerOccupancy = summerSlips.size;
  const winterOccupancy = winterSlips.size;
  const annualOccupancy = annualSlips.size;
  
  const summerOccupancyRate = totalCapacity > 0 ? (summerOccupancy / totalCapacity) * 100 : 0;
  const winterOccupancyRate = totalCapacity > 0 ? (winterOccupancy / totalCapacity) * 100 : 0;
  
  // Blended overall occupancy: weighted by days in each season
  // Overall = (summer_slips * summer_days + winter_slips * winter_days) / (capacity * total_days)
  const summerSlipDays = summerOccupancy * calendar.summer.days;
  const winterSlipDays = winterOccupancy * calendar.winter.days;
  const totalSlipDays = summerSlipDays + winterSlipDays;
  const totalCapacityDays = totalCapacity * calendar.totalDays;
  
  const overallOccupancyRate = totalCapacityDays > 0 ? (totalSlipDays / totalCapacityDays) * 100 : 0;
  
  // Detect overlapping slips
  const overlappingSlips = detectSlipOverlaps(spans);
  
  return {
    summerOccupancy,
    winterOccupancy,
    annualOccupancy,
    totalCapacity,
    summerOccupancyRate: Math.round(summerOccupancyRate * 10) / 10,
    winterOccupancyRate: Math.round(winterOccupancyRate * 10) / 10,
    overallOccupancyRate: Math.round(overallOccupancyRate * 10) / 10,
    summerSlips: Array.from(summerSlips),
    winterSlips: Array.from(winterSlips),
    annualSlips: Array.from(annualSlips),
    summerRevenue,
    winterRevenue,
    annualRevenue,
    totalRevenue: summerRevenue + winterRevenue + annualRevenue,
    overlappingSlips,
  };
}

/**
 * Seasonal Move Events Metrics
 */
export interface SeasonalMoveEventsMetrics {
  summerMoveIns: number;
  summerMoveOuts: number;
  summerNetChange: number;
  winterMoveIns: number;
  winterMoveOuts: number;
  winterNetChange: number;
  annualMoveIns: number;
  annualMoveOuts: number;
  annualNetChange: number;
  overallMoveIns: number;
  overallMoveOuts: number;
  overallNetChange: number;
}

/**
 * Calculate seasonal move events for a project
 * Move-ins are counted in the season when leaseCommencement falls
 * Move-outs are counted in the season when leaseExpiration falls
 */
export async function getSeasonalMoveEvents(
  projectId: string,
  year: number
): Promise<SeasonalMoveEventsMetrics> {
  // Get project season configuration
  const project = await db.query.rraMarinaLocations.findFirst({
    where: eq(marinaLocations.id, projectId),
  });
  
  if (!project) {
    throw new Error("Project not found");
  }
  
  // Build season calendar
  const calendar = buildSeasonCalendar(
    project.seasonStartDate,
    project.seasonEndDate,
    project.winterStartDate,
    project.winterEndDate,
    year
  );
  
  // Get all leases for this project
  const projectLeases = await db.query.rraLeases.findMany({
    where: eq(leases.locationId, projectId),
  });
  
  // Initialize counters
  let summerMoveIns = 0, summerMoveOuts = 0;
  let winterMoveIns = 0, winterMoveOuts = 0;
  let annualMoveIns = 0, annualMoveOuts = 0;
  
  for (const lease of projectLeases) {
    // Check move-in (lease commencement)
    if (lease.leaseCommencement) {
      const commenceDate = new Date(lease.leaseCommencement);
      const commenceYear = commenceDate.getFullYear();
      
      // Only count if in the target year
      if (commenceYear === year) {
        // Determine which season
        if (commenceDate >= calendar.summer.start && commenceDate <= calendar.summer.end) {
          summerMoveIns++;
        } else if (commenceDate >= calendar.winter.start && commenceDate <= calendar.winter.end) {
          winterMoveIns++;
        } else {
          // Fall between seasons - count as annual
          annualMoveIns++;
        }
      }
    }
    
    // Check move-out (lease expiration)
    if (lease.leaseExpiration) {
      const expireDate = new Date(lease.leaseExpiration);
      const expireYear = expireDate.getFullYear();
      
      // Only count if in the target year
      if (expireYear === year) {
        if (expireDate >= calendar.summer.start && expireDate <= calendar.summer.end) {
          summerMoveOuts++;
        } else if (expireDate >= calendar.winter.start && expireDate <= calendar.winter.end) {
          winterMoveOuts++;
        } else {
          annualMoveOuts++;
        }
      }
    }
  }
  
  return {
    summerMoveIns,
    summerMoveOuts,
    summerNetChange: summerMoveIns - summerMoveOuts,
    winterMoveIns,
    winterMoveOuts,
    winterNetChange: winterMoveIns - winterMoveOuts,
    annualMoveIns,
    annualMoveOuts,
    annualNetChange: annualMoveIns - annualMoveOuts,
    overallMoveIns: summerMoveIns + winterMoveIns + annualMoveIns,
    overallMoveOuts: summerMoveOuts + winterMoveOuts + annualMoveOuts,
    overallNetChange: (summerMoveIns + winterMoveIns + annualMoveIns) - (summerMoveOuts + winterMoveOuts + annualMoveOuts),
  };
}

/**
 * Seasonal Revenue Metrics
 */
export interface SeasonalRevenueMetrics {
  summerRevenue: number;
  winterRevenue: number;
  annualRevenue: number;
  overallRevenue: number;
}

/**
 * Calculate seasonal revenue for a project using lease line items
 */
export async function getSeasonalRevenue(
  projectId: string,
  year: number
): Promise<SeasonalRevenueMetrics> {
  // Get project season configuration  
  const project = await db.query.rraMarinaLocations.findFirst({
    where: eq(marinaLocations.id, projectId),
  });
  
  if (!project) {
    throw new Error("Project not found");
  }
  
  // Build season calendar
  const calendar = buildSeasonCalendar(
    project.seasonStartDate,
    project.seasonEndDate,
    project.winterStartDate,
    project.winterEndDate,
    year
  );
  
  // Get all occupancy spans (includes revenue data)
  const spans = await buildOccupancySpans(projectId, calendar);
  
  let summerRevenue = 0;
  let winterRevenue = 0;
  let annualRevenue = 0;
  
  for (const span of spans) {
    if (span.seasonType === "summer") {
      summerRevenue += span.amount;
    } else if (span.seasonType === "winter") {
      winterRevenue += span.amount;
    } else if (span.seasonType === "annual") {
      // Annual revenue contributes to overall
      annualRevenue += span.amount;
    }
  }
  
  return {
    summerRevenue,
    winterRevenue,
    annualRevenue,
    overallRevenue: summerRevenue + winterRevenue + annualRevenue,
  };
}

/**
 * Unified Seasonal Metrics combining occupancy, move events, and revenue
 */
export interface UnifiedSeasonalMetrics {
  occupancy: SeasonalOccupancyMetrics;
  moveEvents: SeasonalMoveEventsMetrics;
  revenue: SeasonalRevenueMetrics;
  seasonDates: {
    summer: { start: string; end: string };
    winter: { start: string; end: string };
  };
}

/**
 * Get all seasonal metrics for a project in a single call
 */
export async function getUnifiedSeasonalMetrics(
  projectId: string,
  year: number
): Promise<UnifiedSeasonalMetrics> {
  const [occupancy, moveEvents, revenue] = await Promise.all([
    getSeasonalOccupancyMetrics(projectId, year),
    getSeasonalMoveEvents(projectId, year),
    getSeasonalRevenue(projectId, year),
  ]);
  
  // Get project for season dates
  const project = await db.query.rraMarinaLocations.findFirst({
    where: eq(marinaLocations.id, projectId),
  });
  
  const calendar = buildSeasonCalendar(
    project?.seasonStartDate,
    project?.seasonEndDate,
    project?.winterStartDate,
    project?.winterEndDate,
    year
  );
  
  return {
    occupancy,
    moveEvents,
    revenue,
    seasonDates: {
      summer: {
        start: format(calendar.summer.start, "MMM d"),
        end: format(calendar.summer.end, "MMM d"),
      },
      winter: {
        start: format(calendar.winter.start, "MMM d"),
        end: format(calendar.winter.end, "MMM d"),
      },
    },
  };
}

/**
 * Executive Dashboard Seasonal Metrics - aggregated across all included projects
 */
export interface ExecutiveSeasonalMoveEvents {
  summerMoveIns: number;
  summerMoveOuts: number;
  summerNetChange: number;
  winterMoveIns: number;
  winterMoveOuts: number;
  winterNetChange: number;
  annualMoveIns: number;
  annualMoveOuts: number;
  annualNetChange: number;
  overallMoveIns: number;
  overallMoveOuts: number;
  overallNetChange: number;
}

/**
 * Get aggregated seasonal move events across all included projects for executive dashboard
 * Uses default season dates (May 1 - Oct 31 summer, Nov 1 - Apr 30 winter) for consistency
 * Filters events within the specified date range
 */
export async function getExecutiveSeasonalMoveEvents(
  orgId: string,
  startDate: string,
  endDate: string,
  filterOptions?: KpiFilterOptions
): Promise<ExecutiveSeasonalMoveEvents> {
  // Parse date range for filtering
  const startDateObj = new Date(startDate);
  const endDateObj = new Date(endDate);
  const year = startDateObj.getFullYear();
  
  // Build default season calendar for executive view (use standard dates)
  const calendar = buildSeasonCalendar(null, null, null, null, year);
  
  // Build project filter conditions with orgId for tenant isolation
  const filterCondition = and(
    eq(marinaLocations.orgId, orgId),
    buildProjectFilterConditions(marinaLocations, filterOptions) || sql`1=1`
  );
  
  // Get all included projects
  const projects = await db.query.rraMarinaLocations.findMany({
    where: filterCondition,
  });
  
  const projectIds = projects.map(p => p.id);
  
  if (projectIds.length === 0) {
    return {
      summerMoveIns: 0, summerMoveOuts: 0, summerNetChange: 0,
      winterMoveIns: 0, winterMoveOuts: 0, winterNetChange: 0,
      annualMoveIns: 0, annualMoveOuts: 0, annualNetChange: 0,
      overallMoveIns: 0, overallMoveOuts: 0, overallNetChange: 0,
    };
  }
  
  // Get all leases from included projects
  const allLeases = await db.query.rraLeases.findMany({
    where: inArray(leases.locationId, projectIds),
  });
  
  // Initialize counters
  let summerMoveIns = 0, summerMoveOuts = 0;
  let winterMoveIns = 0, winterMoveOuts = 0;
  let annualMoveIns = 0, annualMoveOuts = 0;
  
  for (const lease of allLeases) {
    // Check move-in (lease commencement) within the date range
    if (lease.leaseCommencement) {
      const commenceDate = new Date(lease.leaseCommencement);
      
      // Only count if within the requested date range
      if (commenceDate >= startDateObj && commenceDate <= endDateObj) {
        if (commenceDate >= calendar.summer.start && commenceDate <= calendar.summer.end) {
          summerMoveIns++;
        } else if (commenceDate >= calendar.winter.start && commenceDate <= calendar.winter.end) {
          winterMoveIns++;
        } else {
          annualMoveIns++;
        }
      }
    }
    
    // Check move-out (lease expiration) within the date range
    if (lease.leaseExpiration) {
      const expireDate = new Date(lease.leaseExpiration);
      
      // Only count if within the requested date range
      if (expireDate >= startDateObj && expireDate <= endDateObj) {
        if (expireDate >= calendar.summer.start && expireDate <= calendar.summer.end) {
          summerMoveOuts++;
        } else if (expireDate >= calendar.winter.start && expireDate <= calendar.winter.end) {
          winterMoveOuts++;
        } else {
          annualMoveOuts++;
        }
      }
    }
  }
  
  return {
    summerMoveIns,
    summerMoveOuts,
    summerNetChange: summerMoveIns - summerMoveOuts,
    winterMoveIns,
    winterMoveOuts,
    winterNetChange: winterMoveIns - winterMoveOuts,
    annualMoveIns,
    annualMoveOuts,
    annualNetChange: annualMoveIns - annualMoveOuts,
    overallMoveIns: summerMoveIns + winterMoveIns + annualMoveIns,
    overallMoveOuts: summerMoveOuts + winterMoveOuts + annualMoveOuts,
    overallNetChange: (summerMoveIns + winterMoveIns + annualMoveIns) - (summerMoveOuts + winterMoveOuts + annualMoveOuts),
  };
}

// ============================================================================
// CONTRACT TERM-BASED OCCUPANCY
// ============================================================================

import {
  CONTRACT_TERM_GROUPS,
  type ContractTermOccupancyCounts,
  type ContractTermOccupancyMetrics,
  type ProjectSeasonType,
  calculateContractTermOccupancy,
} from "@shared/contractTermGroups";

/**
 * Get contract term-based occupancy metrics for a project.
 * 
 * Business logic:
 * - Marinas have fixed capacity (e.g., 150 slips) that can be rented across seasons
 * - A 150-slip marina has 300 "slot-seasons" (summer + winter)
 * - Annual contracts count toward BOTH seasonal and winter occupancy
 * - Seasonal contracts only count for seasonal (summer) occupancy
 * - Winter contracts only count for winter occupancy
 * - Short-term contracts are counted separately
 * 
 * Example for 150-slip marina with 75 Annual, 65 Seasonal, 20 Winter:
 * - Seasonal Occupancy: (65 + 75) / 150 = 93.3%
 * - Winter Occupancy: (20 + 75) / 150 = 63.3%
 * - Annual Only: 75 / 150 = 50%
 * - Overall: (75*2 + 65 + 20) / 300 = 78.3%
 */
export async function getContractTermOccupancy(
  projectId: string,
  storageType?: string
): Promise<ContractTermOccupancyMetrics> {
  // Get project for capacity and seasonType
  const project = await db.query.rraMarinaLocations.findFirst({
    where: eq(marinaLocations.id, projectId),
  });
  
  if (!project) {
    throw new Error("Project not found");
  }
  
  // Get project's season type (default to ANNUAL if not set)
  const projectSeasonType: ProjectSeasonType = (project.seasonType as ProjectSeasonType) || 'ANNUAL';
  
  // Get capacity - use storage_locations for specific type if available,
  // otherwise fall back to project-level capacity
  let capacity = project.capacity || 0;
  
  if (storageType) {
    // Try to get capacity for specific storage type from storage_locations
    const storageLocationData = await db.query.rraStorageLocations.findMany({
      where: and(
        eq(storageLocations.projectId, projectId),
        eq(storageLocations.storageType, storageType)
      ),
    });
    const typeCapacity = storageLocationData.reduce((sum, loc) => sum + (loc.capacity || 0), 0);
    // Only use type-specific capacity if storage_locations are configured for this type
    // Otherwise keep project-level capacity as fallback
    if (typeCapacity > 0) {
      capacity = typeCapacity;
    }
  }
  
  // Build query conditions
  const conditions = [
    eq(leases.locationId, projectId),
    eq(leases.isActive, true),
  ];
  
  if (storageType) {
    conditions.push(eq(leases.storageType, storageType as any));
  }
  
  // Get all active leases for this project with their contract terms
  const projectLeases = await db.query.rraLeases.findMany({
    where: and(...conditions),
    columns: {
      id: true,
      contractTerm: true,
    },
  });
  
  // Count leases by contract term group
  const counts: ContractTermOccupancyCounts = {
    annual: 0,
    seasonal: 0,
    winter: 0,
    shortTerm: 0,
    unclassified: 0,
    total: projectLeases.length,
  };
  
  for (const lease of projectLeases) {
    const contractTerm = lease.contractTerm;
    
    if (!contractTerm) {
      counts.unclassified++;
      continue;
    }
    
    // Check which group this contract term belongs to
    if ((CONTRACT_TERM_GROUPS.ANNUAL as readonly string[]).includes(contractTerm)) {
      counts.annual++;
    } else if ((CONTRACT_TERM_GROUPS.SEASONAL as readonly string[]).includes(contractTerm)) {
      counts.seasonal++;
    } else if ((CONTRACT_TERM_GROUPS.WINTER as readonly string[]).includes(contractTerm)) {
      counts.winter++;
    } else if ((CONTRACT_TERM_GROUPS.SHORT_TERM as readonly string[]).includes(contractTerm)) {
      counts.shortTerm++;
    } else {
      counts.unclassified++;
    }
  }
  
  // Calculate occupancy metrics using shared utility with project's season type
  return calculateContractTermOccupancy(counts, capacity, projectSeasonType);
}

/**
 * Get contract term-based occupancy metrics aggregated across multiple projects (executive level).
 * Supports filtering by project type and specific project IDs.
 * 
 * IMPORTANT: Respects each project's season type for accurate aggregation:
 * - ANNUAL projects: capacity counted once (1 slot-season per slip)
 * - SEASONAL projects: capacity doubled (2 slot-seasons per slip: summer + winter)
 * 
 * This enables mixed portfolios (annual + seasonal) to be aggregated correctly.
 */
export async function getExecutiveContractTermOccupancy(
  orgId: string,
  filterOptions?: { projectType?: string; projectIds?: string[]; storageType?: string }
): Promise<ContractTermOccupancyMetrics> {
  const { projectType, projectIds, storageType } = filterOptions || {};
  
  // Get projects included in executive summary with their season types
  // IMPORTANT: Always filter by orgId for tenant isolation
  const conditions = [
    eq(marinaLocations.orgId, orgId),
    eq(marinaLocations.includeInExecutive, true)
  ];
  
  if (projectType) {
    conditions.push(eq(marinaLocations.projectType, projectType as any));
  }
  
  if (projectIds && projectIds.length > 0) {
    conditions.push(inArray(marinaLocations.id, projectIds));
  }
  
  const projects = await db.query.rraMarinaLocations.findMany({
    where: and(...conditions),
    columns: {
      id: true,
      capacity: true,
      seasonType: true,
    },
  });
  
  if (projects.length === 0) {
    return calculateContractTermOccupancy({
      annual: 0,
      seasonal: 0,
      winter: 0,
      shortTerm: 0,
      unclassified: 0,
      total: 0,
    }, 0, 'ANNUAL');
  }
  
  // Build query conditions for leases grouped by project
  const projectIdList = projects.map(p => p.id);
  const leaseConditions = [
    inArray(leases.locationId, projectIdList),
    eq(leases.isActive, true),
  ];
  
  if (storageType) {
    leaseConditions.push(eq(leases.storageType, storageType as any));
  }
  
  // Get all active leases with their project IDs FIRST
  // We need this to determine which projects have leases of the filtered type
  const allLeases = await db.query.rraLeases.findMany({
    where: and(...leaseConditions),
    columns: {
      id: true,
      locationId: true,
      contractTerm: true,
    },
  });
  
  // Group leases by project for per-project calculation
  const leasesByProject: Map<string, typeof allLeases> = new Map();
  for (const lease of allLeases) {
    const existing = leasesByProject.get(lease.locationId) || [];
    existing.push(lease);
    leasesByProject.set(lease.locationId, existing);
  }
  
  // Get per-project capacity
  // If filtering by storage type:
  // 1. Use storage_locations capacity if configured for that type
  // 2. Fall back to project capacity ONLY if project has NO storage_locations configured at all
  // 3. If project has storage_locations for OTHER types but not this type, capacity = 0
  let projectCapacities: Map<string, number> = new Map();
  
  if (storageType) {
    // Get all storage_locations for these projects to know which have ANY configuration
    const allStorageLocationData = await db.query.rraStorageLocations.findMany({
      where: inArray(storageLocations.projectId, projects.map(p => p.id)),
    });
    
    // Track which projects have storage_locations configured (for any type)
    const projectsWithStorageLocations = new Set<string>();
    for (const loc of allStorageLocationData) {
      if (loc.storageType) {
        projectsWithStorageLocations.add(loc.projectId);
      }
    }
    
    // Build capacity from storage_locations that match the filtered storage type
    const typeStorageLocations = allStorageLocationData.filter(
      loc => loc.storageType === storageType
    );
    for (const loc of typeStorageLocations) {
      const existing = projectCapacities.get(loc.projectId) || 0;
      projectCapacities.set(loc.projectId, existing + (loc.capacity || 0));
    }
    
    // For projects WITHOUT capacity set yet:
    // - If project has NO storage_locations configured at all → fall back to project capacity
    // - If project has storage_locations for OTHER types → capacity = 0 for this type
    for (const p of projects) {
      if (!projectCapacities.has(p.id)) {
        const projectHasAnyStorageLocations = projectsWithStorageLocations.has(p.id);
        const projectHasLeasesOfType = leasesByProject.has(p.id) && (leasesByProject.get(p.id)?.length || 0) > 0;
        
        if (!projectHasAnyStorageLocations && projectHasLeasesOfType) {
          // No storage_locations configured at all, fall back to project capacity
          projectCapacities.set(p.id, p.capacity || 0);
        }
        // Otherwise, if project has storage_locations for other types but not this type,
        // or has no leases of this type, capacity = 0 (don't add to map)
      }
    }
  } else {
    // "All Types" mode - aggregate capacities from storage_locations if they exist
    // Get all storage_locations for these projects
    const allStorageLocationData = await db.query.rraStorageLocations.findMany({
      where: inArray(storageLocations.projectId, projects.map(p => p.id)),
    });
    
    // Track which projects have ANY storage_locations configured
    const projectsWithStorageLocations = new Set<string>();
    
    // Sum capacities from all storage_locations per project
    for (const loc of allStorageLocationData) {
      if (loc.storageType) {
        projectsWithStorageLocations.add(loc.projectId);
        const existing = projectCapacities.get(loc.projectId) || 0;
        projectCapacities.set(loc.projectId, existing + (loc.capacity || 0));
      }
    }
    
    // For projects without storage_locations, use project.capacity if they have leases
    for (const p of projects) {
      if (!projectCapacities.has(p.id)) {
        const projectHasAnyStorageLocations = projectsWithStorageLocations.has(p.id);
        const projectHasLeases = leasesByProject.has(p.id) && (leasesByProject.get(p.id)?.length || 0) > 0;
        
        if (!projectHasAnyStorageLocations && projectHasLeases) {
          // No storage_locations configured, fall back to project capacity
          projectCapacities.set(p.id, p.capacity || 0);
        }
        // Otherwise capacity = 0 for this project
      }
    }
  }
  
  // Calculate per-project metrics and aggregate
  let aggregatedSlotSeasons = 0;
  let aggregatedOverall = { numerator: 0, denominator: 0 };
  let aggregatedAnnual = { numerator: 0, denominator: 0 };
  let aggregatedSeasonal = { numerator: 0, denominator: 0 };
  let aggregatedWinter = { numerator: 0, denominator: 0 };
  let aggregatedShortTerm = { numerator: 0, denominator: 0 };
  let aggregatedUnclassified = { numerator: 0, denominator: 0 };
  let totalCounts = { annual: 0, seasonal: 0, winter: 0, shortTerm: 0, unclassified: 0, total: 0 };
  
  for (const project of projects) {
    const projectLeases = leasesByProject.get(project.id) || [];
    const projectCapacity = projectCapacities.get(project.id) || 0;
    const projectSeasonType = project.seasonType || 'ANNUAL';
    
    // Count leases by contract term for this project
    const counts: ContractTermOccupancyCounts = {
      annual: 0,
      seasonal: 0,
      winter: 0,
      shortTerm: 0,
      unclassified: 0,
      total: projectLeases.length,
    };
    
    for (const lease of projectLeases) {
      const contractTerm = lease.contractTerm;
      
      if (!contractTerm) {
        counts.unclassified++;
        continue;
      }
      
      if ((CONTRACT_TERM_GROUPS.ANNUAL as readonly string[]).includes(contractTerm)) {
        counts.annual++;
      } else if ((CONTRACT_TERM_GROUPS.SEASONAL as readonly string[]).includes(contractTerm)) {
        counts.seasonal++;
      } else if ((CONTRACT_TERM_GROUPS.WINTER as readonly string[]).includes(contractTerm)) {
        counts.winter++;
      } else if ((CONTRACT_TERM_GROUPS.SHORT_TERM as readonly string[]).includes(contractTerm)) {
        counts.shortTerm++;
      } else {
        counts.unclassified++;
      }
    }
    
    // Calculate metrics for this project using its season type
    const projectMetrics = calculateContractTermOccupancy(counts, projectCapacity, projectSeasonType);
    
    // Aggregate slot-seasons and metrics
    aggregatedSlotSeasons += projectMetrics.slotSeasons;
    
    // Access metrics through occupancy property
    aggregatedOverall.numerator += projectMetrics.occupancy.overall.numerator;
    aggregatedOverall.denominator += projectMetrics.occupancy.overall.denominator;
    
    aggregatedAnnual.numerator += projectMetrics.occupancy.annual.numerator;
    aggregatedAnnual.denominator += projectMetrics.occupancy.annual.denominator;
    
    // Seasonal and winter may be null for ANNUAL projects
    if (projectMetrics.occupancy.seasonal) {
      aggregatedSeasonal.numerator += projectMetrics.occupancy.seasonal.numerator;
      aggregatedSeasonal.denominator += projectMetrics.occupancy.seasonal.denominator;
    }
    
    if (projectMetrics.occupancy.winter) {
      aggregatedWinter.numerator += projectMetrics.occupancy.winter.numerator;
      aggregatedWinter.denominator += projectMetrics.occupancy.winter.denominator;
    }
    
    aggregatedShortTerm.numerator += projectMetrics.occupancy.shortTerm.numerator;
    aggregatedShortTerm.denominator += projectMetrics.occupancy.shortTerm.denominator;
    
    // Unclassified counted toward overall but not tracked separately in ContractTermOccupancyMetrics
    aggregatedUnclassified.numerator += counts.unclassified;
    aggregatedUnclassified.denominator += projectCapacity;
    
    // Aggregate total counts
    totalCounts.annual += counts.annual;
    totalCounts.seasonal += counts.seasonal;
    totalCounts.winter += counts.winter;
    totalCounts.shortTerm += counts.shortTerm;
    totalCounts.unclassified += counts.unclassified;
    totalCounts.total += counts.total;
  }
  
  // Calculate aggregated percentages - cap at 100% max
  const calcPercent = (num: number, denom: number) => {
    if (denom <= 0) return 0;
    const raw = (num / denom) * 100;
    return Math.round(Math.min(raw, 100) * 10) / 10; // Cap at 100%
  };
  
  // Helper to create occupancy metric with data quality flag
  const createMetric = (num: number, denom: number, label: string) => ({
    percentage: calcPercent(num, denom),
    numerator: num,
    denominator: denom,
    label,
    exceedsCapacity: num > denom,
  });
  
  // Determine if we have any seasonal projects (for seasonal/winter metrics)
  const hasSeasonalMetrics = aggregatedSeasonal.denominator > 0;
  const hasWinterMetrics = aggregatedWinter.denominator > 0;
  
  // Total capacity for reference
  const totalCapacity = projects.reduce((sum, p) => sum + (projectCapacities.get(p.id) || 0), 0);
  
  // Check for data quality issues (any metric exceeds capacity)
  const hasDataQualityIssue = 
    aggregatedOverall.numerator > aggregatedOverall.denominator ||
    aggregatedAnnual.numerator > aggregatedAnnual.denominator ||
    aggregatedSeasonal.numerator > aggregatedSeasonal.denominator ||
    aggregatedWinter.numerator > aggregatedWinter.denominator ||
    aggregatedShortTerm.numerator > aggregatedShortTerm.denominator;
  
  return {
    counts: totalCounts,
    capacity: totalCapacity,
    slotSeasons: aggregatedSlotSeasons,
    projectSeasonType: 'ANNUAL' as const, // Default for mixed portfolios
    hasDataQualityIssue,
    occupancy: {
      overall: createMetric(
        aggregatedOverall.numerator,
        aggregatedOverall.denominator,
        `${aggregatedOverall.numerator} / ${aggregatedOverall.denominator}`
      ),
      annual: createMetric(
        aggregatedAnnual.numerator,
        aggregatedAnnual.denominator,
        `${aggregatedAnnual.numerator} annual / ${aggregatedAnnual.denominator}`
      ),
      seasonal: hasSeasonalMetrics ? createMetric(
        aggregatedSeasonal.numerator,
        aggregatedSeasonal.denominator,
        `${aggregatedSeasonal.numerator} / ${aggregatedSeasonal.denominator}`
      ) : null,
      winter: hasWinterMetrics ? createMetric(
        aggregatedWinter.numerator,
        aggregatedWinter.denominator,
        `${aggregatedWinter.numerator} / ${aggregatedWinter.denominator}`
      ) : null,
      shortTerm: createMetric(
        aggregatedShortTerm.numerator,
        aggregatedShortTerm.denominator,
        `${aggregatedShortTerm.numerator} short-term / ${aggregatedShortTerm.denominator}`
      ),
    },
  };
}

/**
 * Get available storage types across all projects (for filter dropdowns)
 * @param projectId - Single project ID (for project-level queries)
 * @param projectIds - List of project IDs (for filtering)
 * @param includeInExecutiveOnly - If true, only include projects marked for executive summary
 */
export async function getAvailableStorageTypes(
  projectId?: string,
  projectIds?: string[],
  includeInExecutiveOnly?: boolean
): Promise<string[]> {
  let locationIds: string[] = [];
  
  if (projectId) {
    locationIds = [projectId];
  } else if (includeInExecutiveOnly) {
    // Get projects included in executive summary
    const conditions = [eq(marinaLocations.includeInExecutive, true)];
    if (projectIds && projectIds.length > 0) {
      conditions.push(inArray(marinaLocations.id, projectIds));
    }
    
    const includedProjects = await db.query.rraMarinaLocations.findMany({
      where: and(...conditions),
      columns: { id: true },
    });
    locationIds = includedProjects.map(p => p.id);
    
    if (locationIds.length === 0) {
      return [];
    }
  } else if (projectIds && projectIds.length > 0) {
    locationIds = projectIds;
  }
  
  let conditions: any[] = [];
  
  if (locationIds.length > 0) {
    conditions.push(inArray(leases.locationId, locationIds));
  }
  
  conditions.push(eq(leases.isActive, true));
  conditions.push(isNotNull(leases.storageType));
  
  const leasesWithStorage = await db.query.rraLeases.findMany({
    where: and(...conditions),
    columns: {
      storageType: true,
    },
  });
  
  const uniqueTypes = [...new Set(leasesWithStorage.map(l => l.storageType).filter(Boolean))] as string[];
  return uniqueTypes.sort();
}

/**
 * Storage location lease breakdown response interface
 */
export interface StorageLocationLeaseBreakdown {
  storageLocationId: string;
  storageLocationName: string;
  storageType: string | null;
  capacity: number | null;
  activeLeases: number;
  totalLeases: number;
  vacantSlips: number;
  occupancyRate: number;
}

/**
 * Get lease breakdown by storage location within a project
 */
export async function getLeasesByStorageLocation(
  projectId: string
): Promise<StorageLocationLeaseBreakdown[]> {
  // Get all storage locations for this project
  const storageLocationsList = await db.query.rraStorageLocations.findMany({
    where: eq(storageLocations.marinaLocationId, projectId),
    columns: {
      id: true,
      name: true,
      storageType: true,
      capacity: true,
    },
  });
  
  if (storageLocationsList.length === 0) {
    // If no storage locations, return a single "Unassigned" category
    const allLeases = await db.query.rraLeases.findMany({
      where: eq(leases.locationId, projectId),
      columns: {
        id: true,
        isActive: true,
      },
    });
    
    const activeCount = allLeases.filter(l => l.isActive).length;
    const totalCount = allLeases.length;
    
    return [{
      storageLocationId: "unassigned",
      storageLocationName: "Unassigned",
      storageType: null,
      capacity: null,
      activeLeases: activeCount,
      totalLeases: totalCount,
      vacantSlips: 0,
      occupancyRate: 0,
    }];
  }
  
  // Get all leases for this project with storage location assignments
  const allLeases = await db.query.rraLeases.findMany({
    where: eq(leases.locationId, projectId),
    columns: {
      id: true,
      isActive: true,
      storageLocationId: true,
    },
  });
  
  // Group leases by storage location
  const result: StorageLocationLeaseBreakdown[] = [];
  
  for (const sl of storageLocationsList) {
    const slLeases = allLeases.filter(l => l.storageLocationId === sl.id);
    const activeCount = slLeases.filter(l => l.isActive).length;
    const totalCount = slLeases.length;
    const capacity = sl.capacity || 0;
    const vacantSlips = Math.max(0, capacity - activeCount);
    const occupancyRate = capacity > 0 ? (activeCount / capacity) * 100 : 0;
    
    result.push({
      storageLocationId: sl.id,
      storageLocationName: sl.name || "Unnamed",
      storageType: sl.storageType,
      capacity: sl.capacity,
      activeLeases: activeCount,
      totalLeases: totalCount,
      vacantSlips,
      occupancyRate,
    });
  }
  
  // Add unassigned leases if any
  const unassignedLeases = allLeases.filter(l => !l.storageLocationId);
  if (unassignedLeases.length > 0) {
    const activeCount = unassignedLeases.filter(l => l.isActive).length;
    result.push({
      storageLocationId: "unassigned",
      storageLocationName: "Unassigned",
      storageType: null,
      capacity: null,
      activeLeases: activeCount,
      totalLeases: unassignedLeases.length,
      vacantSlips: 0,
      occupancyRate: 0,
    });
  }
  
  // Sort by storage location name
  return result.sort((a, b) => a.storageLocationName.localeCompare(b.storageLocationName));
}

/**
 * Average boat size metrics response interface
 */
export interface AvgBoatSizeMetrics {
  overall: { avgLength: number; boatCount: number; label: string };
  annual: { avgLength: number; boatCount: number; label: string } | null;
  seasonal: { avgLength: number; boatCount: number; label: string } | null;
  winter: { avgLength: number; boatCount: number; label: string } | null;
  byProject: Array<{
    projectId: string;
    projectName: string;
    avgLength: number;
    boatCount: number;
    contractTermBreakdown: {
      annual: { avgLength: number; boatCount: number };
      seasonal: { avgLength: number; boatCount: number };
      winter: { avgLength: number; boatCount: number };
    };
  }>;
}

/**
 * Get average boat size metrics aggregated across multiple projects (executive level).
 * Supports filtering by project type and specific project IDs.
 * Returns weighted averages by the count of boats in each project/contract type.
 */
export async function getExecutiveAvgBoatSize(
  orgId: string,
  filterOptions?: { projectType?: string; projectIds?: string[]; storageType?: string }
): Promise<AvgBoatSizeMetrics> {
  const { projectType, projectIds, storageType } = filterOptions || {};
  
  // Get projects included in executive summary
  // IMPORTANT: Always filter by orgId for tenant isolation
  const conditions = [
    eq(marinaLocations.orgId, orgId),
    eq(marinaLocations.includeInExecutive, true)
  ];
  
  if (projectType) {
    conditions.push(eq(marinaLocations.projectType, projectType as any));
  }
  
  if (projectIds && projectIds.length > 0) {
    conditions.push(inArray(marinaLocations.id, projectIds));
  }
  
  const projects = await db.query.rraMarinaLocations.findMany({
    where: and(...conditions),
    columns: {
      id: true,
      name: true,
    },
  });
  
  if (projects.length === 0) {
    return {
      overall: { avgLength: 0, boatCount: 0, label: "0 boats" },
      annual: null,
      seasonal: null,
      winter: null,
      byProject: [],
    };
  }
  
  // Get all active leases with tenant boat info
  const projectIdList = projects.map(p => p.id);
  
  const leasesData = await db
    .select({
      leaseId: leases.id,
      locationId: leases.locationId,
      contractTerm: leases.contractTerm,
      boatLength: tenants.boatLength,
    })
    .from(leases)
    .innerJoin(tenants, eq(leases.tenantId, tenants.id))
    .where(and(
      inArray(leases.locationId, projectIdList),
      eq(leases.isActive, true)
    ));
  
  // Helper to classify contract term
  const classifyTerm = (term: string | null): 'annual' | 'seasonal' | 'winter' | 'other' => {
    if (!term) return 'other';
    if ((CONTRACT_TERM_GROUPS.ANNUAL as readonly string[]).includes(term)) return 'annual';
    if ((CONTRACT_TERM_GROUPS.SEASONAL as readonly string[]).includes(term)) return 'seasonal';
    if ((CONTRACT_TERM_GROUPS.WINTER as readonly string[]).includes(term)) return 'winter';
    return 'other';
  };
  
  // Aggregate by project and contract term
  const projectMap = new Map<string, {
    projectName: string;
    overall: { totalLength: number; count: number };
    annual: { totalLength: number; count: number };
    seasonal: { totalLength: number; count: number };
    winter: { totalLength: number; count: number };
  }>();
  
  // Initialize project entries
  for (const p of projects) {
    projectMap.set(p.id, {
      projectName: p.name,
      overall: { totalLength: 0, count: 0 },
      annual: { totalLength: 0, count: 0 },
      seasonal: { totalLength: 0, count: 0 },
      winter: { totalLength: 0, count: 0 },
    });
  }
  
  // Aggregate boat lengths
  for (const lease of leasesData) {
    const boatLength = lease.boatLength ? parseFloat(lease.boatLength) : null;
    if (!boatLength || boatLength <= 0) continue;
    
    const projectData = projectMap.get(lease.locationId);
    if (!projectData) continue;
    
    const termType = classifyTerm(lease.contractTerm);
    
    // Add to overall
    projectData.overall.totalLength += boatLength;
    projectData.overall.count++;
    
    // Add to term-specific
    if (termType === 'annual') {
      projectData.annual.totalLength += boatLength;
      projectData.annual.count++;
    } else if (termType === 'seasonal') {
      projectData.seasonal.totalLength += boatLength;
      projectData.seasonal.count++;
    } else if (termType === 'winter') {
      projectData.winter.totalLength += boatLength;
      projectData.winter.count++;
    }
  }
  
  // Calculate weighted averages across all projects
  let totalOverallLength = 0;
  let totalOverallCount = 0;
  let totalAnnualLength = 0;
  let totalAnnualCount = 0;
  let totalSeasonalLength = 0;
  let totalSeasonalCount = 0;
  let totalWinterLength = 0;
  let totalWinterCount = 0;
  
  const byProject: AvgBoatSizeMetrics['byProject'] = [];
  
  for (const [projectId, data] of projectMap) {
    // Aggregate totals for weighted average
    totalOverallLength += data.overall.totalLength;
    totalOverallCount += data.overall.count;
    totalAnnualLength += data.annual.totalLength;
    totalAnnualCount += data.annual.count;
    totalSeasonalLength += data.seasonal.totalLength;
    totalSeasonalCount += data.seasonal.count;
    totalWinterLength += data.winter.totalLength;
    totalWinterCount += data.winter.count;
    
    // Build per-project breakdown
    byProject.push({
      projectId,
      projectName: data.projectName,
      avgLength: data.overall.count > 0 ? Math.round(data.overall.totalLength / data.overall.count * 10) / 10 : 0,
      boatCount: data.overall.count,
      contractTermBreakdown: {
        annual: {
          avgLength: data.annual.count > 0 ? Math.round(data.annual.totalLength / data.annual.count * 10) / 10 : 0,
          boatCount: data.annual.count,
        },
        seasonal: {
          avgLength: data.seasonal.count > 0 ? Math.round(data.seasonal.totalLength / data.seasonal.count * 10) / 10 : 0,
          boatCount: data.seasonal.count,
        },
        winter: {
          avgLength: data.winter.count > 0 ? Math.round(data.winter.totalLength / data.winter.count * 10) / 10 : 0,
          boatCount: data.winter.count,
        },
      },
    });
  }
  
  // Sort by boat count descending
  byProject.sort((a, b) => b.boatCount - a.boatCount);
  
  // Calculate weighted averages
  const overallAvg = totalOverallCount > 0 ? Math.round(totalOverallLength / totalOverallCount * 10) / 10 : 0;
  const annualAvg = totalAnnualCount > 0 ? Math.round(totalAnnualLength / totalAnnualCount * 10) / 10 : 0;
  const seasonalAvg = totalSeasonalCount > 0 ? Math.round(totalSeasonalLength / totalSeasonalCount * 10) / 10 : 0;
  const winterAvg = totalWinterCount > 0 ? Math.round(totalWinterLength / totalWinterCount * 10) / 10 : 0;
  
  return {
    overall: { 
      avgLength: overallAvg, 
      boatCount: totalOverallCount, 
      label: `${totalOverallCount} boats` 
    },
    annual: totalAnnualCount > 0 ? { 
      avgLength: annualAvg, 
      boatCount: totalAnnualCount, 
      label: `${totalAnnualCount} annual boats` 
    } : null,
    seasonal: totalSeasonalCount > 0 ? { 
      avgLength: seasonalAvg, 
      boatCount: totalSeasonalCount, 
      label: `${totalSeasonalCount} seasonal boats` 
    } : null,
    winter: totalWinterCount > 0 ? { 
      avgLength: winterAvg, 
      boatCount: totalWinterCount, 
      label: `${totalWinterCount} winter boats` 
    } : null,
    byProject,
  };
}

// ============================================
// RENEWAL REMINDERS SERVICE FUNCTIONS
// ============================================

export async function getRenewalReminders(
  orgId: string,
  options: { locationId?: string; status?: string }
): Promise<any[]> {
  try {
    const conditions: any[] = [eq(rraRenewalReminders.orgId, orgId)];
    
    if (options.status) {
      conditions.push(eq(rraRenewalReminders.status, options.status as any));
    }
    
    const reminders = await db
      .select({
        id: rraRenewalReminders.id,
        leaseId: rraRenewalReminders.leaseId,
        reminderDate: rraRenewalReminders.reminderDate,
        daysBeforeExpiration: rraRenewalReminders.daysBeforeExpiration,
        status: rraRenewalReminders.status,
        sentAt: rraRenewalReminders.sentAt,
        notificationMethod: rraRenewalReminders.notificationMethod,
        recipientEmail: rraRenewalReminders.recipientEmail,
        notes: rraRenewalReminders.notes,
        createdAt: rraRenewalReminders.createdAt,
      })
      .from(rraRenewalReminders)
      .where(and(...conditions))
      .orderBy(asc(rraRenewalReminders.reminderDate));
    
    // Fetch lease details for each reminder
    const enrichedReminders = await Promise.all(
      reminders.map(async (reminder) => {
        const lease = await db
          .select({
            id: rraLeases.id,
            leaseExpiration: rraLeases.leaseExpiration,
            leaseAmount: rraLeases.leaseAmount,
            locationId: rraLeases.locationId,
          })
          .from(rraLeases)
          .where(eq(rraLeases.id, reminder.leaseId))
          .limit(1);
        
        const leaseData = lease[0];
        if (!leaseData) return { ...reminder, lease: null };
        
        // Filter by locationId if provided
        if (options.locationId && leaseData.locationId !== options.locationId) {
          return null;
        }
        
        const tenant = await db
          .select({ firstName: rraTenants.firstName, lastName: rraTenants.lastName })
          .from(rraTenants)
          .innerJoin(rraLeases, eq(rraLeases.tenantId, rraTenants.id))
          .where(eq(rraLeases.id, reminder.leaseId))
          .limit(1);
        
        const storage = leaseData.locationId ? await db
          .select({ name: rraStorageLocations.name })
          .from(rraStorageLocations)
          .innerJoin(rraLeases, eq(rraLeases.storageLocationId, rraStorageLocations.id))
          .where(eq(rraLeases.id, reminder.leaseId))
          .limit(1) : [];
        
        return {
          ...reminder,
          lease: {
            id: leaseData.id,
            tenantName: tenant[0] ? `${tenant[0].firstName || ''} ${tenant[0].lastName || ''}`.trim() || 'Unknown' : 'Unknown',
            slipLabel: storage[0]?.name || leaseData.locationId || 'Unknown',
            leaseExpiration: leaseData.leaseExpiration,
            monthlyRent: parseFloat(leaseData.leaseAmount || '0'),
          },
        };
      })
    );
    
    return enrichedReminders.filter(Boolean);
  } catch (error) {
    console.error('[getRenewalReminders] Error:', error);
    return [];
  }
}

export async function createRenewalReminder(
  orgId: string,
  data: {
    leaseId: string;
    daysBeforeExpiration: number;
    recipientEmail?: string;
    notes?: string;
    createdBy?: string;
  }
): Promise<any> {
  // Get lease expiration date
  const lease = await db
    .select({ leaseExpiration: rraLeases.leaseExpiration })
    .from(rraLeases)
    .where(and(eq(rraLeases.id, data.leaseId), eq(rraLeases.orgId, orgId)))
    .limit(1);
  
  if (!lease[0]?.leaseExpiration) {
    throw new Error('Lease not found or has no expiration date');
  }
  
  const expirationDate = new Date(lease[0].leaseExpiration);
  const reminderDate = new Date(expirationDate);
  reminderDate.setDate(reminderDate.getDate() - data.daysBeforeExpiration);
  
  const [reminder] = await db
    .insert(rraRenewalReminders)
    .values({
      orgId,
      leaseId: data.leaseId,
      reminderDate: reminderDate.toISOString().split('T')[0],
      daysBeforeExpiration: data.daysBeforeExpiration,
      recipientEmail: data.recipientEmail,
      notes: data.notes,
      createdBy: data.createdBy,
      status: 'pending',
    })
    .returning();
  
  return reminder;
}

export async function updateRenewalReminder(
  orgId: string,
  id: string,
  data: { status?: string; notes?: string; recipientEmail?: string }
): Promise<any> {
  const updateData: any = { updatedAt: new Date() };
  
  if (data.status) {
    updateData.status = data.status;
    if (data.status === 'sent') {
      updateData.sentAt = new Date();
    }
  }
  if (data.notes !== undefined) updateData.notes = data.notes;
  if (data.recipientEmail !== undefined) updateData.recipientEmail = data.recipientEmail;
  
  const [reminder] = await db
    .update(rraRenewalReminders)
    .set(updateData)
    .where(and(eq(rraRenewalReminders.id, id), eq(rraRenewalReminders.orgId, orgId)))
    .returning();
  
  return reminder;
}

export async function deleteRenewalReminder(orgId: string, id: string): Promise<void> {
  await db
    .delete(rraRenewalReminders)
    .where(and(eq(rraRenewalReminders.id, id), eq(rraRenewalReminders.orgId, orgId)));
}

export async function getExpiringLeases(
  orgId: string,
  options: { locationId?: string; daysAhead?: number }
): Promise<any[]> {
  const daysAhead = options.daysAhead || 180;
  const today = new Date();
  const futureDate = new Date();
  futureDate.setDate(today.getDate() + daysAhead);
  
  const conditions: any[] = [
    eq(rraLeases.orgId, orgId),
    eq(rraLeases.isActive, true),
    gte(rraLeases.leaseExpiration, today.toISOString().split('T')[0]),
    lte(rraLeases.leaseExpiration, futureDate.toISOString().split('T')[0]),
  ];
  
  if (options.locationId) {
    conditions.push(eq(rraLeases.locationId, options.locationId));
  }
  
  const leases = await db
    .select({
      id: rraLeases.id,
      leaseExpiration: rraLeases.leaseExpiration,
      leaseAmount: rraLeases.leaseAmount,
      storageType: rraLeases.storageType,
      unitNumber: rraLeases.unitNumber,
      slipLength: rraLeases.slipLength,
      tenantId: rraLeases.tenantId,
      storageLocationId: rraLeases.storageLocationId,
    })
    .from(rraLeases)
    .where(and(...conditions))
    .orderBy(asc(rraLeases.leaseExpiration));
  
  return Promise.all(
    leases.map(async (lease) => {
      const tenant = await db
        .select({ firstName: rraTenants.firstName, lastName: rraTenants.lastName, email: rraTenants.email })
        .from(rraTenants)
        .where(eq(rraTenants.id, lease.tenantId))
        .limit(1);
      
      const storage = lease.storageLocationId ? await db
        .select({ name: rraStorageLocations.name })
        .from(rraStorageLocations)
        .where(eq(rraStorageLocations.id, lease.storageLocationId))
        .limit(1) : [];
      
      const daysUntilExpiration = Math.ceil(
        (new Date(lease.leaseExpiration!).getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
      );
      
      return {
        id: lease.id,
        tenantName: tenant[0] ? `${tenant[0].firstName || ''} ${tenant[0].lastName || ''}`.trim() || 'Unknown' : 'Unknown',
        slipId: lease.unitNumber || 'N/A',
        slipLabel: storage[0]?.name || lease.unitNumber || 'Unknown',
        monthlyRent: parseFloat(lease.leaseAmount || '0'),
        expirationDate: lease.leaseExpiration,
        daysUntilExpiration,
        contactEmail: tenant[0]?.email,
        storageType: lease.storageType,
        loa: lease.slipLength ? parseFloat(lease.slipLength) : null,
      };
    })
  );
}

export async function getOccupancyTrends(
  orgId: string,
  options: { locationId?: string; months?: number }
): Promise<any[]> {
  const months = options.months || 12;
  const trends: any[] = [];
  
  for (let i = months - 1; i >= 0; i--) {
    const date = new Date();
    date.setMonth(date.getMonth() - i);
    const monthName = date.toLocaleString('default', { month: 'short' });
    const year = date.getFullYear();
    
    // Get active leases for this month
    const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
    const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0);
    
    const conditions: any[] = [
      eq(rraLeases.orgId, orgId),
      lte(rraLeases.leaseCommencement, endOfMonth.toISOString().split('T')[0]),
      or(
        gte(rraLeases.leaseExpiration, startOfMonth.toISOString().split('T')[0]),
        eq(rraLeases.isActive, true)
      ),
    ];
    
    if (options.locationId) {
      conditions.push(eq(rraLeases.locationId, options.locationId));
    }
    
    const activeLeases = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(rraLeases)
      .where(and(...conditions));
    
    const occupiedUnits = activeLeases[0]?.count || 0;
    
    // Get total storage locations
    const locationConditions: any[] = [eq(rraStorageLocations.orgId, orgId)];
    if (options.locationId) {
      locationConditions.push(eq(rraStorageLocations.locationId, options.locationId));
    }
    
    const totalUnitsResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(rraStorageLocations)
      .where(and(...locationConditions));
    
    const totalUnits = Math.max(totalUnitsResult[0]?.count || 100, occupiedUnits);
    const vacantUnits = Math.max(0, totalUnits - occupiedUnits);
    const occupancyRate = totalUnits > 0 ? Math.round((occupiedUnits / totalUnits) * 100) : 0;
    
    trends.push({
      month: `${monthName} ${year}`,
      occupancyRate,
      occupiedUnits,
      vacantUnits,
      totalUnits,
    });
  }
  
  return trends;
}

export async function getSeasonalRates(
  orgId: string,
  options: { locationId?: string }
): Promise<any[]> {
  const conditions: any[] = [eq(rraLeases.orgId, orgId), eq(rraLeases.isActive, true)];
  
  if (options.locationId) {
    conditions.push(eq(rraLeases.locationId, options.locationId));
  }
  
  const leases = await db
    .select({
      contractTerm: rraLeases.contractTerm,
      leaseAmount: rraLeases.leaseAmount,
      slipLength: rraLeases.slipLength,
    })
    .from(rraLeases)
    .where(and(...conditions));
  
  const seasonalData: Record<string, { totalRate: number; totalRent: number; count: number; totalLength: number }> = {
    'Annual': { totalRate: 0, totalRent: 0, count: 0, totalLength: 0 },
    'Seasonal': { totalRate: 0, totalRent: 0, count: 0, totalLength: 0 },
    'Winter': { totalRate: 0, totalRent: 0, count: 0, totalLength: 0 },
    'Short-term': { totalRate: 0, totalRent: 0, count: 0, totalLength: 0 },
  };
  
  for (const lease of leases) {
    const term = lease.contractTerm?.toLowerCase() || 'annual';
    let season = 'Annual';
    
    if (term.includes('season')) season = 'Seasonal';
    else if (term.includes('winter')) season = 'Winter';
    else if (term.includes('short') || term.includes('transient') || term.includes('daily') || term.includes('weekly')) season = 'Short-term';
    
    const monthlyRent = parseFloat(lease.leaseAmount || '0');
    const length = parseFloat(lease.slipLength || '30');
    const ratePerFoot = length > 0 ? monthlyRent / length : 0;
    
    seasonalData[season].totalRate += ratePerFoot;
    seasonalData[season].totalRent += monthlyRent;
    seasonalData[season].count += 1;
    seasonalData[season].totalLength += length;
  }
  
  return Object.entries(seasonalData)
    .filter(([_, data]) => data.count > 0)
    .map(([season, data]) => ({
      season,
      avgRatePerFoot: data.count > 0 ? Math.round((data.totalRate / data.count) * 100) / 100 : 0,
      avgMonthlyRate: data.count > 0 ? Math.round(data.totalRent / data.count) : 0,
      count: data.count,
      totalRevenue: Math.round(data.totalRent * 12),
      avgLoa: data.count > 0 ? Math.round(data.totalLength / data.count) : 30,
    }));
}

export async function getOccupancyByStorageType(
  orgId: string,
  options: { locationId?: string }
): Promise<any[]> {
  const conditions: any[] = [eq(rraLeases.orgId, orgId), eq(rraLeases.isActive, true)];
  
  if (options.locationId) {
    conditions.push(eq(rraLeases.locationId, options.locationId));
  }
  
  const leases = await db
    .select({
      storageType: rraLeases.storageType,
    })
    .from(rraLeases)
    .where(and(...conditions));
  
  // Count leases by storage type
  const typeCounts: Record<string, { occupied: number }> = {};
  
  for (const lease of leases) {
    const type = lease.storageType || 'Other';
    if (!typeCounts[type]) {
      typeCounts[type] = { occupied: 0 };
    }
    typeCounts[type].occupied += 1;
  }
  
  // Get total capacity by storage type
  const locationConditions: any[] = [eq(storageLocations.orgId, orgId)];
  if (options.locationId) {
    locationConditions.push(eq(storageLocations.locationId, options.locationId));
  }
  
  const allLocations = await db
    .select({
      storageType: storageLocations.storageType,
    })
    .from(storageLocations)
    .where(and(...locationConditions));
  
  // Count total capacity by type
  const capacityByType: Record<string, number> = {};
  for (const loc of allLocations) {
    const type = loc.storageType || 'Other';
    capacityByType[type] = (capacityByType[type] || 0) + 1;
  }
  
  // Combine data
  const allTypes = new Set([...Object.keys(typeCounts), ...Object.keys(capacityByType)]);
  return Array.from(allTypes).map(type => {
    const occupied = typeCounts[type]?.occupied || 0;
    const total = Math.max(capacityByType[type] || occupied, occupied);
    const vacant = Math.max(0, total - occupied);
    const occupancyRate = total > 0 ? Math.round((occupied / total) * 100) : 0;
    
    return {
      storageType: type,
      occupied,
      vacant,
      total,
      occupancyRate,
    };
  }).filter(t => t.total > 0);
}

export async function processPendingReminders(orgId: string): Promise<{ processed: number; sent: number; errors: number }> {
  const today = new Date().toISOString().split('T')[0];
  
  const pendingReminders = await db
    .select()
    .from(rraRenewalReminders)
    .where(
      and(
        eq(rraRenewalReminders.orgId, orgId),
        eq(rraRenewalReminders.status, 'pending'),
        lte(rraRenewalReminders.reminderDate, today)
      )
    );
  
  let processed = 0;
  let sent = 0;
  let errors = 0;
  
  for (const reminder of pendingReminders) {
    processed++;
    try {
      // Mark as sent (in a real implementation, this would send an email)
      await db
        .update(rraRenewalReminders)
        .set({
          status: 'sent',
          sentAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(rraRenewalReminders.id, reminder.id));
      sent++;
    } catch (error) {
      console.error(`[processPendingReminders] Error processing reminder ${reminder.id}:`, error);
      errors++;
    }
  }
  
  return { processed, sent, errors };
}
