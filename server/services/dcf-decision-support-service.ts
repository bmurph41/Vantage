/**
 * server/services/dcf-decision-support-service.ts
 * 
 * Layer 4 — Decision Support orchestrator.
 * Gated behind entitlement + user preference.
 * 
 * Fast mode: tornado + memo (deterministic, no MC required)
 * Full mode: tornado + attribution + memo with MC quantiles
 */

import { runScenarioAnalysis, ScenarioAnalysisResult } from './dcf-scenario-layer';
import { runMonteCarlo, MonteCarloResult } from './dcf-simulation-service';
import { computeTornado, getDefaultDrivers, TornadoResult, TornadoConfig } from '../../shared/finance/tornado';
import { computeAttribution, AttributionResult, MCAttributionSample } from '../../shared/finance/attribution';
import { generateMemo, MemoResult, MemoTone, MemoInput } from '../../shared/finance/memo-generator';
import { sampleDistribution, createSeededRNG, DistributionConfig } from '../../shared/finance/distributions';
import { DEFAULT_DISTRIBUTIONS } from './dcf-simulation-service';
import { calculateXIRR, calculateNPV, DatedCashFlow } from '../../shared/finance/xirr';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface DecisionSupportRequest {
  projectId: string;
  orgId: string;
  scenarioVersionId?: string;
  includeMonteCarlo?: boolean;
  monteCarloN?: number;
  monteCarloSeed?: number;
  hurdleIRR?: number;
  discountRate?: number;
  memoTone?: MemoTone;
  mode?: 'fast' | 'full';
}

export interface DecisionSupportResult {
  enabled: boolean;
  entitled: boolean;
  tornado?: TornadoResult;
  attribution?: AttributionResult;
  memo?: MemoResult;
  scenarios?: ScenarioAnalysisResult;
  monteCarlo?: MonteCarloResult;
  meta: {
    generatedAt: string;
    mode: 'fast' | 'full';
    assumptions: Record<string, any>;
  };
}

export interface EntitlementCheck {
  entitled: boolean;
  enabled: boolean;
}

// ─── Feature Gating ──────────────────────────────────────────────────────────

/**
 * Check if user/org has decision support entitlement.
 * 
 * Checks in order:
 * 1. Org subscription tier (if organizations table has a tier/plan column)
 * 2. User preferences (dcfDecisionSupportEnabled)
 * 3. Fallback: enabled for all (MVP — tighten later)
 */
export async function checkEntitlement(
  pool: any,
  orgId: string,
  userId?: string
): Promise<EntitlementCheck> {
  // Check org tier
  let entitled = false;
  try {
    const orgResult = await pool.query(
      'SELECT id FROM organizations WHERE id = $1 LIMIT 1',
      [orgId]
    );
    const org = orgResult.rows[0];
    if (org) {
      // MVP: no subscription tier system yet — allow all
      entitled = true;
    }
  } catch {
    // Table/columns may not exist — fall back to enabled
    entitled = true; // MVP: allow all until gating is implemented
  }

  // Check user preference
  let enabled = false;
  if (entitled && userId) {
    try {
      // MVP: no user preferences column yet — default to entitled state
      enabled = entitled;
    } catch {
      enabled = entitled; // If no prefs table, default to entitled state
    }
  } else {
    enabled = entitled;
  }

  return { entitled, enabled };
}

// ─── Main Orchestrator ───────────────────────────────────────────────────────

export async function runDecisionSupport(
  request: DecisionSupportRequest,
  deps: {
    pool: any;
    computeDirectInputFinancials: (assetClass: string, assumptions: any, unitMix: any) => any;
    computeMultiYearProjection: (year1: any, config: any) => any;
    generateDebtSchedule?: (tranches: any[], holdPeriod: number) => any;
    userId?: string;
  }
): Promise<DecisionSupportResult> {
  const { pool, computeDirectInputFinancials, computeMultiYearProjection } = deps;
  const mode = request.mode ?? 'fast';
  const hurdleIRR = request.hurdleIRR ?? 12;
  const discountRate = request.discountRate ?? 10;
  const memoTone = request.memoTone ?? 'concise';

  // Check entitlement
  const entitlement = await checkEntitlement(pool, request.orgId, deps.userId);
  if (!entitlement.entitled || !entitlement.enabled) {
    return {
      enabled: entitlement.enabled,
      entitled: entitlement.entitled,
      meta: {
        generatedAt: new Date().toISOString(),
        mode,
        assumptions: {},
      },
    };
  }

  // Load project data (reuse pattern from dcf-calculator-service)
  const projectData = await loadProjectForDS(pool, request.projectId);
  const scenarioData = await loadScenarioForDS(pool, projectData.modelingProjectId);
  const capitalStack = await loadCapitalStackForDS(pool, projectData.modelingProjectId);

  // Compute Year 1
  const year1 = computeDirectInputFinancials(
    projectData.assetClass,
    projectData.inputAssumptions,
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

  // Debt
  const debtTranches = capitalStack?.debtTranches ?? [];
  let annualDebtService: number[] = new Array(holdPeriod).fill(0);
  let debtBalanceAtExit = 0;
  let totalDebt = 0;

  if (deps.generateDebtSchedule && debtTranches.length > 0) {
    try {
      const schedule = deps.generateDebtSchedule(debtTranches, holdPeriod);
      annualDebtService = schedule.annualDebtService ?? annualDebtService;
      debtBalanceAtExit = schedule.remainingBalanceAtExit ?? 0;
      totalDebt = schedule.totalDebtAtClose ?? 0;
    } catch { /* no debt */ }
  }

  const purchasePrice = capitalStack?.purchasePrice ?? projectData.purchasePrice ?? 0;
  const equityInvested = purchasePrice - totalDebt;

  const equity = {
    equityInvested,
    acquisitionDate: scenarioData.acquisitionCloseDate ?? new Date().toISOString().split('T')[0],
    annualDebtService,
    debtBalanceAtExit,
    purchasePrice,
  };

  // ── Run Scenarios (always) ─────────────────────────────────────────────
  const scenarios = runScenarioAnalysis(
    year1, computeMultiYearProjection, baseConfig, equity, discountRate, undefined, hurdleIRR
  );

  // ── Tornado (always) ──────────────────────────────────────────────────
  const tornadoConfig: TornadoConfig = {
    drivers: getDefaultDrivers(),
    target: 'irr',
    discountRate,
  };
  const tornado = computeTornado(
    year1, computeMultiYearProjection, baseConfig, equity, tornadoConfig
  );

  // ── Monte Carlo + Attribution (full mode only) ─────────────────────────
  let mcResult: MonteCarloResult | undefined;
  let attribution: AttributionResult | undefined;

  if (mode === 'full' || request.includeMonteCarlo) {
    mcResult = runMonteCarlo(
      year1, computeMultiYearProjection, baseConfig, equity,
      {
        projectId: request.projectId,
        orgId: request.orgId,
        n: request.monteCarloN ?? 2000,
        seed: request.monteCarloSeed,
        hurdleIRR,
        discountRate,
        mode: 'fast',
      }
    );

    // Build attribution samples from MC
    if (mcResult.samplesPreview.length >= 30) {
      // We need the actual sampled inputs — re-run a small set for attribution
      const attrSamples = buildAttributionSamples(
        year1, computeMultiYearProjection, baseConfig, equity,
        Math.min(request.monteCarloN ?? 500, 500),
        request.monteCarloSeed ?? Date.now(),
        discountRate
      );
      attribution = computeAttribution(attrSamples, 'irr');
    }
  }

  // ── Memo ──────────────────────────────────────────────────────────────
  const memoInput: MemoInput = {
    projectName: projectData.projectName,
    assetClass: projectData.assetClass,
    base: scenarios.base,
    upside: scenarios.upside,
    downside: scenarios.downside,
    expectedCase: scenarios.expectedCase,
    mcStats: mcResult?.stats,
    risks: mcResult?.risks,
    tornado,
    attribution,
    purchasePrice,
    equityInvested,
    holdPeriodYears: holdPeriod,
    totalDebt,
    hurdleIRR,
    discountRate,
  };
  const memo = generateMemo(memoInput, memoTone);

  return {
    enabled: true,
    entitled: true,
    tornado,
    attribution,
    memo,
    scenarios,
    monteCarlo: mcResult,
    meta: {
      generatedAt: new Date().toISOString(),
      mode,
      assumptions: {
        holdPeriod,
        revenueGrowthRate: scenarioData.revenueGrowthRate,
        expenseGrowthRate: scenarioData.expenseGrowthRate,
        exitCapRate: scenarioData.exitCapRate,
        purchasePrice,
        totalDebt,
        hurdleIRR,
        discountRate,
      },
    },
  };
}

// ─── Attribution Sample Builder ──────────────────────────────────────────────

function buildAttributionSamples(
  year1: any,
  computeMultiYearProjection: (y1: any, config: any) => any,
  baseConfig: any,
  equity: any,
  n: number,
  seed: number,
  discountRate: number,
): MCAttributionSample[] {
  // DEFAULT_DISTRIBUTIONS imported at top level
  // calculateXIRR, calculateNPV imported at top level

  const rng = createSeededRNG(seed);
  const samples: MCAttributionSample[] = [];

  for (let i = 0; i < n; i++) {
    const growthDelta = sampleDistribution(DEFAULT_DISTRIBUTIONS.revenueGrowthRateDelta, rng);
    const exitCapDelta = sampleDistribution(DEFAULT_DISTRIBUTIONS.exitCapRateDelta, rng);
    const saleCostDelta = sampleDistribution(DEFAULT_DISTRIBUTIONS.saleCostRateDelta, rng);
    const priceDelta = sampleDistribution(DEFAULT_DISTRIBUTIONS.purchasePriceDelta, rng);

    const growth = baseConfig.revenueGrowthRate + growthDelta / 100;
    const exitCap = Math.max(baseConfig.exitCapRate + exitCapDelta / 100, 0.01);
    const sellCost = Math.max(baseConfig.sellingCostPct + saleCostDelta / 100, 0);
    const priceAdj = equity.purchasePrice * (1 + priceDelta / 100);
    const equityAdj = priceAdj - (equity.purchasePrice - equity.equityInvested);

    const proj = computeMultiYearProjection(year1, {
      holdPeriod: baseConfig.holdPeriod,
      revenueGrowthRate: growth,
      expenseGrowthRate: baseConfig.expenseGrowthRate,
      exitCapRate: exitCap,
      sellingCostPct: sellCost,
    });

    const flows = buildFlowsForAttribution(
      equity.acquisitionDate, equityAdj, proj.years, equity.annualDebtService,
      proj.exit, equity.debtBalanceAtExit
    );

    const irr = calculateXIRR(flows).irr;
    const npv = calculateNPV(flows, discountRate);

    samples.push({
      inputs: {
        revenueGrowthDelta: growthDelta,
        exitCapDelta,
        saleCostDelta,
        priceDelta,
      },
      irr,
      npv,
    });
  }

  return samples;
}

function buildFlowsForAttribution(
  acqDate: string, equity: number, years: any[], ds: number[],
  exit: any, debtPayoff: number
): any[] {
  // DatedCashFlow imported at top level
  const flows = [{ date: acqDate, amount: -Math.abs(equity) }];
  for (let i = 0; i < years.length; i++) {
    const lev = years[i].ncf - (ds[i] ?? 0);
    const isLast = i === years.length - 1;
    const exitAmt = isLast ? ((exit?.netSaleProceeds ?? 0) - debtPayoff) : 0;
    const d = new Date(acqDate);
    d.setFullYear(d.getFullYear() + years[i].year);
    flows.push({ date: d.toISOString().split('T')[0], amount: lev + exitAmt });
  }
  return flows;
}

// ─── DB Loaders ──────────────────────────────────────────────────────────────

async function loadProjectForDS(pool: any, projectId: string) {
  const r = await pool.query(
    'SELECT id, org_id, asset_class, custom_metrics, purchase_price, marina_name FROM modeling_projects WHERE id = $1 LIMIT 1',
    [projectId]
  );
  const row = r.rows[0] ?? {};
  const cm = typeof row.custom_metrics === 'string' ? JSON.parse(row.custom_metrics) : row.custom_metrics ?? {};
  return {
    modelingProjectId: row.id,
    assetClass: row.asset_class ?? 'str',
    projectName: row.marina_name ?? 'Unknown Project',
    inputAssumptions: cm.inputAssumptions ?? {},
    unitMix: cm.unitMix ?? [],
    purchasePrice: Number(row.purchase_price) || 0,
  };
}

async function loadScenarioForDS(pool: any, modelingProjectId: string) {
  const sv = await pool.query(
    `SELECT revenue_growth_rate, expense_growth_rate, exit_cap_rate
     FROM modeling_scenario_versions
     WHERE modeling_project_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [modelingProjectId]
  );
  const pc = await pool.query(
    `SELECT hold_period, acquisition_close_date
     FROM modeling_project_config
     WHERE modeling_project_id = $1 LIMIT 1`,
    [modelingProjectId]
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

async function loadCapitalStackForDS(pool: any, modelingProjectId: string) {
  const r = await pool.query(
    `SELECT purchase_price, total_equity, debt_tranches, hold_period_years
     FROM capital_stacks WHERE modeling_project_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [modelingProjectId]
  );
  if (!r.rows[0]) return null;
  const row = r.rows[0];
  return {
    purchasePrice: Number(row.purchase_price) || 0,
    totalEquity: Number(row.total_equity) || 0,
    debtTranches: typeof row.debt_tranches === 'string' ? JSON.parse(row.debt_tranches) : row.debt_tranches ?? [],
    holdPeriodYears: Number(row.hold_period_years) || 5,
  };
}
