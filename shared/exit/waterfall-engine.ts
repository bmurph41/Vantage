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

  const preferredReturnRequired = calculatePreferredReturn(
    input.totalCapitalContributed,
    input.preferredReturn,
    input.holdingPeriodYears,
    input.preferredReturnCompounding,
    input.prefReturnAccrualPeriod
  );

  const returnOfCapital = Math.min(remainingProceeds, input.totalCapitalContributed);
  if (returnOfCapital > 0) {
    cumulativeLp += returnOfCapital;
    distributions.push({
      tier: 'Return of Capital',
      lpAmount: returnOfCapital,
      gpAmount: 0,
      totalAmount: returnOfCapital,
      cumulativeLpAmount: cumulativeLp,
      cumulativeGpAmount: cumulativeGp,
    });
    remainingProceeds -= returnOfCapital;
  }

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
    const totalLpPaid = returnOfCapital + prefReturnPaid;
    const targetGpShare = totalLpPaid * (input.catchUpTarget / (1 - input.catchUpTarget));
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

  const lpMoic = input.totalCapitalContributed > 0 
    ? cumulativeLp / input.totalCapitalContributed 
    : 0;
  
  // GP contribution: configurable percentage, defaults to 2% if not specified
  const gpCommitmentPct = input.gpCommitmentPct ?? 0.02;
  const gpContribution = input.totalCapitalContributed * gpCommitmentPct;
  const gpMoic = gpContribution > 0
    ? cumulativeGp / gpContribution
    : 0;

  // European clawback: calculated on PROFIT basis (institutional standard)
  // GP clawback = GP distributions received - target GP share of profit
  let gpClawback = 0;
  if (input.structureType === 'european' && carriedInterestPaid > 0) {
    const totalProfit = input.totalProceeds - input.totalCapitalContributed;
    if (totalProfit > 0) {
      // GP's target share = carry % of profit + return of GP's own capital
      const targetGpShare = (totalProfit * input.carriedInterest) + (input.totalCapitalContributed * gpCommitmentPct);
      if (cumulativeGp > targetGpShare) {
        gpClawback = cumulativeGp - targetGpShare;
      }
    } else {
      // No profit = GP should only receive return of their own capital
      const gpCapitalReturn = Math.min(cumulativeGp, input.totalCapitalContributed * gpCommitmentPct);
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

  // LP contribution is (1 - gpCommitmentPct) of total capital; GP is the rest
  const lpContribution = input.totalCapitalContributed * (1 - gpCommitmentPct);

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
