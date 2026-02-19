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

interface UtilizationByBandChartProps {
  bands: BandData[];
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

export default function UtilizationByBandChart({
  bands,
  viewMode,
  loading,
  onBarClick,
}: UtilizationByBandChartProps) {
  const chartData = useMemo(() => {
    if (!bands || bands.length === 0) return [];
    return bands.map(b => ({
      name: b.bandLabel || BAND_LABELS[b.bandKey] || b.bandKey,
      bandKey: b.bandKey,
      utilization: viewMode === 'unit' ? b.unitUtilPct : b.weightedUtilPct,
      occupied: viewMode === 'unit' ? b.occupiedUnits : b.occupiedCapacity,
      total: viewMode === 'unit' ? b.totalUnits : b.totalCapacity,
      offline: b.offlineUnits,
    }));
  }, [bands, viewMode]);

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
                formatter={(value: number, name: string) => {
                  if (name === 'utilization') return [`${value.toFixed(1)}%`, 'Utilization'];
                  return [value, name];
                }}
                labelFormatter={(label) => `Size Band: ${label}`}
                contentStyle={{
                  borderRadius: '8px',
                  border: '1px solid hsl(var(--border))',
                  backgroundColor: 'hsl(var(--card))',
                  color: 'hsl(var(--foreground))',
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
