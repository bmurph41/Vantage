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
import { Check, DollarSign, FileText, Building2, TrendingUp, Home, Fuel, ShoppingCart, Store, Plus, Newspaper } from "lucide-react";
import { cn } from "@/lib/utils";

interface ModuleDefinition {
  id: string;
  title: string;
  description: string;
  icon: any;
  category: 'financial' | 'dd' | 'crm' | 'intel' | 'operations';
}

interface AddModuleModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedModules: string[];
  onToggleModule: (moduleId: string) => void;
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
    id: 'vdr',
    title: 'Virtual Data Room',
    description: 'Manage secure document sharing and data requests',
    icon: FileText,
    category: 'dd',
  },
  
  // CRM Modules
  {
    id: 'marketing',
    title: 'Marketing Campaigns',
    description: 'Track campaign performance and lead generation',
    icon: TrendingUp,
    category: 'crm',
  },
  
  // Intelligence Modules
  {
    id: 'docktalk',
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

export function AddModuleModal({ open, onOpenChange, selectedModules, onToggleModule }: AddModuleModalProps) {
  const [activeCategory, setActiveCategory] = useState<string>('financial');

  const modulesByCategory = allModules.reduce((acc, module) => {
    if (!acc[module.category]) {
      acc[module.category] = [];
    }
    acc[module.category].push(module);
    return acc;
  }, {} as Record<string, ModuleDefinition[]>);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Add Dashboard Modules</DialogTitle>
          <DialogDescription>
            Select modules to customize your dashboard. Choose from categorized libraries below.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeCategory} onValueChange={setActiveCategory} className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="financial" data-testid="tab-financial">Financial</TabsTrigger>
            <TabsTrigger value="dd" data-testid="tab-dd">DD</TabsTrigger>
            <TabsTrigger value="crm" data-testid="tab-crm">CRM</TabsTrigger>
            <TabsTrigger value="intel" data-testid="tab-intel">Intel</TabsTrigger>
            <TabsTrigger value="operations" data-testid="tab-operations">Operations</TabsTrigger>
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
          </ScrollArea>
        </Tabs>

        <div className="flex justify-between items-center pt-4 border-t">
          <div className="text-sm text-gray-600">
            {selectedModules.length} module{selectedModules.length !== 1 ? 's' : ''} selected
          </div>
          <Button onClick={() => onOpenChange(false)} data-testid="button-done">
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
