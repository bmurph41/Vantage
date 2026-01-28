/**
 * Document Builder Service
 * Handles document creation, section management, data binding, and completion tracking
 */

import { db } from '../../db';
import { eq, and, desc, asc, sql } from 'drizzle-orm';
import {
  omBuilderDocuments,
  omDocumentSections,
  omExemplars,
  omExportJobs,
  omBindingCache,
  type OmBuilderDocument,
  type OmDocumentSection,
  type InsertOmBuilderDocument,
  type InsertOmDocumentSection,
} from '@shared/document-builder/schema';
import {
  SECTION_LIBRARY,
  getSectionsByDocType,
  getSectionDefinition,
} from '@shared/document-builder/section-library';
import {
  DOCUMENT_TYPE_CONFIGS,
  type DocumentType,
  type DocumentConfig,
  type CompletionStatus,
  type BuilderCompletionSummary,
  type ResolvedBinding,
  type DataSource,
} from '@shared/document-builder/types';

// =============================================================================
// Document CRUD Operations
// =============================================================================

export interface CreateDocumentParams {
  dealId: string;
  documentType: DocumentType;
  title: string;
  audience?: string;
  assetClass?: string;
  themeId?: string;
  templateId?: string;
  brandKitId?: string;
  createdBy?: string;
  exemplarIds?: string[];
}

export interface UpdateDocumentParams {
  title?: string;
  audience?: string;
  assetClass?: string;
  themeId?: string;
  templateId?: string;
  brandKitId?: string;
  status?: string;
  metadata?: Record<string, any>;
}

class DocumentBuilderService {
  /**
   * Create a new document with default sections based on document type
   */
  async createDocument(params: CreateDocumentParams): Promise<OmBuilderDocument> {
    const docTypeConfig = DOCUMENT_TYPE_CONFIGS[params.documentType];
    if (!docTypeConfig) {
      throw new Error(`Invalid document type: ${params.documentType}`);
    }

    // Create the document
    const [document] = await db
      .insert(omBuilderDocuments)
      .values({
        dealId: params.dealId,
        documentType: params.documentType,
        title: params.title,
        audience: params.audience as any,
        assetClass: params.assetClass as any,
        themeId: params.themeId,
        templateId: params.templateId,
        brandKitId: params.brandKitId,
        createdBy: params.createdBy,
        config: {
          sections: docTypeConfig.defaultSections,
          settings: {},
        },
        metadata: {
          exemplarIds: params.exemplarIds || [],
        },
        status: 'draft',
      })
      .returning();

    // Create default sections
    const sectionsToCreate = docTypeConfig.defaultSections;
    for (let i = 0; i < sectionsToCreate.length; i++) {
      const sectionKey = sectionsToCreate[i];
      const sectionDef = getSectionDefinition(sectionKey);
      
      if (sectionDef) {
        await db.insert(omDocumentSections).values({
          documentId: document.id,
          sectionKey,
          order: i,
          enabled: true,
          dataBindings: [],
          media: [],
          content: {},
          completionStatus: {
            isComplete: false,
            completedFields: [],
            missingFields: sectionDef.requiredDataBindings.map(b => b.bindingKey),
            missingMedia: sectionDef.requiredMedia.map(m => m.mediaKey),
            warnings: [],
            percentage: 0,
          },
        });
      }
    }

    // Update completion status
    await this.updateDocumentCompletion(document.id);

    return document;
  }

  /**
   * Get a document by ID with all sections
   */
  async getDocument(documentId: string): Promise<{
    document: OmBuilderDocument;
    sections: OmDocumentSection[];
  } | null> {
    const [document] = await db
      .select()
      .from(omBuilderDocuments)
      .where(eq(omBuilderDocuments.id, documentId))
      .limit(1);

    if (!document) {
      return null;
    }

    const sections = await db
      .select()
      .from(omDocumentSections)
      .where(eq(omDocumentSections.documentId, documentId))
      .orderBy(asc(omDocumentSections.order));

    return { document, sections };
  }

  /**
   * Get all documents for a deal
   */
  async getDocumentsByDeal(dealId: string): Promise<OmBuilderDocument[]> {
    return db
      .select()
      .from(omBuilderDocuments)
      .where(eq(omBuilderDocuments.dealId, dealId))
      .orderBy(desc(omBuilderDocuments.updatedAt));
  }

  /**
   * Update a document
   */
  async updateDocument(
    documentId: string,
    params: UpdateDocumentParams
  ): Promise<OmBuilderDocument> {
    const updateData: any = {
      updatedAt: new Date(),
    };

    if (params.title) updateData.title = params.title;
    if (params.audience) updateData.audience = params.audience;
    if (params.assetClass) updateData.assetClass = params.assetClass;
    if (params.themeId !== undefined) updateData.themeId = params.themeId;
    if (params.templateId !== undefined) updateData.templateId = params.templateId;
    if (params.brandKitId !== undefined) updateData.brandKitId = params.brandKitId;
    if (params.status) updateData.status = params.status;
    if (params.metadata) {
      const [existing] = await db
        .select({ metadata: omBuilderDocuments.metadata })
        .from(omBuilderDocuments)
        .where(eq(omBuilderDocuments.id, documentId))
        .limit(1);
      
      updateData.metadata = {
        ...(existing?.metadata || {}),
        ...params.metadata,
      };
    }

    const [updated] = await db
      .update(omBuilderDocuments)
      .set(updateData)
      .where(eq(omBuilderDocuments.id, documentId))
      .returning();

    return updated;
  }

  /**
   * Delete a document and all its sections
   */
  async deleteDocument(documentId: string): Promise<void> {
    await db.delete(omBuilderDocuments).where(eq(omBuilderDocuments.id, documentId));
  }

  // =============================================================================
  // Section Management
  // =============================================================================

  /**
   * Add a section to a document
   */
  async addSection(
    documentId: string,
    sectionKey: string,
    order?: number
  ): Promise<OmDocumentSection> {
    const sectionDef = getSectionDefinition(sectionKey);
    if (!sectionDef) {
      throw new Error(`Invalid section key: ${sectionKey}`);
    }

    // Get current max order if not specified
    if (order === undefined) {
      const [maxOrder] = await db
        .select({ maxOrder: sql<number>`MAX("order")` })
        .from(omDocumentSections)
        .where(eq(omDocumentSections.documentId, documentId));
      order = (maxOrder?.maxOrder ?? -1) + 1;
    }

    const [section] = await db
      .insert(omDocumentSections)
      .values({
        documentId,
        sectionKey,
        order,
        enabled: true,
        dataBindings: [],
        media: [],
        content: {},
        completionStatus: {
          isComplete: false,
          completedFields: [],
          missingFields: sectionDef.requiredDataBindings.map(b => b.bindingKey),
          missingMedia: sectionDef.requiredMedia.map(m => m.mediaKey),
          warnings: [],
          percentage: 0,
        },
      })
      .returning();

    // Update document config and completion
    await this.updateDocumentSectionsList(documentId);
    await this.updateDocumentCompletion(documentId);

    return section;
  }

  /**
   * Remove a section from a document
   */
  async removeSection(sectionId: string): Promise<void> {
    const [section] = await db
      .select()
      .from(omDocumentSections)
      .where(eq(omDocumentSections.id, sectionId))
      .limit(1);

    if (!section) return;

    await db.delete(omDocumentSections).where(eq(omDocumentSections.id, sectionId));

    // Reorder remaining sections
    const remaining = await db
      .select()
      .from(omDocumentSections)
      .where(eq(omDocumentSections.documentId, section.documentId))
      .orderBy(asc(omDocumentSections.order));

    for (let i = 0; i < remaining.length; i++) {
      await db
        .update(omDocumentSections)
        .set({ order: i })
        .where(eq(omDocumentSections.id, remaining[i].id));
    }

    // Update document config and completion
    await this.updateDocumentSectionsList(section.documentId);
    await this.updateDocumentCompletion(section.documentId);
  }

  /**
   * Reorder sections in a document
   */
  async reorderSections(
    documentId: string,
    sectionIds: string[]
  ): Promise<OmDocumentSection[]> {
    for (let i = 0; i < sectionIds.length; i++) {
      await db
        .update(omDocumentSections)
        .set({ order: i, updatedAt: new Date() })
        .where(
          and(
            eq(omDocumentSections.id, sectionIds[i]),
            eq(omDocumentSections.documentId, documentId)
          )
        );
    }

    await this.updateDocumentSectionsList(documentId);

    return db
      .select()
      .from(omDocumentSections)
      .where(eq(omDocumentSections.documentId, documentId))
      .orderBy(asc(omDocumentSections.order));
  }

  /**
   * Toggle section enabled status
   */
  async toggleSection(sectionId: string, enabled: boolean): Promise<OmDocumentSection> {
    const [updated] = await db
      .update(omDocumentSections)
      .set({ enabled, updatedAt: new Date() })
      .where(eq(omDocumentSections.id, sectionId))
      .returning();

    await this.updateDocumentCompletion(updated.documentId);

    return updated;
  }

  /**
   * Update section content
   */
  async updateSectionContent(
    sectionId: string,
    content: Record<string, any>
  ): Promise<OmDocumentSection> {
    const [section] = await db
      .select()
      .from(omDocumentSections)
      .where(eq(omDocumentSections.id, sectionId))
      .limit(1);

    if (!section) {
      throw new Error(`Section not found: ${sectionId}`);
    }

    const mergedContent = {
      ...(section.content || {}),
      ...content,
    };

    const [updated] = await db
      .update(omDocumentSections)
      .set({
        content: mergedContent,
        updatedAt: new Date(),
      })
      .where(eq(omDocumentSections.id, sectionId))
      .returning();

    // Recalculate completion status
    await this.updateSectionCompletion(sectionId);
    await this.updateDocumentCompletion(section.documentId);

    return updated;
  }

  /**
   * Update section data bindings
   */
  async updateSectionBindings(
    sectionId: string,
    bindings: ResolvedBinding[]
  ): Promise<OmDocumentSection> {
    const [section] = await db
      .select()
      .from(omDocumentSections)
      .where(eq(omDocumentSections.id, sectionId))
      .limit(1);

    if (!section) {
      throw new Error(`Section not found: ${sectionId}`);
    }

    const [updated] = await db
      .update(omDocumentSections)
      .set({
        dataBindings: bindings,
        updatedAt: new Date(),
      })
      .where(eq(omDocumentSections.id, sectionId))
      .returning();

    // Recalculate completion status
    await this.updateSectionCompletion(sectionId);
    await this.updateDocumentCompletion(section.documentId);

    return updated;
  }

  /**
   * Update section media
   */
  async updateSectionMedia(
    sectionId: string,
    media: Array<{
      mediaKey: string;
      assetId: string;
      url: string;
      caption?: string;
      altText?: string;
      isCover?: boolean;
    }>
  ): Promise<OmDocumentSection> {
    const [section] = await db
      .select()
      .from(omDocumentSections)
      .where(eq(omDocumentSections.id, sectionId))
      .limit(1);

    if (!section) {
      throw new Error(`Section not found: ${sectionId}`);
    }

    const [updated] = await db
      .update(omDocumentSections)
      .set({
        media,
        updatedAt: new Date(),
      })
      .where(eq(omDocumentSections.id, sectionId))
      .returning();

    // Recalculate completion status
    await this.updateSectionCompletion(sectionId);
    await this.updateDocumentCompletion(section.documentId);

    return updated;
  }

  // =============================================================================
  // Completion Tracking
  // =============================================================================

  /**
   * Update section completion status
   */
  private async updateSectionCompletion(sectionId: string): Promise<void> {
    const [section] = await db
      .select()
      .from(omDocumentSections)
      .where(eq(omDocumentSections.id, sectionId))
      .limit(1);

    if (!section) return;

    const sectionDef = getSectionDefinition(section.sectionKey);
    if (!sectionDef) return;

    const completedFields: string[] = [];
    const missingFields: string[] = [];
    const missingMedia: string[] = [];
    const warnings: string[] = [];

    // Check required data bindings
    for (const req of sectionDef.requiredDataBindings) {
      const binding = (section.dataBindings as any[])?.find(
        (b: any) => b.bindingKey === req.bindingKey
      );
      if (binding && binding.value !== null && binding.value !== undefined) {
        completedFields.push(req.bindingKey);
      } else {
        missingFields.push(req.bindingKey);
      }
    }

    // Check required media
    for (const req of sectionDef.requiredMedia) {
      const media = (section.media as any[])?.find(
        (m: any) => m.mediaKey === req.mediaKey
      );
      if (media && media.url) {
        completedFields.push(req.mediaKey);
      } else {
        missingMedia.push(req.mediaKey);
      }
    }

    // Check content based on completion rules
    for (const rule of sectionDef.completionRules) {
      if (rule.type === 'required_field' && rule.field) {
        const content = section.content as any;
        const value = content?.[rule.field];
        if (!value || (typeof value === 'string' && value.trim() === '')) {
          if (!missingFields.includes(rule.field)) {
            missingFields.push(rule.field);
          }
        } else {
          if (!completedFields.includes(rule.field)) {
            completedFields.push(rule.field);
          }
        }
      }

      if (rule.type === 'min_content_length' && rule.field && rule.minLength) {
        const content = section.content as any;
        const value = content?.[rule.field];
        if (typeof value === 'string' && value.length < rule.minLength) {
          warnings.push(rule.errorMessage);
        }
      }
    }

    const totalRequired = sectionDef.requiredDataBindings.length +
      sectionDef.requiredMedia.length +
      sectionDef.completionRules.filter(r => r.type === 'required_field').length;

    const completed = completedFields.length;
    const percentage = totalRequired > 0 ? Math.round((completed / totalRequired) * 100) : 100;
    const isComplete = missingFields.length === 0 && missingMedia.length === 0;

    await db
      .update(omDocumentSections)
      .set({
        completionStatus: {
          isComplete,
          completedFields,
          missingFields,
          missingMedia,
          warnings,
          percentage,
        },
      })
      .where(eq(omDocumentSections.id, sectionId));
  }

  /**
   * Update document overall completion status
   */
  private async updateDocumentCompletion(documentId: string): Promise<void> {
    const sections = await db
      .select()
      .from(omDocumentSections)
      .where(
        and(
          eq(omDocumentSections.documentId, documentId),
          eq(omDocumentSections.enabled, true)
        )
      );

    const totalSections = sections.length;
    const completedSections = sections.filter(
      (s) => (s.completionStatus as any)?.isComplete
    ).length;
    const sectionsWithWarnings = sections.filter(
      (s) => ((s.completionStatus as any)?.warnings?.length ?? 0) > 0
    ).length;

    const percentage = totalSections > 0
      ? Math.round((completedSections / totalSections) * 100)
      : 0;
    const readyToExport = completedSections === totalSections && totalSections > 0;

    await db
      .update(omBuilderDocuments)
      .set({
        completionStatus: {
          totalSections,
          completedSections,
          percentage,
          readyToExport,
        },
        updatedAt: new Date(),
      })
      .where(eq(omBuilderDocuments.id, documentId));
  }

  /**
   * Update document sections list in config
   */
  private async updateDocumentSectionsList(documentId: string): Promise<void> {
    const sections = await db
      .select({ sectionKey: omDocumentSections.sectionKey })
      .from(omDocumentSections)
      .where(eq(omDocumentSections.documentId, documentId))
      .orderBy(asc(omDocumentSections.order));

    const [document] = await db
      .select({ config: omBuilderDocuments.config })
      .from(omBuilderDocuments)
      .where(eq(omBuilderDocuments.id, documentId))
      .limit(1);

    const config = (document?.config as any) || { sections: [], settings: {} };
    config.sections = sections.map((s) => s.sectionKey);

    await db
      .update(omBuilderDocuments)
      .set({ config, updatedAt: new Date() })
      .where(eq(omBuilderDocuments.id, documentId));
  }

  // =============================================================================
  // Builder Mode Helpers
  // =============================================================================

  /**
   * Get available sections for a document type
   */
  getAvailableSections(documentType: DocumentType): {
    default: string[];
    required: string[];
    optional: string[];
    all: Array<{
      sectionKey: string;
      name: string;
      description: string;
      category: string;
      estimatedPages: number;
      isRequired: boolean;
      isDefault: boolean;
    }>;
  } {
    const config = DOCUMENT_TYPE_CONFIGS[documentType];
    if (!config) {
      return { default: [], required: [], optional: [], all: [] };
    }

    const availableSections = getSectionsByDocType(documentType);

    return {
      default: config.defaultSections,
      required: config.requiredSections,
      optional: config.optionalSections,
      all: availableSections.map((s) => ({
        sectionKey: s.sectionKey,
        name: s.name,
        description: s.description,
        category: s.category,
        estimatedPages: s.estimatedPages,
        isRequired: config.requiredSections.includes(s.sectionKey),
        isDefault: config.defaultSections.includes(s.sectionKey),
      })),
    };
  }

  /**
   * Get document type configurations
   */
  getDocumentTypeConfigs() {
    return DOCUMENT_TYPE_CONFIGS;
  }

  /**
   * Get section library
   */
  getSectionLibrary() {
    return SECTION_LIBRARY;
  }

  /**
   * Get builder completion summary for a document
   */
  async getBuilderCompletionSummary(
    documentId: string
  ): Promise<BuilderCompletionSummary> {
    const [document] = await db
      .select({ completionStatus: omBuilderDocuments.completionStatus })
      .from(omBuilderDocuments)
      .where(eq(omBuilderDocuments.id, documentId))
      .limit(1);

    if (!document) {
      return {
        totalSections: 0,
        completedSections: 0,
        sectionsWithWarnings: 0,
        overallPercentage: 0,
        readyToExport: false,
      };
    }

    const status = document.completionStatus as any;

    const sections = await db
      .select({ completionStatus: omDocumentSections.completionStatus })
      .from(omDocumentSections)
      .where(
        and(
          eq(omDocumentSections.documentId, documentId),
          eq(omDocumentSections.enabled, true)
        )
      );

    const sectionsWithWarnings = sections.filter(
      (s) => ((s.completionStatus as any)?.warnings?.length ?? 0) > 0
    ).length;

    return {
      totalSections: status?.totalSections ?? 0,
      completedSections: status?.completedSections ?? 0,
      sectionsWithWarnings,
      overallPercentage: status?.percentage ?? 0,
      readyToExport: status?.readyToExport ?? false,
    };
  }

  // =============================================================================
  // Export Methods
  // =============================================================================

  /**
   * Create an export job
   */
  async createExportJob(
    documentId: string,
    format: 'pdf' | 'pptx' | 'docx',
    options?: Record<string, any>
  ): Promise<{ id: string }> {
    const [job] = await db
      .insert(omExportJobs)
      .values({
        documentId,
        format,
        status: 'queued',
        options: options || {},
      })
      .returning({ id: omExportJobs.id });

    return job;
  }

  /**
   * Get export job status
   */
  async getExportJob(jobId: string) {
    const [job] = await db
      .select()
      .from(omExportJobs)
      .where(eq(omExportJobs.id, jobId))
      .limit(1);

    return job;
  }

  /**
   * Update export job status
   */
  async updateExportJob(
    jobId: string,
    updates: {
      status?: 'queued' | 'processing' | 'completed' | 'failed';
      outputUrl?: string;
      outputFileName?: string;
      fileSizeBytes?: number;
      errorMessage?: string;
      errorDetails?: Record<string, any>;
    }
  ) {
    const updateData: any = {};
    
    if (updates.status) updateData.status = updates.status;
    if (updates.outputUrl) updateData.outputUrl = updates.outputUrl;
    if (updates.outputFileName) updateData.outputFileName = updates.outputFileName;
    if (updates.fileSizeBytes) updateData.fileSizeBytes = updates.fileSizeBytes;
    if (updates.errorMessage) updateData.errorMessage = updates.errorMessage;
    if (updates.errorDetails) updateData.errorDetails = updates.errorDetails;

    if (updates.status === 'processing') {
      updateData.startedAt = new Date();
    }
    if (updates.status === 'completed' || updates.status === 'failed') {
      updateData.completedAt = new Date();
    }

    const [job] = await db
      .update(omExportJobs)
      .set(updateData)
      .where(eq(omExportJobs.id, jobId))
      .returning();

    return job;
  }
}

export const documentBuilderService = new DocumentBuilderService();
