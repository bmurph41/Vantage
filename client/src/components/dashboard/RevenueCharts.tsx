import { useQuery } from "@tanstack/react-query";
import { TrendChart } from "./charts/TrendChart";
import { Skeleton } from "@/components/ui/skeleton";
import { type TimeRange } from "./TimeRangeSelector";
import { formatCurrency } from "@/lib/formatUtils";

interface RevenueChartsProps {
  module: 'fuel' | 'shipStore';
  timeRange: TimeRange;
}

export function RevenueCharts({ module, timeRange }: RevenueChartsProps) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['/api/dashboards/trends/revenue', module, timeRange],
    queryFn: () => fetch(`/api/dashboards/trends/revenue?module=${module}&timeRange=${timeRange}`).then(res => res.json()),
  });

  if (isLoading) {
    return <Skeleton className="h-40 w-full mt-4" />;
  }

  if (isError || !data || !Array.isArray(data) || data.length === 0) {
    return null;
  }

  const chartData = data.map((point: any) => ({
    name: new Date(point.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    revenue: point.revenue,
    volume: module === 'fuel' ? point.volume : point.count,
  }));

  return (
    <div className="mt-4">
      <p className="text-xs text-gray-500 mb-2">Revenue Trend</p>
      <TrendChart
        data={chartData}
        type="area"
        dataKeys={[
          { key: 'revenue', color: '#10b981', label: 'Revenue' }
        ]}
        height={160}
        formatValue={(value) => formatCurrency(value, true)}
      />
    </div>
  );
}
