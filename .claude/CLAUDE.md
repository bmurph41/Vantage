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
| `marina-map.md` | Property Intelligence Map, Mapbox, geocoding, heat map |
| `marketplace.md` | Sourced deals, scraper listings, Add to Pipeline |
| `entitlements.md` | Feature gating, subscription tiers, UpgradePrompt |
| `frontend-patterns.md` | React conventions, hooks, FM Design System v2, TypeScript |
| `staymate-context.md` | StayMate app — any StayMate work at all |
| `debt-capital-stack.md` | LTV toggle, DSCR timeline, capital stack layers |
| `pl-parser.md` | P&L parsing, pdfjs-dist, alias learning, validation |
| `session-patterns.md` | Debugging flows, journal ritual, env vars, file map |

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

---

## Standing rules — Phase 1 G4 learnings (durable, all projects)

### Verification discipline (added 2026-05-08, durable beyond G4)

These rules emerged from FM Gap G4 Phase 1 and apply to all Vantage and Bookd work going forward.

1. **Verify any DB constraint, index, enum value, or column name against the live DB before referencing it in code or DDL.** Never trust a spec's guess at a name. Pattern:
   - Before any `DROP CONSTRAINT` / `ALTER ... DROP` → `\d <table>` and confirm exact name
   - Before any string match against a constraint name in error handling → `grep -r '<old_name>'` workspace-wide
   - Before any enum value reference → `SELECT enumlabel FROM pg_enum WHERE enumtypid = '<enum>'::regtype`
   - Before any policy reference → query `pg_policies`

2. **When verifying a math invariant, run it through at least one OTHER consumer with a known-good reference. Self-match is not verification. Cross-surface match is.** If you compute the same number two ways using your own logic, you've verified consistency, not correctness. Run the same calculation through a separate code path (a different service, a hand SQL query, a working endpoint) and confirm the numbers agree.

3. **Working-tree audit before every commit.** Always run `git status` before `git add`. Surface anything outside the immediate phase scope explicitly — list it in the articulation block. Decide explicitly what's in and what's out. Don't let unrelated modifications hitchhike on a commit.

4. **Replit auto-commit watch.** Replit auto-commit absorbs file saves into intermediate "Git commit prior to merge" stub commits. Inside long phases, file activity may be captured under the wrong commit message before the intentional commit lands. Mitigation:
   - Smaller sub-phase commits — don't accumulate too many file changes between articulation blocks
   - `git status` checks after major file save bursts
   - Surface auto-commit absorption when it happens; don't treat it as background noise
   - If an auto-commit captures intermediate code, file an intentional follow-up commit immediately to restore correct state

5. **"Found code I don't remember writing" gets surfaced explicitly.** When code is found in the workspace that wasn't part of the active directive, surface its origin (this session, prior session, unknown) before continuing. Don't quietly continue against it. The reflex is `git log --follow --all <path>` — that tells you when the file was created and by whom.

6. **Phase verification gates are non-negotiable.** Every phase's spec test cases get executed against the live DB before commit, even when the code is mechanical or "obviously" correct. Skipping verification because the code looks right is how latent bugs ship. The verify step has caught multiple bugs that tsc-clean code shipped past.

7. **Replacement semantics — line vs NOI direction (G4-specific but cross-applies to financial work).** When working with addbacks anywhere:
   - Line value moves to the replacement
   - NOI moves by the difference
   - For expense lines, the two have OPPOSITE signs
   - `adjustedAmount` is line direction; `adjustmentDelta` is NOI direction
   - Don't conflate them — use the right field for the right consumer

   This pattern (two related values that move in opposite directions for cost categories) shows up anywhere accounting math meets line-item display. The general lesson: name and document direction conventions explicitly at the type level.

### Articulation block format (preserved from existing CLAUDE.md)

Before every commit, write a brief block in chat that includes:
- What's about to commit (files + summary)
- What's NOT in the commit (working-tree items deliberately excluded)
- Verification performed (tsc results, test cases run, numbers matched)
- Any flags or known caveats

This is the surfacing step that the rules above support.
