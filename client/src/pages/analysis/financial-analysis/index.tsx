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

  const { data: projects } = useQuery({
    queryKey: ['/api/modeling-projects'],
  });

  const revenueByCategory = useMemo(() => {
    if (!analyticsData?.revenueBreakdown) {
      return [
        { name: 'Slip Rentals', value: 450000, children: [
          { name: 'Monthly', value: 280000 },
          { name: 'Seasonal', value: 120000 },
          { name: 'Transient', value: 50000 },
        ]},
        { name: 'Fuel Sales', value: 280000, children: [
          { name: 'Gas', value: 180000 },
          { name: 'Diesel', value: 100000 },
        ]},
        { name: 'Ship Store', value: 95000, children: [
          { name: 'Parts', value: 45000 },
          { name: 'Supplies', value: 30000 },
          { name: 'Accessories', value: 20000 },
        ]},
        { name: 'Service & Repair', value: 120000 },
        { name: 'Winter Storage', value: 85000 },
        { name: 'Other Income', value: 35000 },
      ];
    }
    return analyticsData.revenueBreakdown;
  }, [analyticsData]);

  const monthlyTrends = useMemo(() => {
    if (!analyticsData?.monthlyTrends) {
      return [
        { period: 'Jan', revenue: 65000, expenses: 45000, noi: 20000 },
        { period: 'Feb', revenue: 58000, expenses: 42000, noi: 16000 },
        { period: 'Mar', revenue: 72000, expenses: 48000, noi: 24000 },
        { period: 'Apr', revenue: 95000, expenses: 55000, noi: 40000 },
        { period: 'May', revenue: 125000, expenses: 62000, noi: 63000 },
        { period: 'Jun', revenue: 145000, expenses: 68000, noi: 77000 },
        { period: 'Jul', revenue: 168000, expenses: 75000, noi: 93000 },
        { period: 'Aug', revenue: 172000, expenses: 78000, noi: 94000 },
        { period: 'Sep', revenue: 135000, expenses: 65000, noi: 70000 },
        { period: 'Oct', revenue: 95000, expenses: 52000, noi: 43000 },
        { period: 'Nov', revenue: 68000, expenses: 44000, noi: 24000 },
        { period: 'Dec', revenue: 62000, expenses: 42000, noi: 20000 },
      ];
    }
    return analyticsData.monthlyTrends;
  }, [analyticsData]);

  const monthlyBreakdown: Record<string, any[]> = useMemo(() => {
    const breakdown: Record<string, any[]> = {};
    monthlyTrends.forEach((month: any) => {
      breakdown[month.period] = [
        { category: 'Slip Rentals', amount: month.revenue * 0.42, percentage: 42 },
        { category: 'Fuel Sales', amount: month.revenue * 0.26, percentage: 26 },
        { category: 'Ship Store', amount: month.revenue * 0.09, percentage: 9 },
        { category: 'Service & Repair', amount: month.revenue * 0.11, percentage: 11 },
        { category: 'Winter Storage', amount: month.revenue * 0.08, percentage: 8 },
        { category: 'Other', amount: month.revenue * 0.04, percentage: 4 },
      ];
    });
    return breakdown;
  }, [monthlyTrends]);

  const expenseWaterfall = useMemo(() => {
    if (!analyticsData?.expenseWaterfall) {
      return [
        { name: 'Gross Revenue', value: 1065000, isTotal: true },
        { name: 'Dock Master Salaries', value: -185000, details: [
          { label: 'Full-time Staff', value: 145000 },
          { label: 'Part-time Seasonal', value: 40000 },
        ]},
        { name: 'Utilities', value: -95000, details: [
          { label: 'Electric', value: 65000 },
          { label: 'Water/Sewer', value: 20000 },
          { label: 'Internet/Phone', value: 10000 },
        ]},
        { name: 'Insurance', value: -78000, details: [
          { label: 'Property', value: 45000 },
          { label: 'Liability', value: 23000 },
          { label: 'Workers Comp', value: 10000 },
        ]},
        { name: 'Maintenance', value: -125000, details: [
          { label: 'Dock Repairs', value: 65000 },
          { label: 'Equipment', value: 35000 },
          { label: 'Grounds', value: 25000 },
        ]},
        { name: 'Property Taxes', value: -62000 },
        { name: 'Admin & Office', value: -45000 },
        { name: 'Marketing', value: -18000 },
        { name: 'Net Operating Income', value: 457000, isTotal: true },
      ];
    }
    return analyticsData.expenseWaterfall;
  }, [analyticsData]);

  const occupancyBySlipSize = useMemo(() => {
    return [
      { level: 'All Marinas', slipSize: 'All Sizes', name: 'Total', value: 485, rate: 87 },
    ];
  }, []);

  const drillDownLevels = useMemo(() => [
    {
      label: 'By Category',
      data: [
        { category: 'Slip Rentals', amount: 450000, count: 245 },
        { category: 'Fuel Sales', amount: 280000, count: 8500 },
        { category: 'Ship Store', amount: 95000, count: 3200 },
        { category: 'Service', amount: 120000, count: 420 },
        { category: 'Storage', amount: 85000, count: 156 },
      ],
      dataKey: 'amount',
      nameKey: 'category',
    },
    {
      label: 'By Sub-Category',
      data: [
        { category: 'Monthly Slips', amount: 280000, parent: 'Slip Rentals' },
        { category: 'Seasonal Slips', amount: 120000, parent: 'Slip Rentals' },
        { category: 'Transient', amount: 50000, parent: 'Slip Rentals' },
        { category: 'Gas', amount: 180000, parent: 'Fuel Sales' },
        { category: 'Diesel', amount: 100000, parent: 'Fuel Sales' },
        { category: 'Parts', amount: 45000, parent: 'Ship Store' },
        { category: 'Supplies', amount: 30000, parent: 'Ship Store' },
        { category: 'Accessories', amount: 20000, parent: 'Ship Store' },
        { category: 'Mechanical', amount: 75000, parent: 'Service' },
        { category: 'Electrical', amount: 25000, parent: 'Service' },
        { category: 'Fiberglass', amount: 20000, parent: 'Service' },
        { category: 'Indoor', amount: 55000, parent: 'Storage' },
        { category: 'Outdoor', amount: 30000, parent: 'Storage' },
      ],
      dataKey: 'amount',
      nameKey: 'category',
      parentKey: 'parent',
    },
    {
      label: 'By Individual Item',
      data: [
        { category: '20ft Monthly', amount: 85000, parent: 'Monthly Slips' },
        { category: '30ft Monthly', amount: 110000, parent: 'Monthly Slips' },
        { category: '40ft Monthly', amount: 85000, parent: 'Monthly Slips' },
        { category: '20ft Seasonal', amount: 45000, parent: 'Seasonal Slips' },
        { category: '30ft Seasonal', amount: 75000, parent: 'Seasonal Slips' },
        { category: 'Regular Gas', amount: 120000, parent: 'Gas' },
        { category: 'Premium Gas', amount: 60000, parent: 'Gas' },
      ],
      dataKey: 'amount',
      nameKey: 'category',
      parentKey: 'parent',
    },
  ], []);

  const kpis = useMemo(() => [
    { label: 'Total Revenue', value: 1065000, change: 8.5, icon: DollarSign },
    { label: 'Net Operating Income', value: 457000, change: 12.3, icon: TrendingUp },
    { label: 'NOI Margin', value: 0.429, change: 3.2, isPercent: true, icon: Activity },
    { label: 'Avg. Revenue/Slip', value: 4367, change: 5.1, icon: Anchor },
  ], [analyticsData]);

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
              <SelectItem value="all">All Projects</SelectItem>
              {(projects as any[])?.map((p: any) => (
                <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
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
        {kpis.map((kpi, index) => (
          <Card key={index}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{kpi.label}</p>
                  <p className="text-2xl font-bold mt-1">
                    {kpi.isPercent ? formatPercent(kpi.value) : formatCurrency(kpi.value)}
                  </p>
                </div>
                <div className="flex flex-col items-end">
                  <kpi.icon className="h-5 w-5 text-muted-foreground mb-2" />
                  <Badge variant={kpi.change >= 0 ? 'default' : 'destructive'} className="text-xs">
                    {kpi.change >= 0 ? '+' : ''}{kpi.change}%
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full max-w-2xl grid-cols-4">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Overview
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
                <CardDescription>Key revenue metrics and comparisons</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { label: 'Total Revenue', value: 1065000, prev: 982000 },
                    { label: 'Slip Rentals', value: 450000, prev: 420000 },
                    { label: 'Fuel Sales', value: 280000, prev: 265000 },
                    { label: 'Ancillary Income', value: 335000, prev: 297000 },
                  ].map((metric, i) => {
                    const change = ((metric.value - metric.prev) / metric.prev) * 100;
                    return (
                      <div key={i} className="border rounded-lg p-4">
                        <p className="text-sm text-muted-foreground">{metric.label}</p>
                        <p className="text-xl font-bold mt-1">{formatCurrency(metric.value)}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <span className="text-xs text-muted-foreground">vs prev period:</span>
                          <Badge variant={change >= 0 ? 'default' : 'destructive'} className="text-xs">
                            {change >= 0 ? '+' : ''}{change.toFixed(1)}%
                          </Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
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
              description="Click to drill into expense details"
              levels={[
                {
                  label: 'By Department',
                  data: [
                    { category: 'Payroll', amount: 185000 },
                    { category: 'Utilities', amount: 95000 },
                    { category: 'Maintenance', amount: 125000 },
                    { category: 'Insurance', amount: 78000 },
                    { category: 'Taxes', amount: 62000 },
                    { category: 'Admin', amount: 45000 },
                    { category: 'Marketing', amount: 18000 },
                  ],
                  dataKey: 'amount',
                  nameKey: 'category',
                },
              ]}
              height={300}
            />
            <HierarchicalPieChart
              title="Expense Distribution"
              description="Click to explore expense categories"
              data={[
                { name: 'Payroll', value: 185000, children: [
                  { name: 'Full-time', value: 145000 },
                  { name: 'Part-time', value: 40000 },
                ]},
                { name: 'Maintenance', value: 125000, children: [
                  { name: 'Docks', value: 65000 },
                  { name: 'Equipment', value: 35000 },
                  { name: 'Grounds', value: 25000 },
                ]},
                { name: 'Utilities', value: 95000 },
                { name: 'Insurance', value: 78000 },
                { name: 'Taxes', value: 62000 },
                { name: 'Admin', value: 45000 },
                { name: 'Marketing', value: 18000 },
              ]}
              height={300}
            />
          </div>
        </TabsContent>

        <TabsContent value="trends" className="space-y-4">
          <TimeSeriesDrillDown
            title="Monthly Revenue, Expenses & NOI Trends"
            description="Click on any data point to see detailed breakdown for that month"
            data={monthlyTrends}
            metrics={[
              { key: 'revenue', label: 'Revenue', color: CHART_COLORS[0] },
              { key: 'expenses', label: 'Expenses', color: CHART_COLORS[4] },
              { key: 'noi', label: 'NOI', color: CHART_COLORS[1] },
            ]}
            height={400}
            drillDownData={monthlyBreakdown}
          />
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Seasonal Patterns</CardTitle>
                <CardDescription>Revenue distribution by season</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[
                    { season: 'Peak (Jun-Aug)', revenue: 485000, pct: 45.5 },
                    { season: 'Shoulder (Apr-May, Sep)', revenue: 355000, pct: 33.3 },
                    { season: 'Off-Peak (Oct-Mar)', revenue: 225000, pct: 21.2 },
                  ].map((s, i) => (
                    <div key={i} className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>{s.season}</span>
                        <span className="font-medium">{formatCurrency(s.revenue)}</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div 
                          className="h-full rounded-full" 
                          style={{ 
                            width: `${s.pct}%`,
                            backgroundColor: CHART_COLORS[i]
                          }}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground text-right">{s.pct}% of annual</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Year-over-Year Comparison</CardTitle>
                <CardDescription>Current period vs previous period</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[
                    { metric: 'Total Revenue', current: 1065000, previous: 982000 },
                    { metric: 'Operating Expenses', current: 608000, previous: 589000 },
                    { metric: 'Net Operating Income', current: 457000, previous: 393000 },
                    { metric: 'NOI Margin', current: 0.429, previous: 0.400, isPercent: true },
                  ].map((item, i) => {
                    const change = item.isPercent 
                      ? (item.current - item.previous) * 100
                      : ((item.current - item.previous) / item.previous) * 100;
                    return (
                      <div key={i} className="flex items-center justify-between py-2 border-b last:border-0">
                        <span className="text-sm">{item.metric}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-medium">
                            {item.isPercent ? formatPercent(item.current) : formatCurrency(item.current)}
                          </span>
                          <Badge variant={change >= 0 ? 'default' : 'destructive'} className="text-xs">
                            {change >= 0 ? '+' : ''}{change.toFixed(1)}%
                          </Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
