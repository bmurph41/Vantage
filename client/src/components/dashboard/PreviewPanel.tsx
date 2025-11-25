import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { apiRequest } from '@/lib/queryClient';
import { TrendChart } from './charts/TrendChart';
import { PieChart } from './charts/PieChart';
import { ComboChart } from './charts/ComboChart';
import { KPICard } from './charts/KPICard';
import { GoalProgressBar } from './charts/GoalProgressBar';
import { ComparisonCard } from './charts/ComparisonCard';
import { StatGrid } from './charts/StatGrid';
import { EnhancedDataTable } from './EnhancedDataTable';
import type { VisualizationType, ChartConfig } from '@shared/schema';

interface PreviewPanelProps {
  title: string;
  visualizationType: VisualizationType;
  moduleType: string;
  config: Partial<ChartConfig>;
}

export function PreviewPanel({ title, visualizationType, moduleType, config }: PreviewPanelProps) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['/api/dashboards/custom-modules/preview', visualizationType, moduleType, JSON.stringify(config)],
    queryFn: async () => {
      const response = await apiRequest('/api/dashboards/custom-modules/preview', {
        method: 'POST',
        body: JSON.stringify({ visualizationType, moduleType, config }),
      });
      return response;
    },
    enabled: config.metrics && config.metrics.length > 0,
  });

  const renderVisualization = () => {
    if (!data) {
      return (
        <div className="h-64 flex items-center justify-center text-gray-400">
          <p>No data available</p>
        </div>
      );
    }
    
    if (data.message) {
      return (
        <Alert>
          <AlertDescription>{data.message}</AlertDescription>
        </Alert>
      );
    }

    const formatValue = (value: number) => {
      const metric = config.metrics?.[0];
      if (!metric) return value.toLocaleString();
      
      switch (metric.format) {
        case 'currency':
          return `$${value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
        case 'percent':
          return `${value.toFixed(2)}%`;
        default:
          return value.toLocaleString();
      }
    };

    switch (visualizationType) {
      case 'kpi_card':
        return (
          <KPICard
            title={config.metrics?.[0]?.label || 'Metric'}
            value={data.kpiValue || 0}
            format={config.metrics?.[0]?.format}
            trend={data.trend}
          />
        );

      case 'line_chart':
        if (!data.chartData || data.chartData.length === 0) {
          return <div className="h-64 flex items-center justify-center text-gray-400"><p>No chart data available</p></div>;
        }
        return (
          <TrendChart
            data={data.chartData}
            type="line"
            dataKeys={config.metrics?.map(m => ({
              key: m.key,
              label: m.label,
              color: m.color || '#3b82f6',
            })) || []}
            showGrid={config.showGrid}
            showLegend={config.showLegend}
            formatValue={formatValue}
            height={300}
          />
        );

      case 'area_chart':
        if (!data.chartData || data.chartData.length === 0) {
          return <div className="h-64 flex items-center justify-center text-gray-400"><p>No chart data available</p></div>;
        }
        return (
          <TrendChart
            data={data.chartData}
            type="area"
            dataKeys={config.metrics?.map(m => ({
              key: m.key,
              label: m.label,
              color: m.color || '#3b82f6',
            })) || []}
            showGrid={config.showGrid}
            showLegend={config.showLegend}
            formatValue={formatValue}
            height={300}
          />
        );

      case 'bar_chart':
        if (!data.chartData || data.chartData.length === 0) {
          return <div className="h-64 flex items-center justify-center text-gray-400"><p>No chart data available</p></div>;
        }
        return (
          <TrendChart
            data={data.chartData}
            type="bar"
            dataKeys={config.metrics?.map(m => ({
              key: m.key,
              label: m.label,
              color: m.color || '#3b82f6',
            })) || []}
            showGrid={config.showGrid}
            showLegend={config.showLegend}
            formatValue={formatValue}
            height={300}
          />
        );

      case 'pie_chart':
        const pieData = data.pieData || data.chartData || [];
        if (pieData.length === 0) {
          return <div className="h-64 flex items-center justify-center text-gray-400"><p>No chart data available</p></div>;
        }
        return (
          <PieChart
            data={pieData}
            showLegend={config.showLegend}
            showLabels={config.showDataLabels}
            formatValue={formatValue}
            height={300}
          />
        );

      case 'combo_chart':
        if (!data.chartData || data.chartData.length === 0) {
          return <div className="h-64 flex items-center justify-center text-gray-400"><p>No chart data available</p></div>;
        }
        return (
          <ComboChart
            data={data.chartData}
            series={config.metrics?.map(m => ({
              key: m.key,
              type: config.chartType || 'bar',
              color: m.color || '#3b82f6',
              label: m.label,
            })) || []}
            showGrid={config.showGrid}
            showLegend={config.showLegend}
            formatValue={formatValue}
            height={300}
          />
        );

      case 'goal_tracker':
        return (
          <GoalProgressBar
            title={title}
            current={data.currentValue || 0}
            goal={config.goalValue || 100}
            format={config.metrics?.[0]?.format}
            showPercentage
          />
        );

      case 'comparison_card':
        return (
          <ComparisonCard
            title={title}
            current={{
              label: data.currentPeriod?.label || 'Current Period',
              value: data.currentPeriod?.value || 0,
            }}
            previous={{
              label: data.previousPeriod?.label || 'Previous Period',
              value: data.previousPeriod?.value || 0,
            }}
            format={config.metrics?.[0]?.format}
          />
        );

      case 'stat_grid':
        return (
          <StatGrid
            stats={data.stats || []}
            columns={config.columns || 3}
            layout={config.layout || 'grid'}
          />
        );

      case 'table':
        return (
          <EnhancedDataTable
            data={data.tableData || []}
            title={title}
            showSearch
            showExport
          />
        );

      default:
        return <p className="text-gray-500">Preview not available for this visualization type</p>;
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold mb-1">Live Preview</h3>
        <p className="text-sm text-gray-600">
          See how your module will look with real data
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{title || 'Untitled Module'}</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading && (
            <div className="h-64 flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Failed to load preview data. Please check your configuration.
              </AlertDescription>
            </Alert>
          )}

          {!isLoading && !error && renderVisualization()}
        </CardContent>
      </Card>

      <Alert>
        <AlertDescription className="text-xs">
          💡 This preview uses real data from your organization. The module will be added to your dashboard once you save it.
        </AlertDescription>
      </Alert>
    </div>
  );
}
