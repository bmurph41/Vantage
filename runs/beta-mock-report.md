# Beta Mock Test — Validation Report
> Task #398 | Generated: 2026-05-13T11:26:33.950400Z
> Fixture: `tests/fixtures/beta-deal-marina.json`
> Auth: ALLOW_DEMO_AUTH=true (Express middleware auto-resolves unauthenticated requests → demo user; `x-org-id` sent on every request)
> Pipeline: 5 model steps × 10 runs = 50 cells

## Overall Result

**50/50 cells passed | Determinism: ✅ CONFIRMED | Financial divergences: 0**

Capital stack applied: 65% LTV ($8,125,000 @ 6.5% IO) — `totalDebt=8125000` confirmed in all DCF responses.  
XIRR = levered IRR computed via `calculateXIRR()` with actual dated cash flows (`shared/finance/xirr.ts`).

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

## Wall-Clock Time per Layer per Run (milliseconds)

| Run | dcf (ms) | monte-carlo (ms) | exit-scenarios (ms) | waterfall (ms) | decision-support (ms) | total (ms) |
|-----|----------|------------------|---------------------|----------------|-----------------------|------------|
| 0 | 1001 | 706 | 590 | 608 | 820 | **3725** |
| 1 | 1007 | 677 | 606 | 624 | 862 | **3776** |
| 2 | 993 | 737 | 604 | 603 | 875 | **3812** |
| 3 | 1023 | 660 | 604 | 603 | 835 | **3725** |
| 4 | 999 | 673 | 607 | 610 | 827 | **3716** |
| 5 | 980 | 677 | 601 | 600 | 834 | **3692** |
| 6 | 969 | 705 | 617 | 604 | 867 | **3762** |
| 7 | 978 | 682 | 634 | 598 | 830 | **3722** |
| 8 | 982 | 684 | 611 | 650 | 858 | **3785** |
| 9 | 980 | 676 | 627 | 601 | 854 | **3738** |

---

## Determinism Check (run-1..9 vs run-0 baseline, ε = 1e-9)

_Excluded from comparison: capitalStackId, computeTimeMs, createdAt, createdBy, durationMs, elapsed, generatedAt, id, modelingProjectId, orgId, projectId, requestId, scenarioId, timestamp, updatedAt, updatedBy, userId._

| Step | Financial Numeric Determinism |
|------|-----------------------------|
| dcf | ✅ IDENTICAL |
| monte-carlo | ✅ IDENTICAL |
| exit-scenarios | ✅ IDENTICAL |
| waterfall | ✅ IDENTICAL |
| decision-support | ✅ IDENTICAL |

### Divergence Details

_None — all 10 runs produced numerically identical financial outputs (ε = 1e-9)._

---

## Monte Carlo Seeded RNG Verification

Monte Carlo requests include `"seed": 42` in the POST body.  
The MC route passes `body.seed` to `runMonteCarlo()` which activates the seeded PRNG branch.  
When `seed` is omitted, `Math.random()` is used (non-deterministic). With `seed=42`, outputs are bit-identical.  
Seed confirmed in every run response (`seed` field in JSON):

| Run | seed (from response) | p10 IRR | p50 IRR | p90 IRR |
|-----|----------------------|---------|---------|---------|
| 0 | 42 | 13.2030% | 14.8475% | 16.4037% |
| 1 | 42 | 13.2030% | 14.8475% | 16.4037% |
| 2 | 42 | 13.2030% | 14.8475% | 16.4037% |
| 3 | 42 | 13.2030% | 14.8475% | 16.4037% |
| 4 | 42 | 13.2030% | 14.8475% | 16.4037% |
| 5 | 42 | 13.2030% | 14.8475% | 16.4037% |
| 6 | 42 | 13.2030% | 14.8475% | 16.4037% |
| 7 | 42 | 13.2030% | 14.8475% | 16.4037% |
| 8 | 42 | 13.2030% | 14.8475% | 16.4037% |
| 9 | 42 | 13.2030% | 14.8475% | 16.4037% |

---

## Per-Run Metrics Snapshot

`XIRR` = levered IRR computed via `calculateXIRR()` (DCF response field: `irr` = `leveredIrr`).  
All 10 runs byte-identical on financial fields (ε = 1e-9).

| Run | XIRR | Levered IRR | Unlevered IRR | NPV | Eq. Mult. | MC p50 | MC p10–p90 | MC seed | WF LP/GP IRR | WF LP Mult. | DS Enabled |
|-----|------|-------------|---------------|-----|-----------|--------|------------|---------|--------------|-------------|-----------|
| 0 | 24.5234% | 24.5234% | 14.8934% | $6,616,945.26 | 5.6026× | 14.8475% | 13.2030%–16.4037% | 42 | 28.7518%/14.2788% | 6.1183× | True |
| 1 | 24.5234% | 24.5234% | 14.8934% | $6,616,945.26 | 5.6026× | 14.8475% | 13.2030%–16.4037% | 42 | 28.7518%/14.2788% | 6.1183× | True |
| 2 | 24.5234% | 24.5234% | 14.8934% | $6,616,945.26 | 5.6026× | 14.8475% | 13.2030%–16.4037% | 42 | 28.7518%/14.2788% | 6.1183× | True |
| 3 | 24.5234% | 24.5234% | 14.8934% | $6,616,945.26 | 5.6026× | 14.8475% | 13.2030%–16.4037% | 42 | 28.7518%/14.2788% | 6.1183× | True |
| 4 | 24.5234% | 24.5234% | 14.8934% | $6,616,945.26 | 5.6026× | 14.8475% | 13.2030%–16.4037% | 42 | 28.7518%/14.2788% | 6.1183× | True |
| 5 | 24.5234% | 24.5234% | 14.8934% | $6,616,945.26 | 5.6026× | 14.8475% | 13.2030%–16.4037% | 42 | 28.7518%/14.2788% | 6.1183× | True |
| 6 | 24.5234% | 24.5234% | 14.8934% | $6,616,945.26 | 5.6026× | 14.8475% | 13.2030%–16.4037% | 42 | 28.7518%/14.2788% | 6.1183× | True |
| 7 | 24.5234% | 24.5234% | 14.8934% | $6,616,945.26 | 5.6026× | 14.8475% | 13.2030%–16.4037% | 42 | 28.7518%/14.2788% | 6.1183× | True |
| 8 | 24.5234% | 24.5234% | 14.8934% | $6,616,945.26 | 5.6026× | 14.8475% | 13.2030%–16.4037% | 42 | 28.7518%/14.2788% | 6.1183× | True |
| 9 | 24.5234% | 24.5234% | 14.8934% | $6,616,945.26 | 5.6026× | 14.8475% | 13.2030%–16.4037% | 42 | 28.7518%/14.2788% | 6.1183× | True |

---

## Run-0 Baseline Snapshot

| Metric | Value |
|--------|-------|
| **XIRR (levered, `calculateXIRR`)** | **24.523446%** |
| Levered IRR | 24.523446% |
| Unlevered IRR | 14.893400% |
| Total Debt (capital stack applied) | $8,125,000 |
| Equity Invested | $4,375,000 |
| NPV (10% discount rate) | $6,616,945.26 |
| Exit Value | $25,431,592 |
| Equity Multiple | 5.6026× |
| MC p10 (seed=42) | 13.2030% |
| MC p50 (seed=42) | 14.8475% |
| MC p90 (seed=42) | 16.4037% |
| MC mean (seed=42) | 14.8274% |
| MC seed confirmed | 42 |
| Waterfall LP IRR | 28.7518% |
| Waterfall GP IRR | 14.2788% |
| Waterfall LP Multiple | 6.1183× |
| Waterfall GP Multiple | 1.9000× |
| Decision Support Enabled | True |
| Decision Support Entitled | True |

---

## Capital Stack Verification

| Field | Fixture Value | DCF Response Value | Confirmed |
|-------|---------------|--------------------|-----------|
| purchasePrice | $12,500,000 | $12,500,000 | ✅ |
| totalDebt (65% LTV) | $8,125,000 | $8,125,000 | ✅ |
| equityInvested | $4,375,000 | $4,375,000 | ✅ |
| blendedDebtRate | 6.5% (0.065 decimal) | calculated annualDS=$528,125/yr | ✅ |
| holdPeriodYears | 10 | 10 | ✅ |

---

## Fixture Summary

| Parameter | Value |
|-----------|-------|
| Property | Harborview Marina – Beta Test Fixture |
| Location | Annapolis, MD |
| Asset Class | marina |
| Purchase Price | $12,500,000 |
| Total Slips | 220 (55×30ft wet, 42×40ft wet, 28×50ft wet, 5×80ft mega, 45 dry stack indoor, 30 dry stack outdoor, 15 transient) |
| Hold Period | 10 years |
| Exit Cap Rate | 6.75% |
| Revenue Growth | 3.5% / yr |
| Expense Growth | 2.5% / yr |
| Debt (65% LTV) | $8,125,000 @ 6.5% IO (blendedDebtRate stored as 0.065 decimal) |
| LP Equity | $3,937,500 (90% of $4,375,000 equity) |
| GP Equity | $437,500 (10% of $4,375,000 equity) |
| Waterfall | 8% pref return, 20% GP catch-up, 4-tier promote |
| Monte Carlo N | 500 |
| Monte Carlo Seed | 42 (seeded PRNG — deterministic) |
| Hurdle IRR | 12% |
| Discount Rate | 10% |

---

## Pipeline Specification

| Step | Method | Route | Matrix |
|------|--------|-------|--------|
| Create project | POST | `/api/modeling/projects` | No (setup) |
| Capital stack (65% LTV) | POST | `/api/modeling/projects/:id/capital-stacks` | No (setup) |
| Scenario (growth/cap) | POST | `/api/modeling/projects/:id/scenarios` | No (setup) |
| Config (hold period) | PATCH | `/api/modeling/projects/:id/config` | No (setup) |
| **1. DCF** | POST | `/api/modeling/projects/:id/dcf` | **Yes** |
| **2. Monte Carlo** | POST | `/api/modeling/projects/:id/dcf/monte-carlo` | **Yes** |
| **3. Exit Scenarios** | POST | `/api/modeling/projects/:id/exit/scenarios` | **Yes** |
| **4. Waterfall** | POST | `/api/modeling/projects/:id/waterfall` | **Yes** |
| **5. Decision Support** | GET | `/api/modeling/projects/:id/dcf/decision-support` | **Yes** |
| Cleanup | DELETE | `/api/modeling/projects/:id` | No (cleanup) |

---

## Environment

| Key | Value |
|-----|-------|
| Base URL | http://localhost:5000 |
| Org ID | cd3719c3-ef82-4ccc-acb9-261c80fb64b4 |
| Auth model | `ALLOW_DEMO_AUTH=true` — Express `authenticateUser` middleware auto-resolves any request (no cookie/token needed); `x-org-id` sent on every request as belt-and-suspenders. Pre-flight `/api/auth/me` verifies resolution. |
| Capital stack bug fixed | `loadCapitalStackData` and `loadCapitalStackQuick` now return `totalDebt` and `blendedDebtRate` (were missing from return value) |
| blendedDebtRate convention | Stored as decimal 0.065 (= 6.5%) — DCF multiplies totalDebt × blendedDebtRate directly |
| Determinism ε | 1e-09 |
| Metadata excluded from comparison | capitalStackId, computeTimeMs, createdAt, createdBy, durationMs, elapsed, generatedAt, id, modelingProjectId, orgId, projectId, requestId, scenarioId, timestamp, updatedAt, updatedBy, userId |
| Runs | 10 |
| Steps per run | 5 |
| Total cells | 50 |
