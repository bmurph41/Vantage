import { useQuery } from "@tanstack/react-query";
import { Wrench, LayoutDashboard, ClipboardList, Calendar, Users, Box, FileText, Receipt, BarChart3 } from "lucide-react";
import { TabbedModuleLayout, TabDefinition, PlaceholderTab } from "@/components/layout/TabbedModuleLayout";

function ServiceDashboard() {
  return (
    <PlaceholderTab
      title="Service Dashboard"
      description="Overview of service department operations, technician productivity, and work order status."
      icon={LayoutDashboard}
      features={[
        "Real-time work order status board",
        "Technician workload and availability",
        "Revenue and labor metrics",
        "Customer satisfaction tracking",
        "Parts usage and inventory alerts",
      ]}
      integrationReady
    />
  );
}

function ServiceWorkOrders() {
  return (
    <PlaceholderTab
      title="Work Orders"
      description="Create, manage, and track service work orders from intake to completion."
      icon={ClipboardList}
      features={[
        "Work order creation and assignment",
        "Multi-step approval workflows",
        "Photo and video documentation",
        "Parts and labor tracking",
        "Customer communication history",
        "Work order templates for common services",
      ]}
      integrationReady
    />
  );
}

function ServiceScheduling() {
  return (
    <PlaceholderTab
      title="Scheduling"
      description="Schedule service appointments and manage technician calendars."
      icon={Calendar}
      features={[
        "Drag-and-drop scheduling calendar",
        "Technician availability management",
        "Service bay allocation",
        "Appointment reminders and notifications",
        "Recurring maintenance scheduling",
        "Integration with customer communication",
      ]}
      integrationReady
    />
  );
}

function ServiceCustomers() {
  return (
    <PlaceholderTab
      title="Customers"
      description="Manage service customers, boats, and service history."
      icon={Users}
      features={[
        "Customer profile management",
        "Boat/vessel information and specs",
        "Complete service history by vessel",
        "Warranty tracking",
        "Customer preferences and notes",
        "Integration with CRM contacts",
      ]}
      integrationReady
    />
  );
}

function ServiceInventory() {
  return (
    <PlaceholderTab
      title="Parts Inventory"
      description="Manage parts inventory, vendors, and reordering."
      icon={Box}
      features={[
        "Parts catalog with pricing",
        "Inventory levels and reorder points",
        "Vendor management",
        "Purchase order creation",
        "Parts usage tracking by work order",
        "Integration with ship store inventory",
      ]}
      integrationReady
    />
  );
}

function ServiceEstimates() {
  return (
    <PlaceholderTab
      title="Estimates"
      description="Create and manage service estimates for customers."
      icon={FileText}
      features={[
        "Estimate builder with labor and parts",
        "Estimate approval workflow",
        "Convert estimates to work orders",
        "Email estimates to customers",
        "Estimate templates",
        "Margin and markup calculations",
      ]}
      integrationReady
    />
  );
}

function ServiceInvoicing() {
  return (
    <PlaceholderTab
      title="Invoicing"
      description="Generate invoices and process payments for completed work."
      icon={Receipt}
      features={[
        "Invoice generation from work orders",
        "Payment processing integration",
        "Payment plan support",
        "Accounts receivable tracking",
        "Invoice email and printing",
        "Integration with QuickBooks/Xero",
      ]}
      integrationReady
    />
  );
}

function ServiceReports() {
  return (
    <PlaceholderTab
      title="Reports"
      description="Service department analytics and reporting."
      icon={BarChart3}
      features={[
        "Revenue by service type",
        "Technician productivity reports",
        "Labor efficiency metrics",
        "Parts profitability analysis",
        "Customer satisfaction trends",
        "Work order aging reports",
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

export default function ServiceTabbed() {
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
      component: ServiceDashboard,
      description: "Service department overview",
    },
    {
      id: "work-orders",
      label: "Work Orders",
      icon: ClipboardList,
      component: ServiceWorkOrders,
      description: "Manage service work orders",
    },
    {
      id: "scheduling",
      label: "Scheduling",
      icon: Calendar,
      component: ServiceScheduling,
      description: "Service appointment scheduling",
    },
    {
      id: "customers",
      label: "Customers",
      icon: Users,
      component: ServiceCustomers,
      description: "Service customer management",
    },
    {
      id: "inventory",
      label: "Parts Inventory",
      icon: Box,
      component: ServiceInventory,
      description: "Parts and supplies inventory",
    },
    {
      id: "estimates",
      label: "Estimates",
      icon: FileText,
      component: ServiceEstimates,
      description: "Service estimates and quotes",
    },
    {
      id: "invoicing",
      label: "Invoicing",
      icon: Receipt,
      component: ServiceInvoicing,
      description: "Billing and payments",
    },
    {
      id: "reports",
      label: "Reports",
      icon: BarChart3,
      component: ServiceReports,
      description: "Service analytics",
    },
  ];

  return (
    <TabbedModuleLayout
      moduleName="Service Department"
      moduleDescription="Boat service, repair, and maintenance management"
      moduleIcon={Wrench}
      tabs={tabs}
      defaultTab="dashboard"
      basePath="/operations/service"
      activePacks={activePacks}
    />
  );
}
