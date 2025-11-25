import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import type { TransactionsResponse } from "@/types/fuel-api";
import { getBusinessDay, formatBusinessDay } from "@/lib/fuel-utils";
import { AssetSelector } from "@/components/AssetSelector";
import { 
  BarChart3, 
  TrendingUp, 
  TrendingDown,
  DollarSign, 
  Fuel,
  Calendar,
  Target
} from "lucide-react";

export default function Analytics() {
  const [timeRange, setTimeRange] = useState("30");
  const [metricType, setMetricType] = useState("revenue");
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);

  const transactionsKey = selectedAssetId
    ? ['/api/operations/fuel-sales', selectedAssetId]
    : ['/api/operations/fuel-sales'];

  const { data: transactions = [], isLoading } = useQuery<TransactionsResponse>({
    queryKey: transactionsKey,
    queryFn: async () => {
      const url = selectedAssetId
        ? `/api/operations/fuel-sales?assetId=${selectedAssetId}`
        : '/api/operations/fuel-sales';
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch transactions');
      return response.json();
    },
  });

  const fuelTypeColors = ['hsl(var(--primary))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))'];

  // Filter transactions by time range using EST timezone
  const daysAgo = parseInt(timeRange);
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysAgo);
  const cutoffBusinessDay = getBusinessDay(cutoffDate);

  const filteredTransactions = transactions.filter(tx => 
    getBusinessDay(new Date(tx.createdAt)) >= cutoffBusinessDay
  );

  // Calculate daily data using EST business days
  const dailyMap = new Map<string, { revenue: number; gallons: number; count: number }>();
  
  filteredTransactions.forEach(tx => {
    const businessDay = getBusinessDay(new Date(tx.createdAt));
    const existing = dailyMap.get(businessDay) || { revenue: 0, gallons: 0, count: 0 };
    dailyMap.set(businessDay, {
      revenue: existing.revenue + parseFloat(tx.totalAmount),
      gallons: existing.gallons + parseFloat(tx.gallons),
      count: existing.count + 1,
    });
  });

  const dailyData = Array.from(dailyMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0])) // Sort by yyyy-MM-dd first
    .map(([businessDay, data]) => ({
      date: formatBusinessDay(businessDay), // Format for display only
      revenue: data.revenue,
      gallons: data.gallons,
      count: data.count,
    }));

  // Calculate fuel type data
  const fuelTypeMap = new Map<string, { revenue: number; gallons: number; count: number }>();
  
  filteredTransactions.forEach(tx => {
    const fuelName = tx.fuelType?.name || 'Unknown';
    const existing = fuelTypeMap.get(fuelName) || { revenue: 0, gallons: 0, count: 0 };
    fuelTypeMap.set(fuelName, {
      revenue: existing.revenue + parseFloat(tx.totalAmount),
      gallons: existing.gallons + parseFloat(tx.gallons),
      count: existing.count + 1,
    });
  });

  const fuelTypeData = Array.from(fuelTypeMap.entries()).map(([name, data], index) => ({
    name,
    revenue: data.revenue,
    gallons: data.gallons,
    count: data.count,
    color: fuelTypeColors[index % fuelTypeColors.length],
  }));

  // Calculate performance metrics
  const totalRevenue = filteredTransactions.reduce((sum, tx) => sum + parseFloat(tx.totalAmount), 0);
  const totalGallons = filteredTransactions.reduce((sum, tx) => sum + parseFloat(tx.gallons), 0);
  const avgPricePerGallon = totalGallons > 0 ? totalRevenue / totalGallons : 0;
  const transactionCount = filteredTransactions.length;

  // Calculate trends
  const revenueGrowth = dailyData.length >= 7 
    ? ((dailyData.slice(-7).reduce((sum, d) => sum + d.revenue, 0) - dailyData.slice(0, 7).reduce((sum, d) => sum + d.revenue, 0)) / dailyData.slice(0, 7).reduce((sum, d) => sum + d.revenue, 0) * 100) || 0
    : 0;

  const gallonsGrowth = dailyData.length >= 7 
    ? ((dailyData.slice(-7).reduce((sum, d) => sum + d.gallons, 0) - dailyData.slice(0, 7).reduce((sum, d) => sum + d.gallons, 0)) / dailyData.slice(0, 7).reduce((sum, d) => sum + d.gallons, 0) * 100) || 0
    : 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <>
      <Header 
        title="Fuel Sales Analytics"
        subtitle="Analyze sales performance, trends, and insights"
      />

      <div className="px-6 pt-4 border-b border-border">
        <div className="flex justify-end pb-4">
          <AssetSelector 
            value={selectedAssetId} 
            onChange={setSelectedAssetId}
            className="w-[280px]"
          />
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Analytics Controls */}
        <Card>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Time Range</label>
                <Select value={timeRange} onValueChange={setTimeRange}>
                  <SelectTrigger data-testid="select-time-range">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7">Last 7 Days</SelectItem>
                    <SelectItem value="30">Last 30 Days</SelectItem>
                    <SelectItem value="90">Last 90 Days</SelectItem>
                    <SelectItem value="365">Last Year</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Primary Metric</label>
                <Select value={metricType} onValueChange={setMetricType}>
                  <SelectTrigger data-testid="select-metric-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="revenue">Revenue</SelectItem>
                    <SelectItem value="gallons">Gallons Sold</SelectItem>
                    <SelectItem value="transactions">Transaction Count</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Period</label>
                <Select defaultValue="daily">
                  <SelectTrigger data-testid="select-period">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Key Performance Indicators */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm font-medium">Total Revenue</p>
                  <p className="text-2xl font-bold text-foreground" data-testid="kpi-total-revenue">
                    ${totalRevenue.toLocaleString()}
                  </p>
                </div>
                <div className="w-12 h-12 bg-green-100 dark:bg-green-900/20 rounded-lg flex items-center justify-center">
                  <DollarSign className="w-6 h-6 text-green-600 dark:text-green-400" />
                </div>
              </div>
              <div className="flex items-center mt-4">
                {revenueGrowth >= 0 ? (
                  <TrendingUp className="w-3 h-3 mr-1 text-green-600" />
                ) : (
                  <TrendingDown className="w-3 h-3 mr-1 text-red-600" />
                )}
                <span className={`text-sm font-medium ${revenueGrowth >= 0 ? 'text-green-600' : 'text-red-600'}`} data-testid="kpi-revenue-growth">
                  {revenueGrowth >= 0 ? '+' : ''}{revenueGrowth.toFixed(2)}%
                </span>
                <span className="text-muted-foreground text-sm ml-2">vs previous period</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm font-medium">Total Gallons</p>
                  <p className="text-2xl font-bold text-foreground" data-testid="kpi-total-gallons">
                    {totalGallons.toLocaleString()}
                  </p>
                </div>
                <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/20 rounded-lg flex items-center justify-center">
                  <Fuel className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
              <div className="flex items-center mt-4">
                {gallonsGrowth >= 0 ? (
                  <TrendingUp className="w-3 h-3 mr-1 text-green-600" />
                ) : (
                  <TrendingDown className="w-3 h-3 mr-1 text-red-600" />
                )}
                <span className={`text-sm font-medium ${gallonsGrowth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {gallonsGrowth >= 0 ? '+' : ''}{gallonsGrowth.toFixed(2)}%
                </span>
                <span className="text-muted-foreground text-sm ml-2">vs previous period</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm font-medium">Avg Price/Gal</p>
                  <p className="text-2xl font-bold text-foreground" data-testid="kpi-avg-price">
                    ${avgPricePerGallon.toFixed(3)}
                  </p>
                </div>
                <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/20 rounded-lg flex items-center justify-center">
                  <Target className="w-6 h-6 text-orange-600 dark:text-orange-400" />
                </div>
              </div>
              <div className="flex items-center mt-4">
                <span className="text-muted-foreground text-sm">Weighted average</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm font-medium">Transactions</p>
                  <p className="text-2xl font-bold text-foreground" data-testid="kpi-transactions">
                    {transactionCount}
                  </p>
                </div>
                <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/20 rounded-lg flex items-center justify-center">
                  <Calendar className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                </div>
              </div>
              <div className="flex items-center mt-4">
                <span className="text-muted-foreground text-sm">Last {timeRange} days</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Sales Trend Over Time */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center" data-testid="chart-title-sales-trend">
                <BarChart3 className="w-5 h-5 mr-2" />
                Sales Trend Over Time
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]" data-testid="chart-sales-trend">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={dailyData}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis 
                      dataKey="date" 
                      className="text-xs"
                      tick={{ fill: 'hsl(var(--muted-foreground))' }}
                    />
                    <YAxis 
                      className="text-xs"
                      tick={{ fill: 'hsl(var(--muted-foreground))' }}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                    />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey={metricType === 'revenue' ? 'revenue' : metricType === 'gallons' ? 'gallons' : 'count'} 
                      stroke="hsl(var(--primary))" 
                      strokeWidth={2}
                      name={metricType === 'revenue' ? 'Revenue ($)' : metricType === 'gallons' ? 'Gallons' : 'Transactions'}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Fuel Type Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center" data-testid="chart-title-fuel-breakdown">
                <Fuel className="w-5 h-5 mr-2" />
                Sales by Fuel Type
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]" data-testid="chart-fuel-breakdown">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={fuelTypeData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey={metricType === 'revenue' ? 'revenue' : metricType === 'gallons' ? 'gallons' : 'count'}
                    >
                      {fuelTypeData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Detailed Fuel Type Performance */}
        <Card>
          <CardHeader>
            <CardTitle data-testid="table-title-fuel-performance">Fuel Type Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Fuel Type</th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Revenue</th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Gallons</th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Transactions</th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Avg Price/Gal</th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">% of Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {fuelTypeData.map((item, index) => (
                    <tr key={index} className="hover:bg-muted/30">
                      <td className="p-4 text-sm font-medium text-foreground" data-testid={`fuel-type-${index}`}>{item.name}</td>
                      <td className="p-4 text-sm text-foreground" data-testid={`fuel-revenue-${index}`}>${item.revenue.toLocaleString()}</td>
                      <td className="p-4 text-sm text-foreground" data-testid={`fuel-gallons-${index}`}>{item.gallons.toLocaleString()}</td>
                      <td className="p-4 text-sm text-foreground" data-testid={`fuel-count-${index}`}>{item.count}</td>
                      <td className="p-4 text-sm text-foreground" data-testid={`fuel-avg-price-${index}`}>${(item.revenue / item.gallons).toFixed(3)}</td>
                      <td className="p-4 text-sm text-foreground" data-testid={`fuel-percentage-${index}`}>
                        {((item.revenue / totalRevenue) * 100).toFixed(2)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
