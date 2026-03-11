/**
 * excel-extractor.ts — Smart Excel / CSV P&L extraction for MarinaMatch Phase 2.
 *
 * Improvements over v1 inline block:
 *  1. Best-sheet selection  — scores all sheets by P&L likelihood.
 *  2. Header-row scanning   — scans first 30 rows for the row with most period matches.
 *  3. Year inference        — extracts year from sheet name, filename, or header cells.
 *  4. Label-column detect   — handles account-code col 0, label col 1 layouts.
 *  5. Robust subtotal skip  — isTotalRow() catches all total / separator rows.
 *  6. Vendor hint detection — QuickBooks, Sage, Xero, Wave, FreshBooks.
 */

import * as XLSX from 'xlsx';
import { parseColumnHeaderToPeriod, getYearPeriod } from './timeAlign';
import type { ParsedPeriod } from '../../../shared/pnl-pipeline-schema';

export interface ExcelParsedValue {
  periodIndex: number;
  value: number | null;
  trace: { page: number; row: number; col: number; raw: string };
}

export interface ExcelParsedRow {
  label: string;
  normalizedLabel: string;
  values: ExcelParsedValue[];
  sectionHint: 'revenue' | 'cogs' | 'expense' | 'payroll' | null;
  trace: { page: number; row: number };
}

export interface ExcelExtractResult {
  periods: ParsedPeriod[];
  rows: ExcelParsedRow[];
  vendorHint: string | null;
  confidence: number;
  sheetUsed: string;
  headerRowIndex: number;
  labelColIndex: number;
  yearInferred: number | null;
}

// ─── Sheet scoring ────────────────────────────────────────────────────────────

const PNL_SHEET_KEYWORDS = [
  'p&l','pnl','profit','loss','income','income statement',
  'revenue','combined','summary','operating','financial','financials',
  'statement','t12','trailing','annual','monthly',
];
const SKIP_SHEET_KEYWORDS = [
  'balance sheet','balance','cash flow','cashflow','equity',
  'depreciation','amortization','capex','budget vs','vs budget',
  'chart of accounts','instructions','cover','contents','index',
  'assumptions','debt','loan','waterfall',
];

function scoreSheet(name: string): number {
  const lower = name.toLowerCase();
  if (SKIP_SHEET_KEYWORDS.some(k => lower.includes(k))) return -100;
  let score = 0;
  for (const kw of PNL_SHEET_KEYWORDS) {
    if (lower === kw) { score += 20; break; }
    if (lower.includes(kw)) { score += 10; break; }
  }
  if (lower.length <= 2) score -= 5;
  return score;
}

function selectBestSheet(workbook: XLSX.WorkBook): string {
  const scored = workbook.SheetNames.map(n => ({ n, s: scoreSheet(n) }));
  scored.sort((a, b) => b.s - a.s);
  return scored[0].s > 0 ? scored[0].n : workbook.SheetNames[0];
}

// ─── Year inference ───────────────────────────────────────────────────────────

function inferYearFromText(text: string): number | null {
  const m4 = text.match(/\b(20\d{2}|19\d{2})\b/);
  if (m4) { const y = parseInt(m4[1], 10); if (y >= 2000 && y <= 2099) return y; }
  const m2 = text.match(/\b(?:fy|cy)?['\'']?(\d{2})\b/i);
  if (m2) { const y = parseInt(m2[1], 10); return y > 50 ? 1900 + y : 2000 + y; }
  return null;
}

// ─── Money parsing ────────────────────────────────────────────────────────────

function parseMoney(v: any): number | null {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return isNaN(v) ? null : v;
  if (typeof v === 'string') {
    const cleaned = v.replace(/[$,\s()]/g, '').replace(/^\((.+)\)$/, '-$1');
    const n = parseFloat(cleaned);
    return isNaN(n) ? null : n;
  }
  return null;
}

function normalizeLabel(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
}

// ─── Total / section detection ────────────────────────────────────────────────

const TOTAL_PREFIXES = [
  'total ','subtotal ','net ','gross profit','gross margin',
  'operating income','ebitda','noi','net income','net loss',
];
function isTotalRow(label: string): boolean {
  const lower = normalizeLabel(label);
  return TOTAL_PREFIXES.some(p => lower.startsWith(p)) ||
    lower === 'total' ||
    /^={2,}$/.test(label) ||
    /^-{2,}$/.test(label);
}

const SECTION_KEYWORDS: Record<string, ExcelParsedRow['sectionHint']> = {
  'revenue':'revenue','revenues':'revenue','income':'revenue','sales':'revenue',
  'cost of goods sold':'cogs','cost of goods':'cogs','cogs':'cogs',
  'cost of sales':'cogs','direct costs':'cogs','direct cost':'cogs',
  'operating expense':'expense','operating expenses':'expense','expenses':'expense',
  'overhead':'expense','general':'expense','general administrative':'expense','ga':'expense',
  'payroll':'payroll','wages':'payroll','salaries':'payroll',
  'payroll expense':'payroll','payroll expenses':'payroll','labor':'payroll','labour':'payroll',
};

// ─── Header row scanning ──────────────────────────────────────────────────────

interface HeaderScanResult {
  rowIndex: number;
  periods: ParsedPeriod[];
  periodColIndices: number[];
  yearHint: number | null;
}

function scanForHeaderRow(jsonData: any[][], explicitYear?: number | null): HeaderScanResult {
  let bestRow = -1, bestCount = 0;
  let bestPeriods: ParsedPeriod[] = [];
  let bestCols: number[] = [];
  let inferredYear: number | null = null;
  const limit = Math.min(30, jsonData.length);

  for (let r = 0; r < limit; r++) {
    const row = jsonData[r];
    if (!row) continue;
    const rowPeriods: ParsedPeriod[] = [];
    const rowCols: number[] = [];
    let rowYear: number | null = null;
    for (let c = 0; c < row.length; c++) {
      const cell = String(row[c] ?? '').trim();
      if (!cell) continue;
      if (!rowYear && !explicitYear) rowYear = inferYearFromText(cell);
      const period = parseColumnHeaderToPeriod(cell, explicitYear ?? rowYear ?? undefined);
      if (period) { rowPeriods.push(period); rowCols.push(c); }
    }
    if (rowPeriods.length > bestCount) {
      bestCount = rowPeriods.length;
      bestRow = r;
      bestPeriods = rowPeriods;
      bestCols = rowCols;
      if (rowYear) inferredYear = rowYear;
    }
  }
  return {
    rowIndex: bestRow >= 0 ? bestRow : 0,
    periods: bestPeriods,
    periodColIndices: bestCols,
    yearHint: explicitYear ?? inferredYear,
  };
}

// ─── Label column detection ───────────────────────────────────────────────────

function detectLabelColumn(jsonData: any[][], headerRowIndex: number): number {
  const colTextCounts: number[] = [];
  const limit = Math.min(headerRowIndex + 30, jsonData.length);
  for (let r = headerRowIndex + 1; r < limit; r++) {
    const row = jsonData[r];
    if (!row) continue;
    for (let c = 0; c < Math.min(5, row.length); c++) {
      const v = row[c];
      if (typeof v === 'string' && v.trim() && parseMoney(v) === null) {
        colTextCounts[c] = (colTextCounts[c] ?? 0) + 1;
      }
    }
  }
  let best = 0, bestCount = 0;
  for (let c = 0; c < colTextCounts.length; c++) {
    if ((colTextCounts[c] ?? 0) > bestCount) { bestCount = colTextCounts[c] ?? 0; best = c; }
  }
  return best;
}

// ─── Main extraction ──────────────────────────────────────────────────────────

const VENDOR_PATTERNS: { pattern: RegExp; hint: string }[] = [
  { pattern: /quickbook/i, hint: 'quickbooks' },
  { pattern: /sage/i, hint: 'sage' },
  { pattern: /xero/i, hint: 'xero' },
  { pattern: /wave/i, hint: 'wave' },
  { pattern: /freshbook/i, hint: 'freshbooks' },
];

export function extractExcelPnl(
  fileBuffer: Buffer,
  explicitYearHint?: number | null,
  filename?: string,
): ExcelExtractResult {
  const workbook = XLSX.read(fileBuffer, { type: 'buffer', cellDates: false });

  // Vendor hint
  let vendorHint: string | null = null;
  for (const sn of workbook.SheetNames) {
    for (const vp of VENDOR_PATTERNS) {
      if (vp.pattern.test(sn)) { vendorHint = vp.hint; break; }
    }
    if (vendorHint) break;
  }
  if (!vendorHint && filename) {
    for (const vp of VENDOR_PATTERNS) { if (vp.pattern.test(filename)) { vendorHint = vp.hint; break; } }
  }

  // Sheet selection
  const sheetName = selectBestSheet(workbook);
  const sheet = workbook.Sheets[sheetName];
  const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null }) as any[][];

  if (jsonData.length < 2) {
    return { periods: [], rows: [], vendorHint, confidence: 0.1, sheetUsed: sheetName, headerRowIndex: 0, labelColIndex: 0, yearInferred: null };
  }

  // Year from metadata
  let yearFromMeta: number | null = explicitYearHint ?? null;
  if (!yearFromMeta) yearFromMeta = inferYearFromText(sheetName);
  if (!yearFromMeta && filename) yearFromMeta = inferYearFromText(filename);

  // Header row scan
  const header = scanForHeaderRow(jsonData, yearFromMeta);
  let { periods, periodColIndices, rowIndex: headerRowIndex, yearHint } = header;

  // Fallback to annual period
  if (periods.length === 0 && yearHint) {
    const { start, end } = getYearPeriod(yearHint);
    periods = [{ label: `FY ${yearHint}`, start: start.toISOString(), end: end.toISOString(), type: 'year', year: yearHint, periodNo: 1 }];
    const lc = detectLabelColumn(jsonData, headerRowIndex);
    periodColIndices = [lc + 1];
  }

  const labelColIndex = detectLabelColumn(jsonData, headerRowIndex);

  // Extend periodColIndices if needed
  while (periodColIndices.length < periods.length) {
    periodColIndices.push(periodColIndices[periodColIndices.length - 1] + 1);
  }

  // Row extraction
  const rows: ExcelParsedRow[] = [];
  let currentSection: ExcelParsedRow['sectionHint'] = null;
  const sheetPageNum = workbook.SheetNames.indexOf(sheetName) + 1;

  for (let r = headerRowIndex + 1; r < jsonData.length; r++) {
    const rowData = jsonData[r];
    if (!rowData) continue;
    const rawLabel = String(rowData[labelColIndex] ?? '').trim();
    if (!rawLabel) continue;
    const lower = normalizeLabel(rawLabel);

    if (isTotalRow(rawLabel)) continue;

    // Section header detection (no numeric data in row)
    const hasNumbers = rowData.slice(1).some((v: any) => parseMoney(v) !== null);
    if (!hasNumbers) {
      for (const [kw, section] of Object.entries(SECTION_KEYWORDS)) {
        if (lower === kw || lower.startsWith(kw + ' ') || lower.endsWith(' ' + kw)) {
          currentSection = section;
          break;
        }
      }
      continue;
    }

    // Build values
    const values: ExcelParsedValue[] = [];
    for (let pi = 0; pi < periods.length; pi++) {
      const colIndex = periodColIndices[pi];
      const rawValue = colIndex !== undefined && colIndex < rowData.length ? rowData[colIndex] : null;
      values.push({
        periodIndex: pi,
        value: parseMoney(rawValue),
        trace: { page: sheetPageNum, row: r + 1, col: (colIndex ?? 0) + 1, raw: String(rawValue ?? '') },
      });
    }

    if (!values.some(v => v.value !== null)) continue;

    rows.push({
      label: rawLabel,
      normalizedLabel: lower,
      values,
      sectionHint: currentSection,
      trace: { page: sheetPageNum, row: r + 1 },
    });
  }

  const confidence = rows.length >= 5
    ? (periods.length >= 3 ? 0.90 : 0.75)
    : rows.length > 0 ? 0.5 : 0.2;

  return { periods, rows, vendorHint, confidence, sheetUsed: sheetName, headerRowIndex, labelColIndex, yearInferred: yearHint };
}
