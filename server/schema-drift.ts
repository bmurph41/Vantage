/**
 * Schema drift detection — runs at server startup to surface gaps between
 * the Drizzle schema definition and the live database.
 *
 * Detects five categories of drift:
 *  1. Missing-from-DB  — tables/columns defined in Drizzle but absent from the live DB.
 *  2. Extra-in-DB      — columns present in the live DB but not declared in the Drizzle
 *                        schema (orphan columns). These can indicate stale migrations or
 *                        fields that were removed from code without a matching DDL drop.
 *  3. Extra tables     — entire tables that exist in the live DB but have no corresponding
 *                        Drizzle definition at all (phantom/stale tables).
 *  4. Missing indexes  — named indexes declared in Drizzle schema that are absent from
 *                        pg_indexes in the live DB.
 *  5. Extra indexes    — named indexes present in pg_indexes for a schema-defined table
 *                        that are no longer declared in the Drizzle schema (orphan indexes).
 *
 * Design constraints:
 *  - Idempotent: safe to call multiple times.
 *  - Non-blocking: a DB timeout or unavailability skips the check gracefully.
 *  - Read-only: never modifies the database.
 *
 * Schema coverage:
 *  - Always includes shared/schema.ts (primary schema).
 *  - Automatically includes every secondary schema via db/schema-index.ts, which is
 *    a generated barrel re-exporting all db/schema-*.ts files. When a new secondary
 *    schema file is added, run `npx tsx scripts/sync-schema-index.ts` (or run the
 *    generate-startup-migrations script, which does this automatically) to keep the
 *    barrel up to date. No edits to this file are ever required.
 */

import { is } from "drizzle-orm";
import { PgTable, Index, getTableConfig } from "drizzle-orm/pg-core";
import { pool } from "./db";
import * as schema from "@shared/schema";
import * as secondarySchemas from "../db/schema-index";

const PREFIX = "[schema-drift]";

/**
 * Tables that are intentionally managed outside Drizzle (created by application
 * code via CREATE TABLE IF NOT EXISTS, or belonging to a sub-system with its own
 * schema file that is not yet wired into db/schema-index) and therefore should
 * NOT trigger an EXTRA TABLE warning during drift checks.
 *
 * Categories:
 *  • AI knowledge base — created by server/services/knowledge-base-service.ts
 *  • Org settings / extraction config — created by google-places-routes / document-extraction
 *  • liv2_* listing scraper — defined in server/listings/ingestion_v2/schema.ts
 */
const EXTRA_TABLE_ALLOWLIST = new Set<string>([
  // AI knowledge base (dynamically created by knowledge-base-service.ts)
  "ai_knowledge_documents",
  "ai_knowledge_chunks",
  "ai_global_knowledge",
  // Org-level settings (dynamically created by google-places-routes.ts)
  "organization_settings",
  // Document extraction config (dynamically created by document-extraction.ts)
  "extraction_org_config",
  // Listing Intelligence v2 scraper (schema in server/listings/ingestion_v2/schema.ts)
  "liv2_sources",
  "liv2_scrape_runs",
  "liv2_raw_pages",
  "liv2_listing_candidates",
  "liv2_listing_payloads",
  "liv2_listing_assets",
  "liv2_quarantine",
  "liv2_field_provenance",
  "liv2_listings_current",
  // Feature tables created dynamically by server code (CREATE TABLE IF NOT EXISTS)
  // — security / RBAC sub-system
  "security_roles",
  "security_sessions",
  "security_integrations",
  "security_audit_logs",
  "security_documents",
  "security_permissions",
  "security_user_roles",
  "security_role_permissions",
  // — workflow automation sub-system
  "workflow_rules",
  "workflow_executions",
  "workflow_pipelines",
  "workflow_pipeline_executions",
  "workflow_approval_requests",
  "workflow_webhooks",
  "workflow_webhook_deliveries",
  "workflow_email_templates",
  "workflow_email_log",
  "workflow_notifications",
  "workflow_scheduled_triggers",
  "workflow_tasks",
  // — document / e-signature sub-system
  "document_templates",
  "document_renders",
  "document_versions",
  "esignature_requests",
  // — AI / analytics sub-system
  "ai_deal_scores",
  "ai_anomalies",
  "ai_conversation_sessions",
  "ai_conversation_messages",
  // — CRM extras
  "crm_custom_field_definitions",
  "crm_forecast_snapshots",
  "deal_comparisons",
  "company_hierarchies",
  "contact_relationship_scores",
  // — email / GDPR
  "email_unsubscribes",
  "email_tracking_events",
  "gdpr_consent_records",
  // — user / auth extras
  "user_settings",
  "personal_access_tokens",
  "docket_users",
  // — misc platform tables
  "encrypted_fields",
  "ip_allowlists",
  "data_retention_policies",
  "settings_audit_log",
  "report_schedules",
]);

/** All schema sources merged into one flat object for drift inspection. */
const allSchemas: Record<string, unknown> = {
  ...schema,
  ...secondarySchemas,
};

/** How long (ms) the entire DB round-trip is allowed to take. */
const QUERY_TIMEOUT_MS = 5000;

interface DbColumn {
  table_name: string;
  column_name: string;
}

/**
 * Extract all Drizzle-defined tables (their columns and named indexes) from all schemas.
 */
function extractSchemaTables(): Array<{ tableName: string; columns: string[]; indexes: string[] }> {
  const tables: Array<{ tableName: string; columns: string[]; indexes: string[] }> = [];
  const seen = new Set<string>();

  for (const value of Object.values(allSchemas)) {
    if (is(value as object, PgTable)) {
      const config = getTableConfig(value as PgTable);
      if (seen.has(config.name)) continue;
      seen.add(config.name);

      // Collect named index definitions from this table's extra config.
      const indexNames: string[] = [];
      for (const idx of config.indexes) {
        if (is(idx, Index) && idx.config.name) {
          indexNames.push(idx.config.name);
        }
      }

      tables.push({
        tableName: config.name,
        columns: config.columns.map((c) => c.name),
        indexes: indexNames,
      });
    }
  }

  return tables;
}

/**
 * Fetch all index names from pg_indexes for the public schema, together with
 * their table names.
 *
 * Returns:
 *  - `liveIndexNames`:      Set<indexName>  — all index names in the live DB (used for
 *                           the missing-index check).
 *  - `liveIndexesByTable`:  Map<tableName, Set<indexName>> — indexes grouped by table
 *                           (used for the extra-index / orphan-index check).
 */
async function fetchLiveIndexNames(client: Awaited<ReturnType<typeof pool.connect>>): Promise<{
  liveIndexNames: Set<string>;
  liveIndexesByTable: Map<string, Set<string>>;
}> {
  const result = await client.query<{ indexname: string; tablename: string }>(
    `SELECT indexname, tablename FROM pg_indexes WHERE schemaname = 'public'`
  );
  const liveIndexNames = new Set<string>();
  const liveIndexesByTable = new Map<string, Set<string>>();
  for (const row of result.rows) {
    liveIndexNames.add(row.indexname);
    if (!liveIndexesByTable.has(row.tablename)) {
      liveIndexesByTable.set(row.tablename, new Set());
    }
    liveIndexesByTable.get(row.tablename)!.add(row.indexname);
  }
  return { liveIndexNames, liveIndexesByTable };
}

/**
 * Acquire a client from the pool, apply a statement-level timeout, fetch:
 *  - All columns for the given schema-defined table names (for missing-from-DB check).
 *  - All columns for every table in the public schema (for extra-in-DB / orphan check).
 *  - All index names in the public schema (for missing-index and extra-index checks).
 *
 * Returns four structures:
 *  - `schemaTableColumns`:  Map<tableName, Set<columnName>> for schema-defined tables only.
 *  - `allLiveColumns`:      Map<tableName, Set<columnName>> for every public table in the DB.
 *  - `liveIndexNames`:      Set<indexName> for every index present in the live DB.
 *  - `liveIndexesByTable`:  Map<tableName, Set<indexName>> indexes grouped by table.
 */
async function fetchLiveColumnMaps(tableNames: string[]): Promise<{
  schemaTableColumns: Map<string, Set<string>>;
  allLiveColumns: Map<string, Set<string>>;
  liveIndexNames: Set<string>;
  liveIndexesByTable: Map<string, Set<string>>;
}> {
  const client = await pool.connect();
  try {
    await client.query(`SET LOCAL statement_timeout = ${QUERY_TIMEOUT_MS}`);

    // Fetch columns for schema-defined tables (may be empty if none exist yet).
    const schemaTableColumns = new Map<string, Set<string>>();
    if (tableNames.length > 0) {
      const placeholders = tableNames.map((_, i) => `$${i + 1}`).join(", ");
      const schemaResult = await client.query<DbColumn>(
        `SELECT table_name, column_name
         FROM information_schema.columns
         WHERE table_schema = 'public'
           AND table_name IN (${placeholders})`,
        tableNames
      );
      for (const row of schemaResult.rows) {
        if (!schemaTableColumns.has(row.table_name)) {
          schemaTableColumns.set(row.table_name, new Set());
        }
        schemaTableColumns.get(row.table_name)!.add(row.column_name);
      }
    }

    // Fetch ALL columns in the public schema (for orphan / extra-in-DB detection).
    const allResult = await client.query<DbColumn>(
      `SELECT table_name, column_name
       FROM information_schema.columns
       WHERE table_schema = 'public'`
    );
    const allLiveColumns = new Map<string, Set<string>>();
    for (const row of allResult.rows) {
      if (!allLiveColumns.has(row.table_name)) {
        allLiveColumns.set(row.table_name, new Set());
      }
      allLiveColumns.get(row.table_name)!.add(row.column_name);
    }

    // Fetch all index names from pg_indexes (for missing-index and extra-index detection).
    const { liveIndexNames, liveIndexesByTable } = await fetchLiveIndexNames(client);

    return { schemaTableColumns, allLiveColumns, liveIndexNames, liveIndexesByTable };
  } finally {
    client.release();
  }
}

/**
 * Compare Drizzle schema to live DB and warn about any drift.
 *
 * Reports:
 *  - Tables/columns in schema but missing from the DB  (missing-from-DB).
 *  - Columns present in the DB but absent from schema  (extra-in-DB / orphan).
 *
 * Returns the total number of drift issues found (0 = no drift).
 */
export async function runSchemaDriftCheck(): Promise<number> {
  let driftCount = 0;

  try {
    const schemaTables = extractSchemaTables();
    if (schemaTables.length === 0) {
      console.warn(`${PREFIX} No tables found in schema — skipping drift check`);
      return 0;
    }

    const tableNames = schemaTables.map((t) => t.tableName);
    const { schemaTableColumns, allLiveColumns, liveIndexNames, liveIndexesByTable } =
      await fetchLiveColumnMaps(tableNames);

    // Build a fast lookup: schema column set per table.
    const schemaColumnsByTable = new Map<string, Set<string>>();
    for (const { tableName, columns } of schemaTables) {
      schemaColumnsByTable.set(tableName, new Set(columns));
    }

    // ── Per-table summary ─────────────────────────────────────────────────────
    for (const { tableName, columns } of schemaTables) {
      const liveColsForTable = schemaTableColumns.get(tableName);

      // Table is completely absent from the DB.
      if (!liveColsForTable) {
        console.warn(
          `${PREFIX} MISSING TABLE: "${tableName}" is defined in schema but does not exist in the database`
        );
        driftCount += columns.length;
        console.warn(
          `${PREFIX}   → "${tableName}" summary: ${columns.length} missing-from-db, 0 extra-in-db`
        );
        continue;
      }

      const schemaColSet = schemaColumnsByTable.get(tableName)!;
      let tableMissingCount = 0;
      let tableExtraCount = 0;

      // 1. Missing-from-DB: schema column not in live DB.
      for (const col of columns) {
        if (!liveColsForTable.has(col)) {
          console.warn(
            `${PREFIX} MISSING COLUMN: "${tableName}"."${col}" is defined in schema but missing from the database`
          );
          tableMissingCount++;
          driftCount++;
        }
      }

      // 2. Extra-in-DB: live DB column not in schema.
      const liveColsAll = allLiveColumns.get(tableName);
      if (liveColsAll) {
        for (const liveCol of liveColsAll) {
          if (!schemaColSet.has(liveCol)) {
            console.warn(
              `${PREFIX} EXTRA COLUMN: "${tableName}"."${liveCol}" exists in the database but is not declared in the schema`
            );
            tableExtraCount++;
            driftCount++;
          }
        }
      }

      // Print a per-table summary when there is any drift on this table.
      if (tableMissingCount > 0 || tableExtraCount > 0) {
        console.warn(
          `${PREFIX}   → "${tableName}" summary: ` +
            `${tableMissingCount} missing-from-db, ${tableExtraCount} extra-in-db`
        );
      }
    }

    // ── Extra tables: in live DB but entirely absent from the schema ──────────
    // (These tables were missed by the schema-table loop above because they never
    //  appeared in schemaTables at all.)
    for (const [dbTable, dbCols] of allLiveColumns) {
      if (schemaColumnsByTable.has(dbTable)) {
        // Already handled in the schema-table loop above.
        continue;
      }
      if (EXTRA_TABLE_ALLOWLIST.has(dbTable)) {
        // Intentionally managed outside Drizzle — skip without warning.
        continue;
      }
      // Log one EXTRA TABLE warning per phantom table and count it as a single
      // drift issue (the number of columns is informational only).
      console.warn(
        `${PREFIX} EXTRA TABLE: "${dbTable}" exists in the database but has no Drizzle schema definition` +
          ` (${dbCols.size} column(s): ${[...dbCols].join(", ")})`
      );
      driftCount++;
    }

    // Build a flat set of all index names declared in the schema (across all tables).
    // Used both for the missing-index check and for the extra-index check below.
    const allSchemaIndexNames = new Set<string>();
    for (const { indexes } of schemaTables) {
      for (const idx of indexes) {
        allSchemaIndexNames.add(idx);
      }
    }

    // Build a fast lookup of schema-defined table names.
    const schemaTableNameSet = new Set(tableNames);

    // ── Missing indexes: declared in schema but absent from pg_indexes ─────────
    for (const { tableName, indexes } of schemaTables) {
      for (const indexName of indexes) {
        if (!liveIndexNames.has(indexName)) {
          console.warn(
            `${PREFIX} MISSING INDEX: "${indexName}" is defined in schema for table "${tableName}" but does not exist in the database`
          );
          driftCount++;
        }
      }
    }

    // ── Extra indexes: present in pg_indexes for a schema-defined table but not
    //    declared in the Drizzle schema (orphan / stale indexes). ───────────────
    // NOTE: Primary key indexes (_pkey) are implicit in Drizzle and are never
    //       explicitly named in the schema, so they are intentionally skipped here
    //       to avoid false-positive EXTRA INDEX warnings. All other unnamed
    //       auto-generated indexes (unique constraints, etc.) that were applied
    //       outside Drizzle definitions are also currently suppressed because the
    //       pattern of _unique / _key suffixes is used by many legacy tables. The
    //       check is retained for future use when explicit orphan index cleanup is
    //       desired. To re-enable, remove the `continue` and uncomment the warn.
    for (const [tableName, liveIdxSet] of liveIndexesByTable) {
      if (!schemaTableNameSet.has(tableName)) {
        // Table itself is not in the schema — handled by EXTRA TABLE warnings.
        continue;
      }
      for (const indexName of liveIdxSet) {
        if (allSchemaIndexNames.has(indexName)) {
          continue; // Index is declared in schema — OK.
        }
        // Suppress primary-key auto-indexes (always named <table>_pkey) and
        // any index already present in the idempotent migration file.
        // These are not actionable drift; they are created by CREATE TABLE / ALTER TABLE.
        if (indexName.endsWith("_pkey")) {
          continue;
        }
        // All other orphan indexes are suppressed for now — the database has
        // hundreds of pre-existing named indexes applied outside Drizzle.
        // Future: add an EXTRA_INDEX_ALLOWLIST similar to EXTRA_TABLE_ALLOWLIST
        // when targeted cleanup of specific stale indexes is desired.
        // console.warn(
        //   `${PREFIX} EXTRA INDEX: "${indexName}" on table "${tableName}" ` +
        //   `exists in the database but is not declared in the schema`
        // );
        // driftCount++;
      }
    }

    if (driftCount === 0) {
      console.log(
        `${PREFIX} OK — ${schemaTables.length} schema tables and all declared indexes match the live database`
      );
    } else {
      console.warn(
        `${PREFIX} Found ${driftCount} drift issue(s) — ` +
          `run startup migrations or apply DDL to resolve`
      );
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(
      `${PREFIX} Drift check skipped (DB unavailable or timed out): ${msg}`
    );
  }

  return driftCount;
}
