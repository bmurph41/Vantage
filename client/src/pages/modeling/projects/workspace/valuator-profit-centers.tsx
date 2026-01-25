import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, Fuel, ShoppingCart, Wrench, Ship, TrendingUp } from "lucide-react";
import ValuatorFuelSalesTab from "./valuator-fuel-sales";
import ValuatorShipStoreTab from "./valuator-ship-store";
import ValuatorOperationsSummary from "./valuator-operations-summary";
import ValuatorServiceDeptTab from "./valuator-service-dept";
import ValuatorBoatRentalsTab from "./valuator-boat-rentals";

interface ValuatorProfitCentersProps {
  projectId: string;
  projectName: string;
}

export default function ValuatorProfitCenters({ projectId, projectName }: ValuatorProfitCentersProps) {
  const [activeSubTab, setActiveSubTab] = useState("summary");

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
            <TabsList className="grid w-full grid-cols-5 mb-6">
              <TabsTrigger value="summary" className="gap-2">
                <BarChart3 className="h-4 w-4" />
                <span className="hidden sm:inline">Summary</span>
              </TabsTrigger>
              <TabsTrigger value="fuel" className="gap-2">
                <Fuel className="h-4 w-4" />
                <span className="hidden sm:inline">Fuel Sales</span>
              </TabsTrigger>
              <TabsTrigger value="store" className="gap-2">
                <ShoppingCart className="h-4 w-4" />
                <span className="hidden sm:inline">Ship Store</span>
              </TabsTrigger>
              <TabsTrigger value="service" className="gap-2">
                <Wrench className="h-4 w-4" />
                <span className="hidden sm:inline">Service Dept</span>
              </TabsTrigger>
              <TabsTrigger value="rentals" className="gap-2">
                <Ship className="h-4 w-4" />
                <span className="hidden sm:inline">Boat Rentals</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="summary" className="mt-0">
              <ValuatorOperationsSummary projectId={projectId} projectName={projectName} />
            </TabsContent>

            <TabsContent value="fuel" className="mt-0">
              <ValuatorFuelSalesTab projectId={projectId} projectName={projectName} />
            </TabsContent>

            <TabsContent value="store" className="mt-0">
              <ValuatorShipStoreTab projectId={projectId} projectName={projectName} />
            </TabsContent>

            <TabsContent value="service" className="mt-0">
              <ValuatorServiceDeptTab projectId={projectId} projectName={projectName} />
            </TabsContent>

            <TabsContent value="rentals" className="mt-0">
              <ValuatorBoatRentalsTab projectId={projectId} projectName={projectName} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
