// Orchestrator for LOI/PSA/ASA contract parsing.
//
// Pipeline:
//   1. Ensure the cdd_documents row has parsed text (run DocumentParser if not).
//      Scanned PDFs hit the pdf-extractor Vision fallback.
//   2. Classify (Haiku). Persist document_class + confidence.
//   3. If classifier says loi/psa/asa → run extractContract (Opus 4.6).
//   4. Persist the extraction envelope to cdd_documents.contract_extraction.
//   5. Explode each extracted date into a contract_extracted_dates row.
//
// Run via setImmediate from the route handler — Vision on multi-page scanned
// contracts can take 30–90s, well past the proxy timeout. Status is polled
// through GET /api/dd/documents/:id/extract-contract/status.

import { eq } from 'drizzle-orm';
import { db } from '../../db.js';
import {
  cddDocuments,
  dealWorkspaces,
  contractExtractedDates,
  docPages,
  type CddDocument,
} from '../../../shared/schema.js';
import type { ContractExtractionSchema, ExtractionResult } from '../../../shared/extraction-schemas.js';
import { storage } from '../../storage.js';
import { documentParser } from '../../document-parser.js';
import { classifyDocument, type DocumentClass } from './claude-extractor.js';
import { extractContract } from './contract-extractor.js';

const CONTRACT_CLASSES: DocumentClass[] = ['loi', 'psa', 'asa'];

export interface ContractExtractionRunResult {
  documentClass: DocumentClass;
  extracted: boolean;
  datesCreated: number;
  error?: string;
}

export async function runContractExtraction(
  documentId: string,
  options: { forceReclassify?: boolean } = {},
): Promise<ContractExtractionRunResult> {
  const document = await storage.getCddDocument(documentId);
  if (!document) {
    throw new Error(`Document ${documentId} not found`);
  }

  await markExtracting(documentId);

  try {
    // Step 1 — make sure doc_pages are populated.
    if (document.parseStatus !== 'parsed') {
      const pages = await documentParser.parseDocument(document);
      await storage.deleteDocPagesForDocument(document.id);
      await storage.createDocPages(
        documentParser.createDocPageRecords(document.id, pages),
      );
      await storage.updateCddDocument(document.id, {
        parseStatus: 'parsed',
        parsedAt: new Date(),
        parseError: null,
      });
    }

    // Step 2 — load page text.
    const pages = await db
      .select({ pageNo: docPages.pageNo, text: docPages.text })
      .from(docPages)
      .where(eq(docPages.documentId, document.id))
      .orderBy(docPages.pageNo);

    if (pages.length === 0) {
      throw new Error('No parsed pages available');
    }

    const fullText = pages
      .map((p) => `--- PAGE ${p.pageNo} ---\n${p.text}`)
      .join('\n\n');
    const firstPage = pages[0].text ?? '';

    // Step 3 — classify (skip if already classified and forceReclassify is false).
    let documentClass: DocumentClass;
    let classConfidence: number;
    if (document.documentClass && !options.forceReclassify) {
      documentClass = document.documentClass as DocumentClass;
      classConfidence = document.documentClassConfidence ?? 0.5;
    } else {
      const classResult = await classifyDocument(firstPage, document.filename);
      documentClass = classResult.class;
      classConfidence = classResult.confidence;
      await db
        .update(cddDocuments)
        .set({
          documentClass,
          documentClassConfidence: classConfidence,
        })
        .where(eq(cddDocuments.id, document.id));
    }

    if (!CONTRACT_CLASSES.includes(documentClass)) {
      await markExtractFinished(documentId, null, 'parsed');
      return { documentClass, extracted: false, datesCreated: 0 };
    }

    // Step 4 — extract.
    const envelope = await extractContract(
      fullText,
      document.filename,
      documentClass as 'loi' | 'psa' | 'asa',
    );

    // Step 5 — persist envelope + explode dates.
    await db
      .update(cddDocuments)
      .set({
        contractExtraction: envelope as any,
        contractExtractStatus: 'parsed',
        contractExtractedAt: new Date(),
        contractExtractError: null,
      })
      .where(eq(cddDocuments.id, document.id));

    const workspaceId = await resolveWorkspaceId(document);
    const datesCreated = await upsertExtractedDates(document.id, workspaceId, envelope);

    return { documentClass, extracted: true, datesCreated };
  } catch (err: any) {
    const message = err?.message ?? 'Unknown contract-extraction error';
    await db
      .update(cddDocuments)
      .set({
        contractExtractStatus: 'failed',
        contractExtractError: message.slice(0, 2000),
      })
      .where(eq(cddDocuments.id, documentId));
    return {
      documentClass: 'unknown',
      extracted: false,
      datesCreated: 0,
      error: message,
    };
  }
}

async function markExtracting(documentId: string) {
  await db
    .update(cddDocuments)
    .set({
      contractExtractStatus: 'parsing',
      contractExtractError: null,
    })
    .where(eq(cddDocuments.id, documentId));
}

async function markExtractFinished(
  documentId: string,
  error: string | null,
  status: 'parsed' | 'failed',
) {
  await db
    .update(cddDocuments)
    .set({
      contractExtractStatus: status,
      contractExtractError: error,
      contractExtractedAt: status === 'parsed' ? new Date() : null,
    })
    .where(eq(cddDocuments.id, documentId));
}

async function resolveWorkspaceId(document: CddDocument): Promise<string | null> {
  const [workspace] = await db
    .select({ id: dealWorkspaces.id })
    .from(dealWorkspaces)
    .where(eq(dealWorkspaces.ddProjectId, document.projectId))
    .limit(1);
  return workspace?.id ?? null;
}

// Explodes the contract extraction envelope into contract_extracted_dates
// rows, one per field. Idempotent via ON CONFLICT on (document_id, field_key).
async function upsertExtractedDates(
  documentId: string,
  workspaceId: string | null,
  envelope: ExtractionResult<ContractExtractionSchema>,
): Promise<number> {
  const data = envelope.data ?? {};
  const confidences = envelope.confidence_scores ?? {};
  const refs = envelope.source_references ?? {};

  type Row = {
    fieldKey: string;
    fieldLabel: string;
    extractedDate: string | null;
    offsetDays: number | null;
    anchorField: string | null;
    confidence: number;
    sourcePage: number | null;
    sourceSnippet: string | null;
  };

  const rows: Row[] = [];

  const push = (
    key: string,
    label: string,
    value: string | null | undefined,
    offset: number | null = null,
    anchor: string | null = null,
    confidenceKey?: string,
  ) => {
    if (!value && offset == null) return;
    const cKey = confidenceKey ?? key;
    const ref = refs[cKey] ?? {};
    rows.push({
      fieldKey: key,
      fieldLabel: label,
      extractedDate: value ?? null,
      offsetDays: offset,
      anchorField: anchor,
      confidence: Number(confidences[cKey] ?? 0),
      sourcePage: typeof ref.page === 'number' ? ref.page : null,
      sourceSnippet: ref.snippet ?? null,
    });
  };

  const dates = data.dates ?? {};
  const money = data.money ?? {};

  push('effective_date', 'Effective Date', dates.effective_date ?? null, null, null, 'dates.effective_date');
  push(
    'earnest_money_deadline',
    'Earnest Money Deadline',
    money.earnest_money_deadline ?? null,
    null,
    null,
    'money.earnest_money_deadline',
  );
  push(
    'inspection_end',
    'Inspection / DD Period End',
    dates.inspection_end ?? null,
    dates.inspection_duration_days ?? null,
    dates.inspection_duration_days ? 'effective_date' : null,
    'dates.inspection_end',
  );
  push('financing_deadline', 'Financing Contingency', dates.financing_deadline ?? null, null, null, 'dates.financing_deadline');
  push('title_delivery', 'Title Commitment Delivery', dates.title_delivery ?? null, null, null, 'dates.title_delivery');
  push('title_objection', 'Title Objection Deadline', dates.title_objection ?? null, null, null, 'dates.title_objection');
  push('survey_delivery', 'Survey Delivery', dates.survey_delivery ?? null, null, null, 'dates.survey_delivery');
  push('survey_objection', 'Survey Objection Deadline', dates.survey_objection ?? null, null, null, 'dates.survey_objection');
  push('estoppel_delivery', 'Estoppel Delivery', dates.estoppel_delivery ?? null, null, null, 'dates.estoppel_delivery');
  push(
    'closing_date',
    'Closing Date',
    dates.closing_date ?? null,
    dates.closing_offset_days ?? null,
    dates.closing_offset_days ? 'effective_date' : null,
    'dates.closing_date',
  );

  if (rows.length === 0) return 0;

  for (const row of rows) {
    await db
      .insert(contractExtractedDates)
      .values({
        documentId,
        workspaceId,
        fieldKey: row.fieldKey,
        fieldLabel: row.fieldLabel,
        extractedDate: row.extractedDate,
        offsetDays: row.offsetDays,
        anchorField: row.anchorField,
        confidence: row.confidence,
        sourcePage: row.sourcePage,
        sourceSnippet: row.sourceSnippet,
        userStatus: 'pending',
      })
      .onConflictDoUpdate({
        target: [contractExtractedDates.documentId, contractExtractedDates.fieldKey],
        set: {
          extractedDate: row.extractedDate,
          offsetDays: row.offsetDays,
          anchorField: row.anchorField,
          confidence: row.confidence,
          sourcePage: row.sourcePage,
          sourceSnippet: row.sourceSnippet,
          updatedAt: new Date(),
        },
      });
  }

  return rows.length;
}
