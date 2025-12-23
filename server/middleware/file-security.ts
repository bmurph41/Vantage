import { Request, Response, NextFunction } from 'express';
import { logger } from '../lib/logger';
import path from 'path';
import crypto from 'crypto';

const ALLOWED_MIME_TYPES: Record<string, string[]> = {
  document: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    'text/csv',
  ],
  image: [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml',
  ],
  archive: [
    'application/zip',
    'application/x-zip-compressed',
  ],
};

const MAGIC_BYTES: Record<string, Buffer[]> = {
  'application/pdf': [Buffer.from([0x25, 0x50, 0x44, 0x46])],
  'image/jpeg': [Buffer.from([0xFF, 0xD8, 0xFF])],
  'image/png': [Buffer.from([0x89, 0x50, 0x4E, 0x47])],
  'image/gif': [Buffer.from([0x47, 0x49, 0x46, 0x38])],
  'application/zip': [Buffer.from([0x50, 0x4B, 0x03, 0x04])],
  'application/msword': [Buffer.from([0xD0, 0xCF, 0x11, 0xE0])],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': [Buffer.from([0x50, 0x4B, 0x03, 0x04])],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': [Buffer.from([0x50, 0x4B, 0x03, 0x04])],
};

const DANGEROUS_EXTENSIONS = [
  '.exe', '.bat', '.cmd', '.com', '.msi', '.scr', '.pif',
  '.sh', '.bash', '.zsh', '.ps1', '.vbs', '.js', '.jse',
  '.wsf', '.wsh', '.hta', '.jar', '.py', '.rb', '.php',
];

const MAX_FILENAME_LENGTH = 255;

function sanitizeFilename(filename: string): string {
  const cleanName = filename
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
    .replace(/\.{2,}/g, '.')
    .replace(/^\.+|\.+$/g, '')
    .trim();
  
  const ext = path.extname(cleanName).toLowerCase();
  const base = path.basename(cleanName, ext);
  
  const truncatedBase = base.slice(0, MAX_FILENAME_LENGTH - ext.length - 8);
  const hash = crypto.randomBytes(4).toString('hex');
  
  return `${truncatedBase}_${hash}${ext}`;
}

function checkMagicBytes(buffer: Buffer, mimeType: string): boolean {
  const signatures = MAGIC_BYTES[mimeType];
  if (!signatures) return true;
  
  return signatures.some(sig => 
    buffer.length >= sig.length && 
    buffer.slice(0, sig.length).equals(sig)
  );
}

export function validateFileUpload(options: {
  allowedTypes?: string[];
  maxSizeBytes?: number;
  category?: 'document' | 'image' | 'archive';
} = {}) {
  const maxSize = options.maxSizeBytes || 10 * 1024 * 1024; // 10MB default
  
  let allowedMimes: string[] = [];
  if (options.category) {
    allowedMimes = ALLOWED_MIME_TYPES[options.category] || [];
  } else if (options.allowedTypes) {
    allowedMimes = options.allowedTypes;
  } else {
    allowedMimes = Object.values(ALLOWED_MIME_TYPES).flat();
  }

  return (req: Request, res: Response, next: NextFunction) => {
    const files = (req as any).files || ((req as any).file ? [(req as any).file] : []);
    
    if (!files.length) {
      return next();
    }

    for (const file of files) {
      const ext = path.extname(file.originalname).toLowerCase();
      if (DANGEROUS_EXTENSIONS.includes(ext)) {
        logger.warn({
          type: 'dangerous_file_blocked',
          filename: file.originalname,
          extension: ext,
          userId: (req as any).user?.id,
          ip: req.ip,
        });
        return res.status(400).json({ 
          error: 'File type not allowed', 
          code: 'DANGEROUS_FILE_TYPE' 
        });
      }

      if (file.size > maxSize) {
        return res.status(400).json({ 
          error: `File too large. Maximum size is ${Math.round(maxSize / 1024 / 1024)}MB`, 
          code: 'FILE_TOO_LARGE' 
        });
      }

      if (!allowedMimes.includes(file.mimetype)) {
        logger.warn({
          type: 'invalid_mime_type',
          filename: file.originalname,
          mimetype: file.mimetype,
          allowedMimes,
          userId: (req as any).user?.id,
        });
        return res.status(400).json({ 
          error: 'File type not allowed', 
          code: 'INVALID_FILE_TYPE' 
        });
      }

      if (file.buffer && !checkMagicBytes(file.buffer, file.mimetype)) {
        logger.warn({
          type: 'magic_bytes_mismatch',
          filename: file.originalname,
          claimedMime: file.mimetype,
          userId: (req as any).user?.id,
          ip: req.ip,
        });
        return res.status(400).json({ 
          error: 'File content does not match type', 
          code: 'CONTENT_MISMATCH' 
        });
      }

      file.sanitizedFilename = sanitizeFilename(file.originalname);
    }

    next();
  };
}

export function quarantineFile(file: Express.Multer.File, reason: string): void {
  logger.warn({
    type: 'file_quarantined',
    filename: file.originalname,
    sanitizedFilename: (file as any).sanitizedFilename,
    mimetype: file.mimetype,
    size: file.size,
    reason,
  });
}

export { sanitizeFilename, checkMagicBytes };
