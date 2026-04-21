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
  const scannedPageNumbers: number[] = [];

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
      scannedPageNumbers.push(i);
      pageText = '[scanned page — pending vision OCR]';
    } else {
      tables = extractTablesFromItems(items, i);
      pageText = buildStructuredText(items);
    }

    pages.push({ pageNumber: i, text: pageText, tables, isScanned });
  }

  // ── Claude Vision OCR fallback ─────────────────────────────────────────
  // If any page lacked extractable text, send the whole PDF to Claude as a
  // native `document` content block (SDK v0.68+). Claude reads scanned PDFs
  // directly via vision — no Tesseract round-trip, much higher accuracy on
  // financial tables. Replaces the previous broken Tesseract path which
  // passed a PDF to a worker that expects images.
  //
  // Single API call per PDF (not per-page) — Claude handles multi-page docs
  // natively and we only need it when at least one page is image-only.
  if (hasScannedPages) {
    try {
      const visionResult = await runClaudeVisionOnPDF(filePath);
      // Replace the placeholder text on each scanned page with the vision
      // result for that page (Claude returns per-page text when asked).
      for (const i of scannedPageNumbers) {
        const page = pages.find(p => p.pageNumber === i);
        if (page) {
          page.text = visionResult.perPageText[i] ?? visionResult.fullText;
        }
      }
    } catch (e: any) {
      // Vision unavailable (no API key, network, etc.) — leave placeholders.
      // The downstream Claude extractor will still see them and can flag the
      // job as unparseable instead of silently producing garbage.
      console.warn(`[pdf-extractor] Vision OCR failed: ${e.message?.slice(0, 200)}`);
    }
  }

  return {
    pages,
    fullText: pages.map(p => `--- PAGE ${p.pageNumber} ---\n${p.text}`).join('\n\n'),
    pageCount: pdf.numPages,
    hasScannedPages
  };
}

// ── Claude Vision OCR ──────────────────────────────────────────────────────
// Sends the PDF as a native `document` content block. Claude returns text
// extracted page-by-page — financial tables, columns, and stamps included.
// Cost: ~$0.05-0.10 per scanned page (Claude Opus 4.6 vision pricing).
async function runClaudeVisionOnPDF(filePath: string): Promise<{
  fullText: string;
  perPageText: Record<number, string>;
}> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY not set — vision OCR unavailable');
  }

  const Anthropic = (await import('@anthropic-ai/sdk')).default;
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const pdfBuffer = await fs.readFile(filePath);
  const base64 = pdfBuffer.toString('base64');

  // Anthropic enforces a ~32MB document size limit. Bail loudly above that.
  if (pdfBuffer.byteLength > 30 * 1024 * 1024) {
    throw new Error(`PDF too large for vision OCR: ${(pdfBuffer.byteLength / 1024 / 1024).toFixed(1)}MB > 30MB`);
  }

  const response = await client.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 16000,
    messages: [{
      role: 'user',
      content: [
        {
          type: 'document',
          source: { type: 'base64', media_type: 'application/pdf', data: base64 },
        } as any,
        {
          type: 'text',
          text:
            'This PDF appears to be scanned or image-only. Extract all visible text ' +
            'from every page, preserving layout, line items, and numeric values exactly ' +
            'as printed. Tables should be reproduced row-by-row with cells separated by ' +
            ' | (pipe). Return ONLY a JSON object: { "pages": [{ "page": 1, "text": "..." }, ...] }. ' +
            'No markdown, no commentary.',
        },
      ],
    }],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';
  const clean = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  const parsed = JSON.parse(clean);

  const perPageText: Record<number, string> = {};
  for (const p of parsed.pages ?? []) {
    if (typeof p.page === 'number' && typeof p.text === 'string') {
      perPageText[p.page] = p.text;
    }
  }

  const fullText = (parsed.pages ?? []).map((p: any) => p.text).join('\n\n');
  return { fullText, perPageText };
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
