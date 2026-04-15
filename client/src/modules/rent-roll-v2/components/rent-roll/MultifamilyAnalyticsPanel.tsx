import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Home, RefreshCw, TrendingDown, Calendar } from "lucide-react";
import { format } from "date-fns";

interface ConcessionAnalysis {
  totalConcessions: number;
  concessionsPctOfGPR: number;
  avgConcessionPerLease: number;
  avgFreeRentWeeks: number;
  concessionedLeaseCount: number;
  totalLeaseCount: number;
  monthlyTrend: { month: string; totalConcessions: number; leasesWithConcessions: number }[];
}

interface RenewalDue {
  leaseId: string;
  tenantName: string;
  unitNumber: string;
  unitType: string;
  expirationDate: string;
  daysToExpiry: number;
  currentRent: number;
  proposedRenewalAmount: number;
}

interface RenewalSpreadAnalysis {
  avgRentIncreaseAtRenewal: number;
  avgSpreadPct: number;
  renewalAcceptanceRate: number;
  leasesUpForRenewal90Days: RenewalDue[];
  totalLeasesUpForRenewal: number;
}

interface MultifamilyAnalyticsPanelProps {
  locationId?: string | null;
}

export default function MultifamilyAnalyticsPanel({ locationId }: MultifamilyAnalyticsPanelProps) {
  const { data: concession, isLoading: concessionLoading } = useQuery<ConcessionAnalysis>({
    queryKey: ['/api/rent-roll/analytics/multifamily/concessions', locationId],
    queryFn: async () => {
      const res = await fetch(`/api/rent-roll/analytics/multifamily/concessions?locationId=${locationId}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load concession data');
      return res.json();
    },
    enabled: !!locationId,
  });

  const { data: renewals, isLoading: renewalLoading } = useQuery<RenewalSpreadAnalysis>({
    queryKey: ['/api/rent-roll/analytics/multifamily/renewal-spread', locationId],
    queryFn: async () => {
      const res = await fetch(`/api/rent-roll/analytics/multifamily/renewal-spread?locationId=${locationId}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load renewal data');
      return res.json();
    },
    enabled: !!locationId,
  });

  if (!locationId) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Home className="w-10 h-10 mx-auto mb-3 opacity-30" />
        <p className="text-sm">Select a project to view multifamily analytics</p>
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      {/* Concession KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <TrendingDown className="w-3 h-3" /> Total Concessions
            </CardTitle>
          </CardHeader>
          <CardContent>
            {concessionLoading ? <Skeleton className="h-7 w-20" /> : (
              <p className="text-xl font-bold">${(concession?.totalConcessions || 0).toLocaleString()}</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">% of GPR</CardTitle>
          </CardHeader>
          <CardContent>
            {concessionLoading ? <Skeleton className="h-7 w-16" /> : (
              <p className="text-xl font-bold">{(concession?.concessionsPctOfGPR || 0).toFixed(1)}%</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Avg Concession/Lease</CardTitle>
          </CardHeader>
          <CardContent>
            {concessionLoading ? <Skeleton className="h-7 w-20" /> : (
              <p className="text-xl font-bold">${(concession?.avgConcessionPerLease || 0).toFixed(2)}</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Avg Free Rent</CardTitle>
          </CardHeader>
          <CardContent>
            {concessionLoading ? <Skeleton className="h-7 w-20" /> : (
              <p className="text-xl font-bold">{(concession?.avgFreeRentWeeks || 0).toFixed(1)} wks</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Concession Monthly Trend */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingDown className="w-4 h-4" />
            Concession Trend (Last 6 Months)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {concessionLoading ? (
            <div className="space-y-2">{[...Array(6)].map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
          ) : !concession?.monthlyTrend || concession.monthlyTrend.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No concession trend data available</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm" data-testid="table-concession-trend">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="text-left py-2 font-medium">Month</th>
                    <th className="text-right py-2 font-medium">Total Concessions</th>
                    <th className="text-right py-2 font-medium">Leases with Concession</th>
                  </tr>
                </thead>
                <tbody>
                  {concession.monthlyTrend.map((row) => (
                    <tr key={row.month} className="border-b hover:bg-muted/30">
                      <td className="py-2 font-medium">{row.month}</td>
                      <td className="py-2 text-right tabular-nums">${row.totalConcessions.toFixed(2)}</td>
                      <td className="py-2 text-right tabular-nums">{row.leasesWithConcessions}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Renewal Spread */}
      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <RefreshCw className="w-4 h-4" />
              Renewal Analytics
            </CardTitle>
          </CardHeader>
          <CardContent>
            {renewalLoading ? <Skeleton className="h-16 w-full" /> : (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div>
                    <p className="text-lg font-semibold">{renewals?.totalLeasesUpForRenewal || 0}</p>
                    <p className="text-xs text-muted-foreground">Up for Renewal</p>
                  </div>
                  <div>
                    <p className="text-lg font-semibold">{(renewals?.renewalAcceptanceRate || 0).toFixed(1)}%</p>
                    <p className="text-xs text-muted-foreground">Acceptance Rate</p>
                  </div>
                  <div>
                    <p className="text-lg font-semibold">
                      {(renewals?.avgSpreadPct || 0) >= 0 ? "+" : ""}{(renewals?.avgSpreadPct || 0).toFixed(1)}%
                    </p>
                    <p className="text-xs text-muted-foreground">Avg Rent Spread</p>
                  </div>
                </div>
                <div className="pt-2 border-t text-sm">
                  <span className="text-muted-foreground">Avg increase at renewal: </span>
                  <span className="font-semibold">${(renewals?.avgRentIncreaseAtRenewal || 0).toFixed(2)}/mo</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Upcoming Expirations (90 Days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {renewalLoading ? (
              <div className="space-y-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
            ) : !renewals?.leasesUpForRenewal90Days || renewals.leasesUpForRenewal90Days.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No upcoming expirations</p>
            ) : (
              <div className="space-y-2" data-testid="upcoming-expirations">
                {renewals.leasesUpForRenewal90Days.slice(0, 6).map((lease) => (
                  <div key={lease.leaseId} className="flex items-center justify-between text-sm border-b pb-2 last:border-0">
                    <div>
                      <p className="font-medium">{lease.tenantName}</p>
                      <p className="text-xs text-muted-foreground">
                        {lease.unitType} · Expires {lease.expirationDate ? format(new Date(lease.expirationDate), 'MMM d, yyyy') : 'N/A'}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="tabular-nums">${(lease.currentRent || 0).toLocaleString()}/mo</p>
                      <Badge
                        variant={lease.daysToExpiry <= 30 ? "destructive" : "secondary"}
                        className="text-xs"
                      >
                        {lease.daysToExpiry}d
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
