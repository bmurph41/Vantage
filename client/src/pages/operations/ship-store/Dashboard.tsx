import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { 
  LayoutDashboard, 
  Box, 
  CreditCard, 
  BarChart3, 
  DollarSign, 
  Package, 
  TrendingUp, 
  ShoppingCart, 
  AlertCircle,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  Star,
  RotateCcw,
  Calculator
} from "lucide-react";
import { AssetSelector } from "@/components/AssetSelector";
import { ContextIntegrationsPanel } from "@/components/integrations/ContextIntegrationsPanel";
import { PageTour } from "@/components/onboarding/PageTour";
import { TOUR_IDS, shipStoreTourSteps } from "@/lib/tour-configs";
import { SyncStatusBanner } from "@/components/operations/SyncStatusBanner";
import { GlobalControlsBar } from "@/components/operations/GlobalControlsBar";
import { UseInValuatorModal } from "@/components/operations/UseInValuatorModal";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  LineChart,
  Line
} from 'recharts';

const COLORS = ['hsl(var(--primary))', 'hsl(var(--accent))', 'hsl(39, 85%, 59%)', 'hsl(280, 65%, 60%)', 'hsl(120, 60%, 45%)', 'hsl(200, 70%, 50%)'];

export default function ShipStoreDashboard() {
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [selectedMarinaId, setSelectedMarinaId] = useState<string | null>(null);
  const [selectedTimeframe, setSelectedTimeframe] = useState("ttm");
  const [showUseInValuator, setShowUseInValuator] = useState(false);

  const queryKey = selectedAssetId 
    ? ['/api/ship-store/dashboard/metrics', selectedAssetId]
    : ['/api/ship-store/dashboard/metrics'];
    
  const { data: metrics, isLoading, error} = useQuery({
    queryKey,
    queryFn: async () => {
      const url = selectedAssetId
        ? `/api/ship-store/dashboard/metrics?assetId=${selectedAssetId}`
        : '/api/ship-store/dashboard/metrics';
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch metrics');
      return response.json();
    },
  });

  const { data: lowStockItems = [] } = useQuery({
    queryKey: ['/api/ship-store/inventory/low-stock', selectedAssetId],
    queryFn: async () => {
      const url = selectedAssetId
        ? `/api/ship-store/inventory/low-stock?assetId=${selectedAssetId}`
        : '/api/ship-store/inventory/low-stock';
      const response = await fetch(url);
      if (!response.ok) return getMockLowStockItems();
      return response.json();
    },
  });

  const { data: topSellingItems = [] } = useQuery({
    queryKey: ['/api/ship-store/products/top-selling', selectedAssetId],
    queryFn: async () => {
      const url = selectedAssetId
        ? `/api/ship-store/products/top-selling?assetId=${selectedAssetId}`
        : '/api/ship-store/products/top-selling';
      const response = await fetch(url);
      if (!response.ok) return getMockTopSellingItems();
      return response.json();
    },
  });

  const { data: salesByCategory = [] } = useQuery({
    queryKey: ['/api/ship-store/sales/by-category', selectedAssetId],
    queryFn: async () => {
      const url = selectedAssetId
        ? `/api/ship-store/sales/by-category?assetId=${selectedAssetId}`
        : '/api/ship-store/sales/by-category';
      const response = await fetch(url);
      if (!response.ok) return getMockCategorySales();
      return response.json();
    },
  });

  const { data: inventoryTurnover } = useQuery({
    queryKey: ['/api/ship-store/inventory/turnover', selectedAssetId],
    queryFn: async () => {
      const url = selectedAssetId
        ? `/api/ship-store/inventory/turnover?assetId=${selectedAssetId}`
        : '/api/ship-store/inventory/turnover';
      const response = await fetch(url);
      if (!response.ok) return getMockTurnoverData();
      return response.json();
    },
  });

  const { data: salesTrend = [] } = useQuery({
    queryKey: ['/api/ship-store/sales/trend', selectedAssetId],
    queryFn: async () => {
      const url = selectedAssetId
        ? `/api/ship-store/sales/trend?assetId=${selectedAssetId}`
        : '/api/ship-store/sales/trend';
      const response = await fetch(url);
      if (!response.ok) return getMockSalesTrend();
      return response.json();
    },
  });

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error Loading Dashboard</AlertTitle>
          <AlertDescription>
            Failed to load Ship Store dashboard data. Please try refreshing the page.
            <br />
            <span className="text-xs">Error: {error instanceof Error ? error.message : 'Unknown error'}</span>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const turnoverData = inventoryTurnover || getMockTurnoverData();

  return (
    <div className="min-h-screen bg-gray-50">
      <PageTour tourId={TOUR_IDS.SHIP_STORE} steps={shipStoreTourSteps} />
      
      <div className="px-8 pt-4">
        <SyncStatusBanner moduleName="ship-store" />
      </div>

      <div className="p-8 max-w-7xl mx-auto space-y-8">
        {/* Global Controls Bar */}
        <GlobalControlsBar
          selectedMarinaId={selectedMarinaId}
          onMarinaChange={(id) => setSelectedMarinaId(id === "all" ? null : id)}
          timeframe={selectedTimeframe}
          onTimeframeChange={setSelectedTimeframe}
        />

        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-gray-900" data-testid="page-title">
              Ship Store Dashboard
            </h1>
            <p className="text-gray-600" data-testid="page-description">
              Manage your marina ship store inventory, sales, and analytics
            </p>
          </div>
          <div className="flex items-center gap-2">
            {selectedMarinaId && (
              <Button 
                variant="outline" 
                onClick={() => setShowUseInValuator(true)}
                data-testid="button-use-in-valuator"
              >
                <Calculator className="mr-2 h-4 w-4" />
                Use in Financial Model
              </Button>
            )}
            <AssetSelector 
              value={selectedAssetId} 
              onChange={setSelectedAssetId}
              className="w-[280px]"
            />
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card data-testid="card-total-sales" data-tour="store-sales">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Sales</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="h-8 w-24 bg-gray-200 animate-pulse rounded"></div>
              ) : (
                <div className="text-2xl font-bold">
                  ${metrics?.totalRevenue?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
                </div>
              )}
              <p className="text-xs text-muted-foreground">This month</p>
            </CardContent>
          </Card>

          <Card data-testid="card-inventory-value" data-tour="store-inventory">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Inventory Value</CardTitle>
              <Box className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="h-8 w-24 bg-gray-200 animate-pulse rounded"></div>
              ) : (
                <div className="text-2xl font-bold">
                  ${metrics?.inventoryValue?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
                </div>
              )}
              <p className="text-xs text-muted-foreground">Current stock value</p>
            </CardContent>
          </Card>

          <Card data-testid="card-transactions">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Transactions</CardTitle>
              <CreditCard className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="h-8 w-16 bg-gray-200 animate-pulse rounded"></div>
              ) : (
                <div className="text-2xl font-bold">{metrics?.transactionCount || 0}</div>
              )}
              <p className="text-xs text-muted-foreground">This month</p>
            </CardContent>
          </Card>

          <Card data-testid="card-products">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Products</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="h-8 w-16 bg-gray-200 animate-pulse rounded"></div>
              ) : (
                <div className="text-2xl font-bold">{metrics?.activeProducts || 0}</div>
              )}
              <p className="text-xs text-muted-foreground">In catalog</p>
            </CardContent>
          </Card>
        </div>

        {/* Low Stock Alerts */}
        {lowStockItems.length > 0 && (
          <Card className="border-l-4 border-l-destructive" data-testid="low-stock-alerts">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                Low Stock Alerts
                <Badge variant="destructive">{lowStockItems.length}</Badge>
              </CardTitle>
              <CardDescription>Items that need to be restocked soon</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {lowStockItems.slice(0, 5).map((item: any, index: number) => (
                  <div key={item.id || index} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                    <div className="flex items-start space-x-3">
                      <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${item.currentStock <= 0 ? 'bg-red-500' : 'bg-yellow-500'}`}></div>
                      <div>
                        <p className="text-sm font-medium">{item.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.currentStock} in stock • Reorder at {item.reorderPoint}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={item.currentStock <= 0 ? "destructive" : "secondary"}>
                        {item.currentStock <= 0 ? 'Out of Stock' : 'Low Stock'}
                      </Badge>
                      <Button size="sm" variant="outline">Reorder</Button>
                    </div>
                  </div>
                ))}
              </div>
              {lowStockItems.length > 5 && (
                <Button variant="ghost" className="w-full mt-4">
                  View All {lowStockItems.length} Alerts
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {/* Sales Charts Row */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Sales Trend Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Sales Trend
              </CardTitle>
              <CardDescription>Daily sales over the last 30 days</CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="revenue" className="w-full">
                <TabsList className="grid w-full max-w-[200px] grid-cols-2">
                  <TabsTrigger value="revenue">Revenue</TabsTrigger>
                  <TabsTrigger value="transactions">Count</TabsTrigger>
                </TabsList>
                <TabsContent value="revenue" className="mt-4">
                  <div className="h-[250px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={salesTrend}>
                        <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                        <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `$${v}`} />
                        <Tooltip formatter={(value: number) => [`$${value.toLocaleString()}`, 'Revenue']} />
                        <Line type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </TabsContent>
                <TabsContent value="transactions" className="mt-4">
                  <div className="h-[250px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={salesTrend}>
                        <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                        <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 10 }} />
                        <Tooltip formatter={(value: number) => [value, 'Transactions']} />
                        <Bar dataKey="transactions" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          {/* Sales by Category */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Sales by Category
              </CardTitle>
              <CardDescription>Revenue distribution by product category</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={salesByCategory}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={5}
                      dataKey="revenue"
                      nameKey="category"
                      label={({ category, percent }) => `${category}: ${(percent * 100).toFixed(0)}%`}
                    >
                      {salesByCategory.map((_, index: number) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => `$${value.toLocaleString()}`} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Top Selling Items & Inventory Turnover */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Top Selling Items */}
          <Card data-testid="top-selling-items">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Star className="h-5 w-5 text-yellow-500" />
                Top Selling Items
              </CardTitle>
              <CardDescription>Best performing products this month</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {topSellingItems.slice(0, 5).map((item: any, index: number) => (
                  <div key={item.id || index} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                        {index + 1}
                      </span>
                      <div>
                        <p className="font-medium">{item.name}</p>
                        <p className="text-xs text-muted-foreground">{item.category}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">${item.revenue?.toLocaleString() || '0'}</p>
                      <p className="text-xs text-muted-foreground">{item.unitsSold} sold</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Inventory Turnover Metrics */}
          <Card data-testid="inventory-turnover">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <RotateCcw className="h-5 w-5" />
                Inventory Turnover
              </CardTitle>
              <CardDescription>Inventory efficiency metrics</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-4 rounded-lg bg-muted/30">
                  <p className="text-sm text-muted-foreground">Turnover Rate</p>
                  <p className="text-2xl font-bold">{turnoverData.turnoverRate?.toFixed(1) || '0'}x</p>
                  <p className="text-xs text-muted-foreground">Per year</p>
                </div>
                <div className="text-center p-4 rounded-lg bg-muted/30">
                  <p className="text-sm text-muted-foreground">Days of Inventory</p>
                  <p className="text-2xl font-bold">{turnoverData.daysOfInventory || '0'}</p>
                  <p className="text-xs text-muted-foreground">Average</p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span>Sell-Through Rate</span>
                  <span className="font-medium">{turnoverData.sellThroughRate || 0}%</span>
                </div>
                <Progress value={turnoverData.sellThroughRate || 0} className="h-2" />
              </div>

              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span>Stock Coverage</span>
                  <span className="font-medium">{turnoverData.stockCoverage || 0} weeks</span>
                </div>
                <Progress value={Math.min(100, (turnoverData.stockCoverage || 0) * 10)} className="h-2" />
              </div>

              <div className="pt-4 border-t">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Dead Stock Items</span>
                  <Badge variant={turnoverData.deadStockCount > 5 ? "destructive" : "secondary"}>
                    {turnoverData.deadStockCount || 0} items
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card data-testid="card-quick-actions" data-tour="store-pos">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5" />
                Quick Actions
              </CardTitle>
              <CardDescription>Common ship store operations</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button className="w-full justify-start" variant="outline">
                <CreditCard className="mr-2 h-4 w-4" /> New Sale
              </Button>
              <Button className="w-full justify-start" variant="outline">
                <Package className="mr-2 h-4 w-4" /> Add Inventory
              </Button>
              <Button className="w-full justify-start" variant="outline">
                <RefreshCw className="mr-2 h-4 w-4" /> Sync Products
              </Button>
            </CardContent>
          </Card>

          <Card data-testid="card-recent-activity">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Performance Summary
              </CardTitle>
              <CardDescription>This month vs last month</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm">Revenue</span>
                <div className="flex items-center gap-1 text-green-600">
                  <ArrowUpRight className="h-4 w-4" />
                  <span className="font-medium">+12.5%</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Transactions</span>
                <div className="flex items-center gap-1 text-green-600">
                  <ArrowUpRight className="h-4 w-4" />
                  <span className="font-medium">+8.3%</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Avg Order Value</span>
                <div className="flex items-center gap-1 text-red-600">
                  <ArrowDownRight className="h-4 w-4" />
                  <span className="font-medium">-2.1%</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <ContextIntegrationsPanel 
          contextKey="shipStore"
          title="Ship Store Integrations"
          description="Connect POS and inventory systems to sync data with MarinaMatch."
        />
      </div>

      {/* Use in Valuator Modal */}
      {selectedMarinaId && (
        <UseInValuatorModal
          open={showUseInValuator}
          onOpenChange={setShowUseInValuator}
          marinaId={selectedMarinaId}
          module="SHIP_STORE"
        />
      )}
    </div>
  );
}

function getMockLowStockItems() {
  return [
    { id: '1', name: 'Dock Line 3/8" x 15ft', currentStock: 3, reorderPoint: 10, category: 'Dock Supplies' },
    { id: '2', name: 'Marine Sunscreen SPF 50', currentStock: 5, reorderPoint: 15, category: 'Personal Care' },
    { id: '3', name: 'Boat Hook - 8ft Telescoping', currentStock: 0, reorderPoint: 5, category: 'Accessories' },
    { id: '4', name: 'Fender - White 6"x22"', currentStock: 2, reorderPoint: 8, category: 'Dock Supplies' },
  ];
}

function getMockTopSellingItems() {
  return [
    { id: '1', name: 'Premium Fuel Additive', category: 'Fuel & Lubricants', revenue: 2850, unitsSold: 95 },
    { id: '2', name: 'Dock Line Bundle', category: 'Dock Supplies', revenue: 2340, unitsSold: 78 },
    { id: '3', name: 'Marine Polish', category: 'Cleaning', revenue: 1890, unitsSold: 63 },
    { id: '4', name: 'Life Jacket - Adult', category: 'Safety', revenue: 1560, unitsSold: 26 },
    { id: '5', name: 'Boat Fenders Set', category: 'Dock Supplies', revenue: 1420, unitsSold: 32 },
  ];
}

function getMockCategorySales() {
  return [
    { category: 'Dock Supplies', revenue: 4500 },
    { category: 'Fuel & Lubricants', revenue: 3800 },
    { category: 'Cleaning', revenue: 2100 },
    { category: 'Safety', revenue: 1800 },
    { category: 'Apparel', revenue: 1200 },
    { category: 'Other', revenue: 800 },
  ];
}

function getMockTurnoverData() {
  return {
    turnoverRate: 4.2,
    daysOfInventory: 87,
    sellThroughRate: 68,
    stockCoverage: 6,
    deadStockCount: 3,
  };
}

function getMockSalesTrend() {
  const data = [];
  const today = new Date();
  for (let i = 29; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    data.push({
      date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      revenue: Math.floor(Math.random() * 800) + 200,
      transactions: Math.floor(Math.random() * 15) + 5,
    });
  }
  return data;
}
