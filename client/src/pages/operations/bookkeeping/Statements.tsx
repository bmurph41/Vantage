import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FileText, Scale, AlertCircle, TrendingUp, TrendingDown, DollarSign } from "lucide-react";

interface PnlData {
  revenue: Array<{ accountName: string; amount: number }>;
  expenses: Array<{ accountName: string; amount: number }>;
  totalRevenue: number;
  totalExpenses: number;
  noi: number;
}

interface BalanceSheetSection {
  items: Array<{ accountName: string; amount: number }>;
  total: number;
}

interface BalanceSheetData {
  assets: BalanceSheetSection;
  liabilities: BalanceSheetSection;
  equity: BalanceSheetSection;
  totalAssets: number;
  totalLiabilitiesAndEquity: number;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export default function BookkeepingStatements() {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const queryParams = new URLSearchParams();
  if (startDate) queryParams.set("startDate", startDate);
  if (endDate) queryParams.set("endDate", endDate);
  const qs = queryParams.toString();

  const {
    data: pnlData,
    isLoading: pnlLoading,
  } = useQuery<PnlData>({
    queryKey: ["/api/bookkeeping/pnl", startDate, endDate],
    queryFn: async () => {
      const res = await fetch(`/api/bookkeeping/pnl${qs ? `?${qs}` : ""}`);
      if (!res.ok) throw new Error("Failed to fetch P&L");
      return res.json();
    },
  });

  const {
    data: bsData,
    isLoading: bsLoading,
  } = useQuery<BalanceSheetData>({
    queryKey: ["/api/bookkeeping/balance-sheet", endDate],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (endDate) params.set("asOfDate", endDate);
      const q = params.toString();
      const res = await fetch(`/api/bookkeeping/balance-sheet${q ? `?${q}` : ""}`);
      if (!res.ok) throw new Error("Failed to fetch balance sheet");
      return res.json();
    },
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-lg font-semibold">Financial Statements</h2>
          <p className="text-sm text-muted-foreground">
            P&L and Balance Sheet generated from GL data
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Label htmlFor="start-date" className="text-sm whitespace-nowrap">
              From
            </Label>
            <Input
              id="start-date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-40"
            />
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="end-date" className="text-sm whitespace-nowrap">
              To
            </Label>
            <Input
              id="end-date"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-40"
            />
          </div>
        </div>
      </div>

      <Tabs defaultValue="pnl" className="space-y-4">
        <TabsList>
          <TabsTrigger value="pnl" className="flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Profit & Loss
          </TabsTrigger>
          <TabsTrigger value="balance-sheet" className="flex items-center gap-2">
            <Scale className="w-4 h-4" />
            Balance Sheet
          </TabsTrigger>
        </TabsList>

        {/* P&L Tab */}
        <TabsContent value="pnl">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-[#1E4FAB]" />
                Profit & Loss Statement
              </CardTitle>
              <CardDescription>
                {startDate || endDate
                  ? `${startDate || "Beginning"} to ${endDate || "Present"}`
                  : "All periods"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {pnlLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className="h-8 w-full" />
                  ))}
                </div>
              ) : !pnlData ||
                (pnlData.revenue.length === 0 &&
                  pnlData.expenses.length === 0) ? (
                <div className="text-center py-12 text-muted-foreground">
                  <AlertCircle className="w-12 h-12 mx-auto mb-3 text-muted-foreground/50" />
                  <p className="font-medium">No P&L data available</p>
                  <p className="text-sm mt-1">
                    Import GL entries to generate financial statements.
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Account</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {/* Revenue Section */}
                    <TableRow className="bg-green-50/50">
                      <TableCell
                        colSpan={2}
                        className="font-semibold text-green-800 flex items-center gap-2"
                      >
                        <TrendingUp className="w-4 h-4" />
                        Revenue
                      </TableCell>
                    </TableRow>
                    {pnlData.revenue.map((item) => (
                      <TableRow key={item.accountName}>
                        <TableCell className="pl-8">
                          {item.accountName}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatCurrency(item.amount)}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="border-t-2 bg-green-50/30">
                      <TableCell className="pl-8 font-semibold">
                        Total Revenue
                      </TableCell>
                      <TableCell className="text-right font-mono font-semibold text-green-700">
                        {formatCurrency(pnlData.totalRevenue)}
                      </TableCell>
                    </TableRow>

                    {/* Spacer */}
                    <TableRow>
                      <TableCell colSpan={2} className="h-2 p-0" />
                    </TableRow>

                    {/* Expenses Section */}
                    <TableRow className="bg-red-50/50">
                      <TableCell
                        colSpan={2}
                        className="font-semibold text-red-800 flex items-center gap-2"
                      >
                        <TrendingDown className="w-4 h-4" />
                        Expenses
                      </TableCell>
                    </TableRow>
                    {pnlData.expenses.map((item) => (
                      <TableRow key={item.accountName}>
                        <TableCell className="pl-8">
                          {item.accountName}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatCurrency(item.amount)}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="border-t-2 bg-red-50/30">
                      <TableCell className="pl-8 font-semibold">
                        Total Expenses
                      </TableCell>
                      <TableCell className="text-right font-mono font-semibold text-red-700">
                        {formatCurrency(pnlData.totalExpenses)}
                      </TableCell>
                    </TableRow>

                    {/* Spacer */}
                    <TableRow>
                      <TableCell colSpan={2} className="h-2 p-0" />
                    </TableRow>

                    {/* NOI */}
                    <TableRow className="bg-blue-50/50 border-t-2 border-b-2">
                      <TableCell className="font-bold text-blue-900 flex items-center gap-2">
                        <DollarSign className="w-4 h-4" />
                        Net Operating Income (NOI)
                      </TableCell>
                      <TableCell
                        className={`text-right font-mono font-bold text-lg ${
                          pnlData.noi >= 0 ? "text-green-700" : "text-red-700"
                        }`}
                      >
                        {formatCurrency(pnlData.noi)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Balance Sheet Tab */}
        <TabsContent value="balance-sheet">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Scale className="w-5 h-5 text-[#1E4FAB]" />
                Balance Sheet
              </CardTitle>
              <CardDescription>
                {endDate ? `As of ${endDate}` : "All periods cumulative"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {bsLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className="h-8 w-full" />
                  ))}
                </div>
              ) : !bsData ||
                (bsData.assets.items.length === 0 &&
                  bsData.liabilities.items.length === 0 &&
                  bsData.equity.items.length === 0) ? (
                <div className="text-center py-12 text-muted-foreground">
                  <AlertCircle className="w-12 h-12 mx-auto mb-3 text-muted-foreground/50" />
                  <p className="font-medium">No balance sheet data available</p>
                  <p className="text-sm mt-1">
                    Import GL entries with asset, liability, or equity account
                    types.
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Account</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {/* Assets */}
                    <BalanceSheetSectionRows
                      title="Assets"
                      items={bsData.assets.items}
                      total={bsData.assets.total}
                      colorClass="text-blue-800"
                      bgClass="bg-blue-50/50"
                    />

                    <TableRow>
                      <TableCell colSpan={2} className="h-3 p-0" />
                    </TableRow>

                    {/* Liabilities */}
                    <BalanceSheetSectionRows
                      title="Liabilities"
                      items={bsData.liabilities.items}
                      total={bsData.liabilities.total}
                      colorClass="text-orange-800"
                      bgClass="bg-orange-50/50"
                    />

                    <TableRow>
                      <TableCell colSpan={2} className="h-3 p-0" />
                    </TableRow>

                    {/* Equity */}
                    <BalanceSheetSectionRows
                      title="Equity"
                      items={bsData.equity.items}
                      total={bsData.equity.total}
                      colorClass="text-purple-800"
                      bgClass="bg-purple-50/50"
                    />

                    <TableRow>
                      <TableCell colSpan={2} className="h-3 p-0" />
                    </TableRow>

                    {/* Totals */}
                    <TableRow className="bg-muted/50 border-t-2">
                      <TableCell className="font-bold">Total Assets</TableCell>
                      <TableCell className="text-right font-mono font-bold">
                        {formatCurrency(bsData.totalAssets)}
                      </TableCell>
                    </TableRow>
                    <TableRow className="bg-muted/50">
                      <TableCell className="font-bold">
                        Total Liabilities + Equity
                      </TableCell>
                      <TableCell className="text-right font-mono font-bold">
                        {formatCurrency(bsData.totalLiabilitiesAndEquity)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function BalanceSheetSectionRows({
  title,
  items,
  total,
  colorClass,
  bgClass,
}: {
  title: string;
  items: Array<{ accountName: string; amount: number }>;
  total: number;
  colorClass: string;
  bgClass: string;
}) {
  return (
    <>
      <TableRow className={bgClass}>
        <TableCell colSpan={2} className={`font-semibold ${colorClass}`}>
          {title}
        </TableCell>
      </TableRow>
      {items.length === 0 ? (
        <TableRow>
          <TableCell colSpan={2} className="pl-8 text-muted-foreground text-sm italic">
            No {title.toLowerCase()} accounts
          </TableCell>
        </TableRow>
      ) : (
        items.map((item) => (
          <TableRow key={item.accountName}>
            <TableCell className="pl-8">{item.accountName}</TableCell>
            <TableCell className="text-right font-mono">
              {formatCurrency(item.amount)}
            </TableCell>
          </TableRow>
        ))
      )}
      <TableRow className={`border-t ${bgClass}`}>
        <TableCell className="pl-8 font-semibold">Total {title}</TableCell>
        <TableCell className={`text-right font-mono font-semibold ${colorClass}`}>
          {formatCurrency(total)}
        </TableCell>
      </TableRow>
    </>
  );
}
