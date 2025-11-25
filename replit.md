# MarinaMatch Platform

## Overview
MarinaMatch is a full-stack platform designed to manage marina acquisition projects. It integrates comprehensive CRM functionalities with Due Diligence Tracking, enabling deal pipeline management, lead and contact tracking, and automated due diligence workflows. The platform, built on React, aims to streamline the acquisition process from initial lead to project completion, offering a unified solution for managing complex marina transactions.

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
- **UI/Styling**: shadcn/ui (built on Radix UI), Tailwind CSS with CSS variables, Lucide-React for icons.
- **State Management**: TanStack Query for server state.
- **Form Handling**: React Hook Form with Zod validation.
- **Date Management**: date-fns.
- **Responsiveness**: Full mobile optimization with responsive components and `@dnd-kit` for drag-and-drop.

### Backend
- **Framework**: Express.js with TypeScript.
- **API**: RESTful design, consistent error handling, logging.
- **Database ORM**: Drizzle ORM.
- **Authentication**: Session-based, multi-tenant.
- **File Uploads**: Multer-based, 10MB limit, files stored in `server/uploads/crm` with metadata in `crm_files` table.

### Data Storage
- **Database**: PostgreSQL with Neon serverless hosting.
- **ORM**: Drizzle ORM with schema-first approach.
- **Schema**: Multi-tenant architecture for organizations, users, projects, tasks.
- **Migrations**: Drizzle Kit.
- **Webhook Idempotency**: Uses in-memory storage to prevent duplicate webhook processing. Retention period is 24 hours with automatic cleanup.

### Authentication and Authorization
- **Multi-tenancy**: Organization-based data isolation, role-based access control (Owner, Editor, Viewer).
- **Session Management**: Express sessions with PostgreSQL session store.
- **Security**: Zod schema validation, SQL injection prevention.
- **Institutional-Grade Compliance & Security**: Implements Role-Based Access Control (RBAC) with granular permissions, comprehensive audit trails, and an Audit Service for SOC 2/GDPR compliance. Includes RBAC middleware for route protection and approval workflows.
- **VDR Permission System**: Hierarchical permission inheritance (document → folder → parent folder → project → no_access). Five permission levels: no_access (blocked), view_only (read metadata), view_download (access content), view_download_print (print content), full_access (modify documents and manage permissions). Secure-by-default with 60-second cache invalidation. Permission service validates access before all operations.

### Key Features
- **CRM Module**: Manages deals, leads, contacts, companies, pipelines, activities, email sequences, and marketing automation.
- **Due Diligence Module**: Project management with task tracking, Gantt charts, template management.
- **CRM-DD Integration**: Convert CRM deals to DD projects with automated task and contact mapping. DD tasks can link to CRM companies and contacts via foreign keys, tracking which third-party firms and representatives are working on each task. Supports both CRM entity selection (with auto-population of contact details) and manual text entry for non-CRM entities.
- **Rent Roll Module**: Manages marina unit occupancy and rental income, supporting operational and valuation scenarios, occupancy analytics, and unit management.
- **SalesComps Module**: Marina sales comparables with CSV import/export, Google Maps integration, portfolio functionality, and automatic creation/linking to CRM Property records. Portfolio comps create pending properties only for child comps (individual marinas), not for the portfolio parent. Buyer/seller companies and broker contacts automatically create pending entities for CRM review workflow.
- **Modeling Projects Module**: Tracks marina valuation projects for PE firms, linking to CRM contacts, DD projects, sales comps, and offering analytics dashboards. **Exit Strategy Suite**: Integrated institutional-grade exit analysis tools accessible via the Exit Strategy button on each modeling project. Suite includes: Tax Calculator (capital gains, depreciation recapture, federal/state/NIIT analysis), Net Proceeds (cash-on-cash waterfall), 1031 Exchange Planner (45/180-day timeline tracking, boot calculations), DST Analysis (Delaware Statutory Trust comparison modeling), Seller Financing (installment sale with amortization schedules), Earnout Modeling (contingent payments with probability weighting), Waterfall Analysis (GP/LP distribution with preferred returns and carried interest), IRR Calculator (multi-period returns with NPV at various discount rates), Sensitivity Analysis (NOI/Cap Rate matrix explorer), and AI Insights (OpenAI-powered exit recommendations). All exit data is scoped to specific modeling projects and organizations, maintaining multi-tenant isolation. Database schema includes 11 tables (exit_scenarios, exit_tax_calculations, exit_net_proceeds, exit_1031_exchanges, exit_dst_investments, exit_seller_financing, exit_earnout_structures, exit_waterfall_structures, exit_irr_analyses, exit_sensitivity_analyses, exit_ai_recommendations) with 6 enums for exit types, tax filing statuses, 1031 statuses, DST types, earnout trigger types, and waterfall types. Calculation engines in shared/exit/ include waterfall-engine.ts, irr-calculator.ts, tax-calculations.ts, and sensitivity-analysis.ts for institutional-grade computations. Routes follow pattern: `/modeling/projects/:projectId/exit/*`. **Document Intelligence**: AI-powered document parsing for P&L and Rent Roll files with QuickBooks-style review workflow. Features include: file upload with drag-and-drop, 5-step review wizard (File Summary, Auto-Map Preview, Line Item Review, Storage Mapping, Train Rules), hierarchical category management (standard P&L categories with marina-specific sub-categories like Wet Slips, Dry Storage, Fuel), confidence scoring for auto-categorization, organization-wide learning from user confirmations while maintaining project-level data isolation. Database tables include doc_pnl_categories (hierarchical org-customizable categories), doc_category_mappings (org-wide text-to-category rules), doc_learning_rules (ML pattern rules with confidence), doc_extracted_items (parsed line items per upload), doc_training_examples (user confirmations for learning), doc_uploads (file metadata), and doc_processing_jobs (async processing). Routes follow pattern: `/modeling/projects/:projectId/doc-intel/*`.
- **Marketing Module**: Tracks campaigns (multi-channel), expenses, lead attribution, and integrates with email platforms, providing analytics and multi-tenancy.
- **Fuel Sales Module**: Manages fuel operations including dashboard, transactions, inventory, analytics, and reports. Supports integration with industry-standard fuel management systems (e.g., FuelCloud) via a provider-agnostic interface and handles robust data synchronization. **Portfolio Management**: Asset selector allows switching between viewing all marinas (portfolio) and individual marina data. Frontend queries include assetId parameter when specific marina is selected.
- **Ship Store Module**: Professional POS/inventory system with product catalog, category management, transactions, analytics, and customer tracking. Features Square/Clover-inspired POS interface, real-time inventory tracking, and sales analytics. **Portfolio Management**: Asset selector integrated across all pages (Dashboard, POS, Inventory, Transactions, Analytics) to support multi-marina operations.
- **Virtual Data Room (VDR) Module**: Enterprise-grade secure document management system with complete MVP implementation. Features include: hierarchical folder structure with drag-and-drop organization, 5-level granular permission system (no_access, view_only, view_download, view_download_print, full_access), external user management with project-scoped access and soft-delete status tracking (active/revoked/expired), diligence request workflows with document linking and comments, comprehensive audit logging with timeline viewer, and file integrity validation (SHA-256). **Data Request Management**: Institutional-grade task tracking with priority levels (urgent/high/medium/low), assignee tracking (internal deal team members and external users), enhanced status workflow (outstanding/in_progress/received/verified/n_a), Kanban board view with filtering, and bulk operations. **Diligence Categories**: Organization-specific configurable categories (Financial, Legal, Operational, Environmental, etc.) with auto-seeding of defaults for new organizations. Categories use stable slugs for data integrity and are managed through the vdr_diligence_categories table. **Due Date Presets**: Quick-select buttons for common due date timeframes (One Week, Two Weeks, One Month) that auto-populate the due date field by adding configured days to today's date. Presets are organization-specific and configurable through the vdr_due_date_presets table. Split-view workspace UI with folder tree navigation and document detail panes. Security enhancements include manage-level VDR permissions for sensitive operations, project-scoped filtering, and expiry warnings for access ending within 7 days. Local filesystem storage with provider abstraction for future S3 support. Multi-tenant with organization-level isolation.
- **DockTalk 2.0 Module**: Full-featured marina industry intelligence platform integrated as optional organization add-on. Accessible at `/docktalk` route with complete feature set including: AI-powered RSS feed aggregation and categorization, M&A deal tracking and entity extraction, real-time WebSocket updates, saved searches with email alerts, user watchlists for entities and companies, sentiment analysis and relevance scoring, duplicate article detection and suppression, portfolio company tracking, comprehensive admin dashboard, and background cron jobs for automated content fetching and enrichment. **Pages**: Dashboard (main feed), Market Intelligence (AI summaries), M&A Spotlight (deal tracking), Saved Articles (bookmarks), Admin (RSS management), Entity Profiles (company analytics). **Architecture**: Uses unified MarinaMatch authentication with automatic shadow user creation via requireMarinaMatchAuth middleware. Multi-tenant with strict orgId isolation for user data (watchlists, saved searches, portfolio companies, notifications) while keeping intelligence content (articles, entities, deals) globally accessible. Modular integration with isolated database tables (docktalk_* prefix), dedicated frontend router with absolute paths (`/docktalk/*`), separate query client with `/api/docktalk` prefix, and independent service layer. **Background Services**: RSS fetching (5min), AI enrichment (15min), alert delivery, analytics updates, and category summarization running via node-cron. **Feature Gating**: Controlled via organization_features table; navigation only visible when DockTalk is enabled for organization. **Technology**: Anthropic AI, OpenAI, Cheerio web scraping, RSS Parser, Resend email service, WebSockets for real-time updates. **Integration Note**: DockTalk is fully integrated into MarinaMatch - no standalone authentication, all components use `@/hooks/useAuth` from main app. **AI Training System**: User tag library (up to 20 tags per user with colors), article tagging for content categorization, and article feedback (helpful, irrelevant, duplicate, low_quality, wrong_category, spam) to train AI relevance scoring. Database tables: docktalk_user_tag_library, docktalk_article_tag_assignments, docktalk_article_feedback. Components: AITraining.tsx for tag management, ArticleFeedback.tsx for article-level feedback. Accessible from Sources page.
- **File Attachment System**: File upload, listing, download, and deletion for CRM entities.
- **Bulk Actions**: Multi-select, bulk delete, and CSV export for core entities.
- **Task Kanban Board**: Drag-and-drop task management.
- **Global Search**: Smart search across Contacts, Companies, and Deals.
- **Calendar Integration**: Google Calendar integration for CRM activities and DD tasks.
- **Progress Tracking**: Automated progress bars based on effective dates.
- **Template System**: Reusable project and task templates.
- **CSV Import/Export**: Data interchange capabilities.

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

### UI and Component Libraries
- **@radix-ui/react-***: Headless UI primitives.
- **lucide-react**: Icon library.
- **tailwindcss**: CSS framework.
- **class-variance-authority**: Utility for variant-based component APIs.
- **cmdk**: Command palette component.
- **shadcn/ui**: Component library.

### Development and Build Tools
- **vite**: Build tool and development server.
- **typescript**: Static type checking.
- **drizzle-kit**: Database migration and introspection.
- **esbuild**: JavaScript bundler.

### Date and Time
- **date-fns**: Date utility library.
- **date-fns-tz**: Timezone support.

### Validation and Schema
- **zod**: TypeScript-first schema validation.
- **drizzle-zod**: Drizzle ORM and Zod integration.
- **@hookform/resolvers**: Validation resolvers for React Hook Form.