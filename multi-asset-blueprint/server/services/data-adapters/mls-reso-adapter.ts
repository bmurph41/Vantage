/**
 * MLS / RESO Web API Adapter
 *
 * Integrates with any MLS board that implements the RESO Web API standard.
 * Supports OAuth 2.0 (client_credentials) authentication.
 *
 * Data available:
 * - Active listings
 * - Sold/closed comparables
 * - Property details
 * - Listing history
 * - Photos (via Media resource)
 *
 * Prerequisites: MLS board membership + OAuth credentials
 */

import type {
  IPropertyDataAdapter,
  PropertySearchCriteria,
  PropertyDataPayload,
  AdapterSearchResult,
  NormalizedAddress,
  ValuationData,
  CompsSearchCriteria,
  MarketData,
  ListingData,
} from "./types";

export class MlsResoAdapter implements IPropertyDataAdapter {
  key = "mls_reso";
  name = "MLS / RESO Web API";
  supportedAssetClasses = ["sfr", "duplex", "triplex", "quadplex", "multifamily", "str_airbnb"];

  private tokenCache: { token: string; expiresAt: number } | null = null;

  private async getAccessToken(credentials: Record<string, string>): Promise<string> {
    if (this.tokenCache && Date.now() < this.tokenCache.expiresAt) {
      return this.tokenCache.token;
    }

    const resp = await fetch(credentials.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: credentials.clientId,
        client_secret: credentials.clientSecret,
        scope: "api",
      }),
    });

    if (!resp.ok) {
      throw new Error(`MLS OAuth token request failed: ${resp.status}`);
    }

    const data = await resp.json();
    this.tokenCache = {
      token: data.access_token,
      expiresAt: Date.now() + (data.expires_in || 3600) * 1000 - 60000,
    };

    return this.tokenCache.token;
  }

  private async apiRequest(
    endpoint: string,
    credentials: Record<string, string>
  ): Promise<any> {
    const token = await this.getAccessToken(credentials);
    const url = `${credentials.apiUrl}${endpoint}`;

    const resp = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    });

    if (!resp.ok) {
      throw new Error(`MLS API error: ${resp.status} ${resp.statusText}`);
    }

    return resp.json();
  }

  async testConnection(credentials: Record<string, string>): Promise<{ ok: boolean; error?: string }> {
    try {
      await this.getAccessToken(credentials);
      const data = await this.apiRequest("/Property?$top=1", credentials);
      return { ok: true };
    } catch (err: any) {
      return { ok: false, error: err.message };
    }
  }

  async searchProperties(
    criteria: PropertySearchCriteria,
    credentials: Record<string, string>
  ): Promise<AdapterSearchResult> {
    const filters: string[] = [];

    if (criteria.city) filters.push(`City eq '${criteria.city}'`);
    if (criteria.state) filters.push(`StateOrProvince eq '${criteria.state}'`);
    if (criteria.zip) filters.push(`PostalCode eq '${criteria.zip}'`);
    if (criteria.minPrice) filters.push(`ListPrice ge ${criteria.minPrice}`);
    if (criteria.maxPrice) filters.push(`ListPrice le ${criteria.maxPrice}`);
    if (criteria.minBeds) filters.push(`BedroomsTotal ge ${criteria.minBeds}`);
    if (criteria.maxBeds) filters.push(`BedroomsTotal le ${criteria.maxBeds}`);
    if (criteria.minSqft) filters.push(`LivingArea ge ${criteria.minSqft}`);
    if (criteria.maxSqft) filters.push(`LivingArea le ${criteria.maxSqft}`);
    if (criteria.minYearBuilt) filters.push(`YearBuilt ge ${criteria.minYearBuilt}`);

    if (criteria.listingStatus?.includes("active")) {
      filters.push(`StandardStatus eq 'Active'`);
    } else if (criteria.listingStatus?.includes("sold")) {
      filters.push(`StandardStatus eq 'Closed'`);
    }

    // Property type mapping for asset classes
    if (criteria.assetClasses?.length) {
      const resoTypes = criteria.assetClasses
        .map((ac) => this.assetClassToResoType(ac))
        .filter(Boolean);
      if (resoTypes.length > 0) {
        const typeFilter = resoTypes.map((t) => `PropertyType eq '${t}'`).join(" or ");
        filters.push(`(${typeFilter})`);
      }
    }

    const limit = criteria.limit || 50;
    const offset = criteria.offset || 0;

    let endpoint = `/Property?$top=${limit}&$skip=${offset}&$count=true`;
    if (filters.length > 0) {
      endpoint += `&$filter=${encodeURIComponent(filters.join(" and "))}`;
    }

    const orderMap: Record<string, string> = {
      price: "ListPrice",
      date: "ListDate",
      sqft: "LivingArea",
    };
    const orderField = orderMap[criteria.sortBy || "date"] || "ListDate";
    const orderDir = criteria.sortDir === "asc" ? "asc" : "desc";
    endpoint += `&$orderby=${orderField} ${orderDir}`;

    const data = await this.apiRequest(endpoint, credentials);
    const results = (data.value || []).map((item: any) => this.normalizeProperty(item));
    const total = data["@odata.count"] || results.length;

    return {
      total,
      results,
      hasMore: offset + results.length < total,
      nextOffset: offset + results.length,
    };
  }

  async getProperty(
    sourcePropertyId: string,
    credentials: Record<string, string>
  ): Promise<PropertyDataPayload | null> {
    try {
      const data = await this.apiRequest(`/Property('${sourcePropertyId}')`, credentials);
      return this.normalizeProperty(data);
    } catch {
      return null;
    }
  }

  async getValuation(
    _address: NormalizedAddress,
    _credentials: Record<string, string>
  ): Promise<ValuationData | null> {
    // MLS does not provide valuations/estimates
    // Return null — the orchestrator will fall back to Zillow/ATTOM
    return null;
  }

  async getComps(
    criteria: CompsSearchCriteria,
    credentials: Record<string, string>
  ): Promise<PropertyDataPayload[]> {
    const radiusMiles = criteria.radiusMiles || 1;
    const limit = criteria.limit || 10;
    const monthsBack = criteria.soldWithinMonths || 12;
    const sinceDate = new Date();
    sinceDate.setMonth(sinceDate.getMonth() - monthsBack);

    const filters = [
      `StandardStatus eq 'Closed'`,
      `CloseDate ge ${sinceDate.toISOString().split("T")[0]}`,
    ];

    if (criteria.minBeds) filters.push(`BedroomsTotal ge ${criteria.minBeds}`);
    if (criteria.maxBeds) filters.push(`BedroomsTotal le ${criteria.maxBeds}`);
    if (criteria.minSqft) filters.push(`LivingArea ge ${criteria.minSqft}`);
    if (criteria.maxSqft) filters.push(`LivingArea le ${criteria.maxSqft}`);

    // Bounding box geo filter
    const latDelta = radiusMiles / 69;
    const lngDelta = radiusMiles / (69 * Math.cos((criteria.latitude * Math.PI) / 180));
    filters.push(`Latitude ge ${criteria.latitude - latDelta}`);
    filters.push(`Latitude le ${criteria.latitude + latDelta}`);
    filters.push(`Longitude ge ${criteria.longitude - lngDelta}`);
    filters.push(`Longitude le ${criteria.longitude + lngDelta}`);

    if (criteria.assetClass) {
      const resoType = this.assetClassToResoType(criteria.assetClass);
      if (resoType) filters.push(`PropertyType eq '${resoType}'`);
    }

    const endpoint = `/Property?$filter=${encodeURIComponent(filters.join(" and "))}&$top=${limit}&$orderby=CloseDate desc`;
    const data = await this.apiRequest(endpoint, credentials);

    return (data.value || []).map((item: any) => this.normalizeProperty(item));
  }

  async getMarketData(
    zip: string,
    credentials: Record<string, string>
  ): Promise<MarketData | null> {
    // Compute from active + sold listings in the zip
    try {
      const activeEndpoint = `/Property?$filter=${encodeURIComponent(
        `PostalCode eq '${zip}' and StandardStatus eq 'Active'`
      )}&$top=200&$count=true`;

      const activeData = await this.apiRequest(activeEndpoint, credentials);
      const activeCount = activeData["@odata.count"] || 0;

      const now = new Date();
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(now.getMonth() - 6);

      const soldEndpoint = `/Property?$filter=${encodeURIComponent(
        `PostalCode eq '${zip}' and StandardStatus eq 'Closed' and CloseDate ge ${sixMonthsAgo.toISOString().split("T")[0]}`
      )}&$top=200&$orderby=CloseDate desc`;

      const soldData = await this.apiRequest(soldEndpoint, credentials);
      const soldItems = soldData.value || [];

      const prices = soldItems
        .map((i: any) => i.ClosePrice)
        .filter(Boolean)
        .sort((a: number, b: number) => a - b);

      const doms = soldItems.map((i: any) => i.DaysOnMarket).filter(Boolean);

      const median = (arr: number[]) => {
        const mid = Math.floor(arr.length / 2);
        return arr.length % 2 ? arr[mid] : (arr[mid - 1] + arr[mid]) / 2;
      };

      return {
        medianSalePrice: prices.length > 0 ? median(prices) : undefined,
        averageDaysOnMarket:
          doms.length > 0
            ? Math.round(doms.reduce((a: number, b: number) => a + b, 0) / doms.length)
            : undefined,
        inventoryCount: activeCount,
      };
    } catch {
      return null;
    }
  }

  // =============================================
  // Helpers
  // =============================================

  private assetClassToResoType(assetClass: string): string | null {
    const map: Record<string, string> = {
      sfr: "Residential",
      duplex: "Residential",
      triplex: "Residential",
      quadplex: "Residential",
      multifamily: "Residential Income",
      str_airbnb: "Residential",
    };
    return map[assetClass] || null;
  }

  private normalizeProperty(raw: any): PropertyDataPayload {
    return {
      address: {
        street: [raw.StreetNumber, raw.StreetDirPrefix, raw.StreetName, raw.StreetSuffix]
          .filter(Boolean)
          .join(" "),
        city: raw.City || "",
        state: raw.StateOrProvince || "",
        zip: raw.PostalCode || "",
        county: raw.CountyOrParish || undefined,
        latitude: raw.Latitude || undefined,
        longitude: raw.Longitude || undefined,
      },
      characteristics: {
        beds: raw.BedroomsTotal || undefined,
        baths: raw.BathroomsFull || undefined,
        halfBaths: raw.BathroomsHalf || undefined,
        sqft: raw.LivingArea || undefined,
        lotSizeSqft: raw.LotSizeSquareFeet || undefined,
        yearBuilt: raw.YearBuilt || undefined,
        stories: raw.StoriesTotal || undefined,
        garageSpaces: raw.GarageSpaces || undefined,
        pool: raw.PoolPrivateYN || false,
        units: raw.NumberOfUnitsTotal || undefined,
        propertyType: raw.PropertyType || undefined,
        constructionType: raw.ConstructionMaterials?.[0] || undefined,
        roofType: raw.Roof?.[0] || undefined,
        heatingType: raw.Heating?.[0] || undefined,
        coolingType: raw.Cooling?.[0] || undefined,
      },
      valuation: {
        lastSalePrice: raw.ClosePrice || undefined,
        lastSaleDate: raw.CloseDate || undefined,
        assessedValue: raw.TaxAssessedValue || undefined,
        taxAmount: raw.TaxAnnualAmount || undefined,
        pricePerSqft: raw.ClosePrice && raw.LivingArea
          ? Math.round(raw.ClosePrice / raw.LivingArea)
          : raw.ListPrice && raw.LivingArea
            ? Math.round(raw.ListPrice / raw.LivingArea)
            : undefined,
      },
      listing: {
        status: this.normalizeListingStatus(raw.StandardStatus),
        listPrice: raw.ListPrice || undefined,
        originalListPrice: raw.OriginalListPrice || undefined,
        soldPrice: raw.ClosePrice || undefined,
        daysOnMarket: raw.DaysOnMarket || undefined,
        cumulativeDaysOnMarket: raw.CumulativeDaysOnMarket || undefined,
        mlsNumber: raw.ListingId || undefined,
        listingAgent: raw.ListAgentFullName || undefined,
        listingAgentPhone: raw.ListAgentDirectPhone || undefined,
        listingOffice: raw.ListOfficeName || undefined,
        buyerAgent: raw.BuyerAgentFullName || undefined,
        buyerOffice: raw.BuyerOfficeName || undefined,
        listDate: raw.ListDate || undefined,
        pendingDate: raw.PendingTimestamp || undefined,
        soldDate: raw.CloseDate || undefined,
        description: raw.PublicRemarks || undefined,
        virtualTourUrl: raw.VirtualTourURLUnbranded || undefined,
      },
      market: {},
      metadata: {
        sourceKey: this.key,
        sourcePropertyId: raw.ListingKey || raw.ListingId || "",
        fetchedAt: new Date().toISOString(),
        confidence: 0.9,
        rawPayload: raw,
      },
    };
  }

  private normalizeListingStatus(status: string): ListingData["status"] {
    const map: Record<string, ListingData["status"]> = {
      Active: "active",
      "Active Under Contract": "pending",
      Pending: "pending",
      Closed: "sold",
      Withdrawn: "withdrawn",
      Expired: "expired",
      Canceled: "withdrawn",
      Hold: "off_market",
      "Coming Soon": "active",
      Delete: "off_market",
    };
    return map[status] || "off_market";
  }
}
