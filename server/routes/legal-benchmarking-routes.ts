import { Router, Request, Response } from 'express';
import { db } from '../db';
import { legalDocuments, organizations, users, benchmarkAggregates } from '@shared/schema';
import { eq, desc, and, gte, sql } from 'drizzle-orm';
import { z } from 'zod';
import { logger } from '../lib/logger';

const router = Router();

const isDev = process.env.NODE_ENV !== 'production';

const MIN_COHORT_SIZE = parseInt(process.env.MIN_COHORT_SIZE || '10', 10);

const DOC_TYPE_MAP: Record<string, string> = {
  terms: 'TOS',
  privacy: 'PRIVACY',
  benchmarking: 'BENCHMARK_POLICY',
};

interface AuthenticatedRequest extends Request {
  user?: { id: string; orgId?: string; role?: string; };
  session?: any;
}

function getUserId(req: AuthenticatedRequest): string | null {
  return req.user?.id || req.session?.user?.id || req.session?.userId || req.session?.passport?.user?.id || null;
}

function getOrgId(req: AuthenticatedRequest): string | null {
  return req.user?.orgId || req.session?.user?.orgId || req.session?.orgId || null;
}

// GET /api/legal/:docType
router.get('/legal/:docType', async (req: Request, res: Response) => {
  try {
    const slug = req.params.docType;
    const mappedType = DOC_TYPE_MAP[slug];

    if (!mappedType) {
      return res.status(400).json({ error: `Invalid document type: ${slug}. Valid types: ${Object.keys(DOC_TYPE_MAP).join(', ')}` });
    }

    const result = await db
      .select()
      .from(legalDocuments)
      .where(eq(legalDocuments.docType, mappedType as any))
      .orderBy(desc(legalDocuments.effectiveAt))
      .limit(1);

    if (!result.length) {
      return res.status(404).json({ error: `No ${mappedType} document found` });
    }

    const doc = result[0];
    res.json({
      docType: doc.docType,
      version: doc.version,
      contentMd: doc.contentMd,
      effectiveAt: doc.effectiveAt,
    });
  } catch (error) {
    logger.error({ error }, 'Failed to fetch legal document');
    res.status(500).json({ error: 'Failed to fetch legal document' });
  }
});

// GET /api/benchmarking/settings
router.get('/benchmarking/settings', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = getUserId(req);
    const orgId = getOrgId(req);
    const effectiveUserId = userId || (isDev ? 'user-1' : null);
    const effectiveOrgId = orgId || (isDev ? 'org-1' : null);

    if (!effectiveUserId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    let benchmarkOptIn = true;
    if (effectiveOrgId) {
      try {
        const orgResult = await db
          .select({ benchmarkOptIn: organizations.benchmarkOptIn })
          .from(organizations)
          .where(eq(organizations.id, effectiveOrgId))
          .limit(1);
        if (orgResult.length) {
          benchmarkOptIn = orgResult[0].benchmarkOptIn;
        }
      } catch (e) {
        logger.warn({ error: e }, 'Failed to read org benchmark settings');
      }
    }

    let userFields: {
      benchmarkingOptOut: boolean;
      dataBenchmarkingConsent: boolean;
      consentTimestamp: Date | null;
      consentVersion: string | null;
    } = {
      benchmarkingOptOut: false,
      dataBenchmarkingConsent: false,
      consentTimestamp: null,
      consentVersion: null,
    };

    try {
      const userResult = await db
        .select({
          benchmarkingOptOut: users.benchmarkingOptOut,
          dataBenchmarkingConsent: users.dataBenchmarkingConsent,
          consentTimestamp: users.consentTimestamp,
          consentVersion: users.consentVersion,
        })
        .from(users)
        .where(eq(users.id, effectiveUserId))
        .limit(1);
      if (userResult.length) {
        userFields = userResult[0];
      }
    } catch (e) {
      logger.warn({ error: e }, 'Failed to read user benchmark fields');
    }

    res.json({
      benchmarkOptIn,
      ...userFields,
    });
  } catch (error) {
    logger.error({ error }, 'Failed to fetch benchmarking settings');
    res.status(500).json({ error: 'Failed to fetch benchmarking settings' });
  }
});

const updateBenchmarkSettingsSchema = z.object({
  benchmarkOptIn: z.boolean().optional(),
  benchmarkingOptOut: z.boolean().optional(),
});

// PATCH /api/benchmarking/settings
router.patch('/benchmarking/settings', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = getUserId(req);
    const orgId = getOrgId(req);
    const effectiveUserId = userId || (isDev ? 'user-1' : null);
    const effectiveOrgId = orgId || (isDev ? 'org-1' : null);

    if (!effectiveUserId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const parsed = updateBenchmarkSettingsSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid request body', details: parsed.error.errors });
    }

    const { benchmarkOptIn, benchmarkingOptOut } = parsed.data;

    if (benchmarkOptIn !== undefined && effectiveOrgId) {
      await db
        .update(organizations)
        .set({ benchmarkOptIn })
        .where(eq(organizations.id, effectiveOrgId));
    }

    if (benchmarkingOptOut !== undefined) {
      await db
        .update(users)
        .set({ benchmarkingOptOut })
        .where(eq(users.id, effectiveUserId));
    }

    res.json({ success: true });
  } catch (error) {
    logger.error({ error }, 'Failed to update benchmarking settings');
    res.status(500).json({ error: 'Failed to update benchmarking settings' });
  }
});

// POST /api/admin/benchmarks/rebuild
router.post('/admin/benchmarks/rebuild', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = getUserId(req);
    const effectiveUserId = userId || (isDev ? 'user-1' : null);

    if (!effectiveUserId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const userRole = req.user?.role || req.session?.user?.role;
    if (!isDev && userRole !== 'owner') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    logger.info({ userId: effectiveUserId }, 'Benchmark rebuild triggered');

    res.json({ message: 'Benchmark rebuild triggered', status: 'pending' });
  } catch (error) {
    logger.error({ error }, 'Failed to trigger benchmark rebuild');
    res.status(500).json({ error: 'Failed to trigger benchmark rebuild' });
  }
});

// GET /api/benchmarking/aggregates
router.get('/benchmarking/aggregates', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { metricKey, cohortKey, periodKey } = req.query;

    const conditions = [gte(benchmarkAggregates.cohortSize, MIN_COHORT_SIZE)];

    if (metricKey && typeof metricKey === 'string') {
      conditions.push(eq(benchmarkAggregates.metricKey, metricKey) as any);
    }
    if (cohortKey && typeof cohortKey === 'string') {
      conditions.push(eq(benchmarkAggregates.cohortKey, cohortKey) as any);
    }
    if (periodKey && typeof periodKey === 'string') {
      conditions.push(eq(benchmarkAggregates.periodKey, periodKey) as any);
    }

    const results = await db
      .select()
      .from(benchmarkAggregates)
      .where(and(...conditions));

    res.json(results);
  } catch (error) {
    logger.error({ error }, 'Failed to fetch benchmark aggregates');
    res.status(500).json({ error: 'Failed to fetch benchmark aggregates' });
  }
});

export default router;
