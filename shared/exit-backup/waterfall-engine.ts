export type WaterfallStructureType = 'american' | 'european';
export type CompoundingType = 'annual' | 'quarterly' | 'continuous';

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
  compounding: CompoundingType
): number {
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
    input.preferredReturnCompounding
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
        
        const lpShare = remainingProceeds * tier.lpSplit;
        const gpShare = remainingProceeds * tier.gpSplit;
        
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
  
  const gpContribution = input.totalCapitalContributed * 0.02;
  const gpMoic = gpContribution > 0 
    ? cumulativeGp / gpContribution 
    : 0;

  let gpClawback = 0;
  if (input.structureType === 'european' && carriedInterestPaid > 0) {
    const actualCarryRate = cumulativeGp / input.totalProceeds;
    if (actualCarryRate > input.carriedInterest) {
      gpClawback = (actualCarryRate - input.carriedInterest) * input.totalProceeds;
    }
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
    lpIrr: null,
    gpIrr: null,
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
