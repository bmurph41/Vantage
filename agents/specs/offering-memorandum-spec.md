# Feature Spec: Offering Memorandum — Rendering Pipeline

## Overview

The Offering Memorandum (OM) is a broker-quality, external-facing investment document for marketing CRE dispositions to institutional buyers, private equity, and family offices. The template already exists at `shared/document-builder/templates/offering-memorandum.ts` (8 sections, 86 tokens, portrait PDF). This spec covers the **rendering pipeline**: an OM-specific HTML renderer, 3 new API routes (generate, preview, token-status), 6 new OM-specific tokens that need resolution, and frontend components for the generate/preview flow.

**Key difference from IC Deck:** The OM is a portrait document with a warm cream/gold/navy brand identity (Playfair Display headings, Source Sans Pro body), large section-number dividers between each major section, and an external audience (buyers, not investment committee). The IC Deck is a landscape deck (slides). The OM renderer must handle portrait page breaks, wave motif decorative elements, and the `large_numeral` section divider pattern.

**Depends on:** Token Substitution Engine (spec: `agents/specs/token-substitution-engine-spec.md`) — must be built first so `buildFormattedTokenMap()` and `resolveTokens()` are fully functional.

## User Story

**As a** broker or seller marketing a CRE property,
**I want to** click "Generate Offering Memorandum" on a deal's workspace and receive a polished, data-populated PDF,
**So that** I can distribute a professional investor package without manual document assembly.

**As a** deal originator reviewing the OM before distribution,
**I want** an in-browser HTML preview with token highlighting (resolved vs. missing),
**So that** I can verify data accuracy and completeness before generating the final PDF.

## Database Changes Required

**No new tables.** All required tables exist:

| Table | Purpose | Exists? |
|-------|---------|---------|
| `document_templates` | Template definitions (OM is `document_type = 'offering_memorandum'`) | ✅ Created 2026-04-01 |
| `document_renders` | Render output log with token snapshot | ✅ Created 2026-04-01 |
| `om_builder_documents` | Document instances tied to deals | ✅ Existing |
| `om_document_sections` | Section content with `rendered_content` column | ✅ Existing |
| `om_export_jobs` | Async export job tracking (PDF/DOCX) | ✅ Existing |

**One seed operation required:** Insert the default OM template into `document_templates` on first boot or via migration script:

```sql
INSERT INTO document_templates (
  org_id, name, document_type, sections, styles, token_defaults, is_global
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  'Offering Memorandum — Marina',
  'offering_memorandum',
  $sections_json$,   -- from OFFERING_MEMORANDUM_TEMPLATE.sections
  $styles_json$,     -- from OFFERING_MEMORANDUM_TEMPLATE.style
  '{}',
  true
)
ON CONFLICT DO NOTHING;
```

## Section Layout (8 Sections)

The OM uses a **portrait (8.5" × 11")** layout with warm cream background. Each major section starts with a full-page large-numeral divider slide (e.g., giant "1" with "EXECUTIVE SUMMARY" underneath on navy/cream background).

### Section-by-Section Specification

| # | Section Key | Title | Required | Est. Pages | Content |
|---|------------|-------|----------|------------|---------|
| 1 | `om_cover` | Cover | ✅ | 1 | Hero image collage (3-photo layout), property name in gold, city/state, "CONFIDENTIAL OFFERING MEMORANDUM" label, broker logo bottom-left |
| 2 | `om_toc` | Table of Contents | ✅ | 1 | Left half: tagline + hero photo. Right half: navy background, numbered 5-section TOC |
| 3 | `om_executive_summary` | Executive Summary | ✅ | 4-6 | Section divider → Introduction narrative → Offering Terms callout (navy bg) → Offering Summary metrics → Investment Highlights 4-grid |
| 4 | `om_property_overview` | Property Overview | ✅ | 8-12 | Section divider → Property Details table → Services & Amenities checklist (17 items) → Utilities → Location Overview narrative + map → Dock map → Ground Leases (4-panel) → Marina asset detail + rate tables → B&B Afloat vessel table |
| 5 | `om_financial_overview` | Financial Overview | ✅ | 6-8 | Section divider → Summary of Current Operations → NOI Forecast table with adjustments + footnotes → Pro Forma Business Plan narrative → Expense Assumptions table → Full 5-year Pro Forma table → Other Opportunities cards |
| 6 | `om_nearby_marinas` | Nearby Marinas Overview | ❌ | 2-3 | Section divider → Competitive set comparison table → Map with photo callouts |
| 7 | `om_market_overview` | Market Overview | ❌ | 3-5 | Section divider → Market narrative → Tourism stat callouts (4-col) → Population growth chart → Neighborhood map → Demographics 3-ring panel (5mi/10mi/25mi) |
| 8 | `om_back_cover` | Contact | ✅ | 1 | Broker team cards (name, title, phone, email) → Broker of record → Firm address → Disclaimer text |

### Section Enable/Disable Logic

| Section | Auto-disable condition |
|---------|----------------------|
| `om_nearby_marinas` | `COMP_SET_TABLE` is null |
| `om_market_overview` | `MARKET_OVERVIEW_NARRATIVE` is null AND `POPULATION_5MI` is null |

Required sections always render — unresolved tokens display as `{{TOKEN_NAME}}`.

## Token Map (Section → Token Binding)

### Complete OM Token List (86 tokens across 8 sections)

**Section 1 — Cover (6 tokens):**
`PROPERTY_NAME`, `PROPERTY_CITY`, `PROPERTY_STATE`, `HERO_IMAGE_URL`, `BROKER_LOGO_URL`, `CONFIDENTIAL_LABEL`

**Section 2 — TOC (2 tokens):**
`PROPERTY_NAME`, `LOCATION_TAGLINE`

**Section 3 — Executive Summary (14 unique tokens):**
`PROPERTY_NAME`, `EXEC_SUMMARY_NARRATIVE`, `ASKING_PRICE`, `OWNERSHIP_TYPE`, `TOUR_CONTACT_NAME`, `TOUR_CONTACT_PHONE`, `TOUR_CONTACT_EMAIL`, `TOTAL_SLIPS`, `BNB_VESSEL_COUNT`, `FC_REVENUE`, `FC_NOI`, `YEAR1_NOI`, `INVESTMENT_HIGHLIGHTS`, `AERIAL_IMAGE_URL`

**Section 4 — Property Overview (33 tokens):**
`PROPERTY_NAME`, `PROPERTY_ADDRESS`, `OWNERSHIP_TYPE`, `TOTAL_SLIPS`, `LINEAR_FEET`, `DOCK_TYPE`, `SIZE_RANGE`, `DOCKSIDE_DEPTH`, `PARKING_SPACES`, `BUILDING_SF`, `HAS_FUEL_DOCK`, `HAS_PUMP_OUT`, `HAS_ELECTRIC`, `HAS_WATER`, `HAS_SHIP_STORE`, `HAS_ICE`, `HAS_TRANSIENT`, `HAS_RESTAURANT`, `HAS_LODGING`, `HAS_POOL`, `HAS_BOAT_RENTAL`, `HAS_LAUNDRY`, `HAS_SECURITY`, `HAS_WIFI`, `HAS_RESTROOMS`, `WATER_SOURCE`, `SEWER_SOURCE`, `LOCATION_OVERVIEW_NARRATIVE`, `AERIAL_IMAGE_URL`, `DOCK_MAP_IMAGE_URL`, ground lease tokens (10), rate table tokens (4), B&B tokens (2)

**Section 5 — Financial Overview (11 tokens):**
`FC_REVENUE`, `FC_NOI`, `YEAR1_NOI`, `OM_NOI_TABLE`, `ADJUSTMENTS_FOOTNOTES`, `PRO_FORMA_PLAN_NARRATIVE`, `OM_PROFORMA_TABLE`, `OM_EXPENSE_ASSUMPTIONS_TABLE`, `OTHER_OPPORTUNITIES`, `SUMMER_OCCUPANCY`, `STORAGE_REVENUE`

**Section 6 — Nearby Marinas (2 tokens):**
`COMP_SET_TABLE`, `COMP_SET_MAP_IMAGE_URL`

**Section 7 — Market Overview (10 tokens):**
`MARKET_OVERVIEW_NARRATIVE`, `TOURISM_FACTS`, `POPULATION_5MI`, `POPULATION_10MI`, `POPULATION_25MI`, `AVG_HH_INCOME_5MI`, `MEDIAN_HH_INCOME_5MI`, `BOATING_PARTICIPATION_PCT`, `POPULATION_GROWTH_CHART`, `NEIGHBORHOOD_MAP_URL`

**Section 8 — Back Cover (4 tokens):**
`BROKER_TEAM`, `BROKER_OF_RECORD`, `FIRM_ADDRESS`, `BROKER_FIRM`

### Tokens NOT Yet Resolved — New Resolution Required

The following 6 OM-specific tokens do NOT exist in `token-resolver-service.ts` and must be added to a new `resolveOmTokens()` function:

| Token | Type | Source | Resolution Strategy |
|-------|------|--------|-------------------|
| `OM_NOI_TABLE` | Structured JSON table | Pro Forma (RLS) | Build from `modeling_scenario_versions` current year actuals + adjustments. Columns: Line Item, Owner F/C, Adjustment Amount, Adj F/C. Rows grouped into Revenue / COGS / Gross Profit / Operating Expenses / NOI. Raw `pool.query()` required. |
| `OM_PROFORMA_TABLE` | Structured JSON table | Pro Forma (RLS) | Build from multi-year projection data. Columns: Line Item, F/C, Year 1–5. Rows: line-item revenue, COGS, OpEx, NOI. Raw `pool.query()` required. |
| `OM_EXPENSE_ASSUMPTIONS_TABLE` | Structured JSON table | Pro Forma + Config | Build from expense config. Columns: Line Item, F/C Amount, Year 1 Amount, Comment/Methodology. |
| `LOCATION_TAGLINE` | String (manual) | Manual | User-entered tagline for the TOC page, e.g., "The Premier Destination on Boston Harbor" |
| `BOATING_PARTICIPATION_PCT` | Percent | Demographics | From `target_demographics` if available, otherwise manual |
| `TOURISM_FACTS` | Structured JSON array | Manual | Array of `{ stat: string, label: string }` for callout cards, e.g., `{ stat: "22M", label: "Annual Boston Visitors" }` |

All other OM tokens are already resolved by existing resolver functions (deal, property, modeling, capital stack, exit, pro forma, comps, demographics).

### Table Token Rendering

Table tokens (`OM_NOI_TABLE`, `OM_PROFORMA_TABLE`, `OM_EXPENSE_ASSUMPTIONS_TABLE`, `COMP_SET_TABLE`, `SEASONAL_RATE_TABLE`, `TRANSIENT_RATE_TABLE`, `BNB_VESSEL_TABLE`) resolve to structured JSON objects. The OM renderer must detect object-type token values and render them as styled HTML tables rather than interpolating as strings.

**Table JSON format:**
```typescript
interface TableTokenValue {
  headers: string[];
  sections?: Array<{
    title: string;
    rows: Array<Record<string, string | number>>;
    subtotal?: Record<string, string | number>;
  }>;
  rows?: Array<Record<string, string | number>>;   // flat table (no sections)
  totals?: Record<string, string | number>;
  footnotes?: string[];
}
```

## API Routes Required

### 1. `GET /api/document-builder/om/token-status/:dealId`

**Auth:** Authenticated, org-scoped
**Purpose:** Check which OM tokens can be auto-resolved for this deal, before generating.

**Response:**
```typescript
{
  total: number;                // 86
  resolved: number;
  unresolved: number;
  resolvedList: Array<{ token: string; formatted: string; source: string }>;
  unresolvedList: Array<{ token: string; source: string; isManual: boolean }>;
  sectionReadiness: Array<{
    key: string;
    title: string;
    required: boolean;
    totalTokens: number;
    resolvedTokens: number;
    ready: boolean;             // true if all required tokens resolved
    autoDisabled: boolean;      // true if section auto-disabled
  }>;
  overallReady: boolean;        // true if all required section tokens are resolved
}
```

**Key Logic:**
1. Resolve all tokens via `resolveTokens({ dealId, projectId, orgId })`
2. Format via `buildFormattedTokenMap(resolved, undefined, undefined, 'om')`
3. Walk `OFFERING_MEMORANDUM_TEMPLATE.sections`, check each section's token list against resolved map
4. Apply auto-disable logic for optional sections
5. Return readiness summary

### 2. `GET /api/document-builder/om/preview/:dealId`

**Auth:** Authenticated, org-scoped
**Purpose:** Returns HTML preview of the full OM for in-browser rendering with token highlighting.

**Query Params:**
- `sections` (optional): Comma-separated section keys to include (default: all enabled)

**Response:** `text/html` — full rendered HTML document with:
- Inline CSS matching OM style (cream bg, gold/navy palette, Playfair Display + Source Sans Pro fonts)
- Portrait page dimensions with CSS `@page` rules for print/PDF
- Section divider pages with large numerals
- Resolved tokens wrapped in `<span class="token-value">` (green border for visual confirmation)
- Unresolved tokens wrapped in `<span class="token-unresolved">` (amber background for visibility)
- Table tokens rendered as full HTML tables with OM styling
- Image tokens rendered as `<img>` tags or placeholder boxes if URL is null
- Wave motif SVG decorative elements at page borders

**Key Logic:**
1. Resolve tokens via `resolveTokens()`
2. Format via `buildFormattedTokenMap()`
3. Walk each enabled section → call `renderOMSectionToHtml(section, resolved, formatted)`
4. Wrap in full HTML document with OM stylesheet

### 3. `POST /api/document-builder/om/generate`

**Auth:** Authenticated, org-scoped
**Purpose:** Full OM generation — creates document, resolves tokens, renders all sections, queues PDF/DOCX export.

**Request:**
```typescript
{
  dealId: string;
  projectId?: string;            // auto-discovered from deal.modeling_project_id if absent
  templateId?: string;           // optional custom template; defaults to global OM template
  format: 'pdf' | 'docx';       // default 'pdf'
  overrides?: Record<string, string | number | object>;  // manual token overrides (including table tokens)
  sections?: string[];           // optional: only include these section keys (default: all enabled)
  options?: {
    includeTableOfContents?: boolean;    // default true
    includePageNumbers?: boolean;        // default true
    confidentialFooter?: boolean;        // default true
    watermark?: string;                  // optional watermark text (e.g., "DRAFT")
    companyName?: string;                // for header branding
    companyLogo?: string;                // URL for logo placement
    waveMotif?: boolean;                 // default true — decorative wave elements
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
  estimatedPages: number;        // from template (28-40)
  message: string;
}
```

**Key Logic:**
1. Look up deal by `dealId`, validate org ownership
2. If `projectId` absent, look up `deal.modeling_project_id`
3. Load template (default global OM or custom `templateId`)
4. Call `resolveTokens()` for all OM tokens
5. Apply `overrides` on top of resolved values
6. Format all tokens via `buildFormattedTokenMap(resolved, overrides, undefined, 'om')`
7. Determine which optional sections to enable via auto-disable logic
8. Apply `sections` filter if provided
9. Create `om_builder_documents` record (type: `offering_memorandum`, status: `generating`)
10. Create `om_document_sections` rows for each enabled section with `rendered_content`
11. Insert `document_renders` row with token snapshot + stats
12. Queue `om_export_jobs` row (status: `queued`, format: `pdf` or `docx`)
13. Log to `crm_activities` (type: `document_generated`, entityType: `deal`)
14. Return summary

## Frontend Components

### 1. OM Generate Button (in workspace Investment Materials tab)

**File:** `client/src/pages/modeling/projects/workspace/om-generate.tsx`
**Location:** Investment Materials tab, "Offering Memorandum" card

**Behavior:**
1. On mount: call `GET /api/document-builder/om/token-status/:dealId`
2. Display readiness indicator:
   - Green check + "Ready to Generate" if `overallReady === true`
   - Amber warning + "X of Y tokens resolved" with expandable missing-token list if not ready
3. "Generate OM" button (primary, navy) — opens generate modal
4. "Preview" button (secondary) — opens HTML preview in new tab or side panel

**Generate Modal:**
- Format selector: PDF (default) | DOCX
- Section toggle checklist (all enabled by default, optional sections can be unchecked)
- "Watermark" text input (optional, e.g., "DRAFT")
- "Generate" button → calls `POST /api/document-builder/om/generate`
- Loading state with progress indicator
- On success: show download link + toast notification

### 2. OM HTML Preview

**File:** `client/src/pages/modeling/projects/workspace/om-preview.tsx`
**Location:** Opened from workspace, either as a new tab or a slide-over panel

**Behavior:**
- Fetches `GET /api/document-builder/om/preview/:dealId`
- Renders HTML in an iframe or `dangerouslySetInnerHTML` container
- Token highlight legend: green = resolved, amber = unresolved
- Section navigation sidebar (jump to section)
- "Generate PDF" button in toolbar

### 3. Manual Token Editor (shared with IC Deck)

Already specified in `token-substitution-engine-spec.md`. The OM uses the same `ManualTokenEditor` component for entering manual tokens like `LOCATION_TAGLINE`, `TOURISM_FACTS`, `BNB_NARRATIVE`, amenities booleans, etc.

## New Backend File: OM Section Renderer

**File:** `server/services/document-builder/om-renderer.ts`

**Purpose:** Converts OM template sections + resolved tokens into styled HTML. Follows the same pattern as `ic-deck-renderer.ts` but with OM-specific styling.

**Key exports:**
```typescript
export function renderOMSectionToHtml(
  section: OMSection,
  resolved: ResolvedTokenMap,
  formatted: Record<string, ResolvedTokenEntry>
): string;

export function renderFullOMDocument(
  sections: OMSection[],
  resolved: ResolvedTokenMap,
  formatted: Record<string, ResolvedTokenEntry>,
  options: OMRenderOptions
): string;
```

**Block type handlers (matching template block types):**

| Block Type | Handler | OM-specific notes |
|-----------|---------|-------------------|
| `divider` | `renderSectionDivider()` | Full-page navy/cream divider with giant numeral (120px Playfair Display) + section title. Wave motif SVG at bottom. |
| `heading` | `renderHeading()` | Gold (#B8976A) headings in Playfair Display. Levels 1-3. |
| `text` | `renderText()` | Source Sans Pro body. Token interpolation. `disclaimer` style = 8px italic. `footnotes` style = 9px. |
| `image` | `renderImage()` | `collage_3` layout for cover hero. Placeholder box with label if URL null. |
| `metric_grid` | `renderMetricGrid()` | Multiple styles: `om_offering_terms` (navy callout), `om_offering_summary` (cream), `om_highlights_4grid` (2-col navy cards), `om_stat_callouts` (4-col stat boxes), `om_demographics_3ring` (3-radius ring panel), `om_broker_cards` (contact cards), `om_opportunity_cards` (3-col feature cards). |
| `table` | `renderTable()` | Multiple styles: `om_property_details` (key-value), `om_amenities_checklist` (checkmark grid), `om_lease_panel` (ground lease card), `om_noi_forecast` (sectioned financial), `om_expense_assumptions` (4-col), `om_proforma` (7-col multi-year), `om_comp_table` (comparison), `rate_table` (dockage rates), `bnb_vessel` (vessel inventory). Navy headers, gold subheaders, cream alternating rows. |
| `chart` | `renderChart()` | `line` chart for population growth, `pie` for revenue mix. Render as data tables in v1 PDF; defer native SVG charts to v2. |
| `bullet_list` | `renderBulletList()` | Gold bullet markers. Used for investment highlights if array format. |

**OM-specific CSS:**
```css
/* Page setup — portrait */
@page { size: 8.5in 11in; margin: 50px 60px 60px 60px; }

/* Base palette */
body { background: #F5F0E8; color: #2D2D2D; font-family: 'Source Sans Pro', sans-serif; }
h1, h2, h3 { font-family: 'Playfair Display', Georgia, serif; color: #B8976A; }

/* Section divider */
.section-divider { page-break-before: always; height: 100vh; display: flex; ... }
.section-number { font-size: 120px; font-family: 'Playfair Display'; color: #B8976A; }

/* Table styling */
th { background: #1B365D; color: #FFF; }
.subheader { background: #B8976A; color: #FFF; }
tr:nth-child(even) { background: #FAFAF5; }

/* Callout boxes */
.callout-box { background: rgba(27,54,93,0.85); color: #FFF; padding: 24px; }

/* Page numbers */
@bottom-center { content: counter(page) " — " attr(data-section); }

/* Wave motif */
.wave-motif { /* SVG wave decoration at page borders */ }

/* Token states */
.token-value { border-bottom: 1px solid #2DD4BF; }
.token-unresolved { background: #FEF3CD; padding: 0 4px; border-radius: 2px; }
```

**Estimated size:** ~600-800 lines (comparable to `ic-deck-renderer.ts` at 500+ lines, but more block styles to handle).

## Integration Points

### What Feeds Data INTO the OM
- **CRM Deals** → deal name, asking price, ownership type, contact info
- **CRM Properties** → address, slips, amenities, utilities, building SF
- **Modeling Projects** → purchase price, cap rate (via `deal.modeling_project_id`)
- **Pro Forma (RLS)** → revenue, NOI, EBITDA, multi-year projections, expense assumptions → `pool.query()` required
- **Capital Stack** → loan terms (not displayed in OM but feeds Sources & Uses if included)
- **Exit Strategy** → not directly shown in standard OM (internal metrics)
- **Sales Comps** → competitive set table + map
- **Demographics** → population, income, boating participation
- **Manual Overrides** → narratives, tagline, amenity booleans, images, tourism facts, B&B data, broker info

### What the OM Feeds Data INTO
- **Document Renders table** → render log with token snapshot for audit trail
- **Export Jobs** → queued PDF/DOCX generation
- **CRM Activities** → `document_generated` activity logged to deal timeline
- **Version History** → `om_document_versions` for tracking changes

### CRM Activity Logging
Yes — log `document_generated` activity with:
```typescript
{
  type: 'document_generated',
  entityType: 'deal',
  entityId: dealId,
  description: `Offering Memorandum generated for ${propertyName}`,
  metadata: { documentType: 'offering_memorandum', format, documentId, renderId }
}
```

### Entitlement Gating
Not required for v1 — OM generation is available to all tiers. Future: may gate behind "Institutional" or "Enterprise" tier when billing engine is built.

## Technical Constraints

1. **RLS tables:** `modeling_scenario_versions`, `modeling_project_config` — always use raw `pool.query()` when building `OM_NOI_TABLE`, `OM_PROFORMA_TABLE`, `OM_EXPENSE_ASSUMPTIONS_TABLE`
2. **Server restart:** After adding the 3 new routes and `om-renderer.ts`, run `pkill -f 'tsx server' && npm run dev`
3. **snake_case mapping:** All raw SQL results must be explicitly mapped to camelCase
4. **Image handling:** Image tokens resolve to URLs. If null, render a styled placeholder box ("Upload Property Image") — do NOT leave empty space
5. **Unresolved token policy:** Leave `{{TOKEN_NAME}}` visible in rendered output (don't blank or zero-fill)
6. **Portrait page breaks:** Use CSS `page-break-before: always` on section dividers and `page-break-inside: avoid` on tables
7. **Font loading:** Playfair Display and Source Sans Pro must be available. Include Google Fonts `<link>` in preview HTML; for PDF export, the `pdf-export-service.ts` must have these fonts registered
8. **Large tables:** `OM_PROFORMA_TABLE` can be 20+ rows × 7 columns — test for page overflow and apply `page-break-inside: avoid` on row groups

## Acceptance Criteria

- [ ] `GET /api/document-builder/om/token-status/:dealId` returns correct resolved/unresolved counts for test deal
- [ ] `GET /api/document-builder/om/preview/:dealId` returns valid HTML with OM styling (cream bg, gold headings, navy tables)
- [ ] Preview renders all 8 sections in order with correct section divider numerals (1–5)
- [ ] Resolved tokens appear with green underline; unresolved tokens appear with amber background
- [ ] Table tokens (`OM_NOI_TABLE`, `OM_PROFORMA_TABLE`, `OM_EXPENSE_ASSUMPTIONS_TABLE`) render as styled HTML tables, not `[object Object]`
- [ ] Amenities checklist renders as checkmark grid with ✓ / — for each boolean token
- [ ] Ground lease 4-panel renders correctly with conditional display (hide panels with all-null tokens)
- [ ] `POST /api/document-builder/om/generate` creates records in `om_builder_documents`, `om_document_sections`, `document_renders`, `om_export_jobs`
- [ ] Generate route logs `document_generated` activity to `crm_activities`
- [ ] Optional sections (`om_nearby_marinas`, `om_market_overview`) auto-disable when primary data absent
- [ ] Manual token overrides apply correctly (overrides take precedence over auto-resolved values)
- [ ] Frontend "Generate OM" button shows readiness indicator based on token-status endpoint
- [ ] Frontend preview opens and displays OM HTML correctly
- [ ] OM uses portrait layout (not landscape like IC Deck)
- [ ] Section dividers use large numeral style (120px Playfair Display) with gold text
- [ ] All routes are org-scoped (no hardcoded org fallbacks)
- [ ] Token snapshot saved to `document_renders` for audit/reproducibility

## Implementation Order

1. **Token resolver extensions** (~100 lines)
   - Add `resolveOmTokens()` to `token-resolver-service.ts` for 3 table tokens (`OM_NOI_TABLE`, `OM_PROFORMA_TABLE`, `OM_EXPENSE_ASSUMPTIONS_TABLE`) + `LOCATION_TAGLINE`, `BOATING_PARTICIPATION_PCT`, `TOURISM_FACTS`
   - These are OM-specific table formats distinct from the IC Deck's `PROFORMA_SUMMARY_TABLE`

2. **OM Renderer** (~700 lines)
   - Create `server/services/document-builder/om-renderer.ts`
   - Implement all block type handlers with OM styling
   - Test with preview route

3. **API Routes** (~250 lines)
   - Add 3 routes to `server/routes/document-builder-routes.ts`:
     - `GET /om/token-status/:dealId`
     - `GET /om/preview/:dealId`
     - `POST /om/generate`
   - Pattern matches existing IC Deck routes

4. **Frontend — Generate Button + Modal** (~200 lines)
   - `client/src/pages/modeling/projects/workspace/om-generate.tsx`
   - Token readiness indicator, format selector, section toggles

5. **Frontend — Preview** (~150 lines)
   - `client/src/pages/modeling/projects/workspace/om-preview.tsx`
   - HTML preview in iframe with section nav

6. **Seed template** (~20 lines)
   - Migration script to insert global OM template into `document_templates`

## Estimated Complexity

**High** — ~1,400 lines across 5-6 files. The OM renderer is the largest piece due to the variety of block types and table styles (10+ table styles, 6+ metric grid styles, section dividers, image layouts). Shares infrastructure with IC Deck (token resolver, format helpers, export pipeline) but requires its own renderer due to fundamentally different layout (portrait vs. landscape) and styling (warm broker aesthetic vs. corporate deck).

**File breakdown:**
| File | Lines | Type |
|------|-------|------|
| `server/services/document-builder/om-renderer.ts` | ~700 | NEW |
| `server/services/document-builder/token-resolver-service.ts` | ~100 | MODIFY (add `resolveOmTokens`) |
| `server/routes/document-builder-routes.ts` | ~250 | MODIFY (add 3 routes) |
| `client/src/pages/modeling/projects/workspace/om-generate.tsx` | ~200 | NEW |
| `client/src/pages/modeling/projects/workspace/om-preview.tsx` | ~150 | NEW |
| Migration script (seed template) | ~20 | SCRIPT |
| **Total** | **~1,420** | |
