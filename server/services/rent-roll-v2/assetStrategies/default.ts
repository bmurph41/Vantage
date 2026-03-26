/**
 * Default Strategy — fallback for asset classes without a specific strategy.
 * Uses generic unit type resolution and simple occupancy.
 */

import type { AssetClassStrategy, LeaseRecord, TenantRecord, LocationRecord } from './index';
import { toNumber, defaultResolveUnitType } from './index';

export class DefaultStrategy implements AssetClassStrategy {
  assetClass = 'default';
  avgDimensionLabel = 'Avg Unit Size';
  dimensionUnit = '';
  usesPerDimensionRates = false;
  hasSeasonalLineItems = false;
  hasAssetSpecificTenantFields = false;

  statusOptions = ['Occupied', 'Vacant', 'Reserved', 'Maintenance'];

  resolveUnitType(lease: LeaseRecord): string {
    return defaultResolveUnitType(lease);
  }

  resolveUnitDimension(lease: LeaseRecord, _tenant?: TenantRecord | null): number | null {
    return toNumber(lease.unitDimension1) || toNumber(lease.slipLength);
  }

  resolveSecondaryDimension(_lease: LeaseRecord, _tenant?: TenantRecord | null): number | null {
    return toNumber(lease.unitDimension2) || toNumber(lease.slipWidth);
  }

  getOccupancyDenominator(location: LocationRecord): number {
    return location.capacity || 0;
  }
}
