import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  ArrowLeft,
  Users,
  TrendingUp,
  TrendingDown,
  Calendar,
  DollarSign,
  BarChart3,
  Activity,
  Target,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Building2,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Legend,
  AreaChart,
  Area,
  ComposedChart,
  Cell,
} from "recharts";
import DashboardNav from "../components/navigation/DashboardNav";
import TimePeriodSelector from "../components/rent-roll/TimePeriodSelector";
import type { TimePeriodFilter } from "@shared/timePeriodUtils";
import { calculateDateRange } from "@shared/timePeriodUtils";
import { useProjectContext } from "../contexts/ProjectContext";

interface CohortData {
  cohortKey: string;
  cohortLabel: string;
  totalTenants: number;
  activeTenants: number;
  churned: number;
  retentionRate: number;
  churnRate: number;
  totalRevenue: number;
  totalLTV: number;
  avgLTV: number;
  avgTenureMonths: number;
  avgLeaseValue: number;
  leaseCount: number;
}

interface RetentionMatrix {
  cohortKey: string;
  cohortLabel: string;
  monthsFromStart: number[];
  retentionRates: number[];
}

interface RetentionHeatmapRow {
  cohort: string;
  periods: { period: number; rate: number }[];
}

interface RevenueTrendItem {
  period: string;
  revenue: number;
  newTenants: number;
  churn: number;
  ltv: number;
}

interface LTVTrendItem {
  period: string;
  tenantCount: number;
  avgLTV: number;
  totalLTV: number;
}

interface LTVTrendResponse {
  trend: LTVTrendItem[];
  summary: {
    currentAvgLTV: number;
    previousAvgLTV: number;
    change: number;
  };
}

interface AvailableProject {
  id: string;
  name: string;
}

interface CohortAnalysisData {
  summary: {
    totalTenants: number;
    activeTenants: number;
    churnedTenants: number;
    overallRetention: number;
    overallChurn: number;
    avgTenureMonths: number;
    cohortsCount: number;
    totalRevenue: number;
    avgRevenuePerCohort: number;
    avgLeaseValue: number;
    totalLTV: number;
    avgLTV: number;
    estimatedLTV: number;
    growthRate: number;
    retentionChange: number;
    ltvChange: number;
  };
  cohorts: CohortData[];
  retentionMatrix: RetentionMatrix[];
  retentionHeatmap: RetentionHeatmapRow[];
  revenueTrend: RevenueTrendItem[];
  availableProjects: AvailableProject[];
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

function getRetentionColor(rate: number): string {
  if (rate >= 80) return "bg-green-500";
  if (rate >= 60) return "bg-yellow-500";
  if (rate >= 40) return "bg-orange-500";
  return "bg-red-500";
}

function getRetentionHeatmapColor(rate: number): string {
  if (rate >= 90) return "bg-green-600 text-white";
  if (rate >= 80) return "bg-green-500 text-white";
  if (rate >= 70) return "bg-green-400 text-white";
  if (rate >= 60) return "bg-yellow-400 text-gray-900";
  if (rate >= 50) return "bg-yellow-500 text-gray-900";
  if (rate >= 40) return "bg-orange-400 text-white";
  if (rate >= 30) return "bg-orange-500 text-white";
  if (rate >= 20) return "bg-red-400 text-white";
  return "bg-red-500 text-white";
}

function TrendIndicator({ value, suffix = "%" }: { value: number; suffix?: string }) {
  if (value > 0) {
    return (
      <div className="flex items-center gap-1 text-green-600">
        <ArrowUpRight className="h-3 w-3" />
        <span className="text-xs tabular-nums">+{value.toFixed(1)}{suffix}</span>
      </div>
    );
  } else if (value < 0) {
    return (
      <div className="flex items-center gap-1 text-red-600">
        <ArrowDownRight className="h-3 w-3" />
        <span className="text-xs tabular-nums">{value.toFixed(1)}{suffix}</span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1 text-muted-foreground">
      <Minus className="h-3 w-3" />
      <span className="text-xs">0{suffix}</span>
    </div>
  );
}

export default function CohortAnalysisPage() {
  // Get project context - will have projectId when in project-specific view
  const { projectId: contextProjectId, isPortfolioScope, project } = useProjectContext();
  
  const [granularity, setGranularity] = useState<"month" | "quarter" | "year">("quarter");
  const [periodFilter, setPeriodFilter] = useState<TimePeriodFilter>({
    type: "TTM",
  });
  const [selectedProject, setSelectedProject] = useState<string>("all");
  const [ltvModalOpen, setLtvModalOpen] = useState(false);
  const [ltvGranularity, setLtvGranularity] = useState<"monthly" | "quarterly" | "yearly">("monthly");

  // Determine effective project based on context
  // If in project context, always use that project ID
  // If in portfolio context, use selectedProject state (allows dropdown)
  const effectiveProject = contextProjectId || selectedProject;
  const isProjectScoped = !!contextProjectId;

  const dateRange = calculateDateRange(periodFilter);
  
  // Create stable queryKey using serializable values
  const periodKey = JSON.stringify(periodFilter);

  const { data: cohortData, isLoading } = useQuery<CohortAnalysisData>({
    queryKey: ["/api/cohort/analysis", granularity, periodKey, effectiveProject],
    queryFn: async () => {
      const params = new URLSearchParams({ 
        granularity,
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
      });
      if (effectiveProject !== "all") {
        params.append("locationId", effectiveProject);
      }
      const response = await fetch(`/api/cohort/analysis?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch cohort data");
      return response.json();
    },
  });

  // LTV Trend query - only fetches when modal is open
  const { data: ltvTrendData, isLoading: ltvTrendLoading } = useQuery<LTVTrendResponse>({
    queryKey: ["/api/cohort/ltv-trend", ltvGranularity, effectiveProject],
    queryFn: async () => {
      const params = new URLSearchParams({ granularity: ltvGranularity });
      if (effectiveProject !== "all") {
        params.append("locationId", effectiveProject);
      }
      const response = await fetch(`/api/cohort/ltv-trend?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch LTV trend data");
      return response.json();
    },
    enabled: ltvModalOpen, // Only fetch when modal is open
  });

  const chartData = cohortData?.cohorts.map((c) => ({
    name: c.cohortLabel,
    retention: c.retentionRate,
    churn: c.churnRate,
    tenants: c.totalTenants,
    active: c.activeTenants,
    churned: c.churned,
    revenue: c.totalRevenue,
    avgValue: c.avgLeaseValue,
    avgLTV: c.avgLTV || 0,
    totalLTV: c.totalLTV || 0,
    avgTenure: c.avgTenureMonths || 0,
  })) || [];

  const retentionCurveData: { month: number; [key: string]: number }[] = [];
  if (cohortData?.retentionMatrix) {
    const maxMonths = Math.max(
      ...cohortData.retentionMatrix.flatMap((r) => r.monthsFromStart)
    );
    
    for (let m = 0; m <= maxMonths; m += 3) {
      const point: { month: number; [key: string]: number } = { month: m };
      cohortData.retentionMatrix.forEach((cohort) => {
        const idx = cohort.monthsFromStart.indexOf(m);
        if (idx !== -1) {
          point[cohort.cohortLabel] = cohort.retentionRates[idx];
        }
      });
      retentionCurveData.push(point);
    }
  }

  // Get all unique periods for heatmap columns
  const heatmapPeriods = cohortData?.retentionHeatmap?.length 
    ? Array.from(new Set(cohortData.retentionHeatmap.flatMap(r => r.periods.map(p => p.period)))).sort((a, b) => a - b)
    : [];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="border-b bg-card">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
            <div className="mb-4">
              <Skeleton className="h-8 w-64 mb-2" />
              <Skeleton className="h-4 w-96" />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <DashboardNav />
            </div>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
          <div className="grid gap-4 md:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const summary = cohortData?.summary;

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
          <div className="mb-4">
            <h1 className="text-3xl font-semibold text-foreground" data-testid="text-page-title">
              Marina Analytics
            </h1>
            <p className="text-sm text-muted-foreground mt-1" data-testid="text-page-description">
              Key performance metrics and trends
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <DashboardNav />
            <div className="flex flex-wrap items-center gap-3">
              <TimePeriodSelector value={periodFilter} onChange={setPeriodFilter} />
              <Select value={granularity} onValueChange={(v) => setGranularity(v as any)}>
                <SelectTrigger className="w-[140px]" data-testid="select-granularity">
                  <SelectValue placeholder="Granularity" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="month">Monthly</SelectItem>
                  <SelectItem value="quarter">Quarterly</SelectItem>
                  <SelectItem value="year">Yearly</SelectItem>
                </SelectContent>
              </Select>
              {/* Only show project selector when NOT in project-specific context */}
              {!isProjectScoped && cohortData?.availableProjects && cohortData.availableProjects.length > 1 && (
                <Select value={selectedProject} onValueChange={setSelectedProject}>
                  <SelectTrigger className="w-[180px]" data-testid="select-project">
                    <Building2 className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="All Projects" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Projects</SelectItem>
                    {cohortData.availableProjects.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {/* Show project badge when in project-specific context */}
              {isProjectScoped && project && (
                <Badge variant="secondary" className="px-3 py-1.5" data-testid="badge-current-project">
                  <Building2 className="h-3 w-3 mr-2" />
                  {project.name}
                </Badge>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card data-testid="card-total-tenants">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
              <CardTitle className="text-sm font-medium">Total Tenants</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold tabular-nums" data-testid="metric-total-tenants">
                {summary?.totalTenants || 0}
              </div>
              <div className="flex items-center gap-2 mt-1">
                <p className="text-xs text-muted-foreground">Across all cohorts</p>
                {summary?.growthRate !== undefined && summary.growthRate !== 0 && (
                  <TrendIndicator value={summary.growthRate} suffix="% vs prior" />
                )}
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-active-tenants">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
              <CardTitle className="text-sm font-medium">Active Tenants</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold tabular-nums text-green-600" data-testid="metric-active-tenants">
                {summary?.activeTenants || 0}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Currently retained</p>
            </CardContent>
          </Card>

          <Card data-testid="card-retention-rate">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
              <CardTitle className="text-sm font-medium">Overall Retention</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div
                className={`text-2xl font-bold tabular-nums ${
                  (summary?.overallRetention || 0) >= 70 ? "text-green-600" : "text-orange-600"
                }`}
                data-testid="metric-retention-rate"
              >
                {formatPercent(summary?.overallRetention || 0)}
              </div>
              <div className="flex items-center gap-2 mt-1">
                <p className="text-xs text-muted-foreground">
                  {formatPercent(summary?.overallChurn || 0)} churn
                </p>
                {summary?.retentionChange !== undefined && summary.retentionChange !== 0 && (
                  <TrendIndicator value={summary.retentionChange} suffix="pp" />
                )}
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-avg-tenure">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
              <CardTitle className="text-sm font-medium">Avg Tenure</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold tabular-nums" data-testid="metric-avg-tenure">
                {summary?.avgTenureMonths || 0} mo
              </div>
              <p className="text-xs text-muted-foreground mt-1">Average tenant tenure</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card data-testid="card-total-revenue">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
              <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold tabular-nums" data-testid="metric-total-revenue">
                {formatCurrency(summary?.totalRevenue || 0)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">From analyzed cohorts</p>
            </CardContent>
          </Card>

          <Card data-testid="card-avg-lease-value">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
              <CardTitle className="text-sm font-medium">Avg Lease Value</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold tabular-nums" data-testid="metric-avg-lease-value">
                {formatCurrency(summary?.avgLeaseValue || 0)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Per lease contract</p>
            </CardContent>
          </Card>

          <Card 
            data-testid="card-ltv" 
            className="cursor-pointer hover-elevate transition-all"
            onClick={() => setLtvModalOpen(true)}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
              <CardTitle className="text-sm font-medium">Avg LTV</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold tabular-nums text-primary" data-testid="metric-ltv">
                {formatCurrency(summary?.avgLTV || 0)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Average lifetime value per tenant</p>
              <p className="text-xs text-primary mt-1">Click to view trend</p>
              {(summary?.ltvChange ?? 0) !== 0 && (
                <TrendIndicator value={summary?.ltvChange || 0} />
              )}
            </CardContent>
          </Card>

          <Card data-testid="card-avg-cohort-revenue">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
              <CardTitle className="text-sm font-medium">Avg Cohort Revenue</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold tabular-nums" data-testid="metric-avg-cohort-revenue">
                {formatCurrency(summary?.avgRevenuePerCohort || 0)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Per acquisition period</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList className="flex-wrap">
            <TabsTrigger value="overview" data-testid="tab-overview">
              Overview
            </TabsTrigger>
            <TabsTrigger value="revenue" data-testid="tab-revenue">
              Revenue Analysis
            </TabsTrigger>
            <TabsTrigger value="retention" data-testid="tab-retention">
              Retention Curves
            </TabsTrigger>
            <TabsTrigger value="heatmap" data-testid="tab-heatmap">
              Retention Matrix
            </TabsTrigger>
            <TabsTrigger value="table" data-testid="tab-table">
              Cohort Table
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Retention by Cohort</CardTitle>
                  <CardDescription>Retention rate per acquisition period</CardDescription>
                </CardHeader>
                <CardContent>
                  {chartData.length > 0 ? (
                    <div className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" fontSize={12} />
                          <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                          <Tooltip
                            content={({ active, payload }) => {
                              if (active && payload && payload.length) {
                                const data = payload[0].payload;
                                return (
                                  <div className="bg-card border rounded-lg shadow-lg p-3">
                                    <p className="font-semibold text-sm">{data.name}</p>
                                    <p className="text-sm text-green-600">
                                      Retention: {formatPercent(data.retention)}
                                    </p>
                                    <p className="text-sm text-red-600">
                                      Churn: {formatPercent(data.churn)}
                                    </p>
                                    <p className="text-sm text-muted-foreground mt-1">
                                      {data.active} / {data.tenants} tenants
                                    </p>
                                  </div>
                                );
                              }
                              return null;
                            }}
                          />
                          <Bar dataKey="retention" radius={[4, 4, 0, 0]} barSize={28}>
                            {chartData.map((entry, index) => (
                              <Cell 
                                key={`cell-${index}`} 
                                fill={entry.retention >= 70 ? "hsl(var(--chart-2))" : entry.retention >= 50 ? "hsl(var(--chart-4))" : "hsl(var(--chart-5))"}
                              />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="h-80 flex items-center justify-center text-muted-foreground">
                      No cohort data available
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Cohort Size Distribution</CardTitle>
                  <CardDescription>Active vs churned tenants per cohort</CardDescription>
                </CardHeader>
                <CardContent>
                  {chartData.length > 0 ? (
                    <div className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" fontSize={12} />
                          <YAxis />
                          <Tooltip
                            content={({ active, payload }) => {
                              if (active && payload && payload.length) {
                                const data = payload[0].payload;
                                return (
                                  <div className="bg-card border rounded-lg shadow-lg p-3">
                                    <p className="font-semibold text-sm">{data.name}</p>
                                    <p className="text-sm text-green-600">
                                      Active: {data.active}
                                    </p>
                                    <p className="text-sm text-red-600">
                                      Churned: {data.churned}
                                    </p>
                                    <p className="text-sm text-muted-foreground">
                                      Total: {data.tenants}
                                    </p>
                                  </div>
                                );
                              }
                              return null;
                            }}
                          />
                          <Legend />
                          <Bar dataKey="active" name="Active" fill="hsl(var(--chart-2))" stackId="a" barSize={28} />
                          <Bar dataKey="churned" name="Churned" fill="hsl(var(--chart-5))" stackId="a" barSize={28} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="h-80 flex items-center justify-center text-muted-foreground">
                      No cohort data available
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="revenue" className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Revenue by Cohort</CardTitle>
                  <CardDescription>Total revenue generated per acquisition period</CardDescription>
                </CardHeader>
                <CardContent>
                  {chartData.length > 0 ? (
                    <div className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" fontSize={12} />
                          <YAxis tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                          <Tooltip
                            content={({ active, payload }) => {
                              if (active && payload && payload.length) {
                                const data = payload[0].payload;
                                return (
                                  <div className="bg-card border rounded-lg shadow-lg p-3">
                                    <p className="font-semibold text-sm">{data.name}</p>
                                    <p className="text-sm">
                                      Revenue: {formatCurrency(data.revenue)}
                                    </p>
                                    <p className="text-sm text-muted-foreground">
                                      Avg Lease: {formatCurrency(data.avgValue)}
                                    </p>
                                    <p className="text-sm text-muted-foreground">
                                      {data.tenants} tenants
                                    </p>
                                  </div>
                                );
                              }
                              return null;
                            }}
                          />
                          <Bar dataKey="revenue" name="Revenue" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} barSize={28} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="h-80 flex items-center justify-center text-muted-foreground">
                      No revenue data available
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Acquisition & Churn Trend</CardTitle>
                  <CardDescription>New tenants vs churned per period</CardDescription>
                </CardHeader>
                <CardContent>
                  {cohortData?.revenueTrend && cohortData.revenueTrend.length > 0 ? (
                    <div className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={cohortData.revenueTrend}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="period" fontSize={12} />
                          <YAxis yAxisId="left" />
                          <YAxis yAxisId="right" orientation="right" tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                          <Tooltip
                            content={({ active, payload }) => {
                              if (active && payload && payload.length) {
                                const data = payload[0].payload;
                                return (
                                  <div className="bg-card border rounded-lg shadow-lg p-3">
                                    <p className="font-semibold text-sm">{data.period}</p>
                                    <p className="text-sm text-green-600">
                                      New Tenants: {data.newTenants}
                                    </p>
                                    <p className="text-sm text-red-600">
                                      Churned: {data.churn}
                                    </p>
                                    <p className="text-sm text-primary">
                                      Revenue: {formatCurrency(data.revenue)}
                                    </p>
                                  </div>
                                );
                              }
                              return null;
                            }}
                          />
                          <Legend />
                          <Bar yAxisId="left" dataKey="newTenants" name="New Tenants" fill="hsl(var(--chart-2))" barSize={20} />
                          <Bar yAxisId="left" dataKey="churn" name="Churned" fill="hsl(var(--chart-5))" barSize={20} />
                          <Line yAxisId="right" type="monotone" dataKey="revenue" name="Revenue" stroke="hsl(var(--chart-1))" strokeWidth={2} dot={false} />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="h-80 flex items-center justify-center text-muted-foreground">
                      No trend data available
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Average Lease Value by Cohort</CardTitle>
                <CardDescription>Track changes in average contract values over time</CardDescription>
              </CardHeader>
              <CardContent>
                {chartData.length > 0 ? (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" fontSize={12} />
                        <YAxis tickFormatter={(v) => `$${v.toLocaleString()}`} />
                        <Tooltip
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              const data = payload[0].payload;
                              return (
                                <div className="bg-card border rounded-lg shadow-lg p-3">
                                  <p className="font-semibold text-sm">{data.name}</p>
                                  <p className="text-sm">Avg Lease: {formatCurrency(data.avgValue)}</p>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <Area type="monotone" dataKey="avgValue" name="Avg Lease Value" fill="hsl(var(--chart-1))" fillOpacity={0.3} stroke="hsl(var(--chart-1))" strokeWidth={2} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-64 flex items-center justify-center text-muted-foreground">
                    No data available
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Lifetime Value (LTV) by Cohort</CardTitle>
                <CardDescription>Actual cumulative revenue per tenant by acquisition period</CardDescription>
              </CardHeader>
              <CardContent>
                {chartData.length > 0 ? (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" fontSize={12} />
                        <YAxis yAxisId="left" tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                        <YAxis yAxisId="right" orientation="right" tickFormatter={(v) => `${v}mo`} />
                        <Tooltip
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              const data = payload[0].payload;
                              return (
                                <div className="bg-card border rounded-lg shadow-lg p-3">
                                  <p className="font-semibold text-sm">{data.name}</p>
                                  <p className="text-sm text-primary">Avg LTV: {formatCurrency(data.avgLTV)}</p>
                                  <p className="text-sm text-muted-foreground">Total LTV: {formatCurrency(data.totalLTV)}</p>
                                  <p className="text-sm text-muted-foreground">Avg Tenure: {data.avgTenure} months</p>
                                  <p className="text-sm text-muted-foreground">{data.tenants} tenants</p>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <Legend />
                        <Bar yAxisId="left" dataKey="avgLTV" name="Avg LTV" fill="hsl(var(--chart-3))" radius={[4, 4, 0, 0]} barSize={28} />
                        <Line yAxisId="right" type="monotone" dataKey="avgTenure" name="Avg Tenure (mo)" stroke="hsl(var(--chart-4))" strokeWidth={2} dot={true} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-64 flex items-center justify-center text-muted-foreground">
                    No LTV data available
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="retention" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Retention Over Time</CardTitle>
                <CardDescription>
                  How each cohort&apos;s retention changes over months from their start date
                </CardDescription>
              </CardHeader>
              <CardContent>
                {retentionCurveData.length > 0 && cohortData?.retentionMatrix.length ? (
                  <div className="h-96">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={retentionCurveData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis
                          dataKey="month"
                          tickFormatter={(v) => `${v}mo`}
                          label={{ value: "Months from Start", position: "bottom" }}
                        />
                        <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                        <Tooltip
                          content={({ active, payload, label }) => {
                            if (active && payload && payload.length) {
                              return (
                                <div className="bg-card border rounded-lg shadow-lg p-3">
                                  <p className="font-semibold text-sm">{label} months</p>
                                  {payload.map((p: any) => (
                                    <p key={p.dataKey} className="text-sm" style={{ color: p.color }}>
                                      {p.dataKey}: {formatPercent(p.value)}
                                    </p>
                                  ))}
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <Legend />
                        {cohortData.retentionMatrix.slice(-6).map((cohort, idx) => (
                          <Line
                            key={cohort.cohortKey}
                            type="monotone"
                            dataKey={cohort.cohortLabel}
                            stroke={`hsl(${(idx * 60) % 360}, 70%, 50%)`}
                            strokeWidth={2}
                            dot={false}
                          />
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-96 flex items-center justify-center text-muted-foreground">
                    No retention curve data available
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="heatmap" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Retention Matrix Heatmap</CardTitle>
                <CardDescription>
                  Month-by-month retention rates for each cohort (darker green = higher retention)
                </CardDescription>
              </CardHeader>
              <CardContent>
                {cohortData?.retentionHeatmap && cohortData.retentionHeatmap.length > 0 ? (
                  <ScrollArea className="w-full">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="sticky left-0 bg-card z-10 min-w-[120px]">Cohort</TableHead>
                          {heatmapPeriods.map(period => (
                            <TableHead key={period} className="text-center min-w-[60px]">
                              {period}mo
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {cohortData.retentionHeatmap.map((row, rowIdx) => (
                          <TableRow key={rowIdx}>
                            <TableCell className="font-medium sticky left-0 bg-card z-10">
                              <Badge variant="outline">{row.cohort}</Badge>
                            </TableCell>
                            {heatmapPeriods.map(period => {
                              const cell = row.periods.find(p => p.period === period);
                              return (
                                <TableCell 
                                  key={period} 
                                  className={`text-center tabular-nums text-xs ${cell ? getRetentionHeatmapColor(cell.rate) : "bg-muted text-muted-foreground"}`}
                                >
                                  {cell ? `${cell.rate.toFixed(0)}%` : "-"}
                                </TableCell>
                              );
                            })}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    <ScrollBar orientation="horizontal" />
                  </ScrollArea>
                ) : (
                  <div className="h-64 flex items-center justify-center text-muted-foreground">
                    No retention matrix data available
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="table" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Cohort Details</CardTitle>
                <CardDescription>Full breakdown by acquisition period</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="w-full">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="sticky left-0 bg-card z-10">Cohort</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead className="text-right">Active</TableHead>
                        <TableHead className="text-right">Churned</TableHead>
                        <TableHead className="text-right">Retention</TableHead>
                        <TableHead className="text-right">Avg LTV</TableHead>
                        <TableHead className="text-right">Avg Tenure</TableHead>
                        <TableHead className="text-right">Total Revenue</TableHead>
                        <TableHead className="text-right">Leases</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {cohortData?.cohorts.map((cohort, index) => (
                        <TableRow key={cohort.cohortKey} data-testid={`row-cohort-${index}`}>
                          <TableCell className="font-medium sticky left-0 bg-card z-10">
                            <Badge variant="outline">{cohort.cohortLabel}</Badge>
                          </TableCell>
                          <TableCell className="text-right tabular-nums">{cohort.totalTenants}</TableCell>
                          <TableCell className="text-right tabular-nums text-green-600">
                            {cohort.activeTenants}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-red-600">
                            {cohort.churned}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <div
                                className={`w-2 h-2 rounded-full ${getRetentionColor(cohort.retentionRate)}`}
                              />
                              <span className="tabular-nums">{formatPercent(cohort.retentionRate)}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-primary font-medium">
                            {formatCurrency(cohort.avgLTV || 0)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {cohort.avgTenureMonths || 0} mo
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatCurrency(cohort.totalRevenue)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {cohort.leaseCount}
                          </TableCell>
                        </TableRow>
                      ))}
                      {(!cohortData?.cohorts || cohortData.cohorts.length === 0) && (
                        <TableRow>
                          <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                            No cohort data found
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                  <ScrollBar orientation="horizontal" />
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* LTV Trend Modal */}
      <Dialog open={ltvModalOpen} onOpenChange={setLtvModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Lifetime Value (LTV) Trend</DialogTitle>
            <DialogDescription>
              Track how average lifetime value per tenant has changed over time
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6">
            {/* Granularity selector */}
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium">View by:</span>
              <Select value={ltvGranularity} onValueChange={(v) => setLtvGranularity(v as typeof ltvGranularity)}>
                <SelectTrigger className="w-32" data-testid="select-ltv-granularity">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="quarterly">Quarterly</SelectItem>
                  <SelectItem value="yearly">Yearly</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Summary cards */}
            {ltvTrendData?.summary && (
              <div className="grid grid-cols-3 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Current Avg LTV</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold tabular-nums text-primary">
                      {formatCurrency(ltvTrendData.summary.currentAvgLTV)}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Previous Period</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold tabular-nums">
                      {formatCurrency(ltvTrendData.summary.previousAvgLTV)}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Change</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className={`text-2xl font-bold tabular-nums flex items-center gap-2 ${
                      ltvTrendData.summary.change > 0 ? "text-green-600" : 
                      ltvTrendData.summary.change < 0 ? "text-red-600" : ""
                    }`}>
                      {ltvTrendData.summary.change > 0 ? (
                        <ArrowUpRight className="h-5 w-5" />
                      ) : ltvTrendData.summary.change < 0 ? (
                        <ArrowDownRight className="h-5 w-5" />
                      ) : null}
                      {ltvTrendData.summary.change > 0 ? "+" : ""}{ltvTrendData.summary.change.toFixed(1)}%
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* LTV Trend Chart */}
            {ltvTrendLoading ? (
              <div className="h-80 flex items-center justify-center">
                <Skeleton className="h-64 w-full" />
              </div>
            ) : ltvTrendData?.trend && ltvTrendData.trend.length > 0 ? (
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={ltvTrendData.trend.map(t => ({
                    ...t,
                    period: new Date(t.period).toLocaleDateString('en-US', { 
                      month: 'short', 
                      year: ltvGranularity === 'yearly' ? 'numeric' : '2-digit' 
                    }),
                  }))}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="period" fontSize={12} />
                    <YAxis yAxisId="left" tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                    <YAxis yAxisId="right" orientation="right" />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="bg-card border rounded-lg shadow-lg p-3">
                              <p className="font-semibold text-sm">{data.period}</p>
                              <p className="text-sm text-primary">Avg LTV: {formatCurrency(data.avgLTV)}</p>
                              <p className="text-sm text-muted-foreground">Total LTV: {formatCurrency(data.totalLTV)}</p>
                              <p className="text-sm text-muted-foreground">{data.tenantCount} tenants</p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Legend />
                    <Bar yAxisId="left" dataKey="avgLTV" name="Avg LTV" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} barSize={24} />
                    <Line yAxisId="right" type="monotone" dataKey="tenantCount" name="Tenants" stroke="hsl(var(--chart-2))" strokeWidth={2} dot={true} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-80 flex items-center justify-center text-muted-foreground">
                No LTV trend data available
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
