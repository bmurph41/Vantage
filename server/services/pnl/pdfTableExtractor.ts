/**
 * pdfTableExtractor.ts — Deterministic PDF table extraction using pdfjs-dist token geometry.
 *
 * Replaces fragile whitespace-based PDF parsing with geometry-aware cell reconstruction.
 * Reads the PDF from disk, extracts text items with (x, y, w, h), groups them into rows
 * by y-proximity, then merges adjacent tokens into cells by x-gap.
 */

import type { TextItem, TextMarkedContent } from 'pdfjs-dist/types/src/display/api';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PdfToken {
  text: string;
  x: number;
  y: number;
  w: number;
  h: number;
  page: number;
}

export interface PdfCell {
  x: number;
  text: string;
  w: number;
}

export interface PdfRow {
  y: number;
  cells: PdfCell[];
  page: number;
}

export interface ExtractedPdfTable {
  pageNumber: number;
  rows: PdfRow[];
}

export interface PdfExtractResult {
  tables: ExtractedPdfTable[];
  allRows: PdfRow[];         // merged across pages for convenience
  plainText: string;
  tokensCount: number;
  pageCount: number;
}

// ─── Tuning constants ─────────────────────────────────────────────────────────

/** Max y-distance between tokens to be considered the same row */
const ROW_Y_THRESHOLD = 3;

/** Max x-gap between tokens to merge them into a single cell */
const CELL_GAP_THRESHOLD = 4;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isTextItem(item: TextItem | TextMarkedContent): item is TextItem {
  return 'str' in item;
}

// ─── Main extractor ───────────────────────────────────────────────────────────

export async function extractPdfTables(filePath: string): Promise<PdfExtractResult> {
  // Dynamic import to handle both ESM and CJS environments on Replit
  let pdfjsLib: any;
  try {
    pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
  } catch {
    try {
      pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.js');
    } catch {
      pdfjsLib = await import('pdfjs-dist');
    }
  }

  const loadingTask = pdfjsLib.getDocument({ url: filePath, useSystemFonts: true });
  const pdf = await loadingTask.promise;
  const pageCount = pdf.numPages;

  const tables: ExtractedPdfTable[] = [];
  const allTokens: PdfToken[] = [];
  const plainTextParts: string[] = [];

  for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();
    const viewport = page.getViewport({ scale: 1.0 });
    const pageHeight = viewport.height;

    const pageTokens: PdfToken[] = [];

    for (const item of textContent.items) {
      if (!isTextItem(item)) continue;
      const text = item.str;
      if (!text || !text.trim()) continue;

      // transform is [scaleX, skewX, skewY, scaleY, translateX, translateY]
      const tx = item.transform;
      const x = tx[4];
      // PDF y-axis is bottom-up; flip to top-down for row grouping
      const y = pageHeight - tx[5];
      const w = item.width ?? text.length * 5; // fallback width estimate
      const h = Math.abs(tx[3]) || item.height || 10;

      const token: PdfToken = { text: text.trim(), x, y, w, h, page: pageNum };
      pageTokens.push(token);
      allTokens.push(token);
    }

    // Group tokens into rows by y-proximity
    const rows = groupTokensIntoRows(pageTokens, pageNum);
    tables.push({ pageNumber: pageNum, rows });

    // Build plain text for this page
    for (const row of rows) {
      plainTextParts.push(row.cells.map(c => c.text).join('\t'));
    }
    plainTextParts.push(''); // page separator
  }

  // Merge rows across all pages
  const allRows: PdfRow[] = [];
  for (const table of tables) {
    allRows.push(...table.rows);
  }

  return {
    tables,
    allRows,
    plainText: plainTextParts.join('\n'),
    tokensCount: allTokens.length,
    pageCount,
  };
}

// ─── Row grouping ─────────────────────────────────────────────────────────────

function groupTokensIntoRows(tokens: PdfToken[], pageNumber: number): PdfRow[] {
  if (tokens.length === 0) return [];

  // Sort tokens by y (top to bottom), then by x (left to right)
  const sorted = [...tokens].sort((a, b) => a.y - b.y || a.x - b.x);

  const rowBuckets: PdfToken[][] = [];
  let currentBucket: PdfToken[] = [sorted[0]];
  let currentY = sorted[0].y;

  for (let i = 1; i < sorted.length; i++) {
    const t = sorted[i];
    if (Math.abs(t.y - currentY) <= ROW_Y_THRESHOLD) {
      currentBucket.push(t);
    } else {
      rowBuckets.push(currentBucket);
      currentBucket = [t];
      currentY = t.y;
    }
  }
  rowBuckets.push(currentBucket);

  // Convert each bucket into a PdfRow with merged cells
  const rows: PdfRow[] = [];
  for (const bucket of rowBuckets) {
    // Sort by x within the row
    bucket.sort((a, b) => a.x - b.x);
    const cells = mergeTokensIntoCells(bucket);
    if (cells.length > 0) {
      const avgY = bucket.reduce((s, t) => s + t.y, 0) / bucket.length;
      rows.push({ y: avgY, cells, page: pageNumber });
    }
  }

  return rows;
}

// ─── Cell merging ─────────────────────────────────────────────────────────────

function mergeTokensIntoCells(tokens: PdfToken[]): PdfCell[] {
  if (tokens.length === 0) return [];

  const cells: PdfCell[] = [];
  let currentText = tokens[0].text;
  let currentX = tokens[0].x;
  let currentRight = tokens[0].x + tokens[0].w;

  for (let i = 1; i < tokens.length; i++) {
    const t = tokens[i];
    const gap = t.x - currentRight;

    if (gap <= CELL_GAP_THRESHOLD) {
      // Merge: append text with a space if there's a meaningful gap, otherwise no space
      currentText += (gap > 0.5 ? ' ' : '') + t.text;
      currentRight = Math.max(currentRight, t.x + t.w);
    } else {
      // Flush previous cell
      cells.push({ x: currentX, text: currentText.trim(), w: currentRight - currentX });
      currentText = t.text;
      currentX = t.x;
      currentRight = t.x + t.w;
    }
  }

  // Flush last cell
  cells.push({ x: currentX, text: currentText.trim(), w: currentRight - currentX });

  return cells;
}
