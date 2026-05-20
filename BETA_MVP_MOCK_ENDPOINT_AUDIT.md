# MarinaMatch — Mock / Stub / Fabricated-Data Endpoint Audit

**Date:** 2026-05-20
**Author:** Brett + Claude (Opus 4.7 1M)
**Context:** Phase 4a. Triggered by Item 7b — the `pro-forma-charts` mock endpoint
surfaced incidentally, and a second (the DD-checklist seed bug) surfaced during
Item 5. This audit is the systematic follow-up: enumerate *every* endpoint that
returns hardcoded/fabricated data, ignores its inputs, or has never been
exercised — **before friendlies**, ranked by friendly-visibility.

This document is a **catalog + remediation plan only**. Zero code or behavior was
changed in producing it. Fixes are scoped and ranked here; they are scheduled
separately.

---

## 1. Methodology

### Sweep patterns

Five grep patterns were run across `server/routes/` (160 files), `server/routes.ts`
(~3,787 lines), and a flagged subset of `server/services/`:

1. **Hardcoded data in response** — `res.json(...)` / return payloads built from
   literal dollar amounts, percentages, cap rates, or fake records rather than
   query results or computed values.
2. **Destructured-but-unused params** — handlers that destructure
   `req.params.X` / `req.query.X` / `projectId` etc. and never reference them
   again. The "ignores its input" tell.
3. **No data-layer call** — handlers returning rich structured domain data with
   zero `db.` / `pool.query` / `storage.*` / `*Service.*` calls.
4. **mock / stub / placeholder / TODO / FIXME / dummy / fake** tokens in
   comments or identifiers indicating fake or incomplete behavior.
5. **Never-run / broken seed paths** — seed/init endpoints whose INSERT omits
   NOT-NULL columns, references nonexistent columns, or is otherwise broken on
   first real call.

### Verification discipline

A grep hit is **not** a finding. Every candidate handler was opened and its full
body read to confirm it genuinely fabricates / ignores / fails. False positives
ruled out: default config values, enum lists, currency codes, feature flags,
validation limits, page-size defaults, HTTP status codes, `Math.random()` used
for IDs / jitter / backoff / 2FA codes, and model assumptions (cap-rate / LTV
constants used as inputs, not fabricated outputs). Endpoints that are
*intentional* fixtures (dev-gated demo auth) were marked INTENTIONAL, not flagged.

The 8 pre-beta-blocker file:line references were additionally re-verified by
hand against the live source after the slice agents reported.

### Candidate → confirmed (false-positive rate is itself informative)

| Slice | Scope | Candidates examined | Confirmed |
|---|---|---|---|
| A | `server/routes/` files 1–40 (accounting → crm-extended) | 9 | 3 |
| B | `server/routes/` files 41–80 (crm-gaps → fund-management) | 24 | 4 |
| C | `server/routes/` files 81–120 (google-places → permissions) | 38 | 2 |
| D | `server/routes/` files 121–160 (phase-gates → workspace) | 23 | 4 |
| E | `server/routes.ts` + flagged `server/services/` | 21 | 2 + 2 secondary |
| **Total** | | **~115** | **17 endpoints / issues** |

The 17 confirmed endpoint-level issues consolidate to **14 distinct findings** —
the CRM comment-notifications cluster is 4 endpoints reported as one finding
(one feature, one fix). `server/routes.ts` itself was **clean** — every inline
handler delegates to a real query or service.

The low hit rate (≈115 examined → 14 findings) is the informative part: most
mock-token grep hits were legitimate constants. The fabricated-data problem is
**concentrated**, not pervasive — see §4.

---

## 2. Summary

**14 findings — 8 pre-beta blockers, 5 medium, 1 low.**

Two endpoints already cataloged before this audit are **not** re-counted here:
`GET /api/analytics/modeling/projects/:projectId/pro-forma-charts` (Item 7b,
hidden 2026-05-20 in commit `4e47c758`) and `POST /api/dd-checklist-templates/seed`
(BETA_MVP_SPEC.md §3.5).

| # | Finding | Severity |
|---|---|---|
| 1 | `interactive-analytics` — fabricated rent-roll analytics | PRE-BETA BLOCKER |
| 2 | `funds/:fundId/send-report` — no-op, claims reports sent | PRE-BETA BLOCKER |
| 3 | `rent-roll/analytics/revenue` — `Math.random()` revenue | PRE-BETA BLOCKER |
| 4 | `rent-roll/analytics/storage-types` — hardcoded marina types | PRE-BETA BLOCKER |
| 5 | `rent-roll/analytics/lease-terms` — hardcoded term buckets | PRE-BETA BLOCKER |
| 6 | `rent-roll/custom-types` CRUD — non-persistent | PRE-BETA BLOCKER |
| 7 | `CensusService.getMockDemographics()` — silent fallback to fake | PRE-BETA BLOCKER |
| 8 | `LeaseCashFlowEngine.generateSyntheticRentRoll()` — fake rent roll | PRE-BETA BLOCKER |
| 9 | `bookkeeping/chart-of-accounts/:id` PUT — no-op persist | MEDIUM |
| 10 | CRM comment-notifications cluster (4 endpoints) — feature dead | MEDIUM |
| 11 | `budgets/seed-actuals` — fabricated actuals, exposed in prod UI | MEDIUM |
| 12 | `assessAssetRisk()` — 4 of 6 risk dimensions hardcoded | MEDIUM |
| 13 | `dashboard-service.generateModulePreview()` — hardcoded trend | MEDIUM |
| 14 | `admin/benchmarks/rebuild` — no-op, fabricated status | LOW |

---

## 3. Findings

### PRE-BETA BLOCKERS

Friendly-facing **and** serve fabricated domain data. Each would mislead a beta
friendly into trusting numbers that are not their deal's.

---

#### Finding 1 — `GET /api/analytics/rent-roll/interactive-analytics`

- **Location:** `server/routes/analytics-routes.ts:1079`
- **What it fabricates:** Returns 100% hardcoded marina domain data — occupancy
  trend (283 slips, seasonal multipliers), storage-type distribution (Wet Slips
  156 / Dry Storage 85 / Moorings 24), lease expirations ($1.85M current
  revenue), revenue by storage type, and a `kpis` block (87.5% occupancy, $1.85M
  revenue). Uses `Math.random()` to jitter the numbers so they look live.
  Destructures `startDate` / `endDate` / `locationId` and only echoes them back —
  never queries by them. Zero data-layer calls; identical payload for every org.
- **Friendly-facing:** YES — `client/src/modules/rent-roll-v2/pages/interactive-analytics.tsx`
  (fetches it directly; routed at `/rent-roll/interactive-analytics`).
- **Severity:** PRE-BETA BLOCKER.
- **Fix scope:** Large (~1–2 days) — needs a real rent-roll analytics aggregation
  service (occupancy / revenue / expiration rollups from rent-roll + lease tables).

#### Finding 2 — `POST /api/funds/:fundId/send-report`

- **Location:** `server/routes/modeling-routes.ts:5557`
- **What it fails:** Handler body is a single `res.json({ sent: true, message:
  'Reports queued for delivery to all fund investors.' })`. Code comment:
  `// Placeholder - would send to all investors`. Zero data-layer calls, sends
  nothing, ignores `:fundId`. Returns a fabricated success confirmation for a
  delivery that never happens.
- **Friendly-facing:** YES — `client/src/pages/modeling/funds/InvestorReporting.tsx`
  (the "Send Report" action).
- **Severity:** PRE-BETA BLOCKER — a GP clicks "Send Report", gets a green
  confirmation, and LPs receive nothing.
- **Fix scope:** Medium (~3–6h) — wire to the real report-delivery path; the
  LP-statement / investor-letter delivery in `lp-portal-service.ts` is the
  existing pattern to lift.

#### Finding 3 — `GET /api/rent-roll/analytics/revenue`

- **Location:** `server/routes/rra-routes.ts:2319`
- **What it fabricates:** Returns 12 months of revenue with `scheduled` and
  `actual` values from `Math.floor(Math.random() * 50000) + 100000`. Destructures
  `orgId` and `year`, ignores both, no DB call. Every page load returns different
  random numbers.
- **Friendly-facing:** YES — `client/src/components/rent-roll/ExecutiveModals.tsx`.
- **Severity:** PRE-BETA BLOCKER.
- **Fix scope:** Medium — real revenue query against rent-roll charges/leases
  aggregated by month/year via `rraService`.

#### Finding 4 — `GET /api/rent-roll/analytics/storage-types`

- **Location:** `server/routes/rra-routes.ts:2337`
- **What it fabricates:** Returns a hardcoded array of 4 marina storage types
  with fixed `count` / `revenue` literals (Wet Slip 120 / $240k, Dry Storage
  80 / $96k, etc.). Destructures `orgId`, never uses it. Zero data-layer calls.
  Also re-introduces marina-hardcoded vocabulary on an asset-class-agnostic
  platform.
- **Friendly-facing:** YES — `client/src/components/rent-roll/ExecutiveModals.tsx`.
- **Severity:** PRE-BETA BLOCKER.
- **Fix scope:** Medium — aggregate unit counts and revenue by storage type from
  rent-roll units/leases.

#### Finding 5 — `GET /api/rent-roll/analytics/lease-terms`

- **Location:** `server/routes/rra-routes.ts:2352`
- **What it fabricates:** Returns a hardcoded array of 4 lease-term buckets with
  fixed `count` / `avgRent` literals (Monthly 45 / $850, Annual 120 / $750,
  etc.). Destructures `orgId`, never uses it. Zero data-layer calls.
- **Friendly-facing:** YES — `client/src/components/rent-roll/ExecutiveModals.tsx`.
- **Severity:** PRE-BETA BLOCKER.
- **Fix scope:** Medium — group leases by term type; count and average rent.

#### Finding 6 — `GET|POST|PATCH|DELETE /api/rent-roll/custom-types`

- **Location:** `server/routes/rra-routes.ts:2391` (GET) + the POST/PATCH/DELETE
  handlers through ~2448
- **What it fails:** The entire CRUD set is non-persistent. GET returns 15
  hardcoded default type records with fixed string IDs `'1'`–`'15'` (ignores
  `orgId`). POST echoes `req.body` back with a `Date.now()` id and never INSERTs.
  PATCH echoes `req.body` and never UPDATEs. DELETE returns 204 and never DELETEs.
  A user can "create" or "edit" custom types and they silently vanish on the
  next page load.
- **Friendly-facing:** YES — `client/src/components/rent-roll/CustomTypesManagement.tsx`.
- **Severity:** PRE-BETA BLOCKER — friendly-facing CRUD that silently discards
  every user write.
- **Fix scope:** Medium-Large — needs a real `rra_custom_types` table (or
  equivalent) plus four DB-backed handlers; the current default list can become
  the seed.

#### Finding 7 — `CensusService.getMockDemographics()`

- **Location:** `server/services/census-service.ts:1241` (definition); invoked
  at lines 38, 382, and **453**. Reached via `POST /api/demographics/location`
  and `POST /api/demographics/historical-trends`
  (`server/routes/modeling-routes.ts:8821`, `8867`).
- **What it fabricates:** When `CENSUS_API_KEY` is unset **— or whenever the live
  Census API throws (the line-453 catch block) —** it returns a complete fake
  demographic profile (population, median income, age/income/education/race
  distributions, employment, housing) from hardcoded literals plus
  `Math.random()` jitter. The response carries **no `dataSource: 'mock'` flag** —
  it is indistinguishable from real Census data.
- **Friendly-facing:** YES — `client/src/pages/analysis/demographics/Index.tsx`,
  `client/src/components/demographics/MarketTrendAnalysis.tsx`,
  `client/src/components/crm/PropertyRecordTabs.tsx`.
- **Severity:** PRE-BETA BLOCKER. The line-453 silent fallback on API error is
  the worst part: even with a key configured, a transient API failure quietly
  serves fabricated demographics into investment analysis.
- **Fix scope:** Small (~1–2h) — return an explicit `dataSource: 'unavailable'`
  / 503 when no key or on API failure, or stamp the payload with `isMockData: true`
  the UI surfaces. The line-453 catch must not silently substitute mock data.

#### Finding 8 — `LeaseCashFlowEngine.generateSyntheticRentRoll()`

- **Location:** `server/services/lease-cashflow-engine.ts:401` (definition);
  fallback invoked at line 398 inside `fetchRentRoll()`. Reached via
  `GET /api/modeling/projects/:projectId/lease-cashflow`, `.../rollover-schedule`,
  `.../tenant-performance`, and `POST .../lease-cashflow/calculate`
  (`server/routes/crm-routes.ts:17526`–`17614`).
- **What it fabricates:** When a modeling project has no rent-roll entries and
  no slip assignments, `fetchRentRoll()` falls back to a generated rent roll of
  153 fake units (50 wet slips, 100 dry racks, 3 commercial) with
  `Math.random()`-derived rents, lease terms, start dates, statuses, and tenant
  names like "Tenant 42". This synthetic data flows straight into the lease
  cash-flow projection, rollover schedule, and tenant-performance metrics — and
  into IRR/NPV inputs — with no indication the rent roll is synthetic. Also
  marina-hardcoded (`wet_slip` / `dry_rack`).
- **Friendly-facing:** YES — `client/src/pages/modeling/projects/workspace/lease-cashflow.tsx`,
  `client/src/pages/modeling/projects/workspace.tsx`.
- **Severity:** PRE-BETA BLOCKER.
- **Fix scope:** Small (~1–2h) — return an explicit "no rent roll configured"
  empty state instead of silently generating a fake one; or gate the synthetic
  path behind an explicit demo/sandbox flag.

---

### MEDIUM

Friendly-facing but degraded (no-op / empty) rather than fabricating displayed
financials, **or** fabricated but not clearly on a friendly demo path.

---

#### Finding 9 — `PUT /api/bookkeeping/chart-of-accounts/:id`

- **Location:** `server/routes/bookkeeping-gl-routes.ts:620`
- **What it fails:** Echoes `{ id, ...req.body, updatedAt }` back with **no
  database write** (comment: "For now return success with the updates applied").
  The chart-of-accounts edit silently never persists.
- **Friendly-facing:** YES — `client/src/pages/operations/bookkeeping/ChartOfAccounts.tsx`
  (calls PUT, then invalidates the query; the edit appears to succeed but
  vanishes on refetch).
- **Severity:** MEDIUM — a real persistence failure, but no fabricated displayed
  financials.
- **Fix scope:** Small (~30 min) — wire an `UPDATE`; the sibling POST handler
  (~line 580) has the correct pattern to mirror.

#### Finding 10 — CRM comment-notifications cluster (4 endpoints)

- **Location:** `server/routes/crm-intelligence-routes.ts:127` / `133` / `137` /
  `141` — mounted under `/api/comments`:
  - `GET /api/comments/notifications` — parses `limit`, ignores it, returns `[]`
  - `GET /api/comments/notifications/unread-count` — returns `{ unreadCount: 0 }`
  - `POST /api/comments/notifications/:id/read` — ignores `:id`, returns `{ success: true }`
  - `POST /api/comments/notifications/mark-all-read` — returns `{ success: true }`
- **What it fails:** All four return hardcoded empty/zero/success with zero
  data-layer calls — despite a populated `crm_notifications` table existing
  (created in `server/db-startup-migrations.ts:6196+`). The unread badge is
  permanently stuck at 0; mark-as-read persists nothing. The whole comment-
  notifications feature is non-functional while appearing to work.
- **Friendly-facing:** YES — `client/src/components/crm/panels/comment-threads-panel.tsx`
  consumes all four.
- **Severity:** MEDIUM — fabricates empty/zero, not fake records.
- **Fix scope:** Small (~1.5h for all four as a unit) — SELECT/COUNT/UPDATE
  against `crm_notifications` scoped by org/user.

#### Finding 11 — `POST /api/budgets/seed-actuals`

- **Location:** `server/routes/budget-routes.ts:500`
- **What it fabricates:** Generates 192 rows of fabricated marina financial
  actuals (16 hardcoded accounts — `wet_slip_revenue` base $45k, `fuel_sales`
  $35k, etc. × 12 months, with hardcoded seasonality + `Math.random()` noise)
  and INSERTs them into the real `actuals_facts` table with `source: 'SEED'`,
  `sourceRef: 'demo-seed'`. Downstream budget/variance views then read them as
  real actuals.
- **Friendly-facing:** YES — `client/src/pages/operations/BudgetingTabbed.tsx`
  calls it from a production Operations › Budgeting tab.
- **Severity:** MEDIUM / INTENTIONAL — it is explicitly a seed endpoint (route
  name, `sourceRef: 'demo-seed'`), so not a bug per se, **but it is wired to a
  button in a non-sandbox production UI tab** and injects fabricated financials
  into a real table. Flag for product review.
- **Fix scope:** Small (~30 min) — gate the UI button / endpoint behind a dev
  flag, or remove it from the production tab.

#### Finding 12 — `assessAssetRisk()` (predictive analytics)

- **Location:** `server/routes/predictive-analytics-routes.ts:555` — reached via
  `GET /asset-risk/:dealId` and the portfolio `GET /asset-risk`.
- **What it fabricates:** Two of six risk dimensions are computed from real DB
  signals (maintenance work orders, rent-payment failures); the other four —
  `occupancyRisk=25`, `leaseRolloverRisk=30`, `marketRisk=25`, `dscrRisk=20` —
  are hardcoded constants the author labels "placeholder scoring." Those
  constants flow into the persisted `compositeScore` and `alertLevel` served to
  the client.
- **Friendly-facing:** YES — `client/src/pages/analysis/predictive/index.tsx`.
- **Severity:** MEDIUM — partially fabricated (4 of 6 inputs constant), but the
  endpoint does real DB work and the placeholders are transparently flagged
  in-code.
- **Fix scope:** Medium — wire occupancy / lease-rollover / market / DSCR signals
  to real data sources.

#### Finding 13 — `dashboard-service.generateModulePreview()`

- **Location:** `server/services/dashboard-service.ts:1136` — reached via
  `POST /api/dashboards/custom-modules/preview` (`server/routes/external-routes.ts`).
- **What it fabricates:** Returns a real computed `kpiValue` alongside a
  hardcoded `trend: { value: 12.5, label: 'vs last period' }`. The trend arrow
  on a custom-dashboard module preview is always +12.5%.
- **Friendly-facing:** YES (custom-dashboard module builder), but it is a
  *preview* surface, not a primary metric display.
- **Severity:** MEDIUM.
- **Fix scope:** Small — compute the trend from the prior period, or drop the
  trend element from the preview.

---

### LOW

---

#### Finding 14 — `POST /api/admin/benchmarks/rebuild`

- **Location:** `server/routes/legal-benchmarking-routes.ts:181`
- **What it fails:** Logs "Benchmark rebuild triggered" and returns
  `{ message: 'Benchmark rebuild triggered', status: 'pending' }`. No job is
  queued, no service called, no aggregation kicked off — `status: 'pending'` is
  fabricated.
- **Friendly-facing:** NO — no caller in `client/src/`; admin/owner-gated.
- **Severity:** LOW — internal admin endpoint, not in any user-facing flow.
- **Fix scope:** Medium (~4–8h) to build the real aggregation behind it, or
  ~5 min to mark the endpoint explicitly unimplemented (501).

---

## 4. Pattern observations

The fabricated-data problem is **concentrated**, not pervasive:

- **Rent-roll analytics is systematically mocked.** Findings 1, 3, 4, 5, 6 —
  five of the eight blockers — are all rent-roll analytics / custom-types
  endpoints split across `analytics-routes.ts` and `rra-routes.ts`. The
  rent-roll-v2 module shipped its UI ahead of its data layer.
- **Silent fallback-to-mock is the most dangerous category.** Findings 7
  (Census) and 8 (LeaseCashFlow) are not "no data layer" — they *have* a real
  data path and silently substitute fabricated data when it is empty or errors.
  These serve fake numbers **in production, even when correctly configured**,
  on a transient upstream failure. They cannot be found by looking at a demo;
  they only fire on the failure path.
- **`server/routes.ts` (the 3,787-line core) is clean.** No findings. The newer
  feature-area route files are where the mocks accumulated.
- **Marina-hardcoding rides along.** Findings 1, 4, 8 re-introduce marina
  vocabulary (Wet Slips, dry racks) on a platform that is meant to be
  asset-class agnostic — the mock data was written marina-first.

---

## 5. Remediation plan

*(Added in commit 3 — see below.)*
