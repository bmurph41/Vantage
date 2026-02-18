import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { TrendingUp, TrendingDown, Minus, RefreshCw, BarChart3 } from "lucide-react";
import { format, subYears, subMonths } from "date-fns";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

// FRED Series IDs
const BENCHMARK_SERIES = {
  treasury2y: { id: "DGS2", name: "2-Year Treasury", unit: "%" },
  treasury5y: { id: "DGS5", name: "5-Year Treasury", unit: "%" },
  treasury10y: { id: "DGS10", name: "10-Year Treasury", unit: "%" },
  treasury20y: { id: "GS20", name: "20-Year Treasury", unit: "%" },
  treasury30y: { id: "DGS30", name: "30-Year Treasury", unit: "%" },
  primeRate: { id: "DPRIME", name: "Prime Rate", unit: "%" },
  sofr: { id: "SOFR", name: "SOFR", unit: "%" },
  sofr30Day: { id: "SOFR30DAYAVG", name: "30-Day Avg SOFR", unit: "%" },
  fedFunds: { id: "DFF", name: "Fed Funds Rate", unit: "%" },
};

type TimeRange = "1M" | "3M" | "6M" | "1Y" | "2Y" | "5Y" | "ALL";

interface BenchmarkAggregateRow {
  id: string;
  metricKey: string;
  cohortKey: string;
  periodKey: string;
  cohortSize: number;
  p25: string | null;
  p50: string | null;
  p75: string | null;
  mean: string | null;
  minBucketed: string | null;
  maxBucketed: string | null;
  createdAt: string;
}

function formatMetricKey(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatNumber(value: string | null): string {
  if (value === null || value === undefined) return "—";
  const num = parseFloat(value);
  if (isNaN(num)) return "—";
  return num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function BenchmarksIndex() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [timeRange, setTimeRange] = useState<TimeRange>("1Y");

  const { data: benchmarkAggregates, isLoading: benchmarksLoading } = useQuery<BenchmarkAggregateRow[]>({
    queryKey: ["/api/benchmarking/aggregates"],
    staleTime: 1000 * 60 * 30,
  });

  const refreshMutation = useMutation({
    mutationFn: () => apiRequest("/api/capital-markets/rates/refresh", { method: "POST", body: JSON.stringify({ lookbackDays: 365 }) }),
    onSuccess: (data: any) => {
      toast({ title: "Rates Refreshed", description: data.message || "Market rates have been updated" });
      queryClient.invalidateQueries({ queryKey: ["/api/benchmarks/fred"] });
      queryClient.invalidateQueries({ queryKey: ["/api/capital-markets"] });
    },
    onError: (error: any) => {
      toast({ title: "Refresh Failed", description: error.message, variant: "destructive" });
    },
  });

  const getStartDate = (range: TimeRange): string => {
    const now = new Date();
    switch (range) {
      case "1M": return format(subMonths(now, 1), "yyyy-MM-dd");
      case "3M": return format(subMonths(now, 3), "yyyy-MM-dd");
      case "6M": return format(subMonths(now, 6), "yyyy-MM-dd");
      case "1Y": return format(subYears(now, 1), "yyyy-MM-dd");
      case "2Y": return format(subYears(now, 2), "yyyy-MM-dd");
      case "5Y": return format(subYears(now, 5), "yyyy-MM-dd");
      case "ALL": return "2000-01-01";
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-benchmarks-title">Capital Markets</h1>
          <p className="text-muted-foreground mt-2" data-testid="text-benchmarks-description">
            Live tracking of key interest rates and treasury yields from Federal Reserve Economic Data
          </p>
        </div>
        <Button onClick={() => refreshMutation.mutate()} disabled={refreshMutation.isPending} data-testid="btn-refresh-rates">
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshMutation.isPending ? "animate-spin" : ""}`} />
          Refresh Rates
        </Button>
      </div>

      <div className="mb-4 flex justify-end">
        <Select value={timeRange} onValueChange={(v) => setTimeRange(v as TimeRange)}>
          <SelectTrigger className="w-[180px]" data-testid="select-time-range">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1M">1 Month</SelectItem>
            <SelectItem value="3M">3 Months</SelectItem>
            <SelectItem value="6M">6 Months</SelectItem>
            <SelectItem value="1Y">1 Year</SelectItem>
            <SelectItem value="2Y">2 Years</SelectItem>
            <SelectItem value="5Y">5 Years</SelectItem>
            <SelectItem value="ALL">All Time</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Tabs defaultValue="treasury10y" className="space-y-6">
        <TabsList className="grid grid-cols-3 md:grid-cols-5 lg:grid-cols-9 gap-2">
          <TabsTrigger value="treasury2y" data-testid="tab-treasury2y">2Y Treasury</TabsTrigger>
          <TabsTrigger value="treasury5y" data-testid="tab-treasury5y">5Y Treasury</TabsTrigger>
          <TabsTrigger value="treasury10y" data-testid="tab-treasury10y">10Y Treasury</TabsTrigger>
          <TabsTrigger value="treasury20y" data-testid="tab-treasury20y">20Y Treasury</TabsTrigger>
          <TabsTrigger value="treasury30y" data-testid="tab-treasury30y">30Y Treasury</TabsTrigger>
          <TabsTrigger value="primeRate" data-testid="tab-prime">Prime Rate</TabsTrigger>
          <TabsTrigger value="sofr" data-testid="tab-sofr">SOFR</TabsTrigger>
          <TabsTrigger value="sofr30Day" data-testid="tab-sofr30">30D SOFR</TabsTrigger>
          <TabsTrigger value="fedFunds" data-testid="tab-fedfunds">Fed Funds</TabsTrigger>
        </TabsList>

        {Object.entries(BENCHMARK_SERIES).map(([key, series]) => (
          <TabsContent key={key} value={key}>
            <BenchmarkChart
              seriesId={series.id}
              name={series.name}
              unit={series.unit}
              startDate={getStartDate(timeRange)}
            />
          </TabsContent>
        ))}
      </Tabs>

      <div className="mt-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <BarChart3 className="h-6 w-6" />
              Marina Industry Benchmarks
            </h2>
            <p className="text-muted-foreground mt-1">
              De-identified performance metrics across the marina industry
            </p>
          </div>
        </div>

        {benchmarksLoading ? (
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-3">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </div>
            </CardContent>
          </Card>
        ) : !benchmarkAggregates || benchmarkAggregates.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-8 text-muted-foreground">
                <BarChart3 className="h-12 w-12 mx-auto mb-3 opacity-40" />
                <p className="font-medium">Not enough data to display industry benchmarks.</p>
                <p className="text-sm mt-1">Benchmarks require data from multiple organizations.</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Metric</TableHead>
                  <TableHead className="text-right">25th Percentile</TableHead>
                  <TableHead className="text-right">Median</TableHead>
                  <TableHead className="text-right">75th Percentile</TableHead>
                  <TableHead className="text-right">Average</TableHead>
                  <TableHead className="text-right">Sample Size</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {benchmarkAggregates.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{formatMetricKey(row.metricKey)}</TableCell>
                    <TableCell className="text-right">{formatNumber(row.p25)}</TableCell>
                    <TableCell className="text-right">{formatNumber(row.p50)}</TableCell>
                    <TableCell className="text-right">{formatNumber(row.p75)}</TableCell>
                    <TableCell className="text-right">{formatNumber(row.mean)}</TableCell>
                    <TableCell className="text-right">{row.cohortSize}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}

        <p className="text-xs text-muted-foreground">
          Industry benchmarks are computed from de-identified, aggregated data from participating organizations.
        </p>
      </div>
    </div>
  );
}

interface BenchmarkChartProps {
  seriesId: string;
  name: string;
  unit: string;
  startDate: string;
}

function BenchmarkChart({ seriesId, name, unit, startDate }: BenchmarkChartProps) {
  const { data, isLoading, error } = useQuery({
    queryKey: [`/api/benchmarks/fred/${seriesId}`, startDate],
    queryFn: async () => {
      const response = await fetch(`/api/benchmarks/fred/${seriesId}?startDate=${startDate}`);
      if (!response.ok) throw new Error("Failed to fetch data");
      return response.json();
    },
    staleTime: 1000 * 60 * 60, // 1 hour
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center h-96">
            <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center text-destructive">
            Failed to load data. Please try again later.
          </div>
        </CardContent>
      </Card>
    );
  }

  const observations = data?.observations?.filter((obs: any) => obs.value !== ".") || [];
  const chartData = observations.map((obs: any) => ({
    date: obs.date,
    value: parseFloat(obs.value),
  }));

  const getMonthTicks = (data: { date: string }[]): number[] => {
    if (data.length === 0) return [];
    const ticks: number[] = [];
    let lastMonth = "";
    data.forEach((d, index) => {
      const monthKey = format(new Date(d.date), "yyyy-MM");
      if (monthKey !== lastMonth) {
        ticks.push(index);
        lastMonth = monthKey;
      }
    });
    return ticks;
  };

  const monthTicks = getMonthTicks(chartData);

  const currentValue = chartData.length > 0 ? chartData[chartData.length - 1].value : null;
  const previousValue = chartData.length > 1 ? chartData[chartData.length - 2].value : currentValue;
  const change = currentValue && previousValue ? currentValue - previousValue : 0;
  const changePercent = previousValue ? (change / previousValue) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Current Value Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span data-testid="text-benchmark-name">{name}</span>
            {currentValue && (
              <div className="flex items-center gap-2">
                <span className="text-3xl font-bold" data-testid="text-current-value">
                  {currentValue.toFixed(2)}{unit}
                </span>
                {change !== 0 && (
                  <div className={`flex items-center gap-1 text-sm ${change > 0 ? "text-green-600" : change < 0 ? "text-red-600" : "text-gray-600"}`} data-testid="text-change-indicator">
                    {change > 0 ? <TrendingUp className="w-4 h-4" /> : change < 0 ? <TrendingDown className="w-4 h-4" /> : <Minus className="w-4 h-4" />}
                    <span>{Math.abs(change).toFixed(2)} ({Math.abs(changePercent).toFixed(2)}%)</span>
                  </div>
                )}
              </div>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {chartData.length > 0 && (
            <p className="text-sm text-muted-foreground" data-testid="text-last-updated">
              Last updated: {format(new Date(chartData[chartData.length - 1].date), "MMMM dd, yyyy")}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Historical Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Historical Data</CardTitle>
        </CardHeader>
        <CardContent>
          {chartData.length > 0 ? (
            <div style={{ width: '100%', height: 400 }}>
              <ResponsiveContainer>
                <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 60, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                  <XAxis
                    dataKey="date"
                    ticks={monthTicks.map(i => chartData[i]?.date).filter(Boolean)}
                    tickFormatter={(date) => {
                      try {
                        return format(new Date(date), "MMM ''yy");
                      } catch {
                        return date;
                      }
                    }}
                    angle={-45}
                    textAnchor="end"
                    height={80}
                    stroke="#666"
                    interval={0}
                  />
                  <YAxis
                    domain={['dataMin - 0.1', 'dataMax + 0.1']}
                    tickFormatter={(value) => `${Number(value).toFixed(2)}%`}
                    stroke="#666"
                  />
                  <Tooltip
                    labelFormatter={(date) => {
                      try {
                        return format(new Date(String(date)), "MMMM dd, yyyy");
                      } catch {
                        return String(date);
                      }
                    }}
                    formatter={(value: any) => [`${Number(value).toFixed(2)}%`, name]}
                    contentStyle={{ backgroundColor: 'white', border: '1px solid #ccc' }}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="#8884d8"
                    strokeWidth={2}
                    dot={false}
                    name={name}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex items-center justify-center h-96 text-muted-foreground">
              No data available for the selected time range
            </div>
          )}
        </CardContent>
      </Card>

      {/* Statistics Card */}
      {chartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Statistics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Current</p>
                <p className="text-lg font-bold" data-testid="stat-current">
                  {currentValue?.toFixed(2)}{unit}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">High</p>
                <p className="text-lg font-bold" data-testid="stat-high">
                  {Math.max(...chartData.map((d: any) => d.value)).toFixed(2)}{unit}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Low</p>
                <p className="text-lg font-bold" data-testid="stat-low">
                  {Math.min(...chartData.map((d: any) => d.value)).toFixed(2)}{unit}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Average</p>
                <p className="text-lg font-bold" data-testid="stat-average">
                  {(chartData.reduce((sum: number, d: any) => sum + d.value, 0) / chartData.length).toFixed(2)}{unit}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
