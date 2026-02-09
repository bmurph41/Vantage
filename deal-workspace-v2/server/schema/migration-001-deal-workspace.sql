-- Migration 001: Deal Workspace Extensions
-- ALTERs existing tables, CREATEs only new ones.
-- All IDs are varchar UUIDs matching your existing schema.

-- ═══════════════════════════════════════════════════════════════════════════════
-- NEW ENUMS (avoid collisions with existing ones)
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$ BEGIN
  CREATE TYPE ws_member_role AS ENUM (
    'owner_admin','internal_member','buyer','seller','broker',
    'lender','attorney','accountant','consultant','viewer'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE ws_invite_status AS ENUM ('pending','accepted','declined','revoked');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE ws_access_policy AS ENUM ('auto_approve','manual_approve');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE ws_ca_execution_status AS ENUM ('executed','pending_review','rejected');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE ws_milestone_type AS ENUM (
    'dd_start','dd_expiration','closing','financing_contingency',
    'inspection_deadline','custom'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE ws_milestone_status AS ENUM ('upcoming','due_soon','overdue','completed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE ws_dd_permission AS ENUM ('none','view','edit','admin');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE ws_security_level AS ENUM ('public','confidential','restricted');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- ALTER EXISTING TABLES
-- ═══════════════════════════════════════════════════════════════════════════════

-- Add DD date columns to deal_workspaces
ALTER TABLE deal_workspaces ADD COLUMN IF NOT EXISTS dd_start_date timestamp;
ALTER TABLE deal_workspaces ADD COLUMN IF NOT EXISTS dd_expiration_date timestamp;
ALTER TABLE deal_workspaces ADD COLUMN IF NOT EXISTS closing_date timestamp;

-- Add template_key and security_level to vdr_folders
ALTER TABLE vdr_folders ADD COLUMN IF NOT EXISTS workspace_id varchar;
ALTER TABLE vdr_folders ADD COLUMN IF NOT EXISTS template_key varchar(100);
ALTER TABLE vdr_folders ADD COLUMN IF NOT EXISTS security_level ws_security_level DEFAULT 'confidential';

-- Add workspace_id to vdr_documents
ALTER TABLE vdr_documents ADD COLUMN IF NOT EXISTS workspace_id varchar;

-- ═══════════════════════════════════════════════════════════════════════════════
-- NEW TABLES
-- ═══════════════════════════════════════════════════════════════════════════════

-- 1. Workspace Members
CREATE TABLE IF NOT EXISTS workspace_members (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id varchar NOT NULL REFERENCES deal_workspaces(id) ON DELETE CASCADE,
  org_id varchar NOT NULL,
  user_id varchar,
  email varchar(255),
  display_name varchar(255),
  role ws_member_role NOT NULL DEFAULT 'viewer',
  vdr_permission vdr_permission_level NOT NULL DEFAULT 'no_access',
  dd_permission ws_dd_permission NOT NULL DEFAULT 'none',
  invite_status ws_invite_status NOT NULL DEFAULT 'pending',
  invited_by varchar,
  invited_at timestamp NOT NULL DEFAULT NOW(),
  accepted_at timestamp,
  revoked_at timestamp,
  created_at timestamp NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS wm_workspace_idx ON workspace_members(workspace_id);
CREATE INDEX IF NOT EXISTS wm_user_idx ON workspace_members(user_id);
CREATE INDEX IF NOT EXISTS wm_org_idx ON workspace_members(org_id);

-- 2. Confidentiality Agreements
CREATE TABLE IF NOT EXISTS confidentiality_agreements (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id varchar NOT NULL REFERENCES deal_workspaces(id) ON DELETE CASCADE,
  org_id varchar NOT NULL,
  version varchar(20) NOT NULL DEFAULT '1.0.0',
  title text NOT NULL,
  body_html text NOT NULL,
  access_policy ws_access_policy NOT NULL DEFAULT 'auto_approve',
  is_active boolean NOT NULL DEFAULT TRUE,
  created_by varchar NOT NULL,
  created_at timestamp NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ca_workspace_idx ON confidentiality_agreements(workspace_id);

-- 3. Agreement Executions
CREATE TABLE IF NOT EXISTS agreement_executions (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id varchar NOT NULL REFERENCES deal_workspaces(id) ON DELETE CASCADE,
  agreement_id varchar NOT NULL REFERENCES confidentiality_agreements(id) ON DELETE CASCADE,
  member_id varchar,
  email varchar(255),
  user_id varchar,
  status ws_ca_execution_status NOT NULL DEFAULT 'executed',
  executed_at timestamp NOT NULL DEFAULT NOW(),
  ip_address varchar(45),
  user_agent text,
  notes text,
  reviewed_by varchar,
  reviewed_at timestamp,
  created_at timestamp NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ae_workspace_idx ON agreement_executions(workspace_id);
CREATE INDEX IF NOT EXISTS ae_agreement_idx ON agreement_executions(agreement_id);
CREATE INDEX IF NOT EXISTS ae_user_idx ON agreement_executions(user_id);

-- 4. DD Milestones
CREATE TABLE IF NOT EXISTS dd_milestones (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id varchar NOT NULL REFERENCES deal_workspaces(id) ON DELETE CASCADE,
  org_id varchar NOT NULL,
  type ws_milestone_type NOT NULL,
  title text NOT NULL,
  due_date timestamp NOT NULL,
  status ws_milestone_status NOT NULL DEFAULT 'upcoming',
  notes text,
  calendar_event_id varchar(255),
  created_at timestamp NOT NULL DEFAULT NOW(),
  updated_at timestamp NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS dm_workspace_idx ON dd_milestones(workspace_id);
CREATE INDEX IF NOT EXISTS dm_due_idx ON dd_milestones(due_date);

-- ═══════════════════════════════════════════════════════════════════════════════
-- DONE
-- ═══════════════════════════════════════════════════════════════════════════════
