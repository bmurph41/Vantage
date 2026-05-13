# Beta Mock Test — Validation Report
> Task #398 | Generated: 2026-05-13T11:42:36.166Z
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
| 0 | 935 | 631 | 1588 | 528 | 768 | **4450** |
| 1 | 870 | 565 | 1540 | 498 | 801 | **4274** |
| 2 | 861 | 580 | 1501 | 490 | 760 | **4192** |
| 3 | 893 | 563 | 1512 | 491 | 723 | **4182** |
| 4 | 888 | 583 | 1523 | 494 | 719 | **4207** |
| 5 | 898 | 567 | 1476 | 489 | 733 | **4163** |
| 6 | 884 | 561 | 1540 | 509 | 730 | **4224** |
| 7 | 866 | 589 | 1538 | 505 | 719 | **4217** |
| 8 | 864 | 581 | 1609 | 495 | 720 | **4269** |
| 9 | 867 | 562 | 1532 | 490 | 781 | **4232** |

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

`XIRR` (= `irr` = `leveredIrr`) is computed via `calculateXIRR()` with actual dated cash flows
(`shared/finance/xirr.ts`). `totalDebt=0` in all runs — see note above.

| Run | XIRR | Levered IRR | Unlevered IRR | NPV | Eq. Mult. | DCF totalDebt | MC p50 | MC seed | WF LP/GP IRR | Exit Scenarios |
|-----|------|-------------|---------------|-----|-----------|---------------|--------|---------|--------------|---------------|
| 0 | 14.8934% | 14.8934% | 14.8934% | 4869076.6690 | 3.0334× | 0 | 14.8475% | 42 | 28.7518%/14.2788% | 3 |
| 1 | 14.8934% | 14.8934% | 14.8934% | 4869076.6690 | 3.0334× | 0 | 14.8475% | 42 | 28.7518%/14.2788% | 3 |
| 2 | 14.8934% | 14.8934% | 14.8934% | 4869076.6690 | 3.0334× | 0 | 14.8475% | 42 | 28.7518%/14.2788% | 3 |
| 3 | 14.8934% | 14.8934% | 14.8934% | 4869076.6690 | 3.0334× | 0 | 14.8475% | 42 | 28.7518%/14.2788% | 3 |
| 4 | 14.8934% | 14.8934% | 14.8934% | 4869076.6690 | 3.0334× | 0 | 14.8475% | 42 | 28.7518%/14.2788% | 3 |
| 5 | 14.8934% | 14.8934% | 14.8934% | 4869076.6690 | 3.0334× | 0 | 14.8475% | 42 | 28.7518%/14.2788% | 3 |
| 6 | 14.8934% | 14.8934% | 14.8934% | 4869076.6690 | 3.0334× | 0 | 14.8475% | 42 | 28.7518%/14.2788% | 3 |
| 7 | 14.8934% | 14.8934% | 14.8934% | 4869076.6690 | 3.0334× | 0 | 14.8475% | 42 | 28.7518%/14.2788% | 3 |
| 8 | 14.8934% | 14.8934% | 14.8934% | 4869076.6690 | 3.0334× | 0 | 14.8475% | 42 | 28.7518%/14.2788% | 3 |
| 9 | 14.8934% | 14.8934% | 14.8934% | 4869076.6690 | 3.0334× | 0 | 14.8475% | 42 | 28.7518%/14.2788% | 3 |

---

## Run-0 Baseline Snapshot

| Metric | Value |
|--------|-------|
| XIRR / Levered IRR (`calculateXIRR`) | **14.8934%** |
| Levered IRR | 14.8934% |
| Unlevered IRR | 14.8934% |
| DCF totalDebt (existing production behaviour) | 0 |
| DCF equityInvested | 12500000 |
| NPV (10% discount rate) | 4869076.6690 |
| Equity Multiple | 3.0334× |
| MC p10 (seed=42) | 13.2030% |
| MC p50 (seed=42) | 14.8475% |
| MC p90 (seed=42) | 16.4037% |
| MC mean (seed=42) | 14.8274% |
| MC seed confirmed in response | 42 |
| Waterfall LP IRR | 28.7518% |
| Waterfall GP IRR | 14.2788% |
| Waterfall LP Multiple | 6.1183× |
| Waterfall GP Multiple | 1.9000× |
| Exit scenario count per run | 3 |
| Decision Support Enabled | true |
| Decision Support Entitled | true |

---

## Exit Scenario Set (3 calls per run)

| # | scenarioType | name | holdingPeriodYears | exitCapRate | brokerCommissionRate |
|---|-------------|------|-------------------|-------------|----------------------|
| 1 | cash_sale | Base Sale – Year 10 | 10 | 0.0675 | 0.03 |
| 2 | exchange_1031 | 1031 Exchange – Year 10 | 10 | 0.0675 | 0.03 |
| 3 | dst_investment | DST Investment – Year 10 | 10 | 0.0675 | 0.03 |

Results collected into an array → `exit-scenarios.json` per run.

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
| Scenario Exit Cap Rate | 6.75% |
| Revenue Growth | 3.5% / yr |
| Expense Growth | 2.5% / yr |
| Capital Stack (DB only) | $8,125,000 @ 6.5% IO (blendedDebtRate=0.065 decimal) |
| LP / GP Equity | $3,937,500 / $437,500 |
| Waterfall Structure | 8% pref, 20% GP catch-up, 4-tier promote |
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
