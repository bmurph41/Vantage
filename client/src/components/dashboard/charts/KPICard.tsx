import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Minus, LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface KPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: {
    value: number;
    label: string;
    isPositive?: boolean;
  };
  icon?: LucideIcon;
  format?: 'currency' | 'number' | 'percent';
  className?: string;
}

export function KPICard({ 
  title, 
  value, 
  subtitle, 
  trend, 
  icon: Icon, 
  format = 'number',
  className 
}: KPICardProps) {
  const formatValue = (val: string | number): string => {
    if (typeof val === 'string') return val;
    
    switch (format) {
      case 'currency':
        return `$${val.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
      case 'percent':
        return `${val.toFixed(1)}%`;
      default:
        return val.toLocaleString();
    }
  };

  const TrendIcon = trend
    ? trend.value > 0
      ? TrendingUp
      : trend.value < 0
      ? TrendingDown
      : Minus
    : null;

  const trendColor = trend
    ? trend.isPositive === undefined
      ? trend.value > 0
        ? 'text-green-600'
        : trend.value < 0
        ? 'text-red-600'
        : 'text-gray-600'
      : trend.isPositive
      ? 'text-green-600'
      : 'text-red-600'
    : '';

  return (
    <Card className={cn('hover:shadow-md transition-shadow', className)} data-testid="kpi-card">
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-600 mb-1">{title}</p>
            <p className="text-3xl font-bold text-gray-900" data-testid="kpi-value">
              {formatValue(value)}
            </p>
            {subtitle && (
              <p className="text-xs text-gray-500 mt-1">{subtitle}</p>
            )}
            {trend && TrendIcon && (
              <div className={cn('flex items-center gap-1 mt-2 text-sm', trendColor)}>
                <TrendIcon className="h-4 w-4" />
                <span className="font-medium">
                  {Math.abs(trend.value)}% {trend.label}
                </span>
              </div>
            )}
          </div>
          {Icon && (
            <div className="p-3 bg-blue-50 rounded-lg">
              <Icon className="h-6 w-6 text-blue-600" />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
