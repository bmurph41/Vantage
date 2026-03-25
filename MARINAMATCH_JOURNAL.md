# MarinaMatch Platform Journal

## Current State (2026-03-25)

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
