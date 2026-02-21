/**
 * Property Data Service — Core Orchestrator
 *
 * Coordinates across all data adapters (Zillow, Redfin/ATTOM, MLS),
 * handles caching, deduplication, rate limiting, and normalization.
 *
 * Add to: server/services/property-data-service.ts
 */

import { db } from "../db";
import {
  platformDataSources,
  propertyDataCache,
  dataSourceSyncLogs,
} from "@shared/schema";
import { eq, and, sql, gte, lte, or, desc } from "drizzle-orm";
import crypto from "crypto";

import type {
  IPropertyDataAdapter,
  PropertySearchCriteria,
  PropertyDataPayload,
  AdapterSearchResult,
  NormalizedAddress,
  ValuationData,
  CompsSearchCriteria,
  MarketData,
} from "./data-adapters/types";
import { ZillowBridgeAdapter } from "./data-adapters/zillow-adapter";
import { RedfinAdapter } from "./data-adapters/redfin-adapter";
import { MlsResoAdapter } from "./data-adapters/mls-reso-adapter";

// =============================================
// Adapter Factory
// =============================================

const ADAPTERS: Record<string, IPropertyDataAdapter> = {
  zillow_bridge: new ZillowBridgeAdapter(),
  redfin: new RedfinAdapter(),
  mls_reso: new MlsResoAdapter(),
};

function getAdapter(key: string): IPropertyDataAdapter | null {
  return ADAPTERS[key] || null;
}

// =============================================
// Credential Decryption
// =============================================

const ENCRYPTION_KEY = process.env.INTEGRATION_ENCRYPTION_KEY || "default-dev-key-change-in-production-32ch";

function decryptCredentials(encrypted: Record<string, string>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(encrypted)) {
    if (typeof value === "string" && value.startsWith("enc:")) {
      try {
        const parts = value.slice(4).split(":");
        const iv = Buffer.from(parts[0], "hex");
        const data = Buffer.from(parts[1], "hex");
        const decipher = crypto.createDecipheriv(
          "aes-256-cbc",
          crypto.createHash("sha256").update(ENCRYPTION_KEY).digest(),
          iv
        );
        result[key] = decipher.update(data) + decipher.final("utf8");
      } catch {
        result[key] = value;
      }
    } else {
      result[key] = value;
    }
  }
  return result;
}

function encryptValue(plaintext: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(
    "aes-256-cbc",
    crypto.createHash("sha256").update(ENCRYPTION_KEY).digest(),
    iv
  );
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return `enc:${iv.toString("hex")}:${encrypted.toString("hex")}`;
}

// =============================================
// Address Hashing (for deduplication)
// =============================================

function hashAddress(address: NormalizedAddress): string {
  const normalized = [
    address.street.toLowerCase().replace(/[^a-z0-9]/g, ""),
    address.city.toLowerCase().replace(/[^a-z0-9]/g, ""),
    address.state.toLowerCase(),
    address.zip.replace(/[^0-9]/g, "").slice(0, 5),
  ].join("|");
  return crypto.createHash("sha256").update(normalized).digest("hex");
}

// =============================================
// Service Class
// =============================================

export class PropertyDataService {
  /**
   * Get all enabled data sources with their connection status
   */
  async getDataSources() {
    return db.select().from(platformDataSources).orderBy(platformDataSources.name);
  }

  /**
   * Get a single data source by ID
   */
  async getDataSource(id: string) {
    const [source] = await db
      .select()
      .from(platformDataSources)
      .where(eq(platformDataSources.id, id));
    return source || null;
  }

  /**
   * Create or update a data source configuration
   */
  async upsertDataSource(data: {
    key: string;
    name: string;
    description?: string;
    providerType: string;
    authType: string;
    baseUrl?: string;
    credentials?: Record<string, string>;
    syncFrequency?: string;
    supportedAssetClasses?: string[];
    enabled?: boolean;
    rateLimits?: Record<string, any>;
    capabilities?: Record<string, boolean>;
  }) {
    // Encrypt sensitive credential fields
    const encryptedCreds: Record<string, string> = {};
    if (data.credentials) {
      for (const [key, value] of Object.entries(data.credentials)) {
        if (key.toLowerCase().includes("key") || key.toLowerCase().includes("secret") || key.toLowerCase().includes("password")) {
          encryptedCreds[key] = encryptValue(value);
        } else {
          encryptedCreds[key] = value;
        }
      }
    }

    const existing = await db
      .select()
      .from(platformDataSources)
      .where(eq(platformDataSources.key, data.key));

    if (existing.length > 0) {
      const [updated] = await db
        .update(platformDataSources)
        .set({
          name: data.name,
          description: data.description,
          baseUrl: data.baseUrl,
          credentials: encryptedCreds,
          syncFrequency: data.syncFrequency as any,
          supportedAssetClasses: data.supportedAssetClasses,
          enabled: data.enabled,
          rateLimits: data.rateLimits,
          capabilities: data.capabilities,
          updatedAt: new Date(),
        })
        .where(eq(platformDataSources.key, data.key))
        .returning();
      return updated;
    }

    const [created] = await db
      .insert(platformDataSources)
      .values({
        key: data.key,
        name: data.name,
        description: data.description,
        providerType: data.providerType as any,
        authType: data.authType as any,
        baseUrl: data.baseUrl,
        credentials: encryptedCreds,
        syncFrequency: (data.syncFrequency || "daily") as any,
        supportedAssetClasses: data.supportedAssetClasses || [],
        enabled: data.enabled ?? false,
        rateLimits: data.rateLimits || {},
        capabilities: data.capabilities || {},
      })
      .returning();
    return created;
  }

  /**
   * Test connection for a data source
   */
  async testConnection(sourceId: string): Promise<{ ok: boolean; error?: string }> {
    const source = await this.getDataSource(sourceId);
    if (!source) return { ok: false, error: "Data source not found" };

    const adapter = getAdapter(source.key);
    if (!adapter) return { ok: false, error: `No adapter found for ${source.key}` };

    const creds = decryptCredentials((source.credentials as Record<string, string>) || {});
    const result = await adapter.testConnection(creds);

    // Update status
    await db
      .update(platformDataSources)
      .set({
        status: result.ok ? "connected" : "error",
        statusMessage: result.error || null,
        lastTestedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(platformDataSources.id, sourceId));

    return result;
  }

  /**
   * Search properties across all enabled sources
   */
  async searchProperties(criteria: PropertySearchCriteria): Promise<AdapterSearchResult> {
    // First check cache
    const cached = await this.searchCache(criteria);
    if (cached.length > 0) {
      return { total: cached.length, results: cached, hasMore: false };
    }

    // Fetch from enabled sources
    const sources = await db
      .select()
      .from(platformDataSources)
      .where(
        and(
          eq(platformDataSources.enabled, true),
          eq(platformDataSources.status, "connected")
        )
      );

    const allResults: PropertyDataPayload[] = [];

    for (const source of sources) {
      const adapter = getAdapter(source.key);
      if (!adapter) continue;

      // Filter by supported asset classes
      if (criteria.assetClasses?.length) {
        const supported = (source.supportedAssetClasses || []) as string[];
        const hasOverlap = criteria.assetClasses.some((ac) => supported.includes(ac));
        if (!hasOverlap) continue;
      }

      try {
        const creds = decryptCredentials((source.credentials as Record<string, string>) || {});
        const result = await adapter.searchProperties(criteria, creds);
        allResults.push(...result.results);
      } catch (err: any) {
        console.error(`[PropertyData] Error searching ${source.key}:`, err.message);
      }
    }

    // Deduplicate by address hash
    const deduped = this.deduplicateResults(allResults);

    // Cache results
    await this.cacheResults(deduped);

    return {
      total: deduped.length,
      results: deduped,
      hasMore: false,
    };
  }

  /**
   * Get valuation data for a property address.
   * Tries each enabled source that supports valuations.
   */
  async getValuation(address: NormalizedAddress): Promise<ValuationData | null> {
    const sources = await db
      .select()
      .from(platformDataSources)
      .where(
        and(
          eq(platformDataSources.enabled, true),
          eq(platformDataSources.status, "connected")
        )
      );

    for (const source of sources) {
      const caps = (source.capabilities as Record<string, boolean>) || {};
      if (!caps.valuations) continue;

      const adapter = getAdapter(source.key);
      if (!adapter) continue;

      try {
        const creds = decryptCredentials((source.credentials as Record<string, string>) || {});
        const valuation = await adapter.getValuation(address, creds);
        if (valuation) return valuation;
      } catch (err: any) {
        console.error(`[PropertyData] Valuation error from ${source.key}:`, err.message);
      }
    }

    return null;
  }

  /**
   * Get comparable sales near a location
   */
  async getComps(criteria: CompsSearchCriteria): Promise<PropertyDataPayload[]> {
    const sources = await db
      .select()
      .from(platformDataSources)
      .where(
        and(
          eq(platformDataSources.enabled, true),
          eq(platformDataSources.status, "connected")
        )
      );

    const allComps: PropertyDataPayload[] = [];

    for (const source of sources) {
      const caps = (source.capabilities as Record<string, boolean>) || {};
      if (!caps.comps) continue;

      const adapter = getAdapter(source.key);
      if (!adapter) continue;

      try {
        const creds = decryptCredentials((source.credentials as Record<string, string>) || {});
        const comps = await adapter.getComps(criteria, creds);
        allComps.push(...comps);
      } catch (err: any) {
        console.error(`[PropertyData] Comps error from ${source.key}:`, err.message);
      }
    }

    return this.deduplicateResults(allComps);
  }

  /**
   * Get market data for a zip code
   */
  async getMarketData(zip: string): Promise<MarketData | null> {
    const sources = await db
      .select()
      .from(platformDataSources)
      .where(
        and(
          eq(platformDataSources.enabled, true),
          eq(platformDataSources.status, "connected")
        )
      );

    const combined: MarketData = {};

    for (const source of sources) {
      const caps = (source.capabilities as Record<string, boolean>) || {};
      if (!caps.marketData) continue;

      const adapter = getAdapter(source.key);
      if (!adapter) continue;

      try {
        const creds = decryptCredentials((source.credentials as Record<string, string>) || {});
        const data = await adapter.getMarketData(zip, creds);
        if (data) {
          Object.assign(combined, data);
        }
      } catch (err: any) {
        console.error(`[PropertyData] Market data error from ${source.key}:`, err.message);
      }
    }

    return Object.keys(combined).length > 0 ? combined : null;
  }

  /**
   * Run a full sync for a specific data source.
   * Called by cron or manual trigger.
   */
  async syncDataSource(sourceId: string, triggeredBy: "cron" | "manual" = "manual", userId?: string) {
    const source = await this.getDataSource(sourceId);
    if (!source || !source.enabled) return;

    const adapter = getAdapter(source.key);
    if (!adapter) return;

    // Create sync log entry
    const [syncLog] = await db
      .insert(dataSourceSyncLogs)
      .values({
        dataSourceId: sourceId,
        status: "started",
        triggeredBy,
        triggeredByUserId: userId,
        syncParams: { assetClasses: source.supportedAssetClasses },
      })
      .returning();

    const startTime = Date.now();

    try {
      // Update source status
      await db
        .update(platformDataSources)
        .set({ status: "syncing", updatedAt: new Date() })
        .where(eq(platformDataSources.id, sourceId));

      const creds = decryptCredentials((source.credentials as Record<string, string>) || {});
      let totalFetched = 0;
      let totalCreated = 0;
      let totalUpdated = 0;
      let offset = 0;
      const batchSize = 100;

      // Paginate through all results
      let hasMore = true;
      while (hasMore) {
        const result = await adapter.searchProperties(
          { limit: batchSize, offset },
          creds
        );

        for (const property of result.results) {
          const { created, updated } = await this.cacheProperty(property, source.id);
          if (created) totalCreated++;
          if (updated) totalUpdated++;
        }

        totalFetched += result.results.length;
        hasMore = result.hasMore && totalFetched < 10000; // Safety cap
        offset = result.nextOffset || offset + batchSize;
      }

      // Update sync log
      await db
        .update(dataSourceSyncLogs)
        .set({
          status: "completed",
          completedAt: new Date(),
          recordsFetched: totalFetched,
          recordsCreated: totalCreated,
          recordsUpdated: totalUpdated,
          durationMs: Date.now() - startTime,
        })
        .where(eq(dataSourceSyncLogs.id, syncLog.id));

      // Update source stats
      await db
        .update(platformDataSources)
        .set({
          status: "connected",
          lastSyncAt: new Date(),
          totalRecordsSynced: sql`${platformDataSources.totalRecordsSynced} + ${totalFetched}`,
          updatedAt: new Date(),
        })
        .where(eq(platformDataSources.id, sourceId));

      console.log(`[PropertyData] Sync completed for ${source.key}: ${totalFetched} fetched, ${totalCreated} created, ${totalUpdated} updated`);
    } catch (err: any) {
      console.error(`[PropertyData] Sync failed for ${source.key}:`, err.message);

      await db
        .update(dataSourceSyncLogs)
        .set({
          status: "failed",
          completedAt: new Date(),
          errorMessage: err.message,
          durationMs: Date.now() - startTime,
        })
        .where(eq(dataSourceSyncLogs.id, syncLog.id));

      await db
        .update(platformDataSources)
        .set({
          status: "error",
          statusMessage: err.message,
          errorCount: sql`${platformDataSources.errorCount} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(platformDataSources.id, sourceId));
    }
  }

  /**
   * Get sync history for a data source
   */
  async getSyncLogs(sourceId: string, limit = 20) {
    return db
      .select()
      .from(dataSourceSyncLogs)
      .where(eq(dataSourceSyncLogs.dataSourceId, sourceId))
      .orderBy(desc(dataSourceSyncLogs.startedAt))
      .limit(limit);
  }

  // =============================================
  // Private Helpers
  // =============================================

  private async searchCache(criteria: PropertySearchCriteria): Promise<PropertyDataPayload[]> {
    // Simple cache lookup by location
    const conditions = [];
    if (criteria.zip) conditions.push(eq(propertyDataCache.addressZip, criteria.zip));
    if (criteria.city) conditions.push(eq(propertyDataCache.addressCity, criteria.city));
    if (criteria.state) conditions.push(eq(propertyDataCache.addressState, criteria.state));

    if (conditions.length === 0) return [];

    // Only return non-expired cache entries
    conditions.push(gte(propertyDataCache.expiresAt, new Date()));

    const cached = await db
      .select()
      .from(propertyDataCache)
      .where(and(...conditions))
      .limit(criteria.limit || 50);

    return cached.map((row) => ({
      address: {
        street: row.addressStreet || "",
        city: row.addressCity || "",
        state: row.addressState || "",
        zip: row.addressZip || "",
        county: row.addressCounty || undefined,
        latitude: row.latitude || undefined,
        longitude: row.longitude || undefined,
      },
      characteristics: (row.propertyData as any) || {},
      valuation: (row.valuationData as any) || {},
      listing: (row.listingData as any) || {},
      market: (row.marketData as any) || {},
      metadata: {
        sourceKey: "cache",
        sourcePropertyId: row.sourcePropertyId || row.id,
        fetchedAt: row.fetchedAt?.toISOString() || "",
        confidence: 0.8,
      },
    }));
  }

  private async cacheResults(results: PropertyDataPayload[]) {
    for (const property of results) {
      await this.cacheProperty(property);
    }
  }

  private async cacheProperty(
    property: PropertyDataPayload,
    sourceId?: string
  ): Promise<{ created: boolean; updated: boolean }> {
    const addrHash = hashAddress(property.address);

    // Check if exists
    const existing = await db
      .select({ id: propertyDataCache.id })
      .from(propertyDataCache)
      .where(eq(propertyDataCache.addressHash, addrHash))
      .limit(1);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7-day default TTL

    if (existing.length > 0) {
      await db
        .update(propertyDataCache)
        .set({
          propertyData: property.characteristics,
          valuationData: property.valuation,
          listingData: property.listing,
          marketData: property.market,
          rawPayload: property.metadata.rawPayload,
          fetchedAt: new Date(),
          expiresAt,
          updatedAt: new Date(),
        })
        .where(eq(propertyDataCache.id, existing[0].id));
      return { created: false, updated: true };
    }

    await db.insert(propertyDataCache).values({
      sourceId: sourceId || undefined,
      sourcePropertyId: property.metadata.sourcePropertyId,
      assetClass: null, // Classified later or by user
      addressStreet: property.address.street,
      addressCity: property.address.city,
      addressState: property.address.state,
      addressZip: property.address.zip,
      addressCounty: property.address.county,
      latitude: property.address.latitude,
      longitude: property.address.longitude,
      propertyData: property.characteristics,
      valuationData: property.valuation,
      listingData: property.listing,
      marketData: property.market,
      rawPayload: property.metadata.rawPayload,
      addressHash: addrHash,
      fetchedAt: new Date(),
      expiresAt,
    });

    return { created: true, updated: false };
  }

  private deduplicateResults(results: PropertyDataPayload[]): PropertyDataPayload[] {
    const seen = new Map<string, PropertyDataPayload>();

    for (const result of results) {
      const hash = hashAddress(result.address);
      const existing = seen.get(hash);

      if (!existing || result.metadata.confidence > existing.metadata.confidence) {
        seen.set(hash, result);
      }
    }

    return Array.from(seen.values());
  }
}

export const propertyDataService = new PropertyDataService();
