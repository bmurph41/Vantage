export function daysBetween(startDate: string | Date, endDate: string | Date): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffMs = end.getTime() - start.getTime();
  return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
}

export function overlapDays(
  rangeAStart: string | Date,
  rangeAEnd: string | Date,
  rangeBStart: string | Date,
  rangeBEnd: string | Date
): number {
  const aStart = new Date(rangeAStart).getTime();
  const aEnd = new Date(rangeAEnd).getTime();
  const bStart = new Date(rangeBStart).getTime();
  const bEnd = new Date(rangeBEnd).getTime();

  const overlapStart = Math.max(aStart, bStart);
  const overlapEnd = Math.min(aEnd, bEnd);

  if (overlapStart >= overlapEnd) return 0;
  return Math.ceil((overlapEnd - overlapStart) / (1000 * 60 * 60 * 24));
}

export function dateRangeIntersection(
  rangeAStart: string | Date,
  rangeAEnd: string | Date,
  rangeBStart: string | Date,
  rangeBEnd: string | Date
): { start: Date; end: Date } | null {
  const aStart = new Date(rangeAStart).getTime();
  const aEnd = new Date(rangeAEnd).getTime();
  const bStart = new Date(rangeBStart).getTime();
  const bEnd = new Date(rangeBEnd).getTime();

  const overlapStart = Math.max(aStart, bStart);
  const overlapEnd = Math.min(aEnd, bEnd);

  if (overlapStart >= overlapEnd) return null;
  return { start: new Date(overlapStart), end: new Date(overlapEnd) };
}

export function isDateInRange(
  date: string | Date,
  rangeStart: string | Date,
  rangeEnd: string | Date
): boolean {
  const d = new Date(date).getTime();
  const start = new Date(rangeStart).getTime();
  const end = new Date(rangeEnd).getTime();
  return d >= start && d <= end;
}

export function periodContainsDate(
  periodStart: string | Date,
  periodEnd: string | Date,
  targetDate: string | Date
): boolean {
  return isDateInRange(targetDate, periodStart, periodEnd);
}

export function occupiedDaysInPeriod(
  occupancyStart: string | Date,
  occupancyEnd: string | Date | null,
  periodStart: string | Date,
  periodEnd: string | Date
): number {
  const effEnd = occupancyEnd ? new Date(occupancyEnd) : new Date(periodEnd);
  return overlapDays(occupancyStart, effEnd, periodStart, periodEnd);
}

export function fractionOfPeriod(
  occupancyStart: string | Date,
  occupancyEnd: string | Date | null,
  periodStart: string | Date,
  periodEnd: string | Date
): number {
  const totalDays = daysBetween(periodStart, periodEnd);
  if (totalDays <= 0) return 0;
  const occupied = occupiedDaysInPeriod(occupancyStart, occupancyEnd, periodStart, periodEnd);
  return occupied / totalDays;
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function startOfMonth(date: Date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
}

export function endOfMonth(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const lastDay = new Date(year, month, 0).getDate();
  return `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
}

export function monthRange(date: Date = new Date()): { start: string; end: string } {
  return { start: startOfMonth(date), end: endOfMonth(date) };
}
