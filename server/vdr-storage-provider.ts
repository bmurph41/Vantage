import fs from 'fs/promises';
import path from 'path';
import { Readable } from 'stream';
import {
  isObjectStorageAvailable,
  downloadObjectStorageToStream,
  uploadVdrFile,
  deleteObjectStorageFile,
  docIntelFileExists,
} from './utils/doc-intel-storage';

const USE_S3 = !!(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY && process.env.S3_BUCKET_NAME);

export interface StorageProvider {
  upload(filePath: string, storagePath: string): Promise<string>;
  download(storagePath: string): Promise<Readable>;
  delete(storagePath: string): Promise<void>;
  getSignedUrl(storagePath: string, expiresIn: number): Promise<string>;
  exists(storagePath: string): Promise<boolean>;
}

export class LocalFileSystemProvider implements StorageProvider {
  private baseDir: string;

  constructor(baseDir: string = 'server/uploads/vdr') {
    this.baseDir = baseDir;
  }

  async upload(filePath: string, storagePath: string): Promise<string> {
    const fullStoragePath = path.join(this.baseDir, storagePath);
    const storageDir = path.dirname(fullStoragePath);
    
    await fs.mkdir(storageDir, { recursive: true });
    await fs.copyFile(filePath, fullStoragePath);
    
    return storagePath;
  }

  async download(storagePath: string): Promise<Readable> {
    const fullPath = path.join(this.baseDir, storagePath);
    const { createReadStream } = await import('fs');
    return createReadStream(fullPath);
  }

  async delete(storagePath: string): Promise<void> {
    const fullPath = path.join(this.baseDir, storagePath);
    try {
      await fs.unlink(fullPath);
    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }
  }

  async getSignedUrl(storagePath: string, expiresIn: number): Promise<string> {
    return `/api/vdr/documents/download/${encodeURIComponent(storagePath)}`;
  }

  async exists(storagePath: string): Promise<boolean> {
    const fullPath = path.join(this.baseDir, storagePath);
    try {
      await fs.access(fullPath);
      return true;
    } catch {
      return false;
    }
  }
}

export class S3StorageProvider implements StorageProvider {
  private bucket: string;
  private region: string;
  private s3Client: any;

  constructor(bucket: string, region: string = 'us-east-1') {
    this.bucket = bucket;
    this.region = region;
  }

  private async getS3Client() {
    if (!this.s3Client) {
      const { S3Client } = await import('@aws-sdk/client-s3');
      this.s3Client = new S3Client({ region: this.region });
    }
    return this.s3Client;
  }

  async upload(filePath: string, storagePath: string): Promise<string> {
    const { PutObjectCommand } = await import('@aws-sdk/client-s3');
    const fileContent = await fs.readFile(filePath);
    
    const client = await this.getS3Client();
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: storagePath,
      Body: fileContent,
    });

    await client.send(command);
    return storagePath;
  }

  async download(storagePath: string): Promise<Readable> {
    const { GetObjectCommand } = await import('@aws-sdk/client-s3');
    
    const client = await this.getS3Client();
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: storagePath,
    });

    const response = await client.send(command);
    return response.Body as Readable;
  }

  async delete(storagePath: string): Promise<void> {
    const { DeleteObjectCommand } = await import('@aws-sdk/client-s3');
    
    const client = await this.getS3Client();
    const command = new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: storagePath,
    });

    await client.send(command);
  }

  async getSignedUrl(storagePath: string, expiresIn: number = 3600): Promise<string> {
    const { GetObjectCommand } = await import('@aws-sdk/client-s3');
    const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');
    
    const client = await this.getS3Client();
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: storagePath,
    });

    return await getSignedUrl(client, command, { expiresIn });
  }

  async exists(storagePath: string): Promise<boolean> {
    const { HeadObjectCommand } = await import('@aws-sdk/client-s3');
    
    try {
      const client = await this.getS3Client();
      const command = new HeadObjectCommand({
        Bucket: this.bucket,
        Key: storagePath,
      });
      
      await client.send(command);
      return true;
    } catch {
      return false;
    }
  }
}

export class ReplitObjectStorageProvider implements StorageProvider {
  private localFallbackDir: string;

  constructor(localFallbackDir: string = 'server/uploads/vdr') {
    this.localFallbackDir = localFallbackDir;
  }

  async upload(filePath: string, storagePath: string): Promise<string> {
    const { readFile } = await import('fs/promises');
    const buffer = await readFile(filePath);
    const parts = storagePath.split('/');
    const orgId = parts[1] ?? 'unknown';
    const projectId = parts[2] ?? 'unknown';
    const filename = parts.slice(3).join('/') || path.basename(filePath);
    return uploadVdrFile(orgId, projectId, filename, buffer, 'application/octet-stream');
  }

  async download(storagePath: string): Promise<Readable> {
    if (storagePath.startsWith('vdr/') || storagePath.startsWith('doc-intel/')) {
      return downloadObjectStorageToStream(storagePath);
    }
    // Legacy fallback: file was stored on local disk before migration
    const { createReadStream } = await import('fs');
    const fullPath = path.join(this.localFallbackDir, storagePath);
    return createReadStream(fullPath);
  }

  async delete(storagePath: string): Promise<void> {
    if (storagePath.startsWith('vdr/') || storagePath.startsWith('doc-intel/')) {
      await deleteObjectStorageFile(storagePath);
    } else {
      const fullPath = path.join(this.localFallbackDir, storagePath);
      try {
        await fs.unlink(fullPath);
      } catch (err: any) {
        if (err.code !== 'ENOENT') throw err;
      }
    }
  }

  async getSignedUrl(storagePath: string, _expiresIn: number): Promise<string> {
    return `/api/vdr/documents/download/${encodeURIComponent(storagePath)}`;
  }

  async exists(storagePath: string): Promise<boolean> {
    if (storagePath.startsWith('vdr/') || storagePath.startsWith('doc-intel/')) {
      return docIntelFileExists(storagePath);
    }
    const fullPath = path.join(this.localFallbackDir, storagePath);
    try {
      await fs.access(fullPath);
      return true;
    } catch {
      return false;
    }
  }
}

export function createStorageProvider(type: 'local' | 's3' | 'replit' = 'local', config?: any): StorageProvider {
  if (type === 's3' && config?.bucket) {
    return new S3StorageProvider(config.bucket, config.region);
  }
  // Auto-detect: S3 takes priority to match upload priority in vdr-file-service.ts
  if (USE_S3 && process.env.S3_BUCKET_NAME) {
    return new S3StorageProvider(process.env.S3_BUCKET_NAME, process.env.AWS_REGION);
  }
  if (type === 'replit' || isObjectStorageAvailable()) {
    return new ReplitObjectStorageProvider(config?.baseDir);
  }
  return new LocalFileSystemProvider(config?.baseDir);
}

export const defaultStorageProvider = createStorageProvider();
