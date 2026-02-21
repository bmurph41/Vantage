/**
 * Redfin / ATTOM Data Adapter
 *
 * Since Redfin does not offer a public API, this adapter uses the
 * ATTOM Data API as the primary source for Redfin-comparable property data:
 * - Property details & characteristics
 * - Automated Valuation Model (AVM)
 * - Comparable sales
 * - Market statistics
 *
 * Prerequisites: ATTOM Data API key (https://www.attomdata.com/)
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

export class RedfinAdapter implements IPropertyDataAdapter {
  key = "redfin";
  name = "Redfin / ATTOM Data";
  supportedAssetClasses = ["sfr", "duplex", "triplex", "quadplex", "multifamily", "str_airbnb"];

  private baseUrl = "https://api.gateway.attomdata.com/propertyapi/v1.0.0";

  private getHeaders(credentials: Record<string, string>) {
    return {
      apikey: credentials.apiKey,
      Accept: "application/json",
    };
  }

  async testConnection(credentials: Record<string, string>): Promise<{ ok: boolean; error?: string }> {
    try {
      const resp = await fetch(
        `${this.baseUrl}/property/address?address1=123+Main+St&address2=Los+Angeles+CA`,
        { headers: this.getHeaders(credentials) }
      );

      if (resp.ok || resp.status === 404) {
        return { ok: true };
      }

      if (resp.status === 401 || resp.status === 403) {
        return { ok: false, error: "Invalid API key or insufficient permissions." };
      }

      return { ok: false, error: `HTTP ${resp.status}: ${await resp.text()}` };
    } catch (err: any) {
      return { ok: false, error: err.message };
    }
  }

  async searchProperties(
    criteria: PropertySearchCriteria,
    credentials: Record<string, string>
  ): Promise<AdapterSearchResult> {
    const params = new URLSearchParams();

    if (criteria.zip) params.set("postalcode", criteria.zip);
    if (criteria.city && criteria.state) {
      params.set("address2", `${criteria.city}, ${criteria.state}`);
    }
    if (criteria.minBeds) params.set("minBeds", String(criteria.minBeds));
    if (criteria.maxBeds) params.set("maxBeds", String(criteria.maxBeds));
    if (criteria.minSqft) params.set("minLotSize1", String(criteria.minSqft));

    const limit = criteria.limit || 50;
    params.set("pagesize", String(limit));
    params.set("page", String(Math.floor((criteria.offset || 0) / limit) + 1));

    let endpoint = "/property/snapshot";
    if (criteria.latitude && criteria.longitude && criteria.radiusMiles) {
      endpoint = "/property/snapshot";
      params.set("latitude", String(criteria.latitude));
      params.set("longitude", String(criteria.longitude));
      params.set("radius", String(criteria.radiusMiles));
    }

    const url = `${this.baseUrl}${endpoint}?${params.toString()}`;
    const resp = await fetch(url, { headers: this.getHeaders(credentials) });

    if (!resp.ok) {
      throw new Error(`ATTOM API error: ${resp.status}`);
    }

    const data = await resp.json();
    const properties = data.property || [];
    const results = properties.map((item: any) => this.normalizeProperty(item));

    return {
      total: data.status?.total || results.length,
      results,
      hasMore: results.length >= limit,
      nextOffset: (criteria.offset || 0) + results.length,
    };
  }

  async getProperty(
    sourcePropertyId: string,
    credentials: Record<string, string>
  ): Promise<PropertyDataPayload | null> {
    const url = `${this.baseUrl}/property/expandedprofile?attomid=${sourcePropertyId}`;
    const resp = await fetch(url, { headers: this.getHeaders(credentials) });

    if (!resp.ok) {
      if (resp.status === 404) return null;
      throw new Error(`ATTOM API error: ${resp.status}`);
    }

    const data = await resp.json();
    const item = data.property?.[0];
    if (!item) return null;

    return this.normalizeProperty(item);
  }

  async getValuation(
    address: NormalizedAddress,
    credentials: Record<string, string>
  ): Promise<ValuationData | null> {
    const params = new URLSearchParams({
      address1: address.street,
      address2: `${address.city}, ${address.state} ${address.zip}`,
    });

    const url = `${this.baseUrl}/valuation/homeequity?${params.toString()}`;
    const resp = await fetch(url, { headers: this.getHeaders(credentials) });

    if (!resp.ok) return null;

    const data = await resp.json();
    const item = data.property?.[0];
    if (!item) return null;

    const avm = item.avm || {};
    const assessment = item.assessment || {};

    return {
      estimatedValue: avm.amount?.value || undefined,
      estimatedValueLow: avm.amount?.low || undefined,
      estimatedValueHigh: avm.amount?.high || undefined,
      confidence: avm.amount?.scr ? avm.amount.scr / 100 : undefined,
      lastSalePrice: item.sale?.amount?.saleAmt || undefined,
      lastSaleDate: item.sale?.amount?.saleRecDate || undefined,
      assessedValue: assessment.assessed?.assdTtlValue || undefined,
      taxAmount: assessment.tax?.taxAmt || undefined,
      taxYear: assessment.tax?.taxYear || undefined,
    };
  }

  async getComps(
    criteria: CompsSearchCriteria,
    credentials: Record<string, string>
  ): Promise<PropertyDataPayload[]> {
    const params = new URLSearchParams({
      latitude: String(criteria.latitude),
      longitude: String(criteria.longitude),
      radius: String(criteria.radiusMiles || 1),
      searchType: "Radius",
      orderBy: "distance",
    });

    if (criteria.minBeds) params.set("minBeds", String(criteria.minBeds));
    if (criteria.maxBeds) params.set("maxBeds", String(criteria.maxBeds));
    if (criteria.minSqft) params.set("minBuildingSqFt", String(criteria.minSqft));
    if (criteria.maxSqft) params.set("maxBuildingSqFt", String(criteria.maxSqft));

    const limit = criteria.limit || 10;
    params.set("pagesize", String(limit));

    const url = `${this.baseUrl}/sale/snapshot?${params.toString()}`;
    const resp = await fetch(url, { headers: this.getHeaders(credentials) });

    if (!resp.ok) return [];

    const data = await resp.json();
    return (data.property || []).map((item: any) => this.normalizeProperty(item));
  }

  async getMarketData(
    zip: string,
    credentials: Record<string, string>
  ): Promise<MarketData | null> {
    const params = new URLSearchParams({ postalcode: zip });
    const url = `${this.baseUrl}/sale/snapshot?${params.toString()}&pagesize=100&orderby=SaleSearchDate desc`;
    const resp = await fetch(url, { headers: this.getHeaders(credentials) });

    if (!resp.ok) return null;

    const data = await resp.json();
    const items = data.property || [];

    if (items.length === 0) return null;

    const prices = items
      .map((i: any) => i.sale?.amount?.saleAmt)
      .filter(Boolean)
      .sort((a: number, b: number) => a - b);

    const median = (arr: number[]) => {
      const mid = Math.floor(arr.length / 2);
      return arr.length % 2 ? arr[mid] : (arr[mid - 1] + arr[mid]) / 2;
    };

    return {
      medianSalePrice: prices.length > 0 ? median(prices) : undefined,
      inventoryCount: items.length,
    };
  }

  // =============================================
  // Normalization
  // =============================================

  private normalizeProperty(raw: any): PropertyDataPayload {
    const addr = raw.address || {};
    const building = raw.building || {};
    const lot = raw.lot || {};
    const summary = raw.summary || {};
    const sale = raw.sale || {};
    const assessment = raw.assessment || {};
    const avm = raw.avm || {};

    return {
      address: {
        street: addr.line1 || addr.oneLine || "",
        city: addr.locality || "",
        state: addr.countrySubd || "",
        zip: addr.postal1 || "",
        county: addr.countrySecSubd || undefined,
        latitude: raw.location?.latitude || undefined,
        longitude: raw.location?.longitude || undefined,
      },
      characteristics: {
        beds: building.rooms?.beds || undefined,
        baths: building.rooms?.bathsFull || undefined,
        halfBaths: building.rooms?.bathsHalf || undefined,
        sqft: building.size?.bldgSize || building.size?.livingSize || undefined,
        lotSizeSqft: lot.lotSize2 || undefined,
        yearBuilt: summary.yearBuilt || undefined,
        stories: building.summary?.levels || undefined,
        garageSpaces: building.parking?.prkgSpaces || undefined,
        pool: building.summary?.pool === true,
        units: building.summary?.unitsCount || undefined,
        propertyType: summary.propType || summary.propSubType || undefined,
        constructionType: building.construction?.constructionType || undefined,
        roofType: building.construction?.roofCover || undefined,
      },
      valuation: {
        estimatedValue: avm.amount?.value || undefined,
        estimatedValueLow: avm.amount?.low || undefined,
        estimatedValueHigh: avm.amount?.high || undefined,
        confidence: avm.amount?.scr ? avm.amount.scr / 100 : undefined,
        lastSalePrice: sale.amount?.saleAmt || undefined,
        lastSaleDate: sale.amount?.saleRecDate || undefined,
        assessedValue: assessment.assessed?.assdTtlValue || undefined,
        taxAmount: assessment.tax?.taxAmt || undefined,
        taxYear: assessment.tax?.taxYear || undefined,
      },
      listing: {},
      market: {},
      metadata: {
        sourceKey: this.key,
        sourcePropertyId: raw.identifier?.attomId || raw.identifier?.Id || "",
        fetchedAt: new Date().toISOString(),
        confidence: avm.amount?.scr ? avm.amount.scr / 100 : 0.6,
        rawPayload: raw,
      },
    };
  }
}
