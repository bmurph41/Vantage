/**
 * MarinaMatch Scheduled Tasks
 * 
 * Background jobs for:
 * - Session cleanup (expired sessions)
 * - Token refresh (expiring OAuth tokens)
 * - Document retention (expired documents)
 * - Audit log maintenance
 * 
 * USAGE:
 * import { startScheduledTasks, stopScheduledTasks } from './tasks/scheduler';
 * 
 * // On server start
 * startScheduledTasks();
 * 
 * // On graceful shutdown
 * stopScheduledTasks();
 */

import { db } from '../db/client'; // Adjust to your DB client
import { sessions, documents, auditLogs, integrations, organizations } from '../db/security-schema';
import { eq, lt, and, isNotNull } from 'drizzle-orm';
import { refreshExpiringTokens } from '../routes/oauth';
import { auditLog } from '../services/audit-logger';
import * as fs from 'fs/promises';
import * as path from 'path';

// ============================================================================
// CONFIGURATION
// ============================================================================

interface TaskConfig {
  name: string;
  interval: number; // milliseconds
  enabled: boolean;
  runOnStart: boolean;
}

const TASK_CONFIGS: Record<string, TaskConfig> = {
  sessionCleanup: {
    name: 'Session Cleanup',
    interval: 60 * 60 * 1000, // 1 hour
    enabled: true,
    runOnStart: true,
  },
  tokenRefresh: {
    name: 'Token Refresh',
    interval: 15 * 60 * 1000, // 15 minutes
    enabled: true,
    runOnStart: false,
  },
  documentRetention: {
    name: 'Document Retention',
    interval: 24 * 60 * 60 * 1000, // 24 hours
    enabled: true,
    runOnStart: false,
  },
  auditLogMaintenance: {
    name: 'Audit Log Maintenance',
    interval: 7 * 24 * 60 * 60 * 1000, // 7 days
    enabled: true,
    runOnStart: false,
  },
};

// Store interval IDs for cleanup
const taskIntervals: Map<string, NodeJS.Timeout> = new Map();
let isRunning = false;

// ============================================================================
// SESSION CLEANUP
// ============================================================================

/**
 * Clean up expired sessions
 * Removes sessions that have passed their expiration time
 */
export async function cleanupExpiredSessions(): Promise<number> {
  const taskName = 'sessionCleanup';
  const startTime = Date.now();
  
  try {
    console.log(`[TASK:${taskName}] Starting session cleanup...`);

    const now = new Date();
    
    // Delete expired sessions
    const result = await db
      .delete(sessions)
      .where(lt(sessions.expiresAt, now))
      .returning({ id: sessions.id });

    const deletedCount = result.length;
    const duration = Date.now() - startTime;

    console.log(`[TASK:${taskName}] Completed: ${deletedCount} sessions removed in ${duration}ms`);

    // Log to audit (system action)
    if (deletedCount > 0) {
      await auditLog({
        actorUserId: 'system',
        actorType: 'system',
        action: 'session_cleanup',
        resourceType: 'session',
        afterState: {
          deletedCount,
          duration,
        },
      });
    }

    return deletedCount;
  } catch (error) {
    console.error(`[TASK:${taskName}] Error:`, error);
    return 0;
  }
}

// ============================================================================
// TOKEN REFRESH
// ============================================================================

/**
 * Refresh expiring OAuth tokens
 * Proactively refreshes tokens before they expire
 */
export async function refreshExpiringIntegrationTokens(): Promise<number> {
  const taskName = 'tokenRefresh';
  const startTime = Date.now();
  
  try {
    console.log(`[TASK:${taskName}] Starting token refresh check...`);

    // Find integrations with tokens expiring in the next hour
    const expiringThreshold = new Date(Date.now() + 60 * 60 * 1000);

    const expiringIntegrations = await db
      .select({ 
        id: integrations.id,
        type: integrations.type,
        orgId: integrations.orgId,
      })
      .from(integrations)
      .where(
        and(
          eq(integrations.status, 'connected'),
          lt(integrations.tokenExpiresAt, expiringThreshold),
          isNotNull(integrations.encryptedRefreshToken)
        )
      );

    let refreshedCount = 0;
    let failedCount = 0;

    for (const integration of expiringIntegrations) {
      try {
        // Dynamic import to avoid circular dependencies
        const { refreshIntegrationTokens } = await import('../routes/oauth');
        const success = await refreshIntegrationTokens(integration.id);
        
        if (success) {
          refreshedCount++;
        } else {
          failedCount++;
        }
      } catch (error) {
        console.error(`[TASK:${taskName}] Failed to refresh ${integration.id}:`, error);
        failedCount++;
      }
    }

    const duration = Date.now() - startTime;
    console.log(`[TASK:${taskName}] Completed: ${refreshedCount} refreshed, ${failedCount} failed in ${duration}ms`);

    return refreshedCount;
  } catch (error) {
    console.error(`[TASK:${taskName}] Error:`, error);
    return 0;
  }
}

// ============================================================================
// DOCUMENT RETENTION
// ============================================================================

/**
 * Enforce document retention policies
 * Deletes documents past their retention period
 */
export async function enforceDocumentRetention(): Promise<number> {
  const taskName = 'documentRetention';
  const startTime = Date.now();
  
  try {
    console.log(`[TASK:${taskName}] Starting document retention enforcement...`);

    // Get organizations with retention policies
    const orgs = await db
      .select({
        id: organizations.id,
        settings: organizations.settings,
      })
      .from(organizations);

    let totalDeleted = 0;

    for (const org of orgs) {
      const settings = org.settings as { retentionDays?: number } | null;
      const retentionDays = settings?.retentionDays || 365; // Default 1 year

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      // Find expired documents
      const expiredDocs = await db
        .select({
          id: documents.id,
          storagePath: documents.storagePath,
          filename: documents.filename,
        })
        .from(documents)
        .where(
          and(
            eq(documents.orgId, org.id),
            lt(documents.createdAt, cutoffDate),
            eq(documents.status, 'approved') // Only delete approved docs
          )
        );

      for (const doc of expiredDocs) {
        try {
          // Delete physical file
          if (doc.storagePath) {
            const uploadPath = process.env.UPLOAD_PATH || '/data/uploads';
            const fullPath = path.join(uploadPath, doc.storagePath);
            
            try {
              await fs.unlink(fullPath);
            } catch (err) {
              // File might already be deleted, log but continue
              console.warn(`[TASK:${taskName}] File not found: ${fullPath}`);
            }
          }

          // Soft delete document record
          await db
            .update(documents)
            .set({
              status: 'deleted',
              deletedAt: new Date(),
              deletedBy: 'system:retention',
              metadata: {
                retentionEnforced: true,
                retentionDays,
                deletedAt: new Date().toISOString(),
              },
            })
            .where(eq(documents.id, doc.id));

          totalDeleted++;

          // Audit log
          await auditLog({
            orgId: org.id,
            actorUserId: 'system',
            actorType: 'system',
            action: 'document_retention_delete',
            resourceType: 'document',
            resourceId: doc.id,
            afterState: {
              filename: doc.filename,
              retentionDays,
              reason: 'retention_policy',
            },
          });
        } catch (docError) {
          console.error(`[TASK:${taskName}] Failed to delete document ${doc.id}:`, docError);
        }
      }
    }

    const duration = Date.now() - startTime;
    console.log(`[TASK:${taskName}] Completed: ${totalDeleted} documents deleted in ${duration}ms`);

    return totalDeleted;
  } catch (error) {
    console.error(`[TASK:${taskName}] Error:`, error);
    return 0;
  }
}

// ============================================================================
// AUDIT LOG MAINTENANCE
// ============================================================================

/**
 * Maintain audit logs
 * - Verify hash chain integrity
 * - Archive old logs (optional)
 * - Generate summaries
 */
export async function maintainAuditLogs(): Promise<void> {
  const taskName = 'auditLogMaintenance';
  const startTime = Date.now();
  
  try {
    console.log(`[TASK:${taskName}] Starting audit log maintenance...`);

    // Get all organizations
    const orgs = await db
      .select({ id: organizations.id })
      .from(organizations);

    const results: Record<string, { valid: boolean; brokenAt?: string }> = {};

    for (const org of orgs) {
      try {
        // Dynamic import to avoid circular deps
        const { verifyAuditLogChain } = await import('../services/audit-logger');
        const verification = await verifyAuditLogChain(org.id, 10000);
        results[org.id] = verification;

        if (!verification.valid) {
          console.error(`[TASK:${taskName}] ALERT: Audit log chain broken for org ${org.id} at ${verification.brokenAt}`);
          
          // Log the tampering detection
          await auditLog({
            orgId: org.id,
            actorUserId: 'system',
            actorType: 'system',
            action: 'audit_chain_verification_failed',
            resourceType: 'audit_log',
            resourceId: verification.brokenAt,
            afterState: {
              alertLevel: 'critical',
              verificationResult: verification,
            },
          });
        }
      } catch (error) {
        console.error(`[TASK:${taskName}] Failed to verify org ${org.id}:`, error);
      }
    }

    const duration = Date.now() - startTime;
    const failedOrgs = Object.entries(results).filter(([_, v]) => !v.valid).length;
    
    console.log(`[TASK:${taskName}] Completed in ${duration}ms. Failed verifications: ${failedOrgs}`);
  } catch (error) {
    console.error(`[TASK:${taskName}] Error:`, error);
  }
}

// ============================================================================
// INACTIVE USER CLEANUP
// ============================================================================

/**
 * Mark inactive users (optional task)
 * Users who haven't logged in for 90+ days
 */
export async function markInactiveUsers(): Promise<number> {
  const taskName = 'inactiveUsers';
  const startTime = Date.now();
  
  try {
    console.log(`[TASK:${taskName}] Checking for inactive users...`);

    const inactiveThreshold = new Date();
    inactiveThreshold.setDate(inactiveThreshold.getDate() - 90);

    // This would update a status field on users
    // Implementation depends on your user schema
    
    const duration = Date.now() - startTime;
    console.log(`[TASK:${taskName}] Completed in ${duration}ms`);

    return 0;
  } catch (error) {
    console.error(`[TASK:${taskName}] Error:`, error);
    return 0;
  }
}

// ============================================================================
// SCHEDULER CONTROL
// ============================================================================

/**
 * Run a task immediately
 */
async function runTask(taskName: string): Promise<void> {
  const tasks: Record<string, () => Promise<unknown>> = {
    sessionCleanup: cleanupExpiredSessions,
    tokenRefresh: refreshExpiringIntegrationTokens,
    documentRetention: enforceDocumentRetention,
    auditLogMaintenance: maintainAuditLogs,
  };

  const task = tasks[taskName];
  if (task) {
    await task();
  } else {
    console.warn(`[SCHEDULER] Unknown task: ${taskName}`);
  }
}

/**
 * Start all scheduled tasks
 */
export function startScheduledTasks(): void {
  if (isRunning) {
    console.warn('[SCHEDULER] Tasks already running');
    return;
  }

  console.log('[SCHEDULER] Starting scheduled tasks...');
  isRunning = true;

  for (const [taskName, config] of Object.entries(TASK_CONFIGS)) {
    if (!config.enabled) {
      console.log(`[SCHEDULER] Task disabled: ${config.name}`);
      continue;
    }

    // Run immediately if configured
    if (config.runOnStart) {
      setImmediate(() => runTask(taskName));
    }

    // Schedule recurring execution
    const intervalId = setInterval(() => runTask(taskName), config.interval);
    taskIntervals.set(taskName, intervalId);

    console.log(`[SCHEDULER] Scheduled: ${config.name} (every ${config.interval / 1000}s)`);
  }
}

/**
 * Stop all scheduled tasks
 */
export function stopScheduledTasks(): void {
  if (!isRunning) {
    console.warn('[SCHEDULER] Tasks not running');
    return;
  }

  console.log('[SCHEDULER] Stopping scheduled tasks...');

  for (const [taskName, intervalId] of taskIntervals.entries()) {
    clearInterval(intervalId);
    console.log(`[SCHEDULER] Stopped: ${taskName}`);
  }

  taskIntervals.clear();
  isRunning = false;
}

/**
 * Check if scheduler is running
 */
export function isSchedulerRunning(): boolean {
  return isRunning;
}

/**
 * Get task status
 */
export function getTaskStatus(): Record<string, { enabled: boolean; interval: number }> {
  const status: Record<string, { enabled: boolean; interval: number }> = {};
  
  for (const [taskName, config] of Object.entries(TASK_CONFIGS)) {
    status[taskName] = {
      enabled: config.enabled && taskIntervals.has(taskName),
      interval: config.interval,
    };
  }
  
  return status;
}

// ============================================================================
// MANUAL TASK EXECUTION (Admin Only)
// ============================================================================

/**
 * Trigger a task manually (for admin use)
 */
export async function triggerTask(taskName: string): Promise<{ success: boolean; result?: unknown; error?: string }> {
  const config = TASK_CONFIGS[taskName];
  
  if (!config) {
    return { success: false, error: `Unknown task: ${taskName}` };
  }

  try {
    await runTask(taskName);
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

// ============================================================================
// GRACEFUL SHUTDOWN HANDLER
// ============================================================================

/**
 * Register graceful shutdown handler
 */
export function registerShutdownHandler(): void {
  const shutdown = () => {
    console.log('\n[SCHEDULER] Received shutdown signal...');
    stopScheduledTasks();
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

export default {
  startScheduledTasks,
  stopScheduledTasks,
  triggerTask,
  getTaskStatus,
  registerShutdownHandler,
};
