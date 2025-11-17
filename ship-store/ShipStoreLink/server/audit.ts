import { Request } from "express";
import { storage } from "./storage";
import type { InsertAuditLog } from "@shared/schema";
import type { AuthRequest } from "./middleware/auth";

export async function logAudit(params: {
  req: Request | AuthRequest;
  entityType: string;
  entityId: string;
  action: string;
  beforeData?: any;
  afterData?: any;
  metadata?: any;
}) {
  const {req, entityType, entityId, action, beforeData, afterData, metadata} = params;

  // Calculate changed fields
  const changedFields: string[] = [];
  if (beforeData && afterData) {
    Object.keys(afterData).forEach(key => {
      if (JSON.stringify(beforeData[key]) !== JSON.stringify(afterData[key])) {
        changedFields.push(key);
      }
    });
  }

  const auditLog: InsertAuditLog = {
    userId: (req as AuthRequest).user?.id || null, // Captures authenticated user from JWT token
    entityType,
    entityId,
    action,
    beforeData: beforeData || null,
    afterData: afterData || null,
    changedFields: changedFields.length > 0 ? changedFields : null,
    ipAddress: req.ip || req.socket.remoteAddress || "127.0.0.1",
    userAgent: req.get('user-agent') || "unknown",
    metadata: metadata || null,
  };

  try {
    await storage.createAuditLog(auditLog);
  } catch (error) {
    console.error("Failed to create audit log:", error);
    // Don't throw - audit logging should not break the main operation
  }
}

// Middleware to automatically log changes
export function auditMiddleware(entityType: string) {
  return async (req: Request | AuthRequest, res: any, next: any) => {
    const originalJson = res.json;
    
    res.json = function(data: any) {
      // Log after successful operation
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const action = req.method === 'POST' ? 'create' : 
                      req.method === 'PUT' || req.method === 'PATCH' ? 'update' : 
                      req.method === 'DELETE' ? 'delete' : 'read';
        
        if (action !== 'read') {
          const entityId = data?.id || req.params.id || 'unknown';
          
          logAudit({
            req,
            entityType,
            entityId,
            action,
            afterData: data,
            metadata: {
              method: req.method,
              path: req.path,
            }
          }).catch(err => console.error("Audit log failed:", err));
        }
      }
      
      return originalJson.call(this, data);
    };
    
    next();
  };
}
