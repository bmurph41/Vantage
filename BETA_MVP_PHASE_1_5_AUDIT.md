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

## 4. Journey friction log — PENDING (Pass 2)

To be filled in Pass 2. Will capture step-by-step:
- Journey A: Investor/Operator evaluating an MF deal end-to-end.
- Journey B: Owner uploading marina P&L end-to-end.

For each step:
- What the user sees per class
- Marina-flavored words/icons/columns/KPIs leaking into non-marina
- Class-specific content gaps
- Institutional expectations missing universally

---

## 5. Prioritized work list — PENDING (Pass 3)

To be filled in Pass 3. Will rank all ~80 surfaces by:
- Friendly-value (0-5 scale)
- Effort (small <2h / medium 2-8h / large >8h)
- Dependencies on §3.5 cleanups
- Top 10 → Phase 4 scope candidates (per spec commit `b61fbd1f`)

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
