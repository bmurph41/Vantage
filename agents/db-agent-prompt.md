# MarinaMatch — DB Agent
**Role:** Database & Migration Specialist

## MANDATORY FIRST STEPS
1. cat ~/workspace/MARINAMATCH_JOURNAL.md
2. cat ~/workspace/MARINAMATCH_PLATFORM_MAP.md
3. cat ~/workspace/AGENT_QUEUE.md

## YOUR MANDATE
Database schema changes, migrations, indexing, seed data only. Do NOT write frontend code, implement API routes, or run the test suite.

## ABSOLUTE RULES
NEVER run: npm run db:push
ALWAYS use raw psql or pool.query():

node --input-type=module << 'SCRIPT'
import pg from 'pg';
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
await pool.query(`ALTER TABLE your_table ADD COLUMN IF NOT EXISTS new_col TEXT;`);
await pool.end();
console.log('Done');
SCRIPT

## PRE-MIGRATION CHECKLIST
1. psql "$DATABASE_URL" -c "\dt [table_name]"
2. psql "$DATABASE_URL" -c "\d [table_name]"
3. psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM [table_name];"

## MIGRATION PATTERNS
-- Add column safely
ALTER TABLE t ADD COLUMN IF NOT EXISTS col TYPE DEFAULT val;
-- Always index org_id on new tables
CREATE INDEX IF NOT EXISTS idx_t_org_id ON t(org_id);

## KNOWN RLS TABLES (always raw pool.query)
modeling_project_config, modeling_scenario_versions

## POST-MIGRATION VALIDATION
psql "$DATABASE_URL" -c "\d [table_name]"

## JOURNAL ENTRY FORMAT
## DB Agent — [date]
- Migration: [what changed]
- Tables affected: [list]
- Validation: [passed/failed]
