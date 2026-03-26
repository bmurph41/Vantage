/**
 * Hotel / STR Vertical Analytics
 *
 * Provides hospitality-specific analytics:
 * - ADR (Average Daily Rate)
 * - RevPAR (Revenue Per Available Room)
 * - Occupancy by room type
 * - Seasonal performance analysis
 * - Room type revenue mix
 */

import { db } from "../db";
import { rraLeases as leases, rraMarinaLocations as locations } from "@shared/schema";
import { eq, and, sql, desc } from "drizzle-orm";

// ============================================================================
// Types
// ============================================================================

export interface HotelKPIs {
  totalKeys: number;
  occupiedKeys: number;
  occupancyRate: number;
  adr: number;                    // Average Daily Rate
  revpar: number;                 // Revenue Per Available Room (ADR × Occupancy)
  totalRoomsRevenue: number;      // Monthly
  avgLengthOfStay: number;        // Days
}

export interface RoomTypePerformance {
  roomType: string;
  totalKeys: number;
  occupiedKeys: number;
  occupancyRate: number;
  avgDailyRate: number;
  revpar: number;
  monthlyRevenue: number;
  revenueShare: number;           // % of total revenue
}

export interface SeasonalPerformance {
  period: string;                 // "Peak", "Shoulder", "Low"
  months: number[];
  avgOccupancy: number;
  avgADR: number;
  avgRevPAR: number;
}

// ============================================================================
// Analytics Functions
// ============================================================================

/**
 * Calculate hotel/STR KPIs from lease data.
 * In hotel mode, each "lease" represents a room/key allocation.
 * leaseAmount represents the nightly rate.
 */
export async function getHotelKPIs(projectId: string): Promise<HotelKPIs> {
  const [location] = await db
    .select({ capacity: locations.capacity })
    .from(locations)
    .where(eq(locations.id, projectId))
    .limit(1);

  const totalKeys = location?.capacity || 0;

  const stats = await db
    .select({
      occupiedKeys: sql<number>`COUNT(CASE WHEN ${leases.isActive} = true THEN 1 END)::int`,
      avgRate: sql<string>`AVG(CASE WHEN ${leases.isActive} = true THEN ${leases.leaseAmount}::numeric END)`,
      totalRevenue: sql<string>`COALESCE(SUM(CASE WHEN ${leases.isActive} = true THEN ${leases.leaseAmount}::numeric * 30 ELSE 0 END), 0)`,
      avgStay: sql<string>`AVG(CASE WHEN ${leases.numMonths} IS NOT NULL THEN ${leases.numMonths}::numeric * 30 END)`,
    })
    .from(leases)
    .where(eq(leases.locationId, projectId));

  const occupied = stats[0]?.occupiedKeys || 0;
  const adr = parseFloat(stats[0]?.avgRate?.toString() || '0');
  const totalRevenue = parseFloat(stats[0]?.totalRevenue?.toString() || '0');
  const avgStay = parseFloat(stats[0]?.avgStay?.toString() || '0');
  const occupancyRate = totalKeys > 0 ? (occupied / totalKeys) * 100 : 0;
  const revpar = adr * (occupancyRate / 100);

  return {
    totalKeys,
    occupiedKeys: occupied,
    occupancyRate: Math.round(occupancyRate * 10) / 10,
    adr: Math.round(adr * 100) / 100,
    revpar: Math.round(revpar * 100) / 100,
    totalRoomsRevenue: Math.round(totalRevenue * 100) / 100,
    avgLengthOfStay: Math.round(avgStay * 10) / 10,
  };
}

/**
 * Get performance breakdown by room type.
 */
export async function getRoomTypePerformance(projectId: string): Promise<RoomTypePerformance[]> {
  const [location] = await db
    .select({ capacity: locations.capacity })
    .from(locations)
    .where(eq(locations.id, projectId))
    .limit(1);

  const results = await db
    .select({
      roomType: sql<string>`COALESCE(${leases.unitTypeCustom}, ${leases.storageType}::text)`,
      totalKeys: sql<number>`COUNT(*)::int`,
      occupiedKeys: sql<number>`COUNT(CASE WHEN ${leases.isActive} = true THEN 1 END)::int`,
      avgRate: sql<string>`AVG(CASE WHEN ${leases.isActive} = true THEN ${leases.leaseAmount}::numeric END)`,
      totalRevenue: sql<string>`COALESCE(SUM(CASE WHEN ${leases.isActive} = true THEN ${leases.leaseAmount}::numeric * 30 ELSE 0 END), 0)`,
    })
    .from(leases)
    .where(eq(leases.locationId, projectId))
    .groupBy(sql`COALESCE(${leases.unitTypeCustom}, ${leases.storageType}::text)`)
    .orderBy(desc(sql`SUM(CASE WHEN ${leases.isActive} = true THEN ${leases.leaseAmount}::numeric * 30 ELSE 0 END)`));

  const totalRev = results.reduce((s, r) => s + parseFloat(r.totalRevenue?.toString() || '0'), 0);

  return results.map(r => {
    const total = r.totalKeys;
    const occupied = r.occupiedKeys;
    const avgRate = parseFloat(r.avgRate?.toString() || '0');
    const rev = parseFloat(r.totalRevenue?.toString() || '0');
    const occ = total > 0 ? (occupied / total) * 100 : 0;

    return {
      roomType: r.roomType,
      totalKeys: total,
      occupiedKeys: occupied,
      occupancyRate: Math.round(occ * 10) / 10,
      avgDailyRate: Math.round(avgRate * 100) / 100,
      revpar: Math.round(avgRate * (occ / 100) * 100) / 100,
      monthlyRevenue: Math.round(rev * 100) / 100,
      revenueShare: totalRev > 0 ? Math.round((rev / totalRev) * 1000) / 10 : 0,
    };
  });
}
