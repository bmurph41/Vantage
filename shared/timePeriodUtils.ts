import { z } from "zod";
import { startOfMonth, endOfMonth, startOfYear, endOfYear, startOfQuarter, endOfQuarter, subMonths, format } from "date-fns";

export const timePeriodTypeEnum = z.enum(["TTM", "Year", "Month", "Quarter", "Summer", "Winter"]);
export type TimePeriodType = z.infer<typeof timePeriodTypeEnum>;

export const timePeriodFilterSchema = z.object({
  type: timePeriodTypeEnum,
  year: z.number().int().min(2000).max(2100).optional(),
  month: z.number().int().min(1).max(12).optional(),
  quarter: z.number().int().min(1).max(4).optional(),
});

export const SUMMER_SEASON = { startMonth: 4, endMonth: 10 }; // April 1 - October 31
export const WINTER_SEASON = { startMonth: 11, endMonth: 3 }; // November 1 - March 31 (spans years)

export type TimePeriodFilter = z.infer<typeof timePeriodFilterSchema>;

export interface DateRange {
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  label: string;
}

export function calculateDateRange(filter: TimePeriodFilter, referenceDate: Date = new Date()): DateRange {
  let start: Date;
  let end: Date;
  let label: string;

  switch (filter.type) {
    case "TTM": {
      end = endOfMonth(referenceDate);
      start = startOfMonth(subMonths(referenceDate, 11));
      label = `Trailing 12 Months (${format(start, "MMM yyyy")} - ${format(end, "MMM yyyy")})`;
      break;
    }

    case "Year": {
      if (!filter.year) {
        throw new Error("Year is required for Year period type");
      }
      const yearDate = new Date(filter.year, 0, 1);
      start = startOfYear(yearDate);
      end = endOfYear(yearDate);
      label = `Year ${filter.year}`;
      break;
    }

    case "Month": {
      if (!filter.year || !filter.month) {
        throw new Error("Year and month are required for Month period type");
      }
      const monthDate = new Date(filter.year, filter.month - 1, 1);
      start = startOfMonth(monthDate);
      end = endOfMonth(monthDate);
      label = format(monthDate, "MMMM yyyy");
      break;
    }

    case "Quarter": {
      if (!filter.year || !filter.quarter) {
        throw new Error("Year and quarter are required for Quarter period type");
      }
      const quarterStartMonth = (filter.quarter - 1) * 3;
      const quarterDate = new Date(filter.year, quarterStartMonth, 1);
      start = startOfQuarter(quarterDate);
      end = endOfQuarter(quarterDate);
      label = `Q${filter.quarter} ${filter.year}`;
      break;
    }

    case "Summer": {
      if (!filter.year) {
        throw new Error("Year is required for Summer season type");
      }
      start = new Date(filter.year, SUMMER_SEASON.startMonth - 1, 1);
      end = endOfMonth(new Date(filter.year, SUMMER_SEASON.endMonth - 1, 1));
      label = `Summer ${filter.year} (Apr-Oct)`;
      break;
    }

    case "Winter": {
      if (!filter.year) {
        throw new Error("Year is required for Winter season type");
      }
      start = new Date(filter.year - 1, WINTER_SEASON.startMonth - 1, 1);
      end = endOfMonth(new Date(filter.year, WINTER_SEASON.endMonth - 1, 1));
      label = `Winter ${filter.year - 1}/${filter.year} (Nov-Mar)`;
      break;
    }

    default:
      throw new Error(`Unknown period type: ${filter.type}`);
  }

  return {
    startDate: format(start, "yyyy-MM-dd"),
    endDate: format(end, "yyyy-MM-dd"),
    label,
  };
}

export function getAvailableYears(): number[] {
  const currentYear = new Date().getFullYear();
  const startYear = 2020;
  const years: number[] = [];
  for (let year = currentYear; year >= startYear; year--) {
    years.push(year);
  }
  return years;
}

export function getAvailableMonths(): Array<{ value: number; label: string }> {
  return [
    { value: 1, label: "January" },
    { value: 2, label: "February" },
    { value: 3, label: "March" },
    { value: 4, label: "April" },
    { value: 5, label: "May" },
    { value: 6, label: "June" },
    { value: 7, label: "July" },
    { value: 8, label: "August" },
    { value: 9, label: "September" },
    { value: 10, label: "October" },
    { value: 11, label: "November" },
    { value: 12, label: "December" },
  ];
}

export function getAvailableQuarters(): Array<{ value: number; label: string }> {
  return [
    { value: 1, label: "Q1 (Jan-Mar)" },
    { value: 2, label: "Q2 (Apr-Jun)" },
    { value: 3, label: "Q3 (Jul-Sep)" },
    { value: 4, label: "Q4 (Oct-Dec)" },
  ];
}

export function detectSeasonFromMonth(month: number): "summer" | "winter" | null {
  if (month >= SUMMER_SEASON.startMonth && month <= SUMMER_SEASON.endMonth) {
    return "summer";
  }
  if (month >= WINTER_SEASON.startMonth || month <= WINTER_SEASON.endMonth) {
    return "winter";
  }
  return null;
}

export function isSeasonalPeriod(filter: TimePeriodFilter): boolean {
  return filter.type === "Month" || filter.type === "Quarter" || filter.type === "Summer" || filter.type === "Winter";
}

export function getTimePeriodOptions(): Array<{ value: string; label: string }> {
  const currentYear = new Date().getFullYear();
  return [
    { value: "TTM", label: "Trailing 12 Months" },
    { value: "YTD", label: "Year to Date" },
    { value: `Year-${currentYear}`, label: `${currentYear}` },
    { value: `Year-${currentYear - 1}`, label: `${currentYear - 1}` },
    { value: `Year-${currentYear - 2}`, label: `${currentYear - 2}` },
    { value: "Q1", label: "Q1" },
    { value: "Q2", label: "Q2" },
    { value: "Q3", label: "Q3" },
    { value: "Q4", label: "Q4" },
  ];
}
