/**
 * One-time migration: Re-promote all P&L data to modelingActuals
 *
 * Deletes old doc_intel actuals (to avoid duplicates from category changes),
 * then re-promotes from pnlFacts using the fixed promote-to-actuals logic.
 *
 * Safe to run multiple times — idempotent.
 *
 * Usage:
 *   npx tsx scripts/re-promote-all.ts
 */

import { db } from '../server/db';
import { modelingActuals } from '@shared/schema';
import { pnlDocuments } from '@shared/pnl-pipeline-schema';
import { eq, and } from 'drizzle-orm';
import { promotePnlFactsToActuals } from '../server/services/pnl/promote-to-actuals';

async function main() {
  // Get all distinct (modelingProjectId, orgId) pairs that have doc_intel actuals
  const rows = await db
    .selectDistinct({
      projectId: modelingActuals.modelingProjectId,
      orgId: modelingActuals.orgId,
    })
    .from(modelingActuals)
    .where(eq(modelingActuals.dataSource, 'doc_intel'));

  if (rows.length === 0) {
    console.log('No projects with doc_intel actuals found. Nothing to do.');
    return;
  }

  console.log(`Found ${rows.length} project(s) with doc_intel actuals.\n`);

  let totalPromoted = 0;
  let totalErrors = 0;

  for (const { projectId, orgId } of rows) {
    try {
      // 1. Delete old doc_intel actuals for this project.
      //    CRITICAL: The upsert conflict key includes `category`.
      //    If category changed, old row stays + new row inserts = double-counting.
      await db.delete(modelingActuals)
        .where(and(
          eq(modelingActuals.modelingProjectId, projectId),
          eq(modelingActuals.dataSource, 'doc_intel')
        ));

      // 2. Re-promote with corrected category/department logic
      const result = await promotePnlFactsToActuals(orgId, projectId);

      console.log(`  ✓ ${projectId}: promoted=${result.promoted}, skipped=${result.skipped}${
        result.errors.length > 0 ? `, errors=${result.errors.length}` : ''
      }`);

      totalPromoted += result.promoted;
      totalErrors += result.errors.length;

      if (result.errors.length > 0) {
        for (const err of result.errors.slice(0, 3)) {
          console.log(`      ⚠ ${err}`);
        }
        if (result.errors.length > 3) {
          console.log(`      ... and ${result.errors.length - 3} more errors`);
        }
      }
    } catch (err: any) {
      console.error(`  ✗ ${projectId}: FAILED — ${err.message}`);
      totalErrors++;
    }
  }

  console.log(`\nDone. Promoted: ${totalPromoted}, Errors: ${totalErrors}`);
}

main().catch(err => {
  console.error('Script failed:', err);
  process.exit(1);
});
