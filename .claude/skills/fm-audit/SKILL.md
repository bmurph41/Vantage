---
name: fm-audit
description: Run the synthetic Blackstone-grade financial-model audit harness against the live engines (XIRR, waterfall, pro-forma projection). Use whenever the user asks to "audit the financial model", "verify FM math", "check IRR/waterfall accuracy", "test the engines", or before merging any change that touches shared/finance/, shared/exit/, server/services/multi-year-projection-engine.ts, server/services/dcf-calculator-service.ts, or server/services/returns-service.ts.
allowed-tools: Bash(npx tsx:*), Read
---

# FM Audit — Senior Analyst Scenario Harness

Runs ~20 hand-verified scenarios against the production financial engines:

- **XIRR canonical + legacy** — including TZ stability + j-curve (multi-call) convergence
- **Waterfall A/B/C** — 8-pref/80-20 with and without 100% catch-up; at-cost (no profit)
- **Pro-forma multi-year projection** — Y5 revenue/expense compounding, exit value, NOI CAGR precision

Expected values are derived by hand to penny precision (Excel-cross-checked). Exits non-zero on any failure so it's CI-friendly.

## How to run

```bash
npx tsx ${CLAUDE_SKILL_DIR}/scripts/audit.mjs
```

## What to do with the output

- All PASS → engines are mathematically sound, ship it.
- Any FAIL → DO NOT silently update the expected value. Investigate the engine first. Most failures here have historically been real bugs (catch-up base, pref base, NOI CAGR rounding). Refer to journal entry "FM Audit 2026-04-21" for the canonical bug list.

## Scope

This skill validates the PURE math layer. It does NOT exercise:
- DB-backed routes (use `smoke-fm-routes` skill)
- Waterfall behavior with custom tier configs (use `waterfall-sanity` skill)
- UI rendering

If the user asks to audit something this skill doesn't cover, suggest the right skill or fall back to writing scenario-specific test code.
