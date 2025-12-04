import axios, { AxiosInstance } from "axios";
import * as cheerio from "cheerio";
import crypto from "crypto";
import { db } from "../../db";
import { eq, and, sql } from "drizzle-orm";
import {
  marinaListings,
  marinaScrapeources,
  marinaScrapeRuns,
  investmentCriteriaProfiles,
  marinaListingMatches,
  type MarinaListing,
} from "@shared/schema";

interface ListingData {
  title: string;
  propertyName?: string;
  propertyAddress?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  askingPrice?: number;
  totalSlips?: number;
  wetSlips?: number;
  dryStorageSpaces?: number;
  acreage?: number;
  waterFrontage?: number;
  hasFuel?: boolean;
  hasShipStore?: boolean;
  hasRestaurant?: boolean;
  hasRepairShop?: boolean;
  hasDryStorage?: boolean;
  hasBoatRamp?: boolean;
  capRate?: number;
  grossRevenue?: number;
  noi?: number;
  occupancyRate?: number;
  marinaType?: string;
  propertyType?: string;
  dealType?: string;
  brokerName?: string;
  brokerCompany?: string;
  brokerPhone?: string;
  brokerEmail?: string;
  sourceUrl: string;
  sourceListingId?: string;
  originalDescription?: string;
  images?: string[];
  listingDate?: Date;
  attributionText: string;
}

interface RateLimiter {
  lastRequest: number;
  minDelay: number; // ms between requests
}

const rateLimiters: Map<string, RateLimiter> = new Map();

async function enforceRateLimit(platform: string, rpm: number = 30): Promise<void> {
  const minDelay = Math.ceil(60000 / rpm); // Convert RPM to ms delay
  
  let limiter = rateLimiters.get(platform);
  if (!limiter) {
    limiter = { lastRequest: 0, minDelay };
    rateLimiters.set(platform, limiter);
  }
  
  const now = Date.now();
  const elapsed = now - limiter.lastRequest;
  
  if (elapsed < minDelay) {
    await new Promise(resolve => setTimeout(resolve, minDelay - elapsed));
  }
  
  limiter.lastRequest = Date.now();
}

async function checkRobotsTxt(baseUrl: string, path: string): Promise<{ allowed: boolean; crawlDelay?: number }> {
  try {
    const robotsUrl = new URL("/robots.txt", baseUrl).toString();
    const response = await axios.get(robotsUrl, { timeout: 5000 });
    const content = response.data as string;
    
    const lines = content.split("\n");
    let userAgentMatches = false;
    let crawlDelay: number | undefined;
    
    for (const line of lines) {
      const trimmed = line.trim().toLowerCase();
      
      if (trimmed.startsWith("user-agent:")) {
        const agent = trimmed.replace("user-agent:", "").trim();
        userAgentMatches = agent === "*" || agent.includes("marinamatch");
      }
      
      if (userAgentMatches) {
        if (trimmed.startsWith("disallow:")) {
          const disallowedPath = trimmed.replace("disallow:", "").trim();
          if (disallowedPath === "/" || path.startsWith(disallowedPath)) {
            return { allowed: false };
          }
        }
        
        if (trimmed.startsWith("crawl-delay:")) {
          crawlDelay = parseInt(trimmed.replace("crawl-delay:", "").trim()) * 1000;
        }
      }
    }
    
    return { allowed: true, crawlDelay };
  } catch {
    // If robots.txt doesn't exist or can't be fetched, assume allowed
    return { allowed: true };
  }
}

function generateDedupeHash(listing: Partial<ListingData>, platform: string): string {
  const normalizedAddress = (listing.propertyAddress || "").toLowerCase().replace(/\s+/g, " ").trim();
  const normalizedName = (listing.propertyName || listing.title || "").toLowerCase().replace(/\s+/g, " ").trim();
  const city = (listing.city || "").toLowerCase().trim();
  const state = (listing.state || "").toLowerCase().trim();
  
  const input = `${platform}|${normalizedName}|${normalizedAddress}|${city}|${state}`;
  return crypto.createHash("md5").update(input).digest("hex");
}

function extractPrice(text: string): number | undefined {
  const match = text.replace(/,/g, "").match(/\$?([\d.]+)\s*(million|m|k)?/i);
  if (match) {
    let value = parseFloat(match[1]);
    const multiplier = match[2]?.toLowerCase();
    if (multiplier === "million" || multiplier === "m") value *= 1000000;
    if (multiplier === "k") value *= 1000;
    return value;
  }
  return undefined;
}

function extractNumber(text: string): number | undefined {
  const match = text.replace(/,/g, "").match(/([\d.]+)/);
  return match ? parseFloat(match[1]) : undefined;
}

function parseState(stateOrCity: string): { city?: string; state?: string } {
  const states: Record<string, string> = {
    "alabama": "AL", "alaska": "AK", "arizona": "AZ", "arkansas": "AR", "california": "CA",
    "colorado": "CO", "connecticut": "CT", "delaware": "DE", "florida": "FL", "georgia": "GA",
    "hawaii": "HI", "idaho": "ID", "illinois": "IL", "indiana": "IN", "iowa": "IA",
    "kansas": "KS", "kentucky": "KY", "louisiana": "LA", "maine": "ME", "maryland": "MD",
    "massachusetts": "MA", "michigan": "MI", "minnesota": "MN", "mississippi": "MS", "missouri": "MO",
    "montana": "MT", "nebraska": "NE", "nevada": "NV", "new hampshire": "NH", "new jersey": "NJ",
    "new mexico": "NM", "new york": "NY", "north carolina": "NC", "north dakota": "ND", "ohio": "OH",
    "oklahoma": "OK", "oregon": "OR", "pennsylvania": "PA", "rhode island": "RI", "south carolina": "SC",
    "south dakota": "SD", "tennessee": "TN", "texas": "TX", "utah": "UT", "vermont": "VT",
    "virginia": "VA", "washington": "WA", "west virginia": "WV", "wisconsin": "WI", "wyoming": "WY"
  };
  
  const parts = stateOrCity.split(",").map(p => p.trim());
  const stateAbbr = parts[parts.length - 1]?.toUpperCase();
  
  if (stateAbbr && stateAbbr.length === 2) {
    return { city: parts.slice(0, -1).join(", "), state: stateAbbr };
  }
  
  for (const [name, abbr] of Object.entries(states)) {
    if (stateOrCity.toLowerCase().includes(name)) {
      return { state: abbr };
    }
  }
  
  return { city: stateOrCity };
}

function detectMarinaType(text: string): string | undefined {
  const lower = text.toLowerCase();
  if (lower.includes("dry stack") || lower.includes("dry-stack")) return "dry_stack";
  if (lower.includes("full service") || lower.includes("full-service")) return "full_service";
  if (lower.includes("yacht club")) return "yacht_club";
  if (lower.includes("mixed use") || lower.includes("mixed-use")) return "mixed";
  if (lower.includes("marina")) return "marina";
  if (lower.includes("boatyard")) return "boatyard";
  return undefined;
}

function detectAmenities(text: string): Partial<ListingData> {
  const lower = text.toLowerCase();
  return {
    hasFuel: lower.includes("fuel") || lower.includes("gas dock") || lower.includes("diesel"),
    hasShipStore: lower.includes("ship store") || lower.includes("chandlery") || lower.includes("marine store"),
    hasRestaurant: lower.includes("restaurant") || lower.includes("dining") || lower.includes("cafe"),
    hasRepairShop: lower.includes("repair") || lower.includes("service center") || lower.includes("mechanic"),
    hasDryStorage: lower.includes("dry storage") || lower.includes("dry stack"),
    hasBoatRamp: lower.includes("boat ramp") || lower.includes("launch ramp") || lower.includes("launch facility"),
  };
}

export async function scrapeCrexi(searchQuery: string = "marina", maxPages: number = 3): Promise<ListingData[]> {
  const platform = "crexi";
  const baseUrl = "https://www.crexi.com";
  const listings: ListingData[] = [];
  
  const robotsCheck = await checkRobotsTxt(baseUrl, "/search");
  if (!robotsCheck.allowed) {
    console.log(`[${platform}] Scraping blocked by robots.txt`);
    return listings;
  }
  
  const client = axios.create({
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.5",
    },
    timeout: 15000,
  });
  
  try {
    for (let page = 1; page <= maxPages; page++) {
      await enforceRateLimit(platform, 20);
      
      const searchUrl = `${baseUrl}/search?propertyType=marina&page=${page}`;
      console.log(`[${platform}] Fetching page ${page}: ${searchUrl}`);
      
      const response = await client.get(searchUrl);
      const $ = cheerio.load(response.data);
      
      $(".property-card, .listing-card, [data-listing-id]").each((_, element) => {
        try {
          const $el = $(element);
          const title = $el.find("h2, h3, .property-title, .listing-title").first().text().trim();
          const priceText = $el.find(".price, .listing-price, [data-price]").first().text().trim();
          const addressText = $el.find(".address, .location, .property-address").first().text().trim();
          const linkHref = $el.find("a").first().attr("href");
          const listingId = $el.attr("data-listing-id") || linkHref?.split("/").pop();
          
          if (!title || !title.toLowerCase().includes("marina")) return;
          
          const locationInfo = parseState(addressText);
          const amenities = detectAmenities(title + " " + $el.text());
          
          listings.push({
            title,
            propertyName: title,
            propertyAddress: addressText,
            city: locationInfo.city,
            state: locationInfo.state,
            askingPrice: extractPrice(priceText),
            marinaType: detectMarinaType(title + " " + $el.text()),
            propertyType: "marina",
            dealType: "acquisition",
            sourceUrl: linkHref ? `${baseUrl}${linkHref}` : searchUrl,
            sourceListingId: listingId,
            attributionText: `Source: Crexi Commercial Real Estate`,
            ...amenities,
          });
        } catch (err) {
          console.error(`[${platform}] Error parsing listing:`, err);
        }
      });
      
      if ($(".property-card, .listing-card").length === 0) break;
    }
    
    console.log(`[${platform}] Found ${listings.length} marina listings`);
  } catch (error: any) {
    console.error(`[${platform}] Scraping error:`, error.message);
  }
  
  return listings;
}

export async function scrapeBizBuySell(maxPages: number = 3): Promise<ListingData[]> {
  const platform = "bizbuysell";
  const baseUrl = "https://www.bizbuysell.com";
  const listings: ListingData[] = [];
  
  const robotsCheck = await checkRobotsTxt(baseUrl, "/");
  if (!robotsCheck.allowed) {
    console.log(`[${platform}] Scraping blocked by robots.txt`);
    return listings;
  }
  
  const client = axios.create({
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.5",
    },
    timeout: 15000,
  });
  
  try {
    for (let page = 1; page <= maxPages; page++) {
      await enforceRateLimit(platform, 15);
      
      const searchUrl = `${baseUrl}/buy/all-businesses/marina-businesses-for-sale/?page=${page}`;
      console.log(`[${platform}] Fetching page ${page}: ${searchUrl}`);
      
      const response = await client.get(searchUrl);
      const $ = cheerio.load(response.data);
      
      $(".listing, .business-listing, .search-result").each((_, element) => {
        try {
          const $el = $(element);
          const title = $el.find("h2, h3, .title a, .listing-title").first().text().trim();
          const priceText = $el.find(".price, .asking-price").first().text().trim();
          const locationText = $el.find(".location, .city-state").first().text().trim();
          const revenueText = $el.find(".revenue, .gross-revenue").first().text().trim();
          const linkHref = $el.find("a").first().attr("href");
          const description = $el.find(".description, .summary, p").first().text().trim();
          
          if (!title) return;
          
          const locationInfo = parseState(locationText);
          const amenities = detectAmenities(title + " " + description);
          
          listings.push({
            title,
            propertyName: title,
            city: locationInfo.city,
            state: locationInfo.state,
            askingPrice: extractPrice(priceText),
            grossRevenue: extractPrice(revenueText),
            marinaType: detectMarinaType(title + " " + description),
            propertyType: "marina",
            dealType: "acquisition",
            sourceUrl: linkHref?.startsWith("http") ? linkHref : `${baseUrl}${linkHref}`,
            originalDescription: description,
            attributionText: `Source: BizBuySell Business for Sale Listings`,
            ...amenities,
          });
        } catch (err) {
          console.error(`[${platform}] Error parsing listing:`, err);
        }
      });
      
      if ($(".listing, .business-listing").length === 0) break;
    }
    
    console.log(`[${platform}] Found ${listings.length} marina listings`);
  } catch (error: any) {
    console.error(`[${platform}] Scraping error:`, error.message);
  }
  
  return listings;
}

export async function scrapeLoopNetMetadata(): Promise<ListingData[]> {
  console.log("[loopnet] LoopNet requires API access for scraping. Using metadata-only mode.");
  console.log("[loopnet] Tip: Consider using LoopNet's Data Services API for compliant access.");
  
  return [];
}

export async function scrapeCoStarMetadata(): Promise<ListingData[]> {
  console.log("[costar] CoStar requires API access and subscription. Using metadata-only mode.");
  console.log("[costar] Tip: Contact CoStar Group for API access for commercial listings.");
  
  return [];
}

export async function runScrapeJob(
  orgId: string,
  platforms: string[] = ["crexi", "bizbuysell"]
): Promise<{
  totalFound: number;
  newListings: number;
  updatedListings: number;
  errors: string[];
}> {
  const results = {
    totalFound: 0,
    newListings: 0,
    updatedListings: 0,
    errors: [] as string[],
  };
  
  const [scrapeRun] = await db.insert(marinaScrapeRuns).values({
    orgId,
    platform: platforms.join(","),
    status: "running",
    startedAt: new Date(),
  }).returning();
  
  try {
    const allListings: Array<{ data: ListingData; platform: string }> = [];
    
    for (const platform of platforms) {
      try {
        let platformListings: ListingData[] = [];
        
        switch (platform) {
          case "crexi":
            platformListings = await scrapeCrexi();
            break;
          case "bizbuysell":
            platformListings = await scrapeBizBuySell();
            break;
          case "loopnet":
            platformListings = await scrapeLoopNetMetadata();
            break;
          case "costar":
            platformListings = await scrapeCoStarMetadata();
            break;
          default:
            console.log(`[${platform}] Unknown platform`);
        }
        
        platformListings.forEach(l => allListings.push({ data: l, platform }));
      } catch (error: any) {
        results.errors.push(`${platform}: ${error.message}`);
      }
    }
    
    results.totalFound = allListings.length;
    
    for (const { data, platform } of allListings) {
      try {
        const dedupeHash = generateDedupeHash(data, platform);
        
        const [existingListing] = await db
          .select()
          .from(marinaListings)
          .where(and(eq(marinaListings.orgId, orgId), eq(marinaListings.dedupeHash, dedupeHash)))
          .limit(1);
        
        if (existingListing) {
          await db
            .update(marinaListings)
            .set({
              askingPrice: data.askingPrice?.toString(),
              grossRevenue: data.grossRevenue?.toString(),
              noi: data.noi?.toString(),
              capRate: data.capRate?.toString(),
              occupancyRate: data.occupancyRate?.toString(),
              lastScrapedAt: new Date(),
              updatedAt: new Date(),
              scrapeRunId: scrapeRun.id,
            })
            .where(eq(marinaListings.id, existingListing.id));
          
          results.updatedListings++;
        } else {
          const [newListing] = await db.insert(marinaListings).values({
            orgId,
            sourcePlatform: platform,
            sourceUrl: data.sourceUrl,
            sourceListingId: data.sourceListingId,
            scrapeRunId: scrapeRun.id,
            dedupeHash,
            title: data.title,
            propertyName: data.propertyName,
            propertyAddress: data.propertyAddress,
            city: data.city,
            state: data.state,
            zipCode: data.zipCode,
            marinaType: data.marinaType,
            propertyType: data.propertyType,
            dealType: data.dealType,
            totalSlips: data.totalSlips,
            wetSlips: data.wetSlips,
            dryStorageSpaces: data.dryStorageSpaces,
            acreage: data.acreage?.toString(),
            waterFrontage: data.waterFrontage?.toString(),
            hasFuel: data.hasFuel,
            hasShipStore: data.hasShipStore,
            hasRestaurant: data.hasRestaurant,
            hasRepairShop: data.hasRepairShop,
            hasDryStorage: data.hasDryStorage,
            hasBoatRamp: data.hasBoatRamp,
            askingPrice: data.askingPrice?.toString(),
            grossRevenue: data.grossRevenue?.toString(),
            noi: data.noi?.toString(),
            capRate: data.capRate?.toString(),
            occupancyRate: data.occupancyRate?.toString(),
            brokerName: data.brokerName,
            brokerCompany: data.brokerCompany,
            brokerPhone: data.brokerPhone,
            brokerEmail: data.brokerEmail,
            attributionText: data.attributionText,
            originalDescription: data.originalDescription,
            images: data.images,
            listingDate: data.listingDate,
            status: "active",
          }).returning();
          
          results.newListings++;
          
          await scoreListing(newListing.id, orgId);
        }
      } catch (error: any) {
        results.errors.push(`Insert error: ${error.message}`);
      }
    }
    
    await db
      .update(marinaScrapeRuns)
      .set({
        status: "completed",
        listingsFound: results.totalFound,
        listingsNew: results.newListings,
        listingsUpdated: results.updatedListings,
        errorsCount: results.errors.length,
        completedAt: new Date(),
        durationMs: Date.now() - scrapeRun.startedAt!.getTime(),
        details: { errors: results.errors },
      })
      .where(eq(marinaScrapeRuns.id, scrapeRun.id));
    
  } catch (error: any) {
    await db
      .update(marinaScrapeRuns)
      .set({
        status: "failed",
        errorMessage: error.message,
        completedAt: new Date(),
      })
      .where(eq(marinaScrapeRuns.id, scrapeRun.id));
    
    throw error;
  }
  
  return results;
}

async function scoreListing(listingId: string, orgId: string): Promise<void> {
  const [listing] = await db.select().from(marinaListings).where(eq(marinaListings.id, listingId));
  if (!listing) return;
  
  const profiles = await db
    .select()
    .from(investmentCriteriaProfiles)
    .where(and(eq(investmentCriteriaProfiles.orgId, orgId), eq(investmentCriteriaProfiles.isActive, true)));
  
  let bestScore = 0;
  let bestProfileId: string | null = null;
  
  for (const profile of profiles) {
    const score = 50 + Math.floor(Math.random() * 50); // Placeholder - actual scoring in intel-routes.ts
    
    if (score > bestScore) {
      bestScore = score;
      bestProfileId = profile.id;
    }
  }
  
  if (bestProfileId) {
    await db
      .update(marinaListings)
      .set({
        bestCriteriaId: bestProfileId,
        bestMatchScore: bestScore,
        updatedAt: new Date(),
      })
      .where(eq(marinaListings.id, listingId));
  }
}

export async function getScrapingStats(orgId: string) {
  const runs = await db
    .select()
    .from(marinaScrapeRuns)
    .where(eq(marinaScrapeRuns.orgId, orgId))
    .orderBy(sql`${marinaScrapeRuns.startedAt} DESC`)
    .limit(10);
  
  const sources = await db
    .select()
    .from(marinaScrapeources)
    .where(eq(marinaScrapeources.orgId, orgId));
  
  const listings = await db
    .select()
    .from(marinaListings)
    .where(eq(marinaListings.orgId, orgId));
  
  return {
    totalListings: listings.length,
    activeListings: listings.filter(l => l.status === "active").length,
    recentRuns: runs,
    sources,
    listingsByPlatform: listings.reduce((acc: Record<string, number>, l) => {
      acc[l.sourcePlatform] = (acc[l.sourcePlatform] || 0) + 1;
      return acc;
    }, {}),
  };
}
