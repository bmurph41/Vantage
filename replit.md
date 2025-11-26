# MarinaMatch Platform

## Overview
MarinaMatch is a full-stack platform designed to manage marina acquisition projects. It integrates comprehensive CRM functionalities with Due Diligence Tracking, enabling deal pipeline management, lead and contact tracking, and automated due diligence workflows. The platform aims to streamline the acquisition process from initial lead to project completion, offering a unified solution for managing complex marina transactions. Key capabilities include CRM, Due Diligence, Rent Roll, Sales Comps, Modeling Projects (with advanced Exit Strategy Suite and Document Intelligence), Marketing, Fuel Sales, Ship Store, and a Virtual Data Room (VDR).

## User Preferences
Preferred communication style: Simple, everyday language.

**Code Editing Guidelines:**
- Always preserve existing formatting - do not edit formatting unless specifically requested
- Build incrementally on the existing app - never replace what is not suggested to change
- Make only minimal changes needed for the specific request
- Maintain existing code structure and patterns

## System Architecture

### Frontend
- **Frameworks**: React 18 with TypeScript, Wouter for routing.
- **UI/Styling**: shadcn/ui (built on Radix UI), Tailwind CSS with CSS variables, Lucide-React for icons. Full mobile optimization.
- **State Management**: TanStack Query for server state.
- **Form Handling**: React Hook Form with Zod validation.

### Backend
- **Framework**: Express.js with TypeScript.
- **API**: RESTful design, consistent error handling, logging.
- **Database ORM**: Drizzle ORM.
- **Authentication**: Session-based, multi-tenant.
- **File Uploads**: Multer-based, 10MB limit, stored locally.

### Data Storage
- **Database**: PostgreSQL with Neon serverless hosting.
- **ORM**: Drizzle ORM with schema-first approach.
- **Schema**: Multi-tenant architecture for organizations, users, projects, tasks.
- **Migrations**: Drizzle Kit.
- **Webhook Idempotency**: In-memory storage for 24-hour retention.

### Authentication and Authorization
- **Multi-tenancy**: Organization-based data isolation, role-based access control (Owner, Editor, Viewer).
- **Session Management**: Express sessions with PostgreSQL session store.
- **Security**: Zod schema validation, SQL injection prevention, RBAC middleware, audit trails.
- **VDR Permission System**: Hierarchical, 5-level granular permissions (no_access, view_only, view_download, view_download_print, full_access) with 60-second cache invalidation.

### Key Features
- **CRM Module**: Manages deals, leads, contacts, companies, pipelines, activities, email sequences, and marketing automation.
- **Due Diligence Module**: Project management with task tracking and template management.
- **CRM-DD Integration**: Converts CRM deals to DD projects with automated task and contact mapping.
- **Rent Roll Module**: Manages marina unit occupancy and rental income.
- **SalesComps Module**: Marina sales comparables with CSV import/export, Google Maps, and portfolio functionality.
- **Modeling Projects Module**: Tracks marina valuation, links to CRM, DD, sales comps, with analytics.
    - **Operations Data Sync**: Institutional-grade pipeline for operational data (Rent Roll, Fuel Sales, Ship Store) to modeling projects.
    - **Exit Strategy Suite**: Integrated tools for exit analysis (Tax Calculator, Net Proceeds, 1031 Exchange, DST Analysis, Seller Financing, Earnout Modeling, Waterfall Analysis, IRR, Sensitivity Analysis, AI Insights).
    - **Document Intelligence**: AI-powered document parsing for P&L and Rent Roll with QuickBooks-style review workflow, hierarchical categorization, and confidence scoring.
    - **Scenario Versioning**: Version history for Base/Aggressive/Conservative scenarios with audit trail, approval workflows (draft → pending → approved/rejected), and version comparison. Scenario locking prevents edits to approved scenarios.
    - **QuickBooks Integration**: OAuth2 connection flow for QuickBooks Online, P&L sync to modeling actuals with automatic category mapping, encrypted token storage.
    - **Approval Notifications**: In-app notification system for scenario approval requests with SendGrid email integration, multi-approver support, and approval statistics.
    - **Portfolio Roll-ups**: Aggregate views across multiple modeling projects with portfolio summary (value, NOI, cap rates, IRR), breakdown by region/state/status/year, multi-year projections, and performance analysis.
    - **Pro Forma Engine**: Real-time projections calculated from modeling actuals and scenario assumptions with historical P&L data binding.
    - **Sensitivity Matrix Storage**: Persisted sensitivity analysis results with scenario versioning for cap rate and growth rate scenarios.
    - **Benchmark Comparison**: Compares project metrics against sales comps database with portfolio risk metrics (concentration, vintage, geographic exposure).
    - **Multi-Approver Workflows**: IC committee support with quorum requirements and parallel sign-offs for institutional approval processes.
    - **Comment Threads**: Inline scenario discussions for IC feedback with mentions, resolution tracking, and full audit trail.
    - **VDR Integration**: Auto-populates Virtual Data Room with modeling outputs (IC memos, pro formas, scenario comparisons) for deal closing.
    - **Debt Sensitivity Analysis**: Interest rate scenarios across lender structures (bank, credit union, CMBS, bridge, SBA) with DSCR calculations.
    - **Waterfall Customization**: Configurable LP/GP splits, hurdle rates, catch-up provisions with European/American waterfall support and IRR calculations.
    - **External API**: Export-ready data feeds (JSON, CSV, XML) for downstream reporting systems with webhook payload generation.
- **Marketing Module**: Tracks campaigns, expenses, lead attribution, and integrates with email platforms.
- **Fuel Sales Module**: Manages fuel operations, transactions, inventory, and analytics, with portfolio management.
- **Ship Store Module**: POS/inventory system with product catalog, transactions, analytics, and customer tracking, with portfolio management.
- **Virtual Data Room (VDR) Module**: Secure document management with hierarchical folders, 5-level permissions, external user management, diligence request workflows, audit logging, and data request management (Kanban board, configurable categories, due date presets).
- **DockTalk 2.0 Module**: Marina industry intelligence platform with AI-powered RSS aggregation, M&A deal tracking, real-time updates, sentiment analysis, and AI training system.
- **Market Demographics Module**: Regional market analysis with state-level FRED economic indicators (population, income, employment, housing) and location-based Census demographics. Features include:
    - **State Analysis**: FRED API integration for state-level economic data with YoY trends and 5-year CAGR.
    - **Location Analysis**: Census Bureau API integration for granular demographics at any U.S. address (tract/county/state level).
    - **Trade Area Analysis**: Configurable 1/3/5 mile radius demographic analysis.
    - **Multi-Location Comparison**: Side-by-side comparison of up to 5 locations with population, income, education, and housing metrics.
    - **Property Demographics**: Direct integration with CRM properties for automatic demographic lookups.
    - **Caching Layer**: Automatic caching of FRED and Census API responses to minimize external calls.

## External Dependencies

### Core Runtime
- **@neondatabase/serverless**: PostgreSQL driver.
- **drizzle-orm**: Type-safe ORM.
- **express**: Web framework.
- **@tanstack/react-query**: Server state management.
- **wouter**: Lightweight routing.
- **react-hook-form**: Form library.
- **multer**: File upload middleware.
- **@dnd-kit**: Drag and drop toolkit.
- **date-fns**: Date utility library.
- **date-fns-tz**: Timezone support.
- **zod**: TypeScript-first schema validation.
- **@hookform/resolvers**: Validation resolvers for React Hook Form.

### UI and Component Libraries
- **@radix-ui/react-***: Headless UI primitives.
- **lucide-react**: Icon library.
- **tailwindcss**: CSS framework.
- **shadcn/ui**: Component library.

### Development and Build Tools
- **vite**: Build tool and development server.
- **typescript**: Static type checking.
- **drizzle-kit**: Database migration and introspection.

### AI/External Services (DockTalk 2.0)
- **Anthropic AI**
- **OpenAI**
- **Cheerio**: Web scraping.
- **RSS Parser**
- **Resend**: Email service.