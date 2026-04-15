/**
 * Retail Vertical Analytics
 *
 * Provides retail-specific analytics leveraging the commercialTenants system:
 * - Percentage rent calculations
 * - CAM reconciliation analysis
 * - Tenant sales productivity (sales/SF)
 * - Co-tenancy clause tracking
 * - Anchor vs inline tenant analysis
 */

import { db } from "../db";
import { commercialTenants, commercialTenantRentSchedule } from "@shared/schema";
import { eq, and, sql, desc, asc } from "drizzle-orm";

// ============================================================================
// Types
// ============================================================================

export interface RetailKPIs {
  totalGLA: number;               // Gross Leasable Area
  occupiedGLA: number;
  occupancyRate: number;
  totalBaseRent: number;          // Annual
  totalPercentageRent: number;    // Annual estimated
  totalNNNRecoveries: number;     // Annual
  totalEffectiveRent: number;     // Base + % + NNN
  avgBaseRentPerSF: number;
  weightedAvgLeaseTerm: number;   // WALT in years
  tenantsWithPercentageRent: number;
  tenantsWithCoTenancy: number;
  expiringNext12Months: number;
}

export interface PercentageRentAnalysis {
  tenantId: string;
  tenantName: string;
  suiteNumber: string;
  squareFootage: number;
  baseRentAnnual: number;
  percentageRate: number;         // e.g., 6%
  naturalBreakpoint: number;
  artificialBreakpoint: number | null;
  effectiveBreakpoint: number;    // Min of natural/artificial
  lastReportedSales: number;
  estimatedPercentageRent: number;
  salesPerSF: number;
  salesAboveBreakpoint: number;
}

export interface CAMReconciliation {
  tenantId: string;
  tenantName: string;
  suiteNumber: string;
  squareFootage: number;
  proRataShare: number;           // %
  estimatedCAMPerSF: number;
  estimatedTaxPerSF: number;
  estimatedInsPerSF: number;
  totalEstimatedNNN: number;      // Annual
  camCapPercent: number | null;
  baseYearExpenses: number | null;
  adminFeePercent: number;
  excludedItems: string[];
}

export interface TenantSalesAnalysis {
  tenantId: string;
  tenantName: string;
  squareFootage: number;
  annualSales: number;
  salesPerSF: number;
  occupancyCostRatio: number;     // Total rent / sales
  baseRentPerSF: number;
  totalRentPerSF: number;
}

// ============================================================================
// Analytics Functions
// ============================================================================

/**
 * Calculate retail-specific KPIs from commercialTenants data.
 */
export async function getRetailKPIs(options: {
  orgId: string;
  modelingProjectId?: string;
  marinaId?: string;
}): Promise<RetailKPIs> {
  const conditions = [eq(commercialTenants.orgId, options.orgId)];
  if (options.modelingProjectId) {
    conditions.push(eq(commercialTenants.modelingProjectId, options.modelingProjectId));
  }
  if (options.marinaId) {
    conditions.push(eq(commercialTenants.marinaId, options.marinaId));
  }

  const tenants = await db
    .select()
    .from(commercialTenants)
    .where(and(...conditions));

  const now = new Date();
  const oneYearOut = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());

  let totalGLA = 0, occupiedGLA = 0;
  let totalBaseRent = 0, totalPctRent = 0, totalNNN = 0;
  let weightedTermSum = 0, weightedTermDenom = 0;
  let pctRentCount = 0, coTenancyCount = 0, expiringCount = 0;

  for (const t of tenants) {
    const sf = parseFloat(t.squareFootage?.toString() || '0');
    const baseRent = parseFloat(t.currentBaseRent?.toString() || '0');
    const nnn = parseFloat(t.totalEstimatedNNN?.toString() || '0');
    const pctRate = parseFloat(t.percentageRentRate?.toString() || '0');
    const sales = parseFloat(t.lastReportedSales?.toString() || '0');

    totalGLA += sf;

    if (t.tenantStatus === 'active') {
      occupiedGLA += sf;
      totalBaseRent += baseRent;
      totalNNN += nnn;

      // Percentage rent estimate
      if (pctRate > 0 && sales > 0) {
        pctRentCount++;
        const breakpoint = parseFloat(t.artificialBreakpoint?.toString() || '0')
          || parseFloat(t.naturalBreakpoint?.toString() || '0')
          || (baseRent / pctRate);
        const overage = Math.max(0, sales - breakpoint);
        totalPctRent += overage * pctRate;
      }

      // WALT
      if (t.leaseExpirationDate && baseRent > 0) {
        const remaining = Math.max(0, (new Date(t.leaseExpirationDate).getTime() - now.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
        weightedTermSum += remaining * baseRent;
        weightedTermDenom += baseRent;
      }
    }

    if (t.hasOpeningCoTenancy || t.hasOperatingCoTenancy) coTenancyCount++;
    if (t.leaseExpirationDate) {
      const exp = new Date(t.leaseExpirationDate);
      if (exp >= now && exp <= oneYearOut) expiringCount++;
    }
  }

  return {
    totalGLA: Math.round(totalGLA),
    occupiedGLA: Math.round(occupiedGLA),
    occupancyRate: totalGLA > 0 ? Math.round((occupiedGLA / totalGLA) * 1000) / 10 : 0,
    totalBaseRent: Math.round(totalBaseRent),
    totalPercentageRent: Math.round(totalPctRent),
    totalNNNRecoveries: Math.round(totalNNN),
    totalEffectiveRent: Math.round(totalBaseRent + totalPctRent + totalNNN),
    avgBaseRentPerSF: occupiedGLA > 0 ? Math.round((totalBaseRent / occupiedGLA) * 100) / 100 : 0,
    weightedAvgLeaseTerm: weightedTermDenom > 0 ? Math.round((weightedTermSum / weightedTermDenom) * 10) / 10 : 0,
    tenantsWithPercentageRent: pctRentCount,
    tenantsWithCoTenancy: coTenancyCount,
    expiringNext12Months: expiringCount,
  };
}

/**
 * Analyze percentage rent across retail tenants.
 */
export async function getPercentageRentAnalysis(options: {
  orgId: string;
  modelingProjectId?: string;
}): Promise<PercentageRentAnalysis[]> {
  const conditions = [
    eq(commercialTenants.orgId, options.orgId),
    eq(commercialTenants.tenantStatus, 'active'),
    sql`${commercialTenants.percentageRentRate}::numeric > 0`,
  ];
  if (options.modelingProjectId) {
    conditions.push(eq(commercialTenants.modelingProjectId, options.modelingProjectId));
  }

  const tenants = await db
    .select()
    .from(commercialTenants)
    .where(and(...conditions))
    .orderBy(desc(commercialTenants.lastReportedSales));

  return tenants.map(t => {
    const sf = parseFloat(t.squareFootage?.toString() || '0');
    const baseRent = parseFloat(t.currentBaseRent?.toString() || '0');
    const pctRate = parseFloat(t.percentageRentRate?.toString() || '0');
    const natural = parseFloat(t.naturalBreakpoint?.toString() || '0') || (pctRate > 0 ? baseRent / pctRate : 0);
    const artificial = parseFloat(t.artificialBreakpoint?.toString() || '0');
    const effective = artificial > 0 ? Math.min(natural, artificial) : natural;
    const sales = parseFloat(t.lastReportedSales?.toString() || '0');
    const overage = Math.max(0, sales - effective);
    const pctRent = overage * pctRate;

    return {
      tenantId: t.id,
      tenantName: t.tenantName,
      suiteNumber: t.suiteNumber || '',
      squareFootage: sf,
      baseRentAnnual: baseRent,
      percentageRate: pctRate * 100,
      naturalBreakpoint: Math.round(natural),
      artificialBreakpoint: artificial > 0 ? Math.round(artificial) : null,
      effectiveBreakpoint: Math.round(effective),
      lastReportedSales: sales,
      estimatedPercentageRent: Math.round(pctRent),
      salesPerSF: sf > 0 ? Math.round(sales / sf) : 0,
      salesAboveBreakpoint: Math.round(overage),
    };
  });
}

/**
 * Get CAM reconciliation data for all tenants.
 */
export async function getCAMReconciliation(options: {
  orgId: string;
  modelingProjectId?: string;
  marinaId?: string;
}): Promise<CAMReconciliation[]> {
  const conditions = [
    eq(commercialTenants.orgId, options.orgId),
    eq(commercialTenants.tenantStatus, 'active'),
  ];
  if (options.modelingProjectId) {
    conditions.push(eq(commercialTenants.modelingProjectId, options.modelingProjectId));
  }
  if (options.marinaId) {
    conditions.push(eq(commercialTenants.marinaId, options.marinaId));
  }

  const tenants = await db
    .select()
    .from(commercialTenants)
    .where(and(...conditions))
    .orderBy(asc(commercialTenants.suiteNumber));

  return tenants.map(t => ({
    tenantId: t.id,
    tenantName: t.tenantName,
    suiteNumber: t.suiteNumber || '',
    squareFootage: parseFloat(t.squareFootage?.toString() || '0'),
    proRataShare: parseFloat(t.proRataShare?.toString() || '0'),
    estimatedCAMPerSF: parseFloat(t.estimatedCamPerSF?.toString() || '0'),
    estimatedTaxPerSF: parseFloat(t.estimatedTaxPerSF?.toString() || '0'),
    estimatedInsPerSF: parseFloat(t.estimatedInsurancePerSF?.toString() || '0'),
    totalEstimatedNNN: parseFloat(t.totalEstimatedNNN?.toString() || '0'),
    camCapPercent: t.camCapPercent ? parseFloat(t.camCapPercent.toString()) * 100 : null,
    baseYearExpenses: t.baseYearExpenses ? parseFloat(t.baseYearExpenses.toString()) : null,
    adminFeePercent: parseFloat(t.adminFeePercent?.toString() || '0') * 100,
    excludedItems: t.excludedCamItems || [],
  }));
}

// ============================================================================
// New Analytics: WALT and Rollover Schedule (Phase 9D)
// ============================================================================

export interface RetailWALT {
  walt: number;
  totalActiveTenants: number;
  weightedByRent: number;
  avgRemainingTerm: number;
}

export interface RetailRolloverYear {
  year: number;
  leasesExpiring: number;
  sfAtRisk: number;
  annualBaseRentAtRisk: number;
  pctOfOccupiedGLA: number;
  pctOfTotalBaseRent: number;
}

/**
 * Compute Weighted Average Lease Term (WALT) in years, weighted by in-place rent.
 */
export async function getWALT(options: { orgId: string; modelingProjectId?: string; marinaId?: string }): Promise<RetailWALT> {
  const conditions = [
    eq(commercialTenants.orgId, options.orgId),
    eq(commercialTenants.tenantStatus, 'active'),
  ];
  if (options.modelingProjectId) conditions.push(eq(commercialTenants.modelingProjectId, options.modelingProjectId));
  if (options.marinaId) conditions.push(eq(commercialTenants.marinaId, options.marinaId));

  const tenantList = await db.select().from(commercialTenants).where(and(...conditions));

  const now = new Date();
  let weightedTermSum = 0;
  let weightedTermDenom = 0;
  let termSum = 0;
  let count = 0;

  for (const t of tenantList) {
    const rent = parseFloat(t.currentBaseRent?.toString() || '0');
    if (t.leaseExpirationDate && rent > 0) {
      const remaining = Math.max(0, (new Date(t.leaseExpirationDate).getTime() - now.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
      weightedTermSum += remaining * rent;
      weightedTermDenom += rent;
      termSum += remaining;
      count++;
    }
  }

  const walt = weightedTermDenom > 0 ? Math.round((weightedTermSum / weightedTermDenom) * 100) / 100 : 0;
  const avgRemaining = count > 0 ? Math.round((termSum / count) * 100) / 100 : 0;

  return {
    walt,
    totalActiveTenants: tenantList.length,
    weightedByRent: weightedTermDenom,
    avgRemainingTerm: avgRemaining,
  };
}

/**
 * Get lease rollover schedule for next 5 years.
 */
export async function getRolloverSchedule(options: { orgId: string; modelingProjectId?: string; marinaId?: string }): Promise<RetailRolloverYear[]> {
  const conditions = [
    eq(commercialTenants.orgId, options.orgId),
    eq(commercialTenants.tenantStatus, 'active'),
  ];
  if (options.modelingProjectId) conditions.push(eq(commercialTenants.modelingProjectId, options.modelingProjectId));
  if (options.marinaId) conditions.push(eq(commercialTenants.marinaId, options.marinaId));

  const tenantList = await db.select().from(commercialTenants).where(and(...conditions));

  const totalSF = tenantList.reduce((s, t) => s + parseFloat(t.squareFootage?.toString() || '0'), 0) || 1;
  const totalRent = tenantList.reduce((s, t) => s + parseFloat(t.currentBaseRent?.toString() || '0'), 0) || 1;

  const now = new Date();
  const currentYear = now.getFullYear();
  const result: RetailRolloverYear[] = [];

  for (let i = 0; i < 5; i++) {
    const year = currentYear + i;
    const yearStart = new Date(year, 0, 1);
    const yearEnd = new Date(year, 11, 31);

    const expiringThisYear = tenantList.filter(t => {
      if (!t.leaseExpirationDate) return false;
      const exp = new Date(t.leaseExpirationDate);
      return exp >= yearStart && exp <= yearEnd;
    });

    const sfAtRisk = expiringThisYear.reduce((s, t) => s + parseFloat(t.squareFootage?.toString() || '0'), 0);
    const rentAtRisk = expiringThisYear.reduce((s, t) => s + parseFloat(t.currentBaseRent?.toString() || '0'), 0);

    result.push({
      year,
      leasesExpiring: expiringThisYear.length,
      sfAtRisk: Math.round(sfAtRisk),
      annualBaseRentAtRisk: Math.round(rentAtRisk * 100) / 100,
      pctOfOccupiedGLA: Math.round((sfAtRisk / totalSF) * 1000) / 10,
      pctOfTotalBaseRent: Math.round((rentAtRisk / totalRent) * 1000) / 10,
    });
  }

  return result;
}
