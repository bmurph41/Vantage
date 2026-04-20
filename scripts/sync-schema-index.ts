#!/usr/bin/env tsx
/**
 * Regenerate db/schema-index.ts from the db/schema-*.ts files that
 * currently exist on disk.
 *
 * Usage:
 *   npx tsx scripts/sync-schema-index.ts
 *
 * Run this whenever a new secondary schema file (db/schema-*.ts) is added.
 * The generate-startup-migrations script also calls this automatically.
 *
 * Exit codes:
 *   0 — db/schema-index.ts is up to date (or was successfully updated)
 *   1 — an error occurred
 */

import { readdirSync, writeFileSync, readFileSync, existsSync } from "fs";
import { resolve, join, dirname, basename } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const dbDir = resolve(__dirname, "../db");
const outputPath = join(dbDir, "schema-index.ts");

/**
 * Extra schema files that live outside db/ but must always be re-exported by
 * the index so the drift checker (server/schema-drift.ts) can discover them.
 * These are path-aliased relative to db/schema-index.ts.
 *
 * Only entries whose files actually exist on disk are emitted, so a deleted
 * shared schema file will not produce a stale import.
 */
const SHARED_EXPORTS: Array<{ importPath: string; diskPath: string }> = [
  {
    importPath: "../shared/commercial-lease-schema",
    diskPath: resolve(__dirname, "../shared/commercial-lease-schema.ts"),
  },
  {
    importPath: "../shared/document-builder/schema",
    diskPath: resolve(__dirname, "../shared/document-builder/schema.ts"),
  },
  {
    importPath: "../server/listings/ingestion_v2/schema",
    diskPath: resolve(__dirname, "../server/listings/ingestion_v2/schema.ts"),
  },
];

function generateBarrelContent(schemaFiles: string[]): string {
  const header = `/**
 * AUTO-GENERATED — do not edit manually.
 *
 * Re-exports every secondary schema defined in db/schema-*.ts so that
 * server-side modules can import them with a single static import that
 * esbuild (and tsc) can analyse and bundle at build time.
 *
 * To regenerate after adding a new db/schema-*.ts file, run:
 *   npx tsx scripts/sync-schema-index.ts
 *
 * The generate-startup-migrations script also regenerates this file
 * automatically whenever it is executed.
 */\n`;

  const lines: string[] = [];

  if (schemaFiles.length === 0) {
    lines.push("// No secondary schema files found.");
  } else {
    for (const f of schemaFiles) {
      lines.push(`export * from "./${basename(f, ".ts")}";`);
    }
  }

  const presentShared = SHARED_EXPORTS.filter((e) => existsSync(e.diskPath));

  if (presentShared.length > 0) {
    lines.push("");
    lines.push(
      "// Shared schemas that live outside db/ but need to be visible to the drift"
    );
    lines.push(
      "// checker (server/schema-drift.ts imports db/schema-index to discover all"
    );
    lines.push(
      "// table definitions). These must be path-aliased relative to this file."
    );
    for (const e of presentShared) {
      lines.push(`export * from "${e.importPath}";`);
    }
  }

  return header + "\n" + lines.join("\n") + "\n";
}

let schemaFiles: string[];
try {
  schemaFiles = readdirSync(dbDir)
    .filter(
      (f) =>
        f.startsWith("schema-") &&
        f.endsWith(".ts") &&
        !f.endsWith(".d.ts") &&
        f !== "schema-index.ts"
    )
    .sort();
} catch (err) {
  console.error("[sync-schema-index] Could not read db/ directory:", err);
  process.exit(1);
}

const newContent = generateBarrelContent(schemaFiles);

let existingContent = "";
try {
  existingContent = readFileSync(outputPath, "utf8");
} catch {
  // File doesn't exist yet — treat as empty.
}

if (newContent === existingContent) {
  console.log(
    `[sync-schema-index] db/schema-index.ts is already up to date (${schemaFiles.length} schema file(s) covered).`
  );
  process.exit(0);
}

try {
  writeFileSync(outputPath, newContent, "utf8");
} catch (err) {
  console.error(
    "[sync-schema-index] Could not write db/schema-index.ts:",
    err
  );
  process.exit(1);
}

console.log(
  `[sync-schema-index] Updated db/schema-index.ts — now covers ${schemaFiles.length} schema file(s):`
);
for (const f of schemaFiles) {
  console.log(`  - db/${f}`);
}

const presentShared = SHARED_EXPORTS.filter((e) => existsSync(e.diskPath));
if (presentShared.length > 0) {
  console.log(
    `[sync-schema-index] Also re-exports ${presentShared.length} shared schema file(s):`
  );
  for (const e of presentShared) {
    console.log(`  - ${e.importPath}`);
  }
}
