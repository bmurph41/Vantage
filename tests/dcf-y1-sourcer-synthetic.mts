/**
 * Synthetic-data verification for the gap-3 fix (DCF Y1 sourcing).
 *
 * Why synthetic? The only project that has the bug shape today
 * (54c1b93a — actuals present, inputs empty) carries corrupted year values
 * (3032/6064 — see [[actuals-year-glitch]]) that getConsolidatedPnL
 * defensively filters out, so it's unreachable to any engine. Synthetic data
 * lets us prove buildY1FromConsolidated handles valid actuals correctly
 * without relying on broken DB rows.
 *
 * Asserts:
 *   1. Empty / null input → null
 *   2. All-zero adjustedAmount across all years → null
 *   3. Valid actuals → DirectInputFinancials with flat-sum totals matching
 *      Σ adjustedAmount per category for the latest non-zero year
 *   4. Multi-year input → picks the latest non-zero year
 *   5. Revenue/expense category split is correct
 *   6. monthlyBreakdown is FLAT (no within-Y1 compounding) — proves
 *      deferred-(f) stays orthogonal
 *   7. Empty revenue + non-zero expenses still produces Y1 (the 54c1b93a
 *      shape if its years weren't corrupted)
 */

import { buildY1FromConsolidated } from '../server/services/dcf-y1-sourcer';
import type { ConsolidatedLineItem } from '@shared/types/consolidated-pnl';

let passed = 0;
let failed = 0;

function assert(cond: boolean, label: string, detail?: string) {
  if (cond) { console.log(`  ✓ ${label}`); passed++; }
  else { console.error(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`); failed++; }
}
function approx(a: number, b: number, eps = 0.01): boolean {
  return Math.abs(a - b) <= eps;
}

const mkLineItem = (
  category: string,
  subcategory: string,
  annual: Array<{ year: number; adjustedAmount: number; baseAmount?: number }>,
): ConsolidatedLineItem => ({
  lineItemKey: `${category}|${subcategory}||`,
  lineItemLabel: subcategory,
  category: category as any,
  subcategory,
  department: null,
  annual: annual.map(a => ({
    year: a.year,
    baseAmount: a.baseAmount ?? a.adjustedAmount,
    adjustedAmount: a.adjustedAmount,
    hasAdjustment: a.baseAmount != null && a.baseAmount !== a.adjustedAmount,
  })),
});

console.log('\n=== Case 1: null input → null ===');
assert(buildY1FromConsolidated(null) === null, 'null returns null');
assert(buildY1FromConsolidated(undefined) === null, 'undefined returns null');
assert(buildY1FromConsolidated({ lineItems: [] }) === null, 'empty lineItems returns null');

console.log('\n=== Case 2: all-zero adjustedAmount → null ===');
const allZero = buildY1FromConsolidated({
  lineItems: [
    mkLineItem('Revenue', 'GPR', [{ year: 2024, adjustedAmount: 0 }]),
    mkLineItem('Expenses', 'Utilities', [{ year: 2024, adjustedAmount: 0 }]),
  ],
});
assert(allZero === null, 'all-zero across years returns null');

console.log('\n=== Case 3: valid actuals → flat-sum totals ===');
const valid = buildY1FromConsolidated({
  lineItems: [
    mkLineItem('Revenue', 'Gross Potential Rent', [{ year: 2024, adjustedAmount: 100000 }]),
    mkLineItem('Revenue', 'Other Income', [{ year: 2024, adjustedAmount: 5000 }]),
    mkLineItem('Expenses', 'Utilities', [{ year: 2024, adjustedAmount: 12000 }]),
    mkLineItem('Expenses', 'Insurance', [{ year: 2024, adjustedAmount: 3000 }]),
  ],
});
assert(valid !== null, 'valid actuals returns Y1');
if (valid) {
  assert(approx(valid.totalRevenue, 105000), `totalRevenue=105000 (got ${valid.totalRevenue})`);
  assert(approx(valid.totalExpenses, 15000), `totalExpenses=15000 (got ${valid.totalExpenses})`);
  assert(approx(valid.noi, 90000), `noi=90000 (got ${valid.noi})`);
  assert(valid.revenueLines.length === 2, `2 revenue lines (got ${valid.revenueLines.length})`);
  assert(valid.expenseLines.length === 2, `2 expense lines (got ${valid.expenseLines.length})`);
}

console.log('\n=== Case 4: multi-year → picks latest non-zero ===');
const multiYear = buildY1FromConsolidated({
  lineItems: [
    mkLineItem('Revenue', 'GPR', [
      { year: 2022, adjustedAmount: 80000 },
      { year: 2023, adjustedAmount: 90000 },
      { year: 2024, adjustedAmount: 100000 },
    ]),
    mkLineItem('Expenses', 'Utilities', [
      { year: 2022, adjustedAmount: 10000 },
      { year: 2023, adjustedAmount: 11000 },
      { year: 2024, adjustedAmount: 12000 },
    ]),
  ],
});
assert(multiYear !== null, 'multi-year returns Y1');
if (multiYear) {
  assert(approx(multiYear.totalRevenue, 100000), `picks 2024 revenue (got ${multiYear.totalRevenue})`);
  assert(approx(multiYear.totalExpenses, 12000), `picks 2024 expenses (got ${multiYear.totalExpenses})`);
}

console.log('\n=== Case 5: latest year is zero, falls back to prior year ===');
const zeroLatest = buildY1FromConsolidated({
  lineItems: [
    mkLineItem('Revenue', 'GPR', [
      { year: 2023, adjustedAmount: 50000 },
      { year: 2024, adjustedAmount: 0 },
    ]),
  ],
});
assert(zeroLatest !== null, 'zero latest with non-zero prior returns Y1');
if (zeroLatest) {
  assert(approx(zeroLatest.totalRevenue, 50000), `picks 2023 (got ${zeroLatest.totalRevenue})`);
}

console.log('\n=== Case 6: category split — revenue vs expense ===');
const categorySplit = buildY1FromConsolidated({
  lineItems: [
    mkLineItem('revenue', 'lowercase Revenue', [{ year: 2024, adjustedAmount: 100 }]),
    mkLineItem('Revenue', 'PascalCase Revenue', [{ year: 2024, adjustedAmount: 200 }]),
    mkLineItem('Expenses', 'Expense line', [{ year: 2024, adjustedAmount: 50 }]),
    mkLineItem('COGS', 'COGS line', [{ year: 2024, adjustedAmount: 30 }]),
  ],
});
assert(categorySplit !== null, 'mixed-case categories returns Y1');
if (categorySplit) {
  assert(categorySplit.revenueLines.length === 2, `2 revenue lines (got ${categorySplit.revenueLines.length})`);
  assert(categorySplit.expenseLines.length === 2, `expense + COGS bucketed together (got ${categorySplit.expenseLines.length})`);
  assert(approx(categorySplit.totalRevenue, 300), `revenue=300 (got ${categorySplit.totalRevenue})`);
  assert(approx(categorySplit.totalExpenses, 80), `expenses=80 incl COGS (got ${categorySplit.totalExpenses})`);
}

console.log('\n=== Case 7: monthlyBreakdown is FLAT (deferred-f orthogonal) ===');
const flatCheck = buildY1FromConsolidated({
  lineItems: [
    mkLineItem('Revenue', 'GPR', [{ year: 2024, adjustedAmount: 365000 }]),
  ],
});
assert(flatCheck !== null, 'flat-check Y1 built');
if (flatCheck) {
  // 365k annual / 365 days = $1000/day. January has 31 days → $31,000.
  const jan = flatCheck.monthlyBreakdown.find(m => m.month === 'Jan');
  const feb = flatCheck.monthlyBreakdown.find(m => m.month === 'Feb');
  const dec = flatCheck.monthlyBreakdown.find(m => m.month === 'Dec');
  assert(jan !== undefined && approx(jan.revenue, 31000), `Jan flat = $31,000 (got ${jan?.revenue})`);
  assert(feb !== undefined && approx(feb.revenue, 28000), `Feb flat = $28,000 (got ${feb?.revenue})`);
  assert(dec !== undefined && approx(dec.revenue, 31000), `Dec flat = $31,000 (got ${dec?.revenue})`);
  // KEY ASSERTION: Jan and Dec are EQUAL → no within-Y1 compounding → flat
  assert(jan !== undefined && dec !== undefined && approx(jan.revenue, dec.revenue),
    `Jan === Dec revenue (no compounding — deferred-(f) orthogonal)`);
  // Sum across all months should equal annual total (allow rounding tolerance)
  const monthlySum = flatCheck.monthlyBreakdown.reduce((s, m) => s + m.revenue, 0);
  assert(approx(monthlySum, 365000, 1), `monthly sum = annual = $365,000 (got ${monthlySum})`);
}

console.log('\n=== Case 8: 54c1b93a-shape (expenses only, no revenue) — proves the bug-case data flows ===');
// Mirrors what 54c1b93a's data WOULD produce if its years weren't corrupted.
// Six expense subcategories at year=2024.
const bugShape = buildY1FromConsolidated({
  lineItems: [
    mkLineItem('Expenses', 'Insurance (annual)',      [{ year: 2024, adjustedAmount: 915 }]),
    mkLineItem('Expenses', 'Utilities',               [{ year: 2024, adjustedAmount: 11605 }]),
    mkLineItem('Expenses', 'Percentage Rent',         [{ year: 2024, adjustedAmount: 16800 }]),
    mkLineItem('Expenses', 'Other Income',            [{ year: 2024, adjustedAmount: 41104 }]),
    mkLineItem('Expenses', 'Maintenance & Repairs',   [{ year: 2024, adjustedAmount: 4919 }]),
    mkLineItem('Expenses', 'Marketing / Unit / Year', [{ year: 2024, adjustedAmount: 755 }]),
  ],
});
assert(bugShape !== null, '54c1b93a-shape returns Y1 (zero rev + non-zero exp ok)');
if (bugShape) {
  assert(bugShape.revenueLines.length === 0, 'zero revenue lines');
  assert(bugShape.expenseLines.length === 6, `6 expense lines (got ${bugShape.expenseLines.length})`);
  assert(approx(bugShape.totalRevenue, 0), `totalRevenue=0`);
  assert(approx(bugShape.totalExpenses, 76098), `totalExpenses=76098 (got ${bugShape.totalExpenses})`);
  assert(approx(bugShape.noi, -76098), `noi=-76098 (got ${bugShape.noi})`);
  console.log(`  → demo: if 54c1b93a's years weren't corrupted, DCF Y1 would now be NOI=$-76,098 (was $0)`);
}

console.log(`\n=== Summary: ${passed} passed, ${failed} failed ===`);
if (failed > 0) process.exit(1);
