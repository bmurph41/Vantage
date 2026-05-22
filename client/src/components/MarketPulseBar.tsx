import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { TrendingUp, TrendingDown, Minus, ChevronDown, ChevronUp, Activity, DollarSign, Anchor, BarChart3, Percent } from "lucide-react";
import { cn } from "@/lib/utils";

interface PulseData {
  avgCapRate: number | null;
  capRateTrend: number | null;
  dealCount: number;
  totalVolume: number;
  avgPricePerSlip: number | null;
  avgOccupancy: number | null;
  dataPoints: number;
  asOf: string;
}

function fmtM(n: number): string {
  if (Math.abs(n) >= 1e9) return `$${(Math.abs(n) / 1e9).toFixed(1)}B`;
  if (Math.abs(n) >= 1e6) return `$${(Math.abs(n) / 1e6).toFixed(1)}M`;
  if (Math.abs(n) >= 1e3) return `$${(Math.abs(n) / 1e3).toFixed(0)}K`;
  return `$${Math.abs(n).toLocaleString()}`;
}

function TrendBadge({ val }: { val: number | null }) {
  if (val == null) return <Minus className="h-3 w-3 text-muted-foreground" />;
  if (val > 0.01) return <TrendingUp className="h-3 w-3 text-red-500" />;
  if (val < -0.01) return <TrendingDown className="h-3 w-3 text-emerald-500" />;
  return <Minus className="h-3 w-3 text-muted-foreground" />;
}

function PulseIndicator({ label, value, icon: Icon, trend }: {
  label: string;
  value: string;
  icon: any;
  trend?: number | null;
}) {
  return (
    <div className="flex items-center gap-1.5 px-3 border-r border-border/40 last:border-r-0">
      <Icon className="h-3 w-3 text-muted-foreground shrink-0" />
      <span className="text-[11px] text-muted-foreground hidden sm:inline">{label}:</span>
      <span className="text-[11px] font-semibold font-mono">{value}</span>
      {trend !== undefined && <TrendBadge val={trend} />}
    </div>
  );
}

export function MarketPulseBar() {
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("market-pulse-collapsed") === "true";
    }
    return false;
  });

  const { data, isLoading } = useQuery<PulseData>({
    queryKey: ["/api/market-intelligence/pulse"],
    staleTime: 1000 * 60 * 15,
    refetchInterval: 1000 * 60 * 15,
    refetchOnWindowFocus: false,
  });

  const toggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem("market-pulse-collapsed", String(next));
  };

  if (isLoading) return null;

  if (!data || data.dataPoints === 0) return null;

  const indicators = [
    {
      label: "Cap Rate",
      value: data.avgCapRate != null ? `${Number(data.avgCapRate).toFixed(2)}%` : "—",
      icon: Percent,
      trend: data.capRateTrend,
    },
    {
      label: "Deals (T12M)",
      value: data.dealCount > 0 ? String(data.dealCount) : "—",
      icon: BarChart3,
    },
    {
      label: "Volume",
      value: data.totalVolume > 0 ? fmtM(data.totalVolume) : "—",
      icon: DollarSign,
    },
    {
      label: "Avg $/Slip",
      value: data.avgPricePerSlip != null ? fmtM(data.avgPricePerSlip) : "—",
      icon: Anchor,
    },
    {
      label: "Occupancy",
      value: data.avgOccupancy != null ? `${Number(data.avgOccupancy).toFixed(1)}%` : "—",
      icon: Activity,
    },
  ];

  return (
    <div className={cn(
      "hidden md:block border-b border-border/50 bg-muted/30 text-foreground transition-all duration-200",
    )}>
      {collapsed ? (
        <div className="flex items-center justify-between px-3 py-0.5">
          <button onClick={toggle} className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors">
            <Activity className="h-3 w-3" />
            <span>Market Pulse</span>
            <ChevronDown className="h-3 w-3" />
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-between px-2 py-1">
          <div className="flex items-center overflow-x-auto scrollbar-hide">
            <Link href="/analysis/market-intelligence">
              <span className="flex items-center gap-1 px-2 border-r border-border/40 cursor-pointer hover:text-primary transition-colors shrink-0">
                <Activity className="h-3 w-3 text-primary" />
                <span className="text-[11px] font-semibold text-primary hidden sm:inline">Market Pulse</span>
              </span>
            </Link>
            {indicators.map(ind => (
              <PulseIndicator
                key={ind.label}
                label={ind.label}
                value={ind.value}
                icon={ind.icon}
                trend={"trend" in ind ? ind.trend : undefined}
              />
            ))}
          </div>
          <button onClick={toggle} className="ml-2 p-0.5 text-muted-foreground hover:text-foreground transition-colors shrink-0">
            <ChevronUp className="h-3 w-3" />
          </button>
        </div>
      )}
    </div>
  );
}
