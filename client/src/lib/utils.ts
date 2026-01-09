import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Format a number as currency with comma separators.
 * Format: $00,000,000 (whole dollars with commas)
 * Examples: 1500000 -> "$1,500,000", 1234.56 -> "$1,235", null -> "$0"
 */
export function formatCurrency(value: number | string | null | undefined): string {
  if (value === null || value === undefined) return '$0';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '$0';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
}

/**
 * Format a number as a percentage with one decimal place.
 * Format: 00.0%
 * Examples: 85.5 -> "85.5%", 100 -> "100.0%", 0 -> "0.0%", null -> "0.0%"
 */
export function formatPercent(value: number | string | null | undefined): string {
  if (value === null || value === undefined) return '0.0%';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '0.0%';
  return `${num.toFixed(1)}%`;
}

/**
 * Format a number with comma separators (no currency symbol).
 * Examples: 1500000 -> "1,500,000"
 */
export function formatNumber(value: number | string | null | undefined): string {
  if (value === null || value === undefined) return '0';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '0';
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
}
