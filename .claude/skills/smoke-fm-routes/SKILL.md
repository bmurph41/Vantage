---
name: smoke-fm-routes
description: Probe the canonical FM, fund management, fund reporting, and CRM endpoints under a fresh GP session. Reports HTTP status + content-type + payload preview for each. Use before deploys, after merging route/middleware changes, or whenever the user asks to "smoke the API", "verify endpoints", or "run the diagnostic sweep" referenced in MARINAMATCH_JOURNAL.md.
argument-hint: [projectId] [fundId]
allowed-tools: Bash(node:*), Bash(curl:*)
---

# Smoke FM Routes

Hits ~25 canonical UI-facing endpoints and reports green/non-green counts. Mirrors the diagnostic-sweep pattern documented in the journal (most recent: 2026-04-20 pre-beta sweep).

## How to run

```bash
node ${CLAUDE_SKILL_DIR}/scripts/smoke.mjs                                          # default test project
node ${CLAUDE_SKILL_DIR}/scripts/smoke.mjs <projectId>                              # custom project
node ${CLAUDE_SKILL_DIR}/scripts/smoke.mjs <projectId> <fundId>                     # both
BASE_URL=https://your-prod-url.example.com node ${CLAUDE_SKILL_DIR}/scripts/smoke.mjs   # remote target
```

Defaults to `http://localhost:5000` and the test project ID `6b3a9021-f393-489d-9274-321ac76eae08`.

## What it covers

- **FM project routes** — pro-forma, dcf, exit/scenarios, lp-reporting, config, tax-waterfall {settings, partners, equity-contributions}
- **Fund management (V1, canonical)** — funds, funds/:id, metrics, investors, capital-accounts, allocations
- **Fund reporting** — pme, j-curve, attribution, vintage-cohorts
- **CRM** — deals, contacts, companies, leads, tasks, activities, pipelines

## Reading the output

- `✓` — 2xx with JSON body (good)
- `·` — 404 (might be expected for fund-specific routes if the test fund doesn't exist)
- `✗` — non-2xx, or 2xx with HTML body (Vite dev catchall — means the route handler didn't match, NOT a real endpoint)

A 200 with HTML preview is a red herring — there's no JSON handler. The journal entry from 2026-04-20 explicitly calls this out for `/api/lp-portal/summary`.

## When to invoke

- Before any prod deploy (`Operational checklist` step in CLAUDE.md)
- After merging changes to `server/routes/` or `server/middleware/`
- When investigating "the UI shows no data" complaints
- After running `restart-dev` to confirm the server came up correctly

## Pair with

- Run `restart-dev` first if you've changed routes/middleware
- Run `fm-audit` separately to validate the math (this skill only checks transport)
