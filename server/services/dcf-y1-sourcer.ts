/**
 * DCF Y1 Sourcer — gap-3 fix (2026-05-24)
 * ========================================
 *
 * Closes the DCF/upload-mode divergence where DCF Y1 was always computed from
 * customMetrics.inputAssumptions regardless of mode, so any project with
 * uploaded actuals but no typed inputs got an empty/default DCF Y1 while PF
 * showed real numbers from getConsolidatedPnL.
 *
 * Design (decisions locked in Phase 0, 2026-05-24):
 *
 *   1. DATA-DRIVEN PRECEDENCE — not mode-label-driven.
 *      actuals present → use actuals
 *      else inputAssumptions present → use inputs (caller's existing path)
 *      else → empty
 *
 *   2. ROUTE I — direct getConsolidatedPnL read, flat annual sum.
 *      Deliberate: keeps deferred-(f) (PF within-Y1 monthly compounding vs
 *      DCF flat Y1, ~1.37% gap) ORTHOGONAL to this fix. The compounding
 *      mechanic stays queued; only the Y1 source changes.
 *
 *   3. SURGICAL — returns null when no usable actuals exist, so the caller
 *      falls back to its existing computeDirectInputFinancials path. The
 *      11 byte-identical projects + 4 empty→empty projects are untouched.
 *
 * Single live bug closes: project 54c1b93a-89ac-4a1b-adca-7a2dc1a4738e
 * (business class, upload mode, 12 actuals rows, no inputAssumptions).
 *
 * Related: [[gap-3-dcf-upload-blind]] (the bug), [[v3-non-marina-design-questions]]
 * (resolved companion). Deferred-(f) intentionally NOT addressed here.
 */

import { getConsolidatedPnL } from './consolidated-pnl-service';
import type {
  DirectInputFinancials,
  FinancialLine,
  MonthlyBreakdown,
} from './direct-input-engine';
import type { ConsolidatedLineItem } from '@shared/types/consolidated-pnl';

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DAYS_PER_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const DAYS_IN_YEAR = 365;

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'line';
}

/**
 * Pure transform: given a consolidated P&L result (or null), build a Y1
 * Financials-shaped object from the latest non-zero year's annual sums.
 *
 * Exported separately from the DB-fetching wrapper so it can be unit-tested
 * with synthetic data. The wrapper `buildY1FromActuals` does the DB fetch
 * then delegates here.
 *
 * Returns null when:
 *   - consolidated is null/undefined
 *   - lineItems array is empty
 *   - no year has any non-zero adjustedAmount across all line items
 *   - filtered result has zero revenue AND zero expense lines
 */
export function buildY1FromConsolidated(
  consolidated: { lineItems: ConsolidatedLineItem[] } | null | undefined,
): DirectInputFinancials | null {
  if (!consolidated?.lineItems?.length) return null;

  // Find the latest year that has any non-zero actuals.
  const yearTotals = new Map<number, number>();
  for (const li of consolidated.lineItems) {
    for (const cell of li.annual) {
      const cur = yearTotals.get(cell.year) ?? 0;
      yearTotals.set(cell.year, cur + Math.abs(cell.adjustedAmount));
    }
  }
  const candidateYears = Array.from(yearTotals.entries())
    .filter(([, total]) => total > 0)
    .sort(([a], [b]) => b - a);
  if (candidateYears.length === 0) return null;
  const latestYear = candidateYears[0][0];

  const revenueLines: FinancialLine[] = [];
  const expenseLines: FinancialLine[] = [];

  for (const li of consolidated.lineItems) {
    const cell = li.annual.find(c => c.year === latestYear);
    if (!cell || cell.adjustedAmount === 0) continue;

    const isRevenue = String(li.category ?? '').toLowerCase() === 'revenue';
    const label = li.lineItemLabel || li.subcategory || li.lineItemKey;
    const line: FinancialLine = {
      label,
      amount: cell.adjustedAmount,
      category: isRevenue ? 'revenue' : 'expense',
      key: slugify(li.subcategory || label),
    };
    (isRevenue ? revenueLines : expenseLines).push(line);
  }

  if (revenueLines.length === 0 && expenseLines.length === 0) return null;

  const totalRevenue = revenueLines.reduce((s, l) => s + l.amount, 0);
  const totalExpenses = expenseLines.reduce((s, l) => s + l.amount, 0);
  const noi = totalRevenue - totalExpenses;

  // Flat monthly breakdown — Route I. Day-fraction allocation only. No
  // within-Y1 compounding so deferred-(f) stays orthogonal.
  const monthlyBreakdown: MonthlyBreakdown[] = DAYS_PER_MONTH.map((days, m) => {
    const fraction = days / DAYS_IN_YEAR;
    return {
      month: MONTH_NAMES[m],
      days,
      revenue: Math.round(totalRevenue * fraction * 100) / 100,
      expenses: Math.round(totalExpenses * fraction * 100) / 100,
      noi: Math.round(noi * fraction * 100) / 100,
    };
  });

  return {
    totalRevenue,
    totalExpenses,
    noi,
    revenueLines,
    expenseLines,
    computedFrom: 'direct_input' as const,
    formulaBreakdowns: {},
    monthlyBreakdown,
  };
}

/**
 * DB-fetching wrapper: pulls consolidated P&L for (orgId, projectId), then
 * delegates to buildY1FromConsolidated. Returns null on any fetch error or
 * when actuals are absent/unusable — caller falls back to its existing
 * inputAssumptions-based path.
 */
export async function buildY1FromActuals(
  orgId: string,
  projectId: string,
): Promise<DirectInputFinancials | null> {
  try {
    const consolidated = await getConsolidatedPnL(orgId, projectId, { yearRange: 'calendar' });
    return buildY1FromConsolidated(consolidated);
  } catch {
    return null;
  }
}
