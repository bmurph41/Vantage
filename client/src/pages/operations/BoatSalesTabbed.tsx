import { useQuery } from "@tanstack/react-query";
import { ShoppingBag, LayoutDashboard, Package, UserPlus, TrendingUp, CreditCard, ArrowLeftRight, Handshake, FileCheck, BarChart3, LineChart as LineChartIcon } from "lucide-react";
import BoatSalesAnalytics from "./boat-sales/Analytics";
import BoatSalesDashboard from "./boat-sales/Dashboard";
import { TabbedModuleLayout, TabDefinition, PlaceholderTab } from "@/components/layout/TabbedModuleLayout";

function SalesInventory() {
  return (
    <PlaceholderTab
      title="Inventory"
      description="Manage new and used boat inventory for sale."
      icon={Package}
      features={[
        "New and used boat listings",
        "Boat specifications and photos",
        "Pricing and cost tracking",
        "Floor plan and interest costs",
        "Inventory aging reports",
        "Market value comparisons",
        "Integration with boat listing sites",
        "QR codes for lot display",
      ]}
      integrationReady
    />
  );
}

function SalesLeads() {
  return (
    <PlaceholderTab
      title="Leads"
      description="Manage sales leads and customer inquiries."
      icon={UserPlus}
      features={[
        "Lead capture from websites",
        "Lead source tracking",
        "Lead scoring and qualification",
        "Automated follow-up sequences",
        "Lead assignment to sales reps",
        "Communication history",
        "Integration with CRM",
        "Boat show lead import",
      ]}
      integrationReady
    />
  );
}

function SalesPipeline() {
  return (
    <PlaceholderTab
      title="Sales Pipeline"
      description="Track deals through the sales process."
      icon={TrendingUp}
      features={[
        "Visual deal pipeline",
        "Deal stage management",
        "Win/loss tracking",
        "Sales activity logging",
        "Deal value and margin tracking",
        "Sales forecasting",
        "Rep performance dashboards",
        "Quota tracking",
      ]}
      integrationReady
    />
  );
}

function SalesFinancing() {
  return (
    <PlaceholderTab
      title="Financing"
      description="Manage boat financing and lender relationships."
      icon={CreditCard}
      features={[
        "Financing application processing",
        "Multi-lender submissions",
        "Credit decision tracking",
        "Rate and term comparison",
        "Lender reserve tracking",
        "F&I product upsells",
        "Documentation management",
        "Integration with marine lenders",
      ]}
      integrationReady
    />
  );
}

function SalesTradeIns() {
  return (
    <PlaceholderTab
      title="Trade-ins"
      description="Evaluate and manage trade-in boats."
      icon={ArrowLeftRight}
      features={[
        "Trade-in appraisal workflow",
        "Market value analysis",
        "Condition assessment",
        "Photo documentation",
        "Payoff verification",
        "Title status check",
        "Reconditioning estimates",
        "Wholesale vs retail valuation",
      ]}
      integrationReady
    />
  );
}

function SalesBrokerage() {
  return (
    <PlaceholderTab
      title="Brokerage"
      description="Manage consignment and brokerage listings."
      icon={Handshake}
      features={[
        "Consignment agreements",
        "Listing management",
        "Commission tracking",
        "Owner communications",
        "Showing scheduling",
        "Price change history",
        "Marketing exposure tracking",
        "Co-brokerage deals",
      ]}
      integrationReady
    />
  );
}

function SalesClosings() {
  return (
    <PlaceholderTab
      title="Closings"
      description="Manage deal closing and documentation."
      icon={FileCheck}
      features={[
        "Deal jacket management",
        "Document checklist tracking",
        "Title and registration processing",
        "Delivery scheduling",
        "Customer orientation tracking",
        "Post-sale follow-up",
        "CSI survey tracking",
        "Integration with state DMV systems",
      ]}
      integrationReady
    />
  );
}

function SalesReports() {
  return (
    <PlaceholderTab
      title="Reports"
      description="Sales analytics and performance reporting."
      icon={BarChart3}
      features={[
        "Sales by rep and period",
        "Gross profit analysis",
        "Inventory turn rates",
        "Lead source ROI",
        "F&I penetration rates",
        "Days to sale metrics",
        "Margin by boat category",
        "Year-over-year comparisons",
      ]}
      integrationReady
    />
  );
}

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

export default function BoatSalesTabbed() {
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
      component: BoatSalesDashboard,
      description: "Sales overview",
    },
    {
      id: "inventory",
      label: "Inventory",
      icon: Package,
      component: SalesInventory,
      description: "Boats for sale",
    },
    {
      id: "leads",
      label: "Leads",
      icon: UserPlus,
      component: SalesLeads,
      description: "Sales leads",
    },
    {
      id: "pipeline",
      label: "Sales Pipeline",
      icon: TrendingUp,
      component: SalesPipeline,
      description: "Deal tracking",
    },
    {
      id: "financing",
      label: "Financing",
      icon: CreditCard,
      component: SalesFinancing,
      description: "Boat loans",
    },
    {
      id: "trade-ins",
      label: "Trade-ins",
      icon: ArrowLeftRight,
      component: SalesTradeIns,
      description: "Trade appraisals",
    },
    {
      id: "brokerage",
      label: "Brokerage",
      icon: Handshake,
      component: SalesBrokerage,
      description: "Consignments",
    },
    {
      id: "closings",
      label: "Closings",
      icon: FileCheck,
      component: SalesClosings,
      description: "Deal closing",
    },
    {
      id: "reports",
      label: "Reports",
      icon: BarChart3,
      component: SalesReports,
      description: "Sales analytics",
    },
    {
      id: "analytics",
      label: "Analytics",
      icon: LineChartIcon,
      component: BoatSalesAnalytics,
      description: "Sales analytics charts",
    },
  ];

  return (
    <TabbedModuleLayout
      moduleName="Boat Sales"
      moduleDescription="New and used boat sales, financing, and brokerage"
      moduleIcon={ShoppingBag}
      tabs={tabs}
      defaultTab="dashboard"
      basePath="/operations/boat-sales"
      activePacks={activePacks}
    />
  );
}
