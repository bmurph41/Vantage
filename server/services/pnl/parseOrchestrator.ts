import { db } from '../../db';
import {
  pnlJobs,
  pnlParsedStatements,
  pnlDocuments,
  pnlReviewItems,
  type PnlJobStatus,
  type ParsedStatementPayload,
  type ParsedPeriod,
  type ParsedRow,
} from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { documentParser } from '../../document-parser';
import { parseColumnHeaderToPeriod, getYearPeriod } from './timeAlign';
import { normalizeLabel } from './mapping';
import { extractPdfTables, type PdfRow as ExtractedPdfRow, type PdfCell } from './pdfTableExtractor';
import { detectHeaderAndPeriods, type PeriodCell } from './periodDetect';
import { validateParsedStatement, type ValidationResult, type ValidationStatus } from './validate';
import * as XLSX from 'xlsx';
import fs from 'fs/promises';

const PARSER_VERSION = 'v2';

function nowISO() {
  return new Date().toISOString();
}

function log(jobId: string, ...args: any[]) {
  console.log(`[P&L Parser v2][${jobId}]`, ...args);
}

function parseMoney(x: any): number | null {
  if (x === null || x === undefined) return null;

  const s = String(x).trim();
  if (s === '' || /^(n\/?a|-{1,2})$/i.test(s)) return null;

  let neg = false;
  let cleaned = s;

  if (cleaned.startsWith('(') && cleaned.endsWith(')')) {
    neg = true;
    cleaned = cleaned.slice(1, -1);
  }

  cleaned = cleaned.replace(/[$,]/g, '');

  const num = parseFloat(cleaned);
  if (Number.isNaN(num)) return null;

  return neg ? -num : num;
}

/** Test whether a cell text looks like a number/money value */
function isNumericLike(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  // Matches: 123  1,234  1,234.56  $1,234  (1,234)  ($1,234.56)  -1234  etc.
  return /^[($-]?\$?\d[\d,]*\.?\d*\)?$/.test(t) || /^\([\d,$.\s]+\)$/.test(t);
}

// ─── PDF v2 parsing ────────────────────────────────────────────────────────────

interface PdfV2ParseResult {
  periods: ParsedPeriod[];
  rows: ParsedRow[];
  confidence: number;
  metrics: {
    parserVersion: string;
    strategy: string;
    periodsDetected: number;
    rowsExtracted: number;
    numericCellsExtracted: number;
    headerConfidence: number;
    headerRowIndex: number;
    pageCount: number;
    tokensCount: number;
  };
  rawExtraction: {
    headerRow?: { y: number; cells: Array<{ x: number; text: string }> };
    bodyRowsSample: Array<{
      y: number;
      page: number;
      label: string;
      cellXs: number[];
      rawCellTexts: string[];
    }>;
  };
}

async function parsePdfV2(
  filePath: string,
  yearHint?: number | null,
  jobId?: string
): Promise<PdfV2ParseResult> {
  const jid = jobId ?? 'unknown';
  log(jid, `Starting PDF v2 extraction: ${filePath}`);

  const extracted = await extractPdfTables(filePath);
  log(jid, `Extracted ${extracted.tokensCount} tokens across ${extracted.pageCount} page(s), ${extracted.allRows.length} raw rows`);

  // Detect header & periods
  const headerResult = detectHeaderAndPeriods(extracted.allRows, yearHint ?? undefined);
  log(jid, `Header detection: rowIndex=${headerResult.headerRowIndex}, periods=${headerResult.periods.length}, confidence=${headerResult.confidence.toFixed(2)}`);

  const periods = headerResult.periods;
  const periodCells = headerResult.periodCells;
  const headerRowIndex = headerResult.headerRowIndex;

  // Build column X map: sorted header X positions → periodIndex
  const headerXs = periodCells
    .slice()
    .sort((a, b) => a.x - b.x)
    .map((pc, idx) => ({ x: pc.x, w: pc.w, periodIndex: idx }));

  // Extract body rows
  const bodyRows = headerRowIndex >= 0
    ? extracted.allRows.slice(headerRowIndex + 1)
    : extracted.allRows;

  const parsedRows: ParsedRow[] = [];
  let numericCellsCount = 0;
  const rawBodySample: PdfV2ParseResult['rawExtraction']['bodyRowsSample'] = [];

  const pdfSectionKeywords: Record<string, ParsedRow['sectionHint']> = {
    'revenue': 'revenue', 'income': 'revenue', 'sales': 'revenue',
    'cost of goods sold': 'cogs', 'cost of goods': 'cogs', 'cogs': 'cogs', 'cost of sales': 'cogs',
    'operating expense': 'expense', 'operating expenses': 'expense', 'expenses': 'expense', 'overhead': 'expense',
    'payroll': 'payroll', 'wages': 'payroll', 'salaries': 'payroll', 'payroll expense': 'payroll', 'payroll expenses': 'payroll',
  };
  let pdfCurrentSection: ParsedRow['sectionHint'] = null;

  for (const row of bodyRows) {
    if (row.cells.length === 0) continue;

    // Find the label cell: leftmost non-numeric cell
    let labelCell: PdfCell | null = null;
    const numericCells: PdfCell[] = [];

    for (const cell of row.cells) {
      if (!labelCell && !isNumericLike(cell.text)) {
        labelCell = cell;
      } else if (isNumericLike(cell.text)) {
        numericCells.push(cell);
      }
    }

    // If no label found, check if first cell could be a label even if numeric-looking
    if (!labelCell && row.cells.length > 1) {
      // Use leftmost cell as label, rest as numeric
      labelCell = row.cells[0];
      numericCells.length = 0;
      for (let c = 1; c < row.cells.length; c++) {
        if (isNumericLike(row.cells[c].text)) {
          numericCells.push(row.cells[c]);
        }
      }
    }

    if (!labelCell) continue;

    const label = labelCell.text.trim();
    if (!label) continue;

    const lowerLabel = label.toLowerCase();

    // Skip section headers but track which section we're in
    if (numericCells.length === 0) {
      for (const [keyword, section] of Object.entries(pdfSectionKeywords)) {
        if (lowerLabel === keyword || lowerLabel.startsWith(keyword + ' ') || lowerLabel.endsWith(' ' + keyword) || lowerLabel === keyword + ':') {
          pdfCurrentSection = section as ParsedRow['sectionHint'];
          break;
        }
      }
      const upperOrColon = label === label.toUpperCase() || label.endsWith(':');
      if (upperOrColon) continue;
      if (/^total\b/i.test(label)) continue;
      if (/generated\s+sample|footnote|check:|page\s+\d|continuation|property:|note:/i.test(label)) continue;
      continue;
    }

    // Handle "TOTAL" rows — update section tracking then skip
    if (lowerLabel.startsWith('total ') || lowerLabel === 'total') {
      for (const [keyword] of Object.entries(pdfSectionKeywords)) {
        if (lowerLabel.includes(keyword)) {
          pdfCurrentSection = null;
          break;
        }
      }
      if (lowerLabel === 'gross profit' || lowerLabel.includes('gross margin')) {
        pdfCurrentSection = null;
      }
      continue;
    }

    // Align numeric cells to nearest header X
    const values: ParsedRow['values'] = [];

    for (const nc of numericCells) {
      const parsedValue = parseMoney(nc.text);
      if (parsedValue === null) continue;

      let bestPeriodIndex = 0;
      let bestDist = Infinity;

      if (headerXs.length > 0) {
        for (const hx of headerXs) {
          // Use center of header cell for better alignment
          const headerCenter = hx.x + (hx.w / 2);
          const cellCenter = nc.x + (nc.w / 2);
          const dist = Math.abs(cellCenter - headerCenter);
          if (dist < bestDist) {
            bestDist = dist;
            bestPeriodIndex = hx.periodIndex;
          }
        }
      }

      values.push({
        periodIndex: bestPeriodIndex,
        value: parsedValue,
        trace: {
          page: row.page,
          row: Math.round(row.y),
          col: Math.round(nc.x),
          raw: nc.text,
        },
      });
      numericCellsCount++;
    }

    if (values.length === 0) continue;

    // Deduplicate: if two values map to the same periodIndex, keep the one with larger absolute value
    const valuesByPeriod = new Map<number, ParsedRow['values'][0]>();
    for (const v of values) {
      const existing = valuesByPeriod.get(v.periodIndex);
      if (!existing || Math.abs(v.value ?? 0) > Math.abs(existing.value ?? 0)) {
        valuesByPeriod.set(v.periodIndex, v);
      }
    }
    const dedupedValues = Array.from(valuesByPeriod.values()).sort(
      (a, b) => a.periodIndex - b.periodIndex
    );

    parsedRows.push({
      label,
      normalizedLabel: normalizeLabel(label),
      values: dedupedValues,
      sectionHint: pdfCurrentSection,
      trace: {
        page: row.page,
        row: Math.round(row.y),
      },
    });

    // Keep a sample for extraction trace
    if (rawBodySample.length < 200) {
      rawBodySample.push({
        y: row.y,
        page: row.page,
        label,
        cellXs: numericCells.map(c => Math.round(c.x)),
        rawCellTexts: numericCells.map(c => c.text),
      });
    }
  }

  log(jid, `Extracted ${parsedRows.length} data rows, ${numericCellsCount} numeric cells`);

  // Build confidence
  let confidence = headerResult.confidence;
  if (parsedRows.length < 5) confidence *= 0.6;
  if (numericCellsCount < 10) confidence *= 0.7;
  confidence = Math.max(0, Math.min(1, confidence));

  const metrics = {
    parserVersion: PARSER_VERSION,
    strategy: 'pdfjs',
    periodsDetected: periods.length,
    rowsExtracted: parsedRows.length,
    numericCellsExtracted: numericCellsCount,
    headerConfidence: headerResult.confidence,
    headerRowIndex,
    pageCount: extracted.pageCount,
    tokensCount: extracted.tokensCount,
  };

  const headerRow = headerRowIndex >= 0
    ? {
        y: extracted.allRows[headerRowIndex].y,
        cells: extracted.allRows[headerRowIndex].cells.map(c => ({ x: Math.round(c.x), text: c.text })),
      }
    : undefined;

  return {
    periods,
    rows: parsedRows,
    confidence,
    metrics,
    rawExtraction: {
      headerRow,
      bodyRowsSample: rawBodySample,
    },
  };
}

// ─── Original XLSX parsing (unchanged) ──────────────────────────────────────

async function parseDocumentToStatement(
  documentId: string,
  storagePath: string,
  mimeType: string,
  yearHint?: number | null,
  jobId?: string
): Promise<ParsedStatementPayload & { _metrics?: PdfV2ParseResult['metrics']; _rawExtraction?: any }> {
  const periods: ParsedPeriod[] = [];
  const rows: ParsedRow[] = [];
  let confidence = 0.5;
  let vendorHint: string | null = null;
  let _metrics: PdfV2ParseResult['metrics'] | undefined;
  let _rawExtraction: any;

  try {
    if (mimeType === 'application/pdf') {
      // ─── V2: Deterministic PDF extraction ───────────────────────────
      const result = await parsePdfV2(storagePath, yearHint, jobId);
      periods.push(...result.periods);
      rows.push(...result.rows);
      confidence = result.confidence;
      _metrics = result.metrics;
      _rawExtraction = result.rawExtraction;

      // Fallback: if v2 returned nothing, try the legacy parser
      if (rows.length === 0) {
        log(jobId ?? '', 'V2 PDF parser returned 0 rows, falling back to legacy parser');
        try {
          const fileBuffer = await fs.readFile(storagePath);
          const pages = await documentParser.parseDocument({
            mimeType,
            storagePath,
          } as any);

          for (const page of pages) {
            const lines = page.content.split('\n').filter((l: string) => l.trim());
            for (let i = 0; i < lines.length; i++) {
              const line = lines[i];
              const parts = line.split(/\t|(?:\s{2,})/);
              if (parts.length >= 2) {
                const label = parts[0].trim();
                if (!label) continue;
                const values: ParsedRow['values'] = [];
                for (let j = 1; j < parts.length; j++) {
                  const parsedValue = parseMoney(parts[j]);
                  if (parsedValue !== null) {
                    values.push({
                      periodIndex: periods.length > 0 ? Math.min(j - 1, periods.length - 1) : 0,
                      value: parsedValue,
                      trace: { page: page.pageNumber, row: i + 1, col: j + 1, raw: parts[j] },
                    });
                  }
                }
                if (values.length > 0) {
                  rows.push({
                    label,
                    normalizedLabel: normalizeLabel(label),
                    values,
                    trace: { page: page.pageNumber, row: i + 1 },
                  });
                }
              }
            }
          }
          if (_metrics) {
            _metrics.strategy = 'fallback';
          }
          confidence = rows.length > 5 ? 0.4 : 0.2;
        } catch (fallbackErr) {
          log(jobId ?? '', 'Legacy fallback also failed:', fallbackErr);
        }
      }

      // Fallback period from yearHint
      if (periods.length === 0 && yearHint) {
        const { start, end } = getYearPeriod(yearHint);
        periods.push({
          label: `FY ${yearHint}`,
          start: start.toISOString(),
          end: end.toISOString(),
          type: 'year',
          year: yearHint,
          periodNo: 1,
        });
      }
    } else if (mimeType.includes('spreadsheet') || mimeType.includes('excel') || mimeType === 'text/csv') {
      // ─── XLSX / CSV parsing (unchanged from v1) ─────────────────────
      const fileBuffer = await fs.readFile(storagePath);
      const workbook = XLSX.read(fileBuffer, { type: 'buffer' });

      for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];

        if (jsonData.length < 2) continue;

        const headerRow = jsonData[0];

        for (let c = 1; c < headerRow.length; c++) {
          const header = String(headerRow[c] ?? '').trim();
          if (!header) continue;
          const period = parseColumnHeaderToPeriod(header, yearHint ?? undefined);
          if (period) {
            periods.push(period);
          }
        }

        if (periods.length === 0 && yearHint) {
          const { start, end } = getYearPeriod(yearHint);
          periods.push({
            label: `FY ${yearHint}`,
            start: start.toISOString(),
            end: end.toISOString(),
            type: 'year',
            year: yearHint,
            periodNo: 1,
          });
        }

        const sectionKeywords: Record<string, ParsedRow['sectionHint']> = {
          'revenue': 'revenue', 'income': 'revenue', 'sales': 'revenue',
          'cost of goods sold': 'cogs', 'cost of goods': 'cogs', 'cogs': 'cogs', 'cost of sales': 'cogs',
          'operating expense': 'expense', 'operating expenses': 'expense', 'expenses': 'expense', 'overhead': 'expense',
          'payroll': 'payroll', 'wages': 'payroll', 'salaries': 'payroll', 'payroll expense': 'payroll', 'payroll expenses': 'payroll',
        };
        let currentSection: ParsedRow['sectionHint'] = null;

        for (let r = 1; r < jsonData.length; r++) {
          const rowData = jsonData[r];
          const label = String(rowData[0] ?? '').trim();

          if (!label) continue;

          const lowerLabel = label.toLowerCase();

          const hasNumericValues = rowData.slice(1).some((v: any) => parseMoney(v) !== null);
          if (!hasNumericValues) {
            for (const [keyword, section] of Object.entries(sectionKeywords)) {
              if (lowerLabel === keyword || lowerLabel.startsWith(keyword + ' ') || lowerLabel.endsWith(' ' + keyword)) {
                currentSection = section as ParsedRow['sectionHint'];
                break;
              }
            }
          }

          if (lowerLabel.startsWith('total ') || lowerLabel === 'total') {
            for (const [keyword] of Object.entries(sectionKeywords)) {
              if (lowerLabel.includes(keyword)) {
                currentSection = null;
                break;
              }
            }
            continue;
          }

          if (lowerLabel.includes('total') && !lowerLabel.includes('subtotal')) continue;
          if (/^={2,}$/.test(label) || /^-{2,}$/.test(label)) continue;

          if (lowerLabel === 'gross profit' || lowerLabel === 'gross margin') {
            currentSection = null;
            continue;
          }

          const values: ParsedRow['values'] = [];

          for (let c = 1; c < rowData.length && c - 1 < periods.length; c++) {
            const rawValue = rowData[c];
            const parsedValue = parseMoney(rawValue);

            values.push({
              periodIndex: c - 1,
              value: parsedValue,
              trace: {
                page: workbook.SheetNames.indexOf(sheetName) + 1,
                row: r + 1,
                col: c + 1,
                raw: String(rawValue ?? ''),
              },
            });
          }

          if (values.some(v => v.value !== null)) {
            rows.push({
              label,
              normalizedLabel: normalizeLabel(label),
              values,
              sectionHint: currentSection,
              trace: {
                page: workbook.SheetNames.indexOf(sheetName) + 1,
                row: r + 1,
              },
            });
          }
        }

        if (sheetName.toLowerCase().includes('quickbook')) {
          vendorHint = 'quickbooks';
        }

        break;
      }

      confidence = rows.length > 0 ? 0.75 : 0.3;
    }
  } catch (error) {
    console.error(`[P&L Parser][${jobId}] Error parsing document:`, error);
    throw error;
  }

  return {
    jobId: '',
    documentId,
    parserVersion: PARSER_VERSION,
    confidence,
    vendorHint,
    periods,
    rows,
    _metrics,
    _rawExtraction,
  };
}

// ─── Job processing ─────────────────────────────────────────────────────────

export async function processPnlJob(jobId: string): Promise<void> {
  const job = await db.query.pnlJobs.findFirst({ where: eq(pnlJobs.id, jobId) });
  if (!job) throw new Error(`Job not found: ${jobId}`);

  const existingParsed = await db.query.pnlParsedStatements.findFirst({
    where: eq(pnlParsedStatements.jobId, jobId),
  });
  if (existingParsed) return;

  await db
    .update(pnlJobs)
    .set({ status: 'processing' as PnlJobStatus, stage: 'parse', updatedAt: new Date() })
    .where(eq(pnlJobs.id, jobId));

  try {
    const doc = await db.query.pnlDocuments.findFirst({
      where: eq(pnlDocuments.id, job.documentId),
    });
    if (!doc) throw new Error(`Document not found: ${job.documentId}`);

    log(jobId, `Parsing document ${doc.id}, mime=${doc.mimeType}`);

    const parsed = await parseDocumentToStatement(
      doc.id,
      doc.storagePath,
      doc.mimeType,
      doc.yearHint,
      jobId
    );

    if (!parsed.periods.length && !parsed.rows.length) {
      throw new Error('Parser returned empty payload - no periods or rows detected');
    }

    parsed.jobId = jobId;

    // Extract internal metadata before storing
    const metrics = (parsed as any)._metrics;
    const rawExtraction = (parsed as any)._rawExtraction;

    // Store raw extraction trace in parsedJson for debugging
    const parsedJsonToStore: any = {
      ...parsed,
      rawExtraction: rawExtraction ?? null,
    };
    // Remove internal underscore fields
    delete parsedJsonToStore._metrics;
    delete parsedJsonToStore._rawExtraction;

    await db.insert(pnlParsedStatements).values({
      orgId: job.orgId,
      documentId: job.documentId,
      jobId: job.id,
      parsedJson: parsedJsonToStore,
      confidence: String(parsed.confidence ?? 0),
    });

    // ─── Write parse metrics to pnlJobs ───────────────────────────────
    const metricsToStore = metrics ?? {
      parserVersion: PARSER_VERSION,
      strategy: doc.mimeType === 'application/pdf' ? 'pdfjs' : 'xlsx',
      periodsDetected: parsed.periods.length,
      rowsExtracted: parsed.rows.length,
      numericCellsExtracted: parsed.rows.reduce((s, r) => s + r.values.filter(v => v.value !== null).length, 0),
      headerConfidence: parsed.confidence,
      pageCount: 1,
      tokensCount: 0,
    };

    // ─── Run validation ───────────────────────────────────────────────
    const validation = validateParsedStatement(parsed);
    log(jobId, `Validation: ${validation.status} — ${validation.summary}`);

    const jobUpdate: Record<string, any> = {
      status: 'parsed' as PnlJobStatus,
      stage: 'map',
      parserVersion: PARSER_VERSION,
      updatedAt: new Date(),
    };

    // Store metrics and validation as JSON — use try/catch in case columns don't exist yet
    try {
      jobUpdate.parseMetricsJson = metricsToStore;
    } catch { /* column may not exist */ }
    try {
      jobUpdate.validationJson = { status: validation.status, checks: validation.checks, summary: validation.summary };
      jobUpdate.validationStatus = validation.status;
    } catch { /* column may not exist */ }

    // If validation FAIL → force needs_review
    if (validation.status === 'fail') {
      jobUpdate.status = 'needs_review' as PnlJobStatus;
      jobUpdate.stage = 'review';

      // Insert a __VALIDATION__ review item
      try {
        await db.insert(pnlReviewItems).values({
          orgId: job.orgId,
          jobId: job.id,
          documentId: job.documentId,
          extractedLabel: '__VALIDATION__',
          normalizedLabel: '__validation__',
          status: 'needs_review',
          confidence: '0',
          suggestionJson: {
            reason: 'validation',
            validation: {
              status: validation.status,
              checks: validation.checks,
              summary: validation.summary,
            },
          },
        });
        log(jobId, 'Created __VALIDATION__ review item');
      } catch (reviewErr) {
        log(jobId, 'Warning: could not insert __VALIDATION__ review item:', reviewErr);
      }
    }

    await db
      .update(pnlJobs)
      .set(jobUpdate)
      .where(eq(pnlJobs.id, jobId));
  } catch (err: any) {
    await db
      .update(pnlJobs)
      .set({
        status: 'failed' as PnlJobStatus,
        stage: 'parse',
        retryCount: (job.retryCount ?? 0) + 1,
        lastError: {
          at: nowISO(),
          message: err?.message ?? String(err),
          stack: err?.stack ?? null,
        },
        updatedAt: new Date(),
      })
      .where(eq(pnlJobs.id, jobId));
    throw err;
  }
}

// ─── Pipeline orchestrator ──────────────────────────────────────────────────

export async function runPnlPipeline(jobId: string): Promise<{ status: string; storedCount?: number; reviewCount?: number }> {
  const { mapParsedStatement } = await import('./mapping');
  const { storeMappedFacts } = await import('./ingest');

  try {
    await processPnlJob(jobId);

    // Check if validation forced needs_review (skip mapping in that case)
    const jobAfterParse = await db.query.pnlJobs.findFirst({ where: eq(pnlJobs.id, jobId) });
    if (jobAfterParse?.status === 'needs_review') {
      log(jobId, 'Validation FAIL — skipping mapping, job stays in needs_review');
      return { status: 'needs_review', reviewCount: 1 };
    }

    const { reviewCount } = await mapParsedStatement(jobId);
    const { storedCount } = await storeMappedFacts(jobId);

    if (reviewCount === 0) {
      await db
        .update(pnlJobs)
        .set({
          status: 'completed' as PnlJobStatus,
          stage: 'done',
          completedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(pnlJobs.id, jobId));

      return { status: 'completed', storedCount, reviewCount };
    } else {
      await db
        .update(pnlJobs)
        .set({
          status: 'stored' as PnlJobStatus,
          stage: 'review',
          updatedAt: new Date(),
        })
        .where(eq(pnlJobs.id, jobId));

      return { status: 'needs_review', storedCount, reviewCount };
    }
  } catch (err: any) {
    await db
      .update(pnlJobs)
      .set({
        status: 'failed' as PnlJobStatus,
        stage: 'pipeline',
        lastError: { message: err?.message ?? String(err), stack: err?.stack ?? null },
        updatedAt: new Date(),
      })
      .where(eq(pnlJobs.id, jobId));

    return { status: 'failed' };
  }
}
