import { db } from "../../db";
import { eq, and, lte, or, isNull, sql, desc } from "drizzle-orm";
import { marinaScrapeources, marinaScrapeRuns, marinaListings } from "@shared/schema";
import { scrapeSourceWithMultiPage, ListingData, generateDedupeHash } from "./cre-scraper";
import { matchScoringService } from "./match-scoring-service";

const SOLD_STATUS_PATTERNS = [
  /\bproperty\s+sold\b/i,
  /\bmarina\s+sold\b/i,
  /\blisting\s+sold\b/i,
  /\brecently\s+sold\b/i,
  /\bjust\s+sold\b/i,
  /\bnow\s+sold\b/i,
  /\bhas\s+been\s+sold\b/i,
  /\bproperty\s+closed\b/i,
  /\brecently\s+closed\b/i,
  /\bdeal\s+closed\b/i,
  /\bunder\s+contract\b/i,
  /\bpending\s+sale\b/i,
  /\bsale\s+pending\b/i,
  /\bcontract\s+pending\b/i,
  /\boff\s+market\b/i,
  /\bno\s+longer\s+available\b/i,
  /\bin\s+escrow\b/i,
  /\baccepted\s+offer\b/i,
  /\bstatus:\s*sold\b/i,
  /\bstatus:\s*closed\b/i,
  /\bstatus:\s*pending\b/i,
];

const TITLE_SOLD_KEYWORDS = [
  "sold",
  "closed",
  "pending",
  "under contract",
  "off market",
];

function isSoldListing(listing: ListingData): { isSold: boolean; matchedKeyword?: string } {
  const title = (listing.title || "").toLowerCase();
  const propertyName = (listing.propertyName || "").toLowerCase();
  const dealType = (listing.dealType || "").toLowerCase();
  
  for (const keyword of TITLE_SOLD_KEYWORDS) {
    if (title.includes(keyword) || propertyName.includes(keyword)) {
      return { isSold: true, matchedKeyword: `title/name: ${keyword}` };
    }
  }
  
  if (dealType === "sold" || dealType === "closed" || dealType === "pending") {
    return { isSold: true, matchedKeyword: `dealType: ${dealType}` };
  }
  
  const fullText = [
    listing.title || "",
    listing.propertyName || "",
    listing.originalDescription || "",
  ].join(" ");
  
  for (const pattern of SOLD_STATUS_PATTERNS) {
    const match = fullText.match(pattern);
    if (match) {
      return { isSold: true, matchedKeyword: match[0] };
    }
  }
  
  return { isSold: false };
}

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
          const savedResult = await saveGlobalListings(
            scrapeResult.listings, 
            source.platform, 
            source.id
          );
          result.newListings += savedResult.newListings;
          result.totalListings += savedResult.totalListings;
          result.errors.push(...savedResult.errors);
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

async function saveGlobalListings(
  listings: ListingData[],
  platform: string,
  sourceId: string
): Promise<{
  newListings: number;
  totalListings: number;
  errors: string[];
}> {
  const result = {
    newListings: 0,
    totalListings: listings.length,
    skippedSold: 0,
    skippedDuplicate: 0,
    errors: [] as string[],
  };

  for (const listing of listings) {
    try {
      // Filter out sold/closed listings as safety check
      const soldCheck = isSoldListing(listing);
      if (soldCheck.isSold) {
        console.log(`[Scheduler] Skipping sold listing: "${listing.propertyName || listing.title}" (matched: "${soldCheck.matchedKeyword}")`);
        result.skippedSold++;
        continue;
      }
      
      const dedupeHash = generateDedupeHash(listing, platform);
      
      // Check by dedupe_hash first (normalized property identity)
      const [existing] = await db
        .select({ id: marinaListings.id })
        .from(marinaListings)
        .where(eq(marinaListings.dedupeHash, dedupeHash))
        .limit(1);

      if (existing) {
        await db
          .update(marinaListings)
          .set({
            lastScrapedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(marinaListings.id, existing.id));
        result.skippedDuplicate++;
        continue;
      }
      
      // Also check by source URL (same page scraped multiple times)
      if (listing.sourceUrl) {
        const normalizedUrl = listing.sourceUrl.split('?')[0].replace(/\/+$/, '').toLowerCase();
        const [existingByUrl] = await db
          .select({ id: marinaListings.id })
          .from(marinaListings)
          .where(sql`lower(regexp_replace(split_part(source_url, '?', 1), '/+$', '')) = ${normalizedUrl}`)
          .limit(1);
        
        if (existingByUrl) {
          await db
            .update(marinaListings)
            .set({
              lastScrapedAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(marinaListings.id, existingByUrl.id));
          result.skippedDuplicate++;
          continue;
        }
      }

      const [newListing] = await db.insert(marinaListings).values({
        orgId: "system-global-sources",
        scope: "global",
        isCurated: true,
        sourcePlatform: platform,
        sourceUrl: listing.sourceUrl,
        sourceListingId: listing.sourceListingId,
        dedupeHash,
        title: listing.title,
        propertyName: listing.propertyName,
        propertyAddress: listing.propertyAddress,
        city: listing.city,
        state: listing.state,
        zipCode: listing.zipCode,
        marinaType: listing.marinaType,
        propertyType: listing.propertyType,
        dealType: listing.dealType,
        totalSlips: listing.totalSlips,
        wetSlips: listing.wetSlips,
        dryStorageSpaces: listing.dryStorageSpaces,
        acreage: listing.acreage?.toString(),
        waterFrontage: listing.waterFrontage?.toString(),
        hasFuel: listing.hasFuel,
        hasShipStore: listing.hasShipStore,
        hasRestaurant: listing.hasRestaurant,
        hasRepairShop: listing.hasRepairShop,
        hasDryStorage: listing.hasDryStorage,
        hasBoatRamp: listing.hasBoatRamp,
        askingPrice: listing.askingPrice?.toString(),
        pricePerSlip: listing.pricePerSlip?.toString(),
        grossRevenue: listing.grossRevenue?.toString(),
        noi: listing.noi?.toString(),
        ebitda: listing.ebitda?.toString(),
        capRate: listing.capRate?.toString(),
        occupancyRate: listing.occupancyRate?.toString(),
        brokerName: listing.brokerName,
        brokerCompany: listing.brokerCompany,
        brokerPhone: listing.brokerPhone,
        brokerEmail: listing.brokerEmail,
        attributionText: listing.attributionText,
        originalDescription: listing.originalDescription,
        heroImageUrl: listing.heroImageUrl,
        images: listing.images,
        services: listing.services,
        tenantSummary: listing.tenantSummary,
        extractionConfidence: listing.confidence,
        listingDate: listing.listingDate,
        status: "active",
      }).returning();

      result.newListings++;

      try {
        await matchScoringService.scoreAndSaveListing(newListing.id, "system-global-sources");
      } catch (scoreError: any) {
        console.log(`[Scheduler] Warning: Could not score listing ${newListing.id}: ${scoreError.message}`);
      }

    } catch (error: any) {
      result.errors.push(`Insert error for "${listing.title}": ${error.message}`);
    }
  }

  console.log(`[Scheduler] ${platform}: ${listings.length} found, ${result.skippedSold} sold skipped, ${result.skippedDuplicate} duplicates updated, ${result.newListings} new saved`);
  return result;
}
