# MarinaMatch Agent Task Queue

## 🔴 TIER 1 — CRM / DEAL PIPELINE (Active Priority)

- [spec] [in-progress] Write detailed build spec for Deal Comparison workspace — pull DCF + Pro Forma per deal (CRM priority #3)
- [feature] [in-progress] Implement Email Send Integration for Workflow Automation — see agents/specs/email-send-integration-spec.md
- [feature] [todo] Implement Google Maps & Google Places API integration with encrypted key storage — AES-256-GCM encrypted key in DB (pattern: enc:iv:ciphertext), server-side proxy routes for autocomplete (/api/google-places/autocomplete), place details (/api/google-places/details/:placeId), and geocoding (/api/google-places/geocode), reusable GooglePlaceSearch frontend component (debounced, no Google SDK), and Settings UI for key entry/masking — see attached_assets/Pasted-Implement-Google-Maps-Google-Places-API-integration-wit_1774924110030.txt for full spec

## 🟠 TIER 2 — AI ADVISOR

- [spec] [in-progress] Spec entity injection for AI Advisor — auto-inject current Deal Room context into AI prompts
- [feature] [todo] Implement AI advisor entity injection — reads modeling_project, pro forma, DCF for current deal

## 🟡 TIER 3 — DOCUMENT STUDIO / MARKETING PACKAGES

- [spec] [todo] Spec the shared token substitution engine for Document Studio
- [migration] [todo] Create document_templates and document_renders tables for Document Studio
- [feature] [todo] Build token substitution engine — Express route + token resolver pulling live Pro Forma and DCF data
- [spec] [todo] Spec IC Deal Review Deck — section layout, token map, PDF output route
- [feature] [todo] Build IC Deal Review Deck template + POST /api/marinamatch/documents/ic-deck PDF route
- [spec] [todo] Spec Offering Memorandum template — section modularity, token map, PDF output
- [feature] [todo] Build Offering Memorandum template + POST /api/marinamatch/documents/om PDF route
- [feature] [todo] Build Document Studio UI tab — InvestmentMaterialsTab with IC Deck and OM cards and generate buttons

## 🟢 TIER 4 — PROSPECTING / MARKETPLACE

- [spec] [todo] Spec Marina Property Intelligence Map data integration — geocoding and Mapbox GL JS rendering
- [migration] [todo] Ensure marina_properties table has lat/lng, investment grade, demographics JSON columns
- [feature] [todo] Implement CRUD routes for /api/marinamatch/marina-properties
- [feature] [todo] Wire Marina Property Map to live DB data — replace any stub or mock data
- [spec] [todo] Spec lead enrichment pipeline — Marketplace add-to-pipeline auto-creates owner CRM contact
- [feature] [todo] Implement lead enrichment pipeline
- [feature] [todo] Build scraping health dashboard — last scrape time, success rate, new listing count

## 🔵 TIER 5 — REPORTING & ANALYTICS

- [spec] [todo] Spec portfolio dashboard — org-level rollup: aggregate NOI, equity deployed, avg DSCR
- [migration] [todo] Create portfolio_snapshots table for caching rollup calculations
- [feature] [todo] Build portfolio dashboard page — reads all modeling_projects, rolls up Pro Forma and DCF
- [spec] [todo] Spec pipeline analytics — deal velocity, win rate, avg days in stage, conversion funnel
- [feature] [todo] Build pipeline analytics tab in CRM
- [spec] [todo] Spec payroll UI — expense drill-down using existing 30+ payroll tables
- [feature] [todo] Build payroll module UI — department allocations, burden profiles, connects to Pro Forma opex

## 🟣 TIER 6 — FINANCIAL MODEL POLISH

- [test] [todo] Visual QA pass on all Financial Model tabs — layout, empty states, number formatting
- [spec] [todo] Spec financial model feature gating — which FM features gate behind which entitlement tiers

## ⚫ TIER 7 — BILLING

- [spec] [todo] Spec Billing Engine — Stripe integration, plan management, usage metering
- [migration] [todo] Create billing tables — subscriptions, invoices, usage_events, plan_entitlements
- [feature] [todo] Build Billing Engine — Stripe webhook handler, plan upgrade/downgrade, entitlement sync

## ⚙️ TIER 8 — PLATFORM INFRASTRUCTURE

- [feature] [todo] Make Asset Classes fully dynamic — DB-driven everywhere — replace all hardcoded ASSET_CLASS_OPTIONS/ASSET_CLASS_CONFIGS arrays in the frontend with a useAssetClasses() hook backed by GET /api/asset-classes; extend platformAssetClasses schema with sizeLabel, occLabel, priceUnit, revenueStreams, demandKey, group, color fields; seed all 36 asset class types from the canonical registry (Marina, Dry Stack, Yacht Club, Waterfront Resort, Boat Rental, Hotel, Boutique Hotel, Motel, Extended Stay, RV Park, Glamping, Multifamily, Garden Apts, Senior Housing, Student Housing, MHP, Condo, SFR, Industrial, Warehouse, Cold Storage, Self Storage, Data Center, Truck Terminal, Office, Medical Office, Co-working, Creative Office, Retail Strip, Anchored Shopping Ctr, NNN Single Tenant, Car Wash, Laundromat, Business Acquisition, Mixed Use, Land); add Create New Asset Class form to Admin UI; lock admin routes with requireRole("owner") server-side; ensure unknown asset class keys fall back to default strategy instead of erroring — full spec in AGENT_QUEUE_ASSET_CLASS_SPEC.md

## 🏗️ TIER 9 — RENT ROLL ANALYSIS (Complete to 100%)

> All tasks below target `server/routes/rra-routes.ts`, `server/services/rent-roll-v2/`, and `client/src/modules/rent-roll-v2/`. The strategy pattern lives in `assetStrategies/`. Do not break existing marina behavior. All DB queries must use `pool.query()` or Drizzle with `orgId` scoping.

### 9A — Quick Wins (Placeholder Fixes)

- [feature] [todo] Wire executive dashboard ancillary revenue trend — `getExecutiveAncillaryRevenueTrend()` in rentRollService.ts is marked placeholder returning zeros; implement real query: sum cash flows where chargeType IN ('fuel','store','ship_store','ancillary') grouped by month for trailing 12 months; surface as a line chart in the executive-dashboard.tsx "Revenue Breakdown" section

- [feature] [todo] Wire executive dashboard transient revenue trend — `getExecutiveTransientRevenueTrend()` in rentRollService.ts is marked placeholder returning zeros; implement real query: sum cash flows where storageType IN ('transient','guest_dock','day_use') grouped by month for trailing 12 months; surface in executive-dashboard.tsx alongside the ancillary trend

- [feature] [todo] Activate renewal reminder scheduled job — `router.get("/analytics/renewal-reminders/process")` in rra-routes.ts is marked "scheduled job placeholder"; wire it into the existing platform cron scheduler (server/services/cronService or equivalent); job should run daily, query leases expiring within 30/60/90 days, create a `rra_reminder_log` record and insert a notification; add a "Last Processed" timestamp to the RenewalRemindersPanel.tsx UI header

### 9B — RV Park / Mobile Home Park Dedicated Analytics

- [feature] [todo] Build RV Park / MHP analytics service — create `server/services/rent-roll-v2/assetStrategies/rvParkAnalytics.ts` mirroring selfStorageAnalytics.ts pattern; implement: `getRVParkKPIs(locationId)` returning padOccupancy%, avgPadRent, seasonalOccupancyCurve (12-month array), amenityFeeContribution ($), churnRate%, avgLengthOfStay; `getPadMixPerformance(locationId)` returning breakdown by pad type (full-hookup, electric-only, tent, cabin) with avg rent and occupancy per type; `getSeasonalDemandAnalysis(locationId)` returning month-by-month occupancy vs. prior year

- [feature] [todo] Register RV Park analytics routes in rra-routes.ts — add GET `/analytics/rv-park/kpis`, `/analytics/rv-park/pad-mix`, `/analytics/rv-park/seasonal-demand` routes following the same pattern as hotel and self-storage analytics routes (lines ~3793–3830 in rra-routes.ts)

- [feature] [todo] Build RV Park analytics UI panel — in the rent-roll-dashboard.tsx, detect assetClass === 'rv_park' or 'mobile_home' and render a dedicated analytics tab with: KPI summary cards (pad occ %, avg pad rent, churn rate, avg length of stay), seasonal occupancy line chart (12-month with prior year overlay), pad mix bar chart (type vs. avg rent), amenity fee contribution donut chart

### 9C — Hotel / STR Analytics UI

- [feature] [todo] Surface hotel RevPAR and ADR analytics in dashboard UI — hotel KPI endpoint (`/analytics/hotel/kpis`) and room type performance endpoint (`/analytics/hotel/room-type-performance`) already exist in rra-routes.ts; build the UI panel in rent-roll-dashboard.tsx for assetClass === 'hotel' or 'str': KPI cards (RevPAR, ADR, OccupancyPct, total room-nights), RevPAR trend line chart (trailing 12 months), room type performance table (type, count, avg ADR, occ%), seasonal ADR heatmap by month; fetch via useQuery hooks pointing to existing endpoints

- [feature] [todo] Extend hotelAnalytics.ts with ADR trend and channel mix — add `getADRTrend(locationId, months=12)` returning month-by-month ADR and occupancy; add `getChannelMix(locationId)` returning revenue breakdown by booking source (direct, OTA, corporate, group) if `bookingSource` field exists on leases; if field doesn't exist, add it to the lease schema as an optional varchar; surface channel mix as a donut chart in the hotel analytics panel

### 9D — Retail CAM Reconciliation UI

- [feature] [todo] Build CAM reconciliation UI panel for retail — `getCAMReconciliation()` route exists at `/analytics/retail/cam-reconciliation` in rra-routes.ts; build `CAMReconciliationPanel.tsx` component in `client/src/modules/rent-roll-v2/components/`; display: CAM pool summary card (estimated vs. actual total), tenant reconciliation table (tenant name, prorata share%, estimated CAM, actual CAM, surplus/deficit, status), export to CSV button; surface in rent-roll-dashboard.tsx for assetClass === 'retail' or 'anchored_retail' or 'office'

- [feature] [todo] Extend retailAnalytics.ts with WALT and rollover schedule — add `getWALT(locationId)` computing weighted average lease term in years (weight = in-place rent); add `getRolloverSchedule(locationId)` returning leases expiring by calendar year for the next 5 years with total SF and revenue at risk per year; register routes GET `/analytics/retail/walt` and `/analytics/retail/rollover-schedule`; surface in the retail analytics tab as a WALT metric card and a stacked bar chart of rollover exposure

### 9E — Industrial / Warehouse Analytics

- [feature] [todo] Build industrial analytics service — create `server/services/rent-roll-v2/assetStrategies/industrialAnalytics.ts`; implement: `getIndustrialKPIs(locationId)` returning leasedPct, avgRentPSF, weightedAvgLeaseTerm (WALT), totalSF, vacantSF, totalAnnualRevenue; `getRolloverSchedule(locationId)` returning leases expiring by year (next 5 years) with SF and revenue at risk; `getTenantConcentration(locationId)` returning top-10 tenants by % of total revenue (concentration risk); `getRentPSFByTenant(locationId)` returning each tenant's in-place rent PSF vs. market PSF

- [feature] [todo] Register industrial analytics routes — add GET `/analytics/industrial/kpis`, `/analytics/industrial/rollover-schedule`, `/analytics/industrial/tenant-concentration`, `/analytics/industrial/rent-psf` in rra-routes.ts; apply to assetClass IN ('industrial','warehouse','cold_storage','flex','truck_terminal','data_center')

- [feature] [todo] Build industrial analytics UI panel — surface in rent-roll-dashboard.tsx for industrial asset classes: KPI cards (leased %, avg rent PSF, WALT, vacant SF), rollover schedule bar chart (SF expiring by year, color-coded by risk level), tenant concentration donut chart (top 5 tenants + other), rent PSF comparison table (in-place vs. market per tenant)

### 9F — Multifamily Analytics Completion

- [feature] [todo] Extend multifamilyAnalytics.ts with concession tracking and renewal spread — add `getConcessionAnalysis(locationId)` returning: total concessions granted ($ and % of GPR), avg concession per lease (weeks free rent, flat discount), concession trend by month; add `getRenewalSpreadAnalysis(locationId)` returning: avg rent increase at renewal vs. new-lease rent (spread%), renewal acceptance rate%, leases up for renewal next 90 days; add `getMarketRentUpdateLog(locationId)` tracking when market rents were last updated per unit type

- [feature] [todo] Build market rent update workflow for multifamily — add a "Update Market Rents" button in the multifamily analytics panel that opens a drawer; drawer shows each unit type with current in-place avg and editable market rent field; on save, bulk-updates `marketRent` on all active leases of that unit type; recalculates loss-to-lease in real time; POST `/api/rra/locations/:locationId/market-rents/bulk-update`

- [feature] [todo] Surface concession and renewal spread analytics in multifamily UI panel — add concession summary cards and trend chart, renewal spread gauge chart, "Renewals Due" table (tenant, unit, expiry date, current rent, proposed renewal amount) to the multifamily analytics tab in rent-roll-dashboard.tsx

### 9G — Snapshot Comparison (Time Travel)

- [feature] [todo] Build snapshot comparison UI — `createSnapshotVersion()` and `listSnapshots()` already exist in rentRollService.ts; in `client/src/modules/rent-roll-v2/pages/snapshots.tsx`, add a "Compare Two Snapshots" mode: two date-picker dropdowns (Snapshot A, Snapshot B); on compare, fetch both snapshots and diff them; display side-by-side: occupancy delta (±X%), revenue delta ($±, %±), lease count delta, avg rate delta; below that, a "Changed Leases" table showing which specific leases changed status, rate, or dates between the two snapshots; highlight increases green, decreases red

- [feature] [todo] Add snapshot diff API endpoint — POST `/api/rra/snapshots/compare` accepting `{ snapshotAId, snapshotBId, projectId }`; query both snapshots' lease data, compute diff per lease (status change, amount change, new/removed), return structured delta object: `{ summary: { occupancyDelta, revenueDelta, leaseCountDelta }, leaseChanges: [...] }`

### 9H — GL Reconciliation Automation

- [feature] [todo] Build automated GL variance matching — in `server/services/rent-roll-v2/reconciliationService.ts`, implement `autoMatchGLEntries(projectId, periodId)`: fetch all rent roll cash flows for the period, fetch all GL entries mapped to rent roll accounts, attempt fuzzy match by amount ± $1 tolerance and account code; return matched pairs, unmatched rent roll items, and unmatched GL items; add confidence score (exact match = 1.0, amount-only match = 0.8, manual = 0.0)

- [feature] [todo] Surface GL auto-match results in reconciliation UI — in `client/src/modules/rent-roll-v2/pages/gl-reconciliation.tsx`, add an "Auto-Match" button that calls POST `/api/rra/reconciliation/auto-match`; display results in three columns: Matched (green checkmark, confidence %), Rent Roll Unmatched (amber), GL Unmatched (red); allow user to manually link an unmatched pair by drag-and-drop or dropdown; add variance summary card at top: total variance $, matched %, unmatched items count

- [feature] [todo] Add period-close workflow to GL reconciliation — add "Close Period" button that locks all cash flows for a period (sets `periodLocked = true`); locked periods cannot have leases edited retroactively; display a lock icon on closed periods in the cash flow grid; add GET `/api/rra/periods/:periodId/lock` and `unlock` routes; include an audit log entry on lock/unlock (who, when)

### 9I — Auto-Sync Rent Roll → Pro Forma

- [feature] [todo] Build real-time rent roll → Pro Forma sync — replace the manual "Sync to Ledger" button with a project-level setting: `autoSyncToProForma: boolean` stored in the RRA project record; when true, any lease CRUD operation (create, update, delete, status change) triggers `syncRentRollToProForma(projectId)` async job; the sync function computes current month's EGI (effective gross income) from rent roll cash flows and writes it to the pro forma's `rentRevenue` row for that period; add a sync status indicator (last synced timestamp + status) to the project-hub.tsx header

- [feature] [todo] Build sync conflict resolution UI — when auto-sync would overwrite a manually-entered pro forma value, surface a conflict dialog: "Rent Roll calculated $X for this period, Pro Forma has $Y manually entered. Use Rent Roll value or keep manual?" with options to apply once, apply always, or skip; store the user's preference per period in a `rra_sync_overrides` table

### 9J — Cohort Analysis Completion

- [feature] [todo] Complete cohort analysis backend — in `server/routes/rra-routes.ts`, implement the cohort analysis query: group tenants by move-in quarter (e.g., Q1 2022, Q2 2022...); for each cohort, track retention rate at 3/6/12/24 months (% still active), avg revenue per tenant at each interval, cumulative churn; endpoint: GET `/api/rra/analytics/cohorts?projectId=&granularity=quarter&metric=retention`

- [feature] [todo] Complete cohort analysis UI — in `client/src/modules/rent-roll-v2/pages/cohort-analysis.tsx`, build the cohort retention heatmap: rows = move-in cohorts, columns = months since move-in (0, 3, 6, 12, 18, 24), cell value = retention %; color scale from green (100%) to red (0%); add toggle between "Retention %" and "Avg Revenue per Tenant" views; add cohort summary cards: best-performing cohort, worst-performing cohort, overall 12-month retention rate

### 9K — Report Packages Completion

- [feature] [todo] Build dynamic rent roll report assembly engine — in `server/routes/rra-routes.ts`, implement POST `/api/rra/reports/generate` accepting `{ projectId, reportType, asOfDate, format: 'pdf'|'excel' }`; reportType options: 'rent_roll_summary' (leases table + KPIs), 'cash_flow_statement' (period matrix), 'occupancy_report' (trend charts + stats), 'lease_expiration_report' (calendar + expiring leases table), 'executive_summary' (all KPIs + charts on one page); generate PDF using existing PDF infrastructure or Excel using ExcelJS

- [feature] [todo] Build report packages UI — in `client/src/modules/rent-roll-v2/pages/report-packages.tsx`, build a report generator interface: list of available report types with description, format toggle (PDF / Excel), as-of date picker, project selector; "Generate" button calls the report API and triggers download; "Scheduled Reports" section where user can set a report to auto-generate monthly and email to a list of recipients (store in `rra_scheduled_reports` table)

### 9L — Data Quality & Completeness

- [feature] [todo] Enhance data quality panel with actionable resolution — `RentRollDataQualityPanel.tsx` currently shows issues; add "Fix" action buttons inline: for "Missing Rate" issues, open inline edit field; for "Inactive lease with no end date", offer one-click "Set end date to today"; for "Duplicate tenant", offer "Merge" workflow; add a data quality score (0–100) computed as: `(complete leases / total leases) * 100` displayed as a progress ring in the panel header; POST `/api/rra/leases/bulk-fix` accepting an array of fix instructions

- [feature] [todo] Build lease completeness enforcer — add a `completenessScore` column to `rra_leases` (0–100 int); computed on every save: +20 for having a rate, +20 for having a start date, +20 for having an end date or contractTerm, +20 for having a unit type, +20 for having a valid status; display completeness score as a colored pill in LeasesTable.tsx; add a filter "Show incomplete leases only" to the leases table toolbar

## 🔍 AUDIT TASKS

- [audit] [todo] Full connectivity audit — verify every feature in Connectivity Matrix is wired end-to-end
- [audit] [todo] Empty state audit — check every page and tab for blank screen conditions

## Completed
- [feature] [done] Polish global activity log — timestamps, filters by entity type and actor, pagination (CRM priority #5)
- [feature] [done] Add key dates display to Kanban pipeline cards — created, expected close, next follow-up (CRM priority #4)
- [feature] [done] Fix AI advisor markdown rendering — add react-markdown renderer to chat UI
- [spec] [done] Spec out Email send integration for CRM Workflow Automation (CRM priority #6)
- [feature] [done] Implement Deal Timeline/Gantt view — see agents/specs/deal-timeline-gantt-spec.md
- [spec] [done] Write detailed build spec for Deal Timeline/Gantt view (CRM priority #2)

- [feature] [done] Workflow Automation engine
- [feature] [done] MarketplaceListings.tsx
- [feature] [done] Marina Property Intelligence Map
- [feature] [done] AI Advisor knowledge-base-service.ts
- [feature] [done] CRM Record Pages — all 4 entity types
- [feature] [done] DCF Phase 3 — 154/154 tests passing
- [feature] [done] Multi-Year Pro Forma
- [feature] [done] Capital Stack
- [feature] [done] Exit Strategy Studio
- [feature] [done] Investment Criteria buy-box
- [feature] [done] P&L Parser v2
- [feature] [done] Payroll module schema
- [feature] [done] Entitlements system
- [feature] [done] Institutional readiness

## Failed / Blocked
- [feature] [todo] Implement Email Send Integration for Workflow Automation — see agents/specs/email-send-integration-spec.md — 

