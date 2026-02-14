// ============================================================
// Strategy Module Inputs
// ============================================================
import type {
  USD, Percent, Years, ISODateString, BasisPoints,
  PaymentFrequency, EarnoutMetric, EarnoutPayoutType,
  EarnoutPaymentTiming, EarnoutTaxTreatment,
  EarnoutInExchangePolicy,
  Explanation, Warning,
} from './01-enums-and-primitives';

// ============================================================
// 1031 Exchange
// ============================================================
export interface Exchange1031Input {
  enabled: boolean;

  /** Replacement properties (can be multiple) */
  replacementProperties: ReplacementProperty[];

  /** Qualified Intermediary settings */
  qi: QISettings;

  /** Boot inputs (explicit user entries + computed) */
  boot: BootInputs;

  /** Informational: 45-day / 180-day timeline */
  identificationDeadline?: ISODateString;
  exchangeDeadline?: ISODateString;
}

export interface ReplacementProperty {
  id: string;
  name?: string;
  purchasePrice: USD;
  closingDate?: ISODateString;
  replacementDebtPlaced: USD;
  closingCosts: USD;
  /** How to handle closing costs: capitalize or expense */
  capitalizedCostPolicy: 'capitalize' | 'expense';
}

export interface QISettings {
  qiFee: USD;
  /** Is cash held by QI (not available to seller)? */
  cashHeldByQI: boolean;
  /** Is the seller note assigned to QI as exchange consideration? */
  sellerNoteAssignedToQI: boolean;
}

export interface BootInputs {
  /** Cash explicitly kept out of exchange */
  cashKeptOut: USD;
  /** Additional cash contributed by seller */
  additionalCashIn: USD;
  /** Non-like-kind property retained (e.g., personal property) */
  nonLikeKindPropertyRetainedValue: USD;
}

// --- 1031 Computed Results ---
export interface Exchange1031Result {
  /** Boot breakdown */
  cashBoot: USD;
  mortgageBoot: USD;
  nonLikeKindBoot: USD;
  totalBoot: USD;

  /** Gain recognition */
  recognizedGain: USD;     // min(realizedGain, totalBoot)
  deferredGain: USD;       // realizedGain – recognizedGain

  /** Basis in replacement property (Form 8824 logic) */
  carryoverBasis: USD;
  /** Per-property basis allocation (if multiple replacements) */
  replacementBasisAllocation: ReplacementBasisAllocation[];

  /** Debt analysis */
  relinquishedDebt: USD;
  replacementDebtTotal: USD;
  netDebtRelief: USD;      // positive = boot exposure

  /** Trade-down detection */
  isTradeDown: boolean;
  tradeDownWarnings: Warning[];

  /** Boot explainer: why did boot happen? */
  bootExplainers: BootExplainer[];

  explanations: Explanation[];
  warnings: Warning[];
}

export interface ReplacementBasisAllocation {
  propertyId: string;
  propertyName?: string;
  allocatedBasis: USD;
  purchasePrice: USD;
  /** Deferred gain embedded in this property */
  embeddedDeferredGain: USD;
}

export interface BootExplainer {
  bootType: 'cash' | 'mortgage' | 'non_like_kind';
  amount: USD;
  reason: string;
  /** Plain English: "You kept $50,000 cash out of the exchange..." */
  plainEnglish: string;
}

// ============================================================
// Seller Financing (Installment Sale — § 453)
// ============================================================
export interface SellerFinancingInput {
  enabled: boolean;

  /** Down payment */
  downPayment: USD;
  downPaymentPercent?: Percent;

  /** Note terms */
  noteAmount?: USD;           // override; otherwise salePrice – downPayment
  interestRate: Percent;
  termYears: Years;
  amortizationYears: Years;   // can differ from term (creates balloon)
  paymentFrequency: PaymentFrequency;

  /** Interest-only period */
  interestOnlyYears?: Years;

  /** Balloon */
  hasBalloon: boolean;
  balloonAtYear?: Years;

  /** Fees */
  originationFee?: USD;
  prepaymentPenalty?: Percent;

  /** Default risk (optional modeling) */
  defaultProbability?: Percent;
  recoveryRate?: Percent;

  /** 1031 interaction toggles */
  noteReceivedAtClose: boolean;
  assignedToQI: boolean;       // if true, treated as exchange consideration
}

// --- Seller Financing Computed Results ---
export interface SellerFinancingResult {
  /** Computed note amount */
  noteAmount: USD;

  /** Installment sale tax metrics */
  grossProfitRatio: Percent;
  contractPrice: USD;

  /** Amortization schedule */
  amortSchedule: AmortScheduleRow[];

  /** Installment tax schedule */
  installmentTaxSchedule: InstallmentTaxRow[];

  /** Recapture warning */
  recaptureRecognizedAtSale: USD;
  recaptureWarning: Warning | null;

  /** Balloon details */
  balloonAmount: USD | null;
  balloonDate: ISODateString | null;

  /** Risk-adjusted NPV (if default assumptions provided) */
  riskAdjustedNPV?: USD;

  explanations: Explanation[];
  warnings: Warning[];
}

export interface AmortScheduleRow {
  period: number;
  date: ISODateString;
  paymentAmount: USD;
  principalPortion: USD;
  interestPortion: USD;
  remainingBalance: USD;
  isBalloon: boolean;
  isInterestOnly: boolean;
  cumulativePrincipal: USD;
  cumulativeInterest: USD;
}

export interface InstallmentTaxRow {
  taxYear: number;
  principalReceived: USD;
  /** Gain recognized = principalReceived × grossProfitRatio */
  gainRecognized: USD;
  /** Of which: recapture (only year-of-sale per § 453(i)) */
  recaptureRecognized: USD;
  /** Of which: § 1250 unrecaptured */
  unrecaptured1250Recognized: USD;
  /** Of which: LTCG */
  ltcgRecognized: USD;
  /** Interest income (ordinary) */
  interestIncome: USD;
  /** Estimated tax on this year's recognition */
  estimatedTax: USD;
  /** After-tax cash for this year */
  afterTaxCash: USD;
}

// ============================================================
// Earnout Module
// ============================================================
export interface EarnoutInput {
  enabled: boolean;

  /** Earnout tranches (add/delete/reorder) */
  tranches: EarnoutTranche[];

  /** Global discount rate for NPV */
  discountRate: Percent;

  /** 1031 interaction policy */
  exchangePolicy?: EarnoutInExchangePolicy;
}

export interface EarnoutTranche {
  id: string;
  name?: string;
  order: number;

  // --- Metric & Payout ---
  metricType: EarnoutMetric;
  payoutType: EarnoutPayoutType;
  threshold?: USD;
  payoutPercent?: Percent;
  payoutFixedAmount?: USD;
  capAmount?: USD;
  floorAmount?: USD;

  // --- Timing ---
  measurementPeriodStart: ISODateString;
  measurementPeriodEnd: ISODateString;
  paymentTiming: EarnoutPaymentTiming;

  // --- Scenario Model ---
  scenarios: EarnoutScenarioCase[];

  // --- Tax Treatment ---
  taxTreatment: EarnoutTaxTreatment;

  // --- Service Condition Flags (compensation risk) ---
  serviceConditions: EarnoutServiceConditions;

  // --- Definitions Layer: Tier 1 (computational) ---
  definitions: EarnoutDefinitionsTier1;

  // --- Definitions Layer: Tier 2 (deal hygiene metadata) ---
  dealHygiene: EarnoutDefinitionsTier2;
}

// --- Earnout Scenario Cases ---
export interface EarnoutScenarioCase {
  label: 'low' | 'base' | 'high' | 'custom';
  metricValue: USD;
  probability: Percent;   // 0–100, must sum to 100 across cases
  computedPayout?: USD;   // filled by engine
}

// --- Service Conditions (compensation risk indicators) ---
export interface EarnoutServiceConditions {
  requiresEmployment: boolean;
  requiresConsulting: boolean;
  nonCompeteLinked: boolean;
  covenantLinked: boolean;
}

// --- Tier 1: Definitions that affect computation ---
export interface EarnoutDefinitionsTier1 {
  /** Free-text definition of the metric */
  definitionText?: string;
  /** What's included in the metric calculation */
  inclusions: string[];
  /** What's excluded */
  exclusions: string[];
  /** EBITDA addbacks (if metric is EBITDA) */
  ebitdaAddbacks?: string[];
  /** Cap on addbacks */
  addbacksCap?: USD;
  /** Working capital normalization method (business) */
  workingCapitalNormalization?: 'target_peg' | 'dollar_for_dollar' | 'none';
  /** Extraordinary items treatment */
  extraordinaryItemsTreatment?: 'exclude' | 'include' | 'normalize';
  /** Revenue recognition rules (hotels/STR/retail) */
  revenueRecognitionPolicy?: string;
  /** Management fee treatment (hotels) */
  managementFeeTreatment?: 'above_line' | 'below_line' | 'excluded';
  /** Repairs vs CapEx classification policy */
  repairsCapexPolicy?: string;
}

// --- Tier 2: Deal hygiene metadata (does NOT affect computation) ---
export interface EarnoutDefinitionsTier2 {
  auditRightsEnabled?: boolean;
  reportingCadence?: 'monthly' | 'quarterly' | 'annual';
  accountingPolicyLockEnabled?: boolean;
  disputeResolutionMethod?: 'arbitration' | 'litigation' | 'independent_accountant';
  independentAccountantSelection?: string;
  buyerControlAdjustmentFlag?: boolean;
  /** Completion score (0–100) for the checklist */
  completionScore?: number;
}

// --- Earnout Computed Results ---
export interface EarnoutResult {
  tranches: EarnoutTrancheResult[];

  /** Aggregate across tranches */
  totalExpectedValue: USD;
  totalNPV: USD;
  afterTaxExpectedValue: USD;
  afterTaxNPV: USD;

  /** Effective purchase price distribution */
  effectivePurchasePriceRange: {
    low: USD;
    base: USD;
    high: USD;
  };

  /** Compensation risk score (0–100) */
  compensationRiskScore: number;
  compensationRiskWarnings: Warning[];

  /** Definitions completeness */
  tier1Completeness: Percent;
  tier2Completeness: Percent;

  explanations: Explanation[];
  warnings: Warning[];
}

export interface EarnoutTrancheResult {
  trancheId: string;
  expectedValue: USD;
  npv: USD;
  afterTaxEV: USD;
  afterTaxNPV: USD;
  scenarioPayouts: {
    label: string;
    metricValue: USD;
    computedPayout: USD;
    probability: Percent;
    weightedPayout: USD;
  }[];
}
