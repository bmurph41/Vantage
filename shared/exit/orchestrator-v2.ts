// ============================================================
// Exit Strategy Studio — Orchestrator V2
// Wraps existing engines with new type contracts.
// ============================================================

import { calculateBasisLedger } from './basis-ledger';
import { calculate1031ExchangeEngine } from './exchange-1031-engine';
import { calculateSellerFinancing } from './seller-financing-engine';
import { calculateEarnout } from './earnout-engine';
import { calculateWaterfallV2 } from './waterfall-engine-v2';
import { runTaxEngine } from './tax-engine';
import { runExitScenario } from './exit-scenario-engine';

import {
  adaptBasisInputNewToOld,
  adaptBasisResultOldToNew,
  adapt1031InputNewToOld,
  adapt1031ResultOldToNew,
  adaptSellerFinancingNewToOld,
  adaptEarnoutNewToOld,
  adaptTaxProfileNewToOld,
  adaptScenarioInputNewToOld,
} from './adapters';

import type {
  ExitScenarioInput,
  ExitScenarioResult,
  ExitScenarioKPIs,
  ResultsSummary,
} from './types/07-master-types';
import type { BasisLedgerOutput } from './types/02-basis-ledger';
import type { SaleComputation, GainCharacterization, ProceedsTimeline } from './types/03-sale-and-gain';
import type { Exchange1031Result, SellerFinancingResult, EarnoutResult } from './types/04-strategy-inputs';
import type { TaxSchedule, WaterfallResult } from './types/05-waterfall-tax';
import type { StrategyInteractionPolicy } from './types/06-strategy-interactions';
import type { Warning, ExitStrategy } from './types/01-enums-and-primitives';

import { createHash } from 'crypto';

// ============================================================
// Engine Version
// ============================================================
export const ENGINE_VERSION = '2.0.0';

// ============================================================
// Checksum
// ============================================================
function computeInputsChecksum(input: ExitScenarioInput): string {
  const normalized = JSON.stringify(input, Object.keys(input).sort());
  return createHash('sha256').update(normalized).digest('hex').slice(0, 16);
}

// ============================================================
// Strategy Interaction Resolution
// ============================================================
function resolveStrategyInteractions(input: ExitScenarioInput): StrategyInteractionPolicy {
  const active: ExitStrategy[] = ['cash_sale'];
  const warnings: Warning[] = [];
  let advisorRequired = false;

  if (input.exchange1031?.enabled) active.push('exchange_1031');
  if (input.sellerFinancing?.enabled) active.push('seller_financing');
  if (input.earnout?.enabled) active.push('earnout');

  const interactions: StrategyInteractionPolicy['interactions'] = [];

  // 1031 + Seller Note
  if (input.exchange1031?.enabled && input.sellerFinancing?.enabled) {
    const noteAssigned = input.sellerFinancing.assignedToQI;
    interactions.push({
      combination: 'exchange_1031+seller_financing',
      rule: {
        type: 'exchange_1031+seller_financing',
        noteAssignedToQI: noteAssigned,
        noteInExchange: noteAssigned,
        noteFVAsBoot: !noteAssigned,
        installmentTreatmentApplies: !noteAssigned,
      },
      explanation: noteAssigned
        ? 'Seller note is assigned to QI and treated as exchange consideration. No boot from the note itself.'
        : 'Seller note is NOT assigned to QI. The note fair value is treated as boot at close, and installment sale rules apply to principal received outside the exchange.',
    });

    if (!noteAssigned) {
      warnings.push({
        code: 'SELLER_NOTE_NOT_ASSIGNED_TO_QI',
        severity: 'warning',
        title: 'Seller note creates boot',
        message: 'The seller-carried note is not assigned to the Qualified Intermediary. The fair value of the note will be treated as boot, creating recognized gain.',
        relatedFields: ['sellerFinancing.assignedToQI'],
        actionRequired: true,
      });
    }
  }

  // 1031 + Earnout
  if (input.exchange1031?.enabled && input.earnout?.enabled) {
    const policy = input.earnout.exchangePolicy;
    const policySet = !!policy;
    advisorRequired = !policySet;

    interactions.push({
      combination: 'exchange_1031+earnout',
      rule: {
        type: 'exchange_1031+earnout',
        policy: policy ?? 'treat_as_boot_when_received',
        policyExplicitlySet: policySet,
        advisorRequired: !policySet,
      },
      explanation: policySet
        ? `Earnout payments will be handled as: ${policy?.replace(/_/g, ' ')}.`
        : 'Earnout payments in a 1031 exchange involve complex contingent consideration rules. Please consult your tax advisor and select an explicit policy.',
    });

    if (!policySet) {
      warnings.push({
        code: 'EARNOUT_1031_POLICY_REQUIRED',
        severity: 'critical',
        title: 'Advisor review required: Earnout + 1031',
        message: 'Contingent payments (earnouts) in a like-kind exchange require professional tax guidance. Please select an explicit exchange policy for the earnout and consult your advisor.',
        relatedFields: ['earnout.exchangePolicy'],
        actionRequired: true,
      });
    }
  }

  // Seller Note + Earnout
  if (input.sellerFinancing?.enabled && input.earnout?.enabled) {
    interactions.push({
      combination: 'seller_financing+earnout',
      rule: {
        type: 'seller_financing+earnout',
        mergePolicy: 'parallel_streams',
        taxCharacterPreserved: true,
      },
      explanation: 'Seller note and earnout payments are separate future income streams. Note principal is taxed via gross profit ratio (installment sale rules); earnout payments are taxed per tranche treatment selection. Both are merged into the proceeds timeline.',
    });
  }

  return {
    activeStrategies: active,
    interactions,
    warnings,
    advisorReviewRequired: advisorRequired,
  };
}

// ============================================================
// Main Orchestrator
// ============================================================
export async function runExitScenarioV2(
  input: ExitScenarioInput
): Promise<ExitScenarioResult> {
  const inputsChecksum = computeInputsChecksum(input);
  const computedAt = new Date().toISOString();

  // 1. Run existing engine via adapter for baseline results
  const oldInput = adaptScenarioInputNewToOld(input);
  const oldResult = runExitScenario(oldInput);

  // 2. Compute basis ledger via adapter
  const oldBasisInput = adaptBasisInputNewToOld(input.allocation);
  const oldBasisResult = calculateBasisLedger(oldBasisInput);
  const basisLedger = adaptBasisResultOldToNew(oldBasisResult, input.allocation, inputsChecksum);

  // 3. Compute sale
  const totalSellingExpenses = input.saleTerms.sellingExpenses
    .reduce((sum, e) => sum + e.computedAmount, 0);
  const totalClosingCosts = input.saleTerms.closingCosts
    .reduce((sum, e) => sum + e.computedAmount, 0);
  const amountRealized = input.saleTerms.salePrice - totalSellingExpenses -
    totalClosingCosts - input.saleTerms.creditsToBuyer +
    input.saleTerms.prorationsNetToSeller;

  const saleComputation: SaleComputation = {
    salePrice: input.saleTerms.salePrice,
    totalSellingExpenses: totalSellingExpenses + totalClosingCosts,
    amountRealized,
    totalDebtRetired: input.saleTerms.debtPayoff + input.saleTerms.prepaymentPenalty +
      input.saleTerms.defeasanceCost,
    cashProceedsPreTax: amountRealized - input.saleTerms.debtPayoff -
      input.saleTerms.prepaymentPenalty - input.saleTerms.defeasanceCost +
      input.saleTerms.escrowsReleased,
    lineItems: [],
    explanations: [],
  };

  // 4. Compute gain characterization
  const realizedGain = amountRealized - basisLedger.totalAdjustedBasis;
  const gainCharacterization: GainCharacterization = {
    adjustedBasis: basisLedger.totalAdjustedBasis,
    amountRealized,
    realizedGain,
    characters: [
      {
        type: 'ordinary_1245',
        amount: Math.min(basisLedger.recaptureExposure.ordinary1245, Math.max(0, realizedGain)),
        federalRate: 37,
        label: '§ 1245 Ordinary Recapture',
        citation: 'IRC § 1245',
      },
      {
        type: 'unrecaptured_1250',
        amount: Math.min(
          basisLedger.recaptureExposure.unrecaptured1250,
          Math.max(0, realizedGain - basisLedger.recaptureExposure.ordinary1245)
        ),
        federalRate: 25,
        label: '§ 1250 Unrecaptured Gain',
        citation: 'IRC § 1250',
      },
      {
        type: 'ltcg',
        amount: Math.max(0,
          realizedGain - basisLedger.recaptureExposure.ordinary1245 -
          basisLedger.recaptureExposure.unrecaptured1250
        ),
        federalRate: 20,
        label: 'Long-Term Capital Gain',
        citation: 'IRC § 1(h)',
      },
    ],
    recaptureConsumed: basisLedger.recaptureExposure,
    explanations: [],
    warnings: [],
  };

  // 5. Resolve strategy interactions
  const strategyInteractions = resolveStrategyInteractions(input);

  // 6. Run strategy-specific engines
  let exchange1031Result: Exchange1031Result | undefined;
  let sellerFinancingResult: SellerFinancingResult | undefined;
  let earnoutResult: EarnoutResult | undefined;
  let waterfallResult: WaterfallResult | undefined;

  if (input.exchange1031?.enabled) {
    try {
      const oldExchange = adapt1031InputNewToOld(
        input.exchange1031,
        input.saleTerms.salePrice,
        basisLedger.totalAdjustedBasis,
        basisLedger.recaptureExposure.total,
        input.saleTerms.debtPayoff,
        totalSellingExpenses,
        input.saleCloseDate,
      );
      const oldResult = calculate1031ExchangeEngine(oldExchange);
      exchange1031Result = adapt1031ResultOldToNew(oldResult, input.exchange1031);
    } catch (err) {
      console.error('1031 engine error:', err);
    }
  }

  if (input.sellerFinancing?.enabled) {
    try {
      const oldFinancing = adaptSellerFinancingNewToOld(
        input.sellerFinancing,
        input.saleTerms.salePrice,
        basisLedger.totalAdjustedBasis,
        basisLedger.recaptureExposure.total,
        adaptTaxProfileNewToOld(input.taxProfile),
      );
      const oldResult = calculateSellerFinancing(oldFinancing);
      // Map to new type (simplified — full mapping in production)
      sellerFinancingResult = {
        noteAmount: oldResult.financedAmount,
        grossProfitRatio: (oldResult.grossProfitRatio ?? 0) * 100,
        contractPrice: input.saleTerms.salePrice,
        amortSchedule: [],
        installmentTaxSchedule: [],
        recaptureRecognizedAtSale: basisLedger.recaptureExposure.ordinary1245,
        recaptureWarning: basisLedger.recaptureExposure.ordinary1245 > 0 ? {
          code: 'RECAPTURE_ACCELERATED',
          severity: 'warning',
          title: '§ 453(i) Recapture in Year of Sale',
          message: `$${basisLedger.recaptureExposure.ordinary1245.toLocaleString()} of depreciation recapture must be recognized in the year of sale, regardless of installment payments received.`,
        } : null,
        balloonAmount: oldResult.balloonPayment ?? null,
        balloonDate: null,
        explanations: [],
        warnings: [],
      };
    } catch (err) {
      console.error('Seller financing engine error:', err);
    }
  }

  if (input.earnout?.enabled) {
    try {
      const oldEarnout = adaptEarnoutNewToOld(input.earnout);
      const oldResult = calculateEarnout(oldEarnout);
      earnoutResult = {
        tranches: oldResult.tranches?.map(t => ({
          trancheId: t.name ?? 'unknown',
          expectedValue: t.expectedPayout ?? 0,
          npv: t.presentValue ?? 0,
          afterTaxEV: t.expectedPayout ?? 0,
          afterTaxNPV: t.presentValue ?? 0,
          scenarioPayouts: [],
        })) ?? [],
        totalExpectedValue: oldResult.totalExpectedPayout ?? 0,
        totalNPV: oldResult.totalPresentValue ?? 0,
        afterTaxExpectedValue: oldResult.totalExpectedPayout ?? 0,
        afterTaxNPV: oldResult.totalPresentValue ?? 0,
        effectivePurchasePriceRange: {
          low: input.saleTerms.salePrice,
          base: input.saleTerms.salePrice + (oldResult.totalExpectedPayout ?? 0),
          high: input.saleTerms.salePrice + (oldResult.totalExpectedPayout ?? 0) * 1.5,
        },
        compensationRiskScore: 0,
        compensationRiskWarnings: [],
        tier1Completeness: 0,
        tier2Completeness: 0,
        explanations: [],
        warnings: [],
      };
    } catch (err) {
      console.error('Earnout engine error:', err);
    }
  }

  // 7. Build tax schedule from old result
  const taxFederal = (oldResult.taxResult?.federalCapitalGainsTax ?? 0) +
    (oldResult.taxResult?.depreciationRecaptureTax ?? 0);
  const taxState = oldResult.taxResult?.stateTax ?? 0;
  const taxNIIT = oldResult.taxResult?.netInvestmentIncomeTax ?? 0;
  const totalTax = oldResult.taxResult?.totalTax ?? 0;

  const taxSchedule: TaxSchedule = {
    years: [{
      taxYear: new Date(input.saleCloseDate).getFullYear(),
      ordinaryIncome: gainCharacterization.characters.find(c => c.type === 'ordinary_1245')?.amount ?? 0,
      recapture1245: gainCharacterization.characters.find(c => c.type === 'ordinary_1245')?.amount ?? 0,
      unrecaptured1250: gainCharacterization.characters.find(c => c.type === 'unrecaptured_1250')?.amount ?? 0,
      ltcg: gainCharacterization.characters.find(c => c.type === 'ltcg')?.amount ?? 0,
      interestIncome: 0,
      federalOnOrdinary: 0,
      federalOn1245: oldResult.taxResult?.depreciationRecaptureTax ?? 0,
      federalOn1250: 0,
      federalOnLTCG: oldResult.taxResult?.federalCapitalGainsTax ?? 0,
      niit: taxNIIT,
      stateTax: taxState,
      passiveLossOffset: 0,
      totalTax,
      afterTaxCash: saleComputation.cashProceedsPreTax - totalTax,
      marginalOrdinaryRate: 37,
      marginalCapitalGainsRate: 20,
    }],
    totalFederalTax: taxFederal,
    totalStateTax: taxState,
    totalNIIT: taxNIIT,
    totalTax,
    effectiveFederalRate: realizedGain > 0 ? (taxFederal / realizedGain) * 100 : 0,
    effectiveTotalRate: realizedGain > 0 ? (totalTax / realizedGain) * 100 : 0,
    explanations: [],
    warnings: [],
  };

  // 8. Compute recognized/deferred based on strategy
  const recognizedGain = exchange1031Result
    ? exchange1031Result.recognizedGain
    : realizedGain;
  const deferredGain = exchange1031Result
    ? exchange1031Result.deferredGain
    : 0;
  const totalBoot = exchange1031Result?.totalBoot ?? 0;
  const bootCash = exchange1031Result?.cashBoot ?? 0;
  const bootMortgage = exchange1031Result?.mortgageBoot ?? 0;
  const bootNonLikeKind = exchange1031Result?.nonLikeKindBoot ?? 0;

  const afterTaxCashNow = saleComputation.cashProceedsPreTax - totalTax;
  const afterTaxCashTotal = afterTaxCashNow +
    (earnoutResult?.afterTaxExpectedValue ?? 0) +
    (sellerFinancingResult?.noteAmount ?? 0);

  // 9. Build summary
  const summary: ResultsSummary = {
    adjustedBasis: basisLedger.totalAdjustedBasis,
    amountRealized,
    realizedGain,
    recognizedGain,
    deferredGain,
    totalBoot, bootCash, bootMortgage, bootNonLikeKind,
    totalTax: totalTax,
    taxFederal, taxState, taxNIIT,
    afterTaxCashNow,
    afterTaxCashTotal,
    afterTaxNPV: afterTaxCashNow, // simplified; full NPV requires discounting
  };

  // 10. Materialize KPIs
  const kpis: ExitScenarioKPIs = {
    scenarioId: input.scenarioId ?? '',
    computedAt,
    salePrice: input.saleTerms.salePrice,
    amountRealized, adjustedBasis: basisLedger.totalAdjustedBasis,
    realizedGain, recognizedGain, deferredGain,
    bootTotal: totalBoot, bootCash, bootMortgage, bootNonLikeKind,
    taxTotal: totalTax, taxFederal, taxState, taxNIIT,
    afterTaxCashNow, afterTaxCashTotal,
    afterTaxNPV: afterTaxCashNow,
    lpIRR: waterfallResult?.lpIRR ?? null,
    gpIRR: waterfallResult?.gpIRR ?? null,
    lpEquityMultiple: waterfallResult?.lpEquityMultiple ?? null,
    gpEquityMultiple: waterfallResult?.gpEquityMultiple ?? null,
    promoteEarned: waterfallResult?.gpPromoteEarned ?? null,
    weightedAverageTimingYears: null,
    strategiesActive: strategyInteractions.activeStrategies,
    hasRecaptureExposure: basisLedger.recaptureExposure.total > 0,
    hasTradeDown: exchange1031Result?.isTradeDown ?? false,
    advisorReviewRequired: strategyInteractions.advisorReviewRequired,
  };

  // 11. Aggregate warnings
  const allWarnings: Warning[] = [
    ...basisLedger.warnings,
    ...gainCharacterization.warnings,
    ...strategyInteractions.warnings,
    ...(exchange1031Result?.warnings ?? []),
    ...(sellerFinancingResult?.warnings ?? []),
    ...(earnoutResult?.warnings ?? []),
    ...(taxSchedule.warnings ?? []),
  ];

  // Stub proceeds timeline (full implementation maps all events)
  const proceedsTimeline: ProceedsTimeline = {
    events: [],
    summary: {
      totalCashAtClose: saleComputation.cashProceedsPreTax,
      totalFuturePayments: (sellerFinancingResult?.noteAmount ?? 0) + (earnoutResult?.totalExpectedValue ?? 0),
      totalNominalProceeds: saleComputation.cashProceedsPreTax + (sellerFinancingResult?.noteAmount ?? 0) + (earnoutResult?.totalExpectedValue ?? 0),
      npvFuturePayments: 0,
      discountRateUsed: 8,
      weightedAverageTimingYears: 0,
      byYear: [],
    },
  };

  return {
    engineVersion: ENGINE_VERSION,
    inputsChecksum,
    computedAt,
    basisLedger,
    saleComputation,
    gainCharacterization,
    strategyInteractions,
    proceedsTimeline,
    taxSchedule,
    exchange1031Result,
    sellerFinancingResult,
    earnoutResult,
    waterfallResult,
    kpis,
    summary,
    warnings: allWarnings,
    explanations: [],
  };
}
