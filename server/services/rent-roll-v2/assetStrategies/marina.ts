/**
 * Marina Strategy — preserves all existing rent roll behavior exactly.
 * This is the default strategy and should never change existing behavior.
 */

import type { AssetClassStrategy, LeaseRecord, TenantRecord, LocationRecord } from './index';
import { toNumber } from './index';

export class MarinaStrategy implements AssetClassStrategy {
  assetClass = 'marina';
  avgDimensionLabel = 'Avg Boat Size';
  dimensionUnit = 'ft';
  usesPerDimensionRates = true;
  hasSeasonalLineItems = true;
  hasAssetSpecificTenantFields = true;

  statusOptions = [
    'Occupied', 'Vacant', 'Unusable', 'Liveaboard', 'Service',
    'Sales', 'Occupied; Not-Paying', 'Small Boat/Dinghy',
    'Commercial', 'Rental Boat', 'Boat Club', 'Transient',
  ];

  resolveUnitType(lease: LeaseRecord): string {
    // Marina always uses the storageType enum (Wet Slip, Dry Rack, etc.)
    return lease.storageType || 'Wet Slip';
  }

  resolveUnitDimension(lease: LeaseRecord, tenant?: TenantRecord | null): number | null {
    // Marina dimension chain: boatLength → slipLength → unitDimension1
    const boatLength = toNumber(tenant?.boatLength);
    if (boatLength) return boatLength;

    const slipLength = toNumber(lease.slipLength);
    if (slipLength) return slipLength;

    return toNumber(lease.unitDimension1);
  }

  resolveSecondaryDimension(lease: LeaseRecord, tenant?: TenantRecord | null): number | null {
    const boatWidth = toNumber(tenant?.boatWidth);
    if (boatWidth) return boatWidth;

    const slipWidth = toNumber(lease.slipWidth);
    if (slipWidth) return slipWidth;

    return toNumber(lease.unitDimension2);
  }

  getOccupancyDenominator(location: LocationRecord, seasonType?: string): number {
    const capacity = location.capacity || 0;
    // Seasonal marinas double capacity for overall occupancy (slot-seasons)
    if (seasonType === 'SEASONAL') {
      return capacity * 2;
    }
    return capacity;
  }
}
