import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { apiRequest } from '@/lib/queryClient';
import { TrendingUp, TrendingDown, Minus, Target, DollarSign, RefreshCw } from 'lucide-react';

interface BenchmarkMetric {
  key: string;
  label: string;
  subjectValue: number;
  peerAverage: number;
  peerMedian: number;
  peerP25: number;
  peerP75: number;
  percentileRank: number;
  status: 'outperforming' | 'in_line' | 'underperforming';
  opportunityValue: number;
  unit: 'percent' | 'currency' | 'ratio';
}

interface BenchmarkResult {
  metrics: BenchmarkMetric[];
  totalOpportunityValue: number;
  peerSetSize: number;
  peerSetDescription: string;
}

interface OperatorBenchmarkingProps {
  projectId: string;
  onTabChange?: (tab: string) => void;
}

const METRIC_KEYS = [
  { key: 'expense_ratio', label: 'Expense Ratio', unit: 'percent' as const },
  { key: 'occupancy_rate', label: 'Occupancy Rate', unit: 'percent' as const },
  { key: 'revenue_per_slip', label: 'Revenue/Slip', unit: 'currency' as const },
  { key: 'noi_margin', label: 'NOI Margin', unit: 'percent' as const },
  { key: 'fuel_margin', label: 'Fuel Margin', unit: 'percent' as const },
  { key: 'service_revenue_per_slip', label: 'Service Revenue/Slip', unit: 'currency' as const },
];

function formatMetricValue(value: number, unit: string): string {
  if (unit === 'percent') return `${(value * 100).toFixed(1)}%`;
  if (unit === 'currency') return `$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  return value.toFixed(2);
}

function formatCurrency(value: number): string {
  if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (Math.abs(value) >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
}

const statusConfig = {
  outperforming: { color: 'bg-green-100 text-green-800 border-green-300', icon: TrendingUp, label: 'Outperforming' },
  in_line: { color: 'bg-yellow-100 text-yellow-800 border-yellow-300', icon: Minus, label: 'In Line' },
  underperforming: { color: 'bg-red-100 text-red-800 border-red-300', icon: TrendingDown, label: 'Underperforming' },
};

export function OperatorBenchmarking({ projectId, onTabChange }: OperatorBenchmarkingProps) {
  const [loading, setLoading] = useState(false);

  const { data: benchmarkData, refetch, isLoading } = useQuery({
    queryKey: ['/api/institutional-analysis/operator-benchmarking', projectId],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/institutional-analysis/operator-benchmarking?projectId=${projectId}`);
      return res.json() as Promise<BenchmarkResult>;
    },
  });

  const handleRefresh = async () => {
    setLoading(true);
    try {
      await refetch();
    } finally {
      setLoading(false);
    }
  };

  const radarData = useMemo(() => {
    if (!benchmarkData) return [];
    return benchmarkData.metrics.map(m => ({
      metric: m.label,
      subject: m.percentileRank,
      peerAverage: 50,
    }));
  }, [benchmarkData]);

  const opportunityData = useMemo(() => {
    if (!benchmarkData) return [];
    return benchmarkData.metrics
      .filter(m => m.opportunityValue > 0)
      .sort((a, b) => b.opportunityValue - a.opportunityValue)
      .map(m => ({
        metric: m.label,
        opportunity: m.opportunityValue,
      }));
  }, [benchmarkData]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold">Operator Benchmarking</h2>
          <p className="text-muted-foreground">Loading benchmark data...</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <Card key={i}>
              <CardContent className="pt-6">
                <div className="h-20 bg-muted animate-pulse rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Operator Benchmarking</h2>
          <p className="text-muted-foreground">
            Compare operational performance against peer set
            {benchmarkData && ` (${benchmarkData.peerSetSize} peers - ${benchmarkData.peerSetDescription})`}
          </p>
        </div>
        <Button variant="outline" onClick={handleRefresh} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Total Opportunity KPI */}
      {benchmarkData && (
        <Card className="border-2 border-blue-200 bg-blue-50/50">
          <CardContent className="pt-6 pb-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
                  <DollarSign className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Opportunity Value</p>
                  <p className="text-3xl font-bold text-blue-700">{formatCurrency(benchmarkData.totalOpportunityValue)}</p>
                </div>
              </div>
              <div className="text-right text-sm text-muted-foreground">
                <p>Potential annual NOI improvement</p>
                <p>if all metrics reach peer median</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {benchmarkData && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {/* Radar Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Performance Profile</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={350}>
                <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="75%">
                  <PolarGrid />
                  <PolarAngleAxis dataKey="metric" fontSize={11} />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} fontSize={10} />
                  <Radar
                    name="Subject"
                    dataKey="subject"
                    stroke="#3b82f6"
                    fill="#3b82f6"
                    fillOpacity={0.3}
                    strokeWidth={2}
                  />
                  <Radar
                    name="Peer Average"
                    dataKey="peerAverage"
                    stroke="#94a3b8"
                    fill="#94a3b8"
                    fillOpacity={0.1}
                    strokeDasharray="5 5"
                  />
                  <Legend />
                </RadarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Opportunity Bar Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Improvement Opportunities</CardTitle>
            </CardHeader>
            <CardContent>
              {opportunityData.length > 0 ? (
                <ResponsiveContainer width="100%" height={350}>
                  <BarChart data={opportunityData} layout="vertical" margin={{ top: 10, right: 20, left: 80, bottom: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" tickFormatter={v => formatCurrency(v)} />
                    <YAxis type="category" dataKey="metric" fontSize={12} width={100} />
                    <Tooltip formatter={(v: number) => formatCurrency(v)} />
                    <Bar dataKey="opportunity" name="$ Impact" fill="#22c55e" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[350px] flex items-center justify-center text-muted-foreground">
                  <p>No improvement opportunities identified -- all metrics at or above peer median.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Rankings Table */}
      {benchmarkData && (
        <Card>
          <CardHeader>
            <CardTitle>Metric Rankings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto w-full">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Metric</TableHead>
                  <TableHead className="text-right">Subject</TableHead>
                  <TableHead className="text-right">Peer Avg</TableHead>
                  <TableHead className="text-right">Peer Median</TableHead>
                  <TableHead className="text-right">P25</TableHead>
                  <TableHead className="text-right">P75</TableHead>
                  <TableHead className="text-center">Percentile</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {benchmarkData.metrics.map(m => {
                  const cfg = statusConfig[m.status];
                  const StatusIcon = cfg.icon;
                  return (
                    <TableRow key={m.key}>
                      <TableCell className="font-medium">{m.label}</TableCell>
                      <TableCell className="text-right font-semibold">{formatMetricValue(m.subjectValue, m.unit)}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{formatMetricValue(m.peerAverage, m.unit)}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{formatMetricValue(m.peerMedian, m.unit)}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{formatMetricValue(m.peerP25, m.unit)}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{formatMetricValue(m.peerP75, m.unit)}</TableCell>
                      <TableCell className="text-center">
                        <span className="font-semibold">{m.percentileRank.toFixed(0)}th</span>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge className={`${cfg.color} border`}>
                          <StatusIcon className="h-3 w-3 mr-1" />
                          {cfg.label}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Opportunity Table */}
      {benchmarkData && opportunityData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Opportunity Detail</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto w-full">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Metric</TableHead>
                  <TableHead className="text-right">Current Value</TableHead>
                  <TableHead className="text-right">Peer Median</TableHead>
                  <TableHead className="text-right">Gap</TableHead>
                  <TableHead className="text-right">$ Impact (Annual)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {benchmarkData.metrics
                  .filter(m => m.opportunityValue > 0)
                  .sort((a, b) => b.opportunityValue - a.opportunityValue)
                  .map(m => (
                    <TableRow key={m.key}>
                      <TableCell className="font-medium">{m.label}</TableCell>
                      <TableCell className="text-right">{formatMetricValue(m.subjectValue, m.unit)}</TableCell>
                      <TableCell className="text-right">{formatMetricValue(m.peerMedian, m.unit)}</TableCell>
                      <TableCell className="text-right text-red-600">
                        {m.unit === 'percent'
                          ? `${((m.peerMedian - m.subjectValue) * 100).toFixed(1)}pp`
                          : formatCurrency(m.peerMedian - m.subjectValue)}
                      </TableCell>
                      <TableCell className="text-right font-semibold text-green-700">{formatCurrency(m.opportunityValue)}</TableCell>
                    </TableRow>
                  ))}
                <TableRow className="border-t-2 font-bold">
                  <TableCell colSpan={4}>Total Opportunity</TableCell>
                  <TableCell className="text-right text-green-700">{formatCurrency(benchmarkData.totalOpportunityValue)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {!benchmarkData && !isLoading && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Target className="h-12 w-12 mx-auto mb-4 opacity-40" />
            <p className="text-lg font-medium">No benchmarking data available</p>
            <p className="text-sm mt-1">Benchmarking data will be loaded automatically when operational metrics are available for this project.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default OperatorBenchmarking;
