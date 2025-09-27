import { 
  format, 
  startOfDay, 
  addDays, 
  addWeeks,
  addMonths,
  startOfWeek,
  startOfMonth,
  differenceInDays,
  differenceInCalendarDays, 
  isAfter, 
  isBefore,
  parseISO,
  parse,
  isValid,
  setHours,
  setMinutes,
  setSeconds 
} from 'date-fns';
import { toZonedTime, format as formatTz } from 'date-fns-tz';

/**
 * Parse date string supporting both ISO format (YYYY-MM-DD) and M/DD/YYYY format
 */
export function parseDate(dateString: string): Date {
  if (!dateString) throw new Error('Date string is required');
  
  // First try ISO format (YYYY-MM-DD)
  try {
    const isoDate = parseISO(dateString);
    if (isValid(isoDate)) {
      return isoDate;
    }
  } catch (error) {
    // Continue to try other formats
  }
  
  // Try M/DD/YYYY formats
  const formats = ["M/d/yyyy", "MM/dd/yyyy", "M/dd/yyyy", "MM/d/yyyy"];
  
  for (const formatString of formats) {
    try {
      const date = parse(dateString, formatString, new Date());
      if (isValid(date)) {
        return date;
      }
    } catch (error) {
      continue;
    }
  }
  
  // Fallback to parseISO for error handling
  return parseISO(dateString);
}

export function tzNow(timezone: string = 'America/New_York'): Date {
  return toZonedTime(new Date(), timezone);
}

/**
 * Set any date to 5:00 PM in the specified timezone (defaults to America/New_York)
 * This ensures all deadlines are consistently at 5:00 PM EST instead of midnight
 */
export function setDeadlineTo5PM(date: Date | string, timezone: string = 'America/New_York'): Date {
  const dateObj = typeof date === 'string' ? parseISO(date) : date;
  
  // Set to 5:00 PM (17:00) with 0 minutes and 0 seconds
  const timeSet = setSeconds(setMinutes(setHours(dateObj, 17), 0), 0);
  
  // Ensure it's in the correct timezone
  return toZonedTime(timeSet, timezone);
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
  
  // For custom anchor, use PSA date or timezone-aware current date as fallback
  return project.psaSignedDate ? parseISO(project.psaSignedDate) : tzNow('America/New_York');
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
 * Get dynamic timeline window centered around today's date, with optional constraints
 */
export function getTimelineWindow(granularity: string, opts?: { 
  minStart?: Date; 
  maxEnd?: Date; 
  anchor?: Date; 
}): { start: Date; end: Date } {
  const anchor = opts?.anchor || startOfDay(tzNow('America/New_York'));
  
  // Determine half-span based on granularity
  let halfSpanDays: number;
  let addFunction: (date: Date, amount: number) => Date;
  let amount: number;
  
  switch (granularity) {
    case 'daily':
      halfSpanDays = 30; // 30 days before and after
      addFunction = addDays;
      amount = 30;
      break;
    
    case 'weekly':
      halfSpanDays = 8 * 7; // 8 weeks before and after
      addFunction = addWeeks;
      amount = 8;
      break;
    
    case 'biweekly':
      halfSpanDays = 12 * 7; // 12 weeks before and after
      addFunction = addWeeks;
      amount = 12;
      break;
    
    case 'monthly':
      halfSpanDays = 6 * 30; // Approximate 6 months before and after
      addFunction = addMonths;
      amount = 6;
      break;
    
    default:
      // Default to weekly view
      halfSpanDays = 8 * 7;
      addFunction = addWeeks;
      amount = 8;
  }
  
  // Calculate proposed window
  const proposedStart = addFunction(anchor, -amount);
  const proposedEnd = addFunction(anchor, amount);
  
  // Apply constraints
  let finalStart = proposedStart;
  let finalEnd = proposedEnd;
  
  // If minStart is provided and proposed start is before it, shift the window right
  if (opts?.minStart && isBefore(proposedStart, opts.minStart)) {
    finalStart = opts.minStart;
    // Maintain the full span by extending the end
    finalEnd = addDays(finalStart, halfSpanDays * 2);
  }
  
  // If maxEnd is provided and final end is after it, clamp the end
  if (opts?.maxEnd && isAfter(finalEnd, opts.maxEnd)) {
    finalEnd = opts.maxEnd;
    // If clamping collapses the span, adjust start to maintain reasonable span
    const minimalStart = addDays(finalEnd, -(halfSpanDays * 2));
    if (opts?.minStart) {
      finalStart = isAfter(minimalStart, opts.minStart) ? minimalStart : opts.minStart;
    } else {
      finalStart = minimalStart;
    }
  }
  
  return {
    start: finalStart,
    end: finalEnd
  };
}

/**
 * Calculate percentage position of a date within a range
 */
export function percentOfRange(date: Date, start: Date, end: Date): number {
  const total = differenceInCalendarDays(end, start);
  if (total <= 0) return 0;
  
  const elapsed = differenceInCalendarDays(date, start);
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
export function getTimelineTicks(granularity: string, opts?: { 
  minStart?: Date; 
  maxEnd?: Date; 
  anchor?: Date; 
}): Date[] {
  const { start, end } = getTimelineWindow(granularity, opts);
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
      // Show weekly ticks (every Monday), but never before timeline start
      let weeklyCurrent = startOfWeek(start, { weekStartsOn: 1 }); // Start on Monday
      if (weeklyCurrent < start) {
        weeklyCurrent = addWeeks(weeklyCurrent, 1);
      }
      while (weeklyCurrent <= end) {
        ticks.push(new Date(weeklyCurrent));
        weeklyCurrent = addWeeks(weeklyCurrent, 1);
      }
      break;
    
    case 'biweekly':
      // Show biweekly ticks, but never before timeline start
      let biweeklyCurrent = startOfWeek(start, { weekStartsOn: 1 });
      if (biweeklyCurrent < start) {
        biweeklyCurrent = addWeeks(biweeklyCurrent, 2);
      }
      while (biweeklyCurrent <= end) {
        ticks.push(new Date(biweeklyCurrent));
        biweeklyCurrent = addWeeks(biweeklyCurrent, 2);
      }
      break;
    
    case 'monthly':
      // Show monthly ticks (first of each month), but never before timeline start
      let monthlyCurrent = startOfMonth(start);
      if (monthlyCurrent < start) {
        monthlyCurrent = addMonths(monthlyCurrent, 1);
      }
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
 * Get fixed project timeline bounds from PSA Signed Date to Closing Date
 */
export function getProjectBounds(project: any): { start: Date; end: Date } {
  const start = startOfDay(project.psaSignedDate ? parseISO(project.psaSignedDate) : tzNow('America/New_York'));
  const end = startOfDay(project.closingDate ? parseISO(project.closingDate) : addDays(start, 90));
  return { start, end };
}

/**
 * Generate timeline ticks between fixed project bounds based on granularity
 */
export function getProjectTimelineTicks(project: any, granularity: string): Date[] {
  const { start, end } = getProjectBounds(project);
  const ticks: Date[] = [];
  
  switch (granularity) {
    case 'daily':
      // Show every 5 days between project bounds
      let dailyCurrent = new Date(start);
      while (dailyCurrent <= end) {
        ticks.push(new Date(dailyCurrent));
        dailyCurrent = addDays(dailyCurrent, 5);
      }
      break;
    
    case 'weekly':
      // Show weekly ticks (every Monday) between project bounds
      let weeklyCurrent = startOfWeek(start, { weekStartsOn: 1 });
      if (weeklyCurrent < start) {
        weeklyCurrent = addWeeks(weeklyCurrent, 1);
      }
      while (weeklyCurrent <= end) {
        ticks.push(new Date(weeklyCurrent));
        weeklyCurrent = addWeeks(weeklyCurrent, 1);
      }
      break;
    
    case 'biweekly':
      // Show biweekly ticks between project bounds
      let biweeklyCurrent = startOfWeek(start, { weekStartsOn: 1 });
      if (biweeklyCurrent < start) {
        biweeklyCurrent = addWeeks(biweeklyCurrent, 2);
      }
      while (biweeklyCurrent <= end) {
        ticks.push(new Date(biweeklyCurrent));
        biweeklyCurrent = addWeeks(biweeklyCurrent, 2);
      }
      break;
    
    case 'monthly':
      // Show monthly ticks (first of each month) between project bounds
      let monthlyCurrent = startOfMonth(start);
      if (monthlyCurrent < start) {
        monthlyCurrent = addMonths(monthlyCurrent, 1);
      }
      while (monthlyCurrent <= end) {
        ticks.push(new Date(monthlyCurrent));
        monthlyCurrent = addMonths(monthlyCurrent, 1);
      }
      break;
    
    default:
      // Default to weekly
      let defaultCurrent = startOfWeek(start, { weekStartsOn: 1 });
      if (defaultCurrent < start) {
        defaultCurrent = addWeeks(defaultCurrent, 1);
      }
      while (defaultCurrent <= end) {
        ticks.push(new Date(defaultCurrent));
        defaultCurrent = addWeeks(defaultCurrent, 1);
      }
  }
  
  return ticks;
}

/**
 * GRANULARITY-AWARE POSITIONING FUNCTIONS
 * These functions align elements with the visible date grid instead of the full project timeline
 */

/**
 * Calculate position percentage based on visible date grid ticks from granularity
 * This ensures milestone dots and progress bars align with the actual displayed date grid
 */
export function percentOfGranularityRange(date: Date, project: any, granularity: string): number {
  const { start: timelineStart, end: timelineEnd } = getProjectBounds(project);
  const visibleTicks = getProjectTimelineTicks(project, granularity);
  
  // If no visible ticks or date is outside bounds, fall back to linear positioning
  if (visibleTicks.length === 0) {
    return percentOfRange(date, timelineStart, timelineEnd);
  }
  
  // Clamp date to timeline bounds
  const clampedDate = clampDate(date, timelineStart, timelineEnd);
  
  // Find the tick interval that contains this date
  let leftTick = visibleTicks[0];
  let rightTick = visibleTicks[visibleTicks.length - 1];
  let leftIndex = 0;
  let rightIndex = visibleTicks.length - 1;
  
  // Find the closest tick pair that brackets this date
  for (let i = 0; i < visibleTicks.length - 1; i++) {
    if (clampedDate >= visibleTicks[i] && clampedDate <= visibleTicks[i + 1]) {
      leftTick = visibleTicks[i];
      rightTick = visibleTicks[i + 1];
      leftIndex = i;
      rightIndex = i + 1;
      break;
    }
  }
  
  // If date is before first tick, use first interval
  if (clampedDate < visibleTicks[0]) {
    leftTick = timelineStart;
    rightTick = visibleTicks[0];
    leftIndex = -1; // Special case for before first tick
    rightIndex = 0;
  }
  
  // If date is after last tick, use last interval
  if (clampedDate > visibleTicks[visibleTicks.length - 1]) {
    leftTick = visibleTicks[visibleTicks.length - 1];
    rightTick = timelineEnd;
    leftIndex = visibleTicks.length - 1;
    rightIndex = visibleTicks.length; // Special case for after last tick
  }
  
  // Calculate position within the tick interval
  const tickIntervalDays = Math.max(1, differenceInCalendarDays(rightTick, leftTick));
  const dateOffsetDays = differenceInCalendarDays(clampedDate, leftTick);
  const intervalProgress = Math.max(0, Math.min(1, dateOffsetDays / tickIntervalDays));
  
  // Calculate grid positions for the ticks
  let leftPosition: number;
  let rightPosition: number;
  
  if (leftIndex === -1) {
    // Special case: before first tick
    leftPosition = 0;
    rightPosition = percentOfRange(rightTick, timelineStart, timelineEnd);
  } else if (rightIndex === visibleTicks.length) {
    // Special case: after last tick
    leftPosition = percentOfRange(leftTick, timelineStart, timelineEnd);
    rightPosition = 100;
  } else {
    // Normal case: between two visible ticks
    leftPosition = percentOfRange(leftTick, timelineStart, timelineEnd);
    rightPosition = percentOfRange(rightTick, timelineStart, timelineEnd);
  }
  
  // Interpolate between the tick positions
  const finalPosition = leftPosition + (rightPosition - leftPosition) * intervalProgress;
  
  return Math.max(0, Math.min(100, finalPosition));
}

/**
 * Get milestone position aligned with granularity-based date grid
 * This replaces the simple percentOfRange approach for milestone positioning
 */
export function getMilestonePositionWithGranularity(dateString: string, project: any, granularity: string): number {
  const date = parseISO(dateString);
  return percentOfGranularityRange(date, project, granularity);
}

/**
 * Calculate granularity-aware progress bar positioning for tasks
 * Returns positioning data that aligns with the visible date grid
 */
export function getGranularityAwareProgressPositions(
  task: any,
  project: any,
  granularity: string,
  settings?: any
): {
  taskStart: Date;
  taskDeadline: Date;
  barStartPosition: number;
  barEndPosition: number;
  todayPosition: number;
  timelineStart: Date;
  timelineEnd: Date;
} {
  const today = startOfDay(tzNow('America/New_York'));
  const { start: timelineStart, end: timelineEnd } = getProjectBounds(project);
  
  // Calculate individual task start date
  const taskStart = startOfDay(task.startDate 
    ? parseISO(task.startDate) 
    : project.psaSignedDate 
      ? addDays(parseISO(project.psaSignedDate), task.startOffsetDays || 0)
      : today);
  
  // Calculate individual task deadline using same logic as existing components
  const calculateTaskDeadline = (task: any): Date => {
    if (task.deadline) {
      return parseISO(task.deadline);
    } else if (task.deadlineType === 'dd_expiration' && project.ddExpirationDate) {
      return parseISO(project.ddExpirationDate);
    } else if (task.deadlineType === 'days_after_psa' && task.deadlineDays && project.psaSignedDate) {
      const psaDate = parseISO(project.psaSignedDate);
      return addDays(psaDate, task.deadlineDays);
    } else {
      const startDate = task.startDate 
        ? parseISO(task.startDate) 
        : project.psaSignedDate 
          ? addDays(parseISO(project.psaSignedDate), task.startOffsetDays || 0)
          : today;
      
      const defaultDuration = task.priority === 'high' ? 5 : task.priority === 'med' ? 10 : 21;
      return addDays(startDate, defaultDuration);
    }
  };
  
  const taskDeadline = setDeadlineTo5PM(calculateTaskDeadline(task));
  
  // Use granularity-aware positioning for all elements
  const barStartPosition = percentOfGranularityRange(timelineStart, project, granularity); // PSA start position
  const barEndPosition = percentOfGranularityRange(taskDeadline, project, granularity);
  const todayPosition = percentOfGranularityRange(today, project, granularity);
  
  return {
    taskStart,
    taskDeadline,
    barStartPosition,
    barEndPosition,
    todayPosition,
    timelineStart,
    timelineEnd
  };
}

// Professional currency formatting function for large amounts
export function formatLargeCurrency(amount: number): string {
  if (amount >= 1000000) {
    // For millions: $1M, $2.1M, etc.
    const millions = amount / 1000000;
    return millions % 1 === 0 ? `$${millions.toFixed(0)}M` : `$${millions.toFixed(1)}M`;
  } else if (amount >= 1000) {
    // For thousands: $1K, $1.5K, etc.
    const thousands = amount / 1000;
    return thousands % 1 === 0 ? `$${thousands.toFixed(0)}K` : `$${thousands.toFixed(1)}K`;
  } else {
    // For smaller amounts: regular currency format
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  }
}
