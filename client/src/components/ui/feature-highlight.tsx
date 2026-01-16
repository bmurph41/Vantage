import { cn } from "@/lib/utils";
import { LucideIcon, ArrowRight } from "lucide-react";
import { Link } from "wouter";

interface FeatureHighlightProps {
  icon: LucideIcon;
  title: string;
  description: string;
  link?: string;
  linkText?: string;
  variant?: "default" | "accent" | "gradient";
  className?: string;
}

export function FeatureHighlight({
  icon: Icon,
  title,
  description,
  link,
  linkText = "Learn More",
  variant = "default",
  className,
}: FeatureHighlightProps) {
  const variantStyles = {
    default: "bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800",
    accent: "bg-gradient-to-br from-blue-50 to-white dark:from-blue-950/30 dark:to-gray-900 border border-blue-100 dark:border-blue-900/50",
    gradient: "bg-gradient-to-br from-primary/5 via-white to-teal-50/50 dark:from-primary/10 dark:via-gray-900 dark:to-teal-950/30 border border-primary/10",
  };

  return (
    <div
      className={cn(
        "rounded-xl p-6 transition-all duration-300 hover:shadow-lg hover:-translate-y-1 group",
        variantStyles[variant],
        className
      )}
    >
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-primary/10 dark:bg-primary/20 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
          <Icon className="w-6 h-6 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
            {title}
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed mb-3">
            {description}
          </p>
          {link && (
            <Link href={link}>
              <span className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary/80 transition-colors cursor-pointer group/link">
                {linkText}
                <ArrowRight className="w-4 h-4 transition-transform group-hover/link:translate-x-1" />
              </span>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

interface FeatureHighlightGridProps {
  children: React.ReactNode;
  columns?: 2 | 3 | 4;
  className?: string;
}

export function FeatureHighlightGrid({ 
  children, 
  columns = 3, 
  className 
}: FeatureHighlightGridProps) {
  const gridCols = {
    2: "grid-cols-1 md:grid-cols-2",
    3: "grid-cols-1 md:grid-cols-2 lg:grid-cols-3",
    4: "grid-cols-1 md:grid-cols-2 lg:grid-cols-4",
  };

  return (
    <div className={cn("grid gap-6", gridCols[columns], className)}>
      {children}
    </div>
  );
}

interface ChecklistItem {
  text: string;
  completed?: boolean;
}

interface FeatureChecklistProps {
  title?: string;
  items: ChecklistItem[];
  columns?: 1 | 2 | 3;
  variant?: "default" | "accent";
  className?: string;
}

export function FeatureChecklist({
  title,
  items,
  columns = 2,
  variant = "default",
  className,
}: FeatureChecklistProps) {
  const gridCols = {
    1: "grid-cols-1",
    2: "grid-cols-1 sm:grid-cols-2",
    3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
  };

  return (
    <div className={cn("", className)}>
      {title && (
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
          {title}
        </h3>
      )}
      <div className={cn("grid gap-3", gridCols[columns])}>
        {items.map((item, index) => (
          <div key={index} className="flex items-center gap-3">
            <div className={cn(
              "flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center",
              variant === "accent" 
                ? "bg-green-100 dark:bg-green-900/30" 
                : "bg-primary/10 dark:bg-primary/20"
            )}>
              <svg
                className={cn(
                  "w-3 h-3",
                  variant === "accent" 
                    ? "text-green-600 dark:text-green-400" 
                    : "text-primary"
                )}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={3}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <span className="text-sm text-gray-700 dark:text-gray-300">{item.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

interface HeroSectionProps {
  title: string;
  subtitle?: string;
  description?: string;
  primaryAction?: {
    label: string;
    onClick?: () => void;
    href?: string;
  };
  secondaryAction?: {
    label: string;
    onClick?: () => void;
    href?: string;
  };
  className?: string;
}

export function HeroSection({
  title,
  subtitle,
  description,
  primaryAction,
  secondaryAction,
  className,
}: HeroSectionProps) {
  return (
    <div className={cn(
      "relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-primary/90 to-blue-700 p-8 md:p-12 text-white",
      className
    )}>
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmZmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDM0djZoNnYtNmgtNnptMCAwdi02aC02djZoNnoiLz48L2c+PC9nPjwvc3ZnPg==')] opacity-50" />
      <div className="relative z-10 max-w-3xl">
        {subtitle && (
          <span className="inline-block px-3 py-1 text-xs font-semibold uppercase tracking-wider bg-white/20 rounded-full mb-4">
            {subtitle}
          </span>
        )}
        <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4 leading-tight">
          {title}
        </h1>
        {description && (
          <p className="text-lg md:text-xl text-white/80 mb-6 leading-relaxed">
            {description}
          </p>
        )}
        {(primaryAction || secondaryAction) && (
          <div className="flex flex-wrap items-center gap-4">
            {primaryAction && (
              primaryAction.href ? (
                <Link href={primaryAction.href}>
                  <span className="inline-flex items-center justify-center px-6 py-3 text-sm font-semibold bg-white text-primary rounded-lg hover:bg-white/90 transition-colors cursor-pointer shadow-lg">
                    {primaryAction.label}
                  </span>
                </Link>
              ) : (
                <button
                  onClick={primaryAction.onClick}
                  className="inline-flex items-center justify-center px-6 py-3 text-sm font-semibold bg-white text-primary rounded-lg hover:bg-white/90 transition-colors shadow-lg"
                >
                  {primaryAction.label}
                </button>
              )
            )}
            {secondaryAction && (
              secondaryAction.href ? (
                <Link href={secondaryAction.href}>
                  <span className="inline-flex items-center justify-center px-6 py-3 text-sm font-semibold text-white border-2 border-white/30 rounded-lg hover:bg-white/10 transition-colors cursor-pointer">
                    {secondaryAction.label}
                  </span>
                </Link>
              ) : (
                <button
                  onClick={secondaryAction.onClick}
                  className="inline-flex items-center justify-center px-6 py-3 text-sm font-semibold text-white border-2 border-white/30 rounded-lg hover:bg-white/10 transition-colors"
                >
                  {secondaryAction.label}
                </button>
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
}

interface StatHighlightProps {
  value: string | number;
  label: string;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  icon?: LucideIcon;
  variant?: "default" | "accent" | "success" | "warning";
  className?: string;
}

export function StatHighlight({
  value,
  label,
  trend,
  icon: Icon,
  variant = "default",
  className,
}: StatHighlightProps) {
  const variantStyles = {
    default: "bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800",
    accent: "bg-primary/5 dark:bg-primary/10 border-primary/20",
    success: "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-900/50",
    warning: "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900/50",
  };

  const iconStyles = {
    default: "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400",
    accent: "bg-primary/10 dark:bg-primary/20 text-primary",
    success: "bg-green-100 dark:bg-green-900/50 text-green-600 dark:text-green-400",
    warning: "bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400",
  };

  return (
    <div
      className={cn(
        "rounded-xl p-5 border transition-shadow hover:shadow-md",
        variantStyles[variant],
        className
      )}
    >
      <div className="flex items-start justify-between mb-3">
        <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
          {label}
        </span>
        {Icon && (
          <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", iconStyles[variant])}>
            <Icon className="w-4 h-4" />
          </div>
        )}
      </div>
      <div className="flex items-end gap-2">
        <span className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          {value}
        </span>
        {trend && (
          <span
            className={cn(
              "text-sm font-medium mb-0.5",
              trend.isPositive ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
            )}
          >
            {trend.isPositive ? "+" : ""}{trend.value}%
          </span>
        )}
      </div>
    </div>
  );
}

interface StatHighlightGridProps {
  children: React.ReactNode;
  columns?: 2 | 3 | 4 | 5;
  className?: string;
}

export function StatHighlightGrid({ 
  children, 
  columns = 4, 
  className 
}: StatHighlightGridProps) {
  const gridCols = {
    2: "grid-cols-1 sm:grid-cols-2",
    3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
    4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
    5: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5",
  };

  return (
    <div className={cn("grid gap-4", gridCols[columns], className)}>
      {children}
    </div>
  );
}
