import { lazy } from "react";
import { useQuery } from "@tanstack/react-query";
import { Store, LayoutDashboard, Users, Wrench } from "lucide-react";
import { TabbedModuleLayout, TabDefinition } from "@/components/layout/TabbedModuleLayout";

const RetailOfficeDashboard = lazy(() => import("./retail-office/Dashboard"));
const RetailOfficeTenants = lazy(() => import("./retail-office/Tenants"));
const RetailOfficeTITracking = lazy(() => import("./retail-office/TITracking"));

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

export default function RetailOfficeTabbed() {
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
      component: RetailOfficeDashboard,
      description: "Retail/Office operations overview and KPIs",
    },
    {
      id: "tenants",
      label: "Tenants",
      icon: Users,
      component: RetailOfficeTenants,
      description: "Tenant management and lease tracking",
    },
    {
      id: "ti-tracking",
      label: "TI Tracking",
      icon: Wrench,
      component: RetailOfficeTITracking,
      description: "Tenant improvement allowance tracking",
    },
  ];

  return (
    <TabbedModuleLayout
      moduleName="Retail / Office Operations"
      moduleDescription="Manage commercial tenants, leases, and tenant improvements"
      moduleIcon={Store}
      tabs={tabs}
      defaultTab="dashboard"
      basePath="/operations/retail-office"
      activePacks={activePacks}
    />
  );
}
