-- Migration 004: Fund cascade fixes, deal-to-modeling bridge, projectSettings timestamps
-- Safe to run: all operations use IF NOT EXISTS or are idempotent

-- ============================================================================
-- 1. Add modelingProjectId column to crm_deals (deal-to-modeling bridge)
-- ============================================================================
ALTER TABLE crm_deals ADD COLUMN IF NOT EXISTS modeling_project_id varchar;

-- ============================================================================
-- 2. Add timestamps to project_settings
-- ============================================================================
ALTER TABLE project_settings ADD COLUMN IF NOT EXISTS created_at timestamp DEFAULT now();
ALTER TABLE project_settings ADD COLUMN IF NOT EXISTS updated_at timestamp DEFAULT now();

-- ============================================================================
-- 3. Add CASCADE DELETE to critical project child tables
--    (Drop old FK, add new FK with cascade - idempotent via constraint naming)
-- ============================================================================

-- tasks.project_id → CASCADE
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'tasks_project_id_projects_id_fk' AND table_name = 'tasks') THEN
    ALTER TABLE tasks DROP CONSTRAINT tasks_project_id_projects_id_fk;
  END IF;
  ALTER TABLE tasks ADD CONSTRAINT tasks_project_id_projects_id_fk
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- project_settings.project_id → CASCADE
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'project_settings_project_id_projects_id_fk' AND table_name = 'project_settings') THEN
    ALTER TABLE project_settings DROP CONSTRAINT project_settings_project_id_projects_id_fk;
  END IF;
  ALTER TABLE project_settings ADD CONSTRAINT project_settings_project_id_projects_id_fk
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- project_shares.project_id → CASCADE
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'project_shares_project_id_projects_id_fk' AND table_name = 'project_shares') THEN
    ALTER TABLE project_shares DROP CONSTRAINT project_shares_project_id_projects_id_fk;
  END IF;
  ALTER TABLE project_shares ADD CONSTRAINT project_shares_project_id_projects_id_fk
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- risks.project_id → CASCADE
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'risks_project_id_projects_id_fk' AND table_name = 'risks') THEN
    ALTER TABLE risks DROP CONSTRAINT risks_project_id_projects_id_fk;
  END IF;
  ALTER TABLE risks ADD CONSTRAINT risks_project_id_projects_id_fk
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- project_contacts.project_id → CASCADE
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'project_contacts_project_id_projects_id_fk' AND table_name = 'project_contacts') THEN
    ALTER TABLE project_contacts DROP CONSTRAINT project_contacts_project_id_projects_id_fk;
  END IF;
  ALTER TABLE project_contacts ADD CONSTRAINT project_contacts_project_id_projects_id_fk
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- project_contacts.contact_id → CASCADE
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'project_contacts_contact_id_crm_contacts_id_fk' AND table_name = 'project_contacts') THEN
    ALTER TABLE project_contacts DROP CONSTRAINT project_contacts_contact_id_crm_contacts_id_fk;
  END IF;
  ALTER TABLE project_contacts ADD CONSTRAINT project_contacts_contact_id_crm_contacts_id_fk
    FOREIGN KEY (contact_id) REFERENCES crm_contacts(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- project_deal_members.project_id → CASCADE
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'project_deal_members_project_id_projects_id_fk' AND table_name = 'project_deal_members') THEN
    ALTER TABLE project_deal_members DROP CONSTRAINT project_deal_members_project_id_projects_id_fk;
  END IF;
  ALTER TABLE project_deal_members ADD CONSTRAINT project_deal_members_project_id_projects_id_fk
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- project_pending_contacts.project_id → CASCADE
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'project_pending_contacts_project_id_projects_id_fk' AND table_name = 'project_pending_contacts') THEN
    ALTER TABLE project_pending_contacts DROP CONSTRAINT project_pending_contacts_project_id_projects_id_fk;
  END IF;
  ALTER TABLE project_pending_contacts ADD CONSTRAINT project_pending_contacts_project_id_projects_id_fk
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- audit_logs.project_id → SET NULL (preserves audit trail)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'audit_logs_project_id_projects_id_fk' AND table_name = 'audit_logs') THEN
    ALTER TABLE audit_logs DROP CONSTRAINT audit_logs_project_id_projects_id_fk;
  END IF;
  ALTER TABLE audit_logs ADD CONSTRAINT audit_logs_project_id_projects_id_fk
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- projects.created_by → SET NULL (preserves projects when user deleted)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'projects_created_by_users_id_fk' AND table_name = 'projects') THEN
    ALTER TABLE projects DROP CONSTRAINT projects_created_by_users_id_fk;
  END IF;
  -- Need to allow NULL first since column is NOT NULL
  ALTER TABLE projects ALTER COLUMN created_by DROP NOT NULL;
  ALTER TABLE projects ADD CONSTRAINT projects_created_by_users_id_fk
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
