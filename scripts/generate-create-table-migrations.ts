#!/usr/bin/env tsx
/**
 * Generate CREATE TABLE IF NOT EXISTS migration stubs for tables that are
 * completely absent from the live database (i.e., MISSING TABLE drift).
 *
 * This script connects to the live DB to discover which Drizzle-defined tables
 * are completely absent, then generates CREATE TABLE stubs for them.
 *
 * Usage:
 *   npx tsx scripts/generate-create-table-migrations.ts
 *
 * Exit codes:
 *   0 — all tables exist in the DB (or DB is unreachable)
 *   1 — at least one table is missing; stubs printed to stdout
 *   2 — DB connection error
 */

import { is } from "drizzle-orm";
import { PgTable, PgColumn, getTableConfig } from "drizzle-orm/pg-core";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { pool } from "../server/db";

const __dirname = dirname(fileURLToPath(import.meta.url));

const schema = await import("../shared/schema");
const secondary = await import("../db/schema-index");
const allSchemas: Record<string, unknown> = { ...schema, ...secondary };

function pgTypeForColumn(col: PgColumn): string {
  const ct = (col as any).columnType as string;
  const dt = (col as any).dataType as string;

  if (ct === "PgSerial") return "serial";
  if (ct === "PgBigSerial") return "bigserial";
  if (ct === "PgSmallSerial") return "smallserial";
  if (ct === "PgInteger" || ct === "PgSmallInt") return "integer";
  if (ct === "PgBigInt53" || ct === "PgBigInt64") return "bigint";
  if (ct === "PgBoolean" || dt === "boolean") return "boolean";
  if (ct === "PgTimestamp") {
    const withTz = (col as any).config?.withTimezone;
    return withTz ? "timestamptz" : "timestamp";
  }
  if (ct === "PgDate") return "date";
  if (ct === "PgTime") return "time";
  if (ct === "PgNumeric" || ct === "PgDecimal") return "numeric";
  if (ct === "PgJsonb") return "jsonb";
  if (ct === "PgJson") return "json";
  if (ct === "PgUUID") return "uuid";
  if (ct === "PgVarchar" || ct === "PgChar") return "varchar";
  if (ct === "PgReal") return "real";
  if (ct === "PgDoublePrecision") return "double precision";
  if (ct === "PgText" || dt === "string") return "text";
  return "text";
}

function isPrimaryKey(col: PgColumn, config: ReturnType<typeof getTableConfig>): boolean {
  if ((col as any).primary) return true;
  return config.primaryKeys.some((pk: any) =>
    pk.columns?.some((c: any) => c.name === col.name)
  );
}

let client: any;
let liveTableNames: Set<string>;

try {
  client = await pool.connect();
  const result = await client.query(
    `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`
  );
  liveTableNames = new Set(result.rows.map((r: any) => r.table_name as string));
} catch (err) {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`[generate-create-tables] DB connection failed: ${msg}`);
  await pool.end().catch(() => {});
  process.exit(2);
} finally {
  client?.release();
}

const outputLines: string[] = [];
let missingCount = 0;

for (const value of Object.values(allSchemas)) {
  if (!is(value as object, PgTable)) continue;
  const config = getTableConfig(value as PgTable);
  const tbl = config.name;

  if (liveTableNames.has(tbl)) continue;

  missingCount++;
  const colDefs: string[] = [];

  for (const col of config.columns) {
    const pgType = pgTypeForColumn(col);
    const pk = isPrimaryKey(col, config);
    let def = `      ${col.name} ${pgType}`;
    if (pk) def += " PRIMARY KEY";
    colDefs.push(def);
  }

  outputLines.push(
    `  {\n    name: "${tbl}: create table",\n    sql: \`\n      CREATE TABLE IF NOT EXISTS ${tbl} (\n${colDefs.join(",\n")}\n      )\n    \`,\n  },`
  );
}

await pool.end().catch(() => {});

if (missingCount === 0) {
  console.log("[generate-create-tables] All schema tables exist in the DB — nothing to add.");
  process.exit(0);
}

console.log(`[generate-create-tables] ${missingCount} table(s) are missing from the DB.\n`);
console.log("Paste the following into the MIGRATIONS array in server/db-startup-migrations.ts:\n");
console.log("─".repeat(72));
for (const line of outputLines) {
  console.log(line);
}
console.log("─".repeat(72));
process.exit(1);
