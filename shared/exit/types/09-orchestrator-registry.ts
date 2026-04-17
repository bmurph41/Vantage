// ============================================================
// Orchestrator — Function Signatures + Pipeline Contract
// ============================================================
import type { ExitScenarioInput, ExitScenarioResult, ExitScenarioKPIs } from './07-master-types';
import type { BasisLedgerInput, BasisLedgerOutput } from './02-basis-ledger';
import type { SaleTermsInput, SaleComputation, GainCharacterization, ProceedsTimeline } from './03-sale-and-gain';
import type { Exchange1031Input, Exchange1031Result, SellerFinancingInput, SellerFinancingResult, EarnoutInput, EarnoutResult } from './04-strategy-inputs';
import type { WaterfallInput, WaterfallResult, TaxProfileInput, TaxSchedule } from './05-waterfall-tax';
import type { StrategyInteractionPolicy } from './06-strategy-interactions';
import type { AssetClass, EarnoutMetric, Warning, Explanation } from './01-enums-and-primitives';
import type { AllocationBucketKey } from './02-basis-ledger';

// ============================================================
// Orchestrator Pipeline
// ============================================================

/**
 * The canonical orchestrator. Every computation flows through this.
 *
 * Pipeline order:
 *   1. normalize + validate inputs
 *   2. compute basis ledger
 *   3. compute amount realized + cash proceeds
 *   4. compute realized gain + character split
 *   5. compute base tax objects (pre-strategy)
 *   6. resolveStrategyInteractions()
 *   7. build unified proceeds timeline
 *   8. compute recognized vs deferred (1031 / installment / earnout)
 *   9. compute taxes by year
 *  10. waterfall allocation (optional)
 *  11. materialize KPIs + warnings + explanations
 */
export type RunExitScenarioOrchestrator = (
  input: ExitScenarioInput
) => ExitScenarioResult;

// --- Individual pipeline stage signatures ---

export type ComputeBasisLedger = (input: BasisLedgerInput) => BasisLedgerOutput;

export type ComputeSale = (
  saleTerms: SaleTermsInput,
  ownershipPercent: number,
) => SaleComputation;

export type ComputeGainCharacter = (
  amountRealized: number,
  basisLedger: BasisLedgerOutput,
) => GainCharacterization;

export type OrchestratorResolveStrategyInteractions = (
  input: ExitScenarioInput
) => StrategyInteractionPolicy;

export type ComputeExchange1031 = (
  exchange: Exchange1031Input,
  saleComputation: SaleComputation,
  gainCharacterization: GainCharacterization,
) => Exchange1031Result;

export type ComputeSellerFinancing = (
  financing: SellerFinancingInput,
  saleComputation: SaleComputation,
  gainCharacterization: GainCharacterization,
) => SellerFinancingResult;

export type ComputeEarnout = (
  earnout: EarnoutInput,
  gainCharacterization: GainCharacterization,
) => EarnoutResult;

export type BuildProceedsTimeline = (
  saleComputation: SaleComputation,
  exchange1031Result: Exchange1031Result | null,
  sellerFinancingResult: SellerFinancingResult | null,
  earnoutResult: EarnoutResult | null,
  strategyPolicy: StrategyInteractionPolicy,
) => ProceedsTimeline;

export type ComputeTaxSchedule = (
  proceedsTimeline: ProceedsTimeline,
  taxProfile: TaxProfileInput,
  gainCharacterization: GainCharacterization,
) => TaxSchedule;

export type ComputeWaterfall = (
  waterfall: WaterfallInput,
  proceedsTimeline: ProceedsTimeline,
) => WaterfallResult;

export type MaterializeKPIs = (
  result: Omit<ExitScenarioResult, 'kpis'>,
  scenarioId: string,
) => ExitScenarioKPIs;

// ============================================================
// Orchestrator Return Contract (for persistence layer)
// ============================================================
export interface OrchestratorPersistencePayload {
  /** Full result for outputs_json */
  result: ExitScenarioResult;
  /** Flattened KPIs for the read model table */
  kpis: ExitScenarioKPIs;
  /** Indexable tags/flags for filtering */
  indexables: {
    strategiesActive: string[];
    assetClass: string;
    hasRecaptureExposure: boolean;
    hasTradeDown: boolean;
    advisorReviewRequired: boolean;
    warningCodes: string[];
  };
}

// ============================================================
// Asset Class Registry
// ============================================================

/**
 * Runtime registry that defines asset-class-specific behavior.
 * UI components query this to determine which options to show.
 * Persisted defaults in asset_class_assumption_sets serve as
 * editable overrides; the registry provides safe fallbacks.
 */
export interface AssetClassDefinition {
  /** Asset class key */
  key: AssetClass;
  /** Display name */
  displayName: string;
  /** Icon identifier */
  icon: string;

  /** Available earnout metrics for this asset class */
  availableEarnoutMetrics: EarnoutMetric[];

  /** Default allocation template */
  defaultAllocationTemplate: DefaultAllocationTemplate;

  /** Specialist KPI definitions (for display in results) */
  kpiDefinitions: KPIDefinition[];

  /** Asset-class-specific warnings */
  specialistWarnings: SpecialistWarningRule[];

  /** Earnout definition scaffolds (pre-populated Tier 1 prompts) */
  earnoutDefinitionScaffolds: Record<EarnoutMetric, Partial<{
    suggestedInclusions: string[];
    suggestedExclusions: string[];
    suggestedAddbacks: string[];
    revenueRecognitionNote: string;
  }>>;

  /** Does this asset class typically involve an operating business? */
  typicallyOperatingBusiness: boolean;

  /** Common deal structures */
  commonStrategies: string[];
}

export interface DefaultAllocationTemplate {
  buckets: {
    key: AllocationBucketKey;
    defaultPercent: number;
    label: string;
    notes?: string;
  }[];
}

export interface KPIDefinition {
  key: string;
  label: string;
  unit: 'usd' | 'percent' | 'multiple' | 'number' | 'years';
  description: string;
}

export interface SpecialistWarningRule {
  code: string;
  condition: string;    // human-readable condition description
  severity: 'info' | 'caution' | 'warning' | 'critical';
  message: string;
}

// --- Registry interface ---
export interface AssetClassRegistry {
  get(assetClass: AssetClass): AssetClassDefinition;
  getAll(): AssetClassDefinition[];
  getEarnoutMetrics(assetClass: AssetClass): EarnoutMetric[];
  getAllocationDefaults(assetClass: AssetClass): DefaultAllocationTemplate;
}
