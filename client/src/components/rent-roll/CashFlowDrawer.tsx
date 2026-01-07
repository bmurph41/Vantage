import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown,
  Calendar,
  Download,
  RefreshCcw,
  BarChart3,
  ArrowUp,
  ArrowDown,
  Minus
} from "lucide-react";
import { formatCurrency, cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

type CashFlowEntry = {
  id: string;
  leaseId: string;
  tenantName?: string;
  locationId?: string;
  locationName?: string;
  cashflowType: string;
  periodStart: string;
  periodEnd: string;
  amount: string;
  isActual: boolean;
  isProjected: boolean;
  notes?: string;
};

type CashFlowSummary = {
  month: string;
  year: number;
  scheduled: number;
  actual: number;
  variance: number;
  variancePercent: number;
};

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

function CashFlowSummaryCard({ 
  title, 
  value, 
  subtitle, 
  trend, 
  loading 
}: { 
  title: string; 
  value: string; 
  subtitle: string; 
  trend?: { direction: 'up' | 'down' | 'flat'; value: string }; 
  loading: boolean;
}) {
  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <Skeleton className="h-4 w-24 mb-2" />
          <Skeleton className="h-8 w-32" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-sm text-muted-foreground">{title}</p>
        <p className="text-2xl font-bold mt-1">{value}</p>
        <div className="flex items-center justify-between mt-2">
          <span className="text-xs text-muted-foreground">{subtitle}</span>
          {trend && (
            <Badge 
              variant="secondary" 
              className={cn(
                "text-xs",
                trend.direction === 'up' && "bg-green-100 text-green-700",
                trend.direction === 'down' && "bg-red-100 text-red-700"
              )}
            >
              {trend.direction === 'up' && <ArrowUp className="h-3 w-3 mr-1" />}
              {trend.direction === 'down' && <ArrowDown className="h-3 w-3 mr-1" />}
              {trend.direction === 'flat' && <Minus className="h-3 w-3 mr-1" />}
              {trend.value}
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function MonthlyBreakdownTable({ 
  data, 
  loading 
}: { 
  data: CashFlowSummary[]; 
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Month</TableHead>
          <TableHead className="text-right">Scheduled</TableHead>
          <TableHead className="text-right">Actual</TableHead>
          <TableHead className="text-right">Variance</TableHead>
          <TableHead className="text-right">%</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.length === 0 ? (
          <TableRow>
            <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
              No cash flow data available
            </TableCell>
          </TableRow>
        ) : (
          data.map((row, idx) => (
            <TableRow key={idx}>
              <TableCell className="font-medium">{row.month} {row.year}</TableCell>
              <TableCell className="text-right">{formatCurrency(row.scheduled)}</TableCell>
              <TableCell className="text-right">{formatCurrency(row.actual)}</TableCell>
              <TableCell className={cn(
                "text-right",
                row.variance > 0 && "text-green-600",
                row.variance < 0 && "text-red-600"
              )}>
                {row.variance > 0 && '+'}
                {formatCurrency(row.variance)}
              </TableCell>
              <TableCell className={cn(
                "text-right",
                row.variancePercent > 0 && "text-green-600",
                row.variancePercent < 0 && "text-red-600"
              )}>
                {row.variancePercent > 0 && '+'}
                {row.variancePercent.toFixed(1)}%
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}

function LeaseEconomicsSection({ 
  leaseId 
}: { 
  leaseId: string;
}) {
  const { data: cashFlows, isLoading } = useQuery<CashFlowEntry[]>({
    queryKey: ['/api/rent-roll/cash-flows', { leaseId }],
    enabled: !!leaseId,
  });

  const totalScheduled = (cashFlows || [])
    .filter(cf => !cf.isActual)
    .reduce((sum, cf) => sum + parseFloat(cf.amount || '0'), 0);

  const totalActual = (cashFlows || [])
    .filter(cf => cf.isActual)
    .reduce((sum, cf) => sum + parseFloat(cf.amount || '0'), 0);

  const variance = totalActual - totalScheduled;
  const variancePercent = totalScheduled > 0 ? (variance / totalScheduled) * 100 : 0;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-6 w-40" />
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-20" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold flex items-center gap-2">
        <DollarSign className="h-5 w-5" />
        Lease Economics
      </h3>

      <div className="grid grid-cols-3 gap-4">
        <div className="p-4 bg-muted/50 rounded-lg">
          <p className="text-sm text-muted-foreground">Scheduled Revenue</p>
          <p className="text-xl font-bold">{formatCurrency(totalScheduled)}</p>
        </div>
        <div className="p-4 bg-muted/50 rounded-lg">
          <p className="text-sm text-muted-foreground">Actual Collected</p>
          <p className="text-xl font-bold">{formatCurrency(totalActual)}</p>
        </div>
        <div className={cn(
          "p-4 rounded-lg",
          variance > 0 ? "bg-green-50 dark:bg-green-950" : variance < 0 ? "bg-red-50 dark:bg-red-950" : "bg-muted/50"
        )}>
          <p className="text-sm text-muted-foreground">Variance</p>
          <p className={cn(
            "text-xl font-bold",
            variance > 0 && "text-green-600",
            variance < 0 && "text-red-600"
          )}>
            {variance > 0 && '+'}
            {formatCurrency(variance)}
            <span className="text-sm font-normal ml-2">({variancePercent.toFixed(1)}%)</span>
          </p>
        </div>
      </div>

      {cashFlows && cashFlows.length > 0 && (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Period</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cashFlows.slice(0, 10).map((cf) => (
                <TableRow key={cf.id}>
                  <TableCell className="font-medium">
                    {new Date(cf.periodStart).toLocaleDateString()} - {new Date(cf.periodEnd).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{cf.cashflowType}</Badge>
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(parseFloat(cf.amount))}
                  </TableCell>
                  <TableCell>
                    {cf.isActual ? (
                      <Badge className="bg-green-500">Actual</Badge>
                    ) : cf.isProjected ? (
                      <Badge variant="secondary">Projected</Badge>
                    ) : (
                      <Badge variant="outline">Scheduled</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

export function CashFlowDrawer({
  open,
  onOpenChange,
  locationId,
  locationName
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  locationId?: string;
  locationName?: string;
}) {
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [viewMode, setViewMode] = useState<'summary' | 'detail'>('summary');

  const { data: cashFlows, isLoading, refetch } = useQuery<CashFlowEntry[]>({
    queryKey: ['/api/rent-roll/cash-flows', { locationId, year: selectedYear }],
    enabled: open,
  });

  const calculateMonthlySummary = (): CashFlowSummary[] => {
    if (!cashFlows) return [];

    const monthlyData: Record<string, { scheduled: number; actual: number }> = {};

    cashFlows.forEach(cf => {
      const date = new Date(cf.periodStart);
      const key = `${date.getMonth()}-${date.getFullYear()}`;
      
      if (!monthlyData[key]) {
        monthlyData[key] = { scheduled: 0, actual: 0 };
      }
      
      const amount = parseFloat(cf.amount || '0');
      if (cf.isActual) {
        monthlyData[key].actual += amount;
      } else {
        monthlyData[key].scheduled += amount;
      }
    });

    return Object.entries(monthlyData).map(([key, data]) => {
      const [month, year] = key.split('-').map(Number);
      const variance = data.actual - data.scheduled;
      const variancePercent = data.scheduled > 0 ? (variance / data.scheduled) * 100 : 0;
      
      return {
        month: MONTHS[month],
        year,
        scheduled: data.scheduled,
        actual: data.actual,
        variance,
        variancePercent
      };
    }).sort((a, b) => a.year !== b.year ? a.year - b.year : MONTHS.indexOf(a.month) - MONTHS.indexOf(b.month));
  };

  const monthlySummary = calculateMonthlySummary();
  
  const totals = monthlySummary.reduce(
    (acc, row) => ({
      scheduled: acc.scheduled + row.scheduled,
      actual: acc.actual + row.actual
    }),
    { scheduled: 0, actual: 0 }
  );

  const totalVariance = totals.actual - totals.scheduled;
  const totalVariancePercent = totals.scheduled > 0 ? (totalVariance / totals.scheduled) * 100 : 0;

  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-[800px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Cash Flow Analysis
          </SheetTitle>
          <SheetDescription>
            {locationName ? `Cash flow details for ${locationName}` : 'Portfolio-wide cash flow analysis'}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger className="w-[120px]" data-testid="select-year">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {yearOptions.map(year => (
                    <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => refetch()} data-testid="btn-refresh">
                <RefreshCcw className="h-4 w-4 mr-1" />
                Refresh
              </Button>
              <Button variant="outline" size="sm" data-testid="btn-export">
                <Download className="h-4 w-4 mr-1" />
                Export
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <CashFlowSummaryCard
              title="Total Scheduled"
              value={formatCurrency(totals.scheduled)}
              subtitle="Budgeted revenue"
              loading={isLoading}
            />
            <CashFlowSummaryCard
              title="Total Actual"
              value={formatCurrency(totals.actual)}
              subtitle="Collected revenue"
              loading={isLoading}
            />
            <CashFlowSummaryCard
              title="Variance"
              value={formatCurrency(Math.abs(totalVariance))}
              subtitle={totalVariance >= 0 ? 'Above budget' : 'Below budget'}
              trend={{
                direction: totalVariance > 0 ? 'up' : totalVariance < 0 ? 'down' : 'flat',
                value: `${Math.abs(totalVariancePercent).toFixed(1)}%`
              }}
              loading={isLoading}
            />
          </div>

          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'summary' | 'detail')}>
            <TabsList>
              <TabsTrigger value="summary">Monthly Summary</TabsTrigger>
              <TabsTrigger value="detail">Detailed View</TabsTrigger>
            </TabsList>

            <TabsContent value="summary" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Monthly Breakdown</CardTitle>
                  <CardDescription>
                    Scheduled vs actual cash flows by month
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <MonthlyBreakdownTable data={monthlySummary} loading={isLoading} />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="detail" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">All Transactions</CardTitle>
                  <CardDescription>
                    Individual cash flow entries
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <div className="space-y-2">
                      {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Period</TableHead>
                          <TableHead>Tenant</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(!cashFlows || cashFlows.length === 0) ? (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                              No cash flow entries found
                            </TableCell>
                          </TableRow>
                        ) : (
                          cashFlows.map((cf) => (
                            <TableRow key={cf.id}>
                              <TableCell>
                                {new Date(cf.periodStart).toLocaleDateString()}
                              </TableCell>
                              <TableCell>{cf.tenantName || '-'}</TableCell>
                              <TableCell>
                                <Badge variant="outline">{cf.cashflowType}</Badge>
                              </TableCell>
                              <TableCell className="text-right font-medium">
                                {formatCurrency(parseFloat(cf.amount))}
                              </TableCell>
                              <TableCell>
                                {cf.isActual ? (
                                  <Badge className="bg-green-500">Actual</Badge>
                                ) : (
                                  <Badge variant="secondary">Scheduled</Badge>
                                )}
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export { LeaseEconomicsSection };
export default CashFlowDrawer;
