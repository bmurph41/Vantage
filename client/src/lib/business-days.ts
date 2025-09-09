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

export interface Holiday {
  name: string;
  date: Date;
}

// US Federal Holidays for a given year
export function getUSFederalHolidays(year: number): Holiday[] {
  const holidays: Holiday[] = [
    { name: "New Year's Day", date: new Date(year, 0, 1) },
    { name: "Independence Day", date: new Date(year, 6, 4) },
    { name: "Veterans Day", date: new Date(year, 10, 11) },
    { name: "Christmas Day", date: new Date(year, 11, 25) },
  ];

  // Martin Luther King Jr. Day - Third Monday in January
  const mlkDay = getNthWeekdayOfMonth(year, 0, 1, 3); // January, Monday, 3rd
  holidays.push({ name: "Martin Luther King Jr. Day", date: mlkDay });

  // Presidents' Day - Third Monday in February
  const presidentsDay = getNthWeekdayOfMonth(year, 1, 1, 3); // February, Monday, 3rd
  holidays.push({ name: "Presidents' Day", date: presidentsDay });

  // Memorial Day - Last Monday in May
  const memorialDay = getLastWeekdayOfMonth(year, 4, 1); // May, Monday
  holidays.push({ name: "Memorial Day", date: memorialDay });

  // Labor Day - First Monday in September
  const laborDay = getNthWeekdayOfMonth(year, 8, 1, 1); // September, Monday, 1st
  holidays.push({ name: "Labor Day", date: laborDay });

  // Columbus Day - Second Monday in October
  const columbusDay = getNthWeekdayOfMonth(year, 9, 1, 2); // October, Monday, 2nd
  holidays.push({ name: "Columbus Day", date: columbusDay });

  // Thanksgiving - Fourth Thursday in November
  const thanksgiving = getNthWeekdayOfMonth(year, 10, 4, 4); // November, Thursday, 4th
  holidays.push({ name: "Thanksgiving Day", date: thanksgiving });

  return holidays;
}

function getNthWeekdayOfMonth(year: number, month: number, weekday: number, n: number): Date {
  const firstDay = new Date(year, month, 1);
  const firstWeekday = getDay(firstDay);
  const offset = (weekday - firstWeekday + 7) % 7;
  const targetDate = 1 + offset + (n - 1) * 7;
  return new Date(year, month, targetDate);
}

function getLastWeekdayOfMonth(year: number, month: number, weekday: number): Date {
  const lastDay = new Date(year, month + 1, 0);
  const lastWeekday = getDay(lastDay);
  const offset = (lastWeekday - weekday + 7) % 7;
  const targetDate = lastDay.getDate() - offset;
  return new Date(year, month, targetDate);
}

export function isBusinessDay(date: Date, holidayCalendar: string = 'us_federal'): boolean {
  const dayOfWeek = getDay(date);
  
  // Weekend check (Sunday = 0, Saturday = 6)
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return false;
  }
  
  // Holiday check
  if (holidayCalendar === 'us_federal') {
    const year = getYear(date);
    const holidays = getUSFederalHolidays(year);
    
    return !holidays.some(holiday => 
      getYear(holiday.date) === getYear(date) &&
      getMonth(holiday.date) === getMonth(date) &&
      getDate(holiday.date) === getDate(date)
    );
  }
  
  return true;
}

export function addBusinessDays(date: Date, days: number, holidayCalendar: string = 'us_federal'): Date {
  let current = startOfDay(date);
  let remaining = days;
  
  if (days === 0) return current;
  
  const direction = days > 0 ? 1 : -1;
  remaining = Math.abs(remaining);
  
  while (remaining > 0) {
    current = addDays(current, direction);
    if (isBusinessDay(current, holidayCalendar)) {
      remaining--;
    }
  }
  
  return current;
}

export function businessDaysBetween(start: Date, end: Date, holidayCalendar: string = 'us_federal'): number {
  const startDay = startOfDay(start);
  const endDay = startOfDay(end);
  
  if (isAfter(startDay, endDay)) {
    return -businessDaysBetween(endDay, startDay, holidayCalendar);
  }
  
  let count = 0;
  let current = startDay;
  
  while (isBefore(current, endDay)) {
    if (isBusinessDay(current, holidayCalendar)) {
      count++;
    }
    current = addDays(current, 1);
  }
  
  return count;
}

export function subtractBusinessDays(date: Date, days: number, holidayCalendar: string = 'us_federal'): Date {
  return addBusinessDays(date, -days, holidayCalendar);
}

export function isHoliday(date: Date, holidayCalendar: string = 'us_federal'): boolean {
  if (holidayCalendar === 'us_federal') {
    const year = getYear(date);
    const holidays = getUSFederalHolidays(year);
    
    return holidays.some(holiday => 
      getYear(holiday.date) === getYear(date) &&
      getMonth(holiday.date) === getMonth(date) &&
      getDate(holiday.date) === getDate(date)
    );
  }
  
  return false;
}

export function getNextBusinessDay(date: Date, holidayCalendar: string = 'us_federal'): Date {
  let next = addDays(startOfDay(date), 1);
  
  while (!isBusinessDay(next, holidayCalendar)) {
    next = addDays(next, 1);
  }
  
  return next;
}

export function getPreviousBusinessDay(date: Date, holidayCalendar: string = 'us_federal'): Date {
  let previous = addDays(startOfDay(date), -1);
  
  while (!isBusinessDay(previous, holidayCalendar)) {
    previous = addDays(previous, -1);
  }
  
  return previous;
}
