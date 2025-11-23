import { formatCurrency, formatNumber, formatPercent, getTrendColor, getTrendIcon } from "@/lib/formatUtils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { TrendingUp, TrendingDown, Minus, Info } from "lucide-react";
import { cn } from "@/lib/utils";

export type MetricSize = 'sm' | 'md' | 'lg';
export type MetricType = 'currency' | 'number' | 'percent';
export type MetricVariant = 'default' | 'primary' | 'success' | 'warning' | 'danger';

export interface EnhancedMetricCardProps {
  label: string;
  value: number;
  type?: MetricType;
  size?: MetricSize;
  variant?: MetricVariant;
  trend?: number;
  trendLabel?: string;
  subtitle?: string;
  icon?: React.ComponentType<{ className?: string }>;
  sparklineData?: number[];
  compact?: boolean;
  tooltip?: string;
  testId?: string;
  onClick?: () => void;
  clickable?: boolean;
  badge?: string;
  comparison?: {
    label: string;
    value: number;
    type: MetricType;
  };
}

export function EnhancedMetricCard({
  label,
  value,
  type = 'number',
  size = 'md',
  variant = 'default',
  trend,
  trendLabel,
  subtitle,
  icon: Icon,
  compact = false,
  tooltip,
  testId,
  onClick,
  clickable = false,
  badge,
  comparison,
}: EnhancedMetricCardProps) {
  // Helper to normalize percent values (handles both 0-100 integer and 0-1 decimal ranges)
  const normalizePercent = (val: number): number => {
    // Backend provides integers in 0-100 range (e.g., 23 means 23%)
    // If ever receiving decimals, they're in 0-1 range (e.g., 0.23 means 23%)
    // Treat as 0-100 integer if: (1) integer AND (2) in reasonable % range
    // This avoids mishandling edge cases like 1.0 (100% decimal) vs 1 (1% integer)
    const isReasonablePercentInt = Number.isInteger(val) && Math.abs(val) <= 200;
    return isReasonablePercentInt ? val / 100 : val;
  };

  const formatValue = (val: number, metricType: MetricType) => {
    switch (metricType) {
      case 'currency':
        return formatCurrency(val, compact);
      case 'percent':
        const normalizedVal = normalizePercent(val);
        return new Intl.NumberFormat('en-US', {
          style: 'percent',
          minimumFractionDigits: 0,
          maximumFractionDigits: 1,
        }).format(normalizedVal);
      default:
        return formatNumber(val, compact);
    }
  };

  const formatTrend = (trendVal: number): string => {
    // Normalize trend percent values the same way
    const normalized = normalizePercent(trendVal);
    return new Intl.NumberFormat('en-US', {
      style: 'percent',
      minimumFractionDigits: 0,
      maximumFractionDigits: 1,
    }).format(Math.abs(normalized));
  };

  const sizeClasses = {
    sm: {
      value: 'text-xl',
      label: 'text-[10px]',
      icon: 'h-3.5 w-3.5',
    },
    md: {
      value: 'text-2xl',
      label: 'text-xs',
      icon: 'h-4 w-4',
    },
    lg: {
      value: 'text-3xl',
      label: 'text-sm',
      icon: 'h-5 w-5',
    },
  };

  const variantClasses = {
    default: 'text-gray-900',
    primary: 'text-blue-700',
    success: 'text-green-700',
    warning: 'text-amber-700',
    danger: 'text-red-700',
  };

  const getTrendIndicator = () => {
    if (trend === undefined) return null;
    if (trend > 0) return <TrendingUp className="h-3.5 w-3.5" />;
    if (trend < 0) return <TrendingDown className="h-3.5 w-3.5" />;
    return <Minus className="h-3.5 w-3.5" />;
  };

  const getTrendColorClass = () => {
    if (trend === undefined) return '';
    if (trend > 0) return 'text-green-600 bg-green-50';
    if (trend < 0) return 'text-red-600 bg-red-50';
    return 'text-gray-600 bg-gray-50';
  };

  const isClickable = clickable || onClick;

  return (
    <div
      className={cn(
        "relative group transition-all duration-200 rounded-lg border border-gray-100 bg-white p-4 hover:border-gray-200",
        isClickable && "cursor-pointer hover:shadow-md hover:-translate-y-0.5",
        "h-full flex flex-col"
      )}
      onClick={onClick}
      data-testid={testId}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {Icon && (
              <div className={cn(
                "rounded-md p-1.5",
                variant === 'primary' && "bg-blue-50 text-blue-600",
                variant === 'success' && "bg-green-50 text-green-600",
                variant === 'warning' && "bg-amber-50 text-amber-600",
                variant === 'danger' && "bg-red-50 text-red-600",
                variant === 'default' && "bg-gray-50 text-gray-600"
              )}>
                <Icon className={sizeClasses[size].icon} />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className={cn(
                "font-medium text-gray-600 tracking-tight leading-tight truncate",
                sizeClasses[size].label
              )}>
                {label}
              </p>
              {subtitle && (
                <p className="text-[10px] text-gray-400 mt-0.5 truncate">{subtitle}</p>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-start gap-1.5 ml-2">
          {badge && (
            <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10 whitespace-nowrap">
              {badge}
            </span>
          )}
          {tooltip && (
            <TooltipProvider delayDuration={0}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button type="button" className="text-gray-400 hover:text-gray-600 transition-colors">
                    <Info className="h-3.5 w-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs">
                  <p className="text-xs leading-relaxed">{tooltip}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </div>

      <div className="flex items-baseline gap-3 mb-2">
        <p className={cn(
          "font-bold tracking-tight leading-none",
          sizeClasses[size].value,
          variantClasses[variant]
        )}>
          {formatValue(value, type)}
        </p>

        {trend !== undefined && (
          <div className={cn(
            "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-xs font-semibold",
            getTrendColorClass()
          )}>
            {getTrendIndicator()}
            <span>{formatTrend(trend)}</span>
          </div>
        )}
      </div>

      {trendLabel && (
        <p className="text-[10px] text-gray-500 mb-2">{trendLabel}</p>
      )}

      {comparison && (
        <div className="mt-auto pt-3 border-t border-gray-100">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-gray-500">{comparison.label}</span>
            <span className="font-semibold text-gray-700">
              {formatValue(comparison.value, comparison.type)}
            </span>
          </div>
        </div>
      )}

      {isClickable && onClick && (
        <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="text-gray-400 text-xs">View →</div>
        </div>
      )}
    </div>
  );
}
