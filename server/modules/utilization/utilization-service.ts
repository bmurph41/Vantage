import { db } from '../../db';
import { eq, and, or, lte, gte, isNull, sql, inArray } from 'drizzle-orm';
import {
  utilInventoryUnits,
  utilOccupancyEvents,
  utilOfflineBlocks,
  utilSnapshots,
} from '../../../shared/schema';
import type {
  InventoryUnit,
  OccupancyEvent,
  UnitUtilization,
  WeightedUtilization,
  EconomicUtilization,
  UnitTypeBreakdown,
  UtilizationSummary,
  UtilizationPeriod,
  ChurnMetrics,
  UtilizationMode,
} from './utilization-types';
import type { AssetClass } from './utilization-config';
import { getAssetClassConfig, getUnitTypeConfig, getBandForLength } from './utilization-config';
import {
  computeUnitUtilization,
  computeWeightedUtilization,
  computeEconomicUtilization,
  computeUnitTypeBreakdown,
  computeChurn,
} from './utilization-engine';
import { daysBetween, startOfMonth, endOfMonth, fractionOfPeriod } from './overlap';

function toInventoryUnit(row: any): InventoryUnit {
  return {
    id: row.id,
    propertyId: row.propertyId,
    unitCode: row.unitCode,
    unitType: row.unitType,
    bandKey: row.bandKey ?? null,
    lengthFt: row.lengthFt ? parseFloat(row.lengthFt) : null,
    widthFt: row.widthFt ? parseFloat(row.widthFt) : null,
    depthFt: row.depthFt ? parseFloat(row.depthFt) : null,
    sqft: row.sqft ? parseFloat(row.sqft) : null,
    isAvailable: row.isAvailable,
    isOffline: row.isOffline,
    offlineReasonCode: row.offlineReasonCode ?? undefined,
  };
}

function toOccupancyEvent(row: any): OccupancyEvent {
  return {
    unitId: row.unitId,
    leaseId: row.leaseId ?? null,
    tenantId: row.tenantId ?? null,
    startDate: row.startDate,
    endDate: row.endDate ?? null,
    isContracted: row.isContracted,
    monthlyRevenue: parseFloat(row.monthlyRevenue ?? '0'),
    annualRevenue: parseFloat(row.annualRevenue ?? '0'),
  };
}

export async function fetchInventoryUnits(
  propertyId: string,
  unitTypes?: string[]
): Promise<InventoryUnit[]> {
  const conditions = [eq(utilInventoryUnits.propertyId, propertyId)];
  if (unitTypes?.length) {
    conditions.push(inArray(utilInventoryUnits.unitType, unitTypes));
  }
  const rows = await db.select().from(utilInventoryUnits).where(and(...conditions));
  return rows.map(toInventoryUnit);
}

export async function fetchOccupancyEvents(
  propertyId: string,
  periodStart: string,
  periodEnd: string,
  unitTypes?: string[]
): Promise<OccupancyEvent[]> {
  const conditions = [
    eq(utilOccupancyEvents.propertyId, propertyId),
    eq(utilOccupancyEvents.isContracted, true),
    lte(utilOccupancyEvents.startDate, periodEnd),
    or(
      isNull(utilOccupancyEvents.endDate),
      gte(utilOccupancyEvents.endDate, periodStart)
    ),
  ];
  if (unitTypes?.length) {
    conditions.push(inArray(utilOccupancyEvents.unitType, unitTypes));
  }
  const rows = await db.select().from(utilOccupancyEvents).where(and(...conditions));
  return rows.map(toOccupancyEvent);
}

export async function fetchOfflineBlocks(
  propertyId: string,
  periodStart: string,
  periodEnd: string
): Promise<any[]> {
  const rows = await db.select().from(utilOfflineBlocks).where(
    and(
      eq(utilOfflineBlocks.propertyId, propertyId),
      lte(utilOfflineBlocks.startDate, periodEnd),
      or(
        isNull(utilOfflineBlocks.endDate),
        gte(utilOfflineBlocks.endDate, periodStart)
      )
    )
  );
  return rows;
}

function applyOfflineBlocks(
  units: InventoryUnit[],
  offlineBlocks: any[],
  periodStart: string,
  periodEnd: string
): InventoryUnit[] {
  const offlineUnitIds = new Set<string>();

  for (const block of offlineBlocks) {
    if (block.scopeType === 'unit' && block.unitId) {
      offlineUnitIds.add(block.unitId);
    } else if (block.scopeType === 'band') {
      for (const u of units) {
        if (u.bandKey === block.scopeKey) offlineUnitIds.add(u.id);
      }
    } else if (block.scopeType === 'unit_type') {
      for (const u of units) {
        if (u.unitType === block.scopeKey) offlineUnitIds.add(u.id);
      }
    } else if (block.scopeType === 'property') {
      for (const u of units) offlineUnitIds.add(u.id);
    }
  }

  return units.map(u => ({
    ...u,
    isOffline: u.isOffline || offlineUnitIds.has(u.id),
  }));
}

export async function computeRealUtilization(
  propertyId: string,
  periodStart: string,
  periodEnd: string,
  assetClass: AssetClass = 'marina',
  mode: UtilizationMode = 'contracted',
  unitTypes?: string[]
): Promise<UtilizationSummary> {
  const config = getAssetClassConfig(assetClass);
  if (!config) throw new Error(`Unknown asset class: ${assetClass}`);

  const totalDays = daysBetween(periodStart, periodEnd);
  const period: UtilizationPeriod = { startDate: periodStart, endDate: periodEnd, totalDays };

  const [rawUnits, occupancy, offlineBlocks] = await Promise.all([
    fetchInventoryUnits(propertyId, unitTypes),
    fetchOccupancyEvents(propertyId, periodStart, periodEnd, unitTypes),
    fetchOfflineBlocks(propertyId, periodStart, periodEnd),
  ]);

  const units = applyOfflineBlocks(rawUnits, offlineBlocks, periodStart, periodEnd);

  const primaryDenom = Object.values(config.unitTypes)[0]?.denomType ?? 'count';

  const overallUnitUtil = computeUnitUtilization(units, occupancy, period);
  const overallWeightedUtil = computeWeightedUtilization(units, occupancy, period, primaryDenom);
  const overallEconUtil = computeEconomicUtilization(units, occupancy, period, primaryDenom);

  const unitTypeKeys = unitTypes?.length ? unitTypes : Object.keys(config.unitTypes);
  const byUnitType: UnitTypeBreakdown[] = [];
  for (const ut of unitTypeKeys) {
    const breakdown = computeUnitTypeBreakdown(units, occupancy, period, assetClass, ut);
    if (breakdown) byUnitType.push(breakdown);
  }

  const moveInCount = occupancy.filter(o => {
    const start = new Date(o.startDate);
    return start >= new Date(periodStart) && start <= new Date(periodEnd);
  }).length;

  const moveOutCount = occupancy.filter(o => {
    if (!o.endDate) return false;
    const end = new Date(o.endDate);
    return end >= new Date(periodStart) && end <= new Date(periodEnd);
  }).length;

  const tenuresMonths = occupancy
    .filter(o => o.endDate)
    .map(o => daysBetween(o.startDate, o.endDate!) / 30.44);
  const avgTenure = tenuresMonths.length > 0
    ? tenuresMonths.reduce((s, v) => s + v, 0) / tenuresMonths.length
    : null;

  const churn = computeChurn(moveInCount, moveOutCount, avgTenure);

  return {
    propertyId,
    propertyName: propertyId,
    assetClass,
    period,
    mode,
    overall: {
      unitUtil: overallUnitUtil,
      weightedUtil: overallWeightedUtil,
      economicUtil: overallEconUtil,
    },
    byUnitType,
    churn,
    generatedAt: new Date().toISOString(),
  };
}

export async function computeAndStoreSnapshot(
  orgId: string,
  propertyId: string,
  periodStart: string,
  periodEnd: string,
  assetClass: AssetClass = 'marina',
  mode: UtilizationMode = 'contracted'
): Promise<void> {
  const summary = await computeRealUtilization(propertyId, periodStart, periodEnd, assetClass, mode);

  await upsertSnapshot(orgId, propertyId, assetClass, periodStart, periodEnd, null, null, mode, summary.overall, summary.churn);

  for (const utBreakdown of summary.byUnitType) {
    await upsertSnapshot(
      orgId, propertyId, assetClass, periodStart, periodEnd,
      utBreakdown.unitType, null, mode,
      { unitUtil: utBreakdown.unitUtil, weightedUtil: utBreakdown.weightedUtil, economicUtil: utBreakdown.economicUtil },
      null
    );

    for (const band of utBreakdown.bands) {
      await upsertSnapshot(
        orgId, propertyId, assetClass, periodStart, periodEnd,
        utBreakdown.unitType, band.bandKey, mode,
        { unitUtil: band.unitUtil, weightedUtil: band.weightedUtil, economicUtil: band.economicUtil },
        null
      );
    }
  }
}

async function upsertSnapshot(
  orgId: string,
  propertyId: string,
  assetClass: AssetClass,
  periodStart: string,
  periodEnd: string,
  unitType: string | null,
  bandKey: string | null,
  mode: UtilizationMode,
  metrics: {
    unitUtil: UnitUtilization;
    weightedUtil: WeightedUtilization;
    economicUtil: EconomicUtilization;
  },
  churn: ChurnMetrics | null
): Promise<void> {
  const totalDays = daysBetween(periodStart, periodEnd);
  const offlineCapTime = metrics.weightedUtil.offlineCapacity * totalDays;

  let totalRevenue = 0;
  if (metrics.economicUtil.revenuePerAvailableCapacityTime > 0 && metrics.weightedUtil.availableCapacity > 0) {
    totalRevenue = metrics.economicUtil.revenuePerAvailableCapacityTime * metrics.weightedUtil.availableCapacity * totalDays;
  }

  const existing = await db.select({ id: utilSnapshots.id }).from(utilSnapshots).where(
    and(
      eq(utilSnapshots.propertyId, propertyId),
      eq(utilSnapshots.periodStart, periodStart),
      eq(utilSnapshots.periodEnd, periodEnd),
      unitType ? eq(utilSnapshots.unitType, unitType) : isNull(utilSnapshots.unitType),
      bandKey ? eq(utilSnapshots.bandKey, bandKey) : isNull(utilSnapshots.bandKey),
      eq(utilSnapshots.mode, mode)
    )
  );

  const values = {
    orgId,
    propertyId,
    assetClass,
    periodStart,
    periodEnd,
    unitType,
    bandKey,
    mode,
    totalUnits: metrics.unitUtil.totalUnits,
    occupiedUnits: metrics.unitUtil.occupiedUnits,
    offlineUnits: metrics.unitUtil.offlineUnits,
    availableUnits: metrics.unitUtil.availableUnits,
    unitUtilPct: String(metrics.unitUtil.utilizationPct),
    totalCapacity: String(metrics.weightedUtil.totalCapacity),
    occupiedCapacity: String(metrics.weightedUtil.occupiedCapacity),
    offlineCapacity: String(metrics.weightedUtil.offlineCapacity),
    weightedUtilPct: String(metrics.weightedUtil.weightedUtilPct),
    revenue: String(totalRevenue),
    revenuePerAvailCapTime: String(metrics.economicUtil.revenuePerAvailableCapacityTime),
    offlineCapacityTime: String(offlineCapTime),
    churnMoveIns: churn?.moveIns ?? 0,
    churnMoveOuts: churn?.moveOuts ?? 0,
    metadata: {},
  };

  if (existing.length > 0) {
    await db.update(utilSnapshots).set(values).where(eq(utilSnapshots.id, existing[0].id));
  } else {
    await db.insert(utilSnapshots).values(values);
  }
}

export async function recomputeSnapshots(
  orgId: string,
  propertyId: string,
  startMonth: string,
  endMonth: string,
  assetClass: AssetClass = 'marina',
  mode: UtilizationMode = 'contracted'
): Promise<{ monthsProcessed: number }> {
  const start = new Date(startMonth + '-01');
  const end = new Date(endMonth + '-01');
  let monthsProcessed = 0;

  const current = new Date(start);
  while (current <= end) {
    const pStart = startOfMonth(current);
    const pEnd = endOfMonth(current);
    await computeAndStoreSnapshot(orgId, propertyId, pStart, pEnd, assetClass, mode);
    monthsProcessed++;
    current.setMonth(current.getMonth() + 1);
  }

  return { monthsProcessed };
}

export async function fetchSnapshotSummary(
  propertyId: string,
  periodStart: string,
  periodEnd: string,
  mode: UtilizationMode = 'contracted'
): Promise<UtilizationSummary | null> {
  const overallSnap = await db.select().from(utilSnapshots).where(
    and(
      eq(utilSnapshots.propertyId, propertyId),
      eq(utilSnapshots.periodStart, periodStart),
      eq(utilSnapshots.periodEnd, periodEnd),
      isNull(utilSnapshots.unitType),
      isNull(utilSnapshots.bandKey),
      eq(utilSnapshots.mode, mode)
    )
  );

  if (overallSnap.length === 0) return null;

  const snap = overallSnap[0];

  const unitTypeSnaps = await db.select().from(utilSnapshots).where(
    and(
      eq(utilSnapshots.propertyId, propertyId),
      eq(utilSnapshots.periodStart, periodStart),
      eq(utilSnapshots.periodEnd, periodEnd),
      sql`${utilSnapshots.unitType} IS NOT NULL`,
      isNull(utilSnapshots.bandKey),
      eq(utilSnapshots.mode, mode)
    )
  );

  const bandSnaps = await db.select().from(utilSnapshots).where(
    and(
      eq(utilSnapshots.propertyId, propertyId),
      eq(utilSnapshots.periodStart, periodStart),
      eq(utilSnapshots.periodEnd, periodEnd),
      sql`${utilSnapshots.unitType} IS NOT NULL`,
      sql`${utilSnapshots.bandKey} IS NOT NULL`,
      eq(utilSnapshots.mode, mode)
    )
  );

  const totalDays = daysBetween(periodStart, periodEnd);

  const byUnitType: UnitTypeBreakdown[] = unitTypeSnaps.map(utSnap => {
    const bands = bandSnaps
      .filter(b => b.unitType === utSnap.unitType)
      .map(b => ({
        bandKey: b.bandKey!,
        bandLabel: b.bandKey!,
        unitUtil: snapToUnitUtil(b),
        weightedUtil: snapToWeightedUtil(b),
        economicUtil: snapToEconUtil(b),
      }));

    return {
      unitType: utSnap.unitType!,
      unitTypeLabel: utSnap.unitType!,
      unitUtil: snapToUnitUtil(utSnap),
      weightedUtil: snapToWeightedUtil(utSnap),
      economicUtil: snapToEconUtil(utSnap),
      bands,
    };
  });

  return {
    propertyId,
    propertyName: propertyId,
    assetClass: snap.assetClass as AssetClass,
    period: { startDate: periodStart, endDate: periodEnd, totalDays },
    mode: snap.mode as UtilizationMode,
    overall: {
      unitUtil: snapToUnitUtil(snap),
      weightedUtil: snapToWeightedUtil(snap),
      economicUtil: snapToEconUtil(snap),
    },
    byUnitType,
    churn: {
      moveIns: snap.churnMoveIns ?? 0,
      moveOuts: snap.churnMoveOuts ?? 0,
      netAbsorption: (snap.churnMoveIns ?? 0) - (snap.churnMoveOuts ?? 0),
      avgTenureMonths: null,
    },
    generatedAt: snap.createdAt.toISOString(),
  };
}

function snapToUnitUtil(snap: any): UnitUtilization {
  return {
    totalUnits: snap.totalUnits,
    occupiedUnits: snap.occupiedUnits,
    vacantUnits: snap.availableUnits - snap.occupiedUnits,
    offlineUnits: snap.offlineUnits,
    availableUnits: snap.availableUnits,
    utilizationPct: parseFloat(snap.unitUtilPct),
  };
}

function snapToWeightedUtil(snap: any): WeightedUtilization {
  return {
    denomType: 'lf',
    totalCapacity: parseFloat(snap.totalCapacity),
    occupiedCapacity: parseFloat(snap.occupiedCapacity),
    offlineCapacity: parseFloat(snap.offlineCapacity),
    availableCapacity: parseFloat(snap.totalCapacity) - parseFloat(snap.offlineCapacity),
    weightedUtilPct: parseFloat(snap.weightedUtilPct),
    label: 'Linear Feet',
  };
}

function snapToEconUtil(snap: any): EconomicUtilization {
  return {
    revenuePerAvailableCapacityTime: parseFloat(snap.revenuePerAvailCapTime),
    effectiveRate: 0,
    rackRate: null,
    rateRealizationPct: null,
    label: 'Rev/Available LF-Day',
  };
}

export async function fetchBandBreakdown(
  propertyId: string,
  periodStart: string,
  periodEnd: string,
  mode: UtilizationMode = 'contracted'
): Promise<any[]> {
  const bandSnaps = await db.select().from(utilSnapshots).where(
    and(
      eq(utilSnapshots.propertyId, propertyId),
      eq(utilSnapshots.periodStart, periodStart),
      eq(utilSnapshots.periodEnd, periodEnd),
      sql`${utilSnapshots.bandKey} IS NOT NULL`,
      eq(utilSnapshots.mode, mode)
    )
  );

  if (bandSnaps.length > 0) {
    return bandSnaps.map(b => ({
      unitType: b.unitType,
      bandKey: b.bandKey,
      totalUnits: b.totalUnits,
      occupiedUnits: b.occupiedUnits,
      offlineUnits: b.offlineUnits,
      availableUnits: b.availableUnits,
      unitUtilPct: parseFloat(b.unitUtilPct),
      totalCapacity: parseFloat(b.totalCapacity),
      occupiedCapacity: parseFloat(b.occupiedCapacity),
      weightedUtilPct: parseFloat(b.weightedUtilPct),
      revenue: parseFloat(b.revenue),
      revenuePerAvailCapTime: parseFloat(b.revenuePerAvailCapTime),
    }));
  }

  const summary = await computeRealUtilization(propertyId, periodStart, periodEnd, 'marina', mode);
  const result: any[] = [];
  for (const ut of summary.byUnitType) {
    for (const band of ut.bands) {
      result.push({
        unitType: ut.unitType,
        bandKey: band.bandKey,
        bandLabel: band.bandLabel,
        totalUnits: band.unitUtil.totalUnits,
        occupiedUnits: band.unitUtil.occupiedUnits,
        offlineUnits: band.unitUtil.offlineUnits,
        availableUnits: band.unitUtil.availableUnits,
        unitUtilPct: band.unitUtil.utilizationPct,
        totalCapacity: band.weightedUtil.totalCapacity,
        occupiedCapacity: band.weightedUtil.occupiedCapacity,
        weightedUtilPct: band.weightedUtil.weightedUtilPct,
        revenue: 0,
        revenuePerAvailCapTime: band.economicUtil.revenuePerAvailableCapacityTime,
      });
    }
  }
  return result;
}

function isWholeMonth(start: string, end: string): boolean {
  const s = new Date(start);
  const e = new Date(end);
  if (s.getDate() !== 1) return false;
  const lastDay = new Date(e.getFullYear(), e.getMonth() + 1, 0).getDate();
  return e.getDate() === lastDay && s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear();
}

export async function getSummary(
  propertyId: string,
  periodStart: string,
  periodEnd: string,
  assetClass: AssetClass = 'marina',
  mode: UtilizationMode = 'contracted',
  unitTypes?: string[]
): Promise<UtilizationSummary> {
  if (!unitTypes?.length && isWholeMonth(periodStart, periodEnd)) {
    const cached = await fetchSnapshotSummary(propertyId, periodStart, periodEnd, mode);
    if (cached) return cached;
  }

  return computeRealUtilization(propertyId, periodStart, periodEnd, assetClass, mode, unitTypes);
}

export async function fetchByType(
  propertyId: string,
  periodStart: string,
  periodEnd: string,
  assetClass: AssetClass = 'marina',
  mode: UtilizationMode = 'contracted',
  unitTypes?: string[]
): Promise<UnitTypeBreakdown[]> {
  const summary = await getSummary(propertyId, periodStart, periodEnd, assetClass, mode);
  let results = summary.byUnitType;
  if (unitTypes?.length) {
    results = results.filter(ut => unitTypes.includes(ut.unitType));
  }
  return results;
}

export { generateMockSummary } from './utilization-service-mock';
