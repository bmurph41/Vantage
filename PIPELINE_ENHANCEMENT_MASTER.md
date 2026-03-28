# MarinaMatch Pipeline — Full Enhancement Master Plan
**Deep Audit + Implementation Spec**
Generated: 2026-03-27

---

## SECTION 1: COMPETITIVE FEATURE AUDIT

### What best-in-class CRMs do that MarinaMatch needs

| Feature | Salesforce | HubSpot | Pipedrive | MarinaMatch Current | Gap |
|---|---|---|---|---|---|
| Draggable Kanban with live persistence | ✅ | ✅ | ✅ | ✅ partial | Stage moves work but no automation trigger fires after drag |
| Activity log on deal card | ✅ | ✅ | ✅ | ❌ | Cards show no activity count / last-contacted badge |
| Auto-log stage change as activity | ✅ | ✅ | ✅ | ❌ | `handleDragEnd` never writes to activity log |
| Automation rules execute on drag | ✅ | ✅ | ✅ | ❌ | Routes exist, toggle works, but nothing calls evaluate on move |
| Required fields per stage | ✅ | ✅ | ❌ | ❌ | Salesforce-style gate — block move if fields empty |
| Inline quick-log from card | ✅ | ✅ | ✅ | ❌ | Hover actions render but are `opacity-0` stubs |
| Lead → Pipeline bidirectional link | ✅ | ✅ | ✅ | ❌ | Leads page has no activity feed; Activity Log has no lead filter |
| Prospecting feed → Activity Log | ❌ | ✅ | ✅ | ❌ | One-way at best; no reverse visibility |
| Key dates on Kanban card | ✅ | ✅ | ✅ | partial | Close date shown; DD/deposit/PSA dates not shown |
| Deal rot / staleness alert on card | ✅ | ✅ | ✅ | partial | Flame icon renders but threshold not user-configurable |
| AI deal scoring badge on card | ✅ | ❌ | ✅ (paid) | ❌ | DealScoringCard.tsx exists but not rendered in pipeline |
| Stage conversion / velocity metrics | ✅ | ✅ | ✅ | partial | StageHistoryService exists but not wired to pipeline header |
| Forecast category on card | ✅ | ✅ | ❌ | partial | Field in schema, not shown |
| Multi-branch automation (if/else) | ✅ | ✅ | ❌ | ❌ | Automation only has single action, no branches |
| Bulk stage move | ✅ | ✅ | ❌ | partial | Multi-select exists in deals.tsx, not in pipeline.tsx |
| Notification center / deal rot emails | ✅ | ✅ | ✅ | ❌ | `send_notification` action type defined but never implemented |
| Column WIP limits | ❌ | ❌ | ✅ | ❌ | Pipedrive lets you cap deals per stage |
| Deal comparison in pipeline | ✅ | ✅ | ❌ | ❌ | deal-comparison-page.tsx exists but unreachable from pipeline |
| Global activity search | ✅ | ✅ | ✅ | partial | Activity page has search but can't filter by pipeline/stage |

---

## SECTION 2: CRITICAL BUG FIXES (Do First)

### BUG-01: Automation rules never execute on stage change
**File:** `client/src/pages/pipeline.tsx` — `handleDragEnd` (line ~646)
**Problem:** After `updateDealMutation.mutate(...)`, nothing calls the automation evaluate endpoint.
**Fix:** After successful mutation, call `POST /api/pipeline/automation/evaluate` with `{ dealId, fromStageId, toStageId, orgId }`.

```typescript
// In handleDragEnd, after updateDealMutation success callback:
onSuccess: () => {
  queryClient.invalidateQueries({ queryKey: ['/api/deals'] });
  // NEW: trigger automation evaluation
  apiRequest('POST', '/api/pipeline/automation/evaluate', {
    dealId,
    fromStageId: currentStageId,
    toStageId: targetStageId,
    triggerType: 'stage_change',
  }).catch(() => {}); // fire and forget
}
```

**Server side:** `pipeline-automation-routes.ts` already has a `/evaluate` handler — confirm it:
- Checks all active rules for this org
- Filters by `triggerType === 'stage_change'` and matching `fromStage`/`toStage`
- Executes actions (create_task, send_notification, update_field, move_stage, assign_owner)

### BUG-02: Stage change not auto-logged as activity
**File:** `server/routes/deal-workspace-routes.ts` or the deal update route
**Problem:** `DealStageHistoryService.recordStageTransition()` is built but the deal PATCH/PUT route never calls it.
**Fix:** In the deal update handler, when `stageId` changes, call `dealStageHistoryService.recordStageTransition(...)` AND insert a `stage_change` activity.

```typescript
// In deal update route, after DB update:
if (body.stageId && body.stageId !== existingDeal.stageId) {
  await dealStageHistoryService.recordStageTransition({
    dealId: id, newStageId: body.stageId,
    stageName: newStage.name, orgId,
    transitionedBy: userId,
  });
  // Auto-log activity
  await db.insert(crmActivities).values({
    orgId, type: 'stage_change', direction: 'internal',
    subject: `Deal moved to ${newStage.name}`,
    description: `Stage changed from ${oldStage.name} → ${newStage.name}`,
    dealId: id, userId,
  });
}
```

### BUG-03: Quick-action buttons on Kanban card are invisible stubs
**File:** `client/src/pages/pipeline.tsx` — `DealCard` component (~line 140)
**Problem:** The quick-actions div has `opacity-0 group-hover:opacity-100` but the Card needs `group` class and the actions need actual `onClick` handlers.
**Fix:** Add `group` to the Card className AND wire the inline quick-log buttons.

### BUG-04: Activity Log ↔ Prospecting disconnection
**Files:** `client/src/pages/activity.tsx`, `client/src/pages/leads.tsx`
**Problem:** 
- Activity Log has `deal` filter in type but no `lead` filter
- Leads page shows no activity history per lead
- `/api/activities` query doesn't accept `?leadId=` or `?prospectId=` param
**Fix:** 
1. Add `leadId` to `crmActivities` schema (may already exist as `objectId` with `objectType=lead`)
2. Add filter tabs in Activity Log: All | Deals | Leads | Contacts
3. Add `RecentActivity` mini-feed in the Lead detail modal

---

## SECTION 3: PRIORITY FEATURE ADDITIONS

### FEAT-01: Activity Badges on Kanban Cards (HIGH PRIORITY)
Shows last-contact date and activity count directly on deal cards — exactly what Pipedrive and HubSpot do.

**UI Change in DealCard:**
```tsx
{/* Add near the bottom of CardContent */}
<div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-100">
  <div className="flex items-center gap-1 text-[10px] text-gray-500">
    <Activity className="h-2.5 w-2.5" />
    <span>{deal.activityCount || 0} activities</span>
  </div>
  {deal.lastActivityDate && (
    <div className={`text-[10px] ${
      differenceInDays(new Date(), new Date(deal.lastActivityDate)) > 7 
        ? 'text-amber-600 font-medium' : 'text-gray-400'
    }`}>
      Last: {formatDistanceToNow(new Date(deal.lastActivityDate), { addSuffix: true })}
    </div>
  )}
</div>
```

**API Change:** The `/api/deals` endpoint should join activity count and last activity date per deal. Use a LEFT JOIN with COUNT on `crm_activities` where `deal_id = deals.id`.

### FEAT-02: Inline Quick-Log from Card (HIGH PRIORITY)
Pipedrive's most-used feature: right-click or hover to log a call/email without opening the full deal.

**UI:** Three icon buttons appear on card hover:
- `<Phone>` → opens mini popover: "Log Call" with duration + outcome + notes
- `<Mail>` → opens mini popover: "Log Email" with subject + direction
- `<StickyNote>` → opens mini popover: "Add Note"

Each popover POSTs to `/api/activities` with `dealId` pre-filled, then invalidates deal query (refreshes last-activity badge).

```tsx
// Hover action strip (goes in DealCard, needs stopPropagation on clicks)
<div className="absolute top-2 right-2 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity z-10">
  <QuickLogButton dealId={deal.id} type="call" />
  <QuickLogButton dealId={deal.id} type="email" />
  <QuickLogButton dealId={deal.id} type="note" />
</div>
```

### FEAT-03: Key Dates Chip on Kanban Card (HIGH PRIORITY)
Currently only `expectedCloseDate` shows. DD dates, deposit dates, and PSA dates are critical for CRE acquisitions.

**Logic:** Show the NEXT upcoming date with appropriate urgency color:
- `ddExpirationDate` — red if < 7 days
- `firstDepositDueDate` — orange if < 14 days  
- `closingDate` — yellow if < 30 days
- `expectedCloseDate` — default

```tsx
const getNextKeyDate = (deal: DealWithRelations) => {
  const dates = [
    { label: 'DD Exp', date: deal.ddExpirationDate, urgencyDays: 7, color: 'red' },
    { label: '1st Dep', date: deal.firstDepositDueDate, urgencyDays: 14, color: 'orange' },
    { label: 'Closing', date: deal.closingDate, urgencyDays: 30, color: 'yellow' },
    { label: 'Close Est', date: deal.expectedCloseDate, urgencyDays: 60, color: 'blue' },
  ].filter(d => d.date).sort((a, b) => 
    new Date(a.date!).getTime() - new Date(b.date!).getTime()
  );
  return dates[0] || null;
};
```

### FEAT-04: Stage Column Velocity Header (MEDIUM PRIORITY)
Salesforce and HubSpot show conversion rates and avg deal age per stage column.

**UI Addition to each stage column header:**
```tsx
<div className="flex items-center gap-2 text-[10px] text-gray-500 mt-1">
  <span>{stageDeals.length} deals</span>
  <span>•</span>
  <span>{formatCompactCurrency(totalValue)}</span>
  {avgDaysInStage && (
    <>
      <span>•</span>
      <span className={avgDaysInStage > rotThreshold ? 'text-red-500' : ''}>
        avg {Math.round(avgDaysInStage)}d
      </span>
    </>
  )}
</div>
```

### FEAT-05: Automation Rule Execution Engine (HIGH PRIORITY)
The automation rules panel (CRUD) works but the execution side is missing. 

**Actions that need real implementations:**

**`create_task`:** Insert into `crm_tasks` (or `crm_activities` with `type='task'`) with due date calculated from `actionConfig.dueDays` offset from today.

**`send_notification`:** Write to a `crm_notifications` table (or in-app toast system) + optionally send email via nodemailer/SendGrid.

**`update_field`:** PATCH the deal record with `{ [actionConfig.fieldName]: actionConfig.fieldValue }`.

**`assign_owner`:** PATCH the deal record with `{ ownerId: actionConfig.userId }`.

**`move_stage`:** This creates a chain — be careful of infinite loops. Add a `_automationTriggered: true` flag to prevent recursive evaluation.

**`days_in_stage` trigger:** A cron job (or scheduled check on page load) that queries all deals where `currentStageEnteredAt < now - X days` and evaluates matching rules.

### FEAT-06: Multi-Branch Automation (MEDIUM PRIORITY — HubSpot-parity)
Add condition branching to the automation rule schema.

**Schema addition:**
```typescript
// In pipelineAutomationRules:
conditionGroups: jsonb("condition_groups").default([])
// Structure: [{ logic: 'AND'|'OR', conditions: [{ field, operator, value }] }]
```

**UI:** Extend AutomationRulesPanel.tsx to show "Add Condition" — e.g., "Only run this rule if deal.amount > 500000" or "if deal.assetClass = marina".

### FEAT-07: Stage Entry Requirements / Gates (MEDIUM PRIORITY — Salesforce-parity)
Block a deal from moving to a stage if required fields aren't filled.

**Config:** In `PipelineSettingsModal`, per-stage config: `requiredFields: string[]`
**Enforcement:** In `handleDragEnd`, before calling `updateDealMutation`, check required fields:
```typescript
const requiredFields = stageRequirements[targetStageId] || [];
const missingFields = requiredFields.filter(f => !deal[f]);
if (missingFields.length > 0) {
  toast({ 
    title: "Stage requirements not met", 
    description: `Required: ${missingFields.join(', ')}`,
    variant: "destructive" 
  });
  return; // cancel the drag
}
```

### FEAT-08: Activity Log ↔ Leads / Prospecting Bidirectional Feed
**Changes needed:**

1. **Activity Log page** — add a `Leads` tab filter:
```tsx
<SelectItem value="lead">Lead Activities</SelectItem>
```
And pass `?objectType=lead` or `?leadId=` to `/api/activities` query.

2. **Leads page** — add a collapsible `Recent Activity` section per lead using the same `/api/activities?leadId={id}` endpoint.

3. **Lead detail modal** — add an Activity Feed tab identical to deal-detail.tsx's activity tab.

4. **Activity log form** — when logging from the Activity Log page, allow selecting a Lead as the associated entity (in addition to Contact/Company/Deal).

5. **`activity-association-service.ts`** — add `lead` case to the switch:
```typescript
} else if (originObjectType === 'lead') {
  const [lead] = await db.select().from(crmLeads).where(eq(crmLeads.id, originObjectId));
  if (lead?.contactId) addTarget('contact', lead.contactId, false);
  if (lead?.companyId) addTarget('company', lead.companyId, false);
}
```

### FEAT-09: Deal Comparison Surfaced in Pipeline (LOW-MEDIUM)
The `deal-comparison-page.tsx` exists but is unreachable from the pipeline view.

**Add to pipeline.tsx toolbar:**
```tsx
<Button variant="outline" size="sm" onClick={() => setViewMode('comparison')}>
  <BarChart3 className="h-3.5 w-3.5 mr-1" /> Compare
</Button>
```
And in the view renderer, when `viewMode === 'comparison'`, render `<DealComparisonPanel selectedDeals={selectedDeals} />` which wraps the existing comparison page as an embedded panel.

**Also:** Add checkbox multi-select on Kanban cards (shift+click or checkbox in corner) that populates `selectedDeals`.

### FEAT-10: WIP Limits per Stage Column (LOW — Pipedrive-parity)
Per-stage maximum deal count, configurable in Pipeline Settings.

```typescript
// In pipelineStages schema (already has JSON config field):
wipLimit: integer("wip_limit") // null = unlimited
```
**UI:** When a column is at/over WIP limit, show column header in amber + warn on drag.

### FEAT-11: Forecast Category on Card (MEDIUM)
Salesforce's "Commit / Best Case / Pipeline / Omit" categories give managers a quick read.

**Add to DealCard:**
```tsx
{deal.forecastCategory && (
  <Badge className={`text-[9px] h-4 px-1 ${
    deal.forecastCategory === 'commit' ? 'bg-green-100 text-green-700' :
    deal.forecastCategory === 'best_case' ? 'bg-blue-100 text-blue-700' :
    deal.forecastCategory === 'pipeline' ? 'bg-gray-100 text-gray-600' :
    'bg-red-100 text-red-600'
  }`}>
    {deal.forecastCategory.replace('_', ' ')}
  </Badge>
)}
```

### FEAT-12: Deal Rot Push Notifications (MEDIUM — Pipedrive-parity)
Currently rot is only visual (flame icon). Pipedrive sends email/in-app alerts.

**Implementation:**
1. Create a `crm_notifications` table: `{ id, orgId, userId, type, title, body, dealId, readAt, createdAt }`
2. A nightly cron (or on-login check) scans for deals where `daysInCurrentStage > rotThreshold` and inserts notifications
3. A notification bell in the topbar reads unread count from `/api/notifications`

### FEAT-13: Pipeline Velocity Report in Analytics Tab (MEDIUM)
`DealStageHistoryService.getDealVelocityMetrics()` exists but has no UI.

**Add a "Velocity" tab to PipelineInsights.tsx** showing:
- Bar chart: avg days per stage (bottleneck identification)
- Funnel: stage conversion rates (deals entering vs exiting each stage)
- Trend: velocity improving or degrading over 30/60/90 days

### FEAT-14: Deal Score Badge on Card (MEDIUM)
`DealScoringCard.tsx` and `deal-scoring-routes.ts` exist. Just need to render the score on the Kanban card.

**Add to DealCard:**
```tsx
{deal.score != null && (
  <div className={`text-[10px] font-bold px-1.5 py-0.5 rounded w-fit ${
    deal.score >= 80 ? 'bg-green-100 text-green-700' :
    deal.score >= 60 ? 'bg-yellow-100 text-yellow-700' :
    'bg-red-100 text-red-600'
  }`}>
    {deal.score}pts
  </div>
)}
```
The score should be computed server-side and stored on the deal record (or returned in the deals query join).

---

## SECTION 4: IMPLEMENTATION SCRIPTS

All scripts use the preferred heredoc pattern for Replit shell execution.

---

### SCRIPT 1: Wire Automation Execution on Stage Change

```bash
cat > /tmp/fix_automation_trigger.mjs << 'SCRIPT'
import { readFileSync, writeFileSync } from 'fs';

const filePath = 'client/src/pages/pipeline.tsx';
let src = readFileSync(filePath, 'utf8');

// Find handleDragEnd and patch the onSuccess callback of updateDealMutation
const oldOnSuccess = `    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/deals'] });
    },`;

const newOnSuccess = `    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['/api/deals'] });
      // Trigger automation evaluation on stage change
      apiRequest('POST', '/api/pipeline/automation/evaluate', {
        dealId: vars.dealId,
        fromStageId: vars.fromStageId,
        toStageId: vars.stageId,
        triggerType: 'stage_change',
      }).catch(() => {});
    },`;

if (src.includes(oldOnSuccess)) {
  src = src.replace(oldOnSuccess, newOnSuccess);
  console.log('✅ Patched automation trigger in handleDragEnd onSuccess');
} else {
  console.log('⚠️  Could not find exact onSuccess block - manual patch needed');
  console.log('Search for the updateDealMutation and add automation call to its onSuccess');
}

// Also update mutation type to include fromStageId
const oldMutType = `mutationFn: async ({ dealId, stageId, stage }: { dealId: string; stageId: string; stage: string })`;
const newMutType = `mutationFn: async ({ dealId, stageId, stage, fromStageId }: { dealId: string; stageId: string; stage: string; fromStageId?: string })`;
if (src.includes(oldMutType)) {
  src = src.replace(oldMutType, newMutType);
  console.log('✅ Patched mutation type to include fromStageId');
}

// Update handleDragEnd to pass fromStageId
const oldMutateCall = `updateDealMutation.mutate({ dealId, stageId: targetStageId, stage: targetStage.name });`;
const newMutateCall = `updateDealMutation.mutate({ dealId, stageId: targetStageId, stage: targetStage.name, fromStageId: currentStageId });`;
if (src.includes(oldMutateCall)) {
  src = src.replace(oldMutateCall, newMutateCall);
  console.log('✅ Patched mutate call to pass fromStageId');
}

writeFileSync(filePath, src);
console.log('Done.');
SCRIPT
node /tmp/fix_automation_trigger.mjs
```

---

### SCRIPT 2: Auto-Log Stage Change as Activity (Server)

```bash
cat > /tmp/fix_stage_activity_log.mjs << 'SCRIPT'
import { readFileSync, writeFileSync } from 'fs';

// The key is in the deal update route. Find the route file that handles PATCH/PUT /api/deals/:id
// This is likely in server/routes/deal-workspace-routes.ts or a crm-deals route
// The patch below adds auto-activity-logging after stageId changes

const routeFiles = [
  'server/routes/deal-workspace-routes.ts',
  'server/routes/crm-pipeline-enhancements-routes.ts',
];

for (const file of routeFiles) {
  try {
    const content = readFileSync(file, 'utf8');
    console.log(`\n=== ${file} ===`);
    // Find PUT/PATCH deal handlers
    const hasDealUpdate = content.includes('stageId') && 
      (content.includes('router.put') || content.includes('router.patch'));
    console.log(`Has deal update with stageId: ${hasDealUpdate}`);
    
    // Check if stage-change activity logging exists
    const hasStageActivityLog = content.includes('stage_change') && 
      content.includes('crmActivities');
    console.log(`Has stage-change activity logging: ${hasStageActivityLog}`);
  } catch (e) {
    console.log(`File not found: ${file}`);
  }
}

console.log('\n--- ACTION REQUIRED ---');
console.log('In your deal UPDATE route (PUT /api/crm/deals/:id or similar):');
console.log('After updating the deal, add this block:');
console.log(`
if (updateData.stageId && updateData.stageId !== existingDeal.stageId) {
  const [newStage] = await db.select().from(crmPipelineStages)
    .where(eq(crmPipelineStages.id, updateData.stageId));
  const [oldStage] = await db.select().from(crmPipelineStages)
    .where(eq(crmPipelineStages.id, existingDeal.stageId));
  
  // Auto-log stage change activity
  await db.insert(crmActivities).values({
    orgId,
    type: 'stage_change',
    direction: 'internal',
    subject: \`Stage: \${oldStage?.name || 'Unknown'} → \${newStage?.name || 'Unknown'}\`,
    description: \`Deal moved to \${newStage?.name}\`,
    dealId: id,
    userId: userId || null,
    date: new Date(),
  });

  // Record in stage history
  await dealStageHistoryService.recordStageTransition({
    dealId: id,
    newStageId: updateData.stageId,
    stageName: newStage?.name || 'Unknown',
    orgId,
    transitionedBy: userId || undefined,
  });
}
`);
SCRIPT
node /tmp/fix_stage_activity_log.mjs
```

---

### SCRIPT 3: Activity Log ↔ Leads Bidirectional Feed Enhancement

```bash
cat > /tmp/patch_activity_leads_bridge.mjs << 'SCRIPT'
import { readFileSync, writeFileSync } from 'fs';

// 1. Patch activity.tsx to add Lead filter option
const activityFile = 'client/src/pages/activity.tsx';
let actSrc = readFileSync(activityFile, 'utf8');

// Add 'lead' to type filter options
const oldLeadFilter = `<SelectItem value="deal_created">Deals Created</SelectItem>`;
const newLeadFilter = `<SelectItem value="deal_created">Deals Created</SelectItem>
                      <SelectItem value="lead_activity">Lead Activities</SelectItem>`;

if (actSrc.includes(oldLeadFilter)) {
  actSrc = actSrc.replace(oldLeadFilter, newLeadFilter);
  console.log('✅ Added Lead Activities filter option to Activity Log');
}

// Add leadId to the URL params when fetching activities
const oldActivitiesQuery = `queryKey: ['/api/activities'],`;
const newActivitiesQuery = `queryKey: ['/api/activities', typeFilter, directionFilter, dateRangeFilter],`;
if (actSrc.includes(oldActivitiesQuery)) {
  actSrc = actSrc.replace(oldActivitiesQuery, newActivitiesQuery);
  console.log('✅ Updated activities queryKey to include filters');
}

writeFileSync(activityFile, actSrc);

// 2. Patch activity-association-service.ts to handle 'lead' origin
const assocFile = 'server/services/activity-association-service.ts';
let assocSrc = readFileSync(assocFile, 'utf8');

const oldElseDeal = `} else if (originObjectType === 'deal') {`;
const leadCaseInsert = `} else if (originObjectType === 'lead') {
      // When activity is on a lead, also associate with the converted contact/deal if exists
      try {
        const { crmLeads } = await import('@shared/schema');
        const [lead] = await db.select({ contactId: crmLeads.primaryContactId, companyId: crmLeads.accountId })
          .from(crmLeads)
          .where(and(eq(crmLeads.id, originObjectId), eq(crmLeads.orgId, orgId)));
        if (lead?.contactId) addTarget('contact', lead.contactId, false);
        if (lead?.companyId) addTarget('company', lead.companyId, false);
      } catch (e) { /* schema mismatch - non-fatal */ }
    } else if (originObjectType === 'deal') {`;

if (assocSrc.includes(oldElseDeal) && !assocSrc.includes("originObjectType === 'lead'")) {
  assocSrc = assocSrc.replace(oldElseDeal, leadCaseInsert);
  console.log('✅ Added lead→contact/company association to activity-association-service');
  writeFileSync(assocFile, assocSrc);
} else {
  console.log('ℹ️  Lead case already exists or pattern not found in assoc service');
}

console.log('\nDone. Also manually add to leads.tsx: a <RecentActivity> tab inside LeadDetailModal');
SCRIPT
node /tmp/patch_activity_leads_bridge.mjs
```

---

### SCRIPT 4: Add Activity Badges + Key Dates + Quick-Log to Kanban Cards

This is the most impactful visual change. The full patch for `pipeline.tsx` DealCard:

```bash
cat > /tmp/patch_deal_card.mjs << 'SCRIPT'
import { readFileSync, writeFileSync } from 'fs';
const file = 'client/src/pages/pipeline.tsx';
let src = readFileSync(file, 'utf8');

// 1. Ensure 'group' is on the Card className
const oldCardClass = `className={\`
          cursor-grab active:cursor-grabbing transition-all duration-200 border`;
const newCardClass = `className={\`
          group cursor-grab active:cursor-grabbing transition-all duration-200 border`;
if (src.includes(oldCardClass)) {
  src = src.replace(oldCardClass, newCardClass);
  console.log('✅ Added group class to Card');
}

// 2. Add Activity Badge section just before closing </CardContent>
// Find the closing pattern of CardContent in DealCard
const oldCardContentClose = `        </CardContent>
      </Card>
    </div>
  );
}

// ─── Stage Column`;

const activityBadge = `        {/* Activity badge + key dates row */}
        <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-gray-50">
          <div className="flex items-center gap-1 text-[10px] text-gray-400">
            <Activity className="h-2.5 w-2.5" />
            <span>{(deal as any).activityCount || 0}</span>
          </div>
          {(() => {
            const keyDates = [
              { label: 'DD', date: (deal as any).ddExpirationDate, warnDays: 7, cls: 'text-red-600' },
              { label: 'Dep', date: (deal as any).firstDepositDueDate, warnDays: 14, cls: 'text-orange-600' },
              { label: 'Close', date: (deal as any).closingDate, warnDays: 30, cls: 'text-yellow-700' },
            ].filter(d => d.date).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
            const next = keyDates[0];
            if (!next) return null;
            const daysUntil = differenceInDays(new Date(next.date), new Date());
            return (
              <div className={\`text-[10px] font-medium \${daysUntil <= next.warnDays ? next.cls : 'text-gray-400'}\`}>
                {next.label}: {format(new Date(next.date), 'MMM d')}
                {daysUntil <= next.warnDays && <span className="ml-0.5">({daysUntil}d)</span>}
              </div>
            );
          })()}
        </div>
        {/* Quick-log action strip (visible on hover) */}
        <div className="absolute bottom-2 right-2 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity z-10">
          {[
            { type: 'call', icon: <Phone className="h-3 w-3" />, label: 'Log Call' },
            { type: 'email', icon: <Mail className="h-3 w-3" />, label: 'Log Email' },
            { type: 'note', icon: <StickyNote className="h-3 w-3" />, label: 'Add Note' },
          ].map(({ type, icon, label }) => (
            <Tooltip key={type}>
              <TooltipTrigger asChild>
                <button
                  className="w-6 h-6 rounded bg-white border border-gray-200 shadow-sm flex items-center justify-center hover:bg-blue-50 hover:border-blue-300 transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    // Open quick-log popover — implement with state in parent or a portal
                    window.dispatchEvent(new CustomEvent('quick-log', {
                      detail: { dealId: deal.id, dealTitle: deal.title, type }
                    }));
                  }}
                >
                  {icon}
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">{label}</TooltipContent>
            </Tooltip>
          ))}
        </div>`;

if (src.includes(oldCardContentClose)) {
  src = src.replace(oldCardContentClose, activityBadge + '\n' + oldCardContentClose);
  console.log('✅ Added activity badge, key dates, and quick-log strip to DealCard');
} else {
  console.log('⚠️  Could not find CardContent close pattern - check manually');
}

// 3. Add Activity import if not present
if (!src.includes("Activity,") && src.includes("from \"lucide-react\"")) {
  src = src.replace(
    "Clock, ArrowRight, Phone, Mail, StickyNote,",
    "Clock, ArrowRight, Phone, Mail, StickyNote, Activity,"
  );
  console.log('✅ Added Activity to lucide imports');
}

writeFileSync(file, src);
console.log('Card patch complete.');
SCRIPT
node /tmp/patch_deal_card.mjs
```

---

### SCRIPT 5: QuickLog Event Listener in Pipeline Page

Add a global `quick-log` event listener that shows a mini popover for fast activity logging:

```bash
cat > /tmp/patch_quicklog_listener.mjs << 'SCRIPT'
import { readFileSync, writeFileSync } from 'fs';
const file = 'client/src/pages/pipeline.tsx';
let src = readFileSync(file, 'utf8');

// Add state for quick-log
const oldUseState = `const [isSettingsOpen, setIsSettingsOpen] = useState(false);`;
const newUseState = `const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [quickLog, setQuickLog] = useState<{ dealId: string; dealTitle: string; type: string } | null>(null);
  const [quickLogNote, setQuickLogNote] = useState('');`;

if (src.includes(oldUseState) && !src.includes('quickLog,')) {
  src = src.replace(oldUseState, newUseState);
  console.log('✅ Added quickLog state');
}

// Add useEffect for custom event listener after existing useEffects
const eventListenerBlock = `
  // Quick-log event listener from card hover actions
  useEffect(() => {
    const handler = (e: Event) => {
      const { dealId, dealTitle, type } = (e as CustomEvent).detail;
      setQuickLog({ dealId, dealTitle, type });
      setQuickLogNote('');
    };
    window.addEventListener('quick-log', handler);
    return () => window.removeEventListener('quick-log', handler);
  }, []);

  const quickLogMutation = useMutation({
    mutationFn: async (data: { dealId: string; type: string; subject: string; description: string }) => {
      return apiRequest('POST', '/api/activities', {
        ...data, direction: data.type === 'note' ? 'internal' : 'outbound',
        date: new Date().toISOString(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/deals'] });
      queryClient.invalidateQueries({ queryKey: ['/api/activities'] });
      toast({ title: 'Activity logged', description: \`\${quickLog?.type} recorded on deal\` });
      setQuickLog(null);
    },
    onError: () => toast({ title: 'Failed to log activity', variant: 'destructive' }),
  });
`;

// Insert before the main return statement
const returnStatement = `  return (\n    <div`;
if (src.includes(returnStatement) && !src.includes('quick-log')) {
  src = src.replace(returnStatement, eventListenerBlock + '\n  return (\n    <div');
  console.log('✅ Added quickLog useEffect and mutation');
}

// Add QuickLog modal just before the closing div of the return
const quickLogModal = `
      {/* Quick-Log Modal */}
      {quickLog && (
        <div className="fixed inset-0 z-50 bg-black/20 flex items-center justify-center" onClick={() => setQuickLog(null)}>
          <div className="bg-white rounded-xl shadow-2xl p-5 w-80 space-y-3" onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold text-sm text-gray-900">
              {quickLog.type === 'call' ? '📞 Log Call' : quickLog.type === 'email' ? '✉️ Log Email' : '📝 Add Note'}
              <span className="font-normal text-gray-500 ml-1">— {quickLog.dealTitle}</span>
            </h3>
            <Input
              placeholder={quickLog.type === 'note' ? 'Write your note...' : 'Subject / outcome...'}
              value={quickLogNote}
              onChange={e => setQuickLogNote(e.target.value)}
              className="text-sm"
              onKeyDown={e => {
                if (e.key === 'Enter' && quickLogNote.trim()) {
                  quickLogMutation.mutate({
                    dealId: quickLog.dealId,
                    type: quickLog.type,
                    subject: quickLogNote,
                    description: quickLogNote,
                  });
                }
              }}
            />
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={() => setQuickLog(null)}>Cancel</Button>
              <Button size="sm" disabled={!quickLogNote.trim() || quickLogMutation.isPending}
                onClick={() => quickLogMutation.mutate({
                  dealId: quickLog.dealId, type: quickLog.type,
                  subject: quickLogNote, description: quickLogNote,
                })}>
                {quickLogMutation.isPending ? 'Saving...' : 'Save'}
              </Button>
            </div>
          </div>
        </div>
      )}
`;

// Add before last </div> in return
const lastDivClose = `  );\n}`;
if (src.includes(lastDivClose) && !src.includes('Quick-Log Modal')) {
  const lastIdx = src.lastIndexOf(lastDivClose);
  src = src.slice(0, lastIdx - 2) + '\n' + quickLogModal + '\n    </div>\n  );\n}';
  console.log('✅ Added QuickLog modal to pipeline render');
}

writeFileSync(file, src);
console.log('QuickLog listener patch complete.');
SCRIPT
node /tmp/patch_quicklog_listener.mjs
```

---

### SCRIPT 6: Stage Column Velocity Stats Header Enhancement

```bash
cat > /tmp/patch_stage_header_velocity.mjs << 'SCRIPT'
import { readFileSync, writeFileSync } from 'fs';
const file = 'client/src/pages/pipeline.tsx';
let src = readFileSync(file, 'utf8');

// Find the stage column header rendering and add velocity stats
// Look for where stage name is rendered in the column header
const oldStageHeader = `<h3 className="font-semibold text-sm text-gray-900 truncate flex-1">
                    {stage.name}
                  </h3>`;

const newStageHeader = `<h3 className="font-semibold text-sm text-gray-900 truncate flex-1">
                    {stage.name}
                  </h3>`;
// The velocity stats get added right after the deal count / total value in the column header

// More reliable: find the total value display and add avg days below
const oldTotalValue = `<span className="text-xs font-medium text-gray-600">
                      {formatCompactCurrency(stageDeals.reduce((sum, d) => sum + (Number(d.amount) || 0), 0))}
                    </span>`;
const newTotalValue = `<span className="text-xs font-medium text-gray-600">
                      {formatCompactCurrency(stageDeals.reduce((sum, d) => sum + (Number(d.amount) || 0), 0))}
                    </span>
                    {stageDeals.length > 0 && (() => {
                      const avgDays = stageDeals.reduce((sum, d) => 
                        sum + (calculateDaysInStage(d.currentStageEnteredAt) || 0), 0
                      ) / stageDeals.length;
                      return (
                        <span className={\`text-[10px] \${avgDays > (rotThreshold || 30) ? 'text-red-500 font-semibold' : 'text-gray-400'}\`}>
                          avg {Math.round(avgDays)}d
                        </span>
                      );
                    })()}`;

if (src.includes(oldTotalValue)) {
  src = src.replace(oldTotalValue, newTotalValue);
  console.log('✅ Added avg-days velocity stat to stage column header');
} else {
  console.log('⚠️  Could not find total value span - add velocity stats manually to stage header');
}

writeFileSync(file, src);
console.log('Stage header velocity patch complete.');
SCRIPT
node /tmp/patch_stage_header_velocity.mjs
```

---

### SCRIPT 7: Automation Evaluate Endpoint — Ensure Actions Execute

```bash
cat > /tmp/verify_automation_evaluate.mjs << 'SCRIPT'
import { readFileSync } from 'fs';
const file = 'server/routes/pipeline-automation-routes.ts';
const src = readFileSync(file, 'utf8');

console.log('Checking automation evaluate endpoint...');
console.log('Has /evaluate route:', src.includes("'/evaluate'") || src.includes('"/evaluate"'));
console.log('Has create_task action:', src.includes("create_task"));
console.log('Has send_notification action:', src.includes("send_notification"));
console.log('Has update_field action:', src.includes("update_field"));
console.log('Has days_in_stage evaluation:', src.includes("days_in_stage"));

if (!src.includes("create_task") || !src.includes('crmActivities')) {
  console.log('\n⚠️  ACTION NEEDED: The evaluate endpoint needs full action execution code.');
  console.log('Add these cases to the evaluate handler:');
  console.log(`
  // Inside evaluate handler, switch on rule.actionType:
  case 'create_task': {
    await db.insert(crmActivities).values({
      orgId, type: 'task', direction: 'internal',
      subject: rule.actionConfig.taskTitle || 'Automated Task',
      description: rule.actionConfig.taskDescription || '',
      dealId: body.dealId,
      dueDate: rule.actionConfig.dueDays 
        ? addDays(new Date(), rule.actionConfig.dueDays) : null,
      userId: rule.actionConfig.assignToUserId || null,
    });
    break;
  }
  case 'send_notification': {
    await db.insert(crmNotifications).values({
      orgId, userId: deal.ownerId,
      type: 'automation',
      title: rule.actionConfig.notificationTitle || rule.name,
      body: rule.actionConfig.notificationTemplate || \`Automation rule fired: \${rule.name}\`,
      dealId: body.dealId,
    });
    break;
  }
  case 'update_field': {
    await db.update(crmDeals)
      .set({ [rule.actionConfig.fieldName]: rule.actionConfig.fieldValue })
      .where(and(eq(crmDeals.id, body.dealId), eq(crmDeals.orgId, orgId)));
    break;
  }
  case 'assign_owner': {
    if (rule.actionConfig.userId) {
      await db.update(crmDeals)
        .set({ ownerId: rule.actionConfig.userId })
        .where(and(eq(crmDeals.id, body.dealId), eq(crmDeals.orgId, orgId)));
    }
    break;
  }
  `);
}
SCRIPT
node /tmp/verify_automation_evaluate.mjs
```

---

## SECTION 5: ADDITIONAL WORLD-CLASS FEATURES TO BUILD NEXT

### A. Deal Health Score (AI-powered, Salesforce Einstein-inspired)
Auto-compute a 0–100 score per deal based on:
- Days in stage (negative if too long)
- Activity recency (positive if contacted < 7 days)
- Field completeness (positive for filled key fields)
- Probability vs stage benchmark
- Approaching key dates (negative if DD expires soon)

Store in `crm_deals.score` (integer), recompute on save.

### B. Pipeline AI Nudge System (Pipedrive AI Assistant-inspired)
Daily digest component in the pipeline sidebar:
- "You have 3 deals that haven't been contacted in 14+ days"
- "Deal X is approaching its DD expiration in 5 days — schedule your inspection"
- "Your Negotiation stage has 7 deals — higher than usual. Check for blockers"

Implemented as a `/api/pipeline/nudges` endpoint that returns contextual alerts based on:
- Rot analysis (stale deals)
- Upcoming deadline scan  
- Stage WIP limit breach
- Close date passed without stage advance

### C. Multi-Pipeline Support Enhancement
Currently `selectedPipelineId` controls which pipeline is shown. Add:
- Pipeline switcher dropdown in topbar (already partial)
- Per-pipeline ROT threshold settings
- Pipeline-level analytics (win rate per pipeline)
- Stage templates that can be applied to new pipelines

### D. Email Activity Auto-Capture
When emails are logged in the Activity Log with a deal associated, automatically:
1. Update `deal.lastActivityDate`
2. Reset the rot timer
3. Create a timeline event
4. If it was an inbound email from the contact, auto-update `deal.probability` upward by 5%

### E. Bulk Operations on Kanban
Currently multi-select only exists in deals.tsx (list view). Add to pipeline.tsx Kanban:
- Hold Shift + click cards to multi-select
- Bulk action bar appears at top: "Move X deals to stage ▼", "Assign to ▼", "Export CSV"

### F. Deal Age vs Stage Benchmark
Each stage column shows a small indicator: "deals typically spend 8 days here — your avg is 12d ⚠️"
Derived from the stage history service median durations vs current deals.

---

## SECTION 6: COMPLETE FEATURE IMPLEMENTATION CHECKLIST

### Phase A — Critical Wiring (Do this session)
- [ ] BUG-01: Automation fires on stage change drag
- [ ] BUG-02: Stage change auto-logged as activity  
- [ ] BUG-03: Quick-action buttons wired on card hover
- [ ] BUG-04: Activity Log has lead filter + leads have activity feed
- [ ] FEAT-01: Activity badge on Kanban card (count + last contacted)
- [ ] FEAT-03: Key dates chip on Kanban card (DD / deposit / close)
- [ ] FEAT-04: Stage column avg-days velocity header

### Phase B — Feature Completion (Next session)
- [ ] FEAT-02: Inline Quick-Log popover (call/email/note from card)
- [ ] FEAT-05: Automation execution engine (all 5 action types working)
- [ ] FEAT-07: Stage entry requirements / field gates
- [ ] FEAT-09: Deal comparison accessible from pipeline view
- [ ] FEAT-11: Forecast category badge on card
- [ ] FEAT-14: Deal score badge on card

### Phase C — Power Features (Future sessions)
- [ ] FEAT-06: Multi-branch automation (if/else conditions)
- [ ] FEAT-08: Full prospecting ↔ activity bidirectional feed
- [ ] FEAT-10: WIP limits per stage column
- [ ] FEAT-12: Deal rot push notification system
- [ ] FEAT-13: Pipeline velocity report in Analytics tab
- [ ] Deal Health Score (AI-computed)
- [ ] AI Nudge System
- [ ] Bulk Kanban operations
- [ ] Email activity auto-capture

---

## SECTION 7: ROUTES REGISTRATION AUDIT

Confirm these are all registered in `server/routes.ts`:

```typescript
// These routes exist as files — verify they're imported and mounted:
app.use('/api/pipeline/automation', pipelineAutomationRoutes);  // ← critical for BUG-01
app.use('/api/pipeline/analytics', pipelineAnalyticsRoutes);
app.use('/api/pipeline/templates', pipelineTemplateRoutes);
app.use('/api/deal-analytics', dealAnalyticsRoutes);
app.use('/api/deal-scoring', dealScoringRoutes);
app.use('/api/forecasting', forecastingRoutes);
app.use('/api/crm/pipeline', crmPipelineEnhancementsRoutes);
app.use('/api/ai/deals', aiDealIntelligenceRoutes);
```

**Verify with:**
```bash
grep -n "automation\|deal-analytics\|deal-scoring\|forecasting" server/routes.ts | head -20
```

If any are missing, the frontend will silently get 404s even though the files exist.

---

## APPENDIX: SCHEMA ADDITIONS NEEDED

```sql
-- Notifications table (for FEAT-12 and automation send_notification action)
CREATE TABLE crm_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id VARCHAR NOT NULL,
  user_id VARCHAR,
  type TEXT NOT NULL DEFAULT 'automation', -- automation, system, deal_rot, task_due
  title TEXT NOT NULL,
  body TEXT,
  deal_id UUID REFERENCES crm_deals(id),
  read_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Add to crm_deals if not present:
ALTER TABLE crm_deals ADD COLUMN IF NOT EXISTS score INTEGER;
ALTER TABLE crm_deals ADD COLUMN IF NOT EXISTS activity_count INTEGER DEFAULT 0;
ALTER TABLE crm_pipeline_stages ADD COLUMN IF NOT EXISTS wip_limit INTEGER;
ALTER TABLE crm_pipeline_stages ADD COLUMN IF NOT EXISTS required_fields JSONB DEFAULT '[]';
```

---

*End of Pipeline Enhancement Master Plan*
*This document should be committed to the MarinaMatch journal after implementation.*
