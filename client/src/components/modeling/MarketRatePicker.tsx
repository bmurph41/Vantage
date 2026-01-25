import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, ChevronDown, Check, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import {
  useAllMarketRates,
  COMMON_FINANCING_RATES,
  RATE_TYPE_LABELS,
  TENOR_LABELS,
  type RateType,
  type Tenor,
} from "@/hooks/use-market-rates";
import { cn } from "@/lib/utils";

interface MarketRatePickerProps {
  onSelectRate: (rate: number, label: string) => void;
  currentValue?: number;
  showCurrentRate?: boolean;
  compact?: boolean;
  className?: string;
  buttonLabel?: string;
  filterRateTypes?: RateType[];
}

export function MarketRatePicker({
  onSelectRate,
  currentValue,
  showCurrentRate = true,
  compact = false,
  className,
  buttonLabel = "Use Market Rate",
  filterRateTypes,
}: MarketRatePickerProps) {
  const [open, setOpen] = useState(false);
  const { isLoading, latestDataDate, getRate, getCommonRate } = useAllMarketRates();

  const filteredRates = filterRateTypes
    ? COMMON_FINANCING_RATES.filter(r => filterRateTypes.includes(r.rateType))
    : COMMON_FINANCING_RATES;

  const handleSelectRate = (rateId: string, label: string) => {
    const rate = getCommonRate(rateId);
    if (rate !== null) {
      onSelectRate(rate, label);
      setOpen(false);
    }
  };

  if (compact) {
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={cn("h-6 px-2 text-xs text-primary hover:text-primary", className)}
            disabled={isLoading}
          >
            <TrendingUp className="w-3 h-3 mr-1" />
            Live
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-0" align="start">
          <MarketRateList
            rates={filteredRates}
            getCommonRate={getCommonRate}
            latestDataDate={latestDataDate}
            isLoading={isLoading}
            onSelect={handleSelectRate}
            currentValue={currentValue}
          />
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn("gap-2", className)}
          disabled={isLoading}
        >
          <TrendingUp className="w-4 h-4" />
          {buttonLabel}
          <ChevronDown className="w-3 h-3 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <MarketRateList
          rates={filteredRates}
          getCommonRate={getCommonRate}
          latestDataDate={latestDataDate}
          isLoading={isLoading}
          onSelect={handleSelectRate}
          currentValue={currentValue}
          showCurrentRate={showCurrentRate}
        />
      </PopoverContent>
    </Popover>
  );
}

interface MarketRateListProps {
  rates: typeof COMMON_FINANCING_RATES;
  getCommonRate: (rateId: string) => number | null;
  latestDataDate: Date | null;
  isLoading: boolean;
  onSelect: (rateId: string, label: string) => void;
  currentValue?: number;
  showCurrentRate?: boolean;
}

function MarketRateList({
  rates,
  getCommonRate,
  latestDataDate,
  isLoading,
  onSelect,
  currentValue,
  showCurrentRate = true,
}: MarketRateListProps) {
  const groupedRates = rates.reduce((acc, rate) => {
    const group = RATE_TYPE_LABELS[rate.rateType];
    if (!acc[group]) acc[group] = [];
    acc[group].push(rate);
    return acc;
  }, {} as Record<string, typeof rates>);

  return (
    <div className="max-h-80 overflow-y-auto">
      <div className="px-3 py-2 border-b bg-muted/50">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Current Market Rates</span>
          {latestDataDate && (
            <Badge variant="outline" className="text-xs">
              {format(latestDataDate, "MMM d")}
            </Badge>
          )}
        </div>
      </div>
      
      {isLoading ? (
        <div className="p-3 space-y-2">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </div>
      ) : (
        <div className="py-1">
          {Object.entries(groupedRates).map(([group, groupRates]) => (
            <div key={group}>
              <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {group}
              </div>
              {groupRates.map(rate => {
                const rateValue = getCommonRate(rate.id);
                const isCurrentValue = currentValue !== undefined && 
                  rateValue !== null && 
                  Math.abs(currentValue - rateValue) < 0.01;
                
                return (
                  <button
                    key={rate.id}
                    className="w-full px-3 py-2 text-left hover:bg-muted flex items-center justify-between group"
                    onClick={() => onSelect(rate.id, rate.label)}
                    disabled={rateValue === null}
                  >
                    <span className="text-sm">{rate.label}</span>
                    <div className="flex items-center gap-2">
                      {rateValue !== null ? (
                        <>
                          <span className="text-sm font-medium tabular-nums">
                            {rateValue.toFixed(2)}%
                          </span>
                          {isCurrentValue && showCurrentRate && (
                            <Check className="w-4 h-4 text-primary" />
                          )}
                        </>
                      ) : (
                        <span className="text-xs text-muted-foreground">N/A</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}
      
      <div className="px-3 py-2 border-t bg-muted/30">
        <a
          href="/analysis/capital-markets"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          View full Capital Markets data
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    </div>
  );
}

interface CurrentRateBadgeProps {
  rateType: RateType;
  tenor: Tenor;
  className?: string;
}

export function CurrentRateBadge({ rateType, tenor, className }: CurrentRateBadgeProps) {
  const { getRate, latestDataDate, isLoading } = useAllMarketRates();
  const rate = getRate(rateType, tenor);

  if (isLoading) {
    return <Skeleton className={cn("h-5 w-16", className)} />;
  }

  if (rate === null) return null;

  const label = `${RATE_TYPE_LABELS[rateType]} ${TENOR_LABELS[tenor]}`;

  return (
    <Badge variant="secondary" className={cn("text-xs font-normal gap-1", className)}>
      <TrendingUp className="w-3 h-3" />
      {label}: {rate.toFixed(2)}%
      {latestDataDate && (
        <span className="text-muted-foreground ml-1">
          ({format(latestDataDate, "MMM d")})
        </span>
      )}
    </Badge>
  );
}

interface MarketRateContextProps {
  currentRate: number;
  rateType: RateType;
  tenor: Tenor;
  spreadBps?: number;
  className?: string;
}

export function MarketRateContext({
  currentRate,
  rateType,
  tenor,
  spreadBps,
  className,
}: MarketRateContextProps) {
  const { getRate, latestDataDate, isLoading } = useAllMarketRates();
  const marketRate = getRate(rateType, tenor);

  if (isLoading || marketRate === null) return null;

  const difference = currentRate - marketRate;
  const differenceAbs = Math.abs(difference);
  const diffBps = Math.round(differenceAbs * 100);

  return (
    <div className={cn("text-xs text-muted-foreground flex items-center gap-1", className)}>
      <TrendingUp className="w-3 h-3" />
      <span>
        Current {RATE_TYPE_LABELS[rateType]} {TENOR_LABELS[tenor]}: {marketRate.toFixed(2)}%
      </span>
      {spreadBps !== undefined && (
        <span className="ml-1">
          (+{spreadBps}bps spread = {(marketRate + spreadBps / 100).toFixed(2)}%)
        </span>
      )}
      {difference !== 0 && !spreadBps && (
        <Badge variant={difference > 0 ? "destructive" : "default"} className="text-xs ml-1">
          {difference > 0 ? "+" : ""}{diffBps}bps vs market
        </Badge>
      )}
    </div>
  );
}
