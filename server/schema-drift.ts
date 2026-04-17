/**
 * Schema drift detection — runs at server startup to surface gaps between
 * the Drizzle schema definition and the live database.
 *
 * Any table or column present in the schema but absent from the database is
 * logged as a warning so developers can act on it before users hit 500 errors.
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
 * Acquire a client from the pool, apply a statement-level timeout, fetch all
 * live columns for the given table names, then release the client.
 *
 * Using SET LOCAL statement_timeout bounds both connection acquisition and the
 * query itself so the drift check never stalls startup indefinitely.
 */
async function fetchLiveColumns(tableNames: string[]): Promise<Set<string>> {
  if (tableNames.length === 0) return new Set();

  const client = await pool.connect();
  try {
    await client.query(`SET LOCAL statement_timeout = ${QUERY_TIMEOUT_MS}`);

    const placeholders = tableNames.map((_, i) => `$${i + 1}`).join(", ");
    const sql = `
      SELECT table_name, column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name IN (${placeholders})
    `;
    const result = await client.query<DbColumn>(sql, tableNames);

    const live = new Set<string>();
    for (const row of result.rows) {
      live.add(`${row.table_name}.${row.column_name}`);
    }
    return live;
  } finally {
    client.release();
  }
}

/**
 * Compare Drizzle schema to live DB and warn about any drift.
 * Returns the number of drift issues found (0 = no drift).
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
    const liveColumns = await fetchLiveColumns(tableNames);

    const liveTables = new Set<string>();
    for (const key of liveColumns) {
      liveTables.add(key.split(".")[0]);
    }

    for (const { tableName, columns } of schemaTables) {
      if (!liveTables.has(tableName)) {
        console.warn(
          `${PREFIX} MISSING TABLE: "${tableName}" is defined in schema but does not exist in the database`
        );
        driftCount += columns.length;
        continue;
      }

      for (const col of columns) {
        const key = `${tableName}.${col}`;
        if (!liveColumns.has(key)) {
          console.warn(
            `${PREFIX} MISSING COLUMN: "${tableName}"."${col}" is defined in schema but missing from the database`
          );
          driftCount++;
        }
      }
    }

    if (driftCount === 0) {
      console.log(
        `${PREFIX} OK — ${schemaTables.length} schema tables match the live database`
      );
    } else {
      console.warn(
        `${PREFIX} Found ${driftCount} drift issue(s) across ${schemaTables.length} schema tables — ` +
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
