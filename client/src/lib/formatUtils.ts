export { formatCurrency, formatPercent, formatNumber } from './utils';

export function getTrendColor(value: number, positiveIsGood: boolean = true): string {
  if (value === 0) return 'text-gray-600';
  if (positiveIsGood) {
    return value > 0 ? 'text-green-600' : 'text-red-600';
  }
  return value > 0 ? 'text-red-600' : 'text-green-600';
}

export function getTrendIcon(value: number): string {
  if (value > 0) return '↑';
  if (value < 0) return '↓';
  return '→';
}
