-- Migration 002: DD Checklist Engine
-- 7 new tables, permission flags on workspace_members

-- ═══════════════════════════════════════════════════════════════════════════════
-- ENUMS
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$ BEGIN CREATE TYPE dd_checklist_status AS ENUM ('active','archived');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE dd_request_type AS ENUM ('document','data','answer','site_access','verification','other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE dd_request_status AS ENUM ('open','requested','in_progress','provided','reviewing','approved','rejected','waived','blocked');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE dd_internal_status AS ENUM ('not_started','in_progress','waiting_on_seller','waiting_on_third_party','done');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE dd_comment_visibility AS ENUM ('internal','external','all');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE dd_history_action AS ENUM ('created','edited','status_changed','deadline_changed','assigned','file_linked','file_unlinked','commented','section_moved','item_moved');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE dd_template_asset_class AS ENUM ('general_cre','marina','multifamily','office','retail','industrial','hotel','self_storage','mhp_rv','car_wash','laundromat','business_acquisition');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE dd_invite_scope AS ENUM ('data_room','checklist','both');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE dd_permission_preset AS ENUM ('seller_upload','broker_coordinator','buyer_viewer','lender_viewer','custom');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- ALTER workspace_members: add checklist permission flags + invite scope
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE workspace_members ADD COLUMN IF NOT EXISTS can_view_dd_checklist boolean NOT NULL DEFAULT true;
ALTER TABLE workspace_members ADD COLUMN IF NOT EXISTS can_edit_dd_checklist boolean NOT NULL DEFAULT false;
ALTER TABLE workspace_members ADD COLUMN IF NOT EXISTS can_respond_to_requests boolean NOT NULL DEFAULT false;
ALTER TABLE workspace_members ADD COLUMN IF NOT EXISTS can_upload_to_vdr boolean NOT NULL DEFAULT false;
ALTER TABLE workspace_members ADD COLUMN IF NOT EXISTS invite_scope dd_invite_scope DEFAULT 'both';
ALTER TABLE workspace_members ADD COLUMN IF NOT EXISTS permission_preset dd_permission_preset DEFAULT 'custom';

-- ═══════════════════════════════════════════════════════════════════════════════
-- NEW TABLES
-- ═══════════════════════════════════════════════════════════════════════════════

-- 1) DD Checklists
CREATE TABLE IF NOT EXISTS dd_checklists (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id varchar NOT NULL REFERENCES deal_workspaces(id) ON DELETE CASCADE,
  dd_project_id varchar REFERENCES projects(id),
  org_id varchar NOT NULL,
  name text NOT NULL DEFAULT 'DD Request List',
  status dd_checklist_status NOT NULL DEFAULT 'active',
  -- Settings
  seller_can_mark_provided boolean NOT NULL DEFAULT true,
  seller_can_change_status boolean NOT NULL DEFAULT false,
  require_reviewer_approval boolean NOT NULL DEFAULT false,
  auto_provided_on_upload boolean NOT NULL DEFAULT true,
  auto_reminders boolean NOT NULL DEFAULT false,
  lock_after_closing boolean NOT NULL DEFAULT false,
  ca_required_for_checklist boolean NOT NULL DEFAULT false,
  created_by_user_id varchar NOT NULL,
  created_at timestamp NOT NULL DEFAULT NOW(),
  updated_at timestamp NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ddc_workspace_idx ON dd_checklists(workspace_id);

-- 2) DD Checklist Sections
CREATE TABLE IF NOT EXISTS dd_checklist_sections (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_id varchar NOT NULL REFERENCES dd_checklists(id) ON DELETE CASCADE,
  sort_order integer NOT NULL DEFAULT 0,
  title text NOT NULL,
  description text,
  is_collapsed_by_default boolean NOT NULL DEFAULT false,
  created_at timestamp NOT NULL DEFAULT NOW(),
  updated_at timestamp NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ddcs_checklist_idx ON dd_checklist_sections(checklist_id);

-- 3) DD Checklist Items
CREATE TABLE IF NOT EXISTS dd_checklist_items (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id varchar NOT NULL REFERENCES dd_checklist_sections(id) ON DELETE CASCADE,
  sort_order integer NOT NULL DEFAULT 0,
  title text NOT NULL,
  request_text text,
  sub_category text,
  priority integer NOT NULL DEFAULT 2,
  request_type dd_request_type NOT NULL DEFAULT 'document',
  status dd_request_status NOT NULL DEFAULT 'open',
  internal_status dd_internal_status NOT NULL DEFAULT 'not_started',
  due_date date,
  milestone_anchor varchar(30),
  due_offset_days integer,
  custom_milestone_id varchar REFERENCES dd_milestones(id),
  assigned_to_member_id varchar REFERENCES workspace_members(id),
  reviewer_member_id varchar REFERENCES workspace_members(id),
  requested_from_member_id varchar REFERENCES workspace_members(id),
  tags text[],
  seller_notes text,
  internal_notes text,
  template_key varchar(100),
  created_at timestamp NOT NULL DEFAULT NOW(),
  updated_at timestamp NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ddci_section_idx ON dd_checklist_items(section_id);
CREATE INDEX IF NOT EXISTS ddci_status_idx ON dd_checklist_items(status);
CREATE INDEX IF NOT EXISTS ddci_assigned_idx ON dd_checklist_items(assigned_to_member_id);

-- 4) DD Checklist Item Files
CREATE TABLE IF NOT EXISTS dd_checklist_item_files (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id varchar NOT NULL REFERENCES dd_checklist_items(id) ON DELETE CASCADE,
  document_id varchar NOT NULL REFERENCES vdr_documents(id),
  added_by_member_id varchar,
  created_at timestamp NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ddcif_item_idx ON dd_checklist_item_files(item_id);

-- 5) DD Checklist Item Comments
CREATE TABLE IF NOT EXISTS dd_checklist_item_comments (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id varchar NOT NULL REFERENCES dd_checklist_items(id) ON DELETE CASCADE,
  member_id varchar REFERENCES workspace_members(id),
  user_id varchar,
  visibility dd_comment_visibility NOT NULL DEFAULT 'all',
  body text NOT NULL,
  created_at timestamp NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ddcic_item_idx ON dd_checklist_item_comments(item_id);

-- 6) DD Checklist Item History
CREATE TABLE IF NOT EXISTS dd_checklist_item_history (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id varchar NOT NULL REFERENCES dd_checklist_items(id) ON DELETE CASCADE,
  actor_member_id varchar,
  actor_user_id varchar,
  action dd_history_action NOT NULL,
  meta jsonb DEFAULT '{}',
  created_at timestamp NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ddcih_item_idx ON dd_checklist_item_history(item_id);
CREATE INDEX IF NOT EXISTS ddcih_created_idx ON dd_checklist_item_history(created_at);

-- 7) DD Checklist Templates
CREATE TABLE IF NOT EXISTS dd_checklist_templates (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  version text NOT NULL DEFAULT '1.0.0',
  asset_class dd_template_asset_class NOT NULL DEFAULT 'general_cre',
  data jsonb NOT NULL,
  is_builtin boolean NOT NULL DEFAULT false,
  org_id varchar,
  created_at timestamp NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ddct_asset_idx ON dd_checklist_templates(asset_class);
