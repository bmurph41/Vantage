import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Calculator, TrendingUp, AlertCircle } from "lucide-react";
import { format, subYears } from "date-fns";

// FRED Series IDs for base rates
const BASE_RATE_OPTIONS = [
  { id: "SOFR", name: "SOFR (Secured Overnight Financing Rate)", category: "SOFR" },
  { id: "SOFR30DAYAVG", name: "30-Day Average SOFR", category: "SOFR" },
  { id: "SOFR90DAYAVG", name: "90-Day Average SOFR", category: "SOFR" },
  { id: "DFF", name: "Fed Funds Rate", category: "Fed" },
  { id: "DPRIME", name: "Prime Rate", category: "Prime" },
  { id: "DGS2", name: "2-Year Treasury", category: "Treasury" },
  { id: "DGS5", name: "5-Year Treasury", category: "Treasury" },
  { id: "DGS10", name: "10-Year Treasury", category: "Treasury" },
  { id: "DGS30", name: "30-Year Treasury", category: "Treasury" },
];

type TimeRange = "1Y" | "2Y" | "5Y" | "10Y" | "ALL";

export default function DebtScenariosIndex() {
  const [baseRate, setBaseRate] = useState<string>("SOFR");
  const [spreadBps, setSpreadBps] = useState<string>("250");
  const [timeRange, setTimeRange] = useState<TimeRange>("5Y");

  const getStartDate = (range: TimeRange): string => {
    const now = new Date();
    switch (range) {
      case "1Y": return format(subYears(now, 1), "yyyy-MM-dd");
      case "2Y": return format(subYears(now, 2), "yyyy-MM-dd");
      case "5Y": return format(subYears(now, 5), "yyyy-MM-dd");
      case "10Y": return format(subYears(now, 10), "yyyy-MM-dd");
      case "ALL": return "2000-01-01";
    }
  };

  const spreadPercent = parseFloat(spreadBps || "0") / 100;
  const selectedRate = BASE_RATE_OPTIONS.find(r => r.id === baseRate);

  const { data, isLoading } = useQuery({
    queryKey: [`/api/benchmarks/fred/${baseRate}`, getStartDate(timeRange)],
    queryFn: async () => {
      const response = await fetch(`/api/benchmarks/fred/${baseRate}?startDate=${getStartDate(timeRange)}`);
      if (!response.ok) throw new Error("Failed to fetch data");
      return response.json();
    },
    staleTime: 1000 * 60 * 60,
  });

  const observations = data?.observations?.filter((obs: any) => obs.value !== ".") || [];
  const chartData = observations.map((obs: any) => {
    const baseValue = parseFloat(obs.value);
    return {
      date: obs.date,
      baseRate: baseValue,
      effectiveRate: baseValue + spreadPercent,
    };
  });

  const currentBase = chartData.length > 0 ? chartData[chartData.length - 1].baseRate : null;
  const currentEffective = chartData.length > 0 ? chartData[chartData.length - 1].effectiveRate : null;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <Calculator className="w-8 h-8 text-primary" />
          <h1 className="text-3xl font-bold" data-testid="text-debt-scenarios-title">
            Debt Scenarios
          </h1>
        </div>
        <p className="text-muted-foreground" data-testid="text-debt-scenarios-description">
          Model debt scenarios by selecting a base rate and adding a spread to calculate effective interest rates
        </p>
      </div>

      {/* Configuration Panel */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Scenario Configuration</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Base Rate Selection */}
            <div className="space-y-2">
              <Label htmlFor="base-rate">Base Rate</Label>
              <Select value={baseRate} onValueChange={setBaseRate}>
                <SelectTrigger id="base-rate" data-testid="select-base-rate">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">SOFR Rates</div>
                  {BASE_RATE_OPTIONS.filter(r => r.category === "SOFR").map(rate => (
                    <SelectItem key={rate.id} value={rate.id}>{rate.name}</SelectItem>
                  ))}
                  <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground mt-2">Fed & Prime</div>
                  {BASE_RATE_OPTIONS.filter(r => r.category === "Fed" || r.category === "Prime").map(rate => (
                    <SelectItem key={rate.id} value={rate.id}>{rate.name}</SelectItem>
                  ))}
                  <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground mt-2">Treasury Rates</div>
                  {BASE_RATE_OPTIONS.filter(r => r.category === "Treasury").map(rate => (
                    <SelectItem key={rate.id} value={rate.id}>{rate.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Spread Input */}
            <div className="space-y-2">
              <Label htmlFor="spread">Spread (Basis Points)</Label>
              <div className="relative">
                <Input
                  id="spread"
                  type="number"
                  value={spreadBps}
                  onChange={(e) => setSpreadBps(e.target.value)}
                  placeholder="250"
                  className="pr-12"
                  data-testid="input-spread"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  bps
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                {spreadPercent.toFixed(2)}% ({spreadBps} basis points)
              </p>
            </div>

            {/* Time Range */}
            <div className="space-y-2">
              <Label htmlFor="time-range">Time Range</Label>
              <Select value={timeRange} onValueChange={(v) => setTimeRange(v as TimeRange)}>
                <SelectTrigger id="time-range" data-testid="select-time-range">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1Y">1 Year</SelectItem>
                  <SelectItem value="2Y">2 Years</SelectItem>
                  <SelectItem value="5Y">5 Years</SelectItem>
                  <SelectItem value="10Y">10 Years</SelectItem>
                  <SelectItem value="ALL">All Time</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Current Rates Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Current Base Rate</CardTitle>
          </CardHeader>
          <CardContent>
            {currentBase !== null ? (
              <div className="space-y-1">
                <p className="text-3xl font-bold" data-testid="text-current-base-rate">
                  {currentBase.toFixed(2)}%
                </p>
                <p className="text-sm text-muted-foreground">{selectedRate?.name}</p>
              </div>
            ) : (
              <p className="text-muted-foreground">Loading...</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Spread</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              <p className="text-3xl font-bold text-primary" data-testid="text-spread-display">
                +{spreadPercent.toFixed(2)}%
              </p>
              <p className="text-sm text-muted-foreground">{spreadBps} basis points</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-primary">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Effective Interest Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            {currentEffective !== null ? (
              <div className="space-y-1">
                <p className="text-3xl font-bold text-primary" data-testid="text-effective-rate">
                  {currentEffective.toFixed(2)}%
                </p>
                <p className="text-sm text-muted-foreground">
                  {currentBase?.toFixed(2)}% + {spreadPercent.toFixed(2)}%
                </p>
              </div>
            ) : (
              <p className="text-muted-foreground">Loading...</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Historical Chart */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Historical Rate Comparison</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center h-96">
              <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
            </div>
          ) : chartData.length > 0 ? (
            <div style={{ width: '100%', height: 400 }}>
              <ResponsiveContainer>
                <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 60, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(date) => {
                      try {
                        return format(new Date(date), "MMM yy");
                      } catch {
                        return date;
                      }
                    }}
                    angle={-45}
                    textAnchor="end"
                    height={80}
                    stroke="#666"
                  />
                  <YAxis
                    domain={['dataMin - 0.5', 'dataMax + 0.5']}
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
                    formatter={(value: any, name: string) => {
                      const label = name === "baseRate" ? "Base Rate" : "Effective Rate";
                      return [`${Number(value).toFixed(2)}%`, label];
                    }}
                    contentStyle={{ backgroundColor: 'white', border: '1px solid #ccc' }}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="baseRate"
                    stroke="#8884d8"
                    strokeWidth={2}
                    dot={false}
                    name="Base Rate"
                    isAnimationActive={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="effectiveRate"
                    stroke="#82ca9d"
                    strokeWidth={2}
                    dot={false}
                    name="Effective Rate (with spread)"
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

      {/* Statistics */}
      {chartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Rate Statistics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Current Effective</p>
                <p className="text-lg font-bold" data-testid="stat-current-effective">
                  {currentEffective?.toFixed(2)}%
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Highest Effective</p>
                <p className="text-lg font-bold" data-testid="stat-high-effective">
                  {Math.max(...chartData.map((d: any) => d.effectiveRate)).toFixed(2)}%
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Lowest Effective</p>
                <p className="text-lg font-bold" data-testid="stat-low-effective">
                  {Math.min(...chartData.map((d: any) => d.effectiveRate)).toFixed(2)}%
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Avg Effective</p>
                <p className="text-lg font-bold" data-testid="stat-avg-effective">
                  {(chartData.reduce((sum: number, d: any) => sum + d.effectiveRate, 0) / chartData.length).toFixed(2)}%
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Data Points</p>
                <p className="text-lg font-bold" data-testid="stat-data-points">
                  {chartData.length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Information Card */}
      <Card className="mt-6 border-blue-200 bg-blue-50">
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="space-y-2 text-sm">
              <p className="font-medium text-blue-900">How to use Debt Scenarios:</p>
              <ul className="list-disc list-inside space-y-1 text-blue-800">
                <li>Select a base rate (SOFR, Prime, or Treasury rate) that matches your loan terms</li>
                <li>Enter the spread in basis points (100 bps = 1.00%) provided by your lender</li>
                <li>The effective rate shows your actual interest cost (Base Rate + Spread)</li>
                <li>Use the historical chart to understand rate volatility and trends</li>
                <li>Adjust the time range to see long-term vs. short-term patterns</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
