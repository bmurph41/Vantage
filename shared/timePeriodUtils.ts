export type TimePeriodFilter = "TTM" | "YTD" | "Q1" | "Q2" | "Q3" | "Q4" | "monthly" | string;

export interface DateRangeResult {
  startDate: string;
  endDate: string;
  label: string;
}

export function calculateDateRange(filter: TimePeriodFilter): DateRangeResult {
  const now = new Date();
  const currentYear = now.getFullYear();
  const today = now.toISOString().split('T')[0];

  const formatDate = (date: Date): string => {
    return date.toISOString().split('T')[0];
  };

  switch (filter) {
    case "TTM": {
      const startDate = new Date(now);
      startDate.setFullYear(startDate.getFullYear() - 1);
      return {
        startDate: formatDate(startDate),
        endDate: today,
        label: "Trailing 12 Months"
      };
    }
    case "YTD": {
      return {
        startDate: `${currentYear}-01-01`,
        endDate: today,
        label: `Year to Date (${currentYear})`
      };
    }
    case "Q1": {
      return {
        startDate: `${currentYear}-01-01`,
        endDate: `${currentYear}-03-31`,
        label: `Q1 ${currentYear}`
      };
    }
    case "Q2": {
      return {
        startDate: `${currentYear}-04-01`,
        endDate: `${currentYear}-06-30`,
        label: `Q2 ${currentYear}`
      };
    }
    case "Q3": {
      return {
        startDate: `${currentYear}-07-01`,
        endDate: `${currentYear}-09-30`,
        label: `Q3 ${currentYear}`
      };
    }
    case "Q4": {
      return {
        startDate: `${currentYear}-10-01`,
        endDate: `${currentYear}-12-31`,
        label: `Q4 ${currentYear}`
      };
    }
    case "monthly": {
      const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      const monthName = startDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      return {
        startDate: formatDate(startDate),
        endDate: formatDate(endDate),
        label: monthName
      };
    }
    default: {
      if (filter.match(/^\d{4}-\d{2}$/)) {
        const [year, month] = filter.split('-').map(Number);
        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0);
        const monthName = startDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        return {
          startDate: formatDate(startDate),
          endDate: formatDate(endDate),
          label: monthName
        };
      }
      return {
        startDate: `${currentYear}-01-01`,
        endDate: today,
        label: `Year to Date (${currentYear})`
      };
    }
  }
}

export function getTimePeriodOptions(): { value: TimePeriodFilter; label: string }[] {
  const currentYear = new Date().getFullYear();
  return [
    { value: "TTM", label: "Trailing 12 Months" },
    { value: "YTD", label: `Year to Date (${currentYear})` },
    { value: "Q1", label: `Q1 ${currentYear}` },
    { value: "Q2", label: `Q2 ${currentYear}` },
    { value: "Q3", label: `Q3 ${currentYear}` },
    { value: "Q4", label: `Q4 ${currentYear}` },
    { value: "monthly", label: "Current Month" },
  ];
}
