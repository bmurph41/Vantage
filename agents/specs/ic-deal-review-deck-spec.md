# Feature Spec: IC Deal Review Deck

## Overview

The IC (Investment Committee) Deal Review Deck is a data-driven, multi-section presentation document generated from live workspace data. It is the primary internal approval document used by investment committees to evaluate CRE acquisitions.

This spec covers: section layout and rendering, token-to-section mapping, the PDF/PPTX output route, the frontend "Generate IC Deck" flow, and integration with the existing Document Builder infrastructure (document-builder-service, token-resolver-service, pdf-export-service, format-helpers).

**Key architectural decision:** The IC Deck template definition already exists at `shared/document-builder/templates/ic-deal-review-deck.ts` (14 sections, 128 tokens). This spec does NOT redefine that template — it specifies how to **render** it into a PDF/PPTX by wiring the template through the token substitution engine, the section renderer, and the export pipeline.

## User Story

**As an** investment professional preparing for an IC meeting,
**I want to** click "Generate IC Deck" on a deal's workspace and receive a polished, data-populated PDF/PPTX presentation,
**So that** I can present live financial data, property details, comps, and sensitivity analysis without manual assembly.

**As a** deal team lead reviewing multiple acquisitions,
**I want** each IC Deck to auto-populate from the deal's Pro Forma, DCF, Capital Stack, and CRM data,
**So that** decks are always current and consistent across the portfolio.

## Database Changes Required

**No new tables.** All required tables exist:

| Table | Purpose | Exists? |
|-------|---------|---------|
| `document_templates` | Stores template definitions (IC Deck is `document_type = 'ic_memo'`) | ✅ Created 2026-04-01 |
| `document_renders` | Logs each render output with token snapshot | ✅ Created 2026-04-01 |
| `om_builder_documents` | Document instances tied to deals | ✅ Existing |
| `om_document_sections` | Section content with `rendered_content` column | ✅ Existing (column added 2026-04-01) |
| `om_export_jobs` | Async export job tracking (PDF/PPTX/DOCX) | ✅ Existing |

**One seed operation required:** Insert the default IC Deck template into `document_templates` on first boot or via migration script:

```sql
INSERT INTO document_templates (
  org_id, name, document_type, sections, styles, token_defaults, is_global
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  'IC Deal Review Deck — Standard',
  'ic_memo',
  -- sections JSON from IC_DEAL_REVIEW_DECK_TEMPLATE.sections
  $sections_json$,
  -- styles JSON from IC_DEAL_REVIEW_DECK_TEMPLATE.style
  $styles_json$,
  '{}',
  true  -- global template available to all orgs
)
ON CONFLICT DO NOTHING;
```

This seeds the TypeScript template definition into the DB so it can be customized per-org.

## Section Layout (14 Sections)

The IC Deck uses a **landscape (16:9) slide deck** format. Each section maps to 1–3 slides depending on content density. The existing template at `shared/document-builder/templates/ic-deal-review-deck.ts` defines the canonical section order.

### Section-by-Section Specification

| # | Section Key | Title | Required | Slides | Content Description |
|---|------------|-------|----------|--------|---------------------|
| 1 | `ic_cover` | Cover | ✅ | 1 | Full-bleed hero image with navy overlay. Property name, city/state, date, sponsor logo bottom-center. `PROPRIETARY AND CONFIDENTIAL` footer. |
| 2 | `ic_executive_summary` | Executive Summary | ✅ | 1–2 | Left: narrative text + property bullets. Right: metric grid (purchase price, IRR gross/net, EM gross/net, cap rate, EBITDAM, storage rate CAGR). |
| 3 | `ic_ground_leases` | Ground Leases | ❌ | 1 | 4-panel key-value tables (ground lease, parking, NW street, T-dock hotel) + projected lease expense table. Only enabled if deal has ground lease data. |
| 4 | `ic_property_overview` | Property Overview | ✅ | 1 | Aerial/site map image with labeled dock layout. KPI chips: total slips, parking spaces, vessel count. |
| 5 | `ic_competitive_set` | Competitive Set Overview | ❌ | 1–2 | Comp map image + detailed comparison table (name, ownership, rating, distance, slip count, occupancy, seasonal rates, variance %). Subject property highlighted. |
| 6 | `ic_rent_roll` | Rent Roll Analysis | ✅ | 1–2 | Summer + Winter rent roll tables (location, contract length, capacity, leased, avg LOA, occupancy, revenue, revenue/space). Historical rate growth table. |
| 7 | `ic_storage_revenue` | Storage Revenue Analysis | ❌ | 1 | Revenue breakdown table + pie chart showing mix (summer/winter/transient/liveaboard/dingy). Narrative line: "Storage accounts for X% of gross revenue." |
| 8 | `ic_bnb_afloat` | B&B Afloat | ❌ | 1 | Narrative + vessel/room table (vessel name, beds/baths, starting rates, FC revenue). Row total. Only enabled if BNB data present. |
| 9 | `ic_financial_overview` | Financial Overview | ✅ | 1 | 4-quadrant layout: Revenue Mix pie (top-left), Revenue Mix stacked bar by year (top-right), Gross Profit pie (bottom-left), EBITDAM growth bar (bottom-right). |
| 10 | `ic_debt_term_sheet` | Sample Debt Financing Term Sheet | ❌ | 1 | Structured term sheet table: recourse, loan amount, LTV, loan type/term, amortization, I/O period, rate structure, interest rate, prepayment, fees, DSCR covenant. Header shows purchase price + exit year. |
| 11 | `ic_underwriting_assumptions` | Underwriting Assumptions | ✅ | 1–2 | Sources & Uses table. Key Operating Assumptions grid (revenue/expense CAGRs, debt terms, exit assumptions). Summary Operating Projections multi-year table. |
| 12 | `ic_proforma_financials` | Pro Forma Financials | ✅ | 1 | Summary projections table: occupancy, revenue, COGS, OpEx, EBITDAM, mgmt fee, EBITDA, CapEx, NOI, DSCR, cap rate, IRR, EM. Actuals + 5-year projections + CAGR column. |
| 13 | `ic_proforma_detail` | Pro Forma Detail | ✅ | 1–2 | Line-item detail: Revenue by category, COGS by category, Gross Profit, OpEx by line item. Each shows actuals + years + CAGR + % of Rev. Adjustments footnotes at bottom. |
| 14 | `ic_return_sensitivity` | Return Summary & Sensitivity | ✅ | 1–2 | Return summary box (leveraged/unleveraged IRR, MoE, gain, cap rate, BPS spread). Revenue + EBITDAM CAGR bar charts. 4 sensitivity tables (rate growth, insurance, payroll, property tax). |

### Section Enable/Disable Logic

Optional sections auto-disable when their primary data is absent:

| Section | Auto-disable condition |
|---------|----------------------|
| `ic_ground_leases` | `GL_LESSOR` is null |
| `ic_competitive_set` | `COMP_SET_TABLE` is null |
| `ic_storage_revenue` | `STORAGE_REVENUE` is null |
| `ic_bnb_afloat` | `BNB_VESSEL_TABLE` is null |
| `ic_debt_term_sheet` | `LOAN_AMOUNT` is null |

Required sections always render, even if some tokens are unresolved (displayed as `{{TOKEN}}`).

## Token Map (Section → Token Binding)

The complete token-to-section mapping is defined in `IC_DEAL_REVIEW_DECK_TEMPLATE.sections[].tokens`. Below is the consolidated unique token list (128 tokens across 14 sections):

### Token Resolution Sources

| Source | Resolver Function | Tables | Access Method | Token Count |
|--------|------------------|--------|---------------|-------------|
| Deal/Property | `resolveDealTokens()` + `resolvePropertyTokens()` | `crm_deals`, `crm_properties` | Drizzle ORM | 16 |
| Modeling | `resolveModelingTokens()` | `modeling_projects` | Drizzle ORM | 5 |
| Capital Stack | `resolveCapitalStackTokens()` | `capital_stacks` | Drizzle ORM | 12 |
| Exit Strategy | `resolveExitTokens()` | `exit_scenarios`, `exit_scenario_kpis` | Drizzle ORM | 8 |
| Pro Forma | `resolveProformaTokens()` | `modeling_scenario_versions` | **Raw pool.query()** (RLS) | 20 |
| Comps | `resolveCompsTokens()` | `sales_comps` | Drizzle ORM | 3 |
| Demographics | `resolveDemographicsTokens()` | `target_demographics` | Drizzle ORM | 5 |
| Manual | User-entered via ManualTokenEditor | — | Overrides parameter | 59 |

### Tokens Not Yet Resolved by token-resolver-service.ts

The following tokens appear in the IC Deck template but are NOT currently resolved by `token-resolver-service.ts`. They must be added:

| Token | Source | Resolution Strategy |
|-------|--------|-------------------|
| `DOCUMENT_DATE` | System | `new Date().toLocaleDateString(...)` — generated at render time |
| `HERO_IMAGE_URL` | Manual / Media | From `om_document_sections.media` array or manual override |
| `AERIAL_IMAGE_URL` | Manual / Media | From section media or manual override |
| `DOCK_MAP_IMAGE_URL` | Manual / Media | From section media or manual override |
| `COMP_SET_MAP_IMAGE_URL` | Manual / Media | From section media or manual override |
| `SUMMER_RENT_ROLL_TABLE` | Pro Forma | Build from rent roll data — structured JSON table |
| `WINTER_RENT_ROLL_TABLE` | Pro Forma | Build from rent roll data — structured JSON table |
| `HISTORICAL_RATE_GROWTH_TABLE` | Pro Forma | Build from historical rate data |
| `SEASONAL_RATE_TABLE` | Pro Forma | Build from seasonal rate config |
| `TRANSIENT_RATE_TABLE` | Pro Forma | Build from transient rate config |
| `BNB_VESSEL_TABLE` | Manual | Structured JSON — vessel name, beds, rates, revenue |
| `SOURCES_USES_TABLE` | Capital Stack + Modeling | Computed: purchase price + closing costs + transition costs + working capital |
| `OPERATING_PROJECTIONS_TABLE` | Pro Forma | Multi-year summary projection table (5 years) |
| `PROFORMA_SUMMARY_TABLE` | Pro Forma | Full P&L summary with occupancy, DSCR, cap rate, returns |
| `PROFORMA_DETAIL_TABLE` | Pro Forma | Line-item revenue/COGS/GP/OpEx detail |
| `LEASE_EXPENSE_TABLE` | Manual / Pro Forma | Projected lease expense by year |
| `SENSITIVITY_RATE_GROWTH` | Exit/Monte Carlo | 3-scenario sensitivity (low/base/high CAGR → IRR) |
| `SENSITIVITY_INSURANCE` | Exit/Monte Carlo | 3-scenario insurance CAGR → IRR |
| `SENSITIVITY_PAYROLL` | Exit/Monte Carlo | 3-scenario payroll CAGR → IRR |
| `SENSITIVITY_PROPERTY_TAX` | Exit/Monte Carlo | 3-scenario property tax CAGR → IRR |
| `REVENUE_BY_YEAR_CHART` | Pro Forma | Stacked bar data: revenue by category by year |
| `EBITDAM_BY_YEAR_CHART` | Pro Forma | Bar data: EBITDAM by year |
| `REVENUE_CAGR_CHART` | Pro Forma | Bar + CAGR annotation data |
| `EBITDAM_CAGR_CHART` | Pro Forma | Bar + CAGR annotation data |
| `LEVERAGED_GAIN` | Exit | Computed: net sale proceeds minus equity invested |
| `UNLEVERAGED_IRR` | Exit | From exit scenario KPIs |
| `UNLEVERAGED_MOE` | Exit | From exit scenario KPIs |
| `UNLEVERAGED_GAIN` | Exit | Computed |

**Implementation note:** Table tokens (e.g., `PROFORMA_SUMMARY_TABLE`) resolve to structured JSON objects, not strings. The PDF renderer must handle table tokens differently from scalar tokens — see "PDF Rendering Pipeline" below.

## API Routes Required

### 1. `POST /api/document-builder/ic-deck/generate`

**Auth:** Authenticated, org-scoped
**Purpose:** One-click IC Deck generation — creates document, resolves tokens, renders all sections, queues PDF export.

**Request:**
```typescript
{
  dealId: string;
  projectId?: string;            // auto-discovered from deal.modeling_project_id if absent
  templateId?: string;           // optional custom template; defaults to global IC Deck template
  format: 'pdf' | 'pptx';       // default 'pdf'
  overrides?: Record<string, string | number>;  // manual token overrides
  sections?: string[];           // optional: only include these section keys (default: all enabled)
  options?: {
    includeTableOfContents?: boolean;    // default false (deck format rarely needs TOC)
    includePageNumbers?: boolean;        // default true
    confidentialFooter?: boolean;        // default true
    watermark?: string;                  // optional watermark text
    companyName?: string;                // for header/footer branding
    companyLogo?: string;                // URL for logo placement
  };
}
```

**Response:**
```typescript
{
  documentId: string;            // om_builder_documents.id
  exportJobId: string;           // om_export_jobs.id
  renderId: string;              // document_renders.id
  status: 'queued';
  tokenSummary: {
    total: number;
    resolved: number;
    unresolved: number;
    unresolvedList: string[];
  };
  estimatedPages: number;
  message: string;
}
```

**Key Logic:**
1. Look up deal by `dealId`, validate org ownership
2. If `projectId` is absent, look up `deal.modeling_project_id`
3. Load template (default global IC Deck or custom `templateId`)
4. Call `resolveTokens()` from `token-resolver-service.ts` for all 128 IC Deck tokens
5. Apply `overrides` on top of resolved values
6. Format all tokens via `buildFormattedTokenMap()` from `format-helpers.ts`
7. Determine which optional sections to enable based on auto-disable logic
8. Apply `sections` filter if provided
9. Create `om_builder_documents` record (type: `ic_memo`, status: `generating`)
10. Create `om_document_sections` rows for each enabled section with `rendered_content`
11. Insert `document_renders` record with `token_snapshot` (full resolved token map) and `token_stats`
12. Queue `om_export_jobs` record (format: pdf/pptx, status: `queued`)
13. Kick off async export via `export-job-processor.ts`
14. Return job metadata immediately (client polls for completion)

### 2. `GET /api/document-builder/ic-deck/preview/:dealId`

**Auth:** Authenticated, org-scoped
**Purpose:** Returns HTML preview of the IC Deck for in-browser rendering before PDF generation.

**Request params:** `dealId` (path), `projectId` (query, optional), `sections` (query, optional comma-separated)

**Response:**
```typescript
{
  html: string;                  // Full rendered HTML document with inline styles
  sections: Array<{
    key: string;
    title: string;
    enabled: boolean;
    html: string;
    unresolvedTokens: string[];
  }>;
  tokenSummary: { total, resolved, unresolved, unresolvedList };
}
```

**Key Logic:**
1. Resolve tokens (same as generate flow)
2. Render each section template to HTML using `renderTemplate()` with `format: 'html'`
3. Apply IC Deck styles (navy/white palette, landscape layout, Inter font)
4. Return full HTML + per-section HTML for selective preview

### 3. `GET /api/document-builder/ic-deck/token-status/:dealId`

**Auth:** Authenticated, org-scoped
**Purpose:** Quick readiness check — shows which tokens are resolved vs. missing before generation.

**Response:**
```typescript
{
  ready: boolean;                // true if all required tokens are resolved
  requiredTokens: Array<{ token: string; resolved: boolean; value?: string }>;
  optionalTokens: Array<{ token: string; resolved: boolean; value?: string }>;
  sectionsEnabled: string[];     // which optional sections will be included
  sectionsDisabled: string[];    // which optional sections will be skipped (and why)
}
```

### 4. `GET /api/document-builder/export/:jobId` (existing)

Already exists in `document-builder-routes.ts`. Used to poll export job status.

### 5. `GET /api/document-builder/export/:jobId/download` (existing)

Already exists. Returns the generated PDF/PPTX binary.

## PDF Rendering Pipeline

The rendering pipeline converts the template definition + resolved tokens into a PDF via `pdf-export-service.ts`.

### Flow

```
Template (ic-deal-review-deck.ts)
  ↓
Token Resolution (token-resolver-service.ts)
  ↓
Format + Substitute (format-helpers.ts → buildFormattedTokenMap + renderTemplate)
  ↓
Section Renderer (NEW: ic-deck-renderer.ts)
  ↓
PDF Export (pdf-export-service.ts via pdf-lib)
```

### New File: `server/services/document-builder/ic-deck-renderer.ts`

**Purpose:** Section-specific rendering logic that maps IC Deck template blocks to PDF primitives.

**Key Functions:**

```typescript
export async function renderICDeck(
  ctx: {
    template: ICDealReviewDeckTemplate;
    tokens: Record<string, ResolvedTokenEntry>;
    options: PdfExportOptions;
  }
): Promise<Uint8Array>  // PDF binary

export function renderSection(
  section: TemplateSection,
  tokens: Record<string, ResolvedTokenEntry>,
  pdfCtx: PdfContext
): void

export function renderBlock(
  block: TemplateBlock,
  tokens: Record<string, ResolvedTokenEntry>,
  pdfCtx: PdfContext
): void
```

**Block type rendering:**

| Block Type | PDF Rendering Strategy |
|-----------|----------------------|
| `heading` | `pdfCtx.drawText()` with section font size, navy color |
| `text` | `pdfCtx.drawText()` with body font, token substitution applied |
| `bullet_list` | Indented text with `•` prefix, one line per bullet |
| `metric_grid` | 2-column grid with label (gray) + value (navy bold) |
| `table` (key_value) | 2-column table: label left, value right |
| `table` (comp_comparison) | Multi-column data table with header row, subject column highlighted |
| `table` (rent_roll) | Multi-column with totals row, alternating row shading |
| `table` (term_sheet) | 2-column structured term sheet with bold/italic annotations |
| `table` (sources_uses) | Left: uses breakdown, Right: sources breakdown |
| `table` (proforma_summary) | Multi-year projection with actuals + forecast + CAGR |
| `table` (proforma_detail) | Line-item detail with subtotals, % of Rev column |
| `table` (sensitivity) | 3-row scenario table with base case highlighted |
| `table` (year_projection) | Horizontal year-by-year projection |
| `chart` (pie) | Render as static image using `canvas` (server-side) or placeholder |
| `chart` (bar/stacked_bar) | Render as static image or formatted data table fallback |
| `image` | Fetch URL, embed via `pdfDoc.embedPng/Jpg()` |

**Chart rendering note:** Server-side chart rendering in PDF requires either:
- Option A: Pre-render charts to PNG on the frontend and pass URLs (recommended for v1)
- Option B: Use a server-side canvas library (e.g., `chart.js` + `chartjs-node-canvas`)
- Option C: Render charts as formatted data tables in PDF (acceptable fallback)

**Recommendation:** v1 uses Option C (data tables) for charts. PPTX export uses Option B since pptxgen supports native chart objects. Chart image rendering is a future enhancement.

### Page Layout Rules

- **Page size:** Landscape letter (792 × 612 pts)
- **Margins:** top 60px, right/left 40px, bottom 40px
- **Header:** Section title top-left, sponsor logo top-right (if provided)
- **Footer:** "PROPRIETARY AND CONFIDENTIAL" center, page number right
- **Page breaks:** Each section starts on a new page. If a section overflows, continue on next page with repeated header.
- **Font stack:** Inter (UI text), Roboto Mono (financial data/numbers)
- **Color palette:** Navy `#1B365D` (headings, table headers), White `#FFFFFF` (header text), Light Blue `#4A90D9` (accent), Yellow `#FFD700` (key metric highlights), Gray `#F5F7FA` (alternating rows), Footer Gray `#666666`

## Frontend Components

### 1. `ICDeckGenerateButton` — Trigger Component

**Location:** `client/src/pages/modeling/projects/workspace/ic-deck-generate.tsx`
**Context:** Rendered in the existing `InvestmentMaterialsTab` (document card #1)

**Props:**
```typescript
{
  dealId: string;
  projectId: string;
}
```

**Behavior:**
1. On click, calls `GET /api/document-builder/ic-deck/token-status/:dealId`
2. If `ready: true`, shows confirmation dialog with section list and token summary
3. If `ready: false`, shows readiness panel with missing required tokens highlighted
4. User can toggle optional sections on/off
5. User can enter manual token overrides via `ManualTokenEditor` (from token engine spec)
6. "Generate PDF" button calls `POST /api/document-builder/ic-deck/generate`
7. Shows progress indicator polling `GET /api/document-builder/export/:jobId`
8. On completion, shows download button + "Open Preview" button

### 2. `ICDeckPreview` — HTML Preview Panel

**Location:** `client/src/components/document-studio/ic-deck-preview.tsx`
**Context:** Modal or full-screen overlay showing rendered HTML preview

**Props:**
```typescript
{
  dealId: string;
  projectId?: string;
  sections?: string[];
}
```

**Behavior:**
- Fetches `GET /api/document-builder/ic-deck/preview/:dealId`
- Renders HTML in an iframe or `dangerouslySetInnerHTML` container
- Section navigation sidebar (click to scroll)
- Unresolved tokens highlighted in amber
- "Edit Overrides" button opens ManualTokenEditor
- "Generate PDF" button triggers export

### 3. `ICDeckSectionToggle` — Section Selector

**Location:** `client/src/components/document-studio/ic-deck-section-toggle.tsx`
**Context:** Used in the generate dialog to enable/disable optional sections

**Props:**
```typescript
{
  sections: Array<{ key: string; title: string; required: boolean; enabled: boolean; disableReason?: string }>;
  onToggle: (key: string, enabled: boolean) => void;
}
```

**UI:**
- Checkbox list of all 14 sections
- Required sections are checked and disabled (cannot uncheck)
- Auto-disabled sections show reason (e.g., "No ground lease data")
- Drag-to-reorder support (future enhancement, not v1)

## Integration Points

### What Feeds Data INTO This Feature

| Source | Data | Mechanism |
|--------|------|-----------|
| Pro Forma Engine | Revenue, NOI, EBITDA, expenses, projections, growth rates | `resolveProformaTokens()` via raw `pool.query()` on `modeling_scenario_versions` |
| DCF Calculator | IRR, equity multiple, exit value, BPS spread | `resolveExitTokens()` via Drizzle on `exit_scenarios` + `exit_scenario_kpis` |
| Capital Stack | Debt terms, LTV, equity, debt service, I/O period | `resolveCapitalStackTokens()` via Drizzle on `capital_stacks` |
| CRM Deals | Property name, address, city, state, deal metadata | `resolveDealTokens()` via Drizzle on `crm_deals` |
| CRM Properties | Physical details, slips, linear feet, parking | `resolvePropertyTokens()` via Drizzle on `crm_properties` |
| Sales Comps | Comparable property data | `resolveCompsTokens()` via Drizzle on `sales_comps` |
| Demographics | Population, HHI, market data | `resolveDemographicsTokens()` via Drizzle on `target_demographics` |
| Token Substitution Engine | `buildFormattedTokenMap()` + `renderTemplate()` | `shared/document-builder/format-helpers.ts` |
| User (Manual) | Narratives, broker info, amenities, lease terms | Via `overrides` parameter or `ManualTokenEditor` |

### What This Feature Feeds Data INTO

| Consumer | What It Receives | Mechanism |
|----------|-----------------|-----------|
| PDF Export Pipeline | Rendered section content + layout instructions | `om_export_jobs` queue → `pdf-export-service.ts` |
| PPTX Export Pipeline | Same data, PPTX rendering | `pptx-export-service.ts` |
| Document Renders Log | Token snapshot, render stats, output URL | `document_renders` table |
| CRM Activity Log | "IC Deck generated for [Deal Name]" event | `INSERT INTO crm_activities` after successful generation |
| Deal Record Page | Link to latest IC Deck document | Via `om_builder_documents` FK to `crm_deals` |

### CRM Activity Logging

On successful IC Deck generation:
```sql
INSERT INTO crm_activities (
  org_id, entity_type, entity_id, type, description, metadata, created_by
) VALUES (
  $orgId, 'deal', $dealId, 'document_generated',
  'IC Deal Review Deck generated',
  '{"documentType": "ic_memo", "documentId": "...", "format": "pdf", "pageCount": 14}'::jsonb,
  $userId
);
```

### Entitlement Gating

- IC Deck generation should be gated by a `document_studio` entitlement (when billing engine is built)
- For now: no gating (all authenticated users can generate)
- Future: Pro tier = IC Deck + OM; Starter tier = Executive Summary only

## Technical Constraints

### RLS Tables — Must Use `pool.query()`

Pro Forma data lives in `modeling_scenario_versions` (RLS-protected). The existing `resolveProformaTokens()` already uses raw `pool.query()`. Do NOT switch this to Drizzle.

### Server Restart

After adding the 3 new IC Deck routes, restart:
```bash
pkill -f 'tsx server' && npm run dev
```

### snake_case Mapping

All raw SQL results from `modeling_scenario_versions` return snake_case. The existing resolver handles this. New token resolvers for table tokens (PROFORMA_SUMMARY_TABLE, etc.) must also map snake_case → camelCase.

### Unresolved Token Policy

Tokens that cannot be resolved MUST remain as `{{TOKEN_NAME}}` in both HTML preview and PDF output. Never render empty strings or zeros for missing data.

### PDF Binary Response

The export download endpoint must return `Content-Type: application/pdf` (or `application/vnd.openxmlformats-officedocument.presentationml.presentation` for PPTX) with `Content-Disposition: attachment; filename="IC_Deck_[PropertyName]_[Date].pdf"`.

### Image Embedding

Image tokens (HERO_IMAGE_URL, AERIAL_IMAGE_URL, etc.) are URLs. The PDF renderer must:
1. Fetch the image via HTTP
2. Embed using `pdfDoc.embedPng()` or `pdfDoc.embedJpg()`
3. If fetch fails, render a placeholder rectangle with the token name

### Table Token Handling

Table tokens (e.g., `PROFORMA_SUMMARY_TABLE`) resolve to structured JSON, not strings. The section renderer must:
1. Check if a token's resolved value is an object/array
2. If so, pass to the appropriate table renderer (not string substitution)
3. The `format-helpers.ts` `renderTemplate()` function should skip table tokens (leave them for the section renderer to handle)

## Acceptance Criteria

- [ ] `GET /api/document-builder/ic-deck/token-status/:dealId` returns readiness status for test project `6b3a9021-f393-489d-9274-321ac76eae08`
- [ ] All 12 required tokens (`PROPERTY_NAME`, `PROPERTY_CITY`, `PROPERTY_STATE`, `PURCHASE_PRICE`, `IRR_GROSS`, `IRR_NET`, `EM_GROSS`, `EM_NET`, `YEAR1_CAP_RATE`, `YEAR1_EBITDAM`, `TOTAL_SLIPS`, `EXEC_SUMMARY_NARRATIVE`) resolve for the test project
- [ ] `POST /api/document-builder/ic-deck/generate` creates `om_builder_documents`, `om_document_sections`, `document_renders`, and `om_export_jobs` records
- [ ] Generated PDF is landscape format, 14–20 pages
- [ ] Cover page shows property name, city/state, date, and hero image (or placeholder)
- [ ] Executive Summary shows metric grid with formatted currency/percent values
- [ ] Pro Forma tables show multi-year projections with proper column alignment
- [ ] Sensitivity tables highlight base case row
- [ ] Optional sections (ground leases, B&B, comps) auto-disable when data is absent
- [ ] Unresolved tokens appear as `{{TOKEN_NAME}}` in PDF (not blank)
- [ ] `GET /api/document-builder/ic-deck/preview/:dealId` returns rendered HTML
- [ ] CRM activity is logged on successful generation
- [ ] `document_renders` record captures full token snapshot for audit trail
- [ ] Export job polling returns `status: 'completed'` with download URL
- [ ] PDF filename follows pattern `IC_Deck_[PropertyName]_[YYYY-MM-DD].pdf`
- [ ] All endpoints are org-scoped via `req.user.orgId`
- [ ] No TypeScript errors (`npx tsc --noEmit`)
- [ ] Dev server starts cleanly after adding new routes

## Implementation Order

### Phase 1 — Token Resolver Extensions (~150 lines)
1. Add missing token resolvers to `token-resolver-service.ts`:
   - `DOCUMENT_DATE` (system-generated)
   - `LEVERAGED_GAIN`, `UNLEVERAGED_IRR`, `UNLEVERAGED_MOE`, `UNLEVERAGED_GAIN` (from exit KPIs)
   - `SOURCES_USES_TABLE` (computed from capital stack + modeling)
2. Add structured table token builders (return JSON, not strings):
   - `buildProformaSummaryTable(projectId, orgId)` — 5-year summary
   - `buildProformaDetailTable(projectId, orgId)` — line-item detail
   - `buildOperatingProjectionsTable(projectId, orgId)` — operating projections
   - `buildSensitivityTables(projectId, orgId)` — 4 scenario tables

### Phase 2 — IC Deck API Routes (~200 lines)
3. Add `GET /api/document-builder/ic-deck/token-status/:dealId`
4. Add `GET /api/document-builder/ic-deck/preview/:dealId`
5. Add `POST /api/document-builder/ic-deck/generate`
6. Wire routes into `document-builder-routes.ts`

### Phase 3 — Section Renderer (~400 lines)
7. Create `server/services/document-builder/ic-deck-renderer.ts`
8. Implement block-type renderers (heading, text, bullet_list, metric_grid, table variants, image)
9. Implement page layout logic (landscape, header/footer, page breaks)
10. Wire renderer into `pdf-export-service.ts` export flow

### Phase 4 — Frontend Components (~300 lines)
11. Build `ICDeckGenerateButton` with readiness check dialog
12. Build `ICDeckPreview` HTML preview panel
13. Build `ICDeckSectionToggle` for optional section control
14. Wire into `InvestmentMaterialsTab` document card #1

### Phase 5 — Template Seeding & Polish
15. Write migration script to seed global IC Deck template into `document_templates`
16. Add CRM activity logging on successful generation
17. End-to-end test with test project

## Estimated Complexity

**High** — ~1,050 lines of new code across 6–8 files. The token resolution infrastructure exists, but the section-to-PDF rendering pipeline (Phase 3) is the most complex piece, requiring layout logic for 7+ table styles, image embedding, and chart fallbacks.

### File Impact Summary

| File | Action | Est. Lines |
|------|--------|-----------|
| `server/services/document-builder/token-resolver-service.ts` | EDIT — add missing token resolvers + table builders | ~150 |
| `server/routes/document-builder-routes.ts` | EDIT — add 3 IC Deck routes | ~200 |
| `server/services/document-builder/ic-deck-renderer.ts` | NEW — section + block renderers | ~400 |
| `client/src/pages/modeling/projects/workspace/ic-deck-generate.tsx` | NEW — generate button + dialog | ~150 |
| `client/src/components/document-studio/ic-deck-preview.tsx` | NEW — HTML preview panel | ~100 |
| `client/src/components/document-studio/ic-deck-section-toggle.tsx` | NEW — section toggle list | ~50 |

### Dependencies

- **Requires:** Token Substitution Engine (format-helpers.ts) must be built first (spec complete, builder task in queue)
- **Requires:** `pdf-lib` (already installed)
- **Optional:** `chartjs-node-canvas` for server-side chart rendering (v2 enhancement)
