-- Migration 001: Deal Workspace System
-- Run this against your PostgreSQL database to create all required tables.
-- Compatible with Drizzle ORM schema in deal-workspace-schema.ts.

-- ═══════════════════════════════════════════════════════════════════════════════
-- ENUMS
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$ BEGIN
  CREATE TYPE workspace_status AS ENUM ('draft','active','under_contract','closing','closed','terminated','archived');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE workspace_role AS ENUM ('owner_admin','internal_member','buyer','seller','broker','lender','attorney','accountant','consultant','viewer');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE vdr_permission AS ENUM ('none','view','download','upload','admin');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE dd_permission AS ENUM ('none','view','edit','admin');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE invite_status AS ENUM ('pending','accepted','declined','revoked');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE access_policy AS ENUM ('auto_approve','manual_approve');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE agreement_execution_status AS ENUM ('executed','pending_review','rejected');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE milestone_type AS ENUM ('dd_start','dd_expiration','closing','financing_contingency','inspection_deadline','custom');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE milestone_status AS ENUM ('upcoming','due_soon','overdue','completed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE vdr_action AS ENUM ('view','download','upload','move','rename','delete','restore','create_folder','update_permissions','execute_ca','approve_ca','reject_ca');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE security_level AS ENUM ('public','confidential','restricted');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE workspace_task_status AS ENUM ('not_started','in_progress','blocked','completed','skipped');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- TABLES
-- ═══════════════════════════════════════════════════════════════════════════════

-- 1. Deal Workspaces
CREATE TABLE IF NOT EXISTS deal_workspaces (
  id SERIAL PRIMARY KEY,
  org_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  deal_id INTEGER,
  property_id INTEGER,
  dd_project_id INTEGER,
  modeling_project_id INTEGER,
  status workspace_status NOT NULL DEFAULT 'draft',
  stage VARCHAR(100),
  role VARCHAR(50) DEFAULT 'buyer',
  target_price TEXT,
  dd_start_date TIMESTAMP,
  dd_expiration_date TIMESTAMP,
  closing_date TIMESTAMP,
  expected_close_date TIMESTAMP,
  last_activity_at TIMESTAMP,
  last_activity_type TEXT,
  last_activity_description TEXT,
  created_by INTEGER NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS dw_org_idx ON deal_workspaces(org_id);
CREATE INDEX IF NOT EXISTS dw_deal_idx ON deal_workspaces(deal_id);

-- 2. Workspace Members
CREATE TABLE IF NOT EXISTS workspace_members (
  id SERIAL PRIMARY KEY,
  workspace_id INTEGER NOT NULL REFERENCES deal_workspaces(id) ON DELETE CASCADE,
  org_id INTEGER NOT NULL,
  user_id INTEGER,
  email VARCHAR(255),
  display_name VARCHAR(255),
  role workspace_role NOT NULL DEFAULT 'viewer',
  vdr_permission vdr_permission NOT NULL DEFAULT 'none',
  dd_permission dd_permission NOT NULL DEFAULT 'none',
  invite_status invite_status NOT NULL DEFAULT 'pending',
  invited_by INTEGER,
  invited_at TIMESTAMP NOT NULL DEFAULT NOW(),
  accepted_at TIMESTAMP,
  revoked_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS wm_workspace_idx ON workspace_members(workspace_id);
CREATE INDEX IF NOT EXISTS wm_user_idx ON workspace_members(user_id);

-- 3. Confidentiality Agreements
CREATE TABLE IF NOT EXISTS confidentiality_agreements (
  id SERIAL PRIMARY KEY,
  workspace_id INTEGER NOT NULL REFERENCES deal_workspaces(id) ON DELETE CASCADE,
  org_id INTEGER NOT NULL,
  version VARCHAR(20) NOT NULL DEFAULT '1.0.0',
  title TEXT NOT NULL,
  body_html TEXT NOT NULL,
  access_policy access_policy NOT NULL DEFAULT 'auto_approve',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by INTEGER NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ca_workspace_idx ON confidentiality_agreements(workspace_id);

-- 4. Agreement Executions
CREATE TABLE IF NOT EXISTS agreement_executions (
  id SERIAL PRIMARY KEY,
  workspace_id INTEGER NOT NULL REFERENCES deal_workspaces(id) ON DELETE CASCADE,
  agreement_id INTEGER NOT NULL REFERENCES confidentiality_agreements(id) ON DELETE CASCADE,
  member_id INTEGER,
  email VARCHAR(255),
  user_id INTEGER,
  status agreement_execution_status NOT NULL DEFAULT 'executed',
  executed_at TIMESTAMP NOT NULL DEFAULT NOW(),
  ip_address VARCHAR(45),
  user_agent TEXT,
  notes TEXT,
  reviewed_by INTEGER,
  reviewed_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ae_workspace_idx ON agreement_executions(workspace_id);
CREATE INDEX IF NOT EXISTS ae_agreement_idx ON agreement_executions(agreement_id);

-- 5. DD Milestones
CREATE TABLE IF NOT EXISTS dd_milestones (
  id SERIAL PRIMARY KEY,
  workspace_id INTEGER NOT NULL REFERENCES deal_workspaces(id) ON DELETE CASCADE,
  org_id INTEGER NOT NULL,
  type milestone_type NOT NULL,
  title TEXT NOT NULL,
  due_date TIMESTAMP NOT NULL,
  status milestone_status NOT NULL DEFAULT 'upcoming',
  notes TEXT,
  calendar_event_id VARCHAR(255),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS dm_workspace_idx ON dd_milestones(workspace_id);

-- 6. VDR Folders (new table or extend existing)
CREATE TABLE IF NOT EXISTS vdr_folders (
  id SERIAL PRIMARY KEY,
  workspace_id INTEGER NOT NULL,
  project_id INTEGER,
  org_id INTEGER NOT NULL,
  parent_folder_id INTEGER REFERENCES vdr_folders(id),
  name TEXT NOT NULL,
  template_key VARCHAR(100),
  security_level security_level NOT NULL DEFAULT 'confidential',
  sort_order INTEGER DEFAULT 0,
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  deleted_at TIMESTAMP,
  deleted_by INTEGER,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  created_by INTEGER
);

CREATE INDEX IF NOT EXISTS vf_workspace_idx ON vdr_folders(workspace_id);
CREATE INDEX IF NOT EXISTS vf_parent_idx ON vdr_folders(parent_folder_id);

-- 7. VDR Documents (new table or extend existing)
CREATE TABLE IF NOT EXISTS vdr_documents (
  id SERIAL PRIMARY KEY,
  workspace_id INTEGER NOT NULL,
  project_id INTEGER,
  org_id INTEGER NOT NULL,
  folder_id INTEGER NOT NULL REFERENCES vdr_folders(id),
  name TEXT NOT NULL,
  original_name TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  file_hash VARCHAR(128),
  mime_type VARCHAR(255),
  size_bytes BIGINT,
  storage_path TEXT,
  status VARCHAR(50) DEFAULT 'active',
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  deleted_at TIMESTAMP,
  deleted_by INTEGER,
  ai_parsed BOOLEAN DEFAULT FALSE,
  ai_parse_job_id VARCHAR(255),
  uploaded_by INTEGER,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS vd_workspace_idx ON vdr_documents(workspace_id);
CREATE INDEX IF NOT EXISTS vd_folder_idx ON vdr_documents(folder_id);

-- 8. VDR Activity Log
CREATE TABLE IF NOT EXISTS vdr_activity_log (
  id SERIAL PRIMARY KEY,
  workspace_id INTEGER NOT NULL,
  org_id INTEGER NOT NULL,
  document_id INTEGER,
  folder_id INTEGER,
  member_id INTEGER,
  user_id INTEGER,
  action vdr_action NOT NULL,
  meta JSONB,
  ip_address VARCHAR(45),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS val_workspace_idx ON vdr_activity_log(workspace_id);
CREATE INDEX IF NOT EXISTS val_created_idx ON vdr_activity_log(created_at);

-- 9. Workspace Tasks
CREATE TABLE IF NOT EXISTS workspace_tasks (
  id SERIAL PRIMARY KEY,
  workspace_id INTEGER NOT NULL REFERENCES deal_workspaces(id) ON DELETE CASCADE,
  project_id INTEGER,
  org_id INTEGER NOT NULL,
  template_key VARCHAR(100),
  category VARCHAR(100),
  title TEXT NOT NULL,
  description TEXT,
  status workspace_task_status NOT NULL DEFAULT 'not_started',
  due_date TIMESTAMP,
  milestone_anchor VARCHAR(50),
  default_due_offset_days INTEGER,
  assigned_to_member_id INTEGER REFERENCES workspace_members(id),
  assigned_to_user_id INTEGER,
  dependency_task_id INTEGER REFERENCES workspace_tasks(id),
  calendar_event_id VARCHAR(255),
  required BOOLEAN DEFAULT FALSE,
  tags JSONB,
  completed_at TIMESTAMP,
  completed_by INTEGER,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS wt_workspace_idx ON workspace_tasks(workspace_id);
CREATE INDEX IF NOT EXISTS wt_status_idx ON workspace_tasks(status);
CREATE INDEX IF NOT EXISTS wt_due_idx ON workspace_tasks(due_date);

-- ═══════════════════════════════════════════════════════════════════════════════
-- DONE
-- ═══════════════════════════════════════════════════════════════════════════════
