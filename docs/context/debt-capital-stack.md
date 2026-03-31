# MarinaMatch — Debt Modeling & Capital Stack

## Overview

The Capital Stack module handles all debt and equity modeling for a deal.
It lives within the Deal Room / Financial Model workspace.

---

## LTV / Dollar Toggle

Users can input loan sizing in two modes:

```typescript
type LoanSizingMode = 'ltv' | 'dollar';

interface LoanSizingInput {
  mode: LoanSizingMode;
  ltvPercent?: number;      // e.g. 0.65 = 65% LTV
  loanAmount?: number;      // dollar amount
  purchasePrice: number;    // always required for LTV calc
}

function resolveLoanAmount(input: LoanSizingInput): number {
  if (input.mode === 'ltv') {
    return input.purchasePrice * (input.ltvPercent ?? 0);
  }
  return input.loanAmount ?? 0;
}

function resolveLTV(input: LoanSizingInput): number {
  if (input.mode === 'dollar') {
    return (input.loanAmount ?? 0) / input.purchasePrice;
  }
  return input.ltvPercent ?? 0;
}
```

The UI shows one input at a time (toggle between modes) but always computes both.

---

## Projected Closing Date

Business-day adjustment on closing date:

```typescript
import { addBusinessDays, isWeekend } from 'date-fns';

function adjustToBusinessDay(date: Date): Date {
  // If date falls on weekend, move to next Monday
  if (isWeekend(date)) {
    return addBusinessDays(date, 1);
  }
  return date;
}

// In the Capital Stack form:
// - User picks target close date
// - Display shows adjusted business day
// - Downstream calculations use adjusted date
```

---

## Debt Service Calculation

```typescript
interface LoanTerms {
  loanAmount: number;
  interestRate: number;      // annual rate, decimal (e.g. 0.065)
  amortizationYears: number; // 25 or 30 typical
  termYears: number;         // IO period or balloon term
  isInterestOnly: boolean;
  ioYears?: number;          // interest-only period before amortization
}

function calculateMonthlyPayment(terms: LoanTerms): number {
  if (terms.isInterestOnly) {
    return (terms.loanAmount * terms.interestRate) / 12;
  }

  const monthlyRate = terms.interestRate / 12;
  const numPayments = terms.amortizationYears * 12;

  return (
    terms.loanAmount *
    (monthlyRate * Math.pow(1 + monthlyRate, numPayments)) /
    (Math.pow(1 + monthlyRate, numPayments) - 1)
  );
}

function calculateAnnualDebtService(terms: LoanTerms): number {
  return calculateMonthlyPayment(terms) * 12;
}
```

---

## DSCR — Multi-Year Timeline

DSCR is calculated for each projection year and displayed as a timeline in the Capital Stack tab.

```typescript
interface DSCRYear {
  year: number;
  noi: number;
  annualDebtService: number;
  dscr: number;
  isCompliant: boolean;    // typically DSCR >= 1.25
  dscrThreshold: number;   // lender requirement, default 1.25
}

function calculateDSCRTimeline(
  noiProjections: number[],  // from multi-year projection engine
  loanTerms: LoanTerms,
  dscrThreshold: number = 1.25
): DSCRYear[] {
  const annualDS = calculateAnnualDebtService(loanTerms);

  return noiProjections.map((noi, i) => ({
    year: i + 1,
    noi,
    annualDebtService: annualDS,
    dscr: noi / annualDS,
    isCompliant: noi / annualDS >= dscrThreshold,
    dscrThreshold
  }));
}
```

### DSCR Rounding Controls
```typescript
// DSCR displayed to 2 decimal places
const displayDSCR = (dscr: number) => dscr.toFixed(2);

// Debt service displayed to nearest dollar (no cents)
const displayDebtService = (ds: number) => Math.round(ds);
```

---

## Capital Stack Layers

```typescript
interface CapitalStackLayer {
  id: string;
  name: string;
  type: CapitalLayerType;
  amount: number;
  percentOfTotal: number;
  interestRate?: number;
  returnTarget?: number;
}

type CapitalLayerType =
  | 'senior_debt'        // first mortgage
  | 'mezzanine_debt'     // subordinate debt
  | 'preferred_equity'   // preferred return equity
  | 'common_equity'      // common equity (sponsor + LP)
  | 'sponsor_equity'     // GP/sponsor co-invest
  | 'lp_equity';         // limited partner equity
```

### Equity Layer UX — Solo vs Institutional

```typescript
// Solo investor mode: simplified single equity layer
// Institutional mode: full stack with mezzanine, preferred, LP/GP split

type EquityMode = 'solo' | 'institutional';

// Solo: shows only "Equity" layer = purchase price - loan amount
// Institutional: shows full waterfall breakdown with tier configuration

function buildCapitalStack(
  purchasePrice: number,
  loanTerms: LoanTerms,
  mode: EquityMode,
  institutionalLayers?: CapitalStackLayer[]
): CapitalStackLayer[] {
  const loanAmount = resolveLoanAmount({ ...loanTerms, purchasePrice });
  const equityAmount = purchasePrice - loanAmount;

  if (mode === 'solo') {
    return [
      { id: 'debt', name: 'Senior Debt', type: 'senior_debt', amount: loanAmount, percentOfTotal: loanAmount / purchasePrice },
      { id: 'equity', name: 'Equity', type: 'common_equity', amount: equityAmount, percentOfTotal: equityAmount / purchasePrice }
    ];
  }

  return institutionalLayers ?? [];
}
```

---

## Debt-Tax Bridge

The debt-tax bridge endpoint provides tax implications of debt structure for the Exit Strategy:

```typescript
// POST /api/marinamatch/workspace/:projectId/debt-tax-bridge
interface DebtTaxBridgeRequest {
  loanAmount: number;
  originalCost: number;
  salePrice: number;
  accumulatedDepreciation: number;
  holdPeriod: number;
}

interface DebtTaxBridgeResponse {
  mortgageSatisfaction: number;        // loan payoff at sale
  netEquityProceeds: number;           // after debt payoff
  depreciationRecaptureAmount: number; // taxable recapture
  capitalGainAmount: number;           // long-term gain
  totalTaxLiability: number;
  afterTaxNetProceeds: number;
}
```

---

## Loan Amortization Schedule

Optional display in Capital Stack tab — expandable section showing full amortization:

```typescript
interface AmortizationRow {
  period: number;         // month number
  payment: number;
  principal: number;
  interest: number;
  balance: number;
}

function buildAmortizationSchedule(terms: LoanTerms): AmortizationRow[] {
  const rows: AmortizationRow[] = [];
  let balance = terms.loanAmount;
  const monthlyPayment = calculateMonthlyPayment(terms);
  const monthlyRate = terms.interestRate / 12;

  for (let period = 1; period <= terms.amortizationYears * 12; period++) {
    const interest = balance * monthlyRate;
    const principal = monthlyPayment - interest;
    balance -= principal;

    rows.push({
      period,
      payment: monthlyPayment,
      principal,
      interest,
      balance: Math.max(0, balance)
    });
  }

  return rows;
}
```

---

## Capital Stack Tab Layout

```
Capital Stack Tab
├── Loan Sizing Section
│   ├── LTV / Dollar toggle
│   ├── Loan amount (computed or input)
│   ├── Interest rate
│   ├── Amortization period
│   ├── Loan term / balloon
│   └── Projected closing date (with business-day adjustment)
├── Equity Structure (Solo / Institutional toggle)
│   └── [Stack visualization: horizontal bar chart]
├── Debt Service Summary
│   ├── Monthly payment
│   ├── Annual debt service
│   └── DSCR Year 1
├── DSCR Multi-Year Timeline
│   └── [Bar/line chart: Year 1–10 DSCR vs threshold line]
└── Amortization Schedule (expandable)
```

---

## Validation Rules

```typescript
// Warn if:
if (dscr < 1.0) → 'DSCR below 1.0 — deal does not cover debt service'
if (dscr < 1.25) → 'DSCR below 1.25 — may not meet lender requirements'
if (ltv > 0.80) → 'LTV exceeds 80% — may require PMI or additional equity'
if (ltv > 0.75) → 'Warning: LTV above typical CRE lending threshold'
```
