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
- **SalesComps Module**: Marina sales comparables management with CSV import/export, project grouping, rate analysis, Google Maps address autocomplete, organization-based multi-tenancy, portfolio functionality, and customizable storage types.
- **SalesComps-CRM Properties Integration**: Automatic property matching during CSV import based on marina name, city, and state. Unmatched comps create pending property profile tasks with banner notifications on Properties page.
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