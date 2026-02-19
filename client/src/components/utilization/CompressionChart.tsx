import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingUp, Flame, Calendar, BarChart3 } from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  Cell,
} from 'recharts';

interface CompressionChartProps {
  propertyId: string;
  mode: 'contracted' | 'physical';
  unitTypes?: string[];
}

type RangePreset = '30' | '90';
type ThresholdPreset = '80' | '90' | '95';

function getCompressionDates(days: number): { start: string; end: string } {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - days);
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

function getDowBarColor(pct: number, threshold: number): string {
  if (pct >= threshold) return '#ef4444';
  if (pct >= threshold - 10) return '#f59e0b';
  return '#3b82f6';
}

export default function CompressionChart({
  propertyId,
  mode,
  unitTypes,
}: CompressionChartProps) {
  const [range, setRange] = useState<RangePreset>('30');
  const [threshold, setThreshold] = useState<ThresholdPreset>('90');

  const { start: periodStart, end: periodEnd } = useMemo(
    () => getCompressionDates(parseInt(range)),
    [range]
  );

  const queryParams = useMemo(() => {
    const params = new URLSearchParams({
      propertyId,
      periodStart,
      periodEnd,
      threshold,
      mode,
    });
    if (unitTypes?.length) {
      params.set('unitTypes', unitTypes.join(','));
    }
    return params.toString();
  }, [propertyId, periodStart, periodEnd, threshold, mode, unitTypes]);

  const unitTypesKey = unitTypes?.join(',') ?? '';

  const { data, isLoading } = useQuery({
    queryKey: ['/api/utilization/compression', propertyId, periodStart, periodEnd, threshold, mode, unitTypesKey],
    queryFn: async () => {
      const res = await fetch(`/api/utilization/compression?${queryParams}`);
      if (!res.ok) throw new Error('Failed to fetch compression data');
      return res.json();
    },
    enabled: !!propertyId,
  });

  const dailyChartData = useMemo(() => {
    if (!data?.dailySeries) return [];
    return data.dailySeries.map((d: any) => ({
      date: d.date,
      label: new Date(d.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      utilization: d.utilizationPct,
      dayLabel: d.dayLabel,
    }));
  }, [data]);

  const dowChartData = useMemo(() => {
    if (!data?.dayOfWeekAverages) return [];
    return data.dayOfWeekAverages.map((d: any) => ({
      day: d.dayLabel,
      avgUtilization: d.avgUtilizationPct,
      samples: d.sampleCount,
    }));
  }, [data]);

  const thresholdNum = parseInt(threshold);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-64" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[300px] w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Flame className="h-5 w-5 text-orange-500" />
              Compression Analytics
            </CardTitle>
            <CardDescription>
              Peak demand and sell-through patterns for transient occupancy
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Select value={range} onValueChange={(v) => setRange(v as RangePreset)}>
              <SelectTrigger className="w-[110px] h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="30">Last 30 days</SelectItem>
                <SelectItem value="90">Last 90 days</SelectItem>
              </SelectContent>
            </Select>

            <Select value={threshold} onValueChange={(v) => setThreshold(v as ThresholdPreset)}>
              <SelectTrigger className="w-[120px] h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="80">Threshold 80%</SelectItem>
                <SelectItem value="90">Threshold 90%</SelectItem>
                <SelectItem value="95">Threshold 95%</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="p-3 rounded-lg bg-muted/50 text-center">
            <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
              <TrendingUp className="h-3.5 w-3.5" />
              Avg Utilization
            </p>
            <p className="text-xl font-bold mt-1">
              {data?.avgUtilizationPct?.toFixed(1) ?? '—'}%
            </p>
          </div>
          <div className="p-3 rounded-lg bg-muted/50 text-center">
            <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
              <Flame className="h-3.5 w-3.5" />
              Compression Index
            </p>
            <p className="text-xl font-bold mt-1">
              {data?.compressionDaysPct?.toFixed(1) ?? '—'}%
            </p>
          </div>
          <div className="p-3 rounded-lg bg-muted/50 text-center">
            <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              Compressed Days
            </p>
            <p className="text-xl font-bold mt-1">
              {data?.compressionDays ?? '—'}<span className="text-sm font-normal text-muted-foreground">/{data?.totalDays ?? '—'}</span>
            </p>
          </div>
          <div className="p-3 rounded-lg bg-muted/50 text-center">
            <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
              <TrendingUp className="h-3.5 w-3.5" />
              Peak
            </p>
            <p className="text-xl font-bold mt-1">
              {data?.peakUtilizationPct?.toFixed(1) ?? '—'}%
            </p>
            {data?.peakDate && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {new Date(data.peakDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </p>
            )}
          </div>
        </div>

        <div>
          <h4 className="text-sm font-medium mb-2 flex items-center gap-1.5">
            <TrendingUp className="h-4 w-4" />
            Daily Utilization
            <Badge variant="outline" className="text-xs ml-auto">
              {range}d
            </Badge>
          </h4>
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dailyChartData}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 10 }}
                  tickLine={false}
                  interval={range === '30' ? 2 : 6}
                />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v) => `${v}%`}
                  tickLine={false}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0]?.payload;
                    if (!d) return null;
                    const isCompressed = d.utilization >= thresholdNum;
                    return (
                      <div style={{
                        borderRadius: '8px',
                        border: '1px solid hsl(var(--border))',
                        backgroundColor: 'hsl(var(--card))',
                        color: 'hsl(var(--foreground))',
                        padding: '10px 14px',
                        fontSize: '13px',
                      }}>
                        <p style={{ fontWeight: 600, marginBottom: 4 }}>{d.date} ({d.dayLabel})</p>
                        <p>Utilization: <span style={{ fontWeight: 600, color: isCompressed ? '#ef4444' : '#3b82f6' }}>{d.utilization.toFixed(1)}%</span></p>
                        {isCompressed && (
                          <p style={{ color: '#ef4444', fontSize: '11px', marginTop: 2 }}>Above {thresholdNum}% threshold</p>
                        )}
                      </div>
                    );
                  }}
                />
                <ReferenceLine
                  y={thresholdNum}
                  stroke="#ef4444"
                  strokeDasharray="4 4"
                  strokeWidth={1.5}
                  label={{
                    value: `${thresholdNum}%`,
                    position: 'right',
                    fill: '#ef4444',
                    fontSize: 11,
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="utilization"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, fill: '#3b82f6' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div>
          <h4 className="text-sm font-medium mb-2 flex items-center gap-1.5">
            <BarChart3 className="h-4 w-4" />
            Day-of-Week Average
          </h4>
          <div className="h-[180px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dowChartData}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v) => `${v}%`}
                  tickLine={false}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0]?.payload;
                    if (!d) return null;
                    return (
                      <div style={{
                        borderRadius: '8px',
                        border: '1px solid hsl(var(--border))',
                        backgroundColor: 'hsl(var(--card))',
                        color: 'hsl(var(--foreground))',
                        padding: '10px 14px',
                        fontSize: '13px',
                      }}>
                        <p style={{ fontWeight: 600, marginBottom: 4 }}>{d.day}</p>
                        <p>Avg Utilization: {d.avgUtilization.toFixed(1)}%</p>
                        <p style={{ color: '#888', fontSize: '11px' }}>Samples: {d.samples}</p>
                      </div>
                    );
                  }}
                />
                <ReferenceLine
                  y={thresholdNum}
                  stroke="#ef4444"
                  strokeDasharray="4 4"
                  strokeWidth={1.5}
                />
                <Bar dataKey="avgUtilization" radius={[4, 4, 0, 0]}>
                  {dowChartData.map((_: any, index: number) => (
                    <Cell
                      key={index}
                      fill={getDowBarColor(dowChartData[index]?.avgUtilization ?? 0, thresholdNum)}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
