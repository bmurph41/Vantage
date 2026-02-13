# Exit Scenario Engine — Patch Set

> Produced: 2026-02-13  
> Scope: Surgical fixes for P0–P3 issues identified in STATIC_ANALYSIS_OUTPUT.md  
> Validated against: GOLDEN_VECTORS.json

---

## Summary of All Patches

| Patch | Priority | Task | Files Touched | Description |
|-------|----------|------|---------------|-------------|
| 1 | P0 | T-1 | exit-scenario-engine.ts | 1031 tax deferral applied to after-tax proceeds |
| 2 | P0 | T-2 | tax-engine.ts, seller-financing-engine.ts | Installment recapture frontloaded in Year 0 |
| 3 | P0 | T-3, T-4, T-12 | exit-scenario-engine.ts | Full cashflow IRR with refi intermediates + holdingPeriod guard |
| 4 | P1 | T-5 | exchange-1031-engine.ts | Remove hardcoded 23.8% boot tax |
| 5 | P1 | T-6 | seller-financing-engine.ts | Remove hardcoded LTCG/state rates — use tax-engine |
| 6 | P1 | T-7 | earnout-engine.ts | Accept optional TaxProfileInput for dynamic rates |
| 7 | P2 | T-14 | dst-engine.ts, seller-financing-engine.ts, cashflow-synthesizer.ts, waterfall-engine-v2.ts | Replace 4 duplicate IRR implementations with canonical |
| 8 | P3 | T-8 | basis-ledger.ts | Div/0 guard for depreciationScheduleYears=0 |
| 9 | P3 | T-9 | exchange-1031-engine.ts | Empty replacementProperties guard |
| 10 | P3 | T-10 | seller-financing-engine.ts | 100% down payment guard |
| 11 | P3 | T-11 | waterfall-engine-v2.ts | Empty capital calls/distributions guard |
| 12 | P3 | T-13 | exchange-1031-engine.ts, tax-engine.ts | Negative gain (loss) warnings |
| 13 | P3 | T-17 | tax-engine.ts | Dead code removal |

---

## PATCH 1: 1031 Tax Deferral Applied to After-Tax Proceeds (T-1)

**Touched files:** `shared/exit/exit-scenario-engine.ts`

**Bug:** The orchestrator ran `runTaxEngine()` on the full gain and subtracted the full tax liability regardless of scenario type. For 1031 exchanges, the deferred gain should NOT be taxed — only boot/recognized gain flows through tax.

**Fix:** Move 1031 engine computation BEFORE the tax engine call. After computing `exchange1031Result`, intercept the tax result:
- **Full deferral** (`recognizedGain === 0`): Set `totalTaxLiability = 0`, `effectiveTaxRate = 0`, `afterTaxEquityProceeds = beforeTaxEquityProceeds`.
- **Partial deferral** (boot exists): Pro-rate full tax liability by `recognizedGain / fullGain` ratio. Cap effective tax rate to boot-only.

**Key diff:**
```
- const taxResult = runTaxEngine(gainInput, input.taxProfile);
- const afterTaxEquityProceeds = beforeTaxEquityProceeds - taxResult.totalTaxLiability;
- // (1031 engine computed AFTER tax, never used to adjust)
+ // 1031 engine computed BEFORE tax
+ let exchange1031Result = ... // computed first
+ const fullTaxResult = runTaxEngine(gainInput, input.taxProfile);
+ if (scenarioType === 'exchange_1031' && recognizedGain === 0) {
+   taxResult = { ...fullTaxResult, totalTaxLiability: 0, effectiveTaxRate: 0 };
+   afterTaxEquityProceeds = beforeTaxEquityProceeds; // $0 tax
+ } else if (scenarioType === 'exchange_1031') {
+   const gainRatio = recognizedGain / fullGain;
+   const bootTax = fullTaxResult.totalTaxLiability * gainRatio;
+   taxResult = { ...fullTaxResult, totalTaxLiability: bootTax, ... };
+   afterTaxEquityProceeds = beforeTaxEquityProceeds - bootTax;
+ }
```

**Acceptance criteria (from GOLDEN_VECTORS):**
- `1031_full_deferral`: afterTaxEquityProceeds === beforeTaxEquityProceeds, totalTaxLiability === 0
- `1031_with_boot`: tax < full-gain tax, recognizedGain > 0, effectiveTaxRate based on boot only

---

## PATCH 2: Installment Depreciation Recapture Timing (T-2)

**Touched files:** `shared/exit/tax-engine.ts`, `shared/exit/seller-financing-engine.ts`

**Bug:** Both installment schedules capped Year 0 recapture at `Math.min(recapture, gainRecognized)` where `gainRecognized = downPayment × grossProfitRatio`. Per IRS §453(d)(1), ALL depreciation recapture must be recognized in the year of sale regardless of installment method.

**Fix (tax-engine.ts, lines 498-508):**
```
- section1250RecapturedThisYear = Math.min(remainingRecapture1250, gainRecognized);
+ section1250RecapturedThisYear = remainingRecapture1250; // Full amount per §453(d)(1)
+ remainingRecapture1250 = 0;
```
Same pattern for §1245. Same fix in seller-financing-engine.ts.

**Also fixed (T-17):** Dead code `salePrice = allocation.netSalePrice + (... ? 0 : 0)` → `salePrice = allocation.netSalePrice`.

**Acceptance criteria:**
- `installment_recapture`: Year 0 `section1250RecapturedThisYear` ≈ 820,513 (full accumulated depreciation)
- All subsequent years: recapture = 0, gain is pure LTCG

---

## PATCH 3: Full Cashflow IRR with Refi Intermediates (T-3, T-4, T-12)

**Touched files:** `shared/exit/exit-scenario-engine.ts`

**Bug:** IRR built a 2-point array `[-equity, totalReturn]` ignoring refi cash-outs at intermediate years. Also, `holdingPeriodYears === 0` produced `Math.pow(moic, 1/0) = Infinity`.

**Fix:**
```
+ // Build full timeline with intermediate refi flows
+ const investmentCashFlows = [{ period: 0, amount: equity, type: 'investment' }];
+ for (const refiEvt of refinanceSummary.events) {
+   investmentCashFlows.push({ period: refiEvt.year, amount: refiEvt.netCashOut, type: 'intermediate' });
+ }
+ investmentCashFlows.push({ period: holdingYears, amount: afterTaxEquityProceeds, type: 'distribution' });
+ const irr = calculateIRR(investmentCashFlows);
+
+ // Guard holdingPeriodYears = 0
+ if (holdingPeriodYears <= 0) { annualizedReturn = 0; push warning; }
```

**Acceptance criteria:**
- `refi_irr`: IRR with Year 3 cash-out > naive 2-point IRR (receiving money earlier = higher return)
- `holdingPeriodYears=0`: annualizedReturn = 0, no Infinity, warning present

---

## PATCH 4: Remove Hardcoded 23.8% Boot Tax (T-5)

**Touched files:** `shared/exit/exchange-1031-engine.ts`

**Bug:** `taxOnBoot = recognizedGain * 0.238` ignored filing status, brackets, state, NIIT.

**Fix:** Set `taxOnBoot = 0` in the sub-engine. Boot tax is now computed by the orchestrator (PATCH 1) via the full tax engine with proper brackets. Comment documents the delegation.

---

## PATCH 5: Seller Financing — Canonical State/LTCG Rates (T-6)

**Touched files:** `shared/exit/seller-financing-engine.ts`

**Bug:** 12-state hardcoded table with 5% default; flat 20% LTCG rate.

**Fix:**
- Import `STATE_CAPITAL_GAINS_RATES` and `getTaxYearConfig` from `tax-engine.ts`
- Look up state rate from 51-jurisdiction canonical table (0 for unknown states instead of 5% default)
- Compute LTCG rate from bracket table using filer's income and filing status
- Use `taxConfig.section1250Rate` and `taxConfig.ordinaryTopRate` instead of hardcoded 0.25 / 0.37

---

## PATCH 6: Earnout Engine — Dynamic Tax Rates (T-7)

**Touched files:** `shared/exit/earnout-engine.ts`

**Bug:** Hardcoded `{ capital_gain: 0.238, ordinary_income: 0.407, mixed: 0.32 }`.

**Fix:**
- Add optional `taxProfile` to `EarnoutEngineInput`
- When provided: compute LTCG rate from brackets, NIIT from threshold, state rate from canonical table
- When absent: fall back to existing hardcoded rates (backward compatible)

---

## PATCH 7: Replace Duplicate IRR Implementations (T-14)

**Touched files:** `dst-engine.ts`, `seller-financing-engine.ts`, `cashflow-synthesizer.ts`, `waterfall-engine-v2.ts`

**Bug:** 4 local copies of bisectionIRR / dateBasedXIRR could diverge.

**Fix (per file):**
1. `dst-engine.ts`: Import `calculateIRR` from `irr-calculator.ts`, convert `number[]` → `CashFlow[]`, remove local `bisectionIRR()`
2. `seller-financing-engine.ts`: Same import, same conversion, remove local `bisectionIRR()`
3. `cashflow-synthesizer.ts`: Import `calculateIRR`, add thin `rawArrayIRR()` adapter, remove local `calculateIRR()`
4. `waterfall-engine-v2.ts`: Import `calculateXIRR` from `irr-calculator.ts`, replace both `dateBasedXIRR()` calls, remove local definition

---

## PATCH 8: Division by Zero in Basis Ledger (T-8)

**Touched files:** `shared/exit/basis-ledger.ts`

**Fix:**
```
- const improvementAnnualDepreciation = improvementBasis / input.depreciationScheduleYears;
+ let improvementAnnualDepreciation = 0;
+ if (input.depreciationScheduleYears > 0) {
+   improvementAnnualDepreciation = improvementBasis / input.depreciationScheduleYears;
+ }
+ const personalPropertyDepreciation = personalPropertyValue > 0 ? personalPropertyValue / 5 : 0;
```

**Acceptance:** `edge_zero_depreciation_years` vector: no NaN, no Infinity, annualDepreciation=0.

---

## PATCH 9: Empty Replacement Properties in 1031 (T-9)

**Touched files:** `shared/exit/exchange-1031-engine.ts`

**Fix:** If `replacementProperties.length === 0`, return early with `recognizedGain = realizedGain` (all gain recognized), `deferredGain = 0`, `isFullyDeferred = false`, and `NO_REPLACEMENT_PROPERTIES` warning.

**Acceptance:** `edge_empty_replacement_properties` vector: no NaN/Infinity, no throw, warning present.

---

## PATCH 10: 100% Down Payment in Seller Financing (T-10)

**Touched files:** `shared/exit/seller-financing-engine.ts`

**Fix:** If `faceValue <= 0`, return simplified cash-sale-equivalent result with empty amortization, zero interest income, and `CASH_SALE_EQUIVALENT` warning.

**Acceptance:** `edge_100_percent_down` vector: faceValue=0, amortization empty, totalInterestIncome=0, warning present.

---

## PATCH 11: Empty Waterfall Guard (T-11)

**Touched files:** `shared/exit/waterfall-engine-v2.ts`

**Fix:** If `totalCapitalCalled <= 0` or `totalDistributions <= 0`, return early with zeroed-out `FundMetrics` and warning. Added helper `buildEmptyWaterfallResult()`.

**Acceptance:** No NaN on grossMoic, warning present.

---

## PATCH 12: Negative Gain Warnings (T-13)

**Touched files:** `shared/exit/tax-engine.ts`, `shared/exit/exchange-1031-engine.ts`

**Fix:**
- Tax engine: improved loss warning message
- 1031 engine: added `NO_GAIN_TO_DEFER` warning when `realizedGain <= 0`

---

## PATCH 13: Dead Code Removal (T-17)

**Touched files:** `shared/exit/tax-engine.ts`

**Fix:** `const salePrice = allocation.netSalePrice + (... ? 0 : 0)` → `const salePrice = allocation.netSalePrice`

---

## How to Test

### Run all acceptance tests:
```bash
npx vitest run shared/exit/__tests__/patch-acceptance.test.ts
```

### Run type-checking:
```bash
npx tsc --noEmit --skipLibCheck
```

### Key test cases to verify manually:
1. **1031 Full Deferral**: `afterTaxEquityProceeds === beforeTaxEquityProceeds` (was previously showing full tax bill)
2. **Installment Recapture**: Year 0 §1250 ≈ 820,513 (was previously capped at ~164k from down payment ratio)
3. **Refi IRR**: IRR with Year 3 cash-out > 2-point IRR (was previously identical)
4. **Edge cases**: All `edge_*` vectors produce no NaN/Infinity and no uncaught exceptions

### Regression check:
The `cash_sale_baseline` vector has no behavioral changes — it validates that non-1031, non-installment, non-refi scenarios continue to produce identical results.
