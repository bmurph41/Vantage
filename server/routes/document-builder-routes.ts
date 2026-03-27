/**
 * Document Builder API Routes
 * RESTful endpoints for document creation, section management, and export
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { eq, desc } from 'drizzle-orm';
import { db } from '../db';
import { and } from 'drizzle-orm';
import { omBuilderDocuments, omDocumentSections, omExemplars, omDocumentVersions } from '@shared/document-builder/schema';
import { omTemplates } from '@shared/schema';
import { documentBuilderService } from '../services/document-builder/document-builder-service';
import { dataBindingService } from '../services/document-builder/data-binding-service';
import { aiContentGenerationService } from '../services/document-builder/ai-content-service';
import type {
  DocumentType,
  DocumentStatus,
  AudiencePersona,
  AssetClass,
} from '@shared/document-builder/types';
import {
  DOCUMENT_STUDIO_TEMPLATES,
  TEMPLATE_REGISTRY,
  getTemplateById,
  MASTER_TOKEN_MAP,
  TOKEN_SUMMARY,
  getTokensForTemplate,
} from '@shared/document-builder/templates';
import { resolveTokens, interpolateTokens, formatTokenValue } from '../services/document-builder/token-resolver-service';

const router = Router();

const DocumentTypeValues = [
  'offering_memorandum', 'executive_summary', 'pitch_deck', 'ic_memo',
  'teaser', 'lender_package', 'due_diligence_summary', 'custom'
] as const;

const DocumentStatusValues = [
  'draft', 'in_progress', 'review', 'approved', 'generating', 'completed', 'failed'
] as const;

const AudiencePersonaValues = [
  'institutional_investor', 'private_equity', 'family_office', 'lender',
  'investment_committee', 'board_of_directors', 'potential_buyer', 'broker'
] as const;

const AssetClassValues = [
  'marina', 'rv_park', 'mobile_home_park', 'self_storage', 'multifamily', 'mixed_use', 'other'
] as const;

const CreateDocumentSchema = z.object({
  dealId: z.string(),
  documentType: z.enum(DocumentTypeValues),
  title: z.string().min(1).max(200),
  audience: z.enum(AudiencePersonaValues).optional(),
  assetClass: z.enum(AssetClassValues).optional(),
  themeId: z.string().optional(),
  templateId: z.string().optional(),
});

const UpdateDocumentSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  audience: z.enum(AudiencePersonaValues).optional(),
  themeId: z.string().nullable().optional(),
  status: z.enum(DocumentStatusValues).optional(),
  metadata: z.record(z.any()).optional(),
});

const AddSectionSchema = z.object({
  sectionKey: z.string().min(1).max(100),
  order: z.number().int().min(0).optional(),
});

const UpdateSectionContentSchema = z.object({
  content: z.record(z.any()),
});

const UpdateSectionBindingsSchema = z.object({
  bindings: z.record(
    z.object({
      source: z.string(),
      field: z.string(),
      resolvedValue: z.any().optional(),
      locked: z.boolean().optional(),
      overridden: z.boolean().optional(),
    })
  ),
});

const UpdateSectionMediaSchema = z.object({
  media: z.record(
    z.object({
      url: z.string().url().optional(),
      s3Key: z.string().optional(),
      mimeType: z.string().optional(),
      width: z.number().int().positive().optional(),
      height: z.number().int().positive().optional(),
      caption: z.string().optional(),
    })
  ),
});

const ReorderSectionsSchema = z.object({
  sectionOrders: z.array(
    z.object({
      sectionId: z.string(),
      order: z.number().int().min(0),
    })
  ),
});

const ResolveBindingsSchema = z.object({
  dealId: z.string(),
  bindings: z.array(
    z.object({
      key: z.string(),
      source: z.string(),
      field: z.string(),
      transform: z.string().optional(),
      fallback: z.any().optional(),
    })
  ),
});

const GenerateContentSchema = z.object({
  sectionKey: z.string(),
  promptKey: z.string(),
  context: z.record(z.any()),
  provider: z.enum(['openai', 'anthropic']).optional(),
  temperature: z.number().min(0).max(2).optional(),
});

const CreateExportJobSchema = z.object({
  format: z.enum(['pdf', 'pptx', 'docx']),
  options: z
    .object({
      includePageNumbers: z.boolean().optional(),
      includeToc: z.boolean().optional(),
      includeDisclaimer: z.boolean().optional(),
      quality: z.enum(['draft', 'standard', 'high']).optional(),
      paperSize: z.enum(['letter', 'a4', 'legal']).optional(),
      orientation: z.enum(['portrait', 'landscape']).optional(),
    })
    .optional(),
});

// =============================================================================
// Middleware
// =============================================================================

function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

function validateBody<T>(schema: z.ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          error: 'Validation error',
          details: error.errors,
        });
      } else {
        next(error);
      }
    }
  };
}

// =============================================================================
// Document CRUD Routes
// =============================================================================

/**
 * GET /api/document-builder/documents
 * List all documents for the current user/org
 */
router.get(
  '/documents',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user?.id;
    const docs = await db
      .select()
      .from(omBuilderDocuments)
      .where(eq(omBuilderDocuments.createdBy, userId))
      .orderBy(desc(omBuilderDocuments.updatedAt));
    res.json(docs);
  })
);

/**
 * GET /api/document-builder/templates
 * List available document templates
 */
router.get(
  '/templates',
  asyncHandler(async (req: Request, res: Response) => {
    const templates = await db
      .select()
      .from(omExemplars)
      .where(eq(omExemplars.isPublic, true))
      .orderBy(desc(omExemplars.createdAt));

    // If no db templates, return built-in template metadata
    if (templates.length === 0) {
      const builtIn = [
        { id: 1, name: 'Marina Acquisition OM', documentType: 'offering_memorandum', assetClass: 'marina', description: 'Full 30+ page offering memorandum for marina acquisitions', estimatedPages: 32, sections: 10, popularity: 95 },
        { id: 2, name: 'Multifamily Offering Memorandum', documentType: 'offering_memorandum', assetClass: 'multifamily', description: 'Institutional-grade OM for multifamily properties', estimatedPages: 28, sections: 9, popularity: 90 },
        { id: 3, name: 'Self-Storage Acquisition OM', documentType: 'offering_memorandum', assetClass: 'self_storage', description: 'Self-storage investment offering memorandum', estimatedPages: 24, sections: 8, popularity: 80 },
        { id: 4, name: 'Hotel Investment Memorandum', documentType: 'offering_memorandum', assetClass: 'hotel', description: 'Hospitality investment memorandum with USALI metrics', estimatedPages: 30, sections: 10, popularity: 75 },
        { id: 5, name: 'Executive Summary', documentType: 'executive_summary', assetClass: null, description: 'Concise 2-3 page investment summary for any asset class', estimatedPages: 3, sections: 5, popularity: 85 },
        { id: 6, name: 'Investment Memo', documentType: 'ic_memo', assetClass: null, description: 'IC-ready investment committee memo', estimatedPages: 8, sections: 7, popularity: 82 },
        { id: 7, name: 'Pitch Deck', documentType: 'pitch_deck', assetClass: null, description: 'Visual 10-slide investment presentation', estimatedPages: 10, sections: 10, popularity: 78 },
        { id: 8, name: 'Lender Package', documentType: 'lender_package', assetClass: null, description: 'Debt financing package for lenders', estimatedPages: 20, sections: 8, popularity: 70 },
        { id: 9, name: 'Vacation Rental Portfolio Summary', documentType: 'executive_summary', assetClass: 'str', description: 'STR portfolio investment summary', estimatedPages: 5, sections: 6, popularity: 65 },
        { id: 10, name: 'Commercial Property OM', documentType: 'offering_memorandum', assetClass: 'retail', description: 'Commercial property offering memorandum', estimatedPages: 26, sections: 9, popularity: 72 },
      ];
      return res.json(builtIn);
    }
    res.json(templates);
  })
);

/**
 * POST /api/document-builder/documents/:id/duplicate
 * Duplicate an existing document
 */
router.post(
  '/documents/:id/duplicate',
  asyncHandler(async (req: Request, res: Response) => {
    const docId = req.params.id;
    const userId = (req as any).user?.id;

    // Fetch the original document
    const [original] = await db
      .select()
      .from(omBuilderDocuments)
      .where(eq(omBuilderDocuments.id, docId));

    if (!original) {
      res.status(404).json({ error: 'Document not found' });
      return;
    }

    // Create a copy (omit id so the DB generates a new one)
    const { id: _id, createdAt: _ca, updatedAt: _ua, ...rest } = original;
    const [copy] = await db
      .insert(omBuilderDocuments)
      .values({
        ...rest,
        title: `${original.title} (Copy)`,
        status: 'draft',
        createdBy: userId || original.createdBy,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    // Copy sections
    const sections = await db
      .select()
      .from(omDocumentSections)
      .where(eq(omDocumentSections.documentId, docId));

    if (sections.length > 0) {
      await db.insert(omDocumentSections).values(
        sections.map((s) => {
          const { id: _sid, createdAt: _sca, updatedAt: _sua, ...srest } = s;
          return {
            ...srest,
            documentId: copy.id,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
        })
      );
    }

    res.json(copy);
  })
);

/**
 * POST /api/document-builder/documents
 * Create a new document
 */
router.post(
  '/documents',
  validateBody(CreateDocumentSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { dealId, documentType, title, audience, assetClass, themeId, templateId } = req.body;
    const userId = (req as any).user?.id || 1; // Default for dev

    const document = await documentBuilderService.createDocument({
      dealId,
      documentType,
      title,
      audience,
      assetClass,
      themeId,
      templateId,
      createdBy: userId,
    });

    res.status(201).json({
      success: true,
      data: document,
    });
  })
);

/**
 * POST /api/document-builder/auto-generate
 * Auto-generate a document with data bindings and optional AI content
 */
router.post(
  '/auto-generate',
  validateBody(
    z.object({
      dealId: z.string(),
      documentType: z.enum(DocumentTypeValues),
      title: z.string().min(1).max(200),
      audience: z.enum(AudiencePersonaValues).optional(),
      assetClass: z.enum(AssetClassValues).optional(),
      enableAI: z.boolean().optional(),
    })
  ),
  asyncHandler(async (req: Request, res: Response) => {
    const { dealId, documentType, title, audience, assetClass, enableAI } = req.body;
    const userId = (req as any).user?.id;

    const result = await documentBuilderService.autoGenerateDocument({
      dealId,
      documentType,
      title,
      audience,
      assetClass,
      enableAI,
      createdBy: userId,
    });

    res.json({
      success: true,
      data: result,
    });
  })
);

/**
 * GET /api/document-builder/documents/:id
 * Get a document with all sections
 */
router.get(
  '/documents/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const documentId = parseInt(req.params.id, 10);
    if (isNaN(documentId)) {
      res.status(400).json({ error: 'Invalid document ID' });
      return;
    }

    const document = await documentBuilderService.getDocument(documentId);
    if (!document) {
      res.status(404).json({ error: 'Document not found' });
      return;
    }

    res.json({
      success: true,
      data: document,
    });
  })
);

/**
 * GET /api/document-builder/deals/:dealId/documents
 * Get all documents for a deal
 */
router.get(
  '/deals/:dealId/documents',
  asyncHandler(async (req: Request, res: Response) => {
    const dealId = parseInt(req.params.dealId, 10);
    if (isNaN(dealId)) {
      res.status(400).json({ error: 'Invalid deal ID' });
      return;
    }

    const documents = await documentBuilderService.getDocumentsByDeal(dealId);

    res.json({
      success: true,
      data: documents,
    });
  })
);

/**
 * PATCH /api/document-builder/documents/:id
 * Update a document
 */
router.patch(
  '/documents/:id',
  validateBody(UpdateDocumentSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const documentId = parseInt(req.params.id, 10);
    if (isNaN(documentId)) {
      res.status(400).json({ error: 'Invalid document ID' });
      return;
    }

    const updated = await documentBuilderService.updateDocument(documentId, req.body);
    if (!updated) {
      res.status(404).json({ error: 'Document not found' });
      return;
    }

    res.json({
      success: true,
      data: updated,
    });
  })
);

/**
 * DELETE /api/document-builder/documents/:id
 * Delete a document
 */
router.delete(
  '/documents/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const documentId = parseInt(req.params.id, 10);
    if (isNaN(documentId)) {
      res.status(400).json({ error: 'Invalid document ID' });
      return;
    }

    const deleted = await documentBuilderService.deleteDocument(documentId);
    if (!deleted) {
      res.status(404).json({ error: 'Document not found' });
      return;
    }

    res.json({
      success: true,
      message: 'Document deleted',
    });
  })
);

// =============================================================================
// Section Management Routes
// =============================================================================

/**
 * POST /api/document-builder/documents/:id/sections
 * Add a section to a document
 */
router.post(
  '/documents/:id/sections',
  validateBody(AddSectionSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const documentId = parseInt(req.params.id, 10);
    if (isNaN(documentId)) {
      res.status(400).json({ error: 'Invalid document ID' });
      return;
    }

    const { sectionKey, order } = req.body;

    const section = await documentBuilderService.addSection(documentId, sectionKey, order);
    if (!section) {
      res.status(400).json({ error: 'Failed to add section' });
      return;
    }

    res.status(201).json({
      success: true,
      data: section,
    });
  })
);

/**
 * DELETE /api/document-builder/documents/:docId/sections/:sectionId
 * Remove a section from a document
 */
router.delete(
  '/documents/:docId/sections/:sectionId',
  asyncHandler(async (req: Request, res: Response) => {
    const documentId = parseInt(req.params.docId, 10);
    const sectionId = parseInt(req.params.sectionId, 10);

    if (isNaN(documentId) || isNaN(sectionId)) {
      res.status(400).json({ error: 'Invalid IDs' });
      return;
    }

    const removed = await documentBuilderService.removeSection(documentId, sectionId);
    if (!removed) {
      res.status(404).json({ error: 'Section not found' });
      return;
    }

    res.json({
      success: true,
      message: 'Section removed',
    });
  })
);

/**
 * PATCH /api/document-builder/documents/:docId/sections/:sectionId/content
 * Update section content
 */
router.patch(
  '/documents/:docId/sections/:sectionId/content',
  validateBody(UpdateSectionContentSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const sectionId = parseInt(req.params.sectionId, 10);
    if (isNaN(sectionId)) {
      res.status(400).json({ error: 'Invalid section ID' });
      return;
    }

    const updated = await documentBuilderService.updateSectionContent(sectionId, req.body.content);
    if (!updated) {
      res.status(404).json({ error: 'Section not found' });
      return;
    }

    res.json({
      success: true,
      data: updated,
    });
  })
);

/**
 * PATCH /api/document-builder/documents/:docId/sections/:sectionId/bindings
 * Update section data bindings
 */
router.patch(
  '/documents/:docId/sections/:sectionId/bindings',
  validateBody(UpdateSectionBindingsSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const sectionId = parseInt(req.params.sectionId, 10);
    if (isNaN(sectionId)) {
      res.status(400).json({ error: 'Invalid section ID' });
      return;
    }

    const updated = await documentBuilderService.updateSectionBindings(sectionId, req.body.bindings);
    if (!updated) {
      res.status(404).json({ error: 'Section not found' });
      return;
    }

    res.json({
      success: true,
      data: updated,
    });
  })
);

/**
 * PATCH /api/document-builder/documents/:docId/sections/:sectionId/media
 * Update section media
 */
router.patch(
  '/documents/:docId/sections/:sectionId/media',
  validateBody(UpdateSectionMediaSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const sectionId = parseInt(req.params.sectionId, 10);
    if (isNaN(sectionId)) {
      res.status(400).json({ error: 'Invalid section ID' });
      return;
    }

    const updated = await documentBuilderService.updateSectionMedia(sectionId, req.body.media);
    if (!updated) {
      res.status(404).json({ error: 'Section not found' });
      return;
    }

    res.json({
      success: true,
      data: updated,
    });
  })
);

/**
 * PATCH /api/document-builder/documents/:docId/sections/:sectionId/toggle
 * Toggle section enabled/disabled
 */
router.patch(
  '/documents/:docId/sections/:sectionId/toggle',
  asyncHandler(async (req: Request, res: Response) => {
    const sectionId = parseInt(req.params.sectionId, 10);
    const enabled = req.body.enabled !== false;

    if (isNaN(sectionId)) {
      res.status(400).json({ error: 'Invalid section ID' });
      return;
    }

    const updated = await documentBuilderService.toggleSection(sectionId, enabled);
    if (!updated) {
      res.status(404).json({ error: 'Section not found' });
      return;
    }

    res.json({
      success: true,
      data: updated,
    });
  })
);

/**
 * POST /api/document-builder/documents/:id/sections/reorder
 * Reorder sections in a document
 */
router.post(
  '/documents/:id/sections/reorder',
  validateBody(ReorderSectionsSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const documentId = parseInt(req.params.id, 10);
    if (isNaN(documentId)) {
      res.status(400).json({ error: 'Invalid document ID' });
      return;
    }

    await documentBuilderService.reorderSections(documentId, req.body.sectionOrders);

    res.json({
      success: true,
      message: 'Sections reordered',
    });
  })
);

// =============================================================================
// Data Binding Routes
// =============================================================================

/**
 * GET /api/document-builder/bindings/catalog
 * Get the full data bindings catalog
 */
router.get(
  '/bindings/catalog',
  asyncHandler(async (req: Request, res: Response) => {
    const catalog = dataBindingService.getBindingsCatalog();

    res.json({
      success: true,
      data: catalog,
    });
  })
);

/**
 * POST /api/document-builder/bindings/resolve
 * Resolve multiple data bindings
 */
router.post(
  '/bindings/resolve',
  validateBody(ResolveBindingsSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { dealId, bindings } = req.body;

    const resolved = await dataBindingService.resolveBindings(dealId, bindings);

    res.json({
      success: true,
      data: resolved,
    });
  })
);

/**
 * GET /api/document-builder/bindings/preview/:dealId/:source/:field
 * Preview a single binding value
 */
router.get(
  '/bindings/preview/:dealId/:source/:field',
  asyncHandler(async (req: Request, res: Response) => {
    const dealId = parseInt(req.params.dealId, 10);
    const { source, field } = req.params;
    const transform = req.query.transform as string | undefined;

    if (isNaN(dealId)) {
      res.status(400).json({ error: 'Invalid deal ID' });
      return;
    }

    const value = await dataBindingService.resolveBinding(dealId, {
      key: `${source}.${field}`,
      source,
      field,
      transform,
    });

    res.json({
      success: true,
      data: {
        source,
        field,
        value,
      },
    });
  })
);

// =============================================================================
// AI Content Generation Routes
// =============================================================================

/**
 * POST /api/document-builder/ai/generate
 * Generate content for a section using AI
 */
router.post(
  '/ai/generate',
  validateBody(GenerateContentSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { sectionKey, promptKey, context, provider, temperature } = req.body;

    const result = await aiContentGenerationService.generateSectionContent(
      sectionKey,
      promptKey,
      context,
      { provider, temperature }
    );

    res.json({
      success: true,
      data: result,
    });
  })
);

/**
 * POST /api/document-builder/ai/executive-summary
 * Generate executive summary content
 */
router.post(
  '/ai/executive-summary',
  asyncHandler(async (req: Request, res: Response) => {
    const result = await aiContentGenerationService.generateExecutiveSummary(
      req.body,
      req.body.options
    );

    res.json({
      success: true,
      data: result,
    });
  })
);

/**
 * POST /api/document-builder/ai/investment-highlights
 * Generate investment highlights
 */
router.post(
  '/ai/investment-highlights',
  asyncHandler(async (req: Request, res: Response) => {
    const result = await aiContentGenerationService.generateInvestmentHighlights(
      req.body,
      req.body.options
    );

    res.json({
      success: true,
      data: result,
    });
  })
);

/**
 * POST /api/document-builder/ai/market-overview
 * Generate market overview content
 */
router.post(
  '/ai/market-overview',
  asyncHandler(async (req: Request, res: Response) => {
    const result = await aiContentGenerationService.generateMarketOverview(
      req.body,
      req.body.options
    );

    res.json({
      success: true,
      data: result,
    });
  })
);

/**
 * POST /api/document-builder/ai/risk-assessment
 * Generate risk assessment content
 */
router.post(
  '/ai/risk-assessment',
  asyncHandler(async (req: Request, res: Response) => {
    const result = await aiContentGenerationService.generateRiskAssessment(
      req.body,
      req.body.options
    );

    res.json({
      success: true,
      data: result,
    });
  })
);

/**
 * GET /api/document-builder/ai/providers
 * Get available AI providers
 */
router.get(
  '/ai/providers',
  asyncHandler(async (req: Request, res: Response) => {
    const providers = aiContentGenerationService.getAvailableProviders();
    const defaultProvider = aiContentGenerationService.getDefaultProvider();

    res.json({
      success: true,
      data: {
        available: providers,
        default: defaultProvider,
      },
    });
  })
);

// =============================================================================
// Export Routes
// =============================================================================

/**
 * POST /api/document-builder/documents/:id/export
 * Create an export job
 */
router.post(
  '/documents/:id/export',
  validateBody(CreateExportJobSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const documentId = parseInt(req.params.id, 10);
    if (isNaN(documentId)) {
      res.status(400).json({ error: 'Invalid document ID' });
      return;
    }

    const { format, options } = req.body;

    const job = await documentBuilderService.createExportJob(documentId, format, options);

    res.status(201).json({
      success: true,
      data: job,
    });
  })
);

/**
 * GET /api/document-builder/export/:jobId
 * Get export job status
 */
router.get(
  '/export/:jobId',
  asyncHandler(async (req: Request, res: Response) => {
    const jobId = parseInt(req.params.jobId, 10);
    if (isNaN(jobId)) {
      res.status(400).json({ error: 'Invalid job ID' });
      return;
    }

    const job = await documentBuilderService.getExportJob(jobId);
    if (!job) {
      res.status(404).json({ error: 'Export job not found' });
      return;
    }

    res.json({
      success: true,
      data: job,
    });
  })
);

/**
 * GET /api/document-builder/export/:jobId/download
 * Download completed export file
 */
router.get(
  '/export/:jobId/download',
  asyncHandler(async (req: Request, res: Response) => {
    const jobId = parseInt(req.params.jobId, 10);
    if (isNaN(jobId)) {
      res.status(400).json({ error: 'Invalid job ID' });
      return;
    }

    const job = await documentBuilderService.getExportJob(jobId);
    if (!job) {
      res.status(404).json({ error: 'Export job not found' });
      return;
    }

    if (job.status !== 'completed') {
      res.status(400).json({ error: 'Export not yet completed', status: job.status });
      return;
    }

    // Get file path from export job processor
    const { exportJobProcessor } = await import('../services/document-builder/export-job-processor');
    const filePath = await exportJobProcessor.getExportFilePath(jobId.toString());

    if (!filePath) {
      res.status(404).json({ error: 'Export file not found' });
      return;
    }

    // Set content type based on format
    const contentTypes: Record<string, string> = {
      pdf: 'application/pdf',
      pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    };

    const contentType = contentTypes[job.format] || 'application/octet-stream';
    const fileName = job.outputFileName || `export.${job.format}`;

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    
    // Stream the file
    const fs = await import('fs');
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  })
);

/**
 * POST /api/document-builder/export/:jobId/process
 * Manually trigger processing of an export job (for testing)
 */
router.post(
  '/export/:jobId/process',
  asyncHandler(async (req: Request, res: Response) => {
    const jobId = parseInt(req.params.jobId, 10);
    if (isNaN(jobId)) {
      res.status(400).json({ error: 'Invalid job ID' });
      return;
    }

    const { exportJobProcessor } = await import('../services/document-builder/export-job-processor');
    const result = await exportJobProcessor.processJob(jobId.toString());

    res.json({
      success: result.success,
      data: result,
    });
  })
);

// =============================================================================
// Builder Helper Routes
// =============================================================================

/**
 * GET /api/document-builder/config/document-types
 * Get all document type configurations
 */
router.get(
  '/config/document-types',
  asyncHandler(async (req: Request, res: Response) => {
    const configs = documentBuilderService.getDocumentTypeConfigs();

    res.json({
      success: true,
      data: configs,
    });
  })
);

/**
 * GET /api/document-builder/config/sections
 * Get the full section library
 */
router.get(
  '/config/sections',
  asyncHandler(async (req: Request, res: Response) => {
    const library = documentBuilderService.getSectionLibrary();

    res.json({
      success: true,
      data: library,
    });
  })
);

/**
 * GET /api/document-builder/config/sections/:docType
 * Get available sections for a document type
 */
router.get(
  '/config/sections/:docType',
  asyncHandler(async (req: Request, res: Response) => {
    const docType = req.params.docType as DocumentType;

    const sections = documentBuilderService.getAvailableSections(docType);
    if (!sections) {
      res.status(400).json({ error: 'Invalid document type' });
      return;
    }

    res.json({
      success: true,
      data: sections,
    });
  })
);

/**
 * GET /api/document-builder/documents/:id/completion
 * Get completion summary for a document
 */
router.get(
  '/documents/:id/completion',
  asyncHandler(async (req: Request, res: Response) => {
    const documentId = parseInt(req.params.id, 10);
    if (isNaN(documentId)) {
      res.status(400).json({ error: 'Invalid document ID' });
      return;
    }

    const summary = await documentBuilderService.getBuilderCompletionSummary(documentId);
    if (!summary) {
      res.status(404).json({ error: 'Document not found' });
      return;
    }

    res.json({
      success: true,
      data: summary,
    });
  })
);

// =============================================================================
// Version History
// =============================================================================

// Save a new version snapshot
router.post('/documents/:id/versions', async (req: any, res) => {
  try {
    const { id } = req.params;
    const { changeDescription } = req.body;
    const userId = req.user?.id;

    // Load document + all sections for snapshot
    const [doc] = await db.select().from(omBuilderDocuments).where(eq(omBuilderDocuments.id, id)).limit(1);
    if (!doc) return res.status(404).json({ error: 'Document not found' });

    const sections = await db.select().from(omDocumentSections)
      .where(eq(omDocumentSections.documentId, id))
      .orderBy(omDocumentSections.order);

    // Determine next version number
    const [latestVersion] = await db.select()
      .from(omDocumentVersions)
      .where(eq(omDocumentVersions.documentId, id))
      .orderBy(desc(omDocumentVersions.versionNumber))
      .limit(1);

    const nextVersion = (latestVersion?.versionNumber || 0) + 1;

    // Create version snapshot
    const [version] = await db.insert(omDocumentVersions).values({
      documentId: id,
      versionNumber: nextVersion,
      title: doc.title,
      snapshot: { document: doc, sections },
      changeDescription: changeDescription || `Version ${nextVersion}`,
      status: doc.status,
      createdBy: userId,
    }).returning();

    // Update document metadata version
    const currentMeta = (doc.metadata || {}) as any;
    await db.update(omBuilderDocuments)
      .set({
        metadata: { ...currentMeta, version: nextVersion },
        updatedAt: new Date(),
      })
      .where(eq(omBuilderDocuments.id, id));

    res.json({ success: true, version });
  } catch (error: any) {
    console.error('[Document Builder] Version save error:', error);
    res.status(500).json({ error: 'Failed to save version' });
  }
});

// List all versions for a document
router.get('/documents/:id/versions', async (req: any, res) => {
  try {
    const { id } = req.params;
    const versions = await db.select({
      id: omDocumentVersions.id,
      versionNumber: omDocumentVersions.versionNumber,
      title: omDocumentVersions.title,
      changeDescription: omDocumentVersions.changeDescription,
      status: omDocumentVersions.status,
      createdBy: omDocumentVersions.createdBy,
      createdAt: omDocumentVersions.createdAt,
    })
      .from(omDocumentVersions)
      .where(eq(omDocumentVersions.documentId, id))
      .orderBy(desc(omDocumentVersions.versionNumber));

    res.json(versions);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to list versions' });
  }
});

// Get a specific version snapshot
router.get('/documents/:id/versions/:versionId', async (req: any, res) => {
  try {
    const { versionId } = req.params;
    const [version] = await db.select()
      .from(omDocumentVersions)
      .where(eq(omDocumentVersions.id, versionId))
      .limit(1);

    if (!version) return res.status(404).json({ error: 'Version not found' });
    res.json(version);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to get version' });
  }
});

// Restore a document to a previous version
router.post('/documents/:id/versions/:versionId/restore', async (req: any, res) => {
  try {
    const { id, versionId } = req.params;

    const [version] = await db.select()
      .from(omDocumentVersions)
      .where(eq(omDocumentVersions.id, versionId))
      .limit(1);

    if (!version) return res.status(404).json({ error: 'Version not found' });

    const snapshot = version.snapshot as any;
    if (!snapshot?.document || !snapshot?.sections) {
      return res.status(400).json({ error: 'Invalid version snapshot' });
    }

    // Save current state as a new version before restoring
    const [doc] = await db.select().from(omBuilderDocuments).where(eq(omBuilderDocuments.id, id)).limit(1);
    const currentSections = await db.select().from(omDocumentSections)
      .where(eq(omDocumentSections.documentId, id));

    const [latestVer] = await db.select()
      .from(omDocumentVersions)
      .where(eq(omDocumentVersions.documentId, id))
      .orderBy(desc(omDocumentVersions.versionNumber))
      .limit(1);

    const nextNum = (latestVer?.versionNumber || 0) + 1;

    await db.insert(omDocumentVersions).values({
      documentId: id,
      versionNumber: nextNum,
      title: doc?.title || 'Pre-restore backup',
      snapshot: { document: doc, sections: currentSections },
      changeDescription: `Auto-saved before restoring to v${version.versionNumber}`,
      status: doc?.status || 'draft',
      createdBy: req.user?.id,
    });

    // Restore document fields
    await db.update(omBuilderDocuments)
      .set({
        title: snapshot.document.title,
        config: snapshot.document.config,
        metadata: { ...(snapshot.document.metadata || {}), version: nextNum + 1 },
        workingSnapshot: snapshot.document.workingSnapshot,
        completionStatus: snapshot.document.completionStatus,
        updatedAt: new Date(),
      })
      .where(eq(omBuilderDocuments.id, id));

    // Delete current sections and restore old ones
    await db.delete(omDocumentSections).where(eq(omDocumentSections.documentId, id));

    for (const section of snapshot.sections) {
      await db.insert(omDocumentSections).values({
        documentId: id,
        sectionKey: section.sectionKey,
        order: section.order,
        enabled: section.enabled,
        customTitle: section.customTitle,
        dataBindings: section.dataBindings,
        media: section.media,
        content: section.content,
        completionStatus: section.completionStatus,
      });
    }

    res.json({ success: true, restoredToVersion: version.versionNumber });
  } catch (error: any) {
    console.error('[Document Builder] Version restore error:', error);
    res.status(500).json({ error: 'Failed to restore version' });
  }
});

// =============================================================================
// Save Document as Template
// =============================================================================

router.post('/documents/:id/save-as-template', async (req: any, res) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;
    const userId = req.user?.id;
    const orgId = req.user?.orgId;

    // Load document + sections
    const [doc] = await db.select().from(omBuilderDocuments).where(eq(omBuilderDocuments.id, id)).limit(1);
    if (!doc) return res.status(404).json({ error: 'Document not found' });

    const sections = await db.select().from(omDocumentSections)
      .where(eq(omDocumentSections.documentId, id))
      .orderBy(omDocumentSections.order);

    // Save as org-level template
    const [template] = await db.insert(omTemplates).values({
      name: name || `${doc.title} Template`,
      description: description || `Template based on "${doc.title}"`,
      documentType: doc.documentType,
      scope: 'organization',
      ownerType: 'organization',
      ownerId: orgId,
      templateData: {
        documentType: doc.documentType,
        audience: doc.audience,
        assetClass: doc.assetClass,
        config: doc.config,
        sections: sections.map(s => ({
          sectionKey: s.sectionKey,
          order: s.order,
          enabled: s.enabled,
          customTitle: s.customTitle,
          content: s.content,
          dataBindings: s.dataBindings,
        })),
      },
      createdBy: userId,
    } as any).returning();

    res.json({ success: true, template });
  } catch (error: any) {
    console.error('[Document Builder] Save as template error:', error);
    res.status(500).json({ error: 'Failed to save as template' });
  }
});

// List saved templates (DB + defaults)
router.get('/saved-templates', async (req: any, res) => {
  try {
    const orgId = req.user?.orgId;

    const templates = await db.select()
      .from(omTemplates)
      .where(eq(omTemplates.ownerId, orgId))
      .orderBy(desc(omTemplates.createdAt));

    res.json(templates);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to list templates' });
  }
});

// =============================================================================
// Professional Template Registry (IC Deck + OM)
// =============================================================================

// Get all registered professional templates
router.get('/professional-templates', async (_req: any, res) => {
  res.json({
    templates: TEMPLATE_REGISTRY,
    tokenSummary: TOKEN_SUMMARY,
  });
});

// Get full template definition by ID (with all sections + blocks)
router.get('/professional-templates/:templateId', async (req: any, res) => {
  const template = getTemplateById(req.params.templateId);
  if (!template) return res.status(404).json({ error: 'Template not found' });
  res.json(template);
});

// Get token map for a template type
router.get('/professional-templates/:templateId/tokens', async (req: any, res) => {
  const template = getTemplateById(req.params.templateId);
  if (!template) return res.status(404).json({ error: 'Template not found' });

  const templateType = template.id.includes('ic_deal') ? 'ic_deck' : 'om';
  const tokens = getTokensForTemplate(templateType as 'ic_deck' | 'om');

  const liveTokens = tokens.filter(t => t.source !== 'manual' && t.bindingPath);
  const manualTokens = tokens.filter(t => t.source === 'manual');

  res.json({
    templateId: template.id,
    totalTokens: tokens.length,
    liveTokens: liveTokens.length,
    manualTokens: manualTokens.length,
    tokens,
    required: template.requiredTokens,
    optional: template.optionalTokens,
  });
});

// Get full master token map
router.get('/token-map', async (_req: any, res) => {
  res.json({
    summary: TOKEN_SUMMARY,
    tokens: MASTER_TOKEN_MAP,
  });
});

// Resolve live tokens for a deal/project workspace
router.post('/tokens/resolve', async (req: any, res) => {
  try {
    const { dealId, projectId } = req.body;
    if (!dealId) return res.status(400).json({ error: 'dealId is required' });

    const orgId = req.user?.orgId;
    const resolved = await resolveTokens({ dealId, projectId, orgId });

    // Split into live (resolved) vs manual (null)
    const live: Record<string, any> = {};
    const manual: string[] = [];
    for (const [key, value] of Object.entries(resolved)) {
      if (value !== null && value !== undefined) {
        live[key] = value;
      } else {
        manual.push(key);
      }
    }

    res.json({
      resolved: live,
      unresolvedCount: manual.length,
      unresolved: manual,
      totalTokens: Object.keys(resolved).length,
    });
  } catch (error: any) {
    console.error('[Document Builder] Token resolve error:', error);
    res.status(500).json({ error: 'Failed to resolve tokens' });
  }
});

// Create a document from a professional template with auto-resolved tokens
router.post('/documents/from-template', async (req: any, res) => {
  try {
    const { templateId, dealId, projectId, title, manualTokens } = req.body;
    if (!templateId || !dealId) {
      return res.status(400).json({ error: 'templateId and dealId are required' });
    }

    const template = getTemplateById(templateId);
    if (!template) return res.status(404).json({ error: 'Template not found' });

    const orgId = req.user?.orgId;
    const userId = req.user?.id;

    // Resolve live tokens
    const resolved = await resolveTokens({ dealId, projectId, orgId });

    // Merge manual overrides
    if (manualTokens && typeof manualTokens === 'object') {
      Object.assign(resolved, manualTokens);
    }

    // Create the document
    const [doc] = await db.insert(omBuilderDocuments).values({
      dealId,
      documentType: template.documentType,
      title: title || template.name,
      audience: template.audience?.[0] || null,
      assetClass: template.assetClass,
      templateId: template.id,
      status: 'draft',
      config: {
        sections: template.sections.map((s: any) => s.key),
        settings: { templateId: template.id, style: template.style },
      },
      metadata: {
        propertyName: resolved.PROPERTY_NAME as string || '',
        propertyAddress: resolved.PROPERTY_ADDRESS as string || '',
        version: 1,
      },
      workingSnapshot: { resolvedTokens: resolved },
      completionStatus: {
        totalSections: template.sections.length,
        completedSections: 0,
        percentage: 0,
        readyToExport: false,
      },
      createdBy: userId,
    }).returning();

    // Create sections from template
    for (const section of template.sections) {
      // Interpolate token values into any text content
      const content: any = {};
      for (const block of (section.blocks || [])) {
        if (block.config?.text) {
          content[block.key] = { text: interpolateTokens(block.config.text, resolved) };
        }
        if (block.config?.token) {
          content[block.key] = { value: resolved[block.config.token] ?? null };
        }
      }

      await db.insert(omDocumentSections).values({
        documentId: doc.id,
        sectionKey: section.key,
        order: section.order,
        enabled: section.enabled,
        customTitle: section.title,
        dataBindings: (section.tokens || []).map((t: string) => ({
          bindingKey: t,
          source: 'workspace',
          field: t,
          resolvedValue: resolved[t] ?? null,
        })),
        content,
        completionStatus: { percentage: 0, requiredFieldsFilled: 0, totalRequiredFields: (section.tokens || []).length },
      });
    }

    res.status(201).json({
      document: doc,
      templateUsed: template.id,
      tokensResolved: Object.values(resolved).filter(v => v !== null).length,
      tokensTotal: Object.keys(resolved).length,
    });
  } catch (error: any) {
    console.error('[Document Builder] Template document creation error:', error);
    res.status(500).json({ error: 'Failed to create document from template' });
  }
});

// Seed professional templates into om_templates DB table
router.post('/professional-templates/seed', async (req: any, res) => {
  try {
    const userId = req.user?.id;
    const orgId = req.user?.orgId;
    const seeded: string[] = [];

    for (const template of DOCUMENT_STUDIO_TEMPLATES) {
      // Check if already seeded
      const existing = await db.select()
        .from(omTemplates)
        .where(and(
          eq(omTemplates.name, template.name),
          eq(omTemplates.ownerId, orgId),
        ))
        .limit(1);

      if (existing.length > 0) continue;

      await db.insert(omTemplates).values({
        name: template.name,
        description: template.description,
        documentType: template.documentType,
        scope: 'organization',
        ownerType: 'organization',
        ownerId: orgId,
        templateData: template as any,
        createdBy: userId,
      } as any);

      seeded.push(template.name);
    }

    res.json({
      success: true,
      seeded,
      message: seeded.length > 0
        ? `Seeded ${seeded.length} templates`
        : 'All templates already exist',
    });
  } catch (error: any) {
    console.error('[Document Builder] Template seed error:', error);
    res.status(500).json({ error: 'Failed to seed templates' });
  }
});

// Delete a saved template
router.delete('/saved-templates/:templateId', async (req: any, res) => {
  try {
    const { templateId } = req.params;
    const orgId = req.user?.orgId;

    await db.delete(omTemplates)
      .where(and(eq(omTemplates.id, templateId), eq(omTemplates.ownerId, orgId)));

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to delete template' });
  }
});

export default router;
