/**
 * Property Data Cron Jobs
 *
 * Scheduled sync jobs for pulling property data from external sources.
 * Each source has its own sync frequency (hourly, daily, weekly, monthly).
 *
 * Add to server startup (e.g., server/index.ts):
 *   import { initPropertyDataCron } from './services/property-data-cron';
 *   initPropertyDataCron();
 */

import { db } from "../db";
import { platformDataSources } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { propertyDataService } from "./property-data-service";

// =============================================
// Sync Frequency Intervals (in milliseconds)
// =============================================

const FREQUENCY_INTERVALS: Record<string, number> = {
  hourly: 60 * 60 * 1000,           // 1 hour
  daily: 24 * 60 * 60 * 1000,       // 24 hours
  weekly: 7 * 24 * 60 * 60 * 1000,  // 7 days
  monthly: 30 * 24 * 60 * 60 * 1000, // 30 days
};

// =============================================
// Cron Manager
// =============================================

let cronInterval: NodeJS.Timeout | null = null;

/**
 * Initialize the property data sync cron system.
 * Checks every 15 minutes for sources that need syncing.
 */
export function initPropertyDataCron() {
  console.log("[PropertyData Cron] Initializing scheduled sync jobs...");

  // Run initial check after 30 seconds (let server start up first)
  setTimeout(() => {
    runSyncCheck().catch((err) => {
      console.error("[PropertyData Cron] Initial sync check failed:", err.message);
    });
  }, 30000);

  // Check every 15 minutes for sources needing sync
  cronInterval = setInterval(() => {
    runSyncCheck().catch((err) => {
      console.error("[PropertyData Cron] Scheduled sync check failed:", err.message);
    });
  }, 15 * 60 * 1000);
}

/**
 * Stop the cron system (for graceful shutdown)
 */
export function stopPropertyDataCron() {
  if (cronInterval) {
    clearInterval(cronInterval);
    cronInterval = null;
    console.log("[PropertyData Cron] Stopped.");
  }
}

/**
 * Check all enabled data sources and sync any that are due.
 */
async function runSyncCheck() {
  console.log("[PropertyData Cron] Running sync check...");

  const sources = await db
    .select()
    .from(platformDataSources)
    .where(
      and(
        eq(platformDataSources.enabled, true),
        eq(platformDataSources.status, "connected")
      )
    );

  if (sources.length === 0) {
    console.log("[PropertyData Cron] No enabled/connected sources found.");
    return;
  }

  const now = Date.now();
  let syncCount = 0;

  for (const source of sources) {
    const frequency = source.syncFrequency || "daily";
    if (frequency === "manual" || frequency === "realtime") continue;

    const interval = FREQUENCY_INTERVALS[frequency];
    if (!interval) continue;

    const lastSync = source.lastSyncAt ? new Date(source.lastSyncAt).getTime() : 0;
    const elapsed = now - lastSync;

    if (elapsed >= interval) {
      console.log(`[PropertyData Cron] Syncing ${source.name} (${frequency}, last synced ${Math.round(elapsed / 1000 / 60)} min ago)...`);
      syncCount++;

      try {
        await propertyDataService.syncDataSource(source.id, "cron");
      } catch (err: any) {
        console.error(`[PropertyData Cron] Sync failed for ${source.name}:`, err.message);
      }
    }
  }

  console.log(`[PropertyData Cron] Sync check complete. ${syncCount} sources synced.`);
}
