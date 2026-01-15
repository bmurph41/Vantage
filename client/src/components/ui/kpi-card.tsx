import { cn } from "@/lib/utils"
import { TrendingUp, TrendingDown, Minus, Info, LucideIcon } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./tooltip"

export type KPISize = "sm" | "md" | "lg"
export type KPIVariant = "default" | "primary" | "success" | "warning" | "danger" | "muted"

interface TrendData {
  value: number
  label?: string
  isPositiveGood?: boolean
}

interface KPICardProps {
  label: string
  value: string | number
  description?: string
  trend?: TrendData
  icon?: LucideIcon
  iconColor?: string
  size?: KPISize
  variant?: KPIVariant
  tooltip?: string
  format?: "currency" | "number" | "percent" | "none"
  loading?: boolean
  onClick?: () => void
  className?: string
  children?: React.ReactNode
}

const sizeConfig = {
  sm: {
    container: "p-4",
    label: "text-xs",
    value: "text-xl",
    trend: "text-xs",
    icon: "h-8 w-8",
    iconInner: "h-4 w-4",
  },
  md: {
    container: "p-5",
    label: "text-xs",
    value: "text-2xl",
    trend: "text-xs",
    icon: "h-10 w-10",
    iconInner: "h-5 w-5",
  },
  lg: {
    container: "p-6",
    label: "text-sm",
    value: "text-3xl",
    trend: "text-sm",
    icon: "h-12 w-12",
    iconInner: "h-6 w-6",
  },
}

const variantConfig = {
  default: {
    value: "text-foreground",
    iconBg: "bg-primary/10",
    iconColor: "text-primary",
  },
  primary: {
    value: "text-primary",
    iconBg: "bg-primary/10",
    iconColor: "text-primary",
  },
  success: {
    value: "text-emerald-600 dark:text-emerald-400",
    iconBg: "bg-emerald-100 dark:bg-emerald-900/30",
    iconColor: "text-emerald-600 dark:text-emerald-400",
  },
  warning: {
    value: "text-amber-600 dark:text-amber-400",
    iconBg: "bg-amber-100 dark:bg-amber-900/30",
    iconColor: "text-amber-600 dark:text-amber-400",
  },
  danger: {
    value: "text-red-600 dark:text-red-400",
    iconBg: "bg-red-100 dark:bg-red-900/30",
    iconColor: "text-red-600 dark:text-red-400",
  },
  muted: {
    value: "text-muted-foreground",
    iconBg: "bg-muted",
    iconColor: "text-muted-foreground",
  },
}

export function KPICard({
  label,
  value,
  description,
  trend,
  icon: Icon,
  iconColor,
  size = "md",
  variant = "default",
  tooltip,
  format = "none",
  loading = false,
  onClick,
  className,
  children,
}: KPICardProps) {
  const sizes = sizeConfig[size]
  const variants = variantConfig[variant]

  const formatValue = (val: string | number): string => {
    if (typeof val === "string") return val
    switch (format) {
      case "currency":
        return new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: "USD",
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        }).format(val)
      case "percent":
        return `${val.toFixed(1)}%`
      case "number":
        return val.toLocaleString()
      default:
        return typeof val === "number" ? val.toLocaleString() : String(val)
    }
  }

  const getTrendColor = () => {
    if (!trend) return ""
    const isPositive = trend.value > 0
    const isGood = trend.isPositiveGood ?? true
    
    if (trend.value === 0) return "text-muted-foreground bg-muted"
    if ((isPositive && isGood) || (!isPositive && !isGood)) {
      return "text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-900/30"
    }
    return "text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-900/30"
  }

  const TrendIcon = trend
    ? trend.value > 0
      ? TrendingUp
      : trend.value < 0
        ? TrendingDown
        : Minus
    : null

  if (loading) {
    return (
      <div className={cn(
        "rounded-xl border bg-card",
        sizes.container,
        className
      )}>
        <div className="animate-pulse space-y-3">
          <div className="h-4 w-24 bg-muted rounded" />
          <div className="h-8 w-32 bg-muted rounded" />
          <div className="h-3 w-20 bg-muted rounded" />
        </div>
      </div>
    )
  }

  return (
    <div
      className={cn(
        "rounded-xl border bg-card transition-all duration-200",
        "hover:shadow-md hover:border-border/80",
        onClick && "cursor-pointer hover:bg-accent/50",
        sizes.container,
        className
      )}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-1.5">
            <span className={cn(
              "font-medium text-muted-foreground uppercase tracking-wide",
              sizes.label
            )}>
              {label}
            </span>
            {tooltip && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3.5 w-3.5 text-muted-foreground/60 cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs max-w-[200px]">{tooltip}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
          
          <div className={cn(
            "font-semibold tracking-tight",
            sizes.value,
            variants.value
          )}>
            {formatValue(value)}
          </div>

          {(trend || description) && (
            <div className="flex items-center gap-2 flex-wrap">
              {trend && TrendIcon && (
                <span className={cn(
                  "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md font-medium",
                  sizes.trend,
                  getTrendColor()
                )}>
                  <TrendIcon className="h-3 w-3" />
                  {Math.abs(trend.value).toFixed(1)}%
                  {trend.label && (
                    <span className="text-muted-foreground ml-0.5">{trend.label}</span>
                  )}
                </span>
              )}
              {description && (
                <span className={cn("text-muted-foreground", sizes.trend)}>
                  {description}
                </span>
              )}
            </div>
          )}
          
          {children}
        </div>

        {Icon && (
          <div className={cn(
            "flex-shrink-0 rounded-lg flex items-center justify-center",
            sizes.icon,
            variants.iconBg
          )}>
            <Icon className={cn(sizes.iconInner, iconColor || variants.iconColor)} />
          </div>
        )}
      </div>
    </div>
  )
}

interface KPIGridProps {
  columns?: 2 | 3 | 4 | 5
  className?: string
  children: React.ReactNode
}

export function KPIGrid({ columns = 4, className, children }: KPIGridProps) {
  const colClasses = {
    2: "grid-cols-1 sm:grid-cols-2",
    3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
    4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
    5: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5",
  }

  return (
    <div className={cn("grid gap-4", colClasses[columns], className)}>
      {children}
    </div>
  )
}

interface MiniKPIProps {
  label: string
  value: string | number
  trend?: TrendData
  className?: string
}

export function MiniKPI({ label, value, trend, className }: MiniKPIProps) {
  const TrendIcon = trend
    ? trend.value > 0
      ? TrendingUp
      : trend.value < 0
        ? TrendingDown
        : Minus
    : null

  const getTrendColor = () => {
    if (!trend) return ""
    if (trend.value > 0) return "text-emerald-600"
    if (trend.value < 0) return "text-red-600"
    return "text-muted-foreground"
  }

  return (
    <div className={cn("flex items-center justify-between py-2", className)}>
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold">{value}</span>
        {trend && TrendIcon && (
          <span className={cn("flex items-center gap-0.5 text-xs", getTrendColor())}>
            <TrendIcon className="h-3 w-3" />
            {Math.abs(trend.value).toFixed(1)}%
          </span>
        )}
      </div>
    </div>
  )
}
