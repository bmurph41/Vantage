import { db } from '../db';
import { modelingProjects } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { dealPricingService } from './deal-pricing-service';

interface DistributionConfig {
  type: 'normal' | 'triangular' | 'uniform' | 'lognormal' | 'pert';
  min?: number;
  max?: number;
  mean?: number;
  stdDev?: number;
  mode?: number;
}

interface SimulationVariable {
  name: string;
  key: string;
  distribution: DistributionConfig;
  baseValue: number;
  enabled: boolean;
}

interface SimulationInput {
  variables: SimulationVariable[];
  iterations: number;
  confidenceLevel: number;
  correlations?: { var1: string; var2: string; correlation: number }[];
  seed?: number;
}

interface SimulationResult {
  metric: string;
  values: number[];
  statistics: {
    mean: number;
    median: number;
    stdDev: number;
    min: number;
    max: number;
    skewness: number;
    kurtosis: number;
    percentiles: Record<string, number>;
  };
  histogram: {
    bins: number[];
    frequencies: number[];
    binWidth: number;
  };
  riskMetrics: {
    valueAtRisk: number;
    conditionalVaR: number;
    probabilityOfLoss: number;
    sharpeRatio: number;
    sortinoRatio: number;
  };
}

interface MonteCarloAnalysis {
  projectId: string;
  analysisDate: string;
  iterations: number;
  confidenceLevel: number;
  variables: SimulationVariable[];
  results: {
    irr: SimulationResult;
    npv: SimulationResult;
    equityMultiple: SimulationResult;
    cashOnCash: SimulationResult;
  };
  sensitivityRanking: {
    variable: string;
    contribution: number;
    correlationToIRR: number;
  }[];
  scenarioAnalysis: {
    optimistic: { probability: number; avgIRR: number; avgNPV: number };
    base: { probability: number; avgIRR: number; avgNPV: number };
    pessimistic: { probability: number; avgIRR: number; avgNPV: number };
  };
  executionTime: number;
  lastCalculated: string;
  usedProFormaData: boolean;
}

function createSeededRandom(seed: number): () => number {
  return function() {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function normalRandom(random: () => number, mean: number, stdDev: number): number {
  let u1 = 0, u2 = 0;
  while (u1 === 0) u1 = random();
  while (u2 === 0) u2 = random();
  const z = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  return z * stdDev + mean;
}

function triangularRandom(random: () => number, min: number, max: number, mode: number): number {
  const u = random();
  const fc = (mode - min) / (max - min);
  if (u < fc) {
    return min + Math.sqrt(u * (max - min) * (mode - min));
  } else {
    return max - Math.sqrt((1 - u) * (max - min) * (max - mode));
  }
}

function uniformRandom(random: () => number, min: number, max: number): number {
  return min + random() * (max - min);
}

function lognormalRandom(random: () => number, mean: number, stdDev: number): number {
  const variance = stdDev * stdDev;
  const mu = Math.log(mean * mean / Math.sqrt(variance + mean * mean));
  const sigma = Math.sqrt(Math.log(variance / (mean * mean) + 1));
  return Math.exp(normalRandom(random, mu, sigma));
}

function pertRandom(random: () => number, min: number, max: number, mode: number): number {
  return triangularRandom(random, min, max, mode);
}

// Cholesky decomposition for correlated sampling
function choleskyDecomposition(matrix: number[][]): number[][] {
  const n = matrix.length;
  const L: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));

  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      let sum = 0;
      for (let k = 0; k < j; k++) {
        sum += L[i][k] * L[j][k];
      }
      if (i === j) {
        const val = matrix[i][i] - sum;
        L[i][j] = val > 0 ? Math.sqrt(val) : 0;
      } else {
        L[i][j] = L[j][j] > 0 ? (matrix[i][j] - sum) / L[j][j] : 0;
      }
    }
  }
  return L;
}

// Generate correlated standard normal samples using Cholesky factor
function generateCorrelatedSamples(
  random: () => number,
  choleskyL: number[][],
  n: number
): number[] {
  // Generate independent standard normals
  const independent: number[] = [];
  for (let i = 0; i < n; i++) {
    independent.push(normalRandom(random, 0, 1));
  }
  // Multiply by Cholesky factor to introduce correlation
  const correlated: number[] = new Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      correlated[i] += choleskyL[i][j] * independent[j];
    }
  }
  return correlated;
}

// Build correlation matrix from user-specified pairs
function buildCorrelationMatrix(
  variables: string[],
  correlations: { var1: string; var2: string; correlation: number }[]
): number[][] {
  const n = variables.length;
  const matrix: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
  // Identity diagonal
  for (let i = 0; i < n; i++) matrix[i][i] = 1.0;
  // Fill in user correlations
  for (const corr of correlations) {
    const i = variables.indexOf(corr.var1);
    const j = variables.indexOf(corr.var2);
    if (i >= 0 && j >= 0 && i !== j) {
      const c = Math.max(-0.99, Math.min(0.99, corr.correlation));
      matrix[i][j] = c;
      matrix[j][i] = c;
    }
  }
  return matrix;
}

// Transform correlated standard normal to target distribution via inverse CDF mapping
function transformCorrelatedSample(
  correlatedZ: number,
  config: DistributionConfig,
  baseValue: number
): number {
  // Convert standard normal Z to uniform [0,1] via normal CDF approximation
  const u = normalCDF(correlatedZ);
  // Map uniform to target distribution via inverse CDF
  switch (config.type) {
    case 'normal': {
      const mean = config.mean ?? baseValue;
      const std = config.stdDev ?? baseValue * 0.1;
      return mean + std * correlatedZ; // direct since input is already normal
    }
    case 'triangular': {
      const min = config.min ?? baseValue * 0.8;
      const max = config.max ?? baseValue * 1.2;
      const mode = config.mode ?? baseValue;
      const fc = (mode - min) / (max - min);
      if (u < fc) return min + Math.sqrt(u * (max - min) * (mode - min));
      return max - Math.sqrt((1 - u) * (max - min) * (max - mode));
    }
    case 'uniform': {
      const min = config.min ?? baseValue * 0.8;
      const max = config.max ?? baseValue * 1.2;
      return min + u * (max - min);
    }
    case 'lognormal': {
      const mean = config.mean ?? baseValue;
      const std = config.stdDev ?? baseValue * 0.1;
      const variance = std * std;
      const mu = Math.log(mean * mean / Math.sqrt(variance + mean * mean));
      const sigma = Math.sqrt(Math.log(variance / (mean * mean) + 1));
      return Math.exp(mu + sigma * correlatedZ);
    }
    default:
      return baseValue;
  }
}

// Normal CDF approximation (Abramowitz & Stegun)
function normalCDF(x: number): number {
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741;
  const a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x) / Math.SQRT2;
  const t = 1.0 / (1.0 + p * x);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return 0.5 * (1.0 + sign * y);
}

function sampleDistribution(random: () => number, config: DistributionConfig): number {
  switch (config.type) {
    case 'normal':
      return normalRandom(random, config.mean || 0, config.stdDev || 1);
    case 'triangular':
      return triangularRandom(random, config.min || 0, config.max || 1, config.mode || (config.min! + config.max!) / 2);
    case 'uniform':
      return uniformRandom(random, config.min || 0, config.max || 1);
    case 'lognormal':
      return lognormalRandom(random, config.mean || 1, config.stdDev || 0.1);
    case 'pert':
      return pertRandom(random, config.min || 0, config.max || 1, config.mode || (config.min! + config.max!) / 2);
    default:
      return config.mean || (config.min! + config.max!) / 2;
  }
}

function calculateStatistics(values: number[]): SimulationResult['statistics'] {
  const n = values.length;
  if (n === 0) return { mean: 0, median: 0, stdDev: 0, min: 0, max: 0, skewness: 0, kurtosis: 0, percentiles: {} };
  const sorted = [...values].sort((a, b) => a - b);
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const median = n % 2 === 0 ? (sorted[n/2 - 1] + sorted[n/2]) / 2 : sorted[Math.floor(n/2)];
  const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / (n - 1);
  const stdDev = Math.sqrt(variance);
  const m3 = values.reduce((sum, v) => sum + Math.pow(v - mean, 3), 0) / n;
  const skewness = stdDev > 0 ? m3 / Math.pow(stdDev, 3) : 0;
  const m4 = values.reduce((sum, v) => sum + Math.pow(v - mean, 4), 0) / n;
  const kurtosis = stdDev > 0 ? m4 / Math.pow(stdDev, 4) - 3 : 0;
  const getPercentile = (p: number) => {
    const index = (p / 100) * (n - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const weight = index - lower;
    return sorted[lower] * (1 - weight) + (sorted[upper] || sorted[lower]) * weight;
  };
  return {
    mean, median, stdDev, min: sorted[0], max: sorted[n - 1], skewness, kurtosis,
    percentiles: { p5: getPercentile(5), p10: getPercentile(10), p25: getPercentile(25), p50: median, p75: getPercentile(75), p90: getPercentile(90), p95: getPercentile(95) },
  };
}

function calculateHistogram(values: number[], numBins: number = 20): SimulationResult['histogram'] {
  if (values.length === 0) return { bins: [], frequencies: [], binWidth: 0 };
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min;
  const binWidth = range > 0 ? range / numBins : 1;
  const bins: number[] = [];
  const frequencies: number[] = new Array(numBins).fill(0);
  for (let i = 0; i < numBins; i++) {
    bins.push(min + i * binWidth + binWidth / 2);
  }
  for (const value of values) {
    const binIndex = range > 0 ? Math.min(Math.floor((value - min) / binWidth), numBins - 1) : 0;
    frequencies[binIndex]++;
  }
  return { bins, frequencies, binWidth };
}

function calculateRiskMetrics(values: number[], confidenceLevel: number = 0.95, riskFreeRate: number = 0.04): SimulationResult['riskMetrics'] {
  if (values.length === 0) return { valueAtRisk: 0, conditionalVaR: 0, probabilityOfLoss: 0, sharpeRatio: 0, sortinoRatio: 0 };
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  const varIndex = Math.floor((1 - confidenceLevel) * n);
  const valueAtRisk = sorted[varIndex];
  const tailValues = sorted.slice(0, varIndex + 1);
  const conditionalVaR = tailValues.reduce((a, b) => a + b, 0) / tailValues.length;
  const losses = values.filter(v => v < 0);
  const probabilityOfLoss = losses.length / n;
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const stdDev = Math.sqrt(values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / (n - 1));
  const sharpeRatio = stdDev > 0 ? (mean - riskFreeRate) / stdDev : 0;
  const downsideReturns = values.filter(v => v < mean);
  const downsideDeviation = downsideReturns.length > 0
    ? Math.sqrt(downsideReturns.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / downsideReturns.length)
    : stdDev;
  const sortinoRatio = downsideDeviation > 0 ? (mean - riskFreeRate) / downsideDeviation : 0;
  return { valueAtRisk, conditionalVaR, probabilityOfLoss, sharpeRatio, sortinoRatio };
}

function calculateCorrelation(x: number[], y: number[]): number {
  const n = x.length;
  if (n === 0) return 0;
  const meanX = x.reduce((a, b) => a + b, 0) / n;
  const meanY = y.reduce((a, b) => a + b, 0) / n;
  let numerator = 0, sumX2 = 0, sumY2 = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i] - meanX;
    const dy = y[i] - meanY;
    numerator += dx * dy;
    sumX2 += dx * dx;
    sumY2 += dy * dy;
  }
  const denominator = Math.sqrt(sumX2 * sumY2);
  return denominator > 0 ? numerator / denominator : 0;
}

class MonteCarloService {
  buildDefaultVariables(
    purchasePrice: number,
    year1NOI: number,
    dealPricingInputs?: {
      exitCapRate?: number;
      holdPeriod?: number;
      targetIRR?: number;
      goingInCapRate?: number;
    }
  ): SimulationVariable[] {
    const exitCap = (dealPricingInputs?.exitCapRate || 7.5) / 100;
    const noiGrowth = 0.03;

    return [
      {
        name: 'Purchase Price',
        key: 'purchasePrice',
        baseValue: purchasePrice,
        enabled: true,
        distribution: { type: 'triangular', min: purchasePrice * 0.90, max: purchasePrice * 1.10, mode: purchasePrice },
      },
      {
        name: 'Year 1 NOI',
        key: 'year1NOI',
        baseValue: year1NOI,
        enabled: true,
        distribution: { type: 'triangular', min: year1NOI * 0.85, max: year1NOI * 1.15, mode: year1NOI },
      },
      {
        name: 'NOI Growth Rate',
        key: 'noiGrowthRate',
        baseValue: noiGrowth,
        enabled: true,
        distribution: { type: 'triangular', min: 0.00, max: 0.06, mode: noiGrowth },
      },
      {
        name: 'Exit Cap Rate',
        key: 'exitCapRate',
        baseValue: exitCap,
        enabled: true,
        distribution: { type: 'triangular', min: Math.max(0.04, exitCap - 0.02), max: exitCap + 0.02, mode: exitCap },
      },
      {
        name: 'Vacancy Rate',
        key: 'vacancyRate',
        baseValue: 0.05,
        enabled: false,
        distribution: { type: 'triangular', min: 0.02, max: 0.15, mode: 0.05 },
      },
      {
        name: 'CapEx (% of Revenue)',
        key: 'capexRate',
        baseValue: 0.03,
        enabled: false,
        distribution: { type: 'triangular', min: 0.01, max: 0.08, mode: 0.03 },
      },
    ];
  }

  async runSimulation(
    projectId: string,
    orgId: string,
    input?: Partial<SimulationInput>
  ): Promise<MonteCarloAnalysis> {
    const startTime = Date.now();

    const baseFinancials = await dealPricingService.getProjectFinancials(projectId, orgId);
    const proFormaData = await dealPricingService.getProFormaData(projectId, orgId);

    const project = await db
      .select()
      .from(modelingProjects)
      .where(and(eq(modelingProjects.id, projectId), eq(modelingProjects.orgId, orgId)))
      .limit(1);

    const customMetrics = (project[0]?.customMetrics as any) || {};
    const dealPricingInputs = customMetrics.dealPricing || {};
    const savedConfig = customMetrics.monteCarloConfig || {};

    const purchasePrice = dealPricingInputs.purchasePrice
      || (baseFinancials.purchasePrice ? Number(baseFinancials.purchasePrice) : 0)
      || 5000000;
    const year1NOI = baseFinancials.year1NOI || 500000;

    const holdPeriod = dealPricingInputs.holdPeriod || 10;
    const exitCapRatePercent = dealPricingInputs.exitCapRate || 7.5;
    const targetIRR = dealPricingInputs.targetIRR || 15;

    const defaultVars = this.buildDefaultVariables(purchasePrice, year1NOI, dealPricingInputs);
    const variables: SimulationVariable[] = input?.variables || savedConfig.variables || defaultVars;

    const iterations = input?.iterations || savedConfig.iterations || 10000;
    const confidenceLevel = input?.confidenceLevel || savedConfig.confidenceLevel || 0.95;
    const seed = input?.seed || Date.now();
    const random = createSeededRandom(seed);

    const enabledVars = variables.filter(v => v.enabled);
    const userCorrelations = input?.correlations || savedConfig.correlations || [];

    // Build correlation matrix and Cholesky factor if correlations specified
    let choleskyL: number[][] | null = null;
    const enabledKeys = enabledVars.map(v => v.key);
    if (userCorrelations.length > 0) {
      const corrMatrix = buildCorrelationMatrix(enabledKeys, userCorrelations);
      choleskyL = choleskyDecomposition(corrMatrix);
    }

    const baseInputs = {
      holdPeriod,
      exitCapRate: exitCapRatePercent,
    };
    const baseBuild = dealPricingService.buildFinancialsAndProjections(baseFinancials, proFormaData, baseInputs);
    const useProForma = proFormaData !== null;

    const irrResults: number[] = [];
    const npvResults: number[] = [];
    const emResults: number[] = [];
    const cocResults: number[] = [];
    const variableSamples: Record<string, number[]> = {};

    for (const v of enabledVars) {
      variableSamples[v.key] = [];
    }

    const discountRate = targetIRR / 100;

    for (let i = 0; i < iterations; i++) {
      const sampled: Record<string, number> = {};

      if (choleskyL && enabledVars.length > 1) {
        // Correlated sampling via Cholesky decomposition
        const correlatedZ = generateCorrelatedSamples(random, choleskyL, enabledVars.length);
        for (let vi = 0; vi < enabledVars.length; vi++) {
          const variable = enabledVars[vi];
          const sampledValue = transformCorrelatedSample(correlatedZ[vi], variable.distribution, variable.baseValue);
          variableSamples[variable.key].push(sampledValue);
          sampled[variable.key] = sampledValue;
        }
      } else {
        // Independent sampling (original behavior)
        for (const variable of enabledVars) {
          const sampledValue = sampleDistribution(random, variable.distribution);
          variableSamples[variable.key].push(sampledValue);
          sampled[variable.key] = sampledValue;
        }
      }

      const iterPurchasePrice = sampled.purchasePrice ?? purchasePrice;
      const iterYear1NOI = sampled.year1NOI ?? year1NOI;
      const iterExitCapRate = sampled.exitCapRate !== undefined ? sampled.exitCapRate * 100 : exitCapRatePercent;
      const iterNOIGrowth = sampled.noiGrowthRate ?? 0.03;
      const iterVacancy = sampled.vacancyRate ?? 0;
      const iterCapex = sampled.capexRate ?? 0;

      const adjustedNOI = iterYear1NOI * (1 - iterVacancy);

      let noiProjections: number[];
      if (useProForma && proFormaData && !sampled.noiGrowthRate && !sampled.vacancyRate) {
        noiProjections = baseBuild.noiProjections.slice(0, holdPeriod);
        if (sampled.year1NOI !== undefined) {
          const ratio = adjustedNOI / (baseBuild.financials.year1NOI || 1);
          noiProjections = noiProjections.map(n => n * ratio);
        }
      } else {
        noiProjections = dealPricingService.projectNOI(
          adjustedNOI, holdPeriod, iterNOIGrowth, Math.max(0, iterNOIGrowth - 0.01),
          baseBuild.financials.baseRevenue * (1 - iterVacancy),
          baseBuild.financials.baseExpenses
        );
      }

      if (iterCapex > 0) {
        const baseRev = baseBuild.financials.baseRevenue || adjustedNOI * 2.5;
        noiProjections = noiProjections.map((noi, yr) => {
          const yearRev = baseRev * Math.pow(1 + iterNOIGrowth, yr + 1);
          return noi - (yearRev * iterCapex);
        });
      }

      const proFormaOptions = useProForma && baseBuild.proFormaOptions ? {
        ...baseBuild.proFormaOptions,
        usedProFormaData: true,
      } : undefined;

      try {
        const result = dealPricingService.calculateFromPurchasePrice(
          iterPurchasePrice,
          adjustedNOI,
          holdPeriod,
          iterExitCapRate,
          noiProjections,
          proFormaOptions
        );

        if (isFinite(result.irr) && Math.abs(result.irr) < 500) {
          irrResults.push(result.irr);
        }

        const npvCashFlows = [-result.totalEquityInvested, ...result.cashFlowsByYear];
        const npv = dealPricingService.calculateNPV(npvCashFlows, discountRate);
        if (isFinite(npv)) {
          npvResults.push(npv);
        }

        if (isFinite(result.equityMultiple) && result.equityMultiple < 100) {
          emResults.push(result.equityMultiple);
        }
        if (isFinite(result.averageCashOnCash) && Math.abs(result.averageCashOnCash) < 500) {
          cocResults.push(result.averageCashOnCash);
        }
      } catch (e) {
      }
    }

    const buildResult = (values: number[], metric: string): SimulationResult => ({
      metric,
      values,
      statistics: calculateStatistics(values),
      histogram: calculateHistogram(values),
      riskMetrics: calculateRiskMetrics(values, confidenceLevel),
    });

    const results = {
      irr: buildResult(irrResults, 'IRR'),
      npv: buildResult(npvResults, 'NPV'),
      equityMultiple: buildResult(emResults, 'Equity Multiple'),
      cashOnCash: buildResult(cocResults, 'Cash-on-Cash'),
    };

    const sensitivityRanking = enabledVars.map(v => {
      const correlation = calculateCorrelation(variableSamples[v.key], irrResults.slice(0, variableSamples[v.key].length));
      return {
        variable: v.name,
        contribution: Math.abs(correlation) * 100,
        correlationToIRR: correlation,
      };
    }).sort((a, b) => b.contribution - a.contribution);

    const sortedIRR = [...irrResults].sort((a, b) => a - b);
    const n = sortedIRR.length;
    const optimisticThreshold = n > 0 ? sortedIRR[Math.floor(n * 0.75)] : 0;
    const pessimisticThreshold = n > 0 ? sortedIRR[Math.floor(n * 0.25)] : 0;
    const optimisticResults = irrResults.filter(v => v >= optimisticThreshold);
    const pessimisticResults = irrResults.filter(v => v < pessimisticThreshold);
    const baseResults = irrResults.filter(v => v >= pessimisticThreshold && v < optimisticThreshold);
    const avgArr = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

    const scenarioAnalysis = {
      optimistic: { probability: 0.25, avgIRR: avgArr(optimisticResults), avgNPV: results.npv.statistics.percentiles['p75'] || 0 },
      base: { probability: 0.50, avgIRR: avgArr(baseResults), avgNPV: results.npv.statistics.median },
      pessimistic: { probability: 0.25, avgIRR: avgArr(pessimisticResults), avgNPV: results.npv.statistics.percentiles['p25'] || 0 },
    };

    return {
      projectId,
      analysisDate: new Date().toISOString(),
      iterations,
      confidenceLevel,
      variables,
      results,
      sensitivityRanking,
      scenarioAnalysis,
      executionTime: Date.now() - startTime,
      lastCalculated: new Date().toISOString(),
      usedProFormaData: useProForma,
    };
  }

  async quickSimulation(
    projectId: string,
    orgId: string,
    iterations: number = 1000
  ): Promise<{
    irrMean: number;
    irrStdDev: number;
    npvMean: number;
    probabilityOfLoss: number;
  }> {
    const analysis = await this.runSimulation(projectId, orgId, { iterations });
    return {
      irrMean: analysis.results.irr.statistics.mean,
      irrStdDev: analysis.results.irr.statistics.stdDev,
      npvMean: analysis.results.npv.statistics.mean,
      probabilityOfLoss: analysis.results.npv.riskMetrics.probabilityOfLoss,
    };
  }
}

export const monteCarloService = new MonteCarloService();
