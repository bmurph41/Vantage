-- Phase 1: Modeling Timeline Engine
-- Adds timeline configuration fields for institutional-grade projections

-- ============================================
-- ADD TIMELINE FIELDS TO modeling_project_config
-- ============================================

-- Projection start rule enum
DO $$ BEGIN
  CREATE TYPE projection_start_rule AS ENUM (
    'acq_close_year',
    'next_full_calendar_year', 
    'ttm_plus_one_month'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Stabilized NOI definition mode enum
DO $$ BEGIN
  CREATE TYPE stabilized_noi_mode AS ENUM (
    'fixed_year',
    'user_set',
    'post_ramp'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- IRR display preference enum
DO $$ BEGIN
  CREATE TYPE irr_display_preference AS ENUM (
    'monthly',
    'annualized'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Add timeline columns to modeling_project_config
ALTER TABLE modeling_project_config
  ADD COLUMN IF NOT EXISTS acquisition_close_date DATE,
  ADD COLUMN IF NOT EXISTS ttm_end_date DATE,
  ADD COLUMN IF NOT EXISTS projection_start_rule projection_start_rule DEFAULT 'acq_close_year',
  ADD COLUMN IF NOT EXISTS projection_start_date DATE,
  ADD COLUMN IF NOT EXISTS hold_period_months INTEGER,
  ADD COLUMN IF NOT EXISTS stabilized_noi_mode stabilized_noi_mode DEFAULT 'fixed_year',
  ADD COLUMN IF NOT EXISTS stabilized_noi_year INTEGER DEFAULT 3,
  ADD COLUMN IF NOT EXISTS stabilized_noi_month INTEGER,
  ADD COLUMN IF NOT EXISTS irr_display_preference irr_display_preference DEFAULT 'monthly',
  ADD COLUMN IF NOT EXISTS seasonality_profile_id VARCHAR;

-- Compute hold_period_months from hold_period (years) for existing records
UPDATE modeling_project_config 
SET hold_period_months = hold_period * 12
WHERE hold_period_months IS NULL AND hold_period IS NOT NULL;

-- ============================================
-- SEASONALITY PROFILES
-- ============================================

CREATE TABLE IF NOT EXISTS seasonality_profiles (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
  org_id VARCHAR NOT NULL REFERENCES organizations(id),
  name TEXT NOT NULL,
  description TEXT,
  is_default BOOLEAN DEFAULT FALSE,
  is_system BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS seasonality_profile_months (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
  profile_id VARCHAR NOT NULL REFERENCES seasonality_profiles(id) ON DELETE CASCADE,
  month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
  occupancy_multiplier NUMERIC(5, 4) DEFAULT 1.0,
  rate_multiplier NUMERIC(5, 4) DEFAULT 1.0,
  revenue_multiplier NUMERIC(5, 4) DEFAULT 1.0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  UNIQUE(profile_id, month)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_seasonality_profiles_org ON seasonality_profiles(org_id);
CREATE INDEX IF NOT EXISTS idx_seasonality_profiles_default ON seasonality_profiles(org_id, is_default);
CREATE INDEX IF NOT EXISTS idx_seasonality_profile_months_profile ON seasonality_profile_months(profile_id);

-- ============================================
-- SCENARIO ASSUMPTION PAYLOADS (versioned, validated)
-- ============================================

CREATE TABLE IF NOT EXISTS scenario_assumption_payloads (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
  org_id VARCHAR NOT NULL REFERENCES organizations(id),
  project_id VARCHAR NOT NULL REFERENCES modeling_projects(id) ON DELETE CASCADE,
  scenario_id VARCHAR NOT NULL,
  scenario_version_id VARCHAR NOT NULL REFERENCES modeling_scenario_versions(id) ON DELETE CASCADE,
  payload JSONB NOT NULL,
  payload_schema_version INTEGER NOT NULL DEFAULT 1,
  payload_hash TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_scenario_assumption_payloads_version ON scenario_assumption_payloads(scenario_version_id);
CREATE INDEX IF NOT EXISTS idx_scenario_assumption_payloads_project ON scenario_assumption_payloads(project_id);

-- ============================================
-- SCENARIO AUDIT LOGS (institutional compliance)
-- ============================================

CREATE TABLE IF NOT EXISTS scenario_audit_logs (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
  org_id VARCHAR NOT NULL REFERENCES organizations(id),
  project_id VARCHAR NOT NULL REFERENCES modeling_projects(id) ON DELETE CASCADE,
  scenario_id VARCHAR,
  scenario_version_id VARCHAR,
  user_id VARCHAR REFERENCES users(id),
  event_type TEXT NOT NULL,
  summary TEXT,
  diff_json JSONB,
  payload_hash TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_scenario_audit_logs_project ON scenario_audit_logs(project_id);
CREATE INDEX IF NOT EXISTS idx_scenario_audit_logs_version ON scenario_audit_logs(scenario_version_id);
CREATE INDEX IF NOT EXISTS idx_scenario_audit_logs_user ON scenario_audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_scenario_audit_logs_created ON scenario_audit_logs(created_at);

-- ============================================
-- TRIGGERS
-- ============================================

-- Update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_seasonality_profiles_updated_at ON seasonality_profiles;
CREATE TRIGGER update_seasonality_profiles_updated_at
  BEFORE UPDATE ON seasonality_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_scenario_assumption_payloads_updated_at ON scenario_assumption_payloads;
CREATE TRIGGER update_scenario_assumption_payloads_updated_at
  BEFORE UPDATE ON scenario_assumption_payloads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- SEED DEFAULT MARINA SEASONALITY PROFILE
-- ============================================

-- This will be inserted per-org on first marina project creation
-- For now, create a system-level template
INSERT INTO seasonality_profiles (id, org_id, name, description, is_default, is_system)
SELECT 
  'system-marina-standard',
  'system',
  'Marina Standard',
  'Default seasonality profile for marina properties with peak summer season',
  true,
  true
WHERE NOT EXISTS (SELECT 1 FROM seasonality_profiles WHERE id = 'system-marina-standard');

-- Insert monthly multipliers (typical marina seasonality)
INSERT INTO seasonality_profile_months (profile_id, month, occupancy_multiplier, rate_multiplier, revenue_multiplier)
SELECT 'system-marina-standard', m.month, m.occ, m.rate, m.rev
FROM (VALUES
  (1,  0.45, 0.85, 0.40),  -- January
  (2,  0.50, 0.85, 0.45),  -- February
  (3,  0.60, 0.90, 0.55),  -- March
  (4,  0.75, 0.95, 0.72),  -- April
  (5,  0.90, 1.00, 0.90),  -- May
  (6,  0.98, 1.05, 1.03),  -- June
  (7,  1.00, 1.10, 1.10),  -- July (peak)
  (8,  1.00, 1.10, 1.10),  -- August (peak)
  (9,  0.85, 1.00, 0.85),  -- September
  (10, 0.70, 0.95, 0.67),  -- October
  (11, 0.55, 0.90, 0.50),  -- November
  (12, 0.48, 0.85, 0.42)   -- December
) AS m(month, occ, rate, rev)
WHERE NOT EXISTS (SELECT 1 FROM seasonality_profile_months WHERE profile_id = 'system-marina-standard');

COMMENT ON TABLE seasonality_profiles IS 'Monthly seasonality profiles for occupancy/rate adjustments';
COMMENT ON TABLE scenario_assumption_payloads IS 'Versioned assumption payloads with schema validation';
COMMENT ON TABLE scenario_audit_logs IS 'Audit trail for scenario changes (institutional compliance)';
