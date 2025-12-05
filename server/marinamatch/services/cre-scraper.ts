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
  type MarinaScrapeSource,
} from "@shared/schema";
import { extractListingsWithAI, validateExtractedListing, type ExtractedListing } from "./ai-extractor";
import { MultiPageCrawler, discoverListingUrls, estimateCrawlCost, type CrawlConfig } from "./multi-page-crawler";

interface ListingData {
  title: string;
  propertyName?: string;
  propertyAddress?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  askingPrice?: number;
  pricePerSlip?: number;
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
  ebitda?: number;
  occupancyRate?: number;
  marinaType?: string;
  propertyType?: string;
  dealType?: string;
  services?: string[];
  tenantSummary?: string;
  brokerName?: string;
  brokerCompany?: string;
  brokerPhone?: string;
  brokerEmail?: string;
  sourceUrl: string;
  sourceListingId?: string;
  originalDescription?: string;
  heroImageUrl?: string;
  images?: string[];
  listingDate?: Date;
  attributionText: string;
  confidence?: number;
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

// Source Configuration interface for filtering
export interface SourceConfig {
  keywordsInclude?: string[];
  keywordsExclude?: string[];
  geographyStates?: string[];
  minPrice?: string | number;
  maxPrice?: string | number;
  minSlips?: number;
  maxSlips?: number;
  propertyType?: string;
}

// Marina-focused keyword adapter - applies source filters to listings
export function applyMarinaKeywordFilter(
  listing: ListingData,
  config: SourceConfig
): { include: boolean; reason?: string } {
  const searchableText = [
    listing.title || "",
    listing.propertyName || "",
    listing.originalDescription || "",
    listing.propertyType || "",
    listing.marinaType || "",
  ].join(" ").toLowerCase();
  
  // Check include keywords - at least one must match
  if (config.keywordsInclude && config.keywordsInclude.length > 0) {
    const hasIncludeMatch = config.keywordsInclude.some(keyword => 
      searchableText.includes(keyword.toLowerCase().trim())
    );
    if (!hasIncludeMatch) {
      return { include: false, reason: `No match for include keywords: ${config.keywordsInclude.join(", ")}` };
    }
  }
  
  // Check exclude keywords - none should match
  if (config.keywordsExclude && config.keywordsExclude.length > 0) {
    const hasExcludeMatch = config.keywordsExclude.find(keyword => 
      searchableText.includes(keyword.toLowerCase().trim())
    );
    if (hasExcludeMatch) {
      return { include: false, reason: `Matched exclude keyword: ${hasExcludeMatch}` };
    }
  }
  
  // Check geography filter
  if (config.geographyStates && config.geographyStates.length > 0) {
    const listingState = listing.state?.toUpperCase();
    if (!listingState || !config.geographyStates.includes(listingState)) {
      return { include: false, reason: `State ${listingState || "unknown"} not in filter: ${config.geographyStates.join(", ")}` };
    }
  }
  
  // Check price range
  const listingPrice = listing.askingPrice;
  if (listingPrice !== undefined) {
    const minPrice = typeof config.minPrice === "string" ? parseFloat(config.minPrice) : config.minPrice;
    const maxPrice = typeof config.maxPrice === "string" ? parseFloat(config.maxPrice) : config.maxPrice;
    
    if (minPrice && listingPrice < minPrice) {
      return { include: false, reason: `Price $${listingPrice} below minimum $${minPrice}` };
    }
    if (maxPrice && listingPrice > maxPrice) {
      return { include: false, reason: `Price $${listingPrice} above maximum $${maxPrice}` };
    }
  }
  
  // Check slip count range
  const slipCount = listing.totalSlips;
  if (slipCount !== undefined) {
    if (config.minSlips && slipCount < config.minSlips) {
      return { include: false, reason: `Slip count ${slipCount} below minimum ${config.minSlips}` };
    }
    if (config.maxSlips && slipCount > config.maxSlips) {
      return { include: false, reason: `Slip count ${slipCount} above maximum ${config.maxSlips}` };
    }
  }
  
  return { include: true };
}

// Apply filters to an array of listings
export function filterListingsWithConfig(
  listings: ListingData[],
  config: SourceConfig
): { filtered: ListingData[]; rejected: Array<{ listing: ListingData; reason: string }> } {
  const filtered: ListingData[] = [];
  const rejected: Array<{ listing: ListingData; reason: string }> = [];
  
  for (const listing of listings) {
    const result = applyMarinaKeywordFilter(listing, config);
    if (result.include) {
      filtered.push(listing);
    } else {
      rejected.push({ listing, reason: result.reason || "Unknown" });
    }
  }
  
  return { filtered, rejected };
}

// Generate content hash for delta tracking
export function generateContentHash(listing: ListingData): string {
  const content = [
    listing.title,
    listing.askingPrice?.toString(),
    listing.totalSlips?.toString(),
    listing.grossRevenue?.toString(),
    listing.capRate?.toString(),
    listing.occupancyRate?.toString(),
    listing.originalDescription?.substring(0, 200),
  ].filter(Boolean).join("|");
  
  return crypto.createHash("md5").update(content).digest("hex");
}

// Convert AI-extracted listing to our standard ListingData format
function convertExtractedToListingData(extracted: ExtractedListing): ListingData {
  const totalSlips = extracted.totalSlips || 
    ((extracted.wetSlips || 0) + (extracted.dryStorageSpaces || 0)) || undefined;
  
  const pricePerSlip = extracted.pricePerSlip || 
    (extracted.askingPrice && totalSlips ? Math.round(extracted.askingPrice / totalSlips) : undefined);
  
  return {
    title: extracted.title || extracted.propertyName || "Untitled Marina",
    propertyName: extracted.propertyName,
    propertyAddress: extracted.propertyAddress,
    city: extracted.city,
    state: extracted.state,
    zipCode: extracted.zipCode,
    askingPrice: extracted.askingPrice,
    pricePerSlip,
    totalSlips,
    wetSlips: extracted.wetSlips,
    dryStorageSpaces: extracted.dryStorageSpaces,
    acreage: extracted.acreage,
    waterFrontage: extracted.waterFrontage,
    hasFuel: extracted.hasFuel,
    hasShipStore: extracted.hasShipStore,
    hasRestaurant: extracted.hasRestaurant,
    hasRepairShop: extracted.hasRepairShop,
    hasDryStorage: extracted.hasDryStorage,
    hasBoatRamp: extracted.hasBoatRamp,
    capRate: extracted.capRate,
    grossRevenue: extracted.grossRevenue,
    noi: extracted.noi,
    ebitda: extracted.ebitda,
    occupancyRate: extracted.occupancyRate,
    marinaType: extracted.marinaType,
    propertyType: extracted.propertyType || "marina",
    dealType: extracted.dealType || "acquisition",
    services: extracted.services,
    tenantSummary: extracted.tenantSummary,
    brokerName: extracted.brokerName,
    brokerCompany: extracted.brokerCompany,
    brokerPhone: extracted.brokerPhone,
    brokerEmail: extracted.brokerEmail,
    sourceUrl: extracted.sourceUrl,
    sourceListingId: extracted.sourceListingId,
    originalDescription: extracted.originalDescription,
    heroImageUrl: extracted.heroImageUrl,
    images: extracted.images,
    listingDate: extracted.listingDate ? new Date(extracted.listingDate) : undefined,
    attributionText: extracted.attributionText,
    confidence: extracted.confidence,
  };
}

// Minimum confidence threshold for accepting AI-extracted listings
const AI_CONFIDENCE_THRESHOLD = 50;

// Platform capability metadata - defines what methods work for each platform
export interface PlatformCapability {
  platform: string;
  displayName: string;
  capabilities: string[];
  blockedMethods: string[];
  accessNotes: string;
  apiInfo?: {
    available: boolean;
    contactUrl?: string;
    pricingInfo?: string;
  };
  scrapingStatus: "blocked" | "limited" | "allowed";
}

export const PLATFORM_CAPABILITIES: Record<string, PlatformCapability> = {
  loopnet: {
    platform: "loopnet",
    displayName: "LoopNet",
    capabilities: ["manual", "api"],
    blockedMethods: ["scraping"],
    accessNotes: "LoopNet blocks automated scraping. Data access requires CoStar Group API subscription.",
    apiInfo: {
      available: true,
      contactUrl: "https://www.costargroup.com/products/loopnet",
      pricingInfo: "Enterprise subscription required",
    },
    scrapingStatus: "blocked",
  },
  crexi: {
    platform: "crexi",
    displayName: "Crexi",
    capabilities: ["manual", "api"],
    blockedMethods: ["scraping"],
    accessNotes: "Crexi returns 403 errors for automated requests. Official API access may be available for partners.",
    apiInfo: {
      available: true,
      contactUrl: "https://www.crexi.com/contact",
      pricingInfo: "Contact for enterprise access",
    },
    scrapingStatus: "blocked",
  },
  bizbuysell: {
    platform: "bizbuysell",
    displayName: "BizBuySell",
    capabilities: ["manual"],
    blockedMethods: ["scraping", "api"],
    accessNotes: "BizBuySell uses aggressive rate limiting and CAPTCHA. Manual data entry or broker partnerships recommended.",
    scrapingStatus: "blocked",
  },
  costar: {
    platform: "costar",
    displayName: "CoStar",
    capabilities: ["api"],
    blockedMethods: ["scraping"],
    accessNotes: "CoStar requires paid API subscription. Premium data service for commercial real estate.",
    apiInfo: {
      available: true,
      contactUrl: "https://www.costargroup.com/products",
      pricingInfo: "Enterprise subscription required",
    },
    scrapingStatus: "blocked",
  },
  custom: {
    platform: "custom",
    displayName: "Custom Source",
    capabilities: ["manual", "scraping", "rss", "api"],
    blockedMethods: [],
    accessNotes: "Custom sources depend on the specific site's policies. Check robots.txt before automated access.",
    scrapingStatus: "allowed",
  },
};

// Get capabilities for a platform
export function getPlatformCapabilities(platform: string): PlatformCapability {
  const normalizedPlatform = platform.toLowerCase().replace(/\s+/g, "_");
  return PLATFORM_CAPABILITIES[normalizedPlatform] || PLATFORM_CAPABILITIES.custom;
}

// Check if a method is supported for a platform
export function isMethodSupported(platform: string, method: string): boolean {
  const capabilities = getPlatformCapabilities(platform);
  return capabilities.capabilities.includes(method.toLowerCase());
}

// Get recommended ingestion method for a platform
export function getRecommendedMethod(platform: string): string {
  const capabilities = getPlatformCapabilities(platform);
  if (capabilities.capabilities.includes("api") && capabilities.apiInfo?.available) {
    return "api";
  }
  if (capabilities.capabilities.includes("rss")) {
    return "rss";
  }
  return "manual";
}

export async function scrapeCrexi(searchQuery: string = "marina", maxPages: number = 3, searchUrl?: string): Promise<ListingData[]> {
  const platform = "crexi";
  const baseUrl = "https://www.crexi.com";
  const listings: ListingData[] = [];
  
  const targetUrl = searchUrl || `${baseUrl}/search?propertyType=marina`;
  
  console.log(`[${platform}] Attempting AI-powered extraction from: ${targetUrl}`);
  
  try {
    const aiResult = await extractListingsWithAI(targetUrl, "Crexi");
    
    if (aiResult.success && aiResult.listings.length > 0) {
      const validListings: ListingData[] = [];
      
      for (const extracted of aiResult.listings) {
        const validation = validateExtractedListing(extracted);
        
        if (extracted.confidence >= AI_CONFIDENCE_THRESHOLD && validation.valid) {
          validListings.push(convertExtractedToListingData(extracted));
        } else {
          console.log(`[${platform}] Skipping low-quality listing: ${extracted.title} (confidence: ${extracted.confidence}, issues: ${validation.issues.join(", ")})`);
        }
      }
      
      if (validListings.length > 0) {
        console.log(`[${platform}] AI extracted ${validListings.length} valid marina listings`);
        return validListings;
      }
    }
    
    console.log(`[${platform}] AI extraction returned no valid listings, trying DOM parsing...`);
  } catch (aiError: any) {
    console.log(`[${platform}] AI extraction failed: ${aiError.message}`);
  }
  
  const robotsCheck = await checkRobotsTxt(baseUrl, "/search");
  if (!robotsCheck.allowed) {
    console.log(`[${platform}] Scraping blocked by robots.txt - no listings available`);
    return [];
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
      
      const pageUrl = `${baseUrl}/search?propertyType=marina&page=${page}`;
      console.log(`[${platform}] Fetching page ${page}: ${pageUrl}`);
      
      const response = await client.get(pageUrl);
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
            sourceUrl: linkHref ? `${baseUrl}${linkHref}` : pageUrl,
            sourceListingId: listingId,
            attributionText: `Source: Crexi Commercial Real Estate - View original listing`,
            ...amenities,
          });
        } catch (err) {
          console.error(`[${platform}] Error parsing listing:`, err);
        }
      });
      
      if ($(".property-card, .listing-card").length === 0) break;
    }
    
    if (listings.length > 0) {
      console.log(`[${platform}] DOM parsing found ${listings.length} marina listings`);
      return listings;
    }
  } catch (error: any) {
    console.error(`[${platform}] DOM scraping error:`, error.message);
  }
  
  console.log(`[${platform}] All extraction methods failed - no listings available from this source`);
  return [];
}

export async function scrapeBizBuySell(maxPages: number = 3, searchUrl?: string): Promise<ListingData[]> {
  const platform = "bizbuysell";
  const baseUrl = "https://www.bizbuysell.com";
  const listings: ListingData[] = [];
  
  const targetUrl = searchUrl || `${baseUrl}/buy/all-businesses/marina-businesses-for-sale/`;
  
  console.log(`[${platform}] Attempting AI-powered extraction from: ${targetUrl}`);
  
  try {
    const aiResult = await extractListingsWithAI(targetUrl, "BizBuySell");
    
    if (aiResult.success && aiResult.listings.length > 0) {
      const validListings: ListingData[] = [];
      
      for (const extracted of aiResult.listings) {
        const validation = validateExtractedListing(extracted);
        
        if (extracted.confidence >= AI_CONFIDENCE_THRESHOLD && validation.valid) {
          validListings.push(convertExtractedToListingData(extracted));
        } else {
          console.log(`[${platform}] Skipping low-quality listing: ${extracted.title} (confidence: ${extracted.confidence}, issues: ${validation.issues.join(", ")})`);
        }
      }
      
      if (validListings.length > 0) {
        console.log(`[${platform}] AI extracted ${validListings.length} valid marina listings`);
        return validListings;
      }
    }
    
    console.log(`[${platform}] AI extraction returned no valid listings, trying DOM parsing...`);
  } catch (aiError: any) {
    console.log(`[${platform}] AI extraction failed: ${aiError.message}`);
  }
  
  const robotsCheck = await checkRobotsTxt(baseUrl, "/");
  if (!robotsCheck.allowed) {
    console.log(`[${platform}] Scraping blocked by robots.txt - no listings available`);
    return [];
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
      
      const pageUrl = `${baseUrl}/buy/all-businesses/marina-businesses-for-sale/?page=${page}`;
      console.log(`[${platform}] Fetching page ${page}: ${pageUrl}`);
      
      const response = await client.get(pageUrl);
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
            attributionText: `Source: BizBuySell - View original listing`,
            ...amenities,
          });
        } catch (err) {
          console.error(`[${platform}] Error parsing listing:`, err);
        }
      });
      
      if ($(".listing, .business-listing").length === 0) break;
    }
    
    if (listings.length > 0) {
      console.log(`[${platform}] DOM parsing found ${listings.length} marina listings`);
      return listings;
    }
  } catch (error: any) {
    console.error(`[${platform}] DOM scraping error:`, error.message);
  }
  
  console.log(`[${platform}] All extraction methods failed - no listings available from this source`);
  return [];
}

export async function scrapeLoopNet(searchUrl?: string): Promise<ListingData[]> {
  const platform = "loopnet";
  const baseUrl = "https://www.loopnet.com";
  const targetUrl = searchUrl || `${baseUrl}/search/commercial-real-estate/marina/`;
  
  console.log(`[${platform}] Attempting AI-powered extraction from: ${targetUrl}`);
  
  try {
    const aiResult = await extractListingsWithAI(targetUrl, "LoopNet");
    
    if (aiResult.success && aiResult.listings.length > 0) {
      const validListings: ListingData[] = [];
      
      for (const extracted of aiResult.listings) {
        const validation = validateExtractedListing(extracted);
        
        if (extracted.confidence >= AI_CONFIDENCE_THRESHOLD && validation.valid) {
          validListings.push(convertExtractedToListingData(extracted));
        } else {
          console.log(`[${platform}] Skipping: ${extracted.title} (confidence: ${extracted.confidence})`);
        }
      }
      
      if (validListings.length > 0) {
        console.log(`[${platform}] AI extracted ${validListings.length} valid marina listings`);
        return validListings;
      }
    }
  } catch (aiError: any) {
    console.log(`[${platform}] AI extraction failed: ${aiError.message}`);
  }
  
  console.log(`[${platform}] API access required for live data - no listings available from this source`);
  return [];
}

export async function scrapeCoStar(searchUrl?: string): Promise<ListingData[]> {
  const platform = "costar";
  const baseUrl = "https://www.costar.com";
  const targetUrl = searchUrl || `${baseUrl}/`;
  
  console.log(`[${platform}] Attempting AI-powered extraction from: ${targetUrl}`);
  
  try {
    const aiResult = await extractListingsWithAI(targetUrl, "CoStar");
    
    if (aiResult.success && aiResult.listings.length > 0) {
      const validListings: ListingData[] = [];
      
      for (const extracted of aiResult.listings) {
        const validation = validateExtractedListing(extracted);
        
        if (extracted.confidence >= AI_CONFIDENCE_THRESHOLD && validation.valid) {
          validListings.push(convertExtractedToListingData(extracted));
        } else {
          console.log(`[${platform}] Skipping: ${extracted.title} (confidence: ${extracted.confidence})`);
        }
      }
      
      if (validListings.length > 0) {
        console.log(`[${platform}] AI extracted ${validListings.length} valid marina listings`);
        return validListings;
      }
    }
  } catch (aiError: any) {
    console.log(`[${platform}] AI extraction failed: ${aiError.message}`);
  }
  
  console.log(`[${platform}] Subscription required for live data - no listings available from this source`);
  return [];
}

export async function scrapeLoopNetMetadata(): Promise<ListingData[]> {
  return scrapeLoopNet();
}

export async function scrapeCoStarMetadata(): Promise<ListingData[]> {
  return scrapeCoStar();
}

// New accessible source scrapers

async function scrapeGovDeals(): Promise<ListingData[]> {
  const { GovDealsAdapter } = await import("./source-adapters");
  const adapter = new GovDealsAdapter();
  const result = await adapter.fetchListings();
  return result.listings;
}

async function scrapePublicSurplus(): Promise<ListingData[]> {
  const { PublicSurplusAdapter } = await import("./source-adapters");
  const adapter = new PublicSurplusAdapter();
  const result = await adapter.fetchListings();
  return result.listings;
}

async function scrapeMarinaRSS(): Promise<ListingData[]> {
  const { MarinaIndustryRSSAdapter } = await import("./source-adapters");
  const adapter = new MarinaIndustryRSSAdapter();
  const result = await adapter.fetchListings();
  return result.listings;
}

// Custom broker source scraper - uses AI extraction for user-added sources
export async function scrapeCustomSource(searchUrl: string, sourceName: string): Promise<ListingData[]> {
  const platform = sourceName.toLowerCase().replace(/\s+/g, '_');
  
  console.log(`[${sourceName}] Attempting AI-powered extraction from: ${searchUrl}`);
  
  try {
    const aiResult = await extractListingsWithAI(searchUrl, sourceName);
    
    if (aiResult.success && aiResult.listings.length > 0) {
      const validListings: ListingData[] = [];
      
      for (const extracted of aiResult.listings) {
        const validation = validateExtractedListing(extracted);
        
        if (extracted.confidence >= AI_CONFIDENCE_THRESHOLD && validation.valid) {
          validListings.push(convertExtractedToListingData(extracted));
        } else {
          console.log(`[${sourceName}] Skipping low-quality listing: ${extracted.title} (confidence: ${extracted.confidence}, issues: ${validation.issues.join(", ")})`);
        }
      }
      
      if (validListings.length > 0) {
        console.log(`[${sourceName}] AI extracted ${validListings.length} valid marina listings`);
        return validListings;
      }
    }
    
    console.log(`[${sourceName}] AI extraction returned no valid listings`);
    return [];
  } catch (error: any) {
    console.error(`[${sourceName}] Scraping error:`, error.message);
    return [];
  }
}

export interface MultiPageScrapeResult {
  listings: ListingData[];
  pagesCrawled: number;
  pagesSkipped: number;
  linksDiscovered: number;
  tokensSpent: number;
  errors: string[];
  budgetExceeded: boolean;
}

export async function scrapeSourceWithMultiPage(
  source: MarinaScrapeSource
): Promise<MultiPageScrapeResult> {
  const result: MultiPageScrapeResult = {
    listings: [],
    pagesCrawled: 0,
    pagesSkipped: 0,
    linksDiscovered: 0,
    tokensSpent: 0,
    errors: [],
    budgetExceeded: false,
  };

  const sourceName = source.name;
  const crawlMode = (source.crawlMode as CrawlConfig["crawlMode"]) || "single";
  
  console.log(`[${sourceName}] Starting multi-page scrape with mode: ${crawlMode}`);

  const allUrls: string[] = [];
  
  if (source.seedUrls && source.seedUrls.length > 0) {
    allUrls.push(...source.seedUrls);
    console.log(`[${sourceName}] Using ${source.seedUrls.length} seed URLs`);
  }
  
  if (source.searchUrl && !allUrls.includes(source.searchUrl)) {
    allUrls.push(source.searchUrl);
  }

  if (allUrls.length === 0) {
    console.log(`[${sourceName}] No URLs configured for scraping`);
    return result;
  }

  if (crawlMode === "single" || crawlMode === "multi_seed") {
    for (const url of allUrls) {
      if (result.tokensSpent >= parseFloat(source.tokenBudgetPerRun?.toString() || "0.50")) {
        console.log(`[${sourceName}] Token budget exceeded, stopping`);
        result.budgetExceeded = true;
        break;
      }

      if (result.pagesCrawled >= (source.maxPagesPerRun || 10)) {
        console.log(`[${sourceName}] Max pages limit reached`);
        break;
      }

      try {
        const pageListings = await scrapeCustomSource(url, sourceName);
        result.listings.push(...pageListings);
        result.pagesCrawled++;
        result.tokensSpent += 0.03;
      } catch (error: any) {
        result.errors.push(`Error scraping ${url}: ${error.message}`);
      }
    }
  } else if (crawlMode === "pagination") {
    const crawlConfig: CrawlConfig = {
      seedUrls: allUrls,
      crawlMode: "pagination",
      paginationSelector: source.paginationSelector || undefined,
      paginationUrlPattern: source.paginationUrlPattern || undefined,
      listingLinkSelector: source.listingLinkSelector || undefined,
      maxPagesPerRun: source.maxPagesPerRun || 10,
      maxCrawlDepth: source.maxCrawlDepth || 1,
      tokenBudgetPerRun: parseFloat(source.tokenBudgetPerRun?.toString() || "0.50"),
      respectRobotsTxt: source.respectRobotsTxt ?? true,
      userAgent: source.userAgent || "MarinaMatchBot/1.0",
      rateLimitRpm: source.rateLimitRpm || 30,
    };

    const crawler = new MultiPageCrawler(crawlConfig, sourceName);
    const crawlResult = await crawler.crawl();
    
    result.pagesCrawled = crawlResult.pagesCrawled;
    result.pagesSkipped = crawlResult.pagesSkipped;
    result.linksDiscovered = crawlResult.linksDiscovered;
    result.budgetExceeded = crawlResult.budgetExceeded;
    result.errors.push(...crawlResult.errors);

    const urlsToScrape = crawlResult.listingUrls.length > 0 
      ? crawlResult.listingUrls 
      : crawlResult.pagesVisited;

    console.log(`[${sourceName}] Crawl found ${urlsToScrape.length} URLs to extract listings from`);

    for (const url of urlsToScrape) {
      if (result.tokensSpent >= parseFloat(source.tokenBudgetPerRun?.toString() || "0.50")) {
        result.budgetExceeded = true;
        break;
      }

      try {
        const pageListings = await scrapeCustomSource(url, sourceName);
        result.listings.push(...pageListings);
        result.tokensSpent += 0.03;
      } catch (error: any) {
        result.errors.push(`Error extracting from ${url}: ${error.message}`);
      }
    }
  }

  const uniqueListings = deduplicateListings(result.listings);
  result.listings = uniqueListings;

  console.log(`[${sourceName}] Multi-page scrape complete: ${result.listings.length} unique listings from ${result.pagesCrawled} pages`);

  return result;
}

function deduplicateListings(listings: ListingData[]): ListingData[] {
  const seen = new Map<string, ListingData>();
  
  for (const listing of listings) {
    const key = generateDedupeKey(listing);
    if (!seen.has(key)) {
      seen.set(key, listing);
    }
  }
  
  return Array.from(seen.values());
}

function generateDedupeKey(listing: ListingData): string {
  const parts = [
    listing.propertyName?.toLowerCase() || listing.title?.toLowerCase() || "",
    listing.city?.toLowerCase() || "",
    listing.state?.toLowerCase() || "",
    listing.askingPrice?.toString() || "",
  ].join("|");
  
  return crypto.createHash("md5").update(parts).digest("hex");
}

export async function runScrapeJob(
  orgId: string,
  platforms: string[] = ["crexi", "bizbuysell"]
): Promise<{
  totalFound: number;
  newListings: number;
  updatedListings: number;
  filteredOut: number;
  errors: string[];
}> {
  const results = {
    totalFound: 0,
    newListings: 0,
    updatedListings: 0,
    filteredOut: 0,
    errors: [] as string[],
  };
  
  // Fetch active source configurations for the org
  const activeSources = await db
    .select()
    .from(marinaScrapeources)
    .where(and(eq(marinaScrapeources.orgId, orgId), eq(marinaScrapeources.isActive, true)));
  
  // Build a map of platform to source config for filtering
  const platformConfigs: Record<string, SourceConfig> = {};
  const platformSources: Record<string, any> = {};
  
  for (const source of activeSources) {
    const platformKey = source.platform.toLowerCase();
    platformConfigs[platformKey] = {
      keywordsInclude: source.keywordsInclude || DEFAULT_MARINA_KEYWORDS,
      keywordsExclude: source.keywordsExclude || DEFAULT_EXCLUDE_KEYWORDS,
      geographyStates: source.geographyStates || undefined,
      minPrice: source.minPrice ? parseFloat(source.minPrice) : undefined,
      maxPrice: source.maxPrice ? parseFloat(source.maxPrice) : undefined,
      minSlips: source.minSlips || undefined,
      maxSlips: source.maxSlips || undefined,
    };
    platformSources[platformKey] = source;
  }
  
  const [scrapeRun] = await db.insert(marinaScrapeRuns).values({
    orgId,
    platform: platforms.join(","),
    status: "running",
    startedAt: new Date(),
  }).returning();
  
  try {
    const allListings: Array<{ data: ListingData; platform: string; sourceId?: string }> = [];
    
    for (const platform of platforms) {
      try {
        const platformKey = platform.toLowerCase();
        const sourceConfig = platformConfigs[platformKey];
        const source = platformSources[platformKey];
        
        // Skip if source is configured but not active
        if (source && !source.isActive) {
          console.log(`[${platform}] Source is disabled, skipping`);
          continue;
        }
        
        let platformListings: ListingData[] = [];
        const sourceSearchUrl = source?.searchUrl || undefined;
        
        switch (platform) {
          case "crexi":
            platformListings = await scrapeCrexi("marina", 3, sourceSearchUrl);
            break;
          case "bizbuysell":
            platformListings = await scrapeBizBuySell(3, sourceSearchUrl);
            break;
          case "loopnet":
            platformListings = await scrapeLoopNet(sourceSearchUrl);
            break;
          case "costar":
            platformListings = await scrapeCoStar(sourceSearchUrl);
            break;
          case "govdeals":
            platformListings = await scrapeGovDeals();
            break;
          case "publicsurplus":
            platformListings = await scrapePublicSurplus();
            break;
          case "marina_rss":
            platformListings = await scrapeMarinaRSS();
            break;
          default:
            // Handle custom/user-added broker sources using AI extraction
            if (source && sourceSearchUrl) {
              console.log(`[${platform}] Processing custom source: ${source.name}`);
              platformListings = await scrapeCustomSource(sourceSearchUrl, source.name || platform);
            } else {
              console.log(`[${platform}] Unknown platform or missing search URL`);
            }
        }
        
        // Apply source configuration filters if available
        if (sourceConfig && platformListings.length > 0) {
          console.log(`[${platform}] Applying source filters...`);
          const beforeCount = platformListings.length;
          
          const filteredListings = platformListings.filter(listing => {
            const filterResult = applyMarinaKeywordFilter(listing, sourceConfig);
            return filterResult.include;
          });
          
          const filteredOutCount = beforeCount - filteredListings.length;
          results.filteredOut += filteredOutCount;
          
          if (filteredOutCount > 0) {
            console.log(`[${platform}] Filtered out ${filteredOutCount} listings that don't match criteria`);
          }
          
          platformListings = filteredListings;
        }
        
        platformListings.forEach(l => allListings.push({ 
          data: l, 
          platform,
          sourceId: source?.id 
        }));
        
        // Update delta tracking on source if configured
        if (source && platformListings.length > 0) {
          const lastListing = platformListings[platformListings.length - 1];
          const contentHash = generateContentHash(lastListing);
          
          await db
            .update(marinaScrapeources)
            .set({
              lastSeenListingId: lastListing.sourceListingId || null,
              lastSeenContentHash: contentHash,
              lastDeltaCheckAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(marinaScrapeources.id, source.id));
        }
        
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
            pricePerSlip: data.pricePerSlip?.toString(),
            grossRevenue: data.grossRevenue?.toString(),
            noi: data.noi?.toString(),
            ebitda: data.ebitda?.toString(),
            capRate: data.capRate?.toString(),
            occupancyRate: data.occupancyRate?.toString(),
            brokerName: data.brokerName,
            brokerCompany: data.brokerCompany,
            brokerPhone: data.brokerPhone,
            brokerEmail: data.brokerEmail,
            attributionText: data.attributionText,
            originalDescription: data.originalDescription,
            heroImageUrl: data.heroImageUrl,
            images: data.images,
            services: data.services,
            tenantSummary: data.tenantSummary,
            extractionConfidence: data.confidence,
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
        details: { 
          errors: results.errors,
          filteredOut: results.filteredOut,
          sourcesUsed: Object.keys(platformConfigs).length,
        },
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
