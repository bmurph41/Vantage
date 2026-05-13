import { db } from '../../db';
import { pnlDocuments } from '@shared/schema';
import { eq } from 'drizzle-orm';
import fs from 'fs/promises';
import path from 'path';
import {
  isObjectStorageKey,
  downloadDocIntelToBuffer,
} from '../../utils/doc-intel-storage';

const RESTORE_DIR = process.env.UPLOAD_DIR ?? './uploads/pnl';

export async function persistToDb(documentId: string, diskPath: string): Promise<void> {
  const buffer = await fs.readFile(diskPath);
  const base64 = buffer.toString('base64');
  await db
    .update(pnlDocuments)
    .set({ fileData: base64 })
    .where(eq(pnlDocuments.id, documentId));
  console.log(`[pnl-file-storage] Persisted ${documentId} to DB (${buffer.length} bytes)`);
}

export async function ensureOnDisk(documentId: string): Promise<string> {
  const doc = await db.query.pnlDocuments.findFirst({
    where: eq(pnlDocuments.id, documentId),
  });
  if (!doc) throw new Error(`[pnl-file-storage] Document not found: ${documentId}`);

  // 1. storagePath is a local file that exists — use it directly.
  if (doc.storagePath && !isObjectStorageKey(doc.storagePath)) {
    try {
      await fs.access(doc.storagePath);
      return doc.storagePath;
    } catch {}
  }

  await fs.mkdir(RESTORE_DIR, { recursive: true });
  const ext = path.extname(doc.originalFilename || '') || '';
  const restoredPath = path.join(RESTORE_DIR, `restored-${documentId}${ext}`);

  // 2. storagePath is an S3 key — download to RESTORE_DIR. Documents created
  //    via the doc-intel bridge (project-bridge.ts) land here.
  if (doc.storagePath && isObjectStorageKey(doc.storagePath)) {
    const buffer = await downloadDocIntelToBuffer(doc.storagePath);
    await fs.writeFile(restoredPath, buffer);
    console.log(`[pnl-file-storage] Downloaded ${documentId} from S3 → ${restoredPath} (${buffer.length} bytes)`);
    return restoredPath;
  }

  // 3. Last-resort: file body was persisted to DB on upload (legacy local-only
  //    flow). Restore from base64.
  if (!doc.fileData) {
    throw new Error(`[pnl-file-storage] File missing from disk, S3, AND database for ${documentId}. Must re-upload.`);
  }

  const buffer = Buffer.from(doc.fileData, 'base64');
  await fs.writeFile(restoredPath, buffer);

  await db.update(pnlDocuments).set({ storagePath: restoredPath }).where(eq(pnlDocuments.id, documentId));
  console.log(`[pnl-file-storage] Restored ${documentId} from DB → ${restoredPath} (${buffer.length} bytes)`);
  return restoredPath;
}

export async function getFileBuffer(documentId: string): Promise<{ buffer: Buffer; filename: string; mimeType: string }> {
  const doc = await db.query.pnlDocuments.findFirst({
    where: eq(pnlDocuments.id, documentId),
  });
  if (!doc) throw new Error(`[pnl-file-storage] Document not found: ${documentId}`);

  if (doc.fileData) {
    return {
      buffer: Buffer.from(doc.fileData, 'base64'),
      filename: doc.originalFilename || `document-${documentId}`,
      mimeType: doc.mimeType || 'application/octet-stream',
    };
  }

  if (doc.storagePath) {
    if (isObjectStorageKey(doc.storagePath)) {
      const buffer = await downloadDocIntelToBuffer(doc.storagePath);
      return {
        buffer,
        filename: doc.originalFilename || `document-${documentId}`,
        mimeType: doc.mimeType || 'application/octet-stream',
      };
    }
    try {
      const buffer = await fs.readFile(doc.storagePath);
      return { buffer, filename: doc.originalFilename || `document-${documentId}`, mimeType: doc.mimeType || 'application/octet-stream' };
    } catch {}
  }

  throw new Error(`[pnl-file-storage] No file data for ${documentId}`);
}

export const pnlFileStorage = { persistToDb, ensureOnDisk, getFileBuffer };
