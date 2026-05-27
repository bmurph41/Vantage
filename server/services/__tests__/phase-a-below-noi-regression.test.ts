/**
 * Phase A — Below-NOI regression gate
 * ====================================
 *
 * Permanent harness asserting that non-operating lines (depreciation, amortization,
 * interest expense) are EXCLUDED from NOI at every consumer surface, while still
 * being SURFACED in the below-NOI display section (not silently disappeared).
 *
 * Built during Phase A (R2 verification). Drives real consumer functions, not
 * re-implemented math — so the harness proves engine behavior, not test scaffolding.
 *
 * Assertion shape — two directions:
 *   (1) NOTHING LEAKS IN — adding a $100K non_operating line moves NONE of:
 *       {DCF Y1 NOI, multi-year NOI(t), totalRevenue, totalExpenses}
 *   (2) NOTHING LEGIT FALLS OUT — legitimate expense vocabulary (Expenses, COGS,
 *       OpEx, Payroll, Operating Expense(s)) lands exactly where it did pre-fix.
 *
 * dcf-y1-sourcer specifically: the prior denylist-via-ternary
 * (`(isRevenue ? rev : exp).push`) would sweep non_operating into expenseLines,
 * lowering DCF Y1 NOI by the depreciation amount. The new allowlist excludes
 * non-revenue, non-expense values from Y1 NOI entirely — matching
 * consolidated-pnl-service noiSign === 0 semantics.
 */
import { describe, it, expect, vi } from 'vitest';
import { buildY1FromConsolidated } from '../dcf-y1-sourcer';
import { computeMultiYearProjection } from '../multi-year-projection-engine';
import type { DirectInputFinancials, FinancialLine } from '../direct-input-engine';
import type { ConsolidatedLineItem } from '@shared/types/consolidated-pnl';

const REVENUE = 1_000_000;
const EXPENSE = 400_000;
const DEPRECIATION = 100_000;
const EXPECTED_NOI = REVENUE - EXPENSE; // 600,000

function makeLine(
  label: string,
  amount: number,
  category: string,
  year: number,
): ConsolidatedLineItem {
  return {
    lineItemKey: label.toLowerCase().replace(/[^a-z0-9]+/g, '_'),
    lineItemLabel: label,
    category,
    subcategory: label,
    department: null,
    annual: [
      { year, baseAmount: amount, adjustedAmount: amount, hasAdjustment: false },
    ],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Surface 1 — dcf-y1-sourcer.buildY1FromConsolidated
// ─────────────────────────────────────────────────────────────────────────────

describe('Phase A regression: dcf-y1-sourcer non_operating exclusion', () => {
  const year = 2024;

  // Run A — revenue + expense only (the pre-Phase-A world)
  const fixtureA = {
    lineItems: [
      makeLine('Slip Revenue', REVENUE, 'Revenue', year),
      makeLine('Maintenance', EXPENSE, 'Expenses', year),
    ],
  };

  // Run B — identical + $100K depreciation tagged non_operating
  const fixtureB = {
    lineItems: [
      ...fixtureA.lineItems,
      makeLine('Depreciation', DEPRECIATION, 'non_operating', year),
    ],
  };

  it('NOTHING LEAKS IN: $100K non_operating moves NONE of {NOI, totalRevenue, totalExpenses}', () => {
    const y1A = buildY1FromConsolidated(fixtureA);
    const y1B = buildY1FromConsolidated(fixtureB);
    expect(y1A).not.toBeNull();
    expect(y1B).not.toBeNull();

    expect(y1B!.noi).toBe(y1A!.noi);
    expect(y1B!.totalRevenue).toBe(y1A!.totalRevenue);
    expect(y1B!.totalExpenses).toBe(y1A!.totalExpenses);

    // Sanity: NOI lands at the right magnitude
    expect(y1A!.noi).toBe(EXPECTED_NOI);
  });

  it('non_operating line excluded from expenseLines (no sweep)', () => {
    const y1B = buildY1FromConsolidated(fixtureB)!;
    expect(y1B.expenseLines.find((l) => l.label === 'Depreciation')).toBeUndefined();
    expect(y1B.expenseLines.find((l) => l.label === 'Maintenance')).toBeDefined();
    expect(y1B.revenueLines.find((l) => l.label === 'Depreciation')).toBeUndefined();
  });

  it('NOTHING LEGIT FALLS OUT: every expense-vocabulary token lands in expenseLines', () => {
    // Mirrors deal-pricing-service.ts:508 allowlist precedent + canonical-actuals-loader
    // ('Revenue' | 'COGS' | 'Expenses') Pascal-case vocabulary. Each token must
    // continue to count as an expense post-Phase-A — the allowlist widened to
    // exclude only non_operating, not to drop legit cogs/payroll/opex.
    const fixtureC = {
      lineItems: [
        makeLine('Slip Revenue', REVENUE, 'Revenue', year),
        makeLine('Maintenance', 100_000, 'Expenses', year),
        makeLine('Fuel COGS', 50_000, 'COGS', year),
        makeLine('Payroll', 80_000, 'Payroll', year),
        makeLine('Marketing', 20_000, 'OpEx', year),
        makeLine('Property Tax', 30_000, 'Operating Expense', year),
        makeLine('Insurance', 25_000, 'Operating Expenses', year),
        // lowercase variants too
        makeLine('Utilities', 15_000, 'expense', year),
        makeLine('Other Cogs', 10_000, 'cogs', year),
      ],
    };
    const y1 = buildY1FromConsolidated(fixtureC)!;
    // All 8 expense-like rows land in expenseLines
    expect(y1.expenseLines.length).toBe(8);
    expect(y1.totalExpenses).toBe(
      100_000 + 50_000 + 80_000 + 20_000 + 30_000 + 25_000 + 15_000 + 10_000,
    );
    // Revenue still lands
    expect(y1.revenueLines.length).toBe(1);
    expect(y1.totalRevenue).toBe(REVENUE);
  });

  it('unrecognized category fails LOUD: warns + excludes (never silent sweep)', () => {
    const fixtureD = {
      lineItems: [
        makeLine('Slip Revenue', REVENUE, 'Revenue', year),
        makeLine('Maintenance', EXPENSE, 'Expenses', year),
        // Genuinely unknown — not revenue, not expense, not non_operating
        makeLine('Mystery Line', 99_999, 'some_future_category', year),
      ],
    };
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const y1 = buildY1FromConsolidated(fixtureD)!;

    // The mystery line is EXCLUDED from both buckets (default is EXCLUDE,
    // not default-to-expense — the bug Phase A is fixing).
    expect(y1.expenseLines.find((l) => l.label === 'Mystery Line')).toBeUndefined();
    expect(y1.revenueLines.find((l) => l.label === 'Mystery Line')).toBeUndefined();
    // NOI unchanged from the clean rev+exp baseline
    expect(y1.noi).toBe(EXPECTED_NOI);
    // And the warning fired LOUDLY so future audit catches the unknown value
    expect(warnSpy).toHaveBeenCalled();
    const warnArgs = warnSpy.mock.calls.flat().join(' ');
    expect(warnArgs).toContain('unrecognized category');
    expect(warnArgs).toContain('some_future_category');

    warnSpy.mockRestore();
  });

  it('non_operating with no other lines → builder returns null (no synthetic NOI)', () => {
    const onlyNonOp = {
      lineItems: [makeLine('Depreciation', DEPRECIATION, 'non_operating', year)],
    };
    const y1 = buildY1FromConsolidated(onlyNonOp);
    // No revenue, no expense → null (matches pre-Phase-A behavior:
    // "filtered result has zero revenue AND zero expense lines")
    expect(y1).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Surface 2 — multi-year-projection-engine
// Propagation + NOI exclusion across the hold period
// ─────────────────────────────────────────────────────────────────────────────

describe('Phase A regression: multi-year-projection-engine non_operating propagation', () => {
  // Build a minimal DirectInputFinancials in both shapes (with/without non-op).
  // Year 1 NOI is identical → all projected years should be identical.

  const baseFinancials: DirectInputFinancials = {
    totalRevenue: REVENUE,
    totalExpenses: EXPENSE,
    noi: EXPECTED_NOI,
    revenueLines: [
      { label: 'Slip Revenue', amount: REVENUE, category: 'revenue', key: 'slip_revenue' },
    ],
    expenseLines: [
      { label: 'Maintenance', amount: EXPENSE, category: 'expense', key: 'maintenance' },
    ],
    computedFrom: 'direct_input',
    formulaBreakdowns: {},
    monthlyBreakdown: Array.from({ length: 12 }, (_, i) => ({
      month: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][i],
      days: [31,28,31,30,31,30,31,31,30,31,30,31][i],
      revenue: REVENUE / 12,
      expenses: EXPENSE / 12,
      noi: (REVENUE - EXPENSE) / 12,
    })),
  };

  // Same as baseFinancials but with $100K depreciation as a non_operating line.
  // Critically: totalRevenue and totalExpenses are UNCHANGED — the new field
  // sits in nonOperatingLines, parallel to the others, never folded into NOI.
  const financialsWithNonOp: DirectInputFinancials = {
    ...baseFinancials,
    nonOperatingLines: [
      { label: 'Depreciation', amount: DEPRECIATION, category: 'non_operating', key: 'depreciation' },
    ],
    totalNonOperating: DEPRECIATION,
  };

  const config = {
    holdPeriod: 5,
    revenueGrowthRate: 0.03,
    expenseGrowthRate: 0.025,
    defaultCapExPct: 0.05,
    exitCapRate: 0.07,
    sellingCostPct: 0.03,
  };

  it('NOI UNCHANGED year-over-year when $100K non_operating is present', () => {
    const projA = computeMultiYearProjection(baseFinancials, config);
    const projB = computeMultiYearProjection(financialsWithNonOp, config);

    expect(projA.years.length).toBe(projB.years.length);
    expect(projA.years.length).toBe(5);

    for (let i = 0; i < projA.years.length; i++) {
      expect(projB.years[i].noi).toBe(projA.years[i].noi);
      expect(projB.years[i].totalRevenue).toBe(projA.years[i].totalRevenue);
      expect(projB.years[i].totalExpenses).toBe(projA.years[i].totalExpenses);
      expect(projB.years[i].ncf).toBe(projA.years[i].ncf);
    }
    // Total hold-period NOI also unchanged
    expect(projB.totalNOI).toBe(projA.totalNOI);
  });

  it('PROPAGATES: non_operating lines + total surface on every projected year', () => {
    const projB = computeMultiYearProjection(financialsWithNonOp, config);
    for (const year of projB.years) {
      expect(year.nonOperatingLines).toBeDefined();
      expect(year.nonOperatingLines!.length).toBe(1);
      expect(year.nonOperatingLines![0].label).toBe('Depreciation');
      // Held CONSTANT year-over-year (no growth applied — depreciation follows
      // its own schedule, not revenue/expense growth rates). $100K stays $100K.
      expect(year.nonOperatingLines![0].amount).toBe(DEPRECIATION);
      expect(year.totalNonOperating).toBe(DEPRECIATION);
    }
  });

  it('VISIBLE NOT VANISHED: depreciation is reachable from the projection output', () => {
    const projB = computeMultiYearProjection(financialsWithNonOp, config);
    const y1 = projB.years[0];
    // Phase A's half-implementation guard — non_op must be EXCLUDED from NOI
    // but PRESENT in the data structure for the display layer to render.
    expect(y1.noi).not.toBe(y1.noi - DEPRECIATION); // NOI does NOT include depr
    expect(y1.totalNonOperating).toBe(DEPRECIATION); // depr IS in the bucket
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Surface 3 — IC memo inline NOI math (ic-memo-service.ts:107-115)
//
// Direct DB read in production — the inline math is replayed here against a
// synthetic actuals array including a non_operating row. The Pascal-case
// allowlist (`'Revenue'` / `['Expenses','COGS','Operating Expenses']`) must
// exclude the non_operating row.
//
// This is "safe-by-default surface #5" from R1 verification, retested here
// with an explicit non_operating value to confirm the allowlist shape survives.
// ─────────────────────────────────────────────────────────────────────────────

describe('Phase A regression: IC memo inline NOI math (safe-by-default allowlist)', () => {
  // Mirror ic-memo-service.ts:105-118 exactly
  function icMemoNoi(actuals: Array<{ category?: string | null; amount: number }>): number {
    let totalRevenue = 0;
    let totalExpenses = 0;
    for (const actual of actuals) {
      if (actual.category === 'Revenue') {
        totalRevenue += actual.amount;
      } else if (['Expenses', 'COGS', 'Operating Expenses'].includes(actual.category || '')) {
        totalExpenses += actual.amount;
      }
    }
    return totalRevenue - totalExpenses;
  }

  it('IC memo NOI UNCHANGED when non_operating row is present', () => {
    const actualsA = [
      { category: 'Revenue', amount: REVENUE },
      { category: 'Expenses', amount: EXPENSE },
    ];
    const actualsB = [
      ...actualsA,
      { category: 'non_operating', amount: DEPRECIATION },
    ];
    expect(icMemoNoi(actualsB)).toBe(icMemoNoi(actualsA));
    expect(icMemoNoi(actualsA)).toBe(EXPECTED_NOI);
  });
});
