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

  // ─── STEP-A ONLY — removed at Step B migration ─────────────────
  /**
   * Pre-v3 marina occupancy shape: `assumptions.occupancy` v1 from the
   * canonical blob. Keyed by storage-type (e.g. 'wet_slips') → year → pct.
   * STEP-A ONLY — removed at Step B migration (v1 → v3 canonical migration).
   */
  legacyV1Occupancy?: Record<string, Record<string, number>>;

  /**
   * The base year for the v1 marina occupancy ratio's denominator.
   * STEP-A ONLY — removed at Step B migration.
   */
  latestHistoricalYear?: number;
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
// V1 marina occupancy adapter (STEP-A ONLY — removed at Step B)
// ═══════════════════════════════════════════════════════════════

/**
 * Mirrors the byte-for-byte semantics of the legacy getMarinaOccupancyAdjustment
 * in pro-forma-engine-service.ts:803-817. Step A's marina-protection
 * invariant rests on this returning identical numbers.
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
  legacyV1Occupancy: Record<string, Record<string, number>> | undefined,
  latestHistoricalYear: number | undefined,
): number {
  if (department !== 'Storage') return 1;
  if (!legacyV1Occupancy || Object.keys(legacyV1Occupancy).length === 0) return 1;
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

  // v3 fail-loud guard (Step A gate)
  if (input.blob && input.blob.schemaVersion === 3) {
    const hasV3StreamForLine =
      input.dimensionId &&
      input.streamId &&
      input.blob.dimensions?.[input.dimensionId]?.streams?.[input.streamId];
    if (hasV3StreamForLine) {
      throw new Error(
        '[projection-calculator] v3 driver_based not wired until Step D-prime. ' +
          `Premature v3 data detected for assetClass='${input.assetClass}' ` +
          `dimension='${input.dimensionId}' stream='${input.streamId}'. ` +
          'Remove the v3 stream or wait for Step D-prime.',
      );
    }
  }

  // v1-marina adapter
  if (input.assetClass === 'marina') {
    const multiplier = computeV1MarinaOccupancyMultiplier(
      input.department,
      input.lineKey,
      input.period.year,
      input.legacyV1Occupancy,
      input.latestHistoricalYear,
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
