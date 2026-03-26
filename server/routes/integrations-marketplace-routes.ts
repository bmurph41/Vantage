/**
 * Integrations Marketplace Routes
 *
 * User-facing integration management: discover, connect, configure,
 * test, sync, and monitor integrations.
 */

import { Router, Request, Response } from "express";
import { db } from "../db";
import {
  integrationConnections,
  integrationSyncLogs,
  userIntegrations,
} from "@shared/schema";
import { eq, and, desc, sql, count } from "drizzle-orm";

export const integrationsMarketplaceRouter = Router();

// ── Discovery ────────────────────────────────────────────────────────────

// GET /catalog — list all available integrations with connection status
integrationsMarketplaceRouter.get("/catalog", async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user.orgId;
    const { category } = req.query;

    // Get registry
    const { INTEGRATION_REGISTRY } = await import("../integrations/registry");

    // Get existing connections for this org
    const connections = await db
      .select()
      .from(integrationConnections)
      .where(eq(integrationConnections.orgId, orgId));

    const connectionMap = new Map(connections.map((c) => [c.integrationKey, c]));

    let catalog = Object.values(INTEGRATION_REGISTRY).map((integration: any) => {
      const connection = connectionMap.get(integration.key);
      return {
        key: integration.key,
        name: integration.name,
        description: integration.description || "",
        category: integration.category || "other",
        authType: integration.authType || "apiKey",
        logoUrl: integration.logoUrl || null,
        website: integration.website || null,
        features: integration.features || [],
        // Connection status
        isConnected: !!connection?.isEnabled,
        connectionId: connection?.id || null,
        lastSyncAt: connection?.lastSyncAt || null,
        lastSyncStatus: connection?.lastSyncStatus || null,
        autoSyncEnabled: connection?.autoSyncEnabled || false,
        syncFrequencyMinutes: connection?.syncFrequencyMinutes || 60,
      };
    });

    if (category) {
      catalog = catalog.filter((i) => i.category === category);
    }

    // Group by category
    const categories = [...new Set(catalog.map((i) => i.category))].sort();

    res.json({
      total: catalog.length,
      connected: catalog.filter((i) => i.isConnected).length,
      categories,
      integrations: catalog,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /catalog/:key — get single integration details
integrationsMarketplaceRouter.get("/catalog/:key", async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user.orgId;
    const { key } = req.params;

    const { INTEGRATION_REGISTRY } = await import("../integrations/registry");
    const integration = (INTEGRATION_REGISTRY as any)[key];

    if (!integration) return res.status(404).json({ error: "Integration not found" });

    const [connection] = await db
      .select()
      .from(integrationConnections)
      .where(
        and(eq(integrationConnections.orgId, orgId), eq(integrationConnections.integrationKey, key)),
      );

    // Get sync history
    const syncHistory = connection
      ? await db
          .select()
          .from(integrationSyncLogs)
          .where(eq(integrationSyncLogs.connectionId, connection.id))
          .orderBy(desc(integrationSyncLogs.startedAt))
          .limit(10)
      : [];

    res.json({
      ...integration,
      connection: connection || null,
      syncHistory,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ── Connection Management ────────────────────────────────────────────────

// POST /connect — create or update a connection
integrationsMarketplaceRouter.post("/connect", async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user.orgId;
    const {
      integrationKey,
      displayName,
      credentials,
      settings,
      syncFrequencyMinutes = 60,
      autoSyncEnabled = false,
    } = req.body;

    if (!integrationKey) {
      return res.status(400).json({ error: "integrationKey is required" });
    }

    // Check if connection already exists
    const [existing] = await db
      .select()
      .from(integrationConnections)
      .where(
        and(
          eq(integrationConnections.orgId, orgId),
          eq(integrationConnections.integrationKey, integrationKey),
        ),
      );

    if (existing) {
      const [updated] = await db
        .update(integrationConnections)
        .set({
          displayName,
          credentials,
          settings,
          syncFrequencyMinutes,
          autoSyncEnabled,
          isEnabled: true,
          updatedAt: new Date(),
        })
        .where(eq(integrationConnections.id, existing.id))
        .returning();
      return res.json(updated);
    }

    const [created] = await db
      .insert(integrationConnections)
      .values({
        orgId,
        integrationKey,
        displayName: displayName || integrationKey,
        credentials,
        settings,
        syncFrequencyMinutes,
        autoSyncEnabled,
        isEnabled: true,
      })
      .returning();

    res.status(201).json(created);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /test/:connectionId — test a connection
integrationsMarketplaceRouter.post("/test/:connectionId", async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user.orgId;

    const [connection] = await db
      .select()
      .from(integrationConnections)
      .where(
        and(
          eq(integrationConnections.id, req.params.connectionId),
          eq(integrationConnections.orgId, orgId),
        ),
      );

    if (!connection) return res.status(404).json({ error: "Connection not found" });

    try {
      const { ConnectorFactory } = await import("../integrations/connectors/base");

      if (!ConnectorFactory.isRegistered(connection.integrationKey)) {
        return res.json({
          connected: false,
          message: `Connector "${connection.integrationKey}" not implemented yet`,
        });
      }

      const connector = ConnectorFactory.create({
        integrationKey: connection.integrationKey,
        credentials: (connection.credentials as any) || {},
        settings: (connection.settings as any) || {},
        userId: (req as any).user.id,
        orgId,
      });

      const result = await connector.testConnection();

      // Update connection status
      await db
        .update(integrationConnections)
        .set({
          isEnabled: result.connected,
          lastSyncStatus: result.connected ? "completed" : "failed",
          lastSyncMessage: result.message,
          updatedAt: new Date(),
        })
        .where(eq(integrationConnections.id, connection.id));

      res.json(result);
    } catch (testError: any) {
      res.json({ connected: false, message: testError.message });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /sync/:connectionId — trigger manual sync
integrationsMarketplaceRouter.post("/sync/:connectionId", async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user.orgId;

    const [connection] = await db
      .select()
      .from(integrationConnections)
      .where(
        and(
          eq(integrationConnections.id, req.params.connectionId),
          eq(integrationConnections.orgId, orgId),
        ),
      );

    if (!connection) return res.status(404).json({ error: "Connection not found" });

    await db
      .update(integrationConnections)
      .set({ lastSyncStatus: "in_progress", updatedAt: new Date() })
      .where(eq(integrationConnections.id, connection.id));

    try {
      const { ConnectorFactory } = await import("../integrations/connectors/base");

      if (!ConnectorFactory.isRegistered(connection.integrationKey)) {
        await db
          .update(integrationConnections)
          .set({ lastSyncStatus: "failed", lastSyncMessage: "Connector not implemented" })
          .where(eq(integrationConnections.id, connection.id));
        return res.json({ success: false, message: "Connector not implemented" });
      }

      const connector = ConnectorFactory.create({
        integrationKey: connection.integrationKey,
        credentials: (connection.credentials as any) || {},
        settings: (connection.settings as any) || {},
        userId: (req as any).user.id,
        orgId,
      });

      const results = await connector.syncAll();
      const totalRecords = Array.from(results.values()).reduce(
        (sum, r) => sum + r.recordsProcessed, 0,
      );

      await db
        .update(integrationConnections)
        .set({
          lastSyncAt: new Date(),
          lastSyncStatus: "completed",
          lastSyncMessage: `Synced ${totalRecords} records`,
          recordsSyncedTotal: sql`coalesce(${integrationConnections.recordsSyncedTotal}, 0) + ${totalRecords}`,
          updatedAt: new Date(),
        })
        .where(eq(integrationConnections.id, connection.id));

      // Log sync
      const entityResults = Array.from(results.entries()).map(([entity, result]) => ({
        entity,
        ...result,
      }));

      res.json({ success: true, totalRecords, entities: entityResults });
    } catch (syncError: any) {
      await db
        .update(integrationConnections)
        .set({
          lastSyncStatus: "failed",
          lastSyncMessage: syncError.message,
          updatedAt: new Date(),
        })
        .where(eq(integrationConnections.id, connection.id));

      res.json({ success: false, error: syncError.message });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// PATCH /connections/:connectionId — update connection settings
integrationsMarketplaceRouter.patch("/connections/:connectionId", async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user.orgId;
    const { syncFrequencyMinutes, autoSyncEnabled, displayName, settings } = req.body;

    const updateData: Record<string, any> = { updatedAt: new Date() };
    if (syncFrequencyMinutes !== undefined) updateData.syncFrequencyMinutes = syncFrequencyMinutes;
    if (autoSyncEnabled !== undefined) updateData.autoSyncEnabled = autoSyncEnabled;
    if (displayName) updateData.displayName = displayName;
    if (settings) updateData.settings = settings;

    const [updated] = await db
      .update(integrationConnections)
      .set(updateData)
      .where(
        and(
          eq(integrationConnections.id, req.params.connectionId),
          eq(integrationConnections.orgId, orgId),
        ),
      )
      .returning();

    if (!updated) return res.status(404).json({ error: "Connection not found" });
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /connections/:connectionId — disconnect
integrationsMarketplaceRouter.delete("/connections/:connectionId", async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user.orgId;

    const [updated] = await db
      .update(integrationConnections)
      .set({ isEnabled: false, updatedAt: new Date() })
      .where(
        and(
          eq(integrationConnections.id, req.params.connectionId),
          eq(integrationConnections.orgId, orgId),
        ),
      )
      .returning();

    if (!updated) return res.status(404).json({ error: "Connection not found" });
    res.json({ disconnected: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /connections — list all active connections for org
integrationsMarketplaceRouter.get("/connections", async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user.orgId;

    const connections = await db
      .select()
      .from(integrationConnections)
      .where(eq(integrationConnections.orgId, orgId))
      .orderBy(desc(integrationConnections.updatedAt));

    res.json(connections);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /sync-history/:connectionId — sync log for a connection
integrationsMarketplaceRouter.get("/sync-history/:connectionId", async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user.orgId;

    const logs = await db
      .select()
      .from(integrationSyncLogs)
      .where(
        and(
          eq(integrationSyncLogs.connectionId, req.params.connectionId),
          eq(integrationSyncLogs.orgId, orgId),
        ),
      )
      .orderBy(desc(integrationSyncLogs.startedAt))
      .limit(50);

    res.json(logs);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});
