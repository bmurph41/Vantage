/**
 * RV Park / MHP Analytics Panel
 *
 * Displays RV Park and Mobile Home Park specific analytics:
 * - Pad occupancy KPIs
 * - Seasonal occupancy trend (12-month line chart)
 * - Pad mix performance (by type)
 */

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TentTree, TrendingUp, MapPin, DollarSign, AlertCircle } from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Legend, Cell
} from "recharts";

interface RVParkKPIs {
  totalPads: number;
  occupiedPads: number;
  padOccupancyPct: number;
  avgPadRent: number;
  churnRate: number;
  avgLengthOfStayMonths: number;
  amenityFeeContribution: number;
  totalMonthlyRevenue: number;
  seasonalOccupancyCurve: { month: number; monthLabel: string; occupancyPct: number }[];
}

interface PadMixItem {
  padType: string;
  totalPads: number;
  occupiedPads: number;
  occupancyRate: number;
  avgMonthlyRent: number;
  totalRevenue: number;
  revenueShare: number;
}

interface SeasonalDemandItem {
  month: number;
  monthLabel: string;
  currentYearOccupancy: number;
  priorYearOccupancy: number;
  delta: number;
}

interface RVParkAnalyticsPanelProps {
  locationId: string;
}

const COLORS = ["#6366f1", "#8b5cf6", "#a78bfa", "#c4b5fd", "#ddd6fe", "#ede9fe"];

const fmt = (n: number, decimals = 2) =>
  new Intl.NumberFormat("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(n);

const fmtCurrency = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);

export default function RVParkAnalyticsPanel({ locationId }: RVParkAnalyticsPanelProps) {
  const { data: kpis, isLoading: kpisLoading, isError: kpisError } = useQuery<RVParkKPIs>({
    queryKey: ["/api/rent-roll/analytics/rv-park/kpis", locationId],
    queryFn: async () => {
      const res = await fetch(`/api/rent-roll/analytics/rv-park/kpis?locationId=${locationId}`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!locationId,
  });

  const { data: padMix } = useQuery<PadMixItem[]>({
    queryKey: ["/api/rent-roll/analytics/rv-park/pad-mix", locationId],
    queryFn: async () => {
      const res = await fetch(`/api/rent-roll/analytics/rv-park/pad-mix?locationId=${locationId}`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!locationId,
  });

  const { data: seasonal } = useQuery<SeasonalDemandItem[]>({
    queryKey: ["/api/rent-roll/analytics/rv-park/seasonal-demand", locationId],
    queryFn: async () => {
      const res = await fetch(`/api/rent-roll/analytics/rv-park/seasonal-demand?locationId=${locationId}`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!locationId,
  });

  if (kpisLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <Card key={i}><CardContent className="pt-4"><Skeleton className="h-12 w-full" /></CardContent></Card>)}
        </div>
        <Card><CardContent className="pt-4"><Skeleton className="h-48 w-full" /></CardContent></Card>
      </div>
    );
  }

  if (kpisError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex gap-2 text-destructive">
            <AlertCircle className="w-5 h-5" />
            Failed to Load RV Park Analytics
          </CardTitle>
        </CardHeader>
      </Card>
    );
  }

  const occupancyColor = (kpis?.padOccupancyPct || 0) >= 90 ? "text-green-600" : (kpis?.padOccupancyPct || 0) >= 70 ? "text-yellow-600" : "text-red-600";

  return (
    <div className="space-y-4">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <TentTree className="w-4 h-4" />
              <span className="text-xs font-medium">Pad Occupancy</span>
            </div>
            <p className={`text-2xl font-bold ${occupancyColor}`}>{kpis?.padOccupancyPct ?? "—"}%</p>
            <p className="text-xs text-muted-foreground mt-1">{kpis?.occupiedPads}/{kpis?.totalPads} pads occupied</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <DollarSign className="w-4 h-4" />
              <span className="text-xs font-medium">Avg Pad Rent</span>
            </div>
            <p className="text-2xl font-bold">{kpis ? fmtCurrency(kpis.avgPadRent) : "—"}</p>
            <p className="text-xs text-muted-foreground mt-1">per month</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <TrendingUp className="w-4 h-4" />
              <span className="text-xs font-medium">Monthly Revenue</span>
            </div>
            <p className="text-2xl font-bold">{kpis ? fmtCurrency(kpis.totalMonthlyRevenue) : "—"}</p>
            <p className="text-xs text-muted-foreground mt-1">incl. amenity fees: {kpis ? fmtCurrency(kpis.amenityFeeContribution) : "—"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <MapPin className="w-4 h-4" />
              <span className="text-xs font-medium">Avg Stay / Churn</span>
            </div>
            <p className="text-2xl font-bold">{kpis ? fmt(kpis.avgLengthOfStayMonths, 1) : "—"}mo</p>
            <p className="text-xs text-muted-foreground mt-1">
              <span className={kpis && kpis.churnRate > 15 ? "text-red-600" : "text-green-600"}>
                {kpis ? fmt(kpis.churnRate, 1) : "—"}% churn
              </span>
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Seasonal Occupancy Chart */}
      {seasonal && seasonal.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Year-Over-Year Seasonal Demand</CardTitle>
            <CardDescription>Monthly occupancy rate comparison (current vs prior year)</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={seasonal} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="monthLabel" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={v => `${v}%`} domain={[0, 100]} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => `${v}%`} />
                <Legend />
                <Line type="monotone" dataKey="currentYearOccupancy" name="Current Year" stroke="#6366f1" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="priorYearOccupancy" name="Prior Year" stroke="#94a3b8" strokeWidth={2} dot={false} strokeDasharray="4 2" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* 12-month Occupancy Trend from KPIs */}
      {kpis?.seasonalOccupancyCurve && kpis.seasonalOccupancyCurve.length > 0 && !seasonal && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Trailing 12-Month Occupancy</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={kpis.seasonalOccupancyCurve} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="monthLabel" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={v => `${v}%`} domain={[0, 100]} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => `${v}%`} />
                <Line type="monotone" dataKey="occupancyPct" name="Occupancy" stroke="#6366f1" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Pad Mix Performance Table */}
      {padMix && padMix.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Pad Mix Performance</CardTitle>
            <CardDescription>Revenue and occupancy by pad type</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pad Type</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Occupied</TableHead>
                  <TableHead className="text-right">Occupancy</TableHead>
                  <TableHead className="text-right">Avg Rent</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                  <TableHead className="text-right">Revenue %</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {padMix.map((p, i) => (
                  <TableRow key={p.padType}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                        <span className="font-medium">{p.padType}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">{p.totalPads}</TableCell>
                    <TableCell className="text-right">{p.occupiedPads}</TableCell>
                    <TableCell className="text-right">
                      <Badge variant={p.occupancyRate >= 90 ? "secondary" : p.occupancyRate >= 70 ? "outline" : "destructive"} className="text-xs">
                        {fmt(p.occupancyRate, 1)}%
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">{fmtCurrency(p.avgMonthlyRent)}</TableCell>
                    <TableCell className="text-right">{fmtCurrency(p.totalRevenue)}</TableCell>
                    <TableCell className="text-right">{fmt(p.revenueShare, 1)}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
