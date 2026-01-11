import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { LeaseCashFlowMatrixResponse } from "../lib/rentRollApi";

interface LeaseCashFlowMatrixProps {
  data: LeaseCashFlowMatrixResponse | undefined;
  isLoading: boolean;
  isError: boolean;
}

export default function LeaseCashFlowMatrix({ data, isLoading, isError }: LeaseCashFlowMatrixProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-96 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (isError || !data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-destructive">Error</CardTitle>
          <CardDescription>Failed to load lease cash flow matrix</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (data.rows.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Per-Lease Cash Flow Matrix</CardTitle>
          <CardDescription>No lease data available for the selected period</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const currencyFormatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

  const dateFormatter = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Per-Lease Cash Flow Matrix</CardTitle>
        <CardDescription>
          Excel-style pivot showing each lease's monthly revenue across {data.periods.length} periods
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="w-full">
          <div className="min-w-max">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted">
                  <TableHead className="sticky left-0 z-10 bg-muted min-w-[200px]" data-testid="header-tenant">
                    Tenant
                  </TableHead>
                  <TableHead className="min-w-[120px]" data-testid="header-location">Location</TableHead>
                  <TableHead className="min-w-[120px]" data-testid="header-storage">Storage Type</TableHead>
                  <TableHead className="min-w-[110px]" data-testid="header-start">Start</TableHead>
                  <TableHead className="min-w-[110px]" data-testid="header-end">End</TableHead>
                  {data.periods.map((period) => (
                    <TableHead key={period.periodId} className="text-right min-w-[100px]" data-testid={`header-period-${period.periodId}`}>
                      {period.label}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.rows.map((row) => (
                  <TableRow key={row.leaseId} data-testid={`row-lease-${row.leaseId}`}>
                    <TableCell className="sticky left-0 z-10 bg-background font-medium" data-testid={`cell-tenant-${row.leaseId}`}>
                      {row.tenantName}
                    </TableCell>
                    <TableCell className="text-muted-foreground" data-testid={`cell-location-${row.leaseId}`}>
                      {row.marinaLocationName || '—'}
                    </TableCell>
                    <TableCell className="text-muted-foreground" data-testid={`cell-storage-${row.leaseId}`}>
                      {row.storageType || '—'}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground" data-testid={`cell-start-${row.leaseId}`}>
                      {dateFormatter.format(new Date(row.leaseCommencement))}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground" data-testid={`cell-end-${row.leaseId}`}>
                      {row.leaseExpiration ? dateFormatter.format(new Date(row.leaseExpiration)) : 'Ongoing'}
                    </TableCell>
                    {row.periodCashFlows.map((flow) => (
                      <TableCell
                        key={flow.periodId}
                        className={`text-right tabular-nums ${flow.isActiveInPeriod ? 'font-medium' : 'text-muted-foreground'}`}
                        data-testid={`cell-amount-${row.leaseId}-${flow.periodId}`}
                      >
                        {flow.rentAmount > 0 ? currencyFormatter.format(flow.rentAmount) : '—'}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
