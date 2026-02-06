-- ═══════════════════════════════════════════════════════════════════════════════
-- MarinaMatch: Commercial Tenant UPGRADE Migration (targeted)
-- 
-- Your existing commercial_tenants table already covers ~85% of the plan.
-- This migration ONLY adds what's missing:
--   1. New columns on commercial_tenants
--   2. New repeatable lease_options table
--   3. New enums where needed
--
-- Existing tables preserved as-is:
--   - commercial_tenants (flat, adding columns)
--   - commercial_tenant_rent_schedule (already serves as rent steps)
--   - commercial_tenant_amendments
--   - commercial_tenant_scenarios
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ─── 1. New Enums ───────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE tenant_type AS ENUM ('national', 'regional', 'local', 'mom_pop');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE asset_class_template AS ENUM ('retail', 'office', 'industrial', 'marina', 'mixed_use', 'other');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE billing_frequency AS ENUM ('monthly', 'quarterly', 'annual');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE abatement_timing AS ENUM ('upfront', 'spread', 'custom');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE recovery_structure AS ENUM ('nnn', 'base_year_stop', 'expense_stop', 'mod_gross');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE utilities_responsibility AS ENUM ('landlord', 'tenant', 'submetered');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE option_type AS ENUM ('renewal', 'expansion', 'termination', 'rofr', 'rofo', 'other');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE rent_reset_method AS ENUM ('fixed_pct', 'fixed_amt', 'cpi', 'fmv', 'tbd');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE ti_structure_type AS ENUM ('landlord', 'tenant', 'shared');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE commission_type AS ENUM ('pct_total_rent', 'pct_base_year', 'flat');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE commission_timing AS ENUM ('upfront', 'spread', 'custom');
EXCEPTION WHEN duplicate_object THEN null; END $$;


-- ─── 2. Add missing columns to commercial_tenants ──────────────────────────
-- All nullable so existing records are unaffected.

-- Tenant identity
ALTER TABLE commercial_tenants ADD COLUMN IF NOT EXISTS tenant_type tenant_type;
ALTER TABLE commercial_tenants ADD COLUMN IF NOT EXISTS industry text;
ALTER TABLE commercial_tenants ADD COLUMN IF NOT EXISTS tenant_website text;

-- Space
ALTER TABLE commercial_tenants ADD COLUMN IF NOT EXISTS space_type text;  -- inline/endcap/pad/office/warehouse/other
ALTER TABLE commercial_tenants ADD COLUMN IF NOT EXISTS building text;

-- Dates
ALTER TABLE commercial_tenants ADD COLUMN IF NOT EXISTS possession_date date;

-- Classification / mode
ALTER TABLE commercial_tenants ADD COLUMN IF NOT EXISTS asset_class_template asset_class_template DEFAULT 'other';
ALTER TABLE commercial_tenants ADD COLUMN IF NOT EXISTS advanced_mode_enabled boolean DEFAULT false;

-- Financial extras
ALTER TABLE commercial_tenants ADD COLUMN IF NOT EXISTS billing_frequency billing_frequency DEFAULT 'monthly';
ALTER TABLE commercial_tenants ADD COLUMN IF NOT EXISTS abatement_timing abatement_timing DEFAULT 'upfront';
ALTER TABLE commercial_tenants ADD COLUMN IF NOT EXISTS breakpoint_type text DEFAULT 'natural';  -- 'natural' or 'artificial'
ALTER TABLE commercial_tenants ADD COLUMN IF NOT EXISTS true_up_month integer;  -- 1-12

-- NNN/CAM extras
ALTER TABLE commercial_tenants ADD COLUMN IF NOT EXISTS recovery_structure recovery_structure DEFAULT 'nnn';
ALTER TABLE commercial_tenants ADD COLUMN IF NOT EXISTS recon_month integer;  -- reconciliation month 1-12
ALTER TABLE commercial_tenants ADD COLUMN IF NOT EXISTS utilities_responsibility utilities_responsibility DEFAULT 'tenant';

-- TI / Commission extras  
-- (ti_allowance and ti_allowance_per_sf already exist)
ALTER TABLE commercial_tenants ADD COLUMN IF NOT EXISTS ti_structure ti_structure_type DEFAULT 'landlord';
ALTER TABLE commercial_tenants ADD COLUMN IF NOT EXISTS commission_type commission_type;
ALTER TABLE commercial_tenants ADD COLUMN IF NOT EXISTS commission_value numeric(10,2);
ALTER TABLE commercial_tenants ADD COLUMN IF NOT EXISTS commission_timing commission_timing DEFAULT 'upfront';
ALTER TABLE commercial_tenants ADD COLUMN IF NOT EXISTS amortize_ti boolean DEFAULT false;
ALTER TABLE commercial_tenants ADD COLUMN IF NOT EXISTS amortization_term_months integer;
ALTER TABLE commercial_tenants ADD COLUMN IF NOT EXISTS amortization_rate numeric(6,4);

-- Risk / Compliance
ALTER TABLE commercial_tenants ADD COLUMN IF NOT EXISTS internal_risk_rating integer;  -- 1-5
ALTER TABLE commercial_tenants ADD COLUMN IF NOT EXISTS underwriting_notes text;
ALTER TABLE commercial_tenants ADD COLUMN IF NOT EXISTS assignment_clause boolean DEFAULT false;
ALTER TABLE commercial_tenants ADD COLUMN IF NOT EXISTS sublease_clause boolean DEFAULT false;
ALTER TABLE commercial_tenants ADD COLUMN IF NOT EXISTS additional_insured boolean DEFAULT false;
ALTER TABLE commercial_tenants ADD COLUMN IF NOT EXISTS gl_limits text;

-- Role view tracking
ALTER TABLE commercial_tenants ADD COLUMN IF NOT EXISTS created_by_role text;  -- owner/investor/broker/etc


-- ─── 3. Create repeatable lease options table ──────────────────────────────
-- Your existing schema has flat renewal/termination/expansion fields.
-- This table allows N options of any type per tenant (institutional-grade).
-- The old flat fields still work for Simple mode / backward compat.

CREATE TABLE IF NOT EXISTS commercial_tenant_options (
  id character varying PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id character varying NOT NULL REFERENCES commercial_tenants(id) ON DELETE CASCADE,

  option_type option_type NOT NULL DEFAULT 'renewal',
  notice_months integer,
  option_term_months integer,
  rent_reset_method rent_reset_method DEFAULT 'tbd',
  rent_reset_value numeric(10,4),       -- the actual % or $ if applicable
  effective_date date,
  conditions text,
  assume_in_underwriting boolean DEFAULT false,

  sort_order integer DEFAULT 0,
  created_at timestamp DEFAULT now() NOT NULL,
  updated_at timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tenant_options_tenant ON commercial_tenant_options(tenant_id);


-- ─── 4. Done ────────────────────────────────────────────────────────────────
-- 
-- WHAT'S NOT CHANGED (already exists and works):
--   ✓ commercial_tenant_rent_schedule — already serves as rent steps
--   ✓ escalation fields (type, rate, amount, frequency, cpi_*)
--   ✓ security_deposit, letter_of_credit_amount, guarantor_*
--   ✓ percentage_rent_rate, natural_breakpoint, artificial_breakpoint
--   ✓ estimated_cam/tax/insurance_per_sf, cam_cap_percent, admin_fee_percent
--   ✓ renewal_options, renewal_term_years, renewal_notice_months (Simple mode)
--   ✓ termination/expansion option flat fields (Simple mode)
--   ✓ co-tenancy, go-dark, exclusive_use fields
--   ✓ ti_allowance, ti_allowance_per_sf, ti_delivery_condition
--   ✓ insurance limits, maintenance responsibilities
--   ✓ custom_fields jsonb (for future extensibility)
--   ✓ notes, lease_document_id, parse_confidence, etc.
--
-- BACKWARD COMPATIBILITY:
--   - All new columns are nullable with sensible defaults
--   - Existing records load unchanged
--   - Simple mode reads the old flat fields
--   - Advanced mode reads new columns + commercial_tenant_options table
--   - The old renewal_options/termination flat fields remain the "Simple mode" 
--     source; commercial_tenant_options is the "Advanced mode" source

COMMIT;
