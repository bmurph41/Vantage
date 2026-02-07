/**
 * periodDetect.ts — Detects period header rows from extracted PDF table rows.
 *
 * Scans the first N rows looking for the best candidate row containing
 * recognisable period columns (months, quarters, YTD, TTM, FY totals).
 * Uses the existing parseColumnHeaderToPeriod helper for pattern matching.
 */

import type { PdfRow, PdfCell } from './pdfTableExtractor';
import { parseColumnHeaderToPeriod, getYearPeriod } from './timeAlign';
import type { ParsedPeriod } from '@shared/schema';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PeriodCell {
  x: number;
  w: number;
  text: string;
  period: ParsedPeriod;
  periodIndex: number;
}

export interface HeaderDetectionResult {
  headerRowIndex: number;
  periodCells: PeriodCell[];
  periods: ParsedPeriod[];
  confidence: number;
}

// ─── Config ───────────────────────────────────────────────────────────────────

/** How many rows from the top to scan for a header */
const MAX_HEADER_SCAN_ROWS = 30;

// ─── Month patterns (fallback if parseColumnHeaderToPeriod doesn't match) ───

const MONTH_PATTERNS: Array<{ regex: RegExp; monthNo: number }> = [
  { regex: /\bjan(?:uary)?\b/i, monthNo: 1 },
  { regex: /\bfeb(?:ruary)?\b/i, monthNo: 2 },
  { regex: /\bmar(?:ch)?\b/i, monthNo: 3 },
  { regex: /\bapr(?:il)?\b/i, monthNo: 4 },
  { regex: /\bmay\b/i, monthNo: 5 },
  { regex: /\bjun(?:e)?\b/i, monthNo: 6 },
  { regex: /\bjul(?:y)?\b/i, monthNo: 7 },
  { regex: /\baug(?:ust)?\b/i, monthNo: 8 },
  { regex: /\bsep(?:t(?:ember)?)?\b/i, monthNo: 9 },
  { regex: /\boct(?:ober)?\b/i, monthNo: 10 },
  { regex: /\bnov(?:ember)?\b/i, monthNo: 11 },
  { regex: /\bdec(?:ember)?\b/i, monthNo: 12 },
];

const QUARTER_PATTERN = /\bq([1-4])\b/i;
const YEAR_PATTERN = /\b(20\d{2}|19\d{2})\b/;
const YTD_PATTERN = /\bytd\b/i;
const TTM_PATTERN = /\bt(?:tm|railing)\s*(?:12|twelve)?\b/i;
const FY_PATTERN = /\bfy\s*\d{2,4}\b/i;

// ─── Main detection ──────────────────────────────────────────────────────────

export function detectHeaderAndPeriods(
  rows: PdfRow[],
  yearHint?: number
): HeaderDetectionResult {
  const scanLimit = Math.min(rows.length, MAX_HEADER_SCAN_ROWS);

  let bestRowIdx = -1;
  let bestScore = 0;
  let bestCells: PeriodCell[] = [];
  let bestPeriods: ParsedPeriod[] = [];

  for (let i = 0; i < scanLimit; i++) {
    const row = rows[i];
    const { periodCells, periods, score } = scoreRowForPeriods(row, yearHint);

    if (score > bestScore) {
      bestScore = score;
      bestRowIdx = i;
      bestCells = periodCells;
      bestPeriods = periods;
    }
  }

  if (bestRowIdx < 0 || bestPeriods.length === 0) {
    return {
      headerRowIndex: -1,
      periodCells: [],
      periods: [],
      confidence: 0,
    };
  }

  // Confidence: number of detected periods, capped at 1.0
  let confidence = Math.min(1.0, 0.3 + bestPeriods.length * 0.12);

  // Bonus for monotonic ordering
  if (isMonotonic(bestPeriods)) {
    confidence = Math.min(1.0, confidence + 0.15);
  }

  return {
    headerRowIndex: bestRowIdx,
    periodCells: bestCells,
    periods: bestPeriods,
    confidence,
  };
}

// ─── Row scoring ──────────────────────────────────────────────────────────────

function scoreRowForPeriods(
  row: PdfRow,
  yearHint?: number
): { periodCells: PeriodCell[]; periods: ParsedPeriod[]; score: number } {
  const periodCells: PeriodCell[] = [];
  const periods: ParsedPeriod[] = [];
  let periodIndex = 0;

  for (const cell of row.cells) {
    const text = cell.text.trim();
    if (!text) continue;

    // Skip label-like cells (typically leftmost, long text with no period patterns)
    const period = tryParsePeriod(text, yearHint);
    if (period) {
      periodCells.push({
        x: cell.x,
        w: cell.w,
        text,
        period,
        periodIndex,
      });
      periods.push(period);
      periodIndex++;
    }
  }

  // Score = number of periods found, with bonus for consistency
  let score = periods.length;

  // Bonus for having >= 2 periods
  if (periods.length >= 2) score += 1;

  // Bonus for consistent year
  const years = periods.map(p => p.year).filter(Boolean);
  const uniqueYears = new Set(years);
  if (uniqueYears.size <= 2 && years.length > 0) score += 0.5;

  return { periodCells, periods, score };
}

// ─── Period parsing ───────────────────────────────────────────────────────────

function tryParsePeriod(text: string, yearHint?: number): ParsedPeriod | null {
  // 1) Try the existing helper first
  const existing = parseColumnHeaderToPeriod(text, yearHint);
  if (existing) return existing;

  // 2) Fallback patterns
  const t = text.trim();

  // YTD
  if (YTD_PATTERN.test(t)) {
    const yearMatch = t.match(YEAR_PATTERN);
    const year = yearMatch ? parseInt(yearMatch[1]) : yearHint ?? new Date().getFullYear();
    return {
      label: t,
      start: `${year}-01-01T00:00:00.000Z`,
      end: `${year}-12-31T23:59:59.999Z`,
      type: 'ytd',
      year,
      periodNo: 0,
    };
  }

  // TTM
  if (TTM_PATTERN.test(t)) {
    const yearMatch = t.match(YEAR_PATTERN);
    const year = yearMatch ? parseInt(yearMatch[1]) : yearHint ?? new Date().getFullYear();
    return {
      label: t,
      start: `${year - 1}-01-01T00:00:00.000Z`,
      end: `${year}-12-31T23:59:59.999Z`,
      type: 'ttm',
      year,
      periodNo: 0,
    };
  }

  // FY
  if (FY_PATTERN.test(t)) {
    const yearMatch = t.match(YEAR_PATTERN);
    const year = yearMatch ? parseInt(yearMatch[1]) : yearHint ?? new Date().getFullYear();
    const { start, end } = getYearPeriod(year);
    return {
      label: t,
      start: start.toISOString(),
      end: end.toISOString(),
      type: 'year',
      year,
      periodNo: 1,
    };
  }

  // Quarter
  const qMatch = t.match(QUARTER_PATTERN);
  if (qMatch) {
    const q = parseInt(qMatch[1]);
    const yearMatch = t.match(YEAR_PATTERN);
    const year = yearMatch ? parseInt(yearMatch[1]) : yearHint ?? new Date().getFullYear();
    const startMonth = (q - 1) * 3;
    const start = new Date(year, startMonth, 1);
    const end = new Date(year, startMonth + 3, 0, 23, 59, 59, 999);
    return {
      label: t,
      start: start.toISOString(),
      end: end.toISOString(),
      type: 'quarter',
      year,
      periodNo: q,
    };
  }

  // Month: "Jan-25", "Feb 2025", "01/2025", "2025-01", etc.
  for (const mp of MONTH_PATTERNS) {
    if (mp.regex.test(t)) {
      const yearMatch = t.match(YEAR_PATTERN);
      let year: number;
      if (yearMatch) {
        year = parseInt(yearMatch[1]);
      } else {
        // Try 2-digit year: "Jan-25" → 2025
        const shortYear = t.match(/[-/\s](\d{2})(?:\s|$)/);
        if (shortYear) {
          const yy = parseInt(shortYear[1]);
          year = yy >= 50 ? 1900 + yy : 2000 + yy;
        } else {
          year = yearHint ?? new Date().getFullYear();
        }
      }
      const start = new Date(year, mp.monthNo - 1, 1);
      const end = new Date(year, mp.monthNo, 0, 23, 59, 59, 999);
      return {
        label: t,
        start: start.toISOString(),
        end: end.toISOString(),
        type: 'month',
        year,
        periodNo: mp.monthNo,
      };
    }
  }

  // Numeric month: "01/2025" or "2025-01"
  const numericMonth = t.match(/^(\d{1,2})[/-](20\d{2})$/) || t.match(/^(20\d{2})[/-](\d{1,2})$/);
  if (numericMonth) {
    let month: number, year: number;
    if (numericMonth[1].length === 4) {
      year = parseInt(numericMonth[1]);
      month = parseInt(numericMonth[2]);
    } else {
      month = parseInt(numericMonth[1]);
      year = parseInt(numericMonth[2]);
    }
    if (month >= 1 && month <= 12) {
      const start = new Date(year, month - 1, 1);
      const end = new Date(year, month, 0, 23, 59, 59, 999);
      return {
        label: t,
        start: start.toISOString(),
        end: end.toISOString(),
        type: 'month',
        year,
        periodNo: month,
      };
    }
  }

  return null;
}

// ─── Monotonic check ──────────────────────────────────────────────────────────

function isMonotonic(periods: ParsedPeriod[]): boolean {
  if (periods.length < 2) return true;

  // Check if periodNo is monotonically increasing (allowing wraps at year boundary)
  const regular = periods.filter(p => p.type === 'month' || p.type === 'quarter');
  if (regular.length < 2) return true;

  for (let i = 1; i < regular.length; i++) {
    const prev = regular[i - 1];
    const curr = regular[i];
    if (curr.year < prev.year) return false;
    if (curr.year === prev.year && curr.periodNo <= prev.periodNo) return false;
  }
  return true;
}
