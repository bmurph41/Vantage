# Vantage Platform
Vantage is a full-stack platform for managing the entire lifecycle of marina acquisition projects, from lead generation to project completion, offering CRM, Due Diligence, and a deal pipeline.

## Run & Operate
- **Run Dev**: `npm run dev`
- **Build**: `npm run build`
- **Typecheck**: `npm run typecheck`
- **DB Push**: `drizzle-kit push:pg` (for schema migrations)
- **Check Schema Drift**: `npm run check:schema`
- **Required Env Vars**: `STRIPE_SECRET_KEY`, `RESEND_API_KEY` (warning if missing but app runs)

## Stack
- **Frontend**: React 18, TypeScript, Wouter, TanStack Query, React Hook Form, Zod, shadcn/ui (Radix UI), Tailwind CSS, Lucide-React
- **Backend**: Express.js, TypeScript, RESTful API, Drizzle ORM
- **Database**: PostgreSQL (Neon serverless)
- **Validation**: Zod
- **Build Tool**: Vite

## Where things live
- **DB Schema**: `server/db/schema.ts`
- **P&L Document Intelligence**: `server/services/doc-intel-service.ts` (OpenAI), `server/services/document-parser/` (Claude)
- **COA Mapping Engine**: `server/services/coa-mapping-engine.ts`
- **P&L Anomaly Detection**: `server/services/pnl/anomaly-detector.ts`
- **Rent Roll Configuration**: `shared/rent-roll-config.ts`
- **Portfolio Dashboard**: `client/src/pages/modeling/portfolio/index.tsx`
- **Pipeline Analytics**: `GET /api/pipeline/analytics`
- **Deal Comparison**: `GET /api/crm-v2/deals/compare-full?dealIds=id1,id2,...`
- **Billing Service**: `server/services/billing-service.ts`
- **Waitlist Service**: `server/modules/utilization/waitlist-service.ts`
- **Utilization Services**: `server/modules/utilization/utilization-service.ts`, `server/modules/utilization/diagnosis-engine.ts`, `server/modules/utilization/pricing-service.ts`
- **Schema Drift Check Script**: `scripts/check-schema-drift.ts`

## Architecture decisions
- **Multi-tenancy**: Organization-based data isolation for all core modules.
- **Dual-Sourced Data**: Separation of "Universal/Global" curated data from user-specific data, scoped by Global, Organization, and User levels.
- **AI Document Processing Pipelines**: Two parallel pipelines (OpenAI for P&L V2, Claude for Document Intelligence V2) with human-in-the-loop review and confidence scoring for extraction accuracy.
- **COA Taxonomy Engine**: 3-layer mapping engine (exact alias → rules → keyword similarity) with confidence scoring for automated chart of accounts normalization across asset classes.
- **Universal Capacity Utilization Module**: Multi-asset-class utilization engine supporting both `contracted` (lease-based) and `physical` (sensor-based) modes with graceful degradation.

## Product
- **Core Modules**: CRM, Due Diligence Tracking, Deal Pipeline, Rent Roll Management, Sales Comparables, Modeling Projects, Document Intelligence, Marketing Automation, Fuel Sales, Ship Store Management, Virtual Data Room.
- **AI-Powered Features**: Document Intelligence (P&L, Rent Roll extraction), P&L Anomaly Intelligence, AI Advisor, AI Assistant.
- **Financial Modeling**: Institutional-grade P&L Pro Forma Engine with growth rates, cash flow calculations, exit strategy suite, and scenario versioning.
- **Analytics & Reporting**: Unified Analytics Dashboard, Portfolio Dashboard, Pipeline Analytics, Marina KPI Calculator, Benchmarking, Underutilization Diagnosis Engine, Pricing Ladder Recommendations.
- **Data Aggregation**: Docket 2.0 (industry intelligence), Listing Ingestion V2.
- **Integration Adapters**: Framework for connecting to various marina management systems.

## User preferences
Preferred communication style: Simple, everyday language.
Code Editing Guidelines:
- Always preserve existing formatting - do not edit formatting unless specifically requested
- Build incrementally on the existing app - never replace what is not suggested to change
- Make only minimal changes needed for the specific request
- Maintain existing code structure and patterns

## Gotchas
- **Schema Drift**: Always run `npm run check:schema` before committing schema changes. If drift is found, generate and apply startup migrations.
- **CRM Pipeline**: The `crm_deals` table uses `stage`, `is_closed`, `lost_reason`, `current_stage_entered_at`, and `title`, not `pipeline_stage`, `status`, `stage_changed_at`, or `name`.
- **Billing**: The app runs without `STRIPE_SECRET_KEY` but will display a warning.
- **File Uploads**: Limited to 10MB due to Multer configuration.

## Pointers
- **Shadcn/ui Documentation**: _Populate as you build_
- **Drizzle ORM Documentation**: _Populate as you build_
- **TanStack Query Documentation**: _Populate as you build_
- **React Hook Form Documentation**: _Populate as you build_
- **Zod Documentation**: _Populate as you build_
- **Tailwind CSS Documentation**: _Populate as you build_
- **Wouter Documentation**: _Populate as you build_
- **Neon Database Documentation**: _Populate as you build_
- **Express.js Documentation**: _Populate as you build_
- **Anthropic AI Documentation**: _Populate as you build_
- **OpenAI Documentation**: _Populate as you build_