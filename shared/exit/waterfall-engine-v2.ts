export interface WaterfallV2Input {
  capitalCalls: DatedCapitalEvent[];
  distributions: DatedCapitalEvent[];
  tiers: WaterfallTierV2[];
  preferredReturn: number;
  preferredReturnCompounding: 'annual' | 'quarterly' | 'continuous';
  catchUpPercent: number;
  catchUpTarget: number;
  structureType: 'deal_by_deal' | 'whole_fund';
  clawbackEnabled: boolean;
  gpCommitmentPercent: number;
}

export interface DatedCapitalEvent {
  date: string;
  amount: number;
  investor: string;
  description?: string;
}

export interface WaterfallTierV2 {
  name: string;
  hurdleIrr: number;
  lpSplit: number;
  gpSplit: number;
}

export interface WaterfallV2Distribution {
  tier: string;
  lpAmount: number;
  gpAmount: number;
  totalAmount: number;
  cumulativeLp: number;
  cumulativeGp: number;
  hurdleIrr: number;
  achieved: boolean;
}

export interface InvestorAllocation {
  investor: string;
  capitalContributed: number;
  capitalContributedPercent: number;
  preferredReturn: number;
  returnOfCapital: number;
  profitShare: number;
  totalDistribution: number;
  moic: number;
  irr: number | null;
}

export interface ClawbackAnalysis {
  clawbackRequired: boolean;
  clawbackAmount: number;
  gpOverDistributed: number;
  targetGpShare: number;
  actualGpShare: number;
  gpNetAfterClawback: number;
}

export interface FundMetrics {
  grossMoic: number;
  netMoic: number;
  dpi: number;
  tvpi: number;
  rvpi: number;
  lpIrr: number | null;
  gpIrr: number | null;
  paidInCapital: number;
  distributedCapital: number;
  residualValue: number;
  jCurveBreakevenYear: number | null;
}

export interface WaterfallV2Result {
  distributions: WaterfallV2Distribution[];
  investorAllocations: InvestorAllocation[];
  clawback: ClawbackAnalysis;
  fundMetrics: FundMetrics;
  lpTotalDistribution: number;
  gpTotalDistribution: number;
  warnings: WaterfallV2Warning[];
}

export interface WaterfallV2Warning {
  code: string;
  severity: 'info' | 'warning' | 'error';
  message: string;
}

export function calculateWaterfallV2(input: WaterfallV2Input): WaterfallV2Result {
  const warnings: WaterfallV2Warning[] = [];

  const totalCapitalCalled = input.capitalCalls.reduce((sum, c) => sum + c.amount, 0);
  const totalDistributions = input.distributions.reduce((sum, d) => sum + d.amount, 0);

  const gpCapital = totalCapitalCalled * input.gpCommitmentPercent;
  const lpCapital = totalCapitalCalled - gpCapital;

  const holdingYears = calculateHoldingYears(input.capitalCalls, input.distributions);

  const prefReturnAmount = computePreferredReturn(
    lpCapital,
    input.preferredReturn,
    holdingYears,
    input.preferredReturnCompounding
  );

  let remainingProceeds = totalDistributions;
  let cumulativeLp = 0;
  let cumulativeGp = 0;
  const distResults: WaterfallV2Distribution[] = [];

  const returnOfCapitalLp = Math.min(remainingProceeds, lpCapital);
  if (returnOfCapitalLp > 0) {
    cumulativeLp += returnOfCapitalLp;
    distResults.push({
      tier: 'Return of LP Capital',
      lpAmount: returnOfCapitalLp,
      gpAmount: 0,
      totalAmount: returnOfCapitalLp,
      cumulativeLp,
      cumulativeGp,
      hurdleIrr: 0,
      achieved: true,
    });
    remainingProceeds -= returnOfCapitalLp;
  }

  const returnOfCapitalGp = Math.min(remainingProceeds, gpCapital);
  if (returnOfCapitalGp > 0) {
    cumulativeGp += returnOfCapitalGp;
    distResults.push({
      tier: 'Return of GP Capital',
      lpAmount: 0,
      gpAmount: returnOfCapitalGp,
      totalAmount: returnOfCapitalGp,
      cumulativeLp,
      cumulativeGp,
      hurdleIrr: 0,
      achieved: true,
    });
    remainingProceeds -= returnOfCapitalGp;
  }

  const prefReturnPaid = Math.min(remainingProceeds, prefReturnAmount);
  if (prefReturnPaid > 0) {
    cumulativeLp += prefReturnPaid;
    distResults.push({
      tier: 'Preferred Return',
      lpAmount: prefReturnPaid,
      gpAmount: 0,
      totalAmount: prefReturnPaid,
      cumulativeLp,
      cumulativeGp,
      hurdleIrr: input.preferredReturn,
      achieved: prefReturnPaid >= prefReturnAmount,
    });
    remainingProceeds -= prefReturnPaid;
  }

  if (remainingProceeds > 0 && input.catchUpPercent > 0) {
    const totalLpReceived = cumulativeLp;
    const targetGpPercent = input.catchUpTarget;
    const targetGpTotal = totalLpReceived * (targetGpPercent / (1 - targetGpPercent));
    const catchUpNeeded = Math.max(0, targetGpTotal - cumulativeGp);
    const catchUpDistribution = Math.min(remainingProceeds, catchUpNeeded);

    const gpCatchUp = catchUpDistribution * input.catchUpPercent;
    const lpCatchUp = catchUpDistribution - gpCatchUp;

    if (catchUpDistribution > 0) {
      cumulativeLp += lpCatchUp;
      cumulativeGp += gpCatchUp;
      distResults.push({
        tier: 'GP Catch-Up',
        lpAmount: lpCatchUp,
        gpAmount: gpCatchUp,
        totalAmount: catchUpDistribution,
        cumulativeLp,
        cumulativeGp,
        hurdleIrr: input.preferredReturn,
        achieved: gpCatchUp >= catchUpNeeded,
      });
      remainingProceeds -= catchUpDistribution;
    }
  }

  if (remainingProceeds > 0 && input.tiers.length > 0) {
    for (let i = 0; i < input.tiers.length; i++) {
      if (remainingProceeds <= 0) break;

      const tier = input.tiers[i];
      const nextTier = i < input.tiers.length - 1 ? input.tiers[i + 1] : null;

      let tierAmount = remainingProceeds;
      if (nextTier) {
        const irrDiff = nextTier.hurdleIrr - tier.hurdleIrr;
        const estimatedProceedsForTier = totalCapitalCalled * irrDiff * holdingYears;
        tierAmount = Math.min(remainingProceeds, estimatedProceedsForTier);
      }

      const lpShare = tierAmount * tier.lpSplit;
      const gpShare = tierAmount * tier.gpSplit;

      cumulativeLp += lpShare;
      cumulativeGp += gpShare;

      distResults.push({
        tier: tier.name || `Tier ${i + 1}`,
        lpAmount: lpShare,
        gpAmount: gpShare,
        totalAmount: tierAmount,
        cumulativeLp,
        cumulativeGp,
        hurdleIrr: tier.hurdleIrr,
        achieved: true,
      });

      remainingProceeds -= tierAmount;
    }
  } else if (remainingProceeds > 0) {
    const lpSplit = 0.80;
    const gpSplit = 0.20;
    const lpShare = remainingProceeds * lpSplit;
    const gpShare = remainingProceeds * gpSplit;
    cumulativeLp += lpShare;
    cumulativeGp += gpShare;

    distResults.push({
      tier: 'Residual Split (80/20)',
      lpAmount: lpShare,
      gpAmount: gpShare,
      totalAmount: remainingProceeds,
      cumulativeLp,
      cumulativeGp,
      hurdleIrr: 0,
      achieved: true,
    });
  }

  const investorMap = new Map<string, { contributed: number; distributed: number }>();
  for (const call of input.capitalCalls) {
    const inv = investorMap.get(call.investor) || { contributed: 0, distributed: 0 };
    inv.contributed += call.amount;
    investorMap.set(call.investor, inv);
  }

  const investorAllocations: InvestorAllocation[] = [];
  for (const [investor, data] of investorMap) {
    const pct = totalCapitalCalled > 0 ? data.contributed / totalCapitalCalled : 0;
    const isGp = investor.toLowerCase().includes('gp') || investor.toLowerCase().includes('general');

    const returnOfCapital = isGp ? (returnOfCapitalGp * pct) : (returnOfCapitalLp * pct);
    const prefReturn = isGp ? 0 : (prefReturnPaid * pct);
    const profitShare = cumulativeLp > 0
      ? (isGp ? cumulativeGp * pct : cumulativeLp * pct) - returnOfCapital - prefReturn
      : 0;

    const totalDistribution = returnOfCapital + prefReturn + Math.max(0, profitShare);
    const moic = data.contributed > 0 ? totalDistribution / data.contributed : 0;

    investorAllocations.push({
      investor,
      capitalContributed: data.contributed,
      capitalContributedPercent: pct,
      preferredReturn: prefReturn,
      returnOfCapital,
      profitShare: Math.max(0, profitShare),
      totalDistribution,
      moic,
      irr: null,
    });
  }

  const clawback = analyzeClawback(input, cumulativeLp, cumulativeGp, totalCapitalCalled, lpCapital, gpCapital);

  const paidInCapital = totalCapitalCalled;
  const distributedCapital = totalDistributions;
  const residualValue = 0;

  const grossMoic = paidInCapital > 0 ? distributedCapital / paidInCapital : 0;
  const netMoic = grossMoic;
  const dpi = paidInCapital > 0 ? distributedCapital / paidInCapital : 0;
  const tvpi = paidInCapital > 0 ? (distributedCapital + residualValue) / paidInCapital : 0;
  const rvpi = paidInCapital > 0 ? residualValue / paidInCapital : 0;

  const lpCashFlows = buildLpCashFlows(input.capitalCalls, input.distributions, cumulativeLp, totalDistributions, lpCapital, totalCapitalCalled);
  const lpIrr = dateBasedXIRR(lpCashFlows);

  const gpCashFlows = buildGpCashFlows(input.capitalCalls, input.distributions, cumulativeGp, totalDistributions, gpCapital, totalCapitalCalled);
  const gpIrr = dateBasedXIRR(gpCashFlows);

  let jCurveBreakevenYear: number | null = null;
  {
    let cumNet = 0;
    const sortedEvents = [
      ...input.capitalCalls.map(c => ({ date: c.date, amount: -c.amount })),
      ...input.distributions.map(d => ({ date: d.date, amount: d.amount })),
    ].sort((a, b) => a.date.localeCompare(b.date));

    const firstDate = sortedEvents[0]?.date || '';
    for (const event of sortedEvents) {
      cumNet += event.amount;
      if (cumNet > 0 && firstDate) {
        const yearsFromStart = (new Date(event.date).getTime() - new Date(firstDate).getTime()) / (365.25 * 24 * 60 * 60 * 1000);
        jCurveBreakevenYear = Math.ceil(yearsFromStart);
        break;
      }
    }
  }

  const fundMetrics: FundMetrics = {
    grossMoic,
    netMoic,
    dpi,
    tvpi,
    rvpi,
    lpIrr,
    gpIrr,
    paidInCapital,
    distributedCapital,
    residualValue,
    jCurveBreakevenYear,
  };

  if (clawback.clawbackRequired) {
    warnings.push({
      code: 'CLAWBACK_TRIGGERED',
      severity: 'warning',
      message: `GP clawback of ${formatCurrency(clawback.clawbackAmount)} may be required.`,
    });
  }

  if (dpi < 1.0) {
    warnings.push({
      code: 'BELOW_RETURN_OF_CAPITAL',
      severity: 'info',
      message: `DPI of ${dpi.toFixed(2)}x indicates capital has not been fully returned.`,
    });
  }

  if (input.gpCommitmentPercent < 0.01) {
    warnings.push({
      code: 'LOW_GP_COMMITMENT',
      severity: 'warning',
      message: 'GP commitment is below 1%. Consider alignment of interest.',
    });
  }

  return {
    distributions: distResults,
    investorAllocations,
    clawback,
    fundMetrics,
    lpTotalDistribution: cumulativeLp,
    gpTotalDistribution: cumulativeGp,
    warnings,
  };
}

function computePreferredReturn(
  capital: number,
  rate: number,
  years: number,
  compounding: 'annual' | 'quarterly' | 'continuous'
): number {
  switch (compounding) {
    case 'quarterly':
      return capital * Math.pow(1 + rate / 4, years * 4) - capital;
    case 'continuous':
      return capital * Math.exp(rate * years) - capital;
    default:
      return capital * Math.pow(1 + rate, years) - capital;
  }
}

function calculateHoldingYears(
  calls: DatedCapitalEvent[],
  distributions: DatedCapitalEvent[]
): number {
  const allDates = [...calls, ...distributions].map(e => new Date(e.date).getTime());
  if (allDates.length < 2) return 1;
  const earliest = Math.min(...allDates);
  const latest = Math.max(...allDates);
  return Math.max(1, (latest - earliest) / (365.25 * 24 * 60 * 60 * 1000));
}

function analyzeClawback(
  input: WaterfallV2Input,
  cumulativeLp: number,
  cumulativeGp: number,
  totalCapital: number,
  lpCapital: number,
  gpCapital: number
): ClawbackAnalysis {
  if (!input.clawbackEnabled) {
    return {
      clawbackRequired: false,
      clawbackAmount: 0,
      gpOverDistributed: 0,
      targetGpShare: 0,
      actualGpShare: 0,
      gpNetAfterClawback: cumulativeGp,
    };
  }

  const totalDistributed = cumulativeLp + cumulativeGp;
  const lpReturnOfCapital = Math.min(cumulativeLp, lpCapital);
  const lpProfit = cumulativeLp - lpReturnOfCapital;

  const targetCarry = input.tiers.length > 0 ? input.tiers[0].gpSplit : 0.20;
  const totalProfit = totalDistributed - totalCapital;

  if (totalProfit <= 0) {
    const gpOverDistributed = cumulativeGp - gpCapital;
    return {
      clawbackRequired: gpOverDistributed > 0,
      clawbackAmount: Math.max(0, gpOverDistributed),
      gpOverDistributed: Math.max(0, gpOverDistributed),
      targetGpShare: 0,
      actualGpShare: cumulativeGp,
      gpNetAfterClawback: gpCapital,
    };
  }

  const targetGpShare = totalProfit * targetCarry + gpCapital;
  const actualGpShare = cumulativeGp;
  const gpOverDistributed = Math.max(0, actualGpShare - targetGpShare);

  return {
    clawbackRequired: gpOverDistributed > 0,
    clawbackAmount: gpOverDistributed,
    gpOverDistributed,
    targetGpShare,
    actualGpShare,
    gpNetAfterClawback: actualGpShare - gpOverDistributed,
  };
}

function buildLpCashFlows(
  calls: DatedCapitalEvent[],
  distributions: DatedCapitalEvent[],
  lpTotalDist: number,
  totalDist: number,
  lpCapital: number,
  totalCapital: number
): { date: Date; amount: number }[] {
  const lpRatio = totalCapital > 0 ? lpCapital / totalCapital : 1;
  const distRatio = totalDist > 0 ? lpTotalDist / totalDist : lpRatio;

  const cashFlows: { date: Date; amount: number }[] = [];

  for (const call of calls) {
    cashFlows.push({
      date: new Date(call.date),
      amount: -call.amount * lpRatio,
    });
  }

  for (const dist of distributions) {
    cashFlows.push({
      date: new Date(dist.date),
      amount: dist.amount * distRatio,
    });
  }

  return cashFlows.sort((a, b) => a.date.getTime() - b.date.getTime());
}

function buildGpCashFlows(
  calls: DatedCapitalEvent[],
  distributions: DatedCapitalEvent[],
  gpTotalDist: number,
  totalDist: number,
  gpCapital: number,
  totalCapital: number
): { date: Date; amount: number }[] {
  const gpRatio = totalCapital > 0 ? gpCapital / totalCapital : 0;
  const distRatio = totalDist > 0 ? gpTotalDist / totalDist : gpRatio;

  const cashFlows: { date: Date; amount: number }[] = [];

  for (const call of calls) {
    cashFlows.push({
      date: new Date(call.date),
      amount: -call.amount * gpRatio,
    });
  }

  for (const dist of distributions) {
    cashFlows.push({
      date: new Date(dist.date),
      amount: dist.amount * distRatio,
    });
  }

  return cashFlows.sort((a, b) => a.date.getTime() - b.date.getTime());
}

function dateBasedXIRR(
  cashFlows: { date: Date; amount: number }[],
  guess: number = 0.1,
  maxIter: number = 1000,
  tol: number = 1e-7
): number | null {
  if (cashFlows.length < 2) return null;
  const hasPos = cashFlows.some(cf => cf.amount > 0);
  const hasNeg = cashFlows.some(cf => cf.amount < 0);
  if (!hasPos || !hasNeg) return null;

  const sorted = [...cashFlows].sort((a, b) => a.date.getTime() - b.date.getTime());
  const startDate = sorted[0].date;

  let rate = guess;
  for (let i = 0; i < maxIter; i++) {
    let npv = 0;
    let dnpv = 0;
    for (const cf of sorted) {
      const years = (cf.date.getTime() - startDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
      const disc = Math.pow(1 + rate, years);
      npv += cf.amount / disc;
      dnpv -= (years * cf.amount) / (disc * (1 + rate));
    }
    if (Math.abs(npv) < tol) return rate;
    if (Math.abs(dnpv) < tol) return null;
    const newRate = rate - npv / dnpv;
    if (Math.abs(newRate - rate) < tol) return newRate;
    rate = newRate;
    if (rate < -0.99 || rate > 100) return null;
  }
  return null;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}
