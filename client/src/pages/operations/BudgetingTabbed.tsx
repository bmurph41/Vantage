import { useState, useCallback, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  Plus, FileText, Calendar, DollarSign, TrendingUp, TrendingDown, ArrowUpRight,
  ArrowDownRight, BarChart3, Trash2, Lock, Unlock, CheckCircle2, AlertCircle,
  Save, RefreshCw, ChevronRight, Minus
} from "lucide-react";
import { cn } from "@/lib/utils";

type Budget = {
  id: string;
  name: string;
  fiscalYear: number;
  type: string;
  scopeType: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  versions?: BudgetVersion[];
};

type BudgetVersion = {
  id: string;
  budgetId: string;
  name: string;
  isPrimary: boolean;
};

type BudgetLine = {
  id: string;
  budgetVersionId: string;
  sortOrder: number;
  lineType: string;
  accountKey: string;
  displayName: string;
};

type GridData = {
  lines: BudgetLine[];
  amounts: Record<string, Record<string, string>>;
};

type BvaLine = BudgetLine & {
  monthly: { month: string; budget: number; actual: number; varDollar: number; varPct: number; favorable: boolean }[];
  totals: { budget: number; actual: number; varDollar: number; varPct: number; favorable: boolean };
};

type BvaData = {
  budget: Budget;
  lines: BvaLine[];
  summary: {
    totalRevenueBudget: number; totalRevenueActual: number;
    totalExpenseBudget: number; totalExpenseActual: number;
    noiBudget: number; noiActual: number;
  };
  months: string[];
};

const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const LINE_TYPE_COLORS: Record<string, string> = {
  REVENUE: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  COGS: "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  OPEX: "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  OTHER_INCOME: "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  OTHER_EXPENSE: "bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
};

function formatCurrency(val: number): string {
  if (Math.abs(val) >= 1000000) return `$${(val / 1000000).toFixed(1)}M`;
  if (Math.abs(val) >= 1000) return `$${(val / 1000).toFixed(1)}K`;
  return `$${val.toFixed(0)}`;
}

function formatAmount(val: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(val);
}

export default function BudgetingTabbed() {
  const [tab, setTab] = useState("list");
  const [selectedBudget, setSelectedBudget] = useState<Budget | null>(null);
  const [selectedVersion, setSelectedVersion] = useState<BudgetVersion | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Budgeting</h2>
          <p className="text-sm text-muted-foreground mt-1">Create budgets, track actuals, and analyze variance</p>
        </div>
        <div className="flex gap-2">
          <SeedActualsButton />
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Budget
          </Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="list">Budgets</TabsTrigger>
          <TabsTrigger value="editor" disabled={!selectedBudget}>Editor</TabsTrigger>
          <TabsTrigger value="bva" disabled={!selectedBudget}>Budget vs Actual</TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="mt-4">
          <BudgetList
            onSelect={(b) => {
              setSelectedBudget(b);
              const primary = b.versions?.find(v => v.isPrimary) || b.versions?.[0];
              setSelectedVersion(primary || null);
              setTab("editor");
            }}
            onBva={(b) => {
              setSelectedBudget(b);
              setTab("bva");
            }}
          />
        </TabsContent>

        <TabsContent value="editor" className="mt-4">
          {selectedBudget && selectedVersion && (
            <BudgetEditor budget={selectedBudget} version={selectedVersion} />
          )}
        </TabsContent>

        <TabsContent value="bva" className="mt-4">
          {selectedBudget && (
            <BudgetVsActual budgetId={selectedBudget.id} />
          )}
        </TabsContent>
      </Tabs>

      <CreateBudgetDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={(b) => {
        setSelectedBudget(b.budget);
        setSelectedVersion(b.version);
        setTab("editor");
      }} />
    </div>
  );
}

function SeedActualsButton() {
  const { toast } = useToast();
  const mutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/budgets/seed-actuals", { fiscalYear: 2025 });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/budgets"] });
      toast({ title: data.seeded ? "Actuals seeded" : "Already seeded", description: data.message });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to seed actuals", description: error.message, variant: "destructive" });
    },
  });

  return (
    <Button variant="outline" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
      <RefreshCw className={cn("h-4 w-4 mr-2", mutation.isPending && "animate-spin")} />
      Seed Demo Actuals
    </Button>
  );
}

function BudgetList({ onSelect, onBva }: { onSelect: (b: Budget) => void; onBva: (b: Budget) => void }) {
  const { data: budgetList, isLoading } = useQuery<Budget[]>({ queryKey: ["/api/budgets"] });
  const { toast } = useToast();

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/budgets/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/budgets"] });
      toast({ title: "Budget deleted" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to delete budget", description: error.message, variant: "destructive" });
    },
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await apiRequest("PATCH", `/api/budgets/${id}`, { status });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/budgets"] });
      toast({ title: `Budget ${data.status === "LOCKED" ? "locked" : "unlocked"}` });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to update status", description: error.message, variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map(i => (
          <Card key={i}><CardContent className="p-6"><Skeleton className="h-24 w-full" /></CardContent></Card>
        ))}
      </div>
    );
  }

  if (!budgetList?.length) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16">
          <FileText className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Budgets Yet</h3>
          <p className="text-muted-foreground text-center max-w-md mb-4">
            Create your first budget to start tracking financial performance against plan. Seed demo actuals first for a realistic comparison.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {budgetList.map(b => (
        <Card key={b.id} className="hover:shadow-md transition-shadow cursor-pointer group">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-base">{b.name}</CardTitle>
                <CardDescription className="flex items-center gap-2 mt-1">
                  <Calendar className="h-3.5 w-3.5" />
                  FY {b.fiscalYear}
                </CardDescription>
              </div>
              <Badge variant={b.status === "DRAFT" ? "outline" : b.status === "LOCKED" ? "default" : "secondary"}>
                {b.status === "DRAFT" && <Unlock className="h-3 w-3 mr-1" />}
                {b.status === "LOCKED" && <Lock className="h-3 w-3 mr-1" />}
                {b.status}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex items-center gap-1 text-xs text-muted-foreground mb-4">
              <Badge variant="outline" className="text-xs">{b.type.replace(/_/g, ' ')}</Badge>
              <Badge variant="outline" className="text-xs">{b.scopeType}</Badge>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="flex-1" onClick={() => onSelect(b)}>
                Edit
                <ChevronRight className="h-3.5 w-3.5 ml-1" />
              </Button>
              <Button size="sm" variant="outline" className="flex-1" onClick={() => onBva(b)}>
                <BarChart3 className="h-3.5 w-3.5 mr-1" />
                BvA
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={(e) => { e.stopPropagation(); statusMutation.mutate({ id: b.id, status: b.status === "LOCKED" ? "DRAFT" : "LOCKED" }); }}
              >
                {b.status === "LOCKED" ? <Unlock className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
              </Button>
              <Button size="sm" variant="ghost" className="text-destructive" onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(b.id); }}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function CreateBudgetDialog({ open, onOpenChange, onCreated }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (data: { budget: Budget; version: BudgetVersion }) => void;
}) {
  const [name, setName] = useState("");
  const [fiscalYear, setFiscalYear] = useState("2025");
  const [seedMethod, setSeedMethod] = useState("BLANK");
  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/budgets", {
        name: name || `FY ${fiscalYear} Budget`,
        fiscalYear: parseInt(fiscalYear),
        type: "OPERATING_PL",
        scopeType: "PORTFOLIO",
        status: "DRAFT",
        currency: "USD",
        seedMethod,
      });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/budgets"] });
      toast({ title: "Budget created", description: `${data.budget.name} is ready for editing` });
      onOpenChange(false);
      onCreated(data);
      setName("");
    },
    onError: (error: Error) => {
      toast({ title: "Failed to create budget", description: error.message, variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New Budget</DialogTitle>
          <DialogDescription>Set up a new budget for your marina portfolio</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div>
            <Label>Budget Name</Label>
            <Input
              placeholder={`FY ${fiscalYear} Operating Budget`}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div>
            <Label>Fiscal Year</Label>
            <Select value={fiscalYear} onValueChange={setFiscalYear}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="2024">2024</SelectItem>
                <SelectItem value="2025">2025</SelectItem>
                <SelectItem value="2026">2026</SelectItem>
                <SelectItem value="2027">2027</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Starting Method</Label>
            <Select value={seedMethod} onValueChange={setSeedMethod}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="BLANK">Blank (standard line items, $0)</SelectItem>
                <SelectItem value="ACTUALS">Copy Prior Actuals</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">
              {seedMethod === "ACTUALS"
                ? "Pre-fills each line from your actual data for the same year"
                : "Creates standard marina P&L line items with zero amounts"
              }
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending ? "Creating..." : "Create Budget"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BudgetEditor({ budget, version }: { budget: Budget; version: BudgetVersion }) {
  const { toast } = useToast();
  const [editedCells, setEditedCells] = useState<Record<string, string>>({});
  const [hasChanges, setHasChanges] = useState(false);

  const { data: gridData, isLoading } = useQuery<GridData>({
    queryKey: ["/api/budgets/version", version.id, "grid"],
    queryFn: async () => {
      const res = await fetch(`/api/budgets/version/${version.id}/grid`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load grid data");
      return res.json();
    },
  });

  const months = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const m = (i + 1).toString().padStart(2, '0');
      return `${budget.fiscalYear}-${m}-01`;
    });
  }, [budget.fiscalYear]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const updates = Object.entries(editedCells).map(([key, amount]) => {
        const [budgetLineId, periodStart] = key.split("|");
        return { budgetLineId, periodStart, amount };
      });
      if (updates.length === 0) return;
      await apiRequest("PUT", `/api/budgets/version/${version.id}/amounts`, { updates });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/budgets/version", version.id, "grid"] });
      setEditedCells({});
      setHasChanges(false);
      toast({ title: "Budget saved", description: "All changes have been saved" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to save budget", description: error.message, variant: "destructive" });
    },
  });

  const handleCellChange = useCallback((lineId: string, month: string, value: string) => {
    const numVal = value.replace(/[^0-9.\-]/g, '');
    const key = `${lineId}|${month}`;
    setEditedCells(prev => ({ ...prev, [key]: numVal }));
    setHasChanges(true);
  }, []);

  const getCellValue = useCallback((lineId: string, month: string): string => {
    const key = `${lineId}|${month}`;
    if (editedCells[key] !== undefined) return editedCells[key];
    return gridData?.amounts[lineId]?.[month] || '0';
  }, [editedCells, gridData]);

  const getLineTotal = useCallback((lineId: string): number => {
    return months.reduce((sum, m) => sum + parseFloat(getCellValue(lineId, m) || '0'), 0);
  }, [months, getCellValue]);

  if (isLoading) {
    return <Card><CardContent className="p-6"><Skeleton className="h-96 w-full" /></CardContent></Card>;
  }

  const lines = gridData?.lines || [];
  const grouped: Record<string, BudgetLine[]> = {};
  for (const line of lines) {
    if (!grouped[line.lineType]) grouped[line.lineType] = [];
    grouped[line.lineType].push(line);
  }

  const sectionOrder = ["REVENUE", "OTHER_INCOME", "COGS", "OPEX", "OTHER_EXPENSE"];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">{budget.name}</h2>
          <p className="text-sm text-muted-foreground">Version: {version.name} | FY {budget.fiscalYear}</p>
        </div>
        <div className="flex gap-2">
          {hasChanges && (
            <Badge variant="outline" className="text-amber-600">
              <AlertCircle className="h-3 w-3 mr-1" />
              Unsaved changes
            </Badge>
          )}
          <Button onClick={() => saveMutation.mutate()} disabled={!hasChanges || saveMutation.isPending}>
            <Save className="h-4 w-4 mr-2" />
            {saveMutation.isPending ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>

      <div className="border rounded-lg overflow-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50">
              <th className="text-left px-3 py-2 font-medium sticky left-0 bg-muted/50 min-w-[200px] z-10">Account</th>
              {MONTHS_SHORT.map(m => (
                <th key={m} className="text-right px-3 py-2 font-medium min-w-[100px]">{m}</th>
              ))}
              <th className="text-right px-3 py-2 font-semibold min-w-[110px] bg-muted/80">Total</th>
            </tr>
          </thead>
          <tbody>
            {sectionOrder.map(section => {
              const sectionLines = grouped[section];
              if (!sectionLines?.length) return null;

              const sectionTotal = sectionLines.reduce((s, l) => s + getLineTotal(l.id), 0);

              return (
                <SectionBlock
                  key={section}
                  section={section}
                  lines={sectionLines}
                  months={months}
                  getCellValue={getCellValue}
                  getLineTotal={getLineTotal}
                  onCellChange={handleCellChange}
                  sectionTotal={sectionTotal}
                  isLocked={budget.status === "LOCKED"}
                />
              );
            })}
            <tr className="bg-slate-100 dark:bg-slate-800 font-bold border-t-2">
              <td className="px-3 py-2 sticky left-0 bg-slate-100 dark:bg-slate-800 z-10">Net Operating Income</td>
              {months.map((m, i) => {
                const rev = (grouped["REVENUE"] || []).reduce((s, l) => s + parseFloat(getCellValue(l.id, m) || '0'), 0)
                  + (grouped["OTHER_INCOME"] || []).reduce((s, l) => s + parseFloat(getCellValue(l.id, m) || '0'), 0);
                const exp = (grouped["COGS"] || []).reduce((s, l) => s + parseFloat(getCellValue(l.id, m) || '0'), 0)
                  + (grouped["OPEX"] || []).reduce((s, l) => s + parseFloat(getCellValue(l.id, m) || '0'), 0)
                  + (grouped["OTHER_EXPENSE"] || []).reduce((s, l) => s + parseFloat(getCellValue(l.id, m) || '0'), 0);
                const noi = rev - exp;
                return (
                  <td key={i} className={cn("text-right px-3 py-2", noi >= 0 ? "text-emerald-600" : "text-red-600")}>
                    {formatAmount(noi)}
                  </td>
                );
              })}
              <td className="text-right px-3 py-2 bg-slate-200 dark:bg-slate-700">
                {formatAmount(
                  ["REVENUE", "OTHER_INCOME"].reduce((s, t) => s + (grouped[t] || []).reduce((s2, l) => s2 + getLineTotal(l.id), 0), 0)
                  - ["COGS", "OPEX", "OTHER_EXPENSE"].reduce((s, t) => s + (grouped[t] || []).reduce((s2, l) => s2 + getLineTotal(l.id), 0), 0)
                )}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SectionBlock({
  section, lines, months, getCellValue, getLineTotal, onCellChange, sectionTotal, isLocked,
}: {
  section: string;
  lines: BudgetLine[];
  months: string[];
  getCellValue: (lineId: string, month: string) => string;
  getLineTotal: (lineId: string) => number;
  onCellChange: (lineId: string, month: string, value: string) => void;
  sectionTotal: number;
  isLocked: boolean;
}) {
  const sectionLabels: Record<string, string> = {
    REVENUE: "Revenue",
    COGS: "Cost of Goods Sold",
    OPEX: "Operating Expenses",
    OTHER_INCOME: "Other Income",
    OTHER_EXPENSE: "Other Expense",
  };

  return (
    <>
      <tr className="bg-muted/30">
        <td colSpan={14} className="px-3 py-1.5 font-semibold text-xs uppercase tracking-wide sticky left-0 bg-muted/30 z-10">
          <Badge className={cn("mr-2", LINE_TYPE_COLORS[section])} variant="outline">
            {sectionLabels[section] || section}
          </Badge>
        </td>
      </tr>
      {lines.map(line => (
        <tr key={line.id} className="border-b hover:bg-muted/20 transition-colors">
          <td className="px-3 py-1 sticky left-0 bg-background z-10 text-sm font-medium">
            {line.displayName}
          </td>
          {months.map(m => (
            <td key={m} className="px-1 py-0.5">
              <input
                type="text"
                className="w-full text-right px-2 py-1 text-sm bg-transparent border border-transparent hover:border-border focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary rounded transition-colors"
                value={getCellValue(line.id, m)}
                onChange={(e) => onCellChange(line.id, m, e.target.value)}
                disabled={isLocked}
              />
            </td>
          ))}
          <td className="text-right px-3 py-1 font-medium bg-muted/20">
            {formatAmount(getLineTotal(line.id))}
          </td>
        </tr>
      ))}
      <tr className="border-b-2 bg-muted/10">
        <td className="px-3 py-1 sticky left-0 bg-muted/10 z-10 font-semibold text-sm">
          Total {sectionLabels[section]}
        </td>
        {months.map((m, i) => {
          const monthTotal = lines.reduce((s, l) => s + parseFloat(getCellValue(l.id, m) || '0'), 0);
          return <td key={i} className="text-right px-3 py-1 font-semibold text-sm">{formatAmount(monthTotal)}</td>;
        })}
        <td className="text-right px-3 py-1 font-bold bg-muted/30">
          {formatAmount(sectionTotal)}
        </td>
      </tr>
    </>
  );
}

function BudgetVsActual({ budgetId }: { budgetId: string }) {
  const { data, isLoading } = useQuery<BvaData>({
    queryKey: ["/api/budgets/bva", budgetId],
    queryFn: async () => {
      const res = await fetch(`/api/budgets/bva/${budgetId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load budget vs actual data");
      return res.json();
    },
  });

  if (isLoading) {
    return <Card><CardContent className="p-6"><Skeleton className="h-96 w-full" /></CardContent></Card>;
  }

  if (!data || !data.lines?.length) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16">
          <BarChart3 className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Data Available</h3>
          <p className="text-muted-foreground text-center max-w-md">
            This budget has no line items or there are no actuals to compare. Seed demo actuals and add budget amounts first.
          </p>
        </CardContent>
      </Card>
    );
  }

  const { summary, lines, months } = data;
  const revenueVar = summary.totalRevenueActual - summary.totalRevenueBudget;
  const expenseVar = summary.totalExpenseActual - summary.totalExpenseBudget;
  const noiVar = summary.noiActual - summary.noiBudget;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <SummaryCard
          title="Total Revenue"
          budget={summary.totalRevenueBudget}
          actual={summary.totalRevenueActual}
          variance={revenueVar}
          favorable={revenueVar >= 0}
        />
        <SummaryCard
          title="Total Expenses"
          budget={summary.totalExpenseBudget}
          actual={summary.totalExpenseActual}
          variance={expenseVar}
          favorable={expenseVar <= 0}
        />
        <SummaryCard
          title="Net Operating Income"
          budget={summary.noiBudget}
          actual={summary.noiActual}
          variance={noiVar}
          favorable={noiVar >= 0}
        />
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground font-medium uppercase">Budget Accuracy</p>
            <p className="text-2xl font-bold mt-1">
              {summary.noiBudget !== 0
                ? `${Math.max(0, 100 - Math.abs((noiVar / summary.noiBudget) * 100)).toFixed(1)}%`
                : "N/A"
              }
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              NOI variance: {summary.noiBudget !== 0 ? `${((noiVar / Math.abs(summary.noiBudget)) * 100).toFixed(1)}%` : "N/A"}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Detailed Variance Analysis</CardTitle>
          <CardDescription>Full-year view — Budget vs Actual with dollar and percentage variance</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 border-b">
                  <th className="text-left px-3 py-2 font-medium sticky left-0 bg-muted/50 min-w-[180px] z-10">Account</th>
                  <th className="text-right px-3 py-2 font-medium">Budget (YTD)</th>
                  <th className="text-right px-3 py-2 font-medium">Actual (YTD)</th>
                  <th className="text-right px-3 py-2 font-medium">Var $</th>
                  <th className="text-right px-3 py-2 font-medium">Var %</th>
                  <th className="text-center px-3 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {groupBvaLines(lines).map(({ section, sectionLines }) => (
                  <BvaSection key={section} section={section} lines={sectionLines} />
                ))}
                <tr className="bg-slate-100 dark:bg-slate-800 font-bold border-t-2">
                  <td className="px-3 py-2 sticky left-0 bg-slate-100 dark:bg-slate-800 z-10">Net Operating Income</td>
                  <td className="text-right px-3 py-2">{formatAmount(summary.noiBudget)}</td>
                  <td className="text-right px-3 py-2">{formatAmount(summary.noiActual)}</td>
                  <td className={cn("text-right px-3 py-2", noiVar >= 0 ? "text-emerald-600" : "text-red-600")}>
                    {noiVar >= 0 ? "+" : ""}{formatAmount(noiVar)}
                  </td>
                  <td className={cn("text-right px-3 py-2", noiVar >= 0 ? "text-emerald-600" : "text-red-600")}>
                    {summary.noiBudget !== 0 ? `${((noiVar / Math.abs(summary.noiBudget)) * 100).toFixed(1)}%` : "—"}
                  </td>
                  <td className="text-center px-3 py-2">
                    {noiVar >= 0
                      ? <CheckCircle2 className="h-4 w-4 text-emerald-500 inline" />
                      : <AlertCircle className="h-4 w-4 text-red-500 inline" />
                    }
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Monthly Trend</CardTitle>
          <CardDescription>Revenue, expenses, and NOI by month — budget vs actual</CardDescription>
        </CardHeader>
        <CardContent>
          <MonthlyTrendChart lines={lines} months={months} />
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryCard({ title, budget, actual, variance, favorable }: {
  title: string; budget: number; actual: number; variance: number; favorable: boolean;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground font-medium uppercase">{title}</p>
        <p className="text-2xl font-bold mt-1">{formatCurrency(actual)}</p>
        <div className="flex items-center gap-1 mt-2">
          {favorable
            ? <ArrowUpRight className="h-3.5 w-3.5 text-emerald-500" />
            : <ArrowDownRight className="h-3.5 w-3.5 text-red-500" />
          }
          <span className={cn("text-xs font-medium", favorable ? "text-emerald-600" : "text-red-600")}>
            {variance >= 0 ? "+" : ""}{formatCurrency(variance)}
          </span>
          <span className="text-xs text-muted-foreground">vs budget {formatCurrency(budget)}</span>
        </div>
      </CardContent>
    </Card>
  );
}

function groupBvaLines(lines: BvaLine[]) {
  const grouped: Record<string, BvaLine[]> = {};
  for (const l of lines) {
    if (!grouped[l.lineType]) grouped[l.lineType] = [];
    grouped[l.lineType].push(l);
  }
  const order = ["REVENUE", "OTHER_INCOME", "COGS", "OPEX", "OTHER_EXPENSE"];
  return order
    .filter(s => grouped[s]?.length)
    .map(s => ({ section: s, sectionLines: grouped[s] }));
}

function BvaSection({ section, lines }: { section: string; lines: BvaLine[] }) {
  const sectionLabels: Record<string, string> = {
    REVENUE: "Revenue", COGS: "Cost of Goods Sold", OPEX: "Operating Expenses",
    OTHER_INCOME: "Other Income", OTHER_EXPENSE: "Other Expense",
  };

  const totBudget = lines.reduce((s, l) => s + l.totals.budget, 0);
  const totActual = lines.reduce((s, l) => s + l.totals.actual, 0);
  const totVar = totActual - totBudget;
  const isExpense = ['COGS', 'OPEX', 'OTHER_EXPENSE'].includes(section);
  const totFavorable = isExpense ? totVar <= 0 : totVar >= 0;

  return (
    <>
      <tr className="bg-muted/20">
        <td colSpan={6} className="px-3 py-1.5 font-semibold text-xs uppercase tracking-wide sticky left-0 bg-muted/20 z-10">
          <Badge className={cn("mr-2", LINE_TYPE_COLORS[section])} variant="outline">
            {sectionLabels[section]}
          </Badge>
        </td>
      </tr>
      {lines.map(line => (
        <tr key={line.id} className="border-b hover:bg-muted/10 transition-colors">
          <td className="px-3 py-1.5 sticky left-0 bg-background z-10">{line.displayName}</td>
          <td className="text-right px-3 py-1.5 tabular-nums">{formatAmount(line.totals.budget)}</td>
          <td className="text-right px-3 py-1.5 tabular-nums">{formatAmount(line.totals.actual)}</td>
          <td className={cn("text-right px-3 py-1.5 tabular-nums", line.totals.favorable ? "text-emerald-600" : "text-red-600")}>
            {line.totals.varDollar >= 0 ? "+" : ""}{formatAmount(line.totals.varDollar)}
          </td>
          <td className={cn("text-right px-3 py-1.5 tabular-nums", line.totals.favorable ? "text-emerald-600" : "text-red-600")}>
            {line.totals.varPct >= 0 ? "+" : ""}{line.totals.varPct.toFixed(1)}%
          </td>
          <td className="text-center px-3 py-1.5">
            {line.totals.favorable
              ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 inline" />
              : <AlertCircle className="h-3.5 w-3.5 text-red-500 inline" />
            }
          </td>
        </tr>
      ))}
      <tr className="border-b-2 bg-muted/10 font-semibold">
        <td className="px-3 py-1.5 sticky left-0 bg-muted/10 z-10">Total {sectionLabels[section]}</td>
        <td className="text-right px-3 py-1.5 tabular-nums">{formatAmount(totBudget)}</td>
        <td className="text-right px-3 py-1.5 tabular-nums">{formatAmount(totActual)}</td>
        <td className={cn("text-right px-3 py-1.5 tabular-nums", totFavorable ? "text-emerald-600" : "text-red-600")}>
          {totVar >= 0 ? "+" : ""}{formatAmount(totVar)}
        </td>
        <td className={cn("text-right px-3 py-1.5 tabular-nums", totFavorable ? "text-emerald-600" : "text-red-600")}>
          {totBudget !== 0 ? `${((totVar / Math.abs(totBudget)) * 100).toFixed(1)}%` : "—"}
        </td>
        <td />
      </tr>
    </>
  );
}

function MonthlyTrendChart({ lines, months }: { lines: BvaLine[]; months: string[] }) {
  const data = months.map((m, i) => {
    let revBudget = 0, revActual = 0, expBudget = 0, expActual = 0;
    for (const l of lines) {
      const md = l.monthly[i];
      if (!md) continue;
      if (['REVENUE', 'OTHER_INCOME'].includes(l.lineType)) {
        revBudget += md.budget;
        revActual += md.actual;
      } else {
        expBudget += md.budget;
        expActual += md.actual;
      }
    }
    return {
      month: MONTHS_SHORT[i],
      revBudget, revActual, expBudget, expActual,
      noiBudget: revBudget - expBudget,
      noiActual: revActual - expActual,
    };
  });

  const allValues = data.flatMap(d => [d.revBudget, d.revActual, d.noiBudget, d.noiActual]);
  const maxVal = Math.max(...allValues, 1);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-12 gap-1">
        {data.map((d, i) => {
          const barH = 120;
          const noiH = Math.abs(d.noiActual) / maxVal * barH;
          const noiBH = Math.abs(d.noiBudget) / maxVal * barH;
          return (
            <div key={i} className="flex flex-col items-center">
              <div className="relative w-full h-[120px] flex items-end justify-center gap-[2px]">
                <div
                  className="w-[40%] bg-blue-200 dark:bg-blue-800 rounded-t"
                  style={{ height: `${noiBH}px` }}
                  title={`Budget NOI: ${formatAmount(d.noiBudget)}`}
                />
                <div
                  className={cn("w-[40%] rounded-t", d.noiActual >= 0 ? "bg-emerald-400 dark:bg-emerald-600" : "bg-red-400 dark:bg-red-600")}
                  style={{ height: `${noiH}px` }}
                  title={`Actual NOI: ${formatAmount(d.noiActual)}`}
                />
              </div>
              <span className="text-xs text-muted-foreground mt-1">{d.month}</span>
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-4 justify-center text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-blue-200 dark:bg-blue-800" />
          Budget NOI
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-emerald-400 dark:bg-emerald-600" />
          Actual NOI
        </div>
      </div>
    </div>
  );
}
