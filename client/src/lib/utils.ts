import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

let _globalRoundingDigits = 0;
let _globalEbitdaRoundingDigits = 0;
let _globalLineItemRoundingDigits = 0;
let _globalPercentRoundingDecimals = 1;

export function setGlobalRoundingDigits(digits: number) {
  _globalRoundingDigits = digits;
}

export function setGlobalEbitdaRoundingDigits(digits: number) {
  _globalEbitdaRoundingDigits = digits;
}

export function setGlobalLineItemRoundingDigits(digits: number) {
  _globalLineItemRoundingDigits = digits;
}

export function setGlobalPercentRoundingDecimals(decimals: number) {
  _globalPercentRoundingDecimals = decimals;
}

export function getGlobalRoundingDigits(): number {
  return _globalRoundingDigits;
}

export function getGlobalEbitdaRoundingDigits(): number {
  return _globalEbitdaRoundingDigits;
}

export function getGlobalLineItemRoundingDigits(): number {
  return _globalLineItemRoundingDigits;
}

export function getGlobalPercentRoundingDecimals(): number {
  return _globalPercentRoundingDecimals;
}

function applyRounding(value: number, roundingDigits: number): number {
  if (roundingDigits < 0) return value;
  const factor = Math.pow(10, roundingDigits);
  return Math.round(value / factor) * factor;
}

export function formatCurrency(
  value: number | string | null | undefined,
  options?: { roundingDigits?: number; dash?: boolean; context?: 'price' | 'ebitda' | 'lineItem' }
): string {
  if (value === null || value === undefined) return options?.dash ? '-' : '$0';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return options?.dash ? '-' : '$0';
  let digits: number;
  if (options?.roundingDigits !== undefined) {
    digits = options.roundingDigits;
  } else if (options?.context === 'ebitda') {
    digits = _globalEbitdaRoundingDigits;
  } else if (options?.context === 'lineItem') {
    digits = _globalLineItemRoundingDigits;
  } else {
    digits = _globalRoundingDigits;
  }
  const rounded = applyRounding(num, digits);
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(rounded);
}

export function formatPercent(
  value: number | string | null | undefined,
  options?: { decimals?: number; dash?: boolean; showSign?: boolean }
): string {
  const effectiveDecimals = options?.decimals ?? _globalPercentRoundingDecimals;
  const noRounding = effectiveDecimals < 0;
  const safeDecimals = noRounding ? 10 : effectiveDecimals;
  const dash = options?.dash ? '-' : `0${safeDecimals > 0 ? '.' + '0'.repeat(safeDecimals) : ''}%`;
  if (value === null || value === undefined) return dash;
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return dash;
  const sign = options?.showSign && num >= 0 ? '+' : '';
  const formatted = noRounding ? String(num) : num.toFixed(effectiveDecimals);
  return `${sign}${formatted}%`;
}

export function formatNumber(value: number | string | null | undefined): string {
  if (value === null || value === undefined) return '0';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '0';
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
}
