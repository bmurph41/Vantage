import { db } from "../db";
import { returnsLedger, returnsValuation, loanBalanceTimeline } from "@shared/schema";
import { eq, and, gte, lte, inArray, sql } from "drizzle-orm";

export type ReturnView = 'levered' | 'unlevered';
export type SpendToggle = 'equity' | 'all_in';
export type DateRangePreset = 'ytd' | 't12' | 'since_acquisition' | 'custom';

interface CashflowPoint {
  date: string;
  amount: number;
}

interface TimeSeriesPoint {
  date: string;
  value: number;
}

interface ReturnMetrics {
  cumulativeOperatingCF: number;
  cumulativeCashIn: number;
  cumulativeSpendEquity: number;
  cumulativeSpendAllIn: number;
  grossGain: number;
  moic: number | null;
  roi: number | null;
  irr: number | null;
  endingMarketValue: number;
  endingEquityValue: number;
  endingLoanBalance: number;
  loanBalanceMissing: boolean;
}

interface ReturnAttribution {
  operatingCFContribution: number;
  capexDrag: number;
  feesDrag: number;
  appreciation: number;
  debtPaydownBenefit: number;
  refiProceeds: number;
}

interface CumulativeSeries {
  cashIn: TimeSeriesPoint[];
  cashOut: TimeSeriesPoint[];
  netPosition: TimeSeriesPoint[];
}

interface ValueSeries {
  marketValue: TimeSeriesPoint[];
  equityValue: TimeSeriesPoint[];
  loanBalance: TimeSeriesPoint[];
}

export interface ReturnsResponse {
  metrics: ReturnMetrics;
  attribution: ReturnAttribution;
  cumulativeSeries: CumulativeSeries;
  valueSeries: ValueSeries;
  cashflowsByBucket: Record<string, number>;
  ledgerEntries: any[];
  view: ReturnView;
}

const UNLEVERED_BUCKETS = [
  'ACQUISITION', 'OPERATING_CASHFLOW', 'CAPEX', 'SALE_PROCEEDS', 'SALE_COSTS', 'FEES_OTHER'
];

const LEVERED_BUCKETS = [
  'ACQUISITION', 'EQUITY_CONTRIBUTION', 'LOAN_PROCEEDS', 'OPERATING_CASHFLOW',
  'CAPEX', 'DEBT_SERVICE_INTEREST', 'DEBT_SERVICE_PRINCIPAL', 'REFI_PROCEEDS',
  'SALE_PROCEEDS', 'SALE_COSTS', 'LOAN_PAYOFF', 'FEES_OTHER'
];

export function computeXIRR(cashflows: CashflowPoint[]): number | null {
  if (cashflows.length < 2) return null;

  const hasPositive = cashflows.some(cf => cf.amount > 0);
  const hasNegative = cashflows.some(cf => cf.amount < 0);
  if (!hasPositive || !hasNegative) return null;

  const dates = cashflows.map(cf => new Date(cf.date).getTime());
  const amounts = cashflows.map(cf => cf.amount);
  const baseDate = dates[0];

  function yearFrac(d: number): number {
    return (d - baseDate) / (365.25 * 24 * 60 * 60 * 1000);
  }

  function npv(rate: number): number {
    let sum = 0;
    for (let i = 0; i < amounts.length; i++) {
      const t = yearFrac(dates[i]);
      sum += amounts[i] / Math.pow(1 + rate, t);
    }
    return sum;
  }

  function dnpv(rate: number): number {
    let sum = 0;
    for (let i = 0; i < amounts.length; i++) {
      const t = yearFrac(dates[i]);
      if (t === 0) continue;
      sum -= t * amounts[i] / Math.pow(1 + rate, t + 1);
    }
    return sum;
  }

  let rate = 0.1;
  const maxIterations = 100;
  const tolerance = 1e-7;

  for (let i = 0; i < maxIterations; i++) {
    const f = npv(rate);
    const df = dnpv(rate);

    if (Math.abs(df) < 1e-12) break;

    const newRate = rate - f / df;

    if (newRate <= -1) {
      rate = (rate + (-0.99)) / 2;
      continue;
    }

    if (Math.abs(newRate - rate) < tolerance) {
      return Math.round(newRate * 10000) / 10000;
    }

    rate = newRate;
  }

  let lo = -0.99, hi = 10.0;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    const val = npv(mid);
    if (Math.abs(val) < tolerance) {
      return Math.round(mid * 10000) / 10000;
    }
    if (val > 0) lo = mid;
    else hi = mid;
  }

  return null;
}

function buildMonthlyDates(start: string, end: string): string[] {
  const dates: string[] = [];
  const s = new Date(start);
  const e = new Date(end);
  let current = new Date(s.getFullYear(), s.getMonth(), 1);

  while (current <= e) {
    const lastDay = new Date(current.getFullYear(), current.getMonth() + 1, 0);
    dates.push(lastDay.toISOString().split('T')[0]);
    current = new Date(current.getFullYear(), current.getMonth() + 1, 1);
  }
  return dates;
}

function fillForward(points: { date: string; value: number }[], dates: string[]): TimeSeriesPoint[] {
  const map = new Map(points.map(p => [p.date, p.value]));
  const result: TimeSeriesPoint[] = [];
  let lastValue = 0;

  for (const d of dates) {
    if (map.has(d)) lastValue = map.get(d)!;
    result.push({ date: d, value: lastValue });
  }
  return result;
}

interface QueryFilters {
  orgId: string;
  modelId?: string;
  propertyId?: string;
  scenarioId?: string;
  startDate?: string;
  endDate?: string;
}

export async function computeModelReturns(
  filters: QueryFilters,
  view: ReturnView = 'levered'
): Promise<ReturnsResponse> {
  const conditions: any[] = [eq(returnsLedger.orgId, filters.orgId)];

  if (filters.modelId) conditions.push(eq(returnsLedger.modelId, filters.modelId));
  if (filters.propertyId) conditions.push(eq(returnsLedger.propertyId, filters.propertyId));
  if (filters.scenarioId) conditions.push(eq(returnsLedger.scenarioId, filters.scenarioId));
  if (filters.startDate) conditions.push(gte(returnsLedger.asOfDate, filters.startDate));
  if (filters.endDate) conditions.push(lte(returnsLedger.asOfDate, filters.endDate));

  const allowedBuckets = view === 'levered' ? LEVERED_BUCKETS : UNLEVERED_BUCKETS;
  conditions.push(inArray(returnsLedger.bucket, allowedBuckets as any));

  const entries = await db
    .select()
    .from(returnsLedger)
    .where(and(...conditions))
    .orderBy(returnsLedger.asOfDate);

  const valConditions: any[] = [eq(returnsValuation.orgId, filters.orgId)];
  if (filters.modelId) valConditions.push(eq(returnsValuation.modelId, filters.modelId));
  if (filters.propertyId) valConditions.push(eq(returnsValuation.propertyId, filters.propertyId));
  if (filters.scenarioId) valConditions.push(eq(returnsValuation.scenarioId, filters.scenarioId));
  if (filters.startDate) valConditions.push(gte(returnsValuation.asOfDate, filters.startDate));
  if (filters.endDate) valConditions.push(lte(returnsValuation.asOfDate, filters.endDate));

  const valuations = await db
    .select()
    .from(returnsValuation)
    .where(and(...valConditions))
    .orderBy(returnsValuation.asOfDate);

  let loanBalances: any[] = [];
  let loanBalanceMissing = true;

  if (view === 'levered') {
    const loanConditions: any[] = [eq(loanBalanceTimeline.orgId, filters.orgId)];
    if (filters.modelId) loanConditions.push(eq(loanBalanceTimeline.modelId, filters.modelId));
    if (filters.propertyId) loanConditions.push(eq(loanBalanceTimeline.propertyId, filters.propertyId));
    if (filters.scenarioId) loanConditions.push(eq(loanBalanceTimeline.scenarioId, filters.scenarioId));
    if (filters.startDate) loanConditions.push(gte(loanBalanceTimeline.asOfDate, filters.startDate));
    if (filters.endDate) loanConditions.push(lte(loanBalanceTimeline.asOfDate, filters.endDate));

    loanBalances = await db
      .select()
      .from(loanBalanceTimeline)
      .where(and(...loanConditions))
      .orderBy(loanBalanceTimeline.asOfDate);

    loanBalanceMissing = loanBalances.length === 0;
  }

  const allDates = [
    ...entries.map(e => e.asOfDate),
    ...valuations.map(v => v.asOfDate),
    ...loanBalances.map(l => l.asOfDate),
  ].sort();

  const startDate = allDates[0] || new Date().toISOString().split('T')[0];
  const endDate = allDates[allDates.length - 1] || startDate;
  const monthlyDates = buildMonthlyDates(startDate, endDate);

  let cumulativeOperatingCF = 0;
  let cumulativeCashIn = 0;
  let cumulativeSpendEquity = 0;
  let cumulativeSpendAllIn = 0;
  const cashflowsByBucket: Record<string, number> = {};

  const xirrCashflows: CashflowPoint[] = [];

  for (const entry of entries) {
    const amt = parseFloat(entry.amount);
    const bucket = entry.bucket;

    cashflowsByBucket[bucket] = (cashflowsByBucket[bucket] || 0) + amt;

    if (bucket === 'OPERATING_CASHFLOW') cumulativeOperatingCF += amt;
    if (amt > 0) cumulativeCashIn += amt;
    if (bucket === 'EQUITY_CONTRIBUTION' || bucket === 'ACQUISITION') {
      cumulativeSpendEquity += amt;
    }
    if (amt < 0) cumulativeSpendAllIn += amt;

    xirrCashflows.push({ date: entry.asOfDate, amount: amt });
  }

  const valPoints = valuations.map(v => ({ date: v.asOfDate, value: parseFloat(v.marketValue) }));
  const loanPoints = loanBalances.map(l => ({ date: l.asOfDate, value: parseFloat(l.loanBalance) }));

  const marketValueSeries = fillForward(valPoints, monthlyDates);
  const loanBalanceSeries = fillForward(loanPoints, monthlyDates);

  const equityValueSeries: TimeSeriesPoint[] = monthlyDates.map((d, i) => {
    const mv = marketValueSeries[i]?.value || 0;
    const lb = view === 'levered' ? (loanBalanceSeries[i]?.value || 0) : 0;
    return { date: d, value: mv - lb };
  });

  const endingMarketValue = marketValueSeries[marketValueSeries.length - 1]?.value || 0;
  const endingLoanBalance = loanBalanceSeries[loanBalanceSeries.length - 1]?.value || 0;
  const endingEquityValue = view === 'levered'
    ? endingMarketValue - endingLoanBalance
    : endingMarketValue;

  const totalCashOut = Math.abs(cumulativeSpendAllIn);
  const grossGain = (cumulativeCashIn + endingEquityValue) - totalCashOut;

  const totalEquityInvested = Math.abs(cumulativeSpendEquity);
  const moic = totalEquityInvested > 0
    ? Math.round(((cumulativeCashIn + endingEquityValue) / totalEquityInvested) * 100) / 100
    : null;

  const investedBase = totalEquityInvested > 0 ? totalEquityInvested : totalCashOut;
  const roi = investedBase > 0
    ? Math.round((grossGain / investedBase) * 10000) / 10000
    : null;

  if (endingEquityValue > 0 && monthlyDates.length > 0) {
    xirrCashflows.push({
      date: monthlyDates[monthlyDates.length - 1],
      amount: endingEquityValue,
    });
  }

  const irr = computeXIRR(xirrCashflows);

  const startingMarketValue = marketValueSeries[0]?.value || 0;
  const startingLoanBalance = loanBalanceSeries[0]?.value || 0;
  const appreciation = endingMarketValue - startingMarketValue;
  const debtPaydownBenefit = view === 'levered'
    ? (startingLoanBalance - endingLoanBalance)
    : 0;

  const attribution: ReturnAttribution = {
    operatingCFContribution: cashflowsByBucket['OPERATING_CASHFLOW'] || 0,
    capexDrag: cashflowsByBucket['CAPEX'] || 0,
    feesDrag: (cashflowsByBucket['FEES_OTHER'] || 0) + (cashflowsByBucket['SALE_COSTS'] || 0),
    appreciation,
    debtPaydownBenefit,
    refiProceeds: cashflowsByBucket['REFI_PROCEEDS'] || 0,
  };

  let cumIn = 0, cumOut = 0;
  const dateAmounts = new Map<string, { inflow: number; outflow: number }>();
  for (const entry of entries) {
    const amt = parseFloat(entry.amount);
    const d = entry.asOfDate;
    if (!dateAmounts.has(d)) dateAmounts.set(d, { inflow: 0, outflow: 0 });
    const rec = dateAmounts.get(d)!;
    if (amt > 0) rec.inflow += amt;
    else rec.outflow += amt;
  }

  const cashInSeries: TimeSeriesPoint[] = [];
  const cashOutSeries: TimeSeriesPoint[] = [];
  const netPositionSeries: TimeSeriesPoint[] = [];

  for (const d of monthlyDates) {
    const rec = dateAmounts.get(d);
    if (rec) {
      cumIn += rec.inflow;
      cumOut += rec.outflow;
    }
    cashInSeries.push({ date: d, value: cumIn });
    cashOutSeries.push({ date: d, value: Math.abs(cumOut) });
    netPositionSeries.push({ date: d, value: cumIn + cumOut });
  }

  return {
    metrics: {
      cumulativeOperatingCF,
      cumulativeCashIn,
      cumulativeSpendEquity,
      cumulativeSpendAllIn,
      grossGain,
      moic,
      roi,
      irr,
      endingMarketValue,
      endingEquityValue,
      endingLoanBalance,
      loanBalanceMissing,
    },
    attribution,
    cumulativeSeries: {
      cashIn: cashInSeries,
      cashOut: cashOutSeries,
      netPosition: netPositionSeries,
    },
    valueSeries: {
      marketValue: marketValueSeries,
      equityValue: equityValueSeries,
      loanBalance: loanBalanceSeries,
    },
    cashflowsByBucket,
    ledgerEntries: entries,
    view,
  };
}

export async function computePortfolioReturns(
  orgId: string,
  view: ReturnView = 'levered',
  startDate?: string,
  endDate?: string,
  propertyIds?: string[]
): Promise<{
  aggregate: ReturnsResponse;
  byProperty: { propertyId: string; metrics: ReturnMetrics; modelId?: string }[];
}> {
  const conditions: any[] = [eq(returnsLedger.orgId, orgId)];
  if (startDate) conditions.push(gte(returnsLedger.asOfDate, startDate));
  if (endDate) conditions.push(lte(returnsLedger.asOfDate, endDate));
  if (propertyIds && propertyIds.length > 0) {
    conditions.push(inArray(returnsLedger.propertyId, propertyIds));
  }

  const entries = await db
    .select()
    .from(returnsLedger)
    .where(and(...conditions))
    .orderBy(returnsLedger.asOfDate);

  const propIds = [...new Set(entries.map(e => e.propertyId).filter(Boolean))] as string[];

  const byProperty: { propertyId: string; metrics: ReturnMetrics; modelId?: string }[] = [];

  for (const pid of propIds) {
    const result = await computeModelReturns(
      { orgId, propertyId: pid, startDate, endDate },
      view
    );
    const models = entries.filter(e => e.propertyId === pid && e.modelId).map(e => e.modelId);
    byProperty.push({
      propertyId: pid,
      metrics: result.metrics,
      modelId: models[0] || undefined,
    });
  }

  const aggregate = await computeModelReturns(
    { orgId, startDate, endDate },
    view
  );

  return { aggregate, byProperty };
}

/**
 * Compute fund-level returns by filtering returnsLedger entries
 * that are tagged with the given fundId.
 */
export async function computeFundReturns(
  orgId: string,
  fundId: string,
  view: ReturnView = 'levered',
  startDate?: string,
  endDate?: string
): Promise<{
  aggregate: ReturnsResponse;
  byDeal: { modelId: string; propertyId?: string; metrics: ReturnMetrics }[];
}> {
  const conditions: any[] = [
    eq(returnsLedger.orgId, orgId),
    eq(returnsLedger.fundId, fundId),
  ];
  if (startDate) conditions.push(gte(returnsLedger.asOfDate, startDate));
  if (endDate) conditions.push(lte(returnsLedger.asOfDate, endDate));

  const entries = await db
    .select()
    .from(returnsLedger)
    .where(and(...conditions))
    .orderBy(returnsLedger.asOfDate);

  // Group by model/deal
  const modelIds = [...new Set(entries.map(e => e.modelId).filter(Boolean))] as string[];

  const byDeal: { modelId: string; propertyId?: string; metrics: ReturnMetrics }[] = [];

  for (const modelId of modelIds) {
    const result = await computeModelReturns(
      { orgId, modelId, startDate, endDate },
      view
    );
    const propertyId = entries.find(e => e.modelId === modelId && e.propertyId)?.propertyId || undefined;
    byDeal.push({
      modelId,
      propertyId,
      metrics: result.metrics,
    });
  }

  // Aggregate across fund
  const aggregate = await computeModelReturns(
    { orgId, startDate, endDate },
    view
  );

  // If we have fund-specific entries, recompute with just those
  if (entries.length > 0) {
    const cashflows: { date: string; amount: number }[] = entries.map(e => ({
      date: e.asOfDate as string,
      amount: parseFloat(e.amount),
    }));

    const irr = computeXIRR(cashflows);
    const totalCashIn = cashflows.filter(cf => cf.amount < 0).reduce((s, cf) => s + Math.abs(cf.amount), 0);
    const totalCashOut = cashflows.filter(cf => cf.amount > 0).reduce((s, cf) => s + cf.amount, 0);
    const moic = totalCashIn > 0 ? totalCashOut / totalCashIn : null;

    aggregate.metrics.irr = irr !== null ? irr * 100 : null;
    aggregate.metrics.moic = moic;
  }

  return { aggregate, byDeal };
}
