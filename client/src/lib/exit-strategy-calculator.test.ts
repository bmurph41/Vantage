import { describe, it, expect } from 'vitest';
import {
  calculateTaxLiability,
  calculate1031Exchange,
  calculateDSTInvestment,
  calculateSellerFinancing,
  calculateInstallmentSale,
  DEFAULT_TAX_RATES,
} from './exit-strategy-calculator';

describe('calculateTaxLiability', () => {
  const baseInputs = {
    salePrice: 5000000,
    costBasis: 3500000,
    depreciationTaken: 500000,
    capitalImprovements: 200000,
  };

  it('calculates adjusted basis correctly', () => {
    const result = calculateTaxLiability(baseInputs);
    expect(result.adjustedBasis).toBe(3200000);
  });

  it('calculates total gain correctly', () => {
    const result = calculateTaxLiability(baseInputs);
    expect(result.totalGain).toBe(1800000);
  });

  it('separates depreciation recapture from capital gain', () => {
    const result = calculateTaxLiability(baseInputs);
    expect(result.depreciationRecapture).toBe(500000);
    expect(result.capitalGain).toBe(1300000);
  });

  it('calculates tax components correctly', () => {
    const result = calculateTaxLiability(baseInputs);
    expect(result.depreciationRecaptureTax).toBe(125000);
    expect(result.federalCapitalGainsTax).toBe(260000);
    expect(result.stateCapitalGainsTax).toBe(90000);
    expect(result.niitTax).toBeCloseTo(68400, 0);
  });

  it('calculates total tax liability', () => {
    const result = calculateTaxLiability(baseInputs);
    expect(result.totalTaxLiability).toBeCloseTo(543400, 0);
  });

  it('calculates effective tax rate', () => {
    const result = calculateTaxLiability(baseInputs);
    expect(result.effectiveTaxRate).toBeCloseTo(30.19, 1);
  });

  it('handles zero depreciation', () => {
    const inputs = { ...baseInputs, depreciationTaken: 0 };
    const result = calculateTaxLiability(inputs);
    expect(result.depreciationRecapture).toBe(0);
    expect(result.depreciationRecaptureTax).toBe(0);
  });

  it('handles custom tax rates', () => {
    const result = calculateTaxLiability(baseInputs, {
      federalCapitalGainsRate: 15,
      stateCapitalGainsRate: 0,
    });
    expect(result.federalCapitalGainsTax).toBe(195000);
    expect(result.stateCapitalGainsTax).toBe(0);
  });

  it('handles negative inputs by defaulting to zero', () => {
    const inputs = { ...baseInputs, salePrice: -1000 };
    const result = calculateTaxLiability(inputs);
    expect(result.salePrice).toBeUndefined;
    expect(result.totalGain).toBe(0);
  });

  it('caps depreciation recapture at total gain', () => {
    const inputs = { ...baseInputs, depreciationTaken: 2000000 };
    const result = calculateTaxLiability(inputs);
    expect(result.depreciationRecapture).toBeLessThanOrEqual(result.totalGain);
  });
});

describe('calculate1031Exchange', () => {
  const baseInputs = {
    salePrice: 5000000,
    costBasis: 3500000,
    depreciationTaken: 500000,
    capitalImprovements: 200000,
    replacementPropertyValue: 5500000,
    bootReceived: 0,
    closingCosts: 50000,
    intermediaryFees: 10000,
  };

  it('achieves full deferral when requirements met', () => {
    const result = calculate1031Exchange(baseInputs);
    expect(result.fullDeferralAchieved).toBe(true);
    expect(result.recognizedGain).toBe(0);
    expect(result.taxDue).toBe(0);
  });

  it('calculates tax on boot received', () => {
    const inputs = { ...baseInputs, bootReceived: 500000 };
    const result = calculate1031Exchange(inputs);
    expect(result.fullDeferralAchieved).toBe(false);
    expect(result.recognizedGain).toBe(500000);
    expect(result.taxDue).toBeGreaterThan(0);
  });

  it('calculates deferred gain correctly', () => {
    const result = calculate1031Exchange(baseInputs);
    const taxCalc = calculateTaxLiability(baseInputs);
    expect(result.deferredGain).toBe(taxCalc.totalGain);
  });

  it('calculates required replacement value', () => {
    const result = calculate1031Exchange(baseInputs);
    expect(result.requiredReplacementValue).toBe(5000000);
  });

  it('calculates net cash after fees', () => {
    const inputs = { ...baseInputs, bootReceived: 200000 };
    const result = calculate1031Exchange(inputs);
    expect(result.netCashReceived).toBeLessThan(200000);
  });

  it('handles partial exchange with boot', () => {
    const inputs = {
      ...baseInputs,
      replacementPropertyValue: 4000000,
      bootReceived: 1000000,
    };
    const result = calculate1031Exchange(inputs);
    expect(result.fullDeferralAchieved).toBe(false);
    expect(result.deferredGain).toBeLessThan(1800000);
  });
});

describe('calculateDSTInvestment', () => {
  const baseInputs = {
    salePrice: 5000000,
    costBasis: 3500000,
    depreciationTaken: 500000,
    capitalImprovements: 200000,
    investmentAmount: 1000000,
    projectedCashOnCashReturn: 6,
    holdingPeriodYears: 7,
    appreciationRate: 3,
    managementFeePercent: 1,
  };

  it('calculates tax deferred correctly', () => {
    const result = calculateDSTInvestment(baseInputs);
    const taxCalc = calculateTaxLiability(baseInputs);
    expect(result.taxDeferred).toBe(taxCalc.totalTaxLiability);
  });

  it('calculates annual cash flow', () => {
    const result = calculateDSTInvestment(baseInputs);
    expect(result.annualCashFlow).toBe(50000);
  });

  it('calculates total cash flow over hold period', () => {
    const result = calculateDSTInvestment(baseInputs);
    expect(result.totalCashFlowOverHold).toBe(350000);
  });

  it('calculates projected exit value with appreciation', () => {
    const result = calculateDSTInvestment(baseInputs);
    expect(result.projectedExitValue).toBeGreaterThan(1000000);
  });

  it('calculates positive IRR for valid inputs', () => {
    const result = calculateDSTInvestment(baseInputs);
    expect(result.internalRateOfReturn).toBeGreaterThan(0);
  });

  it('calculates deferral benefit', () => {
    const result = calculateDSTInvestment(baseInputs);
    expect(result.effectiveDeferralBenefit).toBeGreaterThan(0);
  });

  it('handles different holding periods', () => {
    const shortHold = calculateDSTInvestment({ ...baseInputs, holdingPeriodYears: 5 });
    const longHold = calculateDSTInvestment({ ...baseInputs, holdingPeriodYears: 15 });
    expect(longHold.totalCashFlowOverHold).toBeGreaterThan(shortHold.totalCashFlowOverHold);
  });
});

describe('calculateSellerFinancing', () => {
  const baseInputs = {
    salePrice: 5000000,
    downPaymentPercent: 20,
    interestRate: 6,
    termYears: 10,
    closingCosts: 50000,
  };

  it('calculates down payment correctly', () => {
    const result = calculateSellerFinancing(baseInputs);
    expect(result.downPayment).toBe(1000000);
  });

  it('calculates loan amount correctly', () => {
    const result = calculateSellerFinancing(baseInputs);
    expect(result.loanAmount).toBe(4000000);
  });

  it('calculates monthly payment', () => {
    const result = calculateSellerFinancing(baseInputs);
    expect(result.monthlyPayment).toBeGreaterThan(0);
    expect(result.monthlyPayment).toBeCloseTo(44406, -1);
  });

  it('calculates total interest earned', () => {
    const result = calculateSellerFinancing(baseInputs);
    expect(result.totalInterestEarned).toBeGreaterThan(0);
  });

  it('generates yearly breakdown', () => {
    const result = calculateSellerFinancing(baseInputs);
    expect(result.yearlyBreakdown).toHaveLength(10);
    expect(result.yearlyBreakdown[0].year).toBe(1);
    expect(result.yearlyBreakdown[9].remainingBalance).toBeCloseTo(0, -2);
  });

  it('calculates effective yield', () => {
    const result = calculateSellerFinancing(baseInputs);
    expect(result.effectiveYield).toBeGreaterThan(0);
  });

  it('handles 100% down payment', () => {
    const inputs = { ...baseInputs, downPaymentPercent: 100 };
    const result = calculateSellerFinancing(inputs);
    expect(result.loanAmount).toBe(0);
    expect(result.monthlyPayment).toBe(0);
  });

  it('handles different interest rates', () => {
    const lowRate = calculateSellerFinancing({ ...baseInputs, interestRate: 4 });
    const highRate = calculateSellerFinancing({ ...baseInputs, interestRate: 8 });
    expect(highRate.monthlyPayment).toBeGreaterThan(lowRate.monthlyPayment);
    expect(highRate.totalInterestEarned).toBeGreaterThan(lowRate.totalInterestEarned);
  });

  it('yearly principal increases over time', () => {
    const result = calculateSellerFinancing(baseInputs);
    const firstYear = result.yearlyBreakdown[0];
    const lastYear = result.yearlyBreakdown[9];
    expect(lastYear.principalPaid).toBeGreaterThan(firstYear.principalPaid);
  });

  it('yearly interest decreases over time', () => {
    const result = calculateSellerFinancing(baseInputs);
    const firstYear = result.yearlyBreakdown[0];
    const lastYear = result.yearlyBreakdown[9];
    expect(lastYear.interestPaid).toBeLessThan(firstYear.interestPaid);
  });
});

describe('calculateInstallmentSale', () => {
  const baseInputs = {
    salePrice: 5000000,
    costBasis: 3500000,
    depreciationTaken: 500000,
    capitalImprovements: 200000,
    downPaymentPercent: 20,
    termYears: 10,
    interestRate: 6,
  };

  it('calculates gross profit ratio', () => {
    const result = calculateInstallmentSale(baseInputs);
    expect(result.grossProfitRatio).toBeCloseTo(0.36, 2);
  });

  it('generates recognized gain per year', () => {
    const result = calculateInstallmentSale(baseInputs);
    expect(result.recognizedGainPerYear.length).toBe(11);
  });

  it('generates tax per year', () => {
    const result = calculateInstallmentSale(baseInputs);
    expect(result.taxPerYear.length).toBe(11);
  });

  it('calculates total tax paid', () => {
    const result = calculateInstallmentSale(baseInputs);
    expect(result.totalTaxPaid).toBeGreaterThan(0);
  });

  it('calculates present value of tax', () => {
    const result = calculateInstallmentSale(baseInputs);
    expect(result.presentValueOfTax).toBeLessThan(result.totalTaxPaid);
  });

  it('shows tax savings vs outright sale', () => {
    const result = calculateInstallmentSale(baseInputs);
    expect(result.taxSavingsVsOutrightSale).toBeGreaterThan(0);
  });

  it('first year gain includes down payment portion', () => {
    const result = calculateInstallmentSale(baseInputs);
    const downPayment = 5000000 * 0.20;
    expect(result.recognizedGainPerYear[0]).toBeCloseTo(downPayment * result.grossProfitRatio, -2);
  });
});
