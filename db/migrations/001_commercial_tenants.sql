-- Commercial Tenants Migration
-- Creates tables for tenant lease modeling in Valuator
-- Run this migration to add commercial tenants support

-- ============================================
-- ENUMS
-- ============================================

DO $$ BEGIN
  CREATE TYPE lease_type AS ENUM ('NNN', 'MOD_GROSS', 'FULL_GROSS', 'ABSOLUTE_NNN', 'OTHER');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE lease_status AS ENUM ('ACTIVE', 'FUTURE', 'EXPIRING', 'EXPIRED', 'ARCHIVED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE security_deposit_type AS ENUM ('CASH', 'LOC', 'NONE');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE term_type AS ENUM ('INITIAL', 'OPTION');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE rent_input_unit AS ENUM ('PSF_YEAR', 'PER_MONTH', 'PER_YEAR');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE escalation_type AS ENUM ('NONE', 'PERCENT', 'FIXED_DOLLAR', 'DOLLAR_PSF_YEAR', 'CPI', 'CPI_CAP_FLOOR', 'SCHEDULE');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE recovery_type AS ENUM ('CAM', 'TAXES', 'INSURANCE', 'UTILITIES', 'TRASH', 'SECURITY', 'OTHER');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE recovery_method AS ENUM ('PRO_RATA', 'BASE_YEAR_STOP', 'EXPENSE_STOP_PSF', 'FIXED_MONTHLY', 'FIXED_ANNUAL');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE breakpoint_type AS ENUM ('NATURAL', 'ARTIFICIAL');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE settlement_frequency AS ENUM ('MONTHLY', 'QUARTERLY', 'ANNUAL');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE concession_type AS ENUM ('FREE_RENT', 'DISCOUNT_PERCENT', 'DISCOUNT_FIXED', 'OTHER');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE ti_payment_timing AS ENUM ('UPFRONT', 'REIMBURSEMENT', 'DRAW_SCHEDULE');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE lc_payment_timing AS ENUM ('AT_SIGNING', 'SPREAD');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ============================================
-- TABLES
-- ============================================

-- Main lease records
CREATE TABLE IF NOT EXISTS tenant_leases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL,
  
  -- Tenant info
  tenant_name TEXT NOT NULL,
  suite_label TEXT,
  sf NUMERIC(12, 2) NOT NULL,
  unit_count INTEGER,
  
  -- Lease classification
  lease_type lease_type NOT NULL DEFAULT 'NNN',
  
  -- Dates
  lease_start_date DATE NOT NULL,
  rent_commencement_date DATE,
  lease_end_date DATE NOT NULL,
  
  -- Security deposit
  security_deposit_amount NUMERIC(12, 2),
  security_deposit_type security_deposit_type DEFAULT 'NONE',
  
  -- Other
  notes TEXT,
  status lease_status NOT NULL DEFAULT 'ACTIVE',
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Initial term + option terms
CREATE TABLE IF NOT EXISTS tenant_rent_terms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lease_id UUID NOT NULL REFERENCES tenant_leases(id) ON DELETE CASCADE,
  
  -- Term identification
  term_type term_type NOT NULL DEFAULT 'INITIAL',
  option_index INTEGER,
  
  -- Term dates
  term_start_date DATE NOT NULL,
  term_end_date DATE NOT NULL,
  
  -- Base rent
  base_rent_input_unit rent_input_unit NOT NULL DEFAULT 'PSF_YEAR',
  base_rent_input_value NUMERIC(12, 4) NOT NULL,
  
  -- Escalations
  escalation_type escalation_type NOT NULL DEFAULT 'NONE',
  escalation_value NUMERIC(8, 4),
  escalation_frequency_months INTEGER,
  escalation_cap_percent NUMERIC(6, 4),
  escalation_floor_percent NUMERIC(6, 4),
  escalation_cpi_series TEXT,
  schedule_json JSONB,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- CAM, taxes, insurance, etc.
CREATE TABLE IF NOT EXISTS tenant_recoveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lease_id UUID NOT NULL REFERENCES tenant_leases(id) ON DELETE CASCADE,
  
  -- Recovery config
  recovery_type recovery_type NOT NULL,
  method recovery_method NOT NULL,
  
  -- Amounts
  amount NUMERIC(12, 2),
  psf_amount NUMERIC(8, 4),
  
  -- Adjustments
  admin_fee_percent NUMERIC(5, 2),
  gross_up_to_occupancy NUMERIC(5, 2),
  nonrecoverable_percent NUMERIC(5, 2),
  expense_growth_rate_percent NUMERIC(5, 2),
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Retail % rent configuration
CREATE TABLE IF NOT EXISTS tenant_percentage_rent (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lease_id UUID NOT NULL REFERENCES tenant_leases(id) ON DELETE CASCADE,
  
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  
  -- Breakpoint
  breakpoint_type breakpoint_type DEFAULT 'NATURAL',
  breakpoint_amount_annual NUMERIC(14, 2),
  
  -- Overage
  overage_percent NUMERIC(6, 4),
  settlement_frequency settlement_frequency DEFAULT 'MONTHLY',
  
  -- Exclusions
  exclusions_json JSONB,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Monthly sales data for % rent
CREATE TABLE IF NOT EXISTS tenant_sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lease_id UUID NOT NULL REFERENCES tenant_leases(id) ON DELETE CASCADE,
  
  period_end_date DATE NOT NULL,
  gross_sales NUMERIC(14, 2) NOT NULL,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Free rent, discounts, etc.
CREATE TABLE IF NOT EXISTS tenant_concessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lease_id UUID NOT NULL REFERENCES tenant_leases(id) ON DELETE CASCADE,
  
  concession_type concession_type NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  value NUMERIC(12, 2) NOT NULL,
  notes TEXT,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- TI and LC configurations
CREATE TABLE IF NOT EXISTS tenant_capex_leasing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lease_id UUID NOT NULL REFERENCES tenant_leases(id) ON DELETE CASCADE,
  
  -- Tenant Improvements
  ti_allowance_psf NUMERIC(8, 2),
  ti_total NUMERIC(12, 2),
  ti_payment_timing ti_payment_timing DEFAULT 'UPFRONT',
  
  -- Leasing Commissions
  lc_percent_initial NUMERIC(6, 4),
  lc_percent_renewal NUMERIC(6, 4),
  lc_payment_timing lc_payment_timing DEFAULT 'AT_SIGNING',
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Renewal and vacancy modeling
CREATE TABLE IF NOT EXISTS tenant_rollover_assumptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lease_id UUID NOT NULL REFERENCES tenant_leases(id) ON DELETE CASCADE,
  
  assume_renewal BOOLEAN NOT NULL DEFAULT FALSE,
  renewal_probability NUMERIC(5, 4),
  downtime_months INTEGER DEFAULT 0,
  
  -- Market rent assumptions
  market_rent_psf_year NUMERIC(10, 2),
  market_rent_growth_percent NUMERIC(5, 2),
  
  -- Renewal costs
  renewal_ti_psf NUMERIC(8, 2),
  renewal_lc_percent NUMERIC(6, 4),
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_tenant_leases_project_id ON tenant_leases(project_id);
CREATE INDEX IF NOT EXISTS idx_tenant_leases_status ON tenant_leases(status);
CREATE INDEX IF NOT EXISTS idx_tenant_leases_dates ON tenant_leases(lease_start_date, lease_end_date);
CREATE INDEX IF NOT EXISTS idx_tenant_rent_terms_lease_id ON tenant_rent_terms(lease_id);
CREATE INDEX IF NOT EXISTS idx_tenant_recoveries_lease_id ON tenant_recoveries(lease_id);
CREATE INDEX IF NOT EXISTS idx_tenant_percentage_rent_lease_id ON tenant_percentage_rent(lease_id);
CREATE INDEX IF NOT EXISTS idx_tenant_sales_lease_id ON tenant_sales(lease_id);
CREATE INDEX IF NOT EXISTS idx_tenant_sales_period ON tenant_sales(period_end_date);
CREATE INDEX IF NOT EXISTS idx_tenant_concessions_lease_id ON tenant_concessions(lease_id);
CREATE INDEX IF NOT EXISTS idx_tenant_capex_leasing_lease_id ON tenant_capex_leasing(lease_id);
CREATE INDEX IF NOT EXISTS idx_tenant_rollover_assumptions_lease_id ON tenant_rollover_assumptions(lease_id);

-- ============================================
-- TRIGGERS FOR updated_at
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_tenant_leases_updated_at ON tenant_leases;
CREATE TRIGGER update_tenant_leases_updated_at
  BEFORE UPDATE ON tenant_leases
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_tenant_rent_terms_updated_at ON tenant_rent_terms;
CREATE TRIGGER update_tenant_rent_terms_updated_at
  BEFORE UPDATE ON tenant_rent_terms
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_tenant_recoveries_updated_at ON tenant_recoveries;
CREATE TRIGGER update_tenant_recoveries_updated_at
  BEFORE UPDATE ON tenant_recoveries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_tenant_percentage_rent_updated_at ON tenant_percentage_rent;
CREATE TRIGGER update_tenant_percentage_rent_updated_at
  BEFORE UPDATE ON tenant_percentage_rent
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_tenant_sales_updated_at ON tenant_sales;
CREATE TRIGGER update_tenant_sales_updated_at
  BEFORE UPDATE ON tenant_sales
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_tenant_concessions_updated_at ON tenant_concessions;
CREATE TRIGGER update_tenant_concessions_updated_at
  BEFORE UPDATE ON tenant_concessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_tenant_capex_leasing_updated_at ON tenant_capex_leasing;
CREATE TRIGGER update_tenant_capex_leasing_updated_at
  BEFORE UPDATE ON tenant_capex_leasing
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_tenant_rollover_assumptions_updated_at ON tenant_rollover_assumptions;
CREATE TRIGGER update_tenant_rollover_assumptions_updated_at
  BEFORE UPDATE ON tenant_rollover_assumptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- DONE
-- ============================================

COMMENT ON TABLE tenant_leases IS 'Commercial tenant lease records for Valuator';
COMMENT ON TABLE tenant_rent_terms IS 'Lease rent terms including initial and option periods';
COMMENT ON TABLE tenant_recoveries IS 'NNN/CAM recovery configurations';
COMMENT ON TABLE tenant_percentage_rent IS 'Retail percentage rent configurations';
COMMENT ON TABLE tenant_sales IS 'Monthly tenant sales data for percentage rent';
COMMENT ON TABLE tenant_concessions IS 'Rent concessions (free rent, discounts)';
COMMENT ON TABLE tenant_capex_leasing IS 'TI and leasing commission configurations';
COMMENT ON TABLE tenant_rollover_assumptions IS 'Renewal and vacancy assumptions';
