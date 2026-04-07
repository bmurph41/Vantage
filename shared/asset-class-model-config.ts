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

  // ─── Rental Mode (for small residential) ──────────────
  rentalModes?: ('long_term' | 'short_term')[];  // available modes for this asset class
  defaultRentalMode?: 'long_term' | 'short_term';

  // ─── User Customization Support ───────────────────────
  allowCustomUnitTypes?: boolean;    // user can add custom unit/storage types
  allowCustomDepartments?: boolean;  // user can add custom departments
  allowCustomGrowthCategories?: boolean; // user can add custom growth rates

  // ─── Unit Type Modifiers ──────────────────────────────
  unitModifiers?: UnitModifierConfig[];  // checkbox modifiers for unit types (indoor/outdoor, covered, etc.)
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
    beds?: number;
    baths?: number;
    maxGuests?: number;
    avgNightlyRate?: number;
    cleaningFee?: number;
    rackRate?: number;
  };
}

export interface UnitModifierConfig {
  id: string;
  label: string;
  description?: string;
  appliesTo?: string[];  // unit type IDs this modifier applies to, empty = all
  defaultEnabled?: boolean;
  impactOnRate?: number;  // % premium/discount when enabled (e.g., 15 for +15%)
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
      // In-Water - Fixed Docks
      { id: 'wet_slips_fixed', name: 'Wet Slips – Fixed Dock', icon: 'anchor', section: 'In-Water (Fixed)', hasSeasons: true, defaultFields: {} },
      { id: 'wet_slips_end', name: 'Wet Slips – End Ties', icon: 'anchor', section: 'In-Water (Fixed)', hasSeasons: true, defaultFields: {} },
      { id: 'wet_slips_t_head', name: 'Wet Slips – T-Head', icon: 'anchor', section: 'In-Water (Fixed)', hasSeasons: true, defaultFields: {} },
      { id: 'wet_slips_side_tie', name: 'Side-Tie / Alongside', icon: 'anchor', section: 'In-Water (Fixed)', hasSeasons: true, defaultFields: {} },
      // In-Water - Floating Docks
      { id: 'wet_slips_floating', name: 'Wet Slips – Floating Dock', icon: 'waves', section: 'In-Water (Floating)', hasSeasons: true, defaultFields: {} },
      { id: 'wet_slips_mega', name: 'Mega Yacht Slips (80ft+)', icon: 'ship', section: 'In-Water (Floating)', hasSeasons: true, defaultFields: {} },
      { id: 'wet_slips_superyacht', name: 'Superyacht Berths (120ft+)', icon: 'ship', section: 'In-Water (Floating)', hasSeasons: false, defaultFields: {} },
      // In-Water - Other
      { id: 'moorings', name: 'Moorings', icon: 'anchor', section: 'In-Water (Other)', hasSeasons: true, defaultFields: {} },
      { id: 'anchorage', name: 'Anchorage Permits', icon: 'anchor', section: 'In-Water (Other)', hasSeasons: true, defaultFields: {} },
      { id: 'lift_slips', name: 'Lift Slips (In-Water Lift)', icon: 'arrow-up', section: 'In-Water (Other)', hasSeasons: true, defaultFields: {} },
      { id: 'dinghies', name: 'Dinghy Dock', icon: 'sailboat', section: 'In-Water (Other)', hasSeasons: true, defaultFields: {} },
      // Dry Storage - Indoor
      { id: 'dry_stack_indoor', name: 'Dry Stack – Indoor', icon: 'warehouse', section: 'Dry Storage (Indoor)', hasSeasons: false, defaultFields: {} },
      { id: 'dry_rack_indoor', name: 'Dry Rack – Indoor', icon: 'warehouse', section: 'Dry Storage (Indoor)', hasSeasons: false, defaultFields: {} },
      { id: 'dry_forklift_indoor', name: 'Forklift Storage – Indoor', icon: 'warehouse', section: 'Dry Storage (Indoor)', hasSeasons: false, defaultFields: {} },
      { id: 'enclosed_building', name: 'Enclosed Building Storage', icon: 'warehouse', section: 'Dry Storage (Indoor)', hasSeasons: false, defaultFields: {} },
      // Dry Storage - Outdoor
      { id: 'dry_stack_outdoor', name: 'Dry Stack – Outdoor', icon: 'container', section: 'Dry Storage (Outdoor)', hasSeasons: true, defaultFields: {} },
      { id: 'dry_rack_outdoor', name: 'Dry Rack – Outdoor', icon: 'container', section: 'Dry Storage (Outdoor)', hasSeasons: true, defaultFields: {} },
      { id: 'boats_on_trailers', name: 'Boats on Trailers (Yard)', icon: 'ship', section: 'Dry Storage (Outdoor)', hasSeasons: true, defaultFields: {} },
      { id: 'cradle_storage', name: 'Cradle / Jack Stand Storage', icon: 'ship', section: 'Dry Storage (Outdoor)', hasSeasons: true, defaultFields: {} },
      { id: 'covered_outdoor', name: 'Covered Outdoor Storage', icon: 'container', section: 'Dry Storage (Outdoor)', hasSeasons: true, defaultFields: {} },
      // Trailer & Vehicle
      { id: 'trailer_parking', name: 'Trailer Parking', icon: 'truck', section: 'Trailer & Vehicle', hasSeasons: true, defaultFields: {} },
      { id: 'rv_sites', name: 'RV / Camper Sites', icon: 'tent', section: 'Trailer & Vehicle', hasSeasons: true, defaultFields: {} },
      { id: 'vehicle_parking', name: 'Vehicle Parking', icon: 'car', section: 'Trailer & Vehicle', hasSeasons: false, defaultFields: {} },
      // Small Craft & Specialty
      { id: 'kayak_paddleboard', name: 'Kayak / Paddleboard Racks', icon: 'waves', section: 'Small Craft', hasSeasons: true, defaultFields: {} },
      { id: 'jet_ski', name: 'Jet Ski / PWC Storage', icon: 'waves', section: 'Small Craft', hasSeasons: true, defaultFields: {} },
      { id: 'canoe_rack', name: 'Canoe / Row Boat Rack', icon: 'waves', section: 'Small Craft', hasSeasons: true, defaultFields: {} },
      // Specialty
      { id: 'houseboats', name: 'Houseboats', icon: 'home', section: 'Specialty', hasSeasons: false, defaultFields: {} },
      { id: 'liveaboards', name: 'Liveaboards', icon: 'home', section: 'Specialty', hasSeasons: false, defaultFields: {} },
      { id: 'commercial_fishing', name: 'Commercial Fishing Vessels', icon: 'ship', section: 'Specialty', hasSeasons: false, defaultFields: {} },
      { id: 'charter_boats', name: 'Charter / Tour Boats', icon: 'ship', section: 'Specialty', hasSeasons: true, defaultFields: {} },
      { id: 'transient_slips', name: 'Transient / Guest Slips', icon: 'compass', section: 'Transient', hasSeasons: true, defaultFields: {} },
      { id: 'transient_moorings', name: 'Transient Moorings', icon: 'compass', section: 'Transient', hasSeasons: true, defaultFields: {} },
    ],
  },
  unitModifiers: [
    { id: 'covered', label: 'Covered', description: 'Covered slip or storage with roof structure', impactOnRate: 20 },
    { id: 'electric_30a', label: '30A Electric', description: '30-amp shore power hookup', defaultEnabled: true },
    { id: 'electric_50a', label: '50A Electric', description: '50-amp shore power hookup', impactOnRate: 10 },
    { id: 'electric_100a', label: '100A Electric', description: '100-amp shore power (mega yachts)', impactOnRate: 25 },
    { id: 'water', label: 'Water Hookup', description: 'Fresh water connection at slip', defaultEnabled: true },
    { id: 'wifi', label: 'WiFi', description: 'High-speed wireless internet at dock', impactOnRate: 5 },
    { id: 'pump_out', label: 'Pump-Out', description: 'Waste pump-out at slip', impactOnRate: 5 },
    { id: 'cable_tv', label: 'Cable / TV', description: 'Cable TV hookup', impactOnRate: 3 },
    { id: 'security_camera', label: 'Security Camera', description: 'Individual slip security monitoring' },
    { id: 'dock_box', label: 'Dock Box', description: 'Lockable storage box at slip', impactOnRate: 2 },
    { id: 'finger_pier', label: 'Finger Pier', description: 'Individual finger pier access' },
    { id: 'fuel_dock_adjacent', label: 'Fuel Dock Adjacent', description: 'Near fuel dock for convenience' },
  ],
  allowCustomUnitTypes: true,
  allowCustomDepartments: true,
  allowCustomGrowthCategories: true,
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
    {
      id: 'property_details',
      label: 'Property Details',
      icon: 'building',
      fields: [
        { id: 'purchasePrice', label: 'Purchase Price', type: 'currency', width: 'half' },
        { id: 'totalUnits', label: 'Total Units', type: 'integer', width: 'half' },
        { id: 'yearBuilt', label: 'Year Built', type: 'integer', width: 'half' },
        { id: 'lastRenovation', label: 'Last Renovation Year', type: 'integer', width: 'half' },
        { id: 'grossBuildingSF', label: 'Gross Building SF', type: 'integer', width: 'half', tooltip: 'Total gross square footage of all buildings including common areas' },
        { id: 'netRentableSF', label: 'Net Rentable SF', type: 'integer', width: 'half', tooltip: 'Total net rentable square footage across all units' },
        { id: 'numberOfBuildings', label: 'Number of Buildings', type: 'integer', width: 'half', defaultValue: 1 },
        { id: 'stories', label: 'Stories', type: 'integer', width: 'half' },
        { id: 'parkingType', label: 'Parking Type', type: 'select', width: 'half',
          options: [
            { value: 'surface', label: 'Surface' },
            { value: 'garage', label: 'Garage' },
            { value: 'underground', label: 'Underground' },
            { value: 'mixed', label: 'Mixed (Surface + Garage)' },
          ]},
        { id: 'parkingSpaces', label: 'Total Parking Spaces', type: 'integer', width: 'half' },
        { id: 'laundryType', label: 'Laundry Type', type: 'select', width: 'half',
          options: [
            { value: 'in_unit', label: 'In-Unit' },
            { value: 'common_area', label: 'Common Area' },
            { value: 'none', label: 'None' },
          ]},
      ],
    },
    {
      id: 'rent_assumptions',
      label: 'Rent Assumptions',
      icon: 'dollar-sign',
      fields: [
        { id: 'avgMarketRent', label: 'Avg Market Rent / Mo', type: 'currency', width: 'half', tooltip: 'Current market rent for comparable units in the submarket' },
        { id: 'avgInPlaceRent', label: 'Avg In-Place Rent / Mo', type: 'currency', width: 'half', tooltip: 'Weighted average rent currently being collected across all occupied units' },
        { id: 'lossToLease', label: 'Loss-to-Lease %', type: 'percent', width: 'half', tooltip: 'Gap between in-place rents and market rents; indicates rent growth upside' },
        { id: 'vacancyPercent', label: 'Vacancy %', type: 'percent', width: 'half', defaultValue: 5, tooltip: 'Physical vacancy rate including down/model units' },
        { id: 'concessionPercent', label: 'Concessions %', type: 'percent', width: 'half', tooltip: 'Concessions as % of gross potential rent (free rent, reduced deposits)' },
        { id: 'badDebtPercent', label: 'Bad Debt %', type: 'percent', width: 'half', defaultValue: 1, tooltip: 'Uncollectible rent as % of gross potential rent' },
        { id: 'renewalRate', label: 'Renewal Rate %', type: 'percent', width: 'half', defaultValue: 60, tooltip: 'Percentage of tenants who renew at lease expiration' },
        { id: 'avgLeaseTermMonths', label: 'Avg Lease Term (Months)', type: 'integer', width: 'half', defaultValue: 12 },
      ],
    },
    {
      id: 'other_income',
      label: 'Other Income',
      icon: 'layers',
      fields: [
        { id: 'parkingRevenuePerSpace', label: 'Parking Revenue / Space / Mo', type: 'currency', width: 'half', tooltip: 'Monthly revenue per reserved or premium parking space' },
        { id: 'laundryRevenuePerUnit', label: 'Laundry Revenue / Unit / Mo', type: 'currency', width: 'half', tooltip: 'Common-area laundry revenue allocated per unit (if applicable)' },
        { id: 'petFeePerUnit', label: 'Pet Fee / Unit / Mo', type: 'currency', width: 'half', tooltip: 'Average monthly pet rent across pet-owning tenants' },
        { id: 'storageRevenuePerUnit', label: 'Storage Revenue / Unit / Mo', type: 'currency', width: 'half', tooltip: 'Tenant storage locker or closet rental revenue per unit' },
        { id: 'applicationFeePerUnit', label: 'Application Fees / Unit / Year', type: 'currency', width: 'half', tooltip: 'Annual application and admin fee income per unit' },
        { id: 'lateFeeRevenue', label: 'Late Fee Revenue / Year', type: 'currency', width: 'half' },
        { id: 'utilityReimbursementPerUnit', label: 'Utility Reimbursement / Unit / Mo', type: 'currency', width: 'half', tooltip: 'RUBS or sub-metered utility reimbursement per unit' },
        { id: 'trashValet', label: 'Trash Valet / Unit / Mo', type: 'currency', width: 'half', tooltip: 'Door-to-door trash pickup service revenue per unit' },
      ],
    },
    {
      id: 'operating_expenses',
      label: 'Operating Expenses',
      icon: 'receipt',
      fields: [
        { id: 'payrollPerUnit', label: 'Payroll / Unit / Year', type: 'currency', width: 'half', tooltip: 'Total on-site payroll including manager, leasing, maintenance staff per unit' },
        { id: 'repairsMaintPerUnit', label: 'Repairs & Maint / Unit / Year', type: 'currency', width: 'half', tooltip: 'Routine repairs and maintenance per unit; excludes capital items and turnover' },
        { id: 'contractServicesPerUnit', label: 'Contract Services / Unit / Year', type: 'currency', width: 'half', tooltip: 'Third-party contracted services (elevator, fire safety, pest control contracts)' },
        { id: 'turnoverCostPerUnit', label: 'Turnover Cost / Unit', type: 'currency', width: 'half', tooltip: 'Average cost per unit turn including paint, clean, minor repairs' },
        { id: 'makeReadyPerUnit', label: 'Make-Ready Cost / Unit', type: 'currency', width: 'half', tooltip: 'Capital make-ready cost for heavy turns (new flooring, appliances, countertops)' },
        { id: 'waterSewerPerUnit', label: 'Water & Sewer / Unit / Year', type: 'currency', width: 'half' },
        { id: 'electricPerUnit', label: 'Electric (Common) / Unit / Year', type: 'currency', width: 'half', tooltip: 'Landlord-paid common area and exterior electric per unit' },
        { id: 'gasPerUnit', label: 'Gas / Unit / Year', type: 'currency', width: 'half' },
        { id: 'trashRemovalPerUnit', label: 'Trash Removal / Unit / Year', type: 'currency', width: 'half' },
        { id: 'pestControlAnnual', label: 'Pest Control / Year', type: 'currency', width: 'half' },
        { id: 'landscapingAnnual', label: 'Landscaping / Year', type: 'currency', width: 'half' },
        { id: 'snowRemovalAnnual', label: 'Snow Removal / Year', type: 'currency', width: 'half' },
        { id: 'insurancePerUnit', label: 'Insurance / Unit / Year', type: 'currency', width: 'half', tooltip: 'Property, liability, and umbrella insurance per unit' },
        { id: 'propertyTaxAnnual', label: 'Property Tax / Year', type: 'currency', width: 'half' },
        { id: 'managementFeePercent', label: 'Management Fee %', type: 'percent', width: 'half', defaultValue: 5, tooltip: 'Property management fee as % of effective gross income' },
        { id: 'marketingPerUnit', label: 'Marketing / Unit / Year', type: 'currency', width: 'half', tooltip: 'ILS listings, signage, digital advertising, and leasing commissions per unit' },
        { id: 'adminPerUnit', label: 'Admin & General / Unit / Year', type: 'currency', width: 'half', tooltip: 'Office supplies, legal, accounting, and general administrative per unit' },
        { id: 'legalAccountingAnnual', label: 'Legal & Accounting / Year', type: 'currency', width: 'half' },
      ],
    },
    {
      id: 'capital',
      label: 'Capital Reserves',
      icon: 'tool',
      fields: [
        { id: 'capexPerUnit', label: 'CapEx Reserve / Unit / Year', type: 'currency', width: 'half', tooltip: 'Annual capital expenditure reserve per unit for major replacements' },
        { id: 'roofReserve', label: 'Roof Reserve / Year', type: 'currency', width: 'half', tooltip: 'Annual reserve for roof replacement (typically 20-25 year life cycle)' },
        { id: 'hvacReserve', label: 'HVAC Reserve / Year', type: 'currency', width: 'half', tooltip: 'Annual reserve for HVAC system replacement (typically 15-20 year life cycle)' },
        { id: 'applianceReserve', label: 'Appliance Reserve / Year', type: 'currency', width: 'half', tooltip: 'Annual reserve for appliance replacement (refrigerator, range, dishwasher, W/D)' },
        { id: 'flooringReserve', label: 'Flooring Reserve / Year', type: 'currency', width: 'half', tooltip: 'Annual reserve for carpet/vinyl/hardwood replacement (7-10 year cycle)' },
      ],
    },
  ],
  growthCategories: [
    { id: 'rental_revenue', label: 'Rental Revenue Growth', icon: 'trending-up', description: 'Annual rent increases driven by submarket fundamentals, new supply, and wage growth', defaultRate: 3.0,
      subcategories: [
        { id: 'market_rent', label: 'Market Rent Growth', defaultRate: 3.0 },
        { id: 'renewal_rate', label: 'Renewal Increase', defaultRate: 2.5 },
        { id: 'loss_to_lease_burn', label: 'Loss-to-Lease Burn-Off', defaultRate: 1.5 },
      ]},
    { id: 'other_income', label: 'Other Income Growth', icon: 'dollar-sign', description: 'Parking, laundry, pet fees, storage, and utility reimbursement growth', defaultRate: 2.5 },
    { id: 'operating_expenses', label: 'Operating Expense Growth', icon: 'arrow-up', description: 'Controllable OpEx inflation (R&M, contract services, admin, marketing)', defaultRate: 2.5 },
    { id: 'payroll', label: 'Payroll Growth', icon: 'users', description: 'On-site staff wages, leasing commissions, and benefits escalation', defaultRate: 3.0 },
    { id: 'insurance', label: 'Insurance Growth', icon: 'shield', description: 'Property and liability insurance premium increases; catastrophe-exposed markets may trend 8-12%', defaultRate: 5.0 },
    { id: 'property_tax', label: 'Property Tax Growth', icon: 'building', description: 'Tax assessment growth; acquisition may trigger reassessment to purchase price', defaultRate: 2.0 },
    { id: 'utilities', label: 'Utilities Growth', icon: 'zap', description: 'Water, sewer, electric, gas, and trash cost inflation', defaultRate: 3.0 },
    { id: 'capex', label: 'Capital Expenditure Growth', icon: 'tool', description: 'Construction cost and materials inflation impacting capital reserves', defaultRate: 3.5 },
  ],
  kpis: [
    { id: 'purchasePrice', label: 'Purchase Price', field: 'purchasePrice', format: 'currency', icon: 'dollar-sign' },
    { id: 'capRate', label: 'Cap Rate', field: 'year1CapRate', format: 'percent', icon: 'percent' },
    { id: 'totalUnits', label: 'Total Units', field: 'totalStorageUnits', format: 'number', icon: 'home' },
    { id: 'noi', label: 'NOI', field: 'ebitda', format: 'currency', icon: 'trending-up' },
    { id: 'pricePerUnit', label: '$/Unit', field: 'pricePerUnit', format: 'currency', icon: 'dollar-sign' },
    { id: 'avgRent', label: 'Avg Rent / Unit', field: 'avgInPlaceRent', format: 'currency', icon: 'home' },
    { id: 'occupancy', label: 'Occupancy', field: 'occupancyPercent', format: 'percent', icon: 'bar-chart' },
    { id: 'expenseRatio', label: 'Expense Ratio', field: 'expenseRatio', format: 'percent', icon: 'pie-chart' },
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
      { id: 'standard_king', name: 'Standard King', icon: 'home', section: 'Standard', hasSeasons: true, defaultFields: { avgSF: 325, count: 0, beds: 1, baths: 1, maxGuests: 2, rackRate: 189 } },
      { id: 'standard_qq', name: 'Standard Queen/Queen', icon: 'home', section: 'Standard', hasSeasons: true, defaultFields: { avgSF: 340, count: 0, beds: 2, baths: 1, maxGuests: 4, rackRate: 199 } },
      { id: 'deluxe_king', name: 'Deluxe King', icon: 'home', section: 'Premium', hasSeasons: true, defaultFields: { avgSF: 400, count: 0, beds: 1, baths: 1, maxGuests: 2, rackRate: 249 } },
      { id: 'deluxe_dq', name: 'Deluxe Double Queen', icon: 'home', section: 'Premium', hasSeasons: true, defaultFields: { avgSF: 420, count: 0, beds: 2, baths: 1, maxGuests: 4, rackRate: 259 } },
      { id: 'junior_suite', name: 'Junior Suite', icon: 'building', section: 'Suites', hasSeasons: true, defaultFields: { avgSF: 500, count: 0, beds: 1, baths: 1, maxGuests: 2, rackRate: 329 } },
      { id: 'executive_suite', name: 'Executive Suite', icon: 'building', section: 'Suites', hasSeasons: true, defaultFields: { avgSF: 700, count: 0, beds: 1, baths: 1, maxGuests: 3, rackRate: 449 } },
      { id: 'presidential', name: 'Presidential Suite', icon: 'crown', section: 'Premium', hasSeasons: true, defaultFields: { avgSF: 1200, count: 0, beds: 2, baths: 2, maxGuests: 4, rackRate: 899 } },
      { id: 'ada_king', name: 'ADA King', icon: 'users', section: 'Accessible', hasSeasons: true, defaultFields: { avgSF: 375, count: 0, beds: 1, baths: 1, maxGuests: 2, rackRate: 189 } },
      { id: 'ada_double', name: 'ADA Double', icon: 'users', section: 'Accessible', hasSeasons: true, defaultFields: { avgSF: 390, count: 0, beds: 2, baths: 1, maxGuests: 4, rackRate: 199 } },
      { id: 'penthouse', name: 'Penthouse', icon: 'crown', section: 'Premium', hasSeasons: true, defaultFields: { avgSF: 1800, count: 0, beds: 3, baths: 3, maxGuests: 6, rackRate: 1499 } },
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
    // ── 1. Property Overview ──────────────────────────────────
    { id: 'property_overview', label: 'Property Overview', icon: 'building', fields: [
      { id: 'purchasePrice', label: 'Purchase Price', type: 'currency', width: 'half' },
      { id: 'totalKeys', label: 'Total Keys', type: 'integer', width: 'half' },
      { id: 'totalFloors', label: 'Total Floors', type: 'integer', width: 'half' },
      { id: 'yearBuilt', label: 'Year Built', type: 'integer', width: 'half' },
      { id: 'lastRenovation', label: 'Last Renovation Year', type: 'integer', width: 'half' },
      { id: 'starRating', label: 'Star Rating', type: 'select', width: 'half',
        options: [
          { value: '1', label: '1 Star' },
          { value: '2', label: '2 Stars' },
          { value: '3', label: '3 Stars' },
          { value: '4', label: '4 Stars' },
          { value: '5', label: '5 Stars' },
        ]},
      { id: 'flaggedBrand', label: 'Brand / Flag', type: 'select', width: 'half',
        options: [
          { value: 'independent', label: 'Independent' },
          { value: 'marriott', label: 'Marriott' },
          { value: 'hilton', label: 'Hilton' },
          { value: 'ihg', label: 'IHG' },
          { value: 'hyatt', label: 'Hyatt' },
          { value: 'wyndham', label: 'Wyndham' },
          { value: 'choice', label: 'Choice Hotels' },
          { value: 'bw', label: 'Best Western' },
          { value: 'other', label: 'Other' },
        ]},
      { id: 'managementType', label: 'Management Type', type: 'select', width: 'half',
        options: [
          { value: 'self_managed', label: 'Self-Managed' },
          { value: 'third_party', label: 'Third-Party Management' },
          { value: 'franchise', label: 'Franchise' },
        ]},
      { id: 'holdPeriod', label: 'Hold Period (Years)', type: 'integer', width: 'half', defaultValue: 5 },
    ]},
    // ── 2. Revenue Modeling ───────────────────────────────────
    { id: 'revenue_modeling', label: 'Revenue Modeling', icon: 'dollar-sign', fields: [
      { id: 'avgDailyRate', label: 'Average Daily Rate (ADR)', type: 'currency', width: 'half' },
      { id: 'occupancyPercent', label: 'Stabilized Occupancy %', type: 'percent', width: 'half', defaultValue: 72 },
      { id: 'revPAR', label: 'RevPAR (calculated)', type: 'currency', width: 'half', tooltip: 'Revenue per Available Room — ADR x Occupancy' },
      { id: 'foodBevRevenuePercent', label: 'F&B Revenue (% of Rooms Rev)', type: 'percent', width: 'half', defaultValue: 35, tooltip: 'Food & beverage revenue as a percentage of total rooms revenue' },
      { id: 'meetingEventRevenue', label: 'Meeting & Event Revenue (Annual)', type: 'currency', width: 'half' },
      { id: 'spaWellnessRevenue', label: 'Spa & Wellness Revenue (Annual)', type: 'currency', width: 'half' },
      { id: 'parkingRevenuePerSpace', label: 'Parking Revenue / Space / Month', type: 'currency', width: 'half' },
      { id: 'golfRevenue', label: 'Golf Revenue (Annual)', type: 'currency', width: 'half' },
      { id: 'retailRevenue', label: 'Retail Revenue (Annual)', type: 'currency', width: 'half' },
      { id: 'otherOperatedRevenue', label: 'Other Operated Revenue (Annual)', type: 'currency', width: 'half' },
    ]},
    // ── 3. Departmental Expenses ──────────────────────────────
    { id: 'departmental_expenses', label: 'Departmental Expenses', icon: 'receipt', fields: [
      { id: 'roomsExpensePercent', label: 'Rooms Expense (% of Rooms Rev)', type: 'percent', width: 'half', defaultValue: 25, tooltip: 'Direct rooms department expense as % of rooms revenue; includes housekeeping, front desk, laundry' },
      { id: 'fbExpensePercent', label: 'F&B Expense (% of F&B Rev)', type: 'percent', width: 'half', defaultValue: 70, tooltip: 'F&B department cost including food cost, labor, and supplies' },
      { id: 'spaExpensePercent', label: 'Spa Expense (% of Spa Rev)', type: 'percent', width: 'half', defaultValue: 65, tooltip: 'Spa department expenses including therapists, products, and supplies' },
      { id: 'meetingExpensePercent', label: 'Meeting Expense (% of Meeting Rev)', type: 'percent', width: 'half', defaultValue: 50, tooltip: 'Meeting & events department direct costs' },
      { id: 'parkingExpensePercent', label: 'Parking Expense (% of Parking Rev)', type: 'percent', width: 'half', defaultValue: 30, tooltip: 'Parking operations direct costs including valet labor' },
      { id: 'golfExpensePercent', label: 'Golf Expense (% of Golf Rev)', type: 'percent', width: 'half', defaultValue: 75, tooltip: 'Golf operations including course maintenance, pro shop, and staff' },
    ]},
    // ── 4. Undistributed Expenses ─────────────────────────────
    { id: 'undistributed_expenses', label: 'Undistributed Expenses', icon: 'layers', fields: [
      { id: 'adminGeneralPercent', label: 'Admin & General (% of Total Rev)', type: 'percent', width: 'half', defaultValue: 7, tooltip: 'Administrative and general expenses — accounting, HR, legal, IT' },
      { id: 'marketingPercent', label: 'Sales & Marketing (% of Total Rev)', type: 'percent', width: 'half', defaultValue: 5, tooltip: 'Sales team, advertising, loyalty programs, OTA commissions' },
      { id: 'propertyOpsMaintPercent', label: 'Property Ops & Maint (% of Total Rev)', type: 'percent', width: 'half', defaultValue: 5, tooltip: 'Engineering, preventive maintenance, grounds' },
      { id: 'utilitiesPercent', label: 'Utilities (% of Total Rev)', type: 'percent', width: 'half', defaultValue: 4, tooltip: 'Electric, gas, water, sewer' },
      { id: 'technologyPercent', label: 'Technology (% of Total Rev)', type: 'percent', width: 'half', defaultValue: 2, tooltip: 'PMS, CRS, POS, WiFi infrastructure, cybersecurity' },
      { id: 'managementFeePercent', label: 'Management Fee (% of Total Rev)', type: 'percent', width: 'half', defaultValue: 3, tooltip: 'Third-party or brand management fee' },
    ]},
    // ── 5. Fixed Charges ──────────────────────────────────────
    { id: 'fixed_charges', label: 'Fixed Charges', icon: 'lock', fields: [
      { id: 'propertyTaxAnnual', label: 'Property Tax (Annual)', type: 'currency', width: 'half' },
      { id: 'insuranceAnnual', label: 'Insurance (Annual)', type: 'currency', width: 'half' },
      { id: 'groundLeaseAnnual', label: 'Ground Lease (Annual)', type: 'currency', width: 'half' },
      { id: 'ffAndEReservePercent', label: 'FF&E Reserve (%)', type: 'percent', width: 'half', defaultValue: 4, tooltip: 'Furniture, Fixtures & Equipment reserve — industry standard 4-5% of total revenue' },
    ]},
  ],
  growthCategories: [
    { id: 'adr_growth', label: 'ADR Growth', icon: 'trending-up', description: 'Average daily rate annual escalation', defaultRate: 3.0 },
    { id: 'occupancy_improvement', label: 'Occupancy Improvement', icon: 'bar-chart', description: 'Year-over-year occupancy gain toward stabilization', defaultRate: 1.0 },
    { id: 'fb_revenue', label: 'F&B Revenue Growth', icon: 'utensils', description: 'Food & beverage revenue growth', defaultRate: 2.5 },
    { id: 'ancillary_revenue', label: 'Ancillary Revenue Growth', icon: 'dollar-sign', description: 'Spa, parking, golf, retail, meetings', defaultRate: 2.0 },
    { id: 'departmental_expenses', label: 'Departmental Expense Growth', icon: 'arrow-up', description: 'Labor and departmental cost increases', defaultRate: 3.0 },
    { id: 'undistributed_expenses', label: 'Undistributed Expense Growth', icon: 'arrow-up', description: 'A&G, S&M, POM, utilities, tech', defaultRate: 2.5 },
    { id: 'insurance', label: 'Insurance Growth', icon: 'shield', description: 'Property insurance premium increases', defaultRate: 5.0 },
    { id: 'property_tax', label: 'Property Tax Growth', icon: 'building', description: 'Real estate tax assessment growth', defaultRate: 2.0 },
    { id: 'capex', label: 'CapEx / FF&E Growth', icon: 'wrench', description: 'Capital expenditure and FF&E reserve escalation', defaultRate: 2.0 },
  ],
  kpis: [
    { id: 'purchasePrice', label: 'Purchase Price', field: 'purchasePrice', format: 'currency', icon: 'dollar-sign' },
    { id: 'pricePerKey', label: '$/Key', field: 'pricePerUnit', format: 'currency', icon: 'dollar-sign' },
    { id: 'adr', label: 'ADR', field: 'avgDailyRate', format: 'currency', icon: 'dollar-sign' },
    { id: 'occupancy', label: 'Occupancy', field: 'occupancyPercent', format: 'percent', icon: 'bar-chart' },
    { id: 'revpar', label: 'RevPAR', field: 'revPAR', format: 'currency', icon: 'bar-chart' },
    { id: 'noi', label: 'NOI', field: 'ebitda', format: 'currency', icon: 'trending-up' },
    { id: 'ebitdaMultiple', label: 'EBITDA Multiple', field: 'ebitdaMultiple', format: 'multiple', icon: 'x' },
    { id: 'totalRevenue', label: 'Total Revenue', field: 'totalRevenue', format: 'currency', icon: 'dollar-sign' },
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
      { id: 'studio', name: 'Studio', icon: 'home', section: 'Standard', hasSeasons: true, defaultFields: { avgSF: 450, count: 0, beds: 0, baths: 1, maxGuests: 2, avgNightlyRate: 120, cleaningFee: 75 } },
      { id: '1br_1ba', name: '1 Bed / 1 Bath', icon: 'home', section: 'Standard', hasSeasons: true, defaultFields: { avgSF: 650, count: 0, beds: 1, baths: 1, maxGuests: 3, avgNightlyRate: 150, cleaningFee: 95 } },
      { id: '2br_1ba', name: '2 Bed / 1 Bath', icon: 'home', section: 'Standard', hasSeasons: true, defaultFields: { avgSF: 900, count: 0, beds: 2, baths: 1, maxGuests: 5, avgNightlyRate: 195, cleaningFee: 120 } },
      { id: '2br_2ba', name: '2 Bed / 2 Bath', icon: 'home', section: 'Standard', hasSeasons: true, defaultFields: { avgSF: 1000, count: 0, beds: 2, baths: 2, maxGuests: 6, avgNightlyRate: 225, cleaningFee: 135 } },
      { id: '2br_1half', name: '2 Bed / 1.5 Bath', icon: 'home', section: 'Standard', hasSeasons: true, defaultFields: { avgSF: 950, count: 0, beds: 2, baths: 1.5, maxGuests: 5, avgNightlyRate: 210, cleaningFee: 125 } },
      { id: '3br_2ba', name: '3 Bed / 2 Bath', icon: 'home', section: 'Larger', hasSeasons: true, defaultFields: { avgSF: 1200, count: 0, beds: 3, baths: 2, maxGuests: 8, avgNightlyRate: 295, cleaningFee: 165 } },
      { id: '3br_2half', name: '3 Bed / 2.5 Bath', icon: 'home', section: 'Larger', hasSeasons: true, defaultFields: { avgSF: 1300, count: 0, beds: 3, baths: 2.5, maxGuests: 8, avgNightlyRate: 325, cleaningFee: 175 } },
      { id: '3br_3ba', name: '3 Bed / 3 Bath', icon: 'home', section: 'Larger', hasSeasons: true, defaultFields: { avgSF: 1400, count: 0, beds: 3, baths: 3, maxGuests: 9, avgNightlyRate: 350, cleaningFee: 185 } },
      { id: '4br_2ba', name: '4 Bed / 2 Bath', icon: 'home', section: 'Large', hasSeasons: true, defaultFields: { avgSF: 1600, count: 0, beds: 4, baths: 2, maxGuests: 10, avgNightlyRate: 395, cleaningFee: 200 } },
      { id: '4br_2half', name: '4 Bed / 2.5 Bath', icon: 'home', section: 'Large', hasSeasons: true, defaultFields: { avgSF: 1700, count: 0, beds: 4, baths: 2.5, maxGuests: 10, avgNightlyRate: 425, cleaningFee: 215 } },
      { id: '4br_3half', name: '4 Bed / 3.5 Bath', icon: 'home', section: 'Large', hasSeasons: true, defaultFields: { avgSF: 1900, count: 0, beds: 4, baths: 3.5, maxGuests: 12, avgNightlyRate: 475, cleaningFee: 235 } },
      { id: '4br_3ba', name: '4 Bed / 3 Bath', icon: 'home', section: 'Large', hasSeasons: true, defaultFields: { avgSF: 1800, count: 0, beds: 4, baths: 3, maxGuests: 11, avgNightlyRate: 450, cleaningFee: 225 } },
      { id: '5br_plus', name: '5+ Bed', icon: 'home', section: 'Large', hasSeasons: true, defaultFields: { avgSF: 2200, count: 0, beds: 5, baths: 4, maxGuests: 14, avgNightlyRate: 595, cleaningFee: 295 } },
      { id: 'custom', name: 'Custom Layout', icon: 'edit', section: 'Custom', hasSeasons: true, defaultFields: { avgSF: 0, count: 0, beds: 0, baths: 0, maxGuests: 0, avgNightlyRate: 0, cleaningFee: 0 } },
    ],
  },
  profitCenters: {
    tabLabel: 'Revenue Streams',
    showTab: false,   // STR revenue is modeled inline
    departments: [],
  },
  inputSections: [
    // ── 1. Property Details ───────────────────────────────────
    { id: 'property_details', label: 'Property Details', icon: 'home', fields: [
      { id: 'purchasePrice', label: 'Purchase Price', type: 'currency', width: 'half' },
      { id: 'closingDate', label: 'Closing Date', type: 'text', width: 'half' },
      { id: 'holdPeriod', label: 'Hold Period (Years)', type: 'integer', width: 'half', defaultValue: 5 },
      { id: 'propertyType', label: 'Property Type', type: 'select', width: 'half',
        options: [
          { value: 'single_family', label: 'Single Family' },
          { value: 'condo', label: 'Condo' },
          { value: 'townhouse', label: 'Townhouse' },
          { value: 'cabin', label: 'Cabin' },
          { value: 'villa', label: 'Villa' },
          { value: 'apartment', label: 'Apartment' },
          { value: 'unique', label: 'Unique (A-Frame, Treehouse, etc.)' },
        ]},
      { id: 'totalBedrooms', label: 'Total Bedrooms', type: 'integer', width: 'half' },
      { id: 'totalBathrooms', label: 'Total Bathrooms', type: 'number', width: 'half' },
      { id: 'maxGuestCapacity', label: 'Max Guest Capacity', type: 'integer', width: 'half' },
      { id: 'totalSqFt', label: 'Total Sq Ft', type: 'number', width: 'half' },
      { id: 'parkingSpaces', label: 'Parking Spaces', type: 'integer', width: 'half' },
      { id: 'hasPool', label: 'Pool', type: 'select', width: 'third',
        options: [{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }] },
      { id: 'hasHotTub', label: 'Hot Tub', type: 'select', width: 'third',
        options: [{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }] },
      { id: 'petFriendly', label: 'Pet Friendly', type: 'select', width: 'third',
        options: [{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }] },
    ]},
    // ── 2. Revenue Modeling ───────────────────────────────────
    { id: 'revenue_modeling', label: 'Revenue Modeling', icon: 'dollar-sign', fields: [
      { id: 'revenueModelType', label: 'Revenue Model', type: 'select', width: 'half',
        options: [
          { value: 'per_unit_adr', label: 'Per-Unit ADR (Multi-Unit)' },
          { value: 'blended_adr', label: 'Blended ADR (Single Unit)' },
        ]},
      { id: 'avgNightlyRate', label: 'Avg Nightly Rate (Blended ADR)', type: 'currency', width: 'half' },
      { id: 'peakSeasonADR', label: 'Peak Season ADR', type: 'currency', width: 'half' },
      { id: 'shoulderSeasonADR', label: 'Shoulder Season ADR', type: 'currency', width: 'half' },
      { id: 'offSeasonADR', label: 'Off-Season ADR', type: 'currency', width: 'half' },
      { id: 'avgOccupancyPercent', label: 'Avg Occupancy %', type: 'percent', width: 'half', defaultValue: 65 },
      { id: 'peakOccupancyPercent', label: 'Peak Occupancy %', type: 'percent', width: 'half', defaultValue: 85 },
      { id: 'shoulderOccupancyPercent', label: 'Shoulder Occupancy %', type: 'percent', width: 'half', defaultValue: 60 },
      { id: 'offSeasonOccupancyPercent', label: 'Off-Season Occupancy %', type: 'percent', width: 'half', defaultValue: 35 },
      { id: 'avgStayLengthNights', label: 'Avg Stay Length (Nights)', type: 'number', width: 'half', defaultValue: 3.5 },
      { id: 'turnoversPerMonth', label: 'Turnovers / Month', type: 'number', width: 'half', tooltip: 'Calculated from occupancy / avg stay length' },
    ]},
    // ── 3. Guest Fees & Ancillary ─────────────────────────────
    { id: 'guest_fees', label: 'Guest Fees & Ancillary', icon: 'tag', fields: [
      { id: 'cleaningFeePerTurnover', label: 'Cleaning Fee / Turnover', type: 'currency', width: 'half' },
      { id: 'petFeePerStay', label: 'Pet Fee / Stay', type: 'currency', width: 'half' },
      { id: 'extraGuestFeePerNight', label: 'Extra Guest Fee / Night', type: 'currency', width: 'half' },
      { id: 'earlyCheckinFee', label: 'Early Check-In Fee', type: 'currency', width: 'half' },
      { id: 'lateCheckoutFee', label: 'Late Checkout Fee', type: 'currency', width: 'half' },
      { id: 'parkingFeePerNight', label: 'Parking Fee / Night', type: 'currency', width: 'half' },
      { id: 'damageWaiverFee', label: 'Damage Waiver Fee', type: 'currency', width: 'half' },
      { id: 'experienceAddonRevenue', label: 'Experience Add-On Revenue', type: 'currency', width: 'half', tooltip: 'Tours, rentals, guidebooks, etc.' },
    ]},
    // ── 4. Platform & Distribution ────────────────────────────
    { id: 'platform_distribution', label: 'Platform & Distribution', icon: 'globe', fields: [
      { id: 'airbnbBookingPercent', label: 'Airbnb Booking %', type: 'percent', width: 'half', defaultValue: 50 },
      { id: 'vrboBookingPercent', label: 'VRBO Booking %', type: 'percent', width: 'half', defaultValue: 25 },
      { id: 'directBookingPercent', label: 'Direct Booking %', type: 'percent', width: 'half', defaultValue: 15 },
      { id: 'otherOtaPercent', label: 'Other OTA %', type: 'percent', width: 'half', defaultValue: 10 },
      { id: 'airbnbHostFeePercent', label: 'Airbnb Host Fee %', type: 'percent', width: 'half', defaultValue: 3 },
      { id: 'vrboHostFeePercent', label: 'VRBO Host Fee %', type: 'percent', width: 'half', defaultValue: 5 },
      { id: 'directBookingCostPercent', label: 'Direct Booking Cost %', type: 'percent', width: 'half', defaultValue: 1, tooltip: 'Website + payment processing' },
      { id: 'paymentProcessingPercent', label: 'Payment Processing %', type: 'percent', width: 'half', defaultValue: 2.9 },
    ]},
    // ── 5. Turnover & Operating Costs ─────────────────────────
    { id: 'turnover_costs', label: 'Turnover & Operating Costs', icon: 'refresh-cw', fields: [
      { id: 'cleaningCostPerTurn', label: 'Cleaning Cost / Turn', type: 'currency', width: 'half' },
      { id: 'laundryPerTurn', label: 'Laundry / Turn', type: 'currency', width: 'half' },
      { id: 'consumablesPerTurn', label: 'Consumables / Turn', type: 'currency', width: 'half', tooltip: 'Toiletries, coffee, snacks' },
      { id: 'inspectionCostPerTurn', label: 'Inspection Cost / Turn', type: 'currency', width: 'half' },
      { id: 'avgTurnsPerMonth', label: 'Avg Turns / Month', type: 'number', width: 'half', tooltip: 'Auto-calculated or manual override' },
    ]},
    // ── 6. Fixed Operating Expenses ───────────────────────────
    { id: 'fixed_expenses', label: 'Fixed Operating Expenses', icon: 'receipt', fields: [
      { id: 'pmsFeePerMonth', label: 'PMS Fee / Month', type: 'currency', width: 'half', tooltip: 'Guesty, Hospitable, OwnerRez, etc.' },
      { id: 'channelManagerPerMonth', label: 'Channel Manager / Month', type: 'currency', width: 'half' },
      { id: 'smartLockPerMonth', label: 'Smart Lock / Month', type: 'currency', width: 'half' },
      { id: 'securityCamerasPerMonth', label: 'Security Cameras / Month', type: 'currency', width: 'half' },
      { id: 'wifiPerMonth', label: 'WiFi / Month', type: 'currency', width: 'half' },
      { id: 'streamingServicesPerMonth', label: 'Streaming Services / Month', type: 'currency', width: 'half' },
      { id: 'utilitiesPerMonth', label: 'Utilities / Month', type: 'currency', width: 'half' },
      { id: 'lawnPoolPerMonth', label: 'Lawn & Pool / Month', type: 'currency', width: 'half' },
      { id: 'pestControlPerMonth', label: 'Pest Control / Month', type: 'currency', width: 'half' },
      { id: 'insuranceAnnual', label: 'Insurance (Annual)', type: 'currency', width: 'half' },
      { id: 'propertyTaxAnnual', label: 'Property Tax (Annual)', type: 'currency', width: 'half' },
      { id: 'hoaCondoMonthly', label: 'HOA / Condo Fees (Monthly)', type: 'currency', width: 'half' },
      { id: 'repairsMaintAnnual', label: 'Repairs & Maint (Annual)', type: 'currency', width: 'half' },
      { id: 'furnishingReservePercent', label: 'Furnishing Reserve %', type: 'percent', width: 'half', defaultValue: 5, tooltip: '% of revenue for furniture replacement' },
      { id: 'capexReservePercent', label: 'CapEx Reserve %', type: 'percent', width: 'half', defaultValue: 5 },
    ]},
    // ── 7. Financing ──────────────────────────────────────────
    { id: 'financing', label: 'Financing', icon: 'landmark', fields: [
      { id: 'downPaymentPercent', label: 'Down Payment %', type: 'percent', width: 'half', defaultValue: 25 },
      { id: 'interestRate', label: 'Interest Rate %', type: 'percent', width: 'half' },
      { id: 'loanTermYears', label: 'Loan Term (Years)', type: 'integer', width: 'half', defaultValue: 30 },
      { id: 'closingCostsPercent', label: 'Closing Costs %', type: 'percent', width: 'half', defaultValue: 3 },
    ]},
  ],
  growthCategories: [
    { id: 'nightly_rate', label: 'ADR Growth', icon: 'trending-up', description: 'Average nightly rate annual escalation', defaultRate: 3.0 },
    { id: 'occupancy_improvement', label: 'Occupancy Improvement', icon: 'bar-chart', description: 'Year-over-year occupancy gain', defaultRate: 1.0 },
    { id: 'cleaning_fees', label: 'Cleaning Fee Growth', icon: 'home', description: 'Per-turn cleaning fee and cost increases', defaultRate: 2.5 },
    { id: 'platform_fees', label: 'Platform Fee Growth', icon: 'globe', description: 'OTA and payment processing fee changes', defaultRate: 1.0 },
    { id: 'operating_expenses', label: 'Operating Expense Growth', icon: 'arrow-up', description: 'General operating cost inflation', defaultRate: 2.5 },
    { id: 'insurance', label: 'Insurance Growth', icon: 'shield', description: 'Property insurance premium increases', defaultRate: 5.0 },
    { id: 'property_tax', label: 'Property Tax Growth', icon: 'building', description: 'Annual property tax assessment increases', defaultRate: 2.0 },
    { id: 'utilities', label: 'Utilities Growth', icon: 'zap', description: 'Utility cost inflation (electric, gas, water)', defaultRate: 3.0 },
    { id: 'furnishing', label: 'Furnishing/CapEx Growth', icon: 'wrench', description: 'Furniture replacement and capital reserve escalation', defaultRate: 2.0 },
  ],
  kpis: [
    { id: 'purchasePrice', label: 'Purchase Price', field: 'purchasePrice', format: 'currency', icon: 'dollar-sign' },
    { id: 'grm', label: 'GRM', field: 'grm', format: 'multiple', icon: 'x' },
    { id: 'avgADR', label: 'Avg ADR', field: 'avgNightlyRate', format: 'currency', icon: 'dollar-sign' },
    { id: 'occupancy', label: 'Occupancy', field: 'avgOccupancyPercent', format: 'percent', icon: 'bar-chart' },
    { id: 'revPAR', label: 'RevPAR', field: 'revPAR', format: 'currency', icon: 'bar-chart' },
    { id: 'noi', label: 'NOI', field: 'ebitda', format: 'currency', icon: 'trending-up' },
    { id: 'cashOnCash', label: 'Cash-on-Cash', field: 'cashOnCash', format: 'percent', icon: 'percent' },
    { id: 'totalAncillaryRevenue', label: 'Ancillary Revenue', field: 'totalAncillaryRevenue', format: 'currency', icon: 'dollar-sign' },
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
    {
      id: 'property_details',
      label: 'Property Details',
      icon: 'store',
      fields: [
        { id: 'purchasePrice', label: 'Purchase Price', type: 'currency', width: 'half' },
        { id: 'totalGLA', label: 'Total GLA (SF)', type: 'integer', width: 'half', tooltip: 'Total gross leasable area in square feet' },
        { id: 'numberOfSuites', label: 'Number of Suites', type: 'integer', width: 'half' },
        { id: 'yearBuilt', label: 'Year Built', type: 'integer', width: 'half' },
        { id: 'yearRenovated', label: 'Year Renovated', type: 'integer', width: 'half' },
        { id: 'lotSizeAcres', label: 'Lot Size (Acres)', type: 'number', width: 'half' },
        { id: 'parkingSpaces', label: 'Total Parking Spaces', type: 'integer', width: 'half' },
        { id: 'parkingRatio', label: 'Parking Ratio (spaces / 1,000 SF)', type: 'number', width: 'half', tooltip: 'Parking spaces per 1,000 SF of GLA; retail typically requires 4-5 per 1,000 SF' },
        { id: 'retailType', label: 'Retail Property Type', type: 'select', width: 'half',
          options: [
            { value: 'strip_center', label: 'Strip Center' },
            { value: 'neighborhood_center', label: 'Neighborhood Center' },
            { value: 'community_center', label: 'Community Center' },
            { value: 'power_center', label: 'Power Center' },
            { value: 'single_tenant_nnn', label: 'Single-Tenant NNN' },
            { value: 'lifestyle_center', label: 'Lifestyle Center' },
          ]},
        { id: 'anchorTenant', label: 'Anchor Tenant', type: 'text', width: 'half', placeholder: 'e.g. Kroger, Walgreens, Dollar General' },
        { id: 'anchorPercentGLA', label: 'Anchor % of GLA', type: 'percent', width: 'half', tooltip: 'Percentage of total GLA occupied by anchor tenant(s)' },
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
            { value: 'gross', label: 'Full-Service Gross' },
          ]},
        { id: 'avgBaseRentPerSF', label: 'Avg Base Rent / SF / Year', type: 'currency', width: 'half', tooltip: 'Weighted average base rent per SF across all tenants' },
        { id: 'avgLeaseTermYears', label: 'Avg Lease Term (Years)', type: 'number', width: 'half', defaultValue: 5 },
        { id: 'walt', label: 'WALT (Years)', type: 'number', width: 'half', tooltip: 'Weighted Average Lease Term remaining across all tenants' },
        { id: 'annualEscalation', label: 'Annual Escalation %', type: 'percent', width: 'half', defaultValue: 3, tooltip: 'Contractual annual rent bumps; retail typically 2-3% fixed or CPI-based' },
        { id: 'renewalProbability', label: 'Renewal Probability %', type: 'percent', width: 'half', defaultValue: 70, tooltip: 'Probability existing tenants renew at expiration' },
        { id: 'percentageRentThreshold', label: 'Percentage Rent Breakpoint', type: 'currency', width: 'half', tooltip: 'Natural breakpoint above which percentage rent applies (retail-specific)' },
        { id: 'percentageRentRate', label: 'Percentage Rent Rate %', type: 'percent', width: 'half', defaultValue: 5, tooltip: 'Percentage of gross sales above breakpoint paid as additional rent' },
      ],
    },
    {
      id: 'vacancy_leasing',
      label: 'Vacancy & Leasing Costs',
      icon: 'percent',
      fields: [
        { id: 'economicVacancy', label: 'Economic Vacancy %', type: 'percent', width: 'half', defaultValue: 5, tooltip: 'Blended vacancy across anchor and inline spaces' },
        { id: 'creditLossPercent', label: 'Credit Loss %', type: 'percent', width: 'half', defaultValue: 1, tooltip: 'Uncollectible rent as % of base rent' },
        { id: 'tiAllowancePerSF', label: 'TI Allowance / SF (New)', type: 'currency', width: 'half', tooltip: 'Tenant improvement allowance for new leases; varies widely by tenant type' },
        { id: 'tiAllowanceRenewalPerSF', label: 'TI Allowance / SF (Renewal)', type: 'currency', width: 'half' },
        { id: 'lcPercentNewLease', label: 'LC % (New Lease)', type: 'percent', width: 'half', defaultValue: 6 },
        { id: 'lcPercentRenewal', label: 'LC % (Renewal)', type: 'percent', width: 'half', defaultValue: 3 },
        { id: 'freeRentMonthsNew', label: 'Free Rent (Months, New)', type: 'number', width: 'half', defaultValue: 2 },
        { id: 'downtimeMonths', label: 'Avg Downtime Between Tenants (Months)', type: 'number', width: 'half', defaultValue: 6 },
      ],
    },
    {
      id: 'operating_expenses',
      label: 'Operating Expenses',
      icon: 'receipt',
      fields: [
        { id: 'camPerSF', label: 'CAM / SF', type: 'currency', width: 'half', tooltip: 'Common area maintenance cost per SF including landscaping, parking lot, snow, security' },
        { id: 'managementFeePercent', label: 'Management Fee %', type: 'percent', width: 'half', defaultValue: 5 },
        { id: 'insurancePerSF', label: 'Insurance / SF', type: 'currency', width: 'half' },
        { id: 'propertyTaxPerSF', label: 'Property Tax / SF', type: 'currency', width: 'half' },
        { id: 'utilitiesPerSF', label: 'Landlord Utilities / SF', type: 'currency', width: 'half', tooltip: 'Landlord-paid common area utilities (lighting, HVAC common areas, irrigation)' },
        { id: 'repairsPerSF', label: 'R&M / SF', type: 'currency', width: 'half' },
        { id: 'parkingLotMaintPerSF', label: 'Parking Lot Maint / SF', type: 'currency', width: 'half', tooltip: 'Parking lot sweeping, striping, seal coat, and lighting maintenance' },
        { id: 'landscapingAnnual', label: 'Landscaping / Year', type: 'currency', width: 'half' },
        { id: 'snowRemovalAnnual', label: 'Snow Removal / Year', type: 'currency', width: 'half' },
        { id: 'securityAnnual', label: 'Security / Year', type: 'currency', width: 'half' },
        { id: 'adminAnnual', label: 'Admin & Accounting / Year', type: 'currency', width: 'half' },
        { id: 'capexReservePerSF', label: 'CapEx Reserve / SF', type: 'currency', width: 'half', tooltip: 'Annual capital reserve per SF for roof, HVAC, parking lot, and structural items' },
      ],
    },
  ],
  growthCategories: [
    { id: 'base_rent', label: 'Base Rent Growth', icon: 'trending-up', description: 'Market rental rate growth for new and renewal leases; driven by consumer spending and retailer demand', defaultRate: 3.0 },
    { id: 'percentage_rent', label: 'Percentage Rent Growth', icon: 'dollar-sign', description: 'Growth in tenant sales above percentage rent breakpoints', defaultRate: 2.0 },
    { id: 'cam_recovery', label: 'CAM Recovery Growth', icon: 'dollar-sign', description: 'Common area cost pass-through growth tracking actual operating cost increases', defaultRate: 2.5 },
    { id: 'operating_expenses', label: 'Operating Expense Growth', icon: 'arrow-up', description: 'Controllable OpEx including landscaping, R&M, security, and management', defaultRate: 2.5 },
    { id: 'insurance', label: 'Insurance Growth', icon: 'shield', description: 'Property and liability insurance premium escalation', defaultRate: 5.0 },
    { id: 'property_tax', label: 'Property Tax Growth', icon: 'building', description: 'Real estate tax assessment growth; acquisition may trigger reassessment', defaultRate: 2.0 },
    { id: 'utilities', label: 'Utilities Growth', icon: 'zap', description: 'Common area utility cost inflation', defaultRate: 3.0 },
  ],
  kpis: [
    { id: 'purchasePrice', label: 'Purchase Price', field: 'purchasePrice', format: 'currency', icon: 'dollar-sign' },
    { id: 'capRate', label: 'Cap Rate', field: 'year1CapRate', format: 'percent', icon: 'percent' },
    { id: 'totalSF', label: 'Total GLA', field: 'totalStorageUnits', format: 'number', icon: 'ruler' },
    { id: 'noi', label: 'NOI', field: 'ebitda', format: 'currency', icon: 'trending-up' },
    { id: 'pricePerSF', label: '$/SF', field: 'pricePerUnit', format: 'currency', icon: 'dollar-sign' },
    { id: 'occupancy', label: 'Occupancy', field: 'avgOccupancy', format: 'percent', icon: 'bar-chart' },
    { id: 'walt', label: 'WALT', field: 'walt', format: 'number', icon: 'clock' },
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
    {
      id: 'property_details',
      label: 'Property Details',
      icon: 'warehouse',
      fields: [
        { id: 'purchasePrice', label: 'Purchase Price', type: 'currency', width: 'half' },
        { id: 'totalUnits', label: 'Total Units', type: 'integer', width: 'half' },
        { id: 'totalNetRentableSF', label: 'Total Net Rentable SF', type: 'integer', width: 'half', tooltip: 'Sum of all unit interior square footage' },
        { id: 'numberOfBuildings', label: 'Number of Buildings', type: 'integer', width: 'half', defaultValue: 1 },
        { id: 'climateControlledPercent', label: 'Climate-Controlled %', type: 'percent', width: 'half', tooltip: 'Percentage of total SF that is climate-controlled; commands 25-50% rent premium' },
        { id: 'yearBuilt', label: 'Year Built', type: 'integer', width: 'half' },
        { id: 'gateSystem', label: 'Gate / Access System', type: 'select', width: 'half',
          options: [
            { value: 'keypad', label: 'Keypad' },
            { value: 'smart', label: 'Smart (Bluetooth/App)' },
            { value: 'none', label: 'None' },
          ]},
        { id: 'securityCameras', label: 'Security Cameras', type: 'select', width: 'half',
          options: [
            { value: 'yes', label: 'Yes' },
            { value: 'no', label: 'No' },
          ]},
      ],
    },
    {
      id: 'revenue',
      label: 'Revenue Assumptions',
      icon: 'dollar-sign',
      fields: [
        { id: 'avgMonthlyRentPerSF', label: 'Avg Monthly Rent / SF', type: 'currency', width: 'half', tooltip: 'Blended average monthly rent per rentable SF across all unit types' },
        { id: 'economicOccupancy', label: 'Economic Occupancy %', type: 'percent', width: 'half', defaultValue: 88, tooltip: 'Revenue collected as % of gross potential rent; accounts for vacancy, concessions, and bad debt' },
        { id: 'physicalOccupancy', label: 'Physical Occupancy %', type: 'percent', width: 'half', tooltip: 'Percentage of units physically occupied' },
        { id: 'lateFeesPercent', label: 'Late Fees % of Revenue', type: 'percent', width: 'half', defaultValue: 3, tooltip: 'Late fees as a percentage of rental revenue' },
        { id: 'adminFeePerMoveIn', label: 'Admin Fee / Move-In', type: 'currency', width: 'half', tooltip: 'One-time administration or reservation fee charged at move-in' },
        { id: 'tenantInsurancePercent', label: 'Tenant Insurance Penetration %', type: 'percent', width: 'half', defaultValue: 35, tooltip: 'Percentage of tenants purchasing tenant protection/insurance plan' },
        { id: 'insuranceRevenuePerPolicy', label: 'Insurance Revenue / Policy / Mo', type: 'currency', width: 'half', tooltip: 'Monthly revenue per tenant insurance policy' },
        { id: 'merchandiseRevenueAnnual', label: 'Merchandise Revenue / Year', type: 'currency', width: 'half', tooltip: 'Annual revenue from boxes, locks, packing supplies, and other retail items' },
        { id: 'truckRentalRevenueAnnual', label: 'Truck Rental Revenue / Year', type: 'currency', width: 'half', tooltip: 'Annual revenue from moving truck rental commissions' },
        { id: 'retailSalesAnnual', label: 'Other Retail Sales / Year', type: 'currency', width: 'half' },
      ],
    },
    {
      id: 'expenses',
      label: 'Operating Expenses',
      icon: 'receipt',
      fields: [
        { id: 'onsiteManagerSalary', label: 'On-Site Manager Salary / Year', type: 'currency', width: 'half', tooltip: 'Annual salary for on-site facility manager' },
        { id: 'partTimeStaffCost', label: 'Part-Time Staff / Year', type: 'currency', width: 'half' },
        { id: 'payrollTaxBenefitsPercent', label: 'Payroll Tax & Benefits %', type: 'percent', width: 'half', defaultValue: 20, tooltip: 'Payroll taxes and benefits as % of gross wages' },
        { id: 'managementFeePercent', label: 'Management Fee %', type: 'percent', width: 'half', defaultValue: 6, tooltip: 'Third-party management fee as % of effective gross income' },
        { id: 'marketingPerUnit', label: 'Marketing / Unit / Year', type: 'currency', width: 'half', tooltip: 'Digital marketing, SEM, ILS listings, and signage per unit' },
        { id: 'webHostingAnnual', label: 'Web Hosting & SEO / Year', type: 'currency', width: 'half' },
        { id: 'callCenterAnnual', label: 'Call Center / Year', type: 'currency', width: 'half', tooltip: 'Third-party call center for after-hours and overflow calls' },
        { id: 'utilitiesPerSF', label: 'Utilities / SF / Year', type: 'currency', width: 'half', tooltip: 'Electric, water, and HVAC utilities per rentable SF; climate-controlled runs higher' },
        { id: 'propertyTaxAnnual', label: 'Property Tax / Year', type: 'currency', width: 'half' },
        { id: 'insuranceAnnual', label: 'Insurance / Year', type: 'currency', width: 'half' },
        { id: 'repairsMaintPerUnit', label: 'Repairs & Maint / Unit / Year', type: 'currency', width: 'half' },
        { id: 'securityMonitoringMonthly', label: 'Security Monitoring / Month', type: 'currency', width: 'half', tooltip: 'Camera monitoring, alarm system, and access control monthly fees' },
        { id: 'gateMaintenanceAnnual', label: 'Gate Maintenance / Year', type: 'currency', width: 'half' },
        { id: 'softwarePmsMonthly', label: 'PMS Software / Month', type: 'currency', width: 'half', tooltip: 'Property management software subscription (SiteLink, storEDGE, etc.)' },
        { id: 'badDebtPercent', label: 'Bad Debt %', type: 'percent', width: 'half', defaultValue: 2, tooltip: 'Uncollectible rent as % of gross potential rent' },
      ],
    },
    {
      id: 'capital',
      label: 'Capital Reserves',
      icon: 'tool',
      fields: [
        { id: 'capexPerSF', label: 'CapEx Reserve / SF / Year', type: 'currency', width: 'half', tooltip: 'Annual capital reserve per SF for structural, roof, and building system replacements' },
        { id: 'doorReplacementReserve', label: 'Door Replacement Reserve / Year', type: 'currency', width: 'half', tooltip: 'Annual reserve for roll-up door replacement (10-15 year cycle)' },
        { id: 'roofReserve', label: 'Roof Reserve / Year', type: 'currency', width: 'half', tooltip: 'Annual reserve for roof repair/replacement (20-25 year cycle)' },
        { id: 'hvacReserve', label: 'HVAC Reserve / Year', type: 'currency', width: 'half', tooltip: 'Annual reserve for climate-control HVAC system replacement' },
        { id: 'pavingReserve', label: 'Paving Reserve / Year', type: 'currency', width: 'half', tooltip: 'Annual reserve for parking lot and driveway resurfacing' },
      ],
    },
  ],
  growthCategories: [
    { id: 'street_rates', label: 'Street Rate Growth', icon: 'trending-up', description: 'New move-in rate increases driven by demand, supply pipeline, and web-rate optimization', defaultRate: 4.0 },
    { id: 'existing_tenant', label: 'Existing Tenant Increases (ECRI)', icon: 'dollar-sign', description: 'Existing Customer Rate Increases applied to in-place tenants; typically 8-12% annually after 6-12 month seasoning', defaultRate: 8.0 },
    { id: 'ancillary_revenue', label: 'Ancillary Revenue Growth', icon: 'layers', description: 'Tenant insurance, merchandise, truck rental, and late fee revenue growth', defaultRate: 2.0 },
    { id: 'operating_expenses', label: 'Operating Expense Growth', icon: 'arrow-up', description: 'Controllable OpEx inflation for R&M, marketing, software, and supplies', defaultRate: 2.5 },
    { id: 'payroll', label: 'Payroll Growth', icon: 'users', description: 'Site manager and part-time staff wage and benefits escalation', defaultRate: 3.0 },
    { id: 'insurance', label: 'Insurance Growth', icon: 'shield', description: 'Property and liability insurance premium escalation', defaultRate: 5.0 },
    { id: 'property_tax', label: 'Property Tax Growth', icon: 'building', description: 'Tax assessment growth; acquisition may trigger reassessment', defaultRate: 2.0 },
    { id: 'utilities', label: 'Utilities Growth', icon: 'zap', description: 'Electric, water, and HVAC utility cost inflation; climate-controlled facilities more exposed', defaultRate: 3.0 },
  ],
  kpis: [
    { id: 'purchasePrice', label: 'Purchase Price', field: 'purchasePrice', format: 'currency', icon: 'dollar-sign' },
    { id: 'capRate', label: 'Cap Rate', field: 'year1CapRate', format: 'percent', icon: 'percent' },
    { id: 'totalUnits', label: 'Total Units', field: 'totalStorageUnits', format: 'number', icon: 'warehouse' },
    { id: 'noi', label: 'NOI', field: 'ebitda', format: 'currency', icon: 'trending-up' },
    { id: 'revPerSF', label: 'Rev / SF', field: 'revPerSF', format: 'currency', icon: 'dollar-sign' },
    { id: 'economicOccupancy', label: 'Economic Occupancy', field: 'economicOccupancy', format: 'percent', icon: 'bar-chart' },
    { id: 'pricePerSF', label: '$/SF', field: 'pricePerUnit', format: 'currency', icon: 'ruler' },
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
        { id: 'totalResidentialUnits', label: 'Total Residential Units', type: 'integer', width: 'half' },
        { id: 'totalCommercialSF', label: 'Total Commercial SF', type: 'integer', width: 'half', tooltip: 'Combined retail + office gross leasable area' },
        { id: 'residentialSFPercent', label: '% Residential SF', type: 'percent', width: 'third', defaultValue: 60, tooltip: 'Percentage of total SF allocated to residential use' },
        { id: 'retailSFPercent', label: '% Retail SF', type: 'percent', width: 'third', defaultValue: 25, tooltip: 'Percentage of total SF allocated to ground-floor and mezzanine retail' },
        { id: 'officeSFPercent', label: '% Office SF', type: 'percent', width: 'third', defaultValue: 15, tooltip: 'Percentage of total SF allocated to office suites' },
        { id: 'totalSuitesCommercial', label: 'Total Commercial Suites', type: 'integer', width: 'half' },
        { id: 'numberOfFloors', label: 'Number of Floors', type: 'integer', width: 'half' },
        { id: 'numberOfBuildings', label: 'Number of Buildings', type: 'integer', width: 'half', defaultValue: 1 },
        { id: 'parkingSpaces', label: 'Total Parking Spaces', type: 'integer', width: 'half' },
      ],
    },
    {
      id: 'residential_assumptions',
      label: 'Residential Assumptions',
      icon: 'home',
      fields: [
        { id: 'residentialAvgRent', label: 'Avg Residential Rent / Unit / Mo', type: 'currency', width: 'half', tooltip: 'Blended average monthly rent across all residential unit types' },
        { id: 'residentialVacancy', label: 'Residential Vacancy %', type: 'percent', width: 'half', defaultValue: 5, tooltip: 'Economic vacancy including physical vacancy, model/down units, and concessions' },
        { id: 'concessionPercent', label: 'Concessions %', type: 'percent', width: 'half', defaultValue: 2, tooltip: 'Concessions as % of gross potential rent' },
        { id: 'badDebtPercent', label: 'Bad Debt %', type: 'percent', width: 'half', defaultValue: 1 },
        { id: 'renewalRate', label: 'Renewal Rate %', type: 'percent', width: 'half', defaultValue: 55, tooltip: 'Percentage of residents who renew at lease expiration' },
        { id: 'turnoverCostPerUnit', label: 'Turnover Cost / Unit', type: 'currency', width: 'half', tooltip: 'Make-ready cost per unit turn (paint, clean, minor repairs)' },
        { id: 'resPMFeePercent', label: 'Residential PM Fee %', type: 'percent', width: 'half', defaultValue: 5 },
        { id: 'resOtherIncomePerUnit', label: 'Other Income / Unit / Mo', type: 'currency', width: 'half', tooltip: 'Pet fees, storage, trash valet, and other residential ancillary income per unit' },
      ],
    },
    {
      id: 'commercial_assumptions',
      label: 'Commercial Assumptions',
      icon: 'store',
      fields: [
        { id: 'commercialAvgRentPerSF', label: 'Avg Commercial Rent / SF / Year', type: 'currency', width: 'half', tooltip: 'Blended annual rent per SF across retail and office suites' },
        { id: 'commercialVacancy', label: 'Commercial Vacancy %', type: 'percent', width: 'half', defaultValue: 8, tooltip: 'Economic vacancy for commercial suites' },
        { id: 'commercialWALT', label: 'Commercial WALT (Years)', type: 'number', width: 'half', tooltip: 'Weighted average remaining lease term for commercial tenants' },
        { id: 'camRecovery', label: 'CAM Recovery / SF / Year', type: 'currency', width: 'half', tooltip: 'Common area maintenance charges recovered from commercial tenants per SF' },
        { id: 'camRecoveryPercent', label: 'CAM Recovery %', type: 'percent', width: 'half', defaultValue: 85, tooltip: 'Percentage of actual CAM costs recovered from commercial tenants' },
        { id: 'tiAllowancePerSF', label: 'TI Allowance / SF', type: 'currency', width: 'half', tooltip: 'Tenant improvement allowance for new commercial leases' },
        { id: 'lcPercentNew', label: 'LC % (New Lease)', type: 'percent', width: 'half', defaultValue: 5 },
        { id: 'lcPercentRenewal', label: 'LC % (Renewal)', type: 'percent', width: 'half', defaultValue: 2.5 },
        { id: 'annualEscalation', label: 'Annual Escalation %', type: 'percent', width: 'half', defaultValue: 3 },
        { id: 'percentageRentThreshold', label: 'Percentage Rent Breakpoint', type: 'currency', width: 'half', tooltip: 'Sales threshold above which percentage rent kicks in (retail tenants only)' },
      ],
    },
    {
      id: 'operating_expenses',
      label: 'Operating Expenses',
      icon: 'receipt',
      fields: [
        { id: 'propertyTaxAnnual', label: 'Property Tax / Year', type: 'currency', width: 'half' },
        { id: 'insuranceAnnual', label: 'Insurance / Year', type: 'currency', width: 'half' },
        { id: 'utilitiesAnnual', label: 'Common Area Utilities / Year', type: 'currency', width: 'half' },
        { id: 'repairsMaintenanceAnnual', label: 'R&M / Year', type: 'currency', width: 'half' },
        { id: 'payrollAnnual', label: 'On-Site Payroll / Year', type: 'currency', width: 'half' },
        { id: 'landscapingAnnual', label: 'Landscaping / Year', type: 'currency', width: 'half' },
        { id: 'securityAnnual', label: 'Security / Year', type: 'currency', width: 'half' },
        { id: 'capexReservePercent', label: 'CapEx Reserve %', type: 'percent', width: 'half', defaultValue: 5, tooltip: 'Annual capital reserve as % of effective gross income' },
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
      id: 'property_details',
      label: 'Property Details',
      icon: 'settings',
      fields: [
        { id: 'purchasePrice', label: 'Purchase Price', type: 'currency', width: 'half' },
        { id: 'totalMachines', label: 'Total Machines', type: 'integer', width: 'half' },
        { id: 'washerCount', label: 'Washer Count', type: 'integer', width: 'half' },
        { id: 'dryerCount', label: 'Dryer Count', type: 'integer', width: 'half' },
        { id: 'totalSqFt', label: 'Store Square Footage', type: 'integer', width: 'half' },
        { id: 'yearEstablished', label: 'Year Established', type: 'integer', width: 'half' },
        { id: 'attendedHours', label: 'Attended Hours / Day', type: 'number', width: 'half', tooltip: 'Hours per day with staff present' },
        { id: 'unattendedHours', label: 'Unattended Hours / Day', type: 'number', width: 'half', tooltip: 'Hours per day operating without staff (card/app only)' },
        { id: 'holdPeriod', label: 'Hold Period (Years)', type: 'integer', width: 'half', defaultValue: 7 },
        { id: 'paymentMethod', label: 'Primary Payment Method', type: 'select', width: 'half',
          options: [
            { value: 'coin', label: 'Coin-Operated' },
            { value: 'card', label: 'Card/App System' },
            { value: 'hybrid', label: 'Hybrid (Coin + Card)' },
          ]},
      ],
    },
    {
      id: 'revenue',
      label: 'Revenue Assumptions',
      icon: 'dollar-sign',
      fields: [
        { id: 'avgVendPerWasher', label: 'Avg Vend / Washer / Day', type: 'currency', width: 'half', tooltip: 'Average daily vend revenue per washer across all sizes' },
        { id: 'avgVendPerDryer', label: 'Avg Vend / Dryer / Day', type: 'currency', width: 'half', tooltip: 'Average daily vend revenue per dryer' },
        { id: 'washFoldRevenueMonthly', label: 'Wash & Fold Revenue / Mo', type: 'currency', width: 'half', tooltip: 'Monthly drop-off wash-dry-fold service revenue' },
        { id: 'dropOffDryCleanMonthly', label: 'Drop-Off Dry Clean Revenue / Mo', type: 'currency', width: 'half', tooltip: 'Monthly dry cleaning drop-off agent revenue' },
        { id: 'vendingMachineMonthly', label: 'Vending Machine Revenue / Mo', type: 'currency', width: 'half', tooltip: 'Soap, snack, and beverage vending revenue' },
        { id: 'coinChangeRevenue', label: 'Coin/Change Revenue / Mo', type: 'currency', width: 'half', tooltip: 'Revenue from change machine and card reload premiums' },
        { id: 'ancillaryRevenueMonthly', label: 'Other Ancillary Revenue / Mo', type: 'currency', width: 'half', tooltip: 'Pick-up/delivery, retail supplies, and other ancillary income' },
      ],
    },
    {
      id: 'operating',
      label: 'Operating Expenses',
      icon: 'receipt',
      fields: [
        { id: 'waterPerMonth', label: 'Water & Sewer / Mo', type: 'currency', width: 'half' },
        { id: 'gasPerMonth', label: 'Gas / Mo', type: 'currency', width: 'half' },
        { id: 'electricPerMonth', label: 'Electric / Mo', type: 'currency', width: 'half' },
        { id: 'sewerPerMonth', label: 'Sewer (if separate) / Mo', type: 'currency', width: 'half' },
        { id: 'rentOrMortgage', label: 'Rent or Mortgage / Mo', type: 'currency', width: 'half', tooltip: 'Monthly base rent for lease or mortgage payment' },
        { id: 'commonAreaMaint', label: 'CAM / Mo', type: 'currency', width: 'half', tooltip: 'Common area maintenance charges if in a shopping center' },
        { id: 'attendantPayroll', label: 'Attendant Payroll / Mo', type: 'currency', width: 'half', tooltip: 'Total attendant and manager payroll including payroll taxes' },
        { id: 'managementFeePercent', label: 'Management Fee %', type: 'percent', width: 'half', defaultValue: 0, tooltip: 'Third-party management fee if applicable (typically 10-15% for absentee owners)' },
        { id: 'maintenancePartsMonthly', label: 'Maintenance & Parts / Mo', type: 'currency', width: 'half', tooltip: 'Monthly parts, repairs, and preventative maintenance for machines and facility' },
        { id: 'vendingCOGS', label: 'Vending COGS / Mo', type: 'currency', width: 'half', tooltip: 'Cost of goods for soap, snack, and beverage vending' },
        { id: 'suppliesCostMonthly', label: 'Supplies & Cleaning / Mo', type: 'currency', width: 'half' },
        { id: 'ccProcessingPercent', label: 'CC Processing %', type: 'percent', width: 'half', defaultValue: 3.5, tooltip: 'Credit card and app payment processing fees as % of card revenue' },
        { id: 'insuranceAnnual', label: 'Insurance / Year', type: 'currency', width: 'half' },
        { id: 'propertyTaxAnnual', label: 'Property Tax / Year', type: 'currency', width: 'half' },
        { id: 'securityMonthly', label: 'Security / Mo', type: 'currency', width: 'half', tooltip: 'Camera monitoring, alarm, and security patrol costs' },
      ],
    },
    {
      id: 'equipment_reserve',
      label: 'Equipment Reserve',
      icon: 'tool',
      fields: [
        { id: 'washerLifeYears', label: 'Washer Life (Years)', type: 'number', width: 'half', defaultValue: 10, tooltip: 'Expected useful life per washer; commercial washers typically 8-12 years' },
        { id: 'dryerLifeYears', label: 'Dryer Life (Years)', type: 'number', width: 'half', defaultValue: 12, tooltip: 'Expected useful life per dryer; typically 10-14 years' },
        { id: 'washerReplacementCost', label: 'Avg Washer Replacement Cost', type: 'currency', width: 'half', tooltip: 'Average installed cost per replacement washer' },
        { id: 'dryerReplacementCost', label: 'Avg Dryer Replacement Cost', type: 'currency', width: 'half', tooltip: 'Average installed cost per replacement dryer' },
        { id: 'waterHeaterReserve', label: 'Water Heater Reserve / Year', type: 'currency', width: 'half', tooltip: 'Annual reserve for commercial water heater replacement (10-15 year cycle)' },
        { id: 'totalEquipmentValue', label: 'Total Equipment Value (Current)', type: 'currency', width: 'half', tooltip: 'Estimated fair market value of all installed equipment' },
        { id: 'avgMachineAge', label: 'Current Avg Machine Age (Years)', type: 'number', width: 'half', tooltip: 'Weighted average age of installed equipment base' },
        { id: 'annualCapexReserve', label: 'Annual CapEx Reserve', type: 'currency', width: 'half', tooltip: 'Annual capital reserve for equipment replacement, store improvements, and water heater' },
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
      id: 'property_details',
      label: 'Property Details',
      icon: 'home',
      fields: [
        { id: 'purchasePrice', label: 'Purchase Price', type: 'currency', width: 'half' },
        { id: 'bedrooms', label: 'Bedrooms', type: 'integer', width: 'third' },
        { id: 'bathrooms', label: 'Bathrooms', type: 'number', width: 'third' },
        { id: 'totalSqFt', label: 'Total Living SF', type: 'integer', width: 'third' },
        { id: 'lotSqFt', label: 'Lot Size (SF)', type: 'integer', width: 'half' },
        { id: 'yearBuilt', label: 'Year Built', type: 'integer', width: 'half' },
        { id: 'garage', label: 'Garage', type: 'select', width: 'half',
          options: [
            { value: 'none', label: 'None' },
            { value: '1_car', label: '1-Car Garage' },
            { value: '2_car', label: '2-Car Garage' },
            { value: '3_car', label: '3-Car Garage' },
          ]},
        { id: 'hasPool', label: 'Pool', type: 'select', width: 'half',
          options: [
            { value: 'yes', label: 'Yes' },
            { value: 'no', label: 'No' },
          ]},
        { id: 'hasBasement', label: 'Basement', type: 'select', width: 'half',
          options: [
            { value: 'yes_finished', label: 'Yes (Finished)' },
            { value: 'yes_unfinished', label: 'Yes (Unfinished)' },
            { value: 'no', label: 'No' },
          ]},
        { id: 'condition', label: 'Condition', type: 'select', width: 'half',
          options: [
            { value: 'turnkey', label: 'Turnkey' },
            { value: 'light_rehab', label: 'Light Rehab ($5-15K)' },
            { value: 'major_rehab', label: 'Major Rehab ($15K+)' },
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
        { id: 'monthlyRent', label: 'Monthly Rent', type: 'currency', width: 'half', tooltip: 'Monthly rental income per unit; for multi-unit properties enter per-unit amount' },
        { id: 'vacancyPercent', label: 'Vacancy %', type: 'percent', width: 'half', defaultValue: 5, tooltip: 'Economic vacancy including turnover downtime; SFR typically 3-8%' },
        { id: 'petFeeMonthly', label: 'Pet Fee / Mo', type: 'currency', width: 'half' },
        { id: 'parkingFeeMonthly', label: 'Parking Fee / Mo', type: 'currency', width: 'half', tooltip: 'Additional parking revenue (detached garage, carport, etc.)' },
        { id: 'storageExtraMonthly', label: 'Storage / Extra Income / Mo', type: 'currency', width: 'half', tooltip: 'Shed, basement, or attic storage rental income' },
        { id: 'lateFeesPercent', label: 'Late Fees % of Rent', type: 'percent', width: 'half', defaultValue: 2, tooltip: 'Late fee income as percentage of gross rent' },
        { id: 'avgLeaseTerm', label: 'Avg Lease Term (Months)', type: 'integer', width: 'half', defaultValue: 12 },
        { id: 'renewalRate', label: 'Renewal Rate %', type: 'percent', width: 'half', defaultValue: 65, tooltip: 'Percentage of tenants who renew at lease expiration' },
      ],
    },
    {
      id: 'expenses',
      label: 'Operating Expenses',
      icon: 'receipt',
      fields: [
        { id: 'propertyManagementPercent', label: 'Property Management %', type: 'percent', width: 'half', defaultValue: 8, tooltip: 'PM fee as % of collected rent; 8-10% for single properties, 5-7% for portfolios' },
        { id: 'leaseUpFee', label: 'Lease-Up Fee', type: 'currency', width: 'half', tooltip: 'One-time tenant placement fee (typically 50-100% of first months rent)' },
        { id: 'maintenanceAnnual', label: 'Maintenance / Year', type: 'currency', width: 'half', tooltip: 'Annual routine repair and maintenance budget' },
        { id: 'landscapingAnnual', label: 'Landscaping / Year', type: 'currency', width: 'half', tooltip: 'Annual lawn care and landscaping if landlord-provided' },
        { id: 'insuranceAnnual', label: 'Insurance / Year', type: 'currency', width: 'half', tooltip: 'Landlord dwelling policy including liability; flood and wind if applicable' },
        { id: 'propertyTaxAnnual', label: 'Property Tax / Year', type: 'currency', width: 'half' },
        { id: 'hoaMonthly', label: 'HOA / Month', type: 'currency', width: 'half', tooltip: 'Homeowners association dues (condos, townhomes, planned communities)' },
        { id: 'utilitiesIfLandlordPaid', label: 'Landlord-Paid Utilities / Mo', type: 'currency', width: 'half', tooltip: 'Utilities paid by landlord (water, sewer, trash if not tenant-paid)' },
        { id: 'pestControlAnnual', label: 'Pest Control / Year', type: 'currency', width: 'half' },
        { id: 'turnoverCost', label: 'Avg Turnover Cost', type: 'currency', width: 'half', tooltip: 'Make-ready per turn including paint, clean, minor repairs, and re-keying' },
        { id: 'poolMaintenanceAnnual', label: 'Pool Maintenance / Year', type: 'currency', width: 'half', tooltip: 'Annual pool maintenance if applicable' },
      ],
    },
    {
      id: 'capital',
      label: 'Capital Reserves',
      icon: 'tool',
      fields: [
        { id: 'capexReservePercent', label: 'CapEx Reserve % of Rent', type: 'percent', width: 'half', defaultValue: 5, tooltip: 'Annual reserve for major capital items as % of gross rent' },
        { id: 'roofAge', label: 'Roof Age (Years)', type: 'integer', width: 'half', tooltip: 'Current age of roof; typical shingle life is 20-25 years' },
        { id: 'hvacAge', label: 'HVAC Age (Years)', type: 'integer', width: 'half', tooltip: 'Current age of HVAC system; typical life is 15-20 years' },
        { id: 'waterHeaterAge', label: 'Water Heater Age (Years)', type: 'integer', width: 'half', tooltip: 'Current age of water heater; typical tank life is 8-12 years' },
        { id: 'applianceReplacementReserve', label: 'Appliance Reserve / Year', type: 'currency', width: 'half', tooltip: 'Annual reserve for refrigerator, range, dishwasher, W/D replacement' },
      ],
    },
  ],
  growthCategories: [
    { id: 'rent', label: 'Rent Growth', icon: 'trending-up', description: 'Annual rent increase at renewal or re-lease; driven by local housing market, wage growth, and home price appreciation', defaultRate: 3.0 },
    { id: 'other_income', label: 'Other Income Growth', icon: 'dollar-sign', description: 'Growth in pet fees, parking, storage, and late fee income', defaultRate: 2.0 },
    { id: 'operating_expenses', label: 'Operating Expense Growth', icon: 'arrow-up', description: 'Repairs, maintenance, landscaping, pest control, and PM fee inflation', defaultRate: 2.5 },
    { id: 'insurance', label: 'Insurance Growth', icon: 'shield', description: 'Landlord dwelling policy premium increases; catastrophe-zone properties may see 8-12% annual increases', defaultRate: 5.0 },
    { id: 'property_tax', label: 'Property Tax Growth', icon: 'building', description: 'Property tax assessment growth; acquisition may trigger reassessment to purchase price', defaultRate: 2.0 },
    { id: 'hoa', label: 'HOA Growth', icon: 'home', description: 'HOA dues annual increase (if applicable)', defaultRate: 3.0 },
    { id: 'capex', label: 'Capital Cost Growth', icon: 'tool', description: 'Construction materials and labor cost inflation impacting replacement reserves', defaultRate: 3.5 },
  ],
  kpis: [
    { id: 'purchasePrice', label: 'Purchase Price', field: 'purchasePrice', format: 'currency', icon: 'dollar-sign' },
    { id: 'capRate', label: 'Cap Rate', field: 'year1CapRate', format: 'percent', icon: 'percent' },
    { id: 'monthlyRent', label: 'Monthly Rent', field: 'monthlyRent', format: 'currency', icon: 'dollar-sign' },
    { id: 'noi', label: 'NOI', field: 'ebitda', format: 'currency', icon: 'trending-up' },
    { id: 'grm', label: 'GRM', field: 'grm', format: 'multiple', icon: 'x' },
    { id: 'cashOnCash', label: 'Cash-on-Cash', field: 'cashOnCash', format: 'percent', icon: 'percent' },
    { id: 'pricePerSF', label: '$/SF', field: 'pricePerSF', format: 'currency', icon: 'ruler' },
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
      id: 'business_details',
      label: 'Business Details',
      icon: 'briefcase',
      fields: [
        { id: 'purchasePrice', label: 'Purchase Price', type: 'currency', width: 'half' },
        { id: 'businessType', label: 'Business Type', type: 'select', width: 'half',
          options: [
            { value: 'cleaning_service', label: 'Cleaning / Janitorial' },
            { value: 'home_services', label: 'Home Services' },
            { value: 'landscaping_service', label: 'Landscaping / Lawn Care' },
            { value: 'pest_control', label: 'Pest Control' },
            { value: 'hvac_plumbing', label: 'HVAC / Plumbing / Electrical' },
            { value: 'auto_service', label: 'Auto Service / Repair' },
            { value: 'restaurant', label: 'Restaurant / Food Service' },
            { value: 'retail_store', label: 'Retail Store' },
            { value: 'franchise', label: 'Franchise' },
            { value: 'professional_services', label: 'Professional Services' },
            { value: 'healthcare_services', label: 'Healthcare / Dental / Veterinary' },
            { value: 'fitness_wellness', label: 'Fitness / Gym / Wellness' },
            { value: 'childcare', label: 'Childcare / Daycare' },
            { value: 'staffing_recruiting', label: 'Staffing / Recruiting' },
            { value: 'it_managed_services', label: 'IT / Managed Services' },
            { value: 'manufacturing', label: 'Manufacturing / Distribution' },
            { value: 'ecommerce', label: 'E-Commerce / DTC' },
            { value: 'other', label: 'Other' },
          ]},
        { id: 'annualGrossRevenue', label: 'Annual Gross Revenue', type: 'currency', width: 'half', tooltip: 'Trailing twelve months total gross revenue' },
        { id: 'employeeCount', label: 'Total Employees (FTEs)', type: 'integer', width: 'half' },
        { id: 'numberOfLocations', label: 'Number of Locations', type: 'integer', width: 'half', defaultValue: 1 },
        { id: 'yearsInOperation', label: 'Years in Operation', type: 'integer', width: 'half' },
        { id: 'holdPeriod', label: 'Hold Period (Years)', type: 'integer', width: 'half', defaultValue: 5 },
        { id: 'revenueGrowthRate', label: 'Historical Revenue Growth %', type: 'percent', width: 'half', tooltip: 'Year-over-year revenue growth rate (trailing 3 year average)' },
        { id: 'recurringRevenuePercent', label: 'Recurring Revenue %', type: 'percent', width: 'half', tooltip: 'Percentage of revenue that is recurring/contractual (memberships, subscriptions, contracts)' },
        { id: 'customerConcentration', label: 'Top Customer % of Revenue', type: 'percent', width: 'half', tooltip: 'Revenue concentration risk from largest single customer' },
      ],
    },
    {
      id: 'revenue',
      label: 'Revenue Breakdown',
      icon: 'dollar-sign',
      fields: [
        { id: 'primaryRevenueAnnual', label: 'Primary Revenue / Year', type: 'currency', width: 'half', tooltip: 'Core product or service revenue stream' },
        { id: 'secondaryRevenueAnnual', label: 'Secondary Revenue / Year', type: 'currency', width: 'half', tooltip: 'Ancillary or add-on revenue streams' },
        { id: 'serviceRevenueAnnual', label: 'Service Revenue / Year', type: 'currency', width: 'half', tooltip: 'Professional services, consulting, or labor-based revenue' },
        { id: 'contractRevenueAnnual', label: 'Contract / Recurring Revenue / Year', type: 'currency', width: 'half', tooltip: 'Monthly or annual subscription, membership, or contract-based recurring revenue' },
      ],
    },
    {
      id: 'cogs',
      label: 'Cost of Goods Sold',
      icon: 'package',
      fields: [
        { id: 'directMaterialsCost', label: 'Direct Materials / Year', type: 'currency', width: 'half', tooltip: 'Raw materials, inventory, and direct supplies cost' },
        { id: 'directLaborCost', label: 'Direct Labor / Year', type: 'currency', width: 'half', tooltip: 'Direct production or service delivery labor cost' },
        { id: 'otherDirectCosts', label: 'Other Direct Costs / Year', type: 'currency', width: 'half', tooltip: 'Freight, subcontractors, manufacturing overhead, and other direct costs' },
      ],
    },
    {
      id: 'operating',
      label: 'Operating Expenses',
      icon: 'receipt',
      fields: [
        { id: 'rentOccupancy', label: 'Rent / Occupancy / Year', type: 'currency', width: 'half', tooltip: 'Annual facility rent or lease payments including CAM and pass-throughs' },
        { id: 'payrollAndBenefits', label: 'Payroll & Benefits / Year', type: 'currency', width: 'half', tooltip: 'SG&A payroll, benefits, and payroll taxes (exclude direct labor in COGS)' },
        { id: 'utilitiesAnnual', label: 'Utilities / Year', type: 'currency', width: 'half' },
        { id: 'insuranceAnnual', label: 'Insurance / Year', type: 'currency', width: 'half', tooltip: 'General liability, workers comp, property, and professional liability insurance' },
        { id: 'marketingAnnual', label: 'Marketing & Advertising / Year', type: 'currency', width: 'half' },
        { id: 'professionalFeesAnnual', label: 'Professional Fees / Year', type: 'currency', width: 'half', tooltip: 'Legal, accounting, consulting, and advisory fees' },
        { id: 'officeSuppliesAnnual', label: 'Office Supplies / Year', type: 'currency', width: 'half' },
        { id: 'vehicleExpenseAnnual', label: 'Vehicle & Travel / Year', type: 'currency', width: 'half' },
        { id: 'technologyAnnual', label: 'Technology & Software / Year', type: 'currency', width: 'half', tooltip: 'SaaS subscriptions, IT infrastructure, website, and POS systems' },
        { id: 'miscAnnual', label: 'Other / Miscellaneous / Year', type: 'currency', width: 'half' },
      ],
    },
    {
      id: 'owner_adjustments',
      label: 'Owner Adjustments (SDE/EBITDA Normalization)',
      icon: 'user-check',
      fields: [
        { id: 'ownerSalaryAddback', label: 'Owner Salary Add-Back', type: 'currency', width: 'half', tooltip: 'Current owner salary and benefits to be added back for SDE calculation' },
        { id: 'personalExpenseAddback', label: 'Personal Expense Add-Back', type: 'currency', width: 'half', tooltip: 'Owner personal expenses run through the business (vehicle, meals, travel, phone, health insurance)' },
        { id: 'oneTimeExpenseAddback', label: 'One-Time Expense Add-Back', type: 'currency', width: 'half', tooltip: 'Non-recurring expenses (legal settlements, equipment purchases expensed, moving costs)' },
        { id: 'nonRecurringRevenueAdjust', label: 'Non-Recurring Revenue Adjustment', type: 'currency', width: 'half', tooltip: 'One-time or non-recurring revenue to subtract from normalized income (PPP loans, insurance claims, etc.)' },
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
    { id: 'rent_occupancy', label: 'Rent / Occupancy Growth', icon: 'building', description: 'Facility lease rent escalation per contractual terms', defaultRate: 3.0 },
  ],
  kpis: [
    { id: 'purchasePrice', label: 'Purchase Price', field: 'purchasePrice', format: 'currency', icon: 'dollar-sign' },
    { id: 'ebitdaMultiple', label: 'EBITDA Multiple', field: 'ebitdaMultiple', format: 'multiple', icon: 'x' },
    { id: 'revenue', label: 'Revenue', field: 'totalRevenue', format: 'currency', icon: 'trending-up' },
    { id: 'ebitda', label: 'EBITDA', field: 'ebitda', format: 'currency', icon: 'dollar-sign' },
    { id: 'ebitdaMargin', label: 'EBITDA Margin', field: 'ebitdaMargin', format: 'percent', icon: 'percent' },
    { id: 'revenueGrowth', label: 'Revenue Growth', field: 'revenueGrowthRate', format: 'percent', icon: 'arrow-up' },
    { id: 'grossMargin', label: 'Gross Margin', field: 'grossMargin', format: 'percent', icon: 'pie-chart' },
    { id: 'sde', label: 'SDE', field: 'sde', format: 'currency', icon: 'dollar-sign' },
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
  rentalModes: ['long_term', 'short_term'],
  defaultRentalMode: 'long_term',
};
const TRIPLEX_CONFIG: AssetClassModelConfig = {
  ...DUPLEX_CONFIG,
  id: 'triplex',
  label: 'Triplex',
  defaults: { ...DUPLEX_CONFIG.defaults, numberOfUnits: 3 },
  rentalModes: ['long_term', 'short_term'],
  defaultRentalMode: 'long_term',
};
const QUAD_CONFIG: AssetClassModelConfig = {
  ...DUPLEX_CONFIG,
  id: 'quad',
  label: 'Quadplex',
  defaults: { ...DUPLEX_CONFIG.defaults, numberOfUnits: 4 },
  rentalModes: ['long_term', 'short_term'],
  defaultRentalMode: 'long_term',
};
// ═══════════════════════════════════════════════════════════════
// Car Wash Config
// ═══════════════════════════════════════════════════════════════

const CAR_WASH_CONFIG: AssetClassModelConfig = {
  id: 'car_wash',
  label: 'Car Wash',
  terms: {
    unit: 'bay', unitPlural: 'bays',
    property: 'location', propertyPlural: 'locations',
    rentRoll: 'Equipment List', occupancy: 'Utilization',
    noi: 'EBITDA', pricePerUnit: '$/Bay', totalUnitsLabel: 'Total Bays',
  },
  valuationMetric: 'ebitda_multiple',
  valuationLabel: 'EBITDA Multiple',
  hasSeasonal: true,
  seasonConfig: {
    type: 'str',
    defaultInSeasonMonths: [4, 5, 6, 7, 8, 9],
    seasonLabel: 'Peak Season',
    offSeasonLabel: 'Off Season',
  },
  unitMix: {
    tabLabel: 'Bay & Equipment Mix',
    tabIcon: 'car',
    showTab: true,
    countColumnLabel: 'Bays / Stations',
    rateColumnLabel: 'Revenue / Bay',
    rateType: 'monthly',
    showSF: false,
    types: [
      { id: 'self_serve_bay', name: 'Self-Serve Bay', icon: 'car', section: 'Self-Serve', hasSeasons: true, defaultFields: { count: 0 } },
      { id: 'automatic_tunnel', name: 'Automatic Tunnel', icon: 'arrow-right', section: 'Automatic', hasSeasons: true, defaultFields: { count: 0 } },
      { id: 'express_exterior', name: 'Express Exterior', icon: 'zap', section: 'Automatic', hasSeasons: true, defaultFields: { count: 0 } },
      { id: 'full_service_bay', name: 'Full-Service Bay', icon: 'star', section: 'Full-Service', hasSeasons: true, defaultFields: { count: 0 } },
      { id: 'detail_bay', name: 'Detail Bay', icon: 'sparkles', section: 'Detail', hasSeasons: true, defaultFields: { count: 0 } },
      { id: 'vacuum_station', name: 'Vacuum Station', icon: 'wind', section: 'Ancillary', hasSeasons: false, defaultFields: { count: 0 } },
      { id: 'air_machine', name: 'Air Machine', icon: 'gauge', section: 'Ancillary', hasSeasons: false, defaultFields: { count: 0 } },
    ],
  },
  profitCenters: {
    tabLabel: 'Revenue Streams',
    showTab: true,
    departments: [
      { id: 'wash_revenue', name: 'Wash Revenue', icon: 'car', category: 'core', description: 'Core wash revenue from all bay types',
        hasRevenue: true, hasCOGS: true, hasDirectLabor: true,
        revenueLines: ['Self-Serve Revenue', 'Tunnel Revenue', 'Express Exterior Revenue', 'Full-Service Revenue'],
        cogsLines: ['Chemicals & Soap', 'Water & Sewer', 'Equipment Parts'], expenseLines: ['Wash Attendant Labor', 'Equipment Maintenance'] },
      { id: 'detail_interior', name: 'Detail / Interior', icon: 'sparkles', category: 'core', description: 'Interior detailing and premium services',
        hasRevenue: true, hasCOGS: true, hasDirectLabor: true,
        revenueLines: ['Interior Detail Revenue', 'Premium Detail Packages', 'Ceramic Coating / Protection'],
        cogsLines: ['Detail Supplies & Products'], expenseLines: ['Detail Technician Labor'] },
      { id: 'memberships', name: 'Memberships / Subscriptions', icon: 'credit-card', category: 'core', description: 'Monthly unlimited wash memberships',
        hasRevenue: true, hasCOGS: false, hasDirectLabor: false,
        revenueLines: ['Monthly Membership Revenue', 'Annual Plan Revenue', 'Fleet Account Revenue'] },
      { id: 'vending', name: 'Vending', icon: 'shopping-cart', category: 'ancillary', description: 'Vending machines, air fresheners, and ancillary sales',
        hasRevenue: true, hasCOGS: true, hasDirectLabor: false,
        revenueLines: ['Vending Revenue', 'Air Freshener Sales', 'Towel/Mat Sales'],
        cogsLines: ['Vending COGS'] },
    ],
  },
  inputSections: [
    { id: 'general', label: 'General Assumptions', icon: 'settings', fields: [
      { id: 'purchasePrice', label: 'Purchase Price', type: 'currency', width: 'half' },
      { id: 'closingDate', label: 'Closing Date', type: 'text', width: 'half' },
      { id: 'holdPeriod', label: 'Hold Period (Years)', type: 'integer', width: 'half', defaultValue: 7 },
      { id: 'numberOfLocations', label: 'Number of Locations', type: 'integer', width: 'half', defaultValue: 1 },
      { id: 'landArea', label: 'Land Area (SF)', type: 'integer', width: 'half' },
      { id: 'yearBuilt', label: 'Year Built', type: 'integer', width: 'half' },
    ]},
    { id: 'operations', label: 'Operations', icon: 'bar-chart', fields: [
      { id: 'carsPerDayAvg', label: 'Avg Cars / Day', type: 'integer', width: 'half', tooltip: 'Average cars washed per day across all bays' },
      { id: 'avgTicket', label: 'Avg Ticket Price', type: 'currency', width: 'half' },
      { id: 'membershipCount', label: 'Active Members', type: 'integer', width: 'half' },
      { id: 'membershipPrice', label: 'Avg Membership Price / Mo', type: 'currency', width: 'half' },
      { id: 'utilizationPercent', label: 'Bay Utilization %', type: 'percent', width: 'half', defaultValue: 55 },
      { id: 'operatingHoursPerDay', label: 'Operating Hours / Day', type: 'number', width: 'half', defaultValue: 12 },
    ]},
    { id: 'expenses', label: 'Operating Expenses', icon: 'receipt', fields: [
      { id: 'rentLease', label: 'Rent / Lease / Year', type: 'currency', width: 'half' },
      { id: 'payrollBenefits', label: 'Payroll & Benefits / Year', type: 'currency', width: 'half' },
      { id: 'chemicalsSupplies', label: 'Chemicals & Supplies / Year', type: 'currency', width: 'half' },
      { id: 'waterSewer', label: 'Water & Sewer / Year', type: 'currency', width: 'half' },
      { id: 'utilitiesAnnual', label: 'Utilities (Electric/Gas) / Year', type: 'currency', width: 'half' },
      { id: 'equipmentMaintenance', label: 'Equipment Maintenance / Year', type: 'currency', width: 'half' },
      { id: 'insuranceAnnual', label: 'Insurance / Year', type: 'currency', width: 'half' },
      { id: 'propertyTaxAnnual', label: 'Property Tax / Year', type: 'currency', width: 'half' },
    ]},
  ],
  growthCategories: [
    { id: 'wash_revenue', label: 'Wash Revenue Growth', icon: 'trending-up', description: 'Core wash revenue growth from volume and price increases', defaultRate: 4.0 },
    { id: 'membership_revenue', label: 'Membership Revenue Growth', icon: 'credit-card', description: 'Unlimited wash membership growth driven by subscriber acquisition', defaultRate: 8.0 },
    { id: 'detail_revenue', label: 'Detail Revenue Growth', icon: 'sparkles', description: 'Interior and premium detail service growth', defaultRate: 5.0 },
    { id: 'ancillary_revenue', label: 'Ancillary Revenue Growth', icon: 'layers', description: 'Vending, air freshener, and other ancillary revenue', defaultRate: 2.0 },
    { id: 'operating_expenses', label: 'Operating Expense Growth', icon: 'arrow-up', description: 'Chemicals, water, and general OpEx inflation', defaultRate: 3.0 },
    { id: 'payroll', label: 'Payroll Growth', icon: 'users', description: 'Attendant and manager wage growth', defaultRate: 3.5 },
    { id: 'insurance', label: 'Insurance Growth', icon: 'shield', description: 'Property and liability insurance', defaultRate: 4.0 },
    { id: 'property_tax', label: 'Property Tax Growth', icon: 'building', description: 'Annual property tax increases', defaultRate: 2.0 },
  ],
  kpis: [
    { id: 'purchasePrice', label: 'Purchase Price', field: 'purchasePrice', format: 'currency', icon: 'dollar-sign' },
    { id: 'ebitdaMultiple', label: 'EBITDA Multiple', field: 'ebitdaMultiple', format: 'multiple', icon: 'x' },
    { id: 'totalBays', label: 'Total Bays', field: 'totalStorageUnits', format: 'number', icon: 'car' },
    { id: 'ebitda', label: 'EBITDA', field: 'ebitda', format: 'currency', icon: 'trending-up' },
    { id: 'carsPerDay', label: 'Cars / Day', field: 'carsPerDayAvg', format: 'number', icon: 'bar-chart' },
    { id: 'memberCount', label: 'Members', field: 'membershipCount', format: 'number', icon: 'users' },
  ],
  tabs: { storageLeases: true, commercialLeases: false, profitCenters: true },
  allowCustomUnitTypes: true,
  allowCustomDepartments: true,
  allowCustomGrowthCategories: true,
};


// ═══════════════════════════════════════════════════════════════
// Shopping Center / Strip Mall Config
// ═══════════════════════════════════════════════════════════════

const SHOPPING_CENTER_CONFIG: AssetClassModelConfig = {
  id: 'shopping_center',
  label: 'Shopping Center / Strip Mall',
  terms: {
    unit: 'suite', unitPlural: 'suites',
    property: 'center', propertyPlural: 'centers',
    rentRoll: 'Tenant Rent Roll', occupancy: 'Occupancy',
    noi: 'NOI', pricePerUnit: '$/SF', totalUnitsLabel: 'Total GLA',
  },
  valuationMetric: 'cap_rate',
  valuationLabel: 'Cap Rate',
  hasSeasonal: false,
  seasonConfig: { type: 'none' },
  unitMix: {
    tabLabel: 'Tenant Spaces',
    tabIcon: 'store',
    showTab: false,
    countColumnLabel: 'Suites',
    rateColumnLabel: 'Rent/SF',
    rateType: 'monthly',
    showSF: true,
    sfColumnLabel: 'GLA (SF)',
    types: [],
  },
  profitCenters: {
    tabLabel: 'Ancillary Revenue',
    showTab: true,
    departments: [
      { id: 'parking', name: 'Parking', icon: 'car', category: 'core', description: 'Surface and structured parking revenue',
        hasRevenue: true, hasCOGS: false, hasDirectLabor: false,
        revenueLines: ['Surface Parking Revenue', 'Structured Parking Revenue', 'Employee Parking Fees'] },
      { id: 'outparcels', name: 'Outparcels', icon: 'map-pin', category: 'core', description: 'Ground-leased outparcel income from pad sites',
        hasRevenue: true, hasCOGS: false, hasDirectLabor: false,
        revenueLines: ['Outparcel Ground Lease Revenue', 'Pad Site Revenue'] },
      { id: 'pad_sites', name: 'Pad Sites', icon: 'building', category: 'ancillary', description: 'Drive-through and standalone pad site tenants',
        hasRevenue: true, hasCOGS: false, hasDirectLabor: false,
        revenueLines: ['Drive-Through Pad Rent', 'Standalone Pad Rent', 'Temporary Pad Lease'] },
      { id: 'common_area_events', name: 'Common Area Events', icon: 'calendar', category: 'ancillary', description: 'Common area programming and seasonal events',
        hasRevenue: true, hasCOGS: false, hasDirectLabor: true,
        revenueLines: ['Seasonal Event Revenue', 'Farmers Market Fees', 'Pop-Up Shop Revenue', 'Food Truck Fees'],
        expenseLines: ['Event Coordination Labor', 'Event Setup & Supplies'] },
      { id: 'pylon_sign', name: 'Pylon Sign Revenue', icon: 'layout', category: 'ancillary', description: 'Pylon and monument sign panel rental',
        hasRevenue: true, hasCOGS: false, hasDirectLabor: false,
        revenueLines: ['Pylon Sign Panel Revenue', 'Monument Sign Revenue', 'Digital Billboard Revenue'] },
    ],
  },
  inputSections: [
    { id: 'general', label: 'General Assumptions', icon: 'settings', fields: [
      { id: 'purchasePrice', label: 'Purchase Price', type: 'currency', width: 'half' },
      { id: 'closingDate', label: 'Closing Date', type: 'text', width: 'half' },
      { id: 'holdPeriod', label: 'Hold Period (Years)', type: 'integer', width: 'half', defaultValue: 7 },
      { id: 'managementFeePercent', label: 'Management Fee %', type: 'percent', width: 'half', defaultValue: 4 },
      { id: 'totalGLA', label: 'Total GLA (SF)', type: 'integer', width: 'half' },
      { id: 'yearBuilt', label: 'Year Built', type: 'integer', width: 'half' },
      { id: 'numberOfTenants', label: 'Number of Tenants', type: 'integer', width: 'half' },
      { id: 'anchorTenantPercent', label: 'Anchor Tenant % of GLA', type: 'percent', width: 'half' },
    ]},
    { id: 'lease_structure', label: 'Lease Structure', icon: 'file-text', fields: [
      { id: 'leaseType', label: 'Predominant Lease Type', type: 'select', width: 'half',
        options: [
          { value: 'nnn', label: 'NNN (Triple Net)' },
          { value: 'modified_gross', label: 'Modified Gross' },
          { value: 'gross', label: 'Full-Service Gross' },
        ]},
      { id: 'avgLeaseTermYears', label: 'Avg Lease Term (Years)', type: 'number', width: 'half', defaultValue: 5 },
      { id: 'economicVacancy', label: 'Economic Vacancy %', type: 'percent', width: 'half', defaultValue: 7 },
      { id: 'camPerSF', label: 'CAM / SF', type: 'currency', width: 'half' },
      { id: 'tiAllowancePerSF', label: 'TI Allowance / SF (new)', type: 'currency', width: 'half' },
      { id: 'lcPercentNewLease', label: 'LC % (New Lease)', type: 'percent', width: 'half', defaultValue: 6 },
      { id: 'lcPercentRenewal', label: 'LC % (Renewal)', type: 'percent', width: 'half', defaultValue: 3 },
      { id: 'percentageRentThreshold', label: 'Percentage Rent Breakpoint', type: 'currency', width: 'half', tooltip: 'Sales threshold above which percentage rent is collected' },
      { id: 'coTenancyClauseCount', label: 'Leases with Co-Tenancy Clauses', type: 'integer', width: 'half', tooltip: 'Number of leases with co-tenancy provisions' },
    ]},
  ],
  growthCategories: [
    { id: 'base_rent', label: 'Base Rent Growth', icon: 'trending-up', description: 'Annual contractual escalations and market rent growth', defaultRate: 3.0 },
    { id: 'cam_recovery', label: 'CAM Recovery Growth', icon: 'dollar-sign', description: 'Common area cost pass-throughs', defaultRate: 2.5 },
    { id: 'percentage_rent', label: 'Percentage Rent Growth', icon: 'bar-chart', description: 'Percentage rent driven by tenant sales growth', defaultRate: 2.0 },
    { id: 'ancillary_revenue', label: 'Ancillary Revenue Growth', icon: 'layers', description: 'Parking, outparcels, signage, and event revenue', defaultRate: 2.0 },
    { id: 'operating_expenses', label: 'Operating Expense Growth', icon: 'arrow-up', description: 'Controllable OpEx', defaultRate: 2.5 },
    { id: 'insurance', label: 'Insurance Growth', icon: 'shield', description: 'Property insurance premiums', defaultRate: 5.0 },
    { id: 'property_tax', label: 'Property Tax Growth', icon: 'building', description: 'Tax assessment growth', defaultRate: 2.0 },
  ],
  kpis: [
    { id: 'purchasePrice', label: 'Purchase Price', field: 'purchasePrice', format: 'currency', icon: 'dollar-sign' },
    { id: 'capRate', label: 'Cap Rate', field: 'year1CapRate', format: 'percent', icon: 'percent' },
    { id: 'totalGLA', label: 'Total GLA', field: 'totalStorageUnits', format: 'number', icon: 'ruler' },
    { id: 'noi', label: 'NOI', field: 'ebitda', format: 'currency', icon: 'trending-up' },
    { id: 'pricePerSF', label: '$/SF', field: 'pricePerUnit', format: 'currency', icon: 'dollar-sign' },
    { id: 'occupancy', label: 'Occupancy', field: 'avgOccupancy', format: 'percent', icon: 'bar-chart' },
  ],
  tabs: { storageLeases: false, commercialLeases: true, profitCenters: true },
  allowCustomUnitTypes: true,
  allowCustomDepartments: true,
  allowCustomGrowthCategories: true,
};


// ═══════════════════════════════════════════════════════════════
// Golf Course Config
// ═══════════════════════════════════════════════════════════════

const GOLF_COURSE_CONFIG: AssetClassModelConfig = {
  id: 'golf_course',
  label: 'Golf Course',
  terms: {
    unit: 'hole', unitPlural: 'holes',
    property: 'course', propertyPlural: 'courses',
    rentRoll: 'Membership & Rounds', occupancy: 'Utilization',
    noi: 'EBITDA', pricePerUnit: '$/Round', totalUnitsLabel: 'Total Holes',
  },
  valuationMetric: 'ebitda_multiple',
  valuationLabel: 'EBITDA Multiple',
  hasSeasonal: true,
  seasonConfig: {
    type: 'str',
    defaultInSeasonMonths: [4, 5, 6, 7, 8, 9, 10],
    seasonLabel: 'Golf Season',
    offSeasonLabel: 'Off Season',
  },
  unitMix: {
    tabLabel: 'Course Setup',
    tabIcon: 'flag',
    showTab: false,
    countColumnLabel: 'Holes',
    rateColumnLabel: 'Green Fee',
    rateType: 'monthly',
    showSF: false,
    types: [],
  },
  profitCenters: {
    tabLabel: 'Revenue Departments',
    showTab: true,
    departments: [
      { id: 'green_fees', name: 'Green Fees / Rounds', icon: 'flag', category: 'core', description: 'Daily green fee and tee time revenue',
        hasRevenue: true, hasCOGS: false, hasDirectLabor: true,
        revenueLines: ['18-Hole Green Fees', '9-Hole Green Fees', 'Twilight Rounds', 'Walking Rounds', 'Online Tee Time Fees'],
        expenseLines: ['Starter/Ranger Labor', 'Tee Time Software'] },
      { id: 'memberships', name: 'Memberships', icon: 'users', category: 'core', description: 'Monthly and annual membership dues',
        hasRevenue: true, hasCOGS: false, hasDirectLabor: false,
        revenueLines: ['Full Membership Dues', 'Social Membership Dues', 'Junior/Senior Memberships', 'Initiation Fees'] },
      { id: 'pro_shop', name: 'Pro Shop', icon: 'shopping-bag', category: 'core', description: 'Retail merchandise and equipment sales',
        hasRevenue: true, hasCOGS: true, hasDirectLabor: true,
        revenueLines: ['Hard Goods Sales', 'Soft Goods / Apparel', 'Accessory Sales'],
        cogsLines: ['Pro Shop COGS'], expenseLines: ['Pro Shop Staff Labor'] },
      { id: 'fb_restaurant', name: 'F&B / Restaurant', icon: 'utensils', category: 'core', description: 'Clubhouse food & beverage operations',
        hasRevenue: true, hasCOGS: true, hasDirectLabor: true,
        revenueLines: ['Restaurant Revenue', 'Bar/Beverage Revenue', 'Banquet Revenue', 'Beverage Cart Revenue'],
        cogsLines: ['Food COGS', 'Beverage COGS'], expenseLines: ['F&B Labor', 'F&B Supplies'] },
      { id: 'driving_range', name: 'Driving Range', icon: 'target', category: 'ancillary', description: 'Practice facility and range revenue',
        hasRevenue: true, hasCOGS: false, hasDirectLabor: true,
        revenueLines: ['Range Ball Revenue', 'Range Membership Revenue', 'Practice Facility Fees'],
        expenseLines: ['Range Attendant Labor', 'Ball & Equipment Maintenance'] },
      { id: 'tournaments_events', name: 'Tournament / Events', icon: 'trophy', category: 'ancillary', description: 'Tournament hosting and special events',
        hasRevenue: true, hasCOGS: true, hasDirectLabor: true,
        revenueLines: ['Tournament Entry Fees', 'Corporate Outing Revenue', 'Event Sponsorship'],
        cogsLines: ['Tournament Prizes & Supplies'], expenseLines: ['Event Coordination Labor'] },
      { id: 'cart_rentals', name: 'Cart Rentals', icon: 'car', category: 'ancillary', description: 'Golf cart rental revenue',
        hasRevenue: true, hasCOGS: false, hasDirectLabor: false,
        revenueLines: ['Cart Rental Revenue', 'Trail Fee Revenue', 'Private Cart Storage'] },
      { id: 'instruction', name: 'Golf Instruction', icon: 'user', category: 'ancillary', description: 'Lessons and golf instruction programs',
        hasRevenue: true, hasCOGS: false, hasDirectLabor: true,
        revenueLines: ['Private Lesson Revenue', 'Group Clinic Revenue', 'Junior Program Revenue'],
        expenseLines: ['Instructor Compensation'] },
    ],
  },
  inputSections: [
    { id: 'general', label: 'General Assumptions', icon: 'settings', fields: [
      { id: 'purchasePrice', label: 'Purchase Price', type: 'currency', width: 'half' },
      { id: 'closingDate', label: 'Closing Date', type: 'text', width: 'half' },
      { id: 'holdPeriod', label: 'Hold Period (Years)', type: 'integer', width: 'half', defaultValue: 7 },
      { id: 'numberOfHoles', label: 'Number of Holes', type: 'integer', width: 'half', defaultValue: 18 },
      { id: 'courseType', label: 'Course Type', type: 'select', width: 'half',
        options: [
          { value: 'public_daily', label: 'Public / Daily Fee' },
          { value: 'semi_private', label: 'Semi-Private' },
          { value: 'private', label: 'Private' },
          { value: 'resort', label: 'Resort' },
          { value: 'municipal', label: 'Municipal' },
        ]},
      { id: 'acreage', label: 'Total Acreage', type: 'number', width: 'half' },
      { id: 'yearBuilt', label: 'Year Built / Redesigned', type: 'integer', width: 'half' },
    ]},
    { id: 'operations', label: 'Operations', icon: 'bar-chart', fields: [
      { id: 'annualRounds', label: 'Annual Rounds', type: 'integer', width: 'half' },
      { id: 'avgGreenFee', label: 'Avg Green Fee', type: 'currency', width: 'half' },
      { id: 'memberCount', label: 'Active Members', type: 'integer', width: 'half' },
      { id: 'avgMembershipDues', label: 'Avg Membership Dues / Mo', type: 'currency', width: 'half' },
      { id: 'roundsCapacity', label: 'Daily Rounds Capacity', type: 'integer', width: 'half', tooltip: 'Maximum rounds per day based on tee time intervals' },
      { id: 'utilizationPercent', label: 'Utilization %', type: 'percent', width: 'half', defaultValue: 55 },
    ]},
    { id: 'expenses', label: 'Operating Expenses', icon: 'receipt', fields: [
      { id: 'courseMaintenanceAnnual', label: 'Course Maintenance / Year', type: 'currency', width: 'half', tooltip: 'Turf care, irrigation, chemicals, sand, and grounds crew labor' },
      { id: 'payrollBenefits', label: 'Total Payroll & Benefits / Year', type: 'currency', width: 'half' },
      { id: 'equipmentLeaseAnnual', label: 'Equipment Lease / Year', type: 'currency', width: 'half' },
      { id: 'utilitiesAnnual', label: 'Utilities / Year', type: 'currency', width: 'half' },
      { id: 'insuranceAnnual', label: 'Insurance / Year', type: 'currency', width: 'half' },
      { id: 'propertyTaxAnnual', label: 'Property Tax / Year', type: 'currency', width: 'half' },
      { id: 'capexReservePercent', label: 'CapEx Reserve %', type: 'percent', width: 'half', defaultValue: 5 },
    ]},
  ],
  growthCategories: [
    { id: 'green_fee_revenue', label: 'Green Fee Revenue Growth', icon: 'trending-up', description: 'Daily fee and rounds revenue growth', defaultRate: 3.0 },
    { id: 'membership_revenue', label: 'Membership Revenue Growth', icon: 'users', description: 'Membership dues and initiation fee growth', defaultRate: 2.5 },
    { id: 'fb_revenue', label: 'F&B Revenue Growth', icon: 'utensils', description: 'Clubhouse food and beverage growth', defaultRate: 2.5 },
    { id: 'pro_shop_revenue', label: 'Pro Shop Revenue Growth', icon: 'shopping-bag', description: 'Retail merchandise revenue growth', defaultRate: 2.0 },
    { id: 'other_revenue', label: 'Other Revenue Growth', icon: 'layers', description: 'Range, carts, events, and instruction', defaultRate: 2.0 },
    { id: 'operating_expenses', label: 'Operating Expense Growth', icon: 'arrow-up', description: 'Course maintenance and general OpEx', defaultRate: 3.0 },
    { id: 'payroll', label: 'Payroll Growth', icon: 'users', description: 'Staff wages and benefits inflation', defaultRate: 3.5 },
    { id: 'insurance', label: 'Insurance Growth', icon: 'shield', description: 'Property and liability insurance', defaultRate: 5.0 },
    { id: 'property_tax', label: 'Property Tax Growth', icon: 'building', description: 'Annual tax assessment increases', defaultRate: 2.0 },
  ],
  kpis: [
    { id: 'purchasePrice', label: 'Purchase Price', field: 'purchasePrice', format: 'currency', icon: 'dollar-sign' },
    { id: 'ebitdaMultiple', label: 'EBITDA Multiple', field: 'ebitdaMultiple', format: 'multiple', icon: 'x' },
    { id: 'ebitda', label: 'EBITDA', field: 'ebitda', format: 'currency', icon: 'trending-up' },
    { id: 'annualRounds', label: 'Annual Rounds', field: 'annualRounds', format: 'number', icon: 'flag' },
    { id: 'avgGreenFee', label: 'Avg Green Fee', field: 'avgGreenFee', format: 'currency', icon: 'dollar-sign' },
    { id: 'utilization', label: 'Utilization', field: 'utilizationPercent', format: 'percent', icon: 'bar-chart' },
  ],
  tabs: { storageLeases: false, commercialLeases: false, profitCenters: true },
  allowCustomUnitTypes: true,
  allowCustomDepartments: true,
  allowCustomGrowthCategories: true,
};


// ═══════════════════════════════════════════════════════════════
// Landscaping Company Config
// ═══════════════════════════════════════════════════════════════

const LANDSCAPING_CONFIG: AssetClassModelConfig = {
  id: 'landscaping',
  label: 'Landscaping Company',
  terms: {
    unit: 'crew', unitPlural: 'crews',
    property: 'company', propertyPlural: 'companies',
    rentRoll: 'Revenue Breakdown', occupancy: 'Utilization',
    noi: 'EBITDA', pricePerUnit: '$/Crew', totalUnitsLabel: 'Total Crews',
  },
  valuationMetric: 'ebitda_multiple',
  valuationLabel: 'EBITDA / SDE Multiple',
  hasSeasonal: true,
  seasonConfig: {
    type: 'str',
    defaultInSeasonMonths: [3, 4, 5, 6, 7, 8, 9, 10],
    seasonLabel: 'Growing Season',
    offSeasonLabel: 'Off Season',
  },
  unitMix: {
    tabLabel: 'Crew Setup',
    tabIcon: 'users',
    showTab: false,
    countColumnLabel: 'Crews',
    rateColumnLabel: 'Revenue / Crew',
    rateType: 'monthly',
    showSF: false,
    types: [],
  },
  profitCenters: {
    tabLabel: 'Service Departments',
    showTab: true,
    departments: [
      { id: 'maintenance', name: 'Maintenance / Mowing', icon: 'scissors', category: 'core', description: 'Recurring lawn maintenance and mowing contracts',
        hasRevenue: true, hasCOGS: true, hasDirectLabor: true,
        revenueLines: ['Residential Maintenance Revenue', 'Commercial Maintenance Revenue', 'HOA Contract Revenue'],
        cogsLines: ['Fuel & Equipment Costs', 'Materials & Supplies'], expenseLines: ['Crew Labor', 'Vehicle Maintenance'] },
      { id: 'design_install', name: 'Design / Install', icon: 'palette', category: 'core', description: 'Landscape design and installation projects',
        hasRevenue: true, hasCOGS: true, hasDirectLabor: true,
        revenueLines: ['Design Fee Revenue', 'Installation Revenue', 'Plant & Material Markup'],
        cogsLines: ['Plant & Material COGS', 'Subcontractor Costs'], expenseLines: ['Install Crew Labor', 'Equipment Rental'] },
      { id: 'hardscape', name: 'Hardscape', icon: 'layers', category: 'core', description: 'Patios, retaining walls, walkways, and outdoor structures',
        hasRevenue: true, hasCOGS: true, hasDirectLabor: true,
        revenueLines: ['Hardscape Project Revenue', 'Material Markup'],
        cogsLines: ['Stone/Paver/Concrete COGS', 'Subcontractor Costs'], expenseLines: ['Hardscape Crew Labor'] },
      { id: 'irrigation', name: 'Irrigation', icon: 'droplet', category: 'ancillary', description: 'Irrigation system installation and maintenance',
        hasRevenue: true, hasCOGS: true, hasDirectLabor: true,
        revenueLines: ['Irrigation Install Revenue', 'Irrigation Maintenance/Repair Revenue', 'Winterization/Spring Startup'],
        cogsLines: ['Irrigation Parts & Materials'], expenseLines: ['Irrigation Technician Labor'] },
      { id: 'snow_removal', name: 'Snow Removal', icon: 'cloud-snow', category: 'ancillary', description: 'Winter snow plowing and ice management',
        hasRevenue: true, hasCOGS: true, hasDirectLabor: true,
        revenueLines: ['Snow Plowing Revenue', 'Salting/De-Icing Revenue', 'Per-Push Revenue', 'Seasonal Snow Contracts'],
        cogsLines: ['Salt & De-Icer COGS', 'Plow Equipment Maintenance'], expenseLines: ['Snow Crew Labor'] },
      { id: 'tree_service', name: 'Tree Service', icon: 'tree-deciduous', category: 'ancillary', description: 'Tree trimming, removal, and stump grinding',
        hasRevenue: true, hasCOGS: true, hasDirectLabor: true,
        revenueLines: ['Tree Trimming Revenue', 'Tree Removal Revenue', 'Stump Grinding Revenue'],
        cogsLines: ['Equipment & Disposal Costs'], expenseLines: ['Arborist/Crew Labor'] },
    ],
  },
  inputSections: [
    { id: 'general', label: 'General Assumptions', icon: 'settings', fields: [
      { id: 'purchasePrice', label: 'Purchase Price', type: 'currency', width: 'half' },
      { id: 'closingDate', label: 'Closing Date', type: 'text', width: 'half' },
      { id: 'holdPeriod', label: 'Hold Period (Years)', type: 'integer', width: 'half', defaultValue: 5 },
      { id: 'numberOfCrews', label: 'Number of Crews', type: 'integer', width: 'half' },
      { id: 'numberOfEmployees', label: 'Total Employees (FTEs)', type: 'integer', width: 'half' },
      { id: 'yearsInOperation', label: 'Years in Operation', type: 'integer', width: 'half' },
      { id: 'serviceArea', label: 'Service Area Radius (miles)', type: 'number', width: 'half' },
    ]},
    { id: 'revenue', label: 'Revenue Breakdown', icon: 'dollar-sign', fields: [
      { id: 'maintenanceRevenueAnnual', label: 'Maintenance Revenue / Year', type: 'currency', width: 'half' },
      { id: 'installRevenueAnnual', label: 'Install / Design Revenue / Year', type: 'currency', width: 'half' },
      { id: 'snowRemovalRevenueAnnual', label: 'Snow Removal Revenue / Year', type: 'currency', width: 'half' },
      { id: 'otherRevenueAnnual', label: 'Other Revenue / Year', type: 'currency', width: 'half' },
      { id: 'recurringRevenuePercent', label: 'Recurring Revenue %', type: 'percent', width: 'half', defaultValue: 60, tooltip: 'Percentage of revenue from recurring maintenance contracts' },
      { id: 'customerCount', label: 'Active Customers', type: 'integer', width: 'half' },
    ]},
    { id: 'expenses', label: 'Operating Expenses', icon: 'receipt', fields: [
      { id: 'payrollBenefits', label: 'Payroll & Benefits / Year', type: 'currency', width: 'half' },
      { id: 'vehicleFuelAnnual', label: 'Vehicle & Fuel / Year', type: 'currency', width: 'half' },
      { id: 'equipmentMaintenanceAnnual', label: 'Equipment Maintenance / Year', type: 'currency', width: 'half' },
      { id: 'materialsSuppliesAnnual', label: 'Materials & Supplies / Year', type: 'currency', width: 'half' },
      { id: 'insuranceAnnual', label: 'Insurance / Year', type: 'currency', width: 'half' },
      { id: 'rentLeaseAnnual', label: 'Yard/Shop Rent / Year', type: 'currency', width: 'half' },
      { id: 'ownerCompensation', label: 'Owner Compensation / Year', type: 'currency', width: 'half' },
      { id: 'addbacks', label: 'Total Seller Add-Backs / Year', type: 'currency', width: 'half' },
    ]},
  ],
  growthCategories: [
    { id: 'maintenance_revenue', label: 'Maintenance Revenue Growth', icon: 'trending-up', description: 'Recurring lawn care and maintenance contract growth', defaultRate: 5.0 },
    { id: 'install_revenue', label: 'Install Revenue Growth', icon: 'palette', description: 'Design/install project revenue growth', defaultRate: 4.0 },
    { id: 'snow_revenue', label: 'Snow Removal Revenue Growth', icon: 'cloud-snow', description: 'Winter services revenue growth', defaultRate: 3.0 },
    { id: 'cogs', label: 'COGS Growth', icon: 'package', description: 'Material, fuel, and direct cost inflation', defaultRate: 3.0 },
    { id: 'payroll', label: 'Payroll Growth', icon: 'users', description: 'Crew and staff wage growth', defaultRate: 4.0 },
    { id: 'operating_expenses', label: 'Operating Expense Growth', icon: 'arrow-up', description: 'Vehicle, equipment, and general overhead', defaultRate: 3.0 },
    { id: 'insurance', label: 'Insurance Growth', icon: 'shield', description: 'General liability and workers comp', defaultRate: 4.0 },
  ],
  kpis: [
    { id: 'purchasePrice', label: 'Purchase Price', field: 'purchasePrice', format: 'currency', icon: 'dollar-sign' },
    { id: 'ebitdaMultiple', label: 'EBITDA Multiple', field: 'ebitdaMultiple', format: 'multiple', icon: 'x' },
    { id: 'ebitda', label: 'EBITDA', field: 'ebitda', format: 'currency', icon: 'trending-up' },
    { id: 'revenue', label: 'Revenue', field: 'totalRevenue', format: 'currency', icon: 'dollar-sign' },
    { id: 'crews', label: 'Crews', field: 'numberOfCrews', format: 'number', icon: 'users' },
    { id: 'recurringPercent', label: 'Recurring %', field: 'recurringRevenuePercent', format: 'percent', icon: 'refresh-cw' },
  ],
  tabs: { storageLeases: false, commercialLeases: false, profitCenters: true },
  allowCustomUnitTypes: true,
  allowCustomDepartments: true,
  allowCustomGrowthCategories: true,
};


// ═══════════════════════════════════════════════════════════════
// Construction Company Config
// ═══════════════════════════════════════════════════════════════

const CONSTRUCTION_CONFIG: AssetClassModelConfig = {
  id: 'construction',
  label: 'Construction Company',
  terms: {
    unit: 'project', unitPlural: 'projects',
    property: 'company', propertyPlural: 'companies',
    rentRoll: 'Project Backlog', occupancy: 'Utilization',
    noi: 'EBITDA', pricePerUnit: 'Backlog Value', totalUnitsLabel: 'Active Projects',
  },
  valuationMetric: 'ebitda_multiple',
  valuationLabel: 'EBITDA Multiple',
  hasSeasonal: false,
  seasonConfig: { type: 'none' },
  unitMix: {
    tabLabel: 'Project Types',
    tabIcon: 'hard-hat',
    showTab: false,
    countColumnLabel: 'Projects',
    rateColumnLabel: 'Avg Contract Value',
    rateType: 'monthly',
    showSF: false,
    types: [],
  },
  profitCenters: {
    tabLabel: 'Revenue Departments',
    showTab: true,
    departments: [
      { id: 'general_contracting', name: 'General Contracting', icon: 'building', category: 'core', description: 'GC project revenue and overhead',
        hasRevenue: true, hasCOGS: true, hasDirectLabor: true,
        revenueLines: ['Contract Revenue', 'Change Order Revenue', 'Owner-Direct Revenue'],
        cogsLines: ['Subcontractor Costs', 'Materials & Supplies', 'Direct Job Costs'], expenseLines: ['Project Manager Labor', 'Superintendent Labor'] },
      { id: 'specialty_trade', name: 'Specialty Trade', icon: 'wrench', category: 'core', description: 'Specialty trade or subcontractor division revenue',
        hasRevenue: true, hasCOGS: true, hasDirectLabor: true,
        revenueLines: ['Trade Revenue', 'Service / Repair Revenue'],
        cogsLines: ['Trade Materials', 'Subcontractor Costs'], expenseLines: ['Trade Labor'] },
      { id: 'project_management', name: 'Project Management', icon: 'clipboard', category: 'ancillary', description: 'Construction management and consulting fees',
        hasRevenue: true, hasCOGS: false, hasDirectLabor: true,
        revenueLines: ['CM Fee Revenue', 'Consulting / Advisory Revenue', 'Pre-Construction Services'],
        expenseLines: ['PM Staff Labor'] },
      { id: 'equipment_rental', name: 'Equipment Rental', icon: 'truck', category: 'ancillary', description: 'Internal and external equipment rental revenue',
        hasRevenue: true, hasCOGS: false, hasDirectLabor: false,
        revenueLines: ['Internal Equipment Charges', 'External Rental Revenue', 'Equipment Mobilization Fees'] },
    ],
  },
  inputSections: [
    { id: 'general', label: 'General Assumptions', icon: 'settings', fields: [
      { id: 'purchasePrice', label: 'Purchase Price', type: 'currency', width: 'half' },
      { id: 'closingDate', label: 'Closing Date', type: 'text', width: 'half' },
      { id: 'holdPeriod', label: 'Hold Period (Years)', type: 'integer', width: 'half', defaultValue: 5 },
      { id: 'yearsInOperation', label: 'Years in Operation', type: 'integer', width: 'half' },
      { id: 'numberOfEmployees', label: 'Total Employees (FTEs)', type: 'integer', width: 'half' },
      { id: 'numberOfLocations', label: 'Number of Offices', type: 'integer', width: 'half', defaultValue: 1 },
    ]},
    { id: 'backlog', label: 'Backlog & Pipeline', icon: 'bar-chart', fields: [
      { id: 'currentBacklog', label: 'Current Backlog ($)', type: 'currency', width: 'half', tooltip: 'Total value of signed contracts not yet completed' },
      { id: 'avgProjectSize', label: 'Avg Project Size', type: 'currency', width: 'half' },
      { id: 'winRatePercent', label: 'Win Rate %', type: 'percent', width: 'half', defaultValue: 25, tooltip: 'Percentage of bids/proposals that convert to contracts' },
      { id: 'bondingCapacity', label: 'Bonding Capacity', type: 'currency', width: 'half', tooltip: 'Aggregate and single project bonding limits' },
      { id: 'avgProjectDuration', label: 'Avg Project Duration (Months)', type: 'number', width: 'half' },
      { id: 'activeProjects', label: 'Active Projects', type: 'integer', width: 'half' },
    ]},
    { id: 'financials', label: 'Financial Summary', icon: 'dollar-sign', fields: [
      { id: 'totalRevenueLastYear', label: 'Total Revenue (Last 12 Months)', type: 'currency', width: 'half' },
      { id: 'grossMarginPercent', label: 'Gross Margin %', type: 'percent', width: 'half', defaultValue: 18 },
      { id: 'sgaPercent', label: 'SG&A % of Revenue', type: 'percent', width: 'half', defaultValue: 10 },
      { id: 'ownerCompensation', label: 'Owner Compensation / Year', type: 'currency', width: 'half' },
      { id: 'addbacks', label: 'Total Seller Add-Backs / Year', type: 'currency', width: 'half' },
      { id: 'equipmentValue', label: 'Equipment & Vehicle Value', type: 'currency', width: 'half' },
    ]},
  ],
  growthCategories: [
    { id: 'contract_revenue', label: 'Contract Revenue Growth', icon: 'trending-up', description: 'Top-line revenue growth driven by backlog growth and project size', defaultRate: 5.0 },
    { id: 'cogs', label: 'COGS Growth', icon: 'package', description: 'Subcontractor, materials, and direct job cost inflation', defaultRate: 3.0 },
    { id: 'payroll', label: 'Payroll Growth', icon: 'users', description: 'Field and office staff wage growth', defaultRate: 3.5 },
    { id: 'operating_expenses', label: 'Operating Expense Growth', icon: 'arrow-up', description: 'SG&A and overhead inflation', defaultRate: 2.5 },
    { id: 'insurance', label: 'Insurance Growth', icon: 'shield', description: 'GL, workers comp, and builders risk premium growth', defaultRate: 5.0 },
    { id: 'equipment', label: 'Equipment Cost Growth', icon: 'truck', description: 'Equipment lease and maintenance cost inflation', defaultRate: 3.0 },
  ],
  kpis: [
    { id: 'purchasePrice', label: 'Purchase Price', field: 'purchasePrice', format: 'currency', icon: 'dollar-sign' },
    { id: 'ebitdaMultiple', label: 'EBITDA Multiple', field: 'ebitdaMultiple', format: 'multiple', icon: 'x' },
    { id: 'revenue', label: 'Revenue', field: 'totalRevenue', format: 'currency', icon: 'trending-up' },
    { id: 'ebitda', label: 'EBITDA', field: 'ebitda', format: 'currency', icon: 'dollar-sign' },
    { id: 'backlog', label: 'Backlog', field: 'currentBacklog', format: 'currency', icon: 'bar-chart' },
    { id: 'grossMargin', label: 'Gross Margin', field: 'grossMarginPercent', format: 'percent', icon: 'percent' },
  ],
  tabs: { storageLeases: false, commercialLeases: false, profitCenters: true },
  allowCustomUnitTypes: true,
  allowCustomDepartments: true,
  allowCustomGrowthCategories: true,
};


// ═══════════════════════════════════════════════════════════════
// Accounting / CPA Firm Config
// ═══════════════════════════════════════════════════════════════

const ACCOUNTING_FIRM_CONFIG: AssetClassModelConfig = {
  id: 'accounting_firm',
  label: 'Accounting / CPA Firm',
  terms: {
    unit: 'client', unitPlural: 'clients',
    property: 'firm', propertyPlural: 'firms',
    rentRoll: 'Revenue Breakdown', occupancy: 'Utilization',
    noi: 'SDE', pricePerUnit: '$/Client', totalUnitsLabel: 'Total Clients',
  },
  valuationMetric: 'ebitda_multiple',
  valuationLabel: 'Revenue Multiple',
  hasSeasonal: false,
  seasonConfig: { type: 'none' },
  unitMix: {
    tabLabel: 'Client Mix',
    tabIcon: 'users',
    showTab: false,
    countColumnLabel: 'Clients',
    rateColumnLabel: 'Avg Revenue / Client',
    rateType: 'monthly',
    showSF: false,
    types: [],
  },
  profitCenters: {
    tabLabel: 'Service Lines',
    showTab: true,
    departments: [
      { id: 'tax_preparation', name: 'Tax Preparation', icon: 'file-text', category: 'core', description: 'Individual and business tax return preparation',
        hasRevenue: true, hasCOGS: false, hasDirectLabor: true,
        revenueLines: ['Individual Tax Returns', 'Business Tax Returns', 'Tax Planning & Advisory', 'Amended Returns & Audit Defense'],
        expenseLines: ['Tax Staff Labor', 'Tax Software Licenses'] },
      { id: 'audit_assurance', name: 'Audit / Assurance', icon: 'check-circle', category: 'core', description: 'Audit, review, and compilation engagements',
        hasRevenue: true, hasCOGS: false, hasDirectLabor: true,
        revenueLines: ['Audit Engagement Revenue', 'Review Engagement Revenue', 'Compilation Revenue', 'Agreed-Upon Procedures'],
        expenseLines: ['Audit Staff Labor'] },
      { id: 'advisory_consulting', name: 'Advisory / Consulting', icon: 'briefcase', category: 'core', description: 'Business advisory and consulting services',
        hasRevenue: true, hasCOGS: false, hasDirectLabor: true,
        revenueLines: ['Business Valuation Revenue', 'M&A Advisory Revenue', 'CFO / Controller Services', 'Strategic Planning'],
        expenseLines: ['Advisory Staff Labor'] },
      { id: 'bookkeeping', name: 'Bookkeeping', icon: 'book', category: 'ancillary', description: 'Monthly bookkeeping and accounting services',
        hasRevenue: true, hasCOGS: false, hasDirectLabor: true,
        revenueLines: ['Monthly Bookkeeping Revenue', 'Cleanup / Catch-Up Revenue', 'Financial Statement Preparation'],
        expenseLines: ['Bookkeeper Labor'] },
      { id: 'payroll_services', name: 'Payroll Services', icon: 'credit-card', category: 'ancillary', description: 'Payroll processing and compliance',
        hasRevenue: true, hasCOGS: false, hasDirectLabor: true,
        revenueLines: ['Payroll Processing Revenue', 'Payroll Tax Filing Revenue', 'W-2/1099 Preparation'],
        expenseLines: ['Payroll Staff Labor', 'Payroll Software'] },
    ],
  },
  inputSections: [
    { id: 'general', label: 'General Assumptions', icon: 'settings', fields: [
      { id: 'purchasePrice', label: 'Purchase Price', type: 'currency', width: 'half' },
      { id: 'closingDate', label: 'Closing Date', type: 'text', width: 'half' },
      { id: 'holdPeriod', label: 'Hold Period (Years)', type: 'integer', width: 'half', defaultValue: 5 },
      { id: 'numberOfClients', label: 'Total Active Clients', type: 'integer', width: 'half' },
      { id: 'numberOfStaff', label: 'Professional Staff (FTEs)', type: 'integer', width: 'half' },
      { id: 'yearsInOperation', label: 'Years in Operation', type: 'integer', width: 'half' },
    ]},
    { id: 'revenue', label: 'Revenue Breakdown', icon: 'dollar-sign', fields: [
      { id: 'totalRevenueLastYear', label: 'Total Revenue (Last 12 Months)', type: 'currency', width: 'half' },
      { id: 'taxRevenuePercent', label: 'Tax Revenue %', type: 'percent', width: 'half', defaultValue: 50 },
      { id: 'recurringRevenuePercent', label: 'Recurring Revenue %', type: 'percent', width: 'half', defaultValue: 75 },
      { id: 'avgRevenuePerClient', label: 'Avg Revenue / Client', type: 'currency', width: 'half' },
      { id: 'clientRetentionRate', label: 'Client Retention Rate %', type: 'percent', width: 'half', defaultValue: 90 },
      { id: 'topClientConcentration', label: 'Top Client % of Revenue', type: 'percent', width: 'half', tooltip: 'Revenue concentration in largest single client' },
    ]},
    { id: 'expenses', label: 'Operating Expenses', icon: 'receipt', fields: [
      { id: 'payrollBenefits', label: 'Payroll & Benefits / Year', type: 'currency', width: 'half' },
      { id: 'rentLeaseAnnual', label: 'Office Rent / Year', type: 'currency', width: 'half' },
      { id: 'technologySoftware', label: 'Technology & Software / Year', type: 'currency', width: 'half' },
      { id: 'professionalDevelopment', label: 'CPE & Professional Dev / Year', type: 'currency', width: 'half' },
      { id: 'insuranceAnnual', label: 'Insurance (E&O + GL) / Year', type: 'currency', width: 'half' },
      { id: 'ownerCompensation', label: 'Owner Compensation / Year', type: 'currency', width: 'half' },
      { id: 'addbacks', label: 'Total Seller Add-Backs / Year', type: 'currency', width: 'half' },
    ]},
  ],
  growthCategories: [
    { id: 'tax_revenue', label: 'Tax Revenue Growth', icon: 'file-text', description: 'Tax preparation and advisory revenue growth', defaultRate: 5.0 },
    { id: 'audit_revenue', label: 'Audit Revenue Growth', icon: 'check-circle', description: 'Audit and assurance engagement growth', defaultRate: 3.0 },
    { id: 'advisory_revenue', label: 'Advisory Revenue Growth', icon: 'briefcase', description: 'Consulting and advisory services growth', defaultRate: 7.0 },
    { id: 'bookkeeping_revenue', label: 'Bookkeeping Revenue Growth', icon: 'book', description: 'Monthly recurring bookkeeping growth', defaultRate: 5.0 },
    { id: 'payroll', label: 'Staff Payroll Growth', icon: 'users', description: 'Professional staff compensation growth', defaultRate: 4.0 },
    { id: 'operating_expenses', label: 'Operating Expense Growth', icon: 'arrow-up', description: 'Rent, technology, and general overhead', defaultRate: 3.0 },
    { id: 'insurance', label: 'Insurance Growth', icon: 'shield', description: 'E&O and general liability premium growth', defaultRate: 4.0 },
  ],
  kpis: [
    { id: 'purchasePrice', label: 'Purchase Price', field: 'purchasePrice', format: 'currency', icon: 'dollar-sign' },
    { id: 'revenueMultiple', label: 'Revenue Multiple', field: 'ebitdaMultiple', format: 'multiple', icon: 'x' },
    { id: 'revenue', label: 'Revenue', field: 'totalRevenue', format: 'currency', icon: 'trending-up' },
    { id: 'sde', label: 'SDE', field: 'ebitda', format: 'currency', icon: 'dollar-sign' },
    { id: 'clients', label: 'Clients', field: 'numberOfClients', format: 'number', icon: 'users' },
    { id: 'retention', label: 'Retention', field: 'clientRetentionRate', format: 'percent', icon: 'refresh-cw' },
  ],
  tabs: { storageLeases: false, commercialLeases: false, profitCenters: true },
  allowCustomUnitTypes: true,
  allowCustomDepartments: true,
  allowCustomGrowthCategories: true,
};


// ═══════════════════════════════════════════════════════════════
// RV Park / Campground Config
// ═══════════════════════════════════════════════════════════════

const RV_PARK_CONFIG: AssetClassModelConfig = {
  id: 'rv_park',
  label: 'RV Park / Campground',
  terms: {
    unit: 'site', unitPlural: 'sites',
    property: 'park', propertyPlural: 'parks',
    rentRoll: 'Site Inventory', occupancy: 'Occupancy',
    noi: 'NOI', pricePerUnit: '$/Site', totalUnitsLabel: 'Total Sites',
  },
  valuationMetric: 'cap_rate',
  valuationLabel: 'Cap Rate',
  hasSeasonal: true,
  seasonConfig: {
    type: 'str',
    defaultInSeasonMonths: [4, 5, 6, 7, 8, 9, 10],
    seasonLabel: 'Peak Season',
    offSeasonLabel: 'Off Season',
  },
  unitMix: {
    tabLabel: 'Site Inventory',
    tabIcon: 'tent',
    showTab: true,
    countColumnLabel: 'Sites',
    rateColumnLabel: 'Rate / Night',
    rateType: 'nightly',
    showSF: false,
    types: [
      { id: 'full_hookup_rv', name: 'Full Hookup RV', icon: 'truck', section: 'RV Sites', hasSeasons: true, defaultFields: { count: 0 } },
      { id: 'water_electric_rv', name: 'Water / Electric RV', icon: 'truck', section: 'RV Sites', hasSeasons: true, defaultFields: { count: 0 } },
      { id: 'dry_camping', name: 'Dry Camping', icon: 'tent', section: 'Tent & Basic', hasSeasons: true, defaultFields: { count: 0 } },
      { id: 'tent_site', name: 'Tent Site', icon: 'tent', section: 'Tent & Basic', hasSeasons: true, defaultFields: { count: 0 } },
      { id: 'cabin_glamping', name: 'Cabin / Glamping', icon: 'home', section: 'Accommodations', hasSeasons: true, defaultFields: { count: 0 } },
      { id: 'park_model', name: 'Park Model', icon: 'home', section: 'Accommodations', hasSeasons: false, defaultFields: { count: 0 } },
      { id: 'seasonal_annual', name: 'Seasonal / Annual', icon: 'calendar', section: 'Long-Term', hasSeasons: false, defaultFields: { count: 0 } },
      { id: 'rally_event_site', name: 'Rally / Event Site', icon: 'flag', section: 'Special', hasSeasons: true, defaultFields: { count: 0 } },
    ],
  },
  profitCenters: {
    tabLabel: 'Revenue Departments',
    showTab: true,
    departments: [
      { id: 'site_revenue', name: 'Site Revenue', icon: 'tent', category: 'core', description: 'Core site rental revenue across all site types',
        hasRevenue: true, hasCOGS: false, hasDirectLabor: true,
        revenueLines: ['Nightly Site Revenue', 'Weekly Site Revenue', 'Monthly Site Revenue', 'Seasonal/Annual Site Revenue'],
        expenseLines: ['Front Desk / Check-In Labor', 'Site Maintenance Labor'] },
      { id: 'camp_store', name: 'Camp Store', icon: 'store', category: 'core', description: 'On-site general store and supplies',
        hasRevenue: true, hasCOGS: true, hasDirectLabor: true,
        revenueLines: ['Grocery & Supplies Revenue', 'RV Parts & Accessories', 'Souvenirs & Gifts', 'Ice & Firewood'],
        cogsLines: ['Store COGS'], expenseLines: ['Store Clerk Labor'] },
      { id: 'propane', name: 'Propane', icon: 'flame', category: 'ancillary', description: 'Propane sales and refills',
        hasRevenue: true, hasCOGS: true, hasDirectLabor: false,
        revenueLines: ['Propane Sales Revenue'],
        cogsLines: ['Propane COGS'] },
      { id: 'laundry', name: 'Laundry', icon: 'home', category: 'ancillary', description: 'Coin-operated laundry facilities',
        hasRevenue: true, hasCOGS: false, hasDirectLabor: false,
        revenueLines: ['Laundry Revenue'] },
      { id: 'pool_amenity', name: 'Pool / Amenity Fees', icon: 'waves', category: 'ancillary', description: 'Pool, hot tub, and amenity access fees',
        hasRevenue: true, hasCOGS: false, hasDirectLabor: true,
        revenueLines: ['Pool Access Fees', 'Hot Tub Access', 'Playground / Game Room Revenue', 'Activity & Event Fees'],
        expenseLines: ['Lifeguard / Activity Staff Labor'] },
      { id: 'equipment_rental', name: 'Equipment Rental', icon: 'bike', category: 'ancillary', description: 'Bike, kayak, and recreation equipment rentals',
        hasRevenue: true, hasCOGS: false, hasDirectLabor: false,
        revenueLines: ['Bike Rental Revenue', 'Kayak / Canoe Rental', 'Sports Equipment Rental'] },
    ],
  },
  inputSections: [
    {
      id: 'property_details',
      label: 'Property Details',
      icon: 'tent',
      fields: [
        { id: 'purchasePrice', label: 'Purchase Price', type: 'currency', width: 'half' },
        { id: 'totalSites', label: 'Total Sites', type: 'integer', width: 'half' },
        { id: 'pullThroughSites', label: 'Pull-Through Sites', type: 'integer', width: 'half', tooltip: 'Sites that allow drive-through without backing up; command premium rates' },
        { id: 'backInSites', label: 'Back-In Sites', type: 'integer', width: 'half' },
        { id: 'tentSites', label: 'Tent Sites', type: 'integer', width: 'half' },
        { id: 'cabinUnits', label: 'Cabin / Glamping Units', type: 'integer', width: 'half' },
        { id: 'permanentSites', label: 'Permanent / Annual Sites', type: 'integer', width: 'half', tooltip: 'Sites leased on monthly or annual basis to long-term residents' },
        { id: 'totalAcres', label: 'Total Acres', type: 'number', width: 'half' },
        { id: 'yearEstablished', label: 'Year Established', type: 'integer', width: 'half' },
        { id: 'fullHookupCount', label: 'Full Hookup Sites (W/E/S)', type: 'integer', width: 'half', tooltip: 'Sites with water, electric, and sewer hookups' },
        { id: 'partialHookupCount', label: 'Partial Hookup Sites (W/E)', type: 'integer', width: 'half', tooltip: 'Sites with water and electric only' },
        { id: 'noHookupCount', label: 'No Hookup / Dry Sites', type: 'integer', width: 'half' },
      ],
    },
    {
      id: 'revenue',
      label: 'Revenue Assumptions',
      icon: 'dollar-sign',
      fields: [
        { id: 'avgNightlyRate', label: 'Avg Nightly Rate', type: 'currency', width: 'half', tooltip: 'Blended average nightly rate across all transient site types' },
        { id: 'avgMonthlyRate', label: 'Avg Monthly Rate (Permanent)', type: 'currency', width: 'half', tooltip: 'Monthly rate for permanent/annual sites including utilities' },
        { id: 'weeklyRate', label: 'Avg Weekly Rate', type: 'currency', width: 'half' },
        { id: 'seasonalOccupancy', label: 'Peak Season Occupancy %', type: 'percent', width: 'half', defaultValue: 80, tooltip: 'Average occupancy during peak season months (May-Sep for most markets)' },
        { id: 'annualOccupancy', label: 'Annual Avg Occupancy %', type: 'percent', width: 'half', defaultValue: 55, tooltip: 'Blended annual average occupancy across all site types' },
        { id: 'storeRevenue', label: 'Camp Store Revenue / Year', type: 'currency', width: 'half' },
        { id: 'propaneRevenue', label: 'Propane Revenue / Year', type: 'currency', width: 'half' },
        { id: 'laundryRevenue', label: 'Laundry Revenue / Year', type: 'currency', width: 'half' },
        { id: 'activityFeeRevenue', label: 'Activity & Event Fee Revenue / Year', type: 'currency', width: 'half', tooltip: 'Revenue from organized activities, events, and recreation programs' },
        { id: 'dumpStationFeeRevenue', label: 'Dump Station Fee Revenue / Year', type: 'currency', width: 'half', tooltip: 'Fees charged to non-guests for dump station use' },
        { id: 'wifiPremiumRevenue', label: 'WiFi Premium Revenue / Year', type: 'currency', width: 'half', tooltip: 'Revenue from premium/upgraded WiFi tiers' },
      ],
    },
    {
      id: 'expenses',
      label: 'Operating Expenses',
      icon: 'receipt',
      fields: [
        { id: 'parkManagerSalary', label: 'Park Manager Salary / Year', type: 'currency', width: 'half' },
        { id: 'groundsCrewCost', label: 'Grounds Crew / Year', type: 'currency', width: 'half' },
        { id: 'registrationStaffCost', label: 'Registration / Front Desk Staff / Year', type: 'currency', width: 'half' },
        { id: 'waterPerSite', label: 'Water / Site / Year', type: 'currency', width: 'half' },
        { id: 'electricPerSite', label: 'Electric / Site / Year', type: 'currency', width: 'half' },
        { id: 'sewerPerSite', label: 'Sewer / Site / Year', type: 'currency', width: 'half' },
        { id: 'propaneCOGS', label: 'Propane COGS / Year', type: 'currency', width: 'half' },
        { id: 'storeCOGS', label: 'Camp Store COGS / Year', type: 'currency', width: 'half' },
        { id: 'wifiInternetAnnual', label: 'WiFi / Internet / Year', type: 'currency', width: 'half' },
        { id: 'trashRemovalAnnual', label: 'Trash Removal / Year', type: 'currency', width: 'half' },
        { id: 'lawnMowingAnnual', label: 'Lawn Mowing & Grounds / Year', type: 'currency', width: 'half' },
        { id: 'poolMaintenanceAnnual', label: 'Pool Maintenance / Year', type: 'currency', width: 'half' },
        { id: 'roadMaintenanceAnnual', label: 'Road Maintenance / Year', type: 'currency', width: 'half' },
        { id: 'insuranceAnnual', label: 'Insurance / Year', type: 'currency', width: 'half' },
        { id: 'propertyTaxAnnual', label: 'Property Tax / Year', type: 'currency', width: 'half' },
        { id: 'managementFeePercent', label: 'Management Fee %', type: 'percent', width: 'half', defaultValue: 6 },
        { id: 'reservationSoftwareMonthly', label: 'Reservation Software / Month', type: 'currency', width: 'half', tooltip: 'PMS / reservation system subscription (Campspot, RMS, etc.)' },
        { id: 'marketingAnnual', label: 'Marketing & Advertising / Year', type: 'currency', width: 'half' },
      ],
    },
    {
      id: 'capital',
      label: 'Capital Reserves',
      icon: 'tool',
      fields: [
        { id: 'roadResurfacingReserve', label: 'Road Resurfacing Reserve / Year', type: 'currency', width: 'half', tooltip: 'Annual reserve for internal road resurfacing and repair' },
        { id: 'utilityUpgradeReserve', label: 'Utility Upgrade Reserve / Year', type: 'currency', width: 'half', tooltip: 'Annual reserve for water, sewer, and electric infrastructure upgrades' },
        { id: 'amenityRefreshReserve', label: 'Amenity Refresh Reserve / Year', type: 'currency', width: 'half', tooltip: 'Annual reserve for pool, playground, bathhouse, and amenity renovations' },
      ],
    },
  ],
  growthCategories: [
    { id: 'site_revenue', label: 'Site Revenue Growth', icon: 'trending-up', description: 'Core site rental revenue growth driven by rate increases and occupancy gains; RV parks have strong pricing power in desirable locations', defaultRate: 4.0 },
    { id: 'permanent_revenue', label: 'Permanent / Monthly Revenue Growth', icon: 'calendar', description: 'Annual rate increases for long-term/permanent site tenants', defaultRate: 3.0 },
    { id: 'store_revenue', label: 'Camp Store Revenue Growth', icon: 'store', description: 'Store, propane, and retail sales growth from volume and pricing', defaultRate: 3.0 },
    { id: 'ancillary_revenue', label: 'Ancillary Revenue Growth', icon: 'layers', description: 'Laundry, activity fees, dump station, WiFi, and equipment rental growth', defaultRate: 2.5 },
    { id: 'operating_expenses', label: 'Operating Expense Growth', icon: 'arrow-up', description: 'General operating expense inflation for supplies, maintenance, and services', defaultRate: 2.5 },
    { id: 'payroll', label: 'Payroll Growth', icon: 'users', description: 'Park manager, grounds crew, and seasonal staff wage escalation', defaultRate: 3.5 },
    { id: 'utilities', label: 'Utilities Growth', icon: 'zap', description: 'Electric, water, sewer, and propane cost escalation per site', defaultRate: 3.0 },
    { id: 'insurance', label: 'Insurance Growth', icon: 'shield', description: 'Property, general liability, and flood insurance premium increases', defaultRate: 5.0 },
    { id: 'property_tax', label: 'Property Tax Growth', icon: 'building', description: 'Annual real estate tax assessment growth', defaultRate: 2.0 },
  ],
  kpis: [
    { id: 'purchasePrice', label: 'Purchase Price', field: 'purchasePrice', format: 'currency', icon: 'dollar-sign' },
    { id: 'capRate', label: 'Cap Rate', field: 'year1CapRate', format: 'percent', icon: 'percent' },
    { id: 'totalSites', label: 'Total Sites', field: 'totalStorageUnits', format: 'number', icon: 'tent' },
    { id: 'noi', label: 'NOI', field: 'ebitda', format: 'currency', icon: 'trending-up' },
    { id: 'avgRate', label: 'Avg Nightly Rate', field: 'avgNightlyRate', format: 'currency', icon: 'dollar-sign' },
    { id: 'occupancy', label: 'Occupancy', field: 'avgOccupancy', format: 'percent', icon: 'bar-chart' },
    { id: 'pricePerSite', label: '$/Site', field: 'pricePerUnit', format: 'currency', icon: 'dollar-sign' },
    { id: 'revPAR', label: 'RevPAR', field: 'revPAR', format: 'currency', icon: 'trending-up' },
  ],
  tabs: { storageLeases: true, commercialLeases: false, profitCenters: true },
  allowCustomUnitTypes: true,
  allowCustomDepartments: true,
  allowCustomGrowthCategories: true,
};


// ═══════════════════════════════════════════════════════════════
// Car Dealership Config
// ═══════════════════════════════════════════════════════════════

const CAR_DEALERSHIP_CONFIG: AssetClassModelConfig = {
  id: 'car_dealership',
  label: 'Car Dealership',
  terms: {
    unit: 'unit', unitPlural: 'units',
    property: 'dealership', propertyPlural: 'dealerships',
    rentRoll: 'Revenue Breakdown', occupancy: 'Utilization',
    noi: 'EBITDA', pricePerUnit: 'Gross/Unit', totalUnitsLabel: 'Total Units Sold',
  },
  valuationMetric: 'ebitda_multiple',
  valuationLabel: 'EBITDA Multiple',
  hasSeasonal: false,
  seasonConfig: { type: 'none' },
  unitMix: {
    tabLabel: 'Vehicle Mix',
    tabIcon: 'car',
    showTab: false,
    countColumnLabel: 'Units',
    rateColumnLabel: 'Avg Gross / Unit',
    rateType: 'monthly',
    showSF: false,
    types: [],
  },
  profitCenters: {
    tabLabel: 'Revenue Departments',
    showTab: true,
    departments: [
      { id: 'new_vehicle', name: 'New Vehicle Sales', icon: 'car', category: 'core', description: 'New vehicle sales department',
        hasRevenue: true, hasCOGS: true, hasDirectLabor: true,
        revenueLines: ['New Vehicle Revenue', 'Factory Incentives & Holdback', 'Dealer Cash & Rebates'],
        cogsLines: ['New Vehicle Inventory COGS', 'Floor Plan Interest'], expenseLines: ['Sales Staff Compensation', 'Advertising (New)'] },
      { id: 'used_vehicle', name: 'Used Vehicle Sales', icon: 'car', category: 'core', description: 'Pre-owned and certified vehicle sales',
        hasRevenue: true, hasCOGS: true, hasDirectLabor: true,
        revenueLines: ['Used Vehicle Revenue', 'CPO Premium Revenue', 'Wholesale Revenue'],
        cogsLines: ['Used Vehicle Acquisition COGS', 'Reconditioning Costs'], expenseLines: ['Used Car Sales Compensation', 'Advertising (Used)'] },
      { id: 'fi', name: 'F&I (Finance & Insurance)', icon: 'shield', category: 'core', description: 'Finance and insurance products',
        hasRevenue: true, hasCOGS: true, hasDirectLabor: true,
        revenueLines: ['Finance Reserve Revenue', 'Extended Warranty Revenue', 'GAP Insurance Revenue', 'Maintenance Plans', 'Other F&I Products'],
        cogsLines: ['F&I Product Costs'], expenseLines: ['F&I Manager Compensation'] },
      { id: 'service_parts', name: 'Service / Parts', icon: 'wrench', category: 'core', description: 'Fixed operations: service and parts departments',
        hasRevenue: true, hasCOGS: true, hasDirectLabor: true,
        revenueLines: ['Customer Pay Service Revenue', 'Warranty Service Revenue', 'Internal Service Revenue', 'Parts Counter Sales', 'Parts Wholesale'],
        cogsLines: ['Parts COGS', 'Service Sublet Costs'], expenseLines: ['Service Technician Labor', 'Service Advisor Compensation', 'Parts Staff Labor'] },
      { id: 'body_shop', name: 'Body Shop', icon: 'tool', category: 'ancillary', description: 'Collision and body repair center',
        hasRevenue: true, hasCOGS: true, hasDirectLabor: true,
        revenueLines: ['Collision Repair Revenue', 'Insurance DRP Revenue', 'Paint & Refinish Revenue'],
        cogsLines: ['Body Shop Materials COGS', 'Paint & Supplies'], expenseLines: ['Body Tech Labor'] },
      { id: 'detailing', name: 'Detailing', icon: 'sparkles', category: 'ancillary', description: 'Vehicle detailing and reconditioning',
        hasRevenue: true, hasCOGS: true, hasDirectLabor: true,
        revenueLines: ['Customer Detail Revenue', 'Internal Recon Revenue'],
        cogsLines: ['Detail Supplies COGS'], expenseLines: ['Detail Tech Labor'] },
    ],
  },
  inputSections: [
    { id: 'general', label: 'General Assumptions', icon: 'settings', fields: [
      { id: 'purchasePrice', label: 'Purchase Price (Blue Sky + Assets)', type: 'currency', width: 'half' },
      { id: 'closingDate', label: 'Closing Date', type: 'text', width: 'half' },
      { id: 'holdPeriod', label: 'Hold Period (Years)', type: 'integer', width: 'half', defaultValue: 7 },
      { id: 'brand', label: 'Brand / Franchise', type: 'text', width: 'half' },
      { id: 'numberOfLocations', label: 'Number of Rooftops', type: 'integer', width: 'half', defaultValue: 1 },
      { id: 'numberOfEmployees', label: 'Total Employees (FTEs)', type: 'integer', width: 'half' },
    ]},
    { id: 'sales_volume', label: 'Sales Volume', icon: 'bar-chart', fields: [
      { id: 'newUnitsPerYear', label: 'New Units / Year', type: 'integer', width: 'half' },
      { id: 'usedUnitsPerYear', label: 'Used Units / Year', type: 'integer', width: 'half' },
      { id: 'avgNewGrossPerUnit', label: 'Avg New Front-End Gross / Unit', type: 'currency', width: 'half' },
      { id: 'avgUsedGrossPerUnit', label: 'Avg Used Front-End Gross / Unit', type: 'currency', width: 'half' },
      { id: 'avgFIPerUnit', label: 'Avg F&I Per Retail Unit', type: 'currency', width: 'half' },
      { id: 'serviceROPerMonth', label: 'Service ROs / Month', type: 'integer', width: 'half' },
      { id: 'avgRORevenue', label: 'Avg Revenue / RO', type: 'currency', width: 'half' },
    ]},
    { id: 'expenses', label: 'Operating Expenses', icon: 'receipt', fields: [
      { id: 'totalPayrollAnnual', label: 'Total Payroll / Year', type: 'currency', width: 'half' },
      { id: 'floorPlanInterestAnnual', label: 'Floor Plan Interest / Year', type: 'currency', width: 'half' },
      { id: 'advertisingAnnual', label: 'Advertising / Year', type: 'currency', width: 'half' },
      { id: 'rentLeaseAnnual', label: 'Rent / Lease / Year', type: 'currency', width: 'half' },
      { id: 'insuranceAnnual', label: 'Insurance / Year', type: 'currency', width: 'half' },
      { id: 'ownerCompensation', label: 'Owner / Dealer Compensation / Year', type: 'currency', width: 'half' },
      { id: 'addbacks', label: 'Total Seller Add-Backs / Year', type: 'currency', width: 'half' },
    ]},
  ],
  growthCategories: [
    { id: 'new_vehicle_revenue', label: 'New Vehicle Revenue Growth', icon: 'car', description: 'New unit sales and gross profit growth', defaultRate: 3.0 },
    { id: 'used_vehicle_revenue', label: 'Used Vehicle Revenue Growth', icon: 'car', description: 'Used unit sales and margin growth', defaultRate: 4.0 },
    { id: 'fi_revenue', label: 'F&I Revenue Growth', icon: 'shield', description: 'Finance and insurance per-unit growth', defaultRate: 3.0 },
    { id: 'fixed_ops_revenue', label: 'Fixed Ops Revenue Growth', icon: 'wrench', description: 'Service and parts department growth', defaultRate: 4.0 },
    { id: 'payroll', label: 'Payroll Growth', icon: 'users', description: 'Staff compensation growth', defaultRate: 3.5 },
    { id: 'operating_expenses', label: 'Operating Expense Growth', icon: 'arrow-up', description: 'Rent, advertising, and overhead', defaultRate: 2.5 },
    { id: 'insurance', label: 'Insurance Growth', icon: 'shield', description: 'Dealership insurance premiums', defaultRate: 4.0 },
  ],
  kpis: [
    { id: 'purchasePrice', label: 'Purchase Price', field: 'purchasePrice', format: 'currency', icon: 'dollar-sign' },
    { id: 'ebitdaMultiple', label: 'EBITDA Multiple', field: 'ebitdaMultiple', format: 'multiple', icon: 'x' },
    { id: 'revenue', label: 'Revenue', field: 'totalRevenue', format: 'currency', icon: 'trending-up' },
    { id: 'ebitda', label: 'EBITDA', field: 'ebitda', format: 'currency', icon: 'dollar-sign' },
    { id: 'totalUnits', label: 'Units Sold', field: 'totalUnitsSold', format: 'number', icon: 'car' },
    { id: 'grossPerUnit', label: 'Gross / Unit', field: 'avgGrossPerUnit', format: 'currency', icon: 'dollar-sign' },
  ],
  tabs: { storageLeases: false, commercialLeases: false, profitCenters: true },
  allowCustomUnitTypes: true,
  allowCustomDepartments: true,
  allowCustomGrowthCategories: true,
};


// ═══════════════════════════════════════════════════════════════
// Gas Station / C-Store Config
// ═══════════════════════════════════════════════════════════════

const GAS_STATION_CONFIG: AssetClassModelConfig = {
  id: 'gas_station',
  label: 'Gas Station / C-Store',
  terms: {
    unit: 'pump', unitPlural: 'pumps',
    property: 'station', propertyPlural: 'stations',
    rentRoll: 'Revenue Breakdown', occupancy: 'Volume',
    noi: 'EBITDA', pricePerUnit: '$/Pump', totalUnitsLabel: 'Total Pumps',
  },
  valuationMetric: 'ebitda_multiple',
  valuationLabel: 'EBITDA Multiple',
  hasSeasonal: false,
  seasonConfig: { type: 'none' },
  unitMix: {
    tabLabel: 'Pump & Equipment',
    tabIcon: 'fuel',
    showTab: false,
    countColumnLabel: 'Pumps',
    rateColumnLabel: 'Volume / Pump',
    rateType: 'monthly',
    showSF: false,
    types: [],
  },
  profitCenters: {
    tabLabel: 'Revenue Departments',
    showTab: true,
    departments: [
      { id: 'fuel_sales', name: 'Fuel Sales', icon: 'fuel', category: 'core', description: 'Gasoline and diesel fuel sales',
        hasRevenue: true, hasCOGS: true, hasDirectLabor: true,
        revenueLines: ['Regular Gasoline Revenue', 'Premium Gasoline Revenue', 'Diesel Revenue', 'DEF / Additives Revenue'],
        cogsLines: ['Fuel COGS', 'Fuel Delivery & Freight'], expenseLines: ['Fuel Attendant Labor'] },
      { id: 'cstore', name: 'C-Store / Convenience', icon: 'store', category: 'core', description: 'Convenience store merchandise and food service',
        hasRevenue: true, hasCOGS: true, hasDirectLabor: true,
        revenueLines: ['Packaged Beverage Revenue', 'Tobacco Revenue', 'Snack & Candy Revenue', 'Grocery & Dairy Revenue', 'Lottery & Gaming Revenue', 'Beer & Wine Revenue'],
        cogsLines: ['C-Store COGS'], expenseLines: ['Cashier / Clerk Labor'] },
      { id: 'car_wash', name: 'Car Wash', icon: 'car', category: 'ancillary', description: 'On-site car wash bay or automatic tunnel',
        hasRevenue: true, hasCOGS: true, hasDirectLabor: false,
        revenueLines: ['Car Wash Revenue', 'Detail Revenue'],
        cogsLines: ['Car Wash Chemicals & Water'] },
      { id: 'qsr', name: 'Quick Service Restaurant', icon: 'utensils', category: 'ancillary', description: 'QSR franchise or prepared food program',
        hasRevenue: true, hasCOGS: true, hasDirectLabor: true,
        revenueLines: ['QSR / Food Service Revenue', 'Coffee & Fountain Revenue', 'Prepared Food Revenue'],
        cogsLines: ['Food COGS'], expenseLines: ['Food Service Labor'] },
      { id: 'atm', name: 'ATM', icon: 'credit-card', category: 'ancillary', description: 'ATM surcharge revenue',
        hasRevenue: true, hasCOGS: false, hasDirectLabor: false,
        revenueLines: ['ATM Surcharge Revenue'] },
    ],
  },
  inputSections: [
    { id: 'general', label: 'General Assumptions', icon: 'settings', fields: [
      { id: 'purchasePrice', label: 'Purchase Price', type: 'currency', width: 'half' },
      { id: 'closingDate', label: 'Closing Date', type: 'text', width: 'half' },
      { id: 'holdPeriod', label: 'Hold Period (Years)', type: 'integer', width: 'half', defaultValue: 7 },
      { id: 'numberOfPumps', label: 'Number of Pumps / Positions', type: 'integer', width: 'half' },
      { id: 'storeSF', label: 'C-Store SF', type: 'integer', width: 'half' },
      { id: 'brand', label: 'Fuel Brand', type: 'text', width: 'half', placeholder: 'e.g. Shell, BP, Unbranded' },
      { id: 'numberOfLocations', label: 'Number of Locations', type: 'integer', width: 'half', defaultValue: 1 },
    ]},
    { id: 'fuel', label: 'Fuel Operations', icon: 'fuel', fields: [
      { id: 'monthlyGallons', label: 'Monthly Volume (Gallons)', type: 'integer', width: 'half' },
      { id: 'fuelMarginPerGallon', label: 'Fuel Margin / Gallon', type: 'currency', width: 'half', tooltip: 'Cents per gallon gross margin on fuel sales' },
      { id: 'dieselPercent', label: 'Diesel % of Volume', type: 'percent', width: 'half', defaultValue: 15 },
    ]},
    { id: 'inside', label: 'Inside Sales', icon: 'store', fields: [
      { id: 'insideSalesPerMonth', label: 'Inside Sales / Month', type: 'currency', width: 'half' },
      { id: 'insideMarginPercent', label: 'Inside Margin %', type: 'percent', width: 'half', defaultValue: 35 },
      { id: 'foodServiceRevenuePerMonth', label: 'Food Service Revenue / Month', type: 'currency', width: 'half' },
      { id: 'lotteryCommissionPerMonth', label: 'Lottery Commission / Month', type: 'currency', width: 'half' },
    ]},
    { id: 'expenses', label: 'Operating Expenses', icon: 'receipt', fields: [
      { id: 'payrollBenefits', label: 'Payroll & Benefits / Year', type: 'currency', width: 'half' },
      { id: 'rentLeaseAnnual', label: 'Rent / Lease / Year', type: 'currency', width: 'half' },
      { id: 'utilitiesAnnual', label: 'Utilities / Year', type: 'currency', width: 'half' },
      { id: 'insuranceAnnual', label: 'Insurance / Year', type: 'currency', width: 'half' },
      { id: 'propertyTaxAnnual', label: 'Property Tax / Year', type: 'currency', width: 'half' },
      { id: 'ownerCompensation', label: 'Owner Compensation / Year', type: 'currency', width: 'half' },
      { id: 'addbacks', label: 'Total Seller Add-Backs / Year', type: 'currency', width: 'half' },
    ]},
  ],
  growthCategories: [
    { id: 'fuel_volume', label: 'Fuel Volume Growth', icon: 'fuel', description: 'Gallons sold growth rate', defaultRate: 1.0 },
    { id: 'fuel_margin', label: 'Fuel Margin Growth', icon: 'trending-up', description: 'Per-gallon margin improvement', defaultRate: 2.0 },
    { id: 'inside_sales', label: 'Inside Sales Growth', icon: 'store', description: 'C-store merchandise revenue growth', defaultRate: 3.0 },
    { id: 'food_service', label: 'Food Service Growth', icon: 'utensils', description: 'QSR and prepared food growth', defaultRate: 4.0 },
    { id: 'payroll', label: 'Payroll Growth', icon: 'users', description: 'Staff wages and benefits', defaultRate: 3.5 },
    { id: 'operating_expenses', label: 'Operating Expense Growth', icon: 'arrow-up', description: 'Rent, utilities, and general overhead', defaultRate: 2.5 },
    { id: 'insurance', label: 'Insurance Growth', icon: 'shield', description: 'Property and environmental insurance', defaultRate: 4.0 },
  ],
  kpis: [
    { id: 'purchasePrice', label: 'Purchase Price', field: 'purchasePrice', format: 'currency', icon: 'dollar-sign' },
    { id: 'ebitdaMultiple', label: 'EBITDA Multiple', field: 'ebitdaMultiple', format: 'multiple', icon: 'x' },
    { id: 'ebitda', label: 'EBITDA', field: 'ebitda', format: 'currency', icon: 'trending-up' },
    { id: 'revenue', label: 'Revenue', field: 'totalRevenue', format: 'currency', icon: 'dollar-sign' },
    { id: 'monthlyGallons', label: 'Monthly Volume', field: 'monthlyGallons', format: 'number', icon: 'fuel' },
    { id: 'pumps', label: 'Pumps', field: 'numberOfPumps', format: 'number', icon: 'gauge' },
  ],
  tabs: { storageLeases: false, commercialLeases: false, profitCenters: true },
  allowCustomUnitTypes: true,
  allowCustomDepartments: true,
  allowCustomGrowthCategories: true,
};


// ═══════════════════════════════════════════════════════════════
// Restaurant / Bar Config
// ═══════════════════════════════════════════════════════════════

const RESTAURANT_CONFIG: AssetClassModelConfig = {
  id: 'restaurant',
  label: 'Restaurant / Bar',
  terms: {
    unit: 'seat', unitPlural: 'seats',
    property: 'restaurant', propertyPlural: 'restaurants',
    rentRoll: 'Revenue Breakdown', occupancy: 'Turns/Day',
    noi: 'EBITDA', pricePerUnit: '$/Seat', totalUnitsLabel: 'Total Seats',
  },
  valuationMetric: 'ebitda_multiple',
  valuationLabel: 'EBITDA Multiple',
  hasSeasonal: false,
  seasonConfig: { type: 'none' },
  unitMix: {
    tabLabel: 'Seating Setup',
    tabIcon: 'utensils',
    showTab: false,
    countColumnLabel: 'Seats',
    rateColumnLabel: 'Revenue / Seat',
    rateType: 'monthly',
    showSF: false,
    types: [],
  },
  profitCenters: {
    tabLabel: 'Revenue Streams',
    showTab: true,
    departments: [
      { id: 'dine_in', name: 'Dine-In', icon: 'utensils', category: 'core', description: 'In-house dining revenue',
        hasRevenue: true, hasCOGS: true, hasDirectLabor: true,
        revenueLines: ['Food Revenue (Dine-In)', 'Beverage Revenue (Dine-In)'],
        cogsLines: ['Food COGS', 'Beverage COGS'], expenseLines: ['Server Labor', 'Kitchen Labor', 'Host/Busser Labor'] },
      { id: 'takeout_delivery', name: 'Takeout / Delivery', icon: 'package', category: 'core', description: 'Off-premise orders and third-party delivery',
        hasRevenue: true, hasCOGS: true, hasDirectLabor: true,
        revenueLines: ['Takeout Revenue', 'Delivery Revenue', 'Online Order Revenue'],
        cogsLines: ['Packaging & Supplies'], expenseLines: ['Delivery Driver Labor', 'Platform Commission Fees'] },
      { id: 'bar_beverage', name: 'Bar / Beverage', icon: 'wine', category: 'core', description: 'Bar and alcoholic beverage program',
        hasRevenue: true, hasCOGS: true, hasDirectLabor: true,
        revenueLines: ['Liquor Revenue', 'Beer Revenue', 'Wine Revenue', 'Non-Alcoholic Specialty Drinks'],
        cogsLines: ['Liquor COGS', 'Beer COGS', 'Wine COGS'], expenseLines: ['Bartender Labor'] },
      { id: 'catering', name: 'Catering', icon: 'truck', category: 'ancillary', description: 'Off-site catering and large orders',
        hasRevenue: true, hasCOGS: true, hasDirectLabor: true,
        revenueLines: ['Catering Revenue', 'Drop-Off Catering', 'Full-Service Catering'],
        cogsLines: ['Catering Food COGS', 'Catering Supplies'], expenseLines: ['Catering Staff Labor', 'Vehicle & Delivery'] },
      { id: 'private_events', name: 'Private Events', icon: 'calendar', category: 'ancillary', description: 'Private dining and event space',
        hasRevenue: true, hasCOGS: true, hasDirectLabor: true,
        revenueLines: ['Private Event Revenue', 'Room Rental Fee', 'Event Minimum Spend'],
        cogsLines: ['Event F&B COGS'], expenseLines: ['Event Staff Labor'] },
      { id: 'merchandise', name: 'Merchandise', icon: 'shopping-bag', category: 'ancillary', description: 'Branded merchandise and retail items',
        hasRevenue: true, hasCOGS: true, hasDirectLabor: false,
        revenueLines: ['T-Shirt & Apparel Sales', 'Sauce / Seasoning Retail', 'Gift Card Revenue'],
        cogsLines: ['Merchandise COGS'] },
    ],
  },
  inputSections: [
    { id: 'general', label: 'General Assumptions', icon: 'settings', fields: [
      { id: 'purchasePrice', label: 'Purchase Price', type: 'currency', width: 'half' },
      { id: 'closingDate', label: 'Closing Date', type: 'text', width: 'half' },
      { id: 'holdPeriod', label: 'Hold Period (Years)', type: 'integer', width: 'half', defaultValue: 5 },
      { id: 'totalSeats', label: 'Total Seats', type: 'integer', width: 'half' },
      { id: 'restaurantSF', label: 'Restaurant SF', type: 'integer', width: 'half' },
      { id: 'conceptType', label: 'Concept Type', type: 'select', width: 'half',
        options: [
          { value: 'fast_casual', label: 'Fast Casual' },
          { value: 'casual_dining', label: 'Casual Dining' },
          { value: 'fine_dining', label: 'Fine Dining' },
          { value: 'qsr', label: 'Quick Service (QSR)' },
          { value: 'bar_grill', label: 'Bar & Grill' },
          { value: 'cafe_bakery', label: 'Cafe / Bakery' },
        ]},
      { id: 'yearsInOperation', label: 'Years in Operation', type: 'integer', width: 'half' },
    ]},
    { id: 'operations', label: 'Operations', icon: 'bar-chart', fields: [
      { id: 'avgCheckSize', label: 'Avg Check Size', type: 'currency', width: 'half' },
      { id: 'turnsPerDay', label: 'Avg Turns / Day', type: 'number', width: 'half', defaultValue: 2.5 },
      { id: 'daysOpenPerWeek', label: 'Days Open / Week', type: 'integer', width: 'half', defaultValue: 7 },
      { id: 'foodCostPercent', label: 'Food Cost %', type: 'percent', width: 'half', defaultValue: 30 },
      { id: 'beverageCostPercent', label: 'Beverage Cost %', type: 'percent', width: 'half', defaultValue: 22 },
      { id: 'laborCostPercent', label: 'Total Labor Cost %', type: 'percent', width: 'half', defaultValue: 30 },
    ]},
    { id: 'expenses', label: 'Operating Expenses', icon: 'receipt', fields: [
      { id: 'rentLeaseAnnual', label: 'Rent / Lease / Year', type: 'currency', width: 'half' },
      { id: 'utilitiesAnnual', label: 'Utilities / Year', type: 'currency', width: 'half' },
      { id: 'insuranceAnnual', label: 'Insurance / Year', type: 'currency', width: 'half' },
      { id: 'marketingAnnual', label: 'Marketing / Year', type: 'currency', width: 'half' },
      { id: 'technologyAnnual', label: 'POS & Technology / Year', type: 'currency', width: 'half' },
      { id: 'repairsMaintenanceAnnual', label: 'R&M / Year', type: 'currency', width: 'half' },
      { id: 'ownerCompensation', label: 'Owner Compensation / Year', type: 'currency', width: 'half' },
      { id: 'addbacks', label: 'Total Seller Add-Backs / Year', type: 'currency', width: 'half' },
    ]},
  ],
  growthCategories: [
    { id: 'dine_in_revenue', label: 'Dine-In Revenue Growth', icon: 'utensils', description: 'In-house dining revenue growth', defaultRate: 3.0 },
    { id: 'off_premise_revenue', label: 'Off-Premise Revenue Growth', icon: 'package', description: 'Takeout and delivery growth', defaultRate: 6.0 },
    { id: 'bar_revenue', label: 'Bar Revenue Growth', icon: 'wine', description: 'Alcoholic and specialty beverage growth', defaultRate: 3.0 },
    { id: 'catering_revenue', label: 'Catering Revenue Growth', icon: 'truck', description: 'Catering and event revenue growth', defaultRate: 5.0 },
    { id: 'food_cogs', label: 'Food Cost Growth', icon: 'package', description: 'Ingredient and food cost inflation', defaultRate: 3.5 },
    { id: 'payroll', label: 'Payroll Growth', icon: 'users', description: 'Front and back of house labor cost growth', defaultRate: 4.0 },
    { id: 'operating_expenses', label: 'Operating Expense Growth', icon: 'arrow-up', description: 'Rent, utilities, and overhead', defaultRate: 3.0 },
    { id: 'insurance', label: 'Insurance Growth', icon: 'shield', description: 'Liability and property insurance', defaultRate: 4.0 },
  ],
  kpis: [
    { id: 'purchasePrice', label: 'Purchase Price', field: 'purchasePrice', format: 'currency', icon: 'dollar-sign' },
    { id: 'ebitdaMultiple', label: 'EBITDA Multiple', field: 'ebitdaMultiple', format: 'multiple', icon: 'x' },
    { id: 'revenue', label: 'Revenue', field: 'totalRevenue', format: 'currency', icon: 'trending-up' },
    { id: 'ebitda', label: 'EBITDA', field: 'ebitda', format: 'currency', icon: 'dollar-sign' },
    { id: 'avgCheck', label: 'Avg Check', field: 'avgCheckSize', format: 'currency', icon: 'receipt' },
    { id: 'seats', label: 'Seats', field: 'totalSeats', format: 'number', icon: 'utensils' },
  ],
  tabs: { storageLeases: false, commercialLeases: false, profitCenters: true },
  allowCustomUnitTypes: true,
  allowCustomDepartments: true,
  allowCustomGrowthCategories: true,
};


// ═══════════════════════════════════════════════════════════════
// Gym / Fitness Center Config
// ═══════════════════════════════════════════════════════════════

const GYM_CONFIG: AssetClassModelConfig = {
  id: 'gym',
  label: 'Gym / Fitness Center',
  terms: {
    unit: 'member', unitPlural: 'members',
    property: 'facility', propertyPlural: 'facilities',
    rentRoll: 'Membership Breakdown', occupancy: 'Utilization',
    noi: 'EBITDA', pricePerUnit: '$/Member', totalUnitsLabel: 'Total Members',
  },
  valuationMetric: 'ebitda_multiple',
  valuationLabel: 'EBITDA Multiple',
  hasSeasonal: false,
  seasonConfig: { type: 'none' },
  unitMix: {
    tabLabel: 'Membership Tiers',
    tabIcon: 'users',
    showTab: false,
    countColumnLabel: 'Members',
    rateColumnLabel: 'Dues / Mo',
    rateType: 'monthly',
    showSF: false,
    types: [],
  },
  profitCenters: {
    tabLabel: 'Revenue Streams',
    showTab: true,
    departments: [
      { id: 'memberships', name: 'Memberships', icon: 'credit-card', category: 'core', description: 'Monthly and annual membership dues',
        hasRevenue: true, hasCOGS: false, hasDirectLabor: false,
        revenueLines: ['Monthly Membership Dues', 'Annual Membership Dues', 'Enrollment/Initiation Fees', 'Day Pass Revenue'] },
      { id: 'personal_training', name: 'Personal Training', icon: 'user', category: 'core', description: 'One-on-one and small group personal training',
        hasRevenue: true, hasCOGS: false, hasDirectLabor: true,
        revenueLines: ['Personal Training Sessions', 'Training Package Revenue', 'Small Group Training'],
        expenseLines: ['Trainer Compensation'] },
      { id: 'group_classes', name: 'Group Classes', icon: 'users', category: 'core', description: 'Group fitness classes and specialized programs',
        hasRevenue: true, hasCOGS: false, hasDirectLabor: true,
        revenueLines: ['Class Pass Revenue', 'Specialty Class Revenue', 'Virtual Class Revenue'],
        expenseLines: ['Instructor Compensation'] },
      { id: 'retail', name: 'Retail / Pro Shop', icon: 'shopping-bag', category: 'ancillary', description: 'Retail merchandise and equipment sales',
        hasRevenue: true, hasCOGS: true, hasDirectLabor: false,
        revenueLines: ['Apparel Sales', 'Equipment Sales', 'Accessories Sales'],
        cogsLines: ['Retail COGS'] },
      { id: 'supplements', name: 'Supplements', icon: 'pill', category: 'ancillary', description: 'Smoothie bar and supplement sales',
        hasRevenue: true, hasCOGS: true, hasDirectLabor: true,
        revenueLines: ['Smoothie Bar Revenue', 'Supplement Sales', 'Protein Bar/Snack Sales'],
        cogsLines: ['Supplement & Ingredient COGS'], expenseLines: ['Smoothie Bar Labor'] },
      { id: 'tanning_recovery', name: 'Tanning / Recovery', icon: 'sun', category: 'ancillary', description: 'Tanning beds, cryotherapy, and recovery services',
        hasRevenue: true, hasCOGS: true, hasDirectLabor: false,
        revenueLines: ['Tanning Revenue', 'Cryotherapy Revenue', 'Sauna/Steam Revenue', 'Recovery Service Revenue'],
        cogsLines: ['Tanning Supplies', 'Recovery Equipment Costs'] },
    ],
  },
  inputSections: [
    { id: 'general', label: 'General Assumptions', icon: 'settings', fields: [
      { id: 'purchasePrice', label: 'Purchase Price', type: 'currency', width: 'half' },
      { id: 'closingDate', label: 'Closing Date', type: 'text', width: 'half' },
      { id: 'holdPeriod', label: 'Hold Period (Years)', type: 'integer', width: 'half', defaultValue: 5 },
      { id: 'facilitySF', label: 'Facility SF', type: 'integer', width: 'half' },
      { id: 'numberOfLocations', label: 'Number of Locations', type: 'integer', width: 'half', defaultValue: 1 },
      { id: 'gymType', label: 'Gym Type', type: 'select', width: 'half',
        options: [
          { value: 'budget', label: 'Budget / High Volume' },
          { value: 'mid_range', label: 'Mid-Range' },
          { value: 'premium', label: 'Premium / Boutique' },
          { value: 'crossfit_specialty', label: 'CrossFit / Specialty' },
          { value: '24_hour', label: '24-Hour Access' },
        ]},
    ]},
    { id: 'membership', label: 'Membership Metrics', icon: 'users', fields: [
      { id: 'totalMembers', label: 'Total Active Members', type: 'integer', width: 'half' },
      { id: 'avgMonthlyDues', label: 'Avg Monthly Dues', type: 'currency', width: 'half' },
      { id: 'memberCapacity', label: 'Member Capacity', type: 'integer', width: 'half', tooltip: 'Maximum members facility can support' },
      { id: 'monthlyChurnRate', label: 'Monthly Churn Rate %', type: 'percent', width: 'half', defaultValue: 5 },
      { id: 'avgMemberTenure', label: 'Avg Member Tenure (Months)', type: 'number', width: 'half', defaultValue: 14 },
      { id: 'ptAttachRate', label: 'PT Attach Rate %', type: 'percent', width: 'half', defaultValue: 10, tooltip: 'Percentage of members purchasing personal training' },
    ]},
    { id: 'expenses', label: 'Operating Expenses', icon: 'receipt', fields: [
      { id: 'payrollBenefits', label: 'Payroll & Benefits / Year', type: 'currency', width: 'half' },
      { id: 'rentLeaseAnnual', label: 'Rent / Lease / Year', type: 'currency', width: 'half' },
      { id: 'utilitiesAnnual', label: 'Utilities / Year', type: 'currency', width: 'half' },
      { id: 'equipmentLeaseAnnual', label: 'Equipment Lease / Year', type: 'currency', width: 'half' },
      { id: 'insuranceAnnual', label: 'Insurance / Year', type: 'currency', width: 'half' },
      { id: 'marketingAnnual', label: 'Marketing / Year', type: 'currency', width: 'half' },
      { id: 'ownerCompensation', label: 'Owner Compensation / Year', type: 'currency', width: 'half' },
      { id: 'addbacks', label: 'Total Seller Add-Backs / Year', type: 'currency', width: 'half' },
    ]},
  ],
  growthCategories: [
    { id: 'membership_revenue', label: 'Membership Revenue Growth', icon: 'credit-card', description: 'Dues revenue growth from rate increases and member growth', defaultRate: 5.0 },
    { id: 'pt_revenue', label: 'Personal Training Growth', icon: 'user', description: 'Personal training revenue growth', defaultRate: 6.0 },
    { id: 'ancillary_revenue', label: 'Ancillary Revenue Growth', icon: 'layers', description: 'Retail, supplements, tanning, and recovery', defaultRate: 3.0 },
    { id: 'payroll', label: 'Payroll Growth', icon: 'users', description: 'Staff and trainer compensation growth', defaultRate: 3.5 },
    { id: 'operating_expenses', label: 'Operating Expense Growth', icon: 'arrow-up', description: 'Rent, utilities, and general overhead', defaultRate: 3.0 },
    { id: 'insurance', label: 'Insurance Growth', icon: 'shield', description: 'Liability and property insurance', defaultRate: 4.0 },
    { id: 'equipment', label: 'Equipment Cost Growth', icon: 'dumbbell', description: 'Equipment lease and replacement costs', defaultRate: 3.0 },
  ],
  kpis: [
    { id: 'purchasePrice', label: 'Purchase Price', field: 'purchasePrice', format: 'currency', icon: 'dollar-sign' },
    { id: 'ebitdaMultiple', label: 'EBITDA Multiple', field: 'ebitdaMultiple', format: 'multiple', icon: 'x' },
    { id: 'revenue', label: 'Revenue', field: 'totalRevenue', format: 'currency', icon: 'trending-up' },
    { id: 'ebitda', label: 'EBITDA', field: 'ebitda', format: 'currency', icon: 'dollar-sign' },
    { id: 'totalMembers', label: 'Members', field: 'totalMembers', format: 'number', icon: 'users' },
    { id: 'avgDues', label: 'Avg Dues', field: 'avgMonthlyDues', format: 'currency', icon: 'credit-card' },
  ],
  tabs: { storageLeases: false, commercialLeases: false, profitCenters: true },
  allowCustomUnitTypes: true,
  allowCustomDepartments: true,
  allowCustomGrowthCategories: true,
};


// ═══════════════════════════════════════════════════════════════
// Daycare / Childcare Center Config
// ═══════════════════════════════════════════════════════════════

const DAYCARE_CONFIG: AssetClassModelConfig = {
  id: 'daycare',
  label: 'Daycare / Childcare Center',
  terms: {
    unit: 'child', unitPlural: 'children',
    property: 'center', propertyPlural: 'centers',
    rentRoll: 'Enrollment Breakdown', occupancy: 'Enrollment',
    noi: 'EBITDA', pricePerUnit: '$/Child', totalUnitsLabel: 'Licensed Capacity',
  },
  valuationMetric: 'ebitda_multiple',
  valuationLabel: 'EBITDA Multiple',
  hasSeasonal: false,
  seasonConfig: { type: 'none' },
  unitMix: {
    tabLabel: 'Classroom Setup',
    tabIcon: 'smile',
    showTab: false,
    countColumnLabel: 'Children',
    rateColumnLabel: 'Tuition / Week',
    rateType: 'monthly',
    showSF: false,
    types: [],
  },
  profitCenters: {
    tabLabel: 'Revenue Streams',
    showTab: true,
    departments: [
      { id: 'full_time', name: 'Full-Time Enrollment', icon: 'users', category: 'core', description: 'Full-time weekly tuition (5 days)',
        hasRevenue: true, hasCOGS: false, hasDirectLabor: true,
        revenueLines: ['Infant Tuition', 'Toddler Tuition', 'Preschool Tuition', 'Pre-K Tuition'],
        expenseLines: ['Lead Teacher Salary', 'Assistant Teacher Salary'] },
      { id: 'part_time', name: 'Part-Time Enrollment', icon: 'clock', category: 'core', description: 'Part-time 2-3 day weekly enrollment',
        hasRevenue: true, hasCOGS: false, hasDirectLabor: false,
        revenueLines: ['Part-Time Tuition (2-day)', 'Part-Time Tuition (3-day)'] },
      { id: 'before_after_school', name: 'Before / After School', icon: 'sun', category: 'ancillary', description: 'Before and after school care for school-age children',
        hasRevenue: true, hasCOGS: false, hasDirectLabor: true,
        revenueLines: ['Before School Revenue', 'After School Revenue', 'Half-Day Care Revenue'],
        expenseLines: ['Before/After School Staff'] },
      { id: 'summer_camp', name: 'Summer Camp', icon: 'sun', category: 'ancillary', description: 'Summer camp programs and activities',
        hasRevenue: true, hasCOGS: true, hasDirectLabor: true,
        revenueLines: ['Weekly Camp Tuition', 'Field Trip Fees', 'Specialty Camp Revenue'],
        cogsLines: ['Camp Supplies & Materials', 'Field Trip Costs'], expenseLines: ['Summer Camp Staff'] },
      { id: 'enrichment', name: 'Enrichment Programs', icon: 'star', category: 'ancillary', description: 'Optional enrichment and specialty classes',
        hasRevenue: true, hasCOGS: true, hasDirectLabor: true,
        revenueLines: ['Music / Art Classes', 'Language Program Revenue', 'STEM / Coding Revenue', 'Dance / Gymnastics Revenue'],
        cogsLines: ['Enrichment Materials'], expenseLines: ['Enrichment Instructor Pay'] },
    ],
  },
  inputSections: [
    { id: 'general', label: 'General Assumptions', icon: 'settings', fields: [
      { id: 'purchasePrice', label: 'Purchase Price', type: 'currency', width: 'half' },
      { id: 'closingDate', label: 'Closing Date', type: 'text', width: 'half' },
      { id: 'holdPeriod', label: 'Hold Period (Years)', type: 'integer', width: 'half', defaultValue: 7 },
      { id: 'licensedCapacity', label: 'Licensed Capacity', type: 'integer', width: 'half' },
      { id: 'facilitySF', label: 'Facility SF', type: 'integer', width: 'half' },
      { id: 'numberOfClassrooms', label: 'Number of Classrooms', type: 'integer', width: 'half' },
      { id: 'yearsInOperation', label: 'Years in Operation', type: 'integer', width: 'half' },
    ]},
    { id: 'enrollment', label: 'Enrollment & Tuition', icon: 'users', fields: [
      { id: 'currentEnrollment', label: 'Current Enrollment', type: 'integer', width: 'half' },
      { id: 'enrollmentPercent', label: 'Enrollment Rate %', type: 'percent', width: 'half', defaultValue: 85 },
      { id: 'avgWeeklyTuition', label: 'Avg Weekly Tuition', type: 'currency', width: 'half' },
      { id: 'waitlistCount', label: 'Waitlist Count', type: 'integer', width: 'half' },
      { id: 'annualTuitionIncrease', label: 'Annual Tuition Increase %', type: 'percent', width: 'half', defaultValue: 4 },
      { id: 'subsidyRevenuePercent', label: 'Subsidy Revenue %', type: 'percent', width: 'half', defaultValue: 15, tooltip: 'Percentage of revenue from government subsidies/vouchers' },
    ]},
    { id: 'expenses', label: 'Operating Expenses', icon: 'receipt', fields: [
      { id: 'payrollBenefits', label: 'Payroll & Benefits / Year', type: 'currency', width: 'half' },
      { id: 'rentLeaseAnnual', label: 'Rent / Lease / Year', type: 'currency', width: 'half' },
      { id: 'foodServiceAnnual', label: 'Food Service / Year', type: 'currency', width: 'half' },
      { id: 'suppliesCurriculumAnnual', label: 'Supplies & Curriculum / Year', type: 'currency', width: 'half' },
      { id: 'insuranceAnnual', label: 'Insurance / Year', type: 'currency', width: 'half' },
      { id: 'utilitiesAnnual', label: 'Utilities / Year', type: 'currency', width: 'half' },
      { id: 'ownerCompensation', label: 'Owner/Director Compensation / Year', type: 'currency', width: 'half' },
      { id: 'addbacks', label: 'Total Seller Add-Backs / Year', type: 'currency', width: 'half' },
    ]},
  ],
  growthCategories: [
    { id: 'tuition_revenue', label: 'Tuition Revenue Growth', icon: 'trending-up', description: 'Annual tuition rate increases', defaultRate: 4.0 },
    { id: 'enrollment_growth', label: 'Enrollment Growth', icon: 'users', description: 'Net enrollment increase year-over-year', defaultRate: 3.0 },
    { id: 'enrichment_revenue', label: 'Enrichment Revenue Growth', icon: 'star', description: 'Add-on programs and specialty class growth', defaultRate: 5.0 },
    { id: 'payroll', label: 'Payroll Growth', icon: 'users', description: 'Teacher and staff compensation growth', defaultRate: 4.0 },
    { id: 'operating_expenses', label: 'Operating Expense Growth', icon: 'arrow-up', description: 'Food, supplies, and general overhead', defaultRate: 3.0 },
    { id: 'insurance', label: 'Insurance Growth', icon: 'shield', description: 'Liability and property insurance', defaultRate: 5.0 },
    { id: 'rent', label: 'Rent Growth', icon: 'building', description: 'Facility lease escalation', defaultRate: 3.0 },
  ],
  kpis: [
    { id: 'purchasePrice', label: 'Purchase Price', field: 'purchasePrice', format: 'currency', icon: 'dollar-sign' },
    { id: 'ebitdaMultiple', label: 'EBITDA Multiple', field: 'ebitdaMultiple', format: 'multiple', icon: 'x' },
    { id: 'revenue', label: 'Revenue', field: 'totalRevenue', format: 'currency', icon: 'trending-up' },
    { id: 'ebitda', label: 'EBITDA', field: 'ebitda', format: 'currency', icon: 'dollar-sign' },
    { id: 'enrollment', label: 'Enrollment', field: 'currentEnrollment', format: 'number', icon: 'users' },
    { id: 'enrollmentRate', label: 'Enrollment %', field: 'enrollmentPercent', format: 'percent', icon: 'bar-chart' },
  ],
  tabs: { storageLeases: false, commercialLeases: false, profitCenters: true },
  allowCustomUnitTypes: true,
  allowCustomDepartments: true,
  allowCustomGrowthCategories: true,
};


// ═══════════════════════════════════════════════════════════════
// Mobile Home / Manufactured Housing Config
// ═══════════════════════════════════════════════════════════════

const MOBILE_HOME_PARK_CONFIG: AssetClassModelConfig = {
  id: 'mobile_home_park',
  label: 'Mobile Home / Manufactured Housing',
  terms: {
    unit: 'lot', unitPlural: 'lots',
    property: 'community', propertyPlural: 'communities',
    rentRoll: 'Lot Inventory', occupancy: 'Occupancy',
    noi: 'NOI', pricePerUnit: '$/Lot', totalUnitsLabel: 'Total Lots',
  },
  valuationMetric: 'cap_rate',
  valuationLabel: 'Cap Rate',
  hasSeasonal: false,
  seasonConfig: { type: 'none' },
  unitMix: {
    tabLabel: 'Lot Inventory',
    tabIcon: 'home',
    showTab: true,
    countColumnLabel: 'Lots',
    rateColumnLabel: 'Lot Rent / Mo',
    rateType: 'monthly',
    showSF: false,
    types: [
      { id: 'single_wide', name: 'Single-Wide Lot', icon: 'home', section: 'Standard', hasSeasons: false, defaultFields: { count: 0 } },
      { id: 'double_wide', name: 'Double-Wide Lot', icon: 'home', section: 'Standard', hasSeasons: false, defaultFields: { count: 0 } },
      { id: 'triple_wide', name: 'Triple-Wide Lot', icon: 'home', section: 'Standard', hasSeasons: false, defaultFields: { count: 0 } },
      { id: 'rv_lot', name: 'RV Lot', icon: 'truck', section: 'Other', hasSeasons: false, defaultFields: { count: 0 } },
      { id: 'vacant_pad', name: 'Vacant Pad', icon: 'square', section: 'Other', hasSeasons: false, defaultFields: { count: 0 } },
      { id: 'park_owned_home', name: 'Park-Owned Home', icon: 'home', section: 'POH', hasSeasons: false, defaultFields: { count: 0 } },
    ],
  },
  profitCenters: {
    tabLabel: 'Revenue Streams',
    showTab: true,
    departments: [
      { id: 'lot_rent', name: 'Lot Rent', icon: 'home', category: 'core', description: 'Monthly lot rental income from tenant-owned homes',
        hasRevenue: true, hasCOGS: false, hasDirectLabor: false,
        revenueLines: ['Single-Wide Lot Rent', 'Double-Wide Lot Rent', 'RV Lot Rent'] },
      { id: 'utility_reimbursement', name: 'Utility Reimbursement', icon: 'zap', category: 'core', description: 'Utility pass-through and RUBS charges',
        hasRevenue: true, hasCOGS: true, hasDirectLabor: false,
        revenueLines: ['Water/Sewer RUBS', 'Trash RUBS', 'Electric RUBS'],
        cogsLines: ['Utility Costs (Master Metered)'] },
      { id: 'home_sales', name: 'Home Sales', icon: 'dollar-sign', category: 'ancillary', description: 'Sale of park-owned homes and test-in fees',
        hasRevenue: true, hasCOGS: true, hasDirectLabor: false,
        revenueLines: ['POH Sale Revenue', 'Lease-to-Own Revenue', 'Test-In/Set-Up Fees'],
        cogsLines: ['Home Acquisition Cost', 'Rehab/Setup Costs'] },
      { id: 'laundry', name: 'Laundry', icon: 'home', category: 'ancillary', description: 'Community laundry facility revenue',
        hasRevenue: true, hasCOGS: false, hasDirectLabor: false,
        revenueLines: ['Laundry Revenue'] },
      { id: 'storage', name: 'Storage', icon: 'warehouse', category: 'ancillary', description: 'Storage unit and shed rentals',
        hasRevenue: true, hasCOGS: false, hasDirectLabor: false,
        revenueLines: ['Storage Unit Rent', 'Shed/Garage Rent'] },
    ],
  },
  inputSections: [
    {
      id: 'property_details',
      label: 'Property Details',
      icon: 'home',
      fields: [
        { id: 'purchasePrice', label: 'Purchase Price', type: 'currency', width: 'half' },
        { id: 'totalLots', label: 'Total Lots / Pads', type: 'integer', width: 'half' },
        { id: 'occupiedLots', label: 'Occupied Lots', type: 'integer', width: 'half' },
        { id: 'vacantDevelopedLots', label: 'Vacant Developed Lots', type: 'integer', width: 'half', tooltip: 'Lots with infrastructure in place but currently unoccupied' },
        { id: 'undevelopedLots', label: 'Undeveloped Lot Potential', type: 'integer', width: 'half', tooltip: 'Additional lots that could be developed with infrastructure investment' },
        { id: 'parkOwnedHomes', label: 'Park-Owned Homes (POH)', type: 'integer', width: 'half', tooltip: 'Homes owned by the park and rented to tenants; creates higher revenue but more management burden' },
        { id: 'tenantOwnedHomes', label: 'Tenant-Owned Homes (TOH)', type: 'integer', width: 'half', tooltip: 'Homes owned by tenants on rented lots; preferred by investors for lower maintenance' },
        { id: 'totalAcreage', label: 'Total Acreage', type: 'number', width: 'half' },
        { id: 'yearEstablished', label: 'Year Established', type: 'integer', width: 'half' },
        { id: 'waterSystem', label: 'Water System', type: 'select', width: 'half',
          options: [
            { value: 'municipal', label: 'Municipal / City' },
            { value: 'private_well', label: 'Private Well' },
            { value: 'community_well', label: 'Community Well System' },
          ],
          tooltip: 'Municipal water is preferred; private well systems carry capital risk' },
        { id: 'sewerSystem', label: 'Sewer System', type: 'select', width: 'half',
          options: [
            { value: 'municipal', label: 'Municipal / City' },
            { value: 'septic', label: 'Septic (Individual)' },
            { value: 'lagoon', label: 'Lagoon / Package Plant' },
          ],
          tooltip: 'Municipal sewer preferred; septic and lagoon carry environmental/capital risk' },
        { id: 'roadType', label: 'Road Surface', type: 'select', width: 'half',
          options: [
            { value: 'paved', label: 'Paved' },
            { value: 'gravel', label: 'Gravel' },
            { value: 'mixed', label: 'Mixed' },
          ]},
      ],
    },
    {
      id: 'revenue',
      label: 'Revenue Assumptions',
      icon: 'dollar-sign',
      fields: [
        { id: 'avgLotRent', label: 'Avg In-Place Lot Rent / Mo', type: 'currency', width: 'half' },
        { id: 'marketLotRent', label: 'Market Lot Rent / Mo', type: 'currency', width: 'half', tooltip: 'Current market rate for comparable communities; gap indicates rent increase upside' },
        { id: 'occupancyPercent', label: 'Occupancy %', type: 'percent', width: 'half', defaultValue: 88 },
        { id: 'pohRentPerMonth', label: 'Avg POH Rent / Home / Mo', type: 'currency', width: 'half', tooltip: 'Monthly rent charged for park-owned homes (includes lot rent + home rent)' },
        { id: 'utilityReimbursementPerLot', label: 'Utility Reimbursement / Lot / Mo', type: 'currency', width: 'half', tooltip: 'RUBS or sub-metered utility pass-through per lot' },
        { id: 'lateFeeRevenueAnnual', label: 'Late Fee Revenue / Year', type: 'currency', width: 'half' },
        { id: 'applicationFeeRevenue', label: 'Application / Admin Fee Revenue / Year', type: 'currency', width: 'half' },
        { id: 'storageRevenueAnnual', label: 'Storage Shed / Garage Revenue / Year', type: 'currency', width: 'half' },
        { id: 'laundryRevenueAnnual', label: 'Laundry Revenue / Year', type: 'currency', width: 'half' },
        { id: 'homeSaleRevenueAnnual', label: 'Home Sale / Lease-to-Own Revenue / Year', type: 'currency', width: 'half', tooltip: 'Annual revenue from selling or lease-to-owning park-owned homes' },
      ],
    },
    {
      id: 'expenses',
      label: 'Operating Expenses',
      icon: 'receipt',
      fields: [
        { id: 'parkManagerSalary', label: 'Park Manager Salary / Year', type: 'currency', width: 'half' },
        { id: 'maintenanceStaffCost', label: 'Maintenance Staff / Year', type: 'currency', width: 'half' },
        { id: 'managementFeePercent', label: 'Management Fee %', type: 'percent', width: 'half', defaultValue: 6, tooltip: 'Third-party management fee; MHP managers typically charge 6-8%' },
        { id: 'waterSewerAnnual', label: 'Water & Sewer / Year', type: 'currency', width: 'half', tooltip: 'Master-metered water and sewer costs; critical expense line for non-sub-metered parks' },
        { id: 'electricAnnual', label: 'Electric (Common Area) / Year', type: 'currency', width: 'half' },
        { id: 'trashRemovalAnnual', label: 'Trash Removal / Year', type: 'currency', width: 'half' },
        { id: 'roadMaintenanceAnnual', label: 'Road Maintenance / Year', type: 'currency', width: 'half' },
        { id: 'landscapingAnnual', label: 'Landscaping & Grounds / Year', type: 'currency', width: 'half' },
        { id: 'snowRemovalAnnual', label: 'Snow Removal / Year', type: 'currency', width: 'half' },
        { id: 'repairsMaintenanceAnnual', label: 'Repairs & Maintenance / Year', type: 'currency', width: 'half' },
        { id: 'pohMaintenanceAnnual', label: 'POH Maintenance / Year', type: 'currency', width: 'half', tooltip: 'Additional maintenance for park-owned homes (HVAC, plumbing, appliances, roofing)' },
        { id: 'insuranceAnnual', label: 'Insurance / Year', type: 'currency', width: 'half' },
        { id: 'propertyTaxAnnual', label: 'Property Tax / Year', type: 'currency', width: 'half' },
        { id: 'legalAccountingAnnual', label: 'Legal & Accounting / Year', type: 'currency', width: 'half' },
        { id: 'badDebtPercent', label: 'Bad Debt %', type: 'percent', width: 'half', defaultValue: 2 },
      ],
    },
    {
      id: 'capital',
      label: 'Capital Reserves & POH Strategy',
      icon: 'tool',
      fields: [
        { id: 'capexReservePerLot', label: 'CapEx Reserve / Lot / Year', type: 'currency', width: 'half', tooltip: 'Annual infrastructure capital reserve per lot' },
        { id: 'waterSewerCapexReserve', label: 'Water/Sewer CapEx Reserve / Year', type: 'currency', width: 'half', tooltip: 'Reserve for water line, sewer line, and well/pump repairs' },
        { id: 'roadRepavingReserve', label: 'Road Repaving Reserve / Year', type: 'currency', width: 'half' },
        { id: 'pohConversionBudget', label: 'POH-to-TOH Conversion Budget / Year', type: 'currency', width: 'half', tooltip: 'Annual budget for selling park-owned homes to convert lots to tenant-owned (reduces OpEx, improves NOI quality)' },
        { id: 'homeAcquisitionBudget', label: 'New Home Acquisition Budget / Year', type: 'currency', width: 'half', tooltip: 'Budget for purchasing new/used homes to place on vacant lots for infill' },
        { id: 'lotDevelopmentCostPerLot', label: 'Lot Development Cost / Lot', type: 'currency', width: 'half', tooltip: 'Cost to develop an undeveloped lot (water, sewer, electric, pad, grading)' },
      ],
    },
  ],
  growthCategories: [
    { id: 'lot_rent', label: 'Lot Rent Growth', icon: 'trending-up', description: 'Annual lot rent increases toward market; MHP lot rents often have significant below-market upside (5-10% increases common during catch-up)', defaultRate: 5.0 },
    { id: 'poh_rent', label: 'POH Rent Growth', icon: 'home', description: 'Annual park-owned home rent increases', defaultRate: 3.0 },
    { id: 'utility_revenue', label: 'Utility Revenue Growth', icon: 'zap', description: 'Utility reimbursement / RUBS revenue growth tracking actual utility cost increases', defaultRate: 3.0 },
    { id: 'home_sales', label: 'Home Sales Revenue Growth', icon: 'dollar-sign', description: 'POH sale and lease-to-own revenue growth as infill and conversion programs scale', defaultRate: 2.0 },
    { id: 'ancillary_revenue', label: 'Ancillary Revenue Growth', icon: 'layers', description: 'Laundry, storage, late fees, and admin fee revenue growth', defaultRate: 2.0 },
    { id: 'operating_expenses', label: 'Operating Expense Growth', icon: 'arrow-up', description: 'Controllable OpEx inflation for R&M, grounds, and management', defaultRate: 2.5 },
    { id: 'utilities_expense', label: 'Utility Expense Growth', icon: 'zap', description: 'Master-metered water, sewer, and electric cost escalation', defaultRate: 3.0 },
    { id: 'payroll', label: 'Payroll Growth', icon: 'users', description: 'Park manager and maintenance staff wage escalation', defaultRate: 3.0 },
    { id: 'insurance', label: 'Insurance Growth', icon: 'shield', description: 'Property, liability, and flood insurance premium increases', defaultRate: 5.0 },
    { id: 'property_tax', label: 'Property Tax Growth', icon: 'building', description: 'Tax assessment growth; acquisition may trigger reassessment', defaultRate: 2.0 },
  ],
  kpis: [
    { id: 'purchasePrice', label: 'Purchase Price', field: 'purchasePrice', format: 'currency', icon: 'dollar-sign' },
    { id: 'capRate', label: 'Cap Rate', field: 'year1CapRate', format: 'percent', icon: 'percent' },
    { id: 'totalLots', label: 'Total Lots', field: 'totalStorageUnits', format: 'number', icon: 'home' },
    { id: 'noi', label: 'NOI', field: 'ebitda', format: 'currency', icon: 'trending-up' },
    { id: 'avgLotRent', label: 'Avg Lot Rent', field: 'avgLotRent', format: 'currency', icon: 'dollar-sign' },
    { id: 'occupancy', label: 'Occupancy', field: 'occupancyPercent', format: 'percent', icon: 'bar-chart' },
    { id: 'pricePerLot', label: '$/Lot', field: 'pricePerUnit', format: 'currency', icon: 'dollar-sign' },
    { id: 'pohPercent', label: 'POH %', field: 'pohPercent', format: 'percent', icon: 'home' },
  ],
  tabs: { storageLeases: true, commercialLeases: false, profitCenters: true },
  allowCustomUnitTypes: true,
  allowCustomDepartments: true,
  allowCustomGrowthCategories: true,
};


// ═══════════════════════════════════════════════════════════════
// Parking Garage / Lot Config
// ═══════════════════════════════════════════════════════════════

const PARKING_CONFIG: AssetClassModelConfig = {
  id: 'parking',
  label: 'Parking Garage / Lot',
  terms: {
    unit: 'space', unitPlural: 'spaces',
    property: 'facility', propertyPlural: 'facilities',
    rentRoll: 'Space Inventory', occupancy: 'Occupancy',
    noi: 'NOI', pricePerUnit: '$/Space', totalUnitsLabel: 'Total Spaces',
  },
  valuationMetric: 'cap_rate',
  valuationLabel: 'Cap Rate',
  hasSeasonal: false,
  seasonConfig: { type: 'none' },
  unitMix: {
    tabLabel: 'Space Inventory',
    tabIcon: 'car',
    showTab: true,
    countColumnLabel: 'Spaces',
    rateColumnLabel: 'Rate / Mo',
    rateType: 'monthly',
    showSF: false,
    types: [
      { id: 'surface_monthly', name: 'Surface Monthly', icon: 'car', section: 'Surface', hasSeasons: false, defaultFields: { count: 0 } },
      { id: 'surface_transient', name: 'Surface Transient', icon: 'car', section: 'Surface', hasSeasons: false, defaultFields: { count: 0 } },
      { id: 'covered_monthly', name: 'Covered Monthly', icon: 'home', section: 'Covered', hasSeasons: false, defaultFields: { count: 0 } },
      { id: 'covered_transient', name: 'Covered Transient', icon: 'home', section: 'Covered', hasSeasons: false, defaultFields: { count: 0 } },
      { id: 'reserved', name: 'Reserved', icon: 'lock', section: 'Premium', hasSeasons: false, defaultFields: { count: 0 } },
      { id: 'ada', name: 'ADA', icon: 'users', section: 'Specialty', hasSeasons: false, defaultFields: { count: 0 } },
      { id: 'ev_charging', name: 'EV Charging', icon: 'zap', section: 'Specialty', hasSeasons: false, defaultFields: { count: 0 } },
      { id: 'valet', name: 'Valet', icon: 'star', section: 'Premium', hasSeasons: false, defaultFields: { count: 0 } },
    ],
  },
  profitCenters: {
    tabLabel: 'Revenue Streams',
    showTab: true,
    departments: [
      { id: 'monthly_parking', name: 'Monthly Parking', icon: 'calendar', category: 'core', description: 'Monthly contract parking revenue',
        hasRevenue: true, hasCOGS: false, hasDirectLabor: false,
        revenueLines: ['Monthly Contract Revenue', 'Reserved Space Premium', 'Corporate Account Revenue'] },
      { id: 'transient_hourly', name: 'Transient / Hourly', icon: 'clock', category: 'core', description: 'Short-term and hourly parking',
        hasRevenue: true, hasCOGS: false, hasDirectLabor: true,
        revenueLines: ['Hourly Parking Revenue', 'Daily Max Revenue', 'Early Bird Special Revenue'],
        expenseLines: ['Cashier/Attendant Labor', 'PARCS Equipment Maintenance'] },
      { id: 'event_parking', name: 'Event Parking', icon: 'calendar', category: 'ancillary', description: 'Event-driven premium parking',
        hasRevenue: true, hasCOGS: false, hasDirectLabor: true,
        revenueLines: ['Event Parking Revenue', 'Surge Pricing Revenue'],
        expenseLines: ['Event Parking Staff'] },
      { id: 'valet_service', name: 'Valet', icon: 'star', category: 'ancillary', description: 'Valet parking services',
        hasRevenue: true, hasCOGS: false, hasDirectLabor: true,
        revenueLines: ['Valet Fee Revenue', 'Valet Tips'],
        expenseLines: ['Valet Staff Compensation'] },
      { id: 'storage_lockers', name: 'Storage / Lockers', icon: 'warehouse', category: 'ancillary', description: 'Tenant storage lockers within garage',
        hasRevenue: true, hasCOGS: false, hasDirectLabor: false,
        revenueLines: ['Storage Locker Revenue', 'Bike Storage Revenue'] },
    ],
  },
  inputSections: [
    { id: 'general', label: 'General Assumptions', icon: 'settings', fields: [
      { id: 'purchasePrice', label: 'Purchase Price', type: 'currency', width: 'half' },
      { id: 'closingDate', label: 'Closing Date', type: 'text', width: 'half' },
      { id: 'holdPeriod', label: 'Hold Period (Years)', type: 'integer', width: 'half', defaultValue: 7 },
      { id: 'totalSpaces', label: 'Total Spaces', type: 'integer', width: 'half' },
      { id: 'facilityType', label: 'Facility Type', type: 'select', width: 'half',
        options: [
          { value: 'surface_lot', label: 'Surface Lot' },
          { value: 'structured_garage', label: 'Structured Garage' },
          { value: 'underground', label: 'Underground' },
          { value: 'mixed', label: 'Mixed (Surface + Structure)' },
        ]},
      { id: 'managementFeePercent', label: 'Management Fee %', type: 'percent', width: 'half', defaultValue: 5 },
    ]},
    { id: 'operations', label: 'Operations', icon: 'bar-chart', fields: [
      { id: 'monthlyContractPercent', label: '% Monthly Contract Spaces', type: 'percent', width: 'half', defaultValue: 60 },
      { id: 'avgMonthlyRate', label: 'Avg Monthly Rate', type: 'currency', width: 'half' },
      { id: 'avgHourlyRate', label: 'Avg Hourly Rate', type: 'currency', width: 'half' },
      { id: 'avgDailyMax', label: 'Avg Daily Max Rate', type: 'currency', width: 'half' },
      { id: 'occupancyPercent', label: 'Avg Occupancy %', type: 'percent', width: 'half', defaultValue: 75 },
      { id: 'evChargingSpaces', label: 'EV Charging Spaces', type: 'integer', width: 'half' },
    ]},
    { id: 'expenses', label: 'Operating Expenses', icon: 'receipt', fields: [
      { id: 'payrollBenefits', label: 'Payroll & Benefits / Year', type: 'currency', width: 'half' },
      { id: 'utilitiesAnnual', label: 'Utilities / Year', type: 'currency', width: 'half' },
      { id: 'maintenanceAnnual', label: 'Maintenance & Cleaning / Year', type: 'currency', width: 'half' },
      { id: 'insuranceAnnual', label: 'Insurance / Year', type: 'currency', width: 'half' },
      { id: 'propertyTaxAnnual', label: 'Property Tax / Year', type: 'currency', width: 'half' },
      { id: 'technologyAnnual', label: 'PARCS & Technology / Year', type: 'currency', width: 'half' },
      { id: 'capexReservePercent', label: 'CapEx Reserve %', type: 'percent', width: 'half', defaultValue: 5 },
    ]},
  ],
  growthCategories: [
    { id: 'monthly_revenue', label: 'Monthly Parking Revenue Growth', icon: 'trending-up', description: 'Contract parking rate increases', defaultRate: 3.0 },
    { id: 'transient_revenue', label: 'Transient Revenue Growth', icon: 'clock', description: 'Hourly and daily parking revenue growth', defaultRate: 2.5 },
    { id: 'event_revenue', label: 'Event Revenue Growth', icon: 'calendar', description: 'Event parking and surge pricing growth', defaultRate: 3.0 },
    { id: 'operating_expenses', label: 'Operating Expense Growth', icon: 'arrow-up', description: 'General operating costs', defaultRate: 2.5 },
    { id: 'payroll', label: 'Payroll Growth', icon: 'users', description: 'Attendant and management wages', defaultRate: 3.0 },
    { id: 'insurance', label: 'Insurance Growth', icon: 'shield', description: 'Liability and property insurance', defaultRate: 4.0 },
    { id: 'property_tax', label: 'Property Tax Growth', icon: 'building', description: 'Tax assessment growth', defaultRate: 2.0 },
  ],
  kpis: [
    { id: 'purchasePrice', label: 'Purchase Price', field: 'purchasePrice', format: 'currency', icon: 'dollar-sign' },
    { id: 'capRate', label: 'Cap Rate', field: 'year1CapRate', format: 'percent', icon: 'percent' },
    { id: 'totalSpaces', label: 'Total Spaces', field: 'totalStorageUnits', format: 'number', icon: 'car' },
    { id: 'noi', label: 'NOI', field: 'ebitda', format: 'currency', icon: 'trending-up' },
    { id: 'pricePerSpace', label: '$/Space', field: 'pricePerUnit', format: 'currency', icon: 'dollar-sign' },
    { id: 'occupancy', label: 'Occupancy', field: 'occupancyPercent', format: 'percent', icon: 'bar-chart' },
  ],
  tabs: { storageLeases: true, commercialLeases: false, profitCenters: true },
  allowCustomUnitTypes: true,
  allowCustomDepartments: true,
  allowCustomGrowthCategories: true,
};


// ═══════════════════════════════════════════════════════════════
// Data Center Config
// ═══════════════════════════════════════════════════════════════

const DATA_CENTER_CONFIG: AssetClassModelConfig = {
  id: 'data_center',
  label: 'Data Center',
  terms: {
    unit: 'cabinet', unitPlural: 'cabinets',
    property: 'facility', propertyPlural: 'facilities',
    rentRoll: 'Cabinet Inventory', occupancy: 'Utilization',
    noi: 'NOI', pricePerUnit: '$/kW', totalUnitsLabel: 'Total Cabinets',
  },
  valuationMetric: 'cap_rate',
  valuationLabel: 'Cap Rate',
  hasSeasonal: false,
  seasonConfig: { type: 'none' },
  unitMix: {
    tabLabel: 'Cabinet Inventory',
    tabIcon: 'server',
    showTab: true,
    countColumnLabel: 'Cabinets / Units',
    rateColumnLabel: 'Rate / Mo',
    rateType: 'monthly',
    showSF: false,
    types: [
      { id: 'quarter_cabinet', name: 'Quarter Cabinet', icon: 'server', section: 'Retail Colo', hasSeasons: false, defaultFields: { count: 0 } },
      { id: 'half_cabinet', name: 'Half Cabinet', icon: 'server', section: 'Retail Colo', hasSeasons: false, defaultFields: { count: 0 } },
      { id: 'full_cabinet', name: 'Full Cabinet', icon: 'server', section: 'Retail Colo', hasSeasons: false, defaultFields: { count: 0 } },
      { id: 'cage', name: 'Cage', icon: 'lock', section: 'Wholesale', hasSeasons: false, defaultFields: { count: 0 } },
      { id: 'private_suite', name: 'Private Suite', icon: 'shield', section: 'Wholesale', hasSeasons: false, defaultFields: { count: 0 } },
      { id: 'powered_shell', name: 'Powered Shell', icon: 'zap', section: 'Wholesale', hasSeasons: false, defaultFields: { count: 0 } },
    ],
  },
  profitCenters: {
    tabLabel: 'Revenue Streams',
    showTab: true,
    departments: [
      { id: 'colocation', name: 'Colocation Revenue', icon: 'server', category: 'core', description: 'Cabinet, cage, and suite colocation revenue',
        hasRevenue: true, hasCOGS: false, hasDirectLabor: true,
        revenueLines: ['Retail Colo Revenue', 'Wholesale Colo Revenue', 'Cage Revenue', 'Suite Revenue'],
        expenseLines: ['Data Center Technician Labor', 'Security Staff'] },
      { id: 'power_revenue', name: 'Power Revenue', icon: 'zap', category: 'core', description: 'Metered and committed power revenue',
        hasRevenue: true, hasCOGS: true, hasDirectLabor: false,
        revenueLines: ['Metered Power Revenue', 'Committed Power Revenue', 'Power Overage Charges'],
        cogsLines: ['Utility Power Costs', 'Fuel (Generator Backup)'] },
      { id: 'connectivity', name: 'Connectivity / Cross-Connect', icon: 'link', category: 'core', description: 'Network cross-connects and carrier access',
        hasRevenue: true, hasCOGS: true, hasDirectLabor: false,
        revenueLines: ['Cross-Connect Revenue', 'Carrier Access Fees', 'Internet Transit Revenue', 'Dark Fiber Revenue'],
        cogsLines: ['Carrier & Transit Costs'] },
      { id: 'managed_services', name: 'Managed Services', icon: 'settings', category: 'ancillary', description: 'Remote hands, monitoring, and managed infrastructure',
        hasRevenue: true, hasCOGS: false, hasDirectLabor: true,
        revenueLines: ['Remote Hands Revenue', 'Monitoring & Alerting Revenue', 'Managed Firewall/Security', 'Backup & DR Services'],
        expenseLines: ['Managed Services Staff', 'Monitoring Software'] },
    ],
  },
  inputSections: [
    { id: 'general', label: 'General Assumptions', icon: 'settings', fields: [
      { id: 'purchasePrice', label: 'Purchase Price', type: 'currency', width: 'half' },
      { id: 'closingDate', label: 'Closing Date', type: 'text', width: 'half' },
      { id: 'holdPeriod', label: 'Hold Period (Years)', type: 'integer', width: 'half', defaultValue: 10 },
      { id: 'totalRaisedFloorSF', label: 'Total Raised Floor SF', type: 'integer', width: 'half' },
      { id: 'totalPowerCapacityMW', label: 'Total Power Capacity (MW)', type: 'number', width: 'half' },
      { id: 'tierLevel', label: 'Tier Level', type: 'select', width: 'half',
        options: [
          { value: 'tier_1', label: 'Tier I (Basic)' },
          { value: 'tier_2', label: 'Tier II (Redundant Components)' },
          { value: 'tier_3', label: 'Tier III (Concurrently Maintainable)' },
          { value: 'tier_4', label: 'Tier IV (Fault Tolerant)' },
        ]},
      { id: 'pue', label: 'PUE (Power Usage Effectiveness)', type: 'number', width: 'half', defaultValue: 1.4, tooltip: 'Total facility power / IT load power; 1.2-1.5 is efficient' },
    ]},
    { id: 'capacity', label: 'Capacity & Utilization', icon: 'bar-chart', fields: [
      { id: 'totalCabinets', label: 'Total Cabinets', type: 'integer', width: 'half' },
      { id: 'utilizedCabinets', label: 'Utilized Cabinets', type: 'integer', width: 'half' },
      { id: 'avgPowerPerCabinetKW', label: 'Avg Power / Cabinet (kW)', type: 'number', width: 'half', defaultValue: 5 },
      { id: 'utilizationPercent', label: 'Utilization %', type: 'percent', width: 'half', defaultValue: 70 },
      { id: 'avgRevenuePerKW', label: 'Avg Revenue / kW / Mo', type: 'currency', width: 'half' },
      { id: 'crossConnectCount', label: 'Total Cross-Connects', type: 'integer', width: 'half' },
    ]},
    { id: 'expenses', label: 'Operating Expenses', icon: 'receipt', fields: [
      { id: 'powerCostAnnual', label: 'Power Cost / Year', type: 'currency', width: 'half' },
      { id: 'payrollBenefits', label: 'Payroll & Benefits / Year', type: 'currency', width: 'half' },
      { id: 'maintenanceAnnual', label: 'Maintenance & HVAC / Year', type: 'currency', width: 'half' },
      { id: 'carrierCostsAnnual', label: 'Carrier & Transit / Year', type: 'currency', width: 'half' },
      { id: 'insuranceAnnual', label: 'Insurance / Year', type: 'currency', width: 'half' },
      { id: 'propertyTaxAnnual', label: 'Property Tax / Year', type: 'currency', width: 'half' },
      { id: 'capexReservePercent', label: 'CapEx Reserve %', type: 'percent', width: 'half', defaultValue: 8, tooltip: 'Higher than typical RE due to equipment refresh cycles' },
    ]},
  ],
  growthCategories: [
    { id: 'colocation_revenue', label: 'Colocation Revenue Growth', icon: 'server', description: 'Cabinet and cage rental revenue growth', defaultRate: 5.0 },
    { id: 'power_revenue', label: 'Power Revenue Growth', icon: 'zap', description: 'Metered and committed power revenue growth', defaultRate: 4.0 },
    { id: 'connectivity_revenue', label: 'Connectivity Revenue Growth', icon: 'link', description: 'Cross-connect and carrier access growth', defaultRate: 3.0 },
    { id: 'managed_services_revenue', label: 'Managed Services Growth', icon: 'settings', description: 'Remote hands and managed infrastructure growth', defaultRate: 7.0 },
    { id: 'power_expense', label: 'Power Expense Growth', icon: 'zap', description: 'Utility power cost inflation', defaultRate: 3.0 },
    { id: 'operating_expenses', label: 'Operating Expense Growth', icon: 'arrow-up', description: 'Maintenance, carrier, and general overhead', defaultRate: 2.5 },
    { id: 'payroll', label: 'Payroll Growth', icon: 'users', description: 'Technician and operations staff wages', defaultRate: 3.5 },
    { id: 'insurance', label: 'Insurance Growth', icon: 'shield', description: 'Property and cyber liability insurance', defaultRate: 5.0 },
    { id: 'property_tax', label: 'Property Tax Growth', icon: 'building', description: 'Assessment growth on specialized facilities', defaultRate: 2.0 },
  ],
  kpis: [
    { id: 'purchasePrice', label: 'Purchase Price', field: 'purchasePrice', format: 'currency', icon: 'dollar-sign' },
    { id: 'capRate', label: 'Cap Rate', field: 'year1CapRate', format: 'percent', icon: 'percent' },
    { id: 'totalCabinets', label: 'Cabinets', field: 'totalStorageUnits', format: 'number', icon: 'server' },
    { id: 'noi', label: 'NOI', field: 'ebitda', format: 'currency', icon: 'trending-up' },
    { id: 'utilization', label: 'Utilization', field: 'utilizationPercent', format: 'percent', icon: 'bar-chart' },
    { id: 'revenuePerKW', label: '$/kW', field: 'avgRevenuePerKW', format: 'currency', icon: 'zap' },
  ],
  tabs: { storageLeases: true, commercialLeases: false, profitCenters: true },
  allowCustomUnitTypes: true,
  allowCustomDepartments: true,
  allowCustomGrowthCategories: true,
};


// ═══════════════════════════════════════════════════════════════
// Land Config (Vacant Land, Development Sites, Agricultural)
// ═══════════════════════════════════════════════════════════════

const LAND_CONFIG: AssetClassModelConfig = {
  id: 'land',
  label: 'Land / Development Site',
  terms: {
    unit: 'acre', unitPlural: 'acres',
    property: 'parcel', propertyPlural: 'parcels',
    rentRoll: 'Income Summary', occupancy: 'Utilization',
    noi: 'NOI', pricePerUnit: '$/Acre', totalUnitsLabel: 'Total Acres',
  },
  valuationMetric: 'cap_rate',
  valuationLabel: 'Cap Rate',
  hasSeasonal: false,
  seasonConfig: { type: 'none' },
  unitMix: {
    tabLabel: 'Parcels',
    tabIcon: 'map',
    showTab: false,
    countColumnLabel: 'Parcels',
    rateColumnLabel: 'Price / Acre',
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
      id: 'property_details',
      label: 'Property Details',
      icon: 'map',
      fields: [
        { id: 'purchasePrice', label: 'Purchase Price', type: 'currency', width: 'half' },
        { id: 'totalAcres', label: 'Total Acres', type: 'number', width: 'half' },
        { id: 'zoning', label: 'Zoning', type: 'select', width: 'half',
          options: [
            { value: 'residential_sfr', label: 'Residential (SFR)' },
            { value: 'residential_multi', label: 'Residential (Multifamily)' },
            { value: 'commercial', label: 'Commercial' },
            { value: 'industrial', label: 'Industrial' },
            { value: 'mixed_use', label: 'Mixed-Use' },
            { value: 'agricultural', label: 'Agricultural' },
            { value: 'unzoned', label: 'Unzoned / Rural' },
            { value: 'pud', label: 'PUD (Planned Unit Development)' },
          ]},
        { id: 'topography', label: 'Topography', type: 'select', width: 'half',
          options: [
            { value: 'flat', label: 'Flat / Level' },
            { value: 'gently_sloped', label: 'Gently Sloped' },
            { value: 'hilly', label: 'Hilly / Varied' },
            { value: 'steep', label: 'Steep (grading required)' },
          ]},
        { id: 'roadFrontage', label: 'Road Frontage (ft)', type: 'number', width: 'half', tooltip: 'Linear feet of road frontage; impacts visibility and access for commercial use' },
        { id: 'utilitiesAvailable', label: 'Utilities Available', type: 'select', width: 'half',
          options: [
            { value: 'all', label: 'All (Water, Sewer, Electric, Gas)' },
            { value: 'water_electric', label: 'Water & Electric Only' },
            { value: 'electric_only', label: 'Electric Only' },
            { value: 'none', label: 'None (Off-Grid)' },
          ],
          tooltip: 'Available utility connections at the property boundary' },
        { id: 'floodZone', label: 'Flood Zone', type: 'select', width: 'half',
          options: [
            { value: 'none', label: 'Zone X (Minimal Risk)' },
            { value: 'moderate', label: 'Zone B/X500 (Moderate Risk)' },
            { value: 'high', label: 'Zone A/AE (High Risk)' },
            { value: 'coastal', label: 'Zone V/VE (Coastal High Hazard)' },
          ]},
        { id: 'environmentalIssues', label: 'Environmental Issues', type: 'select', width: 'half',
          options: [
            { value: 'none', label: 'None Known' },
            { value: 'wetlands', label: 'Wetlands Present' },
            { value: 'contamination', label: 'Known Contamination' },
            { value: 'endangered_species', label: 'Endangered Species Habitat' },
          ]},
        { id: 'holdPeriod', label: 'Hold Period (Years)', type: 'integer', width: 'half', defaultValue: 5 },
      ],
    },
    {
      id: 'revenue',
      label: 'Current Income',
      icon: 'dollar-sign',
      fields: [
        { id: 'currentIncomeAnnual', label: 'Current Annual Income', type: 'currency', width: 'half', tooltip: 'Existing income from farming, timber, grazing lease, cell tower, billboard, etc.' },
        { id: 'incomeSource', label: 'Income Source', type: 'select', width: 'half',
          options: [
            { value: 'none', label: 'None' },
            { value: 'farm_lease', label: 'Farm / Crop Lease' },
            { value: 'timber', label: 'Timber Revenue' },
            { value: 'grazing', label: 'Grazing / Pasture Lease' },
            { value: 'cell_tower', label: 'Cell Tower Lease' },
            { value: 'billboard', label: 'Billboard Lease' },
            { value: 'solar', label: 'Solar Lease' },
            { value: 'hunting', label: 'Hunting Lease' },
            { value: 'other', label: 'Other' },
          ]},
        { id: 'mineralRightsIncluded', label: 'Mineral Rights Included', type: 'select', width: 'half',
          options: [
            { value: 'yes', label: 'Yes' },
            { value: 'no', label: 'No' },
            { value: 'partial', label: 'Partial' },
          ]},
        { id: 'waterRightsIncluded', label: 'Water Rights Included', type: 'select', width: 'half',
          options: [
            { value: 'yes', label: 'Yes' },
            { value: 'no', label: 'No' },
            { value: 'na', label: 'N/A' },
          ]},
      ],
    },
    {
      id: 'holding_costs',
      label: 'Holding Costs',
      icon: 'receipt',
      fields: [
        { id: 'propertyTaxAnnual', label: 'Property Tax / Year', type: 'currency', width: 'half', tooltip: 'Annual property tax; ag-exempt or greenbelt status may significantly reduce' },
        { id: 'insuranceAnnual', label: 'Insurance / Year', type: 'currency', width: 'half' },
        { id: 'maintenanceAnnual', label: 'Maintenance / Year', type: 'currency', width: 'half', tooltip: 'Fencing, mowing, road maintenance, and general upkeep' },
        { id: 'interestCarryAnnual', label: 'Interest Carry / Year', type: 'currency', width: 'half', tooltip: 'Annual financing cost if land is leveraged during hold period' },
        { id: 'hoa', label: 'HOA / Community Fees / Year', type: 'currency', width: 'half' },
      ],
    },
    {
      id: 'development',
      label: 'Development Potential',
      icon: 'hard-hat',
      fields: [
        { id: 'entitlementCosts', label: 'Entitlement Costs', type: 'currency', width: 'half', tooltip: 'Zoning applications, variances, environmental studies, traffic studies, and legal fees' },
        { id: 'subdivisionCosts', label: 'Subdivision / Platting Costs', type: 'currency', width: 'half', tooltip: 'Survey, plat preparation, engineering, and recording fees' },
        { id: 'infrastructureCosts', label: 'Infrastructure Costs', type: 'currency', width: 'half', tooltip: 'Roads, utilities, stormwater, grading, and site work to make lots development-ready' },
        { id: 'impactFees', label: 'Impact / Connection Fees', type: 'currency', width: 'half', tooltip: 'Municipal impact fees for water, sewer, schools, parks, and transportation' },
        { id: 'estimatedLots', label: 'Estimated Buildable Lots', type: 'integer', width: 'half', tooltip: 'Number of lots or units achievable under current/proposed zoning' },
        { id: 'estimatedFinishedLotValue', label: 'Est. Finished Lot Value', type: 'currency', width: 'half', tooltip: 'Estimated market value per finished lot after entitlement and infrastructure' },
        { id: 'developmentTimeline', label: 'Development Timeline (Months)', type: 'integer', width: 'half', tooltip: 'Estimated months from acquisition to finished lot sales' },
      ],
    },
  ],
  growthCategories: [
    { id: 'land_appreciation', label: 'Land Appreciation', icon: 'trending-up', description: 'Annual land value appreciation driven by population growth, infrastructure expansion, and supply constraints', defaultRate: 4.0 },
    { id: 'current_income', label: 'Current Income Growth', icon: 'dollar-sign', description: 'Growth in existing lease, farming, or other income streams', defaultRate: 2.0 },
    { id: 'holding_costs', label: 'Holding Cost Growth', icon: 'arrow-up', description: 'Annual increase in property tax, insurance, and maintenance costs', defaultRate: 2.5 },
    { id: 'property_tax', label: 'Property Tax Growth', icon: 'building', description: 'Property tax assessment growth; development activity may trigger reassessment', defaultRate: 2.0 },
    { id: 'construction_costs', label: 'Construction Cost Growth', icon: 'hard-hat', description: 'Infrastructure and development cost inflation; impacts finished lot margins', defaultRate: 4.0 },
  ],
  kpis: [
    { id: 'purchasePrice', label: 'Purchase Price', field: 'purchasePrice', format: 'currency', icon: 'dollar-sign' },
    { id: 'pricePerAcre', label: '$/Acre', field: 'pricePerUnit', format: 'currency', icon: 'map' },
    { id: 'totalAcres', label: 'Total Acres', field: 'totalStorageUnits', format: 'number', icon: 'map' },
    { id: 'currentIncome', label: 'Current Income', field: 'currentIncomeAnnual', format: 'currency', icon: 'dollar-sign' },
    { id: 'holdingCosts', label: 'Annual Holding Costs', field: 'holdingCostsAnnual', format: 'currency', icon: 'receipt' },
    { id: 'developmentProfit', label: 'Est. Development Profit', field: 'developmentProfit', format: 'currency', icon: 'trending-up' },
  ],
  tabs: { storageLeases: false, commercialLeases: false, profitCenters: false },
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
  car_wash: CAR_WASH_CONFIG,
  shopping_center: SHOPPING_CENTER_CONFIG,
  golf_course: GOLF_COURSE_CONFIG,
  landscaping: LANDSCAPING_CONFIG,
  construction: CONSTRUCTION_CONFIG,
  accounting_firm: ACCOUNTING_FIRM_CONFIG,
  rv_park: RV_PARK_CONFIG,
  car_dealership: CAR_DEALERSHIP_CONFIG,
  gas_station: GAS_STATION_CONFIG,
  restaurant: RESTAURANT_CONFIG,
  gym: GYM_CONFIG,
  daycare: DAYCARE_CONFIG,
  mobile_home_park: MOBILE_HOME_PARK_CONFIG,
  parking: PARKING_CONFIG,
  data_center: DATA_CENTER_CONFIG,
  land: LAND_CONFIG,
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
