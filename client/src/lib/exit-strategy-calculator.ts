import { sanitizePositiveNumber, sanitizePercentage, sanitizeHoldingPeriod } from './financial-validators';

export interface TaxBasisInputs {
  salePrice: number;
  costBasis: number;
  depreciationTaken: number;
  capitalImprovements: number;
}

export interface TaxRates {
  federalCapitalGainsRate: number;
  stateCapitalGainsRate: number;
  depreciationRecaptureRate: number;
  niitRate: number;
}

export const DEFAULT_TAX_RATES: TaxRates = {
  federalCapitalGainsRate: 20,
  stateCapitalGainsRate: 5,
  depreciationRecaptureRate: 25,
  niitRate: 3.8,
};

export interface TaxCalculationResult {
  adjustedBasis: number;
  totalGain: number;
  depreciationRecapture: number;
  capitalGain: number;
  depreciationRecaptureTax: number;
  federalCapitalGainsTax: number;
  stateCapitalGainsTax: number;
  niitTax: number;
  totalTaxLiability: number;
  effectiveTaxRate: number;
  netAfterTax: number;
}

export function calculateTaxLiability(
  inputs: TaxBasisInputs,
  rates: Partial<TaxRates> = {}
): TaxCalculationResult {
  const taxRates = { ...DEFAULT_TAX_RATES, ...rates };
  
  const salePrice = sanitizePositiveNumber(inputs.salePrice, 0);
  const costBasis = sanitizePositiveNumber(inputs.costBasis, 0);
  const depreciation = sanitizePositiveNumber(inputs.depreciationTaken, 0);
  const improvements = sanitizePositiveNumber(inputs.capitalImprovements, 0);
  
  const adjustedBasis = Math.max(0, costBasis + improvements - depreciation);
  const totalGain = Math.max(0, salePrice - adjustedBasis);
  
  const depreciationRecapture = Math.min(depreciation, totalGain);
  const capitalGain = Math.max(0, totalGain - depreciationRecapture);
  
  const depreciationRecaptureTax = depreciationRecapture * (taxRates.depreciationRecaptureRate / 100);
  const federalCapitalGainsTax = capitalGain * (taxRates.federalCapitalGainsRate / 100);
  const stateCapitalGainsTax = totalGain * (taxRates.stateCapitalGainsRate / 100);
  const niitTax = totalGain * (taxRates.niitRate / 100);
  
  const totalTaxLiability = depreciationRecaptureTax + federalCapitalGainsTax + stateCapitalGainsTax + niitTax;
  
  const effectiveTaxRate = totalGain > 0 ? (totalTaxLiability / totalGain) * 100 : 0;
  const netAfterTax = salePrice - totalTaxLiability;
  
  return {
    adjustedBasis,
    totalGain,
    depreciationRecapture,
    capitalGain,
    depreciationRecaptureTax,
    federalCapitalGainsTax,
    stateCapitalGainsTax,
    niitTax,
    totalTaxLiability,
    effectiveTaxRate,
    netAfterTax,
  };
}

export interface Exchange1031Inputs extends TaxBasisInputs {
  replacementPropertyValue: number;
  bootReceived: number;
  closingCosts: number;
  intermediaryFees: number;
}

export interface Exchange1031Result {
  deferredGain: number;
  recognizedGain: number;
  taxDeferred: number;
  taxDue: number;
  netCashReceived: number;
  requiredReplacementValue: number;
  minimumEquityRequired: number;
  fullDeferralAchieved: boolean;
}

export function calculate1031Exchange(
  inputs: Exchange1031Inputs,
  rates: Partial<TaxRates> = {}
): Exchange1031Result {
  const taxCalc = calculateTaxLiability(inputs, rates);
  
  const replacementValue = sanitizePositiveNumber(inputs.replacementPropertyValue, 0);
  const bootReceived = sanitizePositiveNumber(inputs.bootReceived, 0);
  const closingCosts = sanitizePositiveNumber(inputs.closingCosts, 0);
  const intermediaryFees = sanitizePositiveNumber(inputs.intermediaryFees, 0);
  
  const salePrice = sanitizePositiveNumber(inputs.salePrice, 0);
  
  const requiredReplacementValue = salePrice;
  const currentEquity = salePrice - bootReceived;
  const minimumEquityRequired = currentEquity;
  
  const fullDeferralAchieved = replacementValue >= requiredReplacementValue && bootReceived === 0;
  
  const recognizedGain = Math.min(bootReceived, taxCalc.totalGain);
  const deferredGain = taxCalc.totalGain - recognizedGain;
  
  const bootTaxRate = (taxCalc.effectiveTaxRate > 0 ? taxCalc.effectiveTaxRate : 25) / 100;
  const taxDue = recognizedGain * bootTaxRate;
  const taxDeferred = taxCalc.totalTaxLiability - taxDue;
  
  const netCashReceived = bootReceived - taxDue - closingCosts - intermediaryFees;
  
  return {
    deferredGain,
    recognizedGain,
    taxDeferred,
    taxDue,
    netCashReceived,
    requiredReplacementValue,
    minimumEquityRequired,
    fullDeferralAchieved,
  };
}

export interface DSTInputs extends TaxBasisInputs {
  investmentAmount: number;
  projectedCashOnCashReturn: number;
  holdingPeriodYears: number;
  appreciationRate: number;
  managementFeePercent: number;
}

export interface DSTResult {
  taxDeferred: number;
  annualCashFlow: number;
  totalCashFlowOverHold: number;
  projectedExitValue: number;
  projectedGainAtExit: number;
  netPresentValue: number;
  internalRateOfReturn: number;
  effectiveDeferralBenefit: number;
}

export function calculateDSTInvestment(
  inputs: DSTInputs,
  rates: Partial<TaxRates> = {}
): DSTResult {
  const taxCalc = calculateTaxLiability(inputs, rates);
  
  const investment = sanitizePositiveNumber(inputs.investmentAmount, 0);
  const cashOnCash = sanitizePercentage(inputs.projectedCashOnCashReturn, 5) / 100;
  const holdingPeriod = sanitizeHoldingPeriod(inputs.holdingPeriodYears, 7);
  const appreciation = sanitizePercentage(inputs.appreciationRate, 3) / 100;
  const mgmtFee = sanitizePercentage(inputs.managementFeePercent, 1) / 100;
  
  const taxDeferred = taxCalc.totalTaxLiability;
  
  const grossAnnualCashFlow = investment * cashOnCash;
  const annualFees = investment * mgmtFee;
  const annualCashFlow = grossAnnualCashFlow - annualFees;
  
  const totalCashFlowOverHold = annualCashFlow * holdingPeriod;
  
  const projectedExitValue = investment * Math.pow(1 + appreciation, holdingPeriod);
  const projectedGainAtExit = projectedExitValue - investment;
  
  const discountRate = 0.08;
  let npv = -investment;
  for (let year = 1; year <= holdingPeriod; year++) {
    npv += annualCashFlow / Math.pow(1 + discountRate, year);
  }
  npv += projectedExitValue / Math.pow(1 + discountRate, holdingPeriod);
  
  const totalReturns = totalCashFlowOverHold + projectedExitValue;
  const irr = Math.pow(totalReturns / investment, 1 / holdingPeriod) - 1;
  
  const deferralBenefit = taxDeferred * discountRate * holdingPeriod;
  
  return {
    taxDeferred,
    annualCashFlow,
    totalCashFlowOverHold,
    projectedExitValue,
    projectedGainAtExit,
    netPresentValue: npv,
    internalRateOfReturn: irr * 100,
    effectiveDeferralBenefit: deferralBenefit,
  };
}

export interface SellerFinancingInputs {
  salePrice: number;
  downPaymentPercent: number;
  interestRate: number;
  termYears: number;
  closingCosts: number;
}

export interface SellerFinancingResult {
  downPayment: number;
  loanAmount: number;
  monthlyPayment: number;
  totalInterestEarned: number;
  totalPaymentsReceived: number;
  effectiveYield: number;
  yearlyBreakdown: Array<{
    year: number;
    principalPaid: number;
    interestPaid: number;
    remainingBalance: number;
  }>;
}

export function calculateSellerFinancing(inputs: SellerFinancingInputs): SellerFinancingResult {
  const salePrice = sanitizePositiveNumber(inputs.salePrice, 0);
  const downPaymentPct = sanitizePercentage(inputs.downPaymentPercent, 20) / 100;
  const interestRate = sanitizePercentage(inputs.interestRate, 6) / 100;
  const termYears = sanitizeHoldingPeriod(inputs.termYears, 10);
  const closingCosts = sanitizePositiveNumber(inputs.closingCosts, 0);
  
  const downPayment = salePrice * downPaymentPct;
  const loanAmount = salePrice - downPayment;
  
  if (loanAmount <= 0 || interestRate <= 0) {
    return {
      downPayment,
      loanAmount: 0,
      monthlyPayment: 0,
      totalInterestEarned: 0,
      totalPaymentsReceived: downPayment - closingCosts,
      effectiveYield: 0,
      yearlyBreakdown: [],
    };
  }
  
  const monthlyRate = interestRate / 12;
  const numPayments = termYears * 12;
  
  const monthlyPayment = loanAmount * 
    (monthlyRate * Math.pow(1 + monthlyRate, numPayments)) /
    (Math.pow(1 + monthlyRate, numPayments) - 1);
  
  const yearlyBreakdown: SellerFinancingResult['yearlyBreakdown'] = [];
  let remainingBalance = loanAmount;
  
  for (let year = 1; year <= termYears; year++) {
    let yearPrincipal = 0;
    let yearInterest = 0;
    
    for (let month = 1; month <= 12; month++) {
      if (remainingBalance <= 0) break;
      
      const interestPayment = remainingBalance * monthlyRate;
      const principalPayment = Math.min(monthlyPayment - interestPayment, remainingBalance);
      
      yearPrincipal += principalPayment;
      yearInterest += interestPayment;
      remainingBalance -= principalPayment;
    }
    
    yearlyBreakdown.push({
      year,
      principalPaid: yearPrincipal,
      interestPaid: yearInterest,
      remainingBalance: Math.max(0, remainingBalance),
    });
  }
  
  const totalPayments = monthlyPayment * numPayments;
  const totalInterestEarned = totalPayments - loanAmount;
  const totalPaymentsReceived = downPayment + totalPayments - closingCosts;
  
  const effectiveYield = Math.pow(totalPaymentsReceived / salePrice, 1 / termYears) - 1;
  
  return {
    downPayment,
    loanAmount,
    monthlyPayment,
    totalInterestEarned,
    totalPaymentsReceived,
    effectiveYield: effectiveYield * 100,
    yearlyBreakdown,
  };
}

export interface InstallmentSaleInputs extends TaxBasisInputs {
  salePrice: number;
  downPaymentPercent: number;
  termYears: number;
  interestRate: number;
}

export interface InstallmentSaleResult {
  grossProfitRatio: number;
  recognizedGainPerYear: number[];
  taxPerYear: number[];
  totalTaxPaid: number;
  presentValueOfTax: number;
  taxSavingsVsOutrightSale: number;
}

export function calculateInstallmentSale(
  inputs: InstallmentSaleInputs,
  rates: Partial<TaxRates> = {}
): InstallmentSaleResult {
  const taxCalc = calculateTaxLiability(inputs, rates);
  
  const salePrice = sanitizePositiveNumber(inputs.salePrice, 0);
  const downPaymentPct = sanitizePercentage(inputs.downPaymentPercent, 20) / 100;
  const termYears = sanitizeHoldingPeriod(inputs.termYears, 10);
  
  if (salePrice <= 0) {
    return {
      grossProfitRatio: 0,
      recognizedGainPerYear: [],
      taxPerYear: [],
      totalTaxPaid: 0,
      presentValueOfTax: 0,
      taxSavingsVsOutrightSale: 0,
    };
  }
  
  const grossProfitRatio = taxCalc.totalGain / salePrice;
  
  const downPayment = salePrice * downPaymentPct;
  const loanAmount = salePrice - downPayment;
  const annualPrincipal = loanAmount / termYears;
  
  const effectiveTaxRate = taxCalc.effectiveTaxRate / 100;
  
  const recognizedGainPerYear: number[] = [];
  const taxPerYear: number[] = [];
  
  const year0Gain = downPayment * grossProfitRatio;
  recognizedGainPerYear.push(year0Gain);
  taxPerYear.push(year0Gain * effectiveTaxRate);
  
  for (let year = 1; year <= termYears; year++) {
    const yearGain = annualPrincipal * grossProfitRatio;
    recognizedGainPerYear.push(yearGain);
    taxPerYear.push(yearGain * effectiveTaxRate);
  }
  
  const totalTaxPaid = taxPerYear.reduce((sum, tax) => sum + tax, 0);
  
  const discountRate = 0.06;
  let presentValueOfTax = taxPerYear[0];
  for (let year = 1; year < taxPerYear.length; year++) {
    presentValueOfTax += taxPerYear[year] / Math.pow(1 + discountRate, year);
  }
  
  const taxSavingsVsOutrightSale = taxCalc.totalTaxLiability - presentValueOfTax;
  
  return {
    grossProfitRatio,
    recognizedGainPerYear,
    taxPerYear,
    totalTaxPaid,
    presentValueOfTax,
    taxSavingsVsOutrightSale,
  };
}
