/**
 * Integrations Sync Routes
 *
 * API endpoints for the SyncMonitor frontend page:
 * - GET /api/integrations/sync-status  — real status of all connected adapters for the org
 * - GET /api/integrations/sync-history — recent sync job log for the org
 * - POST /api/integrations/:id/sync    — trigger a sync for a specific integration connection
 */

import { Router } from "express";
import { db } from "../db";
import { integrationConnections, integrationSyncLogs } from "@shared/schema";
import { eq, and, desc, sql, inArray, ne } from "drizzle-orm";
import type { ConnectorCredentials } from "../integrations/connectors/base";

export const integrationsSyncRouter = Router();

function mapSyncStatus(status: string | null): "connected" | "syncing" | "error" | "disconnected" | "pending" {
  if (!status) return "pending";
  switch (status) {
    case "completed": return "connected";
    case "in_progress": return "syncing";
    case "failed": return "error";
    case "partial": return "connected";
    default: return "pending";
  }
}

function inferType(integrationKey: string): "marina_management" | "accounting" | "crm" | "data" {
  const key = integrationKey.toLowerCase();
  if (key.includes("quickbooks") || key.includes("xero") || key.includes("sage") || key.includes("accounting")) {
    return "accounting";
  }
  if (key.includes("hubspot") || key.includes("salesforce") || key.includes("crm")) {
    return "crm";
  }
  if (
    key.includes("dockwa") ||
    key.includes("dockmaster") ||
    key.includes("storable") ||
    key.includes("marina") ||
    key.includes("dockit") ||
    key.includes("nautical")
  ) {
    return "marina_management";
  }
  return "data";
}

function inferProvider(integrationKey: string, displayName: string | null): string {
  if (displayName) return displayName;
  const key = integrationKey.toLowerCase();
  if (key.includes("quickbooks")) return "Intuit";
  if (key.includes("dockwa")) return "Dockwa Inc";
  if (key.includes("dockmaster")) return "DockMaster Systems";
  if (key.includes("storable")) return "Storable";
  if (key.includes("marina_office") || key.includes("marinaoffice")) return "Marina Office LLC";
  if (key.includes("xero")) return "Xero";
  if (key.includes("hubspot")) return "HubSpot";
  if (key.includes("salesforce")) return "Salesforce";
  return integrationKey;
}

function computeHealthScore(errorCount: number, status: string | null): number {
  if (!status || status === "pending") return 0;
  if (status === "failed") return Math.max(0, 100 - errorCount * 10);
  return Math.max(0, 100 - errorCount * 10);
}

/**
 * GET /api/integrations/sync-status
 * Returns real integration status for the org from integration_connections,
 * with aggregated error counts from integration_sync_logs.
 */
integrationsSyncRouter.get("/sync-status", async (req: any, res) => {
  try {
    const orgId = req.user?.orgId;
    if (!orgId) return res.status(401).json({ error: "Authentication required" });

    const connections = await db
      .select()
      .from(integrationConnections)
      .where(and(eq(integrationConnections.orgId, orgId), eq(integrationConnections.isEnabled, true)))
      .orderBy(integrationConnections.createdAt);

    if (connections.length === 0) {
      return res.json([]);
    }

    const connectionIds = connections.map((c) => c.id);

    const errorCountRows = await db
      .select({
        connectionId: integrationSyncLogs.connectionId,
        errorCount: sql<number>`cast(sum(${integrationSyncLogs.recordsFailed}) as int)`,
      })
      .from(integrationSyncLogs)
      .where(
        and(
          eq(integrationSyncLogs.orgId, orgId),
          inArray(integrationSyncLogs.connectionId, connectionIds)
        )
      )
      .groupBy(integrationSyncLogs.connectionId);

    const errorCountMap = new Map(
      errorCountRows.map((r) => [r.connectionId, r.errorCount || 0])
    );

    const recordsImportedRows = await db
      .select({
        connectionId: integrationSyncLogs.connectionId,
        recordsImported: sql<number>`cast(sum(case when ${integrationSyncLogs.syncDirection} = 'import' then ${integrationSyncLogs.recordsProcessed} else 0 end) as int)`,
        recordsExported: sql<number>`cast(sum(case when ${integrationSyncLogs.syncDirection} = 'export' then ${integrationSyncLogs.recordsProcessed} else 0 end) as int)`,
      })
      .from(integrationSyncLogs)
      .where(
        and(
          eq(integrationSyncLogs.orgId, orgId),
          inArray(integrationSyncLogs.connectionId, connectionIds)
        )
      )
      .groupBy(integrationSyncLogs.connectionId);

    const importExportMap = new Map(
      recordsImportedRows.map((r) => [
        r.connectionId,
        { recordsImported: r.recordsImported || 0, recordsExported: r.recordsExported || 0 },
      ])
    );

    const result = connections.map((conn) => {
      const errorCount = errorCountMap.get(conn.id) || 0;
      const importExport = importExportMap.get(conn.id) || { recordsImported: 0, recordsExported: 0 };
      const status = mapSyncStatus(conn.lastSyncStatus);
      const healthScore = computeHealthScore(errorCount, conn.lastSyncStatus);

      const nextSyncMs = conn.lastSyncAt && conn.syncFrequencyMinutes
        ? new Date(conn.lastSyncAt).getTime() + conn.syncFrequencyMinutes * 60 * 1000
        : null;

      return {
        id: conn.id,
        name: conn.displayName || conn.integrationKey,
        type: inferType(conn.integrationKey),
        provider: inferProvider(conn.integrationKey, conn.displayName),
        status,
        lastSync: conn.lastSyncAt,
        nextSync: nextSyncMs ? new Date(nextSyncMs) : null,
        recordsImported: importExport.recordsImported,
        recordsExported: importExport.recordsExported,
        errorCount,
        healthScore,
      };
    });

    res.json(result);
  } catch (error: any) {
    console.error("[Integrations Sync Status] Error:", error);
    res.status(500).json({ error: "Failed to get sync status", message: error.message });
  }
});

/**
 * GET /api/integrations/sync-history
 * Returns the 50 most recent sync log entries for the org.
 */
integrationsSyncRouter.get("/sync-history", async (req: any, res) => {
  try {
    const orgId = req.user?.orgId;
    if (!orgId) return res.status(401).json({ error: "Authentication required" });

    const logs = await db
      .select({
        id: integrationSyncLogs.id,
        connectionId: integrationSyncLogs.connectionId,
        integrationKey: integrationSyncLogs.integrationKey,
        syncType: integrationSyncLogs.syncType,
        syncDirection: integrationSyncLogs.syncDirection,
        status: integrationSyncLogs.status,
        recordsProcessed: integrationSyncLogs.recordsProcessed,
        recordsFailed: integrationSyncLogs.recordsFailed,
        startedAt: integrationSyncLogs.startedAt,
        completedAt: integrationSyncLogs.completedAt,
        durationMs: integrationSyncLogs.durationMs,
        targetModule: integrationSyncLogs.targetModule,
        connectionDisplayName: integrationConnections.displayName,
      })
      .from(integrationSyncLogs)
      .leftJoin(
        integrationConnections,
        eq(integrationSyncLogs.connectionId, integrationConnections.id)
      )
      .where(
        and(
          eq(integrationSyncLogs.orgId, orgId),
          ne(integrationSyncLogs.status, "in_progress"),
          ne(integrationSyncLogs.status, "pending")
        )
      )
      .orderBy(desc(integrationSyncLogs.startedAt))
      .limit(50);

    const result = logs.map((log) => {
      let historyStatus: "success" | "partial" | "failed" = "success";
      if (log.status === "failed") historyStatus = "failed";
      else if (log.status === "partial" || (log.recordsFailed && log.recordsFailed > 0)) historyStatus = "partial";

      let historyType: "import" | "export" | "full_sync" = "full_sync";
      if (log.syncDirection === "import") historyType = "import";
      else if (log.syncDirection === "export") historyType = "export";

      const integrationName = log.connectionDisplayName || log.integrationKey;
      const message = log.targetModule
        ? `${log.syncType} — ${log.targetModule}`
        : log.syncType || "Sync completed";

      return {
        id: log.id,
        integrationId: log.connectionId || log.integrationKey,
        integrationName,
        type: historyType,
        status: historyStatus,
        startTime: log.startedAt,
        endTime: log.completedAt || log.startedAt,
        recordsProcessed: log.recordsProcessed || 0,
        errors: log.recordsFailed || 0,
        message,
      };
    });

    res.json(result);
  } catch (error: any) {
    console.error("[Integrations Sync History] Error:", error);
    res.status(500).json({ error: "Failed to get sync history", message: error.message });
  }
});

/**
 * POST /api/integrations/:id/sync
 * Trigger a real sync for a specific integration connection (by connection ID).
 * Uses the same ConnectorFactory sync path as the integrations-marketplace route.
 */
integrationsSyncRouter.post("/:id/sync", async (req: any, res) => {
  try {
    const orgId = req.user?.orgId;
    if (!orgId) return res.status(401).json({ error: "Authentication required" });

    const { id } = req.params;

    const [connection] = await db
      .select()
      .from(integrationConnections)
      .where(and(eq(integrationConnections.id, id), eq(integrationConnections.orgId, orgId)));

    if (!connection) {
      return res.status(403).json({ error: "Integration not found or access denied" });
    }

    await db
      .update(integrationConnections)
      .set({ lastSyncStatus: "in_progress", updatedAt: new Date() })
      .where(eq(integrationConnections.id, id));

    res.json({ status: "syncing", message: "Sync started" });

    setImmediate(async () => {
      try {
        const { ConnectorFactory } = await import("../integrations/connectors/base");

        if (!ConnectorFactory.isRegistered(connection.integrationKey)) {
          await db
            .update(integrationConnections)
            .set({
              lastSyncStatus: "failed",
              lastSyncMessage: "Connector not implemented yet",
              updatedAt: new Date(),
            })
            .where(eq(integrationConnections.id, id));

          await db.insert(integrationSyncLogs).values({
            orgId,
            connectionId: connection.id,
            integrationKey: connection.integrationKey,
            syncType: "manual",
            syncDirection: "import",
            status: "failed",
            recordsProcessed: 0,
            recordsCreated: 0,
            recordsUpdated: 0,
            recordsSkipped: 0,
            recordsFailed: 0,
            startedAt: new Date(),
            completedAt: new Date(),
            durationMs: 0,
            triggeredBy: req.user?.id || null,
          });
          return;
        }

        const startedAt = new Date();
        const connector = ConnectorFactory.create({
          integrationKey: connection.integrationKey,
          credentials: (connection.credentials as ConnectorCredentials) || {},
          settings: (connection.settings as Record<string, any>) || {},
          userId: req.user?.id,
          orgId,
        });

        const results = await connector.syncAll();
        const totalRecords = Array.from(results.values()).reduce(
          (sum, r) => sum + r.recordsProcessed,
          0
        );
        const completedAt = new Date();

        await db
          .update(integrationConnections)
          .set({
            lastSyncAt: completedAt,
            lastSyncStatus: "completed",
            lastSyncMessage: `Synced ${totalRecords} records`,
            recordsSyncedTotal: sql`coalesce(${integrationConnections.recordsSyncedTotal}, 0) + ${totalRecords}`,
            updatedAt: completedAt,
          })
          .where(eq(integrationConnections.id, id));

        await db.insert(integrationSyncLogs).values({
          orgId,
          connectionId: connection.id,
          integrationKey: connection.integrationKey,
          syncType: "manual",
          syncDirection: "import",
          status: "completed",
          recordsProcessed: totalRecords,
          recordsCreated: 0,
          recordsUpdated: 0,
          recordsSkipped: 0,
          recordsFailed: 0,
          startedAt,
          completedAt,
          durationMs: completedAt.getTime() - startedAt.getTime(),
          triggeredBy: req.user?.id || null,
        });
      } catch (syncError: any) {
        console.error("[Integration Sync Background] Error:", syncError);
        await db
          .update(integrationConnections)
          .set({
            lastSyncStatus: "failed",
            lastSyncMessage: syncError.message,
            updatedAt: new Date(),
          })
          .where(eq(integrationConnections.id, id));

        await db.insert(integrationSyncLogs).values({
          orgId,
          connectionId: connection.id,
          integrationKey: connection.integrationKey,
          syncType: "manual",
          syncDirection: "import",
          status: "failed",
          recordsProcessed: 0,
          recordsCreated: 0,
          recordsUpdated: 0,
          recordsSkipped: 0,
          recordsFailed: 1,
          startedAt: new Date(),
          completedAt: new Date(),
          durationMs: 0,
          triggeredBy: req.user?.id || null,
        });
      }
    });
  } catch (error: any) {
    console.error("[Integration Sync Trigger] Error:", error);
    res.status(500).json({ error: "Failed to start sync", message: error.message });
  }
});
