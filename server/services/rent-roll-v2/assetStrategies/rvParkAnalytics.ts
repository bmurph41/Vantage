/**
 * RV Park / Mobile Home Park Vertical Analytics
 *
 * Provides RV Park and MHP-specific analytics:
 * - Pad occupancy and avg pad rent
 * - Seasonal occupancy curve (12-month)
 * - Pad mix performance by type
 * - Churn rate and avg length of stay
 * - Amenity fee contribution
 */

import { db } from "../db";
import { rraLeases as leases, rraTenants as tenants, rraMarinaLocations as locations } from "@shared/schema";
import { eq, and, sql, desc, gte, lte } from "drizzle-orm";

// ============================================================================
// Types
// ============================================================================

export interface RVParkKPIs {
  totalPads: number;
  occupiedPads: number;
  padOccupancyPct: number;
  avgPadRent: number;
  churnRate: number;
  avgLengthOfStayMonths: number;
  amenityFeeContribution: number;
  totalMonthlyRevenue: number;
  seasonalOccupancyCurve: { month: number; monthLabel: string; occupancyPct: number }[];
}

export interface PadMixPerformance {
  padType: string;
  totalPads: number;
  occupiedPads: number;
  occupancyRate: number;
  avgMonthlyRent: number;
  avgAmenityFee: number;
  totalRevenue: number;
  revenueShare: number;
}

export interface SeasonalDemandAnalysis {
  month: number;
  monthLabel: string;
  currentYearOccupancy: number;
  priorYearOccupancy: number;
  delta: number;
}

// ============================================================================
// Analytics Functions
// ============================================================================

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const RV_PAD_TYPES = ["full-hookup", "electric-only", "tent", "cabin", "pull-through", "back-in", "premium", "standard", "seasonal"];

/**
 * Get RV Park / MHP KPIs
 */
export async function getRVParkKPIs(locationId: string): Promise<RVParkKPIs> {
  const [location] = await db
    .select({ capacity: locations.capacity })
    .from(locations)
    .where(eq(locations.id, locationId))
    .limit(1);

  const totalPads = location?.capacity || 0;

  const stats = await db
    .select({
      occupiedPads: sql<number>`COUNT(CASE WHEN ${leases.isActive} = true THEN 1 END)::int`,
      avgRent: sql<string>`AVG(CASE WHEN ${leases.isActive} = true AND ${leases.leaseAmount}::numeric > 0 THEN ${leases.leaseAmount}::numeric END)`,
      totalRevenue: sql<string>`COALESCE(SUM(CASE WHEN ${leases.isActive} = true THEN ${leases.leaseAmount}::numeric ELSE 0 END), 0)`,
      avgStayMonths: sql<string>`AVG(CASE WHEN ${leases.numMonths} IS NOT NULL AND ${leases.numMonths} > 0 THEN ${leases.numMonths}::numeric END)`,
      totalAmenity: sql<string>`COALESCE(SUM(CASE WHEN ${leases.isActive} = true THEN (${leases.additionalCharge1}::numeric + ${leases.additionalCharge2}::numeric + ${leases.additionalCharge3}::numeric) ELSE 0 END), 0)`,
      recentlyTerminated: sql<number>`COUNT(CASE WHEN ${leases.isActive} = false AND ${leases.updatedAt} > NOW() - INTERVAL '90 days' THEN 1 END)::int`,
    })
    .from(leases)
    .where(eq(leases.locationId, locationId));

  const occupied = stats[0]?.occupiedPads || 0;
  const avgRent = parseFloat(stats[0]?.avgRent?.toString() || "0");
  const totalRevenue = parseFloat(stats[0]?.totalRevenue?.toString() || "0");
  const avgStay = parseFloat(stats[0]?.avgStayMonths?.toString() || "0") || 6;
  const amenityTotal = parseFloat(stats[0]?.totalAmenity?.toString() || "0");
  const recentlyTerminated = stats[0]?.recentlyTerminated || 0;

  const padOccupancyPct = totalPads > 0 ? Math.round((occupied / totalPads) * 1000) / 10 : 0;
  const churnRate = occupied + recentlyTerminated > 0
    ? Math.round((recentlyTerminated / (occupied + recentlyTerminated)) * 1000) / 10
    : 0;

  // Build 12-month seasonal occupancy curve from move events or lease dates
  const seasonalOccupancyCurve = await buildSeasonalOccupancyCurve(locationId, totalPads);

  return {
    totalPads,
    occupiedPads: occupied,
    padOccupancyPct,
    avgPadRent: Math.round(avgRent * 100) / 100,
    churnRate,
    avgLengthOfStayMonths: Math.round(avgStay * 10) / 10,
    amenityFeeContribution: Math.round(amenityTotal * 100) / 100,
    totalMonthlyRevenue: Math.round(totalRevenue * 100) / 100,
    seasonalOccupancyCurve,
  };
}

async function buildSeasonalOccupancyCurve(
  locationId: string,
  totalPads: number
): Promise<{ month: number; monthLabel: string; occupancyPct: number }[]> {
  const now = new Date();
  const result: { month: number; monthLabel: string; occupancyPct: number }[] = [];

  for (let i = 11; i >= 0; i--) {
    const targetDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const month = targetDate.getMonth() + 1;
    const year = targetDate.getFullYear();

    const firstDay = `${year}-${String(month).padStart(2, "0")}-01`;
    const lastDay = new Date(year, month, 0);
    const lastDayStr = `${year}-${String(month).padStart(2, "0")}-${String(lastDay.getDate()).padStart(2, "0")}`;

    const [monthStats] = await db
      .select({
        activeCount: sql<number>`COUNT(CASE WHEN 
          ${leases.isActive} = true OR 
          (${leases.leaseExpiration} >= ${firstDay}::date AND ${leases.leaseCommencement} <= ${lastDayStr}::date)
          THEN 1 END)::int`,
      })
      .from(leases)
      .where(eq(leases.locationId, locationId));

    const activeCount = monthStats?.activeCount || 0;
    const occupancyPct = totalPads > 0 ? Math.round((activeCount / totalPads) * 1000) / 10 : 0;

    result.push({
      month,
      monthLabel: `${MONTH_LABELS[month - 1]} '${String(year).slice(2)}`,
      occupancyPct,
    });
  }

  return result;
}

/**
 * Get pad mix performance by pad type
 */
export async function getPadMixPerformance(locationId: string): Promise<PadMixPerformance[]> {
  const results = await db
    .select({
      padType: sql<string>`COALESCE(${leases.unitTypeCustom}, ${leases.storageType}::text, 'Standard')`,
      totalPads: sql<number>`COUNT(*)::int`,
      occupiedPads: sql<number>`COUNT(CASE WHEN ${leases.isActive} = true THEN 1 END)::int`,
      avgRent: sql<string>`AVG(CASE WHEN ${leases.isActive} = true THEN ${leases.leaseAmount}::numeric END)`,
      totalRevenue: sql<string>`COALESCE(SUM(CASE WHEN ${leases.isActive} = true THEN ${leases.leaseAmount}::numeric ELSE 0 END), 0)`,
      avgAmenity: sql<string>`AVG(CASE WHEN ${leases.isActive} = true THEN (${leases.additionalCharge1}::numeric + ${leases.additionalCharge2}::numeric + ${leases.additionalCharge3}::numeric) END)`,
    })
    .from(leases)
    .where(eq(leases.locationId, locationId))
    .groupBy(sql`COALESCE(${leases.unitTypeCustom}, ${leases.storageType}::text, 'Standard')`);

  const totalRevenue = results.reduce((sum, r) => sum + parseFloat(r.totalRevenue?.toString() || "0"), 0);

  return results.map((r) => {
    const revenue = parseFloat(r.totalRevenue?.toString() || "0");
    return {
      padType: r.padType || "Standard",
      totalPads: r.totalPads || 0,
      occupiedPads: r.occupiedPads || 0,
      occupancyRate: r.totalPads > 0 ? Math.round((r.occupiedPads / r.totalPads) * 1000) / 10 : 0,
      avgMonthlyRent: Math.round(parseFloat(r.avgRent?.toString() || "0") * 100) / 100,
      avgAmenityFee: Math.round(parseFloat(r.avgAmenity?.toString() || "0") * 100) / 100,
      totalRevenue: Math.round(revenue * 100) / 100,
      revenueShare: totalRevenue > 0 ? Math.round((revenue / totalRevenue) * 1000) / 10 : 0,
    };
  });
}

/**
 * Get seasonal demand analysis with prior year comparison
 */
export async function getSeasonalDemandAnalysis(locationId: string): Promise<SeasonalDemandAnalysis[]> {
  const [location] = await db
    .select({ capacity: locations.capacity })
    .from(locations)
    .where(eq(locations.id, locationId))
    .limit(1);

  const totalPads = location?.capacity || 1;
  const now = new Date();
  const result: SeasonalDemandAnalysis[] = [];

  for (let month = 1; month <= 12; month++) {
    const currentYear = now.getFullYear();
    const priorYear = currentYear - 1;

    const currentFirstDay = `${currentYear}-${String(month).padStart(2, "0")}-01`;
    const currentLastDay = new Date(currentYear, month, 0);
    const currentLastDayStr = `${currentYear}-${String(month).padStart(2, "0")}-${String(currentLastDay.getDate()).padStart(2, "0")}`;

    const priorFirstDay = `${priorYear}-${String(month).padStart(2, "0")}-01`;
    const priorLastDay = new Date(priorYear, month, 0);
    const priorLastDayStr = `${priorYear}-${String(month).padStart(2, "0")}-${String(priorLastDay.getDate()).padStart(2, "0")}`;

    const [currentStats] = await db
      .select({
        count: sql<number>`COUNT(CASE WHEN 
          (${leases.leaseCommencement} IS NULL OR ${leases.leaseCommencement} <= ${currentLastDayStr}::date) AND
          (${leases.leaseExpiration} IS NULL OR ${leases.leaseExpiration} >= ${currentFirstDay}::date)
          THEN 1 END)::int`,
      })
      .from(leases)
      .where(eq(leases.locationId, locationId));

    const [priorStats] = await db
      .select({
        count: sql<number>`COUNT(CASE WHEN 
          (${leases.leaseCommencement} IS NULL OR ${leases.leaseCommencement} <= ${priorLastDayStr}::date) AND
          (${leases.leaseExpiration} IS NULL OR ${leases.leaseExpiration} >= ${priorFirstDay}::date)
          THEN 1 END)::int`,
      })
      .from(leases)
      .where(eq(leases.locationId, locationId));

    const currentOcc = Math.round(((currentStats?.count || 0) / totalPads) * 1000) / 10;
    const priorOcc = Math.round(((priorStats?.count || 0) / totalPads) * 1000) / 10;

    result.push({
      month,
      monthLabel: MONTH_LABELS[month - 1],
      currentYearOccupancy: currentOcc,
      priorYearOccupancy: priorOcc,
      delta: Math.round((currentOcc - priorOcc) * 10) / 10,
    });
  }

  return result;
}
