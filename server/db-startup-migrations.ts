/**
 * Startup DB migrations — idempotent DDL changes that cannot be applied
 * via drizzle-kit push alone (e.g., enum-to-text conversions).
 *
 * Each migration is safe to run multiple times (IF NOT EXISTS / USING cast).
 * This module runs once at server startup before any data seeds.
 *
 * ─── HOW TO ADD MIGRATIONS WHEN EXTENDING THE SCHEMA ──────────────────────────
 *
 * Whenever you add a new table or column to shared/schema.ts (or any secondary
 * schema file such as db/schema-commercial-tenants.ts), you MUST also add a
 * corresponding entry to the MIGRATIONS array below. Failure to do so will cause
 * schema drift that shows up as warnings at startup and can lead to runtime 500s.
 *
 * 1. NEW COLUMN — append an entry like:
 *      {
 *        name: "my_table: add my_column",
 *        sql: `ALTER TABLE my_table ADD COLUMN IF NOT EXISTS my_column text`,
 *      },
 *
 *    Use the appropriate PostgreSQL type (text, integer, boolean, numeric, timestamp,
 *    jsonb, varchar(N), …).  Add a DEFAULT when the column is NOT NULL so existing
 *    rows satisfy the constraint.
 *
 * 2. NEW TABLE — append an entry like:
 *      {
 *        name: "my_table: create table",
 *        sql: `
 *          CREATE TABLE IF NOT EXISTS my_table (
 *            id serial PRIMARY KEY,
 *            name text NOT NULL,
 *            created_at timestamp DEFAULT now()
 *          )
 *        `,
 *      },
 *
 * 3. DETECT DRIFT AUTOMATICALLY — run the helper script any time you want to see
 *    what the schema defines vs. what is already covered here:
 *
 *      npx tsx scripts/generate-startup-migrations.ts
 *
 *    The script prints ready-to-paste migration stubs for every table/column that
 *    is in the Drizzle schema but has no matching entry in this file.
 *
 * 4. CI GUARD — the project includes a drift-check script that exits non-zero when
 *    the live database is missing schema columns, making it suitable as a CI step:
 *
 *      npx tsx scripts/check-schema-drift.ts
 *
 * ──────────────────────────────────────────────────────────────────────────────
 */

import { pool } from "./db";

type Migration = { name: string; sql: string };

const MIGRATIONS: Migration[] = [
  {
    name: "platform_asset_classes: key enum→text",
    sql: `
      DO $$ BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'platform_asset_classes'
            AND column_name = 'key'
            AND udt_name != 'text'
        ) THEN
          ALTER TABLE platform_asset_classes ALTER COLUMN key TYPE text USING key::text;
        END IF;
      END; $$
    `,
  },
  {
    name: "platform_asset_classes: category enum→text",
    sql: `
      DO $$ BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'platform_asset_classes'
            AND column_name = 'category'
            AND udt_name != 'text'
        ) THEN
          ALTER TABLE platform_asset_classes ALTER COLUMN category TYPE text USING category::text;
        END IF;
      END; $$
    `,
  },
  {
    name: "platform_asset_classes: add size_label",
    sql: `ALTER TABLE platform_asset_classes ADD COLUMN IF NOT EXISTS size_label text`,
  },
  {
    name: "platform_asset_classes: add occ_label",
    sql: `ALTER TABLE platform_asset_classes ADD COLUMN IF NOT EXISTS occ_label text`,
  },
  {
    name: "platform_asset_classes: add price_unit",
    sql: `ALTER TABLE platform_asset_classes ADD COLUMN IF NOT EXISTS price_unit text`,
  },
  {
    name: "platform_asset_classes: add revenue_streams",
    sql: `ALTER TABLE platform_asset_classes ADD COLUMN IF NOT EXISTS revenue_streams jsonb DEFAULT '[]'`,
  },
  {
    name: "platform_asset_classes: add demand_key",
    sql: `ALTER TABLE platform_asset_classes ADD COLUMN IF NOT EXISTS demand_key text`,
  },
  {
    name: "platform_asset_classes: add group",
    sql: `ALTER TABLE platform_asset_classes ADD COLUMN IF NOT EXISTS "group" text`,
  },
  {
    name: "platform_asset_classes: add color",
    sql: `ALTER TABLE platform_asset_classes ADD COLUMN IF NOT EXISTS color text`,
  },
  {
    name: "rent_roll_projects: add auto_sync_enabled",
    sql: `ALTER TABLE rent_roll_projects ADD COLUMN IF NOT EXISTS auto_sync_enabled boolean DEFAULT false`,
  },
  {
    name: "rent_roll_projects: add last_sync_at",
    sql: `ALTER TABLE rent_roll_projects ADD COLUMN IF NOT EXISTS last_sync_at timestamp`,
  },
  {
    name: "rra_report_packages: create table",
    sql: `
      CREATE TABLE IF NOT EXISTS rra_report_packages (
        id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
        organization_id text NOT NULL,
        name text NOT NULL,
        description text,
        package_type text NOT NULL DEFAULT 'quarterly',
        status text NOT NULL DEFAULT 'draft',
        project_id text,
        period_start_date date NOT NULL,
        period_end_date date NOT NULL,
        as_of_date date,
        snapshot_id text,
        generated_at timestamp,
        report_url text,
        created_at timestamp DEFAULT NOW(),
        updated_at timestamp DEFAULT NOW()
      )
    `,
  },
  {
    name: "gl_accounts: create table",
    sql: `
      CREATE TABLE IF NOT EXISTS gl_accounts (
        id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
        organization_id text NOT NULL,
        account_code text NOT NULL,
        account_name text NOT NULL,
        category text NOT NULL DEFAULT 'revenue',
        description text,
        is_active boolean NOT NULL DEFAULT true,
        created_at timestamp DEFAULT NOW(),
        updated_at timestamp DEFAULT NOW()
      )
    `,
  },
  {
    name: "gl_mappings: create table",
    sql: `
      CREATE TABLE IF NOT EXISTS gl_mappings (
        id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
        organization_id text NOT NULL,
        gl_account_id text NOT NULL REFERENCES gl_accounts(id) ON DELETE CASCADE,
        charge_type text NOT NULL,
        project_id text,
        storage_location_id text,
        is_active boolean NOT NULL DEFAULT true,
        created_at timestamp DEFAULT NOW(),
        updated_at timestamp DEFAULT NOW()
      )
    `,
  },
  {
    name: "reconciliation_records: create table",
    sql: `
      CREATE TABLE IF NOT EXISTS reconciliation_records (
        id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
        organization_id text NOT NULL,
        project_id text,
        period_month integer NOT NULL,
        period_year integer NOT NULL,
        status text NOT NULL DEFAULT 'pending',
        rent_roll_total numeric(14,2) DEFAULT 0,
        gl_total numeric(14,2),
        variance_amount numeric(14,2),
        variance_percent numeric(10,4),
        notes text,
        reconciled_by text,
        reconciled_at timestamp,
        created_at timestamp DEFAULT NOW(),
        updated_at timestamp DEFAULT NOW()
      )
    `,
  },
  {
    name: "rra_leases: add completeness_score",
    sql: `ALTER TABLE rra_leases ADD COLUMN IF NOT EXISTS completeness_score integer DEFAULT 0`,
  },
  {
    name: "rra_leases: backfill completeness_score",
    sql: `
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'rra_leases' AND column_name = 'completeness_score') THEN
          UPDATE rra_leases SET completeness_score = (
            CASE WHEN lease_amount IS NOT NULL AND lease_amount::numeric > 0 THEN 20 ELSE 0 END +
            CASE WHEN lease_commencement IS NOT NULL THEN 20 ELSE 0 END +
            CASE WHEN lease_expiration IS NOT NULL THEN 20 ELSE 0 END +
            20
          ) WHERE completeness_score = 0;
        END IF;
      END; $$
    `,
  },
  // ── LOI / Transaction Milestone columns on crm_deals ──────────────────────
  { name: "crm_deals: add loi_submitted_at",    sql: `ALTER TABLE crm_deals ADD COLUMN IF NOT EXISTS loi_submitted_at timestamp` },
  { name: "crm_deals: add loi_accepted_at",     sql: `ALTER TABLE crm_deals ADD COLUMN IF NOT EXISTS loi_accepted_at timestamp` },
  { name: "crm_deals: add loi_rejected_at",     sql: `ALTER TABLE crm_deals ADD COLUMN IF NOT EXISTS loi_rejected_at timestamp` },
  { name: "crm_deals: add loi_expires_at",      sql: `ALTER TABLE crm_deals ADD COLUMN IF NOT EXISTS loi_expires_at timestamp` },
  { name: "crm_deals: add offer_price",         sql: `ALTER TABLE crm_deals ADD COLUMN IF NOT EXISTS offer_price numeric(12,2)` },
  { name: "crm_deals: add offer_submitted_at",  sql: `ALTER TABLE crm_deals ADD COLUMN IF NOT EXISTS offer_submitted_at timestamp` },
  { name: "crm_deals: add term_sheet_signed_at",sql: `ALTER TABLE crm_deals ADD COLUMN IF NOT EXISTS term_sheet_signed_at timestamp` },
  { name: "crm_deals: add psa_executed_at",     sql: `ALTER TABLE crm_deals ADD COLUMN IF NOT EXISTS psa_executed_at timestamp` },
  { name: "crm_deals: add closing_scheduled_at",sql: `ALTER TABLE crm_deals ADD COLUMN IF NOT EXISTS closing_scheduled_at timestamp` },
  // ── deal_commissions table ─────────────────────────────────────────────────
  {
    name: "deal_commissions: create table",
    sql: `
      CREATE TABLE IF NOT EXISTS deal_commissions (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        deal_id varchar NOT NULL REFERENCES crm_deals(id) ON DELETE CASCADE,
        recipient_type text NOT NULL DEFAULT 'internal',
        recipient_name text NOT NULL,
        contact_id varchar REFERENCES crm_contacts(id),
        role text,
        split_percent numeric(5,2),
        commission_amount numeric(12,2),
        status text NOT NULL DEFAULT 'pending',
        paid_at timestamp,
        notes text,
        org_id varchar REFERENCES organizations(id),
        created_at timestamp NOT NULL DEFAULT NOW(),
        updated_at timestamp NOT NULL DEFAULT NOW()
      )
    `,
  },
  {
    name: "outreach_campaigns: add campaign_type column",
    sql: `ALTER TABLE outreach_campaigns ADD COLUMN IF NOT EXISTS campaign_type text NOT NULL DEFAULT 'outreach'`,
  },
  {
    name: "outreach_campaign_steps: create table",
    sql: `
      CREATE TABLE IF NOT EXISTS outreach_campaign_steps (
        id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
        campaign_id text NOT NULL REFERENCES outreach_campaigns(id) ON DELETE CASCADE,
        org_id text NOT NULL REFERENCES organizations(id),
        step_number integer NOT NULL,
        type text NOT NULL DEFAULT 'email',
        delay_days integer NOT NULL DEFAULT 0,
        template_id text REFERENCES outreach_templates(id),
        subject text,
        body text,
        created_at timestamp DEFAULT NOW(),
        updated_at timestamp DEFAULT NOW()
      )
    `,
  },
  {
    name: "deal_commissions: index on deal_id",
    sql: `CREATE INDEX IF NOT EXISTS deal_commissions_deal_idx ON deal_commissions(deal_id)`,
  },
  {
    name: "deal_commissions: index on contact_id",
    sql: `CREATE INDEX IF NOT EXISTS deal_commissions_contact_idx ON deal_commissions(contact_id)`,
  },
  {
    name: "outreach_campaign_steps: create campaign_idx",
    sql: `CREATE INDEX IF NOT EXISTS outreach_campaign_steps_campaign_idx ON outreach_campaign_steps(campaign_id)`,
  },
  {
    name: "outreach_campaign_enrollments: create table",
    sql: `
      CREATE TABLE IF NOT EXISTS outreach_campaign_enrollments (
        id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
        campaign_id text NOT NULL REFERENCES outreach_campaigns(id) ON DELETE CASCADE,
        contact_id text NOT NULL REFERENCES crm_contacts(id),
        property_id text REFERENCES crm_properties(id),
        org_id text NOT NULL REFERENCES organizations(id),
        status text NOT NULL DEFAULT 'active',
        current_step integer NOT NULL DEFAULT 1,
        started_at timestamp DEFAULT NOW(),
        next_step_at timestamp,
        completed_at timestamp,
        enrolled_by text REFERENCES users(id),
        notes text,
        created_at timestamp DEFAULT NOW(),
        updated_at timestamp DEFAULT NOW()
      )
    `,
  },
  {
    name: "outreach_campaign_enrollments: create campaign_idx",
    sql: `CREATE INDEX IF NOT EXISTS outreach_campaign_enrollments_campaign_idx ON outreach_campaign_enrollments(campaign_id)`,
  },
  {
    name: "outreach_campaign_enrollments: create contact_idx",
    sql: `CREATE INDEX IF NOT EXISTS outreach_campaign_enrollments_contact_idx ON outreach_campaign_enrollments(contact_id)`,
  },
  {
    name: "outreach_campaign_enrollments: create active_idx",
    sql: `CREATE INDEX IF NOT EXISTS outreach_campaign_enrollments_active_idx ON outreach_campaign_enrollments(status, next_step_at)`,
  },
  {
    name: "modeling_financial_periods: add revenue_breakdown",
    sql: `ALTER TABLE modeling_financial_periods ADD COLUMN IF NOT EXISTS revenue_breakdown jsonb`,
  },
  {
    name: "modeling_financial_periods: add expense_breakdown",
    sql: `ALTER TABLE modeling_financial_periods ADD COLUMN IF NOT EXISTS expense_breakdown jsonb`,
  },
  {
    name: "asset_status enum: create if not exists",
    sql: `
      DO $$ BEGIN
        CREATE TYPE asset_status AS ENUM ('under_management', 'optimization', 'exit');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `,
  },
  {
    name: "hold_strategy enum: create if not exists",
    sql: `
      DO $$ BEGIN
        CREATE TYPE hold_strategy AS ENUM ('core', 'value_add', 'opportunistic');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `,
  },
  {
    name: "owned_assets: create table",
    sql: `
      CREATE TABLE IF NOT EXISTS owned_assets (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id varchar NOT NULL REFERENCES organizations(id),
        property_id varchar NOT NULL REFERENCES crm_properties(id),
        project_id varchar REFERENCES projects(id),
        acquisition_date date NOT NULL,
        acquisition_price integer,
        status asset_status NOT NULL DEFAULT 'under_management',
        hold_strategy hold_strategy,
        exit_target_date date,
        key_metrics jsonb DEFAULT '{}',
        notes text,
        created_by varchar NOT NULL REFERENCES users(id),
        created_at timestamp NOT NULL DEFAULT NOW(),
        updated_at timestamp NOT NULL DEFAULT NOW()
      )
    `,
  },
  {
    name: "owned_assets: org_status index",
    sql: `CREATE INDEX IF NOT EXISTS owned_assets_org_status_idx ON owned_assets(org_id, status)`,
  },
  {
    name: "owned_assets: org_property index",
    sql: `CREATE INDEX IF NOT EXISTS owned_assets_org_property_idx ON owned_assets(org_id, property_id)`,
  },

  // ── asset_budgets ─────────────────────────────────────────────────────────
  {
    name: "asset_budgets: create table",
    sql: `
      CREATE TABLE IF NOT EXISTS asset_budgets (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id varchar NOT NULL,
        owned_asset_id varchar NOT NULL,
        fiscal_year integer NOT NULL,
        name text,
        description text,
        status text NOT NULL DEFAULT 'draft',
        categories jsonb DEFAULT '{}',
        total_budget_amount numeric(15,2),
        created_by varchar NOT NULL,
        approved_by varchar,
        approved_at timestamp,
        created_at timestamp NOT NULL DEFAULT NOW(),
        updated_at timestamp NOT NULL DEFAULT NOW()
      )
    `,
  },

  // ── rra_renewal_reminders ─────────────────────────────────────────────────
  {
    name: "renewal_reminder_status enum: create if not exists",
    sql: `
      DO $$ BEGIN
        CREATE TYPE renewal_reminder_status AS ENUM ('pending','sent','acknowledged','failed');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `,
  },
  {
    name: "rra_renewal_reminders: create table",
    sql: `
      CREATE TABLE IF NOT EXISTS rra_renewal_reminders (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id varchar NOT NULL,
        lease_id varchar NOT NULL,
        reminder_date date NOT NULL,
        days_before_expiration integer NOT NULL DEFAULT 30,
        status text NOT NULL DEFAULT 'pending',
        sent_at timestamp,
        notification_method text DEFAULT 'email',
        recipient_email text,
        notes text,
        created_at timestamp NOT NULL DEFAULT NOW(),
        updated_at timestamp NOT NULL DEFAULT NOW(),
        created_by varchar
      )
    `,
  },

  // ── om_documents ──────────────────────────────────────────────────────────
  {
    name: "om_document_status enum: create if not exists",
    sql: `
      DO $$ BEGIN
        CREATE TYPE om_document_status AS ENUM ('draft','generating','completed','failed');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `,
  },
  {
    name: "om_documents: create table",
    sql: `
      CREATE TABLE IF NOT EXISTS om_documents (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        deal_id varchar NOT NULL,
        template_id varchar,
        title text NOT NULL,
        generated_at timestamp NOT NULL DEFAULT NOW(),
        pdf_url text,
        status text NOT NULL DEFAULT 'draft',
        metadata jsonb DEFAULT '{}',
        created_at timestamp NOT NULL DEFAULT NOW(),
        updated_at timestamp NOT NULL DEFAULT NOW()
      )
    `,
  },
  {
    name: "om_document_versions: add om_id",
    sql: `ALTER TABLE om_document_versions ADD COLUMN IF NOT EXISTS om_id varchar`,
  },
  {
    name: "om_document_versions: add snapshot_json",
    sql: `ALTER TABLE om_document_versions ADD COLUMN IF NOT EXISTS snapshot_json jsonb`,
  },
  {
    name: "om_document_versions: add thumbnail_url",
    sql: `ALTER TABLE om_document_versions ADD COLUMN IF NOT EXISTS thumbnail_url text`,
  },
  {
    name: "om_document_versions: add change_summary",
    sql: `ALTER TABLE om_document_versions ADD COLUMN IF NOT EXISTS change_summary text`,
  },

  // ── opssos enums ──────────────────────────────────────────────────────────
  {
    name: "opssos_conversation_status enum: create if not exists",
    sql: `
      DO $$ BEGIN
        CREATE TYPE opssos_conversation_status AS ENUM ('open','snoozed','closed');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `,
  },
  {
    name: "opssos_message_direction enum: create if not exists",
    sql: `
      DO $$ BEGIN
        CREATE TYPE opssos_message_direction AS ENUM ('in','out','note');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `,
  },
  {
    name: "opssos_message_status enum: create if not exists",
    sql: `
      DO $$ BEGIN
        CREATE TYPE opssos_message_status AS ENUM ('draft','scheduled','sent','failed');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `,
  },
  {
    name: "opssos_automation_run_status enum: create if not exists",
    sql: `
      DO $$ BEGIN
        CREATE TYPE opssos_automation_run_status AS ENUM ('pending','running','completed','failed');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `,
  },
  {
    name: "opssos_scheduled_job_status enum: create if not exists",
    sql: `
      DO $$ BEGIN
        CREATE TYPE opssos_scheduled_job_status AS ENUM ('queued','running','done','failed');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `,
  },
  {
    name: "opssos_task_status enum: create if not exists",
    sql: `
      DO $$ BEGIN
        CREATE TYPE opssos_task_status AS ENUM ('todo','doing','done');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `,
  },
  {
    name: "opssos_statement_status enum: create if not exists",
    sql: `
      DO $$ BEGIN
        CREATE TYPE opssos_statement_status AS ENUM ('draft','published');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `,
  },
  {
    name: "opssos_export_format enum: create if not exists",
    sql: `
      DO $$ BEGIN
        CREATE TYPE opssos_export_format AS ENUM ('xlsx','pdf','zip');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `,
  },
  {
    name: "opssos_webhook_delivery_status enum: create if not exists",
    sql: `
      DO $$ BEGIN
        CREATE TYPE opssos_webhook_delivery_status AS ENUM ('pending','sent','failed');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `,
  },

  // ── opssos tables ─────────────────────────────────────────────────────────
  {
    name: "opssos_conversations: create table",
    sql: `
      CREATE TABLE IF NOT EXISTS opssos_conversations (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id varchar NOT NULL,
        contact_id varchar,
        deal_id varchar,
        asset_id varchar,
        channel text NOT NULL DEFAULT 'internal',
        status text NOT NULL DEFAULT 'open',
        assigned_user_id varchar,
        last_message_at timestamp,
        created_at timestamp NOT NULL DEFAULT NOW()
      )
    `,
  },
  {
    name: "opssos_messages: create table",
    sql: `
      CREATE TABLE IF NOT EXISTS opssos_messages (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id varchar NOT NULL,
        conversation_id varchar NOT NULL,
        direction text NOT NULL,
        body text NOT NULL,
        provider text,
        provider_message_id text,
        scheduled_for timestamp,
        sent_at timestamp,
        status text NOT NULL DEFAULT 'sent',
        created_at timestamp NOT NULL DEFAULT NOW()
      )
    `,
  },
  {
    name: "opssos_message_templates: create table",
    sql: `
      CREATE TABLE IF NOT EXISTS opssos_message_templates (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id varchar NOT NULL,
        group_name text NOT NULL,
        title text NOT NULL,
        body text NOT NULL,
        created_at timestamp NOT NULL DEFAULT NOW()
      )
    `,
  },
  {
    name: "opssos_automation_rules: create table",
    sql: `
      CREATE TABLE IF NOT EXISTS opssos_automation_rules (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id varchar NOT NULL,
        name text NOT NULL,
        enabled boolean NOT NULL DEFAULT true,
        trigger_type text NOT NULL,
        conditions jsonb DEFAULT '[]',
        actions jsonb DEFAULT '[]',
        created_at timestamp NOT NULL DEFAULT NOW()
      )
    `,
  },
  {
    name: "opssos_automation_runs: create table",
    sql: `
      CREATE TABLE IF NOT EXISTS opssos_automation_runs (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id varchar NOT NULL,
        rule_id varchar NOT NULL,
        status text NOT NULL DEFAULT 'pending',
        started_at timestamp NOT NULL DEFAULT NOW(),
        finished_at timestamp,
        log jsonb DEFAULT '[]',
        error_text text,
        created_at timestamp NOT NULL DEFAULT NOW()
      )
    `,
  },
  {
    name: "opssos_scheduled_jobs: create table",
    sql: `
      CREATE TABLE IF NOT EXISTS opssos_scheduled_jobs (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id varchar NOT NULL,
        type text NOT NULL,
        payload jsonb DEFAULT '{}',
        run_at timestamp NOT NULL,
        status text NOT NULL DEFAULT 'queued',
        attempts integer NOT NULL DEFAULT 0,
        created_at timestamp NOT NULL DEFAULT NOW()
      )
    `,
  },
  {
    name: "opssos_tasks: create table",
    sql: `
      CREATE TABLE IF NOT EXISTS opssos_tasks (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id varchar NOT NULL,
        deal_id varchar,
        asset_id varchar,
        assigned_user_id varchar,
        title text NOT NULL,
        description text,
        status text NOT NULL DEFAULT 'todo',
        due_at timestamp,
        cost_cents integer,
        created_at timestamp NOT NULL DEFAULT NOW()
      )
    `,
  },
  {
    name: "opssos_checklist_templates: create table",
    sql: `
      CREATE TABLE IF NOT EXISTS opssos_checklist_templates (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id varchar NOT NULL,
        name text NOT NULL,
        items jsonb DEFAULT '[]',
        created_at timestamp NOT NULL DEFAULT NOW()
      )
    `,
  },
  {
    name: "opssos_task_checklists: create table",
    sql: `
      CREATE TABLE IF NOT EXISTS opssos_task_checklists (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id varchar NOT NULL,
        task_id varchar NOT NULL,
        items jsonb DEFAULT '[]',
        created_at timestamp NOT NULL DEFAULT NOW()
      )
    `,
  },
  {
    name: "opssos_statement_templates: create table",
    sql: `
      CREATE TABLE IF NOT EXISTS opssos_statement_templates (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id varchar NOT NULL,
        name text NOT NULL,
        owner_contact_id varchar,
        filters jsonb DEFAULT '{}',
        columns jsonb DEFAULT '[]',
        totals jsonb DEFAULT '{}',
        created_at timestamp NOT NULL DEFAULT NOW()
      )
    `,
  },
  {
    name: "opssos_statements: create table",
    sql: `
      CREATE TABLE IF NOT EXISTS opssos_statements (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id varchar NOT NULL,
        template_id varchar NOT NULL,
        period_start date NOT NULL,
        period_end date NOT NULL,
        status text NOT NULL DEFAULT 'draft',
        generated_at timestamp NOT NULL DEFAULT NOW(),
        published_at timestamp,
        created_at timestamp NOT NULL DEFAULT NOW()
      )
    `,
  },
  {
    name: "opssos_statement_exports: create table",
    sql: `
      CREATE TABLE IF NOT EXISTS opssos_statement_exports (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id varchar NOT NULL,
        statement_id varchar NOT NULL,
        format text NOT NULL,
        file_url text NOT NULL,
        created_at timestamp NOT NULL DEFAULT NOW()
      )
    `,
  },
  {
    name: "opssos_integrations: create table",
    sql: `
      CREATE TABLE IF NOT EXISTS opssos_integrations (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id varchar NOT NULL,
        provider text NOT NULL,
        status text NOT NULL DEFAULT 'inactive',
        credentials_encrypted text,
        settings jsonb DEFAULT '{}',
        created_at timestamp NOT NULL DEFAULT NOW()
      )
    `,
  },
  {
    name: "opssos_webhooks: create table",
    sql: `
      CREATE TABLE IF NOT EXISTS opssos_webhooks (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id varchar NOT NULL,
        url text NOT NULL,
        secret text,
        enabled boolean NOT NULL DEFAULT true,
        event_types jsonb DEFAULT '[]',
        created_at timestamp NOT NULL DEFAULT NOW()
      )
    `,
  },
  {
    name: "opssos_webhook_deliveries: create table",
    sql: `
      CREATE TABLE IF NOT EXISTS opssos_webhook_deliveries (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id varchar NOT NULL,
        webhook_id varchar NOT NULL,
        event_type text NOT NULL,
        payload jsonb DEFAULT '{}',
        status text NOT NULL DEFAULT 'pending',
        response_code integer,
        created_at timestamp NOT NULL DEFAULT NOW()
      )
    `,
  },

  // ── ops_boat_club_memberships and ops_boat_sales ──────────────────────────
  {
    name: "ops_boat_club_memberships: create table",
    sql: `
      CREATE TABLE IF NOT EXISTS ops_boat_club_memberships (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        marina_id varchar NOT NULL,
        org_id varchar NOT NULL,
        member_id varchar(100) NOT NULL,
        member_name text,
        start_date date NOT NULL,
        end_date date,
        tier varchar(50),
        monthly_dues numeric(10,2) NOT NULL,
        status varchar(20) DEFAULT 'active',
        source text DEFAULT 'MANUAL',
        notes text,
        created_by varchar,
        created_at timestamp NOT NULL DEFAULT NOW(),
        updated_at timestamp NOT NULL DEFAULT NOW()
      )
    `,
  },
  {
    name: "ops_boat_sales: create table",
    sql: `
      CREATE TABLE IF NOT EXISTS ops_boat_sales (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        marina_id varchar NOT NULL,
        org_id varchar NOT NULL,
        sale_date date NOT NULL,
        make_model varchar(200) NOT NULL,
        gross_sales numeric(14,2) NOT NULL,
        cogs numeric(14,2) DEFAULT 0,
        source text DEFAULT 'MANUAL',
        notes text,
        created_by varchar,
        created_at timestamp NOT NULL DEFAULT NOW(),
        updated_at timestamp NOT NULL DEFAULT NOW()
      )
    `,
  },
  {
    name: "ops_import_events: create table",
    sql: `
      CREATE TABLE IF NOT EXISTS ops_import_events (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id varchar NOT NULL,
        marina_id varchar NOT NULL,
        org_id varchar NOT NULL,
        scope text NOT NULL,
        range_start date NOT NULL,
        range_end date NOT NULL,
        overwrite boolean DEFAULT false,
        rows_written integer DEFAULT 0,
        months_affected integer DEFAULT 0,
        duration_ms integer,
        status varchar(20) DEFAULT 'completed',
        error_message text,
        created_by varchar NOT NULL,
        created_at timestamp NOT NULL DEFAULT NOW()
      )
    `,
  },

  // ── valuator_project_context ──────────────────────────────────────────────
  {
    name: "valuator_project_type enum: create if not exists",
    sql: `
      DO $$ BEGIN
        CREATE TYPE valuator_project_type AS ENUM ('OWNED','ACQUISITION','BROKER_LISTING');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `,
  },
  {
    name: "valuator_project_context: create table",
    sql: `
      CREATE TABLE IF NOT EXISTS valuator_project_context (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id varchar NOT NULL UNIQUE,
        marina_id varchar,
        project_type text NOT NULL DEFAULT 'ACQUISITION',
        default_data_source varchar(20) DEFAULT 'ASSUMPTIONS',
        last_import_at timestamp,
        assumptions_coverage_months integer DEFAULT 0,
        org_id varchar,
        created_at timestamp NOT NULL DEFAULT NOW(),
        updated_at timestamp NOT NULL DEFAULT NOW()
      )
    `,
  },

  // ── asmp_* tables ─────────────────────────────────────────────────────────
  {
    name: "asmp_fuel: create table",
    sql: `
      CREATE TABLE IF NOT EXISTS asmp_fuel (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id varchar NOT NULL,
        org_id varchar NOT NULL,
        period_month date NOT NULL,
        gallons numeric(12,4),
        avg_retail_price numeric(8,4),
        avg_cost_price numeric(8,4),
        margin_pct numeric(6,4),
        growth_pct numeric(6,4),
        seasonal_index numeric(6,4) DEFAULT 1.0,
        revenue numeric(14,2),
        cogs numeric(14,2),
        gross_profit numeric(14,2),
        imported_at timestamp,
        import_source varchar(20),
        notes text,
        created_at timestamp NOT NULL DEFAULT NOW(),
        updated_at timestamp NOT NULL DEFAULT NOW(),
        UNIQUE(project_id, period_month)
      )
    `,
  },
  {
    name: "asmp_ship_store: create table",
    sql: `
      CREATE TABLE IF NOT EXISTS asmp_ship_store (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id varchar NOT NULL,
        org_id varchar NOT NULL,
        period_month date NOT NULL,
        revenue numeric(14,2),
        cogs_pct numeric(6,4),
        growth_pct numeric(6,4),
        seasonal_index numeric(6,4) DEFAULT 1.0,
        txn_count integer,
        avg_ticket numeric(10,2),
        cogs numeric(14,2),
        gross_profit numeric(14,2),
        imported_at timestamp,
        import_source varchar(20),
        notes text,
        created_at timestamp NOT NULL DEFAULT NOW(),
        updated_at timestamp NOT NULL DEFAULT NOW(),
        UNIQUE(project_id, period_month)
      )
    `,
  },
  {
    name: "asmp_service: create table",
    sql: `
      CREATE TABLE IF NOT EXISTS asmp_service (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id varchar NOT NULL,
        org_id varchar NOT NULL,
        period_month date NOT NULL,
        labor_revenue numeric(14,2),
        parts_revenue numeric(14,2),
        cogs_pct numeric(6,4),
        growth_pct numeric(6,4),
        work_order_count integer,
        total_revenue numeric(14,2),
        cogs numeric(14,2),
        gross_profit numeric(14,2),
        imported_at timestamp,
        import_source varchar(20),
        notes text,
        created_at timestamp NOT NULL DEFAULT NOW(),
        updated_at timestamp NOT NULL DEFAULT NOW(),
        UNIQUE(project_id, period_month)
      )
    `,
  },
  {
    name: "asmp_commercial_tenants: create table",
    sql: `
      CREATE TABLE IF NOT EXISTS asmp_commercial_tenants (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id varchar NOT NULL,
        org_id varchar NOT NULL,
        period_month date NOT NULL,
        tenant_count integer,
        total_sqft integer,
        occupied_sqft integer,
        avg_rent_per_sqft numeric(8,2),
        occupancy_pct numeric(6,4),
        other_income numeric(12,2),
        growth_pct numeric(6,4),
        base_rent_revenue numeric(14,2),
        cam_revenue numeric(14,2),
        total_revenue numeric(14,2),
        imported_at timestamp,
        import_source varchar(20),
        notes text,
        created_at timestamp NOT NULL DEFAULT NOW(),
        updated_at timestamp NOT NULL DEFAULT NOW(),
        UNIQUE(project_id, period_month)
      )
    `,
  },
  {
    name: "asmp_boat_rentals: create table",
    sql: `
      CREATE TABLE IF NOT EXISTS asmp_boat_rentals (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id varchar NOT NULL,
        org_id varchar NOT NULL,
        period_month date NOT NULL,
        hours numeric(10,2),
        avg_rate_per_hour numeric(10,2),
        utilization_pct numeric(6,4),
        growth_pct numeric(6,4),
        revenue numeric(14,2),
        imported_at timestamp,
        import_source varchar(20),
        notes text,
        created_at timestamp NOT NULL DEFAULT NOW(),
        updated_at timestamp NOT NULL DEFAULT NOW(),
        UNIQUE(project_id, period_month)
      )
    `,
  },
  {
    name: "asmp_boat_club: create table",
    sql: `
      CREATE TABLE IF NOT EXISTS asmp_boat_club (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id varchar NOT NULL,
        org_id varchar NOT NULL,
        period_month date NOT NULL,
        member_count integer,
        avg_monthly_dues numeric(10,2),
        churn_pct numeric(6,4),
        growth_pct numeric(6,4),
        mrr numeric(14,2),
        imported_at timestamp,
        import_source varchar(20),
        notes text,
        created_at timestamp NOT NULL DEFAULT NOW(),
        updated_at timestamp NOT NULL DEFAULT NOW(),
        UNIQUE(project_id, period_month)
      )
    `,
  },
  {
    name: "asmp_boat_sales: create table",
    sql: `
      CREATE TABLE IF NOT EXISTS asmp_boat_sales (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id varchar NOT NULL,
        org_id varchar NOT NULL,
        period_month date NOT NULL,
        units integer,
        avg_sale_price numeric(14,2),
        margin_pct numeric(6,4),
        growth_pct numeric(6,4),
        revenue numeric(14,2),
        cogs numeric(14,2),
        gross_profit numeric(14,2),
        imported_at timestamp,
        import_source varchar(20),
        notes text,
        created_at timestamp NOT NULL DEFAULT NOW(),
        updated_at timestamp NOT NULL DEFAULT NOW(),
        UNIQUE(project_id, period_month)
      )
    `,
  },
  {
    name: "asmp_bookkeeping: create table",
    sql: `
      CREATE TABLE IF NOT EXISTS asmp_bookkeeping (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id varchar NOT NULL,
        org_id varchar NOT NULL,
        period_month date NOT NULL,
        revenue numeric(14,2),
        expenses numeric(14,2),
        notes text,
        imported_at timestamp,
        import_source varchar(20),
        created_at timestamp NOT NULL DEFAULT NOW(),
        updated_at timestamp NOT NULL DEFAULT NOW()
      )
    `,
  },

  // ── tenant_leases and related tables ─────────────────────────────────────
  {
    name: "lease_type enum (commercial): create if not exists",
    sql: `
      DO $$ BEGIN
        CREATE TYPE lease_type AS ENUM ('NNN','MOD_GROSS','FULL_GROSS','ABSOLUTE_NNN','OTHER');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `,
  },
  {
    name: "lease_status enum (commercial): create if not exists",
    sql: `
      DO $$ BEGIN
        CREATE TYPE lease_status AS ENUM ('ACTIVE','FUTURE','EXPIRING','EXPIRED','ARCHIVED');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `,
  },
  {
    name: "security_deposit_type enum: create if not exists",
    sql: `
      DO $$ BEGIN
        CREATE TYPE security_deposit_type AS ENUM ('CASH','LOC','NONE');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `,
  },
  {
    name: "term_type enum: create if not exists",
    sql: `
      DO $$ BEGIN
        CREATE TYPE term_type AS ENUM ('INITIAL','OPTION');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `,
  },
  {
    name: "rent_input_unit enum: create if not exists",
    sql: `
      DO $$ BEGIN
        CREATE TYPE rent_input_unit AS ENUM ('PSF_YEAR','PER_MONTH','PER_YEAR');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `,
  },
  {
    name: "escalation_type enum (tenant): create if not exists",
    sql: `
      DO $$ BEGIN
        CREATE TYPE escalation_type AS ENUM ('NONE','PERCENT','FIXED_DOLLAR','DOLLAR_PSF_YEAR','CPI','CPI_CAP_FLOOR','SCHEDULE');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `,
  },
  {
    name: "recovery_type enum: create if not exists",
    sql: `
      DO $$ BEGIN
        CREATE TYPE recovery_type AS ENUM ('CAM','TAXES','INSURANCE','UTILITIES','TRASH','SECURITY','OTHER');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `,
  },
  {
    name: "recovery_method enum: create if not exists",
    sql: `
      DO $$ BEGIN
        CREATE TYPE recovery_method AS ENUM ('PRO_RATA','BASE_YEAR_STOP','EXPENSE_STOP_PSF','FIXED_MONTHLY','FIXED_ANNUAL');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `,
  },
  {
    name: "breakpoint_type enum: create if not exists",
    sql: `
      DO $$ BEGIN
        CREATE TYPE breakpoint_type AS ENUM ('NATURAL','ARTIFICIAL');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `,
  },
  {
    name: "settlement_frequency enum: create if not exists",
    sql: `
      DO $$ BEGIN
        CREATE TYPE settlement_frequency AS ENUM ('MONTHLY','QUARTERLY','ANNUAL');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `,
  },
  {
    name: "concession_type enum: create if not exists",
    sql: `
      DO $$ BEGIN
        CREATE TYPE concession_type AS ENUM ('FREE_RENT','DISCOUNT_PERCENT','DISCOUNT_FIXED','OTHER');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `,
  },
  {
    name: "ti_payment_timing enum: create if not exists",
    sql: `
      DO $$ BEGIN
        CREATE TYPE ti_payment_timing AS ENUM ('UPFRONT','REIMBURSEMENT','DRAW_SCHEDULE');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `,
  },
  {
    name: "lc_payment_timing enum: create if not exists",
    sql: `
      DO $$ BEGIN
        CREATE TYPE lc_payment_timing AS ENUM ('AT_SIGNING','SPREAD');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `,
  },
  {
    name: "tenant_leases: create table",
    sql: `
      CREATE TABLE IF NOT EXISTS tenant_leases (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id uuid NOT NULL,
        tenant_name text NOT NULL,
        suite_label text,
        sf numeric(12,2) NOT NULL,
        unit_count integer,
        lease_type text NOT NULL DEFAULT 'NNN',
        lease_start_date date NOT NULL,
        rent_commencement_date date,
        lease_end_date date NOT NULL,
        security_deposit_amount numeric(12,2),
        security_deposit_type text DEFAULT 'NONE',
        notes text,
        status text NOT NULL DEFAULT 'ACTIVE',
        created_at timestamp NOT NULL DEFAULT NOW(),
        updated_at timestamp NOT NULL DEFAULT NOW()
      )
    `,
  },
  {
    name: "tenant_rent_terms: create table",
    sql: `
      CREATE TABLE IF NOT EXISTS tenant_rent_terms (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        lease_id uuid NOT NULL REFERENCES tenant_leases(id) ON DELETE CASCADE,
        term_type text NOT NULL DEFAULT 'INITIAL',
        option_index integer,
        term_start_date date NOT NULL,
        term_end_date date NOT NULL,
        base_rent_input_unit text NOT NULL DEFAULT 'PSF_YEAR',
        base_rent_input_value numeric(12,4) NOT NULL,
        escalation_type text NOT NULL DEFAULT 'NONE',
        escalation_value numeric(8,4),
        escalation_frequency_months integer,
        escalation_cap_percent numeric(6,4),
        escalation_floor_percent numeric(6,4),
        escalation_cpi_series text,
        schedule_json jsonb,
        created_at timestamp NOT NULL DEFAULT NOW(),
        updated_at timestamp NOT NULL DEFAULT NOW()
      )
    `,
  },
  {
    name: "tenant_recoveries: create table",
    sql: `
      CREATE TABLE IF NOT EXISTS tenant_recoveries (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        lease_id uuid NOT NULL REFERENCES tenant_leases(id) ON DELETE CASCADE,
        recovery_type text NOT NULL,
        method text NOT NULL,
        amount numeric(12,2),
        psf_amount numeric(8,4),
        admin_fee_percent numeric(5,2),
        gross_up_to_occupancy numeric(5,2),
        nonrecoverable_percent numeric(5,2),
        expense_growth_rate_percent numeric(5,2),
        created_at timestamp NOT NULL DEFAULT NOW(),
        updated_at timestamp NOT NULL DEFAULT NOW()
      )
    `,
  },
  {
    name: "tenant_percentage_rent: create table",
    sql: `
      CREATE TABLE IF NOT EXISTS tenant_percentage_rent (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        lease_id uuid NOT NULL REFERENCES tenant_leases(id) ON DELETE CASCADE,
        enabled boolean NOT NULL DEFAULT false,
        breakpoint_type text DEFAULT 'NATURAL',
        breakpoint_amount_annual numeric(14,2),
        overage_percent numeric(6,4),
        settlement_frequency text DEFAULT 'MONTHLY',
        exclusions_json jsonb,
        created_at timestamp NOT NULL DEFAULT NOW(),
        updated_at timestamp NOT NULL DEFAULT NOW()
      )
    `,
  },
  {
    name: "tenant_sales: create table",
    sql: `
      CREATE TABLE IF NOT EXISTS tenant_sales (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        lease_id uuid NOT NULL REFERENCES tenant_leases(id) ON DELETE CASCADE,
        period_end_date date NOT NULL,
        gross_sales numeric(14,2) NOT NULL,
        created_at timestamp NOT NULL DEFAULT NOW(),
        updated_at timestamp NOT NULL DEFAULT NOW()
      )
    `,
  },
  {
    name: "tenant_concessions: create table",
    sql: `
      CREATE TABLE IF NOT EXISTS tenant_concessions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        lease_id uuid NOT NULL REFERENCES tenant_leases(id) ON DELETE CASCADE,
        concession_type text NOT NULL,
        start_date date NOT NULL,
        end_date date NOT NULL,
        value numeric(12,2) NOT NULL,
        notes text,
        created_at timestamp NOT NULL DEFAULT NOW(),
        updated_at timestamp NOT NULL DEFAULT NOW()
      )
    `,
  },
  {
    name: "tenant_capex_leasing: create table",
    sql: `
      CREATE TABLE IF NOT EXISTS tenant_capex_leasing (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        lease_id uuid NOT NULL REFERENCES tenant_leases(id) ON DELETE CASCADE,
        ti_allowance_psf numeric(8,2),
        ti_total numeric(12,2),
        ti_payment_timing text DEFAULT 'UPFRONT',
        lc_percent_initial numeric(6,4),
        lc_percent_renewal numeric(6,4),
        lc_payment_timing text DEFAULT 'AT_SIGNING',
        created_at timestamp NOT NULL DEFAULT NOW(),
        updated_at timestamp NOT NULL DEFAULT NOW()
      )
    `,
  },
  {
    name: "tenant_rollover_assumptions: create table",
    sql: `
      CREATE TABLE IF NOT EXISTS tenant_rollover_assumptions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        lease_id uuid NOT NULL REFERENCES tenant_leases(id) ON DELETE CASCADE,
        assume_renewal boolean NOT NULL DEFAULT false,
        renewal_probability numeric(5,4),
        downtime_months integer DEFAULT 0,
        market_rent_psf_year numeric(10,2),
        market_rent_growth_percent numeric(5,2),
        renewal_ti_psf numeric(8,2),
        renewal_lc_percent numeric(6,4),
        created_at timestamp NOT NULL DEFAULT NOW(),
        updated_at timestamp NOT NULL DEFAULT NOW()
      )
    `,
  },

  // ── pipeline_templates and related ────────────────────────────────────────
  {
    name: "pipeline_automation_rules: create table",
    sql: `
      CREATE TABLE IF NOT EXISTS pipeline_automation_rules (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id varchar NOT NULL,
        name text NOT NULL,
        trigger_type text NOT NULL,
        trigger_config jsonb NOT NULL DEFAULT '{}',
        action_type text NOT NULL,
        action_config jsonb NOT NULL DEFAULT '{}',
        is_active boolean NOT NULL DEFAULT true,
        execution_count integer DEFAULT 0,
        last_executed_at timestamp,
        created_by varchar NOT NULL,
        created_at timestamp NOT NULL DEFAULT NOW(),
        updated_at timestamp NOT NULL DEFAULT NOW()
      )
    `,
  },
  {
    name: "deal_scoring_models: create table",
    sql: `
      CREATE TABLE IF NOT EXISTS deal_scoring_models (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id varchar NOT NULL,
        name text NOT NULL DEFAULT 'Default',
        criteria jsonb NOT NULL DEFAULT '[]',
        is_default boolean DEFAULT true,
        created_at timestamp NOT NULL DEFAULT NOW(),
        updated_at timestamp NOT NULL DEFAULT NOW()
      )
    `,
  },
  {
    name: "deal_scores: create table",
    sql: `
      CREATE TABLE IF NOT EXISTS deal_scores (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id varchar NOT NULL,
        deal_id varchar NOT NULL,
        model_id varchar,
        scores jsonb NOT NULL DEFAULT '{}',
        total_score numeric(5,1),
        grade text,
        scored_by varchar,
        scored_at timestamp NOT NULL DEFAULT NOW(),
        created_at timestamp NOT NULL DEFAULT NOW()
      )
    `,
  },
  {
    name: "pipeline_templates: create table",
    sql: `
      CREATE TABLE IF NOT EXISTS pipeline_templates (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id varchar NOT NULL,
        name text NOT NULL,
        deal_type text NOT NULL,
        stages jsonb NOT NULL DEFAULT '[]',
        default_checklist_template varchar,
        is_default boolean DEFAULT false,
        created_at timestamp NOT NULL DEFAULT NOW(),
        updated_at timestamp NOT NULL DEFAULT NOW()
      )
    `,
  },
  {
    name: "deal_competitors: create table",
    sql: `
      CREATE TABLE IF NOT EXISTS deal_competitors (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id varchar NOT NULL,
        deal_id varchar NOT NULL,
        competitor_name text NOT NULL,
        estimated_bid numeric(12,2),
        strengths text,
        weaknesses text,
        intel_source text,
        notes text,
        created_by varchar,
        created_at timestamp NOT NULL DEFAULT NOW(),
        updated_at timestamp NOT NULL DEFAULT NOW()
      )
    `,
  },

  // ── loan tables ───────────────────────────────────────────────────────────
  {
    name: "loan_structures: create table",
    sql: `
      CREATE TABLE IF NOT EXISTS loan_structures (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id varchar NOT NULL,
        capital_stack_id varchar NOT NULL,
        modeling_project_id varchar,
        name text NOT NULL,
        description text,
        structure_type text NOT NULL DEFAULT 'single',
        total_debt_amount numeric(18,2),
        blended_interest_rate numeric(8,4),
        blended_term_months integer,
        combined_ltv numeric(8,4),
        total_annual_debt_service numeric(18,2),
        is_comparison_mode boolean DEFAULT false,
        is_active boolean DEFAULT true,
        created_at timestamp NOT NULL DEFAULT NOW(),
        updated_at timestamp NOT NULL DEFAULT NOW(),
        created_by varchar
      )
    `,
  },
  {
    name: "loan_details: create table",
    sql: `
      CREATE TABLE IF NOT EXISTS loan_details (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id varchar NOT NULL,
        debt_tranche_id varchar NOT NULL,
        loan_structure_id varchar,
        loan_purpose text NOT NULL DEFAULT 'acquisition',
        lender_name text,
        lender_type text,
        lender_contact text,
        ltv_at_origination numeric(8,4),
        max_ltv numeric(8,4),
        exit_fee_type text,
        exit_fee_amount numeric(18,2),
        exit_fee_pct numeric(8,4),
        exit_fee_expires_month integer,
        prepayment_penalty_type text DEFAULT 'none',
        prepayment_lockout_months integer DEFAULT 0,
        prepayment_schedule jsonb,
        yield_maintenance_spread numeric(8,4),
        dscr_minimum numeric(8,4) DEFAULT 1.20,
        dscr_test_frequency text DEFAULT 'quarterly',
        dscr_test_start_month integer DEFAULT 1,
        dscr_cash_trap numeric(8,4),
        debt_yield_minimum numeric(8,4),
        is_draw_loan boolean DEFAULT false,
        draw_schedule jsonb,
        construction_period_months integer,
        transitions_to_loan_id varchar,
        transition_month integer,
        transition_type text,
        is_floating_rate boolean DEFAULT false,
        floating_rate_index text,
        floating_rate_spread_bps integer,
        rate_cap numeric(8,4),
        rate_floor numeric(8,4),
        extension_options jsonb,
        is_recourse boolean DEFAULT false,
        recourse_percentage numeric(8,4),
        recourse_description text,
        created_at timestamp NOT NULL DEFAULT NOW(),
        updated_at timestamp NOT NULL DEFAULT NOW()
      )
    `,
  },
  {
    name: "monthly_loan_schedule: create table",
    sql: `
      CREATE TABLE IF NOT EXISTS monthly_loan_schedule (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id varchar NOT NULL,
        debt_tranche_id varchar NOT NULL,
        capital_stack_id varchar NOT NULL,
        period_month integer NOT NULL,
        period_year integer NOT NULL,
        period_date date NOT NULL,
        beginning_balance numeric(18,2) NOT NULL,
        ending_balance numeric(18,2) NOT NULL,
        scheduled_payment numeric(18,2) NOT NULL,
        principal_payment numeric(18,2) NOT NULL,
        interest_payment numeric(18,2) NOT NULL,
        interest_rate numeric(8,4) NOT NULL,
        is_interest_only boolean DEFAULT false,
        is_draw_period boolean DEFAULT false,
        draw_amount numeric(18,2),
        prepayment_amount numeric(18,2),
        prepayment_penalty numeric(18,2),
        period_noi numeric(18,2),
        period_dscr numeric(8,4),
        dscr_pass_fail boolean,
        created_at timestamp NOT NULL DEFAULT NOW()
      )
    `,
  },
  {
    name: "dscr_test_results: create table",
    sql: `
      CREATE TABLE IF NOT EXISTS dscr_test_results (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id varchar NOT NULL,
        debt_tranche_id varchar NOT NULL,
        capital_stack_id varchar NOT NULL,
        test_date date NOT NULL,
        test_period text NOT NULL,
        trailing_noi numeric(18,2) NOT NULL,
        annual_debt_service numeric(18,2) NOT NULL,
        calculated_dscr numeric(8,4) NOT NULL,
        required_dscr numeric(8,4) NOT NULL,
        passed_test boolean NOT NULL,
        cushion_amount numeric(18,2),
        cushion_pct numeric(8,4),
        notes text,
        created_at timestamp NOT NULL DEFAULT NOW()
      )
    `,
  },
  {
    name: "loan_comparison_scenarios: create table",
    sql: `
      CREATE TABLE IF NOT EXISTS loan_comparison_scenarios (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id varchar NOT NULL,
        modeling_project_id varchar,
        capital_stack_id varchar,
        name text NOT NULL,
        description text,
        scenario_loans jsonb,
        comparison_metrics jsonb,
        selected_loan_id varchar,
        is_active boolean DEFAULT true,
        created_at timestamp NOT NULL DEFAULT NOW(),
        updated_at timestamp NOT NULL DEFAULT NOW(),
        created_by varchar
      )
    `,
  },

  // ── marinalytics tables ───────────────────────────────────────────────────
  {
    name: "marinalytics_metric_category enum: create if not exists",
    sql: `
      DO $$ BEGIN
        CREATE TYPE marinalytics_metric_category AS ENUM ('operational','financial','occupancy','pricing','maintenance','safety','environmental','customer');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `,
  },
  {
    name: "marinalytics_metric_unit enum: create if not exists",
    sql: `
      DO $$ BEGIN
        CREATE TYPE marinalytics_metric_unit AS ENUM ('percentage','currency','count','ratio','days','hours','gallons','square_feet','linear_feet');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `,
  },
  {
    name: "marinalytics_cohort_type enum: create if not exists",
    sql: `
      DO $$ BEGIN
        CREATE TYPE marinalytics_cohort_type AS ENUM ('size','region','asset_type','ownership_type','age');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `,
  },
  {
    name: "marinalytics_metric_definitions: create table",
    sql: `
      CREATE TABLE IF NOT EXISTS marinalytics_metric_definitions (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        metric_key varchar(100) NOT NULL UNIQUE,
        name varchar(255) NOT NULL,
        description text,
        category text NOT NULL,
        unit text NOT NULL,
        calculation_formula text,
        is_system boolean DEFAULT true,
        display_order integer DEFAULT 0,
        created_at timestamp DEFAULT NOW()
      )
    `,
  },
  {
    name: "marinalytics_operator_profiles: create table",
    sql: `
      CREATE TABLE IF NOT EXISTS marinalytics_operator_profiles (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id varchar NOT NULL,
        company_id varchar NOT NULL,
        capital_partner varchar(255),
        focus_segments text[],
        primary_regions text[],
        total_marina_count integer DEFAULT 0,
        total_slip_count integer DEFAULT 0,
        total_linear_feet integer DEFAULT 0,
        acquisition_start_year integer,
        preferred_benchmark_cohorts jsonb,
        notes text,
        created_at timestamp DEFAULT NOW(),
        updated_at timestamp DEFAULT NOW()
      )
    `,
  },
  {
    name: "marinalytics_metric_snapshots: create table",
    sql: `
      CREATE TABLE IF NOT EXISTS marinalytics_metric_snapshots (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id varchar NOT NULL,
        operator_profile_id varchar,
        property_id varchar,
        metric_key varchar(100) NOT NULL,
        period_start date NOT NULL,
        period_end date NOT NULL,
        value numeric(15,4) NOT NULL,
        source_type varchar(50),
        confidence varchar(20) DEFAULT 'high',
        source_document_id varchar,
        notes text,
        metadata jsonb,
        created_at timestamp DEFAULT NOW(),
        created_by varchar
      )
    `,
  },
  {
    name: "marinalytics_benchmark_sets: create table",
    sql: `
      CREATE TABLE IF NOT EXISTS marinalytics_benchmark_sets (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id varchar,
        name varchar(255) NOT NULL,
        description text,
        cohort_type text NOT NULL,
        cohort_value varchar(255),
        metric_key varchar(100) NOT NULL,
        p10 numeric(15,4),
        p25 numeric(15,4),
        p50 numeric(15,4),
        p75 numeric(15,4),
        p90 numeric(15,4),
        mean numeric(15,4),
        sample_size integer DEFAULT 0,
        period_year integer,
        is_system boolean DEFAULT false,
        notes text,
        created_at timestamp DEFAULT NOW(),
        updated_at timestamp DEFAULT NOW()
      )
    `,
  },
  {
    name: "marinalytics_capital_partners: create table",
    sql: `
      CREATE TABLE IF NOT EXISTS marinalytics_capital_partners (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id varchar NOT NULL,
        name varchar(255) NOT NULL,
        type varchar(100),
        aum numeric(15,2),
        marina_focus_percentage numeric(5,2),
        headquarters varchar(255),
        website varchar(500),
        founded_year integer,
        notes text,
        metadata jsonb,
        created_at timestamp DEFAULT NOW(),
        updated_at timestamp DEFAULT NOW()
      )
    `,
  },

  // ── exit strategy tables ──────────────────────────────────────────────────
  {
    name: "exit_scenario_templates: create table",
    sql: `
      CREATE TABLE IF NOT EXISTS exit_scenario_templates (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        code varchar(50) NOT NULL UNIQUE,
        name text NOT NULL,
        description text,
        category text NOT NULL,
        input_schema jsonb NOT NULL,
        output_schema jsonb,
        ui_config jsonb,
        calculator_id varchar(100),
        ccim_worksheet_type varchar(20),
        version integer DEFAULT 1,
        is_system_template boolean DEFAULT true,
        is_active boolean DEFAULT true,
        supports_multi_year boolean DEFAULT true,
        supports_mortgage_tracking boolean DEFAULT true,
        supports_basis_ledger boolean DEFAULT true,
        supports_tax_deferral boolean DEFAULT false,
        supports_waterfall boolean DEFAULT false,
        sort_order integer DEFAULT 0,
        created_at timestamp NOT NULL DEFAULT NOW(),
        updated_at timestamp NOT NULL DEFAULT NOW()
      )
    `,
  },
  {
    name: "exit_scenario_loans: create table",
    sql: `
      CREATE TABLE IF NOT EXISTS exit_scenario_loans (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        exit_scenario_id varchar NOT NULL,
        org_id varchar NOT NULL,
        name text NOT NULL,
        loan_type text NOT NULL DEFAULT 'permanent',
        lender_name text,
        original_amount numeric(18,2) NOT NULL,
        interest_rate numeric(8,6) NOT NULL,
        amortization_period_months integer,
        loan_term_months integer NOT NULL,
        origination_date timestamp,
        maturity_date timestamp,
        is_interest_only boolean DEFAULT false,
        interest_only_months integer DEFAULT 0,
        monthly_payment numeric(18,2),
        annual_debt_service numeric(18,2),
        loan_fees numeric(18,2) DEFAULT 0,
        loan_costs numeric(18,2) DEFAULT 0,
        prepayment_penalty_type varchar(30),
        prepayment_penalty_schedule jsonb,
        has_balloon boolean DEFAULT false,
        balloon_amount numeric(18,2),
        balloon_year integer,
        assumed_refi_rate numeric(8,6),
        principal_balances_by_year jsonb,
        interest_paid_by_year jsonb,
        principal_paid_by_year jsonb,
        amortization_schedule jsonb,
        priority integer DEFAULT 1,
        is_active boolean DEFAULT true,
        created_at timestamp NOT NULL DEFAULT NOW(),
        updated_at timestamp NOT NULL DEFAULT NOW()
      )
    `,
  },
  {
    name: "exit_scenario_basis_ledger: create table",
    sql: `
      CREATE TABLE IF NOT EXISTS exit_scenario_basis_ledger (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        exit_scenario_id varchar NOT NULL,
        org_id varchar NOT NULL,
        original_purchase_price numeric(18,2) NOT NULL,
        acquisition_costs numeric(18,2) DEFAULT 0,
        initial_basis numeric(18,2) NOT NULL,
        land_value_at_acquisition numeric(18,2),
        improvement_value_at_acquisition numeric(18,2),
        personal_property_value numeric(18,2) DEFAULT 0,
        capital_additions numeric(18,2) DEFAULT 0,
        capital_additions_by_year jsonb,
        capital_additions_detail jsonb,
        depreciation_schedule_years integer DEFAULT 39,
        cost_recovery_taken numeric(18,2) DEFAULT 0,
        cost_recovery_by_year jsonb,
        straight_line_recapture numeric(18,2) DEFAULT 0,
        has_cost_segregation boolean DEFAULT false,
        cost_segregation_bonus numeric(18,2) DEFAULT 0,
        cost_segregation_year integer,
        accelerated_depreciation numeric(18,2) DEFAULT 0,
        partial_sales_proceeds numeric(18,2) DEFAULT 0,
        partial_sales_detail jsonb,
        adjusted_basis numeric(18,2) NOT NULL,
        prior_1031_deferred_gain numeric(18,2) DEFAULT 0,
        prior_1031_carryover_basis numeric(18,2),
        suspended_passive_losses numeric(18,2) DEFAULT 0,
        suspended_losses_by_year jsonb,
        created_at timestamp NOT NULL DEFAULT NOW(),
        updated_at timestamp NOT NULL DEFAULT NOW()
      )
    `,
  },
  {
    name: "exit_scenario_multi_year_cashflows: create table",
    sql: `
      CREATE TABLE IF NOT EXISTS exit_scenario_multi_year_cashflows (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        exit_scenario_id varchar NOT NULL,
        org_id varchar NOT NULL,
        year integer NOT NULL,
        period_start timestamp,
        period_end timestamp,
        potential_gross_income numeric(18,2),
        vacancy_credit_loss numeric(18,2),
        effective_gross_income numeric(18,2),
        operating_expenses numeric(18,2),
        net_operating_income numeric(18,2),
        capital_expenditures numeric(18,2),
        net_cash_flow_before_debt numeric(18,2),
        debt_service numeric(18,2),
        net_cash_flow_after_debt numeric(18,2),
        loan_balances_by_lien jsonb,
        cashflow_details jsonb,
        created_at timestamp NOT NULL DEFAULT NOW(),
        updated_at timestamp NOT NULL DEFAULT NOW()
      )
    `,
  },
  {
    name: "exit_scenario_tax_profiles: create table",
    sql: `
      CREATE TABLE IF NOT EXISTS exit_scenario_tax_profiles (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        exit_scenario_id varchar NOT NULL,
        org_id varchar NOT NULL,
        filing_status text NOT NULL DEFAULT 'single',
        adjusted_gross_income numeric(18,2),
        state_of_residence varchar(2) DEFAULT 'CA',
        is_qualified_opportunity_zone boolean DEFAULT false,
        is_real_estate_professional boolean DEFAULT false,
        gross_sale_price numeric(18,2) NOT NULL,
        costs_of_sale numeric(18,2) DEFAULT 0,
        broker_commission numeric(18,2),
        legal_and_closing numeric(18,2),
        transfer_taxes numeric(18,2),
        net_sale_price numeric(18,2),
        participation_payments numeric(18,2) DEFAULT 0,
        earnout_payments numeric(18,2) DEFAULT 0,
        total_gain numeric(18,2),
        suspended_losses_utilized numeric(18,2) DEFAULT 0,
        net_gain_after_suspended_losses numeric(18,2),
        long_term_capital_gain numeric(18,2),
        short_term_capital_gain numeric(18,2) DEFAULT 0,
        unrecaptured_section_1250 numeric(18,2),
        section_1245_recapture numeric(18,2) DEFAULT 0,
        federal_long_term_rate numeric(8,6) DEFAULT 0.20,
        federal_short_term_rate numeric(8,6) DEFAULT 0.37,
        section_1250_rate numeric(8,6) DEFAULT 0.25,
        niit_rate numeric(8,6) DEFAULT 0.038,
        state_tax_rate numeric(8,6),
        federal_long_term_tax numeric(18,2),
        federal_short_term_tax numeric(18,2),
        section_1250_tax numeric(18,2),
        section_1245_tax numeric(18,2),
        niit_tax numeric(18,2),
        state_tax numeric(18,2),
        total_tax_liability numeric(18,2),
        effective_tax_rate numeric(8,6),
        after_tax_proceeds numeric(18,2),
        is_installment_sale boolean DEFAULT false,
        gross_profit_ratio numeric(8,6),
        yearly_taxable_gain jsonb,
        yearly_tax_liability jsonb,
        created_at timestamp NOT NULL DEFAULT NOW(),
        updated_at timestamp NOT NULL DEFAULT NOW()
      )
    `,
  },
  {
    name: "exit_1031_replacement_properties: create table",
    sql: `
      CREATE TABLE IF NOT EXISTS exit_1031_replacement_properties (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        exchange_1031_id varchar NOT NULL,
        org_id varchar NOT NULL,
        property_name text NOT NULL,
        property_address text,
        property_type text,
        estimated_value numeric(18,2),
        estimated_mortgage numeric(18,2),
        estimated_equity numeric(18,2),
        noi numeric(18,2),
        cap_rate numeric(8,6),
        identification_date timestamp,
        is_selected boolean DEFAULT false,
        closing_date timestamp,
        status varchar(30) DEFAULT 'identified',
        sales_comp_id varchar,
        notes text,
        sort_order integer DEFAULT 0,
        created_at timestamp NOT NULL DEFAULT NOW(),
        updated_at timestamp NOT NULL DEFAULT NOW()
      )
    `,
  },
  {
    name: "exit_dst_interests: create table",
    sql: `
      CREATE TABLE IF NOT EXISTS exit_dst_interests (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        exit_scenario_id varchar NOT NULL,
        org_id varchar NOT NULL,
        dst_name text NOT NULL,
        sponsor_name text,
        fractional_interest numeric(10,8),
        investment_amount numeric(18,2) NOT NULL,
        minimum_investment numeric(18,2),
        property_type text,
        property_location text,
        property_value numeric(18,2),
        leverage_ratio numeric(8,6),
        projected_distribution_rate numeric(8,6),
        projected_annual_distribution numeric(18,2),
        projected_hold_years integer,
        projected_irr numeric(8,6),
        projected_equity_multiple numeric(8,4),
        sponsor_acquisition_fee numeric(8,6),
        sponsor_asset_management_fee numeric(8,6),
        sponsor_disposition_fee numeric(8,6),
        selling_commission numeric(8,6),
        total_loaded_fees numeric(18,2),
        depreciation_passthrough numeric(18,2),
        annual_k1_depreciation numeric(18,2),
        risk_score integer,
        tenant_credit_rating varchar(10),
        lease_term_remaining numeric(8,2),
        is_selected boolean DEFAULT false,
        notes text,
        sort_order integer DEFAULT 0,
        created_at timestamp NOT NULL DEFAULT NOW(),
        updated_at timestamp NOT NULL DEFAULT NOW()
      )
    `,
  },
  {
    name: "exit_waterfall_tiers: create table",
    sql: `
      CREATE TABLE IF NOT EXISTS exit_waterfall_tiers (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        waterfall_structure_id varchar NOT NULL,
        org_id varchar NOT NULL,
        name text NOT NULL,
        tier_number integer NOT NULL,
        hurdle_type varchar(20) NOT NULL DEFAULT 'irr',
        hurdle_rate numeric(8,6) NOT NULL,
        lp_split numeric(8,6) NOT NULL,
        gp_split numeric(8,6) NOT NULL,
        has_catch_up boolean DEFAULT false,
        catch_up_percentage numeric(8,6),
        catch_up_target numeric(8,6),
        tier_amount numeric(18,2),
        lp_distribution numeric(18,2),
        gp_distribution numeric(18,2),
        sort_order integer DEFAULT 0,
        created_at timestamp NOT NULL DEFAULT NOW(),
        updated_at timestamp NOT NULL DEFAULT NOW()
      )
    `,
  },
  {
    name: "exit_capital_calls: create table",
    sql: `
      CREATE TABLE IF NOT EXISTS exit_capital_calls (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        waterfall_structure_id varchar NOT NULL,
        fund_id varchar,
        org_id varchar NOT NULL,
        call_number integer NOT NULL,
        call_date timestamp,
        due_date timestamp,
        call_amount numeric(18,2) NOT NULL,
        call_percentage numeric(8,6),
        purpose text,
        amount_received numeric(18,2) DEFAULT 0,
        status varchar(20) DEFAULT 'scheduled',
        notes text,
        created_at timestamp NOT NULL DEFAULT NOW(),
        updated_at timestamp NOT NULL DEFAULT NOW()
      )
    `,
  },
  {
    name: "exit_scenario_comparisons: create table",
    sql: `
      CREATE TABLE IF NOT EXISTS exit_scenario_comparisons (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        modeling_project_id varchar NOT NULL,
        org_id varchar NOT NULL,
        name text NOT NULL,
        description text,
        scenario_ids jsonb NOT NULL,
        metrics_to_compare jsonb,
        comparison_results jsonb,
        recommended_scenario_id varchar,
        recommendation_reason text,
        created_by varchar,
        created_at timestamp NOT NULL DEFAULT NOW(),
        updated_at timestamp NOT NULL DEFAULT NOW()
      )
    `,
  },

  // ── integration tables ─────────────────────────────────────────────────────
  {
    name: "integration_synced_records: create table",
    sql: `
      CREATE TABLE IF NOT EXISTS integration_synced_records (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id varchar NOT NULL,
        connection_id varchar,
        integration_key text NOT NULL,
        external_id text NOT NULL,
        internal_id varchar NOT NULL,
        internal_table text NOT NULL,
        external_data jsonb DEFAULT '{}',
        last_synced_at timestamp NOT NULL DEFAULT NOW(),
        sync_log_id varchar,
        checksum text,
        created_at timestamp NOT NULL DEFAULT NOW(),
        updated_at timestamp NOT NULL DEFAULT NOW()
      )
    `,
  },
  {
    name: "integration_sync_history: create table",
    sql: `
      CREATE TABLE IF NOT EXISTS integration_sync_history (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id varchar NOT NULL,
        org_id varchar,
        integration_key varchar NOT NULL,
        sync_type text NOT NULL DEFAULT 'full_sync',
        status text NOT NULL DEFAULT 'pending',
        started_at timestamp NOT NULL DEFAULT NOW(),
        completed_at timestamp,
        records_processed integer NOT NULL DEFAULT 0,
        records_created integer NOT NULL DEFAULT 0,
        records_updated integer NOT NULL DEFAULT 0,
        records_deleted integer NOT NULL DEFAULT 0,
        records_failed integer NOT NULL DEFAULT 0,
        error_count integer NOT NULL DEFAULT 0,
        errors jsonb DEFAULT '[]',
        metadata jsonb DEFAULT '{}',
        triggered_by varchar NOT NULL DEFAULT 'manual'
      )
    `,
  },
  {
    name: "integration_sync_metrics: create table",
    sql: `
      CREATE TABLE IF NOT EXISTS integration_sync_metrics (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id varchar NOT NULL,
        org_id varchar,
        integration_key varchar NOT NULL,
        total_records_imported integer NOT NULL DEFAULT 0,
        total_records_exported integer NOT NULL DEFAULT 0,
        total_syncs integer NOT NULL DEFAULT 0,
        successful_syncs integer NOT NULL DEFAULT 0,
        failed_syncs integer NOT NULL DEFAULT 0,
        last_sync_at timestamp,
        last_successful_sync_at timestamp,
        next_scheduled_sync timestamp,
        health_score integer NOT NULL DEFAULT 100,
        average_sync_duration_ms integer NOT NULL DEFAULT 0,
        created_at timestamp NOT NULL DEFAULT NOW(),
        updated_at timestamp DEFAULT NOW()
      )
    `,
  },

  // ── analytics_report_schedules ────────────────────────────────────────────
  {
    name: "report_frequency enum: create if not exists",
    sql: `
      DO $$ BEGIN
        CREATE TYPE report_frequency AS ENUM ('daily','weekly','monthly','quarterly');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `,
  },
  {
    name: "analytics_report_schedules: create table",
    sql: `
      CREATE TABLE IF NOT EXISTS analytics_report_schedules (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id varchar NOT NULL,
        org_id varchar NOT NULL,
        report_type varchar(100) NOT NULL,
        name varchar(255) NOT NULL,
        frequency text NOT NULL,
        day_of_week integer,
        day_of_month integer,
        time_of_day time NOT NULL DEFAULT '09:00:00',
        timezone varchar(100) NOT NULL DEFAULT 'America/New_York',
        recipients text[] NOT NULL DEFAULT '{}',
        filters jsonb DEFAULT '{}',
        include_charts boolean NOT NULL DEFAULT true,
        is_active boolean NOT NULL DEFAULT true,
        last_run_at timestamp,
        next_run_at timestamp,
        created_at timestamp NOT NULL DEFAULT NOW(),
        updated_at timestamp NOT NULL DEFAULT NOW()
      )
    `,
  },

  // ── email_campaign_schedules ──────────────────────────────────────────────
  {
    name: "email_campaign_schedules: create table",
    sql: `
      CREATE TABLE IF NOT EXISTS email_campaign_schedules (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id varchar NOT NULL,
        name text NOT NULL,
        subject text NOT NULL,
        body text NOT NULL,
        audience_type text NOT NULL DEFAULT 'all',
        audience_filter jsonb DEFAULT '{}',
        recipient_count integer DEFAULT 0,
        scheduled_at timestamp,
        sent_at timestamp,
        status text NOT NULL DEFAULT 'draft',
        open_rate numeric(5,2),
        click_rate numeric(5,2),
        created_by varchar NOT NULL,
        created_at timestamp NOT NULL DEFAULT NOW(),
        updated_at timestamp NOT NULL DEFAULT NOW()
      )
    `,
  },

  // ── ai_assistant_feedback ─────────────────────────────────────────────────
  {
    name: "ai_assistant_feedback: create table",
    sql: `
      CREATE TABLE IF NOT EXISTS ai_assistant_feedback (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id varchar NOT NULL,
        org_id varchar NOT NULL,
        message_id varchar NOT NULL,
        rating text NOT NULL,
        advisory_mode text NOT NULL,
        page text NOT NULL,
        message_content text,
        user_query text,
        created_at timestamp NOT NULL DEFAULT NOW()
      )
    `,
  },

  // ── archived contact/company tables ──────────────────────────────────────
  {
    name: "archive_reason enum: create if not exists",
    sql: `
      DO $$ BEGIN
        CREATE TYPE archive_reason AS ENUM ('property_sold','deal_closed','duplicate','inactivated','other');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `,
  },
  {
    name: "archived_contacts: create table",
    sql: `
      CREATE TABLE IF NOT EXISTS archived_contacts (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id varchar NOT NULL,
        original_contact_id varchar NOT NULL,
        first_name text NOT NULL,
        last_name text NOT NULL,
        email text,
        phone text,
        phones jsonb DEFAULT '[]',
        position text,
        address text,
        unit text,
        city text,
        state text,
        zip_code text,
        company text,
        role text,
        contact_type text,
        contact_tag text,
        labels text[] DEFAULT ARRAY[]::text[],
        linkedin_url text,
        twitter_handle text,
        photo_data_url text,
        archive_reason text NOT NULL DEFAULT 'property_sold',
        archive_notes text,
        archived_by varchar NOT NULL,
        archived_at timestamp NOT NULL DEFAULT NOW(),
        sales_comp_id varchar,
        sale_date timestamp,
        original_created_at timestamp,
        original_updated_at timestamp,
        created_at timestamp NOT NULL DEFAULT NOW()
      )
    `,
  },
  {
    name: "archived_companies: create table",
    sql: `
      CREATE TABLE IF NOT EXISTS archived_companies (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id varchar NOT NULL,
        original_company_id varchar NOT NULL,
        name text NOT NULL,
        domain text,
        industry text,
        size text,
        address text,
        phone text,
        website text,
        description text,
        labels text[] DEFAULT ARRAY[]::text[],
        annual_revenue numeric(14,2),
        annual_marina_spend numeric(14,2),
        acquisition_interest text,
        portfolio_count integer,
        archive_reason text NOT NULL DEFAULT 'property_sold',
        archive_notes text,
        archived_by varchar NOT NULL,
        archived_at timestamp NOT NULL DEFAULT NOW(),
        sales_comp_id varchar,
        sale_date timestamp,
        original_created_at timestamp,
        original_updated_at timestamp,
        original_owner_id varchar,
        created_at timestamp NOT NULL DEFAULT NOW()
      )
    `,
  },
  {
    name: "archive_property_associations: create table",
    sql: `
      CREATE TABLE IF NOT EXISTS archive_property_associations (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id varchar NOT NULL,
        archived_contact_id varchar REFERENCES archived_contacts(id) ON DELETE CASCADE,
        archived_company_id varchar REFERENCES archived_companies(id) ON DELETE CASCADE,
        property_id varchar,
        property_name text NOT NULL,
        property_address text,
        property_city text,
        property_state text,
        sales_comp_id varchar,
        relationship text,
        ownership_start_date timestamp,
        ownership_end_date timestamp,
        created_at timestamp NOT NULL DEFAULT NOW()
      )
    `,
  },

  // ── crm deal/contact tables ───────────────────────────────────────────────
  {
    name: "crm_bulk_email_logs: create table",
    sql: `
      CREATE TABLE IF NOT EXISTS crm_bulk_email_logs (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id varchar NOT NULL,
        sent_by_id varchar,
        subject text NOT NULL,
        body text NOT NULL,
        recipient_count integer NOT NULL DEFAULT 0,
        sent_count integer NOT NULL DEFAULT 0,
        failed_count integer NOT NULL DEFAULT 0,
        status text NOT NULL DEFAULT 'pending',
        error_details jsonb,
        created_at timestamp NOT NULL DEFAULT NOW()
      )
    `,
  },
  {
    name: "crm_contact_engagement_scores: create table",
    sql: `
      CREATE TABLE IF NOT EXISTS crm_contact_engagement_scores (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        contact_id varchar NOT NULL UNIQUE,
        engagement_score integer NOT NULL DEFAULT 0,
        email_score integer DEFAULT 0,
        meeting_score integer DEFAULT 0,
        call_score integer DEFAULT 0,
        deal_involvement_score integer DEFAULT 0,
        recency_score integer DEFAULT 0,
        response_score integer DEFAULT 0,
        emails_opened integer DEFAULT 0,
        emails_clicked integer DEFAULT 0,
        emails_sent integer DEFAULT 0,
        total_meetings integer DEFAULT 0,
        total_calls integer DEFAULT 0,
        deals_involved integer DEFAULT 0,
        last_email_open timestamp,
        last_email_click timestamp,
        last_meeting timestamp,
        last_call timestamp,
        last_interaction timestamp,
        factors jsonb NOT NULL DEFAULT '{}',
        last_calculated_at timestamp NOT NULL DEFAULT NOW(),
        org_id varchar,
        created_at timestamp NOT NULL DEFAULT NOW(),
        updated_at timestamp NOT NULL DEFAULT NOW()
      )
    `,
  },
  {
    name: "contact_deal_roles: create table",
    sql: `
      CREATE TABLE IF NOT EXISTS contact_deal_roles (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id varchar,
        contact_id varchar NOT NULL,
        company_id varchar,
        deal_id varchar NOT NULL,
        role_on_deal text,
        deal_side text,
        is_primary_for_deal boolean NOT NULL DEFAULT false,
        volume_attribution_mode text NOT NULL DEFAULT 'all_linked',
        fee_crediting_mode text NOT NULL DEFAULT 'contact',
        split_pct_contact numeric(5,2),
        created_at timestamp NOT NULL DEFAULT NOW()
      )
    `,
  },
  {
    name: "deal_financial_events: create table",
    sql: `
      CREATE TABLE IF NOT EXISTS deal_financial_events (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id varchar,
        deal_id varchar NOT NULL,
        event_type text NOT NULL,
        amount numeric(14,2) NOT NULL,
        currency varchar(3) NOT NULL DEFAULT 'USD',
        direction text NOT NULL,
        applies_to_contact_id varchar,
        applies_to_company_id varchar,
        notes text,
        event_date date NOT NULL,
        created_at timestamp NOT NULL DEFAULT NOW()
      )
    `,
  },
  {
    name: "contact_metrics_snapshot: create table",
    sql: `
      CREATE TABLE IF NOT EXISTS contact_metrics_snapshot (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id varchar,
        contact_id varchar NOT NULL,
        timeframe_key varchar(20) NOT NULL,
        metrics jsonb NOT NULL,
        updated_at timestamp NOT NULL DEFAULT NOW()
      )
    `,
  },

  // ── missing columns on existing tables ───────────────────────────────────
  // boat_registry
  { name: "boat_registry: add beam", sql: `ALTER TABLE boat_registry ADD COLUMN IF NOT EXISTS beam numeric(5,2)` },
  { name: "boat_registry: add draft", sql: `ALTER TABLE boat_registry ADD COLUMN IF NOT EXISTS draft numeric(5,2)` },
  { name: "boat_registry: add engine_count", sql: `ALTER TABLE boat_registry ADD COLUMN IF NOT EXISTS engine_count integer` },
  { name: "boat_registry: add engine_type", sql: `ALTER TABLE boat_registry ADD COLUMN IF NOT EXISTS engine_type text` },
  { name: "boat_registry: add external_id", sql: `ALTER TABLE boat_registry ADD COLUMN IF NOT EXISTS external_id text` },
  { name: "boat_registry: add fuel_capacity", sql: `ALTER TABLE boat_registry ADD COLUMN IF NOT EXISTS fuel_capacity numeric(8,2)` },
  { name: "boat_registry: add hin", sql: `ALTER TABLE boat_registry ADD COLUMN IF NOT EXISTS hin varchar(14)` },
  { name: "boat_registry: add home_port", sql: `ALTER TABLE boat_registry ADD COLUMN IF NOT EXISTS home_port text` },
  { name: "boat_registry: add hull_color", sql: `ALTER TABLE boat_registry ADD COLUMN IF NOT EXISTS hull_color text` },
  { name: "boat_registry: add hull_material", sql: `ALTER TABLE boat_registry ADD COLUMN IF NOT EXISTS hull_material text` },
  { name: "boat_registry: add insurance_carrier", sql: `ALTER TABLE boat_registry ADD COLUMN IF NOT EXISTS insurance_carrier text` },
  { name: "boat_registry: add insurance_policy", sql: `ALTER TABLE boat_registry ADD COLUMN IF NOT EXISTS insurance_policy text` },
  { name: "boat_registry: add integration_source", sql: `ALTER TABLE boat_registry ADD COLUMN IF NOT EXISTS integration_source text` },
  { name: "boat_registry: add last_synced_at", sql: `ALTER TABLE boat_registry ADD COLUMN IF NOT EXISTS last_synced_at timestamp` },
  { name: "boat_registry: add registration_expiry", sql: `ALTER TABLE boat_registry ADD COLUMN IF NOT EXISTS registration_expiry date` },
  { name: "boat_registry: add registration_state", sql: `ALTER TABLE boat_registry ADD COLUMN IF NOT EXISTS registration_state varchar(2)` },

  // calendar_settings
  { name: "calendar_settings: add org_id", sql: `ALTER TABLE calendar_settings ADD COLUMN IF NOT EXISTS org_id varchar` },

  // comp_set_items
  { name: "comp_set_items: add added_at", sql: `ALTER TABLE comp_set_items ADD COLUMN IF NOT EXISTS added_at timestamp DEFAULT NOW()` },
  { name: "comp_set_items: add added_by", sql: `ALTER TABLE comp_set_items ADD COLUMN IF NOT EXISTS added_by varchar` },
  { name: "comp_set_items: add adjusted_value", sql: `ALTER TABLE comp_set_items ADD COLUMN IF NOT EXISTS adjusted_value numeric(15,2)` },
  { name: "comp_set_items: add adjustment_details", sql: `ALTER TABLE comp_set_items ADD COLUMN IF NOT EXISTS adjustment_details jsonb` },
  { name: "comp_set_items: add capabilities_score", sql: `ALTER TABLE comp_set_items ADD COLUMN IF NOT EXISTS capabilities_score integer` },
  { name: "comp_set_items: add capacity_score", sql: `ALTER TABLE comp_set_items ADD COLUMN IF NOT EXISTS capacity_score integer` },
  { name: "comp_set_items: add condition_score", sql: `ALTER TABLE comp_set_items ADD COLUMN IF NOT EXISTS condition_score integer` },
  { name: "comp_set_items: add geo_score", sql: `ALTER TABLE comp_set_items ADD COLUMN IF NOT EXISTS geo_score integer` },
  { name: "comp_set_items: add manual_weight_override", sql: `ALTER TABLE comp_set_items ADD COLUMN IF NOT EXISTS manual_weight_override numeric(5,4)` },
  { name: "comp_set_items: add slip_mix_score", sql: `ALTER TABLE comp_set_items ADD COLUMN IF NOT EXISTS slip_mix_score integer` },
  { name: "comp_set_items: add travel_time_score", sql: `ALTER TABLE comp_set_items ADD COLUMN IF NOT EXISTS travel_time_score integer` },

  // crm tables: add org_id where missing
  { name: "crm_accounts: add org_id", sql: `ALTER TABLE crm_accounts ADD COLUMN IF NOT EXISTS org_id varchar` },
  { name: "crm_activity_templates: add org_id", sql: `ALTER TABLE crm_activity_templates ADD COLUMN IF NOT EXISTS org_id varchar` },
  { name: "crm_ai_conversations: add org_id", sql: `ALTER TABLE crm_ai_conversations ADD COLUMN IF NOT EXISTS org_id varchar` },
  { name: "crm_ai_messages: add org_id", sql: `ALTER TABLE crm_ai_messages ADD COLUMN IF NOT EXISTS org_id varchar` },
  { name: "crm_campaigns: add org_id", sql: `ALTER TABLE crm_campaigns ADD COLUMN IF NOT EXISTS org_id varchar` },
  { name: "crm_contact_roles: add org_id", sql: `ALTER TABLE crm_contact_roles ADD COLUMN IF NOT EXISTS org_id varchar` },
  { name: "crm_contacts_labels: add org_id", sql: `ALTER TABLE crm_contacts_labels ADD COLUMN IF NOT EXISTS org_id varchar` },
  { name: "crm_deal_companies: add org_id", sql: `ALTER TABLE crm_deal_companies ADD COLUMN IF NOT EXISTS org_id varchar` },
  { name: "crm_deal_contacts: add org_id", sql: `ALTER TABLE crm_deal_contacts ADD COLUMN IF NOT EXISTS org_id varchar` },
  { name: "crm_deal_playbook_progress: add org_id", sql: `ALTER TABLE crm_deal_playbook_progress ADD COLUMN IF NOT EXISTS org_id varchar` },
  { name: "crm_deal_products: add org_id", sql: `ALTER TABLE crm_deal_products ADD COLUMN IF NOT EXISTS org_id varchar` },
  { name: "crm_deal_stage_history: add org_id", sql: `ALTER TABLE crm_deal_stage_history ADD COLUMN IF NOT EXISTS org_id varchar` },
  { name: "crm_dedupe_rules: add org_id", sql: `ALTER TABLE crm_dedupe_rules ADD COLUMN IF NOT EXISTS org_id varchar` },
  { name: "crm_email_sequence_enrollments: add org_id", sql: `ALTER TABLE crm_email_sequence_enrollments ADD COLUMN IF NOT EXISTS org_id varchar` },
  { name: "crm_email_sequences: add org_id", sql: `ALTER TABLE crm_email_sequences ADD COLUMN IF NOT EXISTS org_id varchar` },
  { name: "crm_email_sequence_step_executions: add org_id", sql: `ALTER TABLE crm_email_sequence_step_executions ADD COLUMN IF NOT EXISTS org_id varchar` },
  { name: "crm_email_sequence_steps: add org_id", sql: `ALTER TABLE crm_email_sequence_steps ADD COLUMN IF NOT EXISTS org_id varchar` },
  { name: "crm_email_templates: add org_id", sql: `ALTER TABLE crm_email_templates ADD COLUMN IF NOT EXISTS org_id varchar` },
  { name: "crm_form_analytics: add org_id", sql: `ALTER TABLE crm_form_analytics ADD COLUMN IF NOT EXISTS org_id varchar` },
  { name: "crm_form_fields: add org_id", sql: `ALTER TABLE crm_form_fields ADD COLUMN IF NOT EXISTS org_id varchar` },
  { name: "crm_forms: add org_id", sql: `ALTER TABLE crm_forms ADD COLUMN IF NOT EXISTS org_id varchar` },
  { name: "crm_form_submissions: add org_id", sql: `ALTER TABLE crm_form_submissions ADD COLUMN IF NOT EXISTS org_id varchar` },
  { name: "crm_form_versions: add org_id", sql: `ALTER TABLE crm_form_versions ADD COLUMN IF NOT EXISTS org_id varchar` },
  { name: "crm_imported_records: add org_id", sql: `ALTER TABLE crm_imported_records ADD COLUMN IF NOT EXISTS org_id varchar` },
  { name: "crm_import_jobs: add org_id", sql: `ALTER TABLE crm_import_jobs ADD COLUMN IF NOT EXISTS org_id varchar` },
  { name: "crm_landing_pages: add org_id", sql: `ALTER TABLE crm_landing_pages ADD COLUMN IF NOT EXISTS org_id varchar` },
  { name: "crm_lead_engagement_metrics: add org_id", sql: `ALTER TABLE crm_lead_engagement_metrics ADD COLUMN IF NOT EXISTS org_id varchar` },
  { name: "crm_lead_scoring_events: add org_id", sql: `ALTER TABLE crm_lead_scoring_events ADD COLUMN IF NOT EXISTS org_id varchar` },
  { name: "crm_lead_scoring_history: add org_id", sql: `ALTER TABLE crm_lead_scoring_history ADD COLUMN IF NOT EXISTS org_id varchar` },
  { name: "crm_marina_lead_data: add org_id", sql: `ALTER TABLE crm_marina_lead_data ADD COLUMN IF NOT EXISTS org_id varchar` },
  { name: "crm_phase_gate_approvals: add org_id", sql: `ALTER TABLE crm_phase_gate_approvals ADD COLUMN IF NOT EXISTS org_id varchar` },
  { name: "crm_playbook_items: add org_id", sql: `ALTER TABLE crm_playbook_items ADD COLUMN IF NOT EXISTS org_id varchar` },
  { name: "crm_products: add org_id", sql: `ALTER TABLE crm_products ADD COLUMN IF NOT EXISTS org_id varchar` },
  { name: "crm_prospecting_activities: add org_id", sql: `ALTER TABLE crm_prospecting_activities ADD COLUMN IF NOT EXISTS org_id varchar` },
  { name: "crm_red_flag_escalations: add org_id", sql: `ALTER TABLE crm_red_flag_escalations ADD COLUMN IF NOT EXISTS org_id varchar` },
  { name: "crm_red_flag_rules: add org_id", sql: `ALTER TABLE crm_red_flag_rules ADD COLUMN IF NOT EXISTS org_id varchar` },
  { name: "crm_red_flags: add org_id", sql: `ALTER TABLE crm_red_flags ADD COLUMN IF NOT EXISTS org_id varchar` },
  { name: "crm_scoring_rules: add org_id", sql: `ALTER TABLE crm_scoring_rules ADD COLUMN IF NOT EXISTS org_id varchar` },
  { name: "crm_tasks: add org_id", sql: `ALTER TABLE crm_tasks ADD COLUMN IF NOT EXISTS org_id varchar` },
  { name: "crm_territories: add org_id", sql: `ALTER TABLE crm_territories ADD COLUMN IF NOT EXISTS org_id varchar` },
  { name: "crm_webhook_logs: add org_id", sql: `ALTER TABLE crm_webhook_logs ADD COLUMN IF NOT EXISTS org_id varchar` },
  { name: "crm_webhooks: add org_id", sql: `ALTER TABLE crm_webhooks ADD COLUMN IF NOT EXISTS org_id varchar` },
  { name: "crm_workflows: add org_id", sql: `ALTER TABLE crm_workflows ADD COLUMN IF NOT EXISTS org_id varchar` },

  // custom_document_types
  { name: "custom_document_types: add created_by", sql: `ALTER TABLE custom_document_types ADD COLUMN IF NOT EXISTS created_by varchar` },
  { name: "custom_document_types: add sort_order", sql: `ALTER TABLE custom_document_types ADD COLUMN IF NOT EXISTS sort_order integer DEFAULT 0` },

  // data_source_sync_logs
  { name: "data_source_sync_logs: add error_message", sql: `ALTER TABLE data_source_sync_logs ADD COLUMN IF NOT EXISTS error_message text` },
  { name: "data_source_sync_logs: add records_fetched", sql: `ALTER TABLE data_source_sync_logs ADD COLUMN IF NOT EXISTS records_fetched integer DEFAULT 0` },
  { name: "data_source_sync_logs: add sync_params", sql: `ALTER TABLE data_source_sync_logs ADD COLUMN IF NOT EXISTS sync_params jsonb` },

  // docket tables
  { name: "docket_article_removal_patterns: add org_id", sql: `ALTER TABLE docket_article_removal_patterns ADD COLUMN IF NOT EXISTS org_id varchar` },
  { name: "docket_entities: add org_id", sql: `ALTER TABLE docket_entities ADD COLUMN IF NOT EXISTS org_id varchar` },
  { name: "docket_portfolio_companies: add alert_enabled", sql: `ALTER TABLE docket_portfolio_companies ADD COLUMN IF NOT EXISTS alert_enabled boolean DEFAULT false` },
  { name: "docket_portfolio_companies: add description", sql: `ALTER TABLE docket_portfolio_companies ADD COLUMN IF NOT EXISTS description text` },
  { name: "docket_portfolio_companies: add entity_id", sql: `ALTER TABLE docket_portfolio_companies ADD COLUMN IF NOT EXISTS entity_id varchar` },
  { name: "docket_portfolio_companies: add industry", sql: `ALTER TABLE docket_portfolio_companies ADD COLUMN IF NOT EXISTS industry text` },
  { name: "docket_portfolio_companies: add location", sql: `ALTER TABLE docket_portfolio_companies ADD COLUMN IF NOT EXISTS location text` },
  { name: "docket_saved_searches: add description", sql: `ALTER TABLE docket_saved_searches ADD COLUMN IF NOT EXISTS description text` },
  { name: "docket_saved_searches: add filters", sql: `ALTER TABLE docket_saved_searches ADD COLUMN IF NOT EXISTS filters jsonb` },
  { name: "docket_watchlist_entities: add org_id", sql: `ALTER TABLE docket_watchlist_entities ADD COLUMN IF NOT EXISTS org_id varchar` },

  // external_user_project_access
  { name: "external_user_project_access: add access_token", sql: `ALTER TABLE external_user_project_access ADD COLUMN IF NOT EXISTS access_token text` },
  { name: "external_user_project_access: add download_count", sql: `ALTER TABLE external_user_project_access ADD COLUMN IF NOT EXISTS download_count integer DEFAULT 0` },
  { name: "external_user_project_access: add download_limit", sql: `ALTER TABLE external_user_project_access ADD COLUMN IF NOT EXISTS download_limit integer` },
  { name: "external_user_project_access: add ip_whitelist", sql: `ALTER TABLE external_user_project_access ADD COLUMN IF NOT EXISTS ip_whitelist text[]` },
  { name: "external_user_project_access: add last_access_at", sql: `ALTER TABLE external_user_project_access ADD COLUMN IF NOT EXISTS last_access_at timestamp` },
  { name: "external_user_project_access: add last_access_ip", sql: `ALTER TABLE external_user_project_access ADD COLUMN IF NOT EXISTS last_access_ip text` },
  { name: "external_user_project_access: add token_expires_at", sql: `ALTER TABLE external_user_project_access ADD COLUMN IF NOT EXISTS token_expires_at timestamp` },

  // fuel_sales
  { name: "fuel_sales: add external_id", sql: `ALTER TABLE fuel_sales ADD COLUMN IF NOT EXISTS external_id text` },
  { name: "fuel_sales: add integration_source", sql: `ALTER TABLE fuel_sales ADD COLUMN IF NOT EXISTS integration_source text` },
  { name: "fuel_sales: add last_synced_at", sql: `ALTER TABLE fuel_sales ADD COLUMN IF NOT EXISTS last_synced_at timestamp` },
  { name: "fuel_sales: add pump_id", sql: `ALTER TABLE fuel_sales ADD COLUMN IF NOT EXISTS pump_id text` },

  // industry_standards
  { name: "industry_standards: add confidence_level", sql: `ALTER TABLE industry_standards ADD COLUMN IF NOT EXISTS confidence_level text` },
  { name: "industry_standards: add created_by", sql: `ALTER TABLE industry_standards ADD COLUMN IF NOT EXISTS created_by varchar` },
  { name: "industry_standards: add data_source", sql: `ALTER TABLE industry_standards ADD COLUMN IF NOT EXISTS data_source text` },
  { name: "industry_standards: add effective_quarter", sql: `ALTER TABLE industry_standards ADD COLUMN IF NOT EXISTS effective_quarter integer` },
  { name: "industry_standards: add effective_year", sql: `ALTER TABLE industry_standards ADD COLUMN IF NOT EXISTS effective_year integer` },
  { name: "industry_standards: add high_range", sql: `ALTER TABLE industry_standards ADD COLUMN IF NOT EXISTS high_range numeric(15,4)` },
  { name: "industry_standards: add low_range", sql: `ALTER TABLE industry_standards ADD COLUMN IF NOT EXISTS low_range numeric(15,4)` },
  { name: "industry_standards: add market_size", sql: `ALTER TABLE industry_standards ADD COLUMN IF NOT EXISTS market_size text` },
  { name: "industry_standards: add org_id", sql: `ALTER TABLE industry_standards ADD COLUMN IF NOT EXISTS org_id varchar` },
  { name: "industry_standards: add sample_size", sql: `ALTER TABLE industry_standards ADD COLUMN IF NOT EXISTS sample_size integer` },
  { name: "industry_standards: add source_notes", sql: `ALTER TABLE industry_standards ADD COLUMN IF NOT EXISTS source_notes text` },
  { name: "industry_standards: add state", sql: `ALTER TABLE industry_standards ADD COLUMN IF NOT EXISTS state varchar(2)` },
  { name: "industry_standards: add sub_category", sql: `ALTER TABLE industry_standards ADD COLUMN IF NOT EXISTS sub_category text` },
  { name: "industry_standards: add updated_by", sql: `ALTER TABLE industry_standards ADD COLUMN IF NOT EXISTS updated_by varchar` },
  { name: "industry_standards: add water_type", sql: `ALTER TABLE industry_standards ADD COLUMN IF NOT EXISTS water_type text` },

  // integration_sync_logs
  { name: "integration_sync_logs: add connection_id", sql: `ALTER TABLE integration_sync_logs ADD COLUMN IF NOT EXISTS connection_id varchar` },
  { name: "integration_sync_logs: add created_at", sql: `ALTER TABLE integration_sync_logs ADD COLUMN IF NOT EXISTS created_at timestamp DEFAULT NOW()` },
  { name: "integration_sync_logs: add duration_ms", sql: `ALTER TABLE integration_sync_logs ADD COLUMN IF NOT EXISTS duration_ms integer` },
  { name: "integration_sync_logs: add error_log", sql: `ALTER TABLE integration_sync_logs ADD COLUMN IF NOT EXISTS error_log jsonb DEFAULT '[]'` },
  { name: "integration_sync_logs: add integration_key", sql: `ALTER TABLE integration_sync_logs ADD COLUMN IF NOT EXISTS integration_key text` },
  { name: "integration_sync_logs: add records_created", sql: `ALTER TABLE integration_sync_logs ADD COLUMN IF NOT EXISTS records_created integer DEFAULT 0` },
  { name: "integration_sync_logs: add records_processed", sql: `ALTER TABLE integration_sync_logs ADD COLUMN IF NOT EXISTS records_processed integer DEFAULT 0` },
  { name: "integration_sync_logs: add records_skipped", sql: `ALTER TABLE integration_sync_logs ADD COLUMN IF NOT EXISTS records_skipped integer DEFAULT 0` },
  { name: "integration_sync_logs: add records_updated", sql: `ALTER TABLE integration_sync_logs ADD COLUMN IF NOT EXISTS records_updated integer DEFAULT 0` },
  { name: "integration_sync_logs: add sync_details", sql: `ALTER TABLE integration_sync_logs ADD COLUMN IF NOT EXISTS sync_details jsonb DEFAULT '{}'` },
  { name: "integration_sync_logs: add sync_direction", sql: `ALTER TABLE integration_sync_logs ADD COLUMN IF NOT EXISTS sync_direction text DEFAULT 'import'` },
  { name: "integration_sync_logs: add target_entity", sql: `ALTER TABLE integration_sync_logs ADD COLUMN IF NOT EXISTS target_entity text` },
  { name: "integration_sync_logs: add target_module", sql: `ALTER TABLE integration_sync_logs ADD COLUMN IF NOT EXISTS target_module text` },
  { name: "integration_sync_logs: add triggered_by", sql: `ALTER TABLE integration_sync_logs ADD COLUMN IF NOT EXISTS triggered_by varchar` },

  // marina_field_sources
  { name: "marina_field_sources: add previous_value", sql: `ALTER TABLE marina_field_sources ADD COLUMN IF NOT EXISTS previous_value text` },
  { name: "marina_field_sources: add value", sql: `ALTER TABLE marina_field_sources ADD COLUMN IF NOT EXISTS value text` },

  // marina_leases
  { name: "marina_leases: add external_id", sql: `ALTER TABLE marina_leases ADD COLUMN IF NOT EXISTS external_id text` },
  { name: "marina_leases: add integration_source", sql: `ALTER TABLE marina_leases ADD COLUMN IF NOT EXISTS integration_source text` },
  { name: "marina_leases: add last_synced_at", sql: `ALTER TABLE marina_leases ADD COLUMN IF NOT EXISTS last_synced_at timestamp` },

  // marina_tenants
  { name: "marina_tenants: add external_id", sql: `ALTER TABLE marina_tenants ADD COLUMN IF NOT EXISTS external_id text` },
  { name: "marina_tenants: add integration_source", sql: `ALTER TABLE marina_tenants ADD COLUMN IF NOT EXISTS integration_source text` },
  { name: "marina_tenants: add last_synced_at", sql: `ALTER TABLE marina_tenants ADD COLUMN IF NOT EXISTS last_synced_at timestamp` },

  // market_benchmarks
  { name: "market_benchmarks: add avg_cap_rate", sql: `ALTER TABLE market_benchmarks ADD COLUMN IF NOT EXISTS avg_cap_rate numeric(5,2)` },
  { name: "market_benchmarks: add avg_occupancy", sql: `ALTER TABLE market_benchmarks ADD COLUMN IF NOT EXISTS avg_occupancy numeric(5,2)` },
  { name: "market_benchmarks: add avg_price_per_unit", sql: `ALTER TABLE market_benchmarks ADD COLUMN IF NOT EXISTS avg_price_per_unit numeric(10,2)` },

  // marketing_campaigns: add missing columns
  { name: "marketing_campaigns: add source_type", sql: `ALTER TABLE marketing_campaigns ADD COLUMN IF NOT EXISTS source_type varchar(50)` },
  { name: "marketing_campaigns: add linkedin_url", sql: `ALTER TABLE marketing_campaigns ADD COLUMN IF NOT EXISTS linkedin_url varchar(500)` },
  { name: "marketing_campaigns: add target_asset_classes", sql: `ALTER TABLE marketing_campaigns ADD COLUMN IF NOT EXISTS target_asset_classes jsonb DEFAULT '[]'` },
  { name: "marketing_campaigns: add target_geographies", sql: `ALTER TABLE marketing_campaigns ADD COLUMN IF NOT EXISTS target_geographies jsonb DEFAULT '[]'` },
  { name: "marketing_campaigns: add return_criteria_min", sql: `ALTER TABLE marketing_campaigns ADD COLUMN IF NOT EXISTS return_criteria_min numeric(6,4)` },
  { name: "marketing_campaigns: add investment_notes", sql: `ALTER TABLE marketing_campaigns ADD COLUMN IF NOT EXISTS investment_notes text` },
  { name: "marketing_campaigns: add relationship_score", sql: `ALTER TABLE marketing_campaigns ADD COLUMN IF NOT EXISTS relationship_score integer DEFAULT 0` },
  { name: "marketing_campaigns: add last_contacted_at", sql: `ALTER TABLE marketing_campaigns ADD COLUMN IF NOT EXISTS last_contacted_at timestamp` },
  { name: "marketing_campaigns: add next_followup_date", sql: `ALTER TABLE marketing_campaigns ADD COLUMN IF NOT EXISTS next_followup_date date` },
  { name: "marketing_campaigns: add nda_on_file", sql: `ALTER TABLE marketing_campaigns ADD COLUMN IF NOT EXISTS nda_on_file boolean DEFAULT false` },
  { name: "marketing_campaigns: add parent_company_id", sql: `ALTER TABLE marketing_campaigns ADD COLUMN IF NOT EXISTS parent_company_id varchar` },
  { name: "marketing_campaigns: add listing_status", sql: `ALTER TABLE marketing_campaigns ADD COLUMN IF NOT EXISTS listing_status text DEFAULT 'off_market'` },
  { name: "marketing_campaigns: add last_sale_price", sql: `ALTER TABLE marketing_campaigns ADD COLUMN IF NOT EXISTS last_sale_price numeric(15,2)` },
  { name: "marketing_campaigns: add last_sale_date", sql: `ALTER TABLE marketing_campaigns ADD COLUMN IF NOT EXISTS last_sale_date date` },
  { name: "marketing_campaigns: add latitude", sql: `ALTER TABLE marketing_campaigns ADD COLUMN IF NOT EXISTS latitude numeric(10,7)` },
  { name: "marketing_campaigns: add longitude", sql: `ALTER TABLE marketing_campaigns ADD COLUMN IF NOT EXISTS longitude numeric(10,7)` },
  { name: "marketing_campaigns: add in_flood_zone", sql: `ALTER TABLE marketing_campaigns ADD COLUMN IF NOT EXISTS in_flood_zone boolean DEFAULT false` },
  { name: "marketing_campaigns: add has_wetlands", sql: `ALTER TABLE marketing_campaigns ADD COLUMN IF NOT EXISTS has_wetlands boolean DEFAULT false` },
  { name: "marketing_campaigns: add total_slips", sql: `ALTER TABLE marketing_campaigns ADD COLUMN IF NOT EXISTS total_slips integer` },
  { name: "marketing_campaigns: add water_depth_ft", sql: `ALTER TABLE marketing_campaigns ADD COLUMN IF NOT EXISTS water_depth_ft numeric(5,1)` },
  { name: "marketing_campaigns: add dock_material", sql: `ALTER TABLE marketing_campaigns ADD COLUMN IF NOT EXISTS dock_material varchar(100)` },
  { name: "marketing_campaigns: add year_built", sql: `ALTER TABLE marketing_campaigns ADD COLUMN IF NOT EXISTS year_built integer` },

  // ops_marinas
  { name: "ops_marinas: add notes", sql: `ALTER TABLE ops_marinas ADD COLUMN IF NOT EXISTS notes text` },

  // platform_data_sources
  { name: "platform_data_sources: add key", sql: `ALTER TABLE platform_data_sources ADD COLUMN IF NOT EXISTS key varchar(50)` },
  { name: "platform_data_sources: add description", sql: `ALTER TABLE platform_data_sources ADD COLUMN IF NOT EXISTS description text` },
  { name: "platform_data_sources: add credentials", sql: `ALTER TABLE platform_data_sources ADD COLUMN IF NOT EXISTS credentials jsonb DEFAULT '{}'` },
  { name: "platform_data_sources: add rate_limits", sql: `ALTER TABLE platform_data_sources ADD COLUMN IF NOT EXISTS rate_limits jsonb DEFAULT '{}'` },
  { name: "platform_data_sources: add status_message", sql: `ALTER TABLE platform_data_sources ADD COLUMN IF NOT EXISTS status_message text` },
  { name: "platform_data_sources: add last_tested_at", sql: `ALTER TABLE platform_data_sources ADD COLUMN IF NOT EXISTS last_tested_at timestamp` },
  { name: "platform_data_sources: add sync_config", sql: `ALTER TABLE platform_data_sources ADD COLUMN IF NOT EXISTS sync_config jsonb DEFAULT '{}'` },
  { name: "platform_data_sources: add capabilities", sql: `ALTER TABLE platform_data_sources ADD COLUMN IF NOT EXISTS capabilities jsonb DEFAULT '{}'` },
  { name: "platform_data_sources: add enabled", sql: `ALTER TABLE platform_data_sources ADD COLUMN IF NOT EXISTS enabled boolean NOT NULL DEFAULT false` },

  // platform_data_source_mappings
  { name: "platform_data_source_mappings: add source_entity", sql: `ALTER TABLE platform_data_source_mappings ADD COLUMN IF NOT EXISTS source_entity varchar(100)` },
  { name: "platform_data_source_mappings: add target_module", sql: `ALTER TABLE platform_data_source_mappings ADD COLUMN IF NOT EXISTS target_module varchar(50)` },
  { name: "platform_data_source_mappings: add target_entity", sql: `ALTER TABLE platform_data_source_mappings ADD COLUMN IF NOT EXISTS target_entity varchar(100)` },
  { name: "platform_data_source_mappings: add sync_direction", sql: `ALTER TABLE platform_data_source_mappings ADD COLUMN IF NOT EXISTS sync_direction varchar(20) DEFAULT 'read'` },

  // pnl tables
  { name: "pnl_department_verifications: add file_data", sql: `ALTER TABLE pnl_department_verifications ADD COLUMN IF NOT EXISTS file_data jsonb` },
  { name: "pnl_facts: add file_data", sql: `ALTER TABLE pnl_facts ADD COLUMN IF NOT EXISTS file_data jsonb` },
  { name: "pnl_jobs: add file_data", sql: `ALTER TABLE pnl_jobs ADD COLUMN IF NOT EXISTS file_data jsonb` },
  { name: "pnl_parsed_statements: add file_data", sql: `ALTER TABLE pnl_parsed_statements ADD COLUMN IF NOT EXISTS file_data jsonb` },
  { name: "pnl_review_items: add file_data", sql: `ALTER TABLE pnl_review_items ADD COLUMN IF NOT EXISTS file_data jsonb` },

  // property_data_cache
  { name: "property_data_cache: add source_property_id", sql: `ALTER TABLE property_data_cache ADD COLUMN IF NOT EXISTS source_property_id varchar` },
  { name: "property_data_cache: add asset_class", sql: `ALTER TABLE property_data_cache ADD COLUMN IF NOT EXISTS asset_class text` },
  { name: "property_data_cache: add address_county", sql: `ALTER TABLE property_data_cache ADD COLUMN IF NOT EXISTS address_county text` },
  { name: "property_data_cache: add raw_payload", sql: `ALTER TABLE property_data_cache ADD COLUMN IF NOT EXISTS raw_payload jsonb` },
  { name: "property_data_cache: add address_hash", sql: `ALTER TABLE property_data_cache ADD COLUMN IF NOT EXISTS address_hash text` },

  // returns_ledger
  { name: "returns_ledger: add fund_id", sql: `ALTER TABLE returns_ledger ADD COLUMN IF NOT EXISTS fund_id varchar` },

  // rra tables
  { name: "rra_contract_charges: add org_id", sql: `ALTER TABLE rra_contract_charges ADD COLUMN IF NOT EXISTS org_id varchar` },
  { name: "rra_lease_line_items: add org_id", sql: `ALTER TABLE rra_lease_line_items ADD COLUMN IF NOT EXISTS org_id varchar` },
  { name: "rra_lease_snapshots: add org_id", sql: `ALTER TABLE rra_lease_snapshots ADD COLUMN IF NOT EXISTS org_id varchar` },
  { name: "rra_storage_locations: add org_id", sql: `ALTER TABLE rra_storage_locations ADD COLUMN IF NOT EXISTS org_id varchar` },
  { name: "rra_tenants: add asset_specific_data", sql: `ALTER TABLE rra_tenants ADD COLUMN IF NOT EXISTS asset_specific_data jsonb` },

  // service_work_orders
  { name: "service_work_orders: add external_id", sql: `ALTER TABLE service_work_orders ADD COLUMN IF NOT EXISTS external_id text` },
  { name: "service_work_orders: add integration_source", sql: `ALTER TABLE service_work_orders ADD COLUMN IF NOT EXISTS integration_source text` },
  { name: "service_work_orders: add last_synced_at", sql: `ALTER TABLE service_work_orders ADD COLUMN IF NOT EXISTS last_synced_at timestamp` },

  // storage_locations
  { name: "storage_locations: add external_id", sql: `ALTER TABLE storage_locations ADD COLUMN IF NOT EXISTS external_id text` },
  { name: "storage_locations: add integration_source", sql: `ALTER TABLE storage_locations ADD COLUMN IF NOT EXISTS integration_source text` },
  { name: "storage_locations: add last_synced_at", sql: `ALTER TABLE storage_locations ADD COLUMN IF NOT EXISTS last_synced_at timestamp` },

  // ── remaining drift fixes ─────────────────────────────────────────────────
  // asmp_bookkeeping missing columns
  { name: "asmp_bookkeeping: add revenue_total_override", sql: `ALTER TABLE asmp_bookkeeping ADD COLUMN IF NOT EXISTS revenue_total_override numeric(14,2)` },
  { name: "asmp_bookkeeping: add expense_total_override", sql: `ALTER TABLE asmp_bookkeeping ADD COLUMN IF NOT EXISTS expense_total_override numeric(14,2)` },
  { name: "asmp_bookkeeping: add noi_override", sql: `ALTER TABLE asmp_bookkeeping ADD COLUMN IF NOT EXISTS noi_override numeric(14,2)` },

  // exit_scenario_multi_year_cashflows missing columns
  { name: "exit_scenario_multi_year_cashflows: add potential_rental_income", sql: `ALTER TABLE exit_scenario_multi_year_cashflows ADD COLUMN IF NOT EXISTS potential_rental_income numeric(18,2)` },
  { name: "exit_scenario_multi_year_cashflows: add vacancy_loss", sql: `ALTER TABLE exit_scenario_multi_year_cashflows ADD COLUMN IF NOT EXISTS vacancy_loss numeric(18,2)` },
  { name: "exit_scenario_multi_year_cashflows: add vacancy_rate", sql: `ALTER TABLE exit_scenario_multi_year_cashflows ADD COLUMN IF NOT EXISTS vacancy_rate numeric(8,6)` },
  { name: "exit_scenario_multi_year_cashflows: add other_income", sql: `ALTER TABLE exit_scenario_multi_year_cashflows ADD COLUMN IF NOT EXISTS other_income numeric(18,2)` },
  { name: "exit_scenario_multi_year_cashflows: add total_gross_income", sql: `ALTER TABLE exit_scenario_multi_year_cashflows ADD COLUMN IF NOT EXISTS total_gross_income numeric(18,2)` },
  { name: "exit_scenario_multi_year_cashflows: add operating_expense_ratio", sql: `ALTER TABLE exit_scenario_multi_year_cashflows ADD COLUMN IF NOT EXISTS operating_expense_ratio numeric(8,6)` },
  { name: "exit_scenario_multi_year_cashflows: add property_taxes", sql: `ALTER TABLE exit_scenario_multi_year_cashflows ADD COLUMN IF NOT EXISTS property_taxes numeric(18,2)` },
  { name: "exit_scenario_multi_year_cashflows: add insurance", sql: `ALTER TABLE exit_scenario_multi_year_cashflows ADD COLUMN IF NOT EXISTS insurance numeric(18,2)` },
  { name: "exit_scenario_multi_year_cashflows: add utilities", sql: `ALTER TABLE exit_scenario_multi_year_cashflows ADD COLUMN IF NOT EXISTS utilities numeric(18,2)` },
  { name: "exit_scenario_multi_year_cashflows: add repairs", sql: `ALTER TABLE exit_scenario_multi_year_cashflows ADD COLUMN IF NOT EXISTS repairs numeric(18,2)` },
  { name: "exit_scenario_multi_year_cashflows: add management_fee", sql: `ALTER TABLE exit_scenario_multi_year_cashflows ADD COLUMN IF NOT EXISTS management_fee numeric(18,2)` },
  { name: "exit_scenario_multi_year_cashflows: add management_fee_rate", sql: `ALTER TABLE exit_scenario_multi_year_cashflows ADD COLUMN IF NOT EXISTS management_fee_rate numeric(8,6)` },
  { name: "exit_scenario_multi_year_cashflows: add noi", sql: `ALTER TABLE exit_scenario_multi_year_cashflows ADD COLUMN IF NOT EXISTS noi numeric(18,2)` },
  { name: "exit_scenario_multi_year_cashflows: add noi_growth_rate", sql: `ALTER TABLE exit_scenario_multi_year_cashflows ADD COLUMN IF NOT EXISTS noi_growth_rate numeric(8,6)` },
  { name: "exit_scenario_multi_year_cashflows: add annual_debt_service", sql: `ALTER TABLE exit_scenario_multi_year_cashflows ADD COLUMN IF NOT EXISTS annual_debt_service numeric(18,2)` },
  { name: "exit_scenario_multi_year_cashflows: add debt_service_by_loan", sql: `ALTER TABLE exit_scenario_multi_year_cashflows ADD COLUMN IF NOT EXISTS debt_service_by_loan jsonb` },
  { name: "exit_scenario_multi_year_cashflows: add leasing_commissions", sql: `ALTER TABLE exit_scenario_multi_year_cashflows ADD COLUMN IF NOT EXISTS leasing_commissions numeric(18,2)` },
  { name: "exit_scenario_multi_year_cashflows: add tenant_improvements", sql: `ALTER TABLE exit_scenario_multi_year_cashflows ADD COLUMN IF NOT EXISTS tenant_improvements numeric(18,2)` },
  { name: "exit_scenario_multi_year_cashflows: add funded_reserves", sql: `ALTER TABLE exit_scenario_multi_year_cashflows ADD COLUMN IF NOT EXISTS funded_reserves numeric(18,2)` },
  { name: "exit_scenario_multi_year_cashflows: add cash_flow_before_debt", sql: `ALTER TABLE exit_scenario_multi_year_cashflows ADD COLUMN IF NOT EXISTS cash_flow_before_debt numeric(18,2)` },
  { name: "exit_scenario_multi_year_cashflows: add cash_flow_after_debt", sql: `ALTER TABLE exit_scenario_multi_year_cashflows ADD COLUMN IF NOT EXISTS cash_flow_after_debt numeric(18,2)` },
  { name: "exit_scenario_multi_year_cashflows: add cash_flow_after_capex", sql: `ALTER TABLE exit_scenario_multi_year_cashflows ADD COLUMN IF NOT EXISTS cash_flow_after_capex numeric(18,2)` },
  { name: "exit_scenario_multi_year_cashflows: add dscr", sql: `ALTER TABLE exit_scenario_multi_year_cashflows ADD COLUMN IF NOT EXISTS dscr numeric(8,4)` },
  { name: "exit_scenario_multi_year_cashflows: add cap_rate", sql: `ALTER TABLE exit_scenario_multi_year_cashflows ADD COLUMN IF NOT EXISTS cap_rate numeric(8,6)` },
  { name: "exit_scenario_multi_year_cashflows: add cash_on_cash_return", sql: `ALTER TABLE exit_scenario_multi_year_cashflows ADD COLUMN IF NOT EXISTS cash_on_cash_return numeric(8,6)` },
  { name: "exit_scenario_multi_year_cashflows: add cumulative_noi", sql: `ALTER TABLE exit_scenario_multi_year_cashflows ADD COLUMN IF NOT EXISTS cumulative_noi numeric(18,2)` },
  { name: "exit_scenario_multi_year_cashflows: add cumulative_cash_flow", sql: `ALTER TABLE exit_scenario_multi_year_cashflows ADD COLUMN IF NOT EXISTS cumulative_cash_flow numeric(18,2)` },
  { name: "exit_scenario_multi_year_cashflows: add synced_from_rent_roll", sql: `ALTER TABLE exit_scenario_multi_year_cashflows ADD COLUMN IF NOT EXISTS synced_from_rent_roll boolean DEFAULT false` },
  { name: "exit_scenario_multi_year_cashflows: add synced_from_modeling", sql: `ALTER TABLE exit_scenario_multi_year_cashflows ADD COLUMN IF NOT EXISTS synced_from_modeling boolean DEFAULT false` },
  { name: "exit_scenario_multi_year_cashflows: add last_sync_at", sql: `ALTER TABLE exit_scenario_multi_year_cashflows ADD COLUMN IF NOT EXISTS last_sync_at timestamp` },

  // market_benchmarks missing columns
  { name: "market_benchmarks: add market", sql: `ALTER TABLE market_benchmarks ADD COLUMN IF NOT EXISTS market varchar(100)` },
  { name: "market_benchmarks: add submarket", sql: `ALTER TABLE market_benchmarks ADD COLUMN IF NOT EXISTS submarket varchar(100)` },
  { name: "market_benchmarks: add period", sql: `ALTER TABLE market_benchmarks ADD COLUMN IF NOT EXISTS period varchar(20)` },
  { name: "market_benchmarks: add avg_rent_growth", sql: `ALTER TABLE market_benchmarks ADD COLUMN IF NOT EXISTS avg_rent_growth numeric(5,2)` },
  { name: "market_benchmarks: add source_url", sql: `ALTER TABLE market_benchmarks ADD COLUMN IF NOT EXISTS source_url varchar(500)` },

  // marketing_campaigns additional missing columns
  { name: "marketing_campaigns: add deal_size_min", sql: `ALTER TABLE marketing_campaigns ADD COLUMN IF NOT EXISTS deal_size_min numeric(15,2)` },
  { name: "marketing_campaigns: add deal_size_max", sql: `ALTER TABLE marketing_campaigns ADD COLUMN IF NOT EXISTS deal_size_max numeric(15,2)` },
  { name: "marketing_campaigns: add email_consent", sql: `ALTER TABLE marketing_campaigns ADD COLUMN IF NOT EXISTS email_consent boolean DEFAULT false` },
  { name: "marketing_campaigns: add email_consent_date", sql: `ALTER TABLE marketing_campaigns ADD COLUMN IF NOT EXISTS email_consent_date timestamp` },
  { name: "marketing_campaigns: add asking_price", sql: `ALTER TABLE marketing_campaigns ADD COLUMN IF NOT EXISTS asking_price numeric(15,2)` },
  { name: "marketing_campaigns: add has_env_issues", sql: `ALTER TABLE marketing_campaigns ADD COLUMN IF NOT EXISTS has_env_issues boolean DEFAULT false` },
  { name: "marketing_campaigns: add has_title_issues", sql: `ALTER TABLE marketing_campaigns ADD COLUMN IF NOT EXISTS has_title_issues boolean DEFAULT false` },
  { name: "marketing_campaigns: add dry_slips", sql: `ALTER TABLE marketing_campaigns ADD COLUMN IF NOT EXISTS dry_slips integer` },
  { name: "marketing_campaigns: add has_fuel_dock", sql: `ALTER TABLE marketing_campaigns ADD COLUMN IF NOT EXISTS has_fuel_dock boolean DEFAULT false` },
  { name: "marketing_campaigns: add has_repair_yard", sql: `ALTER TABLE marketing_campaigns ADD COLUMN IF NOT EXISTS has_repair_yard boolean DEFAULT false` },

  // ============================================================
  // INDEXES: asmp_* modeling assumption tables (project+month)
  // ============================================================
  { name: "asmp_fuel: index project+month", sql: `CREATE INDEX IF NOT EXISTS asmp_fuel_project_month_idx ON asmp_fuel(project_id, period_month)` },
  { name: "asmp_fuel: unique project+month", sql: `CREATE UNIQUE INDEX IF NOT EXISTS asmp_fuel_project_month_unique ON asmp_fuel(project_id, period_month)` },
  { name: "asmp_ship_store: index project+month", sql: `CREATE INDEX IF NOT EXISTS asmp_ship_store_project_month_idx ON asmp_ship_store(project_id, period_month)` },
  { name: "asmp_ship_store: unique project+month", sql: `CREATE UNIQUE INDEX IF NOT EXISTS asmp_ship_store_project_month_unique ON asmp_ship_store(project_id, period_month)` },
  { name: "asmp_service: index project+month", sql: `CREATE INDEX IF NOT EXISTS asmp_service_project_month_idx ON asmp_service(project_id, period_month)` },
  { name: "asmp_service: unique project+month", sql: `CREATE UNIQUE INDEX IF NOT EXISTS asmp_service_project_month_unique ON asmp_service(project_id, period_month)` },
  { name: "asmp_commercial_tenants: index project+month", sql: `CREATE INDEX IF NOT EXISTS asmp_tenants_project_month_idx ON asmp_commercial_tenants(project_id, period_month)` },
  { name: "asmp_commercial_tenants: unique project+month", sql: `CREATE UNIQUE INDEX IF NOT EXISTS asmp_tenants_project_month_unique ON asmp_commercial_tenants(project_id, period_month)` },
  { name: "asmp_boat_rentals: index project+month", sql: `CREATE INDEX IF NOT EXISTS asmp_boat_rentals_project_month_idx ON asmp_boat_rentals(project_id, period_month)` },
  { name: "asmp_boat_rentals: unique project+month", sql: `CREATE UNIQUE INDEX IF NOT EXISTS asmp_boat_rentals_project_month_unique ON asmp_boat_rentals(project_id, period_month)` },
  { name: "asmp_boat_club: index project+month", sql: `CREATE INDEX IF NOT EXISTS asmp_boat_club_project_month_idx ON asmp_boat_club(project_id, period_month)` },
  { name: "asmp_boat_club: unique project+month", sql: `CREATE UNIQUE INDEX IF NOT EXISTS asmp_boat_club_project_month_unique ON asmp_boat_club(project_id, period_month)` },
  { name: "asmp_boat_sales: index project+month", sql: `CREATE INDEX IF NOT EXISTS asmp_boat_sales_project_month_idx ON asmp_boat_sales(project_id, period_month)` },
  { name: "asmp_boat_sales: unique project+month", sql: `CREATE UNIQUE INDEX IF NOT EXISTS asmp_boat_sales_project_month_unique ON asmp_boat_sales(project_id, period_month)` },
  { name: "asmp_bookkeeping: index project+month", sql: `CREATE INDEX IF NOT EXISTS asmp_bookkeeping_project_month_idx ON asmp_bookkeeping(project_id, period_month)` },
  { name: "asmp_bookkeeping: unique project+month", sql: `CREATE UNIQUE INDEX IF NOT EXISTS asmp_bookkeeping_project_month_unique ON asmp_bookkeeping(project_id, period_month)` },
  { name: "asmp_parking_lot: index project+month", sql: `CREATE INDEX IF NOT EXISTS asmp_parking_lot_project_month_idx ON asmp_parking_lot(project_id, period_month)` },
  { name: "asmp_parking_lot: unique project+month", sql: `CREATE UNIQUE INDEX IF NOT EXISTS asmp_parking_lot_project_month_unique ON asmp_parking_lot(project_id, period_month)` },

  // ============================================================
  // INDEXES: tenant_leases and child tables
  // ============================================================
  { name: "tenant_leases: index project_id", sql: `CREATE INDEX IF NOT EXISTS tenant_leases_project_id_idx ON tenant_leases(project_id)` },
  { name: "tenant_leases: index status", sql: `CREATE INDEX IF NOT EXISTS tenant_leases_status_idx ON tenant_leases(status)` },
  { name: "tenant_rent_terms: index lease_id", sql: `CREATE INDEX IF NOT EXISTS tenant_rent_terms_lease_id_idx ON tenant_rent_terms(lease_id)` },
  { name: "tenant_recoveries: index lease_id", sql: `CREATE INDEX IF NOT EXISTS tenant_recoveries_lease_id_idx ON tenant_recoveries(lease_id)` },
  { name: "tenant_percentage_rent: index lease_id", sql: `CREATE INDEX IF NOT EXISTS tenant_percentage_rent_lease_id_idx ON tenant_percentage_rent(lease_id)` },
  { name: "tenant_sales: index lease_id", sql: `CREATE INDEX IF NOT EXISTS tenant_sales_lease_id_idx ON tenant_sales(lease_id)` },
  { name: "tenant_concessions: index lease_id", sql: `CREATE INDEX IF NOT EXISTS tenant_concessions_lease_id_idx ON tenant_concessions(lease_id)` },
  { name: "tenant_capex_leasing: index lease_id", sql: `CREATE INDEX IF NOT EXISTS tenant_capex_leasing_lease_id_idx ON tenant_capex_leasing(lease_id)` },
  { name: "tenant_rollover_assumptions: index lease_id", sql: `CREATE INDEX IF NOT EXISTS tenant_rollover_assumptions_lease_id_idx ON tenant_rollover_assumptions(lease_id)` },

  // ============================================================
  // INDEXES: monthly_loan_schedule
  // ============================================================
  { name: "monthly_loan_schedule: index org_id", sql: `CREATE INDEX IF NOT EXISTS monthly_loan_schedule_org_idx ON monthly_loan_schedule(org_id)` },
  { name: "monthly_loan_schedule: index debt_tranche_id", sql: `CREATE INDEX IF NOT EXISTS monthly_loan_schedule_debt_tranche_idx ON monthly_loan_schedule(debt_tranche_id)` },
  { name: "monthly_loan_schedule: index capital_stack_id", sql: `CREATE INDEX IF NOT EXISTS monthly_loan_schedule_capital_stack_idx ON monthly_loan_schedule(capital_stack_id)` },
  { name: "monthly_loan_schedule: index period year+month", sql: `CREATE INDEX IF NOT EXISTS monthly_loan_schedule_period_idx ON monthly_loan_schedule(period_year, period_month)` },
  { name: "monthly_loan_schedule: composite tranche+date", sql: `CREATE INDEX IF NOT EXISTS monthly_loan_schedule_tranche_date_idx ON monthly_loan_schedule(debt_tranche_id, period_date)` },

  // ============================================================
  // INDEXES: exit_scenarios
  // ============================================================
  { name: "exit_scenarios: index modeling_project_id", sql: `CREATE INDEX IF NOT EXISTS exit_scenarios_modeling_project_idx ON exit_scenarios(modeling_project_id)` },
  { name: "exit_scenarios: index org_id", sql: `CREATE INDEX IF NOT EXISTS exit_scenarios_org_idx ON exit_scenarios(org_id)` },
  { name: "exit_scenarios: index status", sql: `CREATE INDEX IF NOT EXISTS exit_scenarios_status_idx ON exit_scenarios(status)` },

  // ============================================================
  // INDEXES: exit_scenario_results_v2
  // ============================================================
  { name: "exit_scenario_results_v2: unique scenario+checksum+version", sql: `CREATE UNIQUE INDEX IF NOT EXISTS exit_results_v2_scenario_checksum_idx ON exit_scenario_results_v2(scenario_id, inputs_checksum, engine_version)` },
  { name: "exit_scenario_results_v2: index scenario_id", sql: `CREATE INDEX IF NOT EXISTS exit_results_v2_scenario_idx ON exit_scenario_results_v2(scenario_id)` },

  // ============================================================
  // INDEXES: exit_scenario_events
  // ============================================================
  { name: "exit_scenario_events: index scenario_id", sql: `CREATE INDEX IF NOT EXISTS exit_events_scenario_idx ON exit_scenario_events(scenario_id)` },
  { name: "exit_scenario_events: index event_type", sql: `CREATE INDEX IF NOT EXISTS exit_events_type_idx ON exit_scenario_events(event_type)` },
  { name: "exit_scenario_events: index created_at", sql: `CREATE INDEX IF NOT EXISTS exit_events_created_idx ON exit_scenario_events(created_at)` },

  // ============================================================
  // INDEXES: exit_scenario_kpis
  // ============================================================
  { name: "exit_scenario_kpis: index asset_class", sql: `CREATE INDEX IF NOT EXISTS exit_kpis_asset_class_idx ON exit_scenario_kpis(asset_class)` },
  { name: "exit_scenario_kpis: index sale_price", sql: `CREATE INDEX IF NOT EXISTS exit_kpis_sale_price_idx ON exit_scenario_kpis(sale_price)` },
  { name: "exit_scenario_kpis: index after_tax_cash_now", sql: `CREATE INDEX IF NOT EXISTS exit_kpis_after_tax_idx ON exit_scenario_kpis(after_tax_cash_now)` },

  // ============================================================
  // INDEXES: opssos_* tables
  // ============================================================
  { name: "opssos_conversations: index org_id", sql: `CREATE INDEX IF NOT EXISTS opssos_conversations_org_idx ON opssos_conversations(org_id)` },
  { name: "opssos_conversations: index org+status", sql: `CREATE INDEX IF NOT EXISTS opssos_conversations_status_idx ON opssos_conversations(org_id, status)` },
  { name: "opssos_conversations: index org+assigned_user", sql: `CREATE INDEX IF NOT EXISTS opssos_conversations_assigned_idx ON opssos_conversations(org_id, assigned_user_id)` },
  { name: "opssos_messages: index conversation_id", sql: `CREATE INDEX IF NOT EXISTS opssos_messages_conversation_idx ON opssos_messages(conversation_id)` },
  { name: "opssos_messages: index org_id", sql: `CREATE INDEX IF NOT EXISTS opssos_messages_org_idx ON opssos_messages(org_id)` },
  { name: "opssos_automation_rules: index org_id", sql: `CREATE INDEX IF NOT EXISTS opssos_automation_rules_org_idx ON opssos_automation_rules(org_id)` },
  { name: "opssos_automation_rules: index org+enabled", sql: `CREATE INDEX IF NOT EXISTS opssos_automation_rules_enabled_idx ON opssos_automation_rules(org_id, enabled)` },
  { name: "opssos_automation_runs: index rule_id", sql: `CREATE INDEX IF NOT EXISTS opssos_automation_runs_rule_idx ON opssos_automation_runs(rule_id)` },
  { name: "opssos_automation_runs: index org_id", sql: `CREATE INDEX IF NOT EXISTS opssos_automation_runs_org_idx ON opssos_automation_runs(org_id)` },
  { name: "opssos_tasks: index org_id", sql: `CREATE INDEX IF NOT EXISTS opssos_tasks_org_idx ON opssos_tasks(org_id)` },
  { name: "opssos_tasks: index org+status", sql: `CREATE INDEX IF NOT EXISTS opssos_tasks_status_idx ON opssos_tasks(org_id, status)` },
  { name: "opssos_tasks: index org+assigned_user", sql: `CREATE INDEX IF NOT EXISTS opssos_tasks_assigned_idx ON opssos_tasks(org_id, assigned_user_id)` },
  { name: "opssos_tasks: index deal_id", sql: `CREATE INDEX IF NOT EXISTS opssos_tasks_deal_idx ON opssos_tasks(deal_id)` },
  { name: "opssos_statements: index org_id", sql: `CREATE INDEX IF NOT EXISTS opssos_statements_org_idx ON opssos_statements(org_id)` },
  { name: "opssos_statements: index template_id", sql: `CREATE INDEX IF NOT EXISTS opssos_statements_template_idx ON opssos_statements(template_id)` },
  { name: "opssos_webhooks: index org_id", sql: `CREATE INDEX IF NOT EXISTS opssos_webhooks_org_idx ON opssos_webhooks(org_id)` },
  { name: "opssos_webhooks: index org+enabled", sql: `CREATE INDEX IF NOT EXISTS opssos_webhooks_enabled_idx ON opssos_webhooks(org_id, enabled)` },
  { name: "opssos_webhook_deliveries: index webhook_id", sql: `CREATE INDEX IF NOT EXISTS opssos_webhook_deliveries_webhook_idx ON opssos_webhook_deliveries(webhook_id)` },
  { name: "opssos_webhook_deliveries: index org_id", sql: `CREATE INDEX IF NOT EXISTS opssos_webhook_deliveries_org_idx ON opssos_webhook_deliveries(org_id)` },

  // ============================================================
  // INDEXES: opssos_* additional tables
  // ============================================================
  { name: "opssos_message_templates: index org_id", sql: `CREATE INDEX IF NOT EXISTS opssos_message_templates_org_idx ON opssos_message_templates(org_id)` },
  { name: "opssos_scheduled_jobs: index org_id", sql: `CREATE INDEX IF NOT EXISTS opssos_scheduled_jobs_org_idx ON opssos_scheduled_jobs(org_id)` },
  { name: "opssos_scheduled_jobs: index status+run_at", sql: `CREATE INDEX IF NOT EXISTS opssos_scheduled_jobs_status_run_at_idx ON opssos_scheduled_jobs(status, run_at)` },
  { name: "opssos_checklist_templates: index org_id", sql: `CREATE INDEX IF NOT EXISTS opssos_checklist_templates_org_idx ON opssos_checklist_templates(org_id)` },
  { name: "opssos_task_checklists: index task_id", sql: `CREATE INDEX IF NOT EXISTS opssos_task_checklists_task_idx ON opssos_task_checklists(task_id)` },
  { name: "opssos_statement_templates: index org_id", sql: `CREATE INDEX IF NOT EXISTS opssos_statement_templates_org_idx ON opssos_statement_templates(org_id)` },
  { name: "opssos_statement_exports: index statement_id", sql: `CREATE INDEX IF NOT EXISTS opssos_statement_exports_statement_idx ON opssos_statement_exports(statement_id)` },
  { name: "opssos_integrations: index org_id", sql: `CREATE INDEX IF NOT EXISTS opssos_integrations_org_idx ON opssos_integrations(org_id)` },
  { name: "opssos_integrations: index org+provider", sql: `CREATE INDEX IF NOT EXISTS opssos_integrations_provider_idx ON opssos_integrations(org_id, provider)` },

  // ============================================================
  // INDEXES: exit_scenario_loans
  // ============================================================
  { name: "exit_scenario_loans: index exit_scenario_id", sql: `CREATE INDEX IF NOT EXISTS exit_loans_scenario_idx ON exit_scenario_loans(exit_scenario_id)` },
  { name: "exit_scenario_loans: index org_id", sql: `CREATE INDEX IF NOT EXISTS exit_loans_org_idx ON exit_scenario_loans(org_id)` },

  // ============================================================
  // INDEXES: exit_scenario_basis_ledger
  // ============================================================
  { name: "exit_scenario_basis_ledger: index exit_scenario_id", sql: `CREATE INDEX IF NOT EXISTS exit_basis_ledger_scenario_idx ON exit_scenario_basis_ledger(exit_scenario_id)` },
  { name: "exit_scenario_basis_ledger: index org_id", sql: `CREATE INDEX IF NOT EXISTS exit_basis_ledger_org_idx ON exit_scenario_basis_ledger(org_id)` },

  // ============================================================
  // INDEXES: exit_scenario_multi_year_cashflows
  // ============================================================
  { name: "exit_scenario_multi_year_cashflows: index exit_scenario_id", sql: `CREATE INDEX IF NOT EXISTS exit_multi_year_cf_scenario_idx ON exit_scenario_multi_year_cashflows(exit_scenario_id)` },
  { name: "exit_scenario_multi_year_cashflows: index org_id", sql: `CREATE INDEX IF NOT EXISTS exit_multi_year_cf_org_idx ON exit_scenario_multi_year_cashflows(org_id)` },
  { name: "exit_scenario_multi_year_cashflows: index year", sql: `CREATE INDEX IF NOT EXISTS exit_multi_year_cf_year_idx ON exit_scenario_multi_year_cashflows(year)` },

  // ============================================================
  // INDEXES: exit_scenario_tax_profiles
  // ============================================================
  { name: "exit_scenario_tax_profiles: index exit_scenario_id", sql: `CREATE INDEX IF NOT EXISTS exit_tax_profiles_scenario_idx ON exit_scenario_tax_profiles(exit_scenario_id)` },
  { name: "exit_scenario_tax_profiles: index org_id", sql: `CREATE INDEX IF NOT EXISTS exit_tax_profiles_org_idx ON exit_scenario_tax_profiles(org_id)` },

  // ============================================================
  // INDEXES: exit_scenario_comparisons
  // ============================================================
  { name: "exit_scenario_comparisons: index modeling_project_id", sql: `CREATE INDEX IF NOT EXISTS exit_comparisons_project_idx ON exit_scenario_comparisons(modeling_project_id)` },
  { name: "exit_scenario_comparisons: index org_id", sql: `CREATE INDEX IF NOT EXISTS exit_comparisons_org_idx ON exit_scenario_comparisons(org_id)` },
];

export async function runStartupMigrations(): Promise<void> {
  for (const { name, sql } of MIGRATIONS) {
    try {
      await pool.query(sql);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // Ignore "already exists" or "cannot be cast" (migration already applied)
      if (!msg.includes("already exists") && !msg.includes("cannot be cast")) {
        console.warn(`[startup-migrations] Warning applying "${name}": ${msg}`);
      }
    }
  }
  console.log(`[startup-migrations] Applied ${MIGRATIONS.length} idempotent migrations`);
}
