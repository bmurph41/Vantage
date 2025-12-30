# MarinaMatch Platform

## Overview
MarinaMatch is a full-stack platform designed to manage marina acquisition projects, offering a unified solution from lead generation to project completion. It integrates CRM functionalities with advanced Due Diligence Tracking, supporting deal pipeline management, lead and contact tracking, and automated due diligence workflows. The platform centralizes complex marina transaction management, enhances efficiency, and provides analytical insights for successful acquisitions, encompassing features like Rent Roll, Sales Comparables, advanced Modeling Projects with an Exit Strategy Suite, AI-powered Document Intelligence, Marketing automation, Fuel Sales, Ship Store management, and a secure Virtual Data Room (VDR).

## User Preferences
Preferred communication style: Simple, everyday language.

**Code Editing Guidelines:**
- Always preserve existing formatting - do not edit formatting unless specifically requested
- Build incrementally on the existing app - never replace what is not suggested to change
- Make only minimal changes needed for the specific request
- Maintain existing code structure and patterns

## System Architecture

### UI/UX Decisions
The platform utilizes React 18 with TypeScript and Wouter for routing. UI is built with shadcn/ui (on Radix UI) and styled using Tailwind CSS with CSS variables and Lucide-React for icons, ensuring mobile optimization.

### Technical Implementations
- **Frontend**: React 18, TypeScript, Wouter, TanStack Query for server state, React Hook Form with Zod validation.
- **Backend**: Express.js with TypeScript, RESTful API design, Drizzle ORM.
- **Authentication**: Session-based, multi-tenant with PostgreSQL session store, role-based access control (RBAC), Zod schema validation, SQL injection prevention, and audit trails.
- **Pack System**: Modular add-on packs (`PackGate` component, `requirePack` middleware) for premium features.
- **Multi-Case Modeling**: Database-backed scenarios with CRUD operations, color-coding, per-case assumption storage, and lease-up tracking.
- **Addbacks System**: Line-item adjustments for EBITDA normalization with monthly/yearly period support and predefined reasons.
- **OM Builder**: Professional offering memorandum creation with a 3-panel layout, block types (text, KPI, chart, table, image), data binding, theme system, and PDF export.
- **Operations Modules**: Flattened 2-level navigation with tab-based sub-navigation using `TabbedModuleLayout` for consistent UX across Fuel Sales, Ship Store, Dockit, Rent Roll, and Marketing.
- **CRM & Pipeline (Consolidated Navigation)**: The sidebar merges traditional CRM (Contacts, Companies, Properties) with Pipeline tools (Deal Board, Activity Log, Follow-Ups, Forecast) under a unified "CRM & Pipeline" section. Marketing and Analytics are direct links within this section, eliminating the separate "Deal Management" section.
- **Deal Workspace (Consolidated Navigation)**: Sidebar consolidates Due Diligence, Data Room, and Modeling into a single "Deal Workspace" section. Sub-navigation shows workspace-specific tabs (Overview, Financials, Diligence, Documents, Team) when viewing a specific workspace. Standalone modeling tools (OM Builder, Funds, Debt Scenarios, Exit Strategies) remain in a separate "Analysis" section.
- **Navigation Naming**: The sidebar uses "Market Intelligence" for Sales Comps, Rate Comps, and DockTalk; "Analysis" for modeling tools (OM Builder, Funds, Debt Scenarios, Exit Strategies).
- **Financial Kernel (Feature-Flagged)**: Enterprise-grade canonical financial data model with Intacct-inspired ledger tables, marina-native dimensions, account mapping layer, and QuickBooks integration.

### Feature Specifications
- **CRM**: Deals, leads, contacts, pipelines, activities, email sequences, marketing automation, relationship management. Enhanced with:
    - **CRM Lists**: User-defined lists for contacts/companies/properties with member management, color-coding, and batch operations.
    - **Property Status Tracking**: Pipeline stage tracking (lead, opportunity, under_contract, closed), listing fields (price, date, broker), on-market filtering, close sale workflow with auto-comp creation.
    - **Entity Relationships**: Cross-module navigation between contacts, companies, properties, deals, and DD projects.
- **Due Diligence**: Project management, task tracking, template management. Enhanced with:
    - **DD Fees Tracker**: Fee tracking by category (legal, accounting, consulting, inspection, appraisal, environmental, survey, title, lender, broker), contact/company linking, payment status, invoice tracking, and category summaries.
- **Rent Roll**: Unit occupancy, rental income, Customer Analytics (LTV, retention, churn).
- **SalesComps**: Marina sales comparables, CSV import/export, Google Maps integration (geocoding, address autocomplete, data quality scoring), validation rules engine, comp history tracking, and adjustment grid.
- **Modeling Projects**: Marina valuation, dynamic year selector, operations data sync, Exit Strategy Suite, AI-powered Document Intelligence (P&L/Rent Roll parsing, review workflow), Scenario Versioning, QuickBooks Integration, Capital Stack Builder, Pro Forma Engine, Portfolio Roll-ups. Enhanced with:
    - **P&L Pipeline V2 (UPGRADED)**: Enterprise-grade document extraction system with human-in-the-loop review, alias training bank, and full provenance tracking. Features:
        - **OCR Abstraction Layer**: Provider-agnostic OCR with support for local parsing (Excel/PDF), Veryfi, and Affinda stubs. Configure via `OCR_PROVIDER` env var.
        - **LLM Classification Abstraction**: AI-powered line item classification with OpenAI, Anthropic, and mock provider support. Falls back gracefully when API unavailable. Configure via `LLM_PROVIDER` env var.
        - **Marina-Specific Chart of Accounts**: 80+ seeded line items across departments (Storage, Fuel, Service, Marina & Amenities, Ship's Store, Boat Sales/Brokerage, Payroll, Expenses). Seed via `POST /api/pnl/canonical-items/seed-marina`.
        - **Aggregation Service**: `getPnlForMarina()` helper provides department summaries, section totals, NOI/EBITDA calculations. Time series and YoY comparison endpoints available.
        - **Enhanced API Endpoints**: Document details (`GET /api/pnl/documents/:id`), marina aggregation (`GET /api/pnl/marina/:marinaId`), time series (`/time-series`), YoY comparison (`/comparison`), statement lines with grouping (`GET /api/pnl/statements/:id/lines`), statement approval (`POST /api/pnl/statements/:id/approve`).
        - **Pipeline Features**: SHA256-based deduplication, job state machine (queued → processing → parsed → mapped → stored → completed/failed), canonical line item mapping with 0.75 confidence threshold, cascading classification (alias → regex → keyword → canonical → LLM), review queue for low-confidence items.
        - Schema: 8 pnl_* tables (documents, jobs, parsed_statements, canonical_line_items, line_item_aliases, facts, review_items, keyword_rules). Routes at `/api/pnl/*`. Frontend at `/modeling/pnl/upload` and `/modeling/pnl/review`. Documentation at `docs/pnl_ingestion.md`.
    - **Multi-Case Modeling**: Database-backed scenarios with N-case support, color-coding (6 preset colors), per-case assumptions storage, lease-up tracking, and case comparison exports.
    - **Addbacks System**: Line-item EBITDA adjustments with monthly/yearly period support, predefined reasons (one-time, owner-related, non-recurring, normalization), category grouping, and full value history.
    - **Excel Model Export**: Multi-sheet Excel export including project summary, cases overview, case-specific assumptions, lease-up schedules, addbacks detail, and case comparison reports.
- **Fund Management (Add-on)**: PE fund lifecycle, capital allocation, fund-level returns, investor capital accounts.
- **LP Portal (Add-on)**: Dedicated investor portal.
- **Prospecting (Add-on)**: Premium prospecting and outreach.
- **MarinaMatch Intel (Add-on)**: AI-powered listing aggregation, investment criteria profiles, goals dashboard, automated matching.
- **Marketing**: Campaigns, expenses, lead attribution.
- **Virtual Data Room (VDR)**: Secure document management, granular permissions, external user management, diligence request workflows, audit logging.
- **DockTalk 2.0**: Industry intelligence, AI-powered RSS aggregation, M&A tracking, sentiment analysis, watchlists, structured location watching, article matching. Enhanced with:
    - **DockTalk V2 Scraper (Feature-Flagged)**: Institutional-grade scraper system enabled via `DOCKTALK_SCRAPER_V2=true`. Features multi-method discovery (RSS/sitemap/HTML crawl), HTTP fetcher with exponential backoff and robots.txt compliance, Readability-style article extraction, content deduplication (exact/SimHash/embedding similarity), relevance scoring with weighted components (embedding similarity 55%, keyword matching, quality checks, recency bonuses), OpenAI embeddings with stub fallback, and user-configurable relevance rules. API routes at `/api/docktalk/v2`.
- **Listing Ingestion V2 (Feature-Flagged)**: Institutional-grade listing aggregation pipeline enabled via `LISTING_INGESTION_V2=true`. Enhanced with:
    - **Schema**: 9 liv2_* tables (sources, scrape_runs, raw_pages, listing_candidates, listing_payloads, listing_assets, quarantine, field_provenance, listings_current).
    - **Identity Resolution**: Multi-strategy confidence scoring (JSON-LD 95%, explicit ID 90%, canonical URL 80%, address+geo fallback 65%). Two-key identity model (domain + stableSourceKey → canonicalListingId) prevents cross-wire data corruption.
    - **Verified Asset Binding**: Image extraction with hero image selection, content hash tracking, and provenance verification.
    - **Validation Layer**: Sanity checks with automatic quarantine for low-confidence matches (<75%) or identity conflicts.
    - **SSRF Protection**: Comprehensive security with per-hop redirect validation for both HTML and image fetches. Blocks private IPs, localhost, metadata endpoints, and internal hostnames.
    - **Field Provenance**: Tracks origin and extractor version for all important fields (title, price, address, slips).
    - **API Routes**: Feature-flagged at `/api/listings/v2`.
- **Launch Operations (Dockit)**: Marina launch/haul scheduling, transient slips, employee assignments.
- **Market Demographics**: Regional market analysis using FRED and Census Bureau APIs.
- **Analytics**: Marina KPI Calculator (occupancy, ADR, RevPALF, NOI margin, cap rate, DSCR), ancillary revenue tracking, asset class support, performance snapshots, benchmarking.

### System Design Choices
- **Database**: PostgreSQL with Neon serverless hosting, Drizzle ORM, schema-first approach, Drizzle Kit for migrations.
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