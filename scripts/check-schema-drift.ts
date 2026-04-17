#!/usr/bin/env tsx
/**
 * CI schema-drift check — exits with a non-zero code when the Drizzle schema
 * and the live database are out of sync in any direction:
 *
 *   • Missing-from-DB  — tables/columns defined in shared/schema.ts that do not
 *                        exist in the live database (forward drift).
 *   • Extra-in-DB      — columns present in the live database that are not
 *                        declared in shared/schema.ts (orphan / reverse drift).
 *   • Extra tables     — entire tables that exist in the live database but have
 *                        no corresponding Drizzle definition (phantom/stale tables).
 *
 * Usage:
 *   npm run check:schema
 *   # or directly: npx tsx scripts/check-schema-drift.ts
 *
 * Add this as a CI step (GitHub Actions, pre-deploy hook, etc.) to prevent
 * merges that introduce schema drift without a matching migration:
 *
 *   - name: Schema drift check
 *     run: npm run check:schema
 *     env:
 *       DATABASE_URL: ${{ secrets.DATABASE_URL }}
 *
 * Exit codes:
 *   0 — no drift detected; live DB matches the Drizzle schema
 *   1 — drift detected; prints a per-table summary of missing and extra columns
 *   2 — check could not run (DB unavailable, environment issue)
 *
 * Environment variables required (same as the main app):
 *   DATABASE_URL — PostgreSQL connection string
 */

import { runSchemaDriftCheck } from "../server/schema-drift";
import { pool } from "../server/db";

const DIVIDER = "─".repeat(60);

async function main(): Promise<void> {
  console.log(DIVIDER);
  console.log("Schema Drift Check");
  console.log(DIVIDER);
  console.log(
    "Comparing Drizzle schema definitions to the live database...\n"
  );

  let driftCount: number;

  try {
    driftCount = await runSchemaDriftCheck();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`\n[check-schema-drift] Fatal: unable to run drift check — ${msg}`);
    console.error("\nEnsure DATABASE_URL is set and the database is reachable.");
    await pool.end().catch(() => {/* ignore cleanup errors */});
    process.exit(2);
  }

  // Always release the pool so the process terminates cleanly.
  await pool.end().catch(() => {/* ignore cleanup errors */});

  console.log(DIVIDER);

  if (driftCount === 0) {
    console.log("RESULT: PASS — schema and database are in sync.");
    console.log(DIVIDER);
    process.exit(0);
  }

  console.error(
    `RESULT: FAIL — ${driftCount} drift issue(s) found (see warnings above).\n` +
      `  • MISSING COLUMN/TABLE warnings indicate schema-defined items absent from the DB.\n` +
      `  • EXTRA COLUMN warnings indicate orphan DB columns not declared in the schema.\n` +
      `  • EXTRA TABLE warnings indicate entire DB tables with no Drizzle schema definition.\n` +
      `  • MISSING INDEX warnings indicate named indexes declared in schema but absent from the DB.`
  );
  console.error(
    `\nFor missing columns/tables, run the following to generate ready-to-paste migration stubs:\n\n` +
      `  npx tsx scripts/generate-startup-migrations.ts\n\n` +
      `Then paste the output into server/db-startup-migrations.ts and commit.\n` +
      `For missing indexes, apply a CREATE INDEX migration matching the declared index name.\n` +
      `For extra/orphan columns, review whether a DROP COLUMN migration is needed.\n` +
      `For extra/phantom tables (EXTRA TABLE), review whether a DROP TABLE migration is needed\n` +
      `or add a matching Drizzle table definition to the schema.\n`
  );
  console.log(DIVIDER);
  process.exit(1);
}

main();
