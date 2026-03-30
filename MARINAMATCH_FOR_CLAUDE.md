# MarinaMatch — Complete Claude Agent Context Package

> **Purpose:** This document gives Claude full context to write code for this Replit application. Read the entire document before writing any code.

---

## 1. WHAT THIS APP IS

**MarinaMatch** (also called **Marinalytics**) is an institutional-grade, multi-asset commercial real estate investment and management platform. It is a vertical SaaS product targeting marina investment firms, fund managers, and operators — covering the full deal lifecycle:

```
CRM → Due Diligence → Financial Modeling → Operations → Exit
```

### Primary Modules
| Module | Purpose |
|---|---|
| CRM | Deals, leads, contacts, pipelines, activities, email sequences |
| Due Diligence | Project management, DD checklists, VDR, task tracking, fees tracker |
| Financial Modeling | Pro Forma, DCF, Monte Carlo, Exit Strategy Suite, capital stack |
| Operations | Fuel sales, ship store, service work orders, Dockit (dockage scheduling) |
| Document Studio | IC Memos, Offering Memoranda, PDF generation, token binding |
| Analytics | Marina KPI dashboard, benchmarking, unified cross-module analytics |
| AI Advisor | RAG-powered chatbot over deal/market data (GPT-4o + pgvector) |
| Workflow Engine | Stateless automation rules (triggers, conditions, actions) |
| Rent Roll V2 | Multi-asset-class lease management |
| Docket 2.0 | Industry intelligence, AI-powered RSS, M&A tracking |
| LP/Investor Portal | Capital calls, distributions, K-1, LP statements |
| Admin Panel | Org management, RBAC, audit trails, onboarding |
| Utilization Module | 8-phase capacity analytics, pricing ladder, waitlist mgmt |

### Asset Class Support
55+ CRE and operating business asset classes stored as `VARCHAR`. The platform is fully asset-class agnostic. Marina is the default/primary use case.

### Target Users
Marina investment firms, fund managers, marina operators, LP investors.

---

## 2. TECH STACK

```
Frontend:  React 18 + TypeScript
Router:    Wouter
Data:      TanStack Query v5
Forms:     React Hook Form + Zod
UI:        shadcn/ui (Radix UI), Tailwind CSS, Lucide icons
Charts:    Recharts
DnD:       @dnd-kit

Backend:   Node.js + Express + TypeScript
ORM:       Drizzle ORM (schema-first)
Database:  PostgreSQL via Neon serverless
Auth:      Session-based, multi-tenant (org-scoped), RBAC, magic link login
AI:        OpenAI (GPT-4o, text-embedding-3-small) + Anthropic
Email:     Resend (primary) → SendGrid (fallback) → console log
Payments:  Stripe
Storage:   Multer, local (10MB limit)
Build:     Vite (frontend) + esbuild (backend)
Dev:       tsx
External:  FRED API, Census Bureau ACS, Google Maps, QuickBooks, Constant Contact, Twilio, DocuSign
```

### Dev Start Command
```bash
NODE_ENV=development NODE_OPTIONS=--max-old-space-size=400 tsx server/index.ts
```
Express serves both the API and the Vite frontend on the same port. Never modify `server/vite.ts` or `vite.config.ts`.

---

## 3. FILE LAYOUT

```
/
├── shared/
│   ├── schema.ts                    ← Single source of truth for ALL DB tables + Zod schemas
│   ├── exit/                        ← Exit strategy engine (pure functions)
│   ├── finance/                     ← Financial calculation utilities (XIRR, tornado, memo)
│   └── *.ts                         ← Various shared types and schemas
│
├── server/
│   ├── index.ts                     ← Express app entry point, route mounting, cron start
│   ├── routes.ts                    ← MAIN route file (39K+ lines — use grep/sed to navigate)
│   ├── routes/                      ← Feature-specific route files (100+ files)
│   │   ├── marinamatch/             ← Core MarinaMatch routes (workspace, CRM, AI, workflow)
│   │   ├── budget-routes.ts
│   │   ├── rra-routes.ts
│   │   ├── modeling-*.ts
│   │   └── ...
│   ├── services/                    ← Business logic services
│   │   ├── ai/                      ← AI document parsing, underwriting
│   │   ├── finance-kernel/          ← Financial calculation engine
│   │   ├── fund-service.ts
│   │   ├── billing-service.ts
│   │   ├── workflow-engine.ts
│   │   ├── knowledge-base-service.ts
│   │   └── ...
│   ├── middleware/                  ← Auth, RBAC, audit, feature gates, API key auth
│   ├── modules/                     ← Self-contained feature modules
│   │   └── utilization/             ← 8-phase capacity analytics
│   ├── docket/                      ← Docket 2.0 scraper/aggregator
│   ├── integrations/                ← Marina management system connectors
│   └── db.ts                        ← DB connection pool
│
├── client/
│   └── src/
│       ├── App.tsx                  ← Main entry, all routes (lazy-loaded)
│       ├── pages/                   ← One file per page
│       ├── components/              ← Shared UI components (organized by feature)
│       ├── hooks/                   ← Custom React hooks
│       ├── lib/
│       │   └── queryClient.ts       ← TanStack Query client + default fetcher
│       └── modules/                 ← Large self-contained feature sets (OM builder, rent-roll-v2)
│
├── modules/
│   └── dockit/                      ← Standalone Dockit dockage scheduling system
│       ├── client/                  ← Dockit frontend
│       ├── server/                  ← Dockit backend
│       └── shared/schema.ts         ← Dockit DB schema (separate from main schema)
│
├── docs/context/                    ← Developer context docs (load these per task)
│   ├── ai-advisor.md
│   ├── api-routes.md
│   ├── crm-components.md
│   ├── db-patterns.md
│   ├── document-studio.md
│   ├── financial-model.md
│   └── workflow-engine.md
│
├── CLAUDE.md                        ← High-level orientation for every session
├── MARINAMATCH_JOURNAL.md           ← Session journal — source of truth for current state
├── replit.md                        ← Architecture decisions and user preferences
└── package.json
```

---

## 4. CRITICAL CODE RULES (NON-NEGOTIABLE)

### Dev Server
```bash
# Kill the dev server
pkill -f 'tsx server'

# Restart
npm run dev
```
Always kill and restart after route or schema changes. There is no auto-reload.

### Database Rules
- **NEVER run `npm run db:push`** — corrupts the schema in production
- **NEVER use Drizzle ORM** for RLS-enabled tables — it silently returns `[]`
- **ALWAYS use raw `pool.query()`** for these tables:
  - `modeling_project_config`
  - `modeling_scenario_versions`
  - `crm_pipelines`
  - `crm_pipeline_stages`
- **Raw SQL returns snake_case** — always map explicitly to camelCase
- **Migrations go through raw psql** or Node.js migration scripts

### Migration Pattern
```bash
node --input-type=module << 'SCRIPT'
import pg from 'pg';
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
await pool.query(`ALTER TABLE crm_deals ADD COLUMN IF NOT EXISTS my_col TEXT`);
await pool.end();
SCRIPT
```

### Multi-Tenancy
Every query **must** be scoped by `orgId`:
```typescript
const orgId = (req as any).validatedOrgId
  || (req as any).tenantId
  || (req as any).user?.orgId
  || 'org-1'; // dev fallback only
```

### Code Editing
- **Preserve formatting** — only change what is requested
- **Minimal changes** — don't refactor unless asked
- **Incremental** — build on existing code, never replace working code
- **Never edit** `package.json` scripts, `vite.config.ts`, `drizzle.config.ts`

### Test IDs (dev/testing only)
| Resource | ID |
|---|---|
| Test Organization | `cd3719c3-ef82-4ccc-acb9-261c80fb64b4` |
| Test Project (STR) | `6b3a9021-f393-489d-9274-321ac76eae08` |

---

## 5. DATABASE PATTERNS

### The Most Important Rule
**Drizzle ORM silently fails on RLS-enabled tables.** It returns empty arrays with no error. Switch to `pool.query()` immediately if results are unexpected.

### Import
```typescript
import { pool } from '../db'; // pg.Pool instance
```

### Basic Patterns
```typescript
// Basic query
const result = await pool.query(
  `SELECT * FROM crm_deals WHERE org_id = $1 AND id = $2`,
  [orgId, dealId]
);
const rows = result.rows; // always snake_case — map explicitly

// Always map snake_case → camelCase
const deal = {
  id: rows[0].id,
  orgId: rows[0].org_id,
  dealName: rows[0].deal_name,
  createdAt: rows[0].created_at,
};

// Insert with RETURNING
const result = await pool.query(
  `INSERT INTO workflow_rules (org_id, name, trigger_type, conditions, actions, is_active)
   VALUES ($1, $2, $3, $4, $5, $6)
   RETURNING *`,
  [orgId, name, triggerType, JSON.stringify(conditions), JSON.stringify(actions), true]
);

// Transaction
const client = await pool.connect();
try {
  await client.query('BEGIN');
  await client.query(`INSERT INTO ...`, [...]);
  await client.query(`UPDATE ...`, [...]);
  await client.query('COMMIT');
} catch (err) {
  await client.query('ROLLBACK');
  throw err;
} finally {
  client.release();
}
```

### Schema Conventions
```sql
-- Standard columns (all tables)
id          UUID PRIMARY KEY DEFAULT gen_random_uuid()
org_id      UUID NOT NULL  -- always scope to org
created_at  TIMESTAMPTZ DEFAULT NOW()
updated_at  TIMESTAMPTZ DEFAULT NOW()

-- Asset classes are VARCHAR (not enum)
asset_class VARCHAR(100)  -- e.g. 'marina', 'multifamily', 'self_storage'

-- JSONB for flexible config
conditions  JSONB DEFAULT '[]'
actions     JSONB DEFAULT '[]'
metadata    JSONB DEFAULT '{}'
```

### Key Tables Reference

**Modeling / Financial (⚠️ use pool.query)**
| Table | Notes |
|---|---|
| `modeling_projects` | Top-level deal/project container |
| `modeling_project_config` | ⚠️ RLS — use pool.query |
| `modeling_scenario_versions` | ⚠️ RLS — use pool.query |
| `pro_forma_inputs` | Pro forma line items |
| `modeling_actuals` | Operations data synced into model |

**CRM**
| Table | Notes |
|---|---|
| `crm_contacts` | Individual contacts |
| `crm_companies` | Company/org records |
| `crm_deals` | Deal records |
| `crm_tasks` | Tasks |
| `crm_pipelines` | ⚠️ RLS — use pool.query |
| `crm_pipeline_stages` | ⚠️ RLS — use pool.query |
| `crm_activities` | Activity log |

**Workflow**
| Table | Notes |
|---|---|
| `workflow_rules` | Rule definitions |
| `workflow_executions` | Execution history |
| `workflow_tasks` | Tasks generated by workflow actions |
| `workflow_notifications` | Notifications generated by workflow actions |

**AI / Knowledge**
| Table | Notes |
|---|---|
| `knowledge_documents` | RAG knowledge base documents |
| `knowledge_chunks` | Chunked content with pgvector embeddings (1536-dim) |

**Fund / LP**
| Table | Notes |
|---|---|
| `funds` / `fundsV2` | Fund entities |
| `investors` | LP investors |
| `investments` | LP investment records |
| `capital_calls` | Capital call events |
| `distributions` | Distribution events |
| `financial_audit_log` | Immutable append-only (PostgreSQL RULES prevent UPDATE/DELETE) |
| `distribution_approvals` | Draft → Pending → Approved → Executed |
| `fund_period_locks` | Locked accounting periods |

**Rent Roll V2**
| Table | Notes |
|---|---|
| `rra_marina_locations` | Marina/property location groupings |
| `rra_tenants` | Tenant records |
| `rra_leases` | Lease records |

**Operations**
| Table | Notes |
|---|---|
| `ops_marinas` | Marina operational records |
| `ops_fuel_transactions` | Fuel sales |
| `ops_ship_store_sales` | Ship store sales |
| `ops_service_work_orders` | Service work orders |

**Utilization**
| Table | Notes |
|---|---|
| `util_inventory_units` | Unit inventory for utilization tracking |
| `util_occupancy_events` | Contracted occupancy |
| `util_presence_events` | Physical presence (sensor/AIS) |
| `util_offline_blocks` | Capacity offline periods |
| `pricing_recommendations` | Rules-based pricing suggestions |
| `waitlists` | Demand waitlists |

---

## 6. API ROUTE PATTERNS

### Route Registration Pattern
```typescript
// 1. Create route file: server/routes/marinamatch/my-feature-routes.ts
import { Router, Request, Response } from 'express';
import { pool } from '../../db';
import { requireAuth } from '../../middleware/auth';

const router = Router();

router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const orgId = req.user!.orgId;
    const result = await pool.query(
      `SELECT * FROM my_table WHERE org_id = $1`,
      [orgId]
    );
    res.json(result.rows.map(mapToCamelCase));
  } catch (err) {
    console.error('Error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

// 2. Register in server/routes.ts or server/index.ts
import myFeatureRoutes from './routes/marinamatch/my-feature-routes';
app.use('/api/marinamatch/my-feature', myFeatureRoutes);

// 3. Kill and restart the server
```

### User Object (req.user after requireAuth)
```typescript
{
  id: string;       // user UUID
  orgId: string;    // organization UUID — ALWAYS scope queries to this
  email: string;
  role: string;     // 'admin' | 'member' | etc.
}
```

### camelCase Mapping Helper
```typescript
function mapToCamelCase(row: Record<string, any>): Record<string, any> {
  return Object.entries(row).reduce((acc, [key, value]) => {
    const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
    acc[camelKey] = value;
    return acc;
  }, {} as Record<string, any>);
}
```

### Known Route Paths
| Feature | Base Path |
|---|---|
| Workspace / modeling | `/api/marinamatch/workspace` |
| Investment materials | `/api/marinamatch/workspace/investment` |
| Sourced deals / marketplace | `/api/marinamatch/sourced-deals` |
| CRM (all entities) | `/api/marinamatch/crm` |
| Workflow automation | `/api/marinamatch/workflows` |
| AI advisor | `/api/marinamatch/ai-advisor` |
| Marina map | `/api/marinamatch/marina-map` |
| Budget | `/api/budgets` |
| Rent Roll V2 | `/api/rra` |
| Operations | `/api/ops` |
| Modeling enhanced | `/api/modeling-enhanced` |
| DD enhanced | `/api/dd-enhanced` |
| Billing (Stripe) | `/api/billing`, `/api/stripe` |
| Fund management | `/api/fund-management` |
| AI Deal Intelligence | `/api/ai-deal` |
| Investors/LP | `/api/investors` |
| Market data | `/api/market` |
| Operations mgmt | `/api/operations` |
| Capital markets | `/api/capital-markets` |
| CRM intelligence | `/api/crm/intelligence` |
| Workflow automations | `/api/workflow-automations` |
| Master comps | `/api/master-comps` |
| Cash flow forecasting | `/api/cash-flow` |
| AI underwriting | `/api/ai-underwriting` |
| Deal sourcing | `/api/deal-sourcing` |
| Meetings/transcription | `/api/meetings` |
| Multi-currency | `/api/currency` |
| DocuSign | `/api/docusign` |
| Public records | `/api/public-records` |
| Predictive analytics | `/api/predictive` |
| White-label API v1 | `/api/v1` |
| Infrastructure/RBAC | `/api/infrastructure` |
| Tenant operations | `/api/tenant-ops` |
| Enterprise analytics | `/api/enterprise` |
| Compliance | `/api/compliance` |
| Onboarding/Notifications | `/api/onboarding` |
| Org settings | `/api/org-settings` |
| Integrations marketplace | `/api/integrations-marketplace` |
| Utilization | `/api/utilization` |
| Waitlist | `/api/waitlist` |
| Pricing | `/api/pricing` |

---

## 7. FINANCIAL MODEL PATTERNS

### Architecture (5-Layer Pipeline)
```
Layer 1: Pro Forma Inputs
        ↓
Layer 2: Seasonality Engine (auto-derived from inputs, never hardcoded)
        ↓
Layer 3: Canonical Pro Forma (pure-function projection engine)
        ↓
Layer 4: DCF / Monte Carlo / Decision Support (tornado, attribution, memo)
        ↓
Layer 5: Exit Strategy Studio (net proceeds, 1031, waterfall)
```

### Key Rules
- All projection logic must be **pure functions** — no side effects, no DB calls
- DCF **always consumes canonical Pro Forma output** — never raw inputs directly
- Seasonality is **auto-derived** from inputs — never hardcoded or manually entered
- XIRR: one canonical implementation at `shared/finance/xirr.ts` — never duplicate
- Never add dummy/placeholder data to financial components — show empty states

### Financial Model Data Flow (Operations → Model)
```
Fuel/Ship Store/Service/Dockit/RRA
        ↓ (push-to-model: POST /api/ops/projects/:projectId/push-to-model)
modelingActuals (category/subcategory/department/amount)
        ↓
Pro Forma Engine (P&L waterfall)
        ↓
IRR / MOIC / Returns Module
```

### DB Tables for Financial Model (always use pool.query)
```typescript
const TEST_PROJECT_ID = '6b3a9021-f393-489d-9274-321ac76eae08';
const TEST_ORG_ID = 'cd3719c3-ef82-4ccc-acb9-261c80fb64b4';

// Always raw pool.query for these RLS tables
const config = await pool.query(
  `SELECT * FROM modeling_project_config WHERE project_id = $1 AND org_id = $2`,
  [projectId, orgId]
);
// Always map snake_case → camelCase explicitly
```

### Exit Strategy Engine
All three calculators use one canonical engine:
```typescript
import { calculateExitScenario } from '../engines/exit-scenario-engine';

const result = calculateExitScenario({
  salePrice, originalCost, loanBalance, closingCostRate,
  holdPeriod, taxRates, waterfallTiers?
});
// Returns: netProceeds, taxLiability, deferredTaxAmount, waterfallDistribution
```

### Waterfall Engine V1 Clawback Fix (DO NOT UNDO)
- Clawback is now profit-based (was gross-proceeds)
- GP MOIC is configurable (was hardcoded 2%)
- Tier rounding added
- File: `shared/exit/waterfall-engine.ts`

---

## 8. CRM COMPONENTS & PATTERNS

### Entity Types
| Entity | Table | Route Prefix |
|---|---|---|
| Contacts | `crm_contacts` | `/api/marinamatch/crm/contacts` |
| Companies | `crm_companies` | `/api/marinamatch/crm/companies` |
| Deals | `crm_deals` | `/api/marinamatch/crm/deals` |
| Tasks | `crm_tasks` | `/api/marinamatch/crm/tasks` |

Plus: `crm_pipelines` ⚠️, `crm_pipeline_stages` ⚠️, `crm_activities`, `crm_relationships`

### CrmRecordPage — 3-Column Layout (standard for all entity pages)
```
┌──────────────────────────────────────────────────────────────┐
│  Header: Entity name + KPI chips + action buttons            │
├────────────────┬───────────────────────┬─────────────────────┤
│  Left Column   │   Center Column       │   Right Column      │
│  ~280px        │   flex-1              │   ~320px            │
│  Key details   │   Tabs:               │   Related entities  │
│  Quick actions │   - Overview          │   Recent activity   │
│  Linked objs   │   - Activity          │   Upcoming tasks    │
│                │   - Documents         │   Notes             │
└────────────────┴───────────────────────┴─────────────────────┘
```

### Activity Types
```typescript
type ActivityType =
  | 'note' | 'call' | 'email' | 'meeting'
  | 'task_completed' | 'stage_change'
  | 'deal_created' | 'document_added' | 'field_updated';
```

### MM-UI Modal System (always use these, never build one-off modals)
| Component | Use Case |
|---|---|
| `ConfirmModal` | Destructive actions |
| `FormModal` | Single-entity create/edit |
| `WizardModal` | Multi-step flows |
| `DetailModal` | Read-only detail view |
| `SelectModal` | Pick from list |
| `NoteModal` | Add/edit notes |
| `ActivityModal` | Log a call/meeting/email |
| `TaskModal` | Create/edit tasks |
| `UploadModal` | File/document upload |
| `AlertModal` | Warnings and info |

### Pipeline: Always use pool.query (RLS)
```typescript
const stagesResult = await pool.query(
  `SELECT * FROM crm_pipeline_stages
   WHERE pipeline_id = $1 AND org_id = $2
   ORDER BY position ASC`,
  [pipelineId, orgId]
);
```

### Sidebar Navigation Order
```
Dashboard → Operations → CRM (Contacts, Companies, Properties) →
Prospecting → Marketing → Pipeline (Deals, Tasks, Activity, Forecast) →
Deal Workspace → Analysis → Document Studio → Investor Services →
MarinaMatch → Docket → Market Intelligence
```

---

## 9. AI ADVISOR & RAG SYSTEM

### Architecture
```
User Question
      ↓
Query Embedding (OpenAI text-embedding-3-small)
      ↓
Vector Similarity Search (knowledge_chunks table, pgvector)
      ↓
Context Assembly (relevant chunks + entity context + deal comparisons)
      ↓
LLM Completion (GPT-4o, temperature 0.3, max_tokens 1500)
      ↓
Response (with source citations)
```

### Knowledge Base Service Interface
```typescript
// File: server/services/knowledge-base-service.ts
class KnowledgeBaseService {
  async addDocument(params: {
    orgId: string | null;   // null = global/public knowledge
    title: string;
    content: string;
    source: KnowledgeSource;
    metadata?: Record<string, any>;
  }): Promise<string>;

  async search(params: {
    query: string;
    orgId: string;
    topK?: number;          // default: 5
    threshold?: number;     // similarity threshold, default: 0.7
    includeGlobal?: boolean; // default: true
  }): Promise<KnowledgeChunk[]>;
}

type KnowledgeSource =
  | 'deal_document' | 'market_report' | 'property_data'
  | 'comps_data' | 'legal_document' | 'financial_statement'
  | 'manual_entry' | 'web_scraped';
```

### Vector Search Query Pattern
```typescript
const result = await pool.query(
  `SELECT kc.id, kc.document_id, kc.content, kc.metadata,
          kd.title, kd.source,
          1 - (kc.embedding <=> $1::vector) as similarity
   FROM knowledge_chunks kc
   JOIN knowledge_documents kd ON kc.document_id = kd.id
   WHERE (kc.org_id = $2 OR kc.org_id IS NULL)
     AND 1 - (kc.embedding <=> $1::vector) > $3
   ORDER BY kc.embedding <=> $1::vector
   LIMIT $4`,
  [JSON.stringify(queryEmbedding), orgId, threshold, topK]
);
```

### Generating Embeddings
```typescript
import OpenAI from 'openai';
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function generateEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text.replace(/\n/g, ' ').trim(),
  });
  return response.data[0].embedding;
}
```

### System Prompt Pattern
```typescript
function buildSystemPrompt(entityContext?: EntityContext): string {
  return `You are an expert commercial real estate investment advisor with deep expertise
in marina and waterfront properties, multi-asset CRE, and institutional investment analysis.
You assist investment professionals with deal analysis, underwriting, market research,
and investment strategy.

${entityContext ? `Current Deal Context:
- Deal Name: ${entityContext.dealName}
- Asset Class: ${entityContext.assetClass}
- Location: ${entityContext.location}
- Purchase Price: ${entityContext.purchasePrice}
- Current Stage: ${entityContext.stage}` : ''}

When answering:
1. Be specific and data-driven
2. Reference relevant industry benchmarks (cap rates, DSCR standards)
3. Flag risks clearly
4. Integrate retrieved context naturally
5. Keep responses focused and actionable`;
}
```

### Entity Context Shape
```typescript
interface EntityContext {
  entityType: 'deal' | 'property' | 'contact' | 'company';
  entityId: string;
  dealName?: string;
  assetClass?: string;
  location?: string;
  purchasePrice?: number;
  stage?: string;
  noiYear1?: number;
  capRate?: number;
  irr?: number;
}
```

### AI Advisor API Routes
```typescript
POST   /api/marinamatch/ai-advisor/chat
GET    /api/marinamatch/ai-advisor/knowledge
POST   /api/marinamatch/ai-advisor/knowledge/upload
DELETE /api/marinamatch/ai-advisor/knowledge/:documentId
GET    /api/marinamatch/ai-advisor/conversations
GET    /api/marinamatch/ai-advisor/conversations/:conversationId
```

### Chat Request Body
```typescript
{
  message: string;
  conversationId?: string;
  dealId?: string;     // for entity context injection
  dealIds?: string[];  // for deal comparison mode
}
```

### Markdown Rendering (Critical)
AI responses must always render via `react-markdown`, never as raw text:
```typescript
import ReactMarkdown from 'react-markdown';
<ReactMarkdown className="prose prose-sm max-w-none">
  {message.content}
</ReactMarkdown>
```

---

## 10. WORKFLOW ENGINE

### Architecture (Stateless)
```
Trigger Event → Rule Evaluator (stateless)
  - Load rules for org
  - Check trigger type match
  - Evaluate conditions (AND logic)
  - Execute matched actions
  - Write results to DB
```

### Trigger Types (7)
```typescript
type TriggerType =
  | 'deal_stage_changed'
  | 'deal_created'
  | 'deal_value_threshold'
  | 'task_overdue'
  | 'task_completed'
  | 'contact_created'
  | 'document_uploaded';
```

### Action Types (7)
```typescript
type ActionType =
  | 'create_task'
  | 'send_notification'
  | 'send_email'
  | 'update_deal_field'
  | 'assign_deal'
  | 'add_activity_log'
  | 'webhook';
```

### Firing Trigger Events (non-blocking)
```typescript
import { evaluateRules } from '../services/workflow-engine';

evaluateRules({
  type: 'deal_stage_changed',
  orgId, userId: req.user!.id,
  entityType: 'deal', entityId: req.params.id,
  data: { previousStageId, newStageId, previousStageName, newStageName },
  timestamp: new Date()
}).catch(err => console.error('Workflow evaluation error:', err));
// Always .catch() so workflow errors don't break the main response
```

### Condition Operators
`eq` | `neq` | `gt` | `gte` | `lt` | `lte` | `contains` | `in` | `not_in`

### Workflow API Routes
```typescript
GET    /api/marinamatch/workflows/rules
POST   /api/marinamatch/workflows/rules
GET    /api/marinamatch/workflows/rules/:id
PUT    /api/marinamatch/workflows/rules/:id
DELETE /api/marinamatch/workflows/rules/:id
PATCH  /api/marinamatch/workflows/rules/:id/toggle
GET    /api/marinamatch/workflows/executions
GET    /api/marinamatch/workflows/notifications
PATCH  /api/marinamatch/workflows/notifications/:id/read
```

---

## 11. DOCUMENT STUDIO

### Two Document Types
1. **IC Deck** (Investment Committee / Deal Review Deck) — internal deal approval
2. **OM** (Offering Memorandum) — external investor/buyer distribution

### Token System
Documents use `{{TOKEN_NAME}}` replacement for live data binding:
```typescript
function resolveTokens(templateContent: string, tokenData: Record<string, any>): string {
  return templateContent.replace(/\{\{([A-Z_]+)\}\}/g, (match, token) => {
    const value = tokenData[token];
    if (value === undefined || value === null) return match; // leave unresolved
    return String(value);
  });
}
```

### Key Tokens
```
{{DEAL_NAME}}, {{PROPERTY_ADDRESS}}, {{ASSET_CLASS}},
{{PURCHASE_PRICE}}, {{CAP_RATE}}, {{NOI_YEAR_1}}, {{NOI_YEAR_5}},
{{IRR_LEVERAGED}}, {{IRR_UNLEVERAGED}}, {{EQUITY_MULTIPLE}},
{{HOLD_PERIOD}}, {{EXIT_CAP_RATE}}, {{NET_SALE_PROCEEDS}},
{{DSCR_YEAR_1}}, {{CASH_ON_CASH_YEAR_1}}, {{MARKET_NAME}}
```

### Document Output Formats
```typescript
type DocumentOutputFormat = 'pdf' | 'html' | 'json';
```

### Document API Routes
```typescript
GET  /api/marinamatch/workspace/:projectId/documents/templates
POST /api/marinamatch/workspace/:projectId/documents/templates
PUT  /api/marinamatch/workspace/:projectId/documents/templates/:templateId
POST /api/marinamatch/workspace/:projectId/documents/generate
GET  /api/marinamatch/workspace/:projectId/documents/outputs
GET  /api/marinamatch/workspace/:projectId/documents/outputs/:outputId
```

---

## 12. RENT ROLL V2 (RRA)

### Key Tables
- `rraLeases` — lease records
- `rraTenants` — tenant records
- `rraMarinaLocations` — marina/property location groupings (has `asset_class` column)

### Auto-Sync to Modeling
```typescript
// Triggered on lease create/update/delete when autoSyncEnabled=true
// In rra-routes.ts: syncRraLocationToModeling()

// New endpoints:
POST /api/rra/locations/:id/sync-to-modeling
PATCH /api/rra/locations/:id/auto-sync
```

### Multi-Asset-Class Support
`shared/rent-roll-config.ts` drives per-asset-class unit types, field definitions, KPI cards, rate types, and feature flags. Supported: marina, self-storage, multifamily, RV park, hotel/STR, CRE, etc.

---

## 13. UTILIZATION MODULE

### 8 Phases (server/modules/utilization/)
- **Phase 1–4**: Multi-asset-class utilization engine. Contracted (lease-based) vs Physical (sensor/AIS) modes. Offline capacity + estimated revenue lost.
- **Phase 5**: Waitlist & Turn Management (`/api/waitlist/`)
- **Phase 6**: Transient Compression Analytics (`/api/utilization/compression`)
- **Phase 7**: Pricing Ladder Recommendations (`/api/pricing/`)
- **Phase 8**: Underutilization Diagnosis Engine (`/api/utilization/diagnosis`)

### Utilization Endpoints
```
GET /api/utilization/summary
GET /api/utilization/by-type
GET /api/utilization/by-band
GET /api/utilization/drilldown-events
GET /api/utilization/offline-breakdown
GET /api/utilization/compression
GET /api/utilization/diagnosis
POST /api/utilization/recompute  (admin only)
```

---

## 14. FUND MANAGEMENT & LP PORTAL

### Compliance Infrastructure (Institutional Grade)
- `financial_audit_log` — immutable append-only (PostgreSQL RULES prevent UPDATE/DELETE), 22 event types
- `distribution_approvals` — Draft → Pending → Approved → Executed workflow, dual control, $50M dual-signature threshold
- `fund_period_locks` — lock/unlock periods, enforcePeriodLock() guard

### Fund Service Methods (server/services/fund-service.ts)
```typescript
accruePreferredReturn()
calculateFundNav()
createFundCapitalCall()
completeFundCapitalCall()
processFundDistribution()
generateInvestorStatement()
```

### Key RBAC Permissions (for fund operations)
`capital_call:create`, `capital_call:approve`, `distribution:create`, `distribution:approve`, `period:lock`, `period:unlock`

### Capital Movement Rules
- Capital movement DELETE is **disabled** (403: use reversal entries)
- PATCH restricted to status/description only

---

## 15. AUTH & SECURITY

### Auth Middleware
```typescript
import { requireAuth } from '../../middleware/auth';

// Protect a route
router.get('/protected', requireAuth, async (req, res) => {
  const orgId = req.user!.orgId;   // always available after requireAuth
  const userId = req.user!.id;
});
```

### RBAC Middleware
```typescript
import { requireFeature } from '../middleware/feature-gate';
// Usage: requireFeature('fund_management')
```

### API Key Auth (for white-label /api/v1/)
```typescript
import { apiKeyAuth, requireScope } from '../middleware/api-key-auth';
// Keys prefixed with mm_sk_...
// IP allowlist + in-memory rate limiting with X-RateLimit headers
```

### Security Rules
- All data is org-scoped via `org_id`
- RLS is enabled on sensitive tables — use raw `pool.query()` for those
- PII field encryption at rest planned (SSN, Tax ID — AES-256-GCM)
- `ALLOW_DEMO_AUTH=true` env var required for dev auth bypass

---

## 16. OPERATIONS MODULE

### Dockit Integration
Dockit is a **standalone system** at `modules/dockit/`. It has its own schema (`modules/dockit/shared/schema.ts`), its own DB tables (`dockit_organizations` ≠ main `organizations`). It links to the main app via `opsMarinas.linkedDockitMarinaId`.

**DO NOT** confuse Dockit schema with the main schema.

### Key opsMarinas Fields
`linkedProjectId`, `linkedDockitMarinaId`, `integrationId`, `lastSyncAt`

### Push to Model
```typescript
POST /api/ops/projects/:projectId/push-to-model
// Orchestrates all ops sources → modelingActuals
```

### Link Dockit
```typescript
PUT /api/ops/marinas/:marinaId/dockit-link
// Sets linkedDockitMarinaId
```

---

## 17. DRIZZLE ORM SCHEMA PATTERNS

All tables are defined in `shared/schema.ts`. This is the **single source of truth**.

### Schema Pattern
```typescript
import { pgTable, uuid, text, timestamp, boolean, integer, jsonb } from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';

export const myTable = pgTable('my_table', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id').notNull(),
  name: text('name').notNull(),
  tags: text('tags').array(),  // CORRECT: .array() as method, not array(text())
  metadata: jsonb('metadata').default('{}'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Insert schema
export const insertMyTableSchema = createInsertSchema(myTable).omit({
  id: true, createdAt: true, updatedAt: true
});
export type InsertMyTable = z.infer<typeof insertMyTableSchema>;
export type MyTable = typeof myTable.$inferSelect;
```

### Critical Array Column Gotcha
```typescript
// CORRECT
tags: text('tags').array()

// WRONG — will not work
tags: array(text('tags'))
```

---

## 18. FRONTEND PATTERNS

### TanStack Query v5 (object form required)
```typescript
// Queries
const { data, isLoading } = useQuery({
  queryKey: ['/api/deals', dealId],   // hierarchical keys for proper invalidation
  // No queryFn needed — default fetcher is pre-configured
});

// Mutations
const mutation = useMutation({
  mutationFn: (data) => apiRequest('POST', '/api/deals', data),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['/api/deals'] });
  },
});
```

### Forms (React Hook Form + Zod)
```typescript
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form } from '@/components/ui/form';

const form = useForm<InsertDeal>({
  resolver: zodResolver(insertDealSchema.extend({
    name: z.string().min(1, 'Name is required'),
  })),
  defaultValues: { name: '', stageId: '' },
});
```

### Routing (Wouter)
```typescript
import { Link, useLocation } from 'wouter';
// Never modify window.location directly
```

### Import Paths
```typescript
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';  // NOT from shadcn directly
import examplePng from '@assets/example.png';  // for attached assets
import.meta.env.VITE_MY_VAR  // NOT process.env
```

### Loading States
Always show loading/skeleton states while `isLoading` or `isPending`.

---

## 19. COA (CHART OF ACCOUNTS) TAXONOMY

### Overview
- Marina pack: 16 profit centers, 18 sub-centers, 58 canonical accounts, 95 global aliases, 22 mapping rules
- 3-layer mapping: exact alias → keyword/regex rules → keyword similarity
- Auto-approve threshold: ≥0.90 confidence
- Triggered automatically after doc-intel parsing

### Key Tables
`coa_taxonomy_packs`, `coa_profit_centers`, `coa_sub_centers`, `coa_canonical_accounts`, `coa_global_aliases`, `coa_user_aliases`, `coa_mapping_rules`, `coa_mapped_line_items`, `coa_mapping_audit_log`

### COA Routes
All under `/api/coa-taxonomy/`

---

## 20. BACKGROUND JOBS & CRON

### Platform Cron (server/jobs/platform-cron.ts)
8 scheduled jobs using `node-cron`:
1. Lease expiry alerts (daily 7 AM)
2. DD deadline monitoring (every 4h)
3. Compliance/insurance expiry (daily 8 AM)
4. Integration auto-sync (every 30 min)
5. Subscription renewal warnings (daily 9 AM)
6. Rent payment reconciliation (nightly 1 AM)
7. Stale deal detection (Monday 6 AM)
8. Exchange rate refresh (daily 6 AM)
9. Trial reminder emails (daily 8:30 AM)

**Important:** Background scrapers (Docket) are **disabled** — do not re-enable without `--max-old-space-size` flag and explicit approval.

---

## 21. EMAIL SYSTEM

### Unified Email Service (server/services/email-service.ts)
```typescript
// Tries: SendGrid → Resend → console log
// Never silently fails
await sendEmail({
  to: 'user@example.com',
  subject: 'Subject',
  html: '<p>Content</p>',
});
```

---

## 22. CURRENT BUILD STATE (as of 2026-03-30)

### Recently Completed
1. **Bookkeeping Budget Editor** (4 sprints, 2026-03-27/28)
   - Hierarchical account tree with `budget_tree_accounts` table
   - COA templates for 4 asset classes
   - Bulk fill (4 modes), CSV import with fuzzy matching
   - Version management: clone, lock, rename, set-primary, compare
   - Rolling forecast engine (closed months = actuals, future = budget)
   - AI Budget Assistant: Seed from Actuals, Explain Variance, What-If
   - Budget vs Actual charts, export (CSV + print/PDF)
   - Files: `server/routes/budget-routes.ts`, `client/src/pages/operations/BudgetingTabbed.tsx`

2. **Institutional Audit — Blackstone-grade compliance** (2026-03-29/30)
   - GP/LP Fund Management full lifecycle (6 new fund-service methods, 11 new endpoints)
   - Deal-to-Modeling Pipeline Bridge (`modeling_project_id` on `crm_deals`)
   - Financial Audit Service (immutable log)
   - Distribution Approval Service (dual control, $50M threshold)
   - Period Lock Service
   - Waterfall & XIRR fixes
   - Backend security: orgId standardization across 20+ route files

### Currently Pending
1. PDF statement generation (pdf-lib installed; endpoint returns JSON — needs binary PDF)
2. Dedicated LP portal with independent auth
3. K-1 tax document generation
4. Quarterly automated statement delivery
5. PME (Public Market Equivalent) vs S&P 500
6. J-curve analysis and vintage cohort performance
7. Peer fund benchmarking
8. Return attribution
9. Refactor fund-service.ts financial math from parseFloat to decimal.js
10. Derive capital account balances from immutable ledger
11. PII field encryption at rest (AES-256-GCM)
12. Deal-level multi-currency modeling

### Build Priorities (in order)
1. ✅ Workflow Automation Engine
2. Deal Timeline / Gantt View
3. Deal Comparison in Workspace
4. Key Dates on Kanban Cards
5. Global Activity Log Polish
6. Email Send Integration

---

## 23. COMMON FAILURE PATTERNS

| Symptom | Root Cause | Fix |
|---|---|---|
| Drizzle query returns `[]` on populated table | RLS blocking Drizzle | Switch to `pool.query()` |
| Route change has no effect | Server not restarted | `pkill -f 'tsx server' && npm run dev` |
| Schema migration breaks things | Used `db:push` | Always use raw psql migrations |
| `orgId` undefined in query | Field name mismatch | Check `org_id` vs `orgId` in raw SQL vs camelCase layer |
| Pro Forma/DCF returns stale data | Seasonality engine not re-run | Trigger seasonality recalculation |
| Document upload silently fails | Malformed console.log syntax | Check for tagged template literal errors in console.log |
| `orderSelectedFields` crash | Field doesn't exist in schema | Verify field names against shared/schema.ts |
| `export_status` enum error | Wrong value used | Only: `queued`, `processing`, `completed`, `failed` (no `pending`) |
| Dockit data missing | Wrong schema used | Dockit schema is in modules/dockit/shared/schema.ts |
| Background scraper OOM | Scrapers re-enabled | Comment out scrapers in server/index.ts |

---

## 24. DEPENDENCIES (Key Packages)

```json
{
  "AI": ["openai@^5.23.2", "@anthropic-ai/sdk@^0.68.0"],
  "Database": ["@neondatabase/serverless", "drizzle-orm", "drizzle-zod"],
  "Auth": ["express-session", "passport", "jsonwebtoken", "bcrypt", "speakeasy"],
  "PDF": ["pdf-lib", "pdf-parse", "pdfjs-dist", "@react-pdf/renderer", "jspdf"],
  "Email": ["resend", "@sendgrid/mail"],
  "Payments": ["stripe@^20.4.1"],
  "Maps": ["@googlemaps/google-maps-services-js", "@react-google-maps/api"],
  "Office": ["xlsx", "docx", "pptxgenjs"],
  "Charts": ["recharts"],
  "Forms": ["react-hook-form", "@hookform/resolvers", "zod"],
  "Query": ["@tanstack/react-query@^5.60.5"],
  "UI": ["@radix-ui/react-*", "lucide-react", "tailwindcss", "shadcn/ui"],
  "DnD": ["@dnd-kit/core", "@dnd-kit/sortable"],
  "Scraping": ["cheerio", "rss-parser", "playwright"],
  "Misc": ["decimal.js", "date-fns", "uuid", "zod", "wouter", "ws", "multer"]
}
```

---

## 25. ENVIRONMENT VARIABLES

```bash
DATABASE_URL              # PostgreSQL connection string (Neon serverless)
OPENAI_API_KEY            # For AI advisor / embeddings / GPT-4o
ANTHROPIC_API_KEY         # For Anthropic Claude (document intelligence)
GOOGLE_MAPS_API_KEY       # For geocoding / map features
STRIPE_SECRET_KEY         # Stripe payments
STRIPE_PUBLISHABLE_KEY    # Stripe frontend
STRIPE_WEBHOOK_SECRET     # Stripe webhook validation
RESEND_API_KEY            # Primary email provider
SENDGRID_API_KEY          # Fallback email provider
TWILIO_ACCOUNT_SID        # SMS
TWILIO_AUTH_TOKEN         # SMS
SESSION_SECRET            # Express session secret
FRED_API_KEY              # Federal Reserve Economic Data
ALLOW_DEMO_AUTH           # Set 'true' for dev auth bypass (dev only)
```

---

## 26. STYLE SYSTEM

### Colors
- **Deep Marine Blue** (primary)
- **Maritime Steel** (secondary)
- **Harbor Teal** (accent)

### Typography
- **Inter** — UI text
- **Roboto Mono** — data/numbers

### Design Systems
- **MM-UI** — 10 core modal components + wizard pattern
- **FM Design System v2** — financial model components (CSS layer)

### Dark Mode
Uses `darkMode: ["class"]` in tailwind.config.ts. Always use explicit light/dark variants:
```tsx
className="bg-white dark:bg-black text-black dark:text-white"
```

---

## 27. DOCKIT (STANDALONE SYSTEM)

Dockit is a separate dockage scheduling system embedded as a module at `modules/dockit/`.

- Has its own database (`dockit_organizations`, not `organizations`)
- Has its own schema (`modules/dockit/shared/schema.ts`)
- Links to main app via `opsMarinas.linkedDockitMarinaId`
- Has its own frontend (`modules/dockit/client/`)
- Pages: booking portal, marina map, rent roll, customer management, inventory, pricing, launch scheduling, financial reports, communications, messaging, portfolio dashboard

**Never use main app schema for Dockit entities.**

---

## 28. ANALYTICS CROSS-MODULE ARCHITECTURE

### Analytics Dashboard Sources
- CRM metrics: deals in stage, pipeline velocity, win/loss rates
- DD metrics: completion %, overdue items, health scores
- Modeling metrics: IRR, NOI, cap rates by portfolio
- Operations metrics: fuel revenue, ship store, occupancy

### Unified Analytics Routes
```
GET /api/marinamatch/analytics/overview
GET /api/marinamatch/analytics/crm
GET /api/marinamatch/analytics/modeling
GET /api/marinamatch/analytics/operations
```

---

## 29. SESSION JOURNAL HIGHLIGHTS (Most Recent)

From `MARINAMATCH_JOURNAL.md` — most recent significant work:

**2026-03-28: Bookkeeping Budget Editor**
- Full hierarchical budget editor with AI assistant
- Route file: `server/routes/budget-routes.ts` (~1960 lines)
- Frontend: `client/src/pages/operations/BudgetingTabbed.tsx` (~2400 lines)

**2026-03-26: Operations Infrastructure**
- Stripe Checkout flow (fully functional, replaces 503 stubs)
- Onboarding Wizard (3-step, 6 backend endpoints)
- In-App Notification Center with email dispatch
- Background jobs / cron system (8 jobs)
- Org settings (4 tabs: Profile, Team, Branding, Security)
- Integrations Marketplace (40+ integrations catalog)
- Trial reminder system (7-day free trial with CC on file)

**2026-03-25: Major Spec Implementation**
- All 50 sections from MARINAMATCH_MASTER_SPEC.md implemented
- All 38 sections from MARINAMATCH_GAP_SPEC.md implemented
- 80+ new database tables
- ~500+ new API endpoints
- Stripe SDK, DocuSign, ATTOM public records, API v1 white-label

---

## 30. HOW TO ADD A CLAUDE AGENT TO THIS APP

When building a Claude AI agent that runs within this Replit app, follow these patterns:

### Where Existing AI Code Lives
- `server/services/ai-assistant-service.ts` — chat and response pipeline
- `server/services/knowledge-base-service.ts` — RAG / vector search
- `server/routes/ai-assistant-routes.ts` (at root level, not in routes/) — chat endpoints
- `ai-assistant.tsx` (at root level) — React component
- `client/src/components/ai-assistant.tsx` — embedded chat UI
- `server/services/ai/` — document intelligence services

### Existing AI Patterns to Build On
1. **Streaming responses** — the existing chat endpoint likely uses Server-Sent Events or streaming
2. **Entity context injection** — pass `dealId` or `entityId` to inject entity data into system prompt
3. **RAG over knowledge base** — `knowledgeBaseService.search()` for context retrieval
4. **Tool use / function calling** — OpenAI function calling for structured data extraction
5. **Multi-turn conversation history** — stored in `deal_chat_sessions` + `deal_chat_messages`

### DB Tables for Agent Conversations
```sql
deal_chat_sessions    -- conversation sessions (linked to deal/entity)
deal_chat_messages    -- individual messages with role + content
deal_chat_feedback    -- thumbs up/down feedback on responses
ai_narratives         -- AI-generated narrative text attached to entities
ai_underwriting_runs  -- AI underwriting analysis results
```

### Agent System Prompt Template
```typescript
const AGENT_SYSTEM_PROMPT = `You are an AI assistant embedded in MarinaMatch, an institutional-grade
commercial real estate investment platform. You help marina investment professionals with:

1. Deal analysis and underwriting
2. Financial model interpretation  
3. Due diligence tracking and insights
4. Market research and comparables analysis
5. Portfolio performance monitoring

You have access to the following tools:
- Search the knowledge base for relevant documents and data
- Look up deal financial model data (Pro Forma, DCF, IRR)
- Check CRM data (deal stage, contacts, activities)
- Access sales and rate comparables
- Query utilization and operations data

Always:
- Be specific and quantitative when referencing financial data
- Cite the data source when using retrieved information
- Flag risks clearly
- Recommend next steps when appropriate
- Use professional investment language appropriate for institutional investors

Current context: {entityType} - {entityName}
Organization: {orgName}`;
```

### Registering a New Agent Route
```typescript
// server/routes/marinamatch/my-agent-routes.ts
import { Router } from 'express';
import { pool } from '../../db';
import { requireAuth } from '../../middleware/auth';
import OpenAI from 'openai';

const router = Router();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

router.post('/chat', requireAuth, async (req, res) => {
  try {
    const { message, conversationId, dealId } = req.body;
    const orgId = req.user!.orgId;
    const userId = req.user!.id;

    // 1. Fetch entity context if dealId provided
    // 2. Search knowledge base
    // 3. Build messages array with history
    // 4. Call OpenAI
    // 5. Store message + response in DB
    // 6. Return response

    res.json({ answer, sources, conversationId });
  } catch (err) {
    console.error('[agent] chat failed:', err);
    res.status(500).json({ error: 'AI response failed' });
  }
});

export default router;
```

Then in `server/routes.ts` or `server/index.ts`:
```typescript
import myAgentRoutes from './routes/marinamatch/my-agent-routes';
app.use('/api/marinamatch/my-agent', requireAuth, myAgentRoutes);
```

---

## 31. APPENDIX: DRIZZLE SCHEMA EXPORTS (Key Entities)

From `shared/schema.ts` — the primary tables and their relationships:

### Core Business Entities
```
organizations → users
             → crm_deals → crm_activities
                        → crm_tasks
                        → modeling_projects → modeling_project_config (RLS)
                                           → modeling_scenario_versions (RLS)
                                           → modeling_actuals
             → crm_contacts
             → crm_companies
             → crm_pipelines (RLS) → crm_pipeline_stages (RLS)
```

### Modeling Hierarchy
```
modeling_projects
  → modeling_project_config (RLS) — DCF assumptions, IRR, hold period
  → modeling_scenario_versions (RLS) — scenario snapshots
  → pro_forma_inputs — revenue/expense line items
  → modeling_actuals — operations-sourced actuals
  → modeling_rent_roll_config → modeling_rent_roll_units
  → debt_tranches → monthly_loan_schedule
  → capital_stack → capital_stack_projections
  → exit_scenarios
```

### Fund/LP Hierarchy
```
funds / fundsV2
  → fund_deals_v2 (→ modeling_projects)
  → investors → investments → distributions → distribution_allocations
             → capital_calls → capital_call_line_items
             → tax_documents
  → capital_accounts → capital_account_entries (immutable ledger)
  → distribution_approvals (approval workflow)
  → fund_period_locks
  → financial_audit_log (immutable)
```

### Document/Knowledge
```
knowledge_documents → knowledge_chunks (vector embeddings, pgvector)
document_templates → document_outputs
deal_chat_sessions → deal_chat_messages
ai_underwriting_runs
```

### COA
```
coa_taxonomy_packs → coa_profit_centers → coa_sub_centers
                  → coa_canonical_accounts
                  → coa_global_aliases
                  → coa_mapping_rules
coa_mapped_line_items → coa_mapping_audit_log
```

### Operations
```
ops_marinas → ops_fuel_transactions
           → ops_ship_store_sales
           → ops_service_work_orders
rra_marina_locations → rra_leases → rra_tenants
```

### Utilization
```
util_inventory_units → util_occupancy_events
                    → util_presence_events
                    → util_offline_blocks
util_snapshots
pricing_rules → pricing_recommendations
waitlists → waitlist_entries → waitlist_offers
```

---

*This document was generated from the live MarinaMatch codebase on 2026-03-30. Refer to `MARINAMATCH_JOURNAL.md` for the latest session-by-session development history and `CLAUDE.md` for the master orientation document.*
