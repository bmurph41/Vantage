import type {
  InventoryUnit,
  OccupancyEvent,
  UnitUtilization,
  WeightedUtilization,
  EconomicUtilization,
  BandBreakdown,
  UnitTypeBreakdown,
  ChurnMetrics,
  UtilizationPeriod,
  OfflineBlock,
  OfflineReasonCode,
  OfflineReasonSummary,
  OfflineCapacityKPI,
} from './utilization-types';
import { OFFLINE_REASON_LABELS } from './utilization-types';
import type { DenomType, UnitTypeConfig } from './utilization-config';
import { getUnitTypeConfig, getBandForLength, type AssetClass } from './utilization-config';
import { daysBetween, overlapDays, fractionOfPeriod } from './overlap';

export function computeUnitUtilization(
  units: InventoryUnit[],
  occupancy: OccupancyEvent[],
  period: UtilizationPeriod
): UnitUtilization {
  const occupiedUnitIds = new Set(
    occupancy
      .filter(o => fractionOfPeriod(o.startDate, o.endDate, period.startDate, period.endDate) > 0)
      .map(o => o.unitId)
  );

  const totalUnits = units.length;
  const offlineUnits = units.filter(u => u.isOffline).length;
  const availableUnits = totalUnits - offlineUnits;
  const occupiedUnits = units.filter(u => occupiedUnitIds.has(u.id) && !u.isOffline).length;
  const vacantUnits = availableUnits - occupiedUnits;
  const utilizationPct = availableUnits > 0 ? (occupiedUnits / availableUnits) * 100 : 0;

  return { totalUnits, occupiedUnits, vacantUnits, offlineUnits, availableUnits, utilizationPct };
}

export function computeWeightedUtilization(
  units: InventoryUnit[],
  occupancy: OccupancyEvent[],
  period: UtilizationPeriod,
  denomType: DenomType
): WeightedUtilization {
  const getWeight = (unit: InventoryUnit): number => {
    switch (denomType) {
      case 'lf': return unit.lengthFt ?? 1;
      case 'sqft': return unit.sqft ?? 1;
      case 'count':
      case 'room_nights':
      case 'site_nights':
      case 'bays':
      default:
        return 1;
    }
  };

  const labelMap: Record<DenomType, string> = {
    lf: 'Linear Feet',
    sqft: 'Square Feet',
    count: 'Units',
    room_nights: 'Room-Nights',
    site_nights: 'Site-Nights',
    bays: 'Bays',
  };

  const occupiedUnitIds = new Set(
    occupancy
      .filter(o => fractionOfPeriod(o.startDate, o.endDate, period.startDate, period.endDate) > 0)
      .map(o => o.unitId)
  );

  let totalCapacity = 0;
  let occupiedCapacity = 0;
  let offlineCapacity = 0;

  for (const unit of units) {
    const weight = getWeight(unit);
    totalCapacity += weight;
    if (unit.isOffline) {
      offlineCapacity += weight;
    } else if (occupiedUnitIds.has(unit.id)) {
      occupiedCapacity += weight;
    }
  }

  const availableCapacity = totalCapacity - offlineCapacity;
  const weightedUtilPct = availableCapacity > 0 ? (occupiedCapacity / availableCapacity) * 100 : 0;

  return {
    denomType,
    totalCapacity,
    occupiedCapacity,
    offlineCapacity,
    availableCapacity,
    weightedUtilPct,
    label: labelMap[denomType] || 'Units',
  };
}

export function computeEconomicUtilization(
  units: InventoryUnit[],
  occupancy: OccupancyEvent[],
  period: UtilizationPeriod,
  denomType: DenomType
): EconomicUtilization {
  const getWeight = (unit: InventoryUnit): number => {
    switch (denomType) {
      case 'lf': return unit.lengthFt ?? 1;
      case 'sqft': return unit.sqft ?? 1;
      default: return 1;
    }
  };

  const totalCapacityTime = units
    .filter(u => !u.isOffline)
    .reduce((sum, u) => sum + getWeight(u) * period.totalDays, 0);

  let totalRevenue = 0;
  for (const occ of occupancy) {
    const fraction = fractionOfPeriod(occ.startDate, occ.endDate, period.startDate, period.endDate);
    const periodMonths = period.totalDays / 30.44;
    totalRevenue += occ.monthlyRevenue * periodMonths * fraction;
  }

  const revenuePerAvailableCapacityTime = totalCapacityTime > 0 ? totalRevenue / totalCapacityTime : 0;

  const occupiedUnitsCount = new Set(occupancy.map(o => o.unitId)).size;
  const effectiveRate = occupiedUnitsCount > 0 ? totalRevenue / occupiedUnitsCount : 0;

  const labelMap: Record<DenomType, string> = {
    lf: 'Rev/Available LF-Day',
    sqft: 'Rev/Available SqFt-Day',
    count: 'Rev/Available Unit-Day',
    room_nights: 'RevPAR',
    site_nights: 'Rev/Available Site-Night',
    bays: 'Rev/Available Bay-Day',
  };

  return {
    revenuePerAvailableCapacityTime,
    effectiveRate,
    rackRate: null,
    rateRealizationPct: null,
    label: labelMap[denomType] || 'Rev/Available Unit-Day',
  };
}

export function computeBandBreakdown(
  units: InventoryUnit[],
  occupancy: OccupancyEvent[],
  period: UtilizationPeriod,
  assetClass: AssetClass,
  unitType: string,
  config: UnitTypeConfig
): BandBreakdown[] {
  if (!config.defaultBands?.length) return [];

  return config.defaultBands.map(band => {
    const bandUnits = units.filter(u => u.bandKey === band.key);
    const bandUnitIds = new Set(bandUnits.map(u => u.id));
    const bandOccupancy = occupancy.filter(o => bandUnitIds.has(o.unitId));

    return {
      bandKey: band.key,
      bandLabel: band.label,
      unitUtil: computeUnitUtilization(bandUnits, bandOccupancy, period),
      weightedUtil: computeWeightedUtilization(bandUnits, bandOccupancy, period, config.denomType),
      economicUtil: computeEconomicUtilization(bandUnits, bandOccupancy, period, config.denomType),
    };
  }).filter(b => b.unitUtil.totalUnits > 0);
}

export function computeUnitTypeBreakdown(
  units: InventoryUnit[],
  occupancy: OccupancyEvent[],
  period: UtilizationPeriod,
  assetClass: AssetClass,
  unitType: string
): UnitTypeBreakdown | null {
  const config = getUnitTypeConfig(assetClass, unitType);
  if (!config) return null;

  const typeUnits = units.filter(u => u.unitType === unitType);
  if (typeUnits.length === 0) return null;

  const typeUnitIds = new Set(typeUnits.map(u => u.id));
  const typeOccupancy = occupancy.filter(o => typeUnitIds.has(o.unitId));

  return {
    unitType,
    unitTypeLabel: config.label,
    unitUtil: computeUnitUtilization(typeUnits, typeOccupancy, period),
    weightedUtil: computeWeightedUtilization(typeUnits, typeOccupancy, period, config.denomType),
    economicUtil: computeEconomicUtilization(typeUnits, typeOccupancy, period, config.denomType),
    bands: computeBandBreakdown(typeUnits, typeOccupancy, period, assetClass, unitType, config),
  };
}

export function computeChurn(
  moveIns: number,
  moveOuts: number,
  avgTenureMonths: number | null
): ChurnMetrics {
  return {
    moveIns,
    moveOuts,
    netAbsorption: moveIns - moveOuts,
    avgTenureMonths,
  };
}

export function computeOfflineBreakdown(
  offlineBlocks: OfflineBlock[],
  units: InventoryUnit[],
  occupancy: OccupancyEvent[],
  period: UtilizationPeriod,
  denomType: DenomType
): OfflineCapacityKPI {
  const getWeight = (unit: InventoryUnit): number => {
    switch (denomType) {
      case 'lf': return unit.lengthFt ?? 1;
      case 'sqft': return unit.sqft ?? 1;
      default: return 1;
    }
  };

  const unitMap = new Map(units.map(u => [u.id, u]));

  const occupiedUnitRevenue = new Map<string, number>();
  for (const occ of occupancy) {
    const fraction = fractionOfPeriod(occ.startDate, occ.endDate, period.startDate, period.endDate);
    const periodMonths = period.totalDays / 30.44;
    const rev = occ.monthlyRevenue * periodMonths * fraction;
    occupiedUnitRevenue.set(occ.unitId, (occupiedUnitRevenue.get(occ.unitId) ?? 0) + rev);
  }

  const occupiedUnitsCount = occupiedUnitRevenue.size || 1;
  const totalOccupiedRevenue = Array.from(occupiedUnitRevenue.values()).reduce((s, v) => s + v, 0);
  const avgRevenuePerUnit = totalOccupiedRevenue / occupiedUnitsCount;

  const availableCapacity = units.filter(u => !u.isOffline).reduce((s, u) => s + getWeight(u), 0);
  const totalAvailableCapTime = availableCapacity * period.totalDays;
  const avgEffectiveRatePerCapTime = totalAvailableCapTime > 0 ? totalOccupiedRevenue / totalAvailableCapTime : 0;

  const resolveAffectedUnits = (block: OfflineBlock): InventoryUnit[] => {
    if (block.scopeType === 'unit' && block.unitId) {
      const u = unitMap.get(block.unitId);
      return u ? [u] : [];
    }
    if (block.scopeType === 'band') {
      return units.filter(u => u.bandKey === block.scopeKey);
    }
    if (block.scopeType === 'unit_type') {
      return units.filter(u => u.unitType === block.scopeKey);
    }
    if (block.scopeType === 'property') {
      return [...units];
    }
    return [];
  };

  const reasonMap = new Map<OfflineReasonCode, {
    blockCount: number;
    totalOfflineDays: number;
    offlineCapacityTime: number;
    estimatedLostRevenue: number;
    unitIds: Set<string>;
  }>();

  const unitTypeMap = new Map<string, {
    offlineUnitIds: Set<string>;
    offlineCapacityTime: number;
    estimatedLostRevenue: number;
  }>();

  const bandMap = new Map<string, {
    offlineUnitIds: Set<string>;
    offlineCapacityTime: number;
    estimatedLostRevenue: number;
  }>();

  let totalOfflineBlocks = 0;
  const allOfflineUnitIds = new Set<string>();
  let totalOfflineDays = 0;
  let totalOfflineCapacityTime = 0;
  let totalEstimatedLostRevenue = 0;

  for (const block of offlineBlocks) {
    totalOfflineBlocks++;
    const blockEnd = block.endDate || period.endDate;
    const days = overlapDays(block.startDate, blockEnd, period.startDate, period.endDate);
    if (days <= 0) continue;

    const affectedUnits = resolveAffectedUnits(block);

    let blockCapTime = 0;
    let blockLostRevenue = 0;

    for (const unit of affectedUnits) {
      allOfflineUnitIds.add(unit.id);
      const weight = getWeight(unit);
      const capTime = weight * days;
      blockCapTime += capTime;

      const lostRev = block.estimatedRevenueLoss != null
        ? block.estimatedRevenueLoss / Math.max(affectedUnits.length, 1)
        : capTime * avgEffectiveRatePerCapTime;
      blockLostRevenue += lostRev;

      const utKey = unit.unitType;
      if (!unitTypeMap.has(utKey)) {
        unitTypeMap.set(utKey, { offlineUnitIds: new Set(), offlineCapacityTime: 0, estimatedLostRevenue: 0 });
      }
      const utEntry = unitTypeMap.get(utKey)!;
      utEntry.offlineUnitIds.add(unit.id);
      utEntry.offlineCapacityTime += capTime;
      utEntry.estimatedLostRevenue += lostRev;

      const bKey = unit.bandKey;
      if (bKey) {
        if (!bandMap.has(bKey)) {
          bandMap.set(bKey, { offlineUnitIds: new Set(), offlineCapacityTime: 0, estimatedLostRevenue: 0 });
        }
        const bEntry = bandMap.get(bKey)!;
        bEntry.offlineUnitIds.add(unit.id);
        bEntry.offlineCapacityTime += capTime;
        bEntry.estimatedLostRevenue += lostRev;
      }
    }

    totalOfflineDays += days;
    totalOfflineCapacityTime += blockCapTime;
    totalEstimatedLostRevenue += blockLostRevenue;

    const rc = block.reasonCode as OfflineReasonCode;
    if (!reasonMap.has(rc)) {
      reasonMap.set(rc, { blockCount: 0, totalOfflineDays: 0, offlineCapacityTime: 0, estimatedLostRevenue: 0, unitIds: new Set() });
    }
    const entry = reasonMap.get(rc)!;
    entry.blockCount++;
    entry.totalOfflineDays += days;
    entry.offlineCapacityTime += blockCapTime;
    entry.estimatedLostRevenue += blockLostRevenue;
    for (const u of affectedUnits) entry.unitIds.add(u.id);
  }

  const byReason: OfflineReasonSummary[] = Array.from(reasonMap.entries()).map(([rc, data]) => ({
    reasonCode: rc,
    reasonLabel: OFFLINE_REASON_LABELS[rc] || rc,
    blockCount: data.blockCount,
    totalOfflineDays: data.totalOfflineDays,
    offlineCapacityTime: Math.round(data.offlineCapacityTime * 100) / 100,
    estimatedLostRevenue: Math.round(data.estimatedLostRevenue * 100) / 100,
    unitIds: Array.from(data.unitIds),
  })).sort((a, b) => b.estimatedLostRevenue - a.estimatedLostRevenue);

  const byUnitType = Array.from(unitTypeMap.entries()).map(([ut, data]) => ({
    unitType: ut,
    offlineUnits: data.offlineUnitIds.size,
    offlineCapacityTime: Math.round(data.offlineCapacityTime * 100) / 100,
    estimatedLostRevenue: Math.round(data.estimatedLostRevenue * 100) / 100,
  }));

  const byBand = Array.from(bandMap.entries()).map(([bk, data]) => ({
    bandKey: bk,
    offlineUnits: data.offlineUnitIds.size,
    offlineCapacityTime: Math.round(data.offlineCapacityTime * 100) / 100,
    estimatedLostRevenue: Math.round(data.estimatedLostRevenue * 100) / 100,
  }));

  return {
    totalOfflineBlocks,
    totalOfflineUnits: allOfflineUnitIds.size,
    totalOfflineDays,
    totalOfflineCapacityTime: Math.round(totalOfflineCapacityTime * 100) / 100,
    totalEstimatedLostRevenue: Math.round(totalEstimatedLostRevenue * 100) / 100,
    byReason,
    byUnitType,
    byBand,
  };
}
