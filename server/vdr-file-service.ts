import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { Request } from 'express';
import multer from 'multer';

export interface FileValidationConfig {
  maxSizeBytes: number;
  allowedMimeTypes: string[];
  allowedExtensions: string[];
}

export interface UploadedFileInfo {
  filename: string;
  originalFilename: string;
  mimeType: string;
  size: number;
  checksum: string;
  storagePath: string;
  tempPath?: string;
}

export class VdrFileService {
  private uploadDir: string;
  private tempDir: string;
  private defaultConfig: FileValidationConfig = {
    maxSizeBytes: 100 * 1024 * 1024, // 100MB default
    allowedMimeTypes: [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'text/plain',
      'text/csv',
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'application/zip',
      'application/x-zip-compressed'
    ],
    allowedExtensions: [
      '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
      '.txt', '.csv', '.jpg', '.jpeg', '.png', '.gif', '.webp', '.zip'
    ]
  };

  constructor(uploadDir: string = 'server/uploads/vdr', tempDir: string = 'server/uploads/temp') {
    this.uploadDir = uploadDir;
    this.tempDir = tempDir;
  }

  async initialize(): Promise<void> {
    await fs.mkdir(this.uploadDir, { recursive: true });
    await fs.mkdir(this.tempDir, { recursive: true });
  }

  validateFile(filename: string, mimeType: string, size: number, config?: Partial<FileValidationConfig>): { valid: boolean; error?: string } {
    const finalConfig = { ...this.defaultConfig, ...config };

    if (size > finalConfig.maxSizeBytes) {
      return {
        valid: false,
        error: `File size ${size} bytes exceeds maximum allowed size of ${finalConfig.maxSizeBytes} bytes`
      };
    }

    if (!finalConfig.allowedMimeTypes.includes(mimeType)) {
      return {
        valid: false,
        error: `MIME type ${mimeType} is not allowed`
      };
    }

    const ext = path.extname(filename).toLowerCase();
    if (!finalConfig.allowedExtensions.includes(ext)) {
      return {
        valid: false,
        error: `File extension ${ext} is not allowed`
      };
    }

    return { valid: true };
  }

  async calculateChecksum(filePath: string): Promise<string> {
    const fileBuffer = await fs.readFile(filePath);
    const hashSum = crypto.createHash('sha256');
    hashSum.update(fileBuffer);
    return hashSum.digest('hex');
  }

  generateStoragePath(orgId: string, projectId: string, filename: string): string {
    const timestamp = Date.now();
    const randomString = crypto.randomBytes(8).toString('hex');
    const ext = path.extname(filename);
    const sanitizedName = path.basename(filename, ext).replace(/[^a-zA-Z0-9-_]/g, '_');
    const storageName = `${sanitizedName}_${timestamp}_${randomString}${ext}`;
    return path.join(orgId, projectId, storageName);
  }

  async moveToStorage(tempPath: string, storagePath: string): Promise<void> {
    const fullStoragePath = path.join(this.uploadDir, storagePath);
    const storageDir = path.dirname(fullStoragePath);
    
    await fs.mkdir(storageDir, { recursive: true });
    await fs.rename(tempPath, fullStoragePath);
  }

  async processUpload(
    tempPath: string,
    originalFilename: string,
    mimeType: string,
    size: number,
    orgId: string,
    projectId: string,
    config?: Partial<FileValidationConfig>
  ): Promise<UploadedFileInfo> {
    const validation = this.validateFile(originalFilename, mimeType, size, config);
    if (!validation.valid) {
      await this.cleanupTempFile(tempPath);
      throw new Error(validation.error);
    }

    const checksum = await this.calculateChecksum(tempPath);
    const storagePath = this.generateStoragePath(orgId, projectId, originalFilename);
    
    await this.moveToStorage(tempPath, storagePath);

    return {
      filename: path.basename(storagePath),
      originalFilename,
      mimeType,
      size,
      checksum,
      storagePath,
    };
  }

  async deleteFile(storagePath: string): Promise<void> {
    const fullPath = path.join(this.uploadDir, storagePath);
    try {
      await fs.unlink(fullPath);
    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }
  }

  async getFilePath(storagePath: string): Promise<string> {
    return path.join(this.uploadDir, storagePath);
  }

  async fileExists(storagePath: string): Promise<boolean> {
    const fullPath = path.join(this.uploadDir, storagePath);
    try {
      await fs.access(fullPath);
      return true;
    } catch {
      return false;
    }
  }

  async cleanupTempFile(tempPath: string): Promise<void> {
    try {
      await fs.unlink(tempPath);
    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        console.error('Failed to cleanup temp file:', tempPath, error);
      }
    }
  }

  createMulterStorage(): multer.StorageEngine {
    return multer.diskStorage({
      destination: async (req, file, cb) => {
        try {
          await fs.mkdir(this.tempDir, { recursive: true });
          cb(null, this.tempDir);
        } catch (error: any) {
          cb(error, this.tempDir);
        }
      },
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + crypto.randomBytes(6).toString('hex');
        const ext = path.extname(file.originalname);
        cb(null, `upload-${uniqueSuffix}${ext}`);
      }
    });
  }

  getMulterConfig(config?: Partial<FileValidationConfig>): multer.Options {
    const finalConfig = { ...this.defaultConfig, ...config };
    
    return {
      storage: this.createMulterStorage(),
      limits: {
        fileSize: finalConfig.maxSizeBytes,
        files: 10
      },
      fileFilter: (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
        const validation = this.validateFile(file.originalname, file.mimetype, 0, finalConfig);
        if (!validation.valid) {
          cb(new Error(validation.error));
        } else {
          cb(null, true);
        }
      }
    };
  }
}

export const vdrFileService = new VdrFileService();
