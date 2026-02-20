#!/usr/bin/env bash
set -euo pipefail

PNL_ROUTES="server/services/pnl/routes.ts"
MAIN_ROUTES="server/routes.ts"
UPLOADS_UI="client/src/pages/modeling/projects/workspace/uploads.tsx"
PURGE_SVC="server/services/pnl/pnl-document-purge.ts"

echo "=== P&L Document Purge & Full Cascade Delete ==="

# STEP 1: Create purge service
cat > "$PURGE_SVC" << 'PURGE_EOF'
import { db } from '../../db';
import {
  pnlDocuments,
  pnlJobs,
  pnlParsedStatements,
  pnlFacts,
  pnlReviewItems,
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
      const { modelingActuals } = await import('@shared/schema');
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
    const { docIntelUploads, docIntelExtractedItems } = await import('@shared/schema');

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

    const { modelingActuals } = await import('@shared/schema');
    await db.delete(modelingActuals).where(and(
      eq(modelingActuals.modelingProjectId, projectId),
      eq(modelingActuals.dataSource, 'doc_intel')
    ));
  } catch (err: any) {
    result.errors.push(err.message);
  }
  return result;
}
PURGE_EOF
echo "✓ Created $PURGE_SVC"

# STEP 2: Patch pnl/routes.ts
echo "Patching $PNL_ROUTES ..."
cp "$PNL_ROUTES" "${PNL_ROUTES}.pre-purge.bak"

python3 << 'PY_PNL'
import sys
FILE = "server/services/pnl/routes.ts"
with open(FILE, "r") as f:
    content = f.read()

FIND = "import { pnlFileStorage } from './pnl-file-storage';"
REPL = """import { pnlFileStorage } from './pnl-file-storage';
import { purgePnlDocument, purgeAllPnlDataForProject } from './pnl-document-purge';"""
if FIND not in content:
    print("  ERROR: pnlFileStorage import not found"); sys.exit(1)
content = content.replace(FIND, REPL, 1)
print("  ✓ Added purge imports")

FIND_EXPORT = "export default router;"
NEW = """
router.delete('/documents/:documentId', async (req: any, res) => {
  try {
    const { orgId } = getAuthContext(req);
    const documentId = String(req.params.documentId);
    const doc = await db.query.pnlDocuments.findFirst({
      where: and(eq(pnlDocuments.id, documentId), eq(pnlDocuments.orgId, orgId)),
    });
    if (!doc) return res.status(404).json({ error: 'Document not found' });
    const result = await purgePnlDocument(documentId, orgId);
    res.json({ success: true, message: 'Document and all related data permanently deleted', ...result });
  } catch (error: any) {
    console.error('Delete document error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.delete('/projects/:projectId/purge', async (req: any, res) => {
  try {
    const { orgId } = getAuthContext(req);
    const projectId = String(req.params.projectId);
    const result = await purgeAllPnlDataForProject(projectId, orgId);
    res.json({ success: true, message: 'All P&L pipeline data purged for this project', ...result });
  } catch (error: any) {
    console.error('Purge project error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;"""
if FIND_EXPORT not in content:
    print("  ERROR: export not found"); sys.exit(1)
content = content.replace(FIND_EXPORT, NEW, 1)
print("  ✓ Added delete + purge endpoints")

with open(FILE, "w") as f:
    f.write(content)
print(f"  Patched: {FILE}")
PY_PNL

# STEP 3: Patch main routes.ts
echo ""
echo "Patching $MAIN_ROUTES ..."
cp "$MAIN_ROUTES" "${MAIN_ROUTES}.pre-purge.bak"

python3 << 'PY_MAIN'
import sys
FILE = "server/routes.ts"
with open(FILE, "r") as f:
    content = f.read()

FIND = """  app.delete('/api/modeling/projects/:projectId/documents/:uploadId', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { uploadId } = req.params;
      
      await docIntelService.deleteUpload(orgId, uploadId);
      res.json({ success: true });
    } catch (error: any) {
      console.error('Failed to delete document:', error);
      res.status(500).json({ error: 'Failed to delete document' });
    }
  });"""

REPL = """  app.delete('/api/modeling/projects/:projectId/documents/:uploadId', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { projectId, uploadId } = req.params;
      const purgeEntirely = req.query.purge === 'true';

      if (purgeEntirely) {
        const { purgeDocIntelUpload } = await import('./services/pnl/pnl-document-purge');
        const result = await purgeDocIntelUpload(uploadId, orgId, projectId);
        res.json({ success: true, purged: true, ...result });
      } else {
        await docIntelService.deleteUpload(orgId, uploadId);
        res.json({ success: true });
      }
    } catch (error: any) {
      console.error('Failed to delete document:', error);
      res.status(500).json({ error: 'Failed to delete document' });
    }
  });"""

if FIND not in content:
    print("  WARN: Could not find exact delete endpoint. Trying flexible match...")
    if "app.delete('/api/modeling/projects/:projectId/documents/:uploadId'" in content:
        print("  Found the route but code differs. Manual patch needed for main routes.")
        print("  SKIPPING (non-fatal)")
    else:
        print("  Route not found at all. SKIPPING (non-fatal)")
else:
    content = content.replace(FIND, REPL, 1)
    with open(FILE, "w") as f:
        f.write(content)
    print("  ✓ Enhanced delete with ?purge=true")
    print(f"  Patched: {FILE}")
PY_MAIN

# STEP 4: Patch uploads.tsx
echo ""
echo "Patching $UPLOADS_UI ..."
cp "$UPLOADS_UI" "${UPLOADS_UI}.pre-purge.bak"

python3 << 'PY_UI'
import sys
FILE = "client/src/pages/modeling/projects/workspace/uploads.tsx"
with open(FILE, "r") as f:
    content = f.read()

# 4a: Add purgeEntirely state
FIND = '  const [deleteConfirmName, setDeleteConfirmName] = useState<string>("");'
REPL = """  const [deleteConfirmName, setDeleteConfirmName] = useState<string>("");
  const [purgeEntirely, setPurgeEntirely] = useState(true);"""
if FIND not in content:
    print("  ERROR 4a: state not found"); sys.exit(1)
content = content.replace(FIND, REPL, 1)
print("  ✓ 4a: Added purgeEntirely state")

# 4b: Update mutation to pass purge param
FIND = "    mutationFn: (uploadId: string) => apiRequest('DELETE', `/api/modeling/projects/${projectId}/documents/${uploadId}`),"
REPL = "    mutationFn: (uploadId: string) => apiRequest('DELETE', `/api/modeling/projects/${projectId}/documents/${uploadId}?purge=${purgeEntirely}`),"
if FIND not in content:
    print("  ERROR 4b: mutationFn not found"); sys.exit(1)
content = content.replace(FIND, REPL, 1)
print("  ✓ 4b: Updated mutation with purge param")

# 4c: Reset purge state on success/error
FIND = """      setDeleteConfirmId(null);
      setDeleteConfirmName("");
    },
    onError: () => {
      setDeleteConfirmId(null);
      setDeleteConfirmName("");"""
REPL = """      setDeleteConfirmId(null);
      setDeleteConfirmName("");
      setPurgeEntirely(true);
    },
    onError: () => {
      setDeleteConfirmId(null);
      setDeleteConfirmName("");
      setPurgeEntirely(true);"""
if FIND not in content:
    print("  ERROR 4c: callbacks not found"); sys.exit(1)
content = content.replace(FIND, REPL, 1)
print("  ✓ 4c: Reset purge on close")

# 4d: Enhanced dialog
FIND = """            <AlertDialogDescription>
              Are you sure you want to delete "{deleteConfirmName}"? This action cannot be undone and will permanently remove the document and all its extracted data.
            </AlertDialogDescription>"""
REPL = """            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>Are you sure you want to delete &ldquo;{deleteConfirmName}&rdquo;? This action cannot be undone.</p>
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={purgeEntirely}
                    onChange={(e) => setPurgeEntirely(e.target.checked)}
                    className="mt-1 h-4 w-4 rounded border-gray-300"
                  />
                  <span className="text-sm">
                    <strong>Remove from platform entirely</strong> — deletes the document, all extracted financial data, P&amp;L facts, and related actuals. Re-uploading this file will be treated as a fresh upload.
                  </span>
                </label>
              </div>
            </AlertDialogDescription>"""
if FIND not in content:
    print("  ERROR 4d: dialog not found"); sys.exit(1)
content = content.replace(FIND, REPL, 1)
print("  ✓ 4d: Enhanced delete dialog with purge checkbox")

with open(FILE, "w") as f:
    f.write(content)
print(f"  Patched: {FILE}")
PY_UI

echo ""
echo "Done! Verify: npx tsc --noEmit"
