/**
 * Multi-Asset-Class Property Data Framework — Schema Definitions
 *
 * Add this to: shared/schema.ts
 * Then run: npx drizzle-kit generate && npx drizzle-kit push
 */

import {
  pgTable,
  pgEnum,
  uuid,
  varchar,
  text,
  boolean,
  integer,
  timestamp,
  jsonb,
  index,
  real,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// =============================================
// ENUMS
// =============================================

export const platformAssetClassEnum = pgEnum("platform_asset_class", [
  "sfr",            // Single Family Rental
  "duplex",         // Duplex
  "triplex",        // Triplex
  "quadplex",       // Quadplex
  "multifamily",    // Multifamily (5+ units)
  "str_airbnb",     // Short-Term Rental (Airbnb/VRBO)
  "marina",         // Marina (existing)
  "rv_park",        // RV Park
  "self_storage",   // Self Storage
  "mobile_home",    // Mobile Home Park
  "hotel",          // Hotel/Motel
  "mixed_use",      // Mixed Use
  "office",         // Office
  "retail",         // Retail
  "industrial",     // Industrial
  "land",           // Land
]);

export const assetClassCategoryEnum = pgEnum("asset_class_category", [
  "residential",
  "commercial",
  "hospitality",
  "specialty",
  "land",
]);

export const dataSourceProviderTypeEnum = pgEnum("data_source_provider_type", [
  "api",        // Direct API integration
  "feed",       // Data feed (RETS, IDX)
  "aggregator", // Third-party aggregator (ATTOM, CoreLogic)
  "scraper",    // Web scraping (rate-limited, cached)
]);

export const dataSourceStatusEnum = pgEnum("data_source_status", [
  "disconnected",
  "connected",
  "syncing",
  "error",
  "rate_limited",
  "suspended",
]);

export const dataSourceAuthTypeEnum = pgEnum("data_source_auth_type", [
  "api_key",
  "oauth2",
  "basic",
  "rets",
  "none",
]);

export const syncFrequencyEnum = pgEnum("sync_frequency", [
  "realtime",
  "hourly",
  "daily",
  "weekly",
  "monthly",
  "manual",
]);

export const syncLogStatusEnum = pgEnum("sync_log_status", [
  "started",
  "completed",
  "failed",
  "partial",
  "cancelled",
]);

// =============================================
// TABLES
// =============================================

/**
 * Platform Asset Classes
 * Defines all supported property/asset types with per-class configuration.
 * Admin-managed: enable/disable classes, set defaults.
 */
export const platformAssetClasses = pgTable("platform_asset_classes", {
  id: uuid("id").defaultRandom().primaryKey(),
  key: platformAssetClassEnum("key").notNull().unique(),
  label: varchar("label", { length: 100 }).notNull(),
  shortLabel: varchar("short_label", { length: 30 }),
  category: assetClassCategoryEnum("category").notNull(),
  description: text("description"),
  icon: varchar("icon", { length: 50 }),  // Lucide icon name
  enabled: boolean("enabled").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),

  // Class-specific configuration
  config: jsonb("config").default(sql`'{}'`),
  // Example config for SFR: { "defaultBeds": 3, "defaultBaths": 2, "typicalCapRate": 0.06 }
  // Example config for multifamily: { "minUnits": 5, "typicalCapRate": 0.055 }
  // Example config for marina: { "slipBased": true, "fuelRevenue": true }

  // Which modules are relevant for this class
  enabledModules: jsonb("enabled_modules").default(sql`'[]'`),
  // e.g., ["crm", "salesComps", "modeling", "proForma", "rentRoll", "vdr", "dueDiligence"]

  // Default data sources for this class
  defaultDataSources: jsonb("default_data_sources").default(sql`'[]'`),
  // e.g., ["zillow_bridge", "mls_reso"]

  // COA taxonomy pack to use
  coaTaxonomyPackKey: varchar("coa_taxonomy_pack_key", { length: 50 }),

  // DD template mapping
  ddTemplateKey: varchar("dd_template_key", { length: 100 }),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  categoryIdx: index("pac_category_idx").on(table.category),
  enabledIdx: index("pac_enabled_idx").on(table.enabled),
}));

export const insertPlatformAssetClassSchema = createInsertSchema(platformAssetClasses).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertPlatformAssetClass = z.infer<typeof insertPlatformAssetClassSchema>;
export type PlatformAssetClass = typeof platformAssetClasses.$inferSelect;


/**
 * Platform Data Sources
 * Admin-managed external data provider configurations.
 * Credentials are encrypted at rest.
 */
export const platformDataSources = pgTable("platform_data_sources", {
  id: uuid("id").defaultRandom().primaryKey(),
  key: varchar("key", { length: 50 }).notNull().unique(),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  providerType: dataSourceProviderTypeEnum("provider_type").notNull(),
  authType: dataSourceAuthTypeEnum("auth_type").notNull(),
  baseUrl: varchar("base_url", { length: 500 }),
  
  // Encrypted credentials (API keys, OAuth tokens, etc.)
  credentials: jsonb("credentials").default(sql`'{}'`),
  // Stored encrypted. Example: { "apiKey": "enc:...", "clientId": "enc:...", "clientSecret": "enc:..." }

  // Rate limiting config
  rateLimits: jsonb("rate_limits").default(sql`'{}'`),
  // Example: { "requestsPerSecond": 10, "requestsPerDay": 1000, "currentUsage": 0, "resetAt": "..." }

  // Connection status
  status: dataSourceStatusEnum("status").notNull().default("disconnected"),
  statusMessage: text("status_message"),
  lastTestedAt: timestamp("last_tested_at"),
  lastSyncAt: timestamp("last_sync_at"),
  
  // Sync configuration
  syncFrequency: syncFrequencyEnum("sync_frequency").notNull().default("daily"),
  syncConfig: jsonb("sync_config").default(sql`'{}'`),
  // Example: { "batchSize": 100, "retryAttempts": 3, "timeoutMs": 30000 }

  // Which asset classes this source supports
  supportedAssetClasses: text("supported_asset_classes").array().default(sql`'{}'`),
  // e.g., ["sfr", "duplex", "triplex", "quadplex", "multifamily", "str_airbnb"]

  // Feature flags for this source
  capabilities: jsonb("capabilities").default(sql`'{}'`),
  // Example: { "propertyDetails": true, "valuations": true, "comps": true, "listings": true, "marketData": true }

  enabled: boolean("enabled").notNull().default(false),
  
  // Metrics
  totalRecordsSynced: integer("total_records_synced").default(0),
  errorCount: integer("error_count").default(0),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  statusIdx: index("pds_status_idx").on(table.status),
  enabledIdx: index("pds_enabled_idx").on(table.enabled),
}));

export const insertPlatformDataSourceSchema = createInsertSchema(platformDataSources).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  totalRecordsSynced: true,
  errorCount: true,
});
export type InsertPlatformDataSource = z.infer<typeof insertPlatformDataSourceSchema>;
export type PlatformDataSource = typeof platformDataSources.$inferSelect;


/**
 * Data Source Field Mappings
 * Maps source data fields to internal schema, per source.
 */
export const platformDataSourceMappings = pgTable("platform_data_source_mappings", {
  id: uuid("id").defaultRandom().primaryKey(),
  dataSourceId: uuid("data_source_id").notNull().references(() => platformDataSources.id, { onDelete: "cascade" }),
  sourceEntity: varchar("source_entity", { length: 100 }).notNull(),
  targetModule: varchar("target_module", { length: 50 }).notNull(), // "crm", "salesComps", "modeling"
  targetEntity: varchar("target_entity", { length: 100 }).notNull(),
  
  fieldMappings: jsonb("field_mappings").notNull(),
  // Array of { source: string, target: string, transform?: string }

  transformRules: jsonb("transform_rules").default(sql`'[]'`),
  // Post-mapping transformations

  syncDirection: varchar("sync_direction", { length: 20 }).notNull().default("read"),
  enabled: boolean("enabled").notNull().default(true),

  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  dataSourceIdx: index("pdsm_source_idx").on(table.dataSourceId),
}));

export const insertPlatformDataSourceMappingSchema = createInsertSchema(platformDataSourceMappings).omit({
  id: true,
  createdAt: true,
});
export type InsertPlatformDataSourceMapping = z.infer<typeof insertPlatformDataSourceMappingSchema>;
export type PlatformDataSourceMapping = typeof platformDataSourceMappings.$inferSelect;


/**
 * Property Data Cache
 * Normalized property data from all external sources.
 * Multi-tenant: scoped by orgId when fetched for a specific user context.
 */
export const propertyDataCache = pgTable("property_data_cache", {
  id: uuid("id").defaultRandom().primaryKey(),
  sourceId: uuid("source_id").references(() => platformDataSources.id, { onDelete: "set null" }),
  sourcePropertyId: varchar("source_property_id", { length: 200 }),
  
  // Asset classification
  assetClass: platformAssetClassEnum("asset_class"),

  // Normalized address
  addressStreet: varchar("address_street", { length: 300 }),
  addressCity: varchar("address_city", { length: 100 }),
  addressState: varchar("address_state", { length: 10 }),
  addressZip: varchar("address_zip", { length: 20 }),
  addressCounty: varchar("address_county", { length: 100 }),
  latitude: real("latitude"),
  longitude: real("longitude"),

  // Structured property data (normalized)
  propertyData: jsonb("property_data").default(sql`'{}'`),
  // { beds, baths, sqft, lotSizeSqft, yearBuilt, stories, garageSpaces,
  //   pool, units, propertyType, construction, roof, heating, cooling, ... }

  valuationData: jsonb("valuation_data").default(sql`'{}'`),
  // { estimatedValue, confidence, rentEstimate, lastSalePrice, lastSaleDate,
  //   assessedValue, taxAmount, pricePerSqft, ... }

  listingData: jsonb("listing_data").default(sql`'{}'`),
  // { status, listPrice, originalListPrice, daysOnMarket, mlsNumber,
  //   listingAgent, listingOffice, listDate, pendingDate, soldDate, ... }

  marketData: jsonb("market_data").default(sql`'{}'`),
  // { medianRent, medianSalePrice, capRateEstimate, appreciation1yr,
  //   appreciation5yr, vacancyRate, neighborhoodScore, walkScore, ... }

  // Raw payload from source (for debugging / re-processing)
  rawPayload: jsonb("raw_payload"),

  // Org scope (null = platform-wide cache, set = org-specific fetch)
  orgId: uuid("org_id"),

  // Freshness tracking
  fetchedAt: timestamp("fetched_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at"),
  
  // Deduplication
  addressHash: varchar("address_hash", { length: 64 }),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  sourceIdx: index("pdc_source_idx").on(table.sourceId),
  assetClassIdx: index("pdc_asset_class_idx").on(table.assetClass),
  addressHashIdx: index("pdc_address_hash_idx").on(table.addressHash),
  locationIdx: index("pdc_location_idx").on(table.addressState, table.addressCity, table.addressZip),
  orgIdx: index("pdc_org_idx").on(table.orgId),
  expiresIdx: index("pdc_expires_idx").on(table.expiresAt),
}));

export const insertPropertyDataCacheSchema = createInsertSchema(propertyDataCache).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertPropertyDataCache = z.infer<typeof insertPropertyDataCacheSchema>;
export type PropertyDataCache = typeof propertyDataCache.$inferSelect;


/**
 * Data Source Sync Logs
 * Audit trail for every sync operation.
 */
export const dataSourceSyncLogs = pgTable("data_source_sync_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  dataSourceId: uuid("data_source_id").notNull().references(() => platformDataSources.id, { onDelete: "cascade" }),
  
  status: syncLogStatusEnum("status").notNull(),
  startedAt: timestamp("started_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
  
  recordsFetched: integer("records_fetched").default(0),
  recordsCreated: integer("records_created").default(0),
  recordsUpdated: integer("records_updated").default(0),
  recordsFailed: integer("records_failed").default(0),
  
  errorMessage: text("error_message"),
  errorDetails: jsonb("error_details"),
  
  // Trigger info
  triggeredBy: varchar("triggered_by", { length: 50 }), // "cron", "manual", "on-demand"
  triggeredByUserId: uuid("triggered_by_user_id"),
  
  // Sync parameters used
  syncParams: jsonb("sync_params").default(sql`'{}'`),
  // e.g., { "assetClasses": ["sfr","duplex"], "region": "FL", "since": "2025-01-01" }

  durationMs: integer("duration_ms"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  dataSourceIdx: index("dssl_source_idx").on(table.dataSourceId),
  statusIdx: index("dssl_status_idx").on(table.status),
  startedIdx: index("dssl_started_idx").on(table.startedAt),
}));

export const insertDataSourceSyncLogSchema = createInsertSchema(dataSourceSyncLogs).omit({
  id: true,
  createdAt: true,
});
export type InsertDataSourceSyncLog = z.infer<typeof insertDataSourceSyncLogSchema>;
export type DataSourceSyncLog = typeof dataSourceSyncLogs.$inferSelect;
