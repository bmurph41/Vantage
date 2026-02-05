-- =============================================================================
-- Database Index Audit & Migration
-- Marinalytics Platform - Institutional Readiness
-- 
-- Run with: psql $DATABASE_URL < add-missing-indexes.sql
-- 
-- IMPORTANT: All indexes are created CONCURRENTLY to avoid locking tables
-- in production. If any fail, they can be re-run safely.
-- =============================================================================

-- ─── Audit Logs ──────────────────────────────────────────────────────────────
-- High-volume table, queried by org + time range, and by entity for timeline views.

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_org_created 
  ON audit_logs (org_id, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_entity 
  ON audit_logs (entity_type, entity_id, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_user 
  ON audit_logs (user_id, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_action 
  ON audit_logs (org_id, action, created_at DESC);


-- ─── CRM Contacts ───────────────────────────────────────────────────────────
-- Frequently searched by email, name, and filtered by org.

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_crm_contacts_org_email 
  ON crm_contacts (org_id, email) WHERE deleted_at IS NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_crm_contacts_org_name 
  ON crm_contacts (org_id, last_name, first_name) WHERE deleted_at IS NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_crm_contacts_org_company 
  ON crm_contacts (org_id, company_id) WHERE deleted_at IS NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_crm_contacts_updated 
  ON crm_contacts (org_id, updated_at DESC) WHERE deleted_at IS NULL;


-- ─── CRM Companies ──────────────────────────────────────────────────────────

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_crm_companies_org_name 
  ON crm_companies (org_id, name) WHERE deleted_at IS NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_crm_companies_updated 
  ON crm_companies (org_id, updated_at DESC) WHERE deleted_at IS NULL;


-- ─── CRM Deals ──────────────────────────────────────────────────────────────

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_crm_deals_org_stage 
  ON crm_deals (org_id, stage) WHERE deleted_at IS NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_crm_deals_org_contact 
  ON crm_deals (org_id, contact_id) WHERE deleted_at IS NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_crm_deals_close_date 
  ON crm_deals (org_id, expected_close_date) WHERE deleted_at IS NULL;


-- ─── CRM Activities ─────────────────────────────────────────────────────────

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_crm_activities_contact 
  ON crm_activities (contact_id, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_crm_activities_deal 
  ON crm_activities (deal_id, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_crm_activities_org_type 
  ON crm_activities (org_id, activity_type, created_at DESC);


-- ─── CRM Tasks ──────────────────────────────────────────────────────────────

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_crm_tasks_assignee 
  ON crm_tasks (assigned_to, status, due_date) WHERE deleted_at IS NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_crm_tasks_org_due 
  ON crm_tasks (org_id, due_date) WHERE deleted_at IS NULL AND status != 'completed';


-- ─── Projects / Valuations ──────────────────────────────────────────────────

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_projects_org_status 
  ON projects (org_id, status) WHERE deleted_at IS NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_projects_org_updated 
  ON projects (org_id, updated_at DESC) WHERE deleted_at IS NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_projects_created_by 
  ON projects (created_by, created_at DESC);


-- ─── Properties / Units / Leases ────────────────────────────────────────────

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_properties_org 
  ON properties (org_id) WHERE deleted_at IS NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_units_property 
  ON units (property_id) WHERE deleted_at IS NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_leases_unit 
  ON leases (unit_id, status) WHERE deleted_at IS NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_leases_expiration 
  ON leases (org_id, end_date) WHERE deleted_at IS NULL AND status = 'active';


-- ─── Documents / VDR ────────────────────────────────────────────────────────

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_documents_org_project 
  ON documents (org_id, project_id, created_at DESC) WHERE deleted_at IS NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_documents_type 
  ON documents (org_id, document_type) WHERE deleted_at IS NULL;


-- ─── Sessions / Notifications ───────────────────────────────────────────────

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_sessions_user 
  ON user_sessions (user_id, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_sessions_expires 
  ON user_sessions (expires_at) WHERE expires_at IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_user_read 
  ON notifications (user_id, read, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_org 
  ON notifications (org_id, created_at DESC);


-- ─── Fuel Transactions ──────────────────────────────────────────────────────

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_fuel_transactions_org_date 
  ON fuel_transactions (org_id, transaction_date DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_fuel_transactions_property_date 
  ON fuel_transactions (property_id, transaction_date DESC);


-- ─── Performance: Analyze after index creation ──────────────────────────────
-- Run these after creating indexes to update query planner statistics:

-- ANALYZE audit_logs;
-- ANALYZE crm_contacts;
-- ANALYZE crm_companies;
-- ANALYZE crm_deals;
-- ANALYZE crm_activities;
-- ANALYZE crm_tasks;
-- ANALYZE projects;
-- ANALYZE properties;
-- ANALYZE units;
-- ANALYZE leases;
-- ANALYZE documents;
-- ANALYZE user_sessions;
-- ANALYZE notifications;
-- ANALYZE fuel_transactions;
