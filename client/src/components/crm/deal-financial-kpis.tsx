/**
 * DealFinancialKPIs
 * 
 * Renders computed KPI cards at the top of the deal detail panel.
 * KPIs are driven by the asset class configuration, so a Marina shows
 * Rev/Slip and Occupancy while Multifamily shows Price/Unit and Rent Spread.
 */

import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Info, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { getAssetClassConfig, formatKPIValue, type KPIDefinition } from "./asset-class-fields";
import type { Deal } from "@shared/schema";

// ─── Types ────────────────────────────────────────────────────────

interface DealFinancialKPIsProps {
  deal: Deal;
  className?: string;
}

interface ComputedKPI {
  definition: KPIDefinition;
  value: number | null;
  formatted: string;
  trend?: "up" | "down" | "flat";
}

// ─── Component ────────────────────────────────────────────────────

export function DealFinancialKPIs({ deal, className }: DealFinancialKPIsProps) {
  const config = getAssetClassConfig((deal as any).assetClass || (deal as any).asset_class);

  const computedKPIs = useMemo<ComputedKPI[]>(() => {
    // Merge deal fields — handle both camelCase and snake_case
    const entity: Record<string, any> = {
      ...deal,
      askingPrice: (deal as any).askingPrice || (deal as any).asking_price || deal.amount,
      offerPrice: (deal as any).offerPrice || (deal as any).offer_price,
      noi: (deal as any).noi || (deal as any).netOperatingIncome,
      capRate: (deal as any).capRate || (deal as any).cap_rate,
      wetSlips: (deal as any).wetSlips || (deal as any).wet_slips,
      drySlips: (deal as any).drySlips || (deal as any).dry_slips,
      slipRevenue: (deal as any).slipRevenue || (deal as any).slip_revenue,
      fuelRevenue: (deal as any).fuelRevenue || (deal as any).fuel_revenue,
      serviceRevenue: (deal as any).serviceRevenue || (deal as any).service_revenue,
      retailRevenue: (deal as any).retailRevenue || (deal as any).retail_revenue,
      storageRevenue: (deal as any).storageRevenue || (deal as any).storage_revenue,
      totalUnits: (deal as any).totalUnits || (deal as any).total_units,
      totalSF: (deal as any).totalSF || (deal as any).total_sf,
      avgRent: (deal as any).avgRent || (deal as any).avg_rent,
      marketRent: (deal as any).marketRent || (deal as any).market_rent,
      occupancyRate: (deal as any).occupancyRate || (deal as any).occupancy_rate,
      walt: (deal as any).walt,
      netRentableSF: (deal as any).netRentableSF || (deal as any).net_rentable_sf,
    };

    return config.kpis.map(kpi => {
      const value = kpi.compute ? kpi.compute(entity) : (entity[kpi.key] ?? null);
      return {
        definition: kpi,
        value,
        formatted: formatKPIValue(value, kpi.format),
      };
    });
  }, [deal, config]);

  // Only show KPIs that have computed values OR are primary (always show first 2)
  const visibleKPIs = computedKPIs.filter((kpi, i) => i < 2 || kpi.value !== null);

  if (visibleKPIs.length === 0) return null;

  return (
    <TooltipProvider>
      <div className={cn("grid gap-2", className, 
        visibleKPIs.length <= 2 && "grid-cols-2",
        visibleKPIs.length === 3 && "grid-cols-3",
        visibleKPIs.length >= 4 && "grid-cols-4"
      )}>
        {visibleKPIs.map((kpi) => (
          <KPICard key={kpi.definition.key} kpi={kpi} />
        ))}
      </div>
    </TooltipProvider>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────

function KPICard({ kpi }: { kpi: ComputedKPI }) {
  const Icon = kpi.definition.icon;
  const hasValue = kpi.value !== null;

  return (
    <Card className={cn(
      "px-3 py-2.5 border transition-colors",
      hasValue ? "bg-card" : "bg-muted/30 border-dashed"
    )}>
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
              {kpi.definition.label}
            </span>
            {kpi.definition.tooltip && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-2.5 w-2.5 text-muted-foreground/50 cursor-help" />
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs max-w-[200px]">
                  {kpi.definition.tooltip}
                </TooltipContent>
              </Tooltip>
            )}
          </div>
          <p className={cn(
            "text-lg font-semibold tabular-nums leading-none",
            hasValue ? kpi.definition.color : "text-muted-foreground"
          )}>
            {kpi.formatted}
          </p>
        </div>
        <div className={cn(
          "p-1.5 rounded-md",
          hasValue ? "bg-muted" : "bg-transparent"
        )}>
          <Icon className={cn("h-3.5 w-3.5", hasValue ? kpi.definition.color : "text-muted-foreground/40")} />
        </div>
      </div>
    </Card>
  );
}

// ─── Inline KPI Strip (for compact views) ─────────────────────────

export function DealKPIStrip({ deal, className }: DealFinancialKPIsProps) {
  const config = getAssetClassConfig((deal as any).assetClass || (deal as any).asset_class);

  const kpis = useMemo(() => {
    const entity: Record<string, any> = { ...deal, askingPrice: deal.amount };
    return config.kpis.slice(0, 3).map(kpi => ({
      label: kpi.label,
      value: formatKPIValue(kpi.compute ? kpi.compute(entity) : null, kpi.format),
      color: kpi.color,
    }));
  }, [deal, config]);

  return (
    <div className={cn("flex items-center gap-3 text-xs", className)}>
      {kpis.map((kpi, i) => (
        <span key={i} className="flex items-center gap-1">
          <span className="text-muted-foreground">{kpi.label}:</span>
          <span className={cn("font-medium", kpi.color)}>{kpi.value}</span>
        </span>
      ))}
    </div>
  );
}

export default DealFinancialKPIs;
