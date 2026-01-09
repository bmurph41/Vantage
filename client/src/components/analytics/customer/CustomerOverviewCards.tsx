import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Users, TrendingUp, DollarSign, Calendar, UserPlus, UserMinus, ArrowUpDown } from "lucide-react";
import { formatCurrency, formatPercent } from "@/lib/utils";
import type { CustomerOverview } from "@/types/customer-analytics";

interface Props {
  data: CustomerOverview | undefined;
  isLoading: boolean;
  error: Error | null;
  periodLabel?: string;
}

export function CustomerOverviewCards({ data, isLoading, error, periodLabel }: Props) {
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

      {data.moveIns !== undefined && (
        <Card data-testid="card-move-ins">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Move-Ins</CardTitle>
            <UserPlus className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600" data-testid="value-move-ins">
              {data.moveIns.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {periodLabel || "Selected period"}
            </p>
          </CardContent>
        </Card>
      )}

      {data.moveOuts !== undefined && (
        <Card data-testid="card-move-outs">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Move-Outs</CardTitle>
            <UserMinus className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600" data-testid="value-move-outs">
              {data.moveOuts.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {periodLabel || "Selected period"}
            </p>
          </CardContent>
        </Card>
      )}

      {data.netChange !== undefined && (
        <Card data-testid="card-net-change">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Net Change</CardTitle>
            <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div 
              className={`text-2xl font-bold ${data.netChange >= 0 ? 'text-green-600' : 'text-red-600'}`} 
              data-testid="value-net-change"
            >
              {data.netChange >= 0 ? '+' : ''}{data.netChange.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {periodLabel || "Selected period"}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
