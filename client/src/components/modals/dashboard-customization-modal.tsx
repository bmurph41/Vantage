import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { StandardDialogShell } from "@/components/ui/standard-dialog-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { 
  LayoutGrid, 
  TrendingUp, 
  DollarSign, 
  Users, 
  Activity, 
  BarChart3,
  PieChart,
  Briefcase,
  CheckCircle,
  RotateCcw,
  Save,
  Sparkles
} from "lucide-react";

type Widget = {
  id: string;
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
  id?: string;
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

const CATEGORY_ICONS: Record<string, any> = {
  'deal_flow': Briefcase,
  'analytics': BarChart3,
  'operations': Activity,
  'finance': DollarSign,
  'portfolio': PieChart,
  'task_management': CheckCircle,
  'reporting': TrendingUp,
  'network': Users,
};

const CATEGORY_COLORS: Record<string, string> = {
  'deal_flow': 'bg-blue-100 text-blue-800',
  'analytics': 'bg-purple-100 text-purple-800',
  'operations': 'bg-green-100 text-green-800',
  'finance': 'bg-yellow-100 text-yellow-800',
  'portfolio': 'bg-indigo-100 text-indigo-800',
  'task_management': 'bg-pink-100 text-pink-800',
  'reporting': 'bg-orange-100 text-orange-800',
  'network': 'bg-teal-100 text-teal-800',
};

interface DashboardCustomizationModalProps {
  open: boolean;
  onClose: () => void;
  currentLayout: DashboardLayout | null;
}

export default function DashboardCustomizationModal({ 
  open, 
  onClose,
  currentLayout 
}: DashboardCustomizationModalProps) {
  const { toast } = useToast();
  const [selectedWidgets, setSelectedWidgets] = useState<Set<string>>(new Set());
  const [widgetSizes, setWidgetSizes] = useState<Record<string, number>>({});

  const { data: widgets = [] } = useQuery<Widget[]>({
    queryKey: ['/api/dashboards/widgets'],
    enabled: open,
  });

  useEffect(() => {
    if (currentLayout?.layout?.widgets) {
      const activeWidgets = new Set(currentLayout.layout.widgets.map(w => w.widgetKey));
      setSelectedWidgets(activeWidgets);
      
      const sizes: Record<string, number> = {};
      currentLayout.layout.widgets.forEach(w => {
        sizes[w.widgetKey] = w.width;
      });
      setWidgetSizes(sizes);
    }
  }, [currentLayout, open]);

  const saveLayoutMutation = useMutation({
    mutationFn: async (layoutData: any) => {
      return await apiRequest('PUT', '/api/dashboards/layout', layoutData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/dashboards/layout'] });
      toast({
        title: "Success",
        description: "Dashboard layout saved successfully",
      });
      onClose();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save dashboard layout",
        variant: "destructive",
      });
    },
  });

  const resetMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('POST', '/api/dashboards/reset', {
        personaType: currentLayout?.personaTemplate || 'investor'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/dashboards/layout'] });
      toast({
        title: "Success",
        description: "Dashboard reset to default template",
      });
      onClose();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to reset dashboard",
        variant: "destructive",
      });
    },
  });

  const handleToggleWidget = (widgetKey: string) => {
    const newSelected = new Set(selectedWidgets);
    if (newSelected.has(widgetKey)) {
      newSelected.delete(widgetKey);
    } else {
      newSelected.add(widgetKey);
      if (!widgetSizes[widgetKey]) {
        const widget = widgets.find(w => w.widgetKey === widgetKey);
        const defaultSize = widget?.defaultSize === 'full' ? 3 : 
                          widget?.defaultSize === 'half' ? 2 : 1;
        setWidgetSizes({ ...widgetSizes, [widgetKey]: defaultSize });
      }
    }
    setSelectedWidgets(newSelected);
  };

  const handleSizeChange = (widgetKey: string, size: number) => {
    setWidgetSizes({ ...widgetSizes, [widgetKey]: size });
  };

  const handleSave = () => {
    const widgetsArray = Array.from(selectedWidgets);
    const layoutWidgets = widgetsArray.map((widgetKey, index) => {
      const size = widgetSizes[widgetKey] || 1;
      return {
        widgetKey,
        x: index % 3,
        y: Math.floor(index / 3),
        width: size,
        height: 1,
        config: {},
      };
    });

    const layoutData = {
      personaTemplate: currentLayout?.personaTemplate || null,
      layout: {
        widgets: layoutWidgets,
      },
    };

    saveLayoutMutation.mutate(layoutData);
  };

  const handleReset = () => {
    if (confirm('Are you sure you want to reset your dashboard to the default template? This will remove all customizations.')) {
      resetMutation.mutate();
    }
  };

  const groupedWidgets = widgets.reduce((acc, widget) => {
    if (!acc[widget.category]) {
      acc[widget.category] = [];
    }
    acc[widget.category].push(widget);
    return acc;
  }, {} as Record<string, Widget[]>);

  const categories = Object.keys(groupedWidgets).sort();

  return (
    <StandardDialogShell
      open={open}
      onOpenChange={(isOpen) => !isOpen && onClose()}
      title="Customize Dashboard"
      description="Select widgets to display on your dashboard and configure their layout"
      icon={LayoutGrid}
      size="lg"
      footer={
        <>
          <Button
            variant="outline"
            onClick={handleReset}
            disabled={resetMutation.isPending}
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset to Default
          </Button>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button 
            onClick={handleSave}
            disabled={saveLayoutMutation.isPending || selectedWidgets.size === 0}
            className="bg-[#1E4FAB] hover:bg-[#1a4294]"
          >
            <Save className="h-4 w-4 mr-2" />
            {saveLayoutMutation.isPending ? 'Saving...' : 'Save Layout'}
          </Button>
        </>
      }
    >
      <Tabs defaultValue="widgets" className="flex-1">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="widgets">
            <Sparkles className="h-4 w-4 mr-2" />
            Select Widgets
          </TabsTrigger>
          <TabsTrigger value="layout">
            <LayoutGrid className="h-4 w-4 mr-2" />
            Preview Layout ({selectedWidgets.size})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="widgets" className="flex-1">
          <ScrollArea className="h-[500px] pr-4">
            <div className="space-y-6">
              {categories.length === 0 && (
                <div className="text-center py-12 text-gray-500">
                  <LayoutGrid className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No widgets available</p>
                </div>
              )}

              {categories.map((category) => {
                const Icon = CATEGORY_ICONS[category] || Activity;
                return (
                  <div key={category}>
                    <div className="flex items-center gap-2 mb-3">
                      <Icon className="h-4 w-4 text-gray-600" />
                      <h3 className="font-semibold text-gray-900 capitalize">
                        {category.replace('_', ' ')}
                      </h3>
                      <Badge variant="secondary" className="ml-auto">
                        {groupedWidgets[category].length}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-1 gap-3 mb-4">
                      {groupedWidgets[category].map((widget) => (
                        <Card 
                          key={widget.widgetKey}
                          className={`cursor-pointer transition-all ${
                            selectedWidgets.has(widget.widgetKey) 
                              ? 'border-blue-500 bg-blue-50' 
                              : 'hover:border-gray-400'
                          }`}
                          onClick={() => handleToggleWidget(widget.widgetKey)}
                        >
                          <CardHeader className="pb-3">
                            <div className="flex items-start justify-between">
                              <div className="flex items-start gap-3 flex-1">
                                <Checkbox
                                  checked={selectedWidgets.has(widget.widgetKey)}
                                  onCheckedChange={() => handleToggleWidget(widget.widgetKey)}
                                  onClick={(e) => e.stopPropagation()}
                                />
                                <div className="flex-1">
                                  <CardTitle className="text-sm">{widget.title}</CardTitle>
                                  <CardDescription className="text-xs mt-1">
                                    {widget.description}
                                  </CardDescription>
                                </div>
                              </div>
                              <Badge className={CATEGORY_COLORS[category]}>
                                {widget.dataSource}
                              </Badge>
                            </div>
                          </CardHeader>
                          
                          {selectedWidgets.has(widget.widgetKey) && (
                            <CardContent className="pt-0">
                              <div className="flex items-center gap-2 text-xs text-gray-600">
                                <span>Size:</span>
                                <div className="flex gap-1">
                                  {[1, 2, 3].map((size) => (
                                    <Button
                                      key={size}
                                      size="sm"
                                      variant={widgetSizes[widget.widgetKey] === size ? "default" : "outline"}
                                      className="h-6 px-2 text-xs"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleSizeChange(widget.widgetKey, size);
                                      }}
                                    >
                                      {size === 1 ? 'Small' : size === 2 ? 'Medium' : 'Large'}
                                    </Button>
                                  ))}
                                </div>
                              </div>
                            </CardContent>
                          )}
                        </Card>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="layout" className="flex-1">
          <ScrollArea className="h-[500px] pr-4">
            {selectedWidgets.size === 0 ? (
              <div className="flex items-center justify-center h-64 text-gray-500">
                <div className="text-center">
                  <LayoutGrid className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No widgets selected</p>
                  <p className="text-sm mt-1">Select widgets from the "Select Widgets" tab</p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-4">
                {Array.from(selectedWidgets).map((widgetKey) => {
                  const widget = widgets.find(w => w.widgetKey === widgetKey);
                  const size = widgetSizes[widgetKey] || 1;
                  return (
                    <Card 
                      key={widgetKey}
                      className={`${
                        size === 3 ? 'col-span-3' : size === 2 ? 'col-span-2' : 'col-span-1'
                      } border-2 border-dashed border-gray-300`}
                    >
                      <CardHeader>
                        <CardTitle className="text-sm flex items-center justify-between">
                          {widget?.title}
                          <Badge variant="secondary" className="text-xs">
                            {size === 1 ? 'Small' : size === 2 ? 'Medium' : 'Large'}
                          </Badge>
                        </CardTitle>
                        <CardDescription className="text-xs">
                          {widget?.description}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="h-24 bg-gray-100 rounded flex items-center justify-center text-gray-400 text-xs">
                          Widget Preview
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </StandardDialogShell>
  );
}
