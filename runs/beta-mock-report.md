# Beta Mock Test — Validation Report
> Task #398 | Generated: 2026-05-13T11:02:39Z
> Fixture: `tests/fixtures/beta-deal-marina.json`
> Pipeline: 5 model steps × 10 runs = 50 cells

## Overall Result

**50/50 cells passed (100%) | Determinism: ✅ CONFIRMED | Financial divergences: 0**

---

## 10 × 5 Pass/Fail Matrix

| Run | dcf | monte-carlo | exit-scenarios | waterfall | decision-support |
|-----|-----|-------------|----------------|-----------|------------------|
| 0 | PASS | PASS | PASS | PASS | PASS |
| 1 | PASS | PASS | PASS | PASS | PASS |
| 2 | PASS | PASS | PASS | PASS | PASS |
| 3 | PASS | PASS | PASS | PASS | PASS |
| 4 | PASS | PASS | PASS | PASS | PASS |
| 5 | PASS | PASS | PASS | PASS | PASS |
| 6 | PASS | PASS | PASS | PASS | PASS |
| 7 | PASS | PASS | PASS | PASS | PASS |
| 8 | PASS | PASS | PASS | PASS | PASS |
| 9 | PASS | PASS | PASS | PASS | PASS |

---

## Determinism Check (run-1..9 vs run-0 baseline, ε = 1e-9)

_Non-financial metadata fields (timestamps, IDs, `computeTimeMs`) are excluded from comparison._

| Step | Financial Numeric Determinism |
|------|-----------------------------|
| dcf | ✅ IDENTICAL |
| monte-carlo | ✅ IDENTICAL |
| exit-scenarios | ✅ IDENTICAL |
| waterfall | ✅ IDENTICAL |
| decision-support | ✅ IDENTICAL |

### Divergence Details

_None — all 10 runs produced numerically identical outputs (ε = 1e-9, non-financial metadata fields excluded)._

---

## Per-Run Metrics Snapshot

| Run | IRR | NPV | Eq. Multiple | MC p50 | MC p10–p90 | WF LP/GP IRR | WF LP/GP Multiple | DS Enabled |
|-----|-----|-----|--------------|--------|------------|--------------|-------------------|------------|
| 0 | 14.8934% | $4,869,076.67 | 3.0334× | 14.8475% | 13.2030–16.4037% | 28.7518% / 14.2788% | 6.1183× / 1.9000× | True |
| 1 | 14.8934% | $4,869,076.67 | 3.0334× | 14.8475% | 13.2030–16.4037% | 28.7518% / 14.2788% | 6.1183× / 1.9000× | True |
| 2 | 14.8934% | $4,869,076.67 | 3.0334× | 14.8475% | 13.2030–16.4037% | 28.7518% / 14.2788% | 6.1183× / 1.9000× | True |
| 3 | 14.8934% | $4,869,076.67 | 3.0334× | 14.8475% | 13.2030–16.4037% | 28.7518% / 14.2788% | 6.1183× / 1.9000× | True |
| 4 | 14.8934% | $4,869,076.67 | 3.0334× | 14.8475% | 13.2030–16.4037% | 28.7518% / 14.2788% | 6.1183× / 1.9000× | True |
| 5 | 14.8934% | $4,869,076.67 | 3.0334× | 14.8475% | 13.2030–16.4037% | 28.7518% / 14.2788% | 6.1183× / 1.9000× | True |
| 6 | 14.8934% | $4,869,076.67 | 3.0334× | 14.8475% | 13.2030–16.4037% | 28.7518% / 14.2788% | 6.1183× / 1.9000× | True |
| 7 | 14.8934% | $4,869,076.67 | 3.0334× | 14.8475% | 13.2030–16.4037% | 28.7518% / 14.2788% | 6.1183× / 1.9000× | True |
| 8 | 14.8934% | $4,869,076.67 | 3.0334× | 14.8475% | 13.2030–16.4037% | 28.7518% / 14.2788% | 6.1183× / 1.9000× | True |
| 9 | 14.8934% | $4,869,076.67 | 3.0334× | 14.8475% | 13.2030–16.4037% | 28.7518% / 14.2788% | 6.1183× / 1.9000× | True |

---

## Run-0 Baseline Snapshot

| Metric | Value |
|--------|-------|
| DCF IRR (levered) | 14.8934% |
| DCF NPV | $4,869,076.67 |
| DCF Exit Value | $25,431,591.69 |
| DCF Equity Multiple | 3.0334× |
| DCF Year-1 NOI | $1,103,440.00 |
| MC IRR p50 (seed=42) | 14.8475% |
| MC IRR p10 (seed=42) | 13.2030% |
| MC IRR p90 (seed=42) | 16.4037% |
| Waterfall LP IRR | 28.7518% |
| Waterfall GP IRR | 14.2788% |
| Waterfall LP Multiple | 6.1183× |
| Waterfall GP Multiple | 1.9000× |
| Decision Support Enabled | True |
| Decision Support Entitled | True |

---

## Fixture Summary

| Parameter | Value |
|-----------|-------|
| Property | Harborview Marina – Beta Test Fixture |
| Location | Annapolis, MD |
| Asset Class | marina |
| Purchase Price | $12,500,000 |
| Total Slips | 220 |
| Slip Mix | 55×30ft wet, 42×40ft wet, 28×50ft wet, 5×80ft mega-yacht, 45 dry stack indoor, 30 dry stack outdoor, 15 transient |
| Hold Period | 10 years |
| Exit Cap Rate (fixture) | 6.75% |
| Revenue Growth | 3.5% / yr |
| Expense Growth | 2.5% / yr |
| Debt (65% LTV) | $8,125,000 @ 6.5% |
| LP Equity | $3,937,500 (90% of $4,375,000) |
| GP Equity | $437,500 (10% of $4,375,000) |
| Monte Carlo N | 500 |
| Monte Carlo Seed | 42 (fixed for determinism) |
| Hurdle IRR | 12% |
| Discount Rate | 10% |
| Waterfall Structure | 8% preferred, 20% GP catch-up, 4-tier promote |

---

## Pipeline Specification

| Step | Method | Route |
|------|--------|-------|
| Setup: create project | POST | `/api/modeling/projects` |
| Setup: create scenario | POST | `/api/modeling/projects/:id/scenarios` |
| Setup: patch config | PATCH | `/api/modeling/projects/:id/config` |
| **1. DCF** | POST | `/api/modeling/projects/:id/dcf` |
| **2. Monte Carlo** | POST | `/api/modeling/projects/:id/dcf/monte-carlo` |
| **3. Exit Scenarios** | POST | `/api/modeling/projects/:id/exit/scenarios` |
| **4. Waterfall** | POST | `/api/modeling/projects/:id/waterfall` |
| **5. Decision Support** | GET | `/api/modeling/projects/:id/dcf/decision-support` |
| Cleanup: delete project | DELETE | `/api/modeling/projects/:id` |

---

## Environment

| Key | Value |
|-----|-------|
| Base URL | http://localhost:5000 |
| Org ID | cd3719c3-ef82-4ccc-acb9-261c80fb64b4 |
| Determinism ε | 1e-09 |
| Total Runs | 10 |
| Model Steps per Run | 5 |
| Auth | ALLOW_DEMO_AUTH (auto-resolves to demo user) |
| x-org-id header | Sent on every request |
| Project cleanup | DELETE performed after every run |
