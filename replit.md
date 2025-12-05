# MarinaMatch Platform

## Overview
MarinaMatch is a comprehensive full-stack platform designed to manage marina acquisition projects. It offers a unified solution for streamlining the acquisition process, from initial lead generation to project completion, by integrating robust CRM functionalities with advanced Due Diligence Tracking. The platform supports deal pipeline management, lead and contact tracking, and automated due diligence workflows. Key capabilities include CRM, Due Diligence, Rent Roll management, Sales Comparables, advanced Modeling Projects with an Exit Strategy Suite and AI-powered Document Intelligence, Marketing automation, Fuel Sales, Ship Store management, and a secure Virtual Data Room (VDR). The platform aims to centralize complex marina transaction management, enhance efficiency, and provide deep analytical insights to drive successful acquisitions.

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
- **UI/Styling**: shadcn/ui (built on Radix UI), Tailwind CSS with CSS variables, Lucide-React for icons, mobile optimization.
- **State Management**: TanStack Query for server state.
- **Form Handling**: React Hook Form with Zod validation.

### Backend
- **Framework**: Express.js with TypeScript.
- **API**: RESTful design with consistent error handling and logging.
- **Database ORM**: Drizzle ORM.
- **Authentication**: Session-based, multi-tenant.
- **File Uploads**: Multer-based, 10MB limit, local storage.

### Data Storage
- **Database**: PostgreSQL with Neon serverless hosting.
- **ORM**: Drizzle ORM with schema-first approach and Drizzle Kit for migrations.
- **Schema**: Multi-tenant architecture supporting organizations, users, projects, and tasks.
- **Webhook Idempotency**: In-memory storage for 24-hour retention.

### Authentication and Authorization
- **Multi-tenancy**: Organization-based data isolation with role-based access control (Owner, Editor, Viewer).
- **Session Management**: Express sessions with PostgreSQL session store.
- **Security**: Zod schema validation, SQL injection prevention, RBAC middleware, audit trails.
- **VDR Permission System**: Hierarchical, 5-level granular permissions with 60-second cache invalidation.
- **Pack System**: Modular add-on packs for premium features with frontend (`PackGate` component) and backend (`requirePack` middleware) access control.

### Key Features
- **CRM Module**: Manages deals, leads, contacts, companies, pipelines, activities, email sequences, and marketing automation. Includes relationship management and a premium prospecting/outreach add-on.
- **Due Diligence Module**: Project management with task tracking and template management, integrated with CRM for deal conversion.
- **Rent Roll Module**: Manages marina unit occupancy and rental income, with real-time Customer Analytics (LTV, retention, churn, tenure, churn risk).
- **SalesComps Module**: Marina sales comparables with CSV import/export, Google Maps, and portfolio functionality. Includes institutional-grade data services:
    - **Geocoding Service**: Google Maps integration for address standardization, batch geocoding, place IDs, county/country attribution.
    - **Data Quality Scoring**: 0-100 scoring across completeness, recency, source reliability, and verification status with recommendations.
    - **Validation Rules Engine**: Configurable validation rules per organization, outlier detection (IQR/Z-score), pre-import data validation.
    - **Comp History Tracking**: Full audit trail, field-level history, version rollback, import batch grouping.
    - **Comp Adjustment Grid**: Appraisal-style adjustments (time, location, size, condition, amenities, market, custom), weighted comparison grids for property valuation.
- **Modeling Projects Module**: Tracks marina valuation, integrated with CRM, DD, and sales comps. Features include:
    - **Dynamic Year Selector**: Project-specific financial period selection.
    - **Operations Data Sync**: Institutional-grade pipeline for operational data.
    - **Exit Strategy Suite**: Tools for exit analysis (Tax Calculator, Net Proceeds, 1031 Exchange, Waterfall Analysis, IRR).
    - **Document Intelligence**: AI-powered document parsing for P&L and Rent Roll with 5-step review workflow (Parse → Categorize → Review Items → Variance Preview → Approve & Apply), department assignment, and formal approval before data application.
    - **Scenario Versioning**: Version history for financial scenarios (Base/Aggressive/Conservative) with approval workflows and locking.
    - **QuickBooks Integration**: OAuth2 for P&L sync with category mapping.
    - **Capital Stack Builder**: Multi-tranche debt and equity structure modeling with detailed financial calculations and fund inheritance.
    - **Pro Forma Engine**: Real-time projections from actuals and assumptions.
    - **Portfolio Roll-ups**: Aggregate views and performance analysis across projects.
- **Fund Management Module** (Add-on Pack): Tracks PE fund lifecycle, capital allocation, fund-level returns, and investor capital accounts. Requires `fund_management` pack activation.
- **LP Portal Module** (Add-on Pack): Dedicated investor portal for LPs with capital account statements, K-1 distribution, and fund performance views. Requires both `fund_management` and `lp_portal` packs.
- **Prospecting Module** (Add-on Pack): Premium prospecting and outreach tools for deal sourcing. Requires `prospecting` pack activation.
- **MarinaMatch Intel Module** (Add-on Pack): AI-powered marina listing aggregation and matching system. Features include:
    - **Market Intel**: Aggregates marina listings from CRE platforms (LoopNet, Crexi, BizBuySell) with deduplication and attribution.
    - **Investment Criteria Profiles**: Configurable weighted scoring across 7 categories (Location, Financial, Operational, Size, Capital, Involvement, CapEx).
    - **Goals Dashboard**: Acquisition target tracking for marinas, revenue, EBITDA, capital deployed with progress visualization.
    - **Automated Matching**: AI-powered scoring engine that ranks listings against user-defined investment criteria.
    - **Legal Compliance**: robots.txt checking, rate limiting, user agent attribution, source attribution for scraped data.
    - Requires `prospecting` pack activation.
- **Marketing Module**: Tracks campaigns, expenses, and lead attribution.
- **Fuel Sales & Ship Store Modules**: POS/inventory systems with analytics and portfolio management.
- **Virtual Data Room (VDR) Module**: Secure document management with hierarchical folders, granular permissions, external user management, diligence request workflows, and audit logging.
- **DockTalk 2.0 Module**: Marina industry intelligence platform with AI-powered RSS aggregation, M&A deal tracking, sentiment analysis.
- **Launch Operations Module (Dockit)**: Manages marina launch and haul scheduling, transient slips, employee assignments, with CRM and Rent Roll integration.
- **Market Demographics Module**: Regional market analysis using FRED and Census Bureau APIs for state-level economic indicators and location-based demographics with configurable trade areas and caching.

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
- **date-fns**, **date-fns-tz**: Date and timezone utilities.
- **zod**: Schema validation.

### UI and Component Libraries
- **@radix-ui/react-***: Headless UI primitives.
- **lucide-react**: Icon library.
- **tailwindcss**: CSS framework.
- **shadcn/ui**: Component library.

### Development and Build Tools
- **vite**: Build tool.
- **typescript**: Static type checking.
- **drizzle-kit**: Database migration and introspection.

### AI/External Services
- **Anthropic AI**, **OpenAI**: AI services for DockTalk 2.0.
- **Cheerio**: Web scraping.
- **RSS Parser**: RSS feed processing.
- **Resend**: Email service.
- **FRED API**: Federal Reserve Economic Data.
- **Census Bureau API**: Demographic data.
- **QuickBooks API**: Financial data synchronization.
- **Google Maps Services**: Geocoding and address standardization for Sales Comps.