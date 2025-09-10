import { 
  format, 
  startOfDay, 
  addDays, 
  addWeeks,
  addMonths,
  startOfWeek,
  startOfMonth,
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

// DYNAMIC SLIDING WINDOW TIMELINE UTILITIES

/**
 * Get dynamic timeline window centered around today's date
 */
export function getTimelineWindow(granularity: string): { start: Date; end: Date } {
  const today = startOfDay(tzNow('America/New_York'));
  
  switch (granularity) {
    case 'daily':
      // Show 60 days: 30 before today, 30 after today
      return {
        start: addDays(today, -30),
        end: addDays(today, 30)
      };
    
    case 'weekly':
      // Show 16 weeks: 8 weeks before today, 8 weeks after today  
      return {
        start: addWeeks(today, -8),
        end: addWeeks(today, 8)
      };
    
    case 'biweekly':
      // Show 24 weeks: 12 weeks before today, 12 weeks after today
      return {
        start: addWeeks(today, -12),
        end: addWeeks(today, 12)
      };
    
    case 'monthly':
      // Show 12 months: 6 months before today, 6 months after today
      return {
        start: addMonths(today, -6),
        end: addMonths(today, 6)
      };
    
    default:
      // Default to weekly view
      return {
        start: addWeeks(today, -8),
        end: addWeeks(today, 8)
      };
  }
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
 * Clamp a date to stay within the given range
 */
export function clampDate(date: Date, start: Date, end: Date): Date {
  if (isBefore(date, start)) return start;
  if (isAfter(date, end)) return end;
  return date;
}

/**
 * Generate visible timeline ticks with proper spacing for each granularity
 */
export function getTimelineTicks(granularity: string): Date[] {
  const { start, end } = getTimelineWindow(granularity);
  const ticks: Date[] = [];
  
  switch (granularity) {
    case 'daily':
      // Show every 5 days to keep it legible (12 ticks for 60-day window)
      let dailyCurrent = new Date(start);
      while (dailyCurrent <= end) {
        ticks.push(new Date(dailyCurrent));
        dailyCurrent = addDays(dailyCurrent, 5);
      }
      break;
    
    case 'weekly':
      // Show weekly ticks (every Monday)
      let weeklyCurrent = startOfWeek(start, { weekStartsOn: 1 }); // Start on Monday
      while (weeklyCurrent <= end) {
        ticks.push(new Date(weeklyCurrent));
        weeklyCurrent = addWeeks(weeklyCurrent, 1);
      }
      break;
    
    case 'biweekly':
      // Show biweekly ticks
      let biweeklyCurrent = startOfWeek(start, { weekStartsOn: 1 });
      while (biweeklyCurrent <= end) {
        ticks.push(new Date(biweeklyCurrent));
        biweeklyCurrent = addWeeks(biweeklyCurrent, 2);
      }
      break;
    
    case 'monthly':
      // Show monthly ticks (first of each month)
      let monthlyCurrent = startOfMonth(start);
      while (monthlyCurrent <= end) {
        ticks.push(new Date(monthlyCurrent));
        monthlyCurrent = addMonths(monthlyCurrent, 1);
      }
      break;
    
    default:
      // Default to weekly
      let defaultCurrent = startOfWeek(start, { weekStartsOn: 1 });
      while (defaultCurrent <= end) {
        ticks.push(new Date(defaultCurrent));
        defaultCurrent = addWeeks(defaultCurrent, 1);
      }
  }
  
  return ticks;
}

/**
 * Legacy function for backward compatibility
 */
export function getProjectBounds(project: any): { start: Date; end: Date } {
  const start = startOfDay(project.psaSignedDate ? parseISO(project.psaSignedDate) : new Date());
  const end = startOfDay(project.closingDate ? parseISO(project.closingDate) : addDays(start, 90));
  return { start, end };
}
