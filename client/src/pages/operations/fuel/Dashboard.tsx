import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Header } from "@/components/layout/header";
import { MetricCard } from "@/components/fuel/metric-card";
import { SalesTrendChart } from "@/components/fuel/sales-trend-chart";
import { FuelTypeChart } from "@/components/fuel/fuel-type-chart";
import { NewSaleModal } from "@/components/fuel/new-sale-modal";
import { AddDeliveryModal } from "@/components/fuel/add-delivery-modal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { DashboardStats, SalesAnalytics, TransactionsResponse } from "@/types/fuel-api";
import { 
  DollarSign, 
  Fuel, 
  TrendingUp, 
  Package,
  Loader,
  ExternalLink 
} from "lucide-react";

export default function Dashboard() {
  const [isNewSaleModalOpen, setIsNewSaleModalOpen] = useState(false);
  const [isAddDeliveryModalOpen, setIsAddDeliveryModalOpen] = useState(false);

  const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ['/api/operations/fuel-sales/stats/summary'],
  });

  const { data: analytics, isLoading: analyticsLoading } = useQuery<SalesAnalytics>({
    queryKey: ['/api/operations/fuel-analytics', { days: 30 }],
  });

  const { data: transactions, isLoading: transactionsLoading } = useQuery<TransactionsResponse>({
    queryKey: ['/api/operations/fuel-sales', { limit: 10 }],
  });

  if (statsLoading || analyticsLoading || transactionsLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader className="w-8 h-8 animate-spin" data-testid="loading-spinner" />
      </div>
    );
  }

  const getPaymentMethodBadge = (method: string) => {
    const variants: Record<string, string> = {
      cash: "bg-green-100 text-green-800",
      check: "bg-yellow-100 text-yellow-800",
    };
    return variants[method] || "bg-gray-100 text-gray-800";
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, string> = {
      completed: "bg-green-100 text-green-800",
      pending: "bg-yellow-100 text-yellow-800",
      failed: "bg-red-100 text-red-800",
      refunded: "bg-gray-100 text-gray-800",
    };
    return variants[status] || "bg-gray-100 text-gray-800";
  };

  return (
    <>
      <Header 
        title="Fuel Sales Dashboard"
        subtitle="Welcome back! Here's what's happening with your fuel sales."
      />

      <div className="p-6 space-y-6">
        {/* Action Buttons */}
        <div className="flex space-x-3">
          <Button 
            onClick={() => setIsNewSaleModalOpen(true)}
            data-testid="button-new-sale"
          >
            Record New Sale
          </Button>
          <Button 
            variant="outline"
            onClick={() => setIsAddDeliveryModalOpen(true)}
            data-testid="button-add-delivery"
          >
            Add Delivery
          </Button>
        </div>

        {/* Key Metrics Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <MetricCard
            title="Today's Sales"
            value={`$${parseFloat(stats?.todaysSales || '0').toLocaleString()}`}
            icon={<DollarSign className="w-6 h-6 text-accent" />}
            change={{
              value: "+12.3%",
              type: "increase",
              label: "vs yesterday"
            }}
          />
          <MetricCard
            title="Gallons Sold"
            value={parseFloat(stats?.gallonsSold || '0').toLocaleString()}
            icon={<Fuel className="w-6 h-6 text-primary" />}
            change={{
              value: "+8.1%",
              type: "increase", 
              label: "vs yesterday"
            }}
          />
          <MetricCard
            title="Avg Price/Gal"
            value={`$${parseFloat(stats?.avgPricePerGallon || '0').toFixed(2)}`}
            icon={<TrendingUp className="w-6 h-6 text-orange-600" />}
            change={{
              value: "-2.1%",
              type: "decrease",
              label: "vs yesterday"
            }}
          />
          <MetricCard
            title="Inventory Level"
            value={stats?.lowStockAlerts && stats.lowStockAlerts.length > 0 ? 'Low Stock' : 'Good'}
            icon={<Package className="w-6 h-6 text-yellow-600" />}
            change={stats?.lowStockAlerts && stats.lowStockAlerts.length > 0 ? {
              value: "Low Stock",
              type: "warning",
              label: "reorder soon"
            } : undefined}
          />
        </div>

        {/* Charts Row */}
        {analytics && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <SalesTrendChart data={analytics.daily || []} />
            <FuelTypeChart data={analytics.fuelTypeBreakdown || []} />
          </div>
        )}

        {/* Recent Transactions */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle data-testid="recent-transactions-title">Recent Transactions</CardTitle>
            <Button variant="ghost" size="sm" className="text-primary hover:text-primary/80" data-testid="button-view-all-transactions">
              View All
            </Button>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Time</th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Fuel Type</th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Gallons</th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Amount</th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Payment</th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {transactions?.map((transaction, index) => (
                    <tr key={transaction.id} className="hover:bg-muted/30">
                      <td className="p-4 text-sm text-foreground" data-testid={`transaction-time-${index}`}>
                        {new Date(transaction.createdAt).toLocaleTimeString('en-US', { 
                          hour: '2-digit', 
                          minute: '2-digit' 
                        })}
                      </td>
                      <td className="p-4 text-sm text-foreground" data-testid={`transaction-fuel-${index}`}>
                        {transaction.fuelType?.name}
                      </td>
                      <td className="p-4 text-sm text-foreground" data-testid={`transaction-gallons-${index}`}>
                        {parseFloat(transaction.gallons).toFixed(1)}
                      </td>
                      <td className="p-4 text-sm font-medium text-foreground" data-testid={`transaction-amount-${index}`}>
                        ${parseFloat(transaction.totalAmount).toFixed(2)}
                      </td>
                      <td className="p-4 text-sm">
                        <Badge className={getPaymentMethodBadge(transaction.paymentMethod)} data-testid={`transaction-payment-${index}`}>
                          {transaction.paymentMethod}
                        </Badge>
                      </td>
                      <td className="p-4 text-sm">
                        <Badge className={getStatusBadge(transaction.status)} data-testid={`transaction-status-${index}`}>
                          {transaction.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Inventory Alerts */}
        {stats?.lowStockAlerts && stats.lowStockAlerts.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle data-testid="inventory-alerts-title">Inventory Alerts</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {stats.lowStockAlerts.map((alert, index) => (
                <div key={alert.id} className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-destructive rounded-full mt-2 flex-shrink-0"></div>
                  <div>
                    <p className="text-sm font-medium text-foreground" data-testid={`alert-fuel-${index}`}>
                      {alert.fuelType?.name} Low
                    </p>
                    <p className="text-xs text-muted-foreground" data-testid={`alert-level-${index}`}>
                      {parseFloat(alert.currentLevel).toLocaleString()} gallons remaining
                    </p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Financial Projection Section */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle data-testid="financial-projections-title">Financial Projections</CardTitle>
              <p className="text-sm text-muted-foreground">Based on current trends and historical data</p>
            </div>
            <Button 
              variant="secondary"
              className="bg-secondary text-secondary-foreground hover:bg-secondary/80"
              data-testid="button-view-financial-model"
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              View Full Model
            </Button>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-2">Projected Monthly Revenue</p>
                <p className="text-2xl font-bold text-foreground" data-testid="projection-revenue">$87,420</p>
                <div className="flex items-center justify-center mt-2">
                  <TrendingUp className="w-3 h-3 text-accent mr-1" />
                  <span className="text-accent text-sm font-medium">+15.2%</span>
                  <span className="text-muted-foreground text-sm ml-2">vs last month</span>
                </div>
              </div>
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-2">Projected Gallons</p>
                <p className="text-2xl font-bold text-foreground" data-testid="projection-gallons">38,245</p>
                <div className="flex items-center justify-center mt-2">
                  <TrendingUp className="w-3 h-3 text-accent mr-1" />
                  <span className="text-accent text-sm font-medium">+12.8%</span>
                  <span className="text-muted-foreground text-sm ml-2">vs last month</span>
                </div>
              </div>
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-2">Profit Margin</p>
                <p className="text-2xl font-bold text-foreground" data-testid="projection-margin">23.4%</p>
                <div className="flex items-center justify-center mt-2">
                  <TrendingUp className="w-3 h-3 text-accent mr-1" />
                  <span className="text-accent text-sm font-medium">+1.2%</span>
                  <span className="text-muted-foreground text-sm ml-2">vs last month</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <NewSaleModal 
        isOpen={isNewSaleModalOpen}
        onClose={() => setIsNewSaleModalOpen(false)}
      />

      <AddDeliveryModal
        isOpen={isAddDeliveryModalOpen}
        onClose={() => setIsAddDeliveryModalOpen(false)}
      />
    </>
  );
}
