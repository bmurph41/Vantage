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
// STR (Short-Term Rental) — ~40 fields
// ---------------------------------------------------------------------------
const STR_FIELDS: COAFieldDef[] = [
  // Revenue Assumptions
  { key: 'avgNightlyRate', label: 'Avg Nightly Rate (ADR)', category: 'revenue', inputType: 'currency', hint: 'Blended average nightly rate', group: 'Revenue Assumptions' },
  { key: 'occupancy', label: 'Occupancy Rate', category: 'revenue', inputType: 'percent', hint: 'Annual occupancy %', group: 'Revenue Assumptions', defaultValue: 65 },
  { key: 'numberOfUnits', label: 'Number of Units', category: 'revenue', inputType: 'number', hint: 'Total rental units', group: 'Revenue Assumptions', defaultValue: 1 },
  { key: 'avgStayLengthNights', label: 'Avg Stay Length (nights)', category: 'revenue', inputType: 'number', hint: 'Average guest stay in nights', group: 'Revenue Assumptions' },
  { key: 'turnoversPerMonthCalc', label: 'Turnovers / Month (calc)', category: 'revenue', inputType: 'formula', hint: 'Auto-calculated from occupancy & avg stay length', group: 'Revenue Assumptions', dependsOn: ['occupancy', 'avgStayLengthNights'] },

  // Seasonal Rates
  { key: 'peakSeasonADR', label: 'Peak Season ADR', category: 'revenue', inputType: 'currency', hint: 'Nightly rate during peak season', group: 'Seasonal Rates', showWhen: 'nonzero' },
  { key: 'shoulderSeasonADR', label: 'Shoulder Season ADR', category: 'revenue', inputType: 'currency', hint: 'Nightly rate during shoulder season', group: 'Seasonal Rates', showWhen: 'nonzero' },
  { key: 'offSeasonADR', label: 'Off-Season ADR', category: 'revenue', inputType: 'currency', hint: 'Nightly rate during off season', group: 'Seasonal Rates', showWhen: 'nonzero' },

  // Guest Fees
  { key: 'cleaningFeePerTurnover', label: 'Cleaning Fee / Turnover', category: 'revenue', inputType: 'currency', hint: 'Cleaning fee charged to guest per stay', group: 'Guest Fees' },
  { key: 'petFeePerStay', label: 'Pet Fee / Stay', category: 'revenue', inputType: 'currency', hint: 'Pet fee charged per stay', group: 'Guest Fees', showWhen: 'nonzero' },
  { key: 'extraGuestFeePerNight', label: 'Extra Guest Fee / Night', category: 'revenue', inputType: 'currency', hint: 'Fee per additional guest per night', group: 'Guest Fees', showWhen: 'nonzero' },
  { key: 'earlyCheckinFee', label: 'Early Check-in Fee', category: 'revenue', inputType: 'currency', hint: 'Fee for early check-in', group: 'Guest Fees', showWhen: 'nonzero' },
  { key: 'lateCheckoutFee', label: 'Late Checkout Fee', category: 'revenue', inputType: 'currency', hint: 'Fee for late checkout', group: 'Guest Fees', showWhen: 'nonzero' },
  { key: 'parkingFeePerNight', label: 'Parking Fee / Night', category: 'revenue', inputType: 'currency', hint: 'Nightly parking fee', group: 'Guest Fees', showWhen: 'nonzero' },
  { key: 'damageWaiverFee', label: 'Damage Waiver Fee', category: 'revenue', inputType: 'currency', hint: 'Damage waiver charged per stay', group: 'Guest Fees', showWhen: 'nonzero' },

  // Other Revenue
  { key: 'experienceAddonRevenue', label: 'Experience / Add-on Revenue', category: 'revenue', inputType: 'currency', hint: 'Annual revenue from experiences & add-ons', group: 'Other Revenue', showWhen: 'nonzero' },

  // Platform Expenses
  { key: 'airbnbHostFeePct', label: 'Airbnb Host Fee %', category: 'expense', inputType: 'percent', hint: 'Airbnb host-only fee', group: 'Platform Expenses', defaultValue: 3, pctOf: 'revenue' },
  { key: 'vrboHostFeePct', label: 'VRBO Host Fee %', category: 'expense', inputType: 'percent', hint: 'VRBO host fee', group: 'Platform Expenses', defaultValue: 5, pctOf: 'revenue' },
  { key: 'directBookingPct', label: 'Direct Booking %', category: 'expense', inputType: 'percent', hint: 'Percentage of bookings that are direct', group: 'Distribution Mix', defaultValue: 15 },
  { key: 'paymentProcessingPct', label: 'Payment Processing %', category: 'expense', inputType: 'percent', hint: 'Credit card processing fee', group: 'Platform Expenses', defaultValue: 2.9, pctOf: 'revenue' },

  // Turnover Costs
  { key: 'cleaningCostPerTurn', label: 'Cleaning Cost / Turnover', category: 'expense', inputType: 'currency', hint: 'Cost to clean per turnover', group: 'Turnover Costs' },
  { key: 'laundryCostPerTurn', label: 'Laundry Cost / Turnover', category: 'expense', inputType: 'currency', hint: 'Laundry cost per turnover', group: 'Turnover Costs' },
  { key: 'consumablesPerTurn', label: 'Consumables / Turnover', category: 'expense', inputType: 'currency', hint: 'Toiletries, coffee, supplies per turnover', group: 'Turnover Costs' },
  { key: 'inspectionCostPerTurn', label: 'Inspection Cost / Turnover', category: 'expense', inputType: 'currency', hint: 'Quality inspection cost per turnover', group: 'Turnover Costs', showWhen: 'nonzero' },

  // Fixed Operating
  { key: 'pmsSoftwareMonthly', label: 'PMS Software (monthly)', category: 'expense', inputType: 'currency', hint: 'Property management software', group: 'Fixed Operating' },
  { key: 'channelManagerMonthly', label: 'Channel Manager (monthly)', category: 'expense', inputType: 'currency', hint: 'Channel manager subscription', group: 'Fixed Operating', showWhen: 'nonzero' },
  { key: 'smartLockMonthly', label: 'Smart Lock (monthly)', category: 'expense', inputType: 'currency', hint: 'Smart lock / access system', group: 'Fixed Operating', showWhen: 'nonzero' },
  { key: 'wifiMonthly', label: 'Wi-Fi (monthly)', category: 'expense', inputType: 'currency', hint: 'Internet service', group: 'Fixed Operating' },
  { key: 'streamingMonthly', label: 'Streaming Services (monthly)', category: 'expense', inputType: 'currency', hint: 'Netflix, etc.', group: 'Fixed Operating', showWhen: 'nonzero' },
  { key: 'utilitiesMonthly', label: 'Utilities (monthly)', category: 'expense', inputType: 'currency', hint: 'Electric, water, gas per month', group: 'Fixed Operating' },
  { key: 'lawnPoolMonthly', label: 'Lawn & Pool (monthly)', category: 'expense', inputType: 'currency', hint: 'Lawn care and pool service', group: 'Fixed Operating', showWhen: 'nonzero' },
  { key: 'pestControlMonthly', label: 'Pest Control (monthly)', category: 'expense', inputType: 'currency', hint: 'Monthly pest control', group: 'Fixed Operating', showWhen: 'nonzero' },
  { key: 'insuranceAnnual', label: 'Insurance (annual)', category: 'expense', inputType: 'currency', hint: 'Annual STR insurance premium', group: 'Fixed Operating' },
  { key: 'propertyTaxAnnual', label: 'Property Tax (annual)', category: 'expense', inputType: 'currency', hint: 'Annual property tax', group: 'Fixed Operating' },
  { key: 'hoaCondoMonthly', label: 'HOA / Condo Fees (monthly)', category: 'expense', inputType: 'currency', hint: 'Monthly HOA or condo dues', group: 'Fixed Operating', showWhen: 'nonzero' },
  { key: 'repairsMaintAnnual', label: 'Repairs & Maintenance (annual)', category: 'expense', inputType: 'currency', hint: 'Annual repairs & maintenance budget', group: 'Fixed Operating' },
  { key: 'furnishingReservePercent', label: 'Furnishing Reserve %', category: 'expense', inputType: 'percent', hint: 'Reserve for furniture replacement', group: 'Reserves', defaultValue: 5, pctOf: 'revenue' },
  { key: 'capexReservePercent', label: 'CapEx Reserve %', category: 'expense', inputType: 'percent', hint: 'Capital expenditure reserve', group: 'Reserves', defaultValue: 5, pctOf: 'revenue' },
];

// ---------------------------------------------------------------------------
// SFR (Single-Family Rental) — expanded with property details
// ---------------------------------------------------------------------------
const SFR_FIELDS: COAFieldDef[] = [
  // Property Details
  { key: 'bedrooms', label: 'Bedrooms', category: 'revenue', inputType: 'number', hint: 'Number of bedrooms', group: 'Property Details' },
  { key: 'bathrooms', label: 'Bathrooms', category: 'revenue', inputType: 'number', hint: 'Number of bathrooms', group: 'Property Details' },
  { key: 'sqFt', label: 'Square Feet', category: 'revenue', inputType: 'number', hint: 'Total livable SF', group: 'Property Details' },
  { key: 'yearBuilt', label: 'Year Built', category: 'revenue', inputType: 'number', hint: 'Year of construction', group: 'Property Details' },

  // Revenue
  { key: 'monthlyRent', label: 'Monthly Rent', category: 'revenue', inputType: 'currency', hint: 'Gross monthly rent', group: 'Revenue Assumptions' },
  { key: 'vacancyPct', label: 'Vacancy %', category: 'revenue', inputType: 'percent', hint: 'Annual vacancy %', group: 'Revenue Assumptions', defaultValue: 5 },
  { key: 'petFeeMonthly', label: 'Pet Fee (monthly)', category: 'revenue', inputType: 'currency', hint: 'Monthly pet rent', group: 'Other Revenue', showWhen: 'nonzero' },
  { key: 'parkingFeeMonthly', label: 'Parking Fee (monthly)', category: 'revenue', inputType: 'currency', hint: 'Monthly parking income', group: 'Other Revenue', showWhen: 'nonzero' },
  { key: 'annualOtherIncome', label: 'Other Income', category: 'revenue', inputType: 'currency', hint: 'Storage, laundry, etc.', group: 'Other Revenue', showWhen: 'nonzero' },

  // Expenses
  { key: 'propertyManagementPct', label: 'Property Management %', category: 'expense', inputType: 'percent', hint: '% of EGI', group: 'Operating Expenses', defaultValue: 0, pctOf: 'egi' },
  { key: 'maintenanceAnnual', label: 'Maintenance & Repairs (annual)', category: 'expense', inputType: 'currency', hint: 'Annual maintenance budget', group: 'Operating Expenses' },
  { key: 'landscapingAnnual', label: 'Landscaping (annual)', category: 'expense', inputType: 'currency', hint: 'Annual lawn care / landscaping', group: 'Operating Expenses', showWhen: 'nonzero' },
  { key: 'insuranceAnnual', label: 'Insurance (annual)', category: 'expense', inputType: 'currency', hint: 'Annual insurance premium', group: 'Fixed Expenses' },
  { key: 'propertyTaxAnnual', label: 'Property Tax (annual)', category: 'expense', inputType: 'currency', hint: 'Annual property tax', group: 'Fixed Expenses' },
  { key: 'hoaMonthly', label: 'HOA (monthly)', category: 'expense', inputType: 'currency', hint: 'Monthly HOA dues', group: 'Fixed Expenses', showWhen: 'nonzero' },
  { key: 'monthlyUtilities', label: 'Utilities (monthly)', category: 'expense', inputType: 'currency', hint: 'If landlord-paid', group: 'Operating Expenses', showWhen: 'nonzero' },
  { key: 'annualPestControl', label: 'Pest Control', category: 'expense', inputType: 'currency', hint: 'Annual pest control', group: 'Operating Expenses', showWhen: 'nonzero' },
  { key: 'capexReservePercent', label: 'CapEx Reserve %', category: 'expense', inputType: 'percent', hint: 'Capital expenditure reserve', group: 'Reserves', defaultValue: 5, pctOf: 'revenue' },
];

// ---------------------------------------------------------------------------
// Duplex / Triplex / Quad — expanded with property details
// ---------------------------------------------------------------------------
const RESIDENTIAL_MULTI_FIELDS: COAFieldDef[] = [
  // Property Details
  { key: 'bedrooms', label: 'Total Bedrooms (all units)', category: 'revenue', inputType: 'number', hint: 'Total bedrooms across all units', group: 'Property Details' },
  { key: 'bathrooms', label: 'Total Bathrooms (all units)', category: 'revenue', inputType: 'number', hint: 'Total bathrooms across all units', group: 'Property Details' },
  { key: 'sqFt', label: 'Total Square Feet', category: 'revenue', inputType: 'number', hint: 'Total livable SF', group: 'Property Details' },
  { key: 'yearBuilt', label: 'Year Built', category: 'revenue', inputType: 'number', hint: 'Year of construction', group: 'Property Details' },

  // Revenue
  { key: 'numberOfUnits', label: 'Number of Units', category: 'revenue', inputType: 'number', hint: 'Total units', group: 'Revenue Assumptions', defaultValue: 2 },
  { key: 'monthlyRent', label: 'Total Monthly Rent (all units)', category: 'revenue', inputType: 'currency', hint: 'Combined gross monthly rent', group: 'Revenue Assumptions' },
  { key: 'vacancyPct', label: 'Vacancy %', category: 'revenue', inputType: 'percent', hint: 'Annual vacancy %', group: 'Revenue Assumptions', defaultValue: 5 },
  { key: 'petFeeMonthly', label: 'Pet Fees (monthly, all units)', category: 'revenue', inputType: 'currency', hint: 'Monthly pet rent total', group: 'Other Revenue', showWhen: 'nonzero' },
  { key: 'parkingFeeMonthly', label: 'Parking Fees (monthly)', category: 'revenue', inputType: 'currency', hint: 'Monthly parking income', group: 'Other Revenue', showWhen: 'nonzero' },
  { key: 'annualLaundryIncome', label: 'Laundry Income', category: 'revenue', inputType: 'currency', hint: 'Coin-op laundry', group: 'Other Revenue', showWhen: 'nonzero' },
  { key: 'annualOtherIncome', label: 'Other Income', category: 'revenue', inputType: 'currency', hint: 'Storage, etc.', group: 'Other Revenue', showWhen: 'nonzero' },

  // Expenses
  { key: 'propertyManagementPct', label: 'Property Management %', category: 'expense', inputType: 'percent', hint: '% of EGI', group: 'Operating Expenses', defaultValue: 8, pctOf: 'egi' },
  { key: 'maintenanceAnnual', label: 'Maintenance & Repairs (annual)', category: 'expense', inputType: 'currency', hint: 'Annual maintenance', group: 'Operating Expenses' },
  { key: 'landscapingAnnual', label: 'Landscaping (annual)', category: 'expense', inputType: 'currency', hint: 'Annual landscaping', group: 'Operating Expenses', showWhen: 'nonzero' },
  { key: 'insuranceAnnual', label: 'Insurance (annual)', category: 'expense', inputType: 'currency', hint: 'Annual insurance', group: 'Fixed Expenses' },
  { key: 'propertyTaxAnnual', label: 'Property Tax (annual)', category: 'expense', inputType: 'currency', hint: 'Annual property tax', group: 'Fixed Expenses' },
  { key: 'hoaMonthly', label: 'HOA (monthly)', category: 'expense', inputType: 'currency', hint: 'Monthly HOA dues', group: 'Fixed Expenses', showWhen: 'nonzero' },
  { key: 'monthlyUtilities', label: 'Utilities (monthly)', category: 'expense', inputType: 'currency', hint: 'If landlord-paid', group: 'Operating Expenses' },
  { key: 'annualTrash', label: 'Trash / Waste Removal', category: 'expense', inputType: 'currency', hint: 'Annual trash service', group: 'Operating Expenses', showWhen: 'nonzero' },
  { key: 'annualPestControl', label: 'Pest Control', category: 'expense', inputType: 'currency', hint: 'Annual pest control', group: 'Operating Expenses', showWhen: 'nonzero' },
  { key: 'capexReservePercent', label: 'CapEx Reserve %', category: 'expense', inputType: 'percent', hint: 'Capital expenditure reserve', group: 'Reserves', defaultValue: 5, pctOf: 'revenue' },
];

// ---------------------------------------------------------------------------
// Multifamily — ~35 fields with per-unit metrics
// ---------------------------------------------------------------------------
const MULTIFAMILY_FIELDS: COAFieldDef[] = [
  // Revenue
  { key: 'totalUnits', label: 'Total Units', category: 'revenue', inputType: 'number', hint: 'Total apartment units', group: 'Revenue Assumptions' },
  { key: 'avgMarketRent', label: 'Avg Market Rent (monthly)', category: 'revenue', inputType: 'currency', hint: 'Current market rent per unit', group: 'Revenue Assumptions' },
  { key: 'avgInPlaceRent', label: 'Avg In-Place Rent (monthly)', category: 'revenue', inputType: 'currency', hint: 'Current average rent being collected', group: 'Revenue Assumptions' },
  { key: 'lossToLeasePct', label: 'Loss-to-Lease %', category: 'revenue', inputType: 'percent', hint: 'Gap between market and in-place rent', group: 'Revenue Assumptions', defaultValue: 3 },
  { key: 'vacancyPct', label: 'Vacancy %', category: 'revenue', inputType: 'percent', hint: 'Physical vacancy %', group: 'Revenue Assumptions', defaultValue: 5 },
  { key: 'concessionPct', label: 'Concessions %', category: 'revenue', inputType: 'percent', hint: 'Lease-up concessions as % of GPR', group: 'Revenue Assumptions', defaultValue: 0 },
  { key: 'badDebtPct', label: 'Bad Debt %', category: 'revenue', inputType: 'percent', hint: 'Uncollectable rent', group: 'Revenue Assumptions', defaultValue: 1 },

  // Other Revenue (per-unit)
  { key: 'parkingRevenuePerSpace', label: 'Parking Revenue / Space / Mo', category: 'revenue', inputType: 'currency', hint: 'Monthly parking income per space', group: 'Other Revenue', showWhen: 'nonzero' },
  { key: 'laundryRevenuePerUnit', label: 'Laundry Revenue / Unit / Mo', category: 'revenue', inputType: 'currency', hint: 'Coin-op laundry per unit', group: 'Other Revenue', showWhen: 'nonzero' },
  { key: 'petFeePerUnit', label: 'Pet Fee / Unit / Mo', category: 'revenue', inputType: 'currency', hint: 'Monthly pet rent per unit', group: 'Other Revenue', showWhen: 'nonzero' },
  { key: 'storageRevenuePerUnit', label: 'Storage Revenue / Unit / Mo', category: 'revenue', inputType: 'currency', hint: 'Storage unit income', group: 'Other Revenue', showWhen: 'nonzero' },
  { key: 'applicationFeePerUnit', label: 'Application Fee / Unit / Yr', category: 'revenue', inputType: 'currency', hint: 'Application fee income', group: 'Other Revenue', showWhen: 'nonzero' },
  { key: 'utilityReimbursementPerUnit', label: 'Utility Reimb / Unit / Mo', category: 'revenue', inputType: 'currency', hint: 'RUBS or sub-metered reimbursement', group: 'Other Revenue', showWhen: 'nonzero' },
  { key: 'trashValetPerUnit', label: 'Trash Valet / Unit / Mo', category: 'revenue', inputType: 'currency', hint: 'Valet trash service revenue', group: 'Other Revenue', showWhen: 'nonzero' },

  // Expenses (per-unit)
  { key: 'payrollPerUnit', label: 'Payroll / Unit / Year', category: 'expense', inputType: 'currency', hint: 'On-site staff cost per unit', group: 'Operating Expenses' },
  { key: 'repairsMaintPerUnit', label: 'Repairs & Maint / Unit / Year', category: 'expense', inputType: 'currency', hint: 'Per-unit maintenance budget', group: 'Operating Expenses' },
  { key: 'contractServicesPerUnit', label: 'Contract Services / Unit / Year', category: 'expense', inputType: 'currency', hint: 'Landscaping, pest, elevator, etc.', group: 'Operating Expenses', showWhen: 'nonzero' },
  { key: 'turnoverCostPerUnit', label: 'Turnover Cost / Unit', category: 'expense', inputType: 'currency', hint: 'Cost per unit turnover', group: 'Operating Expenses' },
  { key: 'makeReadyPerUnit', label: 'Make-Ready Cost / Unit', category: 'expense', inputType: 'currency', hint: 'Make-ready cost per unit turnover', group: 'Operating Expenses', showWhen: 'nonzero' },

  // Utilities per unit
  { key: 'waterSewerPerUnit', label: 'Water & Sewer / Unit / Mo', category: 'expense', inputType: 'currency', hint: 'Monthly water/sewer per unit', group: 'Utilities' },
  { key: 'electricPerUnit', label: 'Electric / Unit / Mo', category: 'expense', inputType: 'currency', hint: 'Monthly electric per unit (common area)', group: 'Utilities', showWhen: 'nonzero' },
  { key: 'gasPerUnit', label: 'Gas / Unit / Mo', category: 'expense', inputType: 'currency', hint: 'Monthly gas per unit (common area)', group: 'Utilities', showWhen: 'nonzero' },
  { key: 'trashRemovalPerUnit', label: 'Trash Removal / Unit / Mo', category: 'expense', inputType: 'currency', hint: 'Monthly trash per unit', group: 'Utilities' },

  // Annual expenses
  { key: 'landscapingAnnual', label: 'Landscaping (annual)', category: 'expense', inputType: 'currency', hint: 'Annual landscaping', group: 'Operating Expenses' },
  { key: 'pestControlAnnual', label: 'Pest Control (annual)', category: 'expense', inputType: 'currency', hint: 'Annual pest control', group: 'Operating Expenses', showWhen: 'nonzero' },
  { key: 'snowRemovalAnnual', label: 'Snow Removal (annual)', category: 'expense', inputType: 'currency', hint: 'Annual snow removal', group: 'Operating Expenses', showWhen: 'nonzero' },

  // Fixed Expenses
  { key: 'insurancePerUnit', label: 'Insurance / Unit / Year', category: 'expense', inputType: 'currency', hint: 'Insurance per unit', group: 'Fixed Expenses' },
  { key: 'propertyTaxAnnual', label: 'Property Tax (annual)', category: 'expense', inputType: 'currency', hint: 'Total annual property tax', group: 'Fixed Expenses' },
  { key: 'managementFeePct', label: 'Management Fee %', category: 'expense', inputType: 'percent', defaultValue: 5, pctOf: 'egi', group: 'Management' },
  { key: 'marketingPerUnit', label: 'Marketing / Unit / Year', category: 'expense', inputType: 'currency', hint: 'Marketing & advertising per unit', group: 'Operating Expenses', showWhen: 'nonzero' },
  { key: 'adminPerUnit', label: 'Admin / Unit / Year', category: 'expense', inputType: 'currency', hint: 'Admin & general per unit', group: 'Operating Expenses', showWhen: 'nonzero' },
  { key: 'legalAccountingAnnual', label: 'Legal & Accounting (annual)', category: 'expense', inputType: 'currency', hint: 'Annual legal and accounting', group: 'Operating Expenses', showWhen: 'nonzero' },
  { key: 'capexPerUnit', label: 'CapEx Reserve / Unit / Year', category: 'expense', inputType: 'currency', hint: 'Capital reserve per unit', group: 'Reserves' },
];

// ---------------------------------------------------------------------------
// Hotel — ~35 fields (USALI-aligned)
// ---------------------------------------------------------------------------
const HOTEL_FIELDS: COAFieldDef[] = [
  // Revenue
  { key: 'numberOfRooms', label: 'Total Rooms / Keys', category: 'revenue', inputType: 'number', hint: 'Total guest rooms', group: 'Revenue Assumptions' },
  { key: 'avgDailyRate', label: 'ADR (Average Daily Rate)', category: 'revenue', inputType: 'currency', hint: 'Average nightly room rate', group: 'Revenue Assumptions' },
  { key: 'occupancyRate', label: 'Occupancy Rate', category: 'revenue', inputType: 'percent', hint: 'Annual occupancy %', group: 'Revenue Assumptions', defaultValue: 65 },
  { key: 'revPAR', label: 'RevPAR (calc)', category: 'revenue', inputType: 'formula', hint: 'Revenue per available room (ADR x Occ)', group: 'Revenue Assumptions', dependsOn: ['avgDailyRate', 'occupancyRate'] },

  // Other Revenue
  { key: 'foodBevRevenue', label: 'Food & Beverage Revenue', category: 'revenue', inputType: 'currency', hint: 'Annual F&B revenue', group: 'F&B Revenue', showWhen: 'nonzero' },
  { key: 'meetingEventRevenue', label: 'Meeting / Event Revenue', category: 'revenue', inputType: 'currency', hint: 'Annual conference & event revenue', group: 'Other Revenue', showWhen: 'nonzero' },
  { key: 'spaWellnessRevenue', label: 'Spa & Wellness Revenue', category: 'revenue', inputType: 'currency', hint: 'Annual spa revenue', group: 'Other Revenue', showWhen: 'nonzero' },
  { key: 'parkingRevenue', label: 'Parking Revenue', category: 'revenue', inputType: 'currency', hint: 'Annual parking revenue', group: 'Other Revenue', showWhen: 'nonzero' },
  { key: 'golfRevenue', label: 'Golf Revenue', category: 'revenue', inputType: 'currency', hint: 'Annual golf revenue', group: 'Other Revenue', showWhen: 'nonzero' },
  { key: 'retailGiftShopRevenue', label: 'Retail / Gift Shop Revenue', category: 'revenue', inputType: 'currency', hint: 'Annual retail revenue', group: 'Other Revenue', showWhen: 'nonzero' },
  { key: 'otherOperatedRevenue', label: 'Other Operated Revenue', category: 'revenue', inputType: 'currency', hint: 'Telecom, business center, etc.', group: 'Other Revenue', showWhen: 'nonzero' },

  // Departmental Expenses
  { key: 'roomsExpensePct', label: 'Rooms Expense %', category: 'expense', inputType: 'percent', hint: '% of rooms revenue', group: 'Departmental Expenses', defaultValue: 25, pctOf: 'revenue' },
  { key: 'fbExpensePct', label: 'F&B Expense %', category: 'expense', inputType: 'percent', hint: '% of F&B revenue', group: 'Departmental Expenses', defaultValue: 70, pctOf: 'revenue' },
  { key: 'spaExpensePct', label: 'Spa Expense %', category: 'expense', inputType: 'percent', hint: '% of spa revenue', group: 'Departmental Expenses', defaultValue: 65, pctOf: 'revenue' },

  // Undistributed Expenses
  { key: 'adminGeneralPct', label: 'Admin & General %', category: 'expense', inputType: 'percent', hint: '% of total revenue', group: 'Undistributed Expenses', defaultValue: 7, pctOf: 'revenue' },
  { key: 'salesMarketingPct', label: 'Sales & Marketing %', category: 'expense', inputType: 'percent', hint: '% of total revenue', group: 'Undistributed Expenses', defaultValue: 5, pctOf: 'revenue' },
  { key: 'propertyOpsPct', label: 'Property Ops & Maintenance %', category: 'expense', inputType: 'percent', hint: '% of total revenue', group: 'Undistributed Expenses', defaultValue: 5, pctOf: 'revenue' },
  { key: 'utilitiesPct', label: 'Utilities %', category: 'expense', inputType: 'percent', hint: '% of total revenue', group: 'Undistributed Expenses', defaultValue: 4, pctOf: 'revenue' },
  { key: 'technologyPct', label: 'Technology %', category: 'expense', inputType: 'percent', hint: '% of total revenue (IT, PMS, POS)', group: 'Undistributed Expenses', defaultValue: 2, pctOf: 'revenue' },

  // Management
  { key: 'managementFeePct', label: 'Management Fee %', category: 'expense', inputType: 'percent', hint: '% of total revenue', group: 'Management', defaultValue: 3, pctOf: 'revenue' },

  // Fixed Charges
  { key: 'propertyTaxAnnual', label: 'Property Tax (annual)', category: 'expense', inputType: 'currency', hint: 'Annual property tax', group: 'Fixed Charges' },
  { key: 'insuranceAnnual', label: 'Insurance (annual)', category: 'expense', inputType: 'currency', hint: 'Annual insurance premium', group: 'Fixed Charges' },
  { key: 'groundLeaseAnnual', label: 'Ground Lease (annual)', category: 'expense', inputType: 'currency', hint: 'Annual ground lease payment', group: 'Fixed Charges', showWhen: 'nonzero' },

  // Reserves
  { key: 'ffAndEReservePct', label: 'FF&E Reserve %', category: 'expense', inputType: 'percent', hint: 'Furniture, fixtures & equipment reserve', group: 'Reserves', defaultValue: 4, pctOf: 'revenue' },
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
// Self Storage — ~30 fields
// ---------------------------------------------------------------------------
const SELF_STORAGE_FIELDS: COAFieldDef[] = [
  // Revenue
  { key: 'totalUnits', label: 'Total Units', category: 'revenue', inputType: 'number', hint: 'Total storage units', group: 'Revenue Assumptions' },
  { key: 'totalNetRentableSF', label: 'Total Net Rentable SF', category: 'revenue', inputType: 'number', hint: 'Total rentable square footage', group: 'Revenue Assumptions' },
  { key: 'avgMonthlyRentPerSF', label: 'Avg Monthly Rent / SF', category: 'revenue', inputType: 'currency', hint: '$/SF/month', group: 'Revenue Assumptions' },
  { key: 'economicOccupancy', label: 'Economic Occupancy', category: 'revenue', inputType: 'percent', hint: 'Economic (revenue) occupancy', group: 'Revenue Assumptions', defaultValue: 88 },

  // Ancillary Revenue
  { key: 'adminFeePerMoveIn', label: 'Admin Fee / Move-In', category: 'revenue', inputType: 'currency', hint: 'Admin fee per new tenant', group: 'Other Revenue' },
  { key: 'lateFeesPercent', label: 'Late Fees % of Revenue', category: 'revenue', inputType: 'percent', hint: 'Late fees as % of storage revenue', group: 'Other Revenue', defaultValue: 3 },
  { key: 'tenantInsurancePenetration', label: 'Tenant Insurance Penetration', category: 'revenue', inputType: 'percent', hint: '% of tenants purchasing insurance', group: 'Other Revenue', defaultValue: 35 },
  { key: 'insuranceRevenuePerPolicy', label: 'Insurance Revenue / Policy / Mo', category: 'revenue', inputType: 'currency', hint: 'Monthly revenue per insurance policy', group: 'Other Revenue' },
  { key: 'merchandiseRevenueAnnual', label: 'Merchandise Revenue (annual)', category: 'revenue', inputType: 'currency', hint: 'Boxes, locks, packing supplies', group: 'Other Revenue', showWhen: 'nonzero' },
  { key: 'truckRentalRevenueAnnual', label: 'Truck Rental Revenue (annual)', category: 'revenue', inputType: 'currency', hint: 'Truck rental commissions', group: 'Other Revenue', showWhen: 'nonzero' },

  // Expenses
  { key: 'onsiteManagerSalary', label: 'On-Site Manager Salary', category: 'expense', inputType: 'currency', hint: 'Annual manager salary', group: 'Operating Expenses' },
  { key: 'partTimeStaffCost', label: 'Part-Time Staff Cost (annual)', category: 'expense', inputType: 'currency', hint: 'Part-time / relief staff cost', group: 'Operating Expenses', showWhen: 'nonzero' },
  { key: 'managementFeePct', label: 'Management Fee %', category: 'expense', inputType: 'percent', defaultValue: 6, pctOf: 'egi', group: 'Management' },
  { key: 'marketingPerUnit', label: 'Marketing / Unit / Year', category: 'expense', inputType: 'currency', hint: 'Marketing & advertising per unit', group: 'Operating Expenses' },
  { key: 'utilitiesPerSF', label: 'Utilities / SF / Year', category: 'expense', inputType: 'currency', hint: 'Annual utility cost per SF', group: 'Operating Expenses' },
  { key: 'propertyTaxAnnual', label: 'Property Tax (annual)', category: 'expense', inputType: 'currency', hint: 'Annual property tax', group: 'Fixed Expenses' },
  { key: 'insuranceAnnual', label: 'Insurance (annual)', category: 'expense', inputType: 'currency', hint: 'Annual insurance premium', group: 'Fixed Expenses' },
  { key: 'repairsMaintPerUnit', label: 'Repairs & Maint / Unit / Year', category: 'expense', inputType: 'currency', hint: 'Per-unit maintenance budget', group: 'Operating Expenses' },
  { key: 'securityMonitoringMonthly', label: 'Security Monitoring (monthly)', category: 'expense', inputType: 'currency', hint: 'Cameras, access control, monitoring', group: 'Operating Expenses' },
  { key: 'softwarePmsMonthly', label: 'PMS Software (monthly)', category: 'expense', inputType: 'currency', hint: 'Property management software', group: 'Operating Expenses' },
  { key: 'badDebtPct', label: 'Bad Debt %', category: 'expense', inputType: 'percent', hint: 'Uncollectable as % of revenue', group: 'Operating Expenses', defaultValue: 2, pctOf: 'revenue' },
  { key: 'capexPerSF', label: 'CapEx Reserve / SF / Year', category: 'expense', inputType: 'currency', hint: 'Capital reserve per SF', group: 'Reserves' },
];

// ---------------------------------------------------------------------------
// Laundromat — ~25 fields
// ---------------------------------------------------------------------------
const LAUNDROMAT_FIELDS: COAFieldDef[] = [
  // Revenue
  { key: 'totalMachines', label: 'Total Machines', category: 'revenue', inputType: 'number', hint: 'Total washers + dryers', group: 'Revenue Assumptions' },
  { key: 'washerCount', label: 'Washer Count', category: 'revenue', inputType: 'number', hint: 'Number of washers', group: 'Revenue Assumptions' },
  { key: 'dryerCount', label: 'Dryer Count', category: 'revenue', inputType: 'number', hint: 'Number of dryers', group: 'Revenue Assumptions' },
  { key: 'avgVendPerWasherDaily', label: 'Avg Vend / Washer / Day', category: 'revenue', inputType: 'currency', hint: 'Daily vend revenue per washer', group: 'Revenue Assumptions' },
  { key: 'avgVendPerDryerDaily', label: 'Avg Vend / Dryer / Day', category: 'revenue', inputType: 'currency', hint: 'Daily vend revenue per dryer', group: 'Revenue Assumptions' },
  { key: 'washFoldRevenueMonthly', label: 'Wash & Fold Revenue (monthly)', category: 'revenue', inputType: 'currency', hint: 'Monthly wash/dry/fold service revenue', group: 'Other Revenue', showWhen: 'nonzero' },
  { key: 'vendingMachineMonthly', label: 'Vending Machine Revenue (monthly)', category: 'revenue', inputType: 'currency', hint: 'Soap, snack, drink vending', group: 'Other Revenue', showWhen: 'nonzero' },

  // Expenses
  { key: 'waterMonthly', label: 'Water (monthly)', category: 'expense', inputType: 'currency', hint: 'Monthly water bill', group: 'Utilities' },
  { key: 'gasMonthly', label: 'Gas (monthly)', category: 'expense', inputType: 'currency', hint: 'Monthly gas bill', group: 'Utilities' },
  { key: 'electricMonthly', label: 'Electric (monthly)', category: 'expense', inputType: 'currency', hint: 'Monthly electric bill', group: 'Utilities' },
  { key: 'sewerMonthly', label: 'Sewer (monthly)', category: 'expense', inputType: 'currency', hint: 'Monthly sewer bill', group: 'Utilities' },
  { key: 'rentOrMortgage', label: 'Rent / Mortgage (monthly)', category: 'expense', inputType: 'currency', hint: 'Monthly rent or mortgage', group: 'Fixed Expenses' },
  { key: 'attendantPayroll', label: 'Attendant Payroll (monthly)', category: 'expense', inputType: 'currency', hint: 'Monthly attendant wages', group: 'Operating Expenses' },
  { key: 'maintenancePartsMonthly', label: 'Maintenance & Parts (monthly)', category: 'expense', inputType: 'currency', hint: 'Machine maintenance & parts', group: 'Operating Expenses' },
  { key: 'ccProcessingPct', label: 'CC Processing %', category: 'expense', inputType: 'percent', hint: 'Credit card processing fee', group: 'Operating Expenses', defaultValue: 3, pctOf: 'revenue' },
  { key: 'insuranceAnnual', label: 'Insurance (annual)', category: 'expense', inputType: 'currency', hint: 'Annual insurance premium', group: 'Fixed Expenses' },
  { key: 'propertyTaxAnnual', label: 'Property Tax (annual)', category: 'expense', inputType: 'currency', hint: 'Annual property tax (if owned)', group: 'Fixed Expenses', showWhen: 'nonzero' },
  { key: 'annualSupplies', label: 'Supplies (annual)', category: 'expense', inputType: 'currency', hint: 'Cleaning supplies, bags, etc.', group: 'Operating Expenses', showWhen: 'nonzero' },
  { key: 'annualPestControl', label: 'Pest Control (annual)', category: 'expense', inputType: 'currency', hint: 'Annual pest control', group: 'Operating Expenses', showWhen: 'nonzero' },
  { key: 'annualMarketing', label: 'Marketing (annual)', category: 'expense', inputType: 'currency', hint: 'Signage, ads, etc.', group: 'Operating Expenses', showWhen: 'nonzero' },
  { key: 'annualTrash', label: 'Trash Removal (annual)', category: 'expense', inputType: 'currency', hint: 'Annual trash service', group: 'Operating Expenses', showWhen: 'nonzero' },
  { key: 'annualCapEx', label: 'Capital Reserves', category: 'expense', inputType: 'currency', hint: 'Machine replacement reserve', group: 'Reserves' },
];

// ---------------------------------------------------------------------------
// Commercial (Retail) — expanded ~25 fields with lease structure
// ---------------------------------------------------------------------------
const RETAIL_FIELDS: COAFieldDef[] = [
  // Revenue
  { key: 'totalSquareFeet', label: 'Total Rentable SF', category: 'revenue', inputType: 'number', hint: 'Gross leasable area', group: 'Revenue Assumptions' },
  { key: 'rentPerSF', label: 'Base Rent / SF / Year', category: 'revenue', inputType: 'currency', hint: '$/SF/yr', group: 'Revenue Assumptions' },
  { key: 'occupancyRate', label: 'Occupancy Rate', category: 'revenue', inputType: 'percent', hint: 'Current occupancy', group: 'Revenue Assumptions', defaultValue: 93 },
  { key: 'leaseType', label: 'Lease Type (1=Gross, 2=NNN, 3=Mod Gross)', category: 'revenue', inputType: 'number', hint: '1=Gross, 2=NNN, 3=Modified Gross', group: 'Lease Structure', defaultValue: 2 },
  { key: 'annualRentEscalation', label: 'Annual Rent Escalation %', category: 'revenue', inputType: 'percent', hint: 'Annual bumps', group: 'Lease Structure', defaultValue: 3 },
  { key: 'avgRemainingLeaseTerm', label: 'Avg Remaining Lease Term (yrs)', category: 'revenue', inputType: 'number', hint: 'WALT in years', group: 'Lease Structure' },

  // Reimbursements & Other
  { key: 'camReimbursementPerSF', label: 'CAM Reimbursement / SF / Yr', category: 'revenue', inputType: 'currency', hint: 'CAM pass-through per SF', group: 'Other Revenue' },
  { key: 'taxReimbursementPerSF', label: 'Tax Reimbursement / SF / Yr', category: 'revenue', inputType: 'currency', hint: 'Tax pass-through per SF', group: 'Other Revenue' },
  { key: 'insuranceReimbursementPerSF', label: 'Insurance Reimb / SF / Yr', category: 'revenue', inputType: 'currency', hint: 'Insurance pass-through per SF', group: 'Other Revenue' },
  { key: 'annualPercentageRent', label: 'Percentage Rent', category: 'revenue', inputType: 'currency', hint: 'Percentage rent above breakpoint', group: 'Other Revenue', showWhen: 'nonzero' },
  { key: 'annualOtherIncome', label: 'Other Income', category: 'revenue', inputType: 'currency', hint: 'Signage, antenna, etc.', group: 'Other Revenue', showWhen: 'nonzero' },

  // Expenses
  { key: 'propertyManagementPct', label: 'Management Fee %', category: 'expense', inputType: 'percent', defaultValue: 4, pctOf: 'egi', group: 'Management' },
  { key: 'camExpensePerSF', label: 'CAM Expense / SF / Year', category: 'expense', inputType: 'currency', hint: 'Common area maintenance cost', group: 'Operating Expenses' },
  { key: 'annualPropertyTax', label: 'Property Tax (annual)', category: 'expense', inputType: 'currency', group: 'Fixed Expenses' },
  { key: 'annualInsurance', label: 'Insurance (annual)', category: 'expense', inputType: 'currency', group: 'Fixed Expenses' },
  { key: 'annualMaintenance', label: 'Maintenance & Repairs', category: 'expense', inputType: 'currency', group: 'Operating Expenses' },
  { key: 'monthlyUtilities', label: 'Utilities (monthly)', category: 'expense', inputType: 'currency', hint: 'Landlord-paid utilities', group: 'Operating Expenses', showWhen: 'nonzero' },
  { key: 'annualJanitorial', label: 'Janitorial', category: 'expense', inputType: 'currency', group: 'Operating Expenses', showWhen: 'nonzero' },
  { key: 'annualSecurity', label: 'Security', category: 'expense', inputType: 'currency', group: 'Operating Expenses', showWhen: 'nonzero' },
  { key: 'tiAllowancePerSF', label: 'TI Allowance / SF (new lease)', category: 'expense', inputType: 'currency', hint: 'Tenant improvement allowance per SF', group: 'Leasing Costs' },
  { key: 'leasingCommissionPct', label: 'Leasing Commission %', category: 'expense', inputType: 'percent', hint: '% of total lease value', group: 'Leasing Costs', defaultValue: 5 },
  { key: 'annualCapEx', label: 'Capital Reserves', category: 'expense', inputType: 'currency', group: 'Reserves' },
];

// ---------------------------------------------------------------------------
// Office — expanded ~25 fields with lease structure
// ---------------------------------------------------------------------------
const OFFICE_FIELDS: COAFieldDef[] = [
  // Revenue
  { key: 'totalSquareFeet', label: 'Total Rentable SF', category: 'revenue', inputType: 'number', hint: 'Total rentable square footage', group: 'Revenue Assumptions' },
  { key: 'rentPerSF', label: 'Base Rent / SF / Year', category: 'revenue', inputType: 'currency', hint: '$/SF/yr', group: 'Revenue Assumptions' },
  { key: 'occupancyRate', label: 'Occupancy Rate', category: 'revenue', inputType: 'percent', hint: 'Current occupancy', group: 'Revenue Assumptions', defaultValue: 90 },
  { key: 'leaseType', label: 'Lease Type (1=Gross, 2=NNN, 3=Mod Gross)', category: 'revenue', inputType: 'number', hint: '1=Gross, 2=NNN, 3=Modified Gross', group: 'Lease Structure', defaultValue: 3 },
  { key: 'annualRentEscalation', label: 'Annual Rent Escalation %', category: 'revenue', inputType: 'percent', hint: 'Annual rent bumps', group: 'Lease Structure', defaultValue: 3 },
  { key: 'avgRemainingLeaseTerm', label: 'Avg Remaining Lease Term (yrs)', category: 'revenue', inputType: 'number', hint: 'WALT in years', group: 'Lease Structure' },

  // Reimbursements & Other
  { key: 'camReimbursementPerSF', label: 'CAM Reimbursement / SF / Yr', category: 'revenue', inputType: 'currency', hint: 'Expense stop pass-through', group: 'Other Revenue' },
  { key: 'annualParkingIncome', label: 'Parking Income', category: 'revenue', inputType: 'currency', group: 'Other Revenue', showWhen: 'nonzero' },
  { key: 'annualOtherIncome', label: 'Other Income', category: 'revenue', inputType: 'currency', hint: 'Storage, antenna, etc.', group: 'Other Revenue', showWhen: 'nonzero' },

  // Expenses
  { key: 'propertyManagementPct', label: 'Management Fee %', category: 'expense', inputType: 'percent', defaultValue: 4, pctOf: 'egi', group: 'Management' },
  { key: 'annualPayroll', label: 'Payroll / On-Site Staff', category: 'expense', inputType: 'currency', group: 'Operating Expenses' },
  { key: 'camExpensePerSF', label: 'CAM Expense / SF / Year', category: 'expense', inputType: 'currency', hint: 'Common area maintenance cost', group: 'Operating Expenses' },
  { key: 'annualPropertyTax', label: 'Property Tax (annual)', category: 'expense', inputType: 'currency', group: 'Fixed Expenses' },
  { key: 'annualInsurance', label: 'Insurance (annual)', category: 'expense', inputType: 'currency', group: 'Fixed Expenses' },
  { key: 'monthlyUtilities', label: 'Utilities (monthly)', category: 'expense', inputType: 'currency', group: 'Operating Expenses' },
  { key: 'annualJanitorial', label: 'Janitorial', category: 'expense', inputType: 'currency', group: 'Operating Expenses' },
  { key: 'annualMaintenance', label: 'Maintenance & Repairs', category: 'expense', inputType: 'currency', group: 'Operating Expenses' },
  { key: 'annualSecurity', label: 'Security', category: 'expense', inputType: 'currency', group: 'Operating Expenses', showWhen: 'nonzero' },
  { key: 'annualElevator', label: 'Elevator Maintenance', category: 'expense', inputType: 'currency', group: 'Operating Expenses', showWhen: 'nonzero' },
  { key: 'annualLandscaping', label: 'Landscaping', category: 'expense', inputType: 'currency', group: 'Operating Expenses', showWhen: 'nonzero' },
  { key: 'tiAllowancePerSF', label: 'TI Allowance / SF (new lease)', category: 'expense', inputType: 'currency', hint: 'Tenant improvement allowance per SF', group: 'Leasing Costs' },
  { key: 'leasingCommissionPct', label: 'Leasing Commission %', category: 'expense', inputType: 'percent', hint: '% of total lease value', group: 'Leasing Costs', defaultValue: 5 },
  { key: 'annualCapEx', label: 'Capital Reserves', category: 'expense', inputType: 'currency', group: 'Reserves' },
];

// ---------------------------------------------------------------------------
// Industrial — expanded ~22 fields with lease structure
// ---------------------------------------------------------------------------
const INDUSTRIAL_FIELDS: COAFieldDef[] = [
  // Revenue
  { key: 'totalSquareFeet', label: 'Total Rentable SF', category: 'revenue', inputType: 'number', hint: 'Total warehouse/industrial SF', group: 'Revenue Assumptions' },
  { key: 'rentPerSF', label: 'Base Rent / SF / Year', category: 'revenue', inputType: 'currency', hint: '$/SF/yr (typically NNN)', group: 'Revenue Assumptions' },
  { key: 'occupancyRate', label: 'Occupancy Rate', category: 'revenue', inputType: 'percent', hint: 'Current occupancy', group: 'Revenue Assumptions', defaultValue: 95 },
  { key: 'leaseType', label: 'Lease Type (1=Gross, 2=NNN, 3=Mod Gross)', category: 'revenue', inputType: 'number', hint: '1=Gross, 2=NNN, 3=Modified Gross', group: 'Lease Structure', defaultValue: 2 },
  { key: 'annualRentEscalation', label: 'Annual Rent Escalation %', category: 'revenue', inputType: 'percent', hint: 'Annual rent bumps', group: 'Lease Structure', defaultValue: 3 },
  { key: 'avgRemainingLeaseTerm', label: 'Avg Remaining Lease Term (yrs)', category: 'revenue', inputType: 'number', hint: 'WALT in years', group: 'Lease Structure' },

  // NNN Reimbursements
  { key: 'nnnReimbursementPerSF', label: 'NNN Reimbursement / SF / Yr', category: 'revenue', inputType: 'currency', hint: 'Tax, insurance, CAM pass-through', group: 'Other Revenue' },
  { key: 'annualOtherIncome', label: 'Other Income', category: 'revenue', inputType: 'currency', hint: 'Yard storage, signage, etc.', group: 'Other Revenue', showWhen: 'nonzero' },

  // Expenses
  { key: 'propertyManagementPct', label: 'Management Fee %', category: 'expense', inputType: 'percent', defaultValue: 3, pctOf: 'egi', group: 'Management' },
  { key: 'camExpensePerSF', label: 'CAM Expense / SF / Year', category: 'expense', inputType: 'currency', hint: 'Common area maintenance cost', group: 'Operating Expenses' },
  { key: 'annualPropertyTax', label: 'Property Tax (annual)', category: 'expense', inputType: 'currency', group: 'Fixed Expenses' },
  { key: 'annualInsurance', label: 'Insurance (annual)', category: 'expense', inputType: 'currency', group: 'Fixed Expenses' },
  { key: 'monthlyUtilities', label: 'Utilities (monthly)', category: 'expense', inputType: 'currency', hint: 'Landlord-paid portion', group: 'Operating Expenses', showWhen: 'nonzero' },
  { key: 'annualMaintenance', label: 'Maintenance & Repairs', category: 'expense', inputType: 'currency', group: 'Operating Expenses' },
  { key: 'annualRoofPaving', label: 'Roof & Paving Reserve', category: 'expense', inputType: 'currency', hint: 'Annual reserve for roof and parking lot', group: 'Operating Expenses', showWhen: 'nonzero' },
  { key: 'tiAllowancePerSF', label: 'TI Allowance / SF (new lease)', category: 'expense', inputType: 'currency', hint: 'Tenant improvement allowance', group: 'Leasing Costs' },
  { key: 'leasingCommissionPct', label: 'Leasing Commission %', category: 'expense', inputType: 'percent', hint: '% of total lease value', group: 'Leasing Costs', defaultValue: 4 },
  { key: 'annualCapEx', label: 'Capital Reserves', category: 'expense', inputType: 'currency', group: 'Reserves' },
];

// ---------------------------------------------------------------------------
// Medical Office — expanded ~24 fields with lease structure
// ---------------------------------------------------------------------------
const MEDICAL_OFFICE_FIELDS: COAFieldDef[] = [
  // Revenue
  { key: 'totalSquareFeet', label: 'Total Rentable SF', category: 'revenue', inputType: 'number', hint: 'Total MOB square footage', group: 'Revenue Assumptions' },
  { key: 'rentPerSF', label: 'Base Rent / SF / Year', category: 'revenue', inputType: 'currency', hint: '$/SF/yr', group: 'Revenue Assumptions' },
  { key: 'occupancyRate', label: 'Occupancy Rate', category: 'revenue', inputType: 'percent', hint: 'Current occupancy', group: 'Revenue Assumptions', defaultValue: 92 },
  { key: 'leaseType', label: 'Lease Type (1=Gross, 2=NNN, 3=Mod Gross)', category: 'revenue', inputType: 'number', hint: '1=Gross, 2=NNN, 3=Modified Gross', group: 'Lease Structure', defaultValue: 3 },
  { key: 'annualRentEscalation', label: 'Annual Rent Escalation %', category: 'revenue', inputType: 'percent', hint: 'Annual rent bumps', group: 'Lease Structure', defaultValue: 3 },
  { key: 'avgRemainingLeaseTerm', label: 'Avg Remaining Lease Term (yrs)', category: 'revenue', inputType: 'number', hint: 'WALT in years', group: 'Lease Structure' },

  // Reimbursements
  { key: 'camReimbursementPerSF', label: 'CAM Reimbursement / SF / Yr', category: 'revenue', inputType: 'currency', hint: 'Expense pass-through per SF', group: 'Other Revenue' },
  { key: 'annualOtherIncome', label: 'Other Income', category: 'revenue', inputType: 'currency', group: 'Other Revenue', showWhen: 'nonzero' },

  // Expenses
  { key: 'propertyManagementPct', label: 'Management Fee %', category: 'expense', inputType: 'percent', defaultValue: 5, pctOf: 'egi', group: 'Management' },
  { key: 'camExpensePerSF', label: 'CAM Expense / SF / Year', category: 'expense', inputType: 'currency', hint: 'Common area maintenance cost', group: 'Operating Expenses' },
  { key: 'annualPropertyTax', label: 'Property Tax (annual)', category: 'expense', inputType: 'currency', group: 'Fixed Expenses' },
  { key: 'annualInsurance', label: 'Insurance (annual)', category: 'expense', inputType: 'currency', group: 'Fixed Expenses' },
  { key: 'monthlyUtilities', label: 'Utilities (monthly)', category: 'expense', inputType: 'currency', group: 'Operating Expenses' },
  { key: 'annualJanitorial', label: 'Janitorial / Biohazard Disposal', category: 'expense', inputType: 'currency', group: 'Operating Expenses' },
  { key: 'annualMaintenance', label: 'Maintenance & Repairs', category: 'expense', inputType: 'currency', group: 'Operating Expenses' },
  { key: 'annualHVACMedical', label: 'HVAC / Medical-Grade Systems', category: 'expense', inputType: 'currency', hint: 'Specialized HVAC for medical use', group: 'Operating Expenses' },
  { key: 'annualSecurity', label: 'Security', category: 'expense', inputType: 'currency', group: 'Operating Expenses', showWhen: 'nonzero' },
  { key: 'annualLandscaping', label: 'Landscaping', category: 'expense', inputType: 'currency', group: 'Operating Expenses', showWhen: 'nonzero' },
  { key: 'tiAllowancePerSF', label: 'TI Allowance / SF (new lease)', category: 'expense', inputType: 'currency', hint: 'Medical TI typically higher', group: 'Leasing Costs' },
  { key: 'leasingCommissionPct', label: 'Leasing Commission %', category: 'expense', inputType: 'percent', hint: '% of total lease value', group: 'Leasing Costs', defaultValue: 5 },
  { key: 'annualCapEx', label: 'Capital Reserves', category: 'expense', inputType: 'currency', group: 'Reserves' },
];

// ---------------------------------------------------------------------------
// Business (SDE-based) — ~25 fields
// ---------------------------------------------------------------------------
const BUSINESS_FIELDS: COAFieldDef[] = [
  // Revenue
  { key: 'annualGrossRevenue', label: 'Annual Gross Revenue', category: 'revenue', inputType: 'currency', hint: 'Total annual revenue', group: 'Revenue' },
  { key: 'secondaryRevenue', label: 'Secondary Revenue', category: 'revenue', inputType: 'currency', hint: 'Secondary product/service revenue', group: 'Revenue', showWhen: 'nonzero' },
  { key: 'serviceRevenue', label: 'Service Revenue', category: 'revenue', inputType: 'currency', hint: 'Service-based revenue', group: 'Revenue', showWhen: 'nonzero' },

  // COGS
  { key: 'directMaterials', label: 'Direct Materials', category: 'expense', inputType: 'currency', hint: 'Raw materials & inventory', group: 'COGS' },
  { key: 'directLabor', label: 'Direct Labor', category: 'expense', inputType: 'currency', hint: 'Production labor costs', group: 'COGS' },
  { key: 'otherDirectCosts', label: 'Other Direct Costs', category: 'expense', inputType: 'currency', hint: 'Shipping, packaging, etc.', group: 'COGS', showWhen: 'nonzero' },

  // Operating Expenses
  { key: 'rentOccupancy', label: 'Rent / Occupancy', category: 'expense', inputType: 'currency', hint: 'Annual rent or occupancy cost', group: 'Operating Expenses' },
  { key: 'payrollBenefits', label: 'Payroll & Benefits', category: 'expense', inputType: 'currency', hint: 'Total staff payroll', group: 'Operating Expenses' },
  { key: 'utilities', label: 'Utilities', category: 'expense', inputType: 'currency', hint: 'Annual utility costs', group: 'Operating Expenses' },
  { key: 'insurance', label: 'Insurance', category: 'expense', inputType: 'currency', hint: 'Annual insurance', group: 'Operating Expenses' },
  { key: 'marketing', label: 'Marketing & Advertising', category: 'expense', inputType: 'currency', hint: 'Annual marketing spend', group: 'Operating Expenses' },
  { key: 'professionalFees', label: 'Professional Fees', category: 'expense', inputType: 'currency', hint: 'Legal, accounting, consulting', group: 'Operating Expenses' },
  { key: 'technology', label: 'Technology & Software', category: 'expense', inputType: 'currency', hint: 'Software, IT, subscriptions', group: 'Operating Expenses' },
  { key: 'vehicleTravel', label: 'Vehicle & Travel', category: 'expense', inputType: 'currency', hint: 'Vehicle, fuel, travel expenses', group: 'Operating Expenses', showWhen: 'nonzero' },
  { key: 'misc', label: 'Miscellaneous Expenses', category: 'expense', inputType: 'currency', hint: 'Other operating expenses', group: 'Operating Expenses', showWhen: 'nonzero' },

  // SDE Adjustments (add-backs)
  { key: 'ownerSalaryAddback', label: "Owner's Salary (add-back)", category: 'expense', inputType: 'currency', hint: 'Owner compensation to add back for SDE', group: 'SDE Adjustments' },
  { key: 'personalExpenseAddback', label: 'Personal Expenses (add-back)', category: 'expense', inputType: 'currency', hint: 'Personal expenses run through business', group: 'SDE Adjustments', showWhen: 'nonzero' },
  { key: 'oneTimeExpenseAddback', label: 'One-Time Expenses (add-back)', category: 'expense', inputType: 'currency', hint: 'Non-recurring expenses to add back', group: 'SDE Adjustments', showWhen: 'nonzero' },
];

// ---------------------------------------------------------------------------
// RV Park — ~30 fields
// ---------------------------------------------------------------------------
const RV_PARK_FIELDS: COAFieldDef[] = [
  // Revenue
  { key: 'totalSites', label: 'Total Sites', category: 'revenue', inputType: 'number', hint: 'Total RV sites', group: 'Revenue Assumptions' },
  { key: 'avgNightlyRate', label: 'Avg Nightly Rate', category: 'revenue', inputType: 'currency', hint: 'Transient nightly rate', group: 'Revenue Assumptions' },
  { key: 'avgWeeklyRate', label: 'Avg Weekly Rate', category: 'revenue', inputType: 'currency', hint: 'Weekly stay rate', group: 'Revenue Assumptions', showWhen: 'nonzero' },
  { key: 'avgMonthlyRate', label: 'Avg Monthly Rate', category: 'revenue', inputType: 'currency', hint: 'Monthly/seasonal rate', group: 'Revenue Assumptions' },
  { key: 'seasonalOccupancy', label: 'Seasonal Occupancy %', category: 'revenue', inputType: 'percent', hint: 'Peak season occupancy', group: 'Revenue Assumptions', defaultValue: 85 },
  { key: 'annualOccupancy', label: 'Annual Occupancy %', category: 'revenue', inputType: 'percent', hint: 'Blended annual occupancy', group: 'Revenue Assumptions', defaultValue: 65 },

  // Other Revenue
  { key: 'storeRevenue', label: 'Camp Store Revenue (annual)', category: 'revenue', inputType: 'currency', hint: 'Annual camp store sales', group: 'Other Revenue', showWhen: 'nonzero' },
  { key: 'propaneRevenue', label: 'Propane Revenue (annual)', category: 'revenue', inputType: 'currency', hint: 'Annual propane sales', group: 'Other Revenue', showWhen: 'nonzero' },
  { key: 'laundryRevenue', label: 'Laundry Revenue (annual)', category: 'revenue', inputType: 'currency', hint: 'Coin-op laundry income', group: 'Other Revenue', showWhen: 'nonzero' },
  { key: 'activityFeeRevenue', label: 'Activity / Amenity Fees (annual)', category: 'revenue', inputType: 'currency', hint: 'Activity & recreation fees', group: 'Other Revenue', showWhen: 'nonzero' },
  { key: 'wifiPremiumRevenue', label: 'Wi-Fi Premium Revenue (annual)', category: 'revenue', inputType: 'currency', hint: 'Premium Wi-Fi upgrade income', group: 'Other Revenue', showWhen: 'nonzero' },

  // Expenses — Staffing
  { key: 'parkManagerSalary', label: 'Park Manager Salary (annual)', category: 'expense', inputType: 'currency', hint: 'Annual park manager salary', group: 'Staffing' },
  { key: 'groundsCrewCost', label: 'Grounds Crew Cost (annual)', category: 'expense', inputType: 'currency', hint: 'Groundskeeping staff', group: 'Staffing' },
  { key: 'registrationStaffCost', label: 'Registration Staff Cost (annual)', category: 'expense', inputType: 'currency', hint: 'Front desk / check-in staff', group: 'Staffing', showWhen: 'nonzero' },

  // Operating
  { key: 'utilitiesPerSite', label: 'Utilities / Site / Month', category: 'expense', inputType: 'currency', hint: 'Water, electric, sewer per site', group: 'Operating Expenses' },
  { key: 'propaneCOGS', label: 'Propane COGS (annual)', category: 'expense', inputType: 'currency', hint: 'Cost of propane sold', group: 'COGS', showWhen: 'nonzero' },
  { key: 'storeCOGS', label: 'Store COGS (annual)', category: 'expense', inputType: 'currency', hint: 'Cost of store merchandise', group: 'COGS', showWhen: 'nonzero' },
  { key: 'trashRemovalAnnual', label: 'Trash Removal (annual)', category: 'expense', inputType: 'currency', hint: 'Annual trash & waste removal', group: 'Operating Expenses' },
  { key: 'roadMaintenanceAnnual', label: 'Road Maintenance (annual)', category: 'expense', inputType: 'currency', hint: 'Road & common area upkeep', group: 'Operating Expenses' },
  { key: 'poolMaintenanceAnnual', label: 'Pool Maintenance (annual)', category: 'expense', inputType: 'currency', hint: 'Pool & rec area maintenance', group: 'Operating Expenses', showWhen: 'nonzero' },

  // Fixed
  { key: 'insuranceAnnual', label: 'Insurance (annual)', category: 'expense', inputType: 'currency', hint: 'Annual insurance premium', group: 'Fixed Expenses' },
  { key: 'propertyTaxAnnual', label: 'Property Tax (annual)', category: 'expense', inputType: 'currency', hint: 'Annual property tax', group: 'Fixed Expenses' },
  { key: 'managementFeePct', label: 'Management Fee %', category: 'expense', inputType: 'percent', hint: '% of total revenue', group: 'Management', defaultValue: 5, pctOf: 'revenue' },
  { key: 'reservationSoftwareMonthly', label: 'Reservation Software (monthly)', category: 'expense', inputType: 'currency', hint: 'Campground PMS software', group: 'Operating Expenses' },
  { key: 'marketingAnnual', label: 'Marketing (annual)', category: 'expense', inputType: 'currency', hint: 'Annual marketing budget', group: 'Operating Expenses' },
  { key: 'annualCapEx', label: 'Capital Reserves', category: 'expense', inputType: 'currency', hint: 'Infrastructure / site improvement reserve', group: 'Reserves' },
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
  retail: RETAIL_FIELDS,
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
  return COA_FIELD_REGISTRY[assetClass] ?? RETAIL_FIELDS;
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
