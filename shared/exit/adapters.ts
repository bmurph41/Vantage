// ============================================================
// Exit Strategy Studio — Engine Adapters
// Bridges existing engine I/O types to the new v2 contracts
// without modifying the existing engines.
// ============================================================

import type { BasisLedgerInput as OldBasisInput, BasisCalculationResult } from './basis-ledger';
import type { Exchange1031EngineInput, Exchange1031EngineResult } from './exchange-1031-engine';
import type { SellerFinancingEngineInput, SellerFinancingEngineResult } from './seller-financing-engine';
import type { EarnoutEngineInput, EarnoutEngineResult } from './earnout-engine';
import type { WaterfallV2Input, WaterfallV2Result } from './waterfall-engine-v2';
import type { TaxProfileInput as OldTaxProfile, TaxEngineResult } from './tax-engine';
import type { ExitScenarioInput as OldScenarioInput } from './exit-scenario-engine';

import type {
  BasisLedgerInput as NewBasisInput,
  BasisLedgerOutput,
  BucketBasisSummary,
  RecaptureExposure,
} from './types/02-basis-ledger';
import type {
  SaleTermsInput,
  SaleComputation,
  GainCharacterization,
} from './types/03-sale-and-gain';
import type {
  Exchange1031Input,
  Exchange1031Result,
  SellerFinancingInput,
  SellerFinancingResult,
  EarnoutInput,
  EarnoutResult,
} from './types/04-strategy-inputs';
import type {
  TaxProfileInput as NewTaxProfile,
  TaxSchedule,
  WaterfallInput,
  WaterfallResult,
} from './types/05-waterfall-tax';
import type { ExitScenarioInput as NewScenarioInput } from './types/07-master-types';

// ============================================================
// Basis Ledger: New → Old (so we can call existing calculateBasisLedger)
// ============================================================
export function adaptBasisInputNewToOld(input: NewBasisInput): OldBasisInput {
  const buildingBucket = input.buckets.find(b => b.key === 'building');
  const landBucket = input.buckets.find(b => b.key === 'land');
  const ffeBucket = input.buckets.find(b => b.key === 'ffe');

  // Compute hold period from acquisition/disposition dates
  const acqDate = new Date(input.acquisitionDate);
  const dispDate = new Date(input.dispositionDate);
  const holdYears = Math.max(1, Math.round(
    (dispDate.getTime() - acqDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000)
  ));

  // Sum capex by year
  const capitalAdditionsByYear: Record<number, number> = {};
  for (const entry of input.capexSchedule) {
    if (entry.treatment === 'capitalized') {
      const year = new Date(entry.date).getFullYear() - acqDate.getFullYear() + 1;
      capitalAdditionsByYear[year] = (capitalAdditionsByYear[year] || 0) + entry.amount;
    }
  }

  return {
    originalPurchasePrice: input.purchasePrice,
    acquisitionCosts: 0, // Included in purchase price in new model
    landValueAtAcquisition: landBucket?.allocatedAmount ?? 0,
    improvementValueAtAcquisition: buildingBucket?.allocatedAmount ?? 0,
    personalPropertyValue: ffeBucket?.allocatedAmount ?? 0,
    depreciationScheduleYears: buildingBucket?.usefulLifeYears ?? 39,
    holdingPeriodYears: holdYears,
    capitalAdditionsByYear: Object.keys(capitalAdditionsByYear).length > 0
      ? capitalAdditionsByYear : undefined,
    hasCostSegregation: (input.costSegGroups?.length ?? 0) > 0,
    costSegregationBonus: input.costSegGroups?.reduce(
      (sum, g) => sum + g.bonusTaken, 0
    ),
  };
}

// ============================================================
// Basis Ledger: Old Result → New Output
// ============================================================
export function adaptBasisResultOldToNew(
  result: BasisCalculationResult,
  input: NewBasisInput,
  inputChecksum: string,
): BasisLedgerOutput {
  const bucketSummary: BucketBasisSummary[] = input.buckets.map(bucket => {
    const capex = input.capexSchedule
      .filter(c => c.bucket === bucket.key && c.treatment === 'capitalized')
      .reduce((sum, c) => sum + c.amount, 0);

    return {
      key: bucket.key,
      originalCost: bucket.allocatedAmount,
      capexAdded: capex,
      accumulatedDepreciation: bucket.accumulatedDepreciation,
      adjustedBasis: bucket.allocatedAmount + capex - bucket.accumulatedDepreciation,
      depreciationCharacter: bucket.depreciationCharacter,
    };
  });

  const recaptureExposure: RecaptureExposure = {
    ordinary1245: result.section1245Recapture,
    unrecaptured1250: result.straightLineRecapture,
    total: result.section1245Recapture + result.straightLineRecapture,
  };

  const totalGain = input.purchasePrice - result.adjustedBasis; // simplified preview

  return {
    totalAdjustedBasis: result.adjustedBasis,
    bucketSummary,
    recaptureExposure,
    recapturePreview: {
      ordinary1245: recaptureExposure.ordinary1245,
      unrecaptured1250: recaptureExposure.unrecaptured1250,
      ltcg: Math.max(0, totalGain - recaptureExposure.total),
      totalGain,
      highRecaptureExposure: recaptureExposure.total > totalGain * 0.3,
      installmentWillAccelerateRecapture: recaptureExposure.ordinary1245 > 0,
      recapturePercent: totalGain > 0 ? (recaptureExposure.total / totalGain) * 100 : 0,
    },
    warnings: [],
    explanations: [],
    inputChecksum,
  };
}

// ============================================================
// 1031 Exchange: New → Old
// ============================================================
export function adapt1031InputNewToOld(
  input: Exchange1031Input,
  salePrice: number,
  adjustedBasis: number,
  accumulatedDepreciation: number,
  mortgageBalance: number,
  closingCosts: number,
  saleDate: string,
): Exchange1031EngineInput {
  return {
    relinquishedProperty: {
      salePrice,
      adjustedBasis,
      accumulatedDepreciation,
      mortgageBalance,
      closingCosts,
    },
    saleDate,
    replacementProperties: input.replacementProperties.map(rp => ({
      name: rp.name ?? 'Replacement Property',
      purchasePrice: rp.purchasePrice,
      newMortgage: rp.replacementDebtPlaced,
      closingCosts: rp.closingCosts,
      identificationPriority: 'primary' as const,
    })),
    qualifiedIntermediaryFee: input.qi.qiFee,
    additionalCashInvested: input.boot.additionalCashIn,
  };
}

// ============================================================
// 1031 Exchange: Old Result → New
// ============================================================
export function adapt1031ResultOldToNew(
  result: Exchange1031EngineResult,
  input: Exchange1031Input,
): Exchange1031Result {
  return {
    cashBoot: result.cashBoot ?? 0,
    mortgageBoot: result.mortgageBoot ?? 0,
    nonLikeKindBoot: input.boot.nonLikeKindPropertyRetainedValue,
    totalBoot: result.totalBoot,
    recognizedGain: result.recognizedGain,
    deferredGain: result.deferredGain,
    carryoverBasis: result.newBasis,
    replacementBasisAllocation: input.replacementProperties.map(rp => ({
      propertyId: rp.id,
      propertyName: rp.name,
      allocatedBasis: rp.purchasePrice, // simplified; full calc needed
      purchasePrice: rp.purchasePrice,
      embeddedDeferredGain: result.deferredGain / input.replacementProperties.length,
    })),
    relinquishedDebt: result.relinquishedMortgage ?? 0,
    replacementDebtTotal: result.replacementMortgage ?? 0,
    netDebtRelief: (result.relinquishedMortgage ?? 0) - (result.replacementMortgage ?? 0),
    isTradeDown: result.isTradeDown ?? false,
    tradeDownWarnings: [],
    bootExplainers: [],
    explanations: [],
    warnings: (result.warnings ?? []).map(w => ({
      code: w.code ?? 'EXCHANGE_WARNING',
      severity: w.severity === 'error' ? 'critical' as const : w.severity as any,
      title: w.message,
      message: w.message,
    })),
  };
}

// ============================================================
// Seller Financing: New → Old
// ============================================================
export function adaptSellerFinancingNewToOld(
  input: SellerFinancingInput,
  salePrice: number,
  adjustedBasis: number,
  accumulatedDepreciation: number,
  taxProfile: OldTaxProfile,
): SellerFinancingEngineInput {
  return {
    salePrice,
    adjustedBasis,
    accumulatedDepreciation,
    downPayment: input.downPayment,
    interestRate: input.interestRate / 100,
    termYears: input.termYears,
    amortizationYears: input.amortizationYears,
    hasBalloonPayment: input.hasBalloon,
    balloonYear: input.balloonAtYear,
    taxProfile,
  } as any; // cast to match existing engine interface
}

// ============================================================
// Earnout: New → Old
// ============================================================
export function adaptEarnoutNewToOld(input: EarnoutInput): EarnoutEngineInput {
  return {
    tranches: input.tranches.map(t => ({
      name: t.name ?? `Tranche ${t.order}`,
      metric: t.metricType,
      payoutType: t.payoutType === 'fixed_dollars' ? 'fixed' : 'percentage',
      threshold: t.threshold ?? 0,
      maxPayout: t.capAmount ?? Infinity,
      minPayout: t.floorAmount ?? 0,
      payoutPercentage: (t.payoutPercent ?? 0) / 100,
      measurementStartYear: new Date(t.measurementPeriodStart).getFullYear(),
      measurementEndYear: new Date(t.measurementPeriodEnd).getFullYear(),
      scenarios: t.scenarios.map(s => ({
        label: s.label,
        metricValue: s.metricValue,
        probability: s.probability / 100,
      })),
    })),
    discountRate: input.discountRate / 100,
  } as any; // cast to match existing engine
}

// ============================================================
// Tax Profile: New → Old
// ============================================================
export function adaptTaxProfileNewToOld(input: NewTaxProfile): OldTaxProfile {
  return {
    filingStatus: input.filingStatus === 'mfj' ? 'married' :
      input.filingStatus === 'hoh' ? 'head_of_household' : 'single',
    stateOfResidence: input.stateCode,
    adjustedGrossIncome: input.otherOrdinaryIncome ?? 0,
    isHighIncome: input.niitEnabled,
    hasPassiveLosses: input.passiveLossEnabled ?? false,
    suspendedPassiveLosses: input.suspendedPassiveLosses ?? 0,
  } as any; // cast to match existing engine
}

// ============================================================
// Full Scenario: New → Old (for running existing exit-scenario-engine)
// ============================================================
export function adaptScenarioInputNewToOld(input: NewScenarioInput): OldScenarioInput {
  const holdYears = input.holdPeriodYears ??
    Math.round((new Date(input.saleCloseDate).getTime() -
    new Date(input.allocation.acquisitionDate).getTime()) /
    (365.25 * 24 * 60 * 60 * 1000));

  const landBucket = input.allocation.buckets.find(b => b.key === 'land');
  const buildingBucket = input.allocation.buckets.find(b => b.key === 'building');
  const ffeBucket = input.allocation.buckets.find(b => b.key === 'ffe');

  const totalSellingExpenses = input.saleTerms.sellingExpenses
    .reduce((sum, e) => sum + e.computedAmount, 0);

  return {
    scenarioName: input.name,
    scenarioType: input.exchange1031?.enabled ? 'exchange_1031' :
      input.sellerFinancing?.enabled ? 'seller_financing' :
      input.earnout?.enabled ? 'hybrid' : 'cash_sale',
    property: {
      purchasePrice: input.allocation.purchasePrice,
      acquisitionCosts: 0,
      landValue: landBucket?.allocatedAmount ?? 0,
      improvementValue: buildingBucket?.allocatedAmount ?? 0,
      personalPropertyValue: ffeBucket?.allocatedAmount ?? 0,
      depreciationScheduleYears: buildingBucket?.usefulLifeYears ?? 39,
      holdingPeriodYears: holdYears,
    },
    sale: {
      salePrice: input.saleTerms.salePrice,
      brokerCommissionRate: (() => {
        const broker = input.saleTerms.sellingExpenses.find(
          e => e.category === 'broker_commission'
        );
        return broker?.percentOfSale ? broker.percentOfSale / 100 : 0.04;
      })(),
      closingCosts: totalSellingExpenses,
      holdingPeriodMonths: holdYears * 12,
    },
    debt: {
      outstandingBalance: input.saleTerms.debtPayoff,
      prepaymentPenalty: input.saleTerms.prepaymentPenalty,
    },
    taxProfile: adaptTaxProfileNewToOld(input.taxProfile),
  };
}
