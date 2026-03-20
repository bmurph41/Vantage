import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
  LineChart, Line, CartesianGrid, Cell
} from "recharts";
import { TrendingUp, DollarSign, Target, Calendar } from "lucide-react";

interface ForecastChartProps {
  pipelineId?: string;
}

const STAGE_COLORS: Record<string, string> = {
  "Prospecting": "#94a3b8",
  "Qualification": "#60a5fa",
  "NDA/CA": "#a78bfa",
  "Due Diligence": "#f59e0b",
  "LOI": "#fb923c",
  "Under Contract": "#34d399",
  "Closing": "#10b981",
};

const HORIZON_OPTIONS = [
  { label: "30 Days", value: 30 },
  { label: "60 Days", value: 60 },
  { label: "90 Days", value: 90 },
  { label: "180 Days", value: 180 },
];

function formatCurrency(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
}

export function ForecastChart({ pipelineId }: ForecastChartProps) {
  const [horizon, setHorizon] = useState(90);

  const { data: deals = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/crm/deals"],
  });

  if (isLoading) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-[300px]" />
      </div>
    );
  }

  const now = new Date();
  const horizonDate = new Date(now.getTime() + horizon * 24 * 60 * 60 * 1000);

  // Compute stage-level forecast
  const stageMap = new Map<string, { count: number; totalValue: number; avgProbability: number; weightedValue: number }>();
  let totalPipeline = 0;
  let totalWeighted = 0;

  for (const deal of deals) {
    if (deal.status === "closed_won" || deal.status === "closed_lost") continue;
    const value = parseFloat(deal.dealValue || deal.value || "0");
    const probability = parseFloat(deal.probability || "50") / 100;
    const stage = deal.stage || deal.pipelineStage || "Unknown";

    totalPipeline += value;
    totalWeighted += value * probability;

    if (!stageMap.has(stage)) {
      stageMap.set(stage, { count: 0, totalValue: 0, avgProbability: 0, weightedValue: 0 });
    }
    const entry = stageMap.get(stage)!;
    entry.count++;
    entry.totalValue += value;
    entry.weightedValue += value * probability;
    entry.avgProbability = entry.weightedValue / entry.totalValue;
  }

  const stageData = Array.from(stageMap.entries()).map(([stage, data]) => ({
    stage,
    ...data,
    avgProbability: Math.round(data.avgProbability * 100),
  }));

  // Monthly breakdown (next 6 months)
  const monthlyData: { month: string; expected: number; best: number; worst: number }[] = [];
  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const monthLabel = d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
    // Distribute weighted value across months (simplified model)
    const monthShare = totalWeighted / 6;
    monthlyData.push({
      month: monthLabel,
      expected: Math.round(monthShare),
      best: Math.round(monthShare * 1.3),
      worst: Math.round(monthShare * 0.6),
    });
  }

  const dealCount = deals.filter(d => d.status !== "closed_won" && d.status !== "closed_lost").length;

  return (
    <div className="space-y-6 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Pipeline Forecast</h2>
        <div className="flex gap-1">
          {HORIZON_OPTIONS.map(opt => (
            <Button
              key={opt.value}
              variant={horizon === opt.value ? "secondary" : "ghost"}
              size="sm"
              className="h-7 text-xs"
              onClick={() => setHorizon(opt.value)}
            >
              {opt.label}
            </Button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <DollarSign className="h-4 w-4" />
              Total Pipeline
            </div>
            <div className="text-2xl font-bold">{formatCurrency(totalPipeline)}</div>
            <div className="text-xs text-muted-foreground">{dealCount} active deals</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <Target className="h-4 w-4" />
              Weighted Forecast
            </div>
            <div className="text-2xl font-bold">{formatCurrency(totalWeighted)}</div>
            <div className="text-xs text-muted-foreground">Probability-adjusted</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <TrendingUp className="h-4 w-4" />
              Win Rate
            </div>
            <div className="text-2xl font-bold">
              {totalPipeline > 0 ? Math.round((totalWeighted / totalPipeline) * 100) : 0}%
            </div>
            <div className="text-xs text-muted-foreground">Avg probability</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <Calendar className="h-4 w-4" />
              Horizon
            </div>
            <div className="text-2xl font-bold">{horizon} Days</div>
            <div className="text-xs text-muted-foreground">Forecast window</div>
          </CardContent>
        </Card>
      </div>

      {/* Pipeline by Stage */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Pipeline by Stage (Weighted)</CardTitle>
        </CardHeader>
        <CardContent>
          {stageData.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">No active deals in pipeline</div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={stageData} layout="vertical" margin={{ left: 100 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" tickFormatter={formatCurrency} />
                <YAxis type="category" dataKey="stage" width={90} tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
                <Legend />
                <Bar dataKey="totalValue" name="Total Value" fill="#e2e8f0" radius={[0, 4, 4, 0]} />
                <Bar dataKey="weightedValue" name="Weighted Value" radius={[0, 4, 4, 0]}>
                  {stageData.map((entry) => (
                    <Cell key={entry.stage} fill={STAGE_COLORS[entry.stage] || "#60a5fa"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Monthly Forecast */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Monthly Forecast (Expected Closings)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis tickFormatter={formatCurrency} />
              <Tooltip formatter={(v: number) => formatCurrency(v)} />
              <Legend />
              <Line type="monotone" dataKey="best" name="Best Case" stroke="#10b981" strokeDasharray="5 5" />
              <Line type="monotone" dataKey="expected" name="Expected" stroke="#3b82f6" strokeWidth={2} />
              <Line type="monotone" dataKey="worst" name="Worst Case" stroke="#ef4444" strokeDasharray="5 5" />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Stage Detail Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Forecast by Stage</CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="pb-2">Stage</th>
                <th className="pb-2 text-right">Deals</th>
                <th className="pb-2 text-right">Total Value</th>
                <th className="pb-2 text-right">Avg Probability</th>
                <th className="pb-2 text-right">Weighted Value</th>
              </tr>
            </thead>
            <tbody>
              {stageData.map(row => (
                <tr key={row.stage} className="border-b last:border-0">
                  <td className="py-2">
                    <Badge variant="outline" className="font-normal">{row.stage}</Badge>
                  </td>
                  <td className="py-2 text-right">{row.count}</td>
                  <td className="py-2 text-right">{formatCurrency(row.totalValue)}</td>
                  <td className="py-2 text-right">{row.avgProbability}%</td>
                  <td className="py-2 text-right font-medium">{formatCurrency(row.weightedValue)}</td>
                </tr>
              ))}
              <tr className="font-semibold border-t-2">
                <td className="py-2">Total</td>
                <td className="py-2 text-right">{dealCount}</td>
                <td className="py-2 text-right">{formatCurrency(totalPipeline)}</td>
                <td className="py-2 text-right">{totalPipeline > 0 ? Math.round((totalWeighted / totalPipeline) * 100) : 0}%</td>
                <td className="py-2 text-right">{formatCurrency(totalWeighted)}</td>
              </tr>
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
