# Vantage Priority Queue

**Generated:** 2026-04-27
**Audience:** Solo developer execution sequencing
**Companion to (does NOT replace):** `AGENT_QUEUE.md` (tier-grouped autonomous-agent catalog)

## What this document is

`AGENT_QUEUE.md` organizes the backlog by feature tier (Tier 0 → Tier 14) for autonomous-agent dispatch. That structure is correct for "what work belongs together" but is wrong for "what should I do tomorrow morning."

This document is a **flat sequenced queue** in strict execution order, written for solo bootstrapped pre-revenue execution. It exists alongside `AGENT_QUEUE.md`, not in place of it. Item descriptions are copied from the source so this queue is self-contained, with cross-references back to the original tier numbering.

## Operating constraints (user-confirmed 2026-04-27)

- Pre-revenue, bootstrapped, solo developer fully focused on Vantage
- Goal: production-ready for beta testing
- No customers yet, no specific feature requests, no hard deadlines
- **Committed: NO production traffic from real clients with real data until Phase A (Tier 0) ships**
- **Beta-readiness flow:** a CRE professional in user's network can take a real deal from CRM listing → modeling → DCF → portfolio in one continuous flow, plus AI Advisor can answer one focused question about that deal

## Aggregate metrics

| | Items | Effort midpoint (hours) |
|---|---:|---:|
| Phase A (Tier 0 security showstoppers) | 11 | 36 |
| Phase B (Tier 0.5 institutional gates) | 15 | 108 |
| Phase C (Beta-flow must-ship) | 16 | 70.5 |
| Phase D (Tier 1 active priorities) | 7 | 56 |
| **Total to beta-ready** | **49** | **270** |
| Phase E (post-beta visibility) | 60+ | not estimated |

**Effort scale:** S = 0.5h, M = 2h, L = 8h, XL = 20h (midpoints used for totals).

**Realistic timelines to beta-ready (270 hours):**
- 30 hrs/week focused solo (no Bookd/STR/cleaning DD overlap): **~9 weeks** (~2 months)
- 20 hrs/week (acknowledging Bookd, STR portfolio, cleaning company DD parallel work): **~13.5 weeks** (~3 months)

These are bottom-up estimates assuming linear single-threaded execution. Real friction (debugging, reviews, rework) typically multiplies by 1.3–1.7×, so plan for **~15–23 weeks** of real-world calendar time before inviting the first beta tester.

---

## PHASE A — TIER 0 SECURITY SHOWSTOPPERS

**Must ship before any client touches the platform. User has committed: no real client data flows until this phase is closed.**

**Phase A summary:** 11 items, midpoint effort ~36 hours.

Order rationale: SQL injection first (highest blast radius — exploitable from the internet). Tenant isolation second (cross-org data leakage on authenticated requests). Transaction safety third (financial integrity under failure). Demo auth gating last (smallest scope, mechanical).

### A1. Fix SQL injection in security-compliance-service.ts
**Source:** AGENT_QUEUE.md Tier 0A item 1
**Status:** ✅ DONE 2026-04-27 — vulnerability already fixed; dead code from previous unsafe implementation removed.
**Effort:** S
**Mode:** [solo]
**Description:** Lines 495-498 use `sql.raw()` with unparameterized `filters.eventType` and `filters.severity` string concatenation; replace with Drizzle parameterized `eq()` / `and()` conditions or `$1`-style placeholders in `pool.query()`.
**Why this position in queue:** Smallest SQL-injection scope; warm-up for the larger refactors in A2/A5.
**Dependencies:** none

### A2. Fix SQL injection in accounting-engine.ts
**Source:** AGENT_QUEUE.md Tier 0A item 2
**Status:** ✅ DONE 2026-04-27 — verified already fixed; audit stale.
**Effort:** M
**Mode:** [solo]
**Description:** Lines 534-535, 870, 1176, 1934 use `db.execute(sql.raw(...))` with string-concatenated WHERE clauses; refactor each to use Drizzle query builder or parameterized `pool.query()` with `$1, $2` placeholders.
**Why this position in queue:** Five separate sites in the financial-engine layer; second to land because financial code mistakes are silent and high-cost.
**Dependencies:** none

### A3. Fix SQL injection in external-routes.ts
**Source:** AGENT_QUEUE.md Tier 0A item 3
**Status:** ✅ DONE 2026-04-27 — verified already fixed; audit stale.
**Effort:** S
**Mode:** [solo]
**Description:** Line 337 uses `sql.raw(itemIds.map(id => \`'${id}'\`).join(','))` for an array IN clause; replace with Drizzle `inArray()` operator or `ANY($1::text[])` parameterized pattern.
**Why this position in queue:** Mechanical single-line refactor; group with A4 which has the same pattern.
**Dependencies:** none

### A4. Fix SQL injection in storage.ts
**Source:** AGENT_QUEUE.md Tier 0A item 4
**Status:** ✅ DONE 2026-04-27 — verified already fixed; audit stale.
**Effort:** S
**Mode:** [solo]
**Description:** Line 6115 uses `sql.raw(filters.storageTypes.map((t: string) => \`'${t}'\`).join(','))` for storage type filter; replace with `inArray()` or parameterized `ANY()` array.
**Why this position in queue:** Same pattern as A3; do them in a single sitting.
**Dependencies:** none

### A5. Fix SQL injection in crm-enhancements.ts
**Source:** AGENT_QUEUE.md Tier 0A item 5
**Status:** ✅ DONE 2026-04-27 — verified already fixed; audit stale.
**Effort:** M
**Mode:** [solo]
**Description:** Lines 228, 431, 448, 836, 1365, 1377, 1470 — multiple `sql.raw()` calls with user-derived input; audit each occurrence and replace with parameterized queries.
**Why this position in queue:** Largest sweep in 0A (7 sites), saved for last to apply lessons from A1–A4.
**Dependencies:** none

### A6. Add orgId filter to fund-management-routes.ts PUT /fund-deals/:id
**Source:** AGENT_QUEUE.md Tier 0B item 1
**Effort:** S
**Mode:** [solo]
**Description:** Line 217: `.where(eq(fundDealsV2.id, req.params.id))` has NO orgId check; add `and(eq(fundDealsV2.id, req.params.id), eq(fundDealsV2.orgId, orgId))` or validate fund ownership atomically.
**Why this position in queue:** First tenant-isolation fix; fund routes are highest risk because data is financial and identifiable.
**Dependencies:** none

### A7. Add orgId filter to fund-management-routes.ts DELETE /fund-deals/:id
**Source:** AGENT_QUEUE.md Tier 0B item 2
**Effort:** S
**Mode:** [solo]
**Description:** Line 239: same issue as PUT; add orgId to WHERE clause.
**Why this position in queue:** Same handler family as A6; bundle the edits.
**Dependencies:** none

### A8. Add orgId filter to capital account endpoints
**Source:** AGENT_QUEUE.md Tier 0B item 3
**Effort:** M
**Mode:** [solo]
**Description:** Lines 600, 678, 730: GET /capital-accounts/:fundId, GET /capital-accounts/:id/entries, POST /capital-accounts/:id/entries all fetch data without orgId in the primary query; add atomic orgId validation (not post-fetch check which has race condition).
**Why this position in queue:** Capital account endpoints are read-heavy and leak fund-level data; atomic check (not post-fetch) is the correct fix per spec.
**Dependencies:** none

### A9. Audit all route files for missing orgId filters
**Source:** AGENT_QUEUE.md Tier 0B item 4
**Effort:** L
**Mode:** [solo]
**Description:** Grep all `server/routes/` for `.where(eq(...id, req.params...))` patterns that lack an accompanying orgId condition on org-scoped tables; fix each occurrence.
**Why this position in queue:** Systematic sweep after A6–A8 establishes the pattern; ends 0B with broad coverage.
**Dependencies:** A6, A7, A8 (pattern must be established first)

### A10. Wrap distribution execution in db.transaction()
**Source:** AGENT_QUEUE.md Tier 0C item 1
**Effort:** M
**Mode:** [solo]
**Description:** `server/services/distribution-approval-service.ts` `execute()` method performs 4+ sequential DB operations (draft lookup, compliance checks, fund distribution processing, draft update, audit log) without transaction; wrap in `await db.transaction(async (tx) => { ... })` passing tx to each step.
**Why this position in queue:** Highest-cost partial-execution failure mode (a half-completed distribution); fix first in 0C.
**Dependencies:** none

### A11. Wrap fund distribution + capital call + pref return + remaining financial ops in db.transaction()
**Source:** AGENT_QUEUE.md Tier 0C items 2, 3, 4, 5 (bundled — same pattern, same files)
**Effort:** L
**Mode:** [solo]
**Description:** Wrap `fund-service.ts` `processFundDistribution()`, `createFundCapitalCall()`, `completeFundCapitalCall()`, `accruePreferredReturn()` in transactions; audit `server/services/` for any other multi-step financial operations and wrap each.
**Why this position in queue:** Same `db.transaction()` pattern as A10; bundle for efficiency. Closes Tier 0C.
**Dependencies:** A10 (pattern established)

### A12. Gate demo auth fallback behind explicit env var
**Source:** AGENT_QUEUE.md Tier 0D item 1
**Effort:** S
**Mode:** [solo]
**Description:** In `server/middleware/authenticate.ts` lines 44-52, the hardcoded admin fallback fires automatically when `NODE_ENV !== 'production'`; change to require `ALLOW_DEMO_AUTH=true` explicitly; log a warning on every fallback usage; add integration test verifying fallback is blocked when env var is absent.
**Why this position in queue:** Smallest scope, last in Phase A. Closes the showstopper batch.
**Dependencies:** none

---

## PHASE B — TIER 0.5 INSTITUTIONAL GATES

**Required before institutional client onboarding. Beta testers without real money on the line are okay before this phase, but the first paid institutional engagement requires it.**

**Phase B summary:** 15 items, midpoint effort ~108 hours.

Order rationale: input validation first (cheapest insurance against the highest-volume class of bug). Then ledger-based capital accounts (one-shot data-model rewrite that blocks decimal.js work). Then decimal.js (pure math correctness). Waterfall fixes after the engines are correct. Frontend boundaries + structured errors before pagination because UX issues compound on data-volume issues.

### B1. Add zod input validation to fund management routes
**Source:** AGENT_QUEUE.md Tier 0.5A item 1
**Effort:** L
**Mode:** [solo]
**Description:** `server/routes/modeling-routes.ts` fund endpoints (lines 4731-6100): all POST/PUT/PATCH routes accepting capital call amounts, distribution amounts, investor data, period dates must validate with zod schemas; create `server/validators/fund-validators.ts` with schemas for: CreateCapitalCallInput, ProcessDistributionInput, InvestorCreateInput, PeriodLockInput; apply via `schema.parse(req.body)` in each route handler.
**Why this position in queue:** Fund routes accept money amounts; protecting them is the highest-leverage validation work.
**Dependencies:** Phase A complete

### B2. Add zod input validation to all CRM write routes
**Source:** AGENT_QUEUE.md Tier 0.5A item 2
**Effort:** L
**Mode:** [solo]
**Description:** `server/routes/crm-routes.ts`: POST/PUT/PATCH routes for deals, contacts, companies, properties, tasks, activities; create `server/validators/crm-validators.ts`; validate deal amounts as positive numbers, email formats, phone formats, date ranges; apply to top 50 CRM write endpoints.
**Why this position in queue:** Highest-volume write surface in the app; second after fund routes because deal amounts are still material money.
**Dependencies:** B1 (zod pattern established)

### B3. Add zod input validation to modeling write routes
**Source:** AGENT_QUEUE.md Tier 0.5A item 3
**Effort:** M
**Mode:** [solo]
**Description:** `server/routes/modeling-routes.ts`: POST/PATCH routes for scenarios, assumptions, projections, sensitivity configs; create `server/validators/modeling-validators.ts`; validate numeric ranges (growth rates -50% to 100%, cap rates 1-30%, etc.).
**Why this position in queue:** Smaller surface than B1/B2 but stops nonsense numbers from corrupting models.
**Dependencies:** B1

### B4. Add zod input validation to operations/dashboard routes
**Source:** AGENT_QUEUE.md Tier 0.5A item 4
**Effort:** M
**Mode:** [solo]
**Description:** All POST/PUT routes in operations, executive-dashboard, analytics routes; validate date ranges, numeric filters, pagination params (page >= 1, pageSize 1-100).
**Why this position in queue:** Last validation pass; closes 0.5A.
**Dependencies:** B1

### B5. Create fund_ledger_entries table
**Source:** AGENT_QUEUE.md Tier 0.5B item 1
**Effort:** M
**Mode:** [solo]
**Description:** Migration: `fund_ledger_entries` with columns: `id` uuid PK, `org_id`, `fund_id` FK, `investor_id` FK, `entry_type` enum('capital_call', 'distribution', 'pref_return_accrual', 'management_fee', 'carried_interest', 'adjustment'), `amount` numeric(18,2), `description`, `effective_date`, `created_at`, `created_by`; add immutable RULE (prevent UPDATE/DELETE like financial_audit_log); add CHECK constraint `amount != 0`.
**Why this position in queue:** Foundation for B6/B7; raw-psql migration following the project's heredoc pattern.
**Dependencies:** none (independent of B1–B4)

### B6. Refactor fund-service.ts to derive capital account balances from ledger
**Source:** AGENT_QUEUE.md Tier 0.5B item 2
**Effort:** L
**Mode:** [solo]
**Description:** Replace all direct `capitalAccountBalance` updates with ledger entry inserts; add `deriveCapitalBalance(orgId, fundId, investorId)` method that SELECTs SUM(amount) grouped by entry_type from fund_ledger_entries; replace `getCapitalAccount()` to compute balance on-the-fly from ledger; deprecate mutable balance field.
**Why this position in queue:** Architectural correctness fix for capital accounting; depends on B5.
**Dependencies:** B5

### B7. Add ledger reconciliation endpoint
**Source:** AGENT_QUEUE.md Tier 0.5B item 3
**Effort:** S
**Mode:** [either]
**Description:** GET `/api/modeling/projects/:projectId/fund/:fundId/ledger-reconciliation` that compares stored balance vs. derived balance for all investors; flag discrepancies; add auto-fix endpoint that resets stored balance to match ledger sum.
**Why this position in queue:** Closes 0.5B; depends on B6.
**Dependencies:** B6

### B8. Migrate pro-forma-engine-service.ts from parseFloat to Decimal.js
**Source:** AGENT_QUEUE.md Tier 0.5C item 1
**Effort:** L
**Mode:** [solo]
**Description:** Replace all `parseFloat()` calls (est. 40+) with `new Decimal()` for: revenue growth compounding, expense escalation, NOI calculation, CapEx/reserves, management fees, debt service; ensure all intermediate calculations use `.plus()`, `.times()`, `.dividedBy()`; convert to number only at final output; import Decimal from existing `decimal.js` dependency.
**Why this position in queue:** Largest decimal migration; pro-forma is the foundation for DCF/waterfall.
**Dependencies:** none (decimal.js dependency already installed)

### B9. Migrate dcf-calculator-service.ts + remaining financial services from parseFloat to Decimal.js
**Source:** AGENT_QUEUE.md Tier 0.5C items 2 + 3 (bundled)
**Effort:** L
**Mode:** [solo]
**Description:** Replace parseFloat in dcf-calculator-service.ts (sensitivity matrix, NPV, terminal value, cash-on-cash, going-in cap rate); audit and fix deal-pricing-service.ts, capital-stack-service.ts, debt-schedule-service.ts, monte-carlo-service.ts (final aggregations), lease-cashflow-engine.ts; target zero parseFloat in any service that touches capital amounts.
**Why this position in queue:** Same pattern as B8; bundle for context efficiency.
**Dependencies:** B8

### B10. Waterfall engine fixes (GP commitment + LP/GP IRR + monthly pref accrual)
**Source:** AGENT_QUEUE.md Tier 0.5D items 1, 2, 3 (bundled)
**Effort:** L
**Mode:** [solo]
**Description:** Make `gpCommitmentPct` configurable (currently hardcoded 0.02); implement LP/GP IRR calculation (currently returns null at lines 214-215) using existing `calculateXIRR()`; add option for periodic preferred return accrual (monthly/quarterly/annual) that compounds over hold period and integrates with fund-service.ts `accruePreferredReturn()`.
**Why this position in queue:** Three connected waterfall correctness fixes; bundle. Comes after B8/B9 because correct decimal math is a prerequisite.
**Dependencies:** B8, B9

### B11. Wrap all major routes with PageErrorBoundary + add SectionErrorBoundary to dashboard
**Source:** AGENT_QUEUE.md Tier 0.5E items 1 + 2 (bundled)
**Effort:** M
**Mode:** [agent]
**Description:** In `client/src/Router.tsx`, wrap each top-level `<Route element={...}>` with `<PageErrorBoundary>`; the class already exists. In `client/src/pages/dashboard.tsx`, wrap each dashboard module/card with `<SectionErrorBoundary>`. Apply same pattern to modeling workspace tabs.
**Why this position in queue:** Pure mechanical wrap; agent-friendly. Ships UX dignity (no white-screens) before public exposure.
**Dependencies:** none

### B12. Centralized error response utility + replace generic "Failed to..." messages + pagination middleware/helper + apply to top 30 unbounded list endpoints
**Source:** AGENT_QUEUE.md Tier 0.5F items 1+2, Tier 0.5G items 1+2 (bundled — both server-side ergonomics work)
**Effort:** L
**Mode:** [solo]
**Description:** Create `server/utils/api-errors.ts` with typed `ApiError` class (`code`, `message`, `status`, `details`); replace generic `{ error: "Failed to..." }` returns in top 50 routes. Create `server/utils/pagination.ts` with `parsePagination(req)` helper (page default 1 min 1; pageSize default 25 max 100); apply to top 30 unbounded list endpoints (deals, contacts, activities, leases, fund investors, capital movements, workflow executions, notifications, document templates, marketplace listings); return `{ data, total, page, pageSize, totalPages }` envelope.
**Why this position in queue:** Closes Phase B with two final ergonomics wins. Bundling is fine — different files, same surgical pattern.
**Dependencies:** B1–B4 (validation should happen before structured errors are sent on top of bad input)

### B13. Add ON DELETE CASCADE / SET NULL to unprotected foreign keys (FK Cascade Audit)
**Source:** AGENT_QUEUE.md Tier 0.5H item 1
**Effort:** L
**Mode:** [solo]
**Description:** Run audit: query `information_schema.table_constraints` for all FK constraints where `delete_rule = 'NO ACTION'` on tables with `org_id`; prioritize: user deletion cascades (tasks, activities, sessions), org deletion cascades (all org-scoped tables), project deletion cascades (all project-child tables); create migration script using `ALTER TABLE ... DROP CONSTRAINT ... ADD CONSTRAINT ... ON DELETE CASCADE` pattern; target: fix top 100 most-used FK relationships.
**Why this position in queue:** Orphan records on cascade deletion are silent data corruption with same liability category as SQL injection and orgId leakage. Belongs alongside other institutional-data-integrity gates.
**Dependencies:** A6, A7, A8, A9 (orgId fixes — don't compound problems by cascading into incorrectly-scoped data)

### B14. Implement field-level PII encryption at rest
**Source:** AGENT_QUEUE.md Tier 0.5K item 1
**Effort:** M
**Mode:** [solo]
**Description:** Create `server/services/encryption-service.ts` using AES-256-GCM (key from existing env var pattern); encrypt on write / decrypt on read for fields: investor SSN, investor `tax_id`, contact SSN if stored; store as `enc:iv:ciphertext` pattern (already used for Google API keys); add migration to encrypt existing plaintext values; add decrypt middleware for API responses to authorized roles only.
**Why this position in queue:** Storing unencrypted SSN/tax_id is regulatory risk regardless of customer count. The encryption pattern (`enc:iv:ciphertext`) is already established for Google API keys. Not greenfield work.
**Dependencies:** none

### B15. Reduce cold-start time / consolidate migration stub coverage
**Source:** MARINAMATCH_JOURNAL.md slow-startup mention (2026-04-24)
**Effort:** L
**Mode:** [solo]
**Description:** Cold-start in Cloud Run currently ~10 seconds because the server runs 14,949 idempotent migration stubs on every boot. First impression for a beta tester hitting a cold instance is a 10-second blank page. Root cause: every schema change adds another idempotent migration. Approach: consolidate already-applied migrations into a baseline checkpoint; only run stubs added since the checkpoint. Add a fast-path that skips migration runner entirely if the schema-version table matches expected current version.
**Why this position in queue:** 10-second cold start = beta tester's first-impression liability. Also tech debt that compounds with every new feature.
**Dependencies:** none

---

## PHASE C — BETA-FLOW MUST-SHIP

**Defines beta readiness per user's explicit definition: "CRE pro takes deal from CRM listing → modeling → DCF → portfolio in one continuous flow, plus AI Advisor answers one focused question."**

**Phase C summary:** 16 items, midpoint effort ~70.5 hours.

Order rationale: AI Advisor reliability first (frontend bug + system prompt) because it's the live-demo crown jewel. Then the deal-flow connectivity items (Deal Comparison, embedded financials, DD Findings panel). Then the data-trust fixes (keyMetrics fallback, asset-class-breakdown, snapshot reader). Then quality-of-life cleanups (asset-shape terms, Marina-language sweep, latent Content-Type bug). Test coverage and CI repair sit at the end as the safety net for everything else.

### C1. Fix AI Advisor frontend vanishing-stream bug
**Source:** MARINAMATCH_JOURNAL.md 2026-04-26 backlog
**Effort:** M
**Mode:** [solo]
**Description:** Response streams in successfully (200, 31KB), but UI clears `streamingContent` when `done` arrives and the new `messages` entry doesn't render in time. User sees text appear then disappear. Fix in `client/src/components/ai-assistant.tsx` around line 374-385 — sequence the cleanup so messages are rendered before streamingContent clears.
**Why this position in queue:** AI Advisor is the live-demo highlight; if it visibly fails on the first beta tester's screen, the demo is over before it begins. Smallest surgical fix in Phase C.
**Dependencies:** none

### C2. AI Advisor system prompt redesign for advisor behavior
**Source:** MARINAMATCH_JOURNAL.md 2026-04-26 backlog
**Effort:** M
**Mode:** [solo]
**Description:** Asking "what asset classes should I look at?" returns a long generic essay. A real advisor would qualify the user (location, capital, time horizon, active vs. passive) before answering. System-prompt redesign + multi-turn qualifying flow.
**Why this position in queue:** Beta-readiness criterion explicitly names "AI Advisor answers one focused question." A data-dump response fails that criterion even when the technical pipe works.
**Dependencies:** C1 (working stream first)

### C3. AI Advisor entity injection wired into chat
**Source:** AGENT_QUEUE.md Tier 2 (in-progress)
**Effort:** M
**Mode:** [solo]
**Description:** Auto-inject current Deal Room context (modeling_project, pro forma, DCF for current deal) into AI prompts. Implementation per Tier 2 spec.
**Why this position in queue:** Closes the AI-Advisor-on-the-current-deal loop; needed for the beta-flow's "answer one focused question about that deal" criterion.
**Dependencies:** C1, C2

### C4. keyMetrics three-way fallback consolidation (source-of-truth alignment)
**Source:** PORTFOLIO_TRIAGE.md finding #6
**Effort:** L
**Mode:** [solo]
**Description:** `currentValue / annualRevenue / annualEbitda / occupancy / slips` are stored in `owned_assets.key_metrics` jsonb but also computed in `GET /api/portfolio/marinas` (crm-routes.ts:11684-11690) with a fallback chain `snapshot → stored → live (rentRoll)`. Different pages can show different numbers for the same field. Pick one source-of-truth per field: snapshot is authoritative for time-series (`currentValue`, `annualRevenue`, `annualEbitda`, `occupancy`); rent-roll for `slips` if present, else `propertySpecs.slips`; the `key_metrics` jsonb becomes a user-override layer. Encode in aggregation logic, replace `||` with careful `??` precedence (collapses 0). Make MarinaDetail use the same logic so both pages return identical numbers.
**Why this position in queue:** A user who sees Portfolio show $4.7M and the Detail page show $5M for the same asset stops trusting Portfolio numbers. High trust impact.
**Dependencies:** C8 (snapshot-reader UI gives users a place to see/override sources)

### C5. /api/portfolio/asset-class-breakdown reads owned_assets, not modeling_projects
**Source:** PORTFOLIO_TRIAGE.md finding #2
**Effort:** M
**Mode:** [either]
**Description:** Endpoint at `crm-routes.ts:11917-11941` is registered in the portfolio block but reads exclusively from `modelingProjects`. Add an owned-assets equivalent endpoint at `/api/portfolio/owned-assets-by-class` that GROUP-BYs `crm_properties.assetClass` over `owned_assets`. Update `dashboard.tsx` tile to use it.
**Why this position in queue:** Dashboard tile labelled as portfolio breakdown is showing modeling-pipeline counts. Click-through goes to `/portfolio` (owned-asset list), which doesn't match what the tile showed. Trust issue.
**Dependencies:** none

### C6. Performance/Financials tabs as proper components
**Source:** PORTFOLIO_TRIAGE.md finding #14
**Effort:** M
**Mode:** [agent]
**Description:** `Portfolio.tsx:569-704` defines two tabs as inline `<Card>` grids that re-derive metrics from the same `marinas` array. Extract `<PortfolioFinancialsTab assets={...} />` and `<PortfolioPerformanceTab assets={...} />` into `client/src/components/portfolio/` as siblings of `AssetModal`. Pure refactor — no logic change.
**Why this position in queue:** Blocks C7 (snapshot reader) which needs the Performance tab to be a real component. Schedule first.
**Dependencies:** none

### C7. assetPerformanceSnapshots reader UI
**Source:** PORTFOLIO_TRIAGE.md finding #4
**Effort:** L
**Mode:** [solo]
**Description:** Server-side `OwnedAssetsService.getAssetPerformanceSnapshots` (line 160) and `getAssetPerformance` (line 272) exist and are exercised by writes (Budgeting "Push to Operations"). No frontend page reads them. Add two API routes (`GET /api/portfolio/marinas/:id/snapshots`, `GET /api/portfolio/marinas/:id/performance`) wrapping the existing service methods. Add a "Performance" tab to `AssetDetail.tsx` rendering snapshot trends (line chart for occupancy/revenue/EBITDA over time) and the latest performance metrics. Optionally aggregate across assets in the Portfolio Performance tab.
**Why this position in queue:** Highest user-visible value-add on the Portfolio surface. Critical for the beta-flow's "track performance" promise. Snapshots are being written but nobody reads them — pure dead value.
**Dependencies:** C6

### C8. Latent Content-Type bug — apiRequest auto-detect JSON bodies
**Source:** MARINAMATCH_JOURNAL.md 2026-04-26 backlog
**Effort:** M
**Mode:** [solo]
**Description:** The `apiRequest` URL-first branch (used by 323 callers) doesn't auto-set Content-Type. The Phase 3B AssetModal Content-Type fix is a one-off; other callers will hit the same 400 silently. Auto-detect JSON-string bodies in the URL-first branch and set `Content-Type: application/json` if body starts with `{` or `[`. Faster and lower-risk than codemodding all 323 callers.
**Why this position in queue:** Latent landmines under any beta flow that touches an unaudited POST/PATCH path. Fix once at the framework level.
**Dependencies:** none

### C9. Asset-shape-specific terms cleanup (Total Slips/Revenue/Slip ASSET_REGISTRY-driven)
**Source:** MARINAMATCH_JOURNAL.md 2026-04-27 backlog (Phase 3 follow-up)
**Effort:** M
**Mode:** [agent]
**Description:** Total Slips, slips occupied, Revenue/Slip, table columns referencing slips still hardcoded in some places. Drive these from `ASSET_REGISTRY[asset.assetClass].sizeLabel` so a hotel shows "Total Keys" / "Revenue/Key" instead of "Slips".
**Why this position in queue:** Phase 3B already wired ASSET_REGISTRY everywhere; this is the cleanup pass for what got missed. Low-risk mechanical.
**Dependencies:** none

### C10. MarinaMapEmbed Marina-language sweep with prop-driven SOURCE_LABELS
**Source:** MARINAMATCH_JOURNAL.md 2026-04-27 backlog
**Effort:** M
**Mode:** [solo]
**Description:** Filter chip "Owned Marinas (N)", search placeholder "Search marinas by name...", error fallback "Failed to load marina data...", loading "Loading marina locations..." are all unconditional strings shared between Portfolio and the standalone marina-map page. Make `SOURCE_LABELS` prop-driven so Portfolio can pass `{ owned: 'Owned Assets' }` while the marina-map page passes `{ owned: 'Owned Marinas' }`. Other strings drop their qualifier or accept a prop.
**Why this position in queue:** Closes the Marina-language story on the Portfolio surface. Defer-able if time-pressed but cheap once C9 is done.
**Dependencies:** none

### C11. Portfolio surface basic test coverage
**Source:** PORTFOLIO_TRIAGE.md finding #10
**Effort:** XL
**Mode:** [solo]
**Description:** No test files cover `Portfolio.tsx`, `AssetDetail.tsx`, `AssetModal.tsx`, or `owned-assets-service.ts`. Recent Content-Type 400 regression had no contract test. Add minimum: contract tests for the 6 owned-asset routes (vitest + supertest); smoke test for AssetModal Add-to-Portfolio flow (vitest + react-testing-library). ~150 LOC for contract tests.
**Why this position in queue:** Multiplier on the risk of every other Phase C fix. Beta exposure without any regression net is bad pre-launch hygiene.
**Dependencies:** C1–C10 should land before tests crystallize the contracts

### C12. CI fix (typecheck baseline + schema-drift tests)
**Source:** MARINAMATCH_JOURNAL.md 2026-04-27 backlog (saved as memory `project_ci_red_known.md`)
**Effort:** L
**Mode:** [solo]
**Description:** GitHub Actions CI red since at least 19cff6f2. `npm run typecheck` exits 1 with 824 baseline errors. 7 tests in `server/schema-drift.test.ts` fail with `expected +0 to be 2`. Production deploys via Replit Republish on a separate pipeline (`check:schema && build`) which is green. Two paths: (a) replace GH Actions step with one mirroring Replit's actual pipeline (cheap), (b) fix the 824 typecheck baseline (expensive but right). Recommend (a) for beta, (b) post-beta.
**Why this position in queue:** Beta exposure with red CI on `main` looks unprofessional to anyone who looks at the repo. Fix before sharing the repo URL with beta testers.
**Dependencies:** none

### C13. Deal Comparison workspace activation
**Source:** AGENT_QUEUE.md Tier 11H (overlaps with Phase D D1)
**Effort:** M
**Mode:** [either]
**Description:** `DealComparison.tsx` (535 lines) and `deal-comparison-page.tsx` are fully built; add a "Compare Deals" button to the Pipeline page header and to the multi-select bulk operations bar; the button opens the comparison page (`/deal-comparison`) pre-populating selected deal IDs; verify the comparison component fetches the right data (deal financials, property data, demographics, modeling KPIs) and renders side-by-side; add a "Save Comparison" feature snapshotting to a `deal_comparison_snapshots` table.
**Why this position in queue:** The component is built, just not wired. Cheap unlock for the deal-flow story. (Phase D D1 is the same item; doing it here makes D1 a confirmation step.)
**Dependencies:** none

### C14. Embedded financial summary in workspace Financials tab
**Source:** AGENT_QUEUE.md Tier 13A
**Effort:** M
**Mode:** [solo]
**Description:** Replace the dead "Linked modeling project ID" Financials tab with a real embedded financial summary — query `/api/modeling/projects/:id` for the linked project; display a KPI grid: Unlevered IRR, Levered IRR, Equity Multiple (MOIC), Total Return, NOI (year 1), Cap Rate, Purchase Price, Price/Unit (asset-class aware); below the KPI grid, mini scenario bar (Base / Bull / Bear); "→ Open Full Model" button; if no project linked, show "Link or Create Modeling Project" CTA.
**Why this position in queue:** Beta-flow goes "deal → modeling → DCF → portfolio." This tab is the visible bridge between deal workspace and modeling output. Currently dead.
**Dependencies:** none

### C15. DD Findings Panel wired (currently dark)
**Source:** AGENT_QUEUE.md Tier 13B
**Effort:** M
**Mode:** [solo]
**Description:** Wire `DdFindingsPanel.tsx` into the workspace — add a "Findings" sub-tab within the Diligence tab; the component already queries `/api/findings?workspaceId=:id` and `/api/findings/summary/:workspaceId`; add findings-count badge to the workspace overview KPI section showing open/critical findings count; connect the "Create Finding" action to assign severity, category, assignee, and due date.
**Why this position in queue:** Closes a visible "the platform looks half-finished" gap on the workspace. The backend is fully built — the panel is just not imported. Small mechanical win.
**Dependencies:** none

### C16. Fix automation rules never executing on Kanban stage change
**Source:** PIPELINE_ENHANCEMENT_MASTER.md BUG-01
**Effort:** S
**Mode:** [either]
**Description:** Per PIPELINE_ENHANCEMENT_MASTER.md BUG-01: `client/src/pages/pipeline.tsx` `handleDragEnd` does not call `/api/pipeline/automation/evaluate` after the deal mutation succeeds. Result: workflow automations never trigger on drag. Fix: invoke the evaluate endpoint with `{ dealId, fromStageId, toStageId, orgId }` in the mutation `onSuccess` callback.
**Why this position in queue:** Beta tester's CRM workflow depends on stage-change automations. If automations never fire, the workflow engine looks broken in the demo.
**Dependencies:** none

---

## PHASE D — TIER 1 ACTIVE PRIORITIES

**Post-beta, GTM-relevant. The platform is functional for beta testers without these; they are the items that make a paying customer pull the trigger.**

**Phase D summary:** 7 items, midpoint effort ~56 hours.

### D1. Build Deal Comparison in Workspace
**Source:** AGENT_QUEUE.md Tier 1 (CRM priority #3) — **OVERLAPS WITH C13**
**Effort:** M
**Mode:** [either]
**Description:** Same item as C13. If completed in Phase C, mark this as done and skip. If C13 was deferred, do it here per the spec at `agents/specs/deal-comparison-workspace-spec.md`.
**Why this position in queue:** Originally Tier 1 priority but I pulled it forward into Phase C because the component is already built. Listed here for cross-reference.
**Dependencies:** C13 (or replaces C13 if done first here)

### D2. Email Send Integration for Workflow Automation
**Source:** AGENT_QUEUE.md Tier 1 (in-progress) — see `agents/specs/email-send-integration-spec.md`
**Effort:** L
**Mode:** [solo]
**Description:** Implement Email Send Integration for the Workflow Automation Engine. Currently `mailto:` only. Switch to in-app SendGrid send with templates, tracking, and unsubscribe handling.
**Why this position in queue:** First post-beta GTM unlock — workflows that don't send email are demos, not products. Spec exists.
**Dependencies:** none

### D3. Google Maps & Google Places API integration with encrypted key storage
**Source:** AGENT_QUEUE.md Tier 1 (in-progress)
**Effort:** L
**Mode:** [solo]
**Description:** AES-256-GCM encrypted API key in DB (pattern: `enc:iv:ciphertext`); server-side proxy routes for autocomplete (`/api/google-places/autocomplete`), place details (`/api/google-places/details/:placeId`), geocoding (`/api/google-places/geocode`); reusable `GooglePlaceSearch` frontend component (debounced, no Google SDK); Settings UI for key entry/masking.
**Why this position in queue:** Once shipped, unlocks downstream demographics overlays, marina map pin enrichment, and prospecting target heatmaps. Ships independently.
**Dependencies:** none

### D4. Build Document Studio token substitution engine
**Source:** AGENT_QUEUE.md Tier 3 — see `agents/specs/token-substitution-engine-spec.md`
**Effort:** L
**Mode:** [solo]
**Description:** Express route + token resolver pulling live Pro Forma and DCF data. Spec is done.
**Why this position in queue:** Foundation for D5 (IC Deck) and D6 (OM). Schedule before either of those.
**Dependencies:** none

### D5. Build IC Deal Review Deck
**Source:** AGENT_QUEUE.md Tier 3 — see `agents/specs/ic-deal-review-deck-spec.md`
**Effort:** L
**Mode:** [solo]
**Description:** Token resolver extensions, 3 API routes (token-status / preview / generate), section renderer, frontend generate flow.
**Why this position in queue:** Investment Committee memos are the first document any institutional GP needs to ship. Spec is done. (Note: AGENT_QUEUE marks this as `[failed]` in the Failed/Blocked section — the failure mode should be diagnosed before re-attempting.)
**Dependencies:** D4

### D6. Build Offering Memorandum
**Source:** AGENT_QUEUE.md Tier 3 — see `agents/specs/offering-memorandum-spec.md`
**Effort:** L
**Mode:** [solo]
**Description:** OM renderer, 3 API routes (token-status/preview/generate), frontend generate flow. Spec is done. (AGENT_QUEUE shows OM as both `[in-progress]` and `[done]` — verify actual state before continuing.)
**Why this position in queue:** OM is the first document that goes to LPs in a fundraise. Critical GTM tool. Same pattern as D5.
**Dependencies:** D4

### D7. Build Document Studio UI tab
**Source:** AGENT_QUEUE.md Tier 3
**Effort:** M
**Mode:** [either]
**Description:** `InvestmentMaterialsTab` with IC Deck and OM cards plus generate buttons. Wires up the user-facing entry to D5 and D6.
**Why this position in queue:** Final piece of Tier 3; ties D4–D6 into a usable surface.
**Dependencies:** D5, D6

---

## PHASE E — POST-BETA / LATER

**Retain visibility, do not work on these before Phase D is complete unless a paying customer demands one specifically. Cross-references back to AGENT_QUEUE.md tiers.**

### E.1 — AI Advisor maturity (Tiers 14B – 14J in AGENT_QUEUE.md)
- 14A — Wire OpenAI function calling tools (large unlock; consider pulling forward if a customer asks for actionable AI). *Beta-flow only requires AI to answer one focused question (read-only). Function calling enables AI to take actions in the app — useful but post-beta.*
- 14B — Deep entity context injection (deal, workspace, modeling project)
- 14C — VDR document intelligence (RAG over deal documents — auto-ingest VDR uploads, P&L parser output, rent rolls)
- 14D — Complete `PAGE_CONTEXT` map + dynamic suggested questions
- 14E — Knowledge base admin upgrades (PDF upload, URL scraping, citation trail)
- 14F — Connect ai-deal-intelligence-routes.ts and ai-underwriting-routes.ts to chat advisor
- 14G — Advisor persona configuration UI in Settings
- 14I — AI token usage dashboard + budget alert emails
- 14J — AI-assisted IC memo + Document Studio integration
- (14H deferred-as-invisible — voice input is gimmicky for a beta)

### E.2 — CRM completion (Tiers 11A – 11J in AGENT_QUEUE.md)
- 11A — Graduate 7 `_wip/` panels to production (Lists, Pipeline Forecasting, SLA Tracking, Phase Gates, Deal Playbook, Smart Search, Stage Template Editor)
- 11B — In-app email inbox + threading (post D2 email-send)
- 11C — Property record cross-module enrichment (rent roll KPI panel + demographics auto-load)
- 11D — Prospecting → Deal conversion flow
- 11E — LOI / Offer / Term Sheet milestone tracking + quick-entry form
- 11F — Commission tracking + broker relationship history
- 11G — IC Memo auto-generation from deal (depends on D5)
- 11I — Lead Score → Deal Score unification
- 11J — Pipeline velocity + deal sourcing analytics

### E.3 — Prospecting institutional completion (Tiers 12A – 12G in AGENT_QUEUE.md)
- 12A — Campaign execution engine (steps table, enrollments table, scheduler, step builder UI)
- 12B — Contact-linked prospecting activities + history view on contact record
- 12C — AI-powered target prioritization + best-time-to-call intelligence
- 12D — Market target geographic + demographic intelligence + heat map
- 12E — Funnel events table + rep performance leaderboard
- 12F — Territory assignment + weekly team quota dashboard
- 12G — Consolidate duplicate campaign systems (outreach vs marketing)
- (12H deferred-as-invisible — Marina-specific map integration; revisit when Marina vertical is paying)

### E.4 — Deal Workspace completion (Tiers 13C – 13J in AGENT_QUEUE.md)
- 13C — Capital Markets tab in workspace (lender tracker, term sheet comparison, debt structure)
- 13D — Equity waterfall + distribution visualization in workspace Financials tab
- 13E — LP Portal integration (Share with LPs, Deal Package Builder, LP view counts)
- 13F — Red Flags + Phase Gates + Deal Health Gauge in workspace overview
- 13G — Trade Area Demographics + Comparable Transactions snapshots in overview
- 13H — VDR Analytics Dashboard + document watermarking + diligence requests workflow
- 13I — AI Advisor panel embedded in workspace (depends on E.1 / 14B)
- 13J — Weekly deal activity digest email + consolidate `deal-detail.tsx` and `[workspaceId].tsx`

### E.5 — Demographics institutional completion (Tiers 10A – 10K in AGENT_QUEUE.md)
- 10A — Marina-specific demographic signals (boat ownership, boat registration, waterfront lifestyle index)
- 10B — Opportunity Zone overlay + FEMA flood zone risk indicator
- 10C — BLS MSA-level employment data
- 10D — Competitive density analysis (PostGIS + Google Places)
- 10E — CRM property → demographics auto-link
- 10F — SiteSuitabilityScore → CRM lead scoring engine connection
- 10G — Population growth → Pro Forma auto-inject
- 10H — Demographics heatmap layer + OZ layer on marina map
- 10I — Saved analysis history list view + Excel export
- 10J — MarketPotentialIndex methodology transparency + configurable weights
- 10K — Historical trend accuracy (label state-level vs trade-area, vintage labels)

### E.6 — Rent Roll Analysis to 100% (Tiers 9A – 9L in AGENT_QUEUE.md)
- 9A — Quick wins (executive dashboard ancillary/transient revenue trends; renewal reminder cron)
- 9B — RV Park / MHP dedicated analytics (service + routes + UI panel)
- 9C — Hotel / STR analytics UI (already-existing endpoints + ADR trend + channel mix)
- 9D — Retail CAM reconciliation UI + WALT + rollover schedule
- 9E — Industrial / warehouse analytics (service + routes + UI panel)
- 9F — Multifamily concession tracking + renewal spread + market rent update workflow
- 9G — Snapshot comparison ("time travel") UI + diff API endpoint
- 9H — GL reconciliation auto-match + period-close workflow
- 9I — Auto-sync rent roll → Pro Forma + sync conflict resolution UI
- 9J — Cohort analysis backend completion + cohort heatmap UI
- 9K — Dynamic rent roll report assembly engine (PDF + Excel) + scheduled reports
- 9L — Data quality enforcer + completeness score on leases

### E.7 — Reporting & Analytics (Tier 5)
- Portfolio dashboard (org-level rollup: aggregate NOI, equity deployed, avg DSCR + portfolio_snapshots cache)
- Pipeline analytics tab in CRM
- Payroll module UI (department allocations, burden profiles, connects to Pro Forma opex)

### E.8 — FM Polish (Tier 6)
- Visual QA pass on all Financial Model tabs (layout, empty states, number formatting)
- Spec FM feature gating (which FM features gate behind which entitlement tiers)

### E.9 — Billing / RBAC / SSO / Fund Accounting (MARINAMATCH_GAP_SPEC.md Volume 2 in-scope sections)
- A.1 — Billing & Subscription Engine (Stripe integration; AGENT_QUEUE.md Tier 7 echoes this)
- A.2 — Granular RBAC (Role-Based Access Control)
- A.3 — Audit Trail & Compliance Log
- A.4 — SSO (Single Sign-On)
- A.5 — Two-Factor Authentication (2FA)
- B.1 — Fund-Level Financial Model
- B.2 — Fund Formation Document Automation
- B.3 — Investor Accreditation & KYC/AML Workflow
- B.4 — Capital Account Ledger (overlaps with Phase B B5–B7 — confirm before duplicating)
- B.5 — Management Fee & Promote Calculator

### E.10 — Platform infrastructure (Tier 8 + Tier 0.5 leftovers)
- Tier 8 — Make Asset Classes fully dynamic (DB-driven everywhere; AGENT_QUEUE_ASSET_CLASS_SPEC.md is canonical)
- 0.5I — CI/CD pipeline (GitHub Actions workflow; ties to Phase C C12)
- 0.5J — Tax Engine implementation (cost segregation, depreciation schedule, Section 1250/1245 recapture). *Defer until first paying institutional engagement; beta testers can use simple effective-tax-rate assumptions. Risk: don't ship marketing claiming "tax-accurate IRR" until the engine is real.*
- 0.5L — Backup & disaster recovery procedures documentation

### E.11 — Audit tasks (catch-all)
- Full connectivity audit — verify every feature in Connectivity Matrix is wired end-to-end
- Empty state audit — check every page and tab for blank screen conditions

### E.12 — Volume 2 Advanced Analytics (post-beta, post-funding)
- E.1 Custom Report Builder — see MARINAMATCH_GAP_SPEC.md Part E.1
- E.2 Performance Attribution Engine — see MARINAMATCH_GAP_SPEC.md Part E.2
- E.3 Portfolio Stress Testing — see MARINAMATCH_GAP_SPEC.md Part E.3
- E.4 Benchmark Peer Comparison — see MARINAMATCH_GAP_SPEC.md Part E.4
- E.5 Cash Flow Forecasting Engine — see MARINAMATCH_GAP_SPEC.md Part E.5

---

## DEFERRED-AS-INVISIBLE

These exist in the source documents but are out-of-scope for solo execution OR strategically wrong to pursue pre-revenue / pre-team. Not deleted — listed here so they retain visibility for re-evaluation.

- **MARINAMATCH_GAP_SPEC.md C.1 Tenant Portal** — multi-month build, post-funding; defer until first paying customer asks
- **MARINAMATCH_GAP_SPEC.md C.2 Online Rent Collection** — Stripe Connect + ACH compliance; post-funding
- **MARINAMATCH_GAP_SPEC.md C.3–C.5 Lease Renewal / Rent Roll Intelligence / Vacancy Pipeline** — adjacent to property management product, not core CRE investment platform
- **MARINAMATCH_GAP_SPEC.md D.1–D.3 Development / Construction Module + Renovation Tracker + Pro Forma → Actuals Bridge** — adjacent product surface
- **MARINAMATCH_GAP_SPEC.md F.1 QuickBooks / Xero Integration** — heavy compliance + accounting domain; defer until a customer demands
- **MARINAMATCH_GAP_SPEC.md F.2 Property Management System Sync** — adjacent to C.1 Tenant Portal; defer
- **MARINAMATCH_GAP_SPEC.md F.3 CoStar / LoopNet Integration** — paid data partnerships; defer until revenue justifies licensing
- **MARINAMATCH_GAP_SPEC.md F.4 DocuSign Deep Integration** — heavy partnership work; defer
- **MARINAMATCH_GAP_SPEC.md F.6 Public Records / Title Data** — paid data partnership; defer
- **MARINAMATCH_GAP_SPEC.md G.* Deeper AI Features** — wait until E.1 (AI Advisor maturity) lands and ROI is observable
- **AGENT_QUEUE.md Tier 4 — Marina Property Intelligence Map data integration / lead enrichment / scraping health dashboard** — Marina vertical-specific; defer until Marina beachhead is validated with a paying customer
- **AGENT_QUEUE.md Tier 12H — Prospecting ↔ Marina Map Integration** — Marina-specific; defer with the rest of Tier 4
- **AGENT_QUEUE.md Tier 14H — Voice input for AI Advisor** — gimmick for a beta; defer indefinitely

---

## Notes on duplication and decision points

- **B.4 Capital Account Ledger** in MARINAMATCH_GAP_SPEC.md vs **Phase B5–B7** here: confirm whether the gap-spec's broader Capital Account Ledger is the same scope as Tier 0.5B's three items. If yes, B5–B7 closes both. If the gap-spec design is broader (e.g., investor-facing reports), Phase E.9 retains a slimmed item.
- **D5 IC Deal Review Deck** is marked `[failed]` in `AGENT_QUEUE.md`'s Failed/Blocked section — diagnose the original failure before re-attempting. The spec is `agents/specs/ic-deal-review-deck-spec.md`.
- **D6 Offering Memorandum** appears as both `[in-progress]` and `[done]` in `AGENT_QUEUE.md` — verify the actual ship state before doing more work. If shipped, D6 is just smoke-test + sign-off.
- **C13 ↔ D1 Deal Comparison** — same item, listed in Phase C because the component already exists. Mark whichever phase you complete it in as the canonical entry and tick the other off.
- **E.10 / 0.5I CI/CD Pipeline ↔ Phase C C12 CI fix** — overlap. Phase C C12 is the cheap "make CI green" fix (point CI at the same script Replit Republish uses). 0.5I is the full institutional GitHub Actions workflow (lint + test + audit). C12 first; 0.5I post-beta.
