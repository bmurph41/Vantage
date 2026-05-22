import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import {
  TrendingUp, TrendingDown, DollarSign, Percent, Anchor, Activity,
  BarChart3, ArrowUpRight, ArrowDownRight, MapPin, ExternalLink, RefreshCw, Layers, Waves,
} from "lucide-react";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtM(n: number | null | undefined): string {
  if (n == null) return "—";
  const abs = Math.abs(n);
  if (abs >= 1e9) return `$${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `$${(abs / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `$${(abs / 1e3).toFixed(0)}K`;
  return `$${abs.toLocaleString()}`;
}

function fmtPct(n: number | null | undefined, decimals = 2): string {
  if (n == null) return "—";
  return `${Number(n).toFixed(decimals)}%`;
}

const AC_COLORS: Record<string, string> = {
  Coastal: "#3b82f6",
  Lake: "#10b981",
  River: "#f59e0b",
  Unknown: "#94a3b8",
};

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({
  title, value, sub, icon: Icon, color, linkHref, linkLabel, benchmark, delta,
}: {
  title: string;
  value: string;
  sub?: string;
  icon?: any;
  color?: string;
  linkHref?: string;
  linkLabel?: string;
  benchmark?: number | null;
  delta?: number | null;
}) {
  return (
    <Card className="hover:border-primary/40 transition-colors">
      <CardHeader className="flex flex-row items-center justify-between pb-1">
        <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{title}</CardTitle>
        {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
      </CardHeader>
      <CardContent className="pt-0">
        <div className="text-2xl font-bold font-mono" style={color ? { color } : {}}>{value}</div>
        {sub && (
          <div className="flex items-center gap-1 mt-0.5">
            <span className="text-xs text-muted-foreground">{sub}</span>
          </div>
        )}
        {benchmark != null && (
          <div className="flex items-center gap-1 mt-1 text-xs">
            <span className="text-muted-foreground">vs platform avg {fmtPct(benchmark, 1)}</span>
            {delta != null && (
              <span className={delta > 0 ? "text-emerald-600 font-semibold" : delta < 0 ? "text-red-600 font-semibold" : "text-muted-foreground"}>
                {delta > 0 ? "+" : ""}{delta.toFixed(1)}%
              </span>
            )}
          </div>
        )}
        {linkHref && (
          <Link href={linkHref}>
            <span className="text-xs text-primary hover:underline flex items-center gap-0.5 mt-1 cursor-pointer">
              {linkLabel || "View details"} <ExternalLink className="h-3 w-3" />
            </span>
          </Link>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────

type TimeRange = "3m" | "6m" | "12m" | "24m";

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function MarketIntelligenceHub() {
  const [timeRange, setTimeRange] = useState<TimeRange>("12m");
  const [state, setState] = useState<string>("all");
  const [region, setRegion] = useState<string>("all");
  const [waterType, setWaterType] = useState<string>("all");

  const params = new URLSearchParams({ timeRange });
  if (state !== "all") params.set("state", state);
  if (region !== "all") params.set("region", region);
  if (waterType !== "all") params.set("waterType", waterType);

  const { data: filterOptions } = useQuery<{ states: string[]; regions: string[]; waterTypes: string[] }>({
    queryKey: ["/api/market-intelligence/filter-options"],
    staleTime: 1000 * 60 * 60,
  });

  const { data: summary, isLoading, refetch } = useQuery<any>({
    queryKey: [`/api/market-intelligence/summary`, timeRange, state, region, waterType],
    queryFn: async () => {
      const res = await fetch(`/api/market-intelligence/summary?${params}`);
      if (!res.ok) throw new Error("Failed to fetch market summary");
      return res.json();
    },
    staleTime: 1000 * 60 * 5,
  });

  const { data: transactions, isLoading: txLoading } = useQuery<any[]>({
    queryKey: [`/api/market-intelligence/recent-transactions`, timeRange, state, region, waterType],
    queryFn: async () => {
      const res = await fetch(`/api/market-intelligence/recent-transactions?${params}&limit=20`);
      if (!res.ok) throw new Error("Failed to fetch transactions");
      return res.json();
    },
    staleTime: 1000 * 60 * 5,
  });

  const s = summary?.summary;
  const capRateTrend: any[] = summary?.capRateTrend || [];
  const volumeTrend: any[] = summary?.volumeTrend || [];
  const byState: any[] = summary?.byState || [];
  const assetClassBreakdown: any[] = summary?.assetClassBreakdown || [];
  const rateCompsData = summary?.rateComps;
  const benchmarkComparisons = summary?.benchmarkComparisons;
  const platformBenchmarks = summary?.platformBenchmarks || {};

  const hasFilters = state !== "all" || region !== "all" || waterType !== "all";

  return (
    <div className="container mx-auto px-4 py-8 max-w-[1400px]">
      {/* Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Activity className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight">Market Intelligence</h1>
            <Badge variant="outline" className="text-xs font-mono">LIVE</Badge>
          </div>
          <p className="text-muted-foreground text-sm mt-1">
            Marina transaction data, cap rate trends, and platform benchmarks — drawn from sales comps, rate comps, and industry benchmarking data
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading} className="shrink-0">
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-6">
        <Select value={timeRange} onValueChange={v => setTimeRange(v as TimeRange)}>
          <SelectTrigger className="w-[150px] h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="3m">Trailing 3 Months</SelectItem>
            <SelectItem value="6m">Trailing 6 Months</SelectItem>
            <SelectItem value="12m">Trailing 12 Months</SelectItem>
            <SelectItem value="24m">Trailing 24 Months</SelectItem>
          </SelectContent>
        </Select>

        <Select value={waterType} onValueChange={setWaterType}>
          <SelectTrigger className="w-[150px] h-8 text-xs"><SelectValue placeholder="All Asset Types" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Asset Types</SelectItem>
            {(filterOptions?.waterTypes || []).map(wt => (
              <SelectItem key={wt} value={wt}>{wt} Marina</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={state} onValueChange={setState}>
          <SelectTrigger className="w-[130px] h-8 text-xs"><SelectValue placeholder="All States" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All States</SelectItem>
            {(filterOptions?.states || []).map(s => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={region} onValueChange={setRegion}>
          <SelectTrigger className="w-[130px] h-8 text-xs"><SelectValue placeholder="All Regions" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Regions</SelectItem>
            {(filterOptions?.regions || []).map(r => (
              <SelectItem key={r} value={r}>{r}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {hasFilters && (
          <Button variant="ghost" size="sm" className="h-8 text-xs"
            onClick={() => { setState("all"); setRegion("all"); setWaterType("all"); }}>
            Clear filters
          </Button>
        )}
      </div>

      {/* KPI Cards */}
      {isLoading ? (
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4 mb-6">
          {[...Array(4)].map((_, i) => (
            <Card key={i}><CardContent className="h-28 flex items-center justify-center"><Skeleton className="h-12 w-full" /></CardContent></Card>
          ))}
        </div>
      ) : (
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4 mb-6">
          <KpiCard
            title="Deal Volume"
            value={s?.dealCount != null ? String(s.dealCount) : "—"}
            sub={s?.totalVolume > 0 ? `${fmtM(s.totalVolume)} total` : "transactions"}
            icon={BarChart3}
            linkHref="/analysis/sales-comps"
            linkLabel="View all comps"
          />
          <KpiCard
            title="Avg Cap Rate"
            value={fmtPct(s?.avgCapRate)}
            sub={s?.medianCapRate != null ? `Median: ${fmtPct(s.medianCapRate)}` : undefined}
            icon={Percent}
            color={s?.avgCapRate ? "#3b82f6" : undefined}
            benchmark={benchmarkComparisons?.capRate?.platformMedian}
            delta={benchmarkComparisons?.capRate?.delta}
            linkHref="/analysis/sales-comps/analytics"
            linkLabel="Cap rate deep dive"
          />
          <KpiCard
            title="Avg Price / Slip"
            value={s?.avgPricePerSlip != null ? fmtM(s.avgPricePerSlip) : "—"}
            sub="wet slip or dry rack"
            icon={Anchor}
            linkHref="/analysis/sales-comps"
            linkLabel="Price analytics"
          />
          <KpiCard
            title="Avg Occupancy"
            value={s?.avgOccupancy != null ? fmtPct(s.avgOccupancy, 1) : "—"}
            sub="across disclosed comps"
            icon={Layers}
            benchmark={benchmarkComparisons?.occupancy?.platformMedian}
            delta={benchmarkComparisons?.occupancy?.delta}
            linkHref="/analysis/benchmarks"
            linkLabel="Benchmarks"
          />
        </div>
      )}

      {/* Rate Comps + Benchmark Strip */}
      {!isLoading && (rateCompsData?.avgMonthlySlipRate != null || Object.keys(platformBenchmarks).length > 0) && (
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-4 mb-6">
          {rateCompsData?.avgMonthlySlipRate != null && (
            <Card className="border-dashed">
              <CardHeader className="pb-1">
                <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                  <Waves className="h-3 w-3" /> Avg Monthly Rate
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="text-xl font-bold font-mono">{fmtM(rateCompsData.avgMonthlySlipRate)}/mo</div>
                <div className="text-xs text-muted-foreground mt-0.5">from {rateCompsData.count} rate comps</div>
                <Link href="/analysis/rate-comps">
                  <span className="text-xs text-primary hover:underline flex items-center gap-0.5 mt-1 cursor-pointer">
                    Rate comps <ExternalLink className="h-3 w-3" />
                  </span>
                </Link>
              </CardContent>
            </Card>
          )}
          {platformBenchmarks?.cap_rate?.p50 != null && (
            <Card className="border-dashed">
              <CardHeader className="pb-1">
                <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Platform Cap Rate p50</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="text-xl font-bold font-mono text-purple-600">{fmtPct(platformBenchmarks.cap_rate.p50)}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{platformBenchmarks.cap_rate.cohortSize} orgs</div>
                <Link href="/analysis/benchmarks">
                  <span className="text-xs text-primary hover:underline flex items-center gap-0.5 mt-1 cursor-pointer">
                    Industry benchmarks <ExternalLink className="h-3 w-3" />
                  </span>
                </Link>
              </CardContent>
            </Card>
          )}
          {platformBenchmarks?.occupancy_rate?.p50 != null && (
            <Card className="border-dashed">
              <CardHeader className="pb-1">
                <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Platform Occupancy p50</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="text-xl font-bold font-mono text-emerald-600">{fmtPct(platformBenchmarks.occupancy_rate.p50)}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{platformBenchmarks.occupancy_rate.cohortSize} orgs</div>
                <Link href="/analysis/benchmarks">
                  <span className="text-xs text-primary hover:underline flex items-center gap-0.5 mt-1 cursor-pointer">
                    Industry benchmarks <ExternalLink className="h-3 w-3" />
                  </span>
                </Link>
              </CardContent>
            </Card>
          )}
          {platformBenchmarks?.noi_per_slip?.p50 != null && (
            <Card className="border-dashed">
              <CardHeader className="pb-1">
                <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Platform NOI/Slip p50</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="text-xl font-bold font-mono">{fmtM(platformBenchmarks.noi_per_slip.p50)}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{platformBenchmarks.noi_per_slip.cohortSize} orgs</div>
                <Link href="/analysis/benchmarks">
                  <span className="text-xs text-primary hover:underline flex items-center gap-0.5 mt-1 cursor-pointer">
                    Industry benchmarks <ExternalLink className="h-3 w-3" />
                  </span>
                </Link>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Charts Row */}
      <div className="grid gap-4 lg:grid-cols-2 mb-6">
        {/* Cap Rate Trend */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-medium">Cap Rate Trend</CardTitle>
                <CardDescription className="text-xs">Average cap rate by quarter from sales comp transactions</CardDescription>
              </div>
              <Link href="/analysis/sales-comps/analytics">
                <Button variant="ghost" size="sm" className="h-7 text-xs gap-1">
                  Deep dive <ExternalLink className="h-3 w-3" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-[200px] w-full" />
            ) : capRateTrend.length === 0 ? (
              <div className="h-[200px] flex items-center justify-center text-muted-foreground text-xs">
                <div className="text-center">
                  <BarChart3 className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p>No cap rate data for this period</p>
                  <Link href="/analysis/sales-comps/upload">
                    <span className="text-primary hover:underline cursor-pointer">Upload comps to populate</span>
                  </Link>
                </div>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={capRateTrend}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="period" fontSize={10} />
                  <YAxis fontSize={10} tickFormatter={v => `${Number(v).toFixed(1)}%`} domain={["auto", "auto"]} width={40} />
                  <Tooltip
                    formatter={(v: any) => [`${Number(v).toFixed(2)}%`, "Avg Cap Rate"]}
                    labelFormatter={l => String(l)}
                  />
                  <Line
                    type="monotone"
                    dataKey="avgCapRate"
                    name="Avg Cap Rate"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Asset Class Breakdown */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-medium">By Asset Class (Water Type)</CardTitle>
                <CardDescription className="text-xs">Deal count and average cap rate by marina type</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-[200px] w-full" />
            ) : assetClassBreakdown.length === 0 ? (
              <div className="h-[200px] flex items-center justify-center text-muted-foreground text-xs">
                <div className="text-center">
                  <Waves className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p>No asset class data available</p>
                </div>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={assetClassBreakdown} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" horizontal={false} />
                  <XAxis type="number" fontSize={10} />
                  <YAxis type="category" dataKey="assetClass" fontSize={10} width={65} />
                  <Tooltip
                    formatter={(value: any, name: string) => [
                      name === "dealCount" ? value : `${Number(value).toFixed(1)}%`,
                      name === "dealCount" ? "Deals" : "Avg Cap Rate",
                    ]}
                  />
                  <Bar dataKey="dealCount" name="dealCount" radius={[0, 3, 3, 0]}>
                    {assetClassBreakdown.map((entry: any, i: number) => (
                      <Cell key={i} fill={AC_COLORS[entry.assetClass] || "#94a3b8"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Volume Trend + Asset Class Cap Rates */}
      <div className="grid gap-4 lg:grid-cols-2 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-medium">Transaction Volume</CardTitle>
                <CardDescription className="text-xs">Deal count by month</CardDescription>
              </div>
              <Link href="/analysis/sales-comps">
                <Button variant="ghost" size="sm" className="h-7 text-xs gap-1">
                  All comps <ExternalLink className="h-3 w-3" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-[180px] w-full" />
            ) : volumeTrend.length === 0 ? (
              <div className="h-[180px] flex items-center justify-center text-muted-foreground text-xs">No volume data</div>
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={volumeTrend}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="period" fontSize={9} />
                  <YAxis fontSize={10} width={25} />
                  <Tooltip formatter={(v: any, name: string) => [name === "count" ? v : fmtM(v), name === "count" ? "Deals" : "Volume"]} />
                  <Bar dataKey="count" name="count" fill="#10b981" fillOpacity={0.8} radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Asset Class Cap Rate Comparison */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-medium">Cap Rate by Asset Class</CardTitle>
                <CardDescription className="text-xs">Average cap rate per marina water type</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-[180px] w-full" />
            ) : assetClassBreakdown.filter((ac: any) => ac.avgCapRate != null).length === 0 ? (
              <div className="h-[180px] flex items-center justify-center text-muted-foreground text-xs">No cap rate data by asset class</div>
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={assetClassBreakdown.filter((ac: any) => ac.avgCapRate != null)} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" horizontal={false} />
                  <XAxis type="number" fontSize={10} tickFormatter={v => `${Number(v).toFixed(1)}%`} />
                  <YAxis type="category" dataKey="assetClass" fontSize={10} width={65} />
                  <Tooltip formatter={(v: any) => [`${Number(v).toFixed(2)}%`, "Avg Cap Rate"]} />
                  <Bar dataKey="avgCapRate" name="avgCapRate" radius={[0, 3, 3, 0]}>
                    {assetClassBreakdown.filter((ac: any) => ac.avgCapRate != null).map((entry: any, i: number) => (
                      <Cell key={i} fill={AC_COLORS[entry.assetClass] || "#94a3b8"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* By State + Recent Transactions */}
      <div className="grid gap-4 lg:grid-cols-3 mb-6">
        {/* By State */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-1.5">
              <MapPin className="h-4 w-4" /> Market by State
            </CardTitle>
            <CardDescription className="text-xs">Deal count and avg cap rate</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-4"><Skeleton className="h-[300px] w-full" /></div>
            ) : byState.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground text-xs">No geographic data available</div>
            ) : (
              <div className="max-h-[340px] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs pl-4">State</TableHead>
                      <TableHead className="text-xs text-right">Deals</TableHead>
                      <TableHead className="text-xs text-right pr-4">Avg Cap</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {byState.map((row: any) => (
                      <TableRow key={row.state} className="text-xs">
                        <TableCell className="py-1.5 pl-4 font-medium">{row.state}</TableCell>
                        <TableCell className="py-1.5 text-right">{row.count}</TableCell>
                        <TableCell className="py-1.5 text-right pr-4">
                          {row.avgCapRate != null ? `${Number(row.avgCapRate).toFixed(1)}%` : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Transactions */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-medium flex items-center gap-1.5">
                  <Activity className="h-4 w-4" /> Recent Transactions
                </CardTitle>
                <CardDescription className="text-xs">Latest closed deals from platform comp data</CardDescription>
              </div>
              <Link href="/analysis/sales-comps">
                <Button variant="ghost" size="sm" className="h-7 text-xs gap-1">
                  Full database <ExternalLink className="h-3 w-3" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {txLoading ? (
              <div className="p-4"><Skeleton className="h-[300px] w-full" /></div>
            ) : !transactions || transactions.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground text-xs">
                <Anchor className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p>No recent transactions in this period</p>
                <Link href="/analysis/sales-comps/upload">
                  <span className="text-primary hover:underline cursor-pointer">Upload sales comps to populate</span>
                </Link>
              </div>
            ) : (
              <div className="max-h-[340px] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs pl-4">Marina</TableHead>
                      <TableHead className="text-xs">Location</TableHead>
                      <TableHead className="text-xs">Type</TableHead>
                      <TableHead className="text-xs text-right">Price</TableHead>
                      <TableHead className="text-xs text-right">Cap Rate</TableHead>
                      <TableHead className="text-xs text-right pr-4">$/Slip</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions.map((tx: any) => (
                      <TableRow key={tx.id} className="text-xs">
                        <TableCell className="py-1.5 pl-4 font-medium max-w-[110px] truncate">
                          <Link href={`/analysis/sales-comps/${tx.id}`}>
                            <span className="hover:underline text-primary cursor-pointer">{tx.marina}</span>
                          </Link>
                        </TableCell>
                        <TableCell className="py-1.5 text-muted-foreground text-[10px]">
                          {[tx.city, tx.state].filter(Boolean).join(", ") || "—"}
                        </TableCell>
                        <TableCell className="py-1.5">
                          {tx.waterType ? (
                            <Badge variant="outline" className="text-[9px] h-4 px-1" style={{ borderColor: AC_COLORS[tx.waterType] || "#94a3b8", color: AC_COLORS[tx.waterType] || "#94a3b8" }}>
                              {tx.waterType}
                            </Badge>
                          ) : "—"}
                        </TableCell>
                        <TableCell className="py-1.5 text-right font-mono">
                          {tx.isPriceDisclosed === false ? "Undisclosed" : tx.salePrice ? fmtM(tx.salePrice) : "—"}
                        </TableCell>
                        <TableCell className="py-1.5 text-right">
                          {tx.isCapRateDisclosed === false ? "—" : tx.capRate ? `${Number(tx.capRate).toFixed(1)}%` : "—"}
                        </TableCell>
                        <TableCell className="py-1.5 text-right pr-4 font-mono">
                          {tx.pricePerSlip ? fmtM(tx.pricePerSlip) : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Drill-into-data links */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Drill Into the Data</CardTitle>
          <CardDescription className="text-xs">Jump directly into the underlying datasets powering this dashboard</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { title: "Sales Comps", description: "Full transaction database", href: "/analysis/sales-comps", icon: DollarSign, color: "text-emerald-600" },
              { title: "Rate Comps", description: "Slip rate benchmarks by market", href: "/analysis/rate-comps", icon: Anchor, color: "text-blue-600" },
              { title: "Capital Markets", description: "Treasury yields & FRED data", href: "/analysis/benchmarks", icon: TrendingUp, color: "text-purple-600" },
              { title: "Industry Benchmarks", description: "Platform-wide performance metrics", href: "/analysis/benchmarks", icon: BarChart3, color: "text-orange-600" },
            ].map(link => (
              <Link key={`${link.href}-${link.title}`} href={link.href}>
                <div className="flex items-start gap-2 p-3 rounded-lg border hover:border-primary/50 hover:bg-muted/50 cursor-pointer transition-colors group">
                  <link.icon className={`h-5 w-5 mt-0.5 shrink-0 ${link.color}`} />
                  <div>
                    <p className="text-xs font-semibold group-hover:text-primary transition-colors">{link.title}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{link.description}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
