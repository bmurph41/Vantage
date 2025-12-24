import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { z } from 'zod';
import { db } from '../../db';
import {
  pnlDocuments,
  pnlJobs,
  pnlParsedStatements,
  pnlReviewItems,
  pnlFacts,
  pnlLineItemAliases,
  pnlCanonicalLineItems,
} from '@shared/schema';
import { sha256File } from '../../utils/hash';
import { eq, and, desc } from 'drizzle-orm';
import { runPnlPipeline } from './parseOrchestrator';
import { mapParsedStatement, normalizeLabel } from './mapping';
import { storeMappedFacts } from './ingest';

const router = Router();

const uploadDir = process.env.UPLOAD_DIR ?? './uploads/pnl';
fs.mkdirSync(uploadDir, { recursive: true });

const upload = multer({
  dest: uploadDir,
  limits: { fileSize: (Number(process.env.MAX_UPLOAD_MB ?? 100) || 100) * 1024 * 1024 },
});

function getAuthContext(req: any) {
  const orgId = req.user?.organizationId ?? req.headers['x-org-id'] ?? 'org-1';
  const userId = req.user?.id ?? req.headers['x-user-id'] ?? 'user-1';
  return { orgId: String(orgId), userId: String(userId) };
}

router.post('/upload', upload.single('file'), async (req: any, res) => {
  try {
    const { orgId, userId } = getAuthContext(req);

    const schema = z.object({
      assetId: z.string().optional(),
      modelingProjectId: z.string().optional(),
      statementType: z.string().optional().default('pnl'),
      yearHint: z.coerce.number().int().optional(),
    });

    const parsedBody = schema.safeParse(req.body);
    if (!parsedBody.success) {
      return res.status(400).json({ error: parsedBody.error.flatten() });
    }

    const f = req.file;
    if (!f) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const sha = await sha256File(f.path);
    const storagePath = path.resolve(f.path);

    let doc = await db.query.pnlDocuments.findFirst({
      where: and(eq(pnlDocuments.orgId, orgId), eq(pnlDocuments.sha256, sha)),
    });

    if (!doc) {
      const [created] = await db
        .insert(pnlDocuments)
        .values({
          orgId,
          assetId: parsedBody.data.assetId ?? null,
          modelingProjectId: parsedBody.data.modelingProjectId ?? null,
          uploadedByUserId: userId,
          originalFilename: f.originalname,
          mimeType: f.mimetype,
          byteSize: f.size,
          sha256: sha,
          storagePath,
          statementType: parsedBody.data.statementType ?? 'pnl',
          yearHint: parsedBody.data.yearHint ?? null,
          meta: {},
        })
        .returning();
      doc = created;
    }

    const [job] = await db
      .insert(pnlJobs)
      .values({
        orgId,
        assetId: doc.assetId ?? null,
        documentId: doc.id,
        status: 'queued',
        stage: 'ingest',
        parserVersion: 'v1',
        mapperVersion: 'v1',
      })
      .returning();

    runPnlPipeline(job.id).catch(err => {
      console.error(`P&L pipeline failed for job ${job.id}:`, err);
    });

    res.json({ documentId: doc.id, jobId: job.id });
  } catch (error: any) {
    console.error('P&L upload error:', error);
    res.status(500).json({ error: error.message ?? 'Upload failed' });
  }
});

router.get('/jobs/:jobId', async (req: any, res) => {
  try {
    const { orgId } = getAuthContext(req);
    const jobId = String(req.params.jobId);

    const job = await db.query.pnlJobs.findFirst({
      where: and(eq(pnlJobs.id, jobId), eq(pnlJobs.orgId, orgId)),
    });

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    const reviewItems = await db.query.pnlReviewItems.findMany({
      where: and(eq(pnlReviewItems.jobId, jobId), eq(pnlReviewItems.status, 'needs_review')),
    });

    res.json({ job, reviewNeedsCount: reviewItems.length });
  } catch (error: any) {
    console.error('Get job error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/jobs/:jobId/parsed', async (req: any, res) => {
  try {
    const { orgId } = getAuthContext(req);
    const jobId = String(req.params.jobId);

    const parsed = await db.query.pnlParsedStatements.findFirst({
      where: and(eq(pnlParsedStatements.jobId, jobId), eq(pnlParsedStatements.orgId, orgId)),
    });

    if (!parsed) {
      return res.status(404).json({ error: 'Parsed statement not found' });
    }

    res.json(parsed.parsedJson);
  } catch (error: any) {
    console.error('Get parsed error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/jobs/:jobId/review', async (req: any, res) => {
  try {
    const { orgId } = getAuthContext(req);
    const jobId = String(req.params.jobId);

    const items = await db.query.pnlReviewItems.findMany({
      where: and(eq(pnlReviewItems.jobId, jobId), eq(pnlReviewItems.orgId, orgId)),
    });

    res.json({ items });
  } catch (error: any) {
    console.error('Get review items error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/jobs/:jobId/remap', async (req: any, res) => {
  try {
    const { orgId, userId } = getAuthContext(req);
    const jobId = String(req.params.jobId);

    const schema = z.object({
      extractedLabel: z.string().min(1),
      canonicalLineItemId: z.string(),
      saveAsAlias: z.boolean().optional().default(true),
    });

    const parsedBody = schema.safeParse(req.body);
    if (!parsedBody.success) {
      return res.status(400).json({ error: parsedBody.error.flatten() });
    }

    const { extractedLabel, canonicalLineItemId, saveAsAlias } = parsedBody.data;
    const normalized = normalizeLabel(extractedLabel);

    if (saveAsAlias) {
      await db.insert(pnlLineItemAliases).values({
        orgId,
        aliasText: normalized,
        canonicalLineItemId,
        weight: 25,
      }).onConflictDoNothing();
    }

    await db
      .update(pnlReviewItems)
      .set({ 
        status: 'approved', 
        resolvedBy: userId,
        updatedAt: new Date() 
      })
      .where(
        and(
          eq(pnlReviewItems.jobId, jobId),
          eq(pnlReviewItems.orgId, orgId),
          eq(pnlReviewItems.normalizedLabel, normalized)
        )
      );

    const parsed = await db.query.pnlParsedStatements.findFirst({
      where: eq(pnlParsedStatements.jobId, jobId),
    });

    if (parsed) {
      const pj = parsed.parsedJson as any;
      for (const row of pj.rows ?? []) {
        if (row.normalizedLabel === normalized || normalizeLabel(row.label) === normalized) {
          row.mapping = {
            canonicalLineItemId,
            mappingMethod: 'manual',
            mappingConfidence: 1.0,
            normalizedLabel: normalized,
          };
        }
      }
      await db
        .update(pnlParsedStatements)
        .set({ parsedJson: pj })
        .where(eq(pnlParsedStatements.id, parsed.id));
    }

    await storeMappedFacts(jobId);

    const remainingReview = await db.query.pnlReviewItems.findMany({
      where: and(eq(pnlReviewItems.jobId, jobId), eq(pnlReviewItems.status, 'needs_review')),
    });

    if (remainingReview.length === 0) {
      await db
        .update(pnlJobs)
        .set({ status: 'completed', stage: 'done', completedAt: new Date(), updatedAt: new Date() })
        .where(eq(pnlJobs.id, jobId));
    }

    res.json({ ok: true, remainingReviewCount: remainingReview.length });
  } catch (error: any) {
    console.error('Remap error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/facts', async (req: any, res) => {
  try {
    const { orgId } = getAuthContext(req);

    const schema = z.object({
      assetId: z.string().optional(),
      modelingProjectId: z.string().optional(),
      fiscalYear: z.coerce.number().int().optional(),
      periodType: z.enum(['month', 'quarter', 'year']).optional(),
    });

    const parsedQ = schema.safeParse(req.query);
    if (!parsedQ.success) {
      return res.status(400).json({ error: parsedQ.error.flatten() });
    }

    const { assetId, fiscalYear, periodType } = parsedQ.data;

    const rows = await db.query.pnlFacts.findMany({
      where: (t, { and: andOp, eq: eqOp }) =>
        andOp(
          eqOp(t.orgId, orgId),
          assetId ? eqOp(t.assetId, assetId) : undefined,
          fiscalYear ? eqOp(t.fiscalYear, fiscalYear) : undefined,
          periodType ? eqOp(t.periodType, periodType) : undefined
        ),
      limit: 5000,
      orderBy: [desc(pnlFacts.fiscalYear), desc(pnlFacts.fiscalPeriod)],
    });

    res.json({ rows });
  } catch (error: any) {
    console.error('Get facts error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/documents', async (req: any, res) => {
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
});

router.get('/canonical-items', async (req: any, res) => {
  try {
    const { orgId } = getAuthContext(req);

    const items = await db.query.pnlCanonicalLineItems.findMany({
      where: and(eq(pnlCanonicalLineItems.orgId, orgId), eq(pnlCanonicalLineItems.isActive, true)),
    });

    res.json({ items });
  } catch (error: any) {
    console.error('Get canonical items error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/canonical-items/seed', async (req: any, res) => {
  try {
    const { orgId } = getAuthContext(req);

    const DEFAULT_CANONICAL_ITEMS = [
      { section: 'revenue', department: 'Marina', canonicalKey: 'revenue.wet_slip', displayName: 'Wet Slip Revenue', sortOrder: 1 },
      { section: 'revenue', department: 'Marina', canonicalKey: 'revenue.dry_storage', displayName: 'Dry Storage Revenue', sortOrder: 2 },
      { section: 'revenue', department: 'Fuel', canonicalKey: 'revenue.fuel_sales', displayName: 'Fuel Sales', sortOrder: 3 },
      { section: 'revenue', department: 'Retail', canonicalKey: 'revenue.ship_store', displayName: 'Ship Store Sales', sortOrder: 4 },
      { section: 'revenue', department: 'Service', canonicalKey: 'revenue.boat_repairs', displayName: 'Boat Repairs & Service', sortOrder: 5 },
      { section: 'revenue', department: 'Marina', canonicalKey: 'revenue.launch_haul', displayName: 'Launch & Haul Fees', sortOrder: 6 },
      { section: 'revenue', department: 'Marina', canonicalKey: 'revenue.transient', displayName: 'Transient Dockage', sortOrder: 7 },
      { section: 'revenue', department: 'Marina', canonicalKey: 'revenue.other', displayName: 'Other Marina Income', sortOrder: 8 },
      { section: 'cogs', department: 'Fuel', canonicalKey: 'cogs.fuel', displayName: 'Fuel Cost', sortOrder: 1 },
      { section: 'cogs', department: 'Retail', canonicalKey: 'cogs.ship_store', displayName: 'Ship Store Cost', sortOrder: 2 },
      { section: 'cogs', department: 'Service', canonicalKey: 'cogs.parts', displayName: 'Parts & Materials Cost', sortOrder: 3 },
      { section: 'expense', department: 'General', canonicalKey: 'expense.insurance', displayName: 'Insurance', sortOrder: 1 },
      { section: 'expense', department: 'General', canonicalKey: 'expense.property_taxes', displayName: 'Property Taxes', sortOrder: 2 },
      { section: 'expense', department: 'General', canonicalKey: 'expense.utilities', displayName: 'Utilities', sortOrder: 3 },
      { section: 'expense', department: 'General', canonicalKey: 'expense.repairs', displayName: 'Repairs & Maintenance', sortOrder: 4 },
      { section: 'expense', department: 'General', canonicalKey: 'expense.marketing', displayName: 'Marketing & Advertising', sortOrder: 5 },
      { section: 'expense', department: 'General', canonicalKey: 'expense.professional', displayName: 'Professional Fees', sortOrder: 6 },
      { section: 'expense', department: 'General', canonicalKey: 'expense.office', displayName: 'Office & Administrative', sortOrder: 7 },
      { section: 'payroll', department: 'General', canonicalKey: 'payroll.wages', displayName: 'Wages & Salaries', sortOrder: 1 },
      { section: 'payroll', department: 'General', canonicalKey: 'payroll.taxes', displayName: 'Payroll Taxes', sortOrder: 2 },
      { section: 'payroll', department: 'General', canonicalKey: 'payroll.benefits', displayName: 'Employee Benefits', sortOrder: 3 },
    ];

    const existing = await db.query.pnlCanonicalLineItems.findMany({
      where: eq(pnlCanonicalLineItems.orgId, orgId),
    });

    if (existing.length > 0) {
      return res.json({ message: 'Canonical items already exist', count: existing.length });
    }

    await db.insert(pnlCanonicalLineItems).values(
      DEFAULT_CANONICAL_ITEMS.map(item => ({
        ...item,
        orgId,
        isActive: true,
      }))
    );

    res.json({ message: 'Seeded canonical items', count: DEFAULT_CANONICAL_ITEMS.length });
  } catch (error: any) {
    console.error('Seed canonical items error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
