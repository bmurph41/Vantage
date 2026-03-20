import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Building2, DollarSign, TrendingUp, TrendingDown, Users, Fuel, ShoppingCart,
  Home, BookOpen, CreditCard, Anchor, Ship, Wrench, ArrowRight,
  Plus, Link2, BarChart3, CheckCircle2, Percent, AlertCircle,
} from "lucide-react";
import { Link } from "wouter";
import { useEnabledOpsModules } from "@/hooks/use-enabled-ops-modules";

interface PortfolioSummary {
  totalAssets: number;
  totalRevenueMTD: number;
  totalNoiMTD: number;
  averageOccupancy: number;
}

interface ModuleKPI {
  value: number;
  label: string;
  format: "currency" | "number" | "percent";
  trend: number;
  activeToday: boolean;
  pendingCount: number;
}

type ModuleKPISummary = Record<string, ModuleKPI>;

const MODULE_CONFIG: Record<string, { label: string; icon: any; href: string; metricLabel: string }> = {
  fuel: { label: "Fuel Sales", icon: Fuel, href: "/operations/fuel", metricLabel: "Revenue MTD" },
  ship_store: { label: "Ship Store", icon: ShoppingCart, href: "/operations/ship-store", metricLabel: "Revenue MTD" },
  rent_roll: { label: "Rent Roll", icon: Home, href: "/rent-roll/executive", metricLabel: "Occupancy %" },
  bookkeeping: { label: "Bookkeeping", icon: BookOpen, href: "/operations/bookkeeping", metricLabel: "Net Income MTD" },
  payroll: { label: "Payroll", icon: CreditCard, href: "/operations/payroll", metricLabel: "Total Payroll MTD" },
  dockage: { label: "Dockit", icon: Anchor, href: "/operations/dockit", metricLabel: "Slip Occupancy" },
  service: { label: "Service & Parts", icon: Wrench, href: "/operations/service", metricLabel: "Work Orders" },
  boat_rentals: { label: "Boat Rentals", icon: Ship, href: "/operations/boat-rentals", metricLabel: "Active Rentals" },
  boat_club: { label: "Boat Club", icon: Users, href: "/operations/boat-club", metricLabel: "Members" },
  boat_sales: { label: "Boat Sales", icon: DollarSign, href: "/operations/boat-sales", metricLabel: "Sales MTD" },
  commercial_tenants: { label: "Commercial Tenants", icon: Building2, href: "/operations/commercial-tenants", metricLabel: "Tenant Count" },
  budgeting: { label: "Budgeting", icon: BarChart3, href: "/operations/budgeting", metricLabel: "Budget vs Actual" },
  marketing: { label: "Marketing", icon: TrendingUp, href: "/marketing", metricLabel: "Campaigns" },
};

const ONBOARDING_STEPS = [
  {
    id: "add_property",
    label: "Add your first property",
    description: "Start by adding a property to your portfolio.",
    href: "/crm/properties",
    icon: Building2,
  },
  {
    id: "connect_accounting",
    label: "Connect accounting",
    description: "Link QuickBooks, Sage, or another integration.",
    href: "/settings/integrations",
    icon: Link2,
  },
  {
    id: "import_rent_roll",
    label: "Import rent roll",
    description: "Upload or connect your tenant/slip data.",
    href: "/rent-roll/executive",
    icon: Home,
  },
  {
    id: "set_budgets",
    label: "Set up budgets",
    description: "Create operating budgets for your properties.",
    href: "/operations/budgeting",
    icon: BarChart3,
  },
];

function formatKPIValue(value: number, format: string): string {
  switch (format) {
    case "currency":
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
      }).format(value);
    case "percent":
      return `${value.toFixed(1)}%`;
    case "number":
    default:
      return value.toLocaleString();
  }
}

function TrendArrow({ trend }: { trend: number }) {
  if (trend === 0) return null;
  const isPositive = trend > 0;
  const Icon = isPositive ? TrendingUp : TrendingDown;
  const color = isPositive ? "text-emerald-600" : "text-red-500";
  return (
    <span className={`inline-flex items-center gap-0.5 text-[10px] font-medium ${color}`}>
      <Icon className="h-3 w-3" />
      {Math.abs(trend).toFixed(1)}%
    </span>
  );
}

function ActivityDot({ active }: { active: boolean }) {
  if (!active) return null;
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs">Activity today</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function PendingBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-4 gap-0.5">
            <AlertCircle className="h-2.5 w-2.5" />
            {count}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs">{count} item{count !== 1 ? "s" : ""} need attention</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function ModuleCardSkeleton() {
  return (
    <Card className="h-full">
      <CardContent className="pt-5 pb-4 px-5">
        <div className="flex items-start justify-between mb-3">
          <Skeleton className="h-9 w-9 rounded-lg" />
          <Skeleton className="h-4 w-4 rounded" />
        </div>
        <Skeleton className="h-4 w-24 mb-1.5" />
        <Skeleton className="h-6 w-16 mb-1" />
        <Skeleton className="h-3 w-20" />
      </CardContent>
    </Card>
  );
}

export default function OperationsHome() {
  const { enabledModules, assets, isLoading: modulesLoading } = useEnabledOpsModules();

  const { data: portfolioSummary, isLoading: summaryLoading } = useQuery<PortfolioSummary>({
    queryKey: ["/api/portfolio/summary"],
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const { data: moduleKPIs, isLoading: kpiLoading } = useQuery<ModuleKPISummary>({
    queryKey: ["/api/operations-context/modules/kpi-summary"],
    staleTime: 2 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000, // auto-refresh every 5 min
    refetchOnWindowFocus: true,
  });

  const isLoading = modulesLoading || summaryLoading;

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);

  // Determine which modules to show
  const visibleModules = enabledModules.length > 0
    ? enabledModules.filter((m) => MODULE_CONFIG[m])
    : Object.keys(MODULE_CONFIG);

  // Count total pending items across all modules
  const totalPending = moduleKPIs
    ? Object.values(moduleKPIs).reduce((sum, kpi) => sum + (kpi.pendingCount || 0), 0)
    : 0;

  if (isLoading) {
    return (
      <div className="flex-1 overflow-y-auto bg-gray-50">
        <div className="container mx-auto py-6 px-4 space-y-6">
          <Skeleton className="h-10 w-64" />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <ModuleCardSkeleton key={i} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const hasData = assets.length > 0;

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50">
      <div className="container mx-auto py-6 px-4 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Building2 className="h-6 w-6 text-blue-600" />
              Operations
              {totalPending > 0 && (
                <Badge variant="destructive" className="text-xs ml-2">
                  {totalPending} pending
                </Badge>
              )}
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Overview of your operational modules and portfolio performance.
            </p>
          </div>
          <Link href="/portfolio">
            <Button variant="outline" size="sm" className="gap-2">
              <BarChart3 className="h-4 w-4" />
              Portfolio View
            </Button>
          </Link>
        </div>

        {/* Portfolio Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-5 pb-4 px-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider">Total Assets</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">
                    {portfolioSummary?.totalAssets ?? assets.length}
                  </p>
                </div>
                <div className="p-2.5 bg-blue-50 rounded-lg">
                  <Building2 className="h-5 w-5 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5 pb-4 px-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider">Revenue MTD</p>
                  <p className="text-2xl font-bold text-green-700 mt-1">
                    {formatCurrency(portfolioSummary?.totalRevenueMTD ?? 0)}
                  </p>
                </div>
                <div className="p-2.5 bg-green-50 rounded-lg">
                  <DollarSign className="h-5 w-5 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5 pb-4 px-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider">NOI MTD</p>
                  <p className="text-2xl font-bold text-blue-700 mt-1">
                    {formatCurrency(portfolioSummary?.totalNoiMTD ?? 0)}
                  </p>
                </div>
                <div className="p-2.5 bg-blue-50 rounded-lg">
                  <TrendingUp className="h-5 w-5 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5 pb-4 px-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider">Occupancy</p>
                  <p className="text-2xl font-bold text-purple-700 mt-1">
                    {portfolioSummary?.averageOccupancy ? `${portfolioSummary.averageOccupancy.toFixed(1)}%` : "--"}
                  </p>
                </div>
                <div className="p-2.5 bg-purple-50 rounded-lg">
                  <Percent className="h-5 w-5 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Module Status Cards */}
        {visibleModules.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-3">
              Active Modules
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {visibleModules.map((moduleKey) => {
                const config = MODULE_CONFIG[moduleKey];
                if (!config) return null;
                const Icon = config.icon;
                const kpi = moduleKPIs?.[moduleKey];
                const isKpiLoading = kpiLoading && !moduleKPIs;

                return (
                  <Link key={moduleKey} href={config.href}>
                    <Card className="hover:shadow-md hover:border-blue-200 transition-all cursor-pointer h-full group">
                      <CardContent className="pt-5 pb-4 px-5">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <div className="p-2 bg-gray-100 rounded-lg group-hover:bg-blue-50 transition-colors">
                              <Icon className="h-5 w-5 text-gray-600 group-hover:text-blue-600 transition-colors" />
                            </div>
                            {kpi && <ActivityDot active={kpi.activeToday} />}
                          </div>
                          <div className="flex items-center gap-1.5">
                            {kpi && <PendingBadge count={kpi.pendingCount} />}
                            <ArrowRight className="h-4 w-4 text-gray-300 group-hover:text-blue-400 transition-colors" />
                          </div>
                        </div>
                        <h3 className="text-sm font-semibold text-gray-900">{config.label}</h3>

                        {/* KPI metric display */}
                        {isKpiLoading ? (
                          <div className="mt-1.5 space-y-1">
                            <Skeleton className="h-5 w-20" />
                            <Skeleton className="h-3 w-16" />
                          </div>
                        ) : kpi ? (
                          <div className="mt-1.5">
                            <div className="flex items-baseline gap-2">
                              <span className="text-lg font-bold text-gray-900">
                                {kpi.format === "number" && kpi.label === "Up to date"
                                  ? "Up to date"
                                  : formatKPIValue(kpi.value, kpi.format)}
                              </span>
                              <TrendArrow trend={kpi.trend} />
                            </div>
                            <p className="text-xs text-gray-500 mt-0.5">
                              {kpi.format === "number" && kpi.label === "Up to date"
                                ? "All entries reconciled"
                                : kpi.label}
                            </p>
                          </div>
                        ) : (
                          <p className="text-xs text-gray-500 mt-1.5">{config.metricLabel}</p>
                        )}
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* Getting Started Guide */}
        {!hasData && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                Getting Started
              </CardTitle>
              <CardDescription>
                Follow these steps to set up your operations modules.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {ONBOARDING_STEPS.map((step, index) => {
                  const StepIcon = step.icon;
                  return (
                    <Link key={step.id} href={step.href}>
                      <div className="flex items-center gap-4 p-3 rounded-lg border hover:bg-gray-50 hover:border-blue-200 transition-colors cursor-pointer">
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-600 font-bold text-sm flex-shrink-0">
                          {index + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-semibold text-gray-900">{step.label}</h4>
                          <p className="text-xs text-gray-500">{step.description}</p>
                        </div>
                        <div className="p-1.5 bg-gray-100 rounded">
                          <StepIcon className="h-4 w-4 text-gray-400" />
                        </div>
                        <ArrowRight className="h-4 w-4 text-gray-300 flex-shrink-0" />
                      </div>
                    </Link>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Empty state if no modules enabled */}
        {visibleModules.length === 0 && hasData && (
          <Card>
            <CardContent className="py-16 text-center">
              <Building2 className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <h3 className="text-lg font-medium text-gray-600 mb-2">No Modules Enabled</h3>
              <p className="text-sm text-gray-400 mb-4">
                Enable operations modules based on your asset classes to get started.
              </p>
              <Link href="/settings/integrations">
                <Button variant="outline">
                  <Plus className="h-4 w-4 mr-2" />
                  Configure Modules
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
