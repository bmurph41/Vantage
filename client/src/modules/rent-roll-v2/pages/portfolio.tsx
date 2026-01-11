import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ArrowLeft,
  Building2,
  DollarSign,
  TrendingUp,
  Users,
  BarChart3,
  PieChart as PieChartIcon,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import DashboardNav from "../components/navigation/DashboardNav";

interface ProjectMetrics {
  projectId: string;
  projectName: string;
  projectType: "OWNED" | "DEAL";
  totalRevenue: number;
  activeLeases: number;
  totalCapacity: number;
  occupancyRate: number;
  avgLeaseValue: number;
  moveIns: number;
  moveOuts: number;
  netChange: number;
}

interface PortfolioSummary {
  totalProjects: number;
  ownedProjects: number;
  dealProjects: number;
  totalRevenue: number;
  totalActiveLeases: number;
  totalCapacity: number;
  avgOccupancy: number;
  avgLeaseValue: number;
  totalMoveIns: number;
  totalMoveOuts: number;
  netChange: number;
  projectMetrics: ProjectMetrics[];
}

const CHART_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
  "hsl(210, 100%, 50%)",
  "hsl(280, 100%, 50%)",
  "hsl(30, 100%, 50%)",
];

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

export default function PortfolioPage() {
  const [projectTypeFilter, setProjectTypeFilter] = useState<"ALL" | "OWNED" | "DEAL">("ALL");
  const [sortBy, setSortBy] = useState<"revenue" | "occupancy" | "leases">("revenue");

  const { data: portfolioData, isLoading } = useQuery<PortfolioSummary>({
    queryKey: ["/api/portfolio/summary", projectTypeFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (projectTypeFilter !== "ALL") {
        params.append("projectType", projectTypeFilter);
      }
      const response = await fetch(`/api/portfolio/summary?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch portfolio data");
      return response.json();
    },
  });

  const sortedProjects = portfolioData?.projectMetrics
    ? [...portfolioData.projectMetrics].sort((a, b) => {
        switch (sortBy) {
          case "revenue":
            return b.totalRevenue - a.totalRevenue;
          case "occupancy":
            return b.occupancyRate - a.occupancyRate;
          case "leases":
            return b.activeLeases - a.activeLeases;
          default:
            return 0;
        }
      })
    : [];

  const revenueChartData = sortedProjects.map((p) => ({
    name: p.projectName.length > 15 ? p.projectName.substring(0, 15) + "..." : p.projectName,
    fullName: p.projectName,
    revenue: p.totalRevenue,
    type: p.projectType,
  }));

  const occupancyChartData = sortedProjects.map((p) => ({
    name: p.projectName.length > 15 ? p.projectName.substring(0, 15) + "..." : p.projectName,
    fullName: p.projectName,
    occupancy: p.occupancyRate,
    type: p.projectType,
  }));

  const pieChartData = sortedProjects.map((p, index) => ({
    name: p.projectName,
    value: p.totalRevenue,
    color: CHART_COLORS[index % CHART_COLORS.length],
  }));

  const totalPieRevenue = pieChartData.reduce((sum, p) => sum + p.value, 0);

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
            <Select value={projectTypeFilter} onValueChange={(v) => setProjectTypeFilter(v as any)}>
              <SelectTrigger className="w-[180px]" data-testid="select-project-type">
                <SelectValue placeholder="All Projects" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Projects</SelectItem>
                <SelectItem value="OWNED">Owned Marinas</SelectItem>
                <SelectItem value="DEAL">Pipeline Deals</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        <div className="grid gap-4 md:grid-cols-4">
          <Card data-testid="card-total-revenue">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
              <CardTitle className="text-sm font-medium">Total Portfolio Revenue</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold tabular-nums" data-testid="metric-total-revenue">
                {formatCurrency(portfolioData?.totalRevenue || 0)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Trailing 12 months</p>
            </CardContent>
          </Card>

          <Card data-testid="card-active-leases">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
              <CardTitle className="text-sm font-medium">Total Active Leases</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold tabular-nums" data-testid="metric-active-leases">
                {portfolioData?.totalActiveLeases || 0}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Across {portfolioData?.totalProjects || 0} projects
              </p>
            </CardContent>
          </Card>

          <Card data-testid="card-avg-occupancy">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
              <CardTitle className="text-sm font-medium">Avg Portfolio Occupancy</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold tabular-nums" data-testid="metric-avg-occupancy">
                {formatPercent(portfolioData?.avgOccupancy || 0)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {portfolioData?.totalActiveLeases || 0} / {portfolioData?.totalCapacity || 0} capacity
              </p>
            </CardContent>
          </Card>

          <Card data-testid="card-net-change">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
              <CardTitle className="text-sm font-medium">Net Move Change</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <span
                  className={`text-2xl font-bold tabular-nums ${
                    (portfolioData?.netChange || 0) >= 0 ? "text-green-600" : "text-red-600"
                  }`}
                  data-testid="metric-net-change"
                >
                  {(portfolioData?.netChange || 0) >= 0 ? "+" : ""}
                  {portfolioData?.netChange || 0}
                </span>
                {(portfolioData?.netChange || 0) >= 0 ? (
                  <ArrowUpRight className="h-5 w-5 text-green-600" />
                ) : (
                  <ArrowDownRight className="h-5 w-5 text-red-600" />
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {portfolioData?.totalMoveIns || 0} ins / {portfolioData?.totalMoveOuts || 0} outs
              </p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="comparison" className="space-y-4">
          <TabsList>
            <TabsTrigger value="comparison" data-testid="tab-comparison">
              Marina Comparison
            </TabsTrigger>
            <TabsTrigger value="breakdown" data-testid="tab-breakdown">
              Revenue Breakdown
            </TabsTrigger>
            <TabsTrigger value="table" data-testid="tab-table">
              Detailed Table
            </TabsTrigger>
          </TabsList>

          <TabsContent value="comparison" className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Revenue by Marina</CardTitle>
                  <CardDescription>TTM revenue comparison across projects</CardDescription>
                </CardHeader>
                <CardContent>
                  {revenueChartData.length > 0 ? (
                    <div className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={revenueChartData} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis type="number" tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                          <YAxis type="category" dataKey="name" width={120} />
                          <Tooltip
                            content={({ active, payload }) => {
                              if (active && payload && payload.length) {
                                const data = payload[0].payload;
                                return (
                                  <div className="bg-card border rounded-lg shadow-lg p-3">
                                    <p className="font-semibold text-sm">{data.fullName}</p>
                                    <p className="text-sm">{formatCurrency(data.revenue)}</p>
                                    <Badge variant="outline" className="mt-1">
                                      {data.type}
                                    </Badge>
                                  </div>
                                );
                              }
                              return null;
                            }}
                          />
                          <Bar dataKey="revenue" fill="hsl(var(--chart-1))" radius={[0, 4, 4, 0]} barSize={18} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="h-80 flex items-center justify-center text-muted-foreground">
                      No data available
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Occupancy by Marina</CardTitle>
                  <CardDescription>Current occupancy rate comparison</CardDescription>
                </CardHeader>
                <CardContent>
                  {occupancyChartData.length > 0 ? (
                    <div className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={occupancyChartData} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                          <YAxis type="category" dataKey="name" width={120} />
                          <Tooltip
                            content={({ active, payload }) => {
                              if (active && payload && payload.length) {
                                const data = payload[0].payload;
                                return (
                                  <div className="bg-card border rounded-lg shadow-lg p-3">
                                    <p className="font-semibold text-sm">{data.fullName}</p>
                                    <p className="text-sm">{formatPercent(data.occupancy)}</p>
                                    <Badge variant="outline" className="mt-1">
                                      {data.type}
                                    </Badge>
                                  </div>
                                );
                              }
                              return null;
                            }}
                          />
                          <Bar dataKey="occupancy" fill="hsl(var(--chart-2))" radius={[0, 4, 4, 0]} barSize={18} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="h-80 flex items-center justify-center text-muted-foreground">
                      No data available
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="breakdown" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Revenue Distribution</CardTitle>
                <CardDescription>Share of portfolio revenue by marina</CardDescription>
              </CardHeader>
              <CardContent>
                {pieChartData.length > 0 ? (
                  <div className="h-96">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={pieChartData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) =>
                            `${name.length > 12 ? name.substring(0, 12) + "..." : name}: ${(percent * 100).toFixed(1)}%`
                          }
                          outerRadius={120}
                          dataKey="value"
                        >
                          {pieChartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              const data = payload[0].payload;
                              return (
                                <div className="bg-card border rounded-lg shadow-lg p-3">
                                  <p className="font-semibold text-sm">{data.name}</p>
                                  <p className="text-sm">{formatCurrency(data.value)}</p>
                                  <p className="text-sm text-muted-foreground">
                                    {((data.value / totalPieRevenue) * 100).toFixed(1)}% of total
                                  </p>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-96 flex items-center justify-center text-muted-foreground">
                    No data available
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="table" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">Marina Metrics Comparison</CardTitle>
                    <CardDescription>Detailed breakdown by project</CardDescription>
                  </div>
                  <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
                    <SelectTrigger className="w-[150px]" data-testid="select-sort-by">
                      <SelectValue placeholder="Sort by..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="revenue">Revenue</SelectItem>
                      <SelectItem value="occupancy">Occupancy</SelectItem>
                      <SelectItem value="leases">Active Leases</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Marina</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Revenue</TableHead>
                      <TableHead className="text-right">Active Leases</TableHead>
                      <TableHead className="text-right">Capacity</TableHead>
                      <TableHead className="text-right">Occupancy</TableHead>
                      <TableHead className="text-right">Avg Lease Value</TableHead>
                      <TableHead className="text-right">Net Change</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedProjects.map((project, index) => (
                      <TableRow key={project.projectId} data-testid={`row-project-${index}`}>
                        <TableCell className="font-medium">
                          <Link href={`/rent-roll/${project.projectId}`}>
                            <span className="text-primary hover:underline cursor-pointer">
                              {project.projectName}
                            </span>
                          </Link>
                        </TableCell>
                        <TableCell>
                          <Badge variant={project.projectType === "OWNED" ? "default" : "secondary"}>
                            {project.projectType}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatCurrency(project.totalRevenue)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{project.activeLeases}</TableCell>
                        <TableCell className="text-right tabular-nums">{project.totalCapacity}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatPercent(project.occupancyRate)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatCurrency(project.avgLeaseValue)}
                        </TableCell>
                        <TableCell className="text-right">
                          <span
                            className={`tabular-nums ${
                              project.netChange >= 0 ? "text-green-600" : "text-red-600"
                            }`}
                          >
                            {project.netChange >= 0 ? "+" : ""}
                            {project.netChange}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                    {sortedProjects.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                          No projects found
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
