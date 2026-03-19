# MarinaMatch Platform Journal

## Current State (2026-03-19)

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

---

## Active Technical Patterns

**DB changes**: Always `psql $DATABASE_URL` with `ADD COLUMN IF NOT EXISTS` — never `npm run db:push`
**Kill server**: `pkill -f 'tsx server'`
**Patch pattern**: `node --input-type=module << 'JS'` heredoc for file edits
**RLS tables**: Use raw `pool.query()` not Drizzle ORM
**Raw SQL returns**: snake_case — map explicitly
**Test project**: ID `6b3a9021-f393-489d-9274-321ac76eae08`, org `cd3719c3-ef82-4ccc-acb9-261c80fb64b4`

---

## Remaining Work (priority order)

### 1. Stripe Payment Integration (HIGH — packs activated via admin/DB only)
Pack enforcement is live but there's no self-serve payment flow. Stripe fields
exist in schema (stripePriceIdMonthly, stripeSubscriptionId, etc.) but no
webhook handlers or checkout routes. Packs currently activated manually.

### 2. Real Data Import (HIGH — platform is data-ready)
Sales Comps: /analysis/sales-comps/upload
Rate Comps: /analysis/rate-comps
Empty state CTAs now point directly to these flows.

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
