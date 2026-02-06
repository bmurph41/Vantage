-- ═══════════════════════════════════════════════════════════════════════════════
-- MarinaMatch: Commercial Tenant Schema Migration
-- Upgrades existing modal to institutional-grade with backward compatibility
-- ═══════════════════════════════════════════════════════════════════════════════

-- IMPORTANT: This migration is additive only. No existing columns are dropped
-- or renamed. All new columns are nullable for backward compatibility.

BEGIN;

-- ─── 1. Create Enums ────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE tenant_type AS ENUM ('national', 'regional', 'local', 'mom_pop');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE tenant_status AS ENUM ('active', 'proposed', 'terminated', 'expired');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE asset_class_template AS ENUM ('retail', 'office', 'industrial', 'marina', 'mixed_use', 'other');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE lease_type_enum AS ENUM ('gross', 'mod_gross', 'nnn', 'base_year_stop', 'expense_stop');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE rent_structure AS ENUM ('base_only', 'base_plus_percent', 'percent_only', 'steps', 'cpi', 'hybrid');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE rent_input_unit AS ENUM ('psf_year', 'per_month', 'per_year');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE billing_frequency AS ENUM ('monthly', 'quarterly', 'annual');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE escalation_type AS ENUM ('none', 'fixed_pct', 'fixed_amt', 'cpi', 'fmv');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE abatement_timing AS ENUM ('upfront', 'spread', 'custom');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE deposit_type AS ENUM ('none', 'cash', 'loc', 'corp_guarantee', 'personal_guarantee', 'other');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE breakpoint_type AS ENUM ('natural', 'artificial');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE recovery_structure AS ENUM ('nnn', 'base_year_stop', 'expense_stop', 'mod_gross');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE option_type AS ENUM ('renewal', 'expansion', 'termination', 'rofr', 'rofo', 'other');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE rent_reset_method AS ENUM ('fixed_pct', 'fixed_amt', 'cpi', 'fmv', 'tbd');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE ti_structure AS ENUM ('landlord', 'tenant', 'shared');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE commission_type AS ENUM ('pct_total_rent', 'pct_base_year', 'flat');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE commission_timing AS ENUM ('upfront', 'spread', 'custom');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE utilities_responsibility AS ENUM ('landlord', 'tenant', 'submetered');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE custom_field_type AS ENUM ('string', 'number', 'date', 'bool', 'select', 'json');
EXCEPTION WHEN duplicate_object THEN null; END $$;


-- ─── 2. Add columns to existing commercial_tenants (if table exists) ─────────

-- If your existing table has different column names, adjust accordingly.
-- These ALTER TABLE commands are safe: they only ADD columns.

ALTER TABLE commercial_tenants
  ADD COLUMN IF NOT EXISTS tenant_type tenant_type,
  ADD COLUMN IF NOT EXISTS industry text,
  ADD COLUMN IF NOT EXISTS primary_contact_id uuid,
  ADD COLUMN IF NOT EXISTS tenant_website text,
  ADD COLUMN IF NOT EXISTS status tenant_status DEFAULT 'active';


-- ─── 3. Create commercial_leases table ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS commercial_leases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES commercial_tenants(id) ON DELETE CASCADE,

  -- Space
  suite_unit text,
  building text,
  square_feet numeric,
  pro_rata_share_pct numeric,
  space_type text,
  parking_allocation text,

  -- Dates
  commencement_date date NOT NULL,
  rent_start_date date,
  expiration_date date NOT NULL,
  possession_date date,

  -- Classification
  asset_class_template asset_class_template DEFAULT 'other',
  lease_type lease_type_enum DEFAULT 'nnn',
  rent_structure rent_structure DEFAULT 'base_only',
  advanced_mode_enabled boolean DEFAULT false,

  -- Use & Clauses
  permitted_use text,
  exclusive_use boolean DEFAULT false,
  exclusive_use_text text,
  go_dark_right boolean DEFAULT false,
  go_dark_conditions text,
  co_tenancy boolean DEFAULT false,
  co_tenancy_conditions text,

  -- Extensibility
  meta jsonb,

  created_at timestamp DEFAULT now() NOT NULL,
  updated_at timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_commercial_leases_tenant ON commercial_leases(tenant_id);


-- ─── 4. Create lease_rent_terms table ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS lease_rent_terms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lease_id uuid NOT NULL REFERENCES commercial_leases(id) ON DELETE CASCADE,

  rent_input_unit rent_input_unit DEFAULT 'psf_year',
  base_rent_amount numeric NOT NULL,
  billing_frequency billing_frequency DEFAULT 'monthly',

  escalation_type escalation_type DEFAULT 'none',
  escalation_rate numeric,
  escalation_frequency_months integer DEFAULT 12,
  cpi_cap numeric,
  cpi_floor numeric,

  rent_free_months integer DEFAULT 0,
  abatement_timing abatement_timing DEFAULT 'upfront',

  security_deposit_amount numeric,
  deposit_type deposit_type DEFAULT 'none',
  guarantee_expiration date
);

CREATE INDEX IF NOT EXISTS idx_lease_rent_terms_lease ON lease_rent_terms(lease_id);


-- ─── 5. Create lease_rent_steps table ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS lease_rent_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lease_id uuid NOT NULL REFERENCES commercial_leases(id) ON DELETE CASCADE,

  start_date date NOT NULL,
  end_date date,
  rent_amount numeric NOT NULL,
  rent_input_unit rent_input_unit DEFAULT 'psf_year',
  notes text,
  sort_order integer DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_lease_rent_steps_lease ON lease_rent_steps(lease_id);


-- ─── 6. Create lease_percentage_rent table ──────────────────────────────────

CREATE TABLE IF NOT EXISTS lease_percentage_rent (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lease_id uuid NOT NULL REFERENCES commercial_leases(id) ON DELETE CASCADE,

  percent_rent_rate numeric,
  breakpoint_type breakpoint_type DEFAULT 'natural',
  breakpoint_sales_threshold numeric,
  sales_reporting_frequency billing_frequency DEFAULT 'monthly',
  true_up_month integer,
  exclusions jsonb
);

CREATE INDEX IF NOT EXISTS idx_lease_pct_rent_lease ON lease_percentage_rent(lease_id);


-- ─── 7. Create lease_recoveries table ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS lease_recoveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lease_id uuid NOT NULL REFERENCES commercial_leases(id) ON DELETE CASCADE,

  recovery_structure recovery_structure DEFAULT 'nnn',

  cam_psf_year_est numeric,
  tax_psf_year_est numeric,
  ins_psf_year_est numeric,

  cam_cap_pct numeric,
  admin_fee_pct numeric,
  recon_month integer,
  audit_rights boolean DEFAULT false,

  exclude_capex boolean DEFAULT false,
  exclude_structural boolean DEFAULT false,
  exclude_mgmt_fee boolean DEFAULT false,
  exclusions jsonb,

  utilities_responsibility utilities_responsibility DEFAULT 'tenant'
);

CREATE INDEX IF NOT EXISTS idx_lease_recoveries_lease ON lease_recoveries(lease_id);


-- ─── 8. Create lease_options table ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS lease_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lease_id uuid NOT NULL REFERENCES commercial_leases(id) ON DELETE CASCADE,

  option_type option_type DEFAULT 'renewal',
  notice_months integer,
  option_term_months integer,
  rent_reset_method rent_reset_method DEFAULT 'tbd',
  conditions text,
  assume_in_underwriting boolean DEFAULT false,
  sort_order integer DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_lease_options_lease ON lease_options(lease_id);


-- ─── 9. Create lease_incentives table ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS lease_incentives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lease_id uuid NOT NULL REFERENCES commercial_leases(id) ON DELETE CASCADE,

  ti_structure ti_structure DEFAULT 'landlord',
  ti_budget numeric,
  ti_cap_psf numeric,
  ti_draw_schedule jsonb,

  commission_type commission_type,
  commission_value numeric,
  commission_timing commission_timing DEFAULT 'upfront',

  amortize_ti boolean DEFAULT false,
  amortization_term_months integer,
  amortization_rate numeric
);

CREATE INDEX IF NOT EXISTS idx_lease_incentives_lease ON lease_incentives(lease_id);


-- ─── 10. Create lease_custom_fields table ──────────────────────────────────

CREATE TABLE IF NOT EXISTS lease_custom_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lease_id uuid NOT NULL REFERENCES commercial_leases(id) ON DELETE CASCADE,

  field_key text NOT NULL,
  field_type custom_field_type NOT NULL,

  value_string text,
  value_number numeric,
  value_date date,
  value_bool boolean,
  value_json jsonb,

  visibility_roles jsonb,
  template_tags jsonb
);

CREATE INDEX IF NOT EXISTS idx_lease_custom_fields_lease ON lease_custom_fields(lease_id);
CREATE INDEX IF NOT EXISTS idx_lease_custom_fields_key ON lease_custom_fields(field_key);


COMMIT;
