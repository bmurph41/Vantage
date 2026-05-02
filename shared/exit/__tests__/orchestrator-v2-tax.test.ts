/**
 * Orchestrator-v2 Tax Drift — Regression Shield
 *
 * The tax-engine refactor moved tax fields into nested sub-objects
 * (`federal.ltcgTax`, `federal.section1245Tax`, `federal.niitTax`,
 * `dualState.netStateTax`, `totalTaxLiability`). orchestrator-v2.ts:1363-1380
 * still reads the legacy flat names with `?? 0` fallbacks, so every scenario
 * materializes `TaxSchedule` with `taxFederal=0, taxState=0, taxNIIT=0,
 * totalTax=0`. The KPI block at line 1442 then persists those zeros.
 *
 * Bundled with the 1031 adapter drift in `adapters.ts:169` (covered by the
 * REGRESSION SHIELD blocks in patch-acceptance.test.ts) — fixing only one
 * leaves the other producing zeros.
 *
 * These tests exercise `runExitScenarioV2` end-to-end. They will FAIL today
 * (silent zeros) and PASS once substep 2 lands the field remap.
 *
 * Hand-spot-checks for Scenario A:
 *   - Sale price $6M, basis ~$4.27M, gain ~$1.73M
 *   - $727K of unrecaptured §1250 (10 yrs depreciation on $2M building)
 *   - LTCG portion ~$1M
 *   - Federal LTCG tax @ 20% on $1M ≈ $200K
 *   - §1250 unrecaptured @ 25% on $727K ≈ $182K
 *   - NIIT @ 3.8% on $1.73M ≈ $66K
 *   - CA state @ 13.3% on $1.73M ≈ $230K
 *   - Total tax ≈ $678K  → assertions use loose `>` checks so bracket
 *     specifics don't make the test brittle.
 */
import { describe, it, expect } from 'vitest';

import { runExitScenarioV2 } from '../orchestrator-v2';
import type { ExitScenarioInput } from '../types/07-master-types';

// ============================================================================
// Helper — minimal valid ExitScenarioInput for a 5-yr multifamily hold
// ============================================================================
function buildBaseScenario(overrides: Partial<ExitScenarioInput> = {}): ExitScenarioInput {
  const base: ExitScenarioInput = {
    schemaVersion: '1.0',
    name: 'Test Scenario',
    assetClass: 'multifamily',
    status: 'draft',
    dealType: 'asset_sale',
    saleCloseDate: '2025-09-01',
    ownershipPercent: 100,
    partialInterestSale: false,
    operatingBusinessInvolved: false,
    saleTerms: {
      salePrice: 6_000_000,
      sellingExpenses: [
        {
          category: 'broker_commission',
          label: 'Broker',
          amount: 300_000,
          percentOfSale: null,
          computedAmount: 300_000,
        },
      ],
      closingCosts: [
        {
          category: 'other',
          label: 'Closing',
          amount: 50_000,
          percentOfSale: null,
          computedAmount: 50_000,
        },
      ],
      creditsToBuyer: 0,
      prorationsNetToSeller: 0,
      escrowsReleased: 0,
      debtPayoff: 0,
      prepaymentPenalty: 0,
      defeasanceCost: 0,
    },
    allocation: {
      schemaVersion: '1.0',
      purchasePrice: 5_000_000,
      allocationMethod: 'percent',
      assetClass: 'multifamily',
      buckets: [
        {
          key: 'land',
          label: 'Land',
          allocatedAmount: 1_000_000,
          allocatedPercent: 20,
          depreciationCharacter: 'non_depreciable',
          usefulLifeYears: null,
          accumulatedDepreciation: 0,
        },
        {
          key: 'building',
          label: 'Building',
          allocatedAmount: 4_000_000,
          allocatedPercent: 80,
          depreciationCharacter: '1250',
          usefulLifeYears: 27.5,
          // 10 years of straight-line on $4M / 27.5 = ~$1,454,545 (round number)
          accumulatedDepreciation: 1_454_545,
        },
      ],
      capexSchedule: [],
      acquisitionDate: '2015-09-01',
      dispositionDate: '2025-09-01',
    },
    allocationLock: {
      lockedAt: null,
      lockPolicy: 'soft',
      dependencyFingerprint: 'test',
      isStale: false,
    },
    taxProfile: {
      filingStatus: 'mfj',
      stateCode: 'CA',
      niitEnabled: true,
      otherOrdinaryIncome: 250_000,
      otherCapitalGains: 0,
    },
  };
  return { ...base, ...overrides };
}

// ============================================================================
// SCENARIO A — Standard 5-yr+ hold, $1M+ LTCG, no 1031, CA state.
// Expected: taxFederal/taxState/taxNIIT/totalTax all > 0.
// ============================================================================
describe('REGRESSION SHIELD: orchestrator-v2 tax drift — standard cash sale', () => {
  it('produces non-zero tax fields for a typical LTCG scenario', async () => {
    const input = buildBaseScenario();
    const result = await runExitScenarioV2(input);

    // Sanity: there IS a gain.
    expect(result.summary.realizedGain).toBeGreaterThan(0);

    // The bug: every tax field today resolves to 0 from the silent-zero
    // reads at orchestrator-v2.ts:1363-1380. Post-fix, all four are positive.
    expect(result.kpis.taxFederal).toBeGreaterThan(0);
    expect(result.kpis.taxState).toBeGreaterThan(0);
    expect(result.kpis.taxNIIT).toBeGreaterThan(0);
    expect(result.kpis.taxTotal).toBeGreaterThan(0);

    // After-tax cash should be strictly less than pre-tax cash.
    expect(result.kpis.afterTaxCashNow).toBeLessThan(result.saleComputation.cashProceedsPreTax);
  });

  it('TaxSchedule mirrors KPI tax fields', async () => {
    const input = buildBaseScenario();
    const result = await runExitScenarioV2(input);
    expect(result.taxSchedule.totalTax).toBe(result.kpis.taxTotal);
    expect(result.taxSchedule.totalFederalTax).toBe(result.kpis.taxFederal);
    expect(result.taxSchedule.totalStateTax).toBe(result.kpis.taxState);
    expect(result.taxSchedule.totalNIIT).toBe(result.kpis.taxNIIT);
  });
});

// ============================================================================
// SCENARIO B — 1031 full deferral.
// Expected: tax close to 0 (deferred), but 1031 fields populated.
// ============================================================================
describe('REGRESSION SHIELD: orchestrator-v2 tax drift — 1031 full deferral', () => {
  it('deferredGain > 0 and recognizedGain ≈ 0 with 1031 enabled', async () => {
    const input = buildBaseScenario({
      exchange1031: {
        enabled: true,
        replacementProperties: [
          {
            id: 'rp-1',
            name: 'Replacement Property',
            purchasePrice: 7_000_000,           // trade UP — fully absorbs gain
            replacementDebtPlaced: 4_000_000,
            closingCosts: 100_000,
            capitalizedCostPolicy: 'capitalize',
          },
        ],
        qi: { qiFee: 3_000, cashHeldByQI: true, sellerNoteAssignedToQI: false },
        boot: { cashKeptOut: 0, additionalCashIn: 1_000_000, nonLikeKindPropertyRetainedValue: 0 },
      },
    });
    const result = await runExitScenarioV2(input);

    // Both bugs converge here: 1031 adapter drift makes deferredGain look like 0,
    // and orchestrator tax drift makes tax fields look like 0. Post-fix, tax is
    // legitimately 0 (deferred) but deferredGain reads correctly.
    expect(result.summary.deferredGain).toBeGreaterThan(0);
    expect(result.summary.recognizedGain).toBeLessThanOrEqual(result.summary.realizedGain);
    expect(result.exchange1031Result).toBeDefined();
    expect(result.exchange1031Result!.deferredGain).toBeGreaterThan(0);
  });
});

// ============================================================================
// SCENARIO C — 1031 with boot (trade-down creates partial recognition).
// Expected: tax > 0 on the boot, deferredGain >= 0, recognizedGain > 0.
// ============================================================================
describe('REGRESSION SHIELD: orchestrator-v2 tax drift — 1031 with boot', () => {
  it('boot triggers partial recognition AND tax', async () => {
    const input = buildBaseScenario({
      exchange1031: {
        enabled: true,
        replacementProperties: [
          {
            id: 'rp-1',
            name: 'Smaller Replacement',
            purchasePrice: 3_500_000,           // trade DOWN — creates boot
            replacementDebtPlaced: 1_000_000,   // less debt than relinquished
            closingCosts: 80_000,
            capitalizedCostPolicy: 'capitalize',
          },
        ],
        qi: { qiFee: 3_000, cashHeldByQI: true, sellerNoteAssignedToQI: false },
        boot: { cashKeptOut: 0, additionalCashIn: 0, nonLikeKindPropertyRetainedValue: 0 },
      },
      saleTerms: {
        salePrice: 6_000_000,
        sellingExpenses: [
          { category: 'broker_commission', label: 'Broker', amount: 300_000, percentOfSale: null, computedAmount: 300_000 },
        ],
        closingCosts: [
          { category: 'other', label: 'Closing', amount: 50_000, percentOfSale: null, computedAmount: 50_000 },
        ],
        creditsToBuyer: 0,
        prorationsNetToSeller: 0,
        escrowsReleased: 0,
        debtPayoff: 2_500_000,                  // relinquished debt being paid off
        prepaymentPenalty: 0,
        defeasanceCost: 0,
      },
    });
    const result = await runExitScenarioV2(input);

    // 1031 was attempted; result is defined.
    expect(result.exchange1031Result).toBeDefined();

    // Trade-down creates boot. Post-fix: mortgageBoot OR cashBoot > 0.
    const e = result.exchange1031Result!;
    expect(e.totalBoot).toBeGreaterThan(0);
    expect(e.mortgageBoot + e.cashBoot).toBeGreaterThan(0);

    // Boot triggers partial recognition.
    expect(e.recognizedGain).toBeGreaterThan(0);
    expect(e.deferredGain).toBeGreaterThanOrEqual(0);

    // Recognized gain → some tax. Post-fix, total tax > 0.
    expect(result.kpis.taxTotal).toBeGreaterThan(0);
    expect(result.kpis.taxFederal).toBeGreaterThan(0);
  });
});
