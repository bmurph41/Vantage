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
