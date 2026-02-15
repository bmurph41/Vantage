import { Fragment, useState, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { formatCurrency, formatPercent, cn } from "@/lib/utils";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  Tooltip as UiTooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  TrendingUp, TrendingDown, DollarSign, BarChart3, ArrowUpRight, Building2,
  Percent, Activity, AlertTriangle, ChevronDown, ChevronRight, Target,
  Shield, Zap, PieChart as PieChartIcon, ArrowDown, ArrowUp,
} from "lucide-react";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { ExportPdfButton } from "@/components/ui/export-pdf-button";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ScatterChart, Scatter, ZAxis, Cell,
  PieChart, Pie, LineChart, Line, ReferenceLine, Area, AreaChart,
  ComposedChart,
} from "recharts";

interface ProjectSnapshot {
  indicatedValue: number | null;
  capRate: number | null;
  noi: number | null;
  ebitda: number | null;
  irr: number | null;
  equityMultiple: number | null;
  cashOnCash: number | null;
  grossRevenue: number | null;
  snapshotDate: string;
}

interface MonteCarloSummary {
  hasResults: boolean;
  probabilityOfLoss: number | null;
  valueAtRisk: number | null;
  irrMean: number | null;
  irrP5: number | null;
  irrP95: number | null;
  npvMean: number | null;
  sharpeRatio: number | null;
  sortinoRatio: number | null;
  emMean: number | null;
  cocMean: number | null;
  iterations: number | null;
  lastCalculated: string | null;
  sensitivityTop: { variable: string; contribution: number; correlationToIRR: number }[];
}

interface DealPricingInputs {
  holdPeriod: number | null;
  exitCapRate: number | null;
  goingInCapRate: number | null;
  targetIRR: number | null;
}

interface DealPricingResults {
  irr: number | null;
  equityMultiple: number | null;
  cashOnCash: number | null;
  npv: number | null;
  exitValue: number | null;
  totalProfit: number | null;
  netExitProceeds: number | null;
  totalEquityInvested: number | null;
  noiByYear: number[];
  cashFlowsByYear: number[];
}

interface ReturnsProject {
  id: string;
  marinaName: string;
  city: string | null;
  state: string | null;
  purchasePrice: number | null;
  year1CapRate: number | null;
  ebitda: number | null;
  totalStorageUnits: number | null;
  dealOutcome: string;
  updatedAt: string;
  t12Noi: number | null;
  t12Revenue: number | null;
  t12Expenses: number | null;
  snapshot: ProjectSnapshot | null;
  dealPricingInputs: DealPricingInputs;
  dealPricingResults: DealPricingResults;
  monteCarlo: MonteCarloSummary | null;
}

const formatMultiple = (val: number | null | undefined) => {
  if (val == null) return "\u2014";
  return `${val.toFixed(2)}x`;
};

const fmtCompact = (v: number | null | undefined) => {
  if (v == null) return "\u2014";
  const abs = Math.abs(v);
  if (abs >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
};

const outcomeColors: Record<string, string> = {
  active: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  under_review: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
  won: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  passed: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
  lost: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
};

const outcomeLabels: Record<string, string> = {
  active: "Active",
  under_review: "Under Review",
  won: "Won",
  passed: "Passed",
  lost: "Lost",
};

const PIE_COLORS = ["#3b82f6", "#f59e0b", "#22c55e", "#6b7280", "#ef4444"];
const CHART_COLORS = ["#3b82f6", "#8b5cf6", "#06b6d4", "#f59e0b", "#22c55e", "#ef4444", "#ec4899"];

const toDisplayPct = (val: number) => Math.abs(val) < 1 ? val * 100 : val;

function SummaryCard({ title, value, icon: Icon, subtitle, trend }: {
  title: string; value: string; icon: any; subtitle?: string; trend?: { value: number; label: string } | null;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold mt-1">{value}</p>
            {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
            {trend && (
              <div className={cn("flex items-center gap-1 text-xs mt-1", trend.value >= 0 ? "text-green-600" : "text-red-600")}>
                {trend.value >= 0 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                {Math.abs(trend.value).toFixed(1)}% {trend.label}
              </div>
            )}
          </div>
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Icon className="h-5 w-5 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function DealAnalyticsPanel({ project }: { project: ReturnsProject }) {
  const [, setLocation] = useLocation();
  const dp = project.dealPricingResults || { irr: null, equityMultiple: null, cashOnCash: null, npv: null, exitValue: null, totalProfit: null, netExitProceeds: null, totalEquityInvested: null, noiByYear: [], cashFlowsByYear: [] };
  const dpi = project.dealPricingInputs || { holdPeriod: null, exitCapRate: null, goingInCapRate: null, targetIRR: null };
  const mc = project.monteCarlo;
  const hasNoi = (dp.noiByYear?.length ?? 0) > 0;
  const hasCashFlows = (dp.cashFlowsByYear?.length ?? 0) > 0;

  const noiChartData = useMemo(() =>
    (dp.noiByYear || []).map((noi, i) => ({
      year: `Year ${i + 1}`,
      noi,
      cashFlow: (dp.cashFlowsByYear || [])[i] || 0,
    })), [dp.noiByYear, dp.cashFlowsByYear]);

  const cashFlowWaterfallData = useMemo(() => {
    if (!hasCashFlows) return [];
    const items: { name: string; value: number; fill: string }[] = [];
    if (dp.totalEquityInvested) {
      items.push({ name: "Equity Invested", value: -dp.totalEquityInvested, fill: "#ef4444" });
    }
    (dp.cashFlowsByYear || []).forEach((cf, i) => {
      items.push({ name: `Yr ${i + 1}`, value: cf, fill: cf >= 0 ? "#3b82f6" : "#f97316" });
    });
    if (dp.netExitProceeds) {
      items.push({ name: "Exit Proceeds", value: dp.netExitProceeds, fill: "#22c55e" });
    }
    if (dp.totalProfit) {
      items.push({ name: "Total Profit", value: dp.totalProfit, fill: dp.totalProfit >= 0 ? "#8b5cf6" : "#ef4444" });
    }
    return items;
  }, [dp, hasCashFlows]);

  const returnsMetrics = useMemo(() => [
    { label: "Purchase Price", value: fmtCompact(project.purchasePrice) },
    { label: "Exit Value", value: fmtCompact(dp.exitValue) },
    { label: "Total Equity", value: fmtCompact(dp.totalEquityInvested) },
    { label: "Net Exit Proceeds", value: fmtCompact(dp.netExitProceeds) },
    { label: "Total Profit", value: fmtCompact(dp.totalProfit), color: (dp.totalProfit ?? 0) >= 0 ? "text-green-600" : "text-red-600" },
    { label: "NPV", value: fmtCompact(dp.npv), color: (dp.npv ?? 0) >= 0 ? "text-green-600" : "text-red-600" },
    { label: "IRR", value: dp.irr != null ? `${toDisplayPct(dp.irr).toFixed(2)}%` : "\u2014" },
    { label: "Equity Multiple", value: formatMultiple(dp.equityMultiple) },
    { label: "Cash-on-Cash", value: dp.cashOnCash != null ? `${toDisplayPct(dp.cashOnCash).toFixed(2)}%` : "\u2014" },
    { label: "Going-In Cap", value: dpi.goingInCapRate != null ? `${dpi.goingInCapRate.toFixed(2)}%` : "\u2014" },
    { label: "Exit Cap Rate", value: dpi.exitCapRate != null ? `${dpi.exitCapRate.toFixed(2)}%` : "\u2014" },
    { label: "Hold Period", value: dpi.holdPeriod != null ? `${dpi.holdPeriod} years` : "\u2014" },
  ], [project, dp, dpi]);

  const hasAnyData = hasNoi || hasCashFlows || dp.irr != null || mc?.hasResults;

  if (!hasAnyData) {
    return (
      <div className="py-8 text-center text-muted-foreground">
        <Activity className="h-8 w-8 mx-auto mb-2 opacity-40" />
        <p className="text-sm">No deal pricing data yet. Open the project to configure Deal Pricing.</p>
        <Button variant="outline" size="sm" className="mt-3" onClick={() => setLocation(`/modeling/projects/${project.id}`)}>
          Open Project
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4 py-4">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Returns Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              {returnsMetrics.map((m) => (
                <div key={m.label} className="flex justify-between py-1 border-b border-dashed">
                  <span className="text-muted-foreground">{m.label}</span>
                  <span className={cn("font-medium", (m as any).color)}>{m.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {hasNoi && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">NOI & Cash Flow Projections</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <ComposedChart data={noiChartData}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="year" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => fmtCompact(v)} />
                  <Tooltip formatter={(v: number) => fmtCompact(v)} />
                  <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="noi" name="NOI" fill="#3b82f6" radius={[2, 2, 0, 0]} />
                  <Line type="monotone" dataKey="cashFlow" name="Cash Flow" stroke="#22c55e" strokeWidth={2} dot={{ r: 3 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {hasCashFlows && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Cash Flow Waterfall</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={cashFlowWaterfallData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => fmtCompact(v)} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={85} />
                  <Tooltip formatter={(v: number) => fmtCompact(v)} />
                  <ReferenceLine x={0} stroke="#666" />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                    {cashFlowWaterfallData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>

      {mc?.hasResults && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">Monte Carlo Risk Assessment</CardTitle>
              <Badge variant="outline" className="text-xs">{(mc.iterations ?? 0).toLocaleString()} iterations</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              <div className="text-center p-3 bg-muted/50 rounded-lg">
                <p className="text-xs text-muted-foreground">Prob. of Loss</p>
                <p className={cn("text-lg font-bold",
                  (mc.probabilityOfLoss ?? 0) < 0.1 ? "text-green-600" :
                  (mc.probabilityOfLoss ?? 0) < 0.25 ? "text-yellow-600" : "text-red-600"
                )}>
                  {((mc.probabilityOfLoss ?? 0) * 100).toFixed(1)}%
                </p>
              </div>
              <div className="text-center p-3 bg-muted/50 rounded-lg">
                <p className="text-xs text-muted-foreground">VaR (95%)</p>
                <p className={cn("text-lg font-bold", (mc.valueAtRisk ?? 0) >= 0 ? "text-green-600" : "text-red-600")}>
                  {fmtCompact(mc.valueAtRisk)}
                </p>
              </div>
              <div className="text-center p-3 bg-muted/50 rounded-lg">
                <p className="text-xs text-muted-foreground">Mean IRR</p>
                <p className="text-lg font-bold">{mc.irrMean != null ? `${toDisplayPct(mc.irrMean).toFixed(1)}%` : "\u2014"}</p>
              </div>
              <div className="text-center p-3 bg-muted/50 rounded-lg">
                <p className="text-xs text-muted-foreground">IRR Range (P5\u2013P95)</p>
                <p className="text-lg font-bold text-muted-foreground">
                  {mc.irrP5 != null ? `${toDisplayPct(mc.irrP5).toFixed(1)}` : "?"}\u2013{mc.irrP95 != null ? `${toDisplayPct(mc.irrP95).toFixed(1)}%` : "?"}
                </p>
              </div>
              <div className="text-center p-3 bg-muted/50 rounded-lg">
                <p className="text-xs text-muted-foreground">Sharpe Ratio</p>
                <p className="text-lg font-bold">{(mc.sharpeRatio ?? 0).toFixed(2)}</p>
              </div>
              <div className="text-center p-3 bg-muted/50 rounded-lg">
                <p className="text-xs text-muted-foreground">Sortino Ratio</p>
                <p className="text-lg font-bold">{(mc.sortinoRatio ?? 0).toFixed(2)}</p>
              </div>
            </div>
            {mc.sensitivityTop && mc.sensitivityTop.length > 0 && (
              <div className="mt-4">
                <p className="text-xs font-medium text-muted-foreground mb-2">Sensitivity Ranking</p>
                <div className="space-y-2">
                  {mc.sensitivityTop.map((s, i) => (
                    <div key={s.variable} className="flex items-center gap-3">
                      <span className="text-xs font-bold text-muted-foreground w-4">#{i + 1}</span>
                      <span className="text-xs w-28 truncate">{s.variable}</span>
                      <Progress
                        value={s.contribution}
                        className={cn("flex-1 h-2", s.correlationToIRR > 0 ? "[&>div]:bg-green-500" : "[&>div]:bg-red-500")}
                      />
                      <span className={cn("text-xs font-mono w-14 text-right", s.correlationToIRR > 0 ? "text-green-600" : "text-red-600")}>
                        {s.correlationToIRR > 0 ? "+" : ""}{s.correlationToIRR.toFixed(3)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function ReturnsValuationPage() {
  const [, setLocation] = useLocation();
  const [expandedDeals, setExpandedDeals] = useState<Set<string>>(new Set());
  const [activePortfolioTab, setActivePortfolioTab] = useState("overview");
  const pdfRef = useRef<HTMLDivElement>(null);

  const { data: projects, isLoading } = useQuery<ReturnsProject[]>({
    queryKey: ["/api/modeling/returns-valuation"],
  });

  const toggleDeal = (id: string) => {
    setExpandedDeals(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const analytics = useMemo(() => {
    if (!projects || projects.length === 0) return null;

    const withIrr = projects.filter(p => p.snapshot?.irr != null);
    const withCap = projects.filter(p => {
      const cap = p.snapshot?.capRate ?? p.year1CapRate;
      return cap != null && cap > 0;
    });
    const withPrice = projects.filter(p => p.purchasePrice != null && p.purchasePrice > 0);
    const activeProjects = projects.filter(p => p.dealOutcome === "active");

    const totalPortfolioValue = projects.reduce((sum, p) => {
      const val = p.snapshot?.indicatedValue ?? p.purchasePrice;
      return sum + (val ?? 0);
    }, 0);

    const totalEquityDeployed = projects.reduce((sum, p) => sum + (p.dealPricingResults?.totalEquityInvested ?? 0), 0);
    const totalProfit = projects.reduce((sum, p) => sum + (p.dealPricingResults?.totalProfit ?? 0), 0);

    const avgCapRate = withCap.length > 0
      ? withCap.reduce((s, p) => s + toDisplayPct(p.snapshot?.capRate ?? p.year1CapRate ?? 0), 0) / withCap.length
      : null;

    const avgIrr = withIrr.length > 0
      ? withIrr.reduce((s, p) => s + toDisplayPct(p.snapshot?.irr ?? 0), 0) / withIrr.length
      : null;

    const avgEquityMultiple = (() => {
      const withEm = projects.filter(p => p.snapshot?.equityMultiple != null);
      if (withEm.length === 0) return null;
      return withEm.reduce((s, p) => s + (p.snapshot?.equityMultiple ?? 0), 0) / withEm.length;
    })();

    const weightedIrr = (() => {
      const withBoth = projects.filter(p => p.snapshot?.irr != null && p.purchasePrice != null && p.purchasePrice > 0);
      if (withBoth.length === 0) return null;
      const totalPrice = withBoth.reduce((s, p) => s + (p.purchasePrice ?? 0), 0);
      return withBoth.reduce((s, p) => s + toDisplayPct(p.snapshot?.irr ?? 0) * ((p.purchasePrice ?? 0) / totalPrice), 0);
    })();

    const scatterData = projects.filter(p => p.snapshot?.irr != null && (p.snapshot?.capRate ?? p.year1CapRate) != null).map(p => ({
      name: p.marinaName,
      capRate: toDisplayPct(p.snapshot?.capRate ?? p.year1CapRate ?? 0),
      irr: toDisplayPct(p.snapshot?.irr ?? 0),
      size: (p.purchasePrice ?? 1000000) / 500000,
    }));

    const statusCounts: Record<string, number> = {};
    projects.forEach(p => {
      const key = outcomeLabels[p.dealOutcome] || p.dealOutcome;
      statusCounts[key] = (statusCounts[key] || 0) + 1;
    });
    const statusPieData = Object.entries(statusCounts).map(([name, value]) => ({ name, value }));

    const dealComparisonData = projects
      .filter(p => p.purchasePrice != null && p.purchasePrice > 0)
      .slice(0, 15)
      .map(p => ({
        name: p.marinaName.length > 15 ? p.marinaName.slice(0, 15) + "\u2026" : p.marinaName,
        fullName: p.marinaName,
        purchasePrice: p.purchasePrice ?? 0,
        indicatedValue: p.snapshot?.indicatedValue ?? 0,
        noi: p.snapshot?.noi ?? p.t12Noi ?? 0,
      }));

    const irrComparisonData = projects
      .filter(p => p.snapshot?.irr != null)
      .slice(0, 15)
      .map(p => ({
        name: p.marinaName.length > 15 ? p.marinaName.slice(0, 15) + "\u2026" : p.marinaName,
        irr: toDisplayPct(p.snapshot?.irr ?? 0),
        equityMultiple: p.snapshot?.equityMultiple ?? 0,
        cashOnCash: p.snapshot?.cashOnCash != null ? toDisplayPct(p.snapshot.cashOnCash) : 0,
      }));

    const mcProjects = projects.filter(p => p.monteCarlo?.hasResults);
    const avgProbLoss = mcProjects.length > 0
      ? mcProjects.reduce((s, p) => s + (p.monteCarlo?.probabilityOfLoss ?? 0), 0) / mcProjects.length
      : null;

    return {
      totalProjects: projects.length,
      activeCount: activeProjects.length,
      totalPortfolioValue,
      totalEquityDeployed,
      totalProfit,
      avgCapRate,
      avgIrr,
      avgEquityMultiple,
      weightedIrr,
      scatterData,
      statusPieData,
      dealComparisonData,
      irrComparisonData,
      avgProbLoss,
      mcCount: mcProjects.length,
    };
  }, [projects]);

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96" />
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-[400px]" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6" ref={pdfRef}>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Pipeline Returns</h1>
          <p className="text-muted-foreground mt-1">
            Returns, analytics, and risk metrics across your deal pipeline
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ExportPdfButton contentRef={pdfRef} filename="pipeline-returns" title="Pipeline Returns" />
          {projects && projects.length > 0 && (
            <Button variant="outline" onClick={() => setLocation("/modeling/projects/new")}>
              <Building2 className="h-4 w-4 mr-2" />
              New Project
            </Button>
          )}
        </div>
      </div>

      {analytics && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <SummaryCard
              title="Total Projects"
              value={String(analytics.totalProjects)}
              icon={Building2}
              subtitle={`${analytics.activeCount} active`}
            />
            <SummaryCard
              title="Portfolio Value"
              value={fmtCompact(analytics.totalPortfolioValue || null)}
              icon={DollarSign}
              subtitle="Indicated or purchase"
            />
            <SummaryCard
              title="Avg Cap Rate"
              value={analytics.avgCapRate != null ? `${analytics.avgCapRate.toFixed(2)}%` : "\u2014"}
              icon={Percent}
            />
            <SummaryCard
              title="Avg IRR"
              value={analytics.avgIrr != null ? `${analytics.avgIrr.toFixed(2)}%` : "\u2014"}
              icon={TrendingUp}
              subtitle={analytics.weightedIrr != null ? `Weighted: ${analytics.weightedIrr.toFixed(2)}%` : undefined}
            />
            <SummaryCard
              title="Avg Equity Multiple"
              value={analytics.avgEquityMultiple != null ? `${analytics.avgEquityMultiple.toFixed(2)}x` : "\u2014"}
              icon={Target}
            />
            <SummaryCard
              title="Portfolio Risk"
              value={analytics.avgProbLoss != null ? `${(analytics.avgProbLoss * 100).toFixed(1)}% loss` : "\u2014"}
              icon={Shield}
              subtitle={analytics.mcCount > 0 ? `${analytics.mcCount} deals simulated` : "Run MC simulations"}
            />
          </div>

          <Tabs value={activePortfolioTab} onValueChange={setActivePortfolioTab}>
            <TabsList>
              <TabsTrigger value="overview">Portfolio Overview</TabsTrigger>
              <TabsTrigger value="comparison">Deal Comparison</TabsTrigger>
              <TabsTrigger value="risk">Risk & Returns</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="mt-4">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <PieChartIcon className="h-4 w-4" />
                      Deal Status Breakdown
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {analytics.statusPieData.length > 0 ? (
                      <ResponsiveContainer width="100%" height={220}>
                        <PieChart>
                          <Pie
                            data={analytics.statusPieData}
                            cx="50%"
                            cy="50%"
                            innerRadius={50}
                            outerRadius={80}
                            dataKey="value"
                            label={({ name, value }) => `${name} (${value})`}
                            labelLine={false}
                          >
                            {analytics.statusPieData.map((_, i) => (
                              <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-8">No data</p>
                    )}
                  </CardContent>
                </Card>

                <Card className="lg:col-span-2">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <BarChart3 className="h-4 w-4" />
                      Deal Value Comparison
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {analytics.dealComparisonData.length > 0 ? (
                      <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={analytics.dealComparisonData}>
                          <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                          <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-25} textAnchor="end" height={50} />
                          <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => fmtCompact(v)} />
                          <Tooltip
                            formatter={(v: number) => fmtCompact(v)}
                            labelFormatter={(label, payload) => payload?.[0]?.payload?.fullName || label}
                          />
                          <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                          <Bar dataKey="purchasePrice" name="Purchase Price" fill="#3b82f6" radius={[2, 2, 0, 0]} />
                          <Bar dataKey="noi" name="NOI" fill="#22c55e" radius={[2, 2, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-8">No pricing data</p>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="comparison" className="mt-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">IRR by Deal</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {analytics.irrComparisonData.length > 0 ? (
                      <ResponsiveContainer width="100%" height={280}>
                        <BarChart data={analytics.irrComparisonData} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                          <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => `${v.toFixed(0)}%`} />
                          <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={100} />
                          <Tooltip formatter={(v: number) => `${v.toFixed(2)}%`} />
                          <Bar dataKey="irr" name="IRR" radius={[0, 4, 4, 0]}>
                            {analytics.irrComparisonData.map((entry, i) => (
                              <Cell key={i} fill={entry.irr >= 0 ? "#22c55e" : "#ef4444"} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-8">No IRR data</p>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Cap Rate vs IRR</CardTitle>
                    <CardDescription className="text-xs">Bubble size = deal price</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {analytics.scatterData.length > 0 ? (
                      <ResponsiveContainer width="100%" height={280}>
                        <ScatterChart>
                          <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                          <XAxis type="number" dataKey="capRate" name="Cap Rate" unit="%" tick={{ fontSize: 10 }} />
                          <YAxis type="number" dataKey="irr" name="IRR" unit="%" tick={{ fontSize: 10 }} />
                          <ZAxis type="number" dataKey="size" range={[60, 400]} />
                          <Tooltip
                            content={({ active, payload }) => {
                              if (!active || !payload?.length) return null;
                              const d = payload[0].payload;
                              return (
                                <div className="bg-background border rounded-lg px-3 py-2 shadow-lg text-xs">
                                  <p className="font-medium">{d.name}</p>
                                  <p>Cap Rate: {d.capRate.toFixed(2)}%</p>
                                  <p>IRR: {d.irr.toFixed(2)}%</p>
                                </div>
                              );
                            }}
                          />
                          <Scatter data={analytics.scatterData} fill="#8b5cf6">
                            {analytics.scatterData.map((_, i) => (
                              <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                            ))}
                          </Scatter>
                        </ScatterChart>
                      </ResponsiveContainer>
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-8">Need both Cap Rate and IRR data</p>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="risk" className="mt-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Returns Comparison</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {analytics.irrComparisonData.length > 0 ? (
                      <ResponsiveContainer width="100%" height={280}>
                        <BarChart data={analytics.irrComparisonData}>
                          <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                          <XAxis dataKey="name" tick={{ fontSize: 9 }} angle={-25} textAnchor="end" height={50} />
                          <YAxis tick={{ fontSize: 10 }} />
                          <Tooltip formatter={(v: number) => v.toFixed(2)} />
                          <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                          <Bar dataKey="irr" name="IRR %" fill="#3b82f6" radius={[2, 2, 0, 0]} />
                          <Bar dataKey="equityMultiple" name="Equity Multiple" fill="#8b5cf6" radius={[2, 2, 0, 0]} />
                          <Bar dataKey="cashOnCash" name="CoC %" fill="#22c55e" radius={[2, 2, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-8">No returns data</p>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Monte Carlo Risk by Deal</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {(() => {
                      const mcDeals = (projects || []).filter(p => p.monteCarlo?.hasResults);
                      if (mcDeals.length === 0) {
                        return (
                          <div className="text-center py-8">
                            <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-muted-foreground opacity-40" />
                            <p className="text-sm text-muted-foreground">No Monte Carlo simulations run yet</p>
                            <p className="text-xs text-muted-foreground mt-1">Run simulations from individual deal workspaces</p>
                          </div>
                        );
                      }
                      const mcData = mcDeals.map(p => ({
                        name: p.marinaName.length > 15 ? p.marinaName.slice(0, 15) + "\u2026" : p.marinaName,
                        probLoss: (p.monteCarlo?.probabilityOfLoss ?? 0) * 100,
                        sharpe: p.monteCarlo?.sharpeRatio ?? 0,
                        irrMean: p.monteCarlo?.irrMean != null ? toDisplayPct(p.monteCarlo.irrMean) : 0,
                      }));
                      return (
                        <ResponsiveContainer width="100%" height={280}>
                          <ComposedChart data={mcData}>
                            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                            <XAxis dataKey="name" tick={{ fontSize: 9 }} angle={-25} textAnchor="end" height={50} />
                            <YAxis yAxisId="left" tick={{ fontSize: 10 }} />
                            <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} />
                            <Tooltip />
                            <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                            <Bar yAxisId="left" dataKey="probLoss" name="Prob. Loss %" fill="#ef4444" radius={[2, 2, 0, 0]} />
                            <Line yAxisId="right" type="monotone" dataKey="irrMean" name="Mean IRR %" stroke="#22c55e" strokeWidth={2} />
                          </ComposedChart>
                        </ResponsiveContainer>
                      );
                    })()}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Deal-Level Analytics
          </CardTitle>
          <CardDescription>Click any deal to expand its returns, projections, and risk analysis</CardDescription>
        </CardHeader>
        <CardContent>
          {!projects || projects.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Building2 className="h-12 w-12 mx-auto mb-4 opacity-40" />
              <p className="text-lg font-medium">No Financial Model projects yet</p>
              <p className="text-sm mt-1">
                Create a project in Financial Model to see returns and valuation data here.
              </p>
              <Button variant="outline" className="mt-4" onClick={() => setLocation("/modeling/projects/new")}>
                Create Project
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8"></TableHead>
                    <TableHead className="min-w-[160px]">Marina</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Purchase Price</TableHead>
                    <TableHead className="text-right">NOI</TableHead>
                    <TableHead className="text-right">Cap Rate</TableHead>
                    <TableHead className="text-right">IRR</TableHead>
                    <TableHead className="text-right">Equity Multiple</TableHead>
                    <TableHead className="text-right">Cash-on-Cash</TableHead>
                    <TableHead className="text-right">
                      <span className="inline-flex items-center gap-1">
                        MC Risk
                        <InfoTooltip
                          content="Monte Carlo risk: probability of loss, IRR range (P5-P95). Run a simulation from the deal workspace to populate."
                          side="bottom"
                        />
                      </span>
                    </TableHead>
                    <TableHead className="w-8"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {projects.map((project) => {
                    const capRate = project.snapshot?.capRate ?? project.year1CapRate;
                    const noi = project.snapshot?.noi ?? project.t12Noi;
                    const isExpanded = expandedDeals.has(project.id);

                    return (
                      <Fragment key={project.id}>
                        <TableRow
                          className={cn("cursor-pointer hover:bg-muted/50", isExpanded && "bg-muted/30")}
                          onClick={() => toggleDeal(project.id)}
                        >
                          <TableCell className="pr-0">
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            )}
                          </TableCell>
                          <TableCell className="font-medium">{project.marinaName}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {[project.city, project.state].filter(Boolean).join(", ") || "\u2014"}
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className={outcomeColors[project.dealOutcome] || ""}>
                              {outcomeLabels[project.dealOutcome] || project.dealOutcome.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(project.purchasePrice, { dash: true })}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(noi, { dash: true })}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatPercent(capRate, { dash: true })}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatPercent(project.snapshot?.irr, { dash: true })}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatMultiple(project.snapshot?.equityMultiple)}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatPercent(project.snapshot?.cashOnCash, { dash: true })}
                          </TableCell>
                          <TableCell className="text-right">
                            {project.monteCarlo?.hasResults ? (
                              <div className="inline-flex flex-col items-end gap-0.5">
                                <span className={cn(
                                  "text-sm font-medium",
                                  (project.monteCarlo.probabilityOfLoss ?? 0) < 0.1 ? "text-green-600" :
                                  (project.monteCarlo.probabilityOfLoss ?? 0) < 0.25 ? "text-yellow-600" : "text-red-600"
                                )}>
                                  {((project.monteCarlo.probabilityOfLoss ?? 0) * 100).toFixed(1)}% loss
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  IRR {project.monteCarlo.irrP5 != null ? `${toDisplayPct(project.monteCarlo.irrP5).toFixed(0)}` : "?"}\u2013{project.monteCarlo.irrP95 != null ? `${toDisplayPct(project.monteCarlo.irrP95).toFixed(0)}%` : "?"}
                                </span>
                              </div>
                            ) : (
                              <span className="text-muted-foreground text-xs">\u2014</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => {
                                e.stopPropagation();
                                setLocation(`/modeling/projects/${project.id}`);
                              }}
                            >
                              <ArrowUpRight className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                        {isExpanded && (
                          <TableRow>
                            <TableCell colSpan={12} className="bg-muted/20 p-0">
                              <div className="px-6">
                                <DealAnalyticsPanel project={project} />
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
