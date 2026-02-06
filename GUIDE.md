# Marinalytics Valuator & Operations Export

## Table of Contents
1. [Architecture Overview](#architecture-overview)
2. [Complete Data Flow](#complete-data-flow)
3. [Module Map](#module-map)
4. [Database Schema Overview](#database-schema-overview)
5. [Valuator Workspace Tabs](#valuator-workspace-tabs)
6. [Operations Modules](#operations-modules)
7. [Document Intelligence Pipeline](#document-intelligence-pipeline)
8. [Pro Forma Engine](#pro-forma-engine)
9. [Assumptions JSON Structure](#assumptions-json-structure)
10. [Department Mapping](#department-mapping)
11. [Cross-Module Connections](#cross-module-connections)
12. [API Endpoint Reference](#api-endpoint-reference)
13. [File Directory Structure](#file-directory-structure)

---

## Architecture Overview

The Valuator is the analytical core of Marinalytics — a marina acquisition modeling platform. It connects three major areas:

```
+--------------------------------------------------+
|                   VALUATOR                         |
|  (Modeling Projects / Deal Workspace)              |
|                                                    |
|  +--------+  +----------+  +---------+  +-------+ |
|  |Historic|->|Assumptions|->|Pro Forma|->| Exit  | |
|  | P&L    |  | (Granular)|  | Engine  |  |Strategy| |
|  +--------+  +----------+  +---------+  +-------+ |
|       ^            ^            |                  |
|       |            |            v                  |
+--------------------------------------------------+
        |            |            |
   +----+----+  +----+----+  +---+----+
   |Doc Intel|  |Operations|  |Analytics|
   | (P&L    |  | (Fuel,   |  |(KPI,   |
   |  Upload)|  | Store,   |  | Charts,|
   |         |  | Rent Roll|  | Export)|
   +---------+  +----------+  +--------+
```

### Key Principles
- **Multi-tenant**: All data is scoped by `orgId` (organization). Users only see their org's data.
- **Scenario-based**: Each Modeling Project has Scenarios (Base, Upside, Downside) with independent assumptions stored as JSONB.
- **Department-centric**: Revenue and expenses are classified into marina-specific departments (Storage, Fuel, Ship's Store, Service, etc.) using a Chart of Accounts (CoA).
- **Dual data sources**: Actuals flow from two paths — Document Intelligence (P&L uploads) and Operations modules (Fuel Sales, Ship Store, Rent Roll, etc.).

---

## Complete Data Flow

### Path 1: Document Intelligence (P&L Upload)
```
User uploads P&L PDF/CSV
       |
       v
[PnL Pipeline V2]
  ingest.ts -> parseOrchestrator.ts -> mapping.ts -> timeAlign.ts
       |
       v
[pnlDocuments] + [pnlFacts] tables
  (raw extracted line items with fiscal year/period)
       |
       v
[promote-to-actuals.ts]   <-- triggered via "Import P&L Docs" button
  Maps pnlFacts -> pnlCanonicalLineItems -> CoA -> department
       |
       v
[modelingActuals] table
  (category, subcategory, department, year, month, amount)
       |
       v
[Pro Forma Engine]
  Reads actuals -> applies granular assumptions -> projects forward
```

### Path 2: Operations Data Sync
```
Operations Modules (Fuel Sales, Ship Store, Rent Roll, etc.)
       |
       v
[operations-data-sync-service.ts]
  Aggregates operational data by period
       |
       v
[modelingActuals] table
  (dataSource: 'fuel_sales', 'ship_store', 'rent_roll', etc.)
       |
       v
[Pro Forma Engine]
  enrichFromProfitCenters() pulls from 8 profit center assumption tables
```

### Path 3: Manual Entry
```
User enters line items directly in Historical P&L tab
       |
       v
[modelingActuals] table (dataSource: 'manual_entry')
       |
       v
[Pro Forma Engine]
```

---

## Module Map

### Backend Services (server/services/)

| Service | File | Purpose |
|---------|------|---------|
| **Pro Forma Engine** | `pro-forma-engine-service.ts` | Core projection engine with granular department assumptions |
| **PnL Promote** | `pnl/promote-to-actuals.ts` | Bridge from pnlFacts to modelingActuals |
| **PnL Ingest** | `pnl/ingest.ts` | Raw document parsing entry point |
| **PnL Orchestrator** | `pnl/parseOrchestrator.ts` | Coordinates OCR, LLM classification, extraction |
| **PnL Mapping** | `pnl/mapping.ts` | Maps raw text to canonical line items |
| **PnL Routes** | `pnl/routes.ts` | API endpoints for PnL pipeline |
| **Dept Mapping** | `../utils/department-mapping.ts` | Shared utility: subcategory -> department inference |
| **Ops Data Sync** | `operations-data-sync-service.ts` | Syncs operations data to modelingActuals |
| **Profit Centers** | `marina-profit-center-service.ts` | CRUD for 8 profit center assumption tables |
| **Fuel Sync** | `fuel/fuel-sync-service.ts` | Fuel sales data synchronization |
| **Rent Roll V2** | `rent-roll-v2/rentRollService.ts` | Marina lease management engine |
| **Lease Economics** | `rent-roll-v2/leaseEconomics/` | Lease cashflow calculations |
| **Doc Intel** | `doc-intel-service.ts` | Document Intelligence orchestration |
| **Modeling Export** | `modeling-export.ts` | Excel model export |
| **Deal Pricing** | `deal-pricing-service.ts` | Cap rate, GRM, price/slip calculations |
| **Capital Stack** | `capital-stack-service.ts` | Debt/equity structure modeling |
| **DCF Calculator** | `dcf-calculator-service.ts` | Discounted cash flow analysis |
| **Monte Carlo** | `monte-carlo-service.ts` | Probabilistic simulation engine |
| **Sensitivity** | `sensitivity-matrix-service.ts` | Two-variable sensitivity tables |
| **Debt Schedule** | `debt-schedule-service.ts` | Amortization schedules |
| **Waterfall** | `waterfall-service.ts` | Equity distribution waterfall |
| **Portfolio Rollup** | `portfolio-rollup-service.ts` | Multi-project aggregation |
| **Scenario Versioning** | `scenario-versioning-service.ts` | Version control for scenarios |
| **KPI Calculator** | `analytics/marina-kpi-calculator.ts` | Marina-specific KPI computation |
| **Benchmarking** | `benchmark-comparison-service.ts` | Performance benchmarking |

### Backend Routes (server/routes/)

| Route File | Prefix | Purpose |
|------------|--------|---------|
| `operations-sync-routes.ts` | `/api/operations-sync` | Trigger data sync |
| `operations-context-routes.ts` | `/api/operations-context` | Operations context for modeling |
| `commercial-tenants-routes.ts` | `/api/commercial-tenants` | Commercial tenant CRUD |
| `modeling-rent-roll-routes.ts` | `/api/modeling/rent-roll` | Rent Roll within modeling context |
| `modeling-validation-routes.ts` | `/api/modeling/validation` | Model validation rules |
| `marina-integrations-routes.ts` | `/api/marina-integrations` | External marina system connections |
| `analytics-routes.ts` | `/api/analytics` | Analytics endpoints |
| `valuation-timeline-routes.ts` | `/api/valuation-timeline` | Valuation event tracking |
| `scenario-template-routes.ts` | `/api/scenario-templates` | Reusable scenario templates |

### Frontend Pages

| Page Group | Directory | Tabs/Views |
|------------|-----------|------------|
| **Workspace** | `modeling/projects/workspace/` | 30+ tabs (Overview through Audit Trail) |
| **Doc Intel** | `modeling/doc-intel/` | Upload, Review, Holding Station |
| **PnL Pipeline** | `modeling/pnl/` | Upload, Review, Keyword Bank |
| **Exit Strategy** | `modeling/exit/` | 14 exit analysis tools |
| **Operations/Fuel** | `operations/fuel/` | 10 sub-pages |
| **Operations/Ship Store** | `operations/ship-store/` | 7 sub-pages |
| **Operations/Rent Roll** | `operations/rent-roll/` | 6 sub-pages |
| **Operations/Service** | `operations/service/` | Dashboard |
| **Operations/Boats** | `operations/boat-*` | Rentals, Sales, Club |
| **Operations/Bookkeeping** | `operations/bookkeeping/` | 4 sub-pages |
| **Operations/Commercial** | `operations/commercial-tenants/` | CRUD, Import, Details |
| **Operations/Marketing** | `operations/marketing/` | Campaigns, Email, Attribution |

---

## Database Schema Overview

### Core Modeling Tables (in shared/schema.ts)

| Table | Purpose |
|-------|---------|
| `modelingProjects` | Top-level project container (name, address, property info) |
| `modelingScenarios` | Scenarios within a project (Base/Upside/Downside), `assumptions` JSONB column |
| `modelingActuals` | Historical financial data (year, month, category, subcategory, amount) |
| `modelingFinancialPeriods` | Aggregated period summaries for pricing calculations |
| `pnlCanonicalLineItems` | Standard chart of accounts line items for P&L classification |

### PnL Pipeline Tables (in shared/pnl-pipeline-schema.ts)

| Table | Purpose |
|-------|---------|
| `pnlDocuments` | Uploaded P&L documents metadata |
| `pnlFacts` | Extracted financial facts (value, fiscal year, period, confidence) |
| `pnlClassifications` | LLM-generated classifications |
| `pnlCorrectionLog` | Human corrections for learning loop |

### Operations Tables (in shared/schema.ts)

| Table | Purpose |
|-------|---------|
| `fuelSales` | Fuel transaction records |
| `fuelInventory` | Fuel inventory tracking |
| `shipStoreProducts` | Ship store product catalog |
| `shipStoreTransactions` | Ship store sales records |
| `rentRollProjects` | Rent roll project containers |
| `rentRollEntries` | Individual slip/berth lease records |
| `commercialTenants` | Commercial lease records |
| Profit Center assumption tables | `valuatorFuelAssumptions`, `valuatorShipStoreAssumptions`, etc. |

### Key Relationships
```
modelingProjects (1) --> (N) modelingScenarios
modelingProjects (1) --> (N) modelingActuals
modelingProjects (1) --> (N) pnlDocuments
pnlDocuments (1) --> (N) pnlFacts
pnlFacts --> pnlCanonicalLineItems (classification)
modelingActuals <-- operations-data-sync <-- fuelSales, shipStoreTransactions, rentRollEntries
modelingScenarios.assumptions --> Pro Forma Engine (reads JSONB)
```

---

## Valuator Workspace Tabs

The workspace (`workspace.tsx`) provides a tabbed interface for each modeling project:

| Tab | File | Description |
|-----|------|-------------|
| Overview | `overview.tsx` | Project summary, key metrics |
| Historical P&L | `historical-pl.tsx` | View/edit actuals, "Import P&L Docs" button |
| Assumptions | `assumptions.tsx` | Granular per-department growth rates, occupancy, margins |
| Pro Forma | `pro-forma.tsx` | Projected financials (calls Pro Forma Engine API) |
| Pro Forma Charts | `pro-forma-charts.tsx` | Visual charts of projections |
| Profit Centers | `valuator-profit-centers.tsx` | Summary of all profit center data |
| Fuel Sales | `valuator-fuel-sales.tsx` | Fuel-specific assumptions and data |
| Ship Store | `valuator-ship-store.tsx` | Ship store assumptions and data |
| Service Dept | `valuator-service-dept.tsx` | Service department data |
| Boat Rentals | `valuator-boat-rentals.tsx` | Boat rental assumptions |
| Bookkeeping | `valuator-bookkeeping.tsx` | Bookkeeping data integration |
| Commercial Tenants | `valuator-commercial-tenants.tsx` | Commercial lease data |
| Operations Summary | `valuator-operations-summary.tsx` | Combined operations overview |
| Deal Pricing | `deal-pricing.tsx` | Cap rate, GRM, price per slip |
| Capital Stack | `capital-stack.tsx` | Debt/equity modeling |
| Exit Strategy | `exit-strategy.tsx` | Exit scenario planning |
| Case Config | `case-configuration.tsx` | Multi-case (Base/Upside/Down) setup |
| Scenario Compare | `scenario-comparison.tsx` | Side-by-side scenario analysis |
| Sensitivity | `sensitivity-tornado.tsx` | Tornado charts, sensitivity tables |
| Monte Carlo | `monte-carlo.tsx` | Probabilistic simulation |
| DCF Calculator | `dcf-calculator.tsx` | Discounted cash flow |
| Lease Cashflow | `lease-cashflow.tsx` | Rent roll cashflow projections |
| Debt Scenarios | `debt-scenarios.tsx` | Debt structure analysis |
| Rent Roll Data | `rent-roll-data.tsx` | Rent roll data within modeling |
| Executive Summary | `executive-summary.tsx` | Auto-generated executive summary |
| Export Model | `export-model.tsx` | Excel model download |
| IC Memo Export | `ic-memo-export.tsx` | Investment committee memo generation |
| Uploads | `uploads.tsx` | Document uploads for the project |
| Audit Trail | `audit-trail.tsx` | Change history |
| Validation | `validation-warnings.tsx` | Data quality warnings |

---

## Operations Modules

Each operations module runs independently but feeds data into the Valuator via the Operations Data Sync pipeline.

### Fuel Sales
- **Pages**: `operations/fuel/` (10 sub-pages)
- **Backend**: `server/services/fuel/` (sync, provider interface, FuelCloud integration)
- **Data flow**: Fuel transactions -> aggregated by period -> synced to `modelingActuals` with `dataSource: 'fuel_sales'`
- **Profit center**: `valuatorFuelAssumptions` table stores margin %, volume, price assumptions

### Ship Store
- **Pages**: `operations/ship-store/` (7 sub-pages)
- **Data flow**: Ship store transactions -> aggregated -> synced to `modelingActuals` with `dataSource: 'ship_store'`
- **Profit center**: `valuatorShipStoreAssumptions` table stores margin %, category mix

### Rent Roll V2
- **Pages**: `operations/rent-roll/` (6 sub-pages)
- **Backend**: `server/services/rent-roll-v2/` (lease economics engine, scenario modeling, snapshot versioning)
- **Data flow**: Lease entries -> rent totals by period -> synced to `modelingActuals` with `dataSource: 'rent_roll'`
- **Key feature**: Supports seasonal vs year-round, concessions, escalations, proration

### Service Department
- **Pages**: `operations/service/Dashboard.tsx`
- **Profit center**: `valuatorServiceAssumptions`

### Boat Rentals / Sales / Club
- **Pages**: `operations/boat-rentals/`, `operations/boat-sales/`, `operations/boat-club/`
- **Profit centers**: `valuatorBoatRentalAssumptions`, `valuatorBoatSalesAssumptions`, `valuatorBoatClubAssumptions`

### Commercial Tenants
- **Pages**: `operations/commercial-tenants/` (CRUD, import wizard, detail sheets)
- **Backend**: `server/routes/commercial-tenants-routes.ts`
- **Profit center**: `valuatorCommercialTenantAssumptions`

### Bookkeeping
- **Pages**: `operations/bookkeeping/` (Dashboard, Chart of Accounts, Statements, Sync History)
- **Profit center**: `valuatorBookkeepingAssumptions`
- **Integration**: QuickBooks Online connector

### Marketing
- **Pages**: `operations/marketing/` (Campaigns, Email, Expenses, Attribution)
- **Integration**: Constant Contact for email marketing

### Dockit (Marina Operations)
- **Pages**: `operations/dockit/` (Dashboard, Slips, Launches)
- **Purpose**: Day-to-day marina operations scheduling

---

## Document Intelligence Pipeline

### Stage 1: Upload & Parse
```
PnlUpload.tsx --> POST /api/pnl/upload
  |
  v
ingest.ts: Validates file, creates pnlDocument record
  |
  v
parseOrchestrator.ts: Routes to OCR or direct text extraction
  |
  v
mapping.ts: Maps raw lines to pnlCanonicalLineItems via:
  - Exact match on canonical names
  - Keyword matching
  - LLM-powered classification (fallback)
  - Alias learning from correction log
```

### Stage 2: Review & Approve
```
PnlReview.tsx / ReviewWizard.tsx
  |
  User reviews/corrects line item mappings
  |
  Corrections saved to pnlCorrectionLog (learning loop)
  |
  Facts marked as "approved"
```

### Stage 3: Promote to Historicals
```
Historical P&L tab -> "Import P&L Docs" button
  |
  POST /api/pnl/promote-to-actuals
  |
  promote-to-actuals.ts:
    1. Reads approved pnlFacts for the project
    2. Looks up pnlCanonicalLineItems for CoA mapping
    3. Assigns category (Revenue/COGS/Expenses)
    4. Assigns department via CoA + keyword inference
    5. Upserts into modelingActuals
```

---

## Pro Forma Engine

The Pro Forma Engine (`pro-forma-engine-service.ts`) generates multi-year financial projections.

### How It Works

1. **Load actuals**: Reads `modelingActuals` for the project, filtered to latest historical year
2. **Load scenario assumptions**: Reads the scenario's `assumptions` JSONB column
3. **Enrich with profit centers**: Calls `enrichFromProfitCenters()` to pull data from 8 assumption tables
4. **Classify by department**: Each line item gets a department via `inferDepartment(subcategory, category)` (respects existing department if set)
5. **Apply growth rates**: For each projected year:
   - Maps department to assumption key (e.g., "Storage" -> "storage", "Fuel" -> "fuel_dock")
   - Looks up department-specific growth rate from `assumptions.growthRates`
   - For Storage: applies storage-specific growth (universal/per_type/granular modes)
   - Applies occupancy adjustment: `revenue * (currentOccupancy / baseOccupancy)`
   - For Fuel/Ship Store COGS: applies margin assumption (`COGS = revenue * (1 - margin)`)
   - Compounds year-over-year from the prior year's projected amount

### Output Structure
```json
{
  "years": [2023, 2024, 2025, 2026, 2027],
  "latestHistoricalYear": 2024,
  "granularAssumptionsApplied": true,
  "revenue": {
    "items": [
      { "name": "Wet Slip Revenue", "department": "Storage", "values": { "2024": 500000, "2025": 525000, "2026": 551250 } }
    ],
    "totals": { "2024": 1200000, "2025": 1260000, "2026": 1323000 }
  },
  "expenses": { ... },
  "noi": { "2024": 600000, "2025": 640000, "2026": 683000 },
  "ebitda": { ... }
}
```

---

## Assumptions JSON Structure

Stored in `modelingScenarios.assumptions` (JSONB column):

```json
{
  "revenueGrowthRate": 0.05,
  "expenseGrowthRate": 0.03,

  "growthRates": {
    "storage": 0.05,
    "fuel_dock": 0.03,
    "ship_store": 0.04,
    "service": 0.03,
    "boat_sales": 0.02,
    "rental_boats": 0.06,
    "boat_club": 0.05,
    "transient": 0.04,
    "commercial_tenants": 0.03,
    "g_and_a": 0.02
  },

  "expenseGrowth": {
    "payroll": 0.035,
    "insurance": 0.04,
    "utilities": 0.03,
    "g_and_a": 0.025
  },

  "storageGrowth": {
    "mode": "per_type",
    "universalRate": 5.0,
    "typeRates": {
      "wet_slips": 5.0,
      "dry_racks_indoor": 4.0,
      "dry_racks_outdoor": 3.5,
      "carports": 4.5,
      "transient": 6.0,
      "moorings": 3.0,
      "lift_slips": 4.0,
      "land_storage": 3.0,
      "houseboats": 3.5,
      "boats_on_trailers": 3.0
    },
    "locationRates": {}
  },

  "occupancy": {
    "2024": 0.85,
    "2025": 0.88,
    "2026": 0.90,
    "2027": 0.92,
    "2028": 0.93
  },

  "margins": {
    "fuel_dock": 0.15,
    "ship_store": 0.35
  },

  "capRate": 0.075,
  "discountRate": 0.10,
  "holdPeriod": 5,
  "terminalCapRate": 0.08
}
```

### Storage Growth Modes
- **`universal`**: Single growth rate applied to all storage types
- **`per_type`**: Different rate per storage type (wet slips, dry racks, etc.)
- **`granular`**: Per-type AND per-location rates via `locationRates`

### Occupancy Adjustment Formula
```
adjustedRevenue = baseRevenue * (occupancy[year] / occupancy[baseYear])
```
If base year occupancy is 85% and Year 2 is 90%, storage revenue is scaled up by 90/85 = 1.059x.

### Margin-Based COGS
For fuel and ship store:
```
projectedCOGS = projectedRevenue * (1 - margin)
```
Example: If fuel revenue is $1M and fuel margin is 15%, COGS = $1M * 0.85 = $850K.

---

## Department Mapping

The department mapping utility (`server/utils/department-mapping.ts`) classifies line items into marina departments.

### Department Keys
| Department | Assumption Key | Example Subcategories |
|-----------|---------------|----------------------|
| Storage | `storage` | Wet Slips, Dry Racks, Moorings, Land Storage |
| Fuel | `fuel_dock` | Fuel Sales, Gas, Diesel |
| Ship's Store | `ship_store` | Merchandise, Retail, Chandlery |
| Service | `service` | Repair, Bottom Paint, Mechanic |
| Boat Sales | `boat_sales` | Brokerage |
| Boat Rentals | `rental_boats` | Boat Rentals |
| Boat Club | `boat_club` | Boat Club Memberships |
| Marina & Amenities | `transient` | Launch, Haul, Electric, Power |
| Commercial | `commercial_tenants` | Commercial Leases |
| Payroll | `payroll` | Wages, Salaries, Benefits |
| General | `g_and_a` | General & Administrative, Insurance, Utilities |

### Mapping Priority
1. Check existing `actual.department` field (if already set)
2. Exact match against CoA seed display names
3. Keyword matching against CoA seed keywords
4. Domain-specific keyword fallbacks (hardcoded marina terms)
5. Default to "General"

---

## Cross-Module Connections

### Operations -> Valuator
```
Operations modules produce transactional data
       |
       v
operations-data-sync-service.ts aggregates by period
       |
       v
modelingActuals receives aggregated amounts
       |
       v
Pro Forma Engine reads actuals as base for projections
```

### Document Intelligence -> Valuator
```
P&L documents uploaded via Doc Intel or PnL Pipeline
       |
       v
pnlFacts created with classifications
       |
       v
promote-to-actuals bridges to modelingActuals
       |
       v
Historical P&L tab displays imported data
       |
       v
Pro Forma Engine uses as projection base
```

### Valuator -> Analysis
```
Pro Forma projections
       |
       +-> Deal Pricing (cap rate, GRM, value)
       +-> Capital Stack (debt/equity modeling)
       +-> DCF Calculator (NPV of cash flows)
       +-> Monte Carlo (probabilistic outcomes)
       +-> Sensitivity Analysis (variable impact)
       +-> Exit Strategy Suite (disposition planning)
       +-> Portfolio Roll-up (multi-property aggregation)
       +-> Executive Summary (auto-generated report)
       +-> Excel Export (downloadable model)
```

### CRM -> Valuator
```
Deal Workspace links CRM deals to modeling projects
       |
       v
Deal Orchestrator Service syncs status between systems
       |
       v
Entity Linking API connects contacts, companies to projects
```

---

## API Endpoint Reference

### Modeling Projects
- `GET /api/modeling/projects` - List projects
- `POST /api/modeling/projects` - Create project
- `GET /api/modeling/projects/:id` - Get project details
- `PUT /api/modeling/projects/:id` - Update project
- `DELETE /api/modeling/projects/:id` - Delete project

### Scenarios
- `GET /api/modeling/projects/:id/scenarios` - List scenarios
- `POST /api/modeling/projects/:id/scenarios` - Create scenario
- `PUT /api/modeling/scenarios/:id` - Update scenario (including assumptions)
- `DELETE /api/modeling/scenarios/:id` - Delete scenario

### Historical Actuals
- `GET /api/modeling/projects/:id/actuals` - Get actuals
- `POST /api/modeling/projects/:id/actuals` - Add actual entry
- `PUT /api/modeling/actuals/:id` - Update actual
- `DELETE /api/modeling/actuals/:id` - Delete actual

### Pro Forma
- `GET /api/modeling/projects/:id/pro-forma?scenarioId=...` - Generate pro forma projections

### PnL Pipeline
- `POST /api/pnl/upload` - Upload P&L document
- `GET /api/pnl/documents/:projectId` - List documents for project
- `GET /api/pnl/facts/:documentId` - Get extracted facts
- `POST /api/pnl/promote-to-actuals` - Promote facts to modelingActuals
- `POST /api/pnl/classify` - Classify a line item
- `GET /api/pnl/canonical-items` - List canonical line items

### Operations Sync
- `POST /api/operations-sync/trigger` - Trigger sync for a project
- `GET /api/operations-sync/status/:projectId` - Check sync status

### Profit Centers (Valuator)
- `GET /api/valuator/:projectId/fuel` - Get fuel assumptions
- `PUT /api/valuator/:projectId/fuel` - Update fuel assumptions
- `GET /api/valuator/:projectId/ship-store` - Get ship store assumptions
- `GET /api/valuator/:projectId/leases` - Get commercial tenant data
- (Similar pattern for service, boat-rentals, boat-sales, boat-club, bookkeeping)

---

## File Directory Structure

```
valuator-export/
|
+-- GUIDE.md                              # This file
|
+-- shared/
|   +-- pnl-pipeline-schema.ts            # PnL document & facts tables
|
+-- server/
|   +-- scripts/
|   |   +-- seedMarinaCoa.ts              # Chart of Accounts seed data
|   |   +-- build-valuator-export.ts      # This export script
|   |
|   +-- utils/
|   |   +-- department-mapping.ts         # Shared department inference utility
|   |   +-- financial-calculations.ts     # Financial math helpers
|   |   +-- modeling-periods.ts           # Period calculation utilities
|   |   +-- normalizeLineItemLabel.ts     # Line item text normalization
|   |   +-- normalize-line-item.ts        # Alternative normalizer
|   |
|   +-- services/
|   |   +-- pro-forma-engine-service.ts   # Core projection engine
|   |   +-- operations-data-sync-service.ts
|   |   +-- operations-data-sync.ts
|   |   +-- marina-profit-center-service.ts
|   |   +-- doc-intel-service.ts
|   |   +-- document-intelligence-service.ts
|   |   +-- modeling-export.ts
|   |   +-- deal-pricing-service.ts
|   |   +-- capital-stack-service.ts
|   |   +-- dcf-calculator-service.ts
|   |   +-- monte-carlo-service.ts
|   |   +-- sensitivity-matrix-service.ts
|   |   +-- scenario-versioning-service.ts
|   |   +-- debt-schedule-service.ts
|   |   +-- lease-cashflow-engine.ts
|   |   +-- valuation-sync-service.ts
|   |   +-- portfolio-rollup-service.ts
|   |   +-- waterfall-service.ts
|   |   +-- benchmark-comparison-service.ts
|   |   +-- rent-roll-service.ts
|   |   +-- marina-integration-adapter.ts
|   |   +-- integration-data-pipeline.ts
|   |   +-- integration-data-transformer.ts
|   |   |
|   |   +-- pnl/
|   |   |   +-- promote-to-actuals.ts     # PnL -> Actuals bridge
|   |   |   +-- routes.ts                 # PnL API endpoints
|   |   |   +-- ingest.ts                 # Document ingestion
|   |   |   +-- parseOrchestrator.ts      # Parse coordination
|   |   |   +-- mapping.ts               # Line item mapping
|   |   |   +-- aggregationService.ts     # Period aggregation
|   |   |   +-- timeAlign.ts             # Fiscal period alignment
|   |   |   +-- department-verification-service.ts
|   |   |
|   |   +-- fuel/
|   |   |   +-- fuel-sync-service.ts
|   |   |   +-- fuel-route-utils.ts
|   |   |   +-- fuel-provider-interface.ts
|   |   |
|   |   +-- rent-roll-v2/
|   |   |   +-- rentRollService.ts
|   |   |   +-- db.ts
|   |   |   +-- scenarioService.ts
|   |   |   +-- reportsService.ts
|   |   |   +-- leaseEconomics/
|   |   |       +-- leaseEconomics.engine.ts
|   |   |       +-- leaseEconomics.types.ts
|   |   |
|   |   +-- analytics/
|   |       +-- marina-kpi-calculator.ts
|   |
|   +-- routes/
|       +-- operations-sync-routes.ts
|       +-- operations-context-routes.ts
|       +-- commercial-tenants-routes.ts
|       +-- modeling-rent-roll-routes.ts
|       +-- modeling-validation-routes.ts
|       +-- marina-integrations-routes.ts
|       +-- analytics-routes.ts
|       +-- valuation-timeline-routes.ts
|       +-- scenario-template-routes.ts
|
+-- client/src/
    +-- hooks/
    |   +-- useModelingAddbacks.ts
    |   +-- useModelingCases.ts
    |   +-- useDealWorkspaces.ts
    |
    +-- lib/
    |   +-- queryKeys.ts
    |
    +-- components/
    |   +-- doc-intel/
    |   |   +-- PLReviewGrid.tsx
    |   |   +-- PLTableView.tsx
    |   +-- fuel/
    |       +-- add-delivery-modal.tsx
    |       +-- csv-import-modal.tsx
    |       +-- fuel-type-chart.tsx
    |
    +-- pages/
        +-- modeling/
        |   +-- projects/
        |   |   +-- index.tsx             # Projects list
        |   |   +-- form-dialog.tsx       # Create/edit project dialog
        |   |   +-- setup-wizard.tsx      # New project wizard
        |   |   +-- workspace.tsx         # Main workspace container (tab router)
        |   |   +-- workspace/            # 30+ workspace tabs
        |   |       +-- overview.tsx
        |   |       +-- historical-pl.tsx
        |   |       +-- assumptions.tsx
        |   |       +-- pro-forma.tsx
        |   |       +-- profit-centers.tsx
        |   |       +-- valuator-*.tsx    # Profit center tabs
        |   |       +-- deal-pricing.tsx
        |   |       +-- capital-stack.tsx
        |   |       +-- exit-strategy.tsx
        |   |       +-- ...
        |   |
        |   +-- doc-intel/               # Document Intelligence UI
        |   +-- pnl/                     # PnL Pipeline UI
        |   +-- exit/                    # Exit Strategy Suite (14 tools)
        |   +-- portfolio/               # Portfolio roll-ups
        |   +-- funds/                   # Fund management
        |   +-- lp-portal/               # LP Portal
        |   +-- debt-scenarios/          # Debt analysis
        |   +-- settings/               # Modeling settings
        |
        +-- operations/
            +-- fuel/                    # Fuel Sales (10 pages)
            +-- ship-store/              # Ship Store (7 pages)
            +-- service/                 # Service Dept
            +-- rent-roll/               # Rent Roll (6 pages)
            +-- boat-rentals/            # Boat Rentals
            +-- boat-sales/              # Boat Sales
            +-- boat-club/               # Boat Club
            +-- bookkeeping/             # Bookkeeping (4 pages)
            +-- commercial-tenants/      # Commercial Tenants (4 pages)
            +-- marketing/               # Marketing (6 pages)
            +-- dockit/                  # Marina Operations (3 pages)
```

---

## Quick Start: How to Set Up a New Marina Valuation

1. **Create a Modeling Project** (Projects list -> New Project)
2. **Upload P&L Documents** (Doc Intel or PnL Pipeline tab)
3. **Review & Approve** line item classifications
4. **Import to Historicals** ("Import P&L Docs" button in Historical P&L tab)
5. **Enter Operations Data** (optional — Fuel Sales, Ship Store, Rent Roll tabs)
6. **Configure Assumptions** (Assumptions tab — set per-department growth rates, occupancy, margins)
7. **Generate Pro Forma** (Pro Forma tab — engine reads actuals + assumptions)
8. **Analyze** (Deal Pricing, DCF, Monte Carlo, Sensitivity)
9. **Plan Exit** (Exit Strategy Suite)
10. **Export** (Excel model, IC Memo, Executive Summary)
