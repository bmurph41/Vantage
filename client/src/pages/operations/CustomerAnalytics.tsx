import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, TrendingUp, DollarSign, Calendar, BarChart3 } from "lucide-react";

export default function CustomerAnalytics() {
  return (
    <div className="container mx-auto p-6 space-y-6" data-testid="page-customer-analytics">
      <div>
        <h1 className="text-3xl font-bold text-foreground mb-2" data-testid="heading-customer-analytics">
          Customer Analytics
        </h1>
        <p className="text-muted-foreground" data-testid="description-customer-analytics">
          Comprehensive analytics and insights about your marina customers, engagement patterns, and revenue metrics.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card data-testid="card-total-customers">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Customers</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">-</div>
            <p className="text-xs text-muted-foreground">Coming soon</p>
          </CardContent>
        </Card>

        <Card data-testid="card-active-customers">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Customers</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">-</div>
            <p className="text-xs text-muted-foreground">Coming soon</p>
          </CardContent>
        </Card>

        <Card data-testid="card-avg-revenue">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Revenue per Customer</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">-</div>
            <p className="text-xs text-muted-foreground">Coming soon</p>
          </CardContent>
        </Card>

        <Card data-testid="card-retention-rate">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Retention Rate</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">-</div>
            <p className="text-xs text-muted-foreground">Coming soon</p>
          </CardContent>
        </Card>
      </div>

      <Card data-testid="card-analytics-placeholder">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Analytics Dashboard
          </CardTitle>
          <CardDescription>
            Detailed customer analytics and reporting features
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center">
            <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">
              Customer Analytics Coming Soon
            </h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              This section will include customer segmentation, lifetime value analysis, 
              engagement metrics, purchase patterns, and predictive analytics to help 
              you better understand and serve your marina customers.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="p-4 bg-muted rounded-lg">
              <h4 className="font-medium mb-2">Planned Features:</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Customer segmentation by demographics and behavior</li>
                <li>• Lifetime value (LTV) calculations</li>
                <li>• Churn prediction and retention analysis</li>
                <li>• Revenue attribution by customer segment</li>
              </ul>
            </div>
            
            <div className="p-4 bg-muted rounded-lg">
              <h4 className="font-medium mb-2">Analytics Capabilities:</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Real-time dashboard with key metrics</li>
                <li>• Custom date range comparisons</li>
                <li>• Export to CSV/PDF for reporting</li>
                <li>• Automated insights and recommendations</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
