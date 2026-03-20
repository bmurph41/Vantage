/**
 * Asset-Class Model Configuration
 *
 * Master config that drives the entire Financial Model workspace:
 * - Inputs & Assumptions tab (storage/unit types, profit centers, seasons, growth)
 * - Storage Leases → Unit Mix tab (columns, types, rates)
 * - Profit Centers tab (departments, revenue streams)
 * - Overview KPIs
 * - Tab visibility & naming
 *
 * Every workspace component imports from here and renders dynamically.
 *
 * Usage:
 *   import { getModelConfig } from '@shared/asset-class-model-config';
 *   const config = getModelConfig(project.assetClass);
 */

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

export interface AssetClassModelConfig {
  id: string;
  label: string;

  // ─── Terminology ────────────────────────────────────────
  terms: {
    unit: string;           // "slip" | "unit" | "suite" | "key" | "machine"
    unitPlural: string;     // "slips" | "units" | "suites" | "keys"
    property: string;       // "marina" | "property" | "hotel" | "facility"
    propertyPlural: string;
    rentRoll: string;       // "Slip Rent Roll" | "Rent Roll" | "Room Inventory"
    occupancy: string;      // "Occupancy" | "Vacancy"
    noi: string;            // "NOI" | "EBITDA"
    pricePerUnit: string;   // "$/Slip" | "$/Unit" | "$/Key" | "$/SF"
    totalUnitsLabel: string; // "Total Slips" | "Total Units" | "Total Keys"
  };

  // ─── Valuation ──────────────────────────────────────────
  valuationMetric: 'cap_rate' | 'grm' | 'ebitda_multiple';
  valuationLabel: string;   // "Cap Rate" | "GRM" | "EBITDA Multiple"

  // ─── Seasonality ────────────────────────────────────────
  hasSeasonal: boolean;           // Does this asset class have seasonal patterns?
  seasonConfig: {
    type: 'marina' | 'hospitality' | 'str' | 'none';
    defaultInSeasonMonths?: number[];  // e.g., [4,5,6,7,8,9,10] for Apr-Oct
    seasonLabel?: string;              // "In-Season" | "Peak Season" | "High Season"
    offSeasonLabel?: string;           // "Off-Season" | "Shoulder Season" | "Low Season"
  };

  // ─── Unit Mix / Storage Types ───────────────────────────
  // What appears in the "Storage Leases" / "Unit Mix" tab
  unitMix: {
    tabLabel: 'Listings & Units',
    tabIcon: 'home',
    showTab: true,
    countColumnLabel: 'Listings',
    rateColumnLabel: 'Avg Nightly Rate',
    rateType: 'nightly',
    sfColumnLabel: 'Avg SF',
    showSF: true,
    types: [
      { id: 'studio', name: 'Studio', icon: 'home', section: 'Standard', hasSeasons: true, defaultFields: { avgSF: 450, count: 0 } },
      { id: '1br_1ba', name: '1 Bed / 1 Bath', icon: 'home', section: 'Standard', hasSeasons: true, defaultFields: { avgSF: 650, count: 0 } },
      { id: '2br_1ba', name: '2 Bed / 1 Bath', icon: 'home', section: 'Standard', hasSeasons: true, defaultFields: { avgSF: 900, count: 0 } },
      { id: '2br_2ba', name: '2 Bed / 2 Bath', icon: 'home', section: 'Standard', hasSeasons: true, defaultFields: { avgSF: 1000, count: 0 } },
      { id: '2br_1half', name: '2 Bed / 1.5 Bath', icon: 'home', section: 'Standard', hasSeasons: true, defaultFields: { avgSF: 950, count: 0 } },
      { id: '3br_2ba', name: '3 Bed / 2 Bath', icon: 'home', section: 'Larger', hasSeasons: true, defaultFields: { avgSF: 1200, count: 0 } },
      { id: '3br_2half', name: '3 Bed / 2.5 Bath', icon: 'home', section: 'Larger', hasSeasons: true, defaultFields: { avgSF: 1300, count: 0 } },
      { id: '3br_3ba', name: '3 Bed / 3 Bath', icon: 'home', section: 'Larger', hasSeasons: true, defaultFields: { avgSF: 1400, count: 0 } },
      { id: '4br_2ba', name: '4 Bed / 2 Bath', icon: 'home', section: 'Larger', hasSeasons: true, defaultFields: { avgSF: 1600, count: 0 } },
      { id: '4br_2half', name: '4 Bed / 2.5 Bath', icon: 'home', section: 'Large', hasSeasons: true, defaultFields: { avgSF: 1700, count: 0 } },
      { id: '4br_3half', name: '4 Bed / 3.5 Bath', icon: 'home', section: 'Large', hasSeasons: true, defaultFields: { avgSF: 1900, count: 0 } },
      { id: '4br_3ba', name: '4 Bed / 3 Bath', icon: 'home', section: 'Large', hasSeasons: true, defaultFields: { avgSF: 1800, count: 0 } },
      { id: '5br_plus', name: '5+ Bed', icon: 'home', section: 'Large', hasSeasons: true, defaultFields: { avgSF: 2200, count: 0 } },
      { id: 'custom', name: 'Custom Layout', icon: 'edit', section: 'Custom', hasSeasons: true, defaultFields: { avgSF: 0, count: 0 } },
    ],
  },

  // ─── Profit Centers / Departments ───────────────────────
  // What appears in the "Profit Centers" tab
  profitCenters: {
    tabLabel: string;         // "Profit Centers" | "Revenue Departments" | "Revenue Streams"
    showTab: boolean;         // Whether tab appears
    departments: DepartmentConfig[];
  };

  // ─── Inputs & Assumptions Sections ──────────────────────
  inputSections: InputSectionConfig[];

  // ─── Growth Assumptions ─────────────────────────────────
  growthCategories: GrowthCategoryConfig[];

  // ─── KPIs for Overview ──────────────────────────────────
  kpis: KPIConfig[];

  // ─── Tab Visibility ─────────────────────────────────────
  tabs: { storageLeases: true, commercialLeases: false, profitCenters: false },
}

export interface UnitMixTypeConfig {
  id: string;
  name: string;
  icon: string;
  section: string;        // Group heading: "In-Water", "Standard", "Climate-Controlled"
  hasSeasons: boolean;    // Does this type have seasonal pricing?
  defaultFields: {
    count?: number;
    monthlyRate?: number;
    annualRate?: number;
    avgSF?: number;
    occupancy?: number;
  };
}

export interface DepartmentConfig {
  id: string;
  name: string;
  icon: string;
  category: 'core' | 'ancillary' | 'specialty';
  description: string;
  hasRevenue: boolean;
  hasCOGS: boolean;
  hasDirectLabor: boolean;
  revenueLines: string[];    // Default revenue line items
  cogsLines?: string[];      // Default COGS line items
  expenseLines?: string[];   // Default expense line items
}

export interface InputSectionConfig {
  id: string;
  label: string;
  icon: string;
  fields: InputFieldDef[];
}

export interface InputFieldDef {
  id: string;
  label: string;
  type: 'number' | 'percent' | 'currency' | 'select' | 'text' | 'integer';
  placeholder?: string;
  suffix?: string;
  options?: { value: string; label: string }[];
  tooltip?: string;
  width?: 'full' | 'half' | 'third';
  defaultValue?: string | number;
}

export interface GrowthCategoryConfig {
  id: string;
  label: string;
  icon: string;
  description: string;
  defaultRate: number;    // Default annual growth % (e.g., 3.0)
  subcategories?: { id: string; label: string; defaultRate: number }[];
}

export interface KPIConfig {
  id: string;
  label: string;
  field: string;          // Project field to read from
  format: 'currency' | 'percent' | 'number' | 'multiple';
  icon: string;
}


// ═══════════════════════════════════════════════════════════════
// Marina Config
// ═══════════════════════════════════════════════════════════════

const MARINA_CONFIG: AssetClassModelConfig = {
  id: 'marina',
  label: 'Marina',
  terms: {
    unit: 'slip', unitPlural: 'slips',
    property: 'marina', propertyPlural: 'properties',
    rentRoll: 'Slip Rent Roll', occupancy: 'Occupancy',
    noi: 'NOI', pricePerUnit: '$/Slip', totalUnitsLabel: 'Total Slips',
  },
  valuationMetric: 'cap_rate', valuationLabel: 'Cap Rate',
  hasSeasonal: true,
  seasonConfig: {
    type: 'marina',
    defaultInSeasonMonths: [4, 5, 6, 7, 8, 9, 10],
    seasonLabel: 'In-Season',
    offSeasonLabel: 'Off-Season',
  },
  unitMix: {
    tabLabel: 'Storage Leases',
    tabIcon: 'anchor',
    showTab: true,
    countColumnLabel: 'Slips / Spaces',
    rateColumnLabel: 'Monthly Rate',
    rateType: 'monthly',
    showSF: false,
    types: [
      { id: 'wet_slips', name: 'Wet Slips', icon: 'anchor', section: 'In-Water', hasSeasons: true, defaultFields: {} },
      { id: 'lift_slips', name: 'Lift Slips', icon: 'waves', section: 'In-Water', hasSeasons: true, defaultFields: {} },
      { id: 'moorings', name: 'Moorings', icon: 'anchor', section: 'In-Water', hasSeasons: true, defaultFields: {} },
      { id: 'dinghies', name: 'Dinghies', icon: 'sailboat', section: 'In-Water', hasSeasons: true, defaultFields: {} },
      { id: 'dry_racks_indoor', name: 'Dry Racks – Indoor', icon: 'warehouse', section: 'Dry Storage', hasSeasons: false, defaultFields: {} },
      { id: 'dry_racks_outdoor', name: 'Dry Racks – Outdoor', icon: 'container', section: 'Dry Storage', hasSeasons: true, defaultFields: {} },
      { id: 'boats_on_trailers', name: 'Boats on Trailers', icon: 'ship', section: 'Dry Storage', hasSeasons: true, defaultFields: {} },
      { id: 'kayak_paddleboard', name: 'Kayak / Paddleboard', icon: 'waves', section: 'Small Craft', hasSeasons: true, defaultFields: {} },
      { id: 'houseboats', name: 'Houseboats', icon: 'home', section: 'Specialty', hasSeasons: false, defaultFields: {} },
      { id: 'liveaboards', name: 'Liveaboards', icon: 'home', section: 'Specialty', hasSeasons: false, defaultFields: {} },
    ],
  },
  profitCenters: {
    tabLabel: 'Profit Centers',
    showTab: true,
    departments: [
      { id: 'fuel', name: 'Fuel Sales', icon: 'fuel', category: 'core', description: 'Fuel dock operations',
        hasRevenue: true, hasCOGS: true, hasDirectLabor: true,
        revenueLines: ['Gas Sales', 'Diesel Sales', 'Pump-Out Fees'],
        cogsLines: ['Fuel COGS', 'Fuel Delivery'], expenseLines: ['Fuel Dock Labor', 'Equipment Maintenance'] },
      { id: 'ship_store', name: "Ship's Store", icon: 'store', category: 'core', description: 'Retail merchandise',
        hasRevenue: true, hasCOGS: true, hasDirectLabor: true,
        revenueLines: ['Merchandise Sales', 'Snack & Beverage', 'Ice Sales'],
        cogsLines: ['Merchandise COGS'], expenseLines: ['Store Labor', 'Store Supplies'] },
      { id: 'service', name: 'Service & Repairs', icon: 'wrench', category: 'core', description: 'Boat maintenance and repair',
        hasRevenue: true, hasCOGS: true, hasDirectLabor: true,
        revenueLines: ['Service Labor Revenue', 'Parts Revenue', 'Haul-Out/Launch Fees'],
        cogsLines: ['Parts COGS', 'Subcontracted Labor'], expenseLines: ['Technician Labor', 'Shop Supplies'] },
      { id: 'boat_rentals', name: 'Boat Rentals', icon: 'sailboat', category: 'ancillary', description: 'Rental fleet',
        hasRevenue: true, hasCOGS: false, hasDirectLabor: true,
        revenueLines: ['Kayak Rentals', 'Pontoon Rentals', 'Jet Ski Rentals', 'Paddleboard Rentals'] },
      { id: 'boat_club', name: 'Boat Club', icon: 'users', category: 'specialty', description: 'Membership boat club',
        hasRevenue: true, hasCOGS: false, hasDirectLabor: false,
        revenueLines: ['Monthly Membership Dues', 'Initiation Fees'] },
      { id: 'restaurant', name: 'F&B / Restaurant', icon: 'utensils', category: 'ancillary', description: 'Food & beverage',
        hasRevenue: true, hasCOGS: true, hasDirectLabor: true,
        revenueLines: ['Food Revenue', 'Beverage Revenue', 'Catering Revenue'],
        cogsLines: ['Food COGS', 'Beverage COGS'] },
      { id: 'commercial_tenants', name: 'Third-Party Leases', icon: 'building', category: 'ancillary', description: 'Leased spaces',
        hasRevenue: true, hasCOGS: false, hasDirectLabor: false,
        revenueLines: ['Lease Revenue', 'CAM Recovery'] },
    ],
  },
  inputSections: [
    { id: 'general', label: 'General Assumptions', icon: 'settings', fields: [
      { id: 'purchasePrice', label: 'Purchase Price', type: 'currency', width: 'half' },
      { id: 'closingDate', label: 'Closing Date', type: 'text', width: 'half' },
      { id: 'holdPeriod', label: 'Hold Period (Years)', type: 'integer', width: 'half', defaultValue: 5 },
      { id: 'managementFeePercent', label: 'Management Fee %', type: 'percent', width: 'half', defaultValue: 5 },
    ]},
    { id: 'seasons', label: 'Seasonality', icon: 'sun', fields: [
      { id: 'inSeasonMonths', label: 'In-Season Months', type: 'select', width: 'full', tooltip: 'Months when marina operates at full seasonal rate' },
      { id: 'offSeasonDiscount', label: 'Off-Season Discount %', type: 'percent', width: 'half', defaultValue: 25 },
    ]},
  ],
  growthCategories: [
    { id: 'storage_revenue', label: 'Storage Revenue Growth', icon: 'trending-up', description: 'Annual rate increase for slips and racks', defaultRate: 3.0 },
    { id: 'fuel_revenue', label: 'Fuel Revenue Growth', icon: 'fuel', description: 'Fuel sales volume and pricing growth', defaultRate: 2.0 },
    { id: 'store_revenue', label: 'Store Revenue Growth', icon: 'store', description: "Ship's store and retail revenue growth", defaultRate: 2.5 },
    { id: 'service_revenue', label: 'Service Revenue Growth', icon: 'wrench', description: 'Service department revenue growth', defaultRate: 3.0 },
    { id: 'other_revenue', label: 'Other Revenue Growth', icon: 'trending-up', description: 'Ancillary and miscellaneous revenue', defaultRate: 2.0 },
    { id: 'operating_expenses', label: 'Operating Expense Growth', icon: 'arrow-up', description: 'Annual OpEx inflation', defaultRate: 2.5 },
    { id: 'payroll', label: 'Payroll Growth', icon: 'users', description: 'Annual payroll and benefits inflation', defaultRate: 3.0 },
    { id: 'insurance', label: 'Insurance Growth', icon: 'shield', description: 'Annual insurance premium increases', defaultRate: 5.0 },
    { id: 'property_tax', label: 'Property Tax Growth', icon: 'building', description: 'Annual property tax increases', defaultRate: 2.0 },
  ],
  kpis: [
    { id: 'purchasePrice', label: 'Purchase Price', field: 'purchasePrice', format: 'currency', icon: 'dollar-sign' },
    { id: 'capRate', label: 'Cap Rate', field: 'year1CapRate', format: 'percent', icon: 'percent' },
    { id: 'totalUnits', label: 'Total Slips', field: 'totalStorageUnits', format: 'number', icon: 'anchor' },
    { id: 'ebitda', label: 'EBITDA', field: 'ebitda', format: 'currency', icon: 'trending-up' },
  ],
  tabs: { storageLeases: true, commercialLeases: true, profitCenters: true },
};


// ═══════════════════════════════════════════════════════════════
// Multifamily Config
// ═══════════════════════════════════════════════════════════════

const MULTIFAMILY_CONFIG: AssetClassModelConfig = {
  id: 'multifamily',
  label: 'Multifamily',
  terms: {
    unit: 'unit', unitPlural: 'units',
    property: 'property', propertyPlural: 'properties',
    rentRoll: 'Rent Roll', occupancy: 'Occupancy',
    noi: 'NOI', pricePerUnit: '$/Unit', totalUnitsLabel: 'Total Units',
  },
  valuationMetric: 'cap_rate', valuationLabel: 'Cap Rate',
  hasSeasonal: false,
  seasonConfig: { type: 'none' },
  unitMix: {
    tabLabel: 'Unit Mix',
    tabIcon: 'home',
    showTab: true,
    countColumnLabel: 'Units',
    rateColumnLabel: 'Avg Rent/Mo',
    rateType: 'monthly',
    sfColumnLabel: 'Avg SF',
    showSF: true,
    types: [
      { id: 'studio', name: 'Studio', icon: 'home', section: 'Standard', hasSeasons: false, defaultFields: { avgSF: 450 } },
      { id: '1br_1ba', name: '1 Bed / 1 Bath', icon: 'home', section: 'Standard', hasSeasons: false, defaultFields: { avgSF: 700 } },
      { id: '2br_1ba', name: '2 Bed / 1 Bath', icon: 'home', section: 'Standard', hasSeasons: false, defaultFields: { avgSF: 900 } },
      { id: '2br_2ba', name: '2 Bed / 2 Bath', icon: 'home', section: 'Standard', hasSeasons: false, defaultFields: { avgSF: 1000 } },
      { id: '2br_1half', name: '2 Bed / 1.5 Bath', icon: 'home', section: 'Standard', hasSeasons: false, defaultFields: { avgSF: 950 } },
      { id: '3br_2ba', name: '3 Bed / 2 Bath', icon: 'home', section: 'Larger', hasSeasons: false, defaultFields: { avgSF: 1200 } },
      { id: '3br_2half', name: '3 Bed / 2.5 Bath', icon: 'home', section: 'Larger', hasSeasons: false, defaultFields: { avgSF: 1300 } },
      { id: '4br_plus', name: '4 Bed+', icon: 'home', section: 'Larger', hasSeasons: false, defaultFields: { avgSF: 1500 } },
      { id: 'townhome', name: 'Townhome', icon: 'building-2', section: 'Specialty', hasSeasons: false, defaultFields: { avgSF: 1400 } },
    ],
  },
  profitCenters: {
    tabLabel: 'Other Income',
    showTab: true,
    departments: [
      { id: 'parking', name: 'Parking', icon: 'car', category: 'core', description: 'Covered and uncovered parking',
        hasRevenue: true, hasCOGS: false, hasDirectLabor: false,
        revenueLines: ['Covered Parking', 'Uncovered Parking', 'Garage Parking'] },
      { id: 'laundry_vending', name: 'Laundry & Vending', icon: 'home', category: 'ancillary', description: 'Coin-op laundry and vending',
        hasRevenue: true, hasCOGS: false, hasDirectLabor: false,
        revenueLines: ['Laundry Revenue', 'Vending Revenue'] },
      { id: 'pet_fees', name: 'Pet Fees', icon: 'home', category: 'ancillary', description: 'Pet rent and deposits',
        hasRevenue: true, hasCOGS: false, hasDirectLabor: false,
        revenueLines: ['Monthly Pet Rent', 'One-Time Pet Fee'] },
      { id: 'utility_reimbursement', name: 'Utility Reimbursement', icon: 'zap', category: 'ancillary', description: 'RUBS or sub-metered',
        hasRevenue: true, hasCOGS: false, hasDirectLabor: false,
        revenueLines: ['Water/Sewer RUBS', 'Trash RUBS', 'Electric RUBS'] },
      { id: 'storage_units', name: 'Storage Units', icon: 'warehouse', category: 'ancillary', description: 'Tenant storage rentals',
        hasRevenue: true, hasCOGS: false, hasDirectLabor: false,
        revenueLines: ['Storage Unit Rent'] },
      { id: 'application_fees', name: 'Application & Admin Fees', icon: 'file-text', category: 'ancillary', description: 'Lease admin fees',
        hasRevenue: true, hasCOGS: false, hasDirectLabor: false,
        revenueLines: ['Application Fees', 'Late Fees', 'Lease-Break Fees', 'NSF Fees'] },
    ],
  },
  inputSections: [
    { id: 'general', label: 'General Assumptions', icon: 'settings', fields: [
      { id: 'purchasePrice', label: 'Purchase Price', type: 'currency', width: 'half' },
      { id: 'closingDate', label: 'Closing Date', type: 'text', width: 'half' },
      { id: 'holdPeriod', label: 'Hold Period (Years)', type: 'integer', width: 'half', defaultValue: 5 },
      { id: 'managementFeePercent', label: 'Management Fee %', type: 'percent', width: 'half', defaultValue: 5 },
    ]},
    { id: 'vacancy', label: 'Vacancy & Concessions', icon: 'percent', fields: [
      { id: 'economicVacancy', label: 'Economic Vacancy %', type: 'percent', width: 'half', defaultValue: 5 },
      { id: 'concessions', label: 'Concessions %', type: 'percent', width: 'half', defaultValue: 1 },
      { id: 'badDebt', label: 'Bad Debt / Collection Loss %', type: 'percent', width: 'half', defaultValue: 1 },
      { id: 'turnoverCost', label: 'Avg Turnover Cost / Unit', type: 'currency', width: 'half' },
    ]},
  ],
  growthCategories: [
    { id: 'rental_revenue', label: 'Rental Revenue Growth', icon: 'trending-up', description: 'Annual rent increases', defaultRate: 3.0,
      subcategories: [
        { id: 'market_rent', label: 'Market Rent Growth', defaultRate: 3.0 },
        { id: 'renewal_rate', label: 'Renewal Increase', defaultRate: 2.5 },
      ]},
    { id: 'other_income', label: 'Other Income Growth', icon: 'dollar-sign', description: 'Parking, laundry, fees', defaultRate: 2.5 },
    { id: 'operating_expenses', label: 'Operating Expense Growth', icon: 'arrow-up', description: 'Annual OpEx inflation', defaultRate: 2.5 },
    { id: 'payroll', label: 'Payroll Growth', icon: 'users', description: 'Wages and benefits', defaultRate: 3.0 },
    { id: 'insurance', label: 'Insurance Growth', icon: 'shield', description: 'Premium increases', defaultRate: 5.0 },
    { id: 'property_tax', label: 'Property Tax Growth', icon: 'building', description: 'Tax assessment increases', defaultRate: 2.0 },
    { id: 'utilities', label: 'Utilities Growth', icon: 'zap', description: 'Utility cost inflation', defaultRate: 3.0 },
  ],
  kpis: [
    { id: 'purchasePrice', label: 'Purchase Price', field: 'purchasePrice', format: 'currency', icon: 'dollar-sign' },
    { id: 'capRate', label: 'Cap Rate', field: 'year1CapRate', format: 'percent', icon: 'percent' },
    { id: 'totalUnits', label: 'Total Units', field: 'totalStorageUnits', format: 'number', icon: 'home' },
    { id: 'noi', label: 'NOI', field: 'ebitda', format: 'currency', icon: 'trending-up' },
    { id: 'pricePerUnit', label: '$/Unit', field: 'pricePerUnit', format: 'currency', icon: 'dollar-sign' },
  ],
  tabs: { storageLeases: true, commercialLeases: false, profitCenters: true },
};


// ═══════════════════════════════════════════════════════════════
// Hotel Config
// ═══════════════════════════════════════════════════════════════

const HOTEL_CONFIG: AssetClassModelConfig = {
  id: 'hotel',
  label: 'Hotel / Hospitality',
  terms: {
    unit: 'key', unitPlural: 'keys',
    property: 'hotel', propertyPlural: 'hotels',
    rentRoll: 'Room Inventory', occupancy: 'Occupancy',
    noi: 'EBITDA', pricePerUnit: '$/Key', totalUnitsLabel: 'Total Keys',
  },
  valuationMetric: 'ebitda_multiple', valuationLabel: 'EBITDA Multiple',
  hasSeasonal: true,
  seasonConfig: {
    type: 'hospitality',
    defaultInSeasonMonths: [3, 4, 5, 6, 7, 8, 9, 10, 11],
    seasonLabel: 'Peak Season',
    offSeasonLabel: 'Low Season',
  },
  unitMix: {
    tabLabel: 'Room Types',
    tabIcon: 'bed',
    showTab: true,
    countColumnLabel: 'Keys',
    rateColumnLabel: 'Avg ADR',
    rateType: 'nightly',
    showSF: true,
    sfColumnLabel: 'Avg SF',
    types: [
      { id: 'standard_king', name: 'Standard King', icon: 'home', section: 'Standard', hasSeasons: true, defaultFields: { avgSF: 325 } },
      { id: 'standard_double', name: 'Standard Double/Queen', icon: 'home', section: 'Standard', hasSeasons: true, defaultFields: { avgSF: 325 } },
      { id: 'deluxe_king', name: 'Deluxe King', icon: 'home', section: 'Premium', hasSeasons: true, defaultFields: { avgSF: 400 } },
      { id: 'junior_suite', name: 'Junior Suite', icon: 'building', section: 'Suites', hasSeasons: true, defaultFields: { avgSF: 500 } },
      { id: 'one_bedroom_suite', name: '1-Bedroom Suite', icon: 'building', section: 'Suites', hasSeasons: true, defaultFields: { avgSF: 650 } },
      { id: 'two_bedroom_suite', name: '2-Bedroom Suite', icon: 'building', section: 'Suites', hasSeasons: true, defaultFields: { avgSF: 900 } },
      { id: 'presidential', name: 'Presidential Suite', icon: 'crown', section: 'Premium', hasSeasons: true, defaultFields: { avgSF: 1200 } },
      { id: 'accessible', name: 'ADA Accessible', icon: 'users', section: 'Specialty', hasSeasons: true, defaultFields: { avgSF: 375 } },
    ],
  },
  profitCenters: {
    tabLabel: 'Revenue Departments',
    showTab: true,
    departments: [
      { id: 'rooms', name: 'Rooms', icon: 'home', category: 'core', description: 'Room revenue (transient, group, contract)',
        hasRevenue: true, hasCOGS: false, hasDirectLabor: true,
        revenueLines: ['Transient Revenue', 'Group Revenue', 'Contract Revenue', 'Allowances/Adjustments'],
        expenseLines: ['Front Desk Labor', 'Housekeeping Labor', 'Laundry', 'Supplies', 'Reservations'] },
      { id: 'food_beverage', name: 'Food & Beverage', icon: 'utensils', category: 'core', description: 'Restaurant, bar, banquets, room service',
        hasRevenue: true, hasCOGS: true, hasDirectLabor: true,
        revenueLines: ['Food Revenue', 'Beverage Revenue', 'Banquet Revenue', 'Room Service Revenue'],
        cogsLines: ['Cost of Food', 'Cost of Beverage'], expenseLines: ['F&B Labor', 'F&B Supplies'] },
      { id: 'meetings_events', name: 'Meetings & Events', icon: 'presentation', category: 'core', description: 'Conference rooms, A/V, setup',
        hasRevenue: true, hasCOGS: false, hasDirectLabor: true,
        revenueLines: ['Meeting Room Rental', 'A/V Revenue', 'Setup & Service Charges'] },
      { id: 'spa', name: 'Spa / Wellness', icon: 'heart', category: 'ancillary', description: 'Spa treatments and health club',
        hasRevenue: true, hasCOGS: true, hasDirectLabor: true,
        revenueLines: ['Spa Treatment Revenue', 'Health Club Fees', 'Retail/Product Sales'],
        cogsLines: ['Spa Product COGS'] },
      { id: 'parking', name: 'Parking', icon: 'car', category: 'ancillary', description: 'Valet and self-park',
        hasRevenue: true, hasCOGS: false, hasDirectLabor: true,
        revenueLines: ['Valet Revenue', 'Self-Park Revenue'] },
      { id: 'other_operated', name: 'Other Operated', icon: 'layers', category: 'ancillary', description: 'Gift shop, laundry, business center',
        hasRevenue: true, hasCOGS: true, hasDirectLabor: false,
        revenueLines: ['Gift Shop Revenue', 'Guest Laundry', 'Business Center', 'Telephone/Internet'],
        cogsLines: ['Gift Shop COGS'] },
    ],
  },
  inputSections: [
    { id: 'general', label: 'General Assumptions', icon: 'settings', fields: [
      { id: 'purchasePrice', label: 'Purchase Price', type: 'currency', width: 'half' },
      { id: 'closingDate', label: 'Closing Date', type: 'text', width: 'half' },
      { id: 'holdPeriod', label: 'Hold Period (Years)', type: 'integer', width: 'half', defaultValue: 5 },
      { id: 'managementFeePercent', label: 'Management Fee %', type: 'percent', width: 'half', defaultValue: 3 },
    ]},
    { id: 'occupancy', label: 'Occupancy & Rates', icon: 'bar-chart', fields: [
      { id: 'stabilizedOccupancy', label: 'Stabilized Occupancy %', type: 'percent', width: 'half', defaultValue: 72 },
      { id: 'avgADR', label: 'Average ADR', type: 'currency', width: 'half' },
      { id: 'revpar', label: 'RevPAR (calculated)', type: 'currency', width: 'half' },
      { id: 'franchiseFeePercent', label: 'Franchise Fee %', type: 'percent', width: 'half', defaultValue: 5 },
    ]},
  ],
  growthCategories: [
    { id: 'rooms_revenue', label: 'Rooms Revenue Growth', icon: 'trending-up', description: 'ADR growth rate', defaultRate: 3.0 },
    { id: 'fb_revenue', label: 'F&B Revenue Growth', icon: 'utensils', description: 'Food & beverage growth', defaultRate: 2.5 },
    { id: 'other_revenue', label: 'Other Revenue Growth', icon: 'dollar-sign', description: 'Spa, parking, other departments', defaultRate: 2.0 },
    { id: 'departmental_expenses', label: 'Departmental Expense Growth', icon: 'arrow-up', description: 'Labor and departmental costs', defaultRate: 3.0 },
    { id: 'undistributed_expenses', label: 'Undistributed OpEx Growth', icon: 'arrow-up', description: 'A&G, S&M, POM, utilities', defaultRate: 2.5 },
    { id: 'insurance', label: 'Insurance Growth', icon: 'shield', description: 'Property insurance', defaultRate: 5.0 },
    { id: 'property_tax', label: 'Property Tax Growth', icon: 'building', description: 'Real estate tax', defaultRate: 2.0 },
  ],
  kpis: [
    { id: 'purchasePrice', label: 'Purchase Price', field: 'purchasePrice', format: 'currency', icon: 'dollar-sign' },
    { id: 'ebitdaMultiple', label: 'EBITDA Multiple', field: 'ebitdaMultiple', format: 'multiple', icon: 'x' },
    { id: 'totalKeys', label: 'Total Keys', field: 'totalStorageUnits', format: 'number', icon: 'home' },
    { id: 'revpar', label: 'RevPAR', field: 'revpar', format: 'currency', icon: 'bar-chart' },
    { id: 'adr', label: 'ADR', field: 'adr', format: 'currency', icon: 'dollar-sign' },
  ],
  tabs: { storageLeases: true, commercialLeases: false, profitCenters: true },
};


// ═══════════════════════════════════════════════════════════════
// Short-Term Rental Config
// ═══════════════════════════════════════════════════════════════

const STR_CONFIG: AssetClassModelConfig = {
  id: 'str',
  label: 'Short-Term Rental',
  terms: {
    unit: 'listing', unitPlural: 'listings',
    property: 'property', propertyPlural: 'properties',
    rentRoll: 'Listing Setup', occupancy: 'Occupancy',
    noi: 'NOI', pricePerUnit: '$/Listing', totalUnitsLabel: 'Total Listings',
  },
  valuationMetric: 'grm', valuationLabel: 'GRM',
  hasSeasonal: true,
  seasonConfig: {
    type: 'str',
    defaultInSeasonMonths: [3, 4, 5, 6, 7, 8, 9, 10, 11],
    seasonLabel: 'High Season',
    offSeasonLabel: 'Low Season',
  },
  unitMix: {
    tabLabel: 'Listings & Units',
    tabIcon: 'home',
    showTab: true,
    countColumnLabel: 'Listings',
    rateColumnLabel: 'Avg Nightly Rate',
    rateType: 'nightly',
    sfColumnLabel: 'Avg SF',
    showSF: true,
    types: [
      { id: 'studio', name: 'Studio', icon: 'home', section: 'Standard', hasSeasons: true, defaultFields: { avgSF: 450, count: 0 } },
      { id: '1br_1ba', name: '1 Bed / 1 Bath', icon: 'home', section: 'Standard', hasSeasons: true, defaultFields: { avgSF: 650, count: 0 } },
      { id: '2br_1ba', name: '2 Bed / 1 Bath', icon: 'home', section: 'Standard', hasSeasons: true, defaultFields: { avgSF: 900, count: 0 } },
      { id: '2br_2ba', name: '2 Bed / 2 Bath', icon: 'home', section: 'Standard', hasSeasons: true, defaultFields: { avgSF: 1000, count: 0 } },
      { id: '2br_1half', name: '2 Bed / 1.5 Bath', icon: 'home', section: 'Standard', hasSeasons: true, defaultFields: { avgSF: 950, count: 0 } },
      { id: '3br_2ba', name: '3 Bed / 2 Bath', icon: 'home', section: 'Larger', hasSeasons: true, defaultFields: { avgSF: 1200, count: 0 } },
      { id: '3br_2half', name: '3 Bed / 2.5 Bath', icon: 'home', section: 'Larger', hasSeasons: true, defaultFields: { avgSF: 1300, count: 0 } },
      { id: '3br_3ba', name: '3 Bed / 3 Bath', icon: 'home', section: 'Larger', hasSeasons: true, defaultFields: { avgSF: 1400, count: 0 } },
      { id: '4br_2ba', name: '4 Bed / 2 Bath', icon: 'home', section: 'Large', hasSeasons: true, defaultFields: { avgSF: 1600, count: 0 } },
      { id: '4br_2half', name: '4 Bed / 2.5 Bath', icon: 'home', section: 'Large', hasSeasons: true, defaultFields: { avgSF: 1700, count: 0 } },
      { id: '4br_3half', name: '4 Bed / 3.5 Bath', icon: 'home', section: 'Large', hasSeasons: true, defaultFields: { avgSF: 1900, count: 0 } },
      { id: '4br_3ba', name: '4 Bed / 3 Bath', icon: 'home', section: 'Large', hasSeasons: true, defaultFields: { avgSF: 1800, count: 0 } },
      { id: '5br_plus', name: '5+ Bed', icon: 'home', section: 'Large', hasSeasons: true, defaultFields: { avgSF: 2200, count: 0 } },
      { id: 'custom', name: 'Custom Layout', icon: 'edit', section: 'Custom', hasSeasons: true, defaultFields: { avgSF: 0, count: 0 } },
    ],
  },
  profitCenters: {
    tabLabel: 'Revenue Streams',
    showTab: false,   // STR revenue is modeled inline
    departments: [],
  },
  inputSections: [
    { id: 'general', label: 'General Assumptions', icon: 'settings', fields: [
      { id: 'purchasePrice', label: 'Purchase Price', type: 'currency', width: 'half' },
      { id: 'closingDate', label: 'Closing Date', type: 'text', width: 'half' },
      { id: 'holdPeriod', label: 'Hold Period (Years)', type: 'integer', width: 'half', defaultValue: 5 },
    ]},
    { id: 'revenue', label: 'Revenue Assumptions', icon: 'dollar-sign', fields: [
      { id: 'avgNightlyRate', label: 'Avg Nightly Rate', type: 'currency', width: 'half' },
      { id: 'occupancyPercent', label: 'Occupancy %', type: 'percent', width: 'half', defaultValue: 65 },
      { id: 'cleaningFee', label: 'Cleaning Fee', type: 'currency', width: 'half' },
      { id: 'avgStayLength', label: 'Avg Stay (Nights)', type: 'number', width: 'half', defaultValue: 3.5 },
      { id: 'petFee', label: 'Pet Fee', type: 'currency', width: 'half' },
      { id: 'extraGuestFee', label: 'Extra Guest Fee', type: 'currency', width: 'half' },
    ]},
    { id: 'platform', label: 'Platform & Fees', icon: 'globe', fields: [
      { id: 'platformFeePercent', label: 'Platform Fee %', type: 'percent', width: 'half', defaultValue: 3, tooltip: 'Airbnb/VRBO host fee' },
      { id: 'paymentProcessingPercent', label: 'Payment Processing %', type: 'percent', width: 'half', defaultValue: 3 },
      { id: 'pmFeePercent', label: 'Property Manager Fee %', type: 'percent', width: 'half', defaultValue: 0 },
      { id: 'directBookingPercent', label: 'Direct Booking %', type: 'percent', width: 'half', defaultValue: 10, tooltip: 'Percentage of bookings not through platforms' },
    ]},
    { id: 'expenses', label: 'Operating Expenses', icon: 'receipt', fields: [
      { id: 'cleaningCostPerTurn', label: 'Cleaning Cost / Turn', type: 'currency', width: 'half' },
      { id: 'linensPerMonth', label: 'Linens & Supplies / Mo', type: 'currency', width: 'half' },
      { id: 'utilitiesPerMonth', label: 'Utilities / Mo', type: 'currency', width: 'half' },
      { id: 'wifiCablePerMonth', label: 'WiFi & Cable / Mo', type: 'currency', width: 'half' },
      { id: 'lawnCarPerMonth', label: 'Lawn / Pool / Mo', type: 'currency', width: 'half' },
      { id: 'softwarePerMonth', label: 'PMS & Channel Mgr / Mo', type: 'currency', width: 'half' },
      { id: 'insuranceAnnual', label: 'Insurance / Year', type: 'currency', width: 'half' },
      { id: 'repairsMaintAnnual', label: 'Repairs & Maint / Year', type: 'currency', width: 'half' },
      { id: 'capexReservePercent', label: 'CapEx Reserve %', type: 'percent', width: 'half', defaultValue: 5 },
    ]},
  ],
  growthCategories: [
    { id: 'nightly_rate', label: 'Nightly Rate Growth', icon: 'trending-up', description: 'ADR / nightly rate increases', defaultRate: 3.0 },
    { id: 'occupancy_improvement', label: 'Occupancy Improvement', icon: 'bar-chart', description: 'Year-over-year occupancy gain', defaultRate: 1.0 },
    { id: 'cleaning_fees', label: 'Cleaning Fee Growth', icon: 'home', description: 'Per-turn cleaning cost increases', defaultRate: 2.0 },
    { id: 'operating_expenses', label: 'Operating Expense Growth', icon: 'arrow-up', description: 'Utilities, supplies, maintenance', defaultRate: 2.5 },
    { id: 'insurance', label: 'Insurance Growth', icon: 'shield', description: 'Property insurance premium increases', defaultRate: 5.0 },
    { id: 'property_tax', label: 'Property Tax Growth', icon: 'building', description: 'Annual property tax increases', defaultRate: 2.0 },
  ],
  kpis: [
    { id: 'purchasePrice', label: 'Purchase Price', field: 'purchasePrice', format: 'currency', icon: 'dollar-sign' },
    { id: 'grm', label: 'GRM', field: 'grm', format: 'multiple', icon: 'x' },
    { id: 'avgNightlyRate', label: 'Avg Nightly Rate', field: 'avgNightlyRate', format: 'currency', icon: 'dollar-sign' },
    { id: 'occupancy', label: 'Occupancy', field: 'occupancyPercent', format: 'percent', icon: 'bar-chart' },
    { id: 'noi', label: 'NOI', field: 'ebitda', format: 'currency', icon: 'trending-up' },
  ],
  tabs: { storageLeases: true, commercialLeases: false, profitCenters: false },
};


// ═══════════════════════════════════════════════════════════════
// Retail Config
// ═══════════════════════════════════════════════════════════════

const RETAIL_CONFIG: AssetClassModelConfig = {
  id: 'retail',
  label: 'Retail / Shopping Center',
  terms: {
    unit: 'suite', unitPlural: 'suites',
    property: 'property', propertyPlural: 'properties',
    rentRoll: 'Tenant Rent Roll', occupancy: 'Occupancy',
    noi: 'NOI', pricePerUnit: '$/SF', totalUnitsLabel: 'Total GLA',
  },
  valuationMetric: 'cap_rate', valuationLabel: 'Cap Rate',
  hasSeasonal: false,
  seasonConfig: { type: 'none' },
  unitMix: { tabLabel: 'Tenant Spaces', tabIcon: 'store', showTab: false, countColumnLabel: '', rateColumnLabel: '', showSF: false, types: [] },
  profitCenters: {
    tabLabel: 'Revenue Streams',
    showTab: false,  // Revenue handled via commercial leases
    departments: [],
  },
  inputSections: [
    { id: 'general', label: 'General Assumptions', icon: 'settings', fields: [
      { id: 'purchasePrice', label: 'Purchase Price', type: 'currency', width: 'half' },
      { id: 'closingDate', label: 'Closing Date', type: 'text', width: 'half' },
      { id: 'holdPeriod', label: 'Hold Period (Years)', type: 'integer', width: 'half', defaultValue: 5 },
      { id: 'managementFeePercent', label: 'Management Fee %', type: 'percent', width: 'half', defaultValue: 5 },
    ]},
    { id: 'lease_structure', label: 'Lease Structure', icon: 'file-text', fields: [
      { id: 'leaseType', label: 'Predominant Lease Type', type: 'select', width: 'half',
        options: [
          { value: 'nnn', label: 'NNN (Triple Net)' },
          { value: 'modified_gross', label: 'Modified Gross' },
          { value: 'gross', label: 'Full-Service Gross' },
        ]},
      { id: 'economicVacancy', label: 'Economic Vacancy %', type: 'percent', width: 'half', defaultValue: 5 },
      { id: 'camPerSF', label: 'CAM / SF', type: 'currency', width: 'half' },
      { id: 'tiAllowancePerSF', label: 'TI Allowance / SF (new)', type: 'currency', width: 'half' },
      { id: 'lcPercentNewLease', label: 'LC % (New Lease)', type: 'percent', width: 'half', defaultValue: 6 },
      { id: 'lcPercentRenewal', label: 'LC % (Renewal)', type: 'percent', width: 'half', defaultValue: 3 },
    ]},
  ],
  growthCategories: [
    { id: 'base_rent', label: 'Base Rent Growth', icon: 'trending-up', description: 'Annual contractual escalations', defaultRate: 3.0 },
    { id: 'cam_recovery', label: 'CAM Recovery Growth', icon: 'dollar-sign', description: 'Common area cost pass-throughs', defaultRate: 2.5 },
    { id: 'operating_expenses', label: 'Operating Expense Growth', icon: 'arrow-up', description: 'Controllable OpEx', defaultRate: 2.5 },
    { id: 'insurance', label: 'Insurance Growth', icon: 'shield', description: 'Property insurance', defaultRate: 5.0 },
    { id: 'property_tax', label: 'Property Tax Growth', icon: 'building', description: 'Tax assessment', defaultRate: 2.0 },
  ],
  kpis: [
    { id: 'purchasePrice', label: 'Purchase Price', field: 'purchasePrice', format: 'currency', icon: 'dollar-sign' },
    { id: 'capRate', label: 'Cap Rate', field: 'year1CapRate', format: 'percent', icon: 'percent' },
    { id: 'totalSF', label: 'Total GLA', field: 'totalStorageUnits', format: 'number', icon: 'ruler' },
    { id: 'noi', label: 'NOI', field: 'ebitda', format: 'currency', icon: 'trending-up' },
    { id: 'pricePerSF', label: '$/SF', field: 'pricePerUnit', format: 'currency', icon: 'dollar-sign' },
  ],
  tabs: { storageLeases: false, commercialLeases: true, profitCenters: false },
};


// ═══════════════════════════════════════════════════════════════
// Self-Storage Config
// ═══════════════════════════════════════════════════════════════

const SELF_STORAGE_CONFIG: AssetClassModelConfig = {
  id: 'self_storage',
  label: 'Self-Storage',
  terms: {
    unit: 'unit', unitPlural: 'units',
    property: 'facility', propertyPlural: 'facilities',
    rentRoll: 'Unit Rent Roll', occupancy: 'Occupancy',
    noi: 'NOI', pricePerUnit: '$/SF', totalUnitsLabel: 'Total Units',
  },
  valuationMetric: 'cap_rate', valuationLabel: 'Cap Rate',
  hasSeasonal: true,
  seasonConfig: {
    type: 'str', // Similar seasonal dynamics
    defaultInSeasonMonths: [4, 5, 6, 7, 8, 9],
    seasonLabel: 'Peak Season',
    offSeasonLabel: 'Off Season',
  },
  unitMix: {
    tabLabel: 'Unit Sizes',
    tabIcon: 'warehouse',
    showTab: true,
    countColumnLabel: 'Units',
    rateColumnLabel: 'Rent / Mo',
    rateType: 'monthly',
    sfColumnLabel: 'Unit SF',
    showSF: true,
    types: [
      { id: '5x5_climate', name: '5x5 Climate', icon: 'container', section: 'Climate-Controlled', hasSeasons: false, defaultFields: { avgSF: 25 } },
      { id: '5x10_climate', name: '5x10 Climate', icon: 'container', section: 'Climate-Controlled', hasSeasons: false, defaultFields: { avgSF: 50 } },
      { id: '10x10_climate', name: '10x10 Climate', icon: 'container', section: 'Climate-Controlled', hasSeasons: false, defaultFields: { avgSF: 100 } },
      { id: '10x15_climate', name: '10x15 Climate', icon: 'container', section: 'Climate-Controlled', hasSeasons: false, defaultFields: { avgSF: 150 } },
      { id: '10x20_climate', name: '10x20 Climate', icon: 'container', section: 'Climate-Controlled', hasSeasons: false, defaultFields: { avgSF: 200 } },
      { id: '5x10_standard', name: '5x10 Standard', icon: 'warehouse', section: 'Non-Climate', hasSeasons: false, defaultFields: { avgSF: 50 } },
      { id: '10x10_standard', name: '10x10 Standard', icon: 'warehouse', section: 'Non-Climate', hasSeasons: false, defaultFields: { avgSF: 100 } },
      { id: '10x15_standard', name: '10x15 Standard', icon: 'warehouse', section: 'Non-Climate', hasSeasons: false, defaultFields: { avgSF: 150 } },
      { id: '10x20_standard', name: '10x20 Standard', icon: 'warehouse', section: 'Non-Climate', hasSeasons: false, defaultFields: { avgSF: 200 } },
      { id: '10x30_standard', name: '10x30 Standard', icon: 'warehouse', section: 'Non-Climate', hasSeasons: false, defaultFields: { avgSF: 300 } },
      { id: 'rv_vehicle', name: 'RV / Vehicle', icon: 'car', section: 'Outdoor', hasSeasons: false, defaultFields: { avgSF: 250 } },
    ],
  },
  profitCenters: {
    tabLabel: 'Ancillary Revenue',
    showTab: true,
    departments: [
      { id: 'tenant_insurance', name: 'Tenant Insurance', icon: 'shield', category: 'ancillary', description: 'Protection plan commissions',
        hasRevenue: true, hasCOGS: false, hasDirectLabor: false, revenueLines: ['Insurance Commissions'] },
      { id: 'merchandise', name: 'Merchandise', icon: 'store', category: 'ancillary', description: 'Boxes, locks, packing supplies',
        hasRevenue: true, hasCOGS: true, hasDirectLabor: false,
        revenueLines: ['Boxes & Packing', 'Locks', 'Other Supplies'], cogsLines: ['Merchandise COGS'] },
      { id: 'truck_rental', name: 'Truck Rental', icon: 'car', category: 'ancillary', description: 'Moving truck commissions',
        hasRevenue: true, hasCOGS: false, hasDirectLabor: false, revenueLines: ['Truck Rental Commissions'] },
      { id: 'late_fees', name: 'Late Fees & Lien', icon: 'alert-circle', category: 'ancillary', description: 'Late fees and auction revenue',
        hasRevenue: true, hasCOGS: false, hasDirectLabor: false, revenueLines: ['Late Fees', 'Lien/Auction Revenue'] },
    ],
  },
  inputSections: [
    { id: 'general', label: 'General Assumptions', icon: 'settings', fields: [
      { id: 'purchasePrice', label: 'Purchase Price', type: 'currency', width: 'half' },
      { id: 'closingDate', label: 'Closing Date', type: 'text', width: 'half' },
      { id: 'holdPeriod', label: 'Hold Period (Years)', type: 'integer', width: 'half', defaultValue: 5 },
      { id: 'managementFeePercent', label: 'Management Fee %', type: 'percent', width: 'half', defaultValue: 6 },
    ]},
    { id: 'occupancy', label: 'Occupancy Assumptions', icon: 'bar-chart', fields: [
      { id: 'physicalOccupancy', label: 'Physical Occupancy %', type: 'percent', width: 'half', defaultValue: 88 },
      { id: 'economicOccupancy', label: 'Economic Occupancy %', type: 'percent', width: 'half', defaultValue: 85 },
      { id: 'concessionPercent', label: 'Concession / Discount %', type: 'percent', width: 'half', defaultValue: 5 },
    ]},
  ],
  growthCategories: [
    { id: 'street_rates', label: 'Street Rate Growth', icon: 'trending-up', description: 'New move-in rate increases', defaultRate: 4.0 },
    { id: 'existing_tenant', label: 'Existing Tenant Increases', icon: 'dollar-sign', description: 'ECRI rate bumps', defaultRate: 8.0 },
    { id: 'ancillary_revenue', label: 'Ancillary Revenue Growth', icon: 'layers', description: 'Insurance, merchandise, truck', defaultRate: 2.0 },
    { id: 'operating_expenses', label: 'Operating Expense Growth', icon: 'arrow-up', description: 'Controllable OpEx', defaultRate: 2.5 },
    { id: 'payroll', label: 'Payroll Growth', icon: 'users', description: 'Site manager and staff', defaultRate: 3.0 },
    { id: 'insurance', label: 'Insurance Growth', icon: 'shield', description: 'Property insurance', defaultRate: 5.0 },
    { id: 'property_tax', label: 'Property Tax Growth', icon: 'building', description: 'Tax assessments', defaultRate: 2.0 },
  ],
  kpis: [
    { id: 'purchasePrice', label: 'Purchase Price', field: 'purchasePrice', format: 'currency', icon: 'dollar-sign' },
    { id: 'capRate', label: 'Cap Rate', field: 'year1CapRate', format: 'percent', icon: 'percent' },
    { id: 'totalUnits', label: 'Total Units', field: 'totalStorageUnits', format: 'number', icon: 'warehouse' },
    { id: 'noi', label: 'NOI', field: 'ebitda', format: 'currency', icon: 'trending-up' },
    { id: 'revPerSF', label: 'Rev / SF', field: 'revPerSF', format: 'currency', icon: 'dollar-sign' },
  ],
  tabs: { storageLeases: true, commercialLeases: false, profitCenters: true },
};


// ═══════════════════════════════════════════════════════════════
// Office Config (Class A/B/C Office Buildings)
// ═══════════════════════════════════════════════════════════════

const OFFICE_CONFIG: AssetClassModelConfig = {
  id: 'office',
  label: 'Office',
  terms: {
    unit: 'suite', unitPlural: 'suites',
    property: 'building', propertyPlural: 'buildings',
    rentRoll: 'Tenant Rent Roll', occupancy: 'Occupancy',
    noi: 'NOI', pricePerUnit: '$/RSF', totalUnitsLabel: 'Total RSF',
  },
  valuationMetric: 'cap_rate',
  valuationLabel: 'Cap Rate',
  hasSeasonal: false,
  seasonConfig: { type: 'none' },
  unitMix: {
    tabLabel: 'Tenant Suites',
    tabIcon: 'building',
    showTab: false,
    countColumnLabel: 'Suites',
    rateColumnLabel: 'Rent/RSF',
    rateType: 'monthly',
    showSF: true,
    sfColumnLabel: 'RSF',
    types: [],
  },
  profitCenters: {
    tabLabel: 'Ancillary Revenue',
    showTab: true,
    departments: [
      {
        id: 'parking',
        name: 'Parking',
        icon: 'car',
        category: 'core',
        description: 'Structured and surface parking revenue including reserved, unreserved, and transient parking',
        hasRevenue: true,
        hasCOGS: false,
        hasDirectLabor: true,
        revenueLines: ['Reserved Parking', 'Unreserved Parking', 'Transient/Hourly Parking', 'EV Charging Fees'],
        expenseLines: ['Parking Attendant Labor', 'Parking Equipment Maintenance', 'Parking Lot Sweeping & Striping'],
      },
      {
        id: 'storage',
        name: 'Storage',
        icon: 'warehouse',
        category: 'ancillary',
        description: 'Tenant storage space in basement or auxiliary areas billed monthly',
        hasRevenue: true,
        hasCOGS: false,
        hasDirectLabor: false,
        revenueLines: ['Tenant Storage Rentals', 'Record Storage'],
      },
      {
        id: 'conference_events',
        name: 'Conference & Event Space',
        icon: 'presentation',
        category: 'ancillary',
        description: 'Shared conference rooms, event spaces, and A/V equipment rental available to tenants and outside parties',
        hasRevenue: true,
        hasCOGS: false,
        hasDirectLabor: true,
        revenueLines: ['Conference Room Rental', 'Event Space Rental', 'A/V Equipment Fees', 'Catering Coordination Fees'],
        expenseLines: ['Event Staff Labor', 'A/V Equipment Maintenance', 'Event Supplies'],
      },
      {
        id: 'amenity_services',
        name: 'Amenity Services',
        icon: 'coffee',
        category: 'ancillary',
        description: 'Fitness center, shared lounge, tenant concierge, and building app services',
        hasRevenue: true,
        hasCOGS: false,
        hasDirectLabor: true,
        revenueLines: ['Fitness Center Fees', 'Tenant Lounge Revenue', 'Concierge Service Fees', 'Building App Subscription'],
        expenseLines: ['Amenity Staff Labor', 'Fitness Equipment Maintenance', 'Lounge Supplies'],
      },
    ],
  },
  inputSections: [
    {
      id: 'general',
      label: 'General Assumptions',
      icon: 'settings',
      fields: [
        { id: 'purchasePrice', label: 'Purchase Price', type: 'currency', width: 'half' },
        { id: 'closingDate', label: 'Closing Date', type: 'text', width: 'half' },
        { id: 'holdPeriod', label: 'Hold Period (Years)', type: 'integer', width: 'half', defaultValue: 5 },
        { id: 'managementFeePercent', label: 'Management Fee %', type: 'percent', width: 'half', defaultValue: 4, tooltip: 'Typical institutional office management fee' },
        { id: 'totalRSF', label: 'Total Rentable SF', type: 'integer', width: 'half', tooltip: 'Total rentable square footage (excludes common areas)' },
        { id: 'buildingClass', label: 'Building Class', type: 'select', width: 'half',
          options: [
            { value: 'class_a', label: 'Class A' },
            { value: 'class_b', label: 'Class B' },
            { value: 'class_c', label: 'Class C' },
          ]},
        { id: 'numberOfFloors', label: 'Number of Floors', type: 'integer', width: 'half' },
        { id: 'yearBuilt', label: 'Year Built', type: 'integer', width: 'half' },
        { id: 'yearRenovated', label: 'Year Renovated', type: 'integer', width: 'half' },
        { id: 'parkingRatio', label: 'Parking Ratio (spaces/1,000 SF)', type: 'number', width: 'half', defaultValue: 3.0, tooltip: 'Parking spaces per 1,000 RSF' },
      ],
    },
    {
      id: 'lease_structure',
      label: 'Lease Structure',
      icon: 'file-text',
      fields: [
        { id: 'leaseType', label: 'Predominant Lease Type', type: 'select', width: 'half',
          options: [
            { value: 'fsg', label: 'Full-Service Gross (FSG)' },
            { value: 'modified_gross', label: 'Modified Gross' },
            { value: 'nnn', label: 'NNN (Triple Net)' },
          ]},
        { id: 'avgLeaseTermYears', label: 'Avg Lease Term (Years)', type: 'number', width: 'half', defaultValue: 5, tooltip: 'Weighted average remaining lease term for existing tenants' },
        { id: 'tiAllowancePerSF', label: 'TI Allowance / RSF (New)', type: 'currency', width: 'half', tooltip: 'Tenant improvement allowance for new leases; Class A typically $40-80/SF' },
        { id: 'tiAllowanceRenewalPerSF', label: 'TI Allowance / RSF (Renewal)', type: 'currency', width: 'half', tooltip: 'TI allowance for lease renewals; typically 50-60% of new lease TI' },
        { id: 'lcPercentNewLease', label: 'Leasing Commission % (New)', type: 'percent', width: 'half', defaultValue: 6, tooltip: 'Total LC as % of aggregate lease value for new leases' },
        { id: 'lcPercentRenewal', label: 'Leasing Commission % (Renewal)', type: 'percent', width: 'half', defaultValue: 3, tooltip: 'Total LC as % of aggregate lease value for renewals' },
        { id: 'freeRentMonthsNew', label: 'Free Rent (Months, New)', type: 'number', width: 'half', defaultValue: 1, tooltip: 'Months of free rent for new leases; market-dependent, typically 1-3 months per year of term' },
        { id: 'freeRentMonthsRenewal', label: 'Free Rent (Months, Renewal)', type: 'number', width: 'half', defaultValue: 0 },
        { id: 'annualEscalation', label: 'Annual Rent Escalation %', type: 'percent', width: 'half', defaultValue: 3, tooltip: 'Contractual annual rent bumps within lease term' },
        { id: 'renewalProbability', label: 'Renewal Probability %', type: 'percent', width: 'half', defaultValue: 65, tooltip: 'Probability existing tenants renew at expiration' },
        { id: 'downtime', label: 'Avg Downtime Between Tenants (Months)', type: 'number', width: 'half', defaultValue: 6, tooltip: 'Average months vacant between lease expiration and new tenant commencement' },
      ],
    },
    {
      id: 'operating',
      label: 'Operating Assumptions',
      icon: 'receipt',
      fields: [
        { id: 'camPerSF', label: 'CAM / RSF', type: 'currency', width: 'half', tooltip: 'Common area maintenance charge per rentable SF' },
        { id: 'insurancePerSF', label: 'Insurance / RSF', type: 'currency', width: 'half', tooltip: 'Property insurance cost per RSF' },
        { id: 'propertyTaxPerSF', label: 'Property Tax / RSF', type: 'currency', width: 'half', tooltip: 'Real estate taxes per RSF' },
        { id: 'utilitiesPerSF', label: 'Utilities / RSF', type: 'currency', width: 'half', tooltip: 'Base building utility costs per RSF (electric, gas, water)' },
        { id: 'janitorialPerSF', label: 'Janitorial / RSF', type: 'currency', width: 'half', tooltip: 'Cleaning and janitorial services per RSF' },
        { id: 'repairsPerSF', label: 'R&M / RSF', type: 'currency', width: 'half', tooltip: 'Repairs and maintenance per RSF' },
        { id: 'walt', label: 'WALT (Years)', type: 'number', width: 'half', tooltip: 'Weighted Average Lease Term — SF-weighted remaining term' },
        { id: 'avgOccupancy', label: 'Avg Occupancy %', type: 'percent', width: 'half', defaultValue: 90, tooltip: 'Stabilized occupancy rate; Class A suburban typically 85-92%' },
        { id: 'expenseStopPerSF', label: 'Expense Stop / RSF', type: 'currency', width: 'half', tooltip: 'Base year expense stop for FSG leases — landlord pays up to this amount' },
        { id: 'capexReservePerSF', label: 'CapEx Reserve / RSF', type: 'currency', width: 'half', tooltip: 'Annual capital expenditure reserve per RSF; typically $1.00-2.00/RSF' },
      ],
    },
  ],
  growthCategories: [
    { id: 'base_rent', label: 'Base Rent Growth', icon: 'trending-up', description: 'Market rental rate growth for new and renewal leases; reflects supply/demand dynamics and Class A vs B spreads', defaultRate: 3.0 },
    { id: 'expense_recovery', label: 'Expense Recovery Growth', icon: 'dollar-sign', description: 'Growth in tenant expense reimbursements (CAM, tax, insurance pass-throughs); typically tracks OpEx growth', defaultRate: 2.5 },
    { id: 'parking_revenue', label: 'Parking Revenue Growth', icon: 'car', description: 'Annual parking rate increases for reserved, unreserved, and transient spaces', defaultRate: 2.0 },
    { id: 'operating_expenses', label: 'Operating Expense Growth', icon: 'arrow-up', description: 'Controllable operating expenses including janitorial, R&M, management, and admin', defaultRate: 2.5 },
    { id: 'utilities', label: 'Utilities Growth', icon: 'zap', description: 'Electric, gas, and water cost inflation; often outpaces general CPI', defaultRate: 3.0 },
    { id: 'payroll', label: 'Payroll & Benefits Growth', icon: 'users', description: 'Building staff wages, benefits, and contract labor escalation', defaultRate: 3.0 },
    { id: 'insurance', label: 'Insurance Growth', icon: 'shield', description: 'Property and liability insurance premium increases; coastal/CAT-exposed assets trend higher', defaultRate: 5.0 },
    { id: 'property_tax', label: 'Property Tax Growth', icon: 'building', description: 'Real estate tax assessment growth; watch for reassessment triggers on acquisition', defaultRate: 2.0 },
  ],
  kpis: [
    { id: 'purchasePrice', label: 'Purchase Price', field: 'purchasePrice', format: 'currency', icon: 'dollar-sign' },
    { id: 'capRate', label: 'Cap Rate', field: 'year1CapRate', format: 'percent', icon: 'percent' },
    { id: 'pricePerRSF', label: '$/RSF', field: 'pricePerUnit', format: 'currency', icon: 'ruler' },
    { id: 'noi', label: 'NOI', field: 'ebitda', format: 'currency', icon: 'trending-up' },
    { id: 'walt', label: 'WALT', field: 'walt', format: 'number', icon: 'clock' },
    { id: 'occupancy', label: 'Occupancy', field: 'avgOccupancy', format: 'percent', icon: 'bar-chart' },
  ],
  tabs: { storageLeases: false, commercialLeases: true, profitCenters: true },
};


// ═══════════════════════════════════════════════════════════════
// Industrial Config (Warehouse, Distribution, Flex, Manufacturing)
// ═══════════════════════════════════════════════════════════════

const INDUSTRIAL_CONFIG: AssetClassModelConfig = {
  id: 'industrial',
  label: 'Industrial',
  terms: {
    unit: 'bay', unitPlural: 'bays',
    property: 'building', propertyPlural: 'buildings',
    rentRoll: 'Tenant Rent Roll', occupancy: 'Occupancy',
    noi: 'NOI', pricePerUnit: '$/SF', totalUnitsLabel: 'Total SF',
  },
  valuationMetric: 'cap_rate',
  valuationLabel: 'Cap Rate',
  hasSeasonal: false,
  seasonConfig: { type: 'none' },
  unitMix: {
    tabLabel: 'Bay Configuration',
    tabIcon: 'warehouse',
    showTab: false,
    countColumnLabel: 'Bays',
    rateColumnLabel: 'Rent/SF',
    rateType: 'monthly',
    showSF: true,
    sfColumnLabel: 'Bay SF',
    types: [],
  },
  profitCenters: {
    tabLabel: 'Ancillary Revenue',
    showTab: true,
    departments: [
      {
        id: 'truck_parking',
        name: 'Truck & Trailer Parking',
        icon: 'truck',
        category: 'ancillary',
        description: 'Outdoor truck and trailer parking stalls leased monthly or annually to tenants and third parties',
        hasRevenue: true,
        hasCOGS: false,
        hasDirectLabor: false,
        revenueLines: ['Truck Parking Stalls', 'Trailer Drop Lot', 'Overnight Staging Fees'],
      },
      {
        id: 'outside_storage',
        name: 'Outside Storage',
        icon: 'container',
        category: 'ancillary',
        description: 'Fenced yard space leased for container, equipment, or materials storage',
        hasRevenue: true,
        hasCOGS: false,
        hasDirectLabor: false,
        revenueLines: ['Container Storage', 'Equipment/Materials Yard Rent', 'Laydown Area Rent'],
      },
      {
        id: 'rail_siding',
        name: 'Rail Siding',
        icon: 'train',
        category: 'specialty',
        description: 'Rail-served siding and spur track access charges for tenants with freight rail needs',
        hasRevenue: true,
        hasCOGS: false,
        hasDirectLabor: false,
        revenueLines: ['Rail Siding Access Fee', 'Railcar Switching Charges', 'Demurrage Revenue'],
      },
    ],
  },
  inputSections: [
    {
      id: 'general',
      label: 'General Assumptions',
      icon: 'settings',
      fields: [
        { id: 'purchasePrice', label: 'Purchase Price', type: 'currency', width: 'half' },
        { id: 'closingDate', label: 'Closing Date', type: 'text', width: 'half' },
        { id: 'holdPeriod', label: 'Hold Period (Years)', type: 'integer', width: 'half', defaultValue: 5 },
        { id: 'managementFeePercent', label: 'Management Fee %', type: 'percent', width: 'half', defaultValue: 3, tooltip: 'Industrial management fees typically 2-4% given NNN lease structures' },
      ],
    },
    {
      id: 'property_details',
      label: 'Property Details',
      icon: 'warehouse',
      fields: [
        { id: 'totalSF', label: 'Total Building SF', type: 'integer', width: 'half', tooltip: 'Total gross building square footage' },
        { id: 'officePercent', label: 'Office / Mezzanine %', type: 'percent', width: 'half', defaultValue: 10, tooltip: 'Percentage of total SF finished as office or mezzanine space' },
        { id: 'clearHeightFt', label: 'Clear Height (ft)', type: 'number', width: 'half', tooltip: 'Minimum clear ceiling height to bottom of structural member; 32+ ft is modern Class A' },
        { id: 'dockDoors', label: 'Dock-High Doors', type: 'integer', width: 'half', tooltip: 'Number of dock-high loading doors (typically one per 5,000-10,000 SF for distribution)' },
        { id: 'driveInDoors', label: 'Drive-In / Grade-Level Doors', type: 'integer', width: 'half', tooltip: 'Number of at-grade drive-in doors' },
        { id: 'yardAreaSF', label: 'Yard / Outside Storage Area (SF)', type: 'integer', width: 'half', tooltip: 'Fenced yard or laydown area in square feet' },
        { id: 'railServed', label: 'Rail Served', type: 'select', width: 'half',
          options: [
            { value: 'yes', label: 'Yes' },
            { value: 'no', label: 'No' },
            { value: 'nearby', label: 'Nearby (within 1 mile)' },
          ]},
        { id: 'buildingType', label: 'Building Type', type: 'select', width: 'half',
          options: [
            { value: 'bulk_distribution', label: 'Bulk Distribution' },
            { value: 'last_mile', label: 'Last Mile / Delivery Station' },
            { value: 'light_industrial', label: 'Light Industrial' },
            { value: 'flex', label: 'Flex / R&D' },
            { value: 'manufacturing', label: 'Manufacturing' },
            { value: 'cold_storage', label: 'Cold / Freezer Storage' },
          ]},
        { id: 'yearBuilt', label: 'Year Built', type: 'integer', width: 'half' },
        { id: 'columnSpacing', label: 'Column Spacing (ft)', type: 'text', width: 'half', placeholder: 'e.g. 50x50 or 60x54', tooltip: 'Bay depth x bay width in feet; wider = better for racking and maneuverability' },
      ],
    },
    {
      id: 'lease_structure',
      label: 'Lease Structure',
      icon: 'file-text',
      fields: [
        { id: 'leaseType', label: 'Predominant Lease Type', type: 'select', width: 'half',
          options: [
            { value: 'nnn', label: 'NNN (Triple Net)' },
            { value: 'modified_gross', label: 'Modified Gross' },
            { value: 'absolute_net', label: 'Absolute Net (Bond Lease)' },
          ]},
        { id: 'avgLeaseTermYears', label: 'Avg Lease Term (Years)', type: 'number', width: 'half', defaultValue: 7, tooltip: 'Industrial tenants typically sign 5-10 year leases; credit tenants often 10-15 years' },
        { id: 'tiPerSF', label: 'TI Allowance / SF', type: 'currency', width: 'half', tooltip: 'Tenant improvement allowance; industrial typically $5-15/SF for warehouse, $25-50/SF for office finish' },
        { id: 'lcPercentNewLease', label: 'LC % (New Lease)', type: 'percent', width: 'half', defaultValue: 4, tooltip: 'Leasing commissions as % of aggregate lease value' },
        { id: 'lcPercentRenewal', label: 'LC % (Renewal)', type: 'percent', width: 'half', defaultValue: 2 },
        { id: 'freeRentMonths', label: 'Free Rent (Months)', type: 'number', width: 'half', defaultValue: 2, tooltip: 'Free rent period for new leases; typically 1-2 months per year of lease term' },
        { id: 'annualEscalation', label: 'Annual Escalation %', type: 'percent', width: 'half', defaultValue: 3, tooltip: 'Annual contractual rent bumps; market standard is 2.5-3.5% or CPI-based' },
        { id: 'renewalProbability', label: 'Renewal Probability %', type: 'percent', width: 'half', defaultValue: 75, tooltip: 'Industrial tenants have high renewal rates due to relocation costs' },
      ],
    },
    {
      id: 'operating',
      label: 'Operating Assumptions',
      icon: 'receipt',
      fields: [
        { id: 'camPerSF', label: 'CAM / SF', type: 'currency', width: 'half', tooltip: 'Common area maintenance costs per SF' },
        { id: 'insurancePerSF', label: 'Insurance / SF', type: 'currency', width: 'half' },
        { id: 'propertyTaxPerSF', label: 'Property Tax / SF', type: 'currency', width: 'half' },
        { id: 'avgOccupancy', label: 'Avg Occupancy %', type: 'percent', width: 'half', defaultValue: 95, tooltip: 'Stabilized occupancy; well-located industrial typically 95-98%' },
        { id: 'capexReservePerSF', label: 'CapEx Reserve / SF', type: 'currency', width: 'half', tooltip: 'Annual capital reserve; industrial typically $0.25-0.75/SF given NNN tenant responsibility' },
      ],
    },
  ],
  growthCategories: [
    { id: 'base_rent', label: 'Base Rent Growth', icon: 'trending-up', description: 'Market rental rate growth driven by e-commerce demand, supply constraints, and replacement cost growth', defaultRate: 3.0 },
    { id: 'cam_recovery', label: 'CAM Recovery Growth', icon: 'dollar-sign', description: 'NNN expense pass-through growth tracking actual operating cost increases', defaultRate: 2.5 },
    { id: 'ancillary_revenue', label: 'Ancillary Revenue Growth', icon: 'layers', description: 'Truck parking, outside storage, and rail siding revenue growth', defaultRate: 2.0 },
    { id: 'operating_expenses', label: 'Operating Expense Growth', icon: 'arrow-up', description: 'Landlord-responsible controllable expenses (lower burden under NNN structure)', defaultRate: 2.5 },
    { id: 'insurance', label: 'Insurance Growth', icon: 'shield', description: 'Property and environmental liability insurance premium escalation', defaultRate: 4.0 },
    { id: 'property_tax', label: 'Property Tax Growth', icon: 'building', description: 'Real estate tax assessment growth; acquisition may trigger reassessment', defaultRate: 2.0 },
  ],
  kpis: [
    { id: 'purchasePrice', label: 'Purchase Price', field: 'purchasePrice', format: 'currency', icon: 'dollar-sign' },
    { id: 'capRate', label: 'Cap Rate', field: 'year1CapRate', format: 'percent', icon: 'percent' },
    { id: 'pricePerSF', label: '$/SF', field: 'pricePerUnit', format: 'currency', icon: 'ruler' },
    { id: 'noi', label: 'NOI', field: 'ebitda', format: 'currency', icon: 'trending-up' },
    { id: 'clearHeight', label: 'Clear Height (ft)', field: 'clearHeightFt', format: 'number', icon: 'arrow-up' },
    { id: 'walt', label: 'WALT', field: 'walt', format: 'number', icon: 'clock' },
  ],
  tabs: { storageLeases: false, commercialLeases: true, profitCenters: true },
};


// ═══════════════════════════════════════════════════════════════
// Medical Office Config (MOBs, Ambulatory Surgery Centers)
// ═══════════════════════════════════════════════════════════════

const MEDICAL_OFFICE_CONFIG: AssetClassModelConfig = {
  id: 'medical_office',
  label: 'Medical Office',
  terms: {
    unit: 'suite', unitPlural: 'suites',
    property: 'building', propertyPlural: 'buildings',
    rentRoll: 'Tenant Rent Roll', occupancy: 'Occupancy',
    noi: 'NOI', pricePerUnit: '$/RSF', totalUnitsLabel: 'Total RSF',
  },
  valuationMetric: 'cap_rate',
  valuationLabel: 'Cap Rate',
  hasSeasonal: false,
  seasonConfig: { type: 'none' },
  unitMix: {
    tabLabel: 'Tenant Suites',
    tabIcon: 'heart',
    showTab: false,
    countColumnLabel: 'Suites',
    rateColumnLabel: 'Rent/RSF',
    rateType: 'monthly',
    showSF: true,
    sfColumnLabel: 'RSF',
    types: [],
  },
  profitCenters: {
    tabLabel: 'Ancillary Revenue',
    showTab: true,
    departments: [
      {
        id: 'parking',
        name: 'Parking',
        icon: 'car',
        category: 'core',
        description: 'Patient, visitor, and staff parking; MOBs require higher parking ratios (5-6 spaces/1,000 SF) vs general office',
        hasRevenue: true,
        hasCOGS: false,
        hasDirectLabor: true,
        revenueLines: ['Patient/Visitor Parking', 'Staff Reserved Parking', 'Valet Service Revenue'],
        expenseLines: ['Parking Attendant Labor', 'Lot Maintenance', 'Signage & Wayfinding'],
      },
      {
        id: 'pharmacy',
        name: 'On-Site Pharmacy',
        icon: 'pill',
        category: 'ancillary',
        description: 'On-site retail pharmacy lease or revenue share arrangement with national or independent pharmacy operator',
        hasRevenue: true,
        hasCOGS: false,
        hasDirectLabor: false,
        revenueLines: ['Pharmacy Lease Revenue', 'Pharmacy Revenue Share / Overage Rent'],
      },
      {
        id: 'lab_imaging',
        name: 'Lab & Imaging Revenue Share',
        icon: 'activity',
        category: 'specialty',
        description: 'Revenue participation from diagnostic imaging (MRI, CT, X-ray) and laboratory services co-located in the building',
        hasRevenue: true,
        hasCOGS: false,
        hasDirectLabor: false,
        revenueLines: ['Imaging Center Revenue Share', 'Lab Services Revenue Share', 'Infusion Center Revenue Share'],
      },
    ],
  },
  inputSections: [
    {
      id: 'general',
      label: 'General Assumptions',
      icon: 'settings',
      fields: [
        { id: 'purchasePrice', label: 'Purchase Price', type: 'currency', width: 'half' },
        { id: 'closingDate', label: 'Closing Date', type: 'text', width: 'half' },
        { id: 'holdPeriod', label: 'Hold Period (Years)', type: 'integer', width: 'half', defaultValue: 7, tooltip: 'MOBs often warrant longer holds due to sticky tenancy and stable cash flows' },
        { id: 'managementFeePercent', label: 'Management Fee %', type: 'percent', width: 'half', defaultValue: 4 },
        { id: 'totalRSF', label: 'Total Rentable SF', type: 'integer', width: 'half' },
        { id: 'yearBuilt', label: 'Year Built', type: 'integer', width: 'half' },
        { id: 'yearRenovated', label: 'Year Renovated', type: 'integer', width: 'half' },
        { id: 'numberOfFloors', label: 'Number of Floors', type: 'integer', width: 'half' },
        { id: 'proximityToHospital', label: 'Hospital Proximity', type: 'select', width: 'half',
          options: [
            { value: 'on_campus', label: 'On-Campus' },
            { value: 'adjacent', label: 'Adjacent / Campus-Affiliated' },
            { value: 'off_campus', label: 'Off-Campus (within 5 mi)' },
            { value: 'freestanding', label: 'Freestanding' },
          ],
          tooltip: 'On-campus MOBs command premium rents and lower vacancy' },
      ],
    },
    {
      id: 'tenant_profile',
      label: 'Tenant Profile',
      icon: 'users',
      fields: [
        { id: 'hospitalAffiliatedPercent', label: '% Hospital / Health System Affiliated', type: 'percent', width: 'half', defaultValue: 60, tooltip: 'Percentage of RSF leased to hospital-affiliated or health system tenants' },
        { id: 'avgCreditRating', label: 'Avg Tenant Credit Rating', type: 'select', width: 'half',
          options: [
            { value: 'aaa_aa', label: 'AAA / AA (Large Health System)' },
            { value: 'a_bbb', label: 'A / BBB (Regional Health System)' },
            { value: 'bb_below', label: 'BB or Below (Independent Practice)' },
            { value: 'mixed', label: 'Mixed Portfolio' },
          ],
          tooltip: 'Credit quality of tenant base; hospital-affiliated tenants often carry investment-grade parent guarantees' },
        { id: 'investmentGradePercent', label: '% Investment-Grade Tenants', type: 'percent', width: 'half', defaultValue: 45, tooltip: 'Percentage of revenue from investment-grade (BBB- or higher) rated tenants or guarantors' },
        { id: 'singleSpecialtyPercent', label: '% Single-Specialty Practice', type: 'percent', width: 'half', defaultValue: 30, tooltip: 'Percentage leased to single-specialty groups vs multi-specialty or health system clinics' },
        { id: 'topTenantConcentration', label: 'Largest Tenant % of Revenue', type: 'percent', width: 'half', tooltip: 'Revenue concentration in largest single tenant' },
      ],
    },
    {
      id: 'lease_structure',
      label: 'Lease Structure',
      icon: 'file-text',
      fields: [
        { id: 'leaseType', label: 'Predominant Lease Type', type: 'select', width: 'half',
          options: [
            { value: 'nnn', label: 'NNN (Triple Net)' },
            { value: 'fsg', label: 'Full-Service Gross (FSG)' },
            { value: 'modified_gross', label: 'Modified Gross' },
          ]},
        { id: 'avgLeaseTermYears', label: 'Avg Lease Term (Years)', type: 'number', width: 'half', defaultValue: 8, tooltip: 'MOB leases typically 7-12 years; health system master leases can be 15-20 years' },
        { id: 'tiAllowancePerSF', label: 'TI Allowance / RSF (New)', type: 'currency', width: 'half', tooltip: 'Medical TI typically $60-120/RSF due to plumbing, HVAC, electrical, and clinical buildout requirements' },
        { id: 'tiAllowanceRenewalPerSF', label: 'TI Allowance / RSF (Renewal)', type: 'currency', width: 'half' },
        { id: 'lcPercentNewLease', label: 'LC % (New Lease)', type: 'percent', width: 'half', defaultValue: 5 },
        { id: 'lcPercentRenewal', label: 'LC % (Renewal)', type: 'percent', width: 'half', defaultValue: 2.5 },
        { id: 'freeRentMonths', label: 'Free Rent (Months)', type: 'number', width: 'half', defaultValue: 2 },
        { id: 'annualEscalation', label: 'Annual Escalation %', type: 'percent', width: 'half', defaultValue: 3, tooltip: 'Contractual annual rent bumps; medical leases typically 2.5-3.5% fixed or CPI-based' },
        { id: 'renewalProbability', label: 'Renewal Probability %', type: 'percent', width: 'half', defaultValue: 85, tooltip: 'MOB tenants have very high renewal rates (80-90%) due to patient referral networks and specialized buildout' },
      ],
    },
    {
      id: 'operating',
      label: 'Operating Assumptions',
      icon: 'receipt',
      fields: [
        { id: 'camPerSF', label: 'CAM / RSF', type: 'currency', width: 'half', tooltip: 'Common area maintenance; MOBs run higher than general office due to enhanced cleaning and patient-area maintenance' },
        { id: 'janitorialPerSF', label: 'Janitorial / RSF', type: 'currency', width: 'half', tooltip: 'Medical-grade janitorial services including biohazard cleaning protocols' },
        { id: 'medicalWasteDisposal', label: 'Medical Waste Disposal / Year', type: 'currency', width: 'half', tooltip: 'Regulated medical waste disposal services; varies by tenant mix and procedure volume' },
        { id: 'hvacPremiumPerSF', label: 'HVAC Premium / RSF', type: 'currency', width: 'half', tooltip: 'Incremental HVAC costs for extended hours (medical offices often operate 10-12 hours/day) and specialized ventilation requirements' },
        { id: 'insurancePerSF', label: 'Insurance / RSF', type: 'currency', width: 'half' },
        { id: 'propertyTaxPerSF', label: 'Property Tax / RSF', type: 'currency', width: 'half' },
        { id: 'avgOccupancy', label: 'Avg Occupancy %', type: 'percent', width: 'half', defaultValue: 93, tooltip: 'MOBs typically achieve 91-96% occupancy due to healthcare demand stability' },
        { id: 'capexReservePerSF', label: 'CapEx Reserve / RSF', type: 'currency', width: 'half', tooltip: 'Higher than general office due to specialized building systems (medical gas, emergency power, elevators)' },
        { id: 'walt', label: 'WALT (Years)', type: 'number', width: 'half', tooltip: 'Weighted Average Lease Term — revenue-weighted remaining lease term' },
      ],
    },
  ],
  growthCategories: [
    { id: 'base_rent', label: 'Base Rent Growth', icon: 'trending-up', description: 'Medical office rent growth outpaces general office due to inelastic healthcare demand, specialized buildout, and limited new supply', defaultRate: 3.5 },
    { id: 'expense_recovery', label: 'Expense Recovery Growth', icon: 'dollar-sign', description: 'Tenant expense pass-through growth tracking actual operating cost increases under NNN or FSG structures', defaultRate: 3.0 },
    { id: 'ancillary_revenue', label: 'Ancillary Revenue Growth', icon: 'layers', description: 'Parking, pharmacy, and lab/imaging revenue share growth', defaultRate: 2.5 },
    { id: 'operating_expenses', label: 'Operating Expense Growth', icon: 'arrow-up', description: 'Controllable OpEx including enhanced janitorial, medical waste, and facility management', defaultRate: 3.0 },
    { id: 'insurance', label: 'Insurance Growth', icon: 'shield', description: 'Property insurance; MOBs may carry additional environmental or professional liability coverage', defaultRate: 5.0 },
    { id: 'property_tax', label: 'Property Tax Growth', icon: 'building', description: 'Real estate tax growth; some MOBs on hospital campuses may benefit from nonprofit landlord tax exemptions', defaultRate: 2.0 },
  ],
  kpis: [
    { id: 'purchasePrice', label: 'Purchase Price', field: 'purchasePrice', format: 'currency', icon: 'dollar-sign' },
    { id: 'capRate', label: 'Cap Rate', field: 'year1CapRate', format: 'percent', icon: 'percent' },
    { id: 'pricePerRSF', label: '$/RSF', field: 'pricePerUnit', format: 'currency', icon: 'ruler' },
    { id: 'noi', label: 'NOI', field: 'ebitda', format: 'currency', icon: 'trending-up' },
    { id: 'investmentGradePercent', label: '% Investment-Grade', field: 'investmentGradePercent', format: 'percent', icon: 'shield' },
    { id: 'walt', label: 'WALT', field: 'walt', format: 'number', icon: 'clock' },
  ],
  tabs: { storageLeases: false, commercialLeases: true, profitCenters: true },
};


// ═══════════════════════════════════════════════════════════════
// Mixed-Use Config (Retail + Residential + Office combinations)
// ═══════════════════════════════════════════════════════════════

const MIXED_USE_CONFIG: AssetClassModelConfig = {
  id: 'mixed_use',
  label: 'Mixed-Use',
  terms: {
    unit: 'unit', unitPlural: 'units',
    property: 'property', propertyPlural: 'properties',
    rentRoll: 'Unit & Tenant Mix', occupancy: 'Occupancy',
    noi: 'NOI', pricePerUnit: '$/SF', totalUnitsLabel: 'Total Units',
  },
  valuationMetric: 'cap_rate',
  valuationLabel: 'Cap Rate',
  hasSeasonal: false,
  seasonConfig: { type: 'none' },
  unitMix: {
    tabLabel: 'Unit & Tenant Mix',
    tabIcon: 'layers',
    showTab: true,
    countColumnLabel: 'Units / Suites',
    rateColumnLabel: 'Avg Rent/Mo',
    rateType: 'monthly',
    sfColumnLabel: 'Avg SF',
    showSF: true,
    types: [
      { id: 'res_studio', name: 'Studio', icon: 'home', section: 'Residential', hasSeasons: false, defaultFields: { avgSF: 500 } },
      { id: 'res_1br', name: '1 Bedroom', icon: 'home', section: 'Residential', hasSeasons: false, defaultFields: { avgSF: 700 } },
      { id: 'res_2br', name: '2 Bedroom', icon: 'home', section: 'Residential', hasSeasons: false, defaultFields: { avgSF: 1000 } },
      { id: 'res_3br', name: '3 Bedroom', icon: 'home', section: 'Residential', hasSeasons: false, defaultFields: { avgSF: 1300 } },
      { id: 'res_penthouse', name: 'Penthouse', icon: 'crown', section: 'Residential', hasSeasons: false, defaultFields: { avgSF: 1800 } },
      { id: 'comm_retail_inline', name: 'Retail – Inline', icon: 'store', section: 'Commercial', hasSeasons: false, defaultFields: { avgSF: 1500 } },
      { id: 'comm_retail_anchor', name: 'Retail – Anchor/Pad', icon: 'store', section: 'Commercial', hasSeasons: false, defaultFields: { avgSF: 5000 } },
      { id: 'comm_restaurant', name: 'Restaurant / F&B', icon: 'utensils', section: 'Commercial', hasSeasons: false, defaultFields: { avgSF: 2500 } },
      { id: 'comm_office', name: 'Office Suite', icon: 'building', section: 'Commercial', hasSeasons: false, defaultFields: { avgSF: 2000 } },
    ],
  },
  profitCenters: {
    tabLabel: 'Ancillary Revenue',
    showTab: true,
    departments: [
      {
        id: 'parking',
        name: 'Parking',
        icon: 'car',
        category: 'core',
        description: 'Structured or podium parking serving both residential and commercial components',
        hasRevenue: true,
        hasCOGS: false,
        hasDirectLabor: true,
        revenueLines: ['Residential Reserved Parking', 'Commercial Parking', 'Visitor/Transient Parking', 'EV Charging Revenue'],
        expenseLines: ['Parking Attendant Labor', 'Garage Maintenance', 'Parking Equipment/Technology'],
      },
      {
        id: 'common_area_events',
        name: 'Common Area & Events',
        icon: 'calendar',
        category: 'ancillary',
        description: 'Shared plaza, rooftop, courtyard, and event space revenue from programming and private events',
        hasRevenue: true,
        hasCOGS: false,
        hasDirectLabor: true,
        revenueLines: ['Event Space Rental', 'Farmers Market / Pop-Up Vendor Fees', 'Seasonal Programming Revenue', 'Plaza Advertising / Sponsorship'],
        expenseLines: ['Event Coordination Labor', 'Common Area Programming Costs', 'Seasonal Decor & Setup'],
      },
      {
        id: 'amenity_package',
        name: 'Amenity Package',
        icon: 'star',
        category: 'ancillary',
        description: 'Shared amenities across residential and commercial components including fitness, coworking, and concierge',
        hasRevenue: true,
        hasCOGS: false,
        hasDirectLabor: true,
        revenueLines: ['Fitness Center Fees', 'Coworking / Business Center Revenue', 'Concierge Service Fees', 'Package Locker Revenue', 'Pet Spa Revenue'],
        expenseLines: ['Amenity Staff Labor', 'Fitness Equipment Maintenance', 'Technology & Software'],
      },
    ],
  },
  inputSections: [
    {
      id: 'general',
      label: 'General Assumptions',
      icon: 'settings',
      fields: [
        { id: 'purchasePrice', label: 'Purchase Price', type: 'currency', width: 'half' },
        { id: 'closingDate', label: 'Closing Date', type: 'text', width: 'half' },
        { id: 'holdPeriod', label: 'Hold Period (Years)', type: 'integer', width: 'half', defaultValue: 7 },
        { id: 'managementFeePercent', label: 'Management Fee %', type: 'percent', width: 'half', defaultValue: 4, tooltip: 'Blended management fee across residential and commercial components' },
        { id: 'yearBuilt', label: 'Year Built', type: 'integer', width: 'half' },
        { id: 'totalBuildingSF', label: 'Total Building SF', type: 'integer', width: 'half' },
      ],
    },
    {
      id: 'component_mix',
      label: 'Component Mix',
      icon: 'pie-chart',
      fields: [
        { id: 'residentialSFPercent', label: '% Residential SF', type: 'percent', width: 'third', defaultValue: 60, tooltip: 'Percentage of total SF allocated to residential use' },
        { id: 'retailSFPercent', label: '% Retail SF', type: 'percent', width: 'third', defaultValue: 25, tooltip: 'Percentage of total SF allocated to ground-floor and mezzanine retail' },
        { id: 'officeSFPercent', label: '% Office SF', type: 'percent', width: 'third', defaultValue: 15, tooltip: 'Percentage of total SF allocated to office suites' },
        { id: 'totalUnitsResidential', label: 'Total Residential Units', type: 'integer', width: 'half' },
        { id: 'totalSuitesCommercial', label: 'Total Commercial Suites', type: 'integer', width: 'half' },
        { id: 'numberOfFloors', label: 'Number of Floors', type: 'integer', width: 'half' },
        { id: 'numberOfBuildings', label: 'Number of Buildings', type: 'integer', width: 'half', defaultValue: 1 },
      ],
    },
    {
      id: 'residential_assumptions',
      label: 'Residential Assumptions',
      icon: 'home',
      fields: [
        { id: 'avgRentPerUnit', label: 'Avg Rent / Unit / Mo', type: 'currency', width: 'half', tooltip: 'Blended average monthly rent across all residential unit types' },
        { id: 'residentialVacancy', label: 'Residential Vacancy %', type: 'percent', width: 'half', defaultValue: 5, tooltip: 'Economic vacancy including physical vacancy, model/down units, and concessions' },
        { id: 'concessionPercent', label: 'Concessions %', type: 'percent', width: 'half', defaultValue: 2, tooltip: 'Concessions as % of gross potential rent (free rent, reduced deposits, etc.)' },
        { id: 'badDebtPercent', label: 'Bad Debt %', type: 'percent', width: 'half', defaultValue: 1 },
        { id: 'turnoverRate', label: 'Annual Turnover Rate %', type: 'percent', width: 'half', defaultValue: 45, tooltip: 'Percentage of units that turn over annually' },
        { id: 'turnoverCostPerUnit', label: 'Turnover Cost / Unit', type: 'currency', width: 'half', tooltip: 'Make-ready cost per unit turn (paint, clean, minor repairs)' },
        { id: 'resPMFeePercent', label: 'Residential PM Fee %', type: 'percent', width: 'half', defaultValue: 5 },
      ],
    },
    {
      id: 'commercial_assumptions',
      label: 'Commercial Assumptions',
      icon: 'store',
      fields: [
        { id: 'avgRentPerSF', label: 'Avg Rent / SF (Annual)', type: 'currency', width: 'half', tooltip: 'Blended annual rent per SF across retail and office suites' },
        { id: 'commercialVacancy', label: 'Commercial Vacancy %', type: 'percent', width: 'half', defaultValue: 8, tooltip: 'Economic vacancy for commercial suites' },
        { id: 'commercialWALT', label: 'Commercial WALT (Years)', type: 'number', width: 'half', tooltip: 'Weighted average remaining lease term for commercial tenants' },
        { id: 'tiAllowancePerSF', label: 'TI Allowance / SF', type: 'currency', width: 'half', tooltip: 'Tenant improvement allowance for new commercial leases' },
        { id: 'lcPercentNew', label: 'LC % (New Lease)', type: 'percent', width: 'half', defaultValue: 5 },
        { id: 'lcPercentRenewal', label: 'LC % (Renewal)', type: 'percent', width: 'half', defaultValue: 2.5 },
        { id: 'camPerSF', label: 'CAM / SF', type: 'currency', width: 'half' },
        { id: 'percentageRentThreshold', label: 'Percentage Rent Breakpoint', type: 'currency', width: 'half', tooltip: 'Sales threshold above which percentage rent kicks in (retail tenants only)' },
      ],
    },
  ],
  growthCategories: [
    { id: 'residential_rent', label: 'Residential Rent Growth', icon: 'home', description: 'Market rent growth for residential units driven by local housing demand, wage growth, and new supply pipeline', defaultRate: 3.5 },
    { id: 'commercial_rent', label: 'Commercial Rent Growth', icon: 'store', description: 'Market rent growth for retail and office suites; ground-floor retail in well-located mixed-use often outperforms standalone retail', defaultRate: 3.0 },
    { id: 'parking_revenue', label: 'Parking Revenue Growth', icon: 'car', description: 'Annual parking rate increases across residential and commercial parking tiers', defaultRate: 2.0 },
    { id: 'amenity_revenue', label: 'Amenity Revenue Growth', icon: 'star', description: 'Growth in amenity, event, and ancillary revenue streams', defaultRate: 2.5 },
    { id: 'operating_expenses', label: 'Operating Expense Growth', icon: 'arrow-up', description: 'Blended controllable OpEx across residential and commercial components', defaultRate: 2.5 },
    { id: 'insurance', label: 'Insurance Growth', icon: 'shield', description: 'Property insurance; mixed-use may carry higher premiums due to occupancy diversity and building complexity', defaultRate: 5.0 },
    { id: 'property_tax', label: 'Property Tax Growth', icon: 'building', description: 'Real estate tax growth; some municipalities assess mixed-use at blended residential/commercial rates', defaultRate: 2.0 },
  ],
  kpis: [
    { id: 'purchasePrice', label: 'Purchase Price', field: 'purchasePrice', format: 'currency', icon: 'dollar-sign' },
    { id: 'capRate', label: 'Cap Rate', field: 'year1CapRate', format: 'percent', icon: 'percent' },
    { id: 'totalUnits', label: 'Total Units', field: 'totalStorageUnits', format: 'number', icon: 'layers' },
    { id: 'residentialNOI', label: 'Residential NOI', field: 'residentialNOI', format: 'currency', icon: 'home' },
    { id: 'commercialNOI', label: 'Commercial NOI', field: 'commercialNOI', format: 'currency', icon: 'store' },
    { id: 'blendedOccupancy', label: 'Blended Occupancy', field: 'blendedOccupancy', format: 'percent', icon: 'bar-chart' },
  ],
  tabs: { storageLeases: true, commercialLeases: true, profitCenters: true },
};


// ═══════════════════════════════════════════════════════════════
// Laundromat Config
// ═══════════════════════════════════════════════════════════════

const LAUNDROMAT_CONFIG: AssetClassModelConfig = {
  id: 'laundromat',
  label: 'Laundromat',
  terms: {
    unit: 'machine', unitPlural: 'machines',
    property: 'location', propertyPlural: 'locations',
    rentRoll: 'Equipment List', occupancy: 'Utilization',
    noi: 'EBITDA', pricePerUnit: '$/Machine', totalUnitsLabel: 'Total Machines',
  },
  valuationMetric: 'ebitda_multiple',
  valuationLabel: 'EBITDA Multiple',
  hasSeasonal: false,
  seasonConfig: { type: 'none' },
  unitMix: {
    tabLabel: 'Equipment Mix',
    tabIcon: 'settings',
    showTab: true,
    countColumnLabel: 'Machines',
    rateColumnLabel: 'Vend Price',
    rateType: 'monthly',
    sfColumnLabel: 'Capacity',
    showSF: false,
    types: [
      { id: 'washer_top_load', name: 'Top Load Washer', icon: 'home', section: 'Washers', hasSeasons: false, defaultFields: { count: 0 } },
      { id: 'washer_front_small', name: 'Front Load – Small (20 lb)', icon: 'home', section: 'Washers', hasSeasons: false, defaultFields: { count: 0 } },
      { id: 'washer_front_medium', name: 'Front Load – Medium (30 lb)', icon: 'home', section: 'Washers', hasSeasons: false, defaultFields: { count: 0 } },
      { id: 'washer_front_large', name: 'Front Load – Large (40 lb)', icon: 'home', section: 'Washers', hasSeasons: false, defaultFields: { count: 0 } },
      { id: 'washer_front_xl', name: 'Front Load – XL (60 lb)', icon: 'home', section: 'Washers', hasSeasons: false, defaultFields: { count: 0 } },
      { id: 'washer_front_mega', name: 'Front Load – Mega (80+ lb)', icon: 'home', section: 'Washers', hasSeasons: false, defaultFields: { count: 0 } },
      { id: 'dryer_standard', name: 'Dryer – Standard (30 lb)', icon: 'home', section: 'Dryers', hasSeasons: false, defaultFields: { count: 0 } },
      { id: 'dryer_large', name: 'Dryer – Large (50 lb)', icon: 'home', section: 'Dryers', hasSeasons: false, defaultFields: { count: 0 } },
      { id: 'dryer_stack', name: 'Dryer – Stack (2x30 lb)', icon: 'home', section: 'Dryers', hasSeasons: false, defaultFields: { count: 0 } },
      { id: 'change_machine', name: 'Change Machine', icon: 'dollar-sign', section: 'Ancillary Equipment', hasSeasons: false, defaultFields: { count: 0 } },
      { id: 'card_system', name: 'Card/App Payment Kiosk', icon: 'credit-card', section: 'Ancillary Equipment', hasSeasons: false, defaultFields: { count: 0 } },
      { id: 'vending_machine', name: 'Vending Machine', icon: 'shopping-cart', section: 'Ancillary Equipment', hasSeasons: false, defaultFields: { count: 0 } },
      { id: 'soap_dispenser', name: 'Soap / Chemical Dispenser', icon: 'droplet', section: 'Ancillary Equipment', hasSeasons: false, defaultFields: { count: 0 } },
    ],
  },
  profitCenters: {
    tabLabel: 'Revenue Streams',
    showTab: true,
    departments: [
      {
        id: 'wdf_service',
        name: 'Wash-Dry-Fold Service',
        icon: 'package',
        category: 'core',
        description: 'Drop-off laundry service charged per pound; typically higher-margin than self-service vending',
        hasRevenue: true,
        hasCOGS: true,
        hasDirectLabor: true,
        revenueLines: ['WDF Revenue (per pound)', 'Premium Garment Handling', 'Express/Same-Day Surcharge'],
        cogsLines: ['WDF Supplies (soap, softener, bags)', 'WDF Utility Allocation'],
        expenseLines: ['WDF Attendant Labor', 'WDF Packaging & Materials'],
      },
      {
        id: 'dry_cleaning',
        name: 'Dry Cleaning Drop-Off',
        icon: 'shirt',
        category: 'ancillary',
        description: 'Drop-off dry cleaning routed to third-party plant; laundromat acts as agent and earns commission or markup',
        hasRevenue: true,
        hasCOGS: true,
        hasDirectLabor: false,
        revenueLines: ['Dry Cleaning Drop-Off Revenue', 'Alterations/Repairs Revenue'],
        cogsLines: ['Dry Cleaning Outsource Cost', 'Alterations Cost'],
      },
      {
        id: 'vending',
        name: 'Vending & Retail',
        icon: 'shopping-cart',
        category: 'ancillary',
        description: 'Soap, snack, and beverage vending plus retail supply sales',
        hasRevenue: true,
        hasCOGS: true,
        hasDirectLabor: false,
        revenueLines: ['Soap & Chemical Vending', 'Snack & Beverage Vending', 'Retail Supply Sales (bags, hangers)'],
        cogsLines: ['Vending Product COGS', 'Retail Supply COGS'],
      },
      {
        id: 'pickup_delivery',
        name: 'Pick-Up & Delivery',
        icon: 'truck',
        category: 'specialty',
        description: 'Route-based laundry pick-up and delivery service to residential and small commercial customers',
        hasRevenue: true,
        hasCOGS: true,
        hasDirectLabor: true,
        revenueLines: ['Residential Pick-Up/Delivery', 'Commercial Route Revenue', 'Delivery Surcharge / Tips'],
        cogsLines: ['Vehicle Fuel & Maintenance', 'Delivery Bags & Supplies'],
        expenseLines: ['Driver Labor', 'Route Planning Software', 'Vehicle Insurance'],
      },
    ],
  },
  inputSections: [
    {
      id: 'general',
      label: 'General Assumptions',
      icon: 'settings',
      fields: [
        { id: 'purchasePrice', label: 'Purchase Price', type: 'currency', width: 'half' },
        { id: 'closingDate', label: 'Closing Date', type: 'text', width: 'half' },
        { id: 'holdPeriod', label: 'Hold Period (Years)', type: 'integer', width: 'half', defaultValue: 7 },
        { id: 'storeSF', label: 'Store Square Footage', type: 'integer', width: 'half' },
        { id: 'hoursPerDay', label: 'Operating Hours / Day', type: 'number', width: 'half', defaultValue: 16, tooltip: 'Daily operating hours; attended or unattended' },
        { id: 'daysPerWeek', label: 'Operating Days / Week', type: 'number', width: 'half', defaultValue: 7 },
        { id: 'attendedModel', label: 'Staffing Model', type: 'select', width: 'half',
          options: [
            { value: 'full_attend', label: 'Fully Attended' },
            { value: 'partial_attend', label: 'Partially Attended' },
            { value: 'unattended', label: 'Unattended (Card-Only)' },
          ]},
      ],
    },
    {
      id: 'revenue',
      label: 'Revenue Assumptions',
      icon: 'dollar-sign',
      fields: [
        { id: 'avgTurnsPerDay', label: 'Avg Turns / Machine / Day', type: 'number', width: 'half', defaultValue: 4, tooltip: 'Industry average is 3-6 turns/day; highly location-dependent' },
        { id: 'avgVendPriceWasher', label: 'Avg Vend Price (Washer)', type: 'currency', width: 'half', tooltip: 'Weighted average vend price across all washer sizes' },
        { id: 'avgVendPriceDryer', label: 'Avg Vend Price (Dryer)', type: 'currency', width: 'half', tooltip: 'Average dryer revenue per cycle (typically time-based)' },
        { id: 'wdfRevenuePercent', label: 'WDF % of Total Revenue', type: 'percent', width: 'half', defaultValue: 20, tooltip: 'Wash-dry-fold as percentage of total revenue; high-performing stores can reach 30-40%' },
        { id: 'wdfPricePerPound', label: 'WDF Price / Pound', type: 'currency', width: 'half', tooltip: 'Per-pound pricing for drop-off wash-dry-fold service' },
        { id: 'pickupDeliveryRevenue', label: 'Pick-Up/Delivery Revenue / Mo', type: 'currency', width: 'half', tooltip: 'Monthly revenue from route-based pick-up and delivery service' },
        { id: 'vendingRevenuePerMonth', label: 'Vending Revenue / Mo', type: 'currency', width: 'half' },
        { id: 'paymentMethod', label: 'Primary Payment Method', type: 'select', width: 'half',
          options: [
            { value: 'coin', label: 'Coin-Operated' },
            { value: 'card', label: 'Card/App System' },
            { value: 'hybrid', label: 'Hybrid (Coin + Card)' },
          ]},
      ],
    },
    {
      id: 'operating',
      label: 'Operating Expenses',
      icon: 'receipt',
      fields: [
        { id: 'rentPerMonth', label: 'Rent / Month', type: 'currency', width: 'half', tooltip: 'Monthly base rent for lease; triple-net or modified gross' },
        { id: 'rentEscalation', label: 'Annual Rent Escalation %', type: 'percent', width: 'half', defaultValue: 3 },
        { id: 'leaseTermRemaining', label: 'Lease Term Remaining (Years)', type: 'number', width: 'half' },
        { id: 'utilitiesPercent', label: 'Utilities % of Revenue', type: 'percent', width: 'half', defaultValue: 22, tooltip: 'Water, gas, electric; typically 20-30% of revenue. Gas-heated dryers lower than electric' },
        { id: 'waterPerMonth', label: 'Water & Sewer / Mo', type: 'currency', width: 'half' },
        { id: 'gasPerMonth', label: 'Gas / Mo', type: 'currency', width: 'half' },
        { id: 'electricPerMonth', label: 'Electric / Mo', type: 'currency', width: 'half' },
        { id: 'payrollPerMonth', label: 'Payroll / Mo', type: 'currency', width: 'half', tooltip: 'Total attendant and manager payroll including payroll taxes' },
        { id: 'suppliesPerMonth', label: 'Supplies & Cleaning / Mo', type: 'currency', width: 'half' },
        { id: 'insuranceAnnual', label: 'Insurance / Year', type: 'currency', width: 'half' },
        { id: 'equipmentMaintenanceReserve', label: 'Equipment Maintenance Reserve %', type: 'percent', width: 'half', defaultValue: 5, tooltip: 'Annual reserve for parts, repairs, and preventative maintenance' },
      ],
    },
    {
      id: 'equipment',
      label: 'Equipment Profile',
      icon: 'tool',
      fields: [
        { id: 'avgMachineCostWasher', label: 'Avg Machine Cost (Washer)', type: 'currency', width: 'half', tooltip: 'Average installed cost per washer including delivery and installation' },
        { id: 'avgMachineCostDryer', label: 'Avg Machine Cost (Dryer)', type: 'currency', width: 'half' },
        { id: 'avgMachineLifeYears', label: 'Avg Machine Life (Years)', type: 'number', width: 'half', defaultValue: 12, tooltip: 'Expected useful life per machine; commercial machines typically 10-15 years' },
        { id: 'avgMachineAge', label: 'Current Avg Machine Age (Years)', type: 'number', width: 'half', tooltip: 'Weighted average age of installed equipment base' },
        { id: 'replacementSchedule', label: 'Replacement Strategy', type: 'select', width: 'half',
          options: [
            { value: 'as_needed', label: 'As-Needed Replacement' },
            { value: 'rolling', label: 'Rolling Replacement (10-15%/year)' },
            { value: 'full_retool', label: 'Full Retool Planned' },
          ]},
        { id: 'totalEquipmentValue', label: 'Total Equipment Value (Current)', type: 'currency', width: 'half', tooltip: 'Estimated fair market value of all installed equipment' },
        { id: 'annualCapexReserve', label: 'Annual CapEx Reserve', type: 'currency', width: 'half', tooltip: 'Annual capital reserve for equipment replacement and store improvements' },
      ],
    },
  ],
  growthCategories: [
    { id: 'vend_revenue', label: 'Vend Revenue Growth', icon: 'trending-up', description: 'Growth in self-service vend revenue through price increases and volume gains; vend price increases typically lag inflation by 1-2 years', defaultRate: 2.0 },
    { id: 'wdf_revenue', label: 'WDF Revenue Growth', icon: 'package', description: 'Wash-dry-fold revenue growth driven by price increases, volume growth, and market penetration; fastest growing segment', defaultRate: 5.0 },
    { id: 'pickup_delivery_revenue', label: 'Pick-Up/Delivery Revenue Growth', icon: 'truck', description: 'Route-based delivery service growth as customer acquisition and route density improve', defaultRate: 8.0 },
    { id: 'vending_revenue', label: 'Vending & Retail Growth', icon: 'shopping-cart', description: 'Soap, snack, and supply vending revenue growth', defaultRate: 2.0 },
    { id: 'operating_expenses', label: 'Operating Expense Growth', icon: 'arrow-up', description: 'General OpEx inflation for supplies, repairs, and miscellaneous costs', defaultRate: 2.5 },
    { id: 'utilities', label: 'Utilities Growth', icon: 'zap', description: 'Water, gas, and electric cost escalation; often the largest single expense line', defaultRate: 3.0 },
    { id: 'payroll', label: 'Payroll Growth', icon: 'users', description: 'Attendant and manager wage growth driven by local minimum wage and labor market conditions', defaultRate: 3.5 },
    { id: 'rent', label: 'Rent / Lease Growth', icon: 'building', description: 'Lease rent escalation per contractual terms', defaultRate: 3.0 },
    { id: 'insurance', label: 'Insurance Growth', icon: 'shield', description: 'Property, general liability, and workers comp premium escalation', defaultRate: 4.0 },
  ],
  kpis: [
    { id: 'purchasePrice', label: 'Purchase Price', field: 'purchasePrice', format: 'currency', icon: 'dollar-sign' },
    { id: 'ebitdaMultiple', label: 'EBITDA Multiple', field: 'ebitdaMultiple', format: 'multiple', icon: 'x' },
    { id: 'totalMachines', label: 'Machines', field: 'totalStorageUnits', format: 'number', icon: 'settings' },
    { id: 'ebitda', label: 'EBITDA', field: 'ebitda', format: 'currency', icon: 'trending-up' },
    { id: 'revenuePerMachine', label: 'Revenue / Machine', field: 'revenuePerMachine', format: 'currency', icon: 'dollar-sign' },
    { id: 'turnsPerDay', label: 'Turns / Day', field: 'avgTurnsPerDay', format: 'number', icon: 'refresh-cw' },
  ],
  tabs: { storageLeases: true, commercialLeases: false, profitCenters: true },
};


// ═══════════════════════════════════════════════════════════════
// Single-Family Rental Config
// ═══════════════════════════════════════════════════════════════

const SFR_CONFIG: AssetClassModelConfig = {
  id: 'sfr',
  label: 'Single-Family Rental',
  terms: {
    unit: 'unit', unitPlural: 'units',
    property: 'property', propertyPlural: 'properties',
    rentRoll: 'Lease Summary', occupancy: 'Vacancy',
    noi: 'NOI', pricePerUnit: '$/Unit', totalUnitsLabel: 'Units',
  },
  valuationMetric: 'cap_rate',
  valuationLabel: 'Cap Rate',
  hasSeasonal: false,
  seasonConfig: { type: 'none' },
  unitMix: {
    tabLabel: 'Unit Mix',
    tabIcon: 'home',
    showTab: true,
    countColumnLabel: 'Units',
    rateColumnLabel: 'Rent/Mo',
    rateType: 'monthly',
    sfColumnLabel: 'Avg SF',
    showSF: true,
    types: [
      { id: '1br', name: '1 Bedroom', icon: 'home', section: 'By Bedroom', hasSeasons: false, defaultFields: { avgSF: 650 } },
      { id: '2br', name: '2 Bedroom', icon: 'home', section: 'By Bedroom', hasSeasons: false, defaultFields: { avgSF: 900 } },
      { id: '3br', name: '3 Bedroom', icon: 'home', section: 'By Bedroom', hasSeasons: false, defaultFields: { avgSF: 1200 } },
      { id: '4br', name: '4 Bedroom', icon: 'home', section: 'By Bedroom', hasSeasons: false, defaultFields: { avgSF: 1600 } },
      { id: '5br_plus', name: '5+ Bedroom', icon: 'home', section: 'By Bedroom', hasSeasons: false, defaultFields: { avgSF: 2200 } },
    ],
  },
  profitCenters: {
    tabLabel: 'Other Income',
    showTab: false,
    departments: [],
  },
  inputSections: [
    {
      id: 'general',
      label: 'General Assumptions',
      icon: 'settings',
      fields: [
        { id: 'purchasePrice', label: 'Purchase Price', type: 'currency', width: 'half' },
        { id: 'closingDate', label: 'Closing Date', type: 'text', width: 'half' },
        { id: 'holdPeriod', label: 'Hold Period (Years)', type: 'integer', width: 'half', defaultValue: 5 },
        { id: 'downPaymentPercent', label: 'Down Payment %', type: 'percent', width: 'half', defaultValue: 25 },
        { id: 'closingCostPercent', label: 'Closing Costs %', type: 'percent', width: 'half', defaultValue: 3, tooltip: 'Total closing costs as percentage of purchase price including title, escrow, appraisal, and lender fees' },
      ],
    },
    {
      id: 'property',
      label: 'Property Details',
      icon: 'home',
      fields: [
        { id: 'bedrooms', label: 'Bedrooms', type: 'integer', width: 'third' },
        { id: 'bathrooms', label: 'Bathrooms', type: 'number', width: 'third' },
        { id: 'yearBuilt', label: 'Year Built', type: 'integer', width: 'third' },
        { id: 'lotSizeSF', label: 'Lot Size (SF)', type: 'integer', width: 'half' },
        { id: 'livingAreaSF', label: 'Living Area (SF)', type: 'integer', width: 'half' },
        { id: 'garageSpaces', label: 'Garage Spaces', type: 'integer', width: 'half', defaultValue: 2 },
        { id: 'propertyCondition', label: 'Property Condition', type: 'select', width: 'half',
          options: [
            { value: 'excellent', label: 'Excellent (Turnkey)' },
            { value: 'good', label: 'Good (Minor Cosmetic)' },
            { value: 'fair', label: 'Fair (Deferred Maintenance)' },
            { value: 'renovation', label: 'Renovation Needed' },
          ]},
        { id: 'propertyType', label: 'Property Type', type: 'select', width: 'half',
          options: [
            { value: 'sfr_detached', label: 'Single-Family Detached' },
            { value: 'sfr_attached', label: 'Townhouse / Attached' },
            { value: 'condo', label: 'Condo' },
          ]},
        { id: 'schoolDistrict', label: 'School District Rating', type: 'select', width: 'half',
          options: [
            { value: 'a', label: 'A (Top Quartile)' },
            { value: 'b', label: 'B (Above Average)' },
            { value: 'c', label: 'C (Average)' },
            { value: 'd_f', label: 'D/F (Below Average)' },
          ],
          tooltip: 'School district quality significantly impacts tenant demand and rent levels' },
      ],
    },
    {
      id: 'revenue',
      label: 'Revenue',
      icon: 'dollar-sign',
      fields: [
        { id: 'monthlyRent', label: 'Monthly Rent', type: 'currency', width: 'half' },
        { id: 'vacancyPercent', label: 'Vacancy %', type: 'percent', width: 'half', defaultValue: 5, tooltip: 'Economic vacancy including turnover downtime; SFR typically 3-8%' },
        { id: 'otherIncomeMonthly', label: 'Other Income / Mo', type: 'currency', width: 'half', tooltip: 'Pet fees, storage, parking, application fees, late fees, etc.' },
        { id: 'petRentMonthly', label: 'Pet Rent / Mo', type: 'currency', width: 'half' },
        { id: 'avgLeaseTerm', label: 'Avg Lease Term (Months)', type: 'integer', width: 'half', defaultValue: 12 },
        { id: 'renewalRate', label: 'Renewal Rate %', type: 'percent', width: 'half', defaultValue: 65, tooltip: 'Percentage of tenants who renew at lease expiration' },
      ],
    },
    {
      id: 'expenses',
      label: 'Operating Expenses',
      icon: 'receipt',
      fields: [
        { id: 'propertyTaxAnnual', label: 'Property Tax / Year', type: 'currency', width: 'half' },
        { id: 'insuranceAnnual', label: 'Insurance / Year', type: 'currency', width: 'half', tooltip: 'Landlord dwelling policy including liability; flood and wind policies if applicable' },
        { id: 'hoaPerMonth', label: 'HOA / Month', type: 'currency', width: 'half', tooltip: 'Homeowners association dues; applicable for condos, townhomes, and some SFR communities' },
        { id: 'repairsMaintenancePercent', label: 'Repairs & Maintenance %', type: 'percent', width: 'half', defaultValue: 8, tooltip: 'Annual R&M as percentage of gross rent; rule of thumb is 5-10% for existing properties' },
        { id: 'pmFeePercent', label: 'PM Fee %', type: 'percent', width: 'half', defaultValue: 8, tooltip: 'Property management fee as % of collected rent; typically 8-10% for single properties, 5-7% for portfolios' },
        { id: 'pmLeaseUpFee', label: 'PM Lease-Up Fee', type: 'currency', width: 'half', tooltip: 'One-time fee for tenant placement (typically 50-100% of first months rent)' },
        { id: 'capexReservePercent', label: 'CapEx Reserve %', type: 'percent', width: 'half', defaultValue: 5, tooltip: 'Annual reserve for major capital items: roof, HVAC, appliances, flooring' },
        { id: 'landscapingPerMonth', label: 'Landscaping / Mo', type: 'currency', width: 'half', tooltip: 'Monthly lawn care and landscaping if landlord-provided' },
        { id: 'utilitiesPerMonth', label: 'Landlord-Paid Utilities / Mo', type: 'currency', width: 'half', tooltip: 'Utilities paid by landlord (water, sewer, trash if not tenant-paid)' },
        { id: 'turnoverCost', label: 'Avg Turnover Cost', type: 'currency', width: 'half', tooltip: 'Make-ready cost per tenant turnover including paint, cleaning, minor repairs, and re-keying' },
      ],
    },
  ],
  growthCategories: [
    { id: 'rent', label: 'Rent Growth', icon: 'trending-up', description: 'Annual rent increase at renewal or re-lease; driven by local housing market, wage growth, and home price appreciation', defaultRate: 3.0 },
    { id: 'other_income', label: 'Other Income Growth', icon: 'dollar-sign', description: 'Growth in pet fees, storage, and ancillary income', defaultRate: 2.0 },
    { id: 'operating_expenses', label: 'Operating Expense Growth', icon: 'arrow-up', description: 'Repairs, maintenance, landscaping, and PM fee inflation', defaultRate: 2.5 },
    { id: 'insurance', label: 'Insurance Growth', icon: 'shield', description: 'Landlord dwelling policy premium increases; catastrophe-zone properties may see 8-12% annual increases', defaultRate: 5.0 },
    { id: 'property_tax', label: 'Property Tax Growth', icon: 'building', description: 'Property tax assessment growth; acquisition may trigger reassessment to purchase price', defaultRate: 2.0 },
    { id: 'hoa', label: 'HOA Growth', icon: 'home', description: 'HOA dues annual increase (if applicable)', defaultRate: 3.0 },
  ],
  kpis: [
    { id: 'purchasePrice', label: 'Purchase Price', field: 'purchasePrice', format: 'currency', icon: 'dollar-sign' },
    { id: 'capRate', label: 'Cap Rate', field: 'year1CapRate', format: 'percent', icon: 'percent' },
    { id: 'monthlyRent', label: 'Monthly Rent', field: 'monthlyRent', format: 'currency', icon: 'dollar-sign' },
    { id: 'noi', label: 'NOI', field: 'ebitda', format: 'currency', icon: 'trending-up' },
    { id: 'grm', label: 'GRM', field: 'grm', format: 'multiple', icon: 'x' },
    { id: 'cashOnCash', label: 'Cash-on-Cash', field: 'cashOnCash', format: 'percent', icon: 'percent' },
  ],
  tabs: { storageLeases: true, commercialLeases: false, profitCenters: false },
};


// ═══════════════════════════════════════════════════════════════
// Business / Other Config (Generic Operating Business)
// ═══════════════════════════════════════════════════════════════

const BUSINESS_CONFIG: AssetClassModelConfig = {
  id: 'business',
  label: 'Business / Other',
  terms: {
    unit: 'unit', unitPlural: 'units',
    property: 'business', propertyPlural: 'businesses',
    rentRoll: 'Revenue Breakdown', occupancy: 'Utilization',
    noi: 'EBITDA', pricePerUnit: '$/Unit', totalUnitsLabel: 'Locations',
  },
  valuationMetric: 'ebitda_multiple',
  valuationLabel: 'EBITDA Multiple',
  hasSeasonal: false,
  seasonConfig: { type: 'none' },
  unitMix: {
    tabLabel: 'Revenue Units',
    tabIcon: 'bar-chart',
    showTab: false,
    countColumnLabel: 'Units',
    rateColumnLabel: 'Revenue',
    rateType: 'monthly',
    showSF: false,
    types: [],
  },
  profitCenters: {
    tabLabel: 'Revenue Streams',
    showTab: false,
    departments: [],
  },
  inputSections: [
    {
      id: 'general',
      label: 'General Assumptions',
      icon: 'settings',
      fields: [
        { id: 'purchasePrice', label: 'Purchase Price', type: 'currency', width: 'half' },
        { id: 'closingDate', label: 'Closing Date', type: 'text', width: 'half' },
        { id: 'holdPeriod', label: 'Hold Period (Years)', type: 'integer', width: 'half', defaultValue: 5 },
        { id: 'businessType', label: 'Business Type', type: 'text', width: 'half', placeholder: 'e.g. Car Wash, Gym, Daycare' },
        { id: 'numberOfLocations', label: 'Number of Locations', type: 'integer', width: 'half', defaultValue: 1 },
        { id: 'yearsInOperation', label: 'Years in Operation', type: 'integer', width: 'half' },
        { id: 'numberOfEmployees', label: 'Total Employees (FTEs)', type: 'integer', width: 'half' },
      ],
    },
    {
      id: 'revenue',
      label: 'Revenue',
      icon: 'dollar-sign',
      fields: [
        { id: 'primaryRevenue', label: 'Primary Revenue / Year', type: 'currency', width: 'half', tooltip: 'Core product or service revenue' },
        { id: 'secondaryRevenue', label: 'Secondary Revenue / Year', type: 'currency', width: 'half', tooltip: 'Ancillary or add-on revenue streams' },
        { id: 'serviceRevenue', label: 'Service Revenue / Year', type: 'currency', width: 'half', tooltip: 'Professional services, consulting, or labor-based revenue' },
        { id: 'recurringRevenue', label: 'Subscription / Recurring Revenue / Year', type: 'currency', width: 'half', tooltip: 'Monthly or annual subscription, membership, or contract-based recurring revenue' },
        { id: 'totalRevenueLastYear', label: 'Total Revenue (Last 12 Months)', type: 'currency', width: 'half', tooltip: 'Trailing twelve months total revenue' },
        { id: 'revenueGrowthRate', label: 'Historical Revenue Growth %', type: 'percent', width: 'half', tooltip: 'Year-over-year revenue growth rate (trailing 3 year average)' },
        { id: 'recurringRevenuePercent', label: 'Recurring Revenue %', type: 'percent', width: 'half', tooltip: 'Percentage of total revenue that is recurring/contractual' },
        { id: 'customerConcentration', label: 'Top Customer % of Revenue', type: 'percent', width: 'half', tooltip: 'Revenue concentration risk — percentage from largest single customer' },
      ],
    },
    {
      id: 'cogs',
      label: 'Cost of Goods Sold',
      icon: 'package',
      fields: [
        { id: 'directLaborPercent', label: 'Direct Labor %', type: 'percent', width: 'third', tooltip: 'Direct labor as percentage of revenue' },
        { id: 'materialsPercent', label: 'Materials / Supplies %', type: 'percent', width: 'third', tooltip: 'Raw materials, inventory, and direct supplies as percentage of revenue' },
        { id: 'otherCOGSPercent', label: 'Other COGS %', type: 'percent', width: 'third', tooltip: 'Other direct costs (freight, subcontractors, manufacturing overhead) as percentage of revenue' },
        { id: 'totalCOGS', label: 'Total COGS / Year', type: 'currency', width: 'half' },
        { id: 'grossMargin', label: 'Gross Margin %', type: 'percent', width: 'half', tooltip: 'Gross profit as percentage of revenue; (Revenue - COGS) / Revenue' },
      ],
    },
    {
      id: 'operating',
      label: 'Operating Expenses',
      icon: 'receipt',
      fields: [
        { id: 'rentLease', label: 'Rent / Lease / Year', type: 'currency', width: 'half', tooltip: 'Annual facility rent or lease payments' },
        { id: 'payrollBenefits', label: 'Payroll & Benefits / Year', type: 'currency', width: 'half', tooltip: 'Total payroll including SG&A staff, benefits, payroll taxes (exclude direct labor in COGS)' },
        { id: 'marketingAdvertising', label: 'Marketing & Advertising / Year', type: 'currency', width: 'half', tooltip: 'Total marketing, advertising, and customer acquisition costs' },
        { id: 'professionalServices', label: 'Professional Services / Year', type: 'currency', width: 'half', tooltip: 'Legal, accounting, consulting, and advisory fees' },
        { id: 'technologySoftware', label: 'Technology & Software / Year', type: 'currency', width: 'half', tooltip: 'SaaS subscriptions, IT infrastructure, website, and POS systems' },
        { id: 'utilitiesAnnual', label: 'Utilities / Year', type: 'currency', width: 'half' },
        { id: 'insuranceAnnual', label: 'Insurance / Year', type: 'currency', width: 'half', tooltip: 'General liability, workers comp, property, and professional liability insurance' },
        { id: 'vehicleExpenses', label: 'Vehicle & Travel / Year', type: 'currency', width: 'half' },
        { id: 'repairsMaintenanceAnnual', label: 'Repairs & Maintenance / Year', type: 'currency', width: 'half' },
        { id: 'miscellaneousAnnual', label: 'Other / Miscellaneous / Year', type: 'currency', width: 'half' },
        { id: 'ownerCompensation', label: 'Owner Compensation / Year', type: 'currency', width: 'half', tooltip: 'Current owner salary, benefits, and perks to be adjusted for normalized EBITDA' },
        { id: 'addbacks', label: 'Total Seller Add-Backs / Year', type: 'currency', width: 'half', tooltip: 'Non-recurring or owner-specific expenses added back to calculate adjusted EBITDA' },
      ],
    },
  ],
  growthCategories: [
    { id: 'revenue', label: 'Revenue Growth', icon: 'trending-up', description: 'Total top-line revenue growth driven by pricing power, volume gains, and new customer acquisition', defaultRate: 5.0 },
    { id: 'recurring_revenue', label: 'Recurring Revenue Growth', icon: 'refresh-cw', description: 'Growth in subscription, membership, and contract-based revenue streams', defaultRate: 7.0 },
    { id: 'cogs', label: 'COGS Growth', icon: 'package', description: 'Direct cost inflation including materials, supplies, and direct labor', defaultRate: 3.0 },
    { id: 'payroll', label: 'Payroll & Benefits Growth', icon: 'users', description: 'SG&A payroll and benefits inflation driven by wage growth and headcount additions', defaultRate: 3.5 },
    { id: 'operating_expenses', label: 'Operating Expense Growth', icon: 'arrow-up', description: 'Controllable operating expenses including rent, utilities, marketing, and professional services', defaultRate: 3.0 },
    { id: 'insurance', label: 'Insurance Growth', icon: 'shield', description: 'General liability, workers comp, and property insurance premium escalation', defaultRate: 4.0 },
    { id: 'technology', label: 'Technology Costs Growth', icon: 'monitor', description: 'SaaS subscription, IT infrastructure, and digital platform cost growth', defaultRate: 5.0 },
  ],
  kpis: [
    { id: 'purchasePrice', label: 'Purchase Price', field: 'purchasePrice', format: 'currency', icon: 'dollar-sign' },
    { id: 'ebitdaMultiple', label: 'EBITDA Multiple', field: 'ebitdaMultiple', format: 'multiple', icon: 'x' },
    { id: 'revenue', label: 'Revenue', field: 'totalRevenue', format: 'currency', icon: 'trending-up' },
    { id: 'ebitda', label: 'EBITDA', field: 'ebitda', format: 'currency', icon: 'dollar-sign' },
    { id: 'ebitdaMargin', label: 'EBITDA Margin', field: 'ebitdaMargin', format: 'percent', icon: 'percent' },
    { id: 'revenueGrowth', label: 'Revenue Growth', field: 'revenueGrowthRate', format: 'percent', icon: 'arrow-up' },
  ],
  tabs: { storageLeases: false, commercialLeases: false, profitCenters: false },
};


// ═══════════════════════════════════════════════════════════════
// Registry + Lookup
// ═══════════════════════════════════════════════════════════════


// Duplex / Triplex / Quad — share SFR config with unit count overrides
const DUPLEX_CONFIG: AssetClassModelConfig = {
  ...SFR_CONFIG,
  id: 'duplex',
  label: 'Duplex',
  defaults: { ...SFR_CONFIG.defaults, numberOfUnits: 2 },
  tabs: { ...SFR_CONFIG.tabs, storageLeases: true },
  unitMix: { ...SFR_CONFIG.unitMix, tabLabel: 'Unit Mix' },
};
const TRIPLEX_CONFIG: AssetClassModelConfig = {
  ...DUPLEX_CONFIG,
  id: 'triplex',
  label: 'Triplex',
  defaults: { ...DUPLEX_CONFIG.defaults, numberOfUnits: 3 },
};
const QUAD_CONFIG: AssetClassModelConfig = {
  ...DUPLEX_CONFIG,
  id: 'quad',
  label: 'Quadplex',
  defaults: { ...DUPLEX_CONFIG.defaults, numberOfUnits: 4 },
};
const MODEL_CONFIG_REGISTRY: Record<string, AssetClassModelConfig> = {
  marina: MARINA_CONFIG,
  multifamily: MULTIFAMILY_CONFIG,
  retail: RETAIL_CONFIG,
  office: OFFICE_CONFIG,
  industrial: INDUSTRIAL_CONFIG,
  self_storage: SELF_STORAGE_CONFIG,
  hotel: HOTEL_CONFIG,
  str: STR_CONFIG,
  medical_office: MEDICAL_OFFICE_CONFIG,
  mixed_use: MIXED_USE_CONFIG,
  laundromat: LAUNDROMAT_CONFIG,
  sfr: SFR_CONFIG,
  business: BUSINESS_CONFIG,
  duplex: DUPLEX_CONFIG,
  triplex: TRIPLEX_CONFIG,
  quad: QUAD_CONFIG,
};

/**
 * Get the full model configuration for an asset class.
 * Falls back to marina if asset class is null or unknown.
 */
export function getModelConfig(assetClass: string | null | undefined): AssetClassModelConfig {
  return MODEL_CONFIG_REGISTRY[assetClass || 'marina'] || MARINA_CONFIG;
}

/**
 * Get tab groups with dynamic labels and visibility for an asset class.
 * Used by workspace.tsx to filter and rename tabs.
 */
export function getTabOverrides(assetClass: string | null | undefined) {
  const config = getModelConfig(assetClass);
  return {
    // Tab visibility
    showStorageLeases: config.tabs.storageLeases,
    showCommercialLeases: config.tabs.commercialLeases,
    showProfitCenters: config.tabs.profitCenters,
    // Tab labels (dynamic)
    storageLabel: config.unitMix.tabLabel || 'Unit Mix',
    storageIcon: config.unitMix.tabIcon,
    profitCentersLabel: config.profitCenters.tabLabel || 'Profit Centers',
    // Season visibility
    showSeasons: config.hasSeasonal,
    seasonLabel: config.seasonConfig.seasonLabel,
    offSeasonLabel: config.seasonConfig.offSeasonLabel,
  };
}

export { MODEL_CONFIG_REGISTRY };
