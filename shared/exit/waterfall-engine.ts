import { calculateXIRR, type DatedCashFlow } from '../finance/xirr';

export type WaterfallStructureType = 'american' | 'european';
export type CompoundingType = 'annual' | 'quarterly' | 'continuous';
export type PrefReturnAccrualPeriod = 'annual' | 'quarterly' | 'monthly' | 'at_exit';

export interface WaterfallTier {
  name: string;
  hurdleRate: number;
  carriedInterest: number;
  lpSplit: number;
  gpSplit: number;
}

export interface WaterfallInput {
  totalProceeds: number;
  totalCapitalContributed: number;
  holdingPeriodYears: number;
  structureType: WaterfallStructureType;
  preferredReturn: number;
  preferredReturnCompounding: CompoundingType;
  catchUpPercentage: number;
  catchUpTarget: number;
  carriedInterest: number;
  lpSplit: number;
  gpSplit: number;
  customTiers?: WaterfallTier[];
  gpCommitmentPct?: number;
  prefReturnAccrualPeriod?: PrefReturnAccrualPeriod;
  investmentDate?: string; // ISO date for IRR calculation, defaults to today
}

export interface WaterfallDistribution {
  tier: string;
  lpAmount: number;
  gpAmount: number;
  totalAmount: number;
  cumulativeLpAmount: number;
  cumulativeGpAmount: number;
}

export interface WaterfallResult {
  distributions: WaterfallDistribution[];
  lpTotalDistribution: number;
  gpTotalDistribution: number;
  preferredReturnPaid: number;
  catchUpPaid: number;
  carriedInterestPaid: number;
  lpMoic: number;
  gpMoic: number;
  lpIrr: number | null;
  gpIrr: number | null;
  gpClawbackAmount: number;
}

export function calculatePreferredReturn(
  principal: number,
  rate: number,
  years: number,
  compounding: CompoundingType,
  accrualPeriod?: PrefReturnAccrualPeriod
): number {
  // If an accrual period is specified (not 'at_exit'), use it for compounding
  if (accrualPeriod && accrualPeriod !== 'at_exit') {
    switch (accrualPeriod) {
      case 'monthly': {
        const periods = years * 12;
        const periodicRate = rate / 12;
        return principal * Math.pow(1 + periodicRate, periods) - principal;
      }
      case 'quarterly': {
        const periods = years * 4;
        const periodicRate = rate / 4;
        return principal * Math.pow(1 + periodicRate, periods) - principal;
      }
      case 'annual':
        return principal * Math.pow(1 + rate, years) - principal;
    }
  }

  // Default: use the compounding type (backward-compatible 'at_exit' behavior)
  switch (compounding) {
    case 'annual':
      return principal * Math.pow(1 + rate, years) - principal;
    case 'quarterly':
      return principal * Math.pow(1 + rate / 4, years * 4) - principal;
    case 'continuous':
      return principal * Math.exp(rate * years) - principal;
    default:
      return principal * Math.pow(1 + rate, years) - principal;
  }
}

export function calculateWaterfall(input: WaterfallInput): WaterfallResult {
  const distributions: WaterfallDistribution[] = [];
  let remainingProceeds = input.totalProceeds;
  let cumulativeLp = 0;
  let cumulativeGp = 0;

  // ── LP / GP capital split ─────────────────────────────────────────────────
  // gpCommitmentPct defaults to 2% (institutional norm). LP capital is the
  // remainder. The pref accrues on LP capital ONLY — pref is LP's hurdle, not
  // a return on the GP's own commitment (industry standard).
  const gpCommitmentPct = input.gpCommitmentPct ?? 0.02;
  const lpCapital = input.totalCapitalContributed * (1 - gpCommitmentPct);
  const gpCapital = input.totalCapitalContributed * gpCommitmentPct;

  const preferredReturnRequired = calculatePreferredReturn(
    lpCapital,
    input.preferredReturn,
    input.holdingPeriodYears,
    input.preferredReturnCompounding,
    input.prefReturnAccrualPeriod
  );

  // ── Tier 1: Return of Capital — pari-passu split LP/GP by commitment ─────
  const totalRocAvailable = Math.min(remainingProceeds, input.totalCapitalContributed);
  if (totalRocAvailable > 0) {
    const lpRoc = Math.min(totalRocAvailable, lpCapital);
    const gpRoc = Math.max(0, Math.min(totalRocAvailable - lpRoc, gpCapital));
    cumulativeLp += lpRoc;
    cumulativeGp += gpRoc;
    distributions.push({
      tier: 'Return of Capital',
      lpAmount: lpRoc,
      gpAmount: gpRoc,
      totalAmount: lpRoc + gpRoc,
      cumulativeLpAmount: cumulativeLp,
      cumulativeGpAmount: cumulativeGp,
    });
    remainingProceeds -= (lpRoc + gpRoc);
  }
  const returnOfCapital = totalRocAvailable; // total ROC (used in summaries below)

  const prefReturnPaid = Math.min(remainingProceeds, preferredReturnRequired);
  if (prefReturnPaid > 0) {
    cumulativeLp += prefReturnPaid;
    distributions.push({
      tier: 'Preferred Return',
      lpAmount: prefReturnPaid,
      gpAmount: 0,
      totalAmount: prefReturnPaid,
      cumulativeLpAmount: cumulativeLp,
      cumulativeGpAmount: cumulativeGp,
    });
    remainingProceeds -= prefReturnPaid;
  }

  let catchUpPaid = 0;
  if (remainingProceeds > 0 && input.catchUpPercentage > 0) {
    // Catch-up base is the LP profit paid (preferred return) — NOT including
    // return of capital, which is principal, not profit. After catch-up the
    // GP holds catchUpTarget share of profits distributed so far.
    //   GP target = prefReturnPaid * (catchUpTarget / (1 - catchUpTarget))
    const targetGpShare = prefReturnPaid * (input.catchUpTarget / (1 - input.catchUpTarget));
    const catchUpNeeded = targetGpShare;
    catchUpPaid = Math.min(remainingProceeds * input.catchUpPercentage, catchUpNeeded);
    
    if (catchUpPaid > 0) {
      cumulativeGp += catchUpPaid;
      distributions.push({
        tier: 'GP Catch-Up',
        lpAmount: 0,
        gpAmount: catchUpPaid,
        totalAmount: catchUpPaid,
        cumulativeLpAmount: cumulativeLp,
        cumulativeGpAmount: cumulativeGp,
      });
      remainingProceeds -= catchUpPaid;
    }
  }

  let carriedInterestPaid = 0;
  if (remainingProceeds > 0) {
    if (input.customTiers && input.customTiers.length > 0) {
      for (const tier of input.customTiers) {
        if (remainingProceeds <= 0) break;
        
        // Round LP share, then derive GP as remainder to prevent floating-point drift
        const lpShare = Math.round(remainingProceeds * tier.lpSplit * 100) / 100;
        const gpShare = Math.round((remainingProceeds - lpShare) * 100) / 100;
        
        cumulativeLp += lpShare;
        cumulativeGp += gpShare;
        carriedInterestPaid += gpShare;
        
        distributions.push({
          tier: tier.name,
          lpAmount: lpShare,
          gpAmount: gpShare,
          totalAmount: remainingProceeds,
          cumulativeLpAmount: cumulativeLp,
          cumulativeGpAmount: cumulativeGp,
        });
        
        remainingProceeds = 0;
      }
    } else {
      const lpShare = remainingProceeds * input.lpSplit;
      const gpShare = remainingProceeds * input.gpSplit;
      
      cumulativeLp += lpShare;
      cumulativeGp += gpShare;
      carriedInterestPaid = gpShare;
      
      distributions.push({
        tier: 'Carried Interest Split',
        lpAmount: lpShare,
        gpAmount: gpShare,
        totalAmount: remainingProceeds,
        cumulativeLpAmount: cumulativeLp,
        cumulativeGpAmount: cumulativeGp,
      });
    }
  }

  // MOIC denominators: LP MOIC uses LP capital; GP MOIC uses GP capital.
  // (gpCommitmentPct, lpCapital, gpCapital were resolved above before pref accrual.)
  const lpMoic = lpCapital > 0
    ? cumulativeLp / lpCapital
    : 0;

  const gpContribution = gpCapital;
  const gpMoic = gpContribution > 0
    ? cumulativeGp / gpContribution
    : 0;

  // European clawback: calculated on PROFIT basis (institutional standard)
  // GP clawback = GP distributions received - target GP share of (profit + own capital)
  let gpClawback = 0;
  if (input.structureType === 'european' && carriedInterestPaid > 0) {
    const totalProfit = input.totalProceeds - input.totalCapitalContributed;
    if (totalProfit > 0) {
      // Target = GP's share of profit (carry %) + return of GP's own capital
      const targetGpShare = (totalProfit * input.carriedInterest) + gpCapital;
      if (cumulativeGp > targetGpShare) {
        gpClawback = cumulativeGp - targetGpShare;
      }
    } else {
      // No profit = GP should only receive return of their own capital
      const gpCapitalReturn = Math.min(cumulativeGp, gpCapital);
      if (cumulativeGp > gpCapitalReturn) {
        gpClawback = cumulativeGp - gpCapitalReturn;
      }
    }
  }

  // --- LP/GP IRR Calculations ---
  // Build dated cash flow series for XIRR
  const investmentDate = input.investmentDate ?? new Date().toISOString().split('T')[0];
  const investmentDateMs = new Date(investmentDate + 'T00:00:00Z').getTime();
  const exitDateMs = investmentDateMs + input.holdingPeriodYears * 365.25 * 86400000;
  const exitDate = new Date(exitDateMs).toISOString().split('T')[0];

  const lpContribution = lpCapital;

  // LP cash flows: negative outflow at investment, positive distributions at exit
  const lpCashFlows: DatedCashFlow[] = [
    { date: investmentDate, amount: -lpContribution },
    { date: exitDate, amount: cumulativeLp },
  ];

  // GP cash flows: negative outflow at investment, positive distributions at exit
  const gpCashFlows: DatedCashFlow[] = [
    { date: investmentDate, amount: -gpContribution },
    { date: exitDate, amount: cumulativeGp },
  ];

  let lpIrr: number | null = null;
  let gpIrr: number | null = null;

  if (lpContribution > 0 && cumulativeLp > 0 && input.holdingPeriodYears > 0) {
    const lpResult = calculateXIRR(lpCashFlows);
    lpIrr = lpResult.converged && isFinite(lpResult.irr) ? lpResult.irr : null;
  }

  if (gpContribution > 0 && cumulativeGp > 0 && input.holdingPeriodYears > 0) {
    const gpResult = calculateXIRR(gpCashFlows);
    gpIrr = gpResult.converged && isFinite(gpResult.irr) ? gpResult.irr : null;
  }

  return {
    distributions,
    lpTotalDistribution: cumulativeLp,
    gpTotalDistribution: cumulativeGp,
    preferredReturnPaid: prefReturnPaid,
    catchUpPaid,
    carriedInterestPaid,
    lpMoic,
    gpMoic,
    lpIrr,
    gpIrr,
    gpClawbackAmount: gpClawback,
  };
}

export function calculateInvestorWaterfall(
  waterfallResult: WaterfallResult,
  investorCommitment: number,
  totalCommitment: number
): {
  investorShare: number;
  returnOfCapital: number;
  preferredReturn: number;
  profitShare: number;
  totalDistribution: number;
  moic: number;
} {
  const ownershipPercent = totalCommitment > 0 ? investorCommitment / totalCommitment : 0;
  
  const returnOfCapital = waterfallResult.distributions
    .filter(d => d.tier === 'Return of Capital')
    .reduce((sum, d) => sum + d.lpAmount * ownershipPercent, 0);
  
  const preferredReturn = waterfallResult.distributions
    .filter(d => d.tier === 'Preferred Return')
    .reduce((sum, d) => sum + d.lpAmount * ownershipPercent, 0);
  
  const profitShare = waterfallResult.distributions
    .filter(d => d.tier === 'Carried Interest Split' || d.tier.includes('Tier'))
    .reduce((sum, d) => sum + d.lpAmount * ownershipPercent, 0);
  
  const totalDistribution = returnOfCapital + preferredReturn + profitShare;
  const moic = investorCommitment > 0 ? totalDistribution / investorCommitment : 0;
  
  return {
    investorShare: ownershipPercent,
    returnOfCapital,
    preferredReturn,
    profitShare,
    totalDistribution,
    moic,
  };
}
