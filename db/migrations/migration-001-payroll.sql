-- ============================================================================
-- MarinaMatch Payroll Module Migration
-- Run this AFTER your existing schema. Idempotent with IF NOT EXISTS.
-- ============================================================================

-- ─── ENUMS ──────────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE org_role AS ENUM ('ORG_OWNER','ORG_ADMIN','ORG_MANAGER','ORG_MEMBER','ORG_VIEWER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE permission_scope_type AS ENUM ('ORG','PORTFOLIO','ASSET','VALUATION_MODEL');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE permission_level AS ENUM ('VIEW','EDIT','ADMIN');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE detail_level_max AS ENUM ('TOTALS_ONLY','DEPT_TOTALS','POSITION_LINES','EMPLOYEE_DETAIL');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE payroll_plan_type AS ENUM ('OPERATIONS_ACTUAL','OPERATIONS_BUDGET','SELLER_TRAILING','UNDERWRITING_PROFORMA','VALUATOR_ACTUALS_SNAPSHOT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE period_granularity AS ENUM ('WEEKLY','MONTHLY');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE burden_mode AS ENUM ('SIMPLE_PCT','ITEMIZED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE burden_item_type AS ENUM ('BENEFIT','TAX','WORKERS_COMP','OTHER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE burden_calc_method AS ENUM ('PCT_OF_BASE','PCT_OF_BASE_PLUS_BENEFITS','FLAT_PER_PERIOD','FLAT_PER_HOUR');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE role_group AS ENUM ('OPS','ADMIN','MGMT','MAINT','SEASONAL','OTHER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE asset_class AS ENUM ('MARINA','RETAIL','MULTIFAMILY','OTHER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE worker_type AS ENUM ('W2','CONTRACTOR_1099');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE employee_status AS ENUM ('ACTIVE','INACTIVE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE external_provider AS ENUM ('NONE','ADP','PAYCHEX','OTHER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE pay_type AS ENUM ('SALARY','HOURLY');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE bonus_type AS ENUM ('FIXED','PCT_SALARY','PERFORMANCE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE kpi_key AS ENUM ('REVENUE','NOI','EBITDA','CUSTOM');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE sync_mode AS ENUM ('MANUAL');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE integration_provider AS ENUM ('ADP','PAYCHEX','OTHER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE integration_status AS ENUM ('DISCONNECTED','CONNECTED','ERROR');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE statement_section AS ENUM ('REVENUE','COGS','OPEX','OTHER_INCOME','OTHER_EXPENSE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE pnl_source AS ENUM ('QUICKBOOKS','UPLOAD','MANUAL','MODEL');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE allocation_mode AS ENUM ('NONE','PCT_SPLIT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE valuator_pnl_source AS ENUM ('SELLER','UNDERWRITING','OPS_SYNC','MANUAL');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE seasonality_type AS ENUM ('SUMMER_HIGH','SHOULDER','WINTER_LOW','CUSTOM');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── PERMISSIONS ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS payroll_permission_grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  granted_to_user_id UUID NOT NULL,
  granted_by_user_id UUID NOT NULL,
  scope_type permission_scope_type NOT NULL,
  scope_id UUID,
  permission_level permission_level NOT NULL DEFAULT 'VIEW',
  detail_level_max detail_level_max NOT NULL DEFAULT 'TOTALS_ONLY',
  can_export BOOLEAN NOT NULL DEFAULT FALSE,
  can_view_employee_names BOOLEAN NOT NULL DEFAULT FALSE,
  can_view_comp_rates BOOLEAN NOT NULL DEFAULT FALSE,
  can_view_bonus_detail BOOLEAN NOT NULL DEFAULT FALSE,
  can_view_all_assets BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_payroll_perm_grant
  ON payroll_permission_grants (org_id, granted_to_user_id, scope_type, scope_id);
CREATE INDEX IF NOT EXISTS idx_payroll_perm_granted_to ON payroll_permission_grants (granted_to_user_id);
CREATE INDEX IF NOT EXISTS idx_payroll_perm_org ON payroll_permission_grants (org_id);

-- ─── PAYROLL CORE ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS payroll_departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  name VARCHAR(255) NOT NULL,
  code VARCHAR(50),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payroll_profit_centers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  asset_id UUID,
  name VARCHAR(255) NOT NULL,
  code VARCHAR(50),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payroll_burden_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  name VARCHAR(255) NOT NULL,
  mode burden_mode NOT NULL DEFAULT 'SIMPLE_PCT',
  benefits_pct NUMERIC(8,6),
  taxes_pct NUMERIC(8,6),
  workers_comp_pct NUMERIC(8,6),
  other_burden_pct NUMERIC(8,6),
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payroll_burden_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  burden_profile_id UUID NOT NULL REFERENCES payroll_burden_profiles(id) ON DELETE CASCADE,
  item_type burden_item_type NOT NULL,
  name VARCHAR(255) NOT NULL,
  calc_method burden_calc_method NOT NULL,
  rate_numeric NUMERIC(12,6) NOT NULL,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS payroll_positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  title VARCHAR(255) NOT NULL,
  default_department_id UUID,
  role_group role_group NOT NULL DEFAULT 'OTHER',
  is_template BOOLEAN NOT NULL DEFAULT FALSE,
  asset_class asset_class NOT NULL DEFAULT 'MARINA',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payroll_employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  asset_id UUID,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  display_name VARCHAR(255),
  worker_type worker_type NOT NULL DEFAULT 'W2',
  status employee_status NOT NULL DEFAULT 'ACTIVE',
  external_provider external_provider NOT NULL DEFAULT 'NONE',
  external_employee_id VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payroll_emp_org ON payroll_employees (org_id);
CREATE INDEX IF NOT EXISTS idx_payroll_emp_asset ON payroll_employees (asset_id);

CREATE TABLE IF NOT EXISTS payroll_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  portfolio_id UUID,
  asset_id UUID,
  name VARCHAR(255) NOT NULL,
  plan_type payroll_plan_type NOT NULL,
  scenario_id UUID,
  is_source_of_truth_for_owned_model BOOLEAN NOT NULL DEFAULT FALSE,
  period_granularity period_granularity NOT NULL DEFAULT 'WEEKLY',
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  default_burden_profile_id UUID,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payroll_plan_org ON payroll_plans (org_id);
CREATE INDEX IF NOT EXISTS idx_payroll_plan_asset ON payroll_plans (asset_id);
CREATE INDEX IF NOT EXISTS idx_payroll_plan_portfolio ON payroll_plans (portfolio_id);

CREATE TABLE IF NOT EXISTS payroll_plan_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES payroll_plans(id) ON DELETE CASCADE,
  position_id UUID,
  employee_id UUID,
  department_id UUID NOT NULL,
  profit_center_id UUID,
  headcount NUMERIC(6,2) NOT NULL DEFAULT 1,
  pay_type pay_type NOT NULL,
  salary_annual NUMERIC(14,2),
  hourly_rate NUMERIC(10,4),
  hours_per_week NUMERIC(6,2),
  weeks_per_year NUMERIC(4,1),
  adjustments NUMERIC(14,2) NOT NULL DEFAULT 0,
  burden_profile_id UUID,
  notes TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payroll_line_plan ON payroll_plan_lines (plan_id);
CREATE INDEX IF NOT EXISTS idx_payroll_line_dept ON payroll_plan_lines (department_id);

CREATE TABLE IF NOT EXISTS payroll_rate_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_line_id UUID NOT NULL REFERENCES payroll_plan_lines(id) ON DELETE CASCADE,
  effective_date DATE NOT NULL,
  salary_annual_new NUMERIC(14,2),
  hourly_rate_new NUMERIC(10,4),
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rate_event_line ON payroll_rate_events (plan_line_id);

CREATE TABLE IF NOT EXISTS payroll_weekly_hours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_line_id UUID NOT NULL REFERENCES payroll_plan_lines(id) ON DELETE CASCADE,
  week_start_date DATE NOT NULL,
  hours NUMERIC(8,2) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_weekly_hours_line_week ON payroll_weekly_hours (plan_line_id, week_start_date);

CREATE TABLE IF NOT EXISTS payroll_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_line_id UUID NOT NULL REFERENCES payroll_plan_lines(id) ON DELETE CASCADE,
  asset_id UUID,
  department_id UUID,
  profit_center_id UUID,
  allocation_pct NUMERIC(6,4) NOT NULL,
  allocation_notes TEXT
);

CREATE TABLE IF NOT EXISTS payroll_bonus_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_line_id UUID,
  employee_id UUID,
  position_id UUID,
  bonus_type bonus_type NOT NULL,
  amount_numeric NUMERIC(14,2),
  pct_numeric NUMERIC(8,6),
  kpi_key kpi_key,
  custom_kpi_name TEXT,
  pay_date DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bonus_line ON payroll_bonus_events (plan_line_id);
CREATE INDEX IF NOT EXISTS idx_bonus_date ON payroll_bonus_events (pay_date);

CREATE TABLE IF NOT EXISTS valuation_model_payroll_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  valuation_model_id UUID NOT NULL,
  operations_plan_id UUID NOT NULL,
  valuator_actuals_plan_id UUID,
  sync_mode sync_mode NOT NULL DEFAULT 'MANUAL',
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payroll_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  provider integration_provider NOT NULL,
  status integration_status NOT NULL DEFAULT 'DISCONNECTED',
  access_token_encrypted TEXT,
  refresh_token_encrypted TEXT,
  token_expires_at TIMESTAMPTZ,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS seasonality_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  name VARCHAR(255) NOT NULL,
  season_type seasonality_type NOT NULL,
  weekly_hours_pattern JSONB NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── P&L BRIDGE TABLES ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS pnl_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  statement_section statement_section NOT NULL,
  category_name VARCHAR(255) NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pnl_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  category_id UUID NOT NULL REFERENCES pnl_categories(id) ON DELETE CASCADE,
  line_item_name VARCHAR(255) NOT NULL,
  is_dept_assignable BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pnl_department_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  source_type pnl_source NOT NULL,
  source_line_item_key VARCHAR(500) NOT NULL,
  department_id UUID,
  profit_center_id UUID,
  allocation_mode allocation_mode NOT NULL DEFAULT 'NONE',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pnl_department_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mapping_id UUID NOT NULL REFERENCES pnl_department_mappings(id) ON DELETE CASCADE,
  department_id UUID NOT NULL,
  allocation_pct NUMERIC(6,4) NOT NULL
);

CREATE TABLE IF NOT EXISTS pnl_actuals_values (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  asset_id UUID NOT NULL,
  period_start_date DATE NOT NULL,
  statement_section statement_section NOT NULL,
  category_id UUID,
  line_item_id UUID,
  amount NUMERIC(16,2) NOT NULL,
  source pnl_source NOT NULL,
  source_line_item_key VARCHAR(500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pnl_actuals_asset_period ON pnl_actuals_values (asset_id, period_start_date);

CREATE TABLE IF NOT EXISTS valuator_pnl_scenarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  valuation_model_id UUID NOT NULL,
  scenario_id UUID,
  scenario_name VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS valuator_pnl_values (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  valuation_model_id UUID NOT NULL,
  scenario_id UUID,
  asset_id UUID,
  period_start_date DATE NOT NULL,
  statement_section statement_section NOT NULL,
  category_id UUID,
  line_item_id UUID,
  amount NUMERIC(16,2) NOT NULL,
  source valuator_pnl_source NOT NULL,
  source_line_item_key VARCHAR(500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_valuator_pnl_model_period ON valuator_pnl_values (valuation_model_id, period_start_date);
