import { db } from "../../db";
import { marinaScrapeources } from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";

export interface GlobalBrokerSource {
  platform: string;
  name: string;
  baseUrl: string;
  searchUrl: string;
  propertyType: string;
  keywordsInclude: string[];
  keywordsExclude: string[];
  crawlMode: string;
  listingLinkSelector?: string;
  paginationSelector?: string;
  capabilities: string[];
  requiresJsRendering: boolean;
  rateLimitRpm: number;
  pollingIntervalMinutes: number;
  maxPagesPerRun: number;
  capabilityNotes?: string;
}

export const MARINA_INCLUDE_KEYWORDS = [
  "marina",
  "boat slip",
  "dock",
  "waterfront marina",
  "yacht club",
  "boatyard",
  "boat storage",
  "wet slip",
  "dry slip",
  "dry stack",
  "boat ramp",
  "marine service",
  "ship store",
  "fuel dock",
  "maritime",
  "harbor",
  "boat launch",
  "mooring",
];

export const MARINA_EXCLUDE_KEYWORDS = [
  "multifamily",
  "multi-family",
  "apartment",
  "apartments",
  "office building",
  "office space",
  "retail center",
  "shopping center",
  "strip mall",
  "hotel",
  "motel",
  "hospitality",
  "residential",
  "single family",
  "single-family",
  "condo",
  "condominium",
  "townhouse",
  "townhome",
  "duplex",
  "triplex",
  "fourplex",
  "warehouse",
  "industrial",
  "manufacturing",
  "self storage",
  "self-storage",
  "mini storage",
  "rv storage",
  "rv park",
  "mobile home",
  "manufactured home",
  "land only",
  "vacant land",
  "development land",
  "restaurant only",
  "bar only",
  "medical office",
  "healthcare",
  "senior living",
  "assisted living",
  "student housing",
  "parking lot",
  "parking garage",
  "gas station",
  "convenience store",
  "car wash",
  "laundromat",
  "church",
  "religious",
  "school",
  "daycare",
];

export const GLOBAL_BROKER_SOURCES: GlobalBrokerSource[] = [
  {
    platform: "Simply Marinas",
    name: "Simply Marinas - All Listings",
    baseUrl: "https://www.simplymarinas.com",
    searchUrl: "https://www.simplymarinas.com/marinas-for-sale/",
    propertyType: "marina",
    keywordsInclude: MARINA_INCLUDE_KEYWORDS,
    keywordsExclude: MARINA_EXCLUDE_KEYWORDS,
    crawlMode: "pagination",
    listingLinkSelector: "a.listing-link, article a[href*='/marina'], .property-card a",
    paginationSelector: "a.next-page, .pagination a[rel='next'], a:contains('Next')",
    capabilities: ["scraping"],
    requiresJsRendering: false,
    rateLimitRpm: 20,
    pollingIntervalMinutes: 120,
    maxPagesPerRun: 10,
    capabilityNotes: "Marina-focused broker with nationwide coverage. High-quality marina listings only.",
  },
  {
    platform: "SVN Marinas",
    name: "SVN Marinas - Property Listings",
    baseUrl: "https://svnmarinas.com",
    searchUrl: "https://svnmarinas.com/properties/",
    propertyType: "marina",
    keywordsInclude: MARINA_INCLUDE_KEYWORDS,
    keywordsExclude: MARINA_EXCLUDE_KEYWORDS,
    crawlMode: "pagination",
    listingLinkSelector: "a[href*='/properties/'], .property-listing a, article a",
    paginationSelector: "a.next, .pagination a[rel='next']",
    capabilities: ["scraping"],
    requiresJsRendering: false,
    rateLimitRpm: 20,
    pollingIntervalMinutes: 120,
    maxPagesPerRun: 5,
    capabilityNotes: "SVN franchise specializing in marina and marine properties.",
  },
  {
    platform: "National Marina Sales",
    name: "National Marina Sales - All Listings",
    baseUrl: "https://www.nationalmarinasales.com",
    searchUrl: "https://www.nationalmarinasales.com/marina-listings/",
    propertyType: "marina",
    keywordsInclude: MARINA_INCLUDE_KEYWORDS,
    keywordsExclude: MARINA_EXCLUDE_KEYWORDS,
    crawlMode: "pagination",
    listingLinkSelector: "a[href*='/listings/'], .listing-card a, article a",
    paginationSelector: "a.next-page, .pagination a[rel='next']",
    capabilities: ["scraping"],
    requiresJsRendering: false,
    rateLimitRpm: 20,
    pollingIntervalMinutes: 120,
    maxPagesPerRun: 5,
    capabilityNotes: "Keller Williams affiliate specializing in marinas and boatyards. Contact: Rick Roughen.",
  },
  {
    platform: "Leisure Investment Properties",
    name: "LIPG - Marina Listings",
    baseUrl: "https://www.leisurepropertiesgroup.com",
    searchUrl: "https://www.leisurepropertiesgroup.com/available-listings/",
    propertyType: "marina",
    keywordsInclude: MARINA_INCLUDE_KEYWORDS,
    keywordsExclude: [...MARINA_EXCLUDE_KEYWORDS, "golf course", "golf", "rv park", "rv resort", "resort"],
    crawlMode: "pagination",
    listingLinkSelector: "a[href*='/listing'], .property-card a, article a",
    paginationSelector: "a.next, .pagination a[rel='next']",
    capabilities: ["scraping"],
    requiresJsRendering: true,
    rateLimitRpm: 15,
    pollingIntervalMinutes: 180,
    maxPagesPerRun: 10,
    capabilityNotes: "Specializes in leisure properties including marinas. Filter strictly for marina-only listings.",
  },
  {
    platform: "Waterfront Investment Properties",
    name: "Waterfront Investment Properties - Marinas",
    baseUrl: "https://waterfrontinvestmentproperties.net",
    searchUrl: "https://waterfrontinvestmentproperties.net/listings/",
    propertyType: "marina",
    keywordsInclude: MARINA_INCLUDE_KEYWORDS,
    keywordsExclude: MARINA_EXCLUDE_KEYWORDS,
    crawlMode: "single",
    listingLinkSelector: "a[href*='/listings/'], .property a, article a",
    capabilities: ["scraping"],
    requiresJsRendering: false,
    rateLimitRpm: 15,
    pollingIntervalMinutes: 240,
    maxPagesPerRun: 5,
    capabilityNotes: "Boutique marina broker. Karen Calvacca since 1995. Often has off-market opportunities.",
  },
  {
    platform: "Colliers Leisure",
    name: "Colliers Leisure Property Advisors - Marinas",
    baseUrl: "https://www.colliers.com",
    searchUrl: "https://www.colliers.com/en/properties?propertyType=Commercial-Specialty&keyword=marina",
    propertyType: "marina",
    keywordsInclude: MARINA_INCLUDE_KEYWORDS,
    keywordsExclude: MARINA_EXCLUDE_KEYWORDS,
    crawlMode: "pagination",
    listingLinkSelector: "a[href*='/properties/'][href*='marina'], .property-card a",
    paginationSelector: ".pagination a[rel='next'], a.next",
    capabilities: ["scraping"],
    requiresJsRendering: true,
    rateLimitRpm: 10,
    pollingIntervalMinutes: 240,
    maxPagesPerRun: 5,
    capabilityNotes: "Matt Putnam's Marina & Leisure team. High-value properties.",
  },
  {
    platform: "LoopNet",
    name: "LoopNet - Marinas for Sale (All States)",
    baseUrl: "https://www.loopnet.com",
    searchUrl: "https://www.loopnet.com/search/marinas/usa/for-sale/",
    propertyType: "marina",
    keywordsInclude: MARINA_INCLUDE_KEYWORDS,
    keywordsExclude: MARINA_EXCLUDE_KEYWORDS,
    crawlMode: "pagination",
    listingLinkSelector: "article a[href*='/Listing/'], .placard a.toggle-favorite-popover",
    paginationSelector: "a[data-testid='pagination-next'], a.next-page",
    capabilities: ["scraping"],
    requiresJsRendering: true,
    rateLimitRpm: 10,
    pollingIntervalMinutes: 60,
    maxPagesPerRun: 20,
    capabilityNotes: "Major CRE marketplace. Pre-filtered to marina category.",
  },
  {
    platform: "Crexi",
    name: "Crexi - Marinas for Sale",
    baseUrl: "https://www.crexi.com",
    searchUrl: "https://www.crexi.com/properties/Marinas",
    propertyType: "marina",
    keywordsInclude: MARINA_INCLUDE_KEYWORDS,
    keywordsExclude: MARINA_EXCLUDE_KEYWORDS,
    crawlMode: "pagination",
    listingLinkSelector: "a[href*='/properties/'][href*='marinas'], .property-card a",
    paginationSelector: "button.next, a[rel='next']",
    capabilities: ["scraping"],
    requiresJsRendering: true,
    rateLimitRpm: 10,
    pollingIntervalMinutes: 60,
    maxPagesPerRun: 20,
    capabilityNotes: "Major CRE marketplace with marina category filter.",
  },
  {
    platform: "Marcus & Millichap",
    name: "Marcus & Millichap - Hospitality/Marinas",
    baseUrl: "https://www.marcusmillichap.com",
    searchUrl: "https://www.marcusmillichap.com/properties?keyword=marina",
    propertyType: "marina",
    keywordsInclude: MARINA_INCLUDE_KEYWORDS,
    keywordsExclude: [...MARINA_EXCLUDE_KEYWORDS, "hotel", "hospitality", "lodging"],
    crawlMode: "pagination",
    listingLinkSelector: "a[href*='/properties/'][href*='marina'], .property-card a",
    paginationSelector: "a.next, .pagination a[rel='next']",
    capabilities: ["scraping"],
    requiresJsRendering: true,
    rateLimitRpm: 10,
    pollingIntervalMinutes: 240,
    maxPagesPerRun: 10,
    capabilityNotes: "Major CRE brokerage. Marinas often under Hospitality category. Filter strictly.",
  },
  {
    platform: "CBRE",
    name: "CBRE - Marina Properties",
    baseUrl: "https://www.cbre.com",
    searchUrl: "https://www.cbre.com/properties?keyword=marina",
    propertyType: "marina",
    keywordsInclude: MARINA_INCLUDE_KEYWORDS,
    keywordsExclude: MARINA_EXCLUDE_KEYWORDS,
    crawlMode: "single",
    listingLinkSelector: "a[href*='/properties/'][href*='marina']",
    capabilities: ["scraping"],
    requiresJsRendering: true,
    rateLimitRpm: 10,
    pollingIntervalMinutes: 360,
    maxPagesPerRun: 5,
    capabilityNotes: "Julie Fisher Berry's Marina team in Fort Lauderdale. Limited public listings.",
  },
];

export async function seedGlobalBrokerSources(adminOrgId: string): Promise<{ created: number; updated: number; errors: string[] }> {
  const results = { created: 0, updated: 0, errors: [] as string[] };

  for (const source of GLOBAL_BROKER_SOURCES) {
    try {
      const existing = await db
        .select()
        .from(marinaScrapeources)
        .where(
          and(
            eq(marinaScrapeources.platform, source.platform),
            eq(marinaScrapeources.isGlobalSource, true)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        await db
          .update(marinaScrapeources)
          .set({
            name: source.name,
            baseUrl: source.baseUrl,
            searchUrl: source.searchUrl,
            propertyType: source.propertyType,
            keywordsInclude: source.keywordsInclude,
            keywordsExclude: source.keywordsExclude,
            crawlMode: source.crawlMode,
            listingLinkSelector: source.listingLinkSelector,
            paginationSelector: source.paginationSelector,
            capabilities: source.capabilities,
            requiresJsRendering: source.requiresJsRendering,
            rateLimitRpm: source.rateLimitRpm,
            pollingIntervalMinutes: source.pollingIntervalMinutes,
            maxPagesPerRun: source.maxPagesPerRun,
            capabilityNotes: source.capabilityNotes,
            updatedAt: new Date(),
          })
          .where(eq(marinaScrapeources.id, existing[0].id));
        results.updated++;
      } else {
        await db.insert(marinaScrapeources).values({
          orgId: adminOrgId,
          scope: "global",
          isGlobalSource: true,
          isManaged: true,
          isActive: true,
          platform: source.platform,
          name: source.name,
          baseUrl: source.baseUrl,
          searchUrl: source.searchUrl,
          propertyType: source.propertyType,
          keywordsInclude: source.keywordsInclude,
          keywordsExclude: source.keywordsExclude,
          crawlMode: source.crawlMode,
          listingLinkSelector: source.listingLinkSelector,
          paginationSelector: source.paginationSelector,
          capabilities: source.capabilities,
          requiresJsRendering: source.requiresJsRendering,
          rateLimitRpm: source.rateLimitRpm,
          pollingIntervalMinutes: source.pollingIntervalMinutes,
          maxPagesPerRun: source.maxPagesPerRun,
          capabilityNotes: source.capabilityNotes,
          ingestionMethod: "scraping",
          respectRobotsTxt: true,
        });
        results.created++;
      }
    } catch (error) {
      const msg = `Failed to seed ${source.platform}: ${error instanceof Error ? error.message : String(error)}`;
      console.error(msg);
      results.errors.push(msg);
    }
  }

  console.log(`[Global Sources] Seeded broker sources: ${results.created} created, ${results.updated} updated`);
  return results;
}

export function isMarinaRelatedListing(
  title: string,
  description: string,
  propertyType?: string
): { isMarina: boolean; reason: string; confidence: number } {
  const searchText = `${title} ${description} ${propertyType || ""}`.toLowerCase();

  const matchedIncludes = MARINA_INCLUDE_KEYWORDS.filter(kw => searchText.includes(kw.toLowerCase()));
  const matchedExcludes = MARINA_EXCLUDE_KEYWORDS.filter(kw => searchText.includes(kw.toLowerCase()));

  if (matchedExcludes.length > 0 && matchedIncludes.length === 0) {
    return {
      isMarina: false,
      reason: `Excluded: ${matchedExcludes.slice(0, 3).join(", ")}`,
      confidence: 95,
    };
  }

  if (matchedIncludes.length === 0) {
    return {
      isMarina: false,
      reason: "No marina keywords found",
      confidence: 80,
    };
  }

  if (matchedExcludes.length > matchedIncludes.length) {
    return {
      isMarina: false,
      reason: `More exclusion keywords (${matchedExcludes.length}) than marina keywords (${matchedIncludes.length})`,
      confidence: 70,
    };
  }

  const strongMarinaKeywords = ["marina", "boat slip", "dock", "boatyard", "yacht club", "wet slip", "dry slip"];
  const hasStrongKeyword = strongMarinaKeywords.some(kw => searchText.includes(kw));

  if (hasStrongKeyword) {
    return {
      isMarina: true,
      reason: `Marina keywords: ${matchedIncludes.slice(0, 3).join(", ")}`,
      confidence: 95,
    };
  }

  return {
    isMarina: true,
    reason: `Marina-related: ${matchedIncludes.slice(0, 3).join(", ")}`,
    confidence: 75,
  };
}

export function calculateDaysOnMarket(listingDate: Date | string | null | undefined): number | null {
  if (!listingDate) return null;
  
  const date = typeof listingDate === "string" ? new Date(listingDate) : listingDate;
  if (isNaN(date.getTime())) return null;
  
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  return diffDays >= 0 ? diffDays : null;
}
