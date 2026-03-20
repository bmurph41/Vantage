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
import { Building2, Percent, DollarSign, AlertTriangle } from "lucide-react";

interface MultifamilyStats {
  totalUnits: number;
  occupancyPct: number;
  occupancyChange: number;
  averageRent: number;
  rentChange: number;
  delinquencyRate: number;
  delinquencyChange: number;
  leaseExpiryWall: Array<{ month: string; count: number }>;
  unitStatusBreakdown: Array<{ status: string; count: number }>;
}

const STATUS_COLORS: Record<string, string> = {
  occupied: "hsl(var(--primary))",
  vacant: "#ef4444",
  "on notice": "#f59e0b",
  "down for turn": "#6b7280",
};

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
  format?: "currency" | "percent" | "number";
}) {
  const formatValue = (val: number | undefined) => {
    if (val === undefined || val === null) return "--";
    if (format === "currency") return `$${val.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    if (format === "percent") return `${val.toFixed(1)}%`;
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

export default function MultifamilyDashboard() {
  const { data: stats, isLoading, isError } = useQuery<MultifamilyStats>({
    queryKey: ["/api/multifamily-ops/stats"],
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
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

  const leaseExpiryWall = stats?.leaseExpiryWall || [];
  const unitStatusBreakdown = stats?.unitStatusBreakdown || [];
  const hasData = !isError && stats;

  return (
    <div className="p-6 space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard title="Total Units" value={stats?.totalUnits} icon={Building2} format="number" />
        <KpiCard
          title="Occupancy Rate"
          value={stats?.occupancyPct}
          change={stats?.occupancyChange}
          icon={Percent}
          format="percent"
        />
        <KpiCard
          title="Average Rent"
          value={stats?.averageRent}
          change={stats?.rentChange}
          icon={DollarSign}
          format="currency"
        />
        <KpiCard
          title="Delinquency Rate"
          value={stats?.delinquencyRate}
          change={stats?.delinquencyChange}
          icon={AlertTriangle}
          format="percent"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Lease Expiry Wall</CardTitle>
            <CardDescription>Leases expiring by month (next 12 months)</CardDescription>
          </CardHeader>
          <CardContent>
            {!hasData || leaseExpiryWall.length === 0 ? (
              <div className="flex items-center justify-center h-64 text-muted-foreground">
                No lease expiry data yet. Add units and leases to see the expiry wall.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={leaseExpiryWall}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="count" name="Leases Expiring" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Unit Status Breakdown</CardTitle>
            <CardDescription>Current unit status distribution</CardDescription>
          </CardHeader>
          <CardContent>
            {!hasData || unitStatusBreakdown.length === 0 ? (
              <div className="flex items-center justify-center h-64 text-muted-foreground">
                No unit data yet. Add units to see the status breakdown.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={unitStatusBreakdown}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    dataKey="count"
                    nameKey="status"
                    label={({ status, count }) => `${status}: ${count}`}
                  >
                    {unitStatusBreakdown.map((entry, index) => (
                      <Cell key={index} fill={STATUS_COLORS[entry.status.toLowerCase()] || "#94a3b8"} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
