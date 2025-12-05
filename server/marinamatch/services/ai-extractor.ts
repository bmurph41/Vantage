import OpenAI from "openai";
import axios from "axios";
import * as cheerio from "cheerio";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const ALLOWED_HOSTS = [
  "crexi.com",
  "www.crexi.com",
  "loopnet.com",
  "www.loopnet.com",
  "bizbuysell.com",
  "www.bizbuysell.com",
  "costar.com",
  "www.costar.com",
  "landwatch.com",
  "www.landwatch.com",
  "landsofamerica.com",
  "www.landsofamerica.com",
  "commercialcafe.com",
  "www.commercialcafe.com",
  "cityfeet.com",
  "www.cityfeet.com",
];

const MAX_RESPONSE_SIZE = 5 * 1024 * 1024;

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
    
    const hostMatch = ALLOWED_HOSTS.some(host => 
      parsed.hostname === host || parsed.hostname.endsWith(`.${host}`)
    );
    
    if (!hostMatch) {
      console.log(`[AI Extractor] Host ${parsed.hostname} not in allowlist, allowing with caution`);
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

## HERO IMAGE (CRITICAL)
- heroImageUrl: The MAIN property photo URL. Look for:
  * [IMAGE: url] markers in the content
  * The first/largest property image
  * Featured or primary listing photo
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
2. Convert ALL prices to numbers (no $, commas, or text)
3. Calculate pricePerSlip = askingPrice / totalSlips when both available
4. Look for images marked as [IMAGE: url] and extract the best property photo as heroImageUrl
5. Parse amenities from description text carefully - look for keywords
6. Extract ALL services mentioned, even if in passing
7. For occupancy, look for "X% occupied", "X slips rented", waitlist mentions
8. Provide high confidence (80+) only when data is clearly stated, not inferred

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

async function fetchPageContent(url: string, userAgent: string): Promise<string> {
  const urlCheck = isAllowedUrl(url);
  if (!urlCheck.allowed) {
    throw new Error(`URL not allowed: ${urlCheck.reason}`);
  }
  
  try {
    const response = await axios.get(url, {
      headers: {
        "User-Agent": userAgent,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
        "Accept-Encoding": "gzip, deflate",
        "Connection": "keep-alive",
      },
      timeout: 20000,
      maxRedirects: 3,
      maxContentLength: MAX_RESPONSE_SIZE,
      maxBodyLength: MAX_RESPONSE_SIZE,
    });
    return response.data;
  } catch (error: any) {
    throw new Error(`Failed to fetch page: ${error.message}`);
  }
}

function cleanHtmlForAI(html: string): string {
  const $ = cheerio.load(html);
  
  $("script, style, noscript, iframe, svg, nav, footer, header").remove();
  $("[style*='display:none'], [style*='display: none'], .hidden, .d-none").remove();
  $("img").each((_, el) => {
    const src = $(el).attr("src") || $(el).attr("data-src");
    if (src) {
      $(el).replaceWith(`[IMAGE: ${src}]`);
    } else {
      $(el).remove();
    }
  });
  
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

export async function extractListingsWithAI(
  url: string,
  platformName: string,
  userAgent: string = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 MarinaMatch/1.0"
): Promise<ExtractionResult> {
  try {
    console.log(`[AI Extractor] Fetching page: ${url}`);
    const html = await fetchPageContent(url, userAgent);
    
    console.log(`[AI Extractor] Cleaning HTML for analysis...`);
    const cleanedContent = cleanHtmlForAI(html);
    
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
    return {
      success: false,
      listings: [],
      error: error.message,
    };
  }
}

export async function extractSingleListing(
  url: string,
  platformName: string,
  userAgent?: string
): Promise<ExtractionResult> {
  return extractListingsWithAI(url, platformName, userAgent);
}

export async function extractListingsFromSearchPage(
  searchUrl: string,
  platformName: string,
  maxDetailPages: number = 5,
  userAgent?: string
): Promise<ExtractionResult> {
  try {
    console.log(`[AI Extractor] Fetching search page: ${searchUrl}`);
    const html = await fetchPageContent(searchUrl, userAgent || "Mozilla/5.0 MarinaMatch/1.0");
    const $ = cheerio.load(html);
    
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
        
        const result = await extractSingleListing(link, platformName, userAgent);
        if (result.success && result.listings.length > 0) {
          allListings.push(...result.listings);
        }
      } catch (error: any) {
        console.error(`[AI Extractor] Error processing ${link}:`, error.message);
      }
    }
    
    const searchResult = await extractListingsWithAI(searchUrl, platformName, userAgent);
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
