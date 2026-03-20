import {
  CashflowPeriod,
  PartnerInfo,
  TaxInputs,
  TaxMode,
  TaxBuckets,
  PartnerTaxResult,
  TaxEngineResult,
} from './types';
import { ZERO, safeMultiplyRate, allocateProRata, maxBigInt, minBigInt } from './money';

export function computeTaxBuckets(
  period: CashflowPeriod,
  taxInputs: TaxInputs,
  periodsPerYear: number,
): TaxBuckets {
  const depreciationPerPeriod = taxInputs.annualDepreciationCents / BigInt(periodsPerYear);
  const amortizationPerPeriod = taxInputs.amortizationAnnualCents / BigInt(periodsPerYear);

  const interestDeduction = taxInputs.interestDeductible ? period.interestCents : ZERO;

  let ordinaryCents = period.noiCents - interestDeduction - depreciationPerPeriod - amortizationPerPeriod;

  let capGainCents = ZERO;
  let recaptureCents = ZERO;
  let lossCents = ZERO;

  if (period.saleEvent) {
    const adjustedBasis = taxInputs.saleCostBasisCents - taxInputs.accumulatedDepreciationCents;
    const saleGain = period.saleEvent.netSaleProceedsCents - adjustedBasis;

    if (saleGain > ZERO) {
      recaptureCents = minBigInt(taxInputs.accumulatedDepreciationCents, saleGain);
      capGainCents = maxBigInt(ZERO, saleGain - recaptureCents);
    }
  }

  if (ordinaryCents < ZERO) {
    lossCents = -ordinaryCents;
    ordinaryCents = ZERO;
  }

  return { ordinaryCents, capGainCents, recaptureCents, lossCents };
}

function computePartnerTaxFlat(
  allocatedBuckets: TaxBuckets,
  effectiveRate: number,
): { ordinaryTaxCents: bigint; capGainTaxCents: bigint; recaptureTaxCents: bigint; taxDueCents: bigint } {
  const totalTaxable = allocatedBuckets.ordinaryCents + allocatedBuckets.capGainCents + allocatedBuckets.recaptureCents;
  const taxDueCents = safeMultiplyRate(totalTaxable, effectiveRate);
  return {
    ordinaryTaxCents: safeMultiplyRate(allocatedBuckets.ordinaryCents, effectiveRate),
    capGainTaxCents: safeMultiplyRate(allocatedBuckets.capGainCents, effectiveRate),
    recaptureTaxCents: safeMultiplyRate(allocatedBuckets.recaptureCents, effectiveRate),
    taxDueCents,
  };
}

// --- Advanced tax mode: progressive brackets, capital gains, recapture, NIIT, state ---

const FEDERAL_ORDINARY_BRACKETS: { threshold: bigint; rate: number }[] = [
  { threshold: 1_160_000n, rate: 0.10 },   // 10% on first $11,600
  { threshold: 4_715_000n, rate: 0.12 },   // 12% up to $47,150
  { threshold: 10_052_500n, rate: 0.22 },  // 22% up to $100,525
  { threshold: 19_195_000n, rate: 0.24 },  // 24% up to $191,950
  { threshold: 24_372_500n, rate: 0.32 },  // 32% up to $243,725
  { threshold: 60_935_000n, rate: 0.35 },  // 35% up to $609,350
  { threshold: -1n, rate: 0.37 },          // 37% above (sentinel: no cap)
];

// Long-term capital gains brackets (2024 single filer thresholds, in cents)
const LTCG_BRACKETS: { threshold: bigint; rate: number }[] = [
  { threshold: 4_715_000n, rate: 0.00 },   // 0% up to $47,150
  { threshold: 51_880_000n, rate: 0.15 },  // 15% up to $518,800
  { threshold: -1n, rate: 0.20 },          // 20% above
];

const RECAPTURE_MAX_RATE = 0.25; // Section 1250 unrecaptured gains

// NIIT thresholds in cents by filing type
const NIIT_RATE = 0.038;
const NIIT_THRESHOLDS: Record<string, bigint> = {
  married_filing_jointly: 25_000_000n,
  married_filing_separately: 12_500_000n,
  single: 20_000_000n,
  head_of_household: 20_000_000n,
};

function applyProgressiveBrackets(incomeCents: bigint, brackets: { threshold: bigint; rate: number }[]): bigint {
  if (incomeCents <= ZERO) return ZERO;

  let remaining = incomeCents;
  let tax = ZERO;
  let prevThreshold = ZERO;

  for (const bracket of brackets) {
    if (remaining <= ZERO) break;

    const bracketSize = bracket.threshold === -1n
      ? remaining  // uncapped top bracket
      : bracket.threshold - prevThreshold;

    const taxableInBracket = remaining < bracketSize ? remaining : bracketSize;
    tax += safeMultiplyRate(taxableInBracket, bracket.rate);
    remaining -= taxableInBracket;

    if (bracket.threshold !== -1n) {
      prevThreshold = bracket.threshold;
    }
  }

  return tax;
}

function computePartnerTaxAdvanced(
  allocatedBuckets: TaxBuckets,
  partner: PartnerInfo,
): { ordinaryTaxCents: bigint; capGainTaxCents: bigint; recaptureTaxCents: bigint; taxDueCents: bigint; warnings: string[] } {
  const warnings: string[] = [];
  const filingType = partner.taxProfile?.filingType ?? 'single';
  const stateRate = partner.taxProfile?.stateRate ?? 0;

  // 1. Ordinary income: progressive federal brackets + state
  const ordinaryFederal = applyProgressiveBrackets(allocatedBuckets.ordinaryCents, FEDERAL_ORDINARY_BRACKETS);
  const ordinaryState = safeMultiplyRate(allocatedBuckets.ordinaryCents, stateRate);
  const ordinaryTaxCents = ordinaryFederal + ordinaryState;

  // 2. Capital gains: short-term at ordinary rates, long-term at preferential rates
  //    In the current model, capGainCents from a sale event represents long-term gains
  //    (held > 1 year assumed for real estate). Short-term would flow through ordinary.
  const capGainFederal = applyProgressiveBrackets(allocatedBuckets.capGainCents, LTCG_BRACKETS);
  const capGainState = safeMultiplyRate(allocatedBuckets.capGainCents, stateRate);
  const capGainTaxCents = capGainFederal + capGainState;

  // 3. Depreciation recapture: Section 1250 at max 25% federal + state
  const recaptureFederal = safeMultiplyRate(allocatedBuckets.recaptureCents, RECAPTURE_MAX_RATE);
  const recaptureState = safeMultiplyRate(allocatedBuckets.recaptureCents, stateRate);
  const recaptureTaxCents = recaptureFederal + recaptureState;

  // 4. Net Investment Income Tax (NIIT): 3.8% surtax on investment income for high earners
  let niitCents = ZERO;
  const totalInvestmentIncome = allocatedBuckets.ordinaryCents + allocatedBuckets.capGainCents + allocatedBuckets.recaptureCents;
  const niitThreshold = NIIT_THRESHOLDS[filingType] ?? NIIT_THRESHOLDS['single'];

  if (totalInvestmentIncome > niitThreshold) {
    const niitBase = totalInvestmentIncome - niitThreshold;
    niitCents = safeMultiplyRate(niitBase, NIIT_RATE);
    warnings.push(
      `Partner ${partner.partnerId}: NIIT of ${niitCents} cents applied on investment income exceeding ${filingType} threshold.`,
    );
  }

  const taxDueCents = ordinaryTaxCents + capGainTaxCents + recaptureTaxCents + niitCents;

  return { ordinaryTaxCents, capGainTaxCents, recaptureTaxCents, taxDueCents, warnings };
}

function computePartnerTaxSplit(
  allocatedBuckets: TaxBuckets,
  profile: { ordinaryRate: number; ltcgRate: number; recaptureRate: number; niitRate: number; stateRate: number; localRate: number },
): { ordinaryTaxCents: bigint; capGainTaxCents: bigint; recaptureTaxCents: bigint; taxDueCents: bigint } {
  const ordinaryRateTotal = profile.ordinaryRate + profile.stateRate + profile.localRate + profile.niitRate;
  const capGainRateTotal = profile.ltcgRate + profile.stateRate + profile.localRate + profile.niitRate;
  const recaptureRateTotal = profile.recaptureRate + profile.stateRate + profile.localRate + profile.niitRate;

  const ordinaryTaxCents = safeMultiplyRate(allocatedBuckets.ordinaryCents, ordinaryRateTotal);
  const capGainTaxCents = safeMultiplyRate(allocatedBuckets.capGainCents, capGainRateTotal);
  const recaptureTaxCents = safeMultiplyRate(allocatedBuckets.recaptureCents, recaptureRateTotal);
  const taxDueCents = ordinaryTaxCents + capGainTaxCents + recaptureTaxCents;

  return { ordinaryTaxCents, capGainTaxCents, recaptureTaxCents, taxDueCents };
}

export function runTaxEngine(
  period: CashflowPeriod,
  partners: PartnerInfo[],
  taxInputs: TaxInputs,
  taxMode: TaxMode,
  periodsPerYear: number,
): TaxEngineResult {
  const warnings: string[] = [];
  const totalTaxBuckets = computeTaxBuckets(period, taxInputs, periodsPerYear);

  if (totalTaxBuckets.lossCents > ZERO) {
    warnings.push(`Period ${period.periodIndex}: ordinary loss of ${totalTaxBuckets.lossCents} cents; no carryforward in Phase 1.`);
  }

  const ownershipWeights = partners.map(p => ({ id: p.partnerId, weight: p.ownershipPercent }));
  const ordinaryAlloc = allocateProRata(totalTaxBuckets.ordinaryCents, ownershipWeights);
  const capGainAlloc = allocateProRata(totalTaxBuckets.capGainCents, ownershipWeights);
  const recaptureAlloc = allocateProRata(totalTaxBuckets.recaptureCents, ownershipWeights);

  const partnerTaxes: PartnerTaxResult[] = partners.map(partner => {
    const allocatedBuckets: TaxBuckets = {
      ordinaryCents: ordinaryAlloc.get(partner.partnerId) || ZERO,
      capGainCents: capGainAlloc.get(partner.partnerId) || ZERO,
      recaptureCents: recaptureAlloc.get(partner.partnerId) || ZERO,
      lossCents: ZERO,
    };

    let result;

    if (taxMode === 'flat') {
      const effectiveRate = partner.taxProfile?.effectiveTaxRate ?? 0;
      if (effectiveRate === 0) {
        warnings.push(`Partner ${partner.partnerId}: no effective tax rate set; using 0%.`);
      }
      result = computePartnerTaxFlat(allocatedBuckets, effectiveRate);
    } else if (taxMode === 'advanced') {
      const advResult = computePartnerTaxAdvanced(allocatedBuckets, partner);
      warnings.push(...advResult.warnings);
      result = {
        ordinaryTaxCents: advResult.ordinaryTaxCents,
        capGainTaxCents: advResult.capGainTaxCents,
        recaptureTaxCents: advResult.recaptureTaxCents,
        taxDueCents: advResult.taxDueCents,
      };
    } else {
      // 'split' mode
      const profile = {
        ordinaryRate: partner.taxProfile?.ordinaryRate ?? 0,
        ltcgRate: partner.taxProfile?.ltcgRate ?? 0,
        recaptureRate: partner.taxProfile?.recaptureRate ?? 0.25,
        niitRate: partner.taxProfile?.niitRate ?? 0,
        stateRate: partner.taxProfile?.stateRate ?? 0,
        localRate: partner.taxProfile?.localRate ?? 0,
      };
      const hasAnyRate = profile.ordinaryRate > 0 || profile.ltcgRate > 0;
      if (!hasAnyRate) {
        warnings.push(`Partner ${partner.partnerId}: no split tax rates set; taxes will be 0.`);
      }
      result = computePartnerTaxSplit(allocatedBuckets, profile);
    }

    return {
      partnerId: partner.partnerId,
      ...result,
      allocatedBuckets,
    };
  });

  return { totalTaxBuckets, partnerTaxes, warnings };
}
