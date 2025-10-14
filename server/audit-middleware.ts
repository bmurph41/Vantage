import { Request, Response, NextFunction } from 'express';
import { storage } from './storage';
import type { InsertAuditLog } from '@shared/schema';

export interface AuditContext {
  entityType: string;
  entityId: string;
  action: 'create' | 'update' | 'delete' | 'view' | 'export';
  before?: any;
  after?: any;
  metadata?: Record<string, any>;
}

export async function logAudit(
  req: Request,
  context: AuditContext
): Promise<void> {
  try {
    const user = (req as any).user;
    if (!user) return;

    const ipAddress = 
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.socket.remoteAddress ||
      'unknown';

    const userAgent = req.headers['user-agent'] || 'unknown';

    const auditLog: InsertAuditLog = {
      orgId: user.orgId,
      userId: user.id,
      projectId: context.metadata?.projectId || null,
      entityType: context.entityType,
      entityId: context.entityId,
      action: context.action,
      before: context.before || null,
      after: context.after || null,
      ipAddress,
      userAgent,
      metadata: context.metadata || {},
    };

    await storage.createAuditLog(auditLog);
  } catch (error) {
    console.error('Failed to create audit log:', error);
    // Don't throw - audit logging should not break main operations
  }
}

export function auditMiddleware(
  entityType: string,
  getEntityId: (req: Request) => string,
  action: AuditContext['action']
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const originalJson = res.json.bind(res);
    
    res.json = function(data: any) {
      const entityId = getEntityId(req);
      
      // Log audit after successful response
      setImmediate(() => {
        logAudit(req, {
          entityType,
          entityId,
          action,
          after: data,
          metadata: {
            projectId: req.body?.projectId || req.params?.projectId,
            method: req.method,
            path: req.path,
          }
        }).catch(err => console.error('Audit log failed:', err));
      });

      return originalJson(data);
    };

    next();
  };
}

export function auditUpdate(
  entityType: string,
  getEntityId: (req: Request) => string,
  getBefore: (req: Request) => Promise<any>
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const entityId = getEntityId(req);
    const before = await getBefore(req).catch(() => null);
    
    const originalJson = res.json.bind(res);
    
    res.json = function(data: any) {
      setImmediate(() => {
        logAudit(req, {
          entityType,
          entityId,
          action: 'update',
          before,
          after: data,
          metadata: {
            projectId: req.body?.projectId || req.params?.projectId,
            changes: getDiff(before, data),
          }
        }).catch(err => console.error('Audit log failed:', err));
      });

      return originalJson(data);
    };

    next();
  };
}

function getDiff(before: any, after: any): string[] {
  if (!before || !after) return [];
  
  const changes: string[] = [];
  const allKeys = Array.from(new Set([...Object.keys(before), ...Object.keys(after)]));
  
  for (const key of allKeys) {
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
      changes.push(key);
    }
  }
  
  return changes;
}

export function createAuditLogEntry(
  req: Request,
  entityType: string,
  entityId: string,
  action: AuditContext['action'],
  options?: {
    before?: any;
    after?: any;
    metadata?: Record<string, any>;
  }
) {
  return logAudit(req, {
    entityType,
    entityId,
    action,
    ...options,
  });
}
