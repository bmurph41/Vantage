/**
 * One-time backfill: populate scenario_assumption_payloads from existing
 * modeling_scenario_versions.assumptions blobs.
 *
 * Day 3 Commit 1 of engine unification (see
 * project_engine_unification_architecture_2026_05_14.md).
 *
 * Idempotent: skips scenarios that already have a canonical row.
 *
 * Orphan-aware: INNER JOIN with modeling_projects filters out scenarios
 * whose parent project has been deleted. See
 * project_orphan_scenario_versions_2026_05_16.md — the modeling_project_id
 * column on modeling_scenario_versions has no FK, so dead projects leave
 * orphan scenario rows behind. Orphans are unreachable from any reader
 * (every reader does project lookup first) and would violate the FK on
 * scenario_assumption_payloads.project_id if we tried to backfill them.
 *
 * Append-only safe with concurrent dual-write — if a newer dual-write
 * payload landed for a scenario between Day 2 close and this backfill run,
 * the idempotency check skips it. The newer payload wins for reads
 * (latest-by-created_at).
 *
 * Cleanup phase: deletes the 4 Day 2 smoke-test rows for scenario
 * bbca5ab6-bc73-48fe-86f5-13f2732fe790. Two of them carry the pre-fix
 * broken hashes from the replacer-array bug; the test scenario is
 * rebackfilled with the corrected hash via the live-scenarios pass.
 *
 * Run: npx tsx scripts/backfill-canonical-assumptions.ts
 */

import { eq, sql } from 'drizzle-orm';
import { db } from '../server/db';
import { scenarioAssumptionPayloads } from '@shared/schema';
import { writeCanonicalPayload } from '../server/services/canonical-assumption-store';

const DAY2_SMOKE_TEST_SCENARIO = 'bbca5ab6-bc73-48fe-86f5-13f2732fe790';

interface PopulatedScenarioRow {
  id: string;
  orgId: string;
  modelingProjectId: string;
  scenarioType: string;
  assumptions: Record<string, any> | null;
}

async function main() {
  // ── Step A: Clean up Day 2 smoke-test rows ─────────────────────────────
  const cleanup = await db.delete(scenarioAssumptionPayloads)
    .where(eq(scenarioAssumptionPayloads.scenarioVersionId, DAY2_SMOKE_TEST_SCENARIO))
    .returning({ id: scenarioAssumptionPayloads.id });
  console.log(`Cleanup: deleted ${cleanup.length} Day 2 smoke-test rows`);

  // ── Step B: Count orphans (unreachable from any reader) ────────────────
  const orphanCheck = await db.execute(sql`
    SELECT COUNT(*)::int AS count
    FROM modeling_scenario_versions msv
    LEFT JOIN modeling_projects mp ON mp.id = msv.modeling_project_id
    WHERE msv.assumptions IS NOT NULL
      AND msv.assumptions != '{}'::jsonb
      AND mp.id IS NULL
  `);
  const orphanCount = (orphanCheck.rows[0] as any).count;
  console.log(`Orphaned scenarios (pointing at deleted projects): ${orphanCount}`);
  console.log('Orphans skipped — see project_orphan_scenario_versions_2026_05_16.md for follow-up.');

  // ── Step C: Find LIVE populated scenarios (INNER JOIN excludes orphans) ─
  const result = await db.execute(sql`
    SELECT
      msv.id,
      msv.org_id AS "orgId",
      msv.modeling_project_id AS "modelingProjectId",
      msv.scenario_type AS "scenarioType",
      msv.assumptions
    FROM modeling_scenario_versions msv
    INNER JOIN modeling_projects mp ON mp.id = msv.modeling_project_id
    WHERE msv.assumptions IS NOT NULL
      AND msv.assumptions != '{}'::jsonb
  `);
  const populatedScenarios = result.rows as unknown as PopulatedScenarioRow[];

  console.log(`Found ${populatedScenarios.length} live populated scenarios (orphans excluded)`);

  // ── Step D: Backfill each (idempotent) ──────────────────────────────────
  let written = 0;
  let skipped = 0;

  for (const scenario of populatedScenarios) {
    const existing = await db.select({ id: scenarioAssumptionPayloads.id })
      .from(scenarioAssumptionPayloads)
      .where(eq(scenarioAssumptionPayloads.scenarioVersionId, scenario.id))
      .limit(1);

    if (existing.length > 0) {
      console.log(`SKIP  ${scenario.id} (${scenario.scenarioType}) — canonical row already exists`);
      skipped++;
      continue;
    }

    await writeCanonicalPayload({
      orgId: scenario.orgId,
      projectId: scenario.modelingProjectId,
      scenarioId: scenario.scenarioType,
      scenarioVersionId: scenario.id,
      assumptions: scenario.assumptions || {},
    });

    console.log(`WRITE ${scenario.id} (${scenario.scenarioType})`);
    written++;
  }

  console.log(`\nBackfill complete: ${written} written, ${skipped} skipped, ${orphanCount} orphans excluded`);

  // ── Step E: Verify final count ──────────────────────────────────────────
  const finalCount = await db.select({ count: sql<number>`count(*)::int` })
    .from(scenarioAssumptionPayloads);
  console.log(`Final scenario_assumption_payloads count: ${finalCount[0].count}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Backfill failed:', err);
    process.exit(1);
  });
