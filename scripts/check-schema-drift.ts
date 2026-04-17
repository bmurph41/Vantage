/**
 * check-schema-drift.ts
 *
 * Standalone CLI script that compares the Drizzle schema definitions against
 * the live database and exits 1 when any drift is detected.
 *
 * Usage:
 *   npx tsx scripts/check-schema-drift.ts
 *
 * CI / pre-deploy integration (GitHub Actions example):
 *   - name: Check schema drift
 *     run: npx tsx scripts/check-schema-drift.ts
 *     env:
 *       DATABASE_URL: ${{ secrets.DATABASE_URL }}
 *
 * Exit codes:
 *   0 — schema and database are in sync
 *   1 — drift detected (missing tables or columns) or check could not complete
 */

import { runSchemaDriftCheck } from "../server/schema-drift.js";
import { pool } from "../server/db.js";

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
    console.error(`\n[FATAL] Drift check failed with an unexpected error:`);
    console.error(`        ${msg}`);
    console.error(
      "\nEnsure DATABASE_URL is set and the database is reachable."
    );
    process.exit(1);
  } finally {
    // Always release the pool so the process terminates cleanly.
    await pool.end().catch(() => {/* ignore cleanup errors */});
  }

  console.log(DIVIDER);

  if (driftCount === 0) {
    console.log("RESULT: PASS — schema and database are in sync.");
    console.log(DIVIDER);
    process.exit(0);
  } else {
    console.error(
      `RESULT: FAIL — ${driftCount} drift issue(s) found (see warnings above).`
    );
    console.error(
      "\nTo resolve: run startup migrations or apply the missing DDL,\n" +
        "then re-run this script to confirm the database is in sync."
    );
    console.log(DIVIDER);
    process.exit(1);
  }
}

main();
