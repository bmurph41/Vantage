import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Users, TrendingUp, DollarSign, Calendar } from "lucide-react";
import type { CustomerOverview } from "@/types/customer-analytics";

interface Props {
  data: CustomerOverview | undefined;
  isLoading: boolean;
  error: Error | null;
}

export function CustomerOverviewCards({ data, isLoading, error }: Props) {
  if (error) {
    return (
      <Alert variant="destructive" data-testid="alert-overview-error">
        <AlertDescription>
          Failed to load overview metrics: {error.message}
        </AlertDescription>
      </Alert>
    );
  }

  if (isLoading || !data) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-4" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-7 w-16 mb-2" />
              <Skeleton className="h-3 w-20" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatPercent = (value: number) => {
    return `${value.toFixed(2)}%`;
  };

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card data-testid="card-total-customers">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Customers</CardTitle>
          <Users className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold" data-testid="value-total-customers">
            {data.totalCustomers.toLocaleString()}
          </div>
          <p className="text-xs text-muted-foreground">
            {data.activeCustomers} active, {data.prospectCustomers} prospects
          </p>
        </CardContent>
      </Card>

      <Card data-testid="card-active-customers">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Active Customers</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold" data-testid="value-active-customers">
            {data.activeCustomers.toLocaleString()}
          </div>
          <p className="text-xs text-muted-foreground">
            {data.churnedCustomers} churned
          </p>
        </CardContent>
      </Card>

      <Card data-testid="card-avg-ltv">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Avg Lifetime Value</CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold" data-testid="value-avg-ltv">
            {formatCurrency(data.avgLifetimeValue)}
          </div>
          <p className="text-xs text-muted-foreground">
            Avg tenure: {Math.round(data.avgTenure)} months
          </p>
        </CardContent>
      </Card>

      <Card data-testid="card-retention-rate">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Retention Rate</CardTitle>
          <Calendar className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold" data-testid="value-retention-rate">
            {formatPercent(data.retentionRate)}
          </div>
          <p className="text-xs text-muted-foreground">
            Churn rate: {formatPercent(data.churnRate)}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
