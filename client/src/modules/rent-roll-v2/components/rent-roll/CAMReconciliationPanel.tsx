/**
 * CAM Reconciliation Panel
 *
 * Displays CAM/NNN reconciliation data for retail tenants:
 * - Pro-rata shares, estimated CAM per SF
 * - Tax and insurance recovery
 * - Admin fee percentages
 * - CAM caps and base year overrides
 */

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertCircle, Building2, DollarSign, Percent } from "lucide-react";

interface CAMItem {
  tenantId: string;
  tenantName: string;
  suiteNumber: string;
  squareFootage: number;
  proRataShare: number;
  estimatedCAMPerSF: number;
  estimatedTaxPerSF: number;
  estimatedInsPerSF: number;
  totalEstimatedNNN: number;
  camCapPercent: number | null;
  baseYearExpenses: number | null;
  adminFeePercent: number;
  excludedItems: string[];
}

interface CAMReconciliationPanelProps {
  orgId: string;
  modelingProjectId?: string;
  marinaId?: string;
}

const fmt = (n: number, decimals = 2) =>
  new Intl.NumberFormat("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(n);

const fmtCurrency = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);

export default function CAMReconciliationPanel({ orgId, modelingProjectId, marinaId }: CAMReconciliationPanelProps) {
  const params = new URLSearchParams();
  if (modelingProjectId) params.set("modelingProjectId", modelingProjectId);
  if (marinaId) params.set("marinaId", marinaId);

  const { data: camData, isLoading, isError } = useQuery<CAMItem[]>({
    queryKey: ["/api/rent-roll/analytics/retail/cam", orgId, modelingProjectId, marinaId],
    queryFn: async () => {
      const res = await fetch(`/api/rent-roll/analytics/retail/cam?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch CAM data");
      return res.json();
    },
  });

  const { data: waltData } = useQuery<{ walt: number; totalActiveTenants: number; avgRemainingTerm: number }>({
    queryKey: ["/api/rent-roll/analytics/retail/walt", orgId, modelingProjectId, marinaId],
    queryFn: async () => {
      const res = await fetch(`/api/rent-roll/analytics/retail/walt?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch WALT");
      return res.json();
    },
  });

  const { data: rolloverData } = useQuery<{ year: number; leasesExpiring: number; sfAtRisk: number; annualBaseRentAtRisk: number }[]>({
    queryKey: ["/api/rent-roll/analytics/retail/rollover-schedule", orgId, modelingProjectId, marinaId],
    queryFn: async () => {
      const res = await fetch(`/api/rent-roll/analytics/retail/rollover-schedule?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch rollover");
      return res.json();
    },
  });

  const totalNNN = camData?.reduce((s, t) => s + t.totalEstimatedNNN, 0) || 0;
  const totalSF = camData?.reduce((s, t) => s + t.squareFootage, 0) || 0;
  const avgCAMPSF = totalSF > 0 ? totalNNN / totalSF : 0;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-72" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-48 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex gap-2 text-destructive">
            <AlertCircle className="w-5 h-5" />
            Failed to Load CAM Data
          </CardTitle>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <DollarSign className="w-4 h-4" />
              <span className="text-xs font-medium">Total NNN / Year</span>
            </div>
            <p className="text-xl font-bold">{fmtCurrency(totalNNN)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Building2 className="w-4 h-4" />
              <span className="text-xs font-medium">Avg CAM / SF</span>
            </div>
            <p className="text-xl font-bold">${fmt(avgCAMPSF)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Percent className="w-4 h-4" />
              <span className="text-xs font-medium">WALT</span>
            </div>
            <p className="text-xl font-bold">{waltData ? fmt(waltData.walt, 1) : "—"} yrs</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Building2 className="w-4 h-4" />
              <span className="text-xs font-medium">Active Tenants</span>
            </div>
            <p className="text-xl font-bold">{camData?.length ?? 0}</p>
          </CardContent>
        </Card>
      </div>

      {/* Rollover Schedule */}
      {rolloverData && rolloverData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Lease Rollover Schedule (5-Year)</CardTitle>
            <CardDescription>Leases expiring and square footage at risk by year</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2 overflow-x-auto pb-2">
              {rolloverData.map(r => (
                <div key={r.year} className="min-w-[100px] text-center p-3 rounded-lg border bg-muted/30">
                  <p className="text-xs text-muted-foreground font-medium">{r.year}</p>
                  <p className="text-lg font-bold">{r.leasesExpiring}</p>
                  <p className="text-xs text-muted-foreground">leases</p>
                  <p className="text-xs font-medium text-orange-600 mt-1">
                    {fmtCurrency(r.annualBaseRentAtRisk)} at risk
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* CAM Detail Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">CAM / NNN Reconciliation Detail</CardTitle>
          <CardDescription>Estimated operating expense recoveries by tenant</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {!camData || camData.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Building2 className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No active retail tenants found</p>
            </div>
          ) : (
            <ScrollArea className="h-[400px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tenant</TableHead>
                    <TableHead>Suite</TableHead>
                    <TableHead className="text-right">SF</TableHead>
                    <TableHead className="text-right">Pro-Rata %</TableHead>
                    <TableHead className="text-right">CAM/SF</TableHead>
                    <TableHead className="text-right">Tax/SF</TableHead>
                    <TableHead className="text-right">Ins/SF</TableHead>
                    <TableHead className="text-right">Total NNN</TableHead>
                    <TableHead>CAP</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {camData.map(t => (
                    <TableRow key={t.tenantId}>
                      <TableCell className="font-medium max-w-[120px] truncate">{t.tenantName}</TableCell>
                      <TableCell className="text-muted-foreground">{t.suiteNumber || "—"}</TableCell>
                      <TableCell className="text-right">{t.squareFootage.toLocaleString()}</TableCell>
                      <TableCell className="text-right">{fmt(t.proRataShare * 100, 1)}%</TableCell>
                      <TableCell className="text-right">${fmt(t.estimatedCAMPerSF)}</TableCell>
                      <TableCell className="text-right">${fmt(t.estimatedTaxPerSF)}</TableCell>
                      <TableCell className="text-right">${fmt(t.estimatedInsPerSF)}</TableCell>
                      <TableCell className="text-right font-medium">{fmtCurrency(t.totalEstimatedNNN)}</TableCell>
                      <TableCell>
                        {t.camCapPercent !== null ? (
                          <Badge variant="outline" className="text-xs">{fmt(t.camCapPercent, 1)}% cap</Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">None</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
