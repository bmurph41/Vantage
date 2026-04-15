/**
 * Industrial / Warehouse Analytics Panel
 *
 * Displays industrial-specific analytics:
 * - Leased/vacant SF, avg rent PSF, WALT
 * - Rollover schedule (5-year bar chart)
 * - Tenant concentration (top 10 by revenue)
 * - Rent PSF comparison: in-place vs market
 */

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Warehouse, TrendingUp, DollarSign, Users, AlertCircle, ArrowUp, ArrowDown } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie
} from "recharts";

interface IndustrialKPIs {
  totalSF: number;
  leasedSF: number;
  vacantSF: number;
  leasedPct: number;
  avgRentPSF: number;
  walt: number;
  totalAnnualRevenue: number;
  avgRentPerLease: number;
  tenantCount: number;
}

interface RolloverYear {
  year: number;
  leasesExpiring: number;
  sfAtRisk: number;
  annualRevenueAtRisk: number;
  pctOfTotalSF: number;
  pctOfTotalRevenue: number;
}

interface TenantConcentration {
  rank: number;
  tenantName: string;
  unitType: string;
  annualRevenue: number;
  pctOfTotalRevenue: number;
  sf: number;
  leaseExpiration: string | null;
}

interface RentPSFItem {
  leaseId: string;
  tenantName: string;
  unitType: string;
  sf: number;
  inPlaceRentPSF: number;
  marketRentPSF: number | null;
  variancePct: number | null;
  leaseExpiration: string | null;
}

interface IndustrialAnalyticsPanelProps {
  locationId: string;
}

const fmt = (n: number, decimals = 2) =>
  new Intl.NumberFormat("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(n);

const fmtCurrency = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);

const fmtSF = (n: number) =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n) + " SF";

const COLORS = ["#6366f1", "#8b5cf6", "#a78bfa", "#c4b5fd", "#ddd6fe", "#ede9fe", "#818cf8", "#4f46e5"];

export default function IndustrialAnalyticsPanel({ locationId }: IndustrialAnalyticsPanelProps) {
  const { data: kpis, isLoading: kpisLoading, isError: kpisError } = useQuery<IndustrialKPIs>({
    queryKey: ["/api/rent-roll/analytics/industrial/kpis", locationId],
    queryFn: async () => {
      const res = await fetch(`/api/rent-roll/analytics/industrial/kpis?locationId=${locationId}`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!locationId,
  });

  const { data: rollover } = useQuery<RolloverYear[]>({
    queryKey: ["/api/rent-roll/analytics/industrial/rollover-schedule", locationId],
    queryFn: async () => {
      const res = await fetch(`/api/rent-roll/analytics/industrial/rollover-schedule?locationId=${locationId}`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!locationId,
  });

  const { data: concentration } = useQuery<TenantConcentration[]>({
    queryKey: ["/api/rent-roll/analytics/industrial/tenant-concentration", locationId],
    queryFn: async () => {
      const res = await fetch(`/api/rent-roll/analytics/industrial/tenant-concentration?locationId=${locationId}`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!locationId,
  });

  const { data: rentPSF } = useQuery<RentPSFItem[]>({
    queryKey: ["/api/rent-roll/analytics/industrial/rent-psf", locationId],
    queryFn: async () => {
      const res = await fetch(`/api/rent-roll/analytics/industrial/rent-psf?locationId=${locationId}`);
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
            Failed to Load Industrial Analytics
          </CardTitle>
        </CardHeader>
      </Card>
    );
  }

  const leasedColor = (kpis?.leasedPct || 0) >= 90 ? "text-green-600" : (kpis?.leasedPct || 0) >= 70 ? "text-yellow-600" : "text-red-600";

  return (
    <div className="space-y-4">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Warehouse className="w-4 h-4" />
              <span className="text-xs font-medium">Leased %</span>
            </div>
            <p className={`text-2xl font-bold ${leasedColor}`}>{kpis?.leasedPct ?? "—"}%</p>
            <p className="text-xs text-muted-foreground mt-1">
              {kpis ? fmtSF(kpis.leasedSF) : "—"} of {kpis ? fmtSF(kpis.totalSF) : "—"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <DollarSign className="w-4 h-4" />
              <span className="text-xs font-medium">Avg Rent PSF</span>
            </div>
            <p className="text-2xl font-bold">${kpis ? fmt(kpis.avgRentPSF) : "—"}</p>
            <p className="text-xs text-muted-foreground mt-1">annual $/SF</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <TrendingUp className="w-4 h-4" />
              <span className="text-xs font-medium">WALT</span>
            </div>
            <p className="text-2xl font-bold">{kpis ? fmt(kpis.walt, 1) : "—"} yrs</p>
            <p className="text-xs text-muted-foreground mt-1">weighted avg lease term</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Users className="w-4 h-4" />
              <span className="text-xs font-medium">Annual Revenue</span>
            </div>
            <p className="text-2xl font-bold">{kpis ? fmtCurrency(kpis.totalAnnualRevenue) : "—"}</p>
            <p className="text-xs text-muted-foreground mt-1">{kpis?.tenantCount} tenants</p>
          </CardContent>
        </Card>
      </div>

      {/* Rollover Schedule */}
      {rollover && rollover.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">5-Year Rollover Schedule</CardTitle>
            <CardDescription>SF and revenue at risk by lease expiration year</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={rollover} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="year" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={v => `${v}%`} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number, name: string) => name === "pctOfTotalSF" ? [`${v}%`, "% of Total SF"] : [`${v}%`, "% of Revenue"]} />
                <Bar dataKey="pctOfTotalSF" name="% SF At Risk" fill="#6366f1" radius={[3, 3, 0, 0]}>
                  {rollover.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div className="mt-3 grid grid-cols-5 gap-2">
              {rollover.map(r => (
                <div key={r.year} className="text-center text-xs">
                  <p className="font-semibold">{r.year}</p>
                  <p className="text-muted-foreground">{r.leasesExpiring} leases</p>
                  <p className="text-orange-600">{fmtCurrency(r.annualRevenueAtRisk)}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Tenant Concentration */}
        {concentration && concentration.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Tenant Concentration (Top 10)</CardTitle>
              <CardDescription>Revenue share by tenant</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[280px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>Tenant</TableHead>
                      <TableHead className="text-right">Revenue</TableHead>
                      <TableHead className="text-right">% Share</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {concentration.map(t => (
                      <TableRow key={t.tenantName}>
                        <TableCell className="text-muted-foreground text-xs">{t.rank}</TableCell>
                        <TableCell>
                          <p className="font-medium text-sm truncate max-w-[120px]">{t.tenantName}</p>
                          <p className="text-xs text-muted-foreground">{fmtSF(t.sf)}</p>
                        </TableCell>
                        <TableCell className="text-right">{fmtCurrency(t.annualRevenue)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                              <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${Math.min(100, t.pctOfTotalRevenue)}%` }} />
                            </div>
                            <span className="text-xs">{fmt(t.pctOfTotalRevenue, 1)}%</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        )}

        {/* Rent PSF Comparison */}
        {rentPSF && rentPSF.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Rent PSF: In-Place vs Market</CardTitle>
              <CardDescription>Annual $/SF comparison by tenant</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[280px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tenant</TableHead>
                      <TableHead className="text-right">In-Place</TableHead>
                      <TableHead className="text-right">Market</TableHead>
                      <TableHead className="text-right">Variance</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rentPSF.map(r => (
                      <TableRow key={r.leaseId}>
                        <TableCell>
                          <p className="font-medium text-sm truncate max-w-[120px]">{r.tenantName}</p>
                          <p className="text-xs text-muted-foreground">{fmtSF(r.sf)}</p>
                        </TableCell>
                        <TableCell className="text-right">${fmt(r.inPlaceRentPSF)}</TableCell>
                        <TableCell className="text-right">
                          {r.marketRentPSF !== null ? `$${fmt(r.marketRentPSF)}` : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell className="text-right">
                          {r.variancePct !== null ? (
                            <span className={`flex items-center justify-end gap-1 text-xs font-medium ${r.variancePct < 0 ? "text-red-600" : "text-green-600"}`}>
                              {r.variancePct < 0 ? <ArrowDown className="w-3 h-3" /> : <ArrowUp className="w-3 h-3" />}
                              {Math.abs(r.variancePct)}%
                            </span>
                          ) : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
