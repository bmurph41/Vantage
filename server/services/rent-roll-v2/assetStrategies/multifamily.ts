/**
 * Multifamily Strategy (Apartments, Duplex, Triplex, Quad)
 *
 * Unit types are bedroom/bathroom configurations. Dimensions are SF.
 * Uses $/Month rates. No seasonal items or per-foot rates.
 */

import type { AssetClassStrategy, LeaseRecord, TenantRecord, LocationRecord } from './index';
import { toNumber, defaultResolveUnitType } from './index';

export class MultifamilyStrategy implements AssetClassStrategy {
  assetClass = 'multifamily';
  avgDimensionLabel = 'Avg Unit SF';
  dimensionUnit = 'SF';
  usesPerDimensionRates = false;
  hasSeasonalLineItems = false;
  hasAssetSpecificTenantFields = false;

  statusOptions = [
    'Occupied', 'Vacant', 'Down for Renovation', 'Model', 'Notice to Vacate', 'Delinquent',
  ];

  resolveUnitType(lease: LeaseRecord): string {
    return defaultResolveUnitType(lease);
  }

  resolveUnitDimension(lease: LeaseRecord, _tenant?: TenantRecord | null): number | null {
    return toNumber(lease.unitDimension1);
  }

  resolveSecondaryDimension(_lease: LeaseRecord, _tenant?: TenantRecord | null): number | null {
    return null;
  }

  getOccupancyDenominator(location: LocationRecord): number {
    return location.capacity || 0;
  }
}
