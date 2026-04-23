/**
 * One-time migration script: upload surviving local doc-intel files to object
 * storage and update the database rows to point at the new cloud keys.
 *
 * For every row in doc_intel_uploads whose storagePath does NOT start with
 * "doc-intel/" (i.e., it still holds a local filesystem path from before the
 * object-storage migration):
 *
 *  - If the local file still exists on disk → upload it to object storage and
 *    update storagePath to the new cloud key.
 *  - If the local file is gone (ephemeral FS wiped on restart) → set
 *    status = 'error' and errorMessage so users know to re-upload.
 *
 * The script is idempotent: rows already marked as missing by a previous run
 * are skipped so they are not double-processed.
 *
 * Usage (run from project root):
 *   npx tsx server/scripts/migrateDocIntelToObjectStorage.ts
 */

import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import { pathToFileURL } from "url";
import { db } from "../db";
import { docIntelUploads } from "@shared/schema";
import { not, like, sql, and, or, isNull } from "drizzle-orm";
import {
  isObjectStorageAvailable,
  uploadDocIntelFile,
} from "../utils/doc-intel-storage";

export interface MigrationResult {
  total: number;
  uploaded: number;
  missing: number;
  errors: number;
  details: Array<{
    id: string;
    orgId: string;
    filename: string;
    localPath: string;
    outcome: "uploaded" | "missing" | "error";
    newStoragePath?: string;
    errorMessage?: string;
  }>;
}

export async function migrateDocIntelFilesToObjectStorage(): Promise<MigrationResult> {
  const result: MigrationResult = {
    total: 0,
    uploaded: 0,
    missing: 0,
    errors: 0,
    details: [],
  };

  if (!isObjectStorageAvailable()) {
    throw new Error(
      "Object storage is not configured (PRIVATE_OBJECT_DIR is not set). " +
        "Cannot perform migration."
    );
  }

  // Find all rows that still have a local-style path (not starting with doc-intel/)
  // and have not already been marked as missing by a previous migration run.
  const localRows = await db
    .select({
      id: docIntelUploads.id,
      orgId: docIntelUploads.orgId,
      filename: docIntelUploads.filename,
      originalName: docIntelUploads.originalName,
      storagePath: docIntelUploads.storagePath,
      mimeType: docIntelUploads.mimeType,
      status: docIntelUploads.status,
      errorMessage: docIntelUploads.errorMessage,
    })
    .from(docIntelUploads)
    .where(
      and(
        not(like(docIntelUploads.storagePath, "doc-intel/%")),
        or(
          isNull(docIntelUploads.errorMessage),
          not(like(docIntelUploads.errorMessage, "Original file no longer available%"))
        )
      )
    );

  result.total = localRows.length;

  for (const row of localRows) {
    const localPath = row.storagePath;
    const detail: MigrationResult["details"][number] = {
      id: row.id,
      orgId: row.orgId,
      filename: row.filename,
      localPath,
      outcome: "error",
    };

    try {
      const absolutePath = path.isAbsolute(localPath)
        ? localPath
        : path.resolve(process.cwd(), localPath);

      if (!fs.existsSync(absolutePath)) {
        // File is gone – mark as error so users know to re-upload
        await db
          .update(docIntelUploads)
          .set({
            status: "error",
            errorMessage:
              "Original file no longer available (server was restarted before " +
              "cloud storage migration). Please re-upload this document.",
            updatedAt: new Date(),
          })
          .where(sql`id = ${row.id}`);

        detail.outcome = "missing";
        detail.errorMessage = "Local file not found; marked for re-upload.";
        result.missing++;
      } else {
        // File still exists – read it and push to object storage
        const buffer = fs.readFileSync(absolutePath);

        // Derive a stable filename: prefer original name with a hash prefix to
        // avoid collisions, mirroring what new uploads do.
        const hash = crypto
          .createHash("sha256")
          .update(buffer)
          .digest("hex")
          .slice(0, 12);
        const ext = path.extname(row.originalName) || path.extname(row.filename);
        const safeName = `${hash}${ext}`;

        const newStorageKey = await uploadDocIntelFile(
          row.orgId,
          safeName,
          buffer,
          row.mimeType
        );

        // On success, update storagePath and clear any stale migration-error
        // state so the row no longer appears broken in the UI.
        const wasMigrationError =
          row.status === "error" &&
          row.errorMessage != null &&
          row.errorMessage.startsWith("Migration failed:");

        await db
          .update(docIntelUploads)
          .set({
            storagePath: newStorageKey,
            ...(wasMigrationError
              ? { status: "uploaded", errorMessage: null }
              : {}),
            updatedAt: new Date(),
          })
          .where(sql`id = ${row.id}`);

        detail.outcome = "uploaded";
        detail.newStoragePath = newStorageKey;
        result.uploaded++;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // Mark row as error so the problem is visible in the UI
      try {
        await db
          .update(docIntelUploads)
          .set({
            status: "error",
            errorMessage: `Migration failed: ${message}`,
            updatedAt: new Date(),
          })
          .where(sql`id = ${row.id}`);
      } catch {
        // Best-effort; ignore secondary DB error
      }
      detail.outcome = "error";
      detail.errorMessage = message;
      result.errors++;
    }

    result.details.push(detail);
  }

  return result;
}

// Allow running as a standalone script (ESM-safe entry point detection)
const isMain =
  typeof process !== "undefined" &&
  process.argv[1] != null &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  (async () => {
    console.log("Starting doc-intel local-to-object-storage migration…");
    try {
      const res = await migrateDocIntelFilesToObjectStorage();
      console.log(
        `Done. total=${res.total} uploaded=${res.uploaded} missing=${res.missing} errors=${res.errors}`
      );
      if (res.details.length > 0) {
        console.log("\nDetails:");
        for (const d of res.details) {
          console.log(
            `  [${d.outcome.toUpperCase()}] id=${d.id} file=${d.localPath}` +
              (d.newStoragePath ? ` -> ${d.newStoragePath}` : "") +
              (d.errorMessage ? ` (${d.errorMessage})` : "")
          );
        }
      }
    } catch (err) {
      console.error("Migration failed:", err);
      process.exit(1);
    }
    process.exit(0);
  })();
}
