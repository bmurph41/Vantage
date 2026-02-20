import { db } from '../../db';
import { pnlDocuments } from '@shared/schema';
import { eq } from 'drizzle-orm';
import fs from 'fs/promises';
import path from 'path';

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

  if (doc.storagePath) {
    try {
      await fs.access(doc.storagePath);
      return doc.storagePath;
    } catch {}
  }

  if (!doc.fileData) {
    throw new Error(`[pnl-file-storage] File missing from disk AND database for ${documentId}. Must re-upload.`);
  }

  await fs.mkdir(RESTORE_DIR, { recursive: true });
  const ext = path.extname(doc.originalFilename || '') || '';
  const restoredPath = path.join(RESTORE_DIR, `restored-${documentId}${ext}`);
  const buffer = Buffer.from(doc.fileData, 'base64');
  await fs.writeFile(restoredPath, buffer);

  await db.update(pnlDocuments).set({ storagePath: restoredPath }).where(eq(pnlDocuments.id, documentId));
  console.log(`[pnl-file-storage] Restored ${documentId} → ${restoredPath} (${buffer.length} bytes)`);
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
    try {
      const buffer = await fs.readFile(doc.storagePath);
      return { buffer, filename: doc.originalFilename || `document-${documentId}`, mimeType: doc.mimeType || 'application/octet-stream' };
    } catch {}
  }

  throw new Error(`[pnl-file-storage] No file data for ${documentId}`);
}

export const pnlFileStorage = { persistToDb, ensureOnDisk, getFileBuffer };
