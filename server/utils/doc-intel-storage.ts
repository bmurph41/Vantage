import { Storage } from "@google-cloud/storage";
import { ExternalAccountClient } from "google-auth-library";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import * as crypto from "crypto";

const REPLIT_SIDECAR_ENDPOINT = "http://127.0.0.1:1106";

function getStorageClient(): Storage {
  const authClient = ExternalAccountClient.fromJSON({
    type: "external_account",
    audience: "replit",
    subject_token_type: "access_token",
    token_url: `${REPLIT_SIDECAR_ENDPOINT}/token`,
    credential_source: {
      url: `${REPLIT_SIDECAR_ENDPOINT}/credential`,
      format: {
        type: "json",
        subject_token_field_name: "access_token",
      },
    },
    universe_domain: "googleapis.com",
  });
  if (!authClient) {
    throw new Error("Failed to initialize object storage auth client");
  }
  return new Storage({ authClient, projectId: "" });
}

function parseBucketAndPrefix(): { bucketName: string; prefix: string } {
  const privateDir = process.env.PRIVATE_OBJECT_DIR;
  if (!privateDir) {
    throw new Error("PRIVATE_OBJECT_DIR is not set. Object storage is not configured.");
  }
  const trimmed = privateDir.startsWith("/") ? privateDir.slice(1) : privateDir;
  const slashIdx = trimmed.indexOf("/");
  if (slashIdx === -1) {
    return { bucketName: trimmed, prefix: "" };
  }
  const bucketName = trimmed.slice(0, slashIdx);
  const prefix = trimmed.slice(slashIdx + 1);
  return { bucketName, prefix };
}

export function isObjectStorageAvailable(): boolean {
  return !!process.env.PRIVATE_OBJECT_DIR;
}

export function isObjectStorageKey(storagePath: string): boolean {
  return storagePath.startsWith("doc-intel/");
}

export async function uploadDocIntelFile(
  orgId: string,
  filename: string,
  buffer: Buffer,
  contentType: string
): Promise<string> {
  const { bucketName, prefix } = parseBucketAndPrefix();
  const client = getStorageClient();

  const objectName = prefix
    ? `${prefix}/doc-intel/${orgId}/${filename}`
    : `doc-intel/${orgId}/${filename}`;

  const bucket = client.bucket(bucketName);
  const file = bucket.file(objectName);

  await file.save(buffer, {
    metadata: { contentType },
    resumable: false,
  });

  return `doc-intel/${orgId}/${filename}`;
}

export async function downloadDocIntelToBuffer(bucketKey: string): Promise<Buffer> {
  const { bucketName, prefix } = parseBucketAndPrefix();
  const client = getStorageClient();

  const objectName = prefix ? `${prefix}/${bucketKey}` : bucketKey;
  const bucket = client.bucket(bucketName);
  const file = bucket.file(objectName);

  const [contents] = await file.download();
  return contents;
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

export async function docIntelFileExists(bucketKey: string): Promise<boolean> {
  try {
    const { bucketName, prefix } = parseBucketAndPrefix();
    const client = getStorageClient();
    const objectName = prefix ? `${prefix}/${bucketKey}` : bucketKey;
    const bucket = client.bucket(bucketName);
    const file = bucket.file(objectName);
    const [exists] = await file.exists();
    return exists;
  } catch {
    return false;
  }
}
