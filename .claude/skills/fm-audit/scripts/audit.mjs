// MarinaMatch Financial Model Audit Harness
// Senior-analyst test scenarios with hand-verified expected values.
// Exits non-zero if any scenario fails.

import { calculateXIRR, calculateNPV, calculateEquityMultiple } from '/home/runner/workspace/shared/finance/xirr.ts';
import { calculateXIRR as legacyXIRR, calculateMOIC } from '/home/runner/workspace/shared/exit/irr-calculator.ts';
import { calculateWaterfall } from '/home/runner/workspace/shared/exit/waterfall-engine.ts';
import { computeMultiYearProjection } from '/home/runner/workspace/server/services/multi-year-projection-engine.ts';

const results = [];
function check(name, actual, expected, tolerance = 0.01, ctx = '') {
  const pass = Math.abs(actual - expected) <= tolerance;
  results.push({ name, actual, expected, pass, ctx });
  console.log(`[${pass ? 'PASS' : 'FAIL'}] ${name}: actual=${actual?.toFixed?.(6) ?? actual}  expected=${expected}  ${ctx}`);
}

// ── XIRR ────────────────────────────────────────────────────────────────────
console.log('\n=== XIRR ===');
{
  const flows = [
    { date: '2026-01-01', amount: -1_000_000 },
    { date: '2027-01-01', amount: 100_000 },
    { date: '2028-01-01', amount: 100_000 },
    { date: '2029-01-01', amount: 100_000 },
    { date: '2030-01-01', amount: 100_000 },
    { date: '2031-01-01', amount: 1_400_000 },
  ];
  check('XIRR 5-yr stream', calculateXIRR(flows).irr, 14.4965, 0.001);
}
{
  // J-curve: requires bisection fallback
  const flows = [
    { date: '2026-01-01', amount: -2_000_000 },
    { date: '2027-01-01', amount: -2_000_000 },
    { date: '2028-01-01', amount: -1_000_000 },
    { date: '2031-01-01', amount: 20_000_000 },
  ];
  const r = calculateXIRR(flows);
  check('J-curve XIRR converges', r.converged ? 1 : 0, 1);
  check('J-curve XIRR ≈ 38.17%', r.irr, 38.1747, 0.05);
}
{
  // Sub-1-yr fractional
  const flows = [
    { date: '2026-01-01', amount: -1_000_000 },
    { date: '2026-07-01', amount: 1_100_000 },
  ];
  check('XIRR 6-mo flip ≈ 21%', calculateXIRR(flows).irr, 21.21, 0.5);
}
{
  // Legacy XIRR delegation (decimal format)
  const flows = [
    { date: new Date('2026-01-01'), amount: -1_000_000 },
    { date: new Date('2027-01-01'), amount: 1_140_000 },
  ];
  check('Legacy XIRR delegates to canonical', legacyXIRR(flows), 0.1401, 0.001);
}

// ── Waterfall Scenario A: 8-pref, 80/20, no catch-up ────────────────────────
console.log('\n=== Waterfall A — 8-pref/80-20/no-catchup ===');
{
  const r = calculateWaterfall({
    totalProceeds: 20_000_000,
    totalCapitalContributed: 10_000_000,
    holdingPeriodYears: 5,
    structureType: 'european',
    preferredReturn: 0.08,
    preferredReturnCompounding: 'annual',
    catchUpPercentage: 0,
    catchUpTarget: 0.20,
    carriedInterest: 0.20,
    lpSplit: 0.80,
    gpSplit: 0.20,
    gpCommitmentPct: 0.02,
    investmentDate: '2026-01-01',
  });
  check('A — Pref required (LP base)', r.preferredReturnPaid, 4_599_415.15, 1.0);
  check('A — LP MOIC ≈ 1.910', r.lpMoic, 1.9102, 0.001);
  check('A — Total LP', r.lpTotalDistribution, 18_719_883.03, 5.0);
  check('A — Total GP', r.gpTotalDistribution, 1_280_116.97, 5.0);
}

// ── Waterfall Scenario B: 100% catch-up ─────────────────────────────────────
console.log('\n=== Waterfall B — 100% catch-up to 20% ===');
{
  const r = calculateWaterfall({
    totalProceeds: 20_000_000,
    totalCapitalContributed: 10_000_000,
    holdingPeriodYears: 5,
    structureType: 'european',
    preferredReturn: 0.08,
    preferredReturnCompounding: 'annual',
    catchUpPercentage: 1.0,
    catchUpTarget: 0.20,
    carriedInterest: 0.20,
    lpSplit: 0.80,
    gpSplit: 0.20,
    gpCommitmentPct: 0.02,
    investmentDate: '2026-01-01',
  });
  check('B — Catch-up paid', r.catchUpPaid, 1_149_853.79, 5.0);
  // Profit split should be exactly 80/20 of $10M
  const lpProfit = r.lpTotalDistribution - 9_800_000;
  const gpProfit = r.gpTotalDistribution - 200_000;
  check('B — LP profit = 80% of $10M', lpProfit, 8_000_000, 5.0);
  check('B — GP profit = 20% of $10M', gpProfit, 2_000_000, 5.0);
  check('B — GP profit share exactly 20%', gpProfit / 10_000_000, 0.20, 0.0001);
}

// ── Waterfall Scenario C: at-cost (no profit) ───────────────────────────────
console.log('\n=== Waterfall C — at-cost ===');
{
  const r = calculateWaterfall({
    totalProceeds: 10_000_000,
    totalCapitalContributed: 10_000_000,
    holdingPeriodYears: 5,
    structureType: 'european',
    preferredReturn: 0.08,
    preferredReturnCompounding: 'annual',
    catchUpPercentage: 0,
    catchUpTarget: 0.20,
    carriedInterest: 0.20,
    lpSplit: 0.80,
    gpSplit: 0.20,
    gpCommitmentPct: 0.02,
    investmentDate: '2026-01-01',
  });
  check('C — No pref paid', r.preferredReturnPaid, 0, 1.0);
  check('C — No GP carry', r.gpTotalDistribution - 200_000, 0, 1.0);
  check('C — LP capital returned', r.lpTotalDistribution, 9_800_000, 1.0);
  check('C — GP capital returned', r.gpTotalDistribution, 200_000, 1.0);
}

// ── Pro-forma projection ────────────────────────────────────────────────────
console.log('\n=== Pro-forma projection ===');
{
  const year1 = {
    totalRevenue: 1_000_000, totalExpenses: 600_000, noi: 400_000,
    effectiveGrossIncome: 1_000_000,
    revenueLines: [{ key: 'gpr', label: 'GPR', category: 'revenue', amount: 1_000_000, formula: '' }],
    expenseLines: [{ key: 'opex', label: 'OpEx', category: 'expense', amount: 600_000, formula: '' }],
    monthlyBreakdown: Array.from({ length: 12 }, (_, i) => ({
      revenue: 1_000_000/12, expenses: 600_000/12, noi: 400_000/12,
      daysInMonth: [31,28,31,30,31,30,31,31,30,31,30,31][i], isSeasonal: false,
    })),
  };
  const proj = computeMultiYearProjection(year1, {
    holdPeriod: 5, revenueGrowthRate: 0.03, expenseGrowthRate: 0.025,
    exitCapRate: 0.07, sellingCostPct: 0.03,
  });
  check('Y5 revenue (3% × 4)', proj.years[4].totalRevenue, 1_125_508.81, 5.0);
  check('Y5 expenses (2.5% × 4)', proj.years[4].totalExpenses, 662_287.74, 5.0);
  check('Y5 NOI', proj.years[4].noi, 463_221.07, 10.0);
  check('Y5 exit value @7% cap', proj.exit.exitValue, 6_617_443.86, 100.0);
  check('Y5 net sale proceeds', proj.exit.netSaleProceeds, 6_418_920.54, 100.0);
  check('NOI CAGR (4-decimal precision)', proj.noiCAGR, 0.0374, 0.0001);
}

// ── Summary + exit code ─────────────────────────────────────────────────────
const passes = results.filter(r => r.pass).length;
const fails = results.filter(r => !r.pass).length;
console.log(`\n=== SUMMARY ===\nTotal: ${results.length}   Pass: ${passes}   Fail: ${fails}`);
if (fails > 0) {
  console.log('\nFAILURES:');
  for (const r of results.filter(r => !r.pass)) {
    console.log(`  ${r.name}: actual=${r.actual} expected=${r.expected}`);
  }
  process.exit(1);
}
process.exit(0);
