import { db } from '../db';
import { auditLogs } from '../../shared/schema';
import { eq, desc } from 'drizzle-orm';
import { Request } from 'express';

export type AuditEventType = 
  | 'create' | 'update' | 'delete' | 'export' | 'import' | 'sync'
  | 'approve' | 'reject' | 'lock' | 'unlock' | 'login' | 'logout' | 'view';

export type AuditEntityType = string;

export interface AuditEventData {
  eventType: string;
  entityType: string;
  entityId?: string;
  action: string;
  beforeData?: any;
  afterData?: any;
  changes?: Record<string, { old: any; new: any }>;
  metadata?: Record<string, any>;
  severity?: 'info' | 'warning' | 'critical';
  isSuccess?: boolean;
  errorMessage?: string;
}

export interface AuditContext {
  userId?: string;
  orgId: string;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
  requestId?: string;
}

export class AuditService {
  private static generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  static extractContext(req: Request): AuditContext {
    const user = (req as any).user;
    const ipAddress = 
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      (req.headers['x-real-ip'] as string) ||
      req.connection?.remoteAddress ||
      req.socket?.remoteAddress;

    return {
      userId: user?.id,
      orgId: user?.orgId,
      ipAddress,
      userAgent: req.headers['user-agent'],
      sessionId: (req as any).sessionID,
      requestId: this.generateRequestId(),
    };
  }

  static async log(
    context: AuditContext,
    eventData: AuditEventData
  ): Promise<void> {
    try {
      await db.insert(auditLogs).values({
        orgId: context.orgId,
        userId: context.userId || null,
        entityType: eventData.entityType,
        entityId: eventData.entityId || null,
        action: eventData.action,
        before: eventData.beforeData || null,
        after: eventData.afterData || null,
        ipAddress: context.ipAddress || null,
        userAgent: context.userAgent || null,
        metadata: {
          ...(eventData.metadata || {}),
          sessionId: context.sessionId,
          requestId: context.requestId,
          severity: eventData.severity || 'info',
          isSuccess: eventData.isSuccess !== false,
          errorMessage: eventData.errorMessage,
          changes: eventData.changes,
          eventType: eventData.eventType,
        },
      });
    } catch (error) {
      console.error('Failed to write audit log:', error);
    }
  }

  static async logFuelTransaction(
    req: Request,
    action: 'create' | 'update' | 'delete' | 'import' | 'export',
    transactionId?: string,
    beforeData?: any,
    afterData?: any,
    additionalMetadata?: Record<string, any>
  ): Promise<void> {
    const context = this.extractContext(req);
    const changes = beforeData && afterData ? this.calculateChanges(beforeData, afterData) : undefined;

    await this.log(context, {
      eventType: action,
      entityType: 'fuel_transaction',
      entityId: transactionId,
      action: `${action.charAt(0).toUpperCase() + action.slice(1)} fuel transaction`,
      beforeData,
      afterData,
      changes,
      metadata: additionalMetadata,
      isSuccess: true,
    });
  }

  static async logFuelIntegration(
    req: Request,
    action: 'create' | 'update' | 'delete' | 'sync' | 'enable' | 'disable',
    integrationId?: string,
    beforeData?: any,
    afterData?: any,
    additionalMetadata?: Record<string, any>
  ): Promise<void> {
    const context = this.extractContext(req);

    await this.log(context, {
      eventType: action,
      entityType: 'fuel_integration',
      entityId: integrationId,
      action: `${action.charAt(0).toUpperCase() + action.slice(1)} fuel integration`,
      beforeData,
      afterData,
      metadata: {
        ...additionalMetadata,
        securitySensitive: true,
      },
      severity: ['delete', 'disable'].includes(action) ? 'warning' : 'info',
      isSuccess: true,
    });
  }

  static async logApprovalRequest(
    req: Request,
    resourceType: string,
    resourceId: string,
    action: string,
    requestData: any
  ): Promise<void> {
    const context = this.extractContext(req);

    await this.log(context, {
      eventType: 'approve',
      entityType: 'approval_workflow',
      entityId: resourceId,
      action: `Approval requested for ${action}`,
      afterData: requestData,
      metadata: {
        approvalType: action,
        resourceType,
        resourceId,
        status: 'pending',
      },
      severity: 'warning',
      isSuccess: true,
    });
  }

  static async logApprovalDecision(
    req: Request,
    approvalId: string,
    decision: 'approve' | 'reject',
    reason?: string
  ): Promise<void> {
    const context = this.extractContext(req);

    await this.log(context, {
      eventType: decision,
      entityType: 'approval_workflow',
      entityId: approvalId,
      action: `Approval ${decision}ed`,
      metadata: {
        decision,
        reason,
      },
      severity: decision === 'reject' ? 'warning' : 'info',
      isSuccess: true,
    });
  }

  static async logPeriodLock(
    req: Request,
    period: { year: number; month: number },
    action: 'lock' | 'unlock'
  ): Promise<void> {
    const context = this.extractContext(req);

    await this.log(context, {
      eventType: action,
      entityType: 'period_lock',
      entityId: `${period.year}-${String(period.month).padStart(2, '0')}`,
      action: `Period ${action}ed for ${period.year}-${period.month}`,
      metadata: {
        year: period.year,
        month: period.month,
      },
      severity: 'critical',
      isSuccess: true,
    });
  }

  static async logExport(
    req: Request,
    exportType: 'quickbooks' | 'csv' | 'excel' | 'pdf',
    recordCount: number,
    filters?: any
  ): Promise<void> {
    const context = this.extractContext(req);

    await this.log(context, {
      eventType: 'export',
      entityType: 'fuel_export',
      action: `Exported ${recordCount} records as ${exportType.toUpperCase()}`,
      metadata: {
        exportType,
        recordCount,
        filters,
      },
      severity: 'info',
      isSuccess: true,
    });
  }

  private static calculateChanges(before: any, after: any): Record<string, { old: any; new: any }> {
    const changes: Record<string, { old: any; new: any }> = {};

    const allKeys = new Set([...Object.keys(before || {}), ...Object.keys(after || {})]);

    for (const key of allKeys) {
      if (before[key] !== after[key]) {
        changes[key] = {
          old: before[key],
          new: after[key],
        };
      }
    }

    return changes;
  }

  static async getAuditTrail(
    orgId: string,
    filters?: {
      entityType?: string;
      entityId?: string;
      userId?: string;
      startDate?: Date;
      endDate?: Date;
      limit?: number;
    }
  ) {
    let query = db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.orgId, orgId));

    if (filters?.limit) {
      query = query.limit(filters.limit);
    }

    const results = await query.orderBy(desc(auditLogs.createdAt));
    return results;
  }
}
