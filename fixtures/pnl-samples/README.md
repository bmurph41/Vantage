# P&L Sample Corpus — Dev/Verification Inputs

**Purpose:** Local catalog of real P&L statements used to drive vocabulary-coverage,
parser, and classifier work. These are **dev inputs we feed through harnesses with
human review** — NOT a runtime ingestion mechanism the app reaches into.

## Important

- The sample files in `marina/` and `str/` are **REAL financial statements**
  (revenue, payroll, distributions, owner data). They are **git-ignored** —
  see `.gitignore`: `fixtures/pnl-samples/*` (this README is the one exception).
- **Never commit a sample file** to this repo. If you accidentally `git add` one,
  `git status` should still show nothing under the subdirectories — verify after
  any change to the gitignore entry.
- Files are placed here by humans for local dev use only. Nothing in the app
  reads from this folder.

## Catalog

### Marina (`marina/`)

| Filename pattern | Source | Asset class | Quirks |
|---|---|---|---|
| `SS3_*_Monthly_P&Ls_*.xlsx` | Multi-year SS3 marina exports | marina (with brokerage hybrid) | QuickBooks Desktop export. Sheet 0 is a "Tips" cover sheet; real data lives on `Sheet1`. Header detection requires content-aware sheet selection (see [`server/services/pnl/excel-extractor.ts`](../../server/services/pnl/excel-extractor.ts) and commit `95cd91d4`). 58 line items, some non-canonical revenue categories ("Service Income", "Brokerage", "Rentals"). No depreciation canonical key yet — promoted in Phase B. |

**Seed marina samples** already live (tracked, intentional) at:
- `attached_assets/SS3_2023_Monthly_P&Ls_1779733308019.xlsx`
- `attached_assets/SS3_2024_Monthly_P&Ls_1779733308022.xlsx`

Reference those for SS3 — do **not** copy them into `marina/`.

### STR (`str/`)

| Filename pattern | Source | Asset class | Quirks |
|---|---|---|---|
| `121_Pennsylvania_Ave_*.{csv,xlsx,pdf}` | 121 Pennsylvania Ave. Airbnb/STR financials | str (single-property, full-service host) | Mixed CSV/XLSX/PDF formats. CSV is Airbnb earnings export. PDF is Baycation Home Services year-end summary with manual annotations. PDF parsing requires the `pdfjs-dist` path. |

**Seed STR samples** already live (tracked, intentional) at:
- `attached_assets/121_Pennsylvania_Ave._Airbnb_Earnings_1-2024_to_3-2025_1777696976642.csv`
- `attached_assets/121_Pennsylvania_Ave._Tracking_1777696976641.xlsx`
- `attached_assets/Financials___121_Pennsylvania_Ave_1777696976643.pdf`

Reference those for 121 Pennsylvania — do **not** copy them into `str/`.

## Adding a new sample

1. Drop the file into `marina/` or `str/` (or add a new subdirectory for a new asset class).
2. Add a row to the catalog above documenting: filename, source, asset class, and structural quirks (header row offset, sheet selection, non-standard category labels, retired naming, etc.).
3. Run `git status` — the file MUST NOT appear under the subdirectory. Only the README change should be staged.
4. If the file appears in `git status`, the gitignore entry is broken — stop and fix before doing anything else.

## What goes in "structural quirks"

The point of this catalog is to make parser/classifier failures debuggable without
re-discovering the same file's quirks. Useful quirks to document:

- Sheet structure (multi-sheet workbook, which sheet has data, cover/index sheets)
- Header row detection (header on row N, multiple header rows, year-in-header)
- Category vocabulary that's non-canonical (e.g. "Service Income" vs canonical "Revenue")
- Year parsing edge cases (4-digit numbers that look like years but aren't, e.g. "3032" — see [`shared/utils/timeAlign.ts`](../../shared/utils/timeAlign.ts) range gate)
- Below-NOI lines (depreciation, amortization, interest, distributions) that need
  Phase A `non_operating` classification — see [`server/services/__tests__/phase-a-below-noi-regression.test.ts`](../../server/services/__tests__/phase-a-below-noi-regression.test.ts) for what counts.
- Currency formatting (parentheses for negatives, leading $, locale separators)
- Empty/zero treatment (blank vs 0 vs "—")
