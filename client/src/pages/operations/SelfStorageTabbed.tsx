import { lazy } from "react";
import { useQuery } from "@tanstack/react-query";
import { Warehouse, LayoutDashboard, Box, DollarSign } from "lucide-react";
import { TabbedModuleLayout, TabDefinition } from "@/components/layout/TabbedModuleLayout";

const SelfStorageDashboard = lazy(() => import("./self-storage/Dashboard"));
const SelfStorageUnits = lazy(() => import("./self-storage/Units"));
const SelfStorageRateManagement = lazy(() => import("./self-storage/RateManagement"));

type PackType = 'fund_management' | 'lp_portal' | 'prospecting' | 'analytics_pro';

type BootstrapData = {
  persona: any;
  features: any[];
  activePacks: PackType[];
  pendingCounts: {
    properties: number;
    contacts: number;
    companies: number;
  };
};

export default function SelfStorageTabbed() {
  const { data: bootstrapData } = useQuery<BootstrapData>({
    queryKey: ['/api/bootstrap'],
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const activePacks = bootstrapData?.activePacks || [];

  const tabs: TabDefinition[] = [
    {
      id: "dashboard",
      label: "Dashboard",
      icon: LayoutDashboard,
      component: SelfStorageDashboard,
      description: "Self-storage operations overview and KPIs",
    },
    {
      id: "units",
      label: "Units",
      icon: Box,
      component: SelfStorageUnits,
      description: "Unit inventory and tenant management",
    },
    {
      id: "rate-management",
      label: "Rate Management",
      icon: DollarSign,
      component: SelfStorageRateManagement,
      description: "Rate management and competitor analysis",
    },
  ];

  return (
    <TabbedModuleLayout
      moduleName="Self-Storage Operations"
      moduleDescription="Manage storage units, rates, and occupancy"
      moduleIcon={Warehouse}
      tabs={tabs}
      defaultTab="dashboard"
      basePath="/operations/self-storage"
      activePacks={activePacks}
    />
  );
}
