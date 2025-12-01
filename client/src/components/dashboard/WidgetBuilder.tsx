import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  BarChart3, TrendingUp, PieChart, FileText, DollarSign, 
  Calendar, Filter, Settings2, Eye, Save, Plus, X, 
  Layers, Clock, ArrowUpRight, ArrowDownRight, Minus, AlertTriangle 
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCurrency, formatNumber } from '@/lib/formatUtils';
import { useToast } from "@/hooks/use-toast";

const widgetFormSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  moduleKey: z.string().min(1, 'Module is required'),
  metricKey: z.string().min(1, 'Metric is required'),
  visualizationType: z.enum(['kpi_card', 'bar_chart', 'line_chart', 'pie_chart', 'stat_grid']).default('kpi_card'),
  enableComparison: z.boolean().default(false),
  comparisonType: z.enum(['yoy', 'mom', 'qoq', 'pop']).default('yoy'),
  filters: z.record(z.any()).default({}),
  size: z.enum(['sm', 'md', 'lg']).default('md'),
  refreshInterval: z.number().optional(),
});

type WidgetFormData = z.infer<typeof widgetFormSchema>;

interface ModuleMetric {
  key: string;
  label: string;
  type: 'count' | 'sum' | 'avg' | 'percentage';
  format: 'number' | 'currency' | 'percent';
  description?: string;
}

interface ModuleDefinition {
  key: string;
  name: string;
  icon: string;
  metrics: ModuleMetric[];
  filters: {
    key: string;
    label: string;
    type: 'year' | 'state' | 'status' | 'category' | 'range';
    options?: { value: string; label: string }[];
  }[];
}

const VISUALIZATION_TYPES = [
  { value: 'kpi_card', label: 'KPI Card', icon: BarChart3, description: 'Single metric display with trend' },
  { value: 'bar_chart', label: 'Bar Chart', icon: BarChart3, description: 'Compare values across categories' },
  { value: 'line_chart', label: 'Line Chart', icon: TrendingUp, description: 'Show trends over time' },
  { value: 'pie_chart', label: 'Pie Chart', icon: PieChart, description: 'Show proportions of a whole' },
  { value: 'stat_grid', label: 'Stat Grid', icon: Layers, description: 'Multiple stats in a grid' },
];

const COMPARISON_TYPES = [
  { value: 'yoy', label: 'Year over Year', description: 'Compare to same period last year' },
  { value: 'mom', label: 'Month over Month', description: 'Compare to previous month' },
  { value: 'qoq', label: 'Quarter over Quarter', description: 'Compare to previous quarter' },
  { value: 'pop', label: 'Period over Period', description: 'Compare to previous period' },
];

interface WidgetBuilderProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (widget: WidgetFormData) => Promise<void>;
  initialData?: Partial<WidgetFormData>;
  isEditing?: boolean;
}

export function WidgetBuilder({ 
  open, 
  onOpenChange, 
  onSave, 
  initialData, 
  isEditing = false 
}: WidgetBuilderProps) {
  const [activeTab, setActiveTab] = useState('metric');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const currentYear = new Date().getFullYear();
  const { toast } = useToast();

  const { data: moduleMetrics, isLoading: metricsLoading } = useQuery<{ modules: ModuleDefinition[] }>({
    queryKey: ['/api/dashboards/module-metrics'],
    enabled: open,
  });

  const form = useForm<WidgetFormData>({
    resolver: zodResolver(widgetFormSchema),
    defaultValues: {
      title: initialData?.title || '',
      moduleKey: initialData?.moduleKey || '',
      metricKey: initialData?.metricKey || '',
      visualizationType: initialData?.visualizationType || 'kpi_card',
      enableComparison: initialData?.enableComparison ?? true,
      comparisonType: initialData?.comparisonType || 'yoy',
      filters: initialData?.filters || {},
      size: initialData?.size || 'md',
    },
  });

  const selectedModuleKey = form.watch('moduleKey');
  const selectedMetricKey = form.watch('metricKey');
  const enableComparison = form.watch('enableComparison');
  const filters = form.watch('filters');
  const visualizationType = form.watch('visualizationType');

  const selectedModule = useMemo(() => {
    return moduleMetrics?.modules?.find(m => m.key === selectedModuleKey);
  }, [moduleMetrics, selectedModuleKey]);

  const selectedMetric = useMemo(() => {
    return selectedModule?.metrics?.find(m => m.key === selectedMetricKey);
  }, [selectedModule, selectedMetricKey]);

  const { data: previewData, isLoading: previewLoading, error: previewError } = useQuery({
    queryKey: ['/api/dashboards/widgets/query', selectedModuleKey, selectedMetricKey, JSON.stringify(filters)],
    queryFn: async () => {
      const response = await fetch('/api/dashboards/widgets/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          moduleKey: selectedModuleKey,
          metricKey: selectedMetricKey,
          filters,
          options: {
            enableComparison: true,
            comparisonType: 'yoy',
          },
        }),
      });
      if (!response.ok) {
        throw new Error('Failed to fetch preview data');
      }
      return response.json();
    },
    enabled: open && !!selectedModuleKey && !!selectedMetricKey,
    refetchOnWindowFocus: false,
    retry: false,
  });

  useEffect(() => {
    if (previewError) {
      toast({
        title: "Preview Error",
        description: "Unable to load metric preview. Please check your selection.",
        variant: "destructive",
      });
    }
  }, [previewError, toast]);

  const handleSubmit = async (data: WidgetFormData) => {
    setIsSubmitting(true);
    try {
      await onSave(data);
      onOpenChange(false);
      form.reset();
    } catch (error) {
      console.error('Failed to save widget:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatPreviewValue = (value: number) => {
    if (!selectedMetric) return formatNumber(value);
    switch (selectedMetric.format) {
      case 'currency':
        return formatCurrency(value);
      case 'percent':
        return `${value.toFixed(2)}%`;
      default:
        return formatNumber(value);
    }
  };

  const yearOptions = Array.from({ length: 10 }, (_, i) => currentYear - i);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-0">
          <DialogTitle>{isEditing ? 'Edit Widget' : 'Create Custom Widget'}</DialogTitle>
          <DialogDescription>
            Build a customized dashboard widget with your preferred metrics and filters
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
            <TabsList className="mx-6 mt-4 grid grid-cols-4 w-auto">
              <TabsTrigger value="metric" className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Metric
              </TabsTrigger>
              <TabsTrigger value="filters" className="flex items-center gap-2">
                <Filter className="h-4 w-4" />
                Filters
              </TabsTrigger>
              <TabsTrigger value="display" className="flex items-center gap-2">
                <Settings2 className="h-4 w-4" />
                Display
              </TabsTrigger>
              <TabsTrigger value="preview" className="flex items-center gap-2">
                <Eye className="h-4 w-4" />
                Preview
              </TabsTrigger>
            </TabsList>

            <ScrollArea className="flex-1 p-6">
              <TabsContent value="metric" className="mt-0 space-y-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="title">Widget Title</Label>
                    <Input
                      id="title"
                      placeholder="e.g., 2024 Sales Volume, Florida Comps Count"
                      {...form.register('title')}
                      data-testid="input-widget-title"
                    />
                    {form.formState.errors.title && (
                      <p className="text-sm text-red-500">{form.formState.errors.title.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>Select Module</Label>
                    {metricsLoading ? (
                      <div className="grid grid-cols-3 gap-3">
                        {[1, 2, 3, 4, 5, 6].map(i => (
                          <Skeleton key={i} className="h-20" />
                        ))}
                      </div>
                    ) : (
                      <div className="grid grid-cols-3 gap-3">
                        {moduleMetrics?.modules?.map(module => (
                          <Card
                            key={module.key}
                            className={cn(
                              "cursor-pointer transition-all hover:border-blue-300",
                              selectedModuleKey === module.key && "border-blue-500 bg-blue-50"
                            )}
                            onClick={() => {
                              form.setValue('moduleKey', module.key);
                              form.setValue('metricKey', '');
                              form.clearErrors('moduleKey');
                            }}
                            data-testid={`module-${module.key}`}
                          >
                            <CardContent className="p-4 flex items-center gap-3">
                              <div className={cn(
                                "p-2 rounded-lg",
                                selectedModuleKey === module.key ? "bg-blue-100" : "bg-gray-100"
                              )}>
                                <TrendingUp className="h-5 w-5 text-blue-600" />
                              </div>
                              <div>
                                <p className="font-medium text-sm">{module.name}</p>
                                <p className="text-xs text-gray-500">
                                  {module.metrics?.length || 0} metrics
                                </p>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}
                    {form.formState.errors.moduleKey && (
                      <p className="text-sm text-red-500">{form.formState.errors.moduleKey.message}</p>
                    )}
                  </div>

                  {selectedModule && (
                    <div className="space-y-2">
                      <Label>Select Metric</Label>
                      <div className="grid grid-cols-2 gap-3">
                        {selectedModule.metrics?.map(metric => (
                          <Card
                            key={metric.key}
                            className={cn(
                              "cursor-pointer transition-all hover:border-blue-300",
                              selectedMetricKey === metric.key && "border-blue-500 bg-blue-50"
                            )}
                            onClick={() => {
                              form.setValue('metricKey', metric.key);
                              form.clearErrors('metricKey');
                            }}
                            data-testid={`metric-${metric.key}`}
                          >
                            <CardContent className="p-4">
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="font-medium text-sm">{metric.label}</p>
                                  <p className="text-xs text-gray-500">{metric.description}</p>
                                </div>
                                <Badge variant="outline" className="text-xs">
                                  {metric.format}
                                </Badge>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                      {form.formState.errors.metricKey && (
                        <p className="text-sm text-red-500">{form.formState.errors.metricKey.message}</p>
                      )}
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="filters" className="mt-0 space-y-6">
                {!selectedModule ? (
                  <div className="text-center py-12 text-gray-500">
                    <Filter className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <p>Select a module first to configure filters</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <Label>Year Filter</Label>
                      <Select
                        value={filters.year ? String(filters.year) : 'all'}
                        onValueChange={(value) => {
                          const newFilters = { ...filters };
                          if (value === 'all') {
                            delete newFilters.year;
                          } else {
                            newFilters.year = parseInt(value);
                          }
                          form.setValue('filters', newFilters);
                        }}
                      >
                        <SelectTrigger data-testid="select-year-filter">
                          <SelectValue placeholder="All Years" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Years</SelectItem>
                          {yearOptions.map(year => (
                            <SelectItem key={year} value={String(year)}>{year}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-gray-500">Filter data to a specific year</p>
                    </div>

                    {selectedModule.key === 'sales_comps' && (
                      <>
                        <div className="space-y-2">
                          <Label>State Filter</Label>
                          <Select
                            value={filters.states?.[0] || 'all'}
                            onValueChange={(value) => {
                              const newFilters = { ...filters };
                              if (value === 'all') {
                                delete newFilters.states;
                              } else {
                                newFilters.states = [value];
                              }
                              form.setValue('filters', newFilters);
                            }}
                          >
                            <SelectTrigger data-testid="select-state-filter">
                              <SelectValue placeholder="All States" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All States</SelectItem>
                              <SelectItem value="FL">Florida</SelectItem>
                              <SelectItem value="TX">Texas</SelectItem>
                              <SelectItem value="CA">California</SelectItem>
                              <SelectItem value="NC">North Carolina</SelectItem>
                              <SelectItem value="SC">South Carolina</SelectItem>
                              <SelectItem value="MI">Michigan</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label>Water Type</Label>
                          <Select
                            value={filters.waterType || 'all'}
                            onValueChange={(value) => {
                              const newFilters = { ...filters };
                              if (value === 'all') {
                                delete newFilters.waterType;
                              } else {
                                newFilters.waterType = value;
                              }
                              form.setValue('filters', newFilters);
                            }}
                          >
                            <SelectTrigger data-testid="select-water-type-filter">
                              <SelectValue placeholder="All Types" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All Types</SelectItem>
                              <SelectItem value="Coastal">Coastal</SelectItem>
                              <SelectItem value="Lake">Lake</SelectItem>
                              <SelectItem value="River">River</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </>
                    )}

                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="space-y-0.5">
                        <Label>Enable Comparison</Label>
                        <p className="text-xs text-gray-500">
                          Show trend comparison against previous period
                        </p>
                      </div>
                      <Switch
                        checked={enableComparison}
                        onCheckedChange={(checked) => form.setValue('enableComparison', checked)}
                        data-testid="switch-enable-comparison"
                      />
                    </div>

                    {enableComparison && (
                      <div className="space-y-2">
                        <Label>Comparison Type</Label>
                        <div className="grid grid-cols-2 gap-3">
                          {COMPARISON_TYPES.map(type => (
                            <Card
                              key={type.value}
                              className={cn(
                                "cursor-pointer transition-all hover:border-blue-300",
                                form.watch('comparisonType') === type.value && "border-blue-500 bg-blue-50"
                              )}
                              onClick={() => form.setValue('comparisonType', type.value as any)}
                              data-testid={`comparison-${type.value}`}
                            >
                              <CardContent className="p-3">
                                <p className="font-medium text-sm">{type.label}</p>
                                <p className="text-xs text-gray-500">{type.description}</p>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="display" className="mt-0 space-y-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Visualization Type</Label>
                    <div className="grid grid-cols-2 gap-3">
                      {VISUALIZATION_TYPES.map(viz => {
                        const Icon = viz.icon;
                        return (
                          <Card
                            key={viz.value}
                            className={cn(
                              "cursor-pointer transition-all hover:border-blue-300",
                              visualizationType === viz.value && "border-blue-500 bg-blue-50"
                            )}
                            onClick={() => form.setValue('visualizationType', viz.value as any)}
                            data-testid={`viz-${viz.value}`}
                          >
                            <CardContent className="p-4 flex items-center gap-3">
                              <div className={cn(
                                "p-2 rounded-lg",
                                visualizationType === viz.value ? "bg-blue-100" : "bg-gray-100"
                              )}>
                                <Icon className="h-5 w-5 text-blue-600" />
                              </div>
                              <div>
                                <p className="font-medium text-sm">{viz.label}</p>
                                <p className="text-xs text-gray-500">{viz.description}</p>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Widget Size</Label>
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { value: 'sm', label: 'Small', desc: '1 column' },
                        { value: 'md', label: 'Medium', desc: '2 columns' },
                        { value: 'lg', label: 'Large', desc: 'Full width' },
                      ].map(size => (
                        <Card
                          key={size.value}
                          className={cn(
                            "cursor-pointer transition-all hover:border-blue-300",
                            form.watch('size') === size.value && "border-blue-500 bg-blue-50"
                          )}
                          onClick={() => form.setValue('size', size.value as any)}
                          data-testid={`size-${size.value}`}
                        >
                          <CardContent className="p-3 text-center">
                            <p className="font-medium text-sm">{size.label}</p>
                            <p className="text-xs text-gray-500">{size.desc}</p>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="preview" className="mt-0">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label>Widget Preview</Label>
                    {previewLoading && (
                      <Badge variant="outline" className="animate-pulse">
                        Loading...
                      </Badge>
                    )}
                  </div>

                  {!selectedModuleKey || !selectedMetricKey ? (
                    <div className="border-2 border-dashed rounded-lg p-12 text-center text-gray-500">
                      <Eye className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                      <p>Select a module and metric to see the preview</p>
                    </div>
                  ) : (
                    <Card className="border-2">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-lg flex items-center gap-2">
                          <TrendingUp className="h-5 w-5 text-blue-600" />
                          {form.watch('title') || `${selectedModule?.name} - ${selectedMetric?.label}`}
                        </CardTitle>
                        <CardDescription className="flex items-center gap-2">
                          {filters.year && <Badge variant="secondary">{filters.year}</Badge>}
                          {filters.states && <Badge variant="secondary">{filters.states[0]}</Badge>}
                          {filters.waterType && <Badge variant="secondary">{filters.waterType}</Badge>}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        {previewLoading ? (
                          <Skeleton className="h-24 w-full" />
                        ) : previewData ? (
                          <div className="space-y-4">
                            <div className="flex items-end gap-4">
                              <div>
                                <p className="text-3xl font-bold">
                                  {formatPreviewValue(previewData.value || 0)}
                                </p>
                                <p className="text-sm text-gray-500">{selectedMetric?.label}</p>
                              </div>
                              {enableComparison && previewData.trend !== undefined && (
                                <div className={cn(
                                  "flex items-center gap-1 px-2 py-1 rounded text-sm font-medium",
                                  previewData.trend > 0 ? "bg-green-100 text-green-700" :
                                  previewData.trend < 0 ? "bg-red-100 text-red-700" :
                                  "bg-gray-100 text-gray-600"
                                )}>
                                  {previewData.trend > 0 ? (
                                    <ArrowUpRight className="h-4 w-4" />
                                  ) : previewData.trend < 0 ? (
                                    <ArrowDownRight className="h-4 w-4" />
                                  ) : (
                                    <Minus className="h-4 w-4" />
                                  )}
                                  {Math.abs(previewData.trend || 0).toFixed(1)}%
                                </div>
                              )}
                            </div>
                            {enableComparison && previewData.previousValue !== undefined && (
                              <div className="flex items-center gap-2 text-sm text-gray-500">
                                <Clock className="h-4 w-4" />
                                Previous: {formatPreviewValue(previewData.previousValue)}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="text-center py-8 text-gray-500">
                            No data available
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}

                  <div className="p-4 bg-gray-50 rounded-lg space-y-2">
                    <h4 className="font-medium text-sm">Configuration Summary</h4>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="text-gray-500">Module:</div>
                      <div className="font-medium">{selectedModule?.name || '-'}</div>
                      <div className="text-gray-500">Metric:</div>
                      <div className="font-medium">{selectedMetric?.label || '-'}</div>
                      <div className="text-gray-500">Visualization:</div>
                      <div className="font-medium">
                        {VISUALIZATION_TYPES.find(v => v.value === visualizationType)?.label || '-'}
                      </div>
                      <div className="text-gray-500">Size:</div>
                      <div className="font-medium capitalize">{form.watch('size')}</div>
                      <div className="text-gray-500">Comparison:</div>
                      <div className="font-medium">
                        {enableComparison ? COMPARISON_TYPES.find(c => c.value === form.watch('comparisonType'))?.label : 'Disabled'}
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>
            </ScrollArea>
          </Tabs>
        </div>

        <DialogFooter className="px-6 py-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel">
            Cancel
          </Button>
          <Button 
            onClick={form.handleSubmit(handleSubmit)} 
            disabled={isSubmitting || !selectedModuleKey || !selectedMetricKey}
            data-testid="button-save-widget"
          >
            {isSubmitting ? (
              <>Saving...</>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                {isEditing ? 'Update Widget' : 'Create Widget'}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default WidgetBuilder;
