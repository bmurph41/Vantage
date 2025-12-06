import { lazy } from "react";
import { useQuery } from "@tanstack/react-query";
import { Building2, FolderKanban, Users } from "lucide-react";
import { TabbedModuleLayout, TabDefinition } from "@/components/layout/TabbedModuleLayout";

const RentRollPortfolio = lazy(() => import("./rent-roll/Portfolio"));
const RentRollProjects = lazy(() => import("./rent-roll/Projects"));
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
      id: "portfolio",
      label: "Portfolio",
      icon: Building2,
      component: RentRollPortfolio,
      description: "View rent roll across all properties",
    },
    {
      id: "projects",
      label: "Projects",
      icon: FolderKanban,
      component: RentRollProjects,
      description: "Manage rent roll by project",
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
      defaultTab="portfolio"
      basePath="/operations/rent-roll"
      activePacks={activePacks}
    />
  );
}
