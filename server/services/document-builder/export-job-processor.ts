/**
 * Export Job Processor Service
 * Processes export jobs and generates output files
 */

import * as fs from 'fs';
import * as path from 'path';
import { documentBuilderService } from './document-builder-service';
import { pdfExportService } from './pdf-export-service';
import { pptxExportService } from './pptx-export-service';
import { docxExportService } from './docx-export-service';
import { DocumentType, AudiencePersona } from '../../../shared/document-builder/types';
import { db } from '../../db';
import { omBuilderDocuments, omDocumentSections, omExportJobs } from '../../../shared/document-builder/schema';
import { eq, and, asc } from 'drizzle-orm';

// =============================================================================
// Types
// =============================================================================

export interface ExportJobResult {
  success: boolean;
  outputUrl?: string;
  outputFileName?: string;
  fileSizeBytes?: number;
  error?: string;
  errorDetails?: Record<string, any>;
}

export interface ProcessedDocumentData {
  id: string;
  title: string;
  documentType: DocumentType;
  audience?: AudiencePersona;
  sections: ProcessedSection[];
  theme?: any;
  metadata?: Record<string, any>;
}

export interface ProcessedSection {
  id: string;
  sectionKey: string;
  order: number;
  enabled: boolean;
  content: Record<string, any>;
  dataBindings: Record<string, any>;
  media: Record<string, any>;
  completionStatus: {
    isComplete: boolean;
    percentage: number;
  };
}

// =============================================================================
// Export Job Processor
// =============================================================================

class ExportJobProcessor {
  private outputDir: string;

  constructor() {
    this.outputDir = path.join(process.cwd(), 'server', 'uploads', 'document-exports');
    this.ensureOutputDir();
  }

  /**
   * Ensure output directory exists
   */
  private ensureOutputDir(): void {
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  /**
   * Process a single export job
   */
  async processJob(jobId: string): Promise<ExportJobResult> {
    try {
      // Get job details
      const [job] = await db
        .select()
        .from(omExportJobs)
        .where(eq(omExportJobs.id, jobId))
        .limit(1);

      if (!job) {
        return {
          success: false,
          error: 'Export job not found',
        };
      }

      // Update status to processing
      await documentBuilderService.updateExportJob(jobId, {
        status: 'processing',
      });

      // Get document data
      const documentData = await this.getDocumentData(job.documentId);
      if (!documentData) {
        await documentBuilderService.updateExportJob(jobId, {
          status: 'failed',
          errorMessage: 'Document not found',
        });
        return {
          success: false,
          error: 'Document not found',
        };
      }

      // Generate export based on format
      let buffer: Buffer;
      let extension: string;

      switch (job.format) {
        case 'pdf':
          buffer = await this.generatePdf(documentData, job.options as any);
          extension = 'pdf';
          break;

        case 'pptx':
          buffer = await this.generatePptx(documentData, job.options as any);
          extension = 'pptx';
          break;

        case 'docx':
          buffer = await this.generateDocx(documentData, job.options as any);
          extension = 'docx';
          break;

        default:
          throw new Error(`Unsupported export format: ${job.format}`);
      }

      // Save file
      const fileName = this.generateFileName(documentData.title, job.documentId, extension);
      const filePath = path.join(this.outputDir, fileName);
      fs.writeFileSync(filePath, buffer);

      // Get file size
      const stats = fs.statSync(filePath);
      const fileSizeBytes = stats.size;

      // Generate URL
      const outputUrl = `/api/document-builder/export/${jobId}/download`;

      // Update job with success
      await documentBuilderService.updateExportJob(jobId, {
        status: 'completed',
        outputUrl,
        outputFileName: fileName,
        fileSizeBytes,
      });

      return {
        success: true,
        outputUrl,
        outputFileName: fileName,
        fileSizeBytes,
      };
    } catch (error) {
      console.error('Export job processing failed:', error);

      // Update job with failure
      await documentBuilderService.updateExportJob(jobId, {
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : 'Export failed',
        errorDetails: error instanceof Error ? { stack: error.stack } : {},
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Export failed',
        errorDetails: error instanceof Error ? { stack: error.stack } : {},
      };
    }
  }

  /**
   * Get document data for export
   */
  private async getDocumentData(documentId: string): Promise<ProcessedDocumentData | null> {
    // Get document
    const [document] = await db
      .select()
      .from(omBuilderDocuments)
      .where(eq(omBuilderDocuments.id, documentId))
      .limit(1);

    if (!document) {
      return null;
    }

    // Get sections
    const sections = await db
      .select()
      .from(omDocumentSections)
      .where(
        and(
          eq(omDocumentSections.documentId, documentId),
          eq(omDocumentSections.enabled, true)
        )
      )
      .orderBy(asc(omDocumentSections.order));

    return {
      id: document.id,
      title: document.title,
      documentType: document.documentType as DocumentType,
      audience: document.audience as AudiencePersona | undefined,
      sections: sections.map(s => ({
        id: s.id,
        sectionKey: s.sectionKey,
        order: s.order,
        enabled: s.enabled,
        content: (s.content || {}) as Record<string, any>,
        dataBindings: (s.dataBindings || {}) as Record<string, any>,
        media: (s.media || {}) as Record<string, any>,
        completionStatus: (s.completionStatus || { isComplete: false, percentage: 0 }) as {
          isComplete: boolean;
          percentage: number;
        },
      })),
      theme: (document.config as any)?.theme,
      metadata: document.metadata as Record<string, any> | undefined,
    };
  }

  /**
   * Generate PDF export
   */
  private async generatePdf(
    documentData: ProcessedDocumentData,
    options: any = {}
  ): Promise<Buffer> {
    return pdfExportService.generateDocument(
      {
        id: documentData.id,
        title: documentData.title,
        documentType: documentData.documentType,
        audience: documentData.audience,
        sections: documentData.sections,
        theme: documentData.theme,
        metadata: documentData.metadata,
      },
      {
        pageSize: options?.pageSize || 'letter',
        includeTableOfContents: options?.includeTableOfContents !== false,
        includePageNumbers: options?.includePageNumbers !== false,
        includeHeaders: options?.includeHeaders !== false,
        includeFooters: options?.includeFooters !== false,
        companyName: options?.companyName || 'Vantage',
        confidentialityNotice: options?.confidentialityNotice ||
          'CONFIDENTIAL - For Authorized Recipients Only',
      }
    );
  }

  /**
   * Generate PPTX export
   */
  private async generatePptx(
    documentData: ProcessedDocumentData,
    options: any = {}
  ): Promise<Buffer> {
    return pptxExportService.generatePresentation(
      {
        id: documentData.id,
        title: documentData.title,
        documentType: documentData.documentType,
        audience: documentData.audience,
        sections: documentData.sections,
        theme: documentData.theme,
        metadata: documentData.metadata,
      },
      {
        layout: options?.layout || '16x9',
        includeNotes: options?.includeNotes !== false,
        companyName: options?.companyName || 'Vantage',
        confidentialityNotice: options?.confidentialityNotice ||
          'CONFIDENTIAL - For Authorized Recipients Only',
      }
    );
  }

  /**
   * Generate DOCX export
   */
  private async generateDocx(
    documentData: ProcessedDocumentData,
    options: any = {}
  ): Promise<Buffer> {
    return docxExportService.generateDocument(
      {
        id: documentData.id,
        title: documentData.title,
        documentType: documentData.documentType,
        audience: documentData.audience,
        sections: documentData.sections,
        theme: documentData.theme,
        metadata: documentData.metadata,
      },
      {
        includeTableOfContents: options?.includeTableOfContents !== false,
        includePageNumbers: options?.includePageNumbers !== false,
        includeHeaders: options?.includeHeaders !== false,
        includeFooters: options?.includeFooters !== false,
        companyName: options?.companyName || 'Vantage',
        confidentialityNotice: options?.confidentialityNotice ||
          'CONFIDENTIAL - For Authorized Recipients Only',
      }
    );
  }

  /**
   * Generate a safe filename
   */
  private generateFileName(title: string, documentId: string, extension: string): string {
    const safeTitle = title
      .replace(/[^a-zA-Z0-9\s-]/g, '')
      .replace(/\s+/g, '_')
      .substring(0, 50);

    const timestamp = Date.now();
    return `${safeTitle}_${documentId.substring(0, 8)}_${timestamp}.${extension}`;
  }

  /**
   * Get file path for a completed export
   */
  async getExportFilePath(jobId: string): Promise<string | null> {
    const [job] = await db
      .select()
      .from(omExportJobs)
      .where(eq(omExportJobs.id, jobId))
      .limit(1);

    if (!job || !job.outputFileName || job.status !== 'completed') {
      return null;
    }

    const filePath = path.join(this.outputDir, job.outputFileName);
    if (fs.existsSync(filePath)) {
      return filePath;
    }

    return null;
  }

  /**
   * Delete export file
   */
  async deleteExportFile(jobId: string): Promise<void> {
    const filePath = await this.getExportFilePath(jobId);
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }

  /**
   * Clean up old export files (older than specified days)
   */
  async cleanupOldExports(olderThanDays: number = 7): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    let deletedCount = 0;

    try {
      const files = fs.readdirSync(this.outputDir);

      for (const file of files) {
        const filePath = path.join(this.outputDir, file);
        const stats = fs.statSync(filePath);

        if (stats.mtime < cutoffDate) {
          fs.unlinkSync(filePath);
          deletedCount++;
        }
      }
    } catch (error) {
      console.error('Error cleaning up old exports:', error);
    }

    return deletedCount;
  }

  /**
   * Process all queued export jobs
   */
  async processQueuedJobs(): Promise<void> {
    const queuedJobs = await db
      .select({ id: omExportJobs.id })
      .from(omExportJobs)
      .where(eq(omExportJobs.status, 'queued'));

    console.log(`Processing ${queuedJobs.length} queued export jobs`);

    for (const job of queuedJobs) {
      await this.processJob(job.id);
    }
  }

  /**
   * Start polling for pending export jobs
   */
  startProcessing(intervalMs = 5000): void {
    if ((this as any)._interval) return; // already running
    (this as any)._interval = setInterval(async () => {
      try {
        const { db } = await import('../../db');
        const { omExportJobs } = await import('../../../shared/document-builder/schema');
        const { eq } = await import('drizzle-orm');
        const pendingJobs = await db
          .select({ id: omExportJobs.id })
          .from(omExportJobs)
          .where(eq(omExportJobs.status, 'queued'))
          .limit(3);
        for (const job of pendingJobs) {
          await this.processJob(job.id.toString()).catch(err =>
            console.error(`[ExportProcessor] Job ${job.id} failed:`, err.message)
          );
        }
      } catch (err: any) {
        console.error('[ExportProcessor] Poll error:', err.message);
      }
    }, intervalMs);
    console.log(`[ExportProcessor] Polling every ${intervalMs}ms`);
  }

  stopProcessing(): void {
    if ((this as any)._interval) {
      clearInterval((this as any)._interval);
      (this as any)._interval = null;
    }
  }
}

export const exportJobProcessor = new ExportJobProcessor();

// =============================================================================
// Background Job Processing
// =============================================================================

/**
 * Start background job processing
 * Polls for queued jobs every 5 seconds
 */
export function startExportJobProcessing(): void {
  const POLL_INTERVAL = 5000; // 5 seconds

  const processJobs = async () => {
    try {
      await exportJobProcessor.processQueuedJobs();
    } catch (error) {
      console.error('Error processing export jobs:', error);
    }
  };

  // Initial processing
  processJobs();

  // Set up interval
  setInterval(processJobs, POLL_INTERVAL);

  console.log('Export job processing started');
}

/**
 * Schedule periodic cleanup of old exports
 * Runs daily
 */
export function scheduleExportCleanup(): void {
  const CLEANUP_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours

  const cleanup = async () => {
    try {
      const deleted = await exportJobProcessor.cleanupOldExports(7);
      console.log(`Cleaned up ${deleted} old export files`);
    } catch (error) {
      console.error('Error during export cleanup:', error);
    }
  };

  // Schedule cleanup
  setInterval(cleanup, CLEANUP_INTERVAL);

  console.log('Export cleanup scheduled');
}
