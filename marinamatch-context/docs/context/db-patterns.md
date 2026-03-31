# MarinaMatch — Database Patterns & Rules

## The Single Most Important Rule

**Drizzle ORM silently fails on RLS-enabled tables.**
It returns empty arrays or null with no error. If a query returns unexpected empty results,
switch to raw `pool.query()` immediately — do not spend time debugging the Drizzle query.

---

## RLS-Affected Tables (Always Use raw pool.query)

The following tables have `enableRLS` and must use raw `pool.query()`:

```
modeling_project_config
modeling_scenario_versions
crm_pipelines
crm_pipeline_stages
```

**When in doubt about any table:** run a quick raw query to confirm data exists before
assuming the table is empty.

---

## Raw Pool Query Pattern

### Import
```typescript
import { pool } from '../db'; // adjust path as needed
// pool is a pg.Pool instance
```

### Basic Query
```typescript
const result = await pool.query(
  `SELECT * FROM modeling_project_config WHERE org_id = $1 AND project_id = $2`,
  [orgId, projectId]
);
const rows = result.rows; // always snake_case
```

### Snake_case → camelCase Mapping (Required)
Raw SQL always returns snake_case column names. Always map explicitly:

```typescript
const config = result.rows.map(row => ({
  id: row.id,
  orgId: row.org_id,
  projectId: row.project_id,
  scenarioName: row.scenario_name,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  // ... map every field explicitly
}));
```

**Never assume camelCase from raw queries. Always map.**

### Insert with Returning
```typescript
const result = await pool.query(
  `INSERT INTO workflow_rules (org_id, name, trigger_type, conditions, actions, is_active)
   VALUES ($1, $2, $3, $4, $5, $6)
   RETURNING *`,
  [orgId, name, triggerType, JSON.stringify(conditions), JSON.stringify(actions), true]
);
const newRow = result.rows[0];
```

### Update Pattern
```typescript
const result = await pool.query(
  `UPDATE crm_deals
   SET stage_id = $1, updated_at = NOW()
   WHERE id = $2 AND org_id = $3
   RETURNING *`,
  [stageId, dealId, orgId]
);
```

### Transaction Pattern
```typescript
const client = await pool.connect();
try {
  await client.query('BEGIN');
  await client.query(`INSERT INTO ...`, [...]);
  await client.query(`UPDATE ...`, [...]);
  await client.query('COMMIT');
} catch (err) {
  await client.query('ROLLBACK');
  throw err;
} finally {
  client.release();
}
```

---

## Migration Patterns

### NEVER Use These
```bash
# NEVER — will corrupt production schema
npm run db:push
npx drizzle-kit push
```

### Always Use Raw psql
```bash
# Direct psql migration
psql $DATABASE_URL -c "ALTER TABLE crm_deals ADD COLUMN IF NOT EXISTS close_date DATE;"

# Multi-statement migration
psql $DATABASE_URL << 'SQL'
ALTER TABLE workflow_rules ADD COLUMN IF NOT EXISTS priority INTEGER DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_workflow_rules_org_id ON workflow_rules(org_id);
SQL
```

### Migration Script via Node Heredoc
```bash
node --input-type=module << 'SCRIPT'
import pg from 'pg';
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

try {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS workflow_executions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id UUID NOT NULL,
      rule_id UUID NOT NULL REFERENCES workflow_rules(id),
      trigger_data JSONB,
      status VARCHAR(50) DEFAULT 'pending',
      executed_at TIMESTAMPTZ DEFAULT NOW(),
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  console.log('Migration complete');
} catch (err) {
  console.error('Migration failed:', err);
} finally {
  await pool.end();
}
SCRIPT
```

### Write to /tmp First (for longer scripts)
```bash
cat > /tmp/migrate.mjs << 'SCRIPT'
import pg from 'pg';
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
// migration logic
await pool.end();
SCRIPT
node /tmp/migrate.mjs
```

---

## Schema Conventions

### Standard Columns (all tables should have these)
```sql
id          UUID PRIMARY KEY DEFAULT gen_random_uuid()
org_id      UUID NOT NULL  -- always scope to org
created_at  TIMESTAMPTZ DEFAULT NOW()
updated_at  TIMESTAMPTZ DEFAULT NOW()
```

### Asset Class Storage
Asset classes are stored as `VARCHAR` (not enum). The registry supports 55+ types
across CRE and operating businesses. Never add new asset classes as Postgres enums.

```sql
asset_class VARCHAR(100) -- e.g. 'marina', 'multifamily', 'self_storage'
```

### JSONB for Flexible Config
```sql
conditions  JSONB DEFAULT '[]'
actions     JSONB DEFAULT '[]'
metadata    JSONB DEFAULT '{}'
```

Always validate JSONB before insert. Always `JSON.stringify()` objects before passing as params.

---

## Key Tables Reference

### Modeling / Financial
| Table | Notes |
|---|---|
| `modeling_projects` | Top-level deal/project container |
| `modeling_project_config` | ⚠️ RLS — use pool.query |
| `modeling_scenario_versions` | ⚠️ RLS — use pool.query |
| `pro_forma_inputs` | Pro forma line items |
| `dcf_assumptions` | DCF model inputs |

### CRM
| Table | Notes |
|---|---|
| `crm_contacts` | Individual contacts |
| `crm_companies` | Company/org records |
| `crm_deals` | Deal records |
| `crm_tasks` | Tasks linked to any entity |
| `crm_pipelines` | ⚠️ RLS — use pool.query |
| `crm_pipeline_stages` | ⚠️ RLS — use pool.query |
| `crm_activities` | Activity log (calls, emails, notes) |

### Workflow
| Table | Notes |
|---|---|
| `workflow_rules` | Rule definitions (trigger + conditions + actions) |
| `workflow_executions` | Execution history |
| `workflow_tasks` | Tasks generated by workflow actions |
| `workflow_notifications` | Notifications generated by workflow actions |

### Documents
| Table | Notes |
|---|---|
| `document_templates` | IC Memo / OM template definitions |
| `document_outputs` | Generated document records |

---

## Drizzle — When It's Safe to Use

Drizzle ORM is safe for tables **without** `enableRLS`. Examples of safe tables:
- `users`
- `organizations`
- `document_templates`

If you're unsure whether a table has RLS, test with a raw query first.

---

## Environment Variables

```bash
DATABASE_URL          # PostgreSQL connection string (always available)
OPENAI_API_KEY        # For AI advisor / embeddings
GOOGLE_MAPS_API_KEY   # For geocoding / map features
```

---

## Debugging Checklist

- [ ] Query returns empty but table has data → Switch to `pool.query()`
- [ ] `null` field values in response → Check snake_case mapping
- [ ] Insert fails silently → Check `JSON.stringify()` on JSONB fields
- [ ] Migration causes unexpected behavior → Confirm `db:push` was NOT used
- [ ] `org_id` filter missing → All queries must be scoped to `org_id`
