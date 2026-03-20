import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { DollarSign, Percent, BedDouble, TrendingUp } from "lucide-react";

interface HotelStats {
  adr: number;
  adrChange: number;
  revpar: number;
  revparChange: number;
  occupancyPct: number;
  occupancyChange: number;
  totalRoomRevenueMtd: number;
  revenueChange: number;
  occupancyTrend: Array<{ date: string; occupancy: number }>;
  revenueByDepartment: Array<{ department: string; revenue: number }>;
}

function KpiCard({
  title,
  value,
  change,
  icon: Icon,
  format = "currency",
}: {
  title: string;
  value: number | undefined;
  change: number | undefined;
  icon: typeof DollarSign;
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

export default function HotelDashboard() {
  const { data: stats, isLoading, isError } = useQuery<HotelStats>({
    queryKey: ["/api/operations-context/hotel/stats"],
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

  const occupancyTrend = stats?.occupancyTrend || [];
  const revenueByDepartment = stats?.revenueByDepartment || [];
  const hasData = !isError && stats;

  return (
    <div className="p-6 space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Average Daily Rate (ADR)"
          value={stats?.adr}
          change={stats?.adrChange}
          icon={DollarSign}
          format="currency"
        />
        <KpiCard
          title="RevPAR"
          value={stats?.revpar}
          change={stats?.revparChange}
          icon={TrendingUp}
          format="currency"
        />
        <KpiCard
          title="Occupancy Rate"
          value={stats?.occupancyPct}
          change={stats?.occupancyChange}
          icon={Percent}
          format="percent"
        />
        <KpiCard
          title="Room Revenue MTD"
          value={stats?.totalRoomRevenueMtd}
          change={stats?.revenueChange}
          icon={BedDouble}
          format="currency"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Occupancy Trend</CardTitle>
            <CardDescription>Daily occupancy rate over time</CardDescription>
          </CardHeader>
          <CardContent>
            {!hasData || occupancyTrend.length === 0 ? (
              <div className="flex items-center justify-center h-64 text-muted-foreground">
                No occupancy data yet. Connect your PMS to see trends.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={occupancyTrend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} tickFormatter={(v) => `${v}%`} />
                  <Tooltip formatter={(value: number) => [`${value.toFixed(1)}%`, "Occupancy"]} />
                  <Area
                    type="monotone"
                    dataKey="occupancy"
                    stroke="hsl(var(--primary))"
                    fill="hsl(var(--primary))"
                    fillOpacity={0.2}
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Revenue by Department</CardTitle>
            <CardDescription>Monthly revenue breakdown</CardDescription>
          </CardHeader>
          <CardContent>
            {!hasData || revenueByDepartment.length === 0 ? (
              <div className="flex items-center justify-center h-64 text-muted-foreground">
                No revenue data yet. Data will appear once transactions are recorded.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={revenueByDepartment}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="department" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(value: number) => [`$${value.toLocaleString()}`, "Revenue"]} />
                  <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
