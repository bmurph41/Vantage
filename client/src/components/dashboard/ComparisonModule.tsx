import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/formatUtils";
import { type TimeRange } from "./TimeRangeSelector";

type ComparisonMetric = {
  label: string;
  key: string;
  type: 'currency' | 'number' | 'percent';
  module: 'crm' | 'dueDiligence' | 'vdr' | 'salesComps' | 'fuel' | 'shipStore' | 'rentRoll' | 'modeling';
};

const COMPARISON_METRICS: ComparisonMetric[] = [
  { label: 'CRM Pipeline Value', key: 'pipelineValue', type: 'currency', module: 'crm' },
  { label: 'CRM Win Rate', key: 'winRate', type: 'percent', module: 'crm' },
  { label: 'DD Completion Rate', key: 'completionRate', type: 'percent', module: 'dueDiligence' },
  { label: 'VDR Documents', key: 'totalDocuments', type: 'number', module: 'vdr' },
  { label: 'Fuel Revenue', key: 'monthlyRevenue', type: 'currency', module: 'fuel' },
  { label: 'Ship Store Revenue', key: 'monthlyRevenue', type: 'currency', module: 'shipStore' },
  { label: 'Rent Roll Occupancy', key: 'occupancyRate', type: 'percent', module: 'rentRoll' },
];

const TIME_RANGES: { value: TimeRange; label: string }[] = [
  { value: '7d', label: 'Last 7 Days' },
  { value: '30d', label: 'Last 30 Days' },
  { value: '90d', label: 'Last 90 Days' },
  { value: 'ytd', label: 'Year to Date' },
  { value: 'all', label: 'All Time' },
];

export function ComparisonModule() {
  const [period1, setPeriod1] = useState<TimeRange>('30d');
  const [period2, setPeriod2] = useState<TimeRange>('90d');

  const { data: data1, isLoading: loading1 } = useQuery({
    queryKey: ['/api/dashboards/data', period1],
    queryFn: () => fetch(`/api/dashboards/data?timeRange=${period1}`).then(res => res.json()),
  });

  const { data: data2, isLoading: loading2 } = useQuery({
    queryKey: ['/api/dashboards/data', period2],
    queryFn: () => fetch(`/api/dashboards/data?timeRange=${period2}`).then(res => res.json()),
  });

  const calculateChange = (value1: number, value2: number): { percent: number; direction: 'up' | 'down' | 'neutral' } => {
    if (value2 === 0) return { percent: 0, direction: 'neutral' };
    const percent = ((value1 - value2) / value2) * 100;
    return {
      percent: Math.abs(percent),
      direction: percent > 0 ? 'up' : percent < 0 ? 'down' : 'neutral',
    };
  };

  const formatValue = (value: number, type: ComparisonMetric['type']): string => {
    switch (type) {
      case 'currency':
        return formatCurrency(value, true);
      case 'percent':
        return formatPercent(value, 1);
      default:
        return formatNumber(value, true);
    }
  };

  const isLoading = loading1 || loading2;

  return (
    <Card className="col-span-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold">Period Comparison</CardTitle>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">Compare:</span>
              <Select value={period1} onValueChange={(v) => setPeriod1(v as TimeRange)}>
                <SelectTrigger className="w-[140px] h-8" data-testid="comparison-period1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIME_RANGES.map((range) => (
                    <SelectItem key={range.value} value={range.value}>
                      {range.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <span className="text-gray-400">vs</span>
            <Select value={period2} onValueChange={(v) => setPeriod2(v as TimeRange)}>
              <SelectTrigger className="w-[140px] h-8" data-testid="comparison-period2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIME_RANGES.map((range) => (
                  <SelectItem key={range.value} value={range.value}>
                    {range.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-8 text-gray-500">Loading comparison data...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {COMPARISON_METRICS.map((metric) => {
              const value1 = data1?.[metric.module]?.[metric.key] || 0;
              const value2 = data2?.[metric.module]?.[metric.key] || 0;
              const change = calculateChange(value1, value2);

              return (
                <div key={`${metric.module}-${metric.key}`} className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-xs font-medium text-gray-600 mb-2">{metric.label}</p>
                  <div className="flex items-baseline justify-between mb-1">
                    <span className="text-sm text-gray-500">{TIME_RANGES.find(r => r.value === period1)?.label}:</span>
                    <span className="text-lg font-bold text-gray-900">{formatValue(value1, metric.type)}</span>
                  </div>
                  <div className="flex items-baseline justify-between mb-2">
                    <span className="text-sm text-gray-500">{TIME_RANGES.find(r => r.value === period2)?.label}:</span>
                    <span className="text-lg font-bold text-gray-600">{formatValue(value2, metric.type)}</span>
                  </div>
                  <div className="flex items-center gap-1 pt-2 border-t border-gray-200">
                    {change.direction === 'up' && <TrendingUp className="h-4 w-4 text-green-600" />}
                    {change.direction === 'down' && <TrendingDown className="h-4 w-4 text-red-600" />}
                    {change.direction === 'neutral' && <Minus className="h-4 w-4 text-gray-400" />}
                    <span className={`text-sm font-medium ${
                      change.direction === 'up' ? 'text-green-600' : 
                      change.direction === 'down' ? 'text-red-600' : 
                      'text-gray-400'
                    }`}>
                      {change.percent.toFixed(1)}% {change.direction === 'up' ? 'increase' : change.direction === 'down' ? 'decrease' : 'no change'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
