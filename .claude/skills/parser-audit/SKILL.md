---
name: parser-audit
description: Run the document-parser benchmark — verifies XLSX/CSV extraction, fullText payload coverage, and (with ANTHROPIC_API_KEY set) Claude's field-level extraction accuracy against hand-labeled fixtures in tests/extraction-fixtures/. Use whenever editing server/services/document-parser/, changing the Claude prompt in claude-extractor.ts, upgrading Claude model versions, or before merging parser-related changes. Also run when the user reports extraction errors or asks to verify P&L/rent-roll parsing accuracy.
argument-hint: [fixture-id-filter]
allowed-tools: Bash(npx tsx:*), Bash(node:*), Read
---

# Parser Audit

Two-tier benchmark for the document parsing pipeline:

## Tier 1 — Deterministic (no API key required, free, instant)

```bash
npx tsx tests/parser-benchmark-deterministic.mjs
```

Validates the file-ingestion layer — Excel/CSV parsing, header detection, preamble preservation, fullText payload coverage. Asserts that every dollar amount + label in a fixture survives the trip to Claude's input. If this fails, Claude can't possibly succeed downstream.

Currently: **31/31 checks pass** across 5 fixtures.

## Tier 2 — AI accuracy (requires ANTHROPIC_API_KEY, costs ~$0.15/run)

```bash
npx tsx tests/parser-benchmark-ai.mjs                         # all fixtures
npx tsx tests/parser-benchmark-ai.mjs 05-rent-roll-small      # one fixture
```

Calls Claude Opus on each fixture and scores extracted fields against ground truth. Numeric tolerance: ±0.5% or ±$1. Reports per-field accuracy, average confidence on hits, and latency per fixture.

Current baseline: **63/63 (100%)** across 5 fixtures, ~17s avg latency.

## Fixture catalog

`tests/extraction-fixtures/` contains:

| ID | Format | Class | Tests |
|---|---|---|---|
| 01-multifamily-pl-clean | XLSX | pl | Standard labels, single-column annual P&L, 26 fields |
| 02-multifamily-pl-aliased | XLSX | pl | Abbreviated labels (GPR, R&M, P/R, G&A) — alias resilience |
| 03-pl-parenthesized-negatives | CSV | pl | "($120,000)" parens, "$" prefixes, comma formatting |
| 04-t12-monthly-breakdown | XLSX | t12 | 12 monthly columns, T-12 trailing total |
| 05-rent-roll-small | XLSX | rent_roll | 8 units, mix of Occupied/Vacant/Notice |

## Adding a new fixture

1. Edit `tests/extraction-fixtures/generate-fixtures.mjs` — add a new entry to `FIXTURES` with `id`, `format`, `sheetName`, `docClass`, `rows` (2D array including header row), and `expected` (ground-truth JSON matching `PLExtractionSchema` or `RentRollExtractionSchema`).
2. Re-run `node tests/extraction-fixtures/generate-fixtures.mjs` to write the fixture file + expected JSON.
3. Run both benchmark tiers to verify it passes.

## When a fail surfaces

- **Tier 1 fail**: real bug in `excel-extractor.ts` or `file-router.ts`. Fix the parser, not the test. (Last surfaced bug: preamble rows above the table were silently dropped — fixed 2026-04-21.)
- **Tier 2 fail**: investigate before "fixing" the expected. Most "failures" turn out to be the fixture expected being wrong (industry convention misapplied). Only update the expected after confirming Claude's interpretation matches CRE convention.

## Pair with

- After a fail, use `/fm-audit` to confirm the math engines are still sound — parser issues can leak into model inputs.
- Update `/update-journal` when fixing parser bugs so the next session knows.
