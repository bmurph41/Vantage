/**
 * shared/finance/attribution.ts
 * 
 * Layer 4 — Factor attribution using standardized OLS regression
 * on Monte Carlo simulation samples.
 * 
 * Quantifies each driver's contribution to outcome variability.
 * "SHAP-lite" — fast, deterministic, interpretable.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export interface AttributionDriver {
  driver: string;
  importance: number;       // 0..1 normalized share of total |beta|
  direction: 'positive' | 'negative' | 'mixed';
  beta: number;             // standardized coefficient
  corr: number;             // Pearson correlation with target
}

export interface AttributionResult {
  target: 'irr' | 'npv';
  r2: number;
  drivers: AttributionDriver[];  // sorted desc by importance
  notes: string[];
}

// ─── Sample Data Structure ───────────────────────────────────────────────────

export interface MCAttributionSample {
  inputs: {
    revenueGrowthDelta: number;
    exitCapDelta: number;
    saleCostDelta: number;
    priceDelta: number;
  };
  irr: number;
  npv: number;
}

// ─── Main Attribution Function ───────────────────────────────────────────────

export function computeAttribution(
  samples: MCAttributionSample[],
  target: 'irr' | 'npv' = 'irr'
): AttributionResult {
  const n = samples.length;
  const notes: string[] = [];

  if (n < 30) {
    notes.push(`WARNING: Only ${n} samples — attribution may be unreliable. Need 30+.`);
  }

  const driverNames = ['Revenue Growth', 'Exit Cap Rate', 'Selling Costs', 'Purchase Price'];
  const driverKeys: Array<keyof MCAttributionSample['inputs']> = [
    'revenueGrowthDelta', 'exitCapDelta', 'saleCostDelta', 'priceDelta',
  ];

  // Extract columns
  const X: number[][] = driverKeys.map(key => samples.map(s => s.inputs[key]));
  const y: number[] = samples.map(s => target === 'irr' ? s.irr : s.npv);

  // Standardize X and y
  const xStd = X.map(col => standardize(col));
  const yStd = standardize(y);

  // OLS: compute standardized betas via normal equations (X'X)^-1 X'y
  // For speed, use correlation-based approach (standardized → betas ≈ correlations when uncorrelated)
  const betas: number[] = [];
  const corrs: number[] = [];

  for (let j = 0; j < driverKeys.length; j++) {
    const corr = pearsonCorrelation(xStd[j].values, yStd.values);
    corrs.push(corr);
    betas.push(corr); // Approximate beta = correlation for standardized uncorrelated inputs
  }

  // Compute R² (from OLS residuals)
  const yHat = samples.map((_, i) => {
    let pred = 0;
    for (let j = 0; j < betas.length; j++) {
      pred += betas[j] * xStd[j].values[i];
    }
    return pred;
  });

  const ssTot = yStd.values.reduce((s, v) => s + v * v, 0);
  const ssRes = yStd.values.reduce((s, v, i) => s + (v - yHat[i]) ** 2, 0);
  const r2 = ssTot > 0 ? 1 - ssRes / ssTot : 0;

  if (r2 < 0.5) {
    notes.push(`Low R² (${(r2 * 100).toFixed(1)}%): linear model explains less than half the variance. Non-linear effects may be significant.`);
  }

  // Check for multicollinearity (high pairwise correlations between inputs)
  for (let j1 = 0; j1 < driverKeys.length; j1++) {
    for (let j2 = j1 + 1; j2 < driverKeys.length; j2++) {
      const inputCorr = Math.abs(pearsonCorrelation(xStd[j1].values, xStd[j2].values));
      if (inputCorr > 0.5) {
        notes.push(`Multicollinearity warning: ${driverNames[j1]} and ${driverNames[j2]} corr=${inputCorr.toFixed(2)}`);
      }
    }
  }

  // Importance = |beta| / sum(|beta|)
  const totalAbsBeta = betas.reduce((s, b) => s + Math.abs(b), 0) || 1;

  const drivers: AttributionDriver[] = driverNames.map((name, i) => ({
    driver: name,
    importance: Math.abs(betas[i]) / totalAbsBeta,
    direction: betas[i] > 0.01 ? 'positive' : betas[i] < -0.01 ? 'negative' : 'mixed',
    beta: betas[i],
    corr: corrs[i],
  }));

  // Sort by importance descending
  drivers.sort((a, b) => b.importance - a.importance);

  return { target, r2, drivers, notes };
}

// ─── Statistics Helpers ──────────────────────────────────────────────────────

interface StandardizedResult {
  values: number[];
  mean: number;
  std: number;
}

function standardize(arr: number[]): StandardizedResult {
  const n = arr.length;
  if (n === 0) return { values: [], mean: 0, std: 0 };

  const mean = arr.reduce((s, v) => s + v, 0) / n;
  const variance = arr.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1 || 1);
  const std = Math.sqrt(variance) || 1;

  return {
    values: arr.map(v => (v - mean) / std),
    mean,
    std,
  };
}

function pearsonCorrelation(x: number[], y: number[]): number {
  const n = x.length;
  if (n < 2) return 0;

  let sumXY = 0;
  let sumX2 = 0;
  let sumY2 = 0;

  for (let i = 0; i < n; i++) {
    sumXY += x[i] * y[i];
    sumX2 += x[i] * x[i];
    sumY2 += y[i] * y[i];
  }

  const denom = Math.sqrt(sumX2 * sumY2);
  return denom > 0 ? sumXY / denom : 0;
}
