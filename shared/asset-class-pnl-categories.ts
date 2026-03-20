/**
 * Asset-Class-to-P&L Category Mappings
 *
 * Maps each asset class's profit centers to modelingActuals categories.
 * Used by operations-data-sync-service and import-actuals to write
 * the correct category/subcategory/department into modelingActuals.
 */

export interface PnlCategoryMapping {
  profitCenter: string;
  category: string;
  subcategory: string;
  department: string;
}

/**
 * Per-asset-class P&L mappings from profit centers → modelingActuals fields.
 */
export const ASSET_CLASS_PNL_MAPPINGS: Record<string, PnlCategoryMapping[]> = {
  marina: [
    { profitCenter: 'wet_slips', category: 'Revenue', subcategory: 'Wet Slip Revenue', department: 'Dockage' },
    { profitCenter: 'dry_storage', category: 'Revenue', subcategory: 'Dry Storage Revenue', department: 'Dockage' },
    { profitCenter: 'fuel', category: 'Revenue', subcategory: 'Fuel Revenue', department: 'Fuel' },
    { profitCenter: 'ship_store', category: 'Revenue', subcategory: 'Ship Store Revenue', department: 'Retail' },
    { profitCenter: 'service', category: 'Revenue', subcategory: 'Service Revenue', department: 'Service' },
    { profitCenter: 'boat_rentals', category: 'Revenue', subcategory: 'Boat Rental Revenue', department: 'Rentals' },
    { profitCenter: 'boat_club', category: 'Revenue', subcategory: 'Boat Club Revenue', department: 'Club' },
    { profitCenter: 'boat_sales', category: 'Revenue', subcategory: 'Boat Sales Revenue', department: 'Sales' },
    { profitCenter: 'commercial_tenants', category: 'Revenue', subcategory: 'Commercial Tenant Revenue', department: 'Leasing' },
    { profitCenter: 'fuel_cogs', category: 'COGS', subcategory: 'Fuel COGS', department: 'Fuel' },
    { profitCenter: 'ship_store_cogs', category: 'COGS', subcategory: 'Ship Store COGS', department: 'Retail' },
    { profitCenter: 'service_cogs', category: 'COGS', subcategory: 'Service COGS', department: 'Service' },
  ],
  multifamily: [
    { profitCenter: 'residential_rent', category: 'Revenue', subcategory: 'Residential Rent', department: 'Leasing' },
    { profitCenter: 'parking', category: 'Revenue', subcategory: 'Parking', department: 'Ancillary' },
    { profitCenter: 'laundry_vending', category: 'Revenue', subcategory: 'Laundry & Vending', department: 'Ancillary' },
    { profitCenter: 'pet_fees', category: 'Revenue', subcategory: 'Pet Fees', department: 'Ancillary' },
    { profitCenter: 'storage_units', category: 'Revenue', subcategory: 'Storage Units', department: 'Ancillary' },
    { profitCenter: 'application_fees', category: 'Revenue', subcategory: 'Application & Admin Fees', department: 'Leasing' },
    { profitCenter: 'utility_reimbursement', category: 'Revenue', subcategory: 'Utility Reimbursement', department: 'Ancillary' },
  ],
  retail: [
    { profitCenter: 'base_rent', category: 'Revenue', subcategory: 'Base Rent', department: 'Leasing' },
    { profitCenter: 'cam_recovery', category: 'Revenue', subcategory: 'CAM Recovery', department: 'Leasing' },
    { profitCenter: 'tax_insurance_recovery', category: 'Revenue', subcategory: 'Tax & Insurance Recovery', department: 'Leasing' },
    { profitCenter: 'percentage_rent', category: 'Revenue', subcategory: 'Percentage Rent', department: 'Leasing' },
    { profitCenter: 'parking', category: 'Revenue', subcategory: 'Parking', department: 'Ancillary' },
    { profitCenter: 'signage', category: 'Revenue', subcategory: 'Signage & Advertising', department: 'Ancillary' },
  ],
  office: [
    { profitCenter: 'base_rent', category: 'Revenue', subcategory: 'Base Rent', department: 'Leasing' },
    { profitCenter: 'cam_recovery', category: 'Revenue', subcategory: 'CAM Recovery', department: 'Leasing' },
    { profitCenter: 'parking', category: 'Revenue', subcategory: 'Parking', department: 'Ancillary' },
    { profitCenter: 'conference_rooms', category: 'Revenue', subcategory: 'Conference Room Rental', department: 'Ancillary' },
    { profitCenter: 'tenant_services', category: 'Revenue', subcategory: 'Tenant Services', department: 'Ancillary' },
  ],
  industrial: [
    { profitCenter: 'base_rent', category: 'Revenue', subcategory: 'Base Rent', department: 'Leasing' },
    { profitCenter: 'cam_recovery', category: 'Revenue', subcategory: 'CAM Recovery', department: 'Leasing' },
    { profitCenter: 'yard_storage', category: 'Revenue', subcategory: 'Yard / Outdoor Storage', department: 'Ancillary' },
  ],
  medical_office: [
    { profitCenter: 'base_rent', category: 'Revenue', subcategory: 'Base Rent', department: 'Leasing' },
    { profitCenter: 'cam_recovery', category: 'Revenue', subcategory: 'CAM Recovery', department: 'Leasing' },
    { profitCenter: 'equipment_rental', category: 'Revenue', subcategory: 'Equipment Rental', department: 'Ancillary' },
  ],
  hotel: [
    { profitCenter: 'rooms', category: 'Revenue', subcategory: 'Rooms Revenue', department: 'Rooms' },
    { profitCenter: 'food_beverage', category: 'Revenue', subcategory: 'F&B Revenue', department: 'F&B' },
    { profitCenter: 'meeting_space', category: 'Revenue', subcategory: 'Meeting & Events', department: 'Events' },
    { profitCenter: 'spa', category: 'Revenue', subcategory: 'Spa / Wellness', department: 'Spa' },
    { profitCenter: 'parking', category: 'Revenue', subcategory: 'Parking', department: 'Ancillary' },
    { profitCenter: 'golf', category: 'Revenue', subcategory: 'Golf', department: 'Recreation' },
    { profitCenter: 'retail', category: 'Revenue', subcategory: 'Retail / Gift Shop', department: 'Retail' },
    { profitCenter: 'other_operated', category: 'Revenue', subcategory: 'Other Operated', department: 'Other' },
  ],
  str: [
    { profitCenter: 'nightly_rate', category: 'Revenue', subcategory: 'Nightly Revenue', department: 'Operations' },
    { profitCenter: 'cleaning_fee', category: 'Revenue', subcategory: 'Cleaning Fees', department: 'Operations' },
    { profitCenter: 'pet_fee', category: 'Revenue', subcategory: 'Pet Fees', department: 'Ancillary' },
    { profitCenter: 'experience_add_on', category: 'Revenue', subcategory: 'Experience Add-Ons', department: 'Ancillary' },
    { profitCenter: 'late_checkout', category: 'Revenue', subcategory: 'Late Checkout', department: 'Ancillary' },
  ],
  self_storage: [
    { profitCenter: 'unit_rent', category: 'Revenue', subcategory: 'Unit Rent', department: 'Storage' },
    { profitCenter: 'tenant_insurance', category: 'Revenue', subcategory: 'Tenant Insurance', department: 'Ancillary' },
    { profitCenter: 'merchandise', category: 'Revenue', subcategory: 'Merchandise Sales', department: 'Retail' },
    { profitCenter: 'truck_rental', category: 'Revenue', subcategory: 'Truck Rental', department: 'Ancillary' },
    { profitCenter: 'late_fees', category: 'Revenue', subcategory: 'Late Fees & Lien Sales', department: 'Collections' },
  ],
  mixed_use: [
    { profitCenter: 'residential_rent', category: 'Revenue', subcategory: 'Residential Rent', department: 'Leasing' },
    { profitCenter: 'retail_rent', category: 'Revenue', subcategory: 'Retail / Ground Floor', department: 'Leasing' },
    { profitCenter: 'office_rent', category: 'Revenue', subcategory: 'Office Rent', department: 'Leasing' },
    { profitCenter: 'cam_recovery', category: 'Revenue', subcategory: 'CAM Recovery', department: 'Leasing' },
    { profitCenter: 'parking', category: 'Revenue', subcategory: 'Parking', department: 'Ancillary' },
  ],
  business: [
    { profitCenter: 'primary_revenue', category: 'Revenue', subcategory: 'Primary Revenue', department: 'Operations' },
    { profitCenter: 'secondary_revenue', category: 'Revenue', subcategory: 'Secondary Revenue', department: 'Operations' },
    { profitCenter: 'services', category: 'Revenue', subcategory: 'Service Revenue', department: 'Services' },
  ],
  laundromat: [
    { profitCenter: 'washer_revenue', category: 'Revenue', subcategory: 'Washer Revenue', department: 'Operations' },
    { profitCenter: 'dryer_revenue', category: 'Revenue', subcategory: 'Dryer Revenue', department: 'Operations' },
    { profitCenter: 'vending', category: 'Revenue', subcategory: 'Vending Revenue', department: 'Ancillary' },
  ],
};

// Expense categories common across all asset classes
export const COMMON_EXPENSE_CATEGORIES: PnlCategoryMapping[] = [
  { profitCenter: 'payroll', category: 'Expense', subcategory: 'Payroll', department: 'Administration' },
  { profitCenter: 'utilities', category: 'Expense', subcategory: 'Utilities', department: 'Facilities' },
  { profitCenter: 'insurance', category: 'Expense', subcategory: 'Insurance', department: 'Administration' },
  { profitCenter: 'maintenance', category: 'Expense', subcategory: 'Maintenance & Repairs', department: 'Facilities' },
  { profitCenter: 'management_fees', category: 'Expense', subcategory: 'Management Fees', department: 'Administration' },
  { profitCenter: 'property_taxes', category: 'Expense', subcategory: 'Property Taxes', department: 'Administration' },
  { profitCenter: 'marketing', category: 'Expense', subcategory: 'Marketing & Advertising', department: 'Marketing' },
  { profitCenter: 'general_admin', category: 'Expense', subcategory: 'General & Administrative', department: 'Administration' },
];

/**
 * Returns the P&L category mappings for a given asset class,
 * including common expense categories.
 */
export function getPnlMappingForAssetClass(assetClass: string): PnlCategoryMapping[] {
  const revenueMappings = ASSET_CLASS_PNL_MAPPINGS[assetClass] || [];
  return [...revenueMappings, ...COMMON_EXPENSE_CATEGORIES];
}

/**
 * Find the mapping for a specific profit center within an asset class.
 */
export function findPnlMapping(assetClass: string, profitCenter: string): PnlCategoryMapping | undefined {
  const all = getPnlMappingForAssetClass(assetClass);
  return all.find(m => m.profitCenter === profitCenter);
}
