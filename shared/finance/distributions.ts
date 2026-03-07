/**
 * shared/finance/distributions.ts
 * 
 * Statistical distribution helpers for Monte Carlo simulation.
 * All computation is deterministic given inputs — no side effects.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export type DistributionStats = {
  mean: number;
  median: number;
  stdDev: number;
  p5: number;
  p10: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
  p95: number;
  min: number;
  max: number;
};

export type RiskMetrics = {
  probIrrBelowHurdle: number;   // 0..1
  probMultipleBelow1: number;   // 0..1
  expectedShortfallIrrP10: number;
  expectedShortfallNpvP10: number;
};

export type DistributionConfig =
  | { type: 'normal'; mean: number; std: number; clampMin?: number; clampMax?: number }
  | { type: 'triangular'; min: number; mode: number; max: number }
  | { type: 'uniform'; min: number; max: number };

// ─── Core Statistics ─────────────────────────────────────────────────────────

export function computeStats(values: number[]): DistributionStats {
  if (values.length === 0) {
    return {
      mean: 0, median: 0, stdDev: 0,
      p5: 0, p10: 0, p25: 0, p50: 0, p75: 0, p90: 0, p95: 0,
      min: 0, max: 0,
    };
  }

  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  const mean = sorted.reduce((s, v) => s + v, 0) / n;

  const variance = sorted.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1 || 1);
  const stdDev = Math.sqrt(variance);

  return {
    mean,
    median: percentile(sorted, 50),
    stdDev,
    p5: percentile(sorted, 5),
    p10: percentile(sorted, 10),
    p25: percentile(sorted, 25),
    p50: percentile(sorted, 50),
    p75: percentile(sorted, 75),
    p90: percentile(sorted, 90),
    p95: percentile(sorted, 95),
    min: sorted[0],
    max: sorted[n - 1],
  };
}

/**
 * Percentile using linear interpolation (same as numpy default).
 * Expects a pre-sorted array.
 */
export function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0];

  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  const frac = idx - lo;

  if (lo === hi) return sorted[lo];
  return sorted[lo] * (1 - frac) + sorted[hi] * frac;
}

// ─── Risk Metrics ────────────────────────────────────────────────────────────

export function computeRiskMetrics(
  irrs: number[],
  ems: number[],
  npvs: number[],
  hurdleIRR: number
): RiskMetrics {
  const n = irrs.length || 1;

  const probIrrBelowHurdle = irrs.filter(v => v < hurdleIRR).length / n;
  const probMultipleBelow1 = ems.filter(v => v < 1.0).length / n;

  const irrSorted = [...irrs].sort((a, b) => a - b);
  const npvSorted = [...npvs].sort((a, b) => a - b);

  const irrP10 = percentile(irrSorted, 10);
  const npvP10 = percentile(npvSorted, 10);

  // Expected shortfall at P10 = mean of values below P10 threshold
  const irrBelowP10 = irrSorted.filter(v => v <= irrP10);
  const npvBelowP10 = npvSorted.filter(v => v <= npvP10);

  const expectedShortfallIrrP10 = irrBelowP10.length > 0
    ? irrBelowP10.reduce((s, v) => s + v, 0) / irrBelowP10.length
    : irrP10;

  const expectedShortfallNpvP10 = npvBelowP10.length > 0
    ? npvBelowP10.reduce((s, v) => s + v, 0) / npvBelowP10.length
    : npvP10;

  return {
    probIrrBelowHurdle,
    probMultipleBelow1,
    expectedShortfallIrrP10,
    expectedShortfallNpvP10,
  };
}

// ─── Sampling (Seeded PRNG) ──────────────────────────────────────────────────

/**
 * Mulberry32 — fast seeded 32-bit PRNG.
 * Returns a function that produces uniform [0, 1) values deterministically.
 */
export function createSeededRNG(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Sample from a distribution config using a seeded RNG.
 */
export function sampleDistribution(config: DistributionConfig, rng: () => number): number {
  let value: number;

  switch (config.type) {
    case 'uniform':
      value = config.min + rng() * (config.max - config.min);
      break;

    case 'triangular':
      value = sampleTriangular(config.min, config.mode, config.max, rng);
      break;

    case 'normal':
      value = sampleNormal(config.mean, config.std, rng);
      if (config.clampMin !== undefined) value = Math.max(value, config.clampMin);
      if (config.clampMax !== undefined) value = Math.min(value, config.clampMax);
      break;

    default:
      value = 0;
  }

  return value;
}

/** Box-Muller transform for normal sampling */
function sampleNormal(mean: number, std: number, rng: () => number): number {
  const u1 = rng();
  const u2 = rng();
  const z = Math.sqrt(-2 * Math.log(u1 || 1e-15)) * Math.cos(2 * Math.PI * u2);
  return mean + std * z;
}

/** Inverse CDF sampling for triangular distribution */
function sampleTriangular(min: number, mode: number, max: number, rng: () => number): number {
  const u = rng();
  const fc = (mode - min) / (max - min);
  if (u < fc) {
    return min + Math.sqrt(u * (max - min) * (mode - min));
  }
  return max - Math.sqrt((1 - u) * (max - min) * (max - mode));
}

// ─── Weighted Expectation ────────────────────────────────────────────────────

export function weightedAverage(values: number[], weights: number[]): number {
  const totalWeight = weights.reduce((s, w) => s + w, 0);
  if (totalWeight === 0) return 0;
  return values.reduce((s, v, i) => s + v * weights[i], 0) / totalWeight;
}
