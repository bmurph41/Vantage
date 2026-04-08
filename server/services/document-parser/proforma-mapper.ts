export const PL_TO_PROFORMA_MAP: Record<string, string> = {
  'gross_potential_rent': 'income.gross_potential_rent',
  'vacancy_loss': 'income.vacancy_credit',
  'concessions': 'income.concessions',
  'bad_debt': 'income.bad_debt',
  'effective_gross_income': 'income.effective_gross_income',
  'parking_income': 'income.other.parking',
  'laundry_income': 'income.other.laundry',
  'late_fees': 'income.other.late_fees',
  'pet_fees': 'income.other.pet_fees',
  'storage_income': 'income.other.storage',
  'utility_reimbursements': 'income.other.utility_reimbursements',
  'total_other_income': 'income.other_income_total',
  'total_revenue': 'income.total_revenue',
  'management_fees': 'expenses.management',
  'payroll': 'expenses.payroll',
  'repairs_maintenance': 'expenses.repairs_maintenance',
  'contract_services': 'expenses.contract_services',
  'utilities': 'expenses.utilities',
  'insurance': 'expenses.insurance',
  'real_estate_taxes': 'expenses.real_estate_taxes',
  'landscaping': 'expenses.landscaping',
  'administrative': 'expenses.administrative',
  'advertising_marketing': 'expenses.advertising_marketing',
  'reserves': 'expenses.reserves',
  'total_operating_expenses': 'expenses.total_opex',
  'net_operating_income': 'summary.noi',
  'mortgage_payment': 'debt.mortgage_payment',
  'interest_expense': 'debt.interest_expense',
  'net_cash_flow': 'summary.net_cash_flow',
};

export const RENT_ROLL_TO_PROFORMA_MAP: Record<string, string> = {
  'total_units': 'property.total_units',
  'occupancy_rate': 'property.current_occupancy',
  'total_actual_rent': 'income.gross_potential_rent',
  'total_potential_rent': 'income.potential_gross_rent',
  'total_sqft': 'property.total_sqft',
  'occupied_units': 'property.occupied_units',
  'vacant_units': 'property.vacant_units',
};

export const FIELD_DISPLAY_LABELS: Record<string, string> = {
  gross_potential_rent: 'Gross Potential Rent',
  vacancy_loss: 'Vacancy Loss',
  concessions: 'Concessions',
  bad_debt: 'Bad Debt',
  effective_gross_income: 'Effective Gross Income',
  parking_income: 'Parking Income',
  laundry_income: 'Laundry Income',
  late_fees: 'Late Fees',
  pet_fees: 'Pet Fees',
  storage_income: 'Storage Income',
  utility_reimbursements: 'Utility Reimbursements',
  total_other_income: 'Total Other Income',
  total_revenue: 'Total Revenue',
  management_fees: 'Management Fees',
  payroll: 'Payroll & Benefits',
  repairs_maintenance: 'Repairs & Maintenance',
  contract_services: 'Contract Services',
  utilities: 'Utilities',
  insurance: 'Insurance',
  real_estate_taxes: 'Real Estate Taxes',
  landscaping: 'Landscaping',
  administrative: 'Administrative',
  advertising_marketing: 'Advertising & Marketing',
  reserves: 'Reserves',
  total_operating_expenses: 'Total Operating Expenses',
  net_operating_income: 'Net Operating Income',
  mortgage_payment: 'Mortgage Payment',
  interest_expense: 'Interest Expense',
  principal_payment: 'Principal Payment',
  net_cash_flow: 'Net Cash Flow',
  total_units: 'Total Units',
  total_sqft: 'Total Square Footage',
  occupancy_rate: 'Occupancy Rate',
  occupied_units: 'Occupied Units',
  vacant_units: 'Vacant Units',
  total_actual_rent: 'Total Actual Rent',
  total_potential_rent: 'Total Potential Rent',
};

// ─── Extraction → modeling_actuals mapping ───────────────────────────────────
// Maps extraction schema_key to the actuals table format.
// `category` must be 'Revenue', 'COGS', or 'Expenses' (matches normalizeCategory).
// `subcategory` becomes the line item key in the Pro Forma engine.
// `isTotal` marks computed totals that should NOT be inserted as actuals
//   (the engine recomputes them from line items).

export interface ActualsMapping {
  category: string;
  subcategory: string;
  department?: string;
  isTotal?: boolean;
}

export const EXTRACTION_TO_ACTUALS_MAP: Record<string, ActualsMapping> = {
  // Revenue line items
  gross_potential_rent: { category: 'Revenue', subcategory: 'Gross Potential Rent', department: 'Revenue' },
  vacancy_loss: { category: 'Revenue', subcategory: 'Vacancy Loss', department: 'Revenue' },
  concessions: { category: 'Revenue', subcategory: 'Concessions', department: 'Revenue' },
  bad_debt: { category: 'Revenue', subcategory: 'Bad Debt', department: 'Revenue' },
  parking_income: { category: 'Revenue', subcategory: 'Parking Income', department: 'Revenue' },
  laundry_income: { category: 'Revenue', subcategory: 'Laundry Income', department: 'Revenue' },
  late_fees: { category: 'Revenue', subcategory: 'Late Fees', department: 'Revenue' },
  pet_fees: { category: 'Revenue', subcategory: 'Pet Fees', department: 'Revenue' },
  storage_income: { category: 'Revenue', subcategory: 'Storage Income', department: 'Revenue' },
  utility_reimbursements: { category: 'Revenue', subcategory: 'Utility Reimbursements', department: 'Revenue' },

  // Expense line items
  management_fees: { category: 'Expenses', subcategory: 'Management Fees', department: 'Operating Expenses' },
  payroll: { category: 'Expenses', subcategory: 'Payroll & Benefits', department: 'Operating Expenses' },
  repairs_maintenance: { category: 'Expenses', subcategory: 'Repairs & Maintenance', department: 'Operating Expenses' },
  contract_services: { category: 'Expenses', subcategory: 'Contract Services', department: 'Operating Expenses' },
  utilities: { category: 'Expenses', subcategory: 'Utilities', department: 'Operating Expenses' },
  insurance: { category: 'Expenses', subcategory: 'Insurance', department: 'Operating Expenses' },
  real_estate_taxes: { category: 'Expenses', subcategory: 'Real Estate Taxes', department: 'Operating Expenses' },
  landscaping: { category: 'Expenses', subcategory: 'Landscaping', department: 'Operating Expenses' },
  administrative: { category: 'Expenses', subcategory: 'Administrative', department: 'Operating Expenses' },
  advertising_marketing: { category: 'Expenses', subcategory: 'Advertising & Marketing', department: 'Operating Expenses' },
  reserves: { category: 'Expenses', subcategory: 'Reserves', department: 'Operating Expenses' },

  // Computed totals — DO NOT insert as actuals (engine recomputes from line items)
  effective_gross_income: { category: 'Revenue', subcategory: 'Effective Gross Income', isTotal: true },
  total_other_income: { category: 'Revenue', subcategory: 'Total Other Income', isTotal: true },
  total_revenue: { category: 'Revenue', subcategory: 'Total Revenue', isTotal: true },
  total_operating_expenses: { category: 'Expenses', subcategory: 'Total Operating Expenses', isTotal: true },
  net_operating_income: { category: 'Revenue', subcategory: 'Net Operating Income', isTotal: true },
  net_cash_flow: { category: 'Revenue', subcategory: 'Net Cash Flow', isTotal: true },

  // Debt (below-the-line) — stored for reference but not used in projections
  mortgage_payment: { category: 'Expenses', subcategory: 'Mortgage Payment', department: 'Debt Service', isTotal: true },
  interest_expense: { category: 'Expenses', subcategory: 'Interest Expense', department: 'Debt Service', isTotal: true },
  principal_payment: { category: 'Expenses', subcategory: 'Principal Payment', department: 'Debt Service', isTotal: true },
};

// Rent Roll fields that map to actuals (monthly rent → annualized revenue)
export const RENT_ROLL_TO_ACTUALS_MAP: Record<string, ActualsMapping> = {
  total_actual_rent: { category: 'Revenue', subcategory: 'Gross Potential Rent', department: 'Revenue' },
};

export const FIELD_GROUPS: Record<string, string> = {
  gross_potential_rent: 'income',
  vacancy_loss: 'income',
  concessions: 'income',
  bad_debt: 'income',
  effective_gross_income: 'income',
  parking_income: 'other_income',
  laundry_income: 'other_income',
  late_fees: 'other_income',
  pet_fees: 'other_income',
  storage_income: 'other_income',
  utility_reimbursements: 'other_income',
  total_other_income: 'other_income',
  total_revenue: 'income',
  management_fees: 'expenses',
  payroll: 'expenses',
  repairs_maintenance: 'expenses',
  contract_services: 'expenses',
  utilities: 'expenses',
  insurance: 'expenses',
  real_estate_taxes: 'expenses',
  landscaping: 'expenses',
  administrative: 'expenses',
  advertising_marketing: 'expenses',
  reserves: 'expenses',
  total_operating_expenses: 'expenses',
  net_operating_income: 'summary',
  mortgage_payment: 'debt',
  interest_expense: 'debt',
  principal_payment: 'debt',
  net_cash_flow: 'summary',
  total_units: 'summary',
  total_sqft: 'summary',
  occupancy_rate: 'summary',
  occupied_units: 'summary',
  vacant_units: 'summary',
  total_actual_rent: 'income',
  total_potential_rent: 'income',
};
