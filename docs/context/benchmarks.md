# CRE Market Benchmarks — Validation Rails

Use this doc when building or validating financial model outputs.
When modeled values fall outside these ranges, surface warnings in the UI.

## Cap Rate Ranges by Asset Class

```typescript
export const CAP_RATE_RANGES: Record<string, { valueAdd: [number, number]; stabilized: [number, number]; institutional: [number, number] | null }> = {
  'marina':           { valueAdd: [0.065, 0.085], stabilized: [0.055, 0.070], institutional: [0.045, 0.060] },
  'multifamily_a':    { valueAdd: [0.055, 0.065], stabilized: [0.045, 0.055], institutional: [0.035, 0.045] },
  'multifamily_bc':   { valueAdd: [0.065, 0.080], stabilized: [0.055, 0.070], institutional: [0.050, 0.060] },
  'self_storage':     { valueAdd: [0.060, 0.075], stabilized: [0.050, 0.065], institutional: [0.045, 0.055] },
  'industrial':       { valueAdd: [0.055, 0.070], stabilized: [0.045, 0.055], institutional: [0.035, 0.045] },
  'retail_strip':     { valueAdd: [0.070, 0.090], stabilized: [0.060, 0.075], institutional: [0.055, 0.065] },
  'office_suburban':  { valueAdd: [0.075, 0.100], stabilized: [0.065, 0.085], institutional: null },
  'hospitality':      { valueAdd: [0.080, 0.110], stabilized: [0.070, 0.090], institutional: [0.060, 0.080] },
};
```

## DSCR Thresholds by Lender Type

```typescript
export const DSCR_THRESHOLDS: Record<string, { min: number; typical: number; ltv: [number, number] }> = {
  'agency':       { min: 1.25, typical: 1.30, ltv: [0.70, 0.80] },
  'cmbs':         { min: 1.20, typical: 1.25, ltv: [0.65, 0.75] },
  'life_co':      { min: 1.30, typical: 1.40, ltv: [0.55, 0.65] },
  'regional_bank':{ min: 1.20, typical: 1.30, ltv: [0.65, 0.75] },
  'sba_7a':       { min: 1.15, typical: 1.25, ltv: [0.80, 0.90] },
  'bridge':       { min: 1.05, typical: 1.15, ltv: [0.70, 0.80] },
  'marina_lender':{ min: 1.25, typical: 1.35, ltv: [0.60, 0.70] },
};
```

## Expense Ratio Norms by Asset Class

```typescript
export const EXPENSE_RATIO_RANGES: Record<string, [number, number]> = {
  'marina':       [0.35, 0.50],   // Red flag: >60% or <30%
  'multifamily':  [0.35, 0.50],
  'self_storage': [0.25, 0.40],
  'industrial':   [0.15, 0.30],   // NNN leases = low expense ratio
  'retail':       [0.20, 0.35],
  'office':       [0.40, 0.55],
  'hospitality':  [0.55, 0.75],
};
```

## IRR Targets by Strategy

```typescript
export const IRR_TARGETS: Record<string, { unlevered: [number, number]; levered: [number, number]; equityMultiple: [number, number] }> = {
  'core':          { unlevered: [0.05, 0.07], levered: [0.07, 0.10], equityMultiple: [1.5, 1.8] },
  'core_plus':     { unlevered: [0.07, 0.09], levered: [0.09, 0.13], equityMultiple: [1.7, 2.2] },
  'value_add':     { unlevered: [0.09, 0.13], levered: [0.13, 0.18], equityMultiple: [2.0, 2.8] },
  'opportunistic': { unlevered: [0.13, 0.18], levered: [0.18, 0.25], equityMultiple: [2.5, 4.0] },
};
```

## LTV Limits by Lender Type

| Lender Type | Max LTV | Notes |
|---|---|---|
| Agency | 80% | Multifamily only |
| CMBS | 75% | Post-2023 stricter |
| Life Co | 65% | Best rates |
| Regional Bank | 75% | Relationship-driven |
| SBA 7(a) | 90% | Owner-operator |
| Bridge/Debt Fund | 80% | Short-term, higher rate |
| Marina-Specific | 70% | Specialty premium |

## Marina-Specific Benchmarks

```typescript
export const MARINA_BENCHMARKS = {
  pricePerSlip: { low: 15_000, median: 35_000, high: 100_000 },   // acquisition price
  revenuePerSlip: { low: 3_000, median: 6_500, high: 15_000 },    // annual
  fuelGrossMargin: [0.15, 0.25],                                    // 15-25%
  capExReservePerSlip: [500, 1_500],                                // $/slip/year
  occupancyRate: { seasonal: [0.60, 0.85], annual: [0.85, 0.98] },
  expenseRatio: { wellRun: [0.35, 0.50], redFlagHigh: 0.60, redFlagLow: 0.30 },
};
```

## Validation Rules

```typescript
type Severity = 'info' | 'warning' | 'error';

interface ValidationResult {
  field: string;
  severity: Severity;
  message: string;
  modeledValue: number;
  benchmarkRange: [number, number];
}

/**
 * Validate a financial model output against benchmarks.
 * Call this from Pro Forma and DCF components after computation.
 */
export function validateModelOutputs(params: {
  assetClass: string;
  strategy: string;
  lenderType: string;
  capRate: number;
  expenseRatio: number;
  dscr: number;
  ltv: number;
  irr: number;
  equityMultiple: number;
  vacancyRate: number;
  noiGrowthRate: number;
  exitCapRate: number;
  entryCapRate: number;
}): ValidationResult[] {
  const warnings: ValidationResult[] = [];

  // Cap rate outside asset class range (±150bps tolerance)
  const capRanges = CAP_RATE_RANGES[params.assetClass];
  if (capRanges) {
    const [low, high] = capRanges.valueAdd;
    if (params.capRate < low - 0.015 || params.capRate > high + 0.015) {
      warnings.push({
        field: 'capRate', severity: 'warning',
        message: `Cap rate ${(params.capRate * 100).toFixed(1)}% outside typical ${params.assetClass} range`,
        modeledValue: params.capRate, benchmarkRange: [low, high],
      });
    }
  }

  // Expense ratio
  const expRange = EXPENSE_RATIO_RANGES[params.assetClass];
  if (expRange && (params.expenseRatio < expRange[0] || params.expenseRatio > expRange[1])) {
    warnings.push({
      field: 'expenseRatio', severity: params.expenseRatio < 0.30 ? 'error' : 'warning',
      message: `Expense ratio ${(params.expenseRatio * 100).toFixed(0)}% outside norm`,
      modeledValue: params.expenseRatio, benchmarkRange: expRange,
    });
  }

  // DSCR below lender minimum
  const dscrThresh = DSCR_THRESHOLDS[params.lenderType];
  if (dscrThresh && params.dscr < dscrThresh.min) {
    warnings.push({
      field: 'dscr', severity: 'error',
      message: `DSCR ${params.dscr.toFixed(2)}x below ${params.lenderType} minimum ${dscrThresh.min}x`,
      modeledValue: params.dscr, benchmarkRange: [dscrThresh.min, dscrThresh.typical],
    });
  }

  // Vacancy below 5% without justification
  if (params.vacancyRate < 0.05) {
    warnings.push({
      field: 'vacancyRate', severity: 'warning',
      message: 'Vacancy below 5% — requires justification',
      modeledValue: params.vacancyRate, benchmarkRange: [0.05, 0.10],
    });
  }

  // NOI growth > 5%
  if (params.noiGrowthRate > 0.05) {
    warnings.push({
      field: 'noiGrowthRate', severity: 'warning',
      message: 'NOI growth >5%/year — requires market evidence',
      modeledValue: params.noiGrowthRate, benchmarkRange: [0.02, 0.05],
    });
  }

  // Exit cap <= entry cap
  if (params.exitCapRate <= params.entryCapRate) {
    warnings.push({
      field: 'exitCapRate', severity: 'warning',
      message: 'Exit cap at or below entry cap — no risk premium applied',
      modeledValue: params.exitCapRate, benchmarkRange: [params.entryCapRate + 0.0025, params.entryCapRate + 0.0075],
    });
  }

  return warnings;
}
```

## Wiring Into UI

### Pro Forma Component
Call `validateModelOutputs()` after NOI computation. Display warnings as:
- Yellow alert banner for `warning` severity
- Red alert banner for `error` severity
- Collapsible list showing field, modeled value, benchmark range

### DCF Component
Call after IRR/NPV computation. Show inline next to the metric that triggered it.

### Pattern
```tsx
const warnings = validateModelOutputs({ ...modelOutputs });
{warnings.length > 0 && (
  <Alert variant={warnings.some(w => w.severity === 'error') ? 'destructive' : 'default'}>
    <AlertTitle>Benchmark Warnings ({warnings.length})</AlertTitle>
    {warnings.map(w => (
      <div key={w.field}>
        {w.severity === 'error' ? '🔴' : '🟡'} {w.message}
      </div>
    ))}
  </Alert>
)}
```
