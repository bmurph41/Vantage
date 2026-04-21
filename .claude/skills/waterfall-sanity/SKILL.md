---
name: waterfall-sanity
description: Sweep a waterfall configuration through synthetic exit multiples (1.0x, 1.2x, 1.5x, 2.0x, 3.0x, 5.0x) and assert distribution invariants — sums match proceeds, no carry at-cost, GP profit share converges to target. Use when the user changes preferred-return %, catch-up %/target, GP/LP splits, or carried-interest configuration; or when proposing a new fund-level waterfall structure.
argument-hint: [config-json-overrides]
allowed-tools: Bash(npx tsx:*), Read
---

# Waterfall Sanity Sweep

Validates that a waterfall configuration produces correct GP/LP economics across a range of exit outcomes. Catches the class of bugs we found on 2026-04-21 (catch-up base wrong, pref base wrong, GP capital double-counted).

## How to run

Default config (8-pref, 100% catch-up to 20%, 80/20 split, 2% GP commit):
```bash
npx tsx ${CLAUDE_SKILL_DIR}/scripts/sanity.mjs
```

With overrides (any subset of WaterfallInput fields):
```bash
npx tsx ${CLAUDE_SKILL_DIR}/scripts/sanity.mjs '{"preferredReturn":0.07,"catchUpPercentage":0.5,"catchUpTarget":0.25}'
```

## What it checks

For each exit multiple it verifies:

1. **Conservation** — LP + GP distributions sum to total proceeds (rounding tolerance $5)
2. **At-cost integrity** — at 1.0x, GP receives ZERO carry (only ROC of own commitment)
3. **Catch-up convergence** — at high multiples with 100% catch-up, GP profit share never exceeds `catchUpTarget + 1pp`
4. **MOIC sanity** — LP MOIC ≥ 1.0 whenever there's profit

Outputs a table of LP/GP economics by exit multiple plus PASS/FAIL summary. Exits non-zero on failure.

## When to invoke

- User proposes a new waterfall config (e.g. "let's try a 9% pref with 50% catch-up to 25%")
- Before merging changes to `shared/exit/waterfall-engine.ts`
- When investigating LP complaints about GP economics
- During fund structuring discussions
