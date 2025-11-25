import { Card, CardContent } from '@/components/ui/card';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface StatItem {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  format?: 'currency' | 'number' | 'percent';
  trend?: {
    value: number;
    isPositive?: boolean;
  };
}

interface StatGridProps {
  stats: StatItem[];
  columns?: number;
  layout?: 'row' | 'grid';
  className?: string;
}

export function StatGrid({ 
  stats, 
  columns = 3, 
  layout = 'grid',
  className 
}: StatGridProps) {
  const formatValue = (val: string | number, format?: 'currency' | 'number' | 'percent'): string => {
    if (typeof val === 'string') return val;
    
    switch (format) {
      case 'currency':
        return `$${val.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
      case 'percent':
        return `${val.toFixed(2)}%`;
      default:
        return val.toLocaleString();
    }
  };

  const gridClass = layout === 'grid' 
    ? `grid grid-cols-${Math.min(columns, stats.length)} gap-4`
    : 'flex flex-col gap-4';

  return (
    <div className={cn(gridClass, className)} data-testid="stat-grid">
      {stats.map((stat, index) => {
        const Icon = stat.icon;
        return (
          <Card key={index} className="hover:shadow-sm transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-xs font-medium text-gray-600 mb-1">
                    {stat.label}
                  </p>
                  <p className="text-2xl font-bold text-gray-900" data-testid={`stat-value-${index}`}>
                    {formatValue(stat.value, stat.format)}
                  </p>
                  {stat.trend && (
                    <p className={cn(
                      'text-xs font-medium mt-1',
                      stat.trend.isPositive === undefined
                        ? stat.trend.value > 0
                          ? 'text-green-600'
                          : stat.trend.value < 0
                          ? 'text-red-600'
                          : 'text-gray-600'
                        : stat.trend.isPositive
                        ? 'text-green-600'
                        : 'text-red-600'
                    )}>
                      {stat.trend.value > 0 ? '+' : ''}{stat.trend.value.toFixed(2)}%
                    </p>
                  )}
                </div>
                {Icon && (
                  <div className="p-2 bg-blue-50 rounded">
                    <Icon className="h-4 w-4 text-blue-600" />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
