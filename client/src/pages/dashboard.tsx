import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { DndContext, DragEndEvent, closestCenter, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, rectSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Settings, GripVertical, ExternalLink, TrendingUp, Users, FileText, Database, Radio, Fuel, DollarSign, ShoppingCart, Home, BarChart3, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { TimeRangeSelector, type TimeRange } from "@/components/dashboard/TimeRangeSelector";
import { ComparisonModule } from "@/components/dashboard/ComparisonModule";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { formatCurrency, formatNumber } from "@/lib/formatUtils";
import { CRMCharts } from "@/components/dashboard/CRMCharts";
import { RevenueCharts } from "@/components/dashboard/RevenueCharts";

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
            <div {...listeners} className="cursor-grab active:cursor-grabbing p-1 hover:bg-gray-100 rounded">
              <GripVertical className="h-4 w-4 text-gray-400" />
            </div>
          </div>
        </CardHeader>
        {!isCollapsed && (
          <CardContent>
            {module.renderContent(module.data)}
          </CardContent>
        )}
      </Card>
    </div>
  );
}

export default function Dashboard() {
  const { toast } = useToast();
  const [timeRange, setTimeRange] = useState<TimeRange>('30d');
  
  // Collapsed modules state with localStorage persistence
  const [collapsedModules, setCollapsedModules] = useState<Set<string>>(() => {
    const saved = localStorage.getItem('dashboardCollapsedModules');
    return saved ? new Set(JSON.parse(saved)) : new Set();
  });

  // Save collapsed state to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('dashboardCollapsedModules', JSON.stringify(Array.from(collapsedModules)));
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
    'fuel-operations',
    'ship-store',
    'rent-roll',
    'modeling-projects',
  ];

  const { data: dashboardData, isLoading } = useQuery({
    queryKey: ['/api/dashboards/data', timeRange],
    queryFn: () => fetch(`/api/dashboards/data?timeRange=${timeRange}`).then(res => res.json()),
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
        personaTemplate: 'default',
        layout,
        isDefault: false,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/dashboards/layout'] });
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
          <div className="grid grid-cols-2 gap-4">
            <MetricCard
              label="Pipeline Value"
              value={data?.pipelineValue || 0}
              type="currency"
              compact={true}
              colorClass="text-blue-600"
              testId="crm-pipeline-value"
              tooltip="Total value of all active deals in the pipeline"
            />
            <MetricCard
              label="Active Deals"
              value={data?.activeDeals || 0}
              type="number"
              testId="crm-active-deals"
              tooltip="Number of deals currently in progress"
            />
            <MetricCard
              label="Win Rate"
              value={data?.winRate || 0}
              type="percent"
              colorClass="text-green-600"
              testId="crm-win-rate"
              tooltip="Percentage of deals won vs total closed deals"
            />
            <MetricCard
              label="Won Deals"
              value={data?.wonDeals || 0}
              type="number"
              testId="crm-won-deals"
              tooltip="Total number of successfully closed deals"
            />
          </div>
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
          <div className="grid grid-cols-2 gap-4">
            <MetricCard
              label="Active Projects"
              value={data?.activeProjects || 0}
              type="number"
              colorClass="text-blue-600"
              testId="dd-active-projects"
              tooltip="Currently active due diligence projects"
            />
            <MetricCard
              label="Completed"
              value={data?.completedProjects || 0}
              type="number"
              testId="dd-completed-projects"
              tooltip="Successfully completed projects"
            />
            <MetricCard
              label="Total Projects"
              value={data?.totalProjects || 0}
              type="number"
              testId="dd-total-projects"
              tooltip="Total number of projects tracked"
            />
            <MetricCard
              label="Completion Rate"
              value={data?.completionRate || 0}
              type="percent"
              colorClass="text-green-600"
              testId="dd-completion-rate"
              tooltip="Percentage of projects successfully completed"
            />
          </div>
        </div>
      ),
    },
    {
      id: 'sales-comps',
      title: 'Sales Comps Intelligence',
      icon: TrendingUp,
      link: '/analysis/sales-comps/analytics',
      data: dashboardData?.salesComps,
      renderContent: (data) => (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <MetricCard
              label="Recent Comps"
              value={data?.totalComps || 0}
              type="number"
              colorClass="text-blue-600"
              testId="comps-total"
              tooltip="Number of sales comparables in selected period"
            />
            <MetricCard
              label="Avg Price/Slip"
              value={data?.avgPricePerSlip || 0}
              type="currency"
              testId="comps-avg-price"
              tooltip="Average price per slip across all comparables"
            />
          </div>
          {data?.recentComps && data.recentComps.length > 0 && (
            <div className="mt-2">
              <p className="text-xs text-gray-500 mb-2">Latest Comparables</p>
              <div className="space-y-1">
                {data.recentComps.slice(0, 3).map((comp: any, idx: number) => (
                  <div key={idx} className="text-xs flex justify-between">
                    <span className="truncate">{comp.propertyName || 'Unnamed'}</span>
                    <span className="font-semibold">{formatCurrency(comp.pricePerSlip || 0)}/slip</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ),
    },
    {
      id: 'vdr-activity',
      title: 'VDR Activity Monitor',
      icon: Database,
      link: '/vdr',
      data: dashboardData?.vdr,
      renderContent: (data) => (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <MetricCard
              label="Active Data Rooms"
              value={data?.activeDataRooms || 0}
              type="number"
              colorClass="text-blue-600"
              testId="vdr-active-rooms"
              tooltip="Number of active virtual data rooms"
            />
            <MetricCard
              label="Total Documents"
              value={data?.totalDocuments || 0}
              type="number"
              testId="vdr-total-docs"
              tooltip="Total documents uploaded across all data rooms"
            />
            <div className="col-span-2">
              <MetricCard
                label="Pending Requests"
                value={data?.pendingRequests || 0}
                type="number"
                colorClass="text-orange-600"
                testId="vdr-pending-requests"
                tooltip="Diligence requests awaiting response"
              />
            </div>
          </div>
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
        <div className="space-y-3">
          <div>
            <p className="text-xs text-gray-500 mb-2">Recent M&A Activity</p>
            <p className="text-2xl font-bold text-blue-600" data-testid="docktalk-deals-count">
              {data?.totalDeals || 0} <span className="text-sm text-gray-600">deals tracked</span>
            </p>
          </div>
          {data?.recentDeals && data.recentDeals.length > 0 && (
            <div>
              <p className="text-xs text-gray-500 mb-2">Latest Deals</p>
              <div className="space-y-1">
                {data.recentDeals.slice(0, 2).map((deal: any, idx: number) => (
                  <div key={idx} className="text-xs truncate" title={deal.marinaName || deal.dealDescription}>
                    • {deal.marinaName || deal.dealDescription || `Deal ${idx + 1}`}
                  </div>
                ))}
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
          <div className="grid grid-cols-2 gap-4">
            <MetricCard
              label="Monthly Revenue"
              value={data?.monthlyRevenue || 0}
              type="currency"
              compact={true}
              colorClass="text-green-600"
              testId="fuel-revenue"
              tooltip="Total fuel sales revenue for the selected period"
            />
            <MetricCard
              label="Monthly Gallons"
              value={data?.monthlyGallons || 0}
              type="number"
              compact={true}
              testId="fuel-gallons"
              tooltip="Total fuel gallons sold in the selected period"
            />
          </div>
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
          <div className="grid grid-cols-2 gap-4">
            <MetricCard
              label="Monthly Sales"
              value={data?.monthlyRevenue || 0}
              type="currency"
              compact={true}
              colorClass="text-green-600"
              testId="ship-store-revenue"
              tooltip="Total ship store sales revenue"
            />
            <MetricCard
              label="Transactions"
              value={data?.monthlyTransactions || 0}
              type="number"
              compact={true}
              testId="ship-store-transactions"
              tooltip="Number of completed transactions"
            />
            <MetricCard
              label="Avg Transaction"
              value={data?.avgTransaction || 0}
              type="currency"
              testId="ship-store-avg"
              tooltip="Average transaction value"
            />
            <MetricCard
              label="Inventory Value"
              value={data?.inventoryValue || 0}
              type="currency"
              compact={true}
              colorClass="text-blue-600"
              testId="ship-store-inventory"
              tooltip="Current total inventory value"
            />
          </div>
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
          <div className="grid grid-cols-2 gap-4">
            <MetricCard
              label="Total Units"
              value={data?.totalUnits || 0}
              type="number"
              colorClass="text-blue-600"
              testId="rent-roll-units"
              tooltip="Total number of rental units"
            />
            <MetricCard
              label="Occupancy Rate"
              value={data?.occupancyRate || 0}
              type="percent"
              colorClass="text-green-600"
              testId="rent-roll-occupancy"
              tooltip="Percentage of units currently occupied"
            />
            <MetricCard
              label="Monthly Income"
              value={data?.monthlyIncome || 0}
              type="currency"
              compact={true}
              testId="rent-roll-income"
              tooltip="Total monthly rental income"
            />
            <MetricCard
              label="Vacant Units"
              value={data?.vacantUnits || 0}
              type="number"
              colorClass="text-orange-600"
              testId="rent-roll-vacant"
              tooltip="Number of currently vacant units"
            />
          </div>
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
          <div className="grid grid-cols-2 gap-4">
            <MetricCard
              label="Active Models"
              value={data?.activeProjects || 0}
              type="number"
              colorClass="text-blue-600"
              testId="modeling-active"
              tooltip="Currently active modeling projects"
            />
            <MetricCard
              label="Completed"
              value={data?.completedProjects || 0}
              type="number"
              testId="modeling-completed"
              tooltip="Successfully completed modeling projects"
            />
            <div className="col-span-2">
              <MetricCard
                label="Total Valuation"
                value={data?.totalValuation || 0}
                type="currency"
                compact={true}
                colorClass="text-green-600"
                testId="modeling-valuation"
                tooltip="Aggregate valuation across all projects"
              />
            </div>
          </div>
        </div>
      ),
    },
  ];

  const orderedModules = moduleOrder
    .map(id => modules.find(m => m.id === id))
    .filter(Boolean) as DashboardModule[];

  return (
    <div className="flex-1 overflow-auto bg-gray-50" data-testid="page-dashboard">
      <div className="container mx-auto p-6 max-w-7xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">MarinaMatch Dashboard</h1>
            <p className="text-gray-600 mt-1">
              Your comprehensive marina acquisition intelligence platform
            </p>
          </div>
          <TimeRangeSelector value={timeRange} onChange={setTimeRange} />
        </div>

        <div className="mb-6">
          <ComparisonModule />
        </div>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={moduleOrder} strategy={rectSortingStrategy}>
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

        <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800">
            <strong>Tip:</strong> Drag and drop modules to rearrange your dashboard. Click the external link icon to navigate to the full page for detailed analysis.
          </p>
        </div>
      </div>
    </div>
  );
}
