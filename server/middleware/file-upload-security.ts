/**
 * File Upload Security Middleware
 * 
 * Comprehensive validation for all file uploads including:
 * - Size limits
 * - Extension allowlist/blocklist
 * - Magic number (content-type) validation
 * - Filename sanitization
 * - Content hash generation for audit trails
 * - Double extension detection
 * 
 * Usage:
 *   import { validateFileUpload, FileSecurityOptions } from './middleware/file-upload-security';
 *   
 *   app.post('/api/documents/upload',
 *     upload.single('file'),
 *     validateFileUpload({ maxSize: 25 * 1024 * 1024 }),
 *     handleDocumentUpload
 *   );
 */

import { Request, Response, NextFunction } from 'express';
import { createHash } from 'crypto';
import path from 'path';
import { logger } from '../lib/logger';
import { logAudit } from './audit-middleware';

// ─── Configuration ───────────────────────────────────────────────────────────

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB default
const MAX_FILENAME_LENGTH = 200;

const ALLOWED_EXTENSIONS = new Set([
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.csv', '.tsv',
  '.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg',
  '.txt', '.rtf', '.ppt', '.pptx',
  '.zip', '.gz',
]);

const BLOCKED_EXTENSIONS = new Set([
  '.exe', '.bat', '.cmd', '.sh', '.ps1', '.msi', '.dll',
  '.js', '.jsx', '.ts', '.tsx', '.php', '.py', '.rb',
  '.com', '.scr', '.vbs', '.wsf', '.cpl', '.hta',
]);

/**
 * Magic number signatures for content-type verification.
 * Maps MIME types to their expected file header bytes (hex).
 */
const MAGIC_NUMBERS: Record<string, string[]> = {
  'application/pdf':  ['25504446'],              // %PDF
  'image/jpeg':       ['ffd8ffe0', 'ffd8ffe1', 'ffd8ffe2', 'ffd8ffdb', 'ffd8ffee'], // JFIF/EXIF variants
  'image/png':        ['89504e47'],              // .PNG
  'image/gif':        ['47494638'],              // GIF8
  'image/webp':       ['52494646'],              // RIFF (WebP container)
  'application/zip':  ['504b0304', '504b0506'],  // PK
  'application/gzip': ['1f8b'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document':   ['504b0304'], // docx is zip
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':         ['504b0304'], // xlsx is zip
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['504b0304'], // pptx is zip
  'application/vnd.ms-excel':      ['d0cf11e0'],  // OLE2
  'application/msword':            ['d0cf11e0'],  // OLE2
};

// ─── Types ───────────────────────────────────────────────────────────────────

export interface FileSecurityOptions {
  /** Max file size in bytes (default: 50MB) */
  maxSize?: number;
  /** Override allowed extensions (default: see ALLOWED_EXTENSIONS) */
  allowedExtensions?: string[];
  /** Skip magic number validation (default: false) */
  skipMagicValidation?: boolean;
  /** Custom allowed MIME types */
  allowedMimeTypes?: string[];
}

interface FileValidationResult {
  valid: boolean;
  error?: string;
  code?: string;
  sanitizedName?: string;
  contentHash?: string;
}

// ─── Validation Logic ────────────────────────────────────────────────────────

function validateSize(file: Express.Multer.File, maxSize: number): FileValidationResult {
  if (file.size > maxSize) {
    return {
      valid: false,
      error: `File exceeds maximum size of ${Math.round(maxSize / 1024 / 1024)}MB`,
      code: 'FILE_TOO_LARGE',
    };
  }
  return { valid: true };
}

function validateExtension(
  filename: string,
  allowedExtensions?: string[]
): FileValidationResult {
  const ext = path.extname(filename).toLowerCase();

  // Check blocklist first
  if (BLOCKED_EXTENSIONS.has(ext)) {
    return {
      valid: false,
      error: `File type '${ext}' is not allowed`,
      code: 'BLOCKED_FILE_TYPE',
    };
  }

  // Double extension attack detection (e.g., document.pdf.exe)
  const parts = filename.split('.');
  if (parts.length > 2) {
    const secondExt = '.' + parts[parts.length - 2].toLowerCase();
    if (BLOCKED_EXTENSIONS.has(secondExt)) {
      return {
        valid: false,
        error: 'Suspicious double extension detected',
        code: 'DOUBLE_EXTENSION_BLOCKED',
      };
    }
  }

  // Check allowlist
  const allowed = allowedExtensions
    ? new Set(allowedExtensions.map(e => e.toLowerCase()))
    : ALLOWED_EXTENSIONS;

  if (!allowed.has(ext)) {
    return {
      valid: false,
      error: `File type '${ext}' is not supported. Allowed: ${[...allowed].join(', ')}`,
      code: 'UNSUPPORTED_FILE_TYPE',
    };
  }

  return { valid: true };
}

function validateMagicNumber(file: Express.Multer.File): FileValidationResult {
  const buffer = file.buffer;
  if (!buffer || buffer.length < 4) {
    return { valid: true }; // Can't validate without buffer
  }

  const hex = buffer.subarray(0, 10).toString('hex');
  const declaredType = file.mimetype;
  const expectedMagics = MAGIC_NUMBERS[declaredType];

  if (expectedMagics && !expectedMagics.some(magic => hex.startsWith(magic))) {
    return {
      valid: false,
      error: 'File content does not match declared type (possible content-type spoofing)',
      code: 'CONTENT_TYPE_MISMATCH',
    };
  }

  return { valid: true };
}

function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[^a-zA-Z0-9._-]/g, '_')  // Replace unsafe chars
    .replace(/_{2,}/g, '_')              // Collapse multiple underscores
    .replace(/^\.+/, '')                 // Remove leading dots (hidden files)
    .substring(0, MAX_FILENAME_LENGTH);
}

function generateContentHash(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}

// ─── Middleware ───────────────────────────────────────────────────────────────

/**
 * File upload validation middleware.
 * Apply AFTER multer middleware (upload.single/upload.array).
 */
export function validateFileUpload(options: FileSecurityOptions = {}) {
  const maxSize = options.maxSize || MAX_FILE_SIZE;

  return async (req: Request, res: Response, next: NextFunction) => {
    const file = req.file;
    const files = (req as any).files as Express.Multer.File[] | undefined;
    const allFiles = file ? [file] : files || [];

    if (allFiles.length === 0) return next();

    for (const f of allFiles) {
      // 1. Size validation
      const sizeResult = validateSize(f, maxSize);
      if (!sizeResult.valid) {
        logger.warn({
          type: 'file_upload_rejected',
          reason: sizeResult.code,
          filename: f.originalname,
          size: f.size,
          maxSize,
          userId: (req as any).user?.id,
          ip: req.ip,
        });
        return res.status(413).json({
          success: false,
          error: { code: sizeResult.code, message: sizeResult.error },
        });
      }

      // 2. Extension validation
      const extResult = validateExtension(f.originalname, options.allowedExtensions);
      if (!extResult.valid) {
        logger.warn({
          type: 'file_upload_rejected',
          reason: extResult.code,
          filename: f.originalname,
          mimetype: f.mimetype,
          userId: (req as any).user?.id,
          ip: req.ip,
        });
        return res.status(400).json({
          success: false,
          error: { code: extResult.code, message: extResult.error },
        });
      }

      // 3. Magic number validation
      if (!options.skipMagicValidation) {
        const magicResult = validateMagicNumber(f);
        if (!magicResult.valid) {
          logger.warn({
            type: 'file_upload_rejected',
            reason: magicResult.code,
            filename: f.originalname,
            mimetype: f.mimetype,
            bufferPrefix: f.buffer?.subarray(0, 10).toString('hex'),
            userId: (req as any).user?.id,
            ip: req.ip,
          });
          return res.status(400).json({
            success: false,
            error: { code: magicResult.code, message: magicResult.error },
          });
        }
      }

      // 4. MIME type allowlist (if configured)
      if (options.allowedMimeTypes && !options.allowedMimeTypes.includes(f.mimetype)) {
        logger.warn({
          type: 'file_upload_rejected',
          reason: 'MIME_TYPE_NOT_ALLOWED',
          filename: f.originalname,
          mimetype: f.mimetype,
          userId: (req as any).user?.id,
        });
        return res.status(400).json({
          success: false,
          error: {
            code: 'MIME_TYPE_NOT_ALLOWED',
            message: `MIME type '${f.mimetype}' is not allowed`,
          },
        });
      }

      // 5. Sanitize filename
      f.originalname = sanitizeFilename(f.originalname);

      // 6. Generate content hash for audit/dedup
      if (f.buffer) {
        const hash = generateContentHash(f.buffer);
        (req as any).fileHash = hash;
        (req as any).fileHashes = (req as any).fileHashes || {};
        (req as any).fileHashes[f.originalname] = hash;
      }
    }

    // Log successful upload for audit
    logger.info({
      type: 'file_upload_accepted',
      fileCount: allFiles.length,
      files: allFiles.map(f => ({
        name: f.originalname,
        size: f.size,
        mimetype: f.mimetype,
      })),
      userId: (req as any).user?.id,
      orgId: (req as any).user?.orgId,
    });

    next();
  };
}
