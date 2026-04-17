/**
 * Multi-Year Projection Engine
 * ============================
 * Pure function — no DB, no side effects.
 *
 * Takes Year 1 output from computeDirectInputFinancials() + a ProjectionConfig,
 * returns ProjectionYear[] for use in DCF, IRR, waterfall, and UI display.
 *
 * Design principles:
 *  - Year 1 is always the direct-input-engine output, unchanged
 *  - Seasonal pattern is preserved by scaling monthly ratios × new annual total
 *  - Vacancy burn-off reduces the vacancy loss line each year toward a stabilized floor
 *  - CapEx can be a schedule (per-year amounts) or a default % of EGI
 *  - Commercial rent step-ups flow automatically if syncLeaseRollupToAssumptions()
 *    was called before Year 1 was computed (no extra logic needed here)
 *  - Per-category growth rates override the global rate when present
 *  - Exit value = Year N NOI / exitCapRate (terminal cap rate)
 */

import type { DirectInputFinancials, FinancialLine, MonthlyBreakdown } from './direct-input-engine';

// ─────────────────────────────────────────────
// CONFIG TYPES
// ─────────────────────────────────────────────

export interface VacancyCurveEntry {
  /** 1-based year index */
  year: number;
  /**
   * Override vacancy loss as a fraction of GPR (e.g. 0.05 = 5%).
   * When set, the engine replaces the vacancy line amount with GPR × vacancyRate
   * rather than applying compound growth to the Year 1 vacancy amount.
   * Use for lease-up scenarios where vacancy starts high and burns off.
   */
  vacancyRate: number;
}

export interface CapExScheduleEntry {
  /** 1-based year index */
  year: number;
  /** Absolute dollar amount for CapEx in this year */
  amount: number;
  /** Optional label shown in UI / export (e.g. "Roof replacement", "HVAC upgrade") */
  label?: string;
}

export interface ProjectionConfig {
  /** Number of years to project (1 = Year 1 only, 10 = Years 1–10) */
  holdPeriod: number;

  /** Global annual revenue growth rate as a decimal (e.g. 0.03 = 3%) */
  revenueGrowthRate: number;

  /** Global annual expense growth rate as a decimal (e.g. 0.02 = 2%) */
  expenseGrowthRate: number;

  /**
   * Per-COA-key growth rate overrides.
   * Keys match FinancialLine.key from the direct input engine.
   * Example: { "propertyTaxes": 0.05, "insurance": 0.04 }
   */
  categoryGrowthRates?: Record<string, number>;

  /**
   * Vacancy burn-off schedule.
   * If omitted, vacancy grows at the same rate as other expense lines.
   * If provided, each entry overrides the vacancy loss amount for that year.
   */
  vacancyCurve?: VacancyCurveEntry[];

  /**
   * CapEx schedule.
   * If a year is not in the schedule, the engine uses defaultCapExPct × EGI.
   */
  capexSchedule?: CapExScheduleEntry[];

  /**
   * Default CapEx as fraction of EGI (Effective Gross Income) when no schedule entry exists.
   * Defaults to 0.02 (2%) if not provided.
   */
  defaultCapExPct?: number;

  /** Terminal cap rate for exit value calculation (e.g. 0.065 = 6.5%) */
  exitCapRate?: number;

  /**
   * Selling cost as fraction of exit value (e.g. 0.03 = 3% broker + closing).
   * Applied when computing net sale proceeds.
   */
  sellingCostPct?: number;

  /**
   * Per-year NOI overrides derived from tenant lease escalation schedules.
   * Index 0 = Year 1, index 1 = Year 2, etc.
   * When present for a given year, the engine uses this value as the canonical NOI
   * instead of computing NOI from revenue-minus-expenses growth.
   * Revenue and expense lines still grow normally for display; only NOI and NCF
   * are overridden. Use computeLeaseIncomeByYear() to generate these values.
   */
  noiOverrides?: number[];
}

// ─────────────────────────────────────────────
// OUTPUT TYPES
// ─────────────────────────────────────────────

export interface ProjectionLineItem {
  key: string;
  label: string;
  category: string;
  amount: number;
  /** Formula string — Year 1 preserves engine formula; subsequent years show growth formula */
  formula?: string;
  /** True when this line was subject to vacancy burn-off override */
  isVacancyOverride?: boolean;
  /** True when this is a CapEx line (below NOI) */
  isCapEx?: boolean;
}

export interface ProjectionMonthlyBreakdown {
  month: number;       // 1–12
  monthName: string;
  revenue: number;
  expenses: number;
  noi: number;
  daysInMonth: number;
  isSeasonal?: boolean;
}

export interface ProjectionYear {
  /** 1-based year number */
  year: number;
  /** Display label — "Year 1", "Year 2", etc. */
  label: string;
  /** Effective Gross Income (revenue net of vacancy/concessions) */
  effectiveGrossIncome: number;
  totalRevenue: number;
  totalExpenses: number;
  noi: number;
  /** CapEx for this year (below NOI, not in expense lines) */
  capex: number;
  /** Net Cash Flow = NOI - CapEx */
  ncf: number;
  revenueLines: ProjectionLineItem[];
  expenseLines: ProjectionLineItem[];
  monthlyBreakdown: ProjectionMonthlyBreakdown[];
  /** Applied revenue growth rate for this year (informational) */
  appliedRevenueGrowthRate: number;
  /** Applied expense growth rate for this year (informational) */
  appliedExpenseGrowthRate: number;
  /** CapEx schedule entry for this year, if explicitly scheduled */
  capexScheduleEntry?: CapExScheduleEntry;
  /** Year-over-year NOI change (null for Year 1) */
  noiChange?: number;
  /** Year-over-year NOI change as percent (null for Year 1) */
  noiChangePct?: number;
  /**
   * When set, this NOI was provided by a per-year lease escalation override
   * rather than computed from revenue-minus-expenses growth.
   */
  noiOverrideFromLeases?: number;
}

export interface ExitMetrics {
  exitNOI: number;
  exitValue: number;
  sellingCosts: number;
  netSaleProceeds: number;
  /** Gross return multiple on exit value vs. NOI */
  impliedCapRate: number;
}

export interface MultiYearProjectionResult {
  years: ProjectionYear[];
  /** Summary table: NOI by year, for quick rendering */
  noiWaterfall: { year: number; label: string; noi: number; ncf: number }[];
  exit: ExitMetrics | null;
  config: ProjectionConfig;
  /** Total hold-period NOI (sum across all years) */
  totalNOI: number;
  /** Total hold-period NCF (sum across all years) */
  totalNCF: number;
  /** Average annual NOI growth rate (CAGR from Year 1 to Year N) */
  noiCAGR: number | null;
}

// ─────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const DEFAULT_CAPEX_PCT = 0.02;
const DEFAULT_EXIT_CAP_RATE = 0.065;
const DEFAULT_SELLING_COST_PCT = 0.03;

// COA keys that represent vacancy / credit loss (should not compound like regular expenses)
const VACANCY_KEYS = new Set([
  'vacancy', 'vacancyLoss', 'vacancy_loss', 'creditLoss', 'credit_loss',
  'concessions', 'badDebt', 'bad_debt', 'physicalVacancy', 'economic_vacancy',
]);

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function fmtC(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function fmtP(n: number): string {
  return `${(n * 100).toFixed(2)}%`;
}

/**
 * Resolve growth rate for a specific line item.
 * Priority: categoryGrowthRates[key] > global rate
 */
function resolveGrowthRate(
  key: string,
  isRevenue: boolean,
  config: ProjectionConfig
): number {
  if (config.categoryGrowthRates && key in config.categoryGrowthRates) {
    return config.categoryGrowthRates[key];
  }
  return isRevenue ? config.revenueGrowthRate : config.expenseGrowthRate;
}

/**
 * Scale a monthly breakdown proportionally when annual totals change.
 * Preserves seasonal distribution — each month's share of the annual total
 * is kept constant, only the absolute amounts change.
 *
 * When newNOI differs from (newAnnualRevenue - newAnnualExpenses) — for example
 * when a per-lease NOI override is in effect — monthly NOI is scaled separately
 * so the monthly totals sum to the authoritative annual NOI.
 */
function scaleMonthlyBreakdown(
  year1Breakdown: MonthlyBreakdown[],
  newAnnualRevenue: number,
  newAnnualExpenses: number,
  newNOI: number
): ProjectionMonthlyBreakdown[] {
  const year1TotalRevenue = year1Breakdown.reduce((s, m) => s + m.revenue, 0);
  const year1TotalExpenses = year1Breakdown.reduce((s, m) => s + m.expenses, 0);
  const year1TotalNOI = year1Breakdown.reduce(
    (s, m) => s + (m.noi ?? (m.revenue - m.expenses)),
    0
  );

  const revenueScalar = year1TotalRevenue > 0 ? newAnnualRevenue / year1TotalRevenue : 1;
  const expenseScalar = year1TotalExpenses > 0 ? newAnnualExpenses / year1TotalExpenses : 1;
  // Scale monthly NOI to the authoritative annual NOI (which may be a lease override)
  const noiScalar = year1TotalNOI !== 0 ? newNOI / year1TotalNOI : 1;

  return year1Breakdown.map((m, idx) => {
    const scaledRevenue = round2(m.revenue * revenueScalar);
    const scaledExpenses = round2(m.expenses * expenseScalar);
    const monthNOI = m.noi ?? (m.revenue - m.expenses);
    const scaledNOI = year1TotalNOI !== 0
      ? round2(monthNOI * noiScalar)
      : round2(scaledRevenue - scaledExpenses);
    return {
      month: idx + 1,
      monthName: MONTH_NAMES[idx],
      revenue: scaledRevenue,
      expenses: scaledExpenses,
      noi: scaledNOI,
      daysInMonth: m.daysInMonth,
      isSeasonal: m.isSeasonal,
    };
  });
}

/**
 * Build Year 1 projection directly from engine output — no growth applied.
 * When noiOverride is provided (from per-lease escalation schedules), it
 * replaces the engine-computed NOI while revenue/expense lines are preserved.
 */
function buildYear1(
  financials: DirectInputFinancials,
  capex: number,
  capexEntry: CapExScheduleEntry | undefined,
  noiOverride?: number
): ProjectionYear {
  const revenueLines: ProjectionLineItem[] = financials.revenueLines.map(l => ({
    key: l.key,
    label: l.label,
    category: l.category ?? 'revenue',
    amount: round2(l.amount),
    formula: l.formula,
  }));

  const expenseLines: ProjectionLineItem[] = financials.expenseLines.map(l => ({
    key: l.key,
    label: l.label,
    category: l.category ?? 'expense',
    amount: round2(l.amount),
    formula: l.formula,
  }));

  // Build monthly breakdown from engine output
  const monthlyBreakdown: ProjectionMonthlyBreakdown[] = financials.monthlyBreakdown.map(
    (m, idx) => ({
      month: idx + 1,
      monthName: MONTH_NAMES[idx],
      revenue: round2(m.revenue),
      expenses: round2(m.expenses),
      noi: round2(m.noi ?? (m.revenue - m.expenses)),
      daysInMonth: m.daysInMonth,
      isSeasonal: m.isSeasonal,
    })
  );

  const canonicalNOI = noiOverride !== undefined ? round2(noiOverride) : round2(financials.noi);
  const ncf = round2(canonicalNOI - capex);

  return {
    year: 1,
    label: 'Year 1',
    effectiveGrossIncome: round2(financials.totalRevenue),
    totalRevenue: round2(financials.totalRevenue),
    totalExpenses: round2(financials.totalExpenses),
    noi: canonicalNOI,
    capex: round2(capex),
    ncf,
    revenueLines,
    expenseLines,
    monthlyBreakdown,
    appliedRevenueGrowthRate: 0,
    appliedExpenseGrowthRate: 0,
    capexScheduleEntry: capexEntry,
    noiChange: undefined,
    noiChangePct: undefined,
    noiOverrideFromLeases: noiOverride !== undefined ? round2(noiOverride) : undefined,
  };
}

/**
 * Build a single projected year by compounding growth on each line item.
 * When config.noiOverrides[yearNum-1] is set, that value is used as the
 * canonical NOI (from per-tenant lease escalation schedules) rather than
 * revenue-minus-expenses. Revenue/expense lines still grow for display
 * and the monthly breakdown is scaled to reflect the override NOI.
 */
function buildProjectedYear(
  yearNum: number,
  prevYear: ProjectionYear,
  year1: ProjectionYear,
  year1Financials: DirectInputFinancials,
  config: ProjectionConfig,
  vacancyEntry: VacancyCurveEntry | undefined,
  capexEntry: CapExScheduleEntry | undefined
): ProjectionYear {
  // ── Revenue lines ──────────────────────────────────────────────────────────
  const newRevenueLines: ProjectionLineItem[] = prevYear.revenueLines.map(line => {
    const rate = resolveGrowthRate(line.key, true, config);
    const newAmount = round2(line.amount * (1 + rate));
    return {
      ...line,
      amount: newAmount,
      formula: `$${fmtC(line.amount)} × (1 + ${fmtP(rate)}) = $${fmtC(newAmount)}`,
    };
  });

  const newTotalRevenue = round2(newRevenueLines.reduce((s, l) => s + l.amount, 0));

  // ── Expense lines ──────────────────────────────────────────────────────────
  const gprLine = newRevenueLines.find(l =>
    l.key === 'grossPotentialRent' || l.key === 'gpr' || l.key === 'grossRevenue'
  );
  const newGPR = gprLine?.amount ?? newTotalRevenue;

  const newExpenseLines: ProjectionLineItem[] = prevYear.expenseLines.map(line => {
    // Vacancy burn-off: override with vacancyRate × GPR
    if (VACANCY_KEYS.has(line.key) && vacancyEntry) {
      const newAmount = round2(newGPR * vacancyEntry.vacancyRate);
      return {
        ...line,
        amount: newAmount,
        formula: `GPR $${fmtC(newGPR)} × ${fmtP(vacancyEntry.vacancyRate)} vacancy = $${fmtC(newAmount)}`,
        isVacancyOverride: true,
      };
    }

    const rate = resolveGrowthRate(line.key, false, config);
    const newAmount = round2(line.amount * (1 + rate));
    return {
      ...line,
      amount: newAmount,
      formula: `$${fmtC(line.amount)} × (1 + ${fmtP(rate)}) = $${fmtC(newAmount)}`,
    };
  });

  const newTotalExpenses = round2(newExpenseLines.reduce((s, l) => s + l.amount, 0));
  const computedNOI = round2(newTotalRevenue - newTotalExpenses);

  // ── Per-year lease NOI override ────────────────────────────────────────────
  // When per-tenant escalation schedules produce a NOI override for this year,
  // use it as the canonical NOI instead of the revenue-minus-expenses result.
  // The monthly breakdown is scaled accordingly.
  const leaseNOIOverride = config.noiOverrides?.[yearNum - 1];
  const newNOI = leaseNOIOverride !== undefined ? round2(leaseNOIOverride) : computedNOI;

  // ── CapEx ──────────────────────────────────────────────────────────────────
  let capex: number;
  if (capexEntry) {
    capex = round2(capexEntry.amount);
  } else {
    const defaultPct = config.defaultCapExPct ?? DEFAULT_CAPEX_PCT;
    capex = round2(newTotalRevenue * defaultPct);
  }

  const ncf = round2(newNOI - capex);

  // ── Monthly breakdown — scale proportionally from Year 1 seasonal pattern ─
  // Use the canonical (potentially overridden) NOI for the monthly breakdown
  const monthlyBreakdown = scaleMonthlyBreakdown(
    year1Financials.monthlyBreakdown,
    newTotalRevenue,
    newTotalExpenses,
    newNOI
  );

  // ── NOI delta ─────────────────────────────────────────────────────────────
  const noiChange = round2(newNOI - prevYear.noi);
  const noiChangePct = prevYear.noi !== 0 ? round2(noiChange / Math.abs(prevYear.noi)) : null;

  return {
    year: yearNum,
    label: `Year ${yearNum}`,
    effectiveGrossIncome: newTotalRevenue,
    totalRevenue: newTotalRevenue,
    totalExpenses: newTotalExpenses,
    noi: newNOI,
    capex,
    ncf,
    revenueLines: newRevenueLines,
    expenseLines: newExpenseLines,
    monthlyBreakdown,
    appliedRevenueGrowthRate: config.revenueGrowthRate,
    appliedExpenseGrowthRate: config.expenseGrowthRate,
    capexScheduleEntry: capexEntry,
    noiChange,
    noiChangePct: noiChangePct ?? undefined,
    noiOverrideFromLeases: leaseNOIOverride !== undefined ? round2(leaseNOIOverride) : undefined,
  };
}

// ─────────────────────────────────────────────
// MAIN EXPORT
// ─────────────────────────────────────────────

/**
 * computeMultiYearProjection
 *
 * @param year1Financials  Output of computeDirectInputFinancials() — Year 1 base
 * @param config           Projection parameters
 * @returns                MultiYearProjectionResult
 *
 * @example
 * const year1 = computeDirectInputFinancials(assetClass, assumptions, unitMix);
 * const projection = computeMultiYearProjection(year1, {
 *   holdPeriod: 7,
 *   revenueGrowthRate: 0.03,
 *   expenseGrowthRate: 0.025,
 *   categoryGrowthRates: { propertyTaxes: 0.05 },
 *   vacancyCurve: [
 *     { year: 1, vacancyRate: 0.12 },
 *     { year: 2, vacancyRate: 0.08 },
 *     { year: 3, vacancyRate: 0.05 },
 *   ],
 *   capexSchedule: [
 *     { year: 4, amount: 150000, label: 'Roof replacement' },
 *   ],
 *   exitCapRate: 0.065,
 *   sellingCostPct: 0.03,
 * });
 */
export function computeMultiYearProjection(
  year1Financials: DirectInputFinancials,
  config: ProjectionConfig
): MultiYearProjectionResult {
  if (config.holdPeriod < 1 || config.holdPeriod > 30) {
    throw new Error(`holdPeriod must be between 1 and 30, got ${config.holdPeriod}`);
  }

  // ── Resolve Year 1 CapEx ───────────────────────────────────────────────────
  const year1CapExEntry = config.capexSchedule?.find(e => e.year === 1);
  const year1CapEx = year1CapExEntry
    ? year1CapExEntry.amount
    : year1Financials.totalRevenue * (config.defaultCapExPct ?? DEFAULT_CAPEX_PCT);

  // Apply Year 1 NOI override from per-lease escalation schedules (index 0)
  const year1NOIOverride = config.noiOverrides?.[0];
  const year1 = buildYear1(year1Financials, year1CapEx, year1CapExEntry, year1NOIOverride);

  const years: ProjectionYear[] = [year1];

  // ── Project Years 2–N ──────────────────────────────────────────────────────
  for (let y = 2; y <= config.holdPeriod; y++) {
    const prevYear = years[y - 2];

    const vacancyEntry = config.vacancyCurve?.find(e => e.year === y);
    const capexEntry = config.capexSchedule?.find(e => e.year === y);

    const projectedYear = buildProjectedYear(
      y,
      prevYear,
      year1,
      year1Financials,
      config,
      vacancyEntry,
      capexEntry
    );

    years.push(projectedYear);
  }

  // ── Exit metrics ───────────────────────────────────────────────────────────
  let exit: ExitMetrics | null = null;
  if (config.exitCapRate && config.exitCapRate > 0) {
    const exitCapRate = config.exitCapRate ?? DEFAULT_EXIT_CAP_RATE;
    const sellingCostPct = config.sellingCostPct ?? DEFAULT_SELLING_COST_PCT;
    const exitNOI = years[years.length - 1].noi;
    const exitValue = round2(exitNOI / exitCapRate);
    const sellingCosts = round2(exitValue * sellingCostPct);
    const netSaleProceeds = round2(exitValue - sellingCosts);

    exit = {
      exitNOI,
      exitValue,
      sellingCosts,
      netSaleProceeds,
      impliedCapRate: exitCapRate,
    };
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  const totalNOI = round2(years.reduce((s, y) => s + y.noi, 0));
  const totalNCF = round2(years.reduce((s, y) => s + y.ncf, 0));

  const firstNOI = years[0].noi;
  const lastNOI = years[years.length - 1].noi;
  const noiCAGR =
    firstNOI > 0 && years.length > 1
      ? round2(Math.pow(lastNOI / firstNOI, 1 / (years.length - 1)) - 1)
      : null;

  const noiWaterfall = years.map(y => ({
    year: y.year,
    label: y.label,
    noi: y.noi,
    ncf: y.ncf,
  }));

  return {
    years,
    noiWaterfall,
    exit,
    config,
    totalNOI,
    totalNCF,
    noiCAGR,
  };
}

// ─────────────────────────────────────────────
// CONVENIENCE: build config from DB row shapes
// ─────────────────────────────────────────────

/**
 * Builds a ProjectionConfig from the DB row shapes already in the schema.
 * Pass modelingProjectConfig row + scenario version row.
 *
 * @param projectConfig   Row from modelingProjectConfig table
 * @param scenarioVersion Row from modelingScenarioVersions table (optional)
 * @param overrides       Any ad-hoc overrides (e.g. from request body)
 */
export function buildProjectionConfig(
  projectConfig: {
    holdPeriod?: number | null;
  },
  scenarioVersion?: {
    revenueGrowthRate?: string | number | null;
    expenseGrowthRate?: string | number | null;
    holdPeriodYears?: number | null;
    categoryGrowthRates?: Record<string, number> | null;
  } | null,
  overrides?: Partial<ProjectionConfig>
): ProjectionConfig {
  const holdPeriod =
    overrides?.holdPeriod ??
    scenarioVersion?.holdPeriodYears ??
    projectConfig?.holdPeriod ??
    5;

  const revenueGrowthRate =
    overrides?.revenueGrowthRate ??
    (scenarioVersion?.revenueGrowthRate != null
      ? Number(scenarioVersion.revenueGrowthRate)
      : 0.03);

  const expenseGrowthRate =
    overrides?.expenseGrowthRate ??
    (scenarioVersion?.expenseGrowthRate != null
      ? Number(scenarioVersion.expenseGrowthRate)
      : 0.025);

  return {
    holdPeriod,
    revenueGrowthRate,
    expenseGrowthRate,
    categoryGrowthRates: overrides?.categoryGrowthRates ?? scenarioVersion?.categoryGrowthRates ?? undefined,
    vacancyCurve: overrides?.vacancyCurve,
    capexSchedule: overrides?.capexSchedule,
    defaultCapExPct: overrides?.defaultCapExPct ?? DEFAULT_CAPEX_PCT,
    exitCapRate: overrides?.exitCapRate ?? DEFAULT_EXIT_CAP_RATE,
    sellingCostPct: overrides?.sellingCostPct ?? DEFAULT_SELLING_COST_PCT,
  };
}
