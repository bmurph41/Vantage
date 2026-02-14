/**
 * buildExitScenarioInput.ts
 *
 * Single shared builder that every exit page uses to construct a canonical
 * ExitScenarioInput.  Follows the same pattern as Exchange1031.tsx but is
 * reusable across NetProceeds, DST, Waterfall, etc.
 */
import type {
  ExitScenarioInput,
  ExitStrategyType,
  ClosingCostLineItem,
} from '@shared/exit/exit-scenario-engine';
import type { TaxProfileInput } from '@shared/exit/tax-engine';
import { normalizeRate } from './normalizeRate';

// ---------------------------------------------------------------------------
// Public "UI state" contract — what each page passes in
// ---------------------------------------------------------------------------

export interface ExitScenarioUIState {
  // Required sale inputs
  scenarioName: string;
  scenarioType: ExitStrategyType;
  salePrice: number;
  brokerCommissionPercent: number;   // e.g. 3 (percent), auto-normalised
  closingCosts: number;              // flat dollar
  closingCostsLineItems?: ClosingCostLineItem[];

  // Property / basis
  purchasePrice: number;             // original cost basis
  acquisitionCosts?: number;
  landValuePercent?: number;          // e.g. 20 → 20% of cost basis is land
  depreciationScheduleYears?: number; // default 39
  holdingPeriodYears: number;
  capitalImprovements?: number;
  depreciationTaken?: number;         // accumulated depreciation for manual override
  personalPropertyValue?: number;
  costSegregationBonus?: number;
  costSegregationYear?: number;
  prior1031DeferredGain?: number;
  prior1031CarryoverBasis?: number;

  // Debt
  outstandingDebt: number;
  prepaymentPenaltyPercent?: number;  // e.g. 1 (percent), auto-normalised to dollar amount
  prepaymentPenaltyDollar?: number;   // direct dollar override

  // Tax profile
  taxProfile?: Partial<TaxProfileInput>;

  // 1031 sub-inputs (only when scenarioType === 'exchange_1031')
  exchange1031?: ExitScenarioInput['exchange1031'];

  // DST sub-inputs (only when scenarioType === 'dst_investment')
  dstInvestment?: ExitScenarioInput['dstInvestment'];

  // Seller financing sub-inputs
  sellerFinancing?: ExitScenarioInput['sellerFinancing'];

  // Earnout sub-inputs
  earnout?: ExitScenarioInput['earnout'];

  // Waterfall sub-inputs
  waterfall?: ExitScenarioInput['waterfall'];

  // Installment sale
  installmentSale?: ExitScenarioInput['installmentSale'];
}

// ---------------------------------------------------------------------------
// Default tax profile (matches Exchange1031.tsx reference)
// ---------------------------------------------------------------------------

const DEFAULT_TAX_PROFILE: TaxProfileInput = {
  filingStatus: 'married',
  otherOrdinaryIncome: 200_000,
  otherInvestmentIncome: 0,
  stateOfResidence: 'FL',
  taxYear: 2025,
};

// ---------------------------------------------------------------------------
// Builder
// ---------------------------------------------------------------------------

export function buildExitScenarioInput(state: ExitScenarioUIState): ExitScenarioInput {
  const costBasis = state.purchasePrice;
  const landPercent = (state.landValuePercent ?? 20) / 100;
  const landValue = Math.round(costBasis * landPercent);
  const improvementValue = costBasis - landValue;

  const brokerRate = normalizeRate(state.brokerCommissionPercent, 'brokerCommission');

  // Prepayment: prefer explicit dollar amount, else compute from percent
  let prepaymentPenalty = state.prepaymentPenaltyDollar ?? 0;
  if (!state.prepaymentPenaltyDollar && state.prepaymentPenaltyPercent) {
    prepaymentPenalty = state.outstandingDebt * normalizeRate(state.prepaymentPenaltyPercent, 'prepaymentPenalty');
  }

  const taxProfile: TaxProfileInput = {
    ...DEFAULT_TAX_PROFILE,
    ...state.taxProfile,
  };

  const input: ExitScenarioInput = {
    scenarioName: state.scenarioName,
    scenarioType: state.scenarioType,

    property: {
      purchasePrice: costBasis,
      acquisitionCosts: state.acquisitionCosts ?? 0,
      landValue,
      improvementValue,
      personalPropertyValue: state.personalPropertyValue,
      depreciationScheduleYears: state.depreciationScheduleYears ?? 39,
      holdingPeriodYears: state.holdingPeriodYears,
      capitalAdditionsByYear: state.capitalImprovements
        ? { 1: state.capitalImprovements }
        : undefined,
      costSegregationBonus: state.costSegregationBonus,
      costSegregationYear: state.costSegregationYear,
      prior1031DeferredGain: state.prior1031DeferredGain,
      prior1031CarryoverBasis: state.prior1031CarryoverBasis,
    },

    sale: {
      salePrice: state.salePrice,
      brokerCommissionRate: brokerRate,
      closingCosts: state.closingCosts,
      holdingPeriodMonths: state.holdingPeriodYears * 12,
      closingCostsBreakdown: state.closingCostsLineItems,
    },

    debt: {
      outstandingBalance: state.outstandingDebt,
      prepaymentPenalty,
    },

    taxProfile,

    exchange1031: state.exchange1031,
    dstInvestment: state.dstInvestment,
    sellerFinancing: state.sellerFinancing,
    earnout: state.earnout,
    waterfall: state.waterfall,
    installmentSale: state.installmentSale,
  };

  return input;
}

/**
 * Convenience: build a "cash sale" baseline for comparison purposes.
 * Uses the same sale / property / debt inputs but forces scenarioType to
 * 'cash_sale' and strips strategy-specific sub-inputs.
 */
export function buildCashSaleBaseline(state: ExitScenarioUIState): ExitScenarioInput {
  return buildExitScenarioInput({
    ...state,
    scenarioName: `${state.scenarioName} (Cash Sale Baseline)`,
    scenarioType: 'cash_sale',
    exchange1031: undefined,
    dstInvestment: undefined,
    sellerFinancing: undefined,
    earnout: undefined,
    waterfall: undefined,
    installmentSale: undefined,
  });
}
