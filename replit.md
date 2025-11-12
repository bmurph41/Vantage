# MarinaMatch Platform

## Overview

MarinaMatch is a full-stack platform designed for managing marina acquisition projects. It integrates comprehensive CRM functionalities with Due Diligence Tracking. The platform enables deal pipeline management, lead and contact tracking, and automates the due diligence workflow within a single React-based application. It aims to streamline the acquisition process from initial lead to project completion.

## User Preferences

Preferred communication style: Simple, everyday language.

**Code Editing Guidelines:**
- Always preserve existing formatting - do not edit formatting unless specifically requested
- Build incrementally on the existing app - never replace what is not suggested to change
- Make only minimal changes needed for the specific request
- Maintain existing code structure and patterns

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript.
- **Routing**: Wouter.
- **UI Components**: shadcn/ui built on Radix UI primitives.
- **Styling**: Tailwind CSS with CSS variables.
- **State Management**: TanStack Query (React Query) for server state.
- **Form Handling**: React Hook Form with Zod validation.
- **Date Management**: date-fns library.
- **Mobile Responsiveness**: Full optimization with responsive navigation (hamburger menu), `ResponsiveTable` component, touch-friendly shadcn forms, and mobile-optimized drag-and-drop (`@dnd-kit`).

### Backend Architecture
- **Server Framework**: Express.js with TypeScript.
- **API Design**: RESTful endpoints with consistent error handling and logging.
- **Database Integration**: Drizzle ORM.
- **Authentication**: Session-based with multi-tenant support.
- **File Upload System**: Multer-based with 10MB limit, storing files in `server/uploads/crm` with metadata in `crm_files` table.

### Data Storage Solutions
- **Primary Database**: PostgreSQL with Neon serverless hosting.
- **ORM**: Drizzle ORM with a schema-first approach.
- **Schema Design**: Multi-tenant architecture for organizations, users, projects, and tasks.
- **Migration System**: Drizzle Kit.
- **Connection Pooling**: Neon serverless pool.

### Authentication and Authorization
- **Multi-tenancy**: Organization-based data isolation with role-based access control (Owner, Editor, Viewer).
- **Session Management**: Express sessions with PostgreSQL session store.
- **Security**: Zod schema validation and SQL injection prevention.

### Key Features Implementation
- **CRM Module**: Manages deals, leads, contacts, companies, pipelines, activities, email sequences, and marketing automation.
- **Due Diligence Module**: Project management with task tracking, Gantt-style timeline visualization, template management, and progress reporting. "All Projects" serves as the default landing page.
- **CRM-DD Integration**: Ability to convert CRM deals into DD projects with automatic task creation and contact mapping.
- **Rent Roll Module**: Comprehensive rent roll management for marina unit occupancy and rental income tracking. Features include:
  - **Context-Aware Scenarios**: Separate operational and valuation rent rolls for current operations vs. acquisition/appraisal analysis
  - **Unit Management**: Track slips, racks, commercial spaces, and seasonal rentals with customizable entry types
  - **Occupancy Analytics**: Real-time summary metrics including total units, occupancy rate, monthly revenue, and average rate per unit
  - **Entry Details**: Unit number, tenant name, monthly rate, lease dates, status (occupied/vacant/reserved), and notes
  - **Project Linking**: Optional association with DD projects and external facility IDs for integration workflows
  - **Multi-Tenancy**: Full org-based data isolation with comprehensive authorization checks preventing cross-tenant data leakage
  - **CRUD Operations**: Dialog-based create, edit, and delete flows with proper validation and cache invalidation
  - **Smart Selection**: Context switcher automatically resets selection when switching between operational and valuation scenarios
  - **Responsive UI**: Mobile-optimized table, forms, and navigation positioned in Operations section above Customer Analytics
- **SalesComps Module**: Marina sales comparables management with CSV import/export, project grouping, rate analysis, Google Maps address autocomplete, organization-based multi-tenancy, portfolio functionality, and customizable storage types.
- **SalesComps-CRM Properties Integration**: Every sales comp automatically creates or links to a CRM Property record. During import, the system matches existing properties by marina name, city, and state. When no match is found, a new Property record is auto-created with marina details, status, and listing price from the comp data. This ensures every comp has a corresponding property page for CRM workflows. Legacy data backfilled successfully (1,585 comps → 1,487 properties: 1,462 created, 98 matched).
- **Analytics/Metrics Module**: Deep-dive comparative analysis for sales comps with statistical calculations (averages, medians, percentiles), filtering by state, price point, year sold, water type, and capacity. Features trend analysis, recharts visualizations (line charts, bar charts, pie charts), automated insights generation, and metrics tracking with alert capabilities.
- **Fuel Sales Module**: Complete fuel operations management with Dashboard, Transactions, Inventory, Analytics, Reports, and Financial Model pages. All analytics use EST timezone (America/New_York) with 5:00 PM business-day cutoff for consistent metrics.
- **Fuel Software Integration**: Full integration architecture supporting industry-standard fuel management systems (FuelCloud, MARINAGO, Dockwa, MarinaOffice). Features include:
  - Provider-agnostic interface pattern with registry system
  - FuelCloud API integration with OAuth, automatic token refresh, and retry logic
  - CSV import with drag-and-drop, field mapping, validation, and duplicate detection
  - QuickBooks export with GL account mapping and journal entry format
  - Integration Settings page for managing API credentials and sync configuration
  - Import History tracking with detailed logs, error reporting, and statistics dashboard
  - Idempotent data sync using external transaction IDs for deduplication
  - Resilient error handling with exponential backoff and partial success support
  - **Institutional-Grade Compliance & Security** (November 2025):
    - **Role-Based Access Control (RBAC)**: Organization-level user roles (Owner, Admin, Editor, Viewer, Auditor) with granular permission system for fuel operations
    - **Comprehensive Audit Trail**: Immutable event logging with before/after snapshots, change tracking, user/IP/session context capture for SOC 2/GDPR compliance
    - **Audit Service**: Centralized logging infrastructure (`server/services/audit-service.ts`) with automatic context injection, diff calculation, and severity levels
    - **RBAC Middleware**: Permission checking system (`server/middleware/rbac.ts`) with route protection, approval workflow enforcement, and role-based filtering
    - **Permission Matrix**: Fine-grained permissions including fuel operations (read/create/update/delete/export/import), integration management, period locking, approval workflows, and audit access
    - **Security Foundation**: Supports approval workflows for sensitive operations, period locking for financial controls, and comprehensive change history
    - **Database Schema**: `organization_user_roles` table for RBAC, enhanced `audit_logs` table with full context tracking and metadata
- **Marketing Automation**: Multi-step email sequences with templates and enrollment tracking for contacts, leads, and deals.
- **File Attachment System**: Comprehensive file upload, listing, download, and deletion for CRM entities.
- **Bulk Actions**: Multi-select, bulk delete, and CSV export for Contacts, Companies, and Deals.
- **Task Kanban Board**: Drag-and-drop task management with status changes, inline creation, filters, and metrics.
- **Global Search**: Smart search across Contacts, Companies, and Deals with fuzzy matching and Cmd+K shortcut.
- **Calendar Integration**: Google Calendar integration for CRM activities and DD tasks with sync capabilities, settings, and ICS export.
- **Currency Formatting**: `CurrencyInput` component with automatic comma formatting for money input fields.
- **Progress Tracking**: Automated progress bars based on effective dates.
- **Timeline Management**: Gantt-style visualization with business day calculations.
- **Template System**: Reusable project and task templates.
- **CSV Import/Export**: Data interchange capabilities.
- **Holiday Calendar Integration**: US Federal holiday support for business day calculations.
- **Task Dependencies**: Multi-select dependency management.

### Future Integration Requirements
- **Financial Model Integration**: Transaction costs and timeline data from this platform will integrate into a Financial Model app once merged into a monorepo.

## External Dependencies

### Core Runtime Dependencies
- **@neondatabase/serverless**: Serverless PostgreSQL driver.
- **drizzle-orm**: Type-safe ORM.
- **express**: Web framework.
- **@tanstack/react-query**: Server state management.
- **wouter**: Lightweight routing.
- **react-hook-form**: Form library.
- **multer**: Middleware for handling `multipart/form-data`.
- **@dnd-kit**: Drag and drop toolkit for React.

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

### Date and Time Processing
- **date-fns**: Date utility library.
- **date-fns-tz**: Timezone support.

### Validation and Schema Management
- **zod**: TypeScript-first schema validation.
- **drizzle-zod**: Drizzle ORM and Zod integration.
- **@hookform/resolvers**: Validation resolvers for React Hook Form.