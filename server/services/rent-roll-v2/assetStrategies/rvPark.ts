/**
 * RV Park / Campground / Mobile Home Park Strategy
 *
 * Similar to marina — seasonal occupancy, per-site pricing, move events.
 * Unit types are site types (Full Hookup, Partial, Dry Camping, etc.).
 * Vehicle dimensions tracked on tenants via assetSpecificData.
 */

import type { AssetClassStrategy, LeaseRecord, TenantRecord, LocationRecord } from './index';
import { toNumber, defaultResolveUnitType } from './index';

export class RVParkStrategy implements AssetClassStrategy {
  assetClass = 'rv_park';
  avgDimensionLabel = 'Avg Site Size';
  dimensionUnit = 'ft';
  usesPerDimensionRates = false;
  hasSeasonalLineItems = true; // Seasonal sites like marina seasonal slips
  hasAssetSpecificTenantFields = true; // Vehicle type, length

  statusOptions = [
    'Occupied', 'Vacant', 'Reserved', 'Seasonal Hold', 'Maintenance', 'Out of Service',
  ];

  resolveUnitType(lease: LeaseRecord): string {
    return defaultResolveUnitType(lease);
  }

  resolveUnitDimension(lease: LeaseRecord, tenant?: TenantRecord | null): number | null {
    // RV parks may track site size or vehicle length
    const dim1 = toNumber(lease.unitDimension1);
    if (dim1) return dim1;

    // Check asset-specific data for vehicle length
    const vehicleLength = toNumber(tenant?.assetSpecificData?.vehicleLength);
    if (vehicleLength) return vehicleLength;

    return toNumber(lease.slipLength);
  }

  resolveSecondaryDimension(lease: LeaseRecord, _tenant?: TenantRecord | null): number | null {
    return toNumber(lease.unitDimension2) || toNumber(lease.slipWidth);
  }

  getOccupancyDenominator(location: LocationRecord, seasonType?: string): number {
    const capacity = location.capacity || 0;
    // Seasonal RV parks can double capacity like marinas
    if (seasonType === 'SEASONAL') {
      return capacity * 2;
    }
    return capacity;
  }
}
