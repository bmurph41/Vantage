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

export interface ClosingCostLineItem {
  label: string;
  amount: number;
  category: 'broker' | 'title' | 'transfer_tax' | 'recording' | 'escrow' | 'legal' | 'other';
}

export interface ClosingCostsBreakdown {
  brokerCommission: number;
  brokerCommissionRate: number;
  titleAndEscrow: number;
  transferTax: number;
  docStamps: number;
  recordingFees: number;
  legalFees: number;
  otherClosingCosts: number;
  totalClosingCosts: number;
  lineItems: ClosingCostLineItem[];
}

export interface GainBreakdown {
  grossSalePrice: number;
  totalClosingCosts: number;
  netSaleProceeds: number;
  adjustedBasis: number;
  totalRealizedGain: number;
  depreciationRecapture: number;
  depreciationRecaptureRate: number;
  capitalGain: number;
  capitalGainRate: number;
  section1245Recapture: number;
  isLongTerm: boolean;
}

export interface TaxDeferredBreakdown {
  recaptureTaxAvoided: number;
  capitalGainsTaxAvoided: number;
  stateTaxAvoided: number;
  niitAvoided: number;
  totalTaxDeferred: number;
  newCarryoverBasis: number;
  embeddedGain: number;
}

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
    closingCostsBreakdown?: ClosingCostLineItem[];
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
  closingCostsBreakdown: ClosingCostsBreakdown;
  netSaleProceeds: number;
  debtPayoff: number;
  prepaymentPenalty: number;
  beforeTaxEquityProceeds: number;

  gainBreakdown: GainBreakdown;
  taxResult: TaxEngineResult;
  taxDeferredBreakdown?: TaxDeferredBreakdown;
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
    taxDeferredAmount: number;
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

/**
 * Build itemized closing costs breakdown.
 * When detailed line items are provided, uses them directly.
 * When only a lump sum is provided, estimates common categories.
 */
function buildClosingCostsBreakdown(
  brokerCommission: number,
  brokerCommissionRate: number,
  otherClosingCosts: number,
  detailedItems?: ClosingCostLineItem[],
): ClosingCostsBreakdown {
  const lineItems: ClosingCostLineItem[] = [
    { label: 'Broker Commission', amount: brokerCommission, category: 'broker' },
  ];

  let titleAndEscrow = 0;
  let transferTax = 0;
  let docStamps = 0;
  let recordingFees = 0;
  let legalFees = 0;
  let otherCosts = 0;

  if (detailedItems && detailedItems.length > 0) {
    // Use provided detailed breakdown
    for (const item of detailedItems) {
      lineItems.push(item);
      switch (item.category) {
        case 'title': titleAndEscrow += item.amount; break;
        case 'transfer_tax': transferTax += item.amount; break;
        case 'recording': docStamps += item.amount; recordingFees += item.amount; break;
        case 'escrow': titleAndEscrow += item.amount; break;
        case 'legal': legalFees += item.amount; break;
        default: otherCosts += item.amount; break;
      }
    }
  } else if (otherClosingCosts > 0) {
    // Estimate common breakdown from lump sum (typical commercial allocation)
    titleAndEscrow = Math.round(otherClosingCosts * 0.30);
    transferTax = Math.round(otherClosingCosts * 0.25);
    docStamps = Math.round(otherClosingCosts * 0.15);
    recordingFees = Math.round(otherClosingCosts * 0.05);
    legalFees = Math.round(otherClosingCosts * 0.15);
    otherCosts = otherClosingCosts - titleAndEscrow - transferTax - docStamps - recordingFees - legalFees;

    lineItems.push(
      { label: 'Title Insurance & Escrow', amount: titleAndEscrow, category: 'title' },
      { label: 'Transfer Tax', amount: transferTax, category: 'transfer_tax' },
      { label: 'Documentary Stamps', amount: docStamps, category: 'recording' },
      { label: 'Recording Fees', amount: recordingFees, category: 'recording' },
      { label: 'Legal / Attorney Fees', amount: legalFees, category: 'legal' },
    );
    if (otherCosts > 0) {
      lineItems.push({ label: 'Other Closing Costs', amount: otherCosts, category: 'other' });
    }
  }

  return {
    brokerCommission,
    brokerCommissionRate,
    titleAndEscrow,
    transferTax,
    docStamps,
    recordingFees,
    legalFees,
    otherClosingCosts: otherCosts,
    totalClosingCosts: brokerCommission + otherClosingCosts,
    lineItems,
  };
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

  // Build detailed closing costs breakdown
  const brokerCommission = input.sale.salePrice * input.sale.brokerCommissionRate;
  const closingCostsBreakdown: ClosingCostsBreakdown = buildClosingCostsBreakdown(
    brokerCommission,
    input.sale.brokerCommissionRate,
    input.sale.closingCosts,
    input.sale.closingCostsBreakdown,
  );

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

  // --- 1031 exchange must be computed BEFORE tax so we can adjust the taxable gain ---
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

  // For 1031 exchanges, only the recognized gain (boot) is taxable, not the full gain.
  // Build an adjusted gain input that caps the taxable gain at recognizedGain.
  let taxGainInput = gainInput;
  if (input.scenarioType === 'exchange_1031' && exchange1031Result) {
    const recognizedGain = exchange1031Result.totalRecognizedGain;
    if (recognizedGain === 0) {
      // Full deferral: no tax at all
      taxGainInput = { ...gainInput, _overrideTotalGainToZero: true } as any;
    }
    // Note: for partial boot, the full tax engine runs on full gain, then we
    // cap the actual liability to boot-only tax below.
  }

  const fullTaxResult = runTaxEngine(gainInput, input.taxProfile);

  // Compute the effective tax result: for 1031, cap tax to recognized gain only
  let taxResult = fullTaxResult;
  let afterTaxEquityProceeds: number;

  if (input.scenarioType === 'exchange_1031' && exchange1031Result) {
    const recognizedGain = exchange1031Result.totalRecognizedGain;
    const fullGain = fullTaxResult.gainAllocation.totalGain;

    if (recognizedGain <= 0) {
      // Full deferral → $0 tax
      afterTaxEquityProceeds = beforeTaxEquityProceeds;
      taxResult = {
        ...fullTaxResult,
        totalTaxLiability: 0,
        effectiveTaxRate: 0,
        afterTaxProceeds: fullTaxResult.gainAllocation.netSalePrice,
      };
      allWarnings.push({
        code: '1031_FULL_DEFERRAL',
        severity: 'info',
        message: `Full 1031 deferral: ${formatCurrency(fullGain)} gain deferred. $0 tax due.`,
        source: '1031_exchange',
      });
    } else {
      // Partial deferral: tax only on recognizedGain, pro-rated from full tax
      const gainRatio = fullGain > 0 ? recognizedGain / fullGain : 0;
      const bootTaxLiability = fullTaxResult.totalTaxLiability * gainRatio;
      afterTaxEquityProceeds = beforeTaxEquityProceeds - bootTaxLiability;
      taxResult = {
        ...fullTaxResult,
        totalTaxLiability: bootTaxLiability,
        effectiveTaxRate: recognizedGain > 0 ? bootTaxLiability / recognizedGain : 0,
        afterTaxProceeds: fullTaxResult.gainAllocation.netSalePrice - bootTaxLiability,
      };
      allWarnings.push({
        code: '1031_PARTIAL_DEFERRAL',
        severity: 'info',
        message: `Partial 1031 deferral: ${formatCurrency(recognizedGain)} recognized (boot), ${formatCurrency(fullGain - recognizedGain)} deferred.`,
        source: '1031_exchange',
      });
    }
  } else {
    afterTaxEquityProceeds = beforeTaxEquityProceeds - taxResult.totalTaxLiability;
  }

  for (const w of fullTaxResult.warnings) {
    allWarnings.push({ ...w, source: 'tax_engine' });
  }

  // Build gain decomposition
  const gainBreakdown: GainBreakdown = {
    grossSalePrice: input.sale.salePrice,
    totalClosingCosts: costsOfSale,
    netSaleProceeds,
    adjustedBasis: basisLedger.adjustedBasis,
    totalRealizedGain: fullTaxResult.gainAllocation.totalGain,
    depreciationRecapture: basisLedger.straightLineRecapture,
    depreciationRecaptureRate: 0.25, // §1250 unrecaptured rate
    capitalGain: Math.max(0, fullTaxResult.gainAllocation.totalGain - basisLedger.straightLineRecapture - basisLedger.section1245Recapture),
    capitalGainRate: fullTaxResult.gainAllocation.isLongTerm ? 0.20 : fullTaxResult.effectiveTaxRate,
    section1245Recapture: basisLedger.section1245Recapture,
    isLongTerm: fullTaxResult.gainAllocation.isLongTerm,
  };

  // Build tax-deferred breakdown for 1031 exchanges
  let taxDeferredBreakdown: TaxDeferredBreakdown | undefined;
  if (input.scenarioType === 'exchange_1031' && exchange1031Result && exchange1031Result.totalDeferredGain > 0) {
    const totalGain = Math.max(1, fullTaxResult.gainAllocation.totalGain);
    const stateRate = fullTaxResult.dualState.residenceState.rate;
    const recaptureAmt = Math.min(basisLedger.straightLineRecapture, exchange1031Result.totalDeferredGain);
    const capitalGainAmt = exchange1031Result.totalDeferredGain - recaptureAmt;
    const recaptureFedRate = 0.25;
    const ltcgFedRate = fullTaxResult.gainAllocation.isLongTerm ? fullTaxResult.federal.ltcgRate : fullTaxResult.effectiveTaxRate;
    const niitRate = fullTaxResult.federal.niitApplies ? (fullTaxResult.federal.niitTax / totalGain) : 0;

    const recaptureTaxAvoided = recaptureAmt * (recaptureFedRate + stateRate);
    const capitalGainsTaxAvoided = capitalGainAmt * (ltcgFedRate + stateRate);
    const stateTaxAvoided = exchange1031Result.totalDeferredGain * stateRate;
    const niitAvoided = exchange1031Result.totalDeferredGain * niitRate;

    taxDeferredBreakdown = {
      recaptureTaxAvoided,
      capitalGainsTaxAvoided,
      stateTaxAvoided,
      niitAvoided,
      totalTaxDeferred: fullTaxResult.totalTaxLiability - taxResult.totalTaxLiability,
      newCarryoverBasis: exchange1031Result.newAggregatedBasis,
      embeddedGain: exchange1031Result.totalDeferredGain,
    };
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

  // Guard: holdingPeriodYears <= 0 would cause Infinity
  let annualizedReturn = 0;
  if (input.property.holdingPeriodYears <= 0) {
    annualizedReturn = 0;
    allWarnings.push({
      code: 'ZERO_HOLDING_PERIOD',
      severity: 'warning',
      message: 'Holding period is zero — annualized return cannot be computed.',
      source: 'orchestrator',
    });
  } else {
    annualizedReturn = Math.pow(moic, 1 / input.property.holdingPeriodYears) - 1;
  }

  const cashOnCash = totalEquityInvested > 0 ? afterTaxEquityProceeds / totalEquityInvested : 0;

  // Build full cashflow timeline including intermediate refi cash-outs (T-3)
  const investmentCashFlows: { period: number; amount: number; type: 'investment' | 'distribution' | 'intermediate' }[] = [
    { period: 0, amount: totalEquityInvested, type: 'investment' as const },
  ];

  // Add each refi cash-out as an intermediate distribution at its year
  if (refinanceSummary && refinanceSummary.events.length > 0) {
    for (const refiEvt of refinanceSummary.events) {
      if (refiEvt.netCashOut > 0) {
        investmentCashFlows.push({
          period: refiEvt.year,
          amount: refiEvt.netCashOut,
          type: 'intermediate' as const,
        });
      }
    }
  }

  // Terminal distribution = after-tax equity proceeds at exit (NOT including refi already counted)
  investmentCashFlows.push({
    period: input.property.holdingPeriodYears,
    amount: afterTaxEquityProceeds,
    type: 'distribution' as const,
  });

  const irr = calculateIRR(investmentCashFlows);

  const deferredGain = exchange1031Result?.totalDeferredGain || 0;

  let npvOfTaxSavings = 0;
  // Tax deferred = what would have been owed minus what is actually owed
  const taxDeferredAmount = fullTaxResult.totalTaxLiability - taxResult.totalTaxLiability;
  if (taxDeferredAmount > 0) {
    const deferralYears = 10;
    npvOfTaxSavings = taxDeferredAmount * (1 - 1 / Math.pow(1.06, deferralYears));
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
    closingCostsBreakdown,
    netSaleProceeds,
    debtPayoff,
    prepaymentPenalty,
    beforeTaxEquityProceeds,

    gainBreakdown,
    taxResult,
    taxDeferredBreakdown,
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
      taxDeferredAmount,
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
