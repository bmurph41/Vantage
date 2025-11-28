import { db } from '../db';
import { vdrAuditLogs, vdrDocumentPermissions, users, externalUsers, vdrDocuments, vdrFolders } from '@shared/schema';
import { eq, and, desc, sql, inArray, isNotNull, between, or, count } from 'drizzle-orm';
import { Request } from 'express';
import UAParser from 'ua-parser-js';

export type VdrAuditEventType = 
  | 'document_viewed'
  | 'document_downloaded'
  | 'document_printed'
  | 'document_uploaded'
  | 'document_updated'
  | 'document_moved'
  | 'document_deleted'
  | 'document_version_created'
  | 'document_restored'
  | 'folder_created'
  | 'folder_updated'
  | 'folder_deleted'
  | 'folder_moved'
  | 'permission_granted'
  | 'permission_revoked'
  | 'permission_modified'
  | 'permission_inherited'
  | 'external_user_invited'
  | 'external_user_accessed'
  | 'external_user_revoked'
  | 'watermark_applied'
  | 'watermark_removed'
  | 'bulk_download'
  | 'search_performed'
  | 'export_generated';

export interface AuditLogParams {
  projectId: string;
  orgId: string;
  userId?: string;
  externalUserId?: string;
  documentId?: string;
  folderId?: string;
  eventType: VdrAuditEventType;
  metadata?: Record<string, any>;
  duration?: number;
  req?: Request;
}

export interface PermissionChangeParams {
  projectId: string;
  orgId: string;
  grantedBy: string;
  targetUserId?: string;
  targetExternalUserId?: string;
  resourceType: 'document' | 'folder' | 'project';
  resourceId: string;
  oldPermission?: string;
  newPermission: string;
  action: 'granted' | 'revoked' | 'modified';
  req?: Request;
}

export interface AuditReportFilters {
  projectId?: string;
  documentId?: string;
  folderId?: string;
  userId?: string;
  externalUserId?: string;
  eventTypes?: VdrAuditEventType[];
  startDate?: Date;
  endDate?: Date;
  ipAddress?: string;
  limit?: number;
  offset?: number;
}

export interface EngagementMetrics {
  uniqueViewers: number;
  totalViews: number;
  totalDownloads: number;
  totalPrints: number;
  avgViewDuration: number;
  mostViewedDocuments: Array<{
    documentId: string;
    documentName: string;
    viewCount: number;
    downloadCount: number;
  }>;
  userActivity: Array<{
    userId: string | null;
    externalUserId: string | null;
    userName: string;
    viewCount: number;
    downloadCount: number;
    lastActivity: Date;
  }>;
  activityByDay: Array<{
    date: string;
    views: number;
    downloads: number;
  }>;
}

class VdrAuditService {
  private extractDeviceInfo(req: Request): { 
    ipAddress: string; 
    userAgent: string; 
    deviceInfo: Record<string, any>;
  } {
    const ipAddress = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() 
      || req.socket?.remoteAddress 
      || 'unknown';
    
    const userAgent = req.headers['user-agent'] || 'unknown';
    
    const parser = new UAParser(userAgent);
    const result = parser.getResult();
    
    const deviceInfo = {
      browser: result.browser?.name || 'unknown',
      browserVersion: result.browser?.version || 'unknown',
      os: result.os?.name || 'unknown',
      osVersion: result.os?.version || 'unknown',
      deviceType: result.device?.type || 'desktop',
      deviceVendor: result.device?.vendor || 'unknown',
    };
    
    return { ipAddress, userAgent, deviceInfo };
  }

  async logEvent(params: AuditLogParams): Promise<void> {
    try {
      const { projectId, orgId, userId, externalUserId, documentId, folderId, eventType, metadata = {}, duration, req } = params;
      
      let ipAddress = 'unknown';
      let userAgent = 'unknown';
      let deviceInfo = {};
      
      if (req) {
        const extracted = this.extractDeviceInfo(req);
        ipAddress = extracted.ipAddress;
        userAgent = extracted.userAgent;
        deviceInfo = extracted.deviceInfo;
      }
      
      await db.insert(vdrAuditLogs).values({
        documentId: documentId || null,
        folderId: folderId || null,
        userId: userId || null,
        externalUserId: externalUserId || null,
        eventType: eventType as any,
        duration: duration || null,
        ipAddress,
        userAgent,
        deviceInfo,
        metadata: {
          ...metadata,
          projectId,
        },
        orgId,
        timestamp: new Date(),
      });
    } catch (error) {
      console.error('Failed to log VDR audit event:', error);
    }
  }

  async logPermissionChange(params: PermissionChangeParams): Promise<void> {
    try {
      const { 
        projectId, orgId, grantedBy, targetUserId, targetExternalUserId,
        resourceType, resourceId, oldPermission, newPermission, action, req 
      } = params;
      
      const eventType: VdrAuditEventType = action === 'granted' 
        ? 'permission_granted' 
        : action === 'revoked' 
          ? 'permission_revoked' 
          : 'permission_modified';
      
      let ipAddress = 'unknown';
      let userAgent = 'unknown';
      let deviceInfo = {};
      
      if (req) {
        const extracted = this.extractDeviceInfo(req);
        ipAddress = extracted.ipAddress;
        userAgent = extracted.userAgent;
        deviceInfo = extracted.deviceInfo;
      }
      
      let resourceName = '';
      if (resourceType === 'document') {
        const doc = await db.query.vdrDocuments.findFirst({
          where: eq(vdrDocuments.id, resourceId)
        });
        resourceName = doc?.filename || 'Unknown document';
      } else if (resourceType === 'folder') {
        const folder = await db.query.vdrFolders.findFirst({
          where: eq(vdrFolders.id, resourceId)
        });
        resourceName = folder?.name || 'Unknown folder';
      }
      
      let targetUserName = '';
      if (targetUserId) {
        const user = await db.query.users.findFirst({
          where: eq(users.id, targetUserId)
        });
        targetUserName = user?.name || user?.email || 'Unknown user';
      } else if (targetExternalUserId) {
        const extUser = await db.query.externalUsers.findFirst({
          where: eq(externalUsers.id, targetExternalUserId)
        });
        targetUserName = extUser?.name || extUser?.email || 'External user';
      }
      
      await db.insert(vdrAuditLogs).values({
        documentId: resourceType === 'document' ? resourceId : null,
        folderId: resourceType === 'folder' ? resourceId : null,
        userId: grantedBy,
        externalUserId: null,
        eventType: eventType as any,
        duration: null,
        ipAddress,
        userAgent,
        deviceInfo,
        metadata: {
          projectId,
          action,
          resourceType,
          resourceName,
          targetUserId,
          targetExternalUserId,
          targetUserName,
          oldPermission: oldPermission || null,
          newPermission,
          permissionChange: oldPermission 
            ? `${oldPermission} → ${newPermission}` 
            : `Granted: ${newPermission}`,
        },
        orgId,
        timestamp: new Date(),
      });
    } catch (error) {
      console.error('Failed to log permission change:', error);
    }
  }

  async getAuditReport(orgId: string, filters: AuditReportFilters = {}): Promise<any[]> {
    const conditions = [eq(vdrAuditLogs.orgId, orgId)];
    
    if (filters.projectId) {
      conditions.push(sql`${vdrAuditLogs.metadata}->>'projectId' = ${filters.projectId}`);
    }
    if (filters.documentId) {
      conditions.push(eq(vdrAuditLogs.documentId, filters.documentId));
    }
    if (filters.folderId) {
      conditions.push(eq(vdrAuditLogs.folderId, filters.folderId));
    }
    if (filters.userId) {
      conditions.push(eq(vdrAuditLogs.userId, filters.userId));
    }
    if (filters.externalUserId) {
      conditions.push(eq(vdrAuditLogs.externalUserId, filters.externalUserId));
    }
    if (filters.eventTypes && filters.eventTypes.length > 0) {
      conditions.push(inArray(vdrAuditLogs.eventType, filters.eventTypes as any));
    }
    if (filters.startDate && filters.endDate) {
      conditions.push(between(vdrAuditLogs.timestamp, filters.startDate, filters.endDate));
    } else if (filters.startDate) {
      conditions.push(sql`${vdrAuditLogs.timestamp} >= ${filters.startDate}`);
    } else if (filters.endDate) {
      conditions.push(sql`${vdrAuditLogs.timestamp} <= ${filters.endDate}`);
    }
    if (filters.ipAddress) {
      conditions.push(eq(vdrAuditLogs.ipAddress, filters.ipAddress));
    }
    
    const limit = filters.limit || 500;
    const offset = filters.offset || 0;
    
    const logs = await db
      .select({
        id: vdrAuditLogs.id,
        documentId: vdrAuditLogs.documentId,
        folderId: vdrAuditLogs.folderId,
        userId: vdrAuditLogs.userId,
        externalUserId: vdrAuditLogs.externalUserId,
        eventType: vdrAuditLogs.eventType,
        duration: vdrAuditLogs.duration,
        ipAddress: vdrAuditLogs.ipAddress,
        userAgent: vdrAuditLogs.userAgent,
        deviceInfo: vdrAuditLogs.deviceInfo,
        metadata: vdrAuditLogs.metadata,
        timestamp: vdrAuditLogs.timestamp,
      })
      .from(vdrAuditLogs)
      .where(and(...conditions))
      .orderBy(desc(vdrAuditLogs.timestamp))
      .limit(limit)
      .offset(offset);
    
    const enrichedLogs = await Promise.all(
      logs.map(async (log) => {
        let userName = 'Unknown';
        let documentName = null;
        let folderName = null;
        
        if (log.userId) {
          const user = await db.query.users.findFirst({
            where: eq(users.id, log.userId)
          });
          userName = user?.name || user?.email || 'Unknown';
        } else if (log.externalUserId) {
          const extUser = await db.query.externalUsers.findFirst({
            where: eq(externalUsers.id, log.externalUserId)
          });
          userName = extUser?.name || extUser?.email || 'External user';
        }
        
        if (log.documentId) {
          const doc = await db.query.vdrDocuments.findFirst({
            where: eq(vdrDocuments.id, log.documentId)
          });
          documentName = doc?.filename || null;
        }
        
        if (log.folderId) {
          const folder = await db.query.vdrFolders.findFirst({
            where: eq(vdrFolders.id, log.folderId)
          });
          folderName = folder?.name || null;
        }
        
        return {
          ...log,
          userName,
          documentName,
          folderName,
        };
      })
    );
    
    return enrichedLogs;
  }

  async getPermissionHistory(
    orgId: string, 
    resourceType: 'document' | 'folder' | 'project',
    resourceId: string,
    limit: number = 100
  ): Promise<any[]> {
    const conditions = [
      eq(vdrAuditLogs.orgId, orgId),
      or(
        eq(vdrAuditLogs.eventType, 'permission_granted' as any),
        eq(vdrAuditLogs.eventType, 'permission_revoked' as any),
        eq(vdrAuditLogs.eventType, 'permission_modified' as any)
      ),
    ];
    
    if (resourceType === 'document') {
      conditions.push(eq(vdrAuditLogs.documentId, resourceId));
    } else if (resourceType === 'folder') {
      conditions.push(eq(vdrAuditLogs.folderId, resourceId));
    } else {
      conditions.push(sql`${vdrAuditLogs.metadata}->>'projectId' = ${resourceId}`);
    }
    
    const logs = await db
      .select()
      .from(vdrAuditLogs)
      .where(and(...conditions))
      .orderBy(desc(vdrAuditLogs.timestamp))
      .limit(limit);
    
    return logs;
  }

  async getEngagementMetrics(orgId: string, projectId: string): Promise<EngagementMetrics> {
    const baseConditions = [
      eq(vdrAuditLogs.orgId, orgId),
      sql`${vdrAuditLogs.metadata}->>'projectId' = ${projectId}`,
    ];
    
    const viewEventTypes = ['document_viewed', 'document_previewed'];
    
    const uniqueViewersResult = await db
      .select({ 
        count: sql<number>`COUNT(DISTINCT COALESCE(${vdrAuditLogs.userId}, ${vdrAuditLogs.externalUserId}))` 
      })
      .from(vdrAuditLogs)
      .where(and(
        ...baseConditions,
        inArray(vdrAuditLogs.eventType, viewEventTypes as any)
      ));
    
    const totalViewsResult = await db
      .select({ count: count() })
      .from(vdrAuditLogs)
      .where(and(
        ...baseConditions,
        inArray(vdrAuditLogs.eventType, viewEventTypes as any)
      ));
    
    const totalDownloadsResult = await db
      .select({ count: count() })
      .from(vdrAuditLogs)
      .where(and(
        ...baseConditions,
        eq(vdrAuditLogs.eventType, 'document_downloaded' as any)
      ));
    
    const totalPrintsResult = await db
      .select({ count: count() })
      .from(vdrAuditLogs)
      .where(and(
        ...baseConditions,
        eq(vdrAuditLogs.eventType, 'document_printed' as any)
      ));
    
    const avgDurationResult = await db
      .select({ 
        avg: sql<number>`COALESCE(AVG(${vdrAuditLogs.duration}), 0)` 
      })
      .from(vdrAuditLogs)
      .where(and(
        ...baseConditions,
        isNotNull(vdrAuditLogs.duration)
      ));
    
    const mostViewedDocs = await db
      .select({
        documentId: vdrAuditLogs.documentId,
        viewCount: sql<number>`COUNT(CASE WHEN ${vdrAuditLogs.eventType} IN ('document_viewed', 'document_previewed') THEN 1 END)`,
        downloadCount: sql<number>`COUNT(CASE WHEN ${vdrAuditLogs.eventType} = 'document_downloaded' THEN 1 END)`,
      })
      .from(vdrAuditLogs)
      .where(and(
        ...baseConditions,
        isNotNull(vdrAuditLogs.documentId)
      ))
      .groupBy(vdrAuditLogs.documentId)
      .orderBy(desc(sql`COUNT(CASE WHEN ${vdrAuditLogs.eventType} IN ('document_viewed', 'document_previewed') THEN 1 END)`))
      .limit(10);
    
    const mostViewedWithNames = await Promise.all(
      mostViewedDocs.map(async (doc) => {
        const document = await db.query.vdrDocuments.findFirst({
          where: eq(vdrDocuments.id, doc.documentId!)
        });
        return {
          documentId: doc.documentId!,
          documentName: document?.filename || 'Unknown',
          viewCount: Number(doc.viewCount),
          downloadCount: Number(doc.downloadCount),
        };
      })
    );
    
    const userActivityRaw = await db
      .select({
        userId: vdrAuditLogs.userId,
        externalUserId: vdrAuditLogs.externalUserId,
        viewCount: sql<number>`COUNT(CASE WHEN ${vdrAuditLogs.eventType} IN ('document_viewed', 'document_previewed') THEN 1 END)`,
        downloadCount: sql<number>`COUNT(CASE WHEN ${vdrAuditLogs.eventType} = 'document_downloaded' THEN 1 END)`,
        lastActivity: sql<Date>`MAX(${vdrAuditLogs.timestamp})`,
      })
      .from(vdrAuditLogs)
      .where(and(...baseConditions))
      .groupBy(vdrAuditLogs.userId, vdrAuditLogs.externalUserId)
      .orderBy(desc(sql`MAX(${vdrAuditLogs.timestamp})`))
      .limit(20);
    
    const userActivity = await Promise.all(
      userActivityRaw.map(async (ua) => {
        let userName = 'Unknown';
        if (ua.userId) {
          const user = await db.query.users.findFirst({
            where: eq(users.id, ua.userId)
          });
          userName = user?.name || user?.email || 'Unknown';
        } else if (ua.externalUserId) {
          const extUser = await db.query.externalUsers.findFirst({
            where: eq(externalUsers.id, ua.externalUserId)
          });
          userName = extUser?.name || extUser?.email || 'External user';
        }
        return {
          userId: ua.userId,
          externalUserId: ua.externalUserId,
          userName,
          viewCount: Number(ua.viewCount),
          downloadCount: Number(ua.downloadCount),
          lastActivity: ua.lastActivity,
        };
      })
    );
    
    const activityByDay = await db
      .select({
        date: sql<string>`DATE(${vdrAuditLogs.timestamp})`,
        views: sql<number>`COUNT(CASE WHEN ${vdrAuditLogs.eventType} IN ('document_viewed', 'document_previewed') THEN 1 END)`,
        downloads: sql<number>`COUNT(CASE WHEN ${vdrAuditLogs.eventType} = 'document_downloaded' THEN 1 END)`,
      })
      .from(vdrAuditLogs)
      .where(and(...baseConditions))
      .groupBy(sql`DATE(${vdrAuditLogs.timestamp})`)
      .orderBy(desc(sql`DATE(${vdrAuditLogs.timestamp})`))
      .limit(30);
    
    return {
      uniqueViewers: Number(uniqueViewersResult[0]?.count || 0),
      totalViews: Number(totalViewsResult[0]?.count || 0),
      totalDownloads: Number(totalDownloadsResult[0]?.count || 0),
      totalPrints: Number(totalPrintsResult[0]?.count || 0),
      avgViewDuration: Number(avgDurationResult[0]?.avg || 0),
      mostViewedDocuments: mostViewedWithNames,
      userActivity,
      activityByDay: activityByDay.map(d => ({
        date: String(d.date),
        views: Number(d.views),
        downloads: Number(d.downloads),
      })),
    };
  }

  async getAccessSummary(orgId: string, documentId: string): Promise<{
    totalViews: number;
    totalDownloads: number;
    uniqueViewers: number;
    lastAccessed: Date | null;
    recentViewers: Array<{ name: string; timestamp: Date }>;
  }> {
    const totalViewsResult = await db
      .select({ count: count() })
      .from(vdrAuditLogs)
      .where(and(
        eq(vdrAuditLogs.orgId, orgId),
        eq(vdrAuditLogs.documentId, documentId),
        inArray(vdrAuditLogs.eventType, ['document_viewed', 'document_previewed'] as any)
      ));
    
    const totalDownloadsResult = await db
      .select({ count: count() })
      .from(vdrAuditLogs)
      .where(and(
        eq(vdrAuditLogs.orgId, orgId),
        eq(vdrAuditLogs.documentId, documentId),
        eq(vdrAuditLogs.eventType, 'document_downloaded' as any)
      ));
    
    const uniqueViewersResult = await db
      .select({ 
        count: sql<number>`COUNT(DISTINCT COALESCE(${vdrAuditLogs.userId}, ${vdrAuditLogs.externalUserId}))` 
      })
      .from(vdrAuditLogs)
      .where(and(
        eq(vdrAuditLogs.orgId, orgId),
        eq(vdrAuditLogs.documentId, documentId)
      ));
    
    const lastAccessedResult = await db
      .select({ timestamp: vdrAuditLogs.timestamp })
      .from(vdrAuditLogs)
      .where(and(
        eq(vdrAuditLogs.orgId, orgId),
        eq(vdrAuditLogs.documentId, documentId)
      ))
      .orderBy(desc(vdrAuditLogs.timestamp))
      .limit(1);
    
    const recentViewersRaw = await db
      .select({
        userId: vdrAuditLogs.userId,
        externalUserId: vdrAuditLogs.externalUserId,
        timestamp: vdrAuditLogs.timestamp,
      })
      .from(vdrAuditLogs)
      .where(and(
        eq(vdrAuditLogs.orgId, orgId),
        eq(vdrAuditLogs.documentId, documentId),
        inArray(vdrAuditLogs.eventType, ['document_viewed', 'document_previewed'] as any)
      ))
      .orderBy(desc(vdrAuditLogs.timestamp))
      .limit(5);
    
    const recentViewers = await Promise.all(
      recentViewersRaw.map(async (v) => {
        let name = 'Unknown';
        if (v.userId) {
          const user = await db.query.users.findFirst({
            where: eq(users.id, v.userId)
          });
          name = user?.name || user?.email || 'Unknown';
        } else if (v.externalUserId) {
          const extUser = await db.query.externalUsers.findFirst({
            where: eq(externalUsers.id, v.externalUserId)
          });
          name = extUser?.name || extUser?.email || 'External user';
        }
        return { name, timestamp: v.timestamp };
      })
    );
    
    return {
      totalViews: Number(totalViewsResult[0]?.count || 0),
      totalDownloads: Number(totalDownloadsResult[0]?.count || 0),
      uniqueViewers: Number(uniqueViewersResult[0]?.count || 0),
      lastAccessed: lastAccessedResult[0]?.timestamp || null,
      recentViewers,
    };
  }

  async exportAuditLog(orgId: string, filters: AuditReportFilters = {}): Promise<string> {
    const logs = await this.getAuditReport(orgId, { ...filters, limit: 10000 });
    
    const headers = [
      'Timestamp',
      'Event Type',
      'User',
      'Document',
      'Folder',
      'IP Address',
      'Device',
      'Browser',
      'Duration (seconds)',
      'Details'
    ];
    
    const rows = logs.map(log => {
      const deviceInfo = log.deviceInfo as Record<string, any> || {};
      return [
        new Date(log.timestamp).toISOString(),
        log.eventType,
        log.userName,
        log.documentName || '',
        log.folderName || '',
        log.ipAddress,
        deviceInfo.deviceType || 'unknown',
        deviceInfo.browser || 'unknown',
        log.duration?.toString() || '',
        JSON.stringify(log.metadata || {})
      ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',');
    });
    
    return [headers.join(','), ...rows].join('\n');
  }
}

export const vdrAuditService = new VdrAuditService();
