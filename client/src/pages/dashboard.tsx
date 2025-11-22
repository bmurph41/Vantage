import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { DndContext, DragEndEvent, closestCenter, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, rectSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Settings, GripVertical, ExternalLink, TrendingUp, Users, FileText, Database, Radio, Fuel, DollarSign, ShoppingCart, Home, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type DashboardModule = {
  id: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  link: string;
  data?: any;
  renderContent: (data: any) => React.ReactNode;
};

function SortableModule({ module }: { module: DashboardModule }) {
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
      <Card className="h-full hover:shadow-lg transition-shadow">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Icon className="h-4 w-4 text-blue-600" />
            {module.title}
          </CardTitle>
          <div className="flex items-center gap-1">
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
        <CardContent>
          {module.renderContent(module.data)}
        </CardContent>
      </Card>
    </div>
  );
}

export default function Dashboard() {
  const { toast } = useToast();
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
    queryKey: ['/api/dashboards/data'],
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
            <div>
              <p className="text-xs text-gray-500">Pipeline Value</p>
              <p className="text-2xl font-bold text-blue-600" data-testid="crm-pipeline-value">
                ${data?.pipelineValue?.toLocaleString() || '0'}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Active Deals</p>
              <p className="text-2xl font-bold" data-testid="crm-active-deals">{data?.activeDeals || 0}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Win Rate</p>
              <p className="text-2xl font-bold text-green-600" data-testid="crm-win-rate">{data?.winRate || 0}%</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Won Deals</p>
              <p className="text-2xl font-bold" data-testid="crm-won-deals">{data?.wonDeals || 0}</p>
            </div>
          </div>
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
            <div>
              <p className="text-xs text-gray-500">Active Projects</p>
              <p className="text-2xl font-bold text-blue-600" data-testid="dd-active-projects">{data?.activeProjects || 0}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Completed</p>
              <p className="text-2xl font-bold" data-testid="dd-completed-projects">{data?.completedProjects || 0}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Total Projects</p>
              <p className="text-2xl font-bold" data-testid="dd-total-projects">{data?.totalProjects || 0}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Completion Rate</p>
              <p className="text-2xl font-bold text-green-600" data-testid="dd-completion-rate">{data?.completionRate || 0}%</p>
            </div>
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
            <div>
              <p className="text-xs text-gray-500">Recent Comps</p>
              <p className="text-2xl font-bold text-blue-600" data-testid="comps-total">{data?.totalComps || 0}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Avg Price/Slip</p>
              <p className="text-2xl font-bold" data-testid="comps-avg-price">${data?.avgPricePerSlip?.toLocaleString() || '0'}</p>
            </div>
          </div>
          {data?.recentComps && data.recentComps.length > 0 && (
            <div className="mt-2">
              <p className="text-xs text-gray-500 mb-2">Latest Comparables</p>
              <div className="space-y-1">
                {data.recentComps.slice(0, 3).map((comp: any, idx: number) => (
                  <div key={idx} className="text-xs flex justify-between">
                    <span className="truncate">{comp.propertyName || 'Unnamed'}</span>
                    <span className="font-semibold">${comp.pricePerSlip?.toLocaleString() || 'N/A'}/slip</span>
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
            <div>
              <p className="text-xs text-gray-500">Active Data Rooms</p>
              <p className="text-2xl font-bold text-blue-600" data-testid="vdr-active-rooms">{data?.activeDataRooms || 0}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Total Documents</p>
              <p className="text-2xl font-bold" data-testid="vdr-total-docs">{data?.totalDocuments || 0}</p>
            </div>
            <div className="col-span-2">
              <p className="text-xs text-gray-500">Pending Requests</p>
              <p className="text-2xl font-bold text-orange-600" data-testid="vdr-pending-requests">{data?.pendingRequests || 0}</p>
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
              {data?.recentDeals?.length || 0} <span className="text-sm text-gray-600">recent deals</span>
            </p>
          </div>
          {data?.recentArticles && data.recentArticles.length > 0 && (
            <div>
              <p className="text-xs text-gray-500 mb-2">Latest Articles</p>
              <div className="space-y-1">
                {data.recentArticles.slice(0, 2).map((article: any, idx: number) => (
                  <div key={idx} className="text-xs truncate" title={article.title}>
                    • {article.title}
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
            <div>
              <p className="text-xs text-gray-500">Monthly Revenue</p>
              <p className="text-2xl font-bold text-green-600" data-testid="fuel-revenue">
                ${data?.monthlyRevenue?.toLocaleString() || '0'}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Monthly Gallons</p>
              <p className="text-2xl font-bold" data-testid="fuel-gallons">
                {data?.monthlyGallons?.toLocaleString() || '0'}
              </p>
            </div>
          </div>
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
            <div>
              <p className="text-xs text-gray-500">Monthly Sales</p>
              <p className="text-2xl font-bold text-green-600" data-testid="ship-store-revenue">
                ${data?.monthlyRevenue?.toLocaleString() || '0'}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Transactions</p>
              <p className="text-2xl font-bold" data-testid="ship-store-transactions">
                {data?.monthlyTransactions?.toLocaleString() || '0'}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Avg Transaction</p>
              <p className="text-2xl font-bold" data-testid="ship-store-avg">
                ${data?.avgTransaction?.toLocaleString() || '0'}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Inventory Value</p>
              <p className="text-2xl font-bold text-blue-600" data-testid="ship-store-inventory">
                ${data?.inventoryValue?.toLocaleString() || '0'}
              </p>
            </div>
          </div>
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
            <div>
              <p className="text-xs text-gray-500">Total Units</p>
              <p className="text-2xl font-bold text-blue-600" data-testid="rent-roll-units">
                {data?.totalUnits || 0}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Occupancy Rate</p>
              <p className="text-2xl font-bold text-green-600" data-testid="rent-roll-occupancy">
                {data?.occupancyRate || 0}%
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Monthly Income</p>
              <p className="text-2xl font-bold" data-testid="rent-roll-income">
                ${data?.monthlyIncome?.toLocaleString() || '0'}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Vacant Units</p>
              <p className="text-2xl font-bold text-orange-600" data-testid="rent-roll-vacant">
                {data?.vacantUnits || 0}
              </p>
            </div>
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
            <div>
              <p className="text-xs text-gray-500">Active Models</p>
              <p className="text-2xl font-bold text-blue-600" data-testid="modeling-active">
                {data?.activeProjects || 0}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Completed</p>
              <p className="text-2xl font-bold" data-testid="modeling-completed">
                {data?.completedProjects || 0}
              </p>
            </div>
            <div className="col-span-2">
              <p className="text-xs text-gray-500">Total Valuation</p>
              <p className="text-2xl font-bold text-green-600" data-testid="modeling-valuation">
                ${data?.totalValuation?.toLocaleString() || '0'}
              </p>
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
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">MarinaMatch Dashboard</h1>
            <p className="text-gray-600 mt-1">
              Your comprehensive marina acquisition intelligence platform
            </p>
          </div>
        </div>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={moduleOrder} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {orderedModules.map((module) => (
                <SortableModule key={module.id} module={module} />
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
