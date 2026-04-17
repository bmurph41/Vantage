/**
 * server/routes/dcf-routes.ts
 * 
 * All DCF endpoints. Import and call registerDCFRoutes(app) from routes.ts.
 * 
 * Endpoints:
 *   POST /api/modeling/projects/:projectId/dcf           — Full DCF analysis
 *   POST /api/dcf/quick-irr                               — Quick IRR
 *   POST /api/modeling/projects/:projectId/dcf/monte-carlo — Monte Carlo
 *   GET  /api/modeling/projects/:projectId/dcf/decision-support — Fast DS
 *   POST /api/modeling/projects/:projectId/dcf/decision-support — Full DS
 * 
 * NOTE: All /api/modeling/projects/ routes are CSRF-exempt per existing config.
 * NOTE: Uses raw SQL (pool.query) — do NOT use Drizzle on enable_rls tables.
 */

import type { Express, Request, Response } from 'express';
import { performDCFAnalysis, computeQuickIRR, loadLeaseIncomeForProject } from '../services/dcf-calculator-service';
import { runMonteCarlo } from '../services/dcf-simulation-service';
import { runDecisionSupport, checkEntitlement } from '../services/dcf-decision-support-service';
import { getModelConfig } from '../../shared/asset-class-model-config';

// Import your existing engine functions — adjust paths to match your project
// import { computeDirectInputFinancials } from '../services/direct-input-engine';
// import { computeMultiYearProjection } from '../services/multi-year-projection-engine';
// import { generateDebtSchedule } from '../../shared/debt/debt-engine';

export function registerDCFRoutes(
  app: Express,
  deps: {
    pool: any;
    authenticateUser: any;
    computeDirectInputFinancials: (assetClass: string, assumptions: any, unitMix: any) => any;
    computeMultiYearProjection: (year1: any, config: any) => any;
    generateDebtSchedule?: (tranches: any[], holdPeriod: number) => any;
  }
) {
  const { pool, authenticateUser, computeDirectInputFinancials, computeMultiYearProjection, generateDebtSchedule } = deps;

  // ── Full DCF Analysis ──────────────────────────────────────────────────
  app.post(
    '/api/modeling/projects/:projectId/dcf',
    authenticateUser,
    async (req: Request, res: Response) => {
      try {
        const { projectId } = req.params;
        const orgId = (req as any).user?.orgId ?? '';
        const { discountRate, overrides } = req.body ?? {};

        const result = await performDCFAnalysis(
          { projectId, orgId, discountRate, overrides },
          { pool, computeDirectInputFinancials, computeMultiYearProjection, generateDebtSchedule }
        );

        if (!result) {
          return res.status(422).json({ error: 'No inputs — complete property assumptions on the Inputs tab first.' });
        }
        res.json(result);
      } catch (err: any) {
        console.error('DCF analysis error:', err);
        res.status(500).json({ error: err.message ?? 'DCF analysis failed' });
      }
    }
  );

  // ── Quick IRR ──────────────────────────────────────────────────────────
  app.post(
    '/api/dcf/quick-irr',
    authenticateUser,
    async (req: Request, res: Response) => {
      try {
        const { projectId, discountRate } = req.body ?? {};
        if (!projectId) {
          return res.status(400).json({ error: 'projectId is required' });
        }

        const orgId = (req as any).user?.orgId ?? '';
        const result = await computeQuickIRR(
          { projectId, orgId, discountRate },
          { pool, computeDirectInputFinancials, computeMultiYearProjection, generateDebtSchedule }
        );

        res.json(result);
      } catch (err: any) {
        console.error('Quick IRR error:', err);
        res.status(500).json({ error: err.message ?? 'Quick IRR failed' });
      }
    }
  );

  // ── Monte Carlo Simulation ─────────────────────────────────────────────
  app.post(
    '/api/modeling/projects/:projectId/dcf/monte-carlo',
    authenticateUser,
    async (req: Request, res: Response) => {
      try {
        const { projectId } = req.params;
        const orgId = (req as any).user?.orgId ?? '';
        const body = req.body ?? {};

        // Load project and compute base inputs (same pattern as DCF)
        const projectData = await loadProjectQuick(pool, projectId);
        const scenarioData = await loadScenarioQuick(pool, projectData.modelingProjectId);
        const capitalStack = await loadCapitalStackQuick(pool, projectData.modelingProjectId);

        // Inject seasonality
        const mcAssumptions = { ...projectData.inputAssumptions };
        if (!mcAssumptions.inSeasonMonths || mcAssumptions.inSeasonMonths.length === 0) {
          const mc = getModelConfig(projectData.assetClass);
          mcAssumptions.inSeasonMonths = mc.seasonConfig.defaultInSeasonMonths || [];
        }

        const year1 = computeDirectInputFinancials(
          projectData.assetClass,
          mcAssumptions,
          projectData.unitMix
        );

        const holdPeriod = scenarioData.holdPeriod;
        const baseConfig = {
          holdPeriod,
          revenueGrowthRate: scenarioData.revenueGrowthRate / 100,
          expenseGrowthRate: scenarioData.expenseGrowthRate / 100,
          exitCapRate: scenarioData.exitCapRate / 100,
          sellingCostPct: 0.03,
        };

        const purchasePrice = capitalStack?.purchasePrice ?? projectData.purchasePrice ?? 0;
        let annualDS = new Array(holdPeriod).fill(0);
        let debtPayoff = 0;
        let totalDebt = 0;

        // Debt from capital stack (already aggregated)
        const csDebt = capitalStack?.totalDebt ?? 0;
        const csRate = capitalStack?.blendedDebtRate ?? 0;
        if (csDebt > 0 && csRate > 0) {
          annualDS = new Array(holdPeriod).fill(csDebt * csRate);
          debtPayoff = csDebt;
          totalDebt = csDebt;
        }

        const equity = {
          equityInvested: purchasePrice - totalDebt,
          acquisitionDate: scenarioData.acquisitionCloseDate ?? new Date().toISOString().split('T')[0],
          annualDebtService: annualDS,
          debtBalanceAtExit: debtPayoff,
          purchasePrice,
        };

        const result = runMonteCarlo(
          year1, computeMultiYearProjection, baseConfig, equity,
          {
            projectId,
            orgId,
            n: body.n,
            seed: body.seed,
            mode: body.mode,
            distributions: body.distributions,
            hurdleIRR: body.hurdleIRR,
            discountRate: body.discountRate,
          }
        );

        res.json(result);
      } catch (err: any) {
        console.error('Monte Carlo error:', err);
        res.status(500).json({ error: err.message ?? 'Monte Carlo simulation failed' });
      }
    }
  );

  // ── GET /dcf — TanStack Query default (mirrors POST but no body) ──────────
  app.get(
    '/api/modeling/projects/:projectId/dcf',
    authenticateUser,
    async (req: Request, res: Response) => {
      try {
        const { projectId } = req.params;
        const orgId = (req as any).user?.orgId ?? '';
        const result = await performDCFAnalysis(
          { projectId, orgId, discountRate: undefined, overrides: undefined },
          { pool, computeDirectInputFinancials, computeMultiYearProjection, generateDebtSchedule }
        );
        if (!result) {
          return res.status(422).json({ error: 'No inputs — complete property assumptions on the Inputs tab first.' });
        }
        res.json(result);
      } catch (err: any) {
        console.error('DCF GET error:', err);
        res.status(500).json({ error: err.message ?? 'DCF analysis failed' });
      }
    }
  );

  // ── Decision Support (Fast — GET) ──────────────────────────────────────
  app.get(
    '/api/modeling/projects/:projectId/dcf/decision-support',
    authenticateUser,
    async (req: Request, res: Response) => {
      try {
        const { projectId } = req.params;
        const orgId = (req as any).user?.orgId ?? '';
        const userId = (req as any).user?.id;

        const result = await runDecisionSupport(
          {
            projectId,
            orgId,
            mode: 'fast',
            hurdleIRR: Number(req.query.hurdleIRR) || 12,
            discountRate: Number(req.query.discountRate) || 10,
            memoTone: (req.query.memoTone as any) || 'concise',
          },
          { pool, computeDirectInputFinancials, computeMultiYearProjection, generateDebtSchedule, userId }
        );

        res.json(result);
      } catch (err: any) {
        console.error('Decision support (fast) error:', err);
        res.status(500).json({ error: err.message ?? 'Decision support failed' });
      }
    }
  );

  // ── Lease Income Reconciliation ────────────────────────────────────────
  // GET /api/modeling/projects/:projectId/lease-income
  // Returns tenant lease income data for the given project, including base rent,
  // recoveries, escalation schedules, and per-tenant breakdown.
  app.get(
    '/api/modeling/projects/:projectId/lease-income',
    authenticateUser,
    async (req: Request, res: Response) => {
      try {
        const { projectId } = req.params;
        const orgId = (req as any).user?.orgId ?? '';

        // Authorization: confirm this project belongs to the requesting org
        const projectCheck = await pool.query(
          `SELECT id FROM modeling_projects WHERE id = $1 AND org_id = $2 LIMIT 1`,
          [projectId, orgId]
        );
        if (!projectCheck.rows[0]) {
          return res.status(403).json({ error: 'Project not found or access denied' });
        }

        const leaseIncome = await loadLeaseIncomeForProject(pool, projectId);

        // Compute year-by-year projection with escalations for the breakdown
        const holdPeriod = Number(req.query.holdPeriod) || 5;
        const yearlyProjection: Array<{
          year: number;
          baseRentAnnual: number;
          recoveryAnnual: number;
          totalEGI: number;
        }> = [];

        for (let yr = 1; yr <= holdPeriod; yr++) {
          let baseRent = 0;
          let recovery = 0;

          for (const lease of leaseIncome.leaseBreakdown) {
            const growthFactor = Math.pow(1 + lease.escalationRate, yr - 1);
            baseRent += lease.baseRentAnnual * growthFactor;
            // Recovery income grows at a flat 2.5% per year assumption
            recovery += lease.recoveryAnnual * Math.pow(1.025, yr - 1);
          }

          yearlyProjection.push({
            year: yr,
            baseRentAnnual: Math.round(baseRent),
            recoveryAnnual: Math.round(recovery),
            totalEGI: Math.round(baseRent + recovery),
          });
        }

        res.json({
          projectId,
          ...leaseIncome,
          yearlyProjection,
        });
      } catch (err: any) {
        console.error('Lease income route error:', err);
        res.status(500).json({ error: err.message ?? 'Failed to load lease income' });
      }
    }
  );

  // ── Decision Support (Full — POST) ─────────────────────────────────────
  app.post(
    '/api/modeling/projects/:projectId/dcf/decision-support',
    authenticateUser,
    async (req: Request, res: Response) => {
      try {
        const { projectId } = req.params;
        const orgId = (req as any).user?.orgId ?? '';
        const userId = (req as any).user?.id;
        const body = req.body ?? {};

        const result = await runDecisionSupport(
          {
            projectId,
            orgId,
            mode: body.mode ?? 'full',
            includeMonteCarlo: body.includeMonteCarlo ?? true,
            monteCarloN: body.monteCarloN,
            monteCarloSeed: body.monteCarloSeed,
            hurdleIRR: body.hurdleIRR,
            discountRate: body.discountRate,
            memoTone: body.memoTone,
          },
          { pool, computeDirectInputFinancials, computeMultiYearProjection, generateDebtSchedule, userId }
        );

        res.json(result);
      } catch (err: any) {
        console.error('Decision support (full) error:', err);
        res.status(500).json({ error: err.message ?? 'Decision support failed' });
      }
    }
  );
}

// ─── Quick DB Loaders (reused from dcf-calculator-service pattern) ───────────

async function loadProjectQuick(pool: any, projectId: string) {
  const r = await pool.query(
    `SELECT mp.id as modeling_project_id, mp.asset_class, mp.custom_metrics, mp.purchase_price
     FROM modeling_projects mp
     WHERE mp.id = $1 LIMIT 1`,
    [projectId]
  );
  const row = r.rows[0] ?? {};
  const cm = typeof row.custom_metrics === 'string' ? JSON.parse(row.custom_metrics) : row.custom_metrics ?? {};
  return {
    modelingProjectId: row.id,
    assetClass: row.asset_class ?? 'str',
    inputAssumptions: cm.inputAssumptions ?? {},
    unitMix: cm.unitMix ?? [],
    purchasePrice: Number(row.purchase_price) || 0,
  };
}

async function loadScenarioQuick(pool: any, mpId: string) {
  const sv = await pool.query(
    `SELECT revenue_growth_rate, expense_growth_rate, exit_cap_rate
     FROM modeling_scenario_versions WHERE modeling_project_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [mpId]
  );
  const pc = await pool.query(
    `SELECT hold_period, acquisition_close_date
     FROM modeling_project_config WHERE modeling_project_id = $1 LIMIT 1`,
    [mpId]
  );
  const s = sv.rows[0] ?? {};
  const c = pc.rows[0] ?? {};
  return {
    revenueGrowthRate: Number(s.revenue_growth_rate) || 3,
    expenseGrowthRate: Number(s.expense_growth_rate) || 2.5,
    exitCapRate: Number(s.exit_cap_rate) || 7.0,
    holdPeriod: Number(c.hold_period) || 5,
    acquisitionCloseDate: c.acquisition_close_date ?? null,
  };
}

async function loadCapitalStackQuick(pool: any, mpId: string) {
  const r = await pool.query(
    `SELECT purchase_price, total_debt, blended_debt_rate, hold_period_years
     FROM capital_stacks WHERE modeling_project_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [mpId]
  );
  if (!r.rows[0]) return null;
  const row = r.rows[0];
  return {
    purchasePrice: Number(row.purchase_price) || 0,
    debtTranches: [],
    holdPeriodYears: Number(row.hold_period_years) || 5,
  };
}
