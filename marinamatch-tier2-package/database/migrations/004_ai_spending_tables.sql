-- Migration: 004_ai_spending_tables.sql
-- Purpose: Add tables for tracking AI API usage and enforcing spending limits
-- Impact: Enables $100/month spending cap per organization

-- ============================================================================
-- AI Usage Tracking Table
-- ============================================================================

CREATE TABLE ai_usage_tracking (
  id SERIAL PRIMARY KEY,
  "orgId" INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  "userId" INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  "operationType" TEXT NOT NULL, -- 'chat', 'rag', 'document_parse', 'summary', 'embedding', 'other'
  provider TEXT NOT NULL, -- 'openai', 'anthropic'
  model TEXT NOT NULL, -- 'gpt-4o', 'claude-sonnet-3.5', etc.
  "inputTokens" INTEGER NOT NULL DEFAULT 0,
  "outputTokens" INTEGER NOT NULL DEFAULT 0,
  "estimatedCostCents" INTEGER NOT NULL, -- Cost in cents (1/100 of dollar)
  metadata JSONB DEFAULT '{}', -- Additional context (document ID, conversation ID, etc.)
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes for fast queries
CREATE INDEX idx_ai_usage_org_date ON ai_usage_tracking("orgId", "createdAt" DESC);
CREATE INDEX idx_ai_usage_user_date ON ai_usage_tracking("userId", "createdAt" DESC);
CREATE INDEX idx_ai_usage_type ON ai_usage_tracking("operationType");
CREATE INDEX idx_ai_usage_model ON ai_usage_tracking(provider, model);

-- Index for monthly aggregation queries
CREATE INDEX idx_ai_usage_org_month ON ai_usage_tracking(
  "orgId", 
  DATE_TRUNC('month', "createdAt")
);

-- ============================================================================
-- AI Spending Limits Table
-- ============================================================================

CREATE TABLE ai_spending_limits (
  id SERIAL PRIMARY KEY,
  "orgId" INTEGER NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,
  "monthlyLimitCents" INTEGER NOT NULL DEFAULT 10000, -- $100 default limit
  "currentMonthSpendCents" INTEGER NOT NULL DEFAULT 0, -- Running total for current month
  "lastResetAt" TIMESTAMP NOT NULL DEFAULT NOW(), -- When counter was last reset
  "hardLimitReachedAt" TIMESTAMP, -- When limit was hit (null if not reached)
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Index for fast org lookups
CREATE INDEX idx_ai_spending_limits_org ON ai_spending_limits("orgId");

-- ============================================================================
-- Trigger to Auto-Update updatedAt
-- ============================================================================

CREATE OR REPLACE FUNCTION update_ai_spending_limits_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW."updatedAt" = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_ai_spending_limits_updated_at
BEFORE UPDATE ON ai_spending_limits
FOR EACH ROW
EXECUTE FUNCTION update_ai_spending_limits_updated_at();

-- ============================================================================
-- Helper Views for Reporting
-- ============================================================================

-- Current month usage by organization
CREATE VIEW ai_usage_current_month AS
SELECT 
  "orgId",
  COUNT(*) as total_calls,
  SUM("inputTokens") as total_input_tokens,
  SUM("outputTokens") as total_output_tokens,
  SUM("estimatedCostCents") as total_cost_cents,
  ROUND(SUM("estimatedCostCents")::numeric / 100, 2) as total_cost_dollars
FROM ai_usage_tracking
WHERE "createdAt" >= DATE_TRUNC('month', NOW())
GROUP BY "orgId";

-- Usage by operation type (current month)
CREATE VIEW ai_usage_by_type_current_month AS
SELECT 
  "orgId",
  "operationType",
  COUNT(*) as call_count,
  SUM("estimatedCostCents") as cost_cents,
  ROUND(SUM("estimatedCostCents")::numeric / 100, 2) as cost_dollars
FROM ai_usage_tracking
WHERE "createdAt" >= DATE_TRUNC('month', NOW())
GROUP BY "orgId", "operationType";

-- Usage by model (current month)
CREATE VIEW ai_usage_by_model_current_month AS
SELECT 
  "orgId",
  provider,
  model,
  COUNT(*) as call_count,
  SUM("inputTokens") as input_tokens,
  SUM("outputTokens") as output_tokens,
  SUM("estimatedCostCents") as cost_cents,
  ROUND(SUM("estimatedCostCents")::numeric / 100, 2) as cost_dollars
FROM ai_usage_tracking
WHERE "createdAt" >= DATE_TRUNC('month', NOW())
GROUP BY "orgId", provider, model;

-- Organizations approaching spending limit
CREATE VIEW ai_orgs_near_limit AS
SELECT 
  o.id as "orgId",
  o.name as org_name,
  sl."monthlyLimitCents",
  sl."currentMonthSpendCents",
  sl."hardLimitReachedAt",
  ROUND((sl."currentMonthSpendCents"::numeric / sl."monthlyLimitCents") * 100, 1) as percent_used,
  sl."monthlyLimitCents" - sl."currentMonthSpendCents" as remaining_cents,
  ROUND((sl."monthlyLimitCents" - sl."currentMonthSpendCents")::numeric / 100, 2) as remaining_dollars
FROM organizations o
JOIN ai_spending_limits sl ON o.id = sl."orgId"
WHERE sl."currentMonthSpendCents" >= sl."monthlyLimitCents" * 0.8 -- 80% or more used
ORDER BY percent_used DESC;

-- ============================================================================
-- Seed Default Limits for Existing Organizations
-- ============================================================================

INSERT INTO ai_spending_limits ("orgId", "monthlyLimitCents", "currentMonthSpendCents", "lastResetAt")
SELECT 
  id,
  10000, -- $100 default limit
  0, -- Start at zero
  NOW()
FROM organizations
WHERE id NOT IN (SELECT "orgId" FROM ai_spending_limits);

-- ============================================================================
-- Rollback Script (save separately)
-- ============================================================================

/*
DROP VIEW IF EXISTS ai_orgs_near_limit;
DROP VIEW IF EXISTS ai_usage_by_model_current_month;
DROP VIEW IF EXISTS ai_usage_by_type_current_month;
DROP VIEW IF EXISTS ai_usage_current_month;
DROP TRIGGER IF EXISTS trigger_update_ai_spending_limits_updated_at ON ai_spending_limits;
DROP FUNCTION IF EXISTS update_ai_spending_limits_updated_at();
DROP TABLE IF EXISTS ai_spending_limits;
DROP TABLE IF EXISTS ai_usage_tracking;
*/

-- ============================================================================
-- Verification
-- ============================================================================

DO $$
DECLARE
  usage_table_exists BOOLEAN;
  limits_table_exists BOOLEAN;
  orgs_with_limits INTEGER;
  total_orgs INTEGER;
BEGIN
  -- Check if tables exist
  SELECT EXISTS (
    SELECT FROM pg_tables 
    WHERE schemaname = 'public' AND tablename = 'ai_usage_tracking'
  ) INTO usage_table_exists;
  
  SELECT EXISTS (
    SELECT FROM pg_tables 
    WHERE schemaname = 'public' AND tablename = 'ai_spending_limits'
  ) INTO limits_table_exists;
  
  -- Count orgs
  SELECT COUNT(*) INTO orgs_with_limits FROM ai_spending_limits;
  SELECT COUNT(*) INTO total_orgs FROM organizations;
  
  RAISE NOTICE 'Migration complete:';
  RAISE NOTICE '  ai_usage_tracking table exists: %', usage_table_exists;
  RAISE NOTICE '  ai_spending_limits table exists: %', limits_table_exists;
  RAISE NOTICE '  Organizations with limits: % / %', orgs_with_limits, total_orgs;
  
  IF NOT usage_table_exists OR NOT limits_table_exists THEN
    RAISE EXCEPTION 'Migration failed: One or more tables not created';
  END IF;
  
  IF orgs_with_limits < total_orgs THEN
    RAISE WARNING 'Not all organizations have spending limits set';
  END IF;
END $$;

-- ============================================================================
-- Example Queries for Testing
-- ============================================================================

-- Check current month usage for org 1
-- SELECT * FROM ai_usage_current_month WHERE "orgId" = 1;

-- Check which orgs are near their limit
-- SELECT * FROM ai_orgs_near_limit;

-- Get detailed usage breakdown for org 1
-- SELECT * FROM ai_usage_by_type_current_month WHERE "orgId" = 1;
-- SELECT * FROM ai_usage_by_model_current_month WHERE "orgId" = 1;
