import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { DollarSign, TrendingUp, TrendingDown, AlertTriangle, RefreshCw, ChevronDown, ChevronRight, CheckCircle } from "lucide-react";

export default function CashFlowForecastingPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [expandedPeriod, setExpandedPeriod] = useState<string | null>(null);

  const { data: forecasts = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/cash-flow"],
  });

  const { data: summary } = useQuery<any>({
    queryKey: ["/api/cash-flow/summary"],
  });

  const generateForecast = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/cash-flow/generate", { horizonMonths: 24 });
      return res.json();
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["/api/cash-flow"] });
      toast({ title: "Forecast generated", description: `${data.dealsAnalyzed} deals analyzed, ${data.alerts.length} alerts` });
    },
  });

  const acknowledgeAlert = useMutation({
    mutationFn: async (alertId: string) => {
      const res = await apiRequest("PATCH", `/api/cash-flow/alerts/${alertId}/acknowledge`);
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/cash-flow"] }),
  });

  const fmt = (v: string | number) => {
    const n = typeof v === "string" ? parseFloat(v) : v;
    if (isNaN(n)) return "$0";
    return n >= 0 ? `$${n.toLocaleString()}` : `-$${Math.abs(n).toLocaleString()}`;
  };

  const alerts = summary?.activeAlerts || [];
  const totals = summary?.totals || {};

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Cash Flow Forecasting</h1>
          <p className="text-muted-foreground">24-month portfolio cash flow projections with liquidity risk detection</p>
        </div>
        <Button onClick={() => generateForecast.mutate()} disabled={generateForecast.isPending}>
          <RefreshCw className={`h-4 w-4 mr-2 ${generateForecast.isPending ? "animate-spin" : ""}`} />
          Generate Forecast
        </Button>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-600" />
              <span className="text-sm text-muted-foreground">Total Projected Inflows</span>
            </div>
            <p className="text-2xl font-bold mt-1 text-green-600">{fmt(totals.totalNOI || 0)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <TrendingDown className="h-5 w-5 text-red-600" />
              <span className="text-sm text-muted-foreground">Total Projected Outflows</span>
            </div>
            <p className="text-2xl font-bold mt-1 text-red-600">{fmt(totals.totalDebtService || 0)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-blue-600" />
              <span className="text-sm text-muted-foreground">Net Cash Flow</span>
            </div>
            <p className="text-2xl font-bold mt-1">{fmt(totals.totalNet || 0)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-600" />
              <span className="text-sm text-muted-foreground">Tight Months</span>
            </div>
            <p className="text-2xl font-bold mt-1 text-orange-600">{totals.tightMonths || 0}</p>
          </CardContent>
        </Card>
      </div>

      {/* Liquidity Alerts */}
      {alerts.length > 0 && (
        <Card className="border-orange-200 bg-orange-50/50">
          <CardHeader>
            <CardTitle className="text-orange-800 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Liquidity Alerts ({alerts.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {alerts.map((alert: any) => (
              <div key={alert.id} className="flex items-start justify-between p-3 bg-white rounded-lg border">
                <div>
                  <div className="flex items-center gap-2">
                    <Badge variant={alert.severity === "critical" ? "destructive" : "outline"}>{alert.severity}</Badge>
                    <span className="font-medium">{alert.period}</span>
                  </div>
                  <p className="text-sm mt-1">{alert.message}</p>
                  {alert.suggestedActions && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {(alert.suggestedActions as string[]).map((action: string, i: number) => (
                        <Badge key={i} variant="secondary" className="text-xs">{action}</Badge>
                      ))}
                    </div>
                  )}
                </div>
                <Button size="sm" variant="ghost" onClick={() => acknowledgeAlert.mutate(alert.id)}>
                  <CheckCircle className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Forecast Table */}
      <Card>
        <CardHeader>
          <CardTitle>Monthly Forecast</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">{[...Array(6)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : forecasts.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <DollarSign className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p>No forecast generated yet. Click "Generate Forecast" to create a 24-month projection.</p>
            </div>
          ) : (
            <div className="overflow-x-auto w-full">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8"></TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead className="text-right">NOI</TableHead>
                  <TableHead className="text-right">Debt Service</TableHead>
                  <TableHead className="text-right">CapEx</TableHead>
                  <TableHead className="text-right">Distributions</TableHead>
                  <TableHead className="text-right">Net Cash</TableHead>
                  <TableHead className="text-right">Cumulative</TableHead>
                  <TableHead>Confidence</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {forecasts.map((f: any) => {
                  const net = parseFloat(f.netCashFlow || "0");
                  const cumulative = parseFloat(f.cumulativeCashFlow || "0");
                  const isExpanded = expandedPeriod === f.period;
                  const breakdown = (f.dealBreakdown || []) as any[];

                  return (
                    <>
                      <TableRow
                        key={f.period}
                        className={`cursor-pointer ${net < 0 ? "bg-red-50" : ""}`}
                        onClick={() => setExpandedPeriod(isExpanded ? null : f.period)}
                      >
                        <TableCell>
                          {breakdown.length > 0 && (isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />)}
                        </TableCell>
                        <TableCell className="font-medium">{f.period}</TableCell>
                        <TableCell className="text-right text-green-600">{fmt(f.projectedNOI)}</TableCell>
                        <TableCell className="text-right text-red-600">{fmt(f.projectedDebtService)}</TableCell>
                        <TableCell className="text-right">{fmt(f.projectedCapex)}</TableCell>
                        <TableCell className="text-right">{fmt(f.projectedDistributions)}</TableCell>
                        <TableCell className={`text-right font-medium ${net < 0 ? "text-red-600" : "text-green-600"}`}>{fmt(net)}</TableCell>
                        <TableCell className={`text-right ${cumulative < 0 ? "text-red-600 font-bold" : ""}`}>{fmt(cumulative)}</TableCell>
                        <TableCell>
                          <Badge variant={f.confidenceLevel === "high" ? "default" : f.confidenceLevel === "medium" ? "secondary" : "outline"}>
                            {f.confidenceLevel}
                          </Badge>
                        </TableCell>
                      </TableRow>
                      {isExpanded && breakdown.map((d: any) => (
                        <TableRow key={`${f.period}-${d.dealId}`} className="bg-muted/30">
                          <TableCell></TableCell>
                          <TableCell className="text-sm text-muted-foreground pl-8">{d.dealTitle || d.dealId}</TableCell>
                          <TableCell className="text-right text-sm">{fmt(d.noi)}</TableCell>
                          <TableCell className="text-right text-sm">{fmt(d.debtService)}</TableCell>
                          <TableCell className="text-right text-sm">{fmt(d.capex)}</TableCell>
                          <TableCell className="text-right text-sm">{fmt(d.managementFee || 0)}</TableCell>
                          <TableCell className="text-right text-sm font-medium">{fmt(d.net)}</TableCell>
                          <TableCell></TableCell>
                          <TableCell></TableCell>
                        </TableRow>
                      ))}
                    </>
                  );
                })}
              </TableBody>
            </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
