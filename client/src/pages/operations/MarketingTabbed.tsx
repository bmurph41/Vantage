import { lazy } from "react";
import { useQuery } from "@tanstack/react-query";
import { Megaphone, LayoutDashboard, Target, DollarSign, Link2, Mail, Settings, Send } from "lucide-react";
import { TabbedModuleLayout, TabDefinition } from "@/components/layout/TabbedModuleLayout";

const MarketingDashboard = lazy(() => import("./marketing/Dashboard"));
const MarketingCampaigns = lazy(() => import("./marketing/Campaigns"));
const MarketingExpenses = lazy(() => import("./marketing/Expenses"));
const MarketingAttribution = lazy(() => import("./marketing/Attribution"));
const MarketingEmailCampaigns = lazy(() => import("./marketing/EmailCampaigns"));
const MarketingAutomation = lazy(() => import("@/pages/marketing-automation"));
const MarketingSettings = lazy(() => import("./marketing/Settings"));

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

export default function MarketingTabbed() {
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
      component: MarketingDashboard,
      description: "Marketing performance overview",
    },
    {
      id: "campaigns",
      label: "Campaigns",
      icon: Target,
      component: MarketingCampaigns,
      description: "Manage marketing campaigns",
    },
    {
      id: "expenses",
      label: "Expenses",
      icon: DollarSign,
      component: MarketingExpenses,
      description: "Track marketing spend",
    },
    {
      id: "attribution",
      label: "Attribution",
      icon: Link2,
      component: MarketingAttribution,
      description: "Lead source attribution",
    },
    {
      id: "email-campaigns",
      label: "Email Campaigns",
      icon: Mail,
      component: MarketingEmailCampaigns,
      description: "External email integrations",
    },
    {
      id: "automation",
      label: "Automation",
      icon: Send,
      component: MarketingAutomation,
      description: "Email sequences and drip campaigns",
    },
    {
      id: "settings",
      label: "Settings",
      icon: Settings,
      component: MarketingSettings,
      description: "Configure marketing settings",
    },
  ];

  return (
    <TabbedModuleLayout
      moduleName="Marketing"
      moduleDescription="Marketing campaigns, attribution, and analytics"
      moduleIcon={Megaphone}
      tabs={tabs}
      defaultTab="dashboard"
      basePath="/operations/marketing"
      activePacks={activePacks}
    />
  );
}
