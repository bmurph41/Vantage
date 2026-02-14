export function solveXIRR(
  cashFlows: number[],
  dates: Date[],
  guess: number = 0.1,
): number {
  if (cashFlows.length < 2 || cashFlows.length !== dates.length) return 0;
  const hasPositive = cashFlows.some(v => v > 0);
  const hasNegative = cashFlows.some(v => v < 0);
  if (!hasPositive || !hasNegative) return 0;

  const d0 = dates[0].getTime();
  const yearFracs = dates.map(d => (d.getTime() - d0) / (365.25 * 24 * 60 * 60 * 1000));

  let rate = guess;
  for (let iter = 0; iter < 300; iter++) {
    let npv = 0;
    let dnpv = 0;
    for (let t = 0; t < cashFlows.length; t++) {
      const disc = Math.pow(1 + rate, yearFracs[t]);
      if (disc === 0 || !isFinite(disc)) break;
      npv += cashFlows[t] / disc;
      dnpv -= yearFracs[t] * cashFlows[t] / (disc * (1 + rate));
    }
    if (Math.abs(npv) < 0.01) break;
    if (Math.abs(dnpv) < 1e-10) break;
    const newRate = rate - npv / dnpv;
    if (newRate < -0.99) rate = -0.99;
    else if (newRate > 10) rate = 10;
    else rate = newRate;
  }
  return isFinite(rate) ? rate : 0;
}

export function calcNPV(cashFlows: number[], discountRate: number): number {
  let npv = 0;
  for (let t = 0; t < cashFlows.length; t++) {
    npv += cashFlows[t] / Math.pow(1 + discountRate, t);
  }
  return npv;
}

export function calcNPVDated(
  cashFlows: number[],
  dates: Date[],
  discountRate: number,
): number {
  if (cashFlows.length !== dates.length || cashFlows.length === 0) return 0;
  const d0 = dates[0].getTime();
  let npv = 0;
  for (let t = 0; t < cashFlows.length; t++) {
    const yearFrac = (dates[t].getTime() - d0) / (365.25 * 24 * 60 * 60 * 1000);
    npv += cashFlows[t] / Math.pow(1 + discountRate, yearFrac);
  }
  return npv;
}

export type DistributionType = 'normal' | 'triangular' | 'lognormal' | 'uniform';

export interface MonteCarloInput {
  distribution: DistributionType;
  mean: number;
  stdDev: number;
  min?: number;
  max?: number;
  mode?: number;
}

function boxMullerNormal(): number {
  let u1 = 0, u2 = 0;
  while (u1 === 0) u1 = Math.random();
  while (u2 === 0) u2 = Math.random();
  return Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
}

function sampleDistribution(input: MonteCarloInput): number {
  switch (input.distribution) {
    case 'normal': {
      return input.mean + input.stdDev * boxMullerNormal();
    }
    case 'lognormal': {
      const mu = Math.log(input.mean * input.mean / Math.sqrt(input.stdDev * input.stdDev + input.mean * input.mean));
      const sigma = Math.sqrt(Math.log(1 + (input.stdDev * input.stdDev) / (input.mean * input.mean)));
      return Math.exp(mu + sigma * boxMullerNormal());
    }
    case 'triangular': {
      const a = input.min ?? (input.mean - input.stdDev * 1.732);
      const b = input.max ?? (input.mean + input.stdDev * 1.732);
      const c = input.mode ?? input.mean;
      const u = Math.random();
      const fc = (c - a) / (b - a);
      if (u < fc) return a + Math.sqrt(u * (b - a) * (c - a));
      return b - Math.sqrt((1 - u) * (b - a) * (b - c));
    }
    case 'uniform': {
      const lo = input.min ?? (input.mean - input.stdDev * 1.732);
      const hi = input.max ?? (input.mean + input.stdDev * 1.732);
      return lo + Math.random() * (hi - lo);
    }
    default:
      return input.mean;
  }
}

export interface MonteCarloResult {
  mean: number;
  median: number;
  stdDev: number;
  p10: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
  min: number;
  max: number;
  samples: number[];
  histogram: { binStart: number; binEnd: number; count: number }[];
}

export function runMonteCarlo(
  simulate: (samples: Record<string, number>) => number,
  inputs: Record<string, MonteCarloInput>,
  iterations: number = 5000,
): MonteCarloResult {
  const results: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const samples: Record<string, number> = {};
    for (const [key, input] of Object.entries(inputs)) {
      samples[key] = sampleDistribution(input);
    }
    results.push(simulate(samples));
  }
  results.sort((a, b) => a - b);

  const n = results.length;
  const mean = results.reduce((s, v) => s + v, 0) / n;
  const variance = results.reduce((s, v) => s + (v - mean) ** 2, 0) / n;
  const stdDev = Math.sqrt(variance);

  const percentile = (p: number) => {
    const idx = Math.floor(p * n);
    return results[Math.min(idx, n - 1)];
  };

  const minVal = results[0];
  const maxVal = results[n - 1];
  const binCount = 20;
  const binWidth = (maxVal - minVal) / binCount || 1;
  const histogram: MonteCarloResult['histogram'] = [];
  for (let b = 0; b < binCount; b++) {
    const binStart = minVal + b * binWidth;
    const binEnd = binStart + binWidth;
    const count = results.filter(v => v >= binStart && (b === binCount - 1 ? v <= binEnd : v < binEnd)).length;
    histogram.push({ binStart, binEnd, count });
  }

  return {
    mean,
    median: percentile(0.5),
    stdDev,
    p10: percentile(0.1),
    p25: percentile(0.25),
    p50: percentile(0.5),
    p75: percentile(0.75),
    p90: percentile(0.9),
    min: minVal,
    max: maxVal,
    samples: results,
    histogram,
  };
}

export interface CorrelationPair {
  varA: string;
  varB: string;
  correlation: number;
}

export function applyCorrelation(
  baseValues: Record<string, number>,
  means: Record<string, number>,
  stdDevs: Record<string, number>,
  correlations: CorrelationPair[],
): Record<string, number> {
  const adjusted = { ...baseValues };
  for (const corr of correlations) {
    if (corr.varA in adjusted && corr.varB in adjusted) {
      const zA = stdDevs[corr.varA] > 0 ? (adjusted[corr.varA] - means[corr.varA]) / stdDevs[corr.varA] : 0;
      const zB = stdDevs[corr.varB] > 0 ? (adjusted[corr.varB] - means[corr.varB]) / stdDevs[corr.varB] : 0;
      const adjustedZB = corr.correlation * zA + Math.sqrt(1 - corr.correlation ** 2) * zB;
      adjusted[corr.varB] = means[corr.varB] + adjustedZB * stdDevs[corr.varB];
    }
  }
  return adjusted;
}

export interface ScenarioBranch {
  name: string;
  probability: number;
  assumptions: Record<string, number>;
  children?: ScenarioBranch[];
}

export function computeExpectedValue(
  branches: ScenarioBranch[],
  evaluate: (assumptions: Record<string, number>) => number,
): { expected: number; branchResults: { name: string; probability: number; value: number }[] } {
  const branchResults: { name: string; probability: number; value: number }[] = [];
  let expected = 0;
  for (const branch of branches) {
    const value = evaluate(branch.assumptions);
    expected += value * branch.probability;
    branchResults.push({ name: branch.name, probability: branch.probability, value });
  }
  return { expected, branchResults };
}

export const STATE_CAPITAL_GAINS_RATES: Record<string, { name: string; rate: number; hasNoIncomeTax: boolean }> = {
  AL: { name: 'Alabama', rate: 5.0, hasNoIncomeTax: false },
  AK: { name: 'Alaska', rate: 0, hasNoIncomeTax: true },
  AZ: { name: 'Arizona', rate: 2.5, hasNoIncomeTax: false },
  AR: { name: 'Arkansas', rate: 4.4, hasNoIncomeTax: false },
  CA: { name: 'California', rate: 13.3, hasNoIncomeTax: false },
  CO: { name: 'Colorado', rate: 4.4, hasNoIncomeTax: false },
  CT: { name: 'Connecticut', rate: 6.99, hasNoIncomeTax: false },
  DE: { name: 'Delaware', rate: 6.6, hasNoIncomeTax: false },
  FL: { name: 'Florida', rate: 0, hasNoIncomeTax: true },
  GA: { name: 'Georgia', rate: 5.49, hasNoIncomeTax: false },
  HI: { name: 'Hawaii', rate: 7.25, hasNoIncomeTax: false },
  ID: { name: 'Idaho', rate: 5.8, hasNoIncomeTax: false },
  IL: { name: 'Illinois', rate: 4.95, hasNoIncomeTax: false },
  IN: { name: 'Indiana', rate: 3.05, hasNoIncomeTax: false },
  IA: { name: 'Iowa', rate: 5.7, hasNoIncomeTax: false },
  KS: { name: 'Kansas', rate: 5.7, hasNoIncomeTax: false },
  KY: { name: 'Kentucky', rate: 4.0, hasNoIncomeTax: false },
  LA: { name: 'Louisiana', rate: 4.25, hasNoIncomeTax: false },
  ME: { name: 'Maine', rate: 7.15, hasNoIncomeTax: false },
  MD: { name: 'Maryland', rate: 5.75, hasNoIncomeTax: false },
  MA: { name: 'Massachusetts', rate: 9.0, hasNoIncomeTax: false },
  MI: { name: 'Michigan', rate: 4.25, hasNoIncomeTax: false },
  MN: { name: 'Minnesota', rate: 9.85, hasNoIncomeTax: false },
  MS: { name: 'Mississippi', rate: 5.0, hasNoIncomeTax: false },
  MO: { name: 'Missouri', rate: 4.95, hasNoIncomeTax: false },
  MT: { name: 'Montana', rate: 6.75, hasNoIncomeTax: false },
  NE: { name: 'Nebraska', rate: 6.64, hasNoIncomeTax: false },
  NV: { name: 'Nevada', rate: 0, hasNoIncomeTax: true },
  NH: { name: 'New Hampshire', rate: 4.0, hasNoIncomeTax: false },
  NJ: { name: 'New Jersey', rate: 10.75, hasNoIncomeTax: false },
  NM: { name: 'New Mexico', rate: 5.9, hasNoIncomeTax: false },
  NY: { name: 'New York', rate: 10.9, hasNoIncomeTax: false },
  NC: { name: 'North Carolina', rate: 4.5, hasNoIncomeTax: false },
  ND: { name: 'North Dakota', rate: 2.5, hasNoIncomeTax: false },
  OH: { name: 'Ohio', rate: 3.5, hasNoIncomeTax: false },
  OK: { name: 'Oklahoma', rate: 4.75, hasNoIncomeTax: false },
  OR: { name: 'Oregon', rate: 9.9, hasNoIncomeTax: false },
  PA: { name: 'Pennsylvania', rate: 3.07, hasNoIncomeTax: false },
  RI: { name: 'Rhode Island', rate: 5.99, hasNoIncomeTax: false },
  SC: { name: 'South Carolina', rate: 6.4, hasNoIncomeTax: false },
  SD: { name: 'South Dakota', rate: 0, hasNoIncomeTax: true },
  TN: { name: 'Tennessee', rate: 0, hasNoIncomeTax: true },
  TX: { name: 'Texas', rate: 0, hasNoIncomeTax: true },
  UT: { name: 'Utah', rate: 4.65, hasNoIncomeTax: false },
  VT: { name: 'Vermont', rate: 8.75, hasNoIncomeTax: false },
  VA: { name: 'Virginia', rate: 5.75, hasNoIncomeTax: false },
  WA: { name: 'Washington', rate: 7.0, hasNoIncomeTax: false },
  WV: { name: 'West Virginia', rate: 6.5, hasNoIncomeTax: false },
  WI: { name: 'Wisconsin', rate: 7.65, hasNoIncomeTax: false },
  WY: { name: 'Wyoming', rate: 0, hasNoIncomeTax: true },
};

export function estimateAMT(
  adjustedGrossIncome: number,
  capitalGains: number,
  filingStatus: 'single' | 'married' = 'married',
): { amtExposure: number; amtExemption: number; tentativeMinTax: number; regularTax: number; amtOwed: number } {
  const exemption2025 = filingStatus === 'married' ? 133_300 : 85_700;
  const phaseoutStart = filingStatus === 'married' ? 1_218_700 : 609_350;
  const phaseoutReduction = Math.max(0, adjustedGrossIncome - phaseoutStart) * 0.25;
  const amtExemption = Math.max(0, exemption2025 - phaseoutReduction);

  const amti = adjustedGrossIncome + capitalGains * 0.10;
  const taxableAMTI = Math.max(0, amti - amtExemption);

  const amtRate1 = 0.26;
  const amtRate2 = 0.28;
  const amtBracket = filingStatus === 'married' ? 232_600 : 232_600;

  let tentativeMinTax = 0;
  if (taxableAMTI <= amtBracket) {
    tentativeMinTax = taxableAMTI * amtRate1;
  } else {
    tentativeMinTax = amtBracket * amtRate1 + (taxableAMTI - amtBracket) * amtRate2;
  }

  const regularTax = capitalGains * 0.20 + Math.max(0, adjustedGrossIncome - capitalGains) * 0.35;
  const amtOwed = Math.max(0, tentativeMinTax - regularTax);

  return {
    amtExposure: tentativeMinTax,
    amtExemption,
    tentativeMinTax,
    regularTax,
    amtOwed,
  };
}

export function calcPrepaymentCurve(
  loanBalance: number,
  annualRate: number,
  termMonths: number,
  psaSpeed: number = 100,
): { month: number; smm: number; prepayment: number; scheduledPrincipal: number; endingBalance: number }[] {
  const schedule: { month: number; smm: number; prepayment: number; scheduledPrincipal: number; endingBalance: number }[] = [];
  let balance = loanBalance;
  const monthlyRate = annualRate / 12;

  for (let m = 1; m <= termMonths && balance > 0.01; m++) {
    const cpr = Math.min(m / 30, 1) * 0.06 * (psaSpeed / 100);
    const smm = 1 - Math.pow(1 - cpr, 1 / 12);

    const pmt = monthlyRate > 0
      ? balance * (monthlyRate * Math.pow(1 + monthlyRate, termMonths - m + 1)) / (Math.pow(1 + monthlyRate, termMonths - m + 1) - 1)
      : balance / (termMonths - m + 1);
    const interest = balance * monthlyRate;
    const scheduledPrincipal = Math.min(pmt - interest, balance);
    const prepayment = (balance - scheduledPrincipal) * smm;
    const endingBalance = Math.max(0, balance - scheduledPrincipal - prepayment);

    schedule.push({ month: m, smm, prepayment, scheduledPrincipal, endingBalance });
    balance = endingBalance;
  }

  return schedule;
}
