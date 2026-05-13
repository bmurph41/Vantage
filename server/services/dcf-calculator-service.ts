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
  leaseIncome: LeaseIncomeResult;            // tenant lease income data (year 1 summary)
  yearlyLeaseIncome: LeaseYearIncome[];      // per-year lease EGI with per-tenant escalation detail
  meta: {
    source: 'proForma';
    generatedAt: string;
    discountRate: number;
    hasDebt: boolean;
    overridesApplied: boolean;
    leaseIncomeInjected: boolean;       // true if lease EGI was used in computation
    useLeaseIncomeForDcf: boolean | null; // stored flag: null=auto, true=opt-in, false=opt-out
    revenueGrowthRateUsed: number;      // percent — actual growth rate used in projection
    leaseEscalationRateUsed: number | null; // percent — weighted lease escalation (null if no leases)
    acquisitionDate: string;            // ISO date — start of hold period
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
  // Pass the scenario-level CPI rate so CPI/CPI_CAP_FLOOR leases use a
  // configurable assumption instead of the hardcoded 3% default.
  // Scenario assumptions may supply `cpiRate` explicitly; if absent we fall
  // back to 3% (the field is optional — null means "use default").
  const scenarioCpiRate: number | undefined =
    typeof scenarioData.assumptions?.cpiRate === 'number'
      ? scenarioData.assumptions.cpiRate
      : undefined;
  const scenarioCpiCap: number | undefined =
    typeof scenarioData.assumptions?.cpiCap === 'number'
      ? scenarioData.assumptions.cpiCap
      : undefined;
  const scenarioCpiFloor: number | undefined =
    typeof scenarioData.assumptions?.cpiFloor === 'number'
      ? scenarioData.assumptions.cpiFloor
      : undefined;
  const leaseIncome = await loadLeaseIncomeForProject(pool, projectId, {
    cpiRate: scenarioCpiRate,
    cpiCap: scenarioCpiCap,
    cpiFloor: scenarioCpiFloor,
  });

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

  // ── Inject lease EGI into assumptions if leases exist (Year 1 basis only) ─
  // When tenant leases are present, their Year 1 base rent + recoveries are
  // passed as hints to the direct input engine so it can contextualize the
  // revenue model. Per-year compounding is handled by computeLeaseIncomeByYear.
  //
  // The useLeaseIncomeForDcf flag controls this behavior:
  //   null  = unset (no explicit choice — do NOT inject, user must opt-in)
  //   true  = user explicitly opted in  → inject lease income
  //   false = user explicitly opted out → skip injection
  const leaseFlag = scenarioData.useLeaseIncomeForDcf;
  const leaseAllowed = leaseFlag === true; // explicit opt-in required
  let leaseIncomeInjected = false;
  if (leaseIncome.hasLeases && leaseIncome.totalEGIAnnual > 0 && leaseAllowed) {
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

  // ── Step 3: Build projection config from scenario/capital stack ─────────
  const holdPeriod = input.overrides?.holdPeriodYears
    ?? scenarioData.holdPeriod
    ?? capitalStackData?.holdPeriodYears
    ?? 5;

  const scenarioGrowthRate = (scenarioData.revenueGrowthRate ?? 3) / 100
    + (input.overrides?.revenueGrowthRateDelta ?? 0) / 100;
  const leaseEscalationRate = leaseIncome.hasLeases && leaseIncome.weightedAvgEscalationRate > 0
    ? leaseIncome.weightedAvgEscalationRate
    : 0;
  // Revenue growth rate is still needed for sensitivity matrix and fallback
  const revenueGrowthRate = leaseIncomeInjected && leaseEscalationRate > 0
    ? Math.max(scenarioGrowthRate, leaseEscalationRate)
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

  // ── Step 3b: Compute per-year NOI overrides from lease escalation schedules ─
  // When leases are present, derive year-by-year NOI for each hold year by
  // applying each tenant's individual escalation rate, free-rent concessions,
  // and lease expiry. This replaces the single weighted-average growth approach.
  let noiOverrides: number[] | undefined;
  let yearlyLeaseIncome: ReturnType<typeof computeLeaseIncomeByYear> = [];

  if (leaseIncomeInjected && year1) {
    const acquisitionDate = scenarioData.acquisitionCloseDate
      ?? new Date().toISOString().split('T')[0];

    // Read rollover vacancy settings from scenario assumptions (stored in jsonb)
    const rolloverVacancyMonths =
      typeof scenarioData.assumptions?.rolloverVacancyMonths === 'number'
        ? scenarioData.assumptions.rolloverVacancyMonths
        : 0;
    const rolloverTiLcPerSf =
      typeof scenarioData.assumptions?.rolloverTiLcPerSf === 'number'
        ? scenarioData.assumptions.rolloverTiLcPerSf
        : 0;

    // Compute per-year lease EGI with per-tenant escalation schedules and rollover vacancy
    yearlyLeaseIncome = computeLeaseIncomeByYear(
      leaseIncome.leaseBreakdown,
      holdPeriod,
      acquisitionDate,
      { rolloverVacancyMonths, rolloverTiLcPerSf }
    );

    // Derive NOI from EGI using the engine's implied NOI margin
    const engineEGI = year1.effectiveGrossIncome ?? year1.grossRevenue ?? year1.totalRevenue ?? 0;
    const engineNOI = year1.noi ?? 0;
    const noiMargin = engineEGI > 0 ? engineNOI / engineEGI : 1;

    // Build the overrides array (index 0 = Year 1, index N-1 = Year N)
    noiOverrides = yearlyLeaseIncome.map(yli => Math.round(yli.egiAnnual * noiMargin));
  }

  // ── Step 4: Generate Multi-Year Projection (CANONICAL SOURCE) ───────────
  const projection = computeMultiYearProjection(year1, {
    holdPeriod,
    revenueGrowthRate,
    expenseGrowthRate,
    exitCapRate,
    sellingCostPct,
    noiOverrides,
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
      noiOverrides,
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
    yearlyLeaseIncome,
    meta: {
      source: 'proForma',
      generatedAt: new Date().toISOString(),
      discountRate,
      hasDebt: totalDebtAtClose > 0,
      overridesApplied: !!input.overrides,
      leaseIncomeInjected,
      useLeaseIncomeForDcf: scenarioData.useLeaseIncomeForDcf,
      // When leases drive growth, record both rates for transparency
      revenueGrowthRateUsed: revenueGrowthRate * 100,           // percent
      leaseEscalationRateUsed: leaseEscalationRate > 0
        ? leaseEscalationRate * 100
        : null,
      acquisitionDate,
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
    /** Per-year NOI overrides from lease escalation schedules — threaded through so
     *  sensitivity IRR values remain consistent with the main DCF projection. */
    noiOverrides?: number[];
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
        // Pass lease NOI overrides so sensitivity correctly reflects contractual income
        noiOverrides: params.noiOverrides,
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

/** One row in a SCHEDULE-type step rent plan */
export interface RentStepEntry {
  effectiveDate: string;   // ISO date string — when this rent level takes effect
  value: number;           // absolute rent amount (not an increment)
  unit: 'PSF_YEAR' | 'PER_YEAR' | 'PER_MONTH' | string;
  notes?: string;
}

/**
 * Return true if the raw object looks like a valid RentStepEntry so callers
 * can skip malformed rows without throwing.
 */
function isValidRentStepEntry(entry: unknown): entry is RentStepEntry {
  if (!entry || typeof entry !== 'object') return false;
  const e = entry as Record<string, unknown>;
  return (
    typeof e.effectiveDate === 'string' &&
    e.effectiveDate.length > 0 &&
    !isNaN(new Date(e.effectiveDate).getTime()) &&
    typeof e.value === 'number' &&
    isFinite(e.value) &&
    typeof e.unit === 'string' &&
    e.unit.length > 0
  );
}

/**
 * Find the last step in a pre-sorted (ascending effectiveDate) schedule whose
 * effectiveDate is on or before `atDate`. Returns null if none has taken effect.
 */
export function findActiveRentStep(
  schedule: RentStepEntry[],
  atDate: Date
): RentStepEntry | null {
  let active: RentStepEntry | null = null;
  for (const step of schedule) {
    if (new Date(step.effectiveDate) <= atDate) {
      active = step;
    } else {
      break; // sorted ascending — no need to look further
    }
  }
  return active;
}

/**
 * Convert a RentStepEntry's absolute rent value to an annual dollar amount.
 * @param step   The active schedule step
 * @param sf     Leasable square footage (used when unit is PSF_YEAR)
 */
export function convertRentStepToAnnual(step: RentStepEntry, sf: number): number {
  if (step.unit === 'PSF_YEAR') return step.value * sf;
  if (step.unit === 'PER_YEAR') return step.value;
  if (step.unit === 'PER_MONTH') return step.value * 12;
  return step.value; // unknown unit — treat as annual
}

export interface LeaseBreakdownEntry {
  leaseId: string;
  tenantName: string;
  sf: number;
  leaseType: string;
  baseRentAnnual: number;
  recoveryAnnual: number;
  escalationType: string;
  escalationRate: number;              // annual pct (decimal); ignored for SCHEDULE type
  /**
   * For CPI_CAP_FLOOR leases only: the raw scenario CPI rate before cap/floor clamping is applied.
   * Allows UI to display "Nominal X.X% → Capped/Floored at Y.Y%".
   * Undefined for all other escalation types.
   */
  nominalCpiRate?: number;
  /** For CPI_CAP_FLOOR leases only: the configured cap ceiling (decimal, e.g. 0.04 = 4%). */
  capValue?: number;
  /** For CPI_CAP_FLOOR leases only: the configured floor minimum (decimal, e.g. 0.02 = 2%). */
  floorValue?: number;
  leaseEndDate: string;
  /** ISO date string when the lease starts (used to anchor free-rent timing relative to acquisition) */
  leaseStartDate: string | null;
  /** ISO date string when the lease commences rent (after any free-rent period) */
  rentCommencementDate: string | null;
  /** Number of free-rent months at start of lease (derived from lease_start_date vs rent_commencement_date) */
  freeRentMonths: number;
  /**
   * Step schedule for SCHEDULE-type leases. Each entry describes the absolute
   * rent level starting on effectiveDate. Entries should be sorted ascending.
   * When present and escalationType === 'SCHEDULE', computeLeaseIncomeByYear
   * uses this instead of the compounding escalationRate.
   */
  scheduleJson?: RentStepEntry[] | null;
  /** True when lease_start_date is after today — lease has not yet commenced as of the load date */
  isFuture?: boolean;
}

export interface LeaseIncomeResult {
  hasLeases: boolean;
  leaseCount: number;
  totalBaseRentAnnual: number;
  totalRecoveryAnnual: number;
  totalEGIAnnual: number;                // base rent + recoveries (in-place only — same as inPlaceEGIAnnual)
  /** EGI from currently-active leases only (lease_start_date <= today) */
  inPlaceEGIAnnual: number;
  /** EGI from current + pre-leased (future) leases — "stabilized" figure for underwriting */
  stabilizedEGIAnnual: number;
  weightedAvgEscalationRate: number;     // weighted avg annual escalation pct (decimal)
  leaseBreakdown: LeaseBreakdownEntry[];
}

// ─── Per-Year Lease Income ────────────────────────────────────────────────────

export interface LeaseYearIncome {
  /** 1-based year number */
  year: number;
  /** Aggregate base rent for this year across all active leases, after escalation */
  baseRentAnnual: number;
  /** Aggregate recovery income for this year across all active leases */
  recoveryAnnual: number;
  /** Total EGI = baseRentAnnual + recoveryAnnual - vacancyDeductions - tiLcCosts */
  egiAnnual: number;
  /** Total rollover vacancy deductions across all leases this year */
  vacancyDeductionTotal: number;
  /** Total TI/LC costs across all leases this year */
  tiLcCostTotal: number;
  /** Per-lease detail for transparency */
  leaseDetail: Array<{
    leaseId: string;
    tenantName: string;
    baseRent: number;
    recovery: number;
    isExpired: boolean;
    freeRentReduction: number;
    /** Lost rent during rollover vacancy period (months after lease expiry within this year) */
    vacancyDeduction: number;
    /** One-time TI/LC re-leasing cost charged in the first year of vacancy */
    tiLcCost: number;
    /** Escalation type for this lease (e.g. 'SCHEDULE', 'PERCENT', 'NONE') */
    escalationType: string;
    /** For SCHEDULE leases: the annualized rent from the active step at the start of this year.
     *  Null/undefined for non-SCHEDULE leases. */
    activeStepRentAnnual?: number | null;
    /** True when the lease's start date is in the future (as of the data load date) */
    isFuture?: boolean;
    /** ISO date string for when the lease commences — used to display pre-commencement tooltips */
    leaseStartDate?: string | null;
    /** True when the lease has not yet started in this specific projection year (income is $0 pre-commencement) */
    notYetStarted?: boolean;
    /** Escalation rate for this lease (decimal e.g. 0.035 = 3.5%) — populated for CPI and CPI_CAP_FLOOR types */
    escalationRate?: number;
    /** For CPI_CAP_FLOOR leases only: configured cap ceiling (decimal, e.g. 0.04 = 4%) */
    capValue?: number;
    /** For CPI_CAP_FLOOR leases only: configured floor minimum (decimal, e.g. 0.02 = 2%) */
    floorValue?: number;
  }>;
}

/**
 * Compute per-lease EGI for each hold year, applying individual escalation
 * rates, free-rent concessions, lease expiry, and optional rollover vacancy.
 *
 * @param leaseBreakdown      Output from loadLeaseIncomeForProject().leaseBreakdown
 * @param holdPeriod          Number of projection years (1-based)
 * @param acquisitionDate     ISO date string for year 1 start (defaults to today)
 * @param options.rolloverVacancyMonths  Months of vacancy assumed after each mid-hold expiry (default 0)
 * @param options.rolloverTiLcPerSf      One-time TI/LC cost per SF charged in the first vacancy year (default 0)
 */
export function computeLeaseIncomeByYear(
  leaseBreakdown: LeaseBreakdownEntry[],
  holdPeriod: number,
  acquisitionDate?: string,
  options?: {
    rolloverVacancyMonths?: number;
    rolloverTiLcPerSf?: number;
  }
): LeaseYearIncome[] {
  const refDate = acquisitionDate ? new Date(acquisitionDate) : new Date();
  const MS_PER_DAY = 1000 * 60 * 60 * 24;
  const DAYS_PER_YEAR = 365.25;

  const rolloverVacancyMonths = options?.rolloverVacancyMonths ?? 0;
  const rolloverTiLcPerSf = options?.rolloverTiLcPerSf ?? 0;

  // Hold period end date — leases expiring AFTER this have no mid-hold effect
  const holdEnd = new Date(refDate);
  holdEnd.setFullYear(holdEnd.getFullYear() + holdPeriod);

  // Helper: compute the escalated monthly rent for a given lease at a specific date
  // (mirrors the month-by-month logic in the main loop below)
  const getEscalatedMonthlyRent = (
    lease: LeaseBreakdownEntry,
    atDate: Date,
    commencementDate: Date | null
  ): number => {
    let rate = lease.baseRentAnnual / 12;
    if (
      lease.escalationType === 'SCHEDULE' &&
      lease.scheduleJson &&
      lease.scheduleJson.length > 0
    ) {
      const activeStep = findActiveRentStep(lease.scheduleJson, atDate);
      if (activeStep) {
        rate = convertRentStepToAnnual(activeStep, lease.sf) / 12;
      }
    } else if (commencementDate && lease.escalationRate > 0) {
      const msElapsed = atDate.getTime() - commencementDate.getTime();
      const leaseYearsElapsed = Math.max(0, Math.floor(msElapsed / (MS_PER_DAY * DAYS_PER_YEAR)));
      rate = (lease.baseRentAnnual / 12) * Math.pow(1 + lease.escalationRate, leaseYearsElapsed);
    }
    return rate;
  };

  const results: LeaseYearIncome[] = [];

  for (let yr = 1; yr <= holdPeriod; yr++) {
    // Year `yr` occupies [refDate + (yr-1) years, refDate + yr years)
    const yearStart = new Date(refDate);
    yearStart.setFullYear(yearStart.getFullYear() + (yr - 1));
    const yearEnd = new Date(refDate);
    yearEnd.setFullYear(yearEnd.getFullYear() + yr);

    let totalBaseRent = 0;
    let totalRecovery = 0;
    let totalVacancyDeduction = 0;
    let totalTiLcCost = 0;
    const leaseDetail: LeaseYearIncome['leaseDetail'] = [];

    for (const lease of leaseBreakdown) {
      const leaseStartDate = lease.leaseStartDate ? new Date(lease.leaseStartDate) : null;
      const leaseEndDate = lease.leaseEndDate ? new Date(lease.leaseEndDate) : null;

      // Rent commencement date determines when free-rent ends and when escalation begins.
      // If not set, fall back to lease start date.
      const commencementDate = lease.rentCommencementDate
        ? new Date(lease.rentCommencementDate)
        : leaseStartDate;

      // Whether the lease was already fully expired before this year started
      const isExpiredBeforeYear = leaseEndDate !== null && leaseEndDate <= yearStart;
      // Whether the lease hasn't started yet for this year
      const notYetStarted = leaseStartDate !== null && leaseStartDate >= yearEnd;

      // ── Part 1: Lease income computation ──────────────────────────────────
      // Expired/not-yet-started leases yield $0 income for this year.
      // Active and mid-year-expiring leases get the month-by-month calculation.

      let netBaseRent = 0;
      let freeRentReduction = 0;
      let escalatedRecovery = 0;

      if (!isExpiredBeforeYear && !notYetStarted) {
        // ── Month-by-month computation ────────────────────────────────────────
        // Process each of the 12 calendar months within this projection year.
        // For each month we determine:
        //   1. Is the lease active? (between leaseStart and leaseEnd)
        //   2. Is rent due? (on or after commencementDate — free-rent has ended)
        //   3. What escalation factor applies? (based on completed lease anniversaries
        //      since commencementDate, not since acquisition date)
        //
        // This unified timeline ensures free-rent, active window, and escalation are
        // never double-applied or double-counted.

        let grossBaseRentIfNoFreeRent = 0; // for computing freeRentReduction as a delta

        for (let m = 0; m < 12; m++) {
          // Month boundaries within this projection year (calendar month offset from yearStart)
          const monthStart = new Date(yearStart);
          monthStart.setMonth(yearStart.getMonth() + m);
          const monthEnd = new Date(yearStart);
          monthEnd.setMonth(yearStart.getMonth() + m + 1);

          // Lease not yet started this month
          if (leaseStartDate && leaseStartDate >= monthEnd) continue;
          // Lease already expired this month
          if (leaseEndDate && leaseEndDate <= monthStart) continue;

          // Effective active window within this month (handles partial first/last months)
          const effectiveStart = leaseStartDate && leaseStartDate > monthStart
            ? leaseStartDate : monthStart;
          const effectiveEnd = leaseEndDate && leaseEndDate < monthEnd
            ? leaseEndDate : monthEnd;
          const monthMs = monthEnd.getTime() - monthStart.getTime();
          const activeFraction = monthMs > 0
            ? Math.max(0, (effectiveEnd.getTime() - effectiveStart.getTime()) / monthMs)
            : 1.0;
          if (activeFraction <= 0) continue;

          // Escalation: compute the rent applicable in this month.
          //
          // For SCHEDULE leases: find the last step entry whose effectiveDate is
          // on or before monthStart; convert its absolute value+unit to a monthly
          // figure. If no step has kicked in yet, use baseRentAnnual / 12.
          //
          // For all other types: compound the escalationRate by the number of
          // full lease years elapsed since commencementDate.
          let escalatedMonthlyRent = lease.baseRentAnnual / 12;

          if (
            lease.escalationType === 'SCHEDULE' &&
            lease.scheduleJson &&
            lease.scheduleJson.length > 0
          ) {
            const activeStep = findActiveRentStep(lease.scheduleJson, monthStart);
            if (activeStep) {
              escalatedMonthlyRent = convertRentStepToAnnual(activeStep, lease.sf) / 12;
            }
            // If no step has taken effect yet, remain at baseRentAnnual / 12 (set above)
          } else if (commencementDate && lease.escalationRate > 0) {
            const msFromCommencementToMonthStart = monthStart.getTime() - commencementDate.getTime();
            const leaseYearsElapsed = Math.max(
              0,
              Math.floor(msFromCommencementToMonthStart / (MS_PER_DAY * DAYS_PER_YEAR))
            );
            escalatedMonthlyRent = (lease.baseRentAnnual / 12) *
              Math.pow(1 + lease.escalationRate, leaseYearsElapsed);
          }

          // What the month would earn without any free-rent (for computing freeRentReduction)
          grossBaseRentIfNoFreeRent += escalatedMonthlyRent * activeFraction;

          // Free-rent: month is rent-free if rent has not yet commenced
          const isFreePeriod = commencementDate !== null && monthStart < commencementDate;
          if (isFreePeriod) continue; // no rent this month

          netBaseRent += escalatedMonthlyRent * activeFraction;
        }

        freeRentReduction = Math.max(0, grossBaseRentIfNoFreeRent - netBaseRent);

        // Recovery income: annual × active fraction of the full year, growing at 2.5%/year
        // (consistent with the prior /lease-income route). No free-rent applies to recoveries.
        const yearMs = yearEnd.getTime() - yearStart.getTime();
        const fullYearActiveFraction = yearMs > 0 ? Math.max(0, Math.min(1,
          (Math.min(leaseEndDate?.getTime() ?? yearEnd.getTime(), yearEnd.getTime()) -
           Math.max(leaseStartDate?.getTime() ?? yearStart.getTime(), yearStart.getTime()))
          / yearMs
        )) : 1.0;
        escalatedRecovery = lease.recoveryAnnual * Math.pow(1.025, yr - 1) * fullYearActiveFraction;
      }

      // ── Part 2: Rollover vacancy computation ──────────────────────────────
      // Runs for EVERY lease in EVERY year — not just expired ones.
      // A lease "expires mid-hold" if leaseEndDate falls after the acquisition
      // date and before the hold period end date.
      //
      // The vacancy window is [leaseEndDate, leaseEndDate + rolloverVacancyMonths).
      // For any projection year that overlaps the vacancy window, we deduct the
      // equivalent monthly rent (at the escalated rate as of the expiry date).
      // The TI/LC one-time cost is charged in the single year where the lease expires.

      let vacancyDeduction = 0;
      let tiLcCost = 0;

      // Both vacancy and TI/LC apply only to leases that expire mid-hold
      // (after acquisition date, before hold period end).
      const qualifiesForRollover =
        leaseEndDate !== null &&
        leaseEndDate > refDate &&  // expires after acquisition
        leaseEndDate < holdEnd;    // expires before end of hold period

      // ── Vacancy deduction ────────────────────────────────────────────────────
      // Gated separately on rolloverVacancyMonths > 0.
      // Uses exact day-based proration so exactly N months of rent is lost in
      // total, spread across projection years proportionally.
      if (qualifiesForRollover && rolloverVacancyMonths > 0) {
        const vacancyStart = new Date(leaseEndDate!);
        const vacancyEnd = new Date(leaseEndDate!);
        vacancyEnd.setMonth(vacancyEnd.getMonth() + rolloverVacancyMonths);

        const totalVacancyMs = vacancyEnd.getTime() - vacancyStart.getTime();
        const overlapStartMs = Math.max(vacancyStart.getTime(), yearStart.getTime());
        const overlapEndMs   = Math.min(vacancyEnd.getTime(),   yearEnd.getTime());

        if (overlapEndMs > overlapStartMs && totalVacancyMs > 0) {
          const overlapFraction = (overlapEndMs - overlapStartMs) / totalVacancyMs;
          const monthlyRentAtExpiry = getEscalatedMonthlyRent(
            lease,
            vacancyStart,
            commencementDate
          );
          vacancyDeduction = overlapFraction * rolloverVacancyMonths * monthlyRentAtExpiry;
        }
      }

      // ── TI/LC cost ───────────────────────────────────────────────────────────
      // Gated separately on rolloverTiLcPerSf > 0 — independent of vacancy months.
      // One-time charge in the single year the lease expires.
      if (qualifiesForRollover && rolloverTiLcPerSf > 0 && lease.sf > 0) {
        const leaseExpiresInThisYear =
          leaseEndDate! >= yearStart && leaseEndDate! < yearEnd;
        if (leaseExpiresInThisYear) {
          tiLcCost = rolloverTiLcPerSf * lease.sf;
        }
      }

      totalBaseRent += netBaseRent;
      totalRecovery += escalatedRecovery;
      totalVacancyDeduction += vacancyDeduction;
      totalTiLcCost += tiLcCost;

      // For SCHEDULE leases: determine which step is active at the start of this year
      // so the UI can display "effective step rent" per year.
      // Only set this when the lease is actually earning rent this year (not expired
      // before the year and not yet to start).
      let activeStepRentAnnual: number | null = null;
      if (
        !isExpiredBeforeYear &&
        !notYetStarted &&
        lease.escalationType === 'SCHEDULE' &&
        lease.scheduleJson &&
        lease.scheduleJson.length > 0
      ) {
        const activeStep = findActiveRentStep(lease.scheduleJson, yearStart);
        if (activeStep) {
          activeStepRentAnnual = Math.round(convertRentStepToAnnual(activeStep, lease.sf));
        } else {
          // No step has taken effect yet — use base rent
          activeStepRentAnnual = Math.round(lease.baseRentAnnual);
        }
      }

      leaseDetail.push({
        leaseId: lease.leaseId,
        tenantName: lease.tenantName,
        baseRent: Math.round(netBaseRent),
        recovery: Math.round(escalatedRecovery),
        isExpired: isExpiredBeforeYear,
        freeRentReduction: Math.round(freeRentReduction),
        vacancyDeduction: Math.round(vacancyDeduction),
        tiLcCost: Math.round(tiLcCost),
        escalationType: lease.escalationType,
        escalationRate: lease.escalationRate,
        capValue: lease.capValue,
        floorValue: lease.floorValue,
        activeStepRentAnnual,
        isFuture: lease.isFuture ?? false,
        leaseStartDate: lease.leaseStartDate,
        notYetStarted,
      });
    }

    const netEGI = totalBaseRent + totalRecovery - totalVacancyDeduction - totalTiLcCost;

    results.push({
      year: yr,
      baseRentAnnual: Math.round(totalBaseRent),
      recoveryAnnual: Math.round(totalRecovery),
      egiAnnual: Math.round(netEGI),
      vacancyDeductionTotal: Math.round(totalVacancyDeduction),
      tiLcCostTotal: Math.round(totalTiLcCost),
      leaseDetail,
    });
  }

  return results;
}

/**
 * Load and compute annual lease income from tenant_leases, tenant_rent_terms,
 * and tenant_recoveries for a given project.
 */
export async function loadLeaseIncomeForProject(
  pool: any,
  projectId: string,
  options?: { cpiRate?: number; cpiCap?: number; cpiFloor?: number }
): Promise<LeaseIncomeResult> {
  const cpiRate = options?.cpiRate ?? 0.03;
  const cpiCap = options?.cpiCap;
  const cpiFloor = options?.cpiFloor;
  const empty: LeaseIncomeResult = {
    hasLeases: false,
    leaseCount: 0,
    totalBaseRentAnnual: 0,
    totalRecoveryAnnual: 0,
    totalEGIAnnual: 0,
    inPlaceEGIAnnual: 0,
    stabilizedEGIAnnual: 0,
    weightedAvgEscalationRate: 0,
    leaseBreakdown: [],
  };

  // Fetch all active/future leases (exclude only expired and archived).
  // Future leases (lease_start_date > today) are included so that computeLeaseIncomeByYear
  // can activate them in the first projection year that overlaps their start date.
  // Year 1 aggregate totals (used for EGI injection into assumptions) will still
  // exclude future leases so Year 1 income is not overstated.
  const today = new Date().toISOString().split('T')[0];
  const leasesResult = await pool.query(
    `SELECT id, tenant_name, sf, lease_type, lease_end_date, lease_start_date,
            rent_commencement_date, status
     FROM tenant_leases
     WHERE project_id = $1
       AND status NOT IN ('EXPIRED', 'ARCHIVED')
     ORDER BY tenant_name`,
    [projectId]
  );

  if (!leasesResult.rows.length) return empty;

  const leaseIds = leasesResult.rows.map((r: any) => r.id);

  // Fetch initial rent terms for all leases in one query (include schedule_json for SCHEDULE type)
  const termsResult = await pool.query(
    `SELECT lease_id, base_rent_input_unit, base_rent_input_value,
            escalation_type, escalation_value, escalation_frequency_months,
            schedule_json
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
  let stabilizedBaseRent = 0;
  let stabilizedRecovery = 0;
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
      // CPI: use the scenario-configurable CPI rate (default 3%)
      if (escalationType === 'CPI') {
        escalationRate = cpiRate;
      }
      // CPI_CAP_FLOOR: apply the CPI rate clamped between the floor and cap bounds.
      // If both are set and floor > cap (inverted), treat floor as the effective rate
      // so projections are always deterministic regardless of input order.
      if (escalationType === 'CPI_CAP_FLOOR') {
        let rate = cpiRate;
        const effectiveFloor = cpiFloor;
        const effectiveCap = (cpiCap !== undefined && cpiFloor !== undefined && cpiCap < cpiFloor)
          ? cpiFloor
          : cpiCap;
        if (effectiveFloor !== undefined) rate = Math.max(rate, effectiveFloor);
        if (effectiveCap !== undefined) rate = Math.min(rate, effectiveCap);
        escalationRate = rate;
      }
      // SCHEDULE: escalationRate is not used for projection (schedule steps are applied
      // directly in computeLeaseIncomeByYear). Set 0 so it doesn't distort the
      // weighted-average escalation summary for this tenant.
      if (escalationType === 'SCHEDULE') {
        escalationRate = 0;
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

    // Only include currently-active leases in Year 1 aggregate totals.
    // Future leases (lease_start_date > today) will be activated by computeLeaseIncomeByYear
    // starting in the projection year that their lease_start_date falls within.
    const isFutureLease = lease.lease_start_date && lease.lease_start_date > today;
    if (!isFutureLease) {
      totalBaseRent += baseRentAnnual;
      totalRecovery += recoveryAnnual;
      weightedEscRentProduct += escalationRate * baseRentAnnual;
    }
    // Stabilized totals include both in-place and pre-leased (future) leases.
    stabilizedBaseRent += baseRentAnnual;
    stabilizedRecovery += recoveryAnnual;

    // Compute free-rent months from the gap between lease_start_date and rent_commencement_date.
    // When rent_commencement_date is after lease_start_date, the tenant has a free-rent period.
    let freeRentMonths = 0;
    if (lease.rent_commencement_date && lease.lease_start_date) {
      const startMs = new Date(lease.lease_start_date).getTime();
      const commenceMs = new Date(lease.rent_commencement_date).getTime();
      const diffDays = Math.max(0, (commenceMs - startMs) / (1000 * 60 * 60 * 24));
      freeRentMonths = Math.round(diffDays / 30.44); // approximate months
    }

    // Parse schedule_json: may be a jsonb object (already parsed by pg driver) or a string.
    // Each entry is validated before use so malformed rows are silently dropped.
    let scheduleJson: RentStepEntry[] | null = null;
    if (term && term.schedule_json) {
      try {
        const raw = typeof term.schedule_json === 'string'
          ? JSON.parse(term.schedule_json)
          : term.schedule_json;
        if (Array.isArray(raw)) {
          const valid = raw.filter(isValidRentStepEntry);
          if (valid.length > 0) {
            scheduleJson = valid.sort(
              (a, b) => new Date(a.effectiveDate).getTime() - new Date(b.effectiveDate).getTime()
            );
          }
        }
      } catch {
        // Malformed JSON in schedule_json — treat as no schedule
      }
    }

    breakdown.push({
      leaseId: lease.id,
      tenantName: lease.tenant_name,
      sf,
      leaseType: lease.lease_type,
      baseRentAnnual,
      recoveryAnnual,
      escalationType,
      escalationRate,
      // For CPI_CAP_FLOOR leases, record the raw (pre-clamping) CPI rate so the UI
      // can show "Nominal X.X% → Capped/Floored at Y.Y%" comparisons.
      nominalCpiRate: escalationType === 'CPI_CAP_FLOOR' ? cpiRate : undefined,
      capValue: escalationType === 'CPI_CAP_FLOOR' ? cpiCap : undefined,
      floorValue: escalationType === 'CPI_CAP_FLOOR' ? cpiFloor : undefined,
      leaseEndDate: lease.lease_end_date,
      leaseStartDate: lease.lease_start_date ?? null,
      rentCommencementDate: lease.rent_commencement_date ?? null,
      freeRentMonths,
      scheduleJson,
      isFuture: !!isFutureLease,
    });
  }

  const totalEGI = totalBaseRent + totalRecovery;
  const stabilizedEGI = stabilizedBaseRent + stabilizedRecovery;
  const weightedAvgEscalation = totalBaseRent > 0 ? weightedEscRentProduct / totalBaseRent : 0;

  return {
    hasLeases: true,
    leaseCount: leasesResult.rows.length,
    totalBaseRentAnnual: totalBaseRent,
    totalRecoveryAnnual: totalRecovery,
    totalEGIAnnual: totalEGI,
    inPlaceEGIAnnual: totalEGI,
    stabilizedEGIAnnual: stabilizedEGI,
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

  // Project config for hold period + acquisition date + lease income flag
  const pc = await pool.query(
    `SELECT hold_period, acquisition_close_date, cash_flow_granularity, use_lease_income_for_dcf
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
    // null = unset (legacy auto-detect), true = opt-in, false = opt-out
    useLeaseIncomeForDcf: config.use_lease_income_for_dcf ?? null,
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
