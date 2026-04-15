-- Migration: Workflow Email Templates and Email Log
-- Canonical schema definition — tables are only created here; no runtime DDL elsewhere.

-- ============================================================================
-- 1. workflow_email_templates — Managed templates with {{token}} substitution
-- ============================================================================
CREATE TABLE IF NOT EXISTS workflow_email_templates (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        VARCHAR(255) NOT NULL,
  name          VARCHAR(255) NOT NULL,
  subject       VARCHAR(500) NOT NULL,
  body_html     TEXT NOT NULL,
  body_text     TEXT,
  category      VARCHAR(50) NOT NULL DEFAULT 'workflow',
  tokens_used   TEXT[] DEFAULT '{}',
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_by    VARCHAR(255),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wet_org      ON workflow_email_templates (org_id);
CREATE INDEX IF NOT EXISTS idx_wet_category ON workflow_email_templates (org_id, category);

-- ============================================================================
-- 2. workflow_email_log — Audit log for every workflow-sent email
-- ============================================================================
CREATE TABLE IF NOT EXISTS workflow_email_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          VARCHAR(255) NOT NULL,
  rule_id         UUID,
  execution_id    UUID,
  template_id     UUID,
  recipient_email VARCHAR(320) NOT NULL,
  recipient_name  VARCHAR(255),
  recipient_type  VARCHAR(50) NOT NULL DEFAULT 'custom',
  subject         VARCHAR(500) NOT NULL,
  body_preview    TEXT,
  status          VARCHAR(20) NOT NULL DEFAULT 'pending',
  provider        VARCHAR(50),
  provider_id     VARCHAR(255),
  error_message   TEXT,
  sent_at         TIMESTAMPTZ,
  deal_id         VARCHAR(255),
  contact_id      VARCHAR(255),
  rule_name       VARCHAR(255),
  to_email        VARCHAR(320),
  body_html       TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wel_org       ON workflow_email_log (org_id);
CREATE INDEX IF NOT EXISTS idx_wel_status    ON workflow_email_log (org_id, status);
CREATE INDEX IF NOT EXISTS idx_wel_recipient ON workflow_email_log (recipient_email);
CREATE INDEX IF NOT EXISTS idx_wel_deal      ON workflow_email_log (deal_id)    WHERE deal_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_wel_contact   ON workflow_email_log (contact_id) WHERE contact_id IS NOT NULL;
