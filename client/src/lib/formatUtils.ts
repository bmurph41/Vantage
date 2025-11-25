export function formatCurrency(value: number, compact: boolean = false): string {
  if (compact && value >= 1000000) {
    return `$${(value / 1000000).toFixed(1)}M`;
  }
  if (compact && value >= 1000) {
    return `$${(value / 1000).toFixed(1)}K`;
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatNumber(value: number, compact: boolean = false): string {
  if (compact && value >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`;
  }
  if (compact && value >= 1000) {
    return `${(value / 1000).toFixed(1)}K`;
  }
  return new Intl.NumberFormat('en-US').format(value);
}

export function formatPercent(value: number, decimals: number = 2): string {
  return `${value.toFixed(decimals)}%`;
}

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
