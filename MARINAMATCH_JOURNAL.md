# MarinaMatch Platform Journal

## Current State (2026-03-17)

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

### 1. Feature Gating (HIGH — needed before real users)
357 server + 204 client billing references exist. FM tabs and advanced CRM
features are not gated yet. Billing infrastructure exists; needs enforcement layer.

### 2. Real Data Import (HIGH — platform is data-ready)
Sales Comps: /analysis/sales-comps/upload
Rate Comps: /analysis/rate-comps
Empty state CTAs now point directly to these flows.

### 3. CRM Dashboard Assessment (MEDIUM)
crm-dashboard.tsx exists but not assessed. May need upgrade to match
new record page quality. Check /crm root route.

### 4. last_contacted_at Backfill (LOW — only 1 contact in DB now)
SQL: UPDATE crm_contacts SET last_contacted_at = (
  SELECT MAX(created_at) FROM crm_activities
  WHERE entity_type='contact' AND entity_id=crm_contacts.id
) WHERE org_id = '...';

### 5. Frontend Visual QA (LOW)
DCF tabs, FM design system consistency — post-billing.

### 6. Property Form Geocoding (LOW)
Auto-populate lat/lng from address for comp radius queries.

---

## Session Instruction
At the start of every MarinaMatch session, run:
  cat ~/workspace/MARINAMATCH_JOURNAL.md
