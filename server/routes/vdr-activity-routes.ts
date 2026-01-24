import { Router, Request, Response } from 'express';
import { db } from '../db';
import { vdrAuditLogs, vdrDocuments, vdrFolders, users, projects } from '@shared/schema';
import { eq, and, desc, gte, lte, sql, or, inArray } from 'drizzle-orm';

export const vdrActivityRouter = Router();

function getUserId(req: Request): string | null {
  const user = (req as any).user;
  return user?.id || user?.claims?.sub || null;
}

function getOrgId(req: Request): string | null {
  return (req as any).orgId || (req as any).user?.orgId || null;
}

function requireUser(req: Request, res: Response): string | null {
  const userId = getUserId(req);
  if (!userId) {
    res.status(401).json({ error: 'Authentication required' });
    return null;
  }
  return userId;
}

interface ActivityItem {
  id: string;
  action: string;
  userId: string | null;
  userName: string;
  userEmail: string;
  userType: 'internal' | 'external';
  resourceType: 'document' | 'folder';
  resourceName: string;
  projectId: string | null;
  projectName: string;
  ipAddress: string | null;
  timestamp: Date;
  details?: string;
}

vdrActivityRouter.get('/api/vdr/activity', async (req: Request, res: Response) => {
  const userId = requireUser(req, res);
  if (!userId) return;
  const orgId = getOrgId(req);

  if (!orgId) {
    return res.status(400).json({ error: 'Organization required' });
  }

  try {
    const timeRange = (req.query.timeRange as string) || '7d';
    const projectId = req.query.projectId as string;
    const userType = req.query.userType as string;
    const limit = parseInt(req.query.limit as string) || 100;

    let startDate = new Date();
    switch (timeRange) {
      case '24h':
        startDate.setHours(startDate.getHours() - 24);
        break;
      case '7d':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(startDate.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(startDate.getDate() - 90);
        break;
      default:
        startDate.setDate(startDate.getDate() - 7);
    }

    const whereConditions = [
      eq(vdrAuditLogs.orgId, orgId),
      gte(vdrAuditLogs.timestamp, startDate),
    ];

    const auditLogs = await db
      .select({
        id: vdrAuditLogs.id,
        eventType: vdrAuditLogs.eventType,
        userId: vdrAuditLogs.userId,
        externalUserId: vdrAuditLogs.externalUserId,
        documentId: vdrAuditLogs.documentId,
        folderId: vdrAuditLogs.folderId,
        ipAddress: vdrAuditLogs.ipAddress,
        timestamp: vdrAuditLogs.timestamp,
        metadata: vdrAuditLogs.metadata,
      })
      .from(vdrAuditLogs)
      .where(and(...whereConditions))
      .orderBy(desc(vdrAuditLogs.timestamp))
      .limit(limit);

    const documentIds = auditLogs.filter(l => l.documentId).map(l => l.documentId!);
    const folderIds = auditLogs.filter(l => l.folderId).map(l => l.folderId!);
    const userIds = auditLogs.filter(l => l.userId).map(l => l.userId!);

    const [documentsData, foldersData, usersData] = await Promise.all([
      documentIds.length > 0 
        ? db.select({ id: vdrDocuments.id, name: vdrDocuments.name, projectId: vdrDocuments.projectId })
            .from(vdrDocuments)
            .where(inArray(vdrDocuments.id, documentIds))
        : [],
      folderIds.length > 0
        ? db.select({ id: vdrFolders.id, name: vdrFolders.name, projectId: vdrFolders.projectId })
            .from(vdrFolders)
            .where(inArray(vdrFolders.id, folderIds))
        : [],
      userIds.length > 0
        ? db.select({ id: users.id, name: users.name, email: users.email })
            .from(users)
            .where(inArray(users.id, userIds))
        : [],
    ]);

    const docMap = new Map(documentsData.map(d => [d.id, d]));
    const folderMap = new Map(foldersData.map(f => [f.id, f]));
    const userMap = new Map(usersData.map(u => [u.id, u]));

    const allProjectIds = [
      ...documentsData.filter(d => d.projectId).map(d => d.projectId!),
      ...foldersData.filter(f => f.projectId).map(f => f.projectId!),
    ];
    const projectsData = allProjectIds.length > 0
      ? await db.select({ id: projects.id, name: projects.name })
          .from(projects)
          .where(inArray(projects.id, allProjectIds))
      : [];
    const projectMap = new Map(projectsData.map(p => [p.id, p]));

    const activities: ActivityItem[] = auditLogs.map(log => {
      const doc = log.documentId ? docMap.get(log.documentId) : null;
      const folder = log.folderId ? folderMap.get(log.folderId) : null;
      const user = log.userId ? userMap.get(log.userId) : null;
      const projId = doc?.projectId || folder?.projectId;
      const project = projId ? projectMap.get(projId) : null;

      const isExternal = !!log.externalUserId;
      const metadata = log.metadata as Record<string, any> || {};

      return {
        id: log.id,
        action: log.eventType,
        userId: log.userId,
        userName: user?.name || metadata.externalUserName || 'External User',
        userEmail: user?.email || metadata.externalUserEmail || '',
        userType: isExternal ? 'external' as const : 'internal' as const,
        resourceType: log.documentId ? 'document' as const : 'folder' as const,
        resourceName: doc?.name || folder?.name || 'Unknown',
        projectId: projId || null,
        projectName: project?.name || 'Unknown Project',
        ipAddress: log.ipAddress,
        timestamp: log.timestamp,
        details: metadata.details,
      };
    });

    let filteredActivities = activities;
    if (userType && userType !== 'all') {
      filteredActivities = activities.filter(a => a.userType === userType);
    }
    if (projectId && projectId !== 'all') {
      filteredActivities = filteredActivities.filter(a => a.projectId === projectId);
    }

    res.json(filteredActivities);
  } catch (error) {
    console.error('Error fetching VDR activity:', error);
    res.status(500).json({ error: 'Failed to fetch VDR activity' });
  }
});

vdrActivityRouter.get('/api/vdr/activity/metrics', async (req: Request, res: Response) => {
  const userId = requireUser(req, res);
  if (!userId) return;
  const orgId = getOrgId(req);

  if (!orgId) {
    return res.status(400).json({ error: 'Organization required' });
  }

  try {
    const timeRange = (req.query.timeRange as string) || '7d';
    
    let startDate = new Date();
    switch (timeRange) {
      case '24h': startDate.setHours(startDate.getHours() - 24); break;
      case '7d': startDate.setDate(startDate.getDate() - 7); break;
      case '30d': startDate.setDate(startDate.getDate() - 30); break;
      case '90d': startDate.setDate(startDate.getDate() - 90); break;
      default: startDate.setDate(startDate.getDate() - 7);
    }

    const [viewCount, downloadCount, externalCount, securityEvents] = await Promise.all([
      db.select({ count: sql<number>`count(*)` })
        .from(vdrAuditLogs)
        .where(and(
          eq(vdrAuditLogs.orgId, orgId),
          eq(vdrAuditLogs.eventType, 'view'),
          gte(vdrAuditLogs.timestamp, startDate)
        )),
      db.select({ count: sql<number>`count(*)` })
        .from(vdrAuditLogs)
        .where(and(
          eq(vdrAuditLogs.orgId, orgId),
          eq(vdrAuditLogs.eventType, 'download'),
          gte(vdrAuditLogs.timestamp, startDate)
        )),
      db.select({ count: sql<number>`count(*)` })
        .from(vdrAuditLogs)
        .where(and(
          eq(vdrAuditLogs.orgId, orgId),
          sql`${vdrAuditLogs.externalUserId} IS NOT NULL`,
          gte(vdrAuditLogs.timestamp, startDate)
        )),
      db.select({ count: sql<number>`count(*)` })
        .from(vdrAuditLogs)
        .where(and(
          eq(vdrAuditLogs.orgId, orgId),
          or(
            eq(vdrAuditLogs.eventType, 'permission_change'),
            eq(vdrAuditLogs.eventType, 'share')
          ),
          gte(vdrAuditLogs.timestamp, startDate)
        )),
    ]);

    res.json({
      views: Number(viewCount[0]?.count || 0),
      downloads: Number(downloadCount[0]?.count || 0),
      externalAccess: Number(externalCount[0]?.count || 0),
      securityEvents: Number(securityEvents[0]?.count || 0),
    });
  } catch (error) {
    console.error('Error fetching VDR metrics:', error);
    res.status(500).json({ error: 'Failed to fetch VDR metrics' });
  }
});

vdrActivityRouter.get('/api/vdr/activity/chart', async (req: Request, res: Response) => {
  const userId = requireUser(req, res);
  if (!userId) return;
  const orgId = getOrgId(req);

  if (!orgId) {
    return res.status(400).json({ error: 'Organization required' });
  }

  try {
    const timeRange = (req.query.timeRange as string) || '7d';
    
    let startDate = new Date();
    let groupBy = 'day';
    switch (timeRange) {
      case '24h': 
        startDate.setHours(startDate.getHours() - 24); 
        groupBy = 'hour';
        break;
      case '7d': 
        startDate.setDate(startDate.getDate() - 7); 
        break;
      case '30d': 
        startDate.setDate(startDate.getDate() - 30); 
        break;
      case '90d': 
        startDate.setDate(startDate.getDate() - 90); 
        groupBy = 'week';
        break;
      default: 
        startDate.setDate(startDate.getDate() - 7);
    }

    const dateFormat = groupBy === 'hour' ? 'HH24:00' : groupBy === 'week' ? 'IYYY-IW' : 'YYYY-MM-DD';
    
    const chartData = await db
      .select({
        period: sql<string>`to_char(${vdrAuditLogs.timestamp}, ${dateFormat})`,
        eventType: vdrAuditLogs.eventType,
        count: sql<number>`count(*)`,
      })
      .from(vdrAuditLogs)
      .where(and(
        eq(vdrAuditLogs.orgId, orgId),
        gte(vdrAuditLogs.timestamp, startDate)
      ))
      .groupBy(sql`to_char(${vdrAuditLogs.timestamp}, ${dateFormat})`, vdrAuditLogs.eventType)
      .orderBy(sql`to_char(${vdrAuditLogs.timestamp}, ${dateFormat})`);

    const periodMap = new Map<string, { views: number; downloads: number; uploads: number }>();
    
    for (const row of chartData) {
      if (!periodMap.has(row.period)) {
        periodMap.set(row.period, { views: 0, downloads: 0, uploads: 0 });
      }
      const data = periodMap.get(row.period)!;
      if (row.eventType === 'view') data.views = Number(row.count);
      else if (row.eventType === 'download') data.downloads = Number(row.count);
      else if (row.eventType === 'document_uploaded') data.uploads = Number(row.count);
    }

    const result = Array.from(periodMap.entries()).map(([name, data]) => ({
      name,
      ...data,
    }));

    res.json(result);
  } catch (error) {
    console.error('Error fetching VDR chart data:', error);
    res.status(500).json({ error: 'Failed to fetch VDR chart data' });
  }
});

vdrActivityRouter.get('/api/vdr/activity/user-summary', async (req: Request, res: Response) => {
  const userId = requireUser(req, res);
  if (!userId) return;
  const orgId = getOrgId(req);

  if (!orgId) {
    return res.status(400).json({ error: 'Organization required' });
  }

  try {
    const timeRange = (req.query.timeRange as string) || '7d';
    
    let startDate = new Date();
    switch (timeRange) {
      case '24h': startDate.setHours(startDate.getHours() - 24); break;
      case '7d': startDate.setDate(startDate.getDate() - 7); break;
      case '30d': startDate.setDate(startDate.getDate() - 30); break;
      case '90d': startDate.setDate(startDate.getDate() - 90); break;
      default: startDate.setDate(startDate.getDate() - 7);
    }

    const userSummary = await db
      .select({
        usersId: vdrAuditLogs.userId,
        externalUserId: vdrAuditLogs.externalUserId,
        eventType: vdrAuditLogs.eventType,
        count: sql<number>`count(*)`,
        lastActivity: sql<Date>`max(${vdrAuditLogs.timestamp})`,
      })
      .from(vdrAuditLogs)
      .where(and(
        eq(vdrAuditLogs.orgId, orgId),
        gte(vdrAuditLogs.timestamp, startDate)
      ))
      .groupBy(vdrAuditLogs.userId, vdrAuditLogs.externalUserId, vdrAuditLogs.eventType);

    const userIds = userSummary.filter(s => s.usersId).map(s => s.usersId!);
    const usersData = userIds.length > 0
      ? await db.select({ id: users.id, name: users.name, email: users.email })
          .from(users)
          .where(inArray(users.id, userIds))
      : [];
    const userMap = new Map(usersData.map(u => [u.id, u]));

    const aggregated = new Map<string, {
      userId: string;
      userName: string;
      userEmail: string;
      userType: 'internal' | 'external';
      views: number;
      downloads: number;
      uploads: number;
      lastActive: Date;
    }>();

    for (const row of userSummary) {
      const key = row.usersId || row.externalUserId || 'unknown';
      if (!aggregated.has(key)) {
        const user = row.usersId ? userMap.get(row.usersId) : null;
        aggregated.set(key, {
          userId: key,
          userName: user?.name || 'External User',
          userEmail: user?.email || '',
          userType: row.externalUserId ? 'external' : 'internal',
          views: 0,
          downloads: 0,
          uploads: 0,
          lastActive: row.lastActivity,
        });
      }
      const data = aggregated.get(key)!;
      if (row.eventType === 'view') data.views += Number(row.count);
      else if (row.eventType === 'download') data.downloads += Number(row.count);
      else if (row.eventType === 'document_uploaded') data.uploads += Number(row.count);
      if (row.lastActivity > data.lastActive) data.lastActive = row.lastActivity;
    }

    res.json(Array.from(aggregated.values()));
  } catch (error) {
    console.error('Error fetching user summary:', error);
    res.status(500).json({ error: 'Failed to fetch user summary' });
  }
});

vdrActivityRouter.get('/api/vdr/activity/document-summary', async (req: Request, res: Response) => {
  const userId = requireUser(req, res);
  if (!userId) return;
  const orgId = getOrgId(req);

  if (!orgId) {
    return res.status(400).json({ error: 'Organization required' });
  }

  try {
    const timeRange = (req.query.timeRange as string) || '7d';
    
    let startDate = new Date();
    switch (timeRange) {
      case '24h': startDate.setHours(startDate.getHours() - 24); break;
      case '7d': startDate.setDate(startDate.getDate() - 7); break;
      case '30d': startDate.setDate(startDate.getDate() - 30); break;
      case '90d': startDate.setDate(startDate.getDate() - 90); break;
      default: startDate.setDate(startDate.getDate() - 7);
    }

    const docSummary = await db
      .select({
        documentId: vdrAuditLogs.documentId,
        eventType: vdrAuditLogs.eventType,
        count: sql<number>`count(*)`,
        uniqueUsers: sql<number>`count(distinct coalesce(${vdrAuditLogs.userId}, ${vdrAuditLogs.externalUserId}))`,
        lastAccessed: sql<Date>`max(${vdrAuditLogs.timestamp})`,
      })
      .from(vdrAuditLogs)
      .where(and(
        eq(vdrAuditLogs.orgId, orgId),
        sql`${vdrAuditLogs.documentId} IS NOT NULL`,
        gte(vdrAuditLogs.timestamp, startDate)
      ))
      .groupBy(vdrAuditLogs.documentId, vdrAuditLogs.eventType)
      .limit(100);

    const docIds = docSummary.filter(s => s.documentId).map(s => s.documentId!);
    const docsData = docIds.length > 0
      ? await db.select({ id: vdrDocuments.id, name: vdrDocuments.name, projectId: vdrDocuments.projectId })
          .from(vdrDocuments)
          .where(inArray(vdrDocuments.id, docIds))
      : [];
    const docMap = new Map(docsData.map(d => [d.id, d]));

    const projectIds = docsData.filter(d => d.projectId).map(d => d.projectId!);
    const projectsData = projectIds.length > 0
      ? await db.select({ id: projects.id, name: projects.name })
          .from(projects)
          .where(inArray(projects.id, projectIds))
      : [];
    const projectMap = new Map(projectsData.map(p => [p.id, p]));

    const aggregated = new Map<string, {
      documentId: string;
      documentName: string;
      projectName: string;
      views: number;
      downloads: number;
      uniqueUsers: number;
      lastAccessed: Date;
    }>();

    for (const row of docSummary) {
      if (!row.documentId) continue;
      if (!aggregated.has(row.documentId)) {
        const doc = docMap.get(row.documentId);
        const project = doc?.projectId ? projectMap.get(doc.projectId) : null;
        aggregated.set(row.documentId, {
          documentId: row.documentId,
          documentName: doc?.name || 'Unknown',
          projectName: project?.name || 'Unknown',
          views: 0,
          downloads: 0,
          uniqueUsers: Number(row.uniqueUsers),
          lastAccessed: row.lastAccessed,
        });
      }
      const data = aggregated.get(row.documentId)!;
      if (row.eventType === 'view') data.views += Number(row.count);
      else if (row.eventType === 'download') data.downloads += Number(row.count);
      if (row.lastAccessed > data.lastAccessed) data.lastAccessed = row.lastAccessed;
    }

    const sorted = Array.from(aggregated.values())
      .sort((a, b) => (b.views + b.downloads) - (a.views + a.downloads))
      .slice(0, 20);

    res.json(sorted);
  } catch (error) {
    console.error('Error fetching document summary:', error);
    res.status(500).json({ error: 'Failed to fetch document summary' });
  }
});
