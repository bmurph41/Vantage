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
}): Promise<CAMReconciliation[]> {
  const conditions = [
    eq(commercialTenants.orgId, options.orgId),
    eq(commercialTenants.tenantStatus, 'active'),
  ];
  if (options.modelingProjectId) {
    conditions.push(eq(commercialTenants.modelingProjectId, options.modelingProjectId));
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
