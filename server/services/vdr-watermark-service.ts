import { db } from '../db';
import { vdrWatermarks, vdrDocuments, vdrFolders, vdrAuditLogs, projects, users, externalUsers, organizations } from '@shared/schema';
import { eq, and, isNotNull, or } from 'drizzle-orm';
import { Readable, PassThrough } from 'stream';
import { format } from 'date-fns';
import { PDFDocument, rgb, degrees, StandardFonts } from 'pdf-lib';

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
  documentId: string;
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
      documentId,
      projectName,
      ipAddress,
    };
  }

  generateWatermarkText(config: WatermarkConfig, context: WatermarkContext): string {
    if (!config.isDynamic && config.staticText) {
      return config.staticText;
    }
    
    const formattedDate = format(context.timestamp, "yyyy-MM-dd HH:mm:ss 'UTC'");
    const shortDocId = context.documentId.substring(0, 8);
    
    return `CONFIDENTIAL - ${context.userEmail} - ${formattedDate} - Doc: ${shortDocId}`;
  }

  generateWatermarkLines(context: WatermarkContext): string[] {
    const formattedDate = format(context.timestamp, "yyyy-MM-dd HH:mm:ss 'UTC'");
    const shortDocId = context.documentId.substring(0, 8);
    
    return [
      'CONFIDENTIAL',
      context.userEmail,
      formattedDate,
      `Document ID: ${shortDocId}`,
    ];
  }

  async streamToBuffer(stream: Readable): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
      stream.on('end', () => resolve(Buffer.concat(chunks)));
      stream.on('error', reject);
    });
  }

  async applyPdfWatermark(
    pdfBuffer: Buffer,
    watermarkText: string,
    config: WatermarkConfig,
    context?: WatermarkContext
  ): Promise<Buffer> {
    try {
      const pdfDoc = await PDFDocument.load(pdfBuffer);
      const helveticaFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      const pages = pdfDoc.getPages();
      
      const opacity = (config.opacity || 30) / 100;
      const watermarkColor = rgb(0.6, 0.6, 0.6);
      
      for (const page of pages) {
        const { width, height } = page.getSize();
        
        if (config.position === 'diagonal' || !config.position) {
          const diagonalAngle = 45;
          const mainFontSize = 14;
          const lineSpacing = 22;
          
          const watermarkLines = context 
            ? this.generateWatermarkLines(context)
            : [watermarkText];
          
          const positions = [
            { x: width * 0.15, y: height * 0.85 },
            { x: width * 0.5, y: height * 0.5 },
            { x: width * 0.85, y: height * 0.15 },
            { x: width * 0.3, y: height * 0.3 },
            { x: width * 0.7, y: height * 0.7 },
          ];
          
          for (const pos of positions) {
            let yOffset = 0;
            for (const line of watermarkLines) {
              page.drawText(line, {
                x: pos.x,
                y: pos.y - yOffset,
                size: mainFontSize,
                font: helveticaFont,
                color: watermarkColor,
                opacity: opacity,
                rotate: degrees(diagonalAngle),
              });
              yOffset += lineSpacing;
            }
          }
          
          const footerFontSize = 9;
          const footerText = watermarkText;
          const footerWidth = helveticaFont.widthOfTextAtSize(footerText, footerFontSize);
          page.drawText(footerText, {
            x: (width - footerWidth) / 2,
            y: 15,
            size: footerFontSize,
            font: helveticaFont,
            color: watermarkColor,
            opacity: opacity * 1.5,
          });
          
        } else if (config.position === 'tiled') {
          const spacing = 180;
          const tileFontSize = 10;
          for (let x = 50; x < width; x += spacing) {
            for (let y = 50; y < height; y += spacing) {
              page.drawText(watermarkText, {
                x: x,
                y: y,
                size: tileFontSize,
                font: helveticaFont,
                color: watermarkColor,
                opacity: opacity * 0.7,
                rotate: degrees(45),
              });
            }
          }
        } else if (config.position === 'center') {
          const centerFontSize = 16;
          const textWidth = helveticaFont.widthOfTextAtSize(watermarkText, centerFontSize);
          page.drawText(watermarkText, {
            x: (width - textWidth) / 2,
            y: height / 2,
            size: centerFontSize,
            font: helveticaFont,
            color: watermarkColor,
            opacity: opacity,
          });
        } else if (config.position === 'corners') {
          const margin = 30;
          const cornerFontSize = 10;
          
          page.drawText(watermarkText, {
            x: margin,
            y: height - margin,
            size: cornerFontSize,
            font: helveticaFont,
            color: watermarkColor,
            opacity: opacity,
          });
          
          page.drawText(watermarkText, {
            x: margin,
            y: margin,
            size: cornerFontSize,
            font: helveticaFont,
            color: watermarkColor,
            opacity: opacity,
          });
          
          const textWidth = helveticaFont.widthOfTextAtSize(watermarkText, cornerFontSize);
          page.drawText(watermarkText, {
            x: width - margin - textWidth,
            y: height - margin,
            size: cornerFontSize,
            font: helveticaFont,
            color: watermarkColor,
            opacity: opacity,
          });
          
          page.drawText(watermarkText, {
            x: width - margin - textWidth,
            y: margin,
            size: cornerFontSize,
            font: helveticaFont,
            color: watermarkColor,
            opacity: opacity,
          });
        }
      }
      
      return Buffer.from(await pdfDoc.save());
    } catch (error) {
      console.error('Error applying PDF watermark:', error);
      return pdfBuffer;
    }
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
    
    try {
      const pdfBuffer = await this.streamToBuffer(inputStream);
      const watermarkedBuffer = await this.applyPdfWatermark(pdfBuffer, watermarkText, config, context);
      const outputStream = new PassThrough();
      outputStream.end(watermarkedBuffer);
      
      return {
        stream: outputStream,
        watermarkApplied: true,
        watermarkText,
      };
    } catch (error) {
      console.error('Error applying watermark:', error);
      return {
        stream: inputStream,
        watermarkApplied: false,
        watermarkText: undefined,
      };
    }
  }

  async applyWatermarkToBuffer(
    pdfBuffer: Buffer,
    userId: string | null,
    externalUserId: string | null,
    orgId: string,
    documentId: string,
    ipAddress?: string
  ): Promise<{ buffer: Buffer; watermarkApplied: boolean; watermarkText?: string }> {
    const document = await db.query.vdrDocuments.findFirst({
      where: eq(vdrDocuments.id, documentId)
    });
    
    if (!document) {
      return { buffer: pdfBuffer, watermarkApplied: false };
    }
    
    let config = await this.getWatermarkConfig(
      orgId,
      documentId,
      document.folderId,
      document.projectId
    );
    
    if (!config && externalUserId) {
      config = {
        isDynamic: true,
        opacity: 30,
        position: 'diagonal',
        includeQrCode: false,
      };
    }
    
    if (!config) {
      return { buffer: pdfBuffer, watermarkApplied: false };
    }
    
    const context = await this.getWatermarkContext(
      userId,
      externalUserId,
      orgId,
      documentId,
      ipAddress
    );
    
    const watermarkText = this.generateWatermarkText(config, context);
    const watermarkedBuffer = await this.applyPdfWatermark(pdfBuffer, watermarkText, config, context);
    
    return {
      buffer: watermarkedBuffer,
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
    
    let config = await this.getWatermarkConfig(
      orgId,
      documentId,
      document.folderId,
      document.projectId
    );
    
    if (!config && externalUserId) {
      config = {
        isDynamic: true,
        opacity: 30,
        position: 'diagonal',
        includeQrCode: false,
      };
    }
    
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

  generateWatermarkMetadata(context: WatermarkContext): Record<string, any> {
    return {
      downloadedBy: context.userName,
      email: context.userEmail,
      timestamp: context.timestamp.toISOString(),
      documentId: context.documentId,
      document: context.documentName,
      project: context.projectName,
      ipAddress: context.ipAddress,
    };
  }

  async logWatermarkedDownload(
    context: WatermarkContext,
    orgId: string,
    userId: string | null,
    externalUserId: string | null,
    projectId: string,
    watermarkApplied: boolean
  ): Promise<void> {
    const metadata = this.generateWatermarkMetadata(context);
    
    await db.insert(vdrAuditLogs).values({
      documentId: context.documentId,
      userId: userId,
      externalUserId: externalUserId,
      eventType: 'download',
      ipAddress: context.ipAddress || null,
      metadata: {
        ...metadata,
        watermarkApplied,
        downloadType: 'watermarked',
      },
      orgId,
    });
  }
}

export const vdrWatermarkService = new VdrWatermarkService();
