import { lazy } from "react";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, LayoutDashboard, FileText, Calculator, History, DollarSign } from "lucide-react";
import { TabbedModuleLayout, TabDefinition } from "@/components/layout/TabbedModuleLayout";

const BookkeepingDashboard = lazy(() => import("./bookkeeping/Dashboard"));
const BookkeepingStatements = lazy(() => import("./bookkeeping/Statements"));
const BookkeepingChartOfAccounts = lazy(() => import("./bookkeeping/ChartOfAccounts"));
const BookkeepingSyncHistory = lazy(() => import("./bookkeeping/SyncHistory"));
const BudgetingTabbed = lazy(() => import("./BudgetingTabbed"));

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

export default function BookkeepingTabbed() {
  const { data: bootstrapData } = useQuery<BootstrapData>({
    queryKey: ['/api/bootstrap'],
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const activePacks = bootstrapData?.activePacks || [];

  const tabs: TabDefinition[] = [
    {
      id: "dashboard",
      label: "Overview",
      icon: LayoutDashboard,
      component: BookkeepingDashboard,
      description: "Accounting integration status and sync overview",
    },
    {
      id: "statements",
      label: "Statements",
      icon: FileText,
      component: BookkeepingStatements,
      description: "P&L statements and balance sheets",
    },
    {
      id: "chart-of-accounts",
      label: "Chart of Accounts",
      icon: Calculator,
      component: BookkeepingChartOfAccounts,
      description: "Account mappings for marina categorization",
    },
    {
      id: "sync-history",
      label: "Sync History",
      icon: History,
      component: BookkeepingSyncHistory,
      description: "Data synchronization logs",
    },
    {
      id: "budgeting",
      label: "Budgeting",
      icon: DollarSign,
      component: BudgetingTabbed,
      description: "Create budgets, track actuals, and analyze variance",
    },
  ];

  return (
    <TabbedModuleLayout
      moduleName="Bookkeeping"
      moduleDescription="Accounting integrations and financial data sync for owned marinas"
      moduleIcon={BookOpen}
      tabs={tabs}
      defaultTab="dashboard"
      basePath="/operations/bookkeeping"
      activePacks={activePacks}
    />
  );
}
