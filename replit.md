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
- **SalesComps Module**: Marina sales comparables with CSV import/export, Google Maps integration, portfolio functionality, and automatic creation/linking to CRM Property records.
- **Modeling Projects Module**: Tracks marina valuation projects for PE firms, linking to CRM contacts, DD projects, sales comps, and offering analytics dashboards.
- **Marketing Module**: Tracks campaigns (multi-channel), expenses, lead attribution, and integrates with email platforms, providing analytics and multi-tenancy.
- **Fuel Sales Module**: Manages fuel operations including dashboard, transactions, inventory, analytics, and reports. Supports integration with industry-standard fuel management systems (e.g., FuelCloud) via a provider-agnostic interface and handles robust data synchronization.
- **Virtual Data Room (VDR) Module**: Enterprise-grade secure document management system with hierarchical folder structure, granular permission system, external user management, diligence request workflows, comprehensive audit logging, and file integrity validation (SHA-256). Currently uses local filesystem storage with provider abstraction for future S3 support. Multi-tenant with organization-level isolation. Backend infrastructure complete; frontend UI pending implementation.
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