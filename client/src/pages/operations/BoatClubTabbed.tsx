import { useQuery } from "@tanstack/react-query";
import { Users, LayoutDashboard, UserPlus, Calendar, Anchor, CreditCard, GraduationCap, Receipt, BarChart3, LineChart as LineChartIcon } from "lucide-react";
import BoatClubAnalytics from "./boat-club/Analytics";
import { TabbedModuleLayout, TabDefinition, PlaceholderTab } from "@/components/layout/TabbedModuleLayout";

function ClubDashboard() {
  return (
    <PlaceholderTab
      title="Boat Club Dashboard"
      description="Overview of membership, reservations, and fleet utilization."
      icon={LayoutDashboard}
      features={[
        "Active membership count and growth",
        "Today's reservations overview",
        "Fleet availability status",
        "Member satisfaction metrics",
        "Revenue and MRR tracking",
        "Waitlist status",
      ]}
      integrationReady
    />
  );
}

function ClubMembers() {
  return (
    <PlaceholderTab
      title="Members"
      description="Manage boat club membership roster and profiles."
      icon={UserPlus}
      features={[
        "Member profile management",
        "Membership tier and status",
        "Boating certifications and training",
        "Usage history and patterns",
        "Family member management",
        "Member communications",
        "Referral tracking",
        "Integration with CRM contacts",
      ]}
      integrationReady
    />
  );
}

function ClubReservations() {
  return (
    <PlaceholderTab
      title="Reservations"
      description="Boat reservation system for club members."
      icon={Calendar}
      features={[
        "Member self-service booking",
        "Reservation rules by tier",
        "Advance booking windows",
        "Cancellation policies",
        "Waitlist management",
        "Peak time slot management",
        "Multi-boat reservations",
        "Recurring reservations",
      ]}
      integrationReady
    />
  );
}

function ClubFleet() {
  return (
    <PlaceholderTab
      title="Fleet"
      description="Manage the boat club fleet inventory."
      icon={Anchor}
      features={[
        "Fleet inventory and specs",
        "Maintenance scheduling",
        "Utilization tracking by boat",
        "Fuel and operational costs",
        "Damage and incident reports",
        "Equipment and safety gear",
        "Fleet rotation planning",
      ]}
      integrationReady
    />
  );
}

function ClubMembershipPlans() {
  return (
    <PlaceholderTab
      title="Membership Plans"
      description="Configure membership tiers, pricing, and benefits."
      icon={CreditCard}
      features={[
        "Multiple membership tiers",
        "Monthly and annual pricing",
        "Boat access levels by tier",
        "Reservation limits and rules",
        "Add-on services",
        "Promotional offers",
        "Trial memberships",
        "Corporate/group plans",
      ]}
      integrationReady
    />
  );
}

function ClubTraining() {
  return (
    <PlaceholderTab
      title="Training"
      description="Manage member training and certification programs."
      icon={GraduationCap}
      features={[
        "Boat operation training",
        "Safety certification tracking",
        "Boat-specific checkouts",
        "Training schedule management",
        "Instructor assignments",
        "Training completion records",
        "Skill level assessments",
        "Coast Guard certification tracking",
      ]}
      integrationReady
    />
  );
}

function ClubBilling() {
  return (
    <PlaceholderTab
      title="Billing"
      description="Manage recurring membership billing and payments."
      icon={Receipt}
      features={[
        "Recurring subscription billing",
        "Payment method management",
        "Proration and upgrades",
        "Failed payment handling",
        "Usage-based overage billing",
        "Invoice generation",
        "Refund processing",
        "Integration with Stripe",
      ]}
      integrationReady
    />
  );
}

function ClubReports() {
  return (
    <PlaceholderTab
      title="Reports"
      description="Boat club analytics and performance reporting."
      icon={BarChart3}
      features={[
        "Membership growth trends",
        "Churn and retention analysis",
        "Fleet utilization reports",
        "Revenue per member",
        "Peak usage patterns",
        "Member satisfaction trends",
        "Profitability by boat",
        "Forecasting and projections",
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

export default function BoatClubTabbed() {
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
      component: ClubDashboard,
      description: "Club overview",
    },
    {
      id: "members",
      label: "Members",
      icon: UserPlus,
      component: ClubMembers,
      description: "Membership roster",
    },
    {
      id: "reservations",
      label: "Reservations",
      icon: Calendar,
      component: ClubReservations,
      description: "Member bookings",
    },
    {
      id: "fleet",
      label: "Fleet",
      icon: Anchor,
      component: ClubFleet,
      description: "Club boats",
    },
    {
      id: "membership-plans",
      label: "Membership Plans",
      icon: CreditCard,
      component: ClubMembershipPlans,
      description: "Pricing and tiers",
    },
    {
      id: "training",
      label: "Training",
      icon: GraduationCap,
      component: ClubTraining,
      description: "Member certifications",
    },
    {
      id: "billing",
      label: "Billing",
      icon: Receipt,
      component: ClubBilling,
      description: "Subscriptions",
    },
    {
      id: "reports",
      label: "Reports",
      icon: BarChart3,
      component: ClubReports,
      description: "Club analytics",
    },
    {
      id: "analytics",
      label: "Analytics",
      icon: LineChartIcon,
      component: BoatClubAnalytics,
      description: "Club analytics charts",
    },
  ];

  return (
    <TabbedModuleLayout
      moduleName="Boat Club"
      moduleDescription="Membership-based boat club management"
      moduleIcon={Users}
      tabs={tabs}
      defaultTab="dashboard"
      basePath="/operations/boat-club"
      activePacks={activePacks}
    />
  );
}
