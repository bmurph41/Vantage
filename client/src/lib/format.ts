/**
 * Centralized formatting utilities for consistent number display across the app.
 * 
 * Currency format: $00,000,000 (with commas as thousands separators)
 * Percentage format: 00.0% (one decimal place)
 */

/**
 * Format a number as currency with full dollar amount and comma separators.
 * Examples: 1500000 -> "$1,500,000", 1234.56 -> "$1,235", null -> "$0"
 * 
 * @param value - The numeric value to format
 * @param options - Optional configuration
 * @param options.showCents - If true, shows cents (default: false, rounds to whole dollars)
 * @param options.nullValue - Value to return for null/undefined (default: "$0")
 * @returns Formatted currency string
 */
export function formatCurrency(
  value: number | null | undefined,
  options?: { showCents?: boolean; nullValue?: string }
): string {
  const { showCents = false, nullValue = "$0" } = options || {};
  
  if (value === null || value === undefined || isNaN(value)) {
    return nullValue;
  }

  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: showCents ? 2 : 0,
    maximumFractionDigits: showCents ? 2 : 0,
  });

  return formatter.format(value);
}

/**
 * Format a number as a percentage with one decimal place.
 * Examples: 85.5 -> "85.5%", 100 -> "100.0%", 0 -> "0.0%", null -> "0.0%"
 * 
 * @param value - The numeric value to format (already in percentage form, e.g., 85 not 0.85)
 * @param options - Optional configuration
 * @param options.nullValue - Value to return for null/undefined (default: "0.0%")
 * @returns Formatted percentage string
 */
export function formatPercent(
  value: number | null | undefined,
  options?: { nullValue?: string }
): string {
  const { nullValue = "0.0%" } = options || {};
  
  if (value === null || value === undefined || isNaN(value)) {
    return nullValue;
  }

  return `${value.toFixed(1)}%`;
}

/**
 * Format a number with comma separators (no currency symbol).
 * Examples: 1500000 -> "1,500,000", 1234.56 -> "1,235"
 * 
 * @param value - The numeric value to format
 * @param options - Optional configuration
 * @param options.decimals - Number of decimal places (default: 0)
 * @param options.nullValue - Value to return for null/undefined (default: "0")
 * @returns Formatted number string
 */
export function formatNumber(
  value: number | null | undefined,
  options?: { decimals?: number; nullValue?: string }
): string {
  const { decimals = 0, nullValue = "0" } = options || {};
  
  if (value === null || value === undefined || isNaN(value)) {
    return nullValue;
  }

  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

/**
 * Format a decimal as a percentage with one decimal place.
 * Use this when the input is in decimal form (e.g., 0.85 for 85%).
 * Examples: 0.855 -> "85.5%", 1.0 -> "100.0%", 0 -> "0.0%"
 * 
 * @param value - The decimal value to format (e.g., 0.85 for 85%)
 * @param options - Optional configuration
 * @param options.nullValue - Value to return for null/undefined (default: "0.0%")
 * @returns Formatted percentage string
 */
export function formatDecimalAsPercent(
  value: number | null | undefined,
  options?: { nullValue?: string }
): string {
  const { nullValue = "0.0%" } = options || {};
  
  if (value === null || value === undefined || isNaN(value)) {
    return nullValue;
  }

  return `${(value * 100).toFixed(1)}%`;
}
