-- ============================================================================
-- Workflow Automation Engine — Migration
-- Run in Replit shell:
--   cat /tmp/workflow_migration.sql | psql $DATABASE_URL
-- ============================================================================

-- ── Workflow Rules ────────────────────────────────────────────────────────────
-- One row per automation rule. Rules are evaluated whenever a relevant event
-- fires (deal stage change, score update, time-based cron, etc.)

CREATE TABLE IF NOT EXISTS workflow_rules (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  org_id        TEXT NOT NULL,
  name          TEXT NOT NULL,
  description   TEXT,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  run_order     INTEGER NOT NULL DEFAULT 0,   -- lower = runs first

  -- Trigger
  trigger_type  TEXT NOT NULL,
  -- 'deal_stage_changed' | 'deal_score_threshold' | 'deal_stale'
  -- | 'deal_added' | 'deal_converted' | 'manual'
  trigger_config JSONB NOT NULL DEFAULT '{}',
  -- { fromStage, toStage, minScore, staleAfterDays, ... }

  -- Conditions (ALL must pass)
  conditions    JSONB NOT NULL DEFAULT '[]',
  -- [ { field, operator, value }, ... ]
  -- operators: eq | ne | gt | lt | gte | lte | contains | not_contains | in | not_in

  -- Actions (executed in order)
  actions       JSONB NOT NULL DEFAULT '[]',
  -- [ { type, config }, ... ]
  -- types: change_status | assign_to | add_note | create_task
  --        | send_notification | send_email | move_to_stage | webhook

  -- Stats
  times_triggered INTEGER NOT NULL DEFAULT 0,
  last_triggered_at TIMESTAMP WITH TIME ZONE,

  created_by    TEXT,
  created_at    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS workflow_rules_org_idx    ON workflow_rules (org_id);
CREATE INDEX IF NOT EXISTS workflow_rules_active_idx ON workflow_rules (org_id, is_active);
CREATE INDEX IF NOT EXISTS workflow_rules_trigger_idx ON workflow_rules (trigger_type);

-- ── Workflow Executions ───────────────────────────────────────────────────────
-- Audit log: every time a rule fires, one row is written here.

CREATE TABLE IF NOT EXISTS workflow_executions (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  rule_id       TEXT NOT NULL REFERENCES workflow_rules(id) ON DELETE CASCADE,
  org_id        TEXT NOT NULL,

  -- What triggered it
  trigger_type  TEXT NOT NULL,
  deal_id       TEXT,                          -- sourced_deal id (if applicable)
  deal_name     TEXT,
  trigger_data  JSONB DEFAULT '{}',            -- snapshot of what changed

  -- Outcome
  status        TEXT NOT NULL DEFAULT 'running',
  -- 'running' | 'success' | 'partial' | 'skipped' | 'failed'
  skipped_reason TEXT,                         -- set when status = 'skipped' (conditions not met)
  actions_run   JSONB DEFAULT '[]',            -- [ { type, status, result, error }, ... ]
  error_message TEXT,

  started_at    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  completed_at  TIMESTAMP WITH TIME ZONE,
  duration_ms   INTEGER
);

CREATE INDEX IF NOT EXISTS workflow_executions_rule_idx ON workflow_executions (rule_id);
CREATE INDEX IF NOT EXISTS workflow_executions_org_idx  ON workflow_executions (org_id);
CREATE INDEX IF NOT EXISTS workflow_executions_deal_idx ON workflow_executions (deal_id);
CREATE INDEX IF NOT EXISTS workflow_executions_started_idx ON workflow_executions (started_at DESC);

-- ── Workflow Tasks (created by automation) ────────────────────────────────────
-- Simple task table. If you already have a tasks table, map actions there instead.

CREATE TABLE IF NOT EXISTS workflow_tasks (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  org_id        TEXT NOT NULL,
  deal_id       TEXT,
  created_by_rule_id TEXT REFERENCES workflow_rules(id) ON DELETE SET NULL,
  created_by_execution_id TEXT REFERENCES workflow_executions(id) ON DELETE SET NULL,

  title         TEXT NOT NULL,
  description   TEXT,
  assignee_id   TEXT,
  assignee_name TEXT,
  due_date      DATE,
  priority      TEXT DEFAULT 'normal',        -- 'low' | 'normal' | 'high' | 'urgent'
  status        TEXT NOT NULL DEFAULT 'open', -- 'open' | 'in_progress' | 'done' | 'cancelled'
  completed_at  TIMESTAMP WITH TIME ZONE,
  completed_by  TEXT,

  created_at    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS workflow_tasks_org_idx  ON workflow_tasks (org_id);
CREATE INDEX IF NOT EXISTS workflow_tasks_deal_idx ON workflow_tasks (deal_id);
CREATE INDEX IF NOT EXISTS workflow_tasks_assignee_idx ON workflow_tasks (assignee_id);

-- ── Workflow Notifications (in-app) ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS workflow_notifications (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  org_id        TEXT NOT NULL,
  user_id       TEXT NOT NULL,
  deal_id       TEXT,
  rule_id       TEXT REFERENCES workflow_rules(id) ON DELETE SET NULL,
  execution_id  TEXT REFERENCES workflow_executions(id) ON DELETE SET NULL,

  title         TEXT NOT NULL,
  body          TEXT,
  link          TEXT,
  is_read       BOOLEAN NOT NULL DEFAULT false,
  read_at       TIMESTAMP WITH TIME ZONE,

  created_at    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS workflow_notifications_user_idx ON workflow_notifications (user_id, is_read);
CREATE INDEX IF NOT EXISTS workflow_notifications_org_idx  ON workflow_notifications (org_id);
