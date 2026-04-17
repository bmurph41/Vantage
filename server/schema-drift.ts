/**
 * Schema drift detection — runs at server startup to surface gaps between
 * the Drizzle schema definition and the live database.
 *
 * Detects two categories of drift:
 *  1. Missing-from-DB  — tables/columns defined in Drizzle but absent from the live DB.
 *  2. Extra-in-DB      — columns present in the live DB but not declared in the Drizzle
 *                        schema (orphan columns). These can indicate stale migrations or
 *                        fields that were removed from code without a matching DDL drop.
 *
 * Design constraints:
 *  - Idempotent: safe to call multiple times.
 *  - Non-blocking: a DB timeout or unavailability skips the check gracefully.
 *  - Read-only: never modifies the database.
 */

import { is } from "drizzle-orm";
import { PgTable, getTableConfig } from "drizzle-orm/pg-core";
import { pool } from "./db";
import * as schema from "@shared/schema";

const PREFIX = "[schema-drift]";

/** How long (ms) the entire DB round-trip is allowed to take. */
const QUERY_TIMEOUT_MS = 5000;

interface DbColumn {
  table_name: string;
  column_name: string;
}

/**
 * Extract all Drizzle-defined tables (and their columns) from the shared schema.
 */
function extractSchemaTables(): Array<{ tableName: string; columns: string[] }> {
  const tables: Array<{ tableName: string; columns: string[] }> = [];

  for (const value of Object.values(schema)) {
    if (is(value as object, PgTable)) {
      const config = getTableConfig(value as PgTable);
      tables.push({
        tableName: config.name,
        columns: config.columns.map((c) => c.name),
      });
    }
  }

  return tables;
}

/**
 * Acquire a client from the pool, apply a statement-level timeout, fetch:
 *  - All columns for the given schema-defined table names (for missing-from-DB check).
 *  - All columns for every table in the public schema (for extra-in-DB / orphan check).
 *
 * Returns two structures:
 *  - `schemaTableColumns`: Map<tableName, Set<columnName>> for schema-defined tables only.
 *  - `allLiveColumns`:     Map<tableName, Set<columnName>> for every public table in the DB.
 */
async function fetchLiveColumnMaps(tableNames: string[]): Promise<{
  schemaTableColumns: Map<string, Set<string>>;
  allLiveColumns: Map<string, Set<string>>;
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

    return { schemaTableColumns, allLiveColumns };
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
    const { schemaTableColumns, allLiveColumns } = await fetchLiveColumnMaps(tableNames);

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

    // ── Orphan tables: in live DB but entirely absent from the schema ─────────
    // (These tables were missed by the schema-table loop above because they never
    //  appeared in schemaTables at all.)
    for (const [dbTable, dbCols] of allLiveColumns) {
      if (schemaColumnsByTable.has(dbTable)) {
        // Already handled in the schema-table loop above.
        continue;
      }
      // Every column of a fully-orphan table is an extra-in-DB issue.
      for (const dbCol of dbCols) {
        console.warn(
          `${PREFIX} EXTRA COLUMN: "${dbTable}"."${dbCol}" exists in the database but is not declared in the schema`
        );
        driftCount++;
      }
      console.warn(
        `${PREFIX}   → "${dbTable}" summary: 0 missing-from-db, ${dbCols.size} extra-in-db (table has no schema definition)`
      );
    }

    if (driftCount === 0) {
      console.log(
        `${PREFIX} OK — ${schemaTables.length} schema tables match the live database`
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
