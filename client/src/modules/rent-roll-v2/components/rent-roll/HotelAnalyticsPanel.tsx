import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, BarChart2, Hotel, BedDouble } from "lucide-react";

interface ADRTrendPoint {
  month: number;
  year: number;
  monthLabel: string;
  adr: number;
  occupancyPct: number;
  revpar: number;
}

interface ChannelMixItem {
  channel: string;
  leaseCount: number;
  totalRevenue: number;
  pctOfRevenue: number;
  avgADR: number;
}

interface RoomTypePerformance {
  roomType: string;
  totalUnits: number;
  occupiedUnits: number;
  occupancyPct: number;
  avgNightlyRate: number;
  totalRevenue: number;
  revpar: number;
}

interface HotelAnalyticsPanelProps {
  locationId?: string | null;
}

export default function HotelAnalyticsPanel({ locationId }: HotelAnalyticsPanelProps) {
  const { data: adrTrend, isLoading: adrLoading } = useQuery<ADRTrendPoint[]>({
    queryKey: ['/api/rent-roll/analytics/hotel/adr-trend', locationId],
    queryFn: async () => {
      const res = await fetch(`/api/rent-roll/analytics/hotel/adr-trend?locationId=${locationId}&months=12`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load ADR trend');
      return res.json();
    },
    enabled: !!locationId,
  });

  const { data: channelMix, isLoading: channelLoading } = useQuery<ChannelMixItem[]>({
    queryKey: ['/api/rent-roll/analytics/hotel/channel-mix', locationId],
    queryFn: async () => {
      const res = await fetch(`/api/rent-roll/analytics/hotel/channel-mix?locationId=${locationId}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load channel mix');
      return res.json();
    },
    enabled: !!locationId,
  });

  const { data: roomPerformance, isLoading: roomLoading } = useQuery<RoomTypePerformance[]>({
    queryKey: ['/api/rent-roll/analytics/hotel/room-performance', locationId],
    queryFn: async () => {
      const res = await fetch(`/api/rent-roll/analytics/hotel/room-performance?locationId=${locationId}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load room type performance');
      return res.json();
    },
    enabled: !!locationId,
  });

  if (!locationId) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Hotel className="w-10 h-10 mx-auto mb-3 opacity-30" />
        <p className="text-sm">Select a project to view hotel analytics</p>
      </div>
    );
  }

  const latestMonth = adrTrend?.[adrTrend.length - 1];
  const prevMonth = adrTrend?.[adrTrend.length - 2];

  const adrDelta = latestMonth && prevMonth
    ? latestMonth.adr - prevMonth.adr
    : null;

  const totalChannelRevenue = channelMix?.reduce((s, c) => s + c.totalRevenue, 0) || 0;

  return (
    <div className="grid gap-6">
      {/* KPI Summary Row */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
              <TrendingUp className="w-4 h-4" /> ADR (Current Month)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {adrLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div>
                <p className="text-2xl font-bold">
                  ${latestMonth?.adr.toFixed(2) || "—"}
                </p>
                {adrDelta !== null && (
                  <Badge variant={adrDelta >= 0 ? "default" : "destructive"} className="text-xs mt-1">
                    {adrDelta >= 0 ? "+" : ""}{adrDelta.toFixed(2)} vs prev month
                  </Badge>
                )}
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
              <BarChart2 className="w-4 h-4" /> Occupancy
            </CardTitle>
          </CardHeader>
          <CardContent>
            {adrLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <p className="text-2xl font-bold">{latestMonth?.occupancyPct.toFixed(1) || "—"}%</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
              <TrendingUp className="w-4 h-4" /> RevPAR
            </CardTitle>
          </CardHeader>
          <CardContent>
            {adrLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <p className="text-2xl font-bold">${latestMonth?.revpar.toFixed(2) || "—"}</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Room Type Performance Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <BedDouble className="w-4 h-4" />
            Room Type Performance
          </CardTitle>
        </CardHeader>
        <CardContent>
          {roomLoading ? (
            <div className="space-y-2">
              {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
            </div>
          ) : !roomPerformance || roomPerformance.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              No room type data available. Assign unit types to leases to see performance by room category.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm" data-testid="table-room-performance">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="text-left py-2 font-medium">Room Type</th>
                    <th className="text-right py-2 font-medium">Units</th>
                    <th className="text-right py-2 font-medium">Occupied</th>
                    <th className="text-right py-2 font-medium">Occ %</th>
                    <th className="text-right py-2 font-medium">Avg Rate</th>
                    <th className="text-right py-2 font-medium">RevPAR</th>
                    <th className="text-right py-2 font-medium">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {roomPerformance.map((row) => (
                    <tr key={row.roomType} className="border-b hover:bg-muted/30">
                      <td className="py-2 font-medium">{row.roomType}</td>
                      <td className="py-2 text-right tabular-nums">{row.totalUnits}</td>
                      <td className="py-2 text-right tabular-nums">{row.occupiedUnits}</td>
                      <td className="py-2 text-right tabular-nums">
                        <Badge
                          variant={row.occupancyPct >= 80 ? "default" : row.occupancyPct >= 60 ? "secondary" : "destructive"}
                          className="text-xs"
                        >
                          {row.occupancyPct.toFixed(1)}%
                        </Badge>
                      </td>
                      <td className="py-2 text-right tabular-nums">${row.avgNightlyRate.toFixed(2)}</td>
                      <td className="py-2 text-right tabular-nums">${row.revpar.toFixed(2)}</td>
                      <td className="py-2 text-right tabular-nums">${row.totalRevenue.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t font-semibold text-muted-foreground">
                    <td className="py-2">Total</td>
                    <td className="py-2 text-right">{roomPerformance.reduce((s, r) => s + r.totalUnits, 0)}</td>
                    <td className="py-2 text-right">{roomPerformance.reduce((s, r) => s + r.occupiedUnits, 0)}</td>
                    <td className="py-2 text-right" colSpan={3}></td>
                    <td className="py-2 text-right">${roomPerformance.reduce((s, r) => s + r.totalRevenue, 0).toLocaleString()}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ADR Trend Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            ADR / RevPAR Trend (Last 12 Months)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {adrLoading ? (
            <div className="space-y-2">
              {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
            </div>
          ) : !adrTrend || adrTrend.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No trend data available</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm" data-testid="table-adr-trend">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="text-left py-2 font-medium">Month</th>
                    <th className="text-right py-2 font-medium">ADR</th>
                    <th className="text-right py-2 font-medium">Occupancy</th>
                    <th className="text-right py-2 font-medium">RevPAR</th>
                  </tr>
                </thead>
                <tbody>
                  {adrTrend.map((row) => (
                    <tr key={`${row.year}-${row.month}`} className="border-b hover:bg-muted/30">
                      <td className="py-2 font-medium">{row.monthLabel}</td>
                      <td className="py-2 text-right tabular-nums">${row.adr.toFixed(2)}</td>
                      <td className="py-2 text-right tabular-nums">{row.occupancyPct.toFixed(1)}%</td>
                      <td className="py-2 text-right tabular-nums">${row.revpar.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Channel Mix */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart2 className="w-4 h-4" />
            Revenue by Booking Channel
          </CardTitle>
        </CardHeader>
        <CardContent>
          {channelLoading ? (
            <div className="space-y-2">
              {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : !channelMix || channelMix.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              No channel data available. Assign booking channels via the unit location field.
            </p>
          ) : (
            <div className="space-y-3" data-testid="channel-mix-list">
              {channelMix.map((item) => (
                <div key={item.channel} className="flex items-center gap-3">
                  <div className="w-28 text-sm font-medium shrink-0">{item.channel}</div>
                  <div className="flex-1 bg-muted rounded-full h-3 relative">
                    <div
                      className="absolute left-0 top-0 h-3 rounded-full bg-primary"
                      style={{ width: `${item.pctOfRevenue}%` }}
                    />
                  </div>
                  <div className="text-right text-sm tabular-nums w-16">{item.pctOfRevenue.toFixed(1)}%</div>
                  <div className="text-right text-sm tabular-nums text-muted-foreground w-24">
                    ${item.totalRevenue.toLocaleString()}
                  </div>
                </div>
              ))}
              <div className="pt-2 border-t text-xs text-muted-foreground flex justify-between">
                <span>{channelMix.reduce((s, c) => s + c.leaseCount, 0)} total units</span>
                <span>Total: ${totalChannelRevenue.toLocaleString()}</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
