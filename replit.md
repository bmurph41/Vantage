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
The platform utilizes React 18 with TypeScript and Wouter for routing. The UI is built with shadcn/ui (on Radix UI), styled using Tailwind CSS with CSS variables, and employs Lucide-React for icons, ensuring mobile optimization. Navigation sidebar order: Dashboard > Operations > CRM > Pipeline > Deal Workspace > Underwriting Tools > Investor Services > Prospecting > MarinaMatch (direct link) > DockTalk (standalone direct link) > Market Intelligence (Sales Comps, Rate Comps, etc.) > Integrations. The system uses a "Pack System" for modular premium features. Reusable UI components include `skeleton-variants`, `empty-state`, `inline-banner`, and `bulk-action-bar`. Keyboard shortcuts are implemented for common actions (Cmd/Ctrl+K, /, ESC).

### Technical Implementations
- **Frontend**: React 18, TypeScript, Wouter, TanStack Query, React Hook Form with Zod.
- **Backend**: Express.js with TypeScript, RESTful API, Drizzle ORM.
- **Authentication**: Session-based, multi-tenant with PostgreSQL, RBAC, Zod validation, SQL injection prevention, audit trails, email verification via SendGrid, and magic link login.
- **Data Modeling**: Multi-case modeling with database-backed scenarios, Addbacks for EBITDA normalization, and a Financial Kernel.
- **Document Processing**: P&L Pipeline V2 for document extraction with human-in-the-loop review, OCR and LLM classification layers, and a marina-specific Chart of Accounts. Rent Roll Document Parser unifies CSV/Excel/PDF parsing with AI and heuristic fallbacks.
- **Pro Forma Engine**: Granular department-level projections anchored to historical data, supporting growth rates, storage growth, occupancy adjustments, and margin assumptions.
- **Content Aggregation**: DockTalk 2.0 for industry intelligence and Listing Ingestion V2 for robust listing aggregation.
- **Cross-Module Architecture**: Connects CRM, Due Diligence, Modeling, and DockTalk via schema consolidation, a query key factory, a Deal Orchestrator Service, Entity Linking API, and a Cross-Module Event System.
- **Marina Integration Adapters**: Abstract framework for connecting to various marina management systems (e.g., DockMaster, Dockwa) with OAuth, rate limiting, and retry logic.
- **Operations Data Sync**: Connects Fuel Sales, Rent Roll V2, and Ship Store modules to marina integrations with real-time sync, enriching the Pro Forma Engine with operational data from multiple profit centers.
- **Valuator Profit Centers**: Provides full CRUD, CSV import/export for fuel, ship store, service, boat rentals, boat club, boat sales, commercial tenants, and bookkeeping.
- **Exit Strategy Persistence**: Frontend-to-backend CRUD for exit scenarios (cash_sale, exchange_1031, seller_financing).
- **Unified Analytics Dashboard**: Aggregates metrics from CRM, DD, Modeling, and Operations with time period filtering and trend visualization.
- **OM Builder**: Professional offering memorandum creation with data binding and PDF export.

### Dual-Sourced Data Architecture
The platform utilizes a dual-sourced data model separating "Universal/Global" curated data from user-specific data. Data scopes include Global (MarinaMatch curated, pack-subscriber access), Organization (org-specific, visible to members), and User (private to creator). Curated data tables include `salesComps`, `rateComps`, `industryStandards`, `marinaListings`, and `marinaScrapeources`, managed via admin routes and a dedicated admin dashboard.

### Feature Specifications
- **CRM**: Deals, leads, contacts, pipelines, activities, email sequences, marketing automation, property status tracking, entity relationship management, and Comment Threads.
- **Due Diligence**: Project management, task tracking, template management, DD Fees Tracker, and project-level contact management with CRM pending contacts integration.
- **Rent Roll V2**: Marina-centric lease management with normalized schema, supporting seasonal/year-round operations and CRM/DD integrations.
- **SalesComps**: Marina sales comparables with import/export, Google Maps integration, validation, and Pending Sales Comps workflow (property sales history → pending review → accepted/rejected → sales comp creation).
- **Modeling Projects**: Marina valuation, dynamic year selection, operations data sync, Exit Strategy Suite, AI-powered Document Intelligence, Scenario Versioning, Capital Stack Builder, Pro Forma Engine, Portfolio Roll-ups, Multi-Case Modeling, Addbacks System, and Excel Model Export.
- **Operations Modules**: Fuel Sales, Ship Store, Dockit (scheduling), and Marketing.
- **Virtual Data Room (VDR)**: Secure document management with granular permissions and audit logging.
- **DockTalk 2.0**: Industry intelligence, AI-powered RSS aggregation, M&A tracking, and sentiment analysis.
- **Listing Ingestion V2**: Institutional-grade listing aggregation pipeline with identity resolution and validation.
- **Analytics**: Marina KPI Calculator, ancillary revenue tracking, benchmarking, and Unified Cross-Module Analytics Dashboard.
- **AI Assistant**: Context-aware chatbot powered by GPT-5 with streaming responses and platform knowledge base.
- **Add-on Packs**: Fund Management, LP Portal, Prospecting, and MarinaMatch Intel.

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