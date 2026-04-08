import { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Plus, X, CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import type { VisualizationType, ChartConfig, ChartMetric } from '@shared/schema';

const MODULE_TYPES = [
  { value: 'crm', label: 'CRM Deals' },
  { value: 'salesComps', label: 'Sales Comparables' },
  { value: 'dueDiligence', label: 'Due Diligence Tasks' },
  { value: 'rentRoll', label: 'Rent Roll Entries' },
  { value: 'vdr', label: 'VDR Activity' },
  { value: 'fuel', label: 'Fuel Transactions' },
  { value: 'shipStore', label: 'Ship Store Sales' },
  { value: 'modeling', label: 'Modeling Projects' },
  { value: 'docket', label: 'Docket Articles' },
];

const METRIC_FIELDS: Record<string, { key: string; label: string; format?: 'currency' | 'number' | 'percent' }[]> = {
  crm: [
    { key: 'value', label: 'Deal Value', format: 'currency' },
    { key: 'count', label: 'Deal Count', format: 'number' },
    { key: 'probability', label: 'Win Probability', format: 'percent' },
  ],
  salesComps: [
    { key: 'sale_price', label: 'Sale Price', format: 'currency' },
    { key: 'price_per_slip', label: 'Price per Slip', format: 'currency' },
    { key: 'count', label: 'Transaction Count', format: 'number' },
  ],
  fuel: [
    { key: 'revenue', label: 'Revenue', format: 'currency' },
    { key: 'gallons', label: 'Gallons Sold', format: 'number' },
    { key: 'transactions', label: 'Transaction Count', format: 'number' },
  ],
  shipStore: [
    { key: 'revenue', label: 'Revenue', format: 'currency' },
    { key: 'transactions', label: 'Transaction Count', format: 'number' },
    { key: 'avg_transaction', label: 'Avg Transaction', format: 'currency' },
  ],
  rentRoll: [
    { key: 'monthly_rent', label: 'Monthly Rent', format: 'currency' },
    { key: 'occupancy_rate', label: 'Occupancy Rate', format: 'percent' },
    { key: 'unit_count', label: 'Unit Count', format: 'number' },
  ],
  dueDiligence: [
    { key: 'task_count', label: 'Task Count', format: 'number' },
    { key: 'completion_rate', label: 'Completion Rate', format: 'percent' },
  ],
  vdr: [
    { key: 'document_count', label: 'Documents', format: 'number' },
    { key: 'activity_count', label: 'Activities', format: 'number' },
  ],
  modeling: [
    { key: 'project_value', label: 'Project Value', format: 'currency' },
    { key: 'project_count', label: 'Project Count', format: 'number' },
  ],
  docket: [
    { key: 'article_count', label: 'Articles', format: 'number' },
    { key: 'deal_count', label: 'M&A Deals', format: 'number' },
  ],
};

const AGGREGATIONS = [
  { value: 'sum', label: 'Sum' },
  { value: 'avg', label: 'Average' },
  { value: 'count', label: 'Count' },
  { value: 'min', label: 'Minimum' },
  { value: 'max', label: 'Maximum' },
];

const TIMEFRAME_PRESETS = [
  { value: '7d', label: 'Last 7 Days' },
  { value: '30d', label: 'Last 30 Days' },
  { value: '90d', label: 'Last 90 Days' },
  { value: '12m', label: 'Last 12 Months' },
  { value: 'ytd', label: 'Year to Date' },
  { value: 'custom', label: 'Custom Range' },
];

const METRIC_COLORS = [
  '#3b82f6', // blue
  '#10b981', // green
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // purple
  '#ec4899', // pink
];

interface DataConfigurationPanelProps {
  visualizationType: VisualizationType;
  moduleType: string;
  config: Partial<ChartConfig>;
  onModuleTypeChange: (type: string) => void;
  onConfigChange: (config: Partial<ChartConfig>) => void;
}

export function DataConfigurationPanel({
  visualizationType,
  moduleType,
  config,
  onModuleTypeChange,
  onConfigChange,
}: DataConfigurationPanelProps) {
  const [showCustomDates, setShowCustomDates] = useState(false);
  const [customStartDate, setCustomStartDate] = useState<Date>();
  const [customEndDate, setCustomEndDate] = useState<Date>();

  const availableFields = METRIC_FIELDS[moduleType] || [];
  const metrics = config.metrics || [];

  const needsXYAxis = ['line_chart', 'area_chart', 'bar_chart', 'combo_chart'].includes(visualizationType);
  const needsGoalValue = visualizationType === 'goal_tracker';
  const allowsMultipleMetrics = ['combo_chart', 'stat_grid'].includes(visualizationType);
  const needsComparison = visualizationType === 'comparison_card';

  const addMetric = () => {
    const newMetrics: ChartMetric[] = [...metrics];
    if (availableFields.length > 0) {
      const field = availableFields[0];
      newMetrics.push({
        key: field.key,
        label: field.label,
        aggregation: 'sum',
        format: field.format,
        color: METRIC_COLORS[newMetrics.length % METRIC_COLORS.length],
      });
      onConfigChange({ ...config, metrics: newMetrics });
    }
  };

  const removeMetric = (index: number) => {
    const newMetrics = metrics.filter((_, i) => i !== index);
    onConfigChange({ ...config, metrics: newMetrics });
  };

  const updateMetric = (index: number, updates: Partial<ChartMetric>) => {
    const newMetrics = [...metrics];
    newMetrics[index] = { ...newMetrics[index], ...updates };
    onConfigChange({ ...config, metrics: newMetrics });
  };

  const handleTimeframeChange = (value: string) => {
    if (value === 'custom') {
      setShowCustomDates(true);
    } else {
      setShowCustomDates(false);
      onConfigChange({
        ...config,
        timeframe: {
          type: 'relative',
          start: `-${value}`,
          granularity: value.endsWith('m') ? 'month' : 'day',
        },
      });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-1">Configure Data</h3>
        <p className="text-sm text-gray-600">
          Select data source and define metrics to display
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Data Source *</Label>
          <Select value={moduleType} onValueChange={onModuleTypeChange}>
            <SelectTrigger data-testid="select-data-source">
              <SelectValue placeholder="Select data source" />
            </SelectTrigger>
            <SelectContent>
              {MODULE_TYPES.map((type) => (
                <SelectItem key={type.value} value={type.value}>
                  {type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Metrics *</Label>
            {allowsMultipleMetrics && metrics.length < 6 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={addMetric}
                data-testid="button-add-metric"
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Metric
              </Button>
            )}
          </div>

          {metrics.length === 0 && (
            <Card className="bg-gray-50 border-dashed">
              <CardContent className="p-4 text-center">
                <p className="text-sm text-gray-600">No metrics configured</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addMetric}
                  className="mt-2"
                  data-testid="button-add-first-metric"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add Metric
                </Button>
              </CardContent>
            </Card>
          )}

          {metrics.map((metric, index) => (
            <Card key={index}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <Badge variant="secondary">Metric {index + 1}</Badge>
                  {(allowsMultipleMetrics && metrics.length > 1) && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeMetric(index)}
                      data-testid={`button-remove-metric-${index}`}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Field</Label>
                    <Select
                      value={metric.key}
                      onValueChange={(value) => {
                        const field = availableFields.find(f => f.key === value);
                        updateMetric(index, {
                          key: value,
                          label: field?.label || value,
                          format: field?.format,
                        });
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {availableFields.map((field) => (
                          <SelectItem key={field.key} value={field.key}>
                            {field.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">Aggregation</Label>
                    <Select
                      value={metric.aggregation}
                      onValueChange={(value: any) => updateMetric(index, { aggregation: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {AGGREGATIONS.map((agg) => (
                          <SelectItem key={agg.value} value={agg.value}>
                            {agg.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Label</Label>
                  <Input
                    value={metric.label}
                    onChange={(e) => updateMetric(index, { label: e.target.value })}
                    placeholder="Metric label"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Color</Label>
                  <div className="flex gap-2">
                    {METRIC_COLORS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        className={cn(
                          'w-8 h-8 rounded border-2 transition-all',
                          metric.color === color ? 'border-gray-900 scale-110' : 'border-gray-200'
                        )}
                        style={{ backgroundColor: color }}
                        onClick={() => updateMetric(index, { color })}
                      />
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="space-y-2">
          <Label>Timeframe</Label>
          <Select onValueChange={handleTimeframeChange} defaultValue="30d">
            <SelectTrigger data-testid="select-timeframe">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIMEFRAME_PRESETS.map((preset) => (
                <SelectItem key={preset.value} value={preset.value}>
                  {preset.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {showCustomDates && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
              <div className="space-y-1">
                <Label className="text-xs">Start Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {customStartDate ? format(customStartDate, 'PPP') : 'Pick date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={customStartDate}
                      onSelect={setCustomStartDate}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">End Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {customEndDate ? format(customEndDate, 'PPP') : 'Pick date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={customEndDate}
                      onSelect={setCustomEndDate}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          )}
        </div>

        {needsGoalValue && (
          <div className="space-y-2">
            <Label>Goal Value *</Label>
            <Input
              type="number"
              placeholder="Enter target goal"
              value={config.goalValue || ''}
              onChange={(e) => onConfigChange({ ...config, goalValue: parseFloat(e.target.value) })}
              data-testid="input-goal-value"
            />
          </div>
        )}

        {needsXYAxis && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>X-Axis Label</Label>
              <Input
                placeholder="e.g., Date, Month"
                value={config.xAxis?.label || ''}
                onChange={(e) => onConfigChange({
                  ...config,
                  xAxis: { field: 'name', label: e.target.value, type: 'category' },
                })}
              />
            </div>
            <div className="space-y-2">
              <Label>Y-Axis Label</Label>
              <Input
                placeholder="e.g., Revenue, Count"
                value={config.yAxis?.label || ''}
                onChange={(e) => onConfigChange({
                  ...config,
                  yAxis: { field: 'value', label: e.target.value, type: 'number' },
                })}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
