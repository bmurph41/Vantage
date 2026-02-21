# MarinaMatch Platform - Claude Review Pack

**Generated:** January 2026
**Purpose:** Deep technical audit of MarinaMatch marina acquisition platform

---

## Table of Contents

1. [High-Level System Overview](#high-level-system-overview)
2. [Tech Stack Summary](#tech-stack-summary)
3. [Repository File Tree](#repository-file-tree)
4. [Dependency Summary](#dependency-summary)
5. [Scripts & Local Development](#scripts--local-development)
6. [Environment Variables](#environment-variables)
7. [Database Schema Summary](#database-schema-summary)
8. [API Route Map](#api-route-map)
9. [Key Workflows](#key-workflows)
10. [Background Jobs & Cron Processes](#background-jobs--cron-processes)
11. [Areas of Incomplete Work](#areas-of-incomplete-work)

---

## High-Level System Overview

### What is MarinaMatch?

MarinaMatch is a comprehensive full-stack platform for marina acquisition management. It unifies:

- **CRM** - Deal pipeline, contacts, companies, properties
- **Due Diligence Tracking** - Project management, tasks, risks, document management
- **Valuation Modeling** - Multi-case financial modeling, exit strategy analysis
- **Rent Roll Management** - Marina-specific lease tracking with V2 architecture
- **Operations Modules** - Fuel Sales, Ship Store, Service Dept, Boat Rentals/Club/Sales
- **Virtual Data Room (VDR)** - Secure document sharing with granular permissions
- **Docket** - Industry intelligence via RSS aggregation and web scraping
- **MarinaMatch Intel** - Marina listing aggregation and market analysis

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                           CLIENT (React SPA)                        │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐   │
│  │   Wouter    │ │ TanStack    │ │ React Hook  │ │  Zustand    │   │
│  │  (Routing)  │ │   Query     │ │    Form     │ │  (State)    │   │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘   │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │           shadcn/ui + Radix UI + Tailwind CSS               │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        SERVER (Express.js)                          │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐   │
│  │   Routes    │ │ Middleware  │ │  Services   │ │ Background  │   │
│  │  (31k LOC)  │ │ (Auth/RLS)  │ │  (Business) │ │    Jobs     │   │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      DATABASE (PostgreSQL/Neon)                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │              Drizzle ORM - 511+ Tables                       │   │
│  │     Multi-tenant with orgId-based Row Level Security        │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       EXTERNAL SERVICES                             │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐           │
│  │ OpenAI │ │Anthropic│ │SendGrid│ │ Stripe │ │ Google │           │
│  │  /GPT  │ │ Claude  │ │ Email  │ │Payment │ │  Maps  │           │
│  └────────┘ └────────┘ └────────┘ └────────┘ └────────┘           │
└─────────────────────────────────────────────────────────────────────┘
```

### Authentication Flow

1. **Session-based auth** with httpOnly cookies
2. **Enterprise auth service** validates session tokens
3. **Multi-tenant isolation** via orgId-based RLS
4. **Role-based access control** (owner, editor, viewer)
5. **Magic link login** (15-minute expiry)
6. **SAML/SSO support** for enterprise customers

### Storage Architecture

- **Database:** PostgreSQL via Neon serverless
- **File uploads:** Local filesystem (`server/uploads/`)
- **Document processing:** Multer with 10MB limit
- **VDR documents:** Hierarchical folder structure with permissions

---

## Tech Stack Summary

### Frontend
| Technology | Version | Purpose |
|------------|---------|---------|
| React | 18.3.1 | UI framework |
| TypeScript | 5.6.3 | Type safety |
| Vite | 5.4.19 | Build tool & dev server |
| Wouter | 3.3.5 | Client-side routing |
| TanStack Query | 5.60.5 | Server state management |
| TanStack Table | 8.21.3 | Data tables |
| React Hook Form | 7.55.0 | Form handling |
| Zustand | 5.0.9 | Client state management |
| Tailwind CSS | 3.4.17 | Styling |
| shadcn/ui | - | Component library |
| Radix UI | Various | Accessible primitives |
| Recharts | 2.15.2 | Charts & visualization |
| Framer Motion | 11.13.1 | Animations |
| Lucide React | 0.453.0 | Icons |

### Backend
| Technology | Version | Purpose |
|------------|---------|---------|
| Express.js | 4.21.2 | HTTP server |
| TypeScript | 5.6.3 | Type safety |
| Drizzle ORM | 0.39.1 | Database ORM |
| Drizzle Zod | 0.7.1 | Schema validation |
| Zod | 3.25.76 | Runtime validation |
| Helmet | 8.1.0 | Security headers |
| Express Rate Limit | 8.2.1 | Rate limiting |
| Multer | 2.0.2 | File uploads |
| bcrypt | 6.0.0 | Password hashing |
| jsonwebtoken | 9.0.2 | JWT tokens |
| Pino | 10.1.0 | Logging |
| node-cron | 4.2.1 | Cron jobs |
| ws | 8.18.0 | WebSocket |

### AI/ML
| Technology | Version | Purpose |
|------------|---------|---------|
| OpenAI | 5.23.2 | GPT models |
| Anthropic | 0.68.0 | Claude models |
| Tesseract.js | 7.0.0 | OCR |
| pdf-parse | 2.4.5 | PDF extraction |
| pdfjs-dist | 5.4.530 | PDF rendering |

### Database
| Technology | Version | Purpose |
|------------|---------|---------|
| PostgreSQL | - | Primary database |
| @neondatabase/serverless | 0.10.4 | Serverless driver |
| Drizzle Kit | 0.30.4 | Migrations |

### External Integrations
| Service | Purpose |
|---------|---------|
| SendGrid | Email delivery |
| Stripe | Payments |
| Google Maps | Geocoding & maps |
| Twilio | SMS (planned) |
| QuickBooks | Accounting sync |
| Constant Contact | Email marketing |
| FRED API | Economic data |
| Census Bureau | Demographics |
| Apify | Web scraping |

---

## Repository File Tree

```
.
├── client/                         # Frontend React application
│   ├── src/
│   │   ├── components/             # React components
│   │   │   ├── analytics/          # Analytics widgets
│   │   │   ├── automation/         # Automation UI
│   │   │   ├── calendar/           # Calendar components
│   │   │   ├── communication/      # Messaging UI
│   │   │   ├── comps-map/          # Map components
│   │   │   ├── crm/                # CRM components
│   │   │   ├── dashboard/          # Dashboard components
│   │   │   ├── dashboard-widgets/  # Widget library
│   │   │   ├── dd/                 # Due diligence components
│   │   │   ├── deals/              # Deal workspace
│   │   │   ├── deal-workspace/     # Deal workspace v2
│   │   │   ├── demographics/       # Demographics analysis
│   │   │   ├── dnd/                # Drag and drop
│   │   │   ├── doc-intel/          # Document intelligence
│   │   │   ├── dockit/             # Scheduling module
│   │   │   ├── exit-strategies/    # Exit modeling
│   │   │   ├── forms/              # Form components
│   │   │   ├── fuel/               # Fuel sales UI
│   │   │   ├── import/             # Import wizards
│   │   │   ├── integrations/       # Integration UI
│   │   │   ├── layout/             # Layout components
│   │   │   ├── marina-database/    # Marina DB browser
│   │   │   ├── marketing/          # Marketing automation
│   │   │   ├── marketplace/        # Marketplace UI
│   │   │   ├── modals/             # Modal dialogs
│   │   │   ├── modeling/           # Modeling UI
│   │   │   ├── om-builder/         # OM Builder
│   │   │   ├── onboarding/         # Onboarding flows
│   │   │   ├── operations/         # Operations UI
│   │   │   ├── ops/                # Ops shared
│   │   │   ├── portfolio/          # Portfolio management
│   │   │   ├── quick-access/       # Quick access panel
│   │   │   ├── ratecomps/          # Rate comps UI
│   │   │   ├── rent-roll/          # Rent roll UI
│   │   │   ├── salescomps/         # Sales comps UI
│   │   │   ├── settings/           # Settings pages
│   │   │   ├── shared/             # Shared components
│   │   │   ├── ship-store/         # Ship store UI
│   │   │   ├── ui/                 # shadcn/ui components
│   │   │   ├── vdr/                # VDR components
│   │   │   └── widgets/            # Widget components
│   │   ├── contexts/               # React contexts
│   │   ├── docket/               # Docket frontend
│   │   ├── hooks/                  # Custom hooks
│   │   ├── lib/                    # Utilities
│   │   ├── modules/                # Feature modules
│   │   ├── pages/                  # Page components
│   │   │   ├── admin/              # Admin pages
│   │   │   ├── analysis/           # Analysis pages
│   │   │   ├── analytics/          # Analytics pages
│   │   │   ├── auth/               # Auth pages
│   │   │   ├── crm/                # CRM pages
│   │   │   ├── integrations/       # Integrations pages
│   │   │   ├── marinamatch/        # MarinaMatch pages
│   │   │   ├── modeling/           # Modeling pages
│   │   │   ├── om-builder/         # OM Builder pages
│   │   │   ├── operations/         # Operations pages
│   │   │   ├── ops/                # Ops pages
│   │   │   ├── portfolio/          # Portfolio pages
│   │   │   ├── prospecting/        # Prospecting pages
│   │   │   ├── vdr/                # VDR pages
│   │   │   └── workspaces/         # Workspace pages
│   │   ├── stores/                 # Zustand stores
│   │   ├── theme/                  # Theme config
│   │   ├── types/                  # TypeScript types
│   │   └── utils/                  # Utilities
│   └── replit_integrations/        # Replit integration assets
│
├── server/                         # Backend Express application
│   ├── config/                     # Server config
│   ├── docket/                   # Docket backend
│   │   └── lib/                    # Docket utilities
│   ├── lib/                        # Server utilities
│   ├── listings/                   # Listing ingestion
│   │   └── ingestion_v2/           # V2 ingestion pipeline
│   ├── marinamatch/                # MarinaMatch Intel
│   │   └── services/               # Intel services
│   ├── middleware/                 # Express middleware
│   ├── om/                         # OM Builder backend
│   ├── routes/                     # Route handlers
│   │   └── opssos/                 # Operations routes
│   ├── services/                   # Business services
│   │   ├── analytics/              # Analytics services
│   │   ├── capital-markets/        # Market data
│   │   ├── crm/                    # CRM services
│   │   ├── finance-kernel/         # Financial kernel
│   │   ├── financial/              # Financial calcs
│   │   ├── fuel/                   # Fuel services
│   │   ├── opssos/                 # Ops SOS services
│   │   ├── pnl/                    # P&L processing
│   │   ├── ratecomps/              # Rate comps
│   │   ├── rent-roll-v2/           # Rent Roll V2
│   │   │   ├── leaseEconomics/     # Lease economics engine
│   │   │   └── snapshotVersioning/ # Snapshot versioning
│   │   └── salescomps/             # Sales comps
│   ├── uploads/                    # Upload storage
│   │   ├── doc-intel/              # Doc intel uploads
│   │   ├── temp/                   # Temp files
│   │   └── vdr/                    # VDR documents
│   └── utils/                      # Server utilities
│       ├── llm/                    # LLM utilities
│       └── ocr/                    # OCR utilities
│
├── shared/                         # Shared code (client & server)
│   ├── exit/                       # Exit strategy calculations
│   ├── models/                     # Shared models
│   ├── utils/                      # Shared utilities
│   └── schema.ts                   # Database schema (22.6k lines)
│
├── modules/                        # Self-contained modules
│   └── dockit/                     # Dockit scheduling module
│       ├── client/                 # Dockit frontend
│       ├── server/                 # Dockit backend
│       └── shared/                 # Dockit shared types
│
├── migrations/                     # Database migrations
│   └── meta/                       # Migration metadata
│
├── scripts/                        # Utility scripts
├── docs/                           # Documentation
│   └── diagnostics/                # Diagnostic docs
│
└── audit_pack/                     # This review pack
```

---

## Dependency Summary

### Production Dependencies (144 packages)

**Core Runtime:**
- `express`, `@neondatabase/serverless`, `drizzle-orm`, `zod`

**UI Framework:**
- `react`, `react-dom`, `wouter`, `@tanstack/react-query`, `zustand`

**Component Libraries:**
- `@radix-ui/react-*` (20+ primitives), `lucide-react`, `recharts`, `framer-motion`

**Forms & Validation:**
- `react-hook-form`, `@hookform/resolvers`, `drizzle-zod`, `zod-validation-error`

**AI/ML:**
- `openai`, `@anthropic-ai/sdk`, `tesseract.js`, `pdf-parse`, `pdfjs-dist`

**Document Processing:**
- `pdf-lib`, `@pdf-lib/fontkit`, `xlsx`, `papaparse`, `archiver`

**Security:**
- `bcrypt`, `jsonwebtoken`, `helmet`, `express-rate-limit`, `cookie-parser`

**Email:**
- `@sendgrid/mail`, `resend`

**Integrations:**
- `googleapis`, `@googlemaps/google-maps-services-js`, `rss-parser`, `cheerio`

### Dev Dependencies (22 packages)

- `typescript`, `vite`, `@vitejs/plugin-react`, `tsx`
- `drizzle-kit`, `esbuild`
- `tailwindcss`, `autoprefixer`, `postcss`
- `@tailwindcss/typography`, `@tailwindcss/vite`
- Type definitions for all major libraries

---

## Scripts & Local Development

### Available Scripts

```bash
# Development (starts both frontend & backend)
npm run dev

# Production build
npm run build

# Start production server
npm start

# TypeScript type check
npm run check

# Push database schema changes
npm run db:push
```

### Local Development Steps

1. **Clone repository**
2. **Install dependencies:** `npm install`
3. **Set up environment variables** (see ENV_KEYS.md)
4. **Create database:** Use Replit's PostgreSQL or set `DATABASE_URL`
5. **Push schema:** `npm run db:push`
6. **Start development:** `npm run dev`
7. **Access app:** http://localhost:5000

### Build Process

1. **Frontend:** Vite builds to `dist/public/`
2. **Backend:** esbuild bundles to `dist/index.js`
3. **Static assets:** Served from `dist/public/`

---

## Environment Variables

See **[ENV_KEYS.md](./ENV_KEYS.md)** for complete list.

**Key Categories:**
- Core: `DATABASE_URL`, `JWT_SECRET`, `SESSION_SECRET`, `PORT`
- AI: `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`
- Email: `SENDGRID_API_KEY`
- Maps: `GOOGLE_MAPS_API_KEY`, `VITE_GOOGLE_MAPS_API_KEY`
- Integrations: `QUICKBOOKS_*`, `CONSTANT_CONTACT_*`, `STRIPE_*`
- Feature flags: `FINANCIAL_KERNEL_UI_ENABLED`, `INTEGRATIONS_PLATFORM_ENABLED`

**Total: 90+ environment variables**

---

## Database Schema Summary

See **[DB_SCHEMA.md](./DB_SCHEMA.md)** for complete documentation.

**Quick Stats:**
- **Total Tables:** 511+
- **Schema File:** `shared/schema.ts` (22,600 lines)
- **ORM:** Drizzle ORM with Zod validation

**Major Table Groups:**
| Group | Tables | Purpose |
|-------|--------|---------|
| Auth/Org | 10 | Users, sessions, orgs, packs |
| CRM | 15 | Deals, contacts, companies, properties |
| Due Diligence | 25 | Projects, tasks, risks, documents |
| Rent Roll V2 | 15 | Marina leases, tenants, cash flows |
| Modeling | 20 | Scenarios, debt, capital stack, exits |
| Operations | 30 | Fuel, ship store, service, rentals |
| VDR | 8 | Folders, documents, permissions |
| Docket | 10 | Articles, sources, keywords |
| Analytics | 12 | Dashboards, widgets, layouts |

---

## API Route Map

See **[ROUTES_MAP.md](./ROUTES_MAP.md)** for complete documentation.

**Quick Stats:**
- **Total Routes:** 800+
- **Main Handler:** `server/routes.ts` (31,142 lines)
- **Additional Routers:** 40+ module routers

**Major API Groups:**
| Prefix | Purpose | Auth |
|--------|---------|------|
| `/api/auth` | Authentication | Public |
| `/api/dd` | Due Diligence | Required |
| `/api/crm` | CRM Module | Required |
| `/api/modeling` | Modeling Projects | Required |
| `/api/rra` | Rent Roll V2 | Required |
| `/api/fuel` | Fuel Sales | Required |
| `/api/ship-store` | Ship Store | Required |
| `/api/vdr` | Virtual Data Room | Required |
| `/api/docket` | Industry Intel | Required |
| `/api/marinamatch` | MarinaMatch Intel | Required |
| `/api/dashboards` | Analytics | Required |
| `/api/admin` | Admin Functions | Owner/Admin |

---

## Key Workflows

### 1. Authentication Flow

```
1. User submits credentials → POST /api/auth/login
2. Server validates with bcrypt → Creates session in DB
3. Session token set as httpOnly cookie
4. authenticateUser middleware validates on each request
5. enforceTenant sets RLS context via setTenantContext()
6. Response includes user with orgId, role
```

**Files:**
- `server/routes/auth-routes.ts` - Auth endpoints
- `server/services/enterprise-auth-service.ts` - Auth logic
- `server/routes.ts:322-370` - authenticateUser middleware

### 2. Document Upload & Processing

```
1. User uploads file → POST /api/dd/projects/:id/cdd-documents
2. Multer saves to server/uploads/
3. File metadata stored in cdd_documents table
4. Optional: Trigger parsing → POST /api/dd/documents/:id/parse
5. PDF extraction with pdf-parse/pdfjs-dist
6. Optional: Generate embeddings for RAG
7. Store chunks in vector_chunks table
```

**Files:**
- `server/routes.ts:4500-4700` - Document upload routes
- `server/services/document-service.ts` - Document processing
- `server/utils/ocr/` - OCR utilities

### 3. Rent Roll Import (Column Mapping)

```
1. User uploads CSV/Excel → FileImportDrawer component
2. Frontend parses file with PapaParse
3. System suggests column mappings with confidence scores
4. User reviews/adjusts mappings
5. Submit → POST /api/rra/projects/:id/import
6. Server validates and creates tenant/lease records
7. Cash flows generated from lease terms
```

**Files:**
- `client/src/components/rent-roll/FileImportDrawer.tsx`
- `server/services/rent-roll-document-parser.ts`
- `server/services/rent-roll-v2/rra-service.ts`

### 4. Dashboard Data Loading

```
1. Dashboard page mounts → useQuery('/api/dashboards/data')
2. Server aggregates data from multiple sources:
   - CRM metrics (deals, contacts, pipeline)
   - DD metrics (projects, tasks, deadlines)
   - Operations metrics (fuel, ship store, etc.)
   - Modeling metrics (projects, valuations)
3. Returns unified dashboard response
4. Widgets render with live data
5. User can customize layout → POST /api/dashboards/layout
```

**Files:**
- `client/src/pages/dashboard.tsx`
- `server/services/dashboard-service.ts`
- `server/routes.ts` - Dashboard routes

### 5. Modeling Project Valuation

```
1. User creates project → POST /api/modeling/projects
2. Set assumptions (revenue, expenses, cap rate)
3. Add addbacks for EBITDA normalization
4. Configure debt scenarios (loan terms, rates)
5. Build capital stack (equity, mezz, senior)
6. Generate exit scenarios
7. Calculate valuation → GET /api/modeling/projects/:id/valuation
8. Export to Excel → GET /api/modeling/projects/:id/export/excel
```

**Files:**
- `client/src/pages/modeling/`
- `server/routes.ts` - Modeling routes
- `server/services/valuation-service.ts`
- `shared/exit/` - Exit strategy calculations

---

## Background Jobs & Cron Processes

### Active Background Services

| Service | Schedule | Purpose | File |
|---------|----------|---------|------|
| Deadline Monitor | On-demand | Check upcoming deadlines | `server/deadline-monitor.ts` |
| Reconciliation Service | Configurable | Sync external integrations | `server/reconciliation-service.ts` |
| VDR File Service | On-demand | File management | `server/vdr-file-service.ts` |
| Docket Cron | `*/5 * * * *` | RSS feed scraping | `server/docket/cron-jobs.ts` |
| MarinaMatch Intel | `*/30 * * * *` | Listing scraping | `server/marinamatch/services/intel-cron.ts` |
| Listing Scheduler | Every 6 hours | Scheduled scrapes | `server/marinamatch/services/listing-scheduler.ts` |
| Global Broker Sources | On startup | Seed broker sources | `server/marinamatch/services/global-broker-sources.ts` |

### Startup Sequence (server/index.ts)

```javascript
1. Express app configuration
2. Security middleware (helmet, rate limiting)
3. Route registration
4. Docket routes & storage
5. Centralized error handler
6. Vite (dev) or static serving (prod)
7. HTTP server listen on PORT
8. Start background services:
   - deadlineMonitor.start()
   - startDocketCronJobs()
   - startMarinaMatchIntelCronJobs()
   - startListingScheduler()
   - autoSeedGlobalBrokerSources()
   - seedIntegrations()
   - reconciliationService.start()
   - vdrFileService.initialize()
9. WebSocket initialization (prod only)
```

---

## Areas of Incomplete Work

See **[TODOS.md](./TODOS.md)** for complete list.

### Summary by Priority

**High Priority (Blocking Features):**
1. Audit logs null projectId fix (affects org-level operations)
2. Ship store multi-tenant orgId support
3. Dockit email/SMS notifications for production

**Medium Priority (Feature Completeness):**
1. CRM external integration framework
2. Excel export implementations (marina comps, statements)
3. Risk API endpoints

**Low Priority (Polish):**
1. Report page component imports
2. Deadline monitoring sophistication
3. Rent step tracking in lease economics

**Total TODO/FIXME Comments:** ~38

---

## Additional Files in This Pack

- **[ENV_KEYS.md](./ENV_KEYS.md)** - Complete environment variable reference
- **[ROUTES_MAP.md](./ROUTES_MAP.md)** - Full API route documentation
- **[DB_SCHEMA.md](./DB_SCHEMA.md)** - Database schema details
- **[TODOS.md](./TODOS.md)** - Incomplete work items

---

## Questions for Review

1. **Multi-tenancy:** Is the orgId-based RLS implementation consistent across all routes?
2. **Auth flow:** Are there any edge cases in session validation or demo user fallback?
3. **File uploads:** Is the current local storage approach suitable for production scale?
4. **Background jobs:** Are there proper error handling and retry mechanisms?
5. **Database schema:** With 511+ tables, are there optimization opportunities?
6. **Route organization:** Should the 31k-line routes.ts be further modularized?
7. **Type safety:** Are there areas where TypeScript types could be improved?
8. **Security:** Review of authentication, authorization, and input validation patterns.
