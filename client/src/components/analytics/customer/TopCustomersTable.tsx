import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trophy } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import type { TopCustomer } from "@/types/customer-analytics";
import { formatDistanceToNow } from "date-fns";

interface Props {
  data: TopCustomer[] | undefined;
  isLoading: boolean;
  error: Error | null;
}

export function TopCustomersTable({ data, isLoading, error }: Props) {
  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5" />
            Top Customers by Lifetime Value
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive" data-testid="alert-top-customers-error">
            <AlertDescription>
              Failed to load top customers: {error.message}
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
            <Trophy className="h-5 w-5" />
            Top Customers by Lifetime Value
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

  const formatName = (customer: TopCustomer) => {
    if (customer.firstName && customer.lastName) {
      return `${customer.firstName} ${customer.lastName}`;
    }
    return customer.email || 'Unnamed Customer';
  };

  const formatAccountType = (accountType: string) => {
    return accountType.charAt(0).toUpperCase() + accountType.slice(1);
  };

  return (
    <Card data-testid="card-top-customers">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="h-5 w-5" />
          Top Customers by Lifetime Value
        </CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No customer data available yet
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">#</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Account Type</TableHead>
                  <TableHead className="text-right">LTV</TableHead>
                  <TableHead className="text-right">Tenure</TableHead>
                  <TableHead className="text-right">Slips</TableHead>
                  <TableHead>Last Activity</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((customer, index) => (
                  <TableRow key={customer.customerId} data-testid={`row-customer-${customer.customerId}`}>
                    <TableCell className="font-medium text-muted-foreground">
                      {index + 1}
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{formatName(customer)}</div>
                        {customer.email && (
                          <div className="text-sm text-muted-foreground">{customer.email}</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center rounded-md bg-blue-50 dark:bg-blue-900/30 px-2 py-1 text-xs font-medium text-blue-700 dark:text-blue-300">
                        {formatAccountType(customer.accountType)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(customer.lifetimeValue)}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {customer.tenureMonths} mo
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {customer.slipCount}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {customer.lastActivityDate 
                        ? formatDistanceToNow(new Date(customer.lastActivityDate), { addSuffix: true })
                        : 'Never'}
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
