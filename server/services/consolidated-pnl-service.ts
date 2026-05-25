/**
 * G4 Phase 1.5 — getConsolidatedPnL
 *
 * Top-level service for the consolidated multi-period P&L view. Orchestrates:
 *
 *   1. resolveYearRange — translates the YearRangeMode option into concrete
 *      (year, month) bounds using available modeling_actuals coverage.
 *   2. detectMissingPeriods — for each year touched by monthly coverage,
 *      reports which months are present + missing inside the resolved range
 *      and the user's projection-handling decision.
 *   3. projectMissingMonths — applies the auto chain
 *      (prior_year_yoy → trailing_3mo → gap) for years marked 'auto'; emits
 *      explicit gap cells for 'gap' years; skips 'manual' years.
 *   4. detectVariances — STUB. Phase 1.5 always returns []; Q2 case 3
 *      (monthly partial vs annual rollup) is filed as a Phase 3 follow-up.
 *
 * Composition with Phase 1.4: getAdjustedActuals is called twice — once at
 * 'annual' granularity to populate the line-item grid + per-year NOI
 * adjustments, and once at 'monthly' granularity (range-filtered, unmatched
 * suppressed) to feed missing-period detection + projection. Both calls
 * share the same resolved range so dedupe + addback overlay are consistent.
 *
 * Tables touched directly by this service:
 *   - modeling_projects       — adjustments_master_state
 *   - modeling_actuals        — coverage bounds for range resolution (single SELECT)
 *   - modeling_projection_decisions — per-year handling + needsReview
 *
 * All other reads go through getAdjustedActuals.
 */

import { pool } from '../db';
import {
  getAdjustedActuals,
} from './adjusted-actuals-service';
import type {
  AdjustedActualRow,
  AdjustmentMasterState,
  AnnualAdjustmentGroup,
  AppliedAddback,
  ConsolidatedCell,
  ConsolidatedLineItem,
  ConsolidatedPnLOptions,
  ConsolidatedPnLResponse,
  ConsolidatedYearCell,
  MissingPeriodReport,
  PeriodPoint,
  PnLCategory,
  ProjectionHandling,
  ProjectionSource,
  ReconciliationVariance,
  YearColumn,
} from '@shared/types/consolidated-pnl';

// ---------------------------------------------------------------------------
// Range resolution
// ---------------------------------------------------------------------------

interface ResolvedRange {
  start: PeriodPoint;
  end: PeriodPoint;
}

interface CoverageBounds {
  minYear: number | null;
  maxYear: number | null;
  /** Encoded as year * 100 + month for the latest month present. */
  maxYyyymm: number | null;
}

const COVERAGE_QUERY = `
  SELECT
    MIN(year)                       AS min_year,
    MAX(year)                       AS max_year,
    MAX(year * 100 + month)         AS max_yyyymm
  FROM modeling_actuals
  WHERE modeling_project_id = $1 AND org_id = $2 AND period_type = 'month'
    AND year BETWEEN 1900 AND 2200
`;

async function fetchCoverageBounds(
  orgId: string,
  projectId: string,
): Promise<CoverageBounds> {
  const r = await pool.query<{
    min_year: number | null;
    max_year: number | null;
    max_yyyymm: number | null;
  }>(COVERAGE_QUERY, [projectId, orgId]);
  const row = r.rows[0] ?? { min_year: null, max_year: null, max_yyyymm: null };

  // Telemetry: surface when the year-filter (1900-2200) drops rows. The
  // filter is defense-in-depth against parser-layer corruption (year=3032
  // produced for 54c1b93a — see project_year_corruption_parse_layer.md),
  // but silently masking is the same blind-spot class as the 937% cap-rate
  // harness gap. Counting + warning ensures any future regression of the
  // parse-layer fix surfaces visibly instead of vanishing.
  const dropped = await pool.query<{ bad_rows: string }>(
    `SELECT COUNT(*) AS bad_rows FROM modeling_actuals
     WHERE modeling_project_id = $1 AND org_id = $2
       AND (year < 1900 OR year > 2200)`,
    [projectId, orgId],
  );
  const badRows = Number(dropped.rows[0]?.bad_rows ?? 0);
  if (badRows > 0) {
    console.warn(
      `[consolidated-pnl] year-filter masking: ${badRows} modeling_actuals row(s) ` +
      `for project=${projectId} have year < 1900 or > 2200 and are being silently ` +
      `excluded. This indicates a parser-layer year-derivation regression — ` +
      `see project_year_corruption_parse_layer.md.`
    );
  }

  return {
    minYear: row.min_year === null ? null : Number(row.min_year),
    maxYear: row.max_year === null ? null : Number(row.max_year),
    maxYyyymm: row.max_yyyymm === null ? null : Number(row.max_yyyymm),
  };
}

/**
 * Whole-year monthly coverage, independent of the current request range.
 * Drives YearColumn.isPartial / monthsCovered. Distinct from the
 * range-filtered monthly stream that feeds detectMissingPeriods, which
 * reports range-bounded coverage gaps.
 */
async function fetchMonthlyCoverageByYear(
  orgId: string,
  projectId: string,
): Promise<Map<number, number>> {
  const r = await pool.query<{ year: number; months: string }>(
    `SELECT year, COUNT(DISTINCT month) AS months
     FROM modeling_actuals
     WHERE modeling_project_id = $1 AND org_id = $2 AND period_type = 'month'
       AND year BETWEEN 1900 AND 2200
     GROUP BY year`,
    [projectId, orgId],
  );
  const map = new Map<number, number>();
  for (const row of r.rows) {
    map.set(Number(row.year), Number(row.months));
  }
  return map;
}

function shiftMonth(point: PeriodPoint, deltaMonths: number): PeriodPoint {
  const total = point.year * 12 + (point.month - 1) + deltaMonths;
  return {
    year: Math.floor(total / 12),
    month: (((total % 12) + 12) % 12) + 1,
  };
}

async function resolveYearRange(
  orgId: string,
  projectId: string,
  options: ConsolidatedPnLOptions,
): Promise<ResolvedRange> {
  // custom mode is independent of coverage — pass through directly.
  if (options.yearRange === 'custom') {
    if (!options.customStart || !options.customEnd) {
      throw new Error(
        'consolidated-pnl: yearRange=custom requires customStart and customEnd',
      );
    }
    return { start: options.customStart, end: options.customEnd };
  }

  const cov = await fetchCoverageBounds(orgId, projectId);
  // Empty project: collapse to current calendar year for both bounds. The
  // downstream getAdjustedActuals call returns no rows; UI handles empty.
  if (cov.minYear === null || cov.maxYear === null || cov.maxYyyymm === null) {
    const y = new Date().getUTCFullYear();
    return { start: { year: y, month: 1 }, end: { year: y, month: 12 } };
  }

  if (options.yearRange === 'calendar') {
    return {
      start: { year: cov.minYear, month: 1 },
      end: { year: cov.maxYear, month: 12 },
    };
  }

  if (options.yearRange === 'fiscal') {
    const fStart = options.fiscalYearStartMonth ?? 1;
    if (fStart < 1 || fStart > 12) {
      throw new Error(
        `consolidated-pnl: fiscalYearStartMonth must be 1–12, got ${fStart}`,
      );
    }
    if (fStart === 1) {
      return {
        start: { year: cov.minYear, month: 1 },
        end: { year: cov.maxYear, month: 12 },
      };
    }
    // Fiscal year FY-N runs (N-1, fStart) through (N, fStart-1).
    // Display covers FY-(minYear) through FY-(maxYear), which spans
    // (minYear-1, fStart) through (maxYear, fStart-1).
    return {
      start: { year: cov.minYear - 1, month: fStart },
      end: { year: cov.maxYear, month: fStart - 1 },
    };
  }

  // t12: trailing 12 months ending at the latest covered month.
  const endYear = Math.floor(cov.maxYyyymm / 100);
  const endMonth = cov.maxYyyymm % 100;
  const end: PeriodPoint = { year: endYear, month: endMonth };
  const start = shiftMonth(end, -11);
  return { start, end };
}

// ---------------------------------------------------------------------------
// Master state + projection decisions
// ---------------------------------------------------------------------------

async function fetchMasterState(
  orgId: string,
  projectId: string,
): Promise<AdjustmentMasterState> {
  const r = await pool.query<{ adjustments_master_state: AdjustmentMasterState }>(
    `SELECT adjustments_master_state FROM modeling_projects
     WHERE id = $1 AND org_id = $2 LIMIT 1`,
    [projectId, orgId],
  );
  return r.rows[0]?.adjustments_master_state ?? 'all_on';
}

export interface ProjectionDecisionRow {
  year: number;
  handling: ProjectionHandling;
  needsReview: boolean;
}

async function fetchProjectionDecisions(
  orgId: string,
  projectId: string,
): Promise<Map<number, ProjectionDecisionRow>> {
  const r = await pool.query<{
    year: number;
    handling: ProjectionHandling;
    needs_review: boolean;
  }>(
    `SELECT year, handling, needs_review
     FROM modeling_projection_decisions
     WHERE project_id = $1 AND org_id = $2`,
    [projectId, orgId],
  );
  const map = new Map<number, ProjectionDecisionRow>();
  for (const row of r.rows) {
    map.set(Number(row.year), {
      year: Number(row.year),
      handling: row.handling,
      needsReview: row.needs_review,
    });
  }
  return map;
}

/**
 * Upsert a (project_id, year) row in modeling_projection_decisions. Composite
 * PK on (project_id, year) is the conflict target. updated_at is explicitly
 * set on conflict — Postgres DEFAULT now() only fires on INSERT.
 *
 * `needs_review` defaults to false at the route layer because user action
 * implies review; callers may override.
 */
export async function upsertProjectionDecision(
  orgId: string,
  projectId: string,
  year: number,
  handling: ProjectionHandling,
  needsReview: boolean,
): Promise<ProjectionDecisionRow> {
  const r = await pool.query<{
    year: number;
    handling: ProjectionHandling;
    needs_review: boolean;
  }>(
    `INSERT INTO modeling_projection_decisions
       (project_id, org_id, year, handling, needs_review)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (project_id, year)
     DO UPDATE SET
       handling = EXCLUDED.handling,
       needs_review = EXCLUDED.needs_review,
       updated_at = NOW()
     RETURNING year, handling, needs_review`,
    [projectId, orgId, year, handling, needsReview],
  );
  const row = r.rows[0];
  return {
    year: Number(row.year),
    handling: row.handling,
    needsReview: row.needs_review,
  };
}

function decisionFor(
  year: number,
  decisions: Map<number, ProjectionDecisionRow>,
): { handling: ProjectionHandling; needsReview: boolean } {
  const found = decisions.get(year);
  if (found) return { handling: found.handling, needsReview: found.needsReview };
  return { handling: 'auto', needsReview: true };
}

// ---------------------------------------------------------------------------
// Year columns + missing-period detection
// ---------------------------------------------------------------------------

/**
 * Months 1–12 inside the request range for a given year. When the year is
 * the start year, months below startMonth are out of scope; when it's the
 * end year, months above endMonth are out of scope.
 */
function rangeMonthsForYear(year: number, range: ResolvedRange): number[] {
  const lo = year === range.start.year ? range.start.month : 1;
  const hi = year === range.end.year ? range.end.month : 12;
  if (lo > hi) return [];
  const out: number[] = [];
  for (let m = lo; m <= hi; m++) out.push(m);
  return out;
}

function buildYearColumns(
  range: ResolvedRange,
  fullYearCoverage: Map<number, number>,
  decisions: Map<number, ProjectionDecisionRow>,
): YearColumn[] {
  const cols: YearColumn[] = [];
  for (let y = range.start.year; y <= range.end.year; y++) {
    const expected = rangeMonthsForYear(y, range);
    if (expected.length === 0) continue;
    // Whole-year coverage — not range-bounded. A fully covered year stays
    // isPartial=false even when the visible window clips it (t12 mode).
    const monthsCovered = fullYearCoverage.get(y) ?? 0;
    const isPartial = monthsCovered < 12;
    const dec = decisionFor(y, decisions);
    cols.push({
      year: y,
      periodType: 'year',
      isPartial,
      monthsCovered,
      handling: dec.handling,
      needsReview: dec.needsReview,
    });
  }
  return cols;
}

function detectMissingPeriods(
  monthlyRows: AdjustedActualRow[],
  range: ResolvedRange,
  decisions: Map<number, ProjectionDecisionRow>,
): MissingPeriodReport[] {
  const coveredByYear = new Map<number, Set<number>>();
  for (const row of monthlyRows) {
    if (row.periodType !== 'month') continue;
    let set = coveredByYear.get(row.year);
    if (!set) {
      set = new Set<number>();
      coveredByYear.set(row.year, set);
    }
    set.add(row.month);
  }

  const reports: MissingPeriodReport[] = [];
  for (let y = range.start.year; y <= range.end.year; y++) {
    const expected = rangeMonthsForYear(y, range);
    if (expected.length === 0) continue;
    const covered = coveredByYear.get(y) ?? new Set<number>();
    // Skip years with zero presence — out of scope, not "missing".
    if (covered.size === 0) continue;
    const monthsCovered = expected.filter((m) => covered.has(m));
    const missingMonths = expected.filter((m) => !covered.has(m));
    if (missingMonths.length === 0) continue;
    const dec = decisionFor(y, decisions);
    reports.push({
      year: y,
      monthsCovered,
      missingMonths,
      handling: dec.handling,
      needsReview: dec.needsReview,
    });
  }
  return reports;
}

// ---------------------------------------------------------------------------
// Line-item grid + annual NOI roll-up
// ---------------------------------------------------------------------------

interface LineKey {
  category: string;
  subcategory: string;
  department: string | null;
  lineItemDescription: string | null;
}

function lineKeyOf(r: AdjustedActualRow): string {
  return [
    r.category,
    r.subcategory,
    r.department ?? '',
    r.lineItemDescription ?? '',
  ].join('|');
}

function formatLineLabel(
  key: LineKey,
  fallback: AdjustedActualRow,
): string {
  if (key.lineItemDescription && key.lineItemDescription.trim().length > 0) {
    return key.lineItemDescription;
  }
  if (fallback.subcategory) return fallback.subcategory;
  return fallback.category;
}

function buildLineItems(
  annualRows: AdjustedActualRow[],
  years: YearColumn[],
): ConsolidatedLineItem[] {
  const yearOrder = years.map((y) => y.year);
  const byKey = new Map<string, { meta: LineKey; sample: AdjustedActualRow; cellsByYear: Map<number, ConsolidatedYearCell> }>();

  for (const row of annualRows) {
    if (row.periodType !== 'year') continue;
    if (!yearOrder.includes(row.year)) continue;
    const key = lineKeyOf(row);
    let bucket = byKey.get(key);
    if (!bucket) {
      bucket = {
        meta: {
          category: row.category,
          subcategory: row.subcategory,
          department: row.department,
          lineItemDescription: row.lineItemDescription,
        },
        sample: row,
        cellsByYear: new Map<number, ConsolidatedYearCell>(),
      };
      byKey.set(key, bucket);
    }
    bucket.cellsByYear.set(row.year, {
      year: row.year,
      baseAmount: row.baseAmount,
      adjustedAmount: row.adjustedAmount,
      hasAdjustment: row.adjustmentDelta !== 0,
    });
  }

  const items: ConsolidatedLineItem[] = [];
  for (const bucket of Array.from(byKey.values())) {
    const annual: ConsolidatedYearCell[] = yearOrder.map((y) => {
      const cell = bucket.cellsByYear.get(y);
      if (cell) return cell;
      return { year: y, baseAmount: 0, adjustedAmount: 0, hasAdjustment: false };
    });
    items.push({
      lineItemKey: lineKeyOf(bucket.sample),
      lineItemLabel: formatLineLabel(bucket.meta, bucket.sample),
      category: bucket.meta.category as PnLCategory | string,
      subcategory: bucket.meta.subcategory,
      department: bucket.meta.department,
      annual,
    });
  }

  // Stable display order: category, subcategory, label.
  items.sort(
    (a, b) =>
      String(a.category).localeCompare(String(b.category)) ||
      a.subcategory.localeCompare(b.subcategory) ||
      a.lineItemLabel.localeCompare(b.lineItemLabel),
  );
  return items;
}

/**
 * Sign convention for NOI contribution — matches Phase 1.2.5 / 1.4:
 *   Revenue:        contribution = +amount
 *   COGS / Expenses contribution = -amount
 *   Other:          contribution = +amount  (treated as revenue-like; the FM
 *                                            does not currently roll Other
 *                                            into NOI, but the consolidated
 *                                            view stays neutral here so the
 *                                            invariant baseAmount + delta =
 *                                            adjustedAmount holds row-wise.)
 */
function noiSign(category: string): 1 | -1 {
  const c = category.toLowerCase();
  if (c === 'cogs' || c === 'expenses') return -1;
  return 1;
}

function buildAnnualAdjustments(
  annualRows: AdjustedActualRow[],
  years: YearColumn[],
): AnnualAdjustmentGroup[] {
  const yearOrder = years.map((y) => y.year);
  type Acc = {
    base: number;
    adjusted: number;
    delta: number;
    applied: AppliedAddback[];
  };
  const accByYear = new Map<number, Acc>();
  for (const y of yearOrder) {
    accByYear.set(y, { base: 0, adjusted: 0, delta: 0, applied: [] });
  }

  for (const row of annualRows) {
    if (row.periodType !== 'year') continue;
    const acc = accByYear.get(row.year);
    if (!acc) continue;
    // base + adjusted: per-row values are line-direction; flip for cost
    // categories so the year-level rollup is in NOI direction.
    // delta: per-row adjustmentDelta is already NOI-direction (Phase 1.2.5),
    // so it sums directly without sign conversion. Preserves the
    // AnnualAdjustmentGroup invariant: adjustedAmount = baseAmount + adjustmentDelta.
    const sign = noiSign(row.category);
    acc.base += sign * row.baseAmount;
    acc.adjusted += sign * row.adjustedAmount;
    acc.delta += row.adjustmentDelta;
    for (const ab of row.appliedAddbacks) {
      acc.applied.push({ ...ab });
    }
  }

  return yearOrder.map((y) => {
    const acc = accByYear.get(y) ?? { base: 0, adjusted: 0, delta: 0, applied: [] };
    return {
      year: y,
      baseAmount: acc.base,
      adjustedAmount: acc.adjusted,
      adjustmentDelta: acc.delta,
      appliedAddbacks: acc.applied,
    };
  });
}

// ---------------------------------------------------------------------------
// Projection — auto chain (prior_year_yoy → trailing_3mo → gap)
// ---------------------------------------------------------------------------

interface MonthlyByLineYear {
  // key = lineKey -> year -> month -> baseAmount
  byLine: Map<string, Map<number, Map<number, number>>>;
  // key = lineKey -> meta for emitting cells
  metaByLine: Map<string, LineKey>;
}

function indexMonthly(monthlyRows: AdjustedActualRow[]): MonthlyByLineYear {
  const byLine = new Map<string, Map<number, Map<number, number>>>();
  const metaByLine = new Map<string, LineKey>();
  for (const row of monthlyRows) {
    if (row.periodType !== 'month') continue;
    const key = lineKeyOf(row);
    let yearMap = byLine.get(key);
    if (!yearMap) {
      yearMap = new Map();
      byLine.set(key, yearMap);
      metaByLine.set(key, {
        category: row.category,
        subcategory: row.subcategory,
        department: row.department,
        lineItemDescription: row.lineItemDescription,
      });
    }
    let monthMap = yearMap.get(row.year);
    if (!monthMap) {
      monthMap = new Map();
      yearMap.set(row.year, monthMap);
    }
    monthMap.set(row.month, row.baseAmount);
  }
  return { byLine, metaByLine };
}

function projectOneCell(
  lineKey: string,
  year: number,
  month: number,
  index: MonthlyByLineYear,
): { baseAmount: number | null; source: ProjectionSource } {
  const yearMap = index.byLine.get(lineKey);
  if (!yearMap) return { baseAmount: null, source: 'gap' };
  const currentYear = yearMap.get(year);
  const priorYear = yearMap.get(year - 1);

  // prior_year_yoy: priorYearSameMonth × (currentYTD ÷ priorYTD)
  const priorSameMonth = priorYear?.get(month);
  if (priorYear && priorSameMonth !== undefined && currentYear) {
    let priorYTD = 0;
    let currentYTD = 0;
    for (const v of Array.from(priorYear.values())) priorYTD += v;
    for (const v of Array.from(currentYear.values())) currentYTD += v;
    if (priorYTD !== 0) {
      const projected = priorSameMonth * (currentYTD / priorYTD);
      return { baseAmount: projected, source: 'auto:prior_year_yoy' };
    }
  }

  // trailing_3mo: mean of last up-to-3 monthly values in current year.
  if (currentYear && currentYear.size > 0) {
    const months = Array.from(currentYear.keys()).sort((a, b) => a - b);
    const lastN = months.slice(-3);
    let sum = 0;
    for (const m of lastN) sum += currentYear.get(m) ?? 0;
    return { baseAmount: sum / lastN.length, source: 'auto:trailing_3mo' };
  }

  return { baseAmount: null, source: 'gap' };
}

function projectMissingMonths(
  monthlyRows: AdjustedActualRow[],
  missingPeriods: MissingPeriodReport[],
): ConsolidatedCell[] {
  const index = indexMonthly(monthlyRows);
  const cells: ConsolidatedCell[] = [];

  for (const report of missingPeriods) {
    if (report.handling === 'manual') continue; // user-entered, handled separately
    // Line-item set is derived from rows actually present in the current
    // year — avoids projecting line items that didn't exist in the year's
    // coverage.
    const linesInYear: string[] = [];
    for (const [key, yearMap] of Array.from(index.byLine.entries())) {
      const monthMap = yearMap.get(report.year);
      if (monthMap && monthMap.size > 0) linesInYear.push(key);
    }

    for (const lineKey of linesInYear) {
      const meta = index.metaByLine.get(lineKey);
      if (!meta) continue;
      for (const month of report.missingMonths) {
        if (report.handling === 'gap') {
          cells.push({
            year: report.year,
            month,
            category: meta.category as PnLCategory | string,
            subcategory: meta.subcategory,
            lineItemDescription: meta.lineItemDescription,
            baseAmount: null,
            source: 'gap',
          });
          continue;
        }
        // 'auto'
        const projection = projectOneCell(lineKey, report.year, month, index);
        cells.push({
          year: report.year,
          month,
          category: meta.category as PnLCategory | string,
          subcategory: meta.subcategory,
          lineItemDescription: meta.lineItemDescription,
          baseAmount: projection.baseAmount,
          source: projection.source,
        });
      }
    }
  }

  cells.sort(
    (a, b) =>
      a.year - b.year ||
      a.month - b.month ||
      String(a.category).localeCompare(String(b.category)) ||
      a.subcategory.localeCompare(b.subcategory) ||
      (a.lineItemDescription ?? '').localeCompare(b.lineItemDescription ?? ''),
  );
  return cells;
}

// ---------------------------------------------------------------------------
// Variance detection — Phase 1.5 stub
// ---------------------------------------------------------------------------

/**
 * Phase 1.5 always returns []. Spec v3 doesn't gate the consolidated view on
 * variance verification; the raw-actuals query that populates Q2 case 3
 * (monthly partial vs annual rollup also present) lands as a Phase 3
 * follow-up. Documented intentionally so the surface is stable for callers.
 */
function detectVariances(
  _annualRows: AdjustedActualRow[],
  _monthlyRows: AdjustedActualRow[],
): ReconciliationVariance[] {
  return [];
}

// ---------------------------------------------------------------------------
// Top-level orchestration
// ---------------------------------------------------------------------------

export async function getConsolidatedPnL(
  orgId: string,
  projectId: string,
  options: ConsolidatedPnLOptions,
): Promise<ConsolidatedPnLResponse> {
  const range = await resolveYearRange(orgId, projectId, options);

  const [masterState, decisions, fullYearCoverage, annualResult, monthlyResult] =
    await Promise.all([
      fetchMasterState(orgId, projectId),
      fetchProjectionDecisions(orgId, projectId),
      fetchMonthlyCoverageByYear(orgId, projectId),
      getAdjustedActuals(orgId, projectId, {
        granularity: 'annual',
        range,
        includeUnmatched: true,
      }),
      getAdjustedActuals(orgId, projectId, {
        granularity: 'monthly',
        range,
        includeUnmatched: false,
      }),
    ]);

  const years = buildYearColumns(range, fullYearCoverage, decisions);
  const lineItems = buildLineItems(annualResult.rows, years);
  const annualAdjustments = buildAnnualAdjustments(annualResult.rows, years);
  const missingPeriods = detectMissingPeriods(monthlyResult.rows, range, decisions);
  const projectedCells = projectMissingMonths(monthlyResult.rows, missingPeriods);
  const variances = detectVariances(annualResult.rows, monthlyResult.rows);

  return {
    projectId,
    orgId,
    generatedAt: new Date().toISOString(),
    masterState,
    effectiveStart: range.start,
    effectiveEnd: range.end,
    years,
    lineItems,
    annualAdjustments,
    unmatchedAddbacks: annualResult.unmatchedAddbacks,
    variances,
    missingPeriods,
    projectedCells,
  };
}
