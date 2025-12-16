import { Request, Response, NextFunction } from 'express';
import { db } from '../db';
import { organizationUserRoles } from '../../shared/schema';
import { eq, and } from 'drizzle-orm';

export type UserRole = 'owner' | 'admin' | 'editor' | 'viewer' | 'auditor';

export type Permission =
  | 'fuel:read'
  | 'fuel:create'
  | 'fuel:update'
  | 'fuel:delete'
  | 'fuel:export'
  | 'fuel:import'
  | 'fuel:integration:manage'
  | 'fuel:approval:approve'
  | 'fuel:approval:request'
  | 'fuel:period:lock'
  | 'fuel:period:unlock'
  | 'analytics:read'
  | 'reports:create'
  | 'settings:manage'
  | 'users:manage'
  | 'audit:read'
  | 'finance_kernel:read'
  | 'finance_kernel:manage'
  | 'integrations:manage';

const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  owner: [
    'fuel:read', 'fuel:create', 'fuel:update', 'fuel:delete',
    'fuel:export', 'fuel:import', 'fuel:integration:manage',
    'fuel:approval:approve', 'fuel:approval:request',
    'fuel:period:lock', 'fuel:period:unlock',
    'analytics:read', 'reports:create', 'settings:manage',
    'users:manage', 'audit:read',
    'finance_kernel:read', 'finance_kernel:manage', 'integrations:manage',
  ],
  admin: [
    'fuel:read', 'fuel:create', 'fuel:update', 'fuel:delete',
    'fuel:export', 'fuel:import', 'fuel:integration:manage',
    'fuel:approval:approve', 'fuel:approval:request',
    'fuel:period:lock',
    'analytics:read', 'reports:create', 'settings:manage',
    'audit:read',
    'finance_kernel:read', 'finance_kernel:manage', 'integrations:manage',
  ],
  editor: [
    'fuel:read', 'fuel:create', 'fuel:update',
    'fuel:export', 'fuel:approval:request',
    'analytics:read', 'reports:create',
    'finance_kernel:read',
  ],
  viewer: [
    'fuel:read', 'analytics:read',
    'finance_kernel:read',
  ],
  auditor: [
    'fuel:read', 'analytics:read', 'audit:read',
    'finance_kernel:read',
  ],
};

export async function getUserRole(userId: string, orgId: string, fallbackRole?: string): Promise<UserRole | null> {
  try {
    const roleRecord = await db
      .select()
      .from(organizationUserRoles)
      .where(
        and(
          eq(organizationUserRoles.userId, userId),
          eq(organizationUserRoles.orgId, orgId),
          eq(organizationUserRoles.isActive, true)
        )
      )
      .limit(1);

    if (roleRecord.length > 0) {
      return roleRecord[0].role as UserRole;
    }

    // Fall back to the role set by authenticateUser middleware (for backwards compatibility)
    if (fallbackRole && ['owner', 'admin', 'editor', 'viewer', 'auditor'].includes(fallbackRole)) {
      return fallbackRole as UserRole;
    }

    return null;
  } catch (error) {
    console.error('Error fetching user role:', error);
    // On database error, fall back to the middleware-provided role
    if (fallbackRole && ['owner', 'admin', 'editor', 'viewer', 'auditor'].includes(fallbackRole)) {
      return fallbackRole as UserRole;
    }
    return null;
  }
}

export function hasPermission(role: UserRole, permission: Permission): boolean {
  const permissions = ROLE_PERMISSIONS[role] || [];
  return permissions.includes(permission);
}

export function requirePermission(...permissions: Permission[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user?.id;
      const orgId = (req as any).user?.orgId;
      const fallbackRole = (req as any).user?.role; // From authenticateUser middleware

      if (!userId || !orgId) {
        return res.status(401).json({ 
          message: 'Authentication required',
          code: 'AUTH_REQUIRED' 
        });
      }

      const userRole = await getUserRole(userId, orgId, fallbackRole);

      if (!userRole) {
        return res.status(403).json({ 
          message: 'No role assigned for this organization',
          code: 'NO_ROLE_ASSIGNED' 
        });
      }

      const hasAllPermissions = permissions.every(permission =>
        hasPermission(userRole, permission)
      );

      if (!hasAllPermissions) {
        return res.status(403).json({
          message: 'Insufficient permissions',
          code: 'INSUFFICIENT_PERMISSIONS',
          required: permissions,
          role: userRole,
        });
      }

      (req as any).userRole = userRole;
      (req as any).permissions = ROLE_PERMISSIONS[userRole];
      next();
    } catch (error) {
      console.error('RBAC middleware error:', error);
      res.status(500).json({ 
        message: 'Error checking permissions',
        code: 'RBAC_ERROR' 
      });
    }
  };
}

export function requireRole(...roles: UserRole[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user?.id;
      const orgId = (req as any).user?.orgId;
      const fallbackRole = (req as any).user?.role; // From authenticateUser middleware

      if (!userId || !orgId) {
        return res.status(401).json({ 
          message: 'Authentication required',
          code: 'AUTH_REQUIRED' 
        });
      }

      const userRole = await getUserRole(userId, orgId, fallbackRole);

      if (!userRole || !roles.includes(userRole)) {
        return res.status(403).json({
          message: 'Insufficient role level',
          code: 'INSUFFICIENT_ROLE',
          required: roles,
          current: userRole,
        });
      }

      (req as any).userRole = userRole;
      (req as any).permissions = ROLE_PERMISSIONS[userRole];
      next();
    } catch (error) {
      console.error('RBAC middleware error:', error);
      res.status(500).json({ 
        message: 'Error checking role',
        code: 'RBAC_ERROR' 
      });
    }
  };
}

export async function checkPermission(
  userId: string,
  orgId: string,
  permission: Permission,
  fallbackRole?: string
): Promise<boolean> {
  const userRole = await getUserRole(userId, orgId, fallbackRole);
  if (!userRole) return false;
  return hasPermission(userRole, permission);
}
