# Beta Mock Test Report

**Generated**: 2026-05-13 10:40:43 UTC
**Fixture**: `tests/fixtures/beta-deal-marina.json`
**Property**: Sunset Bay Marina – Beta Test Fixture · Sarasota, FL
**Total Runs**: 10 · **Steps per Run**: 5 · **Cells**: 50
**Result**: 50/50 passed (100%) · 🟢 ALL PASS

---

## 1 · Pass / Fail Matrix (10 × 5)

| Run | createProject | dcf          | monteCarlo   | exitScenario | decisionSupport |
|-----|---------------|--------------|--------------|--------------|-----------------|
|   0 |    PASS ✓    |    PASS ✓    |    PASS ✓    |    PASS ✓    |    PASS ✓    |
|   1 |    PASS ✓    |    PASS ✓    |    PASS ✓    |    PASS ✓    |    PASS ✓    |
|   2 |    PASS ✓    |    PASS ✓    |    PASS ✓    |    PASS ✓    |    PASS ✓    |
|   3 |    PASS ✓    |    PASS ✓    |    PASS ✓    |    PASS ✓    |    PASS ✓    |
|   4 |    PASS ✓    |    PASS ✓    |    PASS ✓    |    PASS ✓    |    PASS ✓    |
|   5 |    PASS ✓    |    PASS ✓    |    PASS ✓    |    PASS ✓    |    PASS ✓    |
|   6 |    PASS ✓    |    PASS ✓    |    PASS ✓    |    PASS ✓    |    PASS ✓    |
|   7 |    PASS ✓    |    PASS ✓    |    PASS ✓    |    PASS ✓    |    PASS ✓    |
|   8 |    PASS ✓    |    PASS ✓    |    PASS ✓    |    PASS ✓    |    PASS ✓    |
|   9 |    PASS ✓    |    PASS ✓    |    PASS ✓    |    PASS ✓    |    PASS ✓    |

Legend: PASS ✓ = HTTP 2xx + valid response body · FAIL ✗ = error or missing ID

---

## 2 · Determinism Verification

All seeded steps (DCF, Monte Carlo) produce **byte-for-byte identical numerics** across all 10 runs.
Monte Carlo uses `seed: 42`; Decision Support uses `monteCarloSeed: 42`.

| Metric | Result |
|--------|--------|
| DCF IRR | ✓ deterministic — all 10 runs: `19.618` |
| DCF NPV | ✓ deterministic — all 10 runs: `3714140.27` |
| DCF Exit Value | ✓ deterministic — all 10 runs: `14481882` |
| DCF Year-1 NOI | ✓ deterministic — all 10 runs: `893960` |
| Monte Carlo p50 IRR | ✓ deterministic — all 10 runs: `19.6228` |
| Monte Carlo p10 IRR | ✓ deterministic — all 10 runs: `17.9211` |
| Monte Carlo sim count | ✓ deterministic — all 10 runs: `500` |

---

## 3 · DCF Metrics Across All Runs

| Run | IRR         | NPV               | Exit Value   | Year-1 NOI  | Going-In Cap | Eq. Multiple |
|-----|-------------|-------------------|--------------|-------------|-------------|--------------|
|   0 | 19.6180% |   3,714,140.27 |   14,481,882 |     893,960 | 10.52% | 2.198x |
|   1 | 19.6180% |   3,714,140.27 |   14,481,882 |     893,960 | 10.52% | 2.198x |
|   2 | 19.6180% |   3,714,140.27 |   14,481,882 |     893,960 | 10.52% | 2.198x |
|   3 | 19.6180% |   3,714,140.27 |   14,481,882 |     893,960 | 10.52% | 2.198x |
|   4 | 19.6180% |   3,714,140.27 |   14,481,882 |     893,960 | 10.52% | 2.198x |
|   5 | 19.6180% |   3,714,140.27 |   14,481,882 |     893,960 | 10.52% | 2.198x |
|   6 | 19.6180% |   3,714,140.27 |   14,481,882 |     893,960 | 10.52% | 2.198x |
|   7 | 19.6180% |   3,714,140.27 |   14,481,882 |     893,960 | 10.52% | 2.198x |
|   8 | 19.6180% |   3,714,140.27 |   14,481,882 |     893,960 | 10.52% | 2.198x |
|   9 | 19.6180% |   3,714,140.27 |   14,481,882 |     893,960 | 10.52% | 2.198x |

---

## 4 · Monte Carlo Metrics Across All Runs

_(seed = 42 · n = 500 · hurdle IRR = 12%)_

| Run |    N | Seed |  IRR Mean |    p10 IRR |    p50 IRR |    p90 IRR |    IRR Std | P(IRR<12%) |
|-----|------|------|-----------|------------|------------|------------|------------|------------|
|   0 |   500 |    42 | 19.6020% | 17.9211% | 19.6228% | 21.2259% | 0.0000% | 0.0000 |
|   1 |   500 |    42 | 19.6020% | 17.9211% | 19.6228% | 21.2259% | 0.0000% | 0.0000 |
|   2 |   500 |    42 | 19.6020% | 17.9211% | 19.6228% | 21.2259% | 0.0000% | 0.0000 |
|   3 |   500 |    42 | 19.6020% | 17.9211% | 19.6228% | 21.2259% | 0.0000% | 0.0000 |
|   4 |   500 |    42 | 19.6020% | 17.9211% | 19.6228% | 21.2259% | 0.0000% | 0.0000 |
|   5 |   500 |    42 | 19.6020% | 17.9211% | 19.6228% | 21.2259% | 0.0000% | 0.0000 |
|   6 |   500 |    42 | 19.6020% | 17.9211% | 19.6228% | 21.2259% | 0.0000% | 0.0000 |
|   7 |   500 |    42 | 19.6020% | 17.9211% | 19.6228% | 21.2259% | 0.0000% | 0.0000 |
|   8 |   500 |    42 | 19.6020% | 17.9211% | 19.6228% | 21.2259% | 0.0000% | 0.0000 |
|   9 |   500 |    42 | 19.6020% | 17.9211% | 19.6228% | 21.2259% | 0.0000% | 0.0000 |

---

## 5 · Decision Support Across All Runs

| Run | Enabled | Entitled | MC p50 IRR | Base IRR |
|-----|---------|----------|------------|----------|
|   0 | True | True | 19.6228% | 19.6180% |
|   1 | True | True | 19.6228% | 19.6180% |
|   2 | True | True | 19.6228% | 19.6180% |
|   3 | True | True | 19.6228% | 19.6180% |
|   4 | True | True | 19.6228% | 19.6180% |
|   5 | True | True | 19.6228% | 19.6180% |
|   6 | True | True | 19.6228% | 19.6180% |
|   7 | True | True | 19.6228% | 19.6180% |
|   8 | True | True | 19.6228% | 19.6180% |
|   9 | True | True | 19.6228% | 19.6180% |

---

## 6 · Run-0 Baseline Snapshot

| Field | Value |
|-------|-------|
| Purchase Price | $8,500,000 |
| Asset Class | marina |
| Hold Period | 7 years |
| Acquisition City | Sarasota, FL |
| Year-1 NOI | $893,960 |
| Going-In Cap Rate | 10.52% |
| DCF IRR (unlevered) | 19.62% |
| NPV (@ 10% discount) | $3,714,140 |
| Exit Value | $14,481,882 |
| Equity Multiple | 2.198x |
| MC Mean IRR (seed 42) | 19.60% |
| MC p10 IRR | 17.92% |
| MC p50 IRR | 19.62% |
| MC p90 IRR | 21.23% |
| MC IRR Std Dev | — |
| P(IRR < 12% hurdle) | 0.0% |
| DS Enabled | True |
| DS Entitled | True |

---

## 7 · Created Project IDs

|   0 | `f400ce71-c784-4a05-af4d-c5ea0580fa4d` | marina |
|   1 | `9ca92b7d-665b-4fee-ae6b-221cf2b0049d` | marina |
|   2 | `93ef3c86-956d-405d-b1bc-ae33c611de97` | marina |
|   3 | `3ee7af1e-1ecd-42e1-8db0-33c83b643e44` | marina |
|   4 | `89acc98f-b123-40e8-83cd-524656752908` | marina |
|   5 | `18bbede6-04e8-48c2-9be5-724d1045eddf` | marina |
|   6 | `c769b53f-52e1-47bf-929b-ea4bbe509e1b` | marina |
|   7 | `e086c08c-850c-4d8c-b0f3-96e86bbfcc26` | marina |
|   8 | `7a487b18-db8c-4cd9-9160-1a4bc4f10f05` | marina |
|   9 | `c4199dfb-0fbb-4aa1-ae02-9d6e649725d4` | marina |

---

## 8 · Environment

| Key | Value |
|-----|-------|
| Server | `http://localhost:5000` |
| Auth | ALLOW_DEMO_AUTH — demo user `85c9cd7a` / org `cd3719c3` |
| Monte Carlo seed | 42 (deterministic) |
| Decision Support MC seed | 42 (deterministic) |
| Fixture | `tests/fixtures/beta-deal-marina.json` |
| Script | `scripts/beta-mock-test.ts` |
| Output | `runs/run-{0..9}/` |

---

_End of report_
