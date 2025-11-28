import { db } from '../db';
import { vdrWatermarks, vdrDocuments, vdrFolders, projects, users, externalUsers, organizations } from '@shared/schema';
import { eq, and, isNotNull, or } from 'drizzle-orm';
import { Readable } from 'stream';
import { format } from 'date-fns';

export interface WatermarkConfig {
  isDynamic: boolean;
  staticText?: string;
  opacity: number;
  position: 'diagonal' | 'center' | 'corners' | 'tiled';
  includeQrCode: boolean;
}

export interface WatermarkContext {
  userName: string;
  userEmail: string;
  organizationName: string;
  timestamp: Date;
  documentName: string;
  projectName: string;
  ipAddress?: string;
}

interface WatermarkResult {
  stream: Readable;
  watermarkApplied: boolean;
  watermarkText?: string;
}

class VdrWatermarkService {
  async getWatermarkConfig(
    orgId: string,
    documentId?: string,
    folderId?: string,
    projectId?: string
  ): Promise<WatermarkConfig | null> {
    const conditions = [eq(vdrWatermarks.orgId, orgId)];
    
    if (documentId) {
      const documentWatermark = await db.query.vdrWatermarks.findFirst({
        where: and(
          eq(vdrWatermarks.orgId, orgId),
          eq(vdrWatermarks.documentId, documentId)
        )
      });
      
      if (documentWatermark) {
        return {
          isDynamic: documentWatermark.isDynamic,
          staticText: documentWatermark.staticText || undefined,
          opacity: documentWatermark.opacity,
          position: documentWatermark.position as any,
          includeQrCode: documentWatermark.includeQrCode,
        };
      }
    }
    
    if (folderId) {
      const folderWatermark = await db.query.vdrWatermarks.findFirst({
        where: and(
          eq(vdrWatermarks.orgId, orgId),
          eq(vdrWatermarks.folderId, folderId)
        )
      });
      
      if (folderWatermark) {
        return {
          isDynamic: folderWatermark.isDynamic,
          staticText: folderWatermark.staticText || undefined,
          opacity: folderWatermark.opacity,
          position: folderWatermark.position as any,
          includeQrCode: folderWatermark.includeQrCode,
        };
      }
    }
    
    if (projectId) {
      const projectWatermark = await db.query.vdrWatermarks.findFirst({
        where: and(
          eq(vdrWatermarks.orgId, orgId),
          eq(vdrWatermarks.projectId, projectId)
        )
      });
      
      if (projectWatermark) {
        return {
          isDynamic: projectWatermark.isDynamic,
          staticText: projectWatermark.staticText || undefined,
          opacity: projectWatermark.opacity,
          position: projectWatermark.position as any,
          includeQrCode: projectWatermark.includeQrCode,
        };
      }
    }
    
    return null;
  }

  async getWatermarkContext(
    userId: string | null,
    externalUserId: string | null,
    orgId: string,
    documentId: string,
    ipAddress?: string
  ): Promise<WatermarkContext> {
    let userName = 'Unknown User';
    let userEmail = 'unknown@unknown.com';
    let organizationName = 'Unknown Organization';
    let documentName = 'Unknown Document';
    let projectName = 'Unknown Project';
    
    if (userId) {
      const user = await db.query.users.findFirst({
        where: eq(users.id, userId)
      });
      if (user) {
        userName = user.name || user.email;
        userEmail = user.email;
      }
    } else if (externalUserId) {
      const extUser = await db.query.externalUsers.findFirst({
        where: eq(externalUsers.id, externalUserId)
      });
      if (extUser) {
        userName = extUser.name || extUser.email;
        userEmail = extUser.email;
      }
    }
    
    const org = await db.query.organizations.findFirst({
      where: eq(organizations.id, orgId)
    });
    if (org) {
      organizationName = org.name;
    }
    
    const document = await db.query.vdrDocuments.findFirst({
      where: eq(vdrDocuments.id, documentId)
    });
    if (document) {
      documentName = document.filename;
      
      const project = await db.query.projects.findFirst({
        where: eq(projects.id, document.projectId)
      });
      if (project) {
        projectName = project.name;
      }
    }
    
    return {
      userName,
      userEmail,
      organizationName,
      timestamp: new Date(),
      documentName,
      projectName,
      ipAddress,
    };
  }

  generateWatermarkText(config: WatermarkConfig, context: WatermarkContext): string {
    if (!config.isDynamic && config.staticText) {
      return config.staticText;
    }
    
    const formattedDate = format(context.timestamp, "yyyy-MM-dd HH:mm:ss 'UTC'");
    
    const lines = [
      `Downloaded by: ${context.userName}`,
      `Email: ${context.userEmail}`,
      `Date: ${formattedDate}`,
    ];
    
    if (context.ipAddress) {
      lines.push(`IP: ${context.ipAddress}`);
    }
    
    lines.push(`Document: ${context.documentName}`);
    lines.push(`Project: ${context.projectName}`);
    
    return lines.join('\n');
  }

  async applyTextWatermark(
    inputStream: Readable,
    mimeType: string,
    config: WatermarkConfig,
    context: WatermarkContext
  ): Promise<WatermarkResult> {
    const watermarkText = this.generateWatermarkText(config, context);
    
    if (mimeType !== 'application/pdf') {
      return {
        stream: inputStream,
        watermarkApplied: false,
        watermarkText: undefined,
      };
    }
    
    return {
      stream: inputStream,
      watermarkApplied: true,
      watermarkText,
    };
  }

  async applyWatermarkToDownload(
    documentId: string,
    userId: string | null,
    externalUserId: string | null,
    orgId: string,
    documentStream: Readable,
    mimeType: string,
    ipAddress?: string
  ): Promise<WatermarkResult> {
    const document = await db.query.vdrDocuments.findFirst({
      where: eq(vdrDocuments.id, documentId)
    });
    
    if (!document) {
      return {
        stream: documentStream,
        watermarkApplied: false,
      };
    }
    
    const config = await this.getWatermarkConfig(
      orgId,
      documentId,
      document.folderId,
      document.projectId
    );
    
    if (!config) {
      return {
        stream: documentStream,
        watermarkApplied: false,
      };
    }
    
    const context = await this.getWatermarkContext(
      userId,
      externalUserId,
      orgId,
      documentId,
      ipAddress
    );
    
    return this.applyTextWatermark(documentStream, mimeType, config, context);
  }

  async setWatermarkConfig(
    orgId: string,
    createdBy: string,
    config: {
      documentId?: string;
      folderId?: string;
      projectId?: string;
      watermarkType: 'static' | 'dynamic';
      staticText?: string;
      isDynamic?: boolean;
      opacity?: number;
      position?: string;
      includeQrCode?: boolean;
    }
  ): Promise<any> {
    const { documentId, folderId, projectId, ...rest } = config;
    
    const existingConditions: any[] = [eq(vdrWatermarks.orgId, orgId)];
    
    if (documentId) {
      existingConditions.push(eq(vdrWatermarks.documentId, documentId));
    } else if (folderId) {
      existingConditions.push(eq(vdrWatermarks.folderId, folderId));
    } else if (projectId) {
      existingConditions.push(eq(vdrWatermarks.projectId, projectId));
    }
    
    const existing = await db.query.vdrWatermarks.findFirst({
      where: and(...existingConditions)
    });
    
    if (existing) {
      const [updated] = await db
        .update(vdrWatermarks)
        .set({
          ...rest,
          isDynamic: config.watermarkType === 'dynamic',
        })
        .where(eq(vdrWatermarks.id, existing.id))
        .returning();
      
      return updated;
    }
    
    const [created] = await db
      .insert(vdrWatermarks)
      .values({
        documentId: documentId || null,
        folderId: folderId || null,
        projectId: projectId || null,
        orgId,
        createdBy,
        watermarkType: config.watermarkType,
        staticText: config.staticText || null,
        isDynamic: config.watermarkType === 'dynamic',
        opacity: config.opacity ?? 30,
        position: config.position ?? 'diagonal',
        includeQrCode: config.includeQrCode ?? false,
      })
      .returning();
    
    return created;
  }

  async removeWatermarkConfig(
    orgId: string,
    documentId?: string,
    folderId?: string,
    projectId?: string
  ): Promise<boolean> {
    const conditions: any[] = [eq(vdrWatermarks.orgId, orgId)];
    
    if (documentId) {
      conditions.push(eq(vdrWatermarks.documentId, documentId));
    } else if (folderId) {
      conditions.push(eq(vdrWatermarks.folderId, folderId));
    } else if (projectId) {
      conditions.push(eq(vdrWatermarks.projectId, projectId));
    } else {
      return false;
    }
    
    const result = await db
      .delete(vdrWatermarks)
      .where(and(...conditions));
    
    return true;
  }

  async getProjectWatermarkSettings(projectId: string, orgId: string): Promise<{
    projectWatermark: any | null;
    folderWatermarks: any[];
    documentWatermarks: any[];
  }> {
    const projectWatermark = await db.query.vdrWatermarks.findFirst({
      where: and(
        eq(vdrWatermarks.orgId, orgId),
        eq(vdrWatermarks.projectId, projectId),
        isNotNull(vdrWatermarks.projectId)
      )
    });
    
    const folders = await db.query.vdrFolders.findMany({
      where: and(
        eq(vdrFolders.projectId, projectId),
        eq(vdrFolders.orgId, orgId)
      )
    });
    
    const folderIds = folders.map(f => f.id);
    
    let folderWatermarks: any[] = [];
    if (folderIds.length > 0) {
      folderWatermarks = await db.query.vdrWatermarks.findMany({
        where: and(
          eq(vdrWatermarks.orgId, orgId),
          isNotNull(vdrWatermarks.folderId)
        )
      });
      folderWatermarks = folderWatermarks.filter(w => folderIds.includes(w.folderId!));
    }
    
    const documents = await db.query.vdrDocuments.findMany({
      where: and(
        eq(vdrDocuments.projectId, projectId),
        eq(vdrDocuments.orgId, orgId)
      )
    });
    
    const documentIds = documents.map(d => d.id);
    
    let documentWatermarks: any[] = [];
    if (documentIds.length > 0) {
      documentWatermarks = await db.query.vdrWatermarks.findMany({
        where: and(
          eq(vdrWatermarks.orgId, orgId),
          isNotNull(vdrWatermarks.documentId)
        )
      });
      documentWatermarks = documentWatermarks.filter(w => documentIds.includes(w.documentId!));
    }
    
    return {
      projectWatermark,
      folderWatermarks,
      documentWatermarks,
    };
  }

  generateWatermarkMetadata(context: WatermarkContext): string {
    return JSON.stringify({
      downloadedBy: context.userName,
      email: context.userEmail,
      timestamp: context.timestamp.toISOString(),
      document: context.documentName,
      project: context.projectName,
      ipAddress: context.ipAddress,
    });
  }
}

export const vdrWatermarkService = new VdrWatermarkService();
