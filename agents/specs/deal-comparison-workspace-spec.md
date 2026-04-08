# Deal Comparison in Workspace — Build Spec

## Summary

Add a **Deal Comparison** tab to the modeling workspace's Analysis group that lets users
select 2-6 deals (with linked modeling projects) and compare their financial model outputs
side-by-side: Pro Forma, DCF/Returns, Capital Stack, Exit Strategy, and CRM deal metrics.

**Complexity:** Medium-High (~900-1,200 lines across 3-4 files)  
**Priority:** CRM Build Priority #3  
**Dependencies:** None — all required backend endpoints already exist  

---

## Why This Matters

IC committees need to compare multiple deals before allocating capital. Today the platform
has two disconnected comparison tools:
- `deal-comparison-page.tsx` — CRM-level metrics only (no financial model data)
- `scenario-comparison-charts.tsx` — compares scenarios *within a single project*

Neither lets an analyst pull up 3-4 deals and compare their Pro Forma NOI trajectories,
levered IRR, capital structure, or exit proceeds side-by-side. This feature closes that gap.

---

## Architecture Decision: Workspace Tab vs Standalone Page

**Decision: New workspace tab + standalone page route.**

Rationale:
- Workspace tab allows comparing the *current project* against peers (context-aware)
- Standalone route (`/crm/deals/compare-models?ids=...`) allows launching from pipeline/kanban
- Both render the same `DealModelComparison` component with different initial state

---

## Backend

### Existing Endpoints to Leverage (NO new backend needed for MVP)

The following endpoints already exist and return all needed data:

| Endpoint | What it returns | File |
|---|---|---|
| `POST /api/returns/compare-models` | Pro forma metrics for multiple projects (IRR, equity multiple, NOI, cap rates) | `returns-routes.ts` |
| `GET /api/exit-studio/compare?ids=` | Side-by-side exit KPIs across scenarios | `exit-studio-routes.ts` |
| `GET /api/returns/model/:modelId` | Levered/unlevered returns for one project | `returns-routes.ts` |
| `GET /api/deals/:id` | Full deal CRM data with asset class fields | `routes.ts` |
| `GET /api/deals/:dealId/modeling-project` | Linked modeling project lookup | `routes.ts` |
| `GET /api/modeling/projects/:id/pro-forma-charts` | Pro forma chart data (revenue/expense breakdown) | `analytics-routes.ts` |
| `POST /api/debt/capital-stack-report` | Capital structure summary | `enhanced-debt-routes.ts` |
| `GET /api/modeling/projects/:id/scenario-comparison` | Scenario metrics with yearly data | `modeling-validation-routes.ts` |

### New Endpoint: `POST /api/deals/compare-full`

One new **aggregation endpoint** that orchestrates all data in a single request to avoid
N+1 fetches from the frontend:

**File:** `server/routes/crm-enhancements-routes.ts` (add to existing file)

```
POST /api/deals/compare-full
Body: { dealIds: string[] }   // 2-6 deal IDs
```

**Response shape:**

```typescript
interface DealComparisonFull {
  deals: {
    dealId: string;
    dealName: string;
    assetClass: string;
    stage: string;
    amount: number | null;
    closeDate: string | null;
    modelingProjectId: string | null;
    crmMetrics: Record<string, any>;  // asset-class-specific fields
    proForma: {
      purchasePrice: number;
      noi: number[];            // by year
      totalRevenue: number[];
      totalExpenses: number[];
      noiMargin: number;
      capRate: number;
    } | null;
    returns: {
      leveredIrr: number;
      unleveredIrr: number;
      equityMultiple: number;
      cashOnCash: number;
      exitValue: number;
      netExitProceeds: number;
    } | null;
    capitalStack: {
      totalCapitalization: number;
      totalDebt: number;
      totalEquity: number;
      ltv: number;
      blendedRate: number;
      dscr: number;
      debtYield: number;
      tranches: { name: string; amount: number; rate: number; term: number }[];
    } | null;
    exitStrategy: {
      scenarioType: string;
      holdPeriodYears: number;
      exitCapRate: number;
      projectedSalePrice: number;
      totalGain: number;
      taxLiability: number;
    } | null;
  }[];
}
```

**Implementation logic:**
1. Fetch all deals via `SELECT * FROM crm_deals WHERE id = ANY($1) AND org_id = $2`
2. For each deal with `modeling_project_id`:
   a. Call `proFormaEngineService.generateProForma()` to get pro forma + returns
   b. Query `capital_stacks` + `debt_tranches` for capital structure
   c. Query `exit_scenario_kpis` for exit data (latest non-draft scenario)
3. For deals without a modeling project, return `proForma: null, returns: null, ...`
4. Return merged array

**Important:** Use raw `pool.query()` for any RLS tables. Map snake_case to camelCase in response.

---

## Frontend

### File 1: `client/src/pages/modeling/projects/workspace/deal-comparison.tsx` (~650-800 lines)

**Component:** `WorkspaceDealComparison`

#### Props
```typescript
interface Props {
  projectId: string;        // current workspace project
  onTabChange?: (tab: string) => void;
}
```

#### Deal Selector

Top bar with:
- Current project auto-included (pinned, non-removable, highlighted border)
- "Add Deal" button opens a `Command` search popover (reuse pattern from `deal-comparison-page.tsx`)
  - Searches org deals via `GET /api/deals` with `?q=` param
  - Only shows deals with `modelingProjectId` (gray out / badge "No Model" for others)
  - Max 5 additional deals (6 total including current project)
- Selected deals shown as dismissible chips/badges with asset class icon + deal name
- "Compare" button triggers the fetch (disabled until 2+ deals selected)

#### Tabbed Comparison View (4 tabs)

Follow the `scenario-comparison-charts.tsx` pattern: tab strip with icon + label.

**Tab 1 — Overview**

- **Radar chart** (recharts `RadarChart`) with 6 normalized axes:
  - NOI, Levered IRR, Equity Multiple, Cash-on-Cash, DSCR, NOI Margin
  - Each deal = one polygon, color-coded (use existing scenario palette: blue, green, red, purple, amber, cyan)
- **Key Metrics Grid** below radar: 2-6 columns (one per deal), rows for:
  - Purchase Price, Year 1 NOI, Cap Rate (Going-In), Levered IRR, Unlevered IRR,
    Equity Multiple, Cash-on-Cash, LTV, DSCR, Exit Cap Rate, Hold Period
  - Best value highlighted green, worst highlighted red (reuse `computeBestWorst()` from `deal-comparison-page.tsx`)
- **Deal summary cards** at bottom: asset class badge, stage badge, deal value, close date

**Tab 2 — Pro Forma**

- **NOI Trend Line Chart** (recharts `LineChart`): one line per deal, years on X axis
- **Revenue Waterfall Bar Chart**: stacked bars per deal showing revenue by category
- **Expense Breakdown Table**: rows = expense categories, columns = deals, variance column vs deal 1 (base)
- **NOI Margin Comparison**: horizontal bar chart, one bar per deal

**Tab 3 — Capital & Returns**

- **Capital Stack Visual**: stacked bar chart per deal showing Equity vs Senior Debt vs Mezz vs Other
- **Returns Table**: rows = IRR (levered), IRR (unlevered), Equity Multiple, Cash-on-Cash, Exit Proceeds
  - Columns = deals, with delta vs first deal
- **Debt Summary Table**: rows = LTV, Blended Rate, DSCR, Debt Yield, Total Debt
  - Columns = deals
- **Sensitivity Mini-Grid** (optional, v2): show how each deal's IRR changes with ±50bps cap rate move

**Tab 4 — Deal Details**

- **CRM Metrics Table**: dynamic rows from asset class field definitions
  - Merge field sets across all selected asset classes (union approach from `deal-comparison-page.tsx`)
  - Group by field group (Financials, Capacity, Revenue, Location, etc.)
  - Collapsible groups
- **Stage & Timeline**: stage badge, days in current stage, expected close date, SLA status
- **Risk Flags**: any validation warnings or red flags per deal

#### Empty / Loading States

- **No deals selected (just current project):** Illustrated empty state — "Select deals to compare against this project" with "Add Deal" CTA
- **Loading:** Skeleton grid matching the metrics table layout (reuse pattern from budget editor)
- **Deal has no model:** Gray column with "No Financial Model" message and "Create Model" link button

#### Export

- **Copy to Clipboard**: serializes the Key Metrics Grid as a tab-delimited table (for pasting into Excel/Sheets)
- **Print/PDF**: `@media print` stylesheet showing all tabs sequentially, no interactive controls

---

### File 2: Workspace Integration

**File:** `client/src/pages/modeling/projects/workspace.tsx` (MODIFY)

Changes:
1. Add import: `import WorkspaceDealComparison from './workspace/deal-comparison';`
2. Add tab definition in `analysis` group:
   ```
   { value: 'deal-compare', label: 'Deal Compare', icon: Scale }
   ```
3. Add `TabsContent`:
   ```tsx
   <TabsContent value="deal-compare" className="mt-4 space-y-4">
     <WorkspaceDealComparison projectId={projectId!} onTabChange={handleTabChange} />
   </TabsContent>
   ```

---

### File 3: Standalone Route (Optional, lightweight)

**File:** `client/src/pages/deal-comparison-models.tsx` (~80 lines, wrapper)

Route: `/crm/deals/compare-models?ids=1,2,3`

Thin wrapper that:
1. Parses `ids` from query string
2. Renders `WorkspaceDealComparison` without a pinned project (all deals are removable)
3. Add to Router.tsx lazy import

---

## Data Flow

```
User selects deals → POST /api/deals/compare-full { dealIds }
                          │
                          ├─ Fetch crm_deals rows
                          ├─ For each deal.modeling_project_id:
                          │   ├─ proFormaEngineService.generateProForma()
                          │   ├─ SELECT from capital_stacks + debt_tranches
                          │   └─ SELECT from exit_scenario_kpis
                          └─ Return merged DealComparisonFull
                                │
Frontend receives response ─────┘
  ├─ Overview tab: normalize metrics → radar + grid
  ├─ Pro Forma tab: plot NOI arrays → line chart + tables
  ├─ Capital & Returns tab: plot capital stack → stacked bar + returns table
  └─ Deal Details tab: merge asset class fields → dynamic table
```

---

## Styling

- Follow FM Design System v2 CSS layer for all financial data components
- Deal color palette (consistent across all charts):
  - Deal 1: `#3b82f6` (blue)
  - Deal 2: `#10b981` (emerald)
  - Deal 3: `#ef4444` (red)
  - Deal 4: `#8b5cf6` (purple)
  - Deal 5: `#f59e0b` (amber)
  - Deal 6: `#06b6d4` (cyan)
- Best/worst highlighting: green-50/green-600 for best, red-50/red-600 for worst
- Numbers: Roboto Mono, right-aligned, accounting format (parens for negatives)
- Currency: `$X.XM` compact or `$X,XXX,XXX` full depending on column width

---

## Metric Definitions & Comparison Logic

### Higher-is-better (green = highest)
- NOI, Levered IRR, Unlevered IRR, Equity Multiple, Cash-on-Cash, DSCR, Debt Yield, NOI Margin, Exit Proceeds

### Lower-is-better (green = lowest)
- Purchase Price, LTV, Blended Debt Rate, Exit Cap Rate, Tax Liability

### Neutral (no highlighting)
- Hold Period, Asset Class, Stage, Close Date, Scenario Type

### Normalization for Radar Chart
Each axis normalized 0-100 where 100 = best across selected deals:
```
normalized = (value - min) / (max - min) * 100
```
Handle edge case where all values are equal (show 50 for all).

---

## Edge Cases

| Case | Handling |
|---|---|
| Deal has no modeling project | Show CRM metrics only; gray out financial columns with "No Model" badge |
| Only 1 deal selected | Show single-deal summary (no comparison highlighting) |
| Deals have different hold periods | Show all years, shorter deals show "—" for years beyond their hold |
| Mixed asset classes | Union of all field groups; fields not applicable show "N/A" |
| Pro forma generation fails | Show error badge on that deal column, other deals still render |
| Very large purchase prices | Use compact currency format ($45.2M) in charts, full in tables |

---

## Files Summary

| File | Action | Lines |
|---|---|---|
| `client/src/pages/modeling/projects/workspace/deal-comparison.tsx` | NEW | ~700 |
| `client/src/pages/modeling/projects/workspace.tsx` | MODIFY | ~10 |
| `server/routes/crm-enhancements-routes.ts` | MODIFY | ~120 |
| `client/src/pages/deal-comparison-models.tsx` | NEW (optional) | ~80 |

---

## What NOT to Build (Out of Scope)

- Saved comparison sets (existing `POST /api/crm/deal-comparisons` handles this already)
- PDF export with branded headers (v2)
- Sensitivity grid per deal (v2)
- AI narrative comparison ("Deal A is superior because...") (v2)
- Real-time collaboration / shared comparisons (v2)

---

## Testing

1. Select 2 deals with modeling projects → all 4 tabs render with data
2. Select a deal without a modeling project → graceful degradation, CRM metrics only
3. Select 6 deals → verify layout doesn't overflow, horizontal scroll if needed
4. Mixed asset classes (marina + multifamily) → union of fields renders correctly
5. Copy to clipboard → paste into Excel, verify columns align
6. Print → all tabs render sequentially, no broken layouts
7. Radar chart with identical metrics → shows 50 for all (no division by zero)
