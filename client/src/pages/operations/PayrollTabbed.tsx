import { lazy } from "react";
import { useQuery } from "@tanstack/react-query";
import { DollarSign, LayoutDashboard, Users, UserPlus, ClipboardList, Shield, Calculator, GitBranch } from "lucide-react";
import { TabbedModuleLayout, TabDefinition } from "@/components/layout/TabbedModuleLayout";

const PayrollDashboard = lazy(() => import("./payroll/Dashboard"));
const PayrollPlans = lazy(() => import("./payroll/Plans"));
const PositionLibrary = lazy(() => import("./payroll/PositionLibrary"));
const PayrollEmployees = lazy(() => import("./payroll/Employees"));
const BurdenProfiles = lazy(() => import("./payroll/BurdenProfiles"));
const DeptPnl = lazy(() => import("./payroll/DeptPnl"));
const PayrollPermissions = lazy(() => import("./payroll/Permissions"));

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

export default function PayrollTabbed() {
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
      component: PayrollDashboard,
      description: "Payroll overview and totals",
    },
    {
      id: "plans",
      label: "Payroll Plans",
      icon: ClipboardList,
      component: PayrollPlans,
      description: "Create and manage payroll plans",
    },
    {
      id: "positions",
      label: "Position Library",
      icon: Users,
      component: PositionLibrary,
      description: "Standard position templates",
    },
    {
      id: "employees",
      label: "Employees",
      icon: UserPlus,
      component: PayrollEmployees,
      description: "Manage employees and asset assignments",
    },
    {
      id: "burden",
      label: "Burden Profiles",
      icon: Calculator,
      component: BurdenProfiles,
      description: "Benefits, taxes, and burden rates",
    },
    {
      id: "dept-pnl",
      label: "Dept P&L",
      icon: GitBranch,
      component: DeptPnl,
      description: "Department-level profit & loss",
    },
    {
      id: "permissions",
      label: "Permissions",
      icon: Shield,
      component: PayrollPermissions,
      description: "Control payroll data access",
    },
  ];

  return (
    <TabbedModuleLayout
      moduleName="Payroll"
      moduleDescription="Manage staffing, compensation, and departmental labor costs"
      moduleIcon={DollarSign}
      tabs={tabs}
      defaultTab="dashboard"
      basePath="/operations/payroll"
      activePacks={activePacks}
    />
  );
}
