import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Warehouse, Percent, DollarSign, Box } from "lucide-react";

interface SelfStorageStats {
  totalUnits: number;
  occupancyPct: number;
  occupancyChange: number;
  revenuePerSF: number;
  revenuePerSFChange: number;
  averageUnitRate: number;
  rateChange: number;
  unitSizeMix: Array<{ size: string; count: number }>;
  moveInOutTrend: Array<{ month: string; moveIns: number; moveOuts: number }>;
}

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
  icon: typeof Warehouse;
  format?: "currency" | "percent" | "number";
}) {
  const formatValue = (val: number | undefined) => {
    if (val === undefined || val === null) return "--";
    if (format === "currency") return `$${val.toFixed(2)}`;
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

export default function SelfStorageDashboard() {
  const { data: stats, isLoading, isError } = useQuery<SelfStorageStats>({
    queryKey: ["/api/self-storage-ops/stats"],
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

  const unitSizeMix = stats?.unitSizeMix || [];
  const moveInOutTrend = stats?.moveInOutTrend || [];
  const hasData = !isError && stats;

  return (
    <div className="p-6 space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard title="Total Units" value={stats?.totalUnits} icon={Box} format="number" />
        <KpiCard
          title="Occupancy Rate"
          value={stats?.occupancyPct}
          change={stats?.occupancyChange}
          icon={Percent}
          format="percent"
        />
        <KpiCard
          title="Revenue / SF"
          value={stats?.revenuePerSF}
          change={stats?.revenuePerSFChange}
          icon={DollarSign}
          format="currency"
        />
        <KpiCard
          title="Avg Unit Rate"
          value={stats?.averageUnitRate}
          change={stats?.rateChange}
          icon={Warehouse}
          format="currency"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Unit Size Mix</CardTitle>
            <CardDescription>Distribution of units by size category</CardDescription>
          </CardHeader>
          <CardContent>
            {!hasData || unitSizeMix.length === 0 ? (
              <div className="flex items-center justify-center h-64 text-muted-foreground">
                No unit data yet. Add units to see the size distribution.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={unitSizeMix}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="size" tick={{ fontSize: 12 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="count" name="Units" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Move-in / Move-out Trend</CardTitle>
            <CardDescription>Monthly move activity</CardDescription>
          </CardHeader>
          <CardContent>
            {!hasData || moveInOutTrend.length === 0 ? (
              <div className="flex items-center justify-center h-64 text-muted-foreground">
                No move activity data yet. Data will appear as tenants move in and out.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={moveInOutTrend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="moveIns" name="Move-ins" stroke="hsl(var(--primary))" strokeWidth={2} />
                  <Line type="monotone" dataKey="moveOuts" name="Move-outs" stroke="#ef4444" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
