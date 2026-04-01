# MarinaMatch Agent Task Queue

## 🔴 TIER 1 — CRM / DEAL PIPELINE (Active Priority)

- [spec] [in-progress] Write detailed build spec for Deal Comparison workspace — pull DCF + Pro Forma per deal (CRM priority #3)
- [feature] [in-progress] Implement Email Send Integration for Workflow Automation — see agents/specs/email-send-integration-spec.md
- [feature] [in-progress] Implement Google Maps & Google Places API integration with encrypted key storage — AES-256-GCM encrypted key in DB (pattern: enc:iv:ciphertext), server-side proxy routes for autocomplete (/api/google-places/autocomplete), place details (/api/google-places/details/:placeId), and geocoding (/api/google-places/geocode), reusable GooglePlaceSearch frontend component (debounced, no Google SDK), and Settings UI for key entry/masking — see attached_assets/Pasted-Implement-Google-Maps-Google-Places-API-integration-wit_1774924110030.txt for full spec

## 🟠 TIER 2 — AI ADVISOR

- [spec] [in-progress] Spec entity injection for AI Advisor — auto-inject current Deal Room context into AI prompts
- [feature] [in-progress] Implement AI advisor entity injection — reads modeling_project, pro forma, DCF for current deal

## 🟡 TIER 3 — DOCUMENT STUDIO / MARKETING PACKAGES

- [spec] [done] Spec the shared token substitution engine for Document Studio — see agents/specs/token-substitution-engine-spec.md
- [feature] [in-progress] Build token substitution engine — Express route + token resolver pulling live Pro Forma and DCF data
- [spec] [done] Spec IC Deal Review Deck — section layout, token map, PDF output route — see agents/specs/ic-deal-review-deck-spec.md
- [feature] [in-progress] Build IC Deal Review Deck — token resolver extensions, 3 API routes, section renderer, frontend generate flow — see agents/specs/ic-deal-review-deck-spec.md
- [spec] [done] Spec Offering Memorandum template — section modularity, token map, PDF output — see agents/specs/offering-memorandum-spec.md
- [feature] [todo] Build Offering Memorandum — OM renderer, 3 API routes (token-status/preview/generate), frontend generate flow — see agents/specs/offering-memorandum-spec.md
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

## 🎯 TIER 12 — PROSPECTING (Institutional-Grade Completion)

> **Diagnosis Summary — Current State: ~50% institutional-grade**
>
> **What works:** The weekly planning engine is the standout feature — ISO quarter/week grid (13 weeks per quarter), daily activity logging via activityBoxes JSONB, goal templates, real-time WebSocket sync, dashboard stats (calls, emails, leads, deals), per-user settings (weekly call/email/lead goals), market targets CRUD, campaign + template metadata CRUD, board view (week-based progress tracking), analytics page (activity breakdown + conversion funnel), workroom (2,522-line modal with daily activity boxes), prospecting activities table with call/email/voicemail/linkedin/meeting outcome tracking.
>
> **Critical gaps:** Campaign system is metadata-only — `outreachCampaigns` has no steps table, no contact enrollment table, no execution engine — users can create a campaign name but cannot add contacts, build a sequence, or actually send anything; `crmProspectingEntries` has no FK to `crmContacts` or `crmProperties` (prospecting is decoupled from CRM contacts — no deduplication, no link to existing contacts when logging an activity); market targets are text-only (name, region, states) with zero geographic intelligence or census integration; no AI-powered target prioritization; no call dialer / VoIP integration; no LinkedIn integration beyond an enum value; no team-level quota visibility or territory assignment; no prospecting → deal conversion flow (Tier 11D already covers this); two disconnected campaign systems (`/api/prospecting/campaigns` vs `/api/marketing/campaigns`); analytics conversion funnel reads raw deal data not tracked funnel events.
>
> **Key files:** `client/src/pages/prospecting/` (7 pages, 4,811 lines), `client/src/components/modals/week-prospecting-modal.tsx` (2,522 lines), `shared/schema.ts` tables: `outreachCampaigns`, `outreachTemplates`, `marketTargets`, `crmProspectingEntries`, `crmProspectingActivities`, `prospectingActivities`, `prospectingWeeks`. Backend: routes.ts lines 10591–11244, `server/routes/campaign-schedule-routes.ts`.

### 12A — Campaign Execution Engine (The Biggest Gap)

- [feature] [todo] Build campaign contact enrollment system — add two tables to `shared/schema.ts`: `outreachCampaignSteps` (`id`, `campaignId` FK, `stepNumber` int, `type` enum('email'|'call'|'wait'), `delayDays` int, `templateId` FK to outreachTemplates, `subject` text, `body` text) and `outreachCampaignEnrollments` (`id`, `campaignId` FK, `contactId` FK to crmContacts, `propertyId` FK optional, `status` enum('active'|'paused'|'completed'|'replied'|'opted_out'), `currentStep` int, `startedAt`, `nextStepAt`, `completedAt`); add CRUD routes: GET/POST `/api/prospecting/campaigns/:id/steps`, GET/POST `/api/prospecting/campaigns/:id/enrollments`, PATCH `/api/prospecting/campaigns/:campaignId/enrollments/:id`

- [feature] [todo] Build campaign step builder UI — in `client/src/pages/prospecting/Campaigns.tsx`, add a "Steps" tab next to the existing campaign list; when a campaign is selected, show a visual sequence builder: numbered steps in a vertical list; each step is a card with type toggle (Email / Call / Wait), delay picker (0–30 days after previous step), template selector dropdown (from outreachTemplates); "Add Step" button appends a new step; drag to reorder; "Save Sequence" saves all steps via the new steps routes; render a compact preview of each step's subject/body

- [feature] [todo] Build campaign enrollment UI — in the campaign detail view, add an "Enrolled Contacts" tab showing a table of enrolled contacts (name, company, current step, next action date, status badge); "Enroll Contacts" button opens a drawer to search/select CRM contacts or CRM leads to enroll; on enroll, set `status = 'active'`, `currentStep = 1`, `nextStepAt = now + step1.delayDays`; allow bulk enrollment by uploading a CSV of emails or selecting from a CRM smart list; show enrollment count on the campaign card header

- [feature] [todo] Build campaign execution scheduler — create `server/services/campaignExecutionService.ts`; schedule a cron job (runs every 15 minutes) that: queries all enrollments where `status = 'active'` AND `nextStepAt <= now`; for each enrollment, fetches the current step; if step type is 'email', sends via SendGrid using the step's template (merge fields: `{{firstName}}`, `{{companyName}}`, `{{propertyName}}`); if step type is 'call', creates a `crmActivity` (type='call', outcome='no_answer', notes='Scheduled call task') and marks it pending; advances `currentStep` to next step, updates `nextStepAt`; marks enrollment `completed` when all steps are done; logs each execution in `crmActivities` with `campaignId` FK

### 12B — Contact-Linked Prospecting Activities

- [feature] [todo] Link prospecting activity log entries to CRM contacts — `crmProspectingActivities` has `contactId` and `propertyId` FK columns in the schema (lines 5327–5329) but the week-prospecting-modal.tsx activity logging UI doesn't wire them; in `week-prospecting-modal.tsx`, add a contact autocomplete field (search by name from `/api/crm/contacts/autocomplete`) and property autocomplete when logging any activity (call, email, meeting, voicemail); on save, persist the `contactId` and `propertyId` FK on the activity record; add a deduplication check: if the contact being logged is already in the CRM pipeline as an active deal, show a "This contact has an active deal: [Deal Name]" warning badge

- [feature] [todo] Add "prospecting-linked activities" view to CRM contact record — in `ContactRecordTabs.tsx`, add a "Prospecting History" tab that queries GET `/api/prospecting/activities?contactId=:id`; display a timeline of all prospecting touches for this contact (date, type, outcome, week reference) across all campaigns and weeks; show total touches count, last contacted date, and response rate (connected or replied outcomes / total attempts); this closes the loop between prospecting activity and CRM contact enrichment

### 12C — AI-Powered Target Prioritization

- [feature] [todo] Build AI prospecting target recommender — create GET `/api/prospecting/ai-recommendations` endpoint that: fetches all `marketTargets` for the org, cross-references with `crmProperties` (via state/region match) and `salesComps` (marina market data) to find marinas in target markets not yet in the pipeline; applies a priority score using: lead score (if a contact exists), market demographic data (median HHI from Census cache), days since last contact (from prospecting activities), asset size proxy (total slips from comps); returns a ranked list of recommended targets with reasoning; frontend: add a "Recommended Targets" section to `Overview.tsx` showing the top-10 with score, market, reason, and "Start Outreach" button that pre-enrolls in a campaign

- [feature] [todo] Build best-time-to-call intelligence — analyze historical prospecting activity outcomes from `crmProspectingActivities` grouped by hour-of-day and day-of-week; compute `connectRate` (connected / total calls) per time slot for the org; expose GET `/api/prospecting/best-call-times` returning a 5×8 heatmap matrix (Mon–Fri × 8am–5pm) with connect rate %; add a "Best Times to Call" heatmap card to `Workroom.tsx` and `Dashboard.tsx` so reps know when to prioritize their call blocks

### 12D — Market Target Intelligence Upgrade

- [feature] [todo] Upgrade market targets with geographic and demographic intelligence — `marketTargets` currently stores just name, region, states (text), and notes; extend with: `totalProperties` (count of CRM properties in that market), `activeDealCount` (count of deals in pipeline for that market), `avgLeadScore` (avg lead score of properties in that market), `populationGrowthPct` (from Census for states in target), `medianHHI` (from Census); compute these fields on GET `/api/prospecting/market-targets` using existing data; add a computed "Market Attractiveness Score" (0–100) shown on the market card; add to `Markets.tsx` a stats row below each market card

- [feature] [todo] Add market target heat map — in `Markets.tsx`, add a "Map View" toggle; render a Google Maps view with state/region polygons colored by market attractiveness score (green = high, yellow = medium, red = low); clicking a state polygon shows the market target card for that region; add a "Properties in Market" layer showing all CRM properties in that state as pins; add "Comp Activity" layer showing recent sales comps from that market; this gives the prospecting team a geographic overview of where they are focused vs. underweight

### 12E — Analytics & Conversion Funnel Completion

- [feature] [todo] Instrument a proper prospecting funnel with tracked events — the current analytics conversion funnel reads from raw deals data which is imprecise; create a `prospecting_funnel_events` table: `id`, `orgId`, `userId`, `contactId`, `campaignId`, `stage` enum('touched'|'connected'|'interested'|'meeting_set'|'qualified'|'deal_created'|'closed_won'), `occurredAt`, `metadata` JSONB; whenever a prospecting activity is logged with outcome='connected', insert a 'connected' event; when outcome='scheduled', insert 'meeting_set'; when a contact is marked interested, insert 'interested'; when a deal is created from a prospecting source, insert 'deal_created'; expose GET `/api/prospecting/funnel?period=30d` returning stage-by-stage counts; update `Analytics.tsx` to use this endpoint for the conversion funnel chart

- [feature] [todo] Add rep performance leaderboard to analytics — in `Analytics.tsx`, add a "Team Performance" tab (only visible if user has manager role); show a leaderboard table: rep name, calls made, emails sent, connect rate %, meetings set, deals created, pipeline $; sorted by deals created by default; allow time-period filter (this week / this month / this quarter / custom); GET `/api/prospecting/team-stats?period=` computing these metrics per `userId` from `crmProspectingActivities`; add sparkline charts per rep showing activity trend over the period; add quota attainment % column (calls made / weekly calls goal × weeks in period)

### 12F — Team & Territory Management

- [feature] [todo] Add territory assignment to market targets — extend `marketTargets` with `assignedUserId` FK to users; add an "Assign Rep" select on the market target card (only visible to manager role); when a rep is assigned to a market, their `Workroom.tsx` and `Overview.tsx` should pre-filter to show that market's properties and performance; add GET `/api/prospecting/market-targets/my-territories` returning the logged-in user's assigned markets; surface assigned territory labels on each prospecting week in the workroom

- [feature] [todo] Build weekly team quota dashboard — add a `prospecting/team` route accessible to managers; show each rep's quota attainment this week: calls goal vs. actual (progress bar), emails goal vs. actual, leads generated; highlight reps below 50% attainment with amber badge; highlight reps at 100%+ with green badge; sort by attainment %; allow manager to click a rep and see their week-by-week workroom view; GET `/api/prospecting/team-quotas?week=` returning per-user goal vs. actual for the specified week

### 12G — Campaign System Consolidation

- [feature] [todo] Consolidate duplicate campaign systems — the app has two separate campaign systems: `/api/prospecting/campaigns` (outreach campaigns with contact sequences) and `/api/marketing/campaigns` (marketing campaigns connected to Constant Contact/Mailchimp); add a `campaignType` field distinguishing 'outreach' (individual contact sequences, managed in Prospecting) from 'marketing' (broadcast email blasts, managed in Marketing); add navigation between them: in the Campaigns page, add a "Marketing Blasts" tab that renders the existing marketing campaign list; unify the `outreachTemplates` table as the shared template source for both — marketing campaigns can reference the same templates; deprecate the separate `/api/marketing/email-campaigns` endpoint and redirect to the unified templates system

### 12H — Prospecting ↔ Marina Map Integration

- [feature] [todo] Add prospecting target pins to marina map — in `client/src/pages/marina-map.tsx`, add a "Prospecting Targets" layer to the layer controls; when active, render `marketTargets` as colored boundary polygons (by state/region) and render `crmProspectingEntries` contacts as pins with activity status badges (Hot = red, Warm = yellow, Cold = blue, Never Contacted = grey); clicking a pin opens the existing EntityQuickPreviewPopover with prospecting summary (last contact date, total touches, campaign enrollment status); add "Start Outreach" button in the popover that enrolls the contact in a campaign

## 🏢 TIER 11 — CRM (Institutional-Grade Completion)

> **Diagnosis Summary — Current State: ~70% institutional-grade**
>
> **What works:** Extraordinary breadth — 192+ CRM API routes, 24 dedicated route files (crm-activities, crm-advanced-search, crm-associations, crm-extended, crm-intelligence, crm-notes, crm-pipeline-enhancements, crm-preview, crm-relationship-intelligence, crm-relationship-score, crm-saved-views, crm-summary, crm-timeline, deal-analytics, deal-dd, deal-health, deal-scoring, deal-sourcing, deal-workspace, lead-scoring, pipeline-analytics, pipeline-automation, pipeline-template, ai-deal-intelligence, red-flag). Core entities: Deals, Contacts, Companies, Properties — full CRUD + search + duplicate detection + merge. Multi-view pipeline (Kanban, List, Map, Gantt, Automations, Templates, Forecast). Google Calendar sync for activities and tasks. Email sequences backend with steps and enrollments. CSV import with preview, rollback. Red flags (fully wired). Deal scoring config. Lead scoring engine. 13 _wip components (5,457 lines) imported into production pages — most have backend routes already registered but are gated behind `_wip/`.
>
> **Critical gaps:** Email send integration still `mailto:` only (no in-app SendGrid send — Tier 1 already queued); 13 `_wip/` panels need graduation to production; no in-app email inbox for replies; property record missing rent roll KPI panel and demographics auto-load; prospecting → deal conversion path unclear; no IC (Investment Committee) memo auto-generation from deal; no LOI/offer/term sheet date tracking; no commission tracking for broker relationships; DealComparison page built but not linked from pipeline; CRM global smart-search component exists in `_wip` but not graduated; lead score not feeding into deal score.
>
> **Key files:** `server/routes/` (24 route files above), `client/src/pages/deal-detail.tsx`, `client/src/pages/pipeline.tsx`, `client/src/components/crm/` (50+ components), `client/src/components/crm/_wip/` (13 components, 5,457 lines).

### 11A — Graduate _wip Panels to Production

- [feature] [todo] Graduate `CrmListsManager.tsx` from _wip — backend routes `/api/crm/lists` are fully built (GET, POST, PATCH, DELETE, add/remove members); move `_wip/CrmListsManager.tsx` to `client/src/components/crm/CrmListsManager.tsx`; verify all API calls match the existing routes; wire the "Lists" tab in contacts, properties, and companies pages so users can add any entity to a named smart list; add list membership count badge to each record page header

- [feature] [todo] Graduate `pipeline-forecasting-panel.tsx` from _wip — the `pipeline-analytics-routes.ts` route file exists; verify the panel's API calls (`/api/pipeline/forecast` or similar) match actual routes; if routes are missing, implement them in `pipeline-analytics-routes.ts`: compute probability-weighted pipeline value by summing (deal value × close probability) grouped by month for next 12 months; move the component to production and render it in the Pipeline page "Forecast" tab instead of being gated

- [feature] [todo] Graduate `sla-tracking-panel.tsx` from _wip — check `crm-pipeline-enhancements-routes.ts` for SLA routes; if missing, add GET `/api/crm/sla/summary` (count of deals exceeding SLA per stage), GET `/api/crm/deals/:id/sla-status` (days in stage vs. stage SLA threshold), PATCH `/api/crm/pipeline-stages/:id/sla-days` (set stage SLA); move component to production; wire into the Deal Detail page as a visible panel (not hidden)

- [feature] [todo] Graduate `phase-gates-panel.tsx` from _wip — verify phase gate routes in `crm-pipeline-enhancements-routes.ts`; phase gates are completion criteria per deal stage; ensure GET `/api/crm/deals/:id/phase-gates` and PATCH `/api/crm/deals/:dealId/phase-gates/:gateId` exist; graduation: move to `client/src/components/crm/phase-gates-panel.tsx`; render visibly in deal workspace "Due Diligence" or "Checklist" section

- [feature] [todo] Graduate `deal-playbook-panel.tsx` from _wip — verify playbook routes in `deal-sourcing-routes.ts` or `crm-extended-routes.ts`; move to production; surface as a "Playbook" tab in the deal workspace; the panel provides stage-specific action checklists that guide the deal team through each pipeline stage

- [feature] [todo] Graduate `smart-search.tsx` from _wip — the `crm-advanced-search-routes.ts` route file exists; verify the component's query shape matches the advanced search route; move to `client/src/components/crm/SmartSearch.tsx`; add to the CRM top bar as a global search button (⌘K shortcut) that searches across all entity types simultaneously (deals, contacts, companies, properties) and shows categorized results; add to `CrmTopBar.tsx`

- [feature] [todo] Graduate `StageTemplateEditor.tsx` from _wip — verify `pipeline-template-routes.ts` routes; move to production; surface in Pipeline settings (gear icon → "Stage Templates") so admins can define re-usable pipeline templates with pre-set stages, SLA thresholds, phase gates, and playbook steps; wire "Apply Template" button when creating a new pipeline

### 11B — In-App Email Inbox & Threading

- [feature] [todo] Build in-app email inbox for CRM — email send integration is in Tier 1 (queued); once send works via SendGrid, implement inbound email parsing using SendGrid Inbound Parse webhook at POST `/api/email/inbound`; parse sender email, match to CRM contact by `fromEmail`, create an `crm_email_thread` record linking contact, company, and deal; store thread messages in `crm_email_messages` table (`threadId`, `direction: 'inbound'|'outbound'`, `subject`, `body`, `sentAt`, `openedAt`, `clickedAt`); expose GET `/api/crm/contacts/:id/email-threads` and GET `/api/crm/deals/:id/email-threads`

- [feature] [todo] Build email thread viewer UI — add an "Inbox" tab to both the contact record page and the deal detail page; render a Gmail-style thread list: subject, preview, date, direction badge (Sent/Received); clicking a thread expands the full conversation; add "Reply" button that pre-fills the email composer with the thread subject and recipient; show open/click status badges (Opened, Clicked, Not Opened) using data from `EmailTrackingStats.tsx` which already exists and calls tracking routes

### 11C — Property Record Cross-Module Enrichment

- [feature] [todo] Add Rent Roll KPI panel to property record — when a CRM property has a linked rent roll project (`rra_projects` table, `propertyId` FK), surface a "Rent Roll" tab in `PropertyRecordTabs.tsx`; fetch rent roll KPIs: current occupancy %, effective gross income (EGI), avg rent per unit, WALT (for commercial), last snapshot date; use GET `/api/rra/projects?propertyId=` to find the project, then GET `/api/rra/projects/:id/kpis`; show a "Open Rent Roll" button linking to the full RRA dashboard for that project; if no rent roll exists, show "Start Rent Roll Analysis" CTA

- [feature] [todo] Add Demographics auto-load to property record — as specified in Tier 10E (11E cross-reference); in `PropertyRecordTabs.tsx`, add a "Market" tab that auto-fetches demographics for the property's latitude/longitude using POST `/api/demographics/location` with 5-mile radius on tab activation; display: population, median HHI, market potential index score, site suitability score vs. org's default target demographics profile, OZ eligibility badge, flood zone risk badge; cache result with 7-day TTL linked to the property; add "Full Analysis" link to `/analysis/demographics` pre-populated with the property address

### 11D — Prospecting → Deal Conversion

- [feature] [todo] Build prospecting → deal pipeline conversion flow — in `ProspectingPage.tsx`, add a "Convert to Deal" button on each prospecting entry card; clicking opens a drawer that pre-fills: deal name (marina name), property (match or create new CRM property), stage (default first pipeline stage), asking price (from prospecting entry), and contact (if a contact was logged against the entry); on submit, creates a CRM deal + links the source prospecting entry via `sourceProspectingEntryId` FK; adds an activity log entry "Converted from prospecting" to the deal timeline; navigates to the new deal detail page; add GET `/api/crm/deals?sourceProspectingEntryId=` to check if already converted (prevents duplicates)

- [feature] [todo] Add prospecting entry preview on deal record — if a deal has a `sourceProspectingEntryId`, show a "Prospecting Origin" card in the deal detail sidebar with: source (cold call, email, referral, etc.), first contact date, number of touchpoints, original notes from the prospecting entry; this gives the deal team full context on how the deal was sourced

### 11E — LOI / Offer / Term Sheet Tracking

- [feature] [todo] Add LOI and offer milestone tracking to deal schema — add fields to `crmDeals`: `loiSubmittedAt` (timestamp), `loiAcceptedAt`, `loiRejectedAt`, `loiExpiresAt`, `offerPrice` (numeric), `offerSubmittedAt`, `termSheetSignedAt`, `psaExecutedAt`, `closingScheduledAt`; add a "Transaction Timeline" card to the deal detail panel that shows these milestones as a visual timeline (each milestone as a node: date, status — completed/pending/overdue); calculate days between milestones (e.g., LOI to PSA days) and show average benchmarks based on historical closed deals; render in `deal-detail-panel.tsx` as a collapsible section

- [feature] [todo] Add LOI/offer quick-entry form to deal workspace — in the deal workspace sidebar, add a "Transaction Milestones" card with inline date-pickers for each milestone; auto-update the deal stage when milestones are set (e.g., setting `loiAcceptedAt` moves deal to "Under LOI" stage if a stage with that name exists); PATCH `/api/crm/deals/:id` already exists — reuse it for milestone field updates; add a "Days to Close" countdown badge if `closingScheduledAt` is set

### 11F — Commission & Broker Relationship Tracking

- [feature] [todo] Add commission tracking to deals — add a `deal_commissions` table: `dealId`, `contactId` (broker), `side` ('buy'|'sell'|'both'), `commissionPct` (numeric), `commissionAmount` (numeric, computed from deal value), `status` ('pending'|'earned'|'paid'|'disputed'), `paidAt`, `notes`; add a "Commission" section to the deal detail panel listing all commission obligations with broker name, side, % and $, status; CRUD routes: GET `/api/crm/deals/:id/commissions`, POST, PATCH, DELETE; this is critical for tracking broker compensation obligations on closed deals and for relationship management

- [feature] [todo] Surface commission history on contact record — in `ContactRecordTabs.tsx`, add a "Commission History" tab for contacts with role Broker or Agent; show all deals where this contact has a commission record, total earned ($), total paid ($), average commission % per deal; this allows tracking broker relationships based on actual financial transactions not just activity logs

### 11G — IC Memo Auto-Generation

- [feature] [todo] Build Investment Committee memo auto-generation from deal — add an "Generate IC Memo" button in the deal workspace; clicking POST `/api/crm/deals/:id/generate-ic-memo` which: fetches the deal's financial data (from linked modeling project if present), property details (from linked CRM property), demographics (from saved demographics for the property), deal team notes, red flags, phase gate completion status; passes to the AI content service to fill a pre-built IC memo Document Builder template; returns a Document Studio doc ID; navigates to Document Studio to review/finalize the generated memo; the IC memo template should include sections: Executive Summary, Property Overview, Market Demographics, Financial Summary, Risk Factors, Deal Team Recommendation

### 11H — DealComparison Workspace Activation

- [feature] [todo] Activate Deal Comparison workspace — `DealComparison.tsx` (535 lines) and `deal-comparison-page.tsx` are fully built; add a "Compare Deals" button to the Pipeline page header and to the multi-select bulk operations bar; the button opens the comparison page (`/deal-comparison`) pre-populating selected deal IDs; verify the comparison component fetches the right data (deal financials, property data, demographics, modeling KPIs) and renders side-by-side; add a "Save Comparison" feature that snapshots the comparison to a `deal_comparison_snapshots` table for sharing with LPs

### 11I — Lead Score → Deal Score Unification

- [feature] [todo] Unify lead scoring and deal scoring into a single CRM score — currently `lead-scoring.tsx` (automation module, rules-based) and `deal-scoring.tsx` (config UI for IC weights) are parallel; add a `crmScore` computed field on each deal: weighted sum of (lead score at acquisition × 0.3) + (deal-stage-specific score × 0.7); the deal score evolves as the deal progresses (more weight on financial factors post-LOI vs. demographic factors pre-LOI); display a single "Deal Health Score" (0–100) badge on the deal kanban card and deal detail header; add trend indicator (↑↓→) showing whether score improved or declined since last week; POST `/api/crm/deals/:id/score/recalculate` to trigger recomputation

### 11J — Pipeline Analytics & Velocity Completion

- [feature] [todo] Complete pipeline velocity metrics — `client/src/pages/crm/PipelineVelocity.tsx` and `client/src/pages/crm/PipelineInsights.tsx` exist; verify they are calling real backend routes in `pipeline-analytics-routes.ts`; if routes are stubs, implement: `getAverageTimeInStage(orgId, pipelineId, stageId, last90days)` → avg days per stage across all deals; `getPipelineVelocity(orgId)` → (avg deal value × win rate × deals per month) / avg sales cycle days; `getConversionRateByStage(orgId)` → % of deals that advance from each stage vs. drop out; surface these in PipelineVelocity.tsx with benchmark comparison to prior quarter

- [feature] [todo] Build deal sourcing analytics dashboard — `deal-sourcing-routes.ts` exists; implement GET `/api/crm/analytics/sourcing` returning deals grouped by source (cold outreach, broker referral, prospecting, inbound, repeat seller, network) with count, avg deal value, avg time to close, win rate per source; add a "Deal Sourcing" tab to `DealAnalyticsPage.tsx` showing source mix donut chart, source performance table, and YoY sourcing trend by channel

## 🌍 TIER 10 — DEMOGRAPHICS (Institutional-Grade Completion)

> **Diagnosis Summary — Current State: ~55% institutional-grade**
>
> **What works:** 1,346-line CensusService pulling ACS 5-year estimates with population-weighted multi-tract radius aggregation; FRED state-level economic indicators; real drive-time isochrones (polygon-based); distance ring multi-analysis; weighted Site Suitability Score against user-saved Target Demographic profiles; 7 UI components (Suitability, Trends, Comparison, Business Environment, Market Potential, Daytime Population, Target Form); Census County Business Patterns via NAICS; 20+ API endpoints; PDF export; Document Builder token binding; project-location save.
>
> **Critical gaps:** No marina-specific demographic signals (boat ownership, waterfront lifestyle, wealth beyond HHI); CRM integration is theoretical not wired; SiteSuitabilityScore disconnected from the CRM lead scoring engine; no BLS MSA-level employment data; no Opportunity Zone overlay; no FEMA flood zone layer; no competitive density count; no boat registration data; no saved analysis history UI; no Excel export; MarketPotentialIndex formula is opaque/unlabeled; no demographics heatmap on marina map; no population growth → pro forma auto-inject.
>
> **Key files:** `server/services/census-service.ts`, `server/services/demographics-service.ts`, `client/src/pages/analysis/demographics/Index.tsx`, `client/src/components/demographics/` (7 components), API routes in `server/routes.ts` lines 32824–33303.

### 10A — Marina-Specific Demographic Signals

- [feature] [todo] Add boat ownership / recreational boating penetration to CensusService — ACS table B08301 includes "Boat, canoe, or kayak" as a commute mode; also fetch ACS table S0801 (commuting characteristics) for boat ownership proxy; additionally call the Census County Business Patterns for NAICS 441222 (Boat Dealers) and 713930 (Marinas) to show local marina industry employment; expose as new fields on `DemographicSummary`: `boatCommuterCount`, `boatingPenetrationPct`, `marinaEmploymentCount`; add to the Demographics page Population tab as a "Boating Community" sub-section with count, penetration %, and year

- [feature] [todo] Add boat registration data layer — integrate USCG/USMCA state boat registration counts; fetch from the Census Bureau's Recreation Survey or the USCG Recreational Boating Statistics API (public, no key required at `https://www.uscg.mil/Portals/0/...`); alternatively pull the published annual state-level totals as a static seed table `boat_registrations (state, year, registeredVessels)` updated yearly; expose as a `boatRegistrationRate` (vessels per 1000 residents) card in the demographics Population tab; compute trend if multi-year data is available

- [feature] [todo] Add wealth and lifestyle signal scoring — beyond median HHI, compute a "Waterfront Lifestyle Index" using: percent households with income >$150K (from ACS income distribution), percent owner-occupied housing (from ACS housing data), median home value (already fetched), and education (bachelor's+); normalize each to 0–100, weight equally, display as a single index score (0–100) with a gauge chart in the Market Potential tab; label clearly with methodology tooltip so institutional users understand the formula

### 10B — Opportunity Zone & Risk Overlays

- [feature] [todo] Add Opportunity Zone overlay to demographics map — seed a `opportunity_zones (tractFips, designation_year, state)` table from the IRS/Census OZ shapefile (public dataset: `https://www.cdfifund.gov/opportunity-zones`); on each demographics analysis, cross-reference the selected location's census tract FIPS against this table; display an "OZ Eligible" badge on the map circle and in the location card header when the tract is in an OZ; also show a tooltip explaining the tax benefit; register a GET `/api/demographics/opportunity-zone/:tractFips` endpoint

- [feature] [todo] Add FEMA flood zone risk indicator — integrate FEMA's National Flood Hazard Layer (NFHL) API (`https://msc.fema.gov/arcgis/rest/services/`); for each demographic analysis point, query the NFHL for the flood zone designation (AE, X, VE, etc.) within 500ft of the coordinates; display a flood risk badge ("Minimal", "Moderate", "High", "Coastal") with color coding in the location card header; add to the Site Suitability Score as an optional negative weight factor (user can toggle "Penalize flood zone" in TargetDemographicsForm); register GET `/api/demographics/flood-zone` accepting lat/lng

### 10C — BLS MSA-Level Employment Data

- [feature] [todo] Build BLS (Bureau of Labor Statistics) service — create `server/services/bls-service.ts`; use the BLS Public Data API v2 (`https://api.bls.gov/publicAPI/v2/timeseries/data/`) with a registered key (environment variable `BLS_API_KEY`); fetch MSA-level employment series by NAICS super-sector for a given MSA code; implement `getMSAEmploymentTrends(msaCode, years=5)` returning total employment, unemployment rate, and top-3 growing sectors by YoY % change; implement `getMSACode(latitude, longitude)` by cross-referencing Census CBSA delineation file (seed as `cbsa_delineations (countyFips, msaCode, msaName)` table); cache results in `demographicsCache` with 30-day TTL

- [feature] [todo] Surface BLS MSA employment in demographics UI — add a new "Employment" sub-tab in the demographics analysis (alongside Population, Income, Housing, Education); display: MSA name badge, total non-farm employment, unemployment rate (vs. state and national), top-3 growing sectors (name, YoY % growth, current employment count), a 5-year total employment trend line chart; register GET `/api/demographics/bls-employment?lat=&lng=`; show a "MSA: [Name]" label so users understand the geographic scope vs. the Census tract data shown elsewhere

### 10D — Competitive Density Analysis

- [feature] [todo] Build competitive marina density layer — within the demographics trade area query, count how many internal `salesComps` / CRM properties of type 'marina' exist within the specified radius using PostGIS `ST_DWithin`; also call Google Places API (if configured) for `type=marina` and `type=boat_rental` within the radius; return `{ internalMarinaCount, googlePlacesMarinaCount, nearestCompetitorMiles, competitorList: [{name, distanceMiles, type}] }`; add a "Competitive Landscape" card to the demographics page showing count, nearest competitor, and a mini list; register POST `/api/demographics/competitive-density` accepting `{ lat, lng, radiusMiles }`

- [feature] [todo] Add competitive density to Site Suitability Score — expose `minCompetitorDistanceMiles` and `maxCompetitorCount` as optional criteria in `TargetDemographicsForm.tsx` (with weight slider); score the location: if nearest competitor is > minDistance AND total competitors < maxCount, passes; surface in the SiteSuitabilityScore component criteria breakdown list; this makes the suitability score actually useful for site selection and prospecting

### 10E — CRM Integration (Property → Demographics)

- [feature] [todo] Wire "Run Demographics" from CRM property detail page — on the CRM property detail page (`client/src/pages/crm/properties/[id].tsx` or equivalent), add a "Demographics" tab that is visible when the property has latitude/longitude; this tab should auto-fetch demographics for the property's coordinates using POST `/api/demographics/location` with a 5-mile default radius; render a read-only summary: population, median HHI, market potential score, suitability score (if target demographics are configured), flood zone risk, and OZ eligibility; add a "Open Full Analysis" button that navigates to `/analysis/demographics` with the address pre-populated

- [feature] [todo] Auto-link CRM property demographics run to save as project location — when a user clicks "Open Full Analysis" from a CRM property, pass the property's `id`, `name`, `latitude`, `longitude` as query params to the demographics page; the demographics page should detect these params and pre-add the location to the analysis, auto-running the Census query; also offer to save it to any active modeling project associated with that property

### 10F — Lead Scoring Integration

- [feature] [todo] Connect SiteSuitabilityScore to CRM lead scoring engine — in `client/src/components/automation/lead-scoring.tsx`, the lead score is computed independently of the demographics suitability score; add a "Market Demographics Score" factor to the lead scoring model that reads from the most recent demographics analysis saved for that property's location; POST `/api/lead-scoring/demographics-factor` accepting `{ propertyId }` should look up the saved demographics for the property's coordinates, compute the weighted suitability score against the org's default target demographics profile, and return a 0–100 factor score; weight this factor at 20% of the overall lead score by default (configurable in lead scoring settings)

### 10G — Population Growth → Pro Forma Auto-Inject

- [feature] [todo] Extract population growth rate from Census historical trends and inject into pro forma — CensusService.getHistoricalTrends() already computes YoY population growth; when a user is on the Modeling workspace and their modeling project has a saved demographics location, show a "Sync Demographics" button in the pro forma revenue assumptions panel; clicking it reads the 5-year CAGR for population and household income growth from the saved demographics and pre-fills: revenue growth rate = population CAGR + 0.5% (configurable), market rent growth = income CAGR; add a provenance label "Based on [Location] 5-yr Census CAGR" next to the auto-filled value; POST `/api/demographics/project-locations/:locationId/pro-forma-inject` returning suggested growth rates

### 10H — Marina Map Demographics Heatmap Layer

- [feature] [todo] Add demographics heatmap overlays to marina map — in `client/src/pages/marina-map.tsx`, add a "Demographics" layer group to the existing layer controls; layers: "Median Income Heatmap" (choropleth coloring counties by median HHI using Census county-level data from a `county_demographics` seed table), "Population Density" (dot density overlay), "Boat Registration Rate" (state-level choropleth); seed `county_demographics (fipsCounty, state, medianHHI, population, populationDensity, year)` from ACS 5-year county-level bulk download; render as Google Maps Data layer (GeoJSON choropleth) or Polygon layer with fill-opacity proportional to value; add a legend showing the color scale

- [feature] [todo] Add Opportunity Zone layer to marina map — render OZ census tracts as a semi-transparent green polygon overlay on the marina map; fetch GeoJSON boundaries from the seeded `opportunity_zones` table joined to Census tract boundaries (seed tract boundaries as simplified GeoJSON in `census_tract_boundaries` table for the top 20 marina states); toggle via LayerToggles component alongside existing layers; clicking an OZ polygon shows a tooltip with tract FIPS and "Opportunity Zone — Tax-Advantaged Investment"

### 10I — Saved Analysis History & Export

- [feature] [todo] Build Saved Demographics Analyses list view — create a new page at `/analysis/demographics/saved` (or a drawer within the main demographics page); query all `demographicsProjectLocations` records across all projects for the org; display as a table: location name, address, trade area type (distance/drivetime), radius/minutes, last analyzed date, linked project name, suitability score (if computed), quick actions (re-run, open, delete); add a "Recents" section to the demographics page sidebar showing the 5 most recent analyses

- [feature] [todo] Add Excel export for demographics analysis — in `client/src/pages/analysis/demographics/Index.tsx`, add an "Export Excel" button alongside the existing ExportPdfButton; use ExcelJS on the server; POST `/api/demographics/export/excel` accepting the full demographics payload; generate a workbook with sheets: "Summary" (all KPI cards), "Population" (age distribution, generational cohorts, race/ethnicity tables), "Income" (income distribution, HHI, per capita), "Education & Employment" (education levels, industry distribution), "Housing" (housing stats), "Business Environment" (County Business Patterns by NAICS sector); trigger file download

### 10J — MarketPotentialIndex Transparency & Methodology

- [feature] [todo] Make MarketPotentialIndex formula transparent and configurable — the current `MarketPotentialIndex.tsx` computes a proprietary score from population, income, education, employment density; add a "Methodology" info popover (ⓘ icon) that lists each factor with its weight (e.g., "Median HHI: 30% weight — national benchmark $75K"), the national benchmark used, and the formula; add a "Customize Weights" mode that lets the user adjust the 4 factor weights (must sum to 100%) and saves the preference; factor weights should be stored in a `marketPotentialConfig` user preference (localStorage or DB); the score label should say "Market Potential Index (MPI)" not just "Market Potential" to use consistent institutional terminology

### 10K — Historical Trend Accuracy

- [feature] [todo] Fix and validate MarketTrendAnalysis historical data — the `MarketTrendAnalysis.tsx` component calls FRED for state-level trends; FRED covers state-level unemployment (STATEUUR) and income (MEHOINUSXXX) but not local-level; clearly label in the UI whether each trend line is "State-Level (FRED)" or "Trade Area (Census ACS)"; for trade-area-specific trends, call the existing `getHistoricalTrends()` Census endpoint (POST `/api/demographics/historical-trends`) which fetches ACS 5-year estimates; display the data vintage label (e.g., "ACS 2023 5-Year Estimates") on every chart so institutional users know the currency of the data; add a data freshness indicator (last updated date) to each chart card header

## 🔵 TIER 13 — DEAL WORKSPACE / VDR (~65% Institutional-Grade)

> **What's solid:** DD Checklist (1,755-line routes) — full CRUD, templates, status, comments, file linking, history, Excel/PDF export, deadline sync. VDR — FolderTree, DocumentList, VersionHistoryDrawer, ExternalUsersTab, DiligenceRequestsTab, AuditLogViewer, AnalyticsDashboard, PermissionViewer. CA/NDA gating — confidentialityAgreements table with execution tracking; VDR gated behind executed agreement. Deal team management — member invite, permissions, revoke. Milestones + ICS export. DD Status Report wired. Competitive tracker + Deal scoring wired. DD automation rules engine (914-line routes). Capital markets backend queryable by dealId. DD findings CRUD backend (findings + summary + KPI + team endpoints). VDR activity tracking routes. Guided deal flow wizard. Cross-module summary endpoint exists.
>
> **Critical gaps:** Financials tab shows only a navigation link — no embedded financial summary. DD Findings panel (`DdFindingsPanel.tsx`) exists but is NOT imported in `[workspaceId].tsx` — backend fully built, UI dark. No Capital Markets tab despite full lender/term-sheet/debt routes queryable by dealId. No LP Portal connection from workspace. No tax waterfall visualization. Red Flags and Phase Gates not wired into workspace. DD Fees Tracker and DD KPI Dashboard components exist but not imported. No demographics or comps snapshot in workspace overview. VDR AnalyticsDashboard built but not embedded. No document watermarking for external buyers. No AI advisor panel in workspace. Two competing deal-detail views (`deal-detail.tsx` + `[workspaceId].tsx`) create confusion.

### 13A — Embedded Financial Summary in Workspace Financials Tab

- [feature] [todo] Replace the dead "Linked modeling project ID" Financials tab with a real embedded financial summary — query `/api/modeling/projects/:id` for the linked project; display a KPI grid: Unlevered IRR, Levered IRR, Equity Multiple (MOIC), Total Return, NOI (year 1), Cap Rate, Purchase Price, Price/Unit or Price/Slip (asset-class aware); below the KPI grid, add a mini scenario bar (Base / Bull / Bear) that switches the displayed IRRs; add a "→ Open Full Model" button that navigates to the modeling project workspace; if no modeling project is linked, show a "Link or Create Modeling Project" CTA with a search dialog querying `/api/modeling/projects`
- [feature] [todo] Add property-level Rent Roll KPI strip to the workspace Financials tab — when the workspace is linked to a CRM property (`crmPropertyId`), query the latest rent roll snapshot for that property; display a compact row of metrics: Occupancy %, EGI (TTM), Total Slips (marina) or Units (multifamily) or Keys (hotel), WALT (months), top 3 tenants by rent share; these metrics appear between the headline KPI grid and the "Open Full Model" button; if no rent roll is linked, render a "Link Rent Roll" call-to-action

### 13B — DD Findings Panel — Activate and Wire

- [feature] [todo] Wire `DdFindingsPanel.tsx` into the workspace — add a "Findings" sub-tab within the Diligence tab (or promote it to a standalone top-level tab); the component already queries `/api/findings?workspaceId=:id` and `/api/findings/summary/:workspaceId`; add findings-count badge to the workspace overview KPI section showing open/critical findings count; connect the "Create Finding" action to assign severity (Critical / High / Medium / Low / Informational), category (Legal, Financial, Environmental, Title, Operations, Insurance), assignee, and due date
- [feature] [todo] Wire `DdKpiDashboard.tsx` into the dd-status tab of the workspace — the component queries `/api/dd/kpi/:workspaceId`; render it as a dashboard above the DD Status Report showing: items by status (donut), overdue items (count + list), avg days-to-complete, completion velocity (items closed per week), team contribution (bar by assignee); if no DD project is linked, show empty state with "Create DD Project" CTA
- [feature] [todo] Wire `DdFeesTracker.tsx` into the workspace — add it as a collapsible "Professional Fees" section within the dd-status tab; the component tracks legal, accounting, environmental, and other third-party fees incurred during DD; it queries its own fees table by workspaceId; display total fees incurred and budget vs. actual comparison

### 13C — Capital Markets Tab in Workspace

- [feature] [todo] Add a "Financing" tab to `client/src/pages/workspaces/[workspaceId].tsx` — place it between "Scoring" and "Team"; the tab renders three panels: (1) Lender Tracker — query `GET /api/capital-markets/lender-deals/deal/:dealId`; display each lender with status chip (Contacted, Term Sheet Received, Under Review, Declined, Closed), contact name, loan amount, rate indication, last updated; add "Add Lender" button; (2) Term Sheet Comparison — query `GET /api/capital-markets/term-sheets/compare/:dealId`; render a comparison table with columns: Lender, Loan Amount, Rate, LTV, DSCR, Origination Fee, Expiry Date, Status; highlight the best rate in green; add "Select Term Sheet" action; (3) Debt Structure Summary — query `GET /api/capital-markets/debt/deal/:dealId`; show total debt, senior/mezz/preferred equity breakdown in a stacked bar; if no lenders are tracked, show empty state with "Track First Lender" CTA
- [feature] [todo] Add "Financing Snapshot" card to the workspace overview tab — compact version showing: total capitalization (equity + debt), LTV, primary lender name, term sheet status; query the same capital markets endpoints; this card appears alongside the existing KPI cards at the top of the overview

### 13D — Equity Waterfall + Distribution Visualization in Workspace

- [feature] [todo] Add a "Waterfall" section to the workspace Financials tab — below the financial KPI grid, query `GET /api/tax-waterfall/:workspaceId` (or the modeling project's waterfall if linked); display a waterfall distribution table: preferred return %, promote tier %, GP catch-up, LP/GP split at each hurdle, projected distributions by exit year; use a stacked bar chart (recharts) showing LP vs. GP distributions across 3 exit scenarios (Y3, Y5, Y7); label each tier with the hurdle rate and split ratio
- [feature] [todo] Add total LP distributions and GP promote as KPI chips to the workspace financial KPI grid — LP Net IRR, GP Promote ($), LP Equity Multiple; these should update when the scenario bar switches between Base / Bull / Bear

### 13E — LP Portal Integration from Workspace

- [feature] [todo] Add a "Share with LPs" panel to the workspace documents tab — an accordion section below the VDR tree; shows which LPs currently have visibility into this deal (query LP portal routes by dealId); add "Add LP Visibility" button that lists all LPs from the LP portal and lets the user toggle access by fund/LP; when access is granted, LP gets notified via email digest
- [feature] [todo] Build "Deal Package Builder" in the workspace — a dialog triggered from the overview or documents tab: "Generate LP Package"; the dialog lets the user select: (a) which VDR documents to include (checkbox list with folder navigation), (b) whether to include the financial model PDF (triggers `/api/modeling/projects/:id/export-to-vdr`), (c) whether to include the demographics analysis PDF; clicking "Publish Package" bundles the selections into a named package record linked to the workspace; the package is then accessible from the LP portal deal view
- [feature] [todo] Add LP View Count metric to workspace overview — query LP portal activity by dealId; show a small "LP Engagement" card: unique LPs who have viewed the deal, total document views by LPs, last LP access timestamp; this gives deal teams real-time visibility into LP interest

### 13F — Red Flags, Phase Gates, and Deal Health Gauge

- [feature] [todo] Surface Red Flags panel in the workspace overview tab — import and render `RedFlagsPanel` (currently used in deal-detail.tsx) directly in the overview tab of `[workspaceId].tsx`; the panel queries deal-level red flags (stale deal >30 days, missing DD items, no linked rent roll, no financing tracked, no VDR documents); each flag has a severity badge and a one-click remediation link (e.g., clicking "No financing tracked" opens the Financing tab); display red flag count in the workspace breadcrumb header as a warning badge
- [feature] [todo] Surface Phase Gates panel in the workspace overview tab — import `PhaseGatesPanel` (currently in deal-detail.tsx / _wip/); phase gates enforce formal IC approval before deal stages transition (e.g., LOI Authorized → Under Contract requires IC memo submitted and 2 senior approvals); each gate shows: status (Open / Pending Approval / Approved / Waived), approvers required, approvers who have responded, date approved; gate transitions are logged in the workspace audit log
- [feature] [todo] Build Deal Health Gauge composite score for the workspace overview — compute a 0–100 deal health score from: DD checklist completion % (25 pts), VDR document count vs. workspace template minimum (20 pts), financing status (term sheet received = 15 pts, under contract = 20 pts), days since last team activity (>14 days = -10 pts), open red flags (-5 pts each), phase gate status (on-track = 10 pts, overdue = -10 pts); render as a semicircle gauge (recharts RadialBarChart) with color bands (red/yellow/green); show sub-score breakdown in a tooltip; store score in a `dealHealthScores` table (workspaceId, score, breakdown JSON, computedAt) for trend tracking

### 13G — Demographics + Comps Snapshot in Workspace Overview

- [feature] [todo] Add Trade Area Demographics card to workspace overview — when the workspace is linked to a CRM property, query `/api/demographics/analysis` using the property's lat/lng and a 10-mile radius; display a compact card: Population (5mi), Median HHI (5mi), Boat Registration Rate (state), MPI Score, OZ designation (yes/no); show a mini sparkline for population growth trend; add a "→ Full Demographics Analysis" link that opens the demographics module pre-loaded with the property's location
- [feature] [todo] Add Comparable Transactions card to workspace overview — query `/api/analysis/comps?propertyType=marina&radiusMiles=50&lat=:lat&lng=:lng` using the linked property's coordinates; display the 5 most recent comparable sales: address, sale date, price, cap rate, price/slip; show avg cap rate and avg price/slip for the comps set as summary chips; add "→ View All Comps" link to the CRM comps analysis page

### 13H — VDR Upgrades: Analytics Dashboard + Document Watermarking + Diligence Requests

- [feature] [todo] Wire `VdrAnalyticsDashboard` into the workspace documents (VDR) tab — the component (`client/src/components/vdr/AnalyticsDashboard.tsx`, 254 lines) tracks: total documents, uploads by folder category, external user view counts per document, download events, most-viewed documents; render it as a collapsible "VDR Analytics" section at the top of the documents tab (collapsed by default); it already queries `/api/vdr/activity` and `/api/vdr/activity/metrics`
- [feature] [todo] Implement document watermarking for external VDR access — when an external user (buyer, attorney) downloads a PDF from the VDR, intercept the download server-side and stamp a watermark: "CONFIDENTIAL — [External User Name] — [Date]" as a diagonal gray text overlay; use `pdf-lib` to apply the watermark; the watermark content pulls the external user's name from the `workspaceMembers` table; add a workspace-level toggle in the VDR settings: "Require watermark on external downloads" (default: on); all external downloads are logged in the VDR audit log regardless
- [feature] [todo] Complete the diligence requests workflow end-to-end — the `DiligenceRequestsTab.tsx` (368 lines) already renders a request list; ensure the backend routes for creating/fulfilling diligence requests are wired: POST `/api/workspaces/:id/diligence-requests` (creates a request to a named party to upload a specific document); GET returns all requests for the workspace; PATCH sets status to Fulfilled/Cancelled; on creation, send a notification email to the requested party with a secure upload link (one-time token, expires in 7 days) that lets them upload directly to the correct VDR folder without logging in

### 13I — AI Advisor Panel in Deal Workspace

- [feature] [todo] Embed an AI Advisor panel in the workspace — add a floating "Ask AI" button (bottom-right) on `[workspaceId].tsx` that opens a drawer panel; the panel renders the existing AI chat component with workspace-specific context injection; context includes: deal name, asset class, asking price, linked modeling project headline IRR and cap rate, DD checklist completion %, open red flags count, VDR document count, upcoming milestone deadlines, trade area demographics summary, linked rent roll occupancy; pre-populate 4 suggested questions: "What DD items are overdue?", "Summarize the deal financials", "What are the key risks?", "What's the LP distribution at exit?"; wire to existing `/api/ai/advisor/chat` route with the workspace context payload in the system message

### 13J — Deal Progress Email Digest + View Consolidation

- [feature] [todo] Build weekly deal activity digest email for the deal team — add a cron job (`node-cron`, every Monday 8am) that generates a digest for each active workspace: new documents uploaded (count + names), DD checklist items completed this week, upcoming milestone deadlines in the next 14 days, new findings added, days since last activity; format the email using an HTML template (SendGrid); send to all internal workspace members; add a workspace-level toggle: "Weekly Digest Emails" (default: on) in workspace settings; store the last-sent timestamp in the workspace record
- [feature] [todo] Consolidate `deal-detail.tsx` and `[workspaceId].tsx` into a single authoritative deal room — `deal-detail.tsx` (757 lines) and `[workspaceId].tsx` (788 lines) have overlapping functionality; the workspace detail page should be the canonical deal room; audit `deal-detail.tsx` for any panels not yet in `[workspaceId].tsx` and port them; then redirect `/deal-detail/:id` to `/workspaces/:workspaceId` (looking up workspaceId by dealId); remove `deal-detail.tsx` from routing once all content is migrated; update breadcrumb and sidebar navigation links to point to `/workspaces/:id`

## 🟣 TIER 14 — AI ADVISOR CHATBOT (~60% Institutional-Grade)

> **What's solid:** `ai-assistant.tsx` (818 lines) — full chat UI with streaming, markdown rendering, 8 advisory modes (general, critique, risk_analysis, benchmark_comparison, options_analysis, decision_memo, stress_test, next_actions), deal comparison mode, conversation history sidebar, thumbs-up/down feedback, page-aware suggested questions. `ai-assistant-service.ts` (834 lines) — GPT-4o chat + streaming, advisory mode system prompts, entity data enrichment (deal/modeling_project/property/dd_project), tenant context injection (active deals, models, DD projects, comps), investment criteria injection from buy-box, advisor persona customization hook, deal comparison data fetch. RAG pipeline (`knowledge-base-service.ts`, 386 lines): text-embedding-3-small embeddings, sentence chunking with overlap, cosine similarity retrieval from `ai_knowledge_chunks`, global cross-org knowledge table. Conversation persistence in DB. Spending guard with monthly token budget enforcement. AI accessible globally from every page via `App.tsx`.
>
> **Critical gaps:** OpenAI function calling tools are fully defined in `advisor-tools.ts` (extractKpisFromDocument, addFinding, addRecommendation, searchDocuments) but the `tools:` parameter is never passed to `openai.chat.completions.create` — the AI is incapable of taking any action in the app. Entity enrichment only fetches one raw DB row with no computed metrics — the AI knows "you're viewing Deal X" but not "Deal X has 35% DD completion, 8.2% cap rate, $4.2M NOI, 72% occupancy." RAG only covers manually uploaded text; VDR documents (PDFs, rent rolls, financials) are never auto-ingested. 10+ pages have no page context strings (workspaces, deal-workspace, demographics, prospecting, capital-markets, document-studio). `ai-deal-intelligence-routes.ts` (836 lines) and `ai-underwriting-routes.ts` (408 lines) are separate AI subsystems that do not connect to the chat advisor. Knowledge base admin page is text-only with no PDF upload, no URL scraping, no citation trail. Suggested questions are hardcoded strings. No advisor persona configuration UI. Token spending has no user-facing dashboard. No voice input, no inline document upload in chat.

### 14A — Wire OpenAI Function Calling Tools

- [feature] [todo] Pass `advisorTools` to the OpenAI completions API and handle tool execution in the chat loop — in `ai-assistant-service.ts`, add `tools: advisorTools` and `tool_choice: 'auto'` to the `openai.chat.completions.create` call in both the `chat()` and `chatStream()` functions; after receiving the response, check `response.choices[0].message.tool_calls`; if tool calls exist, execute them via `executeAdvisorTool()` from `advisor-tools.ts`, append the tool result as a `tool` message, and make a second OpenAI call to get the final response incorporating the tool output; update the streaming path to handle partial tool call chunks; log all tool calls (tool name, arguments, result) in the conversation message record for auditability
- [feature] [todo] Expand the advisor tools set beyond the existing 4 — add tools that unlock real cross-module actions: `getDdChecklistStatus` (returns checklist completion % and overdue items for a workspace), `getRentRollSummary` (returns occupancy, EGI, WALT for a linked property), `getFinancialModelOutputs` (returns IRR, MOIC, cap rate, NOI from a linked modeling project), `getOpenRedFlags` (returns all open red flags for a deal workspace), `getUpcomingMilestones` (returns milestone deadlines in the next 30 days), `createCrmNote` (adds a note to a CRM contact/deal/property record); each tool accepts a `workspaceId` or `dealId` parameter; tool results are injected into the next AI turn and cited in the response

### 14B — Deep Entity Context Injection

- [feature] [todo] Upgrade `enrichEntityData()` to inject computed deal metrics, not just raw DB rows — when entity type is `deal`: join to the linked modeling project and pull IRR, equity multiple, NOI (year 1), cap rate; join to the linked workspace and pull DD checklist completion %, overdue items count, VDR document count, open red flags count, latest milestone deadline; join to the linked property and pull occupancy %, total slips; include capital markets status (lender count, term sheet received boolean, debt amount); format all values in the system prompt as a structured "Deal Room Snapshot" block instead of a raw JSON blob
- [feature] [todo] Add `workspace` as a supported entity type in `enrichEntityData()` — when the user is viewing `/workspaces/:id`, extract the workspaceId from the URL path in `entityContext` (in `ai-assistant.tsx`) and set `entityType: 'workspace'`; in the service, fetch: workspace name, deal stage, CA execution status, DD project completion %, VDR folder count and document count, upcoming milestones (next 3), team member count, days since last activity, linked modeling project headline IRR; format as a "Workspace Snapshot" in the system prompt
- [feature] [todo] Upgrade entity injection for modeling projects — when entity type is `modeling_project`, fetch the full DCF output: all scenario IRRs (Base/Bull/Bear), equity multiple, hold period, exit cap rate, year-1 NOI, total equity required, LTV; also pull the linked property's rent roll summary (occupancy, EGI); inject this as a structured "Financial Model Snapshot" in the system prompt so the AI can answer specific "what if" questions about the model's assumptions

### 14C — VDR Document Intelligence (RAG Over Deal Documents)

- [feature] [todo] Auto-ingest VDR documents into the org's RAG knowledge base when they are uploaded — in `workspace-routes.ts`, after a successful VDR upload (route: POST `/api/workspaces/:id/vdr/upload`), trigger an async background job that extracts text from the uploaded file using `pdf-parse` (for PDFs) or reads the text content directly (for .txt, .csv); call `ingestDocument()` from `knowledge-base-service.ts` with the extracted text, tagged with `sourceType: 'vdr_document'`, `sourceDocumentId`, and `workspaceId`; store the VDR document name and folder path in the knowledge chunk metadata so they can be cited in AI responses
- [feature] [todo] Show document citations in AI responses when RAG chunks from VDR documents are retrieved — the `chat()` function already returns `ragChunkIds`; look up the source document name for each retrieved chunk and append a "Sources:" section to the AI response listing document names with links to the VDR folder; in `ai-assistant.tsx`, render citations as clickable chips below the message that navigate to the VDR documents tab of the relevant workspace
- [feature] [todo] Add P&L and rent roll auto-ingestion to RAG — when a P&L is parsed via the P&L parser (`/api/pnl/parse`) or a rent roll is imported, automatically ingest the structured output (not the raw PDF) into the org's knowledge base as a summary document: "Rent Roll for [Property] — occupancy X%, EGI $Xk/yr, top tenants: ..."; this makes the AI aware of uploaded financial documents without requiring manual knowledge base entry

### 14D — Complete Page Context Map + Dynamic Context

- [feature] [todo] Complete the `PAGE_CONTEXT` map in `ai-assistant-service.ts` with all missing pages — add entries for: `/workspaces` (viewing deal workspace list), `/workspaces/:id` (in a specific deal workspace — include dynamic workspace name from entity context), `/deal-workspace` (deal pipeline dashboard), `/analysis/demographics` (demographics intelligence module), `/prospecting` (prospecting and campaign management), `/capital-markets` (capital markets and lender tracking), `/document-studio` (document and marketing material builder), `/marketing` (marketing campaigns), `/operations` (property operations and budgeting), `/marina-map` (marina property map), `/knowledge-base` (AI knowledge base management), `/settings` (platform settings); for workspace pages, generate the context string dynamically using the workspace entity data rather than a static string
- [feature] [todo] Replace static suggested questions with dynamically generated ones from live context — create a new server function `getDynamicSuggestions(orgId, currentPage, entityData)` that generates 4 context-aware suggested questions based on actual live data; examples: if a deal has overdue DD items → "You have {N} overdue DD items — should I prioritize them?"; if a deal hasn't been updated in 14 days → "Deal X has been in '{stage}' for {N} days — want a risk analysis?"; if a modeling project cap rate differs from comps avg by >100bps → "Your pro forma cap rate is {X}% vs. {Y}% comps avg — is that justified?"; implement as a lightweight structured query (no LLM call) using live data thresholds; cache per-user for 5 minutes

### 14E — Knowledge Base Admin Upgrades

- [feature] [todo] Add PDF file upload to the knowledge base — in `client/src/pages/knowledge-base.tsx`, add a file upload input (accept: .pdf, .txt) alongside the existing text area; on submit, send the file as multipart form data to a new route `POST /api/ai-assistant/knowledge/upload`; the route uses `multer` to receive the file, extracts text using `pdf-parse` for PDFs, then calls `ingestDocument()` with the extracted text; show an ingestion progress indicator (chunking → embedding → ready) with the final chunk count
- [feature] [todo] Add URL scraping to the knowledge base — in the knowledge base upload dialog, add a "Ingest from URL" tab; user enters a URL; the server route `POST /api/ai-assistant/knowledge/scrape` fetches the URL, strips HTML tags using a lightweight parser (`cheerio`), extracts the visible text, and ingests it as a knowledge document; useful for ingesting market reports, CoStar summaries, or regulatory documents from public URLs
- [feature] [todo] Add citation trail to the knowledge base page — for each knowledge document, show which AI conversations retrieved chunks from it (query the `ai_conversation_messages` table for messages with `rag_chunk_ids` containing chunk IDs from that document); display as a count: "Retrieved in 12 conversations"; add a "Retrieval Activity" column to the document list table; clicking the count opens a drawer showing the conversation excerpts where that document was cited

### 14F — AI Deal Intelligence and Underwriting Routes Integration

- [feature] [todo] Surface `ai-deal-intelligence-routes.ts` (836 lines) output in the Deal Workspace — these routes produce AI-powered deal scoring, risk flags, and market positioning analysis; identify all routes (audit the file) and wire their output into the workspace overview tab under a new "AI Intelligence" section showing: AI deal score (0–100), top 3 AI-identified risks, AI market positioning summary (premium/discount to comps), and AI recommended next action; each section should have a "Refresh Analysis" button that calls the appropriate route
- [feature] [todo] Surface `ai-underwriting-routes.ts` (408 lines) output in the Financial Modeling workspace — these routes produce AI-assisted underwriting analysis (assumption validation, stress scenarios, sensitivity flags); wire their output into the modeling project workspace as a floating "AI Review" panel showing: which assumptions are flagged as aggressive vs. conservative, which scenarios have negative equity returns, and suggested sensitivity ranges based on comps; each flag should link to the relevant input row in the model
- [feature] [todo] Connect CRM intelligence routes (1,183 lines) to the AI chat advisor — `crm-intelligence-routes.ts` produces contact risk scoring, relationship health scores, and engagement velocity metrics; expose these as advisor tools: when a user asks "Is this contact cold?", the AI should call a `getCrmContactIntelligence` tool that queries these routes and returns the contact's engagement score, days since last activity, and relationship health summary; similarly wire `crm-relationship-intelligence-routes.ts` (613 lines) company relationship mapping into the chat

### 14G — Advisor Persona Configuration UI

- [feature] [todo] Build Advisor Persona configuration UI in Settings — add a "AI Advisor" section to the platform settings page; fields: Advisor Name (default: "Marina Advisor"), Firm Name, Investment Focus (text describing the firm's strategy: "Institutional marina and RV park acquisitions in the Sun Belt"), Response Style (select: Formal / Conversational / Concise), Preferred Units (imperial/metric), Custom Instructions (free text, max 500 chars: "Always flag regulatory risks. Prefer IRR over cap rate as primary metric."); save to the `advisor_persona` table queried by `getAdvisorPersona()` which already exists in the service; show a live preview of the current persona system prompt at the bottom of the settings panel
- [feature] [todo] Add per-mode response quality tracking to the knowledge base / settings page — show a table of all 8 advisory modes with their positive/negative feedback counts (already tracked via `getFeedbackStats()`); highlight modes with >20% negative feedback in red; add a "Recalibrate" button that opens a modal to add custom instructions for that specific mode (stored per-mode in the persona table)

### 14H — Inline Document Upload and Voice Input

- [feature] [todo] Add inline file upload to the AI chat input — add a paperclip icon button next to the text input in `ai-assistant.tsx`; clicking opens a file picker (accept: .pdf, .txt, .csv); the selected file is temporarily processed: PDF text is extracted client-side using `pdfjs-dist` or sent to a new endpoint `POST /api/ai-assistant/quick-analyze`; the extracted text is prepended to the user's message as context for that turn only (not permanently ingested); show a "Analyzing [filename]..." loading chip while processing; display the filename as an attachment chip in the message thread
- [feature] [todo] Wire voice input to the AI advisor using the existing audio integration — `server/replit_integrations/audio/` already has a transcription client; add a microphone button to the chat input in `ai-assistant.tsx`; on click, start recording (Web Audio API + MediaRecorder); on stop, send the audio blob to `POST /api/ai-assistant/transcribe` which calls the Replit audio transcription service; populate the transcribed text into the input field; show a recording animation while listening; this enables hands-free deal analysis while walking a property

### 14I — AI Token Usage Dashboard

- [feature] [todo] Build AI usage dashboard at `/settings/ai-usage` — query the `ai_usage_logs` table (already populated by `trackAIUsage()` in the spending guard); display: total tokens this month (input + output separately), estimated cost this month (using the cost calculation already in `spending-guard.ts`), tokens by user (bar chart, top 10 users), tokens by advisory mode (pie chart), top 10 most expensive queries (by input+output tokens, with message preview), daily token trend (line chart, last 30 days); add a "Budget Remaining" progress bar showing current month spend vs. monthly limit from `ai_spending_limits`; add "Set Budget" button that lets the admin change the monthly limit
- [feature] [todo] Add proactive budget alert emails — when monthly spend reaches 80% of the limit, send an email via SendGrid to all org admins: "Your AI Advisor has used 80% of your monthly budget ($X of $Y). Adjust your limit in Settings → AI Usage."; use the existing spending guard's `hardLimitReachedAt` field to also send an alert when the budget is fully exhausted; add a dismissible banner in the app when the org is within 10% of the limit

### 14J — AI-Assisted IC Memo and Document Studio Integration

- [feature] [todo] Wire the AI advisor conversation history into the Document Studio IC Memo builder — when generating an IC memo in the Document Studio, add an "Import from AI Advisor" button that opens a conversation picker; the user selects a conversation from their AI chat history (listed by page and date); the AI extracts the key structured outputs from that conversation (deal summary, risk factors, investment thesis, recommended next actions) and pre-fills the corresponding IC memo sections; this closes the loop between AI analysis and formal document generation
- [feature] [todo] Add AI-generated deal narrative to the workspace overview tab — add a "Generate AI Summary" button to the workspace overview; clicking calls a new endpoint `POST /api/workspaces/:id/ai-summary` which gathers the full workspace context (deal data, DD status, financial model outputs, VDR doc count, team members) and sends it to GPT-4o with the `decision_memo` advisory mode prompt; the response is a 2–3 paragraph executive summary of the deal's current status, key risks, and investment thesis; store the result with a `generatedAt` timestamp and display it as a collapsible "AI Executive Summary" card at the top of the overview tab; tag it with "AI-Generated — {date}" to ensure provenance transparency

## 🔍 AUDIT TASKS

- [audit] [todo] Full connectivity audit — verify every feature in Connectivity Matrix is wired end-to-end
- [audit] [todo] Empty state audit — check every page and tab for blank screen conditions

## Completed
- [spec] [done] Spec IC Deal Review Deck — section layout, token map, PDF output route
- [migration] [done] Create document_templates and document_renders tables for Document Studio
- [spec] [done] Spec the shared token substitution engine for Document Studio
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
- [feature] [failed] Build IC Deal Review Deck — token resolver extensions, 3 API routes, section renderer, frontend generate flow — see agents/specs/ic-deal-review-deck-spec.md — 
- [feature] [todo] Implement Email Send Integration for Workflow Automation — see agents/specs/email-send-integration-spec.md — 

