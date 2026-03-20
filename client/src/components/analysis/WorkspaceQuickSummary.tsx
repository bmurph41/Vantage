import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DollarSign, TrendingUp, Percent, Building2, Target,
  BarChart3, ArrowRight, Layers
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  Legend,
} from "recharts";
import { formatCurrency } from "@/lib/utils";
import type { ModelingProject } from "@shared/schema";

interface WorkspaceQuickSummaryProps {
  projectId: string;
  onViewFullModel: () => void;
}

interface MetricCardProps {
  label: string;
  value: string;
  icon: React.ReactNode;
  color?: string;
}

function MetricCard({ label, value, icon, color = "text-gray-900" }: MetricCardProps) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/40 border border-border/30">
      <div className="p-2 rounded-md bg-background shadow-sm">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">{label}</p>
        <p className={`text-lg font-bold leading-tight ${color}`}>{value}</p>
      </div>
    </div>
  );
}

function formatPercentValue(val: number | null | undefined): string {
  if (val == null) return "--";
  return `${val.toFixed(1)}%`;
}

function formatMultiple(val: number | null | undefined): string {
  if (val == null) return "--";
  return `${val.toFixed(2)}x`;
}

function formatCurrencyCompact(val: number | null | undefined): string {
  if (val == null) return "--";
  if (Math.abs(val) >= 1_000_000) return `$${(val / 1_000_000).toFixed(1)}M`;
  if (Math.abs(val) >= 1_000) return `$${(val / 1_000).toFixed(0)}K`;
  return formatCurrency(val);
}

const SCENARIO_COLORS: Record<string, string> = {
  Base: "#3b82f6",
  base: "#3b82f6",
  Conservative: "#f59e0b",
  conservative: "#f59e0b",
  Aggressive: "#22c55e",
  aggressive: "#22c55e",
  Downside: "#ef4444",
  downside: "#ef4444",
};

export default function WorkspaceQuickSummary({ projectId, onViewFullModel }: WorkspaceQuickSummaryProps) {
  const { data: project, isLoading: isLoadingProject } = useQuery<ModelingProject>({
    queryKey: ["/api/modeling/projects", projectId],
    enabled: !!projectId,
  });

  const { data: proFormaRaw, isLoading: isLoadingProForma } = useQuery<any>({
    queryKey: ["/api/modeling/projects", projectId, "pro-forma"],
    enabled: !!projectId,
  });

  const { data: pricingRaw, isLoading: isLoadingPricing } = useQuery<any>({
    queryKey: ["/api/modeling/projects", projectId, "deal-pricing", "inputs"],
    enabled: !!projectId,
  });

  const isLoading = isLoadingProject || isLoadingProForma || isLoadingPricing;

  if (isLoading) {
    return (
      <Card className="border-primary/20 shadow-md">
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-20" />
            ))}
          </div>
          <Skeleton className="h-48" />
        </CardContent>
      </Card>
    );
  }

  if (!project) return null;

  // Extract financial data
  const pricing = pricingRaw?.dealPricingResults ?? pricingRaw?.dealPricing ?? pricingRaw;
  const purchasePrice = project.purchasePrice ? Number(project.purchasePrice) : null;

  // Extract pro forma metrics
  let noi: number | null = null;
  let totalRevenue: number | null = null;
  let totalExpenses: number | null = null;
  let capRate: number | null = null;
  let irr: number | null = null;
  let equityMultiple: number | null = null;
  let cashOnCash: number | null = null;
  let revenueLines: { label: string; amount: number }[] = [];
  let expenseLines: { label: string; amount: number }[] = [];

  // Try scenario shape first
  const s0 = proFormaRaw?.scenarios?.[0];
  if (s0?.metrics) {
    totalRevenue = s0.metrics.totalRevenue ?? null;
    totalExpenses = s0.metrics.totalExpenses ?? null;
    noi = s0.metrics.noi ?? s0.metrics.stabilizedNoi ?? null;
    capRate = s0.metrics.capRate ?? null;
    irr = s0.metrics.irr ?? null;
    equityMultiple = s0.metrics.equityMultiple ?? null;
    cashOnCash = s0.metrics.cashOnCash ?? null;
    revenueLines = (s0.revenueBreakdown ?? []).slice(0, 3);
    expenseLines = (s0.expenseBreakdown ?? []).slice(0, 3);
  } else if (proFormaRaw) {
    const rev = proFormaRaw.revenue?.totals?.[0] ?? proFormaRaw.revenue?.total ?? proFormaRaw.totalRevenue ?? null;
    const exp = proFormaRaw.expenses?.totals?.[0] ?? proFormaRaw.expenses?.total ?? proFormaRaw.totalExpenses ?? null;
    totalRevenue = rev;
    totalExpenses = exp;
    noi = proFormaRaw.noi != null
      ? (Array.isArray(proFormaRaw.noi) ? proFormaRaw.noi[0] : proFormaRaw.noi)
      : (rev != null && exp != null ? rev - exp : null);
  }

  // Override with pricing data if available
  if (pricing) {
    irr = pricing.irr ?? irr;
    equityMultiple = pricing.equityMultiple ?? equityMultiple;
    cashOnCash = pricing.cashOnCash ?? cashOnCash;
    capRate = pricing.capRate ?? capRate;
  }

  // Build scenario comparison data
  const scenarioData: { name: string; NOI: number; Revenue: number }[] = [];
  if (proFormaRaw?.scenarios) {
    proFormaRaw.scenarios.forEach((s: any) => {
      const scenarioName = s.name || s.label || "Base";
      scenarioData.push({
        name: scenarioName,
        NOI: s.metrics?.noi ?? 0,
        Revenue: s.metrics?.totalRevenue ?? 0,
      });
    });
  }
  // If no scenarios but we have data, create a single base bar
  if (scenarioData.length === 0 && noi != null && totalRevenue != null) {
    scenarioData.push({
      name: "Base",
      NOI: noi,
      Revenue: totalRevenue,
    });
  }

  const assetClass = (project as any).assetClass;

  return (
    <Card className="border-primary/20 shadow-md">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">{project.marinaName}</CardTitle>
              <div className="flex items-center gap-2 mt-0.5">
                {assetClass && (
                  <Badge variant="outline" className="text-[10px] capitalize px-1.5 py-0">
                    {assetClass.replace(/_/g, " ")}
                  </Badge>
                )}
                {project.city && project.state && (
                  <span className="text-xs text-muted-foreground">
                    {project.city}, {project.state}
                  </span>
                )}
              </div>
            </div>
          </div>
          <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">
            <Layers className="h-3 w-3 mr-1" />
            Simple Mode
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* Key Metrics Grid */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <MetricCard
            label="Purchase Price"
            value={purchasePrice ? formatCurrencyCompact(purchasePrice) : "--"}
            icon={<DollarSign className="h-4 w-4 text-green-600" />}
            color="text-green-700"
          />
          <MetricCard
            label="NOI"
            value={noi != null ? formatCurrencyCompact(noi) : "--"}
            icon={<BarChart3 className="h-4 w-4 text-blue-600" />}
            color="text-blue-700"
          />
          <MetricCard
            label="Cap Rate"
            value={formatPercentValue(capRate)}
            icon={<Target className="h-4 w-4 text-purple-600" />}
            color="text-purple-700"
          />
          <MetricCard
            label="IRR"
            value={formatPercentValue(irr)}
            icon={<TrendingUp className="h-4 w-4 text-emerald-600" />}
            color="text-emerald-700"
          />
          <MetricCard
            label="MOIC"
            value={formatMultiple(equityMultiple)}
            icon={<Layers className="h-4 w-4 text-amber-600" />}
            color="text-amber-700"
          />
          <MetricCard
            label="Cash-on-Cash"
            value={formatPercentValue(cashOnCash)}
            icon={<Percent className="h-4 w-4 text-teal-600" />}
            color="text-teal-700"
          />
        </div>

        {/* Revenue / Expense Summary */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg border p-3">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Revenue Summary
            </h4>
            {totalRevenue != null && (
              <p className="text-sm font-bold text-green-700 mb-2">
                Total: {formatCurrencyCompact(totalRevenue)}
              </p>
            )}
            {revenueLines.length > 0 ? (
              <div className="space-y-1">
                {revenueLines.map((line, i) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{line.label}</span>
                    <span className="font-medium">{formatCurrencyCompact(line.amount)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No breakdown available</p>
            )}
          </div>
          <div className="rounded-lg border p-3">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Expense Summary
            </h4>
            {totalExpenses != null && (
              <p className="text-sm font-bold text-red-700 mb-2">
                Total: {formatCurrencyCompact(totalExpenses)}
              </p>
            )}
            {expenseLines.length > 0 ? (
              <div className="space-y-1">
                {expenseLines.map((line, i) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{line.label}</span>
                    <span className="font-medium">{formatCurrencyCompact(line.amount)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No breakdown available</p>
            )}
          </div>
        </div>

        {/* Scenario Comparison Chart */}
        {scenarioData.length > 1 && (
          <div className="rounded-lg border p-4">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Scenario Comparison
            </h4>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={scenarioData} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis
                  tickFormatter={(val: number) =>
                    val >= 1_000_000 ? `$${(val / 1_000_000).toFixed(1)}M` : `$${(val / 1_000).toFixed(0)}K`
                  }
                  tick={{ fontSize: 11 }}
                />
                <Tooltip
                  formatter={(value: number) => formatCurrency(value)}
                  contentStyle={{ fontSize: 12 }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Revenue" fill="#3b82f6" radius={[4, 4, 0, 0]}>
                  {scenarioData.map((entry) => (
                    <Cell
                      key={entry.name}
                      fill={SCENARIO_COLORS[entry.name] || "#3b82f6"}
                      fillOpacity={0.3}
                    />
                  ))}
                </Bar>
                <Bar dataKey="NOI" fill="#22c55e" radius={[4, 4, 0, 0]}>
                  {scenarioData.map((entry) => (
                    <Cell
                      key={entry.name}
                      fill={SCENARIO_COLORS[entry.name] || "#22c55e"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* View Full Model Button */}
        <Button
          variant="outline"
          className="w-full"
          onClick={onViewFullModel}
        >
          View Full Model
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </CardContent>
    </Card>
  );
}
