import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Ship, DollarSign, TrendingUp, Package,
  ArrowRightLeft, Clock, Loader, Plus,
  ArrowUpRight, Percent
} from "lucide-react";
import { Link } from "wouter";

interface SalesStats {
  totalSales: number;
  totalRevenue: number;
  totalGrossProfit: number;
  avgSalePrice: number;
  avgGrossProfit: number;
  totalTradeInValue: number;
  totalFinancedAmount: number;
  financedCount: number;
  cashCount: number;
  totalCommissions: number;
  pendingDelivery: number;
}

interface InventoryStats {
  totalUnits: number;
  availableUnits: number;
  pendingUnits: number;
  consignmentUnits: number;
  totalInventoryValue: number;
  totalCost: number;
  potentialProfit: number;
  avgDaysOnLot: number;
  floorPlanExposure: number;
  newUnits: number;
  usedUnits: number;
  inventoryByMake: { make: string; count: number }[];
}

interface InventoryItem {
  id: string;
  stockNumber: string;
  make: string;
  model: string;
  year: number;
  condition: string;
  status: string;
  listPrice: string;
  daysOnLot?: number;
}

interface Transaction {
  id: string;
  transactionNumber: string;
  buyerName: string;
  saleDate: string;
  salePrice: string;
  grossProfit?: string;
  isDelivered: boolean;
}

export default function BoatSalesDashboard() {
  const { data: salesStats, isLoading: salesStatsLoading } = useQuery<SalesStats>({
    queryKey: ['/api/boat-sales/transactions/stats'],
  });

  const { data: inventoryStats, isLoading: inventoryStatsLoading } = useQuery<InventoryStats>({
    queryKey: ['/api/boat-sales/inventory/stats'],
  });

  const { data: inventory = [] } = useQuery<InventoryItem[]>({
    queryKey: ['/api/boat-sales/inventory'],
  });

  const { data: transactions = [] } = useQuery<Transaction[]>({
    queryKey: ['/api/boat-sales/transactions'],
  });

  const { data: tradeIns = [] } = useQuery({
    queryKey: ['/api/boat-sales/trade-ins'],
  });

  const availableInventory = inventory.filter(i => i.status === 'available').slice(0, 6);
  const recentSales = transactions.slice(0, 5);
  const pendingTradeIns = (tradeIns as any[]).filter(t => t.status === 'pending_evaluation');

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getConditionColor = (condition: string) => {
    switch (condition) {
      case 'new': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'excellent': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'good': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'fair': return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'pending': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'sold': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'consignment': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  const isLoading = salesStatsLoading || inventoryStatsLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Header 
        title="Boat Sales" 
        subtitle="Inventory management, sales transactions, and trade-ins"
      />

      <div className="flex justify-between items-center">
        <Tabs defaultValue="overview" className="w-full">
          <div className="flex justify-between items-center mb-4">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="inventory">Inventory</TabsTrigger>
              <TabsTrigger value="sales">Sales</TabsTrigger>
              <TabsTrigger value="trade-ins">Trade-ins</TabsTrigger>
            </TabsList>
            <div className="flex gap-2">
              <Link href="/operations/boat-sales/inventory">
                <Button variant="outline" data-testid="btn-add-inventory">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Inventory
                </Button>
              </Link>
              <Link href="/operations/boat-sales/transactions">
                <Button data-testid="btn-new-sale">
                  <Plus className="h-4 w-4 mr-2" />
                  New Sale
                </Button>
              </Link>
            </div>
          </div>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Total Sales</p>
                      <p className="text-2xl font-bold" data-testid="stat-total-sales">{salesStats?.totalSales || 0}</p>
                    </div>
                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <Ship className="h-6 w-6 text-primary" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Total Revenue</p>
                      <p className="text-2xl font-bold" data-testid="stat-total-revenue">{formatCurrency(salesStats?.totalRevenue || 0)}</p>
                    </div>
                    <div className="h-12 w-12 rounded-full bg-green-500/10 flex items-center justify-center">
                      <DollarSign className="h-6 w-6 text-green-500" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Gross Profit</p>
                      <p className="text-2xl font-bold" data-testid="stat-gross-profit">{formatCurrency(salesStats?.totalGrossProfit || 0)}</p>
                    </div>
                    <div className="h-12 w-12 rounded-full bg-blue-500/10 flex items-center justify-center">
                      <TrendingUp className="h-6 w-6 text-blue-500" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Inventory Value</p>
                      <p className="text-2xl font-bold" data-testid="stat-inventory-value">{formatCurrency(inventoryStats?.totalInventoryValue || 0)}</p>
                    </div>
                    <div className="h-12 w-12 rounded-full bg-purple-500/10 flex items-center justify-center">
                      <Package className="h-6 w-6 text-purple-500" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>Inventory Summary</CardTitle>
                  <CardDescription>Current inventory status and value</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div className="text-center p-4 border rounded-lg">
                      <p className="text-2xl font-bold text-green-600">{inventoryStats?.availableUnits || 0}</p>
                      <p className="text-sm text-muted-foreground">Available</p>
                    </div>
                    <div className="text-center p-4 border rounded-lg">
                      <p className="text-2xl font-bold text-yellow-600">{inventoryStats?.pendingUnits || 0}</p>
                      <p className="text-sm text-muted-foreground">Pending</p>
                    </div>
                    <div className="text-center p-4 border rounded-lg">
                      <p className="text-2xl font-bold">{inventoryStats?.newUnits || 0}</p>
                      <p className="text-sm text-muted-foreground">New</p>
                    </div>
                    <div className="text-center p-4 border rounded-lg">
                      <p className="text-2xl font-bold">{inventoryStats?.usedUnits || 0}</p>
                      <p className="text-sm text-muted-foreground">Used</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-muted/50 rounded-lg">
                      <p className="text-sm text-muted-foreground">Avg Days on Lot</p>
                      <p className="text-xl font-bold">{(inventoryStats?.avgDaysOnLot || 0).toFixed(0)} days</p>
                    </div>
                    <div className="p-4 bg-muted/50 rounded-lg">
                      <p className="text-sm text-muted-foreground">Potential Profit</p>
                      <p className="text-xl font-bold text-green-600">{formatCurrency(inventoryStats?.potentialProfit || 0)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Sales Performance</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Avg Sale Price</span>
                      <span className="font-bold">{formatCurrency(salesStats?.avgSalePrice || 0)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Avg Gross Profit</span>
                      <span className="font-bold text-green-600">{formatCurrency(salesStats?.avgGrossProfit || 0)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Financed Sales</span>
                      <span className="font-bold">{salesStats?.financedCount || 0}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Cash Sales</span>
                      <span className="font-bold">{salesStats?.cashCount || 0}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Pending Delivery</span>
                      <span className="font-bold text-yellow-600">{salesStats?.pendingDelivery || 0}</span>
                    </div>
                    <div className="pt-2 border-t flex justify-between items-center">
                      <span className="text-sm">Total Commissions</span>
                      <span className="font-bold">{formatCurrency(salesStats?.totalCommissions || 0)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Recent Sales</CardTitle>
                  <CardDescription>Latest completed transactions</CardDescription>
                </CardHeader>
                <CardContent>
                  {recentSales.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">No sales recorded</p>
                  ) : (
                    <div className="space-y-4">
                      {recentSales.map((sale) => (
                        <div key={sale.id} className="flex items-center justify-between p-3 border rounded-lg" data-testid={`sale-${sale.id}`}>
                          <div className="space-y-1">
                            <span className="font-medium">{sale.transactionNumber}</span>
                            <p className="text-sm text-muted-foreground">{sale.buyerName}</p>
                            <p className="text-xs text-muted-foreground">{formatDate(sale.saleDate)}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-medium">{formatCurrency(parseFloat(sale.salePrice))}</p>
                            {sale.grossProfit && (
                              <p className="text-sm text-green-600">+{formatCurrency(parseFloat(sale.grossProfit))}</p>
                            )}
                            {!sale.isDelivered && (
                              <Badge variant="outline" className="mt-1">Pending Delivery</Badge>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ArrowRightLeft className="h-5 w-5 text-orange-500" />
                    Pending Trade-ins
                  </CardTitle>
                  <CardDescription>Trade-ins awaiting evaluation</CardDescription>
                </CardHeader>
                <CardContent>
                  {pendingTradeIns.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                      <ArrowRightLeft className="h-12 w-12 text-muted-foreground mb-2" />
                      <p className="text-muted-foreground">No pending trade-ins</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {pendingTradeIns.slice(0, 5).map((tradeIn: any) => (
                        <div key={tradeIn.id} className="flex items-center justify-between p-3 border border-orange-200 dark:border-orange-900 rounded-lg bg-orange-50 dark:bg-orange-950">
                          <div className="space-y-1">
                            <span className="font-medium">{tradeIn.tradeInNumber}</span>
                            <p className="text-sm">{tradeIn.year} {tradeIn.make} {tradeIn.model}</p>
                          </div>
                          <Badge className={getConditionColor(tradeIn.condition)}>{tradeIn.condition}</Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="inventory">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Available Inventory</CardTitle>
                  <CardDescription>{inventoryStats?.availableUnits || 0} boats available for sale</CardDescription>
                </div>
                <Link href="/operations/boat-sales/inventory">
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Boat
                  </Button>
                </Link>
              </CardHeader>
              <CardContent>
                {availableInventory.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No inventory available</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {availableInventory.map((item) => (
                      <div key={item.id} className="p-4 border rounded-lg" data-testid={`inventory-${item.id}`}>
                        <div className="flex justify-between items-start mb-2">
                          <span className="text-sm text-muted-foreground">{item.stockNumber}</span>
                          <Badge className={getConditionColor(item.condition)}>{item.condition}</Badge>
                        </div>
                        <h4 className="font-medium">{item.year} {item.make} {item.model}</h4>
                        <div className="mt-2 pt-2 border-t flex justify-between items-center">
                          <span className="text-lg font-bold">{formatCurrency(parseFloat(item.listPrice))}</span>
                          {item.daysOnLot && (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {item.daysOnLot}d
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <div className="mt-6">
                  <Link href="/operations/boat-sales/inventory">
                    <Button variant="outline" className="w-full">
                      View All Inventory
                      <ArrowUpRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="sales">
            <Card>
              <CardHeader>
                <CardTitle>Sales Transactions</CardTitle>
                <CardDescription>Record and manage boat sales</CardDescription>
              </CardHeader>
              <CardContent>
                <Link href="/operations/boat-sales/transactions">
                  <Button variant="outline" className="w-full">
                    View All Transactions
                    <ArrowUpRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="trade-ins">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Trade-in Management</CardTitle>
                  <CardDescription>Evaluate and process trade-ins</CardDescription>
                </div>
                <Link href="/operations/boat-sales/trade-ins">
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    New Trade-in
                  </Button>
                </Link>
              </CardHeader>
              <CardContent>
                <Link href="/operations/boat-sales/trade-ins">
                  <Button variant="outline" className="w-full">
                    Manage Trade-ins
                    <ArrowUpRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
