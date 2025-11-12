import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle } from "lucide-react";
import type { ChurnRiskCustomer } from "@/types/customer-analytics";

interface Props {
  data: ChurnRiskCustomer[] | undefined;
  isLoading: boolean;
  error: Error | null;
}

export function ChurnRiskTable({ data, isLoading, error }: Props) {
  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Churn Risk Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive" data-testid="alert-churn-risk-error">
            <AlertDescription>
              Failed to load churn risk analysis: {error.message}
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  if (isLoading || !data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Churn Risk Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
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

  const formatName = (customer: ChurnRiskCustomer) => {
    if (customer.firstName && customer.lastName) {
      return `${customer.firstName} ${customer.lastName}`;
    }
    return customer.email || 'Unnamed Customer';
  };

  const getRiskBadge = (riskLevel: 'high' | 'medium' | 'low') => {
    const variants = {
      high: 'destructive' as const,
      medium: 'default' as const,
      low: 'secondary' as const,
    };
    return (
      <Badge variant={variants[riskLevel]} data-testid={`badge-risk-${riskLevel}`}>
        {riskLevel.toUpperCase()}
      </Badge>
    );
  };

  return (
    <Card data-testid="card-churn-risk">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5" />
          Churn Risk Analysis
        </CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-green-600 dark:text-green-400 font-medium mb-2">
              ✓ All customers engaged recently
            </div>
            <div className="text-sm text-muted-foreground">
              No customers at churn risk (90+ days inactive)
            </div>
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Risk Level</TableHead>
                  <TableHead className="text-right">Days Inactive</TableHead>
                  <TableHead className="text-right">Lifetime Value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((customer) => (
                  <TableRow key={customer.customerId} data-testid={`row-churn-${customer.customerId}`}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{formatName(customer)}</div>
                        {customer.email && (
                          <div className="text-sm text-muted-foreground">{customer.email}</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {getRiskBadge(customer.riskLevel)}
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={customer.riskLevel === 'high' ? 'text-red-600 dark:text-red-400 font-medium' : ''}>
                        {customer.daysSinceLastActivity} days
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(customer.lifetimeValue)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
