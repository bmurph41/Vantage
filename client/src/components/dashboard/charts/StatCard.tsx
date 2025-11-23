import { ArrowUp, ArrowDown, Minus } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: string | number;
  previousValue?: string | number;
  format?: 'number' | 'currency' | 'percentage';
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: number;
  className?: string;
}

export function StatCard({ 
  label, 
  value, 
  previousValue,
  format = 'number',
  trend,
  trendValue,
  className = ''
}: StatCardProps) {
  const formatValue = (val: string | number) => {
    const numVal = typeof val === 'string' ? parseFloat(val) : val;
    if (isNaN(numVal)) return val;

    switch (format) {
      case 'currency':
        return `$${numVal.toLocaleString()}`;
      case 'percentage':
        return `${numVal}%`;
      default:
        return numVal.toLocaleString();
    }
  };

  const getTrendIcon = () => {
    if (!trend) return null;
    
    const iconClass = "h-3.5 w-3.5";
    switch (trend) {
      case 'up':
        return <ArrowUp className={`${iconClass} text-green-600`} />;
      case 'down':
        return <ArrowDown className={`${iconClass} text-red-600`} />;
      case 'neutral':
        return <Minus className={`${iconClass} text-gray-600`} />;
    }
  };

  const getTrendColor = () => {
    switch (trend) {
      case 'up':
        return 'text-green-600';
      case 'down':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  return (
    <div className={className}>
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <div className="flex items-baseline gap-2">
        <p className="text-2xl font-bold text-gray-900">
          {formatValue(value)}
        </p>
        {trend && (
          <div className={`flex items-center gap-0.5 ${getTrendColor()}`}>
            {getTrendIcon()}
            {trendValue !== undefined && (
              <span className="text-xs font-medium">
                {trendValue > 0 && '+'}{trendValue}%
              </span>
            )}
          </div>
        )}
      </div>
      {previousValue !== undefined && (
        <p className="text-xs text-gray-400 mt-1">
          Previous: {formatValue(previousValue)}
        </p>
      )}
    </div>
  );
}
