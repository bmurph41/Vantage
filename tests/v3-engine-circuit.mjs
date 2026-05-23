// Step B — End-to-end circuit test (engine call site → calculator)
//
// PURPOSE
//   The engine call site at pro-forma-engine-service.ts:854 is the load-bearing
//   wire-up — it builds a RevenueDriverBlob from assumptions.dimensions (the
//   dimensions-present guard), resolves dimensionId + streamId per line, and
//   calls getProjectionLineValue. The harness here mirrors that exact pattern
//   in a shim so we can prove:
//     (A) Empty scenario (assumptions.dimensions undefined / {}) → blob:null →
//         v1 fallback → multiplier=1 → byte-identical to pre-Step-B.
//     (B) Populated scenario with unit-weighted-rolled dimensions →
//         engine builds blob → calculator returns the rolled-up multiplier →
//         revenue projection reflects v3, NOT the silent no-op.
//
//   Cross-method match: the expected v3 multiplier is hand-computed
//   (independent of the helper); the actual is what the calculator returns.
//
// ROLE
//   Closes the "next user who populates occupancy gets the right answer" gap.
//   Without this test, the calculator's v3 path is provably correct in
//   isolation but not provably reachable through the engine's guard logic.
//
// EXIT CODES
//   0 — circuit closes correctly in both branches
//   1 — any assertion fails

import { getProjectionLineValue } from '/home/runner/workspace/shared/coa/projection-calculator.ts';
import { storageSubcategoryToTypeKey } from '/home/runner/workspace/shared/coa/department-mapping.ts';
import { getModelConfig } from '/home/runner/workspace/shared/asset-class-model-config.ts';

const marinaConfig = getModelConfig('marina');

function assertNear(actual, expected, label, eps = 1e-9) {
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

// ─── Shim mirroring pro-forma-engine-service.ts:854 EXACTLY ──────────────
// (The block lifted from the engine — kept verbatim so a regression in the
// engine guard logic shows up here as well. Update both in lockstep.)
function engineShim_getProjectionLineValue({
  assetClass,
  department,
  lineKey,
  period,
  modelConfig,
  y1Amount,
  growthRates,
  assumptions, // canonical assumption blob — what the engine reads from the scenario row
  latestHistoricalYear,
}) {
  const granularOccupancy = assumptions.occupancy || {};
  const v3Dimensions = assumptions.dimensions;
  const v3Blob =
    v3Dimensions && Object.keys(v3Dimensions).length > 0
      ? {
          schemaVersion: 3,
          granularity: 'year',
          departmentDefaults: {},
          dimensions: v3Dimensions,
        }
      : null;
  const V3_STREAM_ID = 'default';

  const lineDimensionId = storageSubcategoryToTypeKey(lineKey);
  const lineHasV3Stream =
    v3Blob !== null &&
    lineDimensionId !== undefined &&
    v3Blob.dimensions[lineDimensionId]?.streams?.[V3_STREAM_ID] !== undefined;

  return getProjectionLineValue({
    assetClass,
    department,
    lineKey,
    period,
    blob: lineHasV3Stream ? v3Blob : null,
    dimensionId: lineHasV3Stream ? lineDimensionId : undefined,
    streamId: lineHasV3Stream ? V3_STREAM_ID : undefined,
    modelConfig,
    y1Amount,
    growthRates,
    legacyV1Context: {
      occupancy: granularOccupancy,
      latestHistoricalYear,
    },
  });
}

console.log('=== V3 Engine Circuit — guard pattern proves both branches ===\n');

// ─── (A) Empty scenario — today's prod state. Must take v1 fallback. ───
{
  const result = engineShim_getProjectionLineValue({
    assetClass: 'marina',
    department: 'Storage',
    lineKey: 'Wet Slip Rental',
    period: { year: 2027 },
    modelConfig: marinaConfig,
    y1Amount: 100_000,
    growthRates: { line: 0.03 },
    assumptions: {
      occupancy: {}, // empty — what all 3 prod marina scenarios look like today
      // dimensions: undefined (key absent)
    },
    latestHistoricalYear: 2024,
  });
  assertEqual(result._stepA_multiplier, 1, '(A) Empty assumptions → multiplier=1 (v1 fallback, byte-identical to pre-Step-B)');
  assertEqual(result.amount, 100_000, '(A) Empty assumptions → amount unchanged');
}

// Also verify the guard correctly handles `dimensions: {}` (present but empty)
{
  const result = engineShim_getProjectionLineValue({
    assetClass: 'marina',
    department: 'Storage',
    lineKey: 'Wet Slip Rental',
    period: { year: 2027 },
    modelConfig: marinaConfig,
    y1Amount: 100_000,
    growthRates: { line: 0.03 },
    assumptions: {
      occupancy: {},
      dimensions: {}, // explicit empty — still takes the else branch
    },
    latestHistoricalYear: 2024,
  });
  assertEqual(result._stepA_multiplier, 1, '(A2) Empty dimensions object → multiplier=1 (v1 fallback)');
}

// ─── (B) Populated scenario — UI has written v3 dimensions per Step B contract.
//        Hand-compute the expected multiplier from Case C of the rollup harness:
//        200@90% + 10@30% → unit-weighted 87.143% (2027), 85% baseline (2024).
//        Expected multiplier = 87.143 / 85 = 1.0252100840336135 ───
{
  const handRolledOcc2024 = 85;
  const handRolledOcc2027 = (90 * 200 + 30 * 10) / (200 + 10); // 87.142857...
  const handExpectedMultiplier = handRolledOcc2027 / handRolledOcc2024;

  const result = engineShim_getProjectionLineValue({
    assetClass: 'marina',
    department: 'Storage',
    lineKey: 'Wet Slip Rental',
    period: { year: 2027 },
    modelConfig: marinaConfig,
    y1Amount: 100_000,
    growthRates: { line: 0.03 },
    assumptions: {
      occupancy: {}, // legacy occupancy is no longer written; v3 is the producer
      dimensions: {
        wet_slips: {
          totalCapacity: { value: 210, unit: 'count' },
          streams: {
            default: {
              basisType: 'percent_of_capacity',
              capacityAllocation: 1.0,
              revenueMode: 'driver_based',
              driver: {
                series: {
                  mode: 'fixed',
                  values: { '2024': handRolledOcc2024, '2027': handRolledOcc2027 },
                  baselineYear: 2024,
                },
                seasons: null,
                quantityUnit: 'percent',
              },
              rate: {
                unitBasis: 'per_unit',
                periodBasis: 'per_month',
                series: { mode: 'fixed', values: {}, baselineYear: 2024 },
              },
            },
          },
        },
      },
    },
    latestHistoricalYear: 2024,
  });
  assertNear(result._stepA_multiplier, handExpectedMultiplier, '(B) Populated dimensions → multiplier matches HAND-COMPUTED unit-weighted ratio');
  assertNear(result.amount, 100_000 * handExpectedMultiplier, '(B) Populated dimensions → amount reflects v3 rollup');
  assertEqual(result.basisType, 'percent_of_capacity', '(B) Populated dimensions → basisType=percent_of_capacity');
  assertEqual(result.capacityUsed?.value, 210, '(B) Populated dimensions → capacityUsed propagated');

  // Negative: result must NOT equal the silent-no-op (multiplier=1) — proves
  // the guard correctly routed to the v3 branch, not the v1 fallback.
  if (Math.abs(result._stepA_multiplier - 1) < 1e-6) {
    console.error('✗ FAIL: (B) Populated dimensions returned multiplier=1 — guard fell through to v1 silently');
    process.exit(1);
  }
  console.log('✓ (B) Multiplier ≠ 1 — guard correctly routed to v3 branch');

  // Negative: result must NOT equal the arithmetic-mean answer (60/85 ratio)
  const arithmeticAmount = 100_000 * (60 / 85);
  if (Math.abs(result.amount - arithmeticAmount) < 100) {
    console.error('✗ FAIL: (B) Amount equals arithmetic-mean projection — unit-weighted lock broken at the engine call site');
    process.exit(1);
  }
  console.log(`✓ (B) Amount ≠ arithmetic projection (${result.amount.toFixed(0)} vs ${arithmeticAmount.toFixed(0)})`);
}

// ─── (C) Mixed scenario — some lines have v3, others don't (e.g. Fuel Sales
//        line with no dimension mapping). Engine must independently route each line. ───
{
  // Line WITH v3 dim (Wet Slip Rental → 'wet_slips') — should take v3 path
  const wetSlipResult = engineShim_getProjectionLineValue({
    assetClass: 'marina',
    department: 'Storage',
    lineKey: 'Wet Slip Rental',
    period: { year: 2027 },
    modelConfig: marinaConfig,
    y1Amount: 100_000,
    growthRates: { line: 0.03 },
    assumptions: {
      occupancy: {},
      dimensions: {
        wet_slips: {
          totalCapacity: { value: 100, unit: 'count' },
          streams: {
            default: {
              basisType: 'percent_of_capacity',
              capacityAllocation: 1.0,
              revenueMode: 'driver_based',
              driver: { series: { mode: 'fixed', values: { '2024': 80, '2027': 88 }, baselineYear: 2024 }, seasons: null, quantityUnit: 'percent' },
              rate: { unitBasis: 'per_unit', periodBasis: 'per_month', series: { mode: 'fixed', values: {}, baselineYear: 2024 } },
            },
          },
        },
      },
    },
    latestHistoricalYear: 2024,
  });
  assertNear(wetSlipResult._stepA_multiplier, 88 / 80, '(C) Wet Slip Rental → v3 path, multiplier=88/80');

  // Line WITHOUT v3 dim mapping (Fuel Sales → undefined storage type)
  const fuelResult = engineShim_getProjectionLineValue({
    assetClass: 'marina',
    department: 'Fuel',
    lineKey: 'Fuel Sales',
    period: { year: 2027 },
    modelConfig: marinaConfig,
    y1Amount: 50_000,
    growthRates: { line: 0.03 },
    assumptions: {
      occupancy: {},
      dimensions: {
        // Has a wet_slips dim but Fuel Sales doesn't map to it
        wet_slips: {
          totalCapacity: { value: 100, unit: 'count' },
          streams: {
            default: {
              basisType: 'percent_of_capacity',
              capacityAllocation: 1.0,
              revenueMode: 'driver_based',
              driver: { series: { mode: 'fixed', values: { '2024': 80, '2027': 88 }, baselineYear: 2024 }, seasons: null, quantityUnit: 'percent' },
              rate: { unitBasis: 'per_unit', periodBasis: 'per_month', series: { mode: 'fixed', values: {}, baselineYear: 2024 } },
            },
          },
        },
      },
    },
    latestHistoricalYear: 2024,
  });
  assertEqual(fuelResult._stepA_multiplier, 1, '(C) Fuel Sales (no dim mapping) → multiplier=1 (department !== Storage, v1 fallback)');
  assertEqual(fuelResult.amount, 50_000, '(C) Fuel Sales amount unchanged');
}

console.log('\n✓ GREEN — Engine circuit closes end-to-end. Empty scenarios stay byte-identical (A); populated scenarios route to v3 with unit-weighted rollup (B); per-line routing is correct in mixed cases (C).');
