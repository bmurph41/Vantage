// Step A — V1 Marina Adapter Test (byte-identical regression shield)
//
// PURPOSE
//   Asserts that getProjectionLineValue's v1-marina branch returns
//   numerically identical results to the legacy
//   pro-forma-engine-service.ts:803-817 `getMarinaOccupancyAdjustment`
//   for the inputs the engine produces.
//
// ROLE
//   This is the SECOND gate behind dept-golden. Dept-golden proves
//   "no behavior change across the engine"; this test proves "the
//   calculator's v1-marina adapter is mathematically identical to the
//   legacy in-engine helper for inputs the engine generates."
//
//   It is intentionally narrower than dept-golden so a regression
//   localizes to one of two places: the adapter math itself (this test
//   catches it) or the engine wiring (dept-golden catches it).
//
// EXIT CODES
//   0 — all assertions pass
//   1 — any assertion fails

import { getProjectionLineValue } from '/home/runner/workspace/shared/coa/projection-calculator.ts';
import { getModelConfig } from '/home/runner/workspace/shared/asset-class-model-config.ts';

const modelConfig = getModelConfig('marina');

function assertNear(actual, expected, label, eps = 1e-12) {
  if (Math.abs(actual - expected) > eps) {
    console.error(`✗ FAIL: ${label}\n    expected=${expected}\n    actual=${actual}\n    diff=${actual - expected}`);
    process.exit(1);
  }
  console.log(`✓ ${label}  (${actual} ≈ ${expected})`);
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    console.error(`✗ FAIL: ${label}\n    expected=${expected}\n    actual=${actual}`);
    process.exit(1);
  }
  console.log(`✓ ${label}  (${actual})`);
}

console.log('=== V1 Marina Adapter — byte-identical regression shield ===\n');

// ─── Case 1: marina Storage with v1 data populated (real occupancy ratio) ───
{
  const result = getProjectionLineValue({
    assetClass: 'marina',
    department: 'Storage',
    lineKey: 'Wet Slip Rental',
    period: { year: 2027 },
    blob: null,
    modelConfig,
    y1Amount: 100_000,
    growthRates: { line: 0.03 },
    legacyV1Occupancy: { wet_slips: { '2024': 85, '2027': 90 } },
    latestHistoricalYear: 2024,
  });
  // Legacy marina helper formula: currentPct / basePct = 90/85
  assertNear(result._stepA_multiplier, 90 / 85, 'Case 1: ratio = 90/85');
  assertNear(result.amount, 100_000 * (90 / 85), 'Case 1: amount = y1 × ratio');
  assertEqual(result.appliedMechanic, 'driver_based', 'Case 1: driver_based');
  assertEqual(result.basisType, 'percent_of_capacity', 'Case 1: basisType=percent_of_capacity');
}

// ─── Case 2: marina Storage but no v1 data — must return 1 (today's no-op) ───
{
  const result = getProjectionLineValue({
    assetClass: 'marina',
    department: 'Storage',
    lineKey: 'Wet Slip Rental',
    period: { year: 2027 },
    blob: null,
    modelConfig,
    y1Amount: 100_000,
    growthRates: { line: 0.03 },
    legacyV1Occupancy: {}, // empty — the bug-state today
    latestHistoricalYear: 2024,
  });
  assertEqual(result._stepA_multiplier, 1, 'Case 2: empty v1 → multiplier=1');
  assertEqual(result.amount, 100_000, 'Case 2: amount unchanged');
}

// ─── Case 3: marina non-Storage department — must return 1 ───
{
  const result = getProjectionLineValue({
    assetClass: 'marina',
    department: 'Fuel',
    lineKey: 'Fuel Sales',
    period: { year: 2027 },
    blob: null,
    modelConfig,
    y1Amount: 50_000,
    growthRates: { line: 0.03 },
    legacyV1Occupancy: { wet_slips: { '2024': 85, '2027': 90 } },
    latestHistoricalYear: 2024,
  });
  // Cascade: marina.departmentRevenueModeDefaults.Fuel='driver_based',
  // but department !== 'Storage' so v1 adapter returns 1.
  assertEqual(result._stepA_multiplier, 1, 'Case 3: marina Fuel → multiplier=1');
  assertEqual(result.amount, 50_000, 'Case 3: Fuel amount unchanged');
}

// ─── Case 4: marina Storage with subcategory that does NOT resolve to a type ───
{
  const result = getProjectionLineValue({
    assetClass: 'marina',
    department: 'Storage',
    lineKey: 'Unrecognized Storage Line',
    period: { year: 2027 },
    blob: null,
    modelConfig,
    y1Amount: 25_000,
    growthRates: { line: 0.03 },
    legacyV1Occupancy: { wet_slips: { '2024': 85, '2027': 90 } },
    latestHistoricalYear: 2024,
  });
  // storageSubcategoryToTypeKey('Unrecognized Storage Line') → undefined → multiplier=1
  assertEqual(result._stepA_multiplier, 1, 'Case 4: unrecognized subcat → multiplier=1');
}

// ─── Case 5: marina Storage, base year occupancy missing (uses 85 default) ───
{
  const result = getProjectionLineValue({
    assetClass: 'marina',
    department: 'Storage',
    lineKey: 'Wet Slip Rental',
    period: { year: 2027 },
    blob: null,
    modelConfig,
    y1Amount: 100_000,
    growthRates: { line: 0.03 },
    legacyV1Occupancy: { wet_slips: { '2027': 90 } }, // no 2024 entry
    latestHistoricalYear: 2024,
  });
  // Legacy fallback: missing year defaults to 85. 90/85 again.
  assertNear(result._stepA_multiplier, 90 / 85, 'Case 5: missing base year → uses 85 default');
}

// ─── Case 6: marina Storage, current year occupancy missing (uses 85 default) ───
{
  const result = getProjectionLineValue({
    assetClass: 'marina',
    department: 'Storage',
    lineKey: 'Wet Slip Rental',
    period: { year: 2027 },
    blob: null,
    modelConfig,
    y1Amount: 100_000,
    growthRates: { line: 0.03 },
    legacyV1Occupancy: { wet_slips: { '2024': 80 } }, // no 2027 entry
    latestHistoricalYear: 2024,
  });
  // Legacy fallback: missing current year defaults to 85. 85/80.
  assertNear(result._stepA_multiplier, 85 / 80, 'Case 6: missing current year → uses 85 default');
}

// ─── Case 7: STR — degraded no-op (Step D-prime wires this) ───
{
  const strConfig = getModelConfig('str');
  const result = getProjectionLineValue({
    assetClass: 'str',
    department: 'Listings',
    lineKey: 'Nightly Rental',
    period: { year: 2027 },
    blob: null,
    modelConfig: strConfig,
    y1Amount: 100_000,
    growthRates: { line: 0.03 },
  });
  // Cascade: str.departmentRevenueModeDefaults.Listings='driver_based',
  // but blob=null + assetClass='str' → degraded no-op.
  assertEqual(result._stepA_multiplier, 1, 'Case 7: STR no-op multiplier=1');
  assertEqual(result._stepA_degradedToNoOp, true, 'Case 7: marked degraded');
}

// ─── Case 8: Office (flat_growth class) — multiplier=1, mechanic=flat_growth ───
{
  const officeConfig = getModelConfig('office');
  const result = getProjectionLineValue({
    assetClass: 'office',
    department: 'OperatingExpenses',
    lineKey: 'Utilities',
    period: { year: 2027 },
    blob: null,
    modelConfig: officeConfig,
    y1Amount: 50_000,
    growthRates: { line: 0.03 },
  });
  // Cascade: office.departmentRevenueModeDefaults.OperatingExpenses=undefined
  // → office.defaultRevenueMode='driver_based' (lease-based class)
  // → but blob=null and not marina → degraded no-op
  assertEqual(result._stepA_multiplier, 1, 'Case 8: office no-op multiplier=1');
}

// ─── Case 9: v3 fail-loud guard — must throw on premature v3 data ───
{
  let threw = false;
  let message = '';
  try {
    getProjectionLineValue({
      assetClass: 'marina',
      department: 'Storage',
      lineKey: 'Wet Slip Rental',
      period: { year: 2027 },
      dimensionId: 'wet_slips',
      streamId: 'wet_slips_long_term',
      blob: {
        schemaVersion: 3,
        granularity: 'year',
        departmentDefaults: {},
        dimensions: {
          wet_slips: {
            totalCapacity: { value: 1000, unit: 'LF' },
            streams: {
              wet_slips_long_term: {
                basisType: 'percent_of_capacity',
                capacityAllocation: 0.85,
                revenueMode: 'driver_based',
                driver: { series: { mode: 'fixed', values: { '2027': 90 }, baselineYear: 2024 }, seasons: null, quantityUnit: 'percent' },
                rate: { unitBasis: 'per_LF', periodBasis: 'per_month', series: { mode: 'fixed', values: { '2027': 30 }, baselineYear: 2024 } },
              },
            },
          },
        },
      },
      modelConfig,
      y1Amount: 100_000,
      growthRates: { line: 0.03 },
    });
  } catch (e) {
    threw = true;
    message = String(e.message ?? e);
  }
  if (!threw) {
    console.error('✗ FAIL: Case 9: v3 blob did NOT throw');
    process.exit(1);
  }
  if (!message.includes('Step D-prime')) {
    console.error(`✗ FAIL: Case 9: throw message missing Step D-prime guidance: ${message}`);
    process.exit(1);
  }
  console.log(`✓ Case 9: v3 driver_based throws — "${message.split('\n')[0].slice(0, 80)}..."`);
}

console.log('\n✓ GREEN — v1-marina adapter byte-identical to legacy. v3 fails loud. Cascade resolves correctly.');
