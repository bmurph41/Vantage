/**
 * Lease Economics Proration Module
 * 
 * Handles partial-period proration calculations using various day count conventions.
 */

import { 
  startOfMonth, 
  endOfMonth, 
  differenceInDays,
  getDaysInMonth,
  isBefore,
  isAfter,
  isEqual,
  max,
  min
} from 'date-fns';
import type { DayCountConvention } from '@shared/schema';

/**
 * Proration result for a period
 */
export interface ProrationResult {
  factor: number;           // 0-1, proportion of period active
  activeDays: number;       // Days the lease is active in period
  totalDays: number;        // Total days in the period
  isPartial: boolean;       // True if factor < 1
  adjustedAmount: number;   // Original amount * factor
}

/**
 * Calculate proration factor for a period based on day count convention
 */
export function calculateProration(
  periodStart: Date,
  periodEnd: Date,
  leaseStart: Date,
  leaseEnd: Date | null,
  monthlyAmount: number,
  dayCountConvention: DayCountConvention = 'actual_30'
): ProrationResult {
  // Default lease end to far future if null
  const effectiveLeaseEnd = leaseEnd || new Date(2099, 11, 31);
  
  // Calculate actual period boundaries
  const periodStartNorm = startOfMonth(periodStart);
  const periodEndNorm = endOfMonth(periodEnd);
  
  // If lease is completely outside this period
  if (isAfter(leaseStart, periodEndNorm) || isBefore(effectiveLeaseEnd, periodStartNorm)) {
    return {
      factor: 0,
      activeDays: 0,
      totalDays: getTotalDayCount(periodStartNorm, dayCountConvention),
      isPartial: true,
      adjustedAmount: 0,
    };
  }
  
  // Calculate active period within the month
  const activeStart = max([periodStartNorm, leaseStart]);
  const activeEnd = min([periodEndNorm, effectiveLeaseEnd]);
  
  // Check if lease covers the full accounting period
  // activeStart == periodStartNorm means lease started on or before month start
  // activeEnd == periodEndNorm means lease ends on or after month end
  // Since activeStart = max(periodStart, leaseStart), it equals periodStart only if lease started on/before month start
  // Since activeEnd = min(periodEnd, leaseEnd), it equals periodEnd only if lease ends on/after month end
  const isFullPeriod = isEqual(activeStart, periodStartNorm) && isEqual(activeEnd, periodEndNorm);
  
  // Calculate days: active days are always actual, total days depend on convention
  const totalDays = getTotalDayCount(periodStartNorm, dayCountConvention);
  
  // For full periods, use the denominator as the numerator to get factor = 1.0
  // This ensures full months are billed at 100% regardless of actual days
  const activeDays = isFullPeriod 
    ? totalDays 
    : getActiveDayCount(activeStart, activeEnd, dayCountConvention);
  
  // Factor is capped at 1.0 (can't have more than 100% of the month)
  const factor = Math.min(activeDays / totalDays, 1.0);
  const isPartial = !isFullPeriod && factor < 0.9999; // Allow for floating point
  
  return {
    factor,
    activeDays,
    totalDays,
    isPartial,
    adjustedAmount: monthlyAmount * factor,
  };
}

/**
 * Get day count for the active portion based on convention
 * 
 * For partial periods, we calculate the actual days active and the denominator
 * based on the convention:
 * - actual_30: Actual days active / 30 (standard 30-day month assumption)
 * - actual_actual: Actual days active / actual days in month
 * - actual_365: Actual days active / actual days in month
 */
function getActiveDayCount(
  startDate: Date,
  endDate: Date,
  convention: DayCountConvention
): number {
  // Always use actual days for the active portion
  return differenceInDays(endDate, startDate) + 1;
}

/**
 * Get the total day count (denominator) for proration based on convention
 */
function getTotalDayCount(
  periodStart: Date,
  convention: DayCountConvention
): number {
  switch (convention) {
    case 'actual_30':
      // Use 30 days per month (most common in RE underwriting)
      return 30;
      
    case 'actual_actual':
      // Use actual days in the month
      return getDaysInMonth(periodStart);
      
    case 'actual_365':
      // Use actual days in the month
      return getDaysInMonth(periodStart);
      
    default:
      return 30;
  }
}

/**
 * Calculate pro-rated amount for partial first month
 */
export function prorateFirstMonth(
  leaseStart: Date,
  monthlyAmount: number,
  dayCountConvention: DayCountConvention = 'actual_30'
): ProrationResult {
  const monthEnd = endOfMonth(leaseStart);
  return calculateProration(
    leaseStart,
    monthEnd,
    leaseStart,
    null,
    monthlyAmount,
    dayCountConvention
  );
}

/**
 * Calculate pro-rated amount for partial last month
 */
export function prorateLastMonth(
  leaseEnd: Date,
  monthlyAmount: number,
  dayCountConvention: DayCountConvention = 'actual_30'
): ProrationResult {
  const monthStart = startOfMonth(leaseEnd);
  return calculateProration(
    monthStart,
    leaseEnd,
    new Date(2000, 0, 1), // Far past to ensure no start proration
    leaseEnd,
    monthlyAmount,
    dayCountConvention
  );
}

/**
 * Check if a date is within a period
 */
export function isWithinPeriod(
  date: Date,
  periodStart: Date,
  periodEnd: Date
): boolean {
  return (isAfter(date, periodStart) || isEqual(date, periodStart)) &&
         (isBefore(date, periodEnd) || isEqual(date, periodEnd));
}

/**
 * Get the number of full months between two dates
 */
export function getFullMonthsBetween(startDate: Date, endDate: Date): number {
  const start = startOfMonth(startDate);
  const end = startOfMonth(endDate);
  
  let months = 0;
  let current = start;
  
  while (isBefore(current, end)) {
    months++;
    current = new Date(current.getFullYear(), current.getMonth() + 1, 1);
  }
  
  return months;
}
