import { 
  vdrFolders, vdrDocuments, vdrDocumentPermissions, vdrWatermarks, vdrAuditLogs,
  diligenceRequests, requestDocuments, requestComments, requestTemplates,
  externalUsers, externalUserProjectAccess,
  vdrTemplates, vdrTemplateFolders,
  vdrDataRequestTemplates, vdrDataRequestItems,
  type VdrFolder, type VdrDocument, type VdrDocumentPermission, type VdrWatermark, type VdrAuditLog,
  type DiligenceRequest, type RequestDocument, type RequestComment, type RequestTemplate,
  type ExternalUser, type ExternalUserProjectAccess,
  type VdrTemplate, type VdrTemplateFolder,
  type VdrDataRequestTemplate, type VdrDataRequestItem,
  type InsertVdrFolder, type InsertVdrDocument, type InsertVdrDocumentPermission, type InsertVdrWatermark, type InsertVdrAuditLog,
  type InsertDiligenceRequest, type InsertRequestDocument, type InsertRequestComment, type InsertRequestTemplate,
  type InsertExternalUser, type InsertExternalUserProjectAccess,
  type InsertVdrTemplate, type InsertVdrTemplateFolder,
  type InsertVdrDataRequestTemplate, type InsertVdrDataRequestItem,
  vdrPermissionLevelEnum
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, asc, sql, inArray, isNull, isNotNull, or, count, notInArray, gt } from "drizzle-orm";

export interface IVdrFolderRepository {
  getFolder(id: string, orgId: string, includeDeleted?: boolean): Promise<VdrFolder | undefined>;
  getFoldersForProject(projectId: string, orgId: string, includeDeleted?: boolean): Promise<VdrFolder[]>;
  getFolderHierarchy(projectId: string, orgId: string): Promise<VdrFolder[]>;
  createFolder(data: InsertVdrFolder): Promise<VdrFolder>;
  updateFolder(id: string, updates: Partial<InsertVdrFolder>, orgId: string): Promise<VdrFolder | undefined>;
  softDeleteFolder(id: string, orgId: string): Promise<boolean>;
  softDeleteFolderRecursive(id: string, orgId: string): Promise<boolean>;
}

export interface IVdrDocumentRepository {
  getDocument(id: string, orgId: string, includeDeleted?: boolean): Promise<VdrDocument | undefined>;
  getDocumentsForFolder(folderId: string, orgId: string, includeDeleted?: boolean): Promise<VdrDocument[]>;
  getDocumentsForProject(projectId: string, orgId: string, includeDeleted?: boolean): Promise<VdrDocument[]>;
  getDocumentVersions(parentDocumentId: string, orgId: string): Promise<VdrDocument[]>;
  createDocument(data: InsertVdrDocument): Promise<VdrDocument>;
  createDocumentVersion(parentDocumentId: string, data: Partial<InsertVdrDocument>, orgId: string): Promise<VdrDocument>;
  updateDocument(id: string, updates: Partial<InsertVdrDocument>, orgId: string): Promise<VdrDocument | undefined>;
  softDeleteDocument(id: string, orgId: string): Promise<boolean>;
}

export interface IVdrPermissionRepository {
  getPermission(id: string): Promise<VdrDocumentPermission | undefined>;
  getPermissionsForDocument(documentId: string, orgId: string): Promise<VdrDocumentPermission[]>;
  getPermissionsForFolder(folderId: string, orgId: string): Promise<VdrDocumentPermission[]>;
  getPermissionsForProject(projectId: string, orgId: string): Promise<VdrDocumentPermission[]>;
  grantPermission(data: InsertVdrDocumentPermission): Promise<VdrDocumentPermission>;
  revokePermission(id: string, orgId: string): Promise<boolean>;
  revokePermissionsForUser(userId: string, resourceId: string, orgId: string): Promise<boolean>;
}

export interface IVdrAuditRepository {
  createAuditLog(data: InsertVdrAuditLog): Promise<VdrAuditLog>;
  getAuditLogsForDocument(documentId: string, orgId: string, limit?: number): Promise<VdrAuditLog[]>;
  getAuditLogsForProject(projectId: string, orgId: string, filters?: {
    userId?: string;
    externalUserId?: string;
    eventType?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }): Promise<VdrAuditLog[]>;
  getAuditLogsByUser(userId: string, orgId: string, limit?: number): Promise<VdrAuditLog[]>;
  getUserEngagementMetrics(projectId: string, orgId: string): Promise<{
    userId: string;
    externalUserId: string | null;
    viewCount: number;
    downloadCount: number;
    totalDuration: number;
    lastActivity: Date;
  }[]>;
}

export interface IVdrRequestRepository {
  getRequest(id: string, orgId: string, includeDeleted?: boolean): Promise<DiligenceRequest | undefined>;
  getRequestsForProject(projectId: string, orgId: string, includeDeleted?: boolean): Promise<DiligenceRequest[]>;
  getRequestsByStatus(projectId: string, status: string, orgId: string): Promise<DiligenceRequest[]>;
  createRequest(data: InsertDiligenceRequest): Promise<DiligenceRequest>;
  updateRequest(id: string, updates: Partial<InsertDiligenceRequest>, orgId: string): Promise<DiligenceRequest | undefined>;
  softDeleteRequest(id: string, orgId: string): Promise<boolean>;
  linkDocument(requestId: string, documentId: string, linkedBy: string): Promise<RequestDocument>;
  unlinkDocument(requestId: string, documentId: string): Promise<boolean>;
  getRequestDocuments(requestId: string): Promise<VdrDocument[]>;
  createComment(data: InsertRequestComment): Promise<RequestComment>;
  getCommentsForRequest(requestId: string): Promise<RequestComment[]>;
  updateComment(id: string, updates: Partial<InsertRequestComment>, orgId: string): Promise<RequestComment | undefined>;
  deleteComment(id: string, orgId: string): Promise<boolean>;
}

export interface IVdrExternalUserRepository {
  getExternalUser(id: string, orgId: string): Promise<ExternalUser | undefined>;
  getExternalUserByEmail(email: string, orgId: string): Promise<ExternalUser | undefined>;
  getExternalUserByToken(token: string): Promise<ExternalUser | undefined>;
  getExternalUsersForOrg(orgId: string): Promise<ExternalUser[]>;
  getExternalUsersForProject(projectId: string, orgId: string): Promise<(ExternalUser & { access: ExternalUserProjectAccess })[]>;
  createExternalUser(data: InsertExternalUser): Promise<ExternalUser>;
  updateExternalUser(id: string, updates: Partial<InsertExternalUser>, orgId: string): Promise<ExternalUser | undefined>;
  grantProjectAccess(data: InsertExternalUserProjectAccess): Promise<ExternalUserProjectAccess>;
  revokeProjectAccess(externalUserId: string, projectId: string, orgId: string): Promise<boolean>;
  getProjectAccessForUser(externalUserId: string, orgId: string): Promise<ExternalUserProjectAccess[]>;
  getProjectAccessById(id: string, orgId: string): Promise<ExternalUserProjectAccess | undefined>;
}

export interface IVdrTemplateRepository {
  getTemplate(id: string, orgId: string): Promise<VdrTemplate | undefined>;
  listTemplates(orgId: string): Promise<VdrTemplate[]>;
  getTemplateFolders(templateId: string): Promise<VdrTemplateFolder[]>;
  createTemplate(data: InsertVdrTemplate): Promise<VdrTemplate>;
  createTemplateFolder(data: InsertVdrTemplateFolder): Promise<VdrTemplateFolder>;
}

export interface IVdrDataRequestRepository {
  getItemsByProject(projectId: string, orgId: string): Promise<VdrDataRequestItem[]>;
  getItem(id: string, orgId: string): Promise<VdrDataRequestItem | undefined>;
  createItem(data: InsertVdrDataRequestItem): Promise<VdrDataRequestItem>;
  updateItem(id: string, updates: Partial<InsertVdrDataRequestItem>, orgId: string): Promise<VdrDataRequestItem | undefined>;
  deleteItem(id: string, orgId: string): Promise<boolean>;
  linkDocument(itemId: string, documentId: string, orgId: string): Promise<VdrDataRequestItem | undefined>;
  unlinkDocument(itemId: string, orgId: string): Promise<VdrDataRequestItem | undefined>;
  getTemplates(orgId: string): Promise<VdrDataRequestTemplate[]>;
  createTemplate(data: InsertVdrDataRequestTemplate): Promise<VdrDataRequestTemplate>;
  applyTemplate(projectId: string, templateId: string, orgId: string, userId: string): Promise<VdrDataRequestItem[]>;
}

export interface IVdrStorage {
  folders: IVdrFolderRepository;
  documents: IVdrDocumentRepository;
  permissions: IVdrPermissionRepository;
  audit: IVdrAuditRepository;
  requests: IVdrRequestRepository;
  externalUsers: IVdrExternalUserRepository;
  templates: IVdrTemplateRepository;
  dataRequests: IVdrDataRequestRepository;
}

export class VdrFolderRepository implements IVdrFolderRepository {
  async getFolder(id: string, orgId: string, includeDeleted = false): Promise<VdrFolder | undefined> {
    const conditions = [eq(vdrFolders.id, id), eq(vdrFolders.orgId, orgId)];
    if (!includeDeleted) {
      conditions.push(isNull(vdrFolders.deletedAt));
    }
    
    const [folder] = await db.select()
      .from(vdrFolders)
      .where(and(...conditions))
      .limit(1);
    
    return folder || undefined;
  }

  async getFoldersForProject(projectId: string, orgId: string, includeDeleted = false): Promise<VdrFolder[]> {
    const conditions = [eq(vdrFolders.projectId, projectId), eq(vdrFolders.orgId, orgId)];
    if (!includeDeleted) {
      conditions.push(isNull(vdrFolders.deletedAt));
    }
    
    return await db.select()
      .from(vdrFolders)
      .where(and(...conditions))
      .orderBy(asc(vdrFolders.displayOrder), asc(vdrFolders.name));
  }

  async getFolderHierarchy(projectId: string, orgId: string): Promise<VdrFolder[]> {
    return await db.select()
      .from(vdrFolders)
      .where(and(
        eq(vdrFolders.projectId, projectId),
        eq(vdrFolders.orgId, orgId),
        isNull(vdrFolders.deletedAt)
      ))
      .orderBy(asc(vdrFolders.path), asc(vdrFolders.displayOrder));
  }

  async createFolder(data: InsertVdrFolder): Promise<VdrFolder> {
    const [folder] = await db.insert(vdrFolders)
      .values(data as any)
      .returning();
    return folder;
  }

  async updateFolder(id: string, updates: Partial<InsertVdrFolder>, orgId: string): Promise<VdrFolder | undefined> {
    const [updated] = await db.update(vdrFolders)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(
        eq(vdrFolders.id, id),
        eq(vdrFolders.orgId, orgId),
        isNull(vdrFolders.deletedAt)
      ))
      .returning();
    
    return updated || undefined;
  }

  async softDeleteFolder(id: string, orgId: string): Promise<boolean> {
    const [deleted] = await db.update(vdrFolders)
      .set({ deletedAt: new Date() })
      .where(and(
        eq(vdrFolders.id, id),
        eq(vdrFolders.orgId, orgId),
        isNull(vdrFolders.deletedAt)
      ))
      .returning();
    
    return !!deleted;
  }

  async softDeleteFolderRecursive(id: string, orgId: string): Promise<boolean> {
    const folderToDelete = await this.getFolder(id, orgId);
    if (!folderToDelete) return false;

    const childFolders = await db
      .select()
      .from(vdrFolders)
      .where(and(
        eq(vdrFolders.parentFolderId, id),
        eq(vdrFolders.orgId, orgId),
        isNull(vdrFolders.deletedAt)
      ));

    for (const child of childFolders) {
      await this.softDeleteFolderRecursive(child.id, orgId);
    }

    const documentsInFolder = await db
      .select()
      .from(vdrDocuments)
      .where(and(
        eq(vdrDocuments.folderId, id),
        eq(vdrDocuments.orgId, orgId),
        isNull(vdrDocuments.deletedAt)
      ));

    if (documentsInFolder.length > 0) {
      await db.update(vdrDocuments)
        .set({ deletedAt: new Date() })
        .where(and(
          eq(vdrDocuments.folderId, id),
          eq(vdrDocuments.orgId, orgId),
          isNull(vdrDocuments.deletedAt)
        ));
    }

    return await this.softDeleteFolder(id, orgId);
  }
}

export class VdrDocumentRepository implements IVdrDocumentRepository {
  async getDocument(id: string, orgId: string, includeDeleted = false): Promise<VdrDocument | undefined> {
    const conditions = [eq(vdrDocuments.id, id), eq(vdrDocuments.orgId, orgId)];
    if (!includeDeleted) {
      conditions.push(isNull(vdrDocuments.deletedAt));
    }
    
    const [doc] = await db.select()
      .from(vdrDocuments)
      .where(and(...conditions))
      .limit(1);
    
    return doc || undefined;
  }

  async getDocumentsForFolder(folderId: string, orgId: string, includeDeleted = false): Promise<VdrDocument[]> {
    const conditions = [eq(vdrDocuments.folderId, folderId), eq(vdrDocuments.orgId, orgId)];
    if (!includeDeleted) {
      conditions.push(isNull(vdrDocuments.deletedAt));
    }
    
    return await db.select()
      .from(vdrDocuments)
      .where(and(...conditions))
      .orderBy(desc(vdrDocuments.createdAt));
  }

  async getDocumentsForProject(projectId: string, orgId: string, includeDeleted = false): Promise<VdrDocument[]> {
    const conditions = [eq(vdrDocuments.projectId, projectId), eq(vdrDocuments.orgId, orgId)];
    if (!includeDeleted) {
      conditions.push(isNull(vdrDocuments.deletedAt));
    }
    
    return await db.select()
      .from(vdrDocuments)
      .where(and(...conditions))
      .orderBy(desc(vdrDocuments.createdAt));
  }

  async getDocumentVersions(parentDocumentId: string, orgId: string): Promise<VdrDocument[]> {
    return await db.select()
      .from(vdrDocuments)
      .where(and(
        eq(vdrDocuments.parentDocumentId, parentDocumentId),
        eq(vdrDocuments.orgId, orgId)
      ))
      .orderBy(desc(vdrDocuments.version));
  }

  async createDocument(data: InsertVdrDocument): Promise<VdrDocument> {
    const [document] = await db.insert(vdrDocuments)
      .values(data as any)
      .returning();
    return document;
  }

  async createDocumentVersion(parentDocumentId: string, data: Partial<InsertVdrDocument>, orgId: string): Promise<VdrDocument> {
    const parentDoc = await this.getDocument(parentDocumentId, orgId);
    if (!parentDoc) {
      throw new Error('Parent document not found');
    }

    await db.update(vdrDocuments)
      .set({ isCurrentVersion: false })
      .where(and(
        eq(vdrDocuments.id, parentDocumentId),
        eq(vdrDocuments.orgId, orgId)
      ));

    const newVersion = parentDoc.version + 1;
    const [versionedDoc] = await db.insert(vdrDocuments)
      .values({
        ...data,
        folderId: data.folderId || parentDoc.folderId,
        projectId: parentDoc.projectId,
        filename: data.filename || parentDoc.filename,
        originalFilename: data.originalFilename || parentDoc.originalFilename,
        mimeType: data.mimeType || parentDoc.mimeType,
        size: data.size || parentDoc.size,
        checksum: data.checksum || parentDoc.checksum,
        storagePath: data.storagePath || parentDoc.storagePath,
        parentDocumentId: parentDocumentId,
        version: newVersion,
        isCurrentVersion: true,
        orgId: orgId,
        uploadedBy: data.uploadedBy || parentDoc.uploadedBy,
      } as any)
      .returning();

    return versionedDoc;
  }

  async updateDocument(id: string, updates: Partial<InsertVdrDocument>, orgId: string): Promise<VdrDocument | undefined> {
    const [updated] = await db.update(vdrDocuments)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(
        eq(vdrDocuments.id, id),
        eq(vdrDocuments.orgId, orgId),
        isNull(vdrDocuments.deletedAt)
      ))
      .returning();
    
    return updated || undefined;
  }

  async softDeleteDocument(id: string, orgId: string): Promise<boolean> {
    const [deleted] = await db.update(vdrDocuments)
      .set({ deletedAt: new Date() })
      .where(and(
        eq(vdrDocuments.id, id),
        eq(vdrDocuments.orgId, orgId),
        isNull(vdrDocuments.deletedAt)
      ))
      .returning();
    
    return !!deleted;
  }
}

export class VdrPermissionRepository implements IVdrPermissionRepository {
  private permissionService?: any;

  setPermissionService(service: any) {
    this.permissionService = service;
  }

  async getPermission(id: string): Promise<VdrDocumentPermission | undefined> {
    const [permission] = await db.select()
      .from(vdrDocumentPermissions)
      .where(eq(vdrDocumentPermissions.id, id))
      .limit(1);
    
    return permission || undefined;
  }

  async getPermissionsForDocument(documentId: string, orgId: string): Promise<VdrDocumentPermission[]> {
    return await db.select()
      .from(vdrDocumentPermissions)
      .where(and(
        eq(vdrDocumentPermissions.documentId, documentId),
        eq(vdrDocumentPermissions.orgId, orgId)
      ));
  }

  async getPermissionsForFolder(folderId: string, orgId: string): Promise<VdrDocumentPermission[]> {
    return await db.select()
      .from(vdrDocumentPermissions)
      .where(and(
        eq(vdrDocumentPermissions.folderId, folderId),
        eq(vdrDocumentPermissions.orgId, orgId)
      ));
  }

  async getPermissionsForProject(projectId: string, orgId: string): Promise<VdrDocumentPermission[]> {
    return await db.select()
      .from(vdrDocumentPermissions)
      .where(and(
        eq(vdrDocumentPermissions.projectId, projectId),
        eq(vdrDocumentPermissions.orgId, orgId)
      ));
  }

  async grantPermission(data: InsertVdrDocumentPermission): Promise<VdrDocumentPermission> {
    const [permission] = await db.insert(vdrDocumentPermissions)
      .values(data as any)
      .returning();
    
    if (this.permissionService) {
      if (permission.documentId) {
        this.permissionService.clearCacheForResource('document', permission.documentId);
      } else if (permission.folderId) {
        this.permissionService.clearCacheForResource('folder', permission.folderId);
      } else if (permission.projectId) {
        this.permissionService.clearCacheForResource('project', permission.projectId);
      }
    }
    
    return permission;
  }

  async revokePermission(id: string, orgId: string): Promise<boolean> {
    const permission = await this.getPermission(id);
    
    const result = await db.delete(vdrDocumentPermissions)
      .where(and(
        eq(vdrDocumentPermissions.id, id),
        eq(vdrDocumentPermissions.orgId, orgId)
      ))
      .returning();
    
    if (result.length > 0 && this.permissionService && permission) {
      if (permission.documentId) {
        this.permissionService.clearCacheForResource('document', permission.documentId);
      } else if (permission.folderId) {
        this.permissionService.clearCacheForResource('folder', permission.folderId);
      } else if (permission.projectId) {
        this.permissionService.clearCacheForResource('project', permission.projectId);
      }
    }
    
    return result.length > 0;
  }

  async revokePermissionsForUser(userId: string, resourceId: string, orgId: string): Promise<boolean> {
    const result = await db.delete(vdrDocumentPermissions)
      .where(and(
        eq(vdrDocumentPermissions.userId, userId),
        or(
          eq(vdrDocumentPermissions.documentId, resourceId),
          eq(vdrDocumentPermissions.folderId, resourceId),
          eq(vdrDocumentPermissions.projectId, resourceId)
        ),
        eq(vdrDocumentPermissions.orgId, orgId)
      ))
      .returning();
    
    if (result.length > 0 && this.permissionService) {
      this.permissionService.clearCacheForUser(userId);
    }
    
    return result.length > 0;
  }
}

export class VdrAuditRepository implements IVdrAuditRepository {
  async createAuditLog(data: InsertVdrAuditLog): Promise<VdrAuditLog> {
    const [log] = await db.insert(vdrAuditLogs)
      .values(data as any)
      .returning();
    return log;
  }

  async getAuditLogsForDocument(documentId: string, orgId: string, limit = 100): Promise<VdrAuditLog[]> {
    return await db.select()
      .from(vdrAuditLogs)
      .where(and(
        eq(vdrAuditLogs.documentId, documentId),
        eq(vdrAuditLogs.orgId, orgId)
      ))
      .orderBy(desc(vdrAuditLogs.timestamp))
      .limit(limit);
  }

  async getAuditLogsForProject(projectId: string, orgId: string, filters?: {
    userId?: string;
    externalUserId?: string;
    eventType?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }): Promise<VdrAuditLog[]> {
    const conditions = [eq(vdrAuditLogs.orgId, orgId)];
    
    const documents = await db.select({ id: vdrDocuments.id })
      .from(vdrDocuments)
      .where(eq(vdrDocuments.projectId, projectId));
    
    const documentIds = documents.map(d => d.id);
    if (documentIds.length > 0) {
      conditions.push(inArray(vdrAuditLogs.documentId, documentIds));
    }

    if (filters?.userId) {
      conditions.push(eq(vdrAuditLogs.userId, filters.userId));
    }
    if (filters?.externalUserId) {
      conditions.push(eq(vdrAuditLogs.externalUserId, filters.externalUserId));
    }
    if (filters?.eventType) {
      conditions.push(sql`${vdrAuditLogs.eventType} = ${filters.eventType}`);
    }
    if (filters?.startDate) {
      conditions.push(sql`${vdrAuditLogs.timestamp} >= ${filters.startDate}`);
    }
    if (filters?.endDate) {
      conditions.push(sql`${vdrAuditLogs.timestamp} <= ${filters.endDate}`);
    }

    return await db.select()
      .from(vdrAuditLogs)
      .where(and(...conditions))
      .orderBy(desc(vdrAuditLogs.timestamp))
      .limit(filters?.limit || 1000);
  }

  async getAuditLogsByUser(userId: string, orgId: string, limit = 100): Promise<VdrAuditLog[]> {
    return await db.select()
      .from(vdrAuditLogs)
      .where(and(
        eq(vdrAuditLogs.userId, userId),
        eq(vdrAuditLogs.orgId, orgId)
      ))
      .orderBy(desc(vdrAuditLogs.timestamp))
      .limit(limit);
  }

  async getUserEngagementMetrics(projectId: string, orgId: string): Promise<{
    userId: string;
    externalUserId: string | null;
    viewCount: number;
    downloadCount: number;
    totalDuration: number;
    lastActivity: Date;
  }[]> {
    const documents = await db.select({ id: vdrDocuments.id })
      .from(vdrDocuments)
      .where(eq(vdrDocuments.projectId, projectId));
    
    const documentIds = documents.map(d => d.id);
    if (documentIds.length === 0) return [];

    const metrics = await db.select({
      userId: vdrAuditLogs.userId,
      externalUserId: vdrAuditLogs.externalUserId,
      viewCount: sql<number>`COUNT(CASE WHEN ${vdrAuditLogs.eventType} = 'view' THEN 1 END)`.as('view_count'),
      downloadCount: sql<number>`COUNT(CASE WHEN ${vdrAuditLogs.eventType} = 'download' THEN 1 END)`.as('download_count'),
      totalDuration: sql<number>`COALESCE(SUM(${vdrAuditLogs.duration}), 0)`.as('total_duration'),
      lastActivity: sql<Date>`MAX(${vdrAuditLogs.timestamp})`.as('last_activity')
    })
      .from(vdrAuditLogs)
      .where(and(
        inArray(vdrAuditLogs.documentId, documentIds),
        eq(vdrAuditLogs.orgId, orgId)
      ))
      .groupBy(vdrAuditLogs.userId, vdrAuditLogs.externalUserId);

    return metrics.map(m => ({
      userId: m.userId || '',
      externalUserId: m.externalUserId,
      viewCount: Number(m.viewCount) || 0,
      downloadCount: Number(m.downloadCount) || 0,
      totalDuration: Number(m.totalDuration) || 0,
      lastActivity: m.lastActivity
    }));
  }
}

export class VdrRequestRepository implements IVdrRequestRepository {
  async getRequest(id: string, orgId: string, includeDeleted = false): Promise<DiligenceRequest | undefined> {
    const conditions = [eq(diligenceRequests.id, id), eq(diligenceRequests.orgId, orgId)];
    if (!includeDeleted) {
      conditions.push(isNull(diligenceRequests.deletedAt));
    }
    
    const [request] = await db.select()
      .from(diligenceRequests)
      .where(and(...conditions))
      .limit(1);
    
    return request || undefined;
  }

  async getRequestsForProject(projectId: string, orgId: string, includeDeleted = false): Promise<DiligenceRequest[]> {
    const conditions = [eq(diligenceRequests.projectId, projectId), eq(diligenceRequests.orgId, orgId)];
    if (!includeDeleted) {
      conditions.push(isNull(diligenceRequests.deletedAt));
    }
    
    return await db.select()
      .from(diligenceRequests)
      .where(and(...conditions))
      .orderBy(desc(diligenceRequests.createdAt));
  }

  async getRequestsByStatus(projectId: string, status: string, orgId: string): Promise<DiligenceRequest[]> {
    return await db.select()
      .from(diligenceRequests)
      .where(and(
        eq(diligenceRequests.projectId, projectId),
        sql`${diligenceRequests.status} = ${status}`,
        eq(diligenceRequests.orgId, orgId),
        isNull(diligenceRequests.deletedAt)
      ))
      .orderBy(desc(diligenceRequests.createdAt));
  }

  async createRequest(data: InsertDiligenceRequest): Promise<DiligenceRequest> {
    const [request] = await db.insert(diligenceRequests)
      .values(data as any)
      .returning();
    return request;
  }

  async updateRequest(id: string, updates: Partial<InsertDiligenceRequest>, orgId: string): Promise<DiligenceRequest | undefined> {
    const [updated] = await db.update(diligenceRequests)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(
        eq(diligenceRequests.id, id),
        eq(diligenceRequests.orgId, orgId),
        isNull(diligenceRequests.deletedAt)
      ))
      .returning();
    
    return updated || undefined;
  }

  async softDeleteRequest(id: string, orgId: string): Promise<boolean> {
    const [deleted] = await db.update(diligenceRequests)
      .set({ deletedAt: new Date() })
      .where(and(
        eq(diligenceRequests.id, id),
        eq(diligenceRequests.orgId, orgId),
        isNull(diligenceRequests.deletedAt)
      ))
      .returning();
    
    return !!deleted;
  }

  async linkDocument(requestId: string, documentId: string, linkedBy: string): Promise<RequestDocument> {
    const [link] = await db.insert(requestDocuments)
      .values({ requestId, documentId, linkedBy })
      .returning();
    return link;
  }

  async unlinkDocument(requestId: string, documentId: string): Promise<boolean> {
    const result = await db.delete(requestDocuments)
      .where(and(
        eq(requestDocuments.requestId, requestId),
        eq(requestDocuments.documentId, documentId)
      ))
      .returning();
    
    return result.length > 0;
  }

  async getRequestDocuments(requestId: string): Promise<VdrDocument[]> {
    const links = await db.select()
      .from(requestDocuments)
      .where(eq(requestDocuments.requestId, requestId));
    
    const documentIds = links.map(l => l.documentId);
    if (documentIds.length === 0) return [];

    return await db.select()
      .from(vdrDocuments)
      .where(and(
        inArray(vdrDocuments.id, documentIds),
        isNull(vdrDocuments.deletedAt)
      ));
  }

  async createComment(data: InsertRequestComment): Promise<RequestComment> {
    const [comment] = await db.insert(requestComments)
      .values(data as any)
      .returning();
    return comment;
  }

  async getCommentsForRequest(requestId: string): Promise<RequestComment[]> {
    return await db.select()
      .from(requestComments)
      .where(eq(requestComments.requestId, requestId))
      .orderBy(asc(requestComments.createdAt));
  }

  async updateComment(id: string, updates: Partial<InsertRequestComment>, orgId: string): Promise<RequestComment | undefined> {
    const [updated] = await db.update(requestComments)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(
        eq(requestComments.id, id),
        eq(requestComments.orgId, orgId)
      ))
      .returning();
    
    return updated || undefined;
  }

  async deleteComment(id: string, orgId: string): Promise<boolean> {
    const result = await db.delete(requestComments)
      .where(and(
        eq(requestComments.id, id),
        eq(requestComments.orgId, orgId)
      ))
      .returning();
    
    return result.length > 0;
  }
}

export class VdrExternalUserRepository implements IVdrExternalUserRepository {
  async getExternalUser(id: string, orgId: string): Promise<ExternalUser | undefined> {
    const [user] = await db.select()
      .from(externalUsers)
      .where(and(
        eq(externalUsers.id, id),
        eq(externalUsers.orgId, orgId)
      ))
      .limit(1);
    
    return user || undefined;
  }

  async getExternalUserByEmail(email: string, orgId: string): Promise<ExternalUser | undefined> {
    const [user] = await db.select()
      .from(externalUsers)
      .where(and(
        eq(externalUsers.email, email),
        eq(externalUsers.orgId, orgId)
      ))
      .limit(1);
    
    return user || undefined;
  }

  async getExternalUserByToken(token: string): Promise<ExternalUser | undefined> {
    const [user] = await db.select()
      .from(externalUsers)
      .where(eq(externalUsers.invitationToken, token))
      .limit(1);
    
    return user || undefined;
  }

  async getExternalUsersForOrg(orgId: string): Promise<ExternalUser[]> {
    return await db.select()
      .from(externalUsers)
      .where(eq(externalUsers.orgId, orgId))
      .orderBy(desc(externalUsers.createdAt));
  }

  async getExternalUsersForProject(projectId: string, orgId: string): Promise<(ExternalUser & { access: ExternalUserProjectAccess })[]> {
    const results = await db.select()
      .from(externalUsers)
      .innerJoin(
        externalUserProjectAccess,
        eq(externalUsers.id, externalUserProjectAccess.externalUserId)
      )
      .where(and(
        eq(externalUserProjectAccess.projectId, projectId),
        eq(externalUsers.orgId, orgId),
        eq(externalUserProjectAccess.orgId, orgId),
        eq(externalUserProjectAccess.status, 'active'),
        or(
          isNull(externalUserProjectAccess.expiresAt),
          gt(externalUserProjectAccess.expiresAt, new Date())
        )
      ))
      .orderBy(desc(externalUsers.createdAt));

    return results.map(row => ({
      ...row.external_users,
      access: row.external_user_project_access
    }));
  }

  async createExternalUser(data: InsertExternalUser): Promise<ExternalUser> {
    const [user] = await db.insert(externalUsers)
      .values(data as any)
      .returning();
    return user;
  }

  async updateExternalUser(id: string, updates: Partial<InsertExternalUser>, orgId: string): Promise<ExternalUser | undefined> {
    const [updated] = await db.update(externalUsers)
      .set(updates)
      .where(and(
        eq(externalUsers.id, id),
        eq(externalUsers.orgId, orgId)
      ))
      .returning();
    
    return updated || undefined;
  }

  async grantProjectAccess(data: InsertExternalUserProjectAccess): Promise<ExternalUserProjectAccess> {
    const [access] = await db.insert(externalUserProjectAccess)
      .values(data as any)
      .returning();
    return access;
  }

  async revokeProjectAccess(externalUserId: string, projectId: string, orgId: string): Promise<boolean> {
    const result = await db.update(externalUserProjectAccess)
      .set({ status: 'revoked', expiresAt: new Date() })
      .where(and(
        eq(externalUserProjectAccess.externalUserId, externalUserId),
        eq(externalUserProjectAccess.projectId, projectId),
        eq(externalUserProjectAccess.orgId, orgId),
        eq(externalUserProjectAccess.status, 'active')
      ))
      .returning();
    
    return result.length > 0;
  }

  async getProjectAccessForUser(externalUserId: string, orgId: string): Promise<ExternalUserProjectAccess[]> {
    return await db.select()
      .from(externalUserProjectAccess)
      .where(and(
        eq(externalUserProjectAccess.externalUserId, externalUserId),
        eq(externalUserProjectAccess.orgId, orgId),
        eq(externalUserProjectAccess.status, 'active'),
        or(
          isNull(externalUserProjectAccess.expiresAt),
          gt(externalUserProjectAccess.expiresAt, new Date())
        )
      ));
  }

  async getProjectAccessById(id: string, orgId: string): Promise<ExternalUserProjectAccess | undefined> {
    const [access] = await db.select()
      .from(externalUserProjectAccess)
      .where(and(
        eq(externalUserProjectAccess.id, id),
        eq(externalUserProjectAccess.orgId, orgId)
      ))
      .limit(1);
    
    return access || undefined;
  }
}

export class VdrTemplateRepository implements IVdrTemplateRepository {
  async getTemplate(id: string, orgId: string): Promise<VdrTemplate | undefined> {
    // Templates can be system-wide (null orgId) or org-specific
    const [template] = await db.select()
      .from(vdrTemplates)
      .where(and(
        eq(vdrTemplates.id, id),
        or(
          eq(vdrTemplates.isPublic, true),
          eq(vdrTemplates.orgId, orgId)
        )
      ))
      .limit(1);
    
    return template || undefined;
  }

  async listTemplates(orgId: string): Promise<VdrTemplate[]> {
    // Get public/system templates and org-specific templates
    return await db.select()
      .from(vdrTemplates)
      .where(or(
        eq(vdrTemplates.isPublic, true),
        eq(vdrTemplates.orgId, orgId)
      ))
      .orderBy(desc(vdrTemplates.isDefault), asc(vdrTemplates.name));
  }

  async getTemplateFolders(templateId: string): Promise<VdrTemplateFolder[]> {
    return await db.select()
      .from(vdrTemplateFolders)
      .where(eq(vdrTemplateFolders.templateId, templateId))
      .orderBy(asc(vdrTemplateFolders.displayOrder), asc(vdrTemplateFolders.name));
  }

  async createTemplate(data: InsertVdrTemplate): Promise<VdrTemplate> {
    const [template] = await db.insert(vdrTemplates)
      .values(data)
      .returning();
    
    return template;
  }

  async createTemplateFolder(data: InsertVdrTemplateFolder): Promise<VdrTemplateFolder> {
    const [folder] = await db.insert(vdrTemplateFolders)
      .values(data)
      .returning();
    
    return folder;
  }
}

export class VdrDataRequestRepository implements IVdrDataRequestRepository {
  async getItemsByProject(projectId: string, orgId: string): Promise<VdrDataRequestItem[]> {
    return await db.select()
      .from(vdrDataRequestItems)
      .where(and(
        eq(vdrDataRequestItems.projectId, projectId),
        eq(vdrDataRequestItems.orgId, orgId)
      ))
      .orderBy(asc(vdrDataRequestItems.category), asc(vdrDataRequestItems.displayOrder), asc(vdrDataRequestItems.documentName));
  }

  async getItem(id: string, orgId: string): Promise<VdrDataRequestItem | undefined> {
    const [item] = await db.select()
      .from(vdrDataRequestItems)
      .where(and(
        eq(vdrDataRequestItems.id, id),
        eq(vdrDataRequestItems.orgId, orgId)
      ))
      .limit(1);
    
    return item || undefined;
  }

  async createItem(data: InsertVdrDataRequestItem): Promise<VdrDataRequestItem> {
    const [item] = await db.insert(vdrDataRequestItems)
      .values(data)
      .returning();
    
    return item;
  }

  async updateItem(id: string, updates: Partial<InsertVdrDataRequestItem>, orgId: string): Promise<VdrDataRequestItem | undefined> {
    const [updated] = await db.update(vdrDataRequestItems)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(
        eq(vdrDataRequestItems.id, id),
        eq(vdrDataRequestItems.orgId, orgId)
      ))
      .returning();
    
    return updated || undefined;
  }

  async deleteItem(id: string, orgId: string): Promise<boolean> {
    const result = await db.delete(vdrDataRequestItems)
      .where(and(
        eq(vdrDataRequestItems.id, id),
        eq(vdrDataRequestItems.orgId, orgId)
      ));
    
    return true;
  }

  async linkDocument(itemId: string, documentId: string, orgId: string): Promise<VdrDataRequestItem | undefined> {
    const [updated] = await db.update(vdrDataRequestItems)
      .set({ 
        linkedDocumentId: documentId,
        isInDataRoom: true,
        status: 'received' as const,
        receivedDate: new Date(),
        updatedAt: new Date()
      })
      .where(and(
        eq(vdrDataRequestItems.id, itemId),
        eq(vdrDataRequestItems.orgId, orgId)
      ))
      .returning();
    
    return updated || undefined;
  }

  async unlinkDocument(itemId: string, orgId: string): Promise<VdrDataRequestItem | undefined> {
    const [updated] = await db.update(vdrDataRequestItems)
      .set({ 
        linkedDocumentId: null,
        isInDataRoom: false,
        updatedAt: new Date()
      })
      .where(and(
        eq(vdrDataRequestItems.id, itemId),
        eq(vdrDataRequestItems.orgId, orgId)
      ))
      .returning();
    
    return updated || undefined;
  }

  async getTemplates(orgId: string): Promise<VdrDataRequestTemplate[]> {
    return await db.select()
      .from(vdrDataRequestTemplates)
      .where(or(
        eq(vdrDataRequestTemplates.isGlobal, true),
        eq(vdrDataRequestTemplates.orgId, orgId)
      ))
      .orderBy(asc(vdrDataRequestTemplates.category), asc(vdrDataRequestTemplates.name));
  }

  async createTemplate(data: InsertVdrDataRequestTemplate): Promise<VdrDataRequestTemplate> {
    const [template] = await db.insert(vdrDataRequestTemplates)
      .values(data)
      .returning();
    
    return template;
  }

  async applyTemplate(projectId: string, templateId: string, orgId: string, userId: string): Promise<VdrDataRequestItem[]> {
    return [];
  }
}

export class VdrStorage implements IVdrStorage {
  folders: IVdrFolderRepository;
  documents: IVdrDocumentRepository;
  permissions: IVdrPermissionRepository;
  audit: IVdrAuditRepository;
  requests: IVdrRequestRepository;
  externalUsers: IVdrExternalUserRepository;
  templates: IVdrTemplateRepository;
  dataRequests: IVdrDataRequestRepository;

  constructor() {
    this.folders = new VdrFolderRepository();
    this.documents = new VdrDocumentRepository();
    this.permissions = new VdrPermissionRepository();
    this.audit = new VdrAuditRepository();
    this.requests = new VdrRequestRepository();
    this.externalUsers = new VdrExternalUserRepository();
    this.templates = new VdrTemplateRepository();
    this.dataRequests = new VdrDataRequestRepository();
  }
}
