import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ComparisonPeriod {
  label: string;
  value: number;
}

interface ComparisonCardProps {
  title: string;
  current: ComparisonPeriod;
  previous: ComparisonPeriod;
  format?: 'currency' | 'number' | 'percent';
  positiveIsBetter?: boolean;
  className?: string;
}

export function ComparisonCard({ 
  title, 
  current, 
  previous, 
  format = 'number',
  positiveIsBetter = true,
  className 
}: ComparisonCardProps) {
  const formatValue = (val: number): string => {
    switch (format) {
      case 'currency':
        return `$${val.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
      case 'percent':
        return `${val.toFixed(1)}%`;
      default:
        return val.toLocaleString();
    }
  };

  const difference = current.value - previous.value;
  const percentChange = previous.value !== 0 
    ? (difference / previous.value) * 100 
    : 0;

  const isPositive = difference > 0;
  const isNeutral = difference === 0;
  
  const TrendIcon = isNeutral ? Minus : isPositive ? TrendingUp : TrendingDown;
  
  const trendColorClass = isNeutral
    ? 'text-gray-600'
    : (isPositive && positiveIsBetter) || (!isPositive && !positiveIsBetter)
    ? 'text-green-600'
    : 'text-red-600';

  const bgColorClass = isNeutral
    ? 'bg-gray-50'
    : (isPositive && positiveIsBetter) || (!isPositive && !positiveIsBetter)
    ? 'bg-green-50'
    : 'bg-red-50';

  return (
    <Card className={cn('hover:shadow-md transition-shadow', className)} data-testid="comparison-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <p className="text-xs text-gray-500 mb-1">{current.label}</p>
            <p className="text-3xl font-bold text-gray-900" data-testid="current-value">
              {formatValue(current.value)}
            </p>
          </div>

          <div className={cn('p-3 rounded-lg', bgColorClass)}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-600 mb-1">{previous.label}</p>
                <p className="text-lg font-semibold text-gray-800">
                  {formatValue(previous.value)}
                </p>
              </div>
              <div className={cn('flex items-center gap-1', trendColorClass)}>
                <TrendIcon className="h-5 w-5" />
                <div className="text-right">
                  <p className="text-lg font-bold">
                    {isPositive ? '+' : ''}{difference > 0 ? formatValue(difference) : formatValue(Math.abs(difference))}
                  </p>
                  <p className="text-xs font-medium">
                    {isPositive ? '+' : ''}{percentChange.toFixed(1)}%
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
