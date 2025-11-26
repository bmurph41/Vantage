import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Minus, DollarSign, Home, Percent, Database } from "lucide-react";

interface OverallStats {
  count: number;
  avgPrice: number;
  medianPrice: number;
  avgPricePerSlip: number;
  medianPricePerSlip: number;
  avgCapRate: number;
  medianCapRate: number;
  avgCapacity: number;
  totalValue: number;
}

interface StatisticsPanelProps {
  stats: OverallStats;
  isLoading?: boolean;
}

function formatCurrency(value: number | null | undefined, compact: boolean = false): string {
  if (value === null || value === undefined || isNaN(Number(value))) {
    return 'N/A';
  }
  const numValue = Number(value);
  if (numValue >= 1000000000) {
    return `$${(numValue / 1000000000).toFixed(2)}B`;
  }
  if (numValue >= 1000000) {
    return `$${(numValue / 1000000).toFixed(2)}M`;
  }
  if (compact && numValue >= 1000) {
    return `$${(numValue / 1000).toFixed(1)}K`;
  }
  return `$${Math.round(numValue).toLocaleString('en-US')}`;
}

function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(Number(value))) {
    return 'N/A';
  }
  const numValue = Number(value);
  if (numValue > 1) {
    return `${numValue.toFixed(2)}%`;
  }
  return `${(numValue * 100).toFixed(2)}%`;
}

export default function StatisticsPanel({ stats, isLoading }: StatisticsPanelProps) {
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

  const priceChange = stats.medianPrice > 0 
    ? ((stats.avgPrice - stats.medianPrice) / stats.medianPrice)
    : 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Count */}
        <Card className="border-border/40 hover:border-primary/50 transition-colors" data-testid="card-stat-count">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Database className="h-4 w-4" />
              Sample Size
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {stats.count.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Comparables analyzed
            </p>
          </CardContent>
        </Card>

        {/* Average Price */}
        <Card className="border-border/40 hover:border-primary/50 transition-colors" data-testid="card-stat-avg-price">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Average Price
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground truncate">
              {formatCurrency(stats.avgPrice)}
            </div>
            <div className="flex items-center gap-1 mt-1">
              {priceChange > 0.05 && <TrendingUp className="h-3 w-3 text-green-500" />}
              {priceChange < -0.05 && <TrendingDown className="h-3 w-3 text-red-500" />}
              {Math.abs(priceChange) <= 0.05 && <Minus className="h-3 w-3 text-muted-foreground" />}
              <p className={`text-xs truncate ${priceChange > 0 ? 'text-green-600' : priceChange < 0 ? 'text-red-600' : 'text-muted-foreground'}`}>
                {Math.abs(priceChange * 100).toFixed(1)}% vs median
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Median Price */}
        <Card className="border-border/40 hover:border-primary/50 transition-colors" data-testid="card-stat-median-price">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Median Price
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground truncate">
              {formatCurrency(stats.medianPrice)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              50th percentile
            </p>
          </CardContent>
        </Card>

        {/* Total Value */}
        <Card className="border-border/40 hover:border-primary/50 transition-colors" data-testid="card-stat-total-value">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Total Value
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground truncate">
              {formatCurrency(stats.totalValue)}
            </div>
            <p className="text-xs text-muted-foreground mt-1 truncate">
              Aggregate volume
            </p>
          </CardContent>
        </Card>

        {/* Average Price Per Slip */}
        <Card className="border-border/40 hover:border-primary/50 transition-colors" data-testid="card-stat-avg-pps">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Home className="h-4 w-4" />
              Avg Price/Slip
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground truncate">
              {formatCurrency(stats.avgPricePerSlip, true)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Per wet slip
            </p>
          </CardContent>
        </Card>

        {/* Median Price Per Slip */}
        <Card className="border-border/40 hover:border-primary/50 transition-colors" data-testid="card-stat-median-pps">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Home className="h-4 w-4" />
              Median Price/Slip
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground truncate">
              {formatCurrency(stats.medianPricePerSlip, true)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              50th percentile
            </p>
          </CardContent>
        </Card>

        {/* Average Cap Rate */}
        <Card className="border-border/40 hover:border-primary/50 transition-colors" data-testid="card-stat-avg-cap-rate">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Percent className="h-4 w-4" />
              Avg Cap Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground truncate">
              {stats.avgCapRate > 0 ? formatPercent(stats.avgCapRate) : 'N/A'}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Mean yield
            </p>
          </CardContent>
        </Card>

        {/* Average Capacity */}
        <Card className="border-border/40 hover:border-primary/50 transition-colors" data-testid="card-stat-avg-capacity">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Database className="h-4 w-4" />
              Avg Capacity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground truncate">
              {Math.round(stats.avgCapacity).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Slips per marina
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
