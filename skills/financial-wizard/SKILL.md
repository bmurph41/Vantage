---
name: cre-financial-modeling
description: >
  Use this skill for any commercial real estate financial modeling task.
  Triggers: cap rate analysis, NOI calculation, DCF modeling, IRR/equity multiple
  analysis, waterfall distributions, debt structuring, DSCR analysis, pro forma
  construction, exit strategy modeling, hold period optimization, sensitivity analysis,
  or any underwriting work across marina, multifamily, self-storage, or other CRE assets.
---

# CRE Financial Modeling — Expert Reference

## Cap Rate Benchmarks by Asset Class (2024-2025)

| Asset Class | Value-Add | Stabilized | Institutional |
|---|---|---|---|
| Marina / Waterfront | 6.5–8.5% | 5.5–7.0% | 4.5–6.0% |
| Multifamily (Class A) | 5.5–6.5% | 4.5–5.5% | 3.5–4.5% |
| Multifamily (Class B/C) | 6.5–8.0% | 5.5–7.0% | 5.0–6.0% |
| Self-Storage | 6.0–7.5% | 5.0–6.5% | 4.5–5.5% |
| Industrial | 5.5–7.0% | 4.5–5.5% | 3.5–4.5% |
| Retail Strip | 7.0–9.0% | 6.0–7.5% | 5.5–6.5% |
| Office (suburban) | 7.5–10.0% | 6.5–8.5% | N/A (distressed) |
| Hospitality | 8.0–11.0% | 7.0–9.0% | 6.0–8.0% |

Always flag if modeled cap rate is outside ±150bps of the asset class range.

## NOI Construction

```
Gross Potential Revenue (GPR)
− Vacancy & Credit Loss         (5–10% typical; marina: 3–8%)
= Effective Gross Revenue (EGR)
+ Other Income                  (ancillary, parking, storage)
= Total Revenue
− Operating Expenses            (30–55% of EGR typical)
= Net Operating Income (NOI)
```

### Marina-Specific Revenue Lines
- Slip rental (seasonal vs. annual mix matters — annual more stable)
- Dry storage fees
- Fuel sales (high revenue, low margin — ~15–25% gross margin)
- Service/repair labor + parts
- Ship's store / retail
- Launch fees
- Live-aboard surcharges
- Pump-out fees

### Marina Expense Ratio Benchmarks
- Well-run marina: 35–50% expense ratio
- Red flag: >60% (operational issues) or <30% (likely under-reporting)
- CapEx reserve: $500–$1,500/slip/year depending on infrastructure age

## DSCR Standards by Lender Type

| Lender Type | Min DSCR | Typical LTV | Notes |
|---|---|---|---|
| Agency (Freddie/Fannie) | 1.25x | 70–80% | MF only |
| CMBS | 1.20–1.25x | 65–75% | Stricter post-2023 |
| Life Insurance Co. | 1.30–1.40x | 55–65% | Best rates, slowest |
| Regional Bank | 1.20–1.30x | 65–75% | Relationship-driven |
| SBA 7(a) | 1.15–1.25x | up to 90% | For owner-operators |
| Bridge/Debt Fund | 1.05–1.15x | 70–80% | Value-add, short-term |
| Marina-Specific Lenders | 1.25–1.35x | 60–70% | Specialty asset premium |

Always test DSCR at stressed rate (+150–200bps above contract rate).

## IRR & Return Targets by Strategy

| Strategy | Unlevered IRR | Levered IRR | Equity Multiple |
|---|---|---|---|
| Core | 5–7% | 7–10% | 1.5–1.8x |
| Core-Plus | 7–9% | 9–13% | 1.7–2.2x |
| Value-Add | 9–13% | 13–18% | 2.0–2.8x |
| Opportunistic | 13–18% | 18–25%+ | 2.5–4.0x+ |

Marina acquisitions typically underwrite as value-add (operational upside)
or opportunistic (distressed infrastructure, deferred maintenance).

## Waterfall Distribution Mechanics

### Standard 2-Tier Waterfall
```
Tier 1: Return of capital to all investors (pari passu)
Tier 2: Preferred return to LP (typically 6–8% IRR hurdle)
Above hurdle: Promote split (e.g., 70/30 LP/GP or 80/20)
```

### 3-Tier Waterfall (Institutional)
```
Tier 1: Return of capital
Tier 2: 8% preferred return (LP gets 100%)
Tier 3: 8–12% IRR band (LP 80% / GP 20%)
Tier 4: Above 12% IRR (LP 70% / GP 30%)
```

### Key Waterfall Formulas
```
LP Preferred Return = Invested Capital × Pref Rate × Hold Period
GP Promote = (Total Distributions − LP Preferred − Capital Return) × GP %
Equity Multiple = Total Distributions / Total Equity Invested
```

## DCF Methodology

### Discount Rate Selection
- Core assets: 6–8% (WACC-based or market-derived)
- Value-add: 9–12%
- Opportunistic / marina: 12–15%
- Rule: discount rate ≥ levered IRR target

### Terminal Value Methods
1. **Exit Cap Rate** (preferred for CRE): `NOI(Year N+1) / Exit Cap Rate`
2. **Gordon Growth**: `NOI(Year N) × (1 + g) / (r - g)` — use for stable assets only
3. **Sales Comparable**: best for assets with thin cap rate history

### Exit Cap Rate Conventions
- Typically 25–50bps above entry cap rate (risk of cap rate expansion)
- Marina: add 50–75bps for illiquidity premium
- Never underwrite exit cap below entry cap without strong market evidence

## Sensitivity Analysis Framework

Always test these variables (tornado chart order by impact):
1. Exit cap rate (±50bps)
2. Revenue growth rate (±1%)
3. Vacancy rate (±2%)
4. Interest rate (±100bps)
5. Hold period (±2 years)
6. CapEx timing (±1 year)

## Common Underwriting Errors to Flag

- Vacancy below 5% without justification
- Expense ratio below 30% (likely missing reserves or management fee)
- NOI growth >5%/year without market evidence
- Exit cap same as entry cap (no risk premium)
- Debt service calculated on I/O but not tested on full amortization
- Missing CapEx reserves entirely
- Seasonality not modeled for seasonal assets (marina, hospitality, STR)
