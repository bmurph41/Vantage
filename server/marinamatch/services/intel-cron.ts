import cron from "node-cron";
import { db } from "../../db";
import { eq, and, desc } from "drizzle-orm";
import { marinaListings, marinaScrapeRuns, marinaScrapeources, organizations } from "@shared/schema";

let isInitialized = false;
let autoScrapeEnabled = true;
let lastScrapeTime: Date | null = null;
let isScraping = false;

interface ScrapeStatus {
  enabled: boolean;
  lastScrape: Date | null;
  isScraping: boolean;
  nextScrape: Date | null;
}

export function getScrapeStatus(): ScrapeStatus {
  return {
    enabled: autoScrapeEnabled,
    lastScrape: lastScrapeTime,
    isScraping: isScraping,
    nextScrape: autoScrapeEnabled && lastScrapeTime 
      ? new Date(lastScrapeTime.getTime() + 60 * 60 * 1000) // Every hour
      : null
  };
}

export function setAutoScrapeEnabled(enabled: boolean): ScrapeStatus {
  autoScrapeEnabled = enabled;
  console.log(`[MarinaMatch Intel] Auto-scrape ${enabled ? 'enabled' : 'disabled'}`);
  return getScrapeStatus();
}

async function seedInitialListings(orgId: string): Promise<number> {
  const crypto = await import("crypto");
  
  const sampleListings = [
    {
      id: `listing-${crypto.randomUUID()}`,
      orgId,
      title: "Gulf Breeze Marina - Full Service",
      propertyName: "Gulf Breeze Marina",
      propertyAddress: "4200 Marina Way",
      city: "Pensacola",
      state: "FL",
      zipCode: "32507",
      askingPrice: "8500000",
      totalSlips: 185,
      wetSlips: 150,
      dryStorage: 35,
      grossRevenue: "2100000",
      noi: "890000",
      capRate: "10.47",
      occupancyRate: "94",
      acreage: "12.5",
      waterDepth: "8",
      sourcePlatform: "Crexi",
      sourceUrl: "https://www.crexi.com/properties/gulf-breeze-marina",
      status: "active",
      hasFuel: true,
      hasShipStore: true,
      hasRepairShop: true,
      hasDryStorage: true,
      bestMatchScore: 87,
      attributionText: "Listing sourced from Crexi. All data provided for informational purposes only.",
      brokerName: "John Marine",
      brokerCompany: "Coastal CRE Group",
      brokerPhone: "(850) 555-0123",
      brokerEmail: "john@coastalcre.com",
      originalDescription: "Premier full-service marina in Pensacola's waterfront district. Features 185 slips with deep-water access, on-site fuel dock, fully stocked ship store, and certified repair facility. Strong cash flow with upside potential.",
      listingDate: new Date("2024-01-15"),
      dedupeHash: crypto.createHash("md5").update("crexi|gulf breeze marina|4200 marina way|pensacola|fl").digest("hex"),
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: `listing-${crypto.randomUUID()}`,
      orgId,
      title: "Sunset Cove Marina",
      propertyName: "Sunset Cove Marina",
      propertyAddress: "789 Harbor Drive",
      city: "Naples",
      state: "FL",
      zipCode: "34102",
      askingPrice: "12750000",
      totalSlips: 245,
      wetSlips: 200,
      dryStorage: 45,
      grossRevenue: "3200000",
      noi: "1450000",
      capRate: "11.37",
      occupancyRate: "97",
      acreage: "18.2",
      waterDepth: "10",
      sourcePlatform: "LoopNet",
      sourceUrl: "https://www.loopnet.com/listing/sunset-cove-marina",
      status: "active",
      hasFuel: true,
      hasShipStore: true,
      hasRepairShop: false,
      hasDryStorage: true,
      bestMatchScore: 92,
      attributionText: "Listing sourced from LoopNet. All data provided for informational purposes only.",
      brokerName: "Sarah Waters",
      brokerCompany: "Premier Marine Realty",
      brokerPhone: "(239) 555-0456",
      brokerEmail: "swaters@premiermarinerealty.com",
      originalDescription: "Exceptional marina in Naples' prestigious waterfront location. 245 total slips with premium amenities. Strong NOI with room for rate increases.",
      listingDate: new Date("2024-02-01"),
      dedupeHash: crypto.createHash("md5").update("loopnet|sunset cove marina|789 harbor drive|naples|fl").digest("hex"),
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: `listing-${crypto.randomUUID()}`,
      orgId,
      title: "Bay Harbor Marine Center",
      propertyName: "Bay Harbor Marine Center",
      propertyAddress: "1500 Waterfront Blvd",
      city: "Sarasota",
      state: "FL",
      zipCode: "34236",
      askingPrice: "6200000",
      totalSlips: 120,
      wetSlips: 100,
      dryStorage: 20,
      grossRevenue: "1450000",
      noi: "580000",
      capRate: "9.35",
      occupancyRate: "91",
      acreage: "8.3",
      waterDepth: "7",
      sourcePlatform: "BizBuySell",
      sourceUrl: "https://www.bizbuysell.com/listing/bay-harbor-marine",
      status: "active",
      hasFuel: true,
      hasShipStore: false,
      hasRepairShop: true,
      hasDryStorage: true,
      bestMatchScore: 74,
      attributionText: "Listing sourced from BizBuySell. All data provided for informational purposes only.",
      brokerName: "Michael Anchor",
      brokerCompany: "Gulf Coast Business Brokers",
      brokerPhone: "(941) 555-0789",
      brokerEmail: "manchor@gcbb.com",
      originalDescription: "Well-maintained marina with established customer base in growing Sarasota market. Full-service repair shop and fuel dock provide strong ancillary revenue.",
      listingDate: new Date("2024-01-28"),
      dedupeHash: crypto.createHash("md5").update("bizbuysell|bay harbor marine center|1500 waterfront blvd|sarasota|fl").digest("hex"),
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: `listing-${crypto.randomUUID()}`,
      orgId,
      title: "Charleston Harbor Marina",
      propertyName: "Charleston Harbor Marina",
      propertyAddress: "2100 Coastal Way",
      city: "Charleston",
      state: "SC",
      zipCode: "29401",
      askingPrice: "9800000",
      totalSlips: 175,
      wetSlips: 160,
      dryStorage: 15,
      grossRevenue: "2400000",
      noi: "1020000",
      capRate: "10.41",
      occupancyRate: "96",
      acreage: "14.1",
      waterDepth: "9",
      sourcePlatform: "Crexi",
      sourceUrl: "https://www.crexi.com/properties/charleston-harbor-marina",
      status: "active",
      hasFuel: true,
      hasShipStore: true,
      hasRepairShop: true,
      hasDryStorage: false,
      bestMatchScore: 81,
      attributionText: "Listing sourced from Crexi. All data provided for informational purposes only.",
      brokerName: "Robert Maritime",
      brokerCompany: "Lowcountry CRE",
      brokerPhone: "(843) 555-0321",
      brokerEmail: "rmaritime@lowcountrycre.com",
      originalDescription: "Historic Charleston marina with deep-water access and stunning harbor views. Prime location attracts high-net-worth boaters. Recent infrastructure upgrades.",
      listingDate: new Date("2024-02-10"),
      dedupeHash: crypto.createHash("md5").update("crexi|charleston harbor marina|2100 coastal way|charleston|sc").digest("hex"),
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: `listing-${crypto.randomUUID()}`,
      orgId,
      title: "Lake Travis Marina & Resort",
      propertyName: "Lake Travis Marina & Resort",
      propertyAddress: "500 Lakefront Road",
      city: "Austin",
      state: "TX",
      zipCode: "78734",
      askingPrice: "15500000",
      totalSlips: 320,
      wetSlips: 280,
      dryStorage: 40,
      grossRevenue: "4100000",
      noi: "1845000",
      capRate: "11.9",
      occupancyRate: "99",
      acreage: "22.5",
      waterDepth: "12",
      sourcePlatform: "LoopNet",
      sourceUrl: "https://www.loopnet.com/listing/lake-travis-marina",
      status: "active",
      hasFuel: true,
      hasShipStore: true,
      hasRepairShop: true,
      hasDryStorage: true,
      bestMatchScore: 95,
      attributionText: "Listing sourced from LoopNet. All data provided for informational purposes only.",
      brokerName: "Texas Marina Specialists",
      brokerCompany: "Hill Country Brokers",
      brokerPhone: "(512) 555-0654",
      brokerEmail: "sales@texasmarinasales.com",
      originalDescription: "Trophy marina on Lake Travis with exceptional demand metrics. Nearly 100% occupancy with extensive waitlist. Multiple revenue streams including boat rentals, restaurant lease, and event space.",
      listingDate: new Date("2024-02-05"),
      dedupeHash: crypto.createHash("md5").update("loopnet|lake travis marina & resort|500 lakefront road|austin|tx").digest("hex"),
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: `listing-${crypto.randomUUID()}`,
      orgId,
      title: "Coastal Keys Marina",
      propertyName: "Coastal Keys Marina",
      propertyAddress: "3200 Overseas Highway",
      city: "Marathon",
      state: "FL",
      zipCode: "33050",
      askingPrice: "18500000",
      totalSlips: 280,
      wetSlips: 250,
      dryStorage: 30,
      grossRevenue: "4800000",
      noi: "2160000",
      capRate: "11.68",
      occupancyRate: "98",
      acreage: "25.0",
      waterDepth: "14",
      sourcePlatform: "CoStar",
      sourceUrl: "https://www.costar.com/listing/coastal-keys-marina",
      status: "active",
      hasFuel: true,
      hasShipStore: true,
      hasRepairShop: true,
      hasDryStorage: true,
      hasBoatRamp: true,
      bestMatchScore: 89,
      attributionText: "Listing sourced from CoStar. All data provided for informational purposes only.",
      brokerName: "Keys Marine Properties",
      brokerCompany: "Suncoast Commercial",
      brokerPhone: "(305) 555-0987",
      brokerEmail: "info@keysmarineproperties.com",
      originalDescription: "Premier Florida Keys marina with exceptional deep-water access. Prime location for sportfishing and cruising. Full-service amenities with established customer base.",
      listingDate: new Date("2024-02-15"),
      dedupeHash: crypto.createHash("md5").update("costar|coastal keys marina|3200 overseas highway|marathon|fl").digest("hex"),
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: `listing-${crypto.randomUUID()}`,
      orgId,
      title: "Chesapeake Bay Marina",
      propertyName: "Chesapeake Bay Marina",
      propertyAddress: "450 Bay Shore Drive",
      city: "Annapolis",
      state: "MD",
      zipCode: "21401",
      askingPrice: "11200000",
      totalSlips: 200,
      wetSlips: 180,
      dryStorage: 20,
      grossRevenue: "2900000",
      noi: "1305000",
      capRate: "11.65",
      occupancyRate: "95",
      acreage: "16.5",
      waterDepth: "10",
      sourcePlatform: "Merle Marine",
      sourceUrl: "https://merlemarine.com/listing/chesapeake-bay-marina",
      status: "active",
      hasFuel: true,
      hasShipStore: true,
      hasRepairShop: false,
      hasDryStorage: true,
      bestMatchScore: 83,
      attributionText: "Listing sourced from Merle Marine. All data provided for informational purposes only.",
      brokerName: "Merle Marine Group",
      brokerCompany: "Merle Marine Brokerage",
      brokerPhone: "(410) 555-0234",
      brokerEmail: "listings@merlemarine.com",
      originalDescription: "Historic Annapolis marina with protected deepwater basin. Walking distance to downtown. Strong sailing and powerboat community with year-round activity.",
      listingDate: new Date("2024-01-20"),
      dedupeHash: crypto.createHash("md5").update("merle|chesapeake bay marina|450 bay shore drive|annapolis|md").digest("hex"),
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: `listing-${crypto.randomUUID()}`,
      orgId,
      title: "Pacific Northwest Marina",
      propertyName: "Pacific Northwest Marina",
      propertyAddress: "1800 Harbor View Road",
      city: "Seattle",
      state: "WA",
      zipCode: "98119",
      askingPrice: "22000000",
      totalSlips: 350,
      wetSlips: 320,
      dryStorage: 30,
      grossRevenue: "5500000",
      noi: "2475000",
      capRate: "11.25",
      occupancyRate: "97",
      acreage: "28.0",
      waterDepth: "15",
      sourcePlatform: "LoopNet",
      sourceUrl: "https://www.loopnet.com/listing/pacific-northwest-marina",
      status: "active",
      hasFuel: true,
      hasShipStore: true,
      hasRepairShop: true,
      hasDryStorage: true,
      hasBoatRamp: true,
      bestMatchScore: 91,
      attributionText: "Listing sourced from LoopNet. All data provided for informational purposes only.",
      brokerName: "Northwest Marine Sales",
      brokerCompany: "Puget Sound Brokers",
      brokerPhone: "(206) 555-0567",
      brokerEmail: "sales@pugetsoundbrokers.com",
      originalDescription: "Exceptional Seattle waterfront marina with stunning views. Large-capacity facility serves both recreational and commercial vessels. Strong tech economy drives demand.",
      listingDate: new Date("2024-02-08"),
      dedupeHash: crypto.createHash("md5").update("loopnet|pacific northwest marina|1800 harbor view road|seattle|wa").digest("hex"),
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  try {
    await db.insert(marinaListings).values(sampleListings as any);
    console.log(`[MarinaMatch Intel] Seeded ${sampleListings.length} initial listings for org ${orgId}`);
    return sampleListings.length;
  } catch (error: any) {
    if (error.code === '23505') {
      console.log(`[MarinaMatch Intel] Some listings already exist for org ${orgId}`);
      return 0;
    }
    throw error;
  }
}

const DEFAULT_SOURCES = [
  // ACCESSIBLE SOURCES - These actually work without API partnerships
  {
    platform: "govdeals",
    name: "GovDeals Government Surplus",
    baseUrl: "https://www.govdeals.com",
    searchUrl: "https://www.govdeals.com/boats-marine-vessels-supplies",
    config: { category: "marina", type: "government_auction" },
    rateLimitRpm: 30,
    isActive: true,
  },
  {
    platform: "publicsurplus",
    name: "PublicSurplus Marine",
    baseUrl: "https://www.publicsurplus.com",
    searchUrl: "https://www.publicsurplus.com/sms/browse/cataucs?catid=20",
    config: { category: "marine", type: "government_auction" },
    rateLimitRpm: 30,
    isActive: true,
  },
  {
    platform: "marina_rss",
    name: "Marina Industry Feeds",
    baseUrl: "https://www.tradeonlytoday.com",
    searchUrl: "https://www.tradeonlytoday.com/feed",
    config: { type: "rss_feed", keywords: ["marina", "sale", "acquisition"] },
    rateLimitRpm: 60,
    isActive: true,
  },
  // BLOCKED SOURCES - Require API partnerships (kept for future integration)
  {
    platform: "LoopNet",
    name: "LoopNet Marina Properties",
    baseUrl: "https://www.loopnet.com",
    searchUrl: "https://www.loopnet.com/search/commercial-real-estate/marina/for-sale/",
    config: { propertyType: "marina", sortBy: "newest", note: "Requires API partnership" },
    rateLimitRpm: 20,
    isActive: false, // Disabled until API access is obtained
  },
  {
    platform: "Crexi",
    name: "Crexi Marina Listings",
    baseUrl: "https://www.crexi.com",
    searchUrl: "https://www.crexi.com/search?propertyType=marina",
    config: { propertyType: "marina", sortBy: "date", note: "Requires API partnership" },
    rateLimitRpm: 30,
    isActive: false, // Disabled until API access is obtained
  },
  {
    platform: "BizBuySell",
    name: "BizBuySell Marinas",
    baseUrl: "https://www.bizbuysell.com",
    searchUrl: "https://www.bizbuysell.com/buy/all-businesses/marina-businesses-for-sale/",
    config: { businessType: "marina", note: "Requires API partnership" },
    rateLimitRpm: 20,
    isActive: false, // Disabled until API access is obtained
  },
  {
    platform: "CoStar",
    name: "CoStar Marina Listings",
    baseUrl: "https://www.costar.com",
    searchUrl: "https://www.costar.com/search?type=marina",
    config: { requiresApiAccess: true, note: "Requires CoStar subscription" },
    rateLimitRpm: 10,
    isActive: false, // Disabled until API access is obtained
  },
];

async function ensureDefaultSources(orgId: string): Promise<number> {
  const crypto = await import("crypto");
  let created = 0;

  for (const source of DEFAULT_SOURCES) {
    try {
      const existing = await db
        .select({ id: marinaScrapeources.id })
        .from(marinaScrapeources)
        .where(
          and(
            eq(marinaScrapeources.orgId, orgId),
            eq(marinaScrapeources.platform, source.platform)
          )
        )
        .limit(1);

      if (existing.length === 0) {
        await db.insert(marinaScrapeources).values({
          id: `source-${crypto.randomUUID()}`,
          orgId,
          platform: source.platform,
          name: source.name,
          baseUrl: source.baseUrl,
          searchUrl: source.searchUrl,
          config: source.config,
          rateLimitRpm: source.rateLimitRpm,
          respectRobotsTxt: true,
          userAgent: "MarinaMatchBot/1.0 (+https://marinamatch.com/bot)",
          isActive: source.isActive,
          isManaged: true,
        } as any);
        created++;
        console.log(`[MarinaMatch Intel] Created default source: ${source.platform} for org ${orgId}`);
      }
    } catch (error) {
      console.error(`[MarinaMatch Intel] Error creating default source ${source.platform}:`, error);
    }
  }

  if (created > 0) {
    console.log(`[MarinaMatch Intel] Created ${created} default sources for org ${orgId}`);
  }
  return created;
}

async function ensureSourcesExist(orgId: string): Promise<void> {
  await ensureDefaultSources(orgId);
}

async function runAutoScrape(): Promise<void> {
  if (isScraping) {
    console.log("[MarinaMatch Intel] Scrape already in progress, skipping...");
    return;
  }

  try {
    isScraping = true;
    console.log("[MarinaMatch Intel] Starting automatic scrape...");

    // Get all organizations to scrape for
    const orgs = await db.select({ id: organizations.id }).from(organizations);
    
    for (const org of orgs) {
      try {
        // Ensure sources exist for the org (but no mock data seeding)
        await ensureSourcesExist(org.id);

        // Run actual scraper for the org
        // Include new accessible sources (govdeals, publicsurplus, marina_rss) that actually work
        // plus traditional CRE platforms (though they require API partnerships)
        const { runScrapeJob } = await import("./cre-scraper");
        await runScrapeJob(org.id, ["govdeals", "publicsurplus", "marina_rss", "crexi", "loopnet", "bizbuysell"]);
        
      } catch (error) {
        console.error(`[MarinaMatch Intel] Error scraping for org ${org.id}:`, error);
      }
    }

    lastScrapeTime = new Date();
    console.log("[MarinaMatch Intel] Automatic scrape completed");
  } catch (error) {
    console.error("[MarinaMatch Intel] Error in auto-scrape:", error);
  } finally {
    isScraping = false;
  }
}

export async function ensureListingsExist(orgId: string): Promise<boolean> {
  try {
    // No auto-seeding of demo data - only return true if real listings exist
    const existingListings = await db
      .select({ id: marinaListings.id })
      .from(marinaListings)
      .where(eq(marinaListings.orgId, orgId))
      .limit(1);

    return existingListings.length > 0;
  } catch (error) {
    console.error("[MarinaMatch Intel] Error checking listings:", error);
    return false;
  }
}

export function startMarinaMatchIntelCronJobs(): void {
  if (isInitialized) return;
  
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  // Schedule scraping - every hour in production, every 30 minutes in dev
  const cronSchedule = isDevelopment ? "*/30 * * * *" : "0 * * * *";
  
  console.log(`[MarinaMatch Intel] Cron jobs enabled (schedule: ${cronSchedule})`);
  console.log(`[MarinaMatch Intel] Auto-scrape is ${autoScrapeEnabled ? 'ON' : 'OFF'}`);
  
  // Schedule periodic scraping
  cron.schedule(cronSchedule, async () => {
    if (!autoScrapeEnabled) {
      return;
    }
    await runAutoScrape();
  });

  // Run initial scrape on startup after a short delay (non-blocking)
  setImmediate(async () => {
    // Wait 10 seconds to let the server fully start
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    if (autoScrapeEnabled) {
      console.log("[MarinaMatch Intel] Running initial startup scrape...");
      await runAutoScrape();
    }
  });

  isInitialized = true;
}

export async function getLastScrapeRun(orgId: string) {
  const [lastRun] = await db
    .select()
    .from(marinaScrapeRuns)
    .where(eq(marinaScrapeRuns.orgId, orgId))
    .orderBy(desc(marinaScrapeRuns.startedAt))
    .limit(1);
  
  return lastRun || null;
}
