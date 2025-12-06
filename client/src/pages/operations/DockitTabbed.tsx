import { lazy } from "react";
import { useQuery } from "@tanstack/react-query";
import { Anchor, LayoutDashboard, Calendar, Ship } from "lucide-react";
import { TabbedModuleLayout, TabDefinition } from "@/components/layout/TabbedModuleLayout";

const DockitDashboard = lazy(() => import("./dockit/Dashboard"));
const DockitLaunches = lazy(() => import("./dockit/Launches"));
const DockitSlips = lazy(() => import("./dockit/Slips"));

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

export default function DockitTabbed() {
  const { data: bootstrapData } = useQuery<BootstrapData>({
    queryKey: ['/api/bootstrap'],
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const activePacks = bootstrapData?.activePacks || [];

  const tabs: TabDefinition[] = [
    {
      id: "dashboard",
      label: "Launch Control",
      icon: LayoutDashboard,
      component: DockitDashboard,
      description: "Manage daily launch operations",
    },
    {
      id: "launches",
      label: "Launch Queue",
      icon: Calendar,
      component: DockitLaunches,
      description: "View and manage launch schedules",
    },
    {
      id: "slips",
      label: "Transient Slips",
      icon: Ship,
      component: DockitSlips,
      description: "Manage transient slip reservations",
    },
  ];

  return (
    <TabbedModuleLayout
      moduleName="Dockit"
      moduleDescription="Launch operations and transient slip management"
      moduleIcon={Anchor}
      tabs={tabs}
      defaultTab="dashboard"
      basePath="/operations/dockit"
      activePacks={activePacks}
    />
  );
}
