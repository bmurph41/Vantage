import fs from 'fs/promises';
import path from 'path';
import { Readable } from 'stream';

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

export function createStorageProvider(type: 'local' | 's3' = 'local', config?: any): StorageProvider {
  if (type === 's3' && config?.bucket) {
    return new S3StorageProvider(config.bucket, config.region);
  }
  
  return new LocalFileSystemProvider(config?.baseDir);
}

export const defaultStorageProvider = createStorageProvider('local');
