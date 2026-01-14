import { z } from 'zod';

export const positiveNumber = z.number()
  .refine(n => !isNaN(n), { message: 'Must be a valid number' })
  .refine(n => isFinite(n), { message: 'Must be a finite number' })
  .refine(n => n >= 0, { message: 'Must be zero or positive' });

export const positiveNumberRequired = z.number()
  .refine(n => !isNaN(n), { message: 'Must be a valid number' })
  .refine(n => isFinite(n), { message: 'Must be a finite number' })
  .refine(n => n > 0, { message: 'Must be greater than zero' });

export const percentage = z.number()
  .refine(n => !isNaN(n), { message: 'Must be a valid number' })
  .refine(n => isFinite(n), { message: 'Must be a finite number' })
  .refine(n => n >= 0 && n <= 100, { message: 'Must be between 0 and 100' });

export const holdingPeriod = z.number()
  .refine(n => !isNaN(n), { message: 'Must be a valid number' })
  .refine(n => isFinite(n), { message: 'Must be a finite number' })
  .refine(n => n >= 1 && n <= 50, { message: 'Holding period must be between 1 and 50 years' })
  .refine(n => Number.isInteger(n), { message: 'Holding period must be a whole number' });

export const masterInputsSchema = z.object({
  salePrice: positiveNumberRequired,
  costBasis: positiveNumberRequired,
  depreciationTaken: positiveNumber,
  capitalImprovements: positiveNumber,
  holdingPeriod: holdingPeriod,
  federalTaxRate: percentage,
  stateTaxRate: percentage,
  currentDebtBalance: positiveNumber,
  acquisitionDate: z.string().min(1, 'Acquisition date is required'),
  closingCosts: positiveNumber,
  brokerFeePercent: percentage,
});

export type ValidatedMasterInputs = z.infer<typeof masterInputsSchema>;

export function sanitizeNumber(value: unknown, defaultValue: number = 0): number {
  if (value === null || value === undefined || value === '') {
    return defaultValue;
  }
  
  const num = typeof value === 'string' ? parseFloat(value) : Number(value);
  
  if (isNaN(num) || !isFinite(num)) {
    return defaultValue;
  }
  
  return num;
}

export function sanitizePositiveNumber(value: unknown, defaultValue: number = 0): number {
  const num = sanitizeNumber(value, defaultValue);
  return num < 0 ? defaultValue : num;
}

export function sanitizePercentage(value: unknown, defaultValue: number = 0): number {
  const num = sanitizeNumber(value, defaultValue);
  if (num < 0) return 0;
  if (num > 100) return 100;
  return num;
}

export function sanitizeHoldingPeriod(value: unknown, defaultValue: number = 5): number {
  const num = sanitizeNumber(value, defaultValue);
  if (num < 1) return 1;
  if (num > 50) return 50;
  return Math.round(num);
}

export function validateMasterInputs(inputs: unknown): { 
  success: boolean; 
  data?: ValidatedMasterInputs; 
  errors?: z.ZodError 
} {
  const result = masterInputsSchema.safeParse(inputs);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, errors: result.error };
}

export function formatCurrency(value: number, showCents: boolean = false): string {
  if (isNaN(value) || !isFinite(value)) {
    return '$0';
  }
  
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: showCents ? 2 : 0,
    maximumFractionDigits: showCents ? 2 : 0,
  }).format(value);
}

export function formatPercentage(value: number, decimals: number = 1): string {
  if (isNaN(value) || !isFinite(value)) {
    return '0%';
  }
  
  return `${value.toFixed(decimals)}%`;
}

export interface CalculationWarning {
  field: string;
  message: string;
  severity: 'warning' | 'error';
}

export function validateExitStrategyCalculations(inputs: {
  salePrice: number;
  costBasis: number;
  depreciationTaken: number;
  capitalImprovements: number;
  holdingPeriod: number;
  currentDebtBalance: number;
  closingCosts: number;
  brokerFeePercent: number;
}): CalculationWarning[] {
  const warnings: CalculationWarning[] = [];
  
  const adjustedBasis = inputs.costBasis + inputs.capitalImprovements - inputs.depreciationTaken;
  const gain = inputs.salePrice - adjustedBasis;
  const equity = inputs.salePrice - inputs.currentDebtBalance;
  const brokerFee = inputs.salePrice * (inputs.brokerFeePercent / 100);
  const netProceeds = inputs.salePrice - brokerFee - inputs.closingCosts;
  
  if (adjustedBasis < 0) {
    warnings.push({
      field: 'adjustedBasis',
      message: 'Adjusted basis is negative. Check depreciation vs cost basis.',
      severity: 'warning',
    });
  }
  
  if (gain < 0) {
    warnings.push({
      field: 'capitalGain',
      message: 'This transaction would result in a capital loss.',
      severity: 'warning',
    });
  }
  
  if (inputs.currentDebtBalance > inputs.salePrice) {
    warnings.push({
      field: 'debtBalance',
      message: 'Debt exceeds sale price. Property may be underwater.',
      severity: 'error',
    });
  }
  
  if (equity < 0) {
    warnings.push({
      field: 'equity',
      message: 'Negative equity position. Sale may not cover existing debt.',
      severity: 'error',
    });
  }
  
  if (inputs.depreciationTaken > inputs.costBasis) {
    warnings.push({
      field: 'depreciation',
      message: 'Depreciation exceeds original cost basis.',
      severity: 'warning',
    });
  }
  
  if (netProceeds < inputs.currentDebtBalance) {
    warnings.push({
      field: 'proceeds',
      message: 'Net proceeds may not cover existing debt obligations.',
      severity: 'warning',
    });
  }
  
  if (inputs.brokerFeePercent > 10) {
    warnings.push({
      field: 'brokerFee',
      message: 'Broker fee seems unusually high (>10%).',
      severity: 'warning',
    });
  }
  
  return warnings;
}
