import { useQuery } from "@tanstack/react-query";
import { TrendChart } from "./charts/TrendChart";
import { DistributionChart } from "./charts/DistributionChart";
import { Skeleton } from "@/components/ui/skeleton";
import { type TimeRange } from "./TimeRangeSelector";
import { formatCurrency } from "@/lib/formatUtils";

interface CRMChartsProps {
  timeRange: TimeRange;
}

export function CRMCharts({ timeRange }: CRMChartsProps) {
  const { data: trendData, isLoading: trendLoading } = useQuery({
    queryKey: ['/api/dashboards/trends/crm', timeRange],
  });

  const { data: distributionData, isLoading: distLoading } = useQuery({
    queryKey: ['/api/dashboards/distribution/crm-stages', timeRange],
  });

  if (trendLoading || distLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  const chartData = trendData?.map((point: any) => ({
    name: new Date(point.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    value: point.value,
  })) || [];

  const stageColors: Record<string, string> = {
    'lead': '#9ca3af',
    'qualified': '#60a5fa',
    'proposal': '#fbbf24',
    'negotiation': '#f97316',
    'closed_won': '#10b981',
    'closed_lost': '#ef4444',
  };

  const distData = distributionData?.map((item: any) => ({
    name: item.name.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()),
    value: item.value,
    fill: stageColors[item.name] || '#3b82f6',
  })) || [];

  return (
    <div className="space-y-4 mt-4">
      {chartData.length > 0 && (
        <div>
          <p className="text-xs text-gray-500 mb-2">Pipeline Value Trend</p>
          <TrendChart
            data={chartData}
            type="area"
            dataKeys={[{ key: 'value', color: '#3b82f6', label: 'Pipeline Value' }]}
            height={160}
            formatValue={(value) => formatCurrency(value, true)}
          />
        </div>
      )}
      
      {distData.length > 0 && (
        <div>
          <p className="text-xs text-gray-500 mb-2">Deal Stage Distribution</p>
          <DistributionChart
            data={distData}
            height={140}
            innerRadius={0}
            showLegend={true}
          />
        </div>
      )}
    </div>
  );
}
