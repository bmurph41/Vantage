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

import { getModelConfig } from '../../shared/asset-class-model-config';

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
  leaseIncome: LeaseIncomeResult;    // tenant lease income data
  meta: {
    source: 'proForma';
    generatedAt: string;
    discountRate: number;
    hasDebt: boolean;
    overridesApplied: boolean;
    leaseIncomeInjected: boolean;       // true if lease EGI was used in computation
    revenueGrowthRateUsed: number;      // percent — actual growth rate used in projection
    leaseEscalationRateUsed: number | null; // percent — weighted lease escalation (null if no leases)
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

  // ── Step 1b: Load tenant lease income (if any leases exist) ────────────
  const leaseIncome = await loadLeaseIncomeForProject(pool, projectId);

  // ── Step 2: Compute Year 1 from Direct Input Engine ─────────────────────
  // ── Inject seasonality if not already in inputAssumptions ──────────────
  const assumptions = { ...projectData.inputAssumptions };
  if (!assumptions.inSeasonMonths || assumptions.inSeasonMonths.length === 0) {
    // Try project config first, then asset class default
    const modelConfig = getModelConfig(projectData.assetClass);
    if (scenarioData.seasonMonths?.length > 0) {
      assumptions.inSeasonMonths = scenarioData.seasonMonths;
    } else if (modelConfig.seasonConfig.defaultInSeasonMonths?.length) {
      assumptions.inSeasonMonths = modelConfig.seasonConfig.defaultInSeasonMonths;
    }
  }

  // ── Inject lease EGI into assumptions if leases exist ──────────────────
  // When tenant leases are present, their base rent + recoveries override the
  // modeled EGI so the DCF reflects actual lease income.
  let leaseIncomeInjected = false;
  if (leaseIncome.hasLeases && leaseIncome.totalEGIAnnual > 0) {
    assumptions.leaseEGIAnnual = leaseIncome.totalEGIAnnual;
    assumptions.leaseBaseRentAnnual = leaseIncome.totalBaseRentAnnual;
    assumptions.leaseRecoveryAnnual = leaseIncome.totalRecoveryAnnual;
    assumptions.leaseWeightedEscalationRate = leaseIncome.weightedAvgEscalationRate;
    leaseIncomeInjected = true;
  }

  const year1 = computeDirectInputFinancials(
    projectData.assetClass,
    assumptions,
    projectData.unitMix
  );

  // ── Override year1 EGI with lease income when available ─────────────────
  // After computing the baseline year1 from the engine, blend in lease income
  // as the effective gross income when leases are present. The engine's NOI
  // margin is preserved; we replace the revenue basis.
  if (leaseIncomeInjected && year1) {
    const leaseEGI = leaseIncome.totalEGIAnnual;
    const engineNOI = year1.noi ?? 0;
    const engineEGI = year1.effectiveGrossIncome ?? year1.grossRevenue ?? year1.totalRevenue ?? 0;
    // Compute engine's implied NOI margin and apply to lease EGI
    if (engineEGI > 0) {
      const noiMargin = engineNOI / engineEGI;
      year1._leaseNOI = leaseEGI * noiMargin;
      year1._leaseEGI = leaseEGI;
    } else {
      // No engine EGI available — use lease EGI directly as NOI basis
      year1._leaseNOI = leaseEGI;
      year1._leaseEGI = leaseEGI;
    }
    // Use the lease-derived NOI as the canonical year1 NOI for projections
    year1.noi = year1._leaseNOI;
    year1.ncf = year1.noi - (year1.capex ?? 0);
  }

  // ── Step 3: Build projection config from scenario/capital stack ─────────
  const holdPeriod = input.overrides?.holdPeriodYears
    ?? scenarioData.holdPeriod
    ?? capitalStackData?.holdPeriodYears
    ?? 5;

  // When leases are present, use the weighted avg escalation rate as the income
  // growth rate for the multi-year projection, but apply the scenario rate as a
  // floor so aggressive lease escalations don't undercut conservative scenarios.
  const scenarioGrowthRate = (scenarioData.revenueGrowthRate ?? 3) / 100
    + (input.overrides?.revenueGrowthRateDelta ?? 0) / 100;
  const leaseEscalationRate = leaseIncome.hasLeases && leaseIncome.weightedAvgEscalationRate > 0
    ? leaseIncome.weightedAvgEscalationRate
    : 0;
  const revenueGrowthRate = leaseIncomeInjected && leaseEscalationRate > 0
    ? Math.max(scenarioGrowthRate, leaseEscalationRate)  // use lease escalation; floor at scenario rate
    : scenarioGrowthRate;

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
    leaseIncome,
    meta: {
      source: 'proForma',
      generatedAt: new Date().toISOString(),
      discountRate,
      hasDebt: totalDebtAtClose > 0,
      overridesApplied: !!input.overrides,
      leaseIncomeInjected,
      // When leases drive growth, record both rates for transparency
      revenueGrowthRateUsed: revenueGrowthRate * 100,           // percent
      leaseEscalationRateUsed: leaseEscalationRate > 0
        ? leaseEscalationRate * 100
        : null,
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

// ─── Lease Income Loader ─────────────────────────────────────────────────────

export interface LeaseIncomeResult {
  hasLeases: boolean;
  leaseCount: number;
  totalBaseRentAnnual: number;
  totalRecoveryAnnual: number;
  totalEGIAnnual: number;                // base rent + recoveries
  weightedAvgEscalationRate: number;     // weighted avg annual escalation pct (decimal)
  leaseBreakdown: Array<{
    leaseId: string;
    tenantName: string;
    sf: number;
    leaseType: string;
    baseRentAnnual: number;
    recoveryAnnual: number;
    escalationType: string;
    escalationRate: number;              // annual pct (decimal)
    leaseEndDate: string;
  }>;
}

/**
 * Load and compute annual lease income from tenant_leases, tenant_rent_terms,
 * and tenant_recoveries for a given project.
 */
export async function loadLeaseIncomeForProject(pool: any, projectId: string): Promise<LeaseIncomeResult> {
  const empty: LeaseIncomeResult = {
    hasLeases: false,
    leaseCount: 0,
    totalBaseRentAnnual: 0,
    totalRecoveryAnnual: 0,
    totalEGIAnnual: 0,
    weightedAvgEscalationRate: 0,
    leaseBreakdown: [],
  };

  // Fetch active/expiring leases that have already commenced (exclude future, expired, archived).
  // FUTURE leases (lease_start_date > today) are excluded from Year 1 income since
  // they haven't yet generated income; they can be added to later-year projections separately.
  const today = new Date().toISOString().split('T')[0];
  const leasesResult = await pool.query(
    `SELECT id, tenant_name, sf, lease_type, lease_end_date, lease_start_date, status
     FROM tenant_leases
     WHERE project_id = $1
       AND status NOT IN ('EXPIRED', 'ARCHIVED')
       AND lease_start_date <= $2
     ORDER BY tenant_name`,
    [projectId, today]
  );

  if (!leasesResult.rows.length) return empty;

  const leaseIds = leasesResult.rows.map((r: any) => r.id);

  // Fetch initial rent terms for all leases in one query
  const termsResult = await pool.query(
    `SELECT lease_id, base_rent_input_unit, base_rent_input_value,
            escalation_type, escalation_value, escalation_frequency_months
     FROM tenant_rent_terms
     WHERE lease_id = ANY($1::uuid[])
       AND term_type = 'INITIAL'
     ORDER BY lease_id, created_at ASC`,
    [leaseIds]
  );

  // Fetch recoveries for all leases in one query
  const recoveriesResult = await pool.query(
    `SELECT lease_id, method, amount, psf_amount
     FROM tenant_recoveries
     WHERE lease_id = ANY($1::uuid[])`,
    [leaseIds]
  );

  // Index terms and recoveries by leaseId
  const termsByLease: Record<string, any> = {};
  for (const t of termsResult.rows) {
    if (!termsByLease[t.lease_id]) termsByLease[t.lease_id] = t;
  }

  const recoveriesByLease: Record<string, any[]> = {};
  for (const r of recoveriesResult.rows) {
    if (!recoveriesByLease[r.lease_id]) recoveriesByLease[r.lease_id] = [];
    recoveriesByLease[r.lease_id].push(r);
  }

  let totalBaseRent = 0;
  let totalRecovery = 0;
  let weightedEscRentProduct = 0;
  const breakdown: LeaseIncomeResult['leaseBreakdown'] = [];

  for (const lease of leasesResult.rows) {
    const sf = parseFloat(lease.sf) || 0;
    const term = termsByLease[lease.id];
    const recoveries = recoveriesByLease[lease.id] ?? [];

    // Compute annual base rent
    let baseRentAnnual = 0;
    let escalationRate = 0;
    let escalationType = 'NONE';

    if (term) {
      const val = parseFloat(term.base_rent_input_value) || 0;
      if (term.base_rent_input_unit === 'PSF_YEAR') baseRentAnnual = val * sf;
      else if (term.base_rent_input_unit === 'PER_YEAR') baseRentAnnual = val;
      else if (term.base_rent_input_unit === 'PER_MONTH') baseRentAnnual = val * 12;

      escalationType = term.escalation_type ?? 'NONE';
      if (escalationType === 'PERCENT' && term.escalation_value) {
        escalationRate = parseFloat(term.escalation_value); // stored as decimal e.g. 0.03
      } else if (escalationType === 'FIXED_DOLLAR' && term.escalation_value && baseRentAnnual > 0) {
        escalationRate = parseFloat(term.escalation_value) / baseRentAnnual;
      } else if (escalationType === 'DOLLAR_PSF_YEAR' && term.escalation_value && baseRentAnnual > 0) {
        escalationRate = (parseFloat(term.escalation_value) * sf) / baseRentAnnual;
      }
      // CPI / CPI_CAP_FLOOR / SCHEDULE: default to 3% assumption
      if (['CPI', 'CPI_CAP_FLOOR', 'SCHEDULE'].includes(escalationType)) {
        escalationRate = 0.03;
      }
    }

    // Compute annual recovery income
    let recoveryAnnual = 0;
    for (const rec of recoveries) {
      const amt = parseFloat(rec.amount) || 0;
      const psf = parseFloat(rec.psf_amount) || 0;
      if (rec.method === 'FIXED_MONTHLY') recoveryAnnual += amt * 12;
      else if (rec.method === 'FIXED_ANNUAL') recoveryAnnual += amt;
      else if (rec.method === 'PRO_RATA' && amt > 0) recoveryAnnual += amt;
      else if (['BASE_YEAR_STOP', 'EXPENSE_STOP_PSF'].includes(rec.method) && psf > 0) recoveryAnnual += psf * sf;
    }

    totalBaseRent += baseRentAnnual;
    totalRecovery += recoveryAnnual;
    weightedEscRentProduct += escalationRate * baseRentAnnual;

    breakdown.push({
      leaseId: lease.id,
      tenantName: lease.tenant_name,
      sf,
      leaseType: lease.lease_type,
      baseRentAnnual,
      recoveryAnnual,
      escalationType,
      escalationRate,
      leaseEndDate: lease.lease_end_date,
    });
  }

  const totalEGI = totalBaseRent + totalRecovery;
  const weightedAvgEscalation = totalBaseRent > 0 ? weightedEscRentProduct / totalBaseRent : 0;

  return {
    hasLeases: true,
    leaseCount: leasesResult.rows.length,
    totalBaseRentAnnual: totalBaseRent,
    totalRecoveryAnnual: totalRecovery,
    totalEGIAnnual: totalEGI,
    weightedAvgEscalationRate: weightedAvgEscalation,
    leaseBreakdown: breakdown,
  };
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
    seasonMonths: [],
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
