-- Commercial Lease Engine Migration
-- Run this migration to create all tables.
-- Compatible with Postgres 14+.

-- ENUMS
DO $$ BEGIN
  CREATE TYPE cl_lease_type AS ENUM ('retail', 'office', 'industrial', 'other');
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  CREATE TYPE base_rent_mode AS ENUM ('PER_SF_YEAR', 'PER_MONTH', 'PER_YEAR');
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  CREATE TYPE cl_escalation_type AS ENUM ('NONE', 'FIXED_DOLLAR', 'FIXED_PER_SF', 'PERCENT', 'CPI');
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  CREATE TYPE charge_line_type AS ENUM ('RECOVERY_CAM', 'RECOVERY_TAX', 'RECOVERY_INSURANCE', 'RECOVERY_UTILITIES', 'MISC_INCOME', 'DISCOUNT', 'TI_AMORTIZATION');
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  CREATE TYPE charge_amount_mode AS ENUM ('FIXED_MONTHLY', 'PER_SF_MONTHLY');
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  CREATE TYPE abatement_type AS ENUM ('FREE_RENT', 'PERCENT_DISCOUNT', 'FIXED_CREDIT');
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  CREATE TYPE abatement_applies_to AS ENUM ('BASE_ONLY', 'BASE_PLUS_RECOVERIES', 'ALL_CHARGES');
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  CREATE TYPE sales_source AS ENUM ('ACTUAL', 'FORECAST');
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  CREATE TYPE percent_rent_timing AS ENUM ('MONTHLY', 'QUARTERLY', 'ANNUAL_TRUEUP');
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  CREATE TYPE breakpoint_type AS ENUM ('NATURAL', 'ARTIFICIAL');
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  CREATE TYPE year_basis AS ENUM ('CALENDAR', 'TENANT_FISCAL');
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  CREATE TYPE ti_allowance_mode AS ENUM ('PER_SF', 'FIXED_TOTAL');
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  CREATE TYPE ti_participation_mode AS ENUM ('NONE', 'PERCENT_ABOVE_ALLOWANCE', 'FIXED_CONTRIBUTION', 'COMBO');
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  CREATE TYPE ti_amortize_basis AS ENUM ('LANDLORD_ONLY', 'LANDLORD_PLUS_TENANT');
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  CREATE TYPE tenant_share_mode AS ENUM ('BY_SF', 'FIXED_PERCENT');
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  CREATE TYPE billing_timing AS ENUM ('MONTHLY_ESTIMATE', 'MONTHLY_WITH_ANNUAL_TRUEUP');
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  CREATE TYPE recovery_stop_type AS ENUM ('NONE', 'BASE_YEAR_STOP', 'EXPENSE_STOP_PER_SF');
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  CREATE TYPE recovery_category AS ENUM ('CAM', 'TAX', 'INSURANCE', 'UTILITIES', 'OTHER');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 1) commercial_leases
CREATE TABLE IF NOT EXISTS commercial_leases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL,
  tenant_name TEXT NOT NULL,
  lease_type cl_lease_type NOT NULL DEFAULT 'retail',
  suite TEXT,
  sf NUMERIC(14,2) NOT NULL DEFAULT 0,
  units INTEGER NOT NULL DEFAULT 1,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  commencement_date DATE NOT NULL,
  rent_commencement_date DATE,
  expiration_date DATE NOT NULL,
  security_deposit NUMERIC(14,2),
  fiscal_year_end_month INTEGER NOT NULL DEFAULT 12,
  notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_commercial_leases_project ON commercial_leases(project_id);

-- 2) lease_terms
CREATE TABLE IF NOT EXISTS lease_terms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lease_id UUID NOT NULL REFERENCES commercial_leases(id) ON DELETE CASCADE,
  term_index INTEGER NOT NULL DEFAULT 0,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  base_rent_mode base_rent_mode NOT NULL DEFAULT 'PER_SF_YEAR',
  base_rent_value NUMERIC(14,4) NOT NULL DEFAULT 0,
  escalation_type cl_escalation_type NOT NULL DEFAULT 'NONE',
  escalation_value NUMERIC(14,6) NOT NULL DEFAULT 0,
  escalation_cycle_months INTEGER NOT NULL DEFAULT 12,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_lease_terms_lease ON lease_terms(lease_id);

-- 3) lease_charge_lines
CREATE TABLE IF NOT EXISTS lease_charge_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lease_id UUID NOT NULL REFERENCES commercial_leases(id) ON DELETE CASCADE,
  line_name TEXT NOT NULL,
  line_type charge_line_type NOT NULL,
  amount_mode charge_amount_mode NOT NULL DEFAULT 'FIXED_MONTHLY',
  amount_value NUMERIC(14,4) NOT NULL DEFAULT 0,
  start_date DATE NOT NULL,
  end_date DATE,
  escalation_type cl_escalation_type DEFAULT 'NONE',
  escalation_value NUMERIC(14,6) DEFAULT 0,
  escalation_cycle_months INTEGER DEFAULT 12,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_lease_charge_lines_lease ON lease_charge_lines(lease_id);

-- 4) lease_abatements
CREATE TABLE IF NOT EXISTS lease_abatements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lease_id UUID NOT NULL REFERENCES commercial_leases(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  abatement_type abatement_type NOT NULL,
  value NUMERIC(14,6) NOT NULL DEFAULT 0,
  applies_to abatement_applies_to NOT NULL DEFAULT 'BASE_ONLY',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_lease_abatements_lease ON lease_abatements(lease_id);

-- 5) lease_sales
CREATE TABLE IF NOT EXISTS lease_sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lease_id UUID NOT NULL REFERENCES commercial_leases(id) ON DELETE CASCADE,
  month_end DATE NOT NULL,
  sales_amount NUMERIC(16,2) NOT NULL DEFAULT 0,
  source sales_source NOT NULL DEFAULT 'ACTUAL',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_lease_sales_lease ON lease_sales(lease_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_lease_sales_unique ON lease_sales(lease_id, month_end);

-- 6) lease_percent_rent_rules
CREATE TABLE IF NOT EXISTS lease_percent_rent_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lease_id UUID NOT NULL REFERENCES commercial_leases(id) ON DELETE CASCADE,
  timing percent_rent_timing NOT NULL DEFAULT 'ANNUAL_TRUEUP',
  breakpoint_type breakpoint_type NOT NULL DEFAULT 'NATURAL',
  artificial_breakpoint_amount NUMERIC(16,2),
  tiers_json JSONB NOT NULL DEFAULT '[{"threshold":0,"rate":0}]',
  trueup_year_basis year_basis NOT NULL DEFAULT 'CALENDAR',
  sales_growth_rate NUMERIC(8,6) DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_lease_percent_rent_lease ON lease_percent_rent_rules(lease_id);

-- 7) lease_ti_programs
CREATE TABLE IF NOT EXISTS lease_ti_programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lease_id UUID NOT NULL REFERENCES commercial_leases(id) ON DELETE CASCADE,
  allowance_mode ti_allowance_mode NOT NULL DEFAULT 'PER_SF',
  allowance_value NUMERIC(14,2) NOT NULL DEFAULT 0,
  landlord_cap_total NUMERIC(14,2),
  tenant_participation_mode ti_participation_mode NOT NULL DEFAULT 'NONE',
  tenant_participation_value NUMERIC(14,6),
  tenant_fixed_contribution NUMERIC(14,2),
  amortize_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  amortize_amount_basis ti_amortize_basis NOT NULL DEFAULT 'LANDLORD_ONLY',
  amortize_rate_annual NUMERIC(8,6),
  amortize_term_months INTEGER,
  amortize_start_month_end DATE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_lease_ti_programs_lease ON lease_ti_programs(lease_id);

-- 8) lease_ti_draws
CREATE TABLE IF NOT EXISTS lease_ti_draws (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ti_program_id UUID NOT NULL REFERENCES lease_ti_programs(id) ON DELETE CASCADE,
  draw_date DATE NOT NULL,
  amount NUMERIC(14,2) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_lease_ti_draws_program ON lease_ti_draws(ti_program_id);

-- 9) lease_recovery_models
CREATE TABLE IF NOT EXISTS lease_recovery_models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lease_id UUID NOT NULL REFERENCES commercial_leases(id) ON DELETE CASCADE,
  total_property_nra_sf NUMERIC(14,2),
  tenant_share_mode tenant_share_mode NOT NULL DEFAULT 'BY_SF',
  tenant_share_percent NUMERIC(8,6),
  billing_timing billing_timing NOT NULL DEFAULT 'MONTHLY_WITH_ANNUAL_TRUEUP',
  stop_year_basis year_basis NOT NULL DEFAULT 'CALENDAR',
  base_year INTEGER,
  grossup_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  grossup_occupancy_threshold NUMERIC(8,6),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_lease_recovery_models_lease ON lease_recovery_models(lease_id);

-- 10) lease_recovery_categories
CREATE TABLE IF NOT EXISTS lease_recovery_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recovery_model_id UUID NOT NULL REFERENCES lease_recovery_models(id) ON DELETE CASCADE,
  category recovery_category NOT NULL,
  stop_type recovery_stop_type NOT NULL DEFAULT 'NONE',
  base_year_amount_total NUMERIC(14,2),
  expense_stop_per_sf NUMERIC(14,4),
  annual_expense_forecast JSONB,
  annual_growth_rate NUMERIC(8,6),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_lease_recovery_cats_model ON lease_recovery_categories(recovery_model_id);

-- 11) lease_monthly_cashflows (computed cache)
CREATE TABLE IF NOT EXISTS lease_monthly_cashflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lease_id UUID NOT NULL REFERENCES commercial_leases(id) ON DELETE CASCADE,
  month_end DATE NOT NULL,
  base_rent NUMERIC(14,2) NOT NULL DEFAULT 0,
  recoveries_cam NUMERIC(14,2) NOT NULL DEFAULT 0,
  recoveries_tax NUMERIC(14,2) NOT NULL DEFAULT 0,
  recoveries_insurance NUMERIC(14,2) NOT NULL DEFAULT 0,
  recoveries_utilities NUMERIC(14,2) NOT NULL DEFAULT 0,
  misc_income NUMERIC(14,2) NOT NULL DEFAULT 0,
  discounts NUMERIC(14,2) NOT NULL DEFAULT 0,
  percent_rent NUMERIC(14,2) NOT NULL DEFAULT 0,
  ti_landlord_capex NUMERIC(14,2) NOT NULL DEFAULT 0,
  ti_tenant_contribution NUMERIC(14,2) NOT NULL DEFAULT 0,
  ti_amortization_charge NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_rent NUMERIC(14,2) NOT NULL DEFAULT 0,
  meta JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_cashflows_lease_month ON lease_monthly_cashflows(lease_id, month_end);
CREATE INDEX IF NOT EXISTS idx_cashflows_month ON lease_monthly_cashflows(month_end);

-- Scale indexes for 200+ tenants
CREATE INDEX IF NOT EXISTS idx_commercial_leases_project_active ON commercial_leases(project_id, active);
CREATE INDEX IF NOT EXISTS idx_commercial_leases_tenant_name ON commercial_leases(tenant_name);
-- Optional: pg_trgm for fast ILIKE search (run CREATE EXTENSION pg_trgm; first if not already enabled)
DO $$ BEGIN
  CREATE INDEX idx_commercial_leases_tenant_trgm ON commercial_leases USING gin (tenant_name gin_trgm_ops);
EXCEPTION WHEN undefined_object THEN
  RAISE NOTICE 'pg_trgm extension not available — ILIKE search will use sequential scan on tenant_name (still fine for <1000 rows). Run CREATE EXTENSION pg_trgm; to enable.';
END $$;
