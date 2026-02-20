import { Router, Request, Response } from 'express';
import { db } from '../db';
import { eq, and, desc, asc, inArray, sql } from 'drizzle-orm';
import {
  taxonomyPacks,
  coaProfitCenters,
  coaSubCenters,
  coaCanonicalAccounts,
  coaGlobalAliases,
  coaUserAliases,
  coaMappingRules,
  coaMappedLineItems,
  coaMappingAuditLog,
  docIntelExtractedItems,
  docIntelUploads,
} from '@shared/schema';
import {
  mapExtractedItems,
  persistMappingResults,
  overrideMapping,
  approveMapping,
  bulkApprove,
  getTaxonomyTree,
  getMappingQueue,
  invalidatePackCache,
} from '../services/coa-mapping-engine';

const router = Router();

function getAuthContext(req: Request): { userId: string; orgId: string } | null {
  const userId = (req as any).userId || (req as any).user?.id;
  const orgId = (req as any).orgId || (req as any).user?.orgId;
  if (!userId || !orgId) return null;
  return { userId, orgId };
}

async function verifyUploadOwnership(uploadId: string, orgId: string): Promise<boolean> {
  const [upload] = await db.select({ id: docIntelUploads.id })
    .from(docIntelUploads)
    .where(and(eq(docIntelUploads.id, uploadId), eq(docIntelUploads.orgId, orgId)))
    .limit(1);
  return !!upload;
}

router.get('/api/coa-taxonomy/tree', async (_req: Request, res: Response) => {
  try {
    const tree = await getTaxonomyTree();
    res.json(tree);
  } catch (error: any) {
    console.error('[COA Taxonomy] Error fetching tree:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/api/coa-taxonomy/packs', async (_req: Request, res: Response) => {
  try {
    const packs = await db.select().from(taxonomyPacks).orderBy(desc(taxonomyPacks.createdAt));
    res.json(packs);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/api/coa-taxonomy/canonical-accounts', async (req: Request, res: Response) => {
  try {
    const { packId, statementType, profitCenterId } = req.query;
    let conditions = [];

    if (packId) conditions.push(eq(coaCanonicalAccounts.packId, packId as string));
    if (statementType) conditions.push(eq(coaCanonicalAccounts.statementType, statementType as any));
    if (profitCenterId) conditions.push(eq(coaCanonicalAccounts.profitCenterId, profitCenterId as string));

    const accounts = await db.select()
      .from(coaCanonicalAccounts)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(asc(coaCanonicalAccounts.sortOrder));

    res.json(accounts);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/api/coa-taxonomy/map-upload/:uploadId', async (req: Request, res: Response) => {
  try {
    const { uploadId } = req.params;
    const auth = getAuthContext(req);
    if (!auth) return res.status(401).json({ error: 'Authentication required' });

    const owns = await verifyUploadOwnership(uploadId, auth.orgId);
    if (!owns) return res.status(403).json({ error: 'Access denied' });

    const items = await db.select({ id: docIntelExtractedItems.id })
      .from(docIntelExtractedItems)
      .where(eq(docIntelExtractedItems.uploadId, uploadId));

    if (items.length === 0) {
      return res.json({ total: 0, autoMapped: 0, needsReview: 0, results: [] });
    }

    const itemIds = items.map(i => i.id);
    const batchResult = await mapExtractedItems(itemIds, auth.orgId, auth.userId);
    const persisted = await persistMappingResults(batchResult.results, auth.userId, auth.orgId);

    res.json({
      ...batchResult,
      persisted,
    });
  } catch (error: any) {
    console.error('[COA Taxonomy] Error mapping upload:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/api/coa-taxonomy/remap-upload/:uploadId', async (req: Request, res: Response) => {
  try {
    const { uploadId } = req.params;
    const auth = getAuthContext(req);
    if (!auth) return res.status(401).json({ error: 'Authentication required' });

    const owns = await verifyUploadOwnership(uploadId, auth.orgId);
    if (!owns) return res.status(403).json({ error: 'Access denied' });

    await db.delete(coaMappedLineItems)
      .where(
        inArray(
          coaMappedLineItems.extractedItemId,
          db.select({ id: docIntelExtractedItems.id })
            .from(docIntelExtractedItems)
            .where(eq(docIntelExtractedItems.uploadId, uploadId))
        )
      );

    const items = await db.select({ id: docIntelExtractedItems.id })
      .from(docIntelExtractedItems)
      .where(eq(docIntelExtractedItems.uploadId, uploadId));

    if (items.length === 0) {
      return res.json({ total: 0, autoMapped: 0, needsReview: 0, results: [] });
    }

    invalidatePackCache();
    const itemIds = items.map(i => i.id);
    const batchResult = await mapExtractedItems(itemIds, auth.orgId, auth.userId);
    const persisted = await persistMappingResults(batchResult.results, auth.userId, auth.orgId);

    res.json({ ...batchResult, persisted });
  } catch (error: any) {
    console.error('[COA Taxonomy] Error remapping upload:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/api/coa-taxonomy/mapping-queue', async (req: Request, res: Response) => {
  try {
    const auth = getAuthContext(req);
    if (!auth) return res.status(401).json({ error: 'Authentication required' });

    const { uploadId, status, limit, offset } = req.query;

    if (uploadId) {
      const owns = await verifyUploadOwnership(uploadId as string, auth.orgId);
      if (!owns) return res.status(403).json({ error: 'Access denied' });
    }

    const items = await getMappingQueue(
      uploadId as string | undefined,
      status as any,
      parseInt(limit as string) || 100,
      parseInt(offset as string) || 0,
    );
    res.json(items);
  } catch (error: any) {
    console.error('[COA Taxonomy] Error fetching queue:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/api/coa-taxonomy/approve/:mappedItemId', async (req: Request, res: Response) => {
  try {
    const auth = getAuthContext(req);
    if (!auth) return res.status(401).json({ error: 'Authentication required' });

    const { mappedItemId } = req.params;
    const { createAlias } = req.body || {};

    const result = await approveMapping(mappedItemId, auth.userId, auth.orgId, createAlias === true);
    res.json(result);
  } catch (error: any) {
    console.error('[COA Taxonomy] Error approving:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/api/coa-taxonomy/override', async (req: Request, res: Response) => {
  try {
    const auth = getAuthContext(req);
    if (!auth) return res.status(401).json({ error: 'Authentication required' });

    const { extractedItemId, canonicalAccountId, profitCenterId, subCenterId, createAlias } = req.body;

    if (!extractedItemId || !canonicalAccountId || !profitCenterId) {
      return res.status(400).json({ error: 'Missing required fields: extractedItemId, canonicalAccountId, profitCenterId' });
    }

    const result = await overrideMapping(
      extractedItemId,
      canonicalAccountId,
      profitCenterId,
      subCenterId || null,
      auth.userId,
      auth.orgId,
      createAlias === true,
    );

    res.json(result);
  } catch (error: any) {
    console.error('[COA Taxonomy] Error overriding:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/api/coa-taxonomy/bulk-approve', async (req: Request, res: Response) => {
  try {
    const auth = getAuthContext(req);
    if (!auth) return res.status(401).json({ error: 'Authentication required' });

    const { mappedItemIds } = req.body;

    if (!Array.isArray(mappedItemIds) || mappedItemIds.length === 0) {
      return res.status(400).json({ error: 'mappedItemIds must be a non-empty array' });
    }

    const approved = await bulkApprove(mappedItemIds, auth.userId, auth.orgId);
    res.json({ approved, total: mappedItemIds.length });
  } catch (error: any) {
    console.error('[COA Taxonomy] Error bulk approving:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/api/coa-taxonomy/aliases', async (req: Request, res: Response) => {
  try {
    const auth = getAuthContext(req);
    if (!auth) return res.status(401).json({ error: 'Authentication required' });

    const { scope } = req.query;

    if (scope === 'user') {
      const aliases = await db.select().from(coaUserAliases)
        .where(eq(coaUserAliases.orgId, auth.orgId))
        .orderBy(desc(coaUserAliases.createdAt));
      return res.json(aliases);
    }

    const [pack] = await db.select().from(taxonomyPacks)
      .where(and(eq(taxonomyPacks.assetClass, 'MARINA'), eq(taxonomyPacks.isActive, true)))
      .limit(1);

    if (!pack) return res.json([]);

    const aliases = await db.select().from(coaGlobalAliases)
      .where(eq(coaGlobalAliases.packId, pack.id))
      .orderBy(asc(coaGlobalAliases.rawLabel));

    res.json(aliases);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/api/coa-taxonomy/audit-log', async (req: Request, res: Response) => {
  try {
    const auth = getAuthContext(req);
    if (!auth) return res.status(401).json({ error: 'Authentication required' });

    const { extractedItemId, limit } = req.query;

    let conditions = [];
    conditions.push(eq(coaMappingAuditLog.orgId, auth.orgId));
    if (extractedItemId) {
      conditions.push(eq(coaMappingAuditLog.extractedItemId, extractedItemId as string));
    }

    const logs = await db.select().from(coaMappingAuditLog)
      .where(and(...conditions))
      .orderBy(desc(coaMappingAuditLog.createdAt))
      .limit(parseInt(limit as string) || 50);

    res.json(logs);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/api/coa-taxonomy/departmental-pl/:uploadId', async (req: Request, res: Response) => {
  try {
    const { uploadId } = req.params;
    const auth = getAuthContext(req);
    if (!auth) return res.status(401).json({ error: 'Authentication required' });

    const owns = await verifyUploadOwnership(uploadId, auth.orgId);
    if (!owns) return res.status(403).json({ error: 'Access denied' });

    const mappedItems = await db.select({
      mapping: coaMappedLineItems,
      extractedItem: docIntelExtractedItems,
      canonicalAccount: coaCanonicalAccounts,
      profitCenter: coaProfitCenters,
    })
      .from(coaMappedLineItems)
      .innerJoin(docIntelExtractedItems, eq(coaMappedLineItems.extractedItemId, docIntelExtractedItems.id))
      .innerJoin(coaCanonicalAccounts, eq(coaMappedLineItems.canonicalAccountId, coaCanonicalAccounts.id))
      .innerJoin(coaProfitCenters, eq(coaMappedLineItems.profitCenterId, coaProfitCenters.id))
      .where(eq(docIntelExtractedItems.uploadId, uploadId))
      .orderBy(asc(coaProfitCenters.sortOrder), asc(coaCanonicalAccounts.sortOrder));

    const result: Record<string, {
      profitCenter: { id: string; code: string; name: string };
      revenue: Array<{ accountCode: string; accountName: string; period: string | null; amount: string | null; confidence: string; method: string; status: string }>;
      cogs: Array<{ accountCode: string; accountName: string; period: string | null; amount: string | null; confidence: string; method: string; status: string }>;
      opex: Array<{ accountCode: string; accountName: string; period: string | null; amount: string | null; confidence: string; method: string; status: string }>;
      other: Array<{ accountCode: string; accountName: string; period: string | null; amount: string | null; confidence: string; method: string; status: string }>;
    }> = {};

    for (const { mapping, extractedItem, canonicalAccount, profitCenter } of mappedItems) {
      const pcId = profitCenter.id;
      if (!result[pcId]) {
        result[pcId] = {
          profitCenter: { id: profitCenter.id, code: profitCenter.code, name: profitCenter.name },
          revenue: [],
          cogs: [],
          opex: [],
          other: [],
        };
      }

      const lineItem = {
        accountCode: canonicalAccount.code,
        accountName: canonicalAccount.name,
        period: extractedItem.periodLabel,
        amount: extractedItem.amount,
        confidence: String(mapping.confidence),
        method: mapping.method,
        status: mapping.reviewedStatus,
      };

      const stType = canonicalAccount.statementType;
      if (stType === 'REVENUE') result[pcId].revenue.push(lineItem);
      else if (stType === 'COGS') result[pcId].cogs.push(lineItem);
      else if (stType === 'OPEX') result[pcId].opex.push(lineItem);
      else result[pcId].other.push(lineItem);
    }

    res.json({
      uploadId,
      profitCenters: Object.values(result),
      totalMapped: mappedItems.length,
    });
  } catch (error: any) {
    console.error('[COA Taxonomy] Error generating departmental P&L:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/api/coa-taxonomy/stats', async (req: Request, res: Response) => {
  try {
    const auth = getAuthContext(req);
    if (!auth) return res.status(401).json({ error: 'Authentication required' });

    const { uploadId } = req.query;

    if (uploadId) {
      const owns = await verifyUploadOwnership(uploadId as string, auth.orgId);
      if (!owns) return res.status(403).json({ error: 'Access denied' });
    }

    let statusCounts;
    if (uploadId) {
      statusCounts = await db.execute(sql`
        SELECT m.reviewed_status, COUNT(*) as count
        FROM coa_mapped_line_items m
        JOIN doc_intel_extracted_items e ON m.extracted_item_id = e.id
        JOIN doc_intel_uploads u ON e.upload_id = u.id
        WHERE e.upload_id = ${uploadId} AND u.org_id = ${auth.orgId}
        GROUP BY m.reviewed_status
      `);
    } else {
      statusCounts = await db.execute(sql`
        SELECT m.reviewed_status, COUNT(*) as count
        FROM coa_mapped_line_items m
        JOIN doc_intel_extracted_items e ON m.extracted_item_id = e.id
        JOIN doc_intel_uploads u ON e.upload_id = u.id
        WHERE u.org_id = ${auth.orgId}
        GROUP BY m.reviewed_status
      `);
    }

    const stats: Record<string, number> = {};
    for (const row of (statusCounts as any).rows || statusCounts || []) {
      stats[row.reviewed_status] = parseInt(row.count);
    }

    res.json({
      autoMapped: stats['AUTO_MAPPED'] || 0,
      needsReview: stats['NEEDS_REVIEW'] || 0,
      approved: stats['APPROVED'] || 0,
      overridden: stats['OVERRIDDEN'] || 0,
      total: Object.values(stats).reduce((a, b) => a + b, 0),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
