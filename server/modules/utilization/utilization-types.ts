import type { AssetClass, DenomType } from './utilization-config';

export type UtilizationMode = 'contracted' | 'physical';

export interface UtilizationPeriod {
  startDate: string;
  endDate: string;
  totalDays: number;
}

export interface InventoryUnit {
  id: string;
  propertyId: string;
  unitCode: string;
  unitType: string;
  bandKey: string | null;
  lengthFt: number | null;
  widthFt: number | null;
  depthFt: number | null;
  sqft: number | null;
  isAvailable: boolean;
  isOffline: boolean;
  offlineReasonCode?: string;
}

export interface OccupancyEvent {
  unitId: string;
  leaseId: string | null;
  tenantId: string | null;
  startDate: string;
  endDate: string | null;
  isContracted: boolean;
  monthlyRevenue: number;
  annualRevenue: number;
}

export interface UnitUtilization {
  totalUnits: number;
  occupiedUnits: number;
  vacantUnits: number;
  offlineUnits: number;
  availableUnits: number;
  utilizationPct: number;
}

export interface WeightedUtilization {
  denomType: DenomType;
  totalCapacity: number;
  occupiedCapacity: number;
  offlineCapacity: number;
  availableCapacity: number;
  weightedUtilPct: number;
  label: string;
}

export interface EconomicUtilization {
  revenuePerAvailableCapacityTime: number;
  effectiveRate: number;
  rackRate: number | null;
  rateRealizationPct: number | null;
  label: string;
}

export interface BandBreakdown {
  bandKey: string;
  bandLabel: string;
  unitUtil: UnitUtilization;
  weightedUtil: WeightedUtilization;
  economicUtil: EconomicUtilization;
}

export interface UnitTypeBreakdown {
  unitType: string;
  unitTypeLabel: string;
  unitUtil: UnitUtilization;
  weightedUtil: WeightedUtilization;
  economicUtil: EconomicUtilization;
  bands: BandBreakdown[];
}

export interface UtilizationSummary {
  propertyId: string;
  propertyName: string;
  assetClass: AssetClass;
  period: UtilizationPeriod;
  mode: UtilizationMode;
  overall: {
    unitUtil: UnitUtilization;
    weightedUtil: WeightedUtilization;
    economicUtil: EconomicUtilization;
  };
  byUnitType: UnitTypeBreakdown[];
  churn: ChurnMetrics;
  generatedAt: string;
}

export interface ChurnMetrics {
  moveIns: number;
  moveOuts: number;
  netAbsorption: number;
  avgTenureMonths: number | null;
}

export interface UtilizationSnapshot {
  id: string;
  propertyId: string;
  assetClass: AssetClass;
  snapshotDate: string;
  mode: UtilizationMode;
  unitUtilPct: number;
  weightedUtilPct: number;
  revPACapTime: number;
  totalUnits: number;
  occupiedUnits: number;
  offlineUnits: number;
  byUnitType: Record<string, {
    unitUtilPct: number;
    weightedUtilPct: number;
    totalUnits: number;
    occupiedUnits: number;
  }>;
  createdAt: string;
}

export interface UtilizationTrendPoint {
  date: string;
  unitUtilPct: number;
  weightedUtilPct: number;
  revPACapTime: number;
}

export interface MockSummaryResponse {
  propertyId: string;
  propertyName: string;
  assetClass: AssetClass;
  period: UtilizationPeriod;
  mode: UtilizationMode;
  overall: {
    unitUtil: UnitUtilization;
    weightedUtil: WeightedUtilization;
    economicUtil: EconomicUtilization;
  };
  byUnitType: UnitTypeBreakdown[];
  churn: ChurnMetrics;
  generatedAt: string;
}
