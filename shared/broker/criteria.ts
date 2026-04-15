/**
 * Broker criteria — shared type used by the evaluator service, the broker
 * profile editor, and the feedback panel. Lives in `shared/` so the frontend
 * and backend share one canonical shape.
 *
 * All fields are optional. A broker profile with no criteria set produces an
 * "insufficient_criteria" verdict rather than a pass/watch/pursue.
 */

export type RiskTolerance = "core" | "core_plus" | "value_add" | "opportunistic";

export type Verdict = "pursue" | "watch" | "pass";

export interface BrokerCriteria {
  /** Asset classes the broker focuses on (matches marina_listings.asset_class / modeling_projects.asset_class). */
  assetClasses?: string[];
  /** US state codes the broker covers. Empty/missing = all markets. */
  markets?: string[];
  /** Minimum acceptable cap rate (percent, e.g. 6.5). */
  capRateMin?: number;
  /** Minimum DSCR on deals. */
  dscrMin?: number;
  /** Maximum LTV on deals (percent). */
  ltvMax?: number;
  /** Target unlevered/levered IRR (percent). */
  irrTarget?: number;
  /** Hold period window in years. */
  holdPeriodMinYears?: number;
  holdPeriodMaxYears?: number;
  /** Deal size window in USD. */
  dealSizeMin?: number;
  dealSizeMax?: number;
  /** Risk posture. */
  riskTolerance?: RiskTolerance;
  /** Free-text market outlook used as LLM narrative context. */
  outlookNarrative?: string;
  /** Reserved for v2 auto-training — fields the broker has manually pinned. */
  manualOverride?: Partial<Record<keyof Omit<BrokerCriteria, "manualOverride">, boolean>>;
}

export const DEFAULT_CRITERIA: BrokerCriteria = {
  assetClasses: [],
  markets: [],
  outlookNarrative: "",
  manualOverride: {},
};

export interface CriterionResult {
  key: string;
  label: string;
  passed: boolean;
  /** Human-readable explanation, e.g. "cap rate 5.2% below 6.5% floor". */
  detail: string;
}

export interface EvaluationResult {
  verdict: Verdict;
  score: number; // 0-100
  matched: CriterionResult[];
  failed: CriterionResult[];
  /** Snapshot of criteria that produced this result. */
  criteriaSnapshot: BrokerCriteria;
  /** Snapshot of the evaluated target's normalized fields. */
  targetSnapshot: Record<string, unknown>;
}
