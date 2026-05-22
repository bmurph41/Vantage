# Anchor 3-pre · Phase 0 — COA Consolidation Blast-Radius Map

**Date:** 2026-05-21 · **Mode:** read-only investigation (no edits, no tsc, no DB writes)
**Goal:** scope the canonical-COA consolidation precisely enough to write a safe execution plan.
**Method:** four parallel read-only sweeps across `server/`, `client/`, `shared/`, `scripts/`.

---

## Headline

**Can the consolidation be done behind a stable engine interface?**

- **The registry side — YES.** `computeDirectInputFinancials()` (`direct-input-engine.ts:650`)
  is *already* the stable accessor. `COA_REGISTRY` and the `COALine` type are **module-private**
  — the symbol `COA_REGISTRY` appears exactly twice in the whole repo, both inside
  `direct-input-engine.ts` (def `:608`, read `:655`). **No call site reads `COALine` internals.**
  Adding `department` / `treatment` to the COA entity, or re-sourcing `category` from a unified
  registry, is a **single-file change** with zero call-site churn — *provided* the output shape
  (`FinancialLine` / `DirectInputFinancials`, especially `FinancialLine.key`) is held constant.

- **The department-inference side — NO.** `inferDepartment()` is **not** behind the accessor.
  It is called directly by ~14 sites across 7–8 files, including the live pro-forma engine.
  Consolidating department taxonomy is a separate, higher-risk workstream.

**Single biggest risk — department-inference re-bucketing.** Four engine/service call sites
pass `undefined` for `assetClass`, so they **always run the marina cascade regardless of the
deal's real asset class**. Any consolidation that "fixes" this threading will change which
department non-marina P&L lines land in — and `pro-forma-engine-service.ts` uses the department
result to key **growth-rate lookups and granular-margin lookups**. The fix silently changes
projected NOI for every non-marina deal. No type error, no test failure — just different numbers.
This is the place to gate with golden-number regression tests before touching anything.

**Effort: multi-session.** Not a 1- or 2-session item. Natural staging in §5.

---

## 1. Department-Inference Subsystem (the scattered piece)

### 1.1 `server/utils/department-mapping.ts` — anatomy

`inferDepartment()` — entry point, **`department-mapping.ts:30`**:
```
inferDepartment(subcategory: string, category?: string, assetClass?: string): string
```
Dispatch `switch` on `assetClass` (`:34-38`):
- `'str'` → `inferDepartmentSTR` (`:117`) — returns one of 4: `Rental, Cleaning, Platform Fees, Operating`
- `'multifamily'` → `inferDepartmentMultifamily` (`:150`) — returns one of 7: `Mgmt Fee, Payroll, Other Income, Utilities, R&M, Rental, Operating`
- **default** (`'marina'`, `undefined`, **and every other asset class** — hotel, business, golf, etc.) → `inferDepartmentMarina` (`:41`) — ~20 possible departments

`inferDepartmentMarina` runs a 5-stage cascade: exact `COA_DEPARTMENT_MAP` lookup (`:42`) →
`MARINA_COA_SEED` keyword scan over all 104 seed items (`:44-52`) → hardcoded revenue/payroll
keyword cascade (`:54-100`) → extended expense-department cascade (`:103-112`) → `'General'`
fallback (`:114`).

Data sources: `MARINA_COA_SEED` is imported from `server/scripts/seedMarinaCoa.ts` (104
`CoaSeedItem` rows). `COA_DEPARTMENT_MAP` (exported, `:8-11`) is derived from that seed.
The file has **14 exports** total; only 6 have external consumers (`inferDepartment`,
`deptKeyToLabel`, `normalizeDepartment`, `normalizeBucket`, `departmentToAssumptionKey`,
`storageSubcategoryToTypeKey`, `sectionToCategory`, `majorGroupToCategory`,
`correctCategoryForDepartment`) — the key→label maps and `getDepartmentFrom*` helpers have
no external callers.

### 1.2 The ~14 `inferDepartment` call sites

**ENGINE-PATH (feeds pro-forma / DCF / projection) — 3 files, 9 sites:**

| File:line | assetClass passed | Use of result |
|---|---|---|
| `canonical-actuals-loader.ts:293` | **`undefined`** (explicit TODO `:291`) | → `lineItems[key].department` — the canonical actuals object |
| `pro-forma-engine-service.ts:532,553,852,907,926,1032,1065` (7 calls) | **real** `project.assetClass` (`:404`, throws if missing) | keys revenue/expense buckets, **growth-rate lookup, granular-margin lookup** |
| `promote-to-actuals.ts:147` | **`undefined`** (TODO `:146`), wrapped by `normalizeDepartment:148` | writes `department` on every promoted `modelingActuals` row — the engine baseline |

**ROUTES + route-adjacent services — ~4 sites:**

| File:line | assetClass passed | Use |
|---|---|---|
| `crm-routes.ts:17692` | **real** `project.assetClass` | grouped P&L display payload |
| `crm-routes.ts:17737` | **real** `project.assetClass` | manual-entry actuals INSERT |
| `crm-routes.ts:17897` | **real** `project.assetClass` | multi-year grouped P&L payload |
| `doc-intel-service.ts:2560` | **`undefined`** | doc-intel category correction |

**SEED/SCRIPTS — 1 site:** `scripts/seed-mf-fixture.mjs:251` — `inferDepartment(name, cat, 'multifamily')`, fixture assertion.

**CLIENT — 0** (the client uses its own copy — see §1.3).

> ⚠️ **Enumeration gap to confirm in the execution plan:** the threading analysis also named
> `quickbooks-service.ts:609` as a 4th `undefined`-passing site, but it was not separately
> enumerated. Count it as ~14 `inferDepartment` calls across **7–8 files**; the QuickBooks
> site needs a confirming grep before the plan is finalized.

**Threading finding (load-bearing):** 4 of the calls — `canonical-actuals-loader.ts:293`,
`promote-to-actuals.ts:147`, `doc-intel-service.ts:2560`, `quickbooks-service.ts:609` — pass
`assetClass = undefined` and therefore **always run the marina cascade.** Two of those four
(`canonical-actuals-loader`, `promote-to-actuals`) write `department` onto the **actuals
baseline** that the engine reads. Only `pro-forma-engine-service.ts` and the three
`crm-routes.ts` sites thread the real asset class.

### 1.3 The duplicated client copy — `client/src/lib/department-inference.ts`

**Verdict: DRIFTED — a stale partial snapshot of `inferDepartmentMarina` only** (52 lines,
one export `inferDepartmentClient(subcategory, _category?)`).

It reproduces verbatim **only** lines 54–97 of the server's `inferDepartmentMarina` (the
hardcoded revenue/payroll cascade). Within that overlap it is byte-identical. Everything
the server has *beyond* that range, the client is **missing**:

1. No asset-class dispatch — STR/multifamily projects get marina departments on the client.
2. No `inferDepartmentSTR` / `inferDepartmentMultifamily` branches.
3. No `COA_DEPARTMENT_MAP` exact-match step; no `MARINA_COA_SEED` keyword scan.
4. No `Commercial Leases` branch.
5. **No extended expense-department cascade at all** — for *any* expense line (insurance,
   property tax, utilities, marketing, legal, R&M…) the client returns `'General'` where
   the server returns a specific department. This is a concrete **divergent-return drift**.

Consumers of the client copy — **2 files, 3 sites**, all as a *fallback* behind a
server-supplied dept map:
- `client/src/pages/modeling/projects/workspace/pro-forma.tsx:814` — `serverDeptMap[item] || inferDepartmentClient(...)`
- `client/src/pages/modeling/projects/workspace/historical-pl.tsx:1454` and `:2342` — `annualSubcatDeptMap[sub] || inferDepartmentClient(...)`

**Landmine:** the client copy has **no seed dependency** — changes to `MARINA_COA_SEED`
propagate to the server but never to the client. Consolidating must retire the client copy
in favor of server-supplied maps, or it will silently keep diverging.

---

## 2. Category Duplication (the de-dup target)

### 2.1 The two registries are different abstractions, not duplicates

| | `shared/direct-input-coa.ts` | `server/services/direct-input-engine.ts` |
|---|---|---|
| Type | `COAFieldDef` (`:14-25`), `category: 'revenue'\|'expense'` (`:17`) | `COALine` (`:58-81`), `category: 'revenue'\|'expense'` (`:61`) |
| Key namespace | **UI input-field names** (`avgNightlyRate`, `propertyManagementPct`) | **COA output-line names** (`grossRentalIncome`, `propertyManagement`) |
| Registries | 29 per-class arrays via `COA_FIELD_REGISTRY` (`:898-930`) | 10 per-class arrays via `COA_REGISTRY` (`:608-644`) |
| Unique keys | 351 | 75 |

The engine bridges the two via each `COALine.inputKeys[]` alias array — the shared keys are
referenced by the engine as *input lookups*, not as its own line keys.

### 2.2 Category agreement — cross-registry: **ZERO disagreements**

Only **8 keys collide by name** across the two registries. **All 8 AGREE on category:**

| Key | shared (COAFieldDef) | engine (COALine) |
|---|---|---|
| `annualInsurance`, `annualPropertyTax`, `marketing`, `ownerSalary`, `storeCOGS`, `utilities` | expense | expense |
| `parkingRevenue`, `serviceRevenue` | revenue | revenue |

The "duplication" risk is **structural** (two abstractions to reconcile — input fields vs
output lines, 29 registries vs 10), **not a live category-value bug between the files.**

### 2.3 One genuine latent bug — *intra*-file, inside `shared/direct-input-coa.ts`

| Key | Occurrence A | Occurrence B | Verdict |
|---|---|---|---|
| `badDebtPct` | `:163` MULTIFAMILY → **`revenue`** | `:301` SELF_STORAGE → **`expense`** | **DISAGREE — must be resolved deliberately.** Same concept (uncollectable rent), two classifications. |
| `monthlyRent` | `:102,:132` `revenue` | `:556,:604,:746…` `expense` | Context-legitimate (rental income vs tenant's rent expense). |
| `annualIrrigation` | `:576` `expense` (golf) | `:833` `revenue` (landscaping) | Context-legitimate (different asset classes). |

`badDebtPct` is the one category value the consolidation must pick a convention for.

### 2.4 Who reads `category`

- **`COALine.category`** — 3 sites, **all internal** to `direct-input-engine.ts`
  (`:718` revenue filter, `:725` first-formula detection, `:755` expense filter). Not exported.
- **`COAFieldDef.category`** — 3 importing files; meaningful `.category` *reads* at
  `direct-input-form.tsx:462`, `inputs.tsx:535` (form Revenue/Expense section split), and
  `pnl/canonical-seed.ts:108` (drives canonical P&L line seeding via `groupToSection`).
- **Adjacent category-bearing structures the consolidation must not miss:** `COACustomLine`
  (shared `:27-32`), `FinancialLine` (engine `:26-39`, *exported & widely consumed*), and the
  hardcoded `UNIVERSAL_ITEMS` literal in `pnl/canonical-seed.ts:46-62`.

---

## 3. Canonical Entity Shape — Path 2 (unify onto the DB-backed COA)

### 3.1 There are FOUR parallel COA persistence pipelines

1. **Taxonomy-pack** — `coa_user_aliases` (`schema.ts:27164`), `coa_canonical_accounts`
   (`:27124`, pack-scoped/global), `coa_taxonomy_packs`. Override = raw-label → canonical-account alias.
2. **Import/QuickBooks** — `coa_mapping` (`schema.ts:23461`), unique `(org_id, coa_account_id)`.
   Plus a JSONB blob `chartOfAccountsMapping` on integrations (`schema.ts:17759`).
3. **P&L pipeline** — `pnl_canonical_line_items` (`pnl-pipeline-schema.ts:79`) + `pnl_line_item_aliases`.
4. **Finance-kernel** — `fin_coa_categories` (`financial-coa-schema.ts:6`, `org_id` nullable →
   supports global rows) + `fin_coa_aliases`.

### 3.2 Verdict: PARTIAL FIT — `key`/`category`/`department` host exists; `treatment` does not

Best existing host: **`pnl_canonical_line_items`** (`pnl-pipeline-schema.ts:79`):
- `key` → `canonical_key` (text, NOT NULL) — and it **already has `unique(org_id, canonical_key)`**, exactly the "one row per COA key, org-scoped" constraint a canonical entity needs.
- `category` → existing `section` (`'revenue'|'cogs'|'expense'|'payroll'|'other'`).
- `department` → existing `department` (text, NOT NULL).
- `treatment` → **GAP. No column. New column required.**

**Three concrete preconditions before any column can be added:**

1. ⚠️ **Schema collision — blocking.** `pnl_canonical_line_items` is **defined twice** as a
   `pgTable` pointed at the same physical table: `pnl-pipeline-schema.ts:79` vs `schema.ts:17008`,
   with **divergent column sets, NOT-NULL flags, and unique keys** (`coa_code` unique vs
   `(org_id, canonical_key)` unique). Adding `treatment` safely is blocked until it is verified
   which definition matches the live DB. *(Per CLAUDE.md: verify against the live DB with `\d`
   before any DDL.)*
2. **No global-row support.** `pnl_canonical_line_items.org_id` is NOT NULL — cannot host a
   global default. Either make it nullable (as `fin_coa_categories` already is) or seed per-org.
3. **`category` vocabulary is 4-way fragmented** — `section` (pnl), `major_group`
   (`fin_coa_categories` / schema.ts pnl variant), `statement_type` (`coa_canonical_accounts`),
   `category_group` (`mm_standard_accounts`). Hosting `category` on one table does not reconcile
   the other three.

### 3.3 `treatment` — greenfield at the DB, NOT a new idea in code

`treatment` as a named field: **greenfield** — grep across all schema + registry files returns
only one unrelated hit (`schema.ts:14734`, a tax comment).

But the *concept* already exists, scattered as **in-code-only** TypeScript fields (never
persisted to the DB):

| Existing field | File:line | Role |
|---|---|---|
| **`computeType`** | `direct-input-engine.ts:63` | Strongest match — `'direct'\|'pct_of_revenue'\|'pct_of_egi'\|'formula'\|'monthly_x12'`. *Is* a treatment field by another name. |
| `isSubtraction` | `direct-input-engine.ts:66`, `FinancialLine :33` | Line computes as negative (vacancy/concessions/COGS). |
| `pctOf` / `pctKey` / `defaultPct` | `direct-input-coa.ts:23`; `direct-input-engine.ts:64-65` | Base for percent lines. |
| `formulaFn` / `dependsOn` / `monthlyInputKeys` | `direct-input-engine.ts:72,80`; `direct-input-coa.ts:21` | Formula + monthly-×12 hooks. |
| `inputType` | `direct-input-coa.ts:18` | `'currency'\|'percent'\|'number'\|'formula'`. |

**Caveat:** `computeType` and `isSubtraction` are **orthogonal** (a line can be `formula`
*and* `isSubtraction`). `treatment` is not a single enum that cleanly replaces one field — it
would have to absorb a small cluster of related flags. Treat that design as deliberate, not mechanical.

---

## 4. Engine Read Path (the danger zone)

### 4.1 `computeDirectInputFinancials` — the COA read (`direct-input-engine.ts:650-664`, verbatim)

```
650  export function computeDirectInputFinancials(
651    assetClass: string,
652    inputAssumptions: Record<string, any>,
653    unitMix?: any[],
654  ): DirectInputFinancials | null {
655    const coa = COA_REGISTRY[assetClass];
656    if (!coa) return null;
657    try {
658      return computeFromCOA(coa, inputAssumptions, unitMix);
659    } catch (err) { ... return null; }
664  }
```

The read is one `Record<string, COALine[]>` index + null-guard. All logic is in private
`computeFromCOA` (`:670-852`) / `computeLine` (`:858-944`). How each `COALine` property flows:

- **`category`** — primary bucket: `coa.filter(l => l.category === 'revenue')` (`:718`) then
  `=== 'expense'` (`:755`). Revenue first so totals exist for percent-of calcs.
- **`key`** — written into the `computed[]` map (`:720,:757`) for cross-line formula refs, and
  copied verbatim onto output `FinancialLine.key` (`:736,:764`).
- **`isSubtraction`** — revenue lines negate amount (`:732`) and feed EGI math (`egi =
  totalRevPositive − totalRevSubtractions`, `:744-751`). Expense lines do **not** apply it.
- **`computeType`** — dispatched in `computeLine` (`:866-941`): `formula`→`formulaFn`,
  `direct`→first positive `inputKeys` value, `monthly_x12`→×12, `pct_of_revenue/egi`→base × pct.
- `inputKeys`, `pctKey`, `defaultPct`, `formulaFn`, `monthlyInputKeys` — all consumed only inside `computeLine`.
- NOI: `totalRevenue − totalExpenses` (`:845`).

Return shape `DirectInputFinancials` (`:15-23`): `totalRevenue`, `totalExpenses`, `noi`,
`revenueLines: FinancialLine[]`, `expenseLines: FinancialLine[]`, `computedFrom`,
`formulaBreakdowns`, `monthlyBreakdown`. `FinancialLine` (`:26-39`): `label`, `amount`,
`category`, `formula?`, `key`, `isCustom?`, `isSubtraction?`.

### 4.2 The ~12 call sites — all consume the OUTPUT, none touch the registry

`COA_REGISTRY` / `COALine` are private; the 12 sites all call `computeDirectInputFinancials`:

| # | File:line | Consumes from return |
|---|---|---|
| 1 | `compute-direct-input-route.ts:18` | whole object → `res.json` |
| 2 | `routes.ts:3396-3405` | passes fn as DI dependency only |
| 3 | `modeling-export.ts:223` | `.revenueLines`/`.expenseLines` → `.label`,`.amount`,`.formula` |
| 4 | `modeling-export.ts:439` | result as `year1` → projection |
| 5 | `multi-year-projection-route.ts:120` | `year1` → projection |
| 6 | `deal-pricing-service.ts:520` | `.noi`,`.totalRevenue`,`.totalExpenses`,`.revenueLines`,`.expenseLines` |
| 7 | `dcf-calculator-service.ts:313` | `year1` → projection (DI dep, typed `=> any`) |
| 8 | `dcf-decision-support-service.ts:151` | `year1` → projection (DI dep, `=> any`) |
| 9 | `pro-forma-engine-service.ts:625` | iterates lines → `.label`,`.amount` |
| 10 | `pro-forma-engine-service.ts:662` | same |
| 11 | `dcf-routes.ts:113` | `year1` → DCF (DI dep, `=> any`) |
| 12 | `crm-routes.ts:14205` + `:14226` | whole object → `res.json`; also `year1` → projection |

### 4.3 Assessment — accessor holds; the output shape is the real contract

A registry-internal change (re-source `category`, add `department`, add `treatment`, re-key
the registry) is **contained entirely within `direct-input-engine.ts`** with **zero call-site
changes** — *if and only if* `FinancialLine` / `DirectInputFinancials` stay constant.

**The genuine blast radius is the OUTPUT shape:**
- **`FinancialLine.key` is the hard constraint.** `multi-year-projection-engine.ts` hard-codes
  `line.key` values — `'grossPotentialRent'`/`'gpr'`/`'grossRevenue'` GPR detection (`:383`),
  `VACANCY_KEYS.has(line.key)` (`:389`), and per-line growth-rate lookup `resolveGrowthRate(line.key,…)`
  (`:370,:399`). COA line `key`s propagate verbatim to `FinancialLine.key` (`:736,:764`). Rename
  a key → growth rates and GPR/vacancy logic **silently mis-resolve**. No type error.
- `FinancialLine.label` is a soft contract — used as a map key by `pro-forma-engine-service.ts`
  and `modeling-export.ts`.
- `category` must stay the 2-value `'revenue'|'expense'` union — if a unified entity has richer
  values (`'cogs'`, `'other_income'`), the output must down-map or projection bucketing breaks.

**The one structural blocker: `multi-year-projection-engine.ts`** (`:370,:383,:389`) — the only
consumer that semantically interprets `line.key`. If consolidation touches line-key naming, the
projection engine must change in lockstep (a flag-day). The 3 DI-typed sites (#7/#8/#11, typed
`=> any`) are **silent-risk**: an output-shape change would not even raise a compile error there.

---

## 5. Sequencing & Risk Readout

### 5.1 Can it stay behind a stable interface?

**Partly — and the split is clean:**

| Workstream | Behind the accessor? | Why |
|---|---|---|
| Add `category`/`department`/`treatment` to the COA *entity*; re-source `COALine.category` from a unified registry | ✅ YES | `COA_REGISTRY`/`COALine` private; single-file change in `direct-input-engine.ts` if output shape held |
| Consolidate **department inference** (`inferDepartment`) | ❌ NO | called directly by ~14 sites incl. live pro-forma engine; not behind any accessor |
| Rename/re-key COA lines, or add fields to `FinancialLine`/`DirectInputFinancials` | ❌ NO — flag-day | forces `multi-year-projection-engine.ts` + 12 call sites + tests together |
| Path 2 DB-backed canonical table | ❌ NO — blocked first | `pnl_canonical_line_items` double-definition must be resolved against the live DB before DDL |

### 5.2 The single most dangerous part

**Department-inference threading.** Four call sites pass `assetClass = undefined` and run the
marina cascade unconditionally — including `canonical-actuals-loader.ts:293` and
`promote-to-actuals.ts:147`, which **write `department` onto the actuals baseline the engine
reads.** `pro-forma-engine-service.ts` then uses `inferDepartment`'s output to key **growth-rate
and granular-margin lookups** (7 calls, `:532-1065`). So "correctly" threading `assetClass`
during consolidation re-buckets every non-marina line → different growth rate → different margin
→ **different projected NOI**, with no type error and no failing test. The drifted client copy
(`department-inference.ts`, marina-only, no expense cascade) compounds it: server and client
would re-bucket *differently*.

Runner-up: renaming any COA line `key` → silent mis-resolution in `multi-year-projection-engine.ts`
(GPR/vacancy/growth-rate). Both demand **golden-number regression tests captured before any change.**

### 5.3 Recommended staging (lowest-risk first)

1. **Phase 1 — `category` unification, behind the accessor.** Merge `COALine.category` onto a
   single registry; resolve the `badDebtPct` revenue/expense decision explicitly. Hold
   `FinancialLine`/`DirectInputFinancials` constant → single-file, zero call-site churn. Low risk.
2. **Phase 2 — schema-collision teardown.** Resolve the duplicate `pnl_canonical_line_items`
   `pgTable` definitions against the live DB (`\d pnl_canonical_line_items`). Precondition for any DDL.
3. **Phase 3 — DB-backed canonical entity + `treatment` column.** Raw-SQL migration onto
   `pnl_canonical_line_items` (or a deliberately chosen host); design `treatment` to absorb the
   `computeType`/`isSubtraction`/`pctOf` cluster (they are orthogonal — not one enum).
4. **Phase 4 — department-inference consolidation (highest risk).** Thread `assetClass`
   everywhere, retire the client copy, gate with golden-number regression tests. Do this *last*
   and *alone* — it is the only workstream that changes financial numbers.

### 5.4 Effort sizing

**Multi-session — 4–6 sessions**, not a 1–2 session item. Phase 1 ≈ 1 session. Phase 2 ≈ 0.5
session (investigation + one raw migration). Phase 3 ≈ 1–2 sessions. Phase 4 ≈ 1–2 sessions and
must be fenced by a regression harness built first. Phases are independently shippable; only
Phase 4 carries financial-correctness risk.

---

## Workstream 1 — category reconciliation (executed 2026-05-21)

Workstream 1, scoped behind the engine accessor, reduced to a **single change**.
Phase 0 §2 established the two `category` fields are different layers, not duplicates —
`COALine.category` (engine P&L bucketing) is already module-private and singular;
`COAFieldDef.category` (input-form section) is a separate concern. There is **no shared
"canonical category source" to build** without crossing into Workstream 3 (DB-backed
entity) or forcing cross-module coupling. So Workstream 1 = the `badDebtPct` correction,
nothing more — there was no canonical-registry component to it.

### Change shipped

`shared/direct-input-coa.ts:301` — self_storage `badDebtPct` field:
`category: 'expense' → 'revenue'`, `group: 'Operating Expenses' → 'Revenue Assumptions'`.

**Canonical bad-debt decision:** bad debt is **revenue-side contra-revenue**
(`category: 'revenue'`, `isSubtraction: true`). This matches the only treatment the
engine actually executes — the `badDebt` COALine in `MULTIFAMILY_COA` at
`server/services/direct-input-engine.ts:430` — and the projection engine's `VACANCY_KEYS`
classification (`multi-year-projection-engine.ts:203`). Bad debt is a credit-loss
adjustment above the NOI line, grouped with vacancy and concessions.

**Zero financial-number movement — verified.** The engine never reads self_storage
`badDebtPct` (`SELF_STORAGE_COA`, `direct-input-engine.ts:511-533`, has no bad-debt line).
The canonical-seed consumer (`canonical-seed.ts:108`) dedups keys first-seen-wins and
iterates `multifamily` before `self_storage` (`ALL_ASSET_CLASSES`), so `badDebtPct` is
seeded from the multifamily entry (`:163`) — the self_storage entry at `:301` is never
reached. Net effect is **UI form-section placement only**: on a self_storage project the
"Bad Debt %" field now renders under Revenue instead of Expenses.

### Future-wiring note — DO NOT LOSE

`SELF_STORAGE_COA` has no bad-debt line today, so self_storage `badDebtPct` is a
collected-but-unconsumed input (silent-drop field). **When a self-storage bad-debt COALine
is eventually wired, it MUST use the revenue-side contra structure** (`category: 'revenue'`,
`isSubtraction: true`, formula `storageRevenue × badDebtPct`) — mirroring
`MULTIFAMILY_COA:430`. Modeling it as an expense line would compute a **different NOI for
the same economic event**: NOI lower by `badDebt × propertyManagementPct` (the `X·p`
divergence) — an expense-side bad-debt line leaves EGI un-reduced and so inflates the
`pct_of_egi` management fee (`SELF_STORAGE_COA.propertyManagement`, `:525`, 6% of EGI).
Revenue-side keeps EGI, the fee base, and NOI consistent with multifamily.

### Out-of-scope latent items surfaced

- **`shared/direct-input-coa.ts:163`** — the multifamily `badDebtPct` entry has
  `category: 'revenue'` (correct) but **lacks `pctOf: 'revenue'`**, which the self_storage
  entry has. Minor metadata inconsistency on the MF side; not corrected here (no behavioral
  effect — MF bad debt is computed by the engine's own `MULTIFAMILY_COA:430` formula
  regardless of `pctOf`). Fix opportunistically.
- **Workstream 1 had no "canonical category source" component.** Establishing a single
  canonical `key → {category, department, treatment}` entity is **Workstream 3**
  (DB-backed), gated on the `pnl_canonical_line_items` double-definition collision (§3.2).

---

## Workstream 2 — `pnl_canonical_line_items` double-definition resolved (investigated 2026-05-21)

**Headline.** The live DB's **column SET matches Def B exactly** (16/16 names); its column
**attributes match neither** definition — the live table is the **union of both defs,
accreted by `server/db-startup-migrations.ts`**. **Def B (`schema.ts:17008`) is the
definition wired at runtime**; Def A's `pnlCanonicalLineItems` (`pnl-pipeline-schema.ts:79`)
is **shadowed and dead**. Safe reconciliation = **pure code-dedup, NO DDL.**

### The two code definitions

**Def A — `shared/pnl-pipeline-schema.ts:79`** — the original (created `ba71d41d`,
2025-12-24, "Add P&L pipeline…"). **11 columns:** `id` PK/uuid · `org_id` varchar **NOT NULL**
· `canonical_key` text **NOT NULL** · `display_name` text NOT NULL · `department` text
**NOT NULL** · `section` text **NOT NULL** · `parent_id` varchar · `sort_order` int NOT NULL
dflt 0 · `is_active` bool NOT NULL dflt true · **`file_data` text** · `created_at` timestamp
**with tz** NOT NULL. Constraints: PK(id); `unique('pnl_canonical_line_items_org_key_unique')`
on (org_id, canonical_key); index `pnl_canonical_section_idx`.

**Def B — `shared/schema.ts:17008`** — appeared 5 weeks later (`ff118239`, 2026-01-27,
commit "Saved progress at the end of the loop"). **16 columns:** `id` PK/uuid · `coa_code`
varchar(100) **NOT NULL UNIQUE** · `display_name` text NOT NULL · `major_group`
**`pnlMajorGroupEnum`** NOT NULL · `subcategory_group` text NOT NULL · `description` text ·
`sort_order` int dflt 0 (**nullable**) · `is_active` bool NOT NULL · `is_system_default`
bool NOT NULL · `canonical_key` text · `department` text · `org_id` varchar FK→organizations ·
`parent_id` varchar · `section` text · `created_at` timestamp **no tz** NOT NULL ·
`updated_at` timestamp **no tz** NOT NULL. Indexes: coa_code, major_group, subcategory_group.

**Column diff:** in **both** (10) — id, org_id, canonical_key, display_name, department,
section, parent_id, sort_order, is_active, created_at. **Def B only** (6) — coa_code,
major_group, subcategory_group, description, is_system_default, updated_at. **Def A only**
(1) — **`file_data`**. **Attribute disagreements on shared columns:** Def A marks
`org_id`/`canonical_key`/`department`/`section`/`sort_order` **NOT NULL**, Def B marks the
first four **nullable** and `sort_order` nullable; Def A `created_at` is **with-tz**, Def B
**no-tz**.

### The live DB — source of truth (`public.pnl_canonical_line_items`, **282 rows**, read-only)

16 columns:

| col | live type | live nullable | faithful to |
|---|---|---|---|
| id | varchar (uuid dflt) | NO | A + B |
| org_id | varchar | **YES** | B (A wrongly says NOT NULL) |
| canonical_key | text | **YES** | B (A wrongly says NOT NULL) |
| display_name | text | NO | A + B |
| department | text | **YES** | B (A wrongly says NOT NULL) |
| section | text | **YES** | B (A wrongly says NOT NULL) |
| parent_id | varchar | YES | A + B |
| sort_order | int (dflt 0) | **NO** | A (B has no NOT NULL) |
| is_active | bool (dflt true) | NO | A + B |
| created_at | **timestamptz** | NO | A (B wrongly says no-tz) |
| coa_code | varchar(100) | **YES** | B-only (B wrongly says NOT NULL) |
| major_group | **text** | YES | B-only (B wrongly declares it an **enum** + NOT NULL) |
| subcategory_group | text | YES | B-only (B wrongly says NOT NULL) |
| description | text | YES | B-only ✓ |
| is_system_default | bool (dflt true) | YES | B-only (B wrongly says NOT NULL) |
| updated_at | timestamp (no tz) | YES | B-only (B wrongly says NOT NULL) |

**`file_data` (Def A) does NOT exist in the live table** — Def A declares a phantom column.

Constraints (live): PK(id); `pnl_canonical_coa_code_unique` UNIQUE(coa_code);
`pnl_canonical_line_items_org_key_unique` UNIQUE(org_id, canonical_key) — **both defs'
unique constraints present**. Indexes (live, 8): pkey · `pnl_canonical_coa_code_idx` (B) ·
`pnl_canonical_major_group_idx` (B) · `pnl_canonical_subcategory_idx` (B) ·
`pnl_canonical_section_idx` (A) · `pnl_canonical_coa_code_unique` (B `.unique()`) ·
`pnl_canonical_line_items_org_key_unique` (A) · **`pnl_canonical_coa_code_uniq_idx`** — a
partial unique index `WHERE coa_code IS NOT NULL` declared by **neither** def (orphan).

**Verdict — matches Def B's column set, neither def's attributes.** The live column set is
exactly Def B's 16 names. But `major_group` is plain `text` (not the `pnlMajorGroupEnum` B
declares), `created_at` is `timestamptz` (A's flavor, not B's), and 5 columns B marks
NOT NULL (`coa_code`, `major_group`, `subcategory_group`, `is_system_default`, `updated_at`)
are **nullable** live. The live table is the **union of A and B accreted incrementally**:
`server/db-startup-migrations.ts` runs `ADD COLUMN IF NOT EXISTS` for Def-B columns
(`:12465-12476`) **and** Def-A columns (`:18448-18453`) on boot — and `ADD COLUMN IF NOT
EXISTS` adds columns **nullable**, which is exactly why every late-added column is nullable;
`major_group` is `text` because the startup migration adds it as `text` (`:12469`), never as
the enum; `created_at`'s `timestamptz` survives from Def A's original `CREATE`.

### Which definition is wired at runtime — **Def B**

`server/db.ts:4` `import * as schema from "@shared/schema"`; `:47` `drizzle({ client: pool,
schema })`. `shared/schema.ts` **both** defines `pnlCanonicalLineItems` locally (`:17008`,
Def B) **and** `export * from './pnl-pipeline-schema'` (`:21952`, repeated at `:25869` and
`:25871`), which would re-export Def A. **ES-module rule: a local `export const` shadows a
star-re-export of the same name** — so `@shared/schema.pnlCanonicalLineItems` resolves to
**Def B**, deterministically, no error.

**Every consumer imports from `@shared/schema`** — `pnl/mapping.ts`, `pnl/routes.ts`,
`pnl/aggregationService.ts`, `promote-to-actuals.ts`, `seedMarinaCoa.ts`, `canonical-seed.ts`,
`pnl-alias-matcher.ts`, `importPnlKeywordBank.ts`. **None imports the table from
`pnl-pipeline-schema.ts` directly** (5 files import from that path, but only *types* —
`ParsedRow`/`ParsedPeriod`). Corroboration: `pnl-alias-matcher.ts:102-104` reads
`.majorGroup`/`.subcategoryGroup`/`.coaCode` — **Def-B-only fields** — and compiles, proving
the resolved object is Def B.

**Def A's `pnlCanonicalLineItems` is dead** — shadowed for queries, referenced only inside
`pnl-pipeline-schema.ts` itself. Two latent landmines:
- `pnlCanonicalLineItemsRelations` (`pnl-pipeline-schema.ts:189`) is bound to **Def A's**
  table object; `db.query.pnlCanonicalLineItems` keys off **Def B's**. Object-identity
  mismatch → relational `with:` queries silently don't resolve. No live bug (all consumers
  use `findMany({ where })`, no `with:`).
- `insertPnlCanonicalLineItemSchema` (`pnl-pipeline-schema.ts:348`) is `createInsertSchema`
  of Def A — **zero consumers**, dead.

### Drift history — accidental duplicate, not an intentional fork

Def A is the original (`ba71d41d`, 2025-12-24). Def B appeared `ff118239`, 2026-01-27, in a
commit titled **"Saved progress at the end of the loop"** — a generic Replit loop-checkpoint
message, not a deliberate schema change. Def B was written as a *superset* of Def A's columns
(it re-declares canonical_key/department/org_id/parent_id/section) plus 6 new ones — so its
author had Def A's columns in view but **re-declared the table as a second `export const`
inside the 25k-line `schema.ts` rather than editing Def A**. Reads as an **accidental
duplicate** (likely an agent-loop edit). It has survived only because the ES shadowing rule
makes Def B win deterministically and `db-startup-migrations.ts` patched the live table up
to Def B's column set.

### Reconciliation options

**Option 1 — code-dedup: delete Def A's `pnlCanonicalLineItems`, keep Def B. NO DDL.** ✅ recommended
- Delete the `pnlCanonicalLineItems` table (`pnl-pipeline-schema.ts:79-94`),
  `pnlCanonicalLineItemsRelations` (`:189`), and `insertPnlCanonicalLineItemSchema` (`:348`)
  from `pnl-pipeline-schema.ts`. Note `pnlLineItemAliases` (and likely `pnlKeywordRules`) in
  that file are **also shadowed** (schema.ts re-declares them at `:17047`/`:17074`) — the
  WS2-execute step must first **enumerate the full shadowed-dead subset** of
  `pnl-pipeline-schema.ts` before deleting, and preserve its *live* exports
  (`pnlParsedStatements`/`pnlReviewItems`/`pnlJobs` tables + the `ParsedRow`/`ParsedPeriod`
  types that 5 files import).
- **Blast radius: zero runtime change** — Def A's table is already shadowed/dead; no consumer
  queries it; its relations object never attached to the live table anyway.
- **Risk: low**, but it is careful surgery — `pnl-pipeline-schema.ts` interleaves
  shadowed-dead and live exports. Watch for a `schema.ts ⇄ pnl-pipeline-schema.ts` import
  cycle if FK references are repointed rather than deleted.
- No DB change; tsc-verifiable.

**Option 2 — correct Def B to match live truth. Code only, NO DDL.** (fold into Workstream 3)
- Fix Def B's drifts so the surviving definition is *accurate*: `major_group` → `text` (not
  `pnlMajorGroupEnum`); `created_at` → `withTimezone: true`; relax `.notNull()` on
  `coa_code`/`major_group`/`subcategory_group`/`is_system_default`/`updated_at` to match the
  nullable live columns; add `.notNull()` to `sort_order`.
- Precondition for WS3 safely adding `treatment` — can't reason about a new column on a
  definition that misdescribes 8 of its 16 columns.
- No DDL. Risk low-medium — Drizzle's inferred types shift to reality, possibly surfacing
  latent (desirable) call-site type errors.

**Option 3 — do nothing.** The collision is currently benign (Def B wins deterministically),
but it blocks WS3 and leaves the phantom-`file_data` / mismatched-relations landmines.
Not recommended.

**Recommendation:** **Option 1 now** (pure code-dedup, zero runtime risk → one definition),
then **Option 2 folded into Workstream 3** (correct Def B to live truth as the foundation
for the `treatment` column). **Neither requires a DB migration.** A migration is needed only
if WS3 later *tightens* live nullable columns to NOT NULL or adds `treatment` — a separate
go-ahead, and it would need a backfill for the 282 existing rows.

### Workstream 2-execute — complete (executed 2026-05-21, commit `1487adb8`)

**Done — Option 1 + repoint.** Def A's `pnlCanonicalLineItems`, `pnlLineItemAliases`,
`pnlKeywordRules` (tables + their 3 relations + 3 insert schemas + select/insert types)
deleted from `pnl-pipeline-schema.ts`. Pure code-dedup — **no DDL, no `db:push`, no migration.**

The execute step's Step-1 inventory surfaced a blocker the investigation flagged only as a
"watch for": the 3 shadowed-dead tables are **FK-referenced by LIVE exports in the same file** —
`pnlFacts`, `pnlReviewItems`, `pnlDepartmentVerifications` and their relations (6 sites). A
"delete cleanly, no repoint" was therefore impossible. Resolution: **repoint** —
`pnlCanonicalLineItems` + `pnlKeywordRules` are now imported from `./schema` (Def B), so the 6
live FK/relation sites resolve to the canonical Def B objects. No *new* import cycle (line 5
already imported `organizations` from `./schema`).

Also corrected vs the investigation: the full shadowed set is **6 names**, not 5 — 3 tables +
3 `Pnl*` types (`PnlCanonicalLineItem`/`PnlLineItemAlias`/`PnlKeywordRule`, re-declared at
`schema.ts:17099/17103/17105`; Def B also shadows the `InsertPnl*` types at `:17100/17104/17106`).
The `*Relations` and `insertPnl*Schema` candidates are dead-by-zero-consumers, not
dead-by-shadowing — still safely removed.

**Verified:** `tsc -b shared` 0 · engine scoped check 0 in-scope · pnl consumers byte-identical
pre/post (zero new errors) · no dangling refs · `@shared/schema` loads at runtime with
`pnlCanonicalLineItems` resolving to Def B (`coaCode` present, phantom `file_data` gone).

### Out-of-scope items surfaced

- Orphan partial unique index `pnl_canonical_coa_code_uniq_idx` (`WHERE coa_code IS NOT NULL`)
  — declared by neither def, redundant with `pnl_canonical_coa_code_unique`. `coa_code` has
  3 indexes total. Cleanup candidate.
- `schema.ts` has `export * from './pnl-pipeline-schema'` **three times** (`:21952`, `:25869`,
  `:25871`) — redundant; dedupe opportunistically.
- **`server/scripts/seedMarinaCoa.ts` — Def-A-shaped seed inserts → Workstream 3.** The seed
  script inserts rows shaped to Def A (`canonicalKey`/`department`/`section`, no
  `coaCode`/`majorGroup`/`subcategoryGroup`) into the Def B table it imports from
  `@shared/schema` — 7 pre-existing `tsc` errors (`seedMarinaCoa.ts` lines 131/151/191/213-214).
  Predates WS2-execute (identical with the WS2 change stashed); surfaced by its verification
  sweep. Fix belongs with Option 2 — correct Def B / the seed path to live truth — in WS3.

---

## Workstream 3 — correct Def B to live truth + seed-path reconciliation

### Workstream 3-A — complete (executed 2026-05-21, commit `747e2c83`)

**Done.** Def B `pnlCanonicalLineItems` (`schema.ts:17008`) attribute declarations corrected to
match the live table — code-only, **no DDL / `db:push` / migration** (the live columns already
have these forms). 7 corrections, all re-confirmed against the live DB: `major_group` enum→`text`
+ nullable · `created_at` → `timestamptz` · `sort_order` → NOT NULL · `coa_code` `.notNull()`
dropped (`.unique()` kept) · `subcategory_group` / `is_system_default` / `updated_at` `.notNull()`
dropped.

The correction surfaced **4** call-site errors (Phase 0 predicted ≈5, range 4-6); all fixed in
the same commit. `pnl-alias-matcher.ts` `loadCoaCodeCache`/`loadCaches` now skip canonical rows
lacking `coa_code`/`major_group`/`subcategory_group` — 232 of 282 live rows have NULL `coa_code`
(the NULL-`coa_code` cohort — **not** `seedMarinaCoa` output; provenance corrected in WS3-B
below) and previously collapsed under one null key in the
coa_code-keyed caches; they are unmatchable by `coa_code` (aliases reference non-null
`canonicalCoaCode`) and served by a separate `canonicalLineItemId` path. `promote-to-actuals.ts:112`
null-guarded; `majorGroupToCategory` param widened to `string | null` (its `switch` already
routes unknowns to `default: 'Expenses'`).

**Verified:** `tsc -b shared` 0 · engine scoped 0 in-scope · pnl consumers **67 → 64** (net −3:
`seedMarinaCoa:131` plus one pre-existing insert error each in `canonical-seed.ts` and
`pnl/routes.ts`, all cleared by the Def B loosening; **zero new errors**) · runtime probe — Def B
loads corrected, `canonicalCache` loads exactly the 50 coa-coded rows (null-key collision gone),
`findAliasMatch` still matches. `pnlMajorGroupEnum` (`schema.ts:16992`) is now unused — left in
place, harmless; future-cleanup candidate.

### Open WS3 sub-items — need decisions before code

- **B — dead `seedMarinaCoa` mechanism — REMOVED (WS3-B-narrow, executed 2026-05-21, this commit).**
  WS3-B investigation found `seedMarinaCoa()` / `getCoaStats()` and the endpoint
  `POST /canonical-items/seed-marina` **dead** — the endpoint had no client or server caller and
  the functions ran via no other path. All three removed (code-only — **no DB write, no DDL,
  no row delete**). The script's 6 remaining `tsc` errors (`:151`, `:191`, `:213-214`) were all
  inside the deleted functions and are gone (engine scoped 6 → 0; pnl-consumer scoped 64 → 58;
  zero new errors).
  **`MARINA_COA_SEED` + `CoaSeedItem` preserved in place, untouched** — they are load-bearing
  (`department-mapping.ts` builds `inferDepartment()`'s lookup tables from the array; also read
  by `promote-to-actuals.ts`). `seedMarinaCoa.ts` now holds only the data constant + type.
  Relocating that data to a proper data module is deferred to **WS4**.
  **Provenance correction:** the WS3-A note's "232 ... legacy `canonical_key` seed cohort"
  wording implied `seedMarinaCoa` produced those rows — **wrong**. `seedMarinaCoa` never ran
  (its only caller was the unused endpoint). The 232 NULL-`coa_code` rows are ~206 doc-intel
  camelCase ingestion rows + ~21 legacy `org-1` rows; they remain in the DB, untouched —
  cleaning them is a separate, deliberate row-delete task, out of WS3-B scope.
- **C — `pnlKeywordRules` "double-definition" — investigated; there was NO double-definition.
  Real defect (WS3-A-class drift) corrected (WS3-C, executed 2026-05-21, this commit).**
  `pnlKeywordRules` / `pgTable('pnl_keyword_rules')` is defined **exactly once** (`schema.ts:17078`);
  `pnl-pipeline-schema.ts` only *imports* it (one FK + one relation). There is no Def-A/Def-B
  duplicate pair — nothing to dedup. The WS3-B note's "double-definition" was really **one table**
  whose single declaration merges two column families: the scalar shape
  (`keyword`/`bucket`/`department`/…) that every consumer uses, and the array shape
  (`keywords[]`/`canonicalCoaCode`/`segmentCode`) that no consumer reads or writes.
  The actual defect was schema-code-vs-live drift — `schema.ts:17078` marked
  `keywords`/`canonicalCoaCode` `.notNull()` (live: nullable) and
  `keyword`/`bucket`/`department`/`source`/`priority`/`timesMatched` nullable (live: NOT NULL),
  plus `match_type` default `'contains'`→live `'phrase'` and `created_at`/`updated_at`
  `timestamp`→live `timestamptz`. Corrected to live truth — **code-only, no DDL** (the live table
  already holds these forms). Cleared **20** pre-existing `tsc` errors in the pnl consumers
  (Phase-0 grep predicted 9; the 11 extras are the same drift bug-class — TS2538 index-type and
  TS2322 assignment cascades the grep under-counted), **zero** new errors, **zero** call-site
  changes. No FK entanglement: the lone FK (`pnl_department_verifications.keyword_rule_id`)
  points at the single table; both tables 0 rows.

---

## WS4 Piece C1 — golden-harness threaded-writer reference (executed 2026-05-22)

**Done.** The department-inference golden harness (`tests/department-inference-golden.mjs`
+ `.json`) gained a second writer-path reference so WS4 Piece C2's call-site fix has an
authoritative figure to verify against:

- `syntheticNOI_writerPath` renamed → `syntheticNOI_writerPath_undefined` — the actuals
  writer **today** (all four call sites pass `undefined`, so non-marina P&L runs the marina
  cascade).
- `syntheticNOI_writerPath_threaded` added — the writer **post-C2**, threading the real
  asset class (`== enginePath` by construction).
- `writerPathGap` added as a first-class golden field — `threaded − undefined`, the measure
  of the marina-cascade bug: **multifamily −80,059 · str −8,403**, zero for marina and the
  branch-less classes. Re-baselined GREEN; `enginePath` and `inferences[]` unmoved.

**Design — the C1/C2 split.** The harness is a **pure reference oracle**: DB-free, reads no
source, no false-green failure mode. It does **not** detect C2's call-site change — under C1,
C2 correctly produces **zero harness diff** (`inferDepartment` itself is untouched). Detection
is **relocated** to the C2 **live re-promotion test** (seed a real project, run the writer,
assert the persisted `modeling_actuals.department` label). A source-text-reading auto-detector
was considered and **rejected** — it would couple the gate to C2's textual form and risk a
silent false-green.

**C2 contract (locked).** C2 = **atomic** flip of all four call sites
(`canonical-actuals-loader.ts:293`, `promote-to-actuals.ts:147`, `quickbooks-service.ts:609`,
`doc-intel-service.ts:2560`) in one commit. The live re-promotion test asserts the persisted
department **label** as ground truth and uses `writerPath_threaded` NOI as a **corroborating**
reference, not strict equality — the real writer post-processes (`normalizeDepartment`,
`deptKeyToLabel`, `correctCategoryForDepartment`) and the synthetic oracle does not.

**Content location — read before trusting commit labels.** C1's content is **verified correct**
(harness GREEN, gaps −80,059 / −8,403, `enginePath` unmoved, `inferences[]` byte-identical) but
its **packaging is cosmetically wrong** — the Replit Agent's parallel auto-commit scattered it:

- `e41a1f25` — holds the harness `.mjs` (four edits). **Mislabeled** "Task #442: Vantage public
  landing & pricing page" and bundled with genuine Task #442 files (`PricingPage.tsx`,
  `billing-service.ts`).
- `07c7d7e5` — holds the harness `.json` re-baseline (clean — that file only).

Disentangling into one clean `test:`-prefixed commit was **declined**: it would require a
rebase of ~15+ commits racing the still-active Agent — higher-risk than the cosmetic benefit.
The content is sound; the labels lie. This note is the record.

---

## Open items for the execution plan

- Confirm `quickbooks-service.ts:609` as the 8th `inferDepartment` consumer (under-enumerated here).
- ~~Verify which `pnl_canonical_line_items` `pgTable` definition matches the live DB~~ —
  **RESOLVED 2026-05-21** (Workstream 2): live = Def B's column set; Def B (`schema.ts:17008`)
  is wired; Def A is shadowed/dead. Recommended fix = code-dedup, no DDL.
- ~~Decide the `badDebtPct` category convention~~ — **RESOLVED 2026-05-21**: revenue-side
  contra-revenue (see Workstream 1 above).
- Decide whether the canonical entity needs global (org-agnostic) rows — drives the
  `org_id`-nullable question.
- ~~Build the golden-number regression harness *before* Phase 4.~~ — **DONE**; extended by
  WS4 Piece C1 with the threaded-writer reference (see the WS4 C1 section above).

**Filed:** 2026-05-21 · Phase 0 investigation. **Updated:** 2026-05-21 — Workstream 1
executed (`badDebtPct` correction); Workstream 2 investigated **and executed**
(`pnl_canonical_line_items` double-definition — Def A deleted, live FKs repointed to Def B,
commit `1487adb8`; no DDL); Workstream 3-A executed (Def B corrected to live truth + coa_code
null-cache fix, commit `747e2c83`; no DDL) — WS3 sub-items B (legacy marina seed) and C
(`pnlKeywordRules` double-definition) open, pending decisions.
**Updated:** 2026-05-22 — WS4 Piece C1 executed (golden-harness threaded-writer reference;
content in commits `e41a1f25` + `07c7d7e5`, packaging cosmetic — see the WS4 C1 section).
