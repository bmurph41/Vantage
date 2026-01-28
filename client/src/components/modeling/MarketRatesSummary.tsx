import { useEffect, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, TrendingDown, Minus, ExternalLink, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { useAllMarketRates } from "@/hooks/use-market-rates";
import { Button } from "@/components/ui/button";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface MarketRatesSummaryProps {
  compact?: boolean;
  className?: string;
}

export function MarketRatesSummary({ compact = false, className }: MarketRatesSummaryProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { 
    getSofrOvernight, 
    getPrimeRate, 
    getTreasury, 
    latestDataDate, 
    isLoading 
  } = useAllMarketRates();

  const hasAttemptedAutoRefresh = useRef(false);

  const refreshMutation = useMutation({
    mutationFn: () => apiRequest("/api/capital-markets/rates/refresh", { 
      method: "POST", 
      body: JSON.stringify({ lookbackDays: 30 }) 
    }),
    onSuccess: () => {
      toast({ title: "Rates Updated", description: "Market rates have been refreshed" });
      queryClient.invalidateQueries({ queryKey: ["/api/capital-markets/rates/latest"] });
      queryClient.invalidateQueries({ queryKey: ["/api/capital-markets/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/capital-markets/forward-curve"] });
    },
    onError: (error: any) => {
      toast({ title: "Refresh Failed", description: error.message, variant: "destructive" });
    },
  });

  const sofrValue = getSofrOvernight();
  const primeValue = getPrimeRate();
  const treasury5y = getTreasury("5y");
  const treasury10y = getTreasury("10y");

  useEffect(() => {
    if (!isLoading && !hasAttemptedAutoRefresh.current && 
        sofrValue === null && primeValue === null && 
        treasury5y === null && treasury10y === null &&
        !refreshMutation.isPending) {
      hasAttemptedAutoRefresh.current = true;
      refreshMutation.mutate();
    }
  }, [isLoading, sofrValue, primeValue, treasury5y, treasury10y, refreshMutation]);

  const rates = [
    { 
      label: "SOFR O/N", 
      value: sofrValue, 
      description: "Base floating rate",
    },
    { 
      label: "Prime", 
      value: primeValue, 
      description: "Bank lending benchmark",
    },
    { 
      label: "5Y Treasury", 
      value: treasury5y, 
      description: "Mid-term risk-free",
    },
    { 
      label: "10Y Treasury", 
      value: treasury10y, 
      description: "Long-term benchmark",
    },
  ];

  if (compact) {
    return (
      <div className={`flex items-center gap-4 text-sm ${className}`}>
        {isLoading ? (
          <>
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-5 w-20" />
          </>
        ) : (
          <>
            {rates.slice(0, 3).map((rate) => (
              <div key={rate.label} className="flex items-center gap-1.5">
                <span className="text-muted-foreground">{rate.label}:</span>
                <span className="font-medium tabular-nums">
                  {rate.value !== null ? `${rate.value.toFixed(2)}%` : "N/A"}
                </span>
              </div>
            ))}
            {latestDataDate && (
              <Badge variant="outline" className="text-xs">
                {format(latestDataDate, "MMM d")}
              </Badge>
            )}
          </>
        )}
      </div>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Market Rates
            </CardTitle>
            <CardDescription>
              Live rates from FRED
              {latestDataDate && (
                <span className="ml-1">({format(latestDataDate, "MMM d, yyyy")})</span>
              )}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => refreshMutation.mutate()}
              disabled={refreshMutation.isPending}
            >
              <RefreshCw className={`h-4 w-4 ${refreshMutation.isPending ? "animate-spin" : ""}`} />
            </Button>
            <a
              href="/analysis/capital-markets"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
            >
              Full View
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="space-y-1">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-6 w-12" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {rates.map((rate) => (
              <div key={rate.label} className="space-y-0.5">
                <div className="text-xs text-muted-foreground">{rate.label}</div>
                <div className="text-lg font-semibold tabular-nums">
                  {rate.value !== null ? `${rate.value.toFixed(2)}%` : "N/A"}
                </div>
                <div className="text-xs text-muted-foreground">{rate.description}</div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function MarketRatesInline() {
  const { getSofrOvernight, getTreasury, latestDataDate, isLoading } = useAllMarketRates();

  if (isLoading) {
    return <Skeleton className="h-5 w-40 inline-block" />;
  }

  const sofr = getSofrOvernight();
  const treasury10y = getTreasury("10y");

  return (
    <span className="text-sm text-muted-foreground">
      SOFR: {sofr?.toFixed(2) ?? "N/A"}% | 10Y: {treasury10y?.toFixed(2) ?? "N/A"}%
      {latestDataDate && (
        <span className="ml-1 text-xs">({format(latestDataDate, "M/d")})</span>
      )}
    </span>
  );
}
