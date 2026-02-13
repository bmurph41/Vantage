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
export type Year1Mode = 'calendar_year_end' | 'next_12_months';

export interface T12Context {
  t12StartMonth: number;  // 1-12
  t12StartYear: number;
  t12EndMonth: number;    // 1-12
  t12EndYear: number;
  year1Mode: Year1Mode;
}

export interface TimelineConfig {
  acquisitionCloseDate: Date | string | null;
  ttmEndDate: Date | string | null;
  projectionStartRule: ProjectionStartRule;
  holdPeriodMonths: number;
  holdPeriodYears?: number; // Derived or legacy input
  t12Context?: T12Context; // T12-aware projection context
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
  isActual?: boolean;      // True if this month is covered by T12 actual data
  isForecast?: boolean;    // True if this month is projected/forecast
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
// T12-AWARE PERIOD BUILDING
// ============================================

function isMonthInT12Range(year: number, month: number, t12: T12Context): boolean {
  const t12StartVal = t12.t12StartYear * 12 + t12.t12StartMonth;
  const t12EndVal = t12.t12EndYear * 12 + t12.t12EndMonth;
  const monthVal = year * 12 + month;
  return monthVal >= t12StartVal && monthVal <= t12EndVal;
}

export function buildT12AwarePeriods(config: TimelineConfig): PeriodResult {
  const t12 = config.t12Context;
  if (!t12) {
    return buildModelingPeriods(config);
  }

  let holdPeriodMonths = config.holdPeriodMonths;
  if (!holdPeriodMonths && config.holdPeriodYears) {
    holdPeriodMonths = config.holdPeriodYears * 12;
  }
  if (!holdPeriodMonths) {
    holdPeriodMonths = 60;
  }

  let projectionStartDate: Date;

  if (t12.year1Mode === 'next_12_months') {
    const endDate = new Date(t12.t12EndYear, t12.t12EndMonth - 1, 1);
    projectionStartDate = startOfMonth(addMonths(endDate, 1));
  } else {
    let year1Year = t12.t12EndYear;
    if (t12.t12EndMonth === 12) {
      year1Year = t12.t12EndYear + 1;
    }
    projectionStartDate = new Date(year1Year, 0, 1);
  }

  const monthlyPeriods: MonthlyPeriod[] = [];
  const startMonth = getMonth(projectionStartDate) + 1;

  for (let i = 0; i < holdPeriodMonths; i++) {
    const date = addMonths(projectionStartDate, i);
    const year = getYear(date);
    const month = getMonth(date) + 1;

    let yearIndex: number;
    if (t12.year1Mode === 'next_12_months') {
      yearIndex = Math.floor(i / 12);
    } else {
      yearIndex = year - getYear(projectionStartDate);
    }

    const actual = isMonthInT12Range(year, month, t12);

    let isFirstOfProjectionYear: boolean;
    let isLastOfProjectionYear: boolean;

    if (t12.year1Mode === 'next_12_months') {
      isFirstOfProjectionYear = (i % 12) === 0;
      isLastOfProjectionYear = (i % 12) === 11;
    } else {
      isFirstOfProjectionYear = month === 1;
      isLastOfProjectionYear = month === 12;
    }

    monthlyPeriods.push({
      index: i,
      date: startOfMonth(date),
      monthEnd: endOfMonth(date),
      year,
      month,
      key: format(date, 'yyyy-MM'),
      label: format(date, 'MMM yyyy'),
      quarterIndex: Math.floor(i / 3),
      yearIndex,
      isFirstMonthOfYear: isFirstOfProjectionYear,
      isLastMonthOfYear: isLastOfProjectionYear,
      isActual: actual,
      isForecast: !actual,
    });
  }

  let annualPeriods: AnnualPeriod[];

  if (t12.year1Mode === 'next_12_months') {
    const yearMap = new Map<number, MonthlyPeriod[]>();
    for (const period of monthlyPeriods) {
      const existing = yearMap.get(period.yearIndex) || [];
      existing.push(period);
      yearMap.set(period.yearIndex, existing);
    }

    annualPeriods = [];
    for (const [yIdx, months] of yearMap.entries()) {
      const first = months[0];
      const last = months[months.length - 1];
      const startLabel = format(first.date, 'MMM yyyy');
      const endLabel = format(last.date, 'MMM yyyy');

      annualPeriods.push({
        yearIndex: yIdx,
        year: first.year,
        label: `Year ${yIdx + 1} (${startLabel}–${endLabel})`,
        monthIndices: months.map(m => m.index),
        monthCount: months.length,
      });
    }
    annualPeriods.sort((a, b) => a.yearIndex - b.yearIndex);
  } else {
    const yearMap = new Map<number, MonthlyPeriod[]>();
    for (const period of monthlyPeriods) {
      const existing = yearMap.get(period.yearIndex) || [];
      existing.push(period);
      yearMap.set(period.yearIndex, existing);
    }

    annualPeriods = [];
    for (const [yIdx, months] of yearMap.entries()) {
      const firstMonth = months[0];
      const calYear = firstMonth.year;
      const actualCount = months.filter(m => m.isActual).length;
      const forecastCount = months.filter(m => m.isForecast).length;

      let label = `Year ${yIdx + 1} (${calYear})`;
      if (actualCount > 0 && forecastCount > 0) {
        label = `Year ${yIdx + 1} (${calYear}) — ${actualCount}mo Actual, ${forecastCount}mo Forecast`;
      }

      annualPeriods.push({
        yearIndex: yIdx,
        year: calYear,
        label,
        monthIndices: months.map(m => m.index),
        monthCount: months.length,
      });
    }
    annualPeriods.sort((a, b) => a.yearIndex - b.yearIndex);
  }

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
// EXPORTS
// ============================================

export default {
  deriveProjectionStartDate,
  buildMonthlyPeriods,
  buildAnnualPeriods,
  buildModelingPeriods,
  buildT12AwarePeriods,
  getPeriodIndexForDate,
  getPeriodsForYear,
  annualToMonthlyRate,
  monthlyToAnnualRate,
  monthlyIrrToAnnualized,
  getProjectionYears,
  getProjectionYearLabels,
  getStabilizedNoiPeriodIndex,
};
