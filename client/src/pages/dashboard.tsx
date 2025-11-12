import { useQuery } from "@tanstack/react-query";
import { LayoutGrid, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

type Widget = {
  widgetKey: string;
  title: string;
  description: string;
  category: string;
  dataSource: string;
  defaultSize: string;
  availableToPersonas: string[];
  configSchema: Record<string, any> | null;
};

type DashboardLayout = {
  id: string;
  userId: string;
  orgId: string;
  personaTemplate: string | null;
  layout: {
    widgets: Array<{
      widgetKey: string;
      x: number;
      y: number;
      width: number;
      height: number;
      config?: Record<string, any>;
    }>;
  };
};

export default function Dashboard() {
  const { data: layout, isLoading: layoutLoading } = useQuery<DashboardLayout>({
    queryKey: ['/api/dashboards/layout'],
  });

  const { data: widgets, isLoading: widgetsLoading } = useQuery<Widget[]>({
    queryKey: ['/api/dashboards/widgets'],
  });

  const isLoading = layoutLoading || widgetsLoading;

  const renderWidget = (widgetKey: string, config?: Record<string, any>) => {
    const widget = widgets?.find((w) => w.widgetKey === widgetKey);
    
    if (!widget) {
      return (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Unknown Widget</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-gray-500">Widget "{widgetKey}" not found</p>
          </CardContent>
        </Card>
      );
    }

    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">{widget.title}</CardTitle>
          <CardDescription className="text-xs">{widget.description}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-32 bg-gray-50 rounded-lg border border-dashed border-gray-300">
            <p className="text-xs text-gray-500">
              {widget.category} widget - Coming soon
            </p>
          </div>
        </CardContent>
      </Card>
    );
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
            <Skeleton className="h-10 w-40" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-3 w-full mt-2" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-32 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const hasLayout = layout?.layout?.widgets && layout.layout.widgets.length > 0;

  if (!hasLayout) {
    return (
      <div className="flex-1 overflow-auto bg-gray-50" data-testid="page-dashboard">
        <div className="container mx-auto p-6 max-w-7xl">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
              <p className="text-gray-600 mt-1">Customize your workspace with widgets</p>
            </div>
            <Button data-testid="button-customize-dashboard">
              <Settings className="w-4 h-4 mr-2" />
              Customize Dashboard
            </Button>
          </div>

          <div className="flex items-center justify-center h-96">
            <div className="text-center max-w-md">
              <LayoutGrid className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                Your dashboard is empty
              </h2>
              <p className="text-gray-600 mb-6">
                Get started by adding widgets to track your deals, assets, and KPIs.
                Click "Customize Dashboard" to add your first widgets.
              </p>
              <Button data-testid="button-add-widgets">
                <Settings className="w-4 h-4 mr-2" />
                Add Widgets
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const gridLayout = layout.layout.widgets.sort((a, b) => {
    if (a.y === b.y) return a.x - b.x;
    return a.y - b.y;
  });

  return (
    <div className="flex-1 overflow-auto bg-gray-50" data-testid="page-dashboard">
      <div className="container mx-auto p-6 max-w-7xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
            <p className="text-gray-600 mt-1">
              {layout.personaTemplate && (
                <span className="capitalize">{layout.personaTemplate.replace('_', ' ')}</span>
              )} workspace
            </p>
          </div>
          <Button data-testid="button-customize-dashboard">
            <Settings className="w-4 h-4 mr-2" />
            Customize Dashboard
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {gridLayout.map((item) => (
            <div
              key={`${item.widgetKey}-${item.x}-${item.y}`}
              className={`
                ${item.width === 1 ? 'col-span-1' : ''}
                ${item.width === 2 ? 'md:col-span-2' : ''}
                ${item.width === 3 ? 'lg:col-span-3' : ''}
              `}
              data-testid={`widget-${item.widgetKey}`}
            >
              {renderWidget(item.widgetKey, item.config)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
