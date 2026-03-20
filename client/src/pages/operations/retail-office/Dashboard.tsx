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
import { Building2, Percent, DollarSign, Calendar } from "lucide-react";

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

export default function RetailOfficeDashboard() {
  const { data: stats, isLoading, isError } = useQuery<RetailOfficeStats>({
    queryKey: ["/api/operations-context/retail-office/stats"],
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
    </div>
  );
}
