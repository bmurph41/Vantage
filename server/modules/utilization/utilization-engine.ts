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
} from './utilization-types';
import type { DenomType, UnitTypeConfig } from './utilization-config';
import { getUnitTypeConfig, getBandForLength, type AssetClass } from './utilization-config';
import { daysBetween, fractionOfPeriod } from './overlap';

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
