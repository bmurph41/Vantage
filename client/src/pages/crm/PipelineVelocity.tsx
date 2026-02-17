import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Activity,
  Clock,
  DollarSign,
  TrendingUp,
  Target,
  BarChart3,
  PieChart as PieChartIcon,
  Layers,
} from "lucide-react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

const DATE_RANGES = [
  { label: "30 Days", days: 30 },
  { label: "60 Days", days: 60 },
  { label: "90 Days", days: 90 },
  { label: "1 Year", days: 365 },
];

const STAGE_COLORS = ["#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899", "#14B8A6", "#F97316"];
const DONUT_COLORS = ["#10B981", "#EF4444", "#3B82F6"];

function formatCurrency(value: number): string {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
  return `$${value.toLocaleString()}`;
}

interface StageMetric {
  stageName: string;
  avgDays: number;
  dealCount: number;
}

interface VelocityTrendItem {
  period: string;
  avgDays: number;
  dealCount: number;
}

interface DealVelocityData {
  stageMetrics: StageMetric[];
  velocityTrend: VelocityTrendItem[];
}

interface StageDistItem {
  stage: string;
  count: number;
  value: number;
  avgProbability?: number;
}

interface PipelineHealthData {
  totalDeals: number;
  totalPipelineValue: number;
  weightedPipelineValue: number;
  atRiskDeals: number;
  healthyDeals: number;
  stageDistribution: StageDistItem[];
}

interface WinLossBySource {
  source: string;
  won: number;
  lost: number;
  total: number;
  winRate: number;
  value: number;
}

interface WinLossBySize {
  label: string;
  won: number;
  lost: number;
  total: number;
  winRate: number;
  totalValue: number;
}

interface WinLossData {
  summary: {
    totalDeals: number;
    wonDeals: number;
    lostDeals: number;
    activeDeals: number;
    overallWinRate: number;
    wonValue: number;
    lostValue: number;
  };
  bySource: WinLossBySource[];
  bySize: WinLossBySize[];
  byPeriod: Array<{ period: string; won: number; lost: number; total: number; winRate: number }>;
  lostReasons: Array<{ reason: string; count: number }>;
}

export default function PipelineVelocity() {
  const [selectedRange, setSelectedRange] = useState(90);

  const dateParams = useMemo(() => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - selectedRange);
    return {
      startDate: start.toISOString().slice(0, 10),
      endDate: end.toISOString().slice(0, 10),
    };
  }, [selectedRange]);

  const { data: velocityData, isLoading: velocityLoading } = useQuery<DealVelocityData>({
    queryKey: ["/api/crm/analytics/deal-velocity", { startDate: dateParams.startDate, endDate: dateParams.endDate }],
  });

  const { data: healthData, isLoading: healthLoading } = useQuery<PipelineHealthData>({
    queryKey: ["/api/crm/analytics/pipeline-health"],
  });

  const { data: winLossData, isLoading: winLossLoading } = useQuery<WinLossData>({
    queryKey: ["/api/crm/analytics/win-loss", { startDate: dateParams.startDate, endDate: dateParams.endDate }],
  });

  const isLoading = velocityLoading || healthLoading || winLossLoading;

  const avgDaysToClose = useMemo(() => {
    if (!velocityData?.stageMetrics?.length) return 0;
    const totalDays = velocityData.stageMetrics.reduce((sum, s) => sum + (s.avgDays || 0), 0);
    return Math.round(totalDays);
  }, [velocityData]);

  const conversionRate = useMemo(() => {
    if (!winLossData?.summary) return 0;
    return winLossData.summary.overallWinRate || 0;
  }, [winLossData]);

  const donutData = useMemo(() => {
    if (!winLossData?.summary) return [];
    const { wonDeals, lostDeals, activeDeals } = winLossData.summary;
    return [
      { name: "Won", value: wonDeals },
      { name: "Lost", value: lostDeals },
      { name: "Active", value: activeDeals },
    ].filter(d => d.value > 0);
  }, [winLossData]);

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-72" />
          <Skeleton className="h-10 w-80" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => (
            <Card key={i}><CardContent className="p-6"><Skeleton className="h-20 w-full" /></CardContent></Card>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[...Array(4)].map((_, i) => (
            <Card key={i}><CardContent className="p-6"><Skeleton className="h-64 w-full" /></CardContent></Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Activity className="w-7 h-7 text-blue-600" />
            Pipeline Velocity Analytics
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Track deal movement speed, conversion rates, and win/loss patterns
          </p>
        </div>
        <div className="flex items-center gap-2">
          {DATE_RANGES.map((range) => (
            <Button
              key={range.days}
              variant={selectedRange === range.days ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedRange(range.days)}
            >
              {range.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100">
                <Layers className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Deals</p>
                <p className="text-2xl font-bold">{healthData?.totalDeals ?? 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-100">
                <Clock className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Avg Days to Close</p>
                <p className="text-2xl font-bold">{avgDaysToClose}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-100">
                <Target className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Conversion Rate</p>
                <p className="text-2xl font-bold">{conversionRate}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-100">
                <DollarSign className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Pipeline Value</p>
                <p className="text-2xl font-bold">{formatCurrency(healthData?.totalPipelineValue ?? 0)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-indigo-100">
                <TrendingUp className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Weighted Value</p>
                <p className="text-2xl font-bold">{formatCurrency(healthData?.weightedPipelineValue ?? 0)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-blue-500" />
              Stage Velocity
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(!velocityData?.stageMetrics || velocityData.stageMetrics.length === 0) ? (
              <p className="text-sm text-muted-foreground text-center py-12">No stage velocity data available</p>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart
                  data={velocityData.stageMetrics}
                  layout="vertical"
                  margin={{ top: 5, right: 30, bottom: 5, left: 100 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis type="number" tick={{ fontSize: 11 }} label={{ value: "Avg Days", position: "insideBottom", offset: -5, fontSize: 11 }} />
                  <YAxis dataKey="stageName" type="category" tick={{ fontSize: 11 }} width={95} />
                  <Tooltip
                    formatter={(value: number) => [`${value} days`, "Avg Duration"]}
                    contentStyle={{ fontSize: 12 }}
                  />
                  <Bar dataKey="avgDays" radius={[0, 4, 4, 0]}>
                    {velocityData.stageMetrics.map((_, index) => (
                      <Cell key={index} fill={STAGE_COLORS[index % STAGE_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-green-500" />
              Velocity Trend
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(!velocityData?.velocityTrend || velocityData.velocityTrend.length === 0) ? (
              <p className="text-sm text-muted-foreground text-center py-12">No trend data available</p>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={velocityData.velocityTrend} margin={{ top: 5, right: 30, bottom: 5, left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} label={{ value: "Avg Days", angle: -90, position: "insideLeft", fontSize: 11 }} />
                  <Tooltip
                    formatter={(value: number, name: string) => [
                      name === "avgDays" ? `${value} days` : value,
                      name === "avgDays" ? "Avg Days" : "Deal Count",
                    ]}
                    contentStyle={{ fontSize: 12 }}
                  />
                  <Legend />
                  <Line type="monotone" dataKey="avgDays" stroke="#3B82F6" strokeWidth={2} dot={{ r: 4 }} name="Avg Days" />
                  <Line type="monotone" dataKey="dealCount" stroke="#10B981" strokeWidth={2} dot={{ r: 4 }} name="Deal Count" />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <PieChartIcon className="w-5 h-5 text-emerald-500" />
              Win/Loss Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            {donutData.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-12">No win/loss data available</p>
            ) : (
              <div className="flex items-center justify-center gap-6">
                <ResponsiveContainer width={220} height={220}>
                  <PieChart>
                    <Pie
                      data={donutData}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={90}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {donutData.map((_, index) => (
                        <Cell key={index} fill={DONUT_COLORS[index % DONUT_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number, name: string) => [`${value} deals`, name]} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-3">
                  <div className="text-center mb-4">
                    <p className="text-3xl font-bold">{conversionRate}%</p>
                    <p className="text-xs text-muted-foreground">Win Rate</p>
                  </div>
                  {donutData.map((item, i) => (
                    <div key={item.name} className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: DONUT_COLORS[i] }} />
                      <span className="text-sm">{item.name}</span>
                      <span className="text-sm font-semibold ml-auto">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Layers className="w-5 h-5 text-indigo-500" />
              Stage Conversion Funnel
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(!healthData?.stageDistribution || healthData.stageDistribution.length === 0) ? (
              <p className="text-sm text-muted-foreground text-center py-12">No stage data available</p>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart
                  data={healthData.stageDistribution}
                  margin={{ top: 5, right: 20, bottom: 60, left: 10 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="stage" tick={{ fontSize: 11 }} angle={-45} textAnchor="end" height={70} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={(value: number) => [`${value} deals`, "Deals"]}
                    contentStyle={{ fontSize: 12 }}
                  />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {healthData.stageDistribution.map((_, index) => (
                      <Cell key={index} fill={STAGE_COLORS[index % STAGE_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-orange-500" />
              Win/Loss by Source
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(!winLossData?.bySource || winLossData.bySource.length === 0) ? (
              <p className="text-sm text-muted-foreground text-center py-12">No source data available</p>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart
                  data={winLossData.bySource}
                  margin={{ top: 5, right: 20, bottom: 60, left: 10 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="source" tick={{ fontSize: 11 }} angle={-45} textAnchor="end" height={70} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ fontSize: 12 }} />
                  <Legend />
                  <Bar dataKey="won" fill="#10B981" name="Won" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="lost" fill="#EF4444" name="Lost" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Target className="w-5 h-5 text-violet-500" />
              Win Rate by Deal Size
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(!winLossData?.bySize || winLossData.bySize.length === 0) ? (
              <p className="text-sm text-muted-foreground text-center py-12">No deal size data available</p>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart
                  data={winLossData.bySize}
                  margin={{ top: 5, right: 20, bottom: 60, left: 10 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} angle={-45} textAnchor="end" height={70} />
                  <YAxis tick={{ fontSize: 11 }} domain={[0, 100]} label={{ value: "Win Rate %", angle: -90, position: "insideLeft", fontSize: 11 }} />
                  <Tooltip
                    formatter={(value: number) => [`${value}%`, "Win Rate"]}
                    contentStyle={{ fontSize: 12 }}
                  />
                  <Bar dataKey="winRate" radius={[4, 4, 0, 0]}>
                    {winLossData.bySize.map((entry, index) => (
                      <Cell
                        key={index}
                        fill={entry.winRate >= 60 ? "#10B981" : entry.winRate >= 30 ? "#F59E0B" : "#EF4444"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
