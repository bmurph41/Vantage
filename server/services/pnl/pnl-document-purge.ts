import { db } from '../../db';
import {
  pnlDocuments,
  pnlJobs,
  pnlParsedStatements,
  pnlFacts,
  pnlReviewItems,
  modelingActuals,
  docIntelUploads,
  docIntelExtractedItems,
} from '@shared/schema';
import { eq, and, inArray } from 'drizzle-orm';
import fs from 'fs/promises';

export interface PurgeResult {
  pnlDocumentsDeleted: number;
  pnlJobsDeleted: number;
  pnlFactsDeleted: number;
  actualsDeleted: number;
  docIntelUploadsDeleted: number;
  filesRemoved: number;
  errors: string[];
}

export async function purgePnlDocument(documentId: string, orgId: string): Promise<Partial<PurgeResult>> {
  const result: Partial<PurgeResult> = { errors: [] };
  try {
    const facts = await db.select({ id: pnlFacts.id }).from(pnlFacts).where(eq(pnlFacts.documentId, documentId));
    const factIds = facts.map(f => f.id);

    if (factIds.length > 0) {
      await db.delete(modelingActuals).where(and(
        inArray(modelingActuals.sourceRecordId, factIds),
        eq(modelingActuals.dataSource, 'doc_intel')
      ));
      result.actualsDeleted = factIds.length;
    }

    await db.delete(pnlFacts).where(eq(pnlFacts.documentId, documentId));
    result.pnlFactsDeleted = factIds.length;

    const jobs = await db.select({ id: pnlJobs.id }).from(pnlJobs).where(eq(pnlJobs.documentId, documentId));
    const jobIds = jobs.map(j => j.id);

    if (jobIds.length > 0) {
      await db.delete(pnlParsedStatements).where(inArray(pnlParsedStatements.jobId, jobIds));
      try { await db.delete(pnlReviewItems).where(inArray(pnlReviewItems.jobId, jobIds)); } catch {}
    }

    await db.delete(pnlJobs).where(eq(pnlJobs.documentId, documentId));
    result.pnlJobsDeleted = jobIds.length;

    const doc = await db.query.pnlDocuments.findFirst({ where: eq(pnlDocuments.id, documentId) });
    await db.delete(pnlDocuments).where(eq(pnlDocuments.id, documentId));
    result.pnlDocumentsDeleted = 1;

    if (doc?.storagePath) {
      try { await fs.unlink(doc.storagePath); result.filesRemoved = 1; } catch {}
    }
  } catch (err: any) {
    result.errors!.push(err.message);
  }
  return result;
}

export async function purgeDocIntelUpload(uploadId: string, orgId: string, projectId: string): Promise<PurgeResult> {
  const result: PurgeResult = {
    pnlDocumentsDeleted: 0, pnlJobsDeleted: 0, pnlFactsDeleted: 0,
    actualsDeleted: 0, docIntelUploadsDeleted: 0, filesRemoved: 0, errors: [],
  };
  try {

    const [upload] = await db.select().from(docIntelUploads)
      .where(and(eq(docIntelUploads.id, uploadId), eq(docIntelUploads.orgId, orgId))).limit(1);

    if (!upload) { result.errors.push(`Upload ${uploadId} not found`); return result; }

    if (upload.hashSha256) {
      const matchingPnlDocs = await db.select({ id: pnlDocuments.id }).from(pnlDocuments)
        .where(and(eq(pnlDocuments.orgId, orgId), eq(pnlDocuments.sha256, upload.hashSha256)));

      for (const pnlDoc of matchingPnlDocs) {
        const sub = await purgePnlDocument(pnlDoc.id, orgId);
        result.pnlDocumentsDeleted += sub.pnlDocumentsDeleted || 0;
        result.pnlJobsDeleted += sub.pnlJobsDeleted || 0;
        result.pnlFactsDeleted += sub.pnlFactsDeleted || 0;
        result.actualsDeleted += sub.actualsDeleted || 0;
        result.filesRemoved += sub.filesRemoved || 0;
        if (sub.errors?.length) result.errors.push(...sub.errors);
      }
    }

    try { await db.delete(docIntelExtractedItems).where(eq(docIntelExtractedItems.uploadId, uploadId)); } catch {}

    await db.delete(docIntelUploads).where(and(eq(docIntelUploads.id, uploadId), eq(docIntelUploads.orgId, orgId)));
    result.docIntelUploadsDeleted = 1;

    if (upload.storagePath) {
      try { await fs.unlink(upload.storagePath); result.filesRemoved += 1; } catch {}
    }
  } catch (err: any) {
    result.errors.push(err.message);
  }
  return result;
}

export async function purgeAllPnlDataForProject(projectId: string, orgId: string): Promise<PurgeResult> {
  const result: PurgeResult = {
    pnlDocumentsDeleted: 0, pnlJobsDeleted: 0, pnlFactsDeleted: 0,
    actualsDeleted: 0, docIntelUploadsDeleted: 0, filesRemoved: 0, errors: [],
  };
  try {
    const docs = await db.select({ id: pnlDocuments.id }).from(pnlDocuments)
      .where(and(eq(pnlDocuments.orgId, orgId), eq(pnlDocuments.modelingProjectId, projectId)));

    for (const doc of docs) {
      const sub = await purgePnlDocument(doc.id, orgId);
      result.pnlDocumentsDeleted += sub.pnlDocumentsDeleted || 0;
      result.pnlJobsDeleted += sub.pnlJobsDeleted || 0;
      result.pnlFactsDeleted += sub.pnlFactsDeleted || 0;
      result.actualsDeleted += sub.actualsDeleted || 0;
      result.filesRemoved += sub.filesRemoved || 0;
      if (sub.errors?.length) result.errors.push(...sub.errors);
    }

    await db.delete(modelingActuals).where(and(
      eq(modelingActuals.modelingProjectId, projectId),
      eq(modelingActuals.dataSource, 'doc_intel')
    ));
  } catch (err: any) {
    result.errors.push(err.message);
  }
  return result;
}
