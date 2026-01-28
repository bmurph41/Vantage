/**
 * MarinaMatch Secure File Upload Service
 * 
 * Handles file uploads with:
 * - MIME type validation (magic bytes, not just extension)
 * - Size limits and quotas
 * - Filename sanitization
 * - Quarantine workflow for unscanned files
 * - Storage abstraction (local or S3)
 * - Checksum verification
 * 
 * USAGE:
 * import { uploadRouter } from './routes/upload';
 * app.use('/api/documents', uploadRouter);
 */

import { Router, Request, Response } from 'express';
import { Readable } from 'stream';
import path from 'path';
import fs from 'fs/promises';
import { createReadStream, createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import crypto from 'crypto';
import { db } from '../db/client'; // Adjust to your DB client
import { documents, organizations } from '../db/security-schema';
import { eq, and, sql } from 'drizzle-orm';
import { requireAuth } from '../middleware/auth';
import { authorize } from '../middleware/authorization';
import { auditLog, logDocumentAccess } from '../services/audit-logger';
import { calculateFileChecksum } from '../utils/encryption';
import { getClientIp } from '../middleware/auth';
import type { TenantContext, AllowedMimeType, UploadResult } from '../types/security';
import { FileUploadError, TenantIsolationError } from '../types/security';

// ============================================================================
// CONFIGURATION
// ============================================================================

export interface UploadConfig {
  maxSizeBytes: number;
  allowedMimeTypes: AllowedMimeType[];
  storageType: 'local' | 's3';
  localStoragePath: string;
  s3Bucket?: string;
  s3Region?: string;
  quarantineEnabled: boolean;
  presignedUrlTTL: number; // seconds
}

const defaultConfig: UploadConfig = {
  maxSizeBytes: 100 * 1024 * 1024, // 100MB
  allowedMimeTypes: [
    'application/pdf',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/csv',
    'image/jpeg',
    'image/png',
  ],
  storageType: 'local',
  localStoragePath: process.env.UPLOAD_PATH || '/data/uploads',
  quarantineEnabled: true,
  presignedUrlTTL: 300, // 5 minutes
};

let config: UploadConfig = { ...defaultConfig };

export function configureUpload(options: Partial<UploadConfig>): void {
  config = { ...defaultConfig, ...options };
}

// ============================================================================
// MIME TYPE VALIDATION (Magic Bytes)
// ============================================================================

// Magic byte signatures for file types
const MAGIC_BYTES: Record<AllowedMimeType, Buffer[]> = {
  'application/pdf': [Buffer.from([0x25, 0x50, 0x44, 0x46])], // %PDF
  'application/vnd.ms-excel': [
    Buffer.from([0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1]), // OLE
  ],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': [
    Buffer.from([0x50, 0x4B, 0x03, 0x04]), // PK (ZIP)
    Buffer.from([0x50, 0x4B, 0x05, 0x06]), // Empty ZIP
    Buffer.from([0x50, 0x4B, 0x07, 0x08]), // Spanned ZIP
  ],
  'text/csv': [], // CSV has no magic bytes, validate by content
  'image/jpeg': [
    Buffer.from([0xFF, 0xD8, 0xFF]),
  ],
  'image/png': [
    Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
  ],
};

/**
 * Validate file type by magic bytes
 */
function validateMimeType(buffer: Buffer, declaredType: string): AllowedMimeType | null {
  for (const [mimeType, signatures] of Object.entries(MAGIC_BYTES)) {
    // Skip if not in allowed types
    if (!config.allowedMimeTypes.includes(mimeType as AllowedMimeType)) {
      continue;
    }

    // CSV special case - check if it looks like text
    if (mimeType === 'text/csv') {
      if (declaredType === 'text/csv' || declaredType === 'text/plain') {
        // Check first bytes are printable ASCII
        const sample = buffer.slice(0, 1000).toString('utf8');
        if (/^[\x20-\x7E\r\n\t,;]+$/.test(sample)) {
          return 'text/csv';
        }
      }
      continue;
    }

    // Check magic bytes
    for (const signature of signatures) {
      if (buffer.slice(0, signature.length).equals(signature)) {
        return mimeType as AllowedMimeType;
      }
    }
  }

  return null;
}

// ============================================================================
// FILENAME SANITIZATION
// ============================================================================

/**
 * Sanitize filename to prevent path traversal and injection
 */
function sanitizeFilename(filename: string): string {
  // Remove path components
  let safe = path.basename(filename);
  
  // Remove dangerous characters
  safe = safe.replace(/[^a-zA-Z0-9.\-_ ()[\]]/g, '_');
  
  // Prevent directory traversal
  safe = safe.replace(/\.\./g, '_');
  
  // Limit length
  if (safe.length > 200) {
    const ext = path.extname(safe);
    safe = safe.slice(0, 200 - ext.length) + ext;
  }
  
  return safe || 'unnamed_file';
}

/**
 * Generate unique storage path
 */
function generateStoragePath(orgId: string, filename: string): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const uuid = crypto.randomUUID();
  const ext = path.extname(filename);
  
  // Format: org_id/YYYY/MM/uuid.ext
  return `${orgId}/${year}/${month}/${uuid}${ext}`;
}

// ============================================================================
// STORAGE ABSTRACTION
// ============================================================================

interface StorageProvider {
  save(path: string, data: Buffer): Promise<void>;
  get(path: string): Promise<Buffer>;
  delete(path: string): Promise<void>;
  exists(path: string): Promise<boolean>;
  getSignedUrl(path: string, ttl: number): Promise<string>;
}

/**
 * Local filesystem storage provider
 */
class LocalStorageProvider implements StorageProvider {
  private basePath: string;

  constructor(basePath: string) {
    this.basePath = basePath;
  }

  private getFullPath(relativePath: string): string {
    // Prevent path traversal
    const normalized = path.normalize(relativePath).replace(/^(\.\.[\/\\])+/, '');
    return path.join(this.basePath, normalized);
  }

  async save(relativePath: string, data: Buffer): Promise<void> {
    const fullPath = this.getFullPath(relativePath);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, data);
  }

  async get(relativePath: string): Promise<Buffer> {
    const fullPath = this.getFullPath(relativePath);
    return fs.readFile(fullPath);
  }

  async delete(relativePath: string): Promise<void> {
    const fullPath = this.getFullPath(relativePath);
    await fs.unlink(fullPath);
  }

  async exists(relativePath: string): Promise<boolean> {
    const fullPath = this.getFullPath(relativePath);
    try {
      await fs.access(fullPath);
      return true;
    } catch {
      return false;
    }
  }

  async getSignedUrl(relativePath: string, ttl: number): Promise<string> {
    // For local storage, we return a token-based URL that the download endpoint validates
    const token = crypto.randomBytes(32).toString('hex');
    const expires = Date.now() + (ttl * 1000);
    
    // In production, store this token in Redis with expiration
    // For now, we encode it in the URL (simplified)
    const signature = crypto
      .createHmac('sha256', process.env.ENCRYPTION_KEY || 'dev-key')
      .update(`${relativePath}:${expires}`)
      .digest('hex');
    
    return `/api/documents/download/${encodeURIComponent(relativePath)}?expires=${expires}&sig=${signature}`;
  }
}

// Storage provider instance
let storage: StorageProvider;

function getStorage(): StorageProvider {
  if (!storage) {
    if (config.storageType === 's3') {
      // S3 provider would be implemented here
      throw new Error('S3 storage not yet implemented. Use local storage.');
    }
    storage = new LocalStorageProvider(config.localStoragePath);
  }
  return storage;
}

// ============================================================================
// UPLOAD SERVICE
// ============================================================================

/**
 * Process file upload
 */
export async function processUpload(
  fileBuffer: Buffer,
  originalFilename: string,
  declaredMimeType: string,
  context: TenantContext,
  options: {
    documentType?: string;
    classification?: string;
    metadata?: Record<string, unknown>;
  } = {}
): Promise<UploadResult> {
  const storage = getStorage();

  // 1. Validate file size
  if (fileBuffer.length > config.maxSizeBytes) {
    throw new FileUploadError(
      `File size ${fileBuffer.length} exceeds maximum ${config.maxSizeBytes}`,
      'FILE_TOO_LARGE'
    );
  }

  // 2. Check org storage quota
  const orgQuota = await checkOrgQuota(context.orgId, fileBuffer.length);
  if (!orgQuota.allowed) {
    throw new FileUploadError(
      `Storage quota exceeded. Used: ${orgQuota.used}, Limit: ${orgQuota.limit}`,
      'QUOTA_EXCEEDED'
    );
  }

  // 3. Validate MIME type (magic bytes)
  const validatedMimeType = validateMimeType(fileBuffer, declaredMimeType);
  if (!validatedMimeType) {
    throw new FileUploadError(
      `File type not allowed. Declared: ${declaredMimeType}`,
      'INVALID_FILE_TYPE'
    );
  }

  // 4. Sanitize filename
  const safeFilename = sanitizeFilename(originalFilename);

  // 5. Calculate checksum
  const checksum = calculateFileChecksum(fileBuffer);

  // 6. Check for duplicates (same org, same checksum)
  const duplicate = await db
    .select({ id: documents.id })
    .from(documents)
    .where(
      and(
        eq(documents.orgId, context.orgId),
        eq(documents.checksumSha256, checksum),
        eq(documents.status, 'approved')
      )
    )
    .limit(1);

  if (duplicate.length > 0) {
    // Return existing document instead of creating duplicate
    return {
      success: true,
      documentId: duplicate[0].id,
      quarantined: false,
    };
  }

  // 7. Generate storage path
  const storagePath = generateStoragePath(context.orgId, safeFilename);

  // 8. Save file to storage
  await storage.save(storagePath, fileBuffer);

  // 9. Determine initial status (quarantine if enabled)
  const initialStatus = config.quarantineEnabled ? 'quarantine' : 'approved';

  // 10. Create document record
  const [doc] = await db
    .insert(documents)
    .values({
      orgId: context.orgId,
      uploadedBy: context.userId,
      originalFilename: safeFilename,
      storagePath,
      mimeType: validatedMimeType,
      sizeBytes: fileBuffer.length,
      checksumSha256: checksum,
      documentType: options.documentType,
      classification: options.classification || 'confidential',
      status: initialStatus,
      quarantineReason: config.quarantineEnabled ? 'Pending manual review (virus scanning not available)' : null,
      metadata: options.metadata || {},
    })
    .returning({ id: documents.id });

  // 11. Update org storage usage
  await db
    .update(organizations)
    .set({
      currentStorageBytes: sql`${organizations.currentStorageBytes} + ${fileBuffer.length}`,
    })
    .where(eq(organizations.id, context.orgId));

  // 12. Audit log
  await logDocumentAccess(
    'document_upload',
    {
      id: doc.id,
      orgId: context.orgId,
      filename: safeFilename,
      documentType: options.documentType,
    },
    context.userId
  );

  return {
    success: true,
    documentId: doc.id,
    storagePath,
    quarantined: initialStatus === 'quarantine',
  };
}

/**
 * Check organization storage quota
 */
async function checkOrgQuota(
  orgId: string,
  additionalBytes: number
): Promise<{ allowed: boolean; used: number; limit: number }> {
  const org = await db
    .select({
      currentStorageBytes: organizations.currentStorageBytes,
      maxStorageBytes: organizations.maxStorageBytes,
    })
    .from(organizations)
    .where(eq(organizations.id, orgId))
    .limit(1);

  if (org.length === 0) {
    return { allowed: false, used: 0, limit: 0 };
  }

  const used = org[0].currentStorageBytes || 0;
  const limit = org[0].maxStorageBytes || 0;
  const allowed = (used + additionalBytes) <= limit;

  return { allowed, used, limit };
}

// ============================================================================
// DOWNLOAD SERVICE
// ============================================================================

/**
 * Get signed URL for document download
 */
export async function getDownloadUrl(
  documentId: string,
  context: TenantContext
): Promise<{ url: string; filename: string; mimeType: string }> {
  // Fetch document with tenant check
  const doc = await db
    .select()
    .from(documents)
    .where(
      and(
        eq(documents.id, documentId),
        eq(documents.orgId, context.orgId)
      )
    )
    .limit(1);

  if (doc.length === 0) {
    throw new TenantIsolationError('Document not found');
  }

  const document = doc[0];

  // Check document status
  if (document.status === 'quarantine' && !context.permissions.has('documents:approve')) {
    throw new FileUploadError('Document is under quarantine review', 'DOCUMENT_QUARANTINED');
  }

  if (document.status === 'deleted') {
    throw new FileUploadError('Document has been deleted', 'DOCUMENT_DELETED');
  }

  // Generate signed URL
  const storage = getStorage();
  const url = await storage.getSignedUrl(document.storagePath, config.presignedUrlTTL);

  return {
    url,
    filename: document.originalFilename,
    mimeType: document.mimeType,
  };
}

/**
 * Stream file for download (for local storage)
 */
export async function streamDownload(
  storagePath: string,
  res: Response,
  filename: string,
  mimeType: string
): Promise<void> {
  const storage = getStorage();
  
  // Validate path and check existence
  if (!(await storage.exists(storagePath))) {
    throw new FileUploadError('File not found', 'FILE_NOT_FOUND');
  }

  const fileBuffer = await storage.get(storagePath);

  // Set secure headers
  res.setHeader('Content-Type', mimeType);
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
  res.setHeader('Content-Length', fileBuffer.length);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate');

  res.send(fileBuffer);
}

// ============================================================================
// DOCUMENT APPROVAL (For Quarantine Workflow)
// ============================================================================

/**
 * Approve or reject a quarantined document
 */
export async function reviewDocument(
  documentId: string,
  status: 'approved' | 'rejected',
  reviewerId: string,
  context: TenantContext,
  reason?: string
): Promise<void> {
  // Fetch document with tenant check
  const doc = await db
    .select()
    .from(documents)
    .where(
      and(
        eq(documents.id, documentId),
        eq(documents.orgId, context.orgId)
      )
    )
    .limit(1);

  if (doc.length === 0) {
    throw new TenantIsolationError('Document not found');
  }

  const document = doc[0];

  if (document.status !== 'quarantine') {
    throw new FileUploadError(
      `Document is not in quarantine (current status: ${document.status})`,
      'INVALID_STATUS'
    );
  }

  // Update document
  await db
    .update(documents)
    .set({
      status,
      reviewedBy: reviewerId,
      reviewedAt: new Date(),
      quarantineReason: status === 'rejected' ? reason : null,
      updatedAt: new Date(),
    })
    .where(eq(documents.id, documentId));

  // If rejected, decrement storage usage
  if (status === 'rejected') {
    await db
      .update(organizations)
      .set({
        currentStorageBytes: sql`GREATEST(0, ${organizations.currentStorageBytes} - ${document.sizeBytes})`,
      })
      .where(eq(organizations.id, context.orgId));
  }

  // Audit log
  await auditLog({
    orgId: context.orgId,
    actorUserId: reviewerId,
    action: status === 'approved' ? 'document_view' : 'document_delete',
    resourceType: 'document',
    resourceId: documentId,
    beforeState: { status: 'quarantine' },
    afterState: { status, reason },
  });
}

// ============================================================================
// DOCUMENT DELETION
// ============================================================================

/**
 * Soft delete a document
 */
export async function deleteDocument(
  documentId: string,
  context: TenantContext
): Promise<void> {
  // Fetch document with tenant check
  const doc = await db
    .select()
    .from(documents)
    .where(
      and(
        eq(documents.id, documentId),
        eq(documents.orgId, context.orgId)
      )
    )
    .limit(1);

  if (doc.length === 0) {
    throw new TenantIsolationError('Document not found');
  }

  const document = doc[0];

  // Soft delete (set status and deletedAt)
  await db
    .update(documents)
    .set({
      status: 'deleted',
      deletedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(documents.id, documentId));

  // Decrement storage usage
  await db
    .update(organizations)
    .set({
      currentStorageBytes: sql`GREATEST(0, ${organizations.currentStorageBytes} - ${document.sizeBytes})`,
    })
    .where(eq(organizations.id, context.orgId));

  // Audit log
  await logDocumentAccess(
    'document_delete',
    {
      id: documentId,
      orgId: context.orgId,
      filename: document.originalFilename,
      documentType: document.documentType ?? undefined,
    },
    context.userId
  );
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  config as uploadConfig,
  sanitizeFilename,
  validateMimeType,
  getStorage,
};
