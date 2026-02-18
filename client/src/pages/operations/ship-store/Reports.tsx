import { useState, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { AssetSelector } from "@/components/AssetSelector";
import { ExportPdfButton } from "@/components/ui/export-pdf-button";
import type { ShipStoreTransaction, ShipStoreProduct, ShipStoreCategory } from "@shared/schema";
import {
  FileText,
  Download,
  Filter,
  DollarSign,
  TrendingUp,
  Package,
  ShoppingCart,
  Users,
  CreditCard,
  FileBarChart,
  Receipt,
  BarChart3,
  PieChart,
  Calendar
} from "lucide-react";

export default function ShipStoreReports() {
  const reportRef = useRef<HTMLDivElement>(null);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState("30");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Fetch transactions
  const transactionsKey = selectedAssetId
    ? ['/api/ship-store/transactions', selectedAssetId]
    : ['/api/ship-store/transactions'];

  const { data: transactions = [], isLoading: transactionsLoading } = useQuery<ShipStoreTransaction[]>({
    queryKey: transactionsKey,
    queryFn: async () => {
      const url = selectedAssetId
        ? `/api/ship-store/transactions?assetId=${selectedAssetId}`
        : '/api/ship-store/transactions';
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch transactions');
      return response.json();
    },
  });

  // Fetch products
  const productsKey = selectedAssetId
    ? ['/api/ship-store/products', selectedAssetId]
    : ['/api/ship-store/products'];

  const { data: products = [] } = useQuery<ShipStoreProduct[]>({
    queryKey: productsKey,
    queryFn: async () => {
      const url = selectedAssetId
        ? `/api/ship-store/products?assetId=${selectedAssetId}`
        : '/api/ship-store/products';
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch products');
      return response.json();
    },
  });

  // Fetch categories
  const categoriesKey = selectedAssetId
    ? ['/api/ship-store/categories', selectedAssetId]
    : ['/api/ship-store/categories'];

  const { data: categories = [] } = useQuery<ShipStoreCategory[]>({
    queryKey: categoriesKey,
    queryFn: async () => {
      const url = selectedAssetId
        ? `/api/ship-store/categories?assetId=${selectedAssetId}`
        : '/api/ship-store/categories';
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch categories');
      return response.json();
    },
  });

  // Calculate date range bounds using EST timezone with 5:00 PM cutoff
  const getDateRangeBounds = () => {
    // Get current time in EST
    const now = new Date();
    const estOffset = -5 * 60; // EST is UTC-5
    const utcTime = now.getTime() + (now.getTimezoneOffset() * 60000);
    const estTime = new Date(utcTime + (estOffset * 60000));
    
    let start: Date;
    let end: Date;

    if (dateRange === "custom") {
      if (!startDate || !endDate) return null;
      // Custom range: start at 5:00 PM previous day, end at 5:00 PM on selected end date
      start = new Date(startDate + "T17:00:00-05:00");
      end = new Date(endDate + "T17:00:00-05:00");
      if (start > end) return null;
    } else if (dateRange === "all") {
      return null;
    } else {
      const days = parseInt(dateRange);
      // End at 5:00 PM today EST
      end = new Date(estTime);
      end.setHours(17, 0, 0, 0);
      
      // Start N days before at 5:00 PM EST
      start = new Date(end);
      start.setDate(start.getDate() - days);
    }

    return { start, end };
  };

  const dateRangeBounds = getDateRangeBounds();

  // Filter transactions by date
  const filteredTransactions = useMemo(() => {
    return transactions.filter(tx => {
      if (!dateRangeBounds) return true;
      const txDate = new Date(tx.createdAt);
      return txDate >= dateRangeBounds.start && txDate <= dateRangeBounds.end;
    });
  }, [transactions, dateRangeBounds]);

  // ===== PROFIT & LOSS CALCULATIONS =====
  const profitLossData = useMemo(() => {
    const revenue = filteredTransactions.reduce((sum, tx) => sum + parseFloat(tx.total), 0);
    const taxCollected = filteredTransactions.reduce((sum, tx) => sum + parseFloat(tx.tax), 0);
    const netRevenue = revenue - taxCollected;

    let cogs = 0;
    filteredTransactions.forEach(tx => {
      if (tx.items && Array.isArray(tx.items)) {
        tx.items.forEach((item: any) => {
          if (item.productId) {
            const product = products.find(p => p.id === item.productId);
            if (product) {
              cogs += product.cost * item.quantity;
            }
          }
        });
      }
    });

    const grossProfit = netRevenue - cogs;
    const grossMargin = netRevenue > 0 ? (grossProfit / netRevenue) * 100 : 0;

    return {
      totalRevenue: revenue,
      taxCollected,
      netRevenue,
      cogs,
      grossProfit,
      grossMargin,
      transactionCount: filteredTransactions.length,
    };
  }, [filteredTransactions, products]);

  // ===== SALES BY PRODUCT =====
  const salesByProduct = useMemo(() => {
    const productSales = new Map<string, { name: string; quantity: number; revenue: number; cost: number; profit: number }>();

    filteredTransactions.forEach(tx => {
      if (tx.items && Array.isArray(tx.items)) {
        tx.items.forEach((item: any) => {
          const existing = productSales.get(item.productId) || { 
            name: item.name, 
            quantity: 0, 
            revenue: 0, 
            cost: 0, 
            profit: 0 
          };
          
          const product = products.find(p => p.id === item.productId);
          const itemCost = product ? product.cost * item.quantity : 0;
          const itemRevenue = item.price * item.quantity;

          productSales.set(item.productId, {
            name: item.name,
            quantity: existing.quantity + item.quantity,
            revenue: existing.revenue + itemRevenue,
            cost: existing.cost + itemCost,
            profit: existing.profit + (itemRevenue - itemCost),
          });
        });
      }
    });

    return Array.from(productSales.values())
      .sort((a, b) => b.revenue - a.revenue);
  }, [filteredTransactions, products]);

  // ===== SALES BY CATEGORY =====
  const salesByCategory = useMemo(() => {
    const categorySales = new Map<string, { name: string; revenue: number; quantity: number }>();

    filteredTransactions.forEach(tx => {
      if (tx.items && Array.isArray(tx.items)) {
        tx.items.forEach((item: any) => {
          const product = products.find(p => p.id === item.productId);
          const category = product ? categories.find(c => c.id === product.categoryId) : null;
          const categoryName = category?.name || 'Uncategorized';

          const existing = categorySales.get(categoryName) || { name: categoryName, revenue: 0, quantity: 0 };
          categorySales.set(categoryName, {
            name: categoryName,
            revenue: existing.revenue + (item.price * item.quantity),
            quantity: existing.quantity + item.quantity,
          });
        });
      }
    });

    return Array.from(categorySales.values())
      .sort((a, b) => b.revenue - a.revenue);
  }, [filteredTransactions, products, categories]);

  // ===== SALES BY PAYMENT METHOD =====
  const salesByPaymentMethod = useMemo(() => {
    const paymentSales = new Map<string, { method: string; count: number; revenue: number }>();

    filteredTransactions.forEach(tx => {
      const method = tx.paymentMethod || 'Unknown';
      const existing = paymentSales.get(method) || { method, count: 0, revenue: 0 };
      paymentSales.set(method, {
        method,
        count: existing.count + 1,
        revenue: existing.revenue + parseFloat(tx.total),
      });
    });

    return Array.from(paymentSales.values())
      .sort((a, b) => b.revenue - a.revenue);
  }, [filteredTransactions]);

  // ===== INVENTORY VALUATION =====
  const inventoryValuation = useMemo(() => {
    const totalValue = products.reduce((sum, p) => {
      return sum + (p.stock * p.cost);
    }, 0);

    const totalRetailValue = products.reduce((sum, p) => {
      return sum + (p.stock * p.price);
    }, 0);

    const totalUnits = products.reduce((sum, p) => sum + p.stock, 0);

    return {
      costValue: totalValue,
      retailValue: totalRetailValue,
      potentialProfit: totalRetailValue - totalValue,
      totalUnits,
      productCount: products.filter(p => p.isActive).length,
      lowStockCount: products.filter(p => p.isActive && p.stock < 10).length,
    };
  }, [products]);

  // ===== CUSTOMER ANALYSIS =====
  const customerAnalysis = useMemo(() => {
    const customerData = new Map<string, { name: string; type: string; transactions: number; revenue: number }>();

    filteredTransactions.forEach(tx => {
      if (tx.customerId) {
        const key = tx.customerId;
        const existing = customerData.get(key) || {
          name: tx.customerName || 'Unknown',
          type: tx.customerType || 'Unknown',
          transactions: 0,
          revenue: 0,
        };

        customerData.set(key, {
          ...existing,
          transactions: existing.transactions + 1,
          revenue: existing.revenue + parseFloat(tx.total),
        });
      }
    });

    return Array.from(customerData.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 20);
  }, [filteredTransactions]);

  // ===== EXPORT FUNCTIONS =====
  const exportToCSV = (data: any[], filename: string) => {
    if (data.length === 0) return;

    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(','),
      ...data.map(row => headers.map(header => JSON.stringify(row[header] || '')).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  };

  const formatPercent = (value: number) => {
    return `${value.toFixed(2)}%`;
  };

  return (
    <div ref={reportRef} className="min-h-screen bg-gray-50">
      <Header
        title="Ship Store Reports"
        subtitle="Financial reports and analytics"
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 flex justify-end">
        <ExportPdfButton contentRef={reportRef} filename="ship-store-reports" title="Ship Store Reports" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Filters */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="flex items-center gap-2">
                <Filter className="h-5 w-5 text-gray-500" />
                <CardTitle>Report Filters</CardTitle>
              </div>
              <AssetSelector
                selectedAssetId={selectedAssetId}
                onAssetChange={setSelectedAssetId}
              />
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Select value={dateRange} onValueChange={setDateRange}>
                <SelectTrigger data-testid="select-date-range">
                  <SelectValue placeholder="Select date range" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">Last 7 Days</SelectItem>
                  <SelectItem value="30">Last 30 Days</SelectItem>
                  <SelectItem value="90">Last 90 Days</SelectItem>
                  <SelectItem value="365">Last Year</SelectItem>
                  <SelectItem value="all">All Time</SelectItem>
                  <SelectItem value="custom">Custom Range</SelectItem>
                </SelectContent>
              </Select>

              {dateRange === "custom" && (
                <>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    data-testid="input-start-date"
                  />
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    data-testid="input-end-date"
                  />
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Reports Tabs */}
        <Tabs defaultValue="pl" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3 lg:grid-cols-7">
            <TabsTrigger value="pl" data-testid="tab-profit-loss">
              <FileBarChart className="h-4 w-4 mr-2" />
              P&L
            </TabsTrigger>
            <TabsTrigger value="sales" data-testid="tab-sales">
              <BarChart3 className="h-4 w-4 mr-2" />
              Sales
            </TabsTrigger>
            <TabsTrigger value="products" data-testid="tab-products">
              <Package className="h-4 w-4 mr-2" />
              Products
            </TabsTrigger>
            <TabsTrigger value="categories" data-testid="tab-categories">
              <PieChart className="h-4 w-4 mr-2" />
              Categories
            </TabsTrigger>
            <TabsTrigger value="payments" data-testid="tab-payments">
              <CreditCard className="h-4 w-4 mr-2" />
              Payments
            </TabsTrigger>
            <TabsTrigger value="inventory" data-testid="tab-inventory">
              <ShoppingCart className="h-4 w-4 mr-2" />
              Inventory
            </TabsTrigger>
            <TabsTrigger value="customers" data-testid="tab-customers">
              <Users className="h-4 w-4 mr-2" />
              Customers
            </TabsTrigger>
          </TabsList>

          {/* PROFIT & LOSS REPORT */}
          <TabsContent value="pl">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <FileBarChart className="h-5 w-5" />
                    Profit & Loss Statement (Income Statement)
                  </CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    Revenue, costs, and profitability analysis
                  </p>
                </div>
                <Button
                  variant="outline"
                  onClick={() => exportToCSV([profitLossData], 'profit-loss.csv')}
                  data-testid="button-export-pl"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export CSV
                </Button>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {/* Revenue Section */}
                  <div>
                    <h3 className="font-semibold text-lg mb-3">Revenue</h3>
                    <div className="space-y-2 bg-gray-50 p-4 rounded-lg">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Gross Sales</span>
                        <span className="font-mono font-semibold">{formatCurrency(profitLossData.totalRevenue)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Less: Sales Tax</span>
                        <span className="font-mono text-red-600">({formatCurrency(profitLossData.taxCollected)})</span>
                      </div>
                      <Separator />
                      <div className="flex justify-between">
                        <span className="font-semibold">Net Revenue</span>
                        <span className="font-mono font-bold text-lg">{formatCurrency(profitLossData.netRevenue)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Cost of Goods Sold */}
                  <div>
                    <h3 className="font-semibold text-lg mb-3">Cost of Goods Sold (COGS)</h3>
                    <div className="space-y-2 bg-gray-50 p-4 rounded-lg">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Total COGS</span>
                        <span className="font-mono text-red-600">({formatCurrency(profitLossData.cogs)})</span>
                      </div>
                    </div>
                  </div>

                  {/* Gross Profit */}
                  <div>
                    <h3 className="font-semibold text-lg mb-3">Gross Profit</h3>
                    <div className="space-y-2 bg-emerald-50 p-4 rounded-lg border-2 border-emerald-200">
                      <div className="flex justify-between items-center">
                        <span className="font-semibold">Gross Profit</span>
                        <span className="font-mono font-bold text-xl text-emerald-700">
                          {formatCurrency(profitLossData.grossProfit)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Gross Margin</span>
                        <span className="font-mono text-emerald-700 font-semibold">
                          {formatPercent(profitLossData.grossMargin)}
                        </span>
                      </div>
                      <Separator />
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Transactions</span>
                        <span className="font-mono">{profitLossData.transactionCount}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Average Transaction</span>
                        <span className="font-mono">
                          {formatCurrency(profitLossData.transactionCount > 0 ? profitLossData.totalRevenue / profitLossData.transactionCount : 0)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Key Metrics */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
                    <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                      <div className="text-sm text-gray-600 mb-1">Revenue per Transaction</div>
                      <div className="text-2xl font-bold text-blue-700">
                        {formatCurrency(profitLossData.transactionCount > 0 ? profitLossData.netRevenue / profitLossData.transactionCount : 0)}
                      </div>
                    </div>
                    <div className="bg-amber-50 p-4 rounded-lg border border-amber-200">
                      <div className="text-sm text-gray-600 mb-1">COGS Ratio</div>
                      <div className="text-2xl font-bold text-amber-700">
                        {formatPercent(profitLossData.netRevenue > 0 ? (profitLossData.cogs / profitLossData.netRevenue) * 100 : 0)}
                      </div>
                    </div>
                    <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                      <div className="text-sm text-gray-600 mb-1">Sales Tax Collected</div>
                      <div className="text-2xl font-bold text-purple-700">
                        {formatCurrency(profitLossData.taxCollected)}
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* SALES SUMMARY REPORT */}
          <TabsContent value="sales">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    Sales Summary
                  </CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    Detailed sales performance metrics
                  </p>
                </div>
                <Button
                  variant="outline"
                  onClick={() => exportToCSV(filteredTransactions.map(tx => ({
                    date: new Date(tx.createdAt).toLocaleDateString(),
                    total: tx.total,
                    subtotal: tx.subtotal,
                    tax: tx.tax,
                    paymentMethod: tx.paymentMethod,
                    customer: tx.customerName || 'Walk-in',
                  })), 'sales-summary.csv')}
                  data-testid="button-export-sales"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export CSV
                </Button>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                  <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-lg border border-blue-200">
                    <div className="text-sm text-gray-600 mb-1">Total Revenue</div>
                    <div className="text-2xl font-bold text-blue-700">{formatCurrency(profitLossData.totalRevenue)}</div>
                  </div>
                  <div className="bg-gradient-to-br from-green-50 to-green-100 p-4 rounded-lg border border-green-200">
                    <div className="text-sm text-gray-600 mb-1">Transactions</div>
                    <div className="text-2xl font-bold text-green-700">{profitLossData.transactionCount}</div>
                  </div>
                  <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-4 rounded-lg border border-purple-200">
                    <div className="text-sm text-gray-600 mb-1">Avg Transaction</div>
                    <div className="text-2xl font-bold text-purple-700">
                      {formatCurrency(profitLossData.transactionCount > 0 ? profitLossData.totalRevenue / profitLossData.transactionCount : 0)}
                    </div>
                  </div>
                  <div className="bg-gradient-to-br from-amber-50 to-amber-100 p-4 rounded-lg border border-amber-200">
                    <div className="text-sm text-gray-600 mb-1">Tax Collected</div>
                    <div className="text-2xl font-bold text-amber-700">{formatCurrency(profitLossData.taxCollected)}</div>
                  </div>
                </div>

                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="font-semibold mb-3">Recent Transactions</h3>
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {filteredTransactions.slice(0, 50).map((tx) => (
                      <div key={tx.id} className="flex items-center justify-between p-3 bg-white rounded border">
                        <div>
                          <div className="font-medium">{new Date(tx.createdAt).toLocaleString()}</div>
                          <div className="text-sm text-gray-600">
                            {tx.customerName || 'Walk-in'} • {tx.paymentMethod}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold">{formatCurrency(parseFloat(tx.total))}</div>
                          <div className="text-sm text-gray-600">Tax: {formatCurrency(parseFloat(tx.tax))}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* SALES BY PRODUCT REPORT */}
          <TabsContent value="products">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Package className="h-5 w-5" />
                    Sales by Product
                  </CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    Product performance and profitability
                  </p>
                </div>
                <Button
                  variant="outline"
                  onClick={() => exportToCSV(salesByProduct, 'sales-by-product.csv')}
                  data-testid="button-export-products"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export CSV
                </Button>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b-2">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-semibold">Product</th>
                        <th className="px-4 py-3 text-right text-sm font-semibold">Quantity Sold</th>
                        <th className="px-4 py-3 text-right text-sm font-semibold">Revenue</th>
                        <th className="px-4 py-3 text-right text-sm font-semibold">Cost</th>
                        <th className="px-4 py-3 text-right text-sm font-semibold">Gross Profit</th>
                        <th className="px-4 py-3 text-right text-sm font-semibold">Margin %</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {salesByProduct.map((item, idx) => (
                        <tr key={idx} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium">{item.name}</td>
                          <td className="px-4 py-3 text-right font-mono">{item.quantity}</td>
                          <td className="px-4 py-3 text-right font-mono">{formatCurrency(item.revenue)}</td>
                          <td className="px-4 py-3 text-right font-mono text-red-600">{formatCurrency(item.cost)}</td>
                          <td className="px-4 py-3 text-right font-mono text-green-600 font-semibold">
                            {formatCurrency(item.profit)}
                          </td>
                          <td className="px-4 py-3 text-right font-mono">
                            {formatPercent(item.revenue > 0 ? (item.profit / item.revenue) * 100 : 0)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* SALES BY CATEGORY REPORT */}
          <TabsContent value="categories">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <PieChart className="h-5 w-5" />
                    Sales by Category
                  </CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    Category performance breakdown
                  </p>
                </div>
                <Button
                  variant="outline"
                  onClick={() => exportToCSV(salesByCategory, 'sales-by-category.csv')}
                  data-testid="button-export-categories"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export CSV
                </Button>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {salesByCategory.map((cat, idx) => {
                    const percentage = profitLossData.totalRevenue > 0 
                      ? (cat.revenue / profitLossData.totalRevenue) * 100 
                      : 0;
                    return (
                      <div key={idx} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <h3 className="font-semibold">{cat.name}</h3>
                            <p className="text-sm text-gray-600">{cat.quantity} units sold</p>
                          </div>
                          <div className="text-right">
                            <div className="text-lg font-bold">{formatCurrency(cat.revenue)}</div>
                            <div className="text-sm text-gray-600">{formatPercent(percentage)} of total</div>
                          </div>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-blue-600 h-2 rounded-full transition-all"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* SALES BY PAYMENT METHOD REPORT */}
          <TabsContent value="payments">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5" />
                    Sales by Payment Method
                  </CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    Payment method breakdown and analysis
                  </p>
                </div>
                <Button
                  variant="outline"
                  onClick={() => exportToCSV(salesByPaymentMethod, 'sales-by-payment-method.csv')}
                  data-testid="button-export-payments"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export CSV
                </Button>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {salesByPaymentMethod.map((pm, idx) => {
                    const percentage = profitLossData.totalRevenue > 0 
                      ? (pm.revenue / profitLossData.totalRevenue) * 100 
                      : 0;
                    return (
                      <div key={idx} className="border rounded-lg p-6 bg-gradient-to-br from-gray-50 to-white">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <div className="p-3 bg-blue-100 rounded-full">
                              <CreditCard className="h-6 w-6 text-blue-600" />
                            </div>
                            <div>
                              <h3 className="font-semibold text-lg">{pm.method}</h3>
                              <p className="text-sm text-gray-600">{pm.count} transactions</p>
                            </div>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <span className="text-gray-600">Total Revenue</span>
                            <span className="font-bold text-lg">{formatCurrency(pm.revenue)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Avg Transaction</span>
                            <span className="font-mono">{formatCurrency(pm.revenue / pm.count)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">% of Total</span>
                            <span className="font-mono">{formatPercent(percentage)}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* INVENTORY VALUATION REPORT */}
          <TabsContent value="inventory">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <ShoppingCart className="h-5 w-5" />
                    Inventory Valuation Report
                  </CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    Current inventory value and stock analysis
                  </p>
                </div>
                <Button
                  variant="outline"
                  onClick={() => exportToCSV(products.map(p => ({
                    name: p.name,
                    sku: p.sku,
                    stock: p.stock,
                    cost: p.cost,
                    price: p.price,
                    totalCost: p.stock * p.cost,
                    totalRetail: p.stock * p.price,
                  })), 'inventory-valuation.csv')}
                  data-testid="button-export-inventory"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export CSV
                </Button>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 p-6 rounded-lg border-2 border-emerald-200">
                    <div className="text-sm text-gray-600 mb-1">Total Cost Value</div>
                    <div className="text-3xl font-bold text-emerald-700">
                      {formatCurrency(inventoryValuation.costValue)}
                    </div>
                    <div className="text-sm text-gray-600 mt-2">{inventoryValuation.totalUnits} units</div>
                  </div>
                  <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-lg border-2 border-blue-200">
                    <div className="text-sm text-gray-600 mb-1">Total Retail Value</div>
                    <div className="text-3xl font-bold text-blue-700">
                      {formatCurrency(inventoryValuation.retailValue)}
                    </div>
                    <div className="text-sm text-gray-600 mt-2">{inventoryValuation.productCount} active products</div>
                  </div>
                  <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-6 rounded-lg border-2 border-purple-200">
                    <div className="text-sm text-gray-600 mb-1">Potential Profit</div>
                    <div className="text-3xl font-bold text-purple-700">
                      {formatCurrency(inventoryValuation.potentialProfit)}
                    </div>
                    <div className="text-sm text-gray-600 mt-2">
                      {inventoryValuation.lowStockCount} low stock items
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="font-semibold mb-3">Inventory Details</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-white border-b-2">
                        <tr>
                          <th className="px-4 py-3 text-left text-sm font-semibold">Product</th>
                          <th className="px-4 py-3 text-left text-sm font-semibold">SKU</th>
                          <th className="px-4 py-3 text-right text-sm font-semibold">Stock</th>
                          <th className="px-4 py-3 text-right text-sm font-semibold">Cost</th>
                          <th className="px-4 py-3 text-right text-sm font-semibold">Retail</th>
                          <th className="px-4 py-3 text-right text-sm font-semibold">Total Cost</th>
                          <th className="px-4 py-3 text-right text-sm font-semibold">Total Retail</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {products.filter(p => p.isActive).map((product) => (
                          <tr key={product.id} className="hover:bg-white">
                            <td className="px-4 py-3 font-medium">{product.name}</td>
                            <td className="px-4 py-3 text-gray-600">{product.sku || 'N/A'}</td>
                            <td className="px-4 py-3 text-right font-mono">
                              <span className={product.stock < 10 ? 'text-red-600 font-semibold' : ''}>
                                {product.stock}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right font-mono">{formatCurrency(product.cost)}</td>
                            <td className="px-4 py-3 text-right font-mono">{formatCurrency(product.price)}</td>
                            <td className="px-4 py-3 text-right font-mono text-red-600">
                              {formatCurrency(product.stock * product.cost)}
                            </td>
                            <td className="px-4 py-3 text-right font-mono text-green-600 font-semibold">
                              {formatCurrency(product.stock * product.price)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* CUSTOMER ANALYSIS REPORT */}
          <TabsContent value="customers">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Top Customers Report
                  </CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    Customer purchase analysis and trends
                  </p>
                </div>
                <Button
                  variant="outline"
                  onClick={() => exportToCSV(customerAnalysis, 'customer-analysis.csv')}
                  data-testid="button-export-customers"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export CSV
                </Button>
              </CardHeader>
              <CardContent>
                {customerAnalysis.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No customer data available for selected period</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {customerAnalysis.map((customer, idx) => (
                      <div key={idx} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                              <span className="text-lg font-bold text-blue-600">{idx + 1}</span>
                            </div>
                            <div>
                              <h3 className="font-semibold">{customer.name}</h3>
                              <p className="text-sm text-gray-600">{customer.type}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-xl font-bold text-blue-600">
                              {formatCurrency(customer.revenue)}
                            </div>
                            <div className="text-sm text-gray-600">
                              {customer.transactions} transaction{customer.transactions !== 1 ? 's' : ''}
                            </div>
                            <div className="text-sm text-gray-500">
                              Avg: {formatCurrency(customer.revenue / customer.transactions)}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
