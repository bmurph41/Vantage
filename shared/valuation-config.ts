// =============================================================================
// VALUATION METHODOLOGY CONFIG
// File: shared/valuation-config.ts
//
// Defines which valuation approaches apply per asset class and how to
// display them in deal-pricing.tsx. Replaces hardcoded cap-rate-only logic.
// =============================================================================

export type ValuationMethod =
  | 'income_cap'       // NOI / Cap Rate
  | 'grm'              // Price / Annual Gross Rent
  | 'price_per_unit'   // Price / # Units
  | 'price_per_sf'     // Price / Square Feet
  | 'price_per_slip'   // Price / # Slips
  | 'price_per_room'   // Price / # Rooms (keys)
  | 'ebitda_multiple'  // EBITDA × Multiple
  | 'sde_multiple'     // SDE × Multiple
  | 'price_per_door'   // Price / # Doors
  | 'dcf'              // Discounted Cash Flow
  | 'comp_sales';      // Sales Comparison

export interface ValuationMethodConfig {
  id: ValuationMethod;
  label: string;
  shortLabel: string;
  description: string;
  formula: string; // human-readable formula
  compute: (params: ValuationParams) => number | null;
  isPrimary: boolean; // show prominently vs secondary
}

export interface ValuationParams {
  noi?: number;
  capRate?: number;
  grossRent?: number;
  grm?: number;
  totalUnits?: number;
  pricePerUnit?: number;
  totalSF?: number;
  pricePerSF?: number;
  totalSlips?: number;
  pricePerSlip?: number;
  totalRooms?: number;
  pricePerRoom?: number;
  ebitda?: number;
  ebitdaMultiple?: number;
  sde?: number;
  sdeMultiple?: number;
  purchasePrice?: number;
}

// ---------------------------------------------------------------------------
// Method definitions
// ---------------------------------------------------------------------------

const INCOME_CAP: ValuationMethodConfig = {
  id: 'income_cap',
  label: 'Income Capitalization',
  shortLabel: 'Cap Rate',
  description: 'Value = NOI ÷ Cap Rate',
  formula: 'NOI / Cap Rate = Value',
  compute: (p) => (p.noi && p.capRate && p.capRate > 0) ? p.noi / p.capRate : null,
  isPrimary: true,
};

const GRM_METHOD: ValuationMethodConfig = {
  id: 'grm',
  label: 'Gross Rent Multiplier',
  shortLabel: 'GRM',
  description: 'Value = Annual Gross Rent × GRM',
  formula: 'Gross Rent × GRM = Value',
  compute: (p) => (p.grossRent && p.grm) ? p.grossRent * p.grm : null,
  isPrimary: false,
};

const PRICE_PER_UNIT: ValuationMethodConfig = {
  id: 'price_per_unit',
  label: 'Price Per Unit',
  shortLabel: '$/Unit',
  description: 'Value = # Units × Price/Unit',
  formula: 'Units × $/Unit = Value',
  compute: (p) => (p.totalUnits && p.pricePerUnit) ? p.totalUnits * p.pricePerUnit : null,
  isPrimary: false,
};

const PRICE_PER_SF: ValuationMethodConfig = {
  id: 'price_per_sf',
  label: 'Price Per Square Foot',
  shortLabel: '$/SF',
  description: 'Value = Total SF × Price/SF',
  formula: 'SF × $/SF = Value',
  compute: (p) => (p.totalSF && p.pricePerSF) ? p.totalSF * p.pricePerSF : null,
  isPrimary: false,
};

const PRICE_PER_SLIP: ValuationMethodConfig = {
  id: 'price_per_slip',
  label: 'Price Per Slip',
  shortLabel: '$/Slip',
  description: 'Value = # Slips × Price/Slip',
  formula: 'Slips × $/Slip = Value',
  compute: (p) => (p.totalSlips && p.pricePerSlip) ? p.totalSlips * p.pricePerSlip : null,
  isPrimary: false,
};

const PRICE_PER_ROOM: ValuationMethodConfig = {
  id: 'price_per_room',
  label: 'Price Per Key',
  shortLabel: '$/Key',
  description: 'Value = # Rooms × Price/Key',
  formula: 'Keys × $/Key = Value',
  compute: (p) => (p.totalRooms && p.pricePerRoom) ? p.totalRooms * p.pricePerRoom : null,
  isPrimary: false,
};

const PRICE_PER_DOOR: ValuationMethodConfig = {
  id: 'price_per_door',
  label: 'Price Per Door',
  shortLabel: '$/Door',
  description: 'Value = # Doors × Price/Door',
  formula: 'Doors × $/Door = Value',
  compute: (p) => (p.totalUnits && p.pricePerUnit) ? p.totalUnits * p.pricePerUnit : null,
  isPrimary: false,
};

const EBITDA_MULTIPLE: ValuationMethodConfig = {
  id: 'ebitda_multiple',
  label: 'EBITDA Multiple',
  shortLabel: 'EBITDA×',
  description: 'Value = EBITDA × Multiple',
  formula: 'EBITDA × Multiple = Value',
  compute: (p) => (p.ebitda && p.ebitdaMultiple) ? p.ebitda * p.ebitdaMultiple : null,
  isPrimary: true,
};

const SDE_MULTIPLE: ValuationMethodConfig = {
  id: 'sde_multiple',
  label: 'SDE Multiple',
  shortLabel: 'SDE×',
  description: "Value = Seller's Discretionary Earnings × Multiple",
  formula: 'SDE × Multiple = Value',
  compute: (p) => (p.sde && p.sdeMultiple) ? p.sde * p.sdeMultiple : null,
  isPrimary: true,
};

// ---------------------------------------------------------------------------
// Asset class → valuation methods mapping
// ---------------------------------------------------------------------------

export const VALUATION_METHODS_BY_CLASS: Record<string, ValuationMethod[]> = {
  marina: ['income_cap', 'price_per_slip', 'grm'],
  multifamily: ['income_cap', 'price_per_unit', 'grm', 'price_per_sf'],
  hotel: ['income_cap', 'price_per_room', 'ebitda_multiple'],
  str: ['income_cap', 'grm'],
  sfr: ['income_cap', 'grm'],
  duplex: ['income_cap', 'price_per_door', 'grm'],
  triplex: ['income_cap', 'price_per_door', 'grm'],
  quad: ['income_cap', 'price_per_door', 'grm'],
  retail: ['income_cap', 'price_per_sf', 'grm'],
  office: ['income_cap', 'price_per_sf', 'grm'],
  industrial: ['income_cap', 'price_per_sf'],
  self_storage: ['income_cap', 'price_per_unit', 'price_per_sf'],
  medical_office: ['income_cap', 'price_per_sf'],
  mixed_use: ['income_cap', 'price_per_sf', 'grm'],
  laundromat: ['income_cap', 'ebitda_multiple', 'sde_multiple'],
  business: ['sde_multiple', 'ebitda_multiple', 'income_cap'],
};

const ALL_METHODS: Record<ValuationMethod, ValuationMethodConfig> = {
  income_cap: INCOME_CAP,
  grm: GRM_METHOD,
  price_per_unit: PRICE_PER_UNIT,
  price_per_sf: PRICE_PER_SF,
  price_per_slip: PRICE_PER_SLIP,
  price_per_room: PRICE_PER_ROOM,
  price_per_door: PRICE_PER_DOOR,
  ebitda_multiple: EBITDA_MULTIPLE,
  sde_multiple: SDE_MULTIPLE,
  dcf: { id: 'dcf', label: 'DCF', shortLabel: 'DCF', description: 'Discounted Cash Flow', formula: 'ΣCF/(1+r)^n + TV/(1+r)^n', compute: () => null, isPrimary: false },
  comp_sales: { id: 'comp_sales', label: 'Comparable Sales', shortLabel: 'Comps', description: 'Market comparable approach', formula: 'Based on recent comparable sales', compute: () => null, isPrimary: false },
};

/**
 * Get the valuation methods applicable to an asset class.
 * Returns full config objects, sorted with primary methods first.
 */
export function getValuationMethods(assetClass: string): ValuationMethodConfig[] {
  const methodIds = VALUATION_METHODS_BY_CLASS[assetClass] ?? VALUATION_METHODS_BY_CLASS['marina'];
  return methodIds
    .map((id) => ALL_METHODS[id])
    .filter(Boolean)
    .sort((a, b) => (b.isPrimary ? 1 : 0) - (a.isPrimary ? 1 : 0));
}

/**
 * Get the primary valuation method for an asset class.
 */
export function getPrimaryValuationMethod(assetClass: string): ValuationMethodConfig {
  const methods = getValuationMethods(assetClass);
  return methods.find((m) => m.isPrimary) ?? methods[0] ?? INCOME_CAP;
}

/**
 * Compute all applicable valuations for a given set of parameters.
 */
export function computeValuations(
  assetClass: string,
  params: ValuationParams,
): { method: ValuationMethodConfig; value: number | null }[] {
  return getValuationMethods(assetClass).map((method) => ({
    method,
    value: method.compute(params),
  }));
}
