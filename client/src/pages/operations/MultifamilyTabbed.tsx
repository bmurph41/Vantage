import { lazy } from "react";
import { useQuery } from "@tanstack/react-query";
import { Home, LayoutDashboard, Building2, CalendarClock, RefreshCcw } from "lucide-react";
import { TabbedModuleLayout, TabDefinition } from "@/components/layout/TabbedModuleLayout";

const MultifamilyDashboard = lazy(() => import("./multifamily/Dashboard"));
const MultifamilyUnits = lazy(() => import("./multifamily/Units"));
const MultifamilyLeaseExpiry = lazy(() => import("./multifamily/LeaseExpiry"));
const MultifamilyTurnTracking = lazy(() => import("./multifamily/TurnTracking"));

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

export default function MultifamilyTabbed() {
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
      component: MultifamilyDashboard,
      description: "Multifamily operations overview and KPIs",
    },
    {
      id: "units",
      label: "Units",
      icon: Building2,
      component: MultifamilyUnits,
      description: "Unit inventory and tenant management",
    },
    {
      id: "lease-expiry",
      label: "Lease Expiry",
      icon: CalendarClock,
      component: MultifamilyLeaseExpiry,
      description: "Lease expiration tracking and renewal management",
    },
    {
      id: "turn-tracking",
      label: "Turn Tracking",
      icon: RefreshCcw,
      component: MultifamilyTurnTracking,
      description: "Unit turnover tracking and cost management",
    },
  ];

  return (
    <TabbedModuleLayout
      moduleName="Multifamily Operations"
      moduleDescription="Manage units, leases, and tenant operations"
      moduleIcon={Home}
      tabs={tabs}
      defaultTab="dashboard"
      basePath="/operations/multifamily"
      activePacks={activePacks}
    />
  );
}
