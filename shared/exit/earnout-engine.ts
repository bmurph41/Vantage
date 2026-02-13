export interface EarnoutEngineInput {
  basePurchasePrice: number;
  tranches: EarnoutTranche[];
  discountRate: number;
  holdingPeriodYears: number;
  taxProfile?: {
    filingStatus: 'single' | 'married' | 'head_of_household';
    otherOrdinaryIncome: number;
    otherInvestmentIncome?: number;
    stateOfResidence: string;
    taxYear?: number;
  };
}

export interface EarnoutTranche {
  name: string;
  maxAmount: number;
  metric: string;
  threshold: number;
  measurementPeriod: { startYear: number; endYear: number };
  paymentTiming: 'at_measurement' | 'annual' | 'at_close';
  probabilityOfAchievement: number;
  taxTreatment: 'capital_gain' | 'ordinary_income' | 'mixed';
  escalationRate?: number;
}

export interface EarnoutTrancheResult {
  name: string;
  maxAmount: number;
  probabilityWeightedAmount: number;
  expectedPaymentYear: number;
  npvOfTranche: number;
  taxTreatment: string;
  effectiveTaxRate: number;
  afterTaxAmount: number;
  scenarios: EarnoutScenarioOutcome[];
}

export interface EarnoutScenarioOutcome {
  label: string;
  probability: number;
  amount: number;
  npv: number;
}

export interface EarnoutEngineResult {
  tranches: EarnoutTrancheResult[];
  totalMaxEarnout: number;
  totalExpectedEarnout: number;
  totalNpvEarnout: number;
  totalAfterTaxEarnout: number;
  effectivePurchasePrice: number;
  effectivePurchasePriceNpv: number;
  earnoutAsPercentOfTotal: number;
  riskMetrics: EarnoutRiskMetrics;
  warnings: EarnoutWarning[];
}

export interface EarnoutRiskMetrics {
  weightedAverageProbability: number;
  maxDownside: number;
  expectedValueVariance: number;
  coefficientOfVariation: number;
}

export interface EarnoutWarning {
  code: string;
  severity: 'info' | 'warning' | 'error';
  message: string;
}

import { STATE_CAPITAL_GAINS_RATES, getTaxYearConfig } from './tax-engine';
import type { FilingStatus } from './tax-engine';

export function calculateEarnout(input: EarnoutEngineInput): EarnoutEngineResult {
  const warnings: EarnoutWarning[] = [];

  // Compute dynamic tax rates from tax-engine when profile is provided;
  // fall back to hardcoded max-bracket rates for backward compatibility.
  let dynamicCapGainRate = 0.238;
  let dynamicOrdinaryRate = 0.407;
  if (input.taxProfile) {
    const taxConfig = getTaxYearConfig(input.taxProfile.taxYear || 2025);
    const filingStatus = input.taxProfile.filingStatus as FilingStatus;
    const taxableIncome = input.taxProfile.otherOrdinaryIncome;
    const brackets = taxConfig.federalLtcgBrackets[filingStatus];
    let ltcgRate = 0.20;
    for (const bracket of brackets) {
      if (taxableIncome >= bracket.min && taxableIncome < bracket.max) {
        ltcgRate = bracket.rate;
        break;
      }
    }
    // Add NIIT if applicable
    const niitThreshold = taxConfig.niitThresholds[filingStatus];
    const magi = taxableIncome + (input.taxProfile.otherInvestmentIncome || 0);
    const niitRate = magi > niitThreshold ? taxConfig.niitRate : 0;
    // Add state rate
    const stateInfo = STATE_CAPITAL_GAINS_RATES[input.taxProfile.stateOfResidence.toUpperCase()];
    const stateRate = stateInfo ? stateInfo.rate : 0;

    dynamicCapGainRate = ltcgRate + niitRate + stateRate;
    dynamicOrdinaryRate = taxConfig.ordinaryTopRate + niitRate + stateRate;
  }

  const trancheResults: EarnoutTrancheResult[] = input.tranches.map(tranche => {
    const prob = Math.max(0, Math.min(1, tranche.probabilityOfAchievement));
    const probabilityWeightedAmount = tranche.maxAmount * prob;

    const expectedPaymentYear = tranche.paymentTiming === 'at_close'
      ? 0
      : tranche.measurementPeriod.endYear;

    const npvOfTranche = probabilityWeightedAmount / Math.pow(1 + input.discountRate, expectedPaymentYear);

    const taxRates: Record<string, number> = {
      capital_gain: dynamicCapGainRate,
      ordinary_income: dynamicOrdinaryRate,
      mixed: (dynamicCapGainRate + dynamicOrdinaryRate) / 2,
    };
    const effectiveTaxRate = taxRates[tranche.taxTreatment] ?? 0.32;
    const afterTaxAmount = probabilityWeightedAmount * (1 - effectiveTaxRate);

    const scenarios: EarnoutScenarioOutcome[] = [
      {
        label: 'Full Achievement',
        probability: prob * 0.6,
        amount: tranche.maxAmount,
        npv: tranche.maxAmount / Math.pow(1 + input.discountRate, expectedPaymentYear),
      },
      {
        label: 'Partial Achievement (75%)',
        probability: prob * 0.25,
        amount: tranche.maxAmount * 0.75,
        npv: (tranche.maxAmount * 0.75) / Math.pow(1 + input.discountRate, expectedPaymentYear),
      },
      {
        label: 'Partial Achievement (50%)',
        probability: prob * 0.10,
        amount: tranche.maxAmount * 0.50,
        npv: (tranche.maxAmount * 0.50) / Math.pow(1 + input.discountRate, expectedPaymentYear),
      },
      {
        label: 'Not Achieved',
        probability: 1 - prob,
        amount: 0,
        npv: 0,
      },
    ];

    return {
      name: tranche.name,
      maxAmount: tranche.maxAmount,
      probabilityWeightedAmount,
      expectedPaymentYear,
      npvOfTranche,
      taxTreatment: tranche.taxTreatment,
      effectiveTaxRate,
      afterTaxAmount,
      scenarios,
    };
  });

  const totalMaxEarnout = trancheResults.reduce((sum, t) => sum + t.maxAmount, 0);
  const totalExpectedEarnout = trancheResults.reduce((sum, t) => sum + t.probabilityWeightedAmount, 0);
  const totalNpvEarnout = trancheResults.reduce((sum, t) => sum + t.npvOfTranche, 0);
  const totalAfterTaxEarnout = trancheResults.reduce((sum, t) => sum + t.afterTaxAmount, 0);

  const effectivePurchasePrice = input.basePurchasePrice + totalExpectedEarnout;
  const effectivePurchasePriceNpv = input.basePurchasePrice + totalNpvEarnout;
  const earnoutAsPercentOfTotal = effectivePurchasePrice > 0
    ? totalExpectedEarnout / effectivePurchasePrice
    : 0;

  const weightedAverageProbability = totalMaxEarnout > 0
    ? input.tranches.reduce((sum, t) => sum + t.probabilityOfAchievement * t.maxAmount, 0) / totalMaxEarnout
    : 0;

  const maxDownside = input.basePurchasePrice;

  const outcomes = trancheResults.flatMap(t => t.scenarios);
  const totalScenarioValues = outcomes.map(o => o.amount * o.probability);
  const mean = totalScenarioValues.reduce((a, b) => a + b, 0) / (totalScenarioValues.length || 1);
  const variance = totalScenarioValues.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / (totalScenarioValues.length || 1);
  const coefficientOfVariation = mean > 0 ? Math.sqrt(variance) / mean : 0;

  const riskMetrics: EarnoutRiskMetrics = {
    weightedAverageProbability,
    maxDownside,
    expectedValueVariance: variance,
    coefficientOfVariation,
  };

  if (earnoutAsPercentOfTotal > 0.40) {
    warnings.push({
      code: 'HIGH_EARNOUT_PROPORTION',
      severity: 'warning',
      message: `Earnout represents ${(earnoutAsPercentOfTotal * 100).toFixed(0)}% of total deal value. High earn-out proportion increases execution risk.`,
    });
  }

  if (weightedAverageProbability < 0.50) {
    warnings.push({
      code: 'LOW_PROBABILITY',
      severity: 'warning',
      message: `Weighted average probability of ${(weightedAverageProbability * 100).toFixed(0)}% suggests significant risk of non-achievement.`,
    });
  }

  const maxPaymentYear = Math.max(...input.tranches.map(t => t.measurementPeriod.endYear));
  if (maxPaymentYear > 5) {
    warnings.push({
      code: 'LONG_MEASUREMENT',
      severity: 'info',
      message: `Measurement period extends ${maxPaymentYear} years. Extended periods increase uncertainty and discount impact.`,
    });
  }

  const hasOrdinary = input.tranches.some(t => t.taxTreatment === 'ordinary_income');
  if (hasOrdinary) {
    warnings.push({
      code: 'ORDINARY_INCOME_TREATMENT',
      severity: 'info',
      message: 'Some earnout tranches will be taxed as ordinary income. Consider structuring as installment sale if possible.',
    });
  }

  return {
    tranches: trancheResults,
    totalMaxEarnout,
    totalExpectedEarnout,
    totalNpvEarnout,
    totalAfterTaxEarnout,
    effectivePurchasePrice,
    effectivePurchasePriceNpv,
    earnoutAsPercentOfTotal,
    riskMetrics,
    warnings,
  };
}
