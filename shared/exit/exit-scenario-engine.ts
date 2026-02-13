import type { BasisLedgerInput, BasisCalculationResult } from './basis-ledger';
import { calculateBasisLedger } from './basis-ledger';
import type { GainAllocationInput, TaxProfileInput, TaxEngineResult } from './tax-engine';
import { runTaxEngine } from './tax-engine';
import type { Exchange1031EngineInput, Exchange1031EngineResult } from './exchange-1031-engine';
import { calculate1031ExchangeEngine } from './exchange-1031-engine';
import type { DstEngineInput, DstEngineResult } from './dst-engine';
import { calculateDstAnalysis } from './dst-engine';
import type { SellerFinancingEngineInput, SellerFinancingEngineResult } from './seller-financing-engine';
import { calculateSellerFinancing } from './seller-financing-engine';
import type { EarnoutEngineInput, EarnoutEngineResult } from './earnout-engine';
import { calculateEarnout } from './earnout-engine';
import type { WaterfallV2Input, WaterfallV2Result } from './waterfall-engine-v2';
import { calculateWaterfallV2 } from './waterfall-engine-v2';
import { calculateIRR, calculateXIRR } from './irr-calculator';

export type ExitStrategyType = 'cash_sale' | 'exchange_1031' | 'seller_financing' | 'dst_investment' | 'hybrid';

export interface ExitScenarioInput {
  scenarioName: string;
  scenarioType: ExitStrategyType;

  property: {
    purchasePrice: number;
    acquisitionCosts: number;
    landValue: number;
    improvementValue: number;
    personalPropertyValue?: number;
    depreciationScheduleYears: number;
    holdingPeriodYears: number;
    capitalAdditionsByYear?: Record<number, number>;
    costSegregationBonus?: number;
    costSegregationYear?: number;
    prior1031DeferredGain?: number;
    prior1031CarryoverBasis?: number;
  };

  sale: {
    salePrice: number;
    brokerCommissionRate: number;
    closingCosts: number;
    holdingPeriodMonths: number;
  };

  debt: {
    outstandingBalance: number;
    prepaymentPenalty: number;
    refinanceEvents?: RefinanceEvent[];
  };

  taxProfile: TaxProfileInput;

  exchange1031?: Omit<Exchange1031EngineInput, 'relinquishedProperty' | 'saleDate'> & { saleDate: string };
  dstInvestment?: DstEngineInput;
  sellerFinancing?: Omit<SellerFinancingEngineInput, 'salePrice' | 'adjustedBasis' | 'accumulatedDepreciation' | 'taxProfile'>;
  earnout?: EarnoutEngineInput;
  waterfall?: WaterfallV2Input;

  installmentSale?: {
    enabled: boolean;
    downPaymentPercent: number;
    termYears: number;
    interestRate: number;
  };
}

export interface RefinanceEvent {
  year: number;
  newLoanAmount: number;
  interestRate: number;
  termYears: number;
  cashOutProceeds: number;
  closingCosts: number;
}

export interface ExitScenarioResult {
  scenarioName: string;
  scenarioType: ExitStrategyType;
  runTimestamp: string;

  basisLedger: BasisCalculationResult;

  grossSaleProceeds: number;
  costsOfSale: number;
  netSaleProceeds: number;
  debtPayoff: number;
  prepaymentPenalty: number;
  beforeTaxEquityProceeds: number;

  taxResult: TaxEngineResult;
  afterTaxEquityProceeds: number;

  exchange1031Result?: Exchange1031EngineResult;
  dstResult?: DstEngineResult;
  sellerFinancingResult?: SellerFinancingEngineResult;
  earnoutResult?: EarnoutEngineResult;
  waterfallResult?: WaterfallV2Result;

  refinanceSummary: RefinanceSummary | null;

  returns: {
    irr: number | null;
    moic: number;
    cashOnCash: number;
    annualizedReturn: number;
    totalEquityInvested: number;
    totalCashReturned: number;
  };

  comparisonMetrics: {
    effectiveTaxRate: number;
    deferredGain: number;
    npvOfTaxSavings: number;
    riskScore: number;
  };

  warnings: ScenarioWarning[];
  disclaimer: string;
}

export interface RefinanceSummary {
  events: RefinanceEventResult[];
  totalCashOutProceeds: number;
  totalClosingCosts: number;
  netCashOut: number;
  currentLoanBalance: number;
}

export interface RefinanceEventResult {
  year: number;
  newLoanAmount: number;
  cashOutProceeds: number;
  closingCosts: number;
  netCashOut: number;
  isTaxFree: boolean;
}

export interface ScenarioWarning {
  code: string;
  severity: 'info' | 'warning' | 'error';
  message: string;
  source: string;
}

const DISCLAIMER = 'This analysis is for informational purposes only and does not constitute tax, legal, or financial advice. Consult qualified professionals before making investment decisions. Tax laws change frequently; calculations use estimates based on current law.';

export function runExitScenario(input: ExitScenarioInput): ExitScenarioResult {
  const allWarnings: ScenarioWarning[] = [];

  const basisInput: BasisLedgerInput = {
    originalPurchasePrice: input.property.purchasePrice,
    acquisitionCosts: input.property.acquisitionCosts,
    landValueAtAcquisition: input.property.landValue,
    improvementValueAtAcquisition: input.property.improvementValue,
    personalPropertyValue: input.property.personalPropertyValue,
    depreciationScheduleYears: input.property.depreciationScheduleYears,
    holdingPeriodYears: input.property.holdingPeriodYears,
    capitalAdditionsByYear: input.property.capitalAdditionsByYear,
    hasCostSegregation: !!input.property.costSegregationBonus,
    costSegregationBonus: input.property.costSegregationBonus,
    costSegregationYear: input.property.costSegregationYear,
    prior1031DeferredGain: input.property.prior1031DeferredGain,
    prior1031CarryoverBasis: input.property.prior1031CarryoverBasis,
  };

  const basisLedger = calculateBasisLedger(basisInput);

  const costsOfSale = (input.sale.salePrice * input.sale.brokerCommissionRate) + input.sale.closingCosts;
  const netSaleProceeds = input.sale.salePrice - costsOfSale;

  let refinanceSummary: RefinanceSummary | null = null;
  let currentDebtBalance = input.debt.outstandingBalance;
  let totalRefCashOut = 0;

  if (input.debt.refinanceEvents && input.debt.refinanceEvents.length > 0) {
    const refResults: RefinanceEventResult[] = input.debt.refinanceEvents.map(evt => {
      const netCashOut = evt.cashOutProceeds - evt.closingCosts;
      totalRefCashOut += netCashOut;
      currentDebtBalance = evt.newLoanAmount;

      return {
        year: evt.year,
        newLoanAmount: evt.newLoanAmount,
        cashOutProceeds: evt.cashOutProceeds,
        closingCosts: evt.closingCosts,
        netCashOut,
        isTaxFree: true,
      };
    });

    refinanceSummary = {
      events: refResults,
      totalCashOutProceeds: refResults.reduce((s, r) => s + r.cashOutProceeds, 0),
      totalClosingCosts: refResults.reduce((s, r) => s + r.closingCosts, 0),
      netCashOut: totalRefCashOut,
      currentLoanBalance: currentDebtBalance,
    };

    allWarnings.push({
      code: 'REFI_TAX_FREE',
      severity: 'info',
      message: `Refinance cash-out proceeds of ${formatCurrency(totalRefCashOut)} are not taxable events.`,
      source: 'refinance',
    });
  }

  const debtPayoff = currentDebtBalance;
  const prepaymentPenalty = input.debt.prepaymentPenalty;
  const beforeTaxEquityProceeds = netSaleProceeds - debtPayoff - prepaymentPenalty;

  const gainInput: GainAllocationInput = {
    grossSalePrice: input.sale.salePrice,
    costsOfSale,
    basisResult: basisLedger,
    holdingPeriodMonths: input.sale.holdingPeriodMonths,
    installmentSale: input.installmentSale,
  };

  const taxResult = runTaxEngine(gainInput, input.taxProfile);

  for (const w of taxResult.warnings) {
    allWarnings.push({ ...w, source: 'tax_engine' });
  }

  const afterTaxEquityProceeds = beforeTaxEquityProceeds - taxResult.totalTaxLiability;

  let exchange1031Result: Exchange1031EngineResult | undefined;
  if (input.scenarioType === 'exchange_1031' && input.exchange1031) {
    const exchangeInput: Exchange1031EngineInput = {
      relinquishedProperty: {
        salePrice: input.sale.salePrice,
        adjustedBasis: basisLedger.adjustedBasis,
        accumulatedDepreciation: basisLedger.accumulatedCostRecovery,
        mortgageBalance: debtPayoff,
        closingCosts: costsOfSale,
      },
      saleDate: input.exchange1031.saleDate,
      replacementProperties: input.exchange1031.replacementProperties,
      qualifiedIntermediaryFee: input.exchange1031.qualifiedIntermediaryFee,
      additionalCashInvested: input.exchange1031.additionalCashInvested,
      isTicOrDst: input.exchange1031.isTicOrDst,
      isReverseExchange: input.exchange1031.isReverseExchange,
      isImprovementExchange: input.exchange1031.isImprovementExchange,
    };

    exchange1031Result = calculate1031ExchangeEngine(exchangeInput);

    for (const w of exchange1031Result.warnings) {
      allWarnings.push({ ...w, source: '1031_exchange' });
    }
  }

  let dstResult: DstEngineResult | undefined;
  if ((input.scenarioType === 'dst_investment' || input.scenarioType === 'hybrid') && input.dstInvestment) {
    dstResult = calculateDstAnalysis(input.dstInvestment);

    for (const rf of dstResult.riskFlags) {
      allWarnings.push({
        code: `DST_${rf.category.toUpperCase()}`,
        severity: rf.severity === 'high' ? 'warning' : 'info',
        message: `${rf.title}: ${rf.description}`,
        source: 'dst_analysis',
      });
    }
  }

  let sellerFinancingResult: SellerFinancingEngineResult | undefined;
  if (input.scenarioType === 'seller_financing' && input.sellerFinancing) {
    const sfInput: SellerFinancingEngineInput = {
      salePrice: input.sale.salePrice,
      adjustedBasis: basisLedger.adjustedBasis,
      accumulatedDepreciation: basisLedger.accumulatedCostRecovery,
      ...input.sellerFinancing,
      taxProfile: {
        filingStatus: input.taxProfile.filingStatus,
        otherOrdinaryIncome: input.taxProfile.otherOrdinaryIncome,
        stateOfResidence: input.taxProfile.stateOfResidence,
        taxYear: input.taxProfile.taxYear,
      },
    };

    sellerFinancingResult = calculateSellerFinancing(sfInput);

    for (const w of sellerFinancingResult.warnings) {
      allWarnings.push({ ...w, source: 'seller_financing' });
    }
  }

  let earnoutResult: EarnoutEngineResult | undefined;
  if (input.earnout) {
    earnoutResult = calculateEarnout(input.earnout);
    for (const w of earnoutResult.warnings) {
      allWarnings.push({ ...w, source: 'earnout' });
    }
  }

  let waterfallResult: WaterfallV2Result | undefined;
  if (input.waterfall) {
    waterfallResult = calculateWaterfallV2(input.waterfall);
    for (const w of waterfallResult.warnings) {
      allWarnings.push({ ...w, source: 'waterfall' });
    }
  }

  const totalEquityInvested = input.property.purchasePrice + input.property.acquisitionCosts - input.debt.outstandingBalance;
  const totalCashReturned = afterTaxEquityProceeds + totalRefCashOut;

  const moic = totalEquityInvested > 0 ? totalCashReturned / totalEquityInvested : 0;
  const annualizedReturn = input.property.holdingPeriodYears > 0
    ? Math.pow(moic, 1 / input.property.holdingPeriodYears) - 1
    : 0;
  const cashOnCash = totalEquityInvested > 0 ? afterTaxEquityProceeds / totalEquityInvested : 0;

  const investmentCashFlows = [
    { period: 0, amount: totalEquityInvested, type: 'investment' as const },
    { period: input.property.holdingPeriodYears, amount: totalCashReturned, type: 'distribution' as const },
  ];
  const irr = calculateIRR(investmentCashFlows);

  const deferredGain = exchange1031Result?.totalDeferredGain || 0;

  let npvOfTaxSavings = 0;
  if (deferredGain > 0) {
    const estTaxOnDeferred = deferredGain * taxResult.effectiveTaxRate;
    const deferralYears = 10;
    npvOfTaxSavings = estTaxOnDeferred * (1 - 1 / Math.pow(1.06, deferralYears));
  }

  if (taxResult.installmentNpvSavings && taxResult.installmentNpvSavings > 0) {
    npvOfTaxSavings += taxResult.installmentNpvSavings;
  }

  let riskScore = 2;
  if (input.scenarioType === 'exchange_1031') riskScore = 4;
  if (input.scenarioType === 'seller_financing') riskScore = 5;
  if (input.scenarioType === 'dst_investment') riskScore = 6;
  if (input.scenarioType === 'hybrid') riskScore = 7;
  if (input.earnout) riskScore += 2;

  return {
    scenarioName: input.scenarioName,
    scenarioType: input.scenarioType,
    runTimestamp: new Date().toISOString(),

    basisLedger,

    grossSaleProceeds: input.sale.salePrice,
    costsOfSale,
    netSaleProceeds,
    debtPayoff,
    prepaymentPenalty,
    beforeTaxEquityProceeds,

    taxResult,
    afterTaxEquityProceeds,

    exchange1031Result,
    dstResult,
    sellerFinancingResult,
    earnoutResult,
    waterfallResult,

    refinanceSummary,

    returns: {
      irr,
      moic,
      cashOnCash,
      annualizedReturn,
      totalEquityInvested,
      totalCashReturned,
    },

    comparisonMetrics: {
      effectiveTaxRate: taxResult.effectiveTaxRate,
      deferredGain,
      npvOfTaxSavings,
      riskScore,
    },

    warnings: allWarnings,
    disclaimer: DISCLAIMER,
  };
}

export function compareExitScenarios(
  scenarios: ExitScenarioResult[]
): {
  scenarioRankings: { scenarioName: string; score: number; rank: number }[];
  bestByAfterTax: string;
  bestByIrr: string;
  bestByRisk: string;
  summary: { scenarioName: string; afterTaxProceeds: number; irr: number | null; effectiveTaxRate: number; riskScore: number; deferredGain: number }[];
} {
  const summary = scenarios.map(s => ({
    scenarioName: s.scenarioName,
    afterTaxProceeds: s.afterTaxEquityProceeds,
    irr: s.returns.irr,
    effectiveTaxRate: s.comparisonMetrics.effectiveTaxRate,
    riskScore: s.comparisonMetrics.riskScore,
    deferredGain: s.comparisonMetrics.deferredGain,
  }));

  const maxProceeds = Math.max(...summary.map(s => s.afterTaxProceeds));
  const maxIrr = Math.max(...summary.map(s => s.irr || 0));
  const maxRisk = Math.max(...summary.map(s => s.riskScore));

  const rankings = summary.map(s => {
    const proceedsScore = maxProceeds > 0 ? (s.afterTaxProceeds / maxProceeds) * 40 : 0;
    const irrScore = maxIrr > 0 ? ((s.irr || 0) / maxIrr) * 35 : 0;
    const riskScore = maxRisk > 0 ? ((maxRisk - s.riskScore) / maxRisk) * 25 : 0;
    return { scenarioName: s.scenarioName, score: proceedsScore + irrScore + riskScore, rank: 0 };
  });

  rankings.sort((a, b) => b.score - a.score);
  rankings.forEach((r, i) => { r.rank = i + 1; });

  const bestByAfterTax = [...summary].sort((a, b) => b.afterTaxProceeds - a.afterTaxProceeds)[0]?.scenarioName || '';
  const bestByIrr = [...summary].sort((a, b) => (b.irr || 0) - (a.irr || 0))[0]?.scenarioName || '';
  const bestByRisk = [...summary].sort((a, b) => a.riskScore - b.riskScore)[0]?.scenarioName || '';

  return {
    scenarioRankings: rankings,
    bestByAfterTax,
    bestByIrr,
    bestByRisk,
    summary,
  };
}

export function exportScenarioToJson(result: ExitScenarioResult): string {
  return JSON.stringify(result, null, 2);
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}
