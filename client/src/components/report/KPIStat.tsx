import { cn } from "@/lib/utils";

interface KPIStatProps {
  label: string;
  value: string | number;
  unit?: string;
  change?: {
    value: number;
    period: string;
    trend: "up" | "down" | "neutral";
  };
  format?: "currency" | "percentage" | "number" | "text";
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function KPIStat({
  label,
  value,
  unit,
  change,
  format = "text",
  size = "md",
  className,
}: KPIStatProps) {
  // Format the value based on type
  const formatValue = (val: string | number): string => {
    if (typeof val === "string") return val;
    
    switch (format) {
      case "currency":
        return new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: "USD",
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        }).format(val);
      case "percentage":
        return `${val.toFixed(1)}%`;
      case "number":
        return new Intl.NumberFormat("en-US").format(val);
      default:
        return val.toString();
    }
  };
  
  const sizeClasses = {
    sm: {
      value: "text-xl font-semibold",
      label: "text-sm",
      change: "text-xs",
    },
    md: {
      value: "text-2xl font-bold",
      label: "text-sm",
      change: "text-xs",
    },
    lg: {
      value: "text-3xl font-bold",
      label: "text-base",
      change: "text-sm",
    },
  };
  
  const trendColors = {
    up: "text-emerald-600",
    down: "text-red-600", 
    neutral: "text-neutral-500",
  };
  
  const trendIcons = {
    up: "↗",
    down: "↘",
    neutral: "→",
  };
  
  return (
    <div 
      className={cn(
        "flex flex-col space-y-1 p-4 bg-neutral-50 rounded-lg border border-neutral-200",
        className
      )}
      data-testid={`kpi-stat-${label.toLowerCase().replace(/\s+/g, '-')}`}
    >
      {/* Label */}
      <div 
        className={cn(
          "font-medium text-neutral-600 uppercase tracking-wide",
          sizeClasses[size].label
        )}
        data-testid="kpi-stat-label"
      >
        {label}
      </div>
      
      {/* Value */}
      <div className="flex items-baseline space-x-1">
        <span 
          className={cn(
            "tabular-nums text-neutral-900",
            sizeClasses[size].value
          )}
          data-testid="kpi-stat-value"
        >
          {formatValue(value)}
        </span>
        {unit && (
          <span 
            className={cn(
              "text-neutral-500 font-medium",
              size === "lg" ? "text-lg" : "text-sm"
            )}
            data-testid="kpi-stat-unit"
          >
            {unit}
          </span>
        )}
      </div>
      
      {/* Change indicator */}
      {change && (
        <div 
          className={cn(
            "flex items-center space-x-1",
            sizeClasses[size].change,
            trendColors[change.trend]
          )}
          data-testid="kpi-stat-change"
        >
          <span>{trendIcons[change.trend]}</span>
          <span className="tabular-nums font-medium">
            {change.value > 0 ? "+" : ""}{change.value.toFixed(1)}%
          </span>
          <span className="text-neutral-500">
            {change.period}
          </span>
        </div>
      )}
    </div>
  );
}

export default KPIStat;