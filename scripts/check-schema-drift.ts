#!/usr/bin/env tsx
/**
 * CI schema-drift check — exits with a non-zero code when the live database is
 * missing tables or columns that are defined in shared/schema.ts.
 *
 * Usage:
 *   npx tsx scripts/check-schema-drift.ts
 *
 * Add this as a CI step (GitHub Actions, pre-deploy hook, etc.) to prevent
 * merges that introduce schema drift without a matching migration:
 *
 *   - name: Schema drift check
 *     run: npx tsx scripts/check-schema-drift.ts
 *     env:
 *       DATABASE_URL: ${{ secrets.DATABASE_URL }}
 *
 * Exit codes:
 *   0 — no drift detected; live DB matches the Drizzle schema
 *   1 — drift detected; prints a summary of missing tables / columns
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
    `RESULT: FAIL — ${driftCount} drift issue(s) found (see warnings above).`
  );
  console.error(
    `\nRun the following to generate ready-to-paste migration stubs:\n\n` +
      `  npx tsx scripts/generate-startup-migrations.ts\n\n` +
      `Then paste the output into server/db-startup-migrations.ts and commit.\n`
  );
  console.log(DIVIDER);
  process.exit(1);
}

main();
