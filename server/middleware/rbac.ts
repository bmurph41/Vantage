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
  | 'audit:read';

const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  owner: [
    'fuel:read', 'fuel:create', 'fuel:update', 'fuel:delete',
    'fuel:export', 'fuel:import', 'fuel:integration:manage',
    'fuel:approval:approve', 'fuel:approval:request',
    'fuel:period:lock', 'fuel:period:unlock',
    'analytics:read', 'reports:create', 'settings:manage',
    'users:manage', 'audit:read',
  ],
  admin: [
    'fuel:read', 'fuel:create', 'fuel:update', 'fuel:delete',
    'fuel:export', 'fuel:import', 'fuel:integration:manage',
    'fuel:approval:approve', 'fuel:approval:request',
    'fuel:period:lock',
    'analytics:read', 'reports:create', 'settings:manage',
    'audit:read',
  ],
  editor: [
    'fuel:read', 'fuel:create', 'fuel:update',
    'fuel:export', 'fuel:approval:request',
    'analytics:read', 'reports:create',
  ],
  viewer: [
    'fuel:read', 'analytics:read',
  ],
  auditor: [
    'fuel:read', 'analytics:read', 'audit:read',
  ],
};

export async function getUserRole(userId: string, orgId: string): Promise<UserRole | null> {
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

    return roleRecord.length > 0 ? (roleRecord[0].role as UserRole) : null;
  } catch (error) {
    console.error('Error fetching user role:', error);
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

      if (!userId || !orgId) {
        return res.status(401).json({ 
          message: 'Authentication required',
          code: 'AUTH_REQUIRED' 
        });
      }

      const userRole = await getUserRole(userId, orgId);

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

      if (!userId || !orgId) {
        return res.status(401).json({ 
          message: 'Authentication required',
          code: 'AUTH_REQUIRED' 
        });
      }

      const userRole = await getUserRole(userId, orgId);

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
  permission: Permission
): Promise<boolean> {
  const userRole = await getUserRole(userId, orgId);
  if (!userRole) return false;
  return hasPermission(userRole, permission);
}
