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
  totalUnits: number;       // UI field: totalUnits (was totalKeys)
  occupiedUnits: number;    // UI field: occupiedUnits (was occupiedKeys)
  occupancyPct: number;     // UI field: occupancyPct (was occupancyRate)
  avgNightlyRate: number;   // UI field: avgNightlyRate (was avgDailyRate)
  revpar: number;
  totalRevenue: number;     // UI field: totalRevenue (was monthlyRevenue)
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
      totalUnits: total,
      occupiedUnits: occupied,
      occupancyPct: Math.round(occ * 10) / 10,
      avgNightlyRate: Math.round(avgRate * 100) / 100,
      revpar: Math.round(avgRate * (occ / 100) * 100) / 100,
      totalRevenue: Math.round(rev * 100) / 100,
      revenueShare: totalRev > 0 ? Math.round((rev / totalRev) * 1000) / 10 : 0,
    };
  });
}

// ============================================================================
// New Analytics: ADR Trend & Channel Mix (Phase 9C)
// ============================================================================

export interface ADRTrendPoint {
  month: number;
  year: number;
  monthLabel: string;
  adr: number;
  occupancyPct: number;
  revpar: number;
}

export interface ChannelMixItem {
  channel: string;
  leaseCount: number;
  totalRevenue: number;
  pctOfRevenue: number;
  avgADR: number;
}

const MONTH_LABELS_H = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

/**
 * Get month-by-month ADR and occupancy trend (trailing N months)
 */
export async function getADRTrend(projectId: string, months: number = 12): Promise<ADRTrendPoint[]> {
  const [location] = await db
    .select({ capacity: locations.capacity })
    .from(locations)
    .where(eq(locations.id, projectId))
    .limit(1);

  const totalKeys = location?.capacity || 1;
  const now = new Date();
  const result: ADRTrendPoint[] = [];

  for (let i = months - 1; i >= 0; i--) {
    const targetDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const month = targetDate.getMonth() + 1;
    const year = targetDate.getFullYear();

    const firstDay = `${year}-${String(month).padStart(2, "0")}-01`;
    const lastDay = new Date(year, month, 0);
    const lastDayStr = `${year}-${String(month).padStart(2, "0")}-${String(lastDay.getDate()).padStart(2, "0")}`;

    // Filter leases that were active during this specific month period
    const [stats] = await db
      .select({
        activeCount: sql<number>`COUNT(*)::int`,
        avgRate: sql<string>`AVG(${leases.leaseAmount}::numeric)`,
      })
      .from(leases)
      .where(
        and(
          eq(leases.locationId, projectId),
          eq(leases.isActive, true),
          sql`(${leases.leaseCommencement} IS NULL OR ${leases.leaseCommencement} <= ${lastDayStr}::date)`,
          sql`(${leases.leaseExpiration} IS NULL OR ${leases.leaseExpiration} >= ${firstDay}::date)`
        )
      );

    const occupied = stats?.activeCount || 0;
    const adr = parseFloat(stats?.avgRate?.toString() || "0");
    const occupancyPct = totalKeys > 0 ? Math.round((occupied / totalKeys) * 1000) / 10 : 0;
    const revpar = Math.round(adr * (occupancyPct / 100) * 100) / 100;

    result.push({
      month,
      year,
      monthLabel: `${MONTH_LABELS_H[month - 1]} '${String(year).slice(2)}`,
      adr: Math.round(adr * 100) / 100,
      occupancyPct,
      revpar,
    });
  }

  return result;
}

/**
 * Get revenue breakdown by booking source (channel mix).
 * Uses unitLocation field as booking source proxy.
 * Falls back to a synthetic distribution if no channel data exists.
 */
export async function getChannelMix(projectId: string): Promise<ChannelMixItem[]> {
  const results = await db
    .select({
      channel: sql<string>`COALESCE(NULLIF(${leases.unitLocation}, ''), 'Direct')`,
      leaseCount: sql<number>`COUNT(*)::int`,
      totalRevenue: sql<string>`COALESCE(SUM(CASE WHEN ${leases.isActive} = true THEN ${leases.leaseAmount}::numeric * 30 ELSE 0 END), 0)`,
      avgRate: sql<string>`AVG(CASE WHEN ${leases.isActive} = true THEN ${leases.leaseAmount}::numeric END)`,
    })
    .from(leases)
    .where(eq(leases.locationId, projectId))
    .groupBy(sql`COALESCE(NULLIF(${leases.unitLocation}, ''), 'Direct')`);

  const totalRevenue = results.reduce((s, r) => s + parseFloat(r.totalRevenue?.toString() || "0"), 0);

  if (totalRevenue === 0) {
    // No channel data exists yet — return empty array (caller shows "no data" state)
    return [];
  }

  return results.map(r => {
    const rev = parseFloat(r.totalRevenue?.toString() || "0");
    return {
      channel: r.channel,
      leaseCount: r.leaseCount,
      totalRevenue: Math.round(rev * 100) / 100,
      pctOfRevenue: totalRevenue > 0 ? Math.round((rev / totalRevenue) * 1000) / 10 : 0,
      avgADR: Math.round(parseFloat(r.avgRate?.toString() || "0") * 100) / 100,
    };
  });
}
