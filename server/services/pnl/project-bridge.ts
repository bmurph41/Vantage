// =============================================================================
// FILE: server/services/pnl/project-bridge.ts
//
// Bridge between the DocIntel workspace upload pipeline and the PNL parse
// pipeline. When a user clicks "Sync to Financial Model" in the workspace
// uploads UI, this service:
//
//   1. Reads the file from DocIntel's storage path
//   2. Creates / finds a pnlDocument record pointing to the same file
//   3. Creates a pnlJob and kicks off runPnlPipeline()
//   4. On pipeline completion, auto-promotes facts → modelingActuals
//
// Also exposes a manual promote function for re-syncing existing documents.
// =============================================================================

import path from 'path';
import fs from 'fs';
import { db } from '../../db';
import { pnlDocuments, pnlJobs } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { sha256File } from '../../utils/hash';
import { runPnlPipeline } from './parseOrchestrator';
import { promotePnlFactsToActuals, type PromoteResult } from './promote-to-actuals';
import { ensurePnlCanonicalItemsSeeded } from './canonical-seed';
import { pool } from '../../db';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface PnlImportRequest {
  orgId: string;
  modelingProjectId: string;
  /** DocIntel upload ID from the workspace uploads table */
  docIntelUploadId: string;
}

export interface PnlImportResult {
  jobId: string;
  documentId: string;
  status: 'processing' | 'completed' | 'failed';
  message: string;
}

export interface PnlPromoteRequest {
  orgId: string;
  modelingProjectId: string;
  /** Optional: only promote facts from this specific document */
  documentId?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Resolve DocIntel upload details using raw SQL (avoids ORM issues with RLS tables) */
async function getDocIntelUploadDetails(orgId: string, uploadId: string): Promise<{
  storagePath: string;
  originalFilename: string;
  mimeType: string;
  fileSize: number;
} | null> {
  try {
    const result = await (pool as any).query(
      `SELECT storage_path, original_name, mime_type, file_size
       FROM doc_intel_uploads
       WHERE id = $1 AND org_id = $2
       LIMIT 1`,
      [uploadId, orgId]
    );
    if (!result.rows || result.rows.length === 0) return null;
    const row = result.rows[0];
    return {
      storagePath: row.storage_path,
      originalFilename: row.original_name ?? 'document',
      mimeType: row.mime_type ?? 'application/octet-stream',
      fileSize: Number(row.file_size ?? 0),
    };
  } catch (e) {
    console.error('[PNL Bridge] Failed to query doc_intel_uploads:', (e as Error).message);
    return null;
  }
}

// ─── Core Bridge Functions ────────────────────────────────────────────────────

/**
 * Import a DocIntel workspace upload through the PNL pipeline.
 * Creates a pnlDocument + pnlJob, runs the pipeline in the background,
 * and auto-promotes facts to modelingActuals on completion.
 */
export async function importDocIntelToPnlPipeline(
  req: PnlImportRequest
): Promise<PnlImportResult> {
  const { orgId, modelingProjectId, docIntelUploadId } = req;

  // Step 1: Ensure canonical items are seeded for this org
  await ensurePnlCanonicalItemsSeeded(orgId);

  // Step 2: Get the file details from DocIntel
  const uploadDetails = await getDocIntelUploadDetails(orgId, docIntelUploadId);
  if (!uploadDetails) {
    throw new Error(`DocIntel upload ${docIntelUploadId} not found or inaccessible`);
  }

  const { storagePath, originalFilename, mimeType, fileSize } = uploadDetails;

  // Verify file exists on disk
  if (!storagePath || !fs.existsSync(storagePath)) {
    throw new Error(`File not found on disk: ${storagePath}`);
  }

  // Step 3: Get or create pnlDocument (deduped by SHA256)
  const sha = await sha256File(storagePath);

  let doc = await db.query.pnlDocuments.findFirst({
    where: and(
      eq(pnlDocuments.orgId, orgId),
      eq(pnlDocuments.sha256, sha)
    ),
  });

  if (!doc) {
    const [created] = await db
      .insert(pnlDocuments)
      .values({
        orgId,
        modelingProjectId,
        originalFilename,
        mimeType,
        byteSize: fileSize,
        sha256: sha,
        storagePath: path.resolve(storagePath),
        statementType: 'pnl',
        meta: { sourceUploadId: docIntelUploadId },
      })
      .returning();
    doc = created;
  } else {
    // Update project link if needed
    if (!doc.modelingProjectId) {
      await db
        .update(pnlDocuments)
        .set({ modelingProjectId })
        .where(eq(pnlDocuments.id, doc.id));
      doc = { ...doc, modelingProjectId };
    }
  }

  // Step 4: Create a new pnlJob
  const [job] = await db
    .insert(pnlJobs)
    .values({
      orgId,
      documentId: doc.id,
      status: 'queued',
      stage: 'ingest',
      retryCount: 0,
      lastError: {},
    })
    .returning();

  // Step 5: Run pipeline asynchronously — fire and forget from request context
  setImmediate(async () => {
    try {
      console.log(`[PNL Bridge] Starting pipeline for job ${job.id}`);
      await runPnlPipeline(job.id);
      console.log(`[PNL Bridge] Pipeline complete for job ${job.id}, promoting facts...`);
      const promoteResult = await promotePnlFactsToActuals(orgId, modelingProjectId, doc!.id);
      console.log(`[PNL Bridge] Promoted ${promoteResult.promoted} facts for job ${job.id}`);
    } catch (e) {
      console.error(`[PNL Bridge] Pipeline/promote failed for job ${job.id}:`, (e as Error).message);
    }
  });

  return {
    jobId: job.id,
    documentId: doc.id,
    status: 'processing',
    message: 'Pipeline started — results will be available in 15–60 seconds.',
  };
}

/**
 * Manually re-promote existing pnlFacts for a project to modelingActuals.
 * Use this when the user wants to refresh after reviewing/correcting line items.
 */
export async function manuallyPromotePnlFacts(
  req: PnlPromoteRequest
): Promise<PromoteResult> {
  const { orgId, modelingProjectId, documentId } = req;

  // Ensure canonical items are seeded
  await ensurePnlCanonicalItemsSeeded(orgId);

  return promotePnlFactsToActuals(orgId, modelingProjectId, documentId);
}

/**
 * Get a summary of pnlFacts stored for a project (for UI status display).
 */
export async function getPnlFactsSummaryForProject(
  orgId: string,
  modelingProjectId: string
): Promise<{
  documentCount: number;
  factCount: number;
  years: number[];
  lastProcessedAt: string | null;
}> {
  try {
    const result = await (pool as any).query(
      `SELECT 
        COUNT(DISTINCT d.id)::int AS document_count,
        COUNT(f.id)::int AS fact_count,
        ARRAY_AGG(DISTINCT f.fiscal_year ORDER BY f.fiscal_year) FILTER (WHERE f.fiscal_year IS NOT NULL) AS years,
        MAX(j.completed_at) AS last_processed_at
       FROM pnl_documents d
       LEFT JOIN pnl_facts f ON f.document_id = d.id
       LEFT JOIN pnl_jobs j ON j.document_id = d.id AND j.status = 'completed'
       WHERE d.org_id = $1 AND d.modeling_project_id = $2`,
      [orgId, modelingProjectId]
    );

    if (!result.rows || result.rows.length === 0) {
      return { documentCount: 0, factCount: 0, years: [], lastProcessedAt: null };
    }

    const row = result.rows[0];
    return {
      documentCount: row.document_count ?? 0,
      factCount: row.fact_count ?? 0,
      years: row.years ?? [],
      lastProcessedAt: row.last_processed_at ?? null,
    };
  } catch (e) {
    console.error('[PNL Bridge] Facts summary query failed:', (e as Error).message);
    return { documentCount: 0, factCount: 0, years: [], lastProcessedAt: null };
  }
}
