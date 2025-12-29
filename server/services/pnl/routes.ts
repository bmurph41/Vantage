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
  pnlKeywordRules,
  pnlDepartmentEnum,
  pnlBucketEnum,
} from '@shared/schema';
import { sha256File } from '../../utils/hash';
import { eq, and, desc, or, isNull, sql, asc, like } from 'drizzle-orm';
import { runPnlPipeline } from './parseOrchestrator';
import { mapParsedStatement, normalizeLabel, addToKeywordBank } from './mapping';
import { storeMappedFacts } from './ingest';
import { importKeywordBankFromExcel } from '../../scripts/importPnlKeywordBank';

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
      addToKeywordBank: z.boolean().optional().default(false),
      department: z.string().optional(),
      bucket: z.string().optional(),
    });

    const parsedBody = schema.safeParse(req.body);
    if (!parsedBody.success) {
      return res.status(400).json({ error: parsedBody.error.flatten() });
    }

    const { extractedLabel, canonicalLineItemId, saveAsAlias, addToKeywordBank: shouldAddToKeywordBank, department, bucket } = parsedBody.data;
    const normalized = normalizeLabel(extractedLabel);

    if (saveAsAlias) {
      await db.insert(pnlLineItemAliases).values({
        orgId,
        aliasText: normalized,
        canonicalLineItemId,
        weight: 25,
      }).onConflictDoNothing();
    }

    if (shouldAddToKeywordBank && department && bucket) {
      await addToKeywordBank(orgId, normalized, department, bucket, canonicalLineItemId);
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

router.get('/keyword-bank', async (req: any, res) => {
  try {
    const { orgId } = getAuthContext(req);

    const schema = z.object({
      department: z.string().optional(),
      bucket: z.string().optional(),
      search: z.string().optional(),
      includeGlobal: z.coerce.boolean().optional().default(true),
      limit: z.coerce.number().int().min(1).max(1000).optional().default(500),
    });

    const parsedQ = schema.safeParse(req.query);
    if (!parsedQ.success) {
      return res.status(400).json({ error: parsedQ.error.flatten() });
    }

    const { department, bucket, search, includeGlobal, limit } = parsedQ.data;

    let whereConditions: any[] = [];
    
    if (includeGlobal) {
      whereConditions.push(or(eq(pnlKeywordRules.orgId, orgId), isNull(pnlKeywordRules.orgId)));
    } else {
      whereConditions.push(eq(pnlKeywordRules.orgId, orgId));
    }

    if (department) {
      whereConditions.push(eq(pnlKeywordRules.department, department));
    }
    if (bucket) {
      whereConditions.push(eq(pnlKeywordRules.bucket, bucket));
    }

    const rules = await db.query.pnlKeywordRules.findMany({
      where: and(...whereConditions),
      orderBy: [asc(pnlKeywordRules.priority), desc(pnlKeywordRules.timesMatched)],
      limit,
    });

    let filteredRules = rules;
    if (search) {
      const searchLower = search.toLowerCase();
      filteredRules = rules.filter(r => r.keyword.toLowerCase().includes(searchLower));
    }

    const stats = {
      total: filteredRules.length,
      byDepartment: filteredRules.reduce((acc, r) => {
        acc[r.department] = (acc[r.department] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      byBucket: filteredRules.reduce((acc, r) => {
        acc[r.bucket] = (acc[r.bucket] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      bySource: filteredRules.reduce((acc, r) => {
        acc[r.source] = (acc[r.source] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
    };

    res.json({ rules: filteredRules, stats, departments: pnlDepartmentEnum, buckets: pnlBucketEnum });
  } catch (error: any) {
    console.error('Get keyword bank error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/keyword-bank', async (req: any, res) => {
  try {
    const { orgId } = getAuthContext(req);

    const schema = z.object({
      keyword: z.string().min(1),
      department: z.enum(pnlDepartmentEnum as [string, ...string[]]),
      bucket: z.enum(pnlBucketEnum as [string, ...string[]]),
      matchType: z.enum(['exact', 'phrase', 'token', 'regex']).optional().default('phrase'),
      priority: z.number().int().min(1).max(1000).optional().default(50),
      canonicalLineItemId: z.string().optional(),
    });

    const parsedBody = schema.safeParse(req.body);
    if (!parsedBody.success) {
      return res.status(400).json({ error: parsedBody.error.flatten() });
    }

    const { keyword, department, bucket, matchType, priority, canonicalLineItemId } = parsedBody.data;
    const normalizedKeyword = normalizeLabel(keyword);

    const existing = await db.query.pnlKeywordRules.findFirst({
      where: and(
        eq(pnlKeywordRules.orgId, orgId),
        eq(pnlKeywordRules.keyword, normalizedKeyword),
        eq(pnlKeywordRules.department, department),
        eq(pnlKeywordRules.bucket, bucket)
      ),
    });

    if (existing) {
      return res.status(409).json({ error: 'Keyword rule already exists', existingRule: existing });
    }

    const [created] = await db.insert(pnlKeywordRules).values({
      orgId,
      keyword: normalizedKeyword,
      department,
      bucket,
      matchType,
      priority,
      canonicalLineItemId: canonicalLineItemId ?? null,
      isActive: true,
      source: 'manual',
      timesMatched: 0,
    }).returning();

    res.json({ rule: created });
  } catch (error: any) {
    console.error('Create keyword rule error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.patch('/keyword-bank/:ruleId', async (req: any, res) => {
  try {
    const { orgId } = getAuthContext(req);
    const ruleId = String(req.params.ruleId);

    const schema = z.object({
      department: z.enum(pnlDepartmentEnum as [string, ...string[]]).optional(),
      bucket: z.enum(pnlBucketEnum as [string, ...string[]]).optional(),
      matchType: z.enum(['exact', 'phrase', 'token', 'regex']).optional(),
      priority: z.number().int().min(1).max(1000).optional(),
      isActive: z.boolean().optional(),
      canonicalLineItemId: z.string().nullable().optional(),
    });

    const parsedBody = schema.safeParse(req.body);
    if (!parsedBody.success) {
      return res.status(400).json({ error: parsedBody.error.flatten() });
    }

    const existingRule = await db.query.pnlKeywordRules.findFirst({
      where: and(eq(pnlKeywordRules.id, ruleId), eq(pnlKeywordRules.orgId, orgId)),
    });

    if (!existingRule) {
      return res.status(404).json({ error: 'Keyword rule not found or not editable (global rules cannot be edited)' });
    }

    const [updated] = await db
      .update(pnlKeywordRules)
      .set({ ...parsedBody.data, updatedAt: new Date() })
      .where(eq(pnlKeywordRules.id, ruleId))
      .returning();

    res.json({ rule: updated });
  } catch (error: any) {
    console.error('Update keyword rule error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.delete('/keyword-bank/:ruleId', async (req: any, res) => {
  try {
    const { orgId } = getAuthContext(req);
    const ruleId = String(req.params.ruleId);

    const existingRule = await db.query.pnlKeywordRules.findFirst({
      where: and(eq(pnlKeywordRules.id, ruleId), eq(pnlKeywordRules.orgId, orgId)),
    });

    if (!existingRule) {
      return res.status(404).json({ error: 'Keyword rule not found or not deletable (global rules cannot be deleted)' });
    }

    await db.delete(pnlKeywordRules).where(eq(pnlKeywordRules.id, ruleId));

    res.json({ ok: true });
  } catch (error: any) {
    console.error('Delete keyword rule error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/keyword-bank/import', upload.single('file'), async (req: any, res) => {
  try {
    const { orgId } = getAuthContext(req);
    const isGlobal = req.body.isGlobal === 'true';

    const f = req.file;
    if (!f) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const targetOrgId = isGlobal ? null : orgId;
    const result = await importKeywordBankFromExcel(f.path, targetOrgId);

    fs.unlinkSync(f.path);

    res.json({ 
      message: 'Keyword bank imported successfully',
      imported: result.imported,
      skipped: result.skipped,
    });
  } catch (error: any) {
    console.error('Import keyword bank error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/keyword-bank/seed-default', async (req: any, res) => {
  try {
    const { orgId } = getAuthContext(req);
    const isGlobal = req.body.isGlobal === true;

    const defaultKeywordBankPath = 'attached_assets/MarinaMatch_PnL_Keyword_Bank_SS3_2023_2024_1766584332411.xlsx';
    
    if (!fs.existsSync(defaultKeywordBankPath)) {
      return res.status(404).json({ error: 'Default keyword bank file not found' });
    }

    const targetOrgId = isGlobal ? null : orgId;
    const result = await importKeywordBankFromExcel(defaultKeywordBankPath, targetOrgId);

    res.json({
      message: 'Default keyword bank seeded successfully',
      imported: result.imported,
      skipped: result.skipped,
    });
  } catch (error: any) {
    console.error('Seed default keyword bank error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/marina/:marinaId', async (req: any, res) => {
  try {
    const { orgId } = getAuthContext(req);
    const marinaId = String(req.params.marinaId);

    const schema = z.object({
      from: z.string().optional(),
      to: z.string().optional(),
      periodType: z.enum(['month', 'quarter', 'year']).optional(),
      fiscalYear: z.coerce.number().int().optional(),
    });

    const parsedQ = schema.safeParse(req.query);
    if (!parsedQ.success) {
      return res.status(400).json({ error: parsedQ.error.flatten() });
    }

    const { from, to, periodType, fiscalYear } = parsedQ.data;

    const { getPnlForMarina } = await import('./aggregationService');

    const result = await getPnlForMarina(orgId, marinaId, {
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
      periodType,
      fiscalYear,
    });

    res.json(result);
  } catch (error: any) {
    console.error('Get marina P&L error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/marina/:marinaId/time-series', async (req: any, res) => {
  try {
    const { orgId } = getAuthContext(req);
    const marinaId = String(req.params.marinaId);

    const schema = z.object({
      fiscalYears: z.string().optional(),
      periodType: z.enum(['month', 'quarter', 'year']).optional(),
      sections: z.string().optional(),
    });

    const parsedQ = schema.safeParse(req.query);
    if (!parsedQ.success) {
      return res.status(400).json({ error: parsedQ.error.flatten() });
    }

    const { fiscalYears, periodType, sections } = parsedQ.data;

    const { getPnlTimeSeries } = await import('./aggregationService');

    const result = await getPnlTimeSeries(orgId, marinaId, {
      fiscalYears: fiscalYears ? fiscalYears.split(',').map(y => parseInt(y, 10)) : undefined,
      periodType,
      sections: sections ? sections.split(',') : undefined,
    });

    res.json(result);
  } catch (error: any) {
    console.error('Get marina time series error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/marina/:marinaId/comparison', async (req: any, res) => {
  try {
    const { orgId } = getAuthContext(req);
    const marinaId = String(req.params.marinaId);

    const schema = z.object({
      baseYear: z.coerce.number().int(),
      compareYear: z.coerce.number().int(),
      periodType: z.enum(['month', 'quarter', 'year']).optional(),
    });

    const parsedQ = schema.safeParse(req.query);
    if (!parsedQ.success) {
      return res.status(400).json({ error: parsedQ.error.flatten() });
    }

    const { baseYear, compareYear, periodType } = parsedQ.data;

    const { getPnlComparisonYoY } = await import('./aggregationService');

    const result = await getPnlComparisonYoY(orgId, marinaId, {
      baseYear,
      compareYear,
      periodType,
    });

    res.json(result);
  } catch (error: any) {
    console.error('Get marina comparison error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/documents/:documentId', async (req: any, res) => {
  try {
    const { orgId } = getAuthContext(req);
    const documentId = String(req.params.documentId);

    const doc = await db.query.pnlDocuments.findFirst({
      where: and(eq(pnlDocuments.id, documentId), eq(pnlDocuments.orgId, orgId)),
    });

    if (!doc) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const jobs = await db.query.pnlJobs.findMany({
      where: eq(pnlJobs.documentId, documentId),
      orderBy: [desc(pnlJobs.createdAt)],
    });

    const latestJob = jobs[0];
    let parsedStatement = null;
    let reviewItemsCount = 0;
    let factsCount = 0;

    if (latestJob) {
      parsedStatement = await db.query.pnlParsedStatements.findFirst({
        where: eq(pnlParsedStatements.jobId, latestJob.id),
      });

      const reviewItems = await db.query.pnlReviewItems.findMany({
        where: and(eq(pnlReviewItems.jobId, latestJob.id), eq(pnlReviewItems.status, 'needs_review')),
      });
      reviewItemsCount = reviewItems.length;

      const facts = await db.query.pnlFacts.findMany({
        where: eq(pnlFacts.documentId, documentId),
      });
      factsCount = facts.length;
    }

    res.json({
      document: doc,
      jobs,
      latestJob,
      parsedStatement: parsedStatement ? {
        id: parsedStatement.id,
        confidence: parsedStatement.confidence,
        periodCount: (parsedStatement.parsedJson as any)?.periods?.length ?? 0,
        rowCount: (parsedStatement.parsedJson as any)?.rows?.length ?? 0,
      } : null,
      reviewItemsCount,
      factsCount,
    });
  } catch (error: any) {
    console.error('Get document details error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/canonical-items/seed-marina', async (req: any, res) => {
  try {
    const { orgId } = getAuthContext(req);

    const { seedMarinaCoa, getCoaStats } = await import('../../scripts/seedMarinaCoa');

    const seedResult = await seedMarinaCoa(orgId);
    const stats = await getCoaStats(orgId);

    res.json({
      message: 'Marina COA seeded successfully',
      ...seedResult,
      stats,
    });
  } catch (error: any) {
    console.error('Seed marina COA error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/statements/:statementId/approve', async (req: any, res) => {
  try {
    const { orgId, userId } = getAuthContext(req);
    const statementId = String(req.params.statementId);

    const statement = await db.query.pnlParsedStatements.findFirst({
      where: and(eq(pnlParsedStatements.id, statementId), eq(pnlParsedStatements.orgId, orgId)),
    });

    if (!statement) {
      return res.status(404).json({ error: 'Statement not found' });
    }

    const job = await db.query.pnlJobs.findFirst({
      where: eq(pnlJobs.id, statement.jobId),
    });

    if (job) {
      await db
        .update(pnlJobs)
        .set({ 
          status: 'completed', 
          stage: 'approved',
          completedAt: new Date(),
          updatedAt: new Date() 
        })
        .where(eq(pnlJobs.id, job.id));

      await db
        .update(pnlReviewItems)
        .set({ status: 'approved', resolvedBy: userId, updatedAt: new Date() })
        .where(and(eq(pnlReviewItems.jobId, job.id), eq(pnlReviewItems.status, 'needs_review')));
    }

    res.json({ ok: true, message: 'Statement approved for modeling' });
  } catch (error: any) {
    console.error('Approve statement error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/statements/:statementId/lines', async (req: any, res) => {
  try {
    const { orgId } = getAuthContext(req);
    const statementId = String(req.params.statementId);

    const schema = z.object({
      groupBy: z.enum(['department', 'coa', 'none']).optional().default('none'),
      periodType: z.enum(['month', 'quarter', 'year']).optional(),
    });

    const parsedQ = schema.safeParse(req.query);
    if (!parsedQ.success) {
      return res.status(400).json({ error: parsedQ.error.flatten() });
    }

    const { groupBy } = parsedQ.data;

    const statement = await db.query.pnlParsedStatements.findFirst({
      where: and(eq(pnlParsedStatements.id, statementId), eq(pnlParsedStatements.orgId, orgId)),
    });

    if (!statement) {
      return res.status(404).json({ error: 'Statement not found' });
    }

    const pj = statement.parsedJson as any;
    const rows = pj.rows ?? [];
    const periods = pj.periods ?? [];

    if (groupBy === 'none') {
      return res.json({ rows, periods });
    }

    const canonicalItems = await db.query.pnlCanonicalLineItems.findMany({
      where: eq(pnlCanonicalLineItems.orgId, orgId),
    });
    const canonicalMap = new Map(canonicalItems.map(c => [c.id, c]));

    const grouped: Record<string, typeof rows> = {};
    for (const row of rows) {
      const canonicalId = row.mapping?.canonicalLineItemId;
      const canonical = canonicalId ? canonicalMap.get(canonicalId) : null;
      
      let groupKey = 'Uncategorized';
      if (groupBy === 'department' && canonical) {
        groupKey = canonical.department;
      } else if (groupBy === 'coa' && canonical) {
        groupKey = canonical.section;
      }

      if (!grouped[groupKey]) {
        grouped[groupKey] = [];
      }
      grouped[groupKey].push(row);
    }

    res.json({ grouped, periods });
  } catch (error: any) {
    console.error('Get statement lines error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
