import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useParams } from 'wouter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { 
  TrendingUp, 
  TrendingDown, 
  Anchor, 
  Fuel,
  Store,
  Wrench,
  Ship,
  Users,
  DollarSign,
  BarChart3,
  PieChart,
  RefreshCw,
  Download,
  Settings2,
  ChevronUp,
  ChevronDown
} from 'lucide-react';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { cn, formatCurrency, formatPercent } from '@/lib/utils';

interface ProfitCenterSummary {
  name: string;
  code: string;
  revenue: number;
  noi: number;
  margin: number;
  pctOfTotal: number;
}

interface YearData {
  year: number;
  totalRevenue: number;
  totalCogs: number;
  grossProfit: number;
  grossMargin: number;
  operatingExpenses: number;
  netOperatingIncome: number;
  netMargin: number;
}

interface ProfitCenterAnalysis {
  name: string;
  code: string;
  years: YearData[];
  kpis: Record<string, number | string>;
  benchmarks: {
    metric: string;
    actual: number;
    benchmark: number;
    variance: number;
    status: 'above' | 'below' | 'at';
  }[];
}

interface MarinaFinancialModel {
  projectId: string;
  analysisDate: string;
  holdPeriod: number;
  profitCenters: ProfitCenterAnalysis[];
  consolidatedStatement: {
    years: YearData[];
    revenueByProfitCenter: Record<string, number[]>;
    noiByCenterYear: Record<string, number[]>;
  };
  valuationMetrics: {
    totalNOI: number[];
    impliedValue: number;
    capRate: number;
    revenueMultiple: number;
    noiGrowthRate: number;
  };
}

const profitCenterIcons: Record<string, any> = {
  SLIP: Anchor,
  DRY: Ship,
  FUEL: Fuel,
  STORE: Store,
  SERVICE: Wrench,
  RENTAL: Users,
};

const profitCenterColors: Record<string, string> = {
  SLIP: 'bg-blue-500',
  DRY: 'bg-cyan-500',
  FUEL: 'bg-orange-500',
  STORE: 'bg-purple-500',
  SERVICE: 'bg-green-500',
  RENTAL: 'bg-pink-500',
};

export default function ProfitCentersPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [selectedYear, setSelectedYear] = useState(0);
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedCenter, setSelectedCenter] = useState<string | null>(null);

  const { data: financialModel, isLoading, refetch } = useQuery<MarinaFinancialModel>({
    queryKey: ['/api/modeling/projects', projectId, 'profit-centers'],
    enabled: !!projectId,
  });

  const formatCompactCurrency = (value: number) => {
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(1)}M`;
    }
    if (value >= 1000) {
      return `$${(value / 1000).toFixed(0)}K`;
    }
    return formatCurrency(value);
  };

  if (isLoading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-6 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  const consolidated = financialModel?.consolidatedStatement;
  const profitCenters = financialModel?.profitCenters || [];
  const years = consolidated?.years || [];
  const currentYearData = years[selectedYear];
  const valuation = financialModel?.valuationMetrics;

  const revenueBreakdown = profitCenters.map(pc => ({
    name: pc.name,
    code: pc.code,
    revenue: pc.years[selectedYear]?.totalRevenue || 0,
    noi: pc.years[selectedYear]?.netOperatingIncome || 0,
    margin: pc.years[selectedYear]?.netMargin || 0,
  }));

  const totalRevenue = revenueBreakdown.reduce((sum, pc) => sum + pc.revenue, 0);

  return (
    <div className="space-y-6 p-6" data-testid="profit-centers-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Marina Profit Centers</h1>
          <p className="text-muted-foreground">
            Multi-revenue stream financial analysis across 6 profit centers
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select 
            value={selectedYear.toString()} 
            onValueChange={(v) => setSelectedYear(parseInt(v))}
          >
            <SelectTrigger className="w-32" data-testid="year-select">
              <SelectValue placeholder="Year" />
            </SelectTrigger>
            <SelectContent>
              {years.map((y, idx) => (
                <SelectItem key={idx} value={idx.toString()}>
                  Year {idx + 1} ({y.year})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button 
            variant="outline" 
            size="icon"
            onClick={() => refetch()}
            data-testid="refresh-btn"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button variant="outline" data-testid="export-btn">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Profit Center Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {revenueBreakdown.map((pc) => {
          const Icon = profitCenterIcons[pc.code] || DollarSign;
          const colorClass = profitCenterColors[pc.code] || 'bg-gray-500';
          const pctOfTotal = totalRevenue > 0 ? (pc.revenue / totalRevenue) * 100 : 0;
          
          return (
            <Card 
              key={pc.code}
              className={cn(
                "cursor-pointer transition-all hover:shadow-md",
                selectedCenter === pc.code && "ring-2 ring-primary"
              )}
              onClick={() => setSelectedCenter(selectedCenter === pc.code ? null : pc.code)}
              data-testid={`card-profit-center-${pc.code.toLowerCase()}`}
            >
              <CardContent className="pt-4">
                <div className="flex items-center justify-between mb-2">
                  <div className={cn("p-2 rounded-lg", colorClass, "bg-opacity-20")}>
                    <Icon className={cn("h-5 w-5", colorClass.replace('bg-', 'text-'))} />
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {pctOfTotal.toFixed(0)}%
                  </Badge>
                </div>
                <p className="text-sm font-medium truncate">{pc.name}</p>
                <p className="text-lg font-bold">{formatCompactCurrency(pc.revenue)}</p>
                <div className="flex items-center gap-1 mt-1">
                  <span className="text-xs text-muted-foreground">NOI:</span>
                  <span className={cn(
                    "text-xs font-medium",
                    pc.noi >= 0 ? "text-green-600" : "text-red-600"
                  )}>
                    {formatCompactCurrency(pc.noi)}
                  </span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card data-testid="card-total-revenue">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Revenue</p>
                <p className="text-2xl font-bold">{formatCurrency(currentYearData?.totalRevenue || 0)}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-600 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-total-noi">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Net Operating Income</p>
                <p className="text-2xl font-bold text-green-600">
                  {formatCurrency(currentYearData?.netOperatingIncome || 0)}
                </p>
              </div>
              <DollarSign className="h-8 w-8 text-green-600 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-implied-value">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Implied Value</p>
                <p className="text-2xl font-bold">
                  {formatCurrency(valuation?.impliedValue || 0)}
                </p>
              </div>
              <BarChart3 className="h-8 w-8 text-blue-600 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-noi-margin">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">NOI Margin</p>
                <p className="text-2xl font-bold">
                  {formatPercent((currentYearData?.netMargin || 0) * 100)}
                </p>
              </div>
              <PieChart className="h-8 w-8 text-purple-600 opacity-50" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
          <TabsTrigger value="breakdown" data-testid="tab-breakdown">Revenue Breakdown</TabsTrigger>
          <TabsTrigger value="projections" data-testid="tab-projections">Multi-Year Projections</TabsTrigger>
          <TabsTrigger value="benchmarks" data-testid="tab-benchmarks">Industry Benchmarks</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Revenue Mix */}
            <Card>
              <CardHeader>
                <CardTitle>Revenue Mix</CardTitle>
                <CardDescription>Contribution by profit center</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {revenueBreakdown
                    .sort((a, b) => b.revenue - a.revenue)
                    .map((pc) => {
                      const pct = totalRevenue > 0 ? (pc.revenue / totalRevenue) * 100 : 0;
                      const colorClass = profitCenterColors[pc.code] || 'bg-gray-500';
                      
                      return (
                        <div key={pc.code} className="space-y-1">
                          <div className="flex justify-between text-sm">
                            <span className="font-medium">{pc.name}</span>
                            <span className="text-muted-foreground">
                              {formatCurrency(pc.revenue)} ({pct.toFixed(1)}%)
                            </span>
                          </div>
                          <Progress 
                            value={pct} 
                            className={cn("h-2", colorClass.replace('bg-', 'bg-opacity-20 '))}
                          />
                        </div>
                      );
                    })}
                </div>
              </CardContent>
            </Card>

            {/* NOI by Center */}
            <Card>
              <CardHeader>
                <CardTitle>NOI Contribution</CardTitle>
                <CardDescription>Net operating income by profit center</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {revenueBreakdown
                    .sort((a, b) => b.noi - a.noi)
                    .map((pc) => {
                      const totalNOI = revenueBreakdown.reduce((sum, p) => sum + p.noi, 0);
                      const pct = totalNOI > 0 ? (pc.noi / totalNOI) * 100 : 0;
                      const colorClass = profitCenterColors[pc.code] || 'bg-gray-500';
                      
                      return (
                        <div key={pc.code} className="space-y-1">
                          <div className="flex justify-between text-sm">
                            <span className="font-medium">{pc.name}</span>
                            <div className="text-right">
                              <span className={cn(
                                "font-medium",
                                pc.noi >= 0 ? "text-green-600" : "text-red-600"
                              )}>
                                {formatCurrency(pc.noi)}
                              </span>
                              <span className="text-muted-foreground ml-2">
                                ({formatPercent(pc.margin * 100)} margin)
                              </span>
                            </div>
                          </div>
                          <Progress 
                            value={Math.max(0, pct)} 
                            className="h-2"
                          />
                        </div>
                      );
                    })}
                </div>
              </CardContent>
            </Card>

            {/* Valuation Summary */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Valuation Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
                  <div className="text-center p-4 bg-muted/50 rounded-lg">
                    <p className="text-sm text-muted-foreground">Implied Value</p>
                    <p className="text-xl font-bold">{formatCompactCurrency(valuation?.impliedValue || 0)}</p>
                    <p className="text-xs text-muted-foreground">@ {formatPercent((valuation?.capRate || 0) * 100)} cap</p>
                  </div>
                  <div className="text-center p-4 bg-muted/50 rounded-lg">
                    <p className="text-sm text-muted-foreground">Year 1 NOI</p>
                    <p className="text-xl font-bold">{formatCompactCurrency(valuation?.totalNOI[0] || 0)}</p>
                  </div>
                  <div className="text-center p-4 bg-muted/50 rounded-lg">
                    <p className="text-sm text-muted-foreground">Exit Year NOI</p>
                    <p className="text-xl font-bold">
                      {formatCompactCurrency(valuation?.totalNOI[valuation.totalNOI.length - 1] || 0)}
                    </p>
                  </div>
                  <div className="text-center p-4 bg-muted/50 rounded-lg">
                    <p className="text-sm text-muted-foreground">NOI Growth</p>
                    <p className={cn(
                      "text-xl font-bold",
                      (valuation?.noiGrowthRate || 0) >= 0 ? "text-green-600" : "text-red-600"
                    )}>
                      {formatPercent((valuation?.noiGrowthRate || 0) * 100)}
                    </p>
                    <p className="text-xs text-muted-foreground">CAGR</p>
                  </div>
                  <div className="text-center p-4 bg-muted/50 rounded-lg">
                    <p className="text-sm text-muted-foreground">Rev Multiple</p>
                    <p className="text-xl font-bold">{(valuation?.revenueMultiple || 0).toFixed(2)}x</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Revenue Breakdown Tab */}
        <TabsContent value="breakdown" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Detailed Revenue Breakdown - Year {selectedYear + 1}</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Profit Center</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                    <TableHead className="text-right">COGS</TableHead>
                    <TableHead className="text-right">Gross Profit</TableHead>
                    <TableHead className="text-right">Gross Margin</TableHead>
                    <TableHead className="text-right">Op Expenses</TableHead>
                    <TableHead className="text-right">NOI</TableHead>
                    <TableHead className="text-right">Net Margin</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {profitCenters.map((pc) => {
                    const yearData = pc.years[selectedYear];
                    const Icon = profitCenterIcons[pc.code] || DollarSign;
                    
                    return (
                      <TableRow key={pc.code}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Icon className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">{pc.name}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">{formatCurrency(yearData?.totalRevenue || 0)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(yearData?.totalCogs || 0)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(yearData?.grossProfit || 0)}</TableCell>
                        <TableCell className="text-right">{formatPercent((yearData?.grossMargin || 0) * 100)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(yearData?.operatingExpenses || 0)}</TableCell>
                        <TableCell className="text-right font-semibold text-green-600">
                          {formatCurrency(yearData?.netOperatingIncome || 0)}
                        </TableCell>
                        <TableCell className="text-right">{formatPercent((yearData?.netMargin || 0) * 100)}</TableCell>
                      </TableRow>
                    );
                  })}
                  <TableRow className="font-bold border-t-2">
                    <TableCell>TOTAL</TableCell>
                    <TableCell className="text-right">{formatCurrency(currentYearData?.totalRevenue || 0)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(currentYearData?.totalCogs || 0)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(currentYearData?.grossProfit || 0)}</TableCell>
                    <TableCell className="text-right">{formatPercent((currentYearData?.grossMargin || 0) * 100)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(currentYearData?.operatingExpenses || 0)}</TableCell>
                    <TableCell className="text-right text-green-600">
                      {formatCurrency(currentYearData?.netOperatingIncome || 0)}
                    </TableCell>
                    <TableCell className="text-right">{formatPercent((currentYearData?.netMargin || 0) * 100)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* KPIs for selected center */}
          {selectedCenter && (
            <Card className="mt-6">
              <CardHeader>
                <CardTitle>
                  {profitCenters.find(pc => pc.code === selectedCenter)?.name} - Key Performance Indicators
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {Object.entries(profitCenters.find(pc => pc.code === selectedCenter)?.kpis || {}).map(([key, value]) => (
                    <div key={key} className="p-4 bg-muted/50 rounded-lg">
                      <p className="text-sm text-muted-foreground">{key}</p>
                      <p className="text-lg font-semibold">
                        {typeof value === 'number' ? formatCurrency(value) : value}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Multi-Year Projections Tab */}
        <TabsContent value="projections" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Multi-Year Pro Forma</CardTitle>
              <CardDescription>{financialModel?.holdPeriod}-year projection</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="w-full">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="sticky left-0 bg-background">Line Item</TableHead>
                      {years.map((y, idx) => (
                        <TableHead key={idx} className="text-right min-w-[100px]">
                          Y{idx + 1} ({y.year})
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {/* Revenue by profit center */}
                    <TableRow className="bg-muted/50 font-semibold">
                      <TableCell className="sticky left-0 bg-muted/50">REVENUE BY CENTER</TableCell>
                      {years.map((_, idx) => (
                        <TableCell key={idx} />
                      ))}
                    </TableRow>
                    {profitCenters.map((pc) => (
                      <TableRow key={pc.code}>
                        <TableCell className="sticky left-0 bg-background pl-6">{pc.name}</TableCell>
                        {pc.years.map((y, idx) => (
                          <TableCell key={idx} className="text-right">
                            {formatCurrency(y.totalRevenue)}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                    <TableRow className="font-semibold border-t">
                      <TableCell className="sticky left-0 bg-background">Total Revenue</TableCell>
                      {years.map((y, idx) => (
                        <TableCell key={idx} className="text-right">
                          {formatCurrency(y.totalRevenue)}
                        </TableCell>
                      ))}
                    </TableRow>

                    {/* Expenses */}
                    <TableRow className="bg-muted/50 font-semibold">
                      <TableCell className="sticky left-0 bg-muted/50">EXPENSES</TableCell>
                      {years.map((_, idx) => (
                        <TableCell key={idx} />
                      ))}
                    </TableRow>
                    <TableRow>
                      <TableCell className="sticky left-0 bg-background pl-6">Cost of Goods Sold</TableCell>
                      {years.map((y, idx) => (
                        <TableCell key={idx} className="text-right">
                          ({formatCurrency(y.totalCogs)})
                        </TableCell>
                      ))}
                    </TableRow>
                    <TableRow>
                      <TableCell className="sticky left-0 bg-background pl-6">Operating Expenses</TableCell>
                      {years.map((y, idx) => (
                        <TableCell key={idx} className="text-right">
                          ({formatCurrency(y.operatingExpenses)})
                        </TableCell>
                      ))}
                    </TableRow>

                    {/* NOI */}
                    <TableRow className="bg-green-50 dark:bg-green-950 font-bold text-lg">
                      <TableCell className="sticky left-0 bg-green-50 dark:bg-green-950">
                        NET OPERATING INCOME
                      </TableCell>
                      {years.map((y, idx) => (
                        <TableCell key={idx} className="text-right text-green-700 dark:text-green-400">
                          {formatCurrency(y.netOperatingIncome)}
                        </TableCell>
                      ))}
                    </TableRow>

                    {/* Margins */}
                    <TableRow className="bg-muted/30">
                      <TableCell className="sticky left-0 bg-muted/30 text-muted-foreground">Gross Margin</TableCell>
                      {years.map((y, idx) => (
                        <TableCell key={idx} className="text-right text-muted-foreground">
                          {formatPercent(y.grossMargin * 100)}
                        </TableCell>
                      ))}
                    </TableRow>
                    <TableRow className="bg-muted/30">
                      <TableCell className="sticky left-0 bg-muted/30 text-muted-foreground">Net Margin</TableCell>
                      {years.map((y, idx) => (
                        <TableCell key={idx} className="text-right text-muted-foreground">
                          {formatPercent(y.netMargin * 100)}
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableBody>
                </Table>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Benchmarks Tab */}
        <TabsContent value="benchmarks" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {profitCenters.map((pc) => {
              const Icon = profitCenterIcons[pc.code] || DollarSign;
              const colorClass = profitCenterColors[pc.code] || 'bg-gray-500';

              return (
                <Card key={pc.code}>
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <div className={cn("p-2 rounded-lg", colorClass, "bg-opacity-20")}>
                        <Icon className={cn("h-5 w-5", colorClass.replace('bg-', 'text-'))} />
                      </div>
                      <CardTitle className="text-lg">{pc.name}</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {pc.benchmarks.map((b, idx) => (
                        <div key={idx} className="space-y-1">
                          <div className="flex justify-between text-sm">
                            <span>{b.metric}</span>
                            <div className="flex items-center gap-2">
                              {b.status === 'above' && (
                                <ChevronUp className="h-4 w-4 text-green-600" />
                              )}
                              {b.status === 'below' && (
                                <ChevronDown className="h-4 w-4 text-red-600" />
                              )}
                              <Badge
                                variant={
                                  b.status === 'above'
                                    ? 'default'
                                    : b.status === 'below'
                                    ? 'destructive'
                                    : 'secondary'
                                }
                              >
                                {b.variance > 0 ? '+' : ''}
                                {b.variance.toFixed(1)}%
                              </Badge>
                            </div>
                          </div>
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>Actual: {b.actual.toFixed(1)}%</span>
                            <span>Benchmark: {b.benchmark.toFixed(1)}%</span>
                          </div>
                          <Progress
                            value={(b.actual / b.benchmark) * 100}
                            className={cn(
                              "h-2",
                              b.status === 'above'
                                ? '[&>div]:bg-green-500'
                                : b.status === 'below'
                                ? '[&>div]:bg-red-500'
                                : ''
                            )}
                          />
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
