import { Request, Response, NextFunction } from 'express';
import { logger } from '../lib/logger';
import { TenantIsolationError } from './error-handler';
import { db } from '../db';
import { sql } from 'drizzle-orm';

export function requireTenantMatch(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).user;

  if (!user) {
    return next();
  }

  const requestedOrgId = req.params.orgId || req.body?.orgId || req.query.orgId;
  
  if (requestedOrgId && requestedOrgId !== user.orgId) {
    logger.warn({
      type: 'tenant_isolation_violation',
      userId: user.id,
      userOrgId: user.orgId,
      requestedOrgId,
      path: req.path,
      method: req.method,
      ip: req.ip,
    });
    
    return next(new TenantIsolationError());
  }

  next();
}

export function enforceTenant(req: Request, res: Response, next: NextFunction) {
  if (!req.originalUrl.startsWith('/api/')) {
    return next();
  }

  const user = (req as any).user;

  if (!user) {
    return next();
  }

  if (!user.orgId) {
    logger.error({
      type: 'missing_org_id',
      userId: user.id,
      path: req.path,
    });
    return next(new TenantIsolationError());
  }

  if (req.method !== 'GET' && req.body && typeof req.body === 'object') {
    req.body.orgId = user.orgId;
  }

  (req as any).tenantId = user.orgId;
  
  next();
}

export function logTenantAccess(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).user;
  
  if (user) {
    res.on('finish', () => {
      if (res.statusCode >= 400) {
        logger.info({
          type: 'tenant_access',
          userId: user.id,
          orgId: user.orgId,
          path: req.path,
          method: req.method,
          statusCode: res.statusCode,
        });
      }
    });
  }
  
  next();
}

export function validateEntityOwnership(entityType: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;
    const entityId = req.params.id || req.params[`${entityType}Id`];

    if (!user || !entityId) {
      return next();
    }

    try {
      // Query the entity's table to verify the orgId matches the user's orgId
      const tableName = entityType.replace(/[^a-zA-Z0-9_]/g, '');
      const result = await db.execute(
        sql`SELECT "org_id" FROM ${sql.identifier(tableName)} WHERE "id" = ${entityId} LIMIT 1`
      );

      const rows = result.rows || result;
      if (!rows || (rows as any[]).length === 0) {
        // Entity not found — let downstream handler deal with 404
        (req as any).entityOwnershipChecked = true;
        return next();
      }

      const entity = (rows as any[])[0];
      if (entity.org_id && entity.org_id !== user.orgId) {
        logger.warn({
          type: 'entity_ownership_violation',
          userId: user.id,
          userOrgId: user.orgId,
          entityType,
          entityId,
          entityOrgId: entity.org_id,
          path: req.path,
          method: req.method,
        });
        return next(new TenantIsolationError());
      }

      (req as any).entityOwnershipChecked = true;
      next();
    } catch (error) {
      logger.error({
        type: 'entity_ownership_check_failed',
        entityType,
        entityId,
        error: (error as Error).message,
      });
      // Fail closed — deny access if ownership check fails
      return next(new TenantIsolationError());
    }
  };
}
