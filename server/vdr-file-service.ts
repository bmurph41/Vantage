import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { Request } from 'express';
import multer from 'multer';
import { uploadToS3, downloadFromS3, deleteFromS3, getSignedDownloadUrl, fileExistsInS3 } from './storage/s3-client';

// Check if S3 is configured
const USE_S3 = !!(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY && process.env.S3_BUCKET_NAME);

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
  s3Url?: string;
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
    
    if (USE_S3) {
      console.log('✓ VDR File Service: Using S3 storage');
    } else {
      console.log('⚠ VDR File Service: Using local storage (S3 not configured)');
    }
  }

  async initialize(): Promise<void> {
    // Always create temp dir for multer
    await fs.mkdir(this.tempDir, { recursive: true });
    
    // Only create upload dir if not using S3
    if (!USE_S3) {
      await fs.mkdir(this.uploadDir, { recursive: true });
    }
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

  async calculateChecksumFromBuffer(buffer: Buffer): Promise<string> {
    const hashSum = crypto.createHash('sha256');
    hashSum.update(buffer);
    return hashSum.digest('hex');
  }

  generateStoragePath(orgId: string, projectId: string, filename: string): string {
    const timestamp = Date.now();
    const randomString = crypto.randomBytes(8).toString('hex');
    const ext = path.extname(filename);
    const sanitizedName = path.basename(filename, ext).replace(/[^a-zA-Z0-9-_]/g, '_');
    const storageName = `${sanitizedName}_${timestamp}_${randomString}${ext}`;
    
    // S3 uses forward slashes
    if (USE_S3) {
      return `vdr/${orgId}/${projectId}/${storageName}`;
    }
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

    const storagePath = this.generateStoragePath(orgId, projectId, originalFilename);
    
    if (USE_S3) {
      // Upload to S3
      const fileBuffer = await fs.readFile(tempPath);
      const checksum = await this.calculateChecksumFromBuffer(fileBuffer);
      
      const s3Result = await uploadToS3({
        key: storagePath,
        body: fileBuffer,
        contentType: mimeType,
        metadata: {
          originalFilename,
          checksum,
          orgId,
          projectId
        }
      });
      
      await this.cleanupTempFile(tempPath);
      
      if (!s3Result.success) {
        throw new Error(`S3 upload failed: ${s3Result.error}`);
      }
      
      return {
        filename: path.basename(storagePath),
        originalFilename,
        mimeType,
        size,
        checksum,
        storagePath,
        s3Url: s3Result.url
      };
    } else {
      // Local storage fallback
      const checksum = await this.calculateChecksum(tempPath);
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
  }

  async deleteFile(storagePath: string): Promise<void> {
    if (USE_S3) {
      const result = await deleteFromS3(storagePath);
      if (!result.success) {
        console.error('Failed to delete from S3:', result.error);
      }
    } else {
      const fullPath = path.join(this.uploadDir, storagePath);
      try {
        await fs.unlink(fullPath);
      } catch (error: any) {
        if (error.code !== 'ENOENT') {
          throw error;
        }
      }
    }
  }

  async getFilePath(storagePath: string): Promise<string> {
    if (USE_S3) {
      // Return a signed URL for S3 files
      const result = await getSignedDownloadUrl(storagePath, 3600); // 1 hour
      if (!result.success) {
        throw new Error(`Failed to get S3 URL: ${result.error}`);
      }
      return result.url!;
    }
    return path.join(this.uploadDir, storagePath);
  }

  async getFileBuffer(storagePath: string): Promise<Buffer> {
    if (USE_S3) {
      const result = await downloadFromS3(storagePath);
      if (!result.success || !result.data) {
        throw new Error(`Failed to download from S3: ${result.error}`);
      }
      return result.data;
    }
    const fullPath = path.join(this.uploadDir, storagePath);
    return fs.readFile(fullPath);
  }

  async getSignedUrl(storagePath: string, expiresInSeconds: number = 3600): Promise<string> {
    if (USE_S3) {
      const result = await getSignedDownloadUrl(storagePath, expiresInSeconds);
      if (!result.success) {
        throw new Error(`Failed to get signed URL: ${result.error}`);
      }
      return result.url!;
    }
    // For local storage, return the file path (would need a download endpoint)
    return `/api/vdr/download/${encodeURIComponent(storagePath)}`;
  }

  async fileExists(storagePath: string): Promise<boolean> {
    if (USE_S3) {
      return fileExistsInS3(storagePath);
    }
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
  
  isUsingS3(): boolean {
    return USE_S3;
  }
}

export const vdrFileService = new VdrFileService();
