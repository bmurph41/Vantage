import { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { BarChart3 } from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Cell,
} from 'recharts';

interface BandData {
  unitType: string;
  bandKey: string;
  bandLabel?: string;
  totalUnits: number;
  occupiedUnits: number;
  offlineUnits: number;
  availableUnits: number;
  unitUtilPct: number;
  totalCapacity: number;
  occupiedCapacity: number;
  weightedUtilPct: number;
}

interface OfflineBandData {
  bandKey: string;
  offlineUnits: number;
  offlineCapacityTime: number;
  estimatedLostRevenue: number;
}

interface UtilizationByBandChartProps {
  bands: BandData[];
  offlineBands?: OfflineBandData[];
  viewMode: 'unit' | 'weighted';
  loading: boolean;
  onBarClick?: (bandKey: string) => void;
}

const BAND_LABELS: Record<string, string> = {
  '0_25': "Up to 25'",
  '26_35': "26'–35'",
  '36_45': "36'–45'",
  '46_60': "46'–60'",
  '61_plus': "61'+",
  '36_plus': "36'+",
};

function getBarColor(pct: number): string {
  if (pct >= 90) return '#22c55e';
  if (pct >= 70) return '#f59e0b';
  return '#ef4444';
}

function formatCurrency(value: number): string {
  if (value === 0) return '$0';
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(1)}K`;
  return `$${value.toFixed(0)}`;
}

export default function UtilizationByBandChart({
  bands,
  offlineBands,
  viewMode,
  loading,
  onBarClick,
}: UtilizationByBandChartProps) {
  const offlineBandMap = useMemo(() => {
    const map = new Map<string, OfflineBandData>();
    if (offlineBands) {
      for (const ob of offlineBands) {
        map.set(ob.bandKey, ob);
      }
    }
    return map;
  }, [offlineBands]);

  const chartData = useMemo(() => {
    if (!bands || bands.length === 0) return [];
    return bands.map(b => {
      const ob = offlineBandMap.get(b.bandKey);
      return {
        name: b.bandLabel || BAND_LABELS[b.bandKey] || b.bandKey,
        bandKey: b.bandKey,
        utilization: viewMode === 'unit' ? b.unitUtilPct : b.weightedUtilPct,
        occupied: viewMode === 'unit' ? b.occupiedUnits : b.occupiedCapacity,
        total: viewMode === 'unit' ? b.totalUnits : b.totalCapacity,
        offline: b.offlineUnits,
        offlineCapTime: ob?.offlineCapacityTime ?? 0,
        offlineLostRev: ob?.estimatedLostRevenue ?? 0,
      };
    });
  }, [bands, viewMode, offlineBandMap]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[250px] w-full" />
        </CardContent>
      </Card>
    );
  }

  if (chartData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Utilization by Size Band
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">No band data available</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          Utilization by Size Band
        </CardTitle>
        <CardDescription>
          {viewMode === 'unit' ? 'Unit count' : 'Capacity-weighted'} utilization across slip size ranges
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} onClick={(e) => {
              if (e?.activePayload?.[0]?.payload?.bandKey && onBarClick) {
                onBarClick(e.activePayload[0].payload.bandKey);
              }
            }}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 12 }}
                tickLine={false}
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fontSize: 12 }}
                tickFormatter={(v) => `${v}%`}
                tickLine={false}
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  const data = payload[0]?.payload;
                  if (!data) return null;
                  return (
                    <div style={{
                      borderRadius: '8px',
                      border: '1px solid hsl(var(--border))',
                      backgroundColor: 'hsl(var(--card))',
                      color: 'hsl(var(--foreground))',
                      padding: '10px 14px',
                      fontSize: '13px',
                    }}>
                      <p style={{ fontWeight: 600, marginBottom: 4 }}>Size Band: {data.name}</p>
                      <p>Utilization: {data.utilization.toFixed(1)}%</p>
                      <p>Occupied: {data.occupied} / {data.total}</p>
                      {data.offline > 0 && (
                        <div style={{ marginTop: 6, paddingTop: 6, borderTop: '1px solid hsl(var(--border))' }}>
                          <p style={{ color: '#f59e0b', fontWeight: 500 }}>Offline: {data.offline} units</p>
                          {data.offlineCapTime > 0 && (
                            <p style={{ color: '#f59e0b' }}>Cap-Time Lost: {data.offlineCapTime.toLocaleString()}</p>
                          )}
                          {data.offlineLostRev > 0 && (
                            <p style={{ color: '#ef4444' }}>Est. Lost Rev: {formatCurrency(data.offlineLostRev)}</p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                }}
              />
              <Bar
                dataKey="utilization"
                name="Utilization"
                radius={[4, 4, 0, 0]}
                cursor={onBarClick ? 'pointer' : undefined}
              >
                {chartData.map((entry, index) => (
                  <Cell key={index} fill={getBarColor(entry.utilization)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2 mt-4">
          {chartData.map((d) => (
            <div key={d.bandKey} className="p-2 rounded-lg bg-muted/50 text-center">
              <p className="text-xs text-muted-foreground">{d.name}</p>
              <p className="text-sm font-semibold">{d.occupied}/{d.total}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
