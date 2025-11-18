import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Badge } from "@/components/ui/badge";

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

export default function Analytics() {
  const [dateRange, setDateRange] = useState("30");
  const [selectedProduct, setSelectedProduct] = useState("");

  const { data: salesTrends, isLoading: trendsLoading } = useQuery({
    queryKey: ["/api/ship-store/analytics/sales-trends", dateRange],
  });

  const { data: topProducts, isLoading: topProductsLoading } = useQuery({
    queryKey: ["/api/ship-store/analytics/top-products", dateRange],
  });

  const { data: categoryRevenue, isLoading: categoryLoading } = useQuery({
    queryKey: ["/api/ship-store/analytics/category-revenue", dateRange],
  });

  const { data: productPerformance, isLoading: performanceLoading } = useQuery({
    queryKey: ["/api/ship-store/analytics/product-performance"],
  });

  const { data: products } = useQuery({
    queryKey: ["/api/ship-store/products"],
  });

  const { data: priceHistory, isLoading: priceHistoryLoading } = useQuery({
    queryKey: ["/api/ship-store/analytics/price-history", selectedProduct],
    enabled: !!selectedProduct,
  });

  const formatCurrency = (value: number) => `$${value.toFixed(2)}`;

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold" data-testid="analytics-title">Product Analytics</h2>
          <p className="text-muted-foreground">Sales trends, product performance, and pricing history</p>
        </div>
        <Select value={dateRange} onValueChange={setDateRange}>
          <SelectTrigger className="w-48" data-testid="date-range-filter">
            <SelectValue placeholder="Select date range" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Last 7 Days</SelectItem>
            <SelectItem value="30">Last 30 Days</SelectItem>
            <SelectItem value="90">Last 90 Days</SelectItem>
            <SelectItem value="365">Last Year</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Sales Trends Chart */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Sales Trends</CardTitle>
        </CardHeader>
        <CardContent>
          {trendsLoading ? (
            <div className="h-80 flex items-center justify-center text-muted-foreground">
              Loading sales trends...
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={salesTrends || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip formatter={(value: any) => formatCurrency(value)} />
                <Legend />
                <Line type="monotone" dataKey="revenue" stroke="#8884d8" name="Revenue" />
                <Line type="monotone" dataKey="transactions" stroke="#82ca9d" name="Transactions" />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Top Products Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Top Selling Products</CardTitle>
          </CardHeader>
          <CardContent>
            {topProductsLoading ? (
              <div className="h-80 flex items-center justify-center text-muted-foreground">
                Loading top products...
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={topProducts || []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                  <YAxis />
                  <Tooltip formatter={(value: any, name: string) => {
                    if (name === 'revenue') return formatCurrency(value);
                    return value;
                  }} />
                  <Legend />
                  <Bar dataKey="quantity" fill="#8884d8" name="Units Sold" />
                  <Bar dataKey="revenue" fill="#82ca9d" name="Revenue" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Revenue by Category Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Revenue by Category</CardTitle>
          </CardHeader>
          <CardContent>
            {categoryLoading ? (
              <div className="h-80 flex items-center justify-center text-muted-foreground">
                Loading category data...
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={categoryRevenue || []}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={(entry) => `${entry.name}: ${formatCurrency(entry.value)}`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {(categoryRevenue || []).map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: any) => formatCurrency(value)} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Price History */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Price History</CardTitle>
            <Select value={selectedProduct} onValueChange={setSelectedProduct}>
              <SelectTrigger className="w-64" data-testid="select-product">
                <SelectValue placeholder="Select a product" />
              </SelectTrigger>
              <SelectContent>
                {products?.map((product: any) => (
                  <SelectItem key={product.id} value={product.id}>
                    {product.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {!selectedProduct ? (
            <div className="h-60 flex items-center justify-center text-muted-foreground">
              Select a product to view price history
            </div>
          ) : priceHistoryLoading ? (
            <div className="h-60 flex items-center justify-center text-muted-foreground">
              Loading price history...
            </div>
          ) : (priceHistory && priceHistory.length > 0) ? (
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={priceHistory}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip formatter={(value: any) => formatCurrency(value)} />
                <Legend />
                <Line type="monotone" dataKey="price" stroke="#8884d8" name="Price" />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-60 flex items-center justify-center text-muted-foreground">
              No price history available for this product
            </div>
          )}
        </CardContent>
      </Card>

      {/* Product Performance Table */}
      <Card>
        <CardHeader>
          <CardTitle>Product Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left p-3 font-medium text-muted-foreground">Product</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Category</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Units Sold</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Revenue</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Avg Sale Price</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Stock Status</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Performance</th>
                </tr>
              </thead>
              <tbody>
                {performanceLoading ? (
                  <tr>
                    <td colSpan={7} className="p-4 text-center text-muted-foreground">
                      Loading product performance...
                    </td>
                  </tr>
                ) : !productPerformance || productPerformance.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-4 text-center text-muted-foreground">
                      No sales data available
                    </td>
                  </tr>
                ) : (
                  productPerformance.map((product: any) => {
                    const velocityStatus = 
                      product.unitsSold > 50 ? 'high' : 
                      product.unitsSold > 20 ? 'medium' : 'low';
                    
                    return (
                      <tr key={product.id} className="border-b border-border last:border-b-0" data-testid={`performance-row-${product.sku}`}>
                        <td className="p-3 font-medium">{product.name}</td>
                        <td className="p-3">{product.categoryName || "—"}</td>
                        <td className="p-3">{product.unitsSold || 0}</td>
                        <td className="p-3 font-medium">{formatCurrency(product.revenue || 0)}</td>
                        <td className="p-3">{formatCurrency(product.avgPrice || 0)}</td>
                        <td className="p-3">
                          <Badge variant={product.stock === 0 ? "destructive" : product.stock < 10 ? "secondary" : "default"}>
                            {product.stock === 0 ? "Out of Stock" : product.stock < 10 ? "Low Stock" : "In Stock"}
                          </Badge>
                        </td>
                        <td className="p-3">
                          <Badge variant={
                            velocityStatus === 'high' ? "default" : 
                            velocityStatus === 'medium' ? "secondary" : "outline"
                          }>
                            {velocityStatus === 'high' ? "Fast Moving" : 
                             velocityStatus === 'medium' ? "Moderate" : "Slow Moving"}
                          </Badge>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
