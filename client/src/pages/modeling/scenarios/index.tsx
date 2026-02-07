import { useState } from "react";
import { useLocation } from "wouter";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calculator, TrendingUp } from "lucide-react";
import { lazy, Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";

const DebtScenariosIndex = lazy(() => import("@/pages/modeling/debt-scenarios/Index"));
const ExitStrategiesIndex = lazy(() => import("@/pages/modeling/exit-strategies"));

const LoadingFallback = () => (
  <div className="p-6 space-y-4">
    <Skeleton className="h-8 w-48" />
    <Skeleton className="h-[400px] w-full" />
  </div>
);

export default function ScenariosPage() {
  const [location, setLocation] = useLocation();
  const isExitTab = location.includes('/modeling/scenarios/exit') || location.includes('/modeling/exit-strategies');
  const [activeTab, setActiveTab] = useState(isExitTab ? "exit" : "debt");

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    if (value === "debt") {
      setLocation("/modeling/scenarios");
    } else {
      setLocation("/modeling/scenarios/exit");
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Scenarios</h1>
        <p className="text-muted-foreground mt-1">
          Model debt structures and exit strategies for your marina acquisitions
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value="debt" className="gap-2">
            <Calculator className="h-4 w-4" />
            Debt Scenarios
          </TabsTrigger>
          <TabsTrigger value="exit" className="gap-2">
            <TrendingUp className="h-4 w-4" />
            Exit Strategies
          </TabsTrigger>
        </TabsList>
        <TabsContent value="debt" className="mt-4">
          <Suspense fallback={<LoadingFallback />}>
            <DebtScenariosIndex />
          </Suspense>
        </TabsContent>
        <TabsContent value="exit" className="mt-4">
          <Suspense fallback={<LoadingFallback />}>
            <ExitStrategiesIndex />
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  );
}
