# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

```bash
npm run dev          # Start dev server (Express + Vite HMR) on port 5000
npm run build        # Build frontend (Vite) + backend (esbuild) → dist/
npm run start        # Run production build from dist/index.js
npm run check        # TypeScript type-checking (tsc --noEmit)
npm run db:push      # Push Drizzle schema changes to PostgreSQL
```

## Testing

```bash
npx vitest                          # Run all tests
npx vitest run path/to/file.test.ts # Run a single test file
npx vitest --reporter=verbose       # Verbose output
```

- **Framework**: Vitest with globals enabled (no need to import `describe`/`it`/`expect`)
- **Environment**: `jsdom` for client tests, `node` for `server/**` tests (auto-matched)
- **Libraries**: `@testing-library/react`, `@testing-library/jest-dom`
- **E2E**: Playwright available (`npx playwright test`)
- **Setup file**: `vitest.setup.ts`

## Architecture

This is a full-stack TypeScript application: React frontend + Express backend + PostgreSQL (Neon serverless), all in a single package.

### Directory Layout

- **`client/src/`** — React SPA (Vite-bundled). Routing via Wouter, data fetching via TanStack React Query, state via Zustand, UI via shadcn/ui (Radix + Tailwind).
- **`server/`** — Express API server. `index.ts` is the entry point; `routes.ts` registers all route modules.
- **`server/routes/`** — Route modules organized by domain (crm-*, deal-*, dd-*, valuation-*, etc.).
- **`server/services/`** — Business logic layer, called by routes.
- **`server/integrations/connectors/`** — Marina PMS connectors (DockMaster, Dockwa, Storable, Scribble, Marina Office, QuickBooks, DocuSign, Sage Intacct) extending `BaseConnector`.
- **`server/middleware/`** — Security (Helmet, CORS), RBAC, rate limiting, tenant isolation, input validation, error handling.
- **`shared/`** — Drizzle ORM schema (`schema.ts`) and shared types/configs. This is the single source of truth for database structure.
- **`modules/dockit/`** — Separate module with its own client/server/shared structure.
- **`db/migrations/`** — Drizzle-generated migration files.

### Path Aliases (in tsconfig.json and vite.config.ts)

- `@/*` → `client/src/*`
- `@shared/*` → `shared/*`
- `@dockit-shared/*` → `modules/dockit/shared/*`
- `@dockit-server/*` → `modules/dockit/server/*`
- `@dockit-client/*` → `modules/dockit/client/src/*`

### Key Architectural Patterns

- **Database schema**: All tables defined in `shared/schema.ts` using Drizzle ORM with Zod validation (`drizzle-zod`). This file is very large (~1.2MB).
- **Route registration**: `server/routes.ts` is the central file that wires all route modules to Express. It's also very large (~1.5MB).
- **Auth**: Passport.js with local, SAML 2.0, and OpenID Connect strategies. Session storage via Redis (ioredis) or PostgreSQL (connect-pg-simple).
- **Multi-tenancy**: Tenant isolation middleware ensures org-scoped data access.
- **Feature flags**: `server/config/featureFlags.ts` controls feature availability.
- **Integration pattern**: Marina connectors follow BaseConnector abstract class with `testConnection()`, `fetchEntity()`, `transformRecord()`, `saveEntity()` lifecycle.
- **Logging**: Pino logger (`server/lib/logger.ts`).
- **AI services**: Anthropic (Claude) and OpenAI SDKs for AI-powered features (risk analysis, document intelligence, assistant).

### Frontend Patterns

- **UI components**: shadcn/ui primitives in `client/src/components/ui/`, domain components organized by module (crm/, operations/, etc.)
- **Data fetching**: TanStack React Query — queries and mutations through hooks in `client/src/hooks/`
- **Forms**: React Hook Form with Zod resolvers
- **State management**: Zustand stores in `client/src/stores/`

## Environment

- **Runtime**: Node.js 20+, ESM modules (`"type": "module"` in package.json)
- **Database**: PostgreSQL via `@neondatabase/serverless`, connection string in `DATABASE_URL`
- **Port**: 5000 (configurable via `PORT` env var)
- **Key env vars**: `DATABASE_URL`, `JWT_SECRET`, `MARINA_INTEGRATION_ENCRYPTION_KEY`, S3 credentials, SendGrid/Resend API keys
