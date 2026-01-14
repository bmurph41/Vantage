import { db } from '../db';
import { 
  users, organizations, ssoConfigurations, userSessions, securityAuditLog, passwordResetTokens,
  type User, type Organization, type SsoConfiguration, type UserSession
} from '@shared/schema';
import { eq, and, gt, lt, isNull } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcrypt';
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import { logger } from '../lib/logger';

const SALT_ROUNDS = 12;
const SESSION_DURATION_MS = 8 * 60 * 60 * 1000; // 8 hours default
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes
const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes idle timeout
const PASSWORD_RESET_EXPIRY_MS = 60 * 60 * 1000; // 1 hour

export interface AuthResult {
  success: boolean;
  user?: User;
  session?: UserSession;
  requiresMfa?: boolean;
  mfaToken?: string;
  error?: string;
  errorCode?: string;
}

export interface DeviceInfo {
  deviceType?: string;
  browser?: string;
  os?: string;
  ipAddress?: string;
  userAgent?: string;
  location?: string;
}

export class EnterpriseAuthService {
  
  async authenticateWithPassword(
    email: string, 
    password: string, 
    deviceInfo: DeviceInfo
  ): Promise<AuthResult> {
    try {
      const user = await this.getUserByEmail(email);
      
      if (!user) {
        await this.logSecurityEvent(null, null, 'login_failure', { 
          reason: 'user_not_found', email 
        }, deviceInfo, false);
        return { success: false, error: 'Invalid credentials', errorCode: 'INVALID_CREDENTIALS' };
      }

      // Check if account is locked
      if (user.lockedUntil && new Date(user.lockedUntil) > new Date()) {
        await this.logSecurityEvent(user.id, user.orgId, 'login_failure', { 
          reason: 'account_locked' 
        }, deviceInfo, false);
        return { success: false, error: 'Account is temporarily locked', errorCode: 'ACCOUNT_LOCKED' };
      }

      // Check if SSO is enforced
      const org = await this.getOrganization(user.orgId);
      if (org?.ssoEnforced && org?.ssoEnabled) {
        return { success: false, error: 'SSO authentication required', errorCode: 'SSO_REQUIRED' };
      }

      // Verify password
      if (!user.passwordHash) {
        return { success: false, error: 'Password login not available', errorCode: 'NO_PASSWORD' };
      }

      const isValid = await bcrypt.compare(password, user.passwordHash);
      
      if (!isValid) {
        await this.incrementFailedAttempts(user.id);
        await this.logSecurityEvent(user.id, user.orgId, 'login_failure', { 
          reason: 'invalid_password' 
        }, deviceInfo, false);
        return { success: false, error: 'Invalid credentials', errorCode: 'INVALID_CREDENTIALS' };
      }

      // Reset failed attempts on successful auth
      await this.resetFailedAttempts(user.id);

      // Check if MFA is required
      if (user.mfaEnabled || org?.mfaRequired) {
        const mfaToken = uuidv4();
        await this.logSecurityEvent(user.id, user.orgId, 'mfa_required', {}, deviceInfo, true);
        return { 
          success: true, 
          requiresMfa: true, 
          mfaToken,
          user
        };
      }

      // Create session
      const session = await this.createSession(user, deviceInfo, org?.sessionTimeoutMinutes);
      await this.updateLastLogin(user.id);
      await this.logSecurityEvent(user.id, user.orgId, 'login_success', { 
        method: 'password' 
      }, deviceInfo, true);

      return { success: true, user, session };
    } catch (error) {
      logger.error({ error }, 'Authentication error');
      return { success: false, error: 'Authentication failed', errorCode: 'AUTH_ERROR' };
    }
  }

  async authenticateWithSso(
    ssoSubjectId: string,
    email: string,
    name: string,
    orgId: string,
    provider: string,
    deviceInfo: DeviceInfo,
    additionalAttributes?: Record<string, any>
  ): Promise<AuthResult> {
    try {
      // Check if user exists by SSO subject ID or email
      let user = await db.query.users.findFirst({
        where: and(
          eq(users.ssoSubjectId, ssoSubjectId),
          eq(users.orgId, orgId)
        )
      });

      const org = await this.getOrganization(orgId);
      const ssoConfig = await this.getSsoConfiguration(orgId);

      if (!user) {
        // Try to find by email
        user = await db.query.users.findFirst({
          where: and(eq(users.email, email), eq(users.orgId, orgId))
        });

        if (user) {
          // Link SSO to existing user
          await db.update(users)
            .set({ 
              ssoSubjectId, 
              ssoProvider: provider as any,
              name: name || user.name
            })
            .where(eq(users.id, user.id));
        } else if (ssoConfig?.jitProvisioningEnabled) {
          // JIT provision new user
          const emailDomain = email.split('@')[1];
          if (org?.allowedEmailDomains && !org.allowedEmailDomains.includes(emailDomain)) {
            await this.logSecurityEvent(null, orgId, 'sso_login_failure', { 
              reason: 'domain_not_allowed', email 
            }, deviceInfo, false);
            return { success: false, error: 'Email domain not allowed', errorCode: 'DOMAIN_NOT_ALLOWED' };
          }

          const [newUser] = await db.insert(users)
            .values({
              orgId,
              email,
              name: name || email.split('@')[0],
              ssoSubjectId,
              ssoProvider: provider as any,
              role: (ssoConfig.defaultRole || 'viewer') as any,
              isActive: true,
            })
            .returning();
          
          user = newUser;
          await this.logSecurityEvent(user.id, orgId, 'user_provisioned', { 
            method: 'sso_jit', provider 
          }, deviceInfo, true);
        } else {
          await this.logSecurityEvent(null, orgId, 'sso_login_failure', { 
            reason: 'user_not_found', email 
          }, deviceInfo, false);
          return { success: false, error: 'User not found', errorCode: 'USER_NOT_FOUND' };
        }
      }

      if (!user!.isActive) {
        await this.logSecurityEvent(user!.id, orgId, 'sso_login_failure', { 
          reason: 'account_disabled' 
        }, deviceInfo, false);
        return { success: false, error: 'Account is disabled', errorCode: 'ACCOUNT_DISABLED' };
      }

      // Check MFA
      if (user!.mfaEnabled || org?.mfaRequired) {
        const mfaToken = uuidv4();
        return { 
          success: true, 
          requiresMfa: true, 
          mfaToken,
          user: user!
        };
      }

      const session = await this.createSession(user!, deviceInfo, org?.sessionTimeoutMinutes);
      await this.updateLastLogin(user!.id);
      await this.logSecurityEvent(user!.id, orgId, 'sso_login_success', { 
        provider 
      }, deviceInfo, true);

      return { success: true, user: user!, session };
    } catch (error) {
      logger.error({ error }, 'SSO authentication error');
      return { success: false, error: 'SSO authentication failed', errorCode: 'SSO_ERROR' };
    }
  }

  async verifyMfa(
    userId: string, 
    token: string, 
    deviceInfo: DeviceInfo
  ): Promise<AuthResult> {
    try {
      const user = await this.getUserById(userId);
      if (!user) {
        return { success: false, error: 'User not found', errorCode: 'USER_NOT_FOUND' };
      }

      if (!user.mfaSecret) {
        return { success: false, error: 'MFA not configured', errorCode: 'MFA_NOT_CONFIGURED' };
      }

      const isValid = speakeasy.totp.verify({
        secret: user.mfaSecret,
        encoding: 'base32',
        token,
        window: 1
      });

      if (!isValid) {
        // Check backup codes
        if (user.mfaBackupCodes?.includes(token)) {
          // Remove used backup code
          await db.update(users)
            .set({ 
              mfaBackupCodes: user.mfaBackupCodes.filter(c => c !== token) 
            })
            .where(eq(users.id, userId));
        } else {
          await this.logSecurityEvent(userId, user.orgId, 'mfa_failure', {}, deviceInfo, false);
          return { success: false, error: 'Invalid MFA code', errorCode: 'INVALID_MFA' };
        }
      }

      const org = await this.getOrganization(user.orgId);
      const session = await this.createSession(user, deviceInfo, org?.sessionTimeoutMinutes);
      await this.updateLastLogin(userId);
      await this.logSecurityEvent(userId, user.orgId, 'mfa_success', {}, deviceInfo, true);

      return { success: true, user, session };
    } catch (error) {
      logger.error({ error }, 'MFA verification error');
      return { success: false, error: 'MFA verification failed', errorCode: 'MFA_ERROR' };
    }
  }

  async setupMfa(userId: string): Promise<{ secret: string; qrCode: string; backupCodes: string[] }> {
    const user = await this.getUserById(userId);
    if (!user) throw new Error('User not found');

    const secret = speakeasy.generateSecret({
      name: `MarinaMatch (${user.email})`,
      length: 32
    });

    const qrCode = await QRCode.toDataURL(secret.otpauth_url!);
    const backupCodes = Array.from({ length: 10 }, () => 
      Math.random().toString(36).substring(2, 10).toUpperCase()
    );

    // Store temporarily - will be confirmed when user verifies first code
    await db.update(users)
      .set({ 
        mfaSecret: secret.base32,
        mfaBackupCodes: backupCodes,
        mfaMethod: 'totp'
      })
      .where(eq(users.id, userId));

    return { secret: secret.base32, qrCode, backupCodes };
  }

  async enableMfa(userId: string, token: string): Promise<boolean> {
    const user = await this.getUserById(userId);
    if (!user || !user.mfaSecret) return false;

    const isValid = speakeasy.totp.verify({
      secret: user.mfaSecret,
      encoding: 'base32',
      token,
      window: 1
    });

    if (isValid) {
      await db.update(users)
        .set({ mfaEnabled: true })
        .where(eq(users.id, userId));
      
      await this.logSecurityEvent(userId, user.orgId, 'mfa_enabled', {}, {}, true);
      return true;
    }

    return false;
  }

  async disableMfa(userId: string): Promise<void> {
    const user = await this.getUserById(userId);
    if (!user) throw new Error('User not found');

    await db.update(users)
      .set({ 
        mfaEnabled: false,
        mfaSecret: null,
        mfaBackupCodes: null,
        mfaMethod: null
      })
      .where(eq(users.id, userId));

    await this.logSecurityEvent(userId, user.orgId, 'mfa_disabled', {}, {}, true);
  }

  async createSession(
    user: User, 
    deviceInfo: DeviceInfo, 
    timeoutMinutes?: number | null
  ): Promise<UserSession> {
    const sessionDuration = (timeoutMinutes || 480) * 60 * 1000;
    const expiresAt = new Date(Date.now() + sessionDuration);
    const sessionToken = uuidv4();

    const [session] = await db.insert(userSessions)
      .values({
        userId: user.id,
        orgId: user.orgId,
        sessionToken,
        status: 'active',
        deviceType: deviceInfo.deviceType,
        browser: deviceInfo.browser,
        os: deviceInfo.os,
        ipAddress: deviceInfo.ipAddress,
        userAgent: deviceInfo.userAgent,
        location: deviceInfo.location,
        expiresAt,
        lastActivityAt: new Date(),
      })
      .returning();

    return session;
  }

  async validateSession(sessionToken: string): Promise<{ user: User; session: UserSession } | null> {
    const session = await db.query.userSessions.findFirst({
      where: and(
        eq(userSessions.sessionToken, sessionToken),
        eq(userSessions.status, 'active'),
        gt(userSessions.expiresAt, new Date())
      )
    });

    if (!session) return null;

    const user = await this.getUserById(session.userId);
    if (!user || !user.isActive) return null;

    const org = await this.getOrganization(user.orgId);
    const idleTimeout = org?.sessionTimeoutMinutes 
      ? Math.min(org.sessionTimeoutMinutes * 60 * 1000, IDLE_TIMEOUT_MS) 
      : IDLE_TIMEOUT_MS;
    
    const lastActivity = new Date(session.lastActivityAt).getTime();
    const now = Date.now();
    
    if (now - lastActivity > idleTimeout) {
      await db.update(userSessions)
        .set({ 
          status: 'expired',
          revokedAt: new Date()
        })
        .where(eq(userSessions.id, session.id));
      
      logger.info({ 
        sessionId: session.id, 
        userId: user.id,
        idleMinutes: Math.floor((now - lastActivity) / 60000)
      }, 'Session expired due to idle timeout');
      
      return null;
    }

    await db.update(userSessions)
      .set({ lastActivityAt: new Date() })
      .where(eq(userSessions.id, session.id));

    return { user, session };
  }

  async revokeSession(sessionId: string, userId: string): Promise<void> {
    await db.update(userSessions)
      .set({ 
        status: 'revoked',
        revokedAt: new Date()
      })
      .where(and(
        eq(userSessions.id, sessionId),
        eq(userSessions.userId, userId)
      ));

    const user = await this.getUserById(userId);
    if (user) {
      await this.logSecurityEvent(userId, user.orgId, 'session_revoked', { 
        sessionId 
      }, {}, true);
    }
  }

  async revokeAllSessions(userId: string, exceptSessionId?: string): Promise<void> {
    const conditions = [
      eq(userSessions.userId, userId),
      eq(userSessions.status, 'active')
    ];

    await db.update(userSessions)
      .set({ 
        status: 'revoked',
        revokedAt: new Date()
      })
      .where(and(...conditions));

    const user = await this.getUserById(userId);
    if (user) {
      await this.logSecurityEvent(userId, user.orgId, 'all_sessions_revoked', { 
        exceptSessionId 
      }, {}, true);
    }
  }

  async getUserSessions(userId: string): Promise<UserSession[]> {
    return db.query.userSessions.findMany({
      where: and(
        eq(userSessions.userId, userId),
        eq(userSessions.status, 'active'),
        gt(userSessions.expiresAt, new Date())
      ),
      orderBy: (sessions, { desc }) => [desc(sessions.lastActivityAt)]
    });
  }

  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, SALT_ROUNDS);
  }

  async updatePassword(userId: string, newPassword: string): Promise<void> {
    const passwordHash = await this.hashPassword(newPassword);
    await db.update(users)
      .set({ passwordHash })
      .where(eq(users.id, userId));

    const user = await this.getUserById(userId);
    if (user) {
      await this.logSecurityEvent(userId, user.orgId, 'password_changed', {}, {}, true);
    }
  }

  // SSO Configuration Methods
  async getSsoConfiguration(orgId: string): Promise<SsoConfiguration | undefined> {
    return db.query.ssoConfigurations.findFirst({
      where: eq(ssoConfigurations.orgId, orgId)
    });
  }

  async saveSsoConfiguration(orgId: string, config: Partial<SsoConfiguration>): Promise<SsoConfiguration> {
    const existing = await this.getSsoConfiguration(orgId);
    
    if (existing) {
      const [updated] = await db.update(ssoConfigurations)
        .set({ ...config, updatedAt: new Date() })
        .where(eq(ssoConfigurations.orgId, orgId))
        .returning();
      return updated;
    } else {
      const [created] = await db.insert(ssoConfigurations)
        .values({ 
          orgId, 
          ...config,
          provider: config.provider || 'okta'
        } as any)
        .returning();
      return created;
    }
  }

  async testSsoConfiguration(orgId: string): Promise<{ success: boolean; error?: string }> {
    const config = await this.getSsoConfiguration(orgId);
    if (!config) {
      return { success: false, error: 'No SSO configuration found' };
    }

    // Validate required fields
    if (!config.ssoUrl || !config.certificate) {
      return { success: false, error: 'Missing required SSO configuration fields' };
    }

    await db.update(ssoConfigurations)
      .set({ lastTestedAt: new Date() })
      .where(eq(ssoConfigurations.orgId, orgId));

    return { success: true };
  }

  // Helper Methods
  private async getUserByEmail(email: string): Promise<User | undefined> {
    return db.query.users.findFirst({
      where: eq(users.email, email.toLowerCase())
    });
  }

  private async getUserById(id: string): Promise<User | undefined> {
    return db.query.users.findFirst({
      where: eq(users.id, id)
    });
  }

  private async getOrganization(orgId: string): Promise<Organization | undefined> {
    return db.query.organizations.findFirst({
      where: eq(organizations.id, orgId)
    });
  }

  private async incrementFailedAttempts(userId: string): Promise<void> {
    const user = await this.getUserById(userId);
    if (!user) return;

    const attempts = (user.failedLoginAttempts || 0) + 1;
    const updates: Partial<User> = { failedLoginAttempts: attempts };

    if (attempts >= MAX_LOGIN_ATTEMPTS) {
      updates.lockedUntil = new Date(Date.now() + LOCKOUT_DURATION_MS);
    }

    await db.update(users)
      .set(updates as any)
      .where(eq(users.id, userId));
  }

  private async resetFailedAttempts(userId: string): Promise<void> {
    await db.update(users)
      .set({ 
        failedLoginAttempts: 0,
        lockedUntil: null
      })
      .where(eq(users.id, userId));
  }

  private async updateLastLogin(userId: string): Promise<void> {
    await db.update(users)
      .set({ lastLoginAt: new Date() })
      .where(eq(users.id, userId));
  }

  private async logSecurityEvent(
    userId: string | null,
    orgId: string | null,
    eventType: string,
    eventDetails: Record<string, any>,
    deviceInfo: DeviceInfo,
    success: boolean
  ): Promise<void> {
    try {
      await db.insert(securityAuditLog).values({
        userId,
        orgId,
        eventType,
        eventDetails,
        ipAddress: deviceInfo.ipAddress,
        userAgent: deviceInfo.userAgent,
        success,
      });
    } catch (error) {
      logger.error({ error, eventType }, 'Failed to log security event');
    }
  }

  async getSecurityAuditLog(
    orgId: string, 
    filters?: {
      userId?: string;
      eventType?: string;
      startDate?: Date;
      endDate?: Date;
      limit?: number;
    }
  ): Promise<any[]> {
    return db.query.securityAuditLog.findMany({
      where: eq(securityAuditLog.orgId, orgId),
      orderBy: (log, { desc }) => [desc(log.createdAt)],
      limit: filters?.limit || 100
    });
  }

  async requestPasswordReset(email: string): Promise<void> {
    try {
      const user = await this.getUserByEmail(email);
      
      if (!user) {
        logger.info({ email }, 'Password reset requested for non-existent email');
        return;
      }

      await db.delete(passwordResetTokens)
        .where(eq(passwordResetTokens.userId, user.id));

      const token = uuidv4();
      const expiresAt = new Date(Date.now() + PASSWORD_RESET_EXPIRY_MS);

      await db.insert(passwordResetTokens).values({
        userId: user.id,
        token,
        expiresAt,
      });

      const resetUrl = `${process.env.APP_URL || 'http://localhost:5000'}/reset-password?token=${token}`;
      
      logger.info({ email, resetUrl }, 'Password reset token created');
      
      await this.logSecurityEvent(user.id, user.orgId, 'password_reset_requested', {
        email
      }, {}, true);

    } catch (error) {
      logger.error({ error, email }, 'Error requesting password reset');
      throw error;
    }
  }

  async resetPassword(token: string, newPassword: string): Promise<{ success: boolean; error?: string }> {
    try {
      const resetToken = await db.query.passwordResetTokens.findFirst({
        where: and(
          eq(passwordResetTokens.token, token),
          isNull(passwordResetTokens.usedAt),
          gt(passwordResetTokens.expiresAt, new Date())
        )
      });

      if (!resetToken) {
        logger.warn({ token: token.substring(0, 8) }, 'Invalid or expired password reset token');
        return { success: false, error: 'Invalid or expired reset link' };
      }

      const passwordHash = await this.hashPassword(newPassword);

      await db.update(users)
        .set({ passwordHash })
        .where(eq(users.id, resetToken.userId));

      await db.update(passwordResetTokens)
        .set({ usedAt: new Date() })
        .where(eq(passwordResetTokens.id, resetToken.id));

      await db.delete(userSessions)
        .where(eq(userSessions.userId, resetToken.userId));

      const user = await db.query.users.findFirst({
        where: eq(users.id, resetToken.userId)
      });

      if (user) {
        await this.logSecurityEvent(user.id, user.orgId, 'password_reset_completed', {}, {}, true);
      }

      logger.info({ userId: resetToken.userId }, 'Password reset completed successfully');
      return { success: true };

    } catch (error) {
      logger.error({ error }, 'Error resetting password');
      return { success: false, error: 'Password reset failed' };
    }
  }
}

export const enterpriseAuthService = new EnterpriseAuthService();
