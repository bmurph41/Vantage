/**
 * G4 Consolidated Multi-Period P&L — API contract types
 *
 * Shared between the consolidated-view endpoint
 * (server/routes/modeling-routes.ts) and the getAdjustedActuals service
 * (Phase 1.4) on the server, and the consolidated-view UI on the client.
 *
 * Replacement semantics — fixed in Phase 1.2.5 (commit 91b8c6d0).
 * Addback values stored in modeling_addback_values REPLACE the original
 * line-item amounts; they are not additive. Sign convention for an
 * addback's contribution to NOI:
 *   - Expense / COGS lines: delta = originalSum - replacementSum
 *   - Revenue lines:        delta = replacementSum - originalSum
 * A positive delta always raises adjusted NOI; a negative delta lowers it.
 *
 * Live-lookup gap — addbacks reference modeling_actuals rows by
 * (line_item_key, year, month, scope). When that lookup misses (e.g. the
 * referenced line was deleted upstream, or the addback was authored against
 * a period the actuals never received), the original is unknown and the
 * delta cannot be computed. This module surfaces that case explicitly via
 * AppliedAddback.originalAmountAtLookup === null and via
 * ConsolidatedPnLResponse.unmatchedAddbacks so UI can warn users.
 */

// ---------------------------------------------------------------------------
// Primitive unions
// ---------------------------------------------------------------------------

export type AdjustmentMasterState = 'all_on' | 'all_off' | 'custom';

export type AddbackScope = 'line_item' | 'month_cell' | 'category';

export type ProjectionHandling = 'auto' | 'manual' | 'gap';

export type PnLCategory = 'Revenue' | 'COGS' | 'Expenses' | 'Other';

export type PeriodType = 'month' | 'year' | 'quarter';

export type PnLViewMode = 'raw' | 'adjusted';

/** Inclusive bound for a calendar (year, month) range filter. */
export interface PeriodPoint {
  year: number;
  /** 1–12. */
  month: number;
}

// ---------------------------------------------------------------------------
// AppliedAddback
//
// One concrete addback application against a specific period. Produced by
// getAdjustedActuals during the live-lookup pass; embedded in
// ConsolidatedPnLResponse so the UI can surface per-line provenance.
// ---------------------------------------------------------------------------

export interface AppliedAddback {
  addbackId: string;
  lineItemKey: string;
  scope: AddbackScope;

  /**
   * Category of the matched actuals row (or the addback's stored category
   * when scope='category' and no actuals match exists). Drives the sign of
   * `delta` per the convention documented at the top of this file.
   */
  category: PnLCategory | string;

  year: number;
  /** null for annual rollups (period_type='year') and category-scope addbacks. */
  month: number | null;

  /**
   * Sum of modeling_addback_values rows for this addback, restricted to the
   * period covered by this application. This is the value that REPLACES the
   * original at the matched line.
   */
  replacementAmount: number;

  /**
   * Live-lookup result: the sum of modeling_actuals.amount for rows matched
   * by (line_item_key, year, [month], scope). null when the lookup found no
   * matching rows — graceful-degradation case; UI should warn.
   *
   * Recorded explicitly so callers can see the basis from which `delta` was
   * computed. When project_addback_original_anchoring lands (Tier 2 work
   * adding modeling_addback_values.original_amount_at_creation), this field
   * should prefer the stored basis when available and fall back to the live
   * lookup otherwise.
   */
  originalAmountAtLookup: number | null;

  /**
   * Signed contribution to NOI for this addback application. Sign convention:
   *   - Expense / COGS:  delta = originalAmountAtLookup - replacementAmount
   *   - Revenue:         delta = replacementAmount - originalAmountAtLookup
   * 0 when originalAmountAtLookup is null (no basis to compute against).
   */
  delta: number;
}

// ---------------------------------------------------------------------------
// AnnualAdjustmentGroup
//
// One year's NOI-level roll-up of all applied addbacks. The invariant
//   adjustedAmount = baseAmount + adjustmentDelta
// is exact when treating amounts as signed NOI contributions: revenue lines
// contribute positively, expense / COGS lines contribute negatively.
// ---------------------------------------------------------------------------

export interface AnnualAdjustmentGroup {
  year: number;

  /** Raw NOI for the year, before any addbacks are applied. */
  baseAmount: number;

  /** Adjusted NOI for the year. Equals baseAmount + adjustmentDelta. */
  adjustedAmount: number;

  /**
   * Net signed delta to NOI from all applied addbacks for the year.
   * Positive when adjustments raise NOI, negative when they lower it.
   *
   * Computed as:
   *   Σ(originalSum - replacementSum)  over expense / COGS lines
   * + Σ(replacementSum - originalSum)  over revenue lines
   *
   * Matches the Phase 1.2.5 sign convention used by the Exit Metrics
   * handler at server/routes/modeling-routes.ts:3434.
   */
  adjustmentDelta: number;

  appliedAddbacks: AppliedAddback[];
}

// ---------------------------------------------------------------------------
// Year metadata + line-item grid
// ---------------------------------------------------------------------------

export interface YearColumn {
  year: number;
  periodType: PeriodType;
  /** True when modeling_actuals coverage for the year is < 12 months. */
  isPartial: boolean;
  monthsCovered: number;
  /** Per-year projection-handling decision (modeling_projection_decisions). */
  handling: ProjectionHandling;
  needsReview: boolean;
}

export interface ConsolidatedYearCell {
  year: number;
  /** Raw line value before any addback adjustment. */
  baseAmount: number;
  /** Line value after replacement-semantic addback application. */
  adjustedAmount: number;
  hasAdjustment: boolean;
}

export interface ConsolidatedLineItem {
  lineItemKey: string;
  lineItemLabel: string;
  category: PnLCategory | string;
  subcategory: string;
  department: string | null;
  /** One entry per YearColumn in ConsolidatedPnLResponse.years, same order. */
  annual: ConsolidatedYearCell[];
}

// ---------------------------------------------------------------------------
// Unmatched addbacks
// ---------------------------------------------------------------------------

export interface UnmatchedAddback {
  addbackId: string;
  lineItemKey: string;
  reason: 'no_match';
}

// ---------------------------------------------------------------------------
// ConsolidatedPnLResponse — the consolidated-view endpoint payload
// ---------------------------------------------------------------------------

export interface ConsolidatedPnLRequest {
  projectId: string;
  yearRange?: { start: number; end: number };
  viewMode?: PnLViewMode;
}

export interface ConsolidatedPnLResponse {
  projectId: string;
  orgId: string;

  /** ISO 8601. Stamped server-side at response generation. */
  generatedAt: string;

  masterState: AdjustmentMasterState;

  /** Year columns in display order. */
  years: YearColumn[];

  /** P&L lines in display order; each carries year-by-year cells. */
  lineItems: ConsolidatedLineItem[];

  /** Per-year NOI-level roll-up. One entry per YearColumn, same order. */
  annualAdjustments: AnnualAdjustmentGroup[];

  /**
   * Addbacks that could not be applied because the live-lookup found no
   * matching modeling_actuals row. Surfaced so UI can render a warning
   * banner and prompt the user to delete the addback or fix the underlying
   * line-item key.
   */
  unmatchedAddbacks: UnmatchedAddback[];
}

// ---------------------------------------------------------------------------
// getAdjustedActuals — internal service contract (consumed by the
// consolidated-view endpoint and by the pro-forma projection engine).
// Phase 1.4 wires this up.
// ---------------------------------------------------------------------------

export interface AdjustedActualRow {
  year: number;
  /** 1–12 for monthly granularity; 1 (canonical anchor) for annual rollups. */
  month: number;
  periodType: PeriodType;
  category: PnLCategory | string;
  subcategory: string;
  department: string | null;
  lineItemDescription: string | null;

  /** Raw modeling_actuals.amount before any adjustment. */
  baseAmount: number;
  /** Raw amount after replacement-semantic addback application. */
  adjustedAmount: number;
  /**
   * adjustedAmount - baseAmount. Sum across all rows in a response equals
   * the sum of full year-level deltas of all addbacks that have at least
   * one matched row in the response range (proportional distribution
   * across in-range matched rows; see addback overlay note in the service
   * header).
   */
  adjustmentDelta: number;

  /**
   * Addbacks applied to this row, if any. Empty array when none matched.
   * `delta` field on each entry is the addback's row-level share for
   * monthly granularity, or the addback's full year-level delta for
   * annual granularity.
   */
  appliedAddbacks: AppliedAddback[];
}

export interface AdjustedActualsOptions {
  granularity?: 'monthly' | 'annual';
  /** Inclusive (year, month) range. Omit to return all available periods. */
  range?: { start: PeriodPoint; end: PeriodPoint };
  /** Default true. When false, the unmatchedAddbacks array is empty. */
  includeUnmatched?: boolean;
}

export interface GetAdjustedActualsResult {
  rows: AdjustedActualRow[];
  unmatchedAddbacks: UnmatchedAddback[];
}
