export interface SensitivityVariable {
  name: string;
  baseValue: number;
  minValue: number;
  maxValue: number;
  steps: number;
  unit: 'percent' | 'currency' | 'years' | 'ratio';
}

export interface SensitivityResult {
  variable1Values: number[];
  variable2Values?: number[];
  outcomes: number[][];
  baseOutcome: number;
  minOutcome: number;
  maxOutcome: number;
  sensitivity: number;
}

export interface ScenarioComparison {
  scenarioName: string;
  netProceeds: number;
  taxLiability: number;
  afterTaxProceeds: number;
  irr: number;
  moic: number;
  holdingPeriod: number;
  riskScore: number;
}

export function generateSensitivityRange(
  baseValue: number,
  minValue: number,
  maxValue: number,
  steps: number
): number[] {
  const range: number[] = [];
  const stepSize = (maxValue - minValue) / (steps - 1);
  
  for (let i = 0; i < steps; i++) {
    range.push(minValue + (stepSize * i));
  }
  
  return range;
}

export function runOneDimensionalSensitivity(
  variable: SensitivityVariable,
  calculateOutcome: (value: number) => number
): SensitivityResult {
  const values = generateSensitivityRange(
    variable.baseValue,
    variable.minValue,
    variable.maxValue,
    variable.steps
  );
  
  const outcomes = values.map(v => [calculateOutcome(v)]);
  const flatOutcomes = outcomes.flat();
  const baseOutcome = calculateOutcome(variable.baseValue);
  
  return {
    variable1Values: values,
    outcomes,
    baseOutcome,
    minOutcome: Math.min(...flatOutcomes),
    maxOutcome: Math.max(...flatOutcomes),
    sensitivity: calculateSensitivityCoefficient(values, flatOutcomes),
  };
}

export function runTwoDimensionalSensitivity(
  variable1: SensitivityVariable,
  variable2: SensitivityVariable,
  calculateOutcome: (value1: number, value2: number) => number
): SensitivityResult {
  const values1 = generateSensitivityRange(
    variable1.baseValue,
    variable1.minValue,
    variable1.maxValue,
    variable1.steps
  );
  
  const values2 = generateSensitivityRange(
    variable2.baseValue,
    variable2.minValue,
    variable2.maxValue,
    variable2.steps
  );
  
  const outcomes: number[][] = [];
  let minOutcome = Infinity;
  let maxOutcome = -Infinity;
  
  for (const v1 of values1) {
    const row: number[] = [];
    for (const v2 of values2) {
      const outcome = calculateOutcome(v1, v2);
      row.push(outcome);
      minOutcome = Math.min(minOutcome, outcome);
      maxOutcome = Math.max(maxOutcome, outcome);
    }
    outcomes.push(row);
  }
  
  const baseOutcome = calculateOutcome(variable1.baseValue, variable2.baseValue);
  
  return {
    variable1Values: values1,
    variable2Values: values2,
    outcomes,
    baseOutcome,
    minOutcome,
    maxOutcome,
    sensitivity: (maxOutcome - minOutcome) / baseOutcome,
  };
}

export function calculateSensitivityCoefficient(
  inputs: number[],
  outputs: number[]
): number {
  if (inputs.length !== outputs.length || inputs.length < 2) return 0;
  
  const n = inputs.length;
  const meanX = inputs.reduce((a, b) => a + b, 0) / n;
  const meanY = outputs.reduce((a, b) => a + b, 0) / n;
  
  let numerator = 0;
  let denominator = 0;
  
  for (let i = 0; i < n; i++) {
    numerator += (inputs[i] - meanX) * (outputs[i] - meanY);
    denominator += Math.pow(inputs[i] - meanX, 2);
  }
  
  if (denominator === 0) return 0;
  
  const slope = numerator / denominator;
  return (slope * meanX) / meanY;
}

export interface TornadoChartData {
  variable: string;
  lowValue: number;
  highValue: number;
  baseValue: number;
  lowOutcome: number;
  highOutcome: number;
  baseOutcome: number;
  spread: number;
}

export function generateTornadoChart(
  variables: SensitivityVariable[],
  calculateOutcome: (values: Record<string, number>) => number,
  baseValues: Record<string, number>
): TornadoChartData[] {
  const baseOutcome = calculateOutcome(baseValues);
  const results: TornadoChartData[] = [];
  
  for (const variable of variables) {
    const lowValues = { ...baseValues, [variable.name]: variable.minValue };
    const highValues = { ...baseValues, [variable.name]: variable.maxValue };
    
    const lowOutcome = calculateOutcome(lowValues);
    const highOutcome = calculateOutcome(highValues);
    
    results.push({
      variable: variable.name,
      lowValue: variable.minValue,
      highValue: variable.maxValue,
      baseValue: variable.baseValue,
      lowOutcome,
      highOutcome,
      baseOutcome,
      spread: Math.abs(highOutcome - lowOutcome),
    });
  }
  
  return results.sort((a, b) => b.spread - a.spread);
}

export function compareScenarios(
  scenarios: ScenarioComparison[]
): {
  bestByNetProceeds: ScenarioComparison;
  bestByIrr: ScenarioComparison;
  bestByRiskAdjusted: ScenarioComparison;
  rankings: Array<{ scenario: ScenarioComparison; score: number }>;
} {
  const bestByNetProceeds = [...scenarios].sort((a, b) => b.afterTaxProceeds - a.afterTaxProceeds)[0];
  const bestByIrr = [...scenarios].sort((a, b) => b.irr - a.irr)[0];
  
  const rankings = scenarios.map(scenario => {
    const returnScore = scenario.irr * 100;
    const riskPenalty = scenario.riskScore * 10;
    const score = returnScore - riskPenalty;
    return { scenario, score };
  }).sort((a, b) => b.score - a.score);
  
  const bestByRiskAdjusted = rankings[0].scenario;
  
  return {
    bestByNetProceeds,
    bestByIrr,
    bestByRiskAdjusted,
    rankings,
  };
}

export function calculateBreakeven(
  variable: SensitivityVariable,
  targetOutcome: number,
  calculateOutcome: (value: number) => number,
  tolerance: number = 0.001,
  maxIterations: number = 100
): number | null {
  let low = variable.minValue;
  let high = variable.maxValue;
  
  const lowOutcome = calculateOutcome(low);
  const highOutcome = calculateOutcome(high);
  
  if ((lowOutcome < targetOutcome && highOutcome < targetOutcome) ||
      (lowOutcome > targetOutcome && highOutcome > targetOutcome)) {
    return null;
  }
  
  for (let i = 0; i < maxIterations; i++) {
    const mid = (low + high) / 2;
    const midOutcome = calculateOutcome(mid);
    
    if (Math.abs(midOutcome - targetOutcome) < tolerance) {
      return mid;
    }
    
    if ((midOutcome < targetOutcome) === (lowOutcome < targetOutcome)) {
      low = mid;
    } else {
      high = mid;
    }
  }
  
  return (low + high) / 2;
}

export interface MonteCarloResult {
  mean: number;
  median: number;
  standardDeviation: number;
  percentile5: number;
  percentile25: number;
  percentile75: number;
  percentile95: number;
  distribution: number[];
  probabilityOfPositive: number;
}

export function runMonteCarlo(
  iterations: number,
  generateRandomInputs: () => Record<string, number>,
  calculateOutcome: (inputs: Record<string, number>) => number
): MonteCarloResult {
  const results: number[] = [];
  
  for (let i = 0; i < iterations; i++) {
    const inputs = generateRandomInputs();
    const outcome = calculateOutcome(inputs);
    results.push(outcome);
  }
  
  results.sort((a, b) => a - b);
  
  const n = results.length;
  const mean = results.reduce((a, b) => a + b, 0) / n;
  const median = n % 2 === 0 
    ? (results[n/2 - 1] + results[n/2]) / 2 
    : results[Math.floor(n/2)];
  
  const variance = results.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / n;
  const standardDeviation = Math.sqrt(variance);
  
  const percentile = (p: number) => results[Math.floor(p * n / 100)];
  
  const positiveCount = results.filter(r => r > 0).length;
  
  return {
    mean,
    median,
    standardDeviation,
    percentile5: percentile(5),
    percentile25: percentile(25),
    percentile75: percentile(75),
    percentile95: percentile(95),
    distribution: results,
    probabilityOfPositive: positiveCount / n,
  };
}
