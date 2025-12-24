import { pgTable, text, integer, boolean, timestamp, jsonb, uuid, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';

export const liv2Sources = pgTable('liv2_sources', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  domain: text('domain').notNull().unique(),
  type: text('type').notNull().$type<'html' | 'api'>().default('html'),
  rules: jsonb('rules').$type<Liv2SourceRules>(),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const liv2ScrapeRuns = pgTable('liv2_scrape_runs', {
  id: uuid('id').defaultRandom().primaryKey(),
  sourceId: uuid('source_id').notNull().references(() => liv2Sources.id),
  startedAt: timestamp('started_at').defaultNow().notNull(),
  completedAt: timestamp('completed_at'),
  status: text('status').notNull().$type<'running' | 'success' | 'partial' | 'failed'>().default('running'),
  metrics: jsonb('metrics').$type<Liv2RunMetrics>(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const liv2RawPages = pgTable('liv2_raw_pages', {
  id: uuid('id').defaultRandom().primaryKey(),
  runId: uuid('run_id').notNull().references(() => liv2ScrapeRuns.id),
  sourceId: uuid('source_id').notNull().references(() => liv2Sources.id),
  url: text('url').notNull(),
  finalUrl: text('final_url'),
  statusCode: integer('status_code'),
  fetchedAt: timestamp('fetched_at').defaultNow().notNull(),
  headers: jsonb('headers').$type<Record<string, string>>(),
  bodyHash: text('body_hash'),
  html: text('html'),
  error: text('error'),
}, (table) => [
  index('liv2_raw_pages_run_id_idx').on(table.runId),
]);

export const liv2ListingCandidates = pgTable('liv2_listing_candidates', {
  id: uuid('id').defaultRandom().primaryKey(),
  runId: uuid('run_id').notNull().references(() => liv2ScrapeRuns.id),
  sourceId: uuid('source_id').notNull().references(() => liv2Sources.id),
  url: text('url').notNull(),
  canonicalUrl: text('canonical_url'),
  stableSourceKey: text('stable_source_key'),
  identityConfidence: integer('identity_confidence').notNull().default(0),
  canonicalListingId: text('canonical_listing_id'),
  discoveredAt: timestamp('discovered_at').defaultNow().notNull(),
  status: text('status').notNull().$type<'pending' | 'extracted' | 'quarantined' | 'error'>().default('pending'),
  reason: text('reason'),
}, (table) => [
  index('liv2_listing_candidates_canonical_id_idx').on(table.canonicalListingId),
  index('liv2_listing_candidates_source_url_idx').on(table.sourceId, table.canonicalUrl),
]);

export const liv2ListingPayloads = pgTable('liv2_listing_payloads', {
  id: uuid('id').defaultRandom().primaryKey(),
  canonicalListingId: text('canonical_listing_id').notNull(),
  sourceId: uuid('source_id').notNull().references(() => liv2Sources.id),
  extractedAt: timestamp('extracted_at').defaultNow().notNull(),
  extractorVersion: text('extractor_version').notNull().default('1.0.0'),
  payload: jsonb('payload').$type<ListingPayloadV2>().notNull(),
  payloadHash: text('payload_hash').notNull(),
  validation: jsonb('validation').$type<ValidationResult>(),
}, (table) => [
  uniqueIndex('liv2_listing_payloads_unique_idx').on(table.canonicalListingId, table.payloadHash),
  index('liv2_listing_payloads_canonical_id_idx').on(table.canonicalListingId),
]);

export const liv2ListingAssets = pgTable('liv2_listing_assets', {
  id: uuid('id').defaultRandom().primaryKey(),
  canonicalListingId: text('canonical_listing_id').notNull(),
  sourceId: uuid('source_id').notNull().references(() => liv2Sources.id),
  assetType: text('asset_type').notNull().$type<'image'>().default('image'),
  assetUrl: text('asset_url').notNull(),
  assetUrlNormalized: text('asset_url_normalized').notNull(),
  originUrl: text('origin_url').notNull(),
  contentHash: text('content_hash'),
  bytes: integer('bytes'),
  width: integer('width'),
  height: integer('height'),
  verified: boolean('verified').notNull().default(false),
  verificationReason: text('verification_reason'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  uniqueIndex('liv2_listing_assets_unique_idx').on(table.canonicalListingId, table.assetUrlNormalized),
  index('liv2_listing_assets_canonical_id_idx').on(table.canonicalListingId),
]);

export const liv2Quarantine = pgTable('liv2_quarantine', {
  id: uuid('id').defaultRandom().primaryKey(),
  sourceId: uuid('source_id').notNull().references(() => liv2Sources.id),
  url: text('url').notNull(),
  canonicalUrl: text('canonical_url'),
  canonicalListingId: text('canonical_listing_id'),
  identityConfidence: integer('identity_confidence'),
  payload: jsonb('payload').$type<Partial<ListingPayloadV2>>(),
  validation: jsonb('validation').$type<ValidationResult>(),
  reason: text('reason').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const liv2FieldProvenance = pgTable('liv2_field_provenance', {
  id: uuid('id').defaultRandom().primaryKey(),
  canonicalListingId: text('canonical_listing_id').notNull(),
  sourceId: uuid('source_id').notNull().references(() => liv2Sources.id),
  fieldName: text('field_name').notNull(),
  fieldValueHash: text('field_value_hash').notNull(),
  originUrl: text('origin_url').notNull(),
  extractedAt: timestamp('extracted_at').defaultNow().notNull(),
  extractorVersion: text('extractor_version').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('liv2_field_provenance_canonical_field_idx').on(table.canonicalListingId, table.fieldName),
]);

export const liv2ListingsCurrent = pgTable('liv2_listings_current', {
  id: uuid('id').defaultRandom().primaryKey(),
  canonicalListingId: text('canonical_listing_id').notNull().unique(),
  sourceId: uuid('source_id').notNull().references(() => liv2Sources.id),
  domain: text('domain').notNull(),
  title: text('title'),
  listingType: text('listing_type').$type<ListingType>(),
  status: text('status').$type<ListingStatus>(),
  askingPrice: integer('asking_price'),
  currency: text('currency').default('USD'),
  priceType: text('price_type').$type<'asking' | 'auction' | 'unknown'>(),
  address1: text('address1'),
  city: text('city'),
  state: text('state'),
  postalCode: text('postal_code'),
  country: text('country'),
  lat: text('lat'),
  lng: text('lng'),
  geoPrecision: text('geo_precision'),
  description: text('description'),
  acreage: text('acreage'),
  waterfrontFeet: integer('waterfront_feet'),
  slips: integer('slips'),
  dryRacks: integer('dry_racks'),
  occupancy: integer('occupancy'),
  capRate: text('cap_rate'),
  noi: integer('noi'),
  revenue: integer('revenue'),
  yearBuilt: integer('year_built'),
  zoning: text('zoning'),
  brokerName: text('broker_name'),
  brokerCompany: text('broker_company'),
  brokerPhone: text('broker_phone'),
  brokerEmail: text('broker_email'),
  heroImageUrl: text('hero_image_url'),
  imageCount: integer('image_count').default(0),
  sourceUrl: text('source_url'),
  canonicalUrl: text('canonical_url'),
  publishedAt: timestamp('published_at'),
  lastPayloadHash: text('last_payload_hash'),
  lastExtractedAt: timestamp('last_extracted_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  index('liv2_listings_current_domain_idx').on(table.domain),
  index('liv2_listings_current_state_idx').on(table.state),
]);

export interface Liv2SourceRules {
  contentSelectors?: {
    title?: string;
    price?: string;
    address?: string;
    description?: string;
    gallery?: string;
    broker?: string;
    listingId?: string;
  };
  imageAllowPatterns?: string[];
  urlPatterns?: {
    listing?: string;
    index?: string;
  };
  jsonLdType?: string;
  rateLimit?: {
    requestsPerMinute: number;
    delayMs: number;
  };
}

export interface Liv2RunMetrics {
  pagesDiscovered: number;
  pagesFetched: number;
  pagesFailed: number;
  listingsExtracted: number;
  listingsQuarantined: number;
  imagesProcessed: number;
  imagesVerified: number;
  durationMs: number;
}

export type ListingType = 'marina' | 'rv_park' | 'mixed_use' | 'land' | 'business_only' | 'other';
export type ListingStatus = 'active' | 'under_contract' | 'sold' | 'unknown';

export interface ListingPayloadV2 {
  source: {
    domain: string;
    url: string;
    canonicalUrl: string;
    stableKey?: string;
  };
  identity: {
    canonicalListingId: string;
    confidence: number;
    matchBasis: 'explicit_id' | 'canonical_url' | 'jsonld' | 'address_geo_fallback';
  };
  core: {
    title?: string;
    listingType?: ListingType;
    status?: ListingStatus;
  };
  pricing: {
    price?: { amount: number; currency: 'USD' };
    priceType?: 'asking' | 'auction' | 'unknown';
  };
  location: {
    address1?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
    lat?: number;
    lng?: number;
    geoPrecision?: 'rooftop' | 'range_interpolated' | 'approximate' | 'unknown';
  };
  details: {
    description?: string;
    acreage?: number;
    waterfrontFeet?: number;
    slips?: number;
    dryRacks?: number;
    rackCount?: number;
    occupancy?: number;
    capRate?: number;
    noi?: number;
    revenue?: number;
    yearBuilt?: number;
    zoning?: string;
    parcels?: string[];
  };
  contacts: {
    brokerName?: string;
    brokerCompany?: string;
    brokerPhone?: string;
    brokerEmail?: string;
  };
  media: {
    images: Array<{
      url: string;
      urlNormalized: string;
      verified: boolean;
      contentHash?: string;
    }>;
    heroImageUrl?: string;
  };
  timestamps: {
    scrapedAt: string;
    publishedAt?: string;
    updatedAt?: string;
  };
  meta?: Record<string, unknown>;
}

export interface ValidationResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

export const insertLiv2SourceSchema = createInsertSchema(liv2Sources).omit({ id: true, createdAt: true, updatedAt: true });
export const insertLiv2ScrapeRunSchema = createInsertSchema(liv2ScrapeRuns).omit({ id: true, createdAt: true });
export const insertLiv2RawPageSchema = createInsertSchema(liv2RawPages).omit({ id: true });
export const insertLiv2ListingCandidateSchema = createInsertSchema(liv2ListingCandidates).omit({ id: true });
export const insertLiv2ListingPayloadSchema = createInsertSchema(liv2ListingPayloads).omit({ id: true });
export const insertLiv2ListingAssetSchema = createInsertSchema(liv2ListingAssets).omit({ id: true, createdAt: true });
export const insertLiv2QuarantineSchema = createInsertSchema(liv2Quarantine).omit({ id: true, createdAt: true });
export const insertLiv2FieldProvenanceSchema = createInsertSchema(liv2FieldProvenance).omit({ id: true, createdAt: true });

export type Liv2Source = typeof liv2Sources.$inferSelect;
export type InsertLiv2Source = z.infer<typeof insertLiv2SourceSchema>;
export type Liv2ScrapeRun = typeof liv2ScrapeRuns.$inferSelect;
export type Liv2RawPage = typeof liv2RawPages.$inferSelect;
export type Liv2ListingCandidate = typeof liv2ListingCandidates.$inferSelect;
export type Liv2ListingPayload = typeof liv2ListingPayloads.$inferSelect;
export type Liv2ListingAsset = typeof liv2ListingAssets.$inferSelect;
export type Liv2Quarantine = typeof liv2Quarantine.$inferSelect;
export type Liv2FieldProvenance = typeof liv2FieldProvenance.$inferSelect;
export type Liv2ListingCurrent = typeof liv2ListingsCurrent.$inferSelect;
