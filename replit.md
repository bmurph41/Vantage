# MarinaMatch Platform

## Overview
MarinaMatch is a comprehensive full-stack platform designed to manage the entire lifecycle of marina acquisition projects, from initial lead generation through to project completion. It unifies CRM functionalities with advanced Due Diligence Tracking and a robust deal pipeline, centralizing complex marina transaction management. The platform aims to enhance efficiency, provide analytical insights for successful acquisitions, and includes capabilities such as Rent Roll management, Sales Comparables analysis, Modeling Projects with an Exit Strategy Suite, AI-powered Document Intelligence, Marketing automation, Fuel Sales, Ship Store management, and a secure Virtual Data Room (VDR).

## User Preferences
Preferred communication style: Simple, everyday language.

**Code Editing Guidelines:**
- Always preserve existing formatting - do not edit formatting unless specifically requested
- Build incrementally on the existing app - never replace what is not suggested to change
- Make only minimal changes needed for the specific request
- Maintain existing code structure and patterns

## System Architecture

### UI/UX Decisions
The platform utilizes React 18 with TypeScript and Wouter for routing. The UI is built with shadcn/ui (on Radix UI), styled using Tailwind CSS with CSS variables, and employs Lucide-React for icons, ensuring mobile optimization. Navigation sidebar order prioritizes core functionalities. Reusable UI components include `skeleton-variants`, `empty-state`, `inline-banner`, and `bulk-action-bar`. Keyboard shortcuts are implemented for common actions.

### Technical Implementations
- **Frontend**: React 18, TypeScript, Wouter, TanStack Query, React Hook Form with Zod.
- **Backend**: Express.js with TypeScript, RESTful API, Drizzle ORM.
- **Authentication**: Session-based, multi-tenant with PostgreSQL, RBAC, Zod validation, SQL injection prevention, audit trails, and magic link login.
- **Document Processing**: P&L Pipeline V2 for document extraction with human-in-the-loop review, OCR and LLM classification, and a marina-specific Chart of Accounts. LLM classifiers use a 9-department taxonomy. Rent Roll Document Parser unifies CSV/Excel/PDF parsing with AI and heuristic fallbacks.
- **COA-Based Financial Normalization Engine**: Full Chart of Accounts management with import/manual entry and mapping to 69 seeded `mm_standard_accounts`. Non-blocking post-parse normalization trigger.
- **Pro Forma Engine**: Institutional-grade P&L waterfall with year-specific granular growth rates and inline assumptions editor. Supports below-the-line cash flow calculations and exit year waterfall. IRR calculated on levered cash flows. Includes T12-Aware Year 1 Logic for calendar year-end or next 12 months projections.
- **Content Aggregation**: DockTalk 2.0 for industry intelligence and Listing Ingestion V2 for robust listing aggregation.
- **Cross-Module Architecture**: Connects CRM, Due Diligence, Modeling, and DockTalk via schema consolidation, a query key factory, a Deal Orchestrator Service, Entity Linking API, and a Cross-Module Event System.
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
- **Rent Roll V2**: Marina-centric lease management with normalized schema.
- **SalesComps**: Marina sales comparables with import/export, Google Maps integration, validation, and a Pending Sales Comps workflow.
- **Modeling Projects**: Marina valuation, dynamic year selection, operations data sync, Exit Strategy Suite, AI-powered Document Intelligence, Scenario Versioning, Capital Stack Builder, Pro Forma Engine, Portfolio Roll-ups, Multi-Case Modeling, Addbacks System, and Excel Model Export.
- **Operations Modules**: Fuel Sales, Ship Store, Dockit (scheduling), and Marketing.
- **Virtual Data Room (VDR)**: Secure document management with granular permissions and audit logging.
- **DockTalk 2.0**: Industry intelligence, AI-powered RSS aggregation, M&A tracking, and sentiment analysis.
- **Listing Ingestion V2**: Institutional-grade listing aggregation pipeline with identity resolution and validation.
- **Analytics**: Marina KPI Calculator, ancillary revenue tracking, benchmarking, and Unified Cross-Module Analytics Dashboard.
- **AI Assistant**: Context-aware chatbot powered by GPT-5 with streaming responses.
- **Add-on Packs**: Fund Management, LP Portal, Prospecting, and MarinaMatch Intel.
- **Admin Panel**: Enterprise admin dashboard for customer and organization management, usage metrics, audit trails, and user onboarding.
- **Data Governance & Benchmarking Framework**: Manages legal documents, allows benchmark opt-in/out, stores de-identified benchmark aggregates with cohort suppression, and uses guardrails for data privacy.
- **Demographics & Market Intelligence**: Integrates real-time Census Bureau ACS data and FRED API economic indicators. Provides components for market trend analysis, business environment, market potential, and site suitability.
- **Universal Capacity Utilization Module** (Phase 1): `server/modules/utilization/` — Multi-asset-class utilization engine supporting marina, hotel, RV park, storage unit, industrial, and parking. Includes config map with denomType/capacityWeightField per unit type, size band definitions (0–25, 26–35, 36–45, 46–60, 61+), pure calculation functions (unit/weighted/economic utilization), date overlap helpers. DB tables: `util_inventory_units`, `util_occupancy_events`, `util_offline_blocks`, `util_snapshots` with composite indexes. Real contracted utilization pipeline queries inventory + occupancy + offline blocks, computes utilization with overlap math, stores monthly snapshots. Endpoints: `GET /api/utilization/ping`, `GET /api/utilization/mock-summary`, `GET /api/utilization/summary` (snapshot-preferred for whole months), `GET /api/utilization/by-band`, `POST /api/utilization/recompute` (admin-only). All endpoints require authentication.

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