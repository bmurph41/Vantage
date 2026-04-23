/**
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
 */

export * from "./schema-accounting";
export * from "./schema-commercial-tenants";
export * from "./schema-lp-portal";

// Shared schemas that live outside db/ but need to be visible to the drift
// checker (server/schema-drift.ts imports db/schema-index to discover all
// table definitions). These must be path-aliased relative to this file.
export * from "../shared/commercial-lease-schema";
export * from "../shared/document-builder/schema";
export * from "../server/listings/ingestion_v2/schema";
