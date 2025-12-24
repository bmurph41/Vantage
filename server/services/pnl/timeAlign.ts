import type { ParsedPeriod, PnlPeriodType } from '@shared/pnl-pipeline-schema';

export interface PeriodFactKeys {
  periodStart: Date;
  periodEnd: Date;
  periodType: PnlPeriodType;
  fiscalYear: number;
  fiscalPeriod: number;
}

export function periodToFactKeys(p: ParsedPeriod): PeriodFactKeys {
  const start = new Date(p.start);
  const end = new Date(p.end);
  
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new Error(`Invalid period dates: ${JSON.stringify(p)}`);
  }

  return {
    periodStart: start,
    periodEnd: end,
    periodType: p.type,
    fiscalYear: p.year,
    fiscalPeriod: p.periodNo,
  };
}

export function detectPeriodType(start: Date, end: Date): PnlPeriodType {
  const diffMs = end.getTime() - start.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  
  if (diffDays <= 35) return 'month';
  if (diffDays <= 100) return 'quarter';
  return 'year';
}

export function getMonthPeriod(year: number, month: number): { start: Date; end: Date } {
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
  return { start, end };
}

export function getQuarterPeriod(year: number, quarter: number): { start: Date; end: Date } {
  const startMonth = (quarter - 1) * 3;
  const start = new Date(Date.UTC(year, startMonth, 1));
  const end = new Date(Date.UTC(year, startMonth + 3, 0, 23, 59, 59, 999));
  return { start, end };
}

export function getYearPeriod(year: number): { start: Date; end: Date } {
  const start = new Date(Date.UTC(year, 0, 1));
  const end = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));
  return { start, end };
}

const MONTH_PATTERNS = [
  /^(jan(?:uary)?)\s*['']?(\d{2,4})$/i,
  /^(feb(?:ruary)?)\s*['']?(\d{2,4})$/i,
  /^(mar(?:ch)?)\s*['']?(\d{2,4})$/i,
  /^(apr(?:il)?)\s*['']?(\d{2,4})$/i,
  /^(may)\s*['']?(\d{2,4})$/i,
  /^(jun(?:e)?)\s*['']?(\d{2,4})$/i,
  /^(jul(?:y)?)\s*['']?(\d{2,4})$/i,
  /^(aug(?:ust)?)\s*['']?(\d{2,4})$/i,
  /^(sep(?:t(?:ember)?)?)\s*['']?(\d{2,4})$/i,
  /^(oct(?:ober)?)\s*['']?(\d{2,4})$/i,
  /^(nov(?:ember)?)\s*['']?(\d{2,4})$/i,
  /^(dec(?:ember)?)\s*['']?(\d{2,4})$/i,
];

const MONTH_NAMES: Record<string, number> = {
  'jan': 1, 'january': 1,
  'feb': 2, 'february': 2,
  'mar': 3, 'march': 3,
  'apr': 4, 'april': 4,
  'may': 5,
  'jun': 6, 'june': 6,
  'jul': 7, 'july': 7,
  'aug': 8, 'august': 8,
  'sep': 9, 'sept': 9, 'september': 9,
  'oct': 10, 'october': 10,
  'nov': 11, 'november': 11,
  'dec': 12, 'december': 12,
};

export function parseColumnHeaderToPeriod(header: string, yearHint?: number): ParsedPeriod | null {
  const normalized = header.trim().toLowerCase();
  
  for (const pattern of MONTH_PATTERNS) {
    const match = normalized.match(pattern);
    if (match) {
      const monthName = match[1].toLowerCase();
      let yearStr = match[2];
      
      let year = parseInt(yearStr, 10);
      if (yearStr.length === 2) {
        year = year > 50 ? 1900 + year : 2000 + year;
      }
      
      const month = MONTH_NAMES[monthName.slice(0, 3)];
      if (!month) continue;
      
      const { start, end } = getMonthPeriod(year, month);
      
      return {
        label: header,
        start: start.toISOString(),
        end: end.toISOString(),
        type: 'month',
        year,
        periodNo: month,
      };
    }
  }
  
  const quarterMatch = normalized.match(/^q(\d)\s*['']?(\d{2,4})$/i);
  if (quarterMatch) {
    const quarter = parseInt(quarterMatch[1], 10);
    let year = parseInt(quarterMatch[2], 10);
    if (quarterMatch[2].length === 2) {
      year = year > 50 ? 1900 + year : 2000 + year;
    }
    
    const { start, end } = getQuarterPeriod(year, quarter);
    
    return {
      label: header,
      start: start.toISOString(),
      end: end.toISOString(),
      type: 'quarter',
      year,
      periodNo: quarter,
    };
  }
  
  const yearMatch = normalized.match(/^(?:fy\s*)?['']?(\d{4})$/i);
  if (yearMatch) {
    const year = parseInt(yearMatch[1], 10);
    const { start, end } = getYearPeriod(year);
    
    return {
      label: header,
      start: start.toISOString(),
      end: end.toISOString(),
      type: 'year',
      year,
      periodNo: 1,
    };
  }
  
  return null;
}
