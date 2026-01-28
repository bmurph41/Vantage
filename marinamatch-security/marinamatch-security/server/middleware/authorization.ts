/**
 * MarinaMatch Authorization Middleware
 * 
 * Provides RBAC/ABAC permission checking with resource-level access control.
 * 
 * USAGE:
 * // Simple permission check
 * app.get('/api/documents', requireAuth, authorize('documents:read'), handler);
 * 
 * // Multiple permissions (ANY)
 * app.post('/api/documents', requireAuth, authorizeAny(['documents:upload', 'admin']), handler);
 * 
 * // Resource-level check
 * app.get('/api/documents/:id', requireAuth, authorizeResource('documents', 'read'), handler);
 * 
 * // Custom authorization logic
 * app.put('/api/documents/:id', requireAuth, authorizeCustom(canEditDocument), handler);
 */

import { Request, Response, NextFunction, RequestHandler } from 'express';
import { eq, and } from 'drizzle-orm';
import { db } from '../db/client'; // Adjust to your DB client
import { documents } from '../db/security-schema';
import type { TenantContext, PermissionCheck, AuthorizationResult } from '../types/security';
import { AuthorizationError, TenantIsolationError } from '../types/security';

// ============================================================================
// CORE AUTHORIZATION
// ============================================================================

/**
 * Check if user has a specific permission
 */
export function hasPermission(
  context: TenantContext,
  permission: string
): boolean {
  // Super admins have all permissions
  if (context.isSuperAdmin) {
    return true;
  }

  return context.permissions.has(permission);
}

/**
 * Check if user has ANY of the specified permissions
 */
export function hasAnyPermission(
  context: TenantContext,
  permissions: string[]
): boolean {
  if (context.isSuperAdmin) {
    return true;
  }

  return permissions.some((p) => context.permissions.has(p));
}

/**
 * Check if user has ALL of the specified permissions
 */
export function hasAllPermissions(
  context: TenantContext,
  permissions: string[]
): boolean {
  if (context.isSuperAdmin) {
    return true;
  }

  return permissions.every((p) => context.permissions.has(p));
}

/**
 * Check if user has a specific role
 */
export function hasRole(context: TenantContext, role: string): boolean {
  if (context.isSuperAdmin) {
    return true;
  }

  return context.roles.includes(role);
}

/**
 * Check if user has ANY of the specified roles
 */
export function hasAnyRole(context: TenantContext, roles: string[]): boolean {
  if (context.isSuperAdmin) {
    return true;
  }

  return roles.some((r) => context.roles.includes(r));
}

// ============================================================================
// MIDDLEWARE FACTORIES
// ============================================================================

/**
 * Require a specific permission
 */
export function authorize(permission: string): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    const context = req.tenantContext;

    if (!context) {
      res.status(401).json({
        success: false,
        error: {
          code: 'AUTHENTICATION_REQUIRED',
          message: 'Authentication required',
        },
      });
      return;
    }

    if (!hasPermission(context, permission)) {
      res.status(403).json({
        success: false,
        error: {
          code: 'PERMISSION_DENIED',
          message: 'You do not have permission to perform this action',
          requiredPermission: permission,
        },
        requestId: req.requestId,
      });
      return;
    }

    next();
  };
}

/**
 * Require ANY of the specified permissions
 */
export function authorizeAny(permissions: string[]): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    const context = req.tenantContext;

    if (!context) {
      res.status(401).json({
        success: false,
        error: {
          code: 'AUTHENTICATION_REQUIRED',
          message: 'Authentication required',
        },
      });
      return;
    }

    if (!hasAnyPermission(context, permissions)) {
      res.status(403).json({
        success: false,
        error: {
          code: 'PERMISSION_DENIED',
          message: 'You do not have permission to perform this action',
          requiredPermissions: permissions,
        },
        requestId: req.requestId,
      });
      return;
    }

    next();
  };
}

/**
 * Require ALL of the specified permissions
 */
export function authorizeAll(permissions: string[]): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    const context = req.tenantContext;

    if (!context) {
      res.status(401).json({
        success: false,
        error: {
          code: 'AUTHENTICATION_REQUIRED',
          message: 'Authentication required',
        },
      });
      return;
    }

    if (!hasAllPermissions(context, permissions)) {
      const missing = permissions.filter((p) => !context.permissions.has(p));
      res.status(403).json({
        success: false,
        error: {
          code: 'PERMISSION_DENIED',
          message: 'You do not have all required permissions',
          missingPermissions: missing,
        },
        requestId: req.requestId,
      });
      return;
    }

    next();
  };
}

/**
 * Require a specific role
 */
export function authorizeRole(role: string): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    const context = req.tenantContext;

    if (!context) {
      res.status(401).json({
        success: false,
        error: {
          code: 'AUTHENTICATION_REQUIRED',
          message: 'Authentication required',
        },
      });
      return;
    }

    if (!hasRole(context, role)) {
      res.status(403).json({
        success: false,
        error: {
          code: 'ROLE_REQUIRED',
          message: `Role '${role}' is required`,
        },
        requestId: req.requestId,
      });
      return;
    }

    next();
  };
}

/**
 * Require ANY of the specified roles
 */
export function authorizeAnyRole(roles: string[]): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    const context = req.tenantContext;

    if (!context) {
      res.status(401).json({
        success: false,
        error: {
          code: 'AUTHENTICATION_REQUIRED',
          message: 'Authentication required',
        },
      });
      return;
    }

    if (!hasAnyRole(context, roles)) {
      res.status(403).json({
        success: false,
        error: {
          code: 'ROLE_REQUIRED',
          message: 'One of the following roles is required',
          requiredRoles: roles,
        },
        requestId: req.requestId,
      });
      return;
    }

    next();
  };
}

// ============================================================================
// RESOURCE-LEVEL AUTHORIZATION
// ============================================================================

type ResourceChecker = (
  context: TenantContext,
  resourceId: string,
  req: Request
) => Promise<AuthorizationResult>;

/**
 * Authorize based on resource ownership/access
 * Combines permission check with resource-level validation
 */
export function authorizeResource(
  resource: string,
  action: string,
  paramName: string = 'id'
): RequestHandler {
  const permission = `${resource}:${action}`;
  
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const context = req.tenantContext;

    if (!context) {
      res.status(401).json({
        success: false,
        error: {
          code: 'AUTHENTICATION_REQUIRED',
          message: 'Authentication required',
        },
      });
      return;
    }

    // Check permission first
    if (!hasPermission(context, permission)) {
      res.status(403).json({
        success: false,
        error: {
          code: 'PERMISSION_DENIED',
          message: 'You do not have permission to perform this action',
          requiredPermission: permission,
        },
        requestId: req.requestId,
      });
      return;
    }

    // Get resource ID from params
    const resourceId = req.params[paramName];
    
    if (!resourceId) {
      res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_RESOURCE_ID',
          message: `Resource ID '${paramName}' is required`,
        },
      });
      return;
    }

    // Check resource ownership/tenant isolation
    try {
      const result = await checkResourceAccess(context, resource, resourceId);
      
      if (!result.allowed) {
        res.status(403).json({
          success: false,
          error: {
            code: 'ACCESS_DENIED',
            message: result.reason || 'Access to this resource is denied',
          },
          requestId: req.requestId,
        });
        return;
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Check if a resource belongs to the user's organization
 */
async function checkResourceAccess(
  context: TenantContext,
  resourceType: string,
  resourceId: string
): Promise<AuthorizationResult> {
  // Super admins can access anything
  if (context.isSuperAdmin) {
    return { allowed: true };
  }

  // Check based on resource type
  switch (resourceType) {
    case 'documents':
      return checkDocumentAccess(context, resourceId);
    
    // Add more resource types as needed
    // case 'models':
    //   return checkModelAccess(context, resourceId);
    
    default:
      // Default to allowed if we don't have specific rules
      // In production, you might want to default to denied
      return { allowed: true };
  }
}

/**
 * Check document access (tenant isolation)
 */
async function checkDocumentAccess(
  context: TenantContext,
  documentId: string
): Promise<AuthorizationResult> {
  const result = await db
    .select({ orgId: documents.orgId })
    .from(documents)
    .where(eq(documents.id, documentId))
    .limit(1);

  if (result.length === 0) {
    return { 
      allowed: false, 
      reason: 'Document not found' 
    };
  }

  if (result[0].orgId !== context.orgId) {
    return { 
      allowed: false, 
      reason: 'Access to this document is not permitted' 
    };
  }

  return { allowed: true };
}

/**
 * Custom authorization with async checker function
 */
export function authorizeCustom(
  checker: ResourceChecker,
  paramName: string = 'id'
): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const context = req.tenantContext;

    if (!context) {
      res.status(401).json({
        success: false,
        error: {
          code: 'AUTHENTICATION_REQUIRED',
          message: 'Authentication required',
        },
      });
      return;
    }

    const resourceId = req.params[paramName] || '';

    try {
      const result = await checker(context, resourceId, req);

      if (!result.allowed) {
        res.status(403).json({
          success: false,
          error: {
            code: 'ACCESS_DENIED',
            message: result.reason || 'Access denied',
            requiredPermission: result.requiredPermission,
          },
          requestId: req.requestId,
        });
        return;
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

// ============================================================================
// SCOPED QUERY HELPERS
// ============================================================================

/**
 * Get tenant-scoped where clause for queries
 * Use this to ensure all queries are properly scoped
 */
export function tenantScope(context: TenantContext) {
  if (context.isSuperAdmin) {
    // Super admins see all data
    return {};
  }

  return { orgId: context.orgId };
}

/**
 * Validate that a resource ID belongs to the current tenant
 * Throws TenantIsolationError if not
 */
export async function validateResourceTenant(
  context: TenantContext,
  table: any, // Drizzle table
  resourceId: string,
  idColumn: string = 'id',
  orgColumn: string = 'orgId'
): Promise<void> {
  if (context.isSuperAdmin) {
    return; // Super admins can access any resource
  }

  const result = await db
    .select({ orgId: table[orgColumn] })
    .from(table)
    .where(eq(table[idColumn], resourceId))
    .limit(1);

  if (result.length === 0) {
    throw new TenantIsolationError('Resource not found');
  }

  if (result[0].orgId !== context.orgId) {
    throw new TenantIsolationError();
  }
}

// ============================================================================
// PERMISSION UTILITIES
// ============================================================================

/**
 * Build a permission string from resource and action
 */
export function buildPermission(resource: string, action: string): string {
  return `${resource}:${action}`;
}

/**
 * Parse a permission string into resource and action
 */
export function parsePermission(permission: string): { resource: string; action: string } {
  const [resource, action] = permission.split(':');
  return { resource, action };
}

/**
 * Get all permissions for a resource
 */
export function getResourcePermissions(
  context: TenantContext,
  resource: string
): string[] {
  const prefix = `${resource}:`;
  return Array.from(context.permissions).filter((p) => p.startsWith(prefix));
}

// ============================================================================
// ATTRIBUTE-BASED ACCESS CONTROL (ABAC) HELPERS
// ============================================================================

interface AbacContext {
  user: TenantContext;
  resource: Record<string, unknown>;
  action: string;
  environment: {
    time: Date;
    ip?: string;
  };
}

type AbacPolicy = (ctx: AbacContext) => boolean;

/**
 * Evaluate ABAC policies
 */
export function evaluateAbacPolicies(
  policies: AbacPolicy[],
  context: AbacContext
): boolean {
  // All policies must pass
  return policies.every((policy) => policy(context));
}

/**
 * Example ABAC policy: Only allow access during business hours
 */
export const businessHoursPolicy: AbacPolicy = (ctx) => {
  const hour = ctx.environment.time.getHours();
  return hour >= 9 && hour < 17;
};

/**
 * Example ABAC policy: Document owner can always access
 */
export const ownerAccessPolicy: AbacPolicy = (ctx) => {
  return ctx.resource.uploadedBy === ctx.user.userId;
};

/**
 * Example ABAC policy: Only approved documents can be downloaded
 */
export const approvedDocumentPolicy: AbacPolicy = (ctx) => {
  if (ctx.action !== 'download') return true;
  return ctx.resource.status === 'approved';
};
