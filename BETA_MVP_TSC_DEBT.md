# BETA MVP — TypeScript Type Debt (corrected baseline)

**Measured:** 2026-05-21 · **Branch:** `main` · **TypeScript:** workspace `tsc`
**Method:** scoped per-area `tsc` runs — see [Scoped-tsc harness](#scoped-tsc-harness) below.

This document records the **real, measurable TypeScript error baseline** for the v1.0 MVP
cleanup. It exists because the prior baseline contained a blind spot: `server/` was
recorded as type-clean when it never was (see [Correction](#correction--server-was-never-clean)).
No errors are fixed here — this captures accurate scope so cleanup can be planned deliberately.

---

## Corrected per-area baseline

| Area | Check | Errors | v1.0 gate? |
|---|---|---:|---|
| `shared/` | `tsc -b shared` | **0** ✅ | Yes — clean |
| `server/` | `tsc -p tsconfig.diag-server-only.json` | **3,776** ❌ | Yes |
| `client/src/**` | `tsc -p tsconfig.diag-client-only.json` | **2,448** ❌ | Yes |
| `modules/dockit/**` | `tsc -p modules/dockit/tsconfig.json` | **168** | **No — Phase 4b** |
| `modules/dockit/**` *(as bundled in root `tsconfig.json`)* | `tsc -p tsconfig.diag-dockit-only.json` | 473 | — (see note) |

**v1.0 type-debt scope = `server/` 3,776 + `client/src` 2,448 ≈ 6,224 errors.**

Notes:
- The `server/` run reports 3,803 lines total: **3,776 in `server/`**, 24 in `modules/dockit`
  (dragged in via one server-side import), 3 in `db/`, **0 in `shared/`**. `shared/` stays clean
  even when pulled into the server check under stricter settings.
- `client/src` measured 2,448 vs. the prior baseline's 2,449 — **stable, no regression**. The
  client side did not change; this confirms the measurement method is sound.
- `modules/dockit` shows **two** counts: **168** under its own `tsconfig.json` (correct `@shared`
  mapping) is the real number; **473** is what the root `tsconfig.json` produces because root
  maps `@shared/*` to the root `shared/` — the wrong schema for dockit. The root config
  **cannot** typecheck dockit correctly. See [Dockit](#modulesdockit--excluded-from-the-v10-gate).
- The full combined `tsc --noEmit` (root `tsconfig.json`, client + server + dockit at once)
  **OOMs even at 6GB heap** — ~2,800 files / ~6,200+ errors loaded together. Do not run it.
  Use the scoped harness instead.

---

## Correction — `server/` was never clean

The prior note `project_ci_red_known.md` (memory, 2026-05-14) recorded:

> `server/` (+ dockit server) | scoped `tsc -p` | **0** ✓

**This is wrong, and the error predates that note.** Evidence:

- `server/routes.ts` uses the schema table `auditLogs` 6× (lines 2685–2702) but **never imports
  it** → genuine `TS2304 Cannot find name 'auditLogs'`. (The import block at lines 183–328
  imports `insertAuditLogSchema` but not `auditLogs` itself.)
- `git log -S'auditLogs' -- server/routes.ts` is **empty since 2026-05-01** — the usage count
  did not change in that window.
- `server/routes.ts` has **not been modified since 2026-05-14** (`git log --since` empty).
- Therefore the `auditLogs` error was present in `server/routes.ts` on 2026-05-14. `server/`
  was not clean then; the "0" was a mismeasurement (likely the wrong-command class of error
  the same note's own HISTORY section warns about).

Other genuine, spot-verified server errors confirm this is real type debt, not a config artifact:
- `server/routes.ts:183 / :235` import `salesComps` / `rateComps` **twice** → `TS2300 Duplicate identifier`.
- `TS2307` cases are real missing/mis-pathed files (`'../../db'`, `'./db'`, `'../utils/logger'`);
  core packages (`express`, `drizzle-orm`) resolve fine — the scoped config is sane.
- The named FM engine services are **not** exempt: `multi-year-projection-engine.ts` 8,
  `dcf-calculator-service.ts` 9, `returns-service.ts` 2, waterfall 7. The `shared/` finance/exit
  math is clean; the server-side engine wrappers are not.

The memory note `project_ci_red_known.md` and its `MEMORY.md` index line have been corrected
to match this finding.

---

## Error distribution

### `server/` — 3,776 errors

By top-level group:

| Group | Errors |
|---|---:|
| `server/routes/**` | 1,740 |
| `server/services/**` | 1,032 |
| `server/docket/**` | 353 |
| `server/integrations/**` | 95 |
| `server/routes.ts` | 88 |
| `server/storage.ts` | 75 |
| `server/marinamatch/**` | 58 |
| `server/vdr-routes.ts` | 45 |
| `server/om/**` | 45 |
| `server/middleware/**` | 43 |

By error code:

| Code | Count | Meaning |
|---|---:|---|
| TS2339 | 1,146 | Property does not exist on type |
| TS2304 | 576 | Cannot find name |
| TS2769 | 523 | No overload matches this call |
| TS2345 | 312 | Argument type not assignable |
| TS2322 | 251 | Type not assignable |
| TS2802 | 149 | Iterating without `--downlevelIteration` / target |
| TS2551 | 121 | Property does not exist (did-you-mean) |
| TS7006 | 117 | Parameter implicitly `any` |
| TS2554 | 97 | Wrong argument count |
| TS2353 | 74 | Unknown object-literal property |
| TS2307 | 50 | Cannot find module |
| TS2724 | 44 | No exported member (did-you-mean) |

Top offending files:

| File | Errors |
|---|---:|
| `server/routes/crm-routes.ts` | 319 |
| `server/docket/routes.ts` | 293 |
| `server/routes/operations-routes.ts` | 168 |
| `server/services/rent-roll-v2/rentRollService.ts` | 124 |
| `server/routes/rra-routes.ts` | 111 |
| `server/routes/modeling-routes.ts` | 98 |
| `server/routes.ts` | 88 |
| `server/routes/external-routes.ts` | 88 |
| `server/storage.ts` | 75 |
| `server/services/modeling-export.ts` | 56 |
| `server/services/pending-comp-review-service.ts` | 46 |
| `server/vdr-routes.ts` | 45 |

The `TS2304` (576) + `TS2339` (1,146) concentration points at schema-shape drift — code
written against table/object shapes that no longer match current `@shared/schema` types.

### `client/src` — 2,448 errors

By area:

| Area | Errors |
|---|---:|
| `client/src/components/**` | 1,377 |
| `client/src/pages/**` | 719 |
| `client/src/modules/**` | 167 |
| `client/src/lib/**` | 65 |
| `client/src/hooks/**` | 62 |
| `client/src/Router.tsx` | 19 |
| `client/src/docket/**` | 19 |
| `client/src/stores/**` | 18 |
| `client/src/config/**` | 2 |

By error code:

| Code | Count |
|---|---:|
| TS2339 | 1,066 |
| TS2322 | 311 |
| TS7006 | 144 |
| TS2551 | 133 |
| TS2345 | 131 |
| TS18046 | 97 |
| TS18048 | 53 |
| TS2353 | 50 |
| TS2802 | 47 |
| TS2304 | 43 |
| TS2769 | 37 |
| TS2305 | 35 |

Top offending files:

| File | Errors |
|---|---:|
| `client/src/components/third-party-reports.tsx` | 135 |
| `client/src/components/salescomps/sales-comps/CreateEditCompDialog.tsx` | 65 |
| `client/src/components/export-report-modal.tsx` | 59 |
| `client/src/pages/modeling/projects/workspace/pro-forma.tsx` | 47 |
| `client/src/components/pending-property-detail-dialog.tsx` | 39 |
| `client/src/components/document-builder/ContentBlocks.tsx` | 37 |
| `client/src/pages/modeling/projects/workspace/assumptions.tsx` | 36 |
| `client/src/modules/rent-roll-v2/pages/reports.tsx` | 35 |
| `client/src/components/rent-roll/RentRollEntryDialog.tsx` | 34 |
| `client/src/components/document-builder/DataBindingPanel.tsx` | 33 |

`client/src` is `TS2339`-dominated (1,066) — the same schema-drift signature, in the UI layer.

### `modules/dockit` — 473 (root config) / 168 (own config)

Under root `tsconfig.json`: `modules/dockit/client` 359, `modules/dockit/server` 108,
`modules/dockit/shared` 6. Most of the gap between 473 and the 168 from its own config is
`@shared` path-collision noise, not real dockit bugs.

---

## `modules/dockit` — excluded from the v1.0 gate

`BETA_MVP_SPEC.md §3.7` is explicit: Marina Ops — which contains the **Dockit** module — is
**Vantage Ops, an add-on**, productized in **Phase 4b** ("Ops add-on productization"),
described as a "different scope, different timeline" from the v1.0 MVP (Vantage Core +
Phase 4a modeling polish). Ops activation is a "v1.0 placeholder, pending design."

**`modules/dockit/**/*` has been removed from root `tsconfig.json`'s `include`.** Rationale:

1. It is **Phase 4b**, not v1.0 — it does not belong in the v1.0 type gate.
2. The root config **cannot typecheck it correctly** anyway: root maps `@shared/*` to the
   root `shared/`, but `modules/dockit` code expects `modules/dockit/shared/`. The 473 count
   under the root config is largely path-collision artifacts.
3. `modules/dockit` has its own `modules/dockit/tsconfig.json` with the correct mapping —
   that is where it should be checked (168 errors) when Phase 4b begins.

**This is exclude-from-gate, not removal.** Dockit stays **runtime-mounted** — `server/routes.ts`
dynamically imports `attachDockitRoutes` from `modules/dockit/server/integration` and mounts it
at `/dockit/api`. Runtime is unaffected (`tsx` does not typecheck; `vite`/`esbuild` build paths
are unchanged). Editors will pick up `modules/dockit/tsconfig.json` for files under that tree.

---

## Scoped-tsc harness

The full combined `tsc` OOMs at 6GB. These scoped runs each complete under 6GB and give a
readable, categorized error list per area. The `tsconfig.diag-*.json` configs are **gitignored**
(`.gitignore` line 51, "scratch diagnostic tsconfigs") — their contents are recorded here so
the harness is reproducible.

```bash
# shared — expect exit 0
NODE_OPTIONS=--max-old-space-size=4096 npx tsc -b shared

# server — expect ~3,776 errors in server/
NODE_OPTIONS=--max-old-space-size=6144 npx tsc -p tsconfig.diag-server-only.json

# client — expect ~2,448 errors
NODE_OPTIONS=--max-old-space-size=6144 npx tsc -p tsconfig.diag-client-only.json

# dockit (Phase 4b — its own config, correct @shared mapping) — ~168 errors
NODE_OPTIONS=--max-old-space-size=4096 npx tsc -p modules/dockit/tsconfig.json
```

`tsconfig.diag-server-only.json`:

```json
{
  "extends": "./tsconfig.json",
  "include": ["server/**/*"],
  "exclude": ["node_modules", "build", "dist", "dist-types", "shared", "modules", "**/*.test.ts"],
  "references": [{ "path": "./shared" }],
  "compilerOptions": { "incremental": false, "tsBuildInfoFile": null }
}
```

`tsconfig.diag-client-only.json`:

```json
{
  "extends": "./tsconfig.json",
  "include": ["client/src/**/*"],
  "exclude": ["node_modules", "build", "dist", "dist-types", "shared", "server", "modules", "**/*.test.ts"],
  "references": [{ "path": "./shared" }],
  "compilerOptions": { "incremental": false, "tsBuildInfoFile": null }
}
```

`tsconfig.diag-dockit-only.json` (diagnostic only — root-config view of dockit; the real
dockit check is `modules/dockit/tsconfig.json`):

```json
{
  "extends": "./tsconfig.json",
  "include": ["modules/dockit/**/*"],
  "exclude": ["node_modules", "build", "dist", "dist-types", "shared", "server", "client", "**/*.test.ts"],
  "references": [{ "path": "./shared" }],
  "compilerOptions": { "incremental": false, "tsBuildInfoFile": null }
}
```

To regenerate a per-code or per-file breakdown from a run:

```bash
npx tsc -p tsconfig.diag-server-only.json 2>&1 | tee /tmp/tsc.log
grep -oE 'error TS[0-9]+' /tmp/tsc.log | sort | uniq -c | sort -rn   # by code
grep 'error TS' /tmp/tsc.log | awk -F'(' '{print $1}' | sort | uniq -c | sort -rn   # by file
```

---

## Engine-services type cleanup (2026-05-21)

Scoped cleanup of the FM engine service files — the `tsconfig.diag-engine.json` set
(16 files: the DCF / projection / pro-forma / returns / waterfall engines plus the
canonical loaders, `debt-schedule-service`, `cashflow-parity`, `financial-calculations`
and `modeling-periods`). Executed in batches; each batch re-measured the engine-scoped
check. Engine baseline at start: **40 errors**.

### Batch 0 — `target: es2022`

Root `tsconfig.json` `compilerOptions` had no `target`, so TypeScript defaulted to
**ES3**. Every `for…of` / spread over a `Set` / `Map` / `MapIterator` therefore raised
`TS2802` ("can only be iterated with `--downlevelIteration` or `--target es2015`+").
Setting `"target": "es2022"` clears all of them. This is correct config, not a
workaround — `lib` is already `esnext`, `module` is `ESNext`, and the runtime
(`tsx` / `esbuild` / `vite`) already targets modern JS. The missing `target` was a
latent misconfiguration.

Blast-radius verification (scoped checks, before → after):

| Check | Before | After | Net |
|---|---:|---:|---:|
| Engine (`tsconfig.diag-engine.json`) | 40 | 29 | −11 |
| Server (`tsconfig.diag-server-only.json`) | 3,803 | 3,588 | −215 |
| Client (`tsconfig.diag-client-only.json`) | 2,448 | 2,393 | −55 |
| Shared (`tsc -b shared`) | exit 0 | exit 0 | — |

Codebase-wide `TS2802` cleared: **196** (149 server + 47 client). The engine also shed
5 `TS7006` (`implicit any`) in `modeling-periods.ts` — *cascade* errors: once the `Map`
iteration type-checks, the loop variables are no longer `any`.

### Latent bugs unmasked by es2022 target (were hidden behind TS2802 `any`-recovery)

`TS2802` is a hard-stop diagnostic: when it fires on a loop header, TypeScript makes
the loop variable `any` to recover, which silences **every** downstream type error in
the loop body. Removing `TS2802` lets the loop type-check, the variable gets its true
type, and pre-existing latent errors in the body surface. **14 such errors surfaced**
(13 server + 1 client). None are regressions — every one traces to a baseline `TS2802`
iteration site. They are real bugs that were masked, and remain to be fixed in the
future server / client cleanup passes (**not** this engine batch — none are engine-set
files):

| File:line | Code | Real bug | Pass |
|---|---|---|---|
| `server/storage.ts:1186` | TS2488 | `any[] \| QueryResult<never>` iterated — not iterable. Was `TS2461` ("not an array type") at the *same* line/column; es2022 recodes the diagnostic. | server |
| `server/routes/rra-routes.ts:4332,4333` | TS2345 ×2 | `{}` passed where `string` required — loop body over a `MapIterator` whose header was `TS2802` at line 4331. Identical `TS2345` already visible at 4315/4319/4321 *outside* the loop. | server |
| `server/routes/rra-routes.ts:4341,4344,4350` | TS2322 ×7 | same `{}`→`string` bug, assignment positions in the same loop body | server |
| `server/services/rent-roll-v2/rentRollService.ts:4019,4021` | TS2769 ×2 | `new Date(string \| null)` — `null` not accepted; loop over a `Map` whose header was `TS2802` at line 4008 | server |
| `server/services/rent-roll-v2/rentRollService.ts:4033` | TS2322 | `string \| null` assigned to `string \| undefined` — same loop | server |
| `client/src/components/ratecomps/rate-comps/ViewCompModal.tsx:254` | TS2345 | `.map((type: string) ⇒ …)` over `unknown[]` — the array derives from a `Set<unknown>` whose iteration was `TS2802` at line 122 | client |

---

## Implications for v1.0 planning

- **The engine math is clean.** `shared/` (incl. `shared/finance/`, `shared/exit/`) is 0 errors.
- **The backend is not clean.** `server/` carries 3,776 errors — this was the blind spot. The
  server-side FM engine *wrappers* (`dcf-calculator-service.ts`, `multi-year-projection-engine.ts`,
  `returns-service.ts`) have errors despite the underlying `shared/` math being clean.
- **`client/src` is stable** at 2,448 — long-standing debt, not a regression.
- Real v1.0 type-debt scope is **~6,224 errors** (`server` + `client`), schema-drift-dominated
  (`TS2339` + `TS2304` are the bulk in both areas). This is a deliberate cleanup project, not a
  pre-commit blocker — sized against accurate numbers now, rather than an optimistic "server clean."

**Next step (not done here): triage `server/` and `client/src` by feature area against what
ships in v1.0**, to separate must-fix from defer.

**Filed:** 2026-05-21
