/**
 * Universal scraper adapter framework for MarinaMatch marketplace ingestion.
 *
 * This generalizes the existing CRE-only liv2 pipeline to support any
 * marketplace source (CRE, operating businesses, franchises, note sales).
 * Concrete adapters extend ScraperAdapter and are registered in ./registry.
 */

export interface RawListing {
  sourceListingId: string;
  sourceUrl: string;
  title: string;
  description?: string;
  askingPrice?: number;
  currency?: string;
  location: {
    city?: string;
    state?: string;
    zip?: string;
    country?: string;
    lat?: number;
    lon?: number;
    isConfidential?: boolean;
  };
  images?: string[];
  rawCategoryLabel?: string;
  broker?: {
    name?: string;
    company?: string;
    email?: string;
    phone?: string;
  };
  publishedAt?: Date;
  raw: Record<string, any>;
}

export interface BusinessListingExtras {
  annualRevenue?: number;
  annualCashflowSde?: number;
  annualEbitda?: number;
  employeeCount?: number;
  yearEstablished?: number;
  realEstateIncluded?: boolean;
  leaseAssumable?: boolean;
  sellerFinancingAvailable?: boolean;
  reasonForSelling?: string;
  trainingOffered?: boolean;
  inventoryValue?: number;
  ffeValue?: number;
}

export type ListingCategory =
  | 'cre_property'
  | 'operating_business'
  | 'mixed_use_with_business'
  | 'franchise'
  | 'note_sale';

export interface NormalizedListing {
  listingCategory: ListingCategory;
  assetClass: string | null;
  source: { id: string; name: string; domain: string };
  raw: RawListing;
  businessMetrics?: BusinessListingExtras;
  creMetrics?: Record<string, any>;
}

export abstract class ScraperAdapter {
  abstract readonly sourceDomain: string;
  abstract readonly sourceName: string;
  abstract readonly defaultCategory: ListingCategory;

  /** Fetch a page of listings from the source. */
  abstract fetchListings(options: {
    maxListings?: number;
    sinceHours?: number;
  }): Promise<RawListing[]>;

  /** Normalize a raw listing into the universal shape. */
  abstract normalize(raw: RawListing): NormalizedListing;
}
