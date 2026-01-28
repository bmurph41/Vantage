/**
 * MarinaMatch Audit Logger
 * 
 * Provides append-only audit logging with hash chain for tamper evidence.
 * Logs security events, document access, and administrative actions.
 * 
 * USAGE:
 * import { auditLog, AuditAction } from './services/audit-logger';
 * 
 * auditLog({
 *   orgId: context.orgId,
 *   actorUserId: context.userId,
 *   action: 'document_upload',
 *   resourceType: 'document',
 *   resourceId: doc.id,
 *   afterState: { filename: doc.filename },
 *   ipAddress: req.ip,
 *   userAgent: req.headers['user-agent'],
 *   requestId: req.requestId,
 * });
 */

import { db } from '../db/client'; // Adjust to your DB client
import { auditLogs } from '../db/security-schema';
import { generateAuditLogHash, redactFields } from '../utils/encryption';
import type { AuditLogEntry, AuditAction } from '../types/security';
import { desc, eq } from 'drizzle-orm';

// ============================================================================
// CONFIGURATION
// ============================================================================

// Fields that should be redacted in audit logs
const SENSITIVE_FIELDS = [
  'password',
  'token',
  'secret',
  'accessToken',
  'refreshToken',
  'ssn',
  'creditCard',
  'bankAccount',
  'mfaSecret',
  'mfaBackupCodes',
];

// Maximum size for before/after state (prevent huge logs)
const MAX_STATE_SIZE = 10000; // characters

// Whether to enable hash chaining (slight performance overhead)
const ENABLE_HASH_CHAIN = true;

// ============================================================================
// AUDIT LOG SERVICE
// ============================================================================

/**
 * Write an audit log entry
 * This is designed to be fire-and-forget (non-blocking)
 */
export async function auditLog(entry: AuditLogEntry): Promise<void> {
  try {
    await writeAuditLog(entry);
  } catch (error) {
    // Log to console but don't throw - audit logging should never block operations
    console.error('[AUDIT] Failed to write audit log:', error);
    console.error('[AUDIT] Entry:', JSON.stringify(entry));
  }
}

/**
 * Write audit log with hash chain
 */
async function writeAuditLog(entry: AuditLogEntry): Promise<void> {
  // Redact sensitive fields from state
  const beforeState = entry.beforeState
    ? sanitizeState(redactFields(entry.beforeState as Record<string, unknown>, SENSITIVE_FIELDS))
    : null;
  
  const afterState = entry.afterState
    ? sanitizeState(redactFields(entry.afterState as Record<string, unknown>, SENSITIVE_FIELDS))
    : null;

  // Get previous log hash for chain
  let previousLogHash: string | null = null;
  
  if (ENABLE_HASH_CHAIN) {
    const lastLog = await db
      .select({ logHash: auditLogs.logHash })
      .from(auditLogs)
      .where(entry.orgId ? eq(auditLogs.orgId, entry.orgId) : undefined)
      .orderBy(desc(auditLogs.createdAt))
      .limit(1);

    if (lastLog.length > 0) {
      previousLogHash = lastLog[0].logHash;
    }
  }

  // Generate hash for this entry
  const timestamp = new Date();
  const logHash = generateAuditLogHash(
    {
      orgId: entry.orgId,
      actorUserId: entry.actorUserId,
      action: entry.action,
      resourceType: entry.resourceType,
      resourceId: entry.resourceId,
      timestamp,
    },
    previousLogHash || ''
  );

  // Insert audit log
  await db.insert(auditLogs).values({
    orgId: entry.orgId,
    actorUserId: entry.actorUserId,
    actorType: entry.actorType || 'user',
    action: entry.action,
    resourceType: entry.resourceType,
    resourceId: entry.resourceId,
    beforeState,
    afterState,
    ipAddress: entry.ipAddress,
    userAgent: entry.userAgent,
    requestId: entry.requestId,
    metadata: entry.metadata || {},
    previousLogHash,
    logHash,
    createdAt: timestamp,
  });
}

/**
 * Sanitize state object to prevent oversized logs
 */
function sanitizeState(state: Record<string, unknown>): Record<string, unknown> {
  const json = JSON.stringify(state);
  
  if (json.length > MAX_STATE_SIZE) {
    return {
      _truncated: true,
      _originalSize: json.length,
      _keys: Object.keys(state),
    };
  }
  
  return state;
}

// ============================================================================
// AUDIT LOG HELPERS
// ============================================================================

/**
 * Log a login event
 */
export async function logLogin(
  userId: string,
  orgId: string,
  ip: string,
  userAgent?: string,
  success: boolean = true
): Promise<void> {
  await auditLog({
    orgId,
    actorUserId: userId,
    action: success ? 'login' : 'login_failed',
    resourceType: 'session',
    ipAddress: ip,
    userAgent,
    metadata: { success },
  });
}

/**
 * Log a logout event
 */
export async function logLogout(
  userId: string,
  orgId: string,
  sessionId: string,
  ip?: string
): Promise<void> {
  await auditLog({
    orgId,
    actorUserId: userId,
    action: 'logout',
    resourceType: 'session',
    resourceId: sessionId,
    ipAddress: ip,
  });
}

/**
 * Log document access
 */
export async function logDocumentAccess(
  action: 'document_view' | 'document_download' | 'document_upload' | 'document_delete',
  document: {
    id: string;
    orgId: string;
    filename?: string;
    documentType?: string;
  },
  userId: string,
  ip?: string,
  userAgent?: string,
  requestId?: string
): Promise<void> {
  await auditLog({
    orgId: document.orgId,
    actorUserId: userId,
    action,
    resourceType: 'document',
    resourceId: document.id,
    afterState: {
      filename: document.filename,
      documentType: document.documentType,
    },
    ipAddress: ip,
    userAgent,
    requestId,
  });
}

/**
 * Log role assignment
 */
export async function logRoleAssignment(
  orgId: string,
  actorUserId: string,
  targetUserId: string,
  roleName: string,
  assigned: boolean,
  ip?: string,
  requestId?: string
): Promise<void> {
  await auditLog({
    orgId,
    actorUserId,
    action: assigned ? 'role_assigned' : 'role_revoked',
    resourceType: 'user_role',
    resourceId: targetUserId,
    afterState: {
      targetUserId,
      roleName,
      assigned,
    },
    ipAddress: ip,
    requestId,
  });
}

/**
 * Log integration event
 */
export async function logIntegration(
  action: 'integration_connected' | 'integration_disconnected' | 'integration_token_refreshed',
  orgId: string,
  userId: string,
  integrationType: string,
  integrationId?: string,
  ip?: string,
  requestId?: string
): Promise<void> {
  await auditLog({
    orgId,
    actorUserId: userId,
    action,
    resourceType: 'integration',
    resourceId: integrationId,
    afterState: {
      integrationType,
    },
    ipAddress: ip,
    requestId,
  });
}

/**
 * Log model application (sensitive action)
 */
export async function logModelApplication(
  orgId: string,
  userId: string,
  modelId: string,
  documentIds: string[],
  ip?: string,
  requestId?: string
): Promise<void> {
  await auditLog({
    orgId,
    actorUserId: userId,
    action: 'model_applied',
    resourceType: 'model',
    resourceId: modelId,
    afterState: {
      documentIds,
      documentCount: documentIds.length,
    },
    ipAddress: ip,
    requestId,
  });
}

/**
 * Log data export
 */
export async function logDataExport(
  orgId: string,
  userId: string,
  exportType: string,
  recordCount: number,
  ip?: string,
  requestId?: string
): Promise<void> {
  await auditLog({
    orgId,
    actorUserId: userId,
    action: 'data_export',
    resourceType: 'export',
    afterState: {
      exportType,
      recordCount,
    },
    ipAddress: ip,
    requestId,
  });
}

/**
 * Log data deletion request
 */
export async function logDataDeletionRequest(
  orgId: string,
  userId: string,
  requestedBy: string,
  ip?: string,
  requestId?: string
): Promise<void> {
  await auditLog({
    orgId,
    actorUserId: userId,
    action: 'data_deletion_requested',
    resourceType: 'data_deletion',
    afterState: {
      requestedBy,
      requestedAt: new Date().toISOString(),
    },
    ipAddress: ip,
    requestId,
  });
}

// ============================================================================
// AUDIT LOG QUERIES (Admin Only)
// ============================================================================

interface AuditLogQueryOptions {
  orgId: string;
  userId?: string;
  action?: AuditAction;
  resourceType?: string;
  resourceId?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

/**
 * Query audit logs (for admin viewing)
 */
export async function queryAuditLogs(options: AuditLogQueryOptions) {
  const { orgId, limit = 100, offset = 0 } = options;

  // Build query conditions
  let query = db
    .select()
    .from(auditLogs)
    .where(eq(auditLogs.orgId, orgId))
    .orderBy(desc(auditLogs.createdAt))
    .limit(limit)
    .offset(offset);

  // Note: Additional filters would be added here with Drizzle's and() function
  // For brevity, implementing basic query

  return query;
}

/**
 * Get audit log count for pagination
 */
export async function getAuditLogCount(orgId: string): Promise<number> {
  const result = await db
    .select({ count: auditLogs.id })
    .from(auditLogs)
    .where(eq(auditLogs.orgId, orgId));

  return result.length;
}

/**
 * Verify audit log chain integrity
 * Returns true if chain is intact, false if tampering detected
 */
export async function verifyAuditLogChain(
  orgId: string,
  limit: number = 1000
): Promise<{ valid: boolean; brokenAt?: string }> {
  const logs = await db
    .select({
      id: auditLogs.id,
      logHash: auditLogs.logHash,
      previousLogHash: auditLogs.previousLogHash,
      orgId: auditLogs.orgId,
      actorUserId: auditLogs.actorUserId,
      action: auditLogs.action,
      resourceType: auditLogs.resourceType,
      resourceId: auditLogs.resourceId,
      createdAt: auditLogs.createdAt,
    })
    .from(auditLogs)
    .where(eq(auditLogs.orgId, orgId))
    .orderBy(auditLogs.createdAt)
    .limit(limit);

  for (let i = 1; i < logs.length; i++) {
    const current = logs[i];
    const previous = logs[i - 1];

    // Verify chain link
    if (current.previousLogHash !== previous.logHash) {
      return {
        valid: false,
        brokenAt: current.id,
      };
    }

    // Verify hash is correct
    const expectedHash = generateAuditLogHash(
      {
        orgId: current.orgId ?? undefined,
        actorUserId: current.actorUserId ?? undefined,
        action: current.action,
        resourceType: current.resourceType,
        resourceId: current.resourceId ?? undefined,
        timestamp: current.createdAt,
      },
      current.previousLogHash || ''
    );

    if (current.logHash !== expectedHash) {
      return {
        valid: false,
        brokenAt: current.id,
      };
    }
  }

  return { valid: true };
}
