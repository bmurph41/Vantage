import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { 
  Plus, 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  Target,
  Calendar,
  Building2,
  BarChart3,
  PieChart,
  ArrowUp,
  ArrowDown,
  Minus,
  FileText,
  Edit,
  Link,
  Unlink,
  RefreshCw,
  Anchor,
  CheckCircle,
  AlertCircle
} from "lucide-react";

interface MarinaBudgetTabProps {
  assetId?: string;
  marinaName?: string;
  isPortfolioView?: boolean;
}

interface Budget {
  id: string;
  ownedAssetId: string;
  rentRollId: string | null;
  fiscalYear: number;
  status: string;
  totalBudgetAmount: string;
  rentRollSyncEnabled: boolean | null;
  lastRentRollSyncAt: string | null;
  createdAt: string;
}

interface RentRoll {
  id: string;
  name: string;
  effectiveDate: string;
  context: string;
}

interface LineItem {
  id: string;
  budgetId: string;
  category: string;
  name: string;
  annualAmount: string;
  jan: string; feb: string; mar: string; apr: string; may: string; jun: string;
  jul: string; aug: string; sep: string; oct: string; nov: string; dec: string;
}

interface Comparison {
  budget: Budget;
  comparison: Array<{
    id: string;
    category: string;
    name: string;
    annualBudget: number;
    ytdActual: number;
    ytdVariance: number;
    ytdVariancePercent: number;
    monthlyData: Array<{
      month: string;
      monthNum: number;
      budgeted: number;
      actual: number;
      variance: number;
      variancePercent: number;
    }>;
  }>;
  summary: {
    totalBudgeted: number;
    totalActual: number;
    totalVariance: number;
  };
}

interface PortfolioSummary {
  fiscalYear: number;
  marinaCount: number;
  portfolioTotal: { budgeted: number; actual: number; variance: number };
  categoryBreakdown: Array<{ category: string; budgeted: number; actual: number; variance: number }>;
  marinaSummaries: Array<{
    budgetId: string;
    marinaId: string;
    marinaName: string;
    status: string;
    totalBudgeted: number;
    totalActual: number;
    variance: number;
  }>;
}

const BUDGET_CATEGORIES = [
  { value: "slip_revenue", label: "Slip Revenue", type: "revenue" },
  { value: "fuel_revenue", label: "Fuel Revenue", type: "revenue" },
  { value: "service_revenue", label: "Service Revenue", type: "revenue" },
  { value: "store_revenue", label: "Store Revenue", type: "revenue" },
  { value: "other_revenue", label: "Other Revenue", type: "revenue" },
  { value: "labor_expense", label: "Labor & Payroll", type: "expense" },
  { value: "utilities_expense", label: "Utilities", type: "expense" },
  { value: "maintenance_expense", label: "Maintenance & Repairs", type: "expense" },
  { value: "insurance_expense", label: "Insurance", type: "expense" },
  { value: "marketing_expense", label: "Marketing", type: "expense" },
  { value: "admin_expense", label: "Administrative", type: "expense" },
  { value: "other_expense", label: "Other Expenses", type: "expense" },
];

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

const formatCurrency = (value: number | string): string => {
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "$0";
  if (Math.abs(num) >= 1000000) return `$${(num / 1000000).toFixed(1)}M`;
  if (Math.abs(num) >= 1000) return `$${(num / 1000).toFixed(0)}K`;
  return `$${num.toFixed(0)}`;
};

const getVarianceColor = (variance: number): string => {
  if (variance > 0) return "text-green-600 dark:text-green-400";
  if (variance < 0) return "text-red-600 dark:text-red-400";
  return "text-muted-foreground";
};

const getVarianceIcon = (variance: number) => {
  if (variance > 0) return <ArrowUp className="h-3 w-3" />;
  if (variance < 0) return <ArrowDown className="h-3 w-3" />;
  return <Minus className="h-3 w-3" />;
};

function VarianceCell({ variance, variancePercent }: { variance: number; variancePercent: number }) {
  const color = getVarianceColor(variance);
  return (
    <div className={`flex items-center gap-1 ${color}`}>
      {getVarianceIcon(variance)}
      <span>{formatCurrency(Math.abs(variance))}</span>
      <span className="text-xs">({variancePercent > 0 ? "+" : ""}{variancePercent.toFixed(1)}%)</span>
    </div>
  );
}

function RentRollLinkCard({ budget, assetId, onUpdate }: { budget: Budget; assetId: string; onUpdate: () => void }) {
  const { toast } = useToast();
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [selectedRentRollId, setSelectedRentRollId] = useState<string>("");

  const { data: rentRolls } = useQuery<RentRoll[]>({
    queryKey: ["/api/operations/rent-rolls"],
  });

  const linkRentRoll = useMutation({
    mutationFn: async (rentRollId: string | null) => {
      return apiRequest(`/api/operations/budgets/${budget.id}`, {
        method: "PATCH",
        body: JSON.stringify({ 
          rentRollId, 
          rentRollSyncEnabled: rentRollId !== null 
        }),
      });
    },
    onSuccess: () => {
      toast({ title: "Budget updated", description: "Rent roll link updated successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/operations/budgets/marina", assetId] });
      queryClient.invalidateQueries({ queryKey: ["/api/operations/budgets", budget.id, "comparison"] });
      setShowLinkDialog(false);
      onUpdate();
    },
    onError: (error: any) => {
      toast({ title: "Failed to update", description: error.message, variant: "destructive" });
    },
  });

  const syncFromRentRoll = useMutation({
    mutationFn: async () => {
      const now = new Date();
      return apiRequest(`/api/operations/budgets/${budget.id}/sync-rent-roll`, {
        method: "POST",
        body: JSON.stringify({ 
          month: now.getMonth() + 1,
          year: now.getFullYear()
        }),
      });
    },
    onSuccess: (result: any) => {
      toast({ 
        title: "Sync complete", 
        description: `${result.synced} line item(s) synced from rent roll`
      });
      queryClient.invalidateQueries({ queryKey: ["/api/operations/budgets", budget.id, "comparison"] });
      onUpdate();
    },
    onError: (error: any) => {
      toast({ title: "Sync failed", description: error.message, variant: "destructive" });
    },
  });

  const linkedRentRoll = rentRolls?.find(r => r.id === budget.rentRollId);

  return (
    <TooltipProvider>
      <Card className="mb-4">
        <CardContent className="pt-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-full ${budget.rentRollId ? 'bg-green-100 dark:bg-green-900/30' : 'bg-muted'}`}>
                <Anchor className={`h-4 w-4 ${budget.rentRollId ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}`} />
              </div>
              <div>
                <div className="font-medium flex items-center gap-2">
                  Rent Roll Integration
                  {budget.rentRollId && (
                    <Badge variant="outline" className="text-green-600 border-green-600" data-testid="badge-rent-roll-linked">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Linked
                    </Badge>
                  )}
                </div>
                {linkedRentRoll ? (
                  <div className="text-sm text-muted-foreground">
                    Connected to: <span data-testid="text-linked-rent-roll-name">{linkedRentRoll.name}</span>
                    {budget.lastRentRollSyncAt && (
                      <span className="ml-2" data-testid="text-last-sync">
                        Last sync: {new Date(budget.lastRentRollSyncAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">
                    Link a rent roll to automatically sync storage revenue actuals
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {budget.rentRollId && (
                <>
                  <div className="flex items-center gap-2 mr-4">
                    <Label htmlFor="sync-toggle" className="text-sm">Auto-sync</Label>
                    <Switch
                      id="sync-toggle"
                      checked={budget.rentRollSyncEnabled || false}
                      onCheckedChange={(checked) => {
                        apiRequest(`/api/operations/budgets/${budget.id}`, {
                          method: "PATCH",
                          body: JSON.stringify({ rentRollSyncEnabled: checked }),
                        }).then(() => {
                          queryClient.invalidateQueries({ queryKey: ["/api/operations/budgets/marina", assetId] });
                          toast({ 
                            title: checked ? "Auto-sync enabled" : "Auto-sync disabled",
                            description: checked ? "Budget actuals will sync from rent roll" : "Manual entry mode"
                          });
                        });
                      }}
                      data-testid="switch-auto-sync"
                    />
                  </div>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => syncFromRentRoll.mutate()}
                        disabled={syncFromRentRoll.isPending}
                        data-testid="btn-sync-rent-roll"
                      >
                        <RefreshCw className={`h-4 w-4 mr-1 ${syncFromRentRoll.isPending ? 'animate-spin' : ''}`} />
                        Sync Now
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Pull latest revenue from rent roll</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => linkRentRoll.mutate(null)}
                        disabled={linkRentRoll.isPending}
                        data-testid="btn-unlink-rent-roll"
                      >
                        <Unlink className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Unlink rent roll</TooltipContent>
                  </Tooltip>
                </>
              )}
              {!budget.rentRollId && (
                <Dialog open={showLinkDialog} onOpenChange={setShowLinkDialog}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" data-testid="btn-link-rent-roll">
                      <Link className="h-4 w-4 mr-1" />
                      Link Rent Roll
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Link Rent Roll to Budget</DialogTitle>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                      <p className="text-sm text-muted-foreground">
                        Linking a rent roll allows automatic syncing of storage revenue to your budget actuals.
                      </p>
                      <div className="space-y-2">
                        <Label>Select Rent Roll</Label>
                        <Select value={selectedRentRollId} onValueChange={setSelectedRentRollId}>
                          <SelectTrigger data-testid="select-rent-roll">
                            <SelectValue placeholder="Choose a rent roll..." />
                          </SelectTrigger>
                          <SelectContent>
                            {rentRolls?.filter(r => r.context === 'operational').map((rr) => (
                              <SelectItem key={rr.id} value={rr.id}>
                                {rr.name} ({new Date(rr.effectiveDate).toLocaleDateString()})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setShowLinkDialog(false)}>Cancel</Button>
                      <Button 
                        onClick={() => linkRentRoll.mutate(selectedRentRollId)}
                        disabled={!selectedRentRollId || linkRentRoll.isPending}
                        data-testid="btn-confirm-link"
                      >
                        {linkRentRoll.isPending ? "Linking..." : "Link Rent Roll"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}

function BudgetSummaryCards({ summary }: { summary: { totalBudgeted: number; totalActual: number; totalVariance: number } }) {
  const variancePercent = summary.totalBudgeted !== 0 
    ? (summary.totalVariance / summary.totalBudgeted) * 100 
    : 0;
  
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
            <Target className="h-4 w-4" />
            <span>Annual Budget</span>
          </div>
          <div className="text-2xl font-bold text-blue-600">{formatCurrency(summary.totalBudgeted)}</div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
            <DollarSign className="h-4 w-4" />
            <span>YTD Actual</span>
          </div>
          <div className="text-2xl font-bold">{formatCurrency(summary.totalActual)}</div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
            {summary.totalVariance >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
            <span>Variance</span>
          </div>
          <div className={`text-2xl font-bold ${getVarianceColor(summary.totalVariance)}`}>
            {summary.totalVariance >= 0 ? "+" : ""}{formatCurrency(summary.totalVariance)}
          </div>
          <div className={`text-sm ${getVarianceColor(summary.totalVariance)}`}>
            {variancePercent >= 0 ? "+" : ""}{variancePercent.toFixed(1)}% vs budget
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
            <BarChart3 className="h-4 w-4" />
            <span>Progress</span>
          </div>
          <div className="mt-2">
            <Progress 
              value={summary.totalBudgeted > 0 ? Math.min((summary.totalActual / summary.totalBudgeted) * 100, 100) : 0} 
              className="h-3"
            />
            <div className="text-sm text-muted-foreground mt-1">
              {summary.totalBudgeted > 0 ? ((summary.totalActual / summary.totalBudgeted) * 100).toFixed(0) : 0}% of budget used
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function CreateBudgetDialog({ assetId, year, onCreated }: { assetId: string; year: number; onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  const createBudget = useMutation({
    mutationFn: async () => {
      return apiRequest("/api/operations/budgets", {
        method: "POST",
        body: JSON.stringify({ ownedAssetId: assetId, fiscalYear: year, status: "draft" }),
      });
    },
    onSuccess: () => {
      toast({ title: "Budget created", description: `Created budget for fiscal year ${year}` });
      queryClient.invalidateQueries({ queryKey: ["/api/operations/budgets/marina", assetId] });
      onCreated();
      setOpen(false);
    },
    onError: (error: any) => {
      toast({ title: "Failed to create budget", description: error.message, variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button data-testid="btn-create-budget"><Plus className="h-4 w-4 mr-2" />Create {year} Budget</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Annual Budget</DialogTitle>
        </DialogHeader>
        <div className="py-4">
          <p className="text-muted-foreground">
            Create a new budget for fiscal year {year}. You can then add line items for revenue and expense categories.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={() => createBudget.mutate()} disabled={createBudget.isPending} data-testid="btn-confirm-create">
            {createBudget.isPending ? "Creating..." : "Create Budget"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BudgetComparisonTable({ comparison }: { comparison: Comparison }) {
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);

  const revenueItems = comparison.comparison.filter(c => c.category.includes("revenue"));
  const expenseItems = comparison.comparison.filter(c => c.category.includes("expense"));

  const renderSection = (items: typeof comparison.comparison, title: string, type: "revenue" | "expense") => (
    <div className="mb-6">
      <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide mb-2">{title}</h4>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[200px]">Line Item</TableHead>
            <TableHead className="text-right">Annual Budget</TableHead>
            <TableHead className="text-right">YTD Actual</TableHead>
            <TableHead className="text-right">Variance</TableHead>
            {selectedMonth !== null && (
              <>
                <TableHead className="text-right">{MONTHS[selectedMonth]} Budget</TableHead>
                <TableHead className="text-right">{MONTHS[selectedMonth]} Actual</TableHead>
              </>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.length === 0 ? (
            <TableRow>
              <TableCell colSpan={selectedMonth !== null ? 6 : 4} className="text-center text-muted-foreground">
                No {type} items in this budget
              </TableCell>
            </TableRow>
          ) : (
            items.map((item) => {
              const monthData = selectedMonth !== null ? item.monthlyData[selectedMonth] : null;
              return (
                <TableRow key={item.id} data-testid={`budget-row-${item.id}`}>
                  <TableCell className="font-medium">
                    <div>{item.name}</div>
                    <div className="text-xs text-muted-foreground">{BUDGET_CATEGORIES.find(c => c.value === item.category)?.label || item.category}</div>
                  </TableCell>
                  <TableCell className="text-right">{formatCurrency(item.annualBudget)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(item.ytdActual)}</TableCell>
                  <TableCell className="text-right">
                    <VarianceCell variance={type === "revenue" ? item.ytdVariance : -item.ytdVariance} variancePercent={item.ytdVariancePercent} />
                  </TableCell>
                  {monthData && (
                    <>
                      <TableCell className="text-right">{formatCurrency(monthData.budgeted)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(monthData.actual)}</TableCell>
                    </>
                  )}
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );

  return (
    <div>
      <div className="flex items-center gap-4 mb-4">
        <Label>View Month:</Label>
        <Select value={selectedMonth?.toString() || "all"} onValueChange={(v) => setSelectedMonth(v === "all" ? null : parseInt(v))}>
          <SelectTrigger className="w-[150px]" data-testid="select-month">
            <SelectValue placeholder="All (YTD)" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All (YTD)</SelectItem>
            {MONTHS.map((m, i) => (
              <SelectItem key={m} value={i.toString()}>{m}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {renderSection(revenueItems, "Revenue", "revenue")}
      {renderSection(expenseItems, "Expenses", "expense")}
    </div>
  );
}

function PortfolioBudgetView({ year }: { year: number }) {
  const { data: portfolioSummary, isLoading } = useQuery<PortfolioSummary>({
    queryKey: ["/api/operations/budgets/portfolio/summary", year],
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!portfolioSummary || portfolioSummary.marinaCount === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <PieChart className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-medium mb-2">No Portfolio Budgets</h3>
          <p className="text-muted-foreground mb-4">
            Create budgets for individual marinas to see portfolio-level consolidation.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div>
      <BudgetSummaryCards summary={portfolioSummary.portfolioTotal} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Category Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Budget</TableHead>
                  <TableHead className="text-right">Actual</TableHead>
                  <TableHead className="text-right">Variance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {portfolioSummary.categoryBreakdown.map((cat) => (
                  <TableRow key={cat.category}>
                    <TableCell className="font-medium">
                      {BUDGET_CATEGORIES.find(c => c.value === cat.category)?.label || cat.category}
                    </TableCell>
                    <TableCell className="text-right">{formatCurrency(cat.budgeted)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(cat.actual)}</TableCell>
                    <TableCell className="text-right">
                      <VarianceCell variance={cat.variance} variancePercent={cat.budgeted ? (cat.variance / cat.budgeted) * 100 : 0} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Marina Comparison</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Marina</TableHead>
                  <TableHead className="text-right">Budget</TableHead>
                  <TableHead className="text-right">Actual</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {portfolioSummary.marinaSummaries.map((marina) => {
                  const variancePercent = marina.totalBudgeted ? (marina.variance / marina.totalBudgeted) * 100 : 0;
                  return (
                    <TableRow key={marina.budgetId} data-testid={`portfolio-marina-${marina.marinaId}`}>
                      <TableCell className="font-medium">{marina.marinaName}</TableCell>
                      <TableCell className="text-right">{formatCurrency(marina.totalBudgeted)}</TableCell>
                      <TableCell className="text-right">
                        <div className={getVarianceColor(marina.variance)}>
                          {formatCurrency(marina.totalActual)}
                          <span className="text-xs ml-1">({variancePercent >= 0 ? "+" : ""}{variancePercent.toFixed(0)}%)</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={marina.status === "approved" ? "default" : "secondary"}>
                          {marina.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function MarinaBudgetView({ assetId, marinaName, year }: { assetId: string; marinaName: string; year: number }) {
  const { data: budgets, isLoading } = useQuery<Budget[]>({
    queryKey: ["/api/operations/budgets/marina", assetId],
  });

  const currentBudget = budgets?.find(b => b.fiscalYear === year);

  const { data: comparison, isLoading: comparisonLoading } = useQuery<Comparison>({
    queryKey: ["/api/operations/budgets", currentBudget?.id, "comparison"],
    enabled: !!currentBudget,
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!currentBudget) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-medium mb-2">No Budget for {year}</h3>
          <p className="text-muted-foreground mb-4">
            Create an annual budget for {marinaName} to track revenue and expenses against targets.
          </p>
          <CreateBudgetDialog assetId={assetId} year={year} onCreated={() => {}} />
        </CardContent>
      </Card>
    );
  }

  if (comparisonLoading || !comparison) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const handleUpdate = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/operations/budgets/marina", assetId] });
    queryClient.invalidateQueries({ queryKey: ["/api/operations/budgets", currentBudget.id, "comparison"] });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Badge variant={currentBudget.status === "approved" ? "default" : "secondary"}>
            {currentBudget.status}
          </Badge>
          <span className="text-muted-foreground text-sm">
            Total Budget: {formatCurrency(currentBudget.totalBudgetAmount)}
          </span>
        </div>
        <Button variant="outline" size="sm" data-testid="btn-edit-budget">
          <Edit className="h-4 w-4 mr-2" />
          Edit Budget
        </Button>
      </div>

      <RentRollLinkCard budget={currentBudget} assetId={assetId} onUpdate={handleUpdate} />

      <BudgetSummaryCards summary={comparison.summary} />
      <BudgetComparisonTable comparison={comparison} />
    </div>
  );
}

export default function MarinaBudgetTab({ assetId, marinaName, isPortfolioView = false }: MarinaBudgetTabProps) {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);

  const years = [currentYear - 1, currentYear, currentYear + 1];

  return (
    <div data-testid="marina-budget-tab">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold">
            {isPortfolioView ? "Portfolio Budget" : `${marinaName || "Marina"} Budget`}
          </h3>
          <p className="text-sm text-muted-foreground">
            Track budget vs actual performance with monthly variance analysis
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v))}>
              <SelectTrigger className="w-[120px]" data-testid="select-fiscal-year">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {years.map((y) => (
                  <SelectItem key={y} value={y.toString()}>FY {y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {isPortfolioView ? (
        <PortfolioBudgetView year={selectedYear} />
      ) : assetId ? (
        <MarinaBudgetView assetId={assetId} marinaName={marinaName || "Marina"} year={selectedYear} />
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <Building2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-medium mb-2">Select a Marina</h3>
            <p className="text-muted-foreground">
              Choose a marina from the overview to view its budget
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
