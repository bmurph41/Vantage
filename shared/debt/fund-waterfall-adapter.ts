/**
 * Fund Waterfall Adapter — shared/debt/fund-waterfall-adapter.ts
 */
import type { WaterfallV2Input, WaterfallTierV2, DatedCapitalEvent } from '../exit/waterfall-engine-v2';

export interface FundDealCashflows {
  equityInvested: number;
  investmentDate: string;
  annualCashFlows: Array<{ year: number; date: string; amount: number }>;
  exitProceeds: { date: string; grossSalePrice: number; loanPayoff: number; sellingFees: number; prepayPenalty: number; netProceeds: number };
}

export interface FundWaterfallConfig {
  preferredReturn: number;
  preferredReturnCompounding: 'annual' | 'quarterly' | 'continuous';
  catchUpPercent: number;
  catchUpTarget: number;
  structureType: 'deal_by_deal' | 'whole_fund';
  clawbackEnabled: boolean;
  promoteTiers: Array<{ name: string; irrHurdle: number; gpSplit: number; lpSplit: number }>;
  gpCommitmentPercent: number;
}

export interface FundWaterfallResult {
  totalEquity: number; gpEquity: number; lpEquity: number;
  annualDistributions: Array<{ year: number; totalCashFlow: number; gpShare: number; lpShare: number; tier: string; cumulativeGp: number; cumulativeLp: number }>;
  exitDistribution: { totalProceeds: number; gpShare: number; lpShare: number; tier: string };
  metrics: { lpIrr: number | null; gpIrr: number | null; lpEquityMultiple: number; gpEquityMultiple: number; lpTotalDistributed: number; gpTotalDistributed: number; totalPromote: number };
}

export function buildWaterfallInput(cashflows: FundDealCashflows, config: FundWaterfallConfig): WaterfallV2Input {
  const gpEq = cashflows.equityInvested * config.gpCommitmentPercent;
  const lpEq = cashflows.equityInvested - gpEq;

  const capitalCalls: DatedCapitalEvent[] = [
    { date: cashflows.investmentDate, amount: gpEq, investor: 'GP', description: 'Initial equity' },
    { date: cashflows.investmentDate, amount: lpEq, investor: 'LP', description: 'Initial equity' },
  ];

  const distributions: DatedCapitalEvent[] = [];
  for (const cf of cashflows.annualCashFlows) {
    if (cf.amount > 0) distributions.push({ date: cf.date, amount: cf.amount, investor: 'FUND', description: `Year ${cf.year} distribution` });
  }
  if (cashflows.exitProceeds.netProceeds > 0) {
    distributions.push({ date: cashflows.exitProceeds.date, amount: cashflows.exitProceeds.netProceeds, investor: 'FUND', description: 'Exit proceeds' });
  }

  const tiers: WaterfallTierV2[] = config.promoteTiers.map(t => ({ name: t.name, hurdleIrr: t.irrHurdle, lpSplit: t.lpSplit, gpSplit: t.gpSplit }));

  return { capitalCalls, distributions, tiers, preferredReturn: config.preferredReturn, preferredReturnCompounding: config.preferredReturnCompounding, catchUpPercent: config.catchUpPercent, catchUpTarget: config.catchUpTarget, structureType: config.structureType, clawbackEnabled: config.clawbackEnabled, gpCommitmentPercent: config.gpCommitmentPercent };
}

export function computeSimpleWaterfall(cashflows: FundDealCashflows, config: FundWaterfallConfig): FundWaterfallResult {
  const gpPct = config.gpCommitmentPercent;
  const lpPct = 1 - gpPct;
  const totalEquity = cashflows.equityInvested;
  const gpEquity = totalEquity * gpPct;
  const lpEquity = totalEquity * lpPct;

  const allCF = [...cashflows.annualCashFlows.map(cf => ({ ...cf, isExit: false })),
    { year: cashflows.annualCashFlows.length + 1, date: cashflows.exitProceeds.date, amount: cashflows.exitProceeds.netProceeds, isExit: true }];
  const totalDist = allCF.reduce((s, cf) => s + Math.max(cf.amount, 0), 0);

  let remaining = totalDist;
  let lpTotal = 0, gpTotal = 0;

  // Step 1: Return of capital
  const capReturn = Math.min(remaining, totalEquity);
  lpTotal += capReturn * lpPct; gpTotal += capReturn * gpPct; remaining -= capReturn;

  // Step 2: Preferred return
  const holdYears = cashflows.annualCashFlows.length || 1;
  const prefAmt = Math.min(remaining, totalEquity * config.preferredReturn * holdYears);
  lpTotal += prefAmt * lpPct; gpTotal += prefAmt * gpPct; remaining -= prefAmt;

  // Step 3: GP catch-up
  const gpTarget = (lpTotal + gpTotal + remaining) * config.catchUpTarget;
  const gpNeeds = Math.max(0, gpTarget - gpTotal);
  const catchUp = Math.min(remaining, gpNeeds);
  gpTotal += catchUp * config.catchUpPercent;
  lpTotal += catchUp * (1 - config.catchUpPercent);
  remaining -= catchUp;

  // Step 4: Promote tier
  let tier = 'Pro-rata';
  if (remaining > 0 && config.promoteTiers.length > 0) {
    const t = config.promoteTiers[config.promoteTiers.length - 1];
    tier = t.name || `${(t.gpSplit*100).toFixed(0)}/${(t.lpSplit*100).toFixed(0)}`;
    gpTotal += remaining * t.gpSplit; lpTotal += remaining * t.lpSplit; remaining = 0;
  }

  const annualDistributions = cashflows.annualCashFlows.map(cf => {
    const total = Math.max(cf.amount, 0);
    return { year: cf.year, totalCashFlow: total, gpShare: Math.round(total*gpPct*100)/100, lpShare: Math.round(total*lpPct*100)/100, tier: 'Pro-rata', cumulativeGp: 0, cumulativeLp: 0 };
  });
  let cg = 0, cl = 0;
  for (const d of annualDistributions) { cg += d.gpShare; cl += d.lpShare; d.cumulativeGp = Math.round(cg*100)/100; d.cumulativeLp = Math.round(cl*100)/100; }

  const r2 = (v: number) => Math.round(v * 100) / 100;
  const gpProRata = totalDist * gpPct;

  return {
    totalEquity: r2(totalEquity), gpEquity: r2(gpEquity), lpEquity: r2(lpEquity),
    annualDistributions,
    exitDistribution: { totalProceeds: r2(cashflows.exitProceeds.netProceeds), gpShare: r2(gpTotal), lpShare: r2(lpTotal), tier },
    metrics: {
      lpIrr: null, gpIrr: null,
      lpEquityMultiple: lpEquity > 0 ? r2(lpTotal / lpEquity) : 0,
      gpEquityMultiple: gpEquity > 0 ? r2(gpTotal / gpEquity) : 0,
      lpTotalDistributed: r2(lpTotal), gpTotalDistributed: r2(gpTotal),
      totalPromote: Math.max(0, r2(gpTotal - gpProRata)),
    },
  };
}
