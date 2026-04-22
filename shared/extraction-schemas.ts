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

// ─── Contract (LOI / PSA / ASA) extraction ──────────────────────────────────
// v1 is date-first: parties + money + deadlines + one legal-review flag.
// Schema is versioned so v2 clause extraction (reps & warranties, survival,
// indemnity caps) can layer in without a table migration.

export type ContractType = 'loi' | 'psa' | 'asa';

export interface ContractExtractionSchema {
  contract_type: ContractType;
  extraction_schema_version: 1;

  parties: {
    buyer?: string | null;
    seller?: string | null;
    property_address?: string | null;
    apn?: string | null;
  };

  money: {
    purchase_price?: number | null;
    earnest_money?: number | null;
    earnest_money_deadline?: string | null; // ISO date
  };

  dates: {
    effective_date?: string | null;
    inspection_end?: string | null;
    inspection_duration_days?: number | null;
    financing_deadline?: string | null;
    title_delivery?: string | null;
    title_objection?: string | null;
    survey_delivery?: string | null;
    survey_objection?: string | null;
    estoppel_delivery?: string | null;
    closing_date?: string | null;
    closing_offset_days?: number | null;
  };

  flags: {
    // true/false when the contract clearly speaks on assignment; null when
    // silent or ambiguous (which itself is a legal-review signal).
    assignment_allowed?: boolean | null;
  };
}

// Human-readable labels for each field_key stored in contract_extracted_dates.
// Used by the promote flow and the review UI — keeping labels centralized
// avoids drift between the extractor, the DB seed, and the React components.
export const CONTRACT_DATE_FIELDS: Array<{
  key: string;
  label: string;
  // Milestone mapping for promotion. 'custom' creates a custom milestone.
  milestoneType: 'dd_expiration' | 'closing' | 'financing_contingency' | 'inspection_deadline' | 'custom';
}> = [
  { key: 'effective_date',       label: 'Effective Date',              milestoneType: 'custom' },
  { key: 'earnest_money_deadline', label: 'Earnest Money Deadline',    milestoneType: 'custom' },
  { key: 'inspection_end',       label: 'Inspection / DD Period End',  milestoneType: 'dd_expiration' },
  { key: 'financing_deadline',   label: 'Financing Contingency',       milestoneType: 'financing_contingency' },
  { key: 'title_delivery',       label: 'Title Commitment Delivery',   milestoneType: 'custom' },
  { key: 'title_objection',      label: 'Title Objection Deadline',    milestoneType: 'custom' },
  { key: 'survey_delivery',      label: 'Survey Delivery',             milestoneType: 'custom' },
  { key: 'survey_objection',     label: 'Survey Objection Deadline',   milestoneType: 'custom' },
  { key: 'estoppel_delivery',    label: 'Estoppel Delivery',           milestoneType: 'custom' },
  { key: 'closing_date',         label: 'Closing Date',                milestoneType: 'closing' },
];
