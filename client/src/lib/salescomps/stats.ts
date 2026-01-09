import { formatCurrency as formatCurrencyBase, formatPercent as formatPercentBase } from "@/lib/utils";

export interface StatSummary {
  count: number;
  sum: number;
  mean: number;
  median: number;
  min: number;
  max: number;
  q25: number;
  q75: number;
}

export function calculateStats(values: (number | null | undefined)[]): StatSummary | null {
  const validValues = values
    .filter((v): v is number => v != null && isFinite(v) && v > 0)
    .sort((a, b) => a - b);

  if (validValues.length === 0) {
    return null;
  }

  const count = validValues.length;
  const sum = validValues.reduce((acc, val) => acc + val, 0);
  const mean = sum / count;
  const min = validValues[0];
  const max = validValues[count - 1];
  
  const q25 = getQuantile(validValues, 0.25);
  const median = getQuantile(validValues, 0.5);
  const q75 = getQuantile(validValues, 0.75);

  return {
    count,
    sum,
    mean,
    median,
    min,
    max,
    q25,
    q75,
  };
}

function getQuantile(sortedValues: number[], quantile: number): number {
  if (sortedValues.length === 0) return 0;
  if (sortedValues.length === 1) return sortedValues[0];
  
  const index = (sortedValues.length - 1) * quantile;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  
  if (lower === upper) {
    return sortedValues[lower];
  }
  
  const weight = index - lower;
  return sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight;
}

export function mean(values: (number | null | undefined)[]): number | null {
  const validValues = values.filter((v): v is number => v != null && isFinite(v) && v > 0);
  if (validValues.length === 0) return null;
  return validValues.reduce((sum, val) => sum + val, 0) / validValues.length;
}

export function median(values: (number | null | undefined)[]): number | null {
  const validValues = values
    .filter((v): v is number => v != null && isFinite(v) && v > 0)
    .sort((a, b) => a - b);
    
  if (validValues.length === 0) return null;
  return getQuantile(validValues, 0.5);
}

export function count(values: (any | null | undefined)[]): number {
  return values.filter(v => v != null).length;
}

export function groupByStats<T>(
  data: T[],
  keyFn: (item: T) => string | number,
  valueFn: (item: T) => number | null | undefined
): Record<string, StatSummary | null> {
  const groups: Record<string, (number | null | undefined)[]> = {};
  
  data.forEach(item => {
    const key = String(keyFn(item));
    const value = valueFn(item);
    
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(value);
  });
  
  const result: Record<string, StatSummary | null> = {};
  for (const [key, values] of Object.entries(groups)) {
    result[key] = calculateStats(values);
  }
  
  return result;
}

export function createHistogram(
  values: (number | null | undefined)[],
  binCount: number = 10
): { bin: string; count: number; min: number; max: number }[] {
  const validValues = values.filter((v): v is number => v != null && isFinite(v) && v > 0);
  
  if (validValues.length === 0) return [];
  
  const min = Math.min(...validValues);
  const max = Math.max(...validValues);
  const range = max - min;
  const binSize = range / binCount;
  
  const bins = Array.from({ length: binCount }, (_, i) => ({
    bin: `${formatCurrency(min + i * binSize)} - ${formatCurrency(min + (i + 1) * binSize)}`,
    count: 0,
    min: min + i * binSize,
    max: min + (i + 1) * binSize
  }));
  
  validValues.forEach(value => {
    const binIndex = Math.min(Math.floor((value - min) / binSize), binCount - 1);
    bins[binIndex].count++;
  });
  
  return bins;
}

export function formatCurrency(value: number | null | undefined): string {
  if (value == null || !isFinite(value)) return '—';
  return formatCurrencyBase(value);
}

export function formatPercent(value: number | null | undefined): string {
  if (value == null || !isFinite(value)) return '—';
  return formatPercentBase(value);
}

export function formatNumber(value: number | null | undefined, decimals: number = 0): string {
  if (value == null || !isFinite(value)) return '—';
  
  const abs = Math.abs(value);
  
  if (abs >= 1e9) {
    return (value / 1e9).toFixed(decimals) + 'B';
  }
  if (abs >= 1e6) {
    return (value / 1e6).toFixed(decimals) + 'M';
  }
  if (abs >= 1e3) {
    return (value / 1e3).toFixed(decimals) + 'K';
  }
  
  return value.toFixed(decimals);
}
