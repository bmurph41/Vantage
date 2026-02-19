import { db } from '../../db';
import { eq, and, or, lte, gte, isNull, sql, inArray } from 'drizzle-orm';
import {
  utilInventoryUnits,
  utilOccupancyEvents,
  utilOfflineBlocks,
  utilSnapshots,
  utilPresenceEvents,
} from '../../../shared/schema';
import type {
  InventoryUnit,
  OccupancyEvent,
  PresenceEvent,
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
  computeOfflineBreakdown,
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

function toPresenceEvent(row: any): PresenceEvent {
  return {
    id: row.id,
    unitId: row.unitId,
    unitType: row.unitType,
    timestampStart: row.timestampStart instanceof Date ? row.timestampStart.toISOString() : row.timestampStart,
    timestampEnd: row.timestampEnd instanceof Date ? row.timestampEnd.toISOString() : row.timestampEnd ?? null,
    source: row.source,
    confidence: parseFloat(row.confidence ?? '1'),
    metadata: row.metadata ?? {},
  };
}

export async function fetchPresenceEvents(
  propertyId: string,
  periodStart: string,
  periodEnd: string,
  unitTypes?: string[]
): Promise<PresenceEvent[]> {
  const periodStartTs = new Date(periodStart);
  const periodEndTs = new Date(periodEnd + 'T23:59:59');

  const conditions = [
    eq(utilPresenceEvents.propertyId, propertyId),
    lte(utilPresenceEvents.timestampStart, periodEndTs),
    or(
      isNull(utilPresenceEvents.timestampEnd),
      gte(utilPresenceEvents.timestampEnd, periodStartTs)
    ),
  ];
  if (unitTypes?.length) {
    conditions.push(inArray(utilPresenceEvents.unitType, unitTypes));
  }
  const rows = await db.select().from(utilPresenceEvents).where(and(...conditions));
  return rows.map(toPresenceEvent);
}

function presenceToOccupancyEvents(presenceEvents: PresenceEvent[]): OccupancyEvent[] {
  return presenceEvents.map(pe => ({
    unitId: pe.unitId,
    leaseId: null,
    tenantId: null,
    startDate: pe.timestampStart.slice(0, 10),
    endDate: pe.timestampEnd ? pe.timestampEnd.slice(0, 10) : null,
    isContracted: false,
    monthlyRevenue: 0,
    annualRevenue: 0,
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

  const [rawUnits, offlineBlocks] = await Promise.all([
    fetchInventoryUnits(propertyId, unitTypes),
    fetchOfflineBlocks(propertyId, periodStart, periodEnd),
  ]);

  const units = applyOfflineBlocks(rawUnits, offlineBlocks, periodStart, periodEnd);

  let occupancy: OccupancyEvent[];
  let insufficientData = false;
  let insufficientDataReason: string | undefined;

  if (mode === 'physical') {
    const presenceEvents = await fetchPresenceEvents(propertyId, periodStart, periodEnd, unitTypes);
    if (presenceEvents.length === 0 && units.length > 0) {
      insufficientData = true;
      insufficientDataReason = 'No physical presence data available for this period. Install sensors, cameras, or AIS receivers to collect presence data.';
    }
    occupancy = presenceToOccupancyEvents(presenceEvents);
  } else {
    occupancy = await fetchOccupancyEvents(propertyId, periodStart, periodEnd, unitTypes);
  }

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
    ...(insufficientData ? { insufficientData, insufficientDataReason } : {}),
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

export async function fetchDrilldownEvents(
  propertyId: string,
  periodStart: string,
  periodEnd: string,
  mode: UtilizationMode,
  unitType?: string,
  bandKey?: string,
  unitTypes?: string[]
): Promise<{
  events: any[];
  offlineBlocks: any[];
  insufficientData?: boolean;
}> {
  const [rawUnits, offlineBlocks] = await Promise.all([
    fetchInventoryUnits(propertyId, unitTypes),
    fetchOfflineBlocks(propertyId, periodStart, periodEnd),
  ]);

  let filteredUnits = rawUnits;
  if (unitType) {
    filteredUnits = filteredUnits.filter(u => u.unitType === unitType);
  }
  if (bandKey) {
    filteredUnits = filteredUnits.filter(u => u.bandKey === bandKey);
  }
  const filteredUnitIds = new Set(filteredUnits.map(u => u.id));

  const relevantOffline = offlineBlocks.filter((ob: any) => {
    if (ob.scopeType === 'unit') return filteredUnitIds.has(ob.unitId);
    if (ob.scopeType === 'unit_type') return ob.scopeKey === unitType;
    if (ob.scopeType === 'band') return ob.scopeKey === bandKey;
    if (ob.scopeType === 'property') return true;
    return false;
  });

  if (mode === 'physical') {
    const presenceEvents = await fetchPresenceEvents(propertyId, periodStart, periodEnd, unitTypes);
    const filtered = presenceEvents.filter(pe => filteredUnitIds.has(pe.unitId));
    return {
      events: filtered.map(pe => ({
        id: pe.id,
        unitId: pe.unitId,
        unitType: pe.unitType,
        startDate: pe.timestampStart,
        endDate: pe.timestampEnd,
        source: pe.source,
        confidence: pe.confidence,
        type: 'presence',
      })),
      offlineBlocks: relevantOffline,
      ...(filtered.length === 0 && filteredUnits.length > 0 ? { insufficientData: true } : {}),
    };
  }

  const occupancy = await fetchOccupancyEvents(propertyId, periodStart, periodEnd, unitTypes);
  const filtered = occupancy.filter(o => filteredUnitIds.has(o.unitId));
  return {
    events: filtered.map(o => ({
      id: o.unitId + '_' + o.startDate,
      unitId: o.unitId,
      startDate: o.startDate,
      endDate: o.endDate,
      leaseId: o.leaseId,
      tenantId: o.tenantId,
      monthlyRevenue: o.monthlyRevenue,
      type: 'occupancy',
    })),
    offlineBlocks: relevantOffline,
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

import type { OfflineBlock, OfflineCapacityKPI } from './utilization-types';

function toOfflineBlock(row: any): OfflineBlock {
  return {
    id: row.id,
    propertyId: row.propertyId,
    scopeType: row.scopeType,
    scopeKey: row.scopeKey,
    unitId: row.unitId ?? null,
    startDate: row.startDate,
    endDate: row.endDate ?? null,
    reasonCode: row.reasonCode,
    reasonDescription: row.reasonDescription ?? null,
    estimatedRevenueLoss: row.estimatedRevenueLoss ? parseFloat(row.estimatedRevenueLoss) : null,
  };
}

export async function getOfflineBreakdown(
  propertyId: string,
  periodStart: string,
  periodEnd: string,
  assetClass: AssetClass = 'marina',
  mode: UtilizationMode = 'contracted'
): Promise<OfflineCapacityKPI> {
  const config = getAssetClassConfig(assetClass);
  if (!config) throw new Error(`Unknown asset class: ${assetClass}`);

  const totalDays = daysBetween(periodStart, periodEnd);
  const period = { startDate: periodStart, endDate: periodEnd, totalDays };
  const primaryDenom = Object.values(config.unitTypes)[0]?.denomType ?? 'count';

  const [units, rawBlocks, occupancy] = await Promise.all([
    fetchInventoryUnits(propertyId),
    fetchOfflineBlocks(propertyId, periodStart, periodEnd),
    fetchOccupancyEvents(propertyId, periodStart, periodEnd),
  ]);

  const blocks: OfflineBlock[] = rawBlocks.map(toOfflineBlock);
  return computeOfflineBreakdown(blocks, units, occupancy, period, primaryDenom);
}

import type { CompressionAnalytics, DailyUtilizationPoint, DayOfWeekAverage } from './utilization-types';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export async function computeCompressionAnalytics(
  propertyId: string,
  periodStart: string,
  periodEnd: string,
  threshold: number = 90,
  mode: UtilizationMode = 'contracted',
  unitTypes?: string[]
): Promise<CompressionAnalytics> {
  const [rawUnits, offlineBlocks] = await Promise.all([
    fetchInventoryUnits(propertyId, unitTypes),
    fetchOfflineBlocks(propertyId, periodStart, periodEnd),
  ]);

  const availableUnits = rawUnits.filter(u => u.isAvailable);
  const availableUnitIds = new Set(availableUnits.map(u => u.id));

  let occupancy: OccupancyEvent[];
  if (mode === 'physical') {
    const presenceEvents = await fetchPresenceEvents(propertyId, periodStart, periodEnd, unitTypes);
    occupancy = presenceToOccupancyEvents(presenceEvents);
  } else {
    occupancy = await fetchOccupancyEvents(propertyId, periodStart, periodEnd, unitTypes);
  }

  const start = new Date(periodStart);
  const end = new Date(periodEnd);
  const dailySeries: DailyUtilizationPoint[] = [];

  const current = new Date(start);
  while (current <= end) {
    const dateStr = current.toISOString().slice(0, 10);
    const dayOfWeek = current.getDay();

    const offlineUnitIds = new Set<string>();
    for (const block of offlineBlocks) {
      const blockStart = new Date(block.startDate);
      const blockEnd = block.endDate ? new Date(block.endDate) : end;
      if (current >= blockStart && current <= blockEnd) {
        if (block.scopeType === 'unit' && block.unitId) {
          offlineUnitIds.add(block.unitId);
        } else if (block.scopeType === 'unit_type') {
          for (const u of availableUnits) {
            if (u.unitType === block.scopeKey) offlineUnitIds.add(u.id);
          }
        } else if (block.scopeType === 'band') {
          for (const u of availableUnits) {
            if (u.bandKey === block.scopeKey) offlineUnitIds.add(u.id);
          }
        } else if (block.scopeType === 'property') {
          for (const u of availableUnits) offlineUnitIds.add(u.id);
        }
      }
    }

    const dayAvailableCount = availableUnits.filter(u => !offlineUnitIds.has(u.id)).length;

    const occupiedUnitIds = new Set<string>();
    for (const occ of occupancy) {
      if (!availableUnitIds.has(occ.unitId)) continue;
      if (offlineUnitIds.has(occ.unitId)) continue;
      const occStart = new Date(occ.startDate);
      const occEnd = occ.endDate ? new Date(occ.endDate) : end;
      if (current >= occStart && current <= occEnd) {
        occupiedUnitIds.add(occ.unitId);
      }
    }

    const occupiedCount = occupiedUnitIds.size;
    const utilizationPct = dayAvailableCount > 0
      ? Math.round((occupiedCount / dayAvailableCount) * 10000) / 100
      : 0;

    dailySeries.push({
      date: dateStr,
      dayOfWeek,
      dayLabel: DAY_LABELS[dayOfWeek],
      totalUnits: dayAvailableCount,
      occupiedUnits: occupiedCount,
      utilizationPct: Math.min(utilizationPct, 100),
    });

    current.setDate(current.getDate() + 1);
  }

  const dayOfWeekBuckets: Record<number, number[]> = {};
  for (let i = 0; i < 7; i++) dayOfWeekBuckets[i] = [];
  for (const dp of dailySeries) {
    dayOfWeekBuckets[dp.dayOfWeek].push(dp.utilizationPct);
  }

  const dayOfWeekAverages: DayOfWeekAverage[] = [];
  for (let i = 0; i < 7; i++) {
    const vals = dayOfWeekBuckets[i];
    const avg = vals.length > 0
      ? Math.round((vals.reduce((s, v) => s + v, 0) / vals.length) * 100) / 100
      : 0;
    dayOfWeekAverages.push({
      dayOfWeek: i,
      dayLabel: DAY_LABELS[i],
      avgUtilizationPct: avg,
      sampleCount: vals.length,
    });
  }

  const compressionDays = dailySeries.filter(d => d.utilizationPct >= threshold).length;
  const totalDays = dailySeries.length;
  const compressionDaysPct = totalDays > 0
    ? Math.round((compressionDays / totalDays) * 10000) / 100
    : 0;

  const allPcts = dailySeries.map(d => d.utilizationPct);
  const avgUtilizationPct = allPcts.length > 0
    ? Math.round((allPcts.reduce((s, v) => s + v, 0) / allPcts.length) * 100) / 100
    : 0;
  const peakUtilizationPct = allPcts.length > 0 ? Math.max(...allPcts) : 0;
  const peakDate = dailySeries.find(d => d.utilizationPct === peakUtilizationPct)?.date ?? null;

  return {
    propertyId,
    periodStart,
    periodEnd,
    threshold,
    totalDays,
    compressionDays,
    compressionDaysPct,
    avgUtilizationPct,
    peakUtilizationPct,
    peakDate,
    dailySeries,
    dayOfWeekAverages,
  };
}

export { generateMockSummary } from './utilization-service-mock';
