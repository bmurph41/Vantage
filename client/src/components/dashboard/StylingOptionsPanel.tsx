import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { VisualizationType, ChartConfig } from '@shared/schema';

interface StylingOptionsPanelProps {
  visualizationType: VisualizationType;
  config: Partial<ChartConfig>;
  onConfigChange: (config: Partial<ChartConfig>) => void;
}

export function StylingOptionsPanel({
  visualizationType,
  config,
  onConfigChange,
}: StylingOptionsPanelProps) {
  const hasGridOption = ['line_chart', 'area_chart', 'bar_chart', 'combo_chart'].includes(visualizationType);
  const hasLegendOption = ['line_chart', 'area_chart', 'bar_chart', 'combo_chart', 'pie_chart'].includes(visualizationType);
  const hasDataLabelsOption = ['bar_chart', 'pie_chart'].includes(visualizationType);
  const hasLayoutOption = visualizationType === 'stat_grid';

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-1">Styling Options</h3>
        <p className="text-sm text-gray-600">
          Customize the appearance of your visualization
        </p>
      </div>

      <div className="space-y-4">
        {hasGridOption && (
          <div className="flex items-center justify-between py-2">
            <div>
              <Label>Show Grid</Label>
              <p className="text-xs text-gray-500">Display gridlines on chart</p>
            </div>
            <Switch
              checked={config.showGrid ?? true}
              onCheckedChange={(checked) => onConfigChange({ ...config, showGrid: checked })}
              data-testid="switch-show-grid"
            />
          </div>
        )}

        {hasLegendOption && (
          <div className="flex items-center justify-between py-2">
            <div>
              <Label>Show Legend</Label>
              <p className="text-xs text-gray-500">Display legend for data series</p>
            </div>
            <Switch
              checked={config.showLegend ?? false}
              onCheckedChange={(checked) => onConfigChange({ ...config, showLegend: checked })}
              data-testid="switch-show-legend"
            />
          </div>
        )}

        {hasDataLabelsOption && (
          <div className="flex items-center justify-between py-2">
            <div>
              <Label>Show Data Labels</Label>
              <p className="text-xs text-gray-500">Display values on chart elements</p>
            </div>
            <Switch
              checked={config.showDataLabels ?? false}
              onCheckedChange={(checked) => onConfigChange({ ...config, showDataLabels: checked })}
              data-testid="switch-show-labels"
            />
          </div>
        )}

        {hasLayoutOption && (
          <div className="space-y-2">
            <Label>Layout</Label>
            <Select
              value={config.layout || 'grid'}
              onValueChange={(value: 'row' | 'grid') => onConfigChange({ ...config, layout: value })}
            >
              <SelectTrigger data-testid="select-layout">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="grid">Grid</SelectItem>
                <SelectItem value="row">Row</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {hasLayoutOption && config.layout === 'grid' && (
          <div className="space-y-2">
            <Label>Columns</Label>
            <Select
              value={String(config.columns || 3)}
              onValueChange={(value) => onConfigChange({ ...config, columns: parseInt(value) })}
            >
              <SelectTrigger data-testid="select-columns">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="2">2 Columns</SelectItem>
                <SelectItem value="3">3 Columns</SelectItem>
                <SelectItem value="4">4 Columns</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {visualizationType === 'combo_chart' && (
          <div className="space-y-2">
            <Label>Primary Chart Type</Label>
            <p className="text-xs text-gray-500 mb-2">
              Default style for metrics without specific type
            </p>
            <Select
              value={config.chartType || 'bar'}
              onValueChange={(value: 'line' | 'area' | 'bar') => onConfigChange({ ...config, chartType: value })}
            >
              <SelectTrigger data-testid="select-chart-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="line">Line</SelectItem>
                <SelectItem value="area">Area</SelectItem>
                <SelectItem value="bar">Bar</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
    </div>
  );
}
