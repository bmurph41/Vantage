import { toZonedTime, zonedTimeToUtc, format as formatTz } from 'date-fns-tz';
import { format } from 'date-fns';

// EST timezone with 5pm cutoff for business day
const EST_TIMEZONE = 'America/New_York';
const BUSINESS_DAY_CUTOFF_HOUR = 17; // 5pm

export const getBusinessDay = (date: Date): string => {
  const estDate = toZonedTime(date, EST_TIMEZONE);
  const hour = estDate.getHours();
  
  // If before 5pm, use current date; if after 5pm, use next day
  if (hour < BUSINESS_DAY_CUTOFF_HOUR) {
    return format(estDate, 'yyyy-MM-dd');
  } else {
    const nextDay = new Date(estDate);
    nextDay.setDate(nextDay.getDate() + 1);
    return format(nextDay, 'yyyy-MM-dd');
  }
};

export const formatBusinessDay = (businessDay: string): string => {
  // Parse yyyy-MM-dd as EST midnight using zonedTimeToUtc to anchor in EST
  // This ensures all users see the same calendar date regardless of their browser timezone
  const estMidnight = zonedTimeToUtc(`${businessDay}T00:00:00`, EST_TIMEZONE);
  return formatTz(estMidnight, 'MMM dd, yyyy', { timeZone: EST_TIMEZONE });
};
