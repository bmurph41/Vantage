# MarinaMatch Platform Map
**Master context document — read by ALL agents at the start of every session.**

## Platform Identity
MarinaMatch is an institutional-grade multi-asset commercial real estate investment and management platform supporting 55+ asset classes.

**Stack:** React/TypeScript (Vite) · Node.js/Express · PostgreSQL · Drizzle ORM
**Hosting:** Replit
**Multi-tenant:** All queries scoped by org_id
**Test org:** cd3719c3-ef82-4ccc-acb9-261c80fb64b4
**Test project:** 6b3a9021-f393-489d-9274-321ac76eae08 (STR asset class)

## Design System
- Colors: Deep Marine Blue (#0A2342), Maritime Steel (#4A6FA5), Harbor Teal (#2DD4BF)
- Typography: Inter (UI) + Roboto Mono (numbers/data)
- Patterns: Three-column CrmRecordPage, MM-UI modal system, KPI chip headers

## Critical Technical Rules (ALL agents)
- NEVER npm run db:push — always raw pool.query() or psql
- RLS tables: modeling_project_config, modeling_scenario_versions — always raw pool.query()
- Raw SQL returns snake_case — always map explicitly to camelCase in routes
- Server restart required after any new Express route
- Patching: use node --input-type=module heredoc scripts
- Git commit after every successful agent task

## Feature Status Map

### 1. FINANCIAL MODEL ENGINE
- Pro Forma: BUILT — feeds DCF, Monte Carlo, Multi-Year, Document Studio
- DCF: BUILT — consumes Pro Forma, outputs to Decision Support, Deal Comparison, AI Advisor
- Multi-Year Pro Forma: BUILT — Year 1 NOI $50,629 / Year 5 $57,018 verified
- Monte Carlo: BUILT
- Decision Support: BUILT — tornado chart, attribution, memo generator
- Capital Stack: BUILT — LTV/dollar toggle, DSCR timeline, projected closing date
- Exit Strategy Studio: BUILT — Net Proceeds, DST, Waterfall unified
- Investment Criteria: BUILT — weighted scoring, must-have criteria, match breakdowns
- Payroll Schema: BUILT (30+ tables) — UI NOT built
- FM Visual QA: TODO
- Feature Gating: TODO — blocked on billing

### 2. CRM / DEAL PIPELINE
- CRM Record Pages: BUILT — all 4 entities, 3-column layout
- Pipeline Board/Kanban: BUILT — drag-and-drop, stage management
- Workflow Automation: BUILT — 7 trigger types, 7 action executors
- Deal Timeline/Gantt: TODO (priority #2)
- Deal Comparison: TODO (priority #3)
- Key Dates on Kanban: TODO (priority #4)
- Global Activity Log Polish: TODO (priority #5)
- Email Send Integration: TODO (priority #6)
- Relationship Intelligence: BUILT — weighted scoring, badge system

### 3. PROSPECTING / MARKETPLACE
- Marketplace Listings: BUILT — filter sidebar, 3 views, Add to Pipeline modal
- Marina Property Map: BUILT (UI) — needs live DB wiring and geocoding
- Map Data Integration: TODO — Google Maps geocoding, Mapbox GL JS, Census ACS
- Lead Enrichment Pipeline: TODO
- Scraping Health Dashboard: TODO

### 4. AI ADVISOR / RAG
- Knowledge Base Service: BUILT — OpenAI embeddings, RAG
- AI Assistant Routes + UI: BUILT
- Entity Injection: TODO — inject Deal Room context into AI prompts
- Deal Comparison in Advisor: TODO
- Markdown Rendering Fix: TODO — raw markdown showing in chat UI

### 5. DOCUMENT STUDIO / MARKETING PACKAGES
- Token Substitution Engine: TODO
- IC Deal Review Deck: TODO
- Offering Memorandum: TODO
- Document Studio UI Tab: TODO

### 6. REPORTING & ANALYTICS
- Portfolio Dashboard: TODO
- Pipeline Analytics: TODO
- Payroll UI: TODO

### 7. BILLING / ENTITLEMENTS
- Entitlements System: BUILT — feature flags, persona onboarding
- Billing Engine: TODO — Stripe integration (Gap Spec Feature 1.1)

### 8. INFRASTRUCTURE
- Institutional Readiness: BUILT — security middleware, OpenTelemetry, health checks
- P&L Parser v2: BUILT — pdfjs-dist geometry, alias learning
- Asset Class Registry: BUILT — 55+ types via varchar registry

## Connectivity Matrix
Pro Forma → DCF, Multi-Year, Monte Carlo, Document Studio
DCF → Decision Support, Exit Strategy, Deal Comparison, AI Advisor
Capital Stack → Pro Forma (debt service), Exit Strategy (waterfall)
Investment Criteria → Marketplace (auto-score), CRM Pipeline (score on intake)
Marketplace → CRM Pipeline (Add to Pipeline), Marina Map (cross-reference)
Workflow Automation → Email (action), Tasks/Notifications (action)
AI Advisor → Deal Room context (entity injection), Pro Forma + DCF (data), Knowledge Base (RAG)
Document Studio → Pro Forma (binding), DCF (binding), Capital Stack (binding)
Payroll → Pro Forma (opex line)
Billing → All premium features (gate)

## Build Priority Order
Tier 1: CRM/Pipeline (active)
Tier 2: AI Advisor fixes
Tier 3: Document Studio / Marketing Packages
Tier 4: Prospecting depth
Tier 5: Reporting & Analytics
Tier 6: Financial Model polish
Tier 7: Billing Engine

## Definition of Done
- Backend route returns correct data (tested with curl)
- Frontend component renders without TS errors
- Connected to all modules in Connectivity Matrix
- Empty state handled
- Works for test org cd3719c3-ef82-4ccc-acb9-261c80fb64b4
- Journal entry written
- No regressions in connected features
