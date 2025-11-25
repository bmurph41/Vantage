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
import type { DashboardStats, TransactionsResponse } from "@/types/fuel-api";
import { getBusinessDay } from "@/lib/fuel-utils";
import { AssetSelector } from "@/components/AssetSelector";
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
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);

  const statsKey = selectedAssetId
    ? ['/api/operations/fuel-sales/stats/summary', selectedAssetId]
    : ['/api/operations/fuel-sales/stats/summary'];

  const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: statsKey,
    queryFn: async () => {
      const url = selectedAssetId
        ? `/api/operations/fuel-sales/stats/summary?assetId=${selectedAssetId}`
        : '/api/operations/fuel-sales/stats/summary';
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch stats');
      return response.json();
    },
  });

  const transactionsKey = selectedAssetId
    ? ['/api/operations/fuel-sales', selectedAssetId]
    : ['/api/operations/fuel-sales'];

  const { data: transactions = [], isLoading: transactionsLoading } = useQuery<TransactionsResponse>({
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

  const inventoryKey = selectedAssetId
    ? ['/api/operations/fuel-inventory', selectedAssetId]
    : ['/api/operations/fuel-inventory'];

  const { data: inventory = [] } = useQuery({
    queryKey: inventoryKey,
    queryFn: async () => {
      const url = selectedAssetId
        ? `/api/operations/fuel-inventory?assetId=${selectedAssetId}`
        : '/api/operations/fuel-inventory';
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch inventory');
      return response.json();
    },
  });

  const projectionsKey = selectedAssetId
    ? ['/api/operations/fuel-projections', selectedAssetId]
    : ['/api/operations/fuel-projections'];

  const { data: projections = [] } = useQuery({
    queryKey: projectionsKey,
    queryFn: async () => {
      const url = selectedAssetId
        ? `/api/operations/fuel-projections?assetId=${selectedAssetId}`
        : '/api/operations/fuel-projections';
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch projections');
      return response.json();
    },
  });

  // Calculate yesterday's data for comparison using EST timezone with 5pm cutoff
  const todayBusinessDay = getBusinessDay(new Date());
  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterdayBusinessDay = getBusinessDay(yesterdayDate);
  
  const todaysTransactions = transactions.filter(tx => 
    getBusinessDay(new Date(tx.createdAt)) === todayBusinessDay
  );
  
  const yesterdaysTransactions = transactions.filter(tx => 
    getBusinessDay(new Date(tx.createdAt)) === yesterdayBusinessDay
  );

  const todaysSales = todaysTransactions.reduce((sum, tx) => sum + parseFloat(tx.totalAmount), 0);
  const yesterdaysSales = yesterdaysTransactions.reduce((sum, tx) => sum + parseFloat(tx.totalAmount), 0);
  const salesChange = yesterdaysSales > 0 ? ((todaysSales - yesterdaysSales) / yesterdaysSales) * 100 : 0;

  const todaysGallons = todaysTransactions.reduce((sum, tx) => sum + parseFloat(tx.gallons), 0);
  const yesterdaysGallons = yesterdaysTransactions.reduce((sum, tx) => sum + parseFloat(tx.gallons), 0);
  const gallonsChange = yesterdaysGallons > 0 ? ((todaysGallons - yesterdaysGallons) / yesterdaysGallons) * 100 : 0;

  const todaysAvgPrice = todaysGallons > 0 ? todaysSales / todaysGallons : 0;
  const yesterdaysAvgPrice = yesterdaysGallons > 0 ? yesterdaysSales / yesterdaysGallons : 0;
  const priceChange = yesterdaysAvgPrice > 0 ? ((todaysAvgPrice - yesterdaysAvgPrice) / yesterdaysAvgPrice) * 100 : 0;

  // Calculate last 30 days for trending using EST timezone
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const thirtyDaysAgoBusinessDay = getBusinessDay(thirtyDaysAgo);
  
  const last30DaysTransactions = transactions.filter(tx => 
    getBusinessDay(new Date(tx.createdAt)) >= thirtyDaysAgoBusinessDay
  );

  // Group by EST business day for trend chart
  const dailyDataMap = new Map();
  last30DaysTransactions.forEach(tx => {
    const businessDay = getBusinessDay(new Date(tx.createdAt));
    const existing = dailyDataMap.get(businessDay) || { date: businessDay, revenue: 0, gallons: 0 };
    dailyDataMap.set(businessDay, {
      date: businessDay,
      revenue: existing.revenue + parseFloat(tx.totalAmount),
      gallons: existing.gallons + parseFloat(tx.gallons),
    });
  });

  const dailyData = Array.from(dailyDataMap.values()).sort((a, b) => 
    a.date.localeCompare(b.date) // Sort by yyyy-MM-dd format
  );

  // Group by fuel type
  const fuelTypeMap = new Map();
  last30DaysTransactions.forEach(tx => {
    const fuelName = tx.fuelType?.name || 'Unknown';
    const existing = fuelTypeMap.get(fuelName) || { name: fuelName, value: 0 };
    fuelTypeMap.set(fuelName, {
      name: fuelName,
      value: existing.value + parseFloat(tx.totalAmount),
    });
  });

  const fuelTypeData = Array.from(fuelTypeMap.values());

  // Calculate low stock alerts from inventory
  const lowStockItems = inventory.filter((item: any) => 
    parseFloat(item.currentLevel) < parseFloat(item.reorderPoint || '1000')
  );

  if (statsLoading || transactionsLoading) {
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
            value={`$${todaysSales.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            icon={<DollarSign className="w-6 h-6 text-accent" />}
            change={{
              value: `${salesChange >= 0 ? '+' : ''}${salesChange.toFixed(2)}%`,
              type: salesChange >= 0 ? "increase" : "decrease",
              label: "vs yesterday"
            }}
          />
          <MetricCard
            title="Gallons Sold"
            value={todaysGallons.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            icon={<Fuel className="w-6 h-6 text-primary" />}
            change={{
              value: `${gallonsChange >= 0 ? '+' : ''}${gallonsChange.toFixed(2)}%`,
              type: gallonsChange >= 0 ? "increase" : "decrease", 
              label: "vs yesterday"
            }}
          />
          <MetricCard
            title="Avg Price/Gal"
            value={`$${todaysAvgPrice.toFixed(2)}`}
            icon={<TrendingUp className="w-6 h-6 text-orange-600" />}
            change={{
              value: `${priceChange >= 0 ? '+' : ''}${priceChange.toFixed(2)}%`,
              type: priceChange >= 0 ? "increase" : "decrease",
              label: "vs yesterday"
            }}
          />
          <MetricCard
            title="Inventory Level"
            value={lowStockItems.length > 0 ? `${lowStockItems.length} Low` : 'Good'}
            icon={<Package className="w-6 h-6 text-yellow-600" />}
            change={lowStockItems.length > 0 ? {
              value: "Action Needed",
              type: "warning",
              label: "reorder soon"
            } : undefined}
          />
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SalesTrendChart data={dailyData} />
          <FuelTypeChart data={fuelTypeData} />
        </div>

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
                  {transactions?.slice(0, 10).map((transaction, index) => (
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
        {lowStockItems.length > 0 && (
          <Card className="border-l-4 border-l-destructive">
            <CardHeader>
              <CardTitle data-testid="inventory-alerts-title" className="flex items-center gap-2">
                <Package className="w-5 h-5 text-destructive" />
                Inventory Alerts
                <Badge variant="destructive">{lowStockItems.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {lowStockItems.map((alert: any, index: number) => {
                const currentLevel = parseFloat(alert.currentLevel);
                const reorderPoint = parseFloat(alert.reorderPoint || '1000');
                const percentRemaining = (currentLevel / reorderPoint) * 100;
                
                return (
                  <div key={alert.id} className="flex items-start justify-between p-3 bg-muted/30 rounded-lg">
                    <div className="flex items-start space-x-3">
                      <div className="w-2 h-2 bg-destructive rounded-full mt-2 flex-shrink-0"></div>
                      <div>
                        <p className="text-sm font-medium text-foreground" data-testid={`alert-fuel-${index}`}>
                          {alert.fuelType?.name || 'Unknown Fuel'}
                        </p>
                        <p className="text-xs text-muted-foreground" data-testid={`alert-level-${index}`}>
                          {currentLevel.toLocaleString()} gallons remaining ({percentRemaining.toFixed(0)}% of reorder point)
                        </p>
                        <p className="text-xs text-destructive mt-1">
                          Reorder at: {reorderPoint.toLocaleString()} gallons
                        </p>
                      </div>
                    </div>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => setIsAddDeliveryModalOpen(true)}
                      data-testid={`button-reorder-${index}`}
                    >
                      Order Now
                    </Button>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}

        {/* Financial Projection Section */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle data-testid="financial-projections-title">Financial Projections</CardTitle>
              <p className="text-sm text-muted-foreground">Based on last 30 days performance</p>
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
                <p className="text-2xl font-bold text-foreground" data-testid="projection-revenue">
                  ${(last30DaysTransactions.reduce((sum, tx) => sum + parseFloat(tx.totalAmount), 0)).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </p>
                <p className="text-xs text-muted-foreground mt-1">Based on last 30 days</p>
              </div>
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-2">Projected Gallons</p>
                <p className="text-2xl font-bold text-foreground" data-testid="projection-gallons">
                  {last30DaysTransactions.reduce((sum, tx) => sum + parseFloat(tx.gallons), 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </p>
                <p className="text-xs text-muted-foreground mt-1">Based on last 30 days</p>
              </div>
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-2">Avg Transaction Size</p>
                <p className="text-2xl font-bold text-foreground" data-testid="projection-margin">
                  ${last30DaysTransactions.length > 0 
                    ? (last30DaysTransactions.reduce((sum, tx) => sum + parseFloat(tx.totalAmount), 0) / last30DaysTransactions.length).toFixed(2)
                    : '0.00'}
                </p>
                <p className="text-xs text-muted-foreground mt-1">{last30DaysTransactions.length} transactions</p>
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
