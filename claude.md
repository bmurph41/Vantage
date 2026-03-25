# MarinaMatch / Marinalytics — Claude Code Context

## What This Project Is
Institutional-grade marina acquisition and management platform. Covers the full deal lifecycle: CRM → Due Diligence → Financial Modeling → Operations → Exit. Target users are marina investment firms, fund managers, and operators.

## Dev Server
```
NODE_ENV=development NODE_OPTIONS='--max-old-space-size=2048' tsx server/index.ts
```
Express serves both the API and the Vite frontend on the same port. Never modify `server/vite.ts` or `vite.config.ts`.

## Stack
- **Frontend**: React 18 + TypeScript, Wouter (routing), TanStack Query, React Hook Form + Zod, shadcn/ui, Tailwind CSS, Lucide icons
- **Backend**: Express.js + TypeScript, RESTful, Drizzle ORM
- **Database**: PostgreSQL via Neon serverless, schema-first with Drizzle Kit
- **Auth**: Session-based, multi-tenant (org-scoped), RBAC, magic link login
- **AI**: OpenAI + Anthropic (document intelligence, chatbot)
- **Email**: Resend
- **External**: FRED API, Census Bureau ACS, Google Maps, QuickBooks, Constant Contact

## Code Rules (Critical)
- **Preserve formatting** — only change what is requested
- **Minimal changes** — don't refactor or restructure unless asked
- **Incremental** — build on the existing app, never replace working code
- **No virtual environments or Docker** — Nix-managed environment
- **Never edit** `package.json` scripts, `vite.config.ts`, `drizzle.config.ts`
- **DB migrations**: run `npm run db:push` (never write raw SQL migrations); never change primary key column types
- **Never change** `serial` ↔ `varchar` ID types — breaks existing data

## File Layout
```
shared/schema.ts          — Single source of truth for all DB tables + Zod schemas
server/routes.ts          — Main route file (39K+ lines, use grep/sed to navigate)
server/routes/            — Feature-specific route files
server/modules/           — Self-contained feature modules (utilization, dockit, etc.)
server/services/          — Business logic services
client/src/pages/         — One file per page
client/src/components/    — Shared UI components
modules/dockit/           — Standalone Dockit scheduling system
```

## Multi-Tenancy Pattern
Every query must be scoped by `orgId`. Get it from:
```ts
const orgId = (req as any).validatedOrgId || (req as any).tenantId || (req as any).user?.orgId || 'org-1';
```
Never expose data across org boundaries.

## Key Schema Patterns
- Insert schemas via `createInsertSchema(table).omit({ id, createdAt, updatedAt })`
- Always use `z.infer<typeof insertXSchema>` for insert types
- Always use `typeof table.$inferSelect` for select types
- Array columns: `text().array()` not `array(text())`

## TanStack Query Conventions
- No inline `queryFn` — default fetcher is pre-configured
- Hierarchical keys: `['/api/things', id]` not `` [`/api/things/${id}`] ``
- Always invalidate after mutations
- Show skeleton/loading states while `isLoading` or `isPending`

## Known Gotchas
- **`orderSelectedFields` crash**: Selecting a field that doesn't exist in the schema throws `Cannot convert undefined or null to object`. Always verify field names against `shared/schema.ts` before querying.
- **`opsMarinas` key fields**: `linkedProjectId`, `linkedDockitMarinaId`, `integrationId`, `lastSyncAt`
- **`export_status` enum**: only `queued`, `processing`, `completed`, `failed` — no `pending`
- **Dockit is a standalone system**: `dockit_organizations` ≠ main `organizations`. Linked via `opsMarinas.linkedDockitMarinaId`. Dockit schema lives in `modules/dockit/shared/schema.ts`.
- **Background scrapers are disabled** (commented out in `server/index.ts`) to prevent OOM. Do not re-enable without the `--max-old-space-size` flag and explicit approval.
- **`server/routes.ts` is 39K+ lines** — use `grep` or `sed -n 'START,ENDp'` to navigate, never read the whole file.
- **DB migration method**: Use Node.js + `@neondatabase/serverless` with `ws`; `drizzle-kit push` hangs on interactive prompts in this environment.

## Module Map

### CRM
Deals, leads, contacts, pipelines, activities, email sequences, marketing automation, Comment Threads, Saved Views, Computed Rollups, Source Entity Badges.

### Due Diligence
Project management, task tracking, DD Fees Tracker, template management, project-level contacts.

### Rent Roll V2 (RRA)
Marina-centric lease management. Key tables: `rraLeases`, `rraTenants`, `rraMarinaLocations`.
Auto-sync to modeling rent roll via `syncRraLocationToModeling()` in `rra-routes.ts` — triggered on lease create/update/delete when `autoSyncEnabled=true`.
New endpoints: `POST /locations/:id/sync-to-modeling`, `PATCH /locations/:id/auto-sync`.

### Modeling Projects
Valuation, Pro Forma Engine (P&L waterfall, IRR, T12-Aware Year 1 logic), Exit Strategy Suite (cash_sale, exchange_1031, seller_financing), Scenario Versioning, Capital Stack Builder, Multi-Case Modeling, Addbacks, Excel Export, OM Builder.

### Modeling Rent Roll
Config: `modelingRentRollConfig` (has `linkedRraLocationId`, `autoSyncEnabled`, `lastSyncAt`, `dataSourceMode`).
Units: `modelingRentRollUnits`.
Re-sync endpoint: `POST /projects/:projectId/re-sync` in `modeling-rent-roll-routes.ts`.

### Operations
- **Fuel Sales**: `opsFuelTransactions` — revenue + COGS sync to financial model
- **Ship Store**: `opsShipStoreSales` — revenue + COGS sync to financial model
- **Service**: `opsServiceWorkOrders` — labor/parts revenue + COGS sync to financial model
- **Dockit**: Dockage (lease payments + transient reservations) sync when `linkedDockitMarinaId` is set
- **Push-to-model**: `POST /api/ops/projects/:projectId/push-to-model` — orchestrates all ops → `modelingActuals`
- **Dockit link**: `PUT /api/ops/marinas/:marinaId/dockit-link` — sets `linkedDockitMarinaId`

### Financial Model Data Flow
```
Fuel/Ship Store/Service/Dockit/RRA
        ↓ (push-to-model)
modelingActuals (category/subcategory/department/amount)
        ↓
Pro Forma Engine (P&L waterfall)
        ↓
IRR / MOIC / Returns Module
```

### Document Intelligence
P&L Pipeline V2: OCR → LLM classification → COA mapping → human review.
COA Taxonomy: 16 profit centers, 18 sub-centers, 58 canonical accounts, 95 global aliases, 22 mapping rules (marina pack).
3-layer mapping: exact alias → keyword/regex rules → keyword similarity. Auto-approve at ≥0.90 confidence.

### Utilization Module (`server/modules/utilization/`)
Phases 1–8. Supports marina, hotel, RV park, storage, industrial, parking.
- Phase 1–4: Contracted vs Physical modes, offline capacity + lost revenue
- Phase 5: Waitlist & Turn Management (`/api/waitlist/`)
- Phase 6: Transient Compression Analytics (`/api/utilization/compression`)
- Phase 7: Pricing Ladder Recommendations (`/api/pricing/`)
- Phase 8: Underutilization Diagnosis Engine (`/api/utilization/diagnosis`)

### Analytics
Marina KPI Calculator, benchmarking, Unified Cross-Module Analytics Dashboard (CRM + DD + Modeling + Ops with time-period filtering).

### VDR
Hierarchical 5-level permissions with caching, audit logging, Multer file uploads (10MB limit, local storage).

### Docket 2.0
AI-powered RSS aggregation, M&A tracking, sentiment analysis. Scrapers disabled — don't re-enable.

### Add-ons
Fund Management, LP Portal, Prospecting, MarinaMatch Intel.

### Admin Panel
Customer/org management, usage metrics, audit trails, user onboarding.

## Pricing (Not Yet Implemented)
- Starter: $249/mo, 1 seat
- Professional: $749/mo, 5 seats
- Institutional: $1,499/mo, 15 seats
- Enterprise: $2,500+/mo, unlimited (custom)
- Per-seat add-ons: $50–75/mo
- Annual billing discount: 15–20%
- Stripe integration when ready
