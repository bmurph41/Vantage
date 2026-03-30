# Feature Spec: Deal Timeline / Gantt View

## Overview

A multi-deal Gantt-style timeline view that visualizes all active deals along a shared horizontal time axis. Each deal is a swimlane row showing key date milestones (PSA, DD, deposits, closing), stage duration bars, tasks, and custom deadlines. The view provides at-a-glance pipeline health: which deals are on track, which are overdue, and where date bottlenecks cluster.

Two placements:
1. **Pipeline-level Gantt** — a new top-level view toggle on the CRM Pipeline page (alongside the existing Kanban board), showing all deals in the current pipeline.
2. **Single-deal Timeline tab** — a new "Timeline" tab on the Deal Record Page (`deal-detail.tsx`), showing one deal's full lifecycle with richer detail (activities, playbook milestones, phase gate approvals overlaid).

## User Story

**As a** deal manager reviewing my pipeline,
**I want** a horizontal Gantt view of all active deals plotted against calendar time,
**So that** I can spot deadline clusters, overdue items, and resource conflicts at a glance without clicking into each deal.

**As a** deal analyst reviewing a single deal,
**I want** a Timeline tab on the deal record page that shows every key date, stage transition, task, and milestone on a horizontal axis,
**So that** I can understand the full lifecycle and identify bottlenecks.

## Database Changes Required

**No new tables needed.** All data sources already exist:

| Source Table | Data Provided |
|---|---|
| `crm_deals` | Key dates: `psa_signed_date`, `dd_expiration_date`, `closing_date`, `expected_close_date`, `first_deposit_due_date`, `second_deposit_due_date`, `custom_deadlines` (jsonb) |
| `crm_deal_stage_history` | Stage bars: `entered_at`, `exited_at`, `stage_name`, `duration_business_days`, `is_current_stage` |
| `crm_tasks` | Task bars: `created_at`, `due_date`, `status`, `priority`, `title` |
| `crm_timeline_events` | Activity dots: `occurred_at`, `event_type`, `title` |
| `crm_phase_gate_approvals` | Milestone diamonds: approval status per stage transition |
| `crm_deal_playbook_progress` | Checklist milestones: `completed_at`, `status` |
| `crm_red_flags` | Warning indicators: `severity`, `status`, `created_at` |
| `crm_pipeline_stages` | Stage metadata: `name`, `stage_order`, `sla_warning_days`, `sla_max_days` |

**Optional index addition** (only if performance warrants):
```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS crm_deals_pipeline_org_idx
ON crm_deals (pipeline_id, org_id)
WHERE is_closed = false;
```

## API Routes Required

### 1. `GET /api/crm/pipeline-enhancements/timeline` (EXISTING — enhance)

**Current behavior:** Returns flat array of timeline events for all deals in org.
**Enhancement:** Add query params for filtering and grouping.

| Param | Type | Default | Description |
|---|---|---|---|
| `pipelineId` | uuid | (all) | Filter to a specific pipeline |
| `stageIds` | csv uuids | (all) | Filter to specific stages |
| `ownerId` | uuid | (all) | Filter by deal owner |
| `startDate` | ISO date | 90 days ago | Left bound of timeline window |
| `endDate` | ISO date | 90 days ahead | Right bound of timeline window |
| `includeTasks` | boolean | true | Include task bars |
| `includeActivities` | boolean | false | Include activity dots (can be noisy) |
| `groupBy` | `deal` \| `stage` \| `owner` | `deal` | Row grouping strategy |

**Response shape:**
```ts
{
  deals: Array<{
    id: string;
    title: string;
    stage: string;
    stageName: string;
    stageColor: string;
    owner: { id: string; name: string } | null;
    priority: string;
    probability: number;
    value: string | null;
    expectedCloseDate: string | null;
    daysInCurrentStage: number;
    slaStatus: 'ok' | 'warning' | 'overdue';
  }>;
  events: Array<{
    id: string;
    dealId: string;
    eventType: 'key_date' | 'custom_deadline' | 'task' | 'stage_change' | 'activity' | 'milestone' | 'red_flag';
    title: string;
    startDate: string;   // ISO
    endDate: string;      // ISO (same as startDate for point events)
    status: string;
    color: string;
    metadata?: Record<string, any>;
  }>;
  timeRange: { start: string; end: string };
}
```

**Key logic:**
- Compute `slaStatus` per deal by comparing `daysInCurrentStage` against the stage's `sla_warning_days` / `sla_max_days`.
- Include red flag events (open/acknowledged) as point markers with severity-based color.
- Include phase gate approvals as diamond milestones.
- For `groupBy=stage`, sort groups by `stage_order`; within each group, sort deals by `expected_close_date ASC`.
- For `groupBy=owner`, group by `owner_id` with owner name; unassigned deals in separate group.

### 2. `GET /api/crm/pipeline-enhancements/timeline/:dealId` (EXISTING — enhance)

**Enhancement:** Add optional `include` param.

| Param | Type | Default | Description |
|---|---|---|---|
| `include` | csv | `key_dates,stages,tasks` | Which event types to include: `key_dates`, `stages`, `tasks`, `activities`, `milestones`, `red_flags`, `playbook` |

**Additional events to return when requested:**
- `milestones`: Phase gate approvals (`crm_phase_gate_approvals` where `deal_id = :dealId`)
- `red_flags`: Open red flags (`crm_red_flags` where `deal_id = :dealId AND status IN ('open','acknowledged')`)
- `playbook`: Completed playbook items (`crm_deal_playbook_progress` where `deal_id = :dealId AND status = 'completed'`)
- `activities`: Timeline events from `crm_timeline_events` where `entity_type = 'deal' AND entity_id = :dealId`

## Frontend Components

### Component 1: `DealGanttView` (Pipeline-level)

**File:** `client/src/components/crm/deal-gantt-view.tsx`

**Props:**
```ts
interface DealGanttViewProps {
  pipelineId?: string;
  className?: string;
}
```

**State:**
- `timeRange`: `{ start: Date; end: Date }` — controlled by zoom/pan
- `groupBy`: `'deal' | 'stage' | 'owner'` — toggle in toolbar
- `filters`: `{ stageIds: string[]; ownerId?: string; search?: string }`
- `hoveredDealId`: `string | null` — for row highlight
- `selectedDealId`: `string | null` — for detail popover

**UI Description:**

```
┌─────────────────────────────────────────────────────────────────┐
│ [Toolbar]                                                        │
│  Group: [Deal ▾]  Filter: [Stage ▾] [Owner ▾]  Zoom: [- ● +]  │
│  Today ◉   │   ← Mar 2026 →   │   Export ▾                     │
├──────────┬──────────────────────────────────────────────────────┤
│ Deal     │  Mar 1    Mar 8    Mar 15   Mar 22   Mar 29   Apr 5  │
├──────────┼──────────────────────────────────────────────────────┤
│ Oakwood  │        ◆PSA  ████DD████  ◇Dep1  ◆Close              │
│ Marina   │                                                       │
├──────────┼──────────────────────────────────────────────────────┤
│ Bayfront │  ████████DD████████  ⚠️          ◆Close              │
│ Resort   │     [Task: Appraisal]                                │
├──────────┼──────────────────────────────────────────────────────┤
│ Harbor   │              ◆PSA  ████DD████████████  ◆Close        │
│ Point    │                                                       │
└──────────┴──────────────────────────────────────────────────────┘
Legend: ◆ Key Date  ◇ Deposit  ████ Duration  ⚠️ Red Flag  ▲ Overdue
```

**Rendering approach:**
- Use a custom SVG/HTML canvas — NOT recharts (recharts is not suited for Gantt). Build with plain `<div>` elements using absolute positioning within a scrollable container.
- Left panel: fixed-width (240px) deal info column (name, stage badge, value, owner avatar).
- Right panel: horizontally scrollable timeline area.
- Time axis header: month/week labels with day gridlines.
- "Today" marker: vertical dashed line in Harbor Teal (#2DD4BF), always visible.
- Zoom levels: Day, Week, Month (controls pixels-per-day: 20px, 8px, 2px).
- Row height: 48px. Alternating row backgrounds for readability.
- Click deal name: navigate to deal record page.
- Click/hover event: show popover with event details + "Open Deal" link.

**Event rendering:**
- **Key dates (point):** Diamond marker (◆) with color from `buildTimelineEventsForDeal` color map.
- **Stage bars (range):** Rounded rectangle, Maritime Steel (#4A6FA5) with stage name label if wide enough.
- **Task bars (range):** Thinner rectangle below stage bar, blue for normal priority, orange for high, red for urgent.
- **Red flags (point):** Warning triangle icon, red/orange/yellow by severity.
- **Overdue dates:** Key date markers with red pulsing ring animation when past due.
- **SLA breach:** Row background tints to light red when `slaStatus === 'overdue'`.

### Component 2: `DealTimelineTab` (Single-deal)

**File:** `client/src/components/deals/deal-timeline-tab.tsx`

**Props:**
```ts
interface DealTimelineTabProps {
  dealId: string;
  deal: CrmDeal;  // parent already has this loaded
}
```

**UI Description:**
Combines the existing `DealTimelineVisualizer` (PSA→DD→Close bar) at the top with a detailed Gantt below:

```
┌─────────────────────────────────────────────────────────────────┐
│ [DealTimelineVisualizer — existing component, compact variant]  │
│  | PSA | ████ DD ████ | Ext 1 | ████ Closing ████ |            │
├─────────────────────────────────────────────────────────────────┤
│ Filter: [All ▾] [Key Dates] [Stages] [Tasks] [Activities]      │
├──────────┬──────────────────────────────────────────────────────┤
│ Category │  Timeline axis                                       │
├──────────┼──────────────────────────────────────────────────────┤
│ Stages   │  ████Lead████ ████DD████ ████Negotiation████        │
│ Key Dates│  ◆PSA  ◆DD  ◇Dep1  ◇Dep2  ◆Close                   │
│ Tasks    │  [Appraisal]  [Title Search]  [Survey]               │
│ Playbook │  ✓LOI ✓Inspection ○Financing ○Title                  │
│ Approvals│  ✓→DD  ✓→Negotiate  ○→Close                         │
│ Red Flags│     ⚠️Stale   ⚠️Missing Docs                        │
│ Activity │  · · ·  · ·  · · · ·  ·                             │
└──────────┴──────────────────────────────────────────────────────┘
```

- Each category is a swimlane row.
- Toggle categories on/off with filter chips.
- Activity dots are small circles, colored by type, with tooltip on hover.
- Playbook items show checkmark for completed, circle for pending.
- Click any event to open a detail popover.

### Component 3: `GanttToolbar`

**File:** `client/src/components/crm/gantt-toolbar.tsx`

Shared toolbar for both views:
- Group-by dropdown (pipeline view only)
- Filter dropdowns (stage, owner)
- Zoom slider (Day / Week / Month)
- "Today" button (scrolls to today marker)
- Export button: PNG (via `html-to-image`) or Print

### Component 4: `GanttPopover`

**File:** `client/src/components/crm/gantt-popover.tsx`

Click popover for any timeline event:
- Event title, type badge, dates
- Status indicator
- "Open Deal" link (pipeline view)
- Quick actions: mark task complete, acknowledge red flag

## Integration Points

### What feeds data INTO this feature:
| Source | Data | How |
|---|---|---|
| CRM Deals | Key dates, stage, priority, value | Direct DB query via existing endpoint |
| CRM Pipeline Stages | Stage order, SLA days, colors | Joined in timeline query |
| CRM Tasks | Task bars | Joined in timeline query |
| CRM Deal Stage History | Stage duration bars | Joined in timeline query |
| CRM Timeline Events | Activity dots | Joined when `includeActivities=true` |
| CRM Phase Gate Approvals | Milestone markers | Joined when `include=milestones` |
| CRM Deal Playbook Progress | Playbook checkmarks | Joined when `include=playbook` |
| CRM Red Flags | Warning markers | Joined when `include=red_flags` |
| Workflow Automation | Date-based triggers fire when key dates approach | Workflow engine reads deal dates |

### What this feature feeds data INTO:
| Target | Data | How |
|---|---|---|
| Deal Record Page | Navigation — click deal row to navigate to `/deals/:id` | React Router link |
| CRM Activity Log | View access is itself an activity (optional) | POST to `crm_activities` on view load |
| Key Dates on Kanban (priority #4) | Shares the same key date extraction logic (`buildTimelineEventsForDeal`) | Reuse helper |
| Export / Print | PNG or Print view of Gantt | `html-to-image` / `@media print` |

### Activity Logging:
- **Does NOT log** to `crm_activities` on passive view (too noisy).
- **Does log** when user takes an action from the Gantt (e.g., marks task complete via popover).

### Entitlement Gating:
- No gating required for v1. Timeline is a core CRM feature available to all tiers.
- Future: could gate "Export to PNG/PDF" behind a premium tier.

## Technical Constraints

1. **No new npm packages.** Build Gantt with plain HTML/CSS positioned divs. `recharts` is not appropriate for Gantt charts. The existing `html-to-image` and `jspdf` packages handle export.

2. **Existing endpoints.** The two timeline routes already exist in `server/routes/crm-pipeline-enhancements-routes.ts` (lines 114–186). Enhance them in place — do NOT create new route files.

3. **`buildTimelineEventsForDeal` reuse.** The existing helper (lines 31–110) already extracts key dates, custom deadlines, tasks, and stage history. Extend it to also extract red flags, phase gates, and playbook items — do not duplicate the logic.

4. **Server restart.** No new Express route mounts are needed (existing router already mounted). But if the response shape changes, restart to pick up TS changes: `pkill -f 'tsx server' && npm run dev`.

5. **snake_case mapping.** All raw SQL results must be mapped to camelCase. The existing routes use Drizzle which handles this, but any new raw `pool.query()` calls must map explicitly.

6. **RLS.** None of the tables used here (`crm_deals`, `crm_tasks`, `crm_deal_stage_history`, `crm_timeline_events`, `crm_phase_gate_approvals`, `crm_red_flags`, `crm_deal_playbook_progress`) are RLS-protected. Drizzle is safe to use.

7. **Performance.** The pipeline-level query fetches all open deals + their events. For orgs with 100+ deals, this could be heavy. Mitigate by:
   - Default `startDate`/`endDate` window (±90 days).
   - Exclude activities by default (`includeActivities=false`).
   - Use `WHERE is_closed = false` to skip closed deals in pipeline view.

8. **Design system compliance:**
   - Colors: Deep Marine Blue (#0A2342) for headers, Maritime Steel (#4A6FA5) for stage bars, Harbor Teal (#2DD4BF) for today line.
   - Typography: Inter for labels, Roboto Mono for dates/numbers.
   - Use existing shadcn/ui components for toolbar (Select, Popover, Button, Badge, Tooltip).

## Acceptance Criteria

### Pipeline-level Gantt View
- [ ] Toggle between Kanban and Gantt views on the CRM Pipeline page via a view switcher (e.g., icon toggle in header).
- [ ] Gantt renders one row per deal with deal name, stage badge, and value in the left column.
- [ ] Horizontal time axis shows month/week labels with day gridlines.
- [ ] "Today" vertical dashed line renders at current date in Harbor Teal.
- [ ] Key date milestones (PSA, DD, deposits, closing) render as diamond markers with correct colors.
- [ ] Stage history renders as horizontal bars showing duration in each stage.
- [ ] Tasks render as thin bars with priority-based coloring.
- [ ] Overdue key dates show red indicator (ring or background tint).
- [ ] SLA-breached deals have tinted row background.
- [ ] Zoom controls switch between Day/Week/Month granularity.
- [ ] Group-by dropdown switches between Deal/Stage/Owner grouping.
- [ ] Filter by stage and owner works correctly.
- [ ] Click deal name navigates to deal record page.
- [ ] Hover/click event shows popover with details.
- [ ] "Today" button scrolls view to center on current date.
- [ ] Empty state: "No deals in this pipeline" with guidance.
- [ ] Works for test org `cd3719c3-ef82-4ccc-acb9-261c80fb64b4`.

### Single-deal Timeline Tab
- [ ] New "Timeline" tab appears on deal record page (between "Activities" and "FM").
- [ ] Existing `DealTimelineVisualizer` renders at top in compact mode.
- [ ] Below it, category swimlanes show: Stages, Key Dates, Tasks, Playbook, Approvals, Red Flags, Activity.
- [ ] Filter chips toggle each category on/off.
- [ ] Events render with correct type-specific visual (diamond, bar, dot, checkmark, warning).
- [ ] Click event shows detail popover.
- [ ] Deals with no dates show empty state: "Add key dates to see your deal timeline."

### API Enhancements
- [ ] `GET /api/crm/pipeline-enhancements/timeline` accepts `pipelineId`, `stageIds`, `ownerId`, `startDate`, `endDate`, `groupBy` params.
- [ ] `GET /api/crm/pipeline-enhancements/timeline/:dealId` accepts `include` param and returns requested event types.
- [ ] Response includes `slaStatus` per deal.
- [ ] Response includes `timeRange` bounds.

### Export
- [ ] "Export PNG" button captures the Gantt view via `html-to-image`.
- [ ] Print/PDF via browser print with `@media print` styles (hide toolbar, show header).

## Implementation Order

1. **Backend: Enhance timeline endpoints** (~2 hours)
   - Add query params to `GET /timeline` (pipelineId, stageIds, ownerId, startDate, endDate, groupBy).
   - Add `include` param to `GET /timeline/:dealId`.
   - Extend `buildTimelineEventsForDeal` to include red flags, phase gates, playbook items.
   - Add `slaStatus` computation per deal.
   - Restructure response to `{ deals, events, timeRange }`.

2. **Frontend: GanttToolbar + GanttPopover** (~1 hour)
   - Build shared toolbar component with zoom, group-by, filters, today button, export.
   - Build shared popover component for event details.

3. **Frontend: DealGanttView (Pipeline-level)** (~3 hours)
   - Build the Gantt renderer: left panel (deal rows) + right panel (scrollable timeline).
   - Time axis with gridlines and today marker.
   - Event rendering: diamonds, bars, warning triangles.
   - Zoom/pan behavior.
   - Row hover highlight and SLA tinting.
   - Wire to enhanced API via React Query hook.

4. **Frontend: Pipeline page view toggle** (~30 min)
   - Add Kanban/Gantt toggle to pipeline page header.
   - Conditionally render `SalesPipeline` (Kanban) or `DealGanttView`.

5. **Frontend: DealTimelineTab (Single-deal)** (~2 hours)
   - Build category swimlane renderer.
   - Compose with existing `DealTimelineVisualizer`.
   - Filter chips for category toggle.
   - Wire to enhanced single-deal API.

6. **Frontend: Add Timeline tab to deal-detail.tsx** (~15 min)
   - Insert new tab in the `centerTabs` array.

7. **Export: PNG + Print** (~1 hour)
   - Wire `html-to-image` for PNG export button.
   - Add `@media print` styles.

8. **Empty states + polish** (~30 min)
   - Pipeline Gantt: no deals message.
   - Deal Timeline: no dates message.
   - Loading skeletons.

## Estimated Complexity

**Medium-High**

The backend work is straightforward (enhancing existing endpoints). The frontend is the bulk of the effort — building a custom Gantt renderer with zoom/pan, event positioning, and multiple visual element types. No new dependencies, but the CSS positioning logic for the timeline grid requires careful math.

**Risk areas:**
- Horizontal scroll sync between the header time axis and the body rows.
- Zoom level transitions (recalculating pixel-per-day and re-rendering).
- Handling deals with no dates (must not break layout).

**Mitigation:** Start with Week zoom level as default, add Day/Month after the core layout works.
