# Due Diligence Tracker

## Overview

A full-stack Due Diligence Tracker application for managing marina acquisition projects. The system provides comprehensive project management features including task tracking with automated progress bars, timeline visualization (Gantt-style), template management, and multi-tenant organization support. Built with modern web technologies including React 18, TypeScript, Express, and PostgreSQL.

## User Preferences

Preferred communication style: Simple, everyday language.

**Code Editing Guidelines:**
- Always preserve existing formatting - do not edit formatting unless specifically requested
- Build incrementally on the existing app - never replace what is not suggested to change
- Make only minimal changes needed for the specific request
- Maintain existing code structure and patterns

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript for type safety and modern React features
- **Routing**: Wouter for lightweight client-side routing
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with CSS variables for theming support
- **State Management**: TanStack Query (React Query) for server state management
- **Form Handling**: React Hook Form with Zod validation for type-safe form handling
- **Date Management**: date-fns library for date calculations and timezone handling

### Backend Architecture
- **Server Framework**: Express.js with TypeScript for API routes and middleware
- **API Design**: RESTful endpoints with consistent error handling and logging
- **Database Integration**: Drizzle ORM for type-safe database operations
- **Authentication**: Session-based authentication with multi-tenant support
- **File Structure**: Organized routes, services, and storage layers for separation of concerns

### Data Storage Solutions
- **Primary Database**: PostgreSQL with Neon serverless hosting
- **ORM**: Drizzle ORM with schema-first approach for type safety
- **Schema Design**: Multi-tenant architecture with organizations, users, projects, and tasks
- **Migration System**: Drizzle Kit for database migrations and schema management
- **Connection Pooling**: Neon serverless pool for efficient database connections

### Authentication and Authorization
- **Multi-tenancy**: Organization-based data isolation with role-based access control
- **User Roles**: Owner, editor, and viewer roles with appropriate permissions
- **Session Management**: Express sessions with PostgreSQL session store
- **Security**: Input validation with Zod schemas and SQL injection prevention

### Key Features Implementation
- **Progress Tracking**: Automated progress bars with real-time calculation based on effective dates
- **Timeline Management**: Gantt-style visualization with business day calculations
- **Template System**: Reusable project and task templates for standardization
- **CSV Import/Export**: Data interchange capabilities for external tools
- **Holiday Calendar Integration**: US Federal holiday support for business day calculations
- **Task Dependencies**: Multi-select dependency management with critical path analysis capabilities

### Future Integration Requirements
- **Financial Model Integration**: Transaction costs from this Due Diligence Tracker will flow into the Transaction Costs tab of the related Financial Model app once all applications are merged into a single monorepo. This app serves as the primary driver for transaction cost details and timeline data.

## External Dependencies

### Core Runtime Dependencies
- **@neondatabase/serverless**: Serverless PostgreSQL database driver for Neon hosting
- **drizzle-orm**: Type-safe ORM for database operations and query building
- **express**: Web framework for API server and routing
- **@tanstack/react-query**: Server state management and caching for React
- **wouter**: Lightweight routing library for React applications
- **react-hook-form**: Performance-focused form library with validation

### UI and Component Libraries
- **@radix-ui/react-***: Headless UI primitives for accessible components
- **lucide-react**: Icon library with consistent SVG icons
- **tailwindcss**: Utility-first CSS framework for styling
- **class-variance-authority**: Utility for creating variant-based component APIs
- **cmdk**: Command palette component for enhanced user interactions

### Development and Build Tools
- **vite**: Fast build tool and development server with HMR
- **typescript**: Static type checking for enhanced developer experience
- **drizzle-kit**: Database migration and introspection toolkit
- **esbuild**: Fast JavaScript bundler for production builds

### Date and Time Processing
- **date-fns**: Modern date utility library for calculations and formatting
- **date-fns-tz**: Timezone support for accurate date handling across regions

### Validation and Schema Management
- **zod**: TypeScript-first schema validation library
- **drizzle-zod**: Integration between Drizzle ORM and Zod for schema validation
- **@hookform/resolvers**: Validation resolvers for React Hook Form integration