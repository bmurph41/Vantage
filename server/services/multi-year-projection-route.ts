/**
 * Multi-Year Projection — Route Handler
 * ======================================
 * Add this to your modeling routes file.
 *
 * Endpoint: POST /api/modeling/projects/:id/multi-year-projection
 *
 * Request body (all optional — falls back to saved project config):
 * {
 *   holdPeriod?: number;               // 1–30, overrides modelingProjectConfig
 *   revenueGrowthRate?: number;        // e.g. 0.03
 *   expenseGrowthRate?: number;        // e.g. 0.025
 *   categoryGrowthRates?: Record<string, number>;
 *   vacancyCurve?: VacancyCurveEntry[];
 *   capexSchedule?: CapExScheduleEntry[];
 *   defaultCapExPct?: number;
 *   exitCapRate?: number;
 *   sellingCostPct?: number;
 * }
 *
 * Integration steps:
 * 1. Import this handler in your routes/modeling.ts (or equivalent)
 * 2. Register: router.post('/:id/multi-year-projection', requireAuth, multiYearProjectionHandler);
 * 3. Optionally call syncLeaseRollupToAssumptions() before Year 1 compute for commercial assets
 */

import { Request, Response } from 'express';
import { db } from '../db';
import {
  modelingProjects,
  modelingProjectConfig,
  modelingScenarioVersions,
} from '@shared/schema';
import { eq, and, desc } from 'drizzle-orm';
import { computeDirectInputFinancials } from '../services/direct-input-engine';
import { syncLeaseRollupToAssumptions } from '../services/commercial-lease-bridge';
import {
  computeMultiYearProjection,
  buildProjectionConfig,
  type ProjectionConfig,
} from '../services/multi-year-projection-engine';

// Asset classes that benefit from lease sync before projection
const COMMERCIAL_ASSET_CLASSES = new Set([
  'retail', 'office', 'industrial', 'mixed_use', 'medical_office', 'flex',
]);

export async function multiYearProjectionHandler(req: Request, res: Response) {
  try {
    const { id: projectId } = req.params;
    const orgId: string = (req as any).user?.orgId ?? (req as any).orgId;

    if (!orgId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // ── 1. Load project ──────────────────────────────────────────────────────
    const [project] = await db
      .select()
      .from(modelingProjects)
      .where(and(eq(modelingProjects.id, projectId), eq(modelingProjects.orgId, orgId)));

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // ── 2. Load project config (holdPeriod) ──────────────────────────────────
    const [projConfig] = await db
      .select()
      .from(modelingProjectConfig)
      .where(eq(modelingProjectConfig.projectId, projectId));

    // ── 3. Load latest scenario version (growth rates) ───────────────────────
    const [latestScenario] = await db
      .select()
      .from(modelingScenarioVersions)
      .where(eq(modelingScenarioVersions.projectId, projectId))
      .orderBy(desc(modelingScenarioVersions.createdAt))
      .limit(1);

    // ── 4. Resolve projection config (saved + request body overrides) ─────────
    const bodyOverrides: Partial<ProjectionConfig> = {
      holdPeriod: req.body.holdPeriod,
      revenueGrowthRate: req.body.revenueGrowthRate,
      expenseGrowthRate: req.body.expenseGrowthRate,
      categoryGrowthRates: req.body.categoryGrowthRates,
      vacancyCurve: req.body.vacancyCurve,
      capexSchedule: req.body.capexSchedule,
      defaultCapExPct: req.body.defaultCapExPct,
      exitCapRate: req.body.exitCapRate,
      sellingCostPct: req.body.sellingCostPct,
    };
    // Strip undefined keys so buildProjectionConfig falls back correctly
    Object.keys(bodyOverrides).forEach(
      k => (bodyOverrides as any)[k] === undefined && delete (bodyOverrides as any)[k]
    );

    const projectionConfig = buildProjectionConfig(
      projConfig ?? { holdPeriod: 5 },
      latestScenario ?? null,
      bodyOverrides
    );

    // ── 5. Sync commercial leases before Year 1 compute (rent step-ups) ───────
    const assetClass: string = project.assetClass ?? 'multifamily';
    if (COMMERCIAL_ASSET_CLASSES.has(assetClass)) {
      try {
        await syncLeaseRollupToAssumptions(projectId, orgId);
      } catch (leaseErr) {
        // Non-fatal — log and continue; lease bridge is best-effort
        console.warn(`[multiYearProjection] lease sync failed for ${projectId}:`, leaseErr);
      }
    }

    // ── 6. Compute Year 1 base from direct input engine ───────────────────────
    const customMetrics = (project.customMetrics as Record<string, any>) ?? {};
    const inputAssumptions = customMetrics.inputAssumptions ?? {};
    const unitMix = customMetrics.unitMix ?? [];

    const year1Financials = computeDirectInputFinancials(
      assetClass,
      inputAssumptions,
      unitMix
    );

    // ── 7. Run multi-year projection ──────────────────────────────────────────
    const result = computeMultiYearProjection(year1Financials, projectionConfig);

    // ── 8. Return ─────────────────────────────────────────────────────────────
    return res.json({
      projectId,
      assetClass,
      projection: result,
      meta: {
        holdPeriod: projectionConfig.holdPeriod,
        revenueGrowthRate: projectionConfig.revenueGrowthRate,
        expenseGrowthRate: projectionConfig.expenseGrowthRate,
        exitCapRate: projectionConfig.exitCapRate,
        leaseSynced: COMMERCIAL_ASSET_CLASSES.has(assetClass),
      },
    });
  } catch (err: any) {
    console.error('[multiYearProjectionHandler]', err);
    return res.status(500).json({ error: err.message ?? 'Internal server error' });
  }
}
