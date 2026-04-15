# Vantage Platform

## Overview
Vantage is a comprehensive full-stack platform designed to manage the entire lifecycle of marina acquisition projects, from initial lead generation through to project completion. It unifies CRM functionalities with advanced Due Diligence Tracking and a robust deal pipeline, centralizing complex marina transaction management. The platform aims to enhance efficiency, provide analytical insights for successful acquisitions, and includes capabilities such as Rent Roll management, Sales Comparables analysis, Modeling Projects with an Exit Strategy Suite, AI-powered Document Intelligence, Marketing automation, Fuel Sales, Ship Store management, and a secure Virtual Data Room (VDR).

## User Preferences
Preferred communication style: Simple, everyday language.

**Future: Pricing Strategy (not yet implemented)**
- 3 tiers + Enterprise: Starter ($249/mo, 1 seat), Professional ($749/mo, 5 seats), Institutional ($1,499/mo, 15 seats), Enterprise (custom $2,500+/mo, unlimited seats)
- Per-seat add-ons ($50-75/mo), per-asset-class add-on ($99/mo), AI doc processing overages, annual billing discount (15-20%)
- Competitive positioning: below combined cost of ARGUS + Dealpath + CoStar + PMS ($5K-8K+/mo fragmented)
- Stripe billing integration when ready

**Code Editing Guidelines:**
- Always preserve existing formatting - do not edit formatting unless specifically requested
- Build incrementally on the existing app - never replace what is not suggested to change
- Make only minimal changes needed for the specific request
- Maintain existing code structure and patterns

## System Architecture

### UI/UX Decisions
The platform utilizes React 18 with TypeScript and Wouter for routing. The UI is built with shadcn/ui (on Radix UI), styled using Tailwind CSS with CSS variables, and employs Lucide-React for icons, ensuring mobile optimization. Navigation sidebar order: Dashboard → Operations → CRM (Contacts, Companies, Properties) → Prospecting → Marketing → Pipeline (Deals, Tasks, Activity, Forecast) → Deal Workspace → Analysis → Document Studio → Investor Services → Vantage → Docket → Market Intelligence. Reusable UI components include `skeleton-variants`, `empty-state`, `inline-banner`, and `bulk-action-bar`. Keyboard shortcuts are implemented for common actions.

### Technical Implementations
- **Frontend**: React 18, TypeScript, Wouter, TanStack Query, React Hook Form with Zod.
- **Backend**: Express.js with TypeScript, RESTful API, Drizzle ORM.
- **Authentication**: Session-based, multi-tenant with PostgreSQL, RBAC, Zod validation, SQL injection prevention, audit trails, and magic link login.
- **Document Processing**: Two parallel pipelines: (1) **P&L Pipeline V2** (OpenAI-based, `server/services/doc-intel-service.ts`) for human-in-the-loop review with marina-specific COA and 9-department taxonomy; (2) **Document Intelligence v2** (Claude-based, `server/services/document-parser/`) — a new extraction pipeline using `claude-opus-4-6` for highest-accuracy P&L and Rent Roll extraction. Tables: `document_extraction_jobs`, `extraction_fields`, `extraction_templates`. API at `/api/v1/document-extraction/`. UI at `/document-intelligence` (sidebar under Analysis). 5-state pipeline: pending→parsing→extracting→review_required→confirmed. Per-field confidence scoring (0–1), source provenance, inline overrides, CSV export, and Pro Forma population. Entitlement-gated by tier (Analyst=0, Professional=25, Enterprise=100, Institutional=500 uploads/month). Rent Roll Document Parser unifies CSV/Excel/PDF parsing with AI and heuristic fallbacks.
  - **P&L Anomaly Intelligence**: `server/services/pnl/anomaly-detector.ts` — detects margin compression (GP/EBITDA margin swings >15pp), expense spikes (>50% YoY with >$5K delta), unusual add-backs (>15% EBITDA impact), revenue reversal, and negative EBITDA. Each anomaly has severity (critical/warning), confidence, financial impact, and description. Produces add-back candidates with normalization suggestions. Exposed in `/api/pnl/jobs/:jobId/review` response.
  - **P&L Review UI — Intelligence Panel**: `PnlReview.tsx` surfaces anomaly data with quality score badge (0–100, color-coded green/yellow/red), red-flag count badge on header, 2-column Intelligence Panel (red flags + add-back candidates), "Export Analysis" download link for JSON anomaly report. Add-back candidates shown with suggested adjustments and financial impact.
  - **Professional P&L Excel Export**: `server/services/pnl/pnl-excel-export.ts` — 4-sheet SheetJS workbook (P&L Analysis with YoY formulas, Buyer Normalization with add-backs, Valuation Scenarios with 5 cap rate/multiple combinations, Red Flags registry). Color scheme: NAVY `1B3A5C` headers, LTBLUE `D6E4F7` data, YELLOW `FFF3CC` flags. Route: `GET /api/pnl/jobs/:jobId/export-excel`.
  - **Excel Raw-Scan Fallback**: `rawScanExtract()` in `excel-extractor.ts` handles messy broker workbooks with no recognizable header rows. Scans ALL cells for numeric patterns, groups by row proximity, builds synthetic line items from label+value proximity heuristics. Returns confidence 0.55 to signal raw-scan mode. Wired into `parseOrchestrator.ts` as fallback when confidence < 0.4 or zero rows parsed.
- **COA-Based Financial Normalization Engine**: Full Chart of Accounts management with import/manual entry and mapping to 69 seeded `mm_standard_accounts`. Non-blocking post-parse normalization trigger.
- **COA Taxonomy & Auto-Mapping System**: Multi-asset-class taxonomy engine (`server/services/coa-mapping-engine.ts`, `server/services/coa-taxonomy-seed.ts`, `server/routes/coa-taxonomy-routes.ts`). DB tables: `coa_taxonomy_packs`, `coa_profit_centers`, `coa_sub_centers`, `coa_canonical_accounts`, `coa_global_aliases`, `coa_user_aliases`, `coa_mapping_rules`, `coa_mapped_line_items`, `coa_mapping_audit_log` with 7 enums. Marina pack seeded with 16 profit centers, 18 sub-centers, 58 canonical accounts, 95 global aliases, 22 mapping rules. 3-layer mapping engine: exact alias → rules (keyword/regex/class-location) → keyword similarity, with confidence scoring and auto-approve threshold (≥0.90). Auto-maps after doc-intel parsing. Review UI: `CoaMappingReview.tsx` (stats, filter tabs, approve/override/bulk-approve, alias creation). Departmental P&L: `DepartmentalPL.tsx` (profit center waterfall, CSV export). Routes under `/api/coa-taxonomy/`. Tenant-scoped with upload ownership verification.
- **Pro Forma Engine**: Institutional-grade P&L waterfall with year-specific granular growth rates and inline assumptions editor. Supports below-the-line cash flow calculations and exit year waterfall. IRR calculated on levered cash flows. Includes T12-Aware Year 1 Logic for calendar year-end or next 12 months projections.
- **Content Aggregation**: Docket 2.0 for industry intelligence and Listing Ingestion V2 for robust listing aggregation.
- **Cross-Module Architecture**: Connects CRM, Due Diligence, Modeling, and Docket via schema consolidation, a query key factory, a Deal Orchestrator Service, Entity Linking API, and a Cross-Module Event System.
- **Marina Integration Adapters**: Abstract framework for connecting to various marina management systems (e.g., DockMaster, Dockwa).
- **Operations Data Sync**: Connects Fuel Sales, Rent Roll V2, and Ship Store modules to marina integrations with real-time sync, enriching the Pro Forma Engine.
- **Valuator Profit Centers**: Provides full CRUD for various marina profit centers.
- **Exit Strategy Persistence**: Frontend-to-backend CRUD for exit scenarios (cash_sale, exchange_1031, seller_financing).
- **Unified Analytics Dashboard**: Aggregates metrics from CRM, DD, Modeling, and Operations with time period filtering and trend visualization.
- **OM Builder**: Professional offering memorandum creation with data binding and PDF export.
- **Returns Module**: Institutional-grade return tracking at model and portfolio levels with canonical ledger, valuation timeline, and loan balance timeline. Metrics include MOIC, ROI, XIRR.
- **Dual-Sourced Data Architecture**: Separates "Universal/Global" curated data from user-specific data with Global, Organization, and User scopes.
- **CRM**: Deals, leads, contacts, pipelines, activities, email sequences, marketing automation, property status tracking, entity relationship management, Comment Threads, Multi-Entity Activity Associations, Saved Views, Computed Rollups, and Source Entity Badges.
- **Due Diligence**: Project management, task tracking, template management, DD Fees Tracker, and project-level contact management.
- **Rent Roll V2**: Multi-asset-class lease management (marina, self-storage, multifamily, RV park, hotel/STR, CRE, etc.). `shared/rent-roll-config.ts` drives per-asset-class unit types, field definitions, KPI cards, rate types, and feature flags. `asset_class` column added to `rra_marina_locations`. Project creation wizard (project-hub.tsx) has an asset class picker (step 2) with dynamic unit type lists per asset class.
- **SalesComps**: Marina sales comparables with import/export, Google Maps integration, validation, and a Pending Sales Comps workflow.
- **Modeling Projects**: Marina valuation, dynamic year selection, operations data sync, Exit Strategy Suite, AI-powered Document Intelligence, Scenario Versioning, Capital Stack Builder, Pro Forma Engine, Portfolio Roll-ups, Multi-Case Modeling, Addbacks System, and Excel Model Export.
- **Portfolio Dashboard** (Task #20): Org-level portfolio analytics dashboard at `/modeling/portfolio/dashboard` (modeling_tools pack gate). Aggregates KPIs from `modeling_projects`, `capital_stacks`, `valuation_snapshots`, and `modeling_financial_periods`: total AUM, equity deployed, aggregate NOI, avg DSCR, avg levered IRR, LTV, 12-month NOI trend (recharts LineChart), asset class breakdown (donut chart). API: `GET /api/portfolio/summary` (server/routes/portfolio-summary-routes.ts, fully parameterized SQL). NOTE: Route is intentionally at `/modeling/portfolio/dashboard` because `/portfolio` is reserved by the operations marinas pack in the router Switch and cannot be aliased without breaking it.
- **Pipeline Analytics Tab** (Task #20): Analytics view mode on the CRM pipeline board (`/pipeline/deal-board` → Analytics button). Single consolidated endpoint `GET /api/pipeline/analytics` (mounted at `/api/pipeline/analytics`) returns velocity, true stage-to-stage conversion rates (via `crm_deal_stage_history`), win/loss breakdown, avg deal size by stage, pipeline health score, and deal leaderboard. Frontend `PipelineAnalyticsView` consumes a single query to this endpoint.
- **Operations Modules**: Fuel Sales, Ship Store, Dockit (scheduling), and Marketing.
- **Virtual Data Room (VDR)**: Secure document management with granular permissions and audit logging.
- **Docket 2.0**: Industry intelligence, AI-powered RSS aggregation, M&A tracking, and sentiment analysis.
- **Listing Ingestion V2**: Institutional-grade listing aggregation pipeline with identity resolution and validation.
- **Analytics**: Marina KPI Calculator, ancillary revenue tracking, benchmarking, and Unified Cross-Module Analytics Dashboard.
- **AI Assistant**: Context-aware chatbot powered by GPT-5 with streaming responses.
- **Add-on Packs**: Fund Management, LP Portal, Prospecting, and Vantage Intel.
- **Admin Panel**: Enterprise admin dashboard for customer and organization management, usage metrics, audit trails, and user onboarding.
- **Data Governance & Benchmarking Framework**: Manages legal documents, allows benchmark opt-in/out, stores de-identified benchmark aggregates with cohort suppression, and uses guardrails for data privacy.
- **Demographics & Market Intelligence**: Integrates real-time Census Bureau ACS data and FRED API economic indicators. Provides components for market trend analysis, business environment, market potential, and site suitability.
- **Marina Map Cross-Platform Integration**: Marina Map at `/marinalytics/marina-map` exposes all 6 source layers (CRM Properties, Financial Models, Sales Comps, Rate Comps, Listings, Pipeline Deals). Accepts `?source=` URL param for deep linking (e.g. `?source=pipeline` from the Pipeline page, `?source=projects` from Modeling). "View on Map" button added to Portfolio, Pipeline, Prospecting Overview, and Financial Modeling pages. Intelligence View includes Heat Map and Demographics (state-level market intelligence overlay). Financial Model deep link in Intel View context tab when source is Financial Models.
- **Waitlist & Turn Management** (Phase 5): `server/modules/utilization/waitlist-service.ts`, `waitlist-routes.ts` — Waitlist system for demand tracking. DB tables: `waitlists`, `waitlist_entries`, `waitlist_offers` with enums for status tracking. CRUD for waitlists (per property/unitType/bandKey), entry management with position ordering, offer workflow (send/accept/decline/expire). Metrics: waitlistCount, avgTimeToOffer, conversionRate, demand by band/type. UI: WaitlistPanel in Utilization section with create dialog, entry table, offer drawer with action buttons, and metric cards. Endpoints under `/api/waitlist/`.
- **Transient Compression Analytics** (Phase 6): `server/modules/utilization/utilization-service.ts` (`computeCompressionAnalytics`), `CompressionChart.tsx` — Daily granularity utilization engine for transient unit types. Computes daily utilization series, day-of-week averages, compressionDaysPct (% of days >= threshold). UI: Line chart for daily utilization with threshold reference line, bar chart for day-of-week averages, metric cards (avg utilization, compression index, compressed days, peak). Filters: range (30/90 days), threshold (80/90/95%), mode toggle. Endpoint: `GET /api/utilization/compression`.
- **Underutilization Diagnosis Engine** (Phase 8): `server/modules/utilization/diagnosis-engine.ts`, `UnderutilizationInsights.tsx` — Root-cause analysis engine for underperforming segments (<65% util). Generates ranked diagnostic signals: `priceHighSignal` (effective rate vs segment avg), `constraintSignal` (beam/power/depth/dock type mismatch from capacityAttributes), `frictionSignal` (high waitlist but low conversion, or no inbound interest), `downtimeSignal` (elevated offline blocks with reason breakdown). Each signal includes confidence score and evidence. Segments ranked by worst utilization first. UI: Callout cards per segment with expandable signal details, color-coded by signal type. Endpoint: `GET /api/utilization/diagnosis?propertyId=&periodStart=&periodEnd=`.
- **Pricing Ladder Recommendations** (Phase 7): `server/modules/utilization/pricing-service.ts`, `pricing-routes.ts`, `PricingRecommendationsPanel.tsx` — Rules-based pricing engine. DB tables: `pricing_rules`, `pricing_recommendations` with enums for status/action. Rules engine evaluates conditions (metric/operator/value/windowDays) against live utilization, waitlist, and compression data. Supports `increase`/`decrease`/`hold` actions with configurable adjustment percentages and cooldown periods. Includes default rule seeding (high util+waitlist→+5%, compression→+3%, low util→-5%). Recommendation workflow: pending→accepted→implemented or dismissed. Drivers stored per recommendation showing metric values vs thresholds. UI: PricingRecommendationsPanel with recommendation cards, expandable driver details, accept/dismiss/implement actions. Endpoints: `GET /api/pricing/rules`, `POST /api/pricing/rules`, `POST /api/pricing/rules/seed`, `POST /api/pricing/evaluate`, `GET /api/pricing/recommendations`, `POST /api/pricing/recommendations/:id/(dismiss|accept|implement)`.
- **Universal Capacity Utilization Module** (Phase 1–4): `server/modules/utilization/` — Multi-asset-class utilization engine supporting marina, hotel, RV park, storage unit, industrial, and parking. Includes config map with denomType/capacityWeightField per unit type, size band definitions (0–25, 26–35, 36–45, 46–60, 61+), pure calculation functions (unit/weighted/economic utilization), date overlap helpers. DB tables: `util_inventory_units`, `util_occupancy_events`, `util_offline_blocks`, `util_snapshots`, `util_presence_events` with composite indexes. Dual engine: `mode=contracted` uses occupancy_events (lease-based), `mode=physical` uses presence_events (sensor/camera/AIS-based) with graceful degradation and `insufficientData` flag. Phase 2 UI: Utilization tab on Rent Roll Analysis page with metric cards, unit type table, size band chart, period/view/unitType filters. Phase 3: Financial (Contracted) vs Operational (Physical) toggle, UtilizationDrilldownDrawer showing event listing (occupancy or presence), offline blocks overlay. Phase 4: Offline capacity reason codes (`util_offline_reason` enum: dredging, storm, repair, upgrade, power_outage, condemnation, owner_use, other) with `estimatedRevenueLoss` column. `computeOfflineBreakdown` engine calculates lost potential revenue using avg effective rate per capacity-time per segment. UI: Offline Capacity + Est. Lost Revenue mini-cards in summary row, OfflineBreakdownTable with reason code badges and revenue impact, band chart tooltip with offline overlay showing cap-time lost and est. lost rev. Endpoints: `GET /api/utilization/ping`, `GET /api/utilization/mock-summary`, `GET /api/utilization/summary`, `GET /api/utilization/by-type`, `GET /api/utilization/by-band`, `GET /api/utilization/drilldown-events`, `GET /api/utilization/offline-breakdown`, `POST /api/utilization/recompute` (admin-only). All endpoints require authentication.

### System Design Choices
- **Database**: PostgreSQL with Neon serverless hosting, Drizzle ORM, schema-first, Drizzle Kit for migrations.
- **Multi-tenancy**: Organization-based data isolation.
- **VDR Permission System**: Hierarchical, 5-level granular permissions with caching.
- **File Uploads**: Multer-based, 10MB limit, local storage.
- **Webhook Idempotency**: In-memory storage.

## External Dependencies

### Core Runtime
- `@neondatabase/serverless`
- `drizzle-orm`
- `express`
- `@tanstack/react-query`
- `wouter`
- `react-hook-form`
- `multer`
- `@dnd-kit`
- `date-fns`, `date-fns-tz`
- `zod`

### UI and Component Libraries
- `@radix-ui/react-*`
- `lucide-react`
- `tailwindcss`
- `shadcn/ui`

### Development and Build Tools
- `vite`
- `typescript`
- `drizzle-kit`

### AI/External Services
- `Anthropic AI`
- `OpenAI`
- `Cheerio`
- `RSS Parser`
- `Resend`
- `FRED API`
- `Census Bureau API`
- `QuickBooks API`
- `Google Maps Services`
- `Constant Contact` (Email Marketing)