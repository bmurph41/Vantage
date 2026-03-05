/**
 * Wizard Enhancement Config — Asset-Class-Aware
 * Used by OnboardingWizard for property size, document types, upload labels.
 */

export interface PropertySizeField {
  id: string; label: string; type: 'number' | 'select'; suffix?: string;
}

export interface DocumentTypeOption {
  id: string; label: string; assetClasses: string[];
}

export interface WizardAssetConfig {
  uploadLabel: string;
  uploadDescription: string;
  propertySizeFields: PropertySizeField[];
  documentTypes: string[];
  supportsMultiBuilding?: boolean;
}

export const DOCUMENT_TYPES: DocumentTypeOption[] = [
  { id: 'pnl', label: 'Profit & Loss (P&L)', assetClasses: ['*'] },
  { id: 'payout', label: 'Payout Report', assetClasses: ['str'] },
  { id: 'rent_roll', label: 'Rent Roll', assetClasses: ['multifamily','duplex','triplex','quadplex','sfr','retail','office','industrial','medical','mixed_use'] },
  { id: 'occupancy', label: 'Occupancy Report', assetClasses: ['hotel','str','self_storage','multifamily','marina'] },
  { id: 'revenue_summary', label: 'Revenue Report / Sales Summary', assetClasses: ['*'] },
  { id: 'balance_sheet', label: 'Balance Sheet', assetClasses: ['*'] },
  { id: 'bank_statement', label: 'Bank Statement', assetClasses: ['*'] },
  { id: 'operating_statement', label: 'Operating Statement', assetClasses: ['*'] },
  { id: 'str_performance', label: 'STR Performance Report (AirDNA/Pricelabs)', assetClasses: ['str'] },
  { id: 'smith_travel', label: 'Smith Travel Research (STR Report)', assetClasses: ['hotel'] },
  { id: 'fuel_sales', label: 'Fuel Sales Report', assetClasses: ['marina'] },
  { id: 'lease_abstract', label: 'Lease Abstract / Schedule', assetClasses: ['retail','office','industrial','medical','mixed_use'] },
  { id: 'cam_reconciliation', label: 'CAM Reconciliation', assetClasses: ['retail','office','industrial','medical'] },
  { id: 'debt_schedule', label: 'Debt Service Schedule', assetClasses: ['*'] },
  { id: 'tax_return', label: 'Tax Return (Schedule E / K-1)', assetClasses: ['*'] },
  { id: 'insurance', label: 'Insurance Declaration Page', assetClasses: ['*'] },
  { id: 'property_tax', label: 'Property Tax Bill', assetClasses: ['*'] },
  { id: 'appraisal', label: 'Appraisal', assetClasses: ['*'] },
  { id: 'environmental', label: 'Environmental Report (Phase I/II)', assetClasses: ['*'] },
  { id: 'capex_log', label: 'Capital Expenditure Log', assetClasses: ['*'] },
  { id: 'wash_count', label: 'Wash Count / Machine Report', assetClasses: ['laundromat'] },
  { id: 'unit_mix', label: 'Unit Mix Schedule', assetClasses: ['self_storage','multifamily'] },
  { id: 'franchise', label: 'Franchise Agreement', assetClasses: ['hotel','laundromat','business'] },
  { id: 'business_tax', label: 'Business Tax Return', assetClasses: ['business'] },
  { id: 'other', label: 'Other', assetClasses: ['*'] },
];

export function getDocumentTypesForAsset(assetClass: string): DocumentTypeOption[] {
  return DOCUMENT_TYPES.filter(dt => dt.assetClasses.includes('*') || dt.assetClasses.includes(assetClass));
}

export const UPLOAD_PERIODS = [
  { value: 'annual', label: 'Annual' },
  { value: 't12', label: 'Trailing 12 Months (T12)' },
  { value: 'ytd', label: 'Year to Date (YTD)' },
  { value: 'q1', label: 'Q1 (Jan-Mar)' }, { value: 'q2', label: 'Q2 (Apr-Jun)' },
  { value: 'q3', label: 'Q3 (Jul-Sep)' }, { value: 'q4', label: 'Q4 (Oct-Dec)' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'custom', label: 'Custom Range' },
] as const;

const SF: PropertySizeField[] = [
  { id: 'lotSize', label: 'Lot Size', type: 'number', suffix: 'acres' },
  { id: 'buildingSF', label: 'Building SF', type: 'number', suffix: 'SF' },
];

export const WIZARD_ASSET_CONFIGS: Record<string, WizardAssetConfig> = {
  str: { uploadLabel: 'Upload Payouts', uploadDescription: 'Upload payout reports from Airbnb, VRBO, or your property manager.',
    propertySizeFields: [...SF, {id:'bedrooms',label:'Bedrooms',type:'number'}, {id:'bathrooms',label:'Bathrooms',type:'number'}, {id:'maxGuests',label:'Max Guests',type:'number'}],
    documentTypes: ['payout','pnl','str_performance','occupancy','tax_return','insurance','property_tax'] },
  sfr: { uploadLabel: 'Upload Financials', uploadDescription: 'Upload P&L statements, rent rolls, or bank statements.',
    propertySizeFields: [...SF, {id:'bedrooms',label:'Bedrooms',type:'number'}, {id:'bathrooms',label:'Bathrooms',type:'number'}],
    documentTypes: ['pnl','rent_roll','tax_return','insurance','property_tax'] },
  multifamily: { uploadLabel: 'Upload Financials', uploadDescription: 'Upload operating statements, rent rolls, or T12 financials.',
    propertySizeFields: [...SF, {id:'totalUnits',label:'Total Units',type:'number'}, {id:'yearBuilt',label:'Year Built',type:'number'}],
    supportsMultiBuilding: true,
    documentTypes: ['pnl','operating_statement','rent_roll','occupancy','unit_mix','debt_schedule','tax_return'] },
  retail: { uploadLabel: 'Upload Financials', uploadDescription: 'Upload operating statements, lease abstracts, or CAM reconciliations.',
    propertySizeFields: [...SF, {id:'gla',label:'Gross Leasable Area (GLA)',type:'number',suffix:'SF'}],
    documentTypes: ['pnl','operating_statement','rent_roll','lease_abstract','cam_reconciliation','debt_schedule'] },
  office: { uploadLabel: 'Upload Financials', uploadDescription: 'Upload operating statements, lease abstracts, or rent rolls.',
    propertySizeFields: [...SF, {id:'gla',label:'GLA',type:'number',suffix:'SF'}],
    supportsMultiBuilding: true,
    documentTypes: ['pnl','operating_statement','rent_roll','lease_abstract','cam_reconciliation','debt_schedule'] },
  industrial: { uploadLabel: 'Upload Financials', uploadDescription: 'Upload operating statements, lease abstracts, or rent rolls.',
    propertySizeFields: [...SF, {id:'gla',label:'GLA',type:'number',suffix:'SF'}, {id:'clearHeight',label:'Clear Height',type:'number',suffix:'ft'}, {id:'dockDoors',label:'Dock Doors',type:'number'}],
    supportsMultiBuilding: true,
    documentTypes: ['pnl','operating_statement','rent_roll','lease_abstract','cam_reconciliation','debt_schedule'] },
  hotel: { uploadLabel: 'Upload Financials', uploadDescription: 'Upload operating statements, STR reports, or P&L statements.',
    propertySizeFields: [...SF, {id:'totalRooms',label:'Total Rooms',type:'number'}, {id:'yearBuilt',label:'Year Built',type:'number'}],
    supportsMultiBuilding: true,
    documentTypes: ['pnl','operating_statement','smith_travel','occupancy','franchise','debt_schedule'] },
  marina: { uploadLabel: 'Upload Financials', uploadDescription: 'Upload P&L statements, fuel sales reports, or operating statements.',
    propertySizeFields: [{id:'uplandAcreage',label:'Upland Acreage',type:'number',suffix:'acres'}, {id:'submergedAcreage',label:'Submerged Acreage',type:'number',suffix:'acres'}, {id:'totalSlips',label:'Total Slips',type:'number'}],
    documentTypes: ['pnl','operating_statement','fuel_sales','occupancy','environmental','debt_schedule'] },
  self_storage: { uploadLabel: 'Upload Financials', uploadDescription: 'Upload operating statements, unit mix schedules, or P&L statements.',
    propertySizeFields: [...SF, {id:'totalUnits',label:'Total Units',type:'number'}],
    supportsMultiBuilding: true,
    documentTypes: ['pnl','operating_statement','occupancy','unit_mix','debt_schedule'] },
  laundromat: { uploadLabel: 'Upload Financials', uploadDescription: 'Upload P&L statements, wash count reports, or bank statements.',
    propertySizeFields: [{id:'buildingSF',label:'Building SF',type:'number',suffix:'SF'}],
    documentTypes: ['pnl','wash_count','bank_statement','franchise','tax_return'] },
  business: { uploadLabel: 'Upload Financials', uploadDescription: 'Upload P&L statements, business tax returns, or revenue summaries.',
    propertySizeFields: [{id:'buildingSF',label:'Building SF (optional)',type:'number',suffix:'SF'}],
    documentTypes: ['pnl','business_tax','revenue_summary','franchise','bank_statement'] },
  mixed_use: { uploadLabel: 'Upload Financials', uploadDescription: 'Upload operating statements, rent rolls, or lease abstracts.',
    propertySizeFields: [...SF, {id:'totalUnits',label:'Total Residential Units',type:'number'}, {id:'gla',label:'Commercial GLA',type:'number',suffix:'SF'}],
    supportsMultiBuilding: true,
    documentTypes: ['pnl','operating_statement','rent_roll','lease_abstract','cam_reconciliation'] },
};

export function getWizardConfig(assetClass: string): WizardAssetConfig {
  return WIZARD_ASSET_CONFIGS[assetClass] ?? WIZARD_ASSET_CONFIGS.business;
}
