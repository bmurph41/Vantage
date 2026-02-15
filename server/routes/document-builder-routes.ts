/**
 * Document Builder API Routes
 * RESTful endpoints for document creation, section management, and export
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { documentBuilderService } from '../services/document-builder/document-builder-service';
import { dataBindingService } from '../services/document-builder/data-binding-service';
import { aiContentGenerationService } from '../services/document-builder/ai-content-service';
import type {
  DocumentType,
  DocumentStatus,
  AudiencePersona,
  AssetClass,
} from '@shared/document-builder/types';

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

export default router;
