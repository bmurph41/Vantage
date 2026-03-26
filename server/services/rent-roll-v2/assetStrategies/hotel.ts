/**
 * Hotel / STR Strategy
 *
 * Unit types are room types (Standard King, Suite, etc.) or listing types.
 * Revenue is nightly rate × occupancy, not traditional lease rent.
 * Seasonal patterns drive ADR and occupancy.
 */

import type { AssetClassStrategy, LeaseRecord, TenantRecord, LocationRecord } from './index';
import { defaultResolveUnitType } from './index';

export class HotelStrategy implements AssetClassStrategy {
  assetClass = 'hotel';
  avgDimensionLabel = 'ADR';
  dimensionUnit = '';
  usesPerDimensionRates = false;
  hasSeasonalLineItems = false;
  hasAssetSpecificTenantFields = false;

  statusOptions = [
    'Available', 'Occupied', 'Out of Order', 'Out of Service', 'Blocked',
  ];

  resolveUnitType(lease: LeaseRecord): string {
    return defaultResolveUnitType(lease);
  }

  resolveUnitDimension(_lease: LeaseRecord, _tenant?: TenantRecord | null): number | null {
    return null; // Hotel rooms don't have a dimension metric in rent roll context
  }

  resolveSecondaryDimension(_lease: LeaseRecord, _tenant?: TenantRecord | null): number | null {
    return null;
  }

  getOccupancyDenominator(location: LocationRecord): number {
    return location.capacity || 0; // Total keys/rooms
  }
}
