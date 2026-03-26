/**
 * Asset Class Strategy Pattern for Rent Roll
 *
 * Each asset class can customize how the rent roll calculates rates,
 * resolves unit types, computes occupancy, and generates KPIs.
 * The marina strategy preserves all existing behavior as the default.
 *
 * Usage:
 *   import { getAssetStrategy } from './assetStrategies';
 *   const strategy = getAssetStrategy('marina');
 *   const unitType = strategy.resolveUnitType(lease);
 */

export interface LeaseRecord {
  id: string;
  storageType?: string | null;
  unitTypeCustom?: string | null;
  slipLength?: string | number | null;
  slipWidth?: string | number | null;
  unitDimension1?: string | number | null;
  unitDimension2?: string | number | null;
  boatDimensions?: string | null;
  boatType?: string | null;
  leaseAmount?: string | number | null;
  rateType?: string | null;
  contractTerm?: string | null;
  slipStatus?: string | null;
  isActive?: boolean;
  [key: string]: any;
}

export interface TenantRecord {
  id: string;
  name: string;
  boatMake?: string | null;
  boatLength?: string | number | null;
  boatWidth?: string | number | null;
  boatYear?: number | null;
  assetSpecificData?: Record<string, any> | null;
  [key: string]: any;
}

export interface LocationRecord {
  id: string;
  name: string;
  assetClass?: string | null;
  capacity?: number | null;
  seasonType?: string | null;
  [key: string]: any;
}

/**
 * Strategy interface — each asset class implements these methods.
 * Methods that return null fall back to default behavior.
 */
export interface AssetClassStrategy {
  /** The asset class this strategy handles */
  assetClass: string;

  /** Resolve the display unit type for a lease (e.g., "Wet Slip", "5x10 Climate", "1BR/1BA") */
  resolveUnitType(lease: LeaseRecord): string;

  /** Resolve the primary dimension for rate calculations (e.g., boat length, unit SF) */
  resolveUnitDimension(lease: LeaseRecord, tenant?: TenantRecord | null): number | null;

  /** Resolve the secondary dimension if applicable */
  resolveSecondaryDimension(lease: LeaseRecord, tenant?: TenantRecord | null): number | null;

  /** Get the occupancy denominator for a location (total available units/slots) */
  getOccupancyDenominator(location: LocationRecord, seasonType?: string): number;

  /** Get the label for the "average unit dimension" KPI */
  avgDimensionLabel: string;

  /** Get the unit for dimension display (e.g., "ft", "SF") */
  dimensionUnit: string;

  /** Whether this asset class uses per-foot/per-dimension rate calculations */
  usesPerDimensionRates: boolean;

  /** Whether this asset class has seasonal line items (winter_slip, summer_slip, etc.) */
  hasSeasonalLineItems: boolean;

  /** Whether this asset class tracks boat/vessel information on tenants */
  hasAssetSpecificTenantFields: boolean;

  /** Get valid unit status options */
  statusOptions: string[];
}

// ============================================================================
// Shared Helpers
// ============================================================================

export function toNumber(val: string | number | null | undefined): number | null {
  if (val === null || val === undefined) return null;
  const n = typeof val === 'string' ? parseFloat(val) : val;
  return isNaN(n) || n <= 0 ? null : n;
}

/**
 * Resolve unit type: prefer unitTypeCustom, fall back to storageType, then 'Other'
 */
export function defaultResolveUnitType(lease: LeaseRecord): string {
  return lease.unitTypeCustom || lease.storageType || 'Other';
}

// ============================================================================
// Strategy Registry
// ============================================================================

import { MarinaStrategy } from './marina';
import { SelfStorageStrategy } from './selfStorage';
import { CREStrategy } from './cre';
import { MultifamilyStrategy } from './multifamily';
import { HotelStrategy } from './hotel';
import { RVParkStrategy } from './rvPark';
import { DefaultStrategy } from './default';

const strategyRegistry: Record<string, AssetClassStrategy> = {
  marina: new MarinaStrategy(),
  self_storage: new SelfStorageStrategy(),
  retail: new CREStrategy('retail'),
  office: new CREStrategy('office'),
  industrial: new CREStrategy('industrial'),
  medical_office: new CREStrategy('medical_office'),
  shopping_center: new CREStrategy('shopping_center'),
  multifamily: new MultifamilyStrategy(),
  duplex: new MultifamilyStrategy(),
  triplex: new MultifamilyStrategy(),
  quad: new MultifamilyStrategy(),
  hotel: new HotelStrategy(),
  str: new HotelStrategy(),
  rv_park: new RVParkStrategy(),
  mobile_home: new RVParkStrategy(),
};

/**
 * Get the strategy for an asset class. Falls back to DefaultStrategy.
 */
export function getAssetStrategy(assetClass: string | null | undefined): AssetClassStrategy {
  return strategyRegistry[assetClass || 'marina'] || new DefaultStrategy();
}
