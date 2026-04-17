/**
 * Unit tests for server/schema-drift.ts
 *
 * All external dependencies (DB pool, Drizzle schemas) are mocked so the
 * tests run without a real database and with a controlled, minimal schema.
 *
 * Schema under test has ONE table: "test_users" with columns: id, name, email.
 */

import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";

// ── Mocks (hoisted before module imports) ────────────────────────────────────

// vi.hoisted ensures these variables are initialised before vi.mock factories
// run (vi.mock calls are hoisted to the top of the file by Vitest).
const { mockQuery, mockRelease, mockConnect } = vi.hoisted(() => ({
  mockQuery: vi.fn(),
  mockRelease: vi.fn(),
  mockConnect: vi.fn(),
}));

// Provide a minimal, deterministic schema so extractSchemaTables() returns
// exactly one table ("test_users") with three columns (id, name, email).
vi.mock("@shared/schema", async () => {
  const { pgTable, integer, text } = await import("drizzle-orm/pg-core");
  return {
    testUsers: pgTable("test_users", {
      id: integer("id"),
      name: text("name"),
      email: text("email"),
    }),
  };
});

// The commercial tenants schema contributes no tables to this test run.
vi.mock("../db/schema-commercial-tenants", () => ({}));

vi.mock("./db", () => ({
  pool: { connect: mockConnect },
}));

// ── Module under test (imported AFTER mocks are registered) ──────────────────
import { runSchemaDriftCheck } from "./schema-drift";

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Build a row array for information_schema.columns queries. */
function dbRows(pairs: Array<[string, string]>) {
  return pairs.map(([table_name, column_name]) => ({ table_name, column_name }));
}

/**
 * Wire mockQuery for the three queries issued by fetchLiveColumnMaps():
 *   1. SET LOCAL statement_timeout  → no rows
 *   2. Schema-filtered columns      → schemaRows
 *   3. All public columns           → allRows
 */
function setupQueryMock(
  schemaRows: Array<[string, string]>,
  allRows: Array<[string, string]>
) {
  mockQuery
    .mockResolvedValueOnce({ rows: [] })                    // SET LOCAL timeout
    .mockResolvedValueOnce({ rows: dbRows(schemaRows) })    // schema-table query
    .mockResolvedValueOnce({ rows: dbRows(allRows) });      // all-public query
}

// ── Test suite ───────────────────────────────────────────────────────────────

describe("runSchemaDriftCheck", () => {
  beforeEach(() => {
    mockConnect.mockResolvedValue({ query: mockQuery, release: mockRelease });
    mockRelease.mockResolvedValue(undefined);
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ── OK path ────────────────────────────────────────────────────────────────

  it("returns 0 when schema and live DB are perfectly aligned", async () => {
    const aligned: Array<[string, string]> = [
      ["test_users", "id"],
      ["test_users", "name"],
      ["test_users", "email"],
    ];
    setupQueryMock(aligned, aligned);

    const count = await runSchemaDriftCheck();

    expect(count).toBe(0);
    expect(console.warn).not.toHaveBeenCalledWith(
      expect.stringContaining("MISSING")
    );
    expect(console.warn).not.toHaveBeenCalledWith(
      expect.stringContaining("EXTRA")
    );
  });

  // ── Missing-column path ────────────────────────────────────────────────────

  it("detects MISSING COLUMN and returns correct drift count", async () => {
    // DB has id + name but is missing email.
    const dbHas: Array<[string, string]> = [
      ["test_users", "id"],
      ["test_users", "name"],
    ];
    setupQueryMock(dbHas, dbHas);

    const count = await runSchemaDriftCheck();

    expect(count).toBe(1);

    const warnCalls = (console.warn as ReturnType<typeof vi.spyOn>).mock.calls
      .map((args) => args[0] as string);
    expect(warnCalls.some((m) => m.includes("MISSING COLUMN") && m.includes('"email"'))).toBe(true);
  });

  it("counts multiple missing columns correctly", async () => {
    // DB has only id; name and email are missing.
    const dbHas: Array<[string, string]> = [["test_users", "id"]];
    setupQueryMock(dbHas, dbHas);

    const count = await runSchemaDriftCheck();

    expect(count).toBe(2);
  });

  // ── Extra-column path ──────────────────────────────────────────────────────

  it("detects EXTRA COLUMN (orphan in DB) and returns correct drift count", async () => {
    const schemaFiltered: Array<[string, string]> = [
      ["test_users", "id"],
      ["test_users", "name"],
      ["test_users", "email"],
      ["test_users", "orphan_col"],   // extra column not in schema
    ];
    const allPublic = schemaFiltered;
    setupQueryMock(schemaFiltered, allPublic);

    const count = await runSchemaDriftCheck();

    expect(count).toBe(1);

    const warnCalls = (console.warn as ReturnType<typeof vi.spyOn>).mock.calls
      .map((args) => args[0] as string);
    expect(
      warnCalls.some((m) => m.includes("EXTRA COLUMN") && m.includes('"orphan_col"'))
    ).toBe(true);
  });

  it("counts multiple extra columns correctly", async () => {
    const dbCols: Array<[string, string]> = [
      ["test_users", "id"],
      ["test_users", "name"],
      ["test_users", "email"],
      ["test_users", "extra1"],
      ["test_users", "extra2"],
    ];
    setupQueryMock(dbCols, dbCols);

    const count = await runSchemaDriftCheck();

    expect(count).toBe(2);
  });

  // ── Missing-table path ─────────────────────────────────────────────────────

  it("detects MISSING TABLE and counts all its columns as drift", async () => {
    // Schema-filtered query returns nothing (table doesn't exist).
    // All-public query also returns nothing.
    setupQueryMock([], []);

    const count = await runSchemaDriftCheck();

    // test_users has 3 columns (id, name, email) → drift count = 3.
    expect(count).toBe(3);

    const warnCalls = (console.warn as ReturnType<typeof vi.spyOn>).mock.calls
      .map((args) => args[0] as string);
    expect(
      warnCalls.some((m) => m.includes("MISSING TABLE") && m.includes('"test_users"'))
    ).toBe(true);
  });

  // ── Orphan table in DB (not in schema at all) ──────────────────────────────

  it("counts columns from a DB table that has no schema definition as extra-in-db", async () => {
    const aligned: Array<[string, string]> = [
      ["test_users", "id"],
      ["test_users", "name"],
      ["test_users", "email"],
    ];
    const allPublicWithOrphan: Array<[string, string]> = [
      ...aligned,
      ["orphan_table", "col_a"],
      ["orphan_table", "col_b"],
    ];
    setupQueryMock(aligned, allPublicWithOrphan);

    const count = await runSchemaDriftCheck();

    // 2 extra columns from orphan_table.
    expect(count).toBe(2);

    const warnCalls = (console.warn as ReturnType<typeof vi.spyOn>).mock.calls
      .map((args) => args[0] as string);
    expect(
      warnCalls.some((m) => m.includes("EXTRA COLUMN") && m.includes('"orphan_table"'))
    ).toBe(true);
  });

  // ── Combined drift ─────────────────────────────────────────────────────────

  it("accumulates drift count when both missing and extra columns are present", async () => {
    // DB is missing email, and has an extra orphan_col.
    const schemaFiltered: Array<[string, string]> = [
      ["test_users", "id"],
      ["test_users", "name"],
      // email is absent
      ["test_users", "orphan_col"],
    ];
    const allPublic = schemaFiltered;
    setupQueryMock(schemaFiltered, allPublic);

    const count = await runSchemaDriftCheck();

    // 1 missing (email) + 1 extra (orphan_col) = 2.
    expect(count).toBe(2);
  });

  // ── DB unavailability / timeout ────────────────────────────────────────────

  it("returns 0 and does not throw when pool.connect() rejects (DB unavailable)", async () => {
    mockConnect.mockRejectedValue(new Error("Connection refused"));

    await expect(runSchemaDriftCheck()).resolves.toBe(0);

    const warnCalls = (console.warn as ReturnType<typeof vi.spyOn>).mock.calls
      .map((args) => args[0] as string);
    expect(
      warnCalls.some((m) => m.includes("Drift check skipped"))
    ).toBe(true);
  });

  it("returns 0 and does not throw when a query times out", async () => {
    mockConnect.mockResolvedValue({ query: mockQuery, release: mockRelease });
    mockQuery.mockRejectedValue(new Error("canceling statement due to statement timeout"));

    await expect(runSchemaDriftCheck()).resolves.toBe(0);

    const warnCalls = (console.warn as ReturnType<typeof vi.spyOn>).mock.calls
      .map((args) => args[0] as string);
    expect(
      warnCalls.some((m) => m.includes("Drift check skipped"))
    ).toBe(true);
  });

  it("still releases the DB client even when a query throws", async () => {
    mockConnect.mockResolvedValue({ query: mockQuery, release: mockRelease });
    // First call (SET LOCAL) succeeds; second call throws.
    mockQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockRejectedValueOnce(new Error("query error"));

    await runSchemaDriftCheck();

    expect(mockRelease).toHaveBeenCalledTimes(1);
  });
});
