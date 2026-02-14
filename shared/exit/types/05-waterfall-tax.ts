// ============================================================
// Waterfall & Capital Stack Types
// ============================================================
import type {
  USD, Percent, Years, ISODateString,
  WaterfallStructure, HurdleType, CapitalStackMode,
  Explanation, Warning,
} from './01-enums-and-primitives';

// ============================================================
// Capital Stack
// ============================================================
export interface CapitalStackInput {
  mode: CapitalStackMode;
  /** Always stored, even if mode = 'linked' */
  overrideSnapshot: CapitalStackSnapshot;
  /** If mode = 'linked', this is the project ID to pull from */
  linkedProjectId?: string;
}

export interface CapitalStackSnapshot {
  debtTranches: DebtTranche[];
  equityLayers: EquityLayer[];
  fees?: CapitalStackFee[];
}

export interface DebtTranche {
  id: string;
  name: string;
  type: 'senior' | 'mezzanine' | 'preferred_equity' | 'seller_note';
  principal: USD;
  interestRate: Percent;
  termYears: Years;
  ioCovenant?: boolean;
  /** Is this being repaid from sale proceeds? */
  retiredAtSale: boolean;
}

export interface EquityLayer {
  id: string;
  name: string;
  type: 'lp_common' | 'lp_preferred' | 'gp_coinvest' | 'promote';
  commitAmount: USD;
  /** Ownership percentage of total equity */
  ownershipPercent: Percent;
}

export interface CapitalStackFee {
  type: 'acquisition' | 'asset_management' | 'disposition' | 'promote_true_up';
  amount: USD;
  /** Percent of what base? */
  percentBasis?: 'purchase_price' | 'equity' | 'gross_revenue' | 'distributable_cash';
  percentRate?: Percent;
  recipient: 'gp' | 'manager' | 'other';
}

// ============================================================
// Waterfall Module
// ============================================================
export interface WaterfallInput {
  enabled: boolean;

  structureType: WaterfallStructure;

  /** Preferred return */
  preferredReturnRate: Percent;
  preferredReturnCompounding: 'simple' | 'compound';

  /** GP commitment */
  gpCommitPercent: Percent;

  /** Catch-up */
  catchUpEnabled: boolean;
  catchUpPercent?: Percent;   // e.g., 100% to GP until caught up

  /** Clawback */
  clawbackEnabled: boolean;

  /** Promote tiers (ordered) */
  tiers: WaterfallTier[];

  /** Capital events timeline (calls + distributions) */
  capitalCalls: CapitalEvent[];
  distributions: CapitalEvent[];

  /** Fees applied before waterfall distribution */
  preDistributionFees?: CapitalStackFee[];
}

export interface WaterfallTier {
  id: string;
  name: string;
  order: number;
  hurdleType: HurdleType;
  hurdleValue: number;       // IRR % or equity multiple x
  lpSplitPercent: Percent;
  gpSplitPercent: Percent;
  catchUpPercent?: Percent;  // optional per-tier catch-up
}

export interface CapitalEvent {
  id: string;
  date: ISODateString;
  amount: USD;
  description?: string;
}

// --- Waterfall Computed Results ---
export interface WaterfallResult {
  /** Tier-by-tier allocation audit trail */
  tierAllocations: TierAllocation[];

  /** LP aggregate metrics */
  lpIRR: Percent;
  lpEquityMultiple: number;
  lpTotalDistributed: USD;
  lpTotalContributed: USD;

  /** GP aggregate metrics */
  gpIRR: Percent;
  gpEquityMultiple: number;
  gpTotalDistributed: USD;
  gpPromoteEarned: USD;

  /** Clawback (if enabled) */
  clawbackAmount: USD;
  clawbackTriggered: boolean;

  /** Fee summary */
  totalFeesDeducted: USD;
  feeBreakdown: { type: string; amount: USD }[];

  /** Distribution timeline */
  distributionTimeline: DistributionTimelineRow[];

  explanations: Explanation[];
  warnings: Warning[];
}

export interface TierAllocation {
  tierId: string;
  tierName: string;
  hurdleType: HurdleType;
  hurdleValue: number;
  distributableInTier: USD;
  lpDistribution: USD;
  gpDistribution: USD;
  catchUpDistribution?: USD;
  /** Was this tier fully satisfied? */
  tierSatisfied: boolean;
}

export interface DistributionTimelineRow {
  date: ISODateString;
  eventType: 'capital_call' | 'distribution';
  grossAmount: USD;
  feesDeducted: USD;
  netToLP: USD;
  netToGP: USD;
  cumulativeLPReturn: USD;
  cumulativeGPReturn: USD;
  runningIRR_LP: Percent | null;
  runningEM_LP: number;
}

// ============================================================
// Tax Engine
// ============================================================
export interface TaxProfileInput {
  filingStatus: 'single' | 'mfj' | 'mfs' | 'hoh' | 'qss';
  stateCode: string;         // e.g., 'FL', 'CA', 'NY'
  niitEnabled: boolean;
  /** Other income for bracket stacking */
  otherOrdinaryIncome?: USD;
  otherCapitalGains?: USD;
  /** Passive loss carryforwards */
  suspendedPassiveLosses?: USD;
  passiveLossEnabled?: boolean;
  /** State-specific overrides */
  stateCapitalGainsRate?: Percent;
  stateSurchargeRate?: Percent;
}

export interface TaxSchedule {
  /** Year-by-year tax computation */
  years: TaxYearDetail[];

  /** Totals */
  totalFederalTax: USD;
  totalStateTax: USD;
  totalNIIT: USD;
  totalTax: USD;

  /** Effective rates */
  effectiveFederalRate: Percent;
  effectiveTotalRate: Percent;

  explanations: Explanation[];
  warnings: Warning[];
}

export interface TaxYearDetail {
  taxYear: number;

  /** Income recognized this year by character */
  ordinaryIncome: USD;
  recapture1245: USD;
  unrecaptured1250: USD;
  ltcg: USD;
  interestIncome: USD;

  /** Tax computed */
  federalOnOrdinary: USD;
  federalOn1245: USD;
  federalOn1250: USD;
  federalOnLTCG: USD;
  niit: USD;
  stateTax: USD;

  /** Passive loss offset applied */
  passiveLossOffset: USD;

  /** Total tax this year */
  totalTax: USD;
  /** After-tax cash this year */
  afterTaxCash: USD;

  /** Marginal rates applied */
  marginalOrdinaryRate: Percent;
  marginalCapitalGainsRate: Percent;
}
