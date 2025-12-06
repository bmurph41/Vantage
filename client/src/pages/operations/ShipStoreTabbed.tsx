import { lazy } from "react";
import { useQuery } from "@tanstack/react-query";
import { ShoppingCart, LayoutDashboard, CreditCard, Box, Receipt, BarChart3, FileText } from "lucide-react";
import { TabbedModuleLayout, TabDefinition } from "@/components/layout/TabbedModuleLayout";

const ShipStoreDashboard = lazy(() => import("./ship-store/Dashboard"));
const ShipStorePOS = lazy(() => import("./ship-store/POS"));
const ShipStoreInventory = lazy(() => import("./ship-store/Inventory"));
const ShipStoreTransactions = lazy(() => import("./ship-store/Transactions"));
const ShipStoreAnalytics = lazy(() => import("./ship-store/Analytics"));
const ShipStoreReports = lazy(() => import("./ship-store/Reports"));

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

export default function ShipStoreTabbed() {
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
      component: ShipStoreDashboard,
      description: "Overview of ship store performance",
    },
    {
      id: "pos",
      label: "Point of Sale",
      icon: CreditCard,
      component: ShipStorePOS,
      description: "Process sales and checkout",
    },
    {
      id: "inventory",
      label: "Inventory",
      icon: Box,
      component: ShipStoreInventory,
      description: "Manage product inventory",
    },
    {
      id: "transactions",
      label: "Transactions",
      icon: Receipt,
      component: ShipStoreTransactions,
      description: "View sales history",
    },
    {
      id: "analytics",
      label: "Analytics",
      icon: BarChart3,
      component: ShipStoreAnalytics,
      description: "Sales analytics and insights",
    },
    {
      id: "reports",
      label: "Reports",
      icon: FileText,
      component: ShipStoreReports,
      description: "Generate and export reports",
    },
  ];

  return (
    <TabbedModuleLayout
      moduleName="Ship Store"
      moduleDescription="Manage ship store inventory, sales, and POS"
      moduleIcon={ShoppingCart}
      tabs={tabs}
      defaultTab="dashboard"
      basePath="/operations/ship-store"
      activePacks={activePacks}
    />
  );
}
