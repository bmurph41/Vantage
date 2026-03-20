// ============================================================
// Exit Strategy Studio V2 — API Routes
// File: server/routes/exit-studio-routes.ts
//
// Mount in server/routes.ts:
//   import { exitStudioRouter } from './routes/exit-studio-routes';
//   app.use(exitStudioRouter);
// ============================================================

import { Router } from 'express';
import { db } from '../db';
import { eq, and, desc } from 'drizzle-orm';
import {
  exitScenarios,
  exitScenarioResultsV2,
  exitScenarioEvents,
  exitScenarioKpis,
  assetClassAssumptionSets,
} from '@shared/schema';
import { runExitScenarioV2, ENGINE_VERSION } from '@shared/exit/orchestrator-v2';
import { ExitScenarioInputSchema } from '@shared/exit/types/08-zod-schemas';
import type { ExitScenarioKPIs } from '@shared/exit/types/07-master-types';
import { exitIntegrationService } from '../services/exit-integration-service';

const router = Router();

// Middleware — reuse your existing authenticateUser
// import { authenticateUser } from '../middleware/auth';

// ============================================================
// POST /api/exit-studio/calculate
// Canonical compute endpoint — stateless computation
// ============================================================
router.post('/api/exit-studio/calculate', async (req: any, res) => {
  try {
    // 1. Validate input
    const parseResult = ExitScenarioInputSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'Invalid input',
        details: parseResult.error.issues,
      });
    }

    const input = parseResult.data;

    // 2. Run orchestrator
    const result = await runExitScenarioV2(input as any);

    // 3. Return result (no persistence — pure compute)
    res.json(result);
  } catch (error: any) {
    console.error('Exit studio calculate error:', error);
    res.status(500).json({ error: 'Computation failed', message: error.message });
  }
});

// ============================================================
// POST /api/exit-studio/scenarios/:scenarioId/compute
// Compute + persist — loads from DB, computes, saves result + KPIs
// ============================================================
router.post('/api/exit-studio/scenarios/:scenarioId/compute', async (req: any, res) => {
  try {
    const orgId = req.user?.orgId;
    const userId = req.user?.id;
    const { scenarioId } = req.params;

    // 1. Load scenario
    const [scenario] = await db.select()
      .from(exitScenarios)
      .where(and(
        eq(exitScenarios.id, scenarioId),
        orgId ? eq(exitScenarios.orgId, orgId) : undefined as any,
      ))
      .limit(1);

    if (!scenario) {
      return res.status(404).json({ error: 'Scenario not found' });
    }

    if (!scenario.inputsJson) {
      return res.status(400).json({
        error: 'Scenario has no v2 inputs. Use the Exit Strategy Studio UI to set up the scenario.',
      });
    }

    // 2. Parse + validate
    const parseResult = ExitScenarioInputSchema.safeParse(scenario.inputsJson);
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'Stored inputs are invalid',
        details: parseResult.error.issues,
      });
    }

    // 3. Run orchestrator
    const result = await runExitScenarioV2(parseResult.data as any);

    // 4. Persist result + KPIs in transaction
    await db.transaction(async (tx) => {
      // Insert result
      await tx.insert(exitScenarioResultsV2).values({
        scenarioId,
        computedAt: new Date(),
        inputsChecksum: result.inputsChecksum,
        outputsJson: result as any,
        engineVersion: result.engineVersion,
      }).onConflictDoUpdate({
        target: [exitScenarioResultsV2.scenarioId],
        set: {
          computedAt: new Date(),
          inputsChecksum: result.inputsChecksum,
          outputsJson: result as any,
          engineVersion: result.engineVersion,
        },
      });

      // Upsert KPIs
      await tx.insert(exitScenarioKpis).values({
        scenarioId,
        computedAt: new Date(),
        salePrice: String(result.kpis.salePrice),
        amountRealized: String(result.kpis.amountRealized),
        adjustedBasis: String(result.kpis.adjustedBasis),
        realizedGain: String(result.kpis.realizedGain),
        recognizedGain: String(result.kpis.recognizedGain),
        deferredGain: String(result.kpis.deferredGain),
        bootTotal: String(result.kpis.bootTotal),
        bootCash: String(result.kpis.bootCash),
        bootMortgage: String(result.kpis.bootMortgage),
        bootNonLikeKind: String(result.kpis.bootNonLikeKind),
        taxTotal: String(result.kpis.taxTotal),
        taxFederal: String(result.kpis.taxFederal),
        taxState: String(result.kpis.taxState),
        taxNiit: String(result.kpis.taxNIIT),
        afterTaxCashNow: String(result.kpis.afterTaxCashNow),
        afterTaxCashTotal: String(result.kpis.afterTaxCashTotal),
        afterTaxNpv: String(result.kpis.afterTaxNPV),
        lpIrr: result.kpis.lpIRR != null ? String(result.kpis.lpIRR) : null,
        gpIrr: result.kpis.gpIRR != null ? String(result.kpis.gpIRR) : null,
        lpEquityMultiple: result.kpis.lpEquityMultiple != null ? String(result.kpis.lpEquityMultiple) : null,
        gpEquityMultiple: result.kpis.gpEquityMultiple != null ? String(result.kpis.gpEquityMultiple) : null,
        promoteEarned: result.kpis.promoteEarned != null ? String(result.kpis.promoteEarned) : null,
        strategiesActive: result.kpis.strategiesActive as any,
        hasRecaptureExposure: result.kpis.hasRecaptureExposure,
        hasTradeDown: result.kpis.hasTradeDown,
        advisorReviewRequired: result.kpis.advisorReviewRequired,
        assetClass: (parseResult.data as any).assetClass,
      }).onConflictDoUpdate({
        target: exitScenarioKpis.scenarioId,
        set: {
          computedAt: new Date(),
          salePrice: String(result.kpis.salePrice),
          amountRealized: String(result.kpis.amountRealized),
          realizedGain: String(result.kpis.realizedGain),
          recognizedGain: String(result.kpis.recognizedGain),
          taxTotal: String(result.kpis.taxTotal),
          afterTaxCashNow: String(result.kpis.afterTaxCashNow),
          strategiesActive: result.kpis.strategiesActive as any,
        },
      });

      // Log event
      await tx.insert(exitScenarioEvents).values({
        scenarioId,
        eventType: 'recompute',
        payloadJson: {
          engineVersion: result.engineVersion,
          inputsChecksum: result.inputsChecksum,
          warningCount: result.warnings.length,
        } as any,
        userId,
      });
    });

    res.json(result);
  } catch (error: any) {
    console.error('Exit studio compute+persist error:', error);
    res.status(500).json({ error: 'Computation failed', message: error.message });
  }
});

// ============================================================
// PATCH /api/exit-studio/scenarios/:scenarioId/inputs
// Save v2 inputs to the scenario
// ============================================================
router.patch('/api/exit-studio/scenarios/:scenarioId/inputs', async (req: any, res) => {
  try {
    const orgId = req.user?.orgId;
    const userId = req.user?.id;
    const { scenarioId } = req.params;

    // Validate
    const parseResult = ExitScenarioInputSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'Invalid input',
        details: parseResult.error.issues,
      });
    }

    // Update
    const [updated] = await db.update(exitScenarios)
      .set({
        inputsJson: req.body,
        engineVersion: ENGINE_VERSION,
        assetClass: (parseResult.data as any).assetClass,
        updatedAt: new Date(),
        updatedBy: userId,
      } as any)
      .where(and(
        eq(exitScenarios.id, scenarioId),
        orgId ? eq(exitScenarios.orgId, orgId) : undefined as any,
      ))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: 'Scenario not found' });
    }

    // Log event
    await db.insert(exitScenarioEvents).values({
      scenarioId,
      eventType: 'update_inputs',
      payloadJson: { assetClass: (parseResult.data as any).assetClass } as any,
      userId,
    });

    res.json(updated);
  } catch (error: any) {
    console.error('Exit studio save inputs error:', error);
    res.status(500).json({ error: 'Save failed', message: error.message });
  }
});

// ============================================================
// GET /api/exit-studio/scenarios/:scenarioId/results
// Get latest cached result
// ============================================================
router.get('/api/exit-studio/scenarios/:scenarioId/results', async (req: any, res) => {
  try {
    const { scenarioId } = req.params;

    const [result] = await db.select()
      .from(exitScenarioResultsV2)
      .where(eq(exitScenarioResultsV2.scenarioId, scenarioId))
      .orderBy(desc(exitScenarioResultsV2.computedAt))
      .limit(1);

    if (!result) {
      return res.status(404).json({ error: 'No results found. Run compute first.' });
    }

    res.json(result.outputsJson);
  } catch (error: any) {
    console.error('Exit studio get results error:', error);
    res.status(500).json({ error: 'Failed to fetch results' });
  }
});

// ============================================================
// GET /api/exit-studio/scenarios/:scenarioId/kpis
// Get KPI projection (fast, flat columns)
// ============================================================
router.get('/api/exit-studio/scenarios/:scenarioId/kpis', async (req: any, res) => {
  try {
    const { scenarioId } = req.params;

    const [kpis] = await db.select()
      .from(exitScenarioKpis)
      .where(eq(exitScenarioKpis.scenarioId, scenarioId))
      .limit(1);

    if (!kpis) {
      return res.status(404).json({ error: 'No KPIs found. Run compute first.' });
    }

    res.json(kpis);
  } catch (error: any) {
    console.error('Exit studio get KPIs error:', error);
    res.status(500).json({ error: 'Failed to fetch KPIs' });
  }
});

// ============================================================
// GET /api/exit-studio/compare
// Compare multiple scenarios using KPI projection
// ============================================================
router.get('/api/exit-studio/compare', async (req: any, res) => {
  try {
    const scenarioIds = (req.query.ids as string)?.split(',') ?? [];
    if (scenarioIds.length < 2) {
      return res.status(400).json({ error: 'Provide at least 2 scenario IDs via ?ids=a,b,c' });
    }

    const kpis = await Promise.all(
      scenarioIds.map(id =>
        db.select().from(exitScenarioKpis)
          .where(eq(exitScenarioKpis.scenarioId, id))
          .limit(1)
          .then(rows => rows[0] ?? null)
      )
    );

    res.json({
      scenarios: scenarioIds,
      kpis: kpis.filter(Boolean),
      missingScenarios: scenarioIds.filter((id, i) => !kpis[i]),
    });
  } catch (error: any) {
    console.error('Exit studio compare error:', error);
    res.status(500).json({ error: 'Comparison failed' });
  }
});

// ============================================================
// GET /api/exit-studio/scenarios/:scenarioId/events
// Audit trail
// ============================================================
router.get('/api/exit-studio/scenarios/:scenarioId/events', async (req: any, res) => {
  try {
    const { scenarioId } = req.params;

    const events = await db.select()
      .from(exitScenarioEvents)
      .where(eq(exitScenarioEvents.scenarioId, scenarioId))
      .orderBy(desc(exitScenarioEvents.createdAt))
      .limit(100);

    res.json(events);
  } catch (error: any) {
    console.error('Exit studio events error:', error);
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

// ============================================================
// POST /api/exit-studio/scenarios/:scenarioId/lock
// Lock scenario to prevent drift
// ============================================================
router.post('/api/exit-studio/scenarios/:scenarioId/lock', async (req: any, res) => {
  try {
    const orgId = req.user?.orgId;
    const userId = req.user?.id;
    const { scenarioId } = req.params;

    const [updated] = await db.update(exitScenarios)
      .set({
        status: 'locked' as any,
        updatedAt: new Date(),
        updatedBy: userId,
      } as any)
      .where(and(
        eq(exitScenarios.id, scenarioId),
        orgId ? eq(exitScenarios.orgId, orgId) : undefined as any,
      ))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: 'Scenario not found' });
    }

    await db.insert(exitScenarioEvents).values({
      scenarioId,
      eventType: 'lock',
      payloadJson: { lockedBy: userId } as any,
      userId,
    });

    res.json({ success: true, status: 'locked' });
  } catch (error: any) {
    console.error('Exit studio lock error:', error);
    res.status(500).json({ error: 'Lock failed' });
  }
});

// ============================================================
// GET /api/exit-studio/assumption-sets
// Get asset class defaults
// ============================================================
router.get('/api/exit-studio/assumption-sets', async (req: any, res) => {
  try {
    const { assetClass } = req.query;

    let query = db.select().from(assetClassAssumptionSets);
    if (assetClass) {
      query = query.where(eq(assetClassAssumptionSets.assetClass, assetClass as string)) as any;
    }

    const sets = await query;
    res.json(sets);
  } catch (error: any) {
    console.error('Exit studio assumption sets error:', error);
    res.status(500).json({ error: 'Failed to fetch assumption sets' });
  }
});

// ============================================================
// POST /api/exit-studio/sync/exit-to-financial-model
// Push exit results → financial model (DCF, scenario versions, capital stack)
// ============================================================
router.post('/api/exit-studio/sync/exit-to-financial-model', async (req: any, res) => {
  try {
    const orgId = req.user?.orgId;
    const { projectId, scenarioId } = req.body;

    if (!projectId || !scenarioId) {
      return res.status(400).json({ error: 'projectId and scenarioId are required' });
    }

    const result = await exitIntegrationService.syncExitToFinancialModel(projectId, scenarioId, orgId);
    if (!result) {
      return res.status(404).json({ error: 'Exit scenario not found for this project' });
    }

    res.json({ synced: true, ...result });
  } catch (error: any) {
    console.error('Exit→FM sync error:', error);
    res.status(500).json({ error: 'Sync failed', message: error.message });
  }
});

// ============================================================
// POST /api/exit-studio/sync/financial-model-to-exit
// Pull financial model assumptions → exit scenario
// ============================================================
router.post('/api/exit-studio/sync/financial-model-to-exit', async (req: any, res) => {
  try {
    const orgId = req.user?.orgId;
    const { projectId, scenarioId } = req.body;

    if (!projectId || !scenarioId) {
      return res.status(400).json({ error: 'projectId and scenarioId are required' });
    }

    const result = await exitIntegrationService.syncFinancialModelToExit(projectId, scenarioId, orgId);
    if (!result) {
      return res.status(404).json({ error: 'Project not found' });
    }

    res.json({ synced: true, ...result });
  } catch (error: any) {
    console.error('FM→Exit sync error:', error);
    res.status(500).json({ error: 'Sync failed', message: error.message });
  }
});

// ============================================================
// POST /api/exit-studio/sync/deal-pricing
// Sync deal pricing ↔ exit scenarios
// ============================================================
router.post('/api/exit-studio/sync/deal-pricing', async (req: any, res) => {
  try {
    const orgId = req.user?.orgId;
    const { projectId, direction } = req.body;

    if (!projectId) {
      return res.status(400).json({ error: 'projectId is required' });
    }

    if (direction === 'exit-to-pricing') {
      const { scenarioId } = req.body;
      if (!scenarioId) {
        return res.status(400).json({ error: 'scenarioId required for exit-to-pricing' });
      }
      const success = await exitIntegrationService.syncExitToDealPricing(projectId, scenarioId, orgId);
      return res.json({ synced: success });
    }

    // Default: pricing-to-exit
    const result = await exitIntegrationService.syncDealPricingToExit(projectId, orgId);
    if (!result) {
      return res.status(404).json({ error: 'No pricing data found' });
    }

    res.json({ synced: true, ...result });
  } catch (error: any) {
    console.error('Deal pricing sync error:', error);
    res.status(500).json({ error: 'Sync failed', message: error.message });
  }
});

// ============================================================
// POST /api/exit-studio/sync/hold-period
// Sync hold period across all systems
// ============================================================
router.post('/api/exit-studio/sync/hold-period', async (req: any, res) => {
  try {
    const orgId = req.user?.orgId;
    const { projectId, holdPeriodYears } = req.body;

    if (!projectId || !holdPeriodYears || holdPeriodYears < 1 || holdPeriodYears > 30) {
      return res.status(400).json({ error: 'projectId and holdPeriodYears (1-30) are required' });
    }

    const result = await exitIntegrationService.syncHoldPeriod(projectId, holdPeriodYears, orgId);
    res.json({ synced: true, ...result });
  } catch (error: any) {
    console.error('Hold period sync error:', error);
    res.status(500).json({ error: 'Sync failed', message: error.message });
  }
});

// ============================================================
// GET /api/exit-studio/portfolio/exit-kpis
// Get actual exit KPIs for portfolio rollup (replaces hardcoded caps)
// ============================================================
router.get('/api/exit-studio/portfolio/exit-kpis', async (req: any, res) => {
  try {
    const orgId = req.user?.orgId;
    const projectIds = (req.query.projectIds as string)?.split(',').filter(Boolean);

    const kpis = await exitIntegrationService.getPortfolioExitKPIs(orgId, projectIds);
    res.json(kpis);
  } catch (error: any) {
    console.error('Portfolio exit KPIs error:', error);
    res.status(500).json({ error: 'Failed to fetch portfolio exit KPIs' });
  }
});

// ============================================================
// GET /api/exit-studio/portfolio/irr
// Compute portfolio IRR from actual exit KPIs
// ============================================================
router.get('/api/exit-studio/portfolio/irr', async (req: any, res) => {
  try {
    const orgId = req.user?.orgId;
    const projectIds = (req.query.projectIds as string)?.split(',').filter(Boolean);

    const result = await exitIntegrationService.computePortfolioIRRFromExitKPIs(orgId, projectIds);
    res.json(result);
  } catch (error: any) {
    console.error('Portfolio IRR error:', error);
    res.status(500).json({ error: 'Failed to compute portfolio IRR' });
  }
});

export const exitStudioRouter = router;
