/**
 * Property Data API Routes
 *
 * Admin endpoints (require admin role):
 *   GET    /api/admin/data-sources           — List all data sources
 *   POST   /api/admin/data-sources           — Create/update data source
 *   POST   /api/admin/data-sources/:id/test  — Test connection
 *   POST   /api/admin/data-sources/:id/sync  — Trigger manual sync
 *   GET    /api/admin/data-sources/:id/logs  — Sync history
 *   DELETE /api/admin/data-sources/:id       — Delete data source
 *
 * User-facing endpoints:
 *   GET    /api/property-data/search         — Search across all sources
 *   GET    /api/property-data/valuation      — Get valuation for address
 *   GET    /api/property-data/comps          — Get comparables
 *   GET    /api/property-data/market/:zip    — Get market metrics
 *   GET    /api/property-data/adapters       — List available adapters
 *
 * Add to server/routes.ts:
 *   import { propertyDataRouter } from './routes/property-data-routes';
 *   app.use(authenticateUser, propertyDataRouter);
 */

import { Router } from "express";
import { db } from "../db";
import { platformDataSources } from "@shared/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { propertyDataService } from "../services/property-data-service";
import { DATA_SOURCE_ADAPTER_REGISTRY } from "../services/data-adapters/types";

export const propertyDataRouter = Router();

// =============================================
// Helpers
// =============================================

function getUserId(req: any): string | null {
  return req.validatedUserId || req.user?.id || null;
}

function isAdmin(req: any): boolean {
  return req.user?.role === "admin" || req.user?.role === "owner" || req.user?.isAdmin === true;
}

function requireAdmin(req: any, res: any): boolean {
  if (!isAdmin(req)) {
    res.status(403).json({ error: "Admin access required" });
    return false;
  }
  return true;
}

// =============================================
// Admin: Data Sources
// =============================================

propertyDataRouter.get("/api/admin/data-sources", async (req: any, res) => {
  if (!requireAdmin(req, res)) return;

  try {
    const sources = await propertyDataService.getDataSources();

    // Strip encrypted credentials from response
    const sanitized = sources.map((s) => ({
      ...s,
      credentials: undefined,
      hasCredentials: Object.keys((s.credentials as Record<string, string>) || {}).length > 0,
    }));

    res.json({ sources: sanitized });
  } catch (error: any) {
    console.error("Error fetching data sources:", error);
    res.status(500).json({ error: "Failed to fetch data sources" });
  }
});

const upsertDataSourceSchema = z.object({
  key: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  providerType: z.enum(["api", "feed", "aggregator", "scraper"]),
  authType: z.enum(["api_key", "oauth2", "basic", "rets", "none"]),
  baseUrl: z.string().optional(),
  credentials: z.record(z.string()).optional(),
  syncFrequency: z.enum(["realtime", "hourly", "daily", "weekly", "monthly", "manual"]).optional(),
  supportedAssetClasses: z.array(z.string()).optional(),
  enabled: z.boolean().optional(),
  rateLimits: z.record(z.any()).optional(),
  capabilities: z.record(z.boolean()).optional(),
});

propertyDataRouter.post("/api/admin/data-sources", async (req: any, res) => {
  if (!requireAdmin(req, res)) return;

  try {
    const data = upsertDataSourceSchema.parse(req.body);
    const source = await propertyDataService.upsertDataSource(data);

    res.json({
      source: {
        ...source,
        credentials: undefined,
        hasCredentials: true,
      },
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    console.error("Error upserting data source:", error);
    res.status(500).json({ error: "Failed to save data source" });
  }
});

propertyDataRouter.post("/api/admin/data-sources/:id/test", async (req: any, res) => {
  if (!requireAdmin(req, res)) return;

  try {
    const result = await propertyDataService.testConnection(req.params.id);
    res.json(result);
  } catch (error: any) {
    console.error("Error testing connection:", error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

propertyDataRouter.post("/api/admin/data-sources/:id/sync", async (req: any, res) => {
  if (!requireAdmin(req, res)) return;

  try {
    const userId = getUserId(req);
    // Start sync in background
    propertyDataService
      .syncDataSource(req.params.id, "manual", userId || undefined)
      .catch((err) => console.error("[PropertyData] Background sync error:", err));

    res.json({ message: "Sync started", status: "syncing" });
  } catch (error: any) {
    console.error("Error triggering sync:", error);
    res.status(500).json({ error: "Failed to start sync" });
  }
});

propertyDataRouter.get("/api/admin/data-sources/:id/logs", async (req: any, res) => {
  if (!requireAdmin(req, res)) return;

  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const logs = await propertyDataService.getSyncLogs(req.params.id, limit);
    res.json({ logs });
  } catch (error: any) {
    console.error("Error fetching sync logs:", error);
    res.status(500).json({ error: "Failed to fetch sync logs" });
  }
});

propertyDataRouter.delete("/api/admin/data-sources/:id", async (req: any, res) => {
  if (!requireAdmin(req, res)) return;

  try {
    await db
      .delete(platformDataSources)
      .where(eq(platformDataSources.id, req.params.id));
    res.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting data source:", error);
    res.status(500).json({ error: "Failed to delete data source" });
  }
});

// =============================================
// User-Facing: Property Data
// =============================================

const searchSchema = z.object({
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zip: z.string().optional(),
  assetClasses: z.string().optional(), // comma-separated
  minPrice: z.coerce.number().optional(),
  maxPrice: z.coerce.number().optional(),
  minBeds: z.coerce.number().optional(),
  maxBeds: z.coerce.number().optional(),
  minSqft: z.coerce.number().optional(),
  maxSqft: z.coerce.number().optional(),
  limit: z.coerce.number().optional(),
  offset: z.coerce.number().optional(),
});

propertyDataRouter.get("/api/property-data/search", async (req: any, res) => {
  try {
    const params = searchSchema.parse(req.query);
    const criteria = {
      ...params,
      assetClasses: params.assetClasses?.split(",").filter(Boolean),
    };

    const results = await propertyDataService.searchProperties(criteria);
    res.json(results);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid search parameters", details: error.errors });
    }
    console.error("Error searching properties:", error);
    res.status(500).json({ error: "Search failed" });
  }
});

propertyDataRouter.get("/api/property-data/valuation", async (req: any, res) => {
  try {
    const { street, city, state, zip } = req.query;
    if (!street || !city || !state || !zip) {
      return res.status(400).json({ error: "street, city, state, and zip are required" });
    }

    const valuation = await propertyDataService.getValuation({
      street: street as string,
      city: city as string,
      state: state as string,
      zip: zip as string,
    });

    res.json({ valuation });
  } catch (error: any) {
    console.error("Error fetching valuation:", error);
    res.status(500).json({ error: "Valuation lookup failed" });
  }
});

propertyDataRouter.get("/api/property-data/comps", async (req: any, res) => {
  try {
    const { latitude, longitude, radiusMiles, assetClass, limit } = req.query;
    if (!latitude || !longitude) {
      return res.status(400).json({ error: "latitude and longitude are required" });
    }

    const comps = await propertyDataService.getComps({
      latitude: parseFloat(latitude as string),
      longitude: parseFloat(longitude as string),
      radiusMiles: radiusMiles ? parseFloat(radiusMiles as string) : 1,
      assetClass: assetClass as string,
      limit: limit ? parseInt(limit as string) : 10,
    });

    res.json({ comps });
  } catch (error: any) {
    console.error("Error fetching comps:", error);
    res.status(500).json({ error: "Comps lookup failed" });
  }
});

propertyDataRouter.get("/api/property-data/market/:zip", async (req: any, res) => {
  try {
    const marketData = await propertyDataService.getMarketData(req.params.zip);
    res.json({ marketData });
  } catch (error: any) {
    console.error("Error fetching market data:", error);
    res.status(500).json({ error: "Market data lookup failed" });
  }
});

propertyDataRouter.get("/api/property-data/adapters", async (_req: any, res) => {
  res.json({ adapters: DATA_SOURCE_ADAPTER_REGISTRY });
});
