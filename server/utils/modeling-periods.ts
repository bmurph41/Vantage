/**
 * Modeling Periods Utility
 * 
 * Canonical timeline engine for institutional-grade financial modeling.
 * All period derivation flows through these functions - no hardcoded years anywhere.
 */

import { 
  addMonths, 
  startOfMonth, 
  endOfMonth, 
  startOfYear,
  format, 
  differenceInMonths,
  getYear,
  getMonth,
  setMonth,
  setYear
} from 'date-fns';

// ============================================
// TYPES
// ============================================

export type ProjectionStartRule = 'acq_close_year' | 'next_full_calendar_year' | 'ttm_plus_one_month';
export type StabilizedNoiMode = 'fixed_year' | 'user_set' | 'post_ramp';
export type IrrDisplayPreference = 'monthly' | 'annualized';

export interface TimelineConfig {
  acquisitionCloseDate: Date | string | null;
  ttmEndDate: Date | string | null;
  projectionStartRule: ProjectionStartRule;
  holdPeriodMonths: number;
  holdPeriodYears?: number; // Derived or legacy input
}

export interface MonthlyPeriod {
  index: number;           // 0-based index from projection start
  date: Date;              // First day of the month
  monthEnd: Date;          // Last day of the month
  year: number;            // Calendar year (e.g., 2025)
  month: number;           // 1-12
  key: string;             // 'YYYY-MM' format for lookups
  label: string;           // 'Jan 2025' for display
  quarterIndex: number;    // 0-based quarter from projection start
  yearIndex: number;       // 0-based year from projection start (for annual rollups)
  isFirstMonthOfYear: boolean;
  isLastMonthOfYear: boolean;
}

export interface AnnualPeriod {
  yearIndex: number;       // 0-based (Year 1 = index 0)
  year: number;            // Calendar year
  label: string;           // 'Year 1 (2025)'
  monthIndices: number[];  // Which monthly period indices belong to this year
  monthCount: number;      // How many months in this projection year (may be partial)
}

export interface PeriodResult {
  projectionStartDate: Date;
  projectionEndDate: Date;
  monthlyPeriods: MonthlyPeriod[];
  annualPeriods: AnnualPeriod[];
  holdPeriodMonths: number;
  holdPeriodYears: number;
  totalMonths: number;
}

// ============================================
// CORE FUNCTIONS
// ============================================

/**
 * Derive the projection start date based on the selected rule.
 * This is the SINGLE SOURCE OF TRUTH for when projections begin.
 */
export function deriveProjectionStartDate(config: TimelineConfig): Date {
  const { acquisitionCloseDate, ttmEndDate, projectionStartRule } = config;
  
  // Parse dates if strings
  const acqDate = acquisitionCloseDate ? new Date(acquisitionCloseDate) : null;
  const ttmDate = ttmEndDate ? new Date(ttmEndDate) : null;
  
  // Default fallback: first of current month
  const fallbackDate = startOfMonth(new Date());
  
  switch (projectionStartRule) {
    case 'acq_close_year': {
      // Start of the year containing acquisition close
      // If no acq date, fall back to current year
      if (acqDate && !isNaN(acqDate.getTime())) {
        return startOfYear(acqDate);
      }
      return startOfYear(fallbackDate);
    }
    
    case 'next_full_calendar_year': {
      // January 1 of the year AFTER acquisition close
      // If no acq date, use next year from today
      if (acqDate && !isNaN(acqDate.getTime())) {
        const nextYear = getYear(acqDate) + 1;
        return new Date(nextYear, 0, 1); // Jan 1 of next year
      }
      const nextYear = getYear(fallbackDate) + 1;
      return new Date(nextYear, 0, 1);
    }
    
    case 'ttm_plus_one_month': {
      // First day of the month after TTM end date
      // If no TTM date, fall back to next month from today
      if (ttmDate && !isNaN(ttmDate.getTime())) {
        return startOfMonth(addMonths(ttmDate, 1));
      }
      return startOfMonth(addMonths(fallbackDate, 1));
    }
    
    default:
      // Default to acq_close_year behavior
      if (acqDate && !isNaN(acqDate.getTime())) {
        return startOfYear(acqDate);
      }
      return startOfYear(fallbackDate);
  }
}

/**
 * Build the array of monthly periods for the projection horizon.
 * Every downstream calculation should use this array.
 */
export function buildMonthlyPeriods(
  projectionStartDate: Date,
  holdPeriodMonths: number
): MonthlyPeriod[] {
  const periods: MonthlyPeriod[] = [];
  const startYear = getYear(projectionStartDate);
  
  for (let i = 0; i < holdPeriodMonths; i++) {
    const date = addMonths(projectionStartDate, i);
    const year = getYear(date);
    const month = getMonth(date) + 1; // Convert 0-based to 1-based
    
    // Calculate year index (0-based year from projection start)
    // Year 1 = months 0-11, Year 2 = months 12-23, etc.
    // But we need to handle partial first years correctly
    const yearIndex = Math.floor(i / 12);
    
    periods.push({
      index: i,
      date: startOfMonth(date),
      monthEnd: endOfMonth(date),
      year,
      month,
      key: format(date, 'yyyy-MM'),
      label: format(date, 'MMM yyyy'),
      quarterIndex: Math.floor(i / 3),
      yearIndex,
      isFirstMonthOfYear: month === 1,
      isLastMonthOfYear: month === 12,
    });
  }
  
  return periods;
}

/**
 * Build annual periods from monthly periods for rollup views.
 * Maps each projection year to its constituent months.
 */
export function buildAnnualPeriods(monthlyPeriods: MonthlyPeriod[]): AnnualPeriod[] {
  if (monthlyPeriods.length === 0) return [];
  
  // Group by yearIndex (projection year, not calendar year)
  const yearMap = new Map<number, MonthlyPeriod[]>();
  
  for (const period of monthlyPeriods) {
    const existing = yearMap.get(period.yearIndex) || [];
    existing.push(period);
    yearMap.set(period.yearIndex, existing);
  }
  
  const annualPeriods: AnnualPeriod[] = [];
  
  for (const [yearIndex, months] of yearMap.entries()) {
    // Use the calendar year of the first month in this projection year
    const firstMonth = months[0];
    const calendarYear = firstMonth.year;
    
    annualPeriods.push({
      yearIndex,
      year: calendarYear,
      label: `Year ${yearIndex + 1} (${calendarYear})`,
      monthIndices: months.map(m => m.index),
      monthCount: months.length,
    });
  }
  
  return annualPeriods.sort((a, b) => a.yearIndex - b.yearIndex);
}

/**
 * Main entry point: build complete period structure from config.
 * Use this in Pro Forma Engine, Capital Stack, Sensitivity Matrix, etc.
 */
export function buildModelingPeriods(config: TimelineConfig): PeriodResult {
  // Normalize hold period to months
  let holdPeriodMonths = config.holdPeriodMonths;
  if (!holdPeriodMonths && config.holdPeriodYears) {
    holdPeriodMonths = config.holdPeriodYears * 12;
  }
  if (!holdPeriodMonths) {
    holdPeriodMonths = 60; // Default 5 years
  }
  
  const projectionStartDate = deriveProjectionStartDate(config);
  const monthlyPeriods = buildMonthlyPeriods(projectionStartDate, holdPeriodMonths);
  const annualPeriods = buildAnnualPeriods(monthlyPeriods);
  
  const projectionEndDate = monthlyPeriods.length > 0 
    ? monthlyPeriods[monthlyPeriods.length - 1].monthEnd
    : projectionStartDate;
  
  return {
    projectionStartDate,
    projectionEndDate,
    monthlyPeriods,
    annualPeriods,
    holdPeriodMonths,
    holdPeriodYears: Math.ceil(holdPeriodMonths / 12),
    totalMonths: monthlyPeriods.length,
  };
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get the period index for a specific date.
 * Returns -1 if date is outside projection range.
 */
export function getPeriodIndexForDate(
  date: Date | string,
  monthlyPeriods: MonthlyPeriod[]
): number {
  const targetKey = format(new Date(date), 'yyyy-MM');
  const period = monthlyPeriods.find(p => p.key === targetKey);
  return period?.index ?? -1;
}

/**
 * Get periods for a specific projection year (1-based).
 */
export function getPeriodsForYear(
  yearNumber: number, // 1-based (Year 1, Year 2, etc.)
  monthlyPeriods: MonthlyPeriod[]
): MonthlyPeriod[] {
  const yearIndex = yearNumber - 1; // Convert to 0-based
  return monthlyPeriods.filter(p => p.yearIndex === yearIndex);
}

/**
 * Convert annual growth rate to monthly rate.
 * Formula: (1 + annual)^(1/12) - 1
 */
export function annualToMonthlyRate(annualRate: number): number {
  return Math.pow(1 + annualRate, 1 / 12) - 1;
}

/**
 * Convert monthly growth rate to annual rate.
 * Formula: (1 + monthly)^12 - 1
 */
export function monthlyToAnnualRate(monthlyRate: number): number {
  return Math.pow(1 + monthlyRate, 12) - 1;
}

/**
 * Convert monthly IRR to annualized IRR.
 */
export function monthlyIrrToAnnualized(monthlyIrr: number): number {
  return Math.pow(1 + monthlyIrr, 12) - 1;
}

/**
 * Generate array of years for display (e.g., dropdowns, table headers).
 * Returns calendar years covered by the projection.
 */
export function getProjectionYears(monthlyPeriods: MonthlyPeriod[]): number[] {
  const years = new Set<number>();
  for (const period of monthlyPeriods) {
    years.add(period.year);
  }
  return Array.from(years).sort((a, b) => a - b);
}

/**
 * Generate year labels for UI display.
 * Returns array like ['Year 1 (2025)', 'Year 2 (2026)', ...]
 */
export function getProjectionYearLabels(annualPeriods: AnnualPeriod[]): string[] {
  return annualPeriods.map(p => p.label);
}

/**
 * Calculate stabilized NOI period index based on mode.
 */
export function getStabilizedNoiPeriodIndex(
  mode: StabilizedNoiMode,
  options: {
    fixedYear?: number;      // For 'fixed_year' mode (1-based)
    userSetMonth?: number;   // For 'user_set' mode (period index)
    rampCompleteMonth?: number; // For 'post_ramp' mode (period index)
  },
  monthlyPeriods: MonthlyPeriod[]
): number {
  switch (mode) {
    case 'fixed_year': {
      // Default to Year 3 (index 2), month 11 (end of year)
      const yearIndex = (options.fixedYear || 3) - 1;
      const yearPeriods = monthlyPeriods.filter(p => p.yearIndex === yearIndex);
      if (yearPeriods.length === 0) {
        // Fall back to last available period
        return monthlyPeriods.length - 1;
      }
      // Return last month of that year
      return yearPeriods[yearPeriods.length - 1].index;
    }
    
    case 'user_set': {
      return options.userSetMonth ?? monthlyPeriods.length - 1;
    }
    
    case 'post_ramp': {
      // First full year after ramp completes
      const rampComplete = options.rampCompleteMonth ?? 0;
      // Find the start of the next full year after ramp
      const rampPeriod = monthlyPeriods[rampComplete];
      if (!rampPeriod) return monthlyPeriods.length - 1;
      
      // Find first January after ramp, then go to end of that year
      for (let i = rampComplete; i < monthlyPeriods.length; i++) {
        if (monthlyPeriods[i].month === 1 && i > rampComplete) {
          // Found start of next year, return end of that year
          const yearIndex = monthlyPeriods[i].yearIndex;
          const yearPeriods = monthlyPeriods.filter(p => p.yearIndex === yearIndex);
          return yearPeriods[yearPeriods.length - 1]?.index ?? i + 11;
        }
      }
      return monthlyPeriods.length - 1;
    }
    
    default:
      return monthlyPeriods.length - 1;
  }
}

// ============================================
// EXPORTS
// ============================================

export default {
  deriveProjectionStartDate,
  buildMonthlyPeriods,
  buildAnnualPeriods,
  buildModelingPeriods,
  getPeriodIndexForDate,
  getPeriodsForYear,
  annualToMonthlyRate,
  monthlyToAnnualRate,
  monthlyIrrToAnnualized,
  getProjectionYears,
  getProjectionYearLabels,
  getStabilizedNoiPeriodIndex,
};
