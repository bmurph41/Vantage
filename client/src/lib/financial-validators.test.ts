import { describe, it, expect } from 'vitest';
import {
  sanitizeNumber,
  sanitizePositiveNumber,
  sanitizePercentage,
  sanitizeHoldingPeriod,
  validateExitStrategyCalculations,
  formatCurrency,
  formatPercentage,
  validateMasterInputs,
  type CalculationWarning,
} from './financial-validators';

describe('sanitizeNumber', () => {
  it('returns number from valid number input', () => {
    expect(sanitizeNumber(100, 0)).toBe(100);
    expect(sanitizeNumber(-50, 0)).toBe(-50);
    expect(sanitizeNumber(0, 10)).toBe(0);
  });

  it('returns number from valid string input', () => {
    expect(sanitizeNumber('100', 0)).toBe(100);
    expect(sanitizeNumber('3.14', 0)).toBeCloseTo(3.14);
    expect(sanitizeNumber('-50', 0)).toBe(-50);
  });

  it('returns default for invalid inputs', () => {
    expect(sanitizeNumber(null, 99)).toBe(99);
    expect(sanitizeNumber(undefined, 99)).toBe(99);
    expect(sanitizeNumber('', 99)).toBe(99);
    expect(sanitizeNumber(NaN, 99)).toBe(99);
    expect(sanitizeNumber('invalid', 99)).toBe(99);
    expect(sanitizeNumber(Infinity, 99)).toBe(99);
    expect(sanitizeNumber(-Infinity, 99)).toBe(99);
  });
});

describe('sanitizePositiveNumber', () => {
  it('returns positive numbers unchanged', () => {
    expect(sanitizePositiveNumber(100, 0)).toBe(100);
    expect(sanitizePositiveNumber(0.5, 0)).toBeCloseTo(0.5);
    expect(sanitizePositiveNumber(0, 10)).toBe(0);
  });

  it('returns default for negative numbers', () => {
    expect(sanitizePositiveNumber(-100, 50)).toBe(50);
    expect(sanitizePositiveNumber(-0.01, 10)).toBe(10);
  });

  it('handles string inputs', () => {
    expect(sanitizePositiveNumber('100', 0)).toBe(100);
    expect(sanitizePositiveNumber('-100', 50)).toBe(50);
  });
});

describe('sanitizePercentage', () => {
  it('returns valid percentages unchanged', () => {
    expect(sanitizePercentage(50, 0)).toBe(50);
    expect(sanitizePercentage(0, 10)).toBe(0);
    expect(sanitizePercentage(100, 10)).toBe(100);
  });

  it('clamps values outside 0-100 range', () => {
    expect(sanitizePercentage(-10, 50)).toBe(0);
    expect(sanitizePercentage(150, 50)).toBe(100);
  });

  it('handles string inputs', () => {
    expect(sanitizePercentage('25', 0)).toBe(25);
    expect(sanitizePercentage('200', 0)).toBe(100);
  });
});

describe('sanitizeHoldingPeriod', () => {
  it('returns valid holding periods', () => {
    expect(sanitizeHoldingPeriod(5, 3)).toBe(5);
    expect(sanitizeHoldingPeriod(10, 3)).toBe(10);
    expect(sanitizeHoldingPeriod(1, 3)).toBe(1);
    expect(sanitizeHoldingPeriod(50, 3)).toBe(50);
  });

  it('clamps values to valid range', () => {
    expect(sanitizeHoldingPeriod(0, 3)).toBe(1);
    expect(sanitizeHoldingPeriod(-5, 3)).toBe(1);
    expect(sanitizeHoldingPeriod(100, 3)).toBe(50);
  });

  it('rounds to whole numbers', () => {
    expect(sanitizeHoldingPeriod(5.7, 3)).toBe(6);
    expect(sanitizeHoldingPeriod(5.3, 3)).toBe(5);
  });
});

describe('validateExitStrategyCalculations', () => {
  const defaultInputs = {
    salePrice: 5000000,
    costBasis: 3500000,
    depreciationTaken: 500000,
    capitalImprovements: 200000,
    holdingPeriod: 5,
    currentDebtBalance: 2500000,
    closingCosts: 150000,
    brokerFeePercent: 5,
  };

  it('returns no warnings for healthy transaction', () => {
    const warnings = validateExitStrategyCalculations(defaultInputs);
    expect(warnings).toHaveLength(0);
  });

  it('warns when adjusted basis is negative', () => {
    const inputs = { ...defaultInputs, depreciationTaken: 4000000 };
    const warnings = validateExitStrategyCalculations(inputs);
    expect(warnings.some(w => w.field === 'adjustedBasis')).toBe(true);
  });

  it('warns about capital loss', () => {
    const inputs = { ...defaultInputs, salePrice: 2000000 };
    const warnings = validateExitStrategyCalculations(inputs);
    expect(warnings.some(w => w.field === 'capitalGain')).toBe(true);
  });

  it('errors when debt exceeds sale price', () => {
    const inputs = { ...defaultInputs, currentDebtBalance: 6000000 };
    const warnings = validateExitStrategyCalculations(inputs);
    const debtWarning = warnings.find(w => w.field === 'debtBalance');
    expect(debtWarning).toBeDefined();
    expect(debtWarning?.severity).toBe('error');
  });

  it('errors on negative equity', () => {
    const inputs = { ...defaultInputs, currentDebtBalance: 5500000 };
    const warnings = validateExitStrategyCalculations(inputs);
    expect(warnings.some(w => w.field === 'equity')).toBe(true);
  });

  it('warns when depreciation exceeds cost basis', () => {
    const inputs = { ...defaultInputs, depreciationTaken: 4000000 };
    const warnings = validateExitStrategyCalculations(inputs);
    expect(warnings.some(w => w.field === 'depreciation')).toBe(true);
  });

  it('warns about unusually high broker fees', () => {
    const inputs = { ...defaultInputs, brokerFeePercent: 15 };
    const warnings = validateExitStrategyCalculations(inputs);
    expect(warnings.some(w => w.field === 'brokerFee')).toBe(true);
  });

  it('warns when net proceeds cannot cover debt', () => {
    const inputs = { ...defaultInputs, currentDebtBalance: 4800000 };
    const warnings = validateExitStrategyCalculations(inputs);
    expect(warnings.some(w => w.field === 'proceeds')).toBe(true);
  });
});

describe('formatCurrency', () => {
  it('formats positive numbers', () => {
    expect(formatCurrency(1000000)).toBe('$1,000,000');
    expect(formatCurrency(500.5, true)).toBe('$500.50');
  });

  it('formats zero', () => {
    expect(formatCurrency(0)).toBe('$0');
  });

  it('handles NaN and Infinity', () => {
    expect(formatCurrency(NaN)).toBe('$0');
    expect(formatCurrency(Infinity)).toBe('$0');
  });
});

describe('formatPercentage', () => {
  it('formats percentages with decimals', () => {
    expect(formatPercentage(5.5, 1)).toBe('5.5%');
    expect(formatPercentage(20, 0)).toBe('20%');
    expect(formatPercentage(3.333, 2)).toBe('3.33%');
  });

  it('handles edge cases', () => {
    expect(formatPercentage(0, 1)).toBe('0.0%');
    expect(formatPercentage(NaN, 1)).toBe('0%');
  });
});

describe('validateMasterInputs', () => {
  const validInputs = {
    salePrice: 5000000,
    costBasis: 3500000,
    depreciationTaken: 500000,
    capitalImprovements: 200000,
    holdingPeriod: 5,
    federalTaxRate: 20,
    stateTaxRate: 5,
    currentDebtBalance: 2500000,
    acquisitionDate: '2020-01-01',
    closingCosts: 150000,
    brokerFeePercent: 5,
  };

  it('validates correct inputs', () => {
    const result = validateMasterInputs(validInputs);
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
  });

  it('rejects negative sale price', () => {
    const inputs = { ...validInputs, salePrice: -1000 };
    const result = validateMasterInputs(inputs);
    expect(result.success).toBe(false);
  });

  it('rejects invalid holding period', () => {
    const inputs = { ...validInputs, holdingPeriod: 0 };
    const result = validateMasterInputs(inputs);
    expect(result.success).toBe(false);
  });

  it('rejects percentage > 100', () => {
    const inputs = { ...validInputs, federalTaxRate: 150 };
    const result = validateMasterInputs(inputs);
    expect(result.success).toBe(false);
  });

  it('rejects empty acquisition date', () => {
    const inputs = { ...validInputs, acquisitionDate: '' };
    const result = validateMasterInputs(inputs);
    expect(result.success).toBe(false);
  });
});
