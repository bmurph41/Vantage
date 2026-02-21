/**
 * Zillow Bridge API Adapter
 *
 * Integrates with Zillow's Bridge API (bridgedataoutput.com) for:
 * - Property details & characteristics
 * - Zestimates (home value estimates)
 * - Rental Zestimates
 * - Comparable sales
 * - Market data
 *
 * Prerequisites: Zillow Bridge API partnership + API key
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
} from "./types";

export class ZillowBridgeAdapter implements IPropertyDataAdapter {
  key = "zillow_bridge";
  name = "Zillow Bridge API";
  supportedAssetClasses = ["sfr", "duplex", "triplex", "quadplex", "multifamily", "str_airbnb"];

  private baseUrl = "https://api.bridgedataoutput.com/api/v2";

  private getHeaders(credentials: Record<string, string>) {
    return {
      Authorization: `Bearer ${credentials.apiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    };
  }

  async testConnection(credentials: Record<string, string>): Promise<{ ok: boolean; error?: string }> {
    try {
      const resp = await fetch(`${this.baseUrl}/OData/Property?$top=1`, {
        headers: this.getHeaders(credentials),
      });

      if (resp.ok) {
        return { ok: true };
      }

      const body = await resp.text();
      return { ok: false, error: `HTTP ${resp.status}: ${body.substring(0, 200)}` };
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

    const limit = criteria.limit || 50;
    const offset = criteria.offset || 0;

    let url = `${this.baseUrl}/OData/Property?$top=${limit}&$skip=${offset}`;
    if (filters.length > 0) {
      url += `&$filter=${filters.join(" and ")}`;
    }

    const resp = await fetch(url, { headers: this.getHeaders(credentials) });

    if (!resp.ok) {
      throw new Error(`Zillow API error: ${resp.status} ${resp.statusText}`);
    }

    const data = await resp.json();
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
    const url = `${this.baseUrl}/OData/Property('${sourcePropertyId}')`;
    const resp = await fetch(url, { headers: this.getHeaders(credentials) });

    if (!resp.ok) {
      if (resp.status === 404) return null;
      throw new Error(`Zillow API error: ${resp.status}`);
    }

    const data = await resp.json();
    return this.normalizeProperty(data);
  }

  async getValuation(
    address: NormalizedAddress,
    credentials: Record<string, string>
  ): Promise<ValuationData | null> {
    const filter = [
      `StreetName eq '${address.street}'`,
      `City eq '${address.city}'`,
      `StateOrProvince eq '${address.state}'`,
      `PostalCode eq '${address.zip}'`,
    ].join(" and ");

    const url = `${this.baseUrl}/OData/Property?$filter=${encodeURIComponent(filter)}&$top=1`;
    const resp = await fetch(url, { headers: this.getHeaders(credentials) });

    if (!resp.ok) return null;

    const data = await resp.json();
    const item = data.value?.[0];
    if (!item) return null;

    return {
      estimatedValue: item.Zestimate || item.ListPrice,
      confidence: item.ZestimateConfidence || undefined,
      rentEstimate: item.RentalZestimate || undefined,
      lastSalePrice: item.ClosePrice || undefined,
      lastSaleDate: item.CloseDate || undefined,
      assessedValue: item.TaxAssessedValue || undefined,
      taxAmount: item.TaxAnnualAmount || undefined,
      pricePerSqft: item.ListPrice && item.LivingArea
        ? Math.round(item.ListPrice / item.LivingArea)
        : undefined,
    };
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

    // Geo-search with bounding box approximation
    const latDelta = radiusMiles / 69;
    const lngDelta = radiusMiles / (69 * Math.cos((criteria.latitude * Math.PI) / 180));
    filters.push(`Latitude ge ${criteria.latitude - latDelta}`);
    filters.push(`Latitude le ${criteria.latitude + latDelta}`);
    filters.push(`Longitude ge ${criteria.longitude - lngDelta}`);
    filters.push(`Longitude le ${criteria.longitude + lngDelta}`);

    const url = `${this.baseUrl}/OData/Property?$filter=${encodeURIComponent(filters.join(" and "))}&$top=${limit}&$orderby=CloseDate desc`;
    const resp = await fetch(url, { headers: this.getHeaders(credentials) });

    if (!resp.ok) return [];

    const data = await resp.json();
    return (data.value || []).map((item: any) => this.normalizeProperty(item));
  }

  async getMarketData(
    zip: string,
    credentials: Record<string, string>
  ): Promise<MarketData | null> {
    // Zillow Bridge doesn't have a direct market data endpoint;
    // compute from recent transactions in the zip code
    const now = new Date();
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(now.getMonth() - 6);

    const filter = [
      `PostalCode eq '${zip}'`,
      `StandardStatus eq 'Closed'`,
      `CloseDate ge ${sixMonthsAgo.toISOString().split("T")[0]}`,
    ].join(" and ");

    const url = `${this.baseUrl}/OData/Property?$filter=${encodeURIComponent(filter)}&$top=200&$orderby=CloseDate desc`;
    const resp = await fetch(url, { headers: this.getHeaders(credentials) });

    if (!resp.ok) return null;

    const data = await resp.json();
    const items = data.value || [];

    if (items.length === 0) return null;

    const prices = items.map((i: any) => i.ClosePrice).filter(Boolean).sort((a: number, b: number) => a - b);
    const doms = items.map((i: any) => i.DaysOnMarket).filter(Boolean);

    const median = (arr: number[]) => {
      const mid = Math.floor(arr.length / 2);
      return arr.length % 2 ? arr[mid] : (arr[mid - 1] + arr[mid]) / 2;
    };

    return {
      medianSalePrice: prices.length > 0 ? median(prices) : undefined,
      averageDaysOnMarket: doms.length > 0 ? Math.round(doms.reduce((a: number, b: number) => a + b, 0) / doms.length) : undefined,
      inventoryCount: items.length,
    };
  }

  // =============================================
  // Normalization
  // =============================================

  private normalizeProperty(raw: any): PropertyDataPayload {
    return {
      address: {
        street: [raw.StreetNumber, raw.StreetDirPrefix, raw.StreetName, raw.StreetSuffix, raw.StreetDirSuffix]
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
        estimatedValue: raw.Zestimate || raw.ListPrice || undefined,
        rentEstimate: raw.RentalZestimate || undefined,
        lastSalePrice: raw.ClosePrice || undefined,
        lastSaleDate: raw.CloseDate || undefined,
        assessedValue: raw.TaxAssessedValue || undefined,
        taxAmount: raw.TaxAnnualAmount || undefined,
        pricePerSqft: raw.ListPrice && raw.LivingArea
          ? Math.round(raw.ListPrice / raw.LivingArea)
          : undefined,
      },
      listing: {
        status: this.normalizeStatus(raw.StandardStatus),
        listPrice: raw.ListPrice || undefined,
        originalListPrice: raw.OriginalListPrice || undefined,
        soldPrice: raw.ClosePrice || undefined,
        daysOnMarket: raw.DaysOnMarket || undefined,
        cumulativeDaysOnMarket: raw.CumulativeDaysOnMarket || undefined,
        mlsNumber: raw.ListingId || undefined,
        listingAgent: raw.ListAgentFullName || undefined,
        listingAgentPhone: raw.ListAgentDirectPhone || undefined,
        listingOffice: raw.ListOfficeName || undefined,
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
        confidence: raw.ZestimateConfidence || 0.7,
        rawPayload: raw,
      },
    };
  }

  private normalizeStatus(status: string): ListingData["status"] {
    const map: Record<string, ListingData["status"]> = {
      Active: "active",
      Pending: "pending",
      Closed: "sold",
      Withdrawn: "withdrawn",
      Expired: "expired",
      "Coming Soon": "active",
      "Active Under Contract": "pending",
    };
    return map[status] || "off_market";
  }
}

type ListingData = import("./types").ListingData;
