# MarinaMatch — Financial Model Patterns

## Architecture Overview

The financial model follows a strict layered pipeline. Each layer consumes the output
of the layer before it. Never bypass a layer or duplicate logic that belongs in another.

```
Layer 1: Pro Forma Inputs
        ↓
Layer 2: Seasonality Engine (auto-derives monthly distribution)
        ↓
Layer 3: Canonical Pro Forma (pure-function projection engine)
        ↓
Layer 4: DCF (consumes canonical Pro Forma output)
        ↓
Layer 4: Monte Carlo (consumes canonical Pro Forma output)
        ↓
Layer 4: Decision Support (tornado / attribution / memo)
        ↓
Layer 5: Exit Strategy Studio (net proceeds / DST / waterfall)
```

**Status:** Layers 1–4 complete. 154/154 tests passing. 0 TypeScript errors.

---

## Pure-Function Projection Engine

All projection logic must be **pure functions** — no side effects, no DB calls,
no API calls. They take inputs and return outputs.

```typescript
// Example pure function signature
export function calculateNOI(
  grossRevenue: number,
  vacancyRate: number,
  operatingExpenses: number
): number {
  const effectiveRevenue = grossRevenue * (1 - vacancyRate);
  return effectiveRevenue - operatingExpenses;
}

// Multi-year projection — pure function
export function projectMultiYear(
  inputs: ProFormaInputs,
  years: number = 5,
  growthRate: number = 0.03
): YearlyProjection[] {
  return Array.from({ length: years }, (_, i) => {
    const year = i + 1;
    const factor = Math.pow(1 + growthRate, i);
    return {
      year,
      grossRevenue: inputs.grossRevenue * factor,
      noi: calculateNOI(
        inputs.grossRevenue * factor,
        inputs.vacancyRate,
        inputs.operatingExpenses * factor
      )
    };
  });
}
```

### Verified Year 1 / Year 5 Benchmarks (STR test project)
| Metric | Year 1 | Year 5 (3% CAGR) |
|---|---|---|
| NOI | $50,629 | $57,018 |

Use these to validate projection engine correctness.

---

## Seasonality Engine

Seasonality is **auto-derived** from inputs — never hardcoded, never manually entered.

```typescript
// Seasonality is derived, not stored as a user input
export function deriveSeasonalityFactors(
  historicalMonthlyRevenue?: number[],
  assetClass?: string
): number[] {
  if (historicalMonthlyRevenue && historicalMonthlyRevenue.length === 12) {
    const avg = historicalMonthlyRevenue.reduce((a, b) => a + b, 0) / 12;
    return historicalMonthlyRevenue.map(m => m / avg);
  }
  // Default flat seasonality if no historical data
  return Array(12).fill(1.0);
}
```

If the Pro Forma appears to return stale data after model changes, trigger
a seasonality recalculation — stale seasonality data is the most common cause.

---

## DCF Model

### Key Rules
- DCF **always consumes the canonical Pro Forma output** — never raw inputs directly
- Never duplicate Pro Forma logic inside the DCF
- DCF inputs come from `getModelConfig()` for assumptions

### getModelConfig Pattern
```typescript
// Always use this for DCF assumptions — never hardcode
import { getModelConfig } from '../config/model-config';

const config = getModelConfig(assetClass);
// config includes:
// - defaultDiscountRate
// - defaultCapRate
// - defaultGrowthRate
// - holdPeriod
// - exitCapRateAdjustment
// - assetClassSpecificAssumptions
```

### XIRR
XIRR is **consolidated** — there is one canonical implementation. Do not create
additional XIRR functions or copy-paste the algorithm.

```typescript
import { calculateXIRR } from '../utils/financial/xirr';

const cashFlows = [
  { date: purchaseDate, amount: -purchasePrice },
  ...annualNOIs.map((noi, i) => ({
    date: addYears(purchaseDate, i + 1),
    amount: noi
  })),
  { date: exitDate, amount: netSaleProceeds }
];

const xirr = calculateXIRR(cashFlows);
```

### assumptions.tsx
The assumptions component is **dynamic via `getModelConfig()`**. Do not add
hardcoded assumption fields. All new assumption fields must come through `getModelConfig()`.

---

## Monte Carlo

Monte Carlo consumes the canonical Pro Forma output.

```typescript
interface MonteCarloConfig {
  iterations: number;          // typically 1000–10000
  confidenceIntervals: number[]; // e.g. [0.05, 0.25, 0.50, 0.75, 0.95]
  variableRanges: {
    vacancyRate: { min: number; max: number; distribution: 'normal' | 'uniform' };
    growthRate: { min: number; max: number; distribution: 'normal' | 'uniform' };
    capRate: { min: number; max: number; distribution: 'normal' | 'uniform' };
  };
}
```

---

## Decision Support

Three components, all consuming canonical Pro Forma/DCF output:

### Tornado Chart
Shows sensitivity of IRR/NPV to each input variable.
```typescript
// Vary each input ±10% (or configured range), hold others constant
// Output: ranked list of variables by impact magnitude
```

### Attribution Analysis
```typescript
// Breaks down return components:
// - Income return
// - Appreciation return
// - Tax benefits
// - Financing leverage
```

### Investment Memo Auto-Generation
```typescript
// Generates structured IC memo sections from model outputs
// Sections: Executive Summary, Property Overview, Financial Summary,
//           Risk Factors, Investment Recommendation
```

---

## Exit Strategy Studio

All three exit calculators consume the **canonical exit-scenario-engine**.
Never let them have independent calculation logic.

```typescript
// Three calculators, one engine:
// 1. Net Proceeds Calculator
// 2. DST (Delaware Statutory Trust) Analysis
// 3. Waterfall Distribution

import { calculateExitScenario } from '../engines/exit-scenario-engine';

const result = calculateExitScenario({
  salePrice: number,
  originalCost: number,
  loanBalance: number,
  closingCostRate: number,
  holdPeriod: number,
  taxRates: TaxRates,
  waterfallTiers?: WaterfallTier[]
});
// Returns: netProceeds, taxLiability, deferredTaxAmount, waterfallDistribution
```

### Breakdown Components
These UI components exist and should be reused:
- `ClosingCostsBreakdownCard`
- `GainBreakdownCard`
- `TaxDeferredBreakdownCard`

---

## Multi-Year Pro Forma Tab

Component: `MultiYearProjectionTab.tsx`
API Route: `POST /api/marinamatch/workspace/:projectId/multi-year-projection`

```typescript
// Request body
{
  years: number;        // 1–30
  growthRate: number;   // annual CAGR decimal (e.g. 0.03)
  scenarioId?: string;
}

// Response
{
  projections: Array<{
    year: number;
    grossRevenue: number;
    effectiveRevenue: number;
    operatingExpenses: number;
    noi: number;
    debtService: number;
    cashFlowBeforeTax: number;
  }>
}
```

---

## P&L Parser v2

- Uses `pdfjs-dist` with geometry-based extraction (not text order)
- Six validation checks on parsed output
- Alias learning with weight-based confidence scoring
- Category normalization handles lowercase/variant spellings
- Known bug fixed: lowercase NOI category variants no longer corrupt NOI total

### Category Normalization
Always normalize category names before classification:
```typescript
const normalized = category.toLowerCase().trim()
  .replace(/\s+/g, ' ')
  .replace(/[^a-z0-9 ]/g, '');
```

---

## PLModeToggle

Three modes for P&L data ingestion:
- `uploaded` — parsed from PDF/Excel upload
- `direct` — client-side form with live P&L preview
- `hybrid` — uploaded as base, direct edits on top

```typescript
type PLMode = 'uploaded' | 'direct' | 'hybrid';
```

---

## DB Tables for Financial Model

Use `pool.query()` for all of these (RLS-affected):

```sql
-- Always use raw pool.query()
modeling_project_config
modeling_scenario_versions
```

```typescript
// Test project for development
const TEST_PROJECT_ID = '6b3a9021-f393-489d-9274-321ac76eae08';
const TEST_ORG_ID = 'cd3719c3-ef82-4ccc-acb9-261c80fb64b4';

// Fetch config (raw pool.query — not Drizzle)
const result = await pool.query(
  `SELECT * FROM modeling_project_config
   WHERE project_id = $1 AND org_id = $2`,
  [projectId, orgId]
);

// Always map snake_case → camelCase
const config = {
  id: result.rows[0].id,
  projectId: result.rows[0].project_id,
  scenarioName: result.rows[0].scenario_name,
  // ... explicit mapping
};
```

---

## Dummy Data Policy

**Dummy data has been purged.** All financial model components must show
**empty states** when no real data is available. Never add placeholder/mock data
back to financial components.

```typescript
// Pattern for empty states
if (!projections || projections.length === 0) {
  return (
    <EmptyState
      title="No projection data"
      description="Configure your Pro Forma inputs to generate projections."
      action={<Button onClick={openProForma}>Configure Pro Forma</Button>}
    />
  );
}
```

---

## Testing

Test file location: `server/tests/` or `src/__tests__/`

Current test status: **154/154 passing, 0 TypeScript errors**

Run tests:
```bash
npm test
# or
npx jest --coverage
```

Always run tests after any changes to the projection engine, DCF, or Monte Carlo.
If tests break, fix them before moving on — do not comment them out.
