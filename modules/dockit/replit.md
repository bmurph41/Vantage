# Overview

This is a full-stack marina management application built with React, TypeScript, Express.js, and PostgreSQL. The system provides comprehensive management capabilities for marina operations including boat launches, slip inventory, customer management, payments, and third-party integrations. The application features a modern web interface with real-time data synchronization and supports data import/export functionality for integration with existing marina systems.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
- **Framework**: React 18 with TypeScript and Vite for development tooling
- **Routing**: Wouter for client-side routing with declarative route definitions
- **State Management**: TanStack Query (React Query) for server state management and caching
- **UI Components**: Radix UI primitives with shadcn/ui design system built on Tailwind CSS
- **Styling**: Tailwind CSS with CSS custom properties for theming and responsive design
- **Form Handling**: React Hook Form with Zod validation for type-safe form management

## Backend Architecture
- **Runtime**: Node.js with Express.js framework using ESM modules
- **Database**: PostgreSQL with Drizzle ORM for type-safe database operations
- **Database Provider**: Neon serverless PostgreSQL with connection pooling
- **Session Management**: Express sessions with PostgreSQL session store for persistent authentication
- **File Processing**: Multer for file uploads with support for Excel (XLSX/XLS) and CSV parsing
- **API Design**: RESTful API with structured error handling and validation middleware

## Data Storage
- **Primary Database**: PostgreSQL with comprehensive schema for marina operations
- **Schema Management**: Drizzle Kit for database migrations and schema versioning
- **Session Storage**: PostgreSQL-backed session store for user authentication state
- **File Storage**: Local file system for temporary import file processing
- **Data Types**: JSONB columns for flexible data structures (emergency contacts, insurance info)

## Authentication & Authorization
- **Session-based Authentication**: Express sessions with secure cookie configuration
- **API Key Authentication**: Secure API keys for server-to-server integrations with scope-based permissions
- **CSRF Protection**: Built-in CSRF token validation for form submissions
- **Development Mode**: Simplified authentication flow for development environments
- **Security Headers**: HTTP-only cookies with SameSite protection and secure flags in production
- **Role-Based Access Control**: Permission-based authorization for API endpoints

## API Access & Webhooks
- **API Keys**: Organization-scoped API keys with SHA-256 hashed storage, scope-based permissions, and expiration support
- **Webhooks**: Configurable webhook endpoints for event-driven integrations with HMAC-SHA256 signature verification
- **Webhook Deliveries**: Delivery tracking with retry logic and failure counting
- **Supported Events**: reservation.created/updated/cancelled, payment.received/failed/overdue, launch.scheduled/completed, contract.signed, customer.created

# External Dependencies

## Database Services
- **Neon**: Serverless PostgreSQL database hosting with connection pooling and WebSocket support
- **Drizzle ORM**: Type-safe database client with PostgreSQL dialect support

## Third-party Integrations
- **SpeedyDock**: Real-time boat launch scheduling and dry stack management platform
- **Dockwa**: Marina reservations and online booking system integration
- **Snag-a-Slip**: Online slip booking widget and reservation management

## Notification Services
- **SendGrid**: Email delivery service for customer and staff notifications
  - **REMINDER**: Add SENDGRID_API_KEY when ready to launch for production email notifications
  - Current status: Notification infrastructure implemented, logging notifications for development

## File Processing
- **Papa Parse**: CSV file parsing and data extraction with encoding detection
- **XLSX**: Excel file processing for XLSX and XLS format support
- **File Validation**: Magic byte validation for secure file type verification

## Development Tools
- **Vite**: Frontend build tool with HMR and development server
- **Replit Integration**: Development environment integration with runtime error overlays
- **TypeScript**: Static type checking across frontend, backend, and shared code
- **ESBuild**: Backend bundling for production deployment

## UI & Styling
- **Radix UI**: Headless component primitives for accessibility and functionality
- **Tailwind CSS**: Utility-first CSS framework with custom design tokens
- **Lucide React**: Icon library with consistent design language
- **PostCSS**: CSS processing with Autoprefixer for browser compatibility