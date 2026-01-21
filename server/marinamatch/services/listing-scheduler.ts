import { db } from "../../db";
import { eq, and, lte, or, isNull, sql, desc } from "drizzle-orm";
import { marinaScrapeources, marinaScrapeRuns, marinaListings } from "@shared/schema";
import { scrapeSourceWithMultiPage, runScrapeJob } from "./cre-scraper";

const SCRAPE_INTERVAL_MS = 6 * 60 * 60 * 1000;
const MIN_SCRAPE_INTERVAL_MS = 60 * 60 * 1000;

let schedulerInterval: NodeJS.Timeout | null = null;
let startupTimeout: NodeJS.Timeout | null = null;
let isScrapingInProgress = false;

export interface SchedulerStatus {
  isRunning: boolean;
  isScrapingInProgress: boolean;
  lastCheckAt: Date | null;
  nextScheduledRun: Date | null;
  activeSources: number;
  totalListings: number;
}

let lastCheckAt: Date | null = null;
let schedulerStartedAt: Date | null = null;

export async function runScheduledScrape(forceAll: boolean = false): Promise<{
  sourcesProcessed: number;
  totalListings: number;
  newListings: number;
  errors: string[];
}> {
  if (isScrapingInProgress) {
    console.log("[Scheduler] Scrape already in progress, skipping...");
    return { sourcesProcessed: 0, totalListings: 0, newListings: 0, errors: ["Scrape already in progress"] };
  }

  isScrapingInProgress = true;
  lastCheckAt = new Date();

  const result = {
    sourcesProcessed: 0,
    totalListings: 0,
    newListings: 0,
    errors: [] as string[],
  };

  try {
    console.log(`[Scheduler] Starting ${forceAll ? 'forced' : 'scheduled'} scrape of all global sources...`);

    let sourcesToScrape;
    
    if (forceAll) {
      sourcesToScrape = await db
        .select()
        .from(marinaScrapeources)
        .where(and(
          eq(marinaScrapeources.isGlobalSource, true),
          eq(marinaScrapeources.isActive, true)
        ))
        .orderBy(marinaScrapeources.lastScrapeAt);
    } else {
      const staleThreshold = new Date(Date.now() - MIN_SCRAPE_INTERVAL_MS);
      
      sourcesToScrape = await db
        .select()
        .from(marinaScrapeources)
        .where(and(
          eq(marinaScrapeources.isGlobalSource, true),
          eq(marinaScrapeources.isActive, true),
          or(
            isNull(marinaScrapeources.lastScrapeAt),
            lte(marinaScrapeources.lastScrapeAt, staleThreshold)
          )
        ))
        .orderBy(marinaScrapeources.lastScrapeAt);
    }

    console.log(`[Scheduler] Found ${sourcesToScrape.length} sources needing scrape`);

    for (const source of sourcesToScrape) {
      try {
        console.log(`[Scheduler] Scraping ${source.name} (${source.platform})...`);

        await db
          .update(marinaScrapeources)
          .set({
            lastScrapeAt: new Date(),
            lastScrapeStatus: "running",
          })
          .where(eq(marinaScrapeources.id, source.id));

        const scrapeResult = await scrapeSourceWithMultiPage(source);

        if (scrapeResult.listings.length > 0) {
          const orgId = source.orgId;
          const platforms = [source.platform];
          
          const jobResult = await runScrapeJob(orgId, platforms);
          result.newListings += jobResult.newListings;
          result.totalListings += jobResult.totalFound;
          result.errors.push(...jobResult.errors);
        }

        await db
          .update(marinaScrapeources)
          .set({
            lastScrapeStatus: scrapeResult.errors.length > 0 ? "partial" : "success",
            lastScrapeCount: scrapeResult.listings.length,
            healthStatus: scrapeResult.errors.length > 0 ? "warning" : "healthy",
            successCount: sql`COALESCE(${marinaScrapeources.successCount}, 0) + 1`,
            consecutiveFailures: 0,
          })
          .where(eq(marinaScrapeources.id, source.id));

        result.sourcesProcessed++;

      } catch (error: any) {
        console.error(`[Scheduler] Error scraping ${source.name}:`, error.message);
        result.errors.push(`${source.name}: ${error.message}`);

        await db
          .update(marinaScrapeources)
          .set({
            lastScrapeStatus: "failed",
            lastFailureReason: error.message,
            healthStatus: "failing",
            failureCount: sql`COALESCE(${marinaScrapeources.failureCount}, 0) + 1`,
            consecutiveFailures: sql`COALESCE(${marinaScrapeources.consecutiveFailures}, 0) + 1`,
          })
          .where(eq(marinaScrapeources.id, source.id));
      }
    }

    console.log(`[Scheduler] Completed: ${result.sourcesProcessed} sources, ${result.newListings} new listings`);

  } catch (error: any) {
    console.error("[Scheduler] Fatal error in scheduled scrape:", error);
    result.errors.push(`Scheduler error: ${error.message}`);
  } finally {
    isScrapingInProgress = false;
  }

  return result;
}

export async function runSingleSourceScrape(sourceId: string): Promise<{
  success: boolean;
  listingsFound: number;
  newListings: number;
  errors: string[];
}> {
  const result = {
    success: false,
    listingsFound: 0,
    newListings: 0,
    errors: [] as string[],
  };

  try {
    const [source] = await db
      .select()
      .from(marinaScrapeources)
      .where(eq(marinaScrapeources.id, sourceId));

    if (!source) {
      result.errors.push("Source not found");
      return result;
    }

    console.log(`[Scraper] Running single source scrape for ${source.name}...`);

    await db
      .update(marinaScrapeources)
      .set({
        lastScrapeAt: new Date(),
        lastScrapeStatus: "running",
      })
      .where(eq(marinaScrapeources.id, sourceId));

    const scrapeResult = await scrapeSourceWithMultiPage(source);
    result.listingsFound = scrapeResult.listings.length;

    if (scrapeResult.listings.length > 0) {
      const jobResult = await runScrapeJob(source.orgId, [source.platform]);
      result.newListings = jobResult.newListings;
      result.errors.push(...jobResult.errors);
    }

    await db
      .update(marinaScrapeources)
      .set({
        lastScrapeStatus: scrapeResult.errors.length > 0 ? "partial" : "success",
        lastScrapeCount: scrapeResult.listings.length,
        healthStatus: scrapeResult.errors.length > 0 ? "warning" : "healthy",
        successCount: sql`COALESCE(${marinaScrapeources.successCount}, 0) + 1`,
        consecutiveFailures: 0,
      })
      .where(eq(marinaScrapeources.id, sourceId));

    result.success = true;

  } catch (error: any) {
    console.error(`[Scraper] Error in single source scrape:`, error);
    result.errors.push(error.message);

    await db
      .update(marinaScrapeources)
      .set({
        lastScrapeStatus: "failed",
        lastFailureReason: error.message,
        healthStatus: "failing",
        failureCount: sql`COALESCE(${marinaScrapeources.failureCount}, 0) + 1`,
        consecutiveFailures: sql`COALESCE(${marinaScrapeources.consecutiveFailures}, 0) + 1`,
      })
      .where(eq(marinaScrapeources.id, sourceId));
  }

  return result;
}

export function startScheduler(): void {
  if (schedulerInterval) {
    console.log("[Scheduler] Already running");
    return;
  }

  schedulerStartedAt = new Date();
  console.log("[Scheduler] Starting listing scrape scheduler (every 6 hours)...");

  startupTimeout = setTimeout(() => {
    console.log("[Scheduler] Running initial scrape check...");
    runScheduledScrape().catch(console.error);
  }, 30000);

  schedulerInterval = setInterval(() => {
    runScheduledScrape().catch(console.error);
  }, SCRAPE_INTERVAL_MS);

  console.log("[Scheduler] Scheduler started successfully");
}

export function stopScheduler(): void {
  if (startupTimeout) {
    clearTimeout(startupTimeout);
    startupTimeout = null;
  }
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    schedulerStartedAt = null;
    console.log("[Scheduler] Stopped");
  }
}

export async function getSchedulerStatus(): Promise<SchedulerStatus> {
  const [sourceCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(marinaScrapeources)
    .where(and(
      eq(marinaScrapeources.isGlobalSource, true),
      eq(marinaScrapeources.isActive, true)
    ));

  const [listingCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(marinaListings);

  const nextRun = schedulerStartedAt 
    ? new Date(Date.now() + SCRAPE_INTERVAL_MS - (Date.now() - (lastCheckAt?.getTime() || schedulerStartedAt.getTime())))
    : null;

  return {
    isRunning: schedulerInterval !== null,
    isScrapingInProgress,
    lastCheckAt,
    nextScheduledRun: nextRun,
    activeSources: sourceCount?.count || 0,
    totalListings: listingCount?.count || 0,
  };
}
