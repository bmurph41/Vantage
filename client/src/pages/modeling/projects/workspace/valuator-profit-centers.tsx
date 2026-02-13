import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, Fuel, ShoppingCart, Wrench, Ship, TrendingUp, BookOpen, Users, Store, FileText, Sailboat, Utensils, Car, Home } from "lucide-react";
import ValuatorFuelSalesTab from "./valuator-fuel-sales";
import ValuatorShipStoreTab from "./valuator-ship-store";
import ValuatorOperationsSummary from "./valuator-operations-summary";
import ValuatorServiceDeptTab from "./valuator-service-dept";
import ValuatorBoatRentalsTab from "./valuator-boat-rentals";
import ValuatorBookkeepingTab from "./valuator-bookkeeping";
import type { ProjectConfig } from "@/types/modeling";

interface ValuatorProfitCentersProps {
  projectId: string;
  projectName: string;
}

type ProfitCenterTab = {
  id: string;
  configKey: string;
  label: string;
  icon: any;
  component: (props: { projectId: string; projectName: string }) => JSX.Element;
};

const ALL_PROFIT_CENTER_TABS: ProfitCenterTab[] = [
  { id: "fuel", configKey: "pc_fuel_dock", label: "Fuel Sales", icon: Fuel, component: ValuatorFuelSalesTab },
  { id: "store", configKey: "pc_ships_store", label: "Ship Store", icon: ShoppingCart, component: ValuatorShipStoreTab },
  { id: "service", configKey: "pc_service", label: "Service Dept", icon: Wrench, component: ValuatorServiceDeptTab },
  { id: "rentals", configKey: "pc_rental_boats", label: "Boat Rentals", icon: Ship, component: ValuatorBoatRentalsTab },
  { id: "bookkeeping", configKey: "pc_boat_finance", label: "Bookkeeping", icon: BookOpen, component: ValuatorBookkeepingTab },
];

export default function ValuatorProfitCenters({ projectId, projectName }: ValuatorProfitCentersProps) {
  const [activeSubTab, setActiveSubTab] = useState("summary");

  const { data: config } = useQuery<ProjectConfig>({
    queryKey: ['/api/modeling/projects', projectId, 'config'],
  });

  const enabledTabs = useMemo(() => {
    if (!config?.profitCenters) return ALL_PROFIT_CENTER_TABS;
    return ALL_PROFIT_CENTER_TABS.filter(tab => {
      const pcConfig = config.profitCenters?.[tab.configKey];
      return pcConfig?.isEnabled === true;
    });
  }, [config?.profitCenters]);

  useEffect(() => {
    if (activeSubTab !== "summary" && !enabledTabs.some(t => t.id === activeSubTab)) {
      setActiveSubTab("summary");
    }
  }, [enabledTabs, activeSubTab]);

  const totalCols = enabledTabs.length + 1;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Profit Centers
              </CardTitle>
              <CardDescription>
                Manage ancillary revenue streams for {projectName}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <Tabs value={activeSubTab} onValueChange={setActiveSubTab}>
            <TabsList className={`grid w-full mb-6`} style={{ gridTemplateColumns: `repeat(${totalCols}, minmax(0, 1fr))` }}>
              <TabsTrigger value="summary" className="gap-2">
                <BarChart3 className="h-4 w-4" />
                <span className="hidden sm:inline">Summary</span>
              </TabsTrigger>
              {enabledTabs.map(tab => {
                const Icon = tab.icon;
                return (
                  <TabsTrigger key={tab.id} value={tab.id} className="gap-2">
                    <Icon className="h-4 w-4" />
                    <span className="hidden sm:inline">{tab.label}</span>
                  </TabsTrigger>
                );
              })}
            </TabsList>

            <TabsContent value="summary" className="mt-0">
              <ValuatorOperationsSummary projectId={projectId} projectName={projectName} />
            </TabsContent>

            {enabledTabs.map(tab => {
              const Component = tab.component;
              return (
                <TabsContent key={tab.id} value={tab.id} className="mt-0">
                  <Component projectId={projectId} projectName={projectName} />
                </TabsContent>
              );
            })}
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
