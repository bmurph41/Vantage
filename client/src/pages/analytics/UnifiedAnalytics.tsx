import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { 
  BarChart3, 
  TrendingUp, 
  Users, 
  Building2, 
  FileCheck, 
  Calculator, 
  Anchor,
  AlertTriangle,
  CheckCircle2,
  DollarSign,
  Percent,
  Clock,
  Target
} from "lucide-react";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, CartesianGrid, Legend } from "recharts";

interface UnifiedAnalytics {
  crm: {
    totalContacts: number;
    totalCompanies: number;
    totalProperties: number;
    totalDeals: number;
    dealsByStage: Record<string, number>;
    recentDeals: number;
    pipelineValue: number;
    conversionRate: number;
    wonDeals: number;
    lostDeals: number;
  };
  dueDiligence: {
    totalProjects: number;
    activeProjects: number;
    completedProjects: number;
    projectsByStatus: Record<string, number>;
    completionRate: number;
    overdueTasks: number;
    totalTasks: number;
  };
  modeling: {
    totalProjects: number;
    recentProjects: number;
    avgPurchasePrice: number;
    avgCapRate: number;
    totalPurchaseValue: number;
  };
  operations: {
    totalRentRolls: number;
    totalUnits: number;
    occupiedUnits: number;
    occupancyRate: number;
    totalMonthlyRevenue: number;
  };
  intelligence: {
    totalArticles: number;
    recentArticles: number;
  };
  crossModule: {
    dealsWithDDProjects: number;
    dealsWithModelingProjects: number;
    propertiesWithDeals: number;
    contactsWithDeals: number;
  };
  period: string;
  lastUpdated: string;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

function formatCurrency(value: number): string {
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(1)}M`;
  } else if (value >= 1000) {
    return `$${(value / 1000).toFixed(0)}K`;
  }
  return `$${value.toFixed(0)}`;
}

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

function KpiCard({ 
  title, 
  value, 
  subtitle, 
  icon: Icon, 
  trend,
  variant = 'default'
}: { 
  title: string; 
  value: string | number; 
  subtitle?: string; 
  icon: any;
  trend?: { value: number; label: string };
  variant?: 'default' | 'success' | 'warning' | 'danger';
}) {
  const variantStyles = {
    default: 'border-l-primary',
    success: 'border-l-green-500',
    warning: 'border-l-yellow-500',
    danger: 'border-l-red-500',
  };

  return (
    <Card className={`border-l-4 ${variantStyles[variant]}`}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
        {trend && (
          <div className="flex items-center gap-1 mt-2">
            <TrendingUp className={`h-3 w-3 ${trend.value >= 0 ? 'text-green-500' : 'text-red-500'}`} />
            <span className={`text-xs ${trend.value >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {trend.value >= 0 ? '+' : ''}{trend.value}% {trend.label}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SkeletonCard() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <Skeleton className="h-4 w-24" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-8 w-16 mb-2" />
        <Skeleton className="h-3 w-32" />
      </CardContent>
    </Card>
  );
}

export default function UnifiedAnalytics() {
  const [period, setPeriod] = useState<string>('30d');

  const { data, isLoading, error } = useQuery<UnifiedAnalytics>({
    queryKey: ['/api/analytics/unified', period],
    queryFn: async () => {
      const response = await fetch(`/api/analytics/unified?period=${period}`);
      if (!response.ok) throw new Error('Failed to fetch analytics');
      return response.json();
    },
  });

  const dealStageData = data?.crm.dealsByStage 
    ? Object.entries(data.crm.dealsByStage).map(([name, value]) => ({ name, value }))
    : [];

  const ddStatusData = data?.dueDiligence.projectsByStatus
    ? Object.entries(data.dueDiligence.projectsByStatus).map(([name, value]) => ({ name, value }))
    : [];

  const chartConfig = {
    deals: { label: "Deals", color: "#0088FE" },
    projects: { label: "Projects", color: "#00C49F" },
    value: { label: "Value", color: "#8884d8" },
  };

  if (error) {
    return (
      <div className="p-6">
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              <span>Failed to load analytics data</span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Cross-Module Analytics</h1>
          <p className="text-muted-foreground">
            Unified view of CRM, Due Diligence, Modeling, and Operations metrics
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Time Period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
              <SelectItem value="ytd">Year to Date</SelectItem>
            </SelectContent>
          </Select>
          {data?.lastUpdated && (
            <Badge variant="outline" className="text-xs">
              <Clock className="h-3 w-3 mr-1" />
              Updated {new Date(data.lastUpdated).toLocaleTimeString()}
            </Badge>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(8)].map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              title="Total Pipeline Value"
              value={formatCurrency(data?.crm.pipelineValue || 0)}
              subtitle={`${data?.crm.totalDeals || 0} active deals`}
              icon={DollarSign}
              variant="default"
            />
            <KpiCard
              title="Win Rate"
              value={formatPercent(data?.crm.conversionRate || 0)}
              subtitle={`${data?.crm.wonDeals || 0} won / ${data?.crm.lostDeals || 0} lost`}
              icon={Target}
              variant={data?.crm.conversionRate && data.crm.conversionRate > 50 ? 'success' : 'warning'}
            />
            <KpiCard
              title="DD Completion Rate"
              value={formatPercent(data?.dueDiligence.completionRate || 0)}
              subtitle={`${data?.dueDiligence.completedProjects || 0} completed projects`}
              icon={CheckCircle2}
              variant={data?.dueDiligence.completionRate && data.dueDiligence.completionRate > 70 ? 'success' : 'warning'}
            />
            <KpiCard
              title="Overdue Tasks"
              value={data?.dueDiligence.overdueTasks || 0}
              subtitle={`of ${data?.dueDiligence.totalTasks || 0} total tasks`}
              icon={AlertTriangle}
              variant={data?.dueDiligence.overdueTasks && data.dueDiligence.overdueTasks > 0 ? 'danger' : 'success'}
            />
          </div>

          <Tabs defaultValue="overview" className="space-y-4">
            <TabsList>
              <TabsTrigger value="overview">
                <BarChart3 className="h-4 w-4 mr-2" />
                Overview
              </TabsTrigger>
              <TabsTrigger value="crm">
                <Users className="h-4 w-4 mr-2" />
                CRM
              </TabsTrigger>
              <TabsTrigger value="dd">
                <FileCheck className="h-4 w-4 mr-2" />
                Due Diligence
              </TabsTrigger>
              <TabsTrigger value="modeling">
                <Calculator className="h-4 w-4 mr-2" />
                Modeling
              </TabsTrigger>
              <TabsTrigger value="operations">
                <Anchor className="h-4 w-4 mr-2" />
                Operations
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <KpiCard
                  title="Total Contacts"
                  value={data?.crm.totalContacts || 0}
                  icon={Users}
                />
                <KpiCard
                  title="Companies"
                  value={data?.crm.totalCompanies || 0}
                  icon={Building2}
                />
                <KpiCard
                  title="DD Projects"
                  value={data?.dueDiligence.totalProjects || 0}
                  subtitle={`${data?.dueDiligence.activeProjects || 0} active`}
                  icon={FileCheck}
                />
                <KpiCard
                  title="Modeling Projects"
                  value={data?.modeling.totalProjects || 0}
                  subtitle={`${data?.modeling.recentProjects || 0} recent`}
                  icon={Calculator}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Deals by Stage</CardTitle>
                    <CardDescription>Distribution of deals across pipeline stages</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {dealStageData.length > 0 ? (
                      <ChartContainer config={chartConfig} className="h-[300px]">
                        <BarChart data={dealStageData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                          <YAxis />
                          <ChartTooltip content={<ChartTooltipContent />} />
                          <Bar dataKey="value" fill="#0088FE" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ChartContainer>
                    ) : (
                      <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                        No deal data available
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>DD Projects by Status</CardTitle>
                    <CardDescription>Current status of due diligence projects</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {ddStatusData.length > 0 ? (
                      <ChartContainer config={chartConfig} className="h-[300px]">
                        <PieChart>
                          <Pie
                            data={ddStatusData}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                            outerRadius={100}
                            fill="#8884d8"
                            dataKey="value"
                          >
                            {ddStatusData.map((_, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <ChartTooltip content={<ChartTooltipContent />} />
                        </PieChart>
                      </ChartContainer>
                    ) : (
                      <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                        No project data available
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Cross-Module Integration</CardTitle>
                  <CardDescription>How modules are connected across the platform</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-4">
                    <div className="text-center p-4 bg-muted rounded-lg">
                      <div className="text-2xl font-bold">{data?.crossModule.dealsWithDDProjects || 0}</div>
                      <div className="text-sm text-muted-foreground">Deals with DD Projects</div>
                    </div>
                    <div className="text-center p-4 bg-muted rounded-lg">
                      <div className="text-2xl font-bold">{data?.crossModule.dealsWithModelingProjects || 0}</div>
                      <div className="text-sm text-muted-foreground">Deals with Modeling</div>
                    </div>
                    <div className="text-center p-4 bg-muted rounded-lg">
                      <div className="text-2xl font-bold">{data?.crossModule.contactsWithDeals || 0}</div>
                      <div className="text-sm text-muted-foreground">Contacts with Deals</div>
                    </div>
                    <div className="text-center p-4 bg-muted rounded-lg">
                      <div className="text-2xl font-bold">{data?.crossModule.propertiesWithDeals || 0}</div>
                      <div className="text-sm text-muted-foreground">Properties with Deals</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="crm" className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <KpiCard title="Total Deals" value={data?.crm.totalDeals || 0} icon={DollarSign} />
                <KpiCard 
                  title="Pipeline Value" 
                  value={formatCurrency(data?.crm.pipelineValue || 0)} 
                  icon={TrendingUp} 
                />
                <KpiCard 
                  title="Conversion Rate" 
                  value={formatPercent(data?.crm.conversionRate || 0)} 
                  icon={Target}
                  variant={data?.crm.conversionRate && data.crm.conversionRate > 50 ? 'success' : 'warning'}
                />
                <KpiCard 
                  title="Recent Deals" 
                  value={data?.crm.recentDeals || 0} 
                  subtitle={`in last ${period}`}
                  icon={Clock} 
                />
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <KpiCard title="Contacts" value={data?.crm.totalContacts || 0} icon={Users} />
                <KpiCard title="Companies" value={data?.crm.totalCompanies || 0} icon={Building2} />
                <KpiCard title="Properties" value={data?.crm.totalProperties || 0} icon={Building2} />
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Deal Pipeline</CardTitle>
                </CardHeader>
                <CardContent>
                  {dealStageData.length > 0 ? (
                    <ChartContainer config={chartConfig} className="h-[350px]">
                      <BarChart data={dealStageData} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" />
                        <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 12 }} />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Bar dataKey="value" fill="#0088FE" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ChartContainer>
                  ) : (
                    <div className="h-[350px] flex items-center justify-center text-muted-foreground">
                      No pipeline data available
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="dd" className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <KpiCard 
                  title="Total Projects" 
                  value={data?.dueDiligence.totalProjects || 0} 
                  icon={FileCheck} 
                />
                <KpiCard 
                  title="Active Projects" 
                  value={data?.dueDiligence.activeProjects || 0} 
                  icon={Clock}
                  variant="default"
                />
                <KpiCard 
                  title="Completed" 
                  value={data?.dueDiligence.completedProjects || 0} 
                  icon={CheckCircle2}
                  variant="success"
                />
                <KpiCard 
                  title="Completion Rate" 
                  value={formatPercent(data?.dueDiligence.completionRate || 0)} 
                  icon={Percent}
                  variant={data?.dueDiligence.completionRate && data.dueDiligence.completionRate > 70 ? 'success' : 'warning'}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Task Status</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Total Tasks</span>
                        <span className="font-bold">{data?.dueDiligence.totalTasks || 0}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-red-500 flex items-center gap-1">
                          <AlertTriangle className="h-4 w-4" />
                          Overdue Tasks
                        </span>
                        <span className="font-bold text-red-500">{data?.dueDiligence.overdueTasks || 0}</span>
                      </div>
                      {data?.dueDiligence.totalTasks && data.dueDiligence.totalTasks > 0 && (
                        <div>
                          <div className="flex justify-between text-xs mb-1">
                            <span>On Track</span>
                            <span>
                              {Math.round(((data.dueDiligence.totalTasks - data.dueDiligence.overdueTasks) / data.dueDiligence.totalTasks) * 100)}%
                            </span>
                          </div>
                          <Progress 
                            value={((data.dueDiligence.totalTasks - data.dueDiligence.overdueTasks) / data.dueDiligence.totalTasks) * 100} 
                          />
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Projects by Status</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {ddStatusData.length > 0 ? (
                      <div className="space-y-3">
                        {ddStatusData.map((item, index) => (
                          <div key={item.name} className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div 
                                className="w-3 h-3 rounded-full" 
                                style={{ backgroundColor: COLORS[index % COLORS.length] }} 
                              />
                              <span className="text-sm capitalize">{item.name.replace('_', ' ')}</span>
                            </div>
                            <span className="font-bold">{item.value}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center text-muted-foreground py-8">
                        No project status data available
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="modeling" className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <KpiCard 
                  title="Total Projects" 
                  value={data?.modeling.totalProjects || 0} 
                  icon={Calculator} 
                />
                <KpiCard 
                  title="Recent Projects" 
                  value={data?.modeling.recentProjects || 0} 
                  subtitle={`in last ${period}`}
                  icon={Clock} 
                />
                <KpiCard 
                  title="Avg Purchase Price" 
                  value={formatCurrency(data?.modeling.avgPurchasePrice || 0)} 
                  icon={DollarSign} 
                />
                <KpiCard 
                  title="Avg Cap Rate" 
                  value={formatPercent(data?.modeling.avgCapRate || 0)} 
                  icon={Percent} 
                />
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Portfolio Summary</CardTitle>
                  <CardDescription>Aggregated modeling metrics</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="p-6 bg-muted rounded-lg text-center">
                      <div className="text-3xl font-bold text-primary">
                        {formatCurrency(data?.modeling.totalPurchaseValue || 0)}
                      </div>
                      <div className="text-sm text-muted-foreground mt-2">Total Purchase Value</div>
                    </div>
                    <div className="p-6 bg-muted rounded-lg text-center">
                      <div className="text-3xl font-bold text-primary">
                        {data?.modeling.totalProjects || 0}
                      </div>
                      <div className="text-sm text-muted-foreground mt-2">
                        Projects @ {formatPercent(data?.modeling.avgCapRate || 0)} Avg Cap
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="operations" className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <KpiCard 
                  title="Rent Rolls" 
                  value={data?.operations.totalRentRolls || 0} 
                  icon={Anchor} 
                />
                <KpiCard 
                  title="Total Units" 
                  value={data?.operations.totalUnits || 0} 
                  subtitle={`${data?.operations.occupiedUnits || 0} occupied`}
                  icon={Building2} 
                />
                <KpiCard 
                  title="Occupancy Rate" 
                  value={formatPercent(data?.operations.occupancyRate || 0)} 
                  icon={Percent}
                  variant={data?.operations.occupancyRate && data.operations.occupancyRate > 85 ? 'success' : data?.operations.occupancyRate && data.operations.occupancyRate > 70 ? 'warning' : 'danger'}
                />
                <KpiCard 
                  title="Monthly Revenue" 
                  value={formatCurrency(data?.operations.totalMonthlyRevenue || 0)} 
                  icon={DollarSign} 
                />
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Occupancy Overview</CardTitle>
                </CardHeader>
                <CardContent>
                  {data?.operations.totalUnits && data.operations.totalUnits > 0 ? (
                    <div className="space-y-4">
                      <div className="flex justify-between text-sm">
                        <span>Occupancy Rate</span>
                        <span className="font-bold">{formatPercent(data.operations.occupancyRate)}</span>
                      </div>
                      <Progress value={data.operations.occupancyRate} className="h-4" />
                      <div className="grid grid-cols-3 gap-4 text-center">
                        <div className="p-3 bg-green-100 dark:bg-green-900/20 rounded-lg">
                          <div className="text-xl font-bold text-green-600">{data.operations.occupiedUnits}</div>
                          <div className="text-xs text-muted-foreground">Occupied</div>
                        </div>
                        <div className="p-3 bg-yellow-100 dark:bg-yellow-900/20 rounded-lg">
                          <div className="text-xl font-bold text-yellow-600">
                            {data.operations.totalUnits - data.operations.occupiedUnits}
                          </div>
                          <div className="text-xs text-muted-foreground">Vacant</div>
                        </div>
                        <div className="p-3 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
                          <div className="text-xl font-bold text-blue-600">{data.operations.totalUnits}</div>
                          <div className="text-xs text-muted-foreground">Total Units</div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center text-muted-foreground py-8">
                      No operations data available
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}
