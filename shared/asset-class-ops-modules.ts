/**
 * Asset-Class-to-Operations-Module Mapping
 *
 * Defines which operations modules are available for each asset class.
 * Used by the frontend sidebar, route guards, and backend module resolver
 * to dynamically show/hide operations functionality based on owned assets.
 *
 * Every class defined in shared/marketplace/asset-class-taxonomy.ts has an
 * entry here. CRE classes get rent_roll / commercial_tenants where
 * appropriate; operating businesses and franchises get the universal ops
 * modules plus asset-class-specific landings where bespoke pages exist.
 */

export type OpsModuleKey =
  | 'fuel'
  | 'ship_store'
  | 'dockage'
  | 'service'
  | 'boat_rentals'
  | 'boat_club'
  | 'boat_sales'
  | 'rent_roll'
  | 'commercial_tenants'
  | 'bookkeeping'
  | 'payroll'
  | 'budgeting'
  | 'marketing'
  | 'hotel_ops'
  | 'multifamily_ops'
  | 'retail_office_ops'
  | 'self_storage_ops';

export interface OpsModuleDefinition {
  key: OpsModuleKey;
  label: string;
  route: string;
}

export const OPS_MODULE_DEFINITIONS: Record<OpsModuleKey, OpsModuleDefinition> = {
  fuel: { key: 'fuel', label: 'Fuel Sales', route: '/operations/fuel' },
  ship_store: { key: 'ship_store', label: 'Ship Store', route: '/operations/ship-store' },
  dockage: { key: 'dockage', label: 'Dockit', route: '/operations/dockit' },
  service: { key: 'service', label: 'Service & Parts', route: '/operations/service' },
  boat_rentals: { key: 'boat_rentals', label: 'Boat Rentals', route: '/operations/boat-rentals' },
  boat_club: { key: 'boat_club', label: 'Boat Club', route: '/operations/boat-club' },
  boat_sales: { key: 'boat_sales', label: 'Boat Sales', route: '/operations/boat-sales' },
  rent_roll: { key: 'rent_roll', label: 'Rent Roll', route: '/rent-roll/executive' },
  commercial_tenants: { key: 'commercial_tenants', label: 'Commercial Tenants', route: '/operations/commercial-tenants' },
  bookkeeping: { key: 'bookkeeping', label: 'Bookkeeping', route: '/operations/bookkeeping' },
  payroll: { key: 'payroll', label: 'Payroll', route: '/operations/payroll' },
  budgeting: { key: 'budgeting', label: 'Budgeting', route: '/operations/budgeting' },
  marketing: { key: 'marketing', label: 'Marketing', route: '/marketing' },
  hotel_ops: { key: 'hotel_ops', label: 'Hotel Ops', route: '/operations/hotel' },
  multifamily_ops: { key: 'multifamily_ops', label: 'Multifamily Ops', route: '/operations/multifamily' },
  retail_office_ops: { key: 'retail_office_ops', label: 'Retail/Office Ops', route: '/operations/retail-office' },
  self_storage_ops: { key: 'self_storage_ops', label: 'Self-Storage Ops', route: '/operations/self-storage' },
};

// ─── Module presets ─────────────────────────────────────────────────
// Reusable module sets so new asset classes inherit sensible defaults
// without duplicating the list in every entry.

const UNIVERSAL_OPS: OpsModuleKey[] = ['bookkeeping', 'payroll', 'budgeting', 'marketing'];
const CRE_RESIDENTIAL: OpsModuleKey[] = ['rent_roll', ...UNIVERSAL_OPS];
const CRE_COMMERCIAL: OpsModuleKey[] = ['rent_roll', 'commercial_tenants', ...UNIVERSAL_OPS];
const LIGHT_BIZ: OpsModuleKey[] = ['bookkeeping', 'budgeting', 'marketing']; // no payroll (solo / SFR)
const LAND_OPS: OpsModuleKey[] = ['bookkeeping', 'budgeting'];

/**
 * Maps each asset class to its available operations modules.
 */
export const ASSET_CLASS_OPS_MODULES: Record<string, OpsModuleKey[]> = {
  // ─── Legacy simplified keys ─────────────────────────────────────
  marina: [
    'fuel', 'ship_store', 'dockage', 'service', 'boat_rentals', 'boat_club', 'boat_sales',
    'rent_roll', 'commercial_tenants', ...UNIVERSAL_OPS,
  ],
  multifamily: [...CRE_RESIDENTIAL, 'commercial_tenants', 'multifamily_ops'],
  retail: [...CRE_COMMERCIAL, 'retail_office_ops'],
  office: [...CRE_COMMERCIAL, 'retail_office_ops'],
  industrial: CRE_COMMERCIAL,
  medical_office: [...CRE_COMMERCIAL, 'retail_office_ops'],
  hotel: [...UNIVERSAL_OPS, 'hotel_ops'],
  str: ['bookkeeping', 'budgeting', 'marketing'],
  self_storage: ['rent_roll', ...LIGHT_BIZ, 'self_storage_ops'],
  mixed_use: CRE_COMMERCIAL,
  sfr: LIGHT_BIZ,
  duplex: LIGHT_BIZ,
  triplex: LIGHT_BIZ,
  quad: LIGHT_BIZ,
  business: UNIVERSAL_OPS,
  laundromat: LIGHT_BIZ,

  // ─── Marina / Waterfront ────────────────────────────────────────
  yacht_club: ['dockage', 'service', 'ship_store', 'rent_roll', 'commercial_tenants', ...UNIVERSAL_OPS],
  boatyard: ['service', 'ship_store', ...UNIVERSAL_OPS],
  dry_storage_facility: ['dockage', 'service', 'rent_roll', ...UNIVERSAL_OPS],
  waterfront_resort: [...UNIVERSAL_OPS, 'hotel_ops'],

  // ─── Hospitality ────────────────────────────────────────────────
  hotel_full_service: [...UNIVERSAL_OPS, 'hotel_ops'],
  hotel_limited_service: [...UNIVERSAL_OPS, 'hotel_ops'],
  hotel_boutique: [...UNIVERSAL_OPS, 'hotel_ops'],
  extended_stay: [...UNIVERSAL_OPS, 'hotel_ops'],
  resort: [...UNIVERSAL_OPS, 'hotel_ops'],
  str_portfolio: ['bookkeeping', 'budgeting', 'marketing'],
  rv_park: ['rent_roll', ...UNIVERSAL_OPS],

  // ─── Multifamily ────────────────────────────────────────────────
  apartment_garden: [...CRE_RESIDENTIAL, 'commercial_tenants', 'multifamily_ops'],
  apartment_midrise: [...CRE_RESIDENTIAL, 'commercial_tenants', 'multifamily_ops'],
  apartment_highrise: [...CRE_RESIDENTIAL, 'commercial_tenants', 'multifamily_ops'],
  student_housing: [...CRE_RESIDENTIAL, 'multifamily_ops'],
  senior_housing: [...CRE_RESIDENTIAL, 'multifamily_ops'],
  assisted_living: [...CRE_RESIDENTIAL, 'multifamily_ops'],
  manufactured_home_park: [...CRE_RESIDENTIAL, 'multifamily_ops'],
  mobile_home: [...CRE_RESIDENTIAL, 'multifamily_ops'],

  // ─── Office ─────────────────────────────────────────────────────
  office_class_a: [...CRE_COMMERCIAL, 'retail_office_ops'],
  office_class_b: [...CRE_COMMERCIAL, 'retail_office_ops'],
  office_class_c: [...CRE_COMMERCIAL, 'retail_office_ops'],
  office_flex: [...CRE_COMMERCIAL, 'retail_office_ops'],
  coworking: [...CRE_COMMERCIAL, 'retail_office_ops'],

  // ─── Retail CRE ─────────────────────────────────────────────────
  shopping_center_strip: [...CRE_COMMERCIAL, 'retail_office_ops'],
  shopping_center_neighborhood: [...CRE_COMMERCIAL, 'retail_office_ops'],
  shopping_center_power: [...CRE_COMMERCIAL, 'retail_office_ops'],
  shopping_mall: [...CRE_COMMERCIAL, 'retail_office_ops'],
  single_tenant_nnn: ['commercial_tenants', ...UNIVERSAL_OPS],
  restaurant_property: ['commercial_tenants', ...UNIVERSAL_OPS],
  convenience_store_property: ['commercial_tenants', ...UNIVERSAL_OPS],

  // ─── Industrial ─────────────────────────────────────────────────
  warehouse: CRE_COMMERCIAL,
  distribution_center: CRE_COMMERCIAL,
  manufacturing_facility: CRE_COMMERCIAL,
  cold_storage: CRE_COMMERCIAL,
  data_center: CRE_COMMERCIAL,
  industrial_outdoor_storage: CRE_COMMERCIAL,

  // ─── Self-Storage / Land / Specialty ───────────────────────────
  self_storage_facility: ['rent_roll', ...LIGHT_BIZ, 'self_storage_ops'],
  land_development: LAND_OPS,
  land_agricultural: LAND_OPS,
  parking_facility: ['rent_roll', ...UNIVERSAL_OPS],
  car_wash_property: ['commercial_tenants', ...UNIVERSAL_OPS],
  religious_facility: ['commercial_tenants', ...UNIVERSAL_OPS],

  // ─── Operating Businesses ───────────────────────────────────────
  biz_restaurant: UNIVERSAL_OPS,
  biz_bar: UNIVERSAL_OPS,
  biz_coffee_shop: UNIVERSAL_OPS,
  biz_brewery: UNIVERSAL_OPS,
  biz_winery: UNIVERSAL_OPS,
  biz_food_truck: UNIVERSAL_OPS,
  biz_catering: UNIVERSAL_OPS,

  biz_convenience_store: UNIVERSAL_OPS,
  biz_liquor_store: UNIVERSAL_OPS,
  biz_gas_station: UNIVERSAL_OPS,
  biz_smoke_shop: UNIVERSAL_OPS,
  biz_apparel: UNIVERSAL_OPS,
  biz_grocery: UNIVERSAL_OPS,

  biz_landscaping: UNIVERSAL_OPS,
  biz_cleaning: UNIVERSAL_OPS,
  biz_pest_control: UNIVERSAL_OPS,
  biz_security: UNIVERSAL_OPS,
  biz_pool_service: UNIVERSAL_OPS,
  biz_event_rental: UNIVERSAL_OPS,

  biz_saas: UNIVERSAL_OPS,
  biz_mobile_app: UNIVERSAL_OPS,
  biz_content_site: LIGHT_BIZ,
  biz_ecommerce_dtc: UNIVERSAL_OPS,
  biz_amazon_fba: UNIVERSAL_OPS,
  biz_marketplace: UNIVERSAL_OPS,

  biz_manufacturing: UNIVERSAL_OPS,
  biz_food_manufacturing: UNIVERSAL_OPS,
  biz_distribution: UNIVERSAL_OPS,
  biz_trucking: UNIVERSAL_OPS,

  biz_dental_practice: UNIVERSAL_OPS,
  biz_medical_practice: UNIVERSAL_OPS,
  biz_veterinary: UNIVERSAL_OPS,
  biz_home_health: UNIVERSAL_OPS,

  biz_auto_repair: UNIVERSAL_OPS,
  biz_auto_dealer: UNIVERSAL_OPS,
  biz_car_wash: UNIVERSAL_OPS,

  biz_daycare: UNIVERSAL_OPS,
  biz_tutoring: UNIVERSAL_OPS,

  biz_gym: UNIVERSAL_OPS,
  biz_yoga_studio: UNIVERSAL_OPS,
  biz_bowling_alley: UNIVERSAL_OPS,
  biz_golf_course: UNIVERSAL_OPS,

  biz_general_contractor: UNIVERSAL_OPS,
  biz_hvac: UNIVERSAL_OPS,
  biz_plumbing: UNIVERSAL_OPS,
  biz_electrical: UNIVERSAL_OPS,
  biz_roofing: UNIVERSAL_OPS,

  biz_law_firm: UNIVERSAL_OPS,
  biz_accounting_firm: UNIVERSAL_OPS,
  biz_insurance_agency: UNIVERSAL_OPS,
  biz_marketing_agency: UNIVERSAL_OPS,

  biz_salon: UNIVERSAL_OPS,
  biz_spa: UNIVERSAL_OPS,
  biz_nail_salon: UNIVERSAL_OPS,
  biz_tanning: UNIVERSAL_OPS,

  // ─── Franchise ──────────────────────────────────────────────────
  franchise_qsr: UNIVERSAL_OPS,
  franchise_fitness: UNIVERSAL_OPS,
  franchise_services: UNIVERSAL_OPS,
  franchise_retail: UNIVERSAL_OPS,

  // ─── Notes ──────────────────────────────────────────────────────
  note_performing: ['bookkeeping', 'budgeting'],
  note_non_performing: ['bookkeeping', 'budgeting'],
};

/**
 * Returns the union of all ops modules across all owned asset classes.
 * Deduplicates and returns unique module keys.
 */
export function getOpsModulesForAssetClasses(assetClasses: string[]): OpsModuleKey[] {
  const moduleSet = new Set<OpsModuleKey>();

  for (const assetClass of assetClasses) {
    const modules = ASSET_CLASS_OPS_MODULES[assetClass];
    if (modules) {
      for (const mod of modules) {
        moduleSet.add(mod);
      }
    } else {
      // Unknown class — fall back to universal ops so the landing still works.
      for (const mod of UNIVERSAL_OPS) {
        moduleSet.add(mod);
      }
    }
  }

  return Array.from(moduleSet);
}

/**
 * Returns the ops modules available for a single asset class, falling back
 * to universal ops when the class is not explicitly mapped.
 */
export function getOpsModulesForAssetClass(assetClass: string): OpsModuleKey[] {
  return ASSET_CLASS_OPS_MODULES[assetClass] ?? [...UNIVERSAL_OPS];
}

/**
 * Returns all defined asset class keys.
 */
export function getAllAssetClassKeys(): string[] {
  return Object.keys(ASSET_CLASS_OPS_MODULES);
}

// ─── Operations Subcategory System ──────────────────────────────────────────

export type OpsSubcategory =
  | 'financials'
  | 'people'
  | 'leasing'
  | 'marketing_ops'
  | 'marina_ops'
  | 'hotel_ops'
  | 'multifamily_ops'
  | 'retail_office_ops'
  | 'self_storage_ops';

/** Maps each module to its subcategory for sidebar grouping */
export const OPS_MODULE_SUBCATEGORY: Record<OpsModuleKey, OpsSubcategory> = {
  bookkeeping: 'financials',
  budgeting: 'financials',
  payroll: 'people',
  rent_roll: 'leasing',
  commercial_tenants: 'leasing',
  marketing: 'marketing_ops',
  dockage: 'marina_ops',
  fuel: 'marina_ops',
  ship_store: 'marina_ops',
  service: 'marina_ops',
  boat_rentals: 'marina_ops',
  boat_club: 'marina_ops',
  boat_sales: 'marina_ops',
  hotel_ops: 'hotel_ops',
  multifamily_ops: 'multifamily_ops',
  retail_office_ops: 'retail_office_ops',
  self_storage_ops: 'self_storage_ops',
};

/** Subcategories that appear for all users regardless of asset class */
export const UNIVERSAL_SUBCATEGORIES: OpsSubcategory[] = [
  'financials', 'people', 'leasing', 'marketing_ops',
];

/** Metadata for each subcategory — used by sidebar rendering */
export const OPS_SUBCATEGORY_META: {
  id: OpsSubcategory;
  label: string;
  isUniversal: boolean;
  assetClasses?: string[];
}[] = [
  { id: 'financials', label: 'Financials', isUniversal: true },
  { id: 'people', label: 'Payroll', isUniversal: true },
  { id: 'leasing', label: 'Leasing', isUniversal: true },
  { id: 'marketing_ops', label: 'Marketing', isUniversal: true },
  { id: 'marina_ops', label: 'Marina', isUniversal: false, assetClasses: ['marina', 'yacht_club', 'boatyard', 'dry_storage_facility'] },
  { id: 'hotel_ops', label: 'Hotel', isUniversal: false, assetClasses: ['hotel', 'hotel_full_service', 'hotel_limited_service', 'hotel_boutique', 'extended_stay', 'resort', 'waterfront_resort'] },
  { id: 'multifamily_ops', label: 'Multifamily', isUniversal: false, assetClasses: ['multifamily', 'apartment_garden', 'apartment_midrise', 'apartment_highrise', 'student_housing', 'senior_housing', 'assisted_living', 'manufactured_home_park', 'mobile_home'] },
  { id: 'retail_office_ops', label: 'Retail / Office', isUniversal: false, assetClasses: ['retail', 'office', 'medical_office', 'shopping_center_strip', 'shopping_center_neighborhood', 'shopping_center_power', 'shopping_mall', 'office_class_a', 'office_class_b', 'office_class_c', 'office_flex', 'coworking'] },
  { id: 'self_storage_ops', label: 'Self-Storage', isUniversal: false, assetClasses: ['self_storage', 'self_storage_facility'] },
];

/** Get subcategory for a module key */
export function getSubcategoryForModule(moduleKey: OpsModuleKey): OpsSubcategory {
  return OPS_MODULE_SUBCATEGORY[moduleKey];
}
