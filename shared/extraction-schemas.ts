export interface PLExtractionSchema {
  property_name?: string;
  property_address?: string;
  reporting_period?: string;
  period_start?: string;
  period_end?: string;
  currency?: string;
  reporting_basis?: 'cash' | 'accrual';

  gross_potential_rent: number | null;
  vacancy_loss: number | null;
  concessions: number | null;
  bad_debt: number | null;
  effective_gross_income: number | null;

  parking_income?: number | null;
  laundry_income?: number | null;
  late_fees?: number | null;
  pet_fees?: number | null;
  storage_income?: number | null;
  utility_reimbursements?: number | null;
  other_income_line_items?: Array<{ label: string; amount: number }>;
  total_other_income: number | null;
  total_revenue: number | null;

  management_fees?: number | null;
  payroll?: number | null;
  repairs_maintenance?: number | null;
  contract_services?: number | null;
  utilities?: number | null;
  insurance?: number | null;
  real_estate_taxes?: number | null;
  landscaping?: number | null;
  administrative?: number | null;
  advertising_marketing?: number | null;
  reserves?: number | null;
  other_expense_line_items?: Array<{ label: string; amount: number }>;
  total_operating_expenses: number | null;

  net_operating_income: number | null;

  mortgage_payment?: number | null;
  interest_expense?: number | null;
  principal_payment?: number | null;
  net_cash_flow?: number | null;

  monthly_breakdown?: Array<{
    period: string;
    effective_gross_income: number | null;
    total_operating_expenses: number | null;
    net_operating_income: number | null;
  }>;
}

export interface RentRollUnit {
  unit_number: string;
  unit_type?: string;
  sqft?: number;
  bedrooms?: number;
  bathrooms?: number;
  status: 'occupied' | 'vacant' | 'notice' | 'model' | 'down' | 'unknown';
  tenant_name?: string;
  lease_start?: string;
  lease_end?: string;
  lease_term_months?: number;
  market_rent?: number;
  contract_rent?: number;
  actual_rent_collected?: number;
  rent_per_sqft?: number;
  deposits?: number;
  balance_owed?: number;
  move_in_date?: string;
  move_out_date?: string;
  notes?: string;
}

export interface RentRollExtractionSchema {
  property_name?: string;
  property_address?: string;
  roll_date?: string;
  total_units?: number;
  total_sqft?: number;
  occupancy_rate?: number;
  occupied_units?: number;
  vacant_units?: number;
  total_potential_rent?: number;
  total_actual_rent?: number;
  units: RentRollUnit[];
  unit_mix?: Array<{
    type: string;
    count: number;
    avg_sqft: number;
    avg_market_rent: number;
    avg_contract_rent: number;
    occupancy_rate: number;
  }>;
}

export type ExtractionResult<T> = {
  data: Partial<T>;
  confidence_scores: Record<string, number>;
  source_references: Record<string, {
    page?: number;
    sheet?: string;
    row?: number;
    snippet?: string;
  }>;
  extraction_notes: string[];
  document_class_confirmed: string;
};
