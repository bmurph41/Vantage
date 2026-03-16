# MarinaMatch Development Journal
*Last updated: Session 3 — Multi-Year tab, entity grouping, overview fix*

---

## App Identity
**Replit workspace:** `~/workspace`
**Stack:** React 18 + TypeScript, Vite, TanStack Query, Express/Node, PostgreSQL (Neon), Drizzle ORM (raw `pool.query()` fallback for RLS tables), Radix UI, Tailwind, Recharts, SheetJS, pdfjs-dist, Anthropic SDK, AWS S3
**Port:** 5000 (Express serves both API + Vite SPA)

---

## Critical Gotchas

1. **RLS tables** (`modelingProjectConfig`, `modelingScenarioVersions`) — always use raw `pool.query()`, never Drizzle ORM.
2. **Raw SQL returns snake_case** — always map explicitly to camelCase.
3. **Server must be manually restarted** after any `routes.ts` changes.
4. **File editing pattern** — use `cat > /tmp/script.mjs << 'EOF'` heredoc + `node /tmp/script.mjs`. All scripts run in Replit shell only.
5. **Pro-forma API response shape** — returns `{ scenarios: [{ metrics: { totalRevenue, totalExpenses, noi, capRate, irr, ... }, revenueBreakdown: [] }] }`. NOT flat. NOT `revenue.total`.
6. **Deal-pricing/inputs endpoint** — returns full project row: `{ dealPricingResults: { irr, equityMultiple, ... }, dealPricingInputs: { ... } }`.
7. **entity_name on extracted items** — Oakdale has 4 entities × 58 rows each: TOTALS, CROWLEY MARINE, OAKDALE SERVICE, J.M.T.M. ASSOCIATES.

---

## Architecture Map

### Key Server Files
- `~/workspace/server/routes.ts` — monolithic ~26k line route file
- `~/workspace/server/services/doc-intel-service.ts` — extraction, entity grouping, seasonal import
- `~/workspace/server/services/doc-intel-learning.ts` — recordConfirm(), applyLearningRules()
- `~/workspace/server/utils/department-mapping.ts` — inferDepartment(), normalizeDepartment(), deptKeyToLabel(), correctCategoryForDepartment()

### Key Client Files
- `~/workspace/client/src/pages/modeling/projects/workspace.tsx` — workspace shell, all tab routing, KPI queries
- `~/workspace/client/src/pages/modeling/projects/workspace/` — FM tab components
- `~/workspace/client/src/components/doc-intel/PLReviewGrid.tsx` — review grid (~2000 lines)
- `~/workspace/client/src/components/workspace/MultiYearProjectionTab.tsx` — multi-year tab

---

## Financial Model Tab Status

| Tab | File | Status | Notes |
|-----|------|--------|-------|
| Overview | `overview-dynamic.tsx` | ✅ Fixed | reads scenarios[0].metrics.* |
| Summary | `executive-summary-dynamic.tsx` | ✅ Fixed | same wiring |
| Historical P&L | `historical-pl.tsx` | ✅ Upgraded | 5-metric KPI strip |
| Pro Forma | `pro-forma.tsx` | ✅ Upgraded | NOI projection ComposedChart |
| Deal Pricing | `deal-pricing.tsx` | ✅ Upgraded | 8-metric institutional strip |
| Debt | `debt-inputs.tsx` | ✅ Upgraded | amortization waterfall chart |
| Capital Stack | `capital-stack.tsx` | ✅ Upgraded | segmented visual stack bar |
| DCF | `dcf-calculator.tsx` | ✅ Upgraded | 8-metric strip + CF waterfall |
| Exit Strategy | `exit-strategy.tsx` | ✅ Upgraded | 5-metric strip + scenario bar chart |
| Returns | `model-returns.tsx` | ✅ Tightened | tabular-nums typography |
| Multi-Year | `MultiYearProjectionTab.tsx` | ✅ Upgraded | KPI strip + ComposedChart + expandable year table + exit card |

### workspace.tsx financials extraction (lines ~445-465)
```typescript
// CORRECT — reads scenarios[0].metrics.*
const s0 = _proFormaRaw.scenarios?.[0];
financials = {
  totalRevenue: s0.metrics.totalRevenue,
  totalExpenses: s0.metrics.totalExpenses,
  noi: s0.metrics.noi ?? s0.metrics.stabilizedNoi,
  capRate: s0.metrics.capRate,
  irr: s0.metrics.irr,
  equityMultiple: s0.metrics.equityMultiple,
  cashOnCash: s0.metrics.cashOnCash,
  noiMargin: s0.metrics.noiMargin,
}
```

---

## Doc Intel / Upload Pipeline Status

### Phases 1-5 Complete ✅
- PDF/Excel extraction → classification → review grid → confirm → sync to model
- Learning system, department mapping, category correction
- Seasonal distribution engine (SeasonalDistributionModal.tsx)
- Multi-entity Excel extraction (detectEntityColumns)

### PLReviewGrid Entity Grouping ✅
- `getExtractedItemsGrouped()` now returns `entityName`, `parentItemId`, `isTotal` on each lineItem
- Client derives `entityGroups` from `filteredLineItems` — dynamic, DB-driven
- UI: entity section headers with pending/confirmed badge counts, collapsible
- Single-entity uploads: no headers shown (single passthrough group)
- Multi-entity uploads: ∑ TOTALS expanded by default, entity sections collapsed

### Workspace Tab Structure
```
OVERVIEW       → overview, summary, validation
INPUTS & DATA  → inputs, property-tax, storage-leases, commercial-leases, profit
UPLOADS        → uploads
FINANCIAL MODEL → historical, proforma, pricing, debt, capital, exit, dcf, returns, multi-year, tax-dist
ANALYSIS       → analytics, proforma-charts, scenario-compare, sensitivity, monte-carlo
SCENARIOS      → cases, audit
OUTPUT         → comps, export
```

---

## Oakdale Test Deal
- **Upload ID:** `15ee3999-386d-495d-921f-6f8d9661941c`
- **Org:** `cd3719c3-ef82-4ccc-acb9-261c80fb64b4`
- **STR test project:** `6b3a9021-f393-489d-9274-321ac76eae08`
- **Entities:** CROWLEY MARINE (58 rows), OAKDALE SERVICE (58), J.M.T.M. ASSOCIATES (58), TOTALS (58)

---

## Pending Items
1. **Single-item confirm 500** — click confirm on one item while watching server logs, paste the `[Learning single]` error output. Root cause undiagnosed.
2. **DCF route registration silent error** — Phase 3 final blocker. Endpoints fall through to Vite SPA catch-all. Fix: wrap registration block in try-catch to surface exact error.

---

## Preferred Patching Pattern
```bash
cat > /tmp/patch-xxx.mjs << 'SCRIPT'
import fs from 'fs';
const file = process.env.HOME + '/workspace/path/to/file.tsx';
let content = fs.readFileSync(file, 'utf8');
const OLD = `exact string`;
const NEW = `replacement`;
if (content.includes(OLD)) {
  content = content.replace(OLD, NEW);
  fs.writeFileSync(file, content, 'utf8');
  console.log('✅ patched');
} else {
  console.error('❌ anchor not found');
}
SCRIPT
node /tmp/patch-xxx.mjs
```

---

## Asset Classes Supported (16+)
Marina, Self-Storage, Multifamily, Mobile Home Park, RV Park, Industrial, Office, Retail, Mixed-Use, Hotel/Hospitality, Short-Term Rental, Senior Housing, Student Housing, Data Center, Car Wash, Parking


---

## Session 4 — FM Deep Audit & Fixes

### Bugs Fixed
1. **Calendar import crash** (uploads.tsx) — `Calendar` was missing from lucide-react import
2. **DCF GET/POST mismatch** — client calls GET but dcf-routes only had POST; added GET handler
3. **orgId wrong in dcf-routes** — `user?.organizationId` → `user?.orgId` (all refs fixed)
4. **DCF null result guard** — server returns 422 with clear message instead of 500 when no inputs
5. **DCF error state** — client now shows "Input Assumptions Required" CTA with "Go to Inputs" button
6. **Pro Forma empty guard** — shows CTA instead of broken/empty tab when no scenario data
7. **navigate-tab event** — workspace.tsx listens for CustomEvent so child tabs can redirect to Inputs

### Seasonal Import Issue (PENDING RE-SYNC)
- `period_key = '2025-ANNUAL'` means all actuals landed in month=1
- Seasonal engine IS wired in importConfirmedItems — just needs re-sync after clearing stale data
- Run: DELETE stale actuals → click Sync to Model on Oakdale upload
- With `seasonal_config = null` → even 1/12 split across all 12 months
- To get seasonal weighting: click Seasonalize first, configure, then Sync

### Stale Actuals — Manual Re-Sync Steps
```bash
node -e "
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.query('SELECT modeling_project_id FROM doc_intel_uploads WHERE id = \'15ee3999-386d-495d-921f-6f8d9661941c\'')
  .then(r => pool.query('DELETE FROM modeling_actuals WHERE modeling_project_id = $1 AND data_source = $2', [r.rows[0].modeling_project_id, 'doc_intel']))
  .then(r => { console.log('Deleted', r.rowCount, 'rows'); pool.end(); })
  .catch(e => { console.error(e.message); pool.end(); });
"
```
Then click Sync to Model in Uploads tab.

### Pending
1. **Single-item confirm 500** — undiagnosed, needs [Learning single] server log
2. **DCF service audit** — verify performDCFAnalysis handles empty inputAssumptions gracefully (doesn't throw)
3. **Seasonalize → Re-sync test** — verify Historical P&L shows even monthly split after re-sync

---

## Session 4b — FM Design System + Build Fix Marathon

### FM Design System v2 (index.css)
Added full institutional CSS layer: `fm-page`, `fm-header`, `fm-header-title`, `fm-header-sub`, `fm-header-actions`, `fm-kpi-strip` (cols-4/5/6/8), `fm-kpi` with accent bars, `fm-kpi-label`/`fm-kpi-value`/`fm-kpi-sub`, `fm-body`, `fm-panel`, `fm-panel-header`, `fm-panel-title`, `fm-panel-body`, `fm-section-label`, `fm-table` with row-total/row-subtotal/row-group-header, `fm-scenario-pill` (bear/base/bull), `fm-delta` (up/down), `fm-source-badge` (manual/synced). Monospace font stack via `--fm-mono`.

### Tabs upgraded to fm-page wrapper
historical-pl, dcf-calculator, deal-pricing, pro-forma, exit-strategy, model-returns, debt-scenarios, monte-carlo, scenario-comparison

### Tabs reverted (complex nested returns — apply manually)
capital-stack — reverted to space-y-4, needs careful manual wrap of top-level return only

### Build errors fixed
1. inputs.tsx — duplicate `unitMix` key from fm-wrap-bodies script
2. capital-stack.tsx — extra `</div>` injected before `</Tabs>` at line 4613
3. PLReviewGrid.tsx — outer entityGroups Fragment never closed; inner map closed with `})}` but outer needed `})` + `)}` to close ternary

### Remaining visual upgrade work
- Apply `fm-kpi` classes to individual KPI cells inside fm-kpi-strip (they still use old p-4 flex-col pattern)  
- capital-stack needs manual fm-page wrapper at component root (line ~1130)
- debt-inputs.tsx header patch may need re-check
- Add `fm-body` content wrap inside each tab after fm-header

## DCF Refactor Complete — Phase 3 (March 14, 2026)

### What Was Built
All four layers of the DCF refactor are live, tested, and integrated.

**Layer 1 — Foundation:** DCF calculator now consumes `computeMultiYearProjection()` as the canonical source of truth. No independent NOI modeling. All values (growth, exit cap, debt, hold period) come from project config, capital stack, and scenario versions.

**Layer 2 — Validation:** Centralized XIRR in `shared/finance/xirr.ts`. Cash flow canonicalizer enables parity comparison across pipelines. 47 golden vector tests (6 vectors × 7 assertions + percent convention + failure mode tests).

**Layer 3 — Simulation:** Monte Carlo with seeded PRNG (fast mode: <40ms for 500 sims). Deterministic base/upside/downside scenarios with probability-weighted expected case. 20 tests covering stats sanity, seed determinism, distribution bounds.

**Layer 4 — Decision Support:** Tornado chart (one-at-a-time driver perturbation), OLS factor attribution on MC samples, IC memo generator with 3 tones (concise/ic/lender). Gated behind entitlement check (MVP: allow all). 26 tests.

### Additional Work (Same Session)

**Dummy Data Purge:**
- `pro-forma-charts.tsx` — Removed ~200 lines of hardcoded $7.5M revenue, payroll, NOI waterfall, revenue mix. Now shows real Pro Forma data or empty state.
- `sensitivity-tornado.tsx` — Removed `generateSimulatedData()` with fake $15M valuation. Now pulls from DCF decision support tornado endpoint.
- `debt-scenarios.tsx` — Removed $10M/$800K fallbacks. Shows 0 when no project data.
- `lease-cashflow.tsx` — Removed hardcoded 3% market rent growth fallback.

**Empty States:**
- Created reusable `WorkspaceEmptyState` component (`client/src/components/workspace/WorkspaceEmptyState.tsx`) with configurable title, description, icon variant, and "Go to Inputs" CTA button.
- Wired into pro-forma-charts, sensitivity-tornado, DCF panel.

**E2E Pipeline Test:**
- `server/__tests__/dcf-pipeline-e2e.test.ts` — 10 tests covering: Direct Input → Multi-Year Projection → DCF → Scenarios → Monte Carlo → Tornado → IRR consistency (DCF IRR matches MC P50 within 100bps).

**Export:**
- Added DCF Analysis sheet to Excel export (`modeling-export.ts`) — includes IRR, EM, yearly cash flows, exit metrics.

**Marina Text Sweep:**
- `assumptions.tsx` — Replaced ~120 lines of hardcoded marina storage/department arrays (`storageTypesConfig`, `storageTypeCategories`, `designatedSpaceCategories`, `allRevenueCategories`) with dynamic builder functions that read from `getModelConfig(assetClass)`. Categories now adapt per asset class.
- `workspace.tsx` — Asset class badge now shows for all types including marina (was previously hidden).

**Seasonality Derivation:**
- DCF calculator service, decision support service, and MC route now auto-inject `inSeasonMonths` from project config (`season_months` column) or asset class defaults (`getModelConfig().seasonConfig.defaultInSeasonMonths`). Marina projects get Apr-Oct seasonality automatically.

**XIRR Consolidation:**
- `shared/finance/xirr.ts` is the CANONICAL implementation (returns PERCENT, accepts ISO date strings).
- `server/utils/financial-calculations.ts` is now a thin wrapper (returns DECIMAL, converts Date objects → strings internally). Pro-forma-engine continues working without changes.
- Both produce identical results (proven by 47 parity tests).

### File Manifest

**Shared Finance (new):**
`shared/finance/xirr.ts`, `distributions.ts`, `tornado.ts`, `attribution.ts`, `memo-generator.ts`

**Backend Services (new/replaced):**
`server/services/dcf-calculator-service.ts` (replaced), `dcf-scenario-layer.ts`, `dcf-simulation-service.ts`, `dcf-decision-support-service.ts`, `finance/cashflow-parity.ts`, `server/routes/dcf-routes.ts`

**Tests (new):**
`server/__tests__/irr-parity.test.ts` (47), `monte-carlo.test.ts` (20), `decision-support.test.ts` (26), `dcf-pipeline-e2e.test.ts` (10)

**Frontend (new/modified):**
`client/src/components/workspace/DCFMonteCarloPanel.tsx` (new), `WorkspaceEmptyState.tsx` (new), `dcf-calculator.tsx` (wired MC + DS), `pro-forma-charts.tsx` (purged), `sensitivity-tornado.tsx` (rewired), `assumptions.tsx` (dynamic config)

### Endpoints
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/modeling/projects/:id/dcf` | Full DCF analysis |
| POST | `/api/dcf/quick-irr` | Quick IRR |
| POST | `/api/modeling/projects/:id/dcf/monte-carlo` | Monte Carlo |
| GET | `/api/modeling/projects/:id/dcf/decision-support` | Fast DS |
| POST | `/api/modeling/projects/:id/dcf/decision-support` | Full DS + MC |

### Verified Results (STR test project 6b3a9021)
- DCF: 16.31% IRR, 1.95x EM
- Quick IRR: 16.31% IRR, 1.95x EM (exact match)
- Monte Carlo: P10=14.65%, P50=16.31%, P90=17.88% (500 sims, 32ms)
- Decision Support: 5 tornado drivers, 3 scenarios (14.15%–17.88%), IC memo
- **154/154 tests passing, 0 TypeScript errors**

### Backups
- `server/routes.ts.pre-dcf-refactor` — original routes before DCF wiring
- `server/services/dcf-calculator-service.ts.OLD` — original DCF service

### Remaining
- Frontend visual QA (verify MC panel, Decision Support, tornado, empty states render in browser)
- Feature gating: add `subscription_tier` to organizations table when billing system is built
- Phase 2 remaining: marina text sweep in non-workspace pages (sidebar labels, etc.)
