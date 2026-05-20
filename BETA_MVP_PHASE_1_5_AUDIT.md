# BETA MVP — Phase 1.5 Per-Class Content Audit

> **Status:** Pass 1 (grep-driven enumeration + registry audit) complete · Pass 2 (user-journey walkthrough) pending · Pass 3 (prioritization + §8 draft) pending.
> **Scope:** 3 MVP asset classes — `marina`, `str`, `multifamily`. Other classes flagged where they already have content.
> **Reading order:** Section 0 (methodology) → Section 1 (registry coverage) → Section 2 (inventory table) → Section 3 (surprises). Sections 4 + 5 added at end of Pass 2 + Pass 3.

---

## 0. Methodology

### Pass 1 inputs (this commit)

Five grep sweeps + four registry walk-throughs + tab-gate audit.

```
grep -rn "assetClass" --include="*.ts" --include="*.tsx"               → 1,512 line hits
grep -rn "getModelConfig|MODEL_CONFIG_REGISTRY|getTabOverrides"        →    57 line hits
grep -rnE "if.*assetClass.*===" --include="*.ts" --include="*.tsx"     →    15 line hits → 9 real branches
grep -rn "MARINA_CONFIG|STR_CONFIG|MULTIFAMILY_CONFIG"                 →    10 line hits
grep -rni "marina" --include="*.ts" --include="*.tsx" (excl. tests)    → 8,717 line hits → ~50 unique high-density files
```

### Classification keys

- **unified** — works uniformly across all classes via registry / `getModelConfig`. No per-class code needed; per-class content lives in the registry.
- **branched** — explicit `if (assetClass === ...)` or marina-hardcoded code path in shared infrastructure.
- **hidden** — feature is implemented but tab/section is gated off for non-marina classes (`tabs.X: false`).
- **missing** — code suggests a per-class surface that doesn't exist for one or more MVP classes.
- **dedicated-vertical** — entire module/feature is asset-class-specific by design (e.g., `marinamatch/`, `dockit/`, salescomps for marinas). Not a "leak"; cataloged separately.

### Surface = user-visible product touchpoint OR registry entry that drives one

A "surface" is a tab, a form section, a report, a KPI tile, a document template, a wizard step, a registry field group, an LLM prompt, a column set — NOT a single line of code. Line-grep hits are noise-reduced to surfaces.

### Stop conditions evaluated

- **>200 surfaces** → re-scope. Current count: ~80 surfaces. **OK to proceed.**
- **Major undocumented architectural assumption surfaces** → stop and surface. **One found** (orphan valuator-* stack, Section 3); not blocking — documented in §3.5 carry-over candidates.
- **Spec draft >500 lines** → consider separating audit doc permanently. Currently planning audit doc as separate companion. **Plan stands.**

---

## 1. Registry coverage matrix

The four parallel registries (per memory `project_four_registries_2026_05_17`) determine engine + UI behavior per asset class. Coverage of the 3 MVP classes is **100% in all 4 registries**.

| Registry | Location | Total classes | Marina | STR | MF | Notes |
|---|---|---|---|---|---|---|
| MODEL_CONFIG_REGISTRY | `shared/asset-class-model-config.ts:4412` | 32 | full (169 lines) | full (188 lines) | full (199 lines) | All three configs include `docIntelPromptHints`. |
| COA_REGISTRY (engine) | `server/services/direct-input-engine.ts:608` | 30 routed | MARINA_COA (~35 lines) | STR_COA (~264 lines, very rich) | MULTIFAMILY_COA (~34 lines) | STR_COA is by far the deepest. MF + Marina are thinner. |
| COA_FIELD_REGISTRY (UI) | `shared/direct-input-coa.ts:898` | 29 | MARINA_FIELDS (27 lines) | STR_FIELDS (57 lines) | MULTIFAMILY_FIELDS (50 lines) | Marina field set is shortest in this registry. |
| PRO_FORMA_REGISTRY | `shared/pro-forma-config.ts:934` | 30 | MARINA_PRO_FORMA (7 revenue items) | STR_PRO_FORMA (3 revenue items) | MULTIFAMILY_PRO_FORMA (5 revenue items, indented + EGI subtotal) | All three have distinct shapes. STR has fewer line items by design. |

### Depth-mismatch flags (within MVP classes)

- **COA_REGISTRY depth asymmetry:** STR ~264 lines vs Marina ~35 vs MF ~34. STR_COA was the focus of Day 9 work per memory `project_str_coverage_audit_2026_05_19`. Marina and MF COAs may be under-built for institutional depth.
- **COA_FIELD_REGISTRY depth asymmetry:** Marina has the shortest field list (27 lines) of any MVP class. Suggests upload-pipeline UX gap when seeding new marina projects with direct input.
- **PRO_FORMA_REGISTRY revenue line counts:** Marina 7, MF 5, STR 3. Marina is the most line-itemized; STR rolls cleaning fees + nightly into compact "Total Revenue" structure.

### Doc-intel prompt hints coverage

All 3 MVP classes have `docIntelPromptHints` populated in `MODEL_CONFIG_REGISTRY`. Per memory the doc-intel branching is shipped (commit `11b7f18f` 2026-05-18). Non-MVP classes fall back to `DEFAULT_DOC_INTEL_PROMPT_HINTS` (generic CRE).

### Tab visibility gates (`tabs: { ... }` per config)

| Class | storageLeases | physicalStorage | commercialLeases | profitCenters | replacementCost |
|---|---|---|---|---|---|
| Marina | ✓ | ✓ | ✓ | ✓ | ✓ |
| Multifamily | ✓ | — | — | ✓ | — |
| STR | ✓ | — | — | — | — |

Marina is the only MVP class with `replacementCost: true`. Per spec §3.5, this is the worked example for the Phase 4 per-class content build.

---

## 2. Surface inventory

Rows are listed by category. Each row is one product surface (tab/form/report/template/wizard step/registry-driven content block). Classification follows the keys in §0.

Coverage column convention:
- **full** = class-specific content shipped and visible
- **partial** = class-specific config present but content thin or generic fallback
- **none** = no class-specific content; falls back to generic OR marina-default OR is hidden
- **N/A** = surface intentionally not applicable to this class

### 2.A — Registry-driven (unified shared infrastructure, per-class content lives in 4 registries)

| # | Surface | Location | Category | Classification | Marina | STR | MF | Other-class notes | Effort to MVP-parity | Cross-ref |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Terminology (unit/property/rentRoll/NOI/etc.) | `MODEL_CONFIG_REGISTRY.terms` | registry-field | unified | full | full | full | 32 classes covered | none | — |
| 2 | Valuation metric (cap_rate / grm / ebitda_multiple) | `MODEL_CONFIG_REGISTRY.valuationMetric` | registry-field | unified | full (cap_rate) | full (grm) | full (cap_rate) | 32 classes covered | none | — |
| 3 | Seasonality config | `MODEL_CONFIG_REGISTRY.seasonConfig` | registry-field | unified | full (Apr-Oct) | full (Mar-Nov) | full (none) | seasonConfig.type ∈ {marina, hospitality, str, none} — only 3 of 32 types | none | — |
| 4 | Unit-mix tab content (storage types, columns, rate type) | `MODEL_CONFIG_REGISTRY.unitMix` | registry-field | unified | full (15 types, monthly, SF off) | full (14 types, nightly, SF on) | full (9 types, monthly, SF on) | tabIcon: marina='anchor', MF='home', STR='home' — STR + MF inherit 'home' from convention | none | §3.5 tabIcon entry — STR shows anchor icon today, **bug** (2026-05-18 verification) |
| 5 | Unit-mix tab visibility + label | `MODEL_CONFIG_REGISTRY.unitMix.tabLabel/showTab` | registry-field | unified | full ("Storage Leases") | full ("Listings & Units") | full ("Unit Mix") | §3.5 open question: institutional convention vs operator convention for label | none | §3.5 unitMix labels |
| 6 | Profit Centers / Other Income departments | `MODEL_CONFIG_REGISTRY.profitCenters.departments` | registry-field | unified | full (showTab=true, 8+ depts) | hidden (showTab=false) | full (showTab=true, 6 depts) | STR revenue modeled inline, not via Profit Centers tab | none | — |
| 7 | Input form sections (`inputSections.fields`) | `MODEL_CONFIG_REGISTRY.inputSections` | registry-field | unified | full | full (7 sections, 50+ fields) | full (5 sections, 50+ fields) | All 3 MVP classes have rich input field sets | none | — |
| 8 | Growth assumptions categories | `MODEL_CONFIG_REGISTRY.growthCategories` | registry-field | unified | full | full (9 categories) | full (8 categories) | All MVP classes covered | none | — |
| 9 | Overview KPI tiles (per-class set) | `MODEL_CONFIG_REGISTRY.kpis` | registry-field | unified | full | full (RevPAR, GRM, ADR) | full (Cap Rate, $/Unit, Avg Rent) | All 3 classes have 8 distinct KPIs | none | — |
| 10 | Tab visibility gates (5 booleans) | `MODEL_CONFIG_REGISTRY.tabs` | registry-field | unified | full (all 5 true) | partial (only storageLeases true) | partial (storageLeases + profitCenters) | Marina is only class with `replacementCost: true` and `physicalStorage: true` | small (decision) | §3.5 replacement cost |
| 11 | Rental modes (long_term / short_term) | `MODEL_CONFIG_REGISTRY.rentalModes` | registry-field | none | none | full | none | Only SFR/duplex/triplex/quad use this | none | — |
| 12 | Doc-intel LLM prompt hints | `MODEL_CONFIG_REGISTRY.docIntelPromptHints` | prompt | unified | full | full | full | Shipped 2026-05-18 (commit 11b7f18f). Most non-MVP classes use DEFAULT fallback. | none | — |
| 13 | Engine COA line items | `COA_REGISTRY` per-class | engine-config | unified | partial (MARINA_COA thin, ~35 lines) | full (STR_COA ~264 lines) | partial (MULTIFAMILY_COA ~34 lines) | Depth asymmetry: STR_COA is the deepest by far | medium (deepen Marina + MF COAs) | depth-mismatch flag §1 |
| 14 | UI direct-input form field defs | `COA_FIELD_REGISTRY` per-class | form | unified | partial (MARINA_FIELDS 27 lines, shortest) | full (STR_FIELDS 57 lines) | full (MULTIFAMILY_FIELDS 50 lines) | Marina is shortest — gap when seeding marina from direct-input flow | medium (deepen MARINA_FIELDS) | depth-mismatch flag §1 |
| 15 | Pro-forma line item taxonomy | `PRO_FORMA_REGISTRY` per-class | report-config | unified | full (7 revenue items) | full (3 revenue items, compact) | full (5 revenue items, EGI/effectiveRent subtotals) | All 3 have distinct shapes; design intent | none | — |

### 2.B — Workspace tabs (55 distinct tabs in `client/src/pages/modeling/projects/workspace.tsx:156-267`)

Groups: Overview (3) · Inputs & Data (5) · Uploads (1) · Financial Model (18) · Analysis (14) · Fund & Portfolio (6) · Scenarios (4) · Output (4) = 55 tabs.

Most are unified (single component, registry-driven content). Listed below are tabs that are **explicitly per-class** (branched, hidden, or have class-specific content):

| # | Tab | Path | Category | Classification | Marina | STR | MF | Effort | Cross-ref |
|---|---|---|---|---|---|---|---|---|---|
| 16 | Storage Leases / Listings & Units / Unit Mix | `workspace/unit-mix-leases.tsx` | tab | unified (label from registry) | full | full | full | none | §3.5 unitMix tabIcon bug |
| 17 | Commercial Leases | `workspace/commercial-leases.tsx` | tab | hidden | hidden via `tabs.commercialLeases=false` | hidden | hidden | medium (MF retail/mixed-use may want this; not MVP class) | §3.5 placeholder |
| 18 | Profit Centers (dynamic) | `workspace/profit-centers-dynamic.tsx` | tab | unified (config-driven) | full (8+ depts) | hidden (showTab=false) | full (6 depts as "Other Income") | none | — |
| 19 | Physical Storage step (wizard only, no workspace tab) | wizard step | wizard-step | hidden | full | hidden | hidden | medium (decide if non-marina ever needs) | §3.5 storage step generalization |
| 20 | Replacement Cost | `workspace/replacement-cost.tsx` | tab | branched (marina-hardcoded inputs: floating docks, pilings, slips, dry racks) | full (rich UI) | hidden | hidden | **large** (build per-class replacement-cost models for STR + MF) | §3.5 worked example — Phase 4 anchor |
| 21 | Pro Forma | `workspace/pro-forma.tsx` | tab | unified (driven by `PRO_FORMA_REGISTRY`) | full | full | full | none | — |
| 22 | Pro Forma Charts | `workspace/pro-forma-charts.tsx` | tab | unknown (TBD Pass 2) | TBD | TBD | TBD | TBD | — |
| 23 | Historical P&L | `workspace/historical-pl.tsx` | tab | likely unified | TBD | TBD | TBD | TBD | — |
| 24 | Stabilized NOI | `workspace/stabilized-noi.tsx` | tab | likely unified | TBD | TBD | TBD | TBD | — |
| 25 | Pricing | `workspace/deal-pricing.tsx` | tab | likely unified | TBD | TBD | TBD | TBD | — |
| 26 | Property Tax | `workspace/property-tax.tsx` | tab | likely unified | TBD | TBD | TBD | TBD | — |
| 27 | DCF | `workspace/dcf-calculator.tsx` | tab | likely unified | TBD | TBD | TBD | TBD | — |
| 28 | Returns / Multi-Year / Exit / PE Waterfall | various | tab | unified (Fund-level math) | full | full | full | none | — |
| 29 | IRR Attribution | `workspace/irr-decomposition.tsx` | tab | unified (open product question §3.5: keep/remove/tier-gate) | TBD | TBD | TBD | small (UX decision) | memory `project_irr_attribution_value_review` |
| 30 | Mark-to-Market | `workspace/mark-to-market.tsx` | tab | unified (tooltip gap §3.5) | TBD | TBD | TBD | small (UX) | memory `project_mark_to_market_explanation_tooltip` |
| 31 | Audit Trail | `workspace/audit-trail.tsx` | tab | unified (500 bug §3.5) | bug | bug | bug | small (fix) | memory `project_audit_trail_500` |
| 32 | Assumption Audit | `workspace/assumption-audit.tsx` | tab | unified (HTML-not-JSON bug §3.5) | bug | bug | bug | small (fix) | memory `project_assumption_audit_html_response` |
| 33 | IC Memo | `workspace/ic-memo.tsx` | tab + report | partial (token resolver has marina branch) | full | partial | partial | medium | branched logic surface #59 below |
| 34 | Investment Materials | `workspace/investment-materials.tsx` | tab | TBD Pass 2 | TBD | TBD | TBD | TBD | — |
| 35 | Comps & Links | `workspace/...` | tab | TBD Pass 2 | TBD | TBD | TBD | TBD | — |
| 36 | Operator Benchmark | `workspace/operator-benchmarking.tsx` | tab | TBD Pass 2 (likely marina-flavored) | TBD | TBD | TBD | TBD | — |
| 37 | Environmental Risk | `workspace/environmental-risk.tsx` | tab | TBD Pass 2 | TBD | TBD | TBD | TBD | — |

(Rows 22–37 marked TBD will be revisited in Pass 2 with hands-on per-class navigation.)

### 2.C — Marina-vertical features (dedicated-vertical, intentionally marina-only)

These are entire modules built for marinas. Cataloged for completeness; NOT "leaks" but they create per-class asymmetry in the product surface area available to friendlies.

| # | Surface | Location | Marina | STR | MF | Effort to MVP-parity equivalent |
|---|---|---|---|---|---|---|
| 38 | Marina Property Intelligence Map | `client/src/pages/marina-database.tsx` + `client/src/pages/marinamatch/` + `server/marinamatch/*` | full | none | none | large (build STR + MF Property Intelligence equivalents) |
| 39 | Marina sales comps + rate comps | `client/src/components/salescomps/` + `client/src/components/ratecomps/` | full | none | none | large (STR + MF have different comp data sources) |
| 40 | Marina rate comps wizard | `client/src/components/ratecomps/rate-comps/PortfolioWizard.tsx` | full | none | none | large |
| 41 | Marina-specific integrations | `server/integrations/connectors/{dockwa,dockmaster,marina-office,scribble}.ts` | full | none | none | large (STR has Hospitable/Guesty/OwnerRez; MF has Yardi/RealPage — none built) |
| 42 | Dockit module (marina ops tracker) | `modules/dockit/` (front + back + schema) | full | none | none | large (intentionally a separate product surface) |

### 2.D — Onboarding wizard

| # | Surface | Location | Category | Classification | Marina | STR | MF | Effort | Cross-ref |
|---|---|---|---|---|---|---|---|---|---|
| 43 | Wizard step structure (10 steps, 3 conditional) | `OnboardingWizard.tsx:316-329` | wizard | unified (via `shouldShowStep`) | 10 steps shown | 7 steps shown | 8 steps shown | none | — |
| 44 | Storage step UI | `OnboardingWizard.tsx` | wizard-step | branched (marina-flavored fields: wet slips, dry storage) | full (rich) | hidden | hidden | medium | §3.5 storage step generalization |
| 45 | Amenities step UI | `OnboardingWizard.tsx` | wizard-step | branched (uses `AMENITY_CATALOG` from marina-catalog) | full | hidden | hidden | medium |  — |
| 46 | Profit Centers step UI | `OnboardingWizard.tsx` | wizard-step | branched (uses marina `PROFIT_CENTER_CATALOG`) | full | hidden | partial (uses MF profitCenters from registry) | medium | — |
| 47 | WizardData shape (`marinaName`, `marinaAddress` baked in) | `OnboardingWizard.tsx:285-286` | wizard-data | branched (marina field names leaking to non-marina) | full | partial | partial | medium-large (rename to entity-generic, migrate consumers) | — |
| 48 | DealType `owned_marina` option | `OnboardingWizard.tsx:77,395` | wizard-data | branched (no STR or MF equivalents) | full | none | none | small (add operator/owned equivalents) | — |
| 49 | Asset class catalog (`PROFIT_CENTER_CATALOG`, `AMENITY_CATALOG`) | `shared/marina-catalog.ts` | data | dedicated-vertical (marina-only) | full | none | none | medium (create per-class catalogs or rename to generic and have wizard read from `MODEL_CONFIG_REGISTRY.profitCenters/amenities`) | — |
| 50 | Multi-property mode ("multi-marina") | `OnboardingWizard.tsx:701-724` | wizard-flow | branched (data shape uses `validMarinas`) | full | partial | partial | small | memory `project_wizard_portfolio_mixed_classes` |
| 51 | Asset class card grid (16 classes) | `OnboardingWizard.tsx:79` | wizard-step | unified (16 cards) | full | full | full | none | — |

### 2.E — Document templates

| # | Surface | Location | Category | Classification | Marina | STR | MF | Effort | Cross-ref |
|---|---|---|---|---|---|---|---|---|---|
| 52 | OM templates | `server/templates/om-templates/{marina,multifamily,hotel,industrial,retail}-om.ts` | template | per-class explicit | full (`marina-om.ts`) | **none** (no `str-om.ts`) | full (`multifamily-om.ts`) | medium (build str-om.ts) | — |
| 53 | DD checklist templates | `server/templates/ddTemplates/{marina,generalCre,addons,quickStart}.ts` | template | branched (only marina has dedicated DD; rest fall back to `generalCre.ts`) | full | partial (generalCre) | partial (generalCre) | medium-large (build str + multifamily DD checklists) | — |
| 54 | Doc-builder section library | `shared/document-builder/section-library.ts` — 23 sections | template | branched | partial (1 explicit "Marina Operations" section, plus marina-flavored defaults in `Rent Roll Analysis`, `Storage Revenue Analysis`) | partial (uses universal sections; missing STR-specific Booking Mix / Platform Distribution / ADR Seasonality sections) | partial (uses universal sections; missing MF-specific Unit Mix / Concessions / Loss-to-Lease sections) | large (build per-class section variants) | memory says 11/23 marina-flavored |
| 55 | Section: "Marina Operations" | `section-library.ts:1527` | template-section | branched (marina-only by name) | full | N/A | N/A | small (rename to generic Operations OR build per-class equivalents) | — |
| 56 | Section: "Storage Revenue Analysis" | `section-library.ts:777` | template-section | branched (marina-flavored defaults) | full | partial (could be reframed Listing Revenue Analysis) | partial (could be Other Income Analysis) | small | — |
| 57 | Section: "Rent Roll Analysis" (Summer/Winter rolls) | `section-library.ts:703` | template-section | branched (marina seasonality assumption in defaults) | full | partial (STR has High/Low Season, not Summer/Winter) | partial (MF has no seasonal rolls) | small | — |
| 58 | Section: "Ground Leases" | `section-library.ts:389` | template-section | unified | universal | universal | universal | none | — |

### 2.F — Branched code paths (explicit `if (assetClass === 'X')`)

| # | Surface | Location | Branch on | Marina behavior | STR behavior | MF behavior | Effort | Notes |
|---|---|---|---|---|---|---|---|---|
| 59 | Default rent-roll columns | `shared/schema.ts:22485` | `'marina' \|\| !assetClass` | full marina column set (boatType, slipLength, ratePerFtMo, etc.) | non-marina hides 14 marina columns, relabels storageType→"Unit Type" | same as STR | small (generalize to registry-driven column set) | direct branch |
| 60 | Deal fit scoring | `client/src/components/crm/deal-scoring.tsx:437-438` | `'marina'` (80), `'multifamily'` (70), else default | scored 80 (primary focus) | not in branch → default | scored 70 | small (move to data table) | direct branch |
| 61 | Storage sub-type lookup | `client/src/lib/storage-sub-types.ts:20` | `'marina'` | marina-specific sub-types | falls through | falls through | medium | direct branch |
| 62 | Pro-forma profit-centers enrichment | `server/services/pro-forma-engine-service.ts:579` | `'marina'` | runs `enrichFromProfitCenters` (8 queries) | skipped | skipped | medium (decision: do MF/STR need similar enrichment from operations side?) | spec §7.B item #1 (already documented) |
| 63 | Pro-forma STR KPI block (ADR/Occ/RevPAR) | `server/services/pro-forma-engine-service.ts:1505` | `'str'` | not produced | full KPI block (ADR, Occ, RevPAR, per-year arrays) | not produced | none | direct branch — intentional |
| 64 | Token resolver: slip count fallback | `server/services/document-builder/token-resolver-service.ts:107` | `'marina'` | reads slips ?? capacity ?? units | falls through | falls through | small (generalize via unit count) | direct branch |
| 65 | Token resolver: assetClass coalesce | `server/services/document-builder/token-resolver-service.ts:137-138,157` | `'marina'` default x3 | marina assumed when missing | falls through | falls through | small (remove marina defaults) | direct branch |
| 66 | Doc-intel marina regex patterns | `server/services/doc-intel-service.ts:L211/L219,L2401-2441,L2528` | implicit (4 code paths) | full marina pattern matching | falls through | falls through | medium | §3.5 documented 2026-05-18 |

### 2.G — Schema-level marina shape leaks

| # | Surface | Location | Category | Marina | STR | MF | Effort | Notes |
|---|---|---|---|---|---|---|---|---|
| 67 | `rentRollColumns` default set | `shared/schema.ts` `DEFAULT_RENT_ROLL_COLUMNS` | schema-data | full | uses non-marina branch (#59) | uses non-marina branch (#59) | medium | tightly coupled to #59 |
| 68 | Marina-only column IDs in rent-roll | `boatType, boatLength, slipLength, ratePerFtMo, isLiveaboard, ...` (14 cols) | schema-data | full | hidden | hidden | small (move to registry-driven column visibility) | — |
| 69 | `crm_deals.modeling_project_id` link (deal→model bridge) | `shared/schema.ts` | schema | unified | unified | unified | none | — |

### 2.H — Doc intelligence pipeline

| # | Surface | Location | Category | Marina | STR | MF | Effort | Notes |
|---|---|---|---|---|---|---|---|---|
| 70 | LLM prompt builder (per-class hints) | `server/services/doc-intel-service.ts` (consumed via `getDocIntelPromptHints`) | prompt | full | full | full | none | shipped commit 11b7f18f |
| 71 | Built-in regex extraction (L211/L219) | `doc-intel-service.ts` | extraction | branched (marina patterns: wet slip, dry storage, winter storage) | falls through to generic | falls through | medium | §3.5 documented |
| 72 | Tier-inference fallback (L2401-2441) | `doc-intel-service.ts` | extraction | branched (dockage/slip rental keywords) | falls through | falls through | small | §3.5 |
| 73 | `inferDeptForActual` assetClass plumb | `doc-intel-service.ts:L2528` (TODO comment) | extraction | partial | partial | partial | small | §3.5 |
| 74 | `pct()` helper boundary at 1 | `direct-input-engine.ts:956` | engine-helper | bug | bug | bug | small (decision pending — 3 candidates in §3.5) | §3.5 newly added 2026-05-19 |

### 2.I — Rent-roll v2 asset strategies

| # | Surface | Location | Category | Marina | STR | MF | Effort | Notes |
|---|---|---|---|---|---|---|---|---|
| 75 | Asset strategy per class | `server/services/rent-roll-v2/assetStrategies/` | per-class adapter | `marina.ts` | **none** (no `str.ts`) | `multifamily.ts` | medium (build STR adapter) | — |
| 76 | Analytics per class | `assetStrategies/{class}Analytics.ts` | per-class analytics | implied | **none** | `multifamilyAnalytics.ts` | medium | — |
| 77 | Marina lease engine | `rent-roll-v2/marinaLeaseEngine.ts` | engine | full | none | none | medium-large (likely need str + mf equivalents OR generalize) | — |

### 2.J — Dead / orphan surfaces

| # | Surface | Location | Status | Lines | Notes |
|---|---|---|---|---|---|
| 78 | `valuator-*.tsx` stack (9 files) | `workspace/valuator-{boat-rentals,bookkeeping,commercial-tenants,fuel-sales,operations-summary,parking-lot,profit-centers,service-dept,ship-store}.tsx` | **ORPHAN** (imported but not rendered) | 5,375 total | `workspace.tsx:104` imports `ValuatorProfitCenters` but `workspace.tsx:999` renders `ProfitCentersDynamic` instead. Pre-dynamic-era code. Surfaced as part of this audit. |
| 79 | `inputs.tsx.bak`, `inputs.tsx.marina-bak`, `debt-inputs.tsx.bak`, `uploads.tsx.pre-purge.bak` | `workspace/` | backup files in git | — | Tech debt; clean up. |

### 2.K — Universal surfaces (no per-class content needed — captured for completeness)

These 35+ workspace tabs use unified math/data layer and do not branch on asset class: Overview, Summary, Advisor Review, Document Uploads, Scenario Config, Model Versions, Audit Trail (modulo §3.5 500 bug), Assumption Audit (modulo §3.5 HTML bug), Debt, Loan Sizing, Capital Stack, Exit Strategy, DCF, Hold Period CF, PE Waterfall, Waterfall Sensitivity, Returns, Multi-Year, Depreciation, Tax & Distributions, Analytics, Scenario Compare, Deal Compare, Sensitivity, Monte Carlo, Stress Tests, Benchmark Overlay, Comp Adjustments, Operator Benchmark (TBD Pass 2), Environmental Risk (TBD Pass 2), Fund Metrics, Fund Cash Flow, G&A Model, GP Partners, LP Reporting, Portfolio Risk, Export.

---

## 3. Pass 1 surprises worth Brett's attention

### S1. Orphan valuator-* stack — 5,375 lines of dead marina-specific code

**Finding:** Nine `valuator-*.tsx` files (boat rentals, fuel sales, ship store, service dept, parking lot, bookkeeping, commercial tenants, operations summary, profit centers orchestrator) total 5,375 lines and are imported by `workspace.tsx:104` but never rendered. `workspace.tsx:999` renders `ProfitCentersDynamic` instead.

**Status:** Pre-dynamic-era marina-specific profit-center UIs, made obsolete when `profit-centers-dynamic.tsx` shipped to drive content from `MODEL_CONFIG_REGISTRY.profitCenters.departments`.

**Implication:** Big bundle-size + maintenance overhead with zero user-facing value. Surface to §3.5 as a cleanup candidate.

**Recommendation:** Delete the entire `valuator-*` stack OR (if any logic should be preserved) reconcile against `ProfitCentersDynamic` first to identify any UI patterns worth migrating into the dynamic version.

### S2. STR has no OM template, no DD template, no rent-roll-v2 adapter

**Finding:**
- `server/templates/om-templates/`: marina-om, multifamily-om, hotel-om, industrial-om, retail-om — **no str-om.ts**.
- `server/templates/ddTemplates/`: marina.ts + generalCre.ts fallback — STR and MF both fall back to generic CRE.
- `server/services/rent-roll-v2/assetStrategies/`: marina, multifamily, hotel, retail, rvPark, selfStorage, cre, default — **no str.ts**.

**Implication:** A friendly trying to demo an end-to-end STR workflow today has no class-specific OM, DD checklist, or rent-roll lifecycle. They get the generic CRE fallback.

**Recommendation:** STR OM template, STR DD checklist, and STR rent-roll v2 adapter are three concrete Phase 4 scope items.

### S3. Marina has the shortest field set in COA_FIELD_REGISTRY (27 lines)

**Finding:** Marina's direct-input field list is 27 lines vs STR 57 vs MF 50. Suggests marina's direct-input flow asks the user for fewer assumptions than STR or MF — which is institutionally odd given marinas are operating-business-heavy (fuel, store, service, boat rentals).

**Implication:** The 9 valuator-* surfaces (marina-specific operating ledger UIs) were *supposed* to fill this gap pre-dynamic. Now they're orphan, so the gap is real: direct-input marina projects can't enter fuel/store/service/boat-rental assumptions through the new flow.

**Cross-link with S1:** Deleting valuator-* without restoring this content shipped via `ProfitCentersDynamic` would regress marina.

**Recommendation:** Audit whether `ProfitCentersDynamic` actually captures the operating-business inputs that `valuator-*` previously captured. If yes, S1 is safe to delete. If no, that's a real per-class content gap for marina, not just STR/MF.

### S4. `WizardData.marinaName` / `marinaAddress` leak to non-marina projects

**Finding:** `OnboardingWizard.tsx:285-286,466-467` defines `marinaName: string; marinaAddress: MarinaAddress` on the wizard state. Non-marina classes go through the same wizard but inherit this field shape. The wizard's multi-property mode iterates `validMarinas`, not `validProperties`.

**Implication:** Asset-class-agnostic principle #1 (§5) violation at the wizard data layer. Affects every non-marina friendly who goes through onboarding. May explain why some downstream consumers default to marina (per branch #65 in the table — token-resolver assumes marina when missing).

**Recommendation:** Rename `marinaName` → `entityName` / `propertyName` and `marinaAddress` → `propertyAddress`. Treat as a Phase 1 cleanup; not a Phase 1.5 content gap.

### S5. PROFIT_CENTER_CATALOG and AMENITY_CATALOG in `shared/marina-catalog.ts` are marina-only

**Finding:** These catalogs power the wizard's Profit Centers and Amenities steps. They're entirely marina-specific (17 profit centers — wet slips, fuel, ship's store, boat sales, dockage; 20 amenities — pump-out, shore power, dinghy dock). Non-marina classes have these steps hidden via `shouldShowStep`, so they don't see them.

**Implication:** For MF, the wizard has a Profit Centers step that DOES show (because `cfg.profitCenters.showTab=true`), but it uses the marina catalog. (Needs Pass 2 verification — likely the MF wizard renders profit-centers via a different code path, but if not, this is a wizard-level branched-content bug.)

**Recommendation:** Verify in Pass 2 Journey A (MF wizard) whether profit-centers step content is marina-leaking. If yes, the catalog needs to become per-class or the step needs to read from `MODEL_CONFIG_REGISTRY.profitCenters.departments` directly.

### S6. Marina is the only MVP class with `tabs.commercialLeases: true`

**Finding:** Per the registry tab gates, marina has 5/5 tabs on; MF has 3/5 on; STR has 1/5 on.

**Implication:** Marina projects show Commercial Leases tab. MF projects don't, even though many MF properties have retail/commercial space on ground floor (mixed-use overlap). STR projects don't (correctly — STRs don't have commercial tenants).

**Recommendation:** Open product question: should MF show Commercial Leases when the project is mixed-use-ish? Not blocking for MVP; surface in §6 open decisions.

### S7. STR COA is 7x deeper than Marina or MF COA

**Finding:** `STR_COA` = ~264 lines · `MARINA_COA` = ~35 lines · `MULTIFAMILY_COA` = ~34 lines. The depth was built into STR during Day 9 work (memory `project_str_coverage_audit_2026_05_19`).

**Implication:** STR direct-input math is the deepest of the 3 MVP classes. Marina and MF math is comparatively under-built. This explains why "the fixture seed pattern" can be copied STR→MF (memory `38421aea` reference) but marina has a different ledger model entirely (operating business, not just rental income).

**Recommendation:** Pass 3 prioritization should weigh whether to bring marina + MF COAs to STR-depth, or to accept that marina/MF have simpler structural models. Probably MF deserves more depth; marina deserves the operating-business content currently orphaned in valuator-*.

---

## 4. Journey friction log (Pass 2)

### 4.0 Methodology note

This is a **code-walkthrough** journey, not a live browser-clickthrough. The dev server was not started for this pass — instead, every component, route, and registry the user would touch in each step was read directly. This is honest about its limits: I can verify what the code does today, but not screen-level rendering quirks (z-index issues, CSS regressions, race conditions, exact pixel positioning). Where browser-only friction would only surface via UI, I flag it explicitly as `[needs-browser-verify]`.

### 4.1 S1 verification — CRITICAL result

**Pass 1 framing was wrong, and the corrected finding is more useful than the original concern.**

**What I expected to find:** `ProfitCentersDynamic` covers X% of valuator-*'s functionality; the gap = marina content that needs to move.

**What I actually found:** `ProfitCentersDynamic` and the orphan `valuator-*` stack solve **different problems**. They are not migration peers.

**Evidence:**

- `ProfitCentersDynamic` (`workspace/profit-centers-dynamic.tsx`, 386 lines): reads `getModelConfig(assetClass).profitCenters.departments`. For each department, the user enters **forward-looking monthly $ assumptions** in three buckets (revenue / COGS / expense). It's a **modeling-assumption form** for the multi-year projection. State persists to `modeling_projects.profitCentersData`.

- `valuator-fuel-sales.tsx` (657 lines): reads `/api/operations-context/projects/:projectId/ops/fuel`. Per-transaction record entry — `txnDate`, `fuelType`, `gallons`, `grossSales`, `cogs`. It's an **operational ledger entry UI**, not modeling. Same pattern in `valuator-ship-store.tsx` (per-transaction `category`, `grossSales`, `cogs`, `txnCount`) and `valuator-boat-rentals.tsx` (per-rental `rentalDate`, `hours`, `grossSales`, `channel`, `boatType`).

- The **real successor to valuator-*** is the `pages/operations/` tabbed-module stack, e.g., `pages/operations/fuel/{Dashboard,Transactions,Inventory,Analytics,Reports,FinancialModel,ImportHistory,AuditTrail}.tsx` (10 dedicated fuel module files). Same pattern for Ship Store (`ShipStoreTabbed.tsx`), Boat Rentals (`BoatRentalsTabbed.tsx`), Service (`ServiceTabbed.tsx`), Boat Club, Boat Sales, Bookkeeping, etc.

**S1 result: valuator-* IS safe to delete.** The 5,375 lines are dead code superseded by the `pages/operations/*Tabbed.tsx` stack (which is the active operations-context UI in the sidebar) AND by `ProfitCentersDynamic` (which is the active modeling-assumption UI in the workspace).

**Overlap calculation: 0%.** No content lives only in `valuator-*` that doesn't live in either the ops-context successors or the modeling-dynamic component. ProfitCentersDynamic covers the modeling axis (forward $/mo assumptions). The ops/* tabbed modules cover the operations axis (per-transaction record entry).

**Architectural correction for the audit doc:** Pass 1 S3 ("Marina has the shortest field set in COA_FIELD_REGISTRY") is NOT actually masked by valuator-* migration risk. The valuator-* stack was never feeding COA_FIELD content — that's a different axis entirely. The shallow MARINA_FIELDS (27 lines) remains a real but separate content gap.

### 4.2 S5 verification — Profit Centers step in MF wizard

**Result: NOT a leak.** Wizard's Profit Centers step uses `getAssetClassCatalog(assetClass)` (line 514 in `OnboardingWizard.tsx`), which dispatches to per-class catalogs in `shared/asset-class-catalog.ts` (a separate registry from `marina-catalog.ts`).

For MF wizard pass, user sees the 7 entries in `MULTIFAMILY_PROFIT_CENTERS`: Residential Rent, Parking, Laundry & Vending, Pet Fees, Storage Units, Application & Admin Fees, Utility Reimbursement.

For STR wizard pass, user sees the 5 entries in `STR_PROFIT_CENTERS`: Nightly Revenue, Cleaning Fees, Extra Guest Fees, Pet Fees, Early/Late Check Fees.

**However, S5 produced a new finding:** there are now **two parallel per-class profit-center registries** in the codebase:
1. `MODEL_CONFIG_REGISTRY[ac].profitCenters.departments` (used by workspace's `ProfitCentersDynamic`)
2. `asset-class-catalog.ts.{ASSET}_PROFIT_CENTERS` (used by wizard)

These DO NOT MATCH. For MF:
- Workspace registry has 6 departments: parking, laundry_vending, pet_fees, utility_reimbursement, storage_units, application_fees.
- Wizard catalog has 7 entries: residential_rent + the same 6.

That's the only difference (workspace registry assumes residential rent is modeled via the unit-mix tab, not as a "profit center"), but the dual-source for the same conceptual data is fragile. **NEW SURFACE — flagging as a registry drift candidate for §3.5.**

### 4.3 Journey A — Investor/Operator evaluating MF deal

Friction entries reference the surface number from Section 2 where applicable. Severity scale: **blocker** (cannot complete journey) · **friction** (works but jarring) · **nice-to-have** (could be better) · **none** (works correctly).

| # | Step | What user sees | Class-appropriate? | Marina-leaking? | Missing content? | Severity |
|---|---|---|---|---|---|---|
| A1 | Login → land on dashboard (`pages/dashboard.tsx`) | Dashboard renders persona-driven modules (QuickAccessSection, FundSelector, RevenueCharts, CRMCharts, etc.). Imports `Fuel`, `ShoppingCart`, `Anchor` icons among many — these only render when their module is enabled. | Yes — dashboard is module-driven, not class-driven. | No (icons present but only render for relevant modules). | MF-specific KPI tiles (NOI, $/Unit, Cap Rate, Avg Rent) don't appear on dashboard unless a specific module wires them. Friendly may not see a "this is a multifamily portfolio at a glance" landing. | nice-to-have |
| A2 | Open New Project Wizard | Dialog title shows `<Anchor />` icon if `assetClass==="marina"`, else `<Building2 />` (line 2425 of `OnboardingWizard.tsx`). MF gets generic Building2 — not class-appropriate (a Home or Building icon would fit). | Partial — class detection works, but only 2 icons defined. | Yes — anchor icon is the privileged path. | Per-class wizard icon. Trivial fix. | friction |
| A3 | Wizard step 1: Welcome | Generic welcome step. | Yes. | No. | None. | none |
| A4 | Wizard step 2: Deal Structure | Generic deal-structure picker (single vs portfolio). DealType options include `"owned_marina"` but no MF analog like `"owned_property"` (see Pass 1 row 48). | Partial. | Yes — DealType has marina-flavored enum. | MF-equivalent ownership state. | friction |
| A5 | Wizard step 3: Property Details | Heading reads `{assetTerms.heading}` — class-aware. Property name field is labeled `{assetTerms.property}` (good). **BUT** the underlying state is `state.marinaName` and `state.marinaAddress` regardless of class. UI = correct; data = S4 leak. | Partial (UI correct, data wrong). | Yes — at the data layer (S4). | None visible to user; downstream consumers of project state see `marinaName` on a non-marina project. | friction (UI ok, data integrity issue) |
| A6 | Wizard step 4: Deal Type | Generic. | Yes. | No. | None. | none |
| A7 | Wizard step 5: Profit Centers | Renders 7 MF-appropriate entries from `MULTIFAMILY_PROFIT_CENTERS` in `asset-class-catalog.ts`. Each is a toggle. (S5 confirmed not a leak.) | Yes. | No. | Could be deeper (no per-department revenue ranges shown at this step). | none |
| A8 | Wizard step 6: Amenities | Renders 12 MF-appropriate entries (pool, fitness center, clubhouse, dog park, etc.) from `MULTIFAMILY_AMENITIES`. | Yes. | No. | None. | none |
| A9 | Wizard step 7: Storage | Step **HIDDEN** for MF via `shouldShowStep` (`cfg.tabs.physicalStorage = false` for MF). | Yes. | No. | None. | none |
| A10 | Wizard step 8: Documents | Generic upload step. | Yes. | No. | None. | none |
| A11 | Wizard step 9: Features | Generic feature-flag picker. | Yes. | No. | None. | none |
| A12 | Wizard step 10: Get Started | Generic CTA. | Yes. | No. | None. | none |
| A13 | Land in workspace → Overview tab | `overview-dynamic.tsx` reads `config.kpis` from MULTIFAMILY_CONFIG. Shows 8 KPI tiles: Purchase Price, Cap Rate, Total Units (icon: `home`), NOI, $/Unit, Avg Rent/Unit, Occupancy, Expense Ratio. All MF-appropriate. | Yes. | No. | Could add MF-specific tiles: Loss-to-Lease (already in inputs), Renewal Rate, Concessions. Not blocking. | none |
| A14 | Inputs & Assumptions tab | Renders 5 MF input sections from `MULTIFAMILY_CONFIG.inputSections`: Property Details (12 fields), Rent Assumptions (8 fields), Other Income (8 fields), Operating Expenses (18 fields), Capital Reserves (5 fields). Total ~51 MF-specific fields. | Yes — rich and MF-appropriate. | No. | None obvious. | none |
| A15 | Property Tax tab | Universal; works for MF. | Yes. | No. | None. | none |
| A16 | Storage Leases tab (renamed "Unit Mix" via `unitMix.tabLabel`) | `unit-mix-leases.tsx` (class-aware per Task 4) reads `unitMix.types` from MULTIFAMILY_CONFIG. Shows 9 MF unit types (Studio, 1BR/1BA, 2BR/1BA, 2BR/2BA, 2BR/1.5BA, 3BR/2BA, 3BR/2.5BA, 4BR+, Townhome). Column labels: "Units" + "Avg Rent/Mo" + "Avg SF". Rate type: monthly. | Yes — Task 4 working. | **tabIcon leak** — `unitMix.tabIcon='home'` in MF config, but workspace TAB_GROUPS line 174 hardcodes `Anchor` icon for the "storage-leases" tab entry. Per §3.5 unitMix tabIcon entry — marina-flavored icon leaks to MF/STR. | None content-wise. | friction |
| A17 | Commercial Leases tab | **HIDDEN** for MF (`tabs.commercialLeases = false`). | Yes. | No. | Per S6 — mixed-use MF might want this. Open product question. | none for MVP MF |
| A18 | Profit Centers tab (renamed "Other Income" via `profitCenters.tabLabel`) | `ProfitCentersDynamic` renders the 6 MF departments. User can toggle each, enter monthly $ revenue / monthly $ COGS / monthly $ expense per line item. | Yes. | No. | Per S3 — depth is flat; no volume × rate modeling. Acceptable for MF (revenue is mostly rent-based, covered in unit mix). | none |
| A19 | Document Uploads tab | Universal upload UI. Asset-class-aware doc-intel prompt (commit 11b7f18f) applies during extraction. | Yes. | No. | None. | none |
| A20 | Upload an MF P&L → categorization output | LLM uses `multifamily` docIntelPromptHints (revenueDepts: gross_potential_rent, vacancy_loss, concessions, bad_debt, parking, laundry_vending, pet_fees, utility_reimbursement, etc.). | Yes — shipped 2026-05-18. | No. | `inferDeptForActual` has a `TODO: assetClass not in scope` per §3.5 — uses default vocabulary. **Possible department mis-routing** for MF "Trash Reimbursement"-type lines (§3.5 reimbursement routing entry). | friction |
| A21 | Historical P&L tab | Universal. Renders extracted/promoted actuals. | Yes. | No. | None. | none |
| A22 | Pro Forma tab | `pro-forma.tsx` renders `MULTIFAMILY_PRO_FORMA` shape: GPR → vacancy/concessions/badDebt (indented) → effectiveRent → otherIncome → EGI → 9 operating expense lines → totalExpenses → NOI. | Yes — MF-appropriate structure. | No. | None visible. | none |
| A23 | Pro Forma Charts tab | TBD `[needs-browser-verify]`. Memory `project_pro_forma_chart_flat_zero_bug` says chart plots y=0 across 2026-2030 in some configurations. | Pre-existing bug. | No. | Bug per §3.5. | blocker (if bug triggers for MF) |
| A24 | Stabilized NOI tab | Universal. | Yes. | No. | None. | none |
| A25 | Pricing tab | Universal. | Yes. | No. | None. | none |
| A26 | CapEx Budget tab | Universal. | Yes. | No. | None. | none |
| A27 | Debt / Loan Sizing / Capital Stack | Universal fund-level math. | Yes. | No. | None. | none |
| A28 | Exit Strategy tab | Universal. | Yes. | No. | None. | none |
| A29 | DCF tab | Universal. | Yes. | No. | None. | none |
| A30 | Returns / Multi-Year / Tax & Distributions | Universal. | Yes. | No. | None. | none |
| A31 | Analytics tab | Universal. | Yes. | No. | None. | none |
| A32 | IRR Attribution tab | Universal. Per §3.5, open product question (keep/remove/tier-gate). | Yes. | No. | UX gap. | nice-to-have |
| A33 | Mark-to-Market tab | Universal. Per §3.5, needs tooltip explanation. | Yes. | No. | UX gap. | nice-to-have |
| A34 | **Replacement Cost tab** | **HIDDEN** for MF (`tabs.replacementCost = false`). User does not see this tab. | Yes — appropriate hidden. | No. | If MF Phase 4 wants Replacement Cost, needs MF-specific cost inputs (e.g., $/SF construction + soft costs + land), entirely new component. The existing `replacement-cost.tsx` is 100% marina-hardcoded (floating docks, pilings, slips, dry racks). | none for MVP; **large** for Phase 4 if scoped |
| A35 | Pro Forma Charts / Scenario Compare / Deal Compare / Sensitivity / Monte Carlo / Stress Tests / Benchmark Overlay / Comp Adjustments | All universal. | Yes. | No. | None. | none |
| A36 | Operator Benchmark tab | TBD — likely marina-flavored given the marina vertical's benchmark data sources. `[needs-browser-verify]` | Unknown. | Possible. | TBD. | nice-to-have to verify |
| A37 | Environmental Risk tab | Universal. | Yes. | No. | None. | none |
| A38 | Fund Metrics / Fund Cash Flow / G&A / GP Partners / LP Reporting / Portfolio Risk | Universal fund-level. | Yes. | No. | None. | none |
| A39 | Scenarios group: Cases / Model Versions / Assumption Audit / Audit Trail | Audit Trail tab returns 500 per §3.5 / memory `project_audit_trail_500`. Assumption Audit returns HTML instead of JSON per §3.5. Cases + Versions universal. | Pre-existing bugs. | No. | Bugs per §3.5. | friction (pre-existing) |
| A40 | IC Memo tab | Universal — though token resolver has marina branches (Pass 1 #64, #65 — `slips ?? capacity ?? units` fallback, marina assumed when missing). For MF, would render with `capacity ?? units` path. | Mostly yes. | Minor (token-resolver marina default). | None content-wise. | nice-to-have (clean up branches) |
| A41 | Investment Materials tab | Renders OM-builder hub. Available OM templates filtered by asset class via `getOMTemplatesByAssetClass`. MF gets `multifamilyOMTemplate` (rich, 9+ sections: Exec Summary, Property Overview with unit mix, Financial Analysis with rent roll summary, Rent Roll, Market Overview with submarket demographics, Comparable Sales, Photos, Operations, Appendix). | Yes — full MF coverage. | No. | None. | none |
| A42 | Comps & Links tab | Universal. | Yes. | No. | None. | none |
| A43 | Export tab | Universal. | Yes. | No. | None. | none |
| A44 | Generate IC Memo / OM (download) | MF gets `multifamilyOMTemplate.sections` rendered via doc-builder. Sections include unit mix, rent roll, market demographics. | Yes. | No. | None. | none |
| A45 | Generate DD checklist | **No MF-specific DD template exists.** Falls back to `generalCre.ts` (Pass 1 #53). Friendly sees generic CRE DD items, not MF-tailored items (e.g., no "verify rent roll vs lease files," "T-12 OpEx variance analysis," "submarket vacancy analysis," "lease audit"). | Partial — works but thin. | No (just generic). | Yes — MF DD checklist depth. | friction |
| A46 | Open same project in CRM (`pages/deal-detail.tsx` or `[workspaceId].tsx`) | Deal record page renders. Asset-class field shows "multifamily" badge. | Yes. | No detected. | Per memory `project_deal_workspace_audit_2026_05_07` — there are two deal record pages (13-tab vs 8-tab); marina copy still leaks in one of them. `[needs-browser-verify]` | friction (likely) |
| A47 | Sidebar Operations menu for MF user | If `multifamily_ops` module is enabled, sidebar shows "Multifamily Ops" link → `MultifamilyTabbed`. Has 4 ops tabs: Dashboard, Units, Lease Expiry, Turn Tracking. Marina-only sidebar items (Fuel Sales, Ship Store, Boat Rentals, Boat Club, Boat Sales, Service & Parts, Dockit) are filtered out based on `opsModuleKey`. | Yes. | No (filtered out by module key). | MF has only **4 ops tabs**, marina has **8 dedicated modules**. MF ops depth is shallow by comparison. | friction (MF user has less ops surface than marina user) |

### 4.4 Journey B — Owner uploading marina P&L (Keystone Point)

| # | Step | What user sees | Class-appropriate? | Non-marina-leaking? | Missing content? | Severity |
|---|---|---|---|---|---|---|
| B1 | Login → land on dashboard | Same dashboard component as Journey A. Marina-specific ops modules (Fuel, Ship Store, Boat Rentals, etc.) show up as sidebar items when their packs are active. | Yes. | No. | None. | none |
| B2 | Open Keystone Point project from project list | Workspace loads with marina config. Anchor icon in title, marina KPIs in Overview. | Yes. | No. | None. | none |
| B3 | Inputs & Assumptions tab | `MARINA_CONFIG.inputSections` shows 2 sections: General Assumptions (4 fields), Seasonality (2 fields). **27 total lines in MARINA_FIELDS** (Pass 1 finding S3). | Partial. | No. | Yes — marina inputs are **thinner than MF's 51 fields**. Friendly entering a marina by hand has very few assumption fields available, even though marina is an operating business with rich underwriting (per-pump fuel margin, average ticket, slip occupancy by type, service labor utilization, etc.). | friction |
| B4 | Storage Leases tab | Renders 15 marina unit-mix types via `MARINA_CONFIG.unitMix.types` (Wet Slips Fixed/Floating/T-Head/Side-Tie/Mega/Superyacht, Moorings, Anchorage, Lift Slips, Dinghies, Dry Stack/Rack Indoor, Trailer Parking, RV Sites, Vehicle Parking, Kayak/Paddleboard, Jet Ski, etc.). Column labels: "Slips / Spaces" + "Monthly Rate". Rate type: monthly. Seasonal switches available per type. | Yes — rich. | No. | None. | none |
| B5 | Profit Centers tab | `ProfitCentersDynamic` renders 7 marina departments (Fuel Sales, Ship's Store, Service & Repairs, Boat Rentals, Boat Club, F&B/Restaurant, Third-Party Leases). User toggles each + enters monthly $ revenue / COGS / expense per line item. Each line type has 3 default lines (e.g., Fuel Sales has Gas/Diesel/Pump-Out + COGS + Labor). | Yes. | No. | **S3 confirmed:** ProfitCentersDynamic is flat $/mo entry per line. NO volume × margin modeling (no "gallons sold × markup per gallon", no "labor hours × billable rate", no "occupancy × ticket × turns"). For marina underwriting, this is structurally lighter than needed. Per S1, the deep operational modeling lives in the `pages/operations/fuel/*` tabbed modules — but those don't feed marina's modeling assumptions (they capture actuals only). | friction (marina-modeling math is thinner than marina-ops math) |
| B6 | Physical Storage tab | Only marina has `tabs.physicalStorage = true`. Wizard's Storage step is also gated on this. `[needs-browser-verify]` — what does this tab actually show? May be redundant with Storage Leases. | TBD. | No. | TBD. | nice-to-have to verify |
| B7 | Commercial Leases tab | `tabs.commercialLeases = true` for marina. Renders generic commercial-lease UI (third-party leases at marina, e.g., restaurant tenant). | Yes. | No. | None. | none |
| B8 | Replacement Cost tab | Marina-only. `replacement-cost.tsx` renders 15+ marina-specific cost inputs: floating dock cost per LF, total dock LF, piling cost, piling count, electrical per slip, water per slip, total slips, dry rack cost per unit, dry rack units, building $/SF, total building SF, soft costs %, developer profit %, acquisition price. Outputs: total replacement cost, discount to replacement, replacement multiple, $/slip, cost component pie chart. | Yes — rich. | No. | None for marina. (Per §3.5 this is the worked example — exists for marina, missing for STR/MF.) | none |
| B9 | Upload marina P&L | Marina docIntelPromptHints (persona: "marina/boat storage financial analyst", revenueDepts: storage, fuel, marina_amenities, ship_store_retail, service, parts, ...). Plus the 4 marina-hardcoded regex paths in doc-intel-service.ts (L211/L219, L2401-2441, L2528) trigger for marina. | Yes — rich extraction. | No. | None. | none |
| B10 | Historical P&L | Extracted actuals render. | Yes. | No. | None. | none |
| B11 | Pro Forma | MARINA_PRO_FORMA: 7 revenue items (Wet Slip, Dry Storage, Fuel, Ship Store, Service, Other) → total → 9 expense items → NOI. | Yes — rich. | No. | None. | none |
| B12 | Pro Forma Charts | Same potential bug as Journey A23 per §3.5. `[needs-browser-verify]` | Pre-existing bug. | No. | Bug per §3.5. | blocker if bug fires |
| B13 | DCF / Returns / Exit / Waterfall etc | Universal. | Yes. | No. | None. | none |
| B14 | Investment Materials → generate Marina OM | `marinaOMTemplate` rendered (rich marina-specific sections). | Yes. | No. | None. | none |
| B15 | DD checklist → generate marina DD | `marina.ts` DD template (rich marina-specific items per `server/templates/ddTemplates/marina.ts`). | Yes — only class with dedicated DD. | No. | None. | none |
| B16 | Open Keystone Point in CRM | Asset-class field shows "marina". Per memory `project_deal_workspace_audit_2026_05_07`, marina copy still leaks in one of the two deal record pages (13-tab vs 8-tab variants). `[needs-browser-verify]` | Mostly yes. | N/A (no non-marina to leak). | None. | none |
| B17 | Sidebar Operations menu for marina user | Marina user sees: Bookkeeping, Payroll, Dockit, Rent Roll, Commercial Tenants, Fuel Sales, Ship Store, Service & Parts, Boat Rentals, Boat Club, Boat Sales, Marketing, Budgeting. **13 ops modules.** Each is a fully-tabbed module (e.g., FuelSalesTabbed has 9 sub-tabs: Dashboard, Transactions, Inventory, Analytics, Reports, FinancialModel, ImportHistory, AuditTrail, IntegrationSettings). | Yes — rich. | No. | None. | none |

### 4.5 New surfaces discovered in Pass 2 (not in Pass 1 inventory)

These are surfaces grep missed in Pass 1 because they're in directories or use patterns the Pass 1 sweep didn't query. Adding to inventory.

| # | Surface | Location | Category | Classification | Marina | STR | MF | Notes |
|---|---|---|---|---|---|---|---|---|
| 80 | Operations sidebar (18+ module entries gated by `opsModuleKey`) | `client/src/components/unified-sidebar.tsx:73-91` | navigation | unified (module-gated) | 13 modules | **0 dedicated** | 4 (via MultifamilyTabbed) | Operations sidebar coverage is wildly asymmetric across MVP classes. STR friendlies have NO class-specific operations entry point. |
| 81 | Class-specific tabbed ops modules | `client/src/pages/operations/{Multifamily,Hotel,RetailOffice,SelfStorage,FuelSales,ShipStore,Service,BoatRentals,BoatClub,BoatSales,Dockit,Bookkeeping,Marketing,Budgeting,Payroll,RentRoll}Tabbed.tsx` | tabbed-module | dedicated-per-class | full × 8 | **none** | full × 1 (MultifamilyTabbed: 4 tabs) | STR has zero dedicated ops modules. MF has one (4 tabs). Marina has 8+ (each with 5-9 sub-tabs). |
| 82 | `pages/operations/fuel/*` (10 files) | `client/src/pages/operations/fuel/{Dashboard,Transactions,Inventory,Analytics,Reports,FinancialModel,ImportHistory,AuditTrail,IntegrationSettings,Settings}.tsx` | per-class deep ops UI | dedicated-per-class | full (very deep) | N/A | N/A | The "real successor" to `valuator-fuel-sales.tsx`. Confirms S1 result. |
| 83 | `pages/operations/multifamily/*` (4 files) | `Dashboard.tsx, Units.tsx, LeaseExpiry.tsx, TurnTracking.tsx` | per-class deep ops UI | dedicated-per-class | N/A | N/A | full (shallow vs marina equivalent) | MF ops module exists but is much shallower than marina's stack. |
| 84 | `pages/operations/<class>` STR path | does not exist | per-class deep ops UI | missing | N/A | **none** | N/A | STR friendlies cannot access class-specific operations UI. |
| 85 | Parallel per-class profit-center catalogs (S5 finding) | `MODEL_CONFIG_REGISTRY[ac].profitCenters.departments` vs `asset-class-catalog.ts.{ASSET}_PROFIT_CENTERS` | registry | drift | both registries populated, slightly different content (MF: 6 in workspace vs 7 in wizard) | both populated | both populated | **Registry drift candidate for §3.5.** Single source of truth violation — two registries with same conceptual data and similar but non-identical entries. |
| 86 | Property Details wizard step function name `renderMarinaDetailsStep` | `OnboardingWizard.tsx:1266` | wizard-internal | branched (marina-named function for universal step) | full | full | full | Functionally universal but name leaks marina origin; cosmetic but reinforces S4 narrative. |
| 87 | Wizard dialog header icon | `OnboardingWizard.tsx:2425` | wizard | branched | Anchor icon | Building2 (generic) | Building2 (generic) | Only marina gets a class-specific dialog icon; trivial fix — read from `config.unitMix.tabIcon` or similar. |
| 88 | Portfolio mode terminology `portfolioMarinas` | `OnboardingWizard.tsx:1284,701` | wizard-data | branched | full | partial | partial | Even for non-marina portfolio mode, internal state and variable names are `validMarinas` / `portfolioMarinas`. Pairs with S4. |

### 4.6 Pass 2 articulation block

**Friction log entries by severity:**

| Severity | Count |
|---|---|
| blocker | 2 (Pro Forma Charts bug A23/B12 — pre-existing, fires under unknown conditions) |
| friction | 12 (mostly thin content + label/icon/data-name leaks + pre-existing §3.5 bugs) |
| nice-to-have | 6 |
| none | ~40 (universal surfaces working as expected) |

**S1 migration-completeness result: 0% overlap between ProfitCentersDynamic and valuator-* stack.** They solve different problems. Valuator-* is operations-context ledger entry; ProfitCentersDynamic is modeling-assumption form. Real successor to valuator-* is the `pages/operations/*Tabbed.tsx` stack. **Recommendation: safe to delete valuator-* stack with zero functional regression.** Pass 1 S3 (thin MARINA_FIELDS) is a separate concern not masked by valuator-* migration risk.

**S5 confirmation result: NOT a leak.** Wizard uses `getAssetClassCatalog(assetClass)` which dispatches to per-class catalogs in `shared/asset-class-catalog.ts`. MF gets MF content, STR gets STR content. **But** Pass 2 found a related issue: two parallel per-class profit-center registries exist (workspace's `MODEL_CONFIG_REGISTRY[ac].profitCenters.departments` vs wizard's `asset-class-catalog.ts.{ASSET}_PROFIT_CENTERS`) — registry drift candidate for §3.5.

**New surfaces found in Pass 2 (not in Pass 1 inventory): 9 (rows 80-88).** Well under the 20-surface stop condition. Key adds:
- Operations sidebar module asymmetry (marina 13 / MF 4 / STR 0)
- Class-specific tabbed-ops module stack (marina 8 / MF 1 / STR 0)
- Parallel profit-center registry drift
- Wizard dialog icon leak

**Architectural correction worth surfacing:** The audit's most useful Pass 2 finding is that **the operations sidebar + per-class tabbed ops module stack is itself a major surface area where Phase 4 content depth lives**. Pass 1 framed Phase 4 as primarily about workspace tabs + document templates + COA depth. Pass 2 reveals that **per-class operations UI depth is a separate (and currently more asymmetric) axis**. STR friendlies have zero class-specific operations modules today; MF friendlies have one shallow one. Marina has the gold standard with 13 module entries and 8 dedicated tabbed modules. This is a meaningful Phase 4 scope question.

**Pass 3 prioritization recommendation, informed by Pass 2 findings, leaning per task guidance toward (c) user-visible per-class polish surfaces:**

1. **STR OM template, STR DD checklist** — concrete, scoped, addresses immediate friendly demo gap. Pass 1 + Pass 2 both surfaced. (medium each, ~4-6h total)
2. **Wizard data shape S4 fix** — rename `marinaName`/`marinaAddress` → `propertyName`/`propertyAddress` end-to-end, plus dialog icon, plus `renderMarinaDetailsStep` rename, plus `portfolioMarinas` → `portfolioProperties`. (medium, ~3-5h, touches schema + state + ~10 read sites)
3. **Storage Leases tab `Anchor` icon hardcoded leak** (Pass 2 A16) — quick win for visible non-marina friction. (small, ~30 min)
4. **MF DD checklist** — friendly evaluating MF deal today gets generic CRE DD; deserves MF-tailored items. (medium, ~3-4h)
5. **valuator-* stack deletion** — 5,375 lines of dead code, zero regression risk per S1 verification. (small, ~1h)
6. **Operations sidebar STR module decision** — product question: does STR need a dedicated tabbed ops module? If yes, scope it. (large if scoped to build; small if scoped to defer.)
7. **Wizard Property Details data flow** — even after rename, the underlying schema may need migration. (depends on #2)
8. **Parallel profit-center registry drift** (Pass 2 #85) — reconcile or document the dual-source intent. (small, ~1h)
9. **Audit Trail 500 / Assumption Audit HTML** — pre-existing §3.5 bugs that fire in both Journey A and Journey B. (small each)
10. **Replacement Cost for STR + MF** — large, deferred per §3.5; not in top 10 if leaning (c) since users don't need it for demo flow.

Decision points the user should weigh:
- **Operations sidebar parity**: Does STR need a dedicated MultifamilyTabbed-style module? Or is STR's operating model thin enough (one listing, one channel mix, one PMS) that no dedicated module is needed?
- **Phase 4 depth-vs-breadth**: Do we deepen MF/marina COA_FIELD sets (Pass 1 S3, S7) to STR-depth, or accept the structural difference?
- **Per-class DD checklists**: Just MF for MVP? Or both MF + STR?

**Confirmed scope: NO code changes today, only documentation.**

## 5. Prioritized work list (Pass 3)

Surfaces are ranked into two columns: **Core (Phase 4a candidates)** and **Ops (Phase 4b candidates)**, per §3.7 product structure split. Each row has friendly-value (0-5), effort (S <2h · M 2-8h · L >8h), and dependencies.

Friendly-value scale (0-5): **5** = friendly will notice missing immediately during a demo · **4** = friendly will notice within first session · **3** = friendly will notice on second session or close inspection · **2** = friendly may notice eventually · **1** = friendly likely never notices · **0** = internal-only cleanup.

### 5.A — Core (Phase 4a) — 18 items

The top 4 are the **Phase 4a anchors** per Brett's Q4 direction. Remaining 14 are ranked but flexible within Phase 4a scope.

| Rank | Surface | Friendly-value | Effort | Dependencies | Notes |
|---|---|---|---|---|---|
| **1** [ANCHOR] | **STR OM template** — build `server/templates/om-templates/str-om.ts` modeled after `multifamily-om.ts` + STR-appropriate sections (Listing Setup, Channel Mix, Pricing Strategy, Cleaning & Turnover, RevPAR/ADR metrics, comparable STRs). Register in `om-templates/index.ts`. | 5 | M (~6h) | None | Pass 1 #52. Highest-visibility STR demo gap. |
| **2** [ANCHOR] | **S4 wizard data shape fix** — rename `marinaName`→`propertyName`, `marinaAddress`→`propertyAddress`, `portfolioMarinas`→`portfolioProperties` in `OnboardingWizard.tsx` (line 285-286, ~10 read sites). Rename `renderMarinaDetailsStep`→`renderPropertyDetailsStep`. Dialog header icon read from `config.unitMix.tabIcon`. Plus DealType `owned_marina`→`owned_property`. | 4 | M (~6h) | Schema migration check (no DB writes today, but check downstream readers of project state). | Pass 1 S4 / Pass 2 rows 86-88. |
| **3** [ANCHOR] | **User-editable COA mapping** — settings UI for org-level COA overrides. Add `coa_overrides` table, settings page (CRUD per class), wire `inferDepartment` to read overrides before fallback cascade, per-org caching, role permissions, audit log. Per-class COA coverage (Decision 2: relevance-driven) is bundled — friendlies tune defaults via this editor. | 5 | L (~24-30h = 3-4 days) | Depends on resolving registry edit scope (`inferDepartment` cascade only, or PRO_FORMA_REGISTRY too?). | Promoted from §3.6 to Phase 4a on 2026-05-19. Single biggest Core depth lever. |
| **4** [ANCHOR] | **Ops gating mechanism placeholder + Phase 0 design audit for 4b** — design + ship per-project `ownershipState` flag (`owned` / `evaluated` / `null`) in `modeling_projects` schema. Wire sidebar `opsModuleKey` filter to also check `ownershipState === 'owned'` for current project. Document the activation matrix (tier × user_type × ownershipState) and capture decisions in a §3.7 follow-up. This unblocks 4b. | 5 | M (~6-8h spec + minimal stub) | Schema migration for `ownershipState` column. | Per §3.7. Unblocks all Phase 4b work. The Phase 0 audit deliverable is a separate document. |
| 5 | **STR DD checklist** — build `server/templates/ddTemplates/str.ts` with STR-specific items (host fee verification, channel mix audit, occupancy by season, cleaning fee structure, dynamic pricing tool, license/permits, HOA/STR-ordinance status, smart lock + insurance). Wire into `ddTemplates/index.ts`. | 4 | M (~4h) | None | Pass 1 #53 + Decision 3 (both DD checklists for MVP). |
| 6 | **MF DD checklist** — build `server/templates/ddTemplates/multifamily.ts` with MF-specific items (rent roll vs lease file reconciliation, T-12 OpEx variance, submarket vacancy/new supply, lease audit, utility sub-meter verification, R&M turnover history, concession/loss-to-lease analysis). | 4 | M (~4h) | None | Pass 1 #53 + Decision 3. |
| 7 | **Pro Forma Charts y=0 bug** — diagnose + fix per memory `project_pro_forma_chart_flat_zero_bug`. Chart plots y=0 across 2026-2030 while KPI tiles above show real NOI. Likely chart data source mismatched from engine. | 5 (if it fires) | S-M (~3h) | None | Pre-existing §3.5. Friendly-blocker if it fires during demo. |
| 8 | **Pre-existing §3.5 bugs that fire in both journeys** — Audit Trail tab 500, Assumption Audit HTML-not-JSON. Each ~2h. | 4 | S each (~4h total) | None | §3.5 / Pass 2 A39. |
| 9 | **Reimbursement routing for MF** — quick fix add `'reimburs'` substring to Other Income branch in `inferDepartment` per §3.5. Risk: false positive on expense items containing "reimburs" (unlikely). | 3 | S (~2h) | None | Pairs with anchor 3 (user-editable COA) — overrides will be the proper fix; this is the stop-gap. |
| 10 | **`pct()` helper boundary fix** — decision pass on the 3 candidates in §3.5, then implement chosen contract + audit all callers + migrate data. | 3 | S-M (~3-4h, mostly decision + caller audit) | None | §3.5 / surfaced from MF fixture seed. |
| 11 | **Storage Leases anchor-icon hardcoded leak** — `workspace.tsx:174` hardcodes `Anchor` icon for the storage-leases tab entry. Replace with class-aware icon from `config.unitMix.tabIcon`. | 3 | S (~1h) | None | Pass 2 A16. Trivial visible fix. |
| 12 | **valuator-\* stack deletion** — 9 files, 5,375 lines, fully orphan per S1. Remove import in `workspace.tsx:104`, delete 9 files, run TypeScript check. | 3 (cleanup) | S (~1h) | None | Pass 2 S1 confirmed zero regression. |
| 13 | **Parallel profit-center registry reconcile** — Pass 2 #85. Two parallel registries for same conceptual data (`MODEL_CONFIG_REGISTRY[ac].profitCenters.departments` vs `asset-class-catalog.ts.{ASSET}_PROFIT_CENTERS`). Decide canonical, deprecate the other, or document intent. | 3 | S-M (~2h) | None | Pass 2 finding. Should pair with anchor 3 (user-editable COA) sequencing — single source first. |
| 14 | **Doc-intel marina hardcoding cleanup** — 4 code paths in `doc-intel-service.ts` (L211/L219, L2401-2441, L2528). Make asset-class-aware or move to registry. | 3 | M (~6h) | None | §3.5 / Pass 1 #71-#73. |
| 15 | **MARINA_FIELDS depth pass** — bring `MARINA_FIELDS` in `direct-input-coa.ts` from 27 lines to roughly the depth of MULTIFAMILY_FIELDS (50) or STR_FIELDS (57). Add fields for fuel margin, average ticket, slip occupancy by section, service labor utilization. | 4 | M (~4h) | None | Pass 1 S3. Closes the marina direct-input gap independently of valuator-* deletion. |
| 16 | **Token resolver marina branches cleanup** — `token-resolver-service.ts:107, 137-138, 157`. Generalize via unit count + assetClass coalesce; remove marina-as-default branches. | 2 | S (~2h) | None | Pass 1 #64-65. |
| 17 | **unitMix tabIcon audit across 32 configs** — `MODEL_CONFIG_REGISTRY` — verify each config has a class-appropriate icon and not the default marina/anchor leak. Fix any wrong defaults. | 2 | S (~2h) | None | §3.5 / Pass 1 #4. Mostly trivial config edits. |
| 18 | **unitMix label naming policy decision + apply** — institutional convention ("Unit Mix") vs operator convention ("Slips", "Listings"). Decide + apply per-class. | 2 | S (~1-2h after decision) | None | §3.5 open product question / Pass 1 #5. |

**Core total estimate: 80-110 hours = 2-3 weeks at 40h/week** (within Phase 4a target of 2-3 weeks).

### 5.B — Ops (Phase 4b) — 9 items

Phase 4b starts with its own Phase 0 audit (driven by anchor 4 above). Items below are scoped at the placeholder level.

| Rank | Surface | Friendly-value | Effort | Dependencies | Notes |
|---|---|---|---|---|---|
| 1 | **Phase 4b Phase 0 audit** — extends anchor 4 above. Detailed activation matrix design, schema additions, sidebar gating wiring, ops-tab insertion points in workspace, telemetry plan. Output: a 4b-scope spec doc separate from this audit. | 5 | M (~40h = 1 week) | Anchor 4 stub landed. | Decision-only week. No 4b code starts until this lands. |
| 2 | **STR Ops MVP module** — `pages/operations/str/` with 5 sub-tabs: Listings (master listing roster with status/availability), Bookings (reservation pipeline), Channel Mix (Airbnb / VRBO / direct / OTA share + revenue by channel), Cleaning Ops (turnover schedule + cleaner assignment), Pricing (dynamic pricing config + per-listing rate strategy). | 5 | L (~6 weeks for full v1.0 module — 1 week per sub-tab + 1 week glue) | Phase 4b Phase 0 audit complete · PMS connector framework (item 3). | Decision 1 (full-build) / Pass 2 finding. Sub-tabs sized to roughly mirror marina ops module depth. |
| 3 | **PMS connector framework** — adapter interface for Bookd, Guesty, Hostaway, Lodgify, OwnerRez. Connector contract: list listings, fetch reservations, fetch financials, push pricing. Bookd treated as one PMS option among several per Reading A; reference Bookd's existing `ChannelAdapter` pattern but don't depend on it. | 5 | L (~2 weeks for framework + 1 connector reference impl) | Phase 4b Phase 0 audit. | Decision 1 framing. Reference impl probably Hostaway or OwnerRez (well-documented APIs). |
| 4 | **Operations sidebar gating per project ownership** — wire `opsModuleKey` filter to also check `ownershipState === 'owned'` for the current project context. Module visibility tied to current-project ownership, not just org-pack flags. | 4 | M (~6h) | Anchor 4 schema lands. | Implements §3.7 activation mechanism end-to-end for sidebar. |
| 5 | **MF Ops depth pass** — current `MultifamilyTabbed` has 4 sub-tabs (Dashboard, Units, Lease Expiry, Turn Tracking). Add Rent Roll Detail (single-source-of-truth with workspace), Renewals Workflow, Concessions Tracking, R&M Work Order Log. Don't try to match marina's depth — match MF operator's real workflow. | 3 | L (~1 week) | Phase 4b Phase 0 audit. | Pass 2 finding (MF Ops shallow). |
| 6 | **Marina Ops formalization** — exists today, but probably isn't gated by ownership state. Add the gating, ensure it lives in §3.7 product structure. No new modules. | 3 | M (~1 week) | Anchor 4 schema lands. | Pass 2 finding (currently un-gated). |
| 7 | **Retail Ops** — v1.1 placeholder. Tenant Roster, Lease Expiry, CAM Reconciliation, Percentage Rent Tracker. | 2 | (v1.1) | — | Captured for visibility; not in 4b scope. |
| 8 | **Self-Storage Ops** — v1.1 placeholder. Unit Inventory, Tenant Roster, Move-In/Move-Out, Auction Tracking. | 2 | (v1.1) | — | Captured for visibility; not in 4b scope. |
| 9 | **Hotel Ops** — v1.1 placeholder. Room Inventory, Reservations, RevPAR by Channel, Housekeeping Schedule, F&B Daily Sales. | 2 | (v1.1) | — | Captured for visibility; not in 4b scope. |

**Phase 4b in-scope (items 1-6) total estimate: 9-10 weeks** (within Phase 4b target of 6-10 weeks, slightly toward upper bound). Items 7-9 are v1.1 placeholders, not in this scope.

**Stop condition check (Pass 3):**
- Prioritized work list size: 18 + 9 = **27 items**. Under 30 stop condition.
- Phase 4a scope: 2-3 weeks. Within target.
- Phase 4b STR Ops MVP features: 5 (Listings, Bookings, Channel Mix, Cleaning Ops, Pricing). Under 15 stop condition.
- §8 draft: will keep under 100 lines (Section 7 below).

---

## 6. Phase 4a + 4b scope drafts

### 6.A — Phase 4a (Core completeness) scope

#### Anchor 1 — STR OM template
- **Effort:** ~6h
- **Files touched:**
  - NEW `server/templates/om-templates/str-om.ts` (~150 lines, modeled after `multifamily-om.ts`)
  - `server/templates/om-templates/index.ts` (register `strOMTemplate` in `omTemplateRegistry`)
- **Acceptance criteria:**
  - `getOMTemplatesByAssetClass('str')` returns `strOMTemplate`.
  - OM builder UI for an STR project surfaces the STR template as default.
  - Generated OM PDF includes STR-appropriate sections (Listing Setup, Channel Mix table, Pricing Strategy, Cleaning & Turnover, RevPAR/ADR metrics, Comparable STRs).
  - All sections have non-empty `defaultContent`.
- **Dependencies:** None.
- **Verification:** Generate an OM for the STR fixture `b1a0eebc-...` and confirm all sections render. Compare narrative depth against `marinaOMTemplate` + `multifamilyOMTemplate`.

#### Anchor 2 — S4 wizard data shape fix
- **Status:** SPLIT after Phase 0 (2026-05-20). Safe subset shipped in commit `9eb02294`; `marinaName` + `owned_marina` moved to Anchor 2b below.
- **Effort:** ~6h estimated → ~2h actual for the shipped safe subset.
- **Files touched:**
  - `client/src/components/onboarding/OnboardingWizard.tsx` — rename state fields ~~`marinaName`→`propertyName`~~ *(deferred → Anchor 2b)*, `marinaAddress`→`propertyAddress`, `portfolioMarinas`→`portfolioProperties`, `validMarinas`→`validProperties`. Rename `renderMarinaDetailsStep`→`renderPropertyDetailsStep`. Dialog header icon read from `getModelConfig(state.assetClass).unitMix.tabIcon` via the existing `iconMap` (promoted to module scope). ~~DealType `owned_marina`→`owned_property`~~ *(deferred → Anchor 2b)*.
  - Schema: confirmed — the 4 shipped renames are pure form-local wizard state; no DB column relies on them.
- **Acceptance criteria:**
  - `grep -rn "marinaAddress\|portfolioMarinas\|validMarinas\|renderMarinaDetailsStep" client/src/components/onboarding/` returns 0 hits. ✅
  - Wizard renders for marina, STR, MF — dialog header icon is class-appropriate. ✅
  - ~~`marinaName` → 0 hits~~ / ~~`owned_marina` → 0 hits~~ — **deferred to Anchor 2b** (cross the wizard→server→DB boundary).
- **Dependencies:** None.
- **Verification:** `tsc -b shared` clean; scoped tsc 0 new errors vs HEAD `2469bfb0`; dev server health 200.
- **Phase 0 finding (2026-05-20):** The audit estimated ~10 read sites / 6h. Phase 0 measured ~62 grep hits (all in `OnboardingWizard.tsx`) and found 2 of the 6 renames cross the wizard→server→DB boundary: `marinaName` is the `POST /api/modeling/projects` payload key (`server/routes/crm-routes.ts:13937`, written to the `modeling_projects.marina_name` column); `owned_marina` is a live Postgres `deal_source` enum value (`shared/schema.ts:143`) with ~13 server/client consumers, also written into `customMetrics.dealType` JSONB. Both trip the brief's STOP conditions, so they split into Anchor 2b. The 4 wizard-local renames + class-aware dialog icon shipped as the safe subset.

#### Anchor 2b — marinaName / owned_marina migration (deferred from Anchor 2)
- **Effort:** ~8-12h (re-sized from Anchor 2's original 6h)
- **Files touched (expected ~15):**
  - `client/src/components/onboarding/OnboardingWizard.tsx` — rename `marinaName` state field + submit payload key
  - `server/routes/crm-routes.ts` — accept new payload key (with transitional support for the old key during the migration window) and write to the renamed column
  - DB migration (raw SQL): rename `modeling_projects.marina_name` to `modeling_projects.property_name` OR add a `property_name` column + dual-write during cutover
  - DB migration (raw SQL): add `owned_property` to the `dealSourceEnum` Postgres enum; backfill `customMetrics.dealType = 'owned_marina'` to `'owned_property'` for existing projects
  - `shared/schema.ts` — update the `dealSourceEnum` declaration + column name in the Drizzle type
  - ~13 callsite updates across `server/routes/returns-routes.ts`, `server/routes/modeling-routes.ts`, `server/routes/crm-routes.ts`, `server/services/integration-data-pipeline.ts` and client-side consumers (DealType filter UIs, project list displays)
  - Test fixtures that hardcode `'owned_marina'`
- **Acceptance criteria:**
  - `grep -rn "marinaName\|owned_marina" client/ server/ shared/` returns 0 hits OUTSIDE of migration files and code comments referencing the rename history
  - All existing projects with `customMetrics.dealType = 'owned_marina'` successfully backfilled
  - `tsc` clean, dev server health 200, no regressions
- **Dependencies:** Anchor 2 safe subset shipped (commit `9eb02294`).
- **Verification:** Pre-migration snapshot of projects with `marina_name` and `customMetrics.dealType = 'owned_marina'`; post-migration confirm same row count with new field/value; spot-check 3 projects load cleanly in workspace.

#### Anchor 3 — User-editable COA mapping
- **Effort:** ~24-30h (~3-4 days)
- **Files touched:**
  - NEW DB migration (raw SQL, per CLAUDE.md rules): `coa_overrides` table — `(id, org_id, asset_class, override_type, key_pattern, target_department, target_subcategory, created_at, created_by, notes)`. RLS enabled by `org_id`.
  - `server/services/direct-input-engine.ts` — `inferDepartment` read path: query `coa_overrides` first (per org_id + asset_class), then fall through to existing cascade.
  - NEW `client/src/pages/settings/coa-editor.tsx` — list / add / edit / delete overrides per asset class. Pattern-match preview against sample line items.
  - `client/src/components/unified-sidebar.tsx` — settings entry for "Chart of Accounts Editor."
  - Audit log: every override CRUD writes to `financial_audit_log` (existing immutable log).
- **Acceptance criteria:**
  - Org admin can add `"trash reimbursement"` → `other_income` override for MF, and the next upload routes correctly.
  - Override is org-scoped — other orgs unaffected.
  - Override CRUD is audit-logged.
  - Retroactive re-classification: existing actuals can be re-categorized when an override is added (with confirmation).
  - `inferDepartment` cascade: overrides → existing keyword cascade → default. PRO_FORMA_REGISTRY edit scope deferred (decision needed during 4a Phase 0 sub-audit if required).
- **Dependencies:** Resolves Pass 2 #85 (parallel registry reconcile) — overrides are the canonical user-edit path; the two-registry drift becomes a "config defaults vs user overrides" split. Pairs with #13 ranked item.
- **Verification:** Add an override against `tests/department-mapping-baseline.mjs` synthetic line items, confirm routing matches. End-to-end fixture: MF P&L with "Trash Reimbursement" line, override routes to `other_income`, Pro Forma re-computes.

#### Anchor 4 — Ops gating mechanism placeholder + Phase 0 design audit for 4b
- **Effort:** ~6-8h for stub + activation matrix doc (the full Phase 4b Phase 0 audit is ~1 week and lives in 4b scope, item 1 of §5.B)
- **Files touched:**
  - DB migration (raw SQL): add `ownership_state` column to `modeling_projects` — enum `('evaluated', 'owned', 'archived')` default `'evaluated'`.
  - `shared/schema.ts` — add to type. (Drizzle is read-only for the column to avoid the RLS-empty pitfall per CLAUDE.md.)
  - NEW `BETA_MVP_PHASE_4B_PHASE_0.md` at workspace root — captures activation matrix decisions (tier × user_type × ownership_state), schema decisions, sidebar gating contract, telemetry plan. This is the spec deliverable, not code.
- **Acceptance criteria:**
  - `ownership_state` column exists in `modeling_projects` with default 'evaluated'.
  - All existing projects backfill to 'evaluated' on migration.
  - Activation matrix document committed to workspace root.
  - Sidebar `opsModuleKey` filter logic in `unified-sidebar.tsx` documented but not yet wired (wiring is 4b item 4).
- **Dependencies:** None.
- **Verification:** Migration runs cleanly, every existing project has `ownership_state = 'evaluated'`. Document review by Brett.

#### Items 5-18 — Phase 4a remainder
Effort estimates rolled up:

| Item | Effort | Files |
|---|---|---|
| 5. STR DD checklist | ~4h | NEW `server/templates/ddTemplates/str.ts` + `ddTemplates/index.ts` |
| 6. MF DD checklist | ~4h | NEW `server/templates/ddTemplates/multifamily.ts` + `ddTemplates/index.ts` |
| 7. Pro Forma Charts y=0 bug | ~3h | `pro-forma-charts.tsx` (memory `project_pro_forma_chart_flat_zero_bug`) |
| 8. Audit Trail 500 + Assumption Audit HTML | ~4h | `workspace/audit-trail.tsx`, `workspace/assumption-audit.tsx` + server routes |
| 9. Reimbursement routing for MF | ~2h | `direct-input-engine.ts` `inferDepartment` Other Income branch |
| 10. `pct()` helper boundary fix | ~3-4h | `direct-input-engine.ts:956` + caller audit |
| 11. Storage Leases anchor-icon fix | ~1h | `workspace.tsx:174` |
| 12. valuator-* stack deletion | ~1h | Remove 9 files in `workspace/valuator-*` + `workspace.tsx:104` import |
| 13. Parallel profit-center registry reconcile | ~2h | `marina-catalog.ts` + `asset-class-catalog.ts` + `asset-class-model-config.ts` decision pass |
| 14. Doc-intel marina hardcoding cleanup | ~6h | `doc-intel-service.ts` L211/L219, L2401-2441, L2528 |
| 15. MARINA_FIELDS depth pass | ~4h | `direct-input-coa.ts:248-274` (MARINA_FIELDS) — expand to ~50 lines |
| 16. Token resolver marina branches cleanup | ~2h | `token-resolver-service.ts:107, 137-138, 157` |
| 17. unitMix tabIcon audit | ~2h | `asset-class-model-config.ts` — 32 configs |
| 18. unitMix label naming policy | ~1-2h | Decision + apply across configs |

#### Phase 4a rollup

| Bucket | Hours |
|---|---|
| 4 anchors (items 1-4) | ~40-50h |
| Items 5-18 (remainder) | ~40-46h |
| **Total** | **~80-96 hours** |
| **Weeks (40h/week)** | **2.0-2.4 weeks** |

Within Phase 4a target (2-3 weeks). Adds ~10-20% buffer for verification, articulation blocks, and any unanticipated dependencies — still under 3 weeks total.

### 6.B — Phase 4b (Ops productization) scope

Less detailed because 4b starts with its own Phase 0 audit. Captured here at the planning level.

#### Phase 4b Phase 0 audit (~1 week — item 1 of §5.B)

The audit deliverable is `BETA_MVP_PHASE_4B_PHASE_0.md` (stub created during anchor 4 in 4a). Must answer:

1. **Activation matrix decisions** — what combinations of (tier × user_type × ownership_state) activate which Ops modules? Default rule: `ownership_state === 'owned'` activates the class-specific Ops tab for that project's asset class. Layered rules pending design (e.g., does an `analyst` user under an `institutional` tier always see Ops in read-only mode regardless of ownership?).
2. **Schema additions** — beyond `modeling_projects.ownership_state`, do we need `ops_module_enabled` per (org_id, project_id, module_key)? Or is the rule purely derived?
3. **Sidebar gating contract** — `opsModuleKey` filter today gates by org packs. New filter: gate by (org pack) AND (current project ownership) when in project context. Document the precedence.
4. **Ops tab insertion in workspace** — does the Ops module live as a sidebar entry (today's pattern) or also as a workspace tab inside the project view? If both: which is canonical?
5. **Telemetry plan** — how do we measure Ops module usage for v1.0 → v1.1 prioritization?
6. **Cross-class data plumbing** — does the Pro Forma engine consume Ops actuals (today: not really, except for marina's `enrichFromProfitCenters` per Pass 1 #62)? If yes, the bridge is its own scope item.
7. **Sub-audit decisions** — registry edit scope for anchor 3 (PRO_FORMA_REGISTRY editability) if not resolved during Phase 4a.

#### STR Ops MVP feature inventory (5 features, ~6 weeks build — item 2 of §5.B)

Each sub-tab sized at ~1 week build + 1 week glue.

| Sub-tab | Scope summary | Key data |
|---|---|---|
| Listings | Master listing roster: address, listing IDs across platforms, bedrooms/baths/guests, amenities, status (active / paused / archived), photos count, listing-level revenue summary. | One row per listing. Synced from PMS. |
| Bookings | Reservation pipeline: upcoming + past stays, guest name (PII gated), nights, channel, nightly rate, cleaning fee, total, status (confirmed / cancelled / completed). Day/week/month aggregation views. | Per-reservation rows. PMS-synced. |
| Channel Mix | Revenue + bookings share by channel (Airbnb / VRBO / Booking.com / direct / other OTA). Time-series view, period-over-period comparison. ADR by channel. Take-rate / commission audit. | Aggregated from Bookings. |
| Cleaning Ops | Turnover schedule (calendar view) by listing. Cleaner assignment + status (assigned / in-progress / inspected / ready). Avg turnover time. Cleaning fee billed vs. cost. | Per-turn rows. May integrate with cleaner-side tools (Turno, Properly) post-MVP. |
| Pricing | Dynamic pricing config (base rate, weekend premium, seasonal multipliers, gap-night discounts), per-listing rate strategy override, peek at next 90 days of expected rates. Integration hooks for PriceLabs / Wheelhouse / Beyond Pricing in v1.1. | Per-listing pricing config. |

Excludes from v1.0 STR Ops (deferred to v1.1): cleaner payroll/payments, owner statements (handled by separate LP-reporting flow), maintenance work-order tracking, multi-property portfolio analytics beyond Channel Mix.

#### PMS connector framework (~2 weeks — item 3 of §5.B)

Reference Bookd's existing `ChannelAdapter` pattern for shape, but build fresh in Vantage to avoid coupling. Connector contract:

```typescript
interface PMSConnector {
  id: 'bookd' | 'guesty' | 'hostaway' | 'lodgify' | 'ownerrez';
  authenticate(orgId: string, credentials: PMSCredentials): Promise<PMSAuthResult>;
  listListings(connectionId: string): Promise<PMSListing[]>;
  fetchReservations(connectionId: string, range: DateRange): Promise<PMSReservation[]>;
  fetchFinancials(connectionId: string, range: DateRange): Promise<PMSFinancialLine[]>;
  pushPricing?(connectionId: string, listingId: string, rates: PricingRates): Promise<void>;
}
```

V1.0 ships:
- Framework + types.
- 1 reference connector implementation (recommend Hostaway or OwnerRez — well-documented APIs).
- Stubs for the other 4 connectors (Bookd, Guesty, Lodgify, plus the unbuilt one of Hostaway/OwnerRez).

V1.1 adds: real implementations for the other connectors as friendlies demand them.

#### MF Ops depth pass (~1 week — item 5 of §5.B)

Current `MultifamilyTabbed` has 4 sub-tabs: Dashboard, Units, Lease Expiry, Turn Tracking. Add for v1.0:
- **Rent Roll Detail** — single source of truth shared with workspace's storage-leases tab; resolves dual-source risk.
- **Renewals Workflow** — leases up for renewal in next 60/90/180 days; renewal offer status (sent / accepted / declined / pending).
- **Concessions Tracking** — concession by unit / lease term, $ + % impact on EGI.
- **R&M Work Order Log** — open / closed work orders, $/unit cost trend.

Out of scope for v1.0 (v1.1): tenant portal, payment processing, eviction tracking, AR aging.

#### Marina Ops formalization (~1 week — item 6 of §5.B)

Marina Ops modules exist today (Pass 2 row 81) and are unconditionally available in the sidebar gated by `opsModuleKey`. After anchor 4 lands, wire each marina ops module's `opsModuleKey` to also respect `ownership_state === 'owned'`. No new modules; just enforcement of the activation matrix on the existing 8 modules.

#### Phase 4b rollup

| Item | Weeks |
|---|---|
| 1. Phase 0 audit | 1 |
| 2. STR Ops MVP build (5 sub-tabs) | 6 |
| 3. PMS connector framework + 1 reference impl | 2 |
| 4. Sidebar gating wiring | 0.2 |
| 5. MF Ops depth pass | 1 |
| 6. Marina Ops formalization | 0.5-1 |
| **Total** | **~10-11 weeks** |

Slightly above the 6-10 week target's upper bound. Two levers to tighten if needed:
- Defer Marina Ops formalization to early v1.1 (its functionality exists today; gating is the only delta).
- STR Ops MVP from 6 weeks to 4 weeks by deferring Cleaning Ops + Pricing to v1.1 (keeps Listings + Bookings + Channel Mix as the MVP triad, which most institutional STR friendlies will demo around).

Item 7-9 (Retail / Self-Storage / Hotel Ops) are v1.1 placeholders — captured in §5.B for visibility, **not in 4b scope**.

---

## 7. Draft §8 update for BETA_MVP_SPEC.md

This is the text I'll apply to BETA_MVP_SPEC.md §8 in the same Pass 3 commit. Kept under 100 lines per stop condition.

```markdown
## 8. Per-class content inventory (Phase 1.5 — completed 2026-05-19)

Phase 1.5 audit completed across three passes:
- **Pass 1** — grep-driven enumeration + 4-registry audit + tab-gate audit (commit `cef8f749`).
- **Pass 2** — code-walkthrough user-journey friction log for Journey A (MF investor) and Journey B (marina owner) (commit `3ad61100`).
- **Pass 3** — prioritized work list + Phase 4a / 4b scope drafts (this commit).

Structured backing data lives in `BETA_MVP_PHASE_1_5_AUDIT.md` at workspace root. That document contains the full inventory (~89 surfaces across 11 categories), the journey friction log (~60 entries across both journeys), the prioritized work list (18 Core + 9 Ops items), and detailed scope drafts.

### Headline findings

**Registry coverage:** All 4 registries (`MODEL_CONFIG_REGISTRY`, `COA_REGISTRY`, `COA_FIELD_REGISTRY`, `PRO_FORMA_REGISTRY`) cover all 3 MVP classes (marina, STR, MF) at 100% breadth. Depth varies — STR_COA is 7× deeper than MARINA_COA / MULTIFAMILY_COA; MARINA_FIELDS is the shortest direct-input field set.

**STR has the biggest Core gap:** missing OM template, missing DD template, missing rent-roll-v2 adapter. These are the highest-priority Phase 4a items (3 concrete deliverables).

**S4 — Wizard data shape leak:** `marinaName` / `marinaAddress` / `portfolioMarinas` written for all classes regardless of asset class. Phase 4a anchor.

**S1 — orphan valuator-\* stack:** 5,375 lines of marina-specific UI code imported but not rendered. Verified 0% overlap with active code paths. Safe to delete in Phase 4a (item 12).

**Operations sidebar asymmetry (new in Pass 2):** marina has 13 sidebar entries / 8 dedicated tabbed-ops modules; MF has 1 module / 4 sub-tabs; STR has 0. This is a Phase 4b (Ops productization) scope dimension, not Phase 4a.

### Phase 4 split — Core vs Ops (per §3.7)

**Phase 4a — Core completeness (per-class modeling polish).** 18 items, 4 anchors. Estimate 2.0-2.4 weeks (80-96h). See §6.A of `BETA_MVP_PHASE_1_5_AUDIT.md`.

Phase 4a anchors:
1. STR OM template
2. S4 wizard data shape fix (`marinaName` → `propertyName`)
3. User-editable COA mapping (promoted from §3.6)
4. Ops gating mechanism placeholder + Phase 4b Phase 0 design audit

**Phase 4b — Ops add-on productization.** 9 items (6 in-scope for v1.0, 3 deferred to v1.1). Estimate ~10-11 weeks. See §6.B of `BETA_MVP_PHASE_1_5_AUDIT.md`.

Phase 4b sequence:
1. Phase 0 audit (1 week)
2. STR Ops MVP — 5 sub-tabs: Listings, Bookings, Channel Mix, Cleaning Ops, Pricing (6 weeks)
3. PMS connector framework + 1 reference connector (2 weeks)
4. Sidebar gating wiring (0.2 weeks)
5. MF Ops depth pass (1 week)
6. Marina Ops formalization (0.5-1 week)

### §3.5 cleanup items closed in Phase 4a

The following §3.5 entries are closed by Phase 4a:
- §3.5 "Mobile responsive audit" — out of scope (deferred to v1.1)
- §3.5 "8 duplicate Sunset Bay Marina fixtures" — bundled with valuator-* cleanup (item 12)
- §3.5 "Institutional analysis suite fixes" — separate scope, not Phase 4a
- §3.5 "Reimbursement routing for Multifamily" — item 9
- §3.5 "`STORAGE_SUB_TYPES` reconciliation" — covered by item 18 (unitMix label policy) + item 17 (icon audit)
- §3.5 "`unitMix.tabIcon` anchor-icon leak" — item 11 + item 17
- §3.5 "Inconsistent `unitMix` tab labels" — item 18
- §3.5 "`doc-intel-service.ts` marina hardcoding" — item 14
- §3.5 "LLM provider divergence" — out of scope (deferred per spec entry)
- §3.5 "`pct()` helper ambiguity" — item 10
- §3.5 "Wizard `marinaName` / `marinaAddress` leak" — anchor 2 (S4 fix)

§3.5 cleanups not closed by Phase 4a (carried forward):
- Audit Trail 500 + Assumption Audit HTML + Pro Forma Charts y=0 — items 7-8 (bundled into Phase 4a as bug-fix items, ranked 7-8)

### Total per-class content build roadmap

| Phase | Scope | Estimate | Sequencing |
|---|---|---|---|
| Phase 4a | Core completeness across MVP classes | 2.0-2.4 weeks | Starts after Phase 1.5 commit |
| Phase 4b Phase 0 | Activation matrix design audit | 1 week | After Phase 4a anchor 4 stub lands |
| Phase 4b items 2-6 | Ops module productization | 9-10 weeks | After Phase 4b Phase 0 |
| **Total to v1.0** | **Phase 4a + 4b** | **~12-13 weeks** | |

Replacement Cost per-class build (Phase 1.5 worked example) is **NOT** in Phase 4a — marina has it via the existing `replacement-cost.tsx`; STR and MF won't get class-specific Replacement Cost UIs in MVP. Re-evaluate for v1.1 if friendly demand surfaces.
```

---

## 8. Pass 3 articulation block

**Total Phase 4a scope estimate:** 2.0-2.4 weeks (80-96 hours).
**Total Phase 4b scope estimate:** ~10-11 weeks (slightly above the 6-10 target's upper bound; two tightening levers identified in §6.B).

**Top 4 anchors — confirmed scope estimates:**

| Anchor | Hours | Notes |
|---|---|---|
| 1. STR OM template | ~6h | Modeled after `multifamily-om.ts`; no dependencies. |
| 2. S4 wizard data shape fix | ~6h | Rename + ~10 read sites + dialog icon + DealType. |
| 3. User-editable COA mapping | ~24-30h | Largest 4a item by far; depends on resolving registry edit scope. |
| 4. Ops gating placeholder + 4b Phase 0 design | ~6-8h for 4a stub | Full Phase 4b Phase 0 audit is a separate 1-week 4b item. |

**Surfaced in Pass 3 (not in Pass 1 or Pass 2):**
- The two-axis split — Core completeness (4a) vs Ops productization (4b) — formalized in §3.7 (Piece A commit) is itself a Pass 3 product structure decision worth noting in audit history.
- The relationship between anchor 3 (user-editable COA) and Pass 2 #85 (parallel profit-center registry reconcile): item 13's "reconcile or document" framing collapses into anchor 3's user-edit canonical path — overrides become the canonical user-edit path; the dual-source becomes "config defaults vs overrides" not "two competing registries."

**Items where ranking required judgment Brett should review:**

1. **Item 15 — MARINA_FIELDS depth pass at value 4, M effort.** This addresses Pass 1 S3 (marina has shortest direct-input fields). I ranked it 4 because friendlies entering marinas via direct input today see a sparse form, but no friendly has complained yet. Could deprioritize to value 3 if direct-input is a thin demo path for marinas (most marina friendlies upload P&L, not direct-input).
2. **Item 14 — Doc-intel marina hardcoding cleanup at value 3, M effort.** Could be deferred to v1.1 if the four code paths don't fire under current MF/STR uploads. Worth running a single MF + STR P&L through doc-intel and observing whether the marina paths trigger before committing 6h to this.
3. **Item 11 vs 17 — Storage Leases icon fix (single-tab fix) vs unitMix tabIcon audit (32-config sweep).** I ranked them separately because the single-tab fix is the user-visible win (~1h) and the 32-config sweep is the cleanup that prevents the same leak elsewhere (~2h). Could be bundled into one item if Brett prefers a single commit.
4. **Phase 4b STR Ops MVP — 5 sub-tabs vs 3.** Decision 1 was full-build; I sized for 5 sub-tabs (~6 weeks). Tightening lever in §6.B suggests dropping to 3 (Listings + Bookings + Channel Mix) would save 2 weeks. Reasonable for MVP demo with institutional STR friendlies; Cleaning Ops + Pricing become v1.1 priorities.
5. **Phase 4a buffer.** I sized at 80-96h (2.0-2.4 weeks) but the realistic ceiling with verification overhead is closer to 3 weeks. Worth flagging if 4a slips past 3 weeks → consider deferring items 16-18 (token resolver / icon audit / label policy) to a Phase 4a.1 cleanup wave.

**Confirmed scope: NO code changes today, only documentation.**

---

## Appendix — Files inspected in Pass 1

- `shared/asset-class-model-config.ts` (4,531 lines — full structural read)
- `shared/direct-input-coa.ts` (952 lines — structure + 3 MVP entries)
- `shared/pro-forma-config.ts` (997 lines — full structural read)
- `server/services/direct-input-engine.ts` (973 lines — COA_REGISTRY + 3 MVP entries)
- `shared/marina-catalog.ts` (101 lines — full read)
- `shared/document-builder/section-library.ts` (~1600 lines — section names only)
- `client/src/pages/modeling/projects/workspace.tsx` (~1100 lines — TAB_GROUPS + tab-gate logic)
- `client/src/pages/modeling/projects/workspace/replacement-cost.tsx` (360 lines — confirmed marina-hardcoded)
- `client/src/pages/modeling/projects/workspace/valuator-profit-centers.tsx` (153 lines — orphan import chain)
- `client/src/components/onboarding/OnboardingWizard.tsx` (2,513 lines — step logic, marina-flavored data shape)
- Directory walks of: `client/src/pages/modeling/projects/workspace/`, `server/templates/om-templates/`, `server/templates/ddTemplates/`, `server/services/rent-roll-v2/assetStrategies/`, `server/services/rent-roll-v2/adapters/`

## Appendix B — Revision log

| Date | Change |
|---|---|
| 2026-05-20 | Anchor 2 (§6.A) split into a shipped safe subset + new Anchor 2b after Phase 0 surfaced that 2 of 6 renames (`marinaName`, `owned_marina`) cross the wizard→server→DB boundary. Safe subset (4 wizard-local renames + class-aware dialog icon) shipped in commit `9eb02294`. |
