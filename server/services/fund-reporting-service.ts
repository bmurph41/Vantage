/**
 * Fund Reporting Service — PME, Return Attribution, J-Curve, Vintage Cohort
 *
 * Institutional-grade fund analytics for LP/GP reporting.
 */

import Decimal from 'decimal.js';
import { db } from '../db';
import {
  funds, fundInvestors, fundDealAllocations, fundCapitalMovements,
  fundCashFlows, modelingProjects,
} from '@shared/schema';
import { eq, and, desc, asc, sql, gte, lte, inArray } from 'drizzle-orm';

function dn(value: any, fallback = '0'): number {
  if (value == null) return new Decimal(fallback).toNumber();
  try { return new Decimal(value.toString()).toNumber(); } catch { return new Decimal(fallback).toNumber(); }
}

// ============================================================================
// PME — Public Market Equivalent (Kaplan-Schoar)
// ============================================================================

export interface PMEResult {
  fundId: string;
  fundName: string;
  benchmarkIndex: string;
  ksPme: number;              // Kaplan-Schoar PME ratio (>1 = outperformed)
  directAlpha: number;        // Annualized alpha vs benchmark
  fundIrr: number | null;
  benchmarkReturn: number;    // Annualized benchmark return over same period
  cashFlows: {
    date: string;
    fundCashFlow: number;
    benchmarkIndexValue: number;
    fvContribution: number;   // FV of contribution at benchmark return
    fvDistribution: number;   // FV of distribution at benchmark return
  }[];
  summary: {
    totalContributions: number;
    totalDistributions: number;
    nav: number;
    fvContributions: number;  // Sum of FV'd contributions
    fvDistributions: number;  // Sum of FV'd distributions + NAV
  };
}

// S&P 500 historical annualized returns by year (approximate)
const SP500_ANNUAL_RETURNS: Record<number, number> = {
  2015: 0.0138, 2016: 0.1196, 2017: 0.2183, 2018: -0.0438,
  2019: 0.3149, 2020: 0.1840, 2021: 0.2871, 2022: -0.1811,
  2023: 0.2629, 2024: 0.2502, 2025: 0.0850, 2026: 0.0600,
};

function getAnnualizedBenchmarkReturn(startYear: number, endYear: number): number {
  let cumulative = 1;
  for (let y = startYear; y <= endYear; y++) {
    cumulative *= (1 + (SP500_ANNUAL_RETURNS[y] || 0.08));
  }
  const years = endYear - startYear + 1;
  return Math.pow(cumulative, 1 / years) - 1;
}

function getBenchmarkGrowthFactor(fromDate: Date, toDate: Date): number {
  const startYear = fromDate.getFullYear();
  const endYear = toDate.getFullYear();
  const annualReturn = getAnnualizedBenchmarkReturn(startYear, endYear);
  const years = (toDate.getTime() - fromDate.getTime()) / (365.25 * 24 * 3600 * 1000);
  return Math.pow(1 + annualReturn, years);
}

export async function calculatePME(orgId: string, fundId: string): Promise<PMEResult> {
  // Get fund
  const [fund] = await db.select().from(funds)
    .where(and(eq(funds.id, fundId), eq(funds.orgId, orgId))).limit(1);
  if (!fund) throw new Error('Fund not found');

  // Get cash flows ordered by date
  const cashFlows = await db.select().from(fundCashFlows)
    .where(and(eq(fundCashFlows.fundId, fundId), eq(fundCashFlows.orgId, orgId)))
    .orderBy(asc(fundCashFlows.flowDate));

  const now = new Date();
  const nav = dn(fund.calledCapital) - dn(fund.distributedCapital);  // Simplified NAV

  if (cashFlows.length === 0) {
    return {
      fundId, fundName: fund.name, benchmarkIndex: 'S&P 500',
      ksPme: 1.0, directAlpha: 0, fundIrr: null,
      benchmarkReturn: 0.08,
      cashFlows: [],
      summary: {
        totalContributions: 0, totalDistributions: 0, nav,
        fvContributions: 0, fvDistributions: 0,
      },
    };
  }

  let totalFvContributions = 0;
  let totalFvDistributions = 0;
  let totalContributions = 0;
  let totalDistributions = 0;

  const cfDetails = cashFlows.map(cf => {
    const cfDate = new Date(cf.flowDate!);
    const amount = dn(cf.grossAmount);
    const growthFactor = getBenchmarkGrowthFactor(cfDate, now);
    const isContribution = cf.flowType === 'capital_call' || cf.flowType === 'contribution' || amount < 0;

    if (isContribution) {
      const contrib = Math.abs(amount);
      totalContributions += contrib;
      totalFvContributions += contrib * growthFactor;
    } else {
      totalDistributions += amount;
      totalFvDistributions += amount * growthFactor;
    }

    return {
      date: cfDate.toISOString().split('T')[0],
      fundCashFlow: amount,
      benchmarkIndexValue: growthFactor,
      fvContribution: isContribution ? Math.abs(amount) * growthFactor : 0,
      fvDistribution: !isContribution ? amount * growthFactor : 0,
    };
  });

  // KS-PME = (FV distributions + NAV) / FV contributions
  const ksPme = totalFvContributions > 0
    ? (totalFvDistributions + nav) / totalFvContributions
    : 1.0;

  // Annualized benchmark return
  const firstDate = new Date(cashFlows[0].flowDate!);
  const years = (now.getTime() - firstDate.getTime()) / (365.25 * 24 * 3600 * 1000);
  const benchmarkReturn = getAnnualizedBenchmarkReturn(firstDate.getFullYear(), now.getFullYear());

  // Direct alpha (simplified): fund annualized return - benchmark annualized return
  const fundTvpi = totalContributions > 0 ? (totalDistributions + nav) / totalContributions : 1;
  const fundAnnualized = years > 0 ? Math.pow(fundTvpi, 1 / years) - 1 : 0;
  const directAlpha = fundAnnualized - benchmarkReturn;

  return {
    fundId, fundName: fund.name, benchmarkIndex: 'S&P 500',
    ksPme: Math.round(ksPme * 1000) / 1000,
    directAlpha: Math.round(directAlpha * 10000) / 10000,
    fundIrr: dn(fund.netIrr) || null,
    benchmarkReturn: Math.round(benchmarkReturn * 10000) / 10000,
    cashFlows: cfDetails,
    summary: {
      totalContributions, totalDistributions, nav,
      fvContributions: Math.round(totalFvContributions * 100) / 100,
      fvDistributions: Math.round(totalFvDistributions * 100) / 100,
    },
  };
}

// ============================================================================
// RETURN ATTRIBUTION — Top/Bottom Deal Contribution
// ============================================================================

export interface DealAttribution {
  allocationId: string;
  projectName: string;
  investedAmount: number;
  currentValue: number;
  realizedGains: number;
  unrealizedGains: number;
  totalReturn: number;
  irr: number | null;
  multiple: number;
  contributionToFundReturn: number;  // Basis points contribution
  pctOfPortfolio: number;
  exitStatus: string;
}

export interface ReturnAttributionResult {
  fundId: string;
  fundName: string;
  totalInvested: number;
  totalValue: number;
  fundMultiple: number;
  topDeals: DealAttribution[];
  bottomDeals: DealAttribution[];
  allDeals: DealAttribution[];
}

export async function calculateReturnAttribution(
  orgId: string,
  fundId: string
): Promise<ReturnAttributionResult> {
  const [fund] = await db.select().from(funds)
    .where(and(eq(funds.id, fundId), eq(funds.orgId, orgId))).limit(1);
  if (!fund) throw new Error('Fund not found');

  // Get allocations with project names
  const allocations = await db.select({
    allocation: fundDealAllocations,
    projectName: modelingProjects.marinaName,
  })
    .from(fundDealAllocations)
    .leftJoin(modelingProjects, eq(fundDealAllocations.modelingProjectId, modelingProjects.id))
    .where(and(
      eq(fundDealAllocations.fundId, fundId),
      eq(fundDealAllocations.orgId, orgId),
    ));

  const totalInvested = allocations.reduce((sum, a) => sum + dn(a.allocation.fundedAmount), 0);

  const allDeals: DealAttribution[] = allocations.map(a => {
    const invested = dn(a.allocation.fundedAmount);
    const currentVal = dn(a.allocation.currentValue ?? a.allocation.fundedAmount);
    const costBasis = dn(a.allocation.costBasis ?? a.allocation.fundedAmount);
    const unrealizedGains = currentVal - costBasis;
    const realizedGains = 0; // Would come from distribution waterfall
    const totalReturn = unrealizedGains + realizedGains;
    const multiple = invested > 0 ? currentVal / invested : 1;
    const contributionBps = totalInvested > 0
      ? (totalReturn / totalInvested) * 10000
      : 0;

    return {
      allocationId: a.allocation.id,
      projectName: a.projectName || 'Unknown',
      investedAmount: invested,
      currentValue: currentVal,
      realizedGains,
      unrealizedGains,
      totalReturn,
      irr: null,
      multiple: Math.round(multiple * 100) / 100,
      contributionToFundReturn: Math.round(contributionBps),
      pctOfPortfolio: totalInvested > 0
        ? Math.round((invested / totalInvested) * 10000) / 100
        : 0,
      exitStatus: a.allocation.exitStatus || 'active',
    };
  });

  // Sort by total return
  const sorted = [...allDeals].sort((a, b) => b.totalReturn - a.totalReturn);
  const topDeals = sorted.slice(0, 5);
  const bottomDeals = sorted.slice(-5).reverse();

  const totalValue = allDeals.reduce((sum, d) => sum + d.currentValue, 0);
  const fundMultiple = totalInvested > 0 ? totalValue / totalInvested : 1;

  return {
    fundId, fundName: fund.name,
    totalInvested, totalValue,
    fundMultiple: Math.round(fundMultiple * 100) / 100,
    topDeals, bottomDeals, allDeals,
  };
}

// ============================================================================
// J-CURVE — Net Cash Flow Over Time
// ============================================================================

export interface JCurveDataPoint {
  quarter: string;        // "2024-Q1"
  cumulativeCashFlow: number;
  periodCashFlow: number;
  cumulativeContributions: number;
  cumulativeDistributions: number;
  nav: number;
  tvpi: number;
}

export interface JCurveResult {
  fundId: string;
  fundName: string;
  vintage: number | null;
  dataPoints: JCurveDataPoint[];
  nadir: { quarter: string; value: number } | null;  // Lowest point of the J
  breakeven: string | null;  // Quarter when cumulative cash flow turns positive
}

export async function calculateJCurve(orgId: string, fundId: string): Promise<JCurveResult> {
  const [fund] = await db.select().from(funds)
    .where(and(eq(funds.id, fundId), eq(funds.orgId, orgId))).limit(1);
  if (!fund) throw new Error('Fund not found');

  const cashFlows = await db.select().from(fundCashFlows)
    .where(and(eq(fundCashFlows.fundId, fundId), eq(fundCashFlows.orgId, orgId)))
    .orderBy(asc(fundCashFlows.flowDate));

  // Group by quarter
  const quarterMap = new Map<string, { contributions: number; distributions: number }>();

  for (const cf of cashFlows) {
    const date = new Date(cf.flowDate!);
    const q = `${date.getFullYear()}-Q${Math.ceil((date.getMonth() + 1) / 3)}`;
    const entry = quarterMap.get(q) || { contributions: 0, distributions: 0 };
    const amount = dn(cf.grossAmount);

    if (cf.flowType === 'capital_call' || cf.flowType === 'contribution' || amount < 0) {
      entry.contributions += Math.abs(amount);
    } else {
      entry.distributions += amount;
    }
    quarterMap.set(q, entry);
  }

  // Build cumulative time series
  const quarters = [...quarterMap.keys()].sort();
  let cumContrib = 0;
  let cumDistrib = 0;
  let nadir: { quarter: string; value: number } | null = null;
  let breakeven: string | null = null;

  const dataPoints: JCurveDataPoint[] = quarters.map(q => {
    const entry = quarterMap.get(q)!;
    cumContrib += entry.contributions;
    cumDistrib += entry.distributions;
    const netCF = cumDistrib - cumContrib;
    const tvpi = cumContrib > 0 ? (cumDistrib + Math.max(0, cumContrib - cumDistrib)) / cumContrib : 1;

    if (nadir === null || netCF < nadir.value) {
      nadir = { quarter: q, value: netCF };
    }
    if (breakeven === null && netCF >= 0 && cumContrib > 0) {
      breakeven = q;
    }

    return {
      quarter: q,
      cumulativeCashFlow: Math.round(netCF * 100) / 100,
      periodCashFlow: Math.round((entry.distributions - entry.contributions) * 100) / 100,
      cumulativeContributions: cumContrib,
      cumulativeDistributions: cumDistrib,
      nav: Math.max(0, cumContrib - cumDistrib),
      tvpi: Math.round(tvpi * 100) / 100,
    };
  });

  return {
    fundId, fundName: fund.name, vintage: fund.vintage,
    dataPoints,
    nadir: nadir && (nadir as any).value < 0 ? nadir : null,
    breakeven,
  };
}

// ============================================================================
// VINTAGE COHORT — Compare Funds by Vintage Year
// ============================================================================

export interface VintageCohortFund {
  fundId: string;
  fundName: string;
  vintage: number;
  tvpi: number | null;
  dpi: number | null;
  rvpi: number | null;
  netIrr: number | null;
  committedCapital: number;
  calledPct: number;
  status: string;
}

export interface VintageCohortResult {
  vintageYear: number;
  fundCount: number;
  avgTvpi: number | null;
  avgNetIrr: number | null;
  totalCommitted: number;
  funds: VintageCohortFund[];
}

export async function getVintageCohorts(orgId: string): Promise<VintageCohortResult[]> {
  const allFunds = await db.select().from(funds)
    .where(eq(funds.orgId, orgId))
    .orderBy(desc(funds.vintage));

  // Group by vintage year
  const vintageMap = new Map<number, VintageCohortFund[]>();

  for (const f of allFunds) {
    const vintage = f.vintage || new Date(f.createdAt!).getFullYear();
    const committed = dn(f.committedCapital);
    const called = dn(f.calledCapital);

    const entry: VintageCohortFund = {
      fundId: f.id,
      fundName: f.name,
      vintage,
      tvpi: f.tvpi ? dn(f.tvpi) : null,
      dpi: f.dpi ? dn(f.dpi) : null,
      rvpi: f.rvpi ? dn(f.rvpi) : null,
      netIrr: f.netIrr ? dn(f.netIrr) : null,
      committedCapital: committed,
      calledPct: committed > 0 ? Math.round((called / committed) * 10000) / 100 : 0,
      status: f.status || 'active',
    };

    if (!vintageMap.has(vintage)) vintageMap.set(vintage, []);
    vintageMap.get(vintage)!.push(entry);
  }

  const cohorts: VintageCohortResult[] = [];
  for (const [year, cohortFunds] of vintageMap) {
    const tvpis = cohortFunds.filter(f => f.tvpi != null).map(f => f.tvpi!);
    const irrs = cohortFunds.filter(f => f.netIrr != null).map(f => f.netIrr!);

    cohorts.push({
      vintageYear: year,
      fundCount: cohortFunds.length,
      avgTvpi: tvpis.length > 0 ? Math.round((tvpis.reduce((a, b) => a + b, 0) / tvpis.length) * 100) / 100 : null,
      avgNetIrr: irrs.length > 0 ? Math.round((irrs.reduce((a, b) => a + b, 0) / irrs.length) * 10000) / 10000 : null,
      totalCommitted: cohortFunds.reduce((sum, f) => sum + f.committedCapital, 0),
      funds: cohortFunds,
    });
  }

  return cohorts.sort((a, b) => b.vintageYear - a.vintageYear);
}
