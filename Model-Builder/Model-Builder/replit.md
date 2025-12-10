# MarinaMatch OM Builder

## Overview

MarinaMatch is a marina-focused investment application featuring an Offering Memorandum (OM) Builder module. The OM Builder allows users to create professional investment memorandum documents with a page/block editor system, supporting data-bound content from underwriting, sales comps, rent comps, market data, and demographics. The application follows a full-stack monorepo architecture with React frontend and Express backend.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript and Vite as the build tool
- **Routing**: Wouter for client-side routing
- **State Management**: TanStack Query for server state and data fetching
- **UI Components**: shadcn/ui component library with Radix UI primitives
- **Styling**: Tailwind CSS with custom MarinaMatch nautical theme (deep navy, blue accents)
- **Drag & Drop**: dnd-kit for block and page reordering in the OM Builder
- **Charts**: Recharts for data visualization in chart blocks

### Backend Architecture
- **Runtime**: Node.js with Express.js
- **Language**: TypeScript throughout
- **API Pattern**: RESTful endpoints under `/api/*` prefix
- **Build**: esbuild for production server bundling, Vite for client

### Database Layer
- **ORM**: Drizzle ORM with PostgreSQL dialect
- **Database**: PostgreSQL (Neon DB compatible)
- **Schema Location**: `shared/schema.ts` contains all table definitions
- **Migrations**: Drizzle Kit with `db:push` command

### Core Data Model (OM Builder)
The OM Builder uses a hierarchical structure:
- **OMs** (`oms` table): Top-level documents linked to projects via `projectId`
- **Pages** (`om_pages` table): Ordered pages within an OM with layout configurations
- **Blocks** (`om_blocks` table): Content blocks (text, chart, table, KPI, image, map) with optional data bindings
- **Templates** (`om_templates` table): Reusable templates for blocks, pages, or full OMs

### Data Binding System
Blocks can be bound to live data sources:
- `underwriting` - Financial projections and metrics
- `sales_comps` - Sales comparables
- `rent_comps` - Rent comparables
- `market` - Market data
- `demographics` - Demographic information

### Page Layout System
Supports multiple layout types:
- `single-column` - Standard single column layout
- `two-column` - Split column layout with configurable widths
- `cover` - Full-page cover with hero image
- `hero-with-body` - Hero section followed by content

### Project Structure
```
client/           # React frontend
  src/
    components/   # UI and feature components
    pages/        # Route pages
    lib/          # Utilities, API clients, types
    hooks/        # Custom React hooks
server/           # Express backend
  routes.ts       # API route definitions
  storage.ts      # Database access layer
  db.ts           # Database connection
shared/           # Shared code between client/server
  schema.ts       # Drizzle schema definitions
```

## External Dependencies

### Database
- **PostgreSQL**: Primary database accessed via `DATABASE_URL` environment variable
- **Drizzle ORM**: Database operations and schema management

### UI Libraries
- **Radix UI**: Headless component primitives for accessibility
- **shadcn/ui**: Pre-built component library (new-york style)
- **Recharts**: Chart rendering for data visualization blocks
- **dnd-kit**: Drag and drop functionality

### Build & Development
- **Vite**: Frontend development server and build tool
- **esbuild**: Production server bundling
- **TypeScript**: Type checking across the entire codebase

### Completed Features

#### Freeform Grid Layout (react-grid-layout)
- Canvas supports freeform block positioning and resizing with react-grid-layout
- Grid layout changes persist to block.style.gridLayout via onUpdateBlock callback
- TypeScript integration using `* as RGL` import pattern for ESM/CJS compatibility
- Default grid layouts per block type (text, heading, chart, kpi, table, image, map)

#### Block Subcomponents
- Refactored block-renderer into modular subcomponents in `client/src/components/om-builder/blocks/`
- Components: TextBlock, KPIBlock, ChartBlock, ImageBlock, TableBlock, HeadingBlock, CalloutBlock, MapBlock

#### Page Templates (server/seed-templates.ts)
- 6 canonical templates seeded on server startup:
  - Executive Summary, Investment Highlights, Market Overview, Financial Summary, Property Overview, Cover Page
- Template apply endpoint: POST /api/templates/:id/apply creates page from template

#### AI Content Assistant
- Generate tab with content types: Executive Summary, Investment Highlights, Market Commentary, Financial Analysis, Property Description, Custom Prompt
- Improve tab for refining existing block content with AI
- Improvement suggestions (concise, compelling, professional, detailed, readable, investor-focused)
- Property context and market context inputs for contextual generation
- Tone selection: Professional, Compelling, Conservative
- GPT-4o model via OpenAI integration

### Integration-Ready Architecture
- All routes modularized under `/api/om/*` namespace for clean parent app mounting
- Authentication middleware (`server/middleware/auth.ts`) accepts external user context via:
  - HTTP headers (X-OM-User-Id, X-OM-User-Role, X-OM-Org-Id, X-OM-Project-Id)
  - Express session (req.user)
  - Custom extractors for JWT/OAuth integration
- Role-based access control (admin, editor, viewer)
- See `docs/INTEGRATION.md` for complete API documentation

### Planned Features (from roadmap)
- PDF export functionality for professional document output
- Real-time collaboration via WebSocket