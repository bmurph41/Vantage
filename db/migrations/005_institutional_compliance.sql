-- Migration 005: Institutional Compliance Infrastructure
-- Financial audit log, distribution approvals, period locks, CHECK constraints
-- All operations are idempotent (IF NOT EXISTS)

-- ============================================================================
-- 1. Financial Audit Log (IMMUTABLE, append-only)
-- ============================================================================
CREATE TABLE IF NOT EXISTS financial_audit_log (
  id varchar PRIMARY KEY,
  org_id varchar NOT NULL,
  fund_id varchar,
  investor_id varchar,
  event_type varchar(100) NOT NULL,
  actor_user_id varchar NOT NULL,
  actor_email varchar,
  actor_role varchar(30),
  ip_address varchar(45),
  user_agent text,
  amount numeric(18,2),
  currency varchar(3) DEFAULT 'USD',
  before_state jsonb,
  after_state jsonb,
  metadata jsonb,
  created_at timestamp NOT NULL DEFAULT now()
);

-- Prevent UPDATE/DELETE on audit log (immutable)
CREATE OR REPLACE RULE prevent_audit_update AS ON UPDATE TO financial_audit_log DO INSTEAD NOTHING;
CREATE OR REPLACE RULE prevent_audit_delete AS ON DELETE TO financial_audit_log DO INSTEAD NOTHING;

CREATE INDEX IF NOT EXISTS idx_financial_audit_org ON financial_audit_log(org_id);
CREATE INDEX IF NOT EXISTS idx_financial_audit_fund ON financial_audit_log(fund_id);
CREATE INDEX IF NOT EXISTS idx_financial_audit_event ON financial_audit_log(event_type);
CREATE INDEX IF NOT EXISTS idx_financial_audit_date ON financial_audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_financial_audit_actor ON financial_audit_log(actor_user_id);

-- ============================================================================
-- 2. Distribution Approval Workflow
-- ============================================================================
CREATE TABLE IF NOT EXISTS distribution_approvals (
  id varchar PRIMARY KEY,
  org_id varchar NOT NULL,
  fund_id varchar NOT NULL,
  status varchar(30) NOT NULL DEFAULT 'draft',
  total_proceeds numeric(18,2) NOT NULL,
  distribution_type varchar(50) NOT NULL,
  deal_allocation_id varchar,
  notes text,
  years_held numeric(5,2),
  created_by varchar NOT NULL,
  created_at timestamp NOT NULL DEFAULT now(),
  submitted_for_approval_at timestamp,
  submitted_by varchar,
  approvals_json jsonb DEFAULT '[]',
  required_approvals integer NOT NULL DEFAULT 1,
  rejected_by varchar,
  rejected_at timestamp,
  rejection_reason text,
  executed_at timestamp,
  executed_by varchar,
  waterfall_result jsonb,
  investor_allocations jsonb
);

CREATE INDEX IF NOT EXISTS idx_dist_approvals_org ON distribution_approvals(org_id);
CREATE INDEX IF NOT EXISTS idx_dist_approvals_fund ON distribution_approvals(fund_id);
CREATE INDEX IF NOT EXISTS idx_dist_approvals_status ON distribution_approvals(status);

-- ============================================================================
-- 3. Fund Period Locks
-- ============================================================================
CREATE TABLE IF NOT EXISTS fund_period_locks (
  id varchar PRIMARY KEY,
  org_id varchar NOT NULL,
  fund_id varchar NOT NULL,
  period_label varchar(30) NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  locked_at timestamp NOT NULL DEFAULT now(),
  locked_by varchar NOT NULL,
  unlocked_at timestamp,
  unlocked_by varchar,
  unlock_reason text,
  is_locked boolean NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_period_locks_fund ON fund_period_locks(fund_id);
CREATE INDEX IF NOT EXISTS idx_period_locks_locked ON fund_period_locks(fund_id, is_locked);

-- ============================================================================
-- 4. Database CHECK Constraints (data integrity)
-- ============================================================================

-- Hard cap enforcement
DO $$ BEGIN
  ALTER TABLE funds ADD CONSTRAINT chk_funds_committed_lte_hard_cap
    CHECK (committed_capital IS NULL OR hard_cap IS NULL OR committed_capital <= hard_cap);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- No negative unfunded commitment
DO $$ BEGIN
  ALTER TABLE fund_investors ADD CONSTRAINT chk_investors_unfunded_gte_zero
    CHECK (unfunded_commitment IS NULL OR unfunded_commitment >= 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- No negative called capital
DO $$ BEGIN
  ALTER TABLE fund_investors ADD CONSTRAINT chk_investors_called_gte_zero
    CHECK (called_capital IS NULL OR called_capital >= 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Commitment amount must be positive
DO $$ BEGIN
  ALTER TABLE fund_investors ADD CONSTRAINT chk_investors_commitment_positive
    CHECK (commitment_amount IS NULL OR commitment_amount > 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Capital movement amounts must be positive
DO $$ BEGIN
  ALTER TABLE fund_capital_movements ADD CONSTRAINT chk_movements_amount_positive
    CHECK (amount IS NULL OR CAST(amount AS numeric) > 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
