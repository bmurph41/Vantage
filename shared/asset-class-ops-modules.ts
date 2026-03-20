/**
 * Asset-Class-to-Operations-Module Mapping
 *
 * Defines which operations modules are available for each asset class.
 * Used by the frontend sidebar, route guards, and backend module resolver
 * to dynamically show/hide operations functionality based on owned assets.
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
  | 'marketing';

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
};

/**
 * Maps each asset class to its available operations modules.
 */
export const ASSET_CLASS_OPS_MODULES: Record<string, OpsModuleKey[]> = {
  marina: [
    'fuel', 'ship_store', 'dockage', 'service', 'boat_rentals', 'boat_club', 'boat_sales',
    'rent_roll', 'commercial_tenants', 'bookkeeping', 'payroll', 'budgeting', 'marketing',
  ],
  multifamily: [
    'rent_roll', 'commercial_tenants', 'bookkeeping', 'payroll', 'budgeting', 'marketing',
  ],
  retail: [
    'commercial_tenants', 'bookkeeping', 'payroll', 'budgeting', 'marketing',
  ],
  office: [
    'commercial_tenants', 'bookkeeping', 'payroll', 'budgeting', 'marketing',
  ],
  industrial: [
    'commercial_tenants', 'bookkeeping', 'payroll', 'budgeting', 'marketing',
  ],
  medical_office: [
    'commercial_tenants', 'bookkeeping', 'payroll', 'budgeting', 'marketing',
  ],
  hotel: [
    'bookkeeping', 'payroll', 'budgeting', 'marketing',
  ],
  str: [
    'bookkeeping', 'budgeting', 'marketing',
  ],
  self_storage: [
    'rent_roll', 'bookkeeping', 'budgeting', 'marketing',
  ],
  mixed_use: [
    'rent_roll', 'commercial_tenants', 'bookkeeping', 'payroll', 'budgeting', 'marketing',
  ],
  sfr: [
    'bookkeeping', 'budgeting',
  ],
  duplex: [
    'bookkeeping', 'budgeting',
  ],
  triplex: [
    'bookkeeping', 'budgeting',
  ],
  quad: [
    'bookkeeping', 'budgeting',
  ],
  rv_park: [
    'rent_roll', 'bookkeeping', 'budgeting', 'marketing',
  ],
  mobile_home: [
    'rent_roll', 'bookkeeping', 'budgeting', 'marketing',
  ],
  land: [
    'bookkeeping',
  ],
  business: [
    'bookkeeping', 'payroll', 'budgeting', 'marketing',
  ],
  laundromat: [
    'bookkeeping', 'budgeting', 'marketing',
  ],
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
    }
  }

  return Array.from(moduleSet);
}

/**
 * Returns all defined asset class keys.
 */
export function getAllAssetClassKeys(): string[] {
  return Object.keys(ASSET_CLASS_OPS_MODULES);
}
