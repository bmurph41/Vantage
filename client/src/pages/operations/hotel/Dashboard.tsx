import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
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
} from "recharts";
import { DollarSign, Percent, BedDouble, TrendingUp, LogIn, LogOut } from "lucide-react";

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
  revenueByRoomType: Array<{ roomType: string; revenue: number }>;
}

interface HotelRoom {
  id: string;
  roomNumber: string;
  roomType: string;
  floor: number | null;
  status: string;
  currentRate: string | null;
}

interface HotelReservation {
  id: string;
  guestName: string;
  roomId: string | null;
  checkIn: string;
  checkOut: string;
  nightlyRate: string;
  status: string;
  source: string;
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

function statusBadgeCls(status: string) {
  const map: Record<string, string> = {
    occupied: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    available: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    maintenance: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
    out_of_order: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
    cleaning: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
    confirmed: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    checked_in: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    checked_out: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
    cancelled: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  };
  return map[status] ?? "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200";
}

export default function HotelDashboard() {
  const today = new Date().toISOString().split("T")[0];

  const { data: stats, isLoading, isError } = useQuery<HotelStats>({
    queryKey: ["/api/hotel-ops/stats"],
    retry: false,
  });

  const { data: rooms = [], isLoading: roomsLoading } = useQuery<HotelRoom[]>({
    queryKey: ["/api/hotel-ops/rooms"],
    retry: false,
  });

  const { data: reservations = [], isLoading: resLoading } = useQuery<HotelReservation[]>({
    queryKey: ["/api/hotel-ops/reservations"],
    retry: false,
  });

  const todayArrivals = reservations.filter(r => r.checkIn === today);
  const todayDepartures = reservations.filter(r => r.checkOut === today);

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
  const revenueByRoomType = stats?.revenueByRoomType || [];
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
                No occupancy data yet. Add reservations to see trends.
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
            <CardTitle>Revenue by Room Type</CardTitle>
            <CardDescription>MTD revenue breakdown by room category</CardDescription>
          </CardHeader>
          <CardContent>
            {!hasData || revenueByRoomType.length === 0 ? (
              <div className="flex items-center justify-center h-64 text-muted-foreground">
                No revenue data yet. Add rooms and reservations to see the breakdown.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={revenueByRoomType}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="roomType" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(value: number) => [`$${value.toLocaleString()}`, "Revenue"]} />
                  <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Room Status</CardTitle>
          <CardDescription>Current status of all rooms</CardDescription>
        </CardHeader>
        <CardContent>
          {roomsLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10" />)}
            </div>
          ) : rooms.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-muted-foreground">
              No rooms configured yet. Add rooms to track status.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="text-left py-2 pr-4 font-medium">Room</th>
                    <th className="text-left py-2 pr-4 font-medium">Type</th>
                    <th className="text-left py-2 pr-4 font-medium">Floor</th>
                    <th className="text-left py-2 pr-4 font-medium">Rate / Night</th>
                    <th className="text-left py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rooms.map((room) => (
                    <tr key={room.id} className="border-b last:border-0 hover:bg-muted/50">
                      <td className="py-2 pr-4 font-medium">{room.roomNumber}</td>
                      <td className="py-2 pr-4 capitalize">{room.roomType.replace(/_/g, " ")}</td>
                      <td className="py-2 pr-4">{room.floor ?? "—"}</td>
                      <td className="py-2 pr-4">
                        {room.currentRate ? `$${parseFloat(room.currentRate).toFixed(0)}` : "—"}
                      </td>
                      <td className="py-2">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusBadgeCls(room.status)}`}>
                          {room.status.replace(/_/g, " ")}
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <LogIn className="h-4 w-4 text-primary" />
              <CardTitle>Today's Arrivals</CardTitle>
            </div>
            <CardDescription>Guests checking in — {today}</CardDescription>
          </CardHeader>
          <CardContent>
            {resLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10" />)}
              </div>
            ) : todayArrivals.length === 0 ? (
              <div className="flex items-center justify-center h-24 text-muted-foreground">
                No arrivals scheduled for today.
              </div>
            ) : (
              <div className="space-y-2">
                {todayArrivals.map((r) => (
                  <div key={r.id} className="flex items-center justify-between p-2 rounded-md bg-muted/40">
                    <div>
                      <p className="font-medium text-sm">{r.guestName}</p>
                      <p className="text-xs text-muted-foreground capitalize">
                        {r.source} · ${parseFloat(r.nightlyRate).toFixed(0)}/night
                      </p>
                    </div>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusBadgeCls(r.status)}`}>
                      {r.status.replace(/_/g, " ")}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <LogOut className="h-4 w-4 text-primary" />
              <CardTitle>Today's Departures</CardTitle>
            </div>
            <CardDescription>Guests checking out — {today}</CardDescription>
          </CardHeader>
          <CardContent>
            {resLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10" />)}
              </div>
            ) : todayDepartures.length === 0 ? (
              <div className="flex items-center justify-center h-24 text-muted-foreground">
                No departures scheduled for today.
              </div>
            ) : (
              <div className="space-y-2">
                {todayDepartures.map((r) => (
                  <div key={r.id} className="flex items-center justify-between p-2 rounded-md bg-muted/40">
                    <div>
                      <p className="font-medium text-sm">{r.guestName}</p>
                      <p className="text-xs text-muted-foreground">
                        Stayed: {r.checkIn} → {r.checkOut}
                      </p>
                    </div>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusBadgeCls(r.status)}`}>
                      {r.status.replace(/_/g, " ")}
                    </span>
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
