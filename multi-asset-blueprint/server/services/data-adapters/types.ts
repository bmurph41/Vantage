/**
 * Shared interfaces for all property data adapters.
 *
 * Each adapter (Zillow, Redfin, MLS) implements IPropertyDataAdapter.
 * The PropertyDataService orchestrates calls across adapters and
 * normalizes results into PropertyDataPayload for caching.
 */

// =============================================
// Normalized Data Types
// =============================================

export interface NormalizedAddress {
  street: string;
  city: string;
  state: string;
  zip: string;
  county?: string;
  latitude?: number;
  longitude?: number;
}

export interface PropertyCharacteristics {
  beds?: number;
  baths?: number;
  halfBaths?: number;
  sqft?: number;
  lotSizeSqft?: number;
  yearBuilt?: number;
  stories?: number;
  garageSpaces?: number;
  pool?: boolean;
  units?: number;  // For multifamily
  propertyType?: string;
  constructionType?: string;
  roofType?: string;
  heatingType?: string;
  coolingType?: string;
  basement?: boolean;
  basementSqft?: number;
  parkingSpaces?: number;
  hoaFee?: number;
  hoaFrequency?: string;
}

export interface ValuationData {
  estimatedValue?: number;
  estimatedValueLow?: number;
  estimatedValueHigh?: number;
  confidence?: number; // 0-1
  rentEstimate?: number;
  rentEstimateLow?: number;
  rentEstimateHigh?: number;
  lastSalePrice?: number;
  lastSaleDate?: string;
  assessedValue?: number;
  taxAmount?: number;
  taxYear?: number;
  pricePerSqft?: number;
}

export interface ListingData {
  status?: "active" | "pending" | "sold" | "withdrawn" | "expired" | "off_market";
  listPrice?: number;
  originalListPrice?: number;
  soldPrice?: number;
  daysOnMarket?: number;
  cumulativeDaysOnMarket?: number;
  mlsNumber?: string;
  listingAgent?: string;
  listingAgentPhone?: string;
  listingOffice?: string;
  buyerAgent?: string;
  buyerOffice?: string;
  listDate?: string;
  pendingDate?: string;
  soldDate?: string;
  withdrawnDate?: string;
  description?: string;
  virtualTourUrl?: string;
  photos?: string[];
}

export interface MarketData {
  medianRent?: number;
  medianSalePrice?: number;
  medianPricePerSqft?: number;
  capRateEstimate?: number;
  appreciation1yr?: number;
  appreciation5yr?: number;
  vacancyRate?: number;
  averageDaysOnMarket?: number;
  inventoryCount?: number;
  neighborhoodScore?: number;
  walkScore?: number;
  transitScore?: number;
  bikeScore?: number;
  crimeScore?: number;
  schoolRating?: number;
}

export interface PropertyDataPayload {
  address: NormalizedAddress;
  characteristics: PropertyCharacteristics;
  valuation: ValuationData;
  listing: ListingData;
  market: MarketData;
  metadata: {
    sourceKey: string;
    sourcePropertyId: string;
    fetchedAt: string;
    confidence: number;
    rawPayload?: any;
  };
}

// =============================================
// Search & Query Types
// =============================================

export interface PropertySearchCriteria {
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  county?: string;
  latitude?: number;
  longitude?: number;
  radiusMiles?: number;
  assetClasses?: string[];
  minPrice?: number;
  maxPrice?: number;
  minBeds?: number;
  maxBeds?: number;
  minBaths?: number;
  maxBaths?: number;
  minSqft?: number;
  maxSqft?: number;
  minUnits?: number;
  maxUnits?: number;
  listingStatus?: string[];
  minYearBuilt?: number;
  maxYearBuilt?: number;
  limit?: number;
  offset?: number;
  sortBy?: "price" | "date" | "sqft" | "relevance";
  sortDir?: "asc" | "desc";
}

export interface CompsSearchCriteria {
  address?: string;
  latitude: number;
  longitude: number;
  radiusMiles?: number;
  assetClass?: string;
  minSqft?: number;
  maxSqft?: number;
  minBeds?: number;
  maxBeds?: number;
  minYearBuilt?: number;
  maxYearBuilt?: number;
  soldWithinMonths?: number;
  limit?: number;
}

export interface AdapterSearchResult {
  total: number;
  results: PropertyDataPayload[];
  hasMore: boolean;
  nextOffset?: number;
}

// =============================================
// Adapter Interface
// =============================================

export interface IPropertyDataAdapter {
  /** Unique key for this adapter (e.g., "zillow_bridge") */
  key: string;
  
  /** Display name */
  name: string;

  /** Supported asset classes */
  supportedAssetClasses: string[];

  /**
   * Test the connection with current credentials.
   * Returns { ok: true } or { ok: false, error: "..." }
   */
  testConnection(credentials: Record<string, string>): Promise<{ ok: boolean; error?: string }>;

  /**
   * Search properties matching criteria.
   */
  searchProperties(
    criteria: PropertySearchCriteria,
    credentials: Record<string, string>
  ): Promise<AdapterSearchResult>;

  /**
   * Get detailed property data by source-specific ID.
   */
  getProperty(
    sourcePropertyId: string,
    credentials: Record<string, string>
  ): Promise<PropertyDataPayload | null>;

  /**
   * Get valuation/estimate data for a property.
   */
  getValuation(
    address: NormalizedAddress,
    credentials: Record<string, string>
  ): Promise<ValuationData | null>;

  /**
   * Get comparable sales/listings near a property.
   */
  getComps(
    criteria: CompsSearchCriteria,
    credentials: Record<string, string>
  ): Promise<PropertyDataPayload[]>;

  /**
   * Get market-level metrics for a geography.
   */
  getMarketData(
    zip: string,
    credentials: Record<string, string>
  ): Promise<MarketData | null>;
}

// =============================================
// Adapter Configuration
// =============================================

export interface AdapterCredentialField {
  key: string;
  label: string;
  type: "text" | "secret" | "url" | "select";
  required: boolean;
  helpText?: string;
  placeholder?: string;
  options?: Array<{ label: string; value: string }>;
}

export interface AdapterRegistryEntry {
  key: string;
  name: string;
  description: string;
  providerType: "api" | "feed" | "aggregator" | "scraper";
  authType: "api_key" | "oauth2" | "basic" | "rets" | "none";
  websiteUrl: string;
  docsUrl?: string;
  supportedAssetClasses: string[];
  credentialFields: AdapterCredentialField[];
  defaultRateLimits: {
    requestsPerSecond: number;
    requestsPerDay: number;
  };
  capabilities: {
    propertyDetails: boolean;
    valuations: boolean;
    comps: boolean;
    listings: boolean;
    marketData: boolean;
    photos: boolean;
  };
}

/**
 * Registry of all available data source adapters.
 * Used by the Admin UI to show configuration options.
 */
export const DATA_SOURCE_ADAPTER_REGISTRY: AdapterRegistryEntry[] = [
  {
    key: "zillow_bridge",
    name: "Zillow Bridge API",
    description: "Property data, Zestimates, rental estimates, and comparable sales via Zillow's Bridge API.",
    providerType: "api",
    authType: "api_key",
    websiteUrl: "https://bridgedataoutput.com/",
    docsUrl: "https://bridgedataoutput.com/docs/explorer/reso-web-api",
    supportedAssetClasses: ["sfr", "duplex", "triplex", "quadplex", "multifamily", "str_airbnb"],
    credentialFields: [
      { key: "apiKey", label: "API Key", type: "secret", required: true, helpText: "Your Zillow Bridge API key from the partner portal.", placeholder: "zb_..." },
      { key: "serverId", label: "Server ID", type: "text", required: false, helpText: "Optional server ID for specific dataset access." },
    ],
    defaultRateLimits: { requestsPerSecond: 10, requestsPerDay: 1000 },
    capabilities: { propertyDetails: true, valuations: true, comps: true, listings: true, marketData: true, photos: true },
  },
  {
    key: "redfin",
    name: "Redfin / ATTOM Data",
    description: "Property valuations, listing data, and market trends. Uses ATTOM Data API for Redfin-comparable data.",
    providerType: "aggregator",
    authType: "api_key",
    websiteUrl: "https://www.attomdata.com/",
    docsUrl: "https://api.gateway.attomdata.com/propertyapi/v1.0.0/swagger-ui.html",
    supportedAssetClasses: ["sfr", "duplex", "triplex", "quadplex", "multifamily", "str_airbnb"],
    credentialFields: [
      { key: "apiKey", label: "ATTOM API Key", type: "secret", required: true, helpText: "API key from your ATTOM Data account.", placeholder: "..." },
    ],
    defaultRateLimits: { requestsPerSecond: 5, requestsPerDay: 5000 },
    capabilities: { propertyDetails: true, valuations: true, comps: true, listings: false, marketData: true, photos: false },
  },
  {
    key: "mls_reso",
    name: "MLS / RESO Web API",
    description: "Active listings, sold comparables, and market data from MLS boards via the RESO Web API standard.",
    providerType: "api",
    authType: "oauth2",
    websiteUrl: "https://www.reso.org/",
    docsUrl: "https://ddwiki.reso.org/display/DDW20/RESO+Data+Dictionary+2.0",
    supportedAssetClasses: ["sfr", "duplex", "triplex", "quadplex", "multifamily", "str_airbnb"],
    credentialFields: [
      { key: "clientId", label: "Client ID", type: "text", required: true, helpText: "OAuth2 client ID from your MLS board." },
      { key: "clientSecret", label: "Client Secret", type: "secret", required: true, helpText: "OAuth2 client secret." },
      { key: "tokenUrl", label: "Token URL", type: "url", required: true, helpText: "OAuth2 token endpoint.", placeholder: "https://api.mlsboard.com/oauth/token" },
      { key: "apiUrl", label: "API Base URL", type: "url", required: true, helpText: "RESO Web API base URL.", placeholder: "https://api.mlsboard.com/reso/odata" },
      { key: "mlsBoardName", label: "MLS Board Name", type: "text", required: false, helpText: "Name of the MLS board for display purposes." },
    ],
    defaultRateLimits: { requestsPerSecond: 5, requestsPerDay: 10000 },
    capabilities: { propertyDetails: true, valuations: false, comps: true, listings: true, marketData: false, photos: true },
  },
];
