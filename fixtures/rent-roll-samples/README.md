# Rent-Roll Sample Corpus — Dev/Verification Inputs

**Purpose:** Local catalog of real rent rolls used to seed a future rent-roll
ingestion pipeline. Parked here as sample collection ahead of that work — the
samples land *before* the pipeline so vocabulary/format diversity is known
before any parser code is written.

## Scope boundary — read first

This corpus is **for a different ingestion pipeline than the P&L corpus** at
[`../pnl-samples/`](../pnl-samples/README.md). Do NOT confuse the two:

| Pipeline | Data shape | Status |
|---|---|---|
| P&L ingestion (active) | Period-over-period revenue/expense flow data | Current critical path: Phase B vocabulary enrichment → review gate → Historical P&L display → real-data confirmation |
| Rent-roll ingestion (future) | Unit/lease snapshot data (per-unit tenant, rent, term, options) | **Not started.** Will be its own program — separate parser shape, separate canonical vocabulary, separate engine wiring |

**Do not start rent-roll parser/vocabulary work from this corpus.** This README
is housekeeping ahead of a deliberate future workstream, not a starting gun.

## Important

- The sample files in `marina/`, `commercial/`, and `multifamily/` contain
  **REAL tenant data** (tenant names, monthly rents, lease commencement/
  expiration, security deposits, lease options, contact info on some). They
  are **git-ignored** — see `.gitignore`: `fixtures/rent-roll-samples/*` (this
  README is the one exception).
- **Never commit a sample file** to this repo. If you accidentally `git add`
  one, `git status` should still show nothing under the subdirectories —
  verify after any change to the gitignore entry.
- Files are placed here by humans for local dev use only. Nothing in the app
  reads from this folder.

## Catalog

### Marina (`marina/`)

Slip rent rolls. Marina rent rolls differ structurally from CRE rent rolls:
each "unit" is a slip with size (length × beam), draft, location (dock/finger),
and seasonal vs annual lease mix. Often exported from marina-management systems
(Dockmaster, Molo, etc.) with system-specific formats.

| Filename pattern | Source | Asset class | Quirks |
|---|---|---|---|
| _(empty — add entries as samples are placed here)_ |  |  |  |

### Commercial (`commercial/`)

Office, retail, industrial rent rolls. Typically include CAM/NNN reimbursement
breakdowns, escalation schedules (CPI vs fixed bumps), and TI/LC allowances.

| Filename pattern | Source | Asset class | Quirks |
|---|---|---|---|
| _(empty — add entries as samples are placed here)_ |  |  |  |

### Multifamily (`multifamily/`)

Apartment unit rent rolls. Per-unit bed/bath, in-place rent vs market rent
(loss-to-lease), concession schedules, occupancy/turn status.

| Filename pattern | Source | Asset class | Quirks |
|---|---|---|---|
| _(empty — add entries as samples are placed here)_ |  |  |  |

## Adding a new sample

1. Drop the file into the appropriate subdirectory (`marina/`, `commercial/`,
   `multifamily/`) or add a new subdirectory for a different asset class.
2. Add a row to the catalog above documenting: filename, source, asset class,
   and structural quirks (per-unit row count, header layout, system-of-origin
   conventions, sensitive PII fields present, etc.).
3. Run `git status` — the file MUST NOT appear under the subdirectory. Only
   the README change should be staged.
4. If the file appears in `git status`, the gitignore entry is broken — stop
   and fix before doing anything else.

## What goes in "structural quirks"

For when the rent-roll ingestion pipeline gets built, this catalog should make
parser failures debuggable without re-discovering each file's quirks:

- System of origin (Yardi, RealPage, MRI, Dockmaster, Molo, AppFolio,
  manual Excel)
- Row structure (one row per unit vs one row per lease, multi-lease-per-unit
  history)
- Date format diversity (lease start/end in different columns, various date
  formats, blank-for-MTM conventions)
- Rent breakdown shape (base rent only, vs base + CAM + tax + insurance
  separate columns, vs all-in)
- Per-asset-class fields (slip size for marina, square footage for commercial,
  bed/bath for multifamily)
- Sensitive fields that need to be flagged for PII handling on ingestion
  (tenant names, contact info, SSN/EIN, bank account info)
- Header detection edge cases (header on row N, multi-header summary blocks,
  category subheaders mid-table)
