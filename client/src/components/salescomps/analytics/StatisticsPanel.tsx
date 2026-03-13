import { TrendingUp, TrendingDown, Minus, DollarSign, Home, Percent, Database, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { formatCurrency, formatPercent } from "@/lib/utils";

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

// ─── Skeleton loader ──────────────────────────────────────────────────────────

function StatSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-5 py-4 animate-pulse">
      <div className="h-3 w-20 bg-slate-100 rounded mb-3" />
      <div className="h-7 w-28 bg-slate-100 rounded mb-2" />
      <div className="h-2.5 w-16 bg-slate-100 rounded" />
    </div>
  );
}

// ─── Individual stat card ─────────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  primary: string;
  secondary?: string;
  secondaryLabel?: string;
  delta?: number; // positive = up, negative = down
  deltaLabel?: string;
  icon: React.ElementType;
  accent: string;
  accentText: string;
  testId?: string;
}

function StatCard({
  label, primary, secondary, secondaryLabel,
  delta, deltaLabel, icon: Icon, accent, accentText, testId,
}: StatCardProps) {
  const hasDelta = delta !== undefined;
  const isUp = hasDelta && delta > 0.05;
  const isDown = hasDelta && delta < -0.05;

  return (
    <div
      className="bg-white rounded-xl border border-slate-200 shadow-sm px-5 py-4 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
      data-testid={testId}
    >
      <div className="flex items-start justify-between mb-2.5">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 leading-none">{label}</p>
        <div className={`w-7 h-7 rounded-lg ${accent} ${accentText} flex items-center justify-center flex-shrink-0`}>
          <Icon className="w-3.5 h-3.5" />
        </div>
      </div>

      <p className="text-[22px] font-bold text-slate-900 leading-none tabular-nums">{primary}</p>

      <div className="flex items-center justify-between mt-2">
        {secondary && (
          <span className="text-[11px] text-slate-400">
            {secondaryLabel && <span className="text-slate-300 mr-1">{secondaryLabel}</span>}
            {secondary}
          </span>
        )}
        {hasDelta && (
          <span className={`flex items-center gap-0.5 text-[11px] font-semibold ${
            isUp ? 'text-emerald-600' : isDown ? 'text-red-500' : 'text-slate-400'
          }`}>
            {isUp && <ArrowUpRight className="w-3 h-3" />}
            {isDown && <ArrowDownRight className="w-3 h-3" />}
            {!isUp && !isDown && <Minus className="w-3 h-3" />}
            {deltaLabel}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Main panel ───────────────────────────────────────────────────────────────

export default function StatisticsPanel({ stats, isLoading }: StatisticsPanelProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 8 }).map((_, i) => <StatSkeleton key={i} />)}
      </div>
    );
  }

  const priceVsMedian = stats.medianPrice > 0
    ? (stats.avgPrice - stats.medianPrice) / stats.medianPrice
    : 0;
  const capRatePremium = stats.medianCapRate > 0
    ? (stats.avgCapRate - stats.medianCapRate) / stats.medianCapRate
    : 0;

  const cards: StatCardProps[] = [
    {
      label: "Sample Size",
      primary: stats.count.toLocaleString(),
      secondary: "comparables analyzed",
      icon: Database,
      accent: "bg-slate-100",
      accentText: "text-slate-500",
      testId: "card-stat-count",
    },
    {
      label: "Average Price",
      primary: formatCurrency(stats.avgPrice),
      secondary: formatCurrency(stats.medianPrice),
      secondaryLabel: "Median:",
      delta: priceVsMedian,
      deltaLabel: priceVsMedian >= 0 ? `+${(priceVsMedian * 100).toFixed(1)}% vs median` : `${(priceVsMedian * 100).toFixed(1)}% vs median`,
      icon: DollarSign,
      accent: "bg-emerald-50",
      accentText: "text-emerald-600",
      testId: "card-stat-avg-price",
    },
    {
      label: "Price / Slip",
      primary: formatCurrency(stats.avgPricePerSlip),
      secondary: formatCurrency(stats.medianPricePerSlip),
      secondaryLabel: "Median:",
      icon: Home,
      accent: "bg-blue-50",
      accentText: "text-blue-600",
      testId: "card-stat-price-per-slip",
    },
    {
      label: "Avg Capacity",
      primary: stats.avgCapacity.toFixed(0),
      secondary: "slips / marina",
      icon: Home,
      accent: "bg-cyan-50",
      accentText: "text-cyan-600",
      testId: "card-stat-avg-capacity",
    },
    {
      label: "Avg Cap Rate",
      primary: `${(stats.avgCapRate * 100).toFixed(2)}%`,
      secondary: `${(stats.medianCapRate * 100).toFixed(2)}%`,
      secondaryLabel: "Median:",
      delta: capRatePremium,
      deltaLabel: capRatePremium >= 0 ? `+${(capRatePremium * 100).toFixed(1)}% vs median` : `${(capRatePremium * 100).toFixed(1)}% vs median`,
      icon: Percent,
      accent: "bg-orange-50",
      accentText: "text-orange-600",
      testId: "card-stat-cap-rate",
    },
    {
      label: "Total Portfolio Value",
      primary: formatCurrency(stats.totalValue),
      secondary: `${stats.count} transactions`,
      icon: TrendingUp,
      accent: "bg-purple-50",
      accentText: "text-purple-600",
      testId: "card-stat-total-value",
    },
  ];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        {cards.map((card) => (
          <StatCard key={card.label} {...card} />
        ))}
      </div>
    </div>
  );
}
