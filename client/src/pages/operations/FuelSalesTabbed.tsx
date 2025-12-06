import { lazy } from "react";
import { useQuery } from "@tanstack/react-query";
import { Fuel, LayoutDashboard, CreditCard, Box, BarChart3, FileText, Calculator, History, Shield, Settings } from "lucide-react";
import { TabbedModuleLayout, TabDefinition } from "@/components/layout/TabbedModuleLayout";

const FuelDashboard = lazy(() => import("./fuel/Dashboard"));
const FuelTransactions = lazy(() => import("./fuel/Transactions"));
const FuelInventory = lazy(() => import("./fuel/Inventory"));
const FuelAnalytics = lazy(() => import("./fuel/Analytics"));
const FuelReports = lazy(() => import("./fuel/Reports"));
const FuelFinancialModel = lazy(() => import("./fuel/FinancialModel"));
const FuelImportHistory = lazy(() => import("./fuel/ImportHistory"));
const FuelAuditTrail = lazy(() => import("./fuel/AuditTrail"));
const FuelIntegrationSettings = lazy(() => import("./fuel/IntegrationSettings"));

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

export default function FuelSalesTabbed() {
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
      component: FuelDashboard,
      description: "Overview of fuel sales performance",
    },
    {
      id: "transactions",
      label: "Transactions",
      icon: CreditCard,
      component: FuelTransactions,
      description: "View and manage fuel sale transactions",
    },
    {
      id: "inventory",
      label: "Inventory",
      icon: Box,
      component: FuelInventory,
      description: "Track fuel inventory levels and deliveries",
    },
    {
      id: "analytics",
      label: "Analytics",
      icon: BarChart3,
      component: FuelAnalytics,
      description: "Fuel sales analytics and insights",
    },
    {
      id: "reports",
      label: "Reports",
      icon: FileText,
      component: FuelReports,
      description: "Generate and export fuel sales reports",
    },
    {
      id: "financial-model",
      label: "Financial Model",
      icon: Calculator,
      component: FuelFinancialModel,
      description: "Financial modeling and projections",
    },
    {
      id: "import-history",
      label: "Import History",
      icon: History,
      component: FuelImportHistory,
      description: "View past data imports",
    },
    {
      id: "audit-trail",
      label: "Audit Trail",
      icon: Shield,
      component: FuelAuditTrail,
      description: "View audit logs and changes",
    },
    {
      id: "settings",
      label: "Settings",
      icon: Settings,
      component: FuelIntegrationSettings,
      description: "Configure fuel sales integrations",
    },
  ];

  return (
    <TabbedModuleLayout
      moduleName="Fuel Sales"
      moduleDescription="Manage fuel inventory, sales, and analytics"
      moduleIcon={Fuel}
      tabs={tabs}
      defaultTab="dashboard"
      basePath="/operations/fuel"
      activePacks={activePacks}
    />
  );
}
