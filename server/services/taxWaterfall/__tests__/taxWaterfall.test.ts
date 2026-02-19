import { describe, it, expect } from 'vitest';
import { runTaxEngine, computeTaxBuckets } from '../taxEngine';
import { runWaterfallEngine, createInitialState } from '../waterfallEngine';
import { runCoordinator } from '../coordinator';
import { toCents, fromCents, allocateProRata, safeMultiplyRate, ZERO } from '../money';
import type {
  CashflowPeriod,
  PartnerInfo,
  TaxInputs,
  TaxSettings,
  WaterfallTierConfig,
  WaterfallState,
} from '../types';

function makePeriod(overrides: Partial<CashflowPeriod> & { periodIndex: number }): CashflowPeriod {
  return {
    periodStart: new Date(2025, 0, 1),
    periodEnd: new Date(2025, 11, 31),
    noiCents: ZERO,
    interestCents: ZERO,
    debtServiceCents: ZERO,
    capexCents: ZERO,
    reservesCents: ZERO,
    cashAvailableCents: ZERO,
    warnings: [],
    ...overrides,
  };
}

function makePartner(overrides: Partial<PartnerInfo>): PartnerInfo {
  return {
    partnerId: 'lp-1',
    name: 'LP 1',
    role: 'lp',
    ownershipPercent: 90,
    taxProfile: null,
    equityContributedCents: ZERO,
    ...overrides,
  };
}

const defaultTaxInputs: TaxInputs = {
  annualDepreciationCents: ZERO,
  depreciationMethod: 'manual',
  amortizationAnnualCents: ZERO,
  interestDeductible: true,
  saleCostBasisCents: ZERO,
  accumulatedDepreciationCents: ZERO,
};

// ────────────────────────────────────────────────────
// Test 1: Straight split + flat tax
// ────────────────────────────────────────────────────
describe('Test 1: Straight split + flat tax', () => {
  const lp = makePartner({
    partnerId: 'lp-1',
    role: 'lp',
    ownershipPercent: 90,
    equityContributedCents: toCents(5_000_000),
    taxProfile: { id: 'tp-1', filingType: 'individual', effectiveTaxRate: 0.25, ordinaryRate: null, ltcgRate: null, recaptureRate: null, niitRate: null, stateRate: null, localRate: null },
  });
  const gp = makePartner({
    partnerId: 'gp-1',
    name: 'GP 1',
    role: 'gp',
    ownershipPercent: 10,
    equityContributedCents: toCents(500_000),
    taxProfile: { id: 'tp-2', filingType: 'individual', effectiveTaxRate: 0.25, ordinaryRate: null, ltcgRate: null, recaptureRate: null, niitRate: null, stateRate: null, localRate: null },
  });
  const partners = [lp, gp];

  const period = makePeriod({
    periodIndex: 0,
    noiCents: toCents(1_000_000),
    interestCents: toCents(200_000),
    cashAvailableCents: toCents(700_000),
  });

  const taxInputs: TaxInputs = {
    ...defaultTaxInputs,
    annualDepreciationCents: toCents(300_000),
    interestDeductible: true,
  };

  it('computes correct tax buckets', () => {
    const buckets = computeTaxBuckets(period, taxInputs, 1);
    expect(Number(buckets.ordinaryCents)).toBe(50_000_000);
    expect(Number(buckets.capGainCents)).toBe(0);
    expect(Number(buckets.recaptureCents)).toBe(0);
  });

  it('computes correct flat taxes', () => {
    const result = runTaxEngine(period, partners, taxInputs, 'flat', 1);
    const lpTax = result.partnerTaxes.find(t => t.partnerId === 'lp-1')!;
    const gpTax = result.partnerTaxes.find(t => t.partnerId === 'gp-1')!;

    expect(Number(lpTax.allocatedBuckets.ordinaryCents)).toBe(45_000_000);
    expect(Number(gpTax.allocatedBuckets.ordinaryCents)).toBe(5_000_000);

    expect(Number(lpTax.taxDueCents)).toBe(11_250_000);
    expect(Number(gpTax.taxDueCents)).toBe(1_250_000);
    const totalTax = Number(lpTax.taxDueCents) + Number(gpTax.taxDueCents);
    expect(totalTax).toBe(12_500_000);
  });

  it('computes correct waterfall distributions (straight split)', () => {
    const tiers: WaterfallTierConfig[] = [
      { tierOrder: 1, tierType: 'split', prefRate: null, catchUpTargetGpShare: null, irrHurdle: null, equityMultipleHurdle: null, lpSplit: 90, gpSplit: 10, notes: null },
    ];
    const state = createInitialState(partners);
    const result = runWaterfallEngine(toCents(700_000), tiers, partners, state, 1);

    const lpDist = result.distributionsByPartner.get('lp-1')!;
    const gpDist = result.distributionsByPartner.get('gp-1')!;

    expect(Number(lpDist)).toBe(63_000_000);
    expect(Number(gpDist)).toBe(7_000_000);
  });

  it('coordinator: pre-tax waterfall produces correct after-tax distributions', () => {
    const tiers: WaterfallTierConfig[] = [
      { tierOrder: 1, tierType: 'split', prefRate: null, catchUpTargetGpShare: null, irrHurdle: null, equityMultipleHurdle: null, lpSplit: 90, gpSplit: 10, notes: null },
    ];
    const taxSettings: TaxSettings = {
      enabled: true,
      taxMode: 'flat',
      taxTiming: 'annual',
      taxInteractionMode: 'waterfall_pre_tax',
      defaultTaxProfileId: null,
    };

    const result = runCoordinator([period], partners, tiers, taxInputs, taxSettings, 1);
    expect(result.ok).toBe(true);
    expect(result.periodResults).toHaveLength(1);

    const pr = result.periodResults[0];
    const lpPreTax = pr.distributionsPreTaxByPartner.find(d => d.partnerId === 'lp-1')!;
    const gpPreTax = pr.distributionsPreTaxByPartner.find(d => d.partnerId === 'gp-1')!;
    expect(lpPreTax.amountCents).toBe('63000000');
    expect(gpPreTax.amountCents).toBe('7000000');

    const lpAfterTax = pr.distributionsAfterTaxByPartner.find(d => d.partnerId === 'lp-1')!;
    const gpAfterTax = pr.distributionsAfterTaxByPartner.find(d => d.partnerId === 'gp-1')!;
    expect(Number(BigInt(lpAfterTax.amountCents))).toBe(63_000_000 - 11_250_000);
    expect(Number(BigInt(gpAfterTax.amountCents))).toBe(7_000_000 - 1_250_000);
  });
});

// ────────────────────────────────────────────────────
// Test 2: Pref + catch-up + split + sale event
// ────────────────────────────────────────────────────
describe('Test 2: Pref + catch-up + split + sale event', () => {
  const lp = makePartner({
    partnerId: 'lp-1',
    role: 'lp',
    ownershipPercent: 100,
    equityContributedCents: toCents(10_000_000),
    taxProfile: {
      id: 'tp-1', filingType: 'individual',
      effectiveTaxRate: null,
      ordinaryRate: 0.37, ltcgRate: 0.20, recaptureRate: 0.25,
      niitRate: 0, stateRate: 0, localRate: 0,
    },
  });
  const gp = makePartner({
    partnerId: 'gp-1',
    name: 'GP 1',
    role: 'gp',
    ownershipPercent: 0,
    equityContributedCents: ZERO,
    taxProfile: {
      id: 'tp-2', filingType: 'individual',
      effectiveTaxRate: null,
      ordinaryRate: 0.37, ltcgRate: 0.20, recaptureRate: 0.25,
      niitRate: 0, stateRate: 0, localRate: 0,
    },
  });
  const partners = [lp, gp];

  const tiers: WaterfallTierConfig[] = [
    { tierOrder: 1, tierType: 'return_of_capital', prefRate: null, catchUpTargetGpShare: null, irrHurdle: null, equityMultipleHurdle: null, lpSplit: null, gpSplit: null, notes: null },
    { tierOrder: 2, tierType: 'preferred_return', prefRate: 0.08, catchUpTargetGpShare: null, irrHurdle: null, equityMultipleHurdle: null, lpSplit: null, gpSplit: null, notes: null },
    { tierOrder: 3, tierType: 'catch_up', prefRate: null, catchUpTargetGpShare: 20, irrHurdle: null, equityMultipleHurdle: null, lpSplit: null, gpSplit: null, notes: null },
    { tierOrder: 4, tierType: 'split', prefRate: null, catchUpTargetGpShare: null, irrHurdle: null, equityMultipleHurdle: null, lpSplit: 80, gpSplit: 20, notes: null },
  ];

  const taxInputs: TaxInputs = {
    ...defaultTaxInputs,
    annualDepreciationCents: toCents(200_000),
    amortizationAnnualCents: ZERO,
    interestDeductible: true,
    saleCostBasisCents: toCents(10_000_000),
    accumulatedDepreciationCents: toCents(1_000_000),
  };

  const periods: CashflowPeriod[] = [
    makePeriod({
      periodIndex: 0,
      periodStart: new Date(2025, 0, 1),
      periodEnd: new Date(2025, 11, 31),
      noiCents: toCents(1_000_000),
      interestCents: toCents(300_000),
      cashAvailableCents: toCents(1_000_000),
    }),
    makePeriod({
      periodIndex: 1,
      periodStart: new Date(2026, 0, 1),
      periodEnd: new Date(2026, 11, 31),
      noiCents: toCents(1_000_000),
      interestCents: toCents(300_000),
      cashAvailableCents: toCents(1_000_000),
    }),
    makePeriod({
      periodIndex: 2,
      periodStart: new Date(2027, 0, 1),
      periodEnd: new Date(2027, 11, 31),
      noiCents: toCents(1_000_000),
      interestCents: toCents(300_000),
      cashAvailableCents: toCents(15_000_000),
      saleEvent: {
        netSaleProceedsCents: toCents(15_000_000),
        saleCostsCents: toCents(450_000),
      },
    }),
  ];

  it('correctly computes sale tax buckets (recapture + capital gains)', () => {
    const buckets = computeTaxBuckets(periods[2], taxInputs, 1);
    expect(Number(buckets.ordinaryCents)).toBe(50_000_000);
    const adjustedBasis = 10_000_000 - 1_000_000;
    const saleGain = 15_000_000 - adjustedBasis;
    expect(Number(buckets.recaptureCents)).toBe(100_000_000);
    expect(Number(buckets.capGainCents)).toBe((saleGain - 1_000_000) * 100);
  });

  it('waterfall distributes through pref + catch-up + split', () => {
    const state = createInitialState(partners);
    const y1 = runWaterfallEngine(toCents(1_000_000), tiers, partners, state, 1);
    expect(y1.distributionsByPartner.get('lp-1')!).toBeGreaterThan(ZERO);

    const y2 = runWaterfallEngine(toCents(1_000_000), tiers, partners, state, 1);
    expect(y2.distributionsByPartner.get('lp-1')!).toBeGreaterThan(ZERO);

    const y3 = runWaterfallEngine(toCents(15_000_000), tiers, partners, state, 1);
    const lpDist = Number(y3.distributionsByPartner.get('lp-1')!);
    const gpDist = Number(y3.distributionsByPartner.get('gp-1')!);
    expect(lpDist + gpDist).toBe(1_500_000_000);
    expect(gpDist).toBeGreaterThan(0);
  });

  it('coordinator produces multi-period results with tax buckets', () => {
    const taxSettings: TaxSettings = {
      enabled: true,
      taxMode: 'split',
      taxTiming: 'annual',
      taxInteractionMode: 'waterfall_pre_tax',
      defaultTaxProfileId: null,
    };
    const result = runCoordinator(periods, partners, tiers, taxInputs, taxSettings, 1);
    expect(result.ok).toBe(true);
    expect(result.periodResults).toHaveLength(3);

    const y3 = result.periodResults[2];
    expect(BigInt(y3.taxableBucketsCents.recapture)).toBeGreaterThan(ZERO);
    expect(BigInt(y3.taxableBucketsCents.capGain)).toBeGreaterThan(ZERO);

    const lpTax = y3.taxesByPartner.find(t => t.partnerId === 'lp-1')!;
    expect(BigInt(lpTax.recaptureTaxCents)).toBeGreaterThan(ZERO);
    expect(BigInt(lpTax.capGainTaxCents)).toBeGreaterThan(ZERO);
  });
});

// ────────────────────────────────────────────────────
// Test 3: Tax distribution layer cash-constrained
// ────────────────────────────────────────────────────
describe('Test 3: Tax distribution layer cash-constrained', () => {
  const lp = makePartner({
    partnerId: 'lp-1',
    role: 'lp',
    ownershipPercent: 90,
    equityContributedCents: toCents(1_000_000),
    taxProfile: { id: 'tp-1', filingType: 'individual', effectiveTaxRate: 0.40, ordinaryRate: null, ltcgRate: null, recaptureRate: null, niitRate: null, stateRate: null, localRate: null },
  });
  const gp = makePartner({
    partnerId: 'gp-1',
    name: 'GP 1',
    role: 'gp',
    ownershipPercent: 10,
    equityContributedCents: toCents(100_000),
    taxProfile: { id: 'tp-2', filingType: 'individual', effectiveTaxRate: 0.40, ordinaryRate: null, ltcgRate: null, recaptureRate: null, niitRate: null, stateRate: null, localRate: null },
  });
  const partners = [lp, gp];

  const period = makePeriod({
    periodIndex: 0,
    noiCents: toCents(500_000),
    interestCents: toCents(50_000),
    cashAvailableCents: toCents(100_000),
  });

  const taxInputs: TaxInputs = {
    ...defaultTaxInputs,
    annualDepreciationCents: toCents(50_000),
    interestDeductible: true,
  };

  it('tax distribution tier handles insufficient cash with warning', () => {
    const tiers: WaterfallTierConfig[] = [
      { tierOrder: 1, tierType: 'split', prefRate: null, catchUpTargetGpShare: null, irrHurdle: null, equityMultipleHurdle: null, lpSplit: 90, gpSplit: 10, notes: null },
    ];

    const taxSettings: TaxSettings = {
      enabled: true,
      taxMode: 'flat',
      taxTiming: 'annual',
      taxInteractionMode: 'tax_distribution_layer',
      defaultTaxProfileId: null,
    };

    const result = runCoordinator([period], partners, tiers, taxInputs, taxSettings, 1);
    expect(result.ok).toBe(true);

    const pr = result.periodResults[0];
    const totalTaxDue = pr.taxesByPartner.reduce((s, t) => s + BigInt(t.taxDueCents), ZERO);
    expect(totalTaxDue).toBeGreaterThan(toCents(100_000));

    const hasTaxTier = pr.waterfallBreakdown.some(t => t.tierType === 'tax_distribution');
    expect(hasTaxTier).toBe(true);

    const hasWarning = pr.warnings.some(w => w.includes('insufficient cash') || w.includes('Pro-rata'));
    expect(hasWarning).toBe(true);
  });
});

// ────────────────────────────────────────────────────
// Test 4: After-tax waterfall
// ────────────────────────────────────────────────────
describe('Test 4: After-tax waterfall', () => {
  const lp = makePartner({
    partnerId: 'lp-1',
    role: 'lp',
    ownershipPercent: 90,
    equityContributedCents: toCents(5_000_000),
    taxProfile: { id: 'tp-1', filingType: 'individual', effectiveTaxRate: 0.30, ordinaryRate: null, ltcgRate: null, recaptureRate: null, niitRate: null, stateRate: null, localRate: null },
  });
  const gp = makePartner({
    partnerId: 'gp-1',
    name: 'GP 1',
    role: 'gp',
    ownershipPercent: 10,
    equityContributedCents: toCents(500_000),
    taxProfile: { id: 'tp-2', filingType: 'individual', effectiveTaxRate: 0.30, ordinaryRate: null, ltcgRate: null, recaptureRate: null, niitRate: null, stateRate: null, localRate: null },
  });
  const partners = [lp, gp];

  const period = makePeriod({
    periodIndex: 0,
    noiCents: toCents(1_000_000),
    interestCents: toCents(200_000),
    cashAvailableCents: toCents(700_000),
  });

  const taxInputs: TaxInputs = {
    ...defaultTaxInputs,
    annualDepreciationCents: toCents(100_000),
    interestDeductible: true,
  };

  it('after-tax waterfall distributes reduced cash', () => {
    const tiers: WaterfallTierConfig[] = [
      { tierOrder: 1, tierType: 'split', prefRate: null, catchUpTargetGpShare: null, irrHurdle: null, equityMultipleHurdle: null, lpSplit: 90, gpSplit: 10, notes: null },
    ];
    const taxSettings: TaxSettings = {
      enabled: true,
      taxMode: 'flat',
      taxTiming: 'annual',
      taxInteractionMode: 'waterfall_after_tax',
      defaultTaxProfileId: null,
    };

    const result = runCoordinator([period], partners, tiers, taxInputs, taxSettings, 1);
    expect(result.ok).toBe(true);

    const pr = result.periodResults[0];
    const taxResult = runTaxEngine(period, partners, taxInputs, 'flat', 1);
    const totalTax = taxResult.partnerTaxes.reduce((s, t) => s + t.taxDueCents, ZERO);
    const afterTaxCash = toCents(700_000) - totalTax;

    const lpDist = BigInt(pr.distributionsPreTaxByPartner.find(d => d.partnerId === 'lp-1')!.amountCents);
    const gpDist = BigInt(pr.distributionsPreTaxByPartner.find(d => d.partnerId === 'gp-1')!.amountCents);
    const totalDist = lpDist + gpDist;

    expect(totalDist).toBe(afterTaxCash);
    expect(Number(lpDist)).toBeCloseTo(Number(afterTaxCash) * 0.9, -2);
  });

  it('after-tax dist equals pre-tax dist in after_tax mode', () => {
    const tiers: WaterfallTierConfig[] = [
      { tierOrder: 1, tierType: 'split', prefRate: null, catchUpTargetGpShare: null, irrHurdle: null, equityMultipleHurdle: null, lpSplit: 90, gpSplit: 10, notes: null },
    ];
    const taxSettings: TaxSettings = {
      enabled: true,
      taxMode: 'flat',
      taxTiming: 'annual',
      taxInteractionMode: 'waterfall_after_tax',
      defaultTaxProfileId: null,
    };

    const result = runCoordinator([period], partners, tiers, taxInputs, taxSettings, 1);
    const pr = result.periodResults[0];

    for (const p of partners) {
      const preTax = pr.distributionsPreTaxByPartner.find(d => d.partnerId === p.partnerId)!;
      const afterTax = pr.distributionsAfterTaxByPartner.find(d => d.partnerId === p.partnerId)!;
      expect(preTax.amountCents).toBe(afterTax.amountCents);
    }
  });
});

// ────────────────────────────────────────────────────
// Contract tests
// ────────────────────────────────────────────────────
describe('Contract: result shape', () => {
  const lp = makePartner({ partnerId: 'lp-1', role: 'lp', ownershipPercent: 100, equityContributedCents: toCents(1_000_000) });
  const period = makePeriod({ periodIndex: 0, cashAvailableCents: toCents(100_000), noiCents: toCents(100_000) });
  const tiers: WaterfallTierConfig[] = [
    { tierOrder: 1, tierType: 'split', prefRate: null, catchUpTargetGpShare: null, irrHurdle: null, equityMultipleHurdle: null, lpSplit: 100, gpSplit: 0, notes: null },
  ];
  const taxSettings: TaxSettings = { enabled: false, taxMode: 'flat', taxTiming: 'annual', taxInteractionMode: 'waterfall_pre_tax', defaultTaxProfileId: null };

  it('returns all expected top-level keys', () => {
    const result = runCoordinator([period], [lp], tiers, defaultTaxInputs, taxSettings, 1);
    expect(result).toHaveProperty('ok', true);
    expect(result).toHaveProperty('periodResults');
    expect(result).toHaveProperty('summary');
    expect(result.summary).toHaveProperty('preTaxIRRByPartner');
    expect(result.summary).toHaveProperty('afterTaxIRRByPartner');
    expect(result.summary).toHaveProperty('preTaxMOICByPartner');
    expect(result.summary).toHaveProperty('afterTaxMOICByPartner');
    expect(result.summary).toHaveProperty('taxDragByPartner');
  });

  it('period result has all expected keys', () => {
    const result = runCoordinator([period], [lp], tiers, defaultTaxInputs, taxSettings, 1);
    const pr = result.periodResults[0];
    expect(pr).toHaveProperty('periodIndex');
    expect(pr).toHaveProperty('periodStart');
    expect(pr).toHaveProperty('periodEnd');
    expect(pr).toHaveProperty('cashAvailableCents');
    expect(pr).toHaveProperty('taxableBucketsCents');
    expect(pr.taxableBucketsCents).toHaveProperty('ordinary');
    expect(pr.taxableBucketsCents).toHaveProperty('capGain');
    expect(pr.taxableBucketsCents).toHaveProperty('recapture');
    expect(pr).toHaveProperty('taxesByPartner');
    expect(pr).toHaveProperty('distributionsPreTaxByPartner');
    expect(pr).toHaveProperty('distributionsAfterTaxByPartner');
    expect(pr).toHaveProperty('waterfallBreakdown');
    expect(pr).toHaveProperty('warnings');
  });
});

// ────────────────────────────────────────────────────
// Money helpers
// ────────────────────────────────────────────────────
describe('Money helpers', () => {
  it('toCents and fromCents are inverse', () => {
    expect(fromCents(toCents(123.45))).toBe(123.45);
    expect(fromCents(toCents(0))).toBe(0);
    expect(fromCents(toCents(999_999.99))).toBe(999_999.99);
  });

  it('allocateProRata sums to total', () => {
    const total = toCents(1_000_000);
    const weights = [
      { id: 'a', weight: 90 },
      { id: 'b', weight: 10 },
    ];
    const result = allocateProRata(total, weights);
    let sum = ZERO;
    for (const v of result.values()) sum += v;
    expect(sum).toBe(total);
  });

  it('allocateProRata handles single weight', () => {
    const total = toCents(777);
    const result = allocateProRata(total, [{ id: 'only', weight: 100 }]);
    expect(result.get('only')).toBe(total);
  });

  it('safeMultiplyRate rounds correctly', () => {
    expect(Number(safeMultiplyRate(100n, 0.333))).toBe(33);
    expect(Number(safeMultiplyRate(100n, 0.5))).toBe(50);
    expect(Number(safeMultiplyRate(1000n, 0.1))).toBe(100);
  });
});
