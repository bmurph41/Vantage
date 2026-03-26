/**
 * Commercial Real Estate Strategy (Retail, Office, Industrial, Medical Office)
 *
 * Unit types are suites/spaces. Dimensions are square footage.
 * Uses $/SF/Year or $/Month rates. No seasonal line items.
 */

import type { AssetClassStrategy, LeaseRecord, TenantRecord, LocationRecord } from './index';
import { toNumber, defaultResolveUnitType } from './index';

export class CREStrategy implements AssetClassStrategy {
  assetClass: string;
  avgDimensionLabel = 'Avg Rent/SF';
  dimensionUnit = 'SF';
  usesPerDimensionRates = false; // CRE rates are typically quoted $/SF/yr but stored as total amounts
  hasSeasonalLineItems = false;
  hasAssetSpecificTenantFields = true; // Trade name, contact, industry

  statusOptions = [
    'Occupied', 'Vacant', 'Under Renovation', 'Leased - Not Occupied', 'Subleased',
  ];

  constructor(assetClass: string = 'office') {
    this.assetClass = assetClass;
  }

  resolveUnitType(lease: LeaseRecord): string {
    return defaultResolveUnitType(lease);
  }

  resolveUnitDimension(lease: LeaseRecord, _tenant?: TenantRecord | null): number | null {
    // CRE primary dimension is square footage
    return toNumber(lease.unitDimension1) || toNumber(lease.slipLength);
  }

  resolveSecondaryDimension(_lease: LeaseRecord, _tenant?: TenantRecord | null): number | null {
    return null;
  }

  getOccupancyDenominator(location: LocationRecord): number {
    // CRE occupancy is typically based on total rentable SF, but capacity field works as unit count
    return location.capacity || 0;
  }
}
