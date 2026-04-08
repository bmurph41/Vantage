/**
 * pnl-excel-export.ts — Investment-Grade P&L Workbook Generator
 *
 * Implements the "openpyxl model build" pattern from the Vantage guidance:
 *   - Multi-sheet workbook with distinct analytical layers
 *   - Color coding: NAVY headers, LTBLUE data, YELLOW flags, GREEN positives, RED risks
 *   - Excel formulas (not hardcoded values) for margins, YoY growth, averages
 *   - Number formatting: currency, percentages, multiples
 *   - Merged cells, column widths, borders
 *
 * Sheets: P&L Analysis | Buyer Normalization | Valuation Scenarios | Red Flags
 */

import * as XLSX from 'xlsx';
import type { ParsedRow, ParsedPeriod } from '../../../shared/pnl-pipeline-schema';
import type { PnlAnomaly, AddBackCandidate } from './anomaly-detector';

// ─── Color Palette ───────────────────────────────────────────────────────────
const C = {
  NAVY:       '1B3A5C',  // Header background
  WHITE:      'FFFFFF',  // Header text
  LTBLUE:     'D6E4F7',  // Alternating data row tint
  LTBLUE2:    'EBF2FB',  // Lighter alternating row
  YELLOW:     'FFF3CC',  // Warning / flag background
  GREEN:      'E8F5E9',  // Positive values / totals
  RED_BG:     'FFEBEE',  // Negative / loss background
  DARK_GREEN: '1B5E20',  // Positive text
  DARK_RED:   'B71C1C',  // Negative / loss text
  ORANGE:     'FFF3E0',  // Warning background
  GREY:       'F5F5F5',  // Separator / label
  DARK_GREY:  '9E9E9E',  // Muted text
};

// ─── Style Factories ─────────────────────────────────────────────────────────
function headerStyle(bgColor = C.NAVY, textColor = C.WHITE): any {
  return {
    fill: { patternType: 'solid', fgColor: { rgb: bgColor } },
    font: { bold: true, color: { rgb: textColor }, sz: 11 },
    alignment: { horizontal: 'center', vertical: 'center', wrapText: false },
    border: {
      top: { style: 'thin', color: { rgb: C.DARK_GREY } },
      bottom: { style: 'medium', color: { rgb: C.NAVY } },
    },
  };
}

function labelStyle(indent = 0): any {
  return {
    font: { sz: 10, indent },
    alignment: { horizontal: 'left', vertical: 'center' },
  };
}

function boldLabelStyle(): any {
  return {
    font: { bold: true, sz: 10 },
    alignment: { horizontal: 'left', vertical: 'center' },
    border: { top: { style: 'thin', color: { rgb: C.DARK_GREY } } },
  };
}

function dataStyle(bg?: string, color?: string, bold = false, fmt?: string): any {
  const s: any = {
    alignment: { horizontal: 'right', vertical: 'center' },
    font: { sz: 10, bold, color: color ? { rgb: color } : undefined },
  };
  if (bg) s.fill = { patternType: 'solid', fgColor: { rgb: bg } };
  if (fmt) s.numFmt = fmt;
  return s;
}

function sectionHeaderStyle(): any {
  return {
    fill: { patternType: 'solid', fgColor: { rgb: C.LTBLUE } },
    font: { bold: true, sz: 10, color: { rgb: C.NAVY } },
    alignment: { horizontal: 'left', vertical: 'center' },
    border: {
      top: { style: 'thin', color: { rgb: C.NAVY } },
      bottom: { style: 'thin', color: { rgb: C.NAVY } },
    },
  };
}

function totalStyle(): any {
  return {
    fill: { patternType: 'solid', fgColor: { rgb: C.GREEN } },
    font: { bold: true, sz: 10, color: { rgb: C.DARK_GREEN } },
    alignment: { horizontal: 'right', vertical: 'center' },
    border: {
      top: { style: 'thin', color: { rgb: C.DARK_GREEN } },
      bottom: { style: 'double', color: { rgb: C.DARK_GREEN } },
    },
  };
}

function flagStyle(): any {
  return {
    fill: { patternType: 'solid', fgColor: { rgb: C.YELLOW } },
    font: { sz: 10, color: { rgb: '7B6000' } },
    alignment: { horizontal: 'center', vertical: 'center' },
  };
}

function criticalStyle(): any {
  return {
    fill: { patternType: 'solid', fgColor: { rgb: C.RED_BG } },
    font: { sz: 10, bold: true, color: { rgb: C.DARK_RED } },
    alignment: { horizontal: 'left', vertical: 'center', wrapText: true },
  };
}

// ─── Number Formats ─────────────────────────────────────────────────────────
const FMT = {
  CURRENCY: '$#,##0;($#,##0);"-"',
  CURRENCY_K: '$#,##0,"K";($#,##0,"K");"-"',
  PCT: '0.0%',
  PCT1: '0%',
  MULTI: '0.00"x"',
  NUM: '#,##0',
};

// ─── Cell helper ─────────────────────────────────────────────────────────────
function cell(value: any, style: any, fmt?: string, formula?: string): any {
  const c: any = { v: value };
  if (typeof value === 'number') c.t = 'n';
  else if (typeof value === 'string') c.t = 's';
  else if (value === null || value === undefined) { c.v = null; c.t = 'z'; }
  if (formula) { c.f = formula; c.v = value; c.t = 'n'; }
  c.s = style;
  if (fmt) c.z = fmt;
  return c;
}

function rc(row: number, col: number): string {
  // Convert 0-indexed row, col to A1 reference
  const colStr = colLetter(col);
  return `${colStr}${row + 1}`;
}

function colLetter(col: number): string {
  let letter = '';
  let n = col;
  while (n >= 0) {
    letter = String.fromCharCode(65 + (n % 26)) + letter;
    n = Math.floor(n / 26) - 1;
  }
  return letter;
}

function colRange(startCol: number, endCol: number, row: number): string {
  return `${colLetter(startCol)}${row}:${colLetter(endCol)}${row}`;
}

// ─── Get value for row at period ─────────────────────────────────────────────
function getPeriodValue(row: ParsedRow, periodIndex: number): number | null {
  const v = row.values.find(v => v.periodIndex === periodIndex);
  return v?.value ?? null;
}

// ─── Identify row type ────────────────────────────────────────────────────────
const REVENUE_KWS = ['revenue', 'income', 'sales', 'total rev', 'gross sales', 'egi', 'effective gross'];
const EXPENSE_KWS = ['total expense', 'total cost', 'total operating', 'operating expense'];
const NOI_KWS = ['noi', 'net operating', 'operating income', 'ebitda', 'net income', 'total income'];

function isLikelyTotal(label: string): boolean {
  const l = label.toLowerCase();
  return l.startsWith('total') || l.startsWith('net ') || l.startsWith('gross profit')
    || l === 'noi' || l.includes('subtotal') || l.includes('gross margin');
}

function isSection(label: string): boolean {
  const l = label.toLowerCase();
  return REVENUE_KWS.some(k => l.includes(k)) || EXPENSE_KWS.some(k => l.includes(k)) || NOI_KWS.some(k => l.includes(k));
}

// ─── Sheet 1: P&L Analysis ───────────────────────────────────────────────────
function buildPnlSheet(
  rows: ParsedRow[],
  periods: ParsedPeriod[],
  dataQualityScore: number | null
): XLSX.WorkSheet {
  const ws: any = {};
  const merges: XLSX.Range[] = [];
  let R = 0;
  const n = periods.length;
  const colCount = 1 + n + (n > 1 ? n - 1 : 0) + 2; // label | data... | YoY... | Avg | Margin

  // Row 0: Title
  ws[rc(R, 0)] = cell('FINANCIAL PERFORMANCE ANALYSIS', headerStyle(), undefined);
  merges.push({ s: { r: R, c: 0 }, e: { r: R, c: Math.max(colCount, n + 3) } });
  R++;

  // Row 1: Quality score (if available)
  if (dataQualityScore !== null) {
    const qStyle = dataQualityScore >= 70
      ? { fill: { patternType: 'solid', fgColor: { rgb: C.GREEN } }, font: { bold: true, sz: 9 } }
      : { fill: { patternType: 'solid', fgColor: { rgb: C.YELLOW } }, font: { bold: true, sz: 9 } };
    ws[rc(R, 0)] = { v: `Data Quality Score: ${dataQualityScore}/100`, t: 's', s: qStyle };
    merges.push({ s: { r: R, c: 0 }, e: { r: R, c: Math.max(colCount, n + 3) } });
    R++;
  }
  R++; // blank row

  // Header row
  const hR = R;
  ws[rc(R, 0)] = cell('Line Item', headerStyle(), undefined);
  let col = 1;
  for (let pi = 0; pi < n; pi++) {
    ws[rc(R, col)] = cell(periods[pi].label, headerStyle(), undefined);
    col++;
    if (pi < n - 1) {
      ws[rc(R, col)] = cell(`YoY ${periods[pi].label}→${periods[pi + 1].label}`, headerStyle(C.LTBLUE, C.NAVY), undefined);
      col++;
    }
  }
  ws[rc(R, col)] = cell('Average', headerStyle(C.LTBLUE, C.NAVY), undefined);
  ws[rc(R, col + 1)] = cell('Margin %', headerStyle(C.LTBLUE, C.NAVY), undefined);
  R++;

  // Data rows
  let revRowRef: string | null = null;

  for (let ri = 0; ri < rows.length; ri++) {
    const row = rows[ri];
    const isTotal = isLikelyTotal(row.label);
    const isSect = isSection(row.label);
    const isRev = REVENUE_KWS.some(k => row.normalizedLabel.toLowerCase().includes(k));

    const rowStyle = isSect
      ? sectionHeaderStyle()
      : isTotal
        ? totalStyle()
        : ri % 2 === 0
          ? { ...labelStyle(), fill: { patternType: 'solid', fgColor: { rgb: C.LTBLUE2 } } }
          : labelStyle();

    ws[rc(R, 0)] = cell(row.label, rowStyle);

    const dataColStart = 1;
    let col = dataColStart;
    const periodCells: string[] = [];

    for (let pi = 0; pi < n; pi++) {
      const val = getPeriodValue(row, pi);
      const cellRef = rc(R, col);
      periodCells.push(cellRef);

      const numStyle = isTotal ? totalStyle() : val !== null && val < 0
        ? { ...dataStyle(C.RED_BG, C.DARK_RED, isTotal, FMT.CURRENCY) }
        : { ...dataStyle(ri % 2 === 0 ? C.LTBLUE2 : undefined, undefined, isTotal, FMT.CURRENCY) };

      ws[cellRef] = {
        v: val ?? 0,
        t: 'n',
        z: FMT.CURRENCY,
        s: numStyle,
      };
      col++;

      // YoY growth formula
      if (pi < n - 1) {
        const yoyRef = rc(R, col);
        const prevRef = rc(R, col - 1);
        const currRef = rc(R, col + 1);
        // Will be filled after we know col references
        ws[yoyRef] = {
          f: `IF(${prevRef}=0,"N/A",(${currRef}-${prevRef})/${prevRef})`,
          v: null,
          t: 'n',
          z: FMT.PCT,
          s: flagStyle(),
        };
        col++;
      }
    }

    // Average formula across period data columns
    const avgRef = rc(R, col);
    if (periodCells.length > 0) {
      ws[avgRef] = {
        f: `AVERAGE(${periodCells.join(',')})`,
        v: null,
        t: 'n',
        z: FMT.CURRENCY,
        s: dataStyle(C.LTBLUE, undefined, false),
      };
    } else {
      ws[avgRef] = cell(null, dataStyle(C.LTBLUE));
    }
    col++;

    // Margin formula (if revenue row reference known and this isn't the revenue row)
    if (isRev) {
      revRowRef = avgRef; // save first period of rev row instead
      revRowRef = rc(R, dataColStart); // first period data cell of revenue row
      ws[rc(R, col)] = cell('100.0%', dataStyle(C.GREEN, C.DARK_GREEN, true), FMT.PCT);
    } else if (revRowRef && !isTotal) {
      ws[rc(R, col)] = {
        f: `IF(${revRowRef}=0,"-",${rc(R, dataColStart)}/${revRowRef})`,
        v: null,
        t: 'n',
        z: FMT.PCT,
        s: dataStyle(C.LTBLUE),
      };
    } else {
      ws[rc(R, col)] = cell(null, dataStyle(C.LTBLUE));
    }

    R++;
  }

  // Set column widths
  const colWidths: XLSX.ColInfo[] = [{ wch: 38 }]; // label
  for (let pi = 0; pi < n; pi++) {
    colWidths.push({ wch: 14 }); // data
    if (pi < n - 1) colWidths.push({ wch: 12 }); // yoy
  }
  colWidths.push({ wch: 14 }); // avg
  colWidths.push({ wch: 11 }); // margin

  ws['!ref'] = `A1:${colLetter(colWidths.length - 1)}${R + 1}`;
  ws['!cols'] = colWidths;
  ws['!merges'] = merges;
  ws['!rows'] = [{ hpt: 24 }, { hpt: 16 }]; // title row heights

  return ws as XLSX.WorkSheet;
}

// ─── Sheet 2: Buyer Normalization ────────────────────────────────────────────
function buildBuyerNormalizationSheet(
  addBackCandidates: AddBackCandidate[],
  periods: ParsedPeriod[]
): XLSX.WorkSheet {
  const ws: any = {};
  const merges: XLSX.Range[] = [];
  let R = 0;
  const n = periods.length;

  ws[rc(R, 0)] = cell('BUYER NORMALIZATION — ADD-BACK ANALYSIS', headerStyle(), undefined);
  merges.push({ s: { r: R, c: 0 }, e: { r: R, c: n + 2 } });
  R++;

  ws[rc(R, 0)] = cell(
    'Items below represent expenses that a buyer would add back to compute Normalized EBITDA / NOI',
    { font: { italic: true, sz: 9, color: { rgb: C.DARK_GREY } } }
  );
  merges.push({ s: { r: R, c: 0 }, e: { r: R, c: n + 2 } });
  R++;
  R++; // blank

  // Header
  ws[rc(R, 0)] = cell('Line Item / Add-Back', headerStyle(), undefined);
  ws[rc(R, 1)] = cell('Reason', headerStyle(), undefined);
  for (let pi = 0; pi < n; pi++) {
    ws[rc(R, 2 + pi)] = cell(periods[pi].label, headerStyle(), undefined);
  }
  ws[rc(R, 2 + n)] = cell('Average Annual', headerStyle(C.LTBLUE, C.NAVY), undefined);
  R++;

  let addBackDataStart = R;

  if (addBackCandidates.length === 0) {
    ws[rc(R, 0)] = cell(
      'No add-back candidates detected in this document',
      { font: { italic: true, sz: 10, color: { rgb: C.DARK_GREY } } }
    );
    merges.push({ s: { r: R, c: 0 }, e: { r: R, c: n + 2 } });
    R++;
  } else {
    for (let i = 0; i < addBackCandidates.length; i++) {
      const ab = addBackCandidates[i];
      const bg = i % 2 === 0 ? C.LTBLUE2 : undefined;

      ws[rc(R, 0)] = cell(ab.rowLabel, { ...labelStyle(), fill: bg ? { patternType: 'solid', fgColor: { rgb: bg } } : undefined });
      ws[rc(R, 1)] = cell(ab.reason, { font: { sz: 9, italic: true, color: { rgb: C.DARK_GREY } }, fill: bg ? { patternType: 'solid', fgColor: { rgb: bg } } : undefined });

      const periodCells: string[] = [];
      for (let pi = 0; pi < n; pi++) {
        const pv = ab.byPeriod.find(p => p.periodIndex === pi);
        const val = pv?.value ?? 0;
        const cellRef = rc(R, 2 + pi);
        periodCells.push(cellRef);
        ws[cellRef] = {
          v: val,
          t: 'n',
          z: FMT.CURRENCY,
          s: dataStyle(bg, undefined, false),
        };
      }
      ws[rc(R, 2 + n)] = {
        f: `AVERAGE(${periodCells.join(',')})`,
        v: null,
        t: 'n',
        z: FMT.CURRENCY,
        s: dataStyle(C.LTBLUE),
      };
      R++;
    }

    // Total Add-Backs row
    const totalCols = [];
    for (let pi = 0; pi < n; pi++) {
      const col = 2 + pi;
      const sumRef = `${colLetter(col)}${addBackDataStart + 1}:${colLetter(col)}${R}`;
      const cellRef = rc(R, col);
      totalCols.push(cellRef);
      ws[cellRef] = {
        f: `SUM(${sumRef})`,
        v: null,
        t: 'n',
        z: FMT.CURRENCY,
        s: totalStyle(),
      };
    }
    ws[rc(R, 0)] = cell('Total Add-Backs', boldLabelStyle());
    ws[rc(R, 1)] = cell('', boldLabelStyle());
    ws[rc(R, 2 + n)] = {
      f: `AVERAGE(${totalCols.join(',')})`,
      v: null,
      t: 'n',
      z: FMT.CURRENCY,
      s: totalStyle(),
    };
    R++;
  }

  const colWidths: XLSX.ColInfo[] = [{ wch: 38 }, { wch: 40 }];
  for (let i = 0; i < n; i++) colWidths.push({ wch: 14 });
  colWidths.push({ wch: 16 });

  ws['!ref'] = `A1:${colLetter(colWidths.length - 1)}${R + 1}`;
  ws['!cols'] = colWidths;
  ws['!merges'] = merges;

  return ws as XLSX.WorkSheet;
}

// ─── Sheet 3: Valuation Scenarios ────────────────────────────────────────────
function buildValuationSheet(
  rows: ParsedRow[],
  periods: ParsedPeriod[]
): XLSX.WorkSheet {
  const ws: any = {};
  const merges: XLSX.Range[] = [];
  let R = 0;
  const n = periods.length;

  ws[rc(R, 0)] = cell('VALUATION SCENARIO MATRIX', headerStyle(), undefined);
  merges.push({ s: { r: R, c: 0 }, e: { r: R, c: 8 } });
  R++;
  ws[rc(R, 0)] = cell(
    'Based on extracted NOI / EBITDA. Adjust cap rates and EBITDA multiples to reflect market conditions.',
    { font: { italic: true, sz: 9, color: { rgb: C.DARK_GREY } } }
  );
  merges.push({ s: { r: R, c: 0 }, e: { r: R, c: 8 } });
  R++;
  R++;

  // Find NOI/EBITDA rows
  const noiRows = rows.filter(r => {
    const l = r.normalizedLabel.toLowerCase();
    return NOI_KWS.some(k => l.includes(k)) || isLikelyTotal(r.label);
  }).slice(0, 3); // take top 3 matches

  // Calculate average NOI across periods
  let avgNoi = 0;
  if (noiRows.length > 0 && n > 0) {
    const r = noiRows[0];
    const vals = r.values.map(v => v.value ?? 0).filter(v => v !== 0);
    avgNoi = vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
  }

  // NOI reference row
  ws[rc(R, 0)] = cell('Estimated NOI / EBITDA (from extracted data)', boldLabelStyle());
  ws[rc(R, 1)] = {
    v: Math.abs(avgNoi),
    t: 'n',
    z: FMT.CURRENCY,
    s: { ...totalStyle(), font: { bold: true, sz: 12, color: { rgb: C.DARK_GREEN } } },
  };
  merges.push({ s: { r: R, c: 1 }, e: { r: R, c: 2 } });
  R++;
  R++;

  const noiRef = `B${R - 1}`;

  // Scenario headers
  const scenarios = [
    { label: 'Conservative',  capRate: 0.085, multipleMin: 2.5, multipleMax: 3.0, color: C.YELLOW },
    { label: 'Below Market',  capRate: 0.075, multipleMin: 3.0, multipleMax: 3.5, color: C.LTBLUE },
    { label: 'Market',        capRate: 0.065, multipleMin: 3.5, multipleMax: 4.5, color: C.GREEN },
    { label: 'Above Market',  capRate: 0.055, multipleMin: 4.5, multipleMax: 5.5, color: C.LTBLUE2 },
    { label: 'Aggressive',    capRate: 0.045, multipleMin: 5.5, multipleMax: 7.0, color: C.ORANGE },
  ];

  // Header row
  ws[rc(R, 0)] = cell('Scenario', headerStyle(), undefined);
  ws[rc(R, 1)] = cell('Cap Rate', headerStyle(), undefined);
  ws[rc(R, 2)] = cell('Income Approach Value', headerStyle(), undefined);
  ws[rc(R, 3)] = cell('EBITDA Multiple Low', headerStyle(), undefined);
  ws[rc(R, 4)] = cell('Value (Low)', headerStyle(), undefined);
  ws[rc(R, 5)] = cell('EBITDA Multiple High', headerStyle(), undefined);
  ws[rc(R, 6)] = cell('Value (High)', headerStyle(), undefined);
  ws[rc(R, 7)] = cell('Midpoint Estimate', headerStyle(C.NAVY), undefined);
  ws[rc(R, 8)] = cell('Viability', headerStyle(), undefined);
  R++;

  for (const s of scenarios) {
    const bg = s.color;
    ws[rc(R, 0)] = cell(s.label, { ...boldLabelStyle(), fill: { patternType: 'solid', fgColor: { rgb: bg } } });
    ws[rc(R, 1)] = { v: s.capRate, t: 'n', z: '0.00%', s: dataStyle(bg) };
    ws[rc(R, 2)] = {
      f: `IF(B${R + 1}=0,"-",${noiRef}/B${R + 1})`,
      v: null, t: 'n', z: FMT.CURRENCY,
      s: dataStyle(bg, undefined, true),
    };
    ws[rc(R, 3)] = { v: s.multipleMin, t: 'n', z: '0.0"x"', s: dataStyle(bg) };
    ws[rc(R, 4)] = {
      f: `${noiRef}*D${R + 1}`,
      v: null, t: 'n', z: FMT.CURRENCY,
      s: dataStyle(bg),
    };
    ws[rc(R, 5)] = { v: s.multipleMax, t: 'n', z: '0.0"x"', s: dataStyle(bg) };
    ws[rc(R, 6)] = {
      f: `${noiRef}*F${R + 1}`,
      v: null, t: 'n', z: FMT.CURRENCY,
      s: dataStyle(bg),
    };
    ws[rc(R, 7)] = {
      f: `(C${R + 1}+E${R + 1}+G${R + 1})/3`,
      v: null, t: 'n', z: FMT.CURRENCY,
      s: { ...totalStyle(), fill: { patternType: 'solid', fgColor: { rgb: C.NAVY } }, font: { bold: true, color: { rgb: C.WHITE } } },
    };
    ws[rc(R, 8)] = cell(
      s.label === 'Market' ? '✓ Baseline' : s.label === 'Conservative' ? '⚠ Distressed?' : s.label === 'Aggressive' ? '⚠ Stretch' : '✓ Viable',
      { ...flagStyle(), fill: { patternType: 'solid', fgColor: { rgb: bg } } }
    );
    R++;
  }

  const colWidths: XLSX.ColInfo[] = [
    { wch: 18 }, { wch: 12 }, { wch: 22 }, { wch: 20 }, { wch: 16 },
    { wch: 20 }, { wch: 16 }, { wch: 18 }, { wch: 14 },
  ];

  ws['!ref'] = `A1:I${R + 1}`;
  ws['!cols'] = colWidths;
  ws['!merges'] = merges;

  return ws as XLSX.WorkSheet;
}

// ─── Sheet 4: Red Flag Registry ──────────────────────────────────────────────
function buildRedFlagSheet(
  anomalies: PnlAnomaly[],
  dataQualityScore: number | null,
  hasRedFlags: boolean
): XLSX.WorkSheet {
  const ws: any = {};
  const merges: XLSX.Range[] = [];
  let R = 0;

  ws[rc(R, 0)] = cell('ANOMALY & RED FLAG REGISTRY', headerStyle(hasRedFlags ? 'B71C1C' : C.NAVY), undefined);
  merges.push({ s: { r: R, c: 0 }, e: { r: R, c: 5 } });
  R++;

  const scoreColor = (dataQualityScore ?? 100) >= 70 ? C.GREEN : (dataQualityScore ?? 100) >= 50 ? C.YELLOW : C.RED_BG;
  ws[rc(R, 0)] = cell(
    `Data Quality Score: ${dataQualityScore ?? 'N/A'}/100  |  Red Flags: ${hasRedFlags ? 'YES — REVIEW REQUIRED' : 'None detected'}`,
    { fill: { patternType: 'solid', fgColor: { rgb: scoreColor } }, font: { bold: true, sz: 10 } }
  );
  merges.push({ s: { r: R, c: 0 }, e: { r: R, c: 5 } });
  R++;
  R++;

  // Column headers
  ws[rc(R, 0)] = cell('Severity', headerStyle(), undefined);
  ws[rc(R, 1)] = cell('Type', headerStyle(), undefined);
  ws[rc(R, 2)] = cell('Description', headerStyle(), undefined);
  ws[rc(R, 3)] = cell('Row / Period', headerStyle(), undefined);
  ws[rc(R, 4)] = cell('Value', headerStyle(), undefined);
  ws[rc(R, 5)] = cell('Recommended Action', headerStyle(), undefined);
  R++;

  if (anomalies.length === 0) {
    ws[rc(R, 0)] = cell('INFO', { ...flagStyle() });
    ws[rc(R, 1)] = cell('clean', labelStyle());
    ws[rc(R, 2)] = cell('No anomalies detected — data appears consistent', labelStyle());
    merges.push({ s: { r: R, c: 2 }, e: { r: R, c: 5 } });
    R++;
  } else {
    for (let i = 0; i < anomalies.length; i++) {
      const a = anomalies[i];
      const sevStyle = a.severity === 'critical'
        ? criticalStyle()
        : a.severity === 'warning'
          ? flagStyle()
          : { ...labelStyle(), fill: { patternType: 'solid', fgColor: { rgb: C.LTBLUE } } };

      const typeLabel = a.type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      const action = {
        'large_yoy_swing': 'Verify with operator — confirm no reclassification',
        'suspicious_magnitude_shift': 'URGENT: Confirm data entry — possible omitted digit',
        'payroll_rate_anomaly': 'Request payroll detail — verify against tax returns',
        'cogs_pct_shift': 'Request breakdown by year — check for category changes',
        'negative_revenue': 'URGENT: Confirm revenue sign convention — may be refunds',
        'sparse_period': 'Obtain complete data for this period before underwriting',
      }[a.type] ?? 'Review with seller/accountant';

      ws[rc(R, 0)] = cell(a.severity.toUpperCase(), sevStyle);
      ws[rc(R, 1)] = cell(typeLabel, { ...labelStyle(), fill: { patternType: 'solid', fgColor: { rgb: i % 2 === 0 ? C.LTBLUE2 : C.WHITE } } });
      ws[rc(R, 2)] = { v: a.message, t: 's', s: { ...labelStyle(), alignment: { horizontal: 'left', wrapText: true } } };
      ws[rc(R, 3)] = cell(
        [a.rowLabel, a.periodLabel].filter(Boolean).join(' / ') || '—',
        labelStyle()
      );
      ws[rc(R, 4)] = a.value !== undefined
        ? { v: a.value, t: 'n', z: FMT.CURRENCY, s: dataStyle() }
        : cell('—', labelStyle());
      ws[rc(R, 5)] = { v: action, t: 's', s: { font: { italic: true, sz: 9 }, alignment: { horizontal: 'left', wrapText: true } } };
      R++;
    }
  }

  const colWidths: XLSX.ColInfo[] = [
    { wch: 12 }, { wch: 22 }, { wch: 55 }, { wch: 28 }, { wch: 14 }, { wch: 42 },
  ];

  ws['!ref'] = `A1:F${R + 1}`;
  ws['!cols'] = colWidths;
  ws['!merges'] = merges;

  return ws as XLSX.WorkSheet;
}

// ─── Main Export Function ────────────────────────────────────────────────────
export interface PnlExportInput {
  rows: ParsedRow[];
  periods: ParsedPeriod[];
  anomalies?: PnlAnomaly[];
  addBackCandidates?: AddBackCandidate[];
  dataQualityScore?: number | null;
  hasRedFlags?: boolean;
  documentName?: string;
}

export function generatePnlExcelWorkbook(input: PnlExportInput): Buffer {
  const {
    rows, periods,
    anomalies = [],
    addBackCandidates = [],
    dataQualityScore = null,
    hasRedFlags = false,
    documentName = 'P&L Analysis',
  } = input;

  const wb = XLSX.utils.book_new();

  // Sheet 1: P&L Analysis
  const pnlSheet = buildPnlSheet(rows, periods, dataQualityScore);
  XLSX.utils.book_append_sheet(wb, pnlSheet, 'P&L Analysis');

  // Sheet 2: Buyer Normalization
  const buyerSheet = buildBuyerNormalizationSheet(addBackCandidates, periods);
  XLSX.utils.book_append_sheet(wb, buyerSheet, 'Buyer Normalization');

  // Sheet 3: Valuation Scenarios
  const valuationSheet = buildValuationSheet(rows, periods);
  XLSX.utils.book_append_sheet(wb, valuationSheet, 'Valuation Scenarios');

  // Sheet 4: Red Flags
  const flagSheet = buildRedFlagSheet(anomalies, dataQualityScore, hasRedFlags);
  XLSX.utils.book_append_sheet(wb, flagSheet, 'Red Flags');

  return Buffer.from(XLSX.write(wb, {
    type: 'buffer',
    bookType: 'xlsx',
    cellStyles: true,
  }));
}
