import { Request, Response, NextFunction } from 'express';
import { db } from '../db';
import { sql } from 'drizzle-orm';
import { logger } from '../lib/logger';

interface UserPermissions {
  roles: string[];
  permissions: string[];
}

const permissionCache = new Map<string, { data: UserPermissions; expiresAt: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000;

async function getUserPermissions(userId: string): Promise<UserPermissions> {
  const cached = permissionCache.get(userId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  try {
    const rolesResult = await db.execute(sql`
      SELECT r.name 
      FROM security_roles r
      JOIN security_user_roles ur ON r.id = ur.role_id
      WHERE ur.user_id = ${userId}
    `);

    const roles = rolesResult.rows.map((row: any) => row.name as string);

    const permissionsResult = await db.execute(sql`
      SELECT DISTINCT p.name
      FROM security_permissions p
      JOIN security_role_permissions rp ON p.id = rp.permission_id
      JOIN security_user_roles ur ON rp.role_id = ur.role_id
      WHERE ur.user_id = ${userId}
    `);

    const permissions = permissionsResult.rows.map((row: any) => row.name as string);

    const data: UserPermissions = { roles, permissions };

    permissionCache.set(userId, {
      data,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });

    return data;
  } catch (error) {
    logger.error({ error, userId }, 'Failed to get user permissions');
    return { roles: [], permissions: [] };
  }
}

export function clearPermissionCache(userId: string) {
  permissionCache.delete(userId);
}

export function clearAllPermissionCache() {
  permissionCache.clear();
}

export async function loadPermissions(req: Request, res: Response, next: NextFunction) {
  if (!req.user?.id) {
    return next();
  }

  try {
    const { roles, permissions } = await getUserPermissions(req.user.id);
    (req.user as any).roles = roles;
    (req.user as any).permissions = permissions;
    next();
  } catch (error) {
    logger.error({ error }, 'Failed to load permissions');
    next();
  }
}

export function requirePermission(permission: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { permissions } = await getUserPermissions(req.user.id);

    if (!permissions.includes(permission)) {
      logger.warn({
        userId: req.user.id,
        requiredPermission: permission,
        userPermissions: permissions,
        path: req.path,
      }, 'Permission denied');

      return res.status(403).json({ 
        error: 'Permission denied',
        required: permission,
      });
    }

    next();
  };
}

export function requireAnyPermission(requiredPermissions: string[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { permissions } = await getUserPermissions(req.user.id);
    const hasAny = requiredPermissions.some(p => permissions.includes(p));

    if (!hasAny) {
      return res.status(403).json({ 
        error: 'Permission denied',
        required: requiredPermissions,
      });
    }

    next();
  };
}

export function requireAllPermissions(requiredPermissions: string[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { permissions } = await getUserPermissions(req.user.id);
    const hasAll = requiredPermissions.every(p => permissions.includes(p));

    if (!hasAll) {
      const missing = requiredPermissions.filter(p => !permissions.includes(p));
      return res.status(403).json({ 
        error: 'Permission denied',
        required: requiredPermissions,
        missing,
      });
    }

    next();
  };
}

export function requireRole(role: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { roles } = await getUserPermissions(req.user.id);

    if (!roles.includes(role)) {
      return res.status(403).json({ 
        error: 'Insufficient role',
        required: role,
      });
    }

    next();
  };
}

export function requireAnyRole(requiredRoles: string[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { roles } = await getUserPermissions(req.user.id);
    const hasAny = requiredRoles.some(r => roles.includes(r));

    if (!hasAny) {
      return res.status(403).json({ 
        error: 'Insufficient role',
        required: requiredRoles,
      });
    }

    next();
  };
}

export async function hasPermission(userId: string, permission: string): Promise<boolean> {
  const { permissions } = await getUserPermissions(userId);
  return permissions.includes(permission);
}

export async function hasRole(userId: string, role: string): Promise<boolean> {
  const { roles } = await getUserPermissions(userId);
  return roles.includes(role);
}

export async function getAllUserPermissions(userId: string): Promise<UserPermissions> {
  return getUserPermissions(userId);
}