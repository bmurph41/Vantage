#!/usr/bin/env tsx
/**
 * Smoke-test: schema auto-discovery catches a newly added schema file
 *
 * Validates two discovery mechanisms end-to-end:
 *
 *   1. generate-startup-migrations.ts discovery loop — dynamically scans
 *      db/schema-*.ts via readdirSync and extracts PgTable definitions from
 *      each discovered module to generate migration stubs.
 *
 *   2. server/schema-drift.ts merged-schema path — builds its `allSchemas`
 *      object as `{ ...schema, ...secondarySchemas }` where `secondarySchemas`
 *      is the static import of `db/schema-index.ts`. This test regenerates that
 *      barrel then spawns a fresh subprocess that imports it (cache-free) and
 *      runs the identical PgTable extraction — proving the fixture table would
 *      be found by schema-drift.ts at runtime after barrel regeneration.
 *
 * Usage:
 *   npx tsx scripts/test-schema-autodiscovery.ts
 *
 * Exit codes:
 *   0 — all assertions passed
 *   1 — one or more assertions failed
 */

import { writeFileSync, readFileSync, unlinkSync, existsSync, readdirSync } from "fs";
import { resolve, join, dirname } from "path";
import { fileURLToPath } from "url";
import { execFileSync } from "child_process";
import { is } from "drizzle-orm";
import { PgTable, getTableConfig } from "drizzle-orm/pg-core";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");
const dbDir = resolve(rootDir, "db");
const indexPath = join(dbDir, "schema-index.ts");
const fixturePath = join(dbDir, "schema-test-fixture.ts");
const migrationsFilePath = resolve(rootDir, "server/db-startup-migrations.ts");

const FIXTURE_TABLE_NAME = "smoke_test_discovery_items";

const FIXTURE_CONTENT = `/**
 * AUTO-GENERATED test fixture — created by scripts/test-schema-autodiscovery.ts
 * DO NOT COMMIT — removed automatically after the smoke test completes.
 */
import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";

export const smokeTestDiscoveryItems = pgTable("${FIXTURE_TABLE_NAME}", {
  id: uuid("id").defaultRandom().primaryKey(),
  label: text("label").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
`;

/**
 * Inline script used as the schema-drift verification subprocess (step 4).
 *
 * It imports shared/schema + db/schema-index (both freshly loaded since this
 * runs in a new process), merges them the same way schema-drift.ts does, and
 * exits 0 iff the fixture table is extractable from the merged object.
 */
function buildSchemaDriftVerifyScript(fixtureTableName: string, rootDir: string): string {
  // Use JSON.stringify to safely embed the strings into the script source.
  const tableNameLiteral = JSON.stringify(fixtureTableName);
  const rootDirLiteral = JSON.stringify(rootDir);
  return `
import { is } from "drizzle-orm";
import { PgTable, getTableConfig } from "drizzle-orm/pg-core";
import * as schema from ${JSON.stringify(resolve(rootDir, "shared/schema.ts"))};
import * as secondarySchemas from ${JSON.stringify(resolve(rootDir, "db/schema-index.ts"))};

const allSchemas = { ...schema, ...secondarySchemas };

const names = [];
const seen = new Set();
for (const value of Object.values(allSchemas)) {
  if (is(value, PgTable)) {
    const config = getTableConfig(value);
    if (!seen.has(config.name)) {
      seen.add(config.name);
      names.push(config.name);
    }
  }
}

if (names.includes(${tableNameLiteral})) {
  console.log("FOUND: " + ${tableNameLiteral} + " (total tables: " + names.length + ")");
  process.exit(0);
} else {
  console.error("NOT FOUND: " + ${tableNameLiteral} + " in merged allSchemas");
  console.error("Tables found: " + names.join(", "));
  process.exit(1);
}
`;
}

// ─── helpers ────────────────────────────────────────────────────────────────

let failures = 0;

function pass(msg: string): void {
  console.log(`  ✓ ${msg}`);
}

function fail(msg: string): void {
  console.error(`  ✗ FAIL: ${msg}`);
  failures++;
}

function assert(condition: boolean, passMsg: string, failMsg: string): void {
  if (condition) pass(passMsg);
  else fail(failMsg);
}

function extractTableNames(exports: Record<string, unknown>): string[] {
  const names: string[] = [];
  const seen = new Set<string>();
  for (const value of Object.values(exports)) {
    if (is(value as object, PgTable)) {
      const config = getTableConfig(value as PgTable);
      if (!seen.has(config.name)) { seen.add(config.name); names.push(config.name); }
    }
  }
  return names;
}

// ─── setup / teardown ───────────────────────────────────────────────────────

const indexExistedBefore = existsSync(indexPath);
const originalIndexContent = indexExistedBefore ? readFileSync(indexPath, "utf8") : null;
const verifyScriptPath = join(dbDir, "_schema-drift-verify.ts");

function cleanup(): void {
  try { unlinkSync(fixturePath); } catch { /* already gone */ }
  try { unlinkSync(verifyScriptPath); } catch { /* already gone */ }
  if (originalIndexContent !== null) {
    writeFileSync(indexPath, originalIndexContent, "utf8");
  } else if (existsSync(indexPath)) {
    unlinkSync(indexPath);
  }
}

process.on("exit", cleanup);
process.on("uncaughtException", (err) => {
  console.error("[smoke-test] Uncaught exception:", err);
  process.exit(1);
});

// ─── step 1: write the fixture file ─────────────────────────────────────────

console.log("\n[smoke-test] 1 — create fixture file");
writeFileSync(fixturePath, FIXTURE_CONTENT, "utf8");
pass("Fixture file created at db/schema-test-fixture.ts");

// ─── step 2: readdirSync discovery (generate-startup-migrations loop) ────────

console.log("\n[smoke-test] 2 — generate-startup-migrations.ts discovery loop");

const discoveredFiles = readdirSync(dbDir)
  .filter((f) => f.startsWith("schema-") && f.endsWith(".ts") && f !== "schema-index.ts")
  .sort();

assert(
  discoveredFiles.includes("schema-test-fixture.ts"),
  "readdirSync discovery includes schema-test-fixture.ts",
  `readdirSync did NOT find schema-test-fixture.ts — found: [${discoveredFiles.join(", ")}]`
);

// ─── step 3: dynamic import + PgTable extraction ─────────────────────────────
//
// Same inner loop as generate-startup-migrations.ts:
//   for (const file of schemaFiles) { const mod = await import(join(dbDir, file)); ... }

console.log("\n[smoke-test] 3 — dynamic import and PgTable extraction (generate-startup-migrations path)");

const fixtureMod = await import(fixturePath) as Record<string, unknown>;
const fixtureTableNames = extractTableNames(fixtureMod);

assert(
  fixtureTableNames.includes(FIXTURE_TABLE_NAME),
  `PgTable extraction found "${FIXTURE_TABLE_NAME}"`,
  `PgTable extraction did NOT find "${FIXTURE_TABLE_NAME}" — found: [${fixtureTableNames.join(", ")}]`
);

const fixtureTableConfig = (() => {
  for (const v of Object.values(fixtureMod)) {
    if (is(v as object, PgTable)) {
      const c = getTableConfig(v as PgTable);
      if (c.name === FIXTURE_TABLE_NAME) return c;
    }
  }
  return null;
})();

if (fixtureTableConfig) {
  const cols = fixtureTableConfig.columns.map((c) => c.name);
  assert(
    cols.includes("id") && cols.includes("label") && cols.includes("created_at"),
    `Extracted columns include "id", "label", "created_at" (got: [${cols.join(", ")}])`,
    `Column mismatch — got: [${cols.join(", ")}]`
  );
}

// ─── step 4: schema-drift.ts merged-schema path (real barrel import) ─────────
//
// server/schema-drift.ts does:
//   import * as secondarySchemas from "../db/schema-index";
//   const allSchemas = { ...schema, ...secondarySchemas };
//
// We:
//  a) Regenerate db/schema-index.ts via sync-schema-index.ts so the fixture is
//     listed as an export.
//  b) Verify the barrel text includes the fixture export line.
//  c) Spawn a fresh subprocess that performs the exact same static import of
//     db/schema-index.ts (no module cache), merges it with shared/schema, and
//     asserts the fixture table appears in extracted PgTables. This is the same
//     code path schema-drift.ts runs at startup.

console.log("\n[smoke-test] 4 — schema-drift.ts merged-schema path (subprocess import of real barrel)");

// 4a — regenerate barrel
try {
  execFileSync("npx", ["tsx", resolve(__dirname, "sync-schema-index.ts")], { encoding: "utf8" });
} catch (err: unknown) {
  const execErr = err as { stderr?: string; stdout?: string };
  fail(`sync-schema-index.ts failed: ${execErr.stderr ?? execErr.stdout ?? String(err)}`);
}

// 4b — verify barrel text
const updatedIndex = readFileSync(indexPath, "utf8");
assert(
  updatedIndex.includes('export * from "./schema-test-fixture"'),
  'Regenerated schema-index.ts exports "./schema-test-fixture"',
  `schema-index.ts does NOT export "./schema-test-fixture".\nActual:\n${updatedIndex}`
);
assert(
  updatedIndex.includes('export * from "./schema-commercial-tenants"'),
  "Regenerated barrel preserves existing schema exports (regression check)",
  "Existing exports were lost after barrel regeneration"
);

// 4c — spawn subprocess that imports the real barrel + shared/schema and checks
//       for the fixture table, mirroring schema-drift.ts runtime behavior.
const verifyScript = buildSchemaDriftVerifyScript(FIXTURE_TABLE_NAME, rootDir);
writeFileSync(verifyScriptPath, verifyScript, "utf8");

let driftVerifyOutput = "";
let driftVerifyOk = false;
try {
  driftVerifyOutput = execFileSync(
    "npx",
    ["tsx", verifyScriptPath],
    { encoding: "utf8" }
  );
  driftVerifyOk = true;
} catch (err: unknown) {
  const execErr = err as { stdout?: string; stderr?: string };
  driftVerifyOutput = `${execErr.stdout ?? ""}\n${execErr.stderr ?? ""}`.trim();
}

assert(
  driftVerifyOk,
  `schema-drift.ts real barrel import: "${FIXTURE_TABLE_NAME}" found in merged allSchemas (${driftVerifyOutput.trim()})`,
  `schema-drift.ts real barrel import failed.\nSubprocess output:\n${driftVerifyOutput}`
);

// ─── step 5: generate-startup-migrations.ts subprocess output ────────────────
//
// The script must emit stubs mentioning the fixture table (unless the table is
// already covered by a CREATE TABLE IF NOT EXISTS in db-startup-migrations.ts).

console.log("\n[smoke-test] 5 — generate-startup-migrations.ts subprocess output");

let migrationsSource = "";
try { migrationsSource = readFileSync(migrationsFilePath, "utf8"); } catch { /* ok */ }

const fixtureAlreadyCovered =
  new RegExp(`CREATE\\s+TABLE\\s+IF\\s+NOT\\s+EXISTS\\s+${FIXTURE_TABLE_NAME}`, "i")
    .test(migrationsSource);

let migrationsOutput = "";
let migrationsExitCode = 0;
try {
  migrationsOutput = execFileSync(
    "npx",
    ["tsx", resolve(__dirname, "generate-startup-migrations.ts")],
    { encoding: "utf8" }
  );
} catch (err: unknown) {
  const execErr = err as { stdout?: string; status?: number };
  migrationsOutput = execErr.stdout ?? "";
  migrationsExitCode = execErr.status ?? 1;
}

if (fixtureAlreadyCovered) {
  assert(
    migrationsExitCode === 0,
    `generate-startup-migrations.ts exits 0 (fixture already covered by CREATE TABLE)`,
    `Unexpected exit code ${migrationsExitCode} when fixture is pre-covered`
  );
} else {
  assert(
    migrationsOutput.includes(FIXTURE_TABLE_NAME),
    `generate-startup-migrations.ts output includes "${FIXTURE_TABLE_NAME}" in generated stubs`,
    `Fixture table "${FIXTURE_TABLE_NAME}" was NOT found in migration output.\n` +
      `Exit: ${migrationsExitCode}\nOutput:\n${migrationsOutput}`
  );
}

// ─── summary ──────────────────────────────────────────────────────────────────

console.log("\n" + "─".repeat(64));

if (failures === 0) {
  console.log("[smoke-test] All assertions passed — schema auto-discovery is working correctly.");
  process.exit(0);
} else {
  console.error(`[smoke-test] ${failures} assertion(s) FAILED — see details above.`);
  process.exit(1);
}
