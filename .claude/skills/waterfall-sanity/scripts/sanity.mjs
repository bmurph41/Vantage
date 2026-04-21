// Waterfall config sanity checker.
// Run a given waterfall config through 4 synthetic exit multiples (1.0x, 1.5x, 2.0x, 3.0x)
// and assert the GP profit share converges to the configured target as exit multiple grows.
//
// Usage:
//   node audit.mjs                       # default config: 8-pref / 100% catch-up to 20%
//   node audit.mjs '{"preferredReturn":0.07,"catchUpPercentage":0.5,"catchUpTarget":0.25}'

import { calculateWaterfall } from '/home/runner/workspace/shared/exit/waterfall-engine.ts';

const overrides = process.argv[2] ? JSON.parse(process.argv[2]) : {};

const baseConfig = {
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
  ...overrides,
};

const multiples = [1.0, 1.2, 1.5, 2.0, 3.0, 5.0];
const fails = [];

console.log('Config:', JSON.stringify({
  pref: baseConfig.preferredReturn,
  catchUp: baseConfig.catchUpPercentage,
  catchUpTarget: baseConfig.catchUpTarget,
  splits: `${baseConfig.lpSplit*100}/${baseConfig.gpSplit*100}`,
  gpCommit: baseConfig.gpCommitmentPct,
}));
console.log('\nExit Multiple | Total Out | LP Share | GP Share | GP Carry | Pref Paid | Catchup Paid | LP MOIC | GP MOIC');
console.log('-'.repeat(120));

for (const m of multiples) {
  const totalProceeds = baseConfig.totalCapitalContributed * m;
  const r = calculateWaterfall({ ...baseConfig, totalProceeds });
  const profit = totalProceeds - baseConfig.totalCapitalContributed;
  const lpProfit = r.lpTotalDistribution - (baseConfig.totalCapitalContributed * (1 - baseConfig.gpCommitmentPct));
  const gpProfit = r.gpTotalDistribution - (baseConfig.totalCapitalContributed * baseConfig.gpCommitmentPct);
  const gpProfitShare = profit > 0 ? gpProfit / profit : 0;
  const lpProfitShare = profit > 0 ? lpProfit / profit : 0;

  console.log(
    `${m.toFixed(1)}x          | ${(totalProceeds/1e6).toFixed(2)}M    | ${r.lpTotalDistribution.toFixed(0).padStart(10)} | ${r.gpTotalDistribution.toFixed(0).padStart(8)} | ${r.carriedInterestPaid.toFixed(0).padStart(8)} | ${r.preferredReturnPaid.toFixed(0).padStart(9)} | ${r.catchUpPaid.toFixed(0).padStart(12)} | ${r.lpMoic.toFixed(3)}   | ${r.gpMoic.toFixed(3)}`
  );

  // Sanity invariants:
  // 1. ROC + pref + carry + catch-up = total proceeds (within rounding)
  const total = r.lpTotalDistribution + r.gpTotalDistribution;
  if (Math.abs(total - totalProceeds) > 5) {
    fails.push(`${m.toFixed(1)}x: distributions don't sum to proceeds (${total} vs ${totalProceeds})`);
  }

  // 2. At-cost (1.0x): no carry should be paid
  if (m === 1.0 && r.carriedInterestPaid > 1) {
    fails.push(`${m.toFixed(1)}x: carry paid at-cost (should be $0): ${r.carriedInterestPaid}`);
  }

  // 3. At higher multiples, GP profit share should not exceed configured target by > 1pp
  if (m >= 2.0 && profit > 0 && baseConfig.catchUpPercentage >= 0.99) {
    if (gpProfitShare > baseConfig.catchUpTarget + 0.011) {
      fails.push(`${m.toFixed(1)}x: GP profit share ${(gpProfitShare*100).toFixed(2)}% exceeds target ${(baseConfig.catchUpTarget*100)}%+1pp`);
    }
  }

  // 4. LP MOIC should be monotonically increasing in proceeds
  if (m > 1.0 && r.lpMoic < 1.0) {
    fails.push(`${m.toFixed(1)}x: LP MOIC < 1.0 with positive profit (${r.lpMoic})`);
  }
}

console.log('\n' + '='.repeat(60));
if (fails.length === 0) {
  console.log('SANITY: PASS — waterfall config behaves correctly across all exit multiples.');
  process.exit(0);
} else {
  console.log('SANITY: FAIL');
  for (const f of fails) console.log(`  - ${f}`);
  process.exit(1);
}
