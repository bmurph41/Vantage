/**
 * F.6 — Public Records / Title Data Service
 *
 * Integrates with ATTOM Data Solutions (or First American) to enrich
 * property records with ownership, tax, sale history, and lien data.
 */

const ATTOM_BASE_URL = "https://api.gateway.attomdata.com/propertyapi/v1.0.0";

interface PropertySnapshot {
  // Property facts
  yearBuilt: number | null;
  buildingSqFt: number | null;
  lotSqFt: number | null;
  totalUnits: number | null;
  stories: number | null;
  constructionType: string | null;
  propertyType: string | null;

  // Ownership
  currentOwner: string | null;
  ownerMailingAddress: string | null;
  ownershipType: string | null;

  // Tax info
  assessedValue: number | null;
  taxYear: number | null;
  annualTaxes: number | null;
  taxExemptions: string[];

  // Sale history (last 3)
  saleHistory: Array<{
    date: string;
    price: number;
    buyer: string | null;
    seller: string | null;
    docNumber: string | null;
  }>;
  lastSaleDate: string | null;
  lastSalePrice: number | null;

  // Liens
  liens: Array<{
    amount: number;
    type: string;
    lender: string | null;
    recordDate: string | null;
    status: string;
  }>;
  totalLienAmount: number;

  // Zoning
  zoningCode: string | null;
  zoningDescription: string | null;

  // Meta
  externalId: string | null;
  dataAsOf: string;
  provider: string;
}

export class PublicRecordsService {
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.ATTOM_API_KEY || "";
    this.baseUrl = ATTOM_BASE_URL;
  }

  private async attomFetch(path: string, params: Record<string, string> = {}): Promise<any> {
    if (!this.apiKey) {
      throw new Error("ATTOM_API_KEY not configured");
    }

    const url = new URL(`${this.baseUrl}${path}`);
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }

    const response = await fetch(url.toString(), {
      headers: {
        apikey: this.apiKey,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      if (response.status === 404) return null;
      const body = await response.text();
      throw new Error(`ATTOM API error (${response.status}): ${body}`);
    }

    return response.json();
  }

  /**
   * Look up ATTOM property ID from a street address
   */
  async lookupPropertyId(address: string): Promise<string | null> {
    // Parse address into components
    const parts = address.split(",").map((s) => s.trim());
    const address1 = parts[0] || "";
    const address2 = parts.slice(1).join(", ") || "";

    const data = await this.attomFetch("/property/address", {
      address1,
      address2,
    });

    if (!data?.property?.[0]?.identifier?.attomId) return null;
    return String(data.property[0].identifier.attomId);
  }

  /**
   * Fetch property detail from ATTOM
   */
  async getPropertyDetail(attomId: string): Promise<any> {
    return this.attomFetch("/property/detail", { attomid: attomId });
  }

  /**
   * Fetch sale history for a property
   */
  async getSaleHistory(attomId: string): Promise<any> {
    return this.attomFetch("/saleshistory/detail", { attomid: attomId });
  }

  /**
   * Fetch tax assessment history
   */
  async getTaxHistory(attomId: string): Promise<any> {
    return this.attomFetch("/assessment/detail", { attomid: attomId });
  }

  /**
   * Fetch mortgage/lien data
   */
  async getLienData(attomId: string): Promise<any> {
    return this.attomFetch("/property/mortgage", { attomid: attomId });
  }

  /**
   * Main enrichment function — pulls all data in parallel and normalizes
   */
  async enrichFromAddress(address: string): Promise<PropertySnapshot> {
    const attomId = await this.lookupPropertyId(address);

    if (!attomId) {
      // Return empty snapshot with provider info
      return this.emptySnapshot(address);
    }

    // Parallel fetch all data sources
    const [propertyData, saleData, taxData, lienData] = await Promise.allSettled([
      this.getPropertyDetail(attomId),
      this.getSaleHistory(attomId),
      this.getTaxHistory(attomId),
      this.getLienData(attomId),
    ]);

    const property = propertyData.status === "fulfilled" ? propertyData.value?.property?.[0] : null;
    const sales = saleData.status === "fulfilled" ? saleData.value?.property?.[0] : null;
    const tax = taxData.status === "fulfilled" ? taxData.value?.property?.[0] : null;
    const mortgages = lienData.status === "fulfilled" ? lienData.value?.property?.[0] : null;

    // Normalize property facts
    const building = property?.building || {};
    const lot = property?.lot || {};
    const summary = property?.summary || {};

    // Extract sale history
    const saleHistory = (sales?.saleHistory || [])
      .slice(0, 3)
      .map((s: any) => ({
        date: s.amount?.saleTransDate || s.amount?.saleRecDate || null,
        price: parseFloat(s.amount?.saleAmt) || 0,
        buyer: s.amount?.buyerName || null,
        seller: s.amount?.sellerName || null,
        docNumber: s.amount?.documentNumber || null,
      }))
      .filter((s: any) => s.price > 0);

    // Extract liens
    const liens = (mortgages?.mortgage || []).map((m: any) => ({
      amount: parseFloat(m.amount?.loanAmt) || 0,
      type: m.loanType || "mortgage",
      lender: m.lenderName || null,
      recordDate: m.deedDate || null,
      status: "active",
    }));

    // Tax info
    const assessment = tax?.assessment || {};

    return {
      yearBuilt: parseInt(summary.yearBuilt) || null,
      buildingSqFt: parseInt(building.size?.grossSize || building.size?.livingSize) || null,
      lotSqFt: parseInt(lot.lotSize1) || null,
      totalUnits: parseInt(summary.unitsCount) || null,
      stories: parseInt(building.rooms?.stories) || null,
      constructionType: building.construction?.constructionType || null,
      propertyType: summary.propType || summary.propSubType || null,

      currentOwner: property?.owner?.corporateIndicator === "Y"
        ? property?.owner?.owner1?.fullName || null
        : [property?.owner?.owner1?.lastName, property?.owner?.owner1?.firstName]
            .filter(Boolean)
            .join(", ") || null,
      ownerMailingAddress: [
        property?.owner?.mailingAddress?.address1,
        property?.owner?.mailingAddress?.address2,
      ]
        .filter(Boolean)
        .join(", ") || null,
      ownershipType: property?.owner?.corporateIndicator === "Y" ? "corporate" : "individual",

      assessedValue: parseFloat(assessment.assessed?.assdTtlValue) || null,
      taxYear: parseInt(assessment.tax?.taxYear) || null,
      annualTaxes: parseFloat(assessment.tax?.taxAmt) || null,
      taxExemptions: assessment.tax?.exemptions
        ? [assessment.tax.exemptions].flat().filter(Boolean)
        : [],

      saleHistory,
      lastSaleDate: saleHistory[0]?.date || null,
      lastSalePrice: saleHistory[0]?.price || null,

      liens,
      totalLienAmount: liens.reduce((sum: number, l: any) => sum + l.amount, 0),

      zoningCode: lot.zoningCode || null,
      zoningDescription: lot.zoningDescription || null,

      externalId: attomId,
      dataAsOf: new Date().toISOString().split("T")[0],
      provider: "attom",
    };
  }

  private emptySnapshot(address: string): PropertySnapshot {
    return {
      yearBuilt: null,
      buildingSqFt: null,
      lotSqFt: null,
      totalUnits: null,
      stories: null,
      constructionType: null,
      propertyType: null,
      currentOwner: null,
      ownerMailingAddress: null,
      ownershipType: null,
      assessedValue: null,
      taxYear: null,
      annualTaxes: null,
      taxExemptions: [],
      saleHistory: [],
      lastSaleDate: null,
      lastSalePrice: null,
      liens: [],
      totalLienAmount: 0,
      zoningCode: null,
      zoningDescription: null,
      externalId: null,
      dataAsOf: new Date().toISOString().split("T")[0],
      provider: "attom",
    };
  }
}
