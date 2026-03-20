import { lazy } from "react";
import { useQuery } from "@tanstack/react-query";
import { Hotel, LayoutDashboard, BedDouble, DollarSign } from "lucide-react";
import { TabbedModuleLayout, TabDefinition } from "@/components/layout/TabbedModuleLayout";

const HotelDashboard = lazy(() => import("./hotel/Dashboard"));
const HotelRooms = lazy(() => import("./hotel/Rooms"));
const HotelRevenueManagement = lazy(() => import("./hotel/RevenueManagement"));

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

export default function HotelTabbed() {
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
      component: HotelDashboard,
      description: "Hotel operations overview and KPIs",
    },
    {
      id: "rooms",
      label: "Rooms",
      icon: BedDouble,
      component: HotelRooms,
      description: "Room inventory and status management",
    },
    {
      id: "revenue-management",
      label: "Revenue Management",
      icon: DollarSign,
      component: HotelRevenueManagement,
      description: "Rate management and revenue optimization",
    },
  ];

  return (
    <TabbedModuleLayout
      moduleName="Hotel Operations"
      moduleDescription="Manage rooms, rates, and hotel revenue"
      moduleIcon={Hotel}
      tabs={tabs}
      defaultTab="dashboard"
      basePath="/operations/hotel"
      activePacks={activePacks}
    />
  );
}
