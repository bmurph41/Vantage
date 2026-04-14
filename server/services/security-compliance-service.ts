/**
 * Security & Compliance Service
 * ==============================
 * Institutional-grade security infrastructure for Vantage.
 * Covers TOTP 2FA, PII encryption, session management, GDPR/CCPA,
 * IP allowlisting, AML/KYC, data retention, and security event logging.
 *
 * Required by: SOC 2 Type II, GDPR Article 32, CCPA § 1798.150,
 * institutional LP operational due diligence
 */

import { db } from '../db';
import { sql } from 'drizzle-orm';
import crypto from 'crypto';

// ─── Types ──────────────────────────────────────────────────────────────────

export type SecurityEventType =
  | 'login'
  | 'logout'
  | 'login_failed'
  | 'password_changed'
  | '2fa_enabled'
  | '2fa_disabled'
  | 'permission_changed'
  | 'suspicious_activity'
  | 'session_created'
  | 'session_invalidated'
  | 'data_export'
  | 'pii_access';

export interface SecurityEvent {
  id?: string;
  orgId: string;
  userId?: string;
  eventType: SecurityEventType;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, any>;
  severity?: 'info' | 'warning' | 'critical';
  createdAt?: Date;
}

export interface SecurityEventFilters {
  eventType?: SecurityEventType;
  severity?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

export interface ActiveSession {
  id: string;
  userId: string;
  orgId: string;
  ipAddress: string;
  userAgent: string;
  deviceInfo: string;
  lastActiveAt: Date;
  createdAt: Date;
  expiresAt: Date;
}

export interface RetentionPolicy {
  id: string;
  orgId: string;
  dataType: string;
  retentionDays: number;
  lastAppliedAt?: Date;
  createdAt: Date;
}

export interface ConsentRecord {
  id: string;
  userId: string;
  consentType: string;
  granted: boolean;
  ipAddress?: string;
  userAgent?: string;
  grantedAt: Date;
  revokedAt?: Date;
}

export interface KycCheckResult {
  id: string;
  investorId: string;
  orgId: string;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  checkType: string;
  verificationData: Record<string, any>;
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// ─── TOTP Constants ─────────────────────────────────────────────────────────

const TOTP_DIGITS = 6;
const TOTP_PERIOD = 30;
const TOTP_ALGORITHM = 'sha1';
const TOTP_WINDOW = 1; // Allow 1 step before/after for clock drift

// ─── Service ────────────────────────────────────────────────────────────────

class SecurityComplianceService {

  // ═══════════════════════════════════════════════════════════════════════════
  // TOTP 2FA (RFC 6238)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Generate a new TOTP secret and return it with the otpauth URI.
   * The secret is base32-encoded for compatibility with authenticator apps.
   */
  generateTotpSecret(userEmail: string, issuer: string = 'Vantage'): {
    secret: string;
    uri: string;
    qrData: string;
  } {
    const secretBytes = crypto.randomBytes(20);
    const secret = this.base32Encode(secretBytes);
    const uri = `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(userEmail)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=${TOTP_DIGITS}&period=${TOTP_PERIOD}`;

    return { secret, uri, qrData: uri };
  }

  /**
   * Verify a TOTP code against the stored secret for a user.
   * Checks current window plus +/- TOTP_WINDOW steps for clock drift.
   */
  async verifyTotpCode(userId: string, code: string): Promise<boolean> {
    const result = await db.execute(sql`
      SELECT totp_secret FROM users
      WHERE id = ${userId} AND totp_enabled = true
    `);

    const rows = result.rows as any[];
    if (!rows.length || !rows[0].totp_secret) return false;

    const secret = rows[0].totp_secret;
    return this.verifyTotpToken(secret, code);
  }

  /**
   * Enable TOTP for a user after verifying they can produce a valid code.
   * Stores the secret and generates backup recovery codes.
   */
  async enableTotp(
    userId: string,
    secret: string,
    verificationCode: string
  ): Promise<{ success: boolean; recoveryCodes?: string[] }> {
    // Verify the code matches the secret before enabling
    const isValid = this.verifyTotpToken(secret, verificationCode);
    if (!isValid) {
      return { success: false };
    }

    // Generate 10 single-use recovery codes
    const recoveryCodes = Array.from({ length: 10 }, () =>
      crypto.randomBytes(4).toString('hex').toUpperCase()
    );
    const hashedCodes = recoveryCodes.map(c =>
      crypto.createHash('sha256').update(c).digest('hex')
    );

    await db.execute(sql`
      UPDATE users SET
        totp_enabled = true,
        totp_secret = ${secret},
        totp_recovery_codes = ${JSON.stringify(hashedCodes)},
        totp_enabled_at = NOW()
      WHERE id = ${userId}
    `);

    // Log the security event
    await this.logSecurityEvent({
      orgId: '',
      userId,
      eventType: '2fa_enabled',
      severity: 'info',
      metadata: { method: 'totp' },
    });

    return { success: true, recoveryCodes };
  }

  /**
   * Disable TOTP for a user after verifying their current code.
   */
  async disableTotp(userId: string, code: string): Promise<boolean> {
    const valid = await this.verifyTotpCode(userId, code);
    if (!valid) return false;

    await db.execute(sql`
      UPDATE users SET
        totp_enabled = false,
        totp_secret = NULL,
        totp_recovery_codes = NULL,
        totp_enabled_at = NULL
      WHERE id = ${userId}
    `);

    await this.logSecurityEvent({
      orgId: '',
      userId,
      eventType: '2fa_disabled',
      severity: 'warning',
      metadata: { method: 'totp' },
    });

    return true;
  }

  /**
   * Core TOTP verification: generate expected codes for current window
   * and compare against the provided code (RFC 6238).
   */
  private verifyTotpToken(secret: string, code: string): boolean {
    const now = Math.floor(Date.now() / 1000);
    for (let i = -TOTP_WINDOW; i <= TOTP_WINDOW; i++) {
      const timeStep = Math.floor(now / TOTP_PERIOD) + i;
      const expected = this.generateTotpCode(secret, timeStep);
      if (crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(code))) {
        return true;
      }
    }
    return false;
  }

  /**
   * Generate a single TOTP code for a given time step (RFC 6238 / RFC 4226).
   */
  private generateTotpCode(base32Secret: string, timeStep: number): string {
    // Decode base32 secret to bytes
    const keyBytes = this.base32Decode(base32Secret);

    // Convert time step to 8-byte big-endian buffer
    const timeBuffer = Buffer.alloc(8);
    let t = timeStep;
    for (let i = 7; i >= 0; i--) {
      timeBuffer[i] = t & 0xff;
      t = Math.floor(t / 256);
    }

    // HMAC-SHA1
    const hmac = crypto.createHmac(TOTP_ALGORITHM, keyBytes);
    hmac.update(timeBuffer);
    const hash = hmac.digest();

    // Dynamic truncation (RFC 4226 Section 5.4)
    const offset = hash[hash.length - 1] & 0x0f;
    const binary =
      ((hash[offset] & 0x7f) << 24) |
      ((hash[offset + 1] & 0xff) << 16) |
      ((hash[offset + 2] & 0xff) << 8) |
      (hash[offset + 3] & 0xff);

    const otp = binary % Math.pow(10, TOTP_DIGITS);
    return otp.toString().padStart(TOTP_DIGITS, '0');
  }

  private base32Encode(buffer: Buffer): string {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    let bits = 0;
    let value = 0;
    let output = '';
    for (const byte of buffer) {
      value = (value << 8) | byte;
      bits += 8;
      while (bits >= 5) {
        bits -= 5;
        output += alphabet[(value >>> bits) & 0x1f];
      }
    }
    if (bits > 0) {
      output += alphabet[(value << (5 - bits)) & 0x1f];
    }
    return output;
  }

  private base32Decode(encoded: string): Buffer {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    const cleaned = encoded.replace(/[=\s]/g, '').toUpperCase();
    let bits = 0;
    let value = 0;
    const bytes: number[] = [];
    for (const char of cleaned) {
      const idx = alphabet.indexOf(char);
      if (idx === -1) continue;
      value = (value << 5) | idx;
      bits += 5;
      if (bits >= 8) {
        bits -= 8;
        bytes.push((value >>> bits) & 0xff);
      }
    }
    return Buffer.from(bytes);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PII Encryption (AES-256-GCM)
  // ═══════════════════════════════════════════════════════════════════════════

  private getEncryptionKey(): Buffer {
    const envKey = process.env.PII_ENCRYPTION_KEY;
    if (envKey) {
      // If the key is hex-encoded (64 chars = 32 bytes)
      if (envKey.length === 64 && /^[0-9a-fA-F]+$/.test(envKey)) {
        return Buffer.from(envKey, 'hex');
      }
      // Otherwise derive a 256-bit key from the provided value
      return crypto.createHash('sha256').update(envKey).digest();
    }
    // Fallback: derive from DATABASE_URL (not ideal but better than nothing)
    const dbUrl = process.env.DATABASE_URL || '';
    if (!dbUrl) {
      throw new Error('No encryption key available: set PII_ENCRYPTION_KEY or DATABASE_URL');
    }
    return crypto.createHash('sha256').update(dbUrl).digest();
  }

  /**
   * Encrypt plaintext using AES-256-GCM.
   * Returns a string in the format: iv:authTag:ciphertext (all hex-encoded).
   */
  encryptPII(plaintext: string): string {
    const key = this.getEncryptionKey();
    const iv = crypto.randomBytes(12); // 96-bit IV for GCM
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');

    return `${iv.toString('hex')}:${authTag}:${encrypted}`;
  }

  /**
   * Decrypt a ciphertext produced by encryptPII.
   */
  decryptPII(ciphertext: string): string {
    const key = this.getEncryptionKey();
    const parts = ciphertext.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid ciphertext format: expected iv:authTag:data');
    }

    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encryptedData = parts[2];

    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  /**
   * Encrypt a specific field value and store the mapping in the encrypted_fields table.
   * This allows field-level encryption with audit tracking.
   */
  async encryptField(
    orgId: string,
    tableName: string,
    fieldName: string,
    recordId: string,
    plaintext: string
  ): Promise<string> {
    const encrypted = this.encryptPII(plaintext);
    const id = crypto.randomUUID();

    await db.execute(sql`
      INSERT INTO encrypted_fields (id, org_id, table_name, field_name, record_id, encrypted_value, created_at, updated_at)
      VALUES (${id}, ${orgId}, ${tableName}, ${fieldName}, ${recordId}, ${encrypted}, NOW(), NOW())
      ON CONFLICT (org_id, table_name, field_name, record_id)
      DO UPDATE SET encrypted_value = ${encrypted}, updated_at = NOW()
    `);

    await this.logSecurityEvent({
      orgId,
      eventType: 'pii_access',
      severity: 'info',
      metadata: { action: 'encrypt', tableName, fieldName, recordId },
    });

    return encrypted;
  }

  /**
   * Decrypt a stored field value by looking it up in the encrypted_fields table.
   */
  async decryptField(
    orgId: string,
    tableName: string,
    fieldName: string,
    recordId: string
  ): Promise<string | null> {
    const result = await db.execute(sql`
      SELECT encrypted_value FROM encrypted_fields
      WHERE org_id = ${orgId} AND table_name = ${tableName}
        AND field_name = ${fieldName} AND record_id = ${recordId}
    `);

    const rows = result.rows as any[];
    if (!rows.length) return null;

    await this.logSecurityEvent({
      orgId,
      eventType: 'pii_access',
      severity: 'info',
      metadata: { action: 'decrypt', tableName, fieldName, recordId },
    });

    return this.decryptPII(rows[0].encrypted_value);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Security Event Logging
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Log a security event to the immutable security_audit_log table.
   */
  async logSecurityEvent(event: SecurityEvent): Promise<string> {
    const id = crypto.randomUUID();

    await db.execute(sql`
      INSERT INTO security_audit_log (
        id, org_id, user_id, event_type,
        ip_address, user_agent, metadata,
        severity, created_at
      ) VALUES (
        ${id},
        ${event.orgId},
        ${event.userId || null},
        ${event.eventType},
        ${event.ipAddress || null},
        ${event.userAgent || null},
        ${event.metadata ? JSON.stringify(event.metadata) : null},
        ${event.severity || 'info'},
        NOW()
      )
    `);

    return id;
  }

  /**
   * Query security events for an organization with optional filters.
   */
  async getSecurityEvents(
    orgId: string,
    filters: SecurityEventFilters = {}
  ): Promise<SecurityEvent[]> {
    const limit = filters.limit || 100;
    const offset = filters.offset || 0;

    // Build dynamic WHERE clauses
    const conditions: string[] = ['org_id = $1'];
    const params: any[] = [orgId];
    let paramIdx = 2;

    if (filters.eventType) {
      conditions.push(`event_type = $${paramIdx}`);
      params.push(filters.eventType);
      paramIdx++;
    }
    if (filters.severity) {
      conditions.push(`severity = $${paramIdx}`);
      params.push(filters.severity);
      paramIdx++;
    }
    if (filters.startDate) {
      conditions.push(`created_at >= $${paramIdx}`);
      params.push(filters.startDate);
      paramIdx++;
    }
    if (filters.endDate) {
      conditions.push(`created_at <= $${paramIdx}`);
      params.push(filters.endDate);
      paramIdx++;
    }

    // Use parameterized Drizzle sql template for dynamic filtering
    const whereClause = conditions.join(' AND ');
    const result = await db.execute(sql`
      SELECT id, org_id, user_id, event_type, ip_address, user_agent,
             metadata, severity, created_at
      FROM security_audit_log
      WHERE org_id = ${orgId}
        AND (${filters.eventType ? sql`event_type = ${filters.eventType}` : sql`TRUE`})
        AND (${filters.severity ? sql`severity = ${filters.severity}` : sql`TRUE`})
        AND (${filters.startDate ? sql`created_at >= ${filters.startDate.toISOString()}` : sql`TRUE`})
        AND (${filters.endDate ? sql`created_at <= ${filters.endDate.toISOString()}` : sql`TRUE`})
      ORDER BY created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `);

    return (result.rows as any[]).map(row => ({
      id: row.id,
      orgId: row.org_id,
      userId: row.user_id,
      eventType: row.event_type,
      ipAddress: row.ip_address,
      userAgent: row.user_agent,
      metadata: row.metadata,
      severity: row.severity,
      createdAt: row.created_at,
    }));
  }

  /**
   * Get all security events for a specific user across all orgs.
   */
  async getSecurityEventsByUser(
    userId: string,
    limit: number = 100
  ): Promise<SecurityEvent[]> {
    const result = await db.execute(sql`
      SELECT id, org_id, user_id, event_type, ip_address, user_agent,
             metadata, severity, created_at
      FROM security_audit_log
      WHERE user_id = ${userId}
      ORDER BY created_at DESC
      LIMIT ${limit}
    `);

    return (result.rows as any[]).map(row => ({
      id: row.id,
      orgId: row.org_id,
      userId: row.user_id,
      eventType: row.event_type,
      ipAddress: row.ip_address,
      userAgent: row.user_agent,
      metadata: row.metadata,
      severity: row.severity,
      createdAt: row.created_at,
    }));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Session Management
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Enforce max concurrent sessions for a user. Evicts oldest sessions
   * if the limit is exceeded.
   */
  async enforceSessionLimits(
    userId: string,
    maxSessions: number = 5
  ): Promise<{ evicted: number; activeSessions: number }> {
    // Count active sessions
    const countResult = await db.execute(sql`
      SELECT COUNT(*) as cnt FROM user_sessions
      WHERE user_id = ${userId} AND expires_at > NOW() AND revoked = false
    `);
    const activeCount = parseInt((countResult.rows as any[])[0]?.cnt || '0', 10);

    let evicted = 0;
    if (activeCount >= maxSessions) {
      // Evict oldest sessions beyond the limit (keep maxSessions - 1 to make room)
      const toEvict = activeCount - maxSessions + 1;
      const evictResult = await db.execute(sql`
        UPDATE user_sessions SET revoked = true, revoked_reason = 'session_limit_exceeded'
        WHERE id IN (
          SELECT id FROM user_sessions
          WHERE user_id = ${userId} AND expires_at > NOW() AND revoked = false
          ORDER BY last_active_at ASC
          LIMIT ${toEvict}
        )
      `);
      evicted = toEvict;

      await this.logSecurityEvent({
        orgId: '',
        userId,
        eventType: 'session_invalidated',
        severity: 'info',
        metadata: { reason: 'session_limit_exceeded', evictedCount: evicted },
      });
    }

    return { evicted, activeSessions: activeCount - evicted };
  }

  /**
   * Force logout a specific session by ID.
   */
  async forceLogout(userId: string, sessionId: string): Promise<boolean> {
    const result = await db.execute(sql`
      UPDATE user_sessions SET revoked = true, revoked_reason = 'force_logout'
      WHERE id = ${sessionId} AND user_id = ${userId} AND revoked = false
    `);

    const affected = (result as any).rowCount || 0;
    if (affected > 0) {
      await this.logSecurityEvent({
        orgId: '',
        userId,
        eventType: 'session_invalidated',
        severity: 'warning',
        metadata: { sessionId, reason: 'force_logout' },
      });
    }

    return affected > 0;
  }

  /**
   * Get all active (non-revoked, non-expired) sessions for a user.
   */
  async getActiveSessions(userId: string): Promise<ActiveSession[]> {
    const result = await db.execute(sql`
      SELECT id, user_id, org_id, ip_address, user_agent, device_info,
             last_active_at, created_at, expires_at
      FROM user_sessions
      WHERE user_id = ${userId} AND expires_at > NOW() AND revoked = false
      ORDER BY last_active_at DESC
    `);

    return (result.rows as any[]).map(row => ({
      id: row.id,
      userId: row.user_id,
      orgId: row.org_id,
      ipAddress: row.ip_address,
      userAgent: row.user_agent,
      deviceInfo: row.device_info,
      lastActiveAt: row.last_active_at,
      createdAt: row.created_at,
      expiresAt: row.expires_at,
    }));
  }

  /**
   * Revoke all sessions for a user (e.g., after password change or compromise).
   */
  async revokeAllSessions(
    userId: string,
    reason: string = 'revoke_all'
  ): Promise<number> {
    const result = await db.execute(sql`
      UPDATE user_sessions SET revoked = true, revoked_reason = ${reason}
      WHERE user_id = ${userId} AND revoked = false
    `);

    const affected = (result as any).rowCount || 0;

    await this.logSecurityEvent({
      orgId: '',
      userId,
      eventType: 'session_invalidated',
      severity: 'critical',
      metadata: { reason, sessionsRevoked: affected },
    });

    return affected;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Data Retention
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Apply data retention policies for an org. Purges records older than
   * the configured retention period for each data type.
   */
  async applyRetentionPolicy(orgId: string): Promise<{
    purged: Record<string, number>;
    errors: string[];
  }> {
    const policies = await this.getRetentionPolicies(orgId);
    const purged: Record<string, number> = {};
    const errors: string[] = [];

    // Map data types to their corresponding tables and date columns
    const tableMap: Record<string, { table: string; dateColumn: string }> = {
      audit_logs: { table: 'security_audit_log', dateColumn: 'created_at' },
      activity_logs: { table: 'activity_log', dateColumn: 'created_at' },
      notifications: { table: 'notifications', dateColumn: 'created_at' },
      workflow_logs: { table: 'workflow_execution_log', dateColumn: 'executed_at' },
      login_history: { table: 'security_audit_log', dateColumn: 'created_at' },
    };

    for (const policy of policies) {
      const mapping = tableMap[policy.dataType];
      if (!mapping) {
        errors.push(`Unknown data type: ${policy.dataType}`);
        continue;
      }

      try {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - policy.retentionDays);

        const result = await db.execute(sql`
          DELETE FROM ${sql.raw(mapping.table)}
          WHERE org_id = ${orgId}
            AND ${sql.raw(mapping.dateColumn)} < ${cutoff}
        `);

        const deleted = (result as any).rowCount || 0;
        purged[policy.dataType] = deleted;

        // Update last applied timestamp
        await db.execute(sql`
          UPDATE data_retention_policies
          SET last_applied_at = NOW()
          WHERE id = ${policy.id}
        `);
      } catch (err: any) {
        errors.push(`${policy.dataType}: ${err.message}`);
      }
    }

    await this.logSecurityEvent({
      orgId,
      eventType: 'data_export',
      severity: 'info',
      metadata: { action: 'retention_policy_applied', purged, errors },
    });

    return { purged, errors };
  }

  /**
   * Get all retention policies for an org.
   */
  async getRetentionPolicies(orgId: string): Promise<RetentionPolicy[]> {
    const result = await db.execute(sql`
      SELECT id, org_id, data_type, retention_days, last_applied_at, created_at
      FROM data_retention_policies
      WHERE org_id = ${orgId}
      ORDER BY data_type ASC
    `);

    return (result.rows as any[]).map(row => ({
      id: row.id,
      orgId: row.org_id,
      dataType: row.data_type,
      retentionDays: row.retention_days,
      lastAppliedAt: row.last_applied_at,
      createdAt: row.created_at,
    }));
  }

  /**
   * Set or update a retention policy for a specific data type.
   */
  async setRetentionPolicy(
    orgId: string,
    dataType: string,
    retentionDays: number
  ): Promise<RetentionPolicy> {
    if (retentionDays < 1) {
      throw new Error('Retention period must be at least 1 day');
    }

    const id = crypto.randomUUID();

    await db.execute(sql`
      INSERT INTO data_retention_policies (id, org_id, data_type, retention_days, created_at)
      VALUES (${id}, ${orgId}, ${dataType}, ${retentionDays}, NOW())
      ON CONFLICT (org_id, data_type)
      DO UPDATE SET retention_days = ${retentionDays}
    `);

    return {
      id,
      orgId,
      dataType,
      retentionDays,
      createdAt: new Date(),
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // GDPR / CCPA Compliance
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Generate a full data export for a user (GDPR Article 20 / CCPA § 1798.100).
   * Collects all PII and user-associated data into a JSON structure.
   */
  async handleDataExportRequest(
    userId: string,
    orgId: string
  ): Promise<{ requestId: string; data: Record<string, any> }> {
    const requestId = crypto.randomUUID();

    // Gather user profile
    const userResult = await db.execute(sql`
      SELECT id, email, first_name, last_name, phone, created_at, last_login_at
      FROM users WHERE id = ${userId}
    `);
    const user = (userResult.rows as any[])[0] || {};

    // Gather user's deals
    const dealsResult = await db.execute(sql`
      SELECT id, name, status, asset_class, created_at
      FROM crm_deals WHERE org_id = ${orgId}
        AND (created_by = ${userId} OR assigned_to = ${userId})
    `);

    // Gather user's tasks
    const tasksResult = await db.execute(sql`
      SELECT id, title, status, due_date, created_at
      FROM tasks WHERE org_id = ${orgId} AND assigned_to = ${userId}
    `);

    // Gather user's contacts
    const contactsResult = await db.execute(sql`
      SELECT id, first_name, last_name, email, phone, company, created_at
      FROM crm_contacts WHERE org_id = ${orgId} AND created_by = ${userId}
    `);

    // Gather user's activity log
    const activityResult = await db.execute(sql`
      SELECT id, action, entity_type, entity_id, created_at
      FROM activity_log WHERE org_id = ${orgId} AND user_id = ${userId}
      ORDER BY created_at DESC LIMIT 1000
    `);

    // Gather consent records
    const consents = await this.getConsentRecords(userId);

    // Gather security events
    const securityEvents = await this.getSecurityEventsByUser(userId, 500);

    const exportData = {
      exportMeta: {
        requestId,
        exportedAt: new Date().toISOString(),
        userId,
        orgId,
        format: 'GDPR_CCPA_EXPORT_V1',
      },
      profile: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        phone: user.phone,
        createdAt: user.created_at,
        lastLoginAt: user.last_login_at,
      },
      deals: (dealsResult.rows as any[]).map(d => ({
        id: d.id,
        name: d.name,
        status: d.status,
        assetClass: d.asset_class,
        createdAt: d.created_at,
      })),
      tasks: (tasksResult.rows as any[]).map(t => ({
        id: t.id,
        title: t.title,
        status: t.status,
        dueDate: t.due_date,
        createdAt: t.created_at,
      })),
      contacts: (contactsResult.rows as any[]).map(c => ({
        id: c.id,
        firstName: c.first_name,
        lastName: c.last_name,
        email: c.email,
        phone: c.phone,
        company: c.company,
        createdAt: c.created_at,
      })),
      activityLog: (activityResult.rows as any[]).map(a => ({
        id: a.id,
        action: a.action,
        entityType: a.entity_type,
        entityId: a.entity_id,
        createdAt: a.created_at,
      })),
      consents,
      securityEvents: securityEvents.slice(0, 200),
    };

    // Log the export request
    await this.logSecurityEvent({
      orgId,
      userId,
      eventType: 'data_export',
      severity: 'warning',
      metadata: { requestId, type: 'gdpr_data_export' },
    });

    // Record the export request
    await db.execute(sql`
      INSERT INTO data_subject_requests (id, user_id, org_id, request_type, status, created_at)
      VALUES (${requestId}, ${userId}, ${orgId}, 'export', 'completed', NOW())
    `);

    return { requestId, data: exportData };
  }

  /**
   * Handle a data deletion request (GDPR Article 17 / CCPA § 1798.105).
   * Anonymizes PII but retains aggregate/financial data for compliance.
   */
  async handleDataDeletionRequest(
    userId: string,
    orgId: string
  ): Promise<{ requestId: string; anonymizedRecords: number }> {
    const requestId = crypto.randomUUID();
    let anonymizedRecords = 0;

    // Anonymize user profile — replace PII with anonymous tokens
    const anonToken = `DELETED_${crypto.randomBytes(8).toString('hex')}`;
    await db.execute(sql`
      UPDATE users SET
        email = ${`${anonToken}@deleted.local`},
        first_name = 'Deleted',
        last_name = 'User',
        phone = NULL,
        totp_secret = NULL,
        totp_recovery_codes = NULL,
        deleted_at = NOW(),
        deletion_request_id = ${requestId}
      WHERE id = ${userId}
    `);
    anonymizedRecords++;

    // Anonymize contacts created by this user
    const contactResult = await db.execute(sql`
      UPDATE crm_contacts SET
        first_name = 'Anonymized',
        last_name = 'Contact',
        email = NULL,
        phone = NULL,
        notes = NULL
      WHERE org_id = ${orgId} AND created_by = ${userId}
    `);
    anonymizedRecords += (contactResult as any).rowCount || 0;

    // Delete encrypted PII fields for this user
    await db.execute(sql`
      DELETE FROM encrypted_fields
      WHERE org_id = ${orgId} AND record_id = ${userId}
    `);

    // Revoke all sessions
    await this.revokeAllSessions(userId, 'data_deletion_request');

    // Revoke all consents
    await db.execute(sql`
      UPDATE user_consents SET revoked_at = NOW()
      WHERE user_id = ${userId} AND revoked_at IS NULL
    `);

    // Log the deletion
    await this.logSecurityEvent({
      orgId,
      userId: 'system',
      eventType: 'pii_access',
      severity: 'critical',
      metadata: {
        requestId,
        type: 'gdpr_data_deletion',
        targetUserId: userId,
        anonymizedRecords,
      },
    });

    // Record the deletion request
    await db.execute(sql`
      INSERT INTO data_subject_requests (id, user_id, org_id, request_type, status, created_at)
      VALUES (${requestId}, ${userId}, ${orgId}, 'deletion', 'completed', NOW())
    `);

    return { requestId, anonymizedRecords };
  }

  /**
   * Get all consent records for a user.
   */
  async getConsentRecords(userId: string): Promise<ConsentRecord[]> {
    const result = await db.execute(sql`
      SELECT id, user_id, consent_type, granted, ip_address, user_agent,
             granted_at, revoked_at
      FROM user_consents
      WHERE user_id = ${userId}
      ORDER BY granted_at DESC
    `);

    return (result.rows as any[]).map(row => ({
      id: row.id,
      userId: row.user_id,
      consentType: row.consent_type,
      granted: row.granted,
      ipAddress: row.ip_address,
      userAgent: row.user_agent,
      grantedAt: row.granted_at,
      revokedAt: row.revoked_at,
    }));
  }

  /**
   * Record a consent decision (grant or revoke).
   */
  async recordConsent(
    userId: string,
    consentType: string,
    granted: boolean,
    ipAddress?: string,
    userAgent?: string
  ): Promise<ConsentRecord> {
    const id = crypto.randomUUID();

    if (granted) {
      // Revoke any existing consent of this type first
      await db.execute(sql`
        UPDATE user_consents SET revoked_at = NOW()
        WHERE user_id = ${userId} AND consent_type = ${consentType} AND revoked_at IS NULL
      `);

      await db.execute(sql`
        INSERT INTO user_consents (id, user_id, consent_type, granted, ip_address, user_agent, granted_at)
        VALUES (${id}, ${userId}, ${consentType}, true, ${ipAddress || null}, ${userAgent || null}, NOW())
      `);
    } else {
      // Revoke existing consent
      await db.execute(sql`
        UPDATE user_consents SET revoked_at = NOW()
        WHERE user_id = ${userId} AND consent_type = ${consentType} AND revoked_at IS NULL
      `);
    }

    return {
      id,
      userId,
      consentType,
      granted,
      ipAddress,
      userAgent,
      grantedAt: new Date(),
      revokedAt: granted ? undefined : new Date(),
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // IP Allowlisting
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Check if an IP address is within the org's allowlist.
   * Returns true if no allowlist is configured (open access) or if the IP matches.
   */
  async checkIpAllowlist(orgId: string, ip: string): Promise<boolean> {
    const result = await db.execute(sql`
      SELECT cidrs FROM ip_allowlists WHERE org_id = ${orgId}
    `);

    const rows = result.rows as any[];
    if (!rows.length) return true; // No allowlist = open access

    const cidrs: string[] = rows[0].cidrs || [];
    if (cidrs.length === 0) return true;

    return cidrs.some(cidr => this.isIpInCidr(ip, cidr));
  }

  /**
   * Set the IP allowlist for an org. Replaces the entire list.
   */
  async setIpAllowlist(orgId: string, cidrs: string[]): Promise<void> {
    // Validate CIDR formats
    for (const cidr of cidrs) {
      if (!this.isValidCidr(cidr)) {
        throw new Error(`Invalid CIDR notation: ${cidr}`);
      }
    }

    const id = crypto.randomUUID();

    await db.execute(sql`
      INSERT INTO ip_allowlists (id, org_id, cidrs, updated_at)
      VALUES (${id}, ${orgId}, ${JSON.stringify(cidrs)}, NOW())
      ON CONFLICT (org_id)
      DO UPDATE SET cidrs = ${JSON.stringify(cidrs)}, updated_at = NOW()
    `);

    await this.logSecurityEvent({
      orgId,
      eventType: 'permission_changed',
      severity: 'warning',
      metadata: { action: 'ip_allowlist_updated', cidrCount: cidrs.length },
    });
  }

  /**
   * Get the current IP allowlist for an org.
   */
  async getIpAllowlist(orgId: string): Promise<string[]> {
    const result = await db.execute(sql`
      SELECT cidrs FROM ip_allowlists WHERE org_id = ${orgId}
    `);

    const rows = result.rows as any[];
    if (!rows.length) return [];
    return rows[0].cidrs || [];
  }

  /**
   * Check if an IPv4 address falls within a CIDR range.
   */
  private isIpInCidr(ip: string, cidr: string): boolean {
    // Handle exact IP match (no subnet)
    if (!cidr.includes('/')) {
      return ip === cidr;
    }

    const [cidrIp, prefixStr] = cidr.split('/');
    const prefix = parseInt(prefixStr, 10);

    const ipNum = this.ipToNumber(ip);
    const cidrNum = this.ipToNumber(cidrIp);
    const mask = (~0 << (32 - prefix)) >>> 0;

    return (ipNum & mask) === (cidrNum & mask);
  }

  private ipToNumber(ip: string): number {
    const parts = ip.split('.').map(Number);
    return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
  }

  private isValidCidr(cidr: string): boolean {
    const cidrRegex = /^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/;
    if (!cidrRegex.test(cidr)) return false;

    const [ip, prefixStr] = cidr.split('/');
    const parts = ip.split('.').map(Number);
    if (parts.some(p => p < 0 || p > 255)) return false;
    if (prefixStr !== undefined) {
      const prefix = parseInt(prefixStr, 10);
      if (prefix < 0 || prefix > 32) return false;
    }
    return true;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // AML / KYC Verification
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Initiate a KYC check for an investor. Creates a pending verification record
   * and logs the initiation. In production, this would trigger an external
   * verification service (Onfido, Jumio, etc.).
   */
  async initiateKycCheck(
    investorId: string,
    orgId: string,
    data: {
      fullName: string;
      dateOfBirth: string;
      nationality: string;
      documentType: string;
      documentNumber: string;
      address?: string;
    }
  ): Promise<KycCheckResult> {
    const id = crypto.randomUUID();

    // Encrypt sensitive fields before storage
    const encryptedDocNumber = this.encryptPII(data.documentNumber);
    const encryptedDob = this.encryptPII(data.dateOfBirth);

    const verificationData = {
      fullName: data.fullName,
      nationality: data.nationality,
      documentType: data.documentType,
      documentNumberEncrypted: encryptedDocNumber,
      dateOfBirthEncrypted: encryptedDob,
      address: data.address || null,
    };

    await db.execute(sql`
      INSERT INTO kyc_verifications (
        id, investor_id, org_id, status, check_type,
        verification_data, expires_at, created_at, updated_at
      ) VALUES (
        ${id}, ${investorId}, ${orgId}, 'pending', 'identity',
        ${JSON.stringify(verificationData)},
        ${new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()},
        NOW(), NOW()
      )
    `);

    await this.logSecurityEvent({
      orgId,
      eventType: 'pii_access',
      severity: 'info',
      metadata: {
        action: 'kyc_check_initiated',
        investorId,
        checkType: 'identity',
        documentType: data.documentType,
      },
    });

    return {
      id,
      investorId,
      orgId,
      status: 'pending',
      checkType: 'identity',
      verificationData,
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  /**
   * Get the current KYC verification status for an investor.
   */
  async getKycStatus(
    investorId: string
  ): Promise<KycCheckResult[]> {
    const result = await db.execute(sql`
      SELECT id, investor_id, org_id, status, check_type,
             verification_data, expires_at, created_at, updated_at
      FROM kyc_verifications
      WHERE investor_id = ${investorId}
      ORDER BY created_at DESC
    `);

    return (result.rows as any[]).map(row => ({
      id: row.id,
      investorId: row.investor_id,
      orgId: row.org_id,
      status: row.status,
      checkType: row.check_type,
      verificationData: row.verification_data,
      expiresAt: row.expires_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  /**
   * Record an accreditation verification for an investor.
   * Accreditation is separate from identity KYC and must be re-verified periodically.
   */
  async recordAccreditationVerification(
    investorId: string,
    orgId: string,
    data: {
      verificationType: 'income' | 'net_worth' | 'professional' | 'entity';
      verifiedBy: string;
      verificationMethod: string;
      expirationDate: string;
      notes?: string;
    }
  ): Promise<KycCheckResult> {
    const id = crypto.randomUUID();

    const verificationData = {
      verificationType: data.verificationType,
      verifiedBy: data.verifiedBy,
      verificationMethod: data.verificationMethod,
      notes: data.notes || null,
    };

    const expiresAt = new Date(data.expirationDate);

    await db.execute(sql`
      INSERT INTO kyc_verifications (
        id, investor_id, org_id, status, check_type,
        verification_data, expires_at, created_at, updated_at
      ) VALUES (
        ${id}, ${investorId}, ${orgId}, 'approved', 'accreditation',
        ${JSON.stringify(verificationData)},
        ${expiresAt.toISOString()},
        NOW(), NOW()
      )
    `);

    // Also update the investor record's accreditation status
    await db.execute(sql`
      UPDATE fund_investors SET
        accreditation_status = 'verified',
        accreditation_verified_at = NOW(),
        accreditation_expires_at = ${expiresAt.toISOString()}
      WHERE id = ${investorId}
    `);

    await this.logSecurityEvent({
      orgId,
      eventType: 'pii_access',
      severity: 'info',
      metadata: {
        action: 'accreditation_verified',
        investorId,
        verificationType: data.verificationType,
        verificationMethod: data.verificationMethod,
        expiresAt: data.expirationDate,
      },
    });

    return {
      id,
      investorId,
      orgId,
      status: 'approved',
      checkType: 'accreditation',
      verificationData,
      expiresAt,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  /**
   * Check if an investor's accreditation is currently valid.
   */
  async isAccreditationValid(investorId: string): Promise<{
    valid: boolean;
    expiresAt?: Date;
    checkType?: string;
  }> {
    const result = await db.execute(sql`
      SELECT status, expires_at, check_type FROM kyc_verifications
      WHERE investor_id = ${investorId}
        AND check_type = 'accreditation'
        AND status = 'approved'
        AND expires_at > NOW()
      ORDER BY expires_at DESC
      LIMIT 1
    `);

    const rows = result.rows as any[];
    if (!rows.length) {
      return { valid: false };
    }

    return {
      valid: true,
      expiresAt: rows[0].expires_at,
      checkType: rows[0].check_type,
    };
  }
}

// ─── Singleton Export ──────────────────────────────────────────────────────

export const securityService = new SecurityComplianceService();
