/**
 * Industrial / Warehouse Vertical Analytics
 *
 * Provides industrial-specific analytics:
 * - KPIs: leased %, avg rent PSF, WALT, total SF, vacant SF
 * - Rollover schedule: leases expiring by year (next 5 years)
 * - Tenant concentration: top-10 tenants by % of total revenue
 * - Rent PSF comparison: in-place vs market by tenant
 */

import { db } from "../db";
import { rraLeases as leases, rraTenants as tenants, rraMarinaLocations as locations } from "@shared/schema";
import { eq, and, sql, desc, asc, gte } from "drizzle-orm";

// ============================================================================
// Types
// ============================================================================

export interface IndustrialKPIs {
  totalSF: number;
  leasedSF: number;
  vacantSF: number;
  leasedPct: number;
  avgRentPSF: number;
  walt: number;
  totalAnnualRevenue: number;
  avgRentPerLease: number;
  tenantCount: number;
}

export interface IndustrialRolloverYear {
  year: number;
  leasesExpiring: number;
  sfAtRisk: number;
  annualRevenueAtRisk: number;
  pctOfTotalSF: number;
  pctOfTotalRevenue: number;
}

export interface TenantConcentration {
  rank: number;
  tenantId: string;
  tenantName: string;
  unitType: string;
  annualRevenue: number;
  pctOfTotalRevenue: number;
  sf: number;
  leaseExpiration: string | null;
}

export interface RentPSFComparison {
  leaseId: string;
  tenantName: string;
  unitType: string;
  sf: number;
  inPlaceRentMonthly: number;
  inPlaceRentPSF: number;
  marketRentPSF: number | null;
  variance: number | null;
  variancePct: number | null;
  leaseExpiration: string | null;
}

// ============================================================================
// Analytics Functions
// ============================================================================

/**
 * Calculate industrial KPIs
 */
export async function getIndustrialKPIs(locationId: string): Promise<IndustrialKPIs> {
  const [location] = await db
    .select({ capacity: locations.capacity })
    .from(locations)
    .where(eq(locations.id, locationId))
    .limit(1);

  const stats = await db
    .select({
      tenantCount: sql<number>`COUNT(CASE WHEN ${leases.isActive} = true THEN 1 END)::int`,
      totalLeases: sql<number>`COUNT(*)::int`,
      avgRent: sql<string>`AVG(CASE WHEN ${leases.isActive} = true AND ${leases.leaseAmount}::numeric > 0 THEN ${leases.leaseAmount}::numeric END)`,
      totalAnnualRevenue: sql<string>`COALESCE(SUM(CASE WHEN ${leases.isActive} = true THEN ${leases.leaseAmount}::numeric * 12 ELSE 0 END), 0)`,
      totalSFActive: sql<string>`COALESCE(SUM(CASE WHEN ${leases.isActive} = true THEN COALESCE(${leases.unitDimension1}::numeric, 0) ELSE 0 END), 0)`,
      totalSFAll: sql<string>`COALESCE(SUM(COALESCE(${leases.unitDimension1}::numeric, 0)), 0)`,
      // WALT: weighted avg remaining lease term in years, weighted by monthly rent
      waltNumerator: sql<string>`COALESCE(SUM(CASE WHEN ${leases.isActive} = true AND ${leases.leaseExpiration} IS NOT NULL THEN
        GREATEST(0, EXTRACT(EPOCH FROM (${leases.leaseExpiration}::timestamp - NOW())) / (365.25 * 24 * 3600)) * ${leases.leaseAmount}::numeric
        ELSE 0 END), 0)`,
      waltDenominator: sql<string>`COALESCE(SUM(CASE WHEN ${leases.isActive} = true THEN ${leases.leaseAmount}::numeric ELSE 0 END), 1)`,
    })
    .from(leases)
    .where(eq(leases.locationId, locationId));

  const tenantCount = stats[0]?.tenantCount || 0;
  const avgRent = parseFloat(stats[0]?.avgRent?.toString() || "0");
  const totalAnnualRevenue = parseFloat(stats[0]?.totalAnnualRevenue?.toString() || "0");
  const leasedSF = parseFloat(stats[0]?.totalSFActive?.toString() || "0");
  const totalSFAll = parseFloat(stats[0]?.totalSFAll?.toString() || "0");
  const waltNum = parseFloat(stats[0]?.waltNumerator?.toString() || "0");
  const waltDen = parseFloat(stats[0]?.waltDenominator?.toString() || "1") || 1;
  const walt = Math.round((waltNum / waltDen) * 100) / 100;

  // Use capacity as total SF if available, else use totalSFAll
  const totalSF = location?.capacity ? location.capacity * 1000 : totalSFAll;
  const vacantSF = Math.max(0, totalSF - leasedSF);
  const leasedPct = totalSF > 0 ? Math.round((leasedSF / totalSF) * 1000) / 10 : 0;

  // Avg rent PSF (monthly rent / SF)
  const avgRentPSF = leasedSF > 0 ? Math.round((avgRent / (leasedSF / tenantCount || 1)) * 100) / 100 : 0;

  return {
    totalSF: Math.round(totalSF),
    leasedSF: Math.round(leasedSF),
    vacantSF: Math.round(vacantSF),
    leasedPct,
    avgRentPSF,
    walt,
    totalAnnualRevenue: Math.round(totalAnnualRevenue * 100) / 100,
    avgRentPerLease: Math.round(avgRent * 100) / 100,
    tenantCount,
  };
}

/**
 * Get rollover schedule - leases expiring by year for next 5 years
 */
export async function getRolloverSchedule(locationId: string): Promise<IndustrialRolloverYear[]> {
  const now = new Date();
  const currentYear = now.getFullYear();

  // Get totals first
  const [totals] = await db
    .select({
      totalSF: sql<string>`COALESCE(SUM(COALESCE(${leases.unitDimension1}::numeric, 0)), 1)`,
      totalRevenue: sql<string>`COALESCE(SUM(${leases.leaseAmount}::numeric * 12), 1)`,
    })
    .from(leases)
    .where(and(eq(leases.locationId, locationId), eq(leases.isActive, true)));

  const totalSF = parseFloat(totals?.totalSF?.toString() || "1") || 1;
  const totalRevenue = parseFloat(totals?.totalRevenue?.toString() || "1") || 1;

  const result: IndustrialRolloverYear[] = [];

  for (let i = 0; i < 5; i++) {
    const year = currentYear + i;
    const yearStart = `${year}-01-01`;
    const yearEnd = `${year}-12-31`;

    const [yearStats] = await db
      .select({
        leasesExpiring: sql<number>`COUNT(*)::int`,
        sfAtRisk: sql<string>`COALESCE(SUM(COALESCE(${leases.unitDimension1}::numeric, 0)), 0)`,
        revenueAtRisk: sql<string>`COALESCE(SUM(${leases.leaseAmount}::numeric * 12), 0)`,
      })
      .from(leases)
      .where(and(
        eq(leases.locationId, locationId),
        eq(leases.isActive, true),
        sql`${leases.leaseExpiration} >= ${yearStart}::date`,
        sql`${leases.leaseExpiration} <= ${yearEnd}::date`,
      ));

    const sfAtRisk = parseFloat(yearStats?.sfAtRisk?.toString() || "0");
    const revenueAtRisk = parseFloat(yearStats?.revenueAtRisk?.toString() || "0");

    result.push({
      year,
      leasesExpiring: yearStats?.leasesExpiring || 0,
      sfAtRisk: Math.round(sfAtRisk),
      annualRevenueAtRisk: Math.round(revenueAtRisk * 100) / 100,
      pctOfTotalSF: Math.round((sfAtRisk / totalSF) * 1000) / 10,
      pctOfTotalRevenue: Math.round((revenueAtRisk / totalRevenue) * 1000) / 10,
    });
  }

  return result;
}

/**
 * Get tenant concentration - top 10 tenants by revenue share
 */
export async function getTenantConcentration(locationId: string): Promise<TenantConcentration[]> {
  const [totals] = await db
    .select({
      totalRevenue: sql<string>`COALESCE(SUM(${leases.leaseAmount}::numeric * 12), 1)`,
    })
    .from(leases)
    .where(and(eq(leases.locationId, locationId), eq(leases.isActive, true)));

  const totalRevenue = parseFloat(totals?.totalRevenue?.toString() || "1") || 1;

  const results = await db
    .select({
      leaseId: leases.id,
      tenantId: leases.tenantId,
      tenantName: tenants.name,
      unitType: sql<string>`COALESCE(${leases.unitTypeCustom}, ${leases.storageType}::text)`,
      annualRevenue: sql<string>`COALESCE(${leases.leaseAmount}::numeric * 12, 0)`,
      sf: sql<string>`COALESCE(${leases.unitDimension1}::numeric, 0)`,
      expiration: leases.leaseExpiration,
    })
    .from(leases)
    .innerJoin(tenants, eq(leases.tenantId, tenants.id))
    .where(and(eq(leases.locationId, locationId), eq(leases.isActive, true)))
    .orderBy(desc(sql`${leases.leaseAmount}::numeric`))
    .limit(10);

  return results.map((r, index) => {
    const revenue = parseFloat(r.annualRevenue?.toString() || "0");
    return {
      rank: index + 1,
      tenantId: r.tenantId,
      tenantName: r.tenantName,
      unitType: r.unitType || "Unknown",
      annualRevenue: Math.round(revenue * 100) / 100,
      pctOfTotalRevenue: Math.round((revenue / totalRevenue) * 1000) / 10,
      sf: Math.round(parseFloat(r.sf?.toString() || "0")),
      leaseExpiration: r.expiration,
    };
  });
}

/**
 * Get rent PSF comparison per tenant
 */
export async function getRentPSFByTenant(locationId: string): Promise<RentPSFComparison[]> {
  const results = await db
    .select({
      leaseId: leases.id,
      tenantName: tenants.name,
      unitType: sql<string>`COALESCE(${leases.unitTypeCustom}, ${leases.storageType}::text)`,
      sf: sql<string>`COALESCE(${leases.unitDimension1}::numeric, 0)`,
      monthlyRent: sql<string>`COALESCE(${leases.leaseAmount}::numeric, 0)`,
      marketRent: sql<string>`COALESCE(${leases.baseRent2}::numeric, 0)`,
      expiration: leases.leaseExpiration,
    })
    .from(leases)
    .innerJoin(tenants, eq(leases.tenantId, tenants.id))
    .where(and(eq(leases.locationId, locationId), eq(leases.isActive, true)))
    .orderBy(asc(tenants.name));

  return results.map((r) => {
    const sf = parseFloat(r.sf?.toString() || "0");
    const monthlyRent = parseFloat(r.monthlyRent?.toString() || "0");
    const marketRent = parseFloat(r.marketRent?.toString() || "0");
    const annualRent = monthlyRent * 12;
    const inPlacePSF = sf > 0 ? Math.round((annualRent / sf) * 100) / 100 : 0;
    const marketPSF = marketRent > 0 && sf > 0 ? Math.round(((marketRent * 12) / sf) * 100) / 100 : null;
    const variance = marketPSF !== null ? Math.round((inPlacePSF - marketPSF) * 100) / 100 : null;
    const variancePct = marketPSF !== null && marketPSF > 0
      ? Math.round(((inPlacePSF - marketPSF) / marketPSF) * 1000) / 10
      : null;

    return {
      leaseId: r.leaseId,
      tenantName: r.tenantName,
      unitType: r.unitType || "Unknown",
      sf: Math.round(sf),
      inPlaceRentMonthly: Math.round(monthlyRent * 100) / 100,
      inPlaceRentPSF: inPlacePSF,
      marketRentPSF: marketPSF,
      variance,
      variancePct,
      leaseExpiration: r.expiration,
    };
  });
}
