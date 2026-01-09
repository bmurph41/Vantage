/**
 * Format a number as currency with comma separators.
 * Format: $00,000,000 (whole dollars with commas)
 * @deprecated Use formatCurrency from @/lib/utils instead
 */
export function formatCurrency(value: number): string {
  if (value === null || value === undefined || isNaN(value)) return '$0';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

/**
 * Format a number with comma separators (no currency symbol).
 * @deprecated Use formatNumber from @/lib/utils instead
 */
export function formatNumber(value: number): string {
  if (value === null || value === undefined || isNaN(value)) return '0';
  return new Intl.NumberFormat('en-US').format(value);
}

/**
 * Format a number as a percentage with one decimal place.
 * Format: 00.0%
 * @deprecated Use formatPercent from @/lib/utils instead
 */
export function formatPercent(value: number): string {
  if (value === null || value === undefined || isNaN(value)) return '0.0%';
  return `${value.toFixed(1)}%`;
}

export function getTrendColor(value: number, positiveIsGood: boolean = true): string {
  if (value === 0) return 'text-gray-600';
  if (positiveIsGood) {
    return value > 0 ? 'text-green-600' : 'text-red-600';
  }
  return value > 0 ? 'text-red-600' : 'text-green-600';
}

export function getTrendIcon(value: number): string {
  if (value > 0) return '↑';
  if (value < 0) return '↓';
  return '→';
}
