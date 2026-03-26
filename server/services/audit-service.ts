import { db } from '../db';
import { auditLogs, securityAuditLog, users } from '../../shared/schema';
import { eq, desc, and, gte, lte, like, sql, inArray, or, count } from 'drizzle-orm';
import { Request } from 'express';
import { logger } from '../lib/logger';

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

  static async logFileUpload(
    req: Request,
    fileId: string,
    fileName: string,
    fileSize: number,
    mimeType: string,
    destination?: string
  ): Promise<void> {
    const context = this.extractContext(req);

    await this.log(context, {
      eventType: 'create',
      entityType: 'file_upload',
      entityId: fileId,
      action: `File uploaded: ${fileName}`,
      afterData: {
        fileName,
        fileSize,
        mimeType,
        destination,
      },
      metadata: {
        fileName,
        fileSize,
        mimeType,
        destination,
      },
      severity: 'info',
      isSuccess: true,
    });
  }

  static async logFileDownload(
    req: Request,
    fileId: string,
    fileName: string
  ): Promise<void> {
    const context = this.extractContext(req);

    await this.log(context, {
      eventType: 'view',
      entityType: 'file_download',
      entityId: fileId,
      action: `File downloaded: ${fileName}`,
      metadata: {
        fileName,
      },
      severity: 'info',
      isSuccess: true,
    });
  }

  static async logFileDelete(
    req: Request,
    fileId: string,
    fileName: string
  ): Promise<void> {
    const context = this.extractContext(req);

    await this.log(context, {
      eventType: 'delete',
      entityType: 'file',
      entityId: fileId,
      action: `File deleted: ${fileName}`,
      beforeData: { fileName },
      metadata: {
        fileName,
      },
      severity: 'warning',
      isSuccess: true,
    });
  }

  static async logRoleChange(
    req: Request,
    targetUserId: string,
    targetUserEmail: string,
    oldRole: string | null,
    newRole: string,
    orgId?: string
  ): Promise<void> {
    const context = this.extractContext(req);

    await this.log(context, {
      eventType: 'update',
      entityType: 'user_role',
      entityId: targetUserId,
      action: `Role changed for ${targetUserEmail}: ${oldRole || 'none'} → ${newRole}`,
      beforeData: { role: oldRole },
      afterData: { role: newRole },
      changes: {
        role: { old: oldRole, new: newRole },
      },
      metadata: {
        targetUserId,
        targetUserEmail,
        oldRole,
        newRole,
      },
      severity: 'critical',
      isSuccess: true,
    });
  }

  static async logDealCreate(
    req: Request,
    dealId: string,
    dealName: string,
    dealData: any
  ): Promise<void> {
    const context = this.extractContext(req);

    await this.log(context, {
      eventType: 'create',
      entityType: 'deal',
      entityId: dealId,
      action: `Deal created: ${dealName}`,
      afterData: dealData,
      metadata: {
        dealName,
      },
      severity: 'info',
      isSuccess: true,
    });
  }

  static async logDealUpdate(
    req: Request,
    dealId: string,
    dealName: string,
    beforeData: any,
    afterData: any
  ): Promise<void> {
    const context = this.extractContext(req);
    const changes = this.calculateChanges(beforeData, afterData);

    await this.log(context, {
      eventType: 'update',
      entityType: 'deal',
      entityId: dealId,
      action: `Deal updated: ${dealName}`,
      beforeData,
      afterData,
      changes,
      metadata: {
        dealName,
      },
      severity: 'info',
      isSuccess: true,
    });
  }

  static async logDealStatusChange(
    req: Request,
    dealId: string,
    dealName: string,
    oldStatus: string,
    newStatus: string
  ): Promise<void> {
    const context = this.extractContext(req);

    await this.log(context, {
      eventType: 'update',
      entityType: 'deal',
      entityId: dealId,
      action: `Deal status changed: ${dealName} (${oldStatus} → ${newStatus})`,
      beforeData: { status: oldStatus },
      afterData: { status: newStatus },
      changes: {
        status: { old: oldStatus, new: newStatus },
      },
      metadata: {
        dealName,
        oldStatus,
        newStatus,
      },
      severity: newStatus === 'closed_won' || newStatus === 'closed_lost' ? 'critical' : 'info',
      isSuccess: true,
    });
  }

  static async logDealDelete(
    req: Request,
    dealId: string,
    dealName: string
  ): Promise<void> {
    const context = this.extractContext(req);

    await this.log(context, {
      eventType: 'delete',
      entityType: 'deal',
      entityId: dealId,
      action: `Deal deleted: ${dealName}`,
      beforeData: { dealName },
      metadata: {
        dealName,
      },
      severity: 'warning',
      isSuccess: true,
    });
  }

  static async logLogin(
    req: Request,
    userId: string,
    email: string,
    success: boolean,
    failureReason?: string
  ): Promise<void> {
    const context = this.extractContext(req);
    context.userId = userId;

    await this.log(context, {
      eventType: 'login',
      entityType: 'auth',
      entityId: userId,
      action: success ? `User logged in: ${email}` : `Login failed: ${email}`,
      metadata: {
        email,
        success,
        failureReason,
      },
      severity: success ? 'info' : 'warning',
      isSuccess: success,
      errorMessage: failureReason,
    });
  }

  static async logLogout(
    req: Request
  ): Promise<void> {
    const context = this.extractContext(req);
    const user = (req as any).user;

    await this.log(context, {
      eventType: 'logout',
      entityType: 'auth',
      entityId: user?.id,
      action: `User logged out: ${user?.email || 'unknown'}`,
      metadata: {
        email: user?.email,
      },
      severity: 'info',
      isSuccess: true,
    });
  }

  static async logDataExport(
    req: Request,
    exportType: string,
    entityType: string,
    recordCount: number,
    format: 'json' | 'csv' | 'xml' | 'pdf' | 'excel'
  ): Promise<void> {
    const context = this.extractContext(req);

    await this.log(context, {
      eventType: 'export',
      entityType: 'data_export',
      action: `Exported ${recordCount} ${entityType} records as ${format.toUpperCase()}`,
      metadata: {
        exportType,
        entityType,
        recordCount,
        format,
      },
      severity: 'info',
      isSuccess: true,
    });
  }

  static async logSecurityEvent(
    req: Request,
    eventType: 'permission_denied' | 'rate_limited' | 'invalid_token' | 'suspicious_activity',
    details: Record<string, any>
  ): Promise<void> {
    const context = this.extractContext(req);

    await this.log(context, {
      eventType: eventType,
      entityType: 'security',
      action: `Security event: ${eventType.replace(/_/g, ' ')}`,
      metadata: details,
      severity: 'critical',
      isSuccess: false,
    });
  }

  static async logVDRAccess(
    req: Request,
    action: 'view' | 'download' | 'upload' | 'delete' | 'share',
    fileId: string,
    fileName: string,
    folderId?: string
  ): Promise<void> {
    const context = this.extractContext(req);

    await this.log(context, {
      eventType: action,
      entityType: 'vdr_file',
      entityId: fileId,
      action: `VDR ${action}: ${fileName}`,
      metadata: {
        fileName,
        folderId,
        action,
      },
      severity: action === 'delete' ? 'warning' : 'info',
      isSuccess: true,
    });
  }

  static async logModelingAction(
    req: Request,
    action: 'create' | 'update' | 'delete' | 'approve' | 'reject' | 'lock' | 'export',
    projectId: string,
    scenarioType?: string,
    details?: Record<string, any>
  ): Promise<void> {
    const context = this.extractContext(req);

    await this.log(context, {
      eventType: action,
      entityType: 'modeling_project',
      entityId: projectId,
      action: `Modeling ${action}${scenarioType ? ` (${scenarioType})` : ''}`,
      metadata: {
        scenarioType,
        ...details,
      },
      severity: ['approve', 'reject', 'lock', 'delete'].includes(action) ? 'critical' : 'info',
      isSuccess: true,
    });
  }

  static async searchAuditLogs(
    orgId: string,
    filters: {
      entityTypes?: string[];
      actions?: string[];
      userIds?: string[];
      startDate?: Date;
      endDate?: Date;
      searchTerm?: string;
      severity?: ('info' | 'warning' | 'critical')[];
      page?: number;
      pageSize?: number;
    }
  ): Promise<{ logs: any[]; total: number; page: number; pageSize: number }> {
    const page = filters.page || 1;
    const pageSize = Math.min(filters.pageSize || 50, 500);
    const offset = (page - 1) * pageSize;

    const conditions: any[] = [eq(auditLogs.orgId, orgId)];

    if (filters.entityTypes?.length) {
      conditions.push(inArray(auditLogs.entityType, filters.entityTypes));
    }
    if (filters.actions?.length) {
      conditions.push(inArray(auditLogs.action, filters.actions));
    }
    if (filters.userIds?.length) {
      conditions.push(inArray(auditLogs.userId, filters.userIds));
    }
    if (filters.startDate) {
      conditions.push(gte(auditLogs.createdAt, filters.startDate));
    }
    if (filters.endDate) {
      conditions.push(lte(auditLogs.createdAt, filters.endDate));
    }
    if (filters.searchTerm) {
      conditions.push(
        or(
          like(auditLogs.action, `%${filters.searchTerm}%`),
          like(auditLogs.entityType, `%${filters.searchTerm}%`)
        )
      );
    }

    const whereClause = conditions.length > 1 ? and(...conditions) : conditions[0];

    const [logs, countResult] = await Promise.all([
      db
        .select({
          id: auditLogs.id,
          orgId: auditLogs.orgId,
          userId: auditLogs.userId,
          entityType: auditLogs.entityType,
          entityId: auditLogs.entityId,
          action: auditLogs.action,
          before: auditLogs.before,
          after: auditLogs.after,
          ipAddress: auditLogs.ipAddress,
          userAgent: auditLogs.userAgent,
          metadata: auditLogs.metadata,
          createdAt: auditLogs.createdAt,
          userName: users.name,
          userEmail: users.email,
        })
        .from(auditLogs)
        .leftJoin(users, eq(auditLogs.userId, users.id))
        .where(whereClause)
        .orderBy(desc(auditLogs.createdAt))
        .limit(pageSize)
        .offset(offset),
      db
        .select({ total: count() })
        .from(auditLogs)
        .where(whereClause),
    ]);

    return {
      logs,
      total: Number(countResult[0]?.total || 0),
      page,
      pageSize,
    };
  }

  static async getSecurityEvents(
    orgId: string,
    filters: {
      eventTypes?: string[];
      userIds?: string[];
      startDate?: Date;
      endDate?: Date;
      successOnly?: boolean;
      page?: number;
      pageSize?: number;
    }
  ): Promise<{ events: any[]; total: number }> {
    const page = filters.page || 1;
    const pageSize = Math.min(filters.pageSize || 50, 500);
    const offset = (page - 1) * pageSize;

    const conditions: any[] = [eq(securityAuditLog.orgId, orgId)];

    if (filters.eventTypes?.length) {
      conditions.push(inArray(securityAuditLog.eventType, filters.eventTypes));
    }
    if (filters.userIds?.length) {
      conditions.push(inArray(securityAuditLog.userId, filters.userIds));
    }
    if (filters.startDate) {
      conditions.push(gte(securityAuditLog.createdAt, filters.startDate));
    }
    if (filters.endDate) {
      conditions.push(lte(securityAuditLog.createdAt, filters.endDate));
    }
    if (filters.successOnly !== undefined) {
      conditions.push(eq(securityAuditLog.success, filters.successOnly));
    }

    const whereClause = conditions.length > 1 ? and(...conditions) : conditions[0];

    const [events, countResult] = await Promise.all([
      db
        .select({
          id: securityAuditLog.id,
          userId: securityAuditLog.userId,
          orgId: securityAuditLog.orgId,
          eventType: securityAuditLog.eventType,
          eventDetails: securityAuditLog.eventDetails,
          ipAddress: securityAuditLog.ipAddress,
          userAgent: securityAuditLog.userAgent,
          success: securityAuditLog.success,
          createdAt: securityAuditLog.createdAt,
          userName: users.name,
          userEmail: users.email,
        })
        .from(securityAuditLog)
        .leftJoin(users, eq(securityAuditLog.userId, users.id))
        .where(whereClause)
        .orderBy(desc(securityAuditLog.createdAt))
        .limit(pageSize)
        .offset(offset),
      db
        .select({ total: count() })
        .from(securityAuditLog)
        .where(whereClause),
    ]);

    return {
      events,
      total: Number(countResult[0]?.total || 0),
    };
  }

  static async getAuditStats(orgId: string, days: number = 30): Promise<{
    totalEvents: number;
    eventsByType: Record<string, number>;
    eventsByAction: Record<string, number>;
    recentActivity: { date: string; count: number }[];
    topUsers: { userId: string; userName: string; count: number }[];
    securitySummary: {
      loginSuccess: number;
      loginFailures: number;
      mfaEvents: number;
      passwordChanges: number;
    };
  }> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const [
      totalEventsResult,
      eventsByTypeResult,
      eventsByActionResult,
      dailyActivityResult,
      topUsersResult,
      securityStatsResult,
    ] = await Promise.all([
      db
        .select({ total: count() })
        .from(auditLogs)
        .where(and(eq(auditLogs.orgId, orgId), gte(auditLogs.createdAt, startDate))),

      db
        .select({ entityType: auditLogs.entityType, count: count() })
        .from(auditLogs)
        .where(and(eq(auditLogs.orgId, orgId), gte(auditLogs.createdAt, startDate)))
        .groupBy(auditLogs.entityType),

      db
        .select({ action: auditLogs.action, count: count() })
        .from(auditLogs)
        .where(and(eq(auditLogs.orgId, orgId), gte(auditLogs.createdAt, startDate)))
        .groupBy(auditLogs.action)
        .limit(20),

      db.execute(sql`
        SELECT DATE(created_at) as date, COUNT(*) as count
        FROM audit_logs
        WHERE org_id = ${orgId} AND created_at >= ${startDate}
        GROUP BY DATE(created_at)
        ORDER BY date DESC
        LIMIT 30
      `),

      db
        .select({ userId: auditLogs.userId, userName: users.name, count: count() })
        .from(auditLogs)
        .leftJoin(users, eq(auditLogs.userId, users.id))
        .where(and(eq(auditLogs.orgId, orgId), gte(auditLogs.createdAt, startDate)))
        .groupBy(auditLogs.userId, users.name)
        .orderBy(desc(count()))
        .limit(10),

      db.execute(sql`
        SELECT 
          SUM(CASE WHEN event_type = 'login_success' THEN 1 ELSE 0 END) as login_success,
          SUM(CASE WHEN event_type = 'login_failure' THEN 1 ELSE 0 END) as login_failures,
          SUM(CASE WHEN event_type LIKE 'mfa%' THEN 1 ELSE 0 END) as mfa_events,
          SUM(CASE WHEN event_type = 'password_change' THEN 1 ELSE 0 END) as password_changes
        FROM security_audit_log
        WHERE org_id = ${orgId} AND created_at >= ${startDate}
      `),
    ]);

    const eventsByType: Record<string, number> = {};
    for (const row of eventsByTypeResult) {
      eventsByType[row.entityType] = Number(row.count);
    }

    const eventsByAction: Record<string, number> = {};
    for (const row of eventsByActionResult) {
      eventsByAction[row.action] = Number(row.count);
    }

    const securityRow = (securityStatsResult.rows?.[0] || {}) as any;

    return {
      totalEvents: Number(totalEventsResult[0]?.total || 0),
      eventsByType,
      eventsByAction,
      recentActivity: (dailyActivityResult.rows || []).map((r: any) => ({
        date: r.date,
        count: Number(r.count),
      })),
      topUsers: topUsersResult.map((r) => ({
        userId: r.userId,
        userName: r.userName || 'Unknown',
        count: Number(r.count),
      })),
      securitySummary: {
        loginSuccess: Number(securityRow.login_success || 0),
        loginFailures: Number(securityRow.login_failures || 0),
        mfaEvents: Number(securityRow.mfa_events || 0),
        passwordChanges: Number(securityRow.password_changes || 0),
      },
    };
  }

  static async exportAuditLogs(
    orgId: string,
    format: 'json' | 'csv',
    filters: {
      entityTypes?: string[];
      startDate?: Date;
      endDate?: Date;
      maxRecords?: number;
    }
  ): Promise<{ data: string; filename: string; mimeType: string }> {
    const maxRecords = Math.min(filters.maxRecords || 10000, 50000);

    const conditions: any[] = [eq(auditLogs.orgId, orgId)];
    if (filters.entityTypes?.length) {
      conditions.push(inArray(auditLogs.entityType, filters.entityTypes));
    }
    if (filters.startDate) {
      conditions.push(gte(auditLogs.createdAt, filters.startDate));
    }
    if (filters.endDate) {
      conditions.push(lte(auditLogs.createdAt, filters.endDate));
    }

    const whereClause = conditions.length > 1 ? and(...conditions) : conditions[0];

    const logs = await db
      .select({
        id: auditLogs.id,
        userId: auditLogs.userId,
        entityType: auditLogs.entityType,
        entityId: auditLogs.entityId,
        action: auditLogs.action,
        ipAddress: auditLogs.ipAddress,
        createdAt: auditLogs.createdAt,
        userName: users.name,
        userEmail: users.email,
      })
      .from(auditLogs)
      .leftJoin(users, eq(auditLogs.userId, users.id))
      .where(whereClause)
      .orderBy(desc(auditLogs.createdAt))
      .limit(maxRecords);

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

    if (format === 'csv') {
      const headers = ['ID', 'Timestamp', 'User', 'Email', 'Entity Type', 'Entity ID', 'Action', 'IP Address'];
      const rows = logs.map((log) => [
        log.id,
        log.createdAt.toISOString(),
        log.userName || '',
        log.userEmail || '',
        log.entityType,
        log.entityId,
        log.action,
        log.ipAddress || '',
      ]);
      
      const escapeCSV = (val: any) => {
        const str = String(val ?? '');
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      };

      const csvContent = [
        headers.map(escapeCSV).join(','),
        ...rows.map((row) => row.map(escapeCSV).join(',')),
      ].join('\n');

      return {
        data: csvContent,
        filename: `audit_logs_${timestamp}.csv`,
        mimeType: 'text/csv',
      };
    } else {
      return {
        data: JSON.stringify(logs, null, 2),
        filename: `audit_logs_${timestamp}.json`,
        mimeType: 'application/json',
      };
    }
  }
}

/**
 * Standalone utility to write security events to the security_audit_log table.
 * Use this for auth events, permission denials, and other security-sensitive actions
 * that should be tracked separately from general audit logs.
 */
export async function logSecurityEvent(params: {
  userId?: string | null;
  orgId?: string | null;
  eventType: string;
  eventDetails?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  success?: boolean;
}): Promise<void> {
  try {
    await db.insert(securityAuditLog).values({
      userId: params.userId || null,
      orgId: params.orgId || null,
      eventType: params.eventType,
      eventDetails: params.eventDetails || {},
      ipAddress: params.ipAddress || null,
      userAgent: params.userAgent || null,
      success: params.success !== false,
    });
  } catch (err) {
    logger.error({ error: err }, 'Failed to write audit log');
  }
}
