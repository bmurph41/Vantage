/**
 * PipelineAnalyticsDashboard
 * 
 * Comprehensive pipeline analytics with 4 sections:
 *   1. Health Score gauge (composite 0-100)
 *   2. Stage Velocity chart (horizontal bar — avg days per stage)
 *   3. Conversion Funnel (stage progression with drop-off)
 *   4. Win/Loss Analysis (breakdown by source, asset class, monthly trend)
 * 
 * Data from: /api/crm/analytics/* endpoints
 * 
 * Usage:
 *   - Standalone page at /crm/pipeline-insights or /crm/deal-analytics
 *   - Or embed sections individually: <VelocityChart />, <WinLossAnalysis />, etc.
 */

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, Cell, PieChart, Pie, Legend, LineChart, Line,
  FunnelChart, Funnel, LabelList,
} from "recharts";
import {
  Activity, TrendingUp, TrendingDown, BarChart3, Target,
  AlertTriangle, Clock, DollarSign, Trophy, XCircle,
  Filter, RefreshCw, ChevronDown, Zap, Shield, Gauge,
  ArrowUp, ArrowDown, Minus, Info,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { ASSET_CLASS_OPTIONS } from "../asset-class-fields";

// ─── Types ────────────────────────────────────────────────────────

interface AnalyticsFilters {
  assetClass: string;
  dateRange: string;
}

interface HealthData {
  score: number;
  breakdown: {
    winRate: { score: number; max: number; value: number };
    freshness: { score: number; max: number; value: number };
    coverage: { score: number; max: number; value: number };
    velocity: { score: number; max: number; value: number };
  };
  summary: {
    openDeals: number;
    wonDeals: number;
    lostDeals: number;
    pipelineValue: number;
    wonValue: number;
    avgAgeDays: number;
    staleCount: number;
  };
}

interface VelocityData {
  stages: { stage: string; deal_count: number; avg_days: number; total_value: number }[];
}

interface WinLossData {
  won: { count: number; totalValue: number; avgDealSize: number };
  lost: { count: number; totalValue: number; avgDealSize: number };
  winRate: number;
  bySource: { source: string; status: string; count: number; total_value: number }[];
  monthlyTrend: { month: string; status: string; count: number; total_value: number }[];
}

interface ConversionData {
  stages: { stage: string; status: string; count: number; total_value: number }[];
}

// ─── Stage Labels ─────────────────────────────────────────────────

const STAGE_LABELS: Record<string, string> = {
  lead: "Lead",
  qualified: "Qualified",
  loi: "LOI",
  due_diligence: "Due Diligence",
  under_contract: "Under Contract",
  closing: "Closing",
};

const STAGE_COLORS = ["#3b82f6", "#8b5cf6", "#06b6d4", "#f59e0b", "#10b981", "#ef4444"];

// ─── Main Dashboard ───────────────────────────────────────────────

export function PipelineAnalyticsDashboard() {
  const [filters, setFilters] = useState<AnalyticsFilters>({
    assetClass: "all",
    dateRange: "all",
  });

  const queryParams = filters.assetClass !== "all" ? `?assetClass=${filters.assetClass}` : "";

  const { data: health, isLoading: healthLoading } = useQuery<HealthData>({
    queryKey: ["/api/crm/analytics/health", filters],
  });

  const { data: velocity, isLoading: velocityLoading } = useQuery<VelocityData>({
    queryKey: [`/api/crm/analytics/velocity${queryParams}`, filters],
  });

  const { data: winLoss, isLoading: winLossLoading } = useQuery<WinLossData>({
    queryKey: [`/api/crm/analytics/win-loss${queryParams}`, filters],
  });

  const { data: conversion, isLoading: conversionLoading } = useQuery<ConversionData>({
    queryKey: [`/api/crm/analytics/conversion${queryParams}`, filters],
  });

  return (
    <div className="space-y-6">
      {/* ── Header & Filters ──────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Pipeline Analytics</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Performance insights across your deal pipeline
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={filters.assetClass}
            onValueChange={(v) => setFilters((f) => ({ ...f, assetClass: v }))}
          >
            <SelectTrigger className="h-8 w-[160px] text-xs">
              <SelectValue placeholder="Asset Class" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Asset Classes</SelectItem>
              {ASSET_CLASS_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* ── KPI Summary Row ───────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <SummaryCard
          title="Pipeline Value"
          value={formatCurrency(health?.summary.pipelineValue)}
          icon={DollarSign}
          color="text-blue-600"
          loading={healthLoading}
        />
        <SummaryCard
          title="Open Deals"
          value={String(health?.summary.openDeals ?? 0)}
          icon={Target}
          color="text-purple-600"
          loading={healthLoading}
        />
        <SummaryCard
          title="Win Rate"
          value={`${winLoss?.winRate ?? 0}%`}
          icon={Trophy}
          color="text-green-600"
          loading={winLossLoading}
        />
        <SummaryCard
          title="Avg Days in Stage"
          value={`${health?.summary.avgAgeDays ?? 0}d`}
          icon={Clock}
          color="text-amber-600"
          loading={healthLoading}
        />
        <SummaryCard
          title="Stale Deals"
          value={String(health?.summary.staleCount ?? 0)}
          icon={AlertTriangle}
          color="text-red-600"
          loading={healthLoading}
          alert={Number(health?.summary.staleCount) > 0}
        />
      </div>

      {/* ── Main Grid: Health + Velocity ──────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Health Score */}
        <Card className="col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Shield className="h-4 w-4 text-muted-foreground" />
              Pipeline Health
            </CardTitle>
          </CardHeader>
          <CardContent>
            {healthLoading ? (
              <Skeleton className="h-48 w-full" />
            ) : (
              <HealthScoreGauge health={health!} />
            )}
          </CardContent>
        </Card>

        {/* Velocity Chart */}
        <Card className="col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Zap className="h-4 w-4 text-muted-foreground" />
              Stage Velocity
            </CardTitle>
            <CardDescription className="text-xs">
              Average days deals spend in each pipeline stage
            </CardDescription>
          </CardHeader>
          <CardContent>
            {velocityLoading ? (
              <Skeleton className="h-48 w-full" />
            ) : (
              <VelocityChart data={velocity!} />
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Second Row: Funnel + Win/Loss ─────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Conversion Funnel */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
              Conversion Funnel
            </CardTitle>
            <CardDescription className="text-xs">
              Deals progressing through pipeline stages
            </CardDescription>
          </CardHeader>
          <CardContent>
            {conversionLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : (
              <ConversionFunnel data={conversion!} />
            )}
          </CardContent>
        </Card>

        {/* Win/Loss Analysis */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Activity className="h-4 w-4 text-muted-foreground" />
              Win / Loss Analysis
            </CardTitle>
            <CardDescription className="text-xs">
              Deal outcomes by source
            </CardDescription>
          </CardHeader>
          <CardContent>
            {winLossLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : (
              <WinLossAnalysis data={winLoss!} />
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Monthly Trend ─────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            Monthly Win/Loss Trend
          </CardTitle>
        </CardHeader>
        <CardContent>
          {winLossLoading ? (
            <Skeleton className="h-48 w-full" />
          ) : (
            <MonthlyTrendChart data={winLoss!} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Summary Card ─────────────────────────────────────────────────

function SummaryCard({
  title, value, icon: Icon, color, loading, alert,
}: {
  title: string; value: string; icon: typeof DollarSign;
  color: string; loading: boolean; alert?: boolean;
}) {
  return (
    <Card className={cn(alert && "border-red-200 dark:border-red-800")}>
      <CardContent className="pt-4 pb-3 px-4">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
            {title}
          </span>
          <Icon className={cn("h-3.5 w-3.5", color)} />
        </div>
        {loading ? (
          <Skeleton className="h-7 w-20" />
        ) : (
          <p className={cn("text-xl font-bold tabular-nums", alert && "text-red-600")}>
            {value}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Health Score Gauge ───────────────────────────────────────────

function HealthScoreGauge({ health }: { health: HealthData }) {
  const score = health?.score ?? 0;
  const scoreColor =
    score >= 70 ? "text-green-600" :
    score >= 40 ? "text-amber-600" : "text-red-600";

  const scoreLabel =
    score >= 70 ? "Healthy" :
    score >= 40 ? "Needs Attention" : "At Risk";

  const breakdown = health?.breakdown;

  return (
    <div className="space-y-4">
      {/* Score Circle */}
      <div className="flex flex-col items-center py-2">
        <div className="relative w-28 h-28">
          <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
            <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" className="text-muted/30" strokeWidth="8" />
            <circle
              cx="50" cy="50" r="42" fill="none" stroke="currentColor"
              className={scoreColor}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={`${score * 2.64} 264`}
              style={{ transition: "stroke-dasharray 1s ease-out" }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={cn("text-2xl font-bold tabular-nums", scoreColor)}>{score}</span>
            <span className="text-[10px] text-muted-foreground">/ 100</span>
          </div>
        </div>
        <Badge
          variant="outline"
          className={cn(
            "mt-2 text-xs",
            score >= 70 && "text-green-600 border-green-300",
            score >= 40 && score < 70 && "text-amber-600 border-amber-300",
            score < 40 && "text-red-600 border-red-300"
          )}
        >
          {scoreLabel}
        </Badge>
      </div>

      {/* Breakdown Bars */}
      {breakdown && (
        <div className="space-y-2">
          <BreakdownBar label="Win Rate" score={breakdown.winRate.score} max={breakdown.winRate.max} detail={`${breakdown.winRate.value}%`} />
          <BreakdownBar label="Freshness" score={breakdown.freshness.score} max={breakdown.freshness.max} detail={`${breakdown.freshness.value}% active`} />
          <BreakdownBar label="Coverage" score={breakdown.coverage.score} max={breakdown.coverage.max} detail={`${breakdown.coverage.value}x`} />
          <BreakdownBar label="Velocity" score={breakdown.velocity.score} max={breakdown.velocity.max} detail={`${breakdown.velocity.value}d avg`} />
        </div>
      )}
    </div>
  );
}

function BreakdownBar({ label, score, max, detail }: { label: string; score: number; max: number; detail: string }) {
  const pct = max > 0 ? (score / max) * 100 : 0;
  return (
    <div className="space-y-0.5">
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{score}/{max} — {detail}</span>
      </div>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full transition-all",
            pct >= 70 ? "bg-green-500" : pct >= 40 ? "bg-amber-500" : "bg-red-500"
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ─── Velocity Chart ───────────────────────────────────────────────

function VelocityChart({ data }: { data: VelocityData }) {
  const chartData = useMemo(() => {
    if (!data?.stages) return [];
    return data.stages.map((s: any, i: number) => ({
      stage: STAGE_LABELS[s.stage] || s.stage,
      avgDays: Number(s.avg_days) || 0,
      dealCount: Number(s.deal_count) || 0,
      totalValue: Number(s.total_value) || 0,
      fill: STAGE_COLORS[i % STAGE_COLORS.length],
    }));
  }, [data]);

  if (chartData.length === 0) {
    return <EmptyChart message="No active deals to analyze velocity" />;
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 30 }}>
        <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.3} />
        <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}d`} />
        <YAxis type="category" dataKey="stage" tick={{ fontSize: 11 }} width={100} />
        <RechartsTooltip
          content={({ active, payload }) => {
            if (!active || !payload?.[0]) return null;
            const d = payload[0].payload;
            return (
              <div className="bg-popover border rounded-md shadow-md p-2 text-xs space-y-0.5">
                <p className="font-medium">{d.stage}</p>
                <p>{d.avgDays} avg days</p>
                <p>{d.dealCount} deals · {formatCurrency(d.totalValue)}</p>
              </div>
            );
          }}
        />
        <Bar dataKey="avgDays" radius={[0, 4, 4, 0]} barSize={20}>
          {chartData.map((entry, i) => (
            <Cell key={i} fill={entry.fill} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ─── Conversion Funnel ────────────────────────────────────────────

function ConversionFunnel({ data }: { data: ConversionData }) {
  const funnelData = useMemo(() => {
    if (!data?.stages) return [];

    // Group by stage, sum counts across statuses
    const stageMap: Record<string, { count: number; value: number }> = {};
    const stageOrder = ["lead", "qualified", "loi", "due_diligence", "under_contract", "closing"];

    data.stages.forEach((s: any) => {
      if (!stageMap[s.stage]) stageMap[s.stage] = { count: 0, value: 0 };
      stageMap[s.stage].count += Number(s.count) || 0;
      stageMap[s.stage].value += Number(s.total_value) || 0;
    });

    return stageOrder
      .filter((s) => stageMap[s])
      .map((stage, i) => ({
        stage: STAGE_LABELS[stage] || stage,
        count: stageMap[stage]?.count || 0,
        value: stageMap[stage]?.value || 0,
        fill: STAGE_COLORS[i % STAGE_COLORS.length],
      }));
  }, [data]);

  if (funnelData.length === 0) {
    return <EmptyChart message="No conversion data available" />;
  }

  // Render as horizontal bars since recharts Funnel can be tricky
  const maxCount = Math.max(...funnelData.map((d) => d.count));

  return (
    <div className="space-y-2 py-2">
      {funnelData.map((item, i) => {
        const widthPct = maxCount > 0 ? (item.count / maxCount) * 100 : 0;
        const prevCount = i > 0 ? funnelData[i - 1].count : null;
        const dropOff = prevCount && prevCount > 0 ? Math.round(((prevCount - item.count) / prevCount) * 100) : null;

        return (
          <div key={item.stage} className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium">{item.stage}</span>
              <div className="flex items-center gap-2">
                <span className="tabular-nums">{item.count} deals</span>
                <span className="text-muted-foreground tabular-nums">{formatCurrency(item.value)}</span>
                {dropOff !== null && dropOff > 0 && (
                  <Badge variant="outline" className="text-[9px] h-4 px-1 text-red-500 border-red-200">
                    -{dropOff}%
                  </Badge>
                )}
              </div>
            </div>
            <div className="h-6 bg-muted rounded overflow-hidden flex items-center">
              <div
                className="h-full rounded transition-all flex items-center px-2"
                style={{ width: `${Math.max(widthPct, 5)}%`, backgroundColor: item.fill }}
              >
                {widthPct > 20 && (
                  <span className="text-[10px] font-medium text-white">{item.count}</span>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Win/Loss Analysis ────────────────────────────────────────────

function WinLossAnalysis({ data }: { data: WinLossData }) {
  const sourceData = useMemo(() => {
    if (!data?.bySource) return [];

    const sourceMap: Record<string, { won: number; lost: number; total: number }> = {};
    data.bySource.forEach((s: any) => {
      if (!sourceMap[s.source]) sourceMap[s.source] = { won: 0, lost: 0, total: 0 };
      const count = Number(s.count) || 0;
      if (s.status === "won") sourceMap[s.source].won += count;
      else if (s.status === "lost") sourceMap[s.source].lost += count;
      sourceMap[s.source].total += count;
    });

    return Object.entries(sourceMap)
      .map(([source, counts]) => ({
        source: source.charAt(0).toUpperCase() + source.slice(1).replace(/_/g, " "),
        won: counts.won,
        lost: counts.lost,
        total: counts.total,
        winRate: counts.total > 0 ? Math.round((counts.won / counts.total) * 100) : 0,
      }))
      .sort((a, b) => b.total - a.total);
  }, [data]);

  if (!data?.won && !data?.lost) {
    return <EmptyChart message="No closed deals to analyze" />;
  }

  return (
    <div className="space-y-4">
      {/* Win/Loss Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="border rounded-lg p-3 bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800">
          <div className="flex items-center gap-1.5 mb-1">
            <Trophy className="h-3.5 w-3.5 text-green-600" />
            <span className="text-[10px] font-medium uppercase tracking-wider text-green-700 dark:text-green-400">Won</span>
          </div>
          <p className="text-xl font-bold text-green-700 dark:text-green-300">{data.won?.count || 0}</p>
          <p className="text-[11px] text-green-600">{formatCurrency(data.won?.totalValue)}</p>
        </div>
        <div className="border rounded-lg p-3 bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800">
          <div className="flex items-center gap-1.5 mb-1">
            <XCircle className="h-3.5 w-3.5 text-red-600" />
            <span className="text-[10px] font-medium uppercase tracking-wider text-red-700 dark:text-red-400">Lost</span>
          </div>
          <p className="text-xl font-bold text-red-700 dark:text-red-300">{data.lost?.count || 0}</p>
          <p className="text-[11px] text-red-600">{formatCurrency(data.lost?.totalValue)}</p>
        </div>
      </div>

      {/* By Source Table */}
      {sourceData.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">By Source</p>
          {sourceData.map((s) => (
            <div key={s.source} className="flex items-center gap-2 text-xs py-1">
              <span className="w-20 text-muted-foreground truncate">{s.source}</span>
              <div className="flex-1 h-4 bg-muted rounded overflow-hidden flex">
                {s.won > 0 && (
                  <div
                    className="h-full bg-green-500 flex items-center justify-center"
                    style={{ width: `${s.total > 0 ? (s.won / s.total) * 100 : 0}%` }}
                  >
                    {s.won > 0 && <span className="text-[9px] text-white font-medium">{s.won}</span>}
                  </div>
                )}
                {s.lost > 0 && (
                  <div
                    className="h-full bg-red-400 flex items-center justify-center"
                    style={{ width: `${s.total > 0 ? (s.lost / s.total) * 100 : 0}%` }}
                  >
                    {s.lost > 0 && <span className="text-[9px] text-white font-medium">{s.lost}</span>}
                  </div>
                )}
              </div>
              <span className="w-10 text-right font-medium tabular-nums">{s.winRate}%</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Monthly Trend Line Chart ─────────────────────────────────────

function MonthlyTrendChart({ data }: { data: WinLossData }) {
  const chartData = useMemo(() => {
    if (!data?.monthlyTrend) return [];

    const monthMap: Record<string, { month: string; won: number; lost: number }> = {};
    data.monthlyTrend.forEach((t: any) => {
      if (!monthMap[t.month]) monthMap[t.month] = { month: t.month, won: 0, lost: 0 };
      if (t.status === "won") monthMap[t.month].won += Number(t.count) || 0;
      else monthMap[t.month].lost += Number(t.count) || 0;
    });

    return Object.values(monthMap).sort((a, b) => a.month.localeCompare(b.month));
  }, [data]);

  if (chartData.length === 0) {
    return <EmptyChart message="No monthly trend data yet" height={150} />;
  }

  return (
    <ResponsiveContainer width="100%" height={180}>
      <LineChart data={chartData} margin={{ left: 0, right: 10 }}>
        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
        <XAxis
          dataKey="month"
          tick={{ fontSize: 10 }}
          tickFormatter={(v) => {
            const [y, m] = v.split("-");
            return `${["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][parseInt(m) - 1]} '${y.slice(2)}`;
          }}
        />
        <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
        <RechartsTooltip
          content={({ active, payload, label }) => {
            if (!active || !payload) return null;
            return (
              <div className="bg-popover border rounded-md shadow-md p-2 text-xs space-y-0.5">
                <p className="font-medium">{label}</p>
                {payload.map((p: any) => (
                  <p key={p.name} style={{ color: p.color }}>
                    {p.name}: {p.value}
                  </p>
                ))}
              </div>
            );
          }}
        />
        <Line type="monotone" dataKey="won" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} name="Won" />
        <Line type="monotone" dataKey="lost" stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} name="Lost" />
        <Legend wrapperStyle={{ fontSize: 11 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

// ─── Empty State ──────────────────────────────────────────────────

function EmptyChart({ message, height = 200 }: { message: string; height?: number }) {
  return (
    <div className="flex flex-col items-center justify-center text-center" style={{ height }}>
      <BarChart3 className="h-8 w-8 text-muted-foreground/20 mb-2" />
      <p className="text-xs text-muted-foreground">{message}</p>
    </div>
  );
}

// ─── Utilities ────────────────────────────────────────────────────

function formatCurrency(value: number | undefined | null): string {
  if (!value) return "$0";
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toLocaleString()}`;
}

export default PipelineAnalyticsDashboard;
