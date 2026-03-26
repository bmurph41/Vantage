/**
 * Multifamily Vertical Analytics
 *
 * Provides apartment-specific analytics:
 * - Loss-to-lease analysis (market rent vs in-place)
 * - Concession tracking and effective rent
 * - Unit mix analysis by bed/bath
 * - Renewal rate tracking
 * - Bad debt / delinquency metrics
 */

import { db } from "../db";
import { rraLeases as leases, rraTenants as tenants, rraMarinaLocations as locations } from "@shared/schema";
import { eq, and, sql, desc, asc } from "drizzle-orm";

// ============================================================================
// Types
// ============================================================================

export interface MultifamilyKPIs {
  totalUnits: number;
  occupiedUnits: number;
  physicalOccupancy: number;
  avgInPlaceRent: number;
  avgMarketRent: number;         // From baseRent2 or config
  lossToLease: number;           // Annual $ lost vs market
  lossToLeasePercent: number;
  grossPotentialRent: number;    // Monthly GPR
  effectiveGrossIncome: number;  // GPR - vacancy - concessions
  concessionLoss: number;        // Total monthly concession value
  badDebtUnits: number;
  renewalRate: number;           // % of expiring leases that renewed
}

export interface UnitMixPerformance {
  unitType: string;              // e.g., "1BR/1BA", "2BR/2BA"
  totalUnits: number;
  occupiedUnits: number;
  occupancyRate: number;
  avgInPlaceRent: number;
  avgMarketRent: number;
  lossToLease: number;
  avgSF: number;
  rentPerSF: number;
  concessionedUnits: number;
}

export interface LossToLeaseDetail {
  leaseId: string;
  tenantName: string;
  unitNumber: string;
  unitType: string;
  inPlaceRent: number;
  marketRent: number;
  monthlyLoss: number;
  annualLoss: number;
  leaseExpiration: string | null;
  daysToExpiry: number | null;
}

// ============================================================================
// Analytics Functions
// ============================================================================

/**
 * Calculate comprehensive multifamily KPIs.
 * Uses leaseAmount as in-place rent and baseRent2 as market/asking rent.
 */
export async function getMultifamilyKPIs(projectId: string): Promise<MultifamilyKPIs> {
  const [location] = await db
    .select({ capacity: locations.capacity })
    .from(locations)
    .where(eq(locations.id, projectId))
    .limit(1);

  const totalUnits = location?.capacity || 0;

  const stats = await db
    .select({
      occupiedUnits: sql<number>`COUNT(CASE WHEN ${leases.isActive} = true THEN 1 END)::int`,
      avgInPlace: sql<string>`AVG(CASE WHEN ${leases.isActive} = true AND ${leases.leaseAmount}::numeric > 0 THEN ${leases.leaseAmount}::numeric END)`,
      avgMarket: sql<string>`AVG(CASE WHEN ${leases.baseRent2}::numeric > 0 THEN ${leases.baseRent2}::numeric END)`,
      totalInPlace: sql<string>`COALESCE(SUM(CASE WHEN ${leases.isActive} = true THEN ${leases.leaseAmount}::numeric ELSE 0 END), 0)`,
      totalMarket: sql<string>`COALESCE(SUM(CASE WHEN ${leases.baseRent2}::numeric > 0 AND ${leases.isActive} = true THEN ${leases.baseRent2}::numeric ELSE ${leases.leaseAmount}::numeric END), 0)`,
      concessionedUnits: sql<number>`COUNT(CASE WHEN ${leases.isActive} = true AND ${leases.hasDiscount} = true THEN 1 END)::int`,
      totalDiscounts: sql<string>`COALESCE(SUM(CASE WHEN ${leases.isActive} = true AND ${leases.hasDiscount} = true THEN ${leases.discountValue}::numeric ELSE 0 END), 0)`,
      badDebt: sql<number>`COUNT(CASE WHEN ${leases.slipStatus} = 'Delinquent' THEN 1 END)::int`,
    })
    .from(leases)
    .where(eq(leases.locationId, projectId));

  const occupied = stats[0]?.occupiedUnits || 0;
  const avgInPlace = parseFloat(stats[0]?.avgInPlace?.toString() || '0');
  const avgMarket = parseFloat(stats[0]?.avgMarket?.toString() || '0') || avgInPlace;
  const totalInPlace = parseFloat(stats[0]?.totalInPlace?.toString() || '0');
  const totalMarket = parseFloat(stats[0]?.totalMarket?.toString() || '0');
  const concessionLoss = parseFloat(stats[0]?.totalDiscounts?.toString() || '0');
  const badDebt = stats[0]?.badDebt || 0;

  const physicalOcc = totalUnits > 0 ? (occupied / totalUnits) * 100 : 0;
  const grossPotential = avgMarket * totalUnits;
  const lossToLease = (totalMarket - totalInPlace) * 12;
  const lossPercent = totalMarket > 0 ? ((totalMarket - totalInPlace) / totalMarket) * 100 : 0;

  return {
    totalUnits,
    occupiedUnits: occupied,
    physicalOccupancy: Math.round(physicalOcc * 10) / 10,
    avgInPlaceRent: Math.round(avgInPlace * 100) / 100,
    avgMarketRent: Math.round(avgMarket * 100) / 100,
    lossToLease: Math.round(lossToLease * 100) / 100,
    lossToLeasePercent: Math.round(lossPercent * 10) / 10,
    grossPotentialRent: Math.round(grossPotential * 100) / 100,
    effectiveGrossIncome: Math.round((totalInPlace - concessionLoss) * 100) / 100,
    concessionLoss: Math.round(concessionLoss * 100) / 100,
    badDebtUnits: badDebt,
    renewalRate: 0, // Would require historical renewal tracking
  };
}

/**
 * Get unit mix performance by bed/bath configuration.
 */
export async function getUnitMixPerformance(projectId: string): Promise<UnitMixPerformance[]> {
  const results = await db
    .select({
      unitType: sql<string>`COALESCE(${leases.unitTypeCustom}, ${leases.storageType}::text)`,
      totalUnits: sql<number>`COUNT(*)::int`,
      occupiedUnits: sql<number>`COUNT(CASE WHEN ${leases.isActive} = true THEN 1 END)::int`,
      avgInPlace: sql<string>`AVG(CASE WHEN ${leases.isActive} = true THEN ${leases.leaseAmount}::numeric END)`,
      avgMarket: sql<string>`AVG(CASE WHEN ${leases.baseRent2}::numeric > 0 THEN ${leases.baseRent2}::numeric END)`,
      avgSF: sql<string>`AVG(${leases.unitDimension1}::numeric)`,
      concessionedUnits: sql<number>`COUNT(CASE WHEN ${leases.isActive} = true AND ${leases.hasDiscount} = true THEN 1 END)::int`,
    })
    .from(leases)
    .where(eq(leases.locationId, projectId))
    .groupBy(sql`COALESCE(${leases.unitTypeCustom}, ${leases.storageType}::text)`)
    .orderBy(desc(sql`COUNT(*)`));

  return results.map(r => {
    const total = r.totalUnits;
    const occupied = r.occupiedUnits;
    const avgIn = parseFloat(r.avgInPlace?.toString() || '0');
    const avgMkt = parseFloat(r.avgMarket?.toString() || '0') || avgIn;
    const sf = parseFloat(r.avgSF?.toString() || '0');

    return {
      unitType: r.unitType,
      totalUnits: total,
      occupiedUnits: occupied,
      occupancyRate: total > 0 ? Math.round((occupied / total) * 1000) / 10 : 0,
      avgInPlaceRent: Math.round(avgIn * 100) / 100,
      avgMarketRent: Math.round(avgMkt * 100) / 100,
      lossToLease: Math.round((avgMkt - avgIn) * occupied * 12 * 100) / 100,
      avgSF: Math.round(sf),
      rentPerSF: sf > 0 ? Math.round((avgIn / sf) * 100) / 100 : 0,
      concessionedUnits: r.concessionedUnits,
    };
  });
}

/**
 * Get detailed loss-to-lease by individual lease.
 */
export async function getLossToLeaseDetail(projectId: string): Promise<LossToLeaseDetail[]> {
  const now = new Date();

  const results = await db
    .select({
      leaseId: leases.id,
      tenantName: tenants.name,
      unitNumber: leases.unitNumber,
      unitType: sql<string>`COALESCE(${leases.unitTypeCustom}, ${leases.storageType}::text)`,
      inPlaceRent: leases.leaseAmount,
      marketRent: leases.baseRent2,
      expiration: leases.leaseExpiration,
    })
    .from(leases)
    .innerJoin(tenants, eq(leases.tenantId, tenants.id))
    .where(and(
      eq(leases.locationId, projectId),
      eq(leases.isActive, true),
    ))
    .orderBy(desc(sql`(${leases.baseRent2}::numeric - ${leases.leaseAmount}::numeric)`));

  return results
    .filter(r => {
      const mkt = parseFloat(r.marketRent?.toString() || '0');
      const inp = parseFloat(r.inPlaceRent?.toString() || '0');
      return mkt > 0 && inp > 0 && mkt > inp;
    })
    .map(r => {
      const inp = parseFloat(r.inPlaceRent?.toString() || '0');
      const mkt = parseFloat(r.marketRent?.toString() || '0');
      const monthlyLoss = mkt - inp;
      const expDate = r.expiration ? new Date(r.expiration) : null;
      const daysToExpiry = expDate ? Math.round((expDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)) : null;

      return {
        leaseId: r.leaseId,
        tenantName: r.tenantName,
        unitNumber: r.unitNumber || '',
        unitType: r.unitType,
        inPlaceRent: inp,
        marketRent: mkt,
        monthlyLoss: Math.round(monthlyLoss * 100) / 100,
        annualLoss: Math.round(monthlyLoss * 12 * 100) / 100,
        leaseExpiration: r.expiration,
        daysToExpiry,
      };
    });
}
