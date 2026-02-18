import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation, useSearch } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { ExportPdfButton } from "@/components/ui/export-pdf-button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { RefreshCw, TrendingUp, TrendingDown, Minus, ArrowUpRight, ArrowDownRight, Database, Calendar, Calculator, Landmark, Building2, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import type { ModelingProject } from "@shared/schema";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, AreaChart, Area, BarChart, Bar, Cell } from "recharts";

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
  const [, navigate] = useLocation();
  const reportRef = useRef<HTMLDivElement>(null);
  const searchString = useSearch();
  const [selectedRateType, setSelectedRateType] = useState<RateType>("treasury");
  const [selectedForwardType, setSelectedForwardType] = useState<RateType>("sofr");
  const [forwardMonths, setForwardMonths] = useState(60);
  const [debtSpreadBps, setDebtSpreadBps] = useState(250);
  const [debtHoldYears, setDebtHoldYears] = useState(5);
  const [debtFloorRate, setDebtFloorRate] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [activeTab, setActiveTab] = useState("overview");

  useEffect(() => {
    const params = new URLSearchParams(searchString);
    const tab = params.get('tab');
    if (tab) setActiveTab(tab);
  }, [searchString]);

  const { data: modelingProjects } = useQuery<ModelingProject[]>({
    queryKey: ['/api/modeling/projects'],
  });

  const applyToModel = () => {
    if (!selectedProjectId) {
      toast({ title: "Select a project first", variant: "destructive" });
      return;
    }
    const params = new URLSearchParams({
      tab: 'capital',
      debtSpread: String(debtSpreadBps),
      debtIndex: 'SOFR',
      debtTerm: String(debtHoldYears),
      ...(debtFloorRate ? { debtFloor: debtFloorRate } : {}),
    });
    navigate(`/modeling/projects/${selectedProjectId}?${params.toString()}`);
    toast({
      title: "Navigating to Capital Stack",
      description: `Opening with SOFR + ${debtSpreadBps}bps configured for ${debtHoldYears}-year hold`,
    });
  };

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

  const floorParam = debtFloorRate ? parseFloat(debtFloorRate) : undefined;
  const { data: debtModelingData, isLoading: debtModelingLoading } = useQuery<{
    holdYears: number;
    startYear: number;
    spreadBps: number;
    rateCap: number | null;
    rateFloor: number | null;
    forwardCurveAvailable: boolean;
    yearlyRates: {
      year: number;
      yearIndex: number;
      baseSofrRate: number;
      spreadBps: number;
      allInRate: number;
      allInRateCapped: number;
    }[];
  }>({
    queryKey: ['sofr-debt-modeling', debtHoldYears, debtSpreadBps, floorParam],
    queryFn: async () => {
      const params = new URLSearchParams({
        spreadBps: String(debtSpreadBps),
        ...(floorParam ? { rateFloor: String(floorParam) } : {}),
      });
      const res = await fetch(`/api/capital-markets/sofr-forward-rates/${debtHoldYears}?${params.toString()}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    },
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
    <div className="container mx-auto py-6 space-y-6" ref={reportRef}>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Capital Markets</h1>
          <p className="text-muted-foreground">Real-time yield curves, SOFR, and Treasury rates from FRED</p>
        </div>
        <div className="flex items-center gap-2">
          <ExportPdfButton contentRef={reportRef} filename="capital-markets" title="Capital Markets Analysis" />
          <Button onClick={() => refreshMutation.mutate()} disabled={refreshMutation.isPending}>
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshMutation.isPending ? "animate-spin" : ""}`} />
            Refresh Rates
          </Button>
        </div>
      </div>

      {curveLoading ? (
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="border-primary/20 bg-primary/5">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <Skeleton className="h-4 w-20" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-24" />
                <Skeleton className="h-3 w-16 mt-1" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : yieldCurve?.points && yieldCurve.points.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-4">
          {(() => {
            const keyTenors: Tenor[] = ["overnight", "2y", "5y", "10y"];
            const labels: Record<string, string> = { overnight: "SOFR / O/N", "2y": "2-Year Treasury", "5y": "5-Year Treasury", "10y": "10-Year Treasury" };
            return keyTenors.map((t) => {
              const point = yieldCurve.points.find((p) => p.tenor === t);
              return (
                <Card key={t} className="border-primary/20 bg-primary/5">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium">{labels[t]}</CardTitle>
                    <Landmark className="h-4 w-4 text-primary" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{point ? `${point.rate.toFixed(3)}%` : "N/A"}</div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {yieldCurve.curveDate ? format(new Date(yieldCurve.curveDate), "MMM d, yyyy") : ""}
                    </p>
                  </CardContent>
                </Card>
              );
            });
          })()}
        </div>
      ) : null}

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

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Yield Curve</TabsTrigger>
          <TabsTrigger value="forward-curve">Forward Curves</TabsTrigger>
          <TabsTrigger value="debt-modeling">Debt Modeling</TabsTrigger>
          <TabsTrigger value="rates-table">Rates Table</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
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

        <TabsContent value="debt-modeling" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="md:col-span-1">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calculator className="h-5 w-5" />
                  Spread Calculator
                </CardTitle>
                <CardDescription>
                  Configure floating-rate debt assumptions to see projected year-by-year rates
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Hold Period</Label>
                  <Select value={debtHoldYears.toString()} onValueChange={(v) => setDebtHoldYears(parseInt(v))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="3">3 Years</SelectItem>
                      <SelectItem value="5">5 Years</SelectItem>
                      <SelectItem value="7">7 Years</SelectItem>
                      <SelectItem value="10">10 Years</SelectItem>
                      <SelectItem value="15">15 Years</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Credit Spread (bps)</Label>
                  <Input
                    type="number"
                    value={debtSpreadBps}
                    onChange={(e) => setDebtSpreadBps(parseInt(e.target.value) || 0)}
                    placeholder="250"
                  />
                  <p className="text-xs text-muted-foreground">Basis points over SOFR (250bps = 2.50%)</p>
                </div>
                <div className="space-y-2">
                  <Label>Floor Rate (optional)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={debtFloorRate}
                    onChange={(e) => setDebtFloorRate(e.target.value)}
                    placeholder="e.g. 0.04 = 4%"
                  />
                  <p className="text-xs text-muted-foreground">Minimum all-in rate as decimal</p>
                </div>

                {debtModelingData && !debtModelingLoading && (
                  <div className="pt-4 border-t space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Avg All-In Rate</span>
                      <span className="font-semibold">
                        {(debtModelingData.yearlyRates.reduce((s, r) => s + r.allInRateCapped, 0) / debtModelingData.yearlyRates.length * 100).toFixed(2)}%
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Min Rate</span>
                      <span>{(Math.min(...debtModelingData.yearlyRates.map(r => r.allInRateCapped)) * 100).toFixed(2)}%</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Max Rate</span>
                      <span>{(Math.max(...debtModelingData.yearlyRates.map(r => r.allInRateCapped)) * 100).toFixed(2)}%</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Data Source</span>
                      <Badge variant="outline" className="text-xs">
                        {debtModelingData.forwardCurveAvailable ? 'SOFR Forward Curve' : 'Estimated'}
                      </Badge>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Landmark className="h-5 w-5" />
                  Projected Annual Debt Rates
                </CardTitle>
                <CardDescription>
                  SOFR forward curve + {debtSpreadBps}bps spread over a {debtHoldYears}-year hold
                </CardDescription>
              </CardHeader>
              <CardContent>
                {debtModelingLoading ? (
                  <div className="space-y-2">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Skeleton key={i} className="h-12 w-full" />
                    ))}
                  </div>
                ) : !debtModelingData?.forwardCurveAvailable ? (
                  <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                    No SOFR forward curve data available. Click "Refresh Rates" to fetch latest market data.
                  </div>
                ) : (
                  <div className="space-y-6">
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={debtModelingData.yearlyRates.map(r => ({
                        name: `${r.year}`,
                        baseSofr: +(r.baseSofrRate * 100).toFixed(2),
                        spread: +(debtSpreadBps / 100).toFixed(2),
                        allIn: +(r.allInRateCapped * 100).toFixed(2),
                      }))} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="name" className="text-xs" />
                        <YAxis tickFormatter={(v) => `${v.toFixed(1)}%`} className="text-xs" />
                        <Tooltip
                          content={({ active, payload, label }) => {
                            if (active && payload && payload.length) {
                              return (
                                <div className="bg-background border rounded-lg shadow-lg p-3 space-y-1">
                                  <p className="font-medium">{label}</p>
                                  <p className="text-sm text-blue-500">Base SOFR: {payload[0]?.value}%</p>
                                  <p className="text-sm text-amber-500">Spread: +{payload[1]?.value}%</p>
                                  <p className="text-sm font-semibold">All-In: {payload[2]?.value}%</p>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <Bar dataKey="baseSofr" name="Base SOFR" stackId="a" fill="#3b82f6" radius={[0, 0, 0, 0]} />
                        <Bar dataKey="spread" name="Spread" stackId="a" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                        <Line type="monotone" dataKey="allIn" name="All-In Rate" stroke="#ef4444" strokeWidth={2} />
                        <Legend />
                      </BarChart>
                    </ResponsiveContainer>

                    <div className="rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Year</TableHead>
                            <TableHead className="text-right">Base SOFR</TableHead>
                            <TableHead className="text-right">Spread</TableHead>
                            <TableHead className="text-right font-semibold">All-In Rate</TableHead>
                            <TableHead className="text-right">vs. Flat 6.5%</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {debtModelingData.yearlyRates.map((yr) => {
                            const diff = yr.allInRateCapped - 0.065;
                            return (
                              <TableRow key={yr.year}>
                                <TableCell className="font-medium">Year {yr.yearIndex} ({yr.year})</TableCell>
                                <TableCell className="text-right tabular-nums">{(yr.baseSofrRate * 100).toFixed(2)}%</TableCell>
                                <TableCell className="text-right tabular-nums text-amber-600">+{yr.spreadBps}bps</TableCell>
                                <TableCell className="text-right tabular-nums font-semibold">
                                  {(yr.allInRateCapped * 100).toFixed(2)}%
                                  {yr.allInRate !== yr.allInRateCapped && (
                                    <Badge variant="outline" className="ml-1 text-[10px]">capped</Badge>
                                  )}
                                </TableCell>
                                <TableCell className={`text-right tabular-nums ${diff > 0 ? 'text-red-500' : 'text-green-600'}`}>
                                  {diff > 0 ? '+' : ''}{(diff * 100).toFixed(0)}bps
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card className="border-indigo-200 dark:border-indigo-800">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-md bg-indigo-100 dark:bg-indigo-900">
                  <Building2 className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div>
                  <CardTitle className="text-base">Apply to Financial Model</CardTitle>
                  <CardDescription>Push these debt parameters into a project's Capital Stack</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-end gap-3">
                <div className="flex-1 space-y-1.5">
                  <Label className="text-xs">Select Project</Label>
                  <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a modeling project..." />
                    </SelectTrigger>
                    <SelectContent>
                      {modelingProjects?.map((p) => (
                        <SelectItem key={p.id} value={String(p.id)}>
                          {p.marinaName || p.name || `Project #${p.id}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  onClick={applyToModel}
                  disabled={!selectedProjectId || !debtModelingData?.forwardCurveAvailable}
                  className="gap-1.5"
                >
                  <ExternalLink className="h-4 w-4" />
                  Apply to Model
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Opens the project's Capital Stack with SOFR + {debtSpreadBps}bps pre-configured for a {debtHoldYears}-year hold
              </p>
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
