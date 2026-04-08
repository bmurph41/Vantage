import fs from 'fs/promises';

export interface PageTextResult {
  pageNumber: number;
  text: string;
  tables: ExtractedTable[];
  isScanned: boolean;
}

export interface ExtractedTable {
  pageNumber: number;
  rows: string[][];
  headerRow: string[];
}

export async function extractPDF(filePath: string): Promise<{
  pages: PageTextResult[];
  fullText: string;
  pageCount: number;
  hasScannedPages: boolean;
}> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs' as any).catch(
    () => import('pdfjs-dist' as any)
  );

  const data = new Uint8Array(await fs.readFile(filePath));
  const pdf = await pdfjs.getDocument({ data, verbosity: 0 }).promise;
  const pages: PageTextResult[] = [];
  let hasScannedPages = false;

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();

    const items = content.items as Array<{
      str: string;
      transform: number[];
      width: number;
      height: number;
    }>;

    const rawText = items.map((it: any) => it.str).join(' ').trim();
    const isScanned = rawText.length < 50;

    let pageText = rawText;
    let tables: ExtractedTable[] = [];

    if (isScanned) {
      hasScannedPages = true;
      try {
        const ocrResult = await runOCROnPage(filePath, i);
        pageText = ocrResult.text;
      } catch {
        pageText = '[OCR failed for this page]';
      }
    } else {
      tables = extractTablesFromItems(items, i);
      pageText = buildStructuredText(items);
    }

    pages.push({ pageNumber: i, text: pageText, tables, isScanned });
  }

  return {
    pages,
    fullText: pages.map(p => `--- PAGE ${p.pageNumber} ---\n${p.text}`).join('\n\n'),
    pageCount: pdf.numPages,
    hasScannedPages
  };
}

async function runOCROnPage(filePath: string, _pageNum: number): Promise<{ text: string }> {
  const Tesseract = await import('tesseract.js');
  const worker = await Tesseract.createWorker('eng');
  try {
    const result = await worker.recognize(filePath);
    return { text: result.data.text };
  } finally {
    await worker.terminate();
  }
}

function buildStructuredText(
  items: Array<{ str: string; transform: number[]; width: number; height: number }>
): string {
  const TOLERANCE = 3;
  const rowMap = new Map<number, typeof items>();

  for (const item of items) {
    const y = Math.round(item.transform[5] / TOLERANCE) * TOLERANCE;
    if (!rowMap.has(y)) rowMap.set(y, []);
    rowMap.get(y)!.push(item);
  }

  return Array.from(rowMap.entries())
    .sort((a, b) => b[0] - a[0])
    .map(([, rowItems]) =>
      rowItems
        .sort((a, b) => a.transform[4] - b.transform[4])
        .map(it => it.str.trim())
        .filter(s => s.length > 0)
        .join('  ')
    )
    .filter(line => line.length > 0)
    .join('\n');
}

function extractTablesFromItems(
  items: Array<{ str: string; transform: number[]; width: number; height: number }>,
  pageNum: number
): ExtractedTable[] {
  const TOLERANCE = 3;
  const rowMap = new Map<number, typeof items>();

  for (const item of items) {
    const y = Math.round(item.transform[5] / TOLERANCE) * TOLERANCE;
    if (!rowMap.has(y)) rowMap.set(y, []);
    rowMap.get(y)!.push(item);
  }

  const sortedRows = Array.from(rowMap.entries())
    .sort((a, b) => b[0] - a[0])
    .map(([y, rowItems]) => ({
      y,
      cells: rowItems
        .sort((a, b) => a.transform[4] - b.transform[4])
        .map(it => it.str.trim())
        .filter(s => s.length > 0)
    }));

  const tables: ExtractedTable[] = [];
  let currentTableRows: string[][] = [];
  let headerRow: string[] = [];

  for (const row of sortedRows) {
    const numericCount = row.cells.filter(c => /[\d,\.\$\(\)%]/.test(c)).length;
    const isDataRow = numericCount >= 2 && row.cells.length >= 2;

    if (isDataRow) {
      currentTableRows.push(row.cells);
    } else if (currentTableRows.length > 0) {
      tables.push({ pageNumber: pageNum, rows: currentTableRows, headerRow });
      currentTableRows = [];
      headerRow = [];
    } else {
      headerRow = row.cells;
    }
  }

  if (currentTableRows.length > 0) {
    tables.push({ pageNumber: pageNum, rows: currentTableRows, headerRow });
  }

  return tables;
}
