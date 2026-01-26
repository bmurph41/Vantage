/**
 * File Upload Security
 * Prevents path traversal, MIME spoofing, and malicious file uploads
 */

import path from 'path';
import crypto from 'crypto';
import { fileTypeFromBuffer } from 'file-type';
import type { Request } from 'express';

// Allowed MIME types and extensions
const ALLOWED_TYPES = {
  'application/pdf': ['.pdf'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/gif': ['.gif'],
  'image/webp': ['.webp'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
  'application/vnd.ms-excel': ['.xls'],
  'text/csv': ['.csv'],
  'text/plain': ['.txt'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'application/msword': ['.doc']
};

// Maximum file sizes by type (in bytes)
const MAX_FILE_SIZES = {
  'application/pdf': 50 * 1024 * 1024, // 50 MB
  'image/jpeg': 10 * 1024 * 1024, // 10 MB
  'image/png': 10 * 1024 * 1024,
  'image/gif': 5 * 1024 * 1024,
  'image/webp': 10 * 1024 * 1024,
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 25 * 1024 * 1024,
  'application/vnd.ms-excel': 25 * 1024 * 1024,
  'text/csv': 10 * 1024 * 1024,
  'text/plain': 5 * 1024 * 1024,
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 25 * 1024 * 1024,
  'application/msword': 25 * 1024 * 1024,
  'default': 10 * 1024 * 1024 // 10 MB default
};

/**
 * Sanitize filename to prevent path traversal and special characters
 */
export function sanitizeFilename(filename: string): string {
  // Remove any path components
  let sanitized = path.basename(filename);
  
  // Remove or replace dangerous characters
  sanitized = sanitized
    .replace(/[^a-zA-Z0-9._-]/g, '_') // Replace special chars with underscore
    .replace(/\.{2,}/g, '.') // Replace multiple dots with single dot
    .replace(/^\.+/, '') // Remove leading dots
    .substring(0, 200); // Limit length
  
  // Ensure filename has extension
  if (!sanitized.includes('.')) {
    sanitized += '.bin'; // Add generic extension if none present
  }
  
  return sanitized;
}

/**
 * Generate secure random filename
 */
export function generateSecureFilename(originalFilename: string): string {
  const sanitized = sanitizeFilename(originalFilename);
  const ext = path.extname(sanitized);
  const randomPrefix = crypto.randomBytes(16).toString('hex');
  const timestamp = Date.now();
  
  return `${timestamp}-${randomPrefix}${ext}`;
}

/**
 * Validate file extension against allowed list
 */
export function isAllowedExtension(filename: string): boolean {
  const ext = path.extname(filename).toLowerCase();
  
  for (const extensions of Object.values(ALLOWED_TYPES)) {
    if (extensions.includes(ext)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Validate MIME type against magic bytes (prevents MIME spoofing)
 */
export async function validateMimeType(buffer: Buffer): Promise<{
  valid: boolean;
  detectedType?: string;
  error?: string;
}> {
  try {
    const fileType = await fileTypeFromBuffer(buffer);
    
    if (!fileType) {
      return {
        valid: false,
        error: 'Could not detect file type'
      };
    }
    
    if (!ALLOWED_TYPES[fileType.mime as keyof typeof ALLOWED_TYPES]) {
      return {
        valid: false,
        detectedType: fileType.mime,
        error: `File type ${fileType.mime} is not allowed`
      };
    }
    
    return {
      valid: true,
      detectedType: fileType.mime
    };
  } catch (error) {
    return {
      valid: false,
      error: 'Error validating file type'
    };
  }
}

/**
 * Check if file size is within limits
 */
export function validateFileSize(size: number, mimeType: string): {
  valid: boolean;
  error?: string;
  maxSize?: number;
} {
  const maxSize = MAX_FILE_SIZES[mimeType as keyof typeof MAX_FILE_SIZES] || MAX_FILE_SIZES.default;
  
  if (size > maxSize) {
    return {
      valid: false,
      error: `File size (${formatBytes(size)}) exceeds maximum allowed (${formatBytes(maxSize)})`,
      maxSize
    };
  }
  
  return { valid: true, maxSize };
}

/**
 * Comprehensive file validation
 */
export async function validateUpload(file: {
  originalname: string;
  buffer: Buffer;
  size: number;
}): Promise<{
  valid: boolean;
  secureFilename?: string;
  mimeType?: string;
  errors: string[];
}> {
  const errors: string[] = [];
  
  // 1. Sanitize filename
  const sanitized = sanitizeFilename(file.originalname);
  if (sanitized !== file.originalname) {
    errors.push('Filename contained invalid characters (sanitized automatically)');
  }
  
  // 2. Check extension
  if (!isAllowedExtension(sanitized)) {
    errors.push(`File extension ${path.extname(sanitized)} is not allowed`);
    return { valid: false, errors };
  }
  
  // 3. Validate MIME type against magic bytes
  const mimeValidation = await validateMimeType(file.buffer);
  if (!mimeValidation.valid) {
    errors.push(mimeValidation.error || 'Invalid file type');
    return { valid: false, errors };
  }
  
  // 4. Validate file size
  const sizeValidation = validateFileSize(file.size, mimeValidation.detectedType!);
  if (!sizeValidation.valid) {
    errors.push(sizeValidation.error!);
    return { valid: false, errors };
  }
  
  // 5. Generate secure filename
  const secureFilename = generateSecureFilename(sanitized);
  
  return {
    valid: true,
    secureFilename,
    mimeType: mimeValidation.detectedType,
    errors: errors.length > 0 ? errors : []
  };
}

/**
 * Format bytes to human readable string
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Multer file filter for use in upload middleware
 */
export async function fileFilter(
  req: Request,
  file: Express.Multer.File,
  callback: (error: Error | null, acceptFile: boolean) => void
) {
  try {
    // Quick extension check
    if (!isAllowedExtension(file.originalname)) {
      return callback(
        new Error(`File type ${path.extname(file.originalname)} is not allowed`),
        false
      );
    }
    
    callback(null, true);
  } catch (error) {
    callback(error as Error, false);
  }
}

/**
 * Log security event for file upload
 */
export function logUploadSecurityEvent(event: {
  userId?: number;
  orgId?: number;
  filename: string;
  action: 'blocked' | 'allowed';
  reason?: string;
  ip?: string;
}) {
  console.warn('File upload security event:', {
    timestamp: new Date().toISOString(),
    ...event
  });
  
  // TODO: In production, send to security monitoring system (Sentry, CloudWatch, etc.)
}

/**
 * Get S3 key path for organized storage
 */
export function getS3Key(params: {
  orgId: number;
  module: string; // 'cdd', 'vdr', 'crm', etc.
  filename: string;
  userId?: number;
}): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  
  // Structure: orgId/module/YYYY/MM/filename
  // Example: 123/cdd/2026/01/1737900000000-abc123def456.pdf
  return `${params.orgId}/${params.module}/${year}/${month}/${params.filename}`;
}

/**
 * Parse S3 key to extract metadata
 */
export function parseS3Key(key: string): {
  orgId: number;
  module: string;
  year: number;
  month: number;
  filename: string;
} | null {
  const parts = key.split('/');
  
  if (parts.length !== 5) {
    return null;
  }
  
  return {
    orgId: parseInt(parts[0]),
    module: parts[1],
    year: parseInt(parts[2]),
    month: parseInt(parts[3]),
    filename: parts[4]
  };
}
