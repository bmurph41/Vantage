import { db } from "../db";
import { rssSources } from "@shared/docket-schema";
import { eq } from "drizzle-orm";

const MARINA_KEYWORDS = [
  "marina",
  "marinas",
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
  "boat storage",
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
];

const BIZJOURNALS_REGIONAL_FEEDS = [
  {
    name: "BizJournals Baltimore/DC (Mid-Atlantic)",
    url: "https://feeds.bizjournals.com/bizj_baltimore",
    region: "Mid-Atlantic",
  },
  {
    name: "BizJournals Washington DC",
    url: "https://feeds.bizjournals.com/bizj_washington",
    region: "Mid-Atlantic",
  },
  {
    name: "BizJournals South Florida",
    url: "https://feeds.bizjournals.com/bizj_southflorida",
    region: "Florida",
  },
  {
    name: "BizJournals Tampa Bay",
    url: "https://feeds.bizjournals.com/bizj_tampabay",
    region: "Florida",
  },
  {
    name: "BizJournals Jacksonville",
    url: "https://feeds.bizjournals.com/bizj_jacksonville",
    region: "Florida",
  },
  {
    name: "BizJournals Orlando",
    url: "https://feeds.bizjournals.com/bizj_orlando",
    region: "Florida",
  },
  {
    name: "BizJournals Charlotte (Carolinas)",
    url: "https://feeds.bizjournals.com/bizj_charlotte",
    region: "Carolinas",
  },
  {
    name: "BizJournals Raleigh-Durham (Triangle)",
    url: "https://feeds.bizjournals.com/bizj_triangle",
    region: "Carolinas",
  },
  {
    name: "BizJournals Atlanta (Georgia)",
    url: "https://feeds.bizjournals.com/bizj_atlanta",
    region: "Southeast",
  },
  {
    name: "BizJournals Houston (Texas Gulf)",
    url: "https://feeds.bizjournals.com/bizj_houston",
    region: "Gulf Coast",
  },
  {
    name: "BizJournals San Antonio",
    url: "https://feeds.bizjournals.com/bizj_sanantonio",
    region: "Gulf Coast",
  },
  {
    name: "BizJournals New Orleans",
    url: "https://feeds.bizjournals.com/bizj_neworleans",
    region: "Gulf Coast",
  },
  {
    name: "BizJournals San Francisco Bay",
    url: "https://feeds.bizjournals.com/bizj_sanfrancisco",
    region: "Pacific",
  },
  {
    name: "BizJournals Los Angeles",
    url: "https://feeds.bizjournals.com/bizj_losangeles",
    region: "Pacific",
  },
  {
    name: "BizJournals San Diego",
    url: "https://feeds.bizjournals.com/bizj_sandiego",
    region: "Pacific",
  },
  {
    name: "BizJournals Seattle (Pacific NW)",
    url: "https://feeds.bizjournals.com/bizj_seattle",
    region: "Pacific Northwest",
  },
  {
    name: "BizJournals Portland",
    url: "https://feeds.bizjournals.com/bizj_portland",
    region: "Pacific Northwest",
  },
  {
    name: "BizJournals Boston (New England)",
    url: "https://feeds.bizjournals.com/bizj_boston",
    region: "Northeast",
  },
  {
    name: "BizJournals New York",
    url: "https://feeds.bizjournals.com/bizj_newyork",
    region: "Northeast",
  },
  {
    name: "BizJournals Philadelphia",
    url: "https://feeds.bizjournals.com/bizj_philadelphia",
    region: "Northeast",
  },
  {
    name: "BizJournals Chicago (Great Lakes)",
    url: "https://feeds.bizjournals.com/bizj_chicago",
    region: "Great Lakes",
  },
  {
    name: "BizJournals Cleveland",
    url: "https://feeds.bizjournals.com/bizj_cleveland",
    region: "Great Lakes",
  },
  {
    name: "BizJournals Detroit",
    url: "https://feeds.bizjournals.com/bizj_detroit",
    region: "Great Lakes",
  },
  {
    name: "BizJournals Milwaukee",
    url: "https://feeds.bizjournals.com/bizj_milwaukee",
    region: "Great Lakes",
  },
  {
    name: "BizJournals Minneapolis",
    url: "https://feeds.bizjournals.com/bizj_minneapolis",
    region: "Great Lakes",
  },
  {
    name: "BizJournals Honolulu (Hawaii)",
    url: "https://feeds.bizjournals.com/bizj_pacificbusiness",
    region: "Pacific",
  },
  {
    name: "BizJournals Charleston (South Carolina)",
    url: "https://feeds.bizjournals.com/bizj_charleston",
    region: "Carolinas",
  },
  {
    name: "BizJournals Hampton Roads/Norfolk (Virginia)",
    url: "https://feeds.bizjournals.com/bizj_hamptonroads",
    region: "Mid-Atlantic",
  },
  {
    name: "BizJournals Puget Sound",
    url: "https://feeds.bizjournals.com/bizj_pugetsound",
    region: "Pacific Northwest",
  },
  {
    name: "BizJournals Sacramento (California)",
    url: "https://feeds.bizjournals.com/bizj_sacramento",
    region: "Pacific",
  },
  {
    name: "BizJournals Providence (Rhode Island)",
    url: "https://feeds.bizjournals.com/bizj_providence",
    region: "Northeast",
  },
  {
    name: "BizJournals Buffalo (Western NY)",
    url: "https://feeds.bizjournals.com/bizj_buffalo",
    region: "Great Lakes",
  },
  {
    name: "BizJournals Louisville (Ohio River)",
    url: "https://feeds.bizjournals.com/bizj_louisville",
    region: "Midwest",
  },
  {
    name: "BizJournals Memphis (Mississippi River)",
    url: "https://feeds.bizjournals.com/bizj_memphis",
    region: "Midwest",
  },
  {
    name: "BizJournals Daytona Beach (Florida)",
    url: "https://feeds.bizjournals.com/bizj_daytonabeach",
    region: "Florida",
  },
];

export async function seedBizJournalsFeeds(): Promise<{
  added: number;
  skipped: number;
  errors: string[];
}> {
  const results = { added: 0, skipped: 0, errors: [] as string[] };

  for (const feed of BIZJOURNALS_REGIONAL_FEEDS) {
    try {
      const existing = await db.query.rssSources.findFirst({
        where: eq(rssSources.url, feed.url),
      });

      if (existing) {
        results.skipped++;
        continue;
      }

      await db.insert(rssSources).values({
        name: feed.name,
        url: feed.url,
        sourceType: "rss",
        isActive: true,
        minRelevanceScore: 40,
        customKeywords: MARINA_KEYWORDS,
      });

      results.added++;
      console.log(`[BizJournals Seed] Added: ${feed.name}`);
    } catch (error: any) {
      results.errors.push(`${feed.name}: ${error.message}`);
      console.error(`[BizJournals Seed] Failed to add ${feed.name}:`, error.message);
    }
  }

  console.log(`[BizJournals Seed] Complete: ${results.added} added, ${results.skipped} skipped, ${results.errors.length} errors`);
  return results;
}

export async function updateBizJournalsKeywords(): Promise<{ updated: number }> {
  let updated = 0;
  
  for (const feed of BIZJOURNALS_REGIONAL_FEEDS) {
    try {
      const existing = await db.query.rssSources.findFirst({
        where: eq(rssSources.url, feed.url),
      });
      
      if (existing) {
        await db.update(rssSources)
          .set({ customKeywords: MARINA_KEYWORDS })
          .where(eq(rssSources.id, existing.id));
        updated++;
      }
    } catch (error: any) {
      console.error(`[BizJournals Update] Failed to update ${feed.name}:`, error.message);
    }
  }
  
  console.log(`[BizJournals Update] Updated keywords for ${updated} sources`);
  return { updated };
}

export { BIZJOURNALS_REGIONAL_FEEDS, MARINA_KEYWORDS };
