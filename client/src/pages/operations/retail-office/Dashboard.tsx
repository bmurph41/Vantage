import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart,
  Bar,
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
import { Building2, Percent, DollarSign, Calendar, AlertCircle } from "lucide-react";

interface RetailOfficeStats {
  occupiedSF: number;
  vacantSF: number;
  occupancyPct: number;
  occupancyChange: number;
  weightedAvgLeaseTerm: number;
  noiPerSF: number;
  noiChange: number;
  tenantDiversification: Array<{ tenant: string; revenuePct: number }>;
  leaseRollover: Array<{ year: string; sf: number }>;
}

interface CommercialLease {
  id: string;
  tenant: string;
  suite: string;
  sf: number;
  leaseStart: string;
  leaseEnd: string;
  baseRent: number;
  cam: number;
  totalRent: number;
  status: string;
}

const PIE_COLORS = [
  "hsl(var(--primary))",
  "#f59e0b",
  "#10b981",
  "#ef4444",
  "#8b5cf6",
  "#06b6d4",
  "#f97316",
  "#6b7280",
];

function KpiCard({
  title,
  value,
  change,
  icon: Icon,
  format = "number",
}: {
  title: string;
  value: number | undefined;
  change?: number;
  icon: typeof Building2;
  format?: "currency" | "percent" | "number" | "sf" | "years";
}) {
  const formatValue = (val: number | undefined) => {
    if (val === undefined || val === null) return "--";
    if (format === "currency") return `$${val.toFixed(2)}`;
    if (format === "percent") return `${val.toFixed(1)}%`;
    if (format === "sf") return `${val.toLocaleString()} SF`;
    if (format === "years") return `${val.toFixed(1)} yrs`;
    return val.toLocaleString();
  };

  const changeColor = (change || 0) >= 0 ? "text-green-600" : "text-red-600";
  const changeSign = (change || 0) >= 0 ? "+" : "";

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold mt-1">{formatValue(value)}</p>
            {change !== undefined && (
              <p className={`text-xs mt-1 ${changeColor}`}>
                {changeSign}{change.toFixed(1)}% vs prior period
              </p>
            )}
          </div>
          <div className="p-3 rounded-full bg-primary/10">
            <Icon className="h-5 w-5 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function leaseStatusCls(status: string) {
  const map: Record<string, string> = {
    active: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    expiring: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
    expired: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
    terminated: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
  };
  return map[status] ?? "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200";
}

export default function RetailOfficeDashboard() {
  const { data: stats, isLoading, isError } = useQuery<RetailOfficeStats>({
    queryKey: ["/api/retail-office-ops/stats"],
    retry: false,
  });

  const { data: leases = [], isLoading: leasesLoading } = useQuery<CommercialLease[]>({
    queryKey: ["/api/retail-office-ops/tenants"],
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-80" />
          <Skeleton className="h-80" />
        </div>
      </div>
    );
  }

  const tenantDiversification = stats?.tenantDiversification || [];
  const leaseRollover = stats?.leaseRollover || [];
  const hasData = !isError && stats;

  const now = new Date();
  const in180Days = new Date(now.getTime() + 180 * 86400000).toISOString().split("T")[0];
  const todayStr = now.toISOString().split("T")[0];

  const activeLeases = leases.filter(l => l.status === "active" || l.status === "expiring");
  const upcomingRenewals = leases
    .filter(l => (l.status === "active" || l.status === "expiring") && l.leaseEnd && l.leaseEnd >= todayStr && l.leaseEnd <= in180Days)
    .sort((a, b) => (a.leaseEnd > b.leaseEnd ? 1 : -1));

  const totalCAM = activeLeases.reduce((sum, l) => sum + l.cam, 0);
  const totalBaseRent = activeLeases.reduce((sum, l) => sum + l.baseRent, 0);

  return (
    <div className="p-6 space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <KpiCard title="Occupied SF" value={stats?.occupiedSF} icon={Building2} format="sf" />
        <KpiCard title="Vacant SF" value={stats?.vacantSF} icon={Building2} format="sf" />
        <KpiCard
          title="Occupancy Rate"
          value={stats?.occupancyPct}
          change={stats?.occupancyChange}
          icon={Percent}
          format="percent"
        />
        <KpiCard
          title="WALT"
          value={stats?.weightedAvgLeaseTerm}
          icon={Calendar}
          format="years"
        />
        <KpiCard
          title="NOI / SF"
          value={stats?.noiPerSF}
          change={stats?.noiChange}
          icon={DollarSign}
          format="currency"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm font-medium text-muted-foreground">Total Monthly Base Rent</p>
            <p className="text-2xl font-bold mt-1">
              ${totalBaseRent.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </p>
            <p className="text-xs text-muted-foreground mt-1">{activeLeases.length} active leases</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm font-medium text-muted-foreground">Total Monthly CAM</p>
            <p className="text-2xl font-bold mt-1">
              ${totalCAM.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Common area maintenance charges</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-orange-500" />
              <p className="text-sm font-medium text-muted-foreground">Renewals Next 180 Days</p>
            </div>
            <p className="text-2xl font-bold mt-1">{upcomingRenewals.length}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {upcomingRenewals.reduce((sum, l) => sum + l.sf, 0).toLocaleString()} SF rolling
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Tenant Diversification</CardTitle>
            <CardDescription>Top tenants by revenue share</CardDescription>
          </CardHeader>
          <CardContent>
            {!hasData || tenantDiversification.length === 0 ? (
              <div className="flex items-center justify-center h-64 text-muted-foreground">
                No tenant data yet. Add tenants to see the diversification chart.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={tenantDiversification}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    dataKey="revenuePct"
                    nameKey="tenant"
                    label={({ tenant, revenuePct }) => `${tenant}: ${revenuePct.toFixed(1)}%`}
                  >
                    {tenantDiversification.map((_, index) => (
                      <Cell key={index} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => [`${value.toFixed(1)}%`, "Revenue %"]} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Lease Rollover Schedule</CardTitle>
            <CardDescription>Square footage rolling by year</CardDescription>
          </CardHeader>
          <CardContent>
            {!hasData || leaseRollover.length === 0 ? (
              <div className="flex items-center justify-center h-64 text-muted-foreground">
                No lease data yet. Data will populate as leases are added.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={leaseRollover}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="year" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(value: number) => [`${value.toLocaleString()} SF`, "Rolling SF"]} />
                  <Bar dataKey="sf" name="Square Feet" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Suite Occupancy</CardTitle>
          <CardDescription>All tenant suites with lease details</CardDescription>
        </CardHeader>
        <CardContent>
          {leasesLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10" />)}
            </div>
          ) : leases.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-muted-foreground">
              No leases yet. Add commercial tenants to track suite occupancy.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="text-left py-2 pr-4 font-medium">Tenant</th>
                    <th className="text-left py-2 pr-4 font-medium">Suite</th>
                    <th className="text-left py-2 pr-4 font-medium">SF</th>
                    <th className="text-left py-2 pr-4 font-medium">Base Rent/Mo</th>
                    <th className="text-left py-2 pr-4 font-medium">CAM/Mo</th>
                    <th className="text-left py-2 pr-4 font-medium">Lease End</th>
                    <th className="text-left py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {leases.map((lease) => (
                    <tr key={lease.id} className="border-b last:border-0 hover:bg-muted/50">
                      <td className="py-2 pr-4 font-medium">{lease.tenant}</td>
                      <td className="py-2 pr-4">{lease.suite || "—"}</td>
                      <td className="py-2 pr-4">{lease.sf ? lease.sf.toLocaleString() : "—"}</td>
                      <td className="py-2 pr-4">${lease.baseRent.toFixed(0)}</td>
                      <td className="py-2 pr-4">
                        {lease.cam ? `$${lease.cam.toFixed(0)}` : "—"}
                      </td>
                      <td className={`py-2 pr-4 ${lease.leaseEnd && lease.leaseEnd <= in180Days && (lease.status === "active" || lease.status === "expiring") ? "text-orange-600 font-medium" : ""}`}>
                        {lease.leaseEnd || "—"}
                      </td>
                      <td className="py-2">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${leaseStatusCls(lease.status)}`}>
                          {lease.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {upcomingRenewals.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-orange-500" />
              <CardTitle>Upcoming Renewals</CardTitle>
            </div>
            <CardDescription>Leases expiring within the next 180 days requiring renewal decisions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="text-left py-2 pr-4 font-medium">Tenant</th>
                    <th className="text-left py-2 pr-4 font-medium">Suite</th>
                    <th className="text-left py-2 pr-4 font-medium">SF</th>
                    <th className="text-left py-2 pr-4 font-medium">Monthly Rent</th>
                    <th className="text-left py-2 font-medium">Expiration</th>
                  </tr>
                </thead>
                <tbody>
                  {upcomingRenewals.map((lease) => (
                    <tr key={lease.id} className="border-b last:border-0 bg-orange-50 dark:bg-orange-950/30 hover:bg-orange-100 dark:hover:bg-orange-950/50">
                      <td className="py-2 pr-4 font-medium">{lease.tenant}</td>
                      <td className="py-2 pr-4">{lease.suite || "—"}</td>
                      <td className="py-2 pr-4">{lease.sf ? lease.sf.toLocaleString() : "—"}</td>
                      <td className="py-2 pr-4">${lease.baseRent.toFixed(0)}</td>
                      <td className="py-2 text-orange-600 font-medium">{lease.leaseEnd}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
