import { lazy } from "react";
import { useQuery } from "@tanstack/react-query";
import { Building2, FolderKanban, Users, BarChart3, LayoutDashboard } from "lucide-react";
import { TabbedModuleLayout, TabDefinition } from "@/components/layout/TabbedModuleLayout";

const RentRollDashboard = lazy(() => import("./rent-roll/Dashboard"));
const RentRollPortfolio = lazy(() => import("./rent-roll/Portfolio"));
const RentRollProjects = lazy(() => import("./rent-roll/Projects"));
const RentRollComparison = lazy(() => import("./rent-roll/Comparison"));
const CustomerAnalytics = lazy(() => import("./CustomerAnalytics"));

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

export default function RentRollTabbed() {
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
      component: RentRollDashboard,
      description: "Portfolio KPIs, occupancy, and lease analytics",
    },
    {
      id: "projects",
      label: "Projects",
      icon: FolderKanban,
      component: RentRollProjects,
      description: "Manage rent roll by project",
    },
    {
      id: "portfolio",
      label: "Portfolio",
      icon: Building2,
      component: RentRollPortfolio,
      description: "View rent roll across all properties",
    },
    {
      id: "comparison",
      label: "Comparison",
      icon: BarChart3,
      component: RentRollComparison,
      description: "Time-series analysis and portfolio comparison",
    },
    {
      id: "customer-analytics",
      label: "Customer Analytics",
      icon: Users,
      component: CustomerAnalytics,
      description: "Customer insights and analytics",
    },
  ];

  return (
    <TabbedModuleLayout
      moduleName="Rent Roll"
      moduleDescription="Manage marina rental units and occupancy"
      moduleIcon={Building2}
      tabs={tabs}
      defaultTab="dashboard"
      basePath="/operations/rent-roll"
      activePacks={activePacks}
    />
  );
}
