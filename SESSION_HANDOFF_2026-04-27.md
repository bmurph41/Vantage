# Session Handoff — 2026-04-27

This document is the handoff context for picking up Vantage development in a new Claude chat. It covers what was accomplished in the 2026-04-25 → 2026-04-27 session stretch, current platform state, and what's queued next.

---

## TL;DR

**Real work shipped today:**
- 3 actual security vulnerabilities fixed (1 SQL injection, 4 capital-account race conditions)
- 1 silently-broken function (createDraft) restored to working state
- ROUTE_TENANT_AUDIT.md created — 290-line ground-truth tenant-isolation audit
- VANTAGE_PRIORITY_QUEUE.md created — 53-item flat sequenced backlog, ~300h to beta-ready
- 9 stale audit items bookkept (originally believed broken; verified already fixed)
- 3 beta-blocker items captured (C17, C18, C19); C18 fixed by Replit Agent, C19 ~80% done
- Portfolio surface modernized across 8 commits earlier in session

**Next up:** A13 (demo auth gating, ~30 min) → C17 (asset class entitlement gating, ~90-120 min).

---

## Operator: Brett Murphy

Solo developer building Vantage (institutional CRE platform, 55 asset classes). Pre-revenue, bootstrapped, no customers yet. Self-testing the platform with a beta-tester mindset. Committed to NOT taking real client traffic until Phase A (Tier 0 security) ships.

Also operates Bookd (STR PMS), STR portfolio in Palm Harbor FL, evaluating Pinellas cleaning business acquisition. Vantage is the current focus.

## Repo and Environment

- **Repo:** github.com/bmurph41/MMTest
- **Production URL:** https://due-diligence-crm-sales-comps-fuel--brettmurphy41.replit.app
- **Production DB:** Neon Postgres (ep-frosty-lab-adc9nwgg-pooler.c-2.us-east-1.aws.neon.tech), user `neondb_owner`. Same DATABASE_URL in dev shell as production.
- **Deploy:** Replit Autoscale, manual Republish (NOT auto on push)
- **Workspace root:** `~/workspace`
- **Journal:** `~/workspace/MARINAMATCH_JOURNAL.md` (always `cat` at session start)
- **Test org:** `cd3719c3-ef82-4ccc-acb9-261c80fb64b4` (Southern Marinas)
- **Test project:** `6b3a9021-f393-489d-9274-321ac76eae08`

## Standing Codebase Rules

- NEVER `npm run db:push`
- Use raw `pool.query()` for `modelingProjectConfig` and `modelingScenarioVersions` (RLS tables); Drizzle elsewhere
- All API routes prefixed `/api/v1/` (Bookd) — Vantage uses both `/api/...` and `/api/v1/...`
- ESM imports use `.js` extensions
- Auth pattern in Bookd: `req.currentHost` (not `req.user`); Vantage uses `req.user`
- `orgId` required on every service function (no Postgres RLS — JS-level enforcement)
- TypeScript baseline: 824 errors. Every change must preserve that count exactly.
- 7 tests in `server/schema-drift.test.ts` fail pre-existing (vi.mock hoisting issue) — known, not blocking
- CI on main has been red since at least 19cff6f2; Replit Republish uses separate pipeline that passes
- Server requires manual restart after `routes.ts` changes

## Quad Agent System

Replit Agent runs autonomously alongside development sessions. The agent reads `AGENT_QUEUE.md` and ships commits while you work. Agent commits this session: `c042e511`, `e483e0f5`, `82e33cd3`, `86886b35`, `dfa8c2d0`, `02a7bc7d`, `5a8cdc58`, `e1ac4ffb`, `035164b9`, `be92afe2`, `03498d3f`, `958522be`. The agent fixed C18 independently while we worked SEV-1.

When checking working tree state, expect agent commits may have shipped between sessions. Always `git pull origin main` first.

---

## What Shipped Today

### Security Work (the main thread)

**A1 — Dead code cleanup in security-compliance-service.ts** (commit `5e06946d`)
- Original SQL injection had been fixed in commit `c4d4f1e9` (2026-04-16)
- 28 lines of misleading dead code (conditions[], params[], whereClause variables that were built but never used) removed
- Audit item closed with verification note

**A2-A8 bookkeeping** (commits `0e23e601`, `17692444`)
- 7 Tier 0 items verified stale: SQL injection in accounting-engine.ts, external-routes.ts, storage.ts, crm-enhancements.ts; orgId filters in fund-management-routes.ts (PUT, DELETE, capital accounts)
- All had been fixed in `c4d4f1e9` but never marked done in backlog
- Verification methodology: `grep -n 'sql\.raw' [file]` and inspection of cited line numbers
- Pattern observation: original audit dated 2026-04-14 was 50%+ stale across Tier 0

**A9-1 — Comprehensive route+service tenant-isolation audit** (commit `02a7bc7d`)
- Produced ROUTE_TENANT_AUDIT.md (290 lines)
- Hybrid methodology: pattern scan across 159 route files + 176 service files (1,077 candidates flagged), plus line-level audit of 5 named files
- Org-scoped tables: 620 direct + 155 platform/indirect = 775 total in shared/schema.ts
- SEV-1 finding: SQL injection in distribution-approval-service.ts (3 sites)
- SEV-2 finding: Post-fetch orgId checks in fund-management-routes.ts capital-account routes (5 sites listed; investigation showed 3 real, 2 false-positives, 1 missed)
- SEV-3 finding: 8 high-flag-count files needing manual triage (~145 candidates total, 20-40% likely real)

**A9-2 Phase 1 — SEV-1 SQL injection fix** (commit `035164b9`, agent-bundled)
- All 4 sites in distribution-approval-service.ts converted to parameterized Drizzle sql template
- createDraft INSERT had been silently broken (placeholders without values array) — function now actually persists data
- updateDraft hand-rolled `.replace(/'/g, "''")` quote-escaping deleted (unnecessary with proper parameterization)
- listDrafts conditional statusFilter replaced with `sql\`AND status = ${status}\`` fragment-or-empty pattern
- All `as any` casts removed from SQL paths

**A9-2 Phase 2 — SEV-2 race condition fix** (just shipped)
- 4 capital-account routes refactored to Pattern B (atomic JOIN through fundsV2)
- Original audit listed 5 sites: L263 and L296 turned out to be false-positives (already used parent-validation correctly); L324, L354, L394 were real; L461 was a missed-by-audit site found during sweep
- All 4 real sites fixed with single atomic query: `db.select(...).from(capitalAccounts).innerJoin(fundsV2, ...).where(and(eq(capitalAccounts.id, ...), eq(fundsV2.orgId, orgId)))`
- Net -17 LOC across the file

**A10 verified clean** (during A9-1 audit)
- distribution-approval-service.ts execute() already wraps in db.transaction()
- Marked done with verification note

### Backlog Establishment

**VANTAGE_PRIORITY_QUEUE.md created** (commit `8e68a857`)
- 53 items, ~300 hours to beta-ready
- Phase A (12 items, 44h) — Tier 0 security showstoppers
- Phase B (15 items, 108h) — Tier 0.5 institutional gates (zod validation, decimal.js migration, ledger-based capital accounts, FK cascade audit, PII encryption)
- Phase C (19 items, 92.5h to-go after C18 done) — beta-flow must-ship
- Phase D (7 items, 56h) — Tier 1 active priorities (Email Send Integration, Google Maps API, Document Studio components)
- Phase E (60+ items, not estimated) — post-beta visibility

### Beta-Blocker Discovery

**C17 — Asset class entitlement gating** (added to backlog, NOT YET STARTED)
- Surfaced when clicking "Create Project" in Financial Model wizard
- Desired: asset classes not in user's subscription tier should be visually grayed out + disabled with tooltip/upgrade CTA
- Effort: M (depends on whether entitlements infrastructure already exposes tier→asset-classes mapping)
- Pattern available from agent commit `03498d3f` (RequireRole, hasRole from useAuth, sidebar nav filtering)

**C18 — Fix New Deal button** (DONE via agent commit `5a8cdc58`)
- Root cause: DealFormModal in `client/src/pages/deal-workspace.tsx` was being passed prop names `open`/`onOpenChange` but component expected `isOpen`/`onClose`
- 2-line fix: modal never opened on button click due to React prop mismatch
- Wizard flow itself was already built and working

**C19 — Asset-class-aware Financial Model wizard** (PARTIAL via agent commit `035164b9`)
- ~80% of visible UX shipped: de-marina'd labels, generic Quick Start templates, conditional marina-only sections
- STILL PENDING: ASSET_REGISTRY-driven field configuration; integration with shared/asset-class-model-config.ts (part of 824 baseline); removal of redundant Ownership section; verification that wizard correctly populates Modeling Project + linked CRM Deal + CRM Property records

### Earlier Session Work (Friday afternoon → Monday morning)

**Portfolio surface modernization** (8 commits)
- Phase 2A: asset_status enum 3→10, hold_strategy enum 3→7, dead sidebar link fix (`13d9daa5`)
- Phase 2B: /api/portfolio/summary triple-registration cleanup (`77f7b469`)
- Phase 3A: ownedAssets.assetClass + modelingProjectId columns, ASSET_REGISTRY extracted to client/src/lib/asset-registry.ts
- Phase 3B: Asset-class-aware modal with Linked/Manual mode toggle, dynamic labels, CurrencyInput helper, 3-stream revenue breakdown (`01f66c2a`)
- Phase 3C-Lite: Marina-language sweep (`c0f07ed3`, 7 strings)
- Phase 3C-2-narrow: File renames MarinaModal→AssetModal, MarinaDetail→AssetDetail, OwnedMarinas→OwnedAssets (`5f6ece21`, git mv preserved history)
- Cleanup: deleted dead OwnedAssets.tsx page (487 lines), parseInt NaN guard on acquisitionPrice (`c841dc26`)

**Strategic triage documents created**
- PORTFOLIO_INVENTORY.md (522 lines)
- PORTFOLIO_TRIAGE.md (276 lines, 14 findings; #7/#8/#12/#1/#11 resolved)

---

## Current Platform State

### Phase A — Tier 0 Security (12 items, mostly closed)

| Item | Status | Notes |
|---|---|---|
| A1 | ✅ Done | Dead code cleanup; original vuln pre-fixed |
| A2 | ✅ Done | accounting-engine.ts; verified stale |
| A3 | ✅ Done | external-routes.ts; verified stale |
| A4 | ✅ Done | storage.ts; verified stale |
| A5 | ✅ Done | crm-enhancements.ts; verified stale |
| A6 | ✅ Done | fund-deals PUT routes; deleted entirely |
| A7 | ✅ Done | fund-deals DELETE routes; deleted entirely |
| A8 | ✅ Done | capital account endpoints; original cited lines wrong |
| A9-1 | ✅ Done | Audit document produced |
| A9-2 Phase 1 | ✅ Done | SEV-1 SQL injection fixed |
| A9-2 Phase 2 | ✅ Done | SEV-2 race conditions fixed |
| A9-2 Phase 3 | ❌ Todo | SEV-3 manual triage of 8 high-flag T1 files (XL effort) |
| A10 | ✅ Done | Verified clean during A9-1 |
| A11 | ❌ Todo | Wrap fund distribution + capital call + preferred return in db.transaction() (4 sub-items) |
| A12 | ❌ Todo | Comprehensive transaction-safety audit |
| A13 | ❌ Todo | Demo auth gating behind ALLOW_DEMO_AUTH env var |

### Phase A remaining real work

- **A13** (demo auth gating) — ~30 min
- **A11** (transaction wrapping in fund-service.ts and others) — likely much of A11 is also stale-by-fix; verify first
- **A12** (transaction safety audit) — produces a document like A9-1 did
- **A9-2 Phase 3** (SEV-3 triage) — 4-12 hours, depends on real-vuln rate

### Phase C — Beta-Flow Must-Ship (19 items, 1 done, 92.5h remaining)

Recent additions and updates:
- **C17** Asset class entitlement gating — todo, beta-blocker
- **C18** Fix New Deal button — ✅ done by agent
- **C19** Asset-class-aware Financial Model wizard — 🔄 partial (UX layer done, deeper integration pending)

Other Phase C items: AI Advisor frontend + system prompt + entity injection (C1-C3); keyMetrics fallback consolidation (C4); asset-class-breakdown reads owned_assets not modeling_projects (C5); Performance/Financials tabs as proper components (C6); assetPerformanceSnapshots reader UI (C7); latent Content-Type bug (C8); asset-shape-specific terms cleanup (C9); MarinaMapEmbed Marina-language sweep (C10); Portfolio surface basic test coverage (C11); CI fix (C12); Deal Comparison workspace activation (C13); embedded financial summary in workspace Financials tab (C14); DD Findings Panel wired (C15); fix automation rules never executing on Kanban stage change (C16).

---

## Key Documents (read first if joining mid-stream)

- `MARINAMATCH_JOURNAL.md` — running session journal
- `VANTAGE_PRIORITY_QUEUE.md` — flat sequenced backlog (Phase A through E)
- `AGENT_QUEUE.md` — Tier-organized canonical agent backlog (Tier 0 through Tier 14)
- `ROUTE_TENANT_AUDIT.md` — 290-line tenant-isolation audit (✅ SEV-1 fixed, ✅ SEV-2 fixed, SEV-3 pending)

## Pre-existing Tech Debt (tracked, not blocking)

- 824 TypeScript baseline errors. Every commit must preserve exactly.
- 7 schema-drift tests fail pre-existing (vi.mock hoisting issue)
- CI on main has been red since 19cff6f2 (Replit Republish uses separate passing pipeline)
- ~322 URL-first apiRequest callers don't set Content-Type header (latent bug)
- AI Advisor frontend has vanishing-stream + data-dump-vs-advisor-behavior bugs (backend works)
- shared/asset-class-model-config.ts is part of the 824 baseline; needs cleanup as part of C19 final push

## Environmental Quirks

- Brett's terminal renders filenames with markdown auto-link artifacts: `[QUEUE.md](http://QUEUE.md)`. Git operations succeed underneath; cosmetic only.
- Replit Agent ships parallel commits that may bundle other working-tree files into single commits. After agent activity, working tree may show empty even when you expected pending changes — they got swept into the agent commit.
- After every commit, `db/schema-index.ts` and `.claude/settings.local.json` may show as modified pre-existing dirty state. Use `git checkout` to revert before staging.

---

## Operating Pattern That's Worked Well

For security work specifically:

1. **Diagnose before drafting fix prompts.** Run grep/sed to verify current state of audit-flagged files. Pattern of stale audits: 9 of 11 Tier 0 items today were verified stale.
2. **Substep-gated execution.** Multi-step Claude Code prompts that pause for review between substeps. Hard verification gates (typecheck preserved, build succeeds, no errors in target file) at every substep.
3. **Don't fix things in scope-creep mode.** If sweep finds new vulnerabilities, document them — only bundle into current commit if structurally identical to current fix (same file, same pattern, same fix shape).
4. **Verify the audit doc reflects ground truth.** Update with status changes (🔴 → ✅) and triage history (false positives, missed sites).

For backlog work:

1. **Document all parallel agent activity.** When Replit Agent ships work, reconcile against backlog. Agent's commits sometimes solve our items; sometimes overlap.
2. **Mark stale items done with verification notes.** Don't just delete — leave audit trail of "verified at date X by method Y."
3. **Update top-of-document metrics when items move.** Phase counts, total hours, realistic timelines.

---

## Next Up (in order)

1. **A13 — Demo auth gating** (~30 min)
   - Find demo/fallback auth in server/middleware/ or server/auth/
   - Gate behind `ALLOW_DEMO_AUTH` env var (false by default)
   - Mechanical fix; no design choices

2. **C17 — Asset class entitlement gating** (~90-120 min)
   - Apply role-gating pattern from agent commit `03498d3f` (RequireRole, hasRole) to Financial Model wizard's asset class picker
   - Investigate first whether platformAssetClasses or entitlement modules expose tier→asset-classes mapping
   - If yes: consume it. If no: build the mapping.
   - Asset classes not in user's tier should be grayed out + disabled with upgrade CTA
   - Beta-blocker per Brett's self-testing

3. **A11/A12 verification** (likely stale-bookkeeping)
   - Same approach as A2-A8: grep, verify, mark done if already fixed
   - A11 specifically calls out fund-service.ts processFundDistribution; check if already wrapped in db.transaction()

4. **A9-2 Phase 3 — SEV-3 triage** (deferred, XL effort)
   - 8 files, ~145 candidates flagged by pattern scan
   - 20-40% expected to be real vulnerabilities
   - Per-file triage: parent-validation pattern (false positive) vs. true missing-orgId

5. **Phase C body of work** (after Phase A finishes)
   - AI Advisor reliability (C1-C3) — biggest remaining beta-blocker after the wizard work
   - Then deal-flow connectivity (C13-C15)
   - Then data-trust fixes (C4-C7)
   - Then quality-of-life (C8-C12)

---

## How to Use This Document

If you're a fresh Claude joining this work: read this document, then check `git log --oneline | head -20` and `git status --short` to see current state. Read `VANTAGE_PRIORITY_QUEUE.md` and `ROUTE_TENANT_AUDIT.md` for full backlog detail. Then ask Brett what he wants to tackle.

If items in this handoff conflict with what `VANTAGE_PRIORITY_QUEUE.md` says — trust the queue document. It's the canonical source. This handoff is a snapshot.

---

*Generated 2026-04-27 at end of multi-day session stretch. Brett's beta-readiness commitment: NO production traffic from real clients with real data until Phase A ships.*
