/**
 * Projection Calculator — Shared Dispatcher (Step 0: SIGNATURE ONLY)
 * ───────────────────────────────────────────────────────────────────
 * Single shared entry point that BOTH projection engines call:
 *   - server/services/pro-forma-engine-service.ts  (monthly loop)
 *   - server/services/multi-year-projection-engine.ts  (annual loop, DCF path)
 *
 * Architectural mandate from the early PF/DCF audit (Step 0 spec §4):
 * the two engines must dispatch through this calculator so projection
 * mechanics stay aligned. Step D-prime (formerly Step F, promoted) wires
 * both engines to this signature in lockstep when each class flips.
 *
 * Step 0 (this file): SIGNATURE ONLY. Calling the function throws —
 * nothing currently dispatches through it.
 * Step A: implementation lands here. Pro-forma engine adopts via the
 *         marina-protected generic dispatcher.
 * Step D-prime: multi-year-projection engine wires in per-class
 *               alongside pro-forma. Lockstep flips.
 *
 * Honors the load-bearing invariant in revenue-driver-schema.ts:
 *   - flat_growth lines: read WS5 granularGrowthRates, ignore driver+rate.
 *   - driver_based lines: read driver × rate, ignore WS5 granularGrowthRates.
 *   - cascade resolution: stream.revenueMode > departmentDefaults[dept] >
 *                         modelConfig.defaultRevenueMode > 'flat_growth'.
 */

import type {
  RevenueDriverBlob,
  RevenueMode,
  BasisType,
  DimensionId,
  StreamId,
  CapacityUnit,
} from './revenue-driver-schema';

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

  /** Canonical assumption blob for revenue drivers (v3). May be absent on legacy scenarios. */
  blob: RevenueDriverBlob | null;

  /** Class-level metadata + ratified driver taxonomy. */
  modelConfig: AssetClassModelConfig;

  /**
   * Y1 line amount — used as the base for `flat_growth` lines.
   * For `driver_based` lines this is informational only (revenue is
   * computed independently from driver × rate).
   */
  y1Amount: number;

  /** Existing WS5 growth-rate inputs. Read ONLY when flat_growth resolves. */
  growthRates: {
    line: number;
    yearly?: Record<string, number>;
  };
}

export interface ProjectionLineOutput {
  /** Projected revenue for the period (absolute dollars). */
  amount: number;

  /** Which mechanism produced the amount (after invariant resolution). */
  appliedMechanic: RevenueMode;

  // ─── Audit / UI breakdown (populated when driver_based) ───
  quantity?: number;
  rate?: number;
  basisType?: BasisType;
  capacityUsed?: { value: number; unit: CapacityUnit };

  /** Soft-validation findings: overbooking, unit mismatch, implausible turnover, etc. */
  warnings?: string[];
}

// ═══════════════════════════════════════════════════════════════
// The calculator — SIGNATURE ONLY in Step 0
// ═══════════════════════════════════════════════════════════════

/**
 * Resolve a projected line amount for a given period.
 *
 * Dispatch logic (implemented in Step A):
 *   1. Resolve effective revenueMode via the cascade.
 *   2. If 'flat_growth' → return y1Amount × compoundGrowth(period, WS5 rate).
 *   3. If 'driver_based' → resolve quantity (per basisType) × rate × periodScaleFactor.
 *   4. Surface soft-validation warnings without throwing.
 *
 * Step 0 stub throws — no caller dispatches through here yet.
 */
export function getProjectionLineValue(
  _input: ProjectionLineInput,
): ProjectionLineOutput {
  throw new Error(
    '[projection-calculator] getProjectionLineValue not implemented — Step A delivers the impl. ' +
      'If you are seeing this at runtime, an engine has been wired ahead of Step A.',
  );
}
