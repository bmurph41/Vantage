import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { RefreshCw, TrendingUp, TrendingDown, Minus, ArrowUpRight, ArrowDownRight, Database, Calendar } from "lucide-react";
import { format } from "date-fns";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, AreaChart, Area } from "recharts";

type RateType = "sofr" | "treasury" | "prime" | "fed_funds";
type Tenor = "overnight" | "1m" | "3m" | "6m" | "1y" | "2y" | "3y" | "5y" | "7y" | "10y" | "20y" | "30y";

interface YieldCurvePoint {
  tenor: Tenor;
  tenorMonths: number;
  rate: number;
  isInterpolated: boolean;
}

interface ForwardCurvePoint {
  forwardMonths: number;
  forwardRate: number;
  spotRate?: number;
}

interface YieldCurveResponse {
  rateType: RateType;
  curveDate: string;
  points: YieldCurvePoint[];
}

interface ForwardCurveResponse {
  rateType: RateType;
  curveDate: string;
  points: ForwardCurvePoint[];
}

interface YieldSpreadResponse {
  baseTenor: string;
  targetTenor: string;
  baseRate: number;
  targetRate: number;
  spread: number;
  spreadBps: number;
  curveDate: string;
  isInverted: boolean;
}

interface StatsResponse {
  seriesCount: number;
  totalRates: number;
  latestObservation: string | null;
  seriesByType: Record<string, number>;
}

const TENOR_LABELS: Record<Tenor, string> = {
  overnight: "O/N",
  "1m": "1M",
  "3m": "3M",
  "6m": "6M",
  "1y": "1Y",
  "2y": "2Y",
  "3y": "3Y",
  "5y": "5Y",
  "7y": "7Y",
  "10y": "10Y",
  "20y": "20Y",
  "30y": "30Y",
};

const RATE_TYPE_LABELS: Record<RateType, string> = {
  sofr: "SOFR",
  treasury: "Treasury",
  prime: "Prime",
  fed_funds: "Fed Funds",
};

export default function CapitalMarketsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedRateType, setSelectedRateType] = useState<RateType>("treasury");
  const [selectedForwardType, setSelectedForwardType] = useState<RateType>("sofr");
  const [forwardMonths, setForwardMonths] = useState(60);

  const { data: stats, isLoading: statsLoading } = useQuery<StatsResponse>({
    queryKey: ["/api/capital-markets/stats"],
  });

  const { data: yieldCurve, isLoading: curveLoading } = useQuery<YieldCurveResponse>({
    queryKey: ["/api/capital-markets/rates/latest", selectedRateType],
    queryFn: () => apiRequest(`/api/capital-markets/rates/latest?rateType=${selectedRateType}`),
  });

  const { data: forwardCurve, isLoading: forwardLoading } = useQuery<ForwardCurveResponse>({
    queryKey: ["/api/capital-markets/forward-curve", selectedForwardType, forwardMonths],
    queryFn: () => apiRequest(`/api/capital-markets/forward-curve?rateType=${selectedForwardType}&maxMonths=${forwardMonths}`),
  });

  const { data: yieldSpread, isLoading: spreadLoading } = useQuery<YieldSpreadResponse>({
    queryKey: ["/api/capital-markets/yield-spreads"],
  });

  const refreshMutation = useMutation({
    mutationFn: () => apiRequest("/api/capital-markets/rates/refresh", { method: "POST", body: JSON.stringify({ lookbackDays: 365 }) }),
    onSuccess: (data: any) => {
      toast({ title: "Rates Refreshed", description: data.message });
      queryClient.invalidateQueries({ queryKey: ["/api/capital-markets/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/capital-markets/rates/latest", selectedRateType] });
      queryClient.invalidateQueries({ queryKey: ["/api/capital-markets/forward-curve", selectedForwardType, forwardMonths] });
      queryClient.invalidateQueries({ queryKey: ["/api/capital-markets/yield-spreads"] });
    },
    onError: (error: any) => {
      toast({ title: "Refresh Failed", description: error.message, variant: "destructive" });
    },
  });

  const yieldCurveData = yieldCurve?.points?.map((p) => ({
    name: TENOR_LABELS[p.tenor] || p.tenor,
    rate: p.rate,
    months: p.tenorMonths,
    isInterpolated: p.isInterpolated,
  })) ?? [];

  const forwardCurveData = forwardCurve?.points?.slice(0, forwardMonths).map((p, i) => ({
    month: p.forwardMonths,
    name: `${p.forwardMonths}M`,
    forwardRate: p.forwardRate,
    spotRate: p.spotRate,
  })) ?? [];

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Capital Markets</h1>
          <p className="text-muted-foreground">Real-time yield curves, SOFR, and Treasury rates from FRED</p>
        </div>
        <Button onClick={() => refreshMutation.mutate()} disabled={refreshMutation.isPending}>
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshMutation.isPending ? "animate-spin" : ""}`} />
          Refresh Rates
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Observations</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className="text-2xl font-bold">{stats?.totalRates?.toLocaleString() ?? 0}</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Series Tracked</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className="text-2xl font-bold">{stats?.seriesCount ?? 0}</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">2Y-10Y Spread</CardTitle>
            {spreadLoading ? null : yieldSpread?.isInverted ? (
              <ArrowDownRight className="h-4 w-4 text-red-500" />
            ) : (
              <ArrowUpRight className="h-4 w-4 text-green-500" />
            )}
          </CardHeader>
          <CardContent>
            {spreadLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className="flex items-center gap-2">
                <span className={`text-2xl font-bold ${yieldSpread?.isInverted ? "text-red-500" : "text-green-600"}`}>
                  {yieldSpread?.spreadBps ?? 0} bps
                </span>
                {yieldSpread?.isInverted && <Badge variant="destructive">Inverted</Badge>}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Latest Data</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <div className="text-2xl font-bold">
                {stats?.latestObservation ? format(new Date(stats.latestObservation), "MMM d, yyyy") : "No data"}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="yield-curve" className="space-y-4">
        <TabsList>
          <TabsTrigger value="yield-curve">Yield Curve</TabsTrigger>
          <TabsTrigger value="forward-curve">Forward Curves</TabsTrigger>
          <TabsTrigger value="rates-table">Rates Table</TabsTrigger>
        </TabsList>

        <TabsContent value="yield-curve" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Yield Curve</CardTitle>
                  <CardDescription>
                    Current {RATE_TYPE_LABELS[selectedRateType]} yield curve as of{" "}
                    {yieldCurve?.curveDate ? format(new Date(yieldCurve.curveDate), "MMM d, yyyy") : "today"}
                  </CardDescription>
                </div>
                <Select value={selectedRateType} onValueChange={(v) => setSelectedRateType(v as RateType)}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="treasury">Treasury</SelectItem>
                    <SelectItem value="sofr">SOFR</SelectItem>
                    <SelectItem value="prime">Prime</SelectItem>
                    <SelectItem value="fed_funds">Fed Funds</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {curveLoading ? (
                <div className="h-[400px] flex items-center justify-center">
                  <Skeleton className="h-full w-full" />
                </div>
              ) : yieldCurveData.length === 0 ? (
                <div className="h-[400px] flex items-center justify-center text-muted-foreground">
                  No data available. Click "Refresh Rates" to fetch latest market data.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={400}>
                  <AreaChart data={yieldCurveData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorRate" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="name" className="text-xs" />
                    <YAxis
                      domain={["auto", "auto"]}
                      tickFormatter={(v) => `${v.toFixed(2)}%`}
                      className="text-xs"
                    />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (active && payload && payload.length) {
                          return (
                            <div className="bg-background border rounded-lg shadow-lg p-3">
                              <p className="font-medium">{label}</p>
                              <p className="text-blue-500">{(payload[0].value as number).toFixed(3)}%</p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Area type="monotone" dataKey="rate" stroke="#3b82f6" strokeWidth={2} fill="url(#colorRate)" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="forward-curve" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Forward Rate Curve</CardTitle>
                  <CardDescription>
                    Implied forward rates for {RATE_TYPE_LABELS[selectedForwardType]} over the next {forwardMonths} months
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Select value={selectedForwardType} onValueChange={(v) => setSelectedForwardType(v as RateType)}>
                    <SelectTrigger className="w-[120px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sofr">SOFR</SelectItem>
                      <SelectItem value="treasury">Treasury</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={forwardMonths.toString()} onValueChange={(v) => setForwardMonths(parseInt(v))}>
                    <SelectTrigger className="w-[100px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="12">1 Year</SelectItem>
                      <SelectItem value="24">2 Years</SelectItem>
                      <SelectItem value="36">3 Years</SelectItem>
                      <SelectItem value="60">5 Years</SelectItem>
                      <SelectItem value="120">10 Years</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {forwardLoading ? (
                <div className="h-[400px] flex items-center justify-center">
                  <Skeleton className="h-full w-full" />
                </div>
              ) : forwardCurveData.length === 0 ? (
                <div className="h-[400px] flex items-center justify-center text-muted-foreground">
                  No forward curve data available. Ensure rate data has been fetched first.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={400}>
                  <LineChart data={forwardCurveData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis
                      dataKey="month"
                      tickFormatter={(v) => (v % 12 === 0 ? `${v / 12}Y` : `${v}M`)}
                      className="text-xs"
                    />
                    <YAxis
                      domain={["auto", "auto"]}
                      tickFormatter={(v) => `${v.toFixed(2)}%`}
                      className="text-xs"
                    />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (active && payload && payload.length) {
                          return (
                            <div className="bg-background border rounded-lg shadow-lg p-3">
                              <p className="font-medium">Month {label}</p>
                              <p className="text-blue-500">Forward: {(payload[0].value as number).toFixed(3)}%</p>
                              {payload[1] && <p className="text-green-500">Spot: {(payload[1].value as number).toFixed(3)}%</p>}
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="forwardRate"
                      name="Forward Rate"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="spotRate"
                      name="Spot Rate"
                      stroke="#22c55e"
                      strokeWidth={2}
                      strokeDasharray="5 5"
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rates-table" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Current Rates</CardTitle>
              <CardDescription>Latest market rates across all tracked series</CardDescription>
            </CardHeader>
            <CardContent>
              {curveLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : (
                <div className="rounded-md border">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="h-10 px-4 text-left font-medium">Tenor</th>
                        <th className="h-10 px-4 text-right font-medium">Rate</th>
                        <th className="h-10 px-4 text-right font-medium">Months</th>
                        <th className="h-10 px-4 text-center font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {yieldCurveData.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="h-24 text-center text-muted-foreground">
                            No data available
                          </td>
                        </tr>
                      ) : (
                        yieldCurveData.map((point, i) => (
                          <tr key={i} className="border-b">
                            <td className="h-12 px-4 font-medium">{point.name}</td>
                            <td className="h-12 px-4 text-right tabular-nums">{point.rate.toFixed(3)}%</td>
                            <td className="h-12 px-4 text-right tabular-nums text-muted-foreground">{point.months}</td>
                            <td className="h-12 px-4 text-center">
                              {point.isInterpolated ? (
                                <Badge variant="secondary">Interpolated</Badge>
                              ) : (
                                <Badge variant="outline">Observed</Badge>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
