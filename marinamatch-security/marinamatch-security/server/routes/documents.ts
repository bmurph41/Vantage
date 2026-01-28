/**
 * MarinaMatch Document Routes
 * 
 * Secure file upload/download endpoints with:
 * - Streaming uploads (via multer or raw body parsing)
 * - Authorization checks
 * - Rate limiting
 * - Audit logging
 * 
 * USAGE:
 * import { documentRouter } from './routes/documents';
 * app.use('/api/documents', documentRouter);
 */

import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import crypto from 'crypto';
import { db } from '../db/client';
import { documents } from '../db/security-schema';
import { eq, and, desc } from 'drizzle-orm';
import { requireAuth, csrfProtection, getClientIp } from '../middleware/auth';
import { authorize, authorizeResource, tenantScope } from '../middleware/authorization';
import { uploadRateLimiter } from '../config/security';
import { validateBody, validateQuery, validateParams, uuidSchema, documentUploadSchema, documentQuerySchema, documentApprovalSchema } from '../validators';
import { 
  processUpload, 
  getDownloadUrl, 
  streamDownload, 
  reviewDocument, 
  deleteDocument,
  uploadConfig 
} from '../services/file-upload';
import { auditLog, logDocumentAccess } from '../services/audit-logger';
import type { TenantContext } from '../types/security';

// ============================================================================
// MULTER CONFIGURATION
// ============================================================================

// Memory storage for validation before saving
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: uploadConfig.maxSizeBytes,
    files: 1, // One file at a time
  },
  fileFilter: (req, file, cb) => {
    // Basic extension check (magic byte validation happens in service)
    const allowedExtensions = ['.pdf', '.xlsx', '.xls', '.csv', '.jpg', '.jpeg', '.png'];
    const ext = '.' + file.originalname.split('.').pop()?.toLowerCase();
    
    if (allowedExtensions.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`File type not allowed: ${ext}`));
    }
  },
});

// ============================================================================
// ROUTER
// ============================================================================

export const documentRouter = Router();

// ============================================================================
// LIST DOCUMENTS
// ============================================================================

/**
 * GET /api/documents
 * List documents for the current organization
 */
documentRouter.get(
  '/',
  requireAuth,
  authorize('documents:read'),
  validateQuery(documentQuerySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = req.tenantContext as TenantContext;
      const { page, pageSize, documentType, classification, status, uploadedBy } = req.query as any;

      // Build query with tenant scope
      let query = db
        .select()
        .from(documents)
        .where(
          and(
            eq(documents.orgId, context.orgId),
            status !== undefined ? eq(documents.status, status) : undefined,
            documentType !== undefined ? eq(documents.documentType, documentType) : undefined,
            classification !== undefined ? eq(documents.classification, classification) : undefined,
            uploadedBy !== undefined ? eq(documents.uploadedBy, uploadedBy) : undefined
          )
        )
        .orderBy(desc(documents.createdAt))
        .limit(pageSize)
        .offset((page - 1) * pageSize);

      const docs = await query;

      // Get total count
      const countResult = await db
        .select({ count: documents.id })
        .from(documents)
        .where(eq(documents.orgId, context.orgId));

      res.json({
        success: true,
        data: docs.map(doc => ({
          id: doc.id,
          filename: doc.originalFilename,
          documentType: doc.documentType,
          classification: doc.classification,
          status: doc.status,
          mimeType: doc.mimeType,
          sizeBytes: doc.sizeBytes,
          uploadedAt: doc.createdAt,
          uploadedBy: doc.uploadedBy,
        })),
        pagination: {
          page,
          pageSize,
          totalCount: countResult.length,
          totalPages: Math.ceil(countResult.length / pageSize),
        },
        requestId: req.requestId,
      });
    } catch (error) {
      next(error);
    }
  }
);

// ============================================================================
// UPLOAD DOCUMENT
// ============================================================================

/**
 * POST /api/documents/upload
 * Upload a new document
 */
documentRouter.post(
  '/upload',
  requireAuth,
  csrfProtection,
  authorize('documents:upload'),
  uploadRateLimiter,
  upload.single('file'),
  validateBody(documentUploadSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = req.tenantContext as TenantContext;
      const file = req.file;

      if (!file) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'NO_FILE',
            message: 'No file provided',
          },
          requestId: req.requestId,
        });
      }

      const { documentType, classification, description, metadata } = req.body;

      // Process upload with full validation
      const result = await processUpload(
        file.buffer,
        file.originalname,
        file.mimetype,
        context,
        {
          documentType,
          classification,
          metadata: {
            ...metadata,
            description,
            originalMimeType: file.mimetype,
          },
        }
      );

      if (!result.success) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'UPLOAD_FAILED',
            message: result.error || 'Upload failed',
          },
          requestId: req.requestId,
        });
      }

      res.status(201).json({
        success: true,
        data: {
          documentId: result.documentId,
          quarantined: result.quarantined,
          message: result.quarantined 
            ? 'Document uploaded and pending review'
            : 'Document uploaded successfully',
        },
        requestId: req.requestId,
      });
    } catch (error) {
      next(error);
    }
  }
);

// ============================================================================
// GET DOCUMENT DETAILS
// ============================================================================

/**
 * GET /api/documents/:id
 * Get document metadata
 */
documentRouter.get(
  '/:id',
  requireAuth,
  authorizeResource('documents', 'read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = req.tenantContext as TenantContext;
      const { id } = req.params;

      const [doc] = await db
        .select()
        .from(documents)
        .where(
          and(
            eq(documents.id, id),
            eq(documents.orgId, context.orgId)
          )
        )
        .limit(1);

      if (!doc) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Document not found',
          },
          requestId: req.requestId,
        });
      }

      // Log view
      await logDocumentAccess(
        'document_view',
        { id: doc.id, orgId: doc.orgId, filename: doc.originalFilename },
        context.userId,
        getClientIp(req),
        req.headers['user-agent'],
        req.requestId
      );

      res.json({
        success: true,
        data: {
          id: doc.id,
          filename: doc.originalFilename,
          documentType: doc.documentType,
          classification: doc.classification,
          status: doc.status,
          mimeType: doc.mimeType,
          sizeBytes: doc.sizeBytes,
          checksum: doc.checksumSha256,
          version: doc.version,
          uploadedAt: doc.createdAt,
          uploadedBy: doc.uploadedBy,
          reviewedAt: doc.reviewedAt,
          reviewedBy: doc.reviewedBy,
          metadata: doc.metadata,
        },
        requestId: req.requestId,
      });
    } catch (error) {
      next(error);
    }
  }
);

// ============================================================================
// DOWNLOAD DOCUMENT
// ============================================================================

/**
 * GET /api/documents/:id/download
 * Get download URL for a document
 */
documentRouter.get(
  '/:id/download',
  requireAuth,
  authorizeResource('documents', 'download'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = req.tenantContext as TenantContext;
      const { id } = req.params;

      const downloadInfo = await getDownloadUrl(id, context);

      // Log download
      await logDocumentAccess(
        'document_download',
        { id, orgId: context.orgId, filename: downloadInfo.filename },
        context.userId,
        getClientIp(req),
        req.headers['user-agent'],
        req.requestId
      );

      res.json({
        success: true,
        data: {
          downloadUrl: downloadInfo.url,
          filename: downloadInfo.filename,
          mimeType: downloadInfo.mimeType,
          expiresIn: 300, // 5 minutes
        },
        requestId: req.requestId,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/documents/download/:storagePath
 * Actual file download endpoint (for local storage)
 * This is called via the signed URL
 */
documentRouter.get(
  '/download/:storagePath(*)',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { storagePath } = req.params;
      const { expires, sig } = req.query;

      // Validate signature
      if (!expires || !sig) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'MISSING_SIGNATURE',
            message: 'Invalid download link',
          },
        });
      }

      // Check expiration
      const expiresAt = parseInt(expires as string, 10);
      if (Date.now() > expiresAt) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'LINK_EXPIRED',
            message: 'Download link has expired',
          },
        });
      }

      // Verify signature
      const expectedSig = crypto
        .createHmac('sha256', process.env.ENCRYPTION_KEY || 'dev-key')
        .update(`${storagePath}:${expires}`)
        .digest('hex');

      if (sig !== expectedSig) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'INVALID_SIGNATURE',
            message: 'Invalid download link',
          },
        });
      }

      // Find document by storage path to get metadata
      const [doc] = await db
        .select({
          originalFilename: documents.originalFilename,
          mimeType: documents.mimeType,
        })
        .from(documents)
        .where(eq(documents.storagePath, storagePath))
        .limit(1);

      if (!doc) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Document not found',
          },
        });
      }

      // Stream the file
      await streamDownload(
        storagePath,
        res,
        doc.originalFilename,
        doc.mimeType
      );
    } catch (error) {
      next(error);
    }
  }
);

// ============================================================================
// APPROVE/REJECT QUARANTINED DOCUMENT
// ============================================================================

/**
 * POST /api/documents/:id/review
 * Approve or reject a quarantined document
 */
documentRouter.post(
  '/:id/review',
  requireAuth,
  csrfProtection,
  authorizeResource('documents', 'approve'),
  validateBody(documentApprovalSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = req.tenantContext as TenantContext;
      const { id } = req.params;
      const { status, reason } = req.body;

      await reviewDocument(id, status, context.userId, context, reason);

      res.json({
        success: true,
        data: {
          documentId: id,
          status,
          message: status === 'approved' 
            ? 'Document approved'
            : 'Document rejected',
        },
        requestId: req.requestId,
      });
    } catch (error) {
      next(error);
    }
  }
);

// ============================================================================
// DELETE DOCUMENT
// ============================================================================

/**
 * DELETE /api/documents/:id
 * Soft delete a document
 */
documentRouter.delete(
  '/:id',
  requireAuth,
  csrfProtection,
  authorizeResource('documents', 'delete'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = req.tenantContext as TenantContext;
      const { id } = req.params;

      await deleteDocument(id, context);

      res.json({
        success: true,
        data: {
          documentId: id,
          message: 'Document deleted',
        },
        requestId: req.requestId,
      });
    } catch (error) {
      next(error);
    }
  }
);

// ============================================================================
// QUARANTINE QUEUE (Admin View)
// ============================================================================

/**
 * GET /api/documents/queue/quarantine
 * List quarantined documents pending review
 */
documentRouter.get(
  '/queue/quarantine',
  requireAuth,
  authorize('documents:approve'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = req.tenantContext as TenantContext;

      const quarantinedDocs = await db
        .select()
        .from(documents)
        .where(
          and(
            eq(documents.orgId, context.orgId),
            eq(documents.status, 'quarantine')
          )
        )
        .orderBy(desc(documents.createdAt));

      res.json({
        success: true,
        data: quarantinedDocs.map(doc => ({
          id: doc.id,
          filename: doc.originalFilename,
          mimeType: doc.mimeType,
          sizeBytes: doc.sizeBytes,
          uploadedAt: doc.createdAt,
          uploadedBy: doc.uploadedBy,
          quarantineReason: doc.quarantineReason,
        })),
        requestId: req.requestId,
      });
    } catch (error) {
      next(error);
    }
  }
);

export default documentRouter;
