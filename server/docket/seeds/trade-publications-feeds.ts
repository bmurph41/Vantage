import { db } from "../db";
import { rssSources } from "@shared/docket-schema";
import { eq } from "drizzle-orm";

// Broad CRE keyword set — covers all asset classes tracked by Vantage
export const CRE_KEYWORDS = [
  // General CRE / investment
  "commercial real estate", "real estate acquisition", "property acquisition",
  "real estate investment", "real estate deal", "real estate sale", "real estate fund",
  "real estate private equity", "real estate portfolio", "REIT",
  "cap rate", "NOI", "net operating income", "CMBS", "bridge loan",
  "ground lease", "sale-leaseback",
  // Marina / waterfront
  "marina", "harbor", "harbour", "dock", "dockage", "waterfront", "boat",
  "boatyard", "yacht", "yacht club", "boat slip", "dry stack", "wet slip",
  "moorage", "floating dock", "pier", "seawall", "suntex", "westrec",
  "safe harbor", "oasis marinas", "marina operator", "marina management",
  // Multifamily
  "apartment", "multifamily", "apartment complex", "rental housing",
  "affordable housing", "multifamily acquisition", "apartment sale",
  "housing development", "NMHC", "NAA",
  // Self-Storage
  "self storage", "self-storage", "storage facility", "mini storage",
  "public storage", "extra space storage", "cubesmart", "life storage",
  // Industrial / Warehouse
  "industrial property", "warehouse", "distribution center", "logistics facility",
  "industrial park", "fulfillment center", "cold storage", "NAIOP",
  "industrial real estate", "last mile",
  // Retail
  "shopping center", "strip mall", "retail center", "retail real estate",
  "ICSC", "grocery anchored", "net lease", "NNN lease", "power center",
  // Hotel / Hospitality
  "hotel", "hospitality property", "resort", "lodging", "hotel acquisition",
  "RevPAR", "extended stay", "full-service hotel", "select-service",
  // Short-Term Rental
  "short-term rental", "short term rental", "vacation rental", "Airbnb",
  "VRBO", "STR market", "STR regulation",
  // Senior Housing / Healthcare
  "senior housing", "assisted living", "skilled nursing facility", "memory care",
  "senior living community", "healthcare real estate", "medical office building",
  "NIC", "life sciences real estate",
  // Mobile Home Parks
  "manufactured housing", "mobile home park", "land lease community",
  "Sun Communities", "Equity LifeStyle",
  // Car Wash
  "car wash", "carwash", "express car wash",
  // RV Parks / Campgrounds
  "rv park", "rv resort", "campground acquisition", "glamping",
  "outdoor hospitality",
  // Office
  "office building", "office acquisition", "office market",
  "coworking", "office conversion",
  // Legacy / broad
  "properties", "private equity", "real estate", "acquisition",
  "purchase", "sale", "deal", "investment", "storage",
  "development", "property investment",
];

// ─── Marina / Waterfront ─────────────────────────────────────────────────────
const MARINA_FEEDS = [
  {
    name: "Trade Only Today - Marine Industry News",
    url: "https://www.tradeonlytoday.com/feed",
    keywords: [] as string[], // dedicated vertical, no filter needed
    minScore: 35,
  },
  {
    name: "Boating Industry Magazine",
    url: "https://www.boatingindustry.com/feed/",
    keywords: [] as string[],
    minScore: 35,
  },
  {
    name: "Marina Dock Age",
    url: "https://www.marinadockage.com/feed/",
    keywords: [] as string[],
    minScore: 35,
  },
  {
    name: "Marinalife Magazine",
    url: "https://www.marinalife.com/rss/articles",
    keywords: [] as string[],
    minScore: 35,
  },
  {
    name: "Professional Mariner",
    url: "https://professionalmariner.com/feed/",
    keywords: [] as string[],
    minScore: 35,
  },
  {
    name: "The Maritime Executive",
    url: "https://maritime-executive.com/rss",
    keywords: [] as string[],
    minScore: 35,
  },
  {
    name: "Marine News Magazine",
    url: "https://www.marinemec.com/feed/",
    keywords: [] as string[],
    minScore: 35,
  },
  {
    name: "Dockwalk - Yacht Industry",
    url: "https://www.dockwalk.com/rss.xml",
    keywords: [] as string[],
    minScore: 35,
  },
  {
    name: "International Boat Industry (IBI)",
    url: "https://www.ibinews.com/feed",
    keywords: [] as string[],
    minScore: 35,
  },
  {
    name: "Soundings Trade Only",
    url: "http://soundingsonline.com/feed",
    keywords: [] as string[],
    minScore: 35,
  },
  {
    name: "WorkBoat Magazine",
    url: "https://www.workboat.com/feed",
    keywords: [] as string[],
    minScore: 35,
  },
  {
    name: "Splash247 Maritime News",
    url: "https://splash247.com/feed/",
    keywords: [] as string[],
    minScore: 35,
  },
];

// ─── Marina Associations ──────────────────────────────────────────────────────
const MARINA_ASSOCIATION_FEEDS = [
  {
    name: "AMI - Association of Marina Industries",
    url: "https://marinaassociation.org/feed/",
    keywords: [] as string[],
    minScore: 35,
  },
  {
    name: "BoatUS News",
    url: "https://www.boatus.com/rss/news.xml",
    keywords: [] as string[],
    minScore: 35,
  },
];

// ─── Marina Web-Scrape Sources ────────────────────────────────────────────────
const MARINA_WEB_SCRAPE_FEEDS = [
  {
    name: "Marina World",
    url: "https://www.marinaworld.com/news",
    keywords: [] as string[],
    minScore: 35,
    sourceType: "web_scrape" as const,
  },
  {
    name: "NMMA - National Marine Manufacturers Association",
    url: "https://www.nmma.org/press/latest-news",
    keywords: [] as string[],
    minScore: 35,
    sourceType: "web_scrape" as const,
  },
  {
    name: "Marinas.com News",
    url: "https://www.marinas.com/news",
    keywords: [] as string[],
    minScore: 35,
    sourceType: "web_scrape" as const,
  },
  {
    name: "Waterway Guide News",
    url: "https://www.waterwayguide.com/news",
    keywords: [] as string[],
    minScore: 35,
    sourceType: "web_scrape" as const,
  },
];

// ─── General CRE ─────────────────────────────────────────────────────────────
const GENERAL_CRE_FEEDS = [
  {
    name: "GlobeSt - Commercial Real Estate",
    url: "https://www.globest.com/rss/",
    keywords: [] as string[],
    minScore: 35,
  },
  {
    name: "The Real Deal - National",
    url: "https://therealdeal.com/national/feed/",
    keywords: [] as string[],
    minScore: 35,
  },
  {
    name: "Commercial Observer",
    url: "https://commercialobserver.com/feed/",
    keywords: [] as string[],
    minScore: 35,
  },
  {
    name: "National Real Estate Investor (NREI)",
    url: "https://www.nreionline.com/rss/all",
    keywords: [] as string[],
    minScore: 35,
  },
  {
    name: "Connect CRE",
    url: "https://www.connect.media/feed/",
    keywords: [] as string[],
    minScore: 35,
  },
  {
    name: "CRE Daily",
    url: "https://credaily.com/feed/",
    keywords: [] as string[],
    minScore: 35,
  },
  {
    name: "Propmodo",
    url: "https://propmodo.com/feed/",
    keywords: [] as string[],
    minScore: 35,
  },
  {
    name: "Real Estate Business (REBusiness Online)",
    url: "https://rebusiness.com/feed/",
    keywords: [] as string[],
    minScore: 35,
  },
  {
    name: "Bisnow Real Estate",
    url: "https://www.bisnow.com/rss",
    keywords: [] as string[],
    minScore: 35,
  },
];

// ─── Multifamily ─────────────────────────────────────────────────────────────
const MULTIFAMILY_FEEDS = [
  {
    name: "Multi-Housing News",
    url: "https://www.multihousingnews.com/feed/",
    keywords: [] as string[],
    minScore: 35,
  },
  {
    name: "Multifamily Executive",
    url: "https://www.multifamilyexecutive.com/rss/all",
    keywords: [] as string[],
    minScore: 35,
  },
  {
    name: "Affordable Housing Finance",
    url: "https://www.housingfinance.com/feed/",
    keywords: [] as string[],
    minScore: 35,
  },
  {
    name: "Apartment List Blog",
    url: "https://www.apartmentlist.com/rpl/blog/feed/",
    keywords: [] as string[],
    minScore: 35,
  },
];

// ─── Self-Storage ─────────────────────────────────────────────────────────────
const SELF_STORAGE_FEEDS = [
  {
    name: "Inside Self-Storage",
    url: "https://www.insideselfstorage.com/rss/all",
    keywords: [] as string[],
    minScore: 35,
  },
];

// ─── Hotel / Hospitality ──────────────────────────────────────────────────────
const HOSPITALITY_FEEDS = [
  {
    name: "Hotel Management",
    url: "https://www.hotelmanagement.net/rss/all",
    keywords: [] as string[],
    minScore: 35,
  },
  {
    name: "Lodging Magazine",
    url: "https://lodgingmagazine.com/feed/",
    keywords: [] as string[],
    minScore: 35,
  },
  {
    name: "Hospitality Net",
    url: "https://www.hospitalitynet.org/news/feed/",
    keywords: [] as string[],
    minScore: 35,
  },
  {
    name: "Skift - Travel & Hospitality",
    url: "https://skift.com/feed/",
    keywords: ["hotel", "resort", "lodging", "hospitality", "airbnb", "vrbo", "short-term rental", "RevPAR"],
    minScore: 40,
  },
];

// ─── Short-Term Rental ────────────────────────────────────────────────────────
const STR_FEEDS = [
  {
    name: "VRM Intel - Vacation Rental",
    url: "https://vrmintel.com/feed/",
    keywords: [] as string[],
    minScore: 35,
  },
  {
    name: "Phocuswire - Travel Technology",
    url: "https://www.phocuswire.com/rss/all",
    keywords: ["airbnb", "vrbo", "short-term rental", "vacation rental", "OTA", "hotel", "hospitality"],
    minScore: 40,
  },
];

// ─── Senior Housing / Healthcare ─────────────────────────────────────────────
const SENIOR_HOUSING_FEEDS = [
  {
    name: "Senior Housing News",
    url: "https://seniorhousingnews.com/feed/",
    keywords: [] as string[],
    minScore: 35,
  },
  {
    name: "McKnight's Senior Living",
    url: "https://www.mcknightsseniorliving.com/feed/",
    keywords: [] as string[],
    minScore: 35,
  },
  {
    name: "NIC Notes - Senior Housing Research",
    url: "https://www.nic.org/blog/feed/",
    keywords: [] as string[],
    minScore: 35,
  },
];

// ─── Mobile Home Parks / Manufactured Housing ────────────────────────────────
const MOBILE_HOME_PARK_FEEDS = [
  {
    name: "MH Insider - Manufactured Housing",
    url: "https://mhinsider.com/feed/",
    keywords: [] as string[],
    minScore: 35,
  },
  {
    name: "Manufactured Housing Institute",
    url: "https://www.manufacturedhousing.org/news/feed/",
    keywords: [] as string[],
    minScore: 35,
  },
];

// ─── Car Wash ─────────────────────────────────────────────────────────────────
const CAR_WASH_FEEDS = [
  {
    name: "Professional Carwashing & Detailing",
    url: "https://www.professionalcarwashing.com/rss/all",
    keywords: [] as string[],
    minScore: 35,
  },
];

// ─── RV Parks / Outdoor Hospitality ──────────────────────────────────────────
const RV_PARK_FEEDS = [
  {
    name: "RV Business",
    url: "https://www.rvbusiness.com/feed/",
    keywords: [] as string[],
    minScore: 35,
  },
  {
    name: "RV Pro",
    url: "https://www.rvpro.com/feed/",
    keywords: [] as string[],
    minScore: 35,
  },
];

// ─── Retail ───────────────────────────────────────────────────────────────────
const RETAIL_FEEDS = [
  {
    name: "Chain Store Age",
    url: "https://chainstoreage.com/feed/",
    keywords: ["shopping center", "retail real estate", "net lease", "NNN", "retail acquisition", "REIT", "property"],
    minScore: 40,
  },
  {
    name: "Shopping Center Business",
    url: "https://shoppingcenterbusiness.com/feed/",
    keywords: [] as string[],
    minScore: 35,
  },
  {
    name: "Retail Dive",
    url: "https://www.retaildive.com/feeds/news/",
    keywords: ["shopping center", "retail real estate", "net lease", "store closure", "store opening", "REIT", "acquisition"],
    minScore: 40,
  },
];

// ─── Press Releases (broad, filtered by CRE keywords) ────────────────────────
const PRESS_RELEASE_FEEDS = [
  {
    name: "PR Newswire - Real Estate",
    url: "https://www.prnewswire.com/rss/news-releases-list.rss",
    keywords: CRE_KEYWORDS,
    minScore: 50,
  },
  {
    name: "GlobeNewswire - Maritime & Shipping",
    url: "https://www.globenewswire.com/RssFeed/industry/1055/Maritime%20and%20Shipping",
    keywords: CRE_KEYWORDS,
    minScore: 50,
  },
  {
    name: "BusinessWire - Real Estate",
    url: "https://feed.businesswire.com/rss/home/?rss=G1QFDERJXkJeEFpRXw==",
    keywords: CRE_KEYWORDS,
    minScore: 50,
  },
];

const ALL_FEEDS = [
  ...MARINA_FEEDS,
  ...MARINA_ASSOCIATION_FEEDS,
  ...MARINA_WEB_SCRAPE_FEEDS,
  ...GENERAL_CRE_FEEDS,
  ...MULTIFAMILY_FEEDS,
  ...SELF_STORAGE_FEEDS,
  ...HOSPITALITY_FEEDS,
  ...STR_FEEDS,
  ...SENIOR_HOUSING_FEEDS,
  ...MOBILE_HOME_PARK_FEEDS,
  ...CAR_WASH_FEEDS,
  ...RV_PARK_FEEDS,
  ...RETAIL_FEEDS,
  ...PRESS_RELEASE_FEEDS,
];

export async function seedTradePublicationFeeds(): Promise<{
  added: number;
  skipped: number;
  errors: string[];
}> {
  const results = { added: 0, skipped: 0, errors: [] as string[] };

  for (const feed of ALL_FEEDS) {
    try {
      const existing = await db.query.rssSources.findFirst({
        where: eq(rssSources.url, feed.url),
      });

      if (existing) {
        results.skipped++;
        continue;
      }

      const sourceType = (feed as any).sourceType || "rss";
      const customKeywords = feed.keywords && feed.keywords.length > 0 ? feed.keywords : null;

      await db.insert(rssSources).values({
        name: feed.name,
        url: feed.url,
        sourceType,
        isActive: true,
        minRelevanceScore: feed.minScore,
        customKeywords: customKeywords as string[] | null,
      });

      results.added++;
      console.log(`[Trade Pub Seed] Added: ${feed.name} (${sourceType})`);
    } catch (error: any) {
      results.errors.push(`${feed.name}: ${error.message}`);
      console.error(`[Trade Pub Seed] Failed to add ${feed.name}:`, error.message);
    }
  }

  console.log(`[Trade Pub Seed] Complete: ${results.added} added, ${results.skipped} skipped, ${results.errors.length} errors`);
  return results;
}

export async function updateTradePublicationKeywords(): Promise<{ updated: number }> {
  let updated = 0;
  for (const feed of PRESS_RELEASE_FEEDS) {
    try {
      const existing = await db.query.rssSources.findFirst({ where: eq(rssSources.url, feed.url) });
      if (existing) {
        await db.update(rssSources).set({ customKeywords: CRE_KEYWORDS }).where(eq(rssSources.id, existing.id));
        updated++;
      }
    } catch (error: any) {
      console.error(`[Trade Pub Update] Failed for ${feed.name}:`, error.message);
    }
  }
  console.log(`[Trade Pub Update] Updated keywords for ${updated} press release sources`);
  return { updated };
}

// Legacy exports for backward compatibility
export const TRADE_PUBLICATION_FEEDS = MARINA_FEEDS;
export const PRESS_RELEASE_FEEDS_EXPORT = PRESS_RELEASE_FEEDS;
export const ASSOCIATION_FEEDS = MARINA_ASSOCIATION_FEEDS;
export const WEB_SCRAPE_SOURCES = MARINA_WEB_SCRAPE_FEEDS;
export const ALL_FEEDS_EXPORT = ALL_FEEDS;
export const MARINA_KEYWORDS = CRE_KEYWORDS;
