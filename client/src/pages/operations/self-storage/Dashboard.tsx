import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Warehouse, Percent, DollarSign, Box, AlertTriangle } from "lucide-react";

interface OccupancyGridEntry {
  size: string;
  occupied: number;
  available: number;
  delinquent: number;
  reserved: number;
  maintenance: number;
  total: number;
}

interface SelfStorageStats {
  totalUnits: number;
  occupancyPct: number;
  occupancyChange: number;
  totalMonthlyRevenue: number;
  revenuePerSF: number;
  revenuePerSFChange: number;
  averageUnitRate: number;
  rateChange: number;
  unitSizeMix: Array<{ size: string; count: number }>;
  unitOccupancyGrid: OccupancyGridEntry[];
  moveInOutTrend: Array<{ month: string; moveIns: number; moveOuts: number }>;
}

interface StorageUnit {
  id: string;
  unitNumber: string;
  size: string;
  unitType: string;
  status: string;
  monthlyRate: string | null;
  tenantName: string | null;
  moveInDate: string | null;
  moveOutDate: string | null;
  autopayEnabled: boolean;
  insuranceActive: boolean;
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

function unitStatusCls(status: string) {
  const map: Record<string, string> = {
    occupied: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    available: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    delinquent: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
    reserved: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
    maintenance: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
  };
  return map[status] ?? "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200";
}

export default function SelfStorageDashboard() {
  const { data: stats, isLoading, isError } = useQuery<SelfStorageStats>({
    queryKey: ["/api/self-storage-ops/stats"],
    retry: false,
  });

  const { data: units = [], isLoading: unitsLoading } = useQuery<StorageUnit[]>({
    queryKey: ["/api/self-storage-ops/units"],
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

  const occupancyGrid = stats?.unitOccupancyGrid || [];
  const moveInOutTrend = stats?.moveInOutTrend || [];
  const hasData = !isError && stats;

  const delinquentUnits = units.filter(u => u.status === "delinquent");

  // This month's move-ins
  const now = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
  const thisMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];
  const thisMonthMoveIns = units
    .filter(u => u.moveInDate && u.moveInDate >= thisMonthStart && u.moveInDate <= thisMonthEnd)
    .sort((a, b) => (b.moveInDate! > a.moveInDate! ? 1 : -1));

  const thisMonthMoveOuts = units
    .filter(u => u.moveOutDate && u.moveOutDate >= thisMonthStart && u.moveOutDate <= thisMonthEnd)
    .sort((a, b) => (b.moveOutDate! > a.moveOutDate! ? 1 : -1));

  const monthLabel = now.toLocaleString("default", { month: "long", year: "numeric" });

  return (
    <div className="p-6 space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
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
        <KpiCard
          title="Monthly Revenue"
          value={stats?.totalMonthlyRevenue}
          icon={DollarSign}
          format="currency"
        />
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Delinquent Units</p>
                <p className="text-2xl font-bold mt-1">{delinquentUnits.length}</p>
                {delinquentUnits.length > 0 && (
                  <p className="text-xs mt-1 text-red-600">Requires follow-up</p>
                )}
              </div>
              <div className="p-3 rounded-full bg-red-100 dark:bg-red-900">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Unit Occupancy Grid</CardTitle>
          <CardDescription>Occupied vs. available by unit size</CardDescription>
        </CardHeader>
        <CardContent>
          {!hasData || occupancyGrid.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-muted-foreground">
              No unit data yet. Add units to see the occupancy grid.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="text-left py-2 pr-4 font-medium">Size</th>
                    <th className="text-center py-2 pr-4 font-medium text-blue-600">Occupied</th>
                    <th className="text-center py-2 pr-4 font-medium text-green-600">Available</th>
                    <th className="text-center py-2 pr-4 font-medium text-red-600">Delinquent</th>
                    <th className="text-center py-2 pr-4 font-medium text-yellow-600">Reserved</th>
                    <th className="text-center py-2 pr-4 font-medium">Total</th>
                    <th className="text-center py-2 font-medium">Occ %</th>
                  </tr>
                </thead>
                <tbody>
                  {occupancyGrid.map((row) => {
                    const occPct = row.total > 0 ? Math.round(((row.occupied + row.delinquent) / row.total) * 100) : 0;
                    return (
                      <tr key={row.size} className="border-b last:border-0 hover:bg-muted/50">
                        <td className="py-2 pr-4 font-medium">{row.size}</td>
                        <td className="py-2 pr-4 text-center font-semibold text-blue-600">{row.occupied}</td>
                        <td className="py-2 pr-4 text-center font-semibold text-green-600">{row.available}</td>
                        <td className="py-2 pr-4 text-center font-semibold text-red-600">{row.delinquent}</td>
                        <td className="py-2 pr-4 text-center font-semibold text-yellow-600">{row.reserved}</td>
                        <td className="py-2 pr-4 text-center">{row.total}</td>
                        <td className="py-2 text-center">
                          <span className={`font-medium ${occPct >= 90 ? "text-green-600" : occPct >= 70 ? "text-yellow-600" : "text-red-600"}`}>
                            {occPct}%
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Move-in / Move-out Trend</CardTitle>
            <CardDescription>Monthly move activity (last 6 months)</CardDescription>
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

        <Card>
          <CardHeader>
            <CardTitle>Move-in / Move-out Log — {monthLabel}</CardTitle>
            <CardDescription>Tenant activity recorded this month</CardDescription>
          </CardHeader>
          <CardContent>
            {unitsLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10" />)}
              </div>
            ) : thisMonthMoveIns.length === 0 && thisMonthMoveOuts.length === 0 ? (
              <div className="flex items-center justify-center h-48 text-muted-foreground">
                No move activity recorded for {monthLabel}.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-muted-foreground">
                      <th className="text-left py-2 pr-4 font-medium">Unit</th>
                      <th className="text-left py-2 pr-4 font-medium">Size</th>
                      <th className="text-left py-2 pr-4 font-medium">Tenant</th>
                      <th className="text-left py-2 pr-4 font-medium">Type</th>
                      <th className="text-left py-2 pr-4 font-medium">Date</th>
                      <th className="text-left py-2 font-medium">Rate/Mo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ...thisMonthMoveIns.map(u => ({ ...u, _type: "in" as const, _date: u.moveInDate! })),
                      ...thisMonthMoveOuts.map(u => ({ ...u, _type: "out" as const, _date: u.moveOutDate! })),
                    ]
                      .sort((a, b) => (b._date > a._date ? 1 : -1))
                      .map((unit) => (
                        <tr key={`${unit.id}-${unit._type}`} className="border-b last:border-0 hover:bg-muted/50">
                          <td className="py-2 pr-4 font-medium">{unit.unitNumber}</td>
                          <td className="py-2 pr-4">{unit.size}</td>
                          <td className="py-2 pr-4">{unit.tenantName || "—"}</td>
                          <td className="py-2 pr-4">
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded ${unit._type === "in" ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" : "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"}`}>
                              {unit._type === "in" ? "Move-in" : "Move-out"}
                            </span>
                          </td>
                          <td className="py-2 pr-4">{unit._date || "—"}</td>
                          <td className="py-2">
                            {unit.monthlyRate ? `$${parseFloat(unit.monthlyRate).toFixed(0)}` : "—"}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {delinquentUnits.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <CardTitle>Delinquent Units</CardTitle>
            </div>
            <CardDescription>Units with delinquent status requiring follow-up</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="text-left py-2 pr-4 font-medium">Unit</th>
                    <th className="text-left py-2 pr-4 font-medium">Size</th>
                    <th className="text-left py-2 pr-4 font-medium">Tenant</th>
                    <th className="text-left py-2 pr-4 font-medium">Move-in Date</th>
                    <th className="text-left py-2 font-medium">Monthly Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {delinquentUnits.map((unit) => (
                    <tr key={unit.id} className="border-b last:border-0 bg-red-50 dark:bg-red-950/30">
                      <td className="py-2 pr-4 font-medium">{unit.unitNumber}</td>
                      <td className="py-2 pr-4">{unit.size}</td>
                      <td className="py-2 pr-4">{unit.tenantName || "—"}</td>
                      <td className="py-2 pr-4">{unit.moveInDate || "—"}</td>
                      <td className="py-2">
                        {unit.monthlyRate ? `$${parseFloat(unit.monthlyRate).toFixed(0)}` : "—"}
                      </td>
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
