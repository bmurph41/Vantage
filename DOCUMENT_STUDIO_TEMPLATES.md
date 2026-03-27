# Document Studio Templates — Handoff

## What Was Built

Two professional marina acquisition document templates for MarinaMatch's Document Studio, modeled after real institutional deal packages:

### Template 1: IC Deal Review Deck (`tpl_ic_deal_review_deck_marina_v1`)
- **Category**: `ic_memo`
- **Style**: Southern Marinas internal deal review presentation
- **Format**: Landscape 16:9 deck, navy/white palette, sans-serif
- **14 sections** (all individually toggleable):
  1. Cover
  2. Executive Summary (narrative + key stats callout + upside bullets)
  3. Ground Leases (4-panel: Ground, Parking, NW Street, T-Dock/Hotel + projected lease expense table)
  4. Property Overview (aerial dock map with labeled A-G docks)
  5. Competitive Set Overview (map + detailed comp table with rate variance %)
  6. Rent Roll Analysis (Summer + Winter tables with Contract Length/Slip Status allocation panels)
  7. Storage Revenue Analysis (revenue breakdown + pie chart mix)
  8. B&B Afloat (vessel table with beds/baths/rates/revenue)
  9. Financial Overview (4-quadrant: Revenue pie, Revenue bar, GP pie, EBITDAM growth bar)
  10. Sample Debt Term Sheet (structured term sheet matching Constitution Marina format)
  11. Underwriting Assumptions (Sources & Uses + Key Operating Assumptions + Summary Projections)
  12. Pro Forma Financials (full summary: occupancy, Revenue→NOI, DSCR, Cap Rate, IRR, EM)
  13. Pro Forma Detail (line-item Revenue/COGS/GP/OpEx with CAGR + % of Rev + adjustments footnotes)
  14. Return Summary & Sensitivity Analysis (return box + 4 sensitivity tables: Rate Growth, Insurance, Payroll, Property Tax — each with CAGR vs IRR(Gross), base case highlighted)

### Template 2: Offering Memorandum (`tpl_offering_memorandum_marina_v1`)
- **Category**: `offering_memorandum`
- **Style**: Colliers Leisure Property Advisors OM
- **Format**: Portrait, warm cream (#F5F0E8) background, gold (#B8976A) + navy (#1B365D), serif headings, wave motif, large numeral section dividers
- **8 sections**:
  1. Cover (hero collage, property name, confidential label, broker logo)
  2. Table of Contents (tagline + numbered 5-section layout)
  3. Executive Summary (Introduction narrative, Offering Terms/Summary panels, Highlights 4-grid)
  4. Property Overview (Details table, Services & Amenities checklist, Utilities, Location narrative, Maps, Ground Leases 4-panel, Marina asset detail, Seasonal/Transient rate tables, B&B Afloat)
  5. Financial Overview (Current operations, NOI Forecast with adjustments + footnotes, Pro Forma assumptions, full year-by-year Pro Forma, Other Opportunities cards)
  6. Nearby Marinas Overview (comp table + map with photo callouts)
  7. Market Overview (narrative, Tourism Facts 4-stat, Population Growth chart, Demographics 3-ring panel)
  8. Back Cover / Contact (broker team cards, disclaimer)

---

## Token Map Summary

| Metric | Count |
|--------|-------|
| **Total tokens** | ~140 |
| **Live (auto-bound)** | ~65 |
| **Manual (user-filled)** | ~75 |
| **IC Deck tokens** | ~100 |
| **OM tokens** | ~85 |
| **Shared (both)** | ~45 |

### Token Format: `{{TOKEN_NAME}}`

Example: `{{PURCHASE_PRICE}}`, `{{YEAR1_EBITDAM}}`, `{{SUMMER_RATE_PER_FT}}`

---

## Live-Wired Tokens (auto-populated from workspace)

These tokens resolve automatically from the linked MarinaMatch workspace modeling project:

| Source | Example Tokens | Binding Path |
|--------|---------------|-------------|
| `deal.*` | PROPERTY_NAME, PROPERTY_CITY, PROPERTY_STATE | deal.title, deal.ddCity, deal.ddState |
| `property.*` | TOTAL_SLIPS, LINEAR_FEET, MAX_BOAT_LENGTH | property.totalSlips, property.linearFeet |
| `modeling.*` | PURCHASE_PRICE, YEAR1_CAP_RATE | modeling.purchasePrice, modeling.capRate |
| `proforma.*` | YEAR1_REVENUE, YEAR1_NOI, YEAR1_EBITDAM, all line-item tables | proforma.year1.revenue, proforma.summaryTable |
| `capitalStack.*` | LOAN_AMOUNT, LTV, INTEREST_RATE, PI_ADS | capitalStack.seniorDebt, capitalStack.ltv |
| `exit.*` | IRR_GROSS, IRR_NET, EM_GROSS, EXIT_CAP_RATE | exit.irrGross, exit.exitCapRate |
| `rentroll.*` | SUMMER_OCCUPANCY, SUMMER_RATE_PER_FT, rent roll tables | rentroll.summerOccupancy |
| `demographics.*` | POPULATION_5MI, AVG_HH_INCOME_5MI | demographics.population5mi |
| `comps.*` | COMP_SET_TABLE | comps.compSetTable |

## Manual Tokens (user-provided)

These require the document author to fill in per-deal:

- **Identity**: SELLER_NAME, BROKER_NAME, BROKER_FIRM, SPONSOR_LOGO_URL, HERO_IMAGE_URL
- **Property**: DOCK_TYPE, SIZE_RANGE, DOCKSIDE_DEPTH, OWNERSHIP_TYPE, all amenity booleans (HAS_FUEL_DOCK, HAS_POOL, etc.)
- **Ground Leases**: GL_LESSOR, GL_LESSEE, GL_DATE, GL_TERM_EXPIRY, GL_RENT_TERMS, etc.
- **Debt**: RECOURSE, RATE_STRUCTURE, PREPAYMENT_PENALTY, DSCR_COVENANT
- **Narratives**: EXEC_SUMMARY_NARRATIVE, PROPERTY_OVERVIEW_NARRATIVE, BNB_NARRATIVE, MARKET_OVERVIEW_NARRATIVE (can be AI-generated)
- **Tables**: BNB_VESSEL_TABLE (JSON array), ADJUSTMENTS_FOOTNOTES
- **Broker**: BROKER_TEAM (JSON array), BROKER_OF_RECORD, FIRM_ADDRESS

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/document-builder/professional-templates` | List all registered templates with summary |
| GET | `/api/document-builder/professional-templates/:id` | Full template definition with sections + blocks |
| GET | `/api/document-builder/professional-templates/:id/tokens` | Token map for a specific template |
| GET | `/api/document-builder/token-map` | Full master token map (all templates) |
| POST | `/api/document-builder/professional-templates/seed` | Seed templates into om_templates DB table |
| POST | `/api/document-builder/documents/:id/save-as-template` | Save any document as reusable template |
| GET | `/api/document-builder/saved-templates` | List org's custom saved templates |
| DELETE | `/api/document-builder/saved-templates/:id` | Delete a custom template |

---

## How to Add a New Template

1. Create a new file in `shared/document-builder/templates/` (e.g., `lender-package.ts`)
2. Export a template object matching the structure of `IC_DEAL_REVIEW_DECK_TEMPLATE`
3. Add any new tokens to `token-map.ts` → `MASTER_TOKEN_MAP`
4. Import and add to `DOCUMENT_STUDIO_TEMPLATES` array in `templates/index.ts`
5. Hit `POST /api/document-builder/professional-templates/seed` to write to DB

### Template structure:
```typescript
{
  id: 'tpl_lender_package_marina_v1',
  name: 'Lender Package — Marina',
  description: '...',
  category: 'lender_package',
  documentType: 'lender_package',
  assetClass: 'marina',
  audience: ['lender'],
  style: { palette, typography, layout },
  sections: [
    {
      key: 'unique_section_key',
      title: 'Section Title',
      order: 1,
      enabled: true,
      required: true,
      tokens: ['TOKEN_1', 'TOKEN_2'],
      blocks: [
        { type: 'heading|text|table|chart|image|metric_grid|bullet_list|divider', key: '...', config: {...} }
      ],
    }
  ],
  requiredTokens: [...],
  optionalTokens: [...],
}
```

---

## Gotchas

1. **Token resolution order**: Live tokens are resolved first from workspace data. If a live token returns null/undefined, the template renderer should show `[{{TOKEN_NAME}}]` as a placeholder so the user knows it needs manual fill.

2. **Sensitivity tables**: The IC Deck's 4 sensitivity tables (Section 14) must preserve the exact format: `{scenario, cagr, irrGross}` rows with the base case row bolded. The stress test engine (`/api/modeling-enhanced/stress-tests`) can generate these, but the token expects pre-formatted JSON.

3. **Pro forma tables**: Both `PROFORMA_SUMMARY_TABLE` and `PROFORMA_DETAIL_TABLE` are large JSON arrays. The rendering layer needs to handle 7+ year columns. The existing `buildICMemoPayload` pattern in the codebase can be referenced for how to assemble these from `modelingScenarioVersions`.

4. **Ground leases**: The 4-panel lease layout is deal-specific. Not all marinas have all 4 lease types — sections with unfilled tokens should gracefully hide (the `enabled` flag on each section handles this).

5. **Images**: All `*_IMAGE_URL` and `*_LOGO_URL` tokens expect URLs (either uploaded to VDR or external). The Document Studio media upload panel handles this.

6. **OM vs IC Deck styling**: The two templates use completely different palettes and typography. The `style` object on each template drives the PDF renderer's theme. Don't mix them.

7. **`raw pool.query()`**: Per project convention, use `raw pool.query()` for `modelingProjectConfig` and `modelingScenarioVersions` access. Map snake_case column returns explicitly.

8. **Server restart**: After route changes, restart the server manually (`npm run dev`).
