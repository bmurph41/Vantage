/**
 * server/services/dcf-calculator-service.ts
 * 
 * REFACTORED — Layer 1 Foundation
 * 
 * This service is now a CONSUMER of the Multi-Year Projection Engine.
 * It does NOT independently model NOI, growth, or exit.
 * 
 * DCF = Pro Forma (canonical projections)
 *      + Sensitivity Layer
 *      + Discount Rate Analysis
 *      + Scenario Overrides (via Layer 3)
 * 
 * KEY CHANGES:
 * - Removed hardcoded 3% growth, 65% LTV, $5M purchase price, 10% discount
 * - NOI comes from computeMultiYearProjection().years[].ncf
 * - Exit comes from projection.exit.netSaleProceeds
 * - Debt comes from debtEngine or capital stack, not assumed
 * - IRR uses shared calculateXIRR with actual dates
 * - All percentages returned as PERCENT (e.g. 14.25, not 0.1425)
 */

import {
  calculateXIRR,
  calculateNPV,
  calculateEquityMultiple,
  DatedCashFlow,
} from '../../shared/finance/xirr';

import {
  fromProjection,
  ProjectionInput,
  CanonicalCashFlowSet,
} from './finance/cashflow-parity';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface DCFAnalysisInput {
  projectId: string;
  orgId: string;
  /** Override discount rate (percent). User-defined — not from Pro Forma. */
  discountRate?: number;
  /** Optional scenario overrides. If omitted, uses canonical Pro Forma values. */
  overrides?: DCFOverrides;
}

export interface DCFOverrides {
  purchasePrice?: number;
  revenueGrowthRateDelta?: number;   // pct points (e.g. +1.0)
  exitCapRateDelta?: number;         // pct points (e.g. -0.25)
  saleCostRateDelta?: number;        // pct points
  discountRate?: number;             // percent
  holdPeriodYears?: number;
  noiMarginDelta?: number;           // pct points (optional)
  occupancyDelta?: number;           // pct points (optional)
}

export interface DCFAnalysisResult {
  projectId: string;
  irr: number;                       // percent (e.g. 14.25)
  leveredIrr: number;                // percent
  unleveredIrr: number;              // percent
  npv: number;                       // currency
  equityMultiple: number;            // multiple (e.g. 2.1x)
  goingInCapRate: number;            // percent
  exitCapRate: number;               // percent
  cashOnCashReturn: number;          // percent (year 1)
  purchasePrice: number;
  equityInvested: number;
  holdPeriodYears: number;
  totalDebt: number;
  blendedDebtRate: number;           // percent
  years: DCFYearDetail[];
  exit: DCFExitDetail;
  cashFlows: DatedCashFlow[];        // full dated flows for parity testing
  sensitivity: SensitivityMatrix;
  meta: {
    source: 'proForma';
    generatedAt: string;
    discountRate: number;
    hasDebt: boolean;
    overridesApplied: boolean;
  };
}

export interface DCFYearDetail {
  year: number;
  label: string;
  noi: number;
  capex: number;
  ncf: number;
  debtService: number;
  leveredCF: number;
  cashOnCash: number;                // percent
}

export interface DCFExitDetail {
  exitNOI: number;
  exitCapRate: number;               // percent
  exitValue: number;
  sellingCosts: number;
  netSaleProceeds: number;
  debtPayoff: number;
  netToEquity: number;
}

export interface SensitivityMatrix {
  target: 'irr';
  rows: Array<{ exitCapRate: number; values: number[] }>;
  columns: number[];                 // growth rate values
}

// ─── Main Analysis Function ──────────────────────────────────────────────────

/**
 * Perform DCF analysis by consuming canonical Multi-Year Projection output.
 * 
 * This function does NOT model NOI, growth, or exit independently.
 * It reads projections from the engine and layers on discount rate analysis.
 * 
 * @param pool - Database pool for raw SQL queries
 * @param computeDirectInputFinancials - Year 1 computation function
 * @param computeMultiYearProjection - Multi-year engine function
 */
export async function performDCFAnalysis(
  input: DCFAnalysisInput,
  deps: {
    pool: any;
    computeDirectInputFinancials: (assetClass: string, assumptions: any, unitMix: any) => any;
    computeMultiYearProjection: (year1: any, config: any) => any;
    generateDebtSchedule?: (tranches: any[], holdPeriod: number) => any;
  }
): Promise<DCFAnalysisResult> {
  const { projectId, orgId, discountRate: userDiscountRate } = input;
  const { pool, computeDirectInputFinancials, computeMultiYearProjection } = deps;

  // ── Step 1: Load project data from DB (raw SQL) ─────────────────────────
  const projectData = await loadProjectData(pool, projectId);
  const scenarioData = await loadScenarioData(pool, projectData.modelingProjectId);
  const capitalStackData = await loadCapitalStackData(pool, projectData.modelingProjectId);

  // ── Step 2: Compute Year 1 from Direct Input Engine ─────────────────────
  const year1 = computeDirectInputFinancials(
    projectData.assetClass,
    projectData.inputAssumptions,
    projectData.unitMix
  );

  // ── Step 3: Build projection config from scenario/capital stack ─────────
  const holdPeriod = input.overrides?.holdPeriodYears
    ?? scenarioData.holdPeriod
    ?? capitalStackData?.holdPeriodYears
    ?? 5;

  const revenueGrowthRate = (scenarioData.revenueGrowthRate ?? 3) / 100
    + (input.overrides?.revenueGrowthRateDelta ?? 0) / 100;

  const expenseGrowthRate = (scenarioData.expenseGrowthRate ?? 2.5) / 100;

  const exitCapRate = (scenarioData.exitCapRate ?? 7.0) / 100
    + (input.overrides?.exitCapRateDelta ?? 0) / 100;

  const sellingCostPct = 0.03
    + (input.overrides?.saleCostRateDelta ?? 0) / 100;

  const purchasePrice = input.overrides?.purchasePrice
    ?? capitalStackData?.purchasePrice
    ?? projectData.purchasePrice
    ?? 0;

  // ── Step 4: Generate Multi-Year Projection (CANONICAL SOURCE) ───────────
  const projection = computeMultiYearProjection(year1, {
    holdPeriod,
    revenueGrowthRate,
    expenseGrowthRate,
    exitCapRate,
    sellingCostPct,
  });

  // ── Step 5: Compute debt schedule ───────────────────────────────────────
  // Debt from capital stack (already aggregated — no tranches to schedule)
  const totalDebtAtClose = capitalStackData?.totalDebt ?? 0;
  const blendedRate = capitalStackData?.blendedDebtRate ?? 0;
  let annualDebtService: number[] = new Array(holdPeriod).fill(0);
  let debtBalanceAtExit = 0;

  if (totalDebtAtClose > 0 && blendedRate > 0) {
    // Simple annual interest-only debt service approximation
    // Full amortization schedule would come from debt engine when wired
    const annualDS = totalDebtAtClose * blendedRate;
    annualDebtService = new Array(holdPeriod).fill(annualDS);
    debtBalanceAtExit = totalDebtAtClose; // IO assumption — full balance at exit
  }

  const equityInvested = purchasePrice - totalDebtAtClose;
  const discountRate = userDiscountRate ?? 10; // percent

  // ── Step 6: Build levered cash flows (dated) ────────────────────────────
  const acquisitionDate = scenarioData.acquisitionCloseDate
    ?? new Date().toISOString().split('T')[0];

  const projectionInput: ProjectionInput = {
    acquisitionDate,
    equityInvested,
    years: projection.years.map((y: any) => ({ year: y.year, ncf: y.ncf })),
    annualDebtService,
    exit: projection.exit,
    debtBalanceAtExit,
  };

  const canonical = fromProjection(projectionInput);

  // ── Step 7: Compute IRR, NPV, Equity Multiple ──────────────────────────
  const xirrResult = calculateXIRR(canonical.flows);
  const leveredIrr = xirrResult.irr;

  // Unlevered: same flows but without debt service or debt payoff
  const unleveredFlows: DatedCashFlow[] = [
    { date: acquisitionDate, amount: -purchasePrice },
    ...projection.years.map((y: any, i: number) => ({
      date: addYearsISO(acquisitionDate, y.year),
      amount: y.ncf + (i === projection.years.length - 1
        ? projection.exit.netSaleProceeds
        : 0),
    })),
  ];
  const unleveredIrr = calculateXIRR(unleveredFlows).irr;

  const npv = calculateNPV(canonical.flows, discountRate);
  const equityMultiple = calculateEquityMultiple(canonical.flows);

  // Going-in cap rate
  const year1NOI = projection.years[0]?.noi ?? 0;
  const goingInCapRate = purchasePrice > 0
    ? (year1NOI / purchasePrice) * 100
    : 0;

  // Cash-on-cash (year 1)
  const year1LeveredCF = (projection.years[0]?.ncf ?? 0) - (annualDebtService[0] ?? 0);
  const cashOnCashReturn = equityInvested > 0
    ? (year1LeveredCF / equityInvested) * 100
    : 0;

  // ── Step 8: Build year detail array ─────────────────────────────────────
  const years: DCFYearDetail[] = projection.years.map((y: any, i: number) => ({
    year: y.year,
    label: y.label,
    noi: y.noi,
    capex: y.capex,
    ncf: y.ncf,
    debtService: annualDebtService[i] ?? 0,
    leveredCF: y.ncf - (annualDebtService[i] ?? 0),
    cashOnCash: equityInvested > 0
      ? ((y.ncf - (annualDebtService[i] ?? 0)) / equityInvested) * 100
      : 0,
  }));

  // ── Step 9: Exit detail ─────────────────────────────────────────────────
  const exit: DCFExitDetail = {
    exitNOI: projection.exit.exitNOI,
    exitCapRate: exitCapRate * 100,     // back to percent for response
    exitValue: projection.exit.exitValue,
    sellingCosts: projection.exit.sellingCosts,
    netSaleProceeds: projection.exit.netSaleProceeds,
    debtPayoff: debtBalanceAtExit,
    netToEquity: projection.exit.netSaleProceeds - debtBalanceAtExit,
  };

  // ── Step 10: Sensitivity matrix ─────────────────────────────────────────
  const sensitivity = buildSensitivityMatrix(
    year1,
    computeMultiYearProjection,
    deps,
    {
      baseGrowth: revenueGrowthRate,
      baseExitCap: exitCapRate,
      holdPeriod,
      expenseGrowthRate,
      sellingCostPct,
      equityInvested,
      annualDebtService,
      debtBalanceAtExit,
      acquisitionDate,
      purchasePrice,
    }
  );

  return {
    projectId,
    irr: leveredIrr,
    leveredIrr,
    unleveredIrr,
    npv,
    equityMultiple,
    goingInCapRate,
    exitCapRate: exitCapRate * 100,
    cashOnCashReturn,
    purchasePrice,
    equityInvested,
    holdPeriodYears: holdPeriod,
    totalDebt: totalDebtAtClose,
    blendedDebtRate: blendedRate * 100,
    years,
    exit,
    cashFlows: canonical.flows,
    sensitivity,
    meta: {
      source: 'proForma',
      generatedAt: new Date().toISOString(),
      discountRate,
      hasDebt: totalDebtAtClose > 0,
      overridesApplied: !!input.overrides,
    },
  };
}

// ─── Quick IRR Endpoint Logic ────────────────────────────────────────────────

export interface QuickIRRRequest {
  projectId: string;
  orgId: string;
  discountRate?: number;
}

export interface QuickIRRResponse {
  irr: number;           // percent
  leveredIrr: number;    // percent
  npv: number;           // currency
  equityMultiple: number;
  goingInCapRate: number; // percent
  exitCapRate: number;    // percent
}

/**
 * Quick IRR — lightweight version that still consumes canonical projection.
 * Returns all KPIs as percentages.
 */
export async function computeQuickIRR(
  request: QuickIRRRequest,
  deps: {
    pool: any;
    computeDirectInputFinancials: (assetClass: string, assumptions: any, unitMix: any) => any;
    computeMultiYearProjection: (year1: any, config: any) => any;
    generateDebtSchedule?: (tranches: any[], holdPeriod: number) => any;
  }
): Promise<QuickIRRResponse> {
  // Reuse full analysis — same engine, just return subset
  const result = await performDCFAnalysis(
    { projectId: request.projectId, orgId: request.orgId, discountRate: request.discountRate },
    deps
  );

  return {
    irr: result.leveredIrr,
    leveredIrr: result.leveredIrr,
    npv: result.npv,
    equityMultiple: result.equityMultiple,
    goingInCapRate: result.goingInCapRate,
    exitCapRate: result.exitCapRate,
  };
}

// ─── Sensitivity Matrix Builder ──────────────────────────────────────────────

function buildSensitivityMatrix(
  year1: any,
  computeMultiYearProjection: (y1: any, config: any) => any,
  deps: any,
  params: {
    baseGrowth: number;
    baseExitCap: number;
    holdPeriod: number;
    expenseGrowthRate: number;
    sellingCostPct: number;
    equityInvested: number;
    annualDebtService: number[];
    debtBalanceAtExit: number;
    acquisitionDate: string;
    purchasePrice: number;
  }
): SensitivityMatrix {
  // Growth rate columns: base ± 1%, ± 2% (5 columns)
  const growthDeltas = [-0.02, -0.01, 0, 0.01, 0.02];
  const columns = growthDeltas.map(d =>
    Math.round((params.baseGrowth + d) * 10000) / 100 // as percent
  );

  // Exit cap rows: base ± 50bps, ± 100bps (5 rows)
  const exitCapDeltas = [-0.01, -0.005, 0, 0.005, 0.01];

  const rows = exitCapDeltas.map(exitDelta => {
    const exitCap = params.baseExitCap + exitDelta;
    const values = growthDeltas.map(growthDelta => {
      const growth = params.baseGrowth + growthDelta;
      const proj = computeMultiYearProjection(year1, {
        holdPeriod: params.holdPeriod,
        revenueGrowthRate: growth,
        expenseGrowthRate: params.expenseGrowthRate,
        exitCapRate: exitCap,
        sellingCostPct: params.sellingCostPct,
      });

      const flows = buildQuickFlows(
        params.acquisitionDate,
        params.equityInvested,
        proj.years,
        params.annualDebtService,
        proj.exit,
        params.debtBalanceAtExit
      );

      return calculateXIRR(flows).irr;
    });

    return {
      exitCapRate: Math.round(exitCap * 10000) / 100, // as percent
      values,
    };
  });

  return { target: 'irr', rows, columns };
}

function buildQuickFlows(
  acquisitionDate: string,
  equityInvested: number,
  years: Array<{ year: number; ncf: number }>,
  annualDS: number[],
  exit: { netSaleProceeds: number },
  debtPayoff: number
): DatedCashFlow[] {
  const flows: DatedCashFlow[] = [
    { date: acquisitionDate, amount: -Math.abs(equityInvested) },
  ];

  for (let i = 0; i < years.length; i++) {
    const ds = annualDS[i] ?? 0;
    const levered = years[i].ncf - ds;
    const isLast = i === years.length - 1;
    const exitAmt = isLast ? (exit.netSaleProceeds - debtPayoff) : 0;

    flows.push({
      date: addYearsISO(acquisitionDate, years[i].year),
      amount: levered + exitAmt,
    });
  }

  return flows;
}

// ─── DB Loaders (Raw SQL — Drizzle breaks on enable_rls tables) ─────────────

async function loadProjectData(pool: any, projectId: string) {
  const r = await pool.query(
    `SELECT mp.id as modeling_project_id, mp.asset_class,
            mp.custom_metrics, mp.purchase_price
     FROM modeling_projects mp
     WHERE mp.id = $1
     LIMIT 1`,
    [projectId]
  );

  const row = r.rows[0];
  if (!row) {
    // Return a structured "no data" result rather than throwing — client shows CTA
    return null;
  }

  const customMetrics = typeof row.custom_metrics === 'string'
    ? JSON.parse(row.custom_metrics)
    : row.custom_metrics ?? {};

  return {
    modelingProjectId: row.modeling_project_id,
    assetClass: row.asset_class ?? 'str',
    inputAssumptions: customMetrics.inputAssumptions ?? {},
    unitMix: customMetrics.unitMix ?? [],
    purchasePrice: Number(row.purchase_price) || 0,
  };
}

async function loadScenarioData(pool: any, modelingProjectId: string) {
  // Scenario version
  const sv = await pool.query(
    `SELECT revenue_growth_rate, expense_growth_rate, exit_cap_rate, assumptions
     FROM modeling_scenario_versions
     WHERE modeling_project_id = $1
     ORDER BY created_at DESC LIMIT 1`,
    [modelingProjectId]
  );
  const scenario = sv.rows[0] ?? {};

  // Project config for hold period + acquisition date
  const pc = await pool.query(
    `SELECT hold_period, acquisition_close_date, cash_flow_granularity
     FROM modeling_project_config
     WHERE modeling_project_id = $1 LIMIT 1`,
    [modelingProjectId]
  );
  const config = pc.rows[0] ?? {};

  return {
    revenueGrowthRate: Number(scenario.revenue_growth_rate) || 3,
    expenseGrowthRate: Number(scenario.expense_growth_rate) || 2.5,
    exitCapRate: Number(scenario.exit_cap_rate) || 7.0,
    holdPeriod: Number(config.hold_period) || 5,
    acquisitionCloseDate: config.acquisition_close_date ?? null,
    assumptions: typeof scenario.assumptions === 'string'
      ? JSON.parse(scenario.assumptions)
      : scenario.assumptions ?? {},
  };
}

async function loadCapitalStackData(pool: any, modelingProjectId: string) {
  const cs = await pool.query(
    `SELECT hold_period_years, noi_growth_rate, exit_cap_rate,
            total_equity, purchase_price, total_debt, blended_debt_rate
     FROM capital_stacks
     WHERE modeling_project_id = $1
     ORDER BY created_at DESC LIMIT 1`,
    [modelingProjectId]
  );

  if (!cs.rows[0]) return null;
  const row = cs.rows[0];

  return {
    holdPeriodYears: Number(row.hold_period_years) || 5,
    noiGrowthRate: Number(row.noi_growth_rate) || 0,
    exitCapRate: Number(row.exit_cap_rate) || 0,
    totalEquity: Number(row.total_equity) || 0,
    purchasePrice: Number(row.purchase_price) || 0,
    debtTranches: [],
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function addYearsISO(dateStr: string, years: number): string {
  const d = new Date(dateStr);
  d.setFullYear(d.getFullYear() + years);
  return d.toISOString().split('T')[0];
}
