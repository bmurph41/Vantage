// ============================================================
// Strategy Interaction Policy
// ============================================================
import type {
  ExitStrategy, EarnoutInExchangePolicy, Warning,
} from './01-enums-and-primitives';

/**
 * The interaction matrix defines how combined strategies behave.
 * The orchestrator calls resolveStrategyInteractions() to produce
 * a resolved policy + warnings before building the proceeds timeline.
 */

// --- Combination Key ---
export type StrategyCombination = `${ExitStrategy}+${ExitStrategy}`;

// --- Interaction Rules ---
export interface StrategyInteractionPolicy {
  /** Active strategies in this scenario */
  activeStrategies: ExitStrategy[];

  /** Resolved interactions */
  interactions: StrategyInteraction[];

  /** Warnings from unresolvable or ambiguous combinations */
  warnings: Warning[];

  /** Does this combination require advisor review? */
  advisorReviewRequired: boolean;
}

export interface StrategyInteraction {
  combination: StrategyCombination;
  rule: InteractionRule;
  /** Plain English explanation of how this interaction works */
  explanation: string;
}

export type InteractionRule =
  | Exchange1031_SellerNote_Rule
  | Exchange1031_Earnout_Rule
  | SellerNote_Earnout_Rule
  | CashSale_Exchange1031_Rule
  | CashSale_SellerNote_Rule
  | CashSale_Earnout_Rule;

// --- Specific Interaction Rules ---

/**
 * 1031 + Seller Note:
 * If note is assigned to QI → treated as exchange consideration,
 *   no immediate boot from note itself.
 * If note NOT assigned to QI → note FV treated as boot at close;
 *   installment sale rules apply to note outside exchange.
 */
export interface Exchange1031_SellerNote_Rule {
  type: 'exchange_1031+seller_financing';
  noteAssignedToQI: boolean;
  /** If assigned: note is part of exchange consideration */
  noteInExchange: boolean;
  /** If not assigned: note FV becomes boot */
  noteFVAsBoot: boolean;
  /** Installment treatment only applies if seller holds note outside QI */
  installmentTreatmentApplies: boolean;
}

/**
 * 1031 + Earnout:
 * Contingent payments in a 1031 are complex (Rev. Rul. territory).
 * User must select an explicit policy; engine flags "advisor required"
 * unless policy is set.
 */
export interface Exchange1031_Earnout_Rule {
  type: 'exchange_1031+earnout';
  policy: EarnoutInExchangePolicy;
  policyExplicitlySet: boolean;
  /** If not set, this is flagged as requiring advisor review */
  advisorRequired: boolean;
}

/**
 * Seller Note + Earnout:
 * Two separate future income streams with different tax treatments.
 * Note: gain via gross profit ratio. Earnout: per tranche tax treatment.
 * Proceeds timeline merges both but preserves tax character per source.
 */
export interface SellerNote_Earnout_Rule {
  type: 'seller_financing+earnout';
  /** Both streams merged into proceeds timeline */
  mergePolicy: 'parallel_streams';
  /** Tax treatment preserved per source */
  taxCharacterPreserved: true;
}

/**
 * Cash + 1031:
 * Cash kept out of exchange creates cash boot.
 */
export interface CashSale_Exchange1031_Rule {
  type: 'cash_sale+exchange_1031';
  /** Cash not reinvested creates boot */
  cashCreatesBootWhenNotReinvested: true;
}

/**
 * Cash + Seller Note:
 * Down payment is cash at close; remainder is installment sale.
 */
export interface CashSale_SellerNote_Rule {
  type: 'cash_sale+seller_financing';
  /** Standard installment sale rules */
  installmentRulesApply: true;
}

/**
 * Cash + Earnout:
 * Cash at close + contingent future payments.
 */
export interface CashSale_Earnout_Rule {
  type: 'cash_sale+earnout';
  /** Cash recognized at close; earnout recognized per tranche timing */
  standardRecognition: true;
}

// --- Interaction Resolution Function Signature ---
export type ResolveStrategyInteractions = (
  activeStrategies: ExitStrategy[],
  exchange1031Input?: { qi: { sellerNoteAssignedToQI: boolean } },
  earnoutInput?: { exchangePolicy?: EarnoutInExchangePolicy },
) => StrategyInteractionPolicy;
