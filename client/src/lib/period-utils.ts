/**
 * Period Utilities for P&L Matrix View
 * 
 * Handles period normalization, formatting, and sorting for the P&L review grid.
 */

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
] as const;

const MONTH_NAMES_FULL = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
] as const;

/**
 * Normalize a period key to standard format: YYYY-MM
 * Handles various input formats:
 * - "2023-01" (already normalized)
 * - "2023-1" (single digit month)
 * - "Jan 2023", "January 2023"
 * - "Q1 2023" (quarters)
 * - "2023" (full year)
 * - ISO date strings "2023-01-31"
 */
export function normalizePeriodKey(periodKey: string | null | undefined): string {
  if (!periodKey) return "unknown";
  
  const key = periodKey.trim();
  
  // Already in YYYY-MM format
  if (/^\d{4}-\d{2}$/.test(key)) {
    return key;
  }
  
  // YYYY-M format (single digit month)
  if (/^\d{4}-\d{1}$/.test(key)) {
    const [year, month] = key.split("-");
    return `${year}-${month.padStart(2, "0")}`;
  }
  
  // ISO date format: YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(key)) {
    return key.slice(0, 7);
  }
  
  // Month Year format: "Jan 2023" or "January 2023"
  const monthYearMatch = key.match(/^(\w+)\s+(\d{4})$/i);
  if (monthYearMatch) {
    const [, monthStr, year] = monthYearMatch;
    const monthIndex = MONTH_NAMES.findIndex(m => 
      m.toLowerCase() === monthStr.toLowerCase().slice(0, 3)
    );
    if (monthIndex !== -1) {
      return `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
    }
  }
  
  // Quarter format: "Q1 2023"
  const quarterMatch = key.match(/^Q([1-4])\s+(\d{4})$/i);
  if (quarterMatch) {
    const [, quarter, year] = quarterMatch;
    // Return middle month of quarter for sorting purposes
    const quarterMonths = { "1": "02", "2": "05", "3": "08", "4": "11" };
    return `${year}-${quarterMonths[quarter as keyof typeof quarterMonths]}`;
  }
  
  // Full year format: "2023"
  if (/^\d{4}$/.test(key)) {
    return `${key}-00`; // Use 00 for full year to sort before months
  }
  
  // Fallback: return as-is
  return key;
}

/**
 * Format a period key for display
 * @param periodKey - Normalized period key (YYYY-MM format)
 * @returns Human-readable label like "Jan '23"
 */
export function formatPeriodLabel(periodKey: string): string {
  if (!periodKey || periodKey === "unknown") return "Unknown Period";
  if (periodKey === "single") return ""; // Single column, no period needed
  if (periodKey === "total" || periodKey === "Total") return "Total";
  
  // Handle YYYY-00 (full year)
  if (periodKey.endsWith("-00")) {
    return periodKey.slice(0, 4);
  }
  
  // Handle YYYY-MM format
  const match = periodKey.match(/^(\d{4})-(\d{2})$/);
  if (match) {
    const [, year, month] = match;
    const monthIdx = parseInt(month, 10) - 1;
    if (monthIdx >= 0 && monthIdx < 12) {
      return `${MONTH_NAMES[monthIdx]} '${year.slice(-2)}`;
    }
  }
  
  // Fallback
  return periodKey;
}

/**
 * Format a period key for full display (tooltips, etc.)
 * @param periodKey - Normalized period key (YYYY-MM format)
 * @returns Full human-readable label like "January 2023"
 */
export function formatPeriodLabelFull(periodKey: string): string {
  if (!periodKey || periodKey === "unknown") return "Unknown Period";
  if (periodKey === "single") return "Statement Period";
  if (periodKey === "total" || periodKey === "Total") return "Total";
  
  // Handle YYYY-00 (full year)
  if (periodKey.endsWith("-00")) {
    return `Year ${periodKey.slice(0, 4)}`;
  }
  
  // Handle YYYY-MM format
  const match = periodKey.match(/^(\d{4})-(\d{2})$/);
  if (match) {
    const [, year, month] = match;
    const monthIdx = parseInt(month, 10) - 1;
    if (monthIdx >= 0 && monthIdx < 12) {
      return `${MONTH_NAMES_FULL[monthIdx]} ${year}`;
    }
  }
  
  return periodKey;
}

/**
 * Sort period keys chronologically
 * @param periods - Array of period keys
 * @returns Sorted array of period keys (ascending)
 */
export function sortPeriods(periods: string[]): string[] {
  return [...periods].sort((a, b) => {
    const normA = normalizePeriodKey(a);
    const normB = normalizePeriodKey(b);
    return normA.localeCompare(normB);
  });
}

/**
 * Get a date range description for a set of periods
 * @param periods - Array of period keys
 * @returns Description like "Jan 2023 - Dec 2023"
 */
export function getPeriodRangeDescription(periods: string[]): string {
  if (periods.length === 0) return "No periods";
  if (periods.length === 1) return formatPeriodLabelFull(periods[0]);
  
  const sorted = sortPeriods(periods);
  const first = formatPeriodLabelFull(sorted[0]);
  const last = formatPeriodLabelFull(sorted[sorted.length - 1]);
  
  return `${first} - ${last}`;
}

/**
 * Check if a period key represents a full year
 */
export function isFullYearPeriod(periodKey: string): boolean {
  return /^\d{4}$/.test(periodKey) || periodKey.endsWith("-00");
}

/**
 * Check if a period key represents a quarter
 */
export function isQuarterPeriod(periodKey: string): boolean {
  return /^Q[1-4]\s+\d{4}$/i.test(periodKey);
}

/**
 * Extract year from a period key
 */
export function getYearFromPeriod(periodKey: string): number | null {
  const normalized = normalizePeriodKey(periodKey);
  const yearMatch = normalized.match(/^(\d{4})/);
  return yearMatch ? parseInt(yearMatch[1], 10) : null;
}
