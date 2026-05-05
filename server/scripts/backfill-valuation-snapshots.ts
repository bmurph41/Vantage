import { db } from '../db';
import { sql } from 'drizzle-orm';
import { valuationTimelineService } from '../services/valuation-timeline-service';

/**
 * One-time backfill of valuation_snapshots.
 *
 * Filter: only projects WHERE purchase_price IS NOT NULL — skips
 * data-empty projects to avoid Potemkin snapshots in the new portfolio
 * dashboard.
 *
 * Calls createSnapshot directly per eligible project rather than
 * triggerManualSync (which iterates all projects regardless of data).
 *
 * userId is omitted: ValuationTimelineQuery.userId is optional and the
 * createdBy column is nullable for system-driven snapshots.
 *
 * Run: tsx server/scripts/backfill-valuation-snapshots.ts
 */
async function main() {
  console.log('[backfill] Starting valuation_snapshots backfill');

  const result = await db.execute(sql`
    SELECT id, org_id, marina_name
    FROM modeling_projects
    WHERE purchase_price IS NOT NULL
    ORDER BY org_id, created_at
  `);
  const projects = ((result as any).rows ?? result) as Array<{
    id: string;
    org_id: string;
    marina_name: string | null;
  }>;

  console.log(
    `[backfill] Found ${projects.length} eligible project(s) with populated purchase_price`,
  );

  let succeeded = 0;
  let failed = 0;
  for (const p of projects) {
    try {
      await valuationTimelineService.createSnapshot(
        { modelingProjectId: p.id, orgId: p.org_id },
        'manual',
        'One-time backfill 2026-05-05',
      );
      succeeded += 1;
      console.log(
        `[backfill] org=${p.org_id} project=${p.id} (${p.marina_name ?? 'unnamed'}) ✓`,
      );
    } catch (e: any) {
      failed += 1;
      console.error(
        `[backfill] org=${p.org_id} project=${p.id} (${p.marina_name ?? 'unnamed'}) ✗ — ${e?.message ?? e}`,
      );
    }
  }

  console.log(`[backfill] Complete. Succeeded: ${succeeded}, Failed: ${failed}`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error('[backfill] Fatal:', e);
  process.exit(1);
});
