import { formatInTimeZone } from 'date-fns-tz';
import { format, addDays } from 'date-fns';

// EST timezone with 5pm cutoff for business day
const EST_TIMEZONE = 'America/New_York';
const BUSINESS_DAY_CUTOFF_HOUR = 17; // 5pm

export const getBusinessDay = (date: Date): string => {
  // Get the hour in EST timezone explicitly
  const estHour = parseInt(formatInTimeZone(date, EST_TIMEZONE, 'H'), 10);
  
  // Get the date in EST timezone as yyyy-MM-dd
  let estDateStr = formatInTimeZone(date, EST_TIMEZONE, 'yyyy-MM-dd');
  
  // If after 5pm EST, advance to next day
  if (estHour >= BUSINESS_DAY_CUTOFF_HOUR) {
    const [year, month, day] = estDateStr.split('-').map(Number);
    const dateObj = new Date(year, month - 1, day);
    const nextDay = addDays(dateObj, 1);
    estDateStr = format(nextDay, 'yyyy-MM-dd');
  }
  
  return estDateStr;
};

export const formatBusinessDay = (businessDay: string): string => {
  // Format yyyy-MM-dd in EST timezone for consistent display across all users
  // Use UTC noon to avoid timezone edge cases when parsing the date string
  const date = new Date(`${businessDay}T12:00:00Z`);
  return formatInTimeZone(date, EST_TIMEZONE, 'MMM dd, yyyy');
};
