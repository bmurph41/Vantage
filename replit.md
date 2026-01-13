# MarinaMatch Platform

## Overview
MarinaMatch is a comprehensive full-stack platform designed to manage the entire lifecycle of marina acquisition projects, from initial lead generation through to project completion. It unifies CRM functionalities with advanced Due Diligence Tracking and a robust deal pipeline. The platform centralizes complex marina transaction management, aiming to enhance efficiency and provide analytical insights for successful acquisitions. Key capabilities include Rent Roll management, Sales Comparables analysis, sophisticated Modeling Projects with an Exit Strategy Suite, AI-powered Document Intelligence, Marketing automation, Fuel Sales, Ship Store management, and a secure Virtual Data Room (VDR).

## User Preferences
Preferred communication style: Simple, everyday language.

**Code Editing Guidelines:**
- Always preserve existing formatting - do not edit formatting unless specifically requested
- Build incrementally on the existing app - never replace what is not suggested to change
- Make only minimal changes needed for the specific request
- Maintain existing code structure and patterns

## System Architecture

### UI/UX Decisions
The platform uses React 18 with TypeScript and Wouter for routing. The UI is built with shadcn/ui (on Radix UI), styled using Tailwind CSS with CSS variables, and uses Lucide-React for icons, ensuring mobile optimization. Navigation is structured with a "Pack System" for modular premium features and a consolidated "Deal Workspace" for project-specific tabs, alongside "Market Intelligence" and "Analysis" sections.

### Technical Implementations
- **Frontend**: React 18, TypeScript, Wouter, TanStack Query, React Hook Form with Zod.
- **Backend**: Express.js with TypeScript, RESTful API, Drizzle ORM.
- **Authentication**: Session-based, multi-tenant with PostgreSQL, RBAC, Zod validation, SQL injection prevention, audit trails.
- **Data Modeling**: Multi-case modeling with database-backed scenarios, Addbacks system for EBITDA normalization, and a Financial Kernel for enterprise-grade financial data (feature-flagged).
- **Document Processing**: P&L Pipeline V2 for document extraction with human-in-the-loop review, OCR and LLM classification abstraction layers, and a marina-specific Chart of Accounts. Rent Roll Document Parser (`server/services/rent-roll-document-parser.ts`) provides unified CSV/Excel/PDF parsing with AI-powered extraction and heuristic fallbacks for QuickBooks, transaction reports, and marina-specific formats.
- **Content Aggregation**: DockTalk 2.0 for industry intelligence with an institutional-grade scraper (feature-flagged) and Listing Ingestion V2 for robust listing aggregation (feature-flagged).
- **OM Builder**: Professional offering memorandum creation with data binding and PDF export.
- **Cross-Module Architecture**: Comprehensive system for connecting CRM, Due Diligence, Modeling, and DockTalk via database schema consolidation, a query key factory for cache invalidation, a Deal Orchestrator Service, Entity Linking API, and a Cross-Module Event System.

### Feature Specifications
- **CRM**: Deals, leads, contacts, pipelines, activities, email sequences, marketing automation, user-defined lists, property status tracking, entity relationship management, and Comment Threads with @mentions and notifications.
- **Due Diligence**: Project management, task tracking, template management, and DD Fees Tracker.
- **Rent Roll V2**: Marina-centric lease management with normalized schema including marina projects, storage locations, tenants, leases with line items, cash flows, move events, and period snapshots. Supports seasonal/year-round operations, contract term groups (annual/seasonal/winter/short-term), and CRM/DD integrations.
- **SalesComps**: Marina sales comparables with import/export, Google Maps integration, validation, and history tracking.
- **Modeling Projects**: Marina valuation, dynamic year selection, operations data sync, Exit Strategy Suite, AI-powered Document Intelligence, Scenario Versioning, QuickBooks Integration, Capital Stack Builder, Pro Forma Engine, Portfolio Roll-ups, Multi-Case Modeling, Addbacks System, and Excel Model Export.
- **Operations Modules**: Fuel Sales, Ship Store, Dockit (scheduling), and Marketing.
- **Virtual Data Room (VDR)**: Secure document management with granular permissions, external user management, and audit logging.
- **DockTalk 2.0**: Industry intelligence, AI-powered RSS aggregation, M&A tracking, and sentiment analysis.
- **Listing Ingestion V2**: Institutional-grade listing aggregation pipeline with identity resolution, verified asset binding, validation, and SSRF protection.
- **Analytics**: Marina KPI Calculator, ancillary revenue tracking, benchmarking, and Unified Cross-Module Analytics Dashboard (`/api/analytics/unified`) aggregating CRM, DD, Modeling, and DockTalk metrics with trend visualization.
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

## Security Requirements

### Email Marketing Module
- **Token Encryption**: OAuth tokens stored using AES-256-GCM encryption
- **Required Secrets**: `EMAIL_MARKETING_ENCRYPTION_KEY` or `JWT_SECRET` must be set (min 16 chars) - no fallback allowed
- **OAuth State**: Server-side nonce validation with single-use cryptographic nonces, 10-minute expiration, tenant-scoped
- **Token Refresh**: Automatic token refresh with connection deactivation on failure
- **Multi-tenancy**: All queries scoped by both userId AND orgId