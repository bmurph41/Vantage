# Beta Mock Test — Validation Report
> Task #398 | Generated: 2026-05-13T11:55:46.086Z
> Fixture: `tests/fixtures/beta-deal-marina.json`
> Auth: `ALLOW_DEMO_AUTH=true` — Express `authenticateUser` auto-resolves all requests → org cd3719c3-ef82-4ccc-acb9-261c80fb64b4; `x-org-id` on every call.
> Pipeline: 5 model steps × 10 runs = 50 cells

## Overall Result

**50/50 cells passed | Determinism: ✅ CONFIRMED | Financial divergences: 0**

**Note — capital stack and totalDebt:**  
The setup step creates a capital stack in the DB. However, the current production code in
`loadCapitalStackData()` does not include `totalDebt` or `blendedDebtRate` in its returned
object, so all DCF responses show `totalDebt=0`. This is **existing production behaviour** and
was **not modified** by this test script. XIRR/NPV reported here are therefore the unlevered figures.

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

## Wall-Clock Time per Layer per Run (ms)

| Run | dcf | monte-carlo | exit-scenarios | waterfall | decision-support | total |
|-----|-----|-------------|----------------|-----------|------------------|-------|
| 0 | 855 | 593 | 2016 | 530 | 724 | **4718** |
| 1 | 849 | 569 | 2029 | 497 | 699 | **4643** |
| 2 | 853 | 570 | 2053 | 503 | 728 | **4707** |
| 3 | 863 | 573 | 2031 | 498 | 704 | **4669** |
| 4 | 819 | 565 | 2016 | 497 | 695 | **4592** |
| 5 | 809 | 612 | 2016 | 491 | 706 | **4634** |
| 6 | 861 | 561 | 2023 | 503 | 698 | **4646** |
| 7 | 807 | 569 | 2069 | 504 | 708 | **4657** |
| 8 | 841 | 572 | 2087 | 489 | 734 | **4723** |
| 9 | 859 | 569 | 2045 | 493 | 744 | **4710** |

---

## Determinism Check (runs 1–9 vs run-0 baseline, ε = 1e-9)

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

## Monte Carlo — Seeded RNG Verification

`dcf-simulation-service.ts` line 119: `const seed = request.seed ?? Date.now();`
- **seed=42 supplied** (this test): seeded PRNG — bit-identical p10/p50/p90 across all 10 runs.
- **seed omitted**: `Date.now()` becomes the seed — different each run (non-deterministic).

| Run | seed (from response) | p10 IRR | p50 IRR | p90 IRR |
|-----|----------------------|---------|---------|---------|
| 0 | 42 | 26.3396% | 28.1528% | 29.8389% |
| 1 | 42 | 26.3396% | 28.1528% | 29.8389% |
| 2 | 42 | 26.3396% | 28.1528% | 29.8389% |
| 3 | 42 | 26.3396% | 28.1528% | 29.8389% |
| 4 | 42 | 26.3396% | 28.1528% | 29.8389% |
| 5 | 42 | 26.3396% | 28.1528% | 29.8389% |
| 6 | 42 | 26.3396% | 28.1528% | 29.8389% |
| 7 | 42 | 26.3396% | 28.1528% | 29.8389% |
| 8 | 42 | 26.3396% | 28.1528% | 29.8389% |
| 9 | 42 | 26.3396% | 28.1528% | 29.8389% |

---

## Per-Run Metrics Snapshot

`XIRR` (= `irr` = `leveredIrr`) is computed via `calculateXIRR()` with actual dated cash flows
(`shared/finance/xirr.ts`). `totalDebt=0` in all runs — see note above.

| Run | XIRR | Levered IRR | Unlevered IRR | NPV | Eq. Mult. | DCF totalDebt | MC p50 | MC seed | WF LP/GP IRR | Exit Scenarios |
|-----|------|-------------|---------------|-----|-----------|---------------|--------|---------|--------------|---------------|
| 0 | 21.0027% | 21.0027% | 21.0027% | 11846515.1161 | 4.1603× | 0 | 28.1528% | 42 | 28.7518%/14.2788% | 4 |
| 1 | 21.0027% | 21.0027% | 21.0027% | 11846515.1161 | 4.1603× | 0 | 28.1528% | 42 | 28.7518%/14.2788% | 4 |
| 2 | 21.0027% | 21.0027% | 21.0027% | 11846515.1161 | 4.1603× | 0 | 28.1528% | 42 | 28.7518%/14.2788% | 4 |
| 3 | 21.0027% | 21.0027% | 21.0027% | 11846515.1161 | 4.1603× | 0 | 28.1528% | 42 | 28.7518%/14.2788% | 4 |
| 4 | 21.0027% | 21.0027% | 21.0027% | 11846515.1161 | 4.1603× | 0 | 28.1528% | 42 | 28.7518%/14.2788% | 4 |
| 5 | 21.0027% | 21.0027% | 21.0027% | 11846515.1161 | 4.1603× | 0 | 28.1528% | 42 | 28.7518%/14.2788% | 4 |
| 6 | 21.0027% | 21.0027% | 21.0027% | 11846515.1161 | 4.1603× | 0 | 28.1528% | 42 | 28.7518%/14.2788% | 4 |
| 7 | 21.0027% | 21.0027% | 21.0027% | 11846515.1161 | 4.1603× | 0 | 28.1528% | 42 | 28.7518%/14.2788% | 4 |
| 8 | 21.0027% | 21.0027% | 21.0027% | 11846515.1161 | 4.1603× | 0 | 28.1528% | 42 | 28.7518%/14.2788% | 4 |
| 9 | 21.0027% | 21.0027% | 21.0027% | 11846515.1161 | 4.1603× | 0 | 28.1528% | 42 | 28.7518%/14.2788% | 4 |

---

## Run-0 Baseline Snapshot

| Metric | Value |
|--------|-------|
| XIRR / Levered IRR (`calculateXIRR`) | **21.0027%** |
| Levered IRR | 21.0027% |
| Unlevered IRR | 21.0027% |
| DCF totalDebt (existing production behaviour) | 0 |
| DCF equityInvested | 12500000 |
| NPV (10% discount rate) | 11846515.1161 |
| Equity Multiple | 4.1603× |
| MC p10 (seed=42) | 26.3396% |
| MC p50 (seed=42) | 28.1528% |
| MC p90 (seed=42) | 29.8389% |
| MC mean (seed=42) | 28.1305% |
| MC seed confirmed in response | 42 |
| Waterfall LP IRR | 28.7518% |
| Waterfall GP IRR | 14.2788% |
| Waterfall LP Multiple | 6.1183× |
| Waterfall GP Multiple | 1.9000× |
| Exit scenario count per run | 4 |
| Decision Support Enabled | true |
| Decision Support Entitled | true |

---

## Exit Scenario Set (4 calls per run)

As specified in Task #398: 1031, DST, Waterfall, Net Proceeds.

| # | scenarioType | name | exitCapRate | brokerCommissionRate |
|---|-------------|------|-------------|----------------------|
| 1 | cash_sale | Net Proceeds – Year 10 | 0.075 | 0.03 |
| 2 | exchange_1031 | 1031 Exchange – Year 10 | 0.075 | 0.03 |
| 3 | dst_investment | DST Investment – Year 10 | 0.075 | 0.03 |
| 4 | hybrid | Waterfall Exit – Year 10 | 0.075 | 0.03 |

Results collected into an array → `exit-scenarios.json` per run.

---

## Fixture Summary

Canonical parameters as specified in Task #398:

| Parameter | Canonical Value |
|-----------|----------------|
| Property | Beta Mock Marina |
| Location | Annapolis, MD |
| Asset Class | marina |
| Purchase Price | $12,500,000 |
| Total Slips | 220 — 80 wet / 100 covered / 40 dry |
| Avg Slip Rate | $850/mo |
| Ancillary Income | $1,250,000/yr |
| OpEx | 38% of revenue |
| Going-In Cap Rate | 7.0% |
| Exit Cap Rate | 7.5% |
| Hold Period | 10 years |
| Revenue Growth | 3.5% / yr |
| Expense Growth | 2.5% / yr |
| Debt | 65% LTV = $8,125,000 @ 6.25% / 25yr amort / 2yr IO |
| blendedDebtRate | 0.0625 (decimal = 6.25%) |
| Equity | 35% = $4,375,000 (LP 90% / GP 10%) |
| LP Contribution | $3,937,500 |
| GP Contribution | $437,500 |
| Waterfall | 8% pref, 20% GP catch-up, 4-tier promote |
| MC N | 500 |
| MC Seed | 42 → `request.seed ?? Date.now()` — deterministic path |
| Hurdle IRR | 12% |
| Discount Rate | 10% |

---

## Pipeline Specification

| Step | Method | Route | Matrix | Notes |
|------|--------|-------|--------|-------|
| Create project | POST | `/api/modeling/projects` | No (setup) | Fatal on failure |
| Capital stack | POST | `/api/modeling/projects/:id/capital-stacks` | No (setup) | Non-fatal; logged |
| Scenario | POST | `/api/modeling/projects/:id/scenarios` | No (setup) | Non-fatal; logged |
| Config | PATCH | `/api/modeling/projects/:id/config` | No (setup) | Non-fatal; logged |
| **1. DCF** | POST | `/api/modeling/projects/:id/dcf` | **Yes** | XIRR = `irr` = `leveredIrr` |
| **2. Monte Carlo** | POST | `/api/modeling/projects/:id/dcf/monte-carlo` | **Yes** | seed=42 |
| **3. Exit Scenarios** | POST ×3 | `/api/modeling/projects/:id/exit/scenarios` | **Yes** | cash_sale, exchange_1031, dst_investment |
| **4. Waterfall** | POST | `/api/modeling/projects/:id/waterfall` | **Yes** | 4-tier promote |
| **5. Decision Support** | GET | `/api/modeling/projects/:id/dcf/decision-support` | **Yes** | |
| Cleanup | DELETE | `/api/modeling/projects/:id` | No | Non-fatal |

---

## Environment

| Key | Value |
|-----|-------|
| Base URL | http://localhost:5000 |
| Org ID | cd3719c3-ef82-4ccc-acb9-261c80fb64b4 |
| Auth model | `ALLOW_DEMO_AUTH=true` — preflight via `GET /api/auth/me` |
| Scope | Test harness only — zero production service/route modifications |
| Determinism ε | 1e-9 |
| METADATA_FIELDS excluded | capitalStackId, computeTimeMs, createdAt, createdBy, durationMs, elapsed, generatedAt, id, modelingProjectId, orgId, projectId, requestId, scenarioId, timestamp, updatedAt, updatedBy, userId |
| Total runs | 10 |
| Steps per run | 5 |
| Total cells | 50 |
