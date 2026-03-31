# MarinaMatch — Document Studio

## Overview

Document Studio generates institutional-grade investment documents from live deal data.
Two primary document types:

| Document | Abbreviation | Purpose |
|---|---|---|
| Investment Committee / Deal Review Deck | IC Deck | Internal deal approval |
| Offering Memorandum | OM | External investor / buyer distribution |

---

## Token System

Documents use a `{{TOKEN}}` replacement system for live data binding.

### Token Format
```
{{TOKEN_NAME}}
```

### Standard Token Categories

#### Deal / Property Tokens
```
{{DEAL_NAME}}
{{PROPERTY_ADDRESS}}
{{PROPERTY_TYPE}}
{{ASSET_CLASS}}
{{YEAR_BUILT}}
{{TOTAL_UNITS}}
{{TOTAL_SF}}
{{SITE_ACRES}}
```

#### Financial Tokens (live binding to Pro Forma / DCF)
```
{{PURCHASE_PRICE}}
{{PRICE_PER_UNIT}}
{{PRICE_PER_SF}}
{{CAP_RATE}}
{{NOI_YEAR_1}}
{{NOI_YEAR_5}}
{{GROSS_REVENUE_YEAR_1}}
{{EFFECTIVE_REVENUE_YEAR_1}}
{{OPERATING_EXPENSES_YEAR_1}}
{{VACANCY_RATE}}
{{EXPENSE_RATIO}}
{{DEBT_SERVICE}}
{{DSCR_YEAR_1}}
{{CASH_ON_CASH_YEAR_1}}
{{IRR_LEVERAGED}}
{{IRR_UNLEVERAGED}}
{{EQUITY_MULTIPLE}}
{{HOLD_PERIOD}}
{{EXIT_CAP_RATE}}
{{NET_SALE_PROCEEDS}}
```

#### Market / Demographics Tokens
```
{{MARKET_NAME}}
{{SUBMARKET_NAME}}
{{POPULATION_3MI}}
{{MEDIAN_HHI_3MI}}
{{UNEMPLOYMENT_RATE}}
{{COMP_CAP_RATE_RANGE}}
{{MARKET_RENT_GROWTH}}
```

#### Deal Meta Tokens
```
{{SPONSOR_NAME}}
{{SPONSOR_LOGO}}
{{PREPARATION_DATE}}
{{DISCLAIMER_TEXT}}
{{CONFIDENTIALITY_NOTICE}}
```

### Token Resolution
```typescript
function resolveTokens(
  templateContent: string,
  tokenData: Record<string, any>
): string {
  return templateContent.replace(/\{\{([A-Z_]+)\}\}/g, (match, token) => {
    const value = tokenData[token];
    if (value === undefined || value === null) {
      return match; // leave unresolved tokens in place (don't blank them)
    }
    return String(value);
  });
}
```

---

## buildICMemoPayload Helper

This helper assembles all token data from live Pro Forma / DCF outputs.

```typescript
export async function buildICMemoPayload(
  projectId: string,
  orgId: string
): Promise<Record<string, any>> {
  // Fetch project
  const project = await pool.query(
    `SELECT * FROM modeling_projects WHERE id = $1 AND org_id = $2`,
    [projectId, orgId]
  );

  // Fetch canonical Pro Forma output (raw pool.query — RLS table)
  const config = await pool.query(
    `SELECT * FROM modeling_project_config WHERE project_id = $1`,
    [projectId]
  );

  // Fetch DCF results
  // Fetch comparables
  // Assemble all tokens

  return {
    DEAL_NAME: project.rows[0]?.name,
    NOI_YEAR_1: formatCurrency(config.rows[0]?.noi_year_1),
    CAP_RATE: formatPercentage(config.rows[0]?.cap_rate),
    // ... all tokens
  };
}
```

---

## Document Templates

### Template Schema
```sql
CREATE TABLE document_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  name VARCHAR(255) NOT NULL,
  document_type VARCHAR(50) NOT NULL,  -- 'ic_memo' | 'om' | 'ic_deck'
  sections JSONB NOT NULL DEFAULT '[]',
  styles JSONB DEFAULT '{}',
  is_global BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Section Schema
Each template is composed of modular sections:

```typescript
interface DocumentSection {
  id: string;
  type: SectionType;
  title: string;
  content: string;         // raw content with {{TOKEN}} placeholders
  order: number;
  isOptional: boolean;
  isEnabled: boolean;
  dataBindings: string[];  // list of tokens used in this section
}

type SectionType =
  | 'cover_page'
  | 'executive_summary'
  | 'property_overview'
  | 'financial_summary'
  | 'market_analysis'
  | 'investment_thesis'
  | 'risk_factors'
  | 'exit_strategy'
  | 'appendix'
  | 'custom';
```

### Standard IC Memo Sections (in order)
1. `cover_page` — deal name, sponsor, date, property photo
2. `executive_summary` — 1-page deal overview with key metrics
3. `property_overview` — physical description, location, amenities
4. `financial_summary` — Pro Forma Year 1, multi-year NOI table, returns
5. `market_analysis` — submarket overview, demographics, comparables
6. `investment_thesis` — value-add drivers, competitive positioning
7. `risk_factors` — key risks with mitigants
8. `exit_strategy` — hold period assumptions, exit scenarios
9. `appendix` — rent roll, historical P&L, photos, maps

### Standard OM Sections (in order)
1. `cover_page`
2. `executive_summary`
3. `investment_highlights` — 5–7 bullet thesis points
4. `property_overview`
5. `market_analysis`
6. `financial_summary`
7. `offering_terms` — price, financing, timeline, process
8. `appendix`

---

## Output Formats

### Three Output Formats
```typescript
type DocumentOutputFormat = 'pdf' | 'html' | 'json';
```

### PDF Output
Generated server-side. Route:
```
POST /api/marinamatch/workspace/:projectId/documents/generate
```

Request body:
```typescript
{
  templateId: string;
  format: 'pdf';
  sections: string[];        // section IDs to include
  overrides?: Record<string, any>; // manual token overrides
}
```

### HTML Output
```typescript
// Same route, format: 'html'
// Returns rendered HTML string with styles inlined
// Useful for preview before PDF generation
```

### JSON Output
```typescript
// format: 'json'
// Returns resolved token data + section content
// Useful for debug and for populating external templates
```

---

## API Route Endpoints

```typescript
// List document templates
GET  /api/marinamatch/workspace/:projectId/documents/templates

// Get a specific template
GET  /api/marinamatch/workspace/:projectId/documents/templates/:templateId

// Create/update template
POST /api/marinamatch/workspace/:projectId/documents/templates
PUT  /api/marinamatch/workspace/:projectId/documents/templates/:templateId

// Generate document
POST /api/marinamatch/workspace/:projectId/documents/generate

// List generated documents
GET  /api/marinamatch/workspace/:projectId/documents/outputs

// Get generated document
GET  /api/marinamatch/workspace/:projectId/documents/outputs/:outputId
```

---

## Investment Materials Tab

`InvestmentMaterialsTab.tsx` displays four document cards:
1. IC / Deal Review Deck
2. Offering Memorandum
3. Executive Summary (one-pager)
4. Financial Model Export (Excel)

Each card has:
- Preview button → opens HTML preview
- Generate PDF button → triggers server-side generation
- Download button → appears after generation

---

## Technical Constraints

### No Auto-Server-Restart
After adding new document routes, always manually restart:
```bash
pkill -f 'tsx server' && npm run dev
```

### Raw pool.query for Model Data
When fetching Pro Forma / DCF data for token resolution, use `pool.query()`:
```typescript
// Always raw pool.query for these:
const config = await pool.query(
  `SELECT * FROM modeling_project_config WHERE project_id = $1`,
  [projectId]
);
const scenarios = await pool.query(
  `SELECT * FROM modeling_scenario_versions WHERE project_id = $1 ORDER BY created_at DESC LIMIT 1`,
  [projectId]
);
// Map snake_case → camelCase explicitly
```

### Format Helpers
```typescript
function formatCurrency(value: number | null): string {
  if (value == null) return '{{PENDING}}';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  }).format(value);
}

function formatPercentage(value: number | null, decimals = 2): string {
  if (value == null) return '{{PENDING}}';
  return `${(value * 100).toFixed(decimals)}%`;
}
```

---

## Unresolved Tokens Policy

If a token cannot be resolved (data not yet available), leave the `{{TOKEN}}` 
placeholder visible rather than rendering an empty string or zero.
This makes it obvious to the user which data is missing, rather than silently
producing a document with blank fields or incorrect zeros.
