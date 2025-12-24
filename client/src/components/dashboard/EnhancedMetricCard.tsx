import { formatCurrency, formatNumber, formatPercent, getTrendColor, getTrendIcon } from "@/lib/formatUtils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { TrendingUp, TrendingDown, Minus, Info } from "lucide-react";
import { cn } from "@/lib/utils";

export type MetricSize = 'sm' | 'md' | 'lg';
export type MetricType = 'currency' | 'number' | 'percent';
export type MetricVariant = 'default' | 'primary' | 'success' | 'warning' | 'danger';
export type PercentFormat = 'integer' | 'decimal'; // 'integer' = 0-100 range, 'decimal' = 0-1 range

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
  percentFormat?: PercentFormat; // For main value: 'integer' (0-100) or 'decimal' (0-1)
  trendFormat?: PercentFormat; // For trend: defaults to 'decimal' (0-1) from backend
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
  percentFormat, // Optional: explicit format override
  trendFormat, // Optional: explicit trend format override
}: EnhancedMetricCardProps) {
  // Helper to normalize percent values with auto-detection or explicit format
  const normalizePercent = (val: number, explicitFormat?: PercentFormat): number => {
    // If explicit format provided, use it
    if (explicitFormat) {
      return explicitFormat === 'integer' ? val / 100 : val;
    }
    
    // Auto-detect format based on type:
    // Backend uses Math.round((x) * 100) for all percent metrics, returning integers 0-100
    // If value is an integer, treat as 0-100 range (e.g., 1 for 1%, 23 for 23%, 100 for 100%)
    // If value is a decimal, treat as 0-1 range (e.g., 0.01 for 1%, 0.23 for 23%, 1.0 for 100%)
    // Note: Number.isInteger(1.0) === true in JS, but backend never returns 1.0 (only integer 1)
    return Number.isInteger(val) ? val / 100 : val;
  };

  const formatValue = (val: number, metricType: MetricType, format: PercentFormat = percentFormat) => {
    switch (metricType) {
      case 'currency':
        return formatCurrency(val, compact);
      case 'percent':
        const normalizedVal = normalizePercent(val, format);
        return new Intl.NumberFormat('en-US', {
          style: 'percent',
          minimumFractionDigits: 0,
          maximumFractionDigits: 1,
        }).format(normalizedVal);
      default:
        return formatNumber(val, compact);
    }
  };

  const formatTrendValue = (trendVal: number): string => {
    // Backend returns trend as a percentage value (e.g., 21.43 for 21.43% change)
    // Convert to decimal for Intl.NumberFormat percentage style
    const decimal = trendVal / 100;
    return new Intl.NumberFormat('en-US', {
      style: 'percent',
      minimumFractionDigits: 0,
      maximumFractionDigits: 1,
    }).format(Math.abs(decimal));
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
                "font-medium text-gray-600 tracking-tight leading-tight",
                sizeClasses[size].label
              )}>
                {label}
              </p>
              {subtitle && (
                <p className="text-[10px] text-gray-400 mt-0.5 leading-tight">{subtitle}</p>
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

      <div className="flex flex-wrap items-baseline gap-2 mb-2">
        <p className={cn(
          "font-bold tracking-tight leading-none",
          sizeClasses[size].value,
          variantClasses[variant]
        )}>
          {formatValue(value, type)}
        </p>

        {trend !== undefined && (
          <div className={cn(
            "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-xs font-semibold shrink-0",
            getTrendColorClass()
          )}>
            {getTrendIndicator()}
            <span>{formatTrendValue(trend)}</span>
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
