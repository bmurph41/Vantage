import type { UtilizationSummary, UtilizationMode } from './utilization-types';
import type { AssetClass } from './utilization-config';
import { todayIso, startOfMonth, endOfMonth, daysBetween } from './overlap';

export function generateMockSummary(propertyId: string = 'mock-marina-001'): UtilizationSummary {
  const periodStart = startOfMonth();
  const periodEnd = endOfMonth();
  const totalDays = daysBetween(periodStart, periodEnd);

  return {
    propertyId,
    propertyName: 'Sunset Bay Marina',
    assetClass: 'marina' as AssetClass,
    period: { startDate: periodStart, endDate: periodEnd, totalDays },
    mode: 'contracted' as UtilizationMode,
    overall: {
      unitUtil: {
        totalUnits: 150,
        occupiedUnits: 132,
        vacantUnits: 14,
        offlineUnits: 4,
        availableUnits: 146,
        utilizationPct: 90.4,
      },
      weightedUtil: {
        denomType: 'lf',
        totalCapacity: 5400,
        occupiedCapacity: 4750,
        offlineCapacity: 160,
        availableCapacity: 5240,
        weightedUtilPct: 90.6,
        label: 'Linear Feet',
      },
      economicUtil: {
        revenuePerAvailableCapacityTime: 1.82,
        effectiveRate: 1250,
        rackRate: null,
        rateRealizationPct: null,
        label: 'Rev/Available LF-Day',
      },
    },
    byUnitType: [
      {
        unitType: 'wet_slip',
        unitTypeLabel: 'Wet Slip',
        unitUtil: {
          totalUnits: 120,
          occupiedUnits: 110,
          vacantUnits: 8,
          offlineUnits: 2,
          availableUnits: 118,
          utilizationPct: 93.2,
        },
        weightedUtil: {
          denomType: 'lf',
          totalCapacity: 4500,
          occupiedCapacity: 4100,
          offlineCapacity: 80,
          availableCapacity: 4420,
          weightedUtilPct: 92.8,
          label: 'Linear Feet',
        },
        economicUtil: {
          revenuePerAvailableCapacityTime: 1.95,
          effectiveRate: 1350,
          rackRate: null,
          rateRealizationPct: null,
          label: 'Rev/Available LF-Day',
        },
        bands: [
          {
            bandKey: '0_25',
            bandLabel: "Up to 25'",
            unitUtil: { totalUnits: 30, occupiedUnits: 29, vacantUnits: 1, offlineUnits: 0, availableUnits: 30, utilizationPct: 96.7 },
            weightedUtil: { denomType: 'lf', totalCapacity: 600, occupiedCapacity: 580, offlineCapacity: 0, availableCapacity: 600, weightedUtilPct: 96.7, label: 'Linear Feet' },
            economicUtil: { revenuePerAvailableCapacityTime: 1.5, effectiveRate: 800, rackRate: null, rateRealizationPct: null, label: 'Rev/Available LF-Day' },
          },
          {
            bandKey: '26_35',
            bandLabel: "26'–35'",
            unitUtil: { totalUnits: 35, occupiedUnits: 33, vacantUnits: 2, offlineUnits: 0, availableUnits: 35, utilizationPct: 94.3 },
            weightedUtil: { denomType: 'lf', totalCapacity: 1050, occupiedCapacity: 990, offlineCapacity: 0, availableCapacity: 1050, weightedUtilPct: 94.3, label: 'Linear Feet' },
            economicUtil: { revenuePerAvailableCapacityTime: 1.8, effectiveRate: 1100, rackRate: null, rateRealizationPct: null, label: 'Rev/Available LF-Day' },
          },
          {
            bandKey: '36_45',
            bandLabel: "36'–45'",
            unitUtil: { totalUnits: 25, occupiedUnits: 23, vacantUnits: 1, offlineUnits: 1, availableUnits: 24, utilizationPct: 95.8 },
            weightedUtil: { denomType: 'lf', totalCapacity: 1000, occupiedCapacity: 920, offlineCapacity: 40, availableCapacity: 960, weightedUtilPct: 95.8, label: 'Linear Feet' },
            economicUtil: { revenuePerAvailableCapacityTime: 2.1, effectiveRate: 1500, rackRate: null, rateRealizationPct: null, label: 'Rev/Available LF-Day' },
          },
          {
            bandKey: '46_55',
            bandLabel: "46'–55'",
            unitUtil: { totalUnits: 18, occupiedUnits: 15, vacantUnits: 2, offlineUnits: 1, availableUnits: 17, utilizationPct: 88.2 },
            weightedUtil: { denomType: 'lf', totalCapacity: 900, occupiedCapacity: 750, offlineCapacity: 40, availableCapacity: 860, weightedUtilPct: 87.2, label: 'Linear Feet' },
            economicUtil: { revenuePerAvailableCapacityTime: 2.3, effectiveRate: 1800, rackRate: null, rateRealizationPct: null, label: 'Rev/Available LF-Day' },
          },
          {
            bandKey: '56_65',
            bandLabel: "56'–65'",
            unitUtil: { totalUnits: 8, occupiedUnits: 7, vacantUnits: 1, offlineUnits: 0, availableUnits: 8, utilizationPct: 87.5 },
            weightedUtil: { denomType: 'lf', totalCapacity: 480, occupiedCapacity: 420, offlineCapacity: 0, availableCapacity: 480, weightedUtilPct: 87.5, label: 'Linear Feet' },
            economicUtil: { revenuePerAvailableCapacityTime: 2.5, effectiveRate: 2200, rackRate: null, rateRealizationPct: null, label: 'Rev/Available LF-Day' },
          },
          {
            bandKey: '66_plus',
            bandLabel: "66'+",
            unitUtil: { totalUnits: 4, occupiedUnits: 3, vacantUnits: 1, offlineUnits: 0, availableUnits: 4, utilizationPct: 75.0 },
            weightedUtil: { denomType: 'lf', totalCapacity: 470, occupiedCapacity: 440, offlineCapacity: 0, availableCapacity: 470, weightedUtilPct: 93.6, label: 'Linear Feet' },
            economicUtil: { revenuePerAvailableCapacityTime: 3.0, effectiveRate: 3200, rackRate: null, rateRealizationPct: null, label: 'Rev/Available LF-Day' },
          },
        ],
      },
      {
        unitType: 'dry_rack',
        unitTypeLabel: 'Dry Rack',
        unitUtil: {
          totalUnits: 30,
          occupiedUnits: 22,
          vacantUnits: 6,
          offlineUnits: 2,
          availableUnits: 28,
          utilizationPct: 78.6,
        },
        weightedUtil: {
          denomType: 'count',
          totalCapacity: 30,
          occupiedCapacity: 22,
          offlineCapacity: 2,
          availableCapacity: 28,
          weightedUtilPct: 78.6,
          label: 'Units',
        },
        economicUtil: {
          revenuePerAvailableCapacityTime: 0.85,
          effectiveRate: 450,
          rackRate: null,
          rateRealizationPct: null,
          label: 'Rev/Available Unit-Day',
        },
        bands: [
          {
            bandKey: '0_25',
            bandLabel: "Up to 25'",
            unitUtil: { totalUnits: 15, occupiedUnits: 13, vacantUnits: 1, offlineUnits: 1, availableUnits: 14, utilizationPct: 92.9 },
            weightedUtil: { denomType: 'count', totalCapacity: 15, occupiedCapacity: 13, offlineCapacity: 1, availableCapacity: 14, weightedUtilPct: 92.9, label: 'Units' },
            economicUtil: { revenuePerAvailableCapacityTime: 0.75, effectiveRate: 380, rackRate: null, rateRealizationPct: null, label: 'Rev/Available Unit-Day' },
          },
          {
            bandKey: '26_35',
            bandLabel: "26'–35'",
            unitUtil: { totalUnits: 10, occupiedUnits: 7, vacantUnits: 2, offlineUnits: 1, availableUnits: 9, utilizationPct: 77.8 },
            weightedUtil: { denomType: 'count', totalCapacity: 10, occupiedCapacity: 7, offlineCapacity: 1, availableCapacity: 9, weightedUtilPct: 77.8, label: 'Units' },
            economicUtil: { revenuePerAvailableCapacityTime: 0.90, effectiveRate: 475, rackRate: null, rateRealizationPct: null, label: 'Rev/Available Unit-Day' },
          },
          {
            bandKey: '36_plus',
            bandLabel: "36'+",
            unitUtil: { totalUnits: 5, occupiedUnits: 2, vacantUnits: 3, offlineUnits: 0, availableUnits: 5, utilizationPct: 40.0 },
            weightedUtil: { denomType: 'count', totalCapacity: 5, occupiedCapacity: 2, offlineCapacity: 0, availableCapacity: 5, weightedUtilPct: 40.0, label: 'Units' },
            economicUtil: { revenuePerAvailableCapacityTime: 1.1, effectiveRate: 550, rackRate: null, rateRealizationPct: null, label: 'Rev/Available Unit-Day' },
          },
        ],
      },
    ],
    churn: {
      moveIns: 8,
      moveOuts: 5,
      netAbsorption: 3,
      avgTenureMonths: 28.5,
    },
    generatedAt: new Date().toISOString(),
  };
}
