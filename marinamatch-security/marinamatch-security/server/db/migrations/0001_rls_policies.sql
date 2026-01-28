-- ============================================================================
-- MarinaMatch Row Level Security (RLS) Policies
-- 
-- This migration enables tenant isolation at the database level.
-- Run after the schema migration.
--
-- USAGE:
-- 1. Apply this migration: psql $DATABASE_URL -f rls-policies.sql
-- 2. Or add to your Drizzle migrations folder
-- ============================================================================

-- ============================================================================
-- ENABLE RLS ON ALL TENANT-SCOPED TABLES
-- ============================================================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- APPLICATION ROLE SETUP
-- 
-- We create a dedicated role for the application with RLS policies.
-- The app sets current_setting('app.current_org_id') for each request.
-- ============================================================================

-- Create app role if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'marinamatch_app') THEN
    CREATE ROLE marinamatch_app LOGIN;
  END IF;
END $$;

-- Grant necessary permissions to app role
GRANT USAGE ON SCHEMA public TO marinamatch_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO marinamatch_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO marinamatch_app;

-- ============================================================================
-- HELPER FUNCTION: Get Current Org ID
-- ============================================================================

CREATE OR REPLACE FUNCTION current_org_id() 
RETURNS uuid AS $$
BEGIN
  RETURN NULLIF(current_setting('app.current_org_id', true), '')::uuid;
EXCEPTION
  WHEN invalid_text_representation THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================================================
-- HELPER FUNCTION: Is Super Admin
-- ============================================================================

CREATE OR REPLACE FUNCTION is_super_admin() 
RETURNS boolean AS $$
BEGIN
  RETURN COALESCE(current_setting('app.is_super_admin', true), 'false')::boolean;
EXCEPTION
  WHEN OTHERS THEN
    RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================================================
-- USERS TABLE POLICIES
-- ============================================================================

-- Policy: Users can only see users in their org
DROP POLICY IF EXISTS users_tenant_isolation ON users;
CREATE POLICY users_tenant_isolation ON users
  FOR ALL
  USING (
    org_id = current_org_id() 
    OR is_super_admin()
  )
  WITH CHECK (
    org_id = current_org_id()
    OR is_super_admin()
  );

-- ============================================================================
-- SESSIONS TABLE POLICIES
-- ============================================================================

DROP POLICY IF EXISTS sessions_tenant_isolation ON sessions;
CREATE POLICY sessions_tenant_isolation ON sessions
  FOR ALL
  USING (
    org_id = current_org_id()
    OR is_super_admin()
  )
  WITH CHECK (
    org_id = current_org_id()
    OR is_super_admin()
  );

-- ============================================================================
-- DOCUMENTS TABLE POLICIES
-- ============================================================================

DROP POLICY IF EXISTS documents_tenant_isolation ON documents;
CREATE POLICY documents_tenant_isolation ON documents
  FOR ALL
  USING (
    org_id = current_org_id()
    OR is_super_admin()
  )
  WITH CHECK (
    org_id = current_org_id()
    OR is_super_admin()
  );

-- ============================================================================
-- INTEGRATIONS TABLE POLICIES
-- ============================================================================

DROP POLICY IF EXISTS integrations_tenant_isolation ON integrations;
CREATE POLICY integrations_tenant_isolation ON integrations
  FOR ALL
  USING (
    org_id = current_org_id()
    OR is_super_admin()
  )
  WITH CHECK (
    org_id = current_org_id()
    OR is_super_admin()
  );

-- ============================================================================
-- AUDIT LOGS TABLE POLICIES
-- 
-- Audit logs are special: append-only for writes, tenant-scoped for reads
-- ============================================================================

DROP POLICY IF EXISTS audit_logs_read_policy ON audit_logs;
CREATE POLICY audit_logs_read_policy ON audit_logs
  FOR SELECT
  USING (
    org_id = current_org_id()
    OR is_super_admin()
  );

DROP POLICY IF EXISTS audit_logs_insert_policy ON audit_logs;
CREATE POLICY audit_logs_insert_policy ON audit_logs
  FOR INSERT
  WITH CHECK (
    org_id = current_org_id()
    OR org_id IS NULL -- System-level audit logs
    OR is_super_admin()
  );

-- Prevent updates and deletes on audit logs (append-only)
DROP POLICY IF EXISTS audit_logs_no_update ON audit_logs;
CREATE POLICY audit_logs_no_update ON audit_logs
  FOR UPDATE
  USING (false); -- Never allow updates

DROP POLICY IF EXISTS audit_logs_no_delete ON audit_logs;
CREATE POLICY audit_logs_no_delete ON audit_logs
  FOR DELETE
  USING (false); -- Never allow deletes

-- ============================================================================
-- ROLES TABLE POLICIES
-- 
-- System roles (org_id NULL) are readable by all, org roles are tenant-scoped
-- ============================================================================

DROP POLICY IF EXISTS roles_tenant_isolation ON roles;
CREATE POLICY roles_tenant_isolation ON roles
  FOR ALL
  USING (
    org_id IS NULL -- System roles
    OR org_id = current_org_id()
    OR is_super_admin()
  )
  WITH CHECK (
    org_id = current_org_id()
    OR is_super_admin()
  );

-- ============================================================================
-- USER ROLES TABLE POLICIES
-- ============================================================================

DROP POLICY IF EXISTS user_roles_tenant_isolation ON user_roles;
CREATE POLICY user_roles_tenant_isolation ON user_roles
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = user_roles.user_id 
      AND (u.org_id = current_org_id() OR is_super_admin())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = user_roles.user_id 
      AND (u.org_id = current_org_id() OR is_super_admin())
    )
  );

-- ============================================================================
-- ORGANIZATIONS TABLE POLICIES
-- 
-- Users can only see their own organization
-- ============================================================================

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS organizations_tenant_isolation ON organizations;
CREATE POLICY organizations_tenant_isolation ON organizations
  FOR ALL
  USING (
    id = current_org_id()
    OR is_super_admin()
  )
  WITH CHECK (
    id = current_org_id()
    OR is_super_admin()
  );

-- ============================================================================
-- PERMISSIONS TABLE
-- 
-- Permissions are global (no tenant scoping), but only admins can modify
-- ============================================================================

-- Permissions table doesn't need RLS - it's a system table
-- But we ensure it's read-only for the app role

REVOKE INSERT, UPDATE, DELETE ON permissions FROM marinamatch_app;
GRANT SELECT ON permissions TO marinamatch_app;

-- ============================================================================
-- ROLE PERMISSIONS TABLE
-- ============================================================================

-- Role permissions follow role's org_id
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS role_permissions_tenant_isolation ON role_permissions;
CREATE POLICY role_permissions_tenant_isolation ON role_permissions
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM roles r 
      WHERE r.id = role_permissions.role_id 
      AND (r.org_id IS NULL OR r.org_id = current_org_id() OR is_super_admin())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM roles r 
      WHERE r.id = role_permissions.role_id 
      AND (r.org_id = current_org_id() OR is_super_admin())
    )
  );

-- ============================================================================
-- BYPASS RLS FOR MIGRATIONS AND ADMIN TASKS
-- 
-- The superuser (or a dedicated admin role) can bypass RLS
-- ============================================================================

-- Create admin role for migrations
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'marinamatch_admin') THEN
    CREATE ROLE marinamatch_admin BYPASSRLS LOGIN;
  END IF;
END $$;

GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO marinamatch_admin;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO marinamatch_admin;

-- ============================================================================
-- INDEXES FOR RLS PERFORMANCE
-- 
-- Ensure org_id columns are well-indexed for RLS filter performance
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_users_org_id_rls ON users(org_id);
CREATE INDEX IF NOT EXISTS idx_documents_org_id_rls ON documents(org_id);
CREATE INDEX IF NOT EXISTS idx_sessions_org_id_rls ON sessions(org_id);
CREATE INDEX IF NOT EXISTS idx_integrations_org_id_rls ON integrations(org_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_org_id_rls ON audit_logs(org_id);
CREATE INDEX IF NOT EXISTS idx_roles_org_id_rls ON roles(org_id);

-- ============================================================================
-- VERIFICATION QUERY
-- 
-- Run this to verify RLS is enabled on all tables
-- ============================================================================

-- SELECT 
--   schemaname,
--   tablename,
--   rowsecurity
-- FROM pg_tables
-- WHERE schemaname = 'public'
-- ORDER BY tablename;

-- ============================================================================
-- TESTING RLS
-- 
-- To test RLS policies, set the org context:
--
-- SET app.current_org_id = 'your-org-uuid-here';
-- SET app.is_super_admin = 'false';
-- SELECT * FROM users; -- Should only show users from that org
-- ============================================================================

COMMENT ON FUNCTION current_org_id() IS 'Returns the current tenant org_id from session settings for RLS';
COMMENT ON FUNCTION is_super_admin() IS 'Returns true if current session has super admin privileges';
