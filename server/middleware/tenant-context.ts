import { Request, Response, NextFunction } from 'express';
import { db } from '../db';
import { sql } from 'drizzle-orm';
import { logger } from '../lib/logger';
import { TenantIsolationError } from './error-handler';

export async function setTenantContext(tenantId: string): Promise<void> {
  try {
    await db.execute(sql`SELECT set_config('app.current_tenant', ${tenantId}, true)`);
  } catch (error) {
    logger.error({ error, tenantId }, 'Failed to set tenant context');
    throw error;
  }
}

export async function clearTenantContext(): Promise<void> {
  try {
    await db.execute(sql`SELECT set_config('app.current_tenant', '', true)`);
  } catch (error) {
    logger.error({ error }, 'Failed to clear tenant context');
  }
}

export function tenantContextMiddleware(req: Request, res: Response, next: NextFunction) {
  if (!req.user?.orgId) {
    return next();
  }
  
  setTenantContext(req.user.orgId)
    .then(() => {
      res.on('finish', () => {
        clearTenantContext().catch(err => {
          logger.error({ error: err }, 'Error clearing tenant context on response finish');
        });
      });
      next();
    })
    .catch((error) => {
      const log = req.log || logger;
      log.error({
        type: 'tenant_context_error',
        error: error.message,
        userId: req.user?.id,
        orgId: req.user?.orgId,
      });
      next(new TenantIsolationError());
    });
}

export function validateTenantAccess(resourceOrgId: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new TenantIsolationError());
    }
    
    if (resourceOrgId && resourceOrgId !== req.user.orgId) {
      const log = req.log || logger;
      log.warn({
        type: 'cross_tenant_access_attempt',
        userId: req.user.id,
        userOrgId: req.user.orgId,
        resourceOrgId,
        path: req.path,
      });
      return next(new TenantIsolationError());
    }
    
    next();
  };
}

export function extractTenantFromRequest(req: Request): string | undefined {
  return req.user?.orgId;
}

export async function withTenantContext<T>(
  tenantId: string,
  operation: () => Promise<T>
): Promise<T> {
  await setTenantContext(tenantId);
  try {
    return await operation();
  } finally {
    await clearTenantContext();
  }
}
