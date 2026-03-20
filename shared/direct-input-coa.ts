// =============================================================================
// SHARED CHART OF ACCOUNTS — INPUT FIELD DEFINITIONS
// File: shared/direct-input-coa.ts
//
// Defines every revenue and expense line item per asset class for the Direct
// Input P&L builder. Used by:
//   - Client: renders editable input form fields
//   - Server: direct-input-engine.ts reads values by key from inputAssumptions
//
// Every standard line is always shown (even at $0) so users can fill any field.
// Users can also add custom lines via "Add Revenue" / "Add Expense".
// =============================================================================

export interface COAFieldDef {
  key: string;                    // stable storage key in inputAssumptions
  label: string;                  // display label
  category: 'revenue' | 'expense';
  inputType: 'currency' | 'percent' | 'number' | 'formula'; // how to render the input
  hint?: string;                  // placeholder / helper text
  group?: string;                 // optional grouping header
  dependsOn?: string[];           // keys this field is computed from (formula fields)
  defaultValue?: number;          // pre-populated default
  pctOf?: 'revenue' | 'egi';     // if inputType is percent, what base
  showWhen?: 'always' | 'nonzero'; // 'always' = always show, 'nonzero' = show if > 0
}

export interface COACustomLine {
  id: string;
  label: string;
  amount: number;
  category: 'revenue' | 'expense';
}

// ---------------------------------------------------------------------------
// STR (Short-Term Rental)
// ---------------------------------------------------------------------------
const STR_FIELDS: COAFieldDef[] = [
  // Revenue drivers
  { key: 'nightlyRate', label: 'Nightly Rate', category: 'revenue', inputType: 'currency', hint: 'Average nightly rate', group: 'Revenue Assumptions' },
  { key: 'occupancy', label: 'Occupancy Rate', category: 'revenue', inputType: 'percent', hint: 'Annual occupancy %', group: 'Revenue Assumptions', defaultValue: 65 },
  { key: 'numberOfUnits', label: 'Number of Units', category: 'revenue', inputType: 'number', hint: 'Total rental units', group: 'Revenue Assumptions', defaultValue: 1 },
  { key: 'annualCleaningFeeIncome', label: 'Cleaning Fee Income', category: 'revenue', inputType: 'currency', hint: 'Annual cleaning fee revenue passed to guests', group: 'Other Revenue', showWhen: 'nonzero' },
  { key: 'annualOtherIncome', label: 'Other Income', category: 'revenue', inputType: 'currency', hint: 'Pool heating, early check-in, etc.', group: 'Other Revenue', showWhen: 'nonzero' },
  // Expenses
  { key: 'platformFeePct', label: 'Platform Fee %', category: 'expense', inputType: 'percent', hint: 'Airbnb/VRBO host fee', group: 'Operating Expenses', defaultValue: 3, pctOf: 'revenue' },
  { key: 'annualCleaning', label: 'Cleaning / Turnover', category: 'expense', inputType: 'currency', hint: 'Annual cleaning costs', group: 'Operating Expenses' },
  { key: 'propertyManagementPct', label: 'Property Management %', category: 'expense', inputType: 'percent', hint: 'Management fee as % of revenue', group: 'Operating Expenses', defaultValue: 0, pctOf: 'revenue' },
  { key: 'annualPropertyTax', label: 'Property Tax', category: 'expense', inputType: 'currency', hint: 'Annual property tax', group: 'Fixed Expenses' },
  { key: 'annualInsurance', label: 'Insurance', category: 'expense', inputType: 'currency', hint: 'Annual insurance premium', group: 'Fixed Expenses' },
  { key: 'annualHOA', label: 'HOA / Condo Fees', category: 'expense', inputType: 'currency', hint: 'Annual HOA or condo association', group: 'Fixed Expenses', showWhen: 'nonzero' },
  { key: 'monthlyUtilities', label: 'Utilities (monthly)', category: 'expense', inputType: 'currency', hint: 'Electric, water, gas per month', group: 'Operating Expenses' },
  { key: 'annualMaintenance', label: 'Maintenance & Repairs', category: 'expense', inputType: 'currency', hint: 'Annual maintenance budget', group: 'Operating Expenses' },
  { key: 'annualSupplies', label: 'Supplies & Furnishing', category: 'expense', inputType: 'currency', hint: 'Toiletries, linens, replacements', group: 'Operating Expenses', showWhen: 'nonzero' },
  { key: 'annualLandscaping', label: 'Landscaping / Lawn Care', category: 'expense', inputType: 'currency', hint: 'Annual landscaping', group: 'Operating Expenses', showWhen: 'nonzero' },
  { key: 'annualInternet', label: 'Internet / Cable / Streaming', category: 'expense', inputType: 'currency', hint: 'Annual internet & entertainment', group: 'Operating Expenses', showWhen: 'nonzero' },
  { key: 'annualPestControl', label: 'Pest Control', category: 'expense', inputType: 'currency', hint: 'Annual pest control', group: 'Operating Expenses', showWhen: 'nonzero' },
  { key: 'annualAccounting', label: 'Accounting / Bookkeeping', category: 'expense', inputType: 'currency', hint: 'Annual accounting fees', group: 'Operating Expenses', showWhen: 'nonzero' },
  { key: 'annualCapEx', label: 'Capital Reserves', category: 'expense', inputType: 'currency', hint: 'Annual CapEx / replacement reserve', group: 'Reserves' },
];

// ---------------------------------------------------------------------------
// SFR (Single-Family Rental)
// ---------------------------------------------------------------------------
const SFR_FIELDS: COAFieldDef[] = [
  { key: 'monthlyRent', label: 'Monthly Rent', category: 'revenue', inputType: 'currency', hint: 'Gross monthly rent', group: 'Revenue Assumptions' },
  { key: 'vacancyRate', label: 'Vacancy Rate', category: 'revenue', inputType: 'percent', hint: 'Annual vacancy %', group: 'Revenue Assumptions', defaultValue: 5 },
  { key: 'annualOtherIncome', label: 'Other Income', category: 'revenue', inputType: 'currency', hint: 'Pet fees, storage, parking', group: 'Other Revenue', showWhen: 'nonzero' },
  { key: 'propertyManagementPct', label: 'Property Management %', category: 'expense', inputType: 'percent', hint: '% of EGI', group: 'Operating Expenses', defaultValue: 0, pctOf: 'egi' },
  { key: 'annualPropertyTax', label: 'Property Tax', category: 'expense', inputType: 'currency', hint: 'Annual property tax', group: 'Fixed Expenses' },
  { key: 'annualInsurance', label: 'Insurance', category: 'expense', inputType: 'currency', hint: 'Annual insurance premium', group: 'Fixed Expenses' },
  { key: 'annualHOA', label: 'HOA', category: 'expense', inputType: 'currency', hint: 'Annual HOA dues', group: 'Fixed Expenses', showWhen: 'nonzero' },
  { key: 'monthlyUtilities', label: 'Utilities (monthly)', category: 'expense', inputType: 'currency', hint: 'If landlord-paid', group: 'Operating Expenses', showWhen: 'nonzero' },
  { key: 'annualMaintenance', label: 'Maintenance & Repairs', category: 'expense', inputType: 'currency', hint: 'Annual maintenance', group: 'Operating Expenses' },
  { key: 'annualLandscaping', label: 'Landscaping', category: 'expense', inputType: 'currency', hint: 'Annual landscaping', group: 'Operating Expenses', showWhen: 'nonzero' },
  { key: 'annualPestControl', label: 'Pest Control', category: 'expense', inputType: 'currency', hint: 'Annual pest control', group: 'Operating Expenses', showWhen: 'nonzero' },
  { key: 'annualCapEx', label: 'Capital Reserves', category: 'expense', inputType: 'currency', hint: 'Annual CapEx reserve', group: 'Reserves' },
];

// ---------------------------------------------------------------------------
// Duplex / Triplex / Quad
// ---------------------------------------------------------------------------
const RESIDENTIAL_MULTI_FIELDS: COAFieldDef[] = [
  { key: 'monthlyRent', label: 'Total Monthly Rent (all units)', category: 'revenue', inputType: 'currency', hint: 'Combined gross monthly rent', group: 'Revenue Assumptions' },
  { key: 'numberOfUnits', label: 'Number of Units', category: 'revenue', inputType: 'number', hint: 'Total units', group: 'Revenue Assumptions', defaultValue: 2 },
  { key: 'vacancyRate', label: 'Vacancy Rate', category: 'revenue', inputType: 'percent', hint: 'Annual vacancy %', group: 'Revenue Assumptions', defaultValue: 5 },
  { key: 'annualLaundryIncome', label: 'Laundry Income', category: 'revenue', inputType: 'currency', hint: 'Coin-op laundry', group: 'Other Revenue', showWhen: 'nonzero' },
  { key: 'annualParkingIncome', label: 'Parking Income', category: 'revenue', inputType: 'currency', hint: 'Paid parking', group: 'Other Revenue', showWhen: 'nonzero' },
  { key: 'annualOtherIncome', label: 'Other Income', category: 'revenue', inputType: 'currency', hint: 'Pet fees, storage, etc.', group: 'Other Revenue', showWhen: 'nonzero' },
  { key: 'propertyManagementPct', label: 'Property Management %', category: 'expense', inputType: 'percent', hint: '% of EGI', group: 'Operating Expenses', defaultValue: 8, pctOf: 'egi' },
  { key: 'annualPropertyTax', label: 'Property Tax', category: 'expense', inputType: 'currency', hint: 'Annual property tax', group: 'Fixed Expenses' },
  { key: 'annualInsurance', label: 'Insurance', category: 'expense', inputType: 'currency', hint: 'Annual insurance', group: 'Fixed Expenses' },
  { key: 'monthlyUtilities', label: 'Utilities (monthly)', category: 'expense', inputType: 'currency', hint: 'If landlord-paid', group: 'Operating Expenses' },
  { key: 'annualMaintenance', label: 'Maintenance & Repairs', category: 'expense', inputType: 'currency', hint: 'Annual maintenance', group: 'Operating Expenses' },
  { key: 'annualLandscaping', label: 'Landscaping', category: 'expense', inputType: 'currency', hint: 'Annual landscaping', group: 'Operating Expenses', showWhen: 'nonzero' },
  { key: 'annualTrash', label: 'Trash / Waste Removal', category: 'expense', inputType: 'currency', hint: 'Annual trash service', group: 'Operating Expenses', showWhen: 'nonzero' },
  { key: 'annualCapEx', label: 'Capital Reserves', category: 'expense', inputType: 'currency', hint: 'Annual CapEx reserve', group: 'Reserves' },
];

// ---------------------------------------------------------------------------
// Multifamily
// ---------------------------------------------------------------------------
const MULTIFAMILY_FIELDS: COAFieldDef[] = [
  { key: 'totalUnits', label: 'Total Units', category: 'revenue', inputType: 'number', hint: 'Total apartment units', group: 'Revenue Assumptions' },
  { key: 'averageRent', label: 'Average Monthly Rent', category: 'revenue', inputType: 'currency', hint: 'Avg rent per unit', group: 'Revenue Assumptions' },
  { key: 'vacancyRate', label: 'Vacancy Rate', category: 'revenue', inputType: 'percent', hint: 'Physical vacancy %', group: 'Revenue Assumptions', defaultValue: 5 },
  { key: 'concessionsPct', label: 'Concessions %', category: 'revenue', inputType: 'percent', hint: 'Lease-up concessions', group: 'Revenue Assumptions', defaultValue: 0 },
  { key: 'badDebtPct', label: 'Bad Debt %', category: 'revenue', inputType: 'percent', hint: 'Uncollectable rent', group: 'Revenue Assumptions', defaultValue: 1 },
  { key: 'annualUtilityReimbursements', label: 'Utility Reimbursements', category: 'revenue', inputType: 'currency', hint: 'RUBS or sub-metered', group: 'Other Revenue', showWhen: 'nonzero' },
  { key: 'annualParkingIncome', label: 'Parking Income', category: 'revenue', inputType: 'currency', group: 'Other Revenue', showWhen: 'nonzero' },
  { key: 'annualLaundryIncome', label: 'Laundry Income', category: 'revenue', inputType: 'currency', group: 'Other Revenue', showWhen: 'nonzero' },
  { key: 'annualPetFees', label: 'Pet Fees', category: 'revenue', inputType: 'currency', group: 'Other Revenue', showWhen: 'nonzero' },
  { key: 'annualOtherIncome', label: 'Other Income', category: 'revenue', inputType: 'currency', group: 'Other Revenue', showWhen: 'nonzero' },
  { key: 'propertyManagementPct', label: 'Property Management %', category: 'expense', inputType: 'percent', defaultValue: 5, pctOf: 'egi', group: 'Management' },
  { key: 'annualPayroll', label: 'Payroll & Benefits', category: 'expense', inputType: 'currency', group: 'Operating Expenses' },
  { key: 'annualPropertyTax', label: 'Property Tax', category: 'expense', inputType: 'currency', group: 'Fixed Expenses' },
  { key: 'annualInsurance', label: 'Insurance', category: 'expense', inputType: 'currency', group: 'Fixed Expenses' },
  { key: 'monthlyUtilities', label: 'Utilities (monthly)', category: 'expense', inputType: 'currency', group: 'Operating Expenses' },
  { key: 'annualMaintenance', label: 'Maintenance & Repairs', category: 'expense', inputType: 'currency', group: 'Operating Expenses' },
  { key: 'annualAdmin', label: 'Admin & General', category: 'expense', inputType: 'currency', group: 'Operating Expenses', showWhen: 'nonzero' },
  { key: 'annualMarketing', label: 'Marketing & Advertising', category: 'expense', inputType: 'currency', group: 'Operating Expenses', showWhen: 'nonzero' },
  { key: 'annualContractServices', label: 'Contract Services', category: 'expense', inputType: 'currency', group: 'Operating Expenses', showWhen: 'nonzero' },
  { key: 'annualTrash', label: 'Trash / Waste Removal', category: 'expense', inputType: 'currency', group: 'Operating Expenses', showWhen: 'nonzero' },
  { key: 'annualPestControl', label: 'Pest Control', category: 'expense', inputType: 'currency', group: 'Operating Expenses', showWhen: 'nonzero' },
  { key: 'annualCapEx', label: 'Capital Reserves', category: 'expense', inputType: 'currency', group: 'Reserves' },
];

// ---------------------------------------------------------------------------
// Hotel
// ---------------------------------------------------------------------------
const HOTEL_FIELDS: COAFieldDef[] = [
  { key: 'numberOfRooms', label: 'Total Rooms', category: 'revenue', inputType: 'number', hint: 'Total guest rooms', group: 'Revenue Assumptions' },
  { key: 'averageDailyRate', label: 'ADR (Average Daily Rate)', category: 'revenue', inputType: 'currency', hint: 'Avg nightly room rate', group: 'Revenue Assumptions' },
  { key: 'occupancyRate', label: 'Occupancy Rate', category: 'revenue', inputType: 'percent', hint: 'Annual occupancy %', group: 'Revenue Assumptions', defaultValue: 65 },
  { key: 'annualFBRevenue', label: 'F&B Revenue', category: 'revenue', inputType: 'currency', hint: 'Food & beverage', group: 'Other Revenue', showWhen: 'nonzero' },
  { key: 'annualMeetingRevenue', label: 'Meeting / Event Revenue', category: 'revenue', inputType: 'currency', group: 'Other Revenue', showWhen: 'nonzero' },
  { key: 'annualSpaRevenue', label: 'Spa Revenue', category: 'revenue', inputType: 'currency', group: 'Other Revenue', showWhen: 'nonzero' },
  { key: 'annualParkingRevenue', label: 'Parking Revenue', category: 'revenue', inputType: 'currency', group: 'Other Revenue', showWhen: 'nonzero' },
  { key: 'annualOtherRevenue', label: 'Other Revenue', category: 'revenue', inputType: 'currency', group: 'Other Revenue', showWhen: 'nonzero' },
  { key: 'departmentalExpensePct', label: 'Departmental Expenses %', category: 'expense', inputType: 'percent', defaultValue: 35, pctOf: 'revenue', group: 'Operating Expenses' },
  { key: 'undistributedExpensePct', label: 'Undistributed Expenses %', category: 'expense', inputType: 'percent', defaultValue: 20, pctOf: 'revenue', group: 'Operating Expenses' },
  { key: 'managementFeePct', label: 'Management Fee %', category: 'expense', inputType: 'percent', defaultValue: 3, pctOf: 'revenue', group: 'Management' },
  { key: 'annualPropertyTax', label: 'Property Tax', category: 'expense', inputType: 'currency', group: 'Fixed Expenses' },
  { key: 'annualInsurance', label: 'Insurance', category: 'expense', inputType: 'currency', group: 'Fixed Expenses' },
  { key: 'ffAndEReservePct', label: 'FF&E Reserve %', category: 'expense', inputType: 'percent', defaultValue: 4, pctOf: 'revenue', group: 'Reserves' },
];

// ---------------------------------------------------------------------------
// Marina
// ---------------------------------------------------------------------------
const MARINA_FIELDS: COAFieldDef[] = [
  { key: 'wetSlips', label: 'Wet Slips', category: 'revenue', inputType: 'number', hint: 'Total wet slips', group: 'Revenue Assumptions' },
  { key: 'avgMonthlySlipRate', label: 'Avg Monthly Slip Rate', category: 'revenue', inputType: 'currency', hint: '$/slip/month', group: 'Revenue Assumptions' },
  { key: 'slipOccupancy', label: 'Slip Occupancy', category: 'revenue', inputType: 'percent', hint: 'Annual slip occupancy', group: 'Revenue Assumptions', defaultValue: 85 },
  { key: 'dryStorageSpaces', label: 'Dry Storage Spaces', category: 'revenue', inputType: 'number', group: 'Revenue Assumptions', showWhen: 'nonzero' },
  { key: 'avgMonthlyDryRate', label: 'Avg Monthly Dry Rate', category: 'revenue', inputType: 'currency', group: 'Revenue Assumptions', showWhen: 'nonzero' },
  { key: 'annualFuelRevenue', label: 'Fuel Revenue', category: 'revenue', inputType: 'currency', group: 'Other Revenue', showWhen: 'nonzero' },
  { key: 'annualShipStoreRevenue', label: 'Ship Store Revenue', category: 'revenue', inputType: 'currency', group: 'Other Revenue', showWhen: 'nonzero' },
  { key: 'annualServiceRevenue', label: 'Service / Repair Revenue', category: 'revenue', inputType: 'currency', group: 'Other Revenue', showWhen: 'nonzero' },
  { key: 'annualOtherRevenue', label: 'Other Revenue', category: 'revenue', inputType: 'currency', group: 'Other Revenue', showWhen: 'nonzero' },
  { key: 'annualPayroll', label: 'Payroll & Benefits', category: 'expense', inputType: 'currency', group: 'Operating Expenses' },
  { key: 'annualFuelCOGS', label: 'Fuel COGS', category: 'expense', inputType: 'currency', group: 'COGS', showWhen: 'nonzero' },
  { key: 'annualStoreCOGS', label: 'Ship Store COGS', category: 'expense', inputType: 'currency', group: 'COGS', showWhen: 'nonzero' },
  { key: 'monthlyUtilities', label: 'Utilities (monthly)', category: 'expense', inputType: 'currency', group: 'Operating Expenses' },
  { key: 'annualInsurance', label: 'Insurance', category: 'expense', inputType: 'currency', group: 'Fixed Expenses' },
  { key: 'annualPropertyTax', label: 'Property Tax', category: 'expense', inputType: 'currency', group: 'Fixed Expenses' },
  { key: 'annualMaintenance', label: 'Maintenance & Repairs', category: 'expense', inputType: 'currency', group: 'Operating Expenses' },
  { key: 'annualDredging', label: 'Dredging', category: 'expense', inputType: 'currency', group: 'Operating Expenses', showWhen: 'nonzero' },
  { key: 'managementFeePct', label: 'Management Fee %', category: 'expense', inputType: 'percent', defaultValue: 0, pctOf: 'revenue', group: 'Management', showWhen: 'nonzero' },
  { key: 'annualMarketing', label: 'Marketing', category: 'expense', inputType: 'currency', group: 'Operating Expenses', showWhen: 'nonzero' },
  { key: 'annualAdmin', label: 'Admin & General', category: 'expense', inputType: 'currency', group: 'Operating Expenses', showWhen: 'nonzero' },
  { key: 'annualOtherExpenses', label: 'Other Expenses', category: 'expense', inputType: 'currency', group: 'Operating Expenses', showWhen: 'nonzero' },
];

// ---------------------------------------------------------------------------
// Self Storage
// ---------------------------------------------------------------------------
const SELF_STORAGE_FIELDS: COAFieldDef[] = [
  { key: 'totalUnits', label: 'Total Units', category: 'revenue', inputType: 'number', group: 'Revenue Assumptions' },
  { key: 'averageMonthlyRate', label: 'Avg Monthly Rate', category: 'revenue', inputType: 'currency', hint: '$/unit/month', group: 'Revenue Assumptions' },
  { key: 'occupancyRate', label: 'Occupancy Rate', category: 'revenue', inputType: 'percent', defaultValue: 88, group: 'Revenue Assumptions' },
  { key: 'annualRetailIncome', label: 'Retail / Supplies Income', category: 'revenue', inputType: 'currency', group: 'Other Revenue', showWhen: 'nonzero' },
  { key: 'annualLateFees', label: 'Late Fees / Admin Fees', category: 'revenue', inputType: 'currency', group: 'Other Revenue', showWhen: 'nonzero' },
  { key: 'annualTruckRental', label: 'Truck Rental Income', category: 'revenue', inputType: 'currency', group: 'Other Revenue', showWhen: 'nonzero' },
  { key: 'annualOtherIncome', label: 'Other Income', category: 'revenue', inputType: 'currency', group: 'Other Revenue', showWhen: 'nonzero' },
  { key: 'propertyManagementPct', label: 'Management Fee %', category: 'expense', inputType: 'percent', defaultValue: 6, pctOf: 'egi', group: 'Management' },
  { key: 'annualPayroll', label: 'Payroll', category: 'expense', inputType: 'currency', group: 'Operating Expenses' },
  { key: 'annualInsurance', label: 'Insurance', category: 'expense', inputType: 'currency', group: 'Fixed Expenses' },
  { key: 'annualPropertyTax', label: 'Property Tax', category: 'expense', inputType: 'currency', group: 'Fixed Expenses' },
  { key: 'monthlyUtilities', label: 'Utilities (monthly)', category: 'expense', inputType: 'currency', group: 'Operating Expenses' },
  { key: 'annualMaintenance', label: 'Maintenance', category: 'expense', inputType: 'currency', group: 'Operating Expenses' },
  { key: 'annualMarketing', label: 'Marketing', category: 'expense', inputType: 'currency', group: 'Operating Expenses', showWhen: 'nonzero' },
  { key: 'annualOtherExpenses', label: 'Other Expenses', category: 'expense', inputType: 'currency', group: 'Operating Expenses', showWhen: 'nonzero' },
];

// ---------------------------------------------------------------------------
// Laundromat
// ---------------------------------------------------------------------------
const LAUNDROMAT_FIELDS: COAFieldDef[] = [
  { key: 'numberOfWashers', label: 'Number of Washers', category: 'revenue', inputType: 'number', group: 'Revenue Assumptions' },
  { key: 'numberOfDryers', label: 'Number of Dryers', category: 'revenue', inputType: 'number', group: 'Revenue Assumptions' },
  { key: 'washerVendPrice', label: 'Washer Vend Price', category: 'revenue', inputType: 'currency', hint: '$ per wash', group: 'Revenue Assumptions', defaultValue: 3.5 },
  { key: 'dryerVendPrice', label: 'Dryer Vend Price', category: 'revenue', inputType: 'currency', hint: '$ per dry', group: 'Revenue Assumptions', defaultValue: 2.0 },
  { key: 'washerTurnsPerDay', label: 'Washer Turns/Day', category: 'revenue', inputType: 'number', defaultValue: 5, group: 'Revenue Assumptions' },
  { key: 'dryerTurnsPerDay', label: 'Dryer Turns/Day', category: 'revenue', inputType: 'number', defaultValue: 5, group: 'Revenue Assumptions' },
  { key: 'daysOpenPerYear', label: 'Days Open / Year', category: 'revenue', inputType: 'number', defaultValue: 365, group: 'Revenue Assumptions' },
  { key: 'annualVendingIncome', label: 'Vending Income', category: 'revenue', inputType: 'currency', group: 'Other Revenue', showWhen: 'nonzero' },
  { key: 'annualWashDryFold', label: 'Wash/Dry/Fold Service', category: 'revenue', inputType: 'currency', group: 'Other Revenue', showWhen: 'nonzero' },
  { key: 'annualOtherIncome', label: 'Other Income', category: 'revenue', inputType: 'currency', group: 'Other Revenue', showWhen: 'nonzero' },
  { key: 'monthlyRent', label: 'Rent (monthly)', category: 'expense', inputType: 'currency', group: 'Fixed Expenses' },
  { key: 'monthlyUtilities', label: 'Utilities (monthly)', category: 'expense', inputType: 'currency', hint: 'Water, gas, electric', group: 'Operating Expenses' },
  { key: 'annualInsurance', label: 'Insurance', category: 'expense', inputType: 'currency', group: 'Fixed Expenses' },
  { key: 'annualMaintenance', label: 'Machine Maintenance & Repairs', category: 'expense', inputType: 'currency', group: 'Operating Expenses' },
  { key: 'annualPayroll', label: 'Payroll / Attendant', category: 'expense', inputType: 'currency', group: 'Operating Expenses', showWhen: 'nonzero' },
  { key: 'annualSupplies', label: 'Supplies (Soap/Softener)', category: 'expense', inputType: 'currency', group: 'Operating Expenses', showWhen: 'nonzero' },
  { key: 'annualPropertyTax', label: 'Property Tax', category: 'expense', inputType: 'currency', group: 'Fixed Expenses' },
  { key: 'annualTrash', label: 'Trash Removal', category: 'expense', inputType: 'currency', group: 'Operating Expenses', showWhen: 'nonzero' },
  { key: 'annualPestControl', label: 'Pest Control', category: 'expense', inputType: 'currency', group: 'Operating Expenses', showWhen: 'nonzero' },
  { key: 'annualOtherExpenses', label: 'Other Expenses', category: 'expense', inputType: 'currency', group: 'Operating Expenses', showWhen: 'nonzero' },
];

// ---------------------------------------------------------------------------
// Commercial (Retail / Office / Industrial / Medical Office)
// ---------------------------------------------------------------------------
const COMMERCIAL_FIELDS: COAFieldDef[] = [
  { key: 'totalSquareFeet', label: 'Total Square Feet', category: 'revenue', inputType: 'number', group: 'Revenue Assumptions' },
  { key: 'rentPerSF', label: 'Rent per SF / Year', category: 'revenue', inputType: 'currency', hint: '$/SF/yr', group: 'Revenue Assumptions' },
  { key: 'occupancyRate', label: 'Occupancy Rate', category: 'revenue', inputType: 'percent', defaultValue: 93, group: 'Revenue Assumptions' },
  { key: 'annualCAMReimbursements', label: 'CAM Reimbursements', category: 'revenue', inputType: 'currency', group: 'Other Revenue', showWhen: 'nonzero' },
  { key: 'annualPercentageRent', label: 'Percentage Rent', category: 'revenue', inputType: 'currency', group: 'Other Revenue', showWhen: 'nonzero' },
  { key: 'annualOtherIncome', label: 'Other Income', category: 'revenue', inputType: 'currency', group: 'Other Revenue', showWhen: 'nonzero' },
  { key: 'propertyManagementPct', label: 'Management Fee %', category: 'expense', inputType: 'percent', defaultValue: 4, pctOf: 'egi', group: 'Management' },
  { key: 'annualPropertyTax', label: 'Property Tax', category: 'expense', inputType: 'currency', group: 'Fixed Expenses' },
  { key: 'annualInsurance', label: 'Insurance', category: 'expense', inputType: 'currency', group: 'Fixed Expenses' },
  { key: 'annualCAM', label: 'CAM / Common Area Maintenance', category: 'expense', inputType: 'currency', group: 'Operating Expenses' },
  { key: 'annualMaintenance', label: 'Maintenance & Repairs', category: 'expense', inputType: 'currency', group: 'Operating Expenses' },
  { key: 'monthlyUtilities', label: 'Utilities (monthly)', category: 'expense', inputType: 'currency', group: 'Operating Expenses', showWhen: 'nonzero' },
  { key: 'annualJanitorial', label: 'Janitorial', category: 'expense', inputType: 'currency', group: 'Operating Expenses', showWhen: 'nonzero' },
  { key: 'annualSecurity', label: 'Security', category: 'expense', inputType: 'currency', group: 'Operating Expenses', showWhen: 'nonzero' },
  { key: 'annualOtherExpenses', label: 'Other Expenses', category: 'expense', inputType: 'currency', group: 'Operating Expenses', showWhen: 'nonzero' },
];

// ---------------------------------------------------------------------------
// Business (SDE-based)
// ---------------------------------------------------------------------------
const BUSINESS_FIELDS: COAFieldDef[] = [
  { key: 'annualRevenue', label: 'Gross Annual Revenue', category: 'revenue', inputType: 'currency', group: 'Revenue' },
  { key: 'costOfGoodsSold', label: 'Cost of Goods Sold', category: 'revenue', inputType: 'currency', hint: 'Direct costs / COGS', group: 'Revenue' },
  { key: 'annualOtherIncome', label: 'Other Income', category: 'revenue', inputType: 'currency', group: 'Other Revenue', showWhen: 'nonzero' },
  { key: 'annualPayroll', label: 'Payroll', category: 'expense', inputType: 'currency', group: 'Operating Expenses' },
  { key: 'ownerSalary', label: "Owner's Salary (SDE add-back)", category: 'expense', inputType: 'currency', hint: 'Added back for SDE calc', group: 'Operating Expenses' },
  { key: 'monthlyRent', label: 'Rent (monthly)', category: 'expense', inputType: 'currency', group: 'Fixed Expenses' },
  { key: 'monthlyUtilities', label: 'Utilities (monthly)', category: 'expense', inputType: 'currency', group: 'Operating Expenses' },
  { key: 'annualInsurance', label: 'Insurance', category: 'expense', inputType: 'currency', group: 'Fixed Expenses' },
  { key: 'annualMarketing', label: 'Marketing & Advertising', category: 'expense', inputType: 'currency', group: 'Operating Expenses', showWhen: 'nonzero' },
  { key: 'annualAccounting', label: 'Accounting / Legal', category: 'expense', inputType: 'currency', group: 'Operating Expenses', showWhen: 'nonzero' },
  { key: 'annualSoftware', label: 'Software / Subscriptions', category: 'expense', inputType: 'currency', group: 'Operating Expenses', showWhen: 'nonzero' },
  { key: 'annualVehicle', label: 'Vehicle / Travel', category: 'expense', inputType: 'currency', group: 'Operating Expenses', showWhen: 'nonzero' },
  { key: 'annualOtherExpenses', label: 'Other Expenses', category: 'expense', inputType: 'currency', group: 'Operating Expenses', showWhen: 'nonzero' },
];

// ---------------------------------------------------------------------------
// Office
// ---------------------------------------------------------------------------
const OFFICE_FIELDS: COAFieldDef[] = [
  { key: 'totalSquareFeet', label: 'Total Rentable SF', category: 'revenue', inputType: 'number', group: 'Revenue Assumptions' },
  { key: 'rentPerSF', label: 'Rent per SF / Year', category: 'revenue', inputType: 'currency', hint: '$/SF/yr', group: 'Revenue Assumptions' },
  { key: 'occupancyRate', label: 'Occupancy Rate', category: 'revenue', inputType: 'percent', defaultValue: 90, group: 'Revenue Assumptions' },
  { key: 'annualExpenseReimbursements', label: 'Expense Reimbursements', category: 'revenue', inputType: 'currency', group: 'Other Revenue', showWhen: 'nonzero' },
  { key: 'annualParkingIncome', label: 'Parking Income', category: 'revenue', inputType: 'currency', group: 'Other Revenue', showWhen: 'nonzero' },
  { key: 'annualOtherIncome', label: 'Other Income', category: 'revenue', inputType: 'currency', group: 'Other Revenue', showWhen: 'nonzero' },
  { key: 'propertyManagementPct', label: 'Management Fee %', category: 'expense', inputType: 'percent', defaultValue: 4, pctOf: 'egi', group: 'Management' },
  { key: 'annualPayroll', label: 'Payroll / On-Site Staff', category: 'expense', inputType: 'currency', group: 'Operating Expenses' },
  { key: 'annualPropertyTax', label: 'Property Tax', category: 'expense', inputType: 'currency', group: 'Fixed Expenses' },
  { key: 'annualInsurance', label: 'Insurance', category: 'expense', inputType: 'currency', group: 'Fixed Expenses' },
  { key: 'monthlyUtilities', label: 'Utilities (monthly)', category: 'expense', inputType: 'currency', group: 'Operating Expenses' },
  { key: 'annualJanitorial', label: 'Janitorial', category: 'expense', inputType: 'currency', group: 'Operating Expenses' },
  { key: 'annualMaintenance', label: 'Maintenance & Repairs', category: 'expense', inputType: 'currency', group: 'Operating Expenses' },
  { key: 'annualSecurity', label: 'Security', category: 'expense', inputType: 'currency', group: 'Operating Expenses', showWhen: 'nonzero' },
  { key: 'annualElevator', label: 'Elevator Maintenance', category: 'expense', inputType: 'currency', group: 'Operating Expenses', showWhen: 'nonzero' },
  { key: 'annualLandscaping', label: 'Landscaping', category: 'expense', inputType: 'currency', group: 'Operating Expenses', showWhen: 'nonzero' },
  { key: 'annualCapEx', label: 'Capital Reserves', category: 'expense', inputType: 'currency', group: 'Reserves' },
];

// ---------------------------------------------------------------------------
// Industrial
// ---------------------------------------------------------------------------
const INDUSTRIAL_FIELDS: COAFieldDef[] = [
  { key: 'totalSquareFeet', label: 'Total Rentable SF', category: 'revenue', inputType: 'number', group: 'Revenue Assumptions' },
  { key: 'rentPerSF', label: 'Rent per SF / Year', category: 'revenue', inputType: 'currency', hint: '$/SF/yr (NNN)', group: 'Revenue Assumptions' },
  { key: 'occupancyRate', label: 'Occupancy Rate', category: 'revenue', inputType: 'percent', defaultValue: 95, group: 'Revenue Assumptions' },
  { key: 'annualNNNReimbursements', label: 'NNN Reimbursements', category: 'revenue', inputType: 'currency', group: 'Other Revenue', showWhen: 'nonzero' },
  { key: 'annualOtherIncome', label: 'Other Income', category: 'revenue', inputType: 'currency', group: 'Other Revenue', showWhen: 'nonzero' },
  { key: 'propertyManagementPct', label: 'Management Fee %', category: 'expense', inputType: 'percent', defaultValue: 3, pctOf: 'egi', group: 'Management' },
  { key: 'annualPropertyTax', label: 'Property Tax', category: 'expense', inputType: 'currency', group: 'Fixed Expenses' },
  { key: 'annualInsurance', label: 'Insurance', category: 'expense', inputType: 'currency', group: 'Fixed Expenses' },
  { key: 'annualCAM', label: 'CAM / Common Area', category: 'expense', inputType: 'currency', group: 'Operating Expenses' },
  { key: 'monthlyUtilities', label: 'Utilities (monthly)', category: 'expense', inputType: 'currency', group: 'Operating Expenses', showWhen: 'nonzero' },
  { key: 'annualMaintenance', label: 'Maintenance & Repairs', category: 'expense', inputType: 'currency', group: 'Operating Expenses' },
  { key: 'annualCapEx', label: 'Capital Reserves', category: 'expense', inputType: 'currency', group: 'Reserves' },
];

// ---------------------------------------------------------------------------
// Medical Office
// ---------------------------------------------------------------------------
const MEDICAL_OFFICE_FIELDS: COAFieldDef[] = [
  { key: 'totalSquareFeet', label: 'Total Rentable SF', category: 'revenue', inputType: 'number', group: 'Revenue Assumptions' },
  { key: 'rentPerSF', label: 'Rent per SF / Year', category: 'revenue', inputType: 'currency', hint: '$/SF/yr', group: 'Revenue Assumptions' },
  { key: 'occupancyRate', label: 'Occupancy Rate', category: 'revenue', inputType: 'percent', defaultValue: 92, group: 'Revenue Assumptions' },
  { key: 'annualExpenseReimbursements', label: 'Expense Reimbursements', category: 'revenue', inputType: 'currency', group: 'Other Revenue', showWhen: 'nonzero' },
  { key: 'annualOtherIncome', label: 'Other Income', category: 'revenue', inputType: 'currency', group: 'Other Revenue', showWhen: 'nonzero' },
  { key: 'propertyManagementPct', label: 'Management Fee %', category: 'expense', inputType: 'percent', defaultValue: 5, pctOf: 'egi', group: 'Management' },
  { key: 'annualPropertyTax', label: 'Property Tax', category: 'expense', inputType: 'currency', group: 'Fixed Expenses' },
  { key: 'annualInsurance', label: 'Insurance', category: 'expense', inputType: 'currency', group: 'Fixed Expenses' },
  { key: 'monthlyUtilities', label: 'Utilities (monthly)', category: 'expense', inputType: 'currency', group: 'Operating Expenses' },
  { key: 'annualJanitorial', label: 'Janitorial / Biohazard Disposal', category: 'expense', inputType: 'currency', group: 'Operating Expenses' },
  { key: 'annualMaintenance', label: 'Maintenance & Repairs', category: 'expense', inputType: 'currency', group: 'Operating Expenses' },
  { key: 'annualHVACMedical', label: 'HVAC / Medical-Grade Systems', category: 'expense', inputType: 'currency', group: 'Operating Expenses' },
  { key: 'annualSecurity', label: 'Security', category: 'expense', inputType: 'currency', group: 'Operating Expenses', showWhen: 'nonzero' },
  { key: 'annualLandscaping', label: 'Landscaping', category: 'expense', inputType: 'currency', group: 'Operating Expenses', showWhen: 'nonzero' },
  { key: 'annualCapEx', label: 'Capital Reserves', category: 'expense', inputType: 'currency', group: 'Reserves' },
];

// ---------------------------------------------------------------------------
// Car Wash
// ---------------------------------------------------------------------------
const CAR_WASH_FIELDS: COAFieldDef[] = [
  { key: 'selfServeBays', label: 'Self-Serve Bays', category: 'revenue', inputType: 'number', group: 'Revenue Assumptions' },
  { key: 'tunnelLanes', label: 'Tunnel Lanes', category: 'revenue', inputType: 'number', group: 'Revenue Assumptions' },
  { key: 'avgWashPrice', label: 'Avg Wash Price', category: 'revenue', inputType: 'currency', group: 'Revenue Assumptions' },
  { key: 'dailyCarCount', label: 'Daily Car Count', category: 'revenue', inputType: 'number', group: 'Revenue Assumptions' },
  { key: 'membershipCount', label: 'Membership Count', category: 'revenue', inputType: 'number', group: 'Revenue Assumptions', showWhen: 'nonzero' },
  { key: 'membershipPriceMonthly', label: 'Membership Price / Mo', category: 'revenue', inputType: 'currency', group: 'Revenue Assumptions', showWhen: 'nonzero' },
  { key: 'annualVendingIncome', label: 'Vending / Vacuum Income', category: 'revenue', inputType: 'currency', group: 'Other Revenue', showWhen: 'nonzero' },
  { key: 'annualDetailRevenue', label: 'Detail Revenue', category: 'revenue', inputType: 'currency', group: 'Other Revenue', showWhen: 'nonzero' },
  { key: 'annualChemistry', label: 'Chemistry / Chemicals', category: 'expense', inputType: 'currency', group: 'Operating Expenses' },
  { key: 'annualWaterSewer', label: 'Water / Sewer', category: 'expense', inputType: 'currency', group: 'Operating Expenses' },
  { key: 'annualEquipmentMaintenance', label: 'Equipment Maintenance', category: 'expense', inputType: 'currency', group: 'Operating Expenses' },
  { key: 'annualPayroll', label: 'Payroll & Benefits', category: 'expense', inputType: 'currency', group: 'Operating Expenses' },
  { key: 'monthlyUtilities', label: 'Utilities (monthly)', category: 'expense', inputType: 'currency', hint: 'Electric, gas', group: 'Operating Expenses' },
  { key: 'annualInsurance', label: 'Insurance', category: 'expense', inputType: 'currency', group: 'Fixed Expenses' },
  { key: 'annualPropertyTax', label: 'Property Tax', category: 'expense', inputType: 'currency', group: 'Fixed Expenses' },
  { key: 'annualMarketing', label: 'Marketing', category: 'expense', inputType: 'currency', group: 'Operating Expenses', showWhen: 'nonzero' },
  { key: 'monthlyRent', label: 'Rent / Lease (monthly)', category: 'expense', inputType: 'currency', group: 'Fixed Expenses', showWhen: 'nonzero' },
  { key: 'annualCapEx', label: 'Capital Reserves', category: 'expense', inputType: 'currency', group: 'Reserves' },
];

// ---------------------------------------------------------------------------
// Golf Course
// ---------------------------------------------------------------------------
const GOLF_COURSE_FIELDS: COAFieldDef[] = [
  { key: 'totalHoles', label: 'Total Holes', category: 'revenue', inputType: 'number', defaultValue: 18, group: 'Revenue Assumptions' },
  { key: 'avgGreenFee', label: 'Avg Green Fee', category: 'revenue', inputType: 'currency', group: 'Revenue Assumptions' },
  { key: 'roundsPerYear', label: 'Rounds / Year', category: 'revenue', inputType: 'number', group: 'Revenue Assumptions' },
  { key: 'membershipCount', label: 'Membership Count', category: 'revenue', inputType: 'number', group: 'Revenue Assumptions', showWhen: 'nonzero' },
  { key: 'membershipDuesYear', label: 'Membership Dues / Year', category: 'revenue', inputType: 'currency', group: 'Revenue Assumptions', showWhen: 'nonzero' },
  { key: 'avgCartFee', label: 'Cart Fee (per round)', category: 'revenue', inputType: 'currency', group: 'Revenue Assumptions' },
  { key: 'annualProShopRevenue', label: 'Pro Shop Revenue', category: 'revenue', inputType: 'currency', group: 'Other Revenue' },
  { key: 'annualFBRevenue', label: 'F&B Revenue', category: 'revenue', inputType: 'currency', group: 'Other Revenue' },
  { key: 'annualRangeRevenue', label: 'Driving Range Revenue', category: 'revenue', inputType: 'currency', group: 'Other Revenue', showWhen: 'nonzero' },
  { key: 'annualTournamentIncome', label: 'Tournament / Events Income', category: 'revenue', inputType: 'currency', group: 'Other Revenue', showWhen: 'nonzero' },
  { key: 'annualCourseMaintenance', label: 'Course Maintenance (Labor)', category: 'expense', inputType: 'currency', group: 'Course Maintenance' },
  { key: 'annualChemicals', label: 'Chemicals / Fertilizer', category: 'expense', inputType: 'currency', group: 'Course Maintenance' },
  { key: 'annualIrrigation', label: 'Irrigation', category: 'expense', inputType: 'currency', group: 'Course Maintenance' },
  { key: 'annualEquipmentLease', label: 'Equipment Lease / Maintenance', category: 'expense', inputType: 'currency', group: 'Course Maintenance' },
  { key: 'annualProShopCOGS', label: 'Pro Shop COGS', category: 'expense', inputType: 'currency', group: 'COGS' },
  { key: 'annualFBCOGS', label: 'F&B COGS', category: 'expense', inputType: 'currency', group: 'COGS' },
  { key: 'annualPayroll', label: 'Payroll (Admin / Pro Staff)', category: 'expense', inputType: 'currency', group: 'Operating Expenses' },
  { key: 'annualInsurance', label: 'Insurance', category: 'expense', inputType: 'currency', group: 'Fixed Expenses' },
  { key: 'annualPropertyTax', label: 'Property Tax', category: 'expense', inputType: 'currency', group: 'Fixed Expenses' },
  { key: 'annualMarketing', label: 'Marketing', category: 'expense', inputType: 'currency', group: 'Operating Expenses', showWhen: 'nonzero' },
  { key: 'monthlyUtilities', label: 'Utilities (monthly)', category: 'expense', inputType: 'currency', group: 'Operating Expenses' },
  { key: 'annualCapEx', label: 'Capital Reserves', category: 'expense', inputType: 'currency', group: 'Reserves' },
];

// ---------------------------------------------------------------------------
// Restaurant
// ---------------------------------------------------------------------------
const RESTAURANT_FIELDS: COAFieldDef[] = [
  { key: 'seats', label: 'Seats', category: 'revenue', inputType: 'number', group: 'Revenue Assumptions' },
  { key: 'avgCheck', label: 'Average Check', category: 'revenue', inputType: 'currency', group: 'Revenue Assumptions' },
  { key: 'turnsPerDay', label: 'Turns / Day', category: 'revenue', inputType: 'number', defaultValue: 2, group: 'Revenue Assumptions' },
  { key: 'daysOpenPerYear', label: 'Days Open / Year', category: 'revenue', inputType: 'number', defaultValue: 360, group: 'Revenue Assumptions' },
  { key: 'annualFoodRevenue', label: 'Food Revenue', category: 'revenue', inputType: 'currency', group: 'Revenue Breakdown' },
  { key: 'annualBeverageRevenue', label: 'Beverage Revenue', category: 'revenue', inputType: 'currency', group: 'Revenue Breakdown' },
  { key: 'annualCateringRevenue', label: 'Catering Revenue', category: 'revenue', inputType: 'currency', group: 'Other Revenue', showWhen: 'nonzero' },
  { key: 'annualDeliveryRevenue', label: 'Delivery / Takeout Revenue', category: 'revenue', inputType: 'currency', group: 'Other Revenue', showWhen: 'nonzero' },
  { key: 'annualOtherRevenue', label: 'Other Revenue', category: 'revenue', inputType: 'currency', group: 'Other Revenue', showWhen: 'nonzero' },
  { key: 'foodCostPct', label: 'Food Cost %', category: 'expense', inputType: 'percent', defaultValue: 30, pctOf: 'revenue', group: 'COGS' },
  { key: 'beverageCostPct', label: 'Beverage Cost %', category: 'expense', inputType: 'percent', defaultValue: 22, pctOf: 'revenue', group: 'COGS' },
  { key: 'payrollPct', label: 'Payroll & Benefits %', category: 'expense', inputType: 'percent', defaultValue: 30, pctOf: 'revenue', group: 'Operating Expenses' },
  { key: 'monthlyRent', label: 'Rent (monthly)', category: 'expense', inputType: 'currency', group: 'Fixed Expenses' },
  { key: 'monthlyUtilities', label: 'Utilities (monthly)', category: 'expense', inputType: 'currency', group: 'Operating Expenses' },
  { key: 'annualInsurance', label: 'Insurance', category: 'expense', inputType: 'currency', group: 'Fixed Expenses' },
  { key: 'annualMarketing', label: 'Marketing', category: 'expense', inputType: 'currency', group: 'Operating Expenses', showWhen: 'nonzero' },
  { key: 'annualSupplies', label: 'Smallwares / Supplies', category: 'expense', inputType: 'currency', group: 'Operating Expenses' },
  { key: 'annualTechnology', label: 'Technology / POS', category: 'expense', inputType: 'currency', group: 'Operating Expenses', showWhen: 'nonzero' },
  { key: 'annualMaintenance', label: 'Maintenance & Repairs', category: 'expense', inputType: 'currency', group: 'Operating Expenses' },
  { key: 'annualCapEx', label: 'Capital Reserves', category: 'expense', inputType: 'currency', group: 'Reserves' },
];

// ---------------------------------------------------------------------------
// RV Park
// ---------------------------------------------------------------------------
const RV_PARK_FIELDS: COAFieldDef[] = [
  { key: 'totalSites', label: 'Total Sites', category: 'revenue', inputType: 'number', group: 'Revenue Assumptions' },
  { key: 'monthlySeasonalSites', label: 'Monthly / Seasonal Sites', category: 'revenue', inputType: 'number', group: 'Revenue Assumptions' },
  { key: 'transientSites', label: 'Transient / Nightly Sites', category: 'revenue', inputType: 'number', group: 'Revenue Assumptions' },
  { key: 'avgMonthlyRate', label: 'Avg Monthly Rate', category: 'revenue', inputType: 'currency', group: 'Revenue Assumptions' },
  { key: 'avgNightlyRate', label: 'Avg Nightly Rate', category: 'revenue', inputType: 'currency', group: 'Revenue Assumptions' },
  { key: 'occupancyRate', label: 'Occupancy %', category: 'revenue', inputType: 'percent', defaultValue: 70, group: 'Revenue Assumptions' },
  { key: 'annualCampStoreRevenue', label: 'Camp Store Revenue', category: 'revenue', inputType: 'currency', group: 'Other Revenue', showWhen: 'nonzero' },
  { key: 'annualPropaneRevenue', label: 'Propane Revenue', category: 'revenue', inputType: 'currency', group: 'Other Revenue', showWhen: 'nonzero' },
  { key: 'annualLaundryIncome', label: 'Laundry Income', category: 'revenue', inputType: 'currency', group: 'Other Revenue', showWhen: 'nonzero' },
  { key: 'annualActivityFees', label: 'Activity / Amenity Fees', category: 'revenue', inputType: 'currency', group: 'Other Revenue', showWhen: 'nonzero' },
  { key: 'annualOtherRevenue', label: 'Other Revenue', category: 'revenue', inputType: 'currency', group: 'Other Revenue', showWhen: 'nonzero' },
  { key: 'propertyManagementPct', label: 'Management Fee %', category: 'expense', inputType: 'percent', defaultValue: 5, pctOf: 'egi', group: 'Management' },
  { key: 'annualPayroll', label: 'Payroll & Benefits', category: 'expense', inputType: 'currency', group: 'Operating Expenses' },
  { key: 'annualPropertyTax', label: 'Property Tax', category: 'expense', inputType: 'currency', group: 'Fixed Expenses' },
  { key: 'annualInsurance', label: 'Insurance', category: 'expense', inputType: 'currency', group: 'Fixed Expenses' },
  { key: 'monthlyUtilities', label: 'Utilities (monthly)', category: 'expense', inputType: 'currency', group: 'Operating Expenses' },
  { key: 'annualMaintenance', label: 'Maintenance & Grounds', category: 'expense', inputType: 'currency', group: 'Operating Expenses' },
  { key: 'annualMarketing', label: 'Marketing', category: 'expense', inputType: 'currency', group: 'Operating Expenses', showWhen: 'nonzero' },
  { key: 'annualSoftware', label: 'Software / Reservations', category: 'expense', inputType: 'currency', group: 'Operating Expenses', showWhen: 'nonzero' },
  { key: 'annualCapEx', label: 'Capital Reserves', category: 'expense', inputType: 'currency', group: 'Reserves' },
];

// ---------------------------------------------------------------------------
// Shopping Center
// ---------------------------------------------------------------------------
const SHOPPING_CENTER_FIELDS: COAFieldDef[] = [
  { key: 'totalGLA', label: 'GLA (Total SF)', category: 'revenue', inputType: 'number', group: 'Revenue Assumptions' },
  { key: 'avgRentPerSF', label: 'Avg Rent / SF / Year', category: 'revenue', inputType: 'currency', hint: '$/SF/yr', group: 'Revenue Assumptions' },
  { key: 'occupancyRate', label: 'Occupancy %', category: 'revenue', inputType: 'percent', defaultValue: 93, group: 'Revenue Assumptions' },
  { key: 'anchorTenantPct', label: 'Anchor Tenant % of GLA', category: 'revenue', inputType: 'percent', group: 'Revenue Assumptions' },
  { key: 'inlineTenantPct', label: 'In-Line Tenant % of GLA', category: 'revenue', inputType: 'percent', group: 'Revenue Assumptions' },
  { key: 'annualCAMRecovery', label: 'CAM Recovery', category: 'revenue', inputType: 'currency', group: 'Other Revenue' },
  { key: 'annualPercentageRent', label: 'Percentage Rent', category: 'revenue', inputType: 'currency', group: 'Other Revenue', showWhen: 'nonzero' },
  { key: 'annualOutparcelRevenue', label: 'Outparcel Revenue', category: 'revenue', inputType: 'currency', group: 'Other Revenue', showWhen: 'nonzero' },
  { key: 'annualPylonSignRevenue', label: 'Pylon Sign Revenue', category: 'revenue', inputType: 'currency', group: 'Other Revenue', showWhen: 'nonzero' },
  { key: 'annualOtherIncome', label: 'Other Income', category: 'revenue', inputType: 'currency', group: 'Other Revenue', showWhen: 'nonzero' },
  { key: 'propertyManagementPct', label: 'Management Fee %', category: 'expense', inputType: 'percent', defaultValue: 4, pctOf: 'egi', group: 'Management' },
  { key: 'annualPropertyTax', label: 'Property Tax', category: 'expense', inputType: 'currency', group: 'Fixed Expenses' },
  { key: 'annualInsurance', label: 'Insurance', category: 'expense', inputType: 'currency', group: 'Fixed Expenses' },
  { key: 'annualCAMExpenses', label: 'CAM Expenses', category: 'expense', inputType: 'currency', group: 'Operating Expenses' },
  { key: 'annualMaintenance', label: 'Maintenance & Repairs', category: 'expense', inputType: 'currency', group: 'Operating Expenses' },
  { key: 'annualSecurity', label: 'Security', category: 'expense', inputType: 'currency', group: 'Operating Expenses' },
  { key: 'annualMarketing', label: 'Marketing / Tenant Coordination', category: 'expense', inputType: 'currency', group: 'Operating Expenses', showWhen: 'nonzero' },
  { key: 'annualJanitorial', label: 'Janitorial', category: 'expense', inputType: 'currency', group: 'Operating Expenses' },
  { key: 'monthlyUtilities', label: 'Utilities (monthly)', category: 'expense', inputType: 'currency', group: 'Operating Expenses' },
  { key: 'annualCapEx', label: 'Capital Reserves', category: 'expense', inputType: 'currency', group: 'Reserves' },
];

// ---------------------------------------------------------------------------
// Mixed-Use
// ---------------------------------------------------------------------------
const MIXED_USE_FIELDS: COAFieldDef[] = [
  { key: 'residentialUnits', label: 'Residential Units', category: 'revenue', inputType: 'number', group: 'Revenue Assumptions' },
  { key: 'avgResidentialRent', label: 'Avg Residential Monthly Rent', category: 'revenue', inputType: 'currency', group: 'Revenue Assumptions' },
  { key: 'commercialSF', label: 'Commercial SF', category: 'revenue', inputType: 'number', group: 'Revenue Assumptions' },
  { key: 'commercialRentPerSF', label: 'Commercial Rent / SF / Year', category: 'revenue', inputType: 'currency', group: 'Revenue Assumptions' },
  { key: 'vacancyRate', label: 'Vacancy Rate', category: 'revenue', inputType: 'percent', defaultValue: 5, group: 'Revenue Assumptions' },
  { key: 'annualCAMReimbursements', label: 'CAM Reimbursements', category: 'revenue', inputType: 'currency', group: 'Other Revenue', showWhen: 'nonzero' },
  { key: 'annualParkingIncome', label: 'Parking Income', category: 'revenue', inputType: 'currency', group: 'Other Revenue', showWhen: 'nonzero' },
  { key: 'annualOtherIncome', label: 'Other Income', category: 'revenue', inputType: 'currency', group: 'Other Revenue', showWhen: 'nonzero' },
  { key: 'propertyManagementPct', label: 'Management Fee %', category: 'expense', inputType: 'percent', defaultValue: 5, pctOf: 'egi', group: 'Management' },
  { key: 'annualPayroll', label: 'Payroll', category: 'expense', inputType: 'currency', group: 'Operating Expenses' },
  { key: 'annualPropertyTax', label: 'Property Tax', category: 'expense', inputType: 'currency', group: 'Fixed Expenses' },
  { key: 'annualInsurance', label: 'Insurance', category: 'expense', inputType: 'currency', group: 'Fixed Expenses' },
  { key: 'monthlyUtilities', label: 'Utilities (monthly)', category: 'expense', inputType: 'currency', group: 'Operating Expenses' },
  { key: 'annualMaintenance', label: 'Maintenance & Repairs', category: 'expense', inputType: 'currency', group: 'Operating Expenses' },
  { key: 'annualJanitorial', label: 'Janitorial', category: 'expense', inputType: 'currency', group: 'Operating Expenses', showWhen: 'nonzero' },
  { key: 'annualMarketing', label: 'Marketing', category: 'expense', inputType: 'currency', group: 'Operating Expenses', showWhen: 'nonzero' },
  { key: 'annualCapEx', label: 'Capital Reserves', category: 'expense', inputType: 'currency', group: 'Reserves' },
];

// ---------------------------------------------------------------------------
// Mobile Home Park
// ---------------------------------------------------------------------------
const MOBILE_HOME_PARK_FIELDS: COAFieldDef[] = [
  { key: 'totalLots', label: 'Total Lots / Pads', category: 'revenue', inputType: 'number', group: 'Revenue Assumptions' },
  { key: 'avgMonthlyLotRent', label: 'Avg Monthly Lot Rent', category: 'revenue', inputType: 'currency', group: 'Revenue Assumptions' },
  { key: 'vacancyRate', label: 'Vacancy Rate', category: 'revenue', inputType: 'percent', defaultValue: 5, group: 'Revenue Assumptions' },
  { key: 'parkOwnedHomes', label: 'Park-Owned Homes (POH)', category: 'revenue', inputType: 'number', group: 'Revenue Assumptions', showWhen: 'nonzero' },
  { key: 'annualUtilityReimbursement', label: 'Utility Reimbursement', category: 'revenue', inputType: 'currency', group: 'Other Revenue', showWhen: 'nonzero' },
  { key: 'annualHomeSalesRevenue', label: 'Home Sales Revenue (POH)', category: 'revenue', inputType: 'currency', group: 'Other Revenue', showWhen: 'nonzero' },
  { key: 'annualOtherIncome', label: 'Other Income', category: 'revenue', inputType: 'currency', group: 'Other Revenue', showWhen: 'nonzero' },
  { key: 'propertyManagementPct', label: 'Management Fee %', category: 'expense', inputType: 'percent', defaultValue: 6, pctOf: 'egi', group: 'Management' },
  { key: 'annualPayroll', label: 'Payroll', category: 'expense', inputType: 'currency', group: 'Operating Expenses' },
  { key: 'annualPropertyTax', label: 'Property Tax', category: 'expense', inputType: 'currency', group: 'Fixed Expenses' },
  { key: 'annualInsurance', label: 'Insurance', category: 'expense', inputType: 'currency', group: 'Fixed Expenses' },
  { key: 'monthlyUtilities', label: 'Utilities (monthly, common area)', category: 'expense', inputType: 'currency', group: 'Operating Expenses' },
  { key: 'annualWaterSewer', label: 'Water / Sewer', category: 'expense', inputType: 'currency', group: 'Operating Expenses' },
  { key: 'annualRoadMaintenance', label: 'Road / Common Area Maintenance', category: 'expense', inputType: 'currency', group: 'Operating Expenses' },
  { key: 'annualMarketing', label: 'Marketing', category: 'expense', inputType: 'currency', group: 'Operating Expenses', showWhen: 'nonzero' },
  { key: 'annualCapEx', label: 'Capital Reserves', category: 'expense', inputType: 'currency', group: 'Reserves' },
];

// ---------------------------------------------------------------------------
// Parking (Garage / Surface Lot)
// ---------------------------------------------------------------------------
const PARKING_FIELDS: COAFieldDef[] = [
  { key: 'totalSpaces', label: 'Total Spaces', category: 'revenue', inputType: 'number', group: 'Revenue Assumptions' },
  { key: 'monthlyPermitSpaces', label: 'Monthly Permit Spaces', category: 'revenue', inputType: 'number', group: 'Revenue Assumptions' },
  { key: 'avgMonthlyPermitRate', label: 'Avg Monthly Permit Rate', category: 'revenue', inputType: 'currency', group: 'Revenue Assumptions' },
  { key: 'avgHourlyRate', label: 'Avg Hourly / Transient Rate', category: 'revenue', inputType: 'currency', group: 'Revenue Assumptions' },
  { key: 'transientOccupancy', label: 'Transient Occupancy %', category: 'revenue', inputType: 'percent', defaultValue: 60, group: 'Revenue Assumptions' },
  { key: 'annualEventRevenue', label: 'Event Parking Revenue', category: 'revenue', inputType: 'currency', group: 'Other Revenue', showWhen: 'nonzero' },
  { key: 'annualValetRevenue', label: 'Valet Revenue', category: 'revenue', inputType: 'currency', group: 'Other Revenue', showWhen: 'nonzero' },
  { key: 'annualOtherRevenue', label: 'Other Revenue', category: 'revenue', inputType: 'currency', group: 'Other Revenue', showWhen: 'nonzero' },
  { key: 'propertyManagementPct', label: 'Management / Operator Fee %', category: 'expense', inputType: 'percent', defaultValue: 5, pctOf: 'revenue', group: 'Management' },
  { key: 'annualPayroll', label: 'Payroll / Attendants', category: 'expense', inputType: 'currency', group: 'Operating Expenses' },
  { key: 'annualPropertyTax', label: 'Property Tax', category: 'expense', inputType: 'currency', group: 'Fixed Expenses' },
  { key: 'annualInsurance', label: 'Insurance', category: 'expense', inputType: 'currency', group: 'Fixed Expenses' },
  { key: 'monthlyUtilities', label: 'Utilities / Lighting (monthly)', category: 'expense', inputType: 'currency', group: 'Operating Expenses' },
  { key: 'annualMaintenance', label: 'Maintenance & Repairs', category: 'expense', inputType: 'currency', group: 'Operating Expenses' },
  { key: 'annualTechnology', label: 'Technology / Access Systems', category: 'expense', inputType: 'currency', group: 'Operating Expenses', showWhen: 'nonzero' },
  { key: 'annualCapEx', label: 'Capital Reserves', category: 'expense', inputType: 'currency', group: 'Reserves' },
];

// ---------------------------------------------------------------------------
// Data Center
// ---------------------------------------------------------------------------
const DATA_CENTER_FIELDS: COAFieldDef[] = [
  { key: 'totalRacks', label: 'Total Racks / Cabinets', category: 'revenue', inputType: 'number', group: 'Revenue Assumptions' },
  { key: 'avgMonthlyRackRate', label: 'Avg Monthly Rack Rate', category: 'revenue', inputType: 'currency', group: 'Revenue Assumptions' },
  { key: 'occupancyRate', label: 'Occupancy %', category: 'revenue', inputType: 'percent', defaultValue: 85, group: 'Revenue Assumptions' },
  { key: 'totalMW', label: 'Total MW Capacity', category: 'revenue', inputType: 'number', hint: 'Megawatts of power', group: 'Revenue Assumptions' },
  { key: 'annualManagedServices', label: 'Managed Services Revenue', category: 'revenue', inputType: 'currency', group: 'Other Revenue', showWhen: 'nonzero' },
  { key: 'annualInterconnect', label: 'Interconnection / Cross-Connect', category: 'revenue', inputType: 'currency', group: 'Other Revenue', showWhen: 'nonzero' },
  { key: 'annualPowerRevenue', label: 'Power Revenue (pass-through)', category: 'revenue', inputType: 'currency', group: 'Other Revenue' },
  { key: 'annualOtherRevenue', label: 'Other Revenue', category: 'revenue', inputType: 'currency', group: 'Other Revenue', showWhen: 'nonzero' },
  { key: 'annualPowerCost', label: 'Power / Electricity', category: 'expense', inputType: 'currency', group: 'Operating Expenses' },
  { key: 'annualCooling', label: 'Cooling / HVAC', category: 'expense', inputType: 'currency', group: 'Operating Expenses' },
  { key: 'annualPayroll', label: 'Payroll & Benefits', category: 'expense', inputType: 'currency', group: 'Operating Expenses' },
  { key: 'annualBandwidth', label: 'Bandwidth / Connectivity', category: 'expense', inputType: 'currency', group: 'Operating Expenses' },
  { key: 'annualInsurance', label: 'Insurance', category: 'expense', inputType: 'currency', group: 'Fixed Expenses' },
  { key: 'annualPropertyTax', label: 'Property Tax', category: 'expense', inputType: 'currency', group: 'Fixed Expenses' },
  { key: 'annualSecurity', label: 'Security (Physical & Cyber)', category: 'expense', inputType: 'currency', group: 'Operating Expenses' },
  { key: 'annualMaintenance', label: 'Maintenance & Repairs', category: 'expense', inputType: 'currency', group: 'Operating Expenses' },
  { key: 'annualGeneratorFuel', label: 'Generator / Fuel', category: 'expense', inputType: 'currency', group: 'Operating Expenses' },
  { key: 'annualCapEx', label: 'Capital Reserves', category: 'expense', inputType: 'currency', group: 'Reserves' },
];

// ---------------------------------------------------------------------------
// Car Dealership
// ---------------------------------------------------------------------------
const CAR_DEALERSHIP_FIELDS: COAFieldDef[] = [
  { key: 'annualNewVehicleSales', label: 'New Vehicle Sales', category: 'revenue', inputType: 'currency', group: 'Revenue' },
  { key: 'annualUsedVehicleSales', label: 'Used Vehicle Sales', category: 'revenue', inputType: 'currency', group: 'Revenue' },
  { key: 'annualFIRevenue', label: 'F&I Revenue', category: 'revenue', inputType: 'currency', hint: 'Finance & insurance products', group: 'Revenue' },
  { key: 'annualServiceRevenue', label: 'Service Department Revenue', category: 'revenue', inputType: 'currency', group: 'Revenue' },
  { key: 'annualPartsRevenue', label: 'Parts Revenue', category: 'revenue', inputType: 'currency', group: 'Revenue' },
  { key: 'annualBodyShopRevenue', label: 'Body Shop Revenue', category: 'revenue', inputType: 'currency', group: 'Revenue', showWhen: 'nonzero' },
  { key: 'annualOtherRevenue', label: 'Other Revenue', category: 'revenue', inputType: 'currency', group: 'Other Revenue', showWhen: 'nonzero' },
  { key: 'annualVehicleCOGS', label: 'Vehicle COGS', category: 'expense', inputType: 'currency', group: 'COGS' },
  { key: 'annualPartsCOGS', label: 'Parts / Service COGS', category: 'expense', inputType: 'currency', group: 'COGS' },
  { key: 'annualPayroll', label: 'Payroll & Commissions', category: 'expense', inputType: 'currency', group: 'Operating Expenses' },
  { key: 'annualFloorplan', label: 'Floorplan Interest', category: 'expense', inputType: 'currency', group: 'Operating Expenses' },
  { key: 'monthlyRent', label: 'Rent / Lease (monthly)', category: 'expense', inputType: 'currency', group: 'Fixed Expenses' },
  { key: 'annualAdvertising', label: 'Advertising', category: 'expense', inputType: 'currency', group: 'Operating Expenses' },
  { key: 'annualInsurance', label: 'Insurance', category: 'expense', inputType: 'currency', group: 'Fixed Expenses' },
  { key: 'monthlyUtilities', label: 'Utilities (monthly)', category: 'expense', inputType: 'currency', group: 'Operating Expenses' },
  { key: 'annualTechnology', label: 'Technology / DMS', category: 'expense', inputType: 'currency', group: 'Operating Expenses' },
  { key: 'annualMaintenance', label: 'Facility Maintenance', category: 'expense', inputType: 'currency', group: 'Operating Expenses' },
  { key: 'annualCapEx', label: 'Capital Reserves', category: 'expense', inputType: 'currency', group: 'Reserves' },
];

// ---------------------------------------------------------------------------
// Gas Station / C-Store
// ---------------------------------------------------------------------------
const GAS_STATION_FIELDS: COAFieldDef[] = [
  { key: 'annualGallonsSold', label: 'Annual Gallons Sold', category: 'revenue', inputType: 'number', group: 'Revenue Assumptions' },
  { key: 'fuelMarginPerGallon', label: 'Fuel Margin per Gallon', category: 'revenue', inputType: 'currency', hint: '$/gallon margin', group: 'Revenue Assumptions' },
  { key: 'annualCStoreRevenue', label: 'C-Store / Inside Sales', category: 'revenue', inputType: 'currency', group: 'Revenue' },
  { key: 'annualCarWashRevenue', label: 'Car Wash Revenue', category: 'revenue', inputType: 'currency', group: 'Revenue', showWhen: 'nonzero' },
  { key: 'annualLotteryCommission', label: 'Lottery / ATM Commission', category: 'revenue', inputType: 'currency', group: 'Other Revenue', showWhen: 'nonzero' },
  { key: 'annualOtherRevenue', label: 'Other Revenue', category: 'revenue', inputType: 'currency', group: 'Other Revenue', showWhen: 'nonzero' },
  { key: 'annualFuelCOGS', label: 'Fuel COGS', category: 'expense', inputType: 'currency', group: 'COGS' },
  { key: 'annualMerchandiseCOGS', label: 'Merchandise COGS', category: 'expense', inputType: 'currency', group: 'COGS' },
  { key: 'annualPayroll', label: 'Payroll & Benefits', category: 'expense', inputType: 'currency', group: 'Operating Expenses' },
  { key: 'monthlyRent', label: 'Rent / Lease (monthly)', category: 'expense', inputType: 'currency', group: 'Fixed Expenses', showWhen: 'nonzero' },
  { key: 'monthlyUtilities', label: 'Utilities (monthly)', category: 'expense', inputType: 'currency', group: 'Operating Expenses' },
  { key: 'annualInsurance', label: 'Insurance', category: 'expense', inputType: 'currency', group: 'Fixed Expenses' },
  { key: 'annualPropertyTax', label: 'Property Tax', category: 'expense', inputType: 'currency', group: 'Fixed Expenses' },
  { key: 'annualCreditCardFees', label: 'Credit Card Processing Fees', category: 'expense', inputType: 'currency', group: 'Operating Expenses' },
  { key: 'annualEnvironmental', label: 'Environmental / Tank Compliance', category: 'expense', inputType: 'currency', group: 'Operating Expenses' },
  { key: 'annualMaintenance', label: 'Maintenance & Repairs', category: 'expense', inputType: 'currency', group: 'Operating Expenses' },
  { key: 'annualCapEx', label: 'Capital Reserves', category: 'expense', inputType: 'currency', group: 'Reserves' },
];

// ---------------------------------------------------------------------------
// Gym / Fitness Center
// ---------------------------------------------------------------------------
const GYM_FIELDS: COAFieldDef[] = [
  { key: 'membershipCount', label: 'Total Members', category: 'revenue', inputType: 'number', group: 'Revenue Assumptions' },
  { key: 'avgMonthlyDues', label: 'Avg Monthly Dues', category: 'revenue', inputType: 'currency', group: 'Revenue Assumptions' },
  { key: 'annualPersonalTraining', label: 'Personal Training Revenue', category: 'revenue', inputType: 'currency', group: 'Other Revenue' },
  { key: 'annualClassRevenue', label: 'Class / Group Fitness Revenue', category: 'revenue', inputType: 'currency', group: 'Other Revenue', showWhen: 'nonzero' },
  { key: 'annualRetailRevenue', label: 'Retail / Pro Shop Revenue', category: 'revenue', inputType: 'currency', group: 'Other Revenue', showWhen: 'nonzero' },
  { key: 'annualJuiceBarRevenue', label: 'Juice Bar / F&B Revenue', category: 'revenue', inputType: 'currency', group: 'Other Revenue', showWhen: 'nonzero' },
  { key: 'annualOtherRevenue', label: 'Other Revenue', category: 'revenue', inputType: 'currency', group: 'Other Revenue', showWhen: 'nonzero' },
  { key: 'annualPayroll', label: 'Payroll & Benefits', category: 'expense', inputType: 'currency', group: 'Operating Expenses' },
  { key: 'monthlyRent', label: 'Rent / Lease (monthly)', category: 'expense', inputType: 'currency', group: 'Fixed Expenses' },
  { key: 'monthlyUtilities', label: 'Utilities (monthly)', category: 'expense', inputType: 'currency', group: 'Operating Expenses' },
  { key: 'annualInsurance', label: 'Insurance', category: 'expense', inputType: 'currency', group: 'Fixed Expenses' },
  { key: 'annualEquipmentLease', label: 'Equipment Lease / Maintenance', category: 'expense', inputType: 'currency', group: 'Operating Expenses' },
  { key: 'annualMarketing', label: 'Marketing', category: 'expense', inputType: 'currency', group: 'Operating Expenses' },
  { key: 'annualSoftware', label: 'Software / Member Management', category: 'expense', inputType: 'currency', group: 'Operating Expenses', showWhen: 'nonzero' },
  { key: 'annualCleaning', label: 'Cleaning / Janitorial', category: 'expense', inputType: 'currency', group: 'Operating Expenses' },
  { key: 'annualMaintenance', label: 'Facility Maintenance', category: 'expense', inputType: 'currency', group: 'Operating Expenses' },
  { key: 'annualCapEx', label: 'Capital Reserves', category: 'expense', inputType: 'currency', group: 'Reserves' },
];

// ---------------------------------------------------------------------------
// Daycare
// ---------------------------------------------------------------------------
const DAYCARE_FIELDS: COAFieldDef[] = [
  { key: 'licensedCapacity', label: 'Licensed Capacity (children)', category: 'revenue', inputType: 'number', group: 'Revenue Assumptions' },
  { key: 'avgWeeklyTuition', label: 'Avg Weekly Tuition', category: 'revenue', inputType: 'currency', group: 'Revenue Assumptions' },
  { key: 'enrollmentRate', label: 'Enrollment Rate %', category: 'revenue', inputType: 'percent', defaultValue: 85, group: 'Revenue Assumptions' },
  { key: 'annualRegistrationFees', label: 'Registration Fees', category: 'revenue', inputType: 'currency', group: 'Other Revenue', showWhen: 'nonzero' },
  { key: 'annualAfterSchool', label: 'After-School / Drop-In Revenue', category: 'revenue', inputType: 'currency', group: 'Other Revenue', showWhen: 'nonzero' },
  { key: 'annualMealRevenue', label: 'Meal / Snack Revenue', category: 'revenue', inputType: 'currency', group: 'Other Revenue', showWhen: 'nonzero' },
  { key: 'annualSubsidyRevenue', label: 'Government Subsidy Revenue', category: 'revenue', inputType: 'currency', group: 'Other Revenue', showWhen: 'nonzero' },
  { key: 'annualOtherRevenue', label: 'Other Revenue', category: 'revenue', inputType: 'currency', group: 'Other Revenue', showWhen: 'nonzero' },
  { key: 'annualPayroll', label: 'Payroll & Benefits (Teachers/Staff)', category: 'expense', inputType: 'currency', group: 'Operating Expenses' },
  { key: 'monthlyRent', label: 'Rent / Lease (monthly)', category: 'expense', inputType: 'currency', group: 'Fixed Expenses' },
  { key: 'annualFoodSupplies', label: 'Food & Supplies', category: 'expense', inputType: 'currency', group: 'Operating Expenses' },
  { key: 'annualInsurance', label: 'Insurance (Liability/Property)', category: 'expense', inputType: 'currency', group: 'Fixed Expenses' },
  { key: 'monthlyUtilities', label: 'Utilities (monthly)', category: 'expense', inputType: 'currency', group: 'Operating Expenses' },
  { key: 'annualCurriculum', label: 'Curriculum / Educational Materials', category: 'expense', inputType: 'currency', group: 'Operating Expenses' },
  { key: 'annualLicensing', label: 'Licensing / Compliance', category: 'expense', inputType: 'currency', group: 'Operating Expenses' },
  { key: 'annualMarketing', label: 'Marketing', category: 'expense', inputType: 'currency', group: 'Operating Expenses', showWhen: 'nonzero' },
  { key: 'annualMaintenance', label: 'Maintenance & Repairs', category: 'expense', inputType: 'currency', group: 'Operating Expenses' },
  { key: 'annualCapEx', label: 'Capital Reserves', category: 'expense', inputType: 'currency', group: 'Reserves' },
];

// ---------------------------------------------------------------------------
// Landscaping Business
// ---------------------------------------------------------------------------
const LANDSCAPING_FIELDS: COAFieldDef[] = [
  { key: 'maintenanceContracts', label: 'Number of Maintenance Contracts', category: 'revenue', inputType: 'number', group: 'Revenue Assumptions' },
  { key: 'avgMonthlyContractValue', label: 'Avg Monthly Contract Value', category: 'revenue', inputType: 'currency', group: 'Revenue Assumptions' },
  { key: 'annualDesignInstall', label: 'Design / Install Revenue', category: 'revenue', inputType: 'currency', group: 'Revenue' },
  { key: 'annualHardscape', label: 'Hardscape Revenue', category: 'revenue', inputType: 'currency', group: 'Revenue', showWhen: 'nonzero' },
  { key: 'annualIrrigation', label: 'Irrigation Revenue', category: 'revenue', inputType: 'currency', group: 'Revenue', showWhen: 'nonzero' },
  { key: 'annualSnowRemoval', label: 'Snow Removal Revenue', category: 'revenue', inputType: 'currency', group: 'Revenue', showWhen: 'nonzero' },
  { key: 'annualOtherRevenue', label: 'Other Revenue', category: 'revenue', inputType: 'currency', group: 'Other Revenue', showWhen: 'nonzero' },
  { key: 'annualMaterials', label: 'Materials / Plants / Supplies', category: 'expense', inputType: 'currency', group: 'COGS' },
  { key: 'annualPayroll', label: 'Payroll & Benefits (Crews)', category: 'expense', inputType: 'currency', group: 'Operating Expenses' },
  { key: 'ownerSalary', label: "Owner's Salary (SDE add-back)", category: 'expense', inputType: 'currency', hint: 'Added back for SDE calc', group: 'Operating Expenses' },
  { key: 'annualVehicleFuel', label: 'Vehicle / Fuel', category: 'expense', inputType: 'currency', group: 'Operating Expenses' },
  { key: 'annualEquipmentLease', label: 'Equipment Lease / Maintenance', category: 'expense', inputType: 'currency', group: 'Operating Expenses' },
  { key: 'annualInsurance', label: 'Insurance (GL / Workers Comp)', category: 'expense', inputType: 'currency', group: 'Fixed Expenses' },
  { key: 'monthlyRent', label: 'Yard / Office Rent (monthly)', category: 'expense', inputType: 'currency', group: 'Fixed Expenses' },
  { key: 'annualMarketing', label: 'Marketing', category: 'expense', inputType: 'currency', group: 'Operating Expenses', showWhen: 'nonzero' },
  { key: 'annualSubcontractors', label: 'Subcontractors', category: 'expense', inputType: 'currency', group: 'Operating Expenses', showWhen: 'nonzero' },
  { key: 'annualOtherExpenses', label: 'Other Expenses', category: 'expense', inputType: 'currency', group: 'Operating Expenses', showWhen: 'nonzero' },
];

// ---------------------------------------------------------------------------
// Construction Company
// ---------------------------------------------------------------------------
const CONSTRUCTION_FIELDS: COAFieldDef[] = [
  { key: 'annualContractRevenue', label: 'Contract Revenue', category: 'revenue', inputType: 'currency', group: 'Revenue' },
  { key: 'annualChangeOrders', label: 'Change Order Revenue', category: 'revenue', inputType: 'currency', group: 'Revenue', showWhen: 'nonzero' },
  { key: 'annualServiceRevenue', label: 'Service / Warranty Revenue', category: 'revenue', inputType: 'currency', group: 'Revenue', showWhen: 'nonzero' },
  { key: 'annualOtherRevenue', label: 'Other Revenue', category: 'revenue', inputType: 'currency', group: 'Other Revenue', showWhen: 'nonzero' },
  { key: 'annualMaterials', label: 'Materials / Supplies', category: 'expense', inputType: 'currency', group: 'COGS' },
  { key: 'annualDirectLabor', label: 'Direct Labor', category: 'expense', inputType: 'currency', group: 'COGS' },
  { key: 'annualSubcontractors', label: 'Subcontractors', category: 'expense', inputType: 'currency', group: 'COGS' },
  { key: 'annualEquipmentRental', label: 'Equipment Rental / Lease', category: 'expense', inputType: 'currency', group: 'Operating Expenses' },
  { key: 'annualVehicleFuel', label: 'Vehicle / Fuel', category: 'expense', inputType: 'currency', group: 'Operating Expenses' },
  { key: 'annualInsurance', label: 'Insurance (GL / WC / Bonding)', category: 'expense', inputType: 'currency', group: 'Fixed Expenses' },
  { key: 'annualPermits', label: 'Permits / Licensing', category: 'expense', inputType: 'currency', group: 'Operating Expenses' },
  { key: 'annualOfficePayroll', label: 'Office Payroll / Admin', category: 'expense', inputType: 'currency', group: 'Operating Expenses' },
  { key: 'ownerSalary', label: "Owner's Salary (SDE add-back)", category: 'expense', inputType: 'currency', hint: 'Added back for SDE calc', group: 'Operating Expenses' },
  { key: 'monthlyRent', label: 'Office / Yard Rent (monthly)', category: 'expense', inputType: 'currency', group: 'Fixed Expenses' },
  { key: 'annualMarketing', label: 'Marketing', category: 'expense', inputType: 'currency', group: 'Operating Expenses', showWhen: 'nonzero' },
  { key: 'annualOtherExpenses', label: 'Other Expenses', category: 'expense', inputType: 'currency', group: 'Operating Expenses', showWhen: 'nonzero' },
];

// ---------------------------------------------------------------------------
// Accounting Firm
// ---------------------------------------------------------------------------
const ACCOUNTING_FIRM_FIELDS: COAFieldDef[] = [
  { key: 'totalClients', label: 'Total Clients', category: 'revenue', inputType: 'number', group: 'Revenue Assumptions' },
  { key: 'avgRevenuePerClient', label: 'Avg Revenue / Client / Year', category: 'revenue', inputType: 'currency', group: 'Revenue Assumptions' },
  { key: 'annualTaxPrepRevenue', label: 'Tax Preparation Revenue', category: 'revenue', inputType: 'currency', group: 'Revenue Breakdown' },
  { key: 'annualBookkeepingRevenue', label: 'Bookkeeping Revenue', category: 'revenue', inputType: 'currency', group: 'Revenue Breakdown' },
  { key: 'annualAuditRevenue', label: 'Audit / Assurance Revenue', category: 'revenue', inputType: 'currency', group: 'Revenue Breakdown', showWhen: 'nonzero' },
  { key: 'annualAdvisoryRevenue', label: 'Advisory / Consulting Revenue', category: 'revenue', inputType: 'currency', group: 'Revenue Breakdown', showWhen: 'nonzero' },
  { key: 'annualPayrollServices', label: 'Payroll Services Revenue', category: 'revenue', inputType: 'currency', group: 'Revenue Breakdown', showWhen: 'nonzero' },
  { key: 'annualOtherRevenue', label: 'Other Revenue', category: 'revenue', inputType: 'currency', group: 'Other Revenue', showWhen: 'nonzero' },
  { key: 'annualStaffPayroll', label: 'Staff Payroll & Benefits', category: 'expense', inputType: 'currency', group: 'Operating Expenses' },
  { key: 'ownerComp', label: "Owner's Compensation (SDE add-back)", category: 'expense', inputType: 'currency', hint: 'Added back for SDE calc', group: 'Operating Expenses' },
  { key: 'monthlyRent', label: 'Office Rent (monthly)', category: 'expense', inputType: 'currency', group: 'Fixed Expenses' },
  { key: 'annualSoftware', label: 'Software / Subscriptions', category: 'expense', inputType: 'currency', hint: 'Tax software, accounting platforms', group: 'Operating Expenses' },
  { key: 'annualInsurance', label: 'Insurance (E&O / GL)', category: 'expense', inputType: 'currency', group: 'Fixed Expenses' },
  { key: 'annualCPE', label: 'Continuing Education / CPE', category: 'expense', inputType: 'currency', group: 'Operating Expenses', showWhen: 'nonzero' },
  { key: 'annualMarketing', label: 'Marketing', category: 'expense', inputType: 'currency', group: 'Operating Expenses', showWhen: 'nonzero' },
  { key: 'monthlyUtilities', label: 'Utilities (monthly)', category: 'expense', inputType: 'currency', group: 'Operating Expenses' },
  { key: 'annualOfficeSupplies', label: 'Office Supplies', category: 'expense', inputType: 'currency', group: 'Operating Expenses', showWhen: 'nonzero' },
  { key: 'annualOtherExpenses', label: 'Other Expenses', category: 'expense', inputType: 'currency', group: 'Operating Expenses', showWhen: 'nonzero' },
];

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export const COA_FIELD_REGISTRY: Record<string, COAFieldDef[]> = {
  str: STR_FIELDS,
  sfr: SFR_FIELDS,
  duplex: RESIDENTIAL_MULTI_FIELDS,
  triplex: RESIDENTIAL_MULTI_FIELDS,
  quad: RESIDENTIAL_MULTI_FIELDS,
  multifamily: MULTIFAMILY_FIELDS,
  hotel: HOTEL_FIELDS,
  marina: MARINA_FIELDS,
  self_storage: SELF_STORAGE_FIELDS,
  laundromat: LAUNDROMAT_FIELDS,
  retail: COMMERCIAL_FIELDS,
  office: OFFICE_FIELDS,
  industrial: INDUSTRIAL_FIELDS,
  medical_office: MEDICAL_OFFICE_FIELDS,
  mixed_use: MIXED_USE_FIELDS,
  business: BUSINESS_FIELDS,
  car_wash: CAR_WASH_FIELDS,
  golf_course: GOLF_COURSE_FIELDS,
  restaurant: RESTAURANT_FIELDS,
  rv_park: RV_PARK_FIELDS,
  shopping_center: SHOPPING_CENTER_FIELDS,
  mobile_home_park: MOBILE_HOME_PARK_FIELDS,
  parking: PARKING_FIELDS,
  data_center: DATA_CENTER_FIELDS,
  car_dealership: CAR_DEALERSHIP_FIELDS,
  gas_station: GAS_STATION_FIELDS,
  gym: GYM_FIELDS,
  daycare: DAYCARE_FIELDS,
  landscaping: LANDSCAPING_FIELDS,
  construction: CONSTRUCTION_FIELDS,
  accounting_firm: ACCOUNTING_FIRM_FIELDS,
};

/**
 * Get COA field definitions for an asset class.
 * Returns all standard fields; UI should also render custom lines.
 */
export function getCOAFields(assetClass: string): COAFieldDef[] {
  return COA_FIELD_REGISTRY[assetClass] ?? COMMERCIAL_FIELDS;
}

/**
 * Get fields grouped by their group property.
 */
export function getCOAFieldsGrouped(assetClass: string): Record<string, COAFieldDef[]> {
  const fields = getCOAFields(assetClass);
  const groups: Record<string, COAFieldDef[]> = {};
  for (const f of fields) {
    const g = f.group ?? 'General';
    if (!groups[g]) groups[g] = [];
    groups[g].push(f);
  }
  return groups;
}
