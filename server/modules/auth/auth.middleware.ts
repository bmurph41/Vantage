import { Request, Response, NextFunction } from 'express';
import { Role, Permission } from './auth.types';
import { hasRole, hasPermission, getPermissionsForRole, isValidRole } from './rbac';
import { AuthenticationError, AuthorizationError } from '../../middleware/error-handler';
import { logger } from '../../lib/logger';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        orgId: string;
        role: Role | string;
        email?: string;
        name?: string;
        permissions?: Permission[];
      };
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.user || !req.user.id) {
    const log = req.log || logger;
    log.warn({
      type: 'auth_required',
      path: req.path,
      method: req.method,
    });
    return next(new AuthenticationError('Authentication required'));
  }
  next();
}

export function requireRole(...roles: (Role | string)[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AuthenticationError('Authentication required'));
    }
    
    const normalizedRoles = roles.map(r => 
      typeof r === 'string' && isValidRole(r) ? r as Role : r
    );
    
    const userClaims = {
      role: req.user.role,
    };
    
    if (!hasRole(userClaims, normalizedRoles as Role[])) {
      const log = req.log || logger;
      log.warn({
        type: 'role_denied',
        path: req.path,
        method: req.method,
        userId: req.user.id,
        userRole: req.user.role,
        requiredRoles: roles,
      });
      return next(new AuthorizationError(`Required role: ${roles.join(' or ')}`));
    }
    
    next();
  };
}

export function requirePermissions(...permissions: Permission[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AuthenticationError('Authentication required'));
    }
    
    const userClaims = {
      role: req.user.role as Role,
    };
    
    if (!hasPermission(userClaims, permissions)) {
      const log = req.log || logger;
      log.warn({
        type: 'permission_denied',
        path: req.path,
        method: req.method,
        userId: req.user.id,
        userRole: req.user.role,
        requiredPermissions: permissions,
      });
      return next(new AuthorizationError(`Required permissions: ${permissions.join(', ')}`));
    }
    
    next();
  };
}

export function attachPermissions(req: Request, res: Response, next: NextFunction) {
  if (req.user && req.user.role) {
    const role = isValidRole(req.user.role as string) 
      ? req.user.role as Role 
      : Role.VIEWER;
    req.user.permissions = getPermissionsForRole(role);
  }
  next();
}

export function requireTenantAccess(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return next(new AuthenticationError('Authentication required'));
  }
  
  const resourceOrgId = req.params.orgId || req.body?.orgId || req.query?.orgId;
  
  if (resourceOrgId && resourceOrgId !== req.user.orgId) {
    const log = req.log || logger;
    log.warn({
      type: 'tenant_isolation_violation',
      path: req.path,
      method: req.method,
      userId: req.user.id,
      userOrgId: req.user.orgId,
      resourceOrgId,
    });
    return next(new AuthorizationError('Access denied'));
  }
  
  next();
}

export function optionalAuth(req: Request, res: Response, next: NextFunction) {
  next();
}
