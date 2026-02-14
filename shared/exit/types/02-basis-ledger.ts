// ============================================================
// Basis Ledger — Allocation Wizard Payload & Computed Output
// ============================================================
import type {
  USD, Percent, Years, ISODateString,
  AllocationMethod, DepreciationCharacter, AllocationLockPolicy,
  AssetClass, Explanation, Warning,
} from './01-enums-and-primitives';

// --- Allocation Bucket (single row in the wizard) ---
export interface AllocationBucket {
  /** Unique key: land | building | site_improvements | ffe | intangibles | goodwill */
  key: AllocationBucketKey;
  label: string;
  /** Original cost allocated to this bucket */
  allocatedAmount: USD;
  /** % of purchase price (always computed even if method = dollars) */
  allocatedPercent: Percent;
  /** Tax depreciation character governing recapture */
  depreciationCharacter: DepreciationCharacter | 'non_depreciable';
  /** Useful life used for straight-line (years); null for land */
  usefulLifeYears: Years | null;
  /** Accumulated depreciation taken through disposition date */
  accumulatedDepreciation: USD;
  /** Cost seg group tag (optional) */
  costSegGroup?: string;
  /** Bonus depreciation taken (if applicable) */
  bonusDepreciationTaken?: USD;
  /** Section 179 taken (if applicable, business only) */
  section179Taken?: USD;
}

export type AllocationBucketKey =
  | 'land'
  | 'building'
  | 'site_improvements'
  | 'ffe'
  | 'intangibles'
  | 'goodwill';

// --- Capex Schedule Entry ---
export interface CapexEntry {
  date: ISODateString;
  amount: USD;
  bucket: AllocationBucketKey;
  description?: string;
  /** Was this capitalized or expensed? */
  treatment: 'capitalized' | 'expensed';
}

// --- Cost Seg Groups (optional detail) ---
export interface CostSegGroup {
  groupName: string;
  originalAmount: USD;
  depreciationLife: Years;
  method: 'straight_line' | 'macrs_gds' | 'macrs_ads';
  accumulatedDepreciation: USD;
  bonusEligible: boolean;
  bonusTaken: USD;
}

// ============================================================
// BasisLedgerInput — What the Allocation Wizard produces
// ============================================================
export interface BasisLedgerInput {
  /** Schema version for migration/validation */
  schemaVersion: '1.0';

  /** Original purchase price (total consideration) */
  purchasePrice: USD;

  /** How user chose to allocate */
  allocationMethod: AllocationMethod;

  /** Asset class (drives defaults + validation rules) */
  assetClass: AssetClass;

  /** The allocation buckets */
  buckets: AllocationBucket[];

  /** Capital expenditures since acquisition */
  capexSchedule: CapexEntry[];

  /** Optional: detailed cost seg breakdown */
  costSegGroups?: CostSegGroup[];

  /** Business-specific toggles */
  bonusDepreciationEnabled?: boolean;
  section179Enabled?: boolean;

  /** Acquisition date (needed for hold period + depreciation calc) */
  acquisitionDate: ISODateString;

  /** Disposition date (for accumulated dep calc) */
  dispositionDate: ISODateString;
}

// ============================================================
// BasisLedgerOutput — Computed from BasisLedgerInput
// ============================================================
export interface BasisLedgerOutput {
  /** Total adjusted basis (sum across buckets) */
  totalAdjustedBasis: USD;

  /** Per-bucket breakdown */
  bucketSummary: BucketBasisSummary[];

  /** Recapture exposure by character */
  recaptureExposure: RecaptureExposure;

  /** "If you sell today" preview */
  recapturePreview: RecapturePreview;

  /** Warnings surfaced by the wizard */
  warnings: Warning[];

  /** Explanations for each computed field */
  explanations: Explanation[];

  /** Checksum of the BasisLedgerInput that produced this */
  inputChecksum: string;
}

export interface BucketBasisSummary {
  key: AllocationBucketKey;
  originalCost: USD;
  capexAdded: USD;
  accumulatedDepreciation: USD;
  adjustedBasis: USD;
  depreciationCharacter: DepreciationCharacter | 'non_depreciable';
}

export interface RecaptureExposure {
  /** § 1245 ordinary recapture (full recapture of depreciation on personal property) */
  ordinary1245: USD;
  /** § 1250 unrecaptured (25% rate on real property depreciation) */
  unrecaptured1250: USD;
  /** Total recapture exposure */
  total: USD;
}

export interface RecapturePreview {
  ordinary1245: USD;
  unrecaptured1250: USD;
  ltcg: USD;
  totalGain: USD;
  /** Warning flags */
  highRecaptureExposure: boolean;
  installmentWillAccelerateRecapture: boolean;
  /** Percentage of total gain that is recapture */
  recapturePercent: Percent;
}

// ============================================================
// Allocation Drift Detection
// ============================================================
export interface AllocationLockState {
  lockedAt: ISODateString | null;
  lockPolicy: AllocationLockPolicy;
  /** Hash of fields that, if changed, make the allocation stale */
  dependencyFingerprint: string;
  /** Is the current allocation stale relative to upstream inputs? */
  isStale: boolean;
  /** Which upstream fields changed (if stale) */
  staleReasons?: string[];
}

/**
 * Fields included in the dependency fingerprint.
 * If ANY of these change after lock, allocation is flagged stale.
 * Note: sale price is NOT included — it changes gain utilization, not allocation validity.
 */
export const ALLOCATION_DEPENDENCY_FIELDS = [
  'dealType',
  'assetClass',
  'buckets',
  'capexSchedule',
  'costSegGroups',
  'bonusDepreciationEnabled',
  'section179Enabled',
  'ownershipPercent',
  'acquisitionDate',
  'dispositionDate',
] as const;
