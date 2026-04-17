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

import { readdirSync, writeFileSync, readFileSync } from "fs";
import { resolve, join, dirname, basename } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const dbDir = resolve(__dirname, "../db");
const outputPath = join(dbDir, "schema-index.ts");

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

  if (schemaFiles.length === 0) {
    return header + "\n// No secondary schema files found.\n";
  }

  const exports = schemaFiles
    .map((f) => `export * from "./${basename(f, ".ts")}";`)
    .join("\n");

  return header + "\n" + exports + "\n";
}

let schemaFiles: string[];
try {
  schemaFiles = readdirSync(dbDir)
    .filter((f) => f.startsWith("schema-") && f.endsWith(".ts") && f !== "schema-index.ts")
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
  console.error("[sync-schema-index] Could not write db/schema-index.ts:", err);
  process.exit(1);
}

console.log(
  `[sync-schema-index] Updated db/schema-index.ts — now covers ${schemaFiles.length} schema file(s):`
);
for (const f of schemaFiles) {
  console.log(`  - db/${f}`);
}
