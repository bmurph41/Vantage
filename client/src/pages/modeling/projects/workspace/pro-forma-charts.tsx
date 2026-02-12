import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Calendar,
  DollarSign,
  RefreshCw,
  Download,
  PieChart,
  Activity
} from 'lucide-react';
import {
  DrillDownBarChart,
  TimeSeriesDrillDown,
  HierarchicalPieChart,
  WaterfallChart,
  CHART_COLORS,
} from '@/components/analytics/InteractiveCharts';
import { WorkflowNavigation } from '@/components/modeling/workflow-navigation';
import { formatCurrency, formatPercent } from '@/lib/utils';
import type { ProjectConfig, ProFormaChartData } from '@/types/modeling';

interface WorkspaceProFormaChartsProps {
  projectId: string;
  onTabChange?: (tab: string) => void;
}

export default function WorkspaceProFormaCharts({ projectId, onTabChange }: WorkspaceProFormaChartsProps) {
  const [selectedYear, setSelectedYear] = useState('all');
  const [activeTab, setActiveTab] = useState('overview');
  const [viewMode, setViewMode] = useState<'annual' | 'monthly'>('annual');

  const { data: config } = useQuery<ProjectConfig>({
    queryKey: ['/api/modeling/projects', projectId, 'config'],
  });

  const { data: proFormaData, isLoading, refetch } = useQuery<ProFormaChartData>({
    queryKey: ['/api/analytics/modeling/projects', projectId, 'pro-forma-charts', selectedYear],
    queryFn: async () => {
      const response = await fetch(`/api/analytics/modeling/projects/${projectId}/pro-forma-charts?year=${selectedYear}`);
      if (!response.ok) throw new Error('Failed to fetch pro forma charts');
      return response.json();
    },
  });

  const holdPeriod = config?.holdPeriod || 5;
  const startYear = config?.startDate ? parseInt(config.startDate.split('-')[0]) : 2026;
  const years = Array.from({ length: holdPeriod }, (_, i) => startYear + i);

  const revenueData = useMemo(() => {
    if (proFormaData?.revenueByCategory) return proFormaData.revenueByCategory;
    
    return [
      { category: "Wet Slips", value: 2450000, breakdown: [
        { name: "Year 1", value: 420000 },
        { name: "Year 2", value: 450000 },
        { name: "Year 3", value: 485000 },
        { name: "Year 4", value: 520000 },
        { name: "Year 5", value: 575000 },
      ]},
      { category: "Dry Storage", value: 1125000, breakdown: [
        { name: "Year 1", value: 195000 },
        { name: "Year 2", value: 210000 },
        { name: "Year 3", value: 225000 },
        { name: "Year 4", value: 240000 },
        { name: "Year 5", value: 255000 },
      ]},
      { category: "Fuel Sales", value: 2850000, breakdown: [
        { name: "Year 1", value: 520000 },
        { name: "Year 2", value: 545000 },
        { name: "Year 3", value: 570000 },
        { name: "Year 4", value: 595000 },
        { name: "Year 5", value: 620000 },
      ]},
      { category: "Ship Store", value: 625000, breakdown: [
        { name: "Year 1", value: 110000 },
        { name: "Year 2", value: 118000 },
        { name: "Year 3", value: 126000 },
        { name: "Year 4", value: 134000 },
        { name: "Year 5", value: 137000 },
      ]},
      { category: "Ancillary", value: 450000, breakdown: [
        { name: "Year 1", value: 80000 },
        { name: "Year 2", value: 85000 },
        { name: "Year 3", value: 90000 },
        { name: "Year 4", value: 95000 },
        { name: "Year 5", value: 100000 },
      ]},
    ];
  }, [proFormaData]);

  const expenseData = useMemo(() => {
    if (proFormaData?.expensesByCategory) return proFormaData.expensesByCategory;
    
    return [
      { category: "Payroll", value: 1850000, breakdown: [
        { name: "Management", value: 520000 },
        { name: "Operations", value: 680000 },
        { name: "Maintenance", value: 380000 },
        { name: "Admin", value: 270000 },
      ]},
      { category: "Utilities", value: 425000, breakdown: [
        { name: "Electric", value: 185000 },
        { name: "Water/Sewer", value: 95000 },
        { name: "Propane/Gas", value: 85000 },
        { name: "Trash", value: 60000 },
      ]},
      { category: "Insurance", value: 285000, breakdown: [
        { name: "Property", value: 145000 },
        { name: "Liability", value: 85000 },
        { name: "Workers Comp", value: 55000 },
      ]},
      { category: "Maintenance", value: 375000, breakdown: [
        { name: "Dock Repairs", value: 165000 },
        { name: "Equipment", value: 125000 },
        { name: "Grounds", value: 85000 },
      ]},
      { category: "Admin", value: 195000, breakdown: [
        { name: "Software", value: 65000 },
        { name: "Marketing", value: 55000 },
        { name: "Professional", value: 45000 },
        { name: "Office", value: 30000 },
      ]},
    ];
  }, [proFormaData]);

  const noiWaterfallData = useMemo(() => {
    if (proFormaData?.noiWaterfall) return proFormaData.noiWaterfall;
    
    const totalRevenue = 7500000;
    const payroll = -1850000;
    const utilities = -425000;
    const insurance = -285000;
    const maintenance = -375000;
    const admin = -195000;
    const noi = totalRevenue + payroll + utilities + insurance + maintenance + admin;
    
    return [
      { name: "Total Revenue", value: totalRevenue, isTotal: false, details: [
        { label: "Wet Slips", value: 2450000 },
        { label: "Fuel Sales", value: 2850000 },
        { label: "Dry Storage", value: 1125000 },
        { label: "Other", value: 1075000 },
      ]},
      { name: "Payroll", value: payroll, details: [
        { label: "Management", value: 520000 },
        { label: "Operations", value: 680000 },
        { label: "Maintenance", value: 380000 },
        { label: "Admin", value: 270000 },
      ]},
      { name: "Utilities", value: utilities, details: [
        { label: "Electric", value: 185000 },
        { label: "Water/Sewer", value: 95000 },
        { label: "Other", value: 145000 },
      ]},
      { name: "Insurance", value: insurance, details: [
        { label: "Property", value: 145000 },
        { label: "Liability", value: 85000 },
        { label: "Workers Comp", value: 55000 },
      ]},
      { name: "Maintenance", value: maintenance, details: [
        { label: "Dock Repairs", value: 165000 },
        { label: "Equipment", value: 125000 },
        { label: "Grounds", value: 85000 },
      ]},
      { name: "Admin", value: admin, details: [
        { label: "Software", value: 65000 },
        { label: "Marketing", value: 55000 },
        { label: "Other", value: 75000 },
      ]},
      { name: "NOI", value: noi, isTotal: true },
    ];
  }, [proFormaData]);

  const revenueTrendData = useMemo(() => {
    if (proFormaData?.revenueTrend) return proFormaData.revenueTrend;
    
    return years.map((year, idx) => ({
      period: `Year ${idx + 1}`,
      value: Math.round(1325000 * Math.pow(1.04, idx)),
      breakdown: [
        { name: "Wet Slips", value: Math.round(420000 * Math.pow(1.07, idx)) },
        { name: "Fuel Sales", value: Math.round(520000 * Math.pow(1.04, idx)) },
        { name: "Dry Storage", value: Math.round(195000 * Math.pow(1.05, idx)) },
        { name: "Ship Store", value: Math.round(110000 * Math.pow(1.03, idx)) },
        { name: "Ancillary", value: Math.round(80000 * Math.pow(1.05, idx)) },
      ],
    }));
  }, [proFormaData, years]);

  const revenueMixData = useMemo(() => {
    if (proFormaData?.revenueMix) return proFormaData.revenueMix;
    
    return [
      { name: "Wet Slips", value: 2450000, children: [
        { name: "Monthly", value: 1350000 },
        { name: "Seasonal", value: 720000 },
        { name: "Transient", value: 380000 },
      ]},
      { name: "Fuel Sales", value: 2850000, children: [
        { name: "Gas", value: 1850000 },
        { name: "Diesel", value: 1000000 },
      ]},
      { name: "Dry Storage", value: 1125000, children: [
        { name: "Annual", value: 780000 },
        { name: "Monthly", value: 345000 },
      ]},
      { name: "Ship Store", value: 625000, children: [
        { name: "Parts", value: 285000 },
        { name: "Supplies", value: 195000 },
        { name: "Accessories", value: 145000 },
      ]},
      { name: "Ancillary", value: 450000, children: [
        { name: "Electric", value: 185000 },
        { name: "Water", value: 95000 },
        { name: "Other", value: 170000 },
      ]},
    ];
  }, [proFormaData]);

  const kpis = proFormaData?.kpis || {
    totalRevenue: 7500000,
    revenueGrowth: 4.2,
    totalExpenses: 3130000,
    expenseRatio: 41.7,
    noi: 4370000,
    noiMargin: 58.3,
    capRate: 6.8,
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32" />)}
        </div>
        <Skeleton className="h-[400px]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-primary" />
            Interactive Pro Forma Charts
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Drill-down visualizations for revenue, expenses, and NOI analysis
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="w-[140px]">
              <Calendar className="h-4 w-4 mr-2" />
              <SelectValue placeholder="All Years" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Years</SelectItem>
              {years.map(year => (
                <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Revenue</p>
                <p className="text-2xl font-bold">{formatCurrency(kpis.totalRevenue)}</p>
              </div>
              <div className="flex items-center text-green-600">
                <TrendingUp className="h-4 w-4" />
                <span className="ml-1 text-sm">{kpis.revenueGrowth.toFixed(1)}%</span>
              </div>
            </div>
            <Badge variant="outline" className="mt-2">{holdPeriod}-Year Total</Badge>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Expenses</p>
                <p className="text-2xl font-bold">{formatCurrency(kpis.totalExpenses)}</p>
              </div>
              <div className="text-muted-foreground">
                <span className="text-sm">{kpis.expenseRatio.toFixed(1)}%</span>
              </div>
            </div>
            <Badge variant="outline" className="mt-2">of Revenue</Badge>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Net Operating Income</p>
                <p className="text-2xl font-bold">{formatCurrency(kpis.noi)}</p>
              </div>
              <div className="flex items-center text-green-600">
                <TrendingUp className="h-4 w-4" />
                <span className="ml-1 text-sm">{kpis.noiMargin.toFixed(1)}%</span>
              </div>
            </div>
            <Badge variant="outline" className="mt-2">NOI Margin</Badge>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Exit Cap Rate</p>
                <p className="text-2xl font-bold">{kpis.capRate.toFixed(1)}%</p>
              </div>
              <Activity className="h-5 w-5 text-primary" />
            </div>
            <Badge variant="outline" className="mt-2">Assumed</Badge>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4 max-w-lg">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="revenue">Revenue</TabsTrigger>
          <TabsTrigger value="expenses">Expenses</TabsTrigger>
          <TabsTrigger value="noi">NOI Analysis</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6 mt-6">
          <WaterfallChart
            title="NOI Waterfall"
            description="Revenue to NOI breakdown - click bars for details"
            data={noiWaterfallData}
            height={400}
          />
          <div className="grid gap-6 lg:grid-cols-2">
            <DrillDownBarChart
              title="Revenue by Category"
              description="Click to drill into yearly breakdown"
              data={revenueData}
              height={350}
            />
            <DrillDownBarChart
              title="Expenses by Category"
              description="Click to drill into expense components"
              data={expenseData}
              height={350}
            />
          </div>
        </TabsContent>

        <TabsContent value="revenue" className="space-y-6 mt-6">
          <TimeSeriesDrillDown
            title="Revenue Trend by Year"
            description="Click any year to see revenue breakdown by category"
            data={revenueTrendData}
            height={400}
            valueFormatter={(val) => formatCurrency(val)}
          />
          <div className="grid gap-6 lg:grid-cols-2">
            <HierarchicalPieChart
              title="Revenue Mix"
              description="Click segments to drill into subcategories"
              data={revenueMixData}
              height={350}
              valueFormatter={(val) => formatCurrency(val)}
            />
            <DrillDownBarChart
              title="Revenue by Category (5-Year Total)"
              description="Click to see yearly progression"
              data={revenueData}
              height={350}
            />
          </div>
        </TabsContent>

        <TabsContent value="expenses" className="space-y-6 mt-6">
          <DrillDownBarChart
            title="Operating Expenses by Category"
            description="Click each category to see component breakdown"
            data={expenseData}
            height={400}
          />
          <div className="grid gap-6 lg:grid-cols-2">
            <HierarchicalPieChart
              title="Expense Distribution"
              description="Click to drill into expense details"
              data={expenseData.map(item => ({
                name: item.category,
                value: item.value,
                children: item.breakdown,
              }))}
              height={350}
              valueFormatter={(val) => formatCurrency(val)}
            />
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-primary" />
                  Expense Ratios
                </CardTitle>
                <CardDescription>Key expense metrics as % of revenue</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {expenseData.map((expense, idx) => {
                    const ratio = (expense.value / kpis.totalRevenue * 100).toFixed(1);
                    return (
                      <div key={expense.category} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-3 h-3 rounded-full" 
                            style={{ backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] }}
                          />
                          <span className="font-medium">{expense.category}</span>
                        </div>
                        <div className="text-right">
                          <p className="font-bold">{ratio}%</p>
                          <p className="text-xs text-muted-foreground">{formatCurrency(expense.value)}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="noi" className="space-y-6 mt-6">
          <WaterfallChart
            title="Detailed NOI Waterfall"
            description="From gross revenue to net operating income - click for component details"
            data={noiWaterfallData}
            height={450}
          />
          <div className="grid gap-6 lg:grid-cols-2">
            <TimeSeriesDrillDown
              title="NOI Trend by Year"
              description="Click to see revenue/expense breakdown"
              data={years.map((year, idx) => {
                const revenue = Math.round(1500000 * Math.pow(1.04, idx));
                const expenses = Math.round(626000 * Math.pow(1.025, idx));
                const noi = revenue - expenses;
                return {
                  period: `Year ${idx + 1}`,
                  value: noi,
                  breakdown: [
                    { name: "Revenue", value: revenue },
                    { name: "Expenses", value: -expenses },
                    { name: "NOI", value: noi },
                  ],
                };
              })}
              height={350}
              valueFormatter={(val) => formatCurrency(val)}
            />
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-green-600" />
                  NOI Margin Analysis
                </CardTitle>
                <CardDescription>Year-over-year NOI performance</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {years.map((year, idx) => {
                    const revenue = Math.round(1500000 * Math.pow(1.04, idx));
                    const expenses = Math.round(626000 * Math.pow(1.025, idx));
                    const noi = revenue - expenses;
                    const margin = (noi / revenue * 100);
                    const prevMargin = idx > 0 ? 
                      ((Math.round(1500000 * Math.pow(1.04, idx-1)) - Math.round(626000 * Math.pow(1.025, idx-1))) / 
                       Math.round(1500000 * Math.pow(1.04, idx-1)) * 100) : margin;
                    const change = margin - prevMargin;
                    
                    return (
                      <div key={year} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                        <div>
                          <p className="font-medium">Year {idx + 1} ({year})</p>
                          <p className="text-sm text-muted-foreground">NOI: {formatCurrency(noi)}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-lg">{margin.toFixed(1)}%</p>
                          {idx > 0 && (
                            <p className={`text-xs ${change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {change >= 0 ? '+' : ''}{change.toFixed(2)}%
                            </p>
                          )}
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
