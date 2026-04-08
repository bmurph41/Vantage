import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { TrendingUp, TrendingDown, Minus, DollarSign, Ship, Calendar } from "lucide-react";
import { formatCurrency, formatPercent } from "@/lib/utils";
import type { MarinaRate } from "@shared/schema";

interface MarinaRateHistoryPanelProps {
  marinaId: string;
  rates: MarinaRate[];
  showCurrentOnly: boolean;
}

const STORAGE_TYPE_COLORS: Record<string, string> = {
  "Wet Slip": "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  "Dry Storage": "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  "Mooring": "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200",
  "Covered Slip": "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
};

export default function MarinaRateHistoryPanel({ marinaId, rates, showCurrentOnly }: MarinaRateHistoryPanelProps) {
  const filteredRates = useMemo(() => {
    if (showCurrentOnly) {
      return rates.filter(r => r.isCurrentRate);
    }
    return rates;
  }, [rates, showCurrentOnly]);

  const groupedByYear = useMemo(() => {
    const groups: Record<number, MarinaRate[]> = {};
    filteredRates.forEach(rate => {
      const year = rate.rateYear || new Date().getFullYear();
      if (!groups[year]) groups[year] = [];
      groups[year].push(rate);
    });
    return Object.entries(groups)
      .sort(([a], [b]) => Number(b) - Number(a))
      .map(([year, ratesInYear]) => ({
        year: Number(year),
        rates: ratesInYear.sort((a, b) => {
          if (a.storageType !== b.storageType) return (a.storageType || "").localeCompare(b.storageType || "");
          return (a.loaMin || 0) - (b.loaMin || 0);
        })
      }));
  }, [filteredRates]);

  const formatPercentageLocal = (value: number) => {
    return formatPercent(value);
  };

  const getTrend = (currentRate: MarinaRate) => {
    if (!showCurrentOnly) return null;
    const historicalRates = rates.filter(
      r => r.storageType === currentRate.storageType &&
           r.loaMin === currentRate.loaMin &&
           !r.isCurrentRate
    );
    if (historicalRates.length === 0) return null;
    
    const previousRate = historicalRates.sort((a, b) => (b.rateYear || 0) - (a.rateYear || 0))[0];
    if (!previousRate.monthlyRate || !currentRate.monthlyRate) return null;
    
    const change = ((currentRate.monthlyRate - previousRate.monthlyRate) / previousRate.monthlyRate) * 100;
    return { change, previousYear: previousRate.rateYear };
  };

  if (filteredRates.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-8">
        <DollarSign className="h-10 w-10 mb-3 opacity-50" />
        <p className="font-medium">No rates recorded</p>
        <p className="text-sm mt-1">Add rates to start tracking pricing</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full pr-4">
      <div className="space-y-6">
        {groupedByYear.map(({ year, rates: yearRates }) => (
          <div key={year}>
            <div className="flex items-center gap-2 mb-3">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <h3 className="font-semibold text-sm">{year}</h3>
              <Badge variant="secondary" className="text-xs">
                {yearRates.length} rate{yearRates.length !== 1 ? "s" : ""}
              </Badge>
            </div>

            <div className="space-y-2">
              {yearRates.map((rate) => {
                const trend = getTrend(rate);
                const colorClass = STORAGE_TYPE_COLORS[rate.storageType || ""] || "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200";
                
                return (
                  <div
                    key={rate.id}
                    className="p-3 bg-muted/50 rounded-lg border"
                    data-testid={`rate-item-${rate.id}`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <Badge className={`${colorClass} font-medium`}>
                        {rate.storageType}
                      </Badge>
                      {rate.rateSeason && (
                        <Badge variant="outline" className="text-xs">
                          {rate.rateSeason}
                        </Badge>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                      <div>
                        <div className="text-muted-foreground text-xs">LOA Range</div>
                        <div className="font-medium">
                          {rate.loaMin}' - {rate.loaMax}'
                        </div>
                      </div>
                      <div>
                        <div className="text-muted-foreground text-xs">Monthly Rate</div>
                        <div className="font-semibold text-primary">
                          {formatCurrency(rate.monthlyRate)}
                        </div>
                      </div>
                    </div>

                    {rate.ratePerFoot && (
                      <div className="mt-2 text-sm">
                        <span className="text-muted-foreground">Per foot: </span>
                        <span className="font-medium">{formatCurrency(rate.ratePerFoot)}/ft</span>
                      </div>
                    )}

                    {trend && (
                      <div className="mt-2 pt-2 border-t flex items-center gap-1 text-xs">
                        {trend.change > 0 ? (
                          <>
                            <TrendingUp className="h-3 w-3 text-green-500" />
                            <span className="text-green-600">+{formatPercentageLocal(trend.change)}</span>
                          </>
                        ) : trend.change < 0 ? (
                          <>
                            <TrendingDown className="h-3 w-3 text-red-500" />
                            <span className="text-red-600">{formatPercentageLocal(trend.change)}</span>
                          </>
                        ) : (
                          <>
                            <Minus className="h-3 w-3 text-gray-500" />
                            <span className="text-gray-600">No change</span>
                          </>
                        )}
                        <span className="text-muted-foreground ml-1">vs {trend.previousYear}</span>
                      </div>
                    )}

                    {rate.notes && (
                      <div className="mt-2 text-xs text-muted-foreground italic">
                        {rate.notes}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
