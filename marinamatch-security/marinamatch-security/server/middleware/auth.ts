/**
 * MarinaMatch Authentication Middleware
 * 
 * Handles session validation, tenant context injection, and CSRF protection.
 * Works with cookie-based sessions.
 * 
 * INTEGRATION:
 * 1. Add to your Express app: app.use(authMiddleware())
 * 2. For protected routes: app.get('/api/data', requireAuth, handler)
 * 3. For CSRF protection on mutations: app.post('/api/data', requireAuth, csrfProtection, handler)
 */

import { Request, Response, NextFunction, RequestHandler } from 'express';
import { eq, and, gt } from 'drizzle-orm';
import { db } from '../db/client'; // Adjust import to your DB client
import { sessions, users, userRoles, roles, rolePermissions, permissions } from '../db/security-schema';
import { hashSessionToken, generateSecureToken, generateCsrfToken, secureCompare } from '../utils/encryption';
import { auditLog } from '../services/audit-logger';
import type { TenantContext, SessionData, UserWithRoles, RoleWithPermissions } from '../types/security';
import { AuthenticationError, SecurityError } from '../types/security';

// ============================================================================
// CONFIGURATION
// ============================================================================

export interface AuthConfig {
  cookieName: string;
  csrfHeaderName: string;
  csrfCookieName: string;
  sessionMaxAge: number; // milliseconds
  cookieSecure: boolean;
  cookieSameSite: 'strict' | 'lax' | 'none';
  cookieDomain?: string;
}

const defaultConfig: AuthConfig = {
  cookieName: 'mm_session',
  csrfHeaderName: 'x-csrf-token',
  csrfCookieName: 'mm_csrf',
  sessionMaxAge: 24 * 60 * 60 * 1000, // 24 hours
  cookieSecure: process.env.NODE_ENV === 'production',
  cookieSameSite: 'lax',
  cookieDomain: undefined,
};

let config: AuthConfig = { ...defaultConfig };

export function configureAuth(options: Partial<AuthConfig>): void {
  config = { ...defaultConfig, ...options };
}

// ============================================================================
// SESSION MANAGEMENT
// ============================================================================

/**
 * Create a new session for a user
 */
export async function createSession(
  userId: string,
  orgId: string,
  req: Request
): Promise<{ token: string; csrfToken: string; expiresAt: Date }> {
  const token = generateSecureToken(32);
  const tokenHash = hashSessionToken(token);
  const csrfToken = generateCsrfToken();
  const expiresAt = new Date(Date.now() + config.sessionMaxAge);

  await db.insert(sessions).values({
    userId,
    orgId,
    tokenHash,
    csrfToken,
    userAgent: req.headers['user-agent'] || null,
    ipAddress: getClientIp(req),
    expiresAt,
  });

  return { token, csrfToken, expiresAt };
}

/**
 * Validate a session token and return session data
 */
export async function validateSession(token: string): Promise<SessionData | null> {
  const tokenHash = hashSessionToken(token);

  const result = await db
    .select({
      id: sessions.id,
      userId: sessions.userId,
      orgId: sessions.orgId,
      csrfToken: sessions.csrfToken,
      expiresAt: sessions.expiresAt,
    })
    .from(sessions)
    .where(
      and(
        eq(sessions.tokenHash, tokenHash),
        gt(sessions.expiresAt, new Date())
      )
    )
    .limit(1);

  if (result.length === 0) {
    return null;
  }

  const session = result[0];

  // Update last activity
  await db
    .update(sessions)
    .set({ lastActivityAt: new Date() })
    .where(eq(sessions.id, session.id));

  return {
    userId: session.userId,
    orgId: session.orgId,
    sessionId: session.id,
    csrfToken: session.csrfToken,
    expiresAt: session.expiresAt,
  };
}

/**
 * Invalidate a session (logout)
 */
export async function invalidateSession(sessionId: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.id, sessionId));
}

/**
 * Invalidate all sessions for a user (force logout everywhere)
 */
export async function invalidateAllUserSessions(userId: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.userId, userId));
}

/**
 * Rotate session (new token, same session - use after privilege change)
 */
export async function rotateSession(
  sessionId: string,
  req: Request
): Promise<{ token: string; csrfToken: string }> {
  const newToken = generateSecureToken(32);
  const newTokenHash = hashSessionToken(newToken);
  const newCsrfToken = generateCsrfToken();

  await db
    .update(sessions)
    .set({
      tokenHash: newTokenHash,
      csrfToken: newCsrfToken,
      ipAddress: getClientIp(req),
      userAgent: req.headers['user-agent'] || null,
    })
    .where(eq(sessions.id, sessionId));

  return { token: newToken, csrfToken: newCsrfToken };
}

// ============================================================================
// USER AND PERMISSIONS LOADING
// ============================================================================

/**
 * Load user with roles and permissions
 */
export async function loadUserWithPermissions(userId: string): Promise<UserWithRoles | null> {
  // Get user
  const userResult = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (userResult.length === 0) {
    return null;
  }

  const user = userResult[0];

  // Get user's roles with permissions
  const userRolesResult = await db
    .select({
      roleId: roles.id,
      roleName: roles.name,
      roleDescription: roles.description,
      roleIsSystem: roles.isSystem,
      permissionId: permissions.id,
      permissionName: permissions.name,
      permissionResource: permissions.resource,
      permissionAction: permissions.action,
    })
    .from(userRoles)
    .innerJoin(roles, eq(userRoles.roleId, roles.id))
    .leftJoin(rolePermissions, eq(roles.id, rolePermissions.roleId))
    .leftJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
    .where(eq(userRoles.userId, userId));

  // Group by role
  const rolesMap = new Map<string, RoleWithPermissions>();

  for (const row of userRolesResult) {
    if (!rolesMap.has(row.roleId)) {
      rolesMap.set(row.roleId, {
        id: row.roleId,
        orgId: user.orgId,
        name: row.roleName,
        description: row.roleDescription,
        isSystem: row.roleIsSystem,
        createdAt: new Date(),
        updatedAt: new Date(),
        permissions: [],
      });
    }

    const role = rolesMap.get(row.roleId)!;
    if (row.permissionId) {
      role.permissions.push({
        id: row.permissionId,
        name: row.permissionName!,
        resource: row.permissionResource!,
        action: row.permissionAction!,
        description: null,
        createdAt: new Date(),
      });
    }
  }

  return {
    ...user,
    roles: Array.from(rolesMap.values()),
  } as UserWithRoles;
}

/**
 * Extract all permission names from user's roles
 */
function extractPermissions(user: UserWithRoles): Set<string> {
  const permissions = new Set<string>();

  for (const role of user.roles) {
    for (const permission of role.permissions) {
      permissions.add(permission.name);
    }
  }

  return permissions;
}

// ============================================================================
// MIDDLEWARE
// ============================================================================

/**
 * Authentication middleware - validates session and sets tenant context
 * Attaches to req.tenantContext
 */
export function authMiddleware(): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Add request ID for tracing
      req.requestId = req.headers['x-request-id'] as string || generateSecureToken(16);

      // Get session token from cookie
      const token = req.cookies?.[config.cookieName];

      if (!token) {
        // No session - continue without auth (for public routes)
        return next();
      }

      // Validate session
      const session = await validateSession(token);

      if (!session) {
        // Invalid/expired session - clear cookie
        res.clearCookie(config.cookieName);
        return next();
      }

      // Load user with permissions
      const user = await loadUserWithPermissions(session.userId);

      if (!user || user.status !== 'active') {
        // User not found or inactive
        await invalidateSession(session.sessionId);
        res.clearCookie(config.cookieName);
        return next();
      }

      // Build tenant context
      const tenantContext: TenantContext = {
        orgId: session.orgId,
        userId: session.userId,
        sessionId: session.sessionId,
        roles: user.roles.map((r) => r.name),
        permissions: extractPermissions(user),
        isSuperAdmin: user.isSuperAdmin ?? false,
      };

      // Attach to request
      req.tenantContext = tenantContext;
      res.locals.tenantContext = tenantContext;

      // Set RLS context for database queries
      // This is critical for Row Level Security to work
      await setDatabaseTenantContext(session.orgId, user.isSuperAdmin ?? false);

      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Require authentication - use for protected routes
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.tenantContext) {
    res.status(401).json({
      success: false,
      error: {
        code: 'AUTHENTICATION_REQUIRED',
        message: 'Authentication required',
      },
      requestId: req.requestId,
    });
    return;
  }

  next();
}

/**
 * CSRF protection middleware
 * Validates CSRF token for state-changing requests (POST, PUT, DELETE, PATCH)
 */
export function csrfProtection(req: Request, res: Response, next: NextFunction): void {
  // Skip for GET, HEAD, OPTIONS
  const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
  if (safeMethods.includes(req.method)) {
    return next();
  }

  // Must be authenticated
  if (!req.tenantContext) {
    res.status(401).json({
      success: false,
      error: {
        code: 'AUTHENTICATION_REQUIRED',
        message: 'Authentication required',
      },
    });
    return;
  }

  // Get CSRF token from header
  const csrfToken = req.headers[config.csrfHeaderName.toLowerCase()] as string;

  if (!csrfToken) {
    res.status(403).json({
      success: false,
      error: {
        code: 'CSRF_TOKEN_MISSING',
        message: 'CSRF token required',
      },
    });
    return;
  }

  // Get expected token from session (we need to look it up)
  // In production, you might cache this in req.tenantContext
  validateCsrfToken(req.tenantContext.sessionId, csrfToken)
    .then((valid) => {
      if (!valid) {
        res.status(403).json({
          success: false,
          error: {
            code: 'CSRF_TOKEN_INVALID',
            message: 'Invalid CSRF token',
          },
        });
        return;
      }
      next();
    })
    .catch(next);
}

async function validateCsrfToken(sessionId: string, token: string): Promise<boolean> {
  const result = await db
    .select({ csrfToken: sessions.csrfToken })
    .from(sessions)
    .where(eq(sessions.id, sessionId))
    .limit(1);

  if (result.length === 0) {
    return false;
  }

  return secureCompare(result[0].csrfToken, token);
}

/**
 * Require super admin access
 */
export function requireSuperAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.tenantContext?.isSuperAdmin) {
    // Log break-glass attempt
    auditLog({
      orgId: req.tenantContext?.orgId,
      actorUserId: req.tenantContext?.userId,
      action: 'break_glass_access',
      resourceType: 'admin',
      resourceId: undefined,
      metadata: {
        attempted: true,
        denied: true,
        path: req.path,
      },
      ipAddress: getClientIp(req),
      userAgent: req.headers['user-agent'],
      requestId: req.requestId,
    });

    res.status(403).json({
      success: false,
      error: {
        code: 'SUPER_ADMIN_REQUIRED',
        message: 'Super admin access required',
      },
    });
    return;
  }

  // Log successful break-glass access
  auditLog({
    orgId: req.tenantContext.orgId,
    actorUserId: req.tenantContext.userId,
    action: 'break_glass_access',
    resourceType: 'admin',
    resourceId: undefined,
    metadata: {
      attempted: true,
      denied: false,
      path: req.path,
    },
    ipAddress: getClientIp(req),
    userAgent: req.headers['user-agent'],
    requestId: req.requestId,
  });

  next();
}

// ============================================================================
// DATABASE TENANT CONTEXT (for RLS)
// ============================================================================

/**
 * Set PostgreSQL session variables for RLS
 * This should be called at the start of each request
 */
async function setDatabaseTenantContext(orgId: string, isSuperAdmin: boolean): Promise<void> {
  // Note: This uses raw SQL to set session variables
  // Adjust based on your Drizzle/DB client setup
  
  // For Neon serverless, you need to set this on each query
  // For traditional pooled connections, use session-level settings
  
  // Example with raw SQL (adjust to your DB client):
  // await db.execute(sql`SET app.current_org_id = ${orgId}`);
  // await db.execute(sql`SET app.is_super_admin = ${isSuperAdmin.toString()}`);
  
  // For now, we rely on application-level enforcement as backup
  // RLS provides defense-in-depth
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Get client IP address accounting for proxies
 */
export function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const ips = (Array.isArray(forwarded) ? forwarded[0] : forwarded).split(',');
    return ips[0].trim();
  }
  return req.socket.remoteAddress || 'unknown';
}

/**
 * Set session cookie on response
 */
export function setSessionCookie(
  res: Response,
  token: string,
  expiresAt: Date
): void {
  res.cookie(config.cookieName, token, {
    httpOnly: true,
    secure: config.cookieSecure,
    sameSite: config.cookieSameSite,
    domain: config.cookieDomain,
    expires: expiresAt,
    path: '/',
  });
}

/**
 * Clear session cookie
 */
export function clearSessionCookie(res: Response): void {
  res.clearCookie(config.cookieName, {
    httpOnly: true,
    secure: config.cookieSecure,
    sameSite: config.cookieSameSite,
    domain: config.cookieDomain,
    path: '/',
  });
}

// ============================================================================
// SESSION CLEANUP (run periodically)
// ============================================================================

/**
 * Clean up expired sessions
 * Run this as a cron job or background task
 */
export async function cleanupExpiredSessions(): Promise<number> {
  const result = await db
    .delete(sessions)
    .where(lt(sessions.expiresAt, new Date()))
    .returning({ id: sessions.id });

  return result.length;
}

// Import for lt operator
import { lt } from 'drizzle-orm';

export {
  config as authConfig,
};
