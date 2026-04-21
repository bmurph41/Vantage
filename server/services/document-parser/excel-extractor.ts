import * as XLSX from 'xlsx';
import fs from 'fs/promises';

export interface SheetData {
  sheetName: string;
  headers: string[];
  rows: Array<Record<string, string | number | null>>;
  rawMatrix: (string | number | null)[][];
  numericColumnCount: number;
  rowCount: number;
  /** Rows above the detected header row, joined as plain strings.
   *  Captures property name, address, period etc. that would otherwise be dropped. */
  preambleRows: string[];
}

export async function extractExcel(filePath: string): Promise<{
  sheets: SheetData[];
  sheetNames: string[];
  primarySheet: SheetData;
  fullText: string;
}> {
  const buffer = await fs.readFile(filePath);
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });

  const sheets: SheetData[] = [];

  for (const sheetName of workbook.SheetNames) {
    const ws = workbook.Sheets[sheetName];
    const rawMatrix = XLSX.utils.sheet_to_json<(string | number | null)[]>(ws, {
      header: 1,
      raw: false,
      defval: null,
    });

    if (rawMatrix.length === 0) continue;

    let headerRowIdx = 0;
    for (let i = 0; i < Math.min(10, rawMatrix.length); i++) {
      const row = rawMatrix[i];
      const textCount = row.filter(c => c !== null && typeof c === 'string' && isNaN(Number(c))).length;
      if (textCount >= 2) { headerRowIdx = i; break; }
    }

    // Preamble = rows above the detected header (often contain property name,
    // address, reporting period — metadata Claude needs but would otherwise
    // be silently dropped).
    const preambleRows = rawMatrix.slice(0, headerRowIdx)
      .map(r => r.filter(c => c !== null && c !== '').map(c => String(c).trim()).join(' | '))
      .filter(line => line.length > 0);

    const headers = (rawMatrix[headerRowIdx] || []).map(h => String(h ?? '').trim());
    const dataRows = rawMatrix.slice(headerRowIdx + 1);

    const rows = dataRows.map(row => {
      const obj: Record<string, string | number | null> = {};
      headers.forEach((h, i) => {
        if (h) obj[h] = (row as any)[i] ?? null;
      });
      return obj;
    }).filter(row => Object.values(row).some(v => v !== null));

    const numericColumnCount = headers.filter(h => {
      const sample = rows.slice(0, 5).map(r => r[h]);
      return sample.filter(v => typeof v === 'number' || (typeof v === 'string' && !isNaN(parseFloat(v)))).length >= 2;
    }).length;

    sheets.push({ sheetName, headers, rows, rawMatrix, numericColumnCount, rowCount: rows.length, preambleRows });
  }

  if (sheets.length === 0) {
    throw new Error('No parseable sheets found in Excel file');
  }

  const primarySheet = [...sheets].sort((a, b) => b.numericColumnCount - a.numericColumnCount)[0];

  const fullText = sheets.map(s => {
    const preamble = s.preambleRows && s.preambleRows.length > 0
      ? `Preamble:\n${s.preambleRows.join('\n')}\n`
      : '';
    return `=== SHEET: ${s.sheetName} ===\n${preamble}Headers: ${s.headers.join(' | ')}\n${
      s.rows.slice(0, 500).map(r => Object.values(r).join(' | ')).join('\n')
    }`;
  }).join('\n\n');

  return { sheets, sheetNames: workbook.SheetNames, primarySheet, fullText };
}
