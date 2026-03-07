/**
 * server/services/dcf-simulation-service.ts
 * 
 * Layer 3 — Monte Carlo simulation.
 * Runs N iterations with sampled parameter overrides on canonical
 * Multi-Year Projection Engine output.
 * 
 * Two modes:
 *   - 'fast': Scale base cash flows with deltas (default, < 2s for N=2000)
 *   - 'exact': Full regen per iteration (N <= 500)
 */

import {
  calculateXIRR,
  calculateNPV,
  calculateEquityMultiple,
  DatedCashFlow,
} from '../../shared/finance/xirr';

import {
  DistributionStats,
  DistributionConfig,
  RiskMetrics,
  computeStats,
  computeRiskMetrics,
  createSeededRNG,
  sampleDistribution,
} from '../../shared/finance/distributions';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface MonteCarloRequest {
  projectId: string;
  orgId: string;
  scenarioVersionId?: string;
  n?: number;                                    // default 2000
  seed?: number;                                 // for determinism
  mode?: 'fast' | 'exact';                       // default 'fast'
  distributions?: Partial<MonteCarloDistributions>;
  hurdleIRR?: number;                            // percent, default 12
  discountRate?: number;                         // percent, default 10
}

export interface MonteCarloDistributions {
  revenueGrowthRateDelta: DistributionConfig;
  exitCapRateDelta: DistributionConfig;
  saleCostRateDelta: DistributionConfig;
  purchasePriceDelta: DistributionConfig;        // as pct of purchase price
}

export interface MonteCarloResult {
  n: number;
  seed: number;
  mode: 'fast' | 'exact';
  stats: {
    irr: DistributionStats;
    equityMultiple: DistributionStats;
    npv: DistributionStats;
  };
  risks: RiskMetrics;
  samplesPreview: Array<{ irr: number; equityMultiple: number; npv: number }>;
  inputs: MonteCarloDistributions;
  computeTimeMs: number;
}

// ─── Default Distributions ───────────────────────────────────────────────────

export const DEFAULT_DISTRIBUTIONS: MonteCarloDistributions = {
  revenueGrowthRateDelta: {
    type: 'triangular',
    min: -2.0,
    mode: 0.0,
    max: 2.0,
  },
  exitCapRateDelta: {
    type: 'normal',
    mean: 0.0,
    std: 0.35,
    clampMin: -0.75,
    clampMax: 1.25,
  },
  saleCostRateDelta: {
    type: 'uniform',
    min: -0.50,
    max: 0.50,
  },
  purchasePriceDelta: {
    type: 'normal',
    mean: 0.0,
    std: 2.0,
    clampMin: -7.0,
    clampMax: 7.0,
  },
};

// ─── Monte Carlo Runner ──────────────────────────────────────────────────────

export function runMonteCarlo(
  year1: any,
  computeMultiYearProjection: (y1: any, config: any) => any,
  baseConfig: {
    holdPeriod: number;
    revenueGrowthRate: number;    // decimal
    expenseGrowthRate: number;    // decimal
    exitCapRate: number;          // decimal
    sellingCostPct: number;       // decimal
  },
  equity: {
    equityInvested: number;
    acquisitionDate: string;
    annualDebtService: number[];
    debtBalanceAtExit: number;
    purchasePrice: number;
  },
  request: MonteCarloRequest
): MonteCarloResult {
  const start = Date.now();
  const n = Math.min(Math.max(request.n ?? 2000, 200), 10000);
  const seed = request.seed ?? Date.now();
  const mode = request.mode ?? 'fast';
  const hurdleIRR = request.hurdleIRR ?? 12;
  const discountRate = request.discountRate ?? 10;

  const dists: MonteCarloDistributions = {
    ...DEFAULT_DISTRIBUTIONS,
    ...request.distributions,
  };

  const rng = createSeededRNG(seed);

  // Pre-compute base projection for 'fast' mode
  let baseProjection: any = null;
  if (mode === 'fast') {
    baseProjection = computeMultiYearProjection(year1, {
      holdPeriod: baseConfig.holdPeriod,
      revenueGrowthRate: baseConfig.revenueGrowthRate,
      expenseGrowthRate: baseConfig.expenseGrowthRate,
      exitCapRate: baseConfig.exitCapRate,
      sellingCostPct: baseConfig.sellingCostPct,
    });
  }

  const irrs: number[] = [];
  const ems: number[] = [];
  const npvs: number[] = [];
  const samples: Array<{ irr: number; equityMultiple: number; npv: number }> = [];

  for (let i = 0; i < n; i++) {
    // Sample deltas
    const growthDelta = sampleDistribution(dists.revenueGrowthRateDelta, rng);
    const exitCapDelta = sampleDistribution(dists.exitCapRateDelta, rng);
    const saleCostDelta = sampleDistribution(dists.saleCostRateDelta, rng);
    const priceDelta = sampleDistribution(dists.purchasePriceDelta, rng);

    let flows: DatedCashFlow[];

    if (mode === 'exact') {
      // Full regen per iteration
      flows = runExactIteration(
        year1, computeMultiYearProjection, baseConfig, equity,
        growthDelta, exitCapDelta, saleCostDelta, priceDelta
      );
    } else {
      // Fast: transform base projection
      flows = runFastIteration(
        baseProjection, baseConfig, equity,
        growthDelta, exitCapDelta, saleCostDelta, priceDelta
      );
    }

    const xirrResult = calculateXIRR(flows);
    const npv = calculateNPV(flows, discountRate);
    const em = calculateEquityMultiple(flows);

    irrs.push(xirrResult.irr);
    ems.push(em);
    npvs.push(npv);

    if (i < 50) {
      samples.push({ irr: xirrResult.irr, equityMultiple: em, npv });
    }
  }

  return {
    n,
    seed,
    mode,
    stats: {
      irr: computeStats(irrs),
      equityMultiple: computeStats(ems),
      npv: computeStats(npvs),
    },
    risks: computeRiskMetrics(irrs, ems, npvs, hurdleIRR),
    samplesPreview: samples,
    inputs: dists,
    computeTimeMs: Date.now() - start,
  };
}

// ─── Exact Mode: Full regen per iteration ────────────────────────────────────

function runExactIteration(
  year1: any,
  computeMultiYearProjection: (y1: any, config: any) => any,
  baseConfig: any,
  equity: any,
  growthDelta: number,
  exitCapDelta: number,
  saleCostDelta: number,
  priceDelta: number,
): DatedCashFlow[] {
  const growth = baseConfig.revenueGrowthRate + growthDelta / 100;
  const exitCap = Math.max(baseConfig.exitCapRate + exitCapDelta / 100, 0.01);
  const sellCost = Math.max(baseConfig.sellingCostPct + saleCostDelta / 100, 0);
  const priceMultiplier = 1 + priceDelta / 100;
  const adjPrice = equity.purchasePrice * priceMultiplier;
  const adjEquity = adjPrice - (equity.purchasePrice - equity.equityInvested);

  const proj = computeMultiYearProjection(year1, {
    holdPeriod: baseConfig.holdPeriod,
    revenueGrowthRate: growth,
    expenseGrowthRate: baseConfig.expenseGrowthRate,
    exitCapRate: exitCap,
    sellingCostPct: sellCost,
  });

  return buildFlows(
    equity.acquisitionDate,
    adjEquity,
    proj.years,
    equity.annualDebtService,
    proj.exit,
    equity.debtBalanceAtExit
  );
}

// ─── Fast Mode: Transform base projection ────────────────────────────────────

function runFastIteration(
  baseProjection: any,
  baseConfig: any,
  equity: any,
  growthDelta: number,
  exitCapDelta: number,
  saleCostDelta: number,
  priceDelta: number,
): DatedCashFlow[] {
  const priceMultiplier = 1 + priceDelta / 100;
  const adjPrice = equity.purchasePrice * priceMultiplier;
  const adjEquity = adjPrice - (equity.purchasePrice - equity.equityInvested);

  // Apply growth delta as cumulative scalar on NCF
  const growthScalar = growthDelta / 100; // e.g. +0.01 for +1% delta
  const adjustedYears = baseProjection.years.map((y: any) => {
    const cumulativeAdj = Math.pow(1 + growthScalar, y.year - 1);
    return {
      year: y.year,
      ncf: y.ncf * cumulativeAdj,
      noi: y.noi * cumulativeAdj,
    };
  });

  // Recalculate exit with adjusted exit cap and final year NOI
  const finalNOI = adjustedYears[adjustedYears.length - 1]?.noi ?? baseProjection.exit.exitNOI;
  const adjExitCap = Math.max(baseConfig.exitCapRate + exitCapDelta / 100, 0.01);
  const adjSellCost = Math.max(baseConfig.sellingCostPct + saleCostDelta / 100, 0);
  const exitValue = finalNOI / adjExitCap;
  const sellingCosts = exitValue * adjSellCost;
  const netSaleProceeds = exitValue - sellingCosts;

  return buildFlows(
    equity.acquisitionDate,
    adjEquity,
    adjustedYears,
    equity.annualDebtService,
    { netSaleProceeds },
    equity.debtBalanceAtExit
  );
}

// ─── Shared Flow Builder ─────────────────────────────────────────────────────

function buildFlows(
  acquisitionDate: string,
  equityInvested: number,
  years: Array<{ year: number; ncf: number }>,
  annualDS: number[],
  exit: { netSaleProceeds: number },
  debtPayoff: number
): DatedCashFlow[] {
  const flows: DatedCashFlow[] = [
    { date: acquisitionDate, amount: -Math.abs(equityInvested) },
  ];

  for (let i = 0; i < years.length; i++) {
    const ds = annualDS[i] ?? 0;
    const levered = years[i].ncf - ds;
    const isLast = i === years.length - 1;
    const exitAmt = isLast ? (exit.netSaleProceeds - debtPayoff) : 0;
    const d = new Date(acquisitionDate);
    d.setFullYear(d.getFullYear() + years[i].year);

    flows.push({
      date: d.toISOString().split('T')[0],
      amount: levered + exitAmt,
    });
  }

  return flows;
}
