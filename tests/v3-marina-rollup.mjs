// Step B — V3 Marina Rollup Test (cross-method, NOT self-match)
//
// PURPOSE
//   Three layers of assertion:
//     (1) The shared unit-weighted rollup helper produces values that
//         match HAND-COMPUTED expected, NOT a re-run of the same formula.
//     (2) When the rolled-up value is fed into a v3 RevenueDriverBlob,
//         getProjectionLineValue returns the correct multiplier
//         (currentPct / baselinePct) — the marina percent_of_capacity
//         path is lit up.
//     (3) The fail-loud wall is narrower (not deleted): marina
//         transient_usage AND non-marina percent_of_capacity v3 streams
//         must still throw. This proves Step B did NOT silently broaden
//         lit-up scope.
//
// ROLE
//   Step B's positive-behavior gate. dept-golden proves byte-identity on
//   empty scenarios; this proves correctness on populated synthetic ones.
//
// EXIT CODES
//   0 — all assertions pass
//   1 — any assertion fails

import { getProjectionLineValue } from '/home/runner/workspace/shared/coa/projection-calculator.ts';
import {
  rollupLocationOccupancyToType,
  sumUnitsPerType,
} from '/home/runner/workspace/shared/coa/occupancy-rollup.ts';
import { getModelConfig } from '/home/runner/workspace/shared/asset-class-model-config.ts';

const marinaConfig = getModelConfig('marina');
const strConfig = getModelConfig('str');

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

console.log('=== V3 Marina Rollup — cross-method gate ===\n');

// Helper: build a minimal v3 RevenueDriverBlob with one marina percent_of_capacity stream
function makeMarinaBlob({ typeId, totalUnits, occupancyByYear, baselineYear, streamId = 'default' }) {
  return {
    schemaVersion: 3,
    granularity: 'year',
    departmentDefaults: {},
    dimensions: {
      [typeId]: {
        totalCapacity: { value: totalUnits, unit: 'count' }, // Step B default: count
        streams: {
          [streamId]: {
            basisType: 'percent_of_capacity',
            capacityAllocation: 1.0,
            revenueMode: 'driver_based',
            driver: {
              series: { mode: 'fixed', values: occupancyByYear, baselineYear },
              seasons: null,
              quantityUnit: 'percent',
            },
            rate: {
              unitBasis: 'per_unit',
              periodBasis: 'per_month',
              series: { mode: 'fixed', values: {}, baselineYear },
            },
          },
        },
      },
    },
  };
}

// ─── Case A: single-location type — rollup must equal the location value ───
{
  const handExpected = 85; // hand-computed: only one location, weight=units, mean reduces to its own value
  const rolled = rollupLocationOccupancyToType({
    locationOccupancyByYear: { wet_slips_main: { '2024': 85, '2027': 92 } },
    locationUnitsById: { wet_slips_main: 100 },
    locationToTypeMap: { wet_slips_main: 'wet_slips' },
  });
  // Hand-computed cross-method match (NOT self-match):
  //   single location of 100 units with occ=85 → Σ(occ×units)/Σ(units) = 8500/100 = 85
  assertNear(rolled.wet_slips['2024'], handExpected, 'Case A: 2024 rolled == single location value');
  assertNear(rolled.wet_slips['2027'], 92, 'Case A: 2027 rolled == single location value');

  // Feed into the calculator's v3 read path; expected multiplier = 92/85
  const blob = makeMarinaBlob({
    typeId: 'wet_slips',
    totalUnits: 100,
    occupancyByYear: { '2024': rolled.wet_slips['2024'], '2027': rolled.wet_slips['2027'] },
    baselineYear: 2024,
  });
  const result = getProjectionLineValue({
    assetClass: 'marina',
    department: 'Storage',
    lineKey: 'Wet Slip Rental',
    period: { year: 2027 },
    dimensionId: 'wet_slips',
    streamId: 'default',
    blob,
    modelConfig: marinaConfig,
    y1Amount: 100_000,
    growthRates: { line: 0.03 },
  });
  assertNear(result._stepA_multiplier, 92 / 85, 'Case A: v3 multiplier = 92/85');
  assertEqual(result.basisType, 'percent_of_capacity', 'Case A: basisType=percent_of_capacity');
  assertEqual(result.capacityUsed?.unit, 'count', 'Case A: capacityUsed.unit=count');
  assertEqual(result.capacityUsed?.value, 100, 'Case A: capacityUsed.value=100');
}

// ─── Case B: multi-location, EQUAL units — arithmetic mean == unit-weighted ───
{
  // Hand: 100@70 + 100@90 → Σ(occ×units)/Σ(units) = (70*100 + 90*100)/200 = 16000/200 = 80
  // Arithmetic mean (old buggy formula): (70+90)/2 = 80. Both agree when units are equal.
  const handExpectedUnitWeighted = 80;
  const handExpectedArithmetic = (70 + 90) / 2;
  assertEqual(handExpectedUnitWeighted, handExpectedArithmetic, 'Case B: hand check — formulas agree on equal-units');

  const rolled = rollupLocationOccupancyToType({
    locationOccupancyByYear: {
      dry_racks_east: { '2024': 70, '2027': 80 },
      dry_racks_west: { '2024': 90, '2027': 95 },
    },
    locationUnitsById: { dry_racks_east: 100, dry_racks_west: 100 },
    locationToTypeMap: { dry_racks_east: 'dry_racks_indoor', dry_racks_west: 'dry_racks_indoor' },
  });
  assertNear(rolled.dry_racks_indoor['2024'], 80, 'Case B: 2024 rolled == 80 (both formulas agree)');
  assertNear(rolled.dry_racks_indoor['2027'], 87.5, 'Case B: 2027 rolled == 87.5');

  // sumUnitsPerType handshake
  const totals = sumUnitsPerType({
    locationUnitsById: { dry_racks_east: 100, dry_racks_west: 100 },
    locationToTypeMap: { dry_racks_east: 'dry_racks_indoor', dry_racks_west: 'dry_racks_indoor' },
  });
  assertEqual(totals.dry_racks_indoor, 200, 'Case B: sumUnitsPerType totals=200');
}

// ─── Case C: UNEQUAL units — unit-weighted != arithmetic; harness locks unit-weighted ───
{
  // Hand: 200@90 + 10@30 →
  //   unit-weighted = (90*200 + 30*10) / (200+10) = (18000 + 300) / 210 = 18300/210 = 87.142857...
  //   arithmetic mean (buggy old UI) = (90 + 30) / 2 = 60
  // The harness asserts the helper returns the UNIT-WEIGHTED value, NOT 60.
  // This LOCKS unit-weighted as the canonical rollup math.
  const handExpectedUnitWeighted = (90 * 200 + 30 * 10) / (200 + 10); // 87.14285714285714
  const handExpectedArithmetic = (90 + 30) / 2;                       // 60
  if (Math.abs(handExpectedUnitWeighted - handExpectedArithmetic) < 1) {
    console.error('✗ FAIL: Case C: hand-check sanity — unequal-units formulas should DIFFER significantly');
    process.exit(1);
  }
  console.log(`  Case C hand: unit-weighted=${handExpectedUnitWeighted.toFixed(4)} arithmetic=${handExpectedArithmetic} (must diverge)`);

  const rolled = rollupLocationOccupancyToType({
    locationOccupancyByYear: {
      wet_slips_main: { '2024': 85, '2027': 90 },
      wet_slips_short_dock: { '2024': 85, '2027': 30 },
    },
    locationUnitsById: { wet_slips_main: 200, wet_slips_short_dock: 10 },
    locationToTypeMap: { wet_slips_main: 'wet_slips', wet_slips_short_dock: 'wet_slips' },
  });
  assertNear(rolled.wet_slips['2024'], 85, 'Case C: 2024 rolled == 85 (equal pcts → either formula)');
  assertNear(rolled.wet_slips['2027'], handExpectedUnitWeighted, 'Case C: 2027 rolled == 87.143 (UNIT-WEIGHTED, not 60)');

  // Critical negative assertion: the rolled value must NOT equal the arithmetic mean.
  if (Math.abs(rolled.wet_slips['2027'] - handExpectedArithmetic) < 1) {
    console.error(`✗ FAIL: Case C: rolled value equals arithmetic mean (${handExpectedArithmetic}) — unit-weighted lock broken`);
    process.exit(1);
  }
  console.log(`✓ Case C: rolled ≠ arithmetic mean (lock holds — diff=${(rolled.wet_slips['2027'] - handExpectedArithmetic).toFixed(4)})`);

  // Feed into calculator: v3 multiplier = (87.143 / 85)
  const blob = makeMarinaBlob({
    typeId: 'wet_slips',
    totalUnits: 210,
    occupancyByYear: { '2024': rolled.wet_slips['2024'], '2027': rolled.wet_slips['2027'] },
    baselineYear: 2024,
  });
  const result = getProjectionLineValue({
    assetClass: 'marina',
    department: 'Storage',
    lineKey: 'Wet Slip Rental',
    period: { year: 2027 },
    dimensionId: 'wet_slips',
    streamId: 'default',
    blob,
    modelConfig: marinaConfig,
    y1Amount: 100_000,
    growthRates: { line: 0.03 },
  });
  const handExpectedMultiplier = handExpectedUnitWeighted / 85;
  assertNear(result._stepA_multiplier, handExpectedMultiplier, 'Case C: v3 multiplier matches hand calc');
  assertNear(result.amount, 100_000 * handExpectedMultiplier, 'Case C: result.amount = y1 × hand-computed ratio');

  // Negative: result.amount must NOT equal the arithmetic-mean answer (60/85 ratio)
  const arithmeticAmount = 100_000 * (60 / 85);
  if (Math.abs(result.amount - arithmeticAmount) < 100) {
    console.error(`✗ FAIL: Case C: amount equals arithmetic-mean projection — unit-weighted lock broken end-to-end`);
    process.exit(1);
  }
  console.log(`✓ Case C: end-to-end amount ≠ arithmetic projection (${result.amount.toFixed(0)} vs ${arithmeticAmount.toFixed(0)})`);
}

// ─── Wall: fail-loud must STILL fire for marina non-percent_of_capacity ───
{
  let threw = false;
  let message = '';
  try {
    getProjectionLineValue({
      assetClass: 'marina',
      department: 'Storage',
      lineKey: 'Transient Slip Rental',
      period: { year: 2027 },
      dimensionId: 'wet_slips',
      streamId: 'transient',
      blob: {
        schemaVersion: 3,
        granularity: 'year',
        departmentDefaults: {},
        dimensions: {
          wet_slips: {
            totalCapacity: { value: 1000, unit: 'LF' },
            streams: {
              transient: {
                basisType: 'transient_usage',
                capacityAllocation: 0.15,
                revenueMode: 'driver_based',
                driver: { series: { mode: 'fixed', values: { '2027': 5000 }, baselineYear: 2024 }, seasons: null, quantityUnit: 'unit_nights' },
                rate: { unitBasis: 'per_LF', periodBasis: 'per_night', series: { mode: 'fixed', values: { '2027': 3 }, baselineYear: 2024 } },
              },
            },
          },
        },
      },
      modelConfig: marinaConfig,
      y1Amount: 100_000,
      growthRates: { line: 0.03 },
    });
  } catch (e) {
    threw = true;
    message = String(e.message ?? e);
  }
  if (!threw) {
    console.error('✗ FAIL: Wall: marina transient_usage v3 did NOT throw — Step B silently broadened beyond percent_of_capacity');
    process.exit(1);
  }
  if (!message.includes('not wired for this class/basis')) {
    console.error(`✗ FAIL: Wall: throw message missing narrowed-wall guidance: ${message}`);
    process.exit(1);
  }
  console.log(`✓ Wall: marina transient_usage still throws — narrowed wall holds at the basis boundary`);
}

// ─── Wall: fail-loud must STILL fire for NON-marina percent_of_capacity ───
{
  let threw = false;
  let message = '';
  try {
    getProjectionLineValue({
      assetClass: 'str',
      department: 'Listings',
      lineKey: 'Nightly Rental',
      period: { year: 2027 },
      dimensionId: 'listings',
      streamId: 'default',
      blob: {
        schemaVersion: 3,
        granularity: 'year',
        departmentDefaults: {},
        dimensions: {
          listings: {
            totalCapacity: { value: 5, unit: 'count' },
            streams: {
              default: {
                basisType: 'percent_of_capacity',
                capacityAllocation: 1.0,
                revenueMode: 'driver_based',
                driver: { series: { mode: 'fixed', values: { '2027': 70 }, baselineYear: 2024 }, seasons: null, quantityUnit: 'percent' },
                rate: { unitBasis: 'per_unit', periodBasis: 'per_night', series: { mode: 'fixed', values: { '2027': 200 }, baselineYear: 2024 } },
              },
            },
          },
        },
      },
      modelConfig: strConfig,
      y1Amount: 100_000,
      growthRates: { line: 0.03 },
    });
  } catch (e) {
    threw = true;
    message = String(e.message ?? e);
  }
  if (!threw) {
    console.error('✗ FAIL: Wall: STR percent_of_capacity v3 did NOT throw — Step B silently broadened beyond marina');
    process.exit(1);
  }
  if (!message.includes('not wired for this class/basis')) {
    console.error(`✗ FAIL: Wall: throw message missing narrowed-wall guidance: ${message}`);
    process.exit(1);
  }
  console.log(`✓ Wall: STR percent_of_capacity still throws — narrowed wall holds at the class boundary`);
}

console.log('\n✓ GREEN — v3 marina rollup is unit-weighted (Case C locks). Calculator reads v3 for marina percent_of_capacity. Fail-loud wall holds at class AND basis boundaries.');
