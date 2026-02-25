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
      { id: '5x5_climate', name: '5×5 Climate', icon: 'container', section: 'Climate-Controlled', hasSeasons: false, defaultFields: { avgSF: 25 } },
      { id: '5x10_climate', name: '5×10 Climate', icon: 'container', section: 'Climate-Controlled', hasSeasons: false, defaultFields: { avgSF: 50 } },
      { id: '10x10_climate', name: '10×10 Climate', icon: 'container', section: 'Climate-Controlled', hasSeasons: false, defaultFields: { avgSF: 100 } },
      { id: '10x15_climate', name: '10×15 Climate', icon: 'container', section: 'Climate-Controlled', hasSeasons: false, defaultFields: { avgSF: 150 } },
      { id: '10x20_climate', name: '10×20 Climate', icon: 'container', section: 'Climate-Controlled', hasSeasons: false, defaultFields: { avgSF: 200 } },
      { id: '5x10_standard', name: '5×10 Standard', icon: 'warehouse', section: 'Non-Climate', hasSeasons: false, defaultFields: { avgSF: 50 } },
      { id: '10x10_standard', name: '10×10 Standard', icon: 'warehouse', section: 'Non-Climate', hasSeasons: false, defaultFields: { avgSF: 100 } },
      { id: '10x15_standard', name: '10×15 Standard', icon: 'warehouse', section: 'Non-Climate', hasSeasons: false, defaultFields: { avgSF: 150 } },
      { id: '10x20_standard', name: '10×20 Standard', icon: 'warehouse', section: 'Non-Climate', hasSeasons: false, defaultFields: { avgSF: 200 } },
      { id: '10x30_standard', name: '10×30 Standard', icon: 'warehouse', section: 'Non-Climate', hasSeasons: false, defaultFields: { avgSF: 300 } },
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
// Remaining configs (Office, Industrial, Medical, Mixed-Use,
// Laundromat, SFR, Business) — follow same pattern
// ═══════════════════════════════════════════════════════════════

// For brevity, these use a factory with key overrides.
// Each still gets full type safety.

function makeConfig(overrides: Partial<AssetClassModelConfig> & Pick<AssetClassModelConfig, 'id' | 'label' | 'terms' | 'valuationMetric' | 'valuationLabel'>): AssetClassModelConfig {
  return {
    hasSeasonal: false,
    seasonConfig: { type: 'none' },
    unitMix: { tabLabel: '', tabIcon: 'layers', showTab: false, countColumnLabel: '', rateColumnLabel: '', showSF: false, types: [] },
    profitCenters: { tabLabel: 'Revenue', showTab: false, departments: [] },
    inputSections: [
      { id: 'general', label: 'General Assumptions', icon: 'settings', fields: [
        { id: 'purchasePrice', label: 'Purchase Price', type: 'currency', width: 'half' },
        { id: 'closingDate', label: 'Closing Date', type: 'text', width: 'half' },
        { id: 'holdPeriod', label: 'Hold Period (Years)', type: 'integer', width: 'half', defaultValue: 5 },
        { id: 'managementFeePercent', label: 'Management Fee %', type: 'percent', width: 'half', defaultValue: 5 },
      ]},
    ],
    growthCategories: [
      { id: 'revenue', label: 'Revenue Growth', icon: 'trending-up', description: 'Annual revenue growth', defaultRate: 3.0 },
      { id: 'operating_expenses', label: 'Operating Expense Growth', icon: 'arrow-up', description: 'Annual OpEx inflation', defaultRate: 2.5 },
      { id: 'insurance', label: 'Insurance Growth', icon: 'shield', description: 'Insurance premium growth', defaultRate: 5.0 },
      { id: 'property_tax', label: 'Property Tax Growth', icon: 'building', description: 'Property tax growth', defaultRate: 2.0 },
    ],
    kpis: [
      { id: 'purchasePrice', label: 'Purchase Price', field: 'purchasePrice', format: 'currency', icon: 'dollar-sign' },
      { id: 'capRate', label: overrides.valuationLabel, field: 'year1CapRate', format: overrides.valuationMetric === 'cap_rate' ? 'percent' : 'multiple', icon: 'percent' },
      { id: 'noi', label: overrides.terms.noi, field: 'ebitda', format: 'currency', icon: 'trending-up' },
    ],
    tabs: { storageLeases: false, commercialLeases: false, profitCenters: false },
    ...overrides,
  };
}

const OFFICE_CONFIG = makeConfig({
  id: 'office', label: 'Office',
  terms: { unit: 'suite', unitPlural: 'suites', property: 'building', propertyPlural: 'buildings', rentRoll: 'Tenant Rent Roll', occupancy: 'Occupancy', noi: 'NOI', pricePerUnit: '$/SF', totalUnitsLabel: 'Total RSF' },
  valuationMetric: 'cap_rate', valuationLabel: 'Cap Rate',
  tabs: { storageLeases: false, commercialLeases: true, profitCenters: false },
  growthCategories: [
    { id: 'base_rent', label: 'Base Rent Growth', icon: 'trending-up', description: 'Contractual rent escalations', defaultRate: 3.0 },
    { id: 'expense_recovery', label: 'Expense Recovery Growth', icon: 'dollar-sign', description: 'CAM/tax/ins pass-throughs', defaultRate: 2.5 },
    { id: 'operating_expenses', label: 'Operating Expense Growth', icon: 'arrow-up', description: 'Controllable operating costs', defaultRate: 2.5 },
    { id: 'insurance', label: 'Insurance Growth', icon: 'shield', description: 'Property insurance', defaultRate: 5.0 },
    { id: 'property_tax', label: 'Property Tax Growth', icon: 'building', description: 'Real estate taxes', defaultRate: 2.0 },
  ],
});

const INDUSTRIAL_CONFIG = makeConfig({
  id: 'industrial', label: 'Industrial',
  terms: { unit: 'bay', unitPlural: 'bays', property: 'building', propertyPlural: 'buildings', rentRoll: 'Tenant Rent Roll', occupancy: 'Occupancy', noi: 'NOI', pricePerUnit: '$/SF', totalUnitsLabel: 'Total SF' },
  valuationMetric: 'cap_rate', valuationLabel: 'Cap Rate',
  tabs: { storageLeases: false, commercialLeases: true, profitCenters: false },
});

const MEDICAL_OFFICE_CONFIG = makeConfig({
  id: 'medical_office', label: 'Medical Office',
  terms: { unit: 'suite', unitPlural: 'suites', property: 'building', propertyPlural: 'buildings', rentRoll: 'Tenant Rent Roll', occupancy: 'Occupancy', noi: 'NOI', pricePerUnit: '$/SF', totalUnitsLabel: 'Total RSF' },
  valuationMetric: 'cap_rate', valuationLabel: 'Cap Rate',
  tabs: { storageLeases: false, commercialLeases: true, profitCenters: false },
});

const MIXED_USE_CONFIG = makeConfig({
  id: 'mixed_use', label: 'Mixed-Use',
  terms: { unit: 'unit', unitPlural: 'units', property: 'property', propertyPlural: 'properties', rentRoll: 'Unit Mix', occupancy: 'Occupancy', noi: 'NOI', pricePerUnit: '$/SF', totalUnitsLabel: 'Total Units' },
  valuationMetric: 'cap_rate', valuationLabel: 'Cap Rate',
  tabs: { storageLeases: true, commercialLeases: true, profitCenters: false },
});

const LAUNDROMAT_CONFIG = makeConfig({
  id: 'laundromat', label: 'Laundromat',
  terms: { unit: 'machine', unitPlural: 'machines', property: 'location', propertyPlural: 'locations', rentRoll: 'Equipment List', occupancy: 'Utilization', noi: 'EBITDA', pricePerUnit: '$/Machine', totalUnitsLabel: 'Total Machines' },
  valuationMetric: 'ebitda_multiple', valuationLabel: 'EBITDA Multiple',
  inputSections: [
    { id: 'general', label: 'General Assumptions', icon: 'settings', fields: [
      { id: 'purchasePrice', label: 'Purchase Price', type: 'currency', width: 'half' },
      { id: 'closingDate', label: 'Closing Date', type: 'text', width: 'half' },
      { id: 'holdPeriod', label: 'Hold Period (Years)', type: 'integer', width: 'half', defaultValue: 5 },
    ]},
    { id: 'revenue', label: 'Revenue Assumptions', icon: 'dollar-sign', fields: [
      { id: 'avgTurnsPerDay', label: 'Avg Turns / Machine / Day', type: 'number', width: 'half', defaultValue: 4 },
      { id: 'avgVendPrice', label: 'Avg Vend Price (Washer)', type: 'currency', width: 'half' },
      { id: 'avgVendPriceDryer', label: 'Avg Vend Price (Dryer)', type: 'currency', width: 'half' },
      { id: 'wdfRevenuePercent', label: 'WDF % of Total Revenue', type: 'percent', width: 'half', defaultValue: 20 },
    ]},
    { id: 'expenses', label: 'Key Expenses', icon: 'receipt', fields: [
      { id: 'rentPerMonth', label: 'Rent / Month', type: 'currency', width: 'half' },
      { id: 'utilitiesPerMonth', label: 'Utilities / Month', type: 'currency', width: 'half' },
      { id: 'attendantPayroll', label: 'Attendant Payroll / Mo', type: 'currency', width: 'half' },
      { id: 'equipmentReservePercent', label: 'Equipment Reserve %', type: 'percent', width: 'half', defaultValue: 5 },
    ]},
  ],
  growthCategories: [
    { id: 'vend_price', label: 'Vend Price Growth', icon: 'trending-up', description: 'Machine price increases', defaultRate: 3.0 },
    { id: 'wdf_revenue', label: 'WDF Revenue Growth', icon: 'dollar-sign', description: 'Wash-dry-fold growth', defaultRate: 5.0 },
    { id: 'utilities', label: 'Utility Cost Growth', icon: 'zap', description: 'Electric, gas, water increases', defaultRate: 4.0 },
    { id: 'rent', label: 'Rent Growth', icon: 'building', description: 'Lease rent escalation', defaultRate: 3.0 },
    { id: 'operating_expenses', label: 'Other OpEx Growth', icon: 'arrow-up', description: 'Supplies, repairs, etc.', defaultRate: 2.5 },
  ],
});

const SFR_CONFIG = makeConfig({
  id: 'sfr', label: 'Single-Family Rental',
  terms: { unit: 'unit', unitPlural: 'units', property: 'property', propertyPlural: 'properties', rentRoll: 'Lease Summary', occupancy: 'Vacancy', noi: 'NOI', pricePerUnit: '$/Unit', totalUnitsLabel: 'Units' },
  valuationMetric: 'grm', valuationLabel: 'GRM',
  inputSections: [
    { id: 'general', label: 'General Assumptions', icon: 'settings', fields: [
      { id: 'purchasePrice', label: 'Purchase Price', type: 'currency', width: 'half' },
      { id: 'closingDate', label: 'Closing Date', type: 'text', width: 'half' },
      { id: 'holdPeriod', label: 'Hold Period (Years)', type: 'integer', width: 'half', defaultValue: 5 },
    ]},
    { id: 'revenue', label: 'Revenue', icon: 'dollar-sign', fields: [
      { id: 'monthlyRent', label: 'Monthly Rent', type: 'currency', width: 'half' },
      { id: 'vacancyPercent', label: 'Vacancy %', type: 'percent', width: 'half', defaultValue: 5 },
      { id: 'otherIncome', label: 'Other Income / Mo', type: 'currency', width: 'half', tooltip: 'Parking, storage, pet fees, etc.' },
    ]},
    { id: 'expenses', label: 'Operating Expenses', icon: 'receipt', fields: [
      { id: 'propertyTaxAnnual', label: 'Property Tax / Year', type: 'currency', width: 'half' },
      { id: 'insuranceAnnual', label: 'Insurance / Year', type: 'currency', width: 'half' },
      { id: 'repairsAnnual', label: 'Repairs & Maint / Year', type: 'currency', width: 'half' },
      { id: 'managementFeePercent', label: 'PM Fee %', type: 'percent', width: 'half', defaultValue: 8 },
      { id: 'hoaPerMonth', label: 'HOA / Month', type: 'currency', width: 'half' },
      { id: 'capexReservePercent', label: 'CapEx Reserve %', type: 'percent', width: 'half', defaultValue: 5 },
    ]},
  ],
  growthCategories: [
    { id: 'rent', label: 'Rent Growth', icon: 'trending-up', description: 'Annual rent increase', defaultRate: 3.0 },
    { id: 'operating_expenses', label: 'Operating Expense Growth', icon: 'arrow-up', description: 'Repairs, management, supplies', defaultRate: 2.5 },
    { id: 'insurance', label: 'Insurance Growth', icon: 'shield', description: 'Premium increases', defaultRate: 5.0 },
    { id: 'property_tax', label: 'Property Tax Growth', icon: 'building', description: 'Tax assessment increases', defaultRate: 2.0 },
  ],
});

const BUSINESS_CONFIG = makeConfig({
  id: 'business', label: 'Business / Other',
  terms: { unit: 'unit', unitPlural: 'units', property: 'business', propertyPlural: 'businesses', rentRoll: 'Revenue Breakdown', occupancy: 'Utilization', noi: 'EBITDA', pricePerUnit: '$/Unit', totalUnitsLabel: 'Locations' },
  valuationMetric: 'ebitda_multiple', valuationLabel: 'EBITDA Multiple',
});


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
