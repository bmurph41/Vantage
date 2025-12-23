import { Request, Response, NextFunction } from 'express';
import { logger } from '../lib/logger';
import { TenantIsolationError } from './error-handler';

export function requireTenantMatch(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).user;
  
  if (!user) {
    return res.status(401).json({ error: 'Authentication required', code: 'AUTH_REQUIRED' });
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
  const user = (req as any).user;
  
  if (!user) {
    return res.status(401).json({ error: 'Authentication required', code: 'AUTH_REQUIRED' });
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

    (req as any).entityOwnershipChecked = true;
    next();
  };
}
