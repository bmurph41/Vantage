/**
 * Startup DB migrations — idempotent DDL changes that cannot be applied
 * via drizzle-kit push alone (e.g., enum-to-text conversions).
 *
 * Each migration is safe to run multiple times (IF NOT EXISTS / USING cast).
 * This module runs once at server startup before any data seeds.
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
