/**
 * Self-Storage Strategy
 *
 * Unit types are size-based (5x5, 5x10, 10x10, etc.) with climate/non-climate variants.
 * Dimensions are square footage. No per-foot rates — uses per-month or per-SF rates.
 */

import type { AssetClassStrategy, LeaseRecord, TenantRecord, LocationRecord } from './index';
import { toNumber, defaultResolveUnitType } from './index';

export class SelfStorageStrategy implements AssetClassStrategy {
  assetClass = 'self_storage';
  avgDimensionLabel = 'Avg Unit Size';
  dimensionUnit = 'SF';
  usesPerDimensionRates = false;
  hasSeasonalLineItems = false;
  hasAssetSpecificTenantFields = false;

  statusOptions = [
    'Occupied', 'Vacant', 'Reserved', 'Delinquent', 'Maintenance', 'Out of Service',
  ];

  resolveUnitType(lease: LeaseRecord): string {
    return defaultResolveUnitType(lease);
  }

  resolveUnitDimension(lease: LeaseRecord, _tenant?: TenantRecord | null): number | null {
    // Self-storage primary dimension is square footage stored in unitDimension1
    const dim1 = toNumber(lease.unitDimension1);
    if (dim1) return dim1;

    // Fallback: calculate from slip dimensions if available (width × depth)
    const w = toNumber(lease.slipLength);
    const d = toNumber(lease.slipWidth);
    if (w && d) return w * d;

    return null;
  }

  resolveSecondaryDimension(_lease: LeaseRecord, _tenant?: TenantRecord | null): number | null {
    return null; // Self-storage doesn't use secondary dimension
  }

  getOccupancyDenominator(location: LocationRecord): number {
    return location.capacity || 0;
  }
}
