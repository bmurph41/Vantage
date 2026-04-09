/**
 * RevenueForecastDashboard
 *
 * Displays pipeline revenue forecast with summary cards, stage breakdown
 * table, and monthly forecast bar chart powered by Recharts.
 */

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DollarSign, TrendingUp, BarChart3, AlertTriangle } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { apiRequest } from "@/lib/queryClient";

// ─── Types ────────────────────────────────────────────────────────

interface ForecastStage {
  stageId: string;
  stageName: string;
  stageProbability: number;
  stageOrder: number;
  stageType: string;
  color: string;
  dealCount: number;
  totalValue: number;
  weightedValue: number;
  avgDaysInStage: number;
}

interface ForecastSummary {
  totalWeightedValue: number;
  totalUnweightedValue: number;
  totalDeals: number;
  wonValue: number;
  wonCount: number;
  lostValue: number;
  lostCount: number;
}

interface MonthlyForecast {
  month: string;
  dealCount: number;
  totalValue: number;
  weightedValue: number;
}

interface ForecastResponse {
  stages: ForecastStage[];
  summary: ForecastSummary;
  monthlyForecast: MonthlyForecast[];
}

interface RevenueForecastDashboardProps {
  pipelineId?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────

function fmtCurrency(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toLocaleString()}`;
}

function fmtPct(value: number): string {
  return `${(value * 100).toFixed(0)}%`;
}

// ─── Component ────────────────────────────────────────────────────

export function RevenueForecastDashboard({ pipelineId }: RevenueForecastDashboardProps) {
  const queryParams = pipelineId ? `?pipelineId=${pipelineId}` : "";

  const { data, isLoading, isError } = useQuery<ForecastResponse>({
    queryKey: ["crm", "forecast", "pipeline", pipelineId ?? "all"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/crm/forecast/pipeline${queryParams}`);
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground">
        Loading forecast data...
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex items-center justify-center h-48 text-destructive gap-2">
        <AlertTriangle className="h-4 w-4" />
        Failed to load forecast data
      </div>
    );
  }

  const { stages, summary, monthlyForecast } = data;

  return (
    <div className="space-y-6">
      {/* ── Summary Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          title="Total Pipeline"
          value={fmtCurrency(summary.totalUnweightedValue)}
          subtitle={`${summary.totalDeals} deals`}
          icon={<DollarSign className="h-4 w-4 text-muted-foreground" />}
        />
        <SummaryCard
          title="Weighted Forecast"
          value={fmtCurrency(summary.totalWeightedValue)}
          subtitle="Probability-adjusted"
          icon={<TrendingUp className="h-4 w-4 text-muted-foreground" />}
        />
        <SummaryCard
          title="Won This Period"
          value={fmtCurrency(summary.wonValue)}
          subtitle={`${summary.wonCount} deals closed`}
          icon={<BarChart3 className="h-4 w-4 text-green-500" />}
          valueClassName="text-green-600"
        />
        <SummaryCard
          title="Lost This Period"
          value={fmtCurrency(summary.lostValue)}
          subtitle={`${summary.lostCount} deals lost`}
          icon={<AlertTriangle className="h-4 w-4 text-red-400" />}
          valueClassName="text-red-500"
        />
      </div>

      {/* ── Stage Breakdown Table ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Stage Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 pr-4 font-medium">Stage</th>
                  <th className="pb-2 pr-4 font-medium text-right">Deals</th>
                  <th className="pb-2 pr-4 font-medium text-right">Total Value</th>
                  <th className="pb-2 pr-4 font-medium text-right">Weighted</th>
                  <th className="pb-2 pr-4 font-medium text-right">Probability</th>
                  <th className="pb-2 font-medium text-right">Avg Days</th>
                </tr>
              </thead>
              <tbody>
                {stages.map((stage) => (
                  <tr key={stage.stageId} className="border-b last:border-0">
                    <td className="py-2 pr-4 flex items-center gap-2">
                      <span
                        className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: stage.color || "#6b7280" }}
                      />
                      {stage.stageName}
                      {stage.stageType === "won" && (
                        <Badge variant="outline" className="text-green-600 border-green-300 text-xs">Won</Badge>
                      )}
                      {stage.stageType === "lost" && (
                        <Badge variant="outline" className="text-red-500 border-red-300 text-xs">Lost</Badge>
                      )}
                    </td>
                    <td className="py-2 pr-4 text-right font-mono">{stage.dealCount}</td>
                    <td className="py-2 pr-4 text-right font-mono">{fmtCurrency(stage.totalValue)}</td>
                    <td className="py-2 pr-4 text-right font-mono">{fmtCurrency(stage.weightedValue)}</td>
                    <td className="py-2 pr-4 text-right font-mono">{fmtPct(stage.stageProbability)}</td>
                    <td className="py-2 text-right font-mono">{stage.avgDaysInStage}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* ── Monthly Forecast Chart ── */}
      {monthlyForecast.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Monthly Forecast</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyForecast} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis
                    tickFormatter={(v: number) => fmtCurrency(v)}
                    tick={{ fontSize: 12 }}
                    width={70}
                  />
                  <Tooltip
                    formatter={(value: number, name: string) => [
                      fmtCurrency(value),
                      name === "weightedValue" ? "Weighted" : "Unweighted",
                    ]}
                    labelFormatter={(label: string) => `Month: ${label}`}
                  />
                  <Bar dataKey="totalValue" fill="#94a3b8" name="Unweighted" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="weightedValue" fill="#0d9488" name="Weighted" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────

function SummaryCard({
  title,
  value,
  subtitle,
  icon,
  valueClassName,
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ReactNode;
  valueClassName?: string;
}) {
  return (
    <Card>
      <CardContent className="pt-4 pb-3 px-4">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            {title}
          </span>
          {icon}
        </div>
        <p className={`text-2xl font-bold font-mono ${valueClassName ?? ""}`}>{value}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
      </CardContent>
    </Card>
  );
}
