-- Phase 1: Modeling Timeline Engine (Fixed)
-- Creates modeling_project_config if missing, adds timeline fields

-- ============================================
-- CREATE MODELING_PROJECT_CONFIG IF NOT EXISTS
-- ============================================

CREATE TABLE IF NOT EXISTS modeling_project_config (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
  modeling_project_id VARCHAR NOT NULL REFERENCES modeling_projects(id) ON DELETE CASCADE,
  hold_period INTEGER NOT NULL DEFAULT 5,
  cash_flow_granularity VARCHAR(20) NOT NULL DEFAULT 'annual',
  
  -- Timeline fields (Phase 1)
  acquisition_close_date DATE,
  ttm_end_date DATE,
  projection_start_rule VARCHAR(30) DEFAULT 'acq_close_year',
  projection_start_date DATE,
  hold_period_months INTEGER,
  stabilized_noi_mode VARCHAR(20) DEFAULT 'fixed_year',
  stabilized_noi_year INTEGER DEFAULT 3,
  stabilized_noi_month INTEGER,
  irr_display_preference VARCHAR(20) DEFAULT 'monthly',
  seasonality_profile_id VARCHAR,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_modeling_project_config_project 
  ON modeling_project_config(modeling_project_id);

-- Compute hold_period_months from hold_period for any existing records
UPDATE modeling_project_config 
SET hold_period_months = hold_period * 12
WHERE hold_period_months IS NULL AND hold_period IS NOT NULL;

-- ============================================
-- SEASONALITY PROFILES (org-scoped, no system org)
-- ============================================

CREATE TABLE IF NOT EXISTS seasonality_profiles (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
  org_id VARCHAR NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
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

CREATE INDEX IF NOT EXISTS idx_seasonality_profiles_org ON seasonality_profiles(org_id);
CREATE INDEX IF NOT EXISTS idx_seasonality_profiles_default ON seasonality_profiles(org_id, is_default);
CREATE INDEX IF NOT EXISTS idx_seasonality_profile_months_profile ON seasonality_profile_months(profile_id);

-- ============================================
-- SCENARIO ASSUMPTION PAYLOADS
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
-- SCENARIO AUDIT LOGS
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

-- ============================================
-- UPDATE TRIGGERS
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_modeling_project_config_updated_at ON modeling_project_config;
CREATE TRIGGER update_modeling_project_config_updated_at
  BEFORE UPDATE ON modeling_project_config
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_seasonality_profiles_updated_at ON seasonality_profiles;
CREATE TRIGGER update_seasonality_profiles_updated_at
  BEFORE UPDATE ON seasonality_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_scenario_assumption_payloads_updated_at ON scenario_assumption_payloads;
CREATE TRIGGER update_scenario_assumption_payloads_updated_at
  BEFORE UPDATE ON scenario_assumption_payloads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Done
SELECT 'Migration 002_modeling_timeline completed successfully' as status;
