// ============================================================
// Sale Computation — Amount Realized + Cash Proceeds
// ============================================================
import type {
  USD, Percent, ISODateString,
  GainCharacterType, Explanation, Warning,
} from './01-enums-and-primitives';
import type { RecaptureExposure } from './02-basis-ledger';

// --- Selling Expense Line Item ---
export interface SellingExpenseItem {
  category: SellingExpenseCategory;
  label: string;
  /** Flat dollar amount OR null if using percent */
  amount: USD | null;
  /** Percent of sale price OR null if using flat */
  percentOfSale: Percent | null;
  /** Computed amount (always populated by engine) */
  computedAmount: USD;
}

export type SellingExpenseCategory =
  | 'broker_commission'
  | 'legal'
  | 'transfer_tax'
  | 'title_insurance'
  | 'due_diligence_reimbursement'
  | 'marketing'
  | 'other';

// --- Sale Terms (user inputs) ---
export interface SaleTermsInput {
  salePrice: USD;
  sellingExpenses: SellingExpenseItem[];
  closingCosts: SellingExpenseItem[];
  creditsToBuyer: USD;
  prorationsNetToSeller: USD;
  escrowsReleased: USD;
  debtPayoff: USD;
  prepaymentPenalty: USD;
  defeasanceCost: USD;
  /** Business-specific */
  workingCapitalAdjustment?: USD;
  inventoryIncluded?: boolean;
  inventoryValue?: USD;
}

// --- Sale Computation Output ---
export interface SaleComputation {
  /** Gross sale price */
  salePrice: USD;
  /** Total selling expenses (sum of all items) */
  totalSellingExpenses: USD;
  /** Amount realized = salePrice – sellingExpenses – credits + prorations */
  amountRealized: USD;
  /** Total debt retired at close */
  totalDebtRetired: USD;
  /** Cash proceeds before tax = amountRealized – debt – penalties + escrows */
  cashProceedsPreTax: USD;

  /** Line-by-line breakdown for audit */
  lineItems: SaleComputationLineItem[];
  explanations: Explanation[];
}

export interface SaleComputationLineItem {
  label: string;
  amount: USD;
  direction: 'add' | 'subtract';
  section: 'amount_realized' | 'cash_proceeds';
}

// ============================================================
// Gain Characterization — Split by Tax Character
// ============================================================
export interface GainCharacterization {
  /** Total adjusted basis (from BasisLedger) */
  adjustedBasis: USD;
  /** Amount realized (from SaleComputation) */
  amountRealized: USD;
  /** Realized gain = amountRealized – adjustedBasis */
  realizedGain: USD;

  /** Character breakdown */
  characters: GainCharacterLine[];

  /** Recapture exposure consumed */
  recaptureConsumed: RecaptureExposure;

  explanations: Explanation[];
  warnings: Warning[];
}

export interface GainCharacterLine {
  type: GainCharacterType;
  amount: USD;
  /** Applicable federal rate for this character */
  federalRate: Percent;
  /** Label for display */
  label: string;
  /** IRC citation */
  citation: string;
}

// ============================================================
// Proceeds Timeline — Unified Cash Flow Schedule
// ============================================================

/**
 * Every dollar the seller receives (or is deemed to receive)
 * is represented as a TimelineEvent. This is the canonical
 * input to the Tax Engine and Waterfall Engine.
 */
export interface ProceedsTimeline {
  events: TimelineEvent[];
  summary: TimelineSummary;
}

export interface TimelineEvent {
  /** Unique id for this cash flow */
  id: string;
  /** When the cash is received */
  date: ISODateString;
  /** Fiscal/tax year this falls into */
  taxYear: number;
  /** Source strategy */
  source: TimelineSource;
  /** Nature of the payment */
  paymentType: TimelinePaymentType;
  /** Gross amount */
  grossAmount: USD;
  /** Tax character breakdown for this event */
  taxCharacter: TimelineEventTaxCharacter;
}

export type TimelineSource =
  | 'cash_at_close'
  | 'seller_note_principal'
  | 'seller_note_interest'
  | 'earnout_payment'
  | 'escrow_release'
  | 'qi_distribution';  // 1031 failed exchange scenario

export type TimelinePaymentType =
  | 'lump_sum'
  | 'scheduled_principal'
  | 'scheduled_interest'
  | 'balloon'
  | 'contingent';

export interface TimelineEventTaxCharacter {
  /** Ordinary income (1245 recapture + interest + compensation earnout) */
  ordinaryIncome: USD;
  /** Unrecaptured 1250 gain */
  unrecaptured1250: USD;
  /** Long-term capital gain */
  ltcg: USD;
  /** Deferred (1031 or installment not yet recognized) */
  deferred: USD;
  /** Tax-free return of basis */
  returnOfBasis: USD;
}

export interface TimelineSummary {
  totalCashAtClose: USD;
  totalFuturePayments: USD;
  totalNominalProceeds: USD;
  /** NPV of all future payments at a given discount rate */
  npvFuturePayments: USD;
  discountRateUsed: Percent;
  /** Weighted average time to receipt (years) */
  weightedAverageTimingYears: number;
  /** Year-by-year aggregation */
  byYear: YearlyProceedsSummary[];
}

export interface YearlyProceedsSummary {
  taxYear: number;
  cashReceived: USD;
  gainRecognized: USD;
  ordinaryIncome: USD;
  capitalGain: USD;
  deferredGain: USD;
  taxEstimate: USD;
  afterTaxCash: USD;
}
