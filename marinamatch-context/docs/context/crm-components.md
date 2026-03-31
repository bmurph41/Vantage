# MarinaMatch — CRM Components & Patterns

## CRM Entity Types

Four primary entity types, each with its own record page and data model:

| Entity | Table | Route Prefix |
|---|---|---|
| Contacts | `crm_contacts` | `/api/marinamatch/crm/contacts` |
| Companies | `crm_companies` | `/api/marinamatch/crm/companies` |
| Deals | `crm_deals` | `/api/marinamatch/crm/deals` |
| Tasks | `crm_tasks` | `/api/marinamatch/crm/tasks` |

Plus supporting tables:
- `crm_pipelines` ⚠️ RLS — use `pool.query()`
- `crm_pipeline_stages` ⚠️ RLS — use `pool.query()`
- `crm_activities` — activity log (calls, emails, notes, meetings)
- `crm_relationships` — cross-entity relationship links

---

## CrmRecordPage — 3-Column Layout

All four entity record pages use the **3-column CrmRecordPage layout**. This is the
standard and must not be deviated from for new record pages.

```
┌──────────────────────────────────────────────────────────────┐
│  Header: Entity name + KPI chips + action buttons            │
├────────────────┬───────────────────────┬─────────────────────┤
│  Left Column   │   Center Column       │   Right Column      │
│  (sidebar)     │   (main content)      │   (context panel)   │
│  ~280px        │   flex-1              │   ~320px            │
│                │                       │                     │
│  Key details   │   Tabs:               │   Related entities  │
│  Quick actions │   - Overview          │   Recent activity   │
│  Linked objs   │   - Activity          │   Upcoming tasks    │
│                │   - Documents         │   Notes             │
│                │   - (entity-specific) │                     │
└────────────────┴───────────────────────┴─────────────────────┘
```

### CrmRecordPage Props
```typescript
interface CrmRecordPageProps {
  entityType: 'contact' | 'company' | 'deal' | 'task';
  entityId: string;
  // The component handles data fetching internally
}
```

### KPI Chips (Highlights Header)
Display 3–5 key metrics at the top of each record page:

```typescript
interface KpiChip {
  label: string;
  value: string | number;
  trend?: 'up' | 'down' | 'neutral';
  format?: 'currency' | 'percentage' | 'number' | 'date';
}

// Example for a Deal record
const dealKpis: KpiChip[] = [
  { label: 'Deal Value', value: dealValue, format: 'currency' },
  { label: 'Stage', value: stageName },
  { label: 'Days in Stage', value: daysInStage, format: 'number' },
  { label: 'Close Probability', value: probability, format: 'percentage' },
  { label: 'Expected Close', value: closeDate, format: 'date' }
];
```

---

## PreviewDrawer

Used throughout the CRM for quick-view without full navigation.

```typescript
// Usage
<PreviewDrawer
  isOpen={drawerOpen}
  onClose={() => setDrawerOpen(false)}
  entityType="deal"
  entityId={selectedDealId}
/>
```

The PreviewDrawer shows a condensed version of the record with:
- Key fields
- Recent activity (last 3–5 items)
- Quick actions (add note, schedule task, etc.)
- Link to full record page

---

## Pipeline & Kanban

### ⚠️ RLS Warning
`crm_pipelines` and `crm_pipeline_stages` both have RLS enabled.
**Always use `pool.query()` for these tables.**

```typescript
// Fetch pipeline stages — MUST use pool.query
const stagesResult = await pool.query(
  `SELECT * FROM crm_pipeline_stages
   WHERE pipeline_id = $1 AND org_id = $2
   ORDER BY position ASC`,
  [pipelineId, orgId]
);

const stages = stagesResult.rows.map(row => ({
  id: row.id,
  pipelineId: row.pipeline_id,
  name: row.name,
  position: row.position,
  color: row.color,
  orgId: row.org_id
}));
```

### Kanban Card — Key Dates Feature (Priority Item #4)
Kanban cards should display key dates. When implementing:

```typescript
interface KanbanCardData {
  id: string;
  dealName: string;
  dealValue: number;
  companyName?: string;
  assigneeName?: string;
  // Key dates — display these on cards
  expectedCloseDate?: Date;
  dueDiligenceDate?: Date;
  lOIDate?: Date;
  daysInStage: number;
  // Flags
  isStale: boolean;    // no activity in 14+ days
  hasOverdueTasks: boolean;
}
```

### Drag-and-Drop Stage Update
```typescript
// On drag end, update stage via API
const handleStageDrop = async (dealId: string, newStageId: string) => {
  await fetch(`/api/marinamatch/crm/deals/${dealId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ stageId: newStageId })
  });
};
```

---

## Activity Log

### Activity Types
```typescript
type ActivityType =
  | 'note'
  | 'call'
  | 'email'
  | 'meeting'
  | 'task_completed'
  | 'stage_change'
  | 'deal_created'
  | 'document_added'
  | 'field_updated';
```

### Logging an Activity
```typescript
await pool.query(
  `INSERT INTO crm_activities
   (org_id, entity_type, entity_id, activity_type, description, created_by, metadata)
   VALUES ($1, $2, $3, $4, $5, $6, $7)`,
  [orgId, entityType, entityId, activityType, description, userId, JSON.stringify(metadata)]
);
```

### Fetching Activity Feed
```typescript
const result = await pool.query(
  `SELECT a.*, u.name as user_name
   FROM crm_activities a
   LEFT JOIN users u ON a.created_by = u.id
   WHERE a.entity_id = $1 AND a.org_id = $2
   ORDER BY a.created_at DESC
   LIMIT 50`,
  [entityId, orgId]
);
```

---

## MM-UI Modal System

Ten core modal components. Always use these — never build one-off modals.

| Component | Use Case |
|---|---|
| `ConfirmModal` | Destructive actions (delete, archive) |
| `FormModal` | Single-entity create/edit forms |
| `WizardModal` | Multi-step flows (deal creation, onboarding) |
| `DetailModal` | Read-only detail view |
| `SelectModal` | Pick from a list (assign to, link to) |
| `NoteModal` | Add/edit notes |
| `ActivityModal` | Log a call, meeting, email |
| `TaskModal` | Create/edit tasks |
| `UploadModal` | File/document upload |
| `AlertModal` | Warnings and info messages |

### WizardModal Pattern
```typescript
<WizardModal
  isOpen={open}
  onClose={handleClose}
  title="Create New Deal"
  steps={[
    { id: 'basics', title: 'Deal Basics', component: <DealBasicsStep /> },
    { id: 'property', title: 'Property Info', component: <PropertyStep /> },
    { id: 'financials', title: 'Financials', component: <FinancialsStep /> },
    { id: 'review', title: 'Review', component: <ReviewStep /> }
  ]}
  onComplete={handleDealCreate}
/>
```

### Wizard Draft Persistence
Wizard state auto-persists via `useWizardDraft` hook:
```typescript
const { draftData, updateDraft, clearDraft } = useWizardDraft('create-deal');
// Syncs to localStorage (immediate) + server (debounced)
// Resume modal appears if draft exists
```

---

## Sidebar Navigation

**Pipeline is consolidated into CRM** in the sidebar — not a separate top-level item.
**Deal Room** is the correct name for the workspace (not "Deal Workspace").

```
CRM
├── Contacts
├── Companies
├── Deals (Kanban + List)
│   └── [Deal] → Deal Room
├── Tasks
└── Activity Log

Deal Room (formerly Deal Workspace)
├── Overview
├── Financial Model
├── Documents
├── Comparables
└── Investment Materials
```

---

## Relationship Intelligence

### Preferred Network Feature
Contacts and companies can be tagged as part of the "Preferred Network" with:
- Weighted scoring based on deal history, reliability, responsiveness
- Badge system: `Preferred` · `Verified` · `Tier 1` etc.
- Per-criterion match breakdowns for deal sourcing

```typescript
interface RelationshipScore {
  contactId: string;
  totalScore: number;
  breakdown: {
    dealHistory: number;      // 0-100
    responsiveness: number;   // 0-100
    reliability: number;      // 0-100
    networkReach: number;     // 0-100
  };
  badge: 'preferred' | 'verified' | 'tier1' | null;
}
```

---

## Investment Criteria / Buy-Box

```typescript
interface InvestmentCriteria {
  id: string;
  orgId: string;
  name: string;           // e.g. "Marina Acquisition Criteria"
  assetClasses: string[];
  mustHave: CriterionRule[];    // deal-breakers — fails if any missing
  preferred: CriterionRule[];   // weighted scoring
  weights: Record<string, number>;
}

interface CriterionRule {
  field: string;          // e.g. 'capRate', 'minUnits', 'location'
  operator: 'gt' | 'lt' | 'gte' | 'lte' | 'eq' | 'in' | 'contains';
  value: any;
  weight?: number;        // for preferred criteria
}
```

---

## Common Patterns to Avoid

- **Don't** call pipeline/stage queries with Drizzle — use `pool.query()`
- **Don't** create new record page layouts — always use `CrmRecordPage`
- **Don't** build standalone modals — use MM-UI modal system
- **Don't** hardcode pipeline stage names — fetch from DB
- **Don't** skip activity logging for significant events (stage changes, deal creation)
