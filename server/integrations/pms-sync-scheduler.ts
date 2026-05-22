import cron from 'node-cron';
import { db } from '../db';
import { userIntegrations } from '@shared/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { ConnectorFactory } from './connectors';
import { decrypt } from './crypto';

const MARINA_PMS_KEYS = ['dockwa', 'havenstar', 'dockmaster', 'marina_office', 'storable_marine', 'scribble'];

// Default sync interval when connector doesn't specify one
const DEFAULT_SYNC_MINUTES = 30;

let schedulerInitialized = false;

function isDue(lastSyncAt: Date | null, frequencyMinutes: number): boolean {
  if (!lastSyncAt) return true;
  const msSinceLastSync = Date.now() - new Date(lastSyncAt).getTime();
  return msSinceLastSync >= frequencyMinutes * 60 * 1000;
}

async function runPmsSync() {
  try {
    const connections = await db.select()
      .from(userIntegrations)
      .where(
        and(
          eq(userIntegrations.isConnected, true),
          inArray(userIntegrations.integrationKey, MARINA_PMS_KEYS)
        )
      );

    if (connections.length === 0) return;

    const due = connections.filter(conn => {
      const settings = (conn.settings as Record<string, any>) || {};
      const freqMinutes = Number(settings.syncFrequency) || DEFAULT_SYNC_MINUTES;
      return isDue(conn.lastSyncAt, freqMinutes);
    });

    if (due.length === 0) return;

    console.log(`[PMS Scheduler] ${due.length} of ${connections.length} PMS integration(s) due for sync`);

    for (const conn of due) {
      if (!ConnectorFactory.isRegistered(conn.integrationKey)) continue;

      try {
        const credentials = conn.encryptedCredentials
          ? JSON.parse(decrypt(conn.encryptedCredentials))
          : {};

        if (!credentials || Object.keys(credentials).length === 0) {
          console.warn(`[PMS Scheduler] No credentials for ${conn.integrationKey}, skipping`);
          continue;
        }

        const settings = (conn.settings as Record<string, any>) || {};

        const connector = ConnectorFactory.create({
          integrationKey: conn.integrationKey,
          credentials,
          settings,
          userId: conn.userId,
          orgId: conn.orgId || conn.userId,
        });

        const syncResults = await connector.syncAll();

        let totalErrors = 0;
        syncResults.forEach(result => { totalErrors += result.errors.length; });

        await db.update(userIntegrations)
          .set({
            lastSyncAt: new Date(),
            errorMessage: totalErrors > 0 ? `${totalErrors} errors during scheduled sync` : null,
            updatedAt: new Date(),
          })
          .where(eq(userIntegrations.id, conn.id));

        console.log(`[PMS Scheduler] Completed sync for ${conn.integrationKey} (org: ${conn.orgId})`);
      } catch (connErr) {
        console.error(`[PMS Scheduler] Sync failed for ${conn.integrationKey}:`, connErr);
        try {
          await db.update(userIntegrations)
            .set({
              errorMessage: connErr instanceof Error ? connErr.message : 'Scheduled sync failed',
              updatedAt: new Date(),
            })
            .where(eq(userIntegrations.id, conn.id));
        } catch (_) {}
      }
    }
  } catch (err) {
    console.error('[PMS Scheduler] Scheduler run error:', err);
  }
}

export function startPmsSyncScheduler() {
  if (schedulerInitialized) return;
  schedulerInitialized = true;

  // Poll every minute; individual connectors are gated by their own syncFrequency
  cron.schedule('* * * * *', () => {
    runPmsSync().catch(err => console.error('[PMS Scheduler] Unhandled error:', err));
  });

  console.log('[PMS Scheduler] Marina PMS sync scheduler started (per-connector frequency, polling every minute)');
}
