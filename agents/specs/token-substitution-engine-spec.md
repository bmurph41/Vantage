# Feature Spec: Shared Token Substitution Engine for Document Studio

## Overview

Unify the three existing token interpolation systems (AI Content Service `{{key}}`, Workflow Engine `{{entity.field}}`, Document Builder `{{TOKEN_NAME}}`) into a single shared engine that:

1. Resolves 120+ live tokens from 8 data sources (deal, property, modeling, capital stack, exit, pro forma, comps, demographics)
2. Applies format-aware rendering (currency, percent, number, date)
3. Supports manual token overrides
4. Leaves unresolved tokens as `{{TOKEN}}` (never blank them)
5. Is consumable by Document Studio (IC Deck, OM), Workflow Email templates, and AI Content generation

The existing `token-resolver-service.ts` already resolves raw values. This spec covers the **missing middle layer**: format-aware substitution into template strings, a unified API endpoint for resolution + formatting, and wiring it into the Document Studio rendering pipeline.

## User Story

**As a** deal team member generating an IC Deck or OM,
**I want** financial tokens like `{{PURCHASE_PRICE}}` to resolve to "$5,250,000" and `{{IRR_GROSS}}` to "18.4%" automatically from live workspace data,
**So that** documents always reflect the latest underwriting without manual copy-paste.

**As a** workflow engine processing a `send_email` action,
**I want** to call the same formatting engine that Document Studio uses,
**So that** email templates show `$5,250,000` not `5250000`.

## Database Changes Required

**No new tables.** The existing infrastructure is sufficient:

- `om_builder_documents` — stores document metadata
- `om_document_sections` — stores section content with `dataBindings` array
- `MASTER_TOKEN_MAP` in `shared/document-builder/templates/token-map.ts` — already defines all 120+ tokens with `format` field

**One column addition** (optional, recommended):

```sql
ALTER TABLE om_document_sections
ADD COLUMN IF NOT EXISTS rendered_content TEXT;
```

This caches the last rendered output of a section's content with all tokens substituted, avoiding re-resolution on every preview. Invalidated when the source data changes (stale after re-save of Pro Forma, DCF, etc.).

## API Routes Required

### 1. `POST /api/document-builder/tokens/resolve-formatted`

**Auth:** Authenticated, org-scoped
**Purpose:** Resolve all tokens for a deal/project and return formatted values ready for display.

**Request:**
```typescript
{
  dealId: string;
  projectId?: string;       // optional, auto-discovered from deal.modelingProjectId
  overrides?: Record<string, string | number>;  // manual token overrides
  tokenFilter?: string[];   // optional: only resolve these tokens (performance)
  documentType?: 'ic_deck' | 'om';  // optional: only resolve tokens used in this doc type
}
```

**Response:**
```typescript
{
  tokens: Record<string, {
    raw: string | number | null;       // raw DB value
    formatted: string;                 // display-ready string (e.g., "$5,250,000")
    source: TokenSource;               // 'deal' | 'proforma' | 'capitalStack' | etc.
    isManual: boolean;                 // true if source === 'manual'
    isResolved: boolean;               // true if raw !== null
    format: 'currency' | 'percent' | 'number' | 'date' | 'text';
    label: string;                     // human-readable label
  }>;
  stats: {
    total: number;
    resolved: number;
    unresolved: number;
    manual: number;
    overridden: number;
  };
  resolvedAt: string;  // ISO timestamp
}
```

**Key Logic:**
1. Call existing `resolveTokens(ctx)` from `token-resolver-service.ts`
2. Apply `overrides` on top of resolved values
3. Run each value through `formatTokenValue(raw, tokenDef.format)` (new shared helper)
4. Filter by `documentType` if provided (using `usedIn` field from `MASTER_TOKEN_MAP`)
5. Return structured response with resolution metadata

### 2. `POST /api/document-builder/tokens/render`

**Auth:** Authenticated, org-scoped
**Purpose:** Take a template string with `{{TOKEN}}` placeholders and return the rendered output.

**Request:**
```typescript
{
  dealId: string;
  projectId?: string;
  template: string;          // e.g., "Property: {{PROPERTY_NAME}} — NOI: {{YEAR1_NOI}}"
  overrides?: Record<string, string | number>;
  format?: 'html' | 'text'; // default 'text'
}
```

**Response:**
```typescript
{
  rendered: string;           // "Property: Marina Bay — NOI: $50,629"
  unresolvedTokens: string[]; // ["MARKET_RENT_GROWTH"] — tokens that couldn't be resolved
  tokenCount: number;
  resolvedCount: number;
}
```

**Key Logic:**
1. Resolve tokens via `resolve-formatted` logic
2. Regex replace `/\{\{([A-Z_]+)\}\}/g` with formatted values
3. Leave unresolved tokens in place as `{{TOKEN}}`
4. If `format === 'html'`, wrap currency/percent values in `<span class="token-value token-currency">` etc. for styling

### 3. `POST /api/document-builder/documents/:docId/render-all`

**Auth:** Authenticated, org-scoped
**Purpose:** Resolve and render all sections of a document in one call. Used for full-document preview and PDF generation.

**Request:**
```typescript
{
  overrides?: Record<string, string | number>;
  format?: 'html' | 'text';
}
```

**Response:**
```typescript
{
  documentId: string;
  title: string;
  sections: Array<{
    sectionId: string;
    sectionKey: string;
    order: number;
    renderedContent: string;
    unresolvedTokens: string[];
  }>;
  tokenSummary: {
    total: number;
    resolved: number;
    unresolved: number;
    unresolvedList: string[];
  };
}
```

**Key Logic:**
1. Fetch document and all enabled sections from `om_builder_documents` + `om_document_sections`
2. Get the dealId from document record
3. Resolve tokens once (single DB round-trip)
4. Render each section's `content.narrative` and `content.bullets` through the substitution engine
5. Optionally cache `rendered_content` on each section row

## Frontend Components

### 1. `TokenCatalog` — Token Browser Panel

**Location:** `client/src/components/document-studio/token-catalog.tsx`
**Purpose:** Searchable, categorized list of all available tokens for insertion into templates.

**Props:**
```typescript
{
  dealId: string;
  projectId?: string;
  documentType?: 'ic_deck' | 'om';
  onInsertToken: (token: string) => void;  // callback when user clicks a token
}
```

**State:** Fetches from `POST /api/document-builder/tokens/resolve-formatted`

**UI:**
- Grouped by source category (Property, Financial, Debt, Returns, Pro Forma, Market, Manual)
- Each token shows: label, current resolved value (or "Not set" in amber), format badge
- Click to insert `{{TOKEN_NAME}}` at cursor position
- Search/filter input at top
- "Unresolved" filter toggle to show only missing tokens

### 2. `TokenPreviewBadge` — Inline Token Display

**Location:** `client/src/components/document-studio/token-preview-badge.tsx`
**Purpose:** Renders a `{{TOKEN}}` in a template editor as a styled chip showing the resolved value.

**Props:**
```typescript
{
  token: string;          // e.g., "PURCHASE_PRICE"
  resolved: string | null;
  format: string;
  isManual: boolean;
}
```

**UI:**
- Resolved: teal chip with value text (e.g., `$5,250,000`)
- Unresolved: amber chip with token name and "?" icon
- Manual: gray chip with pencil icon (user must fill)
- Hover tooltip shows: source, label, raw value

### 3. `ManualTokenEditor` — Override Panel

**Location:** `client/src/components/document-studio/manual-token-editor.tsx`
**Purpose:** Form for entering values for manual tokens (SELLER_NAME, DOCK_TYPE, etc.) and overriding auto-resolved tokens.

**Props:**
```typescript
{
  dealId: string;
  projectId?: string;
  documentType: 'ic_deck' | 'om';
  overrides: Record<string, string>;
  onOverridesChange: (overrides: Record<string, string>) => void;
}
```

**UI:**
- Lists all manual tokens grouped by category
- Text inputs for each, pre-filled with any existing overrides
- "Override auto-resolved" toggle reveals auto-resolved tokens for manual override
- Override indicator badge when a live value is being overridden

## Integration Points

### What Feeds Data INTO This Feature

| Source | Data | Mechanism |
|--------|------|-----------|
| Pro Forma Engine | Year 1 revenue, NOI, EBITDA, expenses, growth rates | Raw `pool.query()` on `modeling_scenario_versions` |
| DCF Calculator | IRR, equity multiple, NPV, cash-on-cash | Via exit scenarios + KPIs tables |
| Capital Stack | Debt terms, LTV, equity split, debt service | Drizzle query on `capitalStacks` |
| CRM Deals | Property name, city, state, stage | Drizzle query on `crmDeals` |
| CRM Properties | Address, ZIP, total slips, linear feet | Drizzle query on `crmProperties` |
| Exit Strategy | Hold period, exit cap rate, sale price | Drizzle query on `exitScenarios` + `exitScenarioKpis` |
| Sales/Rate Comps | Comparable transactions | Drizzle query on `salesComps` |
| Target Demographics | Population, HHI, unemployment | Drizzle query on `targetDemographics` |

### What This Feature Feeds Data INTO

| Consumer | What It Receives | Mechanism |
|----------|-----------------|-----------|
| IC Deal Review Deck | Fully rendered sections with formatted financial data | `render-all` endpoint |
| Offering Memorandum | Same | `render-all` endpoint |
| PDF Export Pipeline | Rendered HTML sections for pdf-lib/Puppeteer | `render-all` with `format: 'html'` |
| Workflow Email Templates | Formatted token values for email body substitution | Shared `formatTokenValue()` helper |
| AI Content Service | Formatted context for AI prompt enrichment | `resolve-formatted` endpoint |
| Document Studio UI | Live preview with resolved tokens | `resolve-formatted` + `render` endpoints |

### CRM Activity Logging

- **No direct activity logging** from token resolution (read-only operation)
- Document generation (IC Deck, OM) should log to `crm_activities` when a document is generated — this is the **Document Generation** feature's responsibility, not the token engine's

### Entitlement Gating

- Token resolution itself: **no gating** (it's an internal service)
- Document Studio UI (IC Deck, OM generation): gated by `document_studio` entitlement (to be implemented in Billing Engine spec)
- Specific document types may be gated per tier (e.g., OM generation = Pro tier only)

## Technical Constraints

### RLS Tables — Must Use `pool.query()`

The following tables are RLS-protected. Token resolver already correctly uses raw SQL for these:
- `modeling_project_config` — config data
- `modeling_scenario_versions` — pro forma scenario data

All other tables (crmDeals, crmProperties, capitalStacks, exitScenarios, etc.) can use Drizzle ORM.

### Server Restart

After adding the 3 new API routes, the dev server **must** be restarted:
```bash
pkill -f 'tsx server' && npm run dev
```

### snake_case Mapping

Raw SQL results from `modeling_scenario_versions` return snake_case columns (`revenue_growth_rate`, `operating_expenses`, etc.). The existing `resolveProformaTokens()` already handles this mapping. New code must follow the same pattern.

### Format Helpers (Shared)

Create a single shared formatter at `shared/document-builder/format-helpers.ts`:

```typescript
export function formatTokenValue(
  raw: string | number | null | undefined,
  format: 'currency' | 'percent' | 'number' | 'date' | 'text' | undefined
): string {
  if (raw === null || raw === undefined) return '';

  switch (format) {
    case 'currency':
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0,
      }).format(Number(raw));

    case 'percent':
      // Values stored as decimals (0.184) OR whole numbers (18.4)
      const num = Number(raw);
      const pct = num > 1 ? num : num * 100; // auto-detect
      return `${pct.toFixed(1)}%`;

    case 'number':
      return new Intl.NumberFormat('en-US').format(Number(raw));

    case 'date':
      return new Date(String(raw)).toLocaleDateString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric'
      });

    case 'text':
    default:
      return String(raw);
  }
}
```

**Percent format caveat:** The existing codebase stores some percentages as decimals (0.184 = 18.4%) and some as whole numbers (18.4 = 18.4%). The formatter must auto-detect by checking `num > 1`. The token-resolver-service already normalizes some of these, but the formatter should be defensive.

### Unresolved Token Policy

Tokens that cannot be resolved MUST remain as `{{TOKEN_NAME}}` in the rendered output. Never output empty strings or zeros for missing data. This matches the existing policy in `document-studio.md` and the AI Content Service's `interpolateTemplate()`.

## Implementation Order

### Phase 1 — Shared Format Helpers (new file)
1. Create `shared/document-builder/format-helpers.ts` with `formatTokenValue()` and `renderTemplate()`
2. `renderTemplate(template, resolvedTokens, tokenDefs)` — regex-replaces `{{TOKEN}}` with formatted values

### Phase 2 — Unified Resolution + Formatting Endpoint
3. Add `POST /api/document-builder/tokens/resolve-formatted` to `server/routes/document-builder-routes.ts`
4. Wire it to call existing `resolveTokens()` + new `formatTokenValue()` for each token
5. Support `overrides`, `tokenFilter`, and `documentType` params

### Phase 3 — Template Render Endpoint
6. Add `POST /api/document-builder/tokens/render` endpoint
7. Calls resolve-formatted internally, applies regex substitution via `renderTemplate()`
8. Returns rendered string + unresolved token list

### Phase 4 — Document Render-All Endpoint
9. Add `POST /api/document-builder/documents/:docId/render-all` endpoint
10. Fetches document + sections, resolves tokens once, renders all sections
11. Returns per-section rendered content

### Phase 5 — Frontend Token Catalog
12. Build `TokenCatalog` component with grouped display, search, click-to-insert
13. Build `TokenPreviewBadge` for inline token display in editors
14. Build `ManualTokenEditor` for manual token entry and override

### Phase 6 — Wire to Workflow Email (reuse)
15. Refactor workflow-engine.ts `interpolateTemplate()` to optionally call `formatTokenValue()` for known Document Studio tokens used in email templates (backward-compatible — only triggers when token has a known format)

## Acceptance Criteria

- [ ] `POST /api/document-builder/tokens/resolve-formatted` returns all 120+ tokens with raw + formatted values for test project `6b3a9021-f393-489d-9274-321ac76eae08`
- [ ] `PURCHASE_PRICE` resolves to a currency string like `$5,250,000` (not `5250000`)
- [ ] `IRR_GROSS` resolves to a percent string like `18.4%` (not `0.184`)
- [ ] `YEAR1_NOI` resolves to a currency string like `$50,629`
- [ ] `TOTAL_SLIPS` resolves to a number string like `342` (with thousands separator if applicable)
- [ ] Manual tokens (e.g., `SELLER_NAME`) return `isResolved: false, isManual: true`
- [ ] `overrides` param correctly overrides both manual and auto-resolved tokens
- [ ] `tokenFilter` param returns only requested tokens
- [ ] `documentType: 'ic_deck'` filters out tokens not in IC Deck `usedIn`
- [ ] `POST /api/document-builder/tokens/render` correctly substitutes tokens in a template string
- [ ] Unresolved tokens remain as `{{TOKEN_NAME}}` in rendered output (never blank)
- [ ] `POST /api/document-builder/documents/:docId/render-all` renders all enabled sections
- [ ] `TokenCatalog` component displays tokens grouped by category with resolved values
- [ ] `ManualTokenEditor` allows entering and saving manual token values
- [ ] All endpoints are org-scoped via `req.user.orgId`
- [ ] No TypeScript errors (`npx tsc --noEmit`)
- [ ] Dev server starts cleanly after adding new routes

## Estimated Complexity

**Medium** — ~500-700 lines of new code across 4-5 files. The heavy lifting (data resolution from 8 sources) is already done in `token-resolver-service.ts`. This spec covers the formatting layer, API endpoints, and frontend components that consume the resolved data.

### File Impact Summary

| File | Action | Lines |
|------|--------|-------|
| `shared/document-builder/format-helpers.ts` | NEW | ~80 |
| `server/routes/document-builder-routes.ts` | EDIT — add 3 routes | ~150 |
| `client/src/components/document-studio/token-catalog.tsx` | NEW | ~180 |
| `client/src/components/document-studio/token-preview-badge.tsx` | NEW | ~50 |
| `client/src/components/document-studio/manual-token-editor.tsx` | NEW | ~120 |
| `server/marinamatch/workflow-engine.ts` | EDIT — optional format integration | ~20 |
