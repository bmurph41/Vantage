import {
  PartnerInfo,
  WaterfallTierConfig,
  WaterfallState,
  WaterfallEngineResult,
  WaterfallTierResult,
  TierAllocation,
  PartnerTaxResult,
} from './types';
import { ZERO, safeMultiplyRate, allocateProRata, maxBigInt, minBigInt, sumMap } from './money';

export function createInitialState(partners: PartnerInfo[]): WaterfallState {
  const state: WaterfallState = {
    unreturnedCapitalByPartner: new Map(),
    accruedPrefByPartner: new Map(),
    cumulativeDistributionsByPartner: new Map(),
    cumulativeProfitByPartner: new Map(),
  };
  for (const p of partners) {
    state.unreturnedCapitalByPartner.set(p.partnerId, p.equityContributedCents);
    state.accruedPrefByPartner.set(p.partnerId, ZERO);
    state.cumulativeDistributionsByPartner.set(p.partnerId, ZERO);
    state.cumulativeProfitByPartner.set(p.partnerId, ZERO);
  }
  return state;
}

export function runWaterfallEngine(
  cashAvailableCents: bigint,
  tiers: WaterfallTierConfig[],
  partners: PartnerInfo[],
  state: WaterfallState,
  periodsPerYear: number,
  partnerTaxes?: PartnerTaxResult[],
): WaterfallEngineResult {
  const warnings: string[] = [];
  const tierBreakdown: WaterfallTierResult[] = [];
  const distributionsByPartner = new Map<string, bigint>();
  for (const p of partners) distributionsByPartner.set(p.partnerId, ZERO);

  let remaining = cashAvailableCents;
  const sortedTiers = [...tiers].sort((a, b) => a.tierOrder - b.tierOrder);

  const lpPartners = partners.filter(p => p.role === 'lp' || p.role === 'other');
  const gpPartners = partners.filter(p => p.role === 'gp' || p.role === 'co_gp');

  for (const tier of sortedTiers) {
    if (remaining <= ZERO) {
      tierBreakdown.push({ tierOrder: tier.tierOrder, tierType: tier.tierType, allocations: [] });
      continue;
    }

    const allocations: TierAllocation[] = [];

    switch (tier.tierType) {
      case 'return_of_capital': {
        const totalUnreturned = sumMap(state.unreturnedCapitalByPartner);
        if (totalUnreturned <= ZERO) break;
        const toDistribute = minBigInt(remaining, totalUnreturned);
        const weights = partners
          .filter(p => (state.unreturnedCapitalByPartner.get(p.partnerId) || ZERO) > ZERO)
          .map(p => ({ id: p.partnerId, weight: Number(state.unreturnedCapitalByPartner.get(p.partnerId) || ZERO) }));
        const alloc = allocateProRata(toDistribute, weights);
        for (const [pid, amt] of alloc) {
          allocations.push({ partnerId: pid, amountCents: amt });
          distributionsByPartner.set(pid, (distributionsByPartner.get(pid) || ZERO) + amt);
          state.unreturnedCapitalByPartner.set(pid, maxBigInt(ZERO, (state.unreturnedCapitalByPartner.get(pid) || ZERO) - amt));
        }
        remaining -= toDistribute;
        break;
      }

      case 'preferred_return': {
        const prefRateAnnual = tier.prefRate ?? 0.08;
        const prefRatePerPeriod = prefRateAnnual / periodsPerYear;
        for (const lp of lpPartners) {
          const unreturned = state.unreturnedCapitalByPartner.get(lp.partnerId) || ZERO;
          const capital = lp.equityContributedCents;
          const basisForPref = capital > ZERO ? capital : unreturned;
          const accrued = (state.accruedPrefByPartner.get(lp.partnerId) || ZERO) +
            safeMultiplyRate(basisForPref, prefRatePerPeriod);
          state.accruedPrefByPartner.set(lp.partnerId, accrued);
        }
        const totalAccruedPref = lpPartners.reduce((s, lp) =>
          s + (state.accruedPrefByPartner.get(lp.partnerId) || ZERO), ZERO);
        if (totalAccruedPref <= ZERO) break;
        const toDistribute = minBigInt(remaining, totalAccruedPref);
        const prefWeights = lpPartners
          .filter(lp => (state.accruedPrefByPartner.get(lp.partnerId) || ZERO) > ZERO)
          .map(lp => ({ id: lp.partnerId, weight: Number(state.accruedPrefByPartner.get(lp.partnerId) || ZERO) }));
        const alloc = allocateProRata(toDistribute, prefWeights);
        for (const [pid, amt] of alloc) {
          allocations.push({ partnerId: pid, amountCents: amt });
          distributionsByPartner.set(pid, (distributionsByPartner.get(pid) || ZERO) + amt);
          state.accruedPrefByPartner.set(pid, maxBigInt(ZERO, (state.accruedPrefByPartner.get(pid) || ZERO) - amt));
        }
        remaining -= toDistribute;
        break;
      }

      case 'catch_up': {
        const targetGpShare = (tier.catchUpTargetGpShare ?? 20) / 100;
        const totalDistSoFar = sumMap(distributionsByPartner);
        const totalProfitDistributed = totalDistSoFar;
        const gpTargetTotal = safeMultiplyRate(totalProfitDistributed + remaining, targetGpShare);
        const gpSoFar = gpPartners.reduce((s, gp) => s + (distributionsByPartner.get(gp.partnerId) || ZERO), ZERO);
        const gpShortfall = maxBigInt(ZERO, gpTargetTotal - gpSoFar);
        const toDistribute = minBigInt(remaining, gpShortfall);
        if (toDistribute > ZERO && gpPartners.length > 0) {
          const gpWeights = gpPartners.map(gp => ({ id: gp.partnerId, weight: gp.ownershipPercent || 1 }));
          const alloc = allocateProRata(toDistribute, gpWeights);
          for (const [pid, amt] of alloc) {
            allocations.push({ partnerId: pid, amountCents: amt });
            distributionsByPartner.set(pid, (distributionsByPartner.get(pid) || ZERO) + amt);
          }
          remaining -= toDistribute;
        }
        break;
      }

      case 'split': {
        const lpPct = (tier.lpSplit ?? 80) / 100;
        const gpPct = (tier.gpSplit ?? 20) / 100;
        const toDistribute = remaining;
        const lpTotal = safeMultiplyRate(toDistribute, lpPct);
        const gpTotal = toDistribute - lpTotal;

        if (lpPartners.length > 0 && lpTotal > ZERO) {
          const lpWeights = lpPartners.map(lp => ({ id: lp.partnerId, weight: lp.ownershipPercent || 1 }));
          const lpAlloc = allocateProRata(lpTotal, lpWeights);
          for (const [pid, amt] of lpAlloc) {
            allocations.push({ partnerId: pid, amountCents: amt });
            distributionsByPartner.set(pid, (distributionsByPartner.get(pid) || ZERO) + amt);
          }
        } else if (lpTotal > ZERO) {
          const allWeights = partners.map(p => ({ id: p.partnerId, weight: p.ownershipPercent }));
          const allAlloc = allocateProRata(lpTotal, allWeights);
          for (const [pid, amt] of allAlloc) {
            allocations.push({ partnerId: pid, amountCents: amt });
            distributionsByPartner.set(pid, (distributionsByPartner.get(pid) || ZERO) + amt);
          }
        }

        if (gpPartners.length > 0 && gpTotal > ZERO) {
          const gpWeights = gpPartners.map(gp => ({ id: gp.partnerId, weight: gp.ownershipPercent || 1 }));
          const gpAlloc = allocateProRata(gpTotal, gpWeights);
          for (const [pid, amt] of gpAlloc) {
            allocations.push({ partnerId: pid, amountCents: amt });
            distributionsByPartner.set(pid, (distributionsByPartner.get(pid) || ZERO) + amt);
          }
        }

        remaining = ZERO;
        break;
      }

      case 'tax_distribution': {
        if (!partnerTaxes || partnerTaxes.length === 0) break;
        let totalTaxDue = ZERO;
        for (const pt of partnerTaxes) totalTaxDue += pt.taxDueCents;
        if (totalTaxDue <= ZERO) break;

        const toDistribute = minBigInt(remaining, totalTaxDue);
        if (toDistribute < totalTaxDue) {
          warnings.push(`Tax distribution tier: insufficient cash (${remaining} < ${totalTaxDue}). Pro-rata allocation applied.`);
        }
        const taxWeights = partnerTaxes
          .filter(pt => pt.taxDueCents > ZERO)
          .map(pt => ({ id: pt.partnerId, weight: Number(pt.taxDueCents) }));
        const alloc = allocateProRata(toDistribute, taxWeights);
        for (const [pid, amt] of alloc) {
          allocations.push({ partnerId: pid, amountCents: amt });
          distributionsByPartner.set(pid, (distributionsByPartner.get(pid) || ZERO) + amt);
        }
        remaining -= toDistribute;
        break;
      }
    }

    tierBreakdown.push({ tierOrder: tier.tierOrder, tierType: tier.tierType, allocations });
  }

  for (const p of partners) {
    const dist = distributionsByPartner.get(p.partnerId) || ZERO;
    state.cumulativeDistributionsByPartner.set(p.partnerId,
      (state.cumulativeDistributionsByPartner.get(p.partnerId) || ZERO) + dist);
    state.cumulativeProfitByPartner.set(p.partnerId,
      (state.cumulativeProfitByPartner.get(p.partnerId) || ZERO) + dist);
  }

  return { distributionsByPartner, tierBreakdown, remainingCashCents: remaining, warnings };
}
