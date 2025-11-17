import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import SalesChart from "@/components/charts/sales-chart";

export default function Dashboard() {
  const { data: metrics, isLoading: metricsLoading } = useQuery({
    queryKey: ["/api/dashboard/metrics"],
  });

  const { data: recentTransactions, isLoading: transactionsLoading } = useQuery({
    queryKey: ["/api/transactions/recent"],
  });

  const { data: topCategories, isLoading: categoriesLoading } = useQuery({
    queryKey: ["/api/dashboard/top-categories"],
  });

  if (metricsLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-muted rounded w-1/3"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-32 bg-muted rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold" data-testid="dashboard-title">Dashboard Overview</h2>
        <p className="text-muted-foreground">Real-time insights into your ship store performance</p>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Today's Sales</p>
                <p className="text-2xl font-bold" data-testid="todays-sales">
                  ${metrics?.todaysSales?.toFixed(2) || "0.00"}
                </p>
                {metrics?.growthMetrics && (
                  <p className={`text-sm font-medium ${metrics.growthMetrics.dailyGrowth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {metrics.growthMetrics.dailyGrowth >= 0 ? '↑' : '↓'} {Math.abs(metrics.growthMetrics.dailyGrowth).toFixed(1)}% vs yesterday
                  </p>
                )}
              </div>
              <div className="w-12 h-12 bg-accent/10 rounded-full flex items-center justify-center">
                <i className="fas fa-dollar-sign text-accent"></i>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Transactions</p>
                <p className="text-2xl font-bold" data-testid="total-transactions">
                  {metrics?.totalTransactions || 0}
                </p>
                <p className="text-sm text-accent">Today</p>
              </div>
              <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                <i className="fas fa-shopping-cart text-primary"></i>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Avg. Order Value</p>
                <p className="text-2xl font-bold" data-testid="avg-order-value">
                  ${metrics?.averageOrderValue?.toFixed(2) || "0.00"}
                </p>
                <p className="text-sm text-muted-foreground">Last 30 days</p>
              </div>
              <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center">
                <i className="fas fa-chart-line text-yellow-600"></i>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Low Stock Items</p>
                <p className="text-2xl font-bold text-destructive" data-testid="low-stock-items">
                  {metrics?.lowStockItems || 0}
                </p>
                <p className="text-sm text-muted-foreground">Requires attention</p>
              </div>
              <div className="w-12 h-12 bg-destructive/10 rounded-full flex items-center justify-center">
                <i className="fas fa-exclamation-triangle text-destructive"></i>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Advanced KPIs for PE Firms */}
      {metrics?.growthMetrics && (
        <div className="mb-8">
          <h3 className="text-lg font-semibold mb-4">Growth Metrics</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardContent className="p-6">
                <p className="text-sm font-medium text-muted-foreground mb-2">Weekly Growth</p>
                <p className={`text-3xl font-bold ${metrics.growthMetrics.weeklyGrowth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {metrics.growthMetrics.weeklyGrowth >= 0 ? '+' : ''}{metrics.growthMetrics.weeklyGrowth.toFixed(1)}%
                </p>
                <p className="text-sm text-muted-foreground mt-1">vs last week</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <p className="text-sm font-medium text-muted-foreground mb-2">Monthly Growth</p>
                <p className={`text-3xl font-bold ${metrics.growthMetrics.monthlyGrowth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {metrics.growthMetrics.monthlyGrowth >= 0 ? '+' : ''}{metrics.growthMetrics.monthlyGrowth.toFixed(1)}%
                </p>
                <p className="text-sm text-muted-foreground mt-1">vs last month</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <p className="text-sm font-medium text-muted-foreground mb-2">Revenue Velocity</p>
                <p className="text-3xl font-bold text-accent">
                  ${metrics.velocityMetrics.revenuePerHour.toFixed(0)}/hr
                </p>
                <p className="text-sm text-muted-foreground mt-1">{metrics.velocityMetrics.transactionsPerHour.toFixed(1)} trans/hr</p>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Trend Analysis */}
      {metrics?.trendMetrics && (
        <div className="mb-8">
          <h3 className="text-lg font-semibold mb-4">Performance Trends</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card>
              <CardContent className="p-6">
                <p className="text-sm font-medium text-muted-foreground mb-2">7-Day Avg</p>
                <p className="text-2xl font-bold">${metrics.trendMetrics.last7DaysAvg.toFixed(0)}</p>
                <p className="text-sm text-muted-foreground mt-1">Daily average</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <p className="text-sm font-medium text-muted-foreground mb-2">30-Day Avg</p>
                <p className="text-2xl font-bold">${metrics.trendMetrics.last30DaysAvg.toFixed(0)}</p>
                <p className="text-sm text-muted-foreground mt-1">Daily average</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <p className="text-sm font-medium text-muted-foreground mb-2">Best Day</p>
                <p className="text-2xl font-bold text-green-600">${metrics.trendMetrics.bestDay.sales.toFixed(0)}</p>
                <p className="text-sm text-muted-foreground mt-1">{metrics.trendMetrics.bestDay.date}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <p className="text-sm font-medium text-muted-foreground mb-2">Worst Day</p>
                <p className="text-2xl font-bold text-amber-600">${metrics.trendMetrics.worstDay.sales.toFixed(0)}</p>
                <p className="text-sm text-muted-foreground mt-1">{metrics.trendMetrics.worstDay.date}</p>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <Card>
          <CardHeader>
            <CardTitle>Sales Trends (Last 7 Days)</CardTitle>
          </CardHeader>
          <CardContent>
            <SalesChart />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top Selling Categories</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {categoriesLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="h-6 bg-muted rounded animate-pulse"></div>
                  ))}
                </div>
              ) : (
                topCategories?.map((category: any, index: number) => (
                  <div key={index} className="flex items-center justify-between" data-testid={`category-${index}`}>
                    <div className="flex items-center space-x-3">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: category.color }}
                      ></div>
                      <span className="font-medium">{category.name}</span>
                    </div>
                    <span className="text-muted-foreground">{category.percentage}%</span>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Transactions */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Transactions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left p-2 font-medium text-muted-foreground">Transaction ID</th>
                  <th className="text-left p-2 font-medium text-muted-foreground">Time</th>
                  <th className="text-left p-2 font-medium text-muted-foreground">Items</th>
                  <th className="text-left p-2 font-medium text-muted-foreground">Total</th>
                  <th className="text-left p-2 font-medium text-muted-foreground">Payment</th>
                </tr>
              </thead>
              <tbody>
                {transactionsLoading ? (
                  <tr>
                    <td colSpan={5} className="p-4 text-center text-muted-foreground">
                      Loading transactions...
                    </td>
                  </tr>
                ) : recentTransactions?.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-4 text-center text-muted-foreground">
                      No transactions found
                    </td>
                  </tr>
                ) : (
                  recentTransactions?.map((transaction: any) => (
                    <tr key={transaction.id} className="border-b border-border last:border-b-0" data-testid={`transaction-${transaction.id}`}>
                      <td className="p-2 font-mono text-sm">#{transaction.id.slice(-8)}</td>
                      <td className="p-2 text-muted-foreground text-sm">
                        {new Date(transaction.createdAt).toLocaleTimeString()}
                      </td>
                      <td className="p-2">{transaction.items?.length || 0} items</td>
                      <td className="p-2 font-medium">${Number(transaction.total).toFixed(2)}</td>
                      <td className="p-2">
                        <span className="px-2 py-1 bg-accent/10 text-accent rounded-full text-xs capitalize">
                          {transaction.paymentMethod}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
