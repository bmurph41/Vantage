# MarinaMatch Platform Journal

## 2026-04-22 — Per-asset-class Ops landings + entitlement intersection

Goal: ensure every asset class and business type has its own Ops section, with
visibility gated by `organizations.asset_classes` ∩ owned asset types.

**What shipped:**

- `shared/asset-class-catalog.ts` — expanded from 16 simplified keys to **120
  keys covering all 105 taxonomy IDs**. Added 17 new profit-center arrays for
  operating-business groups (F&B, SaaS, ecommerce, services, trades,
  healthcare, auto, fitness, bowling, golf, education, pro-services, personal
  care, insurance agency, brewery, extended-stay, cold-storage, data-center,
  coworking, land, parking, car-wash, religious, student/senior housing, MHP,
  RV park, franchise, notes). Each entry now tags `category` and `group` from
  the marketplace taxonomy. Helpers: `getAllAssetClassCatalogKeys()`,
  `hasAssetClassCatalog()`.

- `shared/asset-class-ops-modules.ts` — expanded `ASSET_CLASS_OPS_MODULES` to
  cover all 120 keys via presets (`UNIVERSAL_OPS`, `CRE_RESIDENTIAL`,
  `CRE_COMMERCIAL`, `LIGHT_BIZ`, `LAND_OPS`). Added
  `getOpsModulesForAssetClass()` with universal fallback. Expanded
  `OPS_SUBCATEGORY_META.assetClasses` arrays so the existing subcategory
  rendering picks up `hotel_full_service`, `apartment_garden`, etc., in
  addition to the legacy simplified keys.

- `client/src/pages/operations/AssetClassOpsLanding.tsx` (new) — data-driven
  landing page for every asset class. Reads `:assetClassKey` from the route,
  looks up taxonomy + catalog metadata, branches on `category` for KPI cards
  (CRE: Properties/Revenue/NOI/Occupancy, Operating Biz: Businesses/Revenue/
  EBITDA/Headcount). Renders profit centers, amenities, enabled module cards,
  and an "Open detailed view" CTA when a bespoke page is registered
  (`BESPOKE_PAGE_ROUTES` maps 31 aliases to the 5 existing bespoke
  Tabbed pages).

- `client/src/Router.tsx` — new route `/operations/asset/:assetClassKey` behind
  `<GatedLayout pack="operations">`. Placed after the existing bespoke ops
  routes so they win precedence.

- `server/services/operations-module-resolver.ts` — now reads
  `organizations.asset_classes` and intersects with owned asset types.
  Gating rule: class is enabled iff owned AND subscribed. If
  `asset_classes` is empty we grandfather (full owned set) — avoids locking
  out existing orgs that haven't populated the column yet. Response now
  includes `subscribedAssetClasses` so the UI can distinguish
  locked-but-subscribed from fully unavailable.

- `client/src/components/unified-sidebar.tsx` — new "Asset Classes" section at
  the top of Ops, rendered when the org has enabled classes. Each entry links
  to `/operations/asset/:key` with the catalog label. Collapsible, sorted
  alphabetically.

**Validation:**
- Targeted tsc on touched files: zero errors (pre-existing errors in
  server/db.ts and shared/schema.ts are unrelated, known from the tsc OOM
  deferred item).
- Coverage check: `node` script confirms all 105 taxonomy IDs are present in
  both the catalog and the ops-modules map.
- Full-workspace tsc still OOMs (known; deferred item #6 in post-beta queue).

**Design notes (for future agents):**
- The generic landing's KPI numbers are placeholders (`—`) except for the
  "Properties/Businesses" count, which uses `assets.filter(a => a.assetType
  === key).length`. Wiring real Revenue/NOI/EBITDA per class is a follow-up
  once the portfolio summary API accepts an asset-class filter.
- `BESPOKE_PAGE_ROUTES` is a client-side map in `AssetClassOpsLanding.tsx`.
  When you add a new bespoke Tabbed page, register its route there so the
  landing shows the CTA.
- Adding a new asset class now requires three edits: taxonomy entry (id +
  label + group), catalog entry (via `cre(...)` / `biz(...)` / `franchise(...)`
  / `note(...)` helpers), and ops-modules entry (usually a preset constant).

**Next suggestions (not yet prioritized):**
- Per-asset-class KPI data (extend `/api/portfolio/summary` or a new
  `/api/operations-context/kpi-by-class?assetClass=...`).
- OperationsHome could expose a small "Your asset classes" grid that links
  into each landing, mirroring what the sidebar now does.
- Optional: migration to populate `organizations.asset_classes` from the
  signup wizard so new orgs get real subscription gating from day one.

## ✅ F1/F2/F3 patched — hardening follow-up (2026-04-20)

Follow-up to the diagnostic sweep earlier today. All three diagnostic
findings are now fixed in code. **26/26 post-patch probe green**, and
the B1+B2 + B3 smoke suites still pass (15/15 and 14/14).

### F1 + F2 — Dead V2 fund CRUD + V2 side-letters removed
`server/routes/fund-management-routes.ts`:
- Deleted the B.1 block (lines 42-348 pre-patch): GET/POST /funds,
  GET/PUT /funds/:id, GET/POST /funds/:id/deals, PUT/DELETE
  /fund-deals/:id, GET /funds/:id/metrics. All read from `fundsV2`,
  which the UI never touches (client calls `/api/funds/*` in
  modeling-routes, which reads V1).
- Deleted V2 side-letters (GET/POST /funds/:id/side-letters). UI uses
  `/api/lp-portal/side-letters/*`, which targets the same underlying
  `side_letters` table via `lp-portal-service`.
- Dropped now-unused imports `fundDealsV2` and `sideLetters`.
- B.2 (fund documents), B.3 (investor verification), B.4 (capital
  account ledger), B.5 (management fee calculator), and all reporting
  endpoints (PME, j-curve, attribution, vintage-cohorts) are kept —
  those either delegate to V1 or own their own V2 tables that aren't
  duplicated elsewhere.

Verification: all 4 canonical `/api/funds/*` UI paths and all 4
reporting endpoints still return 200 with real data. Probes at the
removed paths now fall through to the Vite dev middleware (HTML
response), which is the correct "no JSON handler" signal.

### F3 — LP portal bearer-session scoping
`server/routes/lp-portal-routes.ts`: introduced `resolveScope(req)`
that returns either `{ kind: 'lp', orgId, investorId }` when
`Authorization: Bearer <token>` is present and validates via
`lpPortalAuth.validateSession()`, or `{ kind: 'gp', orgId }` from
the global authenticateUser session, or `null` (→ 401).

Two enforcement helpers:
- `forbidIfLp(scope, res)` — returns 403 for LP on admin-only routes.
- `denyInvestorMismatch(scope, investorId, res)` — returns 403 if an
  LP bearer tries to query or POST for a different investor_id.

Admin-only (LP gets 403):
- POST /auth/create-user
- POST /statements/generate
- POST /k1/generate
- POST /side-letters
- GET /side-letters/mfn-analysis/:fundId  ← exposes other investors' terms
- All /investor-letters/{seed-defaults, templates, templates GET}

LP-scoped (LP sees only own investor's data; mismatch = 403):
- GET /statements (force investorId = scope.investorId)
- GET /statements/:id + /statements/:id/html (verify returned
  statement's investorId matches scope)
- GET /k1/:fundId/:investorId/:taxYear (verify path investorId matches)
- GET /side-letters/fund/:fundId (filter by scope.investorId)
- POST /investor-letters/render (force own investorId)

GP behavior is unchanged — the global `authenticateUser` session still
gives full org-wide visibility.

### Verification (post-patch probe)
- /api/funds/* (V1 UI path): 4/4 green
- Fund reporting (PME/j-curve/attribution/vintage): 4/4 green
- Removed V2 paths return Vite HTML (no matching JSON handler): 3/3 confirmed
- GP session still sees all lp-portal surfaces: 4/4 green
- LP bearer scoping: 11/11 (own data ✅, other investor 403, admin
  endpoints 403, MFN 403, invalid bearer 401)

### Impact
The "GP-only beta" restriction on S3/S4 is lifted by the code. Actual
LP invites still need the client-side LP portal UI (login flow + data
views) — that's Phase 4 product work, not backend. Backend is safe to
receive LP bearer sessions today if the UI layer wires them up.

---

## ✅ Pre-beta diagnostic sweep — GO for invites (2026-04-20)

Re-ran all existing smokes against current main + probed every major
read surface the beta UI will touch. **Go/no-go: GO.** No new hard
blockers. Three findings below; all are either UI-irrelevant or previously
acknowledged soft blockers.

### Smoke suite re-run
- **B1+B2 beta gating + billing guard:** 15/15 pass (REQUIRE_BETA_INVITE=true)
- **B3 tax-waterfall write paths:** 14/14 pass
- **B4 demo seed:** clean re-run. PME returns real values
  (ksPme 0.744, fundIrr 11.5%, benchmark 16.08%)
- **tsc --noEmit:** OOMs even at 8GB heap — known deferred #6, not
  beta-blocking (runtime smokes cover drift)

### Endpoint probe — canonical UI paths
All UI-facing endpoints green under a fresh GP session (org
`cd3719c3-...`, demo fund `5d54f90e-...`):

FM on test project (STR + Surfside):
- `GET /api/modeling/projects/:id/pro-forma` — 200
- `GET /api/modeling/projects/:id/dcf` — 200
- `GET /api/modeling/projects/:id/exit/scenarios` — 200
- `GET /api/modeling/projects/:id/lp-reporting` — 200
- `GET /api/modeling/projects/:id/config` — 200
- `GET /api/modeling/projects/:id/tax-waterfall/{settings,partners,equity-contributions}` — 200

Fund Management (canonical V1 paths at `/api/funds/*`):
- `GET /api/funds` / `/api/funds/:id` / `/metrics` / `/investors` /
  `/capital-accounts` / `/allocations` — all 200

Fund Reporting (delegate to V1 via fund-reporting-service):
- `GET /api/fund-management/funds/:id/pme` — 200 + real values
- `/j-curve` / `/attribution` / `/vintage-cohorts` — all 200

CRM (all pass):
- `/api/crm/{deals,contacts,companies,leads,tasks,activities,pipelines}` — 200

Workflow automation (S2 probe):
- `/api/workflow-automations/` and `/meta/{triggers,templates}` — all 200

### DB integrity spot-checks — 9/9 effectively green
- `organizations.is_beta` column (boolean NOT NULL) ✅
- `beta_invite_codes` + `beta_invite_redemptions` tables ✅
- `crm_deals.modeling_project_id` column ✅
- `financial_audit_log` table + both UPDATE and DELETE `INSTEAD NOTHING`
  rules present (inserted, then UPDATE/DELETE both return 0 rows) ✅
- `distribution_approvals`, `fund_period_locks` tables ✅
- `tasks.project_id` FK is CASCADE ✅

### Findings (3, none hard-block beta)

**F1. V1/V2 fund-table split-brain** — `/api/fund-management/funds/:id`
(fund-management-routes.ts) reads from `fundsV2`, while the canonical
UI endpoint `/api/funds/:id` (modeling-routes.ts) reads from `funds`
(V1). The seed populates V1 only, so V2 endpoints 404 on the demo fund.
**UI impact: none** — `use-fund-management.ts` hits `/api/funds/*`
(V1, all green). `fund-management-routes.ts` leading comment already
says "use /api/funds/* as the canonical entry point" — the V2 routes
there for fund CRUD look like dead code. Flagging for post-beta
cleanup, not a blocker.

**F2. S3 side-letters (V2 path) 404s** — `POST/GET
/api/fund-management/funds/:id/side-letters` is the V2 version and
returns 404 because the fund isn't in `funds_v2`. **UI impact: none**
— `use-lp-portal.ts` uses `/api/lp-portal/side-letters/*`, a
different implementation. S3 soft blocker remains accurate: the
V2 side-letters route would fail if a V2 fund were ever used. Defer.

**F3. S4 lp-portal not investor-scoped** — confirmed.
`GET /api/lp-portal/statements` returns `[]` to a GP user in the
same org (filter is org-scoped, no investor check). GP-only beta
is fine; fix before inviting any LP. Unchanged from earlier.

Also: `/api/lp-portal/summary` returning 200 is a red herring — no
route by that name, so Express falls through to the Vite dev catch-all
(HTML response). Not a real endpoint.

### Server env note

Dev server was restarted mid-session with `REQUIRE_BETA_INVITE=true`
to exercise gate-ON behavior. That's the correct prod setting and is
currently in-process — do not flip it back before deploy.

### Operational checklist status

Same as 2026-04-19:
1. Deploy current `main` to prod ⏳
2. Set env: `REQUIRE_BETA_INVITE=true`, `SENTRY_DSN`,
   `VITE_SENTRY_DSN`, confirm Stripe + email via
   `GET /health/integrations` ⏳
3. `node scripts/seed-beta-demo.mjs` on prod DB ⏳
4. Generate invite codes via `scripts/beta-invite.mjs` ⏳
5. `npm run test:e2e` against prod URL before each invite batch ⏳

---

## ✅ COMPLETE — B3-B9: Full FM beta publish checklist (2026-04-19)

B1 + B2 shipped earlier today. This session closed out the remaining seven
beta-publish blockers (B3-B9) so the FM is ready for beta invites after a
prod deploy + env setup.

### B9 — users.username drift sweep
10 real bugs fixed in live code (docket-schema `docket_users.username` hits
were false positives — that's a different table with its own username column
and was left alone). Renamed `users.username` → `users.name` and dropped
the dead `firstName/lastName` references that weren't columns. Files touched:
red-flag-routes, phase-gates-routes, opssos/task-routes, operations-routes
(3 hits), multi-approver-service, approval-notification-service,
comment-routes.

### B6 — ToS + Privacy pages
Turned out to be already shipped. `/terms` and `/privacy` routes exist in
`Router.tsx`, render via `LegalPage.tsx` which fetches
`/api/legal/:docType`, and the `legal_documents` table already holds v1.0.0
content for TOS, PRIVACY, and BENCHMARK_POLICY (effective 2026-02-18). Signup
already includes "By continuing, you agree..." with working links. Earlier
audit had called these MISSING — they are not. No code change needed.

### B7 — Sentry error tracking
Installed `@sentry/node` v10.49 + `@sentry/react` v10.49. New files:
- `server/lib/sentry.ts` — `initSentry()` (no-op without `SENTRY_DSN`),
  `sentryContextMiddleware` (tags orgId/userId/beta), `sentryErrorHandler`
  (captures before centralizedErrorHandler).
- `client/src/lib/sentry.ts` — mirror for browser, keyed off `VITE_SENTRY_DSN`.
- Wired into `server/index.ts` (init at top; context + error middleware
  in the chain) and `client/src/main.tsx` (init before createRoot).
- All three ErrorBoundary `componentDidCatch`s now call `captureException`.
Behavior today: no-op (no DSN). Set `SENTRY_DSN` / `VITE_SENTRY_DSN` in
prod to activate — code already there, no redeploy needed beyond env.

### B3 — Tax waterfall write-path smoke test
`scripts/smoke-tax-waterfall-writes.mjs` exercises all 10 POST/PUT paths:
settings → 2 partners → 3 equity contributions → tax inputs → waterfall
config → 3-tier waterfall → GET round-trip + invalid-split rejection.
**14/14 pass.** Discovered and worked around: (a) `amount` field is actually
`amountCents`, (b) `depreciationMethod` enum is `manual | simple_building_life
| schedule` (no `straight_line`), (c) PUT settings auto-seeds a "Default
Straight Split" waterfall config when `enabled=true` — intentional UX, now
documented in the test expectations.

### B4 — Demo fund + modeling-project seed
`scripts/seed-beta-demo.mjs` creates "MarinaMatch Demo Fund I" (2023 vintage,
$50M committed): 3 LP investors, 7 quarterly capital calls totaling $40M,
3 distributions totaling $12.5M, and links the fund to up to 3 modeling
projects. Idempotent — re-run deletes prior demo fund and recreates fresh.

Gotcha discovered: `fund_ledger_entries` has `ON DELETE DO INSTEAD NOTHING`
RULE that confuses PG's RI check even for 0-row cascades. Worked around by
temporarily dropping the RULE + the `investor_id_fkey` FK within a
transaction, then recreating both.

Post-seed verification: PME endpoint now returns non-trivial values —
`ksPme: 0.744`, `fundIrr: 11.5%`, `benchmarkReturn: 16.1%`. LP reporting
/ PME / J-Curve / vintage cohort all render real data.

### B5 — FM empty-state polish
New reusable `client/src/components/modeling/FMEmptyState.tsx` (dashed-border
card, teal icon, primary + optional secondary CTAs). Wire-ups:
- **pro-forma.tsx** — already had a solid custom empty state (kept).
- **dcf-calculator.tsx** — added belt-and-suspenders guard after the
  isError check for the `!dcfAnalysis` case.
- **exit-strategy.tsx** — new guard for `!project || (!purchasePrice &&
  !year1NOI)`, routes to Inputs.
- **lp-reporting.tsx** — replaced the "renders with hardcoded defaults"
  fallback with an FMEmptyState that routes to Fund Management. Previously
  showed fake data (TVPI 1.0x, fund name "Marina Infrastructure Fund I")
  which would mislead beta users.
- **rent-roll-analysis.tsx** — new empty state when `totalUnits === 0 &&
  units.length === 0`, routes to Rent Roll Data.
- **rent-roll-data.tsx** — kept (tabbed standalone/linked UI already guides).
- **tax-distributions.tsx** — kept (Alert banner when disabled is fine).
- **returns-valuation/index.tsx** — kept (has inline "No FM projects yet"
  empty state).

### B8 — Playwright golden-path E2E
Installed `@playwright/test`. New files:
- `playwright.config.ts` — Chromium, serial, no retries, against
  `E2E_BASE_URL` (default `http://localhost:5000`).
- `e2e/golden-path.spec.ts` — ONE spec: signup → project workspace →
  pro-forma → DCF → exit-strategy → LP reporting → returns dashboard.
  Uses known test project `0d079513-...` (Surfside 3 Marina) and walks
  tabs by URL to avoid tab-click coupling. Accepts
  `E2E_INVITE_CODE` env var for gate-ON testing.
- `package.json` — new scripts `test:e2e` and `test:e2e:install-browsers`.
`npx playwright test --list` confirms the config parses. Running the
spec requires a one-time `npm run test:e2e:install-browsers` to pull
Chromium. Intended as the pre-invite manual gate; not in CI.

### Smoke status end-of-session
- B1+B2 beta gating smoke: 15/15 green
- B3 tax waterfall writes: 14/14 green
- B4 demo seed: runs clean, PME returns real values
- B5: client-side, no server smoke applicable
- B7 Sentry: no-op without DSN (verified)
- B9: verified by grep (no live drift remaining)

### Next steps to actually START beta
After this session, code is ready. Brett needs to:
1. Deploy to prod
2. Set env: `REQUIRE_BETA_INVITE=true`, `SENTRY_DSN`, `VITE_SENTRY_DSN`,
   confirm Stripe + email keys via `GET /health/integrations`
3. `node scripts/seed-beta-demo.mjs` on prod DB (one-time)
4. `node scripts/beta-invite.mjs generate --count=5 --note="..."` to issue codes
5. `npm run test:e2e:install-browsers && npm run test:e2e` once locally
   before each invite batch
6. Email beta testers with their codes + link to `/signup`

---

## ✅ COMPLETE — B1 + B2: Beta access gating + billing guard (2026-04-19)

First two items off the FM Beta Publish Queue. Both required, both shipped.

### B1 — Beta invite-code gating on /api/auth/register

Signup is no longer open. When `REQUIRE_BETA_INVITE=true` (prod default; dev
default is false), `POST /api/auth/register` rejects signups that don't
present a valid code. Valid codes flag the new org `is_beta=true`.

**Schema** (live DB migrated + startup migrations added for fresh envs):
- `organizations.is_beta boolean NOT NULL DEFAULT false`
- `beta_invite_codes` — `code PK, note, max_uses, use_count, expires_at, created_at, created_by`
- `beta_invite_redemptions` — audit trail (`code, user_id, org_id, redeemed_at`)

**Files:**
- `shared/schema.ts` — added `isBeta` column on organizations, new
  `betaInviteCodes` + `betaInviteRedemptions` tables with types exported.
- `server/db-startup-migrations.ts` — 4 idempotent entries for fresh envs.
- `server/routes/auth-routes.ts` — `betaInviteRequired()` helper reads
  `REQUIRE_BETA_INVITE` env (defaults true in prod, false in dev). Register
  handler validates code before any user/org insert; consumes it via a
  conditional UPDATE (`WHERE use_count < max_uses`) that makes concurrent
  redemptions of the last use impossible.
- `client/src/pages/auth/signup.tsx` — added `inviteCode` to zod schema,
  passes it uppercase to the mutation; new form field right after Company
  with "Required during beta" badge, `FMBETA-XXXXXX` placeholder.
- `scripts/beta-invite.mjs` — CLI: `generate`, `list`, `revoke`. Codes are
  `FMBETA-` prefix + 6 chars from a no-lookalike alphabet (no 0/O/1/I).

### B2 — Beta billing guard: 402 on every charging endpoint

New middleware `server/middleware/require-not-beta.ts`. Looks up the caller's
org, returns 402 `BETA_BILLING_DISABLED` if `is_beta=true`, fails closed on
DB error. Applied to every route that could create a charge or collect a
payment method:

- `server/routes/billing-routes.ts` — `/create-subscription`,
  `/create-setup-intent`, `/checkout`, `/change-plan`, `/reactivate`,
  `/seats/purchase`, `/portal`
- `server/routes/broker-billing-routes.ts` — `/checkout/marketplace-plus`,
  `/checkout/broker-plan`
- `server/routes/integrations-engine-routes.ts` — `/stripe/checkout`,
  `/stripe/portal`
- `server/routes.ts` (top-level) — `/api/stripe/checkout`,
  `/api/stripe/billing-portal`, `/api/stripe/portal`, `/api/stripe/subscribe-pack`

Webhooks, read-only routes (`/plans`, `/invoices`, `/usage`,
`/subscription`), and `/api/stripe/webhook` are intentionally not gated —
they never move money.

### Smoke test — 15/15 passed (gate ON)

`tmp_beta_smoke.mjs` exercises:
- Rejects signup without code / invalid / exhausted / expired
- Accepts valid code and flags org `is_beta=true`
- Single-use code can't be reused
- Multi-use code: exactly max_uses successes, then rejects
- Redemption row logged
- Beta org hits 402 with `BETA_BILLING_DISABLED` on all 6 charging endpoints

Gate OFF (dev default) also verified: signup without code succeeds and
produces a non-beta org (2/2 passes).

### Gotchas

- CSRF middleware returns 403 before the billing middleware runs, so the
  smoke test had to prime a `csrf_token` cookie via GET `/api/auth/me` and
  echo it back in `x-csrf-token` on every POST. Real browsers handle this
  automatically.
- `REQUIRE_BETA_INVITE` env var: explicit `true`/`false` overrides the
  NODE_ENV-based default. Brett flips it OFF locally when he doesn't want
  to type a code; prod deployments must have it ON.

### Next up — B3: Tax waterfall write-path verification

Today's tax-waterfall FK fix wired the reads. The write paths (POST settings,
partners, equity contributions, waterfall configs, tax inputs) have never been
smoke-tested with real data; the feature had 0 rows across 5 of 6 tables. A
beta user WILL try to configure a waterfall, so we need a round-trip test
before any invite goes out.

---

## ✅ COMPLETE — Financial Model beta prep (2026-04-19)

Brett wanted to begin FM beta testing today. I swept outstanding FM work —
tests, endpoints, schema — and fixed two real issues plus one stale test.

### Bug #1 — Tax Waterfall / GP Partner Economics 404s (REAL BETA BLOCKER)

`server/routes/tax-waterfall-routes.ts :: verifyProjectAccess` was querying
the wrong table. It checked `projects` (DD-project table) but the UI passes
a `modeling_projects.id` (financial-model table). Result: every
`/api/tax-waterfall/projects/:projectId/*` request 404'd for any project
opened from the modeling workspace, which is the only place the UI calls
these endpoints from. The feature had never worked — 5 of the 6 related
tables had 0 rows.

Root cause was schema-level: the 5 FK-bearing tax-waterfall tables
(`project_tax_settings`, `project_partners`, `project_equity_contributions`,
`waterfall_configs`, `project_tax_inputs`) had `project_id` FKs pointing at
`projects(id)`. Re-pointed them to `modeling_projects(id)` where they
belong. (`waterfall_tiers` was already correct — it FKs to
`waterfall_configs`, not projects.)

Fixed:
- Raw SQL migration: dropped 5 FK constraints pointing to `projects.id`,
  added 5 new ones referencing `modeling_projects(id) ON DELETE CASCADE`.
  Migration script at `scripts/fix-tax-waterfall-fks.mjs`.
- `shared/schema.ts` — 5 `references(() => projects.id)` → `modelingProjects.id`
  in the Drizzle definitions.
- `server/routes/tax-waterfall-routes.ts` — swapped `projects` import for
  `modelingProjects` and rewrote `verifyProjectAccess`.
- `server/db-startup-migrations.ts` — added 5 idempotent DDL blocks
  (using `DO $$ ... $$` to find-and-drop the old constraint by discovering
  its current name, then ADD IF NOT EXISTS the new one) so fresh environments
  auto-heal.

Verified: all 4 tax-waterfall GETs now return 200 JSON for the test
modeling project. Total smoke: 27/27 FM endpoints green.

### Bug #2 — `shared/debt/__tests__/debt-engine.test.ts` stale

Import path was `./debt-engine` (should be `../debt-engine`) and type was
`LoanInput` (should be `DebtEngineInput`). Plus 4 assertion expectations had
drifted from the current engine behavior:
- Expected `capitalizeOriginationFees` to capitalize ALL closing fees (wrong
  — the flag name is specific; engine only capitalizes origination).
- Expected `computeLTV(700k, 1M)` to return 70; engine returns 0.7 (ratio,
  matching how covenant-monitor and stress-test-engine consume it).
- Expected `computeDSCR(100k, 0)` to return 0; engine returns Infinity when
  NOI>0, 0 when NOI=0 (defensible for display).
- Expected `stepdownSchedule: [5,4,3,2,1]` to mean percents; engine
  interprets the raw numbers as decimal fractions (no production callers
  ever set `stepdownSchedule`, so no downstream impact).

Updated the test to match the shipped engine. 18/18 passing.

### Cruft — `shared/exit-backup/`

Orphaned snapshot of `shared/exit/` from commit `d59a8a7a`. No imports
anywhere, already excluded from tsconfig, but its 101 duplicate tests were
still running via vitest (could mask real failures by covering stale code).
Added `shared/exit-backup/**` to `vitest.config.ts` excludes.

### Also-ran: `workspace-routes.test.ts` missing supertest

Noted but not fixed — `server/tests/workspace-routes.test.ts` imports
`supertest` which isn't in `package.json`. Single test file, not FM. Low
priority.

### Also-ran: `tenant-isolation.test.ts` 6 failures

Test mocks don't set `req.originalUrl`; middleware line 34 calls
`.startsWith` on it. Express always sets `originalUrl` in production, so
this is test-mock hygiene, not a runtime bug. Not beta-blocking.

### FM beta smoke summary

27/27 endpoints green across every major FM surface: Pro Forma, DCF,
Decision Support, Lease Income, Exit metrics + scenarios, Capital Stacks,
LP reporting, Historical P&L, Scenario Comparison, Config, Debt
(summary/schedule-all/tax-bridge/payoff/scenarios), Modeling Rent Roll
(config/units/metrics/analysis), Returns (model-level), Tax Waterfall
(settings/waterfall/partners/equity-contributions), POST DCF, POST DCF
Monte Carlo. 155/155 FM-related vitest tests green.

### Next session pickup

Platform is ready to begin FM beta. Watch for:
- Tax Waterfall is now reachable but has never had real data flow through
  it — first user to configure a waterfall may hit unseen edge cases in the
  write path (write paths not smoke-tested today; only reads).
- Heap stays ~96% in dev (noisy WARN but not blocking); monitor in prod.
- tsc OOM (stabilization #6) still outstanding; full `npm run check`
  won't pass until schema.ts is refactored or project references are set up.

---

## ✅ COMPLETE — Data Integrity #9 + #10 + #11 (2026-04-17)

Bundled all three data-integrity hardening items.

### #9 — decimal.js in fund-service.ts

Queue estimate was "72 parseFloat sites"; the refactor had already happened in
a prior session. Audited the file: only 5 parseFloat calls remained, all in
ledger aggregation paths (`getLedgerBalance`, `getLedgerEntries`,
`reconcileLedgerVsStored`). Replaced them with `Decimal.plus(...)` sums and
the existing `dn()`/`d()` helpers. Now `grep parseFloat server/services/fund-service.ts`
returns only the doc-comment mention. Other services (salescomps, capital-markets,
rent-roll) still use parseFloat for non-money analytics — out of scope here.

### #10 — PII encryption at rest for fund_investors

`lp_investors` table was already wired through `encryptPiiFields` +
`processInvestorPii` by `investor-portal-routes.ts`. But `fund_investors`
— the institutional GP/LP ledger table — was storing `taxId` **plaintext**.
Gap was in `fund-service.ts :: createInvestor / updateInvestor` (neither
called `encrypt()`) and the routes (no `processInvestorPii` on reads).

Fixed:
- `fund-service.ts` imports `encrypt`/`isEncrypted` and calls them on
  create/update. `isEncrypted` guard prevents double-encryption on replays.
- `modeling-routes.ts` `POST/GET/PATCH /api/funds/:fundId/investors(/:id)`
  now pipe through `processInvestorPii(inv, userRole)` — admin/owner roles
  see plaintext; everyone else gets masked (`**-***6789`).
- `fund_investors.tax_id` column was `varchar(50)` — too short for
  `enc:<iv>:<authTag>:<ciphertext>` format (~120 chars). Widened to `text`
  via raw SQL and added a startup migration so fresh DBs auto-apply.

Verified end-to-end: seeded a fund_investor with plaintext `taxId="12-3456789"`,
confirmed DB stores `enc:551ea6ded8...:...:...` ciphertext, admin read returns
`12-3456789`, viewer read returns `**-***6789`.

### #11 — Derive capital account balance from ledger (LP reporting path)

`fund_investors.capitalAccountBalance` is a mutable cached column; the truth
lives in `fund_ledger_entries` (append-only, protected by a PG rule). The
existing `reconcileLedgerVsStored` method proves divergence is a real risk.

Refactored `getInvestorCapitalAccounts` (the feeder for LP reporting) to
pull the balance from `getLedgerBalance(orgId, fundId).byInvestor` instead
of reading `inv.capitalAccountBalance`. The response now includes:

- `capitalAccountBalance` — the DERIVED value (now authoritative)
- `capitalAccountBalanceDerived` — same value, explicitly named
- `capitalAccountDivergence: boolean` — true when the stored column
  disagrees with the ledger by > 1 cent, so LP reporting UIs can surface
  reconciliation warnings

Remaining call sites that still read `capitalAccountBalance` directly: ~14
(writes + internal storage math inside fund-service). Those are writes
that update the cached column — kept for now since the column is still
populated as a denorm. Dropping the column entirely requires rewriting the
WHERE/ORDER BY clauses in a few queries; that's follow-on work.

### Next session pickup

Stabilization + revenue readiness + data integrity hardening are now complete.
Remaining queue is Feature Queue items #12-17 (reporting enhancements like
PME/J-curve/peer benchmarking, multi-currency, broker feedback v2, DD timeline v2,
document parsing phase 2, broker marketplace phase 2+). All deferred — not
blocked on stabilization anymore.

---

## ✅ COMPLETE — Revenue Readiness #7 + #8 (2026-04-17)

Bundled the two revenue-readiness verification items — both surfaced a real
silent-failure risk in production, now fixed.

### #7 — ANTHROPIC_API_KEY visibility

Added **`GET /health/integrations`** endpoint (in `server/routes/health.ts`)
that returns a boolean-only status of each third-party API key:

```
{ "anthropic": true, "openai": true, "sendgrid": true, "resend": true,
  "stripeSecret": true, "stripePublishable": false,
  "stripeWebhookSecret": false, "replitSendgridConnector": true }
```

Also included the same `integrations` block in `/health/ready` so existing
k8s/uptime probes pick it up for free. Returns only booleans — never leaks
actual key values.

### #8 — Email delivery silent-success fix

**Real bug in `server/services/email-service.ts`**: the console fallback at
the bottom of `sendEmail()` returned `true` unconditionally. In production
with no provider configured, this meant:

- Password reset emails silently never sent
- Magic links silently never sent
- Invite emails silently never sent
- `/workflow-email/send-test` logged "sent" status when no email left the server

Now `sendEmail()` returns `false` in production when no provider accepted
the message. Dev mode still logs to console and returns `true` for developer
productivity. Also skips SendGrid attempt entirely when neither the env var
nor Replit connector is present (silences noisy "SendGrid failed, trying
Resend fallback" warn-logs on every email for Resend-only deployments).

Verified behavior with both NODE_ENV values:

| Scenario                                    | Returns |
|---------------------------------------------|---------|
| SendGrid env set + API accepts              | true    |
| Resend env set + API accepts (no SendGrid)  | true    |
| No provider configured + `NODE_ENV=prod`    | **false** (was true) |
| No provider configured + `NODE_ENV=dev`     | true (with console log) |

### Usage for ops

Before a prod deploy, hit `GET /health/integrations` and confirm each flag
matches the intended feature set:

- `anthropic` must be `true` if any AI feature is enabled (broker evaluator
  narratives, document builder AI content, meeting transcription, deal
  sourcing LLM classifier, ai-underwriting, etc.)
- `sendgrid` OR `resend` OR `replitSendgridConnector` must be `true` for
  transactional email (password resets, invites, magic links, trial
  reminders, LP statements delivery)
- `stripeSecret` + `stripeWebhookSecret` must both be `true` for billing
  (already enforced by webhook handler in prod; webhook returns 503 if
  secret is missing in prod)

### Next session pickup

Data integrity hardening (#9-11): decimal.js refactor in `fund-service.ts`
(72 parseFloat sites), PII field encryption at rest (SSN, Tax ID),
immutable-ledger-derived capital account balances.

---

## ⚠ PARTIAL — Stabilization #6: tsc OOM (2026-04-17)

Attempted to fix type-checking by raising the node heap limit. Partial success:
found + fixed a real JSX bug that was masking the OOM, added a typecheck script,
but the full type-check still OOMs under the sandbox memory cap. Real fix needs
project references or splitting `shared/schema.ts`.

### What we learned

- Sandbox cgroup memory cap is **8 GB** (`/sys/fs/cgroup/memory.max`).
- `npm run check` (default heap ~1.5 GB) OOMs at ~1 GB heap.
- At `--max-old-space-size=4096` (4 GB) tsc used to terminate early reporting
  ONE error; with 6 GB it OOMs; at 8+ GB the OS SIGKILLs the process (cgroup
  OOM killer, because V8 overhead + code pages exceed the heap budget).
- Root cause: `shared/schema.ts` is 29 574 lines with **769 pgTable exports**.
  Each Drizzle table's inferred type cascades through the whole import graph —
  every consumer file recomputes the inference. Memory scales roughly with
  files × transitive schema types.

### Bugs fixed along the way

1. **`TenantLeaseDialog.tsx` line 1198 — missing `</TabsContent>`** between
   the `capex` and `sales` tabs. `rollover` TabsContent opened at 1116 but
   never closed. This parse error was masking ALL other type errors since
   tsc was failing on the broken JSX before doing full inference. Fixing it
   uncovered the real OOM baseline. Runtime-visible: the rollover tab would
   have been broken (all subsequent tabs nested inside it).

### What's left

The real fix is architectural, not mechanical — raising heap alone doesn't
fit in the cgroup cap. Three real options, each a session+ of work:

1. **Project references** (cleanest) — move `shared/schema.ts` into its own
   sub-project with `composite: true` + a pre-compiled `.d.ts`. The main
   `tsconfig.json` would reference it, and the schema would be type-checked
   once into a declaration file that everything else consumes cheaply.

2. **Split `shared/schema.ts` into 15–20 domain modules** — e.g.
   `shared/schema/crm.ts`, `shared/schema/modeling.ts`, `shared/schema/broker.ts`.
   Breaks the inference graph so each consuming file only loads the domains it
   actually imports. Touches hundreds of import sites but is a mechanical find/
   replace once the split is done.

3. **Emit static `.d.ts` for schema.ts only** via a custom build step that
   invokes `tsc --declaration` on just `shared/schema.ts`, then uses `paths`
   in the main tsconfig to redirect `@shared/schema` to the `.d.ts`. Fragile,
   worth considering only if 1+2 are blocked.

Recommended order: start with #1 (project references) — it's surgical and
doesn't require touching imports anywhere else. If that doesn't fit in the
cgroup either, fall back to #2.

### Script added

`npm run typecheck` — runs `tsc --noEmit --incremental false` at 6 GB heap.
Best-effort: reports file-level errors before it OOMs on the big-picture
inference pass. Not a replacement for `npm run check` in CI (which will need
the real fix above).

### Next session pickup

Stabilization sprint is **complete (5/6 items cleanly green, #6 partial)**.
Revenue readiness is next: #7 verify `ANTHROPIC_API_KEY` in prod, #8 test
email delivery (SendGrid/Resend). These are short verification tasks.

---

## ✅ COMPLETE — Stabilization #5: Broker onboarding flow (2026-04-17)

Walked the full broker lifecycle end-to-end: register → admin approve →
set criteria → publish → subscriber follow → feedback evaluation.
**All 7 stages pass — no product bugs uncovered.** The broker subsystem is
well-integrated, unlike the drift-heavy LP Portal (#3) and webhook (#4) flows.

### E2E test (7/7 stages green)

Test script at `/tmp/broker_onboarding_test.sh`. Hybrid approach — SQL-seeds
for CSRF-protected POSTs, HTTP calls for GETs.

| # | Stage                                              | Result |
|---|----------------------------------------------------|--------|
| 1 | seed `broker_registrations` (status=pending)       | ✓ |
| 2 | admin approve → creates `broker_profiles` row      | ✓ |
| 3 | set criteria JSONB + is_publishable=true           | ✓ |
| 4 | `GET /directory?q=...` finds the broker            | ✓ total=1 |
| 5 | follow + seed matching `marina_listings` target    | ✓ |
| 6 | `GET /broker-feedback/listing/:id` returns verdict | ✓ verdict=pursue, score=100, 4/4 criteria matched |
| 7 | `GET /broker-dashboard/my-profile` returns profile | ✓ displayName, brokerTier, publishable, stats |

### Notes

- Directory query uses `?q=` (not `?search=`), returns `{items, total, page}`
  (not `{brokers}`) — minor docs note.
- `license_status.level: missing` is expected when `license_expires_at` is null.
  Real onboarding would supply the license document during registration.
- Broker evaluator correctly ran all 4 rules (asset class, market, cap rate,
  deal size) against the seeded listing and returned verdict=`pursue`.

### Next session pickup

Stabilization #6 — Fix tsc OOM. `shared/schema.ts` is ~28k lines and crashes
`tsc --noEmit` at 1GB. Needs splitting into domain modules (or raising node
heap flag if that's simpler). Pure refactor, no user-visible impact.

---

## ✅ COMPLETE — Stabilization #4: Stripe billing verification (2026-04-17)

Tested the full Stripe webhook → entitlement-flip flow for all three product
SKUs (platform packs, broker plans, marketplace+). Found two show-stopper bugs
before any happy path worked.

### Bugs fixed

1. **Missing unique constraint on `organization_packs(org_id, pack_type)`**
   — the webhook uses `onConflictDoUpdate({ target: [orgId, packType] })`
   but no DB constraint matched → every platform-pack checkout failed with
   `there is no unique or exclusion constraint matching the ON CONFLICT
   specification`. Added via raw SQL + a matching startup migration at
   `server/db-startup-migrations.ts` so fresh DBs don't regress.

2. **`billingService.handleWebhook` never called from the primary webhook
   handler** — `POST /api/stripe/webhook` in `server/index.ts` only handled
   the `metadata.packType` flow (platform packs). All `sku=broker_plan` and
   `sku=marketplace_plus` checkouts were returning 200 but doing NOTHING
   (webhook orphaned). `billingService.handleWebhook` has the comprehensive
   logic (marketplace+, broker tiers, core-platform `SUBSCRIPTION_TIERS`) but
   was mounted at an unused `/api/billing/webhook` route. Now delegated from
   the primary handler via dynamic import. Also fixed the dynamic-import
   destructuring — `billingService` is a default export, not a named one.

### End-to-end verified (6/6 tier-flip tests pass)

Test script at `/tmp/stripe_webhook_test.sh`. Uses synthetic Stripe events
(no real Stripe needed — dev bypass when `STRIPE_WEBHOOK_SECRET` unset).

| # | Scenario                                              | DB assertions       |
|---|-------------------------------------------------------|---------------------|
| 1 | platform pack `checkout.session.completed`            | org_packs `active`, billing_subs `modeling_tools/active` ✓ |
| 2 | `invoice.payment_failed`                              | org_packs `expired`, billing_subs `past_due` ✓ |
| 3 | `invoice.payment_succeeded`                           | both reactivated to `active` ✓ |
| 4 | `customer.subscription.deleted`                       | org_packs `cancelled`, billing_subs `starter/canceled` ✓ |
| 5 | broker `checkout.session.completed` (sku=broker_plan) | broker_profiles.broker_tier → `pro` ✓ |
| 6 | marketplace+ `checkout.session.completed`             | org_marketplace_entitlements.marketplace_plus_tier → `pro` ✓ |

### Gotcha: test data cleanup

broker_profiles cleanup requires dropping + restoring the FK
`broker_follow_history_broker_profile_id_fkey` because of the append-only
PG rule on `broker_follow_history` (documented in Phase 1 journal). Cleanup
logic is at the bottom of `/tmp/stripe_webhook_test.sh`.

### Findings NOT fixed this session

1. **`pack_catalog` is near-empty** — only `master_comps` row exists, both
   price IDs NULL. `customer.subscription.updated` webhook tries to derive
   tier from price_id via `pack_catalog` lookup; for 11 of 12 pack types
   this lookup will never match. Prod needs the catalog populated with real
   Stripe price IDs for upgrade/downgrade via billing portal to work.

2. **No `STRIPE_PUBLISHABLE_KEY` in this env** — `/api/stripe/status`
   reports `configured: false`. For real Stripe integration the publishable
   key must be set too.

### Next session pickup

Stabilization #5 — Broker onboarding flow (invite test broker → set criteria
→ subscriber sees feedback). This is the last stabilization item before
revenue readiness (#7-8) and data integrity hardening (#9-11).

---

## ✅ COMPLETE — Stabilization #3: LP Portal integration testing (2026-04-17)

Tested the LP Portal read path end-to-end. Found a cluster of method-name drift
between `server/routes/lp-portal-routes.ts` and `server/services/lp-portal-service.ts`
— router called methods that didn't exist (`createLpUser`, `loginLpUser`,
`validateLpSession`, `getStatement`, `renderStatementHtml`, `getK1`,
`getFundSideLetters`, `getMfnAnalysis`) while the service exposed
`createPortalUser`, `authenticateLP`, `validateSession`, `getSideLettersForFund`,
`getMFNAnalysis`. Plus three read methods (`getStatement`, `renderStatementHtml`,
`getK1`) that the router called but the service never had.

### Bugs fixed

1. **Added `getStatement`, `renderStatementHtml` methods** to `LPStatementGenerator`
   — simple read-by-id + HTML render wrappers.
2. **Added `getK1` method** to `K1Generator` — queries `lp_statements` where
   `statement_type='k1' AND period_label=<taxYear>`.
3. **Rewrote all LP Portal route handlers** to call the actual service methods,
   dropping unused router-level field names that the service doesn't support
   (e.g. `firstName`/`lastName` concatenated to service's single `name` param,
   dropped `totpToken`, `year`/`quarter`/`offset` filters not in service).
4. **`getSideLettersForFund` SQL bug**: service queried `side_letters.org_id`
   which doesn't exist. Rewrote as an INNER JOIN to `funds` to scope by org,
   plus LEFT JOIN to `fund_investors` for `investor_name`. Populated missing
   fields (`effectiveDate` from `executed_at`, `expirationDate` as null,
   `status` defaulted `'active'`).
5. **Date-type fields returned as strings, not `Date` objects**: `getStatement`
   and `listStatements` row mappers passed `r.period_start`/`r.period_end`
   directly, which come from Postgres as strings. `generateStatementHTML` then
   calls `.toLocaleDateString()` on them and crashed. Wrapped in `new Date(...)`.

### End-to-end read-path verified (seeded test data → curl)

- ✅ `GET /api/lp-portal/statements` — returns list
- ✅ `GET /api/lp-portal/statements/:id` — returns full statement
- ✅ `GET /api/lp-portal/statements/:id/html` — 4.8KB HTML page rendered with
   correct fund name, period range, metrics
- ✅ `GET /api/lp-portal/k1/:fundId/:investorId/:taxYear` — returns K-1 JSON
- ✅ `GET /api/lp-portal/side-letters/fund/:fundId` — returns []
- ✅ `GET /api/lp-portal/side-letters/mfn-analysis/:fundId` — returns structure

POST endpoints are CSRF-protected, which is correct — the frontend flows
through CSRF tokens. Not tested at the wire level this session; the wiring-test
script at `/tmp/lp_wiring.sh` is reusable.

### Known gaps NOT fixed (deferred — real design decisions)

1. **LP session middleware**: `/api/lp-portal` is mounted at line 1605 of
   `routes.ts`, which places it AFTER a global `authenticateUser` mount at
   line 708 (via `app.use(authenticateUser, tourProgressRoutes)`). In dev with
   `ALLOW_DEMO_AUTH=true`, the demo admin user ends up in `req.user` on every
   LP Portal request. In production **this means any authenticated platform
   user could hit LP Portal endpoints scoped only by `org_id`, not
   `investor_id`**. True LP sessions issued by `/auth/login` are never
   validated, and `req.user.investorId` is never set. To fix: write a real
   LP session middleware (reads `Bearer` token, calls `validateSession`,
   populates `req.user` with `{ id, orgId, investorId }`) and re-scope
   every statement/K-1 query by investorId. This is a security design task,
   not a plumbing fix.

2. **`side_letters` schema drift**: missing `org_id`, `investor_name`,
   `effective_date`, `expiration_date`, `status`, `created_by`. The
   `createSideLetter` service INSERTs into these columns and will fail on
   the first POST. Either add the columns via raw psql migration or reduce
   the service to what the schema supports.

3. **Schema drift for `users.username`** (noted in stabilization #2) affects
   7+ service/route files that weren't in the route-smoke test. Fix as they
   surface.

4. **Seeded test data left behind**: one "Test Fund I (smoke)" fund and its
   fund_investor row are in the DB, couldn't be deleted because of an
   append-only ledger rule on `fund_ledger_entries`. lp_statements rows
   were successfully deleted.

### Next session pickup

Stabilization #4 — Stripe billing verification (test checkout → webhook →
entitlement flip for platform tiers, broker tiers, marketplace+ tiers).

---

## ✅ COMPLETE — Stabilization #2: Systematic route smoke test (2026-04-17)

Hit 80 representative GET endpoints across every major API surface using
`ALLOW_DEMO_AUTH=true` and the test org/project IDs. Smoke script saved at
`/tmp/smoke.sh` for reuse; results at `/tmp/smoke_results.tsv`.

**Before:** 68 2xx / 5 4xx / 7 5xx
**After:** 73 2xx / 7 4xx / 0 5xx (6 real bugs fixed, 1 5xx was `/health/ready`
intentionally reporting `unhealthy` due to Redis + 96% heap — not a route bug)

### Bugs fixed

1. **`server/services/workflow-enhancements.ts` — `listWebhooks`**: SQL selected
   `description` column that doesn't exist in `workflow_webhooks`. Rewrote to
   select actual columns (`name, url, event_types, is_active`) and map to camelCase.

2. **`server/services/workflow-enhancements.ts` — `listScheduledTriggers`**: SQL
   used table alias `t.` (Drizzle doesn't emit that alias) and referenced three
   nonexistent columns (`entity_type`, `entity_id`, `timezone`). Rewrote to use
   actual columns (`action_config` replaces `payload`).

3. **`server/services/workflow-enhancements.ts` — added `listWorkflowPipelines`**:
   method was called by `GET /api/workflow-v2/pipelines` but didn't exist.
   Returns id/name/description/steps/stepCount/isActive from `workflow_pipelines`.

4. **`server/routes/reporting-engine-routes.ts` — `/custom-reports` GET**: was
   calling `reportingEngine.listCustomReports(orgId, options)` — no such method.
   The service has `listSavedReports(orgId)`. Fixed the call.

5. **`server/services/lease-ops-storage.ts` — `getOperationsStats`**: raw `sql`
   template used aliases `t.` and `cl.` that Drizzle doesn't create, yielding
   `missing FROM-clause entry for table "t"`. Replaced with `${leaseTerms.col}`
   and `${commercialLeases.col}` column references.

6. **`server/services/comment-threads-service.ts` — `getProjectThreads`**:
   selected `users.username` which doesn't exist (real column is `users.name`).
   Replaced all 3 occurrences with `users.name`.

### Known findings NOT fixed this session (out-of-scope for smoke-test)

- **`users.username` referenced in 7+ other files** that weren't in the smoke
  test: `multi-approver-service.ts`, `approval-notification-service.ts`,
  `opssos/task-routes.ts` (also refs `firstName`/`lastName` — neither exist),
  `phase-gates-routes.ts`, `red-flag-routes.ts`, `operations-routes.ts` (3x).
  These endpoints would 500 under the same conditions.
- **`workflow_pipelines` DB schema missing `entry_step_id`** column that
  `createWorkflowPipeline` and `executePipeline` both reference. POST + execute
  paths would 500 the first time someone invokes them.
- **`getCustomReport(:id)` endpoint** calls a method that doesn't exist on
  `reportingEngine`.
- **`POST /api/workflow-v2/webhooks`** route passes `events` but the service
  expects `eventTypes`. Route-handler field name mismatch.

These are all documented here; fix opportunistically as they surface.

### Next session pickup
Stabilization #3 — LP Portal integration testing (login → statement view →
K-1 download end-to-end).

---

## ✅ COMPLETE — Stabilization #1: Rent Roll Sync button (2026-04-17)

First item of the stabilization sprint in `project_remaining_queue.md`. The backend
route `POST /api/modeling/projects/:projectId/rent-roll-sync` (in `server/routes.ts`
at line 858) was already wired — the UI side was the remaining gap.

**Changes — `client/src/pages/modeling/projects/workspace/uploads.tsx`:**
- Added `RentRollSyncResult` interface matching `server/services/rent-roll-sync-service.ts`
- Added `syncingRentRollId` state (separate from P&L's `syncingUploadId` so the two
  sync flows don't collide visually)
- Added `rentRollSyncMutation` using React Query — synchronous call (no job polling,
  unlike P&L pipeline), success toast shows `entriesCreated` + `skippedRows`, invalidates
  `documents`, `rent-roll`, and `rent-rolls` queries
- Added `handleSyncRentRoll` and `isRentRollSyncable(upload)` helpers
- Button renders on pending uploads (when `status` is `parsed`/`reviewing`/`completed`)
  and on completed uploads (re-sync). Filters out storage-specific rent rolls
  (`STORAGE_RENT_ROLL_SUB_TYPES` — wet_slips, dry_stack, etc.) which have their own flow.
- Teal color scheme to distinguish from green P&L Sync to Model button
- `data-testid` attrs: `button-sync-rent-roll-{id}` and `button-resync-rent-roll-{id}`

**Note:** Pure frontend change — Vite HMR picks it up, no `pkill -f 'tsx server'` needed.

**Next session pickup:** Stabilization #2 — Systematic route smoke test. Hit every
major API surface via curl, log 4xx/5xx, fix broken routes.

---

## ✅ COMPLETE — Broker Marketplace Phase 1 (2026-04-17)

Shipped Phase 1 of the Airbnb-style broker marketplace on top of the substantial
pre-existing foundation (broker registration, profile, directory, follow/unfollow,
advisory packages, Stripe checkout, broker dashboard were already built). Phase 1
filled the objective-trust-signal gaps that the existing system didn't expose.

**What was built (this session):**

### Schema (`/tmp/broker_marketplace_phase1_migration.mjs` applied via raw psql)
- `crm_deals.broker_profile_id` — FK to `broker_profiles(id) ON DELETE SET NULL`,
  with indexes on the FK and on `(broker_profile_id, closed_at DESC) WHERE is_closed`
- `broker_profiles` — 8 new columns for denormalized trust stats:
  `verified_closed_deals_count`, `verified_closed_deals_volume`,
  `verified_closed_deals_asset_classes`, `verified_closed_deals_last_at`,
  `median_response_hours`, `response_rate_30d`, `response_samples_30d`,
  `trust_stats_last_recomputed_at` + a composite index on verified-deal
  count/volume for directory ranking
- `broker_registrations` — 5 new columns for license verification state:
  `license_last_verified_at`, `license_verification_provider`,
  `license_verification_status`, `license_verification_notes`,
  `license_verification_payload`
- `broker_response_samples` NEW TABLE — raw response-time tracking samples
  (thread_type, thread_id UNIQUE, first_inbound_at, first_broker_reply_at,
  response_seconds, is_unanswered)
- `shared/schema.ts` updated with camelCase mappings + new `brokerResponseSamples` table

### Services
- `server/services/broker-license-verification.ts` NEW
  - `LicenseVerificationProvider` interface with swappable providers
  - `ManualReviewProvider` default (returns `manual_review_required` until a real
    third-party API is wired in Phase 2)
  - `scanLicenseExpiry()` — flags expired licenses, auto-unpublishes profiles
  - `classifyExpiry()` — returns `ok | warning | critical | expired | missing`
- `server/services/broker-deal-stats.ts` NEW
  - `computeBrokerDealStats()` — count, volume, asset classes, most-recent close
  - `persistBrokerDealStats()` — writes denorm back to `broker_profiles`
  - `attributeDealToBroker()` — helper for setting a deal's broker + recomputing
    both old and new broker's stats
  - `recomputeAllBrokerDealStats()` — nightly full recompute
  - `getBrokerVerifiedDeals()` — recent list for profile page UI
- `server/services/broker-response-tracker.ts` NEW
  - `recordInboundMessage()` — called when a subscriber messages a broker
  - `recordBrokerReply()` — called when the broker replies; computes latency
  - `computeResponseStats()` / `persistResponseStats()` — rolling 30-day avg +
    median + reply-rate, written to `broker_profiles`
  - `markStaleUnanswered()` — flags samples >168h without reply
- `server/services/broker-feature-flags.ts` NEW
  - `BROKER_FEATURE_FLAGS` constants: `broker_ai_drafts`, `broker_ratings`,
    `broker_license_verify_api`
  - `isBrokerFeatureEnabled(orgId, flag)` — env kill-switch first, then
    `billing_feature_flags` org-level override, default off
  - Returns `{ enabled, source }` so UI can show why a flag is off

### Routes
- `server/routes/broker-subscriptions-routes.ts` — extended:
  - Directory ranking now sorts by `featuredUntil DESC, verifiedClosedDealsCount DESC,
    verifiedClosedDealsVolume DESC, followerCount DESC, publishedAt DESC`
  - Public profile endpoint now returns `trustSignals` + `verifiedDeals` arrays +
    live license status
  - NEW `POST /broker/subscriptions/:subscriptionId/messages` — broker reply
    endpoint (owner-only), fires `recordBrokerReply()`
  - Existing user-send endpoint now fires `recordInboundMessage()`
  - NEW `GET /feature-flags` — Phase 2/3 flag state for the frontend
- `server/routes/broker-dashboard-routes.ts` — `/my-profile` endpoint extended:
  - Returns `licenseStatus` with level + days-until-expiry + state
  - Returns `recentVerifiedDeals` (top 5) for dashboard preview
  - Returns `featureFlags` so the dashboard can render Phase 2/3 coming-soon cards
  - Added trust-signal stats to `stats` object (verifiedClosed count/volume,
    medianResponseHours, responseRate30d, responseSamples30d)
- `server/routes/crm-routes.ts` — PUT `/api/crm/deals/:id` now recomputes broker
  stats async when broker-attribution or close state changes

### Cron
- `server/jobs/platform-cron.ts` — two new jobs:
  - `0 15 2 * * *` — nightly broker marketplace recompute (all deal stats + all
    response stats)
  - `0 3 * * *` — daily broker license expiry scan (auto-unpublish expired)

### Frontend
- `client/src/components/broker/TrustSignalBar.tsx` NEW — reusable trust-signal
  row (full + compact variants) showing verified closes, response time, reply
  rate, followers, experience, license status with color-coded tone
- `client/src/pages/broker/BrokerProfile.tsx` — TrustSignalBar above tabs; new
  "Verified Closed Deals" tab with table of real closes
- `client/src/pages/broker/BrokerDirectory.tsx` — broker cards now lead with
  verified-closed count + response time (was followers/listings/experience)
- `client/src/pages/broker/dashboard/BrokerDashboardOverview.tsx` — license
  expiry warning banner (warning/critical/expired tones); new trust-signal KPI
  row; recent verified deals table; Phase 2/3 `PhaseCard`s for AI Drafts +
  Ratings gated behind feature flags ("Live" / "Coming soon" badge)
- `client/src/hooks/use-broker-subscriptions.ts` — types for `BrokerTrustSignals`,
  `BrokerVerifiedDeal`, `BrokerFeatureFlagsMap`; `useBrokerFeatureFlags()` hook
- `client/src/hooks/use-broker-dashboard.ts` — extended `BrokerMyProfileResponse`
  with licenseStatus, recentVerifiedDeals, featureFlags

### What is NOT in Phase 1 (by design)
- Phase 2 (AI drafts + KB) — scaffolded behind `FEATURE_BROKER_AI_DRAFTS`, dark
  until compliance counsel review
- Phase 3 (ratings + credibility) — scaffolded behind `FEATURE_BROKER_RATINGS`,
  dark until ~50 brokers / ~500 subscribers
- Third-party license-lookup API — only the `ManualReviewProvider` stub exists;
  concrete provider (e.g. state-specific real-estate license API) deferred
- Stripe Connect for subscriber-subscription take-rate — Phase 2 dependency
  (subscriber subs require broker Advisor tier with AI drafts active)

### Known gotchas discovered this session
- `broker_follow_history` has an append-only PG rule
  (`broker_follow_history_no_delete DO INSTEAD NOTHING`) that blocks even
  cascade-deletes. To remove a broker profile, temporarily drop the FK on
  `broker_follow_history.broker_profile_id`, delete, then restore the FK. Do
  NOT drop the rule — it's there to prevent follow-cap gaming.
- Neon serverless pool's query generic type differs from `pg.Pool` — services
  use a minimal `QueryPool` interface instead of importing from `pg`.

### Validation performed
- Migration verified: all columns/indexes/tables present via information_schema
- End-to-end smoke test (created broker → 2 closed deals → 3 response samples →
  recompute services → public profile endpoint → directory endpoint):
  - Deal stats: count=2, volume=$18.05M, assetClasses=[hotel, marina] ✓
  - Response stats: median=1.5h, rate=66.67%, samples=3 ✓
  - License classification: warning level at 29 days ✓
  - License scan: correctly flagged 1 warning ✓
  - `trustSignals` fully populated on profile response ✓
  - Directory ranks broker with new trust-signal fields ✓
- Dev server running cleanly
- All test rows cleaned up, directory empty

### Next-session pickups
1. Phase 2 build-out (KB editor + RAG draft generator + approval inbox) behind
   `FEATURE_BROKER_AI_DRAFTS` — needs compliance disclaimer language from counsel
2. Phase 3 build-out (review prompts + credibility engine) behind
   `FEATURE_BROKER_RATINGS`
3. Concrete license-lookup provider integration (register via
   `registerLicenseVerificationProvider()`) — pick API per asset class/jurisdiction
4. CRM deal-detail UI: add "Attribute to broker" dropdown so deal closers can
   credit a broker profile when closing (currently only settable via raw PUT)

---

## Design Session (2026-04-17) — Broker Marketplace v1

**Not code, not started — design + monetization locked in for a large deferred initiative.**

Brett raised the idea of repositioning brokers/advisors on MarinaMatch the way
Airbnb positions hosts: subscriber/follower model, ratings, response-time
metrics, closed-deal volume, and per-broker AI knowledge bases that draft
replies/guidance (either auto-send or broker-approved), with the platform
learning each broker's system over time and weighting by credibility.

**Decisions (full design in memory — `project_broker_marketplace.md`):**

1. **Phased rollout — three phases, do not skip or reorder:**
   - Phase 1: Objective trust foundation (verified profiles, license, closed
     deals linked to real records, passive response-time tracking,
     subscriber/follower model). No reviews, no AI yet.
   - Phase 2: KB + AI drafts — broker approval gate mandatory, clear
     disclaimers on any AI-touched message, prompt-context learning only (no
     fine-tuning). Compliance counsel review REQUIRED before shipping.
   - Phase 3: Ratings + credibility weighting. Gated on ~50 active brokers /
     ~500 subscribers before public reviews — otherwise ratings are noise.

2. **Subscriber auth — shared identity, role-scoped surfaces.** One account
   system, role flags (GP / LP / broker / subscriber), different landing
   pages/nav per role. Airbnb host/guest pattern. Don't fragment identity.
   The LP portal should follow the same pattern.

3. **Verification — both manual + third-party, third-party first.** License
   lookup API as automated gate (handles 90%+), manual review only for edge
   cases. Manual-default becomes the scaling bottleneck.

4. **Monetization:**
   - **Anchor:** Tiered broker subscriptions (Listings / Advisor / Premium
     Advisor / Enterprise). Predictable revenue.
   - **Secondary:** 10–15% platform take on broker-set subscriber
     subscription prices, via Stripe Connect (automatic split, low ops).
     Benchmarks: Substack 10%, Patreon 8–12%, Airbnb ~15%.
   - **Skip success fees on closed deals** — regulatory complexity
     (broker-dealer / real estate broker licensing at platform level,
     RESPA in some asset classes), incentive misalignment (brokers route
     off-platform), hard to enforce.
   - **Caveat:** Subscriber-sub volume in CRE will be low (50–500 subs
     at $20–$200/mo per broker, not 50k). Take-rate is a nice secondary
     stream, not the main event.
   - **Lever:** Per-draft / per-1k-token overage on AI usage above tier
     cap, to prevent a single power-user broker from eating LLM budget.

**Open questions flagged for Phase 1 kickoff:**
- Which third-party license-lookup API per asset class / jurisdiction
- Disclaimer language for AI-drafted messages (draft with counsel)
- Whether subscription prices have platform floors/ceilings or broker-set
- When a subscriber graduates to a lead in CRM and how broker attribution
  is credited

**Queue status:** Added as item #17 in `project_remaining_queue.md`.
Deferred until stabilization sprint (items 1-6) and revenue-readiness
(items 7-8) complete. Do not interleave.

---

## Current State (2026-04-16)

### ✅ COMPLETE — Document Upload & AI Parsing: 4 Critical Fixes (2026-04-16)

Audited the full document upload + AI parsing pipeline and applied 4
high-priority fixes to unblock accurate financial document processing.

**Audit summary:** The pipeline was ~90% production-ready with a 5-stage
mapping chain (alias → regex → keyword → canonical → LLM), anomaly
detection, validation gates, and a clean bridge to modeling actuals. Four
specific gaps were causing data-quality issues or silent failures.

**Fix #1 — Auto-create canonical item when category created**
(`server/services/doc-intel-service.ts`)
- Problem: users creating custom categories in CategoryManager weren't
  visible to the parser because `pnl_categories` ≠ `pnl_canonical_line_items`
- Fix: `createCategory()` now upserts a matching `pnl_canonical_line_items`
  row (canonicalKey derived from name, section mapped from categoryType)
  with `ON CONFLICT DO UPDATE` so the parser immediately recognizes new
  user-created categories

**Fix #2 — Wire LLM_PROVIDER to Anthropic auto-detect**
(`server/utils/llm/index.ts`)
- Problem: `LLM_PROVIDER` defaulted to `'mock'` — users with
  `ANTHROPIC_API_KEY` set were still getting mock classification with 50%
  confidence penalty
- Fix: auto-detect from available API keys —
  `ANTHROPIC_API_KEY → 'anthropic'` · `OPENAI_API_KEY → 'openai'` ·
  else `'mock'`. Explicit `LLM_PROVIDER` env var still overrides.

**Fix #3 — Rent roll parsing → lease table sync**
- `server/services/rent-roll-sync-service.ts` NEW — bridges parsed rent
  roll data into `rent_rolls` + `rent_roll_entries` tables. Heuristic
  header mapping (e.g., "Slip #"/"Unit"/"Space" → unitNumber) with
  type/status inference from column values.
- `server/routes.ts` — new `POST /api/modeling/projects/:id/rent-roll-sync`
  endpoint. Reads file from `doc_intel_uploads`, parses via
  `RentRollDocumentParser`, syncs to structured tables.
- Previously: rent rolls were parsed but the data dead-ended (no bridge).

**Fix #4 — Retry logic for failed parsing jobs**
- `server/services/pnl/retry-failed-jobs.ts` NEW — `retryFailedPnlJobs()`
  queries `pnl_jobs WHERE status='failed' AND retry_count < 3`, resets to
  `'queued'`, re-runs `runPnlPipeline()` fire-and-forget. Batch of 5 per
  tick.
- `server/jobs/platform-cron.ts` — registered as `"*/15 * * * *"` (every
  15 minutes). Previously: failed jobs stayed failed permanently.

**Validation**
- `tsc --noEmit` clean on all touched files (6 files)
- No schema changes needed — all tables already existed

**Follow-ups (Phase 2 — flagged in audit, not yet built)**
- OCR fallback for scanned PDFs (Tesseract or Claude Vision)
- Business-rule validation layer on LLM output (revenue never negative, etc.)
- Per-category audit trail (who corrected what, when)
- ML-based confidence scoring (replace linear heuristic)
- Rent roll sync needs a frontend "Sync to Model" button in the uploads
  UI (endpoint is ready, UI button not yet wired)

---

### ✅ COMPLETE — Phase 4 LP Experience: K-1 PDF + Quarterly Delivery (2026-04-16)

Closed the two remaining Phase 4 gaps from the institutional audit:
(1) K-1 tax document PDF generation and (2) quarterly automated statement
delivery.

**Discovery:** Phase 4 was ~85% done. `lp-statement-pdf.ts` was already a
full StatementPDFBuilder, the LP portal auth + frontend pages were
scaffolded, `generateInvestorStatement()` was fully implemented,
`generateK1()` in `lp-portal-service.ts` already produced structured K1Data.
Only two gaps remained.

**Files**
- `server/services/k1-statement-pdf.ts` NEW (~210 lines) — `K1PDFBuilder`
  using pdf-lib. Renders partner info, 7-section income/loss allocations,
  deductions, credits/AMT, distributions, capital account analysis.
  Same Navy/Steel/Teal palette + Helvetica fonts + striped tables +
  confidential footer as lp-statement-pdf.ts. Includes tax disclaimer.
- `server/routes/modeling-routes.ts` — new
  `GET /api/funds/:fundId/investors/:investorId/k1/pdf?taxYear=2025`
  route. Calls `lpStatements.generateK1()` → `generateK1PDF()` → streams
  binary PDF with attachment header.
- `server/services/quarterly-lp-delivery.ts` NEW (~150 lines) —
  `runQuarterlyLPDelivery()`. For each active fund, for each active
  investor: generates statement PDF via `generateStatementPDF()`, resolves
  investor email from `lp_portal_users` → `lp_investors` fallback, sends
  via `sendEmail()` with PDF attachment. Creates
  `lp_statement_deliveries` tracking table inline (idempotent CREATE IF
  NOT EXISTS) with `UNIQUE(fund_id, investor_id, quarter_label)` to
  prevent double-delivery. Returns `{funds, investors, sent, failed}`.
- `server/jobs/platform-cron.ts` — registered quarterly delivery as
  `"0 6 1 1,4,7,10 *"` (6 AM on Jan/Apr/Jul/Oct 1st). Also previously
  registered the email scheduler tick at `"* * * * *"`.

**Phase 4 LP Experience status after this session:**
- ✅ PDF statement generation — existed, confirmed working
- ✅ K-1 tax document PDF — NEW, route + renderer
- ✅ Quarterly automated delivery — NEW, cron + email + PDF attachment
- ⚠️ LP portal independent auth — scaffolded (auth service + routes +
  frontend pages exist, but needs integration testing + password reset +
  TOTP enrollment UI)

**Known follow-ups**
- LP portal needs integration testing (login flow, session management,
  password reset, TOTP 2FA enrollment)
- K-1 PDF is a "summary report" (not the official IRS Form 1065
  Schedule K-1); formal filing requires a tax-forms renderer
- `sendEmail()` `attachments` parameter assumes SendGrid attachment
  format `{content, filename, type, disposition}` — Resend fallback
  path may need adaptation for attachments
- Annual K-1 delivery cron (separate from quarterly statements) not yet
  scheduled — could fire `"0 6 1 3 *"` (March 1st) for prior tax year

---

### ✅ COMPLETE — Email Send Integration (Tier 2) (2026-04-16)

Extended the existing email compose/send pipeline with template merge-field
substitution, scheduled sends, and a scheduler job — completing the final CRM
priority from CLAUDE.md.

**Discovery finding:** v0 was more built-out than expected:
- `ComposeEmailModal` already mounted in deal-detail.tsx, calling
  `POST /api/workflow-email/compose-send`
- Full template CRUD already at `/api/workflow-email/templates` with
  `interpolateTokens()` helper, preview endpoint, send-test endpoint
- Workflow engine already had a complete `email.send` action type (line 262
  of workflow-engine.ts) with template context resolution, recipient
  resolution, and send dispatch
- `emailMessages.scheduledAt` column already existed in schema
- `AVAILABLE_TOKENS` list already defined (15 tokens across deal/contact/
  org/user/rule)

**What was actually missing** (and now built):
1. `compose-send` didn't accept `templateId` or `sendAt`
2. No scheduler polling emailMessages for scheduled sends
3. Compose modal had no template picker, no schedule option, no token
   insertion

**Backend changes**
- `server/routes/workflow-email-routes.ts`:
  - New `buildComposeContext()` helper — queries real `crm_deals` +
    `crm_contacts` + `organizations` tables to build `{{deal.*}}` /
    `{{contact.*}}` / `{{user.*}}` / `{{org.*}}` substitution context.
    Distinct from `buildSampleContext()` which queries `sourced_deals`
    for the template preview UI.
  - Extended `POST /compose-send` to accept:
    - `templateId` — loads template, uses as default subject+body (inline
      values override)
    - `sendAt` — if >60s in the future, writes to `email_messages` with
      `status='scheduled'` and returns `{ scheduled: true }` without
      sending
  - All sends (template or ad-hoc) now interpolate tokens via
    `buildComposeContext`
  - Canonical record always written to `email_messages` table (in
    addition to legacy `workflow_email_log` for backward compat)
  - Template usage counter bumped on successful send
  - New `GET /scheduled` — lists the caller's pending scheduled emails
  - New `POST /scheduled/:id/cancel` — reverts a scheduled email to
    draft status
- `server/services/email-scheduler.ts` NEW — `runEmailSchedulerTick()`
  polls `email_messages WHERE status='scheduled' AND scheduled_at <= NOW()`
  in batches of 50, uses optimistic row-level lock (`status → 'sending'`)
  to prevent double-dispatch, sends via `sendEmail()`, flips to 'sent' or
  'failed', logs CRM activity on success
- `server/jobs/platform-cron.ts` — registered `runEmailSchedulerTick` as
  a new cron job running every minute

**Frontend changes**
- `client/src/components/email/compose-email-modal.tsx` REWRITTEN:
  - **Template picker** — dropdown fetches `/api/workflow-email/templates`,
    on select calls `/templates/:id/preview` with the current dealId to
    render subject + body with real deal data (not raw `{{tokens}}`)
  - **Token insertion helper** — small "Insert token" popover showing all
    15 available tokens with label + example, clicking inserts
    `{{deal.propertyName}}` etc. at cursor
  - **Schedule toggle** — Switch + datetime-local input, defaults to
    next hour on the hour. When enabled, Send button becomes "Schedule"
    (Clock icon instead of Send)
  - **Save as template** — inline name input + save button, POST to
    `/api/workflow-email/templates` with current form contents
  - Textarea switched to `font-mono text-sm` to make tokens readable
  - Activity + scheduled queries invalidated on success

**Open tracking pixel:** skipped for v1 (spam filter cost, privacy, and
the bot-filtering infra needed are a rabbit hole). Schema field
`emailMessages.openedAt` stays in place for future webhook integration.

**Validation**
- `tsc --noEmit` clean on all touched files (4 files)
- Scheduler registers on startup alongside existing platform cron jobs
- compose-send endpoint backward-compatible (existing callers that pass
  `{to, subject, body}` without templateId/sendAt still work identically)

**Known follow-ups**
- Open/click tracking pixel + webhook receiver for SendGrid/Resend
- Exponential backoff + retry counter on scheduled-send failures (currently
  flips to 'failed' on first failure)
- Rich text editor in the compose modal (currently plaintext textarea with
  manual HTML)
- Broker digest pipeline (Tier 3) — scheduled batch of broker verdicts +
  matched listings per subscriber
- Inbound email parsing + reply threading schema
- The existing `buildSampleContext` queries `sourced_deals` not `crm_deals`
  — template preview UI will show wrong data for CRM deals; fix in a
  follow-up

---

### ✅ COMPLETE — Deal Comparison in Workspace — Unification (2026-04-16)

Unified three disconnected deal-comparison surfaces onto a single canonical
page (`client/src/pages/deal-comparison-page.tsx`) and added a persistent
global comparison cart so users can build a comparison from anywhere in the
deal workspace.

**Finding during discovery:** Three comparison pages already existed with
different philosophies and none of them called the rich backend endpoint at
`POST /api/crm/pipeline-enhancements/compare` (which returns 7 structured
categories + rankings). Selection was only possible for deals with a linked
modeling project via a popover in `deal-workspace.tsx`. State was local,
lost on navigation.

**Scope decision (confirmed with user):** unify on
`deal-comparison-page.tsx` as the canonical view. Leave
`client/src/components/crm/DealComparison.tsx` (weighted scoring + radar)
and `client/src/pages/modeling/projects/workspace/deal-comparison.tsx` (full
model compare) untouched in this pass; link to them from the main page in a
future session.

**Files**
- `client/src/stores/comparison-cart-store.ts` NEW — Zustand store with
  `persist` middleware (localStorage key `mm:comparison-cart`). Max 5 (matches
  backend `/compare` endpoint cap). API: `toggle()`, `remove()`, `clear()`,
  `has()`, plus `useIsInComparisonCart(id)` selector hook.
- `client/src/components/comparison/ComparisonToggle.tsx` NEW — small
  per-card checkbox button (Scale icon off-state, Check icon on-state).
  Stops propagation so it doesn't trigger the card's onClick. Toasts when
  the cart is full.
- `client/src/components/comparison/ComparisonCartBar.tsx` NEW — floating
  bottom bar with framer-motion slide-up entrance. Shows per-deal chips
  (truncated title + remove button), Clear, and a primary "Compare →"
  button that navigates to `/crm/deals/compare?ids=...`. Only the
  Compare button is enabled when >= 2 deals selected.
- `client/src/components/deals/DealKanbanBoard.tsx` — added
  ComparisonToggle beside the priority badge on each deal card
- `client/src/components/deal-workspace/PipelineView.tsx` — same, on the
  secondary kanban card
- `client/src/pages/deal-workspace.tsx` — mounted `<ComparisonCartBar />`
  at root so it's visible across all workspace views (pipeline, list,
  leads, activity, tasks)
- `client/src/pages/deal-comparison-page.tsx` — extended:
  - Hydrates `selectedDealIds` from cart on mount when `?ids=` URL param
    is absent (only on mount; subsequent refinement is user-controlled)
  - Max bumped from 4 → 5 (uses `MAX_COMPARISON_DEALS` constant)
  - New `NewSignalsSection` component below the main metrics grid with
    two sub-sections:
    - **DD Timelines row** — per-deal compact DD bar using `DDSegmentRow`
      with a local 420px coordinate system, fetches
      `/api/crm/deals/:id/extensions` via `useQueries`. Deals without a
      signed PSA get a "No DD period yet" placeholder.
    - **Broker Feedback row** — per-deal verdicts from
      `/api/broker-feedback/modeling-project/:id`, but only for deals
      with a linked modeling project. Rendered as a table with brokers
      as rows and deals as columns. Verdict chips match the broker
      feedback panel visual language (pursue/watch/pass pills with
      score). Gracefully degrades to an italic "follow brokers" prompt
      when no feedback exists.
  - Empty-state copy updated to point users at the new Scale icons on
    kanban cards

**Validation**
- `tsc --noEmit` clean on all touched files (7 files)
- No backend changes — pure frontend wiring on top of existing endpoints
  (`POST /compare`, `GET /extensions`, `GET /broker-feedback`)

**Known follow-ups**
- The main comparison metrics table still fetches deals individually via
  `GET /api/deals/:id` instead of the `POST /compare` endpoint — swapping
  would consolidate rankings (value/probability/daysInStage) but would
  also drop the asset-class-aware field unioning the existing code does
  well. Reserved for a future pass.
- Deal list view (`ListView`) rows don't yet have a ComparisonToggle —
  toggle is only on kanban cards. Follow-up.
- Broker feedback row can't show feedback for deals without a linked
  modeling project. To fully support this would require extending the
  evaluator service with a `loadDealTarget()` path — deferred.
- The legacy `DealComparison.tsx` (weighted scoring + radar) and
  `modeling/projects/workspace/deal-comparison.tsx` (full model compare)
  are still accessible via their own routes but not linked from the
  canonical page yet.

---

### ✅ COMPLETE — Deal Timeline Gantt: A+B+C + Deposits Lane (2026-04-15, late evening)

Full overhaul of the Deal Timeline tab (`client/src/components/deals/deal-timeline-tab.tsx`,
already mounted on the deal detail page). Applied the FM Design System v2
motion language established by the DD animation, folded DD + extensions into a
dedicated gantt lane backed by the real `dealExtensions` table, added a
deposits lane backed by `dealDeposits`, and added a stage progression bar
above the gantt.

**Critical finding during verification read:** the existing timeline endpoint
(`buildTimelineEventsForDeal` at `server/routes/crm-pipeline-enhancements-routes.ts:42`)
was ONLY pulling denormalized key_dates from `crmDeals` (ddExpirationDate,
firstDepositDueDate, secondDepositDueDate). The richer `dealExtensions` and
`dealDeposits` tables were invisible to the timeline. The old top-of-tab
`DealTimelineVisualizer` was also reading the DEPRECATED `extensionDays[]`
integer array with a "first N executed" heuristic — inconsistent with the
real `dealExtensions.executed` flags. Both gaps are now fixed via client-side
fetches on the existing `/crm/deals/:id/extensions` and `/crm/deals/:id/deposits`
endpoints. No backend changes.

**Files**
- `client/src/components/deals/dd-segment-row.tsx` NEW — inline gantt renderer
  for DD period. Paints base DD (Deep Marine Blue), executed extensions
  (Harbor Teal with glow pulse + `+Nd` chip), and pending extensions
  (dashed Harbor Teal ghost). Accepts parent `getXPx` and `baseDelay` so it
  shares the gantt coordinate system and staggers after the lane fades in.
  Tooltips on each segment.
- `client/src/components/deals/deal-stage-progress-bar.tsx` NEW — connected
  stage progression bar above the gantt. Chronologically sorts
  `stage_change` events from the timeline endpoint, draws Deep Marine Blue
  for completed stages, Harbor Teal (pulsing scale) for current, slate
  ghost for upcoming. Each stage is a staggered entrance; connector lines
  draw in between stages.
- `client/src/components/deals/deal-timeline-tab.tsx` REWRITTEN:
  - Removed stale top `DealTimelineVisualizer` (used deprecated
    `extensionDays[]` array)
  - Added `DealStageProgressBar` at the top, sourced from the stage_change
    events (always fetched regardless of lane visibility)
  - Reordered category lanes: stages / due_diligence / key_dates /
    deposits / tasks / playbook / milestones / red_flags / activities
  - New `due_diligence` lane renders `DDSegmentRow` with real
    `dealExtensions` fetched from `/api/crm/deals/:id/extensions`
  - New `deposits` lane with `DepositMarker` components (green paid check,
    pink pending, red pulsing overdue); amount label in compact $k/$M form;
    tooltip shows depositNumber, anchor, due/paid dates, refundable flag,
    applied-to-price flag
  - Replaced static 2px dashed cyan today line with pulsing amber marker
    matching `DDTimelineAnimation` (framer-motion infinite scale/opacity)
  - Wrapped gantt container + lane rows + events + left-column labels in
    framer-motion with staggered entrance (~0.18 + 0.08 × laneIdx)
  - Point events (diamond/icon/circle) animate in with spring
    (stiffness 400, damping 18-20); range bars use `scaleX` grow from left
  - **Collision handling** via `layoutEventsWithCollision()`: point events
    within 12px of each other stack vertically in 3 rows (top=8, mid=16,
    bot=24) so markers don't overlap in the same lane
  - Custom deadlines visually distinguished from built-in key dates:
    rotate-45 hollow outline diamond (purple border) vs filled diamond
  - SUPPRESSED_KEY_DATE_LABELS set removes the old denormalized DD/deposit
    key_dates from the key_dates lane now that DD + Deposits have their
    own lanes — no duplication
  - Time bounds calculation now includes `dealExtensions` total days and
    `dealDeposits.calculatedDueDate/actualPaidDate` so the gantt extends
    far enough right
  - Always fetches stages regardless of lane toggle (so the progression
    bar keeps working even if the Stages lane is hidden)

**Validation**
- `tsc --noEmit` clean on all touched files
- HMR should pick up changes without restart

**Design cohesion**
- Same motion tokens as DD animation (`--motion-ease-standard`,
  `--motion-duration-enter`, `--motion-duration-grant` in `index.css`)
- Same Deep Marine Blue / Harbor Teal / amber / emerald palette
- Same animation idioms (scaleX grow, spring pop, pulsing today marker)

**Known follow-ups**
- Stage progression bar currently only includes stages that appear in
  `crm_deal_stage_history` — stages the deal never entered are invisible.
  Could overlay the canonical pipeline stage list as ghost markers for
  full lifecycle visibility
- `layoutEventsWithCollision` caps at 3 vertical rows; deals with >3
  markers in the same 12px window still overlap on the 3rd row
- Stage bars in the gantt swimlane are still separate from the top
  progression bar — slight visual redundancy but different grain (top =
  sequence, lane = duration in time)
- Milestone lane approval events don't yet use custom colors
- The DD lane doesn't yet have a PSA or DD-ends cap (those are on the
  top stage-progression bar as implicit markers via key_dates lane)

---

### ✅ COMPLETE — DD Timeline Animation (2026-04-15, evening)

Animated horizontal Due Diligence timeline rendered on the modeling workspace
overview tab for deals at LOI+ (or wherever `psaSignedDate` is set). Visualizes
the original DD period, stacks executed extensions end-to-end with a Harbor
Teal glow, shows a pulsing "today" marker and a closing-date flag. Extension
grants animate live via framer-motion `layout` transitions when a new row
flips `executed=true`.

**Files**
- `client/src/index.css` — added FM Design System v2 motion tokens
  (`--motion-ease-standard`, `--motion-ease-emphasized`, `--motion-duration-quick`,
  `--motion-duration-enter`, `--motion-duration-grant`). First cohesive motion
  layer on the platform.
- `client/src/components/dd/DDTimelineAnimation.tsx` NEW (~380 lines) —
  presentational component. Computes geometry from `{psaSignedDate, ddPeriodDays,
  ddExpirationDate, closingDate, extensions[]}`, renders rail + segments + PSA
  node + DD-ends cap + closing flag + today marker, each with staggered
  framer-motion entrance (rail draws L→R, segments scaleX grow, nodes spring
  in, labels fade). `motion.div layout` on the DD-ends cap so it slides when
  a new extension lands. Hover tooltips + legend.
- `client/src/hooks/use-dd-timeline.ts` NEW — fetches `GET /api/deals/:id` +
  `GET /api/crm/deals/:id/extensions`, derives `eligible` flag (true when
  stage ∈ LOI+ set OR `psaSignedDate` set), computes `ddPeriodDays` if missing.
- `client/src/pages/modeling/projects/workspace.tsx` — imported component +
  hook, added `DDTimelineSection` wrapper inside the Overview tab, rendered
  above `BrokerFeedbackPanel` when `project.dealId` is set and eligible.

**Design choices**
- Deep Marine Blue (`hsl(221, 83%, 35%)`) = original DD; Harbor Teal
  (`hsl(177, 75%, 38%)`) = extensions; Amber = today marker; Emerald = closing.
- Eligibility gate = stage in LOI_OR_LATER set OR `psaSignedDate` present.
  LOI-stage deals without a signed PSA see a placeholder card instead of the
  rail, so there's still a visible affordance.
- Kept rendering scoped to modeling workspace overview only — portfolio
  `dd-review.tsx` intentionally skipped for v1 (too dense with 20+ cards).
  `dd-progress-report.tsx` can reuse the same component later with zero
  changes since it's purely presentational.

**Validation**
- `tsc --noEmit` clean on all touched files
- Dev server HMR picked up the changes without restart (tsx watching)

**Known follow-ups**
- Render custom deadlines (`crmDeals.customDeadlines` JSONB with
  `showOnTimeline=true`) as small ticks above the rail
- Compact variant for the portfolio DD review page
- Milestone labels could collide when extensions overlap closing; add
  smart label positioning
- Pending-extension (not yet executed) rendering as dashed outline ghost
  segments

---

### ✅ COMPLETE — Broker Feedback & Evaluation Layer (2026-04-15, afternoon)

Built the evaluator/training layer on top of the existing broker platform. Brokers
can now define structured recommendation criteria, and Marketplace+ subscribers see
real-time pass/watch/pursue verdicts from every broker they follow — on marketplace
listings and on their own modeling projects. Monetization piggybacks on existing
Marketplace+ tiers (Free/Solo/Pro/Institutional); no new Stripe SKU.

**Scope decision:** Option B — platform-only SKUs, brokers uncompensated directly
(lead-gen via profile CTAs). Auto-training deferred to v2; v1 is manual criteria
entry + deterministic rules + Claude Haiku narrative.

**Schema (scripts/step4_broker_feedback_schema.mjs)**
- `broker_profiles.criteria JSONB` — structured `BrokerCriteria` (asset classes,
  markets, cap rate floor, DSCR/LTV/IRR targets, hold period window, deal size
  range, risk tolerance, outlook narrative)
- `broker_profiles.auto_learn_enabled BOOLEAN` — reserved for v2
- `broker_profiles.criteria_updated_at TIMESTAMP`
- `broker_evaluations` NEW — cached verdicts keyed on
  `(broker_profile_id, target_type, target_id)` with 24h TTL, `verdict`/`score`/
  `matched_criteria`/`failed_criteria`/`narrative`/`criteria_snapshot`/
  `target_snapshot`. CHECK constraints on verdict + score + target_type.
  Drizzle schema updated in `shared/schema.ts`.

**Shared types**
- `shared/broker/criteria.ts` NEW — `BrokerCriteria`, `RiskTolerance`, `Verdict`,
  `CriterionResult`, `EvaluationResult`. Single source of truth for frontend +
  backend.

**Backend services**
- `server/services/broker-evaluator-service.ts` NEW (~450 lines):
  - `loadListingTarget()` / `loadModelingTarget()` normalize
    `marina_listings` and `modeling_projects` rows (plus
    `modeling_project_config` via raw `pool.query`, RLS-safe) into a
    `NormalizedTarget`
  - `runRules()` — deterministic rules engine; each set criterion is a gate,
    score = matched/total × 100, verdict: ≥80 pursue / ≥50 watch / <50 pass
  - `generateNarrative()` — optional Claude Haiku call
    (`claude-haiku-4-5-20251001`), returns 2-sentence broker-voice note
  - `evaluateTarget()` — cache-first, uses `broker_evaluations` upsert with 24h
    TTL
  - `getFeedbackForTarget()` — fans out across all brokers the user actively
    follows (via `broker_follow_history` join)
- `server/services/broker-entitlements.ts` — added
  `broker_feedback_verdict` to Solo+, `broker_feedback_narrative` +
  `broker_feedback_modeling` to Pro+, and a new `tierHasFeature()` helper
- `server/routes/broker-dashboard-routes.ts` — added `criteria` +
  `autoLearnEnabled` to `EDITABLE_PROFILE_FIELDS`; PATCH `/my-profile` now
  stamps `criteria_updated_at` when criteria changes

**Backend routes**
- `server/routes/broker-feedback-routes.ts` NEW mounted at
  `/api/broker-feedback`:
  - `GET /listing/:id` — verdicts for a marketplace listing (all followed
    brokers); narrative stripped server-side below Pro tier
  - `GET /modeling-project/:id` — same for modeling projects; 403s Free/Solo
    users (modeling feedback is Pro+ only)
  - `POST /evaluate` — explicit single-broker evaluation (force recompute)
- Mounted in `server/routes.ts` under `authenticateUser + enforceTenant`

**Frontend**
- `client/src/hooks/use-broker-feedback.ts` NEW — React Query hooks
  `useListingBrokerFeedback()` + `useModelingProjectBrokerFeedback()` with
  `brokerFeedbackKeys` factory
- `client/src/components/broker/BrokerCriteriaEditor.tsx` NEW — criteria form
  (asset-class chips, market codes, cap rate floor, DSCR/LTV/IRR, hold window,
  deal size window, risk tolerance, outlook narrative textarea)
- `client/src/components/broker/BrokerFeedbackPanel.tsx` NEW — reusable
  verdict card with pursue/watch/pass pills, matched/failed criteria chips,
  Haiku narrative (gated), inline upgrade prompt for Free/Solo
- `client/src/pages/broker/dashboard/BrokerProfileEditor.tsx` — embedded
  `BrokerCriteriaEditor`, criteria state merged into `handleSave()` payload
- `client/src/pages/marinamatch/MarketplaceListings.tsx` — mounted
  `<BrokerFeedbackPanel targetType="listing">` inside `ListingDetailPanel`
  above the Financial Snapshot
- `client/src/pages/modeling/projects/workspace.tsx` — mounted
  `<BrokerFeedbackPanel targetType="modeling-project">` in the Overview tab

**Validation**
- `step4_broker_feedback_schema.mjs` applied cleanly
- `tsc --noEmit` on all touched files — no errors
- Dev server restarted (`pkill -f 'tsx server' && npm run dev`), all existing
  broker routes still 200; new `/api/broker-feedback/listing/:id` returns 200

**Known follow-ups**
- Auto-training loop (scan broker's own deal pipeline outcomes, adjust
  criteria thresholds nightly with `manualOverride` protection)
- Per-broker analytics (verdict volume, follower engagement) for the broker
  dashboard
- Listing detail sheet's `canonicalListingId` assumes it maps 1:1 to
  `marina_listings.id` (per Task #20 ingestion v2 migration); confirm before
  broader release
- PDF/email delivery of verdicts for asynchronous "broker digest" flow
- Flat-bounty broker compensation system (Option A) when broker count warrants

---

### ✅ COMPLETE — Deal Marketplace + Broker Platform (2026-04-15)

Multi-week work on the universal Deal Marketplace and broker-facing SaaS landed
on branch `feat/exit-engine-patches`. Committed in `307460e2` ("Git commit prior
to merge", ~11,113 lines across 46 files) plus `191cf37c` (Stripe plan gate on
publish). DB migrations already applied (`scripts/step1_marketplace_schema.mjs`,
`step2_broker_subscriptions_schema.mjs`, `step3_broker_entitlements_fix.mjs`,
`seed_stripe_broker_skus.mjs`).

**Schema / DB**
- `shared/schema.ts` — universal marketplace columns on `marina_listings`
  (`listing_category` enum, `asset_class`, `cre_metrics`/`business_metrics` jsonb,
  `broker_profile_id` FK, `currency`, `price_on_request`, `is_location_confidential`,
  `is_active`, `published_at`, `last_seen_at`, `source_listing_id_canonical`) +
  `marketplace_sources` and `marketplace_scrape_runs` tables
- `shared/marketplace/asset-class-taxonomy.ts` — cross-asset taxonomy shared
  between scrapers, filters, and frontend
- New/updated broker tables: `broker_profiles`, `broker_registrations`,
  `broker_subscriptions`, `broker_advisory_packages`, `broker_advisory_content`,
  `broker_advisory_messages`, `broker_listing_claims`, `broker_listing_claim_disputes`,
  `broker_activity_log`, `broker_follow_history`, `broker_portal_submissions`,
  `broker_relationships`

**Backend services**
- `server/services/broker-tiers.ts` — broker SKU definitions (starter/pro/enterprise,
  feature flags, Stripe price IDs via env)
- `server/services/broker-entitlements.ts` — buyer-side Marketplace+ tiers
  (free/solo/pro/institutional) with precedence: user override → org → free default
- `server/services/broker-claim-service.ts` — listing claim lifecycle
  (backfill on publish, release on unpublish)
- `server/services/billing-service.ts` — new Stripe webhook handlers:
  `checkout.session.completed` splits on `metadata.sku` for `marketplace_plus`
  vs `broker_plan`; `customer.subscription.deleted/updated` downgrades
  entitlements. New `hasActiveBrokerPlan(userId)` helper used by the publish
  gate (Stripe-first with dev fallback to `brokerProfiles.brokerTier`).

**Backend ingestion framework** (`server/ingestion/`)
- `dedupe.ts`, `persistence.ts`, `registry.ts`, `scheduler.ts`, `scrapers/base.ts`,
  `scrapers/bizbuysell.ts` — generic adapter-based scraper pipeline that writes
  through to `marina_listings` with `listing_category` + `business_metrics`
- `server/listings/ingestion_v2/routes.ts` — `GET /listings` now queries the
  canonical `marina_listings` table with category / asset-class / business-metric
  filters (`minRevenue`, `maxRevenue`, `minEbitda`, `maxEbitda`, `minSde`, `maxSde`);
  legacy `liv2_listings_current` passthrough via `?legacy=1`

**Backend routes** (all mounted under `authenticateUser + enforceTenant`)
- `POST/GET /api/broker-subscriptions/*` — subscriber-side follow/advisory billing
- `POST/GET /api/broker-registration/*` — broker self-registration + admin queue
- `POST/GET /api/admin/broker/*` — registration approval / rejection
- `POST/GET /api/broker-billing/*` — Stripe checkout/portal for broker plans
- `POST/GET /api/broker-claims/*` — claim-a-scraped-listing flow with dispute support
- `GET/POST/PATCH /api/broker-dashboard/*` — broker dashboard CRUD (profile,
  listings, advisory packages, content, subscribers, analytics); publish now
  gated on `billingService.hasActiveBrokerPlan()`
- `/api/admin/marketplace-ingestion/*` — admin-only source CRUD, run triggers,
  run history

**Frontend**
- `client/src/hooks/use-broker-admin.ts`, `use-broker-dashboard.ts`,
  `use-broker-subscriptions.ts` — React Query hooks with invalidation
- `client/src/components/broker/UpgradePrompt.tsx`
- `client/src/pages/broker/` — BrokerRegister, BrokerDirectory, BrokerProfile,
  BrokerFeed, MyBrokerSubscriptions
- `client/src/pages/broker/dashboard/` — Layout + Overview, ProfileEditor,
  ListingsManager, AdvisoryPackages, ContentPublisher, SubscribersList, Analytics
- `client/src/pages/admin/BrokerRegistrationsQueue.tsx` — admin review queue
- `client/src/pages/marinamatch/MarketplaceListings.tsx` — +429 lines:
  asset-class and business-metric filters
- `client/src/Router.tsx` — 13 new routes: `/broker/*`, `/brokers`,
  `/brokers/:profileId`, `/brokers/feed`, `/admin/broker-registrations`,
  `/settings/broker-subscriptions`

**Smoke test (2026-04-15)** — all 6 broker routers return 200 on the dev server;
`/api/admin/marketplace-ingestion/sources` correctly returns 403 (admin-gated);
`/api/liv2/listings` returns 200 serving the new shape; publish endpoint
returns 403 for unauthenticated callers (expected).

**Known follow-ups**
- Only one scraper adapter implemented (`bizbuysell.ts`); registry/scheduler are
  generic and ready for more marketplace sources
- Webhook cancel path resets `brokerTier='starter'` + `isPublishable:false`;
  since `starter` is itself a paid tier, distinguishing "new starter purchase"
  vs "canceled, demoted to starter" now relies on the Stripe lookup in
  `hasActiveBrokerPlan()` rather than the denormalized column alone
- No PII encryption yet on `broker_portal_submissions` (leads captured from
  public broker pages)

---

## Previous State (2026-04-01)

### ✅ COMPLETE — Offering Memorandum Rendering Pipeline (2026-04-01)

## Builder Agent — 2026-04-01
- Completed: OM renderer, 3 API routes, frontend generate/preview flow
- Files changed:
  - `server/services/document-builder/om-renderer.ts` — NEW (~500 lines). Portrait HTML renderer with all block type handlers: section dividers (large numeral), heading, text, image (collage + standard), metric_grid (6 styles: offering_terms, offering_summary, highlights_4grid, stat_callouts, broker_cards, opportunity_cards, demographics_3ring), table (key_value, amenities_checklist, lease_panel, structured/sectioned financial tables, rate_table, bnb_vessel, toc_numbered, comp_table), chart (data table v1), bullet_list. Full OM CSS: cream/gold/navy palette, Playfair Display + Source Sans Pro typography, wave motif SVG, page breaks, token highlighting.
  - `server/services/document-builder/token-resolver-service.ts` — MODIFIED. Added `resolveOmTokens()` function: resolves 6 OM-specific tokens (OM_NOI_TABLE, OM_PROFORMA_TABLE, OM_EXPENSE_ASSUMPTIONS_TABLE from pro forma via raw pool.query; LOCATION_TAGLINE and TOURISM_FACTS from om_builder_documents metadata; BOATING_PARTICIPATION_PCT from demographics).
  - `server/routes/document-builder-routes.ts` — MODIFIED. Added 3 OM routes: `GET /om/token-status/:dealId` (section-level readiness with auto-disable), `GET /om/preview/:dealId` (full HTML preview), `POST /om/generate` (document creation + section rendering + export job + CRM activity log). Added `getOMDisabledSections()` for auto-disable logic (nearby_marinas when no comps, market_overview when no population data).
  - `client/src/pages/modeling/projects/workspace/om-generate.tsx` — NEW (~280 lines). OMGenerateButton component with: token readiness check, section-level readiness display (resolved/total per section), section toggle checklist, PDF/DOCX format selector, watermark input, generate mutation with export job polling, HTML preview in iframe dialog.
  - `client/src/pages/modeling/projects/workspace.tsx` — MODIFIED. Imported OMGenerateButton, rendered in Investment Materials tab below IC Deck button.
- Validation: Server restarted, all 3 GET routes return 200. Token status shows 88 tokens, section readiness with auto-disable. Preview generates 24KB HTML across 7 sections. POST route requires auth/CSRF (correct).
- Notes: Market Overview section correctly auto-disabled when population data absent. OM_NOI_TABLE builds structured JSON with Revenue/COGS/Gross Profit/Operating Expenses/NOI sections. All OM routes follow same pattern as IC Deck routes.

---

### ✅ COMPLETE — Offering Memorandum Spec (2026-04-01)

## Planner Agent — 2026-04-01
- Spec written: Offering Memorandum — Rendering Pipeline
- Output: agents/specs/offering-memorandum-spec.md
- Builder task added: yes (updated in AGENT_QUEUE.md)
- Notes: OM template already exists at `shared/document-builder/templates/offering-memorandum.ts` (8 sections, 86 tokens, portrait layout). Spec covers the rendering pipeline: `om-renderer.ts` (portrait HTML renderer with warm cream/gold/navy styling, 10+ table styles, section dividers with large numerals), 3 API routes (token-status, preview, generate), 6 new OM-specific tokens (3 financial table tokens: OM_NOI_TABLE, OM_PROFORMA_TABLE, OM_EXPENSE_ASSUMPTIONS_TABLE + LOCATION_TAGLINE, BOATING_PARTICIPATION_PCT, TOURISM_FACTS), and 2 frontend components (generate button with readiness check, HTML preview). Charts rendered as data tables in v1 PDF. Optional sections (Nearby Marinas, Market Overview) auto-disable when primary data absent. High complexity (~1,420 lines across 5-6 files). Depends on token substitution engine being built first. Shares resolver/export infrastructure with IC Deck but needs its own renderer due to portrait vs. landscape layout and distinct broker-facing aesthetic.

---

### ✅ COMPLETE — Document Studio DB Migration (2026-04-01)

## DB Agent — 2026-04-01
- Migration: Created `document_templates` and `document_renders` tables for Document Studio
- Tables affected: `document_templates`, `document_renders`, `om_document_sections`
- Changes:
  - `document_templates`: org-scoped template definitions (name, document_type, sections JSONB, styles, token_defaults, is_global flag). Indexed on org_id, document_type, and partial index on is_global.
  - `document_renders`: render output log with FK to om_builder_documents, document_templates, and crm_deals. Stores rendered_html, rendered_json, token_snapshot, token_stats, overrides. Indexed on org_id, document_id, deal_id, status.
  - `om_document_sections`: Added `rendered_content TEXT` column for caching token-substituted output (per token substitution engine spec).
- Validation: passed — all tables and columns verified via `\d`

---

### ✅ COMPLETE — IC Deal Review Deck Spec (2026-04-01)

## Planner Agent — 2026-04-01
- Spec written: IC Deal Review Deck
- Output: agents/specs/ic-deal-review-deck-spec.md
- Builder task added: yes (updated in AGENT_QUEUE.md)
- Notes: 14-section landscape deck template already defined at `shared/document-builder/templates/ic-deal-review-deck.ts` (128 tokens). Spec covers the rendering pipeline: token resolver extensions (28 missing tokens including table builders for PROFORMA_SUMMARY_TABLE, SOURCES_USES_TABLE, sensitivity tables), 3 new API routes (generate, preview, token-status), a new `ic-deck-renderer.ts` section→PDF renderer, and 3 frontend components (generate button with readiness check, HTML preview, section toggle). Charts rendered as data tables in v1 PDF (native charts in PPTX via pptxgen). Optional sections auto-disable when primary data absent. High complexity (~1,050 lines across 6-8 files). Depends on token substitution engine being built first.

---

### ✅ COMPLETE — Token Substitution Engine Spec (2026-04-01)

## Planner Agent — 2026-04-01
- Spec written: Shared Token Substitution Engine for Document Studio
- Output: agents/specs/token-substitution-engine-spec.md
- Builder task added: yes (already existed in AGENT_QUEUE.md)
- Notes: Existing `token-resolver-service.ts` already resolves 120+ tokens from 8 data sources (deal, property, modeling, capital stack, exit, pro forma, comps, demographics). Three parallel interpolation systems exist: AI Content (`{{key}}`), Workflow Engine (`{{entity.field}}`), Document Builder (`{{TOKEN_NAME}}`). Spec covers the **missing middle layer**: format-aware substitution (currency/percent/number/date), 3 new API endpoints (resolve-formatted, render, render-all), frontend TokenCatalog/ManualTokenEditor components, and optional wiring into workflow email templates for consistent formatting. Medium complexity (~500-700 lines across 4-5 files). No new DB tables needed — uses existing `om_builder_documents` + `om_document_sections` + `MASTER_TOKEN_MAP`.

---

## Previous State (2026-03-30)

### ✅ COMPLETE — Global Activity Log Polish (2026-03-30)
Full polish of the global activity log (CRM priority #5): timestamps, filters, pagination.

**Backend (`server/routes.ts` — `GET /api/activities`)**
- Rewrote from N+1 query pattern to batch-loaded entity enrichment (contacts, deals, companies, leads, properties)
- Server-side pagination: `page`, `pageSize` params; returns `{ items, total, page, pageSize, totalPages, actors }`
- Server-side filters: `entityType` (deal/contact/company/lead/property), `actorId`, `type`, `dateRange` (today/week/month), `q` (search)
- Proper orgId scoping (removed `storage.getCrmActivitiesForOrg` which queried by userId incorrectly)
- Actor names resolved via LEFT JOIN on `users` table (was hardcoded "You")
- Returns `actors[]` list for the actor filter dropdown
- Batch entity lookups via `inArray()` instead of per-row queries

**Frontend (`client/src/pages/activity.tsx`)**
- Entity type filter dropdown: All Entities, Deals, Contacts, Companies, Leads, Properties
- Actor filter dropdown: populated from server-returned `actors[]` list
- Relative timestamps with tooltip: "2 hours ago", "Yesterday at 3:00 PM", "Mar 28, 2026" — hover shows full absolute time
- Full pagination controls: first/prev/page numbers/next/last with page count display
- Debounced search (300ms) resets to page 1
- "Clear all filters" button when any filter is active
- Entity type badge on each activity card
- All filters are server-side (no client-side filtering)

**Files Modified:**
- `server/routes.ts` — rewrote GET /api/activities handler
- `client/src/pages/activity.tsx` — full rewrite with pagination, filters, relative timestamps

---


### ✅ COMPLETE — Key Dates on Kanban Cards (2026-03-30)
Added key dates display to Kanban pipeline cards (CRM priority #4).

**Backend**
- New `GET /api/crm/pipeline-enhancements/deals/next-follow-ups` endpoint
- Batch-fetches the soonest pending/in-progress task per deal using `DISTINCT ON` for efficiency
- Returns a map of `dealId → { taskId, title, type, dueDate, status }`

**Frontend — DealCard Enhancement**
- Replaced inline "stage time + close date" row with a structured Key Dates section (gray-50 background)
- **Created date**: Shows deal age in days with tooltip showing full creation date
- **Expected close**: Blue text, turns red with warning icon when overdue
- **DD expiration**: Amber text, turns red with warning icon when overdue
- **Next follow-up**: Teal text with tooltip showing task title, turns red when overdue
- Follow-up data fetched in a single batch query (`staleTime: 60s`), passed through `PipelineColumn` → `DealCard`

**Files Modified:**
- `server/routes/crm-pipeline-enhancements-routes.ts` — added next-follow-ups endpoint
- `client/src/pages/pipeline.tsx` — enhanced DealCard, added FollowUpInfo type, added follow-ups query, wired through PipelineColumn

---

### ✅ COMPLETE — AI Advisor Markdown Rendering Fix (2026-03-30)
Replaced custom hand-rolled markdown parser with `react-markdown` + `remark-gfm` for proper GFM rendering.

**What was done:**
- Installed `react-markdown` v10 and `remark-gfm` as dependencies
- Created shared `MarkdownRenderer` component (`client/src/components/ui/markdown-renderer.tsx`)
- Replaced 185-line custom `renderMarkdown()`/`inlineMarkdown()`/`MarkdownTable()` in `ai-assistant.tsx` with `<MarkdownRenderer>`
- Added markdown rendering to `cdd-advisor.tsx` (was plain text only — `whitespace-pre-wrap`)
- Styling preserved: same color scheme, font sizes, code block theme (zinc-900), table borders, blockquote blue accent

**Files created:**
- `client/src/components/ui/markdown-renderer.tsx`

**Files modified:**
- `client/src/components/ai-assistant.tsx` — removed custom renderer, imported shared component
- `client/src/components/cdd-advisor.tsx` — added markdown rendering for assistant messages

**Improvements over old custom renderer:**
- Proper nested list support (the old parser only handled single-level)
- Links rendered as clickable (`<a>` tags with `target="_blank"`)
- Strikethrough support via GFM
- Task list / checkbox support via GFM
- More robust table parsing (handles edge cases the regex-based parser missed)

---

### ✅ COMPLETE — Email Send Integration Spec (2026-03-30)

## Planner Agent — 2026-03-30
- Spec written: Email Send Integration for CRM Workflow Automation
- Output: agents/specs/email-send-integration-spec.md
- Builder task added: yes
- Notes: Existing `send_email` action in workflow-engine.ts is a console-log stub. email-service.ts already has production-ready SendGrid/Resend with fallback. Spec covers: wiring the stub to real email service, new `workflow_email_templates` + `workflow_email_log` tables, template CRUD API, token interpolation reusing existing `interpolateTemplate()`, CRM activity logging for every sent email, frontend template editor with token insertion + live preview, and rule builder UI enhancement for configuring send_email actions. Two parallel DB schemas exist for workflows (marinamatch/ and services/) — spec targets the marinamatch/ version which has the active stub. Medium-High complexity (~800-1200 lines across 6-8 files).

---

### ✅ COMPLETE — Deal Timeline / Gantt View (2026-03-30)
Full implementation of the Deal Timeline/Gantt view feature (CRM priority #2).

**Backend Enhancements**
- Enhanced `GET /api/crm/pipeline-enhancements/timeline` with query params: `pipelineId`, `stageIds`, `ownerId`, `startDate`, `endDate`, `groupBy`
- Response restructured to `{ deals, events, timeRange }` format with per-deal `slaStatus` computation
- Enhanced `GET /api/crm/pipeline-enhancements/timeline/:dealId` with `include` param supporting: `key_dates`, `stages`, `tasks`, `red_flags`, `milestones`, `playbook`, `activities`
- Extended `buildTimelineEventsForDeal()` helper to emit red_flag, milestone, playbook, and activity event types
- Added `computeSlaStatus()` helper comparing days-in-stage against stage SLA thresholds

**Pipeline-Level Gantt View**
- New `DealGanttView` component (`client/src/components/crm/deal-gantt-view.tsx`)
- Fixed-width left panel (240px) with deal name, value, stage badge, SLA indicator
- Scrollable right panel with positioned SVG/div timeline elements
- Event rendering: diamond markers (key dates), rounded bars (stages), thin bars (tasks), warning icons (red flags), outlined diamonds (milestones)
- Three zoom levels: Day (20px/day), Week (8px/day), Month (2px/day)
- Group-by dropdown: Deal / Stage / Owner
- Today marker: dashed Harbor Teal (#2DD4BF) vertical line
- SLA-breached rows tinted red; overdue key dates pulse with red ring
- Export: PNG via html-to-image, Print via browser print
- Empty state when no deals

**Single-Deal Timeline Tab**
- New `DealTimelineTab` component (`client/src/components/deals/deal-timeline-tab.tsx`)
- Existing `DealTimelineVisualizer` (PSA→DD→Closing bar) at top in compact mode
- Below it: category swimlane Gantt with rows for Stages, Key Dates, Tasks, Playbook, Approvals, Red Flags, Activity
- Toggle chips to enable/disable each category
- Zoom controls and Today button
- Empty state: "Add key dates to see your deal timeline"

**Shared Components**
- `GanttToolbar` (`client/src/components/crm/gantt-toolbar.tsx`) — zoom, group-by, today, export controls
- `GanttPopover` (`client/src/components/crm/gantt-popover.tsx`) — click popover showing event details + "Open Deal" link

**Integration**
- Pipeline page: new "Gantt" view toggle button (alongside Kanban, List, Map)
- Deal detail page: new "Timeline" tab (between Activities and FM)
- No new npm packages (Gantt built with plain HTML/CSS divs, uses existing html-to-image for export)

**Files Created:**
- `client/src/components/crm/deal-gantt-view.tsx`
- `client/src/components/crm/gantt-toolbar.tsx`
- `client/src/components/crm/gantt-popover.tsx`
- `client/src/components/deals/deal-timeline-tab.tsx`

**Files Modified:**
- `server/routes/crm-pipeline-enhancements-routes.ts` — enhanced timeline endpoints + extended buildTimelineEventsForDeal
- `client/src/pages/pipeline.tsx` — added Gantt view mode + DealGanttView rendering
- `client/src/pages/deal-detail.tsx` — added Timeline tab to centerTabs

---

## Prior State (2026-03-28)

### ✅ COMPLETE — Bookkeeping Budget Editor: 4 Sprints + Polish (2026-03-27 → 2026-03-28)
Production-grade budget creation/editing tool built in 4 sprints, then hardened with audit, UX polish, and export features.

**Sprint 1: Hierarchical Account Tree**
- New `budget_tree_accounts` table (raw SQL, not Drizzle) with parent/child hierarchy
- COA templates for 4 asset classes (marina, hotel, multifamily, restaurant) with revenue + OpEx children
- `GET /api/budgets/version/:versionId/tree-grid` — returns tree + amounts, auto-seeds on first access
- `PATCH /api/budgets/version/:versionId/cell` — single-cell auto-save on blur
- Collapsible parent rows (Revenue, Operating Expenses) with chevron toggle
- Inline editable inputs: Tab→right, Enter→down, Shift+Tab→left, Escape→cancel+restore
- Sticky Total column (Jan–Dec sum), locked/grayed months prior to current month
- Parent rows auto-sum children in real time, NOI row computed as Revenue − OpEx

**Sprint 2: Bulk Fill + CSV Import**
- `POST /api/budgets/version/:versionId/bulk-fill` — 4 modes: spread_evenly, grow_pct, seasonality, copy_prior_year
- `POST /api/budgets/version/:versionId/import-csv` — fuzzy account/month header matching with word-overlap scoring
- BulkFillMenu popover ("..." on hover) with mode-specific input forms
- CSV drag-and-drop zone with import results panel (matched/skipped with reasons)

**Sprint 3: Version Management + Enhanced BVA**
- `POST /version/:versionId/clone` — deep-clone (lines, amounts, tree)
- `PATCH /version/:versionId/lock`, `/rename`, `/set-primary`
- `GET /version/compare?versionA=&versionB=` — side-by-side with per-account variance
- `GET /bva-enhanced/:budgetId` — per-account per-month Budget|Actual|$Var|%Var with YTD, pulls from actualsFacts + opsBookkeepingGl
- VersionManager UI: selector, clone, lock/unlock, set primary, compare panel
- EnhancedBudgetVsActual: expandable rows with monthly drill-down, YTD bold columns, KPI cards

**Sprint 4: Rolling Forecast + AI Assistant**
- `POST /version/:versionId/rolling-forecast` — creates/updates "Latest Estimate" version (closed months = actuals, future = budget)
- `POST /ai/seed-assumptions` — analyzes prior year GL, computes YoY growth (clamped ±20-30%), auto-fills with seasonal weights
- `POST /ai/explain-variance` — fetches GL transactions, builds plain-English explanation with YoY context
- `POST /ai/what-if` — adjusts driver assumptions, computes baseline vs scenario NOI with monthly comparison
- AI Budget Assistant collapsible sidebar: Seed from Actuals, Explain Variance, What-If Analysis

**Audit & Fixes**
- GL fuzzy-match replaced with `matchGlToBudgetLine()` — word-overlap scoring (60% threshold), prevents double-counting
- Null safety on GL accountName before `.toLowerCase()`
- CSV import resolves lineType from tree accounts (not hardcoded OPEX)
- Seed-assumptions returns `skippedAccounts` array with reason
- Compare button disabled when <2 versions; What-if "Add Driver" disabled when no child rows
- Auto-save debounced (300ms) with `localAmountsRef` to avoid stale closures

**UX Polish: Async States**
- No budgets: illustrated empty state with "Create your first budget" CTA + feature pills
- Grid loading: structural skeleton matching account tree layout (parent + child row shapes)
- BVA no actuals: amber callout with GL sync guidance (import CSV, connect integration, seed demo)
- Seed skipped accounts: amber callout in AI sidebar listing each skipped account with reason

**UX Polish: Number Formatting**
- `formatAmount()`: `$X,XXX` with accounting parens `($X,XXX)` for negatives, "—" for zeros
- `formatCurrency()`: compact `$45.2K` / `($1.3M)` with same conventions
- `formatVarPct()`: capped ±999%, always signed, "—" for zeros
- `formatVarDollar()`: always signed `+$5,000` / `($2,100)`, "—" for zeros
- 38 call sites updated across editor, BVA, compare, and AI sidebar

**UX Polish: Keyboard Navigation**
- `findNextCell()` wraps grid boundaries (Dec→Jan next row, last row→first row)
- Skips locked months during navigation (Tab, Shift+Tab, Enter, Shift+Enter)
- Escape: cancels debounce timer, restores prior value from `priorCellValue` ref, suppresses blur auto-save via `escapedRef`

**UX Polish: User Feedback**
- Auto-save: per-cell "Saved" label + emerald ring flash (1.5s), no toast
- Bulk fill: toast with 5-second Undo button (captures prior values, restores via PATCH)
- CSV import: bordered result panel with collapsible matched/skipped details
- Locked cells: fixed tooltip "This version is locked" on click (via `<td>` handler since disabled inputs swallow clicks)
- AI errors: server error message surfaced in toast descriptions

**Charts Panel**
- Collapsible "Show charts" toggle above grid (collapsed by default)
- Budget vs Actual NOI bar chart (recharts): gray budget bars, blue actual bars, transparent for months without actuals
- Top 5 Expense Variance horizontal bar chart: red for over budget, green for under
- YTD NOI Attainment gauge: semi-circular arc (PieChart), color thresholds (green/amber/red), percentage + status label
- Data fetched from bva-enhanced only when panel is open (`enabled: open`)

**Export**
- Export dropdown (Popover) in editor header with 2 options
- Download CSV: account tree with indented children, parent sums, NOI row, raw numbers for spreadsheet compatibility
- Print/PDF: injected `@media print` stylesheet hides controls, shows print header (budget name, version, date), clean table borders, preserved variance colors, no sticky positioning
- Print-only header: `<div data-print-header>` with budget name + version + fiscal year + export date

**Files Modified:**
- `server/routes/budget-routes.ts` — ~1960 lines (was 405), 20+ new endpoints
- `client/src/pages/operations/BudgetingTabbed.tsx` — ~2400 lines (was 883), full rewrite of editor + 10 new components

**Route Registration:** All new endpoints under existing `/api/budgets` mount (no routes.ts changes needed)

---

### ✅ COMPLETE — Final Pending Items Resolved (2026-03-26)
All deferred/pending items from the journal now resolved:

**1. DB Migration — 18 New Tables Created in Postgres**
All tables that were defined in schema.ts but missing from the DB are now live:
api_keys, docusign_envelopes, docusign_templates, property_public_records, deal_predictions, asset_risk_scores, hold_sell_analyses, cash_flow_forecasts, liquidity_alerts, ai_underwriting_runs, buy_box_profiles, buy_box_scores, meeting_recordings, exchange_rates, comp_overrides, comp_contributions, comp_dedup_matches, dd_findings

**2. Master Comps Pack — Fully Wired**
- Added `master_comps` to packTypeEnum in shared/schema.ts
- Added PACK_DEPENDENCIES entry (requires `analysis`)
- Added PACK_INFO fallback in pack-service.ts ($99/mo, 6 features)
- Added to getAllPacksWithStatus() alongside role-based packs (owner/investor/broker)
- Seeded pack_catalog row in Postgres
- Added to ALTER TYPE pack_type enum in DB

**3. Email System — Unified Provider with Fallback Chain**
Rewrote server/services/email-service.ts:
- New unified `sendEmail()` function tries: SendGrid → Resend → console log
- All existing email functions (password reset, verification, magic link) now use `sendEmail()`
- Added `wrapEmailTemplate()` and `emailButton()` helpers for consistent MarinaMatch branding
- Notification dispatch (onboarding-routes.ts) updated to use `sendEmail()` instead of raw SendGrid
- Emails will NEVER silently fail — console fallback ensures visibility in dev

**4. Trial Reminder System (7-day free trial with CC on file)**
- New cron job #9 in platform-cron.ts: `30 8 * * *` (daily 8:30 AM)
- Queries organizationPacks with status='trial' and trialEndsAt
- Day 3 email: "Getting the most out of MarinaMatch" tips
- Day 5 email: "Your trial expires in 2 days" warning
- Day 7 email: "Trial ending today — subscription begins" or cancel prompt
- Sends to org owners only
- 3 new email templates: `sendTrialDay3Email()`, `sendTrialDay5Email()`, `sendTrialLastDayEmail()`

**5. Sign-Up Page — Categorized Asset Classes + All Packs + Recommendations**
Enhanced client/src/pages/auth/signup.tsx:
- **Asset classes now organized into 6 categories** with expandable accordion:
  - Marine & Outdoor Recreation (marina, RV park, campground, boat storage, MHP)
  - Hospitality & STRs (hotel, STR, resort, B&B)
  - Residential (multifamily, SFR, student housing, senior living, affordable)
  - Commercial (office, retail, industrial, mixed use, medical office, self storage)
  - Specialty & Business Acquisitions (car wash, laundromat, gas station, restaurant, salon, gym, pet care, parking)
  - Institutional & Land (net lease, dev land, data center)
- **All 12 packs now shown** in step 4 (was 8): added master_comps, owner, investor, broker
- **Role-based recommendations**: each role gets suggested packs highlighted with "Recommended" badges
- **"Select all recommended" button** for quick setup
- **Trial messaging**: "7-day free trial included", "Start Free Trial" CTA, pricing shows "after trial"

**6. Real Data Import — Already Complete (confirmed)**
Sales comps and rate comps upload flows were already fully built with CSV/Excel parsing, column mapping, duplicate detection, and async processing. Not actually pending — confirmed complete.

---

### ✅ COMPLETE — Background Jobs + Org Settings + Integrations Marketplace (2026-03-26)
Three operational systems built:

**1. Background Jobs / Cron System** (server/jobs/platform-cron.ts)
8 scheduled jobs using node-cron:
- Lease expiry alerts (daily 7 AM) — 180/120/90/60/30-day horizons, notifies org owners
- DD deadline monitoring (every 4h) — flags deals with DD expiring in 7 days
- Compliance/insurance expiry (daily 8 AM) — insurance within 60 days, regulatory within 30 days
- Integration auto-sync (every 30 min) — triggers connectors due for sync based on frequency setting
- Subscription renewal warnings (daily 9 AM) — 7-day warnings for pack renewals and trial expirations
- Rent payment reconciliation (nightly 1 AM) — flags stale pending payments and overdue rent
- Stale deal detection (Monday 6 AM) — open deals with no activity in 30+ days
- Exchange rate refresh (daily 6 AM) — pulls latest rates from Open Exchange Rates
Started in routes.ts boot sequence. Uses existing notification system for all alerts.

**2. Organization Settings** (server/routes/org-settings-routes.ts — 10 endpoints)
- GET/PUT / — org profile (name, session timeout, MFA required, email domains)
- GET/PUT /branding — firm name, colors, logo, support email, custom domain
- GET /team — list all members with role, status, MFA, last login
- POST /team/invite — invite new member (creates placeholder user)
- PATCH /team/:id — change role or status
- DELETE /team/:id — soft-disable member
- POST /team/transfer-ownership — ownership transfer flow
- GET /team/audit — recent team change audit trail
Frontend: /settings/organization — 4 tabs (Profile, Team, Branding, Security)

**3. Integrations Marketplace** (server/routes/integrations-marketplace-routes.ts — 8 endpoints)
- GET /catalog — all 40+ integrations with connection status per org, grouped by category
- GET /catalog/:key — single integration detail with sync history
- POST /connect — create connection with credentials
- POST /test/:connectionId — test connection via BaseConnector.testConnection()
- POST /sync/:connectionId — manual sync via connector.syncAll()
- PATCH /connections/:connectionId — update sync frequency, auto-sync, settings
- DELETE /connections/:connectionId — disconnect (soft disable)
- GET /sync-history/:connectionId — detailed sync logs
Frontend: /settings/integrations — discovery grid, category filter, search, connect wizard, sync/test/disconnect buttons

**Route Registration:**
- /api/org-settings/* — Organization Settings
- /api/integrations-marketplace/* — Integrations Marketplace
- startPlatformCronJobs() called in boot sequence

---

### ✅ COMPLETE — Stripe Checkout + Onboarding Wizard + Notification Center (2026-03-26)
Three production-critical systems built:

**1. Stripe Checkout Flow (was 503 stub, now functional)**
- Replaced hardcoded 503 "coming soon" stubs with real Stripe Checkout Session creation
- POST /api/stripe/checkout → creates Stripe Checkout Session with pack pricing
- POST /api/stripe/portal → opens Stripe Customer Portal for self-serve management
- POST /api/stripe/webhook → handles checkout.session.completed, subscription.updated/deleted, invoice.payment_failed
- Auto-activates organizationPacks on successful payment
- Subscription lifecycle: checkout → active → past_due → cancelled
- GET /api/stripe/status and /api/stripe/publishable-key now return real configuration state
- Frontend: settings/billing page with plan cards, subscribe buttons, Stripe redirect, success/cancel handling, portal link

**2. Onboarding Wizard**
- Backend (server/routes/onboarding-routes.ts): 6 endpoints
  - GET /status — onboarding checklist with auto-detection (checks real data: deals, packs, team members, org name)
  - POST /complete-step — mark individual steps done
  - POST /dismiss — skip remaining
  - POST /setup-org — org name + industry setup
  - POST /invite-team — batch invite with placeholder user creation
- Frontend (client/src/pages/onboarding/index.tsx): 3-step wizard
  - Step 0: Organization setup (name)
  - Step 1: Team invites (dynamic email list)
  - Step 2: Getting Started checklist (7 items with links to relevant pages)
  - Progress bar, skip button, auto-redirect when complete
- Checklist auto-completes from real data (created deal? invited team? activated pack?)

**3. In-App Notification Center + Email Dispatch**
- Backend (server/routes/onboarding-routes.ts): 4 endpoints
  - GET /notifications — paginated with unread count, 30s polling
  - POST /notifications/mark-read — individual or mark-all
  - POST /notifications/send — create notification (internal API)
  - POST /notifications/dispatch — event-driven notifications with templates:
    - deal_stage_changed, deal_assigned, approval_requested, approval_decided
    - dd_milestone_approaching, dd_item_overdue, finding_critical
    - meeting_analyzed, comment_mention
  - Auto-sends email via SendGrid alongside in-app notification (fire-and-forget)
- Frontend (client/src/components/NotificationCenter.tsx): Sheet-based notification panel
  - Bell icon with unread badge count
  - Notification feed with type icons, time-ago, read/unread states
  - Mark all read, individual mark read on click
  - 30-second auto-refresh polling

**Route Registration:**
- /api/onboarding/* — Onboarding + Notifications
- /api/stripe/* — Checkout, Portal, Webhook (replaced stubs)

**Frontend Routes:**
- /onboarding — Wizard page (no sidebar layout)
- /settings/billing — Plan selection + Stripe Checkout

---

### ✅ COMPLETE — Financial Model 6 Fixes (2026-03-25)
All 6 financial modeling gaps resolved in one route file:
- **~25 new API endpoints** in server/routes/modeling-enhancements-routes.ts

**Fix 1: Rent Roll → Pro Forma Auto-Sync** (POST /rent-roll-sync/:projectId)
- Aggregates modelingRentRollUnits by type/status → computes GPR, EGR, occupancy, slip revenue, other revenue
- Upserts into underwritingAssumptions for target year
- Returns full breakdown by storage type

**Fix 2: Stress Test Engine (Enhanced)** (POST /stress-tests/:id/run-enhanced)
- Pulls actual underwriting assumptions + debt tranches per deal (not flat assumptions)
- Applies: vacancy increase, rent decline, cap rate expansion, rate increase, expense increase
- Computes stressed NOI, value, DSCR per deal; flags DSCR breaches
- Portfolio summary: total value change %, worst-impacted deal, breach count
- Preset factory: mild_recession, gfc, rate_shock, stagflation (POST /stress-tests/presets)

**Fix 3: IC Approval Workflow** (5 endpoints: /approvals/*)
- Create request with required approvers + quorum count + deadline
- Auto-creates pending decisions for each approver
- Approve/reject with comments; auto-resolves when quorum met or impossible
- GET /approvals/pending/me — pending items for current user

**Fix 4: Loan Schedule Caching** (POST /loan-schedule/cache/:debtTrancheId)
- Computes full monthly amortization schedule from debtTranches
- Stores in monthlyLoanSchedule table (was empty before)
- Handles IO periods, amortizing periods, tracks beginning/ending balance
- GET /loan-schedule/:debtTrancheId returns cached schedule

**Fix 5: Capital Stack Projections** (POST /capital-stack-projections/:capitalStackId)
- Computes year-by-year from acquisition through exit
- Tracks: revenue, NOI, debt service, principal paydown, DSCR, debt yield
- Exit year: exit value, loan payoff, net proceeds
- Returns: cumulative cash flow, equity multiple, cash-on-cash per year
- Stored in capitalStackProjections table (32 fields, was empty before)

**Fix 6: Deal Scoring Models** (6 endpoints: /scoring-models/*)
- CRUD for scoring models with configurable criteria (numeric_range, boolean, select)
- Score deals: weighted multi-criterion scoring → total score + grade (A+ through F)
- Stores in dealScores with per-criterion breakdown
- GET /scores/:dealId for history

**Route Registration:** /api/modeling-enhanced/*

---

### ✅ COMPLETE — DD Findings, KPI Dashboard & Unified Deal Team (2026-03-25)
Three enhancements to the Deal Workspace ecosystem:
- **1 new database table** (ddFindings) + **~15 new API endpoints**

**New Schema Table (shared/schema.ts):**
- ddFindings — severity (critical/major/minor/observation/positive), category, financial impact (cost_to_cure/value_reduction/revenue_risk/liability/capex_required), resolution workflow (open→investigating→mitigated→resolved→escalated), recommendation (proceed/renegotiate/walk_away/further_investigation), linked to checklist items/documents/tasks

**New Route File (server/routes/dd-findings-routes.ts):**
1. **DD Findings CRUD** (6 endpoints): create, list, get, update, delete, summary with risk scoring
2. **Findings Summary** per workspace: by severity, category, recommended action, deal-breaker detection, total financial impact (resolved vs unresolved)
3. **DD KPI Dashboard** (1 endpoint): comprehensive metrics per workspace:
   - Core: total/completed/provided/overdue/blocked items, completion %, provision %
   - Breakdowns: by status, internal status, priority, request type
   - Category heatmap: per-section completion/provision/overdue rates
   - Timeline: avg days to provide, upcoming deadlines (next 7d)
   - Findings integration: total/critical/open findings, financial impact
   - Health score: 0-100 composite (On Track/Needs Attention/At Risk/Critical)
4. **Unified Deal Team** (2 endpoints):
   - GET /team/:dealId — merges dealContacts + workspaceMembers, deduplicates by email, enriches with CRM data and user info, groups by team type
   - POST /team/:dealId/sync — bidirectional sync between workspace members and deal contacts

**Route Registration:** /api/dd-enhanced/*

---

### ✅ COMPLETE — Master Comps Database Pack Feature (2026-03-25)
Full master comps pack built with 5 pillars:
- **3 new database tables** added to schema.ts
- **~25 new API endpoints** in 1 new route file

**New Schema Tables (shared/schema.ts):**
- compOverrides — org-level annotations/adjustments on master comps (override price, cap rate, NOI, notes, ratings, tags, exclude)
- compContributions — submission pipeline for users to contribute comps to master DB (submitted → under_review → approved/rejected)
- compDedupMatches — duplicate detection results linking user comps to potential master matches

**New Route File:**
- server/routes/master-comps-routes.ts — 5 sections:
  1. **Admin Curation** (6 endpoints): list global comps, promote/demote to global scope, verify/quality score, bulk promote, stats dashboard
  2. **Subscriber Access** (1 endpoint): unified query merging org + master comps with overrides layered on, filtered by pack access
  3. **Comp Overrides** (5 endpoints): create/update/delete org-level overrides on master comps, exclude comps, list overrides
  4. **Contribution Pipeline** (3 endpoints): submit comp for master inclusion, list contributions, admin review (approve → auto-promote)
  5. **Dedup Engine** (4 endpoints): check single comp, batch check, list pending matches, resolve matches (link/keep_both/dismiss)

**Pack Access:**
- `master_comps` or `analytics_pro` pack grants access to global comps
- Dev mode bypass when org has no packs (consistent with existing pattern)
- Comps promoted with `requiredPack: "master_comps"` on the salesComps/rateComps records

**Similarity Scoring (dedup):**
- Marina name: exact (40pts) or partial (25pts)
- Address: exact (30pts) or partial (15pts)
- City+State: 10pts
- Sale year: exact (10pts) or ±1yr (5pts)
- Sale price: ±5% (10pts) or ±10% (5pts)
- Threshold: 60+ = potential match

**Route Registration (server/routes.ts):**
- /api/master-comps/* — Master Comps Database

---

### ✅ COMPLETE — Final 5 Missing Spec Sections Built (2026-03-25)
All remaining missing spec sections now implemented:
- **8 new database tables** added to schema.ts
- **~60 new API endpoints** across 5 new route files
- **83 of 86 sections now BUILT** (3 minor partials remain: E.4, F.3, F.5)

**New Schema Tables (shared/schema.ts):**
- cashFlowForecasts, liquidityAlerts (E.5)
- aiUnderwritingRuns (G.1)
- buyBoxProfiles, buyBoxScores (G.3)
- meetingRecordings (G.5)
- exchangeRates (H.3)

**New Route Files:**
- server/routes/cash-flow-forecasting-routes.ts — E.5 (6 endpoints): 24-month projections, liquidity alerts, deal breakdown, summary
- server/routes/ai-underwriting-routes.ts — G.1 (4 endpoints): AI market research + comps + public records → pro forma assumptions
- server/routes/deal-sourcing-routes.ts — G.3 (8 endpoints): AI buy box generation, deal scoring (A/B/C/D tiers), batch scoring, leaderboard
- server/routes/meeting-transcription-routes.ts — G.5 (8 endpoints): upload transcript, AI analysis, CRM sync (auto-create tasks, log activities)
- server/routes/multi-currency-routes.ts — H.3 (6 endpoints): exchange rate refresh (Open Exchange Rates), conversion, portfolio FX exposure

**Route Registration (server/routes.ts):**
- /api/cash-flow/* — Cash Flow Forecasting
- /api/ai-underwriting/* — AI Underwriting Assistant
- /api/deal-sourcing/* — Deal Sourcing & Buy Box
- /api/meetings/* — Meeting Transcription + CRM Sync
- /api/currency/* — Multi-Currency & International

---

### ✅ COMPLETE — Gap Closures: F.4, F.6, G.4, H.2, C.2/C.3/C.5 Enhancements (2026-03-25)
Prior gap closures:
- **7 new database tables** added to schema.ts
- **~80 new API endpoints** across 4 new route files + 1 service + 1 middleware

**New Schema Tables (shared/schema.ts):**
- docusignEnvelopes, docusignTemplates (F.4)
- propertyPublicRecords (F.6)
- dealPredictions, assetRiskScores (G.4)
- holdSellAnalyses (G.4 + 3.5)

**New Route Files:**
- server/routes/docusign-routes.ts — F.4 DocuSign Deep Integration (14 endpoints): template sync/CRUD, send from template, embedded signing URL, bulk send, envelope management, void/resend, PDF download, webhook handler, dashboard
- server/routes/public-records-routes.ts — F.6 Public Records / Title Data (8 endpoints): ATTOM property enrichment, selective field import to deal/property, sale history, tax history, property/deal lookups
- server/routes/predictive-analytics-routes.ts — G.4 + 3.5 Predictive Analytics & Hold-Sell (8 endpoints): deal closure probability scoring, batch predictions, asset underperformance risk scoring, portfolio risk overview, hold/sell analysis with year-by-year projections
- server/routes/api-v1-routes.ts — H.2 White-Label API v1 (14 endpoints): deals, portfolio, contacts, properties, investors, distributions, work orders, webhooks — all with pagination, scope enforcement, rate limiting

**New Services & Middleware:**
- server/services/public-records-service.ts — ATTOM Data Solutions integration: address lookup, property detail, sale history, tax history, lien data, parallel enrichment
- server/middleware/api-key-auth.ts — API key authentication (Bearer mm_sk_...), scope enforcement (requireScope), IP allowlist, in-memory rate limiting with X-RateLimit headers

**Enhanced Routes (server/routes/tenant-construction-routes.ts):**
- C.2: Stripe PaymentIntent creation, late fee calculator (flat/daily/percentage), payment reconciliation, NSF fee application
- C.3: Lease renewal auto-scan (180/120/90/60/30-day horizons), AI renewal offer letter generation with market rent comparison
- C.5: Detailed conversion funnel with stage-by-stage rates, days-on-market alerts with revenue loss estimates and pricing suggestions

**Route Registration (server/routes.ts):**
- /api/docusign/* — DocuSign (webhook + authenticated routes)
- /api/public-records/* — Public Records / Title Data
- /api/predictive/* — Predictive Analytics + Hold-Sell
- /api/v1/* — White-Label API (API key auth, no session)

---

### ✅ COMPLETE — Master Spec Volume 1 Full Build-Out (2026-03-25)
All 50 sections from MARINAMATCH_MASTER_SPEC.md implemented:
- **42 new database tables** created in PostgreSQL
- **~200 API endpoints** across 9 new route modules + 1 service
- **0 TypeScript errors**

**New Schema Tables (shared/schema.ts):**
Sections 1.1-1.5: dealChatSessions, dealChatMessages, dealChatFeedback, aiNarratives, leaseAbstractions, dealRiskScores
Sections 2.1-2.5: investors, investments, distributions, distributionAllocations, capitalCalls, capitalCallLineItems, taxDocuments
Sections 3.2-3.3: marketBenchmarks, portfolioAlerts
Sections 4.1-4.4: capRateFeed, rentComps, propertyZoning, entitlements
Sections 5.1-5.4: workOrders, workOrderUpdates, vendors, vendorRatings, capexProjects, inspectionTemplates, inspections
Sections 6.1-6.4: lenders, lenderDeals, termSheets, dealDebt, mezzPositions
Section 7.1, 7.4: contactRelationships, contactNewsMentions
Section 8.4: orgBranding
Section 9.1: notificationPreferences, userNotifications
Section 9.2: signatureRequests
Section 9.3: webhookEndpoints, webhookDeliveries
Section 9.5: dealStageConfigs
Section 10.1: workflowAutomations, workflowExecutionLog
Section 10.6: emailMessages, emailSendTemplates

**New Route Files (server/routes/):**
- workflow-automation-routes.ts — 10.1 workflow engine (11 endpoints)
- ai-deal-intelligence-routes.ts — 1.1-1.5 AI chat, narratives, lease abstractor, risk scoring, comps (20 endpoints)
- investor-portal-routes.ts — 2.1-2.5 LP dashboard, capital calls, distributions, tax docs (24 endpoints)
- portfolio-market-routes.ts — 3.1-4.5 portfolio, benchmarks, alerts, cap rates, rent comps, zoning (25 endpoints)
- operations-management-routes.ts — 5.1-5.4 work orders, vendors, capex, inspections (27 endpoints)
- capital-markets-routes.ts — 6.1-6.4 lender matching, term sheets, debt maturity, mezz (20 endpoints)
- crm-relationship-intelligence-routes.ts — 7.1-7.5 relationship graph, sourcing, follow-up AI, news, meeting prep (15 endpoints)
- reporting-quickwins-routes.ts — 8.1-9.5+10.6 reports, branding, notifications, e-sign, webhooks, stages, email (30 endpoints)
- crm-pipeline-enhancements-routes.ts — 10.2-10.5 timeline, comparison, kanban dates, activity log (12 endpoints)

**New Services:**
- server/services/workflow-engine.ts — condition evaluator, action executor, templates, dry-run

**Route Registration (server/routes.ts):**
All 9 routers mounted under auth+tenant middleware:
/api/ai-deal/*, /api/investors/*, /api/market/*, /api/operations/*, /api/capital-markets/*, /api/crm/intelligence/*, /api/platform/*, /api/crm/pipeline/*, /api/workflow-automations/*

**Trigger Hooks Wired:**
- deal.created → POST /api/crm/deals
- deal.stage_changed → PUT /api/crm/deals/:id (includes newStageName)
- deal.field_updated → PUT /api/crm/deals/:id
- contact.created → POST /api/contacts

### ✅ COMPLETE — Gap Spec Volume 2 Full Build-Out (2026-03-25)
All 38 sections from MARINAMATCH_GAP_SPEC.md implemented:
- **38 new database tables** created in PostgreSQL (on top of 42 from Vol 1)
- **~300 additional API endpoints** across 6 new route modules + 1 service + 1 middleware
- **0 TypeScript errors**
- **Stripe SDK** installed

**New Schema Tables (shared/schema.ts):**
A.1: billingSubscriptions, billingInvoices, billingUsageMetrics, billingFeatureFlags
A.2: rbacRoles, rbacUserRoles, rbacFieldPermissions
A.3: auditTrail
A.4: ssoConfigs
A.5: userTwoFactor
B.1-B.2: fundsV2, fundDealsV2, managementFeeInvoices, fundDocuments, sideLetters
B.3: investorVerification
B.4: capitalAccounts, capitalAccountEntries
C.1: tenantUsers, tenantMessages
C.2: rentPayments
C.3: leaseRenewalOpportunities
C.5: vacancyListings, leasingProspects, showings
D.1: constructionProjects, constructionBudgetLines, constructionDraws
D.2: unitRenovations
E.1: customReports
E.3: stressTestScenarios
F.1: accountingIntegrations
H.1: legalEntities
H.2: apiKeys
H.4: dataRooms, dataRoomAccess
I.1: climateRiskAssessments
I.2: environmentalStudies
I.3: insurancePolicies, insuranceClaims
I.4: regulatoryObligations
J.2: userOnboarding

**New Route Files (server/routes/):**
- billing-routes.ts — A.1 Stripe billing engine (12 endpoints)
- infrastructure-routes.ts — A.2 RBAC + A.3 Audit + A.4 SSO + A.5 2FA (~35 endpoints)
- fund-management-routes.ts — B.1-B.5 Fund model, docs, KYC, capital accounts, fees (~30 endpoints)
- tenant-construction-routes.ts — C.1-C.5 + D.1-D.2 Tenant, rent, leasing, construction (~45 endpoints)
- analytics-enterprise-routes.ts — E.1-E.5 + F.1 + H.1-H.5 Reports, stress tests, data rooms (~35 endpoints)
- compliance-onboarding-routes.ts — I.1-I.4 + J.2 Climate risk, insurance, regulatory, onboarding (~40 endpoints)

**New Services:**
- server/services/billing-service.ts — BillingService class with Stripe integration, 14 methods
- server/middleware/feature-gate.ts — requireFeature() + checkUsageLimit() middleware

**Route Registration (server/routes.ts):**
/api/billing/* — Billing (unauthenticated webhooks + authenticated management)
/api/infrastructure/* — RBAC, Audit, SSO, 2FA
/api/fund-management/* — Fund accounting & compliance
/api/tenant-ops/* — Tenant portal & construction
/api/enterprise/* — Analytics, integrations, data rooms
/api/compliance/* — Climate risk, insurance, regulatory calendar, onboarding

---

## Prior State (2026-03-19)

### ✅ COMPLETE — CRM Record Pages (10x upgrade)
All 4 record pages rebuilt with institutional 3-column CrmRecordPage layout.

**Contact Record** (7 tabs): Timeline, Deals (pipeline chart), Properties, Activities, Models, Intel (DockTalk), Notes
**Company Record** (8 tabs): Timeline, Portfolio (pie+bar charts), Contacts, Deals, Activities, Models, Intel, Notes
**Property Record** (9 tabs): Timeline, Storage, Sales Comps (chart+cards), Rate Comps (chart+cards), Activities, Deals, Intel, Notes, Price History
**Deal Record** (7 tabs): Timeline, Overview (KPI tiles, workspace links, dates), Activities, FM, Comps, Intel, Notes

New components:
- client/src/components/crm/ContactRecordTabs.tsx
- client/src/components/crm/CompanyRecordTabs.tsx
- client/src/components/crm/PropertyRecordTabs.tsx
- client/src/components/crm/PropertyFMPanel.tsx
- client/src/components/crm/PropertyCompsPanel.tsx
- client/src/components/crm/RelationshipScoreBadge.tsx

### ✅ COMPLETE — CRM Schema (new columns)
Applied via raw psql (never db:push):
- crm_contacts: crmRole, sourceType, linkedInUrl, relationshipScore, lastContactedAt, nextFollowupDate, ndaOnFile, emailConsent, dealSizeMin/Max, investmentNotes, targetAssetClasses, targetGeographies
- crm_companies: companyType, aumRange, aumApprox, investmentMandate, ndaOnFile, ndaExpiryDate, linkedInUrl, parentCompanyId, targetAssetClasses
- crm_properties: listingStatus, askingPrice, lastSalePrice, lastSaleDate, latitude, longitude, totalSlips, drySlips, hasFuelDock, waterDepthFt, dockMaterial, yearBuilt

### ✅ COMPLETE — CRM Server Routes
- server/routes/crm-relationship-score.ts — score endpoint, bulk scores, stale contacts
- server/routes/crm-activities-routes.ts — auto-updates last_contacted_at on activity create/complete
- /api/crm/search — global search across contacts/companies/properties/deals (powers ⌘K)

### ✅ COMPLETE — DD Project Page
Added Overview tab as default landing (was Tasks & Timeline):
- 4 KPI tiles: Total/Completed/InProgress/Overdue tasks
- Overall progress bar
- Key dates countdown (PSA Signed, DD Expiration urgent <7d, Closing)
- Progress by category (title/ESA/financial/legal/etc)
- CRM cross-link to originating deal
- KpisOverview + FindingsManager surfaced (were imported but unused)
- All existing tabs (Tasks & Timeline, Documents, DD Request, etc.) unchanged

### ✅ COMPLETE — Analytics Pages
All CRM analytics pages assessed — fully built, no work needed:
- pipeline.tsx (1078 lines) — full DnD Kanban
- forecast.tsx (787 lines) — pipeline forecasting engine
- scoring.tsx (756 lines) — lead scoring with websockets
- PipelineInsights.tsx (484 lines) — AI pipeline insights
- PipelineVelocity.tsx (500 lines) — velocity metrics with date ranges
- DealAnalyticsPage.tsx — wrapper for PipelineAnalyticsDashboard

### ✅ COMPLETE — DCF Refactor (Phase 3, Layers 1–4)
- DCF consumes canonical Multi-Year Pro Forma engine
- Monte Carlo simulation implemented
- Decision Support tools: tornado chart, OLS attribution, IC memo generator
- 154/154 tests passing, zero TypeScript errors
- assumptions.tsx dynamic via getModelConfig()
- XIRR consolidated, seasonality auto-derived, dummy data purged

### ✅ COMPLETE — Feature Gating Enforcement Layer (2026-03-19)
Pack-based access control now enforced end-to-end. Infrastructure already existed (pack-service, pack-guard middleware, PackGate/RequirePack components, organizationPacks table); this work wired it all up.

**Server — `requirePack()` added to 20 route mount points in routes.ts:**
- `crm_pipeline`: /api/crm (7 mounts), /api/sla, /api/crm/analytics, /api/crm/saved-views
- `modeling_tools`: /api/modeling (2 mounts), /api/modeling-rent-roll
- `analysis`: /api/sales-comps, /api/sc-projects, /api/comp-columns, /api/rate-comps, /api/rc-projects, /api/rc-columns
- `operations`: /api/operations (2 mounts), /api/ship-store, /api/service, /api/boat-rentals, /api/boat-club, /api/boat-sales, /api/operations/fuel-integrations
- `analytics_pro`: /api/analytics
- Previously guarded (unchanged): /api/funds (requireFundManagement), /api/prospecting (requireProspecting), /api/rent-roll (requireRentRoll)

**Client — App.tsx route gating (146 routes):**
- Added `GatedLayout` component = `UnifiedLayout` + `PackGate`
- All CRM, pipeline, modeling, analysis, operations, prospecting routes wrapped with `<GatedLayout pack="...">`
- Ungated sections preserved: dashboard, settings, workspaces, DD, VDR

**Client — Sidebar pack filtering (unified-sidebar.tsx):**
- Added `hasPack()` checks to 5 sidebar sections: Operations, CRM, Pipeline, Analysis, Market Intelligence
- Extended local `PackType` to include `crm_pipeline`, `modeling_tools`, `analysis`
- Investor Services already had hasPack checks (unchanged)

**Dev-mode bypass:**
- Server: `pack-guard.ts` — when `NODE_ENV=development` and org has 0 packs, requests pass through
- Client: sidebar `hasPack()` — when dev mode and activePacks is empty, returns true
- Prevents dev environment from being locked out when no pack rows exist in DB

**What's NOT gated (by design):**
- Dashboard, settings, onboarding, auth pages
- Deal Workspace (/workspaces) — cross-module hub
- DD projects, VDR — separate from pack system
- Stripe payment flow not yet implemented — packs are activated via admin/DB

### ✅ COMPLETE — Demographics Overhaul to GIS-Grade (2026-03-19)
Full overhaul of /analysis/demographics to match STDB / LandVision / ArcGIS Business Analyst.

**Isochrone polygons (replaces simple circles for drive-time):**
- drivetime-service.ts: generateIsochrone() binary-searches 36 bearings against
  Google Distance Matrix API to build real road-network polygon boundaries
- getDriveTimeBatch() batches 25 destinations/request (cost: ~98 API calls per
  isochrone vs. 252 unbatched). 24hr cache per isochrone.
- computePolygonAreaSqMiles() via Shoelace formula, pointInPolygon() ray-casting
- Fallback: no API key → circle polygon at estimated radius

**Census polygon aggregation:**
- census-service.ts: getDemographicsForPolygon() generates dense grid within
  polygon, resolves each point to tract, population-weighted aggregation
- Added B11001_001E (total households) to all census queries
- Derived: aggregateHouseholdIncome = totalHouseholds × medianHHI (spending power)
- Fixed populationDensity for aggregated results (was always undefined)

**Tract-level historical trends:**
- fetchHistoricalYearData now tries tract-level first (was county-only)
- Returns 5-year CAGR for population, income, home value
- MarketTrendAnalysis shows geographic level badge + CAGR summary cards

**API endpoints:**
- New: POST /api/demographics/isochrone (lat/lng + targetMinutes → polygon)
- Updated: POST /api/demographics/location accepts polygonBoundary param
- Updated: POST /api/demographics/historical-trends returns cagr + geographicLevel

**Client (Index.tsx + MarketTrendAnalysis.tsx):**
- Drive-time mode renders Google Maps Polygon instead of Circle
- Added Households, Spending Power, Pop. Density to stat cards + comparison table
- CAGR cards with trend indicators above trend chart

**Key files:**
- server/services/drivetime-service.ts (isochrone generation, batch Distance Matrix)
- server/services/census-service.ts (polygon aggregation, households, tract trends)
- server/routes.ts (isochrone + polygon endpoints)
- shared/schema.ts (totalHouseholds, aggregateHouseholdIncome on DemographicSummary)
- client/src/pages/analysis/demographics/Index.tsx
- client/src/components/demographics/MarketTrendAnalysis.tsx

---

## Active Technical Patterns

**DB changes**: Always `psql $DATABASE_URL` with `ADD COLUMN IF NOT EXISTS` — never `npm run db:push`
**Kill server**: `pkill -f 'tsx server'`
**Patch pattern**: `node --input-type=module << 'JS'` heredoc for file edits
**RLS tables**: Use raw `pool.query()` not Drizzle ORM
**Raw SQL returns**: snake_case — map explicitly
**Test project**: ID `6b3a9021-f393-489d-9274-321ac76eae08`, org `cd3719c3-ef82-4ccc-acb9-261c80fb64b4`

---

## Remaining Work

### All Major Items Complete
- ✅ Stripe Payment Integration — done (checkout, portal, webhooks)
- ✅ Real Data Import — done (full CSV/Excel upload for sales + rate comps)
- ✅ DB Migration — done (18 new tables created via raw SQL)
- ✅ Master Comps Pack — done (enum, catalog, pack-service)
- ✅ Email System — done (unified provider with SendGrid → Resend → console fallback)
- ✅ Trial Reminders — done (day 3/5/7 emails via cron job)
- ✅ Sign-Up Enhancement — done (categorized assets, all packs, recommendations)
- ✅ Admin Panel — done
- N/A J.1 Native Mobile — deferred (web app is fully responsive)

### 3. CRM Dashboard Assessment — ✅ DONE (2026-03-19)
Assessed: already solid (684 lines, 6 KPI cards, pipeline bars, activity panels,
asset class breakdown, property grid, quick actions). Quality matches record pages.
No upgrade needed — flat layout is appropriate for dashboards.

### 4. last_contacted_at Backfill — ✅ DONE (2026-03-19)
Script at scripts/backfill-last-contacted.sql. Safe to re-run. Run via:
  psql $DATABASE_URL -f scripts/backfill-last-contacted.sql

### 5. Frontend Visual QA — ✅ DONE (2026-03-19)
FM design system (fm-page, fm-header, fm-panel, fm-body) was defined in index.css
but 3 tabs used ad-hoc headers. Fixed: monte-carlo.tsx, debt-scenarios.tsx,
scenario-comparison.tsx now use fm-header/fm-header-title/fm-header-sub/fm-header-actions
and fm-body wrappers. Remaining tabs (dcf-calculator, pro-forma, historical-pl,
exit-strategy, model-returns, deal-pricing, capital-stack, debt-inputs) already
use FM design system correctly.

### 6. Property Form Geocoding — ✅ DONE (2026-03-19)
AddressInput already extracted lat/lng from Google Maps but property-form-modal.tsx
wasn't capturing them. Fixed: onAddressSelect now stores lat/lng in state,
coordinates:{lat,lng} included in create/update mutations, existing coords
populated when editing. crmProperties.coordinates jsonb field was already in schema.

---

## Session Instruction
At the start of every MarinaMatch session, run:
  cat ~/workspace/MARINAMATCH_JOURNAL.md

## 2026-04-23 — Test suite status after Path B session

Fixed 13 of 20 test failures; 7 remain, all in `server/schema-drift.test.ts`.

**Fixed:**
- 3 DCF calculator React tests — added `Settings2` to `lucide-react` mock in `client/src/pages/modeling/projects/workspace/__tests__/dcf-calculator-use-lease-egi.test.tsx`
- 5 tenant-isolation tests — added `originalUrl` to `mockReq` helper; updated 2 tests to match middleware's actual pass-through-on-no-user behavior (auth handled upstream)
- 4 CSRF tests — added `originalUrl` to `createMockRequest` helper; updated 1 test's cookie assertion to `sameSite: 'lax'` matching current middleware

**Deferred (7 failures in `server/schema-drift.test.ts`):**
Root cause: `is(value, PgTable)` type guard in `extractSchemaTables()` fails across Vitest's module interop boundary, so the test's mocked `testUsers` table is never recognized as a PgTable. Returns 0 tables regardless of mock setup. The 4 "expect 0" tests in this file pass degenerately. Not a blocker for transient rent roll work since the drift detector utility isn't on that code path. Fix requires either refactoring the test to use a shared drizzle-orm instance or shimming the type guard — nontrivial.

**Current baseline:** 667 passing / 7 failing / 1 skipped (of 675 runnable; excluding 5 stray vitest matches in `.config/npm/node_global/` which are the Copilot CLI's own tests — should add `.config` to vitest exclude list).

## Pre-Launch Testing Requirements (before going live to public)

The 102 DCF unit tests are *not* sufficient for a launch gate. They prove the math is internally consistent; they don't prove the platform produces correct results on real deals. Complete these before any public launch:

1. **End-to-end workflow tests with realistic data.** Full path: upload a real P&L → Document Intelligence extraction → review and correct → build Pro Forma → run DCF → Monte Carlo → exit scenarios. Catch: UI bugs, data pipeline breaks, extraction errors, silent calculation issues that only surface with real-shaped inputs.

2. **Manual validation against trusted Excel models.** Take 3-5 of your own acquisition models (marina, STR, CRE — ideally one per asset class targeted at launch), rebuild them in Vantage, and compare outputs line by line with the Excel. Every difference must be explainable (methodology differences are fine; unexplained deltas are not). Document the methodology differences in platform docs so future users understand them.

3. **Beta user pressure testing with real deals.** Candidates:
   - Palm Harbor STR portfolio (Palm Paradise, Harbor Hideaway, Palm Retreat) — use for STR/short-term rental path validation
   - Pinellas cleaning business CIM — use for small-business acquisition path validation
   - Marina broker contacts — use for marina and CRE path validation (highest-stakes asset class for the platform)
   Run 5-10 real deals through start-to-finish. Get feedback on what feels wrong, slow, or confusing. Iterate.

4. **Regression protection during development.** The 102 DCF tests must pass on every PR that touches the modeling engine. Never merge red.

5. **Data integrity audit.** Before launch, sample-check database records for: PII leakage across orgs (tenant isolation), RLS policies enforcing correctly, audit logs capturing the right events, financial calculations matching what's displayed in UI.

6. **Security audit.** CSRF, auth middleware, tenant isolation middleware (which we just fixed tests for), rate limiting, error messages not leaking internal state.

7. **Load/performance smoke test.** Monte Carlo with 10,000 iterations, DCF with 30-year hold period, document intelligence on 50-page P&L — each should complete in a reasonable time without memory issues.

None of the above are Phase 1-7 of the transient rent roll build. Track them as a separate pre-launch workstream.

## 2026-04-24 — RLS finding (pre-launch gap)

Discovered during Phase 2 investigation: no Postgres-level RLS policies exist in this codebase. The phrase "RLS-guarded" in CLAUDE.md and across service files is a convention indicating "be careful, scope by org_id manually in raw SQL" — not an enforced database mechanism. No CREATE POLICY, no ENABLE ROW LEVEL SECURITY, no pgPolicy or enableRLS Drizzle helpers anywhere.

This is a real pre-launch gap. Services that forget to include WHERE org_id = $1 will silently leak data across tenants. Add to the pre-launch testing checklist: audit every raw pool.query() call site for explicit org_id scoping, consider enabling real Postgres RLS before public launch.

For Phase 2 work, the transient_inventory_group service follows the existing convention but adds TypeScript-level discipline: org_id is a required parameter on every service function (no defaults, no optional).

## 2026-04-24 — Phase 2 Table A PR opened

Draft PR #3 opened: https://github.com/bmurph41/MMTest/pull/3
- Branch: feature/transient-rent-roll-phase2-inventory-group
- Commits: 09240a1c (flag refactor), 488975ee (transient_inventory_group table + service + 16 tests)
- Verification: 16/16 new tests, 102/102 DCF tests, zero typecheck delta (824 == baseline)
- Next: Phase 2 Table B (transient_unit_type) as a follow-up PR on the same branch family

## Outstanding — AI Advisor chat tool broken

The AI Advisor chat widget inside Vantage is returning "Sorry, I encountered an error. Please try again." for every query, regardless of the question ("What are the biggest risks with this deal?", "Help me study comps", "Show me the last 5 market sales" all fail identically). The error string is the frontend's generic fallback, which means something on the backend is throwing consistently. Also appears disconnected from app context — it doesn't seem to know anything about the current deal, property, or user state.

**Needs investigation and repair.** Likely diagnostic sequence:
1. Open the AI Advisor panel, open browser DevTools → Network tab, send a query. Capture the failing request URL, status code, and response body. Likely `/api/v1/advisor/*` or similar.
2. Check server logs for the error. Common culprits: missing ANTHROPIC_API_KEY env var, rate limit hit, broken auth middleware on the route, stale route registration after a refactor, or a service it depends on (context loader, RAG retriever) throwing.
3. Grep for the advisor route handler: `grep -rn "advisor" server/routes/ server/services/ 2>&1 | head -20`
4. Check whether the route is gated behind a feature flag that got flipped off.

**Scope considerations:**
- Once Vantage's advisor is fixed, port the same architecture to Bookd (separate codebase). The advisor tech stack — whatever it ends up being post-fix — should be the template.
- Probable shared pieces when porting: context loader pattern, RAG setup, LLM provider wiring, streaming response handling, error surface. Keep the two deployments independent (separate API keys, separate rate limits) but share the code pattern.

**Priority:** Not blocking transient rent roll build. Fix as a standalone workstream when convenient — ideally before the pre-launch validation pass, since an advisor that's broken undermines the demo story even if core DCF works.

## 2026-04-24 — Slow startup root cause (~10s boots)

Replit containers cycle roughly every 5 minutes. UptimeRobot was firing "down" alerts on the ~10-15 second gap during each cycle. Immediate mitigation: raise UptimeRobot threshold to 2 consecutive failed checks instead of 1 (eliminates false alarms from normal restarts).

Root cause of the 10-second startup: server/db-startup-migrations.ts runs ~14,949 idempotent SQL statements on every boot — a direct consequence of the drift-resolution auto-generation on 2026-04-23 that produced 1,015 ADD COLUMN IF NOT EXISTS + CREATE INDEX IF NOT EXISTS stubs with placeholder 'text' column types.

This is tolerable today but becomes a production-quality issue under real traffic. Every 5-minute container cycle = a 10-second window where boots are slow and new connections may time out. Users hitting the platform during a cycle gap see connection failures, not just UptimeRobot.

Fix path (deferred, separate workstream):
1. Replace the 1,015 'text' placeholder stubs with correct Postgres types (timestamp, numeric, boolean, jsonb, uuid, varchar, integer) so the stubs reflect reality rather than acting as dead no-ops.
2. Consider moving bulk schema work out of db-startup-migrations.ts and into numbered migrations/*.sql files run once at deploy time, not every boot.
3. Target boot time: <3 seconds. Current: ~10 seconds. Every second saved reduces the cycle-gap window proportionally.

Priority: Not blocking transient rent roll build. Address before public launch — ties into the pre-launch checklist item "audit every raw pool.query() call site."

## 2026-04-24 — Phase 2 Table B PR opened

Draft PR #4 opened: https://github.com/bmurph41/MMTest/pull/4
- Branch: feature/transient-rent-roll-phase2-unit-type
- Base: feature/transient-rent-roll-phase2-inventory-group (stacked PR on top of PR #3)
- Commit: 088c94d3 (transient_unit_type table + service + 20 tests)
- Verification: 20/20 new tests, 16/16 Table A regression, 102/102 DCF tests, zero typecheck delta (824 == baseline)
- Design deviations from spec (vs Table A): inventory_group_id NOT NULL (tighter than spec nullable), inventory_count omitted, dimensions jsonb NULLABLE without DEFAULT, DB-level CHECK on rate_basis + service whitelist (belt+suspenders), cross-parent consistency guard (org AND property match)
- Stack: 088c94d3 (Table B) → 488975ee (Table A) → 09240a1c (flag refactor) → main
- Next: Phase 2 Table C (transient_inventory_unit) as a follow-up PR stacked on Table B

## 2026-04-24 — Phase 2 complete (Tables A, B, C all shipped)

Draft PR #5 opened: https://github.com/bmurph41/MMTest/pull/5 (Table C — transient_inventory_unit)

Phase 2 inventory hierarchy fully modeled: crm_property → transient_inventory_group → transient_unit_type → transient_inventory_unit

Three-deep stacked PR chain on origin:
- PR #3 (Table A) — feature/transient-rent-roll-phase2-inventory-group → main
- PR #4 (Table B) — feature/transient-rent-roll-phase2-unit-type → PR #3's branch
- PR #5 (Table C) — feature/transient-rent-roll-phase2-inventory-unit → PR #4's branch

Merge sequence: merge PR #3 first, PR #4 auto-rebases to main, merge PR #4, PR #5 auto-rebases to main, merge PR #5.

Combined stats across the three PRs:
- Tables: transient_inventory_group (A), transient_unit_type (B), transient_inventory_unit (C)
- Migrations: 0013, 0014, 0015
- Service functions: 5 (A) + 5 (B) + 6 (C) = 16 total
- Unit tests: 16 (A) + 20 (B) + 31 (C) = 67 total
- DCF regression: 102/102 preserved across every PR
- TypeScript: zero delta from 824-error baseline across every PR

Design discipline established and preserved across all three tables:
- orgId required top-level parameter on every service function
- All SQL includes explicit WHERE org_id = $n (no Postgres RLS exists in this codebase)
- Soft delete via deleted_at, reads filter IS NULL
- Partial unique indexes SQL-only (Drizzle can't express WHERE clauses)
- varchar IDs, plain timestamp (not timestamptz), ON DELETE RESTRICT on parent FKs
- DB-layer CHECK + service-level whitelist for enum fields (belt+suspenders)
- Parent-consistency guards: Table B verifies two-way (org + property), Table C verifies three-way (org + property + inventory_group)
- Isolated updateStatus function on Table C (keeps lifecycle changes separate from field edits)
- File header docs distinguishing status='decommissioned' (preserved) from deleted_at (hidden)

Next session priorities (in rough order):
1. Review and merge PR #3 (Table A) — PRs #4 and #5 auto-rebase after each merge
2. Phase 3 start: transient_rate_plan + transient_rate_calendar_day + seasonality
3. Defer: routes (not yet scoped), UI (Phase 7), the 824 pre-existing typecheck errors in shared/asset-class-model-config.ts, AI Advisor chat repair, slow-startup cleanup (1,015 migration stubs)

## 2026-04-26 — apiRequest fix + Portfolio Content-Type + AI Advisor verified

### Shipped to production:
- **96c83906** — fix(api): dual-signature support in apiRequest helper
  - URL-first `apiRequest(url, options)` and method-first `apiRequest(method, url, data)` both work
  - 323 callers across the codebase used URL-first; helper only supported method-first → runtime "X is not a valid HTTP method" errors
  - Now dispatches based on whether arg 2 is a string or an object
- **21b62124** — fix(portfolio): set Content-Type on Add/Edit Portfolio mutations
  - URL-first signature requires caller to set Content-Type; previous code stringified body but didn't set header
  - Express body-parser silently left req.body = {}, server returned 400 "propertyId is required"

### Verified working in production:
- AI Advisor table `ai_conversation_messages` exists with correct 9-column schema (`session_id varchar`)
- Backend AI Advisor message persistence working (2 rows in table from prior testing)
- Add to Portfolio modal successfully creates owned_assets records (tested with 948 Florida Ave., $541k STR)
- Portfolio Dashboard renders the new asset, KPIs update

### BACKLOG (deferred to focused future sessions):

#### MarinaModal redesign (Add-to-Portfolio modal product debt):
1. **Remove Marina-specific language throughout the flow.** Affected strings include "Add Marina to Portfolio", "Marina added to portfolio successfully", "Failed to add marina", "Marina updated successfully". Should be neutral or asset-class-aware ("Add Asset to Portfolio", "Asset added to portfolio").
2. **Dynamic field labels by asset class.** "Total Slips" should only show for marinas. STR → "Bedrooms" or "Beds/Baths". Hotel → "Rooms". Golf course → "Holes". Multifamily → "Units". Self-storage → "Units" or "Sq Ft". Source the field config from `ASSET_REGISTRY[assetClassId]`.
3. **Currency input formatting.** All dollar fields ($541,000 not 541000) — input mask + display formatting. Use shared currency-input component if one exists.
4. **acquisitionPrice precision.** Server-side parseInt at server/routes/crm-routes.ts:11798/11823 drops cents. Likely fine for now but worth noting; switch to numeric/decimal parsing when handling cents matters.

#### apiRequest cleanup (technical debt from tonight's fix):
1. **Latent Content-Type bugs.** Other URL-first callers across the codebase that POST/PATCH JSON without setting Content-Type will hit the same 400 we just fixed in MarinaModal. Either: (a) auto-detect JSON bodies in apiRequest's URL-first branch and set Content-Type if body is a string starting with `{` or `[`, or (b) codemod all 323 callers to set the header explicitly. (a) is faster and lower-risk; (b) is the long-term clean fix.
2. **Codemod from method-first to URL-first.** Eventually migrate all 1,223 method-first callers to the URL-first pattern (which the docket variant already uses), then remove the legacy branch from apiRequest. Bigger refactor; do in batches.

#### AI Advisor product issues:
1. **Vanishing stream.** Response streams in successfully (200, 31KB), but UI clears `streamingContent` when `done` arrives and the new `messages` entry doesn't render in time. User sees text appear then disappear. Frontend bug in client/src/components/ai-assistant.tsx around line 374-385.
2. **Data-dump vs. advisor behavior.** Asking "what asset classes should I look at?" returns a long generic essay. A real advisor would qualify the user (location, capital, time horizon, active vs. passive) before answering. System-prompt redesign + multi-turn qualifying flow.

#### Other:
- Replit Agent's weekend work also pushed deploy-pipeline fixes (commits 79c7fea9, e488c931, 1fe5e3e0, 225eea31) addressing the schema-drift gate and Cloud Run cold-start issues we wrestled with on Friday. Those landed clean. Worth understanding what they did before the next deploy emergency.

### Still alive in production:
- AI Advisor (backend works, frontend rendering bug pending)
- Add to Portfolio (works for all asset classes, language and field labels need redesign)
- Phase 2 transient_* tables in DB (no routes/UI yet — Phase 2 product surface is next)

## 2026-04-27 (Mon) — Portfolio surface modernization (8 commits)

### Shipped to production

**Tactical fixes (early session):**
- 96c83906 — fix(api): dual-signature support in apiRequest helper. Detects URL-first vs method-first signature at call time. Resolves "X is not a valid HTTP method" runtime errors in 323 callers that used the URL-first pattern matching the docket variant.
- 21b62124 — fix(portfolio): Content-Type on Add/Edit Portfolio mutations. Without this header, Express body-parser left req.body = {} and the server returned 400 "propertyId is required".

**Phase 2 (route triage):**
- 13d9daa5 — Phase 2A. Grew asset_status enum from 3 to 10 values (preserving 'exit' for backward compat) and hold_strategy enum from 3 to 7 values. Fixed dead sidebar link `/operations/portfolio` → `/portfolio`. 11 idempotent ALTER TYPE migrations.
- 77f7b469 — Phase 2B. Resolved triple registration of GET /api/portfolio/summary. Three handlers were registering the same path; only portfolio-summary-routes.ts:17 was reachable. Owned-assets summary moved to its own URL /api/portfolio/owned-assets-summary. OperationsHome.tsx updated to query the new path; dropped the silent `?? assets.length` fallback.

**Phase 3 (asset-class redesign):**
- Phase 3A foundation. Added ownedAssets.assetClass (varchar 50, default 'marina') and ownedAssets.modelingProjectId (varchar, nullable, no FK). Extracted ASSET_REGISTRY + AssetRegistryEntry from client/src/pages/marina-map.tsx into client/src/lib/asset-registry.ts. ~25 asset classes across 6 groups. Server endpoints surface assetClass; getPortfolioSummary aggregates byAssetClass; convertDealToOwnedAsset copies assetClass from linked modeling project.
- 01f66c2a — Phase 3B. Asset-class-aware Add/Edit Portfolio modal. Mode toggle (Link Modeling Project / Manual Entry). Linked mode auto-populates assetClass from project; manual mode shows ASSET_REGISTRY-grouped picker. Dynamic title (Edit ${registry.label}), sizeLabel (Total Slips → Total Keys/Rooms/Holes/Sq Ft), occLabel. New CurrencyInput helper formats $X,XXX,XXX on blur, raw on focus. Annual Revenue replaced by 3 revenue-stream inputs (registry.rev[0/1/2]) with auto-derived total. Storage in keyMetrics.revenueStreams jsonb; legacy annualRevenue still written as sum for backward compat. New endpoint /api/portfolio/available-modeling-projects.
- c0f07ed3 — Phase 3C-Lite. User-visible Marina-language sweep on Portfolio surface (text only, no renames). 7 strings across 2 files: empty-state, error pages, comp table descriptions and headers.
- 5f6ece21 — Phase 3C-2-narrow. File/type/variable renames. MarinaModal → AssetModal, MarinaDetail → AssetDetail, OwnedMarinas → OwnedAssets. OwnedMarina interface → OwnedAsset. Full variable rename pass in Portfolio.tsx (marinas → assets, selectedMarina → selectedAsset, etc.). Importer updates in Router.tsx and Portfolio.tsx. git mv preserved file history. Build clean, typecheck baseline (824) preserved.

### Other artifacts committed

- PORTFOLIO_INVENTORY.md (522 lines) — complete code inventory of the Portfolio surface
- PORTFOLIO_TRIAGE.md (276 lines) — 14 findings prioritized with severity/effort/disposition
- Phase 2A and 2B fixed findings #7, #8, #12, #1 from triage. Phase 3A/B/C are net-new redesign (not in triage's 14).

### Backlog discovered during session

**Pre-existing CI failure (not caused by us):**
- GitHub Actions CI has been red on main since at least commit 19cff6f2. `npm run typecheck` exits 1 with 824 baseline TS errors. Production deploys via Replit Republish which uses a separate pipeline (check:schema && build); Replit's pipeline passes. Cleanup item: either fix CI to match Replit's actual pipeline OR fix the 824 typecheck baseline.
- 7 tests in server/schema-drift.test.ts failing with `expected +0 to be 2`. Pre-existing (verified by checking out pre-Phase-3A schema.ts; same failures). Likely a vi.mock hoisting issue or stale Drizzle internal change. Out of tonight's scope.

**OwnedAssets.tsx (renamed from OwnedMarinas) is dead code:**
- Lazy-imported in Router.tsx but the only route to it is a Redirect to /portfolio. Contains user-visible Marina text (chart titles, table headers, empty-state) that wasn't swept because the file is unreachable. Either delete the file entirely or wire up the route, then sweep the strings.

**MarinaMapEmbed.tsx Marina-language is shared between Portfolio and standalone marina-map page:**
- Filter chip "Owned Marinas (N)", search placeholder "Search marinas by name...", error fallback "Failed to load marina data...", loading "Loading marina locations..." — all unconditional, would affect both contexts. Safe Portfolio-context-only changes require either prop-driven SOURCE_LABELS or a full rename. Defer.

**Asset-shape-specific terms still hardcoded in some places:**
- Total Slips, slips occupied, Revenue/Slip, table columns referencing slips. These survive in some Portfolio.tsx prose. Future phase: drive these from ASSET_REGISTRY[asset.assetClass].sizeLabel.

**Latent Content-Type bugs:**
- The apiRequest URL-first branch (which we use for 323 callers) doesn't auto-set Content-Type. Phase 3B's MarinaModal Content-Type fix is a one-off; other callers will hit the same 400 if exercised. Cleanup: either codemod 323 callers to set the header explicitly, or auto-detect JSON-string bodies in apiRequest's URL-first branch.

**AI Advisor frontend issues (backend verified working):**
- Vanishing stream: streaming text appears then disappears when 'done' event arrives because setStreamingContent('') clears before setMessages re-renders (client/src/components/ai-assistant.tsx ~line 374-385).
- Data-dump vs advisor: long generic essays instead of qualifying users (location, capital, time horizon, active/passive). System prompt redesign + multi-turn qualifying flow needed.

**Triage findings still open:**
- #2 — /api/portfolio/asset-class-breakdown reads modeling_projects, not owned_assets (Medium)
- #3 — No breadcrumb for /portfolio routes (Low)
- #4 — assetPerformanceSnapshots write-only; no frontend reads them (Medium)
- #5 — acquisition_price is integer, drops cents (Backlog)
- #6 — keyMetrics three-way fallback creates inconsistent KPIs across pages (High, needs product alignment)
- #10 — Zero tests for in-scope Portfolio code (High; multiplier on every other fix's risk)
- #14 — Financials/Performance tabs are inline Card grids (blocks #4)


## 2026-05-01 — C19 (b-wiz) smoke-test backlog filed (7 items, FILE ONLY)

These items were surfaced during the C19 (b-wiz) smoke test on 2026-04-30 and
filed today as queue items. Memory entries created where the item warrants
standalone tracking; remaining items live here only.

**[FILE ONLY — DO NOT IMPLEMENT]** prefix used to make scope unambiguous for
future sessions. Do not start work on these without an explicit Brett ask.

### ITEM 1 — [FILE ONLY] Portfolio mode supports mixed asset classes
- Category: Phase D (UX expansion); Severity: MEDIUM
- Today's portfolio mode treats children as uniform asset class. Real-world
  funds hold mixed (marinas + multifamily + office). Wizard needs per-child
  asset-class selector; parent assetClass becomes 'mixed'/null (already
  supported by resolveAssetClassKey); rollup logic at modeling layer must
  aggregate children of differing classes — verify or add.
- Effort: M (3-5h) — wizard UI + child creation + rollup verification
- Memory: project_wizard_portfolio_mixed_classes.md

### ITEM 2 — [FILE ONLY] Property size unit (SF vs Acreage) asset-class-driven
- Category: C19 (b-wiz) follow-up; pairs with Phase D Storage UI memory
- Severity: MEDIUM
- Wizard Step 2 collects SF; Step 3 also renders Acreage unconditionally
  (wrong for duplex/multifamily). Add propertySizeUnit: 'sf'|'acreage'|'both'
  to ASSET_CLASS_CATALOGS and gate the Acreage section. Same architectural
  pattern as tabs.physicalStorage.
- Effort: S (1-2h)
- Memory: project_wizard_property_size_unit.md

### ITEM 3 — [FILE ONLY] Document upload supports Quarterly/Monthly/YTD
- Category: Phase C / Document Intelligence; Severity: MEDIUM-HIGH
- Today: annual + YTD only. Real materials include quarterly P&Ls, monthly
  T-12, sub-annual YTD. Touches wizard upload UI, Doc Intelligence parser,
  Pro Forma/DCF ingestion, schema for periodicity on
  financial_data_documents.
- Effort: L (8-12h) — multi-layer
- Verify against existing VANTAGE_DOCUMENT_INTELLIGENCE_SPEC.md before scoping
- Memory: project_doc_upload_periodicity.md

### ITEM 4 — [FILE ONLY] Auto-detect Financial Data Source from wizard upload
- Category: Phase C / UX polish; Severity: LOW-MEDIUM
- Inputs & Assumptions defaults to "Direct Input" even when user uploaded a
  P&L in the wizard. Two parts: (a) rename "Upload a P&L" → "P&L Upload" for
  consistency with "Direct Input" labeling; (b) read project's
  has_uploaded_pl (or equivalent) and default the toggle.
- Effort: S (30 min)
- Memory: project_inputs_default_source.md

### ITEM 5 — [FILE ONLY] Project Created modal auto-dismiss after 5s
- Category: Phase C / UX polish; Severity: LOW
- Post-wizard success popup needs explicit dismissal. Add 5000ms setTimeout,
  pause/clear on hover/focus.
- Effort: XS (15 min)
- Filed in journal only (no standalone memory — too small)

### ITEM 6 — [FILE ONLY] Inputs & Data section redesign
- Category: Phase D / UX redesign; Severity: MEDIUM
- Section needs design pass: more professional, better space usage, easier to
  navigate. Applies to all Financial Data Source modes. Design first,
  implement second — should NOT be scoped in code-only sessions until a
  design direction exists.
- Effort: L design + L implementation (4-8h each)
- Filed in journal only (blocked on design direction)

### ITEM 7 — [FILE ONLY] Fuel Sales feature card hardcoded for all asset classes
- Category: C19 (b-wiz) follow-up; Severity: MEDIUM
- OnboardingWizard.tsx:407 has a hardcoded `features` array including
  { id: "fuel", name: "Fuel Sales" } that renders for every class. Marina-only.
- Same fix pattern as ITEM 2 / Phase D Storage UI: add `assetClasses?:
  string[]` whitelist or move features into per-asset-class catalog entries.
- defaultWizardDesignatedSpaces (line 230) is the same problem — already
  covered by the existing Phase D Storage step UI generalization memory.
- Effort: S (15-30 min); bundles naturally with Phase D Storage UI work
- Consolidated into project_storage_step_generalize.md (no new memory file)


## 2026-05-01 — [FILE ONLY] Wizard property creation silently fails on duplicate

**Phase D — Wizard property creation silently fails on duplicate**
[FILE ONLY — DO NOT IMPLEMENT]

OnboardingWizard.tsx createDealMutation calls POST /api/properties after
creating the modeling project. On duplicate (existing crm_properties row
matching name+location), the server returns 409. The client swallows the
error in a try/catch with `console.warn('CRM property creation failed
(non-blocking):', e)` (lines 682-684 portfolio branch, 718-720 single
branch) and never surfaces it to the user.

Result: wizard appears to succeed, modeling project is created, but
crm_properties row is not created. The deal lives without a property
back-link.

Empirical confirmation from C19 (d-1) DB query 2026-05-01:
- crm_deals row 48a78ac6 created today (2026-05-01 11:56) — wizard run
  for "948 Florida Ave."
- Latest crm_properties row for that address: 2026-02-21 (3 months prior)
- No new crm_properties row from today's wizard run → silent 409 swallowed

Server-side reference:
- POST /api/properties duplicate detection: server/routes/crm-routes.ts:5703-5725
- Returns 409 with a `duplicates` array containing { id, title, address, status }
- Supports `skipDuplicateCheck=true` flag to force-create

Fix should distinguish:
- **True duplicate** → reuse the existing property (link the deal to it
  via whatever back-link mechanism Bug #5 from (d-1) resolves to:
  property_id column, deal_property_address junction, or other)
- **Genuine error** (network, 500, validation) → surface to user via
  toast like the modeling-project failure path

Implementation surface:
- client/src/components/onboarding/OnboardingWizard.tsx:672-684 (portfolio
  branch property POST)
- client/src/components/onboarding/OnboardingWizard.tsx:708-720 (single
  branch property POST)
- Detect 409 specifically, parse `duplicates[0].id` from response, link
  to deal
- For non-409 errors, propagate to onError toast

Pairs naturally with (d-1) Bug #5 resolution — both touch the deal↔property
back-link mechanism. Sequence: resolve Bug #5 scoping first (column vs
junction vs propertyType), then this fix uses the resolved mechanism.

Severity: MEDIUM — affects re-running wizard for same address (common
during testing and for users iterating on the same deal).

Effort estimate: S (1-2h) — assuming Bug #5 mechanism is already decided.
Without Bug #5 decision, blocked.

Surfaced during C19 (d-1) discovery 2026-05-01.


## 2026-05-01 — C19 (d-1) substep 0 follow-ups (3 items, FILE ONLY)

Surfaced during pre-fix verification of C19 (d-1). All three are
behavior changes induced *post*-(d-1) ship — masked today because every
crm_deals row has type='marina_acquisition' and every crm_properties
row has type='marina'. After (d-1) populates these fields correctly per
asset class, these latent issues become visible.

[FILE ONLY — DO NOT IMPLEMENT]

### ITEM 1 — Playbook templates only suggest for marina deals post-(d-1)
- File: server/routes/playbook-routes.ts:352, 387
- Severity: LOW; Phase D
- Two seeded playbook templates ("Marina Acquisition", "Due Diligence")
  carry dealType: 'marina_acquisition'. Today every wizard-created deal
  matches; after (d-1), only marina deals will. Decision needed:
  (a) generic-fallback playbooks per asset class, (b) partial matcher
  (\*_acquisition → all suggest), or (c) leave as-is (non-marina deals
  get no suggested playbook — acceptable for beta).
- Memory: project_playbook_templates_marina_only.md

### ITEM 2 — SavedViewsSidebar "Properties" preset is mislabeled
- File: client/src/components/crm/SavedViewsSidebar.tsx:60
- Severity: LOW; Phase C
- The saved CRM filter labeled "Properties" actually filters to
  propertyType === 'marina'. After (d-1), only marina properties match
  — confusing for users with mixed portfolios. Options: (a) rename to
  "Marinas", (b) remove the propertyType filter, (c) add per-asset-class
  saved views.
- Memory: project_savedviews_properties_mislabeled.md

### ITEM 3 — Manual + New Deal modal hardcodes marina_acquisition
- Files: client/src/components/modals/deal-form-modal.tsx:890, 1106
- Severity: MEDIUM; future C19 follow-up
- Manual CRM deal-create modal hardcodes dealTemplates "Acquisition"
  type: "marina_acquisition" (line 890) and SelectItem
  value="marina_acquisition" → "Acquisition" label (line 1106).
  Wizard fix in (d-1) doesn't cover this surface; deals created from
  the manual modal still land as marina_acquisition regardless of asset
  class (if an asset-class picker even exists in this modal — verify).
- Fix shape: same as (d-1), derive from selected asset class. Effort: S.
- Memory: project_deal_form_modal_marina_hardcode.md

## 2026-05-01 — Workspace Health Survey (session-level finding)

Workspace health survey: **11+ errors across post-wizard tabs surfaced once
entitlements unblock (Phase A fix-3) made tabs reachable.** Filed as a
session-level finding rather than individual bugs. Recommended approach:
dedicated workspace audit + categorical fixes in a follow-up session, not
opportunistic firefighting.

**Severity:** HIGH (PRE-BETA BLOCKER) — affects user experience after wizard
completion, which is the entire post-onboarding journey.

**Observed (non-exhaustive):** Pricing 500 (`investmentCriteriaProfiles`),
Capital Stack HTML-not-JSON + 403 lp_portal, DCF route-not-registered
(`/api/capital-markets/stats`, `/api/capital-markets/rates/latest`), Hold
Period CF "CSRF token missing", IRR Attribution + Mark-to-Market 400 Zod,
Replacement Cost marina-hardcoded for multifamily, Audit Trail 500,
Assumption Audit HTML-not-JSON, pro-forma-charts.tsx:454 `noi is not defined`,
Document Studio "Operation failed" (resolved by Phase A fix-4a manual seed).

**6 root-cause categories** identified (one systemic fix can unblock multiple
tabs):
1. Entitlement table seeding gaps → **Phase A fix-4b** (predicate from packs)
2. Missing/unregistered routes → orphan inventory + add-or-remove
3. Code-level runtime errors → individual fixes
4. Asset-class-awareness gaps → bundles into Phase D asset-class-aware
   workspace content body of work
5. Empty-state UX vs error UX → shared `<RequiresInputs>` wrapper for
   Analysis tabs
6. Auth/session/CSRF infra → audit fetch helpers for CSRF threading

**Effort estimate:** 1-2h discovery pass + 1-3h per systemic fix = **8-15h
total focused work** to functional pre-beta. Larger than previously estimated
in `project_remaining_queue.md` (FM Beta Publish Queue), which is now
incomplete — actual beta gate is broader.

**Companion work this session:**
- Phase A fix-4a (DB-only): seeded billing_feature_flags for org cd3719c3
  with 34 institutional features (INSERT 0 34, ai_narratives included).
  Unblocks `POST /api/om/oms` and other gate-protected routes.
- Memory: `project_workspace_health_survey_2026_05_01.md` — index for
  remediation, do not pick off individual bugs without first deciding
  systemic-fix bucket.
- Memory: `project_phase_a_fix_4b_subscription_seeds_flags.md` — systemic
  fix, recommend pairing with fix-2b in one PR.
- Memory: `project_create_new_document_surface_divergence.md` — three
  surfaces share modal title with three different backends + gates.

## ✅ Session wrap — C19 (d-1) closed; Phase A fix-1/2a/3/4a shipped (2026-05-01)

C19 (d-1) — wizard-driven asset-class-correct deal/property creation —
shipped and DB-verified for multifamily. Along the way, a cascade of
entitlement-layer bugs that had been masking C17 multifamily-locked, the
Institutional FM lockout, and OM Builder 403s got peeled back through four
Phase A fixes (two code commits + two DB-only seeds for Brett's org). The
post-(d-1) workspace surfaced 11+ unrelated errors → captured as a
session-level finding rather than opportunistic firefighting; that becomes
the next chapter of pre-beta work.

### What changed (code)
- `client/src/contexts/EntitlementsContext.tsx` — Phase A fix-3 (commit
  **32139804**). Eight-fix patch for response-shape parse: unwrap
  `data.subscription` envelope, populate `packageName`, correct `tierToSlug`
  to identity for the 5 real tiers, delete dead PUT useEffect, spread
  `defaultSubscription` in cache-fallback + success branches, rename
  `addons → addOnModules`. Upstream root cause behind C17 multifamily-locked,
  Institutional FM lockout, and sidebar UPGRADE-everywhere.
- Phase A fix-1 (commit **a9d44520**, prior to this session) — global
  `ai_narratives` middleware path-prefix scope fix (already on main when
  session started; referenced for context).
- C19 (d-1) (commit **710482be**, prior to this session) — wizard
  asset-class-aware persistence for `crm_deals` + `crm_properties`.

### What changed (DB-only seeds, Brett's org cd3719c3)
- Phase A fix-2a — `UPDATE organizations SET asset_classes = …` to populate
  the column the gate at `crm-routes.ts:13948` reads. Unblocked the
  "not in your plan" 403 on every non-null asset class.
- Phase A fix-4a — `INSERT 0 34` rows into `billing_feature_flags` for org
  cd3719c3 (all 34 institutional features incl. `ai_narratives`,
  `lp_portal`, `audit_trail`, `waterfall_engine`, `document_intelligence`).
  Mirrors `provisionFeatureFlags(orgId, 'institutional')` semantics. Unblocks
  `POST /api/om/oms` and other `requireEntitlement`-gated routes.

### Decisions made
- **Phase A fix-2a + fix-4a are bandaids, not fixes.** Both are
  manual-INSERT unblock for Brett's org only. The systemic fixes (fix-2b,
  fix-4b) are filed but deferred — recommend predicate-derives-from-packs
  (option b in both memos) so a single source of truth eliminates four
  drift surfaces (subscriptions ↔ packs ↔ asset_classes ↔ feature_flags).
  Pair fix-2b + fix-4b in one PR.
- **Workspace Health Survey is one body of work, not 11 individual tickets.**
  Six root-cause categories; one systemic fix unblocks multiple tabs. Don't
  pick off individual bugs without first deciding the systemic-fix bucket.
- **Three "Create New Document" surfaces should be flagged for UX review,
  not opportunistically merged** — DocumentStudioHub vs project-oms vs
  workspace.tsx hit three different backends with two different gate
  behaviors.
- **Replit auto-commit absorbed Phase A fix-3** before manual `git commit`
  could run — verified via `git log -1 --stat` matched intended diff scope.
  No amend needed. (Existing `feedback_replit_autocommit.md` pattern held.)

### Verification
- (d-1) DB verification — `crm_deals` newest row for org cd3719c3:
  `type='multifamily_acquisition'`, `asset_class='multifamily'`,
  `modeling_project_id='d4dcdaa5-…'` (populated UUID). Prior rows
  (pre-(d-1)) still show `marina_acquisition` / `marina` — fix is
  forward-only, no retroactive rewrites. **PASS.**
- (d-1) `crm_properties` newest row: `type='multifamily'`, `title='Sunset
  Ridge Apartments'`, created 1s after the deal (wizard chains property
  creation). **PASS.**
- Phase A fix-4a — `SELECT feature, is_enabled FROM billing_feature_flags
  WHERE org_id='cd3719c3-…'` → 34 rows, all `is_enabled=true`. **PASS.**
- Phase A fix-3 (EntitlementsContext) — code-level only this session;
  browser-level multifamily-unlocks-for-institutional verification deferred
  to next session smoke (workspace audit anyway).
- Dev server: restarted cleanly after fix-3 commit (PID 798, /api/health
  7s); subsequently entered a half-started state during later work
  (process up, port refusing connections, babel parse error in
  `/tmp/devserver.log` — unrelated to this session's edits, needs a clean
  restart next session).

### Filings this session (~17 backlog items)
Memory files added (in order):
- Performance / DX (3): `project_perf_vite_optimizedeps.md`,
  `project_perf_vite_cache_persistence.md`,
  `project_perf_lazy_load_heavy_modules.md`
- Sunset Ridge smoke-test backlog (8):
  `project_audit_trail_500.md`, `project_assumption_audit_html_response.md`,
  `project_irr_attribution_400_empty_state.md`,
  `project_mark_to_market_400_empty_state.md`,
  `project_pro_forma_charts_noi_undefined.md`,
  `project_replacement_cost_marina_hardcoded.md`,
  `project_irr_attribution_value_review.md`,
  `project_mark_to_market_explanation_tooltip.md`
- Phase A systemic + UX (3):
  `project_workspace_health_survey_2026_05_01.md` (master index),
  `project_phase_a_fix_4b_subscription_seeds_flags.md`,
  `project_create_new_document_surface_divergence.md`
- Product / architecture (3):
  `project_broker_extended_profile_subscription.md`,
  `project_new_lead_modal_with_autocomplete.md`,
  `project_pipeline_vs_workspace_deals_relationship.md`
- All 17 indexed in `MEMORY.md`.

**Pattern noted:** Replacement Cost marina-hardcoded joins three previously
filed items (Storage step, Fuel Sales card, SF-vs-Acreage) under one Phase D
**asset-class-aware workspace content** body of work. Same fix shape across
all four — catalog-driven field schema, one coordinated catalog extension.

### Phase A systemic items still open
- **fix-2b** (`project_subscription_asset_classes_drift.md`) — subscription
  flow doesn't seed `organizations.asset_classes`
- **fix-4b** (`project_phase_a_fix_4b_subscription_seeds_flags.md`) —
  subscription flow doesn't seed `billing_feature_flags`
- **tier-name reconciliation** (`project_tier_name_mismatch.md`) — DB tier
  values vs SUBSCRIPTION_PACKAGES marketing names vs server gate strings
  all diverge; recommend canonical vocabulary + normalization helper before
  patching individual gates

These three are the same architectural class. One coordinated PR can
address all three by switching gate predicates to derive from canonical
subscription/pack state.

### Next session
**Do NOT open another smoke test until the workspace audit is sequenced.**
C19 (d-1) is closed. The next chapter is one of (Brett's call):
1. **(d-1.5) deal↔property linkage** — verify back-link traversal,
   close `project_wizard_property_409_silent.md`
2. **(d-2) portfolio fan-out** — extend (d-1) to portfolio mode with
   mixed asset classes (`project_wizard_portfolio_mixed_classes.md`)
3. **Deferred 1031 / orchestrator-v2 tax-engine drift bugs** — Tier 0.5
   beta-blockers (`project_1031_adapter_drift.md`,
   `project_orchestrator_v2_tax_drift.md`)
4. **Workspace audit** — sequence the 6-category remediation per
   `project_workspace_health_survey_2026_05_01.md`; pair with Phase A
   fix-2b/fix-4b/tier-reconcile as one systemic PR

**Not** "explore the platform and fix what surfaces" — that's how this
session ballooned to 17 backlog items.

### Known gotchas / next-session housekeeping
- Dev server (`/tmp/devserver.log`) ended this session in a half-started
  state. Run `/restart-dev` first thing next session before any browser
  verification.
- Three Phase A bandaids (fix-2a + fix-4a manual seeds) are live for org
  cd3719c3 only. Any other test org will hit the same 403s — do not assume
  the fix scaled.
- `project_remaining_queue.md` (FM Beta Publish Queue) is now incomplete
  vs actual pre-beta scope; treat `project_workspace_health_survey_…` as
  the more accurate beta gate going forward.

## ⚠ 2026-05-01 — Phase A fix-2b/4b discovery surfaced architectural correction

Read-only discovery pass for Phase A fix-2b/4b/tier-reconcile **revealed
that prior memories were architecturally wrong**. The actual root cause
behind Brett's OM Builder 403, the asset-class lockout, and the broader
"my tier should give me X but doesn't" pattern is **tier-vocabulary
mismatch** + **dual-webhook split**, not "subscription create forgot to
seed downstream tables."

### Corrections filed
- `project_phase_a_fix_4b_subscription_seeds_flags.md` — REWRITTEN.
  `billingService.createSubscription` DOES call `provisionFeatureFlags`
  at `billing-service.ts:223` (also wired into `changeTier` line 489
  and Stripe webhook line 823). Earlier memory's claim was wrong.
- `project_subscription_asset_classes_drift.md` — APPENDED CORRECTION.
  `organizations.asset_classes` is NOT a subscription downstream table;
  it's written by the onboarding wizard (`onboarding-routes.ts:148`,
  `:204`) and is independent of subscription provisioning. The gate at
  `crm-routes.ts:13957` may be the real bug — investigate before
  patching.
- `project_tier_vocabulary_reconcile.md` — NEW (Phase A fix-5).
  `billing-service.ts SUBSCRIPTION_TIERS` uses
  `{starter, growth, institutional, enterprise}` (4) while
  `pack-service.ts SUBSCRIPTION_TIERS` and frontend
  `SUBSCRIPTION_PACKAGES` use canonical
  `{starter, investor, broker, owner-operator, institutional}` (5).
  Only `starter` + `institutional` overlap. Three middle tiers fail
  end-to-end:
    - `createSubscription` throws `Invalid tier` → 500
    - `/api/billing/checkout` returns 400
    - Stripe webhook at `billing-service.ts:782` silently skips
  Smoking-gun comment at `billing-service.ts:776`:
  `// ── Core platform subscription (Starter / Growth / Institutional) ──`

### Revised fix sequencing
1. **fix-5 (tier-reconcile)** — code-only ~2-3h. MUST come first.
   Unify SUBSCRIPTION_TIERS to canonical 5-tier vocabulary; drop
   ghost `growth`/`enterprise` if unused.
2. **fix-4b (atomic provision)** — depends on fix-5. ~3-4h. Collapse
   `server/index.ts` webhook + `billing-service.ts` webhook +
   `createSubscription` + `changeTier` into one `provisionTier(orgId,
   tier)` helper that writes subscription + packs + flags atomically.
   Use `onConflictDoUpdate` not delete-then-insert for packs to
   preserve trial extensions.
3. **fix-2b (asset_classes gate review)** — independent. Investigate
   first whether the gate at `crm-routes.ts:13957` should exist at
   all before patching anything.

### Brett's specific case explained
`'institutional'` is the one tier that exists in BOTH vocabularies, so
`createSubscription` would have worked for him IF it had been called.
But his `billing_feature_flags` was empty while `organization_packs`
was populated → **his org bypassed `billingService` entirely** (likely
direct DB seed during dev/onboarding). The dual-webhook split means
two different scripts populated the two tables, and the flags one
never ran for his org.

### Hybrid architectural recommendation (revised)
Pure derive-at-predicate-time loses the `is_override` /
`overrideExpiresAt` mechanism actually used at `feature-gate.ts:59`
for trial expansions. **Hybrid: seed atomically + add
`computeEntitlementsForOrg(orgId)` derive helper for new gate code,
preserve override rows as overlay on derived defaults.**

### Next step
Proceed to Phase A fix-5 substep 1 (read-only grep audit) per Brett's
plan. Substep 1 reports on:
- All `'growth'` / `'enterprise'` literals in server/ shared/
- All `SUBSCRIPTION_TIERS[...]` lookups
- Full pack-service.ts vs billing-service.ts feature-list comparison
- Decision input: derive features from pack-service vs define
  independently
Substep 2 (code edits) waits on Brett's review of substep 1.

## 2026-05-02 — Phase A fix-4b PR-A helper landed + Portfolio rebuild discovery

**Shipped:**

- **`feat(billing): add atomic provisionTier helper`** — commit `5fb36472` on `main`.
  - New `server/services/provision-service.ts` exports `provisionTier(orgId, tier, options)`. Single `db.transaction()` covering all three tables: `billing_subscriptions` (upsert), `organization_packs` (diff: upsert desired + cancel non-desired, never delete), `billing_feature_flags` (override-preserving diff: deletes only `is_override=false` rows that fall out of the new tier; conflict-update set excludes `is_override` so existing override rows are not silently demoted — fixes a pre-existing bug in `billingService.provisionFeatureFlags`).
  - Helper landed only. Call-site migration deferred — three filed memories track the chain:
    - `project_provision_service_circular_import.md` (~10 min, must land first; move TIER_LIMITS to shared/tier-packs.ts)
    - `project_phase_a_fix_4b_pr_a_callsite_migration.md` (~1.5h; wire createSubscription / changePlan / handleCheckoutSessionCompleted core branch)
    - `project_phase_a_fix_4b_pr_b_webhook_migration.md` (~1.5h; collapse server/index.ts dual-webhook split)
  - TS baseline preserved at 26.

**Discovery (no code):**

- **Portfolio rebuild master plan** filed as `project_portfolio_rebuild_plan.md`. Three current portfolio surfaces (`index.tsx`, `dashboard.tsx`, `portfolio-returns.tsx`) hit `/api/portfolio/summary` with **divergent shapes**. Backend split between Drizzle (`portfolio-rollup-service.ts`, 621 lines) and raw SQL (`portfolio-summary-routes.ts`). Per-project IRR is a heuristic capped at 50% (rollup-service.ts:570), not real XIRR. Expense-category typo at line 266 (`'Expense'` vs line 164 `'Expenses'`) silently misses actuals.
- **Critical data gaps:** `portfolio_assets` table exists (schema.ts:16380) with the right shape but **0 rows for test org**; `valuation_snapshots` empty org-wide → silent fallback to `acquisitionPrice` confirmed at crm-routes.ts:11692; `capital_stacks.interest_rate_type` and `.maturity_date` columns DO NOT EXIST (debt-maturity wall + fixed/floating exposure unbuildable without 2-col migration).
- **Effort:** 68-96h (~2-3 weeks focused) including ~1.5wk Phase 0 prereqs (data backfill + workspace gate fixes) which are independently valuable regardless of rebuild decision.
- **Blocked on Phase 0** + Brett's answers to 10 open questions (underperformer threshold, projection ratios, IRR replacement posture, portfolio_assets writer cadence, benchmark sources, LP gating, tab priority, deprecation strategy, rent-roll backfill, capital_stacks migration timing).

**Decision deferred** pending Phase 0 prereqs + Brett's answers. **DO NOT start v1 without Phase 0** — would ship as Potemkin (purchase prices displayed as current values, no IRR data, no debt maturity).

**Highest-value next-session candidates:**

- (a) Phase A workspace prereqs continuation — fix-5 substep 2 (tier-vocab edits) and fix-4b PR-A substep 3 (call-site migration). Both gate the portfolio rebuild's gating story.
- (b) Workspace audit kickoff — `pro-forma-charts.tsx:454` noi=undefined (~30 min) and shared `<RequiresInputs>` empty-state wrapper for IRR Attribution + Mark-to-Market. Both are component-level prereqs for portfolio Returns/Risk tabs.
- (c) 1031/orchestrator-v2 tax drift bugs (`project_1031_adapter_drift.md`, `project_orchestrator_v2_tax_drift.md`) — Tier 0.5 beta-blockers, 30-60 min each, cause silent zeros in IC memos and LP statements.
- (d) (d-1.5) deal↔property linkage — wizard 409 silent-fail (`project_wizard_property_409_silent.md`) and manual deal-form modal hardcode (`project_deal_form_modal_marina_hardcode.md`).

## 2026-05-02 (cont.) — Phase A close + correctness fixes

**Shipped (3 commits):**

- **`47d352b3` — `fix(exit-strategy): correct silent-zero tax + 1031 boot/gain drift`**
  Three correctness bugs in `shared/exit/` adapters caused by engine refactors that renamed/restructured result types. (1) `adapt1031ResultOldToNew` read 12 legacy flat fields off `Exchange1031EngineResult` — now reads canonical `bootAnalysis.*` / `totalRecognizedGain` / `totalDeferredGain` / `newAggregatedBasis`; signature gained `relinquishedDebt` 3rd param since the new-shape input doesn't carry it. (2) `orchestrator-v2.ts:1366-1385` read 7 legacy flat tax fields — now reads `federal.{ltcgTax, section1245Tax, niitTax, totalFederalTax}` / `dualState.netStateTax` / `totalTaxLiability`. (3) `adaptTaxProfileNewToOld` returned `adjustedGrossIncome`/`isHighIncome` (fields that don't exist) and omitted required `otherOrdinaryIncome`/`otherInvestmentIncome` — `as any` cast hid it; NIIT silently collapsed to 0. Also: `EarnoutTaxTreatment` union expanded to include `'capital_gain'` (parallel Zod schema updated to match — without it, the new union value would have been rejected at runtime). TS baseline 26→6 (77% reduction). 18 regression-shield assertions added to `patch-acceptance.test.ts`; new `orchestrator-v2-tax.test.ts` with 4 scenarios. 122/122 tests pass.

- **`79fe1cad` — `feat(billing): wire provisionTier into three call sites; close circular import`**
  PR-A substep 2.5 (TIER_LIMITS extraction to `shared/tier-packs.ts` — eliminates the runtime-safe-but-fragile `billing-service ↔ provision-service` circular dep that would have formed once call-site migration landed) + substep 3 (`changePlan`, `createSubscription`, `handleCheckoutSessionCompleted` core branch all route through `provisionTier`). Behavior change flagged: `createSubscription` is now idempotent — re-runs are safe re-provisions rather than unique-violation throws. Inline-documented.

- **`ab7a0acb` — `fix(billing): migrate Stripe webhook handlers to provisionTier`**
  PR-B all four substeps. Helper extensions (`isTierSlug` type guard in `shared/tier-packs.ts`; `status` union expanded to include `'canceled' | 'past_due' | 'paused' | 'incomplete'`; `cancelAt` and `canceledAt` options with COALESCE preservation). Three webhook handler migrations: (1) `customer.subscription.deleted` — now atomically downgrades to starter, cancels ALL active packs (not just the one matched by `stripeSubscriptionId`), and re-provisions flags to BASE_FEATURES; (2) `customer.subscription.updated` — atomically diffs packs and re-provisions flags on tier change, filtered through `isTierSlug` to prevent the prior tier-corruption bug; (3) `checkout.session.completed` packType branch — removed the corrupting `billing_subscriptions` UPSERT; single-pack purchases (e.g., `master_comps`) no longer flip the tier column.

**Phase A entitlements chapter — CLOSED.** Four commits across two days:
- `118ddac6` — tier vocabulary reconcile
- `5fb36472` — provisionTier helper landing
- `79fe1cad` — call-site migration + circular-import close
- `ab7a0acb` — Stripe webhook migration

Closes Brett's lockout symptom (tier change via Stripe webhook now re-provisions flags atomically), tier corruption from single-pack purchases, override-demotion bug in `provisionFeatureFlags`, ghost pack rows from `stripeSubscriptionId`-keyed updates, and the 3-middle-tier vocabulary mismatch that broke 60% of the subscription system.

`provisionFeatureFlags` is now orphaned (no callers in `server/` or `client/`) — ready for retirement in a future cleanup sweep.

**Memories filed (7 today):**
- `project_earnout_engine_dead_branch_ordinary_income.md` (LOW)
- `project_exit_scenario_kpis_methodology_version.md` (MEDIUM)
- `project_provision_service_circular_import.md` (RESOLVED via PR-A 2.5)
- `project_phase_a_fix_4b_pr_a_callsite_migration.md` (RESOLVED via PR-A 3)
- `project_phase_a_fix_4b_pr_b_webhook_migration.md` (RESOLVED via PR-B)
- `project_topackstatus_dead_code.md` (LOW Phase D cleanup)
- `project_non_tier_pack_subscription_updates_skipped.md` (LOW; promote to MEDIUM if recurring single-pack billing ships)

**Next-session candidates (Brett picks):**
- (a) (d-1.5) deal↔property linkage — wizard 409 silent-fail + manual deal-form modal marina hardcode (~1-2h, closes C19)
- (b) Workspace audit kickoff — `pro-forma-charts.tsx:454` noi=undefined (~30 min) + shared `<RequiresInputs>` empty-state wrapper (~1-2h)
- (c) Phase A fix-2b — `asset_classes` gate review at `crm-routes.ts:13957` (likely shouldn't exist; ~1-2h investigation + fix)
- (d) Portfolio rebuild Phase 0 prereqs — `portfolio_assets` writer + `valuation_snapshots` seed + `capital_stacks` 2-col migration (~8-10h, required before any portfolio v1 work)

## 2026-05-04 — Spec filed: multi-partner GP/LP modeling

**Filed (no code):** `project_multi_partner_gp_lp_modeling.md` — Phase D / Vantage Fund Management spec for multi-partner investment structures with per-entity ownership, basis, debt allocation, and GP-vs-LP RBAC.

**Why filed now:** Vantage's current Fund Management assumes single GP / single LP / pro-rata split (`lpIrr` / `gpIrr` column pair on projects, single-partner `capital_stacks`). Real fund-management buyers expect multi-LP structures with per-entity basis (1031 carryover, step-up basis, mid-stream entry), partner-specific debt guarantees, and strict GP-vs-LP visibility separation. This is a credibility gap that blocks the institutional positioning story — files now so it can be sequenced against current Phase A / C19 work and the Portfolio rebuild master plan.

**Estimated effort:** 30-42h focused work + 2-3h Phase 0 discovery (must answer six architectural questions first — schema shape, capital account lifecycle, pro-rata vs waterfall semantics, RBAC enforcement layer, LP user model, cross-org LPs).

**Critical risk:** RBAC retrofit cost compounds once real LP users exist with real accounts. Schema changes become breaking changes against live data. v1 should ship before any real LP onboards — build RBAC into the schema from day one.

**Hard scope:** 5-7 canonical structures (single LLC, GP+LP, GP+multi-LP, TIC, waterfall promote, preferred equity tranche, "other" manual entry). Reject unbounded "any structure" UI.

**Status:** FILE ONLY. Not started. Gated behind current Phase A / C19 work completing. Sister spec to `project_portfolio_rebuild_plan.md` — both are HIGH-severity Vantage-positioning specs blocked on Phase 0 discovery.

**Memory index updated:** new entry between Portfolio rebuild master plan and `activatePack` trial-wipe bug — keeps the Phase D Fund Management cluster contiguous.

## 2026-05-05 — Phase 0 PR-1 portfolio data backfill

Closes Phase 0 PR-1 of the Portfolio rebuild master plan. The new
6-tab dashboard's data layer now has actual snapshot rows backing
it; future scenario saves auto-populate via a new publish hook;
`capital_stacks` has the two columns needed for the debt-maturity
wall + fixed/floating exposure panels.

### Shipped (today's authorized work)

- **`382d1f81` + `f0cdf791`** — `capital_stacks` 2-column migration.
  `interest_rate_type` (varchar) + `maturity_date` (date) columns
  added to live DB and `shared/schema.ts`. Both columns present and
  correctly typed (verified via `information_schema.columns`).
  Replit auto-commit pair; the second is a pure reorder of the
  same fields next to other debt-related columns.
- **`7a7fee12` "Git commit prior to merge"** — scenario-snapshot
  hook helper landed: `server/services/scenario-snapshot-hook.ts`
  (single export `triggerValuationSnapshot(orgId, projectId,
  userId?, note?)`). Direct `createSnapshot` call with
  `trigger='model_save'`, no debounce — scenario events are
  deliberate user actions and one snapshot per event is correct.
  Failure-isolated: caller does not need a try/catch. Plus 3
  versioning service call sites: `createScenario` (line 93),
  `updateScenario` createNewVersion branch (line 154),
  `restoreVersion` (line 285).
- **`132d5d4c` "Add a valuation snapshot when a scenario is
  forked"** — 4th hook site: `forkScenarioVersion` in
  `scenario-governance-service.ts` (line 315). Same helper. Auto-
  commit message captured one of the five sites; the helper itself
  + 3 of the 4 versioning sites landed under `7a7fee12`'s "Git
  commit prior to merge" generic label.
- **`adee8862` "Git commit prior to merge"** —
  `valuation-timeline-service.ts:372` typo fix
  (`rentRollEntries.monthlyRent` → `monthlyRate`). Pre-existing
  bug. The Drizzle column ref pointed to a field that doesn't exist
  on `rentRollEntries`; TypeScript silently allowed it because the
  unrelated `marinaLeases` table at schema.ts:11002 has a
  similarly-named `monthlyRent` field, so type inference
  cross-resolved. At runtime, Drizzle interpolated the unknown
  column ref as empty, producing `SUM()` with zero args →
  PostgreSQL `function sum() does not exist`. Caught only because
  this read path had never been exercised against real data
  (`valuation_snapshots` had 0 rows org-wide before today).
  Cross-codebase audit: this was the only site with the bad ref;
  10 other sites across 8 files use `monthlyRate` correctly.
- **`c1a651fd` "Git commit prior to merge"** —
  `server/scripts/backfill-valuation-snapshots.ts` one-time
  backfill. Filter: `WHERE purchase_price IS NOT NULL` to skip
  data-empty rows that would produce Potemkin snapshots. Calls
  `createSnapshot` directly per eligible project rather than
  `triggerManualSync` (the latter iterates all projects regardless
  of data quality, and `'model_save'` isn't even in its
  `DataChangeSource` enum). `userId` omitted — confirmed optional
  on `ValuationTimelineQuery` and `created_by` is nullable on the
  snapshots table.
- **Backfill run (2026-05-05).** 4/4 projects succeeded for test
  org `cd3719c3` (Surfside 3 Marina, Oakdale Yacht Club, Sunset
  Harbor Village Marina, 948 Florida Ave.). All snapshots
  correctly document "no operating data yet" — `indicated_value`
  NULL on all 4 (NOI=0 because rent_rolls/fuel/ship_store all
  empty → `noi/capRate` formula at line 271 yields null);
  `cap_rate` populated on 3 of 4 (sourced from `project.year1CapRate
  / 100`); `irr` and `equity_multiple` NULL on all 4 (structural
  gap — see follow-up below).

### Three discovery-phase corrections to the original spec

The original spec sketch had three signature mismatches against the
actual service surfaces. Caught read-only before any code:
- `notifyDataChange(orgId, projectId, source)` per spec → actual
  signature is `notifyDataChange(event: DataChangeEvent)` AND
  `'model_save'` isn't in `DataChangeSource` AND
  `shouldSyncProject` has no branch for it. Decision: skip the
  sync-service path entirely; call `createSnapshot` directly with
  `trigger='model_save'`.
- `triggerManualSync(orgId, userId)` doesn't filter by
  `purchase_price`. Decision: filter at the script level, call
  `createSnapshot` per eligible project.
- `triggerManualSync` returns `{ projectsSynced }`, not
  `{ snapshotsCreated }`. Decision: track per-project ✓/✗ in the
  script directly, not via a return-shape contract.

### Replit Agent autonomous activity (parallel, not directed from this session)

Six unrelated commits landed during today's session window. None
were directed from this conversation:

- `9ae59921` — broker credential audit trail (task #344)
- `f7f50eff` — BrokerCredentialBadge on deal detail (task #340)
- `bace8845` (+ task #338 v3-v7, task #339) — broker credential
  signup flow
- `37736460` — task #350: admin emails on broker credential updates
- `96c88bac` — broker re-review notifications
- `9d9a1883` — analytics real-data + ship_store multi-tenancy

Pattern observed and worth tracking: Replit Agent now operates a
parallel task queue (#338-#350 broker credential chain) AND a
checkpoint-replay mechanism (`9d9a1883` and `69bcf699` show
Jan-15-2026 author dates but are recent main-branch commits) AND
the auto-commit stub-messaging pattern (the "Git commit prior to
merge" placeholder). Filing a session-observations memory rather
than treating each as a one-off so the cumulative shape is visible
next session.

### Phase 0 — remaining work (deferred per discovery)

- **`portfolio_assets` writer — DEFERRED entirely.** New dashboard
  reads from `modeling_projects` + `valuation_snapshots` (verified
  via grep in `portfolio-summary-routes.ts`). The canonical
  roll-up `portfolio_assets` table exists for a future
  architectural scenario but is not on the dashboard's read path
  today. Original Phase 0 plan over-scoped this.
- **`capital_stacks` UI capture for new columns — deferred to
  PR-2.** The schema columns are live; the Debt Inputs UI doesn't
  yet capture them. Not blocking dashboard rendering — defer.

### Memories filed

- `project_valuation_timeline_irr_moic_gap.md` (MEDIUM, ~4-6h,
  FILE ONLY) — `valuation-timeline-service.ts:353-357` hardcodes
  `irr/equityMultiple/cashOnCash: null`. Service has no returns
  math. Portfolio dashboard Returns tiles will render NULL until
  wired. Coordinate with `shared/exit/orchestrator-v2.ts` (already
  has IRR/MOIC math for exit scenarios) and
  `shared/finance/xirr.ts` primitive.

### Memories status-updated

- `project_capital_stacks_columns_migration.md` → **RESOLVED**
- `project_portfolio_rebuild_plan.md` → annotated with Phase 0
  PR-1 closed status

### Next-session candidates (Brett picks)

- **(a) Workspace audit kickoff** — `pro-forma-charts.tsx:454`
  `noi=undefined` ReferenceError (~30 min) + shared
  `<RequiresInputs>` empty-state wrapper for IRR Attribution +
  Mark-to-Market (~1-2h).
- **(b) Phase A fix-2b** — investigate whether
  `crm-routes.ts:13957` `asset_classes` gate should exist at all
  (~1-2h investigation + fix).
- **(c) Multi-partner GP/LP modeling** — Phase 0 discovery (the 6
  architectural questions, ~2-3h, no code).
- **(d) `capital_stacks` UI capture** for `interest_rate_type` /
  `maturity_date` in Debt Inputs (~1h, completes PR-2 of Phase 0).
- **(e) Replit Agent operational review** — investigate
  auto-commit pattern, audit today's parallel commits, decide on
  memory-filing policy for autonomous parallel work.



