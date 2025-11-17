import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LayoutDashboard, Box, CreditCard, BarChart3, DollarSign, Package, TrendingUp, ShoppingCart, AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function ShipStoreDashboard() {
  const [shipStoreToken, setShipStoreToken] = useState<string | null>(null);

  // Fetch Ship Store authentication token
  const { data: tokenData, error: tokenError } = useQuery({
    queryKey: ['/api/ship-store-token'],
  });

  useEffect(() => {
    if (tokenData?.token) {
      setShipStoreToken(tokenData.token);
    }
  }, [tokenData]);

  // Fetch Ship Store dashboard metrics
  const { data: metrics, isLoading, error } = useQuery({
    queryKey: ['/api/ship-store/dashboard/metrics'],
    enabled: !!shipStoreToken,
  });

  if (tokenError) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Authentication Error</AlertTitle>
          <AlertDescription>
            Failed to authenticate with Ship Store. Please try refreshing the page.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Ship Store Unavailable</AlertTitle>
          <AlertDescription>
            The Ship Store service is currently unavailable. Please ensure the Ship Store service is running on port 5001.
            <br />
            <span className="text-xs">Error: {error instanceof Error ? error.message : 'Unknown error'}</span>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="p-8 max-w-7xl mx-auto space-y-8">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-gray-900" data-testid="page-title">
            Ship Store Dashboard
          </h1>
          <p className="text-gray-600" data-testid="page-description">
            Manage your marina ship store inventory, sales, and analytics
          </p>
        </div>

        {/* Key Metrics */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card data-testid="card-total-sales">
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

          <Card data-testid="card-inventory-value">
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

        {/* Quick Actions */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card data-testid="card-quick-actions">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5" />
                Integration Status
              </CardTitle>
              <CardDescription>Ship Store service connection</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {!shipStoreToken ? (
                <div className="flex items-center gap-2 text-amber-600">
                  <AlertCircle className="h-4 w-4" />
                  <span className="text-sm">Connecting to Ship Store...</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-green-600">
                  <div className="h-2 w-2 bg-green-600 rounded-full"></div>
                  <span className="text-sm font-medium">Connected to Ship Store API</span>
                </div>
              )}
              <p className="text-xs text-gray-500 mt-2">
                Ship Store is running as a microservice on port 5001 with full audit trail and RBAC support.
              </p>
            </CardContent>
          </Card>

          <Card data-testid="card-recent-activity">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Recent Activity
              </CardTitle>
              <CardDescription>Latest ship store transactions</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-2">
                  <div className="h-4 w-full bg-gray-200 animate-pulse rounded"></div>
                  <div className="h-4 w-3/4 bg-gray-200 animate-pulse rounded"></div>
                </div>
              ) : (
                <p className="text-sm text-gray-500">
                  {metrics?.transactionCount ? `${metrics.transactionCount} transactions recorded` : 'No recent activity'}
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
