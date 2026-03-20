import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  CartesianGrid,
  Legend,
} from "recharts";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  BarChart3,
  FileText,
  AlertCircle,
} from "lucide-react";

interface PnlData {
  revenue: Array<{ accountName: string; amount: number }>;
  expenses: Array<{ accountName: string; amount: number }>;
  totalRevenue: number;
  totalExpenses: number;
  noi: number;
  monthlyTrend: Array<{ month: string; revenue: number; expenses: number }>;
}

interface GlEntry {
  id: string;
  accountName: string;
  accountType: string;
  amount: string;
  periodStart: string;
  periodEnd: string;
  source: string;
  createdAt: string;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatCurrencyShort(value: number): string {
  if (Math.abs(value) >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(1)}M`;
  }
  if (Math.abs(value) >= 1_000) {
    return `$${(value / 1_000).toFixed(0)}K`;
  }
  return formatCurrency(value);
}

export default function BookkeepingDashboard() {
  const { data: pnlData, isLoading: pnlLoading } = useQuery<PnlData>({
    queryKey: ["/api/bookkeeping/pnl"],
  });

  const { data: glData, isLoading: glLoading } = useQuery<{
    rows: GlEntry[];
    total: number;
  }>({
    queryKey: ["/api/bookkeeping/gl", { limit: "10" }],
    queryFn: async () => {
      const res = await fetch("/api/bookkeeping/gl?limit=10");
      if (!res.ok) throw new Error("Failed to fetch GL entries");
      return res.json();
    },
  });

  const revenue = pnlData?.totalRevenue ?? 0;
  const expenses = pnlData?.totalExpenses ?? 0;
  const noi = pnlData?.noi ?? 0;
  const monthlyTrend = pnlData?.monthlyTrend ?? [];
  const topExpenses = (pnlData?.expenses ?? []).slice(0, 6);
  const recentEntries = glData?.rows ?? [];

  // Compute YTD net income (same as NOI for simplicity)
  const ytdNetIncome = noi;

  const isEmpty = !pnlLoading && revenue === 0 && expenses === 0 && recentEntries.length === 0;

  return (
    <div className="p-6 space-y-6">
      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Revenue MTD</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            {pnlLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <div className="text-2xl font-bold text-green-700">
                  {formatCurrencyShort(revenue)}
                </div>
                <p className="text-xs text-muted-foreground">
                  {pnlData?.revenue.length ?? 0} revenue accounts
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Expenses MTD</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            {pnlLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <div className="text-2xl font-bold text-red-700">
                  {formatCurrencyShort(expenses)}
                </div>
                <p className="text-xs text-muted-foreground">
                  {pnlData?.expenses.length ?? 0} expense accounts
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Net Income MTD</CardTitle>
            <DollarSign className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            {pnlLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <div
                  className={`text-2xl font-bold ${
                    noi >= 0 ? "text-green-700" : "text-red-700"
                  }`}
                >
                  {formatCurrencyShort(noi)}
                </div>
                <p className="text-xs text-muted-foreground">
                  {revenue > 0
                    ? `${((noi / revenue) * 100).toFixed(1)}% margin`
                    : "No revenue data"}
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">YTD Net Income</CardTitle>
            <BarChart3 className="h-4 w-4 text-indigo-600" />
          </CardHeader>
          <CardContent>
            {pnlLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <div
                  className={`text-2xl font-bold ${
                    ytdNetIncome >= 0 ? "text-green-700" : "text-red-700"
                  }`}
                >
                  {formatCurrencyShort(ytdNetIncome)}
                </div>
                <p className="text-xs text-muted-foreground">Year to date</p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {isEmpty && (
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-muted-foreground">
              <AlertCircle className="w-12 h-12 mx-auto mb-3 text-muted-foreground/50" />
              <p className="font-medium text-lg">No GL data yet</p>
              <p className="text-sm mt-1 max-w-md mx-auto">
                Import GL entries via CSV on the GL Import tab, or add entries
                manually on the GL Viewer tab to start seeing financial data here.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {!isEmpty && (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Revenue vs Expenses Trend */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-[#1E4FAB]" />
                Revenue vs Expenses
              </CardTitle>
              <CardDescription>Monthly trend over time</CardDescription>
            </CardHeader>
            <CardContent>
              {monthlyTrend.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  Not enough data for trend chart
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={monthlyTrend}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" fontSize={12} />
                    <YAxis
                      fontSize={12}
                      tickFormatter={(v) => formatCurrencyShort(v)}
                    />
                    <Tooltip
                      formatter={(value: number) => formatCurrency(value)}
                    />
                    <Legend />
                    <Area
                      type="monotone"
                      dataKey="revenue"
                      stackId="1"
                      stroke="#16a34a"
                      fill="#bbf7d0"
                      name="Revenue"
                    />
                    <Area
                      type="monotone"
                      dataKey="expenses"
                      stackId="2"
                      stroke="#dc2626"
                      fill="#fecaca"
                      name="Expenses"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Top Expense Categories */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-[#1E4FAB]" />
                Top Expense Categories
              </CardTitle>
              <CardDescription>Largest expense line items</CardDescription>
            </CardHeader>
            <CardContent>
              {topExpenses.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  No expense data available
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart
                    data={topExpenses}
                    layout="vertical"
                    margin={{ left: 20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      type="number"
                      fontSize={12}
                      tickFormatter={(v) => formatCurrencyShort(v)}
                    />
                    <YAxis
                      type="category"
                      dataKey="accountName"
                      fontSize={11}
                      width={120}
                      tickFormatter={(v: string) =>
                        v.length > 18 ? v.slice(0, 18) + "..." : v
                      }
                    />
                    <Tooltip
                      formatter={(value: number) => formatCurrency(value)}
                    />
                    <Bar dataKey="amount" fill="#f87171" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Recent GL Entries */}
      {recentEntries.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-[#1E4FAB]" />
              Recent GL Entries
            </CardTitle>
            <CardDescription>Last 10 general ledger entries</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Period</TableHead>
                  <TableHead>Account</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Source</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentEntries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="text-sm">
                      {entry.periodStart}
                    </TableCell>
                    <TableCell className="font-medium">
                      {entry.accountName}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          entry.accountType === "revenue"
                            ? "text-green-700 border-green-300"
                            : entry.accountType === "expense"
                            ? "text-red-700 border-red-300"
                            : "text-blue-700 border-blue-300"
                        }
                      >
                        {entry.accountType}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(parseFloat(entry.amount))}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-xs">
                        {entry.source}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
