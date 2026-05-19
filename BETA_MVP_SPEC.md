# Vantage — Beta MVP Specification

> **Status:** Locked-in plan as of 2026-05-17. This document is the ground truth for all future build sessions. Updates require explicit decision and a dated entry below the affected section.
>
> **Prior plan paused:** the 17-day engine unification sprint (Marina week + STR week) is paused. Work shipped in that sprint is preserved; remaining items roll into Phase 1/2 of this plan.
>
> **Timeline secondary to product quality.** Estimated ~32-47 working days of focused build. No fixed beta date.

## Table of contents

- [1. MVP Definition](#1-mvp-definition)
- [2. In Scope for MVP](#2-in-scope-for-mvp)
- [3. Post-MVP (filed for v1.1)](#3-post-mvp-filed-for-v11)
- [4. Build Phase Sequence](#4-build-phase-sequence)
- [5. Architectural Principles](#5-architectural-principles)
- [6. Open Decisions](#6-open-decisions)
- [Appendix A — Glossary](#appendix-a--glossary)
- [Appendix B — Revision log](#appendix-b--revision-log)

---

## 1. MVP Definition

**Vantage at MVP** is an institutional-grade commercial real estate investment and management platform that serves multiple primary user types operating on three priority asset classes. It supports the full evaluation-to-modeling-to-reporting workflow with asset-class-agnostic infrastructure: a single deal can be evaluated by an Investor/Operator, financed by a GP and LP pair, brokered, owned, or analyzed by an Analyst, with the application surfacing the right view of the right data for each role on each asset class without code branching at the feature level.

### Target friendlies

The first beta cohort is composed of:

- **PE shops** evaluating institutional CRE software — primary lens is GP-side modeling and LP reporting.
- **Brokers** evaluating CRE software with pipeline + listing tools — primary lens is deal sourcing, comp work, and pitch generation.
- **GPs / LPs** evaluating institutional fund management software — primary lens is fund-level cashflow + waterfall + capital account integrity.

These three constituencies cover four of the six MVP user types directly (Investor/Operator, GP, LP, Broker). Owner and Analyst will be exercised by friendlies wearing those hats in passing.

### Success criteria

A friendly is a success at MVP if they can do all of the following without help from us:

1. Sign up, land on a dashboard appropriate to their declared user type.
2. Model a marina, STR, or multifamily deal using either uploaded historicals OR direct-input assumptions.
3. See Pro Forma + DCF + Returns + Historical P&L populate with sensible numbers (no $0 line items, no 434% cap rates, no crashes).
4. Generate one meaningful output — an IC memo, an OM, an LP statement, or a pipeline export — relevant to their user type.
5. Give us a written feedback note covering what was missing, broken, or confusing.

Friendlies are NOT expected to do anything for which features have not yet shipped — see Section 3 for the v1.1 list.

---

## 2. In Scope for MVP

### 2.1 User types — 6 active primary types

| Type | One-line description | Primary surfaces |
|---|---|---|
| **Investor / Operator** | Evaluates and operates deals on their own balance sheet | Pipeline → Deal Workspace → Pro Forma → Returns |
| **Owner** | Owns operating assets and runs them — needs ops + financial views | Owned assets list → Operations dashboards → Historical P&L → Capex |
| **Broker** | Sources and pitches deals; manages listings and buyer relationships | Listings → CRM → Comp/pitch generation → OM Builder |
| **GP** | Manages a fund or syndication — raises, deploys, reports | Fund management → Capital calls / distributions → LP reporting → Waterfall |
| **LP** | Passive limited-partner investor — sees statements + commitments | LP portal → Capital account → Statements → Distribution history |
| **Analyst** | Builds models, runs analysis, doesn't typically transact | Modeling workspace → Sensitivity / Monte Carlo → Memo drafts |

Each user type has a distinct landing dashboard and a distinct navigation surface. They are **NOT** different applications — they're different lenses on the same underlying data. A user can have multiple types over time (an Analyst gets promoted to GP); the type drives display, not data access.

### 2.2 Asset classes — 3 active

| Class | Status today | Notes |
|---|---|---|
| **Marina** | Most-built (legacy core); needs cleanup of "marina-everywhere" leaks | MARINA_COA exists with rich keywords. Department inference is marina-shaped by default. |
| **STR** | Partial: STR_COA was widened Days 9-11 of paused sprint; upload path is asset-class-blind | Needs canonical seed + per-class department inference + fixtures. |
| **Multifamily** | Partial: MULTIFAMILY_COA + MULTIFAMILY_FIELDS exist; only multifamily fixtures live in tests/extraction-fixtures/ | Needs canonical seed + per-class department inference + engine wiring. |

Engines, UI, and routes must be **asset-class-agnostic in architecture** but only need to **function correctly for these three classes at MVP**. The remaining 13 asset classes (Section 3.5) are out of scope.

### 2.3 Capabilities in scope

- **Upload pipeline asset-class-aware** for the 3 classes (PDF + Excel + CSV).
- **Direct Input workflow** for the 3 classes (per-class input forms, COA-driven).
- **Pro Forma** (multi-year projection) for the 3 classes.
- **DCF** (with cashflow envelope per Day 12a fix) for the 3 classes.
- **Returns** (with seeded ledger data) for the 3 classes.
- **Historical P&L with Sep-Dec overlay** for the 3 classes (the projection chain on partial-year actuals — Option B from 5/16 discussion).
- **Type-aware navigation** — sidebar, top nav, mobile bottom nav all conditional on user type.
- **Type-appropriate dashboards** — six distinct landing dashboards, one per user type. **Substantive** content per type (Section 6 confirms).
- **Selective feature gating** at Level 2+3 (Level 1 = always-on; Level 4 = post-MVP).
- **Permission module** — minimal but real: a single permission check helper used at every gated route + UI surface. NOT a full RBAC matrix.
- **Tier gating wired but soft** — all MVP friendlies get all features regardless of tier. Tier infrastructure is present so post-MVP can flip to enforcement.

### 2.4 Non-functional requirements

- **Don't break what exists.** Current behavior for marina projects in production must continue working. All changes additive or opt-in until verified.
- **Verification before commit** per CLAUDE.md standing rules (tsc -b shared, scoped tsc baseline-diff, smoke routes, live API check).
- **Beta-friendly polish only** — no investment in v1.1+ features. If a beta friendly hits a v1.1 surface, it returns a clear "coming soon" treatment rather than a 404 or crash.

---

## 3. Post-MVP (filed for v1.1)

Items explicitly deferred. Each item is real work; deferral is a scope decision, not abandonment.

### 3.1 User type extensions
- **Sub-classifications** — Owner sub-class via asset designation (e.g., "Owner-Marina" vs "Owner-Multifamily") drives ops dashboard variants.
- **Deal Teams** — multiple users per role per deal, with role assignment + handoffs.
- **Third-party invites** — Attorney, Lender, Insurance, Appraiser, Surveyor each as a constrained "guest" role on a specific deal.
- **8 third-party user types** — full enumeration TBD; the five above plus Title Co, Property Manager, Tax Advisor (or similar set).
- **2 additional primary types** — Developer and Lender as full first-class types with their own dashboards.

### 3.2 Portfolio management
- Any user can designate owned assets and see roll-up across them.
- Portfolio-level returns, returns attribution, vintage cohorts.
- Cross-deal benchmarking.

### 3.3 System-triggered feature activation
- "Fund detected → Fund features appear in nav" pattern instead of static type-keyed nav.
- Auto-upgrade prompts when a user crosses a feature boundary their tier doesn't cover.

### 3.4 Remaining asset classes (13)
hotel, retail, office, industrial, medical, golf, laundromat, RV park, MHP (mobile home park), senior living, student housing, data center, life sciences.

Each requires its own COA + canonical seed + department inference branch + sample fixtures. Estimated ~2-3 days per class (no engine work required if Phase 1 infrastructure is solid).

### 3.5 Near-term cleanups (post-MVP polish)
- **Mobile responsive audit** — many workspace pages are desktop-first today.
- **8 duplicate Sunset Bay Marina fixtures** — seeded by beta-mock-test, accumulated; cleanup not in MVP scope.
- **CLAUDE.md "Test Project (STR)" reference** — the canonical ID `6b3a9021-...` was deleted 2026-05-17; needs replacement with STR fixture `b1a0eebc-...`.
- **Institutional analysis suite fixes** — 10+ POST calculator endpoints currently 400 on bare `{projectId}`; needs `resolveFromProject` pattern lifted from IRR Attribution.
- **Reimbursement routing for Multifamily** — non-utility reimbursements (e.g., "Natural Gas Reimbursement," "Trash Reimbursement," "Pest Control Reimbursement") currently route to their utility/expense category instead of Other Income because the `inferDepartment` Other Income branch only matches the exact `"utility reimbursement"` substring. Quick fix: add `'reimburs'` as a generic Other Income keyword (risk: false positive on expense items containing "reimburs" — unlikely but possible). Proper fix: category-conditional logic per Q5 design discussion. Deferred to post-MVP pending real friendly P&L data showing whether this is common enough to warrant either fix. Surfaced 2026-05-17 via synthetic probe in `tests/department-mapping-baseline.mjs`.
- **`STORAGE_SUB_TYPES` / `STORAGE_TYPE_LABELS` reconciliation with `MARINA_CONFIG.unitMix.types`** — three parallel marina vocabulary lists exist (legacy `STORAGE_SUB_TYPES` in `workspace.tsx`, `STORAGE_RENT_ROLL_SUB_TYPES` in `workspace/uploads.tsx`, `STORAGE_TYPE_LABELS` in `UploadDropzone.tsx`) vs. canonical `MARINA_CONFIG.unitMix.types`. Vocabulary divergence documented in Task 4 Phase 0 (e.g., legacy `wet_slips` vs canonical `wet_slips_fixed` / `wet_slips_floating` / etc.; legacy `dry_racks_indoor` plural vs canonical `dry_rack_indoor` singular; legacy `WET_SLIPS` UPPER vs no UPPER variants in canonical). Task 4 (Phase 1 item #5) ships asset-class-aware filtering that retains legacy marina vocabulary for write→read coherence; reconciliation deferred. Pairs with the subType editor work in §3.6 — when subType taxonomy becomes user-data, this legacy/canonical split resolves naturally.
- **`unitMix.tabIcon` anchor-icon leaking to non-marina classes** — STR's "Listings & Units" tab displays the anchor icon from marina conventions. Caused by `unitMix.tabIcon: 'anchor'` either defaulting to marina or being explicitly set in non-marina configs. Audit all 32 configs in `MODEL_CONFIG_REGISTRY.unitMix.tabIcon` and replace marina-flavored icons with class-appropriate defaults (STR: home/building/key; MF: building; self-storage: package/box; hotel: bed; retail: store; etc.). Surfaced 2026-05-18 during Task 4 browser verification. Pairs with Phase 1.5 per-class content audit (§8).
- **Inconsistent `unitMix` tab labels across asset classes** — STR shows "Listings & Units", MF shows "Unit Mix", Marina shows (TBD: "Slips" or default). Institutional CRE convention favors "Unit Mix" as the universal term; operator-facing UIs sometimes prefer class-specific labels ("Listings" for STR, "Slips" for Marina). Open product question: should labels follow institutional convention (uniform "Unit Mix") or operator convention (per-class)? Resolution pending Phase 1.5 per-class content audit (§8) — recommend institutional convention as default with per-class override for specific contexts. Surfaced 2026-05-18 during Task 4 browser verification.

### 3.6 Post-MVP feature roadmap (v1.1)
- **User-editable COA mapping** — settings UI for org-level chart-of-accounts overrides (add / edit / reassign / delete keyword-to-department mappings) propagating across all projects in the org. Institutional users expect to customize COA mappings per their internal accounting conventions. Scope: ~3-5 days for first cut. Touches DB schema (new override table), settings UI (CRUD per asset class), `inferDepartment` read path (query overrides before fallback cascade), per-org caching layer, retroactive re-classification policy, role permissions, audit log. Architectural prerequisites: Phase 1 (asset-class-agnostic infrastructure) and Phase 2 (upload pipeline asset-class-aware) solid first; also requires resolving which of the 4 registries are user-editable (`inferDepartment` cascade only? `PRO_FORMA_REGISTRY` too? both?). Recommended sequencing: post-Phase 1, after real friendly P&L upload data shows whether defaults are close enough or too far off for the MVP. Raised by Brett 2026-05-17 mid-Phase-1 Task 3 as a product gap worth capturing.
- **User-extensible rent-roll subType taxonomy** — settings UI for org-level subType taxonomy per asset class (add / edit / reassign / delete). Each asset class has canonical defaults (marina: slips by type; STR: Airbnb / VRBO / Booking.com / direct / corporate bookings; hotel: Room Revenue / F&B / Spa / Parking; self-storage: by unit size / climate / non-climate / drive-up; retail: commercial tenants; MF: apartments by unit type; RV: sites by hookup type / seasonal / annual). Users extend per their accounting conventions. Architectural prerequisites: Phase 1 (asset-class-agnostic infrastructure), Phase 2 (upload pipeline), 4-registry reconciliation, AND principle #6 (taxonomies as data, not code) being applied to existing consumers. Pairs with the COA editor as the second user-extensible taxonomy. Recommended sequencing: post-MVP, in concert with COA editor design pass. Surfaced by Brett 2026-05-17 during Task 4 Phase 0.
- **Inputs / Pro Forma per-cell editing redesign** (Option C from 2026-05-16 discussion — full 15-25 day rebuild).
- **VDR role-aware access** — currently all-or-nothing; v1.1 adds per-document per-role permissions.

See also: real v1.1 feature work tracked separately in §3.1 (user type extensions — sub-classifications, Deal Teams, third-party invites, additional primary types), §3.2 (portfolio management), §3.3 (system-triggered feature activation), §3.4 (13 additional asset classes).

---

## 4. Build Phase Sequence

> **DRAFT — confirm against the original phase discussion.** The structure below is reconstructed from context (Investigation 4 findings + user direction) but the original 5-phase breakdown from the live discussion was not preserved in the spec brief. Sequence is logical; specific phase boundaries may shift after review.

### Phase 0 — Foundation audits (today)

- 0-A: User type + permission infrastructure audit (read-only)
- 0-B: Asset-class-agnostic audit + marina-leak survey (read-only)
- Outcome: clear picture of what to extend vs replace, MVP-blocker cleanup estimate, foundation for Phase 1-2 sequencing.

### Phase 1 — Asset-class-agnostic infrastructure

- 4-registry coverage verification (MODEL_CONFIG_REGISTRY, COA_REGISTRY, COA_FIELD_REGISTRY, PRO_FORMA_REGISTRY) for marina + STR + multifamily
- Remove or generalize marina-hardcoded leaks for the 3 MVP classes (engines, UI, routes, department names)
- Per-class COA_SEED for STR + Multifamily (mirroring MARINA_COA_SEED shape with displayName + department + keywords)
- `canonical-seed.ts` rework to seed from per-class registries (not the department-stripped COA_FIELD_REGISTRY)
- Engine consumer wiring (`departmentToAssumptionKey` per class)

### Phase 2 — Upload pipeline asset-class awareness

- Thread `project.assetClass` from upload endpoint → parse → map → promote → categorizer (3 sites today pass `undefined`)
- `inferDepartment` branches per assetClass — marina cascade becomes the `marina` branch; STR + Multifamily get their own branches
- STR + Multifamily P&L upload fixtures + expected JSON (none exist today; multifamily fixtures already in `tests/extraction-fixtures/`)
- Mock LLM continues to be the default; real LLM provider opt-in per env var

### Phase 3 — User type + permission infrastructure

- User type field on the user record (additive — existing users get backfilled default)
- Per-type dashboard route + landing page (six landing surfaces)
- Per-type navigation (sidebar + top + mobile)
- Permission module — single `canAccess(user, feature)` helper used at every gated route + UI surface
- Tier gating wired soft — all MVP friendlies bypass tier checks via env or org flag

### Phase 4 — Engine completeness per class

- Pro Forma + DCF + Returns + Historical P&L verified end-to-end for marina + STR + multifamily
- Historical P&L Sep-Dec overlay (Option B — projection cells overlaid with badge) on `/actuals`, `/actuals/multi-year`, `/historical-pl`
- DCF cashflow envelope (shipped Day 12a — commit `b84b478e`)
- Pro Forma unitMix arg fix (shipped Day 12b — commit `f0d6ce90`)
- Returns ledger seeded for fixtures
- Marina fixture key-shape cleanup (snake_case → camelCase OR MARINA_COA inputKeys widening)
- 948 project (legacy STR test) replaced in CLAUDE.md by STR fixture `b1a0eebc-...`

### Phase 5 — MVP polish + verification

- Tier gating wired (soft) — UI surfaces tier badges without enforcement
- Friendly-ready dashboards — each of the 6 type dashboards reviewed for "would a friendly land here and know what to do?"
- End-to-end smoke test per (user type × asset class) combination — 18 happy paths
- Deferred-feature treatment — every Section 3 item that a friendly might hit returns a clear "coming in v1.1" UI rather than 404 / crash
- Friendly invite flow + onboarding tour

---

## 5. Architectural Principles

These are non-negotiable design rules. Every PR is reviewed against them.

1. **All features asset-class-agnostic in architecture.** No `if (assetClass === 'marina')` branching in shared infrastructure. Per-class behavior comes from per-class config objects (the 4 registries — MODEL_CONFIG_REGISTRY, COA_REGISTRY, COA_FIELD_REGISTRY, PRO_FORMA_REGISTRY — plus per-class COA_SEED entries), not from conditional code paths in engines, UI, or routes.

2. **All features respect role-based + tier-based gating.** Every gated surface goes through the same `canAccess(user, feature)` helper. No ad-hoc `if (user.role === ...)` checks scattered through components. No ad-hoc `if (org.tier === ...)` checks either — both flow through one module.

3. **Don't break what exists.** Production marina behavior must remain identical until explicitly migrated. Additive-first: new code paths are opt-in, verified, then made default. Reverting any single MVP commit must leave the system in a working state.

4. **Verification before commit.** Per CLAUDE.md standing rules:
   - `tsc -b shared` clean
   - Scoped tsc baseline-diff: zero new errors
   - Smoke routes: 17/17 green (or document any non-green as pre-existing)
   - Live API check on at least one fixture per affected asset class
   - Live UI check for any UI change (browser, not just curl)
   - Articulation block in chat before every commit (what's in, what's NOT in, verification performed, flags/caveats)

5. **One source of truth per concept.** The permission module is THE source of truth for access checks. The canonical assumption store is THE source of truth for scenario assumptions. Per-asset-class config is currently split across 4 parallel registries (see Section 7.B + Appendix A); unification is post-MVP, but no new registry gets added in the meantime — extend the 4 that exist. Duplicates either get unified or one is deprecated explicitly.

6. **Taxonomies are data, not code.** No hardcoded enum lists of user-extensible taxonomies (subTypes, departments, COA entries, tenant categories, etc.) downstream of their canonical registry. All filtering, validation, and routing reads from the live taxonomy set. This rule makes future user-customization (settings UIs for COA editor, subType editor, etc.) possible without rewriting the consumers. Existing marina-specific hardcoded lists (`STORAGE_SUB_TYPES`, `STORAGE_TYPE_LABELS`) predate this principle and are flagged for reconciliation per Section 3.5; the v1.1 subType editor that motivates this principle is captured in Section 3.6.

7. **Don't ship architectural changes mid-investigation.** When a Phase 0 audit surfaces unexpected scope, surface the finding and re-plan before code. The Day 12 pivot (engine unification → MVP) is the model.

---

## 6. Open Decisions

| # | Decision | Status | Resolution path |
|---|---|---|---|
| D1 | Substantive vs minimum type-specific dashboards | **SUBSTANTIVE confirmed** (2026-05-17) | Locked. Phase 3 builds six distinct dashboards, not six skinned versions of one. |
| D2 | What each user type's dashboard contains | TBD | Phase 0-A surfaced existing dashboards but not per-type content spec. Needs UX pass before Phase 3 (type-aware dashboards) starts. |
| D3 | Tier-feature matrix specifics | TBD | Phase 0-A confirmed canonical tier vocabulary is `tier-packs.ts` (5 slugs: starter/investor/broker/owner-operator/institutional). Matrix to be drafted from that survey before any tier enforcement work. |
| D4 | Asset-class registry completeness | **RESOLVED** (2026-05-17 Phase 0-B) | There is no single registry. **4 parallel registries** exist: `MODEL_CONFIG_REGISTRY` (UI, `shared/asset-class-model-config.ts:4349`, 32 classes), `COA_REGISTRY` (engine, `server/services/direct-input-engine.ts:608`, ~30), `COA_FIELD_REGISTRY` (input fields, `shared/direct-input-coa.ts:898`, 31), `PRO_FORMA_REGISTRY` (line items, `shared/pro-forma-config.ts:934`, 27). Each dispatches independently — an asset class can be present in one and incomplete in another (root cause of the STR 45/47 dropped-fields finding). MVP completion = the 5 surgical changes in Section 7.B. **Full unification of the 4 registries is deferred to post-MVP.** |
| D5 | Existing-user migration to typed users | **PARTIALLY RESOLVED** (2026-05-17 Phase 0-A) | Migration path viable: backfill `user_type = 'gp'` for users in orgs with the `fund_management` pack; `user_type = 'investor_operator'` for everyone else. New signups inherit from `organizations.userRole` if set. Vocabulary still requires D9 (below) before backfill column gets added. |
| D6 | 5-phase plan in Section 4 above | DRAFT (PENDING REVIEW — DEFERRED 2026-05-17) | The original phase breakdown from the live discussion was not captured in the spec brief. Section 4 is a logical reconstruction. Brett's later reference ("Foundation → Critical Workflows → Engine Completeness → Collaboration → Portfolio → Polish + Scale") doesn't match the draft phases. **Resolution deferred** — no framework lock today. Two open sub-questions to reconcile before locking: **(D6.1)** Are Collaboration and Portfolio MVP phases or v1.1 phases? Section 3 has both as v1.1 (post-MVP); the 6-phase reference includes them as MVP build phases. Need to decide whether the phase plan extends into v1.1, or MVP includes thin Collaboration/Portfolio slices, or those phase names get dropped from MVP build. **(D6.2)** Foundation vs Critical Workflows boundary — does Foundation absorb asset-class cleanup + user types + permission module (~3 weeks of prerequisites before any user-visible workflow), or does Critical Workflows start earlier with first user-visible workflows (upload → model → view) and Foundation stays a thin audit + scaffolding phase? |
| D7 | Marina fixture data shape (snake_case vs camelCase) | **RESOLVED** (2026-05-17 Phase 0-B) | Resolves via the broader Phase 1 work. The MVP cleanup #1 (`inferDepartment` branches) + Phase 2 upload pipeline together address the shape issue. **MARINA_COA inputKeys widening alone (the 2026-05-16 plan) is NO LONGER the leverage point** — fixing only the input-tab without fixing the upload pipeline leaves the dominant failure mode (mis-categorized uploads landing as wrong-department marina rows) untouched. |
| D8 | Mock LLM vs real LLM provider for upload mapping | TBD | Mock is the default; real provider is opt-in via `LLM_PROVIDER` env var. MVP decision: do we ship friendlies with mock (safe, deterministic) or real (better accuracy, cost)? |
| D9 | Canonical user_type vocabulary (NEW, 2026-05-17) | **RESOLVED** (2026-05-17 vocabulary matrix) | (a) **Separate column** on `users` table — orthogonal to `role` (org-level authorization). (b) **Storage: `varchar(32)` + Zod validation + DB CHECK constraint** (defense in depth; avoids `ALTER TYPE ADD VALUE` friction as 6 MVP types grow to 16+ with post-MVP Developer/Lender/third-party types). (c) **Migration: nullable → backfill (`gp` if org has fund_management pack, else `investor_operator`) → NOT NULL → signup flow**. (d) **Name: `user_type` (DB) / `userType` (TS)**. (e) **Existing 3 role vocabs**: server enums (`users.role` 3 values, `userRoleEnum` 5 values) left untouched — they handle org-level authorization correctly. **Client `Role` union trimmed**: `investor`/`broker`/`appraiser` move OUT of Role and INTO UserType where they belong; client Role shrinks to 5 to match `userRoleEnum`. (f) Orthogonality documented via code comment at first use of each. |

Items marked TBD do not block Phase 0. They block Phase 1+ and must be resolved before the affected phase starts.

---

## 7. Audit Findings (2026-05-17)

Two Phase 0 audits ran on Day 0 of the MVP build (paused engine-unification Day 12 in the prior plan). This section is the canonical pointer record so future sessions know what was investigated and what was concluded. Full audit transcripts live in session history.

### 7.A. Phase 0-A — User type + permission infrastructure

**Verdict: EXTEND, do not replace. ~1 week of work on the extend path; +3 days if you also reconcile role vocabulary (recommended).** Auth foundation is institutional-grade and works.

**Three parallel role/permission systems found:**

| System | Action |
|---|---|
| `server/middleware/rbac.ts` — real server RBAC, 5-value `userRoleEnum`, 33 permissions via `organization_user_roles` (used at 113 route gate sites) | **EXTEND** |
| `server/middleware/pack-guard.ts` + `feature-gate.ts` + `provision-service.ts` — tier-aware entitlement layer | **EXTEND** |
| `client/src/contexts/EntitlementsContext.tsx` + `useSidebarState.ts` + `sidebarConfig.ts` — already module-conditional | **EXTEND** (add `requiredUserTypes?: UserType[]` parallel to `requiredModules`) |
| `server/middleware/authorization.ts` — queries 4 tables dropped in `db-startup-migrations.ts:17913-17917`; silently returns empty; only consumer is `auth-routes.ts:1061` | **THROW AWAY** |

**Three vocabulary mismatch found** (resolved by D9, Section 6): `users.role` (3 values), `userRoleEnum` (5 values), client `Role` union (8 values). None include the 6 MVP user types. Same drift pattern as `tier_vocabulary_reconcile`.

**Latent infrastructure** already present, unused:
- `organizations.userRole` — free-text column labelled `"Primary role of the org's users (owner / broker / investor)"`. No constraint, no consumer code.
- `users.preferredDashboard` — 7-value enum (`default/investor/owner/attorney/lender/inspector/third_party`) already routing dashboard choice.
- LP portal page exists at `/modeling/lp-portal` — gated by `modeling_tools` pack. Not yet a separate auth surface.

**Migration path** (resolves D5 partially): backfill `user_type = 'gp'` for users in orgs with the `fund_management` pack; `'investor_operator'` for everyone else. New signups inherit from `organizations.userRole` when set.

**Largest single risk**: rotating `JWT_SECRET` mid-build (per `project_jwt_secret_encryption_fallback` memory) — do not touch auth secrets while wiring user types.

### 7.B. Phase 0-B — Asset-class-agnostic audit

**Verdict: ~16 hr (~2 days) of MVP cleanup work. No stop conditions tripped.**

**Critical correction:** the framing of `ASSET_REGISTRY` as "sole source of truth for all UI configuration" is wrong. The actual file (`client/src/lib/asset-registry.ts`) is 237 lines of UI metadata for the property intelligence map, consumed by exactly ONE component (`AssetModal.tsx`). Real config backbone = **4 parallel registries** documented in Section 6 D4 and Appendix A.

**Engine paths mostly clean.** Asset-class-aware via dispatch: DCF, Multi-year Projection, Returns, Capital Stack, Waterfall, Exit (`orchestrator-v2.ts` with marina+STR+multifamily branches), Tax Waterfall (with defaults).

**Two engine surfaces still marina-only:**
- Pro Forma (`enrichFromProfitCenters` queries 8 marina-only tables unconditionally)
- Historical P&L (transitively tainted via `inferDepartment` cascade)

**MVP-blocker cleanup = 5 surgical changes**:

| # | File | Change | Effort |
|---|---|---|---|
| 1 | `server/utils/department-mapping.ts:19-220` (`inferDepartment`) | Add `switch(assetClass)`: marina keeps cascade; STR returns `{Rental, Cleaning, Platform Fees, Operating}`; multifamily returns `{Rental, Other Income, Operating, Payroll, R&M, Utilities, Mgmt Fee}` | ~6 hr |
| 2 | `server/services/pro-forma-engine-service.ts:1626-1750` (`enrichFromProfitCenters`) | Wrap in `if (assetClass === 'marina')` | ~30 min |
| 3 | `pro-forma-engine-service.ts:394, 587, 622` + `asset-class-model-config.ts:4388` | Remove 4 `\|\| 'marina'` silent fallbacks | ~30 min |
| 4 | `server/services/doc-intel-service.ts:1760-1797` | Replace marina-only LLM prompt; branch by `assetClass` | ~4 hr |
| 5 | `client/src/pages/modeling/projects/workspace.tsx:280` + `workspace/uploads.tsx:161` + tab-gate `replacement-cost.tsx` | Replace marina `STORAGE_SUB_TYPES` with `getModelConfig(assetClass).unitMix.types` | ~3 hr |

Plus ~2 hr for a multifamily fixture seed. **Total: ~16 hr / 2 days.** STR fixture `b1a0eebc-1be7-4ad0-9f8a-5f8e9c0d2a01` already exists.

**Multifamily is in better shape than feared.** `MULTIFAMILY_CONFIG`, `MULTIFAMILY_COA`, `MULTIFAMILY_FIELDS`, `MULTIFAMILY_PRO_FORMA`, `ops_multifamily_units`, `ops_multifamily_turns`, multifamily-ops-routes, and 4 client pages under `operations/multifamily/` all exist today.

**Deferred (post-MVP):**
- Renaming `modeling_projects.marina_name` → `name` (34 client pages touch `project.marinaName`; cosmetic, renderable for any class today)
- Unifying the 4 registries into one true source of truth (multi-week refactor)
- 7 user-facing "MarinaMatch" / "Marinalytics" string mentions
- 8 duplicate Sunset Bay Marina fixtures
- 13 remaining asset classes

---

## Appendix A — Glossary

- **COA** — Chart of Accounts. Per-asset-class definition of revenue/expense line items and how they're computed.
- **COA_REGISTRY** — Engine-side registry mapping asset class → COA. Lives in `server/services/direct-input-engine.ts:608`. ~30 asset classes.
- **COA_FIELD_REGISTRY** — UI-side registry mapping asset class → input field definitions. Lives in `shared/direct-input-coa.ts:898`. 31 asset classes.
- **MODEL_CONFIG_REGISTRY** — UI-side registry mapping asset class → tabs, form sections, occupancy model, season config. Lives in `shared/asset-class-model-config.ts:4349`. 32 asset classes. The closest thing to a per-asset master config; consumed by workspace UI, DCF, pro-forma engine, doc-builder.
- **PRO_FORMA_REGISTRY** — Per-asset line-item taxonomy for the pro-forma surface. Lives in `shared/pro-forma-config.ts:934`. 27 asset classes.
- **ASSET_REGISTRY** — `client/src/lib/asset-registry.ts`. 237 lines, 47 classes. **UI metadata only** (label, icon, color, group, sizeLabel, priceUnit) for the property intelligence map. Consumed by exactly one component (`AssetModal.tsx`). **NOT a source of truth for engines, forms, or routes** — despite earlier sessions incorrectly framing it that way.
- **Direct Input** — User enters assumptions directly via form fields (no historical upload); Year 1 P&L computed from inputs + COA formulas.
- **Upload** — User uploads PDF/Excel/CSV historical; parser extracts → mapping categorizes → promote writes to `modeling_actuals`.
- **Friendly** — A beta user from our trusted-tester list, distinct from a paying customer. Friendlies tolerate rough edges and give feedback.
- **MVP** — The first cut of Vantage we put in front of friendlies. NOT a paid product, NOT publicly launched.
- **v1.1** — The first post-MVP release. Targets paid customers. Section 3 items roll into v1.1 in priority order.

---

## Appendix B — Revision log

| Date | Author | Change |
|---|---|---|
| 2026-05-17 | Brett + Claude (Opus 4.7 1M) | Initial draft. Engine-unification sprint paused; MVP plan locked. Sections 1-3 + 5 finalized per Brett direction; Section 4 drafted from context with DRAFT flag (D6); Section 6 captures the 8 open decisions identified to date. |
| 2026-05-17 (later) | Brett + Claude (Opus 4.7 1M) | Phase 0-A + 0-B audits completed. D4 marked RESOLVED (4 parallel registries; full unification deferred). D5 marked PARTIALLY RESOLVED (migration path viable; pending D9). D7 marked RESOLVED (MARINA_COA widening alone no longer the leverage point). D9 added (canonical user_type vocabulary). Glossary corrected on ASSET_REGISTRY. Section 7 — Audit Findings added as canonical pointer record. Section 4 still DRAFT — phase names need confirmation against Brett's stated plan (Foundation → Critical Workflows → Engine Completeness → Collaboration → Portfolio → Polish + Scale). |
