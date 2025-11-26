import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { apiRequest } from "@/lib/queryClient";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ComposedChart, Area, PieChart, Pie, Cell
} from "recharts";
import {
  TrendingUp, TrendingDown, DollarSign, BarChart3, Building2,
  RefreshCw, Repeat, Users, Lightbulb, ChevronRight
} from "lucide-react";
import TrendsFiltersPanel, { type TrendsFilters } from "./TrendsFiltersPanel";

interface YearlyTrendData {
  year: number;
  transactionCount: number;
  totalVolume: number;
  avgPrice: number;
  medianPrice: number;
  avgPricePerSlip: number;
  medianPricePerSlip: number;
  avgCapRate: number;
  avgCapacity: number;
}

interface QuarterlyTrendData {
  year: number;
  quarter: number;
  label: string;
  transactionCount: number;
  totalVolume: number;
  avgPrice: number;
  avgPricePerSlip: number;
}

interface RegionalTrendData {
  region: string;
  transactionCount: number;
  totalVolume: number;
  avgPrice: number;
  marketShare: number;
}

interface RepeatSale {
  propertyName: string;
  city: string | null;
  state: string | null;
  sales: Array<{
    saleYear: number;
    saleMonth: number | null;
    salePrice: number;
    pricePerSlip: number | null;
  }>;
  priceAppreciation: number;
  annualizedReturn: number;
  holdingPeriodYears: number;
}

interface MarketTrendsData {
  summary: {
    totalTransactions: number;
    totalVolume: number;
    earliestYear: number;
    latestYear: number;
    avgAnnualGrowth: number;
    volumeCAGR: number;
  };
  yearlyTrends: YearlyTrendData[];
  quarterlyTrends: QuarterlyTrendData[];
  regionalBreakdown: RegionalTrendData[];
  repeatSales: RepeatSale[];
  topBrokers: Array<{
    name: string;
    dealCount: number;
    totalVolume: number;
    marketShare: number;
  }>;
  insights: string[];
}

const CHART_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16"];

function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(Number(value))) return 'N/A';
  const numValue = Number(value);
  if (numValue >= 1000000000) return `$${(numValue / 1000000000).toFixed(2)}B`;
  if (numValue >= 1000000) return `$${(numValue / 1000000).toFixed(2)}M`;
  if (numValue >= 1000) return `$${(numValue / 1000).toFixed(1)}K`;
  return `$${Math.round(numValue).toLocaleString()}`;
}

function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(Number(value))) return 'N/A';
  return `${Number(value).toFixed(2)}%`;
}

export default function TrendsView() {
  const [filters, setFilters] = useState<TrendsFilters>({});
  const [activeTab, setActiveTab] = useState("overview");

  const { data: trendsData, isLoading, refetch, isFetching } = useQuery<MarketTrendsData>({
    queryKey: ["/api/sales-comps/analytics/trends", filters],
    queryFn: async () => {
      const res = await apiRequest("POST", "/api/sales-comps/analytics/trends", filters);
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-40" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32" />)}
        </div>
        <Skeleton className="h-80" />
      </div>
    );
  }

  if (!trendsData) {
    return (
      <Card className="p-8 text-center">
        <BarChart3 className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
        <h3 className="text-lg font-semibold mb-2">No Trends Data Available</h3>
        <p className="text-sm text-muted-foreground">
          Add sales comps to see market trends and analysis.
        </p>
      </Card>
    );
  }

  const { summary, yearlyTrends, quarterlyTrends, regionalBreakdown, repeatSales, topBrokers, insights } = trendsData;

  const activeFilterCount = [
    filters.yearMin || filters.yearMax ? 1 : 0,
    filters.regions?.length || 0,
    filters.states?.length || 0,
    filters.wetSlipsMin || filters.wetSlipsMax ? 1 : 0,
    filters.dryRacksMin || filters.dryRacksMax ? 1 : 0,
    filters.profitCenters?.length || 0,
  ].reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <TrendingUp className="h-6 w-6 text-primary" />
            Market Trends
            {activeFilterCount > 0 && (
              <Badge variant="secondary" className="ml-2 text-xs">
                {activeFilterCount} filter{activeFilterCount > 1 ? 's' : ''} applied
              </Badge>
            )}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Historical analysis of marina sales activity and pricing
          </p>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => refetch()} 
          disabled={isFetching}
          data-testid="button-refresh-trends"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Filters Panel */}
      <TrendsFiltersPanel 
        filters={filters} 
        onFiltersChange={setFilters} 
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card data-testid="card-total-transactions">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Total Transactions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.totalTransactions.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              {summary.earliestYear} - {summary.latestYear}
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-total-volume">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Total Volume
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(summary.totalVolume)}</div>
            <p className="text-xs text-muted-foreground">
              Aggregate transaction value
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-price-growth">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              {summary.avgAnnualGrowth >= 0 ? (
                <TrendingUp className="h-4 w-4 text-green-500" />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-500" />
              )}
              Avg Price Growth
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${summary.avgAnnualGrowth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {summary.avgAnnualGrowth >= 0 ? '+' : ''}{formatPercent(summary.avgAnnualGrowth)}
            </div>
            <p className="text-xs text-muted-foreground">
              Year-over-year average
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-volume-cagr">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Volume CAGR
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${summary.volumeCAGR >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {summary.volumeCAGR >= 0 ? '+' : ''}{formatPercent(summary.volumeCAGR)}
            </div>
            <p className="text-xs text-muted-foreground">
              Compound annual growth
            </p>
          </CardContent>
        </Card>
      </div>

      {/* AI Insights */}
      {insights && insights.length > 0 && (
        <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950 border-blue-200 dark:border-blue-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-amber-500" />
              Market Insights
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {insights.map((insight, idx) => (
                <li key={idx} className="flex items-start gap-2 text-sm">
                  <ChevronRight className="h-4 w-4 mt-0.5 text-primary flex-shrink-0" />
                  <span>{insight}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-4 w-full max-w-md">
          <TabsTrigger value="overview">Volume & Price</TabsTrigger>
          <TabsTrigger value="regional">Regional</TabsTrigger>
          <TabsTrigger value="repeat">Repeat Sales</TabsTrigger>
          <TabsTrigger value="brokers">Top Brokers</TabsTrigger>
        </TabsList>

        {/* Volume & Price Trends Tab */}
        <TabsContent value="overview" className="space-y-6 mt-6">
          {/* Transaction Volume Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Transaction Volume by Year</CardTitle>
              <CardDescription>Number of marina sales recorded per year</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={yearlyTrends}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="year" className="text-xs" />
                    <YAxis className="text-xs" />
                    <Tooltip 
                      contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))' }}
                      formatter={(value: number) => [value.toLocaleString(), 'Transactions']}
                    />
                    <Bar dataKey="transactionCount" fill="#3b82f6" name="Transactions" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Price Trends Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Price Trends Over Time</CardTitle>
              <CardDescription>Average and median sale prices by year</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={yearlyTrends}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="year" className="text-xs" />
                    <YAxis 
                      className="text-xs" 
                      tickFormatter={(value) => `$${(value / 1000000).toFixed(1)}M`}
                    />
                    <Tooltip 
                      contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))' }}
                      formatter={(value: number, name: string) => [formatCurrency(value), name]}
                    />
                    <Legend />
                    <Area 
                      type="monotone" 
                      dataKey="avgPrice" 
                      fill="#3b82f6" 
                      fillOpacity={0.1}
                      stroke="#3b82f6" 
                      name="Avg Price"
                    />
                    <Line 
                      type="monotone" 
                      dataKey="medianPrice" 
                      stroke="#10b981" 
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      name="Median Price"
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Price Per Slip Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Price Per Slip Trends</CardTitle>
              <CardDescription>Average and median price per slip by year</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={yearlyTrends}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="year" className="text-xs" />
                    <YAxis 
                      className="text-xs" 
                      tickFormatter={(value) => `$${(value / 1000).toFixed(0)}K`}
                    />
                    <Tooltip 
                      contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))' }}
                      formatter={(value: number, name: string) => [formatCurrency(value), name]}
                    />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey="avgPricePerSlip" 
                      stroke="#f59e0b" 
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      name="Avg $/Slip"
                    />
                    <Line 
                      type="monotone" 
                      dataKey="medianPricePerSlip" 
                      stroke="#8b5cf6" 
                      strokeWidth={2}
                      strokeDasharray="5 5"
                      dot={{ r: 3 }}
                      name="Median $/Slip"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Regional Breakdown Tab */}
        <TabsContent value="regional" className="space-y-6 mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Regional Pie Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Market Share by Region</CardTitle>
                <CardDescription>Percentage of total transaction volume</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={regionalBreakdown.slice(0, 8)}
                        dataKey="marketShare"
                        nameKey="region"
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        labelLine={false}
                      >
                        {regionalBreakdown.slice(0, 8).map((_, idx) => (
                          <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))' }}
                        formatter={(value: number) => [`${value.toFixed(1)}%`, 'Market Share']}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Regional Table */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Regional Statistics</CardTitle>
                <CardDescription>Transaction volume and pricing by region</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="max-h-[300px] overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Region</TableHead>
                        <TableHead className="text-right">Deals</TableHead>
                        <TableHead className="text-right">Volume</TableHead>
                        <TableHead className="text-right">Avg Price</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {regionalBreakdown.map((region, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="font-medium">{region.region}</TableCell>
                          <TableCell className="text-right">{region.transactionCount}</TableCell>
                          <TableCell className="text-right">{formatCurrency(region.totalVolume)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(region.avgPrice)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Repeat Sales Tab */}
        <TabsContent value="repeat" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Repeat className="h-5 w-5" />
                Repeat Sales Analysis
              </CardTitle>
              <CardDescription>
                Properties that have sold multiple times, showing price appreciation
              </CardDescription>
            </CardHeader>
            <CardContent>
              {repeatSales.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Repeat className="h-10 w-10 mx-auto mb-3 opacity-50" />
                  <p>No repeat sales found in the selected time period.</p>
                </div>
              ) : (
                <div className="max-h-[500px] overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[200px]">Property</TableHead>
                        <TableHead className="min-w-[120px]">Location</TableHead>
                        <TableHead className="text-right">Sales</TableHead>
                        <TableHead className="text-right">First Sale</TableHead>
                        <TableHead className="text-right">Last Sale</TableHead>
                        <TableHead className="text-right">Appreciation</TableHead>
                        <TableHead className="text-right">Annual Return</TableHead>
                        <TableHead className="text-right">Hold Period</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {repeatSales.map((sale, idx) => {
                        const firstSale = sale.sales[0];
                        const lastSale = sale.sales[sale.sales.length - 1];
                        return (
                          <TableRow key={idx}>
                            <TableCell className="font-medium">{sale.propertyName}</TableCell>
                            <TableCell>
                              {sale.city && sale.state ? `${sale.city}, ${sale.state}` : sale.state || '-'}
                            </TableCell>
                            <TableCell className="text-right">
                              <Badge variant="secondary">{sale.sales.length}</Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="text-sm">{formatCurrency(firstSale.salePrice)}</div>
                              <div className="text-xs text-muted-foreground">{firstSale.saleYear}</div>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="text-sm">{formatCurrency(lastSale.salePrice)}</div>
                              <div className="text-xs text-muted-foreground">{lastSale.saleYear}</div>
                            </TableCell>
                            <TableCell className="text-right">
                              <span className={sale.priceAppreciation >= 0 ? 'text-green-600' : 'text-red-600'}>
                                {sale.priceAppreciation >= 0 ? '+' : ''}{formatPercent(sale.priceAppreciation)}
                              </span>
                            </TableCell>
                            <TableCell className="text-right">
                              <span className={sale.annualizedReturn >= 0 ? 'text-green-600' : 'text-red-600'}>
                                {sale.annualizedReturn >= 0 ? '+' : ''}{formatPercent(sale.annualizedReturn)}
                              </span>
                            </TableCell>
                            <TableCell className="text-right">
                              {sale.holdingPeriodYears} {sale.holdingPeriodYears === 1 ? 'year' : 'years'}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Top Brokers Tab */}
        <TabsContent value="brokers" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="h-5 w-5" />
                Top Brokers by Volume
              </CardTitle>
              <CardDescription>
                Leading brokerages by total transaction volume
              </CardDescription>
            </CardHeader>
            <CardContent>
              {topBrokers.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="h-10 w-10 mx-auto mb-3 opacity-50" />
                  <p>No broker data available.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Broker Bar Chart */}
                  <div className="h-[250px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart 
                        data={topBrokers.slice(0, 10)} 
                        layout="vertical"
                        margin={{ left: 120 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis 
                          type="number" 
                          className="text-xs"
                          tickFormatter={(value) => `$${(value / 1000000).toFixed(0)}M`}
                        />
                        <YAxis 
                          type="category" 
                          dataKey="name" 
                          className="text-xs"
                          width={110}
                          tick={{ fontSize: 11 }}
                        />
                        <Tooltip 
                          contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))' }}
                          formatter={(value: number) => [formatCurrency(value), 'Total Volume']}
                        />
                        <Bar dataKey="totalVolume" fill="#10b981" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Broker Table */}
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Rank</TableHead>
                        <TableHead>Brokerage</TableHead>
                        <TableHead className="text-right">Deals</TableHead>
                        <TableHead className="text-right">Total Volume</TableHead>
                        <TableHead className="text-right">Market Share</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {topBrokers.map((broker, idx) => (
                        <TableRow key={idx}>
                          <TableCell>
                            <Badge variant={idx < 3 ? "default" : "secondary"}>#{idx + 1}</Badge>
                          </TableCell>
                          <TableCell className="font-medium">{broker.name}</TableCell>
                          <TableCell className="text-right">{broker.dealCount}</TableCell>
                          <TableCell className="text-right">{formatCurrency(broker.totalVolume)}</TableCell>
                          <TableCell className="text-right">{formatPercent(broker.marketShare)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
