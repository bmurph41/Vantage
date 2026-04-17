/**
 * Commercial Lease → Pro Forma Bridge
 * ====================================
 * Syncs the lease engine's monthly rollup into asmpCommercialTenants
 * so the Pro Forma engine picks it up with ZERO changes.
 *
 * pro-forma-engine-service.ts line ~826 reads:
 *   tenantRows.reduce((s, r) => s + Number(r.totalRevenue || 0), 0)
 *
 * Uses SQL-aggregated rollup (no memory bloat at 200+ tenants)
 * and batch upserts (not per-row).
 */

import { db } from '../db';
import { asmpCommercialTenants } from '@shared/schema';
import { commercialLeases } from '@shared/commercial-lease-schema';
import { eq, and, sql } from 'drizzle-orm';
import { getProjectRollupAggregated } from './lease-storage';

export async function syncLeaseRollupToAssumptions(
  projectId: string,
  orgId: string,
  fromDate?: string,
  toDate?: string
) {
  const from = fromDate || '2024-01-31';
  const to = toDate || '2040-12-31';

  // 1. SQL-aggregated rollup (single query, no JS memory bloat)
  const rollup = await getProjectRollupAggregated(db, projectId, from, to);
  if (!rollup.length) {
    return { synced: 0, message: 'No lease cashflows to sync' };
  }

  // 2. Lease summary stats (single query)
  const [stats] = await db
    .select({
      activeCount: sql<number>`count(*) FILTER (WHERE active = true)::int`,
      totalSf: sql<number>`coalesce(sum(sf::numeric) FILTER (WHERE active = true), 0)::numeric`,
    })
    .from(commercialLeases)
    .where(eq(commercialLeases.projectId, projectId));

  const activeCount = stats.activeCount || 0;
  const totalSf = Number(stats.totalSf) || 0;

  // 3. Batch upsert using ON CONFLICT (Postgres native, single query per batch)
  const batchSize = 100;
  let synced = 0;

  for (let i = 0; i < rollup.length; i += batchSize) {
    const batch = rollup.slice(i, i + batchSize);
    const values = batch.map(month => {
      const rev = Math.round(month.totalRevenue * 100) / 100;
      const avgRent = totalSf > 0 ? Math.round(((rev * 12) / totalSf) * 100) / 100 : 0;
      return {
        projectId,
        orgId,
        periodMonth: month.monthEnd,
        totalRevenue: String(rev),
        tenantCount: activeCount,
        occupancyPct: '100',
        avgRentPerSqft: String(avgRent),
        updatedAt: new Date(),
      };
    });

    // Upsert batch — try native ON CONFLICT first, fall back to individual
    try {
      await db.execute(sql`
        INSERT INTO asmp_commercial_tenants (project_id, org_id, period_month, total_revenue, tenant_count, occupancy_pct, avg_rent_per_sqft, updated_at)
        SELECT * FROM ${sql.raw('(VALUES ' + values.map(v =>
          `('${v.projectId}', '${v.orgId}', '${v.periodMonth}', '${v.totalRevenue}', ${v.tenantCount}, '${v.occupancyPct}', '${v.avgRentPerSqft}', NOW())`
        ).join(', ') + ') AS t(project_id, org_id, period_month, total_revenue, tenant_count, occupancy_pct, avg_rent_per_sqft, updated_at)')}
        ON CONFLICT (project_id, period_month) DO UPDATE SET
          total_revenue = EXCLUDED.total_revenue,
          tenant_count = EXCLUDED.tenant_count,
          occupancy_pct = EXCLUDED.occupancy_pct,
          avg_rent_per_sqft = EXCLUDED.avg_rent_per_sqft,
          updated_at = EXCLUDED.updated_at
      `);
      synced += batch.length;
    } catch (batchErr) {
      // Fallback: individual upserts if batch SQL has issues (e.g., schema mismatch)
      console.warn('[CommercialLeaseEngine] Batch upsert failed, falling back to individual:', batchErr);
      for (const v of values) {
        try {
          await db.insert(asmpCommercialTenants)
            .values(v)
            .onConflictDoUpdate({
              target: [asmpCommercialTenants.projectId, asmpCommercialTenants.periodMonth],
              set: {
                totalRevenue: v.totalRevenue,
                tenantCount: v.tenantCount,
                occupancyPct: v.occupancyPct,
                avgRentPerSqft: v.avgRentPerSqft,
                updatedAt: v.updatedAt
              }
            });
          synced++;
        } catch (e) {
          console.error(`[CommercialLeaseEngine] Failed to sync month ${v.periodMonth}:`, e);
        }
      }
    }
  }

  return { synced };
}
