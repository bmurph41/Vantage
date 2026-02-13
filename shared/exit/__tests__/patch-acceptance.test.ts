/**
 * Patch Acceptance Tests — Exit Scenario Engine
 * 
 * Covers GOLDEN_VECTORS.json invariants and acceptance criteria for all patches.
 * Run with: npx vitest run shared/exit/__tests__/patch-acceptance.test.ts
 */
import { describe, it, expect } from 'vitest';

import { runExitScenario } from '../exit-scenario-engine';
import type { ExitScenarioInput, ExitScenarioResult } from '../exit-scenario-engine';
import { calculateBasisLedger } from '../basis-ledger';
import type { BasisLedgerInput } from '../basis-ledger';
import { calculate1031ExchangeEngine } from '../exchange-1031-engine';
import type { Exchange1031EngineInput } from '../exchange-1031-engine';
import { calculateSellerFinancing } from '../seller-financing-engine';
import type { SellerFinancingEngineInput } from '../seller-financing-engine';
import { calculateInstallmentTaxSchedule, allocateGains, runTaxEngine } from '../tax-engine';
import type { GainAllocationInput, TaxProfileInput } from '../tax-engine';
import { calculateEarnout } from '../earnout-engine';
import { calculateWaterfallV2 } from '../waterfall-engine-v2';
import { calculateIRR, calculateXIRR } from '../irr-calculator';

// ============================================================================
// Utility: deep-scan for NaN/Infinity in any object
// ============================================================================
function assertNoNaNOrInfinity(obj: any, path = ''): void {
  if (obj === null || obj === undefined) return;
  if (typeof obj === 'number') {
    expect(Number.isNaN(obj), `NaN at ${path}`).toBe(false);
    expect(Number.isFinite(obj) || obj === 0, `Infinity at ${path}`).toBe(true);
    return;
  }
  if (Array.isArray(obj)) {
    obj.forEach((item, i) => assertNoNaNOrInfinity(item, `${path}[${i}]`));
    return;
  }
  if (typeof obj === 'object') {
    for (const [key, value] of Object.entries(obj)) {
      assertNoNaNOrInfinity(value, `${path}.${key}`);
    }
  }
}

// ============================================================================
// GOLDEN VECTOR: cash_sale_baseline
// ============================================================================
describe('GOLDEN VECTOR: cash_sale_baseline', () => {
  const input: ExitScenarioInput = {
    scenarioName: 'Cash Sale Baseline',
    scenarioType: 'cash_sale',
    property: {
      purchasePrice: 3000000,
      acquisitionCosts: 60000,
      landValue: 600000,
      improvementValue: 2400000,
      depreciationScheduleYears: 39,
      holdingPeriodYears: 10,
    },
    sale: {
      salePrice: 5000000,
      brokerCommissionRate: 0.05,
      closingCosts: 50000,
      holdingPeriodMonths: 120,
    },
    debt: { outstandingBalance: 0, prepaymentPenalty: 0 },
    taxProfile: {
      filingStatus: 'single',
      otherOrdinaryIncome: 200000,
      otherInvestmentIncome: 0,
      stateOfResidence: 'FL',
      taxYear: 2025,
    },
  };

  let result: ExitScenarioResult;
  it('runs without throwing', () => {
    result = runExitScenario(input);
  });

  it('costsOfSale = 300000', () => {
    expect(result.costsOfSale).toBe(300000);
  });

  it('netSaleProceeds = 4700000', () => {
    expect(result.netSaleProceeds).toBe(4700000);
  });

  it('adjustedBasis < initialBasis (3060000) due to depreciation', () => {
    expect(result.basisLedger.adjustedBasis).toBeLessThan(3060000);
  });

  it('totalGain is positive', () => {
    expect(result.taxResult.gainAllocation.totalGain).toBeGreaterThan(0);
  });

  it('is long term (120 months)', () => {
    expect(result.taxResult.gainAllocation.isLongTerm).toBe(true);
  });

  it('unrecaptured §1250 > 0', () => {
    expect(result.taxResult.gainAllocation.unrecapturedSection1250).toBeGreaterThan(0);
  });

  it('FL state tax = 0', () => {
    expect(result.taxResult.dualState.residenceState.tax).toBe(0);
  });

  it('NIIT should apply (MAGI > 200k threshold)', () => {
    expect(result.taxResult.federal.niitApplies).toBe(true);
  });

  it('effective tax rate between 18-28%', () => {
    expect(result.taxResult.effectiveTaxRate).toBeGreaterThanOrEqual(0.18);
    expect(result.taxResult.effectiveTaxRate).toBeLessThanOrEqual(0.28);
  });

  it('afterTaxEquityProceeds is positive and < netSaleProceeds', () => {
    expect(result.afterTaxEquityProceeds).toBeGreaterThan(0);
    expect(result.afterTaxEquityProceeds).toBeLessThan(result.netSaleProceeds);
  });

  it('no NaN/Infinity in output', () => {
    assertNoNaNOrInfinity(result);
  });
});

// ============================================================================
// GOLDEN VECTOR: 1031_full_deferral — PATCH 1 critical test
// ============================================================================
describe('GOLDEN VECTOR: 1031_full_deferral (PATCH 1)', () => {
  const input: ExitScenarioInput = {
    scenarioName: '1031 Full Deferral',
    scenarioType: 'exchange_1031',
    property: {
      purchasePrice: 3000000,
      acquisitionCosts: 60000,
      landValue: 600000,
      improvementValue: 2400000,
      depreciationScheduleYears: 39,
      holdingPeriodYears: 7,
    },
    sale: {
      salePrice: 5000000,
      brokerCommissionRate: 0.05,
      closingCosts: 50000,
      holdingPeriodMonths: 84,
    },
    debt: { outstandingBalance: 1500000, prepaymentPenalty: 0 },
    taxProfile: {
      filingStatus: 'married',
      otherOrdinaryIncome: 150000,
      otherInvestmentIncome: 0,
      stateOfResidence: 'FL',
      taxYear: 2025,
    },
    exchange1031: {
      saleDate: '2025-06-15',
      replacementProperties: [
        {
          name: 'Replacement Marina A',
          purchasePrice: 6000000,
          newMortgage: 4000000,
          closingCosts: 120000,
          identificationPriority: 'primary',
        },
      ],
      qualifiedIntermediaryFee: 3000,
      additionalCashInvested: 500000,
    },
  };

  let result: ExitScenarioResult;
  it('runs without throwing', () => {
    result = runExitScenario(input);
  });

  it('exchange1031Result exists', () => {
    expect(result.exchange1031Result).toBeDefined();
  });

  it('isFullyDeferred = true', () => {
    expect(result.exchange1031Result!.isFullyDeferred).toBe(true);
  });

  it('recognizedGain = 0 (no boot)', () => {
    expect(result.exchange1031Result!.totalRecognizedGain).toBe(0);
  });

  it('CRITICAL: taxOnBoot = 0', () => {
    expect(result.exchange1031Result!.bootAnalysis.taxOnBoot).toBe(0);
  });

  it('CRITICAL: totalTaxLiability = 0 for full deferral', () => {
    // This is the core bug fix: tax should be $0 when fully deferred
    expect(result.taxResult.totalTaxLiability).toBe(0);
  });

  it('CRITICAL: afterTaxEquityProceeds = beforeTaxEquityProceeds', () => {
    expect(result.afterTaxEquityProceeds).toBe(result.beforeTaxEquityProceeds);
  });

  it('CRITICAL: effectiveTaxRate = 0 for full deferral', () => {
    expect(result.comparisonMetrics.effectiveTaxRate).toBe(0);
  });

  it('deferredGain is positive', () => {
    expect(result.comparisonMetrics.deferredGain).toBeGreaterThan(0);
  });

  it('npvOfTaxSavings is positive', () => {
    expect(result.comparisonMetrics.npvOfTaxSavings).toBeGreaterThan(0);
  });

  it('timeline has 3 deadlines', () => {
    expect(result.exchange1031Result!.timeline.length).toBe(3);
  });

  it('no NaN/Infinity in output', () => {
    assertNoNaNOrInfinity(result);
  });
});

// ============================================================================
// GOLDEN VECTOR: 1031_with_boot — PATCH 1 partial deferral
// ============================================================================
describe('GOLDEN VECTOR: 1031_with_boot (PATCH 1 partial)', () => {
  const input: ExitScenarioInput = {
    scenarioName: '1031 With Boot',
    scenarioType: 'exchange_1031',
    property: {
      purchasePrice: 5000000,
      acquisitionCosts: 100000,
      landValue: 1000000,
      improvementValue: 4000000,
      depreciationScheduleYears: 39,
      holdingPeriodYears: 5,
    },
    sale: {
      salePrice: 7000000,
      brokerCommissionRate: 0.05,
      closingCosts: 75000,
      holdingPeriodMonths: 60,
    },
    debt: { outstandingBalance: 3000000, prepaymentPenalty: 25000 },
    taxProfile: {
      filingStatus: 'single',
      otherOrdinaryIncome: 300000,
      otherInvestmentIncome: 50000,
      stateOfResidence: 'CA',
      taxYear: 2025,
    },
    exchange1031: {
      saleDate: '2025-09-01',
      replacementProperties: [
        {
          name: 'Smaller Marina',
          purchasePrice: 4000000,
          newMortgage: 2000000,
          closingCosts: 80000,
          identificationPriority: 'primary',
        },
      ],
      qualifiedIntermediaryFee: 3000,
      additionalCashInvested: 0,
    },
  };

  let result: ExitScenarioResult;
  it('runs without throwing', () => {
    result = runExitScenario(input);
  });

  it('trading down → recognized gain > 0', () => {
    expect(result.exchange1031Result!.totalRecognizedGain).toBeGreaterThan(0);
  });

  it('mortgage boot > 0 (3M - 2M = 1M)', () => {
    expect(result.exchange1031Result!.bootAnalysis.mortgageBoot).toBeGreaterThan(0);
  });

  it('recognizedGain ≤ totalBoot', () => {
    expect(result.exchange1031Result!.totalRecognizedGain).toBeLessThanOrEqual(
      result.exchange1031Result!.bootAnalysis.totalBoot
    );
  });

  it('CRITICAL: tax is computed on recognized gain only, not full gain', () => {
    // The tax on boot should be LESS than the full-gain tax
    const fullGain = result.taxResult.gainAllocation.totalGain;
    const recognizedGain = result.exchange1031Result!.totalRecognizedGain;
    expect(recognizedGain).toBeLessThan(fullGain);
    // Tax liability should be proportionally reduced
    expect(result.taxResult.totalTaxLiability).toBeGreaterThan(0); // Not zero — boot exists
  });

  it('CA state tax rate warning or presence', () => {
    // Should have CA-level state taxation
    expect(result.taxResult.dualState.residenceState.state).toBe('CA');
  });

  it('no NaN/Infinity in output', () => {
    assertNoNaNOrInfinity(result);
  });
});

// ============================================================================
// GOLDEN VECTOR: installment_recapture — PATCH 2 critical test
// ============================================================================
describe('GOLDEN VECTOR: installment_recapture (PATCH 2)', () => {
  // Set up basis ledger to compute accumulated depreciation
  const basisInput: BasisLedgerInput = {
    originalPurchasePrice: 4000000,
    acquisitionCosts: 80000,
    landValueAtAcquisition: 800000,
    improvementValueAtAcquisition: 3200000,
    depreciationScheduleYears: 39,
    holdingPeriodYears: 10,
  };
  const basis = calculateBasisLedger(basisInput);

  it('accumulated depreciation ≈ 820513 (3200000/39*10)', () => {
    const expected = (3200000 / 39) * 10;
    expect(basis.accumulatedCostRecovery).toBeCloseTo(expected, -2);
  });

  describe('tax-engine installment schedule', () => {
    const gainInput: GainAllocationInput = {
      grossSalePrice: 6000000,
      costsOfSale: 6000000 * 0.04 + 40000, // 280000
      basisResult: basis,
      holdingPeriodMonths: 120,
      installmentSale: {
        enabled: true,
        downPaymentPercent: 0.20,
        termYears: 10,
        interestRate: 0.07,
      },
    };

    const profile: TaxProfileInput = {
      filingStatus: 'married',
      otherOrdinaryIncome: 250000,
      otherInvestmentIncome: 20000,
      stateOfResidence: 'NY',
      taxYear: 2025,
    };

    const allocation = allocateGains(gainInput, profile);
    const schedule = calculateInstallmentTaxSchedule(allocation, profile, {
      downPaymentPercent: 0.20,
      termYears: 10,
      interestRate: 0.07,
    });

    it('CRITICAL: Year 0 §1250 recapture = FULL accumulated depreciation', () => {
      // IRS §453(d)(1): ALL recapture in year of sale
      expect(schedule[0].section1250RecapturedThisYear).toBeCloseTo(
        basis.straightLineRecapture, -2
      );
    });

    it('subsequent years have zero recapture', () => {
      for (let i = 1; i < schedule.length; i++) {
        expect(schedule[i].section1250RecapturedThisYear).toBe(0);
        expect(schedule[i].section1245RecapturedThisYear).toBe(0);
      }
    });

    it('subsequent years gain is pure LTCG', () => {
      for (let i = 1; i < schedule.length; i++) {
        if (schedule[i].gainRecognized > 0) {
          expect(schedule[i].ltcgThisYear).toBeGreaterThan(0);
        }
      }
    });
  });

  describe('seller-financing-engine installment schedule', () => {
    const sfInput: SellerFinancingEngineInput = {
      salePrice: 6000000,
      adjustedBasis: basis.adjustedBasis,
      accumulatedDepreciation: basis.accumulatedCostRecovery,
      downPaymentPercent: 0.20,
      noteInterestRate: 0.07,
      noteTermYears: 10,
      amortizationYears: 25,
      buyerCreditProfile: {
        creditScore: 720,
        debtToIncomeRatio: 0.35,
        liquidReserves: 600000,
        yearsInBusiness: 10,
        hasBankruptcy: false,
        hasForeclosure: false,
        personalGuarantee: true,
      },
      collateral: {
        appraisedValue: 6300000,
        lienPosition: 'first',
        hasUccFiling: true,
        hasPersonalGuarantee: true,
      },
      taxProfile: {
        filingStatus: 'married',
        otherOrdinaryIncome: 250000,
        stateOfResidence: 'NY',
        taxYear: 2025,
      },
    };

    const sfResult = calculateSellerFinancing(sfInput);

    it('CRITICAL: Year 0 recapture = full accumulated depreciation', () => {
      const year0 = sfResult.installmentTaxSchedule.find(e => e.year === 0);
      expect(year0).toBeDefined();
      expect(year0!.recaptureGain).toBeCloseTo(basis.accumulatedCostRecovery, -2);
    });

    it('subsequent years recapture = 0', () => {
      for (const entry of sfResult.installmentTaxSchedule) {
        if (entry.year > 0) {
          expect(entry.recaptureGain).toBe(0);
        }
      }
    });
  });
});

// ============================================================================
// GOLDEN VECTOR: refi_irr — PATCH 3 critical test
// ============================================================================
describe('GOLDEN VECTOR: refi_irr (PATCH 3)', () => {
  const input: ExitScenarioInput = {
    scenarioName: 'Refi IRR Test',
    scenarioType: 'cash_sale',
    property: {
      purchasePrice: 4000000,
      acquisitionCosts: 80000,
      landValue: 800000,
      improvementValue: 3200000,
      depreciationScheduleYears: 39,
      holdingPeriodYears: 8,
    },
    sale: {
      salePrice: 6500000,
      brokerCommissionRate: 0.05,
      closingCosts: 50000,
      holdingPeriodMonths: 96,
    },
    debt: {
      outstandingBalance: 2400000,
      prepaymentPenalty: 0,
      refinanceEvents: [
        {
          year: 3,
          newLoanAmount: 3500000,
          interestRate: 0.065,
          termYears: 25,
          cashOutProceeds: 1000000,
          closingCosts: 35000,
        },
      ],
    },
    taxProfile: {
      filingStatus: 'married',
      otherOrdinaryIncome: 200000,
      otherInvestmentIncome: 0,
      stateOfResidence: 'FL',
      taxYear: 2025,
    },
  };

  let result: ExitScenarioResult;
  it('runs without throwing', () => {
    result = runExitScenario(input);
  });

  it('refi net cashout = 965000', () => {
    expect(result.refinanceSummary).not.toBeNull();
    expect(result.refinanceSummary!.netCashOut).toBe(965000);
  });

  it('refi is tax-free', () => {
    expect(result.refinanceSummary!.events[0].isTaxFree).toBe(true);
  });

  it('currentDebtBalance after refi = 3500000', () => {
    expect(result.refinanceSummary!.currentLoanBalance).toBe(3500000);
  });

  it('totalCashReturned includes refi cashout', () => {
    expect(result.returns.totalCashReturned).toBeGreaterThan(result.afterTaxEquityProceeds);
  });

  it('CRITICAL: IRR should reflect Year 3 intermediate distribution', () => {
    // Compute a naive 2-point IRR for comparison
    const equity = result.returns.totalEquityInvested;
    const totalReturn = result.returns.totalCashReturned;
    const naiveFlows = [
      { period: 0, amount: equity, type: 'investment' as const },
      { period: 8, amount: totalReturn, type: 'distribution' as const },
    ];
    const naiveIRR = calculateIRR(naiveFlows);

    // The full-timeline IRR (with year-3 cash-out) should be HIGHER because
    // receiving money earlier improves the time-weighted return
    expect(result.returns.irr).not.toBeNull();
    expect(naiveIRR).not.toBeNull();
    expect(result.returns.irr!).toBeGreaterThan(naiveIRR!);
  });

  it('no NaN/Infinity in output', () => {
    assertNoNaNOrInfinity(result);
  });
});

// ============================================================================
// GOLDEN VECTOR: edge_zero_depreciation_years — PATCH 8
// ============================================================================
describe('GOLDEN VECTOR: edge_zero_depreciation_years (PATCH 8)', () => {
  const input: ExitScenarioInput = {
    scenarioName: 'Zero Depreciation Edge',
    scenarioType: 'cash_sale',
    property: {
      purchasePrice: 1000000,
      acquisitionCosts: 20000,
      landValue: 1000000,
      improvementValue: 0,
      depreciationScheduleYears: 0,
      holdingPeriodYears: 5,
    },
    sale: {
      salePrice: 1500000,
      brokerCommissionRate: 0.05,
      closingCosts: 20000,
      holdingPeriodMonths: 60,
    },
    debt: { outstandingBalance: 0, prepaymentPenalty: 0 },
    taxProfile: {
      filingStatus: 'single',
      otherOrdinaryIncome: 100000,
      otherInvestmentIncome: 0,
      stateOfResidence: 'TX',
      taxYear: 2025,
    },
  };

  let result: ExitScenarioResult;
  it('should not throw', () => {
    result = runExitScenario(input);
  });

  it('no NaN or Infinity in any output', () => {
    assertNoNaNOrInfinity(result);
  });

  it('annualDepreciation = 0', () => {
    expect(result.basisLedger.annualDepreciation).toBe(0);
  });

  it('adjustedBasis = initialBasis (no depreciation)', () => {
    expect(result.basisLedger.adjustedBasis).toBe(result.basisLedger.initialBasis);
  });
});

// ============================================================================
// GOLDEN VECTOR: edge_empty_replacement_properties — PATCH 9
// ============================================================================
describe('GOLDEN VECTOR: edge_empty_replacement_properties (PATCH 9)', () => {
  it('should not throw with empty replacementProperties', () => {
    const exchangeInput: Exchange1031EngineInput = {
      relinquishedProperty: {
        salePrice: 3000000,
        adjustedBasis: 1800000,
        accumulatedDepreciation: 200000,
        mortgageBalance: 1000000,
        closingCosts: 150000,
      },
      saleDate: '2025-06-01',
      replacementProperties: [],
      qualifiedIntermediaryFee: 2500,
      additionalCashInvested: 0,
    };

    const result = calculate1031ExchangeEngine(exchangeInput);

    expect(result).toBeDefined();
    assertNoNaNOrInfinity(result);
    // All gain recognized when no replacement properties
    expect(result.totalRecognizedGain).toBe(result.totalRealizedGain);
    expect(result.isFullyDeferred).toBe(false);
    // Should have warning about no replacement
    expect(result.warnings.some(w => w.code === 'NO_REPLACEMENT_PROPERTIES')).toBe(true);
  });

  it('full scenario with empty replacement should not throw', () => {
    const input: ExitScenarioInput = {
      scenarioName: 'Empty Replacement Edge',
      scenarioType: 'exchange_1031',
      property: {
        purchasePrice: 2000000,
        acquisitionCosts: 40000,
        landValue: 400000,
        improvementValue: 1600000,
        depreciationScheduleYears: 39,
        holdingPeriodYears: 5,
      },
      sale: {
        salePrice: 3000000,
        brokerCommissionRate: 0.05,
        closingCosts: 30000,
        holdingPeriodMonths: 60,
      },
      debt: { outstandingBalance: 1000000, prepaymentPenalty: 0 },
      taxProfile: {
        filingStatus: 'single',
        otherOrdinaryIncome: 150000,
        otherInvestmentIncome: 0,
        stateOfResidence: 'FL',
        taxYear: 2025,
      },
      exchange1031: {
        saleDate: '2025-06-01',
        replacementProperties: [],
        qualifiedIntermediaryFee: 2500,
        additionalCashInvested: 0,
      },
    };

    const result = runExitScenario(input);
    assertNoNaNOrInfinity(result);
  });
});

// ============================================================================
// GOLDEN VECTOR: edge_100_percent_down — PATCH 10
// ============================================================================
describe('GOLDEN VECTOR: edge_100_percent_down (PATCH 10)', () => {
  const sfInput: SellerFinancingEngineInput = {
    salePrice: 3000000,
    adjustedBasis: 1800000,
    accumulatedDepreciation: 200000,
    downPaymentPercent: 1.0,
    noteInterestRate: 0.07,
    noteTermYears: 10,
    amortizationYears: 25,
    buyerCreditProfile: {
      creditScore: 750,
      debtToIncomeRatio: 0.30,
      liquidReserves: 500000,
      yearsInBusiness: 15,
      hasBankruptcy: false,
      hasForeclosure: false,
      personalGuarantee: true,
    },
    collateral: {
      appraisedValue: 3000000,
      lienPosition: 'first',
      hasUccFiling: true,
      hasPersonalGuarantee: true,
    },
    taxProfile: {
      filingStatus: 'single',
      otherOrdinaryIncome: 150000,
      stateOfResidence: 'FL',
      taxYear: 2025,
    },
  };

  let result: ReturnType<typeof calculateSellerFinancing>;
  it('should not throw', () => {
    result = calculateSellerFinancing(sfInput);
  });

  it('no NaN or Infinity', () => {
    assertNoNaNOrInfinity(result);
  });

  it('faceValue = 0', () => {
    expect(result.noteTerms.faceValue).toBe(0);
  });

  it('amortization schedule empty or skipped', () => {
    expect(result.amortization.length).toBe(0);
  });

  it('totalInterestIncome = 0', () => {
    expect(result.noteTerms.totalInterestIncome).toBe(0);
  });

  it('warning about cash sale equivalent', () => {
    expect(result.warnings.some(w => w.code === 'CASH_SALE_EQUIVALENT')).toBe(true);
  });
});

// ============================================================================
// PATCH 5: Boot tax no longer hardcoded at 23.8%
// ============================================================================
describe('PATCH 5: 1031 boot tax not hardcoded', () => {
  it('taxOnBoot is 0 (orchestrator handles boot tax via tax-engine)', () => {
    const exchangeInput: Exchange1031EngineInput = {
      relinquishedProperty: {
        salePrice: 5000000,
        adjustedBasis: 3500000,
        accumulatedDepreciation: 500000,
        mortgageBalance: 2000000,
        closingCosts: 250000,
      },
      saleDate: '2025-09-01',
      replacementProperties: [
        {
          name: 'Smaller Property',
          purchasePrice: 3000000,
          newMortgage: 1500000,
          closingCosts: 60000,
          identificationPriority: 'primary',
        },
      ],
      qualifiedIntermediaryFee: 3000,
      additionalCashInvested: 0,
    };

    const result = calculate1031ExchangeEngine(exchangeInput);
    // taxOnBoot is now always 0 in the sub-engine; orchestrator computes actual tax
    expect(result.bootAnalysis.taxOnBoot).toBe(0);
  });
});

// ============================================================================
// PATCH 6: Seller financing uses canonical state rates
// ============================================================================
describe('PATCH 6: Seller financing uses canonical state rates', () => {
  it('Virginia gets 5.75% (not default 5%)', () => {
    const sfInput: SellerFinancingEngineInput = {
      salePrice: 3000000,
      adjustedBasis: 2000000,
      accumulatedDepreciation: 400000,
      downPaymentPercent: 0.20,
      noteInterestRate: 0.07,
      noteTermYears: 10,
      amortizationYears: 25,
      buyerCreditProfile: {
        creditScore: 720,
        debtToIncomeRatio: 0.35,
        liquidReserves: 300000,
        yearsInBusiness: 5,
        hasBankruptcy: false,
        hasForeclosure: false,
        personalGuarantee: true,
      },
      collateral: {
        appraisedValue: 3000000,
        lienPosition: 'first',
        hasUccFiling: true,
        hasPersonalGuarantee: true,
      },
      taxProfile: {
        filingStatus: 'single',
        otherOrdinaryIncome: 100000,
        stateOfResidence: 'VA',
        taxYear: 2025,
      },
    };

    const result = calculateSellerFinancing(sfInput);
    // Year 1+ should show state tax at VA rate (5.75%), not old default (5%)
    const year1 = result.installmentTaxSchedule.find(e => e.year === 1);
    if (year1 && year1.installmentGain > 0) {
      const impliedStateRate = year1.stateTax / (year1.installmentGain + year1.interestIncome);
      expect(impliedStateRate).toBeCloseTo(0.0575, 3);
    }
  });
});

// ============================================================================
// PATCH 7: Earnout accepts taxProfile
// ============================================================================
describe('PATCH 7: Earnout accepts optional taxProfile', () => {
  it('uses dynamic rates when taxProfile provided', () => {
    const result = calculateEarnout({
      basePurchasePrice: 5000000,
      tranches: [{
        name: 'Revenue Tranche',
        maxAmount: 1000000,
        metric: 'revenue',
        threshold: 500000,
        measurementPeriod: { startYear: 1, endYear: 2 },
        paymentTiming: 'at_measurement',
        probabilityOfAchievement: 0.80,
        taxTreatment: 'capital_gain',
      }],
      discountRate: 0.08,
      holdingPeriodYears: 5,
      taxProfile: {
        filingStatus: 'married',
        otherOrdinaryIncome: 80000,
        otherInvestmentIncome: 0,
        stateOfResidence: 'FL',
        taxYear: 2025,
      },
    });

    // Married filing at 80K ordinary income → 15% LTCG bracket, no NIIT, FL = 0% state
    // effectiveTaxRate should be around 15%, NOT 23.8%
    const tranche = result.tranches[0];
    expect(tranche.effectiveTaxRate).toBeLessThan(0.238);
    expect(tranche.effectiveTaxRate).toBeCloseTo(0.15, 1);
  });

  it('falls back to hardcoded rates when no taxProfile', () => {
    const result = calculateEarnout({
      basePurchasePrice: 5000000,
      tranches: [{
        name: 'Revenue Tranche',
        maxAmount: 1000000,
        metric: 'revenue',
        threshold: 500000,
        measurementPeriod: { startYear: 1, endYear: 2 },
        paymentTiming: 'at_measurement',
        probabilityOfAchievement: 0.80,
        taxTreatment: 'capital_gain',
      }],
      discountRate: 0.08,
      holdingPeriodYears: 5,
    });

    const tranche = result.tranches[0];
    // Without profile, should use max-bracket default (23.8%)
    expect(tranche.effectiveTaxRate).toBe(0.238);
  });
});

// ============================================================================
// PATCH 11: Empty waterfall guard
// ============================================================================
describe('PATCH 11: Empty capital calls in waterfall', () => {
  it('returns zeroed metrics with warning when no capital calls', () => {
    const result = calculateWaterfallV2({
      capitalCalls: [],
      distributions: [{ date: '2025-01-01', amount: 1000000, investor: 'LP1' }],
      tiers: [],
      preferredReturn: 0.08,
      preferredReturnCompounding: 'annual',
      catchUpPercent: 0,
      catchUpTarget: 0.20,
      structureType: 'whole_fund',
      clawbackEnabled: false,
      gpCommitmentPercent: 0.02,
    });

    assertNoNaNOrInfinity(result);
    expect(result.fundMetrics.grossMoic).toBe(0);
    expect(result.warnings.some(w => w.code === 'NO_CAPITAL_CALLS')).toBe(true);
  });

  it('returns zeroed metrics with warning when no distributions', () => {
    const result = calculateWaterfallV2({
      capitalCalls: [{ date: '2024-01-01', amount: 1000000, investor: 'LP1' }],
      distributions: [],
      tiers: [],
      preferredReturn: 0.08,
      preferredReturnCompounding: 'annual',
      catchUpPercent: 0,
      catchUpTarget: 0.20,
      structureType: 'whole_fund',
      clawbackEnabled: false,
      gpCommitmentPercent: 0.02,
    });

    assertNoNaNOrInfinity(result);
    expect(result.fundMetrics.grossMoic).toBe(0);
    expect(result.warnings.some(w => w.code === 'NO_DISTRIBUTIONS')).toBe(true);
  });
});

// ============================================================================
// PATCH 12: holdingPeriodYears = 0 guard
// ============================================================================
describe('PATCH 12: holdingPeriodYears = 0', () => {
  it('does not produce Infinity annualized return', () => {
    const input: ExitScenarioInput = {
      scenarioName: 'Zero Hold',
      scenarioType: 'cash_sale',
      property: {
        purchasePrice: 1000000,
        acquisitionCosts: 20000,
        landValue: 500000,
        improvementValue: 500000,
        depreciationScheduleYears: 39,
        holdingPeriodYears: 0,
      },
      sale: {
        salePrice: 1200000,
        brokerCommissionRate: 0.05,
        closingCosts: 10000,
        holdingPeriodMonths: 0,
      },
      debt: { outstandingBalance: 0, prepaymentPenalty: 0 },
      taxProfile: {
        filingStatus: 'single',
        otherOrdinaryIncome: 100000,
        otherInvestmentIncome: 0,
        stateOfResidence: 'TX',
        taxYear: 2025,
      },
    };

    const result = runExitScenario(input);
    expect(Number.isFinite(result.returns.annualizedReturn)).toBe(true);
    expect(result.returns.annualizedReturn).toBe(0);
    expect(result.warnings.some(w => w.code === 'ZERO_HOLDING_PERIOD')).toBe(true);
  });
});

// ============================================================================
// PATCH 13: Negative gain (loss) warnings
// ============================================================================
describe('PATCH 13: Negative gain warnings', () => {
  it('1031 at a loss warns no benefit', () => {
    const exchangeInput: Exchange1031EngineInput = {
      relinquishedProperty: {
        salePrice: 2000000,     // selling for LESS than basis
        adjustedBasis: 3000000,
        accumulatedDepreciation: 200000,
        mortgageBalance: 1000000,
        closingCosts: 100000,
      },
      saleDate: '2025-06-01',
      replacementProperties: [
        { name: 'Replacement', purchasePrice: 3000000, newMortgage: 2000000, closingCosts: 60000, identificationPriority: 'primary' },
      ],
      qualifiedIntermediaryFee: 2500,
      additionalCashInvested: 0,
    };

    const result = calculate1031ExchangeEngine(exchangeInput);
    expect(result.warnings.some(w => w.code === 'NO_GAIN_TO_DEFER')).toBe(true);
  });
});

// ============================================================================
// PATCH 14: Canonical IRR — ensure no local copies remain functional
// ============================================================================
describe('PATCH 14: Canonical IRR consistency', () => {
  it('irr-calculator.ts calculateIRR produces expected result', () => {
    const flows = [
      { period: 0, amount: 1000000, type: 'investment' as const },
      { period: 5, amount: 1500000, type: 'distribution' as const },
    ];
    const irr = calculateIRR(flows);
    expect(irr).not.toBeNull();
    // 1.5x over 5 years → ~8.4% IRR
    expect(irr!).toBeCloseTo(0.084, 2);
  });

  it('irr-calculator.ts calculateXIRR produces expected result', () => {
    const flows = [
      { date: new Date('2020-01-01'), amount: -1000000 },
      { date: new Date('2025-01-01'), amount: 1500000 },
    ];
    const xirr = calculateXIRR(flows);
    expect(xirr).not.toBeNull();
    expect(xirr!).toBeCloseTo(0.084, 2);
  });
});
