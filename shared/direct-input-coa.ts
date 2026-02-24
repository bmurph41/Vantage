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
  office: COMMERCIAL_FIELDS,
  industrial: COMMERCIAL_FIELDS,
  medical_office: COMMERCIAL_FIELDS,
  mixed_use: COMMERCIAL_FIELDS,
  business: BUSINESS_FIELDS,
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
