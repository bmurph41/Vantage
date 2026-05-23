/**
 * Projection Calculator — Shared Dispatcher (Step A: HYBRID IMPL)
 * ───────────────────────────────────────────────────────────────────
 * Single shared entry point that BOTH projection engines call:
 *   - server/services/pro-forma-engine-service.ts  (monthly loop)
 *   - server/services/multi-year-projection-engine.ts  (annual loop, DCF path)
 *
 * Architectural mandate from the early PF/DCF audit (Step 0 spec §4):
 * the two engines must dispatch through this calculator so projection
 * mechanics stay aligned. Step D-prime wires both engines in lockstep
 * per class.
 *
 * Step A scope (this file, 2026-05-23, Brett-approved Hybrid):
 *   - Calculator owns: revenueMode cascade + v1-marina occupancy adapter
 *     + v3 fail-loud guard
 *   - Engine owns: cumulativeGrowth tracking, actuals injection, per-period
 *     iteration (UNCHANGED — that's how marina stays byte-identical)
 *   - Calculator returns `_stepA_multiplier` for Decimal-safe application
 *     on the engine side; `amount` is also populated per the ratified
 *     contract (number-land math; precision-non-critical callers may use it)
 *
 * Honors the load-bearing invariant in revenue-driver-schema.ts:
 *   - flat_growth lines: read WS5 granularGrowthRates (in engine, unchanged).
 *   - driver_based lines: occupancy ratio applied via _stepA_multiplier.
 *   - cascade: stream > departmentDefaults > taxonomy class default > flat_growth.
 *
 * Step D-prime evolution:
 *   - Calculator owns full amount semantics (number-land throughout)
 *   - `_stepA_multiplier` removed
 *   - multi-year-projection-engine wires through this same function
 *   - v3 driver_based branch lights up per class
 */

import type {
  RevenueDriverBlob,
  RevenueMode,
  BasisType,
  DimensionId,
  StreamId,
  CapacityUnit,
} from './revenue-driver-schema';
import { ASSET_CLASS_DRIVER_TAXONOMY } from './revenue-driver-schema';
import { storageSubcategoryToTypeKey } from './department-mapping';

import type { AssetClassModelConfig } from '../asset-class-model-config';

// ═══════════════════════════════════════════════════════════════
// Input / output shapes
// ═══════════════════════════════════════════════════════════════

export interface ProjectionLineInput {
  assetClass: string;
  department: string;
  /** Engine subcategory / COA key. The unit of dispatch. */
  lineKey: string;

  /** When the line maps to a specific stream within a dimension. */
  streamId?: StreamId;
  /** When the line maps to a specific dimension (resolved by dispatcher upstream). */
  dimensionId?: DimensionId;

  period: { year: number; month?: number };

  /** Canonical v3 assumption blob. NULL during Step A (no v3 writes until Step B). */
  blob: RevenueDriverBlob | null;

  /** Class-level metadata + ratified driver taxonomy. */
  modelConfig: AssetClassModelConfig;

  /**
   * In Step A semantics: engine-computed pre-occupancy projected amount for
   * the current period (baseMonthly × cumulativeGrowth). The calculator
   * multiplies it by the occupancy ratio to produce result.amount.
   *
   * In Step D-prime: evolves to true absolute Y1. The calculator owns
   * compounding then.
   */
  y1Amount: number;

  /** Existing WS5 growth-rate inputs. Read ONLY when flat_growth resolves. */
  growthRates: {
    line: number;
    yearly?: Record<string, number>;
  };

  /**
   * Read-time fallback vehicle for marina scenarios whose `assumptions.dimensions`
   * (the v3 shape) is not yet populated. The calculator consults this ONLY when
   * the v3 blob lacks a stream for the current line — supporting migrate-on-read
   * back-compat (existing scenarios with `occupancy: {}` keep flowing through
   * the v1 adapter and produce multiplier=1, byte-identical to pre-Step-B).
   *
   * STEP-A/B ONLY — deletes at Step D-prime once all classes are v3-wired
   * end-to-end and the v1 adapter has no remaining producers.
   */
  legacyV1Context?: {
    /** Keyed by storage-type (e.g. 'wet_slips') → year → pct. */
    occupancy?: Record<string, Record<string, number>>;
    /** Base year for the v1 ratio's denominator (= v3 baselineYear semantic). */
    latestHistoricalYear?: number;
  };
}

export interface ProjectionLineOutput {
  /** Projected revenue for the period (absolute dollars). */
  amount: number;

  /** Which mechanism produced the amount (after cascade resolution). */
  appliedMechanic: RevenueMode;

  // ─── Audit / UI breakdown (populated when driver_based) ───
  quantity?: number;
  rate?: number;
  basisType?: BasisType;
  capacityUsed?: { value: number; unit: CapacityUnit };

  /** Soft-validation findings. */
  warnings?: string[];

  // ─── STEP-A ONLY — Decimal-precision escape hatch ─────────────
  /**
   * The multiplier applied to y1Amount to produce `amount`. Engine uses
   * THIS field (not `amount`) to apply occupancy in Decimal-land — avoids
   * the number↔Decimal round-trip risk on the line amount.
   *
   * - flat_growth      → 1
   * - driver_based v1  → currentOccPct / baseOccPct (marina ratio)
   * - driver_based     → 1 when no v3 blob and no v1 fallback (Step A no-op
   *   for STR/MF — Step D-prime will populate this from v3 stream math)
   *
   * STEP-A ONLY — removed in Step D-prime once both engines do all math
   * in number-land via the calculator.
   */
  _stepA_multiplier?: number;

  /**
   * True when the cascade resolved to driver_based but no v3 blob/v1 data
   * was available — calculator degraded to a no-op multiplier=1.
   * Useful for engine-side logging during the Step D-prime transition.
   * STEP-A ONLY.
   */
  _stepA_degradedToNoOp?: boolean;
}

// ═══════════════════════════════════════════════════════════════
// Cascade resolver
// ═══════════════════════════════════════════════════════════════

function resolveRevenueMode(
  input: ProjectionLineInput,
): { mode: RevenueMode; resolvedFrom: 'stream' | 'department' | 'class' | 'fallback' } {
  const { assetClass, department, dimensionId, streamId, blob, modelConfig } = input;

  // 1. stream.revenueMode (per-line override)
  if (blob && dimensionId && streamId) {
    const dim = blob.dimensions?.[dimensionId];
    const stream = dim?.streams?.[streamId];
    if (stream && stream.revenueMode !== null && stream.revenueMode !== undefined) {
      return { mode: stream.revenueMode, resolvedFrom: 'stream' };
    }
  }

  // 2. blob.departmentDefaults[dept]
  if (blob?.departmentDefaults && department in blob.departmentDefaults) {
    return { mode: blob.departmentDefaults[department], resolvedFrom: 'department' };
  }

  // 3. modelConfig.revenueDriverModel OR taxonomy class-level default
  //    (taxonomy is authoritative for Step 0; modelConfig override path is reserved)
  const classModel = modelConfig.revenueDriverModel ?? ASSET_CLASS_DRIVER_TAXONOMY[assetClass];
  if (classModel) {
    const deptDefault = classModel.departmentRevenueModeDefaults?.[department];
    if (deptDefault) {
      return { mode: deptDefault, resolvedFrom: 'class' };
    }
    if (classModel.defaultRevenueMode) {
      return { mode: classModel.defaultRevenueMode, resolvedFrom: 'class' };
    }
  }

  // 4. final fallback
  return { mode: 'flat_growth', resolvedFrom: 'fallback' };
}

// ═══════════════════════════════════════════════════════════════
// V1 marina occupancy adapter (STEP-A/B fallback — removed at Step D-prime)
// ═══════════════════════════════════════════════════════════════

/**
 * Read-time fallback for marina scenarios that have not yet been written
 * with v3-shaped `assumptions.dimensions`. Mirrors byte-for-byte the legacy
 * getMarinaOccupancyAdjustment in pro-forma-engine-service.ts:803-817.
 *
 * Step B: the v3 read path takes precedence; this fires only when v3 has no
 * stream for the line (migrate-on-read back-compat). All existing marina
 * scenarios have `occupancy: {}` so this branch always returns 1 today,
 * preserving the dept-golden byte-identity gate.
 *
 * Algorithm (preserved exactly):
 *   - Only Storage department participates (return 1 otherwise)
 *   - storageTypeKey from subcategory (e.g. 'Wet Slip Rental' → 'wet_slips')
 *   - If no type key resolves OR no v1 data present → return 1
 *   - If type has no occupancy entry → return 1
 *   - Current pct = v1[type][year] ?? 85; Base pct = v1[type][latestHistoricalYear] ?? 85
 *   - If base <= 0 → return 1 (defensive divide-by-zero guard)
 *   - Else → currentPct / basePct
 */
function computeV1MarinaOccupancyMultiplier(
  department: string,
  subcategory: string,
  year: number,
  legacyV1Context: ProjectionLineInput['legacyV1Context'],
): number {
  if (department !== 'Storage') return 1;
  const legacyV1Occupancy = legacyV1Context?.occupancy;
  if (!legacyV1Occupancy || Object.keys(legacyV1Occupancy).length === 0) return 1;
  const latestHistoricalYear = legacyV1Context?.latestHistoricalYear;
  if (latestHistoricalYear === undefined) return 1;

  const storageTypeKey = storageSubcategoryToTypeKey(subcategory);
  if (!storageTypeKey) return 1;

  const typeOccupancy = legacyV1Occupancy[storageTypeKey];
  if (!typeOccupancy) return 1;

  const currentOccPct = typeOccupancy[String(year)] ?? 85;
  const baseOccPct = typeOccupancy[String(latestHistoricalYear)] ?? 85;

  if (baseOccPct <= 0) return 1;
  return currentOccPct / baseOccPct;
}

// ═══════════════════════════════════════════════════════════════
// V3 marina occupancy read (Step B — marina percent_of_capacity only)
// ═══════════════════════════════════════════════════════════════

/**
 * Reads the type-level occupancy ratio from a v3 RevenueDriverBlob for
 * marina percent_of_capacity streams. The UI has already rolled location-keyed
 * occupancy up to the type level (unit-weighted) at write time, so the
 * calculator sees one pct per (dimension, year).
 *
 * Returns `null` when the v3 path doesn't apply — caller falls through
 * to the v1 adapter or the fail-loud guard, as appropriate.
 *
 * Algorithm (mirrors v1 ratio semantics; baselineYear == latestHistoricalYear):
 *   currentPct = stream.driver.series.values[year] ?? 85
 *   basePct    = stream.driver.series.values[baselineYear] ?? 85
 *   ratio      = basePct > 0 ? currentPct / basePct : 1
 *
 * Lit-up scope (Step B):
 *   - assetClass === 'marina'
 *   - basisType === 'percent_of_capacity'
 * Everything else still throws via the fail-loud guard (Step D-prime).
 */
function readV3MarinaOccupancyMultiplier(
  input: ProjectionLineInput,
): {
  multiplier: number;
  capacityUsed?: { value: number; unit: CapacityUnit };
} | null {
  if (input.assetClass !== 'marina') return null;
  if (!input.blob || input.blob.schemaVersion !== 3) return null;
  if (!input.dimensionId || !input.streamId) return null;

  const dim = input.blob.dimensions?.[input.dimensionId];
  if (!dim) return null;
  const stream = dim.streams?.[input.streamId];
  if (!stream) return null;
  if (stream.basisType !== 'percent_of_capacity') return null;

  const series = stream.driver.series;
  if (!series) return null;

  const currentPct = series.values[String(input.period.year)] ?? 85;
  const basePct = series.values[String(series.baselineYear)] ?? 85;

  const multiplier = basePct > 0 ? currentPct / basePct : 1;
  return {
    multiplier,
    capacityUsed: dim.totalCapacity ?? undefined,
  };
}

// ═══════════════════════════════════════════════════════════════
// The calculator
// ═══════════════════════════════════════════════════════════════

/**
 * Resolve a projected line amount for a given period.
 *
 * Step A dispatch:
 *   1. Resolve effective revenueMode via the cascade.
 *   2. If 'flat_growth' → multiplier = 1 (engine already compounded y1Amount).
 *   3. If 'driver_based':
 *        a. blob present with v3 streams for this line → THROW (fail-loud per
 *           Brett's gate: silent passthrough when v3 data arrives would
 *           silently ignore occupancy — unacceptable).
 *        b. assetClass='marina' + legacyV1Occupancy → v1-adapter multiplier.
 *        c. else → degrade to multiplier=1 (Step D-prime wires per class).
 *
 * Returns _stepA_multiplier as the Decimal-safe lever the engine uses.
 */
export function getProjectionLineValue(
  input: ProjectionLineInput,
): ProjectionLineOutput {
  const { mode } = resolveRevenueMode(input);

  if (mode === 'flat_growth') {
    return {
      amount: input.y1Amount,
      appliedMechanic: 'flat_growth',
      _stepA_multiplier: 1,
    };
  }

  // mode === 'driver_based'

  // ─── Step B: marina percent_of_capacity v3 read (lit up) ─────────────
  // Takes precedence over the v1 adapter and the fail-loud guard. The UI
  // has already rolled location-keyed occupancy up to the type level
  // (unit-weighted) before writing the blob, so we just read the type-level
  // pct here. v3 ratio semantics mirror v1: currentPct / baselineYearPct.
  const v3MarinaResult = readV3MarinaOccupancyMultiplier(input);
  if (v3MarinaResult !== null) {
    return {
      amount: input.y1Amount * v3MarinaResult.multiplier,
      appliedMechanic: 'driver_based',
      basisType: 'percent_of_capacity',
      capacityUsed: v3MarinaResult.capacityUsed,
      _stepA_multiplier: v3MarinaResult.multiplier,
    };
  }

  // ─── v3 fail-loud guard (narrowed for Step B) ────────────────────────
  // Still fires for any v3 stream NOT lit up by Step B:
  //   - non-marina v3 streams (STR/MF/SS/...)
  //   - marina v3 streams whose basisType !== 'percent_of_capacity'
  // The narrowing is the wall: proves Step B did NOT silently broaden the
  // lit-up scope. Step D-prime peels this back per class as they wire.
  if (input.blob && input.blob.schemaVersion === 3) {
    const stream =
      input.dimensionId && input.streamId
        ? input.blob.dimensions?.[input.dimensionId]?.streams?.[input.streamId]
        : undefined;
    if (stream) {
      throw new Error(
        '[projection-calculator] v3 driver_based not wired for this class/basis. ' +
          `Premature v3 data detected for assetClass='${input.assetClass}' ` +
          `dimension='${input.dimensionId}' stream='${input.streamId}' ` +
          `basisType='${stream.basisType}'. ` +
          'Step B lit up ONLY marina percent_of_capacity; other classes/bases ' +
          'wire at Step D-prime. Remove the v3 stream or wait.',
      );
    }
  }

  // v1-marina adapter (read-time fallback for scenarios with no v3 dimensions)
  if (input.assetClass === 'marina') {
    const multiplier = computeV1MarinaOccupancyMultiplier(
      input.department,
      input.lineKey,
      input.period.year,
      input.legacyV1Context,
    );
    return {
      amount: input.y1Amount * multiplier,
      appliedMechanic: 'driver_based',
      basisType: 'percent_of_capacity',
      _stepA_multiplier: multiplier,
    };
  }

  // Degraded no-op (STR/MF/etc. — Step D-prime lights them up)
  return {
    amount: input.y1Amount,
    appliedMechanic: 'driver_based',
    _stepA_multiplier: 1,
    _stepA_degradedToNoOp: true,
  };
}
