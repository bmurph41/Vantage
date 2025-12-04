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

const MARINA_EXTRACTION_PROMPT = `You are a commercial real estate data extraction expert specializing in marina properties. 
Analyze the provided HTML content from a commercial real estate listing page and extract all marina-related property listings.

For each marina listing found, extract the following information (leave null if not found):
- title: The listing title or property name
- propertyName: Official marina name
- propertyAddress: Street address
- city: City name
- state: State abbreviation (2 letters, e.g., FL, CA, TX)
- zipCode: ZIP code
- askingPrice: Asking price in dollars (number only, no formatting)
- totalSlips: Total number of boat slips
- wetSlips: Number of wet slips (in-water)
- dryStorageSpaces: Number of dry storage spaces
- acreage: Property size in acres
- waterFrontage: Water frontage in feet
- hasFuel: Whether marina has fuel dock (boolean)
- hasShipStore: Whether marina has ship store (boolean)
- hasRestaurant: Whether marina has restaurant (boolean)
- hasRepairShop: Whether marina has repair/service shop (boolean)
- hasDryStorage: Whether marina has dry storage (boolean)
- hasBoatRamp: Whether marina has boat ramp (boolean)
- capRate: Capitalization rate as percentage (e.g., 7.5 for 7.5%)
- grossRevenue: Annual gross revenue in dollars
- noi: Net Operating Income in dollars
- occupancyRate: Occupancy percentage (e.g., 95 for 95%)
- marinaType: Type (marina, yacht_club, boatyard, dry_stack, full_service, mixed)
- dealType: Deal type (acquisition, ground_lease, etc.)
- brokerName: Listing broker name
- brokerCompany: Brokerage company name
- brokerPhone: Broker phone number
- brokerEmail: Broker email
- originalDescription: Full property description text
- sourceListingId: Any listing ID or reference number visible on page
- confidence: Your confidence in the extraction accuracy (0-100)

IMPORTANT RULES:
1. Only extract marina-related properties (marinas, yacht clubs, boatyards, boat storage facilities)
2. Skip any non-marina properties (warehouses, RV storage, apartments, etc.)
3. Convert all prices to numbers without currency symbols or commas
4. Use 2-letter state abbreviations
5. Set boolean values based on amenities mentioned in descriptions
6. If a field is ambiguous, leave it null
7. Set confidence score based on how clearly the data was presented

Return a JSON array of extracted listings. Even if only one listing is found, return it in an array.`;

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
