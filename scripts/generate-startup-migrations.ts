#!/usr/bin/env tsx
/**
 * Generate idempotent migration stubs for schema drift.
 *
 * Usage:
 *   npx tsx scripts/generate-startup-migrations.ts
 *
 * The script:
 *  1. Scans db/schema-*.ts files and regenerates db/schema-index.ts so that
 *     the barrel stays current for server-side bundling (no manual edits needed).
 *  2. Compares every table and column defined across all schema sources
 *     (shared/schema.ts plus every discovered db/schema-*.ts) against the
 *     entries already present in server/db-startup-migrations.ts and prints
 *     ready-to-paste migration stubs for anything not yet covered.
 *
 * It does NOT write to db-startup-migrations.ts automatically — it prints stubs
 * to stdout so a developer can review and paste them in at the appropriate place.
 *
 * Exit codes:
 *   0 — all schema definitions are already covered
 *   1 — at least one table or column lacks a migration stub
 */

import { readFileSync, readdirSync, writeFileSync } from "fs";
import { resolve, join, dirname, basename } from "path";
import { fileURLToPath } from "url";
import { is } from "drizzle-orm";
import { PgTable, getTableConfig } from "drizzle-orm/pg-core";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbDir = resolve(__dirname, "../db");

// ─── 1. Discover db/schema-*.ts files ─────────────────────────────────────────

let dbEntries: string[] = [];
try {
  dbEntries = readdirSync(dbDir);
} catch {
  // db/ directory doesn't exist — nothing extra to load.
}

const schemaFiles = dbEntries
  .filter((f) => f.startsWith("schema-") && f.endsWith(".ts") && !f.endsWith(".d.ts") && f !== "schema-index.ts")
  .sort();

// ─── 2. Regenerate db/schema-index.ts ─────────────────────────────────────────
//
// Keeps the static barrel that server/schema-drift.ts (and the esbuild bundle)
// rely on in sync with the current set of secondary schema files.

function generateBarrelContent(files: string[]): string {
  const header = `/**
 * AUTO-GENERATED — do not edit manually.
 *
 * Re-exports every secondary schema defined in db/schema-*.ts so that
 * server-side modules can import them with a single static import that
 * esbuild (and tsc) can analyse and bundle at build time.
 *
 * To regenerate after adding a new db/schema-*.ts file, run:
 *   npx tsx scripts/sync-schema-index.ts
 *
 * The generate-startup-migrations script also regenerates this file
 * automatically whenever it is executed.
 */\n`;

  if (files.length === 0) {
    return header + "\n// No secondary schema files found.\n";
  }

  const exports = files
    .map((f) => `export * from "./${basename(f, ".ts")}";`)
    .join("\n");

  return header + "\n" + exports + "\n";
}

const indexPath = join(dbDir, "schema-index.ts");
const newIndexContent = generateBarrelContent(schemaFiles);
let existingIndexContent = "";
try {
  existingIndexContent = readFileSync(indexPath, "utf8");
} catch {
  // File doesn't exist yet.
}

if (newIndexContent !== existingIndexContent) {
  writeFileSync(indexPath, newIndexContent, "utf8");
  console.log(
    `[generate-migrations] Updated db/schema-index.ts (${schemaFiles.length} secondary schema file(s) covered).`
  );
}

// ─── 3. Load all schemas ───────────────────────────────────────────────────────

// tsx resolves TypeScript imports natively; use relative paths without aliases.
const schema = await import("../shared/schema");

/** All schema sources merged into one flat object. */
const allSchemas: Record<string, unknown> = { ...schema };

for (const file of schemaFiles) {
  try {
    const mod = await import(join(dbDir, file));
    Object.assign(allSchemas, mod);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(
      `[generate-migrations] FATAL: Could not load secondary schema "${file}": ${msg}\n` +
        `  Fix the import error before running this script.`
    );
    process.exit(1);
  }
}

interface TableDef {
  tableName: string;
  columns: string[];
}

function extractSchemaTables(): TableDef[] {
  const tables: TableDef[] = [];
  const seen = new Set<string>();
  for (const value of Object.values(allSchemas)) {
    if (is(value as object, PgTable)) {
      const config = getTableConfig(value as PgTable);
      if (seen.has(config.name)) continue;
      seen.add(config.name);
      tables.push({
        tableName: config.name,
        columns: config.columns.map((c) => c.name),
      });
    }
  }
  return tables;
}

// ─── 4. Parse what is already covered in db-startup-migrations.ts ─────────────

const migrationsFilePath = resolve(
  __dirname,
  "../server/db-startup-migrations.ts"
);
const migrationsSource = readFileSync(migrationsFilePath, "utf8");

/**
 * Build a Set of "table.column" keys that are already addressed by an
 * ADD COLUMN entry in the migrations file, and a Set of table names that have
 * a CREATE TABLE entry (meaning all columns are considered covered).
 */
function parseCoveredItems(): {
  coveredColumns: Set<string>;
  coveredTables: Set<string>;
} {
  const coveredColumns = new Set<string>();
  const coveredTables = new Set<string>();

  // Match: ALTER TABLE <table> ADD COLUMN IF NOT EXISTS <column>
  const addColRe =
    /ALTER\s+TABLE\s+(\w+)\s+ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\s+(\w+)/gi;
  for (const m of migrationsSource.matchAll(addColRe)) {
    coveredColumns.add(`${m[1].toLowerCase()}.${m[2].toLowerCase()}`);
  }

  // Match: CREATE TABLE IF NOT EXISTS <table>
  const createTableRe = /CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+(\w+)/gi;
  for (const m of migrationsSource.matchAll(createTableRe)) {
    coveredTables.add(m[1].toLowerCase());
  }

  return { coveredColumns, coveredTables };
}

// ─── 5. Compare and generate stubs ───────────────────────────────────────────

const schemaTables = extractSchemaTables();
const { coveredColumns, coveredTables } = parseCoveredItems();

let missingCount = 0;
const outputLines: string[] = [];

for (const { tableName, columns } of schemaTables) {
  const tableKey = tableName.toLowerCase();

  if (coveredTables.has(tableKey)) {
    // Whole table is covered by a CREATE TABLE IF NOT EXISTS — skip.
    continue;
  }

  const missingColumns = columns.filter(
    (col) => !coveredColumns.has(`${tableKey}.${col.toLowerCase()}`)
  );

  if (missingColumns.length === 0) continue;

  outputLines.push(`\n  // ${tableName} — uncovered columns`);
  for (const col of missingColumns) {
    outputLines.push(
      `  { name: "${tableName}: add ${col}", sql: \`ALTER TABLE ${tableName} ADD COLUMN IF NOT EXISTS ${col} text\` },`
    );
    missingCount++;
  }
}

// ─── 6. Report ────────────────────────────────────────────────────────────────

if (missingCount === 0) {
  console.log(
    "[generate-migrations] All schema tables and columns are already covered — nothing to add."
  );
  process.exit(0);
}

console.log(
  `[generate-migrations] Found ${missingCount} column(s) across ${schemaTables.length} schema table(s) with no migration stub.\n`
);
console.log(
  "Paste the following entries into the MIGRATIONS array in server/db-startup-migrations.ts."
);
console.log(
  "Adjust the PostgreSQL type (currently 'text') to match the actual column type.\n"
);
console.log("─".repeat(72));
for (const line of outputLines) {
  console.log(line);
}
console.log("─".repeat(72));
console.log(
  `\n${missingCount} stub(s) generated. Review types, then paste into MIGRATIONS.`
);

process.exit(1);
