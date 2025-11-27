import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Minus, DollarSign, Anchor, Percent, Database, Ruler } from "lucide-react";

interface RateStats {
  count: number;
  avgRatePerFt: number;
  medianRatePerFt: number;
  minRatePerFt: number;
  maxRatePerFt: number;
  avgMonthlyRate: number;
  medianMonthlyRate: number;
  avgLoaSize: number;
  uniqueMarinas: number;
}

interface RcStatisticsPanelProps {
  stats: RateStats;
  isLoading?: boolean;
}

function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(Number(value))) {
    return 'N/A';
  }
  return `$${Math.round(Number(value)).toLocaleString('en-US')}`;
}

function formatRatePerFt(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(Number(value))) {
    return 'N/A';
  }
  return `$${Number(value).toFixed(2)}/ft`;
}

export default function RcStatisticsPanel({ stats, isLoading }: RcStatisticsPanelProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader className="pb-2">
              <div className="h-4 bg-muted rounded w-24" />
            </CardHeader>
            <CardContent>
              <div className="h-8 bg-muted rounded w-32 mb-2" />
              <div className="h-3 bg-muted rounded w-20" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const rateVariance = stats.medianRatePerFt > 0 
    ? ((stats.avgRatePerFt - stats.medianRatePerFt) / stats.medianRatePerFt)
    : 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Count */}
        <Card className="border-border/40 hover:border-primary/50 transition-colors" data-testid="card-stat-count">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Database className="h-4 w-4" />
              Rate Records
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {stats.count.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Rate tiers analyzed
            </p>
          </CardContent>
        </Card>

        {/* Unique Marinas */}
        <Card className="border-border/40 hover:border-primary/50 transition-colors" data-testid="card-stat-marinas">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Anchor className="h-4 w-4" />
              Unique Marinas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {stats.uniqueMarinas.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Properties with rates
            </p>
          </CardContent>
        </Card>

        {/* Average Rate Per Foot */}
        <Card className="border-border/40 hover:border-primary/50 transition-colors" data-testid="card-stat-avg-rate">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Avg Rate/Ft/Mo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground truncate">
              {formatRatePerFt(stats.avgRatePerFt)}
            </div>
            <div className="flex items-center gap-1 mt-1">
              {rateVariance > 0.05 && <TrendingUp className="h-3 w-3 text-green-500" />}
              {rateVariance < -0.05 && <TrendingDown className="h-3 w-3 text-red-500" />}
              {Math.abs(rateVariance) <= 0.05 && <Minus className="h-3 w-3 text-muted-foreground" />}
              <p className={`text-xs truncate ${rateVariance > 0 ? 'text-green-600' : rateVariance < 0 ? 'text-red-600' : 'text-muted-foreground'}`}>
                {Math.abs(rateVariance * 100).toFixed(1)}% vs median
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Median Rate Per Foot */}
        <Card className="border-border/40 hover:border-primary/50 transition-colors" data-testid="card-stat-median-rate">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Median Rate/Ft/Mo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground truncate">
              {formatRatePerFt(stats.medianRatePerFt)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              50th percentile
            </p>
          </CardContent>
        </Card>

        {/* Rate Range Min */}
        <Card className="border-border/40 hover:border-primary/50 transition-colors" data-testid="card-stat-min-rate">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingDown className="h-4 w-4" />
              Min Rate/Ft/Mo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground truncate">
              {formatRatePerFt(stats.minRatePerFt)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Lowest rate
            </p>
          </CardContent>
        </Card>

        {/* Rate Range Max */}
        <Card className="border-border/40 hover:border-primary/50 transition-colors" data-testid="card-stat-max-rate">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Max Rate/Ft/Mo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground truncate">
              {formatRatePerFt(stats.maxRatePerFt)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Highest rate
            </p>
          </CardContent>
        </Card>

        {/* Average Monthly Rate */}
        <Card className="border-border/40 hover:border-primary/50 transition-colors" data-testid="card-stat-avg-monthly">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Avg Monthly Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground truncate">
              {formatCurrency(stats.avgMonthlyRate)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Per slip/space
            </p>
          </CardContent>
        </Card>

        {/* Average LOA */}
        <Card className="border-border/40 hover:border-primary/50 transition-colors" data-testid="card-stat-avg-loa">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Ruler className="h-4 w-4" />
              Avg Boat Length
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground truncate">
              {Math.round(stats.avgLoaSize).toLocaleString()} ft
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Average LOA
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
