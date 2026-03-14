import { useState, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tornado,
  RefreshCw,
  Download,
  ChevronUp,
  ChevronDown,
  Info,
  TrendingUp,
  TrendingDown
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
  Legend
} from 'recharts';
import { formatCurrency, formatPercent } from '@/lib/utils';
import { ExportPdfButton } from '@/components/ui/export-pdf-button';

interface SensitivityTornadoProps {
  projectId: string;
  onTabChange?: (tab: string) => void;
}

interface SensitivityVariable {
  id: string;
  name: string;
  baseValue: number;
  unit: 'percent' | 'currency' | 'number';
  minDelta: number;
  maxDelta: number;
}

interface TornadoDataPoint {
  variable: string;
  variableId: string;
  baseValue: number;
  lowValue: number;
  highValue: number;
  lowImpact: number;
  highImpact: number;
  lowLabel: string;
  highLabel: string;
  totalRange: number;
  unit: string;
}

const DEFAULT_VARIABLES: SensitivityVariable[] = [
  { id: 'cap_rate', name: 'Going-In Cap Rate', baseValue: 6.5, unit: 'percent', minDelta: -1.5, maxDelta: 1.5 },
  { id: 'rent_growth', name: 'Rent Growth Rate', baseValue: 3.0, unit: 'percent', minDelta: -2.0, maxDelta: 2.0 },
  { id: 'expense_ratio', name: 'Expense Ratio', baseValue: 45, unit: 'percent', minDelta: -10, maxDelta: 10 },
  { id: 'vacancy_rate', name: 'Vacancy Rate', baseValue: 5, unit: 'percent', minDelta: -3, maxDelta: 5 },
  { id: 'exit_cap', name: 'Exit Cap Rate', baseValue: 7.0, unit: 'percent', minDelta: -1.0, maxDelta: 1.5 },
];

const VALUATION_METRICS = [
  { id: 'irr', name: 'IRR' },
  { id: 'equity_multiple', name: 'Equity Multiple' },
  { id: 'npv', name: 'NPV' },
  { id: 'noi', name: 'Year 1 NOI' },
  { id: 'valuation', name: 'Indicated Value' },
];

export default function SensitivityTornado({ projectId, onTabChange }: SensitivityTornadoProps) {
  const pdfRef = useRef<HTMLDivElement>(null);
  const [selectedMetric, setSelectedMetric] = useState('irr');
  const [varianceRange, setVarianceRange] = useState(20);

  const { data: tornadoData, isLoading, refetch } = useQuery<TornadoDataPoint[]>({
    queryKey: ['/api/modeling/projects', projectId, 'sensitivity-tornado', selectedMetric, varianceRange],
    queryFn: async () => {
      // Try new DCF decision support tornado endpoint first
      try {
        const dsResponse = await fetch(`/api/modeling/projects/${projectId}/dcf/decision-support`);
        if (dsResponse.ok) {
          const ds = await dsResponse.json();
          if (ds.tornado?.drivers?.length > 0) {
            return ds.tornado.drivers.map((d: any) => ({
              variable: d.driver,
              lowLabel: d.delta,
              highLabel: d.delta,
              lowValue: d.low - d.base,
              highValue: d.high - d.base,
              baseValue: d.base,
              lowScenarioValue: d.low,
              highScenarioValue: d.high,
              totalRange: Math.abs(d.high - d.low),
              unit: selectedMetric === 'irr' ? '%' : selectedMetric === 'equity_multiple' ? 'x' : '$',
            }));
          }
        }
      } catch {
        // DCF endpoint not available
      }

      // Fallback to legacy endpoint
      const params = new URLSearchParams({ metric: selectedMetric, variance: String(varianceRange) });
      const response = await fetch(`/api/modeling/projects/${projectId}/sensitivity-tornado?${params}`);
      if (!response.ok) return [];
      return response.json();
    },
  });


  const chartData = useMemo(() => {
    if (!tornadoData) return [];
    return tornadoData.map(d => ({
      ...d,
      low: d.lowImpact,
      high: d.highImpact,
    }));
  }, [tornadoData]);

  const getMetricFormatter = (metric: string) => {
    switch (metric) {
      case 'irr':
        return (val: number) => `${val >= 0 ? '+' : ''}${val.toFixed(1)}%`;
      case 'equity_multiple':
        return (val: number) => `${val >= 0 ? '+' : ''}${val.toFixed(2)}x`;
      case 'noi':
      case 'valuation':
      case 'npv':
      default:
        return (val: number) => {
          if (Math.abs(val) >= 1000000) {
            return `${val >= 0 ? '+' : ''}$${(val / 1000000).toFixed(1)}M`;
          }
          return `${val >= 0 ? '+' : ''}$${(val / 1000).toFixed(0)}K`;
        };
    }
  };

  const formatValue = getMetricFormatter(selectedMetric);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-popover border rounded-lg shadow-lg p-3 text-sm">
          <p className="font-semibold mb-2">{data.variable}</p>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-sm bg-red-500" />
              <span className="text-muted-foreground">Low ({data.lowLabel}):</span>
              <span className={data.lowImpact < 0 ? 'text-red-500' : 'text-green-500'}>
                {formatValue(data.lowImpact)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-sm bg-green-500" />
              <span className="text-muted-foreground">High ({data.highLabel}):</span>
              <span className={data.highImpact < 0 ? 'text-red-500' : 'text-green-500'}>
                {formatValue(data.highImpact)}
              </span>
            </div>
            <div className="pt-1 border-t mt-1">
              <span className="text-muted-foreground">Total Range: </span>
              <span className="font-medium">{formatValue(data.totalRange)}</span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-[500px]" />
      </div>
    );
  }

  return (
    <div className="space-y-6" ref={pdfRef}>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold flex items-center gap-2">
            <Tornado className="h-6 w-6 text-primary" />
            Sensitivity Analysis - Tornado Chart
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Identify which variables have the greatest impact on investment returns
          </p>
        </div>
        <div className="flex items-center gap-3">
          <ExportPdfButton contentRef={pdfRef} filename="sensitivity-analysis" title="Sensitivity Analysis" />
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Variable Impact Analysis</CardTitle>
              <CardDescription>
                Bars show impact on selected metric when variable changes from base case
              </CardDescription>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Metric:</span>
                <Select value={selectedMetric} onValueChange={setSelectedMetric}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {VALUATION_METRICS.map(metric => (
                      <SelectItem key={metric.id} value={metric.id}>
                        {metric.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Variance:</span>
                <div className="flex items-center gap-2 w-32">
                  <Slider
                    value={[varianceRange]}
                    onValueChange={(val) => setVarianceRange(val[0])}
                    min={5}
                    max={50}
                    step={5}
                  />
                  <span className="text-sm font-medium w-12">±{varianceRange}%</span>
                </div>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ top: 20, right: 30, left: 120, bottom: 20 }}
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
              <XAxis
                type="number"
                tickFormatter={formatValue}
                domain={['dataMin - 10', 'dataMax + 10']}
              />
              <YAxis
                type="category"
                dataKey="variable"
                width={110}
                tick={{ fontSize: 12 }}
              />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine x={0} stroke="#666" strokeWidth={2} />
              <Legend />
              <Bar
                dataKey="low"
                name="Downside Impact"
                stackId="a"
                fill="#ef4444"
              />
              <Bar
                dataKey="high"
                name="Upside Impact"
                stackId="a"
                fill="#22c55e"
              />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-500" />
              Key Upside Drivers
            </CardTitle>
            <CardDescription>Variables with largest positive impact potential</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {chartData.slice(0, 3).map((item, idx) => (
                <div
                  key={item.variableId}
                  className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-950/30 rounded-lg border border-green-200 dark:border-green-800"
                >
                  <div className="flex items-center gap-3">
                    <Badge className="bg-green-500">{idx + 1}</Badge>
                    <div>
                      <p className="font-medium">{item.variable}</p>
                      <p className="text-xs text-muted-foreground">
                        Base: {item.baseValue}{item.unit} → {item.highLabel}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-green-600">
                      {formatValue(item.highImpact)}
                    </p>
                    <p className="text-xs text-muted-foreground">upside</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingDown className="h-5 w-5 text-red-500" />
              Key Risk Factors
            </CardTitle>
            <CardDescription>Variables with largest negative impact potential</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {chartData.slice(0, 3).map((item, idx) => (
                <div
                  key={item.variableId}
                  className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-950/30 rounded-lg border border-red-200 dark:border-red-800"
                >
                  <div className="flex items-center gap-3">
                    <Badge variant="destructive">{idx + 1}</Badge>
                    <div>
                      <p className="font-medium">{item.variable}</p>
                      <p className="text-xs text-muted-foreground">
                        Base: {item.baseValue}{item.unit} → {item.lowLabel}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-red-600">
                      {formatValue(item.lowImpact)}
                    </p>
                    <p className="text-xs text-muted-foreground">downside</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Info className="h-5 w-5" />
            Sensitivity Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-3 font-medium">Variable</th>
                  <th className="text-center py-2 px-3 font-medium">Base Value</th>
                  <th className="text-center py-2 px-3 font-medium">Low Case</th>
                  <th className="text-center py-2 px-3 font-medium">High Case</th>
                  <th className="text-center py-2 px-3 font-medium">Downside Impact</th>
                  <th className="text-center py-2 px-3 font-medium">Upside Impact</th>
                  <th className="text-center py-2 px-3 font-medium">Total Range</th>
                </tr>
              </thead>
              <tbody>
                {chartData.map(item => (
                  <tr key={item.variableId} className="border-b hover:bg-muted/50">
                    <td className="py-2 px-3 font-medium">{item.variable}</td>
                    <td className="text-center py-2 px-3">{item.baseValue}{item.unit}</td>
                    <td className="text-center py-2 px-3 text-red-600">{item.lowLabel}</td>
                    <td className="text-center py-2 px-3 text-green-600">{item.highLabel}</td>
                    <td className="text-center py-2 px-3">
                      <span className={item.lowImpact < 0 ? 'text-red-600' : 'text-green-600'}>
                        {formatValue(item.lowImpact)}
                      </span>
                    </td>
                    <td className="text-center py-2 px-3">
                      <span className={item.highImpact > 0 ? 'text-green-600' : 'text-red-600'}>
                        {formatValue(item.highImpact)}
                      </span>
                    </td>
                    <td className="text-center py-2 px-3 font-medium">
                      {formatValue(item.totalRange)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
