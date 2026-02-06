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

**Reusable UI Components (client/src/components/ui/):**
- `skeleton-variants.tsx`: SkeletonTableRows, SkeletonCard, SkeletonKPICard, SkeletonKPIGrid, SkeletonTextBlock, SkeletonList, SkeletonChart, SkeletonForm
- `empty-state.tsx`: EmptyState component with icon, title, description, and CTA props
- `inline-banner.tsx`: InlineBanner with info/success/warning/error variants for contextual messaging
- `bulk-action-bar.tsx`: BulkActionBar floating component for table row selections

**Keyboard Shortcuts:**
- Cmd/Ctrl+K: Opens command palette
- "/": Opens command palette (when not in input fields)
- ESC: Closes modals/dialogs
- Reusable hook: `use-keyboard-shortcut.ts` for custom shortcuts

### Technical Implementations
- **Frontend**: React 18, TypeScript, Wouter, TanStack Query, React Hook Form with Zod.
- **Backend**: Express.js with TypeScript, RESTful API, Drizzle ORM.
- **Authentication**: Session-based, multi-tenant with PostgreSQL, RBAC, Zod validation, SQL injection prevention, audit trails. Includes email verification via SendGrid, magic link login (15min expiry), and password-free authentication options. Phone/SMS verification can be added later via Twilio (user dismissed integration setup).
- **Data Modeling**: Multi-case modeling with database-backed scenarios, Addbacks system for EBITDA normalization, and a Financial Kernel for enterprise-grade financial data (feature-flagged).
- **Document Processing**: P&L Pipeline V2 for document extraction with human-in-the-loop review, OCR and LLM classification abstraction layers, and a marina-specific Chart of Accounts. Rent Roll Document Parser (`server/services/rent-roll-document-parser.ts`) provides unified CSV/Excel/PDF parsing with AI-powered extraction and heuristic fallbacks for QuickBooks, transaction reports, and marina-specific formats.
- **Content Aggregation**: DockTalk 2.0 for industry intelligence with an institutional-grade scraper (feature-flagged) and Listing Ingestion V2 for robust listing aggregation (feature-flagged).
- **OM Builder**: Professional offering memorandum creation with data binding and PDF export.
- **Cross-Module Architecture**: Comprehensive system for connecting CRM, Due Diligence, Modeling, and DockTalk via database schema consolidation, a query key factory for cache invalidation, a Deal Orchestrator Service, Entity Linking API, and a Cross-Module Event System.
- **Marina Integration Adapters**: Abstract adapter framework for connecting to 10+ marina management systems (DockMaster, Dockwa, Storable Marine, Marina Office) with OAuth handling, rate limiting, retry logic, and automatic sync recording.
- **Operations Data Sync**: Pipeline connecting Fuel Sales, Rent Roll V2, and Ship Store modules to marina integrations with real-time sync capabilities. Pro Forma Engine now pulls operational data from all 8 profit center assumption tables (fuel, ship store, service, boat rentals, boat club, boat sales, commercial tenants, bookkeeping) via `enrichFromProfitCenters()`.
- **Valuator Profit Centers**: 6-tab interface (Summary, Fuel Sales, Ship Store, Service Dept, Boat Rentals, Bookkeeping) with full CRUD, CSV import/export, and edit dialogs on all tabs. CSV import uses client-side parsing with column auto-detection. Commercial Tenants tab uses unified `commercialTenants` table via `/api/valuator/:projectId/leases` routes.
- **Exit Strategy Persistence**: Frontend wired to backend CRUD at `/api/modeling/projects/:projectId/exit/scenarios` with Save Scenario button, scenarioType-based lookup (cash_sale=base, exchange_1031=aggressive, seller_financing=conservative).
- **Unified Analytics Dashboard**: Cross-module analytics aggregating metrics from CRM, DD, Modeling, and Operations with time period filtering and trend visualization.
- **OM Builder**: Professional offering memorandum generation with template system, multi-module data aggregation, and PDF export.

### Dual-Sourced Data Architecture
The platform implements a dual-sourced data model separating "Universal/Global" curated data from user-specific data:

**Data Scopes** (dataScopeEnum: global/org/user):
- **Global**: MarinaMatch curated data - available to pack subscribers only
- **Organization**: Org-specific data - visible to org members
- **User**: User-created data - private to the creator

**Curated Data Tables**:
- `salesComps`: Has scope, requiredPack, isCurated, curatedByUserId, curatedAt columns
- `rateComps`: Has scope, requiredPack, isCurated, curatedByUserId, curatedAt columns
- `industryStandards`: Global benchmarks with category, region, metrics, and pack-gated access
- `marinaListings`: Global listings with scope, requiredPack, isCurated, curatedByUserId, curatedAt columns
- `marinaScrapeources`: Global scrape sources with scope and isGlobalSource columns

**Admin Routes** (`/api/admin/curated/*`): Manage global curated data (owner/admin role required)
- `/api/admin/curated/listings` - CRUD for global marina listings
- `/api/admin/curated/listings/:id/promote` - Promote org listing to global
- `/api/admin/curated/listings/:id/demote` - Demote global listing to org-scoped
- `/api/admin/curated/scrape-sources` - CRUD for global scrape sources
- `/api/admin/curated/scrape-sources/:id/scrape` - Trigger scrape for a global source
- `/api/admin/curated/stats` - Dashboard stats for all curated data types

**Admin Dashboard** (`/admin/curated-data`): UI for managing global curated data with tabs for Overview, Listings, Sources, Sales Comps, Rate Comps, and Industry Standards

**Pack Access Control**: Users see global data only if they have the required pack subscription


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
- **AI Assistant**: Context-aware chatbot (`/api/ai-assistant`) powered by GPT-5 with streaming responses, page-specific suggested questions, and platform knowledge base covering all modules. Appears as floating chat bubble in authenticated pages.
- **Add-on Packs**: Fund Management, LP Portal, Prospecting, and MarinaMatch Intel.

### System Design Choices
- **Database**: PostgreSQL with Neon serverless hosting, Drizzle ORM, schema-first, Drizzle Kit for migrations.
- **Multi-tenancy**: Organization-based data isolation.
- **VDR Permission System**: Hierarchical, 5-level granular permissions with caching.
- **File Uploads**: Multer-based, 10MB limit, local storage.
- **Webhook Idempotency**: In-memory storage.

### Schema Column Naming Conventions
Different tables use different column names for organization filtering:
- **CRM tables** (`crm_contacts`, `crm_companies`, `crm_properties`): Use `orgId` column
- **CRM Deals** (`crm_deals`): Uses `ownerId` for filtering (no direct org column)
- **DD Projects** (`projects`): Uses `orgId` column
- **Modeling Projects** (`modeling_projects`): Uses `orgId` column
- **Articles** (`articles`): Uses `organizationId` column (table may not exist in all environments)

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

### Authentication & Authorization
- **Auth Resolver Middleware** (`server/middleware/auth-resolver.ts`): Global middleware chain for validating tenant/user identity
- **Strict Org Guards**: Production mode enforces authenticated org/user; development allows mock auth via `DEV_ALLOW_ANON_ORG` flag
- **Multi-tenancy Isolation**: All data queries scoped by orgId to prevent cross-tenant access
- **Platform Audit Service** (`server/services/platform-audit-service.ts`): Comprehensive audit logging for rent roll, modeling, CRM, DD operations, security events, and bulk operations

### Input Validation
- **Financial Validators** (`client/src/lib/financial-validators.ts`): Sanitization for numbers, percentages, holding periods with NaN/negative prevention
- **Import Validators** (`server/lib/import-validators.ts`): Zod schemas for rent roll and sales comp bulk imports with row-level error reporting
- **Exit Strategies Store**: Automatic input sanitization and real-time validation warnings tracking

### Email Marketing Module
- **Token Encryption**: OAuth tokens stored using AES-256-GCM encryption
- **Required Secrets**: `EMAIL_MARKETING_ENCRYPTION_KEY` or `JWT_SECRET` must be set (min 16 chars) - no fallback allowed
- **OAuth State**: Server-side nonce validation with single-use cryptographic nonces, 10-minute expiration, tenant-scoped
- **Token Refresh**: Automatic token refresh with connection deactivation on failure
- **Multi-tenancy**: All queries scoped by both userId AND orgId

## UI Standards (MM-UI Design System)

### Documentation
All UI standards are documented in `/docs/ui/`:
- `MM-UI-MODAL-001.md` - Canonical modal standard (single-step and wizard modals)
- `MM-UI-FORM-STANDARD-001.md` - Universal form and component standards

### Component Library Location
MM-UI components are located in `client/src/components/mm-ui/`:
- `MMModal` - Base modal with header, blue divider, pinned footer
- `MMModalWizard` - Multi-step wizard with progress dots
- `MMInput`, `MMEmailInput`, `MMPhoneInput`, `MMCurrencyInput` - Text inputs
- `MMSelect`, `MMStateSelect` - Dropdown selects
- `MMTextarea` - Multi-line text input
- `MMComboBox` - Searchable autocomplete
- `MMRadioCardGroup` - Visual card selection
- `MMField` - Field wrapper with label/error

### Usage
```tsx
import { MMModal, MMInput, MMSelect } from '@/components/mm-ui';

<MMModal
  open={isOpen}
  onOpenChange={setIsOpen}
  title="Modal Title"
  subtitle="Optional subtitle"
  icon={<SomeIcon />}
  footerLeft={<Button variant="ghost">Cancel</Button>}
  footerRight={<Button>Save</Button>}
>
  <MMInput label="Name" required />
</MMModal>
```

### Demo Page
Navigate to `/mm-ui-demo` to see all MM-UI components in action with:
- 3-step project wizard demo
- Contact form modal demo

### Compliance
All new modals MUST use MM-UI components. See the compliance checklist in `MM-UI-MODAL-001.md`.