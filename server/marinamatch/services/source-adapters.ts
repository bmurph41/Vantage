/**
 * MarinaMatch Intel - Source Adapter Registry
 * 
 * This module provides a unified interface for different listing data sources.
 * Each adapter implements the ListingSourceAdapter interface and provides
 * platform-specific data ingestion logic.
 */

import axios from "axios";
import * as cheerio from "cheerio";
import Parser from "rss-parser";
import { ExtractedListing } from "./ai-extractor";

const rssParser = new Parser();

// Standardized listing data structure
export interface ListingData {
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

// Ingestion method capabilities
export type IngestionMethod = "api" | "scraping" | "rss" | "manual" | "broker_submit";

// Result of a fetch operation
export interface FetchResult {
  success: boolean;
  listings: ListingData[];
  errors: string[];
  method: IngestionMethod;
  metadata?: {
    pagesScanned?: number;
    totalFound?: number;
    filteredOut?: number;
    httpStatus?: number;
    responseTime?: number;
  };
}

// Source adapter configuration
export interface SourceAdapterConfig {
  searchUrl?: string;
  keywords?: string[];
  excludeKeywords?: string[];
  states?: string[];
  minPrice?: number;
  maxPrice?: number;
  minSlips?: number;
  maxSlips?: number;
  rateLimit?: number;
}

// Main source adapter interface
export interface ListingSourceAdapter {
  // Unique platform identifier
  platform: string;
  
  // Human-readable display name
  displayName: string;
  
  // Supported ingestion methods
  supportedMethods: IngestionMethod[];
  
  // Currently blocked methods (with reasons)
  blockedMethods: { method: IngestionMethod; reason: string }[];
  
  // Platform access notes
  accessNotes: string;
  
  // Scraping status
  scrapingStatus: "blocked" | "limited" | "allowed";
  
  // API availability info
  apiInfo?: {
    available: boolean;
    contactUrl?: string;
    pricingInfo?: string;
  };
  
  // Fetch listings using the best available method
  fetchListings(config?: SourceAdapterConfig): Promise<FetchResult>;
  
  // Check if a specific method is available
  isMethodAvailable(method: IngestionMethod): boolean;
  
  // Get recommended ingestion method
  getRecommendedMethod(): IngestionMethod;
}

// Base adapter with common functionality
export abstract class BaseSourceAdapter implements ListingSourceAdapter {
  abstract platform: string;
  abstract displayName: string;
  abstract supportedMethods: IngestionMethod[];
  abstract blockedMethods: { method: IngestionMethod; reason: string }[];
  abstract accessNotes: string;
  abstract scrapingStatus: "blocked" | "limited" | "allowed";
  apiInfo?: { available: boolean; contactUrl?: string; pricingInfo?: string };
  
  abstract fetchListings(config?: SourceAdapterConfig): Promise<FetchResult>;
  
  isMethodAvailable(method: IngestionMethod): boolean {
    return this.supportedMethods.includes(method) && 
           !this.blockedMethods.some(b => b.method === method);
  }
  
  getRecommendedMethod(): IngestionMethod {
    // Prefer API if available
    if (this.isMethodAvailable("api") && this.apiInfo?.available) {
      return "api";
    }
    // Then RSS
    if (this.isMethodAvailable("rss")) {
      return "rss";
    }
    // Then scraping if allowed
    if (this.isMethodAvailable("scraping") && this.scrapingStatus === "allowed") {
      return "scraping";
    }
    // Default to manual
    return "manual";
  }
  
  protected emptyResult(reason: string): FetchResult {
    return {
      success: false,
      listings: [],
      errors: [reason],
      method: "manual",
    };
  }
}

// Broker Direct Submission Adapter - Always available
export class BrokerSubmitAdapter extends BaseSourceAdapter {
  platform = "broker_submit";
  displayName = "Broker Direct Submission";
  supportedMethods: IngestionMethod[] = ["broker_submit", "manual"];
  blockedMethods: { method: IngestionMethod; reason: string }[] = [];
  accessNotes = "Brokers can submit listings directly through the MarinaMatch platform.";
  scrapingStatus: "blocked" | "limited" | "allowed" = "allowed";
  
  async fetchListings(): Promise<FetchResult> {
    return {
      success: true,
      listings: [],
      errors: [],
      method: "broker_submit",
      metadata: {
        totalFound: 0,
      },
    };
  }
}

// LoopNet Adapter - Requires API subscription
export class LoopNetAdapter extends BaseSourceAdapter {
  platform = "loopnet";
  displayName = "LoopNet";
  supportedMethods: IngestionMethod[] = ["api", "manual"];
  blockedMethods = [
    { method: "scraping" as IngestionMethod, reason: "LoopNet actively blocks automated scraping with 403 errors" }
  ];
  accessNotes = "LoopNet blocks automated scraping. Data access requires CoStar Group API subscription.";
  scrapingStatus: "blocked" | "limited" | "allowed" = "blocked";
  apiInfo = {
    available: true,
    contactUrl: "https://www.costargroup.com/products/loopnet",
    pricingInfo: "Enterprise subscription required",
  };
  
  async fetchListings(config?: SourceAdapterConfig): Promise<FetchResult> {
    return this.emptyResult("LoopNet requires API subscription for data access. Contact CoStar Group for enterprise access.");
  }
}

// Crexi Adapter - Returns 403 for automated requests
export class CrexiAdapter extends BaseSourceAdapter {
  platform = "crexi";
  displayName = "Crexi";
  supportedMethods: IngestionMethod[] = ["api", "manual"];
  blockedMethods = [
    { method: "scraping" as IngestionMethod, reason: "Crexi returns 403 errors for automated requests" }
  ];
  accessNotes = "Crexi returns 403 errors for automated requests. Official API access may be available for partners.";
  scrapingStatus: "blocked" | "limited" | "allowed" = "blocked";
  apiInfo = {
    available: true,
    contactUrl: "https://www.crexi.com/contact",
    pricingInfo: "Contact for enterprise access",
  };
  
  async fetchListings(config?: SourceAdapterConfig): Promise<FetchResult> {
    return this.emptyResult("Crexi blocks automated access. Contact Crexi for API partnership.");
  }
}

// BizBuySell Adapter - Aggressive rate limiting
export class BizBuySellAdapter extends BaseSourceAdapter {
  platform = "bizbuysell";
  displayName = "BizBuySell";
  supportedMethods: IngestionMethod[] = ["manual"];
  blockedMethods = [
    { method: "scraping" as IngestionMethod, reason: "Aggressive rate limiting and CAPTCHA" },
    { method: "api" as IngestionMethod, reason: "No public API available" }
  ];
  accessNotes = "BizBuySell uses aggressive rate limiting and CAPTCHA. Manual data entry or broker partnerships recommended.";
  scrapingStatus: "blocked" | "limited" | "allowed" = "blocked";
  
  async fetchListings(config?: SourceAdapterConfig): Promise<FetchResult> {
    return this.emptyResult("BizBuySell does not offer automated access. Use manual import.");
  }
}

// CoStar Adapter - Paid API subscription required
export class CoStarAdapter extends BaseSourceAdapter {
  platform = "costar";
  displayName = "CoStar";
  supportedMethods: IngestionMethod[] = ["api"];
  blockedMethods = [
    { method: "scraping" as IngestionMethod, reason: "CoStar requires authenticated API access" }
  ];
  accessNotes = "CoStar requires paid API subscription. Premium data service for commercial real estate.";
  scrapingStatus: "blocked" | "limited" | "allowed" = "blocked";
  apiInfo = {
    available: true,
    contactUrl: "https://www.costargroup.com/products",
    pricingInfo: "Enterprise subscription required",
  };
  
  async fetchListings(config?: SourceAdapterConfig): Promise<FetchResult> {
    return this.emptyResult("CoStar requires paid API subscription. Contact CoStar Group for access.");
  }
}

// Custom Source Adapter - For user-defined sources
export class CustomSourceAdapter extends BaseSourceAdapter {
  platform = "custom";
  displayName = "Custom Source";
  supportedMethods: IngestionMethod[] = ["manual", "scraping", "rss", "api"];
  blockedMethods: { method: IngestionMethod; reason: string }[] = [];
  accessNotes = "Custom sources depend on the specific site's policies. Check robots.txt before automated access.";
  scrapingStatus: "blocked" | "limited" | "allowed" = "allowed";
  
  async fetchListings(config?: SourceAdapterConfig): Promise<FetchResult> {
    return {
      success: true,
      listings: [],
      errors: [],
      method: "manual",
    };
  }
}

// GovDeals Adapter - Government surplus marina/waterfront properties
export class GovDealsAdapter extends BaseSourceAdapter {
  platform = "govdeals";
  displayName = "GovDeals";
  supportedMethods: IngestionMethod[] = ["scraping", "manual"];
  blockedMethods: { method: IngestionMethod; reason: string }[] = [];
  accessNotes = "GovDeals allows public access to government surplus auctions including marina and waterfront properties.";
  scrapingStatus: "blocked" | "limited" | "allowed" = "allowed";
  
  async fetchListings(config?: SourceAdapterConfig): Promise<FetchResult> {
    const listings: ListingData[] = [];
    const errors: string[] = [];
    
    try {
      console.log("[govdeals] Fetching marina listings from GovDeals...");
      
      const searchUrl = "https://www.govdeals.com/index.cfm?fa=Main.AdvSearchResultsNew&searchPg=Category&additession=&category=92K&selession=&sortOption=ad&timing=bySim498&word=marina&zipCode=&miles=1000&state=&country=";
      
      const response = await axios.get(searchUrl, {
        headers: {
          "User-Agent": "MarinaMatch/1.0 (marina aggregator; contact@marinamatch.com)",
          "Accept": "text/html,application/xhtml+xml",
        },
        timeout: 15000,
      });
      
      const $ = cheerio.load(response.data);
      
      $(".row-item, .auction-item, .item-row").each((_, element) => {
        const title = $(element).find(".item-title, .auction-title, h3, h4").first().text().trim();
        const description = $(element).find(".item-description, .auction-desc, .description").first().text().trim();
        const link = $(element).find("a").first().attr("href");
        const priceText = $(element).find(".current-bid, .price, .bid-amount").first().text().trim();
        const locationText = $(element).find(".location, .item-location").first().text().trim();
        
        if (title && (
          title.toLowerCase().includes("marina") ||
          title.toLowerCase().includes("waterfront") ||
          title.toLowerCase().includes("dock") ||
          title.toLowerCase().includes("boat") ||
          description.toLowerCase().includes("marina")
        )) {
          const price = priceText ? parseFloat(priceText.replace(/[^0-9.]/g, "")) : undefined;
          const fullUrl = link?.startsWith("http") ? link : `https://www.govdeals.com${link}`;
          
          let city = "";
          let state = "";
          if (locationText) {
            const parts = locationText.split(",").map(s => s.trim());
            if (parts.length >= 2) {
              city = parts[0];
              state = parts[1].substring(0, 2).toUpperCase();
            }
          }
          
          listings.push({
            title: title || "Government Surplus Marina Property",
            propertyName: title,
            city,
            state,
            askingPrice: price,
            sourceUrl: fullUrl || "https://www.govdeals.com/boats-marine-vessels-supplies",
            originalDescription: description,
            dealType: "auction",
            propertyType: "marina",
            attributionText: "Source: GovDeals Government Surplus",
          });
        }
      });
      
      console.log(`[govdeals] Found ${listings.length} marina-related listings`);
      
      return {
        success: true,
        listings,
        errors,
        method: "scraping",
        metadata: {
          totalFound: listings.length,
        },
      };
    } catch (error: any) {
      console.error("[govdeals] Fetch error:", error.message);
      errors.push(`GovDeals fetch failed: ${error.message}`);
      return {
        success: false,
        listings: [],
        errors,
        method: "scraping",
      };
    }
  }
}

// PublicSurplus Adapter - State/local government surplus
export class PublicSurplusAdapter extends BaseSourceAdapter {
  platform = "publicsurplus";
  displayName = "PublicSurplus";
  supportedMethods: IngestionMethod[] = ["scraping", "manual"];
  blockedMethods: { method: IngestionMethod; reason: string }[] = [];
  accessNotes = "PublicSurplus provides state and local government surplus auctions including marine equipment.";
  scrapingStatus: "blocked" | "limited" | "allowed" = "allowed";
  
  async fetchListings(config?: SourceAdapterConfig): Promise<FetchResult> {
    const listings: ListingData[] = [];
    const errors: string[] = [];
    
    try {
      console.log("[publicsurplus] Fetching marina listings from PublicSurplus...");
      
      const searchUrl = "https://www.publicsurplus.com/sms/browse/cataucs?catid=20";
      
      const response = await axios.get(searchUrl, {
        headers: {
          "User-Agent": "MarinaMatch/1.0 (marina aggregator; contact@marinamatch.com)",
          "Accept": "text/html,application/xhtml+xml",
        },
        timeout: 15000,
      });
      
      const $ = cheerio.load(response.data);
      
      $(".auction-row, .item-row, tr[class*='auction']").each((_, element) => {
        const title = $(element).find("a.auction-title, td a, .title").first().text().trim();
        const description = $(element).find(".description, td:nth-child(2)").text().trim();
        const link = $(element).find("a").first().attr("href");
        const priceText = $(element).find(".price, .current-bid, td:contains('$')").first().text().trim();
        const locationText = $(element).find(".location, td:nth-child(3)").text().trim();
        
        if (title && (
          title.toLowerCase().includes("marina") ||
          title.toLowerCase().includes("boat") ||
          title.toLowerCase().includes("dock") ||
          title.toLowerCase().includes("waterfront") ||
          description.toLowerCase().includes("marina")
        )) {
          const price = priceText ? parseFloat(priceText.replace(/[^0-9.]/g, "")) : undefined;
          const fullUrl = link?.startsWith("http") ? link : `https://www.publicsurplus.com${link}`;
          
          listings.push({
            title: title || "Public Surplus Marine Property",
            propertyName: title,
            askingPrice: price,
            sourceUrl: fullUrl || "https://www.publicsurplus.com/sms/browse/cataucs?catid=20",
            originalDescription: description,
            dealType: "auction",
            propertyType: "marina",
            attributionText: "Source: PublicSurplus Government Auction",
          });
        }
      });
      
      console.log(`[publicsurplus] Found ${listings.length} marina-related listings`);
      
      return {
        success: true,
        listings,
        errors,
        method: "scraping",
        metadata: {
          totalFound: listings.length,
        },
      };
    } catch (error: any) {
      console.error("[publicsurplus] Fetch error:", error.message);
      errors.push(`PublicSurplus fetch failed: ${error.message}`);
      return {
        success: false,
        listings: [],
        errors,
        method: "scraping",
      };
    }
  }
}

// Marina Industry RSS Adapter - Marina news and listings from RSS feeds
export class MarinaIndustryRSSAdapter extends BaseSourceAdapter {
  platform = "marina_rss";
  displayName = "Marina Industry Feeds";
  supportedMethods: IngestionMethod[] = ["rss", "manual"];
  blockedMethods: { method: IngestionMethod; reason: string }[] = [];
  accessNotes = "Aggregates marina industry news and listings from public RSS feeds.";
  scrapingStatus: "blocked" | "limited" | "allowed" = "allowed";
  
  private readonly RSS_FEEDS = [
    {
      url: "https://www.tradeonlytoday.com/feed",
      name: "Trade Only Today",
      type: "industry_news",
    },
    {
      url: "https://www.marinaworld.co.uk/feed/",
      name: "Marina World",
      type: "industry_news",
    },
    {
      url: "https://www.boatingindustry.com/feed/",
      name: "Boating Industry",
      type: "industry_news",
    },
  ];
  
  async fetchListings(config?: SourceAdapterConfig): Promise<FetchResult> {
    const listings: ListingData[] = [];
    const errors: string[] = [];
    
    console.log("[marina_rss] Fetching from marina industry RSS feeds...");
    
    for (const feed of this.RSS_FEEDS) {
      try {
        console.log(`[marina_rss] Parsing feed: ${feed.name}`);
        const parsed = await rssParser.parseURL(feed.url);
        
        for (const item of parsed.items || []) {
          const title = item.title || "";
          const content = item.contentSnippet || item.content || "";
          const lowerTitle = title.toLowerCase();
          const lowerContent = content.toLowerCase();
          
          const isMarinaRelated = 
            (lowerTitle.includes("marina") && (lowerTitle.includes("sale") || lowerTitle.includes("sold") || lowerTitle.includes("acqui"))) ||
            (lowerTitle.includes("marina") && lowerTitle.includes("deal")) ||
            (lowerContent.includes("marina for sale") || lowerContent.includes("marina acquisition"));
          
          if (isMarinaRelated) {
            listings.push({
              title: title,
              propertyName: title,
              sourceUrl: item.link || feed.url,
              originalDescription: content.substring(0, 500),
              propertyType: "marina",
              dealType: "sale",
              listingDate: item.pubDate ? new Date(item.pubDate) : new Date(),
              attributionText: `Source: ${feed.name} RSS Feed`,
            });
          }
        }
        
        console.log(`[marina_rss] Processed ${parsed.items?.length || 0} items from ${feed.name}`);
      } catch (error: any) {
        console.error(`[marina_rss] Error parsing ${feed.name}:`, error.message);
        errors.push(`RSS feed ${feed.name} failed: ${error.message}`);
      }
    }
    
    console.log(`[marina_rss] Total marina-related listings found: ${listings.length}`);
    
    return {
      success: listings.length > 0 || errors.length === 0,
      listings,
      errors,
      method: "rss",
      metadata: {
        totalFound: listings.length,
      },
    };
  }
}

// Boats.com/YachtWorld Adapter - Boat marketplace with marina listings
export class BoatsComAdapter extends BaseSourceAdapter {
  platform = "boatscom";
  displayName = "Boats.com/YachtWorld";
  supportedMethods: IngestionMethod[] = ["manual"];
  blockedMethods = [
    { method: "scraping" as IngestionMethod, reason: "API access recommended" }
  ];
  accessNotes = "Boats.com has API access available for partners. Contact for marina listing access.";
  scrapingStatus: "blocked" | "limited" | "allowed" = "limited";
  apiInfo = {
    available: true,
    contactUrl: "https://api.boats.com/docs/overview",
    pricingInfo: "Partner API access available",
  };
  
  async fetchListings(config?: SourceAdapterConfig): Promise<FetchResult> {
    return this.emptyResult("Boats.com API requires partner access. Contact for integration.");
  }
}

// Source Adapter Registry
class SourceAdapterRegistry {
  private adapters: Map<string, ListingSourceAdapter> = new Map();
  
  constructor() {
    this.registerDefaults();
  }
  
  private registerDefaults() {
    this.register(new BrokerSubmitAdapter());
    this.register(new LoopNetAdapter());
    this.register(new CrexiAdapter());
    this.register(new BizBuySellAdapter());
    this.register(new CoStarAdapter());
    this.register(new CustomSourceAdapter());
    this.register(new GovDealsAdapter());
    this.register(new PublicSurplusAdapter());
    this.register(new MarinaIndustryRSSAdapter());
    this.register(new BoatsComAdapter());
  }
  
  register(adapter: ListingSourceAdapter): void {
    this.adapters.set(adapter.platform.toLowerCase(), adapter);
  }
  
  get(platform: string): ListingSourceAdapter | undefined {
    return this.adapters.get(platform.toLowerCase());
  }
  
  getOrDefault(platform: string): ListingSourceAdapter {
    return this.get(platform) || this.get("custom")!;
  }
  
  getAll(): ListingSourceAdapter[] {
    return Array.from(this.adapters.values());
  }
  
  getPlatformStatus(): Array<{
    platform: string;
    displayName: string;
    status: string;
    recommendedMethod: IngestionMethod;
  }> {
    return this.getAll().map(adapter => ({
      platform: adapter.platform,
      displayName: adapter.displayName,
      status: adapter.scrapingStatus,
      recommendedMethod: adapter.getRecommendedMethod(),
    }));
  }
}

// Singleton instance
export const sourceAdapterRegistry = new SourceAdapterRegistry();

// Helper function to get adapter for a platform
export function getSourceAdapter(platform: string): ListingSourceAdapter {
  return sourceAdapterRegistry.getOrDefault(platform);
}
