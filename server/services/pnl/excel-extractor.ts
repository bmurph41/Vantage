/**
 * excel-extractor.ts — Smart Excel / CSV P&L extraction for Vantage Phase 2.
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


// ─── Multi-entity detection ───────────────────────────────────────────────────
// Detects files where row 0 has entity/business names as column headers
// rather than time-period labels (e.g. combined P&Ls with 3 entities + totals).

interface EntityHeader {
  colIndex: number;
  entityName: string;
}

function detectEntityHeaders(row0: any[], row1: any[]): EntityHeader[] | null {
  // A row is "entity-style" if it has 2+ non-empty text cells that are NOT period patterns
  // and are NOT purely numeric
  const candidates: EntityHeader[] = [];
  const allCells = [...(row0 ?? []), ...(row1 ?? [])];

  for (let c = 1; c < (row0 ?? []).length; c++) {
    const cell0 = String(row0[c] ?? '').trim();
    const cell1 = String((row1 ?? [])[c] ?? '').trim();
    const cell = cell0 || cell1;
    if (!cell) continue;
    if (parseMoney(cell) !== null) continue; // skip numeric
    // Skip if it looks like a period (month/quarter/year)
    if (/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b/i.test(cell)) continue;
    if (/\bq[1-4]\b/i.test(cell)) continue;
    if (/\b20\d{2}\b/.test(cell)) continue;
    if (/\bytd\b|\bt12\b|\bttm\b/i.test(cell)) continue;
    candidates.push({ colIndex: c, entityName: cell });
  }

  // Need at least 2 entity columns to qualify as multi-entity
  return candidates.length >= 2 ? candidates : null;
}

function buildEntityPeriods(
  entities: EntityHeader[],
  yearHint: number | null,
  filename?: string,
): { periods: ParsedPeriod[]; periodColIndices: number[] } {
  // Derive fiscal year from filename (e.g. "10-1-24_-_9-30-25" → FY2025)
  let year = yearHint;
  if (!year && filename) {
    const m = filename.match(/[_-](20\d{2})[_-]/);
    if (m) year = parseInt(m[1], 10);
    if (!year) {
      const m2 = filename.match(/[_-](\d{2})[_.-]/g);
      if (m2 && m2.length >= 2) {
        const lastYear = m2[m2.length - 1].replace(/[^\d]/g, '');
        if (lastYear) year = parseInt(lastYear, 10) > 50 ? 1900 + parseInt(lastYear, 10) : 2000 + parseInt(lastYear, 10);
      }
    }
  }
  if (!year) year = new Date().getFullYear();

  const { start, end } = getYearPeriod(year);

  const periods: ParsedPeriod[] = entities.map(e => ({
    label: e.entityName,
    start: start.toISOString(),
    end: end.toISOString(),
    type: 'year' as const,
    year,
    periodNo: 1,
  }));

  return { periods, periodColIndices: entities.map(e => e.colIndex) };
}

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

  // ── Multi-entity detection: check row 0 for entity names ──────────────
  const entityHeaders = detectEntityHeaders(jsonData[0] ?? [], jsonData[1] ?? []);
  let isMultiEntity = false;

  // Header row scan
  const header = scanForHeaderRow(jsonData, yearFromMeta);
  let { periods, periodColIndices, rowIndex: headerRowIndex, yearHint } = header;

  // If no periods found and row 0 looks like entity names → multi-entity mode
  if (periods.length === 0 && entityHeaders && entityHeaders.length >= 2) {
    const built = buildEntityPeriods(entityHeaders, yearFromMeta, filename);
    periods = built.periods;
    periodColIndices = built.periodColIndices;
    headerRowIndex = entityHeaders[0] ? 1 : 0; // skip the entity header rows
    isMultiEntity = true;
    console.log(`[Excel] Multi-entity mode: ${entityHeaders.map(e => e.entityName).join(', ')}`);
  }

  // Fallback to annual period
  if (periods.length === 0 && yearHint) {
    const { start, end } = getYearPeriod(yearHint);
    periods = [{ label: `FY ${yearHint}`, start: start.toISOString(), end: end.toISOString(), type: 'year', year: yearHint, periodNo: 1 }];
    const lc = detectLabelColumn(jsonData, headerRowIndex);
    periodColIndices = [lc + 1];
  }

  // In multi-entity mode: label col is always 0 (entity headers are in cols 1+)
  const labelColIndex = isMultiEntity ? 0 : detectLabelColumn(jsonData, headerRowIndex);

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

// ─── Raw-Scan Fallback ────────────────────────────────────────────────────────
/**
 * rawScanExtract — last-resort extraction for header-less / highly irregular broker workbooks.
 *
 * Strategy:
 * 1. Scan every row. Any row with ≥1 text cell followed by ≥1 numeric cell is a candidate.
 * 2. Detect "year-like" text patterns in the first 20 rows to build a period list.
 * 3. Identify the most common column pattern and build rows from it.
 * 4. Returns lower confidence so the orchestrator ranks it below structured extraction.
 *
 * This function is invoked by parseOrchestrator ONLY when extractExcelPnl returns
 * confidence < 0.4 or 0 rows.
 */
export interface RawScanResult extends ExcelExtractResult {
  rawScan: true;
}

const YEAR_PATTERN = /\b(20\d{2}|19\d{2})\b/;

function isProbablyLabel(v: any): boolean {
  if (typeof v !== 'string' && typeof v !== 'number') return false;
  const s = String(v).trim();
  if (!s) return false;
  if (typeof v === 'number') return false;
  return s.length > 1 && isNaN(Number(s.replace(/[$,%]/g, '')));
}

function detectPeriodsFromSheet(jsonData: any[][]): { cols: number[]; periods: ParsedPeriod[] } {
  const colPeriods: Map<number, { col: number; label: string; year: number }> = new Map();

  for (let r = 0; r < Math.min(20, jsonData.length); r++) {
    const row = jsonData[r];
    if (!row) continue;
    for (let c = 0; c < row.length; c++) {
      const cell = String(row[c] ?? '').trim();
      if (!cell) continue;
      const yearM = cell.match(YEAR_PATTERN);
      if (!yearM) continue;
      const year = parseInt(yearM[1], 10);
      if (!colPeriods.has(c)) {
        let label = cell;
        const qm = cell.match(/Q([1-4])/i);
        if (qm) label = `Q${qm[1]} ${year}`;
        colPeriods.set(c, { col: c, label, year });
      }
    }
  }

  // Sort by column index, assign periodIndex
  const sorted = [...colPeriods.values()].sort((a, b) => a.col - b.col);
  const cols = sorted.map(x => x.col);
  const periods: ParsedPeriod[] = sorted.map((x, i) => ({
    label: x.label,
    year: x.year,
    start: `${x.year}-01-01`,
    end: `${x.year}-12-31`,
    type: 'annual' as const,
    periodNo: i + 1,
  }));
  return { cols, periods };
}

export function rawScanExtract(buffer: Buffer, fileName?: string): RawScanResult | null {
  try {
    const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: false, raw: false, dense: false });
    if (!workbook.SheetNames.length) return null;

    const sheetName = selectBestSheet(workbook);
    const ws = workbook.Sheets[sheetName];
    if (!ws) return null;

    const jsonData: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: false });
    if (!jsonData.length) return null;

    let vendorHint: string | null = null;
    for (const sn of workbook.SheetNames) {
      for (const vp of VENDOR_PATTERNS) {
        if (vp.pattern.test(sn)) { vendorHint = vp.hint; break; }
      }
      if (vendorHint) break;
    }
    if (!vendorHint && fileName) {
      for (const vp of VENDOR_PATTERNS) { if (vp.pattern.test(fileName)) { vendorHint = vp.hint; break; } }
    }
    const yearHint = fileName ? inferYearFromText(fileName) : null;

    // Step 1: detect period columns
    let { cols: periodCols, periods } = detectPeriodsFromSheet(jsonData);

    // If no period detection, try to use rightmost numeric-heavy columns
    if (periods.length === 0) {
      // Heuristic: find columns that have >30% numeric content
      const colNumericCount: number[] = [];
      for (const row of jsonData) {
        if (!row) continue;
        row.forEach((cell, c) => {
          colNumericCount[c] = (colNumericCount[c] ?? 0) + (parseMoney(cell) !== null ? 1 : 0);
        });
      }
      const totalRows = jsonData.filter(Boolean).length;
      const numericCols = colNumericCount
        .map((cnt, c) => ({ c, pct: cnt / Math.max(totalRows, 1) }))
        .filter(x => x.pct > 0.3)
        .sort((a, b) => a.c - b.c)
        .map(x => x.c);

      if (numericCols.length === 0) return null;

      // Assign synthetic period labels
      periodCols = numericCols.slice(0, 5); // max 5 periods in raw scan
      const baseYear = yearHint ?? new Date().getFullYear() - periodCols.length + 1;
      periods = periodCols.map((c, i) => ({
        label: String(baseYear + i),
        year: baseYear + i,
        start: `${baseYear + i}-01-01`,
        end: `${baseYear + i}-12-31`,
        type: 'annual' as const,
        periodNo: i + 1,
      }));
    }

    // Step 2: scan all rows for label + value pattern
    const rows: ExcelParsedRow[] = [];
    const seenLabels = new Set<string>();
    const sheetPageNum = workbook.SheetNames.indexOf(sheetName) + 1;

    for (let r = 0; r < jsonData.length; r++) {
      const row = jsonData[r];
      if (!row) continue;

      // Find label column: first text cell in row
      let labelCol = -1;
      let label = '';
      for (let c = 0; c < row.length; c++) {
        if (isProbablyLabel(row[c])) {
          const s = String(row[c]).trim();
          if (s.length > 1) { labelCol = c; label = s; break; }
        }
      }
      if (labelCol < 0 || !label) continue;
      if (seenLabels.has(label.toLowerCase())) continue;

      // Extract values at detected period columns
      const values: ExcelParsedValue[] = [];
      for (let pi = 0; pi < periodCols.length; pi++) {
        const colIdx = periodCols[pi];
        const rawValue = colIdx < row.length ? row[colIdx] : null;
        const money = parseMoney(rawValue);
        values.push({
          periodIndex: pi,
          value: money,
          trace: { page: sheetPageNum, row: r + 1, col: colIdx + 1, raw: String(rawValue ?? '') },
        });
      }

      if (!values.some(v => v.value !== null)) continue;

      // Skip pure-period-header rows
      if (YEAR_PATTERN.test(label)) continue;

      seenLabels.add(label.toLowerCase());
      const normalizedLabel = normalizeLabel(label);
      rows.push({
        label,
        normalizedLabel,
        values,
        sectionHint: null,
        trace: { page: sheetPageNum, row: r + 1 },
      });
    }

    if (rows.length === 0) return null;

    const confidence = Math.min(0.55, 0.15 + rows.length * 0.03); // cap at 0.55 — signals raw scan

    return {
      periods,
      rows,
      vendorHint,
      confidence,
      sheetUsed: sheetName,
      headerRowIndex: -1,
      labelColIndex: 0,
      yearInferred: yearHint,
      rawScan: true,
    };
  } catch (err) {
    console.warn('[rawScanExtract] Failed:', (err as Error).message);
    return null;
  }
}
