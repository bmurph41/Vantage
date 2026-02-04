import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  BarChart3, 
  TrendingUp, 
  PieChart, 
  Activity,
  DollarSign,
  Calendar,
  Download,
  Filter,
  RefreshCw,
  Building2,
  Anchor
} from 'lucide-react';
import {
  DrillDownBarChart,
  TimeSeriesDrillDown,
  HierarchicalPieChart,
  WaterfallChart,
  CHART_COLORS,
} from '@/components/analytics/InteractiveCharts';
import { formatCurrency, formatPercent } from '@/lib/utils';

export default function FinancialAnalysisDashboard() {
  const [selectedTimeframe, setSelectedTimeframe] = useState('12m');
  const [selectedProject, setSelectedProject] = useState<string>('all');
  const [activeTab, setActiveTab] = useState('overview');

  const { data: analyticsData, isLoading, refetch } = useQuery({
    queryKey: ['/api/analytics/financial', selectedTimeframe, selectedProject],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('timeframe', selectedTimeframe);
      if (selectedProject !== 'all') {
        params.set('projectId', selectedProject);
      }
      const response = await fetch(`/api/analytics/financial?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch financial analytics');
      return response.json();
    },
  });

  const projectsList = useMemo(() => {
    return analyticsData?.projects || [];
  }, [analyticsData]);

  const revenueByCategory = useMemo(() => {
    if (!analyticsData?.revenueBreakdown || analyticsData.revenueBreakdown.length === 0) {
      return [
        { name: 'No financial data yet', value: 0 },
      ];
    }
    return analyticsData.revenueBreakdown;
  }, [analyticsData]);

  const yearlyTrends = useMemo(() => {
    if (!analyticsData?.yearlyTrends || analyticsData.yearlyTrends.length === 0) {
      return [];
    }
    return analyticsData.yearlyTrends;
  }, [analyticsData]);

  const yearlyBreakdown: Record<string, any[]> = useMemo(() => {
    const breakdown: Record<string, any[]> = {};
    yearlyTrends.forEach((year: any) => {
      breakdown[year.period] = [
        { category: 'Revenue', amount: year.revenue, percentage: 100 },
        { category: 'Expenses', amount: year.expenses, percentage: year.revenue > 0 ? (year.expenses / year.revenue) * 100 : 0 },
        { category: 'NOI', amount: year.noi, percentage: year.revenue > 0 ? (year.noi / year.revenue) * 100 : 0 },
      ];
    });
    return breakdown;
  }, [yearlyTrends]);

  const expenseWaterfall = useMemo(() => {
    if (!analyticsData?.expenseWaterfall || analyticsData.expenseWaterfall.length === 0) {
      return [
        { name: 'No expense data yet', value: 0, isTotal: true },
      ];
    }
    return analyticsData.expenseWaterfall;
  }, [analyticsData]);

  const expenseBreakdownData = useMemo(() => {
    if (!analyticsData?.expenseWaterfall) return [];
    return analyticsData.expenseWaterfall
      .filter((e: any) => !e.isTotal && e.value !== 0)
      .map((e: any) => ({
        category: e.name,
        amount: Math.abs(e.value),
      }));
  }, [analyticsData]);

  const drillDownLevels = useMemo(() => {
    const revenueData = revenueByCategory.filter((r: any) => r.value > 0).map((r: any) => ({
      category: r.name,
      amount: r.value,
    }));
    
    return [{
      label: 'By Revenue Category',
      data: revenueData.length > 0 ? revenueData : [{ category: 'No data', amount: 0 }],
      dataKey: 'amount',
      nameKey: 'category',
    }];
  }, [revenueByCategory]);

  const kpis = useMemo(() => {
    const summary = analyticsData?.summary || {};
    const totalRevenue = summary.totalRevenue || 0;
    const totalNoi = summary.totalNoi || 0;
    const noiMargin = summary.noiMargin || 0;
    const totalUnits = summary.totalUnits || 0;
    const revenuePerUnit = totalUnits > 0 ? totalRevenue / totalUnits : 0;
    
    return [
      { label: 'Total Revenue', value: totalRevenue, icon: DollarSign },
      { label: 'Net Operating Income', value: totalNoi, icon: TrendingUp },
      { label: 'NOI Margin', value: noiMargin, isPercent: true, icon: Activity },
      { label: 'Total Projects', value: analyticsData?.projectCount || 0, isCount: true, icon: Building2 },
    ];
  }, [analyticsData]);

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-28" />)}
        </div>
        <Skeleton className="h-[400px]" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 bg-muted/30 min-h-screen">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-primary" />
            Financial Analysis
          </h1>
          <p className="text-muted-foreground mt-1">
            Interactive charts with drill-down capabilities for detailed financial insights
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={selectedProject} onValueChange={setSelectedProject}>
            <SelectTrigger className="w-[200px]">
              <Building2 className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Select project" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Projects ({projectsList.length})</SelectItem>
              {projectsList.map((p: any) => (
                <SelectItem key={p.id} value={String(p.id)}>{p.marinaName}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selectedTimeframe} onValueChange={setSelectedTimeframe}>
            <SelectTrigger className="w-[140px]">
              <Calendar className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="3m">Last 3 Months</SelectItem>
              <SelectItem value="6m">Last 6 Months</SelectItem>
              <SelectItem value="12m">Last 12 Months</SelectItem>
              <SelectItem value="ytd">Year to Date</SelectItem>
              <SelectItem value="all">All Time</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {kpis.map((kpi: any, index) => (
          <Card key={index}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{kpi.label}</p>
                  <p className="text-2xl font-bold mt-1">
                    {kpi.isCount ? kpi.value : kpi.isPercent ? formatPercent(kpi.value) : formatCurrency(kpi.value)}
                  </p>
                </div>
                <div className="flex flex-col items-end">
                  <kpi.icon className="h-5 w-5 text-muted-foreground mb-2" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full max-w-3xl grid-cols-5">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="projects" className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Projects
          </TabsTrigger>
          <TabsTrigger value="revenue" className="flex items-center gap-2">
            <PieChart className="h-4 w-4" />
            Revenue
          </TabsTrigger>
          <TabsTrigger value="expenses" className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Expenses
          </TabsTrigger>
          <TabsTrigger value="trends" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Trends
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {projectsList.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">No Modeling Projects Yet</p>
                <p className="text-sm mt-2">Create a modeling project in the Valuator to start seeing financial analytics.</p>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4">
                <DrillDownBarChart
                  title="Revenue by Category"
                  description="Click bars to drill down into sub-categories"
                  levels={drillDownLevels}
                  height={350}
                />
                <HierarchicalPieChart
                  title="Income Distribution"
                  description="Click segments to explore revenue breakdown"
                  data={revenueByCategory}
                  height={350}
                />
              </div>
              <WaterfallChart
                title="Revenue to NOI Waterfall"
                description="Click expense items to see detailed breakdowns"
                data={expenseWaterfall}
                height={350}
              />
            </>
          )}
        </TabsContent>

        <TabsContent value="projects" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Valuator Projects ({projectsList.length})
              </CardTitle>
              <CardDescription>All modeling projects with their key financial metrics</CardDescription>
            </CardHeader>
            <CardContent>
              {projectsList.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">
                  <Anchor className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No modeling projects found.</p>
                  <p className="text-sm mt-2">Create a new project in the Valuator to get started.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-2 font-medium">Marina Name</th>
                        <th className="text-left py-3 px-2 font-medium">State</th>
                        <th className="text-right py-3 px-2 font-medium">Purchase Price</th>
                        <th className="text-right py-3 px-2 font-medium">Revenue</th>
                        <th className="text-right py-3 px-2 font-medium">NOI</th>
                        <th className="text-right py-3 px-2 font-medium">Cap Rate</th>
                        <th className="text-right py-3 px-2 font-medium">Units</th>
                        <th className="text-center py-3 px-2 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {projectsList.map((project: any) => (
                        <tr key={project.id} className="border-b hover:bg-muted/50">
                          <td className="py-3 px-2 font-medium">{project.marinaName}</td>
                          <td className="py-3 px-2">{project.state || '-'}</td>
                          <td className="py-3 px-2 text-right tabular-nums">
                            {project.purchasePrice ? formatCurrency(project.purchasePrice) : '-'}
                          </td>
                          <td className="py-3 px-2 text-right tabular-nums">
                            {project.latestRevenue ? formatCurrency(project.latestRevenue) : '-'}
                          </td>
                          <td className="py-3 px-2 text-right tabular-nums">
                            {project.latestNoi ? formatCurrency(project.latestNoi) : '-'}
                          </td>
                          <td className="py-3 px-2 text-right tabular-nums">
                            {project.capRate ? `${(project.capRate * 100).toFixed(2)}%` : '-'}
                          </td>
                          <td className="py-3 px-2 text-right tabular-nums">
                            {project.totalUnits || '-'}
                          </td>
                          <td className="py-3 px-2 text-center">
                            <Badge variant={project.dealOutcome === 'active' ? 'default' : 'secondary'}>
                              {project.dealOutcome}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="revenue" className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <HierarchicalPieChart
              title="Revenue Breakdown"
              description="Hierarchical view - click to drill into categories"
              data={revenueByCategory}
              height={400}
            />
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Revenue KPIs</CardTitle>
                <CardDescription>Key revenue metrics from modeling projects</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {revenueByCategory.filter((r: any) => r.value > 0).length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <DollarSign className="h-10 w-10 mx-auto mb-3 opacity-50" />
                    <p>No revenue data available yet.</p>
                    <p className="text-sm mt-1">Add financial periods to your modeling projects to see revenue metrics.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4">
                    {revenueByCategory.filter((r: any) => r.value > 0).slice(0, 4).map((metric: any, i: number) => {
                      return (
                        <div key={i} className="border rounded-lg p-4">
                          <p className="text-sm text-muted-foreground">{metric.name}</p>
                          <p className="text-xl font-bold mt-1">{formatCurrency(metric.value)}</p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
          <DrillDownBarChart
            title="Revenue Deep Dive"
            description="Multi-level drill down from category to individual line items"
            levels={drillDownLevels}
            height={400}
          />
        </TabsContent>

        <TabsContent value="expenses" className="space-y-4">
          <WaterfallChart
            title="Expense Breakdown - From Gross Revenue to NOI"
            description="Visual walkthrough of all expense categories - click for details"
            data={expenseWaterfall}
            height={400}
          />
          <div className="grid grid-cols-2 gap-4">
            <DrillDownBarChart
              title="Operating Expenses by Category"
              description="Expense breakdown from modeling projects"
              levels={[
                {
                  label: 'By Category',
                  data: expenseBreakdownData.length > 0 ? expenseBreakdownData : [{ category: 'No data', amount: 0 }],
                  dataKey: 'amount',
                  nameKey: 'category',
                },
              ]}
              height={300}
            />
            <HierarchicalPieChart
              title="Expense Distribution"
              description="Click to explore expense categories"
              data={expenseBreakdownData.length > 0 
                ? expenseBreakdownData.map((e: any) => ({ name: e.category, value: e.amount }))
                : [{ name: 'No data', value: 0 }]
              }
              height={300}
            />
          </div>
        </TabsContent>

        <TabsContent value="trends" className="space-y-4">
          {yearlyTrends.length > 0 ? (
            <TimeSeriesDrillDown
              title="Yearly Revenue, Expenses & NOI Trends"
              description="Click on any data point to see detailed breakdown for that year"
              data={yearlyTrends}
              metrics={[
                { key: 'revenue', label: 'Revenue', color: CHART_COLORS[0] },
                { key: 'expenses', label: 'Expenses', color: CHART_COLORS[4] },
                { key: 'noi', label: 'NOI', color: CHART_COLORS[1] },
              ]}
              height={400}
              drillDownData={yearlyBreakdown}
            />
          ) : (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No historical trend data available yet.</p>
                <p className="text-sm mt-2">Add financial periods to your modeling projects to see trends.</p>
              </CardContent>
            </Card>
          )}
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Project Summary</CardTitle>
                <CardDescription>Financial summary across all projects</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {analyticsData?.summary ? (
                    <>
                      <div className="flex items-center justify-between py-2 border-b">
                        <span className="text-sm">Total Revenue</span>
                        <span className="font-medium">{formatCurrency(analyticsData.summary.totalRevenue)}</span>
                      </div>
                      <div className="flex items-center justify-between py-2 border-b">
                        <span className="text-sm">Total Expenses</span>
                        <span className="font-medium">{formatCurrency(analyticsData.summary.totalExpenses)}</span>
                      </div>
                      <div className="flex items-center justify-between py-2 border-b">
                        <span className="text-sm">Net Operating Income</span>
                        <span className="font-medium">{formatCurrency(analyticsData.summary.totalNoi)}</span>
                      </div>
                      <div className="flex items-center justify-between py-2">
                        <span className="text-sm">NOI Margin</span>
                        <span className="font-medium">{formatPercent(analyticsData.summary.noiMargin)}</span>
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">No summary data available</p>
                  )}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Portfolio Overview</CardTitle>
                <CardDescription>Key metrics across modeling projects</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between py-2 border-b">
                    <span className="text-sm">Total Projects</span>
                    <span className="font-medium">{analyticsData?.projectCount || 0}</span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b">
                    <span className="text-sm">Total Storage Units</span>
                    <span className="font-medium">{analyticsData?.summary?.totalUnits || 0}</span>
                  </div>
                  {analyticsData?.summary?.avgCapRate && (
                    <div className="flex items-center justify-between py-2 border-b">
                      <span className="text-sm">Average Cap Rate</span>
                      <span className="font-medium">{(analyticsData.summary.avgCapRate * 100).toFixed(2)}%</span>
                    </div>
                  )}
                  {analyticsData?.summary?.avgOccupancy && (
                    <div className="flex items-center justify-between py-2">
                      <span className="text-sm">Average Occupancy</span>
                      <span className="font-medium">{analyticsData.summary.avgOccupancy.toFixed(1)}%</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
