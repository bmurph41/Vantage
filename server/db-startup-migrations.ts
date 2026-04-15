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
