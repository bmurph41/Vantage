/**
 * Self-Storage Vertical Analytics
 *
 * Provides institutional-grade analytics specific to self-storage:
 * - ECRI (Existing Customer Rate Increase) engine
 * - Street rate tracking and comparison
 * - Unit mix optimization analysis
 * - Revenue per available SF
 * - Delinquency tracking
 */

import { db } from "../db";
import { rraLeases as leases, rraTenants as tenants, rraMarinaLocations as locations } from "@shared/schema";
import { eq, and, sql, desc, asc } from "drizzle-orm";

// ============================================================================
// Types
// ============================================================================

export interface ECRIOpportunity {
  leaseId: string;
  tenantName: string;
  unitType: string;
  currentMonthlyRent: number;
  streetRate: number;
  lossToStreetRate: number;    // streetRate - currentRent
  lossPercent: number;         // (loss / streetRate) * 100
  lastIncreaseDate: string | null;
  monthsSinceIncrease: number;
  suggestedNewRate: number;    // Min of street rate and current + max increase %
}

export interface UnitMixAnalysis {
  unitType: string;
  totalUnits: number;
  occupiedUnits: number;
  vacantUnits: number;
  occupancyRate: number;
  avgMonthlyRent: number;
  streetRate: number | null;
  totalSF: number;
  revenuePerAvailableSF: number;  // RevPASF
  avgTenure: number;               // Average months occupied
}

export interface StreetRateComparison {
  unitType: string;
  streetRate: number;
  avgInPlaceRate: number;
  lossToLease: number;          // Total annual $ difference
  lossToLeasePercent: number;
  unitCount: number;
}

export interface SelfStorageKPIs {
  totalUnits: number;
  occupiedUnits: number;
  physicalOccupancy: number;
  economicOccupancy: number;      // Revenue / potential revenue at street rates
  avgRentPerUnit: number;
  avgRentPerSF: number;
  revenuePerAvailableSF: number;  // RevPASF
  totalLossToLease: number;
  delinquentUnits: number;
  delinquentRevenue: number;
}

// ============================================================================
// ECRI Engine
// ============================================================================

/**
 * Analyze ECRI (Existing Customer Rate Increase) opportunities.
 * Identifies tenants paying below street rate who are eligible for increases.
 *
 * @param projectId - Location/project ID
 * @param streetRates - Map of unitType → street rate (monthly)
 * @param maxIncreasePercent - Maximum allowed increase (e.g., 10 = 10%)
 * @param minMonthsSinceIncrease - Minimum months since last increase (default 6)
 */
export async function analyzeECRIOpportunities(
  projectId: string,
  streetRates: Map<string, number>,
  maxIncreasePercent: number = 10,
  minMonthsSinceIncrease: number = 6
): Promise<ECRIOpportunity[]> {
  const activeLeases = await db
    .select({
      leaseId: leases.id,
      tenantName: tenants.name,
      unitType: sql<string>`COALESCE(${leases.unitTypeCustom}, ${leases.storageType}::text)`,
      monthlyRent: leases.leaseAmount,
      commencement: leases.leaseCommencement,
      updatedAt: leases.updatedAt,
    })
    .from(leases)
    .innerJoin(tenants, eq(leases.tenantId, tenants.id))
    .where(and(
      eq(leases.locationId, projectId),
      eq(leases.isActive, true),
    ))
    .orderBy(asc(tenants.name));

  const now = new Date();
  const opportunities: ECRIOpportunity[] = [];

  for (const lease of activeLeases) {
    const unitType = lease.unitType || 'Other';
    const currentRent = parseFloat(lease.monthlyRent?.toString() || '0');
    const streetRate = streetRates.get(unitType) || 0;

    if (currentRent <= 0 || streetRate <= 0 || currentRent >= streetRate) continue;

    const lastUpdate = lease.updatedAt ? new Date(lease.updatedAt) : null;
    const monthsSinceIncrease = lastUpdate
      ? Math.floor((now.getTime() - lastUpdate.getTime()) / (30.44 * 24 * 60 * 60 * 1000))
      : 999;

    if (monthsSinceIncrease < minMonthsSinceIncrease) continue;

    const maxIncrease = currentRent * (maxIncreasePercent / 100);
    const suggestedRate = Math.min(streetRate, currentRent + maxIncrease);
    const loss = streetRate - currentRent;

    opportunities.push({
      leaseId: lease.leaseId,
      tenantName: lease.tenantName,
      unitType,
      currentMonthlyRent: currentRent,
      streetRate,
      lossToStreetRate: Math.round(loss * 100) / 100,
      lossPercent: Math.round((loss / streetRate) * 10000) / 100,
      lastIncreaseDate: lastUpdate?.toISOString().split('T')[0] || null,
      monthsSinceIncrease,
      suggestedNewRate: Math.round(suggestedRate * 100) / 100,
    });
  }

  return opportunities.sort((a, b) => b.lossToStreetRate - a.lossToStreetRate);
}

/**
 * Analyze unit mix with occupancy, revenue, and street rate comparisons.
 */
export async function analyzeUnitMix(
  projectId: string,
  streetRates?: Map<string, number>
): Promise<UnitMixAnalysis[]> {
  const results = await db
    .select({
      unitType: sql<string>`COALESCE(${leases.unitTypeCustom}, ${leases.storageType}::text)`,
      totalUnits: sql<number>`COUNT(*)::int`,
      occupiedUnits: sql<number>`COUNT(CASE WHEN ${leases.isActive} = true THEN 1 END)::int`,
      avgMonthlyRent: sql<string>`AVG(CASE WHEN ${leases.isActive} = true THEN ${leases.leaseAmount}::numeric ELSE NULL END)`,
      totalSF: sql<string>`COALESCE(SUM(${leases.unitDimension1}::numeric), 0)`,
      totalRevenue: sql<string>`COALESCE(SUM(CASE WHEN ${leases.isActive} = true THEN ${leases.leaseAmount}::numeric ELSE 0 END), 0)`,
    })
    .from(leases)
    .where(eq(leases.locationId, projectId))
    .groupBy(sql`COALESCE(${leases.unitTypeCustom}, ${leases.storageType}::text)`)
    .orderBy(desc(sql`COUNT(*)`));

  return results.map(r => {
    const total = r.totalUnits;
    const occupied = r.occupiedUnits;
    const vacant = total - occupied;
    const avgRent = parseFloat(r.avgMonthlyRent?.toString() || '0');
    const totalSF = parseFloat(r.totalSF?.toString() || '0');
    const totalRevenue = parseFloat(r.totalRevenue?.toString() || '0');
    const sr = streetRates?.get(r.unitType) || null;

    return {
      unitType: r.unitType,
      totalUnits: total,
      occupiedUnits: occupied,
      vacantUnits: vacant,
      occupancyRate: total > 0 ? Math.round((occupied / total) * 1000) / 10 : 0,
      avgMonthlyRent: Math.round(avgRent * 100) / 100,
      streetRate: sr,
      totalSF,
      revenuePerAvailableSF: totalSF > 0 ? Math.round((totalRevenue / totalSF) * 100) / 100 : 0,
      avgTenure: 0, // Would require move-in date tracking
    };
  });
}

/**
 * Calculate comprehensive self-storage KPIs.
 */
export async function getSelfStorageKPIs(
  projectId: string,
  streetRates?: Map<string, number>
): Promise<SelfStorageKPIs> {
  const mix = await analyzeUnitMix(projectId, streetRates);

  let totalUnits = 0, occupiedUnits = 0;
  let totalRevenue = 0, totalPotentialRevenue = 0, totalSF = 0;
  let delinquentUnits = 0, delinquentRevenue = 0;

  for (const m of mix) {
    totalUnits += m.totalUnits;
    occupiedUnits += m.occupiedUnits;
    totalRevenue += m.avgMonthlyRent * m.occupiedUnits;
    totalSF += m.totalSF;
    if (m.streetRate) {
      totalPotentialRevenue += m.streetRate * m.totalUnits;
    } else {
      totalPotentialRevenue += m.avgMonthlyRent * m.totalUnits;
    }
  }

  // Count delinquent leases
  const delinquent = await db
    .select({ count: sql<number>`COUNT(*)::int`, rent: sql<string>`COALESCE(SUM(${leases.leaseAmount}::numeric), 0)` })
    .from(leases)
    .where(and(eq(leases.locationId, projectId), eq(leases.slipStatus, 'Delinquent')));

  if (delinquent[0]) {
    delinquentUnits = delinquent[0].count;
    delinquentRevenue = parseFloat(delinquent[0].rent?.toString() || '0');
  }

  const physicalOccupancy = totalUnits > 0 ? (occupiedUnits / totalUnits) * 100 : 0;
  const economicOccupancy = totalPotentialRevenue > 0 ? (totalRevenue / totalPotentialRevenue) * 100 : 0;
  const totalLossToLease = totalPotentialRevenue - totalRevenue;

  return {
    totalUnits,
    occupiedUnits,
    physicalOccupancy: Math.round(physicalOccupancy * 10) / 10,
    economicOccupancy: Math.round(economicOccupancy * 10) / 10,
    avgRentPerUnit: occupiedUnits > 0 ? Math.round((totalRevenue / occupiedUnits) * 100) / 100 : 0,
    avgRentPerSF: totalSF > 0 ? Math.round((totalRevenue / totalSF) * 100) / 100 : 0,
    revenuePerAvailableSF: totalSF > 0 ? Math.round((totalRevenue / totalSF) * 100) / 100 : 0,
    totalLossToLease: Math.round(totalLossToLease * 100) / 100,
    delinquentUnits,
    delinquentRevenue: Math.round(delinquentRevenue * 100) / 100,
  };
}
