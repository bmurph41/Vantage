# MarinaMatch — Claude Code Master Orientation

## READ THIS FIRST — EVERY SESSION

You are working on **MarinaMatch** (also called **Marinalytics**), an institutional-grade
multi-asset commercial real estate investment and management platform.

**Stack:** React/TypeScript frontend · Node.js/Express backend · PostgreSQL with Drizzle ORM
**Environment:** Replit workspace at `~/workspace/`
**Solo developer:** Brett is the lead developer and product owner.

---

## Step 1 — Read the Journal

Before writing any code, always read the canonical session journal:

```bash
cat ~/workspace/MARINAMATCH_JOURNAL.md
```

This file contains the most recent session state, completed work, in-progress items,
known bugs, and next steps. It is the source of truth for where the project stands.
Do not assume anything about current state without reading it first.

---

## Step 2 — Know the Core Rules

These rules are non-negotiable and apply to every session. Violating them causes
hard-to-debug failures.

### Dev Server
```bash
# Kill the dev server (always use this exact command)
pkill -f 'tsx server'

# Restart after killing
npm run dev
```
Never assume the server has restarted after a route or schema change. Always kill and restart explicitly.

### Database — Critical Rules
- **NEVER run `npm run db:push`** — this will corrupt the schema in production
- **NEVER use Drizzle ORM** for tables affected by RLS (Row-Level Security)
- **ALWAYS use raw `pool.query()`** for the following tables (and any table with enableRLS):
  - `modeling_project_config`
  - `modeling_scenario_versions`
  - `crm_pipelines`
  - `crm_pipeline_stages`
  - Any table where Drizzle silently returns empty results
- **Raw SQL returns snake_case** — always map explicitly to camelCase in response objects
- **Schema migrations go through raw psql**, not Drizzle push

### Patching Pattern
For all DB patches and migration scripts, use the heredoc pattern:

```bash
node --input-type=module << 'SCRIPT'
import pg from 'pg';
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
// your migration logic here
await pool.end();
SCRIPT
```

Or write to `/tmp/script.mjs` first:
```bash
cat > /tmp/script.mjs << 'SCRIPT'
// script content
SCRIPT
node /tmp/script.mjs
```

### Test IDs (use these for development and testing)
| Resource | ID |
|---|---|
| Test Organization | `cd3719c3-ef82-4ccc-acb9-261c80fb64b4` |
| Test Project (STR) | `6b3a9021-f393-489d-9274-321ac76eae08` |

---

## Step 3 — Load Relevant Context Docs

Context docs live at `~/workspace/docs/context/`. Load the ones relevant to your current task:

| File | When to load |
|---|---|
| `db-patterns.md` | Any DB work, migrations, schema changes, queries |
| `api-routes.md` | Adding or editing Express routes, middleware, auth |
| `financial-model.md` | DCF, Pro Forma, Monte Carlo, projections, XIRR |
| `crm-components.md` | CRM entities, record pages, pipeline, kanban |
| `document-studio.md` | IC Memo, OM, document templates, PDF/HTML output |
| `workflow-engine.md` | Workflow automation, rules, triggers, actions |
| `ai-advisor.md` | RAG system, embeddings, knowledge base, AI chat |

Load with:
```bash
cat ~/workspace/docs/context/<filename>.md
```

---

## Platform Overview

### What MarinaMatch Is
An institutional-grade CRE investment platform that covers:
- Multi-asset deal sourcing, underwriting, and pipeline management
- Financial modeling: Pro Forma, DCF, Monte Carlo, Exit Strategy
- CRM: contacts, companies, deals, tasks with full relationship tracking
- Document generation: IC Memos, Offering Memoranda
- AI advisor with RAG over deal/market data
- Workflow automation engine
- Marina Property Intelligence Map
- Marketplace of scraped listings

### Asset Class Support
55+ CRE and operating business asset classes stored as `varchar` (migrated away from Postgres enums).
Marina-specific language replaced platform-wide — the platform is now fully asset-class agnostic.

### Style System
- **Colors:** Deep Marine Blue · Maritime Steel · Harbor Teal
- **Typography:** Inter (UI) · Roboto Mono (data/numbers)
- **UI Kit:** MM-UI modal design system (10 core components + wizard pattern)
- **FM Design System v2** for financial model components (CSS layer)

### Auth & Multi-Tenancy
- All data is org-scoped via `org_id`
- RLS is enabled on sensitive tables — use raw `pool.query()` for those
- User context available via `req.user` on authenticated routes

---

## Current Build Priorities

In order — always complete one before moving to the next:

1. ✅ Workflow Automation Engine
2. Deal Timeline / Gantt View
3. Deal Comparison in Workspace
4. Key Dates on Kanban Cards
5. Global Activity Log Polish
6. Email Send Integration

After completing each item, update `MARINAMATCH_JOURNAL.md` with what was done,
what decisions were made, and what comes next.

---

## Common Failure Patterns to Avoid

| Symptom | Root Cause | Fix |
|---|---|---|
| Drizzle query returns `[]` on a populated table | RLS blocking Drizzle | Switch to `pool.query()` |
| Route change has no effect | Server not restarted | `pkill -f 'tsx server' && npm run dev` |
| Schema migration breaks things | Used `db:push` | Always use raw psql migrations |
| `orgId` undefined in query | Field name mismatch | Check `org_id` vs `orgId` in raw SQL vs camelCase layer |
| Pro Forma/DCF returns stale data | Seasonality engine not re-run | Trigger seasonality recalculation |
| Document upload silently fails | Malformed tagged template literal in console.log | Check for `console.log` syntax errors |

---

## Session Wrap-Up Checklist

Before ending any session:
- [ ] Update `MARINAMATCH_JOURNAL.md` with completed work
- [ ] Note any new gotchas or patterns discovered
- [ ] List the exact next steps for the next session
- [ ] Confirm dev server is running cleanly
- [ ] Confirm no TypeScript errors (`npx tsc --noEmit`)
