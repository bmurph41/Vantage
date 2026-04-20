import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Link, useLocation } from "wouter";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  DollarSign,
  Home,
  Briefcase,
  Building2,
  Target,
  ChevronRight,
} from "lucide-react";

type MetricColor = "green" | "blue" | "purple" | "amber" | undefined;

interface DashboardMetric {
  label: string;
  value: string;
  icon?: string;
  trend?: string;
  color?: MetricColor;
  href?: string;
}

interface DashboardHeaderData {
  personaType: string;
  title: string;
  subtitle: string;
  metrics: DashboardMetric[];
  actions?: Array<{ label: string; href: string }>;
}

const iconMap: Record<string, typeof TrendingUp> = {
  TrendingUp,
  DollarSign,
  Home,
  Briefcase,
  Building2,
  Target,
};

const colorMap: Record<string, string> = {
  green: "text-green-600 dark:text-green-400",
  blue: "text-blue-600 dark:text-blue-400",
  purple: "text-purple-600 dark:text-purple-400",
  amber: "text-amber-600 dark:text-amber-400",
};

const bgColorMap: Record<string, string> = {
  green: "bg-green-100 dark:bg-green-900/30",
  blue: "bg-blue-100 dark:bg-blue-900/30",
  purple: "bg-purple-100 dark:bg-purple-900/30",
  amber: "bg-amber-100 dark:bg-amber-900/30",
};

export function DashboardPersonaHeader() {
  const [, navigate] = useLocation();
  const { data, isLoading, error } = useQuery<DashboardHeaderData>({
    queryKey: ["/api/dashboard/header"],
  });
  
  const getMetricHref = (label: string, personaType?: string): string | null => {
    const lowerLabel = label.toLowerCase();
    if (lowerLabel.includes('owned') || lowerLabel.includes('assets')) {
      return '/portfolio';
    }
    if (lowerLabel.includes('portfolio value')) {
      return '/portfolio?tab=financials';
    }
    if (lowerLabel.includes('ebitda')) {
      return '/portfolio?tab=financials';
    }
    if (lowerLabel.includes('active deals')) {
      return '/crm/deals';
    }
    if (lowerLabel.includes('irr') || lowerLabel.includes('tvpi') || lowerLabel.includes('dpi')) {
      return '/modeling/funds';
    }
    return null;
  };

  if (isLoading) {
    return (
      <Card className="mb-6" data-testid="dashboard-header-skeleton">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <Skeleton className="h-7 w-48" />
              <Skeleton className="h-4 w-32" />
            </div>
            <div className="flex gap-4">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-16 w-24" />
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return null;
  }

  return (
    <Card className="mb-6 border-l-4 border-l-primary" data-testid="dashboard-persona-header">
      <CardContent className="p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-foreground" data-testid="header-title">
              {data.title}
            </h2>
            <p className="text-sm text-muted-foreground" data-testid="header-subtitle">
              {data.subtitle}
            </p>
          </div>

          {data.metrics.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-8 gap-2 sm:gap-3" data-testid="header-metrics">
              {data.metrics.map((metric, idx) => {
                const IconComponent = metric.icon ? iconMap[metric.icon] : null;
                const textColor = metric.color ? colorMap[metric.color] : "text-foreground";
                const bgColor = metric.color ? bgColorMap[metric.color] : "bg-muted";
                const href = metric.href || getMetricHref(metric.label, data.personaType);
                const isClickable = !!href;

                const trendVal = metric.trend;
                const isPositive = trendVal && (trendVal.startsWith('+') || (!trendVal.startsWith('-') && parseFloat(trendVal) > 0));
                const isNegative = trendVal && (trendVal.startsWith('-') || parseFloat(trendVal) < 0);
                const TrendIcon = isPositive ? TrendingUp : isNegative ? TrendingDown : trendVal ? Minus : null;
                const trendColor = isPositive ? 'text-green-600' : isNegative ? 'text-red-500' : 'text-muted-foreground';

                const metricContent = (
                  <>
                    {IconComponent && (
                      <IconComponent className={`h-4 w-4 sm:h-5 sm:w-5 ${textColor} flex-shrink-0`} />
                    )}
                    <div className="text-center min-w-0">
                      <div className="flex items-center justify-center gap-1">
                        <span className={`text-base sm:text-lg font-bold ${textColor}`}>{metric.value}</span>
                        {TrendIcon && <TrendIcon className={`h-3 w-3 flex-shrink-0 ${trendColor}`} />}
                      </div>
                      <div className="text-xs text-muted-foreground">{metric.label}</div>
                      {trendVal && (
                        <div className={`text-xs font-medium ${trendColor}`}>{trendVal}</div>
                      )}
                    </div>
                  </>
                );

                if (isClickable) {
                  return (
                    <button
                      key={idx}
                      onClick={() => navigate(href!)}
                      className={`flex items-center justify-center gap-2 sm:gap-3 px-3 py-3 sm:px-4 rounded-lg ${bgColor} cursor-pointer transition-all hover:shadow-md hover:scale-105 focus:outline-none focus:ring-2 focus:ring-primary/50 min-h-[60px]`}
                      data-testid={`metric-${metric.label.toLowerCase().replace(/\s+/g, '-')}`}
                    >
                      {metricContent}
                    </button>
                  );
                }

                return (
                  <div
                    key={idx}
                    className={`flex items-center justify-center gap-2 sm:gap-3 px-3 py-3 sm:px-4 rounded-lg ${bgColor} min-h-[60px]`}
                    data-testid={`metric-${metric.label.toLowerCase().replace(/\s+/g, '-')}`}
                  >
                    {metricContent}
                  </div>
                );
              })}
            </div>
          )}

          {data.actions && data.actions.length > 0 && (
            <div className="flex gap-2 flex-shrink-0" data-testid="header-actions">
              {data.actions.map((action, idx) => (
                <Link key={idx} href={action.href}>
                  <Button variant="outline" size="sm" data-testid={`action-${action.label.toLowerCase().replace(/\s+/g, '-')}`}>
                    {action.label}
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </Link>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
