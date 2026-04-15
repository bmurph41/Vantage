import { Router, type Request, type Response, type NextFunction } from 'express';
import { eq, desc } from 'drizzle-orm';
import { db } from '../db';
import { marketplaceSources, marketplaceScrapeRuns } from '@shared/schema';
import { runScrape, listRecentRuns } from '../ingestion/scheduler';
import { getAdapterForScraperType } from '../ingestion/registry';

/**
 * Admin routes for triggering and inspecting marketplace ingestion runs.
 * Mounted at /api/admin/marketplace-ingestion in server/routes.ts.
 */

function requireAdminInline(req: Request, res: Response, next: NextFunction) {
  const role =
    (req as any).user?.role || (req as any).session?.user?.role;
  if (role !== 'admin') {
    return res
      .status(403)
      .json({ error: 'admin_required', message: 'Admin role required.' });
  }
  next();
}

export const marketplaceIngestionRouter = Router();

marketplaceIngestionRouter.use(requireAdminInline);

// GET /sources — list all marketplace sources
marketplaceIngestionRouter.get('/sources', async (_req: Request, res: Response) => {
  try {
    const sources = await db
      .select()
      .from(marketplaceSources)
      .orderBy(marketplaceSources.name);
    res.json({ sources });
  } catch (err) {
    console.error('[marketplace-ingestion] GET /sources failed:', err);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /sources/:sourceId/run — trigger a scrape for a source
marketplaceIngestionRouter.post(
  '/sources/:sourceId/run',
  async (req: Request, res: Response) => {
    try {
      const { sourceId } = req.params;
      const orgId =
        (req as any).user?.orgId ||
        (req as any).tenantId ||
        (req as any).orgId ||
        'system';

      const [source] = await db
        .select()
        .from(marketplaceSources)
        .where(eq(marketplaceSources.id, sourceId))
        .limit(1);

      if (!source) {
        return res.status(404).json({ error: 'source_not_found' });
      }
      if (!source.enabled) {
        return res
          .status(400)
          .json({ error: 'source_disabled', message: 'Source is not enabled.' });
      }

      const adapter = getAdapterForScraperType(source.scraperType);
      if (!adapter) {
        return res.status(400).json({
          error: 'no_adapter',
          message: `No adapter registered for scraperType='${source.scraperType}'`,
        });
      }

      const maxListings =
        typeof req.body?.maxListings === 'number' ? req.body.maxListings : undefined;

      const run = await runScrape(sourceId, adapter, { maxListings, orgId });
      res.json({ run });
    } catch (err) {
      console.error('[marketplace-ingestion] POST /sources/:id/run failed:', err);
      res.status(500).json({ error: 'internal_error' });
    }
  },
);

// GET /runs?sourceId=&limit=25
marketplaceIngestionRouter.get('/runs', async (req: Request, res: Response) => {
  try {
    const sourceId =
      typeof req.query.sourceId === 'string' ? req.query.sourceId : null;
    const limit = req.query.limit ? Number(req.query.limit) : 25;
    const runs = await listRecentRuns(sourceId, isFinite(limit) ? limit : 25);
    res.json({ runs });
  } catch (err) {
    console.error('[marketplace-ingestion] GET /runs failed:', err);
    res.status(500).json({ error: 'internal_error' });
  }
});

// GET /runs/:runId — single run detail
marketplaceIngestionRouter.get(
  '/runs/:runId',
  async (req: Request, res: Response) => {
    try {
      const { runId } = req.params;
      const [run] = await db
        .select()
        .from(marketplaceScrapeRuns)
        .where(eq(marketplaceScrapeRuns.id, runId))
        .limit(1);
      if (!run) {
        return res.status(404).json({ error: 'run_not_found' });
      }
      res.json({ run });
    } catch (err) {
      console.error('[marketplace-ingestion] GET /runs/:id failed:', err);
      res.status(500).json({ error: 'internal_error' });
    }
  },
);

export default marketplaceIngestionRouter;
