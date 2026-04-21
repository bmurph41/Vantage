---
name: raw-sql-migration
description: Generate and execute a raw SQL migration via the heredoc pattern (the ONLY safe way to migrate RLS-affected tables in this project). Use when adding/altering columns, FKs, indexes, or constraints on any table — especially modeling_project_config, modeling_scenario_versions, crm_pipelines, crm_pipeline_stages, financial_audit_log, distribution_approvals, fund_period_locks, or any table where Drizzle silently returns empty results. NEVER suggest `npm run db:push` — that corrupts production schema.
argument-hint: <description-of-change>
allowed-tools: Bash(node:*), Bash(cat:*), Bash(psql:*), Read, Write
---

# Raw SQL Migration

Generates a heredoc migration script using the canonical pattern from CLAUDE.md, runs it against `DATABASE_URL`, and verifies the change.

## When to use this (vs Drizzle)

ALWAYS use this for:
- Tables listed as RLS-affected in CLAUDE.md
- Any FK constraint change (CASCADE / SET NULL)
- Adding a column with a backfill default
- Index creation/drop
- Anything where you want to inspect intermediate state

NEVER use Drizzle's `db:push` — it corrupts the schema in production. Use Drizzle ORM only for read/write queries on tables WITHOUT RLS.

## Template

Write to `/tmp/migrate-<topic>.mjs` first, then execute. Don't pipe heredocs through Bash directly — multi-line scripts are easier to debug as files:

```bash
cat > /tmp/migrate-<topic>.mjs << 'SCRIPT'
import pg from 'pg';
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

try {
  // 1. Inspect current state (idempotency check)
  const before = await pool.query(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'TABLE_NAME' AND column_name = 'COLUMN_NAME'
  `);
  if (before.rows.length > 0) {
    console.log('Already migrated, skipping:', before.rows);
    process.exit(0);
  }

  // 2. Run the migration in a transaction
  await pool.query('BEGIN');
  await pool.query(`
    ALTER TABLE TABLE_NAME ADD COLUMN COLUMN_NAME TYPE NOT NULL DEFAULT 'value';
  `);

  // 3. Verify
  const after = await pool.query(`
    SELECT column_name, data_type FROM information_schema.columns
    WHERE table_name = 'TABLE_NAME' AND column_name = 'COLUMN_NAME'
  `);
  console.log('Migrated:', after.rows);

  await pool.query('COMMIT');
} catch (e) {
  await pool.query('ROLLBACK');
  console.error('FAILED:', e.message);
  process.exit(1);
} finally {
  await pool.end();
}
SCRIPT

node /tmp/migrate-<topic>.mjs
```

## Required steps

1. **Write to `/tmp/`, not the project tree** — migrations are one-shot, not source code
2. **Always include the idempotency check** at the top (skip if already applied)
3. **Always wrap in `BEGIN/COMMIT/ROLLBACK`** — partial migrations corrupt prod
4. **Verify post-migration** by re-reading `information_schema`
5. **Never use `IF EXISTS / IF NOT EXISTS`** as a substitute for the idempotency check — they hide failures

## After running

- Update `shared/schema.ts` to reflect the new column/table (Drizzle definition, even though we don't use db:push)
- Restart the dev server (use `restart-dev` skill) — schema changes are not picked up live
- Add a journal entry (use `update-journal` skill)

## Test IDs for verification queries

| Resource | ID |
|---|---|
| Test Org | `cd3719c3-ef82-4ccc-acb9-261c80fb64b4` |
| Test Project | `6b3a9021-f393-489d-9274-321ac76eae08` |
