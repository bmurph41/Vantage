import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Check, DollarSign, FileText, Building2, TrendingUp, Home, Fuel, ShoppingCart, Store, Plus, Newspaper, Edit, Trash2, BarChart3, PieChart, Layers } from "lucide-react";
import { cn } from "@/lib/utils";
import { EnhancedModuleBuilder } from "./EnhancedModuleBuilder";
import { WidgetBuilder } from "./WidgetBuilder";
import type { DashboardCustomModule, VisualizationType, ChartConfig } from "@shared/schema";

interface ModuleDefinition {
  id: string;
  title: string;
  description: string;
  icon: any;
  category: 'financial' | 'dd' | 'crm' | 'intel' | 'operations';
}

interface WidgetFormData {
  title: string;
  moduleKey: string;
  metricKey: string;
  visualizationType: 'kpi_card' | 'bar_chart' | 'line_chart' | 'pie_chart' | 'stat_grid';
  enableComparison: boolean;
  comparisonType: 'yoy' | 'mom' | 'qoq' | 'pop';
  filters: Record<string, any>;
  size: 'sm' | 'md' | 'lg';
  refreshInterval?: number;
}

interface AddModuleModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedModules: string[];
  onToggleModule: (moduleId: string) => void;
  customModules?: DashboardCustomModule[];
  onCreateCustomModule?: (data: {
    title: string;
    moduleType: string;
    visualizationType: VisualizationType;
    filters: Record<string, any>;
    chartConfig: ChartConfig;
  }) => void;
  onDeleteCustomModule?: (id: string) => void;
  onSaveWidget?: (widget: WidgetFormData) => Promise<void>;
}

const allModules: ModuleDefinition[] = [
  // Financial Modules
  {
    id: 'crm-pipeline',
    title: 'CRM Pipeline',
    description: 'Track deal pipeline value, win rates, and active opportunities',
    icon: DollarSign,
    category: 'financial',
  },
  {
    id: 'modeling-projects',
    title: 'Modeling Projects',
    description: 'Monitor marina valuation and investment modeling projects',
    icon: TrendingUp,
    category: 'financial',
  },
  {
    id: 'sales-comps',
    title: 'Sales Comparables',
    description: 'Track marina sales data and market benchmarks',
    icon: Building2,
    category: 'financial',
  },
  {
    id: 'rent-roll',
    title: 'Rent Roll',
    description: 'Monitor unit occupancy rates and rental income',
    icon: Home,
    category: 'financial',
  },
  
  // Due Diligence Modules
  {
    id: 'due-diligence',
    title: 'Due Diligence Tracker',
    description: 'Track active DD projects and completion metrics',
    icon: FileText,
    category: 'dd',
  },
  {
    id: 'vdr-activity',
    title: 'Virtual Data Room',
    description: 'Manage secure document sharing and data requests',
    icon: FileText,
    category: 'dd',
  },
  
  // Intelligence Modules
  {
    id: 'docktalk-feed',
    title: 'DockTalk Intelligence',
    description: 'Monitor marina industry news and M&A activity',
    icon: Newspaper,
    category: 'intel',
  },
  
  // Operations Modules
  {
    id: 'fuel-operations',
    title: 'Fuel Operations',
    description: 'Track fuel sales revenue and gallons sold',
    icon: Fuel,
    category: 'operations',
  },
  {
    id: 'ship-store',
    title: 'Ship Store',
    description: 'Monitor ship store sales and inventory value',
    icon: ShoppingCart,
    category: 'operations',
  },
];

const categoryLabels = {
  financial: 'Financial',
  dd: 'Due Diligence',
  crm: 'CRM',
  intel: 'Intelligence',
  operations: 'Operations',
};

export function AddModuleModal({ 
  open, 
  onOpenChange, 
  selectedModules, 
  onToggleModule,
  customModules = [],
  onCreateCustomModule,
  onDeleteCustomModule,
  onSaveWidget,
}: AddModuleModalProps) {
  const [activeCategory, setActiveCategory] = useState<string>('financial');
  const [showBuilder, setShowBuilder] = useState(false);
  const [showWidgetBuilder, setShowWidgetBuilder] = useState(false);

  const modulesByCategory = allModules.reduce((acc, module) => {
    if (!acc[module.category]) {
      acc[module.category] = [];
    }
    acc[module.category].push(module);
    return acc;
  }, {} as Record<string, ModuleDefinition[]>);

  const handleCreateModule = (data: {
    title: string;
    moduleType: string;
    visualizationType: VisualizationType;
    filters: Record<string, any>;
    chartConfig: ChartConfig;
  }) => {
    onCreateCustomModule?.(data);
    setShowBuilder(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Customize Dashboard</DialogTitle>
          <DialogDescription>
            Add modules, create custom views, or build widgets to personalize your dashboard.
          </DialogDescription>
        </DialogHeader>

        {showWidgetBuilder ? (
          <WidgetBuilder
            open={true}
            onOpenChange={(isOpen) => {
              if (!isOpen) setShowWidgetBuilder(false);
            }}
            onSave={async (widgetData) => {
              await onSaveWidget?.(widgetData);
              setShowWidgetBuilder(false);
            }}
            isEditing={false}
          />
        ) : showBuilder ? (
          <ScrollArea className="h-[600px]">
            <EnhancedModuleBuilder
              onSave={handleCreateModule}
              onCancel={() => setShowBuilder(false)}
            />
          </ScrollArea>
        ) : (
          <Tabs value={activeCategory} onValueChange={setActiveCategory} className="w-full">
            <TabsList className="grid w-full grid-cols-7">
              <TabsTrigger value="financial" data-testid="tab-financial">Financial</TabsTrigger>
              <TabsTrigger value="dd" data-testid="tab-dd">DD</TabsTrigger>
              <TabsTrigger value="crm" data-testid="tab-crm">CRM</TabsTrigger>
              <TabsTrigger value="intel" data-testid="tab-intel">Intel</TabsTrigger>
              <TabsTrigger value="operations" data-testid="tab-operations">Ops</TabsTrigger>
              <TabsTrigger value="custom" data-testid="tab-custom">Custom</TabsTrigger>
              <TabsTrigger value="widgets" data-testid="tab-widgets">Widgets</TabsTrigger>
            </TabsList>

          <ScrollArea className="h-[400px] mt-4">
            {Object.entries(modulesByCategory).map(([category, modules]) => (
              <TabsContent key={category} value={category} className="mt-0">
                <div className="grid grid-cols-2 gap-4">
                  {modules.map((module) => {
                    const isSelected = selectedModules.includes(module.id);
                    const Icon = module.icon;
                    
                    return (
                      <Card
                        key={module.id}
                        className={cn(
                          "p-4 cursor-pointer hover:border-blue-500 transition-all relative",
                          isSelected && "border-blue-500 bg-blue-50"
                        )}
                        onClick={() => onToggleModule(module.id)}
                        data-testid={`module-card-${module.id}`}
                      >
                        {isSelected && (
                          <div className="absolute top-2 right-2 bg-blue-500 text-white rounded-full p-1">
                            <Check className="h-3 w-3" />
                          </div>
                        )}
                        
                        <div className="flex items-start gap-3">
                          <div className={cn(
                            "p-2 rounded-lg",
                            isSelected ? "bg-blue-100" : "bg-gray-100"
                          )}>
                            <Icon className={cn(
                              "h-5 w-5",
                              isSelected ? "text-blue-600" : "text-gray-600"
                            )} />
                          </div>
                          
                          <div className="flex-1">
                            <h4 className="font-medium text-sm mb-1">{module.title}</h4>
                            <p className="text-xs text-gray-600">{module.description}</p>
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </TabsContent>
            ))}
            
            <TabsContent value="custom" className="mt-0">
              <div className="space-y-4">
                <Button 
                  onClick={() => setShowBuilder(true)}
                  className="w-full"
                  data-testid="button-create-custom"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create Custom Module
                </Button>

                {customModules.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p className="text-sm">No custom modules yet</p>
                    <p className="text-xs mt-1">Create your first custom module with filters</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-3">
                    {customModules.map((module) => {
                      const isSelected = selectedModules.includes(`custom-${module.id}`);
                      
                      return (
                        <Card
                          key={module.id}
                          className={cn(
                            "p-4 cursor-pointer hover:border-blue-500 transition-all relative",
                            isSelected && "border-blue-500 bg-blue-50"
                          )}
                          onClick={() => onToggleModule(`custom-${module.id}`)}
                          data-testid={`custom-module-card-${module.id}`}
                        >
                          {isSelected && (
                            <div className="absolute top-2 right-2 bg-blue-500 text-white rounded-full p-1">
                              <Check className="h-3 w-3" />
                            </div>
                          )}
                          
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1">
                              <h4 className="font-medium text-sm mb-1">{module.title}</h4>
                              <p className="text-xs text-gray-600 capitalize">
                                Source: {module.moduleType.replace(/([A-Z])/g, ' $1').trim()}
                              </p>
                              {Object.keys(module.filters).length > 0 && (
                                <div className="mt-2 flex flex-wrap gap-1">
                                  {Object.entries(module.filters).map(([key, value]) => (
                                    <span
                                      key={key}
                                      className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-700"
                                    >
                                      {key}: {typeof value === 'object' ? 'custom' : String(value)}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                            
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (onDeleteCustomModule && confirm('Delete this custom module?')) {
                                  onDeleteCustomModule(module.id);
                                }
                              }}
                              data-testid={`button-delete-${module.id}`}
                            >
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </div>
            </TabsContent>
            
            <TabsContent value="widgets" className="mt-0">
              <div className="space-y-4">
                <Button 
                  onClick={() => setShowWidgetBuilder(true)}
                  className="w-full"
                  data-testid="button-create-widget"
                >
                  <BarChart3 className="h-4 w-4 mr-2" />
                  Create Custom Widget
                </Button>

                <div className="text-center py-8 text-gray-500">
                  <Layers className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p className="text-sm font-medium mb-2">Build Custom Widgets</p>
                  <p className="text-xs text-gray-400 max-w-sm mx-auto">
                    Create KPI cards, charts, and stat grids with custom metrics, 
                    filters, and comparison settings.
                  </p>
                  <div className="flex justify-center gap-4 mt-4">
                    <div className="flex items-center gap-1.5 text-xs text-gray-500">
                      <BarChart3 className="h-3.5 w-3.5" />
                      <span>Bar Charts</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-gray-500">
                      <TrendingUp className="h-3.5 w-3.5" />
                      <span>Line Charts</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-gray-500">
                      <PieChart className="h-3.5 w-3.5" />
                      <span>Pie Charts</span>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>
          </ScrollArea>
        </Tabs>
        )}

        {!showBuilder && !showWidgetBuilder && (
          <div className="flex justify-between items-center pt-4 border-t">
            <div className="text-sm text-gray-600">
              {selectedModules.length} module{selectedModules.length !== 1 ? 's' : ''} selected
            </div>
            <Button onClick={() => onOpenChange(false)} data-testid="button-done">
              Done
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
