import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart3, Fuel, ShoppingCart, Wrench, Ship, TrendingUp, BookOpen, Anchor, Building2, DollarSign, Sailboat } from "lucide-react";
import ValuatorFuelSalesTab from "./valuator-fuel-sales";
import ValuatorShipStoreTab from "./valuator-ship-store";
import ValuatorOperationsSummary from "./valuator-operations-summary";
import ValuatorServiceDeptTab from "./valuator-service-dept";
import ValuatorBoatRentalsTab from "./valuator-boat-rentals";
import ValuatorBookkeepingTab from "./valuator-bookkeeping";
import ValuatorCommercialTenantsTab from "./valuator-commercial-tenants";
import RentRollDataTab from "./rent-roll-data";
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

const ANCILLARY_PROFIT_CENTER_TABS: ProfitCenterTab[] = [
  { id: "storage-leases", configKey: "__storageMix", label: "Storage Leases", icon: Anchor, component: RentRollDataTab },
  { id: "commercial-leases", configKey: "commercialTenants", label: "Commercial Leases", icon: Building2, component: ValuatorCommercialTenantsTab },
  { id: "fuel", configKey: "fuelSales", label: "Fuel Sales", icon: Fuel, component: ValuatorFuelSalesTab },
  { id: "store", configKey: "shipStore", label: "Ship Store", icon: ShoppingCart, component: ValuatorShipStoreTab },
  { id: "service", configKey: "serviceDepartment", label: "Service Dept", icon: Wrench, component: ValuatorServiceDeptTab },
  { id: "rentals", configKey: "boatRentals", label: "Boat Rentals", icon: Ship, component: ValuatorBoatRentalsTab },
  { id: "bookkeeping", configKey: "boatClub", label: "Boat Club", icon: Sailboat, component: ValuatorBookkeepingTab },
  { id: "boat-sales", configKey: "boatSales", label: "Boat Sales", icon: DollarSign, component: ValuatorBookkeepingTab },
];

function isProfitCenterEnabled(
  tab: ProfitCenterTab,
  config: ProjectConfig | undefined
): boolean {
  if (!config) return false;

  if (tab.configKey === "__storageMix") {
    const mix = config.storageMix;
    return !!(mix?.items && mix.items.length > 0);
  }

  const profitCenters = config.profitCenters;
  if (!profitCenters) return false;

  if (Array.isArray(profitCenters)) {
    return profitCenters.some(
      (pc) => pc.id === tab.configKey && pc.enabled
    );
  }

  const pcConfig = profitCenters[tab.configKey];
  return pcConfig?.enabled === true;
}

export default function ValuatorProfitCenters({ projectId, projectName }: ValuatorProfitCentersProps) {
  const [activeSubTab, setActiveSubTab] = useState("summary");

  const { data: config, isLoading } = useQuery<ProjectConfig>({
    queryKey: ['/api/modeling/projects', projectId, 'config'],
  });

  const enabledTabs = useMemo(() => {
    if (!config) return [];
    return ANCILLARY_PROFIT_CENTER_TABS.filter(tab =>
      isProfitCenterEnabled(tab, config)
    );
  }, [config]);

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
            {enabledTabs.length > 0 && (
              <Badge variant="secondary">{enabledTabs.length} active</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {enabledTabs.length === 0 && !isLoading ? (
            <div className="text-center py-12 text-muted-foreground">
              <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-40" />
              <p className="text-lg font-medium mb-1">No Profit Centers Enabled</p>
              <p className="text-sm">
                Enable profit centers in the project setup wizard to see them here.
              </p>
            </div>
          ) : (
            <Tabs value={activeSubTab} onValueChange={setActiveSubTab}>
              <TabsList className="grid w-full mb-6" style={{ gridTemplateColumns: `repeat(${totalCols}, minmax(0, 1fr))` }}>
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
          )}
        </CardContent>
      </Card>
    </div>
  );
}
