/**
 * G4 Phase 1.4 — getAdjustedActuals
 *
 * Single source of truth for the addback-adjusted actuals stream consumed
 * by the consolidated multi-period P&L view (G4) and the pro-forma
 * projection engine (Phase 2). Replaces the per-call N+1 pattern in the
 * Exit Metrics handler at server/routes/modeling-routes.ts:3434.
 *
 * Sign + replacement semantics — locked in Phase 1.2.5 (commit 91b8c6d0):
 *   - Addback values stored in modeling_addback_values REPLACE the
 *     original line-item amount; they are not additive.
 *   - Per-addback signed delta to NOI:
 *       Expense / COGS:  delta = originalSum - replacementSum
 *       Revenue:         delta = replacementSum - originalSum
 *   - Sign source: the matched modeling_actuals row's category, with the
 *     addback's stored category as tie-break (matches Phase 1.2.5
 *     line 3510). Comparison is case-insensitive.
 *
 * Q2 dedupe — applied BEFORE addback overlay (architectural decision in
 * spec v3): for any (project, year), if monthly rows cover all 12 months,
 * the year-type rollup row is dropped. Order matters because the addback
 * live-lookup operates on the deduped stream.
 *
 * Row-level distribution of addback delta — for monthly granularity, an
 * addback's full year-level delta is proportionally distributed across
 * its in-range matched rows (denominator = sum of in-range matched
 * amounts, so shares sum to the full delta whenever at least one matched
 * row falls inside the request range). For annual granularity, the
 * addback's full delta lands on the (year, line) annual row directly.
 *
 * Query shape (single round-trip, six CTEs):
 *   1. year_full_coverage    — (project, year) tuples with 12-month coverage
 *   2. deduped_actuals       — modeling_actuals minus dropped year rollups
 *   3. ranged_actuals        — deduped + request-range filter (rows we return)
 *   4. active_addbacks       — is_active=true, project + org scoped
 *   5. addback_replacement   — Σ modeling_addback_values per addback
 *   6. addback_matched_full  — actuals × addbacks join over deduped (full scope)
 *   7. addback_original      — Σ matched amounts per addback (basis for delta)
 *   8. addback_matched_inrange — actuals × addbacks join over ranged (share denom)
 *   9. addback_inrange_total — Σ in-range matched amounts per addback
 *  10. addback_delta         — replacement_sum, original_sum, signed delta
 *  11. applied_per_row       — per (in-range row × addback) row_share
 *  12. row_adjustments       — Σ shares + json_agg(applied_addbacks) per row
 * Final SELECT joins ranged_actuals to row_adjustments.
 *
 * A second small query (after the main query) lists unmatched addbacks
 * (active addbacks whose full-scope actuals join is empty) — kept
 * separate because the discriminator would otherwise make the main
 * SELECT awkwardly polymorphic.
 */

import { pool } from '../db';
import type {
  AdjustedActualRow,
  AdjustedActualsOptions,
  AppliedAddback,
  GetAdjustedActualsResult,
  PeriodType,
  UnmatchedAddback,
} from '@shared/types/consolidated-pnl';

interface RangeBounds {
  startYear: number;
  startMonth: number;
  endYear: number;
  endMonth: number;
}

const FULL_RANGE: RangeBounds = {
  startYear: -1_000_000,
  startMonth: 1,
  endYear: 1_000_000,
  endMonth: 12,
};

function resolveRange(options: AdjustedActualsOptions): RangeBounds {
  if (!options.range) return FULL_RANGE;
  return {
    startYear: options.range.start.year,
    startMonth: options.range.start.month,
    endYear: options.range.end.year,
    endMonth: options.range.end.month,
  };
}

// INVARIANT — keep dedupe + scope-match logic in sync with UNMATCHED_QUERY.
// Both queries must derive the same active-addback ↔ actuals join shape so
// the unmatched-addback set is consistent. Any change here (dedupe rule,
// scope predicates, year-range filter) MUST be mirrored in UNMATCHED_QUERY.
const MAIN_QUERY = `
WITH year_full_coverage AS (
  SELECT modeling_project_id, year
  FROM modeling_actuals
  WHERE modeling_project_id = $1 AND org_id = $2 AND period_type = 'month'
    -- Defensive year-range filter — see project_actuals_year_glitch.md
    AND year BETWEEN 1900 AND 2200
  GROUP BY modeling_project_id, year
  HAVING COUNT(DISTINCT month) = 12
),
deduped_actuals AS (
  SELECT a.*
  FROM modeling_actuals a
  WHERE a.modeling_project_id = $1 AND a.org_id = $2
    -- Defensive year-range filter — see project_actuals_year_glitch.md
    AND a.year BETWEEN 1900 AND 2200
    AND (
      a.period_type IN ('month', 'quarter')
      OR (a.period_type = 'year' AND NOT EXISTS (
        SELECT 1 FROM year_full_coverage f
        WHERE f.modeling_project_id = a.modeling_project_id
          AND f.year = a.year
      ))
    )
),
ranged_actuals AS (
  SELECT *
  FROM deduped_actuals
  WHERE (year > $3 OR (year = $3 AND month >= $4))
    AND (year < $5 OR (year = $5 AND month <= $6))
),
active_addbacks AS (
  SELECT id, line_item_key, scope, addback_year, addback_month, category
  FROM modeling_addbacks
  WHERE project_id = $1 AND org_id = $2 AND is_active = true
),
addback_replacement AS (
  SELECT av.addback_id, SUM(av.amount::numeric) AS replacement_sum
  FROM modeling_addback_values av
  JOIN active_addbacks ab ON ab.id = av.addback_id
  GROUP BY av.addback_id
),
addback_matched_full AS (
  SELECT
    ab.id          AS addback_id,
    a.id           AS actual_id,
    a.year         AS actual_year,
    a.month        AS actual_month,
    a.amount::numeric AS actual_amount,
    a.category     AS actual_category
  FROM active_addbacks ab
  JOIN deduped_actuals a ON
    a.year = ab.addback_year
    AND (
      (ab.scope = 'category'                          AND a.category    = ab.line_item_key)
      OR (ab.scope IN ('line_item', 'month_cell')     AND a.subcategory = ab.line_item_key)
    )
    AND (ab.scope <> 'month_cell' OR a.month = ab.addback_month)
),
addback_original AS (
  SELECT
    addback_id,
    SUM(actual_amount) AS original_sum,
    (ARRAY_AGG(actual_category ORDER BY actual_year, actual_month))[1] AS first_category
  FROM addback_matched_full
  GROUP BY addback_id
),
addback_matched_inrange AS (
  SELECT
    ab.id          AS addback_id,
    a.id           AS actual_id,
    a.amount::numeric AS actual_amount
  FROM active_addbacks ab
  JOIN ranged_actuals a ON
    a.year = ab.addback_year
    AND (
      (ab.scope = 'category'                          AND a.category    = ab.line_item_key)
      OR (ab.scope IN ('line_item', 'month_cell')     AND a.subcategory = ab.line_item_key)
    )
    AND (ab.scope <> 'month_cell' OR a.month = ab.addback_month)
),
addback_inrange_total AS (
  SELECT addback_id, SUM(actual_amount) AS inrange_sum
  FROM addback_matched_inrange
  GROUP BY addback_id
),
addback_delta AS (
  SELECT
    ab.id              AS addback_id,
    ab.line_item_key,
    ab.scope,
    ab.addback_year,
    ab.addback_month,
    ab.category        AS stored_category,
    COALESCE(ar.replacement_sum, 0) AS replacement_sum,
    ao.original_sum,
    CASE
      WHEN LOWER(COALESCE(ab.category, ao.first_category, '')) = 'revenue'
        THEN COALESCE(ar.replacement_sum, 0) - ao.original_sum
      ELSE
        ao.original_sum - COALESCE(ar.replacement_sum, 0)
    END                AS delta,
    COALESCE(it.inrange_sum, 0) AS inrange_sum
  FROM active_addbacks ab
  LEFT JOIN addback_replacement   ar ON ar.addback_id = ab.id
  LEFT JOIN addback_original      ao ON ao.addback_id = ab.id
  LEFT JOIN addback_inrange_total it ON it.addback_id = ab.id
  WHERE ao.original_sum IS NOT NULL
),
applied_per_row AS (
  SELECT
    am.actual_id,
    ad.addback_id,
    ad.line_item_key,
    ad.scope,
    ad.addback_year,
    ad.addback_month,
    ad.stored_category,
    ad.replacement_sum,
    ad.original_sum,
    ad.delta,
    CASE WHEN ad.inrange_sum > 0
      THEN (am.actual_amount / ad.inrange_sum) * ad.delta
      ELSE 0
    END AS row_share
  FROM addback_matched_inrange am
  JOIN addback_delta ad ON ad.addback_id = am.addback_id
),
row_adjustments AS (
  SELECT
    actual_id,
    SUM(row_share) AS total_share,
    json_agg(json_build_object(
      'addbackId',              addback_id,
      'lineItemKey',            line_item_key,
      'scope',                  scope,
      'category',               COALESCE(stored_category, ''),
      'year',                   addback_year,
      'month',                  addback_month,
      'replacementAmount',      replacement_sum,
      'originalAmountAtLookup', original_sum,
      'delta',                  row_share
    ) ORDER BY addback_id) AS applied_addbacks
  FROM applied_per_row
  GROUP BY actual_id
)
SELECT
  ra.id,
  ra.year,
  ra.month,
  ra.period_type,
  ra.category,
  ra.subcategory,
  ra.department,
  ra.line_item_description,
  ra.amount::numeric AS base_amount,
  COALESCE(rj.total_share, 0)::numeric                  AS row_delta,
  (ra.amount::numeric + COALESCE(rj.total_share, 0))::numeric AS adjusted_amount,
  COALESCE(rj.applied_addbacks, '[]'::json)             AS applied_addbacks
FROM ranged_actuals ra
LEFT JOIN row_adjustments rj ON rj.actual_id = ra.id
ORDER BY ra.year, ra.month, ra.category, ra.subcategory, ra.line_item_description NULLS FIRST
`;

// INVARIANT — keep dedupe + scope-match logic in sync with MAIN_QUERY.
// Both queries must derive the same active-addback ↔ actuals join shape so
// the unmatched-addback set is consistent. Any change here (dedupe rule,
// scope predicates, year-range filter) MUST be mirrored in MAIN_QUERY.
const UNMATCHED_QUERY = `
WITH active_addbacks AS (
  SELECT id, line_item_key, scope, addback_year, addback_month
  FROM modeling_addbacks
  WHERE project_id = $1 AND org_id = $2 AND is_active = true
),
year_full_coverage AS (
  SELECT modeling_project_id, year
  FROM modeling_actuals
  WHERE modeling_project_id = $1 AND org_id = $2 AND period_type = 'month'
    -- Defensive year-range filter — see project_actuals_year_glitch.md
    AND year BETWEEN 1900 AND 2200
  GROUP BY modeling_project_id, year
  HAVING COUNT(DISTINCT month) = 12
),
deduped_actuals AS (
  SELECT a.*
  FROM modeling_actuals a
  WHERE a.modeling_project_id = $1 AND a.org_id = $2
    -- Defensive year-range filter — see project_actuals_year_glitch.md
    AND a.year BETWEEN 1900 AND 2200
    AND (
      a.period_type IN ('month', 'quarter')
      OR (a.period_type = 'year' AND NOT EXISTS (
        SELECT 1 FROM year_full_coverage f
        WHERE f.modeling_project_id = a.modeling_project_id
          AND f.year = a.year
      ))
    )
)
SELECT ab.id AS addback_id, ab.line_item_key
FROM active_addbacks ab
WHERE NOT EXISTS (
  SELECT 1 FROM deduped_actuals a
  WHERE a.year = ab.addback_year
    AND (
      (ab.scope = 'category'                      AND a.category    = ab.line_item_key)
      OR (ab.scope IN ('line_item', 'month_cell') AND a.subcategory = ab.line_item_key)
    )
    AND (ab.scope <> 'month_cell' OR a.month = ab.addback_month)
)
`;

interface MainRow {
  id: string;
  year: number;
  month: number;
  period_type: PeriodType;
  category: string;
  subcategory: string;
  department: string | null;
  line_item_description: string | null;
  base_amount: string;
  row_delta: string;
  adjusted_amount: string;
  applied_addbacks: AppliedAddback[];
}

function toMonthlyRow(r: MainRow): AdjustedActualRow {
  const baseAmount = Number(r.base_amount);
  const adjustedAmount = Number(r.adjusted_amount);
  const adjustmentDelta = Number(r.row_delta);
  return {
    year: r.year,
    month: r.month,
    periodType: r.period_type,
    category: r.category,
    subcategory: r.subcategory,
    department: r.department,
    lineItemDescription: r.line_item_description,
    baseAmount,
    adjustedAmount,
    adjustmentDelta,
    appliedAddbacks: r.applied_addbacks.map((a) => ({
      addbackId: a.addbackId,
      lineItemKey: a.lineItemKey,
      scope: a.scope,
      category: a.category,
      year: a.year,
      month: a.month,
      replacementAmount: Number(a.replacementAmount),
      originalAmountAtLookup:
        a.originalAmountAtLookup === null ? null : Number(a.originalAmountAtLookup),
      delta: Number(a.delta),
    })),
  };
}

/**
 * Aggregates monthly rows into one row per (year, category, subcategory,
 * lineItemDescription). Annual rows carry month=1 and periodType='year' as
 * canonical placeholders. AppliedAddback entries are deduped by addbackId
 * and `delta` is summed across the year (giving the addback's full
 * year-level delta when all matched months roll into the annual row).
 *
 * IMPORTANT for consumers: month=1 here is a placeholder, NOT a real
 * January reading. Discriminate annual vs monthly rows by `periodType`
 * ('year' vs 'month'), never by `month`. Treating month=1 as January data
 * will silently double-count or misplace year totals.
 */
function rollUpToAnnual(rows: AdjustedActualRow[]): AdjustedActualRow[] {
  const groups = new Map<string, AdjustedActualRow>();
  for (const row of rows) {
    const key = [
      row.year,
      row.category,
      row.subcategory,
      row.lineItemDescription ?? '',
    ].join('|');
    const existing = groups.get(key);
    if (!existing) {
      groups.set(key, {
        year: row.year,
        month: 1,
        periodType: 'year',
        category: row.category,
        subcategory: row.subcategory,
        department: row.department,
        lineItemDescription: row.lineItemDescription,
        baseAmount: row.baseAmount,
        adjustedAmount: row.adjustedAmount,
        adjustmentDelta: row.adjustmentDelta,
        appliedAddbacks: row.appliedAddbacks.map((a) => ({ ...a })),
      });
      continue;
    }
    existing.baseAmount += row.baseAmount;
    existing.adjustedAmount += row.adjustedAmount;
    existing.adjustmentDelta += row.adjustmentDelta;
    for (const incoming of row.appliedAddbacks) {
      const match = existing.appliedAddbacks.find(
        (a) => a.addbackId === incoming.addbackId,
      );
      if (!match) {
        existing.appliedAddbacks.push({ ...incoming });
      } else {
        match.delta += incoming.delta;
      }
    }
  }
  return Array.from(groups.values()).sort((a, b) =>
    a.year - b.year ||
    a.category.localeCompare(b.category) ||
    a.subcategory.localeCompare(b.subcategory) ||
    (a.lineItemDescription ?? '').localeCompare(b.lineItemDescription ?? ''),
  );
}

export async function getAdjustedActuals(
  orgId: string,
  projectId: string,
  options: AdjustedActualsOptions = {},
): Promise<GetAdjustedActualsResult> {
  const range = resolveRange(options);
  const granularity = options.granularity ?? 'monthly';
  const includeUnmatched = options.includeUnmatched ?? true;

  const mainResult = await pool.query<MainRow>(MAIN_QUERY, [
    projectId,
    orgId,
    range.startYear,
    range.startMonth,
    range.endYear,
    range.endMonth,
  ]);

  let rows = mainResult.rows.map(toMonthlyRow);
  if (granularity === 'annual') rows = rollUpToAnnual(rows);

  let unmatchedAddbacks: UnmatchedAddback[] = [];
  if (includeUnmatched) {
    const unmatchedResult = await pool.query<{
      addback_id: string;
      line_item_key: string;
    }>(UNMATCHED_QUERY, [projectId, orgId]);
    unmatchedAddbacks = unmatchedResult.rows.map((r) => ({
      addbackId: r.addback_id,
      lineItemKey: r.line_item_key,
      reason: 'no_match' as const,
    }));
  }

  return { rows, unmatchedAddbacks };
}
