import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
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
import { useDeptPnl, usePayrollPlans, useDepartments } from "@/hooks/use-payroll";
import { GitBranch, Download, AlertCircle, CheckCircle2 } from "lucide-react";

export default function DeptPnl() {
  const { data: plans } = usePayrollPlans({});
  const { data: departments } = useDepartments();
  const [selectedPlanId, setSelectedPlanId] = useState<string>("");
  const [dataSource, setDataSource] = useState<string>("OPERATIONS");

  // Build date range (current year)
  const year = new Date().getFullYear();
  const startDate = `${year}-01-01`;
  const endDate = `${year}-12-31`;

  const { data: pnlData, isLoading } = useDeptPnl({
    dataSource,
    scopeId: selectedPlanId ? plans?.find((p: any) => p.id === selectedPlanId)?.assetId : undefined,
    payrollPlanId: selectedPlanId || undefined,
    startDate,
    endDate,
  });

  const formatCurrency = (val: number) => {
    if (!val && val !== 0) return "—";
    const neg = val < 0;
    const abs = Math.abs(val);
    if (abs >= 1000000) return `${neg ? "-" : ""}$${(abs / 1000000).toFixed(1)}M`;
    if (abs >= 1000) return `${neg ? "-" : ""}$${(abs / 1000).toFixed(1)}K`;
    return `${neg ? "-" : ""}$${abs.toFixed(0)}`;
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Department P&L</h2>
          <p className="text-sm text-muted-foreground">
            See revenue, COGS, payroll, and operating expenses broken down by department
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <Select value={dataSource} onValueChange={setDataSource}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="OPERATIONS">Operations</SelectItem>
            <SelectItem value="VALUATOR">Valuator</SelectItem>
          </SelectContent>
        </Select>

        <Select value={selectedPlanId} onValueChange={setSelectedPlanId}>
          <SelectTrigger className="w-[280px]">
            <SelectValue placeholder="Select payroll plan..." />
          </SelectTrigger>
          <SelectContent>
            {(plans || []).map((plan: any) => (
              <SelectItem key={plan.id} value={plan.id}>
                {plan.planName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Badge variant="outline" className="text-xs">
          {startDate} to {endDate}
        </Badge>
      </div>

      {/* Results */}
      {!selectedPlanId ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 space-y-4">
            <div className="p-4 rounded-full bg-primary/10">
              <GitBranch className="h-8 w-8 text-primary" />
            </div>
            <div className="text-center space-y-2">
              <h3 className="text-lg font-semibold">Select a Payroll Plan</h3>
              <p className="text-sm text-muted-foreground">
                Choose a payroll plan above to see the department-level P&L breakdown.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : pnlData ? (
        <>
          {/* Reconciliation Status */}
          <div className="flex items-center gap-2">
            {pnlData.reconcilesWithOverallPnl ? (
              <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Reconciled
              </Badge>
            ) : (
              <Badge variant="destructive">
                <AlertCircle className="h-3 w-3 mr-1" />
                Does not reconcile
              </Badge>
            )}
            <span className="text-xs text-muted-foreground">
              Department totals {pnlData.reconcilesWithOverallPnl ? "match" : "do not match"} overall P&L
            </span>
          </div>

          {/* Department P&L Table */}
          <Card>
            <CardContent className="pt-6 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[180px]">Department</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                    <TableHead className="text-right">COGS</TableHead>
                    <TableHead className="text-right">Gross Profit</TableHead>
                    <TableHead className="text-right">Payroll</TableHead>
                    <TableHead className="text-right">Other OpEx</TableHead>
                    <TableHead className="text-right">Total OpEx</TableHead>
                    <TableHead className="text-right font-semibold">EBITDA/NOI</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(pnlData.departments || []).map((dept: any) => {
                    const deptInfo = departments?.find((d: any) => d.id === dept.departmentId);
                    return (
                      <TableRow key={dept.departmentId}>
                        <TableCell className="font-medium">
                          {deptInfo?.name || dept.departmentId}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatCurrency(dept.revenue)}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatCurrency(dept.cogs)}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatCurrency(dept.grossProfit)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-blue-600 dark:text-blue-400">
                          {formatCurrency(dept.payroll)}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatCurrency(dept.otherOpex)}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatCurrency(dept.totalOpex)}
                        </TableCell>
                        <TableCell className="text-right font-mono font-semibold">
                          <span
                            className={
                              (dept.ebitdaNoi || 0) >= 0
                                ? "text-green-600 dark:text-green-400"
                                : "text-red-600 dark:text-red-400"
                            }
                          >
                            {formatCurrency(dept.ebitdaNoi)}
                          </span>
                        </TableCell>
                      </TableRow>
                    );
                  })}

                  {/* Unassigned row */}
                  {pnlData.unassigned &&
                    (pnlData.unassigned.revenue > 0 || pnlData.unassigned.payroll > 0) && (
                      <TableRow className="bg-muted/30">
                        <TableCell className="font-medium italic text-muted-foreground">
                          Unassigned
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatCurrency(pnlData.unassigned.revenue)}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatCurrency(pnlData.unassigned.cogs)}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatCurrency(pnlData.unassigned.grossProfit)}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatCurrency(pnlData.unassigned.payroll)}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatCurrency(pnlData.unassigned.otherOpex)}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatCurrency(pnlData.unassigned.totalOpex)}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatCurrency(pnlData.unassigned.ebitdaNoi)}
                        </TableCell>
                      </TableRow>
                    )}

                  {/* Totals */}
                  {pnlData.totals && (
                    <TableRow className="border-t-2 font-semibold">
                      <TableCell>TOTAL</TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(pnlData.totals.revenue)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(pnlData.totals.cogs)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(pnlData.totals.grossProfit)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-blue-600 dark:text-blue-400">
                        {formatCurrency(pnlData.totals.payroll)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(pnlData.totals.otherOpex)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(pnlData.totals.totalOpex)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        <span
                          className={
                            (pnlData.totals.ebitdaNoi || 0) >= 0
                              ? "text-green-600 dark:text-green-400"
                              : "text-red-600 dark:text-red-400"
                          }
                        >
                          {formatCurrency(pnlData.totals.ebitdaNoi)}
                        </span>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      ) : (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No P&L data available for the selected plan and date range.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
