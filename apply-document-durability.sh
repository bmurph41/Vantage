#!/usr/bin/env bash
set -euo pipefail

ROUTES="server/services/pnl/routes.ts"
ORCH="server/services/pnl/parseOrchestrator.ts"
STORAGE="server/services/pnl/pnl-file-storage.ts"

for f in "$ROUTES" "$ORCH"; do
  if [ ! -f "$f" ]; then
    echo "ERROR: $f not found. Run from project root."
    exit 1
  fi
done

echo "=== P&L Document Durability & Access Control ==="

# STEP 1: Create pnl-file-storage.ts
if [ -f "$STORAGE" ]; then
  echo "⚠ $STORAGE already exists — skipping"
else
cat > "$STORAGE" << 'STORAGE_EOF'
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
STORAGE_EOF
echo "✓ Created $STORAGE"
fi

# STEP 2: Patch routes.ts
echo "Patching $ROUTES ..."
cp "$ROUTES" "${ROUTES}.bak"

python3 << 'PYROUTES'
import sys
FILE = "server/services/pnl/routes.ts"
with open(FILE, "r") as f:
    content = f.read()

# 2a: Add import
FIND = """} from './department-verification-service';"""
REPL = """} from './department-verification-service';
import { pnlFileStorage } from './pnl-file-storage';"""
if FIND not in content:
    print("  ERROR 2a: import insertion point not found"); sys.exit(1)
content = content.replace(FIND, REPL, 1)
print("  ✓ 2a: Added pnlFileStorage import")

# 2b: Make modelingProjectId required
FIND = "      modelingProjectId: z.string().optional(),"
REPL = "      modelingProjectId: z.string().min(1, 'modelingProjectId is required'),"
if FIND not in content:
    print("  ERROR 2b: modelingProjectId schema not found"); sys.exit(1)
content = content.replace(FIND, REPL, 1)
print("  ✓ 2b: Made modelingProjectId required")

# 2c: Persist file to DB after upload
FIND = """    res.json({ documentId: doc.id, jobId: job.id });
  } catch (error: any) {
    console.error('P&L upload error:', error);
    res.status(500).json({ error: error.message ?? 'Upload failed' });"""
REPL = """    // Persist file bytes to DB for durable storage
    try {
      await pnlFileStorage.persistToDb(doc.id, storagePath);
    } catch (storageErr: any) {
      console.warn('[P&L Upload] Failed to persist file to DB:', storageErr.message);
    }

    res.json({ documentId: doc.id, jobId: job.id });
  } catch (error: any) {
    console.error('P&L upload error:', error);
    res.status(500).json({ error: error.message ?? 'Upload failed' });"""
if FIND not in content:
    print("  ERROR 2c: upload response block not found"); sys.exit(1)
content = content.replace(FIND, REPL, 1)
print("  ✓ 2c: Added file persistence on upload")

# 2d: User + project filtering on document listing
FIND = """router.get('/documents', async (req: any, res) => {
  try {
    const { orgId } = getAuthContext(req);

    const docs = await db.query.pnlDocuments.findMany({
      where: eq(pnlDocuments.orgId, orgId),
      orderBy: [desc(pnlDocuments.createdAt)],
      limit: 100,
    });

    res.json({ documents: docs });
  } catch (error: any) {
    console.error('Get documents error:', error);
    res.status(500).json({ error: error.message });
  }
});"""
REPL = """router.get('/documents', async (req: any, res) => {
  try {
    const { orgId, userId } = getAuthContext(req);
    const projectId = req.query.modelingProjectId as string | undefined;
    const myDocsOnly = req.query.mine === 'true';

    const conditions: any[] = [eq(pnlDocuments.orgId, orgId)];
    if (projectId) {
      conditions.push(eq(pnlDocuments.modelingProjectId, projectId));
    }
    if (myDocsOnly) {
      conditions.push(eq(pnlDocuments.uploadedByUserId, userId));
    }

    const docs = await db.query.pnlDocuments.findMany({
      where: and(...conditions),
      orderBy: [desc(pnlDocuments.createdAt)],
      limit: 100,
      columns: {
        fileData: false,
      },
    });

    res.json({ documents: docs });
  } catch (error: any) {
    console.error('Get documents error:', error);
    res.status(500).json({ error: error.message });
  }
});"""
if FIND not in content:
    print("  ERROR 2d: document listing not found"); sys.exit(1)
content = content.replace(FIND, REPL, 1)
print("  ✓ 2d: Added user + project filtering")

# 2e: New endpoints before export
FIND = "export default router;"
REPL = """
// ─── Download original file ───────────────────────────────────
router.get('/documents/:documentId/download', async (req: any, res) => {
  try {
    const { orgId } = getAuthContext(req);
    const documentId = String(req.params.documentId);
    const doc = await db.query.pnlDocuments.findFirst({
      where: and(eq(pnlDocuments.id, documentId), eq(pnlDocuments.orgId, orgId)),
    });
    if (!doc) return res.status(404).json({ error: 'Document not found' });
    const { buffer, filename, mimeType } = await pnlFileStorage.getFileBuffer(documentId);
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.length);
    res.send(buffer);
  } catch (error: any) {
    console.error('Download error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ─── Re-promote: rebuild actuals from existing pnlFacts ───────
router.post('/re-promote', async (req: any, res) => {
  try {
    const { orgId } = getAuthContext(req);
    const { modelingProjectId } = req.body;
    if (!modelingProjectId) return res.status(400).json({ error: 'modelingProjectId is required' });

    const { modelingActuals } = await import('@shared/schema');
    const { promotePnlFactsToActuals } = await import('./promote-to-actuals');

    await db.delete(modelingActuals)
      .where(and(
        eq(modelingActuals.modelingProjectId, modelingProjectId),
        eq(modelingActuals.dataSource, 'doc_intel')
      ));

    const result = await promotePnlFactsToActuals(orgId, modelingProjectId);
    res.json({
      ...result,
      message: result.promoted > 0
        ? `Successfully re-promoted ${result.promoted} line items`
        : 'No P&L facts found to promote. You may need to re-upload documents.',
    });
  } catch (error: any) {
    console.error('Re-promote error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ─── Re-parse: re-run pipeline from stored file ───────────────
router.post('/documents/:documentId/reparse', async (req: any, res) => {
  try {
    const { orgId } = getAuthContext(req);
    const documentId = String(req.params.documentId);
    const doc = await db.query.pnlDocuments.findFirst({
      where: and(eq(pnlDocuments.id, documentId), eq(pnlDocuments.orgId, orgId)),
    });
    if (!doc) return res.status(404).json({ error: 'Document not found' });

    await pnlFileStorage.ensureOnDisk(documentId);

    const [job] = await db
      .insert(pnlJobs)
      .values({
        orgId,
        assetId: doc.assetId ?? null,
        documentId: doc.id,
        status: 'queued',
        stage: 'ingest',
        parserVersion: 'v2',
        mapperVersion: 'v1',
      })
      .returning();

    runPnlPipeline(job.id).catch(err => {
      console.error(`P&L re-parse failed for job ${job.id}:`, err);
    });

    res.json({ documentId: doc.id, jobId: job.id, message: 'Re-parse started' });
  } catch (error: any) {
    console.error('Re-parse error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;"""
if FIND not in content:
    print("  ERROR 2e: export not found"); sys.exit(1)
content = content.replace(FIND, REPL, 1)
print("  ✓ 2e: Added download, re-promote, re-parse endpoints")

with open(FILE, "w") as f:
    f.write(content)
print(f"\n  Routes patched: {FILE}")
PYROUTES

# STEP 3: Patch parseOrchestrator.ts
echo ""
echo "Patching $ORCH ..."
cp "$ORCH" "${ORCH}.bak"

python3 << 'PYORCH'
import sys
FILE = "server/services/pnl/parseOrchestrator.ts"
with open(FILE, "r") as f:
    content = f.read()

FIND = "import fs from 'fs/promises';"
REPL = """import fs from 'fs/promises';
import { pnlFileStorage } from './pnl-file-storage';"""
if FIND not in content:
    print("  ERROR 3a: fs import not found"); sys.exit(1)
content = content.replace(FIND, REPL, 1)
print("  ✓ 3a: Added pnlFileStorage import")

FIND = """    log(jobId, `Parsing document ${doc.id}, mime=${doc.mimeType}`);

    const parsed = await parseDocumentToStatement(
      doc.id,
      doc.storagePath,
      doc.mimeType,
      doc.yearHint,
      jobId
    );"""
REPL = """    log(jobId, `Parsing document ${doc.id}, mime=${doc.mimeType}`);

    // Ensure file is on disk — auto-restores from DB if disk was wiped
    const resolvedPath = await pnlFileStorage.ensureOnDisk(doc.id);

    const parsed = await parseDocumentToStatement(
      doc.id,
      resolvedPath,
      doc.mimeType,
      doc.yearHint,
      jobId
    );"""
if FIND not in content:
    print("  ERROR 3b: parse call not found"); sys.exit(1)
content = content.replace(FIND, REPL, 1)
print("  ✓ 3b: Parse now auto-restores from DB")

with open(FILE, "w") as f:
    f.write(content)
print(f"\n  Orchestrator patched: {FILE}")
PYORCH

echo ""
echo "Done! Verify with: npx tsc --noEmit"
