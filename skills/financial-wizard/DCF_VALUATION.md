---
name: dcf-and-valuation
description: >
  Use for any discounted cash flow, valuation, XIRR, NPV, or investment returns
  analysis. Triggers: NPV calculation, IRR computation, XIRR for irregular cash flows,
  equity multiple, hold period optimization, sensitivity tables, scenario analysis,
  terminal value methodology, or any "what is this deal worth" question.
---

# DCF & Valuation — Expert Reference

## XIRR vs IRR

| | IRR | XIRR |
|---|---|---|
| Cash flow timing | Assumes periodic (annual) | Uses actual dates |
| When to use | Clean annual pro formas | Irregular closings, mid-year sales |
| MarinaMatch | Used in DCF engine | Canonical — one implementation |

```javascript
// XIRR Newton-Raphson implementation (canonical — do not duplicate)
// Located at: shared/finance/xirr.ts
// Input: [{ date: Date, amount: number }]
// Output: decimal rate (e.g. 0.142 = 14.2% IRR)
```

## NPV Formula
```
NPV = Σ [CF_t / (1 + r)^t] − Initial Investment
```
- Positive NPV = value-creating at given discount rate
- NPV = 0 when discount rate = IRR

## Hold Period Optimization

Test IRR at each hold year. Peak IRR year = optimal hold.
Typical pattern for value-add: IRR peaks at Year 5–7 as value-add
work completes and before major CapEx cycle returns.

## Scenario Framework

Always run three scenarios:
| Scenario | Revenue | Expenses | Exit Cap | Weight |
|---|---|---|---|---|
| Bull | +10% vs base | −5% vs base | −25bps | 25% |
| Base | As modeled | As modeled | As modeled | 50% |
| Bear | −10% vs base | +10% vs base | +50bps | 25% |

Weighted IRR = (Bull IRR × 0.25) + (Base IRR × 0.50) + (Bear IRR × 0.25)

## Equity Multiple Interpretation

| Multiple | Meaning | Typical Strategy |
|---|---|---|
| < 1.5x | Below institutional threshold | Distressed or failed value-add |
| 1.5–1.8x | Core return | Stabilized, low-risk |
| 1.8–2.2x | Core-plus | Modest operational upside |
| 2.0–2.8x | Value-add | Significant NOI growth |
| 2.5–4.0x+ | Opportunistic | Major repositioning or development |

## Cash-on-Cash Return

```
Cash-on-Cash = Annual Pre-Tax Cash Flow / Total Equity Invested
```
- Year 1 target: 6–8% for stabilized, 0–3% for value-add (CapEx heavy)
- Stabilized target: 8–12%
- Below 5% stabilized signals over-leverage or weak NOI

## Terminal Value Sensitivity

Terminal value typically represents 50–70% of total NPV in a 5-year hold.
Always show terminal value as % of total value to flag over-reliance.

| Exit Cap Spread vs Entry | Risk Profile |
|---|---|
| −25bps (compression) | Aggressive — requires strong market thesis |
| 0bps (flat) | Moderate — stable market assumption |
| +25bps | Conservative base case |
| +50bps | Stress test |
| +100bps | Recession scenario |
