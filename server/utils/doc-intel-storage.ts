import {
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import * as crypto from "crypto";
import type { Readable } from "stream";
import { s3Client, BUCKET_NAME } from "../storage/s3-client";

export function isObjectStorageAvailable(): boolean {
  // s3-client.ts asserts AWS creds + bucket at module-load; reaching this is proof S3 is configured.
  return true;
}

export function isObjectStorageKey(storagePath: string): boolean {
  return storagePath.startsWith("doc-intel/") || storagePath.startsWith("vdr/");
}

export async function uploadVdrFile(
  orgId: string,
  projectId: string,
  filename: string,
  buffer: Buffer,
  contentType: string
): Promise<string> {
  const key = `vdr/${orgId}/${projectId}/${filename}`;
  await s3Client.send(new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    Body: buffer,
    ContentType: contentType,
  }));
  return key;
}

export async function uploadDocIntelFile(
  orgId: string,
  filename: string,
  buffer: Buffer,
  contentType: string
): Promise<string> {
  const key = `doc-intel/${orgId}/${filename}`;
  await s3Client.send(new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    Body: buffer,
    ContentType: contentType,
  }));
  return key;
}

export async function downloadObjectStorageToStream(bucketKey: string): Promise<Readable> {
  const response = await s3Client.send(new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: bucketKey,
  }));
  return response.Body as Readable;
}

export async function downloadDocIntelToBuffer(bucketKey: string): Promise<Buffer> {
  const response = await s3Client.send(new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: bucketKey,
  }));
  const stream = response.Body as Readable;
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

export async function downloadDocIntelToTempFile(
  bucketKey: string,
  ext: string
): Promise<string> {
  const buffer = await downloadDocIntelToBuffer(bucketKey);
  const tmpPath = path.join(
    os.tmpdir(),
    `doc-intel-${crypto.randomBytes(8).toString("hex")}${ext}`
  );
  fs.writeFileSync(tmpPath, buffer);
  return tmpPath;
}

export async function deleteObjectStorageFile(bucketKey: string): Promise<void> {
  try {
    await s3Client.send(new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
      Key: bucketKey,
    }));
  } catch {
    // Match legacy GCS ignoreNotFound semantics — swallow any failure (S3 DeleteObject is also idempotent for missing keys).
  }
}

export async function docIntelFileExists(bucketKey: string): Promise<boolean> {
  try {
    await s3Client.send(new HeadObjectCommand({
      Bucket: BUCKET_NAME,
      Key: bucketKey,
    }));
    return true;
  } catch (err: any) {
    if (err?.name === "NotFound" || err?.$metadata?.httpStatusCode === 404) {
      return false;
    }
    return false;
  }
}
