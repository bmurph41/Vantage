import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Download, Calendar, TrendingUp, TrendingDown, Info, DollarSign, ArrowUpRight, ArrowDownRight } from "lucide-react";

export interface ProFormaLineItem {
  label: string;
  color?: string;
  isSubtotal?: boolean;
  isBold?: boolean;
}

export interface ProFormaCashFlowRow {
  period: number;
  year: number;
  month: number;
  values: Record<string, number>;
  isExitMonth?: boolean;
}

export interface ExitProFormaConfig {
  strategyName: string;
  holdPeriodYears: number;
  lineItems: ProFormaLineItem[];
  rows: ProFormaCashFlowRow[];
  exitMonth?: number;
  summaryMetrics?: { label: string; value: string; delta?: string; deltaDirection?: 'up' | 'down' }[];
}

function fmtCurrency(v: number, compact?: boolean): string {
  if (!isFinite(v) || isNaN(v)) return "$0";
  if (compact && Math.abs(v) >= 1_000_000) {
    return `$${(v / 1_000_000).toFixed(1)}M`;
  }
  if (compact && Math.abs(v) >= 1_000) {
    return `$${(v / 1_000).toFixed(0)}K`;
  }
  return v.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

interface AnnualRow {
  year: number;
  values: Record<string, number>;
  hasExit: boolean;
}

function aggregateAnnual(rows: ProFormaCashFlowRow[]): AnnualRow[] {
  const years = new Map<number, { values: Record<string, number>; hasExit: boolean }>();
  for (const r of rows) {
    if (!years.has(r.year)) {
      years.set(r.year, { values: {}, hasExit: false });
    }
    const y = years.get(r.year)!;
    for (const [key, val] of Object.entries(r.values)) {
      y.values[key] = (y.values[key] || 0) + val;
    }
    if (r.isExitMonth) y.hasExit = true;
  }
  return Array.from(years.entries())
    .sort(([a], [b]) => a - b)
    .map(([year, data]) => ({ year, ...data }));
}

export function ExitProForma({ config }: { config: ExitProFormaConfig }) {
  const [view, setView] = useState<"annual" | "monthly">("annual");

  const annualRows = useMemo(() => aggregateAnnual(config.rows), [config.rows]);

  const totalsByLine = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const row of config.rows) {
      for (const [key, val] of Object.entries(row.values)) {
        totals[key] = (totals[key] || 0) + val;
      }
    }
    return totals;
  }, [config.rows]);

  const cumulativeCF = useMemo(() => {
    const cfKey = config.lineItems.find(li => li.isSubtotal)?.label || config.lineItems[config.lineItems.length - 1]?.label;
    if (!cfKey) return [];
    let cumulative = 0;
    return config.rows.map(r => {
      cumulative += r.values[cfKey] || 0;
      return cumulative;
    });
  }, [config.rows, config.lineItems]);

  const annualCumulativeCF = useMemo(() => {
    const cfKey = config.lineItems.find(li => li.isSubtotal)?.label || config.lineItems[config.lineItems.length - 1]?.label;
    if (!cfKey) return [];
    let cumulative = 0;
    return annualRows.map(r => {
      cumulative += r.values[cfKey] || 0;
      return cumulative;
    });
  }, [annualRows, config.lineItems]);

  const handleExportCSV = () => {
    const headers = ["Period", "Year", "Month", ...config.lineItems.map(li => li.label), "Cumulative CF"];
    const dataRows = config.rows.map((r, idx) => [
      r.period, r.year, r.month,
      ...config.lineItems.map(li => (r.values[li.label] || 0).toFixed(2)),
      (cumulativeCF[idx] || 0).toFixed(2),
    ]);
    const csv = [headers.join(","), ...dataRows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${config.strategyName.replace(/\s+/g, "_")}_pro_forma.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (config.rows.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">
          <Calendar className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p className="font-medium">No cash flow data available</p>
          <p className="text-sm mt-1">Adjust your inputs above to generate the pro forma projection.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-primary" />
              Pro Forma Cash Flows
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {config.strategyName} &mdash; {config.holdPeriodYears}-year projection
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Tabs value={view} onValueChange={(v) => setView(v as "annual" | "monthly")}>
              <TabsList className="h-8">
                <TabsTrigger value="annual" className="text-xs px-3 h-7">Annual</TabsTrigger>
                <TabsTrigger value="monthly" className="text-xs px-3 h-7">Monthly</TabsTrigger>
              </TabsList>
            </Tabs>
            <Button variant="outline" size="sm" onClick={handleExportCSV}>
              <Download className="h-4 w-4 mr-1" />
              CSV
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {config.summaryMetrics && config.summaryMetrics.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 px-6 pb-4">
            {config.summaryMetrics.map((m, i) => (
              <div key={i} className="p-3 bg-muted/50 rounded-lg">
                <p className="text-xs text-muted-foreground">{m.label}</p>
                <p className="text-lg font-bold">{m.value}</p>
                {m.delta && (
                  <div className={`flex items-center gap-1 text-xs ${m.deltaDirection === 'up' ? 'text-green-600' : 'text-red-600'}`}>
                    {m.deltaDirection === 'up' ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                    {m.delta}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
          {view === "annual" ? (
            <Table>
              <TableHeader className="sticky top-0 bg-background z-10">
                <TableRow>
                  <TableHead className="w-20 font-semibold">Year</TableHead>
                  {config.lineItems.map((li) => (
                    <TableHead key={li.label} className={`text-right ${li.isBold ? "font-bold" : ""}`}>
                      {li.label}
                    </TableHead>
                  ))}
                  <TableHead className="text-right font-semibold">Cumulative</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {annualRows.map((row, idx) => (
                  <TableRow key={row.year} className={row.hasExit ? "bg-primary/5 font-medium" : ""}>
                    <TableCell className="font-medium">
                      {row.hasExit ? (
                        <span className="flex items-center gap-1">
                          Year {row.year}
                          <Badge variant="secondary" className="text-[10px] px-1">EXIT</Badge>
                        </span>
                      ) : (
                        `Year ${row.year}`
                      )}
                    </TableCell>
                    {config.lineItems.map((li) => {
                      const val = row.values[li.label] || 0;
                      return (
                        <TableCell
                          key={li.label}
                          className={`text-right tabular-nums ${li.isBold || li.isSubtotal ? "font-semibold" : ""} ${val < 0 ? "text-red-600" : ""}`}
                        >
                          {fmtCurrency(val)}
                        </TableCell>
                      );
                    })}
                    <TableCell className={`text-right font-semibold tabular-nums ${(annualCumulativeCF[idx] || 0) < 0 ? "text-red-600" : "text-green-600"}`}>
                      {fmtCurrency(annualCumulativeCF[idx] || 0)}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="border-t-2 bg-muted/30 font-bold">
                  <TableCell>Total</TableCell>
                  {config.lineItems.map((li) => {
                    const val = totalsByLine[li.label] || 0;
                    return (
                      <TableCell key={li.label} className={`text-right tabular-nums ${val < 0 ? "text-red-600" : ""}`}>
                        {fmtCurrency(val)}
                      </TableCell>
                    );
                  })}
                  <TableCell className="text-right tabular-nums">
                    {fmtCurrency(cumulativeCF[cumulativeCF.length - 1] || 0)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          ) : (
            <Table>
              <TableHeader className="sticky top-0 bg-background z-10">
                <TableRow>
                  <TableHead className="w-14">Mo</TableHead>
                  <TableHead className="w-14">Yr</TableHead>
                  {config.lineItems.map((li) => (
                    <TableHead key={li.label} className={`text-right ${li.isBold ? "font-bold" : ""}`}>
                      {li.label}
                    </TableHead>
                  ))}
                  <TableHead className="text-right font-semibold">Cumulative</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {config.rows.map((row, idx) => (
                  <TableRow key={row.period} className={row.isExitMonth ? "bg-primary/5 font-medium" : (row.month === 1 ? "border-t-2" : "")}>
                    <TableCell className="text-xs text-muted-foreground">{row.month}</TableCell>
                    <TableCell className="text-xs font-medium">{row.year}</TableCell>
                    {config.lineItems.map((li) => {
                      const val = row.values[li.label] || 0;
                      return (
                        <TableCell
                          key={li.label}
                          className={`text-right text-sm tabular-nums ${li.isBold || li.isSubtotal ? "font-semibold" : ""} ${val < 0 ? "text-red-600" : ""}`}
                        >
                          {fmtCurrency(val)}
                        </TableCell>
                      );
                    })}
                    <TableCell className={`text-right text-sm font-semibold tabular-nums ${(cumulativeCF[idx] || 0) < 0 ? "text-red-600" : "text-green-600"}`}>
                      {fmtCurrency(cumulativeCF[idx] || 0)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function buildExitProFormaRows(params: {
  holdPeriodYears: number;
  monthlyNOI: number;
  noiGrowthRate: number;
  monthlyDebtService: number;
  exitProceeds: number;
  exitCosts: number;
  exitTax: number;
  debtPayoff: number;
  strategySpecificMonthly?: (month: number, year: number) => Record<string, number>;
  strategySpecificExit?: Record<string, number>;
}): { rows: ProFormaCashFlowRow[]; lineItems: ProFormaLineItem[] } {
  const {
    holdPeriodYears,
    monthlyNOI,
    noiGrowthRate,
    monthlyDebtService,
    exitProceeds,
    exitCosts,
    exitTax,
    debtPayoff,
    strategySpecificMonthly,
    strategySpecificExit,
  } = params;

  const rows: ProFormaCashFlowRow[] = [];
  const totalMonths = holdPeriodYears * 12;
  const monthlyGrowth = Math.pow(1 + noiGrowthRate / 100, 1 / 12);

  const hasStrategyItems = !!strategySpecificMonthly || !!strategySpecificExit;
  const strategyKeys = new Set<string>();

  for (let m = 1; m <= totalMonths; m++) {
    const year = Math.ceil(m / 12);
    const month = ((m - 1) % 12) + 1;
    const noi = monthlyNOI * Math.pow(monthlyGrowth, m - 1);
    const debtSvc = monthlyDebtService;
    const netOpCF = noi - debtSvc;

    const values: Record<string, number> = {
      "NOI": noi,
      "Debt Service": -debtSvc,
      "Net Operating CF": netOpCF,
    };

    const isExitMonth = m === totalMonths;

    if (strategySpecificMonthly) {
      const extras = strategySpecificMonthly(m, year);
      for (const [k, v] of Object.entries(extras)) {
        values[k] = v;
        strategyKeys.add(k);
      }
    }

    if (isExitMonth) {
      values["Sale Proceeds"] = exitProceeds;
      values["Exit Costs"] = -exitCosts;
      values["Tax Liability"] = -exitTax;
      values["Debt Payoff"] = -debtPayoff;

      if (strategySpecificExit) {
        for (const [k, v] of Object.entries(strategySpecificExit)) {
          values[k] = v;
          strategyKeys.add(k);
        }
      }

      values["Total Cash Flow"] = netOpCF + exitProceeds - exitCosts - exitTax - debtPayoff
        + (strategySpecificMonthly ? Object.values(strategySpecificMonthly(m, year)).reduce((s, v) => s + v, 0) : 0)
        + (strategySpecificExit ? Object.values(strategySpecificExit).reduce((s, v) => s + v, 0) : 0);
    } else {
      let totalCF = netOpCF;
      if (strategySpecificMonthly) {
        const extras = strategySpecificMonthly(m, year);
        totalCF += Object.values(extras).reduce((s, v) => s + v, 0);
      }
      values["Total Cash Flow"] = totalCF;
    }

    rows.push({ period: m, year, month, values, isExitMonth });
  }

  const lineItems: ProFormaLineItem[] = [
    { label: "NOI" },
    { label: "Debt Service" },
    { label: "Net Operating CF", isBold: true },
  ];

  for (const key of strategyKeys) {
    lineItems.push({ label: key });
  }

  const exitItems = ["Sale Proceeds", "Exit Costs", "Tax Liability", "Debt Payoff"];
  for (const item of exitItems) {
    lineItems.push({ label: item });
  }

  lineItems.push({ label: "Total Cash Flow", isSubtotal: true, isBold: true });

  return { rows, lineItems };
}
