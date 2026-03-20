/**
 * Document Version Routes
 *
 * Version history for VDR documents — list versions, compare metadata.
 */
import { Router, Request, Response } from 'express';
import { eq, and, desc, asc, sql } from 'drizzle-orm';

const router = Router();

async function getDb() {
  const { db } = await import('../db');
  return db;
}

async function getSchema() {
  return import('@shared/schema');
}

function getOrgId(req: Request): string | null {
  return (req as any).orgId || (req as any).user?.orgId || null;
}

// GET /documents/:documentId/versions — version history
router.get('/documents/:documentId/versions', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(400).json({ error: 'Organization required' });

    const { documentId } = req.params;
    const db = await getDb();
    const schema = await getSchema();

    // Get the document (may be a parent or child version)
    const [doc] = await db
      .select()
      .from(schema.vdrDocuments)
      .where(and(
        eq(schema.vdrDocuments.id, documentId),
        eq(schema.vdrDocuments.orgId, orgId),
      ))
      .limit(1);

    if (!doc) return res.status(404).json({ error: 'Document not found' });

    // Find the root parent
    const rootId = doc.parentDocumentId || doc.id;

    // Get all versions (parent + children)
    const versions = await db
      .select({
        id: schema.vdrDocuments.id,
        filename: schema.vdrDocuments.filename,
        originalFilename: schema.vdrDocuments.originalFilename,
        version: schema.vdrDocuments.version,
        isCurrentVersion: schema.vdrDocuments.isCurrentVersion,
        size: schema.vdrDocuments.size,
        mimeType: schema.vdrDocuments.mimeType,
        checksum: schema.vdrDocuments.checksum,
        uploadedBy: schema.vdrDocuments.uploadedBy,
        description: schema.vdrDocuments.description,
        aiSummary: schema.vdrDocuments.aiSummary,
        aiCategory: schema.vdrDocuments.aiCategory,
        createdAt: schema.vdrDocuments.createdAt,
      })
      .from(schema.vdrDocuments)
      .where(and(
        eq(schema.vdrDocuments.orgId, orgId),
        sql`(${schema.vdrDocuments.id} = ${rootId} OR ${schema.vdrDocuments.parentDocumentId} = ${rootId})`,
      ))
      .orderBy(desc(schema.vdrDocuments.version));

    // Get uploader info
    const uploaderIds = [...new Set(versions.map(v => v.uploadedBy))];
    let uploaderMap: Record<string, string> = {};
    if (uploaderIds.length > 0) {
      const usersResult = await db.execute(sql`
        SELECT id, COALESCE(first_name || ' ' || last_name, username, email, 'Unknown') as name
        FROM users WHERE id = ANY(${uploaderIds})
      `);
      for (const u of usersResult.rows as any[]) {
        uploaderMap[u.id] = u.name;
      }
    }

    const enrichedVersions = versions.map(v => ({
      ...v,
      uploadedByName: uploaderMap[v.uploadedBy] || 'Unknown',
    }));

    res.json({
      documentId: rootId,
      currentVersion: enrichedVersions.find(v => v.isCurrentVersion) || enrichedVersions[0],
      versions: enrichedVersions,
      totalVersions: enrichedVersions.length,
    });
  } catch (error) {
    console.error('Error fetching document versions:', error);
    res.status(500).json({ error: 'Failed to fetch document versions' });
  }
});

// GET /documents/:id1/compare/:id2 — compare two versions
router.get('/documents/:id1/compare/:id2', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(400).json({ error: 'Organization required' });

    const { id1, id2 } = req.params;
    const db = await getDb();
    const schema = await getSchema();

    const [doc1] = await db
      .select()
      .from(schema.vdrDocuments)
      .where(and(eq(schema.vdrDocuments.id, id1), eq(schema.vdrDocuments.orgId, orgId)))
      .limit(1);

    const [doc2] = await db
      .select()
      .from(schema.vdrDocuments)
      .where(and(eq(schema.vdrDocuments.id, id2), eq(schema.vdrDocuments.orgId, orgId)))
      .limit(1);

    if (!doc1 || !doc2) return res.status(404).json({ error: 'One or both documents not found' });

    // Build diff of metadata
    const diff = {
      filename: { v1: doc1.filename, v2: doc2.filename, changed: doc1.filename !== doc2.filename },
      size: { v1: doc1.size, v2: doc2.size, changed: doc1.size !== doc2.size },
      mimeType: { v1: doc1.mimeType, v2: doc2.mimeType, changed: doc1.mimeType !== doc2.mimeType },
      checksum: { v1: doc1.checksum, v2: doc2.checksum, changed: doc1.checksum !== doc2.checksum },
      aiCategory: { v1: doc1.aiCategory, v2: doc2.aiCategory, changed: doc1.aiCategory !== doc2.aiCategory },
      aiSummary: { v1: doc1.aiSummary, v2: doc2.aiSummary, changed: doc1.aiSummary !== doc2.aiSummary },
    };

    res.json({
      version1: { id: doc1.id, version: doc1.version, filename: doc1.filename, createdAt: doc1.createdAt },
      version2: { id: doc2.id, version: doc2.version, filename: doc2.filename, createdAt: doc2.createdAt },
      diff,
      contentChanged: doc1.checksum !== doc2.checksum,
    });
  } catch (error) {
    console.error('Error comparing document versions:', error);
    res.status(500).json({ error: 'Failed to compare versions' });
  }
});

export default router;
