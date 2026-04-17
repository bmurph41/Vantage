/**
 * Schema drift detection — runs at server startup to surface gaps between
 * the Drizzle schema definition and the live database.
 *
 * Detects four categories of drift:
 *  1. Missing-from-DB  — tables/columns defined in Drizzle but absent from the live DB.
 *  2. Extra-in-DB      — columns present in the live DB but not declared in the Drizzle
 *                        schema (orphan columns). These can indicate stale migrations or
 *                        fields that were removed from code without a matching DDL drop.
 *  3. Extra tables     — entire tables that exist in the live DB but have no corresponding
 *                        Drizzle definition at all (phantom/stale tables).
 *  4. Missing indexes  — named indexes declared in Drizzle schema that are absent from
 *                        pg_indexes in the live DB.
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
 * Fetch all index names from pg_indexes for the public schema.
 * Returns a Set of index names present in the live database.
 */
async function fetchLiveIndexNames(client: Awaited<ReturnType<typeof pool.connect>>): Promise<Set<string>> {
  const result = await client.query<{ indexname: string }>(
    `SELECT indexname FROM pg_indexes WHERE schemaname = 'public'`
  );
  return new Set(result.rows.map((r) => r.indexname));
}

/**
 * Acquire a client from the pool, apply a statement-level timeout, fetch:
 *  - All columns for the given schema-defined table names (for missing-from-DB check).
 *  - All columns for every table in the public schema (for extra-in-DB / orphan check).
 *  - All index names in the public schema (for missing-index check).
 *
 * Returns three structures:
 *  - `schemaTableColumns`: Map<tableName, Set<columnName>> for schema-defined tables only.
 *  - `allLiveColumns`:     Map<tableName, Set<columnName>> for every public table in the DB.
 *  - `liveIndexNames`:     Set<indexName> for every index present in the live DB.
 */
async function fetchLiveColumnMaps(tableNames: string[]): Promise<{
  schemaTableColumns: Map<string, Set<string>>;
  allLiveColumns: Map<string, Set<string>>;
  liveIndexNames: Set<string>;
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

    // Fetch all index names from pg_indexes (for missing-index detection).
    const liveIndexNames = await fetchLiveIndexNames(client);

    return { schemaTableColumns, allLiveColumns, liveIndexNames };
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
    const { schemaTableColumns, allLiveColumns, liveIndexNames } = await fetchLiveColumnMaps(tableNames);

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
      // Log one EXTRA TABLE warning per phantom table and count it as a single
      // drift issue (the number of columns is informational only).
      console.warn(
        `${PREFIX} EXTRA TABLE: "${dbTable}" exists in the database but has no Drizzle schema definition` +
          ` (${dbCols.size} column(s): ${[...dbCols].join(", ")})`
      );
      driftCount++;
    }

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
