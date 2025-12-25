import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { DndContext, DragEndEvent, closestCenter, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, rectSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Settings, GripVertical, ExternalLink, TrendingUp, Users, FileText, Database, Radio, Fuel, DollarSign, ShoppingCart, Home, BarChart3, ChevronDown, ChevronUp, Plus, Calendar, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Link, useLocation } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { TimeRangeSelector, type TimeRange } from "@/components/dashboard/TimeRangeSelector";
import { ComparisonModule } from "@/components/dashboard/ComparisonModule";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { EnhancedMetricCard } from "@/components/dashboard/EnhancedMetricCard";
import { ModuleSection, MetricGrid, DataList, StatBar } from "@/components/dashboard/ModuleSection";
import { formatCurrency, formatNumber } from "@/lib/formatUtils";
import { CRMCharts } from "@/components/dashboard/CRMCharts";
import { RevenueCharts } from "@/components/dashboard/RevenueCharts";
import { AddModuleModal } from "@/components/dashboard/AddModuleModal";
import { SavedLayoutsPanel } from "@/components/dashboard/SavedLayoutsPanel";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { DetailPanel } from "@/components/dashboard/DetailPanel";
import { DataTable, Column } from "@/components/dashboard/DataTable";
import { EnhancedDataTable } from "@/components/dashboard/EnhancedDataTable";
import { ExportMenu } from "@/components/dashboard/ExportMenu";
import { TrendChart } from "@/components/dashboard/charts/TrendChart";
import { PieChart } from "@/components/dashboard/charts/PieChart";
import { ComboChart } from "@/components/dashboard/charts/ComboChart";
import { KPICard } from "@/components/dashboard/charts/KPICard";
import { GoalProgressBar } from "@/components/dashboard/charts/GoalProgressBar";
import { ComparisonCard } from "@/components/dashboard/charts/ComparisonCard";
import { StatGrid } from "@/components/dashboard/charts/StatGrid";
import { QuickAccessSection } from "@/components/quick-access";
import { FundSelector } from "@/components/dashboard/FundSelector";
import { DashboardPersonaHeader } from "@/components/dashboard/DashboardPersonaHeader";

type DashboardModule = {
  id: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  link: string;
  data?: any;
  renderContent: (data: any) => React.ReactNode;
};

function SortableModule({ 
  module, 
  isCollapsed, 
  onToggleCollapse 
}: { 
  module: DashboardModule;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: module.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const Icon = module.icon;

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <Card className="h-full hover:shadow-lg transition-all">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Icon className="h-4 w-4 text-blue-600" />
            {module.title}
          </CardTitle>
          <div className="flex items-center gap-1">
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-7 w-7 p-0" 
              onClick={onToggleCollapse}
              data-testid={`collapse-${module.id}`}
            >
              {isCollapsed ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
            </Button>
            <Link href={module.link}>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" data-testid={`link-${module.id}`}>
                <ExternalLink className="h-3.5 w-3.5" />
              </Button>
            </Link>
            <div {...listeners} className="hidden sm:block cursor-grab active:cursor-grabbing p-1 hover:bg-gray-100 rounded">
              <GripVertical className="h-4 w-4 text-gray-400" />
            </div>
          </div>
        </CardHeader>
        {!isCollapsed && (
          <CardContent>
            <ErrorBoundary
              fallback={
                <div className="text-sm text-red-600 p-4">
                  <p className="font-semibold">Failed to load module data</p>
                  <p className="text-xs mt-1">Try refreshing the page or contact support if the problem persists.</p>
                </div>
              }
            >
              {module.renderContent(module.data)}
            </ErrorBoundary>
          </CardContent>
        )}
      </Card>
    </div>
  );
}

// Helper function to get module link based on type
function getModuleLink(moduleType: string): string {
  const linkMap: Record<string, string> = {
    crm: '/crm/deals',
    salesComps: '/analysis/sales-comps/analytics',
    dueDiligence: '/projects',
    rentRoll: '/rent-roll',
    vdr: '/vdr',
    fuel: '/fuel',
    shipStore: '/ship-store',
    modeling: '/modeling',
    docktalk: '/docktalk',
  };
  return linkMap[moduleType] || '/';
}

// Component to fetch and display custom module data
function CustomModuleContent({ 
  moduleId, 
  moduleType, 
  visualizationType, 
  chartConfig, 
  filters 
}: { 
  moduleId: string; 
  moduleType: string; 
  visualizationType?: string;
  chartConfig?: any;
  filters: Record<string, any>;
}) {
  // Legacy modules (no visualization type or chart config) use the old data endpoint
  const isLegacyModule = !visualizationType && !chartConfig;
  
  // Legacy data fetch (original behavior)
  const { data: legacyData, isLoading: legacyLoading } = useQuery({
    queryKey: ['/api/dashboards/custom-modules/data', moduleId, filters],
    queryFn: () => 
      fetch('/api/dashboards/custom-modules/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ moduleType, filters, limit: 100 }),
      }).then(res => res.json()),
    enabled: isLegacyModule,
  });
  
  // New visualization fetch (preview endpoint)
  const actualVisualizationType = visualizationType || 'table';
  const { data: previewData, isLoading: previewLoading } = useQuery({
    queryKey: ['/api/dashboards/custom-modules/preview', moduleId, actualVisualizationType, JSON.stringify(chartConfig), JSON.stringify(filters)],
    queryFn: async () => {
      const config = chartConfig ? { ...chartConfig } : {};
      const response = await apiRequest('/api/dashboards/custom-modules/preview', {
        method: 'POST',
        body: JSON.stringify({ 
          visualizationType: actualVisualizationType, 
          moduleType, 
          config,
          filters,
        }),
      });
      return response;
    },
    enabled: !isLegacyModule && !!chartConfig?.metrics?.length,
  });
  
  // Use the appropriate data source
  const data = isLegacyModule ? legacyData : previewData;
  const isLoading = isLegacyModule ? legacyLoading : previewLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  // Handle legacy module rendering
  if (isLegacyModule) {
    if (!data || !Array.isArray(data) || data.length === 0) {
      return (
        <div className="text-center py-8 text-gray-500">
          <p className="text-sm">No data matches your filters</p>
        </div>
      );
    }
    return (
      <div className="space-y-2">
        <p className="text-sm text-gray-600">
          {data.length} record{data.length !== 1 ? 's' : ''} found
        </p>
        <div className="space-y-1 max-h-48 overflow-y-auto">
          {data.slice(0, 10).map((item: any, idx: number) => (
            <div key={idx} className="text-xs p-2 bg-gray-50 rounded">
              {item.title || item.propertyName || item.fileName || item.unitNumber || item.name || `Record ${idx + 1}`}
            </div>
          ))}
        </div>
        {data.length > 10 && (
          <p className="text-xs text-gray-500 text-center">
            And {data.length - 10} more...
          </p>
        )}
      </div>
    );
  }
  
  // Handle new visualization rendering
  if (!data) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p className="text-sm">No data available</p>
      </div>
    );
  }

  // Render based on visualization type
  const formatValue = (value: number) => {
    const metric = chartConfig?.metrics?.[0];
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

  switch (actualVisualizationType) {
    case 'kpi_card':
      return (
        <KPICard
          title={chartConfig?.metrics?.[0]?.label || 'Metric'}
          value={data.kpiValue || 0}
          format={chartConfig?.metrics?.[0]?.format}
          trend={data.trend}
        />
      );

    case 'line_chart':
    case 'area_chart':
    case 'bar_chart':
      if (!data.chartData || data.chartData.length === 0) {
        return <div className="text-center py-8 text-gray-500"><p className="text-sm">No chart data available</p></div>;
      }
      return (
        <TrendChart
          data={data.chartData}
          type={visualizationType.replace('_chart', '') as 'line' | 'area' | 'bar'}
          dataKeys={chartConfig?.metrics?.map(m => ({
            key: m.key,
            label: m.label,
            color: m.color || '#3b82f6',
          })) || []}
          showGrid={chartConfig?.showGrid}
          showLegend={chartConfig?.showLegend}
          formatValue={formatValue}
          height={250}
        />
      );

    case 'pie_chart':
      const pieData = data.pieData || data.chartData || [];
      if (pieData.length === 0) {
        return <div className="text-center py-8 text-gray-500"><p className="text-sm">No chart data available</p></div>;
      }
      return (
        <PieChart
          data={pieData}
          showLegend={chartConfig?.showLegend}
          showLabels={chartConfig?.showDataLabels}
          formatValue={formatValue}
          height={250}
        />
      );

    case 'combo_chart':
      if (!data.chartData || data.chartData.length === 0) {
        return <div className="text-center py-8 text-gray-500"><p className="text-sm">No chart data available</p></div>;
      }
      return (
        <ComboChart
          data={data.chartData}
          series={chartConfig?.metrics?.map(m => ({
            key: m.key,
            type: chartConfig?.chartType || 'bar',
            color: m.color || '#3b82f6',
            label: m.label,
          })) || []}
          showGrid={chartConfig?.showGrid}
          showLegend={chartConfig?.showLegend}
          formatValue={formatValue}
          height={250}
        />
      );

    case 'goal_tracker':
      return (
        <GoalProgressBar
          title={chartConfig?.metrics?.[0]?.label || 'Goal'}
          current={data.currentValue || 0}
          goal={chartConfig?.goalValue || 100}
          format={chartConfig?.metrics?.[0]?.format}
          showPercentage
        />
      );

    case 'comparison_card':
      return (
        <ComparisonCard
          title={chartConfig?.metrics?.[0]?.label || 'Comparison'}
          current={{
            label: data.currentPeriod?.label || 'Current Period',
            value: data.currentPeriod?.value || 0,
          }}
          previous={{
            label: data.previousPeriod?.label || 'Previous Period',
            value: data.previousPeriod?.value || 0,
          }}
          format={chartConfig?.metrics?.[0]?.format}
        />
      );

    case 'stat_grid':
      const stats = data.stats || [];
      if (stats.length === 0) {
        return <div className="text-center py-8 text-gray-500"><p className="text-sm">No stats available</p></div>;
      }
      return (
        <StatGrid
          stats={stats}
          columns={3}
        />
      );

    case 'table':
    default:
      // Support multiple response formats: tableData, rows, chartData
      const tableData = data.tableData || data.rows || data.chartData || [];
      if (!Array.isArray(tableData) || tableData.length === 0) {
        return <div className="text-center py-8 text-gray-500"><p className="text-sm">No data available</p></div>;
      }
      return (
        <div className="space-y-2">
          <p className="text-sm text-gray-600">
            {tableData.length} record{tableData.length !== 1 ? 's' : ''} found
          </p>
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {tableData.slice(0, 10).map((item: any, idx: number) => (
              <div key={idx} className="text-xs p-2 bg-gray-50 rounded">
                {item.title || item.propertyName || item.fileName || item.unitNumber || item.name || `Record ${idx + 1}`}
              </div>
            ))}
          </div>
          {tableData.length > 10 && (
            <p className="text-xs text-gray-500 text-center">
              And {tableData.length - 10} more...
            </p>
          )}
        </div>
      );
  }
}

export default function Dashboard() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  // Time range state with localStorage persistence
  const [timeRange, setTimeRange] = useState<TimeRange>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('dashboardTimeRange');
      return (saved as TimeRange) || '30d';
    }
    return '30d';
  });

  // Save time range to localStorage whenever it changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('dashboardTimeRange', timeRange);
    }
  }, [timeRange]);

  // Sales Comps year filter state with localStorage persistence
  const currentYear = new Date().getFullYear();
  const [salesCompsYear, setSalesCompsYear] = useState<number | 'all'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('dashboardSalesCompsYear');
      return saved === 'all' ? 'all' : saved ? parseInt(saved) : currentYear;
    }
    return currentYear;
  });

  // Save sales comps year to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('dashboardSalesCompsYear', String(salesCompsYear));
    }
  }, [salesCompsYear]);

  const [isAddModuleModalOpen, setIsAddModuleModalOpen] = useState(false);
  const [isCRMDetailOpen, setIsCRMDetailOpen] = useState(false);
  const [isSalesCompsDetailOpen, setIsSalesCompsDetailOpen] = useState(false);
  const [isFuelDetailOpen, setIsFuelDetailOpen] = useState(false);
  const [isDockTalkDetailOpen, setIsDockTalkDetailOpen] = useState(false);
  const [isVDRDetailOpen, setIsVDRDetailOpen] = useState(false);
  const [isShipStoreDetailOpen, setIsShipStoreDetailOpen] = useState(false);
  const [isDDDetailOpen, setIsDDDetailOpen] = useState(false);
  const [isRentRollDetailOpen, setIsRentRollDetailOpen] = useState(false);
  const [isModelingDetailOpen, setIsModelingDetailOpen] = useState(false);
  const [isAnalyticsDetailOpen, setIsAnalyticsDetailOpen] = useState(false);
  
  // Period Comparison collapsed state with localStorage persistence
  const [isPeriodComparisonCollapsed, setIsPeriodComparisonCollapsed] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('dashboardPeriodComparisonCollapsed');
      return saved === 'true';
    }
    return false;
  });

  // Save period comparison collapsed state to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('dashboardPeriodComparisonCollapsed', String(isPeriodComparisonCollapsed));
    }
  }, [isPeriodComparisonCollapsed]);
  
  // Collapsed modules state with localStorage persistence
  const [collapsedModules, setCollapsedModules] = useState<Set<string>>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('dashboardCollapsedModules');
      return saved ? new Set(JSON.parse(saved)) : new Set();
    }
    return new Set();
  });

  // Save collapsed state to localStorage whenever it changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('dashboardCollapsedModules', JSON.stringify(Array.from(collapsedModules)));
    }
  }, [collapsedModules]);

  const toggleModuleCollapse = (moduleId: string) => {
    setCollapsedModules(prev => {
      const newSet = new Set(prev);
      if (newSet.has(moduleId)) {
        newSet.delete(moduleId);
      } else {
        newSet.add(moduleId);
      }
      return newSet;
    });
  };

  // Fetch user module preferences
  const { data: modulePreferences } = useQuery({
    queryKey: ['/api/dashboards/modules'],
  });

  const selectedModules = modulePreferences?.selectedModules || [];

  // Fetch recent deals for detail panel
  const { data: recentDeals, isLoading: dealsLoading } = useQuery({
    queryKey: ['/api/crm/deals/recent', timeRange],
    queryFn: () => fetch(`/api/crm/deals/recent?timeRange=${timeRange}`).then(res => res.json()),
    enabled: isCRMDetailOpen,
  });

  // Fetch recent sales comps (filtered by selected year if not 'all') - always fetch for card display
  const { data: recentComps, isLoading: compsLoading } = useQuery({
    queryKey: ['/api/analysis/sales-comps/recent', timeRange, salesCompsYear],
    queryFn: () => {
      const params = new URLSearchParams({ timeRange });
      if (salesCompsYear !== 'all') {
        params.set('year', String(salesCompsYear));
      }
      return fetch(`/api/analysis/sales-comps/recent?${params.toString()}`).then(res => res.json());
    },
  });

  // Fetch year-filtered sales comps metrics using widget query engine
  const { data: salesCompsMetrics, isLoading: salesCompsMetricsLoading } = useQuery({
    queryKey: ['/api/dashboards/widgets/query', 'sales_comps', 'total_count', salesCompsYear],
    queryFn: async () => {
      const defaultResult = {
        totalComps: 0,
        compsTrend: undefined,
        avgPrice: 0,
        avgPriceTrend: undefined,
        avgPriceDataCount: 0,
        avgPriceTotalCount: 0,
        avgPricePerSlip: 0,
        avgPricePerSlipTrend: undefined,
        avgPricePerSlipDataCount: 0,
        avgPricePerSlipTotalCount: 0,
      };

      const fetchMetric = async (metricKey: string) => {
        const response = await apiRequest('POST', '/api/dashboards/widgets/query', {
          moduleKey: 'sales_comps',
          metricKey,
          filters: salesCompsYear !== 'all' ? { year: salesCompsYear } : {},
          options: {
            timeRangeType: salesCompsYear !== 'all' ? 'current_year' : 'all_time',
            enableComparison: true,
            comparisonType: 'yoy',
          },
        });
        const data = await response.json();
        const details = data.details?.[0] || {};
        return { 
          value: Number(data.value) || 0, 
          trend: data.trend,
          dataCount: Number(details.dataCount) || 0,
          totalCount: Number(details.totalCount) || 0,
        };
      };

      try {
        const countResult = await fetchMetric('total_count');
        const priceResult = await fetchMetric('avg_price');
        const pricePerSlipResult = await fetchMetric('avg_price_per_slip');

        return {
          totalComps: countResult.value,
          compsTrend: countResult.trend,
          avgPrice: priceResult.value,
          avgPriceTrend: priceResult.trend,
          avgPriceDataCount: priceResult.dataCount,
          avgPriceTotalCount: priceResult.totalCount,
          avgPricePerSlip: pricePerSlipResult.value,
          avgPricePerSlipTrend: pricePerSlipResult.trend,
          avgPricePerSlipDataCount: pricePerSlipResult.dataCount,
          avgPricePerSlipTotalCount: pricePerSlipResult.totalCount,
        };
      } catch (error) {
        console.error('Failed to fetch sales comps metrics:', error);
        return defaultResult;
      }
    },
    retry: 1,
  });

  // Fetch recent fuel transactions for detail panel
  const { data: recentFuelTxns, isLoading: fuelLoading } = useQuery({
    queryKey: ['/api/fuel/transactions/recent', timeRange],
    queryFn: () => fetch(`/api/fuel/transactions/recent?timeRange=${timeRange}`).then(res => res.json()),
    enabled: isFuelDetailOpen,
  });

  // Fetch recent DockTalk articles for detail panel
  const { data: recentArticles, isLoading: articlesLoading } = useQuery({
    queryKey: ['/api/docktalk/articles/recent', timeRange],
    queryFn: () => fetch(`/api/docktalk/articles/recent?timeRange=${timeRange}`).then(res => res.json()),
    enabled: isDockTalkDetailOpen,
  });

  // Fetch recent VDR documents for detail panel
  const { data: recentDocuments, isLoading: documentsLoading } = useQuery({
    queryKey: ['/api/vdr/documents/recent', timeRange],
    queryFn: () => fetch(`/api/vdr/documents/recent?timeRange=${timeRange}`).then(res => res.json()),
    enabled: isVDRDetailOpen,
  });

  // Fetch recent ship store transactions for detail panel
  const { data: recentShipStoreTxns, isLoading: shipStoreLoading } = useQuery({
    queryKey: ['/api/ship-store/transactions/recent', timeRange],
    queryFn: () => fetch(`/api/ship-store/transactions/recent?timeRange=${timeRange}`).then(res => res.json()),
    enabled: isShipStoreDetailOpen,
  });

  // Fetch recent DD tasks for detail panel
  const { data: recentDDTasks, isLoading: ddTasksLoading } = useQuery({
    queryKey: ['/api/projects/tasks/recent', timeRange],
    queryFn: () => fetch(`/api/projects/tasks/recent?timeRange=${timeRange}`).then(res => res.json()),
    enabled: isDDDetailOpen,
  });

  // Fetch recent rent roll entries for detail panel
  const { data: recentRentRoll, isLoading: rentRollLoading } = useQuery({
    queryKey: ['/api/rent-roll/entries/recent', timeRange],
    queryFn: () => fetch(`/api/rent-roll/entries/recent?timeRange=${timeRange}`).then(res => res.json()),
    enabled: isRentRollDetailOpen,
  });

  // Fetch recent modeling projects for detail panel
  const { data: recentModelingProjects, isLoading: modelingLoading } = useQuery({
    queryKey: ['/api/modeling/projects/recent', timeRange],
    queryFn: () => fetch(`/api/modeling/projects/recent?timeRange=${timeRange}`).then(res => res.json()),
    enabled: isModelingDetailOpen,
  });

  // Fetch marina analytics KPIs for dashboard
  const { data: marinaAnalyticsData, isLoading: analyticsLoading } = useQuery({
    queryKey: ['/api/analytics/marina/summary'],
    queryFn: () => fetch('/api/analytics/marina/summary').then(res => res.json()),
  });

  // Fetch custom modules
  const { data: customModulesData } = useQuery({
    queryKey: ['/api/dashboards/custom-modules'],
    queryFn: () => fetch('/api/dashboards/custom-modules').then(res => res.json()),
  });
  
  // Ensure customModules is always an array (API may return error object)
  const customModules = Array.isArray(customModulesData) ? customModulesData : [];

  // Create custom module mutation
  const createCustomModuleMutation = useMutation({
    mutationFn: async (data: { title: string; moduleType: string; filters: Record<string, any> }) => {
      return await apiRequest('/api/dashboards/custom-modules', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: async (newModule) => {
      // Automatically add new custom module to selected modules and layout order
      const customModuleId = `custom-${newModule.id}`;
      const updatedSelection = [...selectedModules, customModuleId];
      const updatedOrder = [...moduleOrder, customModuleId];
      
      // Update both caches optimistically
      queryClient.setQueryData(['/api/dashboards/modules'], { selectedModules: updatedSelection });
      
      // Update local state immediately for instant rendering
      setModuleOrder(updatedOrder);
      
      // Save both selection and layout order to backend
      await Promise.all([
        saveModulesMutation.mutateAsync(updatedSelection),
        saveLayoutMutation.mutateAsync(updatedOrder),
      ]);
      
      // Only invalidate custom modules query to get the fresh module data
      // Don't invalidate layout or modules as we just saved them
      queryClient.invalidateQueries({ queryKey: ['/api/dashboards/custom-modules'] });
      
      toast({
        title: 'Custom module created',
        description: 'Your custom module has been added to the dashboard',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to create custom module',
        variant: 'destructive',
      });
    },
  });

  // Delete custom module mutation
  const deleteCustomModuleMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest(`/api/dashboards/custom-modules/${id}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/dashboards/custom-modules'] });
      toast({
        title: 'Custom module deleted',
        description: 'The custom module has been removed',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to delete custom module',
        variant: 'destructive',
      });
    },
  });

  // Save module preferences mutation
  const saveModulesMutation = useMutation({
    mutationFn: async (modules: string[]) => {
      return await apiRequest('/api/dashboards/modules', {
        method: 'PUT',
        body: JSON.stringify({ selectedModules: modules }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/dashboards/modules'] });
      toast({
        title: 'Dashboard updated',
        description: 'Your module preferences have been saved',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to save module preferences',
        variant: 'destructive',
      });
    },
  });

  const handleToggleModule = (moduleId: string) => {
    const newSelection = selectedModules.includes(moduleId)
      ? selectedModules.filter((id: string) => id !== moduleId)
      : [...selectedModules, moduleId];
    saveModulesMutation.mutate(newSelection);
  };
  
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const DEFAULT_MODULE_ORDER = [
    'crm-pipeline',
    'due-diligence',
    'sales-comps',
    'vdr-activity',
    'docktalk-feed',
    'marina-analytics',
    'fuel-operations',
    'ship-store',
    'rent-roll',
    'modeling-projects',
  ];

  const { data: dashboardData, isLoading } = useQuery({
    queryKey: ['/api/dashboards/data', timeRange, selectedModules],
    queryFn: () => {
      const modules = selectedModules.length > 0 ? selectedModules.join(',') : 'all';
      return fetch(`/api/dashboards/data?timeRange=${timeRange}&modules=${modules}`).then(res => res.json());
    },
    enabled: selectedModules.length > 0 || modulePreferences !== undefined,
  });

  const { data: layoutData } = useQuery({
    queryKey: ['/api/dashboards/layout'],
  });

  const [moduleOrder, setModuleOrder] = useState<string[]>(DEFAULT_MODULE_ORDER);

  // Load saved layout on mount
  useEffect(() => {
    if (layoutData?.layout) {
      const savedOrder = layoutData.layout.map((item: any) => item.widgetKey);
      if (savedOrder.length > 0) {
        setModuleOrder(savedOrder);
      }
    }
  }, [layoutData]);

  const saveLayoutMutation = useMutation({
    mutationFn: async (order: string[]) => {
      const layout = order.map((widgetKey, index) => ({
        widgetKey,
        position: { x: index % 3, y: Math.floor(index / 3) },
        size: { width: 1, height: 1 },
        config: {},
      }));

      return apiRequest('PUT', '/api/dashboards/layout', {
        personaTemplate: null,
        layout,
        isDefault: true,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/dashboards/layout'] });
      toast({
        title: "Layout saved",
        description: "Your dashboard layout has been saved.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save dashboard layout",
        variant: "destructive",
      });
    },
  });

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (over && active.id !== over.id) {
      setModuleOrder((items) => {
        const oldIndex = items.indexOf(active.id as string);
        const newIndex = items.indexOf(over.id as string);
        
        const newItems = [...items];
        newItems.splice(oldIndex, 1);
        newItems.splice(newIndex, 0, active.id as string);
        
        // Save layout after reordering
        saveLayoutMutation.mutate(newItems);
        
        return newItems;
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 overflow-auto bg-gray-50" data-testid="page-dashboard">
        <div className="container mx-auto p-6 max-w-7xl">
          <div className="flex items-center justify-between mb-6">
            <div>
              <Skeleton className="h-8 w-48 mb-2" />
              <Skeleton className="h-4 w-96" />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-64" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const modules: DashboardModule[] = [
    {
      id: 'crm-pipeline',
      title: 'CRM Pipeline Overview',
      icon: DollarSign,
      link: '/crm/deals',
      data: dashboardData?.crm,
      renderContent: (data) => (
        <div className="space-y-4">
          <MetricGrid columns={2}>
            <EnhancedMetricCard
              label="Pipeline Value"
              value={data?.pipelineValue || 0}
              type="currency"
              size="md"
              variant="primary"
              icon={DollarSign}
              compact={true}
              testId="crm-pipeline-value"
              tooltip="Total value of all active deals across pipeline stages"
              onClick={() => setIsCRMDetailOpen(true)}
              clickable
              trend={data?.pipelineValueTrend}
              trendLabel={timeRange === '7d' ? 'vs last week' : timeRange === '30d' ? 'vs last month' : timeRange === '90d' ? 'vs last quarter' : 'vs last year'}
            />
            <EnhancedMetricCard
              label="Active Deals"
              value={data?.activeDeals || 0}
              type="number"
              size="md"
              icon={Users}
              testId="crm-active-deals"
              tooltip="Number of deals currently in progress"
              onClick={() => setIsCRMDetailOpen(true)}
              clickable
              badge={data?.newDeals ? `+${data.newDeals} new` : undefined}
            />
            <EnhancedMetricCard
              label="Win Rate"
              value={data?.winRate || 0}
              type="percent"
              size="md"
              variant="success"
              icon={TrendingUp}
              testId="crm-win-rate"
              tooltip="Percentage of deals won vs total closed deals"
              onClick={() => setIsCRMDetailOpen(true)}
              clickable
              trend={data?.winRateTrend}
            />
            <EnhancedMetricCard
              label="Won This Period"
              value={data?.wonDeals || 0}
              type="number"
              size="md"
              testId="crm-won-deals"
              tooltip="Successfully closed deals in selected timeframe"
              onClick={() => setIsCRMDetailOpen(true)}
              clickable
              comparison={{
                label: 'Total Value',
                value: data?.wonValue || 0,
                type: 'currency'
              }}
            />
          </MetricGrid>
          <CRMCharts timeRange={timeRange} />
        </div>
      ),
    },
    {
      id: 'due-diligence',
      title: 'Due Diligence Tracker',
      icon: FileText,
      link: '/projects',
      data: dashboardData?.dueDiligence,
      renderContent: (data) => (
        <div className="space-y-4">
          <MetricGrid columns={2}>
            <EnhancedMetricCard
              label="Active Projects"
              value={data?.activeProjects || 0}
              type="number"
              size="md"
              variant="primary"
              icon={FileText}
              testId="dd-active-projects"
              tooltip="Currently active due diligence projects"
              onClick={() => setIsDDDetailOpen(true)}
              clickable
              badge={data?.criticalProjects ? `${data.criticalProjects} critical` : undefined}
            />
            <EnhancedMetricCard
              label="Completion Rate"
              value={data?.completionRate || 0}
              type="percent"
              size="md"
              variant="success"
              testId="dd-completion-rate"
              tooltip="Percentage of projects successfully completed"
              onClick={() => setIsDDDetailOpen(true)}
              clickable
              trend={data?.completionRateTrend}
            />
          </MetricGrid>
          {data?.activeProjects > 0 && (
            <ModuleSection title="Project Status" description="Active project breakdown">
              <div className="space-y-3">
                <StatBar
                  label="Completed"
                  value={data?.completedProjects || 0}
                  total={data?.totalProjects || 1}
                  color="green"
                />
                <StatBar
                  label="In Progress"
                  value={data?.activeProjects || 0}
                  total={data?.totalProjects || 1}
                  color="blue"
                />
                <StatBar
                  label="On Hold"
                  value={data?.onHoldProjects || 0}
                  total={data?.totalProjects || 1}
                  color="amber"
                />
              </div>
            </ModuleSection>
          )}
        </div>
      ),
    },
    {
      id: 'sales-comps',
      title: 'Sales Comps',
      icon: TrendingUp,
      link: '/analysis/sales-comps/analytics',
      data: dashboardData?.salesComps,
      renderContent: (data) => {
        const displayMetrics = salesCompsMetrics || data;
        const yearOptions = Array.from({ length: 10 }, (_, i) => currentYear - i);
        
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-gray-500" />
                <span className="text-xs text-gray-600">Filter by Year</span>
              </div>
              <Select
                value={String(salesCompsYear)}
                onValueChange={(value) => setSalesCompsYear(value === 'all' ? 'all' : parseInt(value))}
              >
                <SelectTrigger className="w-[100px] h-7 text-xs" data-testid="sales-comps-year-filter">
                  <SelectValue placeholder="Year" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Time</SelectItem>
                  {yearOptions.map((year) => (
                    <SelectItem key={year} value={String(year)}>{year}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {salesCompsMetricsLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
              </div>
            ) : (
              <MetricGrid columns={2}>
                <EnhancedMetricCard
                  label={salesCompsYear === 'all' ? 'Total Comps' : `${salesCompsYear} Comps`}
                  value={displayMetrics?.totalComps || 0}
                  type="number"
                  size="md"
                  variant="primary"
                  icon={TrendingUp}
                  testId="comps-total"
                  tooltip={salesCompsYear === 'all' ? 'Total sales comparables' : `Number of sales comparables in ${salesCompsYear}`}
                  onClick={() => setIsSalesCompsDetailOpen(true)}
                  clickable={true}
                  trend={displayMetrics?.compsTrend}
                  trendLabel={salesCompsYear === 'all' ? 'overall' : 'vs prior year'}
                />
                <EnhancedMetricCard
                  label="Avg. Sale Price"
                  value={displayMetrics?.avgPrice || 0}
                  type="currency"
                  size="md"
                  testId="comps-avg-price"
                  tooltip={salesCompsYear === 'all' ? 'Average sale price across all comparables' : `Average sale price in ${salesCompsYear}`}
                  onClick={() => setIsSalesCompsDetailOpen(true)}
                  clickable={true}
                  trend={displayMetrics?.avgPriceTrend}
                  trendLabel={salesCompsYear === 'all' ? 'overall' : 'vs prior year'}
                  subtitle={displayMetrics?.avgPriceTotalCount > 0 ? `Based on ${displayMetrics.avgPriceDataCount} of ${displayMetrics.avgPriceTotalCount} deals with pricing data` : undefined}
                />
              </MetricGrid>
            )}
            {recentComps && recentComps.length > 0 && (
              <ModuleSection title="Recent Sales" description={salesCompsYear === 'all' ? 'Most recent sales by date' : `Most recent ${salesCompsYear} sales`}>
                <DataList
                  items={recentComps.slice(0, 3).map((comp: any) => {
                    const price = comp.salePrice || comp.estimatedPurchasePrice;
                    const isEstimated = !comp.salePrice && comp.estimatedPurchasePrice;
                    return {
                      label: comp.marina || 'Unnamed Marina',
                      value: price ? `${formatCurrency(price)}${isEstimated ? ' (Est.)' : ''}` : 'N/A',
                      badge: comp.saleMonth && comp.saleYear ? `${comp.saleMonth}/${comp.saleYear}` : comp.state?.substring(0, 2).toUpperCase(),
                    };
                  })}
                  maxItems={3}
                />
              </ModuleSection>
            )}
          </div>
        );
      },
    },
    {
      id: 'vdr-activity',
      title: 'VDR Activity Monitor',
      icon: Database,
      link: '/vdr',
      data: dashboardData?.vdr,
      renderContent: (data) => (
        <div className="space-y-4">
          <MetricGrid columns={2}>
            <EnhancedMetricCard
              label="Active Data Rooms"
              value={data?.activeDataRooms || 0}
              type="number"
              size="md"
              variant="primary"
              icon={Database}
              testId="vdr-active-rooms"
              tooltip="Number of active virtual data rooms"
              onClick={() => setIsVDRDetailOpen(true)}
              clickable
            />
            <EnhancedMetricCard
              label="Total Documents"
              value={data?.totalDocuments || 0}
              type="number"
              size="md"
              testId="vdr-total-docs"
              tooltip="Total documents uploaded across all data rooms"
              onClick={() => setIsVDRDetailOpen(true)}
              clickable
              badge={data?.recentUploads ? `+${data.recentUploads} today` : undefined}
            />
          </MetricGrid>
          <EnhancedMetricCard
            label="Pending Requests"
            value={data?.pendingRequests || 0}
            type="number"
            size="md"
            variant={data?.pendingRequests > 5 ? "warning" : "default"}
            icon={FileText}
            testId="vdr-pending-requests"
            tooltip="Diligence requests awaiting response"
            onClick={() => setIsVDRDetailOpen(true)}
            clickable
            comparison={{
              label: 'Overdue',
              value: data?.overdueRequests || 0,
              type: 'number'
            }}
          />
        </div>
      ),
    },
    {
      id: 'docktalk-feed',
      title: 'DockTalk Intelligence',
      icon: Radio,
      link: '/docktalk',
      data: dashboardData?.docktalk,
      renderContent: (data) => (
        <div className="space-y-4">
          <EnhancedMetricCard
            label="M&A Deals Tracked"
            value={data?.totalDeals || 0}
            type="number"
            size="md"
            variant="primary"
            icon={Radio}
            testId="docktalk-deals-count"
            tooltip="Total marina M&A deals tracked in the system"
            onClick={() => setIsDockTalkDetailOpen(true)}
            clickable
            badge={data?.newDeals ? `+${data.newDeals} new` : undefined}
            subtitle="deals in database"
          />
          {data?.recentDeals && data.recentDeals.length > 0 && (
            <ModuleSection title="Latest Transactions" description="Most recent M&A activity">
              <DataList
                items={data.recentDeals.slice(0, 3).map((deal: any) => ({
                  label: deal.marinaName || deal.dealDescription || 'Unnamed Deal',
                  value: deal.dealDate ? new Date(deal.dealDate).toLocaleDateString() : 'Recent',
                  badge: deal.dealType || 'M&A',
                }))}
                maxItems={3}
              />
            </ModuleSection>
          )}
        </div>
      ),
    },
    {
      id: 'marina-analytics',
      title: 'Marina Analytics',
      icon: Activity,
      link: '/rent-roll',
      data: marinaAnalyticsData,
      renderContent: (data) => (
        <div className="space-y-4">
          <MetricGrid columns={2}>
            <EnhancedMetricCard
              label="Occupancy Rate"
              value={data?.occupancyRate || 0}
              type="percent"
              size="md"
              variant={data?.occupancyRate >= 85 ? "success" : data?.occupancyRate >= 70 ? "warning" : "default"}
              icon={Activity}
              testId="analytics-occupancy"
              tooltip="Percentage of slips currently occupied"
              onClick={() => setIsAnalyticsDetailOpen(true)}
              clickable
              comparison={{
                label: 'Slips',
                value: `${data?.occupiedSlips || 0}/${data?.totalSlips || 0}`,
                type: 'text'
              }}
            />
            <EnhancedMetricCard
              label="ADR"
              value={data?.adr || 0}
              type="currency"
              size="md"
              variant="primary"
              icon={DollarSign}
              testId="analytics-adr"
              tooltip="Average Daily Rate per occupied slip"
              onClick={() => setIsAnalyticsDetailOpen(true)}
              clickable
              subtitle="per slip/day"
            />
          </MetricGrid>
          <MetricGrid columns={2}>
            <EnhancedMetricCard
              label="NOI Margin"
              value={data?.noiMargin || 0}
              type="percent"
              size="sm"
              variant={data?.noiMargin >= 60 ? "success" : data?.noiMargin >= 50 ? "warning" : "default"}
              compact={true}
              testId="analytics-noi-margin"
              tooltip="Net Operating Income as percentage of gross revenue"
              onClick={() => setIsAnalyticsDetailOpen(true)}
              clickable
            />
            <EnhancedMetricCard
              label="DSCR"
              value={data?.dscr || 0}
              type="number"
              size="sm"
              variant={data?.dscr >= 1.5 ? "success" : data?.dscr >= 1.2 ? "warning" : "default"}
              compact={true}
              testId="analytics-dscr"
              tooltip="Debt Service Coverage Ratio (NOI / Debt Service)"
              onClick={() => setIsAnalyticsDetailOpen(true)}
              clickable
              subtitle="x coverage"
            />
          </MetricGrid>
          <MetricGrid columns={2}>
            <EnhancedMetricCard
              label="Gross Revenue"
              value={data?.grossRevenue || 0}
              type="currency"
              size="sm"
              compact={true}
              testId="analytics-revenue"
              tooltip="Total gross revenue including slip rental and ancillary income"
              onClick={() => setIsAnalyticsDetailOpen(true)}
              clickable
            />
            <EnhancedMetricCard
              label="Ancillary Revenue"
              value={data?.ancillaryRevenue || 0}
              type="currency"
              size="sm"
              variant="primary"
              compact={true}
              testId="analytics-ancillary"
              tooltip="Non-slip revenue (fuel, store, services)"
              onClick={() => setIsAnalyticsDetailOpen(true)}
              clickable
            />
          </MetricGrid>
          {data?.dataQualityScore !== undefined && (
            <div className="pt-2 border-t">
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-500">Data Quality Score</span>
                <span className={`font-medium ${data.dataQualityScore >= 70 ? 'text-green-600' : data.dataQualityScore >= 40 ? 'text-amber-600' : 'text-red-600'}`}>
                  {data.dataQualityScore}/100
                </span>
              </div>
            </div>
          )}
        </div>
      ),
    },
    {
      id: 'fuel-operations',
      title: 'Fuel Operations',
      icon: Fuel,
      link: '/fuel',
      data: dashboardData?.fuel,
      renderContent: (data) => (
        <div className="space-y-4">
          <MetricGrid columns={2}>
            <EnhancedMetricCard
              label="Total Revenue"
              value={data?.monthlyRevenue || 0}
              type="currency"
              size="md"
              variant="success"
              icon={DollarSign}
              compact={true}
              testId="fuel-revenue"
              tooltip="Total fuel sales revenue for the selected period"
              onClick={() => setIsFuelDetailOpen(true)}
              clickable={true}
              trend={data?.revenueTrend}
              trendLabel={timeRange === '7d' ? 'vs last week' : timeRange === '30d' ? 'vs last month' : timeRange === '90d' ? 'vs last quarter' : 'vs last year'}
            />
            <EnhancedMetricCard
              label="Volume Sold"
              value={data?.monthlyGallons || 0}
              type="number"
              size="md"
              icon={Fuel}
              compact={true}
              testId="fuel-gallons"
              tooltip="Total fuel gallons sold in the selected period"
              onClick={() => setIsFuelDetailOpen(true)}
              clickable={true}
              subtitle="gallons"
              comparison={{
                label: 'Avg $/gal',
                value: data?.avgPricePerGallon || 0,
                type: 'currency'
              }}
            />
          </MetricGrid>
          <RevenueCharts module="fuel" timeRange={timeRange} />
        </div>
      ),
    },
    {
      id: 'ship-store',
      title: 'Ship Store Performance',
      icon: ShoppingCart,
      link: '/ship-store',
      data: dashboardData?.shipStore,
      renderContent: (data) => (
        <div className="space-y-4">
          <MetricGrid columns={2}>
            <EnhancedMetricCard
              label="Total Sales"
              value={data?.monthlyRevenue || 0}
              type="currency"
              size="md"
              variant="success"
              icon={DollarSign}
              compact={true}
              testId="ship-store-revenue"
              tooltip="Total ship store sales revenue for selected period"
              onClick={() => setIsShipStoreDetailOpen(true)}
              clickable
              trend={data?.revenueTrend}
            />
            <EnhancedMetricCard
              label="Transactions"
              value={data?.monthlyTransactions || 0}
              type="number"
              size="md"
              icon={ShoppingCart}
              compact={true}
              testId="ship-store-transactions"
              tooltip="Number of completed transactions"
              onClick={() => setIsShipStoreDetailOpen(true)}
              clickable
              comparison={{
                label: 'Avg Value',
                value: data?.avgTransaction || 0,
                type: 'currency'
              }}
            />
          </MetricGrid>
          <MetricGrid columns={2}>
            <EnhancedMetricCard
              label="Inventory Value"
              value={data?.inventoryValue || 0}
              type="currency"
              size="sm"
              variant="primary"
              compact={true}
              testId="ship-store-inventory"
              tooltip="Current total inventory value at cost"
              onClick={() => setIsShipStoreDetailOpen(true)}
              clickable
            />
            <EnhancedMetricCard
              label="Low Stock Items"
              value={data?.lowStockItems || 0}
              type="number"
              size="sm"
              variant={data?.lowStockItems > 10 ? "warning" : "default"}
              testId="ship-store-low-stock"
              tooltip="Products below minimum stock threshold"
              onClick={() => setIsShipStoreDetailOpen(true)}
              clickable
            />
          </MetricGrid>
          <RevenueCharts module="shipStore" timeRange={timeRange} />
        </div>
      ),
    },
    {
      id: 'rent-roll',
      title: 'Rent Roll Overview',
      icon: Home,
      link: '/rent-roll',
      data: dashboardData?.rentRoll,
      renderContent: (data) => (
        <div className="space-y-4">
          <MetricGrid columns={2}>
            <EnhancedMetricCard
              label="Total Units"
              value={data?.totalUnits || 0}
              type="number"
              size="md"
              variant="primary"
              icon={Home}
              testId="rent-roll-units"
              tooltip="Total number of rental units in portfolio"
              onClick={() => setIsRentRollDetailOpen(true)}
              clickable
              comparison={{
                label: 'Occupied',
                value: (data?.totalUnits || 0) - (data?.vacantUnits || 0),
                type: 'number'
              }}
            />
            <EnhancedMetricCard
              label="Occupancy Rate"
              value={data?.occupancyRate || 0}
              type="percent"
              size="md"
              variant="success"
              icon={TrendingUp}
              testId="rent-roll-occupancy"
              tooltip="Percentage of units currently occupied"
              onClick={() => setIsRentRollDetailOpen(true)}
              clickable
              trend={data?.occupancyTrend}
            />
          </MetricGrid>
          <MetricGrid columns={2}>
            <EnhancedMetricCard
              label="Monthly Income"
              value={data?.monthlyIncome || 0}
              type="currency"
              size="sm"
              compact={true}
              testId="rent-roll-income"
              tooltip="Total monthly rental income from all units"
              onClick={() => setIsRentRollDetailOpen(true)}
              clickable
            />
            <EnhancedMetricCard
              label="Vacant Units"
              value={data?.vacantUnits || 0}
              type="number"
              size="sm"
              variant={data?.vacantUnits > 5 ? "warning" : "default"}
              testId="rent-roll-vacant"
              tooltip="Number of currently vacant units"
              onClick={() => setIsRentRollDetailOpen(true)}
              clickable
              badge={data?.vacantUnits > 0 && data?.totalUnits ? `${((data.vacantUnits / data.totalUnits) * 100).toFixed(0)}%` : undefined}
            />
          </MetricGrid>
        </div>
      ),
    },
    {
      id: 'modeling-projects',
      title: 'Modeling Projects',
      icon: BarChart3,
      link: '/modeling',
      data: dashboardData?.modeling,
      renderContent: (data) => (
        <div className="space-y-4">
          <MetricGrid columns={2}>
            <EnhancedMetricCard
              label="Active Models"
              value={data?.activeProjects || 0}
              type="number"
              size="md"
              variant="primary"
              icon={BarChart3}
              testId="modeling-active"
              tooltip="Currently active modeling projects"
              onClick={() => setIsModelingDetailOpen(true)}
              clickable
            />
            <EnhancedMetricCard
              label="Completed"
              value={data?.completedProjects || 0}
              type="number"
              size="md"
              variant="success"
              testId="modeling-completed"
              tooltip="Successfully completed modeling projects"
              onClick={() => setIsModelingDetailOpen(true)}
              clickable
              trend={data?.completionTrend}
            />
          </MetricGrid>
          <EnhancedMetricCard
            label="Total Valuation"
            value={data?.totalValuation || 0}
            type="currency"
            size="md"
            variant="success"
            icon={DollarSign}
            compact={true}
            testId="modeling-valuation"
            tooltip="Aggregate valuation across all modeling projects"
            onClick={() => setIsModelingDetailOpen(true)}
            clickable
            comparison={{
              label: 'Avg per Project',
              value: (data?.totalValuation || 0) / (data?.activeProjects || 1),
              type: 'currency'
            }}
          />
        </div>
      ),
    },
  ];

  // Add custom modules dynamically - include all active custom modules
  const customModuleDefinitions: DashboardModule[] = customModules
    .filter(cm => cm.isActive !== false) // Include all active custom modules
    .map(cm => ({
      id: `custom-${cm.id}`,
      title: cm.title,
      icon: FileText, // Default icon for custom modules
      link: getModuleLink(cm.moduleType),
      data: null, // Will be fetched per module
      renderContent: () => (
        <CustomModuleContent 
          moduleId={cm.id}
          moduleType={cm.moduleType}
          visualizationType={cm.visualizationType}
          chartConfig={cm.chartConfig}
          filters={cm.filters}
        />
      ),
    }));

  // Merge predefined and custom modules
  const allModules = [...modules, ...customModuleDefinitions];

  // Filter modules based on user preferences (custom modules are always visible when active)
  const customModuleIds = customModuleDefinitions.map(cm => cm.id);
  const visibleModules = selectedModules.length > 0 
    ? allModules.filter(m => selectedModules.includes(m.id) || customModuleIds.includes(m.id))
    : allModules;

  // Ensure custom modules are included in ordering
  const extendedModuleOrder = [...moduleOrder, ...customModuleIds.filter(id => !moduleOrder.includes(id))];

  const orderedModules = extendedModuleOrder
    .map(id => visibleModules.find(m => m.id === id))
    .filter(Boolean) as DashboardModule[];

  return (
    <div className="flex-1 overflow-auto bg-gray-50" data-testid="page-dashboard">
      <div className="container mx-auto p-4 sm:p-6 max-w-7xl">
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">MarinaMatch Dashboard</h1>
            <p className="text-sm sm:text-base text-gray-600 mt-1">
              Your comprehensive marina acquisition intelligence platform
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
            <ExportMenu 
              timeRange={timeRange}
              selectedModules={selectedModules}
            />
            <Button
              size="sm"
              onClick={() => setIsAddModuleModalOpen(true)}
              data-testid="button-customize-dashboard"
              className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700"
            >
              <Plus className="h-4 w-4 mr-2" />
              Customize Dashboard
            </Button>
            <SavedLayoutsPanel
              currentModuleOrder={moduleOrder}
              currentCollapsedModules={Array.from(collapsedModules)}
              currentVisibleModules={selectedModules}
              onLoadLayout={(layoutData) => {
                if (layoutData.moduleOrder) {
                  setModuleOrder(layoutData.moduleOrder);
                }
                if (layoutData.collapsedModules) {
                  setCollapsedModules(new Set(layoutData.collapsedModules));
                }
                if (layoutData.visibleModules) {
                  queryClient.setQueryData(['/api/dashboards/modules'], { selectedModules: layoutData.visibleModules });
                  saveModulesMutation.mutate(layoutData.visibleModules);
                }
                queryClient.invalidateQueries({ queryKey: ['/api/dashboards/data'] });
                queryClient.invalidateQueries({ queryKey: ['/api/dashboards/widgets/query'] });
              }}
            />
            <TimeRangeSelector value={timeRange} onChange={setTimeRange} />
          </div>
        </div>

        {/* Fund Context Selector - Shows current fund and key metrics */}
        <div className="mb-6">
          <DashboardPersonaHeader />
        </div>

        {/* Quick Access - Always at top */}
        <div className="mb-6">
          <QuickAccessSection />
        </div>

        {/* KPI Modules - User customizable modules in the middle */}
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={extendedModuleOrder} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {orderedModules.map((module) => (
                <SortableModule 
                  key={module.id} 
                  module={module} 
                  isCollapsed={collapsedModules.has(module.id)}
                  onToggleCollapse={() => toggleModuleCollapse(module.id)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>

        {/* Period Comparison - Collapsible section at bottom */}
        <div className="mt-6">
          <ComparisonModule 
            isCollapsed={isPeriodComparisonCollapsed}
            onToggleCollapse={() => setIsPeriodComparisonCollapsed(!isPeriodComparisonCollapsed)}
          />
        </div>

        <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-xs sm:text-sm text-blue-800">
            <strong>Tip:</strong> <span className="hidden sm:inline">Drag and drop modules to rearrange your dashboard.</span> Click the external link icon to navigate to the full page for detailed analysis.
          </p>
        </div>
      </div>

      <AddModuleModal
        open={isAddModuleModalOpen}
        onOpenChange={setIsAddModuleModalOpen}
        selectedModules={selectedModules}
        onToggleModule={handleToggleModule}
        customModules={customModules}
        onCreateCustomModule={(data) => createCustomModuleMutation.mutate(data)}
        onDeleteCustomModule={(id) => deleteCustomModuleMutation.mutate(id)}
        onSaveWidget={async (widgetData) => {
          console.log('Widget saved:', widgetData);
          toast({
            title: 'Widget Created',
            description: `Your custom widget "${widgetData.title}" has been created.`,
          });
        }}
      />

      <DetailPanel
        open={isCRMDetailOpen}
        onOpenChange={setIsCRMDetailOpen}
        title="CRM Pipeline Details"
        description={`${recentDeals?.length || 0} deals found in the selected time period`}
        icon={DollarSign}
        sourceLink={`/crm/deals?timeRange=${timeRange}&status=open`}
        sourceLinkText="Go to CRM"
        actions={
          <Link href="/crm/deals/new">
            <Button size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Create Deal
            </Button>
          </Link>
        }
      >
        <EnhancedDataTable
          data={recentDeals || []}
          columns={[
            {
              key: 'title',
              header: 'Deal Name',
              sortable: true,
              render: (deal: any) => (
                <div className="font-medium text-gray-900">{deal.title}</div>
              ),
            },
            {
              key: 'value',
              header: 'Value',
              sortable: true,
              render: (deal: any) => (
                <div className="text-gray-900 font-semibold">
                  {formatCurrency(Number(deal.value || 0))}
                </div>
              ),
            },
            {
              key: 'stage',
              header: 'Stage',
              sortable: true,
              render: (deal: any) => {
                const stageColors: Record<string, string> = {
                  lead: 'bg-gray-100 text-gray-800',
                  qualified: 'bg-blue-100 text-blue-800',
                  proposal: 'bg-purple-100 text-purple-800',
                  negotiation: 'bg-yellow-100 text-yellow-800',
                  closed_won: 'bg-green-100 text-green-800',
                  closed_lost: 'bg-red-100 text-red-800',
                };
                return (
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${stageColors[deal.stage] || 'bg-gray-100 text-gray-800'}`}>
                    {deal.stage?.replace('_', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                  </span>
                );
              },
            },
            {
              key: 'probability',
              header: 'Probability',
              sortable: true,
              render: (deal: any) => (
                <div className="flex items-center gap-2">
                  <div className="text-gray-700 font-medium">{deal.probability || 0}%</div>
                  <div className="flex-1 max-w-[60px] bg-gray-200 rounded-full h-1.5">
                    <div 
                      className="bg-blue-600 h-1.5 rounded-full" 
                      style={{ width: `${deal.probability || 0}%` }}
                    ></div>
                  </div>
                </div>
              ),
            },
            {
              key: 'createdAt',
              header: 'Created',
              sortable: true,
              render: (deal: any) => (
                <div className="text-gray-600 text-sm">
                  {deal.createdAt ? new Date(deal.createdAt).toLocaleDateString() : '-'}
                </div>
              ),
            },
          ]}
          onRowClick={(deal: any) => { setIsCRMDetailOpen(false); navigate(`/crm/deals/${deal.id}`); }}
          getRowLink={(deal: any) => `/crm/deals/${deal.id}`}
          emptyMessage="No deals found for the selected time period"
          isLoading={dealsLoading}
          searchable={true}
          searchPlaceholder="Search deals..."
          filters={[
            {
              key: 'stage',
              label: 'Stage',
              options: [
                { value: 'lead', label: 'Lead' },
                { value: 'qualified', label: 'Qualified' },
                { value: 'proposal', label: 'Proposal' },
                { value: 'negotiation', label: 'Negotiation' },
                { value: 'closed_won', label: 'Closed Won' },
                { value: 'closed_lost', label: 'Closed Lost' },
              ],
            },
          ]}
          pageSize={25}
        />
      </DetailPanel>

      <DetailPanel
        open={isSalesCompsDetailOpen}
        onOpenChange={setIsSalesCompsDetailOpen}
        title={salesCompsYear === 'all' ? 'Sales Comps Details' : `${salesCompsYear} Sales Comps`}
        description={salesCompsYear === 'all' ? 'All marina sales comparables' : `Marina sales comparables from ${salesCompsYear}`}
        icon={TrendingUp}
        sourceLink={`/analysis/sales-comps/analytics?timeRange=${timeRange}`}
        sourceLinkText="Go to Sales Comps"
        actions={
          <Link href="/analysis/sales-comps/new">
            <Button size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Comp
            </Button>
          </Link>
        }
      >
        {compsLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full"></div>
          </div>
        ) : (
          <DataTable
            data={recentComps || []}
            columns={[
              {
                key: 'marina',
                header: 'Marina',
                render: (comp: any) => (
                  <div className="font-medium">{comp.marina || 'Unnamed'}</div>
                ),
              },
              {
                key: 'location',
                header: 'Location',
                render: (comp: any) => (
                  <div className="text-gray-600">{comp.city}, {comp.state}</div>
                ),
              },
              {
                key: 'saleDate',
                header: 'Sale Date',
                render: (comp: any) => {
                  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
                  if (comp.saleMonth && comp.saleYear) {
                    return <div className="text-gray-600">{months[comp.saleMonth - 1]} {comp.saleYear}</div>;
                  } else if (comp.saleYear) {
                    return <div className="text-gray-600">{comp.saleYear}</div>;
                  }
                  return <div className="text-gray-400">N/A</div>;
                },
              },
              {
                key: 'salePrice',
                header: 'Sale Price',
                render: (comp: any) => {
                  const price = comp.salePrice || comp.estimatedPurchasePrice;
                  const isEstimated = !comp.salePrice && comp.estimatedPurchasePrice;
                  return (
                    <div className="text-gray-900 font-semibold">
                      {price ? formatCurrency(Number(price)) : 'N/A'}
                      {isEstimated && <span className="text-xs text-amber-600 ml-1">(Est.)</span>}
                    </div>
                  );
                },
              },
              {
                key: 'capRate',
                header: 'Cap Rate',
                render: (comp: any) => (
                  <div className="text-gray-600">{comp.capRate ? `${Number(comp.capRate).toFixed(2)}%` : 'N/A'}</div>
                ),
              },
              {
                key: 'broker',
                header: 'Broker',
                render: (comp: any) => (
                  <div className="text-gray-600">{comp.broker || 'N/A'}</div>
                ),
              },
            ]}
            onRowClick={(comp: any) => { setIsSalesCompsDetailOpen(false); navigate(`/analysis/sales-comps/${comp.id}`); }}
            getRowLink={(comp: any) => `/analysis/sales-comps/${comp.id}`}
            emptyMessage="No recent sales comps found"
          />
        )}
      </DetailPanel>

      <DetailPanel
        open={isFuelDetailOpen}
        onOpenChange={setIsFuelDetailOpen}
        title="Fuel Transactions"
        description="Recent fuel sales activity"
        icon={Fuel}
        sourceLink={`/fuel/transactions?timeRange=${timeRange}`}
        sourceLinkText="Go to Fuel"
        actions={
          <Link href="/fuel/transactions/new">
            <Button size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Record Sale
            </Button>
          </Link>
        }
      >
        {fuelLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full"></div>
          </div>
        ) : (
          <DataTable
            data={recentFuelTxns || []}
            columns={[
              {
                key: 'transactionDate',
                header: 'Date',
                render: (txn: any) => (
                  <div className="font-medium">{new Date(txn.transactionDate).toLocaleDateString()}</div>
                ),
              },
              {
                key: 'customerName',
                header: 'Customer',
                render: (txn: any) => (
                  <div className="text-gray-600">{txn.customerName || 'Walk-in'}</div>
                ),
              },
              {
                key: 'fuelType',
                header: 'Fuel Type',
                render: (txn: any) => (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                    {txn.fuelType}
                  </span>
                ),
              },
              {
                key: 'gallons',
                header: 'Gallons',
                render: (txn: any) => (
                  <div className="text-gray-600">{formatNumber(Number(txn.gallons || 0))}</div>
                ),
              },
              {
                key: 'totalAmount',
                header: 'Total',
                render: (txn: any) => (
                  <div className="text-gray-900 font-semibold">
                    {formatCurrency(Number(txn.totalAmount || 0))}
                  </div>
                ),
              },
            ]}
            onRowClick={(txn: any) => { setIsFuelDetailOpen(false); navigate(`/fuel/transactions/${txn.id}`); }}
            getRowLink={(txn: any) => `/fuel/transactions/${txn.id}`}
            emptyMessage="No recent fuel transactions found"
          />
        )}
      </DetailPanel>

      <DetailPanel
        open={isDockTalkDetailOpen}
        onOpenChange={setIsDockTalkDetailOpen}
        title="DockTalk Articles"
        description="Recent marina industry news and insights"
        icon={Radio}
        sourceLink="/docktalk"
        sourceLinkText="Go to DockTalk"
      >
        {articlesLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full"></div>
          </div>
        ) : (
          <DataTable
            data={recentArticles || []}
            columns={[
              {
                key: 'createdAt',
                header: 'Date',
                render: (deal: any) => (
                  <div className="font-medium">{deal.createdAt ? new Date(deal.createdAt).toLocaleDateString() : 'N/A'}</div>
                ),
              },
              {
                key: 'buyer',
                header: 'Buyer',
                render: (deal: any) => (
                  <div className="text-gray-900 font-medium max-w-md truncate">{deal.buyer || 'Unknown'}</div>
                ),
              },
              {
                key: 'seller',
                header: 'Seller',
                render: (deal: any) => (
                  <div className="text-gray-600 max-w-md truncate">{deal.seller || 'Unknown'}</div>
                ),
              },
              {
                key: 'dealStatus',
                header: 'Status',
                render: (deal: any) => (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                    {deal.dealStatus || deal.transactionType || 'N/A'}
                  </span>
                ),
              },
            ]}
            onRowClick={(deal: any) => { setIsDockTalkDetailOpen(false); navigate(`/docktalk`); }}
            getRowLink={() => `/docktalk`}
            emptyMessage="No recent deals found"
          />
        )}
      </DetailPanel>

      <DetailPanel
        open={isVDRDetailOpen}
        onOpenChange={setIsVDRDetailOpen}
        title="VDR Documents"
        description="Recently uploaded documents"
        icon={FileText}
        sourceLink="/vdr"
        sourceLinkText="Go to VDR"
        actions={
          <Link href="/vdr">
            <Button size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Upload Document
            </Button>
          </Link>
        }
      >
        {documentsLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full"></div>
          </div>
        ) : (
          <DataTable
            data={recentDocuments || []}
            columns={[
              {
                key: 'createdAt',
                header: 'Date',
                render: (doc: any) => (
                  <div className="font-medium">{new Date(doc.createdAt).toLocaleDateString()}</div>
                ),
              },
              {
                key: 'filename',
                header: 'File Name',
                render: (doc: any) => (
                  <div className="text-gray-900 font-medium max-w-md truncate">{doc.filename}</div>
                ),
              },
              {
                key: 'projectName',
                header: 'Project',
                render: (doc: any) => (
                  <div className="text-gray-600">{doc.projectName}</div>
                ),
              },
              {
                key: 'size',
                header: 'Size',
                render: (doc: any) => (
                  <div className="text-gray-600">{doc.size ? (doc.size / 1024 / 1024).toFixed(2) + ' MB' : 'N/A'}</div>
                ),
              },
            ]}
            onRowClick={(doc: any) => { setIsVDRDetailOpen(false); navigate(`/vdr`); }}
            getRowLink={() => `/vdr`}
            emptyMessage="No recent documents found"
          />
        )}
      </DetailPanel>

      <DetailPanel
        open={isShipStoreDetailOpen}
        onOpenChange={setIsShipStoreDetailOpen}
        title="Ship Store Transactions"
        description="Recent sales activity"
        icon={ShoppingCart}
        sourceLink="/ship-store/transactions"
        sourceLinkText="Go to Ship Store"
        actions={
          <Link href="/ship-store/pos">
            <Button size="sm">
              <Plus className="h-4 w-4 mr-2" />
              New Sale
            </Button>
          </Link>
        }
      >
        {shipStoreLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full"></div>
          </div>
        ) : (
          <DataTable
            data={recentShipStoreTxns || []}
            columns={[
              {
                key: 'createdAt',
                header: 'Date',
                render: (txn: any) => (
                  <div className="font-medium">{new Date(txn.createdAt).toLocaleDateString()}</div>
                ),
              },
              {
                key: 'total',
                header: 'Total',
                render: (txn: any) => (
                  <div className="text-gray-900 font-semibold">
                    {formatCurrency(Number(txn.total || 0))}
                  </div>
                ),
              },
              {
                key: 'paymentMethod',
                header: 'Payment',
                render: (txn: any) => (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                    {txn.paymentMethod}
                  </span>
                ),
              },
              {
                key: 'status',
                header: 'Status',
                render: (txn: any) => (
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                    txn.status === 'completed' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {txn.status}
                  </span>
                ),
              },
            ]}
            onRowClick={(txn: any) => { setIsShipStoreDetailOpen(false); navigate(`/ship-store/transactions/${txn.id}`); }}
            getRowLink={(txn: any) => `/ship-store/transactions/${txn.id}`}
            emptyMessage="No recent transactions found"
          />
        )}
      </DetailPanel>

      <DetailPanel
        open={isDDDetailOpen}
        onOpenChange={setIsDDDetailOpen}
        title="Due Diligence Tasks"
        description="Recently created tasks"
        icon={Database}
        sourceLink="/projects"
        sourceLinkText="Go to Due Diligence"
        actions={
          <Link href="/projects">
            <Button size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Create Task
            </Button>
          </Link>
        }
      >
        {ddTasksLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full"></div>
          </div>
        ) : (
          <DataTable
            data={recentDDTasks || []}
            columns={[
              {
                key: 'title',
                header: 'Task',
                render: (task: any) => (
                  <div className="text-gray-900 font-medium max-w-md truncate">{task.title}</div>
                ),
              },
              {
                key: 'projectName',
                header: 'Project',
                render: (task: any) => (
                  <div className="text-gray-600">{task.projectName}</div>
                ),
              },
              {
                key: 'status',
                header: 'Status',
                render: (task: any) => (
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                    task.status === 'completed' ? 'bg-green-100 text-green-800' : 
                    task.status === 'in_progress' ? 'bg-blue-100 text-blue-800' : 
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {task.status?.replace('_', ' ')}
                  </span>
                ),
              },
              {
                key: 'deadline',
                header: 'Deadline',
                render: (task: any) => (
                  <div className="text-gray-600">
                    {task.deadline ? new Date(task.deadline).toLocaleDateString() : 'No date'}
                  </div>
                ),
              },
            ]}
            onRowClick={(task: any) => { setIsDDDetailOpen(false); navigate(`/projects/${task.projectId}`); }}
            getRowLink={(task: any) => `/projects/${task.projectId}`}
            emptyMessage="No recent tasks found"
          />
        )}
      </DetailPanel>

      <DetailPanel
        open={isRentRollDetailOpen}
        onOpenChange={setIsRentRollDetailOpen}
        title="Rent Roll Units"
        description="Recently added units"
        icon={Home}
        sourceLink="/rent-roll"
        sourceLinkText="Go to Rent Roll"
        actions={
          <Link href="/rent-roll">
            <Button size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Unit
            </Button>
          </Link>
        }
      >
        {rentRollLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full"></div>
          </div>
        ) : (
          <DataTable
            data={recentRentRoll || []}
            columns={[
              {
                key: 'unitNumber',
                header: 'Unit',
                render: (entry: any) => (
                  <div className="font-medium">{entry.unitNumber}</div>
                ),
              },
              {
                key: 'tenantName',
                header: 'Tenant',
                render: (entry: any) => (
                  <div className="text-gray-900">{entry.tenantName || 'Vacant'}</div>
                ),
              },
              {
                key: 'status',
                header: 'Status',
                render: (entry: any) => (
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                    entry.status === 'occupied' ? 'bg-green-100 text-green-800' : 
                    entry.status === 'vacant' ? 'bg-yellow-100 text-yellow-800' : 
                    'bg-red-100 text-red-800'
                  }`}>
                    {entry.status}
                  </span>
                ),
              },
              {
                key: 'monthlyRate',
                header: 'Monthly Rate',
                render: (entry: any) => (
                  <div className="text-gray-900 font-semibold">
                    {formatCurrency(Number(entry.monthlyRate || 0))}
                  </div>
                ),
              },
            ]}
            onRowClick={(entry: any) => { setIsRentRollDetailOpen(false); navigate(`/rent-roll`); }}
            getRowLink={() => `/rent-roll`}
            emptyMessage="No recent units found"
          />
        )}
      </DetailPanel>

      <DetailPanel
        open={isModelingDetailOpen}
        onOpenChange={setIsModelingDetailOpen}
        title="Modeling Projects"
        description="Recent valuation projects"
        icon={BarChart3}
        sourceLink="/modeling"
        sourceLinkText="Go to Modeling"
        actions={
          <Link href="/modeling/new">
            <Button size="sm">
              <Plus className="h-4 w-4 mr-2" />
              New Project
            </Button>
          </Link>
        }
      >
        {modelingLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full"></div>
          </div>
        ) : (
          <DataTable
            data={recentModelingProjects || []}
            columns={[
              {
                key: 'marinaName',
                header: 'Marina',
                render: (project: any) => (
                  <div className="text-gray-900 font-medium">{project.marinaName}</div>
                ),
              },
              {
                key: 'location',
                header: 'Location',
                render: (project: any) => (
                  <div className="text-gray-600">{project.city && project.state ? `${project.city}, ${project.state}` : 'N/A'}</div>
                ),
              },
              {
                key: 'dealOutcome',
                header: 'Status',
                render: (project: any) => (
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                    project.dealOutcome === 'closed' ? 'bg-green-100 text-green-800' : 
                    project.dealOutcome === 'active' ? 'bg-blue-100 text-blue-800' : 
                    project.dealOutcome === 'passed' ? 'bg-red-100 text-red-800' : 
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {project.dealOutcome || 'N/A'}
                  </span>
                ),
              },
              {
                key: 'purchasePrice',
                header: 'Purchase Price',
                render: (project: any) => (
                  <div className="text-gray-900 font-semibold">
                    {project.purchasePrice ? formatCurrency(Number(project.purchasePrice)) : 'TBD'}
                  </div>
                ),
              },
            ]}
            onRowClick={(project: any) => { setIsModelingDetailOpen(false); navigate(`/modeling/${project.id}`); }}
            getRowLink={(project: any) => `/modeling/${project.id}`}
            emptyMessage="No recent projects found"
          />
        )}
      </DetailPanel>
    </div>
  );
}
