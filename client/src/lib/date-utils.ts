import { 
  format, 
  startOfDay, 
  addDays, 
  differenceInDays, 
  isAfter, 
  isBefore,
  parseISO 
} from 'date-fns';
import { toZonedTime, format as formatTz } from 'date-fns-tz';

export function tzNow(timezone: string = 'America/New_York'): Date {
  return toZonedTime(new Date(), timezone);
}

export function formatDateInTz(date: Date | string, timezone: string = 'America/New_York', formatStr: string = 'yyyy-MM-dd'): string {
  const dateObj = typeof date === 'string' ? parseISO(date) : date;
  return formatTz(toZonedTime(dateObj, timezone), formatStr, { timeZone: timezone });
}

export function daysBetween(start: Date | string, end: Date | string, useBusinessDays: boolean = false, holidayCalendar: string = 'us_federal'): number {
  const startDate = typeof start === 'string' ? parseISO(start) : start;
  const endDate = typeof end === 'string' ? parseISO(end) : end;
  
  if (useBusinessDays) {
    return businessDaysBetween(startDate, endDate, holidayCalendar);
  }
  
  return Math.max(0, differenceInDays(endDate, startDate));
}

export function businessDaysBetween(start: Date, end: Date, holidayCalendar: string = 'us_federal'): number {
  let count = 0;
  let current = startOfDay(start);
  const endDay = startOfDay(end);
  
  while (isBefore(current, endDay) || current.getTime() === endDay.getTime()) {
    if (isBusinessDay(current, holidayCalendar)) {
      count++;
    }
    current = addDays(current, 1);
  }
  
  return count;
}

export function isBusinessDay(date: Date, holidayCalendar: string = 'us_federal'): boolean {
  const dayOfWeek = date.getDay();
  
  // Weekend check
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return false;
  }
  
  // Holiday check
  if (holidayCalendar === 'us_federal' && isUSFederalHoliday(date)) {
    return false;
  }
  
  return true;
}

export function addBusinessDays(date: Date, days: number, holidayCalendar: string = 'us_federal'): Date {
  let current = startOfDay(date);
  let remaining = days;
  
  while (remaining > 0) {
    current = addDays(current, 1);
    if (isBusinessDay(current, holidayCalendar)) {
      remaining--;
    }
  }
  
  return current;
}

export function isUSFederalHoliday(date: Date): boolean {
  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();
  
  // This is a simplified implementation. In production, use a proper holiday library
  const holidays = [
    new Date(year, 0, 1),   // New Year's Day
    new Date(year, 6, 4),   // Independence Day
    new Date(year, 11, 25), // Christmas Day
    // Add more federal holidays as needed
  ];
  
  return holidays.some(holiday => 
    holiday.getMonth() === month && holiday.getDate() === day
  );
}

export function anchorDate(project: any): Date {
  if (project.anchorType === 'psa' && project.psaSignedDate) {
    return parseISO(project.psaSignedDate);
  }
  
  // For custom anchor, use PSA date or current date as fallback
  return project.psaSignedDate ? parseISO(project.psaSignedDate) : new Date();
}

export function effectiveStart(task: any, project: any): Date {
  if (task.startStrategy === 'fixed' && task.startDate) {
    return parseISO(task.startDate);
  }
  
  const anchor = anchorDate(project);
  const offsetDays = task.startOffsetDays || 0;
  
  if (project.settings?.useBusinessDays) {
    return addBusinessDays(anchor, offsetDays, project.settings.holidayCalendar);
  }
  
  return addDays(anchor, offsetDays);
}

export function effectiveDue(task: any, project: any): Date {
  const start = effectiveStart(task, project);
  
  if (project.settings?.useBusinessDays) {
    return addBusinessDays(start, task.durationDays, project.settings.holidayCalendar);
  }
  
  return addDays(start, task.durationDays);
}

// New Timeline Utility Functions for Fixed Range System

/**
 * Get the project timeline bounds (start and end dates)
 */
export function getProjectBounds(project: any): { start: Date; end: Date } {
  const start = startOfDay(project.psaSignedDate ? parseISO(project.psaSignedDate) : new Date());
  const end = startOfDay(project.closingDate ? parseISO(project.closingDate) : addDays(start, 90));
  return { start, end };
}

/**
 * Generate all days between start and end dates
 */
export function eachDay(start: Date, end: Date): Date[] {
  const days: Date[] = [];
  let current = startOfDay(start);
  const endDay = startOfDay(end);
  
  while (current <= endDay) {
    days.push(new Date(current));
    current = addDays(current, 1);
  }
  
  return days;
}

/**
 * Calculate percentage position of a date within a range
 */
export function percentOfRange(date: Date, start: Date, end: Date): number {
  const total = differenceInDays(end, start);
  if (total <= 0) return 0;
  
  const elapsed = differenceInDays(date, start);
  return Math.max(0, Math.min(100, (elapsed / total) * 100));
}

/**
 * Clamp a date to be within the project range
 */
export function clampDate(date: Date, start: Date, end: Date): Date {
  if (isBefore(date, start)) return start;
  if (isAfter(date, end)) return end;
  return date;
}

/**
 * Get visible tick marks based on granularity
 */
export function getVisibleTicks(allDays: Date[], granularity: string): Date[] {
  if (!allDays.length) return [];
  
  const start = allDays[0];
  const end = allDays[allDays.length - 1];
  
  switch (granularity) {
    case 'daily':
      return allDays;
      
    case 'weekly':
      const weeklyTicks: Date[] = [];
      let current = startOfDay(start);
      while (current <= end) {
        weeklyTicks.push(new Date(current));
        current = addDays(current, 7);
      }
      return weeklyTicks;
      
    case 'biweekly':
      const biweeklyTicks: Date[] = [];
      let biweeklyCurrent = startOfDay(start);
      while (biweeklyCurrent <= end) {
        biweeklyTicks.push(new Date(biweeklyCurrent));
        biweeklyCurrent = addDays(biweeklyCurrent, 14);
      }
      return biweeklyTicks;
      
    case 'monthly':
      const monthlyTicks: Date[] = [];
      let monthlyCurrent = startOfDay(start);
      while (monthlyCurrent <= end) {
        monthlyTicks.push(new Date(monthlyCurrent));
        // Move to first day of next month
        const nextMonth = new Date(monthlyCurrent.getFullYear(), monthlyCurrent.getMonth() + 1, 1);
        monthlyCurrent = nextMonth > end ? addDays(end, 1) : nextMonth;
      }
      return monthlyTicks;
      
    default:
      return allDays;
  }
}
