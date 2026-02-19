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
    } else {
      if (taxMode === 'advanced') {
        warnings.push(`Partner ${partner.partnerId}: 'advanced' tax mode not yet implemented; falling back to 'split'.`);
      }
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
