import { useQuery } from "@tanstack/react-query";
import { Ship, LayoutDashboard, Calendar, Anchor, Users, DollarSign, ClipboardCheck, BarChart3 } from "lucide-react";
import { TabbedModuleLayout, TabDefinition, PlaceholderTab } from "@/components/layout/TabbedModuleLayout";

function RentalsDashboard() {
  return (
    <PlaceholderTab
      title="Rentals Dashboard"
      description="Overview of boat rental operations, fleet availability, and revenue performance."
      icon={LayoutDashboard}
      features={[
        "Real-time fleet availability status",
        "Today's reservations and returns",
        "Revenue metrics and trends",
        "Weather integration for safety alerts",
        "Utilization rate tracking",
      ]}
      integrationReady
    />
  );
}

function RentalsReservations() {
  return (
    <PlaceholderTab
      title="Reservations"
      description="Manage boat rental reservations and booking calendar."
      icon={Calendar}
      features={[
        "Online booking calendar",
        "Reservation management",
        "Multi-day and hourly rentals",
        "Waitlist management",
        "Automated confirmation emails",
        "Deposit and payment processing",
        "Cancellation and refund handling",
      ]}
      integrationReady
    />
  );
}

function RentalsFleet() {
  return (
    <PlaceholderTab
      title="Fleet"
      description="Manage your rental boat fleet inventory and maintenance."
      icon={Anchor}
      features={[
        "Fleet inventory management",
        "Boat specifications and photos",
        "Maintenance scheduling",
        "Damage and incident tracking",
        "Fuel level monitoring",
        "Equipment and safety gear checklists",
        "Insurance and registration tracking",
      ]}
      integrationReady
    />
  );
}

function RentalsCustomers() {
  return (
    <PlaceholderTab
      title="Customers"
      description="Manage rental customers and their booking history."
      icon={Users}
      features={[
        "Customer profile management",
        "Boating experience verification",
        "License and certification tracking",
        "Rental history and preferences",
        "Waivers and agreements",
        "Loyalty program tracking",
        "Integration with CRM",
      ]}
      integrationReady
    />
  );
}

function RentalsPricing() {
  return (
    <PlaceholderTab
      title="Pricing"
      description="Configure rental rates and pricing strategies."
      icon={DollarSign}
      features={[
        "Hourly, half-day, and daily rates",
        "Seasonal pricing adjustments",
        "Weekend and holiday premiums",
        "Package deals and promotions",
        "Fuel surcharge settings",
        "Damage deposit configuration",
        "Add-on equipment pricing",
      ]}
      integrationReady
    />
  );
}

function RentalsCheckInOut() {
  return (
    <PlaceholderTab
      title="Check-in/out"
      description="Streamline boat check-in and check-out processes."
      icon={ClipboardCheck}
      features={[
        "Digital check-in workflow",
        "Safety briefing tracking",
        "Equipment inspection checklists",
        "Photo documentation",
        "Digital signature capture",
        "Damage assessment on return",
        "Fuel level verification",
      ]}
      integrationReady
    />
  );
}

function RentalsReports() {
  return (
    <PlaceholderTab
      title="Reports"
      description="Rental business analytics and reporting."
      icon={BarChart3}
      features={[
        "Revenue by boat and period",
        "Fleet utilization reports",
        "Customer analytics",
        "Peak demand analysis",
        "Profitability by vessel",
        "Maintenance cost tracking",
        "Seasonal performance trends",
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

export default function BoatRentalsTabbed() {
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
      component: RentalsDashboard,
      description: "Rentals overview",
    },
    {
      id: "reservations",
      label: "Reservations",
      icon: Calendar,
      component: RentalsReservations,
      description: "Booking calendar",
    },
    {
      id: "fleet",
      label: "Fleet",
      icon: Anchor,
      component: RentalsFleet,
      description: "Rental boat inventory",
    },
    {
      id: "customers",
      label: "Customers",
      icon: Users,
      component: RentalsCustomers,
      description: "Rental customers",
    },
    {
      id: "pricing",
      label: "Pricing",
      icon: DollarSign,
      component: RentalsPricing,
      description: "Rental rates",
    },
    {
      id: "check-in-out",
      label: "Check-in/out",
      icon: ClipboardCheck,
      component: RentalsCheckInOut,
      description: "Rental handoff",
    },
    {
      id: "reports",
      label: "Reports",
      icon: BarChart3,
      component: RentalsReports,
      description: "Rental analytics",
    },
  ];

  return (
    <TabbedModuleLayout
      moduleName="Boat Rentals"
      moduleDescription="Boat rental fleet, reservations, and customer management"
      moduleIcon={Ship}
      tabs={tabs}
      defaultTab="dashboard"
      basePath="/operations/boat-rentals"
      activePacks={activePacks}
    />
  );
}
