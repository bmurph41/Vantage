/**
 * S3 Storage Client
 * Handles all file uploads/downloads to AWS S3
 */

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { Readable } from 'stream';

// Initialize S3 client
const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!
  }
});

const BUCKET_NAME = process.env.S3_BUCKET_NAME!;

// Validate required environment variables
if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY || !process.env.S3_BUCKET_NAME) {
  console.error('❌ Missing required S3 environment variables');
  console.error('   Required: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, S3_BUCKET_NAME');
  process.exit(1);
}

/**
 * Upload file to S3
 */
export async function uploadToS3(params: {
  key: string;
  body: Buffer;
  contentType: string;
  metadata?: Record<string, string>;
}): Promise<{
  success: boolean;
  key?: string;
  url?: string;
  error?: string;
}> {
  try {
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: params.key,
      Body: params.body,
      ContentType: params.contentType,
      Metadata: params.metadata,
      ServerSideEncryption: 'AES256' // Encrypt at rest
    });

    await s3Client.send(command);

    return {
      success: true,
      key: params.key,
      url: `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${params.key}`
    };
  } catch (error: any) {
    console.error('S3 upload error:', error);
    return {
      success: false,
      error: error.message || 'Failed to upload file to S3'
    };
  }
}

/**
 * Generate signed URL for secure download
 * URL expires after specified time
 */
export async function getSignedDownloadUrl(
  key: string,
  expiresIn: number = 3600 // 1 hour default
): Promise<string | null> {
  try {
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key
    });

    const url = await getSignedUrl(s3Client, command, { expiresIn });
    return url;
  } catch (error) {
    console.error('Error generating signed URL:', error);
    return null;
  }
}

/**
 * Download file from S3
 */
export async function downloadFromS3(key: string): Promise<{
  success: boolean;
  data?: Buffer;
  contentType?: string;
  metadata?: Record<string, string>;
  error?: string;
}> {
  try {
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key
    });

    const response = await s3Client.send(command);
    
    // Convert stream to buffer
    const stream = response.Body as Readable;
    const chunks: Buffer[] = [];
    
    for await (const chunk of stream) {
      chunks.push(Buffer.from(chunk));
    }
    
    const data = Buffer.concat(chunks);

    return {
      success: true,
      data,
      contentType: response.ContentType,
      metadata: response.Metadata
    };
  } catch (error: any) {
    console.error('S3 download error:', error);
    return {
      success: false,
      error: error.message || 'Failed to download file from S3'
    };
  }
}

/**
 * Delete file from S3
 */
export async function deleteFromS3(key: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const command = new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key
    });

    await s3Client.send(command);

    return { success: true };
  } catch (error: any) {
    console.error('S3 delete error:', error);
    return {
      success: false,
      error: error.message || 'Failed to delete file from S3'
    };
  }
}

/**
 * Check if file exists in S3
 */
export async function fileExistsInS3(key: string): Promise<boolean> {
  try {
    const command = new HeadObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key
    });

    await s3Client.send(command);
    return true;
  } catch (error: any) {
    if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
      return false;
    }
    console.error('Error checking file existence:', error);
    return false;
  }
}

/**
 * List files in S3 by prefix
 */
export async function listS3Files(prefix: string): Promise<{
  success: boolean;
  files?: Array<{
    key: string;
    size: number;
    lastModified: Date;
  }>;
  error?: string;
}> {
  try {
    const command = new ListObjectsV2Command({
      Bucket: BUCKET_NAME,
      Prefix: prefix,
      MaxKeys: 1000
    });

    const response = await s3Client.send(command);
    
    const files = (response.Contents || []).map(obj => ({
      key: obj.Key!,
      size: obj.Size || 0,
      lastModified: obj.LastModified || new Date()
    }));

    return {
      success: true,
      files
    };
  } catch (error: any) {
    console.error('S3 list error:', error);
    return {
      success: false,
      error: error.message || 'Failed to list files from S3'
    };
  }
}

/**
 * Get file metadata without downloading
 */
export async function getFileMetadata(key: string): Promise<{
  success: boolean;
  size?: number;
  contentType?: string;
  lastModified?: Date;
  metadata?: Record<string, string>;
  error?: string;
}> {
  try {
    const command = new HeadObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key
    });

    const response = await s3Client.send(command);

    return {
      success: true,
      size: response.ContentLength,
      contentType: response.ContentType,
      lastModified: response.LastModified,
      metadata: response.Metadata
    };
  } catch (error: any) {
    console.error('Error getting file metadata:', error);
    return {
      success: false,
      error: error.message || 'Failed to get file metadata'
    };
  }
}

/**
 * Copy file within S3 (useful for backups)
 */
export async function copyWithinS3(
  sourceKey: string,
  destinationKey: string
): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    // S3 copy is done via PutObject with CopySource
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: destinationKey,
      CopySource: `${BUCKET_NAME}/${sourceKey}`,
      ServerSideEncryption: 'AES256'
    });

    await s3Client.send(command as any); // Type issue with CopySource

    return { success: true };
  } catch (error: any) {
    console.error('S3 copy error:', error);
    return {
      success: false,
      error: error.message || 'Failed to copy file in S3'
    };
  }
}

/**
 * Test S3 connection and permissions
 */
export async function testS3Connection(): Promise<{
  success: boolean;
  message: string;
  error?: string;
}> {
  try {
    // Try to list objects (tests both connection and permissions)
    const command = new ListObjectsV2Command({
      Bucket: BUCKET_NAME,
      MaxKeys: 1
    });

    await s3Client.send(command);

    return {
      success: true,
      message: `✓ S3 connection successful (bucket: ${BUCKET_NAME})`
    };
  } catch (error: any) {
    console.error('S3 connection test failed:', error);
    return {
      success: false,
      message: '❌ S3 connection failed',
      error: error.message
    };
  }
}

/**
 * Get storage usage stats for an org
 */
export async function getOrgStorageStats(orgId: number): Promise<{
  totalFiles: number;
  totalSize: number;
  formattedSize: string;
}> {
  try {
    const result = await listS3Files(`${orgId}/`);
    
    if (!result.success || !result.files) {
      return {
        totalFiles: 0,
        totalSize: 0,
        formattedSize: '0 MB'
      };
    }

    const totalSize = result.files.reduce((sum, file) => sum + file.size, 0);
    
    return {
      totalFiles: result.files.length,
      totalSize,
      formattedSize: formatBytes(totalSize)
    };
  } catch (error) {
    console.error('Error getting storage stats:', error);
    return {
      totalFiles: 0,
      totalSize: 0,
      formattedSize: '0 MB'
    };
  }
}

/**
 * Format bytes to human readable
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 MB';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Graceful shutdown
 */
export function closeS3Client() {
  s3Client.destroy();
  console.log('✓ S3 client disconnected');
}

// Export S3 client for advanced use cases
export { s3Client, BUCKET_NAME };
