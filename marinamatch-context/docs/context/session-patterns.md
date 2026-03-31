# MarinaMatch — Session Patterns & Working Conventions

## The Golden Rule

**Read the journal first. Always.**

```bash
cat ~/workspace/MARINAMATCH_JOURNAL.md
```

Do not write a single line of code until you've read the journal.
The journal tells you what was done, what broke, what was decided, and what comes next.
Starting without it means you'll duplicate work, break conventions, or fix things
that aren't broken.

---

## Session Start Checklist

```bash
# 1. Read the journal
cat ~/workspace/MARINAMATCH_JOURNAL.md

# 2. Confirm the dev server is running
curl http://localhost:5000/api/health

# 3. Load relevant context doc(s) for the task
cat ~/workspace/docs/context/<relevant-doc>.md

# 4. Check TypeScript before touching anything
npx tsc --noEmit
```

---

## Patching Patterns

### Rule: Heredoc First
For any DB migration, data fix, or one-off script — use a heredoc.
Never create files in the workspace just to run them once.

### Pattern A: Inline Heredoc (short scripts)
```bash
node --input-type=module << 'SCRIPT'
import pg from 'pg';
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

// your work here
const result = await pool.query(`SELECT count(*) FROM crm_deals WHERE org_id = $1`, ['cd3719c3-ef82-4ccc-acb9-261c80fb64b4']);
console.log('Deal count:', result.rows[0].count);

await pool.end();
SCRIPT
```

### Pattern B: Write to /tmp (longer scripts)
```bash
cat > /tmp/patch.mjs << 'SCRIPT'
import pg from 'pg';
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  // migration logic
  await pool.query(`ALTER TABLE crm_deals ADD COLUMN IF NOT EXISTS close_date DATE`);
  console.log('Done');
}

run().catch(console.error).finally(() => pool.end());
SCRIPT

node /tmp/patch.mjs
```

### Pattern C: psql for DDL
For schema changes, prefer raw psql:
```bash
psql $DATABASE_URL << 'SQL'
ALTER TABLE crm_deals ADD COLUMN IF NOT EXISTS close_date DATE;
CREATE INDEX IF NOT EXISTS idx_crm_deals_close_date ON crm_deals(close_date);
SQL
```

### Pattern D: Integration Scripts (Replit Shell Deployment)
For larger integrations (e.g. workflow engine deployment), write a Node.js integration
script that can be pasted into the Replit shell and run directly.

---

## Dev Server Pattern

### Kill
```bash
pkill -f 'tsx server'
```

### Restart
```bash
npm run dev
```

### When to Restart (mandatory)
- After adding a new route file
- After changing route registration in index
- After any middleware change
- If a route returns 404 that should exist
- After environment variable changes

### When NOT to Restart (not necessary)
- After editing a React component (Vite HMR handles this)
- After editing pure utility functions not imported by the server

---

## TypeScript Discipline

### Always Check Before Restarting
```bash
npx tsc --noEmit
```

Fix all TypeScript errors before killing and restarting the server.
A clean TypeScript check prevents server crashes from type errors at runtime.

### Error Priority
1. Fix `any` types that hide real bugs
2. Fix missing return types on route handlers
3. Fix interface mismatches between frontend and backend
4. Don't suppress with `@ts-ignore` unless truly unavoidable, and document why

---

## Build Priority Order

Always work in this sequence. Complete one item before moving to the next.
Never start item N+1 while N is partially done.

| # | Feature | Status |
|---|---|---|
| 1 | Workflow Automation Engine | ✅ Complete |
| 2 | Deal Timeline / Gantt View | 🔲 Next |
| 3 | Deal Comparison in Workspace | 🔲 |
| 4 | Key Dates on Kanban Cards | 🔲 |
| 5 | Global Activity Log Polish | 🔲 |
| 6 | Email Send Integration | 🔲 |

After the above, the broader roadmap continues with:
- Billing Engine (Stripe)
- Deal Timeline / Gantt
- Feature gating activation (billing prerequisite)
- StayMate Phase 1 features

---

## Journal Update Ritual

At the end of every session, update `MARINAMATCH_JOURNAL.md` with:

```markdown
## Session: [Date]

### Completed
- [specific things done, with file names]

### Decisions Made
- [architectural or product decisions, with rationale]

### New Gotchas / Patterns
- [anything that tripped you up or a new pattern discovered]

### Exact Next Steps
- [ ] First thing to do next session (be specific — include file names)
- [ ] Second thing
- [ ] ...
```

**Be specific.** "Fixed CRM bug" is useless. "Fixed `pool.query` on `crm_pipeline_stages` 
returning empty — was using Drizzle, switched to raw query in `crm-routes.ts:148`" is useful.

---

## Test IDs (Memorize These)

```
Test Org:     cd3719c3-ef82-4ccc-acb9-261c80fb64b4
Test Project: 6b3a9021-f393-489d-9274-321ac76eae08  (STR type)
```

Use these for all development and testing queries.
Never create new test orgs/projects unless you document them in the journal.

---

## Common Debugging Flows

### "My route returns 404"
1. Check: did you register the route in the central routes file?
2. Check: did you kill and restart the server after adding it?
3. Check: is the URL path exactly matching (trailing slash, casing)?

### "Query returns empty but DB has data"
1. Check: is this a RLS-affected table? → switch to `pool.query()`
2. Check: is `org_id` filter correct? (camelCase in code, snake_case in SQL)
3. Run a raw query in psql to confirm data exists

### "TypeScript error I don't understand"
1. `npx tsc --noEmit 2>&1 | head -50` — see full error context
2. Check if it's a missing type import
3. Check if it's a snake_case vs camelCase mismatch in the type definition
4. Don't `@ts-ignore` — understand and fix it

### "Upload silently fails"
1. Check all `console.log` statements in the upload handler chain
2. Look for tagged template literal syntax errors: `` console.log(`value: ${thing}`) ``
3. Check multer middleware is applied to the route

### "Pro Forma / DCF returns stale data"
1. Trigger seasonality recalculation
2. Check if `modeling_project_config` is being queried with Drizzle (switch to `pool.query()`)
3. Confirm correct `project_id` is being used (use test project ID above)

---

## Environment Variable Reference

```bash
DATABASE_URL                # PostgreSQL connection string
OPENAI_API_KEY              # OpenAI (embeddings + GPT-4o)
GOOGLE_MAPS_API_KEY         # Geocoding
VITE_MAPBOX_TOKEN           # Mapbox (client-side)
CENSUS_API_KEY              # Census ACS data

# StayMate integrations (when active)
HOSTAWAY_ACCOUNT_ID
HOSTAWAY_API_KEY
TWILIO_ACCOUNT_SID
TWILIO_AUTH_TOKEN
TWILIO_VERIFY_SERVICE_SID
SENDGRID_API_KEY
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
PRICELABS_API_KEY
```

---

## File Naming & Location Reference

```
~/workspace/
├── MARINAMATCH_JOURNAL.md              ← READ FIRST every session
├── STAYMATE_SPEC.md                    ← StayMate architectural spec
├── STAYMATE_FEATURE_BUILD_PLAN.md      ← StayMate feature priority list
├── CLAUDE_CODE_MASTER_PROMPT.md        ← Full 899-line master build prompt
├── .claude/
│   └── CLAUDE.md                       ← Auto-read by Claude Code
└── docs/context/
    ├── db-patterns.md
    ├── api-routes.md
    ├── financial-model.md
    ├── crm-components.md
    ├── document-studio.md
    ├── workflow-engine.md
    ├── ai-advisor.md
    ├── marina-map.md
    ├── marketplace.md
    ├── entitlements.md
    ├── frontend-patterns.md
    ├── staymate-context.md
    ├── debt-capital-stack.md
    ├── pl-parser.md
    └── session-patterns.md             ← this file
```
