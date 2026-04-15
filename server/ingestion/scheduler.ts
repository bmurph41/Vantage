import { eq, desc } from 'drizzle-orm';
import { db } from '../db';
import {
  marketplaceSources,
  marketplaceScrapeRuns,
  type MarketplaceSource,
  type MarketplaceScrapeRun,
} from '@shared/schema';
import type { ScraperAdapter, NormalizedListing } from './scrapers/base';
import { persistNormalizedListings } from './persistence';
import { getAdapterForScraperType } from './registry';

export interface RunScrapeOptions {
  maxListings?: number;
  sinceHours?: number;
  orgId?: string;
}

/**
 * Execute a scrape for a given source + adapter. Creates a marketplace_scrape_runs
 * row, calls the adapter, persists normalized listings, and updates both the
 * run row and the source row with success/failure metadata.
 */
export async function runScrape(
  sourceId: string,
  adapter: ScraperAdapter,
  options: RunScrapeOptions = {},
): Promise<MarketplaceScrapeRun> {
  const orgId = options.orgId || 'system';

  const [run] = await db
    .insert(marketplaceScrapeRuns)
    .values({
      sourceId,
      status: 'running',
      listingsFound: 0,
      listingsNew: 0,
      listingsUpdated: 0,
      listingsFailed: 0,
    })
    .returning();

  let finalRun: MarketplaceScrapeRun = run;

  try {
    const rawListings = await adapter.fetchListings({
      maxListings: options.maxListings,
      sinceHours: options.sinceHours,
    });

    const normalized: NormalizedListing[] = rawListings.map((r) =>
      adapter.normalize(r),
    );

    const persistResult = await persistNormalizedListings(
      normalized,
      sourceId,
      orgId,
    );

    const status: 'success' | 'partial' | 'failed' =
      persistResult.failed === 0
        ? 'success'
        : persistResult.inserted + persistResult.updated > 0
          ? 'partial'
          : 'failed';

    const finishedAt = new Date();

    const [updatedRun] = await db
      .update(marketplaceScrapeRuns)
      .set({
        finishedAt,
        status,
        listingsFound: rawListings.length,
        listingsNew: persistResult.inserted,
        listingsUpdated: persistResult.updated,
        listingsFailed: persistResult.failed,
      })
      .where(eq(marketplaceScrapeRuns.id, run.id))
      .returning();

    finalRun = updatedRun;

    // Update source-level counters.
    const [source] = await db
      .select()
      .from(marketplaceSources)
      .where(eq(marketplaceSources.id, sourceId))
      .limit(1);

    if (source) {
      const priorTotal = source.totalListingsIngested || 0;
      const newTotal = priorTotal + persistResult.inserted;

      // Compute a rolling success rate: weight 80% prior, 20% this run.
      const thisRunRate =
        rawListings.length === 0
          ? status === 'failed'
            ? 0
            : 100
          : ((persistResult.inserted + persistResult.updated) /
              rawListings.length) *
            100;
      const priorRate = source.successRate ? Number(source.successRate) : null;
      const blended =
        priorRate === null ? thisRunRate : priorRate * 0.8 + thisRunRate * 0.2;

      await db
        .update(marketplaceSources)
        .set({
          lastRunAt: finishedAt,
          lastSuccessAt: status !== 'failed' ? finishedAt : source.lastSuccessAt,
          totalListingsIngested: newTotal,
          successRate: blended.toFixed(2),
          updatedAt: finishedAt,
        })
        .where(eq(marketplaceSources.id, sourceId));
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[scheduler] runScrape failed for source ${sourceId}:`, msg);

    const [failedRun] = await db
      .update(marketplaceScrapeRuns)
      .set({
        finishedAt: new Date(),
        status: 'failed',
        errorMessage: msg,
      })
      .where(eq(marketplaceScrapeRuns.id, run.id))
      .returning();

    finalRun = failedRun;

    await db
      .update(marketplaceSources)
      .set({ lastRunAt: new Date(), updatedAt: new Date() })
      .where(eq(marketplaceSources.id, sourceId));
  }

  return finalRun;
}

/**
 * Look up all enabled marketplace sources and pair each with a concrete
 * adapter instance. Sources whose scraperType has no registered adapter
 * are skipped with a warning.
 */
export async function getAllEnabledAdapters(): Promise<
  { source: MarketplaceSource; adapter: ScraperAdapter }[]
> {
  const sources = await db
    .select()
    .from(marketplaceSources)
    .where(eq(marketplaceSources.enabled, true));

  const pairs: { source: MarketplaceSource; adapter: ScraperAdapter }[] = [];
  for (const source of sources) {
    const adapter = getAdapterForScraperType(source.scraperType);
    if (!adapter) {
      console.warn(
        `[scheduler] No adapter registered for scraperType='${source.scraperType}' (source=${source.name}); skipping`,
      );
      continue;
    }
    pairs.push({ source, adapter });
  }
  return pairs;
}

/**
 * Helper: fetch recent runs for a source (or all sources), newest first.
 */
export async function listRecentRuns(
  sourceId: string | null,
  limit: number = 25,
): Promise<MarketplaceScrapeRun[]> {
  const q = db
    .select()
    .from(marketplaceScrapeRuns)
    .orderBy(desc(marketplaceScrapeRuns.startedAt))
    .limit(limit);

  if (sourceId) {
    return await q.where(eq(marketplaceScrapeRuns.sourceId, sourceId));
  }
  return await q;
}
