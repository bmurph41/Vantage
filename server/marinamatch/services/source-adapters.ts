/**
 * MarinaMatch Intel - Source Adapter Registry
 * 
 * This module provides a unified interface for different listing data sources.
 * Each adapter implements the ListingSourceAdapter interface and provides
 * platform-specific data ingestion logic.
 */

import { ExtractedListing } from "./ai-extractor";

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
