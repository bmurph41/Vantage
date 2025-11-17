# Ship Store POS System

## Overview

This is a production-ready Point of Sale (POS) and Financial Management system designed for PE firm use, featuring inventory management, transaction processing, sophisticated financial modeling, audit trail compliance, and payment integration. The application provides a modern web-based interface for managing retail operations with professional-grade reporting and compliance features.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript for type safety and modern component patterns
- **Routing**: Wouter for lightweight client-side routing
- **State Management**: TanStack Query (React Query) for server state management and caching
- **UI Components**: Radix UI primitives with shadcn/ui component library for consistent design
- **Styling**: Tailwind CSS with CSS custom properties for theming
- **Build Tool**: Vite for fast development and optimized production builds

### Backend Architecture
- **Runtime**: Node.js with Express.js framework
- **Language**: TypeScript for full-stack type safety
- **API Design**: RESTful API with structured error handling and request logging
- **Development**: Hot module replacement with Vite integration for seamless development experience

### Data Storage
- **Database**: PostgreSQL with Neon serverless hosting
- **ORM**: Drizzle ORM for type-safe database queries and schema management
- **Connection**: Connection pooling with @neondatabase/serverless
- **Migrations**: Drizzle Kit for database schema migrations and version control

### Authentication & Authorization
- **Session Management**: PostgreSQL-backed sessions using connect-pg-simple
- **User Roles**: Role-based access control with manager and user roles
- **Security**: Password hashing and secure session storage

### Payment Processing
- **Primary**: Stripe integration with React Stripe.js for card payments
- **Secondary**: Square payment processing (configured but not fully implemented)
- **Fallback**: Cash transaction support with manual recording
- **Webhooks**: Stripe webhook handling for payment confirmation and transaction updates

### Application Structure
- **Modular Pages**: Separate pages for Dashboard, POS, Inventory, Financial, Reports, Transactions, and Settings
- **Shared Components**: Reusable UI components for product grids, shopping cart, and charts
- **Type Safety**: Shared schema definitions between frontend and backend using Zod validation
- **Error Handling**: Comprehensive error boundaries and user feedback through toast notifications

### Key Features
- **Real-time Dashboard**: Live sales metrics, transaction counts, and low stock alerts
- **POS Interface**: Product grid with barcode scanning, shopping cart, and multiple payment options
- **Inventory Management**: Product CRUD operations, category management, and stock tracking
- **Financial Modeling**: Multi-scenario pro forma projections with customizable assumptions and baseline data
- **Historical Data Import**: CSV/Excel import with intelligent column mapping for accurate baseline establishment
- **Audit Trail & Compliance**: Complete audit logging of all data changes for PE firm compliance and SOX requirements
- **Transaction History**: Complete transaction records with receipt generation capabilities

### Compliance & Audit Features (PE Firm Ready)
- **Audit Logs**: Automatic tracking of all create/update/delete operations across scenarios, assumptions, projections, and historical data
- **Change Tracking**: Before/after data snapshots with field-level change detection
- **User Attribution**: IP address and user agent tracking for all operations
- **Metadata Support**: Rich context for bulk operations (import counts, date ranges, generation parameters)
- **Audit Viewer UI**: Professional audit log interface with filtering, drill-down, and export capabilities
- **Compliance Ready**: Full audit trail for SOX compliance and PE due diligence

### Recent Changes (November 2025)

### Production Readiness Implementation (November 17, 2025)
- **Security**: Added JWT authentication middleware, Helmet security headers, CORS configuration, rate limiting
- **Monitoring**: Implemented Winston structured logging, health check endpoints (/api/health, /api/health/ready, /api/health/live)
- **Performance**: Created database indexes on all high-volume query tables (transactions, audit_logs, products)
- **Configuration**: Built environment validation system with fail-fast on missing required variables
- **Integration**: Designed for parent app integration with documented REST API contract and payment webhook support
- **Error Handling**: Global error handler with structured logging and user attribution
- **Documentation**: Created comprehensive production readiness guide (PRODUCTION_READINESS.md)

### Feature Updates (Previous)
- Added comprehensive audit trail system with database schema, storage methods, API routes, and UI viewer
- Implemented CSV/Excel historical data import with intelligent column mapping and data validation
- Built pro forma projection engine with scenario management and customizable assumptions
- Integrated audit logging on all critical financial operations (scenarios, assumptions, imports, generation)
- Removed financial modeling UI (backend kept for API access) - parent app will handle financial features
- Enhanced dashboard with growth metrics, velocity metrics, and trend analysis
- Built full-featured audit page with search, filtering, pagination, and detail modals

## External Dependencies

### Core Infrastructure
- **Database**: Neon PostgreSQL serverless database
- **Hosting**: Configured for Replit deployment with custom build scripts

### Payment Services
- **Stripe**: Credit card processing, payment intents, and webhook handling
- **Square**: Secondary payment processor (configured for future implementation)

### UI & Styling
- **Radix UI**: Accessible component primitives for complex UI elements
- **Tailwind CSS**: Utility-first CSS framework with custom design system
- **Lucide React**: Icon library for consistent iconography

### Development Tools
- **TypeScript**: Static type checking across the entire stack
- **Zod**: Runtime type validation and schema definition
- **React Hook Form**: Form state management with validation
- **Date-fns**: Date manipulation and formatting utilities

### Charts & Analytics
- **Recharts**: Data visualization library for sales charts and analytics
- **React Query**: Data fetching, caching, and synchronization

The architecture emphasizes type safety, developer experience, and scalability while maintaining a clean separation of concerns between the frontend, backend, and data layers.