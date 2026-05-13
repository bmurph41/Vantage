# Beta Mock Test — Validation Report
> Task #398 | Generated: 2026-05-13T11:36:24.436Z
> Fixture: `tests/fixtures/beta-deal-marina.json`
> Auth: `ALLOW_DEMO_AUTH=true` — Express `authenticateUser` auto-resolves unauthenticated requests → demo org cd3719c3-ef82-4ccc-acb9-261c80fb64b4; `x-org-id` sent on every call.
> Pipeline: 5 model steps × 10 runs = 50 cells

## Overall Result

**50/50 cells passed | Determinism: ✅ CONFIRMED | Financial divergences: 0**

**Note on capital stack and totalDebt:** The setup step creates a capital stack in the DB
(`POST /api/modeling/projects/:id/capital-stacks`), but the current production code in
`loadCapitalStackData` does not return `totalDebt` or `blendedDebtRate` in its object.
As a result, all DCF responses show `totalDebt=0` — this is existing production behavior
and was not modified by this test script.  The XIRR reported is therefore the unlevered IRR.

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
| 0 | 934 | 586 | 1516 | 498 | 768 | 4302 |
| 1 | 897 | 581 | 1496 | 495 | 748 | 4217 |
| 2 | 869 | 573 | 1517 | 494 | 739 | 4192 |
| 3 | 852 | 597 | 1506 | 487 | 748 | 4190 |
| 4 | 906 | 566 | 1546 | 627 | 740 | 4385 |
| 5 | 913 | 591 | 1482 | 487 | 720 | 4193 |
| 6 | 847 | 564 | 1672 | 492 | 721 | 4296 |
| 7 | 886 | 558 | 1481 | 521 | 748 | 4194 |
| 8 | 866 | 589 | 1508 | 491 | 728 | 4182 |
| 9 | 875 | 569 | 1503 | 522 | 773 | 4242 |

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

Requests include `"seed": 42` in the POST body.
Implementation: `dcf-simulation-service.ts` line 119: `const seed = request.seed ?? Date.now();`
- **With `seed=42`** (this test): seeded PRNG → bit-identical p10/p50/p90 across all runs.
- **Without seed**: `Date.now()` is used → non-deterministic (different each run).

| Run | seed (response) | p10 IRR | p50 IRR | p90 IRR |
|-----|----------------|---------|---------|---------|
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

`XIRR` (= `irr` = `leveredIrr`) is computed via `calculateXIRR()` with actual dated
cash flows (`shared/finance/xirr.ts`).  `totalDebt=0` in all runs — see note above.

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
| XIRR / Levered IRR (`calculateXIRR`) | 14.8934% |
| Unlevered IRR | 14.8934% |
| DCF totalDebt (production behavior) | 0 |
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
| Exit scenario count | 3 |
| Decision Support Enabled | true |
| Decision Support Entitled | true |

---

## Exit Scenario Set

Each run posts three exit scenario types to `POST /api/modeling/projects/:id/exit/scenarios`:

| Scenario Type | Name | Exit Year | Exit Cap Rate | Selling Cost |
|---------------|------|-----------|---------------|--------------|
| cash_sale | Base Sale – Year 10 | 10 | 6.75% | 3.0% |
| exchange_1031 | 1031 Exchange – Year 10 | 10 | 6.75% | 3.0% |
| dst_investment | DST Investment – Year 10 | 10 | 6.75% | 3.0% |

Results are collected into an array and saved as `exit-scenarios.json` per run.

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
| Capital Stack (DB only) | $8,125,000 totalDebt @ 6.5% IO (blendedDebtRate=0.065 decimal) |
| LP Equity | $3,937,500 (90%) |
| GP Equity | $437,500 (10%) |
| Waterfall | 8% pref, 20% GP catch-up, 4-tier promote |
| MC N | 500 |
| MC Seed | 42 → `request.seed ?? Date.now()` — deterministic path |
| Hurdle IRR | 12% |
| Discount Rate | 10% |

---

## Pipeline Specification

| Step | Method | Route | Matrix | Notes |
|------|--------|-------|--------|-------|
| Create project | POST | `/api/modeling/projects` | No (setup) | Fatal if fails |
| Capital stack | POST | `/api/modeling/projects/:id/capital-stacks` | No (setup) | Non-fatal; logged |
| Scenario | POST | `/api/modeling/projects/:id/scenarios` | No (setup) | Non-fatal; logged |
| Config | PATCH | `/api/modeling/projects/:id/config` | No (setup) | Non-fatal; logged |
| **1. DCF** | POST | `/api/modeling/projects/:id/dcf` | **Yes** | XIRR = irr |
| **2. Monte Carlo** | POST | `/api/modeling/projects/:id/dcf/monte-carlo` | **Yes** | seed=42 |
| **3. Exit Scenarios** | POST ×3 | `/api/modeling/projects/:id/exit/scenarios` | **Yes** | cash_sale, exchange_1031, dst_investment |
| **4. Waterfall** | POST | `/api/modeling/projects/:id/waterfall` | **Yes** | 4-tier promote |
| **5. Decision Support** | GET | `/api/modeling/projects/:id/dcf/decision-support` | **Yes** | Fast mode |
| Cleanup | DELETE | `/api/modeling/projects/:id` | No | Non-fatal |

---

## Environment

| Key | Value |
|-----|-------|
| Base URL | http://localhost:5000 |
| Org ID | cd3719c3-ef82-4ccc-acb9-261c80fb64b4 |
| Auth model | `ALLOW_DEMO_AUTH=true` |
| Scope | Test harness only — zero production service/route modifications |
| Determinism ε | 1e-9 |
| METADATA_FIELDS excluded | capitalStackId, computeTimeMs, createdAt, createdBy, durationMs, elapsed, generatedAt, id, modelingProjectId, orgId, projectId, requestId, scenarioId, timestamp, updatedAt, updatedBy, userId |
| Runs | 10 |
| Steps | 5 |
| Total cells | 50 |
