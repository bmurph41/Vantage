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
import { Building2, Percent, DollarSign, AlertTriangle, Wrench } from "lucide-react";

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

interface MultifamilyUnit {
  id: string;
  unitNumber: string;
  unitType: string;
  sqft: number | null;
  bedrooms: number | null;
  status: string;
  currentRent: string | null;
  marketRent: string | null;
  tenantName: string | null;
  leaseStart: string | null;
  leaseEnd: string | null;
}

interface MultifamilyTurn {
  id: string;
  unitNumber: string;
  moveOutDate: string;
  targetMoveIn: string | null;
  scope: string;
  status: string;
  estimatedCost: string | null;
}

const STATUS_COLORS: Record<string, string> = {
  occupied: "hsl(var(--primary))",
  vacant: "#ef4444",
  "on notice": "#f59e0b",
  "down for turn": "#6b7280",
  delinquent: "#dc2626",
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

function unitStatusCls(status: string) {
  const map: Record<string, string> = {
    occupied: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    vacant: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    delinquent: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
    on_notice: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
    down_for_turn: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
  };
  return map[status] ?? "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200";
}

function turnStatusCls(status: string) {
  const map: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
    in_progress: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    completed: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    cancelled: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
  };
  return map[status] ?? "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200";
}

export default function MultifamilyDashboard() {
  const { data: stats, isLoading, isError } = useQuery<MultifamilyStats>({
    queryKey: ["/api/multifamily-ops/stats"],
    retry: false,
  });

  const { data: units = [], isLoading: unitsLoading } = useQuery<MultifamilyUnit[]>({
    queryKey: ["/api/multifamily-ops/units"],
    retry: false,
  });

  const { data: turns = [], isLoading: turnsLoading } = useQuery<MultifamilyTurn[]>({
    queryKey: ["/api/multifamily-ops/turns"],
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
  const hasLeaseExpiryData = leaseExpiryWall.some(d => d.count > 0);
  const hasUnitStatusData = unitStatusBreakdown.length > 0;

  const now = new Date();
  const in90Days = new Date(now.getTime() + 90 * 86400000).toISOString().split("T")[0];
  const todayStr = now.toISOString().split("T")[0];

  const expiringUnits = units
    .filter(u => u.leaseEnd && u.leaseEnd >= todayStr && u.leaseEnd <= in90Days)
    .sort((a, b) => (a.leaseEnd! > b.leaseEnd! ? 1 : -1));

  const activeTurns = turns.filter(t => t.status !== "completed" && t.status !== "cancelled");

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
            {!hasData || !hasLeaseExpiryData ? (
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
            {!hasData || !hasUnitStatusData ? (
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

      <Card>
        <CardHeader>
          <CardTitle>Lease Expiration — Next 90 Days</CardTitle>
          <CardDescription>Tenants with leases expiring in the next 90 days</CardDescription>
        </CardHeader>
        <CardContent>
          {unitsLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10" />)}
            </div>
          ) : expiringUnits.length === 0 ? (
            <div className="flex items-center justify-center h-24 text-muted-foreground">
              No leases expiring in the next 90 days.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="text-left py-2 pr-4 font-medium">Unit</th>
                    <th className="text-left py-2 pr-4 font-medium">Type</th>
                    <th className="text-left py-2 pr-4 font-medium">Tenant</th>
                    <th className="text-left py-2 pr-4 font-medium">Lease End</th>
                    <th className="text-left py-2 pr-4 font-medium">Current Rent</th>
                    <th className="text-left py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {expiringUnits.map((unit) => (
                    <tr key={unit.id} className="border-b last:border-0 hover:bg-muted/50">
                      <td className="py-2 pr-4 font-medium">{unit.unitNumber}</td>
                      <td className="py-2 pr-4">{unit.unitType}</td>
                      <td className="py-2 pr-4">{unit.tenantName || "—"}</td>
                      <td className="py-2 pr-4 text-orange-600 font-medium">{unit.leaseEnd || "—"}</td>
                      <td className="py-2 pr-4">
                        {unit.currentRent ? `$${parseFloat(unit.currentRent).toFixed(0)}` : "—"}
                      </td>
                      <td className="py-2">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${unitStatusCls(unit.status)}`}>
                          {unit.status.replace(/_/g, " ")}
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

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Wrench className="h-4 w-4 text-primary" />
            <CardTitle>Active Unit Turns</CardTitle>
          </div>
          <CardDescription>Unit turnover work in progress</CardDescription>
        </CardHeader>
        <CardContent>
          {turnsLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10" />)}
            </div>
          ) : activeTurns.length === 0 ? (
            <div className="flex items-center justify-center h-24 text-muted-foreground">
              No active unit turns. Turns will appear when move-outs are recorded.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="text-left py-2 pr-4 font-medium">Unit</th>
                    <th className="text-left py-2 pr-4 font-medium">Move-out</th>
                    <th className="text-left py-2 pr-4 font-medium">Target Move-in</th>
                    <th className="text-left py-2 pr-4 font-medium">Scope</th>
                    <th className="text-left py-2 pr-4 font-medium">Est. Cost</th>
                    <th className="text-left py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {activeTurns.map((turn) => (
                    <tr key={turn.id} className="border-b last:border-0 hover:bg-muted/50">
                      <td className="py-2 pr-4 font-medium">{turn.unitNumber}</td>
                      <td className="py-2 pr-4">{turn.moveOutDate}</td>
                      <td className="py-2 pr-4">{turn.targetMoveIn || "—"}</td>
                      <td className="py-2 pr-4 capitalize">{turn.scope.replace(/_/g, " ")}</td>
                      <td className="py-2 pr-4">
                        {turn.estimatedCost ? `$${parseFloat(turn.estimatedCost).toLocaleString()}` : "—"}
                      </td>
                      <td className="py-2">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${turnStatusCls(turn.status)}`}>
                          {turn.status.replace(/_/g, " ")}
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
    </div>
  );
}
