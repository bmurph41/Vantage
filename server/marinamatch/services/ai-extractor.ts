import OpenAI from "openai";
import * as cheerio from "cheerio";
import { smartFetch, SmartFetchResult } from "./headless-fetcher";
import { extractListingsWithDOM } from "./dom-extractor";

// Use Replit AI Integrations if available (billed to Replit credits), otherwise fall back to user's OpenAI key
const openai = new OpenAI({ 
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL || undefined,
});

function isOpenAIRateLimitError(error: any): boolean {
  if (!error) return false;
  const message = error.message?.toLowerCase() || "";
  const status = error.status || error.statusCode || 0;
  return (
    status === 429 ||
    message.includes("rate limit") ||
    message.includes("quota exceeded") ||
    message.includes("insufficient_quota") ||
    message.includes("429")
  );
}

function isAllowedUrl(url: string): { allowed: boolean; reason?: string } {
  try {
    const parsed = new URL(url);
    
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return { allowed: false, reason: "Only HTTP/HTTPS protocols allowed" };
    }
    
    if (parsed.hostname === "localhost" || parsed.hostname.startsWith("127.") || 
        parsed.hostname.startsWith("10.") || parsed.hostname.startsWith("192.168.") ||
        parsed.hostname.startsWith("172.") || parsed.hostname === "0.0.0.0") {
      return { allowed: false, reason: "Private/localhost URLs not allowed" };
    }
    
    return { allowed: true };
  } catch {
    return { allowed: false, reason: "Invalid URL format" };
  }
}

export interface ExtractedListing {
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
  hasLaundry?: boolean;
  hasPool?: boolean;
  hasTransientSlips?: boolean;
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
  listingDate?: string;
  attributionText: string;
  confidence: number;
}

interface ExtractionResult {
  success: boolean;
  listings: ExtractedListing[];
  error?: string;
  tokensUsed?: number;
}

const MARINA_EXTRACTION_PROMPT = `You are an expert marina property data extraction specialist. Your job is to analyze broker listing pages and extract MAXIMUM detail about marina properties for sale.

CRITICAL: Extract as much detail as possible. Return a JSON object with a "listings" array.

For EACH marina listing found, extract:

## PROPERTY IDENTIFICATION
- title: Clean listing title (e.g., "Sunset Marina - 85 Slips on ICW")
- propertyName: Official marina name (cleaned, professional)
- propertyAddress: Street address
- city: City name
- state: 2-letter state code (FL, CA, TX, etc.)
- zipCode: ZIP code
- sourceListingId: Any listing reference number

## HERO IMAGE (CRITICAL - DO NOT MIX UP BETWEEN LISTINGS)
- heroImageUrl: The MAIN property photo URL for THIS SPECIFIC LISTING ONLY
  * ONLY use [IMAGE: url] markers that appear WITHIN the same listing section
  * When listings are separated by "--- LISTING X ---" markers, only use images from that section
  * Do NOT assign images from one listing to another
  * If no image is found within the listing section, leave heroImageUrl empty (null)
  * MUST be a full URL (https://...)
  * Prefer exterior marina shots over logos/icons

## MARINA CAPACITY (VERY IMPORTANT)
- totalSlips: Total slips (wet + dry) - CALCULATE if needed
- wetSlips: Number of wet (in-water) slips
- dryStorageSpaces: Number of dry storage/rack spaces
- acreage: Property size in acres
- waterFrontage: Water frontage in feet

## FINANCIALS (Extract all available)
- askingPrice: Asking price (NUMBER ONLY, no $ or commas)
- pricePerSlip: Calculate if askingPrice and totalSlips known
- grossRevenue: Annual gross revenue (number)
- noi: Net Operating Income (number)
- ebitda: EBITDA if mentioned (number)
- capRate: Cap rate as decimal (7.5 for 7.5%)
- occupancyRate: Occupancy as percentage (95 for 95%)

## AMENITIES (Boolean flags - check description carefully)
- hasFuel: Gas/diesel dock present
- hasShipStore: Ship store, chandlery, marine supplies
- hasRestaurant: Restaurant, bar, grill on site
- hasRepairShop: Repair shop, service center, maintenance
- hasDryStorage: Dry stack, rack storage, indoor storage
- hasBoatRamp: Boat ramp, launch facility
- hasLaundry: Laundry facilities
- hasPool: Pool or clubhouse amenities
- hasTransientSlips: Transient/guest slip availability

## SERVICES OFFERED (Array of strings)
- services: ["fuel sales", "boat repair", "boat sales", "haul-out", "bottom paint", "engine service", "fiberglass repair", "upholstery", "detailing", "winter storage", "transient dockage", "pump-out", "electric hookups", "water hookups", "wifi", "cable tv", "security", "laundry", "showers", "restrooms"]
  Extract ALL services mentioned in description.

## TENANT/OCCUPANCY INFO
- tenantSummary: Summary of tenant mix (e.g., "85% occupied, mix of sailboats and powerboats, average tenant tenure 3+ years")

## MARINA TYPE
- marinaType: One of: "marina", "yacht_club", "boatyard", "dry_stack", "full_service", "mixed_use", "resort_marina"
- dealType: "acquisition", "ground_lease", "sale_leaseback", "partnership", "business_only"

## BROKER INFO
- brokerName: Full name
- brokerCompany: Company name
- brokerPhone: Phone number
- brokerEmail: Email address

## DESCRIPTION
- originalDescription: Full property description (first 2000 chars)

## CONFIDENCE
- confidence: 0-100 score based on data completeness and clarity

RULES:
1. ONLY extract marina/boatyard/yacht club properties - skip warehouses, RV parks, apartments
2. SKIP SOLD LISTINGS: Do NOT extract any listing marked as "Sold", "Closed", "Recently Sold", "Recently Closed", "Under Contract", "Pending Sale", or "Sale Pending". Only extract ACTIVE listings that are currently for sale.
3. Convert ALL prices to numbers (no $, commas, or text)
4. Calculate pricePerSlip = askingPrice / totalSlips when both available
5. Look for images marked as [IMAGE: url] and extract the best property photo as heroImageUrl
6. Parse amenities from description text carefully - look for keywords
7. Extract ALL services mentioned, even if in passing
8. For occupancy, look for "X% occupied", "X slips rented", waitlist mentions
9. Provide high confidence (80+) only when data is clearly stated, not inferred

EXAMPLE OUTPUT:
{
  "listings": [
    {
      "title": "Sunset Marina - 85 Slip Full-Service Marina",
      "propertyName": "Sunset Marina",
      "city": "Fort Lauderdale",
      "state": "FL",
      "heroImageUrl": "https://broker-site.com/images/sunset-marina-main.jpg",
      "totalSlips": 85,
      "wetSlips": 65,
      "dryStorageSpaces": 20,
      "askingPrice": 8500000,
      "pricePerSlip": 100000,
      "grossRevenue": 1200000,
      "capRate": 7.5,
      "occupancyRate": 95,
      "hasFuel": true,
      "hasShipStore": true,
      "hasRepairShop": true,
      "services": ["fuel sales", "boat repair", "haul-out", "transient dockage", "pump-out"],
      "tenantSummary": "95% occupied with waitlist, average tenant 5+ years",
      "marinaType": "full_service",
      "brokerName": "John Smith",
      "brokerCompany": "Marina Brokers Inc",
      "confidence": 85
    }
  ]
}`;

interface FetchResult {
  html: string;
  fetchMethod: "static" | "headless";
  renderTimeMs: number;
}

interface FetchOptions {
  forceHeadless?: boolean;
}

async function fetchPageContent(url: string, options: FetchOptions = {}): Promise<FetchResult> {
  const urlCheck = isAllowedUrl(url);
  if (!urlCheck.allowed) {
    throw new Error(`URL not allowed: ${urlCheck.reason}`);
  }
  
  const result = await smartFetch(url, {
    waitForTimeout: 2000,
    scrollToBottom: true,
    blockImages: false,
    blockFonts: true,
    forceHeadless: options.forceHeadless,
  });
  
  if (!result.success) {
    throw new Error(`Failed to fetch page: ${result.error}`);
  }
  
  console.log(`[AI Extractor] Fetched via ${result.fetchMethod} in ${result.renderTimeMs}ms`);
  
  return {
    html: result.html,
    fetchMethod: result.fetchMethod,
    renderTimeMs: result.renderTimeMs,
  };
}

function cleanHtmlForAI(html: string): string {
  const $ = cheerio.load(html);
  
  $("script, style, noscript, iframe, svg, nav, footer, header").remove();
  $("[style*='display:none'], [style*='display: none'], .hidden, .d-none").remove();
  
  // Remove icons, logos, and small UI images that aren't property photos
  $("img").each((_, el) => {
    const src = $(el).attr("src") || $(el).attr("data-src") || "";
    const alt = ($(el).attr("alt") || "").toLowerCase();
    const className = ($(el).attr("class") || "").toLowerCase();
    
    // Skip icons, logos, avatars, UI elements
    const isUIElement = 
      src.includes("icon") || src.includes("logo") || src.includes("avatar") ||
      src.includes("placeholder") || src.includes("default") ||
      src.includes("user") || src.includes("profile") ||
      alt.includes("icon") || alt.includes("logo") ||
      className.includes("icon") || className.includes("logo") || className.includes("avatar");
    
    // Skip small images (tracking pixels, badges, etc.)
    const width = parseInt($(el).attr("width") || "0");
    const height = parseInt($(el).attr("height") || "0");
    const isTooSmall = (width > 0 && width < 100) || (height > 0 && height < 100);
    
    if (src && !isUIElement && !isTooSmall) {
      // Make URL absolute if needed
      const absoluteSrc = src.startsWith("http") ? src : src;
      $(el).replaceWith(`[IMAGE: ${absoluteSrc}]`);
    } else {
      $(el).remove();
    }
  });
  
  // Try to find listing cards/sections and process them individually
  const listingSelectors = [
    ".listing-card", ".property-card", ".result-card", ".search-result",
    "[data-listing]", "[data-property]", ".listing-item", ".property-item",
    "article.listing", "article.property", ".card"
  ];
  
  let structuredListings: string[] = [];
  for (const selector of listingSelectors) {
    const cards = $(selector);
    if (cards.length > 1) {
      cards.each((i, el) => {
        const cardText = $(el).text().replace(/\s+/g, " ").trim();
        const cardHtml = $(el).html() || "";
        // Extract images within this card only
        const imageMatches = cardHtml.match(/\[IMAGE: [^\]]+\]/g) || [];
        if (cardText.length > 50) {
          structuredListings.push(`\n--- LISTING ${i + 1} ---\n${imageMatches.length > 0 ? imageMatches[0] + "\n" : ""}${cardText}`);
        }
      });
      break;
    }
  }
  
  // If we found structured listings, use those
  if (structuredListings.length > 0) {
    let text = structuredListings.join("\n");
    if (text.length > 15000) {
      text = text.substring(0, 15000) + "... [truncated]";
    }
    return text;
  }
  
  // Fallback: extract all text with images preserved
  let text = $("body").text();
  text = text.replace(/\s+/g, " ").trim();
  text = text.replace(/(.)\1{4,}/g, "$1$1$1");
  
  const mainContent = $("main, article, .content, .listing, .property, #content, [role='main']").text();
  if (mainContent && mainContent.length > 500) {
    text = mainContent.replace(/\s+/g, " ").trim();
  }
  
  if (text.length > 15000) {
    text = text.substring(0, 15000) + "... [truncated]";
  }
  
  return text;
}

export interface ExtractionOptions {
  userAgent?: string;
  forceHeadless?: boolean;
}

export async function extractListingsWithAI(
  url: string,
  platformName: string,
  options: ExtractionOptions = {}
): Promise<ExtractionResult> {
  try {
    const forceHeadless = options.forceHeadless || false;
    console.log(`[AI Extractor] Fetching page: ${url}${forceHeadless ? ' (forced headless)' : ''}`);
    const fetchResult = await fetchPageContent(url, { forceHeadless });
    
    console.log(`[AI Extractor] Cleaning HTML for analysis...`);
    const cleanedContent = cleanHtmlForAI(fetchResult.html);
    
    if (cleanedContent.length < 100) {
      return {
        success: false,
        listings: [],
        error: "Page content too short or empty - may be blocked or require authentication",
      };
    }
    
    console.log(`[AI Extractor] Sending to OpenAI for extraction (${cleanedContent.length} chars)...`);
    
    const response = await openai.chat.completions.create({
      model: "gpt-4o", 
      messages: [
        {
          role: "system",
          content: MARINA_EXTRACTION_PROMPT,
        },
        {
          role: "user",
          content: `Extract marina listings from this ${platformName} page content:\n\nURL: ${url}\n\nPage Content:\n${cleanedContent}`,
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.1,
      max_tokens: 4000,
    });
    
    const content = response.choices[0]?.message?.content;
    if (!content) {
      return {
        success: false,
        listings: [],
        error: "No response from AI extraction",
      };
    }
    
    const parsed = JSON.parse(content);
    const rawListings = parsed.listings || parsed.properties || parsed.results || (Array.isArray(parsed) ? parsed : [parsed]);
    
    const listings: ExtractedListing[] = rawListings
      .filter((l: any) => l && (l.title || l.propertyName))
      .map((l: any) => ({
        ...l,
        sourceUrl: l.sourceUrl || url,
        attributionText: `Source: ${platformName} - View original listing`,
        confidence: l.confidence || 70,
      }));
    
    console.log(`[AI Extractor] Extracted ${listings.length} marina listings from ${platformName}`);
    
    return {
      success: true,
      listings,
      tokensUsed: response.usage?.total_tokens,
    };
    
  } catch (error: any) {
    console.error(`[AI Extractor] Error:`, error.message);
    
    if (isOpenAIRateLimitError(error)) {
      console.log(`[AI Extractor] OpenAI rate limit hit, falling back to DOM extraction...`);
      try {
        const fetchResult = await fetchPageContent(url, { forceHeadless: options.forceHeadless });
        const domListings = extractListingsWithDOM(fetchResult.html, url, platformName);
        
        if (domListings.length > 0) {
          console.log(`[AI Extractor] DOM fallback extracted ${domListings.length} listings`);
          return {
            success: true,
            listings: domListings,
            error: `AI unavailable (${error.message}), used DOM fallback`,
          };
        }
      } catch (domError: any) {
        console.error(`[AI Extractor] DOM fallback also failed:`, domError.message);
      }
    }
    
    return {
      success: false,
      listings: [],
      error: error.message,
    };
  }
}

export async function extractWithFallback(
  url: string,
  platformName: string,
  options: ExtractionOptions = {}
): Promise<ExtractionResult> {
  const forceHeadless = options.forceHeadless || false;
  console.log(`[Extractor] Fetching page: ${url}${forceHeadless ? ' (forced headless)' : ''}`);
  
  let fetchResult: FetchResult;
  try {
    fetchResult = await fetchPageContent(url, { forceHeadless });
  } catch (fetchError: any) {
    return {
      success: false,
      listings: [],
      error: `Failed to fetch page: ${fetchError.message}`,
    };
  }
  
  const cleanedContent = cleanHtmlForAI(fetchResult.html);
  
  if (cleanedContent.length < 100) {
    return {
      success: false,
      listings: [],
      error: "Page content too short or empty - may be blocked or require authentication",
    };
  }
  
  let aiResult: ExtractionResult | null = null;
  try {
    console.log(`[Extractor] Trying AI extraction (${cleanedContent.length} chars)...`);
    
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: MARINA_EXTRACTION_PROMPT },
        { role: "user", content: `Extract marina listings from this ${platformName} page content:\n\nURL: ${url}\n\nPage Content:\n${cleanedContent}` },
      ],
      response_format: { type: "json_object" },
      temperature: 0.1,
      max_tokens: 4000,
    });
    
    const content = response.choices[0]?.message?.content;
    if (content) {
      const parsed = JSON.parse(content);
      const rawListings = parsed.listings || parsed.properties || parsed.results || (Array.isArray(parsed) ? parsed : [parsed]);
      
      const listings: ExtractedListing[] = rawListings
        .filter((l: any) => l && (l.title || l.propertyName))
        .map((l: any) => ({
          ...l,
          sourceUrl: l.sourceUrl || url,
          attributionText: `Source: ${platformName} - View original listing`,
          confidence: l.confidence || 70,
        }));
      
      if (listings.length > 0) {
        console.log(`[Extractor] AI extracted ${listings.length} marina listings`);
        return {
          success: true,
          listings,
          tokensUsed: response.usage?.total_tokens,
        };
      }
    }
  } catch (aiError: any) {
    console.log(`[Extractor] AI extraction failed: ${aiError.message}`);
    
    if (isOpenAIRateLimitError(aiError)) {
      console.log(`[Extractor] OpenAI rate limit/quota exceeded, using DOM fallback only`);
    }
  }
  
  console.log(`[Extractor] Falling back to DOM extraction...`);
  const domListings = extractListingsWithDOM(fetchResult.html, url, platformName);
  
  if (domListings.length > 0) {
    console.log(`[Extractor] DOM fallback extracted ${domListings.length} listings`);
    return {
      success: true,
      listings: domListings,
      error: aiResult ? undefined : "AI unavailable, used DOM fallback",
    };
  }
  
  return {
    success: false,
    listings: [],
    error: "No listings found with AI or DOM extraction",
  };
}

export async function extractSingleListing(
  url: string,
  platformName: string,
  options?: ExtractionOptions
): Promise<ExtractionResult> {
  return extractListingsWithAI(url, platformName, options);
}

export async function extractListingsFromSearchPage(
  searchUrl: string,
  platformName: string,
  maxDetailPages: number = 5,
  options?: ExtractionOptions
): Promise<ExtractionResult> {
  try {
    console.log(`[AI Extractor] Fetching search page: ${searchUrl}`);
    const fetchResult = await fetchPageContent(searchUrl, { forceHeadless: options?.forceHeadless });
    const $ = cheerio.load(fetchResult.html);
    
    const listingLinks: string[] = [];
    const baseUrl = new URL(searchUrl).origin;
    
    $("a[href*='property'], a[href*='listing'], a[href*='detail'], a[href*='/p/'], a[href*='/l/']").each((_, el) => {
      const href = $(el).attr("href");
      if (href && !href.includes("javascript:") && !href.includes("#")) {
        const fullUrl = href.startsWith("http") ? href : `${baseUrl}${href.startsWith("/") ? "" : "/"}${href}`;
        if (!listingLinks.includes(fullUrl)) {
          listingLinks.push(fullUrl);
        }
      }
    });
    
    console.log(`[AI Extractor] Found ${listingLinks.length} potential listing links`);
    
    const allListings: ExtractedListing[] = [];
    const linksToProcess = listingLinks.slice(0, maxDetailPages);
    
    for (const link of linksToProcess) {
      try {
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const result = await extractSingleListing(link, platformName, options);
        if (result.success && result.listings.length > 0) {
          allListings.push(...result.listings);
        }
      } catch (error: any) {
        console.error(`[AI Extractor] Error processing ${link}:`, error.message);
      }
    }
    
    const searchResult = await extractListingsWithAI(searchUrl, platformName, options);
    if (searchResult.success && searchResult.listings.length > 0) {
      for (const listing of searchResult.listings) {
        const isDupe = allListings.some(
          existing => existing.propertyName === listing.propertyName && existing.city === listing.city
        );
        if (!isDupe) {
          allListings.push(listing);
        }
      }
    }
    
    return {
      success: true,
      listings: allListings,
    };
    
  } catch (error: any) {
    console.error(`[AI Extractor] Search page error:`, error.message);
    return {
      success: false,
      listings: [],
      error: error.message,
    };
  }
}

export function validateExtractedListing(listing: ExtractedListing): { valid: boolean; issues: string[] } {
  const issues: string[] = [];
  
  if (!listing.title && !listing.propertyName) {
    issues.push("Missing title or property name");
  }
  
  if (!listing.sourceUrl) {
    issues.push("Missing source URL");
  }
  
  if (listing.askingPrice && (listing.askingPrice < 10000 || listing.askingPrice > 500000000)) {
    issues.push(`Suspicious asking price: ${listing.askingPrice}`);
  }
  
  if (listing.totalSlips && (listing.totalSlips < 1 || listing.totalSlips > 5000)) {
    issues.push(`Suspicious slip count: ${listing.totalSlips}`);
  }
  
  if (listing.capRate && (listing.capRate < 0 || listing.capRate > 30)) {
    issues.push(`Suspicious cap rate: ${listing.capRate}`);
  }
  
  if (listing.occupancyRate && (listing.occupancyRate < 0 || listing.occupancyRate > 100)) {
    issues.push(`Invalid occupancy rate: ${listing.occupancyRate}`);
  }
  
  if (listing.state && listing.state.length !== 2) {
    issues.push(`Invalid state format: ${listing.state}`);
  }
  
  if (listing.confidence && listing.confidence < 30) {
    issues.push(`Low extraction confidence: ${listing.confidence}%`);
  }
  
  return {
    valid: issues.length === 0,
    issues,
  };
}
