import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

let _globalRoundingDigits = 0;

export function setGlobalRoundingDigits(digits: number) {
  _globalRoundingDigits = digits;
}

export function getGlobalRoundingDigits(): number {
  return _globalRoundingDigits;
}

function applyRounding(value: number, roundingDigits: number): number {
  if (roundingDigits <= 0) return value;
  const factor = Math.pow(10, roundingDigits);
  return Math.round(value / factor) * factor;
}

export function formatCurrency(
  value: number | string | null | undefined,
  options?: { roundingDigits?: number; dash?: boolean }
): string {
  if (value === null || value === undefined) return options?.dash ? '-' : '$0';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return options?.dash ? '-' : '$0';
  const digits = options?.roundingDigits ?? _globalRoundingDigits;
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
  const dash = options?.dash ? '-' : '0.0%';
  if (value === null || value === undefined) return dash;
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return dash;
  const decimals = options?.decimals ?? 1;
  const sign = options?.showSign && num >= 0 ? '+' : '';
  return `${sign}${num.toFixed(decimals)}%`;
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
