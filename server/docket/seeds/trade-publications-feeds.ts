import { db } from "../db";
import { rssSources } from "@shared/docket-schema";
import { eq } from "drizzle-orm";

const MARINA_KEYWORDS = [
  "marina",
  "properties",
  "harbor",
  "harbour",
  "dock",
  "dockage",
  "waterfront",
  "boat",
  "boatyard",
  "yacht",
  "yacht club",
  "safe harbor",
  "suntex",
  "westrec",
  "marinas international",
  "igd marinas",
  "bellingham marine",
  "valvtect",
  "blackstone",
  "kkr",
  "brookfield",
  "acquisition",
  "purchase",
  "sale",
  "deal",
  "investment",
  "private equity",
  "real estate",
  "coastal",
  "port",
  "slip",
  "slips",
  "mooring",
  "moorage",
  "storage",
  "dry storage",
  "dry stack",
  "wet slip",
  "wet slips",
  "marina operator",
  "marina management",
  "boat launch",
  "boat ramp",
  "seawall",
  "bulkhead",
  "floating dock",
  "pier",
  "oasis marinas",
  "ocean havens",
  "nautical boat club",
];

const TRADE_PUBLICATION_FEEDS = [
  {
    name: "Trade Only Today - Marine Industry News",
    url: "https://www.tradeonlytoday.com/feed",
    category: "Trade Publication",
    description: "Daily boating news for marine industry professionals covering dealers, manufacturers, and marinas",
  },
  {
    name: "Boating Industry Magazine",
    url: "https://www.boatingindustry.com/feed/",
    category: "Trade Publication",
    description: "Business side of recreational boating with industry news and trends",
  },
  {
    name: "Marina Dock Age",
    url: "https://www.marinadockage.com/feed/",
    category: "Trade Publication",
    description: "Industry-leading magazine focused on marinas, docks, and harbor management",
  },
  {
    name: "Marinalife Magazine",
    url: "https://www.marinalife.com/rss/articles",
    category: "Trade Publication",
    description: "Marina communities and boating lifestyle news",
  },
  {
    name: "Professional Mariner",
    url: "https://professionalmariner.com/feed/",
    category: "Trade Publication",
    description: "Journal of the maritime industry for maritime professionals",
  },
  {
    name: "The Maritime Executive",
    url: "https://maritime-executive.com/rss",
    category: "Trade Publication",
    description: "Largest marine industry business journal",
  },
  {
    name: "Marine News Magazine",
    url: "https://www.marinemec.com/feed/",
    category: "Trade Publication",
    description: "North American workboat and marine industry news",
  },
  {
    name: "Splash247 Maritime News",
    url: "https://splash247.com/feed/",
    category: "Trade Publication",
    description: "Global maritime news and shipping industry updates",
  },
  {
    name: "Dockwalk - Yacht Industry",
    url: "https://www.dockwalk.com/rss.xml",
    category: "Trade Publication",
    description: "News for yacht captains, crews, and superyacht industry",
  },
  {
    name: "International Boat Industry (IBI)",
    url: "https://www.ibinews.com/feed",
    category: "Trade Publication",
    description: "Global leisure marine market tracking",
  },
  {
    name: "Soundings Trade Only",
    url: "http://soundingsonline.com/feed",
    category: "Trade Publication",
    description: "Recreational boating trade news",
  },
  {
    name: "WorkBoat Magazine",
    url: "https://www.workboat.com/feed",
    category: "Trade Publication",
    description: "Commercial marine and workboat industry news",
  },
];

const PRESS_RELEASE_FEEDS = [
  {
    name: "PR Newswire - Maritime",
    url: "https://www.prnewswire.com/rss/transportation-logistics-supply-chain-management-news.rss",
    category: "Press Release",
    description: "Transportation and logistics press releases including maritime",
  },
  {
    name: "GlobeNewswire - Maritime & Shipping",
    url: "https://www.globenewswire.com/RssFeed/industry/1055/Maritime%20and%20Shipping",
    category: "Press Release",
    description: "Maritime and shipping company announcements",
  },
  {
    name: "BusinessWire - Travel & Leisure",
    url: "https://feed.businesswire.com/rss/home/?rss=G1QFDERJXkJeEFpRXw==",
    category: "Press Release",
    description: "Travel and leisure industry press releases including boating",
  },
];

const WEB_SCRAPE_SOURCES = [
  {
    name: "Marina World",
    url: "https://www.marinaworld.com/news",
    category: "Trade Publication",
    description: "Global marina industry magazine covering marinas, pontoons, and harbor developments worldwide",
    sourceType: "web_scrape",
  },
  {
    name: "NMMA - National Marine Manufacturers Association",
    url: "https://www.nmma.org/press/latest-news",
    category: "Association",
    description: "Recreational boating industry association news and statistics",
    sourceType: "web_scrape",
  },
  {
    name: "Marinas.com News",
    url: "https://www.marinas.com/news",
    category: "Trade Publication",
    description: "Marina directory and industry news platform covering marina listings and industry updates",
    sourceType: "web_scrape",
  },
  {
    name: "Waterway Guide News",
    url: "https://www.waterwayguide.com/news",
    category: "Trade Publication",
    description: "Cruising guides and waterway news covering marinas, anchorages, and boating destinations",
    sourceType: "web_scrape",
  },
];

const ASSOCIATION_FEEDS = [
  {
    name: "AMI - Association of Marina Industries",
    url: "https://marinaassociation.org/feed/",
    category: "Association",
    description: "Marina industry association updates and advocacy",
  },
  {
    name: "BoatUS News",
    url: "https://www.boatus.com/rss/news.xml",
    category: "Association",
    description: "Boat Owners Association news and boating safety updates",
  },
];

const ALL_FEEDS = [
  ...TRADE_PUBLICATION_FEEDS,
  ...PRESS_RELEASE_FEEDS,
  ...ASSOCIATION_FEEDS,
  ...WEB_SCRAPE_SOURCES,
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
      
      await db.insert(rssSources).values({
        name: feed.name,
        url: feed.url,
        sourceType: sourceType,
        isActive: true,
        minRelevanceScore: feed.category === "Press Release" ? 50 : 35,
        customKeywords: MARINA_KEYWORDS,
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

export { TRADE_PUBLICATION_FEEDS, PRESS_RELEASE_FEEDS, ASSOCIATION_FEEDS, WEB_SCRAPE_SOURCES, ALL_FEEDS, MARINA_KEYWORDS };
