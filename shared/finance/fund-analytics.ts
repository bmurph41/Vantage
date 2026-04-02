/**
 * shared/finance/fund-analytics.ts
 *
 * Institutional fund analytics calculation engine.
 * Pure functions — no DB access. Uses decimal.js for precision.
 *
 * Exports:
 *   calculatePME          — Kaplan-Schoar PME, Long-Nickels PME+, Direct Alpha
 *   generateJCurve        — J-Curve analysis with TVPI/DPI/RVPI time series
 *   calculateReturnAttribution — Top/bottom deal contribution, Herfindahl
 *   analyzeVintageCohort  — Vintage year aggregation with quartile ranks
 *   calculatePeerBenchmark — Percentile ranking against peer universe
 *   generateFundTimeSeries — Full cumulative time series with rolling IRR
 */

import Decimal from 'decimal.js';
import { calculateXIRR, type DatedCashFlow } from './xirr';

// Configure Decimal for financial precision
Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

// ─── Shared Helpers ─────────────────────────────────────────────────────────

const ZERO = new Decimal(0);
const ONE = new Decimal(1);
const HUNDRED = new Decimal(100);

function toDecimal(v: number | Decimal): Decimal {
  return v instanceof Decimal ? v : new Decimal(v);
}

function dNum(d: Decimal): number {
  return d.toNumber();
}

/** Parse an ISO date string into a UTC Date. */
function parseUTC(iso: string): Date {
  return iso.includes('T') ? new Date(iso) : new Date(iso + 'T00:00:00Z');
}

/** Year fraction between two dates (Actual/365.25). */
function yearFrac(from: Date, to: Date): Decimal {
  const ms = to.getTime() - from.getTime();
  return new Decimal(ms).div(new Decimal(365.25).mul(86_400_000));
}

/** Linearly interpolate a benchmark index value at a given date. */
function interpolateBenchmark(date: Date, series: BenchmarkDataPoint[]): Decimal {
  if (series.length === 0) return ONE;

  const t = date.getTime();
  // Before first point
  if (t <= parseUTC(series[0].date).getTime()) {
    return new Decimal(series[0].indexValue);
  }
  // After last point
  const last = series[series.length - 1];
  if (t >= parseUTC(last.date).getTime()) {
    return new Decimal(last.indexValue);
  }

  // Find bracketing points
  for (let i = 0; i < series.length - 1; i++) {
    const d0 = parseUTC(series[i].date).getTime();
    const d1 = parseUTC(series[i + 1].date).getTime();
    if (t >= d0 && t <= d1) {
      const v0 = new Decimal(series[i].indexValue);
      const v1 = new Decimal(series[i + 1].indexValue);
      const frac = new Decimal(t - d0).div(d1 - d0);
      return v0.plus(v1.minus(v0).mul(frac));
    }
  }
  return new Decimal(last.indexValue);
}

/** Compute median of a sorted-ascending Decimal array. */
function medianSorted(sorted: Decimal[]): Decimal {
  if (sorted.length === 0) return ZERO;
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid];
  return sorted[mid - 1].plus(sorted[mid]).div(2);
}

/** Percentile rank of a value within a sorted-ascending array (0-100). */
function percentileRank(value: Decimal, sorted: Decimal[]): number {
  if (sorted.length === 0) return 50;
  let countBelow = 0;
  let countEqual = 0;
  for (const v of sorted) {
    if (v.lt(value)) countBelow++;
    else if (v.eq(value)) countEqual++;
  }
  // Average rank method
  const rank = new Decimal(countBelow)
    .plus(new Decimal(countEqual).div(2))
    .div(sorted.length)
    .mul(HUNDRED);
  return dNum(rank);
}

// ─── Types ──────────────────────────────────────────────────────────────────

export interface FundCashFlow {
  date: string;   // ISO date
  amount: number; // negative = contribution (outflow), positive = distribution (inflow)
}

export interface BenchmarkDataPoint {
  date: string;      // ISO date
  indexValue: number; // e.g. S&P 500 total return index level
}

export interface PMEResult {
  /** Kaplan-Schoar PME ratio. >1 means fund outperformed benchmark. */
  ksaPME: number;
  /** Long-Nickels PME+ IRR (annualized, percent). */
  pmePlusIRR: number;
  /** Direct Alpha spread (fund IRR minus PME+ IRR, bps). */
  directAlphaBps: number;
  /** Fund IRR used in calculation (percent). */
  fundIRR: number;
  /** Benchmark total return over the period (percent). */
  benchmarkTotalReturn: number;
}

export interface QuarterlyDataPoint {
  quarter: string;    // e.g. "2024-Q1"
  nav: number;
  contributions: number;
  distributions: number;
}

export interface JCurveResult {
  tvpiByQuarter: { quarter: string; tvpi: number }[];
  dpiByQuarter: { quarter: string; dpi: number }[];
  rvpiByQuarter: { quarter: string; rvpi: number }[];
  /** The quarter and TVPI value where the J-curve reaches its trough. */
  jCurveTrough: { quarter: string; value: number };
  /** Number of quarters from inception until TVPI first exceeds 1.0x. */
  timeToBreakeven: number;
}

export interface FundDeal {
  name: string;
  investedCapital: number;
  realizedValue: number;
  unrealizedValue: number;
}

export interface DealAttribution {
  name: string;
  investedCapital: number;
  totalValue: number;
  dealMOIC: number;
  /** Contribution to overall fund profit (can be negative). */
  profitContribution: number;
  /** Weight as percentage of total fund profit. */
  profitContributionPct: number;
  /** Weight of invested capital as share of total fund invested. */
  capitalWeightPct: number;
}

export interface ReturnAttributionResult {
  deals: DealAttribution[];
  top5: DealAttribution[];
  bottom5: DealAttribution[];
  /** Fund-level MOIC. */
  fundMOIC: number;
  /** Herfindahl-Hirschman Index of profit concentration (0-10000). */
  concentrationHerfindahl: number;
  totalInvested: number;
  totalValue: number;
  totalProfit: number;
}

export interface VintageFund {
  vintageYear: number;
  tvpi: number;
  dpi: number;
  irr: number;           // as percent
  netAssetValue: number;
}

export interface VintageCohortStats {
  vintageYear: number;
  count: number;
  avgTVPI: number;
  avgDPI: number;
  avgIRR: number;
  medianIRR: number;
  /** Quartile boundaries: Q1 (top), median, Q3 */
  quartileRanks: {
    q1IRR: number;
    medianIRR: number;
    q3IRR: number;
    q1TVPI: number;
    medianTVPI: number;
    q3TVPI: number;
  };
  totalNAV: number;
}

export interface VintageCohortResult {
  cohorts: VintageCohortStats[];
  overallAvgIRR: number;
  overallAvgTVPI: number;
}

export interface FundMetrics {
  irr: number;   // percent
  tvpi: number;
  dpi: number;
}

export interface PeerBenchmarkResult {
  irrPercentile: number;
  tvpiPercentile: number;
  dpiPercentile: number;
  /** 1 = top quartile, 4 = bottom quartile */
  quartile: 1 | 2 | 3 | 4;
  peerCount: number;
  peerMedianIRR: number;
  peerMedianTVPI: number;
  peerMedianDPI: number;
}

export interface CapitalEvent {
  date: string;   // ISO date
  amount: number; // positive value
}

export interface NAVSnapshot {
  date: string;
  nav: number;
}

export interface TimeSeriesPoint {
  date: string;
  cumContributions: number;
  cumDistributions: number;
  nav: number;
  tvpi: number;
  dpi: number;
  rvpi: number;
  irr: number; // percent, rolling since inception
}

export interface FundTimeSeriesResult {
  series: TimeSeriesPoint[];
  asOfDate: string;
  inceptionDate: string;
}

// ─── 1. Public Market Equivalent (PME) ──────────────────────────────────────

/**
 * Calculate Kaplan-Schoar PME, Long-Nickels PME+, and Direct Alpha.
 *
 * Kaplan-Schoar PME = FV(distributions) / FV(contributions)
 *   where FV is computed by investing each cash flow in the benchmark index.
 *
 * PME+ (Long-Nickels): scales distributions so that the PME ratio equals 1,
 *   then computes the IRR of the adjusted cash flow stream.
 *
 * Direct Alpha = Fund IRR - PME+ IRR (expressed in basis points).
 */
export function calculatePME(
  fundCashFlows: FundCashFlow[],
  benchmarkReturns: BenchmarkDataPoint[],
): PMEResult {
  if (fundCashFlows.length < 2 || benchmarkReturns.length < 2) {
    return { ksaPME: 1, pmePlusIRR: 0, directAlphaBps: 0, fundIRR: 0, benchmarkTotalReturn: 0 };
  }

  // Sort cash flows and benchmark by date
  const flows = [...fundCashFlows].sort(
    (a, b) => parseUTC(a.date).getTime() - parseUTC(b.date).getTime(),
  );
  const bench = [...benchmarkReturns].sort(
    (a, b) => parseUTC(a.date).getTime() - parseUTC(b.date).getTime(),
  );

  const lastDate = parseUTC(flows[flows.length - 1].date);
  const indexAtEnd = interpolateBenchmark(lastDate, bench);

  // ── Kaplan-Schoar PME ──
  // FV of contributions: for each contribution, grow it at the benchmark rate
  // from the contribution date to the end date.
  // FV of distributions: for each distribution, grow it similarly.
  let fvContributions = ZERO;
  let fvDistributions = ZERO;

  for (const cf of flows) {
    const cfDate = parseUTC(cf.date);
    const indexAtCF = interpolateBenchmark(cfDate, bench);
    if (indexAtCF.isZero()) continue;

    const growthFactor = indexAtEnd.div(indexAtCF);
    const amt = new Decimal(cf.amount);

    if (amt.lt(ZERO)) {
      // Contribution (outflow from LP perspective)
      fvContributions = fvContributions.plus(amt.abs().mul(growthFactor));
    } else {
      // Distribution
      fvDistributions = fvDistributions.plus(amt.mul(growthFactor));
    }
  }

  const ksaPME = fvContributions.isZero()
    ? 1
    : dNum(fvDistributions.div(fvContributions));

  // ── Benchmark total return ──
  const firstIndex = interpolateBenchmark(parseUTC(flows[0].date), bench);
  const benchmarkTotalReturn = firstIndex.isZero()
    ? 0
    : dNum(indexAtEnd.div(firstIndex).minus(ONE).mul(HUNDRED));

  // ── Fund IRR ──
  const xirrFlows: DatedCashFlow[] = flows.map(f => ({
    date: f.date,
    amount: f.amount,
  }));
  const fundXIRR = calculateXIRR(xirrFlows);
  const fundIRR = fundXIRR.irr;

  // ── Long-Nickels PME+ ──
  // Idea: scale all distributions by a factor lambda so that KS-PME = 1.
  // lambda = FV(contributions) / FV(distributions)
  // Then compute IRR on the adjusted cash flow series.
  const lambda = fvDistributions.isZero()
    ? ONE
    : fvContributions.div(fvDistributions);

  const pmePlusFlows: DatedCashFlow[] = flows.map(f => {
    const amt = new Decimal(f.amount);
    if (amt.gt(ZERO)) {
      // Scale distributions
      return { date: f.date, amount: dNum(amt.mul(lambda)) };
    }
    return { date: f.date, amount: f.amount };
  });

  const pmePlusXIRR = calculateXIRR(pmePlusFlows);
  const pmePlusIRR = pmePlusXIRR.irr;

  // ── Direct Alpha ──
  const directAlphaBps = (fundIRR - pmePlusIRR) * 100; // percent to bps

  return {
    ksaPME: Math.round(ksaPME * 1000) / 1000,
    pmePlusIRR: Math.round(pmePlusIRR * 100) / 100,
    directAlphaBps: Math.round(directAlphaBps),
    fundIRR: Math.round(fundIRR * 100) / 100,
    benchmarkTotalReturn: Math.round(benchmarkTotalReturn * 100) / 100,
  };
}

// ─── 2. J-Curve Analysis ────────────────────────────────────────────────────

/**
 * Generate J-Curve analysis from quarterly NAV and cash flow data.
 *
 * TVPI = (Cumulative Distributions + NAV) / Cumulative Contributions
 * DPI  = Cumulative Distributions / Cumulative Contributions
 * RVPI = NAV / Cumulative Contributions (residual value to paid-in)
 *
 * The J-curve trough is the minimum TVPI point. Time to breakeven is
 * the number of quarters until TVPI first exceeds 1.0x.
 */
export function generateJCurve(
  quarterlyNavs: number[],
  quarterlyContributions: number[],
  quarterlyDistributions: number[],
  quarterLabels?: string[],
): JCurveResult {
  const len = Math.min(
    quarterlyNavs.length,
    quarterlyContributions.length,
    quarterlyDistributions.length,
  );

  if (len === 0) {
    return {
      tvpiByQuarter: [],
      dpiByQuarter: [],
      rvpiByQuarter: [],
      jCurveTrough: { quarter: '', value: 0 },
      timeToBreakeven: 0,
    };
  }

  // Build quarter labels if not supplied
  const labels = quarterLabels && quarterLabels.length >= len
    ? quarterLabels
    : Array.from({ length: len }, (_, i) => `Q${i + 1}`);

  let cumContrib = ZERO;
  let cumDistrib = ZERO;

  const tvpiByQuarter: { quarter: string; tvpi: number }[] = [];
  const dpiByQuarter: { quarter: string; dpi: number }[] = [];
  const rvpiByQuarter: { quarter: string; rvpi: number }[] = [];

  let troughQuarter = '';
  let troughValue = Infinity;
  let breakevenQuarter = -1;

  for (let i = 0; i < len; i++) {
    cumContrib = cumContrib.plus(new Decimal(quarterlyContributions[i]));
    cumDistrib = cumDistrib.plus(new Decimal(quarterlyDistributions[i]));
    const nav = new Decimal(quarterlyNavs[i]);

    const qLabel = labels[i];

    if (cumContrib.isZero()) {
      tvpiByQuarter.push({ quarter: qLabel, tvpi: 0 });
      dpiByQuarter.push({ quarter: qLabel, dpi: 0 });
      rvpiByQuarter.push({ quarter: qLabel, rvpi: 0 });
      continue;
    }

    const tvpi = cumDistrib.plus(nav).div(cumContrib);
    const dpi = cumDistrib.div(cumContrib);
    const rvpi = nav.div(cumContrib);

    const tvpiNum = dNum(tvpi);
    const dpiNum = dNum(dpi);
    const rvpiNum = dNum(rvpi);

    tvpiByQuarter.push({ quarter: qLabel, tvpi: Math.round(tvpiNum * 1000) / 1000 });
    dpiByQuarter.push({ quarter: qLabel, dpi: Math.round(dpiNum * 1000) / 1000 });
    rvpiByQuarter.push({ quarter: qLabel, rvpi: Math.round(rvpiNum * 1000) / 1000 });

    if (tvpiNum < troughValue) {
      troughValue = tvpiNum;
      troughQuarter = qLabel;
    }

    if (breakevenQuarter === -1 && tvpiNum >= 1.0) {
      breakevenQuarter = i + 1; // 1-indexed quarter count
    }
  }

  return {
    tvpiByQuarter,
    dpiByQuarter,
    rvpiByQuarter,
    jCurveTrough: {
      quarter: troughQuarter,
      value: Math.round(troughValue * 1000) / 1000,
    },
    timeToBreakeven: breakevenQuarter === -1 ? len : breakevenQuarter,
  };
}

// ─── 3. Return Attribution ──────────────────────────────────────────────────

/**
 * Calculate deal-level contribution to fund returns.
 *
 * Each deal's profit contribution = (realizedValue + unrealizedValue - investedCapital).
 * Deals are sorted by profit contribution descending.
 *
 * The Herfindahl-Hirschman Index measures profit concentration:
 *   HHI = sum of (each deal's profit share as %)^2
 *   Range: 0 (perfectly diversified) to 10000 (single deal).
 */
export function calculateReturnAttribution(
  fundDeals: FundDeal[],
): ReturnAttributionResult {
  if (fundDeals.length === 0) {
    return {
      deals: [],
      top5: [],
      bottom5: [],
      fundMOIC: 0,
      concentrationHerfindahl: 0,
      totalInvested: 0,
      totalValue: 0,
      totalProfit: 0,
    };
  }

  let totalInvested = ZERO;
  let totalValue = ZERO;

  const dealCalcs: {
    name: string;
    invested: Decimal;
    total: Decimal;
    profit: Decimal;
    moic: Decimal;
  }[] = [];

  for (const deal of fundDeals) {
    const invested = new Decimal(deal.investedCapital);
    const realized = new Decimal(deal.realizedValue);
    const unrealized = new Decimal(deal.unrealizedValue);
    const total = realized.plus(unrealized);
    const profit = total.minus(invested);
    const moic = invested.isZero() ? ZERO : total.div(invested);

    totalInvested = totalInvested.plus(invested);
    totalValue = totalValue.plus(total);

    dealCalcs.push({ name: deal.name, invested, total, profit, moic });
  }

  const totalProfit = totalValue.minus(totalInvested);
  const fundMOIC = totalInvested.isZero() ? ZERO : totalValue.div(totalInvested);

  // Compute profit contribution percentages
  // If total profit is zero or negative, use capital weight instead
  const useCapitalWeight = totalProfit.lte(ZERO);

  const attributions: DealAttribution[] = dealCalcs.map(d => {
    const profitContributionPct = useCapitalWeight
      ? (totalInvested.isZero() ? 0 : dNum(d.invested.div(totalInvested).mul(HUNDRED)))
      : (totalProfit.isZero() ? 0 : dNum(d.profit.div(totalProfit).mul(HUNDRED)));

    return {
      name: d.name,
      investedCapital: dNum(d.invested),
      totalValue: dNum(d.total),
      dealMOIC: Math.round(dNum(d.moic) * 1000) / 1000,
      profitContribution: dNum(d.profit),
      profitContributionPct: Math.round(profitContributionPct * 100) / 100,
      capitalWeightPct: totalInvested.isZero()
        ? 0
        : Math.round(dNum(d.invested.div(totalInvested).mul(HUNDRED)) * 100) / 100,
    };
  });

  // Sort by profit contribution descending
  attributions.sort((a, b) => b.profitContribution - a.profitContribution);

  // Top 5 / Bottom 5
  const top5 = attributions.slice(0, 5);
  const bottom5 = [...attributions].sort((a, b) => a.profitContribution - b.profitContribution).slice(0, 5);

  // Herfindahl-Hirschman Index on profit shares
  // HHI = sum( (profit_share_i * 100)^2 ) where profit_share_i is fraction
  let hhi = ZERO;
  if (!useCapitalWeight && !totalProfit.isZero()) {
    for (const d of dealCalcs) {
      const share = d.profit.div(totalProfit).mul(HUNDRED); // as percentage points
      hhi = hhi.plus(share.mul(share));
    }
  } else {
    // Fallback: use capital weight for HHI
    for (const d of dealCalcs) {
      if (totalInvested.isZero()) continue;
      const share = d.invested.div(totalInvested).mul(HUNDRED);
      hhi = hhi.plus(share.mul(share));
    }
  }

  return {
    deals: attributions,
    top5,
    bottom5,
    fundMOIC: Math.round(dNum(fundMOIC) * 1000) / 1000,
    concentrationHerfindahl: Math.round(dNum(hhi)),
    totalInvested: dNum(totalInvested),
    totalValue: dNum(totalValue),
    totalProfit: dNum(totalProfit),
  };
}

// ─── 4. Vintage Cohort Analysis ─────────────────────────────────────────────

/**
 * Aggregate fund performance by vintage year.
 *
 * For each vintage cohort, computes average and median IRR/TVPI/DPI,
 * quartile boundaries, and total NAV.
 */
export function analyzeVintageCohort(
  funds: VintageFund[],
): VintageCohortResult {
  if (funds.length === 0) {
    return { cohorts: [], overallAvgIRR: 0, overallAvgTVPI: 0 };
  }

  // Group by vintage year
  const vintageMap = new Map<number, VintageFund[]>();
  for (const f of funds) {
    const existing = vintageMap.get(f.vintageYear) || [];
    existing.push(f);
    vintageMap.set(f.vintageYear, existing);
  }

  const cohorts: VintageCohortStats[] = [];
  let overallIRRSum = ZERO;
  let overallTVPISum = ZERO;
  let overallCount = 0;

  // Sort vintage years ascending
  const sortedYears = Array.from(vintageMap.keys()).sort((a, b) => a - b);

  for (const year of sortedYears) {
    const group = vintageMap.get(year)!;
    const count = group.length;

    // Decimal arrays for aggregation
    const irrs = group.map(f => new Decimal(f.irr));
    const tvpis = group.map(f => new Decimal(f.tvpi));
    const dpis = group.map(f => new Decimal(f.dpi));
    const navs = group.map(f => new Decimal(f.netAssetValue));

    // Averages
    const avgIRR = irrs.reduce((s, v) => s.plus(v), ZERO).div(count);
    const avgTVPI = tvpis.reduce((s, v) => s.plus(v), ZERO).div(count);
    const avgDPI = dpis.reduce((s, v) => s.plus(v), ZERO).div(count);
    const totalNAV = navs.reduce((s, v) => s.plus(v), ZERO);

    // Sort for median and quartiles
    const sortedIRR = [...irrs].sort((a, b) => a.cmp(b));
    const sortedTVPI = [...tvpis].sort((a, b) => a.cmp(b));

    const medIRR = medianSorted(sortedIRR);
    const medTVPI = medianSorted(sortedTVPI);

    // Quartile boundaries (Q1 = 25th percentile, Q3 = 75th percentile)
    const q1IRR = quantile(sortedIRR, 0.25);
    const q3IRR = quantile(sortedIRR, 0.75);
    const q1TVPI = quantile(sortedTVPI, 0.25);
    const q3TVPI = quantile(sortedTVPI, 0.75);

    overallIRRSum = overallIRRSum.plus(avgIRR.mul(count));
    overallTVPISum = overallTVPISum.plus(avgTVPI.mul(count));
    overallCount += count;

    cohorts.push({
      vintageYear: year,
      count,
      avgTVPI: Math.round(dNum(avgTVPI) * 1000) / 1000,
      avgDPI: Math.round(dNum(avgDPI) * 1000) / 1000,
      avgIRR: Math.round(dNum(avgIRR) * 100) / 100,
      medianIRR: Math.round(dNum(medIRR) * 100) / 100,
      quartileRanks: {
        q1IRR: Math.round(dNum(q1IRR) * 100) / 100,
        medianIRR: Math.round(dNum(medIRR) * 100) / 100,
        q3IRR: Math.round(dNum(q3IRR) * 100) / 100,
        q1TVPI: Math.round(dNum(q1TVPI) * 1000) / 1000,
        medianTVPI: Math.round(dNum(medTVPI) * 1000) / 1000,
        q3TVPI: Math.round(dNum(q3TVPI) * 1000) / 1000,
      },
      totalNAV: dNum(totalNAV),
    });
  }

  return {
    cohorts,
    overallAvgIRR: overallCount === 0
      ? 0
      : Math.round(dNum(overallIRRSum.div(overallCount)) * 100) / 100,
    overallAvgTVPI: overallCount === 0
      ? 0
      : Math.round(dNum(overallTVPISum.div(overallCount)) * 1000) / 1000,
  };
}

/**
 * Linear interpolation quantile on a sorted Decimal array.
 * p in [0, 1].
 */
function quantile(sorted: Decimal[], p: number): Decimal {
  if (sorted.length === 0) return ZERO;
  if (sorted.length === 1) return sorted[0];

  const index = p * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const frac = new Decimal(index - lower);

  if (lower === upper) return sorted[lower];
  return sorted[lower].plus(sorted[upper].minus(sorted[lower]).mul(frac));
}

// ─── 5. Peer Benchmark ──────────────────────────────────────────────────────

/**
 * Calculate percentile ranking of a fund against a peer universe.
 *
 * Percentile uses the average-rank method:
 *   percentile = (count_below + count_equal/2) / total * 100
 *
 * Quartile assignment:
 *   Q1: >= 75th percentile
 *   Q2: >= 50th percentile
 *   Q3: >= 25th percentile
 *   Q4: < 25th percentile
 */
export function calculatePeerBenchmark(
  fundMetrics: FundMetrics,
  peerData: FundMetrics[],
): PeerBenchmarkResult {
  if (peerData.length === 0) {
    return {
      irrPercentile: 50,
      tvpiPercentile: 50,
      dpiPercentile: 50,
      quartile: 2,
      peerCount: 0,
      peerMedianIRR: 0,
      peerMedianTVPI: 0,
      peerMedianDPI: 0,
    };
  }

  // Build sorted arrays for each metric
  const peerIRRs = peerData.map(p => new Decimal(p.irr)).sort((a, b) => a.cmp(b));
  const peerTVPIs = peerData.map(p => new Decimal(p.tvpi)).sort((a, b) => a.cmp(b));
  const peerDPIs = peerData.map(p => new Decimal(p.dpi)).sort((a, b) => a.cmp(b));

  const irrPercentile = percentileRank(new Decimal(fundMetrics.irr), peerIRRs);
  const tvpiPercentile = percentileRank(new Decimal(fundMetrics.tvpi), peerTVPIs);
  const dpiPercentile = percentileRank(new Decimal(fundMetrics.dpi), peerDPIs);

  // Quartile based on composite (average of three percentiles)
  const compositePercentile = (irrPercentile + tvpiPercentile + dpiPercentile) / 3;
  let quartile: 1 | 2 | 3 | 4;
  if (compositePercentile >= 75) quartile = 1;
  else if (compositePercentile >= 50) quartile = 2;
  else if (compositePercentile >= 25) quartile = 3;
  else quartile = 4;

  return {
    irrPercentile: Math.round(irrPercentile * 100) / 100,
    tvpiPercentile: Math.round(tvpiPercentile * 100) / 100,
    dpiPercentile: Math.round(dpiPercentile * 100) / 100,
    quartile,
    peerCount: peerData.length,
    peerMedianIRR: dNum(medianSorted(peerIRRs)),
    peerMedianTVPI: dNum(medianSorted(peerTVPIs)),
    peerMedianDPI: dNum(medianSorted(peerDPIs)),
  };
}

// ─── 6. Fund Time Series ────────────────────────────────────────────────────

/**
 * Generate a complete fund time series from capital calls, distributions,
 * and NAV snapshots.
 *
 * All events are merged into a unified date-sorted timeline. Between NAV
 * snapshot dates, NAV is held constant (step function). Cumulative metrics
 * are computed at each point. Rolling since-inception IRR is recalculated
 * at each snapshot date.
 */
export function generateFundTimeSeries(
  capitalCalls: CapitalEvent[],
  distributions: CapitalEvent[],
  navSnapshots: NAVSnapshot[],
): FundTimeSeriesResult {
  if (navSnapshots.length === 0) {
    return { series: [], asOfDate: '', inceptionDate: '' };
  }

  // Collect all unique dates
  const dateSet = new Set<string>();
  for (const c of capitalCalls) dateSet.add(c.date);
  for (const d of distributions) dateSet.add(d.date);
  for (const n of navSnapshots) dateSet.add(n.date);

  const allDates = Array.from(dateSet).sort(
    (a, b) => parseUTC(a).getTime() - parseUTC(b).getTime(),
  );

  if (allDates.length === 0) {
    return { series: [], asOfDate: '', inceptionDate: '' };
  }

  // Build lookup maps: date -> cumulative amounts for that date
  const callMap = new Map<string, Decimal>();
  for (const c of capitalCalls) {
    const existing = callMap.get(c.date) || ZERO;
    callMap.set(c.date, existing.plus(new Decimal(c.amount)));
  }

  const distMap = new Map<string, Decimal>();
  for (const d of distributions) {
    const existing = distMap.get(d.date) || ZERO;
    distMap.set(d.date, existing.plus(new Decimal(d.amount)));
  }

  // NAV snapshots: use latest value for each date, build sorted array for lookup
  const navMap = new Map<string, Decimal>();
  for (const n of navSnapshots) {
    navMap.set(n.date, new Decimal(n.nav));
  }

  // Sort NAV dates for step-function interpolation
  const navDates = Array.from(navMap.keys()).sort(
    (a, b) => parseUTC(a).getTime() - parseUTC(b).getTime(),
  );

  /** Get NAV at a date using step-function (carry forward). */
  function getNav(date: string): Decimal {
    if (navMap.has(date)) return navMap.get(date)!;
    const t = parseUTC(date).getTime();
    let lastNav = ZERO;
    for (const nd of navDates) {
      if (parseUTC(nd).getTime() <= t) {
        lastNav = navMap.get(nd)!;
      } else {
        break;
      }
    }
    return lastNav;
  }

  let cumContrib = ZERO;
  let cumDistrib = ZERO;
  const series: TimeSeriesPoint[] = [];

  // For rolling IRR, accumulate cash flows
  const irrFlows: DatedCashFlow[] = [];

  for (const date of allDates) {
    const callAmt = callMap.get(date) || ZERO;
    const distAmt = distMap.get(date) || ZERO;

    cumContrib = cumContrib.plus(callAmt);
    cumDistrib = cumDistrib.plus(distAmt);
    const nav = getNav(date);

    // Contributions are outflows (negative) for IRR, distributions are inflows
    if (!callAmt.isZero()) {
      irrFlows.push({ date, amount: dNum(callAmt.neg()) });
    }
    if (!distAmt.isZero()) {
      irrFlows.push({ date, amount: dNum(distAmt) });
    }

    // Ratios
    const tvpi = cumContrib.isZero()
      ? ZERO
      : cumDistrib.plus(nav).div(cumContrib);
    const dpi = cumContrib.isZero()
      ? ZERO
      : cumDistrib.div(cumContrib);
    const rvpi = cumContrib.isZero()
      ? ZERO
      : nav.div(cumContrib);

    // Rolling IRR: add current NAV as a hypothetical terminal inflow
    let rollingIRR = 0;
    if (irrFlows.length >= 1 && !cumContrib.isZero()) {
      const irrFlowsWithNav: DatedCashFlow[] = [
        ...irrFlows,
        { date, amount: dNum(nav) },
      ];
      // Only compute if there are both inflows and outflows
      const hasIn = irrFlowsWithNav.some(f => f.amount > 0);
      const hasOut = irrFlowsWithNav.some(f => f.amount < 0);
      if (hasIn && hasOut) {
        const result = calculateXIRR(irrFlowsWithNav);
        rollingIRR = result.converged ? result.irr : 0;
      }
    }

    series.push({
      date,
      cumContributions: dNum(cumContrib),
      cumDistributions: dNum(cumDistrib),
      nav: dNum(nav),
      tvpi: Math.round(dNum(tvpi) * 1000) / 1000,
      dpi: Math.round(dNum(dpi) * 1000) / 1000,
      rvpi: Math.round(dNum(rvpi) * 1000) / 1000,
      irr: Math.round(rollingIRR * 100) / 100,
    });
  }

  return {
    series,
    inceptionDate: allDates[0],
    asOfDate: allDates[allDates.length - 1],
  };
}
