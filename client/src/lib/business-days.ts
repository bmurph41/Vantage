import { 
  addDays, 
  startOfDay, 
  differenceInDays, 
  isAfter, 
  isBefore,
  getDay,
  getYear,
  getMonth,
  getDate
} from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

export interface Holiday {
  name: string;
  date: Date;
}

// US Federal Holidays for a given year (timezone-aware)
export function getUSFederalHolidays(year: number, timezone: string = 'America/New_York'): Holiday[] {
  const holidays: Holiday[] = [
    { name: "New Year's Day", date: toZonedTime(new Date(year, 0, 1), timezone) },
    { name: "Independence Day", date: toZonedTime(new Date(year, 6, 4), timezone) },
    { name: "Veterans Day", date: toZonedTime(new Date(year, 10, 11), timezone) },
    { name: "Christmas Day", date: toZonedTime(new Date(year, 11, 25), timezone) },
  ];

  // Martin Luther King Jr. Day - Third Monday in January
  const mlkDay = getNthWeekdayOfMonth(year, 0, 1, 3, timezone); // January, Monday, 3rd
  holidays.push({ name: "Martin Luther King Jr. Day", date: mlkDay });

  // Presidents' Day - Third Monday in February
  const presidentsDay = getNthWeekdayOfMonth(year, 1, 1, 3, timezone); // February, Monday, 3rd
  holidays.push({ name: "Presidents' Day", date: presidentsDay });

  // Memorial Day - Last Monday in May
  const memorialDay = getLastWeekdayOfMonth(year, 4, 1, timezone); // May, Monday
  holidays.push({ name: "Memorial Day", date: memorialDay });

  // Labor Day - First Monday in September
  const laborDay = getNthWeekdayOfMonth(year, 8, 1, 1, timezone); // September, Monday, 1st
  holidays.push({ name: "Labor Day", date: laborDay });

  // Columbus Day - Second Monday in October
  const columbusDay = getNthWeekdayOfMonth(year, 9, 1, 2, timezone); // October, Monday, 2nd
  holidays.push({ name: "Columbus Day", date: columbusDay });

  // Thanksgiving - Fourth Thursday in November
  const thanksgiving = getNthWeekdayOfMonth(year, 10, 4, 4, timezone); // November, Thursday, 4th
  holidays.push({ name: "Thanksgiving Day", date: thanksgiving });

  return holidays;
}

function getNthWeekdayOfMonth(year: number, month: number, weekday: number, n: number, timezone: string = 'America/New_York'): Date {
  const firstDay = toZonedTime(new Date(year, month, 1), timezone);
  const firstWeekday = getDay(firstDay);
  const offset = (weekday - firstWeekday + 7) % 7;
  const targetDate = 1 + offset + (n - 1) * 7;
  return toZonedTime(new Date(year, month, targetDate), timezone);
}

function getLastWeekdayOfMonth(year: number, month: number, weekday: number, timezone: string = 'America/New_York'): Date {
  const lastDay = toZonedTime(new Date(year, month + 1, 0), timezone);
  const lastWeekday = getDay(lastDay);
  const offset = (lastWeekday - weekday + 7) % 7;
  const targetDate = lastDay.getDate() - offset;
  return toZonedTime(new Date(year, month, targetDate), timezone);
}

export function isBusinessDay(date: Date, holidayCalendar: string = 'us_federal', timezone: string = 'America/New_York'): boolean {
  const tzDate = toZonedTime(date, timezone);
  const dayOfWeek = getDay(tzDate);
  
  // Weekend check (Sunday = 0, Saturday = 6)
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return false;
  }
  
  // Holiday check
  if (holidayCalendar === 'us_federal') {
    const year = getYear(tzDate);
    const holidays = getUSFederalHolidays(year, timezone);
    
    return !holidays.some(holiday => 
      getYear(holiday.date) === getYear(tzDate) &&
      getMonth(holiday.date) === getMonth(tzDate) &&
      getDate(holiday.date) === getDate(tzDate)
    );
  }
  
  return true;
}

export function addBusinessDays(date: Date, days: number, holidayCalendar: string = 'us_federal', timezone: string = 'America/New_York'): Date {
  let current = startOfDay(toZonedTime(date, timezone));
  let remaining = days;
  
  if (days === 0) return current;
  
  const direction = days > 0 ? 1 : -1;
  remaining = Math.abs(remaining);
  
  while (remaining > 0) {
    current = addDays(current, direction);
    if (isBusinessDay(current, holidayCalendar, timezone)) {
      remaining--;
    }
  }
  
  return current;
}

export function businessDaysBetween(start: Date, end: Date, holidayCalendar: string = 'us_federal', timezone: string = 'America/New_York'): number {
  const startDay = startOfDay(toZonedTime(start, timezone));
  const endDay = startOfDay(toZonedTime(end, timezone));
  
  if (isAfter(startDay, endDay)) {
    return -businessDaysBetween(endDay, startDay, holidayCalendar, timezone);
  }
  
  let count = 0;
  let current = startDay;
  
  while (isBefore(current, endDay)) {
    if (isBusinessDay(current, holidayCalendar, timezone)) {
      count++;
    }
    current = addDays(current, 1);
  }
  
  return count;
}

export function subtractBusinessDays(date: Date, days: number, holidayCalendar: string = 'us_federal', timezone: string = 'America/New_York'): Date {
  return addBusinessDays(date, -days, holidayCalendar, timezone);
}

export function isHoliday(date: Date, holidayCalendar: string = 'us_federal', timezone: string = 'America/New_York'): boolean {
  if (holidayCalendar === 'us_federal') {
    const tzDate = toZonedTime(date, timezone);
    const year = getYear(tzDate);
    const holidays = getUSFederalHolidays(year, timezone);
    
    return holidays.some(holiday => 
      getYear(holiday.date) === getYear(tzDate) &&
      getMonth(holiday.date) === getMonth(tzDate) &&
      getDate(holiday.date) === getDate(tzDate)
    );
  }
  
  return false;
}

export function getNextBusinessDay(date: Date, holidayCalendar: string = 'us_federal', timezone: string = 'America/New_York'): Date {
  let next = addDays(startOfDay(toZonedTime(date, timezone)), 1);
  
  while (!isBusinessDay(next, holidayCalendar, timezone)) {
    next = addDays(next, 1);
  }
  
  return next;
}

export function getPreviousBusinessDay(date: Date, holidayCalendar: string = 'us_federal', timezone: string = 'America/New_York'): Date {
  let previous = addDays(startOfDay(toZonedTime(date, timezone)), -1);
  
  while (!isBusinessDay(previous, holidayCalendar, timezone)) {
    previous = addDays(previous, -1);
  }
  
  return previous;
}
