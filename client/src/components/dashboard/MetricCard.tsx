import { formatCurrency, formatNumber, formatPercent, getTrendColor, getTrendIcon } from "@/lib/formatUtils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export type MetricType = 'currency' | 'number' | 'percent';

export interface MetricCardProps {
  label: string;
  value: number;
  type?: MetricType;
  trend?: number;
  trendLabel?: string;
  compact?: boolean;
  colorClass?: string;
  tooltip?: string;
  testId?: string;
}

export function MetricCard({
  label,
  value,
  type = 'number',
  trend,
  trendLabel,
  compact = false,
  colorClass,
  tooltip,
  testId,
}: MetricCardProps) {
  const formatValue = () => {
    switch (type) {
      case 'currency':
        return formatCurrency(value, compact);
      case 'percent':
        return formatPercent(value);
      default:
        return formatNumber(value, compact);
    }
  };

  const valueClass = colorClass || 'text-gray-900';

  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500">{label}</p>
        {tooltip && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <span className="text-xs text-gray-400 cursor-help">ⓘ</span>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs">{tooltip}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
      <div className="flex items-baseline gap-2">
        <p className={`text-2xl font-bold ${valueClass}`} data-testid={testId}>
          {formatValue()}
        </p>
        {trend !== undefined && (
          <span className={`text-sm font-medium ${getTrendColor(trend)}`}>
            {getTrendIcon(trend)} {Math.abs(trend)}%
            {trendLabel && <span className="text-xs ml-1">({trendLabel})</span>}
          </span>
        )}
      </div>
    </div>
  );
}
