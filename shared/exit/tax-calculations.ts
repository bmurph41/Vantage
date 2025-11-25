export type FilingStatus = 'single' | 'married' | 'head_of_household';
export type PropertyType = 'residential' | 'commercial' | 'marina';

export interface TaxBracket {
  min: number;
  max: number;
  rate: number;
}

export const FEDERAL_CAPITAL_GAINS_BRACKETS: Record<FilingStatus, TaxBracket[]> = {
  single: [
    { min: 0, max: 44625, rate: 0 },
    { min: 44625, max: 492300, rate: 0.15 },
    { min: 492300, max: Infinity, rate: 0.20 },
  ],
  married: [
    { min: 0, max: 89250, rate: 0 },
    { min: 89250, max: 553850, rate: 0.15 },
    { min: 553850, max: Infinity, rate: 0.20 },
  ],
  head_of_household: [
    { min: 0, max: 59750, rate: 0 },
    { min: 59750, max: 523050, rate: 0.15 },
    { min: 523050, max: Infinity, rate: 0.20 },
  ],
};

export const NIIT_THRESHOLD: Record<FilingStatus, number> = {
  single: 200000,
  married: 250000,
  head_of_household: 200000,
};

export const NIIT_RATE = 0.038;

export const DEPRECIATION_RECAPTURE_RATE = 0.25;

export const DEPRECIATION_SCHEDULES: Record<PropertyType, number> = {
  residential: 27.5,
  commercial: 39,
  marina: 39,
};

export const STATE_TAX_RATES: Record<string, number> = {
  AL: 0.05, AK: 0, AZ: 0.025, AR: 0.044, CA: 0.133,
  CO: 0.044, CT: 0.0699, DE: 0.066, FL: 0, GA: 0.0549,
  HI: 0.0725, ID: 0.058, IL: 0.0495, IN: 0.0315, IA: 0.06,
  KS: 0.057, KY: 0.04, LA: 0.0425, ME: 0.0715, MD: 0.0575,
  MA: 0.05, MI: 0.0425, MN: 0.0985, MS: 0.05, MO: 0.0495,
  MT: 0.0575, NE: 0.0584, NV: 0, NH: 0, NJ: 0.1075,
  NM: 0.059, NY: 0.109, NC: 0.0525, ND: 0.029, OH: 0.04,
  OK: 0.0475, OR: 0.099, PA: 0.0307, RI: 0.0599, SC: 0.07,
  SD: 0, TN: 0, TX: 0, UT: 0.0485, VT: 0.0875,
  VA: 0.0575, WA: 0, WV: 0.0575, WI: 0.0765, WY: 0,
  DC: 0.0975,
};

export interface TaxCalculationInput {
  salePrice: number;
  adjustedBasis: number;
  depreciationTaken: number;
  filingStatus: FilingStatus;
  adjustedGrossIncome: number;
  stateOfResidence: string;
  isHighIncome?: boolean;
  costSegregationBonus?: number;
}

export interface TaxCalculationResult {
  totalGain: number;
  capitalGain: number;
  depreciationRecapture: number;
  ordinaryIncome: number;
  federalCapitalGainsRate: number;
  federalCapitalGainsTax: number;
  federalDepreciationRecaptureTax: number;
  netInvestmentIncomeTax: number;
  stateTax: number;
  stateTaxRate: number;
  totalTaxLiability: number;
  effectiveTaxRate: number;
  afterTaxProceeds: number;
}

export function getCapitalGainsRate(
  filingStatus: FilingStatus,
  taxableIncome: number
): number {
  const brackets = FEDERAL_CAPITAL_GAINS_BRACKETS[filingStatus];
  for (const bracket of brackets) {
    if (taxableIncome >= bracket.min && taxableIncome < bracket.max) {
      return bracket.rate;
    }
  }
  return 0.20;
}

export function calculateDepreciation(
  propertyValue: number,
  landValue: number,
  propertyType: PropertyType,
  yearsHeld: number,
  costSegregationBonus: number = 0
): {
  annualDepreciation: number;
  accumulatedDepreciation: number;
  remainingBasis: number;
} {
  const improvementValue = propertyValue - landValue;
  const schedule = DEPRECIATION_SCHEDULES[propertyType];
  const annualDepreciation = improvementValue / schedule;
  const standardDepreciation = Math.min(annualDepreciation * yearsHeld, improvementValue);
  const accumulatedDepreciation = standardDepreciation + costSegregationBonus;
  const remainingBasis = propertyValue - accumulatedDepreciation;

  return {
    annualDepreciation,
    accumulatedDepreciation,
    remainingBasis,
  };
}

export function calculateTaxes(input: TaxCalculationInput): TaxCalculationResult {
  const totalGain = input.salePrice - input.adjustedBasis;
  const depreciationRecapture = Math.min(input.depreciationTaken, totalGain);
  const capitalGain = Math.max(0, totalGain - depreciationRecapture);
  const ordinaryIncome = 0;

  const taxableIncome = input.adjustedGrossIncome + capitalGain;
  const federalCapitalGainsRate = getCapitalGainsRate(input.filingStatus, taxableIncome);
  const federalCapitalGainsTax = capitalGain * federalCapitalGainsRate;
  const federalDepreciationRecaptureTax = depreciationRecapture * DEPRECIATION_RECAPTURE_RATE;

  const niitThreshold = NIIT_THRESHOLD[input.filingStatus];
  let netInvestmentIncomeTax = 0;
  if (input.adjustedGrossIncome > niitThreshold || input.isHighIncome) {
    const niitableIncome = Math.max(0, totalGain);
    netInvestmentIncomeTax = niitableIncome * NIIT_RATE;
  }

  const stateTaxRate = STATE_TAX_RATES[input.stateOfResidence.toUpperCase()] || 0;
  const stateTax = totalGain * stateTaxRate;

  const totalTaxLiability = 
    federalCapitalGainsTax + 
    federalDepreciationRecaptureTax + 
    netInvestmentIncomeTax + 
    stateTax;

  const effectiveTaxRate = totalGain > 0 ? totalTaxLiability / totalGain : 0;
  const afterTaxProceeds = input.salePrice - totalTaxLiability;

  return {
    totalGain,
    capitalGain,
    depreciationRecapture,
    ordinaryIncome,
    federalCapitalGainsRate,
    federalCapitalGainsTax,
    federalDepreciationRecaptureTax,
    netInvestmentIncomeTax,
    stateTax,
    stateTaxRate,
    totalTaxLiability,
    effectiveTaxRate,
    afterTaxProceeds,
  };
}

export interface Exchange1031Input {
  relinquishedPropertyValue: number;
  relinquishedBasis: number;
  relinquishedMortgage: number;
  replacementPropertyValue: number;
  replacementMortgage: number;
  cashBootReceived: number;
}

export interface Exchange1031Result {
  realizedGain: number;
  mortgageBoot: number;
  cashBoot: number;
  totalBoot: number;
  recognizedGain: number;
  deferredGain: number;
  newBasis: number;
  exchangePercentage: number;
  isValidExchange: boolean;
  violations: string[];
}

export function calculate1031Exchange(input: Exchange1031Input): Exchange1031Result {
  const realizedGain = input.relinquishedPropertyValue - input.relinquishedBasis;
  
  const mortgageRelief = input.relinquishedMortgage;
  const mortgageAssumed = input.replacementMortgage;
  const mortgageBoot = Math.max(0, mortgageRelief - mortgageAssumed);
  
  const cashBoot = input.cashBootReceived;
  const totalBoot = mortgageBoot + cashBoot;
  
  const recognizedGain = Math.min(realizedGain, totalBoot);
  const deferredGain = Math.max(0, realizedGain - recognizedGain);
  
  const newBasis = input.replacementPropertyValue - deferredGain;
  
  const exchangePercentage = input.relinquishedPropertyValue > 0 
    ? input.replacementPropertyValue / input.relinquishedPropertyValue 
    : 0;

  const violations: string[] = [];
  
  if (input.replacementPropertyValue < input.relinquishedPropertyValue) {
    violations.push('Replacement property value is less than relinquished property value - trading down creates boot');
  }
  
  if (input.replacementMortgage < input.relinquishedMortgage) {
    violations.push('Replacement mortgage is less than relinquished mortgage - mortgage relief creates boot');
  }
  
  if (cashBoot > 0) {
    violations.push('Cash boot received will be taxable as recognized gain');
  }

  const isValidExchange = violations.length === 0 || (recognizedGain < realizedGain);

  return {
    realizedGain,
    mortgageBoot,
    cashBoot,
    totalBoot,
    recognizedGain,
    deferredGain,
    newBasis,
    exchangePercentage,
    isValidExchange,
    violations,
  };
}

export interface InstallmentSaleInput {
  salePrice: number;
  adjustedBasis: number;
  downPayment: number;
  interestRate: number;
  termYears: number;
  filingStatus: FilingStatus;
  adjustedGrossIncome: number;
  stateOfResidence: string;
}

export interface InstallmentSaleResult {
  financedAmount: number;
  grossProfit: number;
  grossProfitRatio: number;
  monthlyPayment: number;
  annualDebtService: number;
  totalInterestIncome: number;
  annualTaxableGain: number[];
  annualInterestIncome: number[];
  annualTax: number[];
  totalTax: number;
  npvAfterTax: number;
}

export function calculateInstallmentSale(input: InstallmentSaleInput): InstallmentSaleResult {
  const financedAmount = input.salePrice - input.downPayment;
  const grossProfit = input.salePrice - input.adjustedBasis;
  const grossProfitRatio = grossProfit / input.salePrice;

  const monthlyRate = input.interestRate / 12;
  const numPayments = input.termYears * 12;
  const monthlyPayment = financedAmount * 
    (monthlyRate * Math.pow(1 + monthlyRate, numPayments)) / 
    (Math.pow(1 + monthlyRate, numPayments) - 1);
  
  const annualDebtService = monthlyPayment * 12;
  
  let balance = financedAmount;
  const annualTaxableGain: number[] = [];
  const annualInterestIncome: number[] = [];
  const annualTax: number[] = [];
  let totalInterestIncome = 0;
  let totalTax = 0;

  const capGainsRate = getCapitalGainsRate(input.filingStatus, input.adjustedGrossIncome);
  const stateTaxRate = STATE_TAX_RATES[input.stateOfResidence.toUpperCase()] || 0;

  const downPaymentGain = input.downPayment * grossProfitRatio;
  const downPaymentTax = downPaymentGain * (capGainsRate + stateTaxRate);
  annualTaxableGain.push(downPaymentGain);
  annualInterestIncome.push(0);
  annualTax.push(downPaymentTax);
  totalTax += downPaymentTax;

  for (let year = 1; year <= input.termYears; year++) {
    let yearlyInterest = 0;
    let yearlyPrincipal = 0;

    for (let month = 0; month < 12; month++) {
      if (balance <= 0) break;
      const interest = balance * monthlyRate;
      const principal = monthlyPayment - interest;
      yearlyInterest += interest;
      yearlyPrincipal += Math.min(principal, balance);
      balance -= principal;
    }

    const taxableGain = yearlyPrincipal * grossProfitRatio;
    totalInterestIncome += yearlyInterest;
    
    const gainTax = taxableGain * (capGainsRate + stateTaxRate);
    const interestTax = yearlyInterest * (0.37 + stateTaxRate);
    const yearTax = gainTax + interestTax;
    
    annualTaxableGain.push(taxableGain);
    annualInterestIncome.push(yearlyInterest);
    annualTax.push(yearTax);
    totalTax += yearTax;
  }

  const discountRate = 0.08;
  let npvAfterTax = input.downPayment - downPaymentTax;
  for (let year = 1; year <= input.termYears; year++) {
    const netCashFlow = annualDebtService - annualTax[year];
    npvAfterTax += netCashFlow / Math.pow(1 + discountRate, year);
  }

  return {
    financedAmount,
    grossProfit,
    grossProfitRatio,
    monthlyPayment,
    annualDebtService,
    totalInterestIncome,
    annualTaxableGain,
    annualInterestIncome,
    annualTax,
    totalTax,
    npvAfterTax,
  };
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatPercent(rate: number, decimals: number = 1): string {
  return `${(rate * 100).toFixed(decimals)}%`;
}
