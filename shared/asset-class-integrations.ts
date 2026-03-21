/**
 * Asset-Class-to-Integration Mapping
 *
 * Defines which third-party integrations are relevant for each asset class,
 * which ops modules they feed data into, and which P&L profit centers they
 * populate. Used by the integration registry, onboarding wizard, and
 * data-pipeline router to suggest and wire up integrations automatically.
 */

import type { OpsModuleKey } from './asset-class-ops-modules';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AssetClassKey =
  | 'marina'
  | 'multifamily'
  | 'retail'
  | 'office'
  | 'industrial'
  | 'medical_office'
  | 'hotel'
  | 'str'
  | 'self_storage'
  | 'mixed_use'
  | 'sfr'
  | 'duplex'
  | 'triplex'
  | 'quad'
  | 'rv_park'
  | 'mobile_home'
  | 'land'
  | 'business'
  | 'laundromat';

export type PnlCategory =
  | 'dockage_revenue'
  | 'fuel_revenue'
  | 'ship_store_revenue'
  | 'service_revenue'
  | 'boat_rental_revenue'
  | 'boat_club_revenue'
  | 'boat_sales_revenue'
  | 'rental_income'
  | 'commercial_lease_income'
  | 'cam_reimbursements'
  | 'room_revenue'
  | 'food_beverage_revenue'
  | 'ancillary_revenue'
  | 'storage_rental_income'
  | 'campsite_revenue'
  | 'rv_rental_income'
  | 'lot_rental_income'
  | 'laundry_revenue'
  | 'wash_dry_revenue'
  | 'payroll_expense'
  | 'operating_expense'
  | 'utilities_expense'
  | 'management_fees'
  | 'maintenance_expense'
  | 'marketing_expense'
  | 'insurance_expense'
  | 'taxes'
  | 'payment_processing_fees'
  | 'general_revenue'
  | 'general_expense';

export interface IntegrationAssetClassMapping {
  integrationKey: string;
  assetClasses: AssetClassKey[];
  opsModules: OpsModuleKey[];
  pnlCategories: PnlCategory[];
}

// ---------------------------------------------------------------------------
// Master integration-to-asset-class map
// ---------------------------------------------------------------------------

export const INTEGRATION_ASSET_CLASS_MAP: Record<string, IntegrationAssetClassMapping> = {
  // ── Marina PMS ──────────────────────────────────────────────────────────
  dockmaster: {
    integrationKey: 'dockmaster',
    assetClasses: ['marina'],
    opsModules: ['dockage', 'fuel', 'ship_store', 'service', 'boat_rentals', 'boat_sales', 'rent_roll', 'bookkeeping'],
    pnlCategories: ['dockage_revenue', 'fuel_revenue', 'ship_store_revenue', 'service_revenue', 'boat_rental_revenue', 'boat_sales_revenue', 'rental_income', 'operating_expense'],
  },
  marinaoffice: {
    integrationKey: 'marinaoffice',
    assetClasses: ['marina'],
    opsModules: ['dockage', 'fuel', 'ship_store', 'service', 'rent_roll', 'bookkeeping'],
    pnlCategories: ['dockage_revenue', 'fuel_revenue', 'ship_store_revenue', 'service_revenue', 'rental_income', 'operating_expense'],
  },
  sharper_mms: {
    integrationKey: 'sharper_mms',
    assetClasses: ['marina'],
    opsModules: ['dockage', 'service', 'boat_sales', 'rent_roll', 'bookkeeping'],
    pnlCategories: ['dockage_revenue', 'service_revenue', 'boat_sales_revenue', 'rental_income', 'operating_expense'],
  },
  dockwa: {
    integrationKey: 'dockwa',
    assetClasses: ['marina'],
    opsModules: ['dockage', 'rent_roll', 'marketing'],
    pnlCategories: ['dockage_revenue', 'rental_income', 'ancillary_revenue'],
  },
  scribble: {
    integrationKey: 'scribble',
    assetClasses: ['marina'],
    opsModules: ['dockage', 'rent_roll', 'bookkeeping'],
    pnlCategories: ['dockage_revenue', 'rental_income', 'operating_expense'],
  },
  storable_marine: {
    integrationKey: 'storable_marine',
    assetClasses: ['marina'],
    opsModules: ['dockage', 'rent_roll', 'bookkeeping'],
    pnlCategories: ['dockage_revenue', 'rental_income', 'storage_rental_income', 'operating_expense'],
  },

  // ── Multifamily PMS ─────────────────────────────────────────────────────
  yardi_voyager: {
    integrationKey: 'yardi_voyager',
    assetClasses: ['multifamily', 'mixed_use', 'retail', 'office', 'industrial'],
    opsModules: ['rent_roll', 'multifamily_ops', 'commercial_tenants', 'bookkeeping', 'budgeting', 'payroll'],
    pnlCategories: ['rental_income', 'commercial_lease_income', 'cam_reimbursements', 'operating_expense', 'payroll_expense', 'maintenance_expense', 'management_fees'],
  },
  realpage: {
    integrationKey: 'realpage',
    assetClasses: ['multifamily', 'mixed_use'],
    opsModules: ['rent_roll', 'multifamily_ops', 'bookkeeping', 'budgeting', 'marketing'],
    pnlCategories: ['rental_income', 'ancillary_revenue', 'operating_expense', 'marketing_expense', 'management_fees'],
  },
  appfolio: {
    integrationKey: 'appfolio',
    assetClasses: ['multifamily', 'sfr', 'duplex', 'triplex', 'quad', 'mixed_use'],
    opsModules: ['rent_roll', 'multifamily_ops', 'bookkeeping', 'budgeting'],
    pnlCategories: ['rental_income', 'operating_expense', 'maintenance_expense', 'management_fees'],
  },
  entrata: {
    integrationKey: 'entrata',
    assetClasses: ['multifamily', 'mixed_use'],
    opsModules: ['rent_roll', 'multifamily_ops', 'bookkeeping', 'budgeting', 'marketing'],
    pnlCategories: ['rental_income', 'ancillary_revenue', 'operating_expense', 'marketing_expense', 'management_fees'],
  },
  resman: {
    integrationKey: 'resman',
    assetClasses: ['multifamily', 'mixed_use'],
    opsModules: ['rent_roll', 'multifamily_ops', 'bookkeeping'],
    pnlCategories: ['rental_income', 'operating_expense', 'management_fees'],
  },

  // ── Self-Storage PMS ────────────────────────────────────────────────────
  sitelink: {
    integrationKey: 'sitelink',
    assetClasses: ['self_storage'],
    opsModules: ['self_storage_ops', 'rent_roll', 'bookkeeping', 'budgeting', 'marketing'],
    pnlCategories: ['storage_rental_income', 'ancillary_revenue', 'operating_expense', 'marketing_expense'],
  },
  storedge: {
    integrationKey: 'storedge',
    assetClasses: ['self_storage'],
    opsModules: ['self_storage_ops', 'rent_roll', 'bookkeeping', 'budgeting'],
    pnlCategories: ['storage_rental_income', 'ancillary_revenue', 'operating_expense'],
  },
  easy_storage: {
    integrationKey: 'easy_storage',
    assetClasses: ['self_storage'],
    opsModules: ['self_storage_ops', 'rent_roll', 'bookkeeping'],
    pnlCategories: ['storage_rental_income', 'operating_expense'],
  },
  tenant_inc: {
    integrationKey: 'tenant_inc',
    assetClasses: ['self_storage'],
    opsModules: ['self_storage_ops', 'rent_roll', 'bookkeeping'],
    pnlCategories: ['storage_rental_income', 'operating_expense'],
  },

  // ── Hotel / Hospitality PMS ─────────────────────────────────────────────
  opera_pms: {
    integrationKey: 'opera_pms',
    assetClasses: ['hotel'],
    opsModules: ['hotel_ops', 'bookkeeping', 'budgeting', 'payroll'],
    pnlCategories: ['room_revenue', 'food_beverage_revenue', 'ancillary_revenue', 'operating_expense', 'payroll_expense'],
  },
  mews: {
    integrationKey: 'mews',
    assetClasses: ['hotel'],
    opsModules: ['hotel_ops', 'bookkeeping', 'budgeting'],
    pnlCategories: ['room_revenue', 'food_beverage_revenue', 'ancillary_revenue', 'operating_expense'],
  },
  cloudbeds: {
    integrationKey: 'cloudbeds',
    assetClasses: ['hotel', 'str'],
    opsModules: ['hotel_ops', 'bookkeeping', 'marketing'],
    pnlCategories: ['room_revenue', 'ancillary_revenue', 'operating_expense', 'marketing_expense'],
  },
  roomkey_pms: {
    integrationKey: 'roomkey_pms',
    assetClasses: ['hotel'],
    opsModules: ['hotel_ops', 'bookkeeping'],
    pnlCategories: ['room_revenue', 'operating_expense'],
  },

  // ── Short-Term Rental (STR) ─────────────────────────────────────────────
  guesty: {
    integrationKey: 'guesty',
    assetClasses: ['str'],
    opsModules: ['bookkeeping', 'budgeting', 'marketing'],
    pnlCategories: ['room_revenue', 'ancillary_revenue', 'operating_expense', 'marketing_expense', 'management_fees'],
  },
  hospitable: {
    integrationKey: 'hospitable',
    assetClasses: ['str'],
    opsModules: ['bookkeeping', 'marketing'],
    pnlCategories: ['room_revenue', 'operating_expense', 'marketing_expense'],
  },
  ownerrez: {
    integrationKey: 'ownerrez',
    assetClasses: ['str'],
    opsModules: ['bookkeeping', 'budgeting', 'marketing'],
    pnlCategories: ['room_revenue', 'ancillary_revenue', 'operating_expense'],
  },
  lodgify: {
    integrationKey: 'lodgify',
    assetClasses: ['str'],
    opsModules: ['bookkeeping', 'marketing'],
    pnlCategories: ['room_revenue', 'operating_expense', 'marketing_expense'],
  },

  // ── RV Park / Campground ────────────────────────────────────────────────
  campspot: {
    integrationKey: 'campspot',
    assetClasses: ['rv_park'],
    opsModules: ['rent_roll', 'bookkeeping', 'budgeting', 'marketing'],
    pnlCategories: ['campsite_revenue', 'rv_rental_income', 'ancillary_revenue', 'operating_expense', 'marketing_expense'],
  },
  rms_cloud: {
    integrationKey: 'rms_cloud',
    assetClasses: ['rv_park'],
    opsModules: ['rent_roll', 'bookkeeping', 'budgeting'],
    pnlCategories: ['campsite_revenue', 'rv_rental_income', 'operating_expense'],
  },
  firefly: {
    integrationKey: 'firefly',
    assetClasses: ['rv_park'],
    opsModules: ['rent_roll', 'bookkeeping', 'budgeting', 'marketing'],
    pnlCategories: ['campsite_revenue', 'rv_rental_income', 'ancillary_revenue', 'operating_expense'],
  },
  camplife: {
    integrationKey: 'camplife',
    assetClasses: ['rv_park'],
    opsModules: ['rent_roll', 'bookkeeping'],
    pnlCategories: ['campsite_revenue', 'rv_rental_income', 'operating_expense'],
  },

  // ── Commercial RE (Retail / Office / Industrial) ────────────────────────
  mri_software: {
    integrationKey: 'mri_software',
    assetClasses: ['retail', 'office', 'industrial', 'medical_office', 'mixed_use'],
    opsModules: ['commercial_tenants', 'rent_roll', 'retail_office_ops', 'bookkeeping', 'budgeting'],
    pnlCategories: ['commercial_lease_income', 'cam_reimbursements', 'operating_expense', 'management_fees', 'maintenance_expense'],
  },
  vts: {
    integrationKey: 'vts',
    assetClasses: ['retail', 'office', 'industrial', 'medical_office'],
    opsModules: ['commercial_tenants', 'retail_office_ops', 'marketing'],
    pnlCategories: ['commercial_lease_income', 'marketing_expense'],
  },
  costar: {
    integrationKey: 'costar',
    assetClasses: ['retail', 'office', 'industrial', 'medical_office', 'multifamily', 'mixed_use'],
    opsModules: ['commercial_tenants', 'marketing'],
    pnlCategories: ['commercial_lease_income', 'marketing_expense'],
  },
  buildout: {
    integrationKey: 'buildout',
    assetClasses: ['retail', 'office', 'industrial'],
    opsModules: ['commercial_tenants', 'marketing'],
    pnlCategories: ['commercial_lease_income', 'marketing_expense'],
  },

  // ── Residential PM (SFR / Duplex / Triplex / Quad) ──────────────────────
  propertyware: {
    integrationKey: 'propertyware',
    assetClasses: ['sfr', 'duplex', 'triplex', 'quad', 'mobile_home'],
    opsModules: ['rent_roll', 'bookkeeping', 'budgeting'],
    pnlCategories: ['rental_income', 'operating_expense', 'maintenance_expense', 'management_fees'],
  },
  buildium: {
    integrationKey: 'buildium',
    assetClasses: ['sfr', 'duplex', 'triplex', 'quad', 'multifamily'],
    opsModules: ['rent_roll', 'bookkeeping', 'budgeting'],
    pnlCategories: ['rental_income', 'operating_expense', 'maintenance_expense', 'management_fees'],
  },
  rent_manager: {
    integrationKey: 'rent_manager',
    assetClasses: ['sfr', 'duplex', 'triplex', 'quad', 'multifamily', 'mobile_home'],
    opsModules: ['rent_roll', 'bookkeeping', 'budgeting'],
    pnlCategories: ['rental_income', 'operating_expense', 'maintenance_expense', 'management_fees'],
  },
  tenantcloud: {
    integrationKey: 'tenantcloud',
    assetClasses: ['sfr', 'duplex', 'triplex', 'quad'],
    opsModules: ['rent_roll', 'bookkeeping'],
    pnlCategories: ['rental_income', 'operating_expense', 'maintenance_expense'],
  },

  // ── Payroll & HR ────────────────────────────────────────────────────────
  gusto: {
    integrationKey: 'gusto',
    assetClasses: ['marina', 'multifamily', 'retail', 'office', 'industrial', 'medical_office', 'hotel', 'str', 'self_storage', 'mixed_use', 'rv_park', 'mobile_home', 'business', 'laundromat'],
    opsModules: ['payroll', 'bookkeeping'],
    pnlCategories: ['payroll_expense'],
  },
  adp_run: {
    integrationKey: 'adp_run',
    assetClasses: ['marina', 'multifamily', 'retail', 'office', 'industrial', 'medical_office', 'hotel', 'str', 'self_storage', 'mixed_use', 'rv_park', 'mobile_home', 'business', 'laundromat'],
    opsModules: ['payroll', 'bookkeeping'],
    pnlCategories: ['payroll_expense'],
  },
  paychex: {
    integrationKey: 'paychex',
    assetClasses: ['marina', 'multifamily', 'retail', 'office', 'industrial', 'medical_office', 'hotel', 'str', 'self_storage', 'mixed_use', 'rv_park', 'mobile_home', 'business', 'laundromat'],
    opsModules: ['payroll', 'bookkeeping'],
    pnlCategories: ['payroll_expense'],
  },

  // ── Accounting (cross-asset) ────────────────────────────────────────────
  quickbooks: {
    integrationKey: 'quickbooks',
    assetClasses: ['marina', 'multifamily', 'retail', 'office', 'industrial', 'medical_office', 'hotel', 'str', 'self_storage', 'mixed_use', 'sfr', 'duplex', 'triplex', 'quad', 'rv_park', 'mobile_home', 'land', 'business', 'laundromat'],
    opsModules: ['bookkeeping', 'budgeting'],
    pnlCategories: ['general_revenue', 'general_expense', 'operating_expense', 'payroll_expense', 'taxes', 'insurance_expense'],
  },
  sage_intacct: {
    integrationKey: 'sage_intacct',
    assetClasses: ['marina', 'multifamily', 'retail', 'office', 'industrial', 'medical_office', 'hotel', 'str', 'self_storage', 'mixed_use', 'sfr', 'duplex', 'triplex', 'quad', 'rv_park', 'mobile_home', 'land', 'business', 'laundromat'],
    opsModules: ['bookkeeping', 'budgeting'],
    pnlCategories: ['general_revenue', 'general_expense', 'operating_expense', 'payroll_expense', 'taxes', 'insurance_expense'],
  },
  xero: {
    integrationKey: 'xero',
    assetClasses: ['marina', 'multifamily', 'retail', 'office', 'industrial', 'medical_office', 'hotel', 'str', 'self_storage', 'mixed_use', 'sfr', 'duplex', 'triplex', 'quad', 'rv_park', 'mobile_home', 'land', 'business', 'laundromat'],
    opsModules: ['bookkeeping', 'budgeting'],
    pnlCategories: ['general_revenue', 'general_expense', 'operating_expense', 'payroll_expense', 'taxes', 'insurance_expense'],
  },
  freshbooks: {
    integrationKey: 'freshbooks',
    assetClasses: ['marina', 'multifamily', 'retail', 'office', 'industrial', 'medical_office', 'hotel', 'str', 'self_storage', 'mixed_use', 'sfr', 'duplex', 'triplex', 'quad', 'rv_park', 'mobile_home', 'land', 'business', 'laundromat'],
    opsModules: ['bookkeeping', 'budgeting'],
    pnlCategories: ['general_revenue', 'general_expense', 'operating_expense', 'taxes'],
  },

  // ── Payment Processing (cross-asset) ────────────────────────────────────
  stripe: {
    integrationKey: 'stripe',
    assetClasses: ['marina', 'multifamily', 'retail', 'office', 'industrial', 'medical_office', 'hotel', 'str', 'self_storage', 'mixed_use', 'sfr', 'duplex', 'triplex', 'quad', 'rv_park', 'mobile_home', 'business', 'laundromat'],
    opsModules: ['bookkeeping'],
    pnlCategories: ['general_revenue', 'payment_processing_fees'],
  },
  square: {
    integrationKey: 'square',
    assetClasses: ['marina', 'multifamily', 'retail', 'office', 'industrial', 'medical_office', 'hotel', 'str', 'self_storage', 'mixed_use', 'sfr', 'duplex', 'triplex', 'quad', 'rv_park', 'mobile_home', 'business', 'laundromat'],
    opsModules: ['bookkeeping'],
    pnlCategories: ['general_revenue', 'payment_processing_fees'],
  },
  paypal: {
    integrationKey: 'paypal',
    assetClasses: ['marina', 'multifamily', 'retail', 'office', 'industrial', 'medical_office', 'hotel', 'str', 'self_storage', 'mixed_use', 'sfr', 'duplex', 'triplex', 'quad', 'rv_park', 'mobile_home', 'business', 'laundromat'],
    opsModules: ['bookkeeping'],
    pnlCategories: ['general_revenue', 'payment_processing_fees'],
  },

  // ── Documents (cross-asset) ─────────────────────────────────────────────
  docusign: {
    integrationKey: 'docusign',
    assetClasses: ['marina', 'multifamily', 'retail', 'office', 'industrial', 'medical_office', 'hotel', 'str', 'self_storage', 'mixed_use', 'sfr', 'duplex', 'triplex', 'quad', 'rv_park', 'mobile_home', 'land', 'business', 'laundromat'],
    opsModules: [],
    pnlCategories: [],
  },
  qualia: {
    integrationKey: 'qualia',
    assetClasses: ['multifamily', 'retail', 'office', 'industrial', 'medical_office', 'mixed_use', 'sfr', 'duplex', 'triplex', 'quad', 'mobile_home', 'land'],
    opsModules: [],
    pnlCategories: [],
  },

  // ── Communications (cross-asset) ────────────────────────────────────────
  twilio: {
    integrationKey: 'twilio',
    assetClasses: ['marina', 'multifamily', 'retail', 'office', 'industrial', 'medical_office', 'hotel', 'str', 'self_storage', 'mixed_use', 'sfr', 'duplex', 'triplex', 'quad', 'rv_park', 'mobile_home', 'business', 'laundromat'],
    opsModules: ['marketing'],
    pnlCategories: ['marketing_expense'],
  },
  sendgrid: {
    integrationKey: 'sendgrid',
    assetClasses: ['marina', 'multifamily', 'retail', 'office', 'industrial', 'medical_office', 'hotel', 'str', 'self_storage', 'mixed_use', 'sfr', 'duplex', 'triplex', 'quad', 'rv_park', 'mobile_home', 'business', 'laundromat'],
    opsModules: ['marketing'],
    pnlCategories: ['marketing_expense'],
  },
  slack: {
    integrationKey: 'slack',
    assetClasses: ['marina', 'multifamily', 'retail', 'office', 'industrial', 'medical_office', 'hotel', 'str', 'self_storage', 'mixed_use', 'sfr', 'duplex', 'triplex', 'quad', 'rv_park', 'mobile_home', 'land', 'business', 'laundromat'],
    opsModules: [],
    pnlCategories: [],
  },

  // ── Business / Laundromat ───────────────────────────────────────────────
  cleancloud: {
    integrationKey: 'cleancloud',
    assetClasses: ['laundromat', 'business'],
    opsModules: ['bookkeeping', 'budgeting', 'marketing'],
    pnlCategories: ['laundry_revenue', 'wash_dry_revenue', 'operating_expense', 'marketing_expense'],
  },
  cents_laundry: {
    integrationKey: 'cents_laundry',
    assetClasses: ['laundromat', 'business'],
    opsModules: ['bookkeeping', 'budgeting', 'marketing'],
    pnlCategories: ['laundry_revenue', 'wash_dry_revenue', 'operating_expense'],
  },
  speedqueen: {
    integrationKey: 'speedqueen',
    assetClasses: ['laundromat', 'business'],
    opsModules: ['bookkeeping', 'budgeting'],
    pnlCategories: ['laundry_revenue', 'wash_dry_revenue', 'operating_expense', 'utilities_expense'],
  },
};

// ---------------------------------------------------------------------------
// Recommended integrations per asset class (primary = core PMS/ops, secondary
// = supplementary accounting / payroll / comms)
// ---------------------------------------------------------------------------

export const ASSET_CLASS_RECOMMENDED_INTEGRATIONS: Record<string, { primary: string[]; secondary: string[] }> = {
  marina: {
    primary: ['dockmaster', 'marinaoffice', 'sharper_mms', 'dockwa', 'scribble', 'storable_marine'],
    secondary: ['quickbooks', 'sage_intacct', 'xero', 'gusto', 'adp_run', 'stripe', 'docusign', 'twilio', 'sendgrid'],
  },
  multifamily: {
    primary: ['yardi_voyager', 'realpage', 'appfolio', 'entrata', 'resman'],
    secondary: ['quickbooks', 'sage_intacct', 'xero', 'gusto', 'adp_run', 'stripe', 'docusign', 'qualia', 'twilio', 'sendgrid'],
  },
  retail: {
    primary: ['mri_software', 'vts', 'costar', 'buildout'],
    secondary: ['quickbooks', 'sage_intacct', 'xero', 'gusto', 'adp_run', 'stripe', 'docusign', 'twilio'],
  },
  office: {
    primary: ['mri_software', 'vts', 'costar', 'buildout'],
    secondary: ['quickbooks', 'sage_intacct', 'xero', 'gusto', 'adp_run', 'stripe', 'docusign', 'twilio'],
  },
  industrial: {
    primary: ['mri_software', 'vts', 'costar', 'buildout'],
    secondary: ['quickbooks', 'sage_intacct', 'xero', 'gusto', 'adp_run', 'stripe', 'docusign'],
  },
  medical_office: {
    primary: ['mri_software', 'vts', 'costar'],
    secondary: ['quickbooks', 'sage_intacct', 'xero', 'gusto', 'adp_run', 'stripe', 'docusign'],
  },
  hotel: {
    primary: ['opera_pms', 'mews', 'cloudbeds', 'roomkey_pms'],
    secondary: ['quickbooks', 'sage_intacct', 'xero', 'gusto', 'adp_run', 'stripe', 'square', 'docusign', 'twilio', 'sendgrid'],
  },
  str: {
    primary: ['guesty', 'hospitable', 'ownerrez', 'lodgify', 'cloudbeds'],
    secondary: ['quickbooks', 'xero', 'freshbooks', 'stripe', 'paypal', 'docusign', 'twilio', 'sendgrid'],
  },
  self_storage: {
    primary: ['sitelink', 'storedge', 'easy_storage', 'tenant_inc'],
    secondary: ['quickbooks', 'sage_intacct', 'xero', 'gusto', 'stripe', 'docusign', 'twilio', 'sendgrid'],
  },
  mixed_use: {
    primary: ['yardi_voyager', 'mri_software', 'realpage', 'appfolio', 'entrata'],
    secondary: ['quickbooks', 'sage_intacct', 'xero', 'gusto', 'adp_run', 'stripe', 'docusign', 'qualia', 'twilio'],
  },
  sfr: {
    primary: ['propertyware', 'buildium', 'rent_manager', 'tenantcloud', 'appfolio'],
    secondary: ['quickbooks', 'xero', 'freshbooks', 'stripe', 'docusign', 'qualia'],
  },
  duplex: {
    primary: ['propertyware', 'buildium', 'rent_manager', 'tenantcloud'],
    secondary: ['quickbooks', 'xero', 'freshbooks', 'stripe', 'docusign', 'qualia'],
  },
  triplex: {
    primary: ['propertyware', 'buildium', 'rent_manager', 'tenantcloud'],
    secondary: ['quickbooks', 'xero', 'freshbooks', 'stripe', 'docusign', 'qualia'],
  },
  quad: {
    primary: ['propertyware', 'buildium', 'rent_manager', 'tenantcloud'],
    secondary: ['quickbooks', 'xero', 'freshbooks', 'stripe', 'docusign', 'qualia'],
  },
  rv_park: {
    primary: ['campspot', 'rms_cloud', 'firefly', 'camplife'],
    secondary: ['quickbooks', 'xero', 'gusto', 'stripe', 'square', 'docusign', 'twilio', 'sendgrid'],
  },
  mobile_home: {
    primary: ['propertyware', 'rent_manager'],
    secondary: ['quickbooks', 'xero', 'gusto', 'stripe', 'docusign', 'qualia', 'twilio'],
  },
  land: {
    primary: [],
    secondary: ['quickbooks', 'sage_intacct', 'xero', 'docusign', 'qualia'],
  },
  business: {
    primary: ['cleancloud', 'cents_laundry', 'speedqueen'],
    secondary: ['quickbooks', 'xero', 'freshbooks', 'gusto', 'stripe', 'square', 'docusign', 'twilio', 'sendgrid'],
  },
  laundromat: {
    primary: ['cleancloud', 'cents_laundry', 'speedqueen'],
    secondary: ['quickbooks', 'xero', 'freshbooks', 'gusto', 'stripe', 'square', 'docusign', 'twilio'],
  },
};

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

/**
 * Returns all integration keys that are relevant to a given asset class.
 * Includes both primary (PMS/ops) and cross-asset (accounting, payroll, etc.)
 * integrations whose `assetClasses` array contains the given class.
 */
export function getIntegrationsForAssetClass(assetClass: string): string[] {
  const results: string[] = [];
  for (const [key, mapping] of Object.entries(INTEGRATION_ASSET_CLASS_MAP)) {
    if (mapping.assetClasses.includes(assetClass as AssetClassKey)) {
      results.push(key);
    }
  }
  return results;
}

/**
 * Returns which ops modules a given integration feeds data into.
 * Returns an empty array if the integration key is not found.
 */
export function getIntegrationOpsModules(integrationKey: string): OpsModuleKey[] {
  const mapping = INTEGRATION_ASSET_CLASS_MAP[integrationKey];
  return mapping ? [...mapping.opsModules] : [];
}

/**
 * Returns the P&L categories that a given integration populates.
 * Returns an empty array if the integration key is not found.
 */
export function getIntegrationPnlCategories(integrationKey: string): PnlCategory[] {
  const mapping = INTEGRATION_ASSET_CLASS_MAP[integrationKey];
  return mapping ? [...mapping.pnlCategories] : [];
}

/**
 * Returns integration keys that feed into a specific ops module.
 */
export function getIntegrationsForOpsModule(opsModule: OpsModuleKey): string[] {
  const results: string[] = [];
  for (const [key, mapping] of Object.entries(INTEGRATION_ASSET_CLASS_MAP)) {
    if (mapping.opsModules.includes(opsModule)) {
      results.push(key);
    }
  }
  return results;
}

/**
 * Returns the recommended integrations (primary + secondary) for an asset class.
 * Falls back to an empty structure if the asset class is not found.
 */
export function getRecommendedIntegrations(assetClass: string): { primary: string[]; secondary: string[] } {
  return ASSET_CLASS_RECOMMENDED_INTEGRATIONS[assetClass] ?? { primary: [], secondary: [] };
}
