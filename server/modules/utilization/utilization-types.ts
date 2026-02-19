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

export interface PresenceEvent {
  id: string;
  unitId: string;
  unitType: string;
  timestampStart: string;
  timestampEnd: string | null;
  source: string;
  confidence: number;
  metadata: Record<string, any>;
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
  insufficientData?: boolean;
  insufficientDataReason?: string;
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

export type OfflineReasonCode = 'dredging' | 'storm' | 'repair' | 'upgrade' | 'power_outage' | 'condemnation' | 'owner_use' | 'other';

export const OFFLINE_REASON_LABELS: Record<OfflineReasonCode, string> = {
  dredging: 'Dredging',
  storm: 'Storm Damage',
  repair: 'Repair',
  upgrade: 'Upgrade',
  power_outage: 'Power Outage',
  condemnation: 'Condemnation',
  owner_use: 'Owner Use',
  other: 'Other',
};

export interface OfflineBlock {
  id: string;
  propertyId: string;
  scopeType: string;
  scopeKey: string;
  unitId: string | null;
  startDate: string;
  endDate: string | null;
  reasonCode: OfflineReasonCode;
  reasonDescription: string | null;
  estimatedRevenueLoss: number | null;
}

export interface OfflineReasonSummary {
  reasonCode: OfflineReasonCode;
  reasonLabel: string;
  blockCount: number;
  totalOfflineDays: number;
  offlineCapacityTime: number;
  estimatedLostRevenue: number;
  unitIds: string[];
}

export interface OfflineCapacityKPI {
  totalOfflineBlocks: number;
  totalOfflineUnits: number;
  totalOfflineDays: number;
  totalOfflineCapacityTime: number;
  totalEstimatedLostRevenue: number;
  byReason: OfflineReasonSummary[];
  byUnitType: Array<{
    unitType: string;
    offlineUnits: number;
    offlineCapacityTime: number;
    estimatedLostRevenue: number;
  }>;
  byBand: Array<{
    bandKey: string;
    offlineUnits: number;
    offlineCapacityTime: number;
    estimatedLostRevenue: number;
  }>;
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
