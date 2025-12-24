import { db } from '../../db';
import {
  pnlJobs,
  pnlParsedStatements,
  pnlDocuments,
  type PnlJobStatus,
  type ParsedStatementPayload,
  type ParsedPeriod,
  type ParsedRow,
} from '@shared/schema';
import { eq } from 'drizzle-orm';
import { documentParser } from '../../document-parser';
import { parseColumnHeaderToPeriod, getYearPeriod } from './timeAlign';
import { normalizeLabel } from './mapping';
import * as XLSX from 'xlsx';
import fs from 'fs/promises';

const PARSER_VERSION = 'v1';

function nowISO() {
  return new Date().toISOString();
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

async function parseDocumentToStatement(
  documentId: string,
  storagePath: string,
  mimeType: string,
  yearHint?: number | null
): Promise<ParsedStatementPayload> {
  const periods: ParsedPeriod[] = [];
  const rows: ParsedRow[] = [];
  let confidence = 0.5;
  let vendorHint: string | null = null;

  try {
    const fileBuffer = await fs.readFile(storagePath);
    
    if (mimeType.includes('spreadsheet') || mimeType.includes('excel') || mimeType === 'text/csv') {
      const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
      
      for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
        
        if (jsonData.length < 2) continue;
        
        const headerRow = jsonData[0];
        let periodStartCol = 1;
        
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
        
        for (let r = 1; r < jsonData.length; r++) {
          const rowData = jsonData[r];
          const label = String(rowData[0] ?? '').trim();
          
          if (!label) continue;
          
          const lowerLabel = label.toLowerCase();
          if (lowerLabel.includes('total') && !lowerLabel.includes('subtotal')) continue;
          if (/^={2,}$/.test(label) || /^-{2,}$/.test(label)) continue;
          
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
    } else if (mimeType === 'application/pdf') {
      const pages = await documentParser.parseDocument({
        mimeType,
        storagePath,
      } as any);
      
      for (const page of pages) {
        const lines = page.content.split('\n').filter(l => l.trim());
        
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
                  trace: {
                    page: page.pageNumber,
                    row: i + 1,
                    col: j + 1,
                    raw: parts[j],
                  },
                });
              }
            }
            
            if (values.length > 0) {
              rows.push({
                label,
                normalizedLabel: normalizeLabel(label),
                values,
                trace: {
                  page: page.pageNumber,
                  row: i + 1,
                },
              });
            }
          }
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
      
      confidence = rows.length > 5 ? 0.6 : 0.4;
    }
  } catch (error) {
    console.error('Error parsing document:', error);
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
  };
}

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

    const parsed = await parseDocumentToStatement(
      doc.id,
      doc.storagePath,
      doc.mimeType,
      doc.yearHint
    );

    if (!parsed.periods.length && !parsed.rows.length) {
      throw new Error('Parser returned empty payload - no periods or rows detected');
    }

    parsed.jobId = jobId;

    await db.insert(pnlParsedStatements).values({
      orgId: job.orgId,
      documentId: job.documentId,
      jobId: job.id,
      parsedJson: parsed,
      confidence: String(parsed.confidence ?? 0),
    });

    await db
      .update(pnlJobs)
      .set({ status: 'parsed' as PnlJobStatus, stage: 'map', updatedAt: new Date() })
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

export async function runPnlPipeline(jobId: string): Promise<{ status: string; storedCount?: number; reviewCount?: number }> {
  const { mapParsedStatement } = await import('./mapping');
  const { storeMappedFacts } = await import('./ingest');

  try {
    await processPnlJob(jobId);
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
