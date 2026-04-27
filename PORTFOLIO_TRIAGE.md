# Portfolio Triage

**Generated:** 2026-04-27
**Inventory source:** `PORTFOLIO_INVENTORY.md` §10 (14 findings)
**Read-only.** No source files were modified.

---

## Summary table

Sorted by Severity then Effort (Critical XS first → Low XL last).

| # | Title | Severity | User impact | Effort | Disposition | Dep |
|---|---|---|---|---|---|---|
| 7 | Status enum mismatch — form offers 3 invalid values | **Critical** | Selecting Pending Acquisition / Disposed / Under Contract returns 500 on save | XS | **Fix-now** | — |
| 8 | Hold strategy enum mismatch — form offers `development` | **Critical** | Selecting Development returns 500 on save | XS | **Fix-now** | — |
| 12 | Sidebar link to `/operations/portfolio` has no route | **High** | Sidebar entry is a dead link for any org with `OPS_PORTFOLIO` enabled | XS | **Fix-now** | — |
| 1 | Triple registration of `GET /api/portfolio/summary` | **High** | Owned-Assets summary handler is unreachable; one consumer reads `undefined` and silently falls back | S | **Fix-now** | — |
| 9 | Legacy `GET /api/operations/owned-marinas` redirect | **Low** | None — works as 301 redirect | XS | **Backlog** | unblocked by #11 (rename) |
| 11 | `<Input type=number>` posts string; server `parseInt` may NaN | Low | Stray non-numeric input silently stores `null` for `acquisitionPrice` | XS | **Backlog** | — |
| 13 | `portfolio-summary-routes.ts` mounts only `/summary` at `/api/portfolio` | Low | Misleading file/mount naming; no functional effect | XS | **Backlog** | folded into #1 fix |
| 3 | No breadcrumb entry for `/portfolio` or `/portfolio/:id` | Low | Detail page has no breadcrumb trail; minor navigation gap | S | **Next-session** | — |
| 4 | `MarinaDetail` never reads `assetPerformanceSnapshots` | Medium | Performance/history is invisible to GP users despite snapshots being written by Budgeting | M | **Next-session** | feature gap, not a regression |
| 2 | `/api/portfolio/asset-class-breakdown` reads modeling_projects, not owned_assets | Medium | Dashboard tile labeled "portfolio" shows modeling-pipeline counts, not owned-asset counts | M | **Next-session** | renaming touches dashboard tile |
| 14 | Financials/Performance tabs are inline `<Card>` grids in Portfolio.tsx | Low | None today; refactor blocker for #4 | M | **Next-session** | blocks #4 |
| 6 | `keyMetrics` jsonb denormalization with three-way fallback | High | Same field shows different numbers depending on which page reads it | L | **Next-session** | depends on #4 to define source of truth |
| 5 | `acquisition_price` is `integer` (whole dollars only) | Medium | Cents silently dropped on save; affects PSA reconciliation | L | **Backlog** | requires raw-SQL migration |
| 10 | Zero tests for in-scope Portfolio code | High | No regression guard; recent Content-Type 400 had no contract test | XL | **Next-session** | unblocks every other fix |

---

## Severity rubric

- **Critical** — Live production bug causing wrong data, failed writes, or user-facing errors RIGHT NOW under normal usage.
- **High** — Latent bug that will surface with normal usage, OR significant architectural debt blocking near-term work.
- **Medium** — Real issue but a workaround exists, or affects a low-traffic path.
- **Low** — Cleanup, polish, or theoretical issues with no current user impact.

---

## Open verification needed

I re-read source for every finding before triaging. Discrepancies and refinements vs. inventory:

- **#1 — Inventory said "first match wins" but did not name the winner.** The actual mount order in `server/routes.ts` is: `portfolio-summary-routes.ts` mounted at line **673** (boot), `registerCRMRoutes` called at line **2414**, `registerModelingRoutes` at line **2418**. Therefore `portfolio-summary-routes.ts:17` wins for `/api/portfolio/summary` — its response shape is `{ dealCount, activeCount, closedCount, totalAum, aggregateNoi, avgCapRate, totalEquity, totalDebt, avgLtv, avgDscr, avgLeveredIrr, byAssetClass, noiTrend, generatedAt }` (camelCase, modeling-project rollup). The crm-routes.ts:11905 handler that calls `ownedAssetsService.getPortfolioSummary` (returning `{ totalAssets, byStatus, byHoldStrategy, totalAcquisitionValue }`) is **fully unreachable**. The modeling-routes.ts:1638 handler is also unreachable. `OperationsHome.tsx:251` reads `portfolioSummary?.totalAssets ?? assets.length` — `totalAssets` is undefined under the winning handler, so it silently falls back to `assets.length`. The Owned-Assets summary is dead code.
- **#4 — Inventory said "no frontend consumer calls them" for snapshots.** Verified READ-side: zero. But there is a WRITE-side touch via `client/src/components/budgeting/PushToOperationsButton.tsx:80,198` ("budget targets written to asset performance snapshots"). Writes happen, reads don't. The data accumulates and no one looks at it.
- **#7/#8 — Confirmed exactly as inventory stated.** Form offers `pending_acquisition | disposed | under_contract` (3 values not in the `asset_status` enum, plus `under_management` which is valid); hold strategy form adds `development` (not in `hold_strategy` enum). The route handler (crm-routes.ts:11799–11800) passes the value through unchanged, so any of the 4 invalid choices will fail the Postgres enum cast → the error path catches it and returns 500 `"Failed to add marina to portfolio"`. **The user gets a generic 500, not a validation message, and has no way to know which option is broken.**
- **#12 — Confirmed.** No `<Route path="/operations/portfolio">` exists in `client/src/Router.tsx`. The closest matches are `/operations` (line 1336 → `OperationsHome`) and `/operations/owned-marinas` (line 1345 → `Redirect to="/portfolio"`). The sidebar link at `sidebarConfig.ts:492` is dead. (Behavior under wouter is to fall through to whatever the catch-all renders — likely a blank or 404 layout.)
- **#3 — Confirmed.** Breadcrumb map covers `/modeling/portfolio`, `/operations/rent-roll/portfolio`, `/rent-roll/portfolio` — but no entry for `/portfolio` or `/portfolio/:id`. Inventory called this correctly.

---

## Per-finding detail

### #7 — Status enum mismatch: form offers 3 invalid values

- **What's wrong:** `MarinaModal.tsx:264-268` offers Status options `under_management | pending_acquisition | disposed | under_contract`. The Postgres `asset_status` enum (`shared/schema.ts:196`) only accepts `under_management | optimization | exit`. Any of the three invalid choices triggers a Postgres enum cast failure on insert/update.
- **Evidence:** `shared/schema.ts:196`, `client/src/components/portfolio/MarinaModal.tsx:264-268`, route handler `server/routes/crm-routes.ts:11799` passes `status` through unchanged with default `'under_management'`. Status display map in `Portfolio.tsx:88-101` is also out of sync (lists `stabilizing | value_add | disposition | other`).
- **User impact:** A user creating an asset with anything other than the default status gets a generic 500 `"Failed to add marina to portfolio"`. Same for edits via PATCH. Three of four user choices are broken.
- **Why this severity:** **Critical.** This is a production bug under normal usage — the form *invites* the user to pick one of these values. The default avoids it, which is why it has been latent.
- **Proposed fix:** Two options.
  (A) **Align form to enum** — change the four `<SelectItem>`s in `MarinaModal.tsx:264-268` to `under_management | optimization | exit` and update `statusLabel`/`statusVariant` in `Portfolio.tsx:88-101` to match the same three values. Same for hold strategy (#8). Lowest risk; matches reality.
  (B) **Extend the enum** — add `pending_acquisition | disposed | under_contract` to `assetStatusEnum` via raw psql migration (`ALTER TYPE asset_status ADD VALUE ...`). Higher risk; requires migration; some of these values overlap conceptually with CRM deal stages and may belong there instead.
  **Recommend (A).** The form values look like they were copied from CRM-deal stages by mistake. The DB enum reflects deliberate product design (3 lifecycle phases for an owned asset). Don't add fields to the schema to paper over a UI mistake.
- **Risks of fixing:** If any existing rows in production have non-enum values stored (would only be possible if the column was previously TEXT), the display map change might leave them showing raw `under_management` style. Quick check: `SELECT DISTINCT status FROM owned_assets;` confirms no orphans before changing the display map.
- **Effort breakdown:** XS. Three lines in MarinaModal, three lines in Portfolio.tsx statusLabel/statusVariant. Manual smoke = open modal, pick each new option, save, verify in DB.
- **Dependencies:** None. Should be fixed alongside #8 (same file, same edit pattern).

### #8 — Hold strategy enum mismatch: form offers `development`

- **What's wrong:** `MarinaModal.tsx:285-289` offers `core | value_add | opportunistic | development`. The `hold_strategy` enum (`shared/schema.ts:197`) only includes the first three.
- **Evidence:** `shared/schema.ts:197`; `client/src/components/portfolio/MarinaModal.tsx:285-289`. PATCH/POST both pass through (`server/routes/crm-routes.ts:11800,11825`).
- **User impact:** User picks Development → 500 on save with the same generic error message as #7.
- **Why this severity:** **Critical.** Same class of bug as #7, smaller blast radius (only 1 of 4 options broken instead of 3 of 4).
- **Proposed fix:** Remove the `development` `<SelectItem>`. If the product team genuinely wants Development as a hold strategy (it's plausible for ground-up work), extend the enum via raw psql — but punt that to product confirmation; do the cosmetic removal now.
- **Risks of fixing:** Users who had previously *seen* but not selected Development will lose the option. Zero data risk because the value cannot have been stored.
- **Effort breakdown:** XS. One line.
- **Dependencies:** Bundle with #7.

### #12 — Sidebar link to `/operations/portfolio` has no route

- **What's wrong:** `client/src/config/sidebarConfig.ts:492` defines a sidebar entry pointing to `/operations/portfolio`, gated on `FEATURE_MODULES.OPS_PORTFOLIO`. No `<Route path="/operations/portfolio">` exists in `Router.tsx`.
- **Evidence:** `client/src/Router.tsx` — verified no matching route via `grep -n "<Route path=\"/operations" Router.tsx`. Closest are `/operations` (1336), `/operations/owned-marinas` (1345 → redirect to `/portfolio`).
- **User impact:** For any org with the OPS_PORTFOLIO feature module enabled, clicking the Operations → Portfolio sidebar link goes to a no-match URL. Wouter typically renders nothing or the catch-all not-found state.
- **Why this severity:** **High** — gated behind a feature flag, but it's a visible, broken link for affected orgs.
- **Proposed fix:** Two options.
  (A) **Redirect** — add `<Route path="/operations/portfolio">{() => <Redirect to="/portfolio" />}</Route>` to `Router.tsx`. Mirrors the existing `/operations/owned-marinas` redirect at line 1345.
  (B) **Change sidebar `href` to `/portfolio`.** Simpler, no router change needed.
  **Recommend (B)** — `/portfolio` is the canonical URL; the sidebar should point there directly. The `matchRoutes: ['/operations/portfolio', '/portfolio']` already lists `/portfolio` as a match, so the active-state highlight will still work.
- **Risks of fixing:** None. The sidebar entry already considers `/portfolio` an active match.
- **Effort breakdown:** XS. One-line change in `sidebarConfig.ts:492`.
- **Dependencies:** None.

### #1 — Triple registration of `GET /api/portfolio/summary`

- **What's wrong:** Three handlers register the same path, returning three different shapes:
  1. `portfolio-summary-routes.ts:17` (mounted at `routes.ts:673` — **wins**) — modeling-project rollup, returns `{ dealCount, totalAum, aggregateNoi, avgCapRate, totalEquity, totalDebt, avgLtv, avgDscr, avgLeveredIrr, byAssetClass, noiTrend, generatedAt }`.
  2. `crm-routes.ts:11905` (registered later) — owned-assets rollup via `ownedAssetsService.getPortfolioSummary()`, returns `{ totalAssets, byStatus, byHoldStrategy, totalAcquisitionValue }`. **Unreachable.**
  3. `modeling-routes.ts:1638` (registered last) — `portfolioRollupService.getPortfolioSummary()`. **Unreachable.**
- **Evidence:** `server/routes.ts:673,2414,2418` for the registration order. Three handler files cited above. Consumer-shape mismatches at `OperationsHome.tsx:251` (reads `totalAssets`, undefined under winner → silent fallback to `assets.length`), `modeling/portfolio/dashboard.tsx:143` (reads `totalEquity`, works), `modeling/portfolio/index.tsx:782` (uses raw shape).
- **User impact:** Operations home tile shows the right count by accident (fallback). All Owned-Asset summary metrics that *should* surface (status breakdown, hold-strategy breakdown, total acquisition value) are dead — no one can see them.
- **Why this severity:** **High.** The unreachable owned-assets summary is a feature gap masquerading as code that exists. Re-using the path also makes future routing intent ambiguous.
- **Proposed fix:** Three steps.
  1. Delete the dead handlers in `crm-routes.ts:11905-11914` and `modeling-routes.ts:1638-1649` (or keep one and rename it).
  2. Move the owned-assets summary to a new path: `GET /api/portfolio/owned-assets-summary` (handler stays as `ownedAssetsService.getPortfolioSummary`).
  3. Update `OperationsHome.tsx` to query the new path and drop the `?? assets.length` fallback. Leave `modeling/portfolio/dashboard.tsx` as-is (it reads from the modeling-rollup handler, which is the winner today).
  This consolidates `/api/portfolio/summary` to mean exactly one thing (the modeling rollup) and gives the owned-assets summary its own URL.
- **Risks of fixing:** OperationsHome currently *appears* to work because of the silent fallback. After the fix, if the new endpoint is broken, the tile will show 0 (no fallback). Worth keeping a soft fallback during the transition or adding a smoke test against the new endpoint.
- **Effort breakdown:** S. Three small edits (delete two handlers, add one route, update one consumer). Manual verification: load `/operations`, `/modeling/portfolio/dashboard`, and `/portfolio` and confirm each KPI matches DB reality.
- **Dependencies:** None — but folds in #13 cleanly (the `portfolio-summary-routes.ts` mount becomes the canonical owner of the path).

### #9 — Legacy `GET /api/operations/owned-marinas` redirect

- **What's wrong:** `crm-routes.ts:11945` is a 301 redirect to `/api/portfolio/marinas`. Works fine, but it's clutter.
- **Evidence:** Reading the handler — single line redirect.
- **User impact:** None.
- **Why this severity:** **Low.** Not a bug.
- **Proposed fix:** Delete after confirming no consumers via `git grep "/api/operations/owned-marinas"` across both client and server. If any external consumer (browser bookmark, scraper) still hits it, leave it.
- **Risks of fixing:** External callers we don't know about. Leave indefinitely if there's any doubt.
- **Effort breakdown:** XS. Two-line removal once verified.
- **Dependencies:** None.

### #11 — `<Input type=number>` posts string; server `parseInt` can NaN

- **What's wrong:** `MarinaModal.tsx` uses `<Input type="number">` for `acquisitionPrice` which still posts a string. Server (`crm-routes.ts:11798`) does `parseInt(acquisitionPrice)` — non-numeric input becomes `NaN` and Postgres stores `null` (Drizzle integer cast).
- **Evidence:** `MarinaModal.tsx:243-249`; `server/routes/crm-routes.ts:11798,11823`.
- **User impact:** Practically zero — `<input type=number>` blocks most non-numeric input client-side. A determined paste of "abc" would silently null-out the price.
- **Why this severity:** **Low.**
- **Proposed fix:** Server-side guard: `const price = acquisitionPrice ? parseInt(acquisitionPrice, 10) : null; if (acquisitionPrice && Number.isNaN(price)) return res.status(400).json({ error: 'acquisitionPrice must be numeric' });`.
- **Risks of fixing:** None.
- **Effort breakdown:** XS. Two lines, two endpoints (POST + PATCH).
- **Dependencies:** None.

### #13 — `portfolio-summary-routes.ts` exports a router with one handler mounted at `/api/portfolio`

- **What's wrong:** The mount `app.use("/api/portfolio", ..., portfolioSummaryRoutes)` implies a portfolio subsystem owns this prefix, but the router only contains `/summary`. Every other `/api/portfolio/*` route is registered globally on `app` from `crm-routes.ts`. Misleading naming.
- **Evidence:** `server/routes.ts:673`; `server/routes/portfolio-summary-routes.ts` (167 LOC, single handler).
- **User impact:** None.
- **Why this severity:** **Low.** Architectural hygiene only.
- **Proposed fix:** Subsumed by #1's recommendation — make `portfolio-summary-routes.ts` the canonical owner of `/summary` (already wins) and consider extracting the other portfolio routes from `crm-routes.ts:11432-11947` into the same router. Pure refactor, no behavior change. Defer the extract until #1 is shipped.
- **Risks of fixing:** Refactoring 500 LOC across files risks introducing subtle handler-order regressions. Test coverage required first (#10).
- **Effort breakdown:** XS as cleanup folded into #1; M as a standalone extract.
- **Dependencies:** Folded into #1.

### #3 — No breadcrumb entry for `/portfolio` or `/portfolio/:id`

- **What's wrong:** `client/src/components/Breadcrumb.tsx` lines 140, 480, 503 cover `/modeling/portfolio`, `/operations/rent-roll/portfolio`, `/rent-roll/portfolio`. There is no entry for `/portfolio` or `/portfolio/:id`.
- **Evidence:** Verified via `grep -n "portfolio" Breadcrumb.tsx`.
- **User impact:** When the user navigates to the Portfolio page or an asset detail, the breadcrumb shows nothing or the default. Minor UX gap.
- **Why this severity:** **Low.**
- **Proposed fix:** Add two entries to the breadcrumb map:
  - `/portfolio` → `[{ label: 'Portfolio' }]`
  - `/portfolio/:id` (or whatever pattern syntax the file uses) → `[{ label: 'Portfolio', href: '/portfolio' }, { label: marina.name }]` — the second crumb needs the asset name, which means either passing it via context or accepting `Asset Detail` as a placeholder.
- **Risks of fixing:** If the breadcrumb component reads dynamic labels from query data, the implementation needs the marina name to be available at render time. Otherwise use a static placeholder.
- **Effort breakdown:** S. Two entries plus testing both pages render the crumb correctly.
- **Dependencies:** None.

### #4 — `MarinaDetail` never reads `assetPerformanceSnapshots`

- **What's wrong:** Server-side methods `OwnedAssetsService.getAssetPerformanceSnapshots` (`owned-assets-service.ts:160`) and `getAssetPerformance` (line 272) exist and are exercised by writes (Budgeting "Push to Operations" — see `PushToOperationsButton.tsx:80`). No frontend page reads them. The MarinaDetail tabs are Overview / Sales Comps / Rate Comps — no Performance/History tab.
- **Evidence:** `client/src/pages/portfolio/MarinaDetail.tsx:118-131` (only three queries: marina, sales comps, rate comps). `OwnedAssetsService` methods exist but no API route exposes them: a search for `getAssetPerformanceSnapshots\|getAssetPerformance` in `server/routes/` returns zero hits.
- **User impact:** GP users cannot see historical KPI trends for an owned asset. Budget targets are being written to a table that nobody reads. Major value-loss for the LP-reporting story.
- **Why this severity:** **Medium.** Feature gap, not a regression. Workaround = read snapshots directly via DB. But it's the highest-value addition the Portfolio surface needs.
- **Proposed fix:**
  1. Expose two API routes: `GET /api/portfolio/marinas/:id/snapshots` (returns array) and `GET /api/portfolio/marinas/:id/performance` (returns `getAssetPerformance` payload). Both wrap existing service methods.
  2. Add a "Performance" tab to `MarinaDetail.tsx` rendering snapshot trends (line chart for occupancy/revenue/EBITDA over time) and the latest performance metrics.
  3. Optionally also surface in the Portfolio.tsx Performance tab (currently inline `<Card>` grids per #14) by aggregating across assets.
- **Risks of fixing:** Snapshots may be empty or sparse for assets that have not been pushed-to-ops by Budgeting. UI must handle "no data" gracefully. Backfill is not in scope.
- **Effort breakdown:** M. Two routes (~30 min), one new tab + chart component (~2-3 hrs incl. manual testing).
- **Dependencies:** Fixing #14 first (extracting Performance tab into a component) makes this cleaner, but is not blocking.

### #2 — `/api/portfolio/asset-class-breakdown` reads modeling_projects, not owned_assets

- **What's wrong:** Endpoint at `crm-routes.ts:11917-11941` is registered in the portfolio block but reads exclusively from `modelingProjects`. Frontend caller `dashboard.tsx:738-740` shows it as "portfolio breakdown."
- **Evidence:** `crm-routes.ts:11920-11927` (selects from `modelingProjects`). `dashboard.tsx:738-740` and 1428-1432 (rendered as `portfolio-breakdown` tile linking to `/portfolio`).
- **User impact:** The dashboard tile labelled as portfolio breakdown is actually showing modeling-pipeline counts. Click-through goes to `/portfolio` (owned-asset list), which doesn't match what the tile showed.
- **Why this severity:** **Medium.** Misleading tile, no broken behavior.
- **Proposed fix:** Two options.
  (A) **Add an owned-assets equivalent endpoint** at `/api/portfolio/owned-assets-by-class` that GROUP-BYs `crm_properties.assetClass` over `owned_assets`. Update `dashboard.tsx` tile to use it. Leave the existing endpoint for whatever it actually feeds.
  (B) **Rename the existing endpoint** to `/api/modeling/asset-class-breakdown` and move it to modeling-routes.ts. Update dashboard tile to label it "Pipeline by Asset Class" so the click-through to `/portfolio` is changed to `/crm/deals` or similar.
  **Recommend (A)** — the dashboard intent (per the `link: '/portfolio'` at dashboard.tsx:1431) clearly was to show owned-asset breakdown; the implementation just read the wrong table.
- **Risks of fixing:** Adding the new endpoint requires joining `owned_assets` with `crm_properties.assetClass` — verify the property table has an `assetClass` column before designing the query.
- **Effort breakdown:** M. New route + handler (~1 hr), dashboard wiring (~30 min), manual verification (~30 min).
- **Dependencies:** None.

### #14 — Financials/Performance tabs are inline `<Card>` grids in Portfolio.tsx

- **What's wrong:** `Portfolio.tsx:569-704` defines two tabs as inline `<Card>` grids that re-derive metrics from the same `marinas` array. No extracted component.
- **Evidence:** `Portfolio.tsx:569-704` — verified.
- **User impact:** None today.
- **Why this severity:** **Low** as standalone. **Becomes a blocker when #4 lands** — Performance tab needs to consume snapshots, which doesn't fit cleanly inline.
- **Proposed fix:** Extract `<PortfolioFinancialsTab marinas={...} />` and `<PortfolioPerformanceTab marinas={...} />` into `client/src/components/portfolio/` as siblings of `MarinaModal`. Pure refactor — no logic change. Then layer #4's snapshot-aware version onto Performance.
- **Risks of fixing:** A pure refactor with zero tests is hazardous. Manual smoke: open `/portfolio`, click each tab, verify identical visuals to before.
- **Effort breakdown:** M. Two component extractions, careful prop passing, manual verify each tab.
- **Dependencies:** Should land before or alongside #4.

### #6 — `keyMetrics` jsonb denormalization with three-way fallback

- **What's wrong:** `currentValue / annualRevenue / annualEbitda / occupancy / slips` are stored in `owned_assets.key_metrics` jsonb. The same fields are computed in `GET /api/portfolio/marinas` (crm-routes.ts:11684-11690) with a fallback chain `snapshot → stored → live (rentRoll)` (and for slips, also `propertySpecs`). Different pages can show different numbers for the same field.
- **Evidence:** Schema `shared/schema.ts:2752` (key_metrics jsonb), aggregation logic `server/routes/crm-routes.ts:11684-11690`, modal write logic `MarinaModal.tsx:129-145` (writes user-typed values into key_metrics).
- **User impact:** A user editing acquisition price or current value in the modal sees their value persist, but on the list view it may be overridden by the snapshot or rent-roll fallback. "I just typed in $5M — why does it show $4.7M?"
- **Why this severity:** **High.** Trust-eroding inconsistency. A user who sees this once stops trusting Portfolio numbers entirely.
- **Proposed fix:** Pick one source of truth per field and document it.
  - Recommendation: **snapshot is authoritative for time-series fields** (`currentValue`, `annualRevenue`, `annualEbitda`, `occupancy`); **rent-roll is authoritative for `slips` if a rent roll exists**, otherwise `propertySpecs.slips`. The `key_metrics` jsonb becomes a *user-override layer* — if the user explicitly sets a value via the modal, it wins until the next snapshot.
  - Encode this in the aggregation logic at `crm-routes.ts:11684-11690` (use `??` precedence carefully, currently `||` collapses 0). Make MarinaDetail use the same logic so both pages return identical numbers.
- **Risks of fixing:** Changing the fallback ordering will change what users see today. Some assets may currently show snapshot values that the user disagrees with — they'll need a way to override (the modal does this, but the override needs to be respected, not overwritten by the next sync).
- **Effort breakdown:** L. Requires alignment on canonical source of truth (likely needs product input), then refactoring the aggregation, then auditing every consumer (Portfolio list, MarinaDetail, dashboard tile).
- **Dependencies:** Best done after #4 ships (so the Performance tab makes the snapshot/override distinction visible to users).

### #5 — `acquisition_price` is `integer` (whole dollars only)

- **What's wrong:** Schema `owned_assets.acquisition_price` is `integer`. `parseInt(acquisitionPrice)` server-side (crm-routes.ts:11798, 11823) drops cents.
- **Evidence:** Schema `shared/schema.ts:2748`; server casts at the cited lines.
- **User impact:** Cents are silently truncated on save. For institutional CRE, this means PSA reconciliation against closing statements is off by up to $0.99 per asset — small but annoying for audit.
- **Why this severity:** **Medium.** Data fidelity issue with no current user complaint.
- **Proposed fix:** Migrate column to `decimal(18,2)` via raw psql (per the project's RLS-safe migration pattern in CLAUDE.md). Update server casts to use `parseFloat` or pass through as-is.
- **Risks of fixing:** Schema migration on a table with FKs from `asset_performance_snapshots`, `marina_budgets`, `asset_budgets`, `rent_roll_snapshots`. Should not require touching dependent tables since the column is a value, not a key. Still — must test raw SQL migration carefully and roll out during low-traffic window.
- **Effort breakdown:** L. Migration script (~30 min), validation script (~30 min), update casts in 4 places, manual smoke (~1 hr).
- **Dependencies:** None.

### #10 — Zero tests for in-scope Portfolio code

- **What's wrong:** No test files cover `Portfolio.tsx`, `MarinaDetail.tsx`, `MarinaModal.tsx`, or `owned-assets-service.ts`. Recent Content-Type 400 regression had no contract test to catch it.
- **Evidence:** `find` for `*.test.ts*` matching `marina|owned.assets|MarinaModal|MarinaDetail|portfolio` returned zero results in the in-scope surface.
- **User impact:** Every fix from #1–#9, #11–#14 has no automated regression guard. Changes ship on manual smoke only.
- **Why this severity:** **High.** Multiplier on every other fix's risk.
- **Proposed fix:** Add a minimal test layer:
  1. **Contract tests** for the 6 owned-asset routes (vitest + supertest). At minimum: GET /marinas, POST /marinas (happy path + missing propertyId), DELETE /marinas/:id. ~150 LOC.
  2. **Smoke test** for the MarinaModal Add-to-Portfolio flow (vitest + react-testing-library). Verifies form submission posts the expected payload with `Content-Type: application/json`.
  3. Extend the project's existing test setup (need to check what test infra exists for routes).
- **Risks of fixing:** Tests against a real DB require a test fixture / seed data. Tests against a mocked DB diverge from production behavior (CLAUDE.md explicitly warns against this for RLS-affected tables — `owned_assets` has FKs to RLS tables). Either approach has tradeoffs.
- **Effort breakdown:** XL. Multi-session work. Contract tests can land first (S each, ~3 routes per session). Frontend tests need component-test infra — may not exist yet.
- **Dependencies:** Unblocks confident execution of every other fix.

---

## Recommended sequence

Execute Fix-now items in this order, then move to Next-session.

### Fix-now (single session, ~2 hours total)

1. **#7 + #8 (XS)** — Bundle into one edit on `MarinaModal.tsx` and `Portfolio.tsx`. Highest-severity, tiniest surface area. Removes the source of generic 500s. Lowest risk. Do first.
2. **#12 (XS)** — One-line sidebar `href` change. Eliminates a dead link. Independent of everything else.
3. **#1 (S)** — Resolve the triple registration. Higher risk than the XS items because it touches three files and one consumer, but high value because it deletes ~20 lines of unreachable code and clarifies intent. Do last in the Fix-now batch so #7/#8/#12 are already verified.

After this batch, manually verify:
- Open Add-to-Portfolio modal, exercise every Status and Hold Strategy option, confirm save succeeds.
- Click Operations → Portfolio sidebar link, confirm it lands on `/portfolio`.
- Load `/operations`, `/portfolio`, `/modeling/portfolio/dashboard` — confirm KPIs match DB reality.

### Next-session (multi-session, prioritized)

4. **#10 (XL)** — Stand up minimum test infra. Contract tests for the 6 owned-asset routes. This is the multiplier for everything below. **Without #10, every subsequent fix carries proportional regression risk.**
5. **#14 (M)** — Extract Financials/Performance tabs. Pure refactor, low value alone, but unblocks #4 cleanly.
6. **#4 (M)** — Add `/snapshots` and `/performance` API routes plus a Performance tab on MarinaDetail. Highest user-visible value-add of any item in the list.
7. **#2 (M)** — Owned-assets-by-class endpoint, fix the dashboard tile. Independent of #4 but conceptually similar (correct data sources).
8. **#6 (L)** — Source-of-truth for `key_metrics`. Needs product-team alignment before code changes.
9. **#3 (S)** — Breadcrumb entries. Polish, low priority once everything else stable.

### Backlog (not scheduled)

- **#5 (L)** — `acquisition_price` cents. Defer until a user complains or until an audit-cycle forces the issue.
- **#9 (XS)** — Legacy redirect cleanup. Defer indefinitely or fold into a future Marina-language sweep.
- **#11 (XS)** — `parseInt`/NaN guard. Defer; harm is theoretical.
- **#13 (XS)** — Folded into #1 cleanup.

---

## Items I'd defer indefinitely

None of the 14 are pure "won't-fix" — every item has a real (if small) cost. But three are weakest candidates for ever scheduling:

- **#9 (Legacy `/api/operations/owned-marinas` redirect)** — works correctly. The only reason to remove it is aesthetics. Would become worth it if (a) a Marina-language rename touches it anyway, or (b) a router consolidation surfaces it as dead. Until then, no action.
- **#11 (`parseInt`/NaN guard)** — `<input type="number">` already blocks non-numeric input client-side. The guard is defensive against a scenario that has not occurred. Worth fixing only when test infra exists (#10) so the new validation can be covered cheaply.
- **#13 (mount-naming hygiene)** — purely architectural. No user impact, no developer impact unless someone tries to add new routes to `portfolio-summary-routes.ts` and is surprised. Would become worth fixing if a deeper portfolio router refactor is scoped — folds into that work for free.
