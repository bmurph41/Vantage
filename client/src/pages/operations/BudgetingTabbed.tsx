import React, { useState, useCallback, useEffect, useMemo, useRef } from "react";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import {
  Plus, FileText, Calendar, DollarSign, TrendingUp, TrendingDown, ArrowUpRight,
  ArrowDownRight, BarChart3, Trash2, Lock, Unlock, CheckCircle2, AlertCircle,
  Save, RefreshCw, ChevronRight, Minus, MoreHorizontal, SplitSquareVertical,
  Percent, BarChart2, Copy, Upload, Zap, BrainCircuit, PanelRightOpen,
  PanelRightClose, Lightbulb, HelpCircle, Sliders, ChevronDown
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
            <BudgetEditor
              budget={selectedBudget}
              version={selectedVersion}
              onVersionChange={(v) => setSelectedVersion(v)}
            />
          )}
        </TabsContent>

        <TabsContent value="bva" className="mt-4">
          {selectedBudget && (
            <EnhancedBudgetVsActual budgetId={selectedBudget.id} />
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

type TreeRow = {
  id: string;
  accountKey: string;
  displayName: string;
  parentKey: string | null;
  lineType: string;
  sortOrder: number;
  isParent: boolean;
  assetClass: string;
};

type TreeGridData = {
  tree: TreeRow[];
  amounts: Record<string, Record<string, string>>;
  lineIdMap: Record<string, string>;
  fiscalYear: number;
  budgetStatus: string;
};

function BudgetEditor({ budget, version, onVersionChange }: {
  budget: Budget;
  version: BudgetVersion;
  onVersionChange: (v: BudgetVersion) => void;
}) {
  const { toast } = useToast();
  const [localAmounts, setLocalAmounts] = useState<Record<string, Record<string, string>>>({});
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [aiOpen, setAiOpen] = useState(false);
  const cellRefs = useRef<Map<string, HTMLInputElement>>(new Map());
  const savingRef = useRef<Set<string>>(new Set());

  const { data: treeGrid, isLoading } = useQuery<TreeGridData>({
    queryKey: ["/api/budgets/version", version.id, "tree-grid"],
    queryFn: async () => {
      const res = await fetch(`/api/budgets/version/${version.id}/tree-grid`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load tree grid");
      return res.json();
    },
  });

  // Sync server amounts into local state when data loads
  useEffect(() => {
    if (treeGrid?.amounts) {
      setLocalAmounts(prev => {
        const merged = { ...treeGrid.amounts };
        // Overlay any in-flight local edits
        for (const [key, months] of Object.entries(prev)) {
          if (!merged[key]) merged[key] = {};
          for (const [m, v] of Object.entries(months)) {
            if (savingRef.current.has(`${key}|${m}`)) {
              merged[key][m] = v; // Keep local value while saving
            }
          }
        }
        return merged;
      });
    }
  }, [treeGrid?.amounts]);

  const months = useMemo(() => {
    const fy = treeGrid?.fiscalYear || budget.fiscalYear;
    return Array.from({ length: 12 }, (_, i) => {
      const m = (i + 1).toString().padStart(2, '0');
      return `${fy}-${m}-01`;
    });
  }, [treeGrid?.fiscalYear, budget.fiscalYear]);

  // Determine which months are locked (prior to current month)
  const lockedMonths = useMemo(() => {
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-01`;
    const locked = new Set<string>();
    for (const m of months) {
      if (m < currentMonth) locked.add(m);
    }
    return locked;
  }, [months]);

  // Keep a ref to latest localAmounts so blur reads fresh data without re-creating callbacks
  const localAmountsRef = useRef(localAmounts);
  localAmountsRef.current = localAmounts;

  // Debounce timers per cell
  const debounceTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const autoSave = useCallback(async (accountKey: string, periodStart: string, amount: string) => {
    const cellKey = `${accountKey}|${periodStart}`;
    if (savingRef.current.has(cellKey)) return;
    savingRef.current.add(cellKey);
    try {
      await apiRequest("PATCH", `/api/budgets/version/${version.id}/cell`, {
        accountKey,
        periodStart,
        amount,
      });
    } catch {
      toast({ title: "Auto-save failed", description: `Could not save ${accountKey}`, variant: "destructive" });
    } finally {
      savingRef.current.delete(cellKey);
    }
  }, [version.id, toast]);

  const getCellValue = useCallback((accountKey: string, month: string): string => {
    return localAmounts[accountKey]?.[month] || '0';
  }, [localAmounts]);

  const handleCellChange = useCallback((accountKey: string, month: string, value: string) => {
    const numVal = value.replace(/[^0-9.\-]/g, '');
    setLocalAmounts(prev => ({
      ...prev,
      [accountKey]: { ...(prev[accountKey] || {}), [month]: numVal },
    }));
  }, []);

  const handleCellBlur = useCallback((accountKey: string, month: string) => {
    // Read from ref to avoid stale closure on localAmounts
    const cellKey = `${accountKey}|${month}`;
    // Clear any existing debounce for this cell
    const existing = debounceTimers.current.get(cellKey);
    if (existing) clearTimeout(existing);
    // Debounce 300ms — coalesces rapid Tab-through
    const timer = setTimeout(() => {
      debounceTimers.current.delete(cellKey);
      const val = localAmountsRef.current[accountKey]?.[month] || '0';
      autoSave(accountKey, month, val);
    }, 300);
    debounceTimers.current.set(cellKey, timer);
  }, [autoSave]);

  const getChildTotal = useCallback((accountKey: string): number => {
    return months.reduce((sum, m) => sum + parseFloat(getCellValue(accountKey, m) || '0'), 0);
  }, [months, getCellValue]);

  const getParentMonthTotal = useCallback((parentKey: string, month: string, children: TreeRow[]): number => {
    return children
      .filter(c => c.parentKey === parentKey && !c.isParent)
      .reduce((sum, c) => sum + parseFloat(getCellValue(c.accountKey, month) || '0'), 0);
  }, [getCellValue]);

  const getParentAnnualTotal = useCallback((parentKey: string, children: TreeRow[]): number => {
    return months.reduce((sum, m) => sum + getParentMonthTotal(parentKey, m, children), 0);
  }, [months, getParentMonthTotal]);

  const toggleCollapse = useCallback((key: string) => {
    setCollapsed(prev => ({ ...prev, [key]: !prev[key] }));
  }, []);

  // Build ordered child list for keyboard nav
  const childRows = useMemo(() => {
    if (!treeGrid?.tree) return [];
    return treeGrid.tree.filter(r => !r.isParent).sort((a, b) => a.sortOrder - b.sortOrder);
  }, [treeGrid?.tree]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>, accountKey: string, monthIdx: number) => {
    const rowIdx = childRows.findIndex(r => r.accountKey === accountKey);
    if (rowIdx === -1) return;

    let targetRow = rowIdx;
    let targetMonth = monthIdx;

    if (e.key === 'Tab') {
      e.preventDefault();
      if (e.shiftKey) {
        targetMonth = monthIdx - 1;
        if (targetMonth < 0) { targetMonth = 11; targetRow = rowIdx - 1; }
      } else {
        targetMonth = monthIdx + 1;
        if (targetMonth > 11) { targetMonth = 0; targetRow = rowIdx + 1; }
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      targetRow = e.shiftKey ? rowIdx - 1 : rowIdx + 1;
    } else {
      return;
    }

    if (targetRow < 0 || targetRow >= childRows.length) return;
    // Skip locked months
    const targetMonthStr = months[targetMonth];
    if (lockedMonths.has(targetMonthStr)) return;

    // Ensure parent is expanded
    const targetChild = childRows[targetRow];
    if (targetChild.parentKey && collapsed[targetChild.parentKey]) {
      setCollapsed(prev => ({ ...prev, [targetChild.parentKey!]: false }));
    }

    const refKey = `${targetChild.accountKey}|${targetMonth}`;
    // Use setTimeout to let any collapse re-render happen first
    setTimeout(() => {
      const input = cellRefs.current.get(refKey);
      if (input) { input.focus(); input.select(); }
    }, 0);
  }, [childRows, months, lockedMonths, collapsed]);

  if (isLoading || !treeGrid) {
    return <Card><CardContent className="p-6"><Skeleton className="h-96 w-full" /></CardContent></Card>;
  }

  const tree = treeGrid.tree;
  const parents = tree.filter(r => r.isParent).sort((a, b) => a.sortOrder - b.sortOrder);
  const isLocked = budget.status === "LOCKED" || (version as any).isLocked === true;

  // NOI computation
  const getNoiMonth = (month: string) => {
    const rev = getParentMonthTotal("REVENUE", month, tree);
    const exp = getParentMonthTotal("OPEX", month, tree);
    return rev - exp;
  };
  const noiTotal = months.reduce((sum, m) => sum + getNoiMonth(m), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">{budget.name}</h2>
          <p className="text-sm text-muted-foreground">FY {budget.fiscalYear}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs text-muted-foreground">
            <Save className="h-3 w-3 mr-1" />
            Auto-saves on blur
          </Badge>
          <Button
            size="sm"
            variant={aiOpen ? "default" : "outline"}
            className="h-8 text-xs"
            onClick={() => setAiOpen(!aiOpen)}
          >
            {aiOpen ? <PanelRightClose className="h-3 w-3 mr-1" /> : <BrainCircuit className="h-3 w-3 mr-1" />}
            AI Assistant
          </Button>
        </div>
      </div>

      <VersionManager
        budgetId={budget.id}
        currentVersion={version}
        onVersionChange={onVersionChange}
      />

      <CsvDropZone
        versionId={version.id}
        onImported={() => {
          queryClient.invalidateQueries({ queryKey: ["/api/budgets/version", version.id, "tree-grid"] });
        }}
      />

      <div className={cn("flex gap-4", aiOpen && "")}>
      <div className={cn("border rounded-lg overflow-auto max-h-[75vh]", aiOpen ? "flex-1 min-w-0" : "w-full")}>
        <table className="w-full text-sm border-collapse">
          <thead className="sticky top-0 z-20">
            <tr className="bg-muted/80 backdrop-blur-sm">
              <th className="text-left px-3 py-2.5 font-medium sticky left-0 bg-muted/80 backdrop-blur-sm min-w-[240px] z-30 border-b">Account</th>
              {MONTHS_SHORT.map((m, i) => {
                const monthStr = months[i];
                const locked = lockedMonths.has(monthStr);
                return (
                  <th key={m} className={cn(
                    "text-right px-3 py-2.5 font-medium min-w-[105px] border-b",
                    locked && "text-muted-foreground/60"
                  )}>
                    {m}
                    {locked && <Lock className="h-3 w-3 inline ml-1 opacity-40" />}
                  </th>
                );
              })}
              <th className="text-right px-3 py-2.5 font-semibold min-w-[115px] bg-muted border-b sticky right-0 z-30">Total</th>
            </tr>
          </thead>
          <tbody>
            {parents.map(parent => {
              const children = tree.filter(r => r.parentKey === parent.accountKey && !r.isParent)
                .sort((a, b) => a.sortOrder - b.sortOrder);
              const isCollapsed = collapsed[parent.accountKey] ?? false;
              const parentColor = parent.lineType === "REVENUE"
                ? "bg-emerald-50/70 dark:bg-emerald-900/20"
                : "bg-red-50/70 dark:bg-red-900/20";
              const parentBadgeColor = LINE_TYPE_COLORS[parent.lineType] || "";

              return (
                <React.Fragment key={parent.accountKey}>
                  {/* Parent row — click to collapse/expand */}
                  <tr
                    className={cn("cursor-pointer select-none hover:bg-muted/30 transition-colors border-b", parentColor)}
                    onClick={() => toggleCollapse(parent.accountKey)}
                  >
                    <td className={cn("px-3 py-2 sticky left-0 z-10 font-semibold text-sm", parentColor)}>
                      <div className="flex items-center gap-2">
                        <ChevronRight className={cn(
                          "h-4 w-4 transition-transform flex-shrink-0",
                          !isCollapsed && "rotate-90"
                        )} />
                        <Badge className={cn("text-xs", parentBadgeColor)} variant="outline">
                          {parent.displayName}
                        </Badge>
                      </div>
                    </td>
                    {months.map((m, i) => (
                      <td key={i} className="text-right px-3 py-2 font-semibold tabular-nums text-sm">
                        {formatAmount(getParentMonthTotal(parent.accountKey, m, tree))}
                      </td>
                    ))}
                    <td className={cn("text-right px-3 py-2 font-bold tabular-nums sticky right-0 z-10", parentColor)}>
                      {formatAmount(getParentAnnualTotal(parent.accountKey, tree))}
                    </td>
                  </tr>

                  {/* Child rows — editable */}
                  {!isCollapsed && children.map(child => (
                    <tr key={child.accountKey} className="border-b hover:bg-muted/10 transition-colors group/row">
                      <td className="pl-10 pr-1 py-0.5 sticky left-0 bg-background z-10 text-sm">
                        <div className="flex items-center justify-between gap-1">
                          <span className="truncate">{child.displayName}</span>
                          {!isLocked && (
                            <BulkFillMenu
                              versionId={version.id}
                              accountKey={child.accountKey}
                              displayName={child.displayName}
                              onFilled={() => {
                                queryClient.invalidateQueries({ queryKey: ["/api/budgets/version", version.id, "tree-grid"] });
                              }}
                            />
                          )}
                        </div>
                      </td>
                      {months.map((m, mi) => {
                        const locked = lockedMonths.has(m);
                        const cellDisabled = isLocked || locked;
                        const refKey = `${child.accountKey}|${mi}`;
                        return (
                          <td key={m} className="px-0.5 py-0.5">
                            <input
                              ref={(el) => {
                                if (el) cellRefs.current.set(refKey, el);
                                else cellRefs.current.delete(refKey);
                              }}
                              type="text"
                              className={cn(
                                "w-full text-right px-2 py-1 text-sm rounded transition-colors tabular-nums",
                                cellDisabled
                                  ? "bg-muted/40 text-muted-foreground/50 cursor-not-allowed"
                                  : "bg-transparent border border-transparent hover:border-border focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                              )}
                              value={getCellValue(child.accountKey, m)}
                              onChange={(e) => handleCellChange(child.accountKey, m, e.target.value)}
                              onBlur={() => handleCellBlur(child.accountKey, m)}
                              onKeyDown={(e) => handleKeyDown(e, child.accountKey, mi)}
                              disabled={cellDisabled}
                            />
                          </td>
                        );
                      })}
                      <td className="text-right px-3 py-0.5 font-medium tabular-nums bg-muted/10 sticky right-0 z-10">
                        {formatAmount(getChildTotal(child.accountKey))}
                      </td>
                    </tr>
                  ))}
                </React.Fragment>
              );
            })}

            {/* NOI row */}
            <tr className="bg-slate-100 dark:bg-slate-800 font-bold border-t-2">
              <td className="px-3 py-2.5 sticky left-0 bg-slate-100 dark:bg-slate-800 z-10 text-sm">
                <div className="flex items-center gap-2">
                  <Minus className="h-4 w-4 flex-shrink-0 opacity-40" />
                  Net Operating Income
                </div>
              </td>
              {months.map((m, i) => {
                const noi = getNoiMonth(m);
                return (
                  <td key={i} className={cn("text-right px-3 py-2.5 tabular-nums", noi >= 0 ? "text-emerald-600" : "text-red-600")}>
                    {formatAmount(noi)}
                  </td>
                );
              })}
              <td className={cn(
                "text-right px-3 py-2.5 font-bold tabular-nums sticky right-0 z-10 bg-slate-200 dark:bg-slate-700",
                noiTotal >= 0 ? "text-emerald-600" : "text-red-600"
              )}>
                {formatAmount(noiTotal)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* AI Assistant Sidebar */}
      {aiOpen && (
        <AiBudgetAssistant
          versionId={version.id}
          childRows={childRows}
          onRefresh={() => {
            queryClient.invalidateQueries({ queryKey: ["/api/budgets/version", version.id, "tree-grid"] });
          }}
        />
      )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// BulkFillMenu — "..." popover on each child row
// ---------------------------------------------------------------------------
function BulkFillMenu({ versionId, accountKey, displayName, onFilled }: {
  versionId: string;
  accountKey: string;
  displayName: string;
  onFilled: () => void;
}) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<string | null>(null);
  const [annualTotal, setAnnualTotal] = useState("");
  const [janValue, setJanValue] = useState("");
  const [growthRate, setGrowthRate] = useState("");
  const [upliftPct, setUpliftPct] = useState("5");

  const fillMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const res = await apiRequest("POST", `/api/budgets/version/${versionId}/bulk-fill`, payload);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Row filled", description: `${displayName} updated` });
      setOpen(false);
      setMode(null);
      onFilled();
    },
    onError: (error: Error) => {
      toast({ title: "Fill failed", description: error.message, variant: "destructive" });
    },
  });

  const submit = () => {
    const base = { accountKey, mode };
    switch (mode) {
      case "spread_evenly":
        fillMutation.mutate({ ...base, annualTotal: parseFloat(annualTotal) || 0 });
        break;
      case "grow_pct":
        fillMutation.mutate({ ...base, januaryValue: parseFloat(janValue) || 0, growthRate: (parseFloat(growthRate) || 0) / 100 });
        break;
      case "seasonality":
        fillMutation.mutate({ ...base, annualTotal: parseFloat(annualTotal) || 0 });
        break;
      case "copy_prior_year":
        fillMutation.mutate({ ...base, upliftPct: (parseFloat(upliftPct) || 0) / 100 });
        break;
    }
  };

  const modes = [
    { key: "spread_evenly", label: "Spread Evenly", icon: SplitSquareVertical, desc: "Divide annual total by 12" },
    { key: "grow_pct", label: "Grow by %", icon: Percent, desc: "January value + MoM growth" },
    { key: "seasonality", label: "Apply Seasonality", icon: BarChart2, desc: "Weight by prior year actuals" },
    { key: "copy_prior_year", label: "Copy Prior Year", icon: Copy, desc: "Prior actuals × uplift %" },
  ];

  return (
    <Popover open={open} onOpenChange={(v) => { setOpen(v); if (!v) setMode(null); }}>
      <PopoverTrigger asChild>
        <button
          className="opacity-0 group-hover/row:opacity-100 focus:opacity-100 p-0.5 rounded hover:bg-muted transition-opacity"
          onClick={(e) => e.stopPropagation()}
        >
          <MoreHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start" side="right">
        {!mode ? (
          <div className="py-1">
            <div className="px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Bulk Fill — {displayName}
            </div>
            {modes.map(m => (
              <button
                key={m.key}
                className="w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-muted transition-colors text-left"
                onClick={() => setMode(m.key)}
              >
                <m.icon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <div>
                  <div className="font-medium">{m.label}</div>
                  <div className="text-xs text-muted-foreground">{m.desc}</div>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="p-3 space-y-3">
            <div className="text-sm font-medium">{modes.find(m => m.key === mode)?.label}</div>

            {(mode === "spread_evenly" || mode === "seasonality") && (
              <div>
                <Label className="text-xs">Annual Total ($)</Label>
                <Input
                  type="number"
                  value={annualTotal}
                  onChange={e => setAnnualTotal(e.target.value)}
                  placeholder="e.g. 120000"
                  autoFocus
                />
                {mode === "seasonality" && (
                  <p className="text-xs text-muted-foreground mt-1">Weighted by prior year actual distribution</p>
                )}
              </div>
            )}

            {mode === "grow_pct" && (
              <>
                <div>
                  <Label className="text-xs">January Value ($)</Label>
                  <Input type="number" value={janValue} onChange={e => setJanValue(e.target.value)} placeholder="e.g. 10000" autoFocus />
                </div>
                <div>
                  <Label className="text-xs">Month-over-Month Growth (%)</Label>
                  <Input type="number" value={growthRate} onChange={e => setGrowthRate(e.target.value)} placeholder="e.g. 3" />
                </div>
              </>
            )}

            {mode === "copy_prior_year" && (
              <div>
                <Label className="text-xs">Uplift (%)</Label>
                <Input type="number" value={upliftPct} onChange={e => setUpliftPct(e.target.value)} placeholder="e.g. 5" autoFocus />
                <p className="text-xs text-muted-foreground mt-1">Prior year actuals × (1 + uplift)</p>
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <Button size="sm" variant="outline" className="flex-1" onClick={() => setMode(null)}>Back</Button>
              <Button size="sm" className="flex-1" onClick={submit} disabled={fillMutation.isPending}>
                {fillMutation.isPending ? "Applying..." : "Apply"}
              </Button>
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

// ---------------------------------------------------------------------------
// CsvDropZone — Drag-and-drop CSV/Excel import
// ---------------------------------------------------------------------------
function CsvDropZone({ versionId, onImported }: { versionId: string; onImported: () => void }) {
  const { toast } = useToast();
  const [dragging, setDragging] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ imported: number; skipped: number; details?: any } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = async (file: File) => {
    setImporting(true);
    setResult(null);
    try {
      let csvText: string;

      if (file.name.endsWith('.csv') || file.type === 'text/csv') {
        csvText = await file.text();
      } else if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        // For Excel files, try to read as CSV (basic tab/comma delimited)
        // Full xlsx parsing would need a library — treat as CSV for now
        csvText = await file.text();
      } else {
        toast({ title: "Unsupported file", description: "Please upload a .csv file", variant: "destructive" });
        setImporting(false);
        return;
      }

      const res = await apiRequest("POST", `/api/budgets/version/${versionId}/import-csv`, { csvText });
      const data = await res.json();
      setResult(data);
      toast({
        title: `Imported ${data.imported} rows`,
        description: data.skipped > 0 ? `${data.skipped} rows skipped (no match)` : "All rows matched",
      });
      onImported();
    } catch (error: any) {
      toast({ title: "Import failed", description: error.message, variant: "destructive" });
    } finally {
      setImporting(false);
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  };

  const onFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = '';
  };

  return (
    <div className="space-y-2">
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
        className={cn(
          "border-2 border-dashed rounded-lg px-4 py-3 text-center cursor-pointer transition-colors",
          dragging
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/20 hover:border-muted-foreground/40"
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.xlsx,.xls"
          onChange={onFileSelect}
          className="hidden"
        />
        {importing ? (
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <RefreshCw className="h-4 w-4 animate-spin" />
            Importing...
          </div>
        ) : (
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Upload className="h-4 w-4" />
            <span>Drop a CSV here or <span className="text-primary underline">browse</span></span>
            <span className="text-xs">(Account, Jan–Dec columns)</span>
          </div>
        )}
      </div>

      {result && (
        <div className="flex items-center gap-3 text-xs text-muted-foreground px-1">
          <span className="text-emerald-600 font-medium">{result.imported} imported</span>
          {result.skipped > 0 && (
            <Popover>
              <PopoverTrigger asChild>
                <button className="text-amber-600 underline cursor-pointer">{result.skipped} skipped</button>
              </PopoverTrigger>
              <PopoverContent className="w-80 max-h-48 overflow-auto text-xs" align="start">
                <div className="space-y-1">
                  <div className="font-medium text-sm mb-2">Skipped Rows</div>
                  {result.details?.skipped?.map((s: any, i: number) => (
                    <div key={i} className="flex justify-between">
                      <span className="truncate">{s.account || `Row ${s.row}`}</span>
                      <span className="text-muted-foreground ml-2 flex-shrink-0">{s.reason}</span>
                    </div>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          )}
          <button className="ml-auto text-muted-foreground hover:text-foreground" onClick={() => setResult(null)}>
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// AiBudgetAssistant — Collapsible sidebar with 3 AI actions
// ---------------------------------------------------------------------------
function AiBudgetAssistant({ versionId, childRows, onRefresh }: {
  versionId: string;
  childRows: TreeRow[];
  onRefresh: () => void;
}) {
  const { toast } = useToast();
  const [activeAction, setActiveAction] = useState<string | null>(null);

  // Seed assumptions state
  const [seedGrowth, setSeedGrowth] = useState("");

  // Explain variance state
  const [explainAccount, setExplainAccount] = useState("");
  const [explainResult, setExplainResult] = useState<any>(null);

  // What-if state
  const [whatIfAdjustments, setWhatIfAdjustments] = useState<{ accountKey: string; changePct: number }[]>([]);
  const [whatIfResult, setWhatIfResult] = useState<any>(null);

  const seedMutation = useMutation({
    mutationFn: async () => {
      const body: any = { versionId };
      if (seedGrowth) body.growthOverride = parseFloat(seedGrowth) / 100;
      const res = await apiRequest("POST", "/api/budgets/ai/seed-assumptions", body);
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Budget seeded", description: `${data.accountsUpdated} accounts updated using ${data.method}` });
      onRefresh();
    },
    onError: (error: Error) => {
      toast({ title: "Seed failed", description: error.message, variant: "destructive" });
    },
  });

  const explainMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/budgets/ai/explain-variance", {
        versionId,
        accountKey: explainAccount,
      });
      return res.json();
    },
    onSuccess: (data) => setExplainResult(data),
    onError: (error: Error) => {
      toast({ title: "Explain failed", description: error.message, variant: "destructive" });
    },
  });

  const whatIfMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/budgets/ai/what-if", {
        versionId,
        adjustments: whatIfAdjustments,
      });
      return res.json();
    },
    onSuccess: (data) => setWhatIfResult(data),
    onError: (error: Error) => {
      toast({ title: "What-if failed", description: error.message, variant: "destructive" });
    },
  });

  const addWhatIfRow = () => {
    setWhatIfAdjustments(prev => [...prev, { accountKey: childRows[0]?.accountKey || '', changePct: 0 }]);
  };

  return (
    <div className="w-[340px] flex-shrink-0 border rounded-lg overflow-auto max-h-[75vh]">
      <div className="p-3 border-b bg-muted/30">
        <div className="flex items-center gap-2">
          <BrainCircuit className="h-4 w-4 text-primary" />
          <span className="font-semibold text-sm">AI Budget Assistant</span>
        </div>
      </div>

      <div className="p-2 space-y-2">
        {/* Action 1: Seed Assumptions */}
        <div className="border rounded-lg overflow-hidden">
          <button
            className={cn("w-full flex items-center gap-2 px-3 py-2.5 text-sm text-left hover:bg-muted/50 transition-colors",
              activeAction === "seed" && "bg-muted/50")}
            onClick={() => setActiveAction(activeAction === "seed" ? null : "seed")}
          >
            <Lightbulb className="h-4 w-4 text-amber-500 flex-shrink-0" />
            <div className="flex-1">
              <div className="font-medium">Seed from Actuals</div>
              <div className="text-xs text-muted-foreground">Auto-populate from prior year</div>
            </div>
            <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", activeAction === "seed" && "rotate-180")} />
          </button>
          {activeAction === "seed" && (
            <div className="px-3 pb-3 space-y-2 border-t">
              <div className="pt-2">
                <Label className="text-xs">Growth Override (%) — leave blank for auto YoY</Label>
                <Input
                  type="number"
                  value={seedGrowth}
                  onChange={e => setSeedGrowth(e.target.value)}
                  placeholder="e.g. 5 for 5% growth"
                  className="h-8 text-sm mt-1"
                />
              </div>
              <Button size="sm" className="w-full" onClick={() => seedMutation.mutate()} disabled={seedMutation.isPending}>
                {seedMutation.isPending ? "Analyzing..." : "Seed Budget"}
              </Button>
              {seedMutation.data && (
                <div className="text-xs space-y-1 max-h-40 overflow-auto">
                  <div className="font-medium text-emerald-600">{seedMutation.data.accountsUpdated} accounts updated</div>
                  {seedMutation.data.assumptions?.slice(0, 8).map((a: any) => (
                    <div key={a.accountKey} className="flex justify-between">
                      <span className="truncate">{a.accountKey.replace(/_/g, ' ')}</span>
                      <span className="text-muted-foreground ml-1 flex-shrink-0">
                        {a.growthRate >= 0 ? '+' : ''}{a.growthRate}%
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Action 2: Explain Variance */}
        <div className="border rounded-lg overflow-hidden">
          <button
            className={cn("w-full flex items-center gap-2 px-3 py-2.5 text-sm text-left hover:bg-muted/50 transition-colors",
              activeAction === "explain" && "bg-muted/50")}
            onClick={() => { setActiveAction(activeAction === "explain" ? null : "explain"); setExplainResult(null); }}
          >
            <HelpCircle className="h-4 w-4 text-blue-500 flex-shrink-0" />
            <div className="flex-1">
              <div className="font-medium">Explain Variance</div>
              <div className="text-xs text-muted-foreground">Why is this over/under budget?</div>
            </div>
            <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", activeAction === "explain" && "rotate-180")} />
          </button>
          {activeAction === "explain" && (
            <div className="px-3 pb-3 space-y-2 border-t">
              <div className="pt-2">
                <Label className="text-xs">Account</Label>
                <Select value={explainAccount} onValueChange={setExplainAccount}>
                  <SelectTrigger className="h-8 text-sm mt-1">
                    <SelectValue placeholder="Select account..." />
                  </SelectTrigger>
                  <SelectContent>
                    {childRows.map(r => (
                      <SelectItem key={r.accountKey} value={r.accountKey}>{r.displayName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                size="sm"
                className="w-full"
                onClick={() => explainMutation.mutate()}
                disabled={!explainAccount || explainMutation.isPending}
              >
                {explainMutation.isPending ? "Analyzing..." : "Explain"}
              </Button>
              {explainResult && (
                <div className="text-xs space-y-2 border-t pt-2">
                  <div className="flex justify-between font-medium">
                    <span>Budget: ${explainResult.budgetTotal?.toLocaleString()}</span>
                    <span>Actual: ${explainResult.actualTotal?.toLocaleString()}</span>
                  </div>
                  <div className={cn("font-semibold", explainResult.favorable ? "text-emerald-600" : "text-red-600")}>
                    Variance: {explainResult.variance >= 0 ? '+' : ''}${explainResult.variance?.toLocaleString()}
                    {' '}({explainResult.variancePct >= 0 ? '+' : ''}{explainResult.variancePct}%)
                    {' '}— {explainResult.favorable ? 'Favorable' : 'Unfavorable'}
                  </div>
                  <div className="whitespace-pre-wrap text-muted-foreground leading-relaxed">
                    {explainResult.explanation?.replace(/\*\*/g, '')}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Action 3: What-If Analysis */}
        <div className="border rounded-lg overflow-hidden">
          <button
            className={cn("w-full flex items-center gap-2 px-3 py-2.5 text-sm text-left hover:bg-muted/50 transition-colors",
              activeAction === "whatif" && "bg-muted/50")}
            onClick={() => { setActiveAction(activeAction === "whatif" ? null : "whatif"); setWhatIfResult(null); }}
          >
            <Sliders className="h-4 w-4 text-purple-500 flex-shrink-0" />
            <div className="flex-1">
              <div className="font-medium">What-If Analysis</div>
              <div className="text-xs text-muted-foreground">Adjust drivers, see NOI impact</div>
            </div>
            <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", activeAction === "whatif" && "rotate-180")} />
          </button>
          {activeAction === "whatif" && (
            <div className="px-3 pb-3 space-y-2 border-t">
              <div className="pt-2 space-y-2">
                {whatIfAdjustments.map((adj, i) => (
                  <div key={i} className="flex gap-1.5 items-end">
                    <div className="flex-1">
                      {i === 0 && <Label className="text-[10px]">Account</Label>}
                      <Select
                        value={adj.accountKey}
                        onValueChange={(v) => {
                          setWhatIfAdjustments(prev => prev.map((a, j) => j === i ? { ...a, accountKey: v } : a));
                        }}
                      >
                        <SelectTrigger className="h-7 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {childRows.map(r => (
                            <SelectItem key={r.accountKey} value={r.accountKey}>{r.displayName}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="w-16">
                      {i === 0 && <Label className="text-[10px]">% Change</Label>}
                      <Input
                        type="number"
                        value={adj.changePct}
                        onChange={(e) => {
                          setWhatIfAdjustments(prev => prev.map((a, j) =>
                            j === i ? { ...a, changePct: parseFloat(e.target.value) || 0 } : a
                          ));
                        }}
                        className="h-7 text-xs"
                      />
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0"
                      onClick={() => setWhatIfAdjustments(prev => prev.filter((_, j) => j !== i))}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
                <Button size="sm" variant="outline" className="w-full h-7 text-xs" onClick={addWhatIfRow} disabled={childRows.length === 0}>
                  <Plus className="h-3 w-3 mr-1" />
                  Add Driver
                </Button>
              </div>
              <Button
                size="sm"
                className="w-full"
                onClick={() => whatIfMutation.mutate()}
                disabled={whatIfAdjustments.length === 0 || whatIfMutation.isPending}
              >
                {whatIfMutation.isPending ? "Computing..." : "Run Scenario"}
              </Button>
              {whatIfResult && (
                <div className="text-xs space-y-2 border-t pt-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="border rounded p-2">
                      <div className="text-muted-foreground">Baseline NOI</div>
                      <div className="font-bold text-base">{formatCurrency(whatIfResult.baseline.noi)}</div>
                    </div>
                    <div className={cn("border rounded p-2", whatIfResult.favorable ? "border-emerald-200 bg-emerald-50/50 dark:border-emerald-800 dark:bg-emerald-900/20" : "border-red-200 bg-red-50/50 dark:border-red-800 dark:bg-red-900/20")}>
                      <div className="text-muted-foreground">Scenario NOI</div>
                      <div className="font-bold text-base">{formatCurrency(whatIfResult.scenario.noi)}</div>
                    </div>
                  </div>
                  <div className={cn("text-center font-semibold py-1 rounded",
                    whatIfResult.favorable ? "text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20" : "text-red-600 bg-red-50 dark:bg-red-900/20"
                  )}>
                    NOI Impact: {whatIfResult.noiImpact >= 0 ? '+' : ''}{formatCurrency(whatIfResult.noiImpact)}
                    {' '}({whatIfResult.noiImpactPct >= 0 ? '+' : ''}{whatIfResult.noiImpactPct}%)
                  </div>
                  {whatIfResult.adjustments?.map((a: any) => (
                    <div key={a.accountKey} className="flex justify-between text-muted-foreground">
                      <span className="truncate">{a.displayName}</span>
                      <span className="ml-1 flex-shrink-0">{formatCurrency(a.baseTotal)} → {formatCurrency(a.adjustedTotal)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// RollingForecastButton — Generate Latest Estimate version
// ---------------------------------------------------------------------------
function RollingForecastButton({ versionId, onCreated }: {
  versionId: string;
  onCreated: (v: BudgetVersion) => void;
}) {
  const { toast } = useToast();
  const mutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/budgets/version/${versionId}/rolling-forecast`, {});
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Latest Estimate generated",
        description: `${data.updatedCells} cells updated with actuals through ${data.currentMonth}`,
      });
      onCreated({ id: data.versionId, budgetId: '', name: data.versionName, isPrimary: false } as BudgetVersion);
      queryClient.invalidateQueries({ queryKey: ["/api/budgets"] });
    },
    onError: (error: Error) => {
      toast({ title: "Forecast failed", description: error.message, variant: "destructive" });
    },
  });

  return (
    <Button
      size="sm"
      variant="outline"
      className="h-8 text-xs"
      onClick={() => mutation.mutate()}
      disabled={mutation.isPending}
    >
      <Zap className={cn("h-3 w-3 mr-1", mutation.isPending && "animate-pulse")} />
      {mutation.isPending ? "Generating..." : "Latest Estimate"}
    </Button>
  );
}

// ---------------------------------------------------------------------------
// VersionManager — Version selector, clone, lock, compare
// ---------------------------------------------------------------------------
function VersionManager({ budgetId, currentVersion, onVersionChange }: {
  budgetId: string;
  currentVersion: BudgetVersion;
  onVersionChange: (v: BudgetVersion) => void;
}) {
  const { toast } = useToast();
  const [compareOpen, setCompareOpen] = useState(false);
  const [compareVersionId, setCompareVersionId] = useState<string | null>(null);

  const { data: versions = [], refetch: refetchVersions } = useQuery<(BudgetVersion & { isLocked?: boolean })[]>({
    queryKey: ["/api/budgets", budgetId, "versions"],
    queryFn: async () => {
      const res = await fetch(`/api/budgets/${budgetId}/versions`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load versions");
      return res.json();
    },
  });

  const cloneMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/budgets/version/${currentVersion.id}/clone`, {
        name: `${currentVersion.name} (Revised)`,
      });
      return res.json();
    },
    onSuccess: (newVer) => {
      refetchVersions();
      onVersionChange(newVer);
      toast({ title: "Version cloned", description: `"${newVer.name}" created` });
    },
    onError: (error: Error) => {
      toast({ title: "Clone failed", description: error.message, variant: "destructive" });
    },
  });

  const lockMutation = useMutation({
    mutationFn: async ({ versionId, locked }: { versionId: string; locked: boolean }) => {
      await apiRequest("PATCH", `/api/budgets/version/${versionId}/lock`, { locked });
      return { versionId, locked };
    },
    onSuccess: ({ locked }) => {
      refetchVersions();
      queryClient.invalidateQueries({ queryKey: ["/api/budgets/version", currentVersion.id, "tree-grid"] });
      toast({ title: locked ? "Version locked" : "Version unlocked" });
    },
  });

  const setPrimaryMutation = useMutation({
    mutationFn: async (versionId: string) => {
      const res = await apiRequest("PATCH", `/api/budgets/version/${versionId}/set-primary`, {});
      return res.json();
    },
    onSuccess: () => {
      refetchVersions();
      toast({ title: "Primary version updated" });
    },
  });

  const { data: comparison } = useQuery({
    queryKey: ["/api/budgets/version/compare", currentVersion.id, compareVersionId],
    queryFn: async () => {
      const res = await fetch(
        `/api/budgets/version/compare?versionA=${currentVersion.id}&versionB=${compareVersionId}`,
        { credentials: "include" }
      );
      if (!res.ok) throw new Error("Failed to compare");
      return res.json();
    },
    enabled: compareOpen && !!compareVersionId,
  });

  const isCurrentLocked = (versions.find(v => v.id === currentVersion.id) as any)?.isLocked === true
    || (versions.find(v => v.id === currentVersion.id) as any)?.is_locked === true;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 flex-wrap">
        {/* Version selector */}
        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground whitespace-nowrap">Version:</Label>
          <Select
            value={currentVersion.id}
            onValueChange={(id) => {
              const v = versions.find(ver => ver.id === id);
              if (v) onVersionChange(v);
            }}
          >
            <SelectTrigger className="h-8 w-[200px] text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {versions.map(v => (
                <SelectItem key={v.id} value={v.id}>
                  <div className="flex items-center gap-2">
                    {v.name}
                    {v.isPrimary && <Badge variant="outline" className="text-[10px] px-1 py-0">Primary</Badge>}
                    {((v as any).isLocked || (v as any).is_locked) && <Lock className="h-3 w-3 text-muted-foreground" />}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs"
            onClick={() => cloneMutation.mutate()}
            disabled={cloneMutation.isPending}
          >
            <Copy className="h-3 w-3 mr-1" />
            Clone
          </Button>

          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs"
            onClick={() => lockMutation.mutate({ versionId: currentVersion.id, locked: !isCurrentLocked })}
          >
            {isCurrentLocked ? <Unlock className="h-3 w-3 mr-1" /> : <Lock className="h-3 w-3 mr-1" />}
            {isCurrentLocked ? "Unlock" : "Lock"}
          </Button>

          {!currentVersion.isPrimary && (
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs"
              onClick={() => setPrimaryMutation.mutate(currentVersion.id)}
            >
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Set Primary
            </Button>
          )}

          <Button
            size="sm"
            variant={compareOpen ? "default" : "outline"}
            className="h-8 text-xs"
            onClick={() => setCompareOpen(!compareOpen)}
            disabled={versions.length < 2}
            title={versions.length < 2 ? "Need at least 2 versions to compare" : undefined}
          >
            <SplitSquareVertical className="h-3 w-3 mr-1" />
            Compare
          </Button>

          <RollingForecastButton
            versionId={currentVersion.id}
            onCreated={(newVer) => {
              refetchVersions();
              onVersionChange(newVer);
            }}
          />
        </div>
      </div>

      {/* Compare panel */}
      {compareOpen && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-3">
              <Label className="text-xs whitespace-nowrap">Compare with:</Label>
              <Select value={compareVersionId || ""} onValueChange={setCompareVersionId}>
                <SelectTrigger className="h-8 w-[200px] text-sm">
                  <SelectValue placeholder="Select version..." />
                </SelectTrigger>
                <SelectContent>
                  {versions.filter(v => v.id !== currentVersion.id).map(v => (
                    <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {comparison && (
              <div className="border rounded-lg overflow-auto max-h-[400px]">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 z-10">
                    <tr className="bg-muted/80">
                      <th className="text-left px-3 py-2 font-medium min-w-[180px]">Account</th>
                      <th className="text-right px-3 py-2 font-medium">{comparison.versionA.name}</th>
                      <th className="text-right px-3 py-2 font-medium">{comparison.versionB.name}</th>
                      <th className="text-right px-3 py-2 font-medium">$ Var</th>
                      <th className="text-right px-3 py-2 font-medium">% Var</th>
                    </tr>
                  </thead>
                  <tbody>
                    {comparison.comparison.map((row: any) => {
                      const isExpense = ['COGS', 'OPEX', 'OTHER_EXPENSE'].includes(row.lineType);
                      const favorable = isExpense ? row.totalDiff <= 0 : row.totalDiff >= 0;
                      return (
                        <tr key={row.accountKey} className="border-b hover:bg-muted/10">
                          <td className="px-3 py-1.5 text-sm">{row.displayName}</td>
                          <td className="text-right px-3 py-1.5 tabular-nums">{formatAmount(row.totalA)}</td>
                          <td className="text-right px-3 py-1.5 tabular-nums">{formatAmount(row.totalB)}</td>
                          <td className={cn("text-right px-3 py-1.5 tabular-nums", favorable ? "text-emerald-600" : "text-red-600")}>
                            {row.totalDiff >= 0 ? "+" : ""}{formatAmount(row.totalDiff)}
                          </td>
                          <td className={cn("text-right px-3 py-1.5 tabular-nums", favorable ? "text-emerald-600" : "text-red-600")}>
                            {row.totalPctDiff >= 0 ? "+" : ""}{row.totalPctDiff.toFixed(1)}%
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// EnhancedBudgetVsActual — Monthly drill-down with YTD, GL actuals
// ---------------------------------------------------------------------------
type EnhancedBvaLine = {
  accountKey: string;
  displayName: string;
  lineType: string;
  monthly: { month: string; budget: number; actual: number; varDollar: number; varPct: number; favorable: boolean; isYtd: boolean }[];
  ytd: { budget: number; actual: number; varDollar: number; varPct: number; favorable: boolean };
  annual: { budget: number; actual: number; varDollar: number; varPct: number; favorable: boolean };
};

type EnhancedBvaData = {
  budget: Budget;
  version: BudgetVersion;
  versions: BudgetVersion[];
  lines: EnhancedBvaLine[];
  summary: {
    totalRevenueBudget: number; totalRevenueActual: number;
    totalExpenseBudget: number; totalExpenseActual: number;
    noiBudget: number; noiActual: number;
    ytdRevenueBudget: number; ytdRevenueActual: number;
    ytdExpenseBudget: number; ytdExpenseActual: number;
    ytdNoiBudget: number; ytdNoiActual: number;
  };
  months: string[];
  currentMonthIdx: number;
};

function EnhancedBudgetVsActual({ budgetId }: { budgetId: string }) {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const { data, isLoading } = useQuery<EnhancedBvaData>({
    queryKey: ["/api/budgets/bva-enhanced", budgetId],
    queryFn: async () => {
      const res = await fetch(`/api/budgets/bva-enhanced/${budgetId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load BVA data");
      return res.json();
    },
  });

  const toggleRow = useCallback((key: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }, []);

  if (isLoading || !data) {
    return <Card><CardContent className="p-6"><Skeleton className="h-96 w-full" /></CardContent></Card>;
  }

  if (!data.lines?.length) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16">
          <BarChart3 className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Data Available</h3>
          <p className="text-muted-foreground text-center max-w-md">
            Seed demo actuals and add budget amounts first.
          </p>
        </CardContent>
      </Card>
    );
  }

  const { summary, lines, months, currentMonthIdx } = data;
  const noiVarYtd = summary.ytdNoiActual - summary.ytdNoiBudget;
  const noiVarAnnual = summary.noiActual - summary.noiBudget;

  // Group lines by type
  const groupOrder = ["REVENUE", "OTHER_INCOME", "COGS", "OPEX", "OTHER_EXPENSE"];
  const groupLabels: Record<string, string> = {
    REVENUE: "Revenue", COGS: "Cost of Goods Sold", OPEX: "Operating Expenses",
    OTHER_INCOME: "Other Income", OTHER_EXPENSE: "Other Expense",
  };
  const grouped: Record<string, EnhancedBvaLine[]> = {};
  for (const l of lines) {
    if (!grouped[l.lineType]) grouped[l.lineType] = [];
    grouped[l.lineType].push(l);
  }

  return (
    <div className="space-y-6">
      {/* KPI cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <SummaryCard
          title="YTD Revenue"
          budget={summary.ytdRevenueBudget}
          actual={summary.ytdRevenueActual}
          variance={summary.ytdRevenueActual - summary.ytdRevenueBudget}
          favorable={summary.ytdRevenueActual >= summary.ytdRevenueBudget}
        />
        <SummaryCard
          title="YTD Expenses"
          budget={summary.ytdExpenseBudget}
          actual={summary.ytdExpenseActual}
          variance={summary.ytdExpenseActual - summary.ytdExpenseBudget}
          favorable={summary.ytdExpenseActual <= summary.ytdExpenseBudget}
        />
        <SummaryCard
          title="YTD NOI"
          budget={summary.ytdNoiBudget}
          actual={summary.ytdNoiActual}
          variance={noiVarYtd}
          favorable={noiVarYtd >= 0}
        />
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground font-medium uppercase">Budget Accuracy</p>
            <p className="text-2xl font-bold mt-1">
              {summary.ytdNoiBudget !== 0
                ? `${Math.max(0, 100 - Math.abs((noiVarYtd / summary.ytdNoiBudget) * 100)).toFixed(1)}%`
                : "N/A"
              }
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Through {MONTHS_SHORT[currentMonthIdx] || "Dec"} {data.budget.fiscalYear}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Variance table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Detailed Variance Analysis</CardTitle>
          <CardDescription>Click any row to expand monthly detail — Budget | Actual | $ Var | % Var</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 border-b">
                  <th className="text-left px-3 py-2 font-medium sticky left-0 bg-muted/50 min-w-[200px] z-10">Account</th>
                  <th className="text-right px-3 py-2 font-medium">Budget</th>
                  <th className="text-right px-3 py-2 font-medium">Actual</th>
                  <th className="text-right px-3 py-2 font-medium">$ Var</th>
                  <th className="text-right px-3 py-2 font-medium">% Var</th>
                  <th className="text-right px-3 py-2 font-semibold bg-muted/30">YTD Budget</th>
                  <th className="text-right px-3 py-2 font-semibold bg-muted/30">YTD Actual</th>
                  <th className="text-right px-3 py-2 font-semibold bg-muted/30">YTD $ Var</th>
                </tr>
              </thead>
              <tbody>
                {groupOrder.map(section => {
                  const sectionLines = grouped[section];
                  if (!sectionLines?.length) return null;

                  const secBudget = sectionLines.reduce((s, l) => s + l.annual.budget, 0);
                  const secActual = sectionLines.reduce((s, l) => s + l.annual.actual, 0);
                  const secVar = secActual - secBudget;
                  const isExp = ['COGS', 'OPEX', 'OTHER_EXPENSE'].includes(section);
                  const secFav = isExp ? secVar <= 0 : secVar >= 0;
                  const secYtdBudget = sectionLines.reduce((s, l) => s + l.ytd.budget, 0);
                  const secYtdActual = sectionLines.reduce((s, l) => s + l.ytd.actual, 0);
                  const secYtdVar = secYtdActual - secYtdBudget;

                  return (
                    <React.Fragment key={section}>
                      <tr className="bg-muted/20">
                        <td colSpan={8} className="px-3 py-1.5 font-semibold text-xs uppercase tracking-wide sticky left-0 bg-muted/20 z-10">
                          <Badge className={cn("mr-2", LINE_TYPE_COLORS[section])} variant="outline">
                            {groupLabels[section]}
                          </Badge>
                        </td>
                      </tr>
                      {sectionLines.map(line => {
                        const isExpanded = expandedRows.has(line.accountKey);
                        return (
                          <React.Fragment key={line.accountKey}>
                            <tr
                              className="border-b hover:bg-muted/10 cursor-pointer transition-colors"
                              onClick={() => toggleRow(line.accountKey)}
                            >
                              <td className="px-3 py-1.5 sticky left-0 bg-background z-10">
                                <div className="flex items-center gap-1.5">
                                  <ChevronRight className={cn("h-3.5 w-3.5 transition-transform text-muted-foreground", isExpanded && "rotate-90")} />
                                  {line.displayName}
                                </div>
                              </td>
                              <td className="text-right px-3 py-1.5 tabular-nums">{formatAmount(line.annual.budget)}</td>
                              <td className="text-right px-3 py-1.5 tabular-nums">{formatAmount(line.annual.actual)}</td>
                              <td className={cn("text-right px-3 py-1.5 tabular-nums font-medium", line.annual.favorable ? "text-emerald-600" : "text-red-600")}>
                                {line.annual.varDollar >= 0 ? "+" : ""}{formatAmount(line.annual.varDollar)}
                              </td>
                              <td className={cn("text-right px-3 py-1.5 tabular-nums", line.annual.favorable ? "text-emerald-600" : "text-red-600")}>
                                {line.annual.varPct >= 0 ? "+" : ""}{line.annual.varPct.toFixed(1)}%
                              </td>
                              <td className="text-right px-3 py-1.5 tabular-nums font-semibold bg-muted/10">{formatAmount(line.ytd.budget)}</td>
                              <td className="text-right px-3 py-1.5 tabular-nums font-semibold bg-muted/10">{formatAmount(line.ytd.actual)}</td>
                              <td className={cn("text-right px-3 py-1.5 tabular-nums font-semibold bg-muted/10", line.ytd.favorable ? "text-emerald-600" : "text-red-600")}>
                                {line.ytd.varDollar >= 0 ? "+" : ""}{formatAmount(line.ytd.varDollar)}
                              </td>
                            </tr>
                            {/* Monthly drill-down */}
                            {isExpanded && (
                              <>
                                <tr className="bg-muted/5">
                                  <td className="pl-10 pr-3 py-1 text-xs font-medium text-muted-foreground sticky left-0 bg-muted/5 z-10">Month</td>
                                  <td className="text-right px-3 py-1 text-xs font-medium text-muted-foreground">Budget</td>
                                  <td className="text-right px-3 py-1 text-xs font-medium text-muted-foreground">Actual</td>
                                  <td className="text-right px-3 py-1 text-xs font-medium text-muted-foreground">$ Var</td>
                                  <td className="text-right px-3 py-1 text-xs font-medium text-muted-foreground">% Var</td>
                                  <td colSpan={3} />
                                </tr>
                                {line.monthly.map((m, mi) => (
                                  <tr key={m.month} className={cn("border-b", m.isYtd ? "bg-background" : "bg-muted/5 opacity-60")}>
                                    <td className="pl-10 pr-3 py-1 text-xs sticky left-0 z-10" style={{ background: 'inherit' }}>
                                      {MONTHS_SHORT[mi]}
                                      {m.isYtd && <span className="ml-1 text-[10px] text-muted-foreground">(YTD)</span>}
                                    </td>
                                    <td className="text-right px-3 py-1 text-xs tabular-nums">{formatAmount(m.budget)}</td>
                                    <td className="text-right px-3 py-1 text-xs tabular-nums">{formatAmount(m.actual)}</td>
                                    <td className={cn("text-right px-3 py-1 text-xs tabular-nums", m.favorable ? "text-emerald-600" : "text-red-600")}>
                                      {m.varDollar >= 0 ? "+" : ""}{formatAmount(m.varDollar)}
                                    </td>
                                    <td className={cn("text-right px-3 py-1 text-xs tabular-nums", m.favorable ? "text-emerald-600" : "text-red-600")}>
                                      {m.varPct >= 0 ? "+" : ""}{m.varPct.toFixed(1)}%
                                    </td>
                                    <td colSpan={3} />
                                  </tr>
                                ))}
                              </>
                            )}
                          </React.Fragment>
                        );
                      })}
                      {/* Section total */}
                      <tr className="border-b-2 bg-muted/10 font-semibold">
                        <td className="px-3 py-1.5 sticky left-0 bg-muted/10 z-10">Total {groupLabels[section]}</td>
                        <td className="text-right px-3 py-1.5 tabular-nums">{formatAmount(secBudget)}</td>
                        <td className="text-right px-3 py-1.5 tabular-nums">{formatAmount(secActual)}</td>
                        <td className={cn("text-right px-3 py-1.5 tabular-nums", secFav ? "text-emerald-600" : "text-red-600")}>
                          {secVar >= 0 ? "+" : ""}{formatAmount(secVar)}
                        </td>
                        <td className={cn("text-right px-3 py-1.5 tabular-nums", secFav ? "text-emerald-600" : "text-red-600")}>
                          {secBudget !== 0 ? `${((secVar / Math.abs(secBudget)) * 100).toFixed(1)}%` : "—"}
                        </td>
                        <td className="text-right px-3 py-1.5 tabular-nums font-bold bg-muted/20">{formatAmount(secYtdBudget)}</td>
                        <td className="text-right px-3 py-1.5 tabular-nums font-bold bg-muted/20">{formatAmount(secYtdActual)}</td>
                        <td className={cn("text-right px-3 py-1.5 tabular-nums font-bold bg-muted/20",
                          (isExp ? secYtdVar <= 0 : secYtdVar >= 0) ? "text-emerald-600" : "text-red-600"
                        )}>
                          {secYtdVar >= 0 ? "+" : ""}{formatAmount(secYtdVar)}
                        </td>
                      </tr>
                    </React.Fragment>
                  );
                })}

                {/* NOI row */}
                <tr className="bg-slate-100 dark:bg-slate-800 font-bold border-t-2">
                  <td className="px-3 py-2 sticky left-0 bg-slate-100 dark:bg-slate-800 z-10">Net Operating Income</td>
                  <td className="text-right px-3 py-2 tabular-nums">{formatAmount(summary.noiBudget)}</td>
                  <td className="text-right px-3 py-2 tabular-nums">{formatAmount(summary.noiActual)}</td>
                  <td className={cn("text-right px-3 py-2 tabular-nums", noiVarAnnual >= 0 ? "text-emerald-600" : "text-red-600")}>
                    {noiVarAnnual >= 0 ? "+" : ""}{formatAmount(noiVarAnnual)}
                  </td>
                  <td className={cn("text-right px-3 py-2 tabular-nums", noiVarAnnual >= 0 ? "text-emerald-600" : "text-red-600")}>
                    {summary.noiBudget !== 0 ? `${((noiVarAnnual / Math.abs(summary.noiBudget)) * 100).toFixed(1)}%` : "—"}
                  </td>
                  <td className="text-right px-3 py-2 tabular-nums font-bold bg-slate-200 dark:bg-slate-700">{formatAmount(summary.ytdNoiBudget)}</td>
                  <td className="text-right px-3 py-2 tabular-nums font-bold bg-slate-200 dark:bg-slate-700">{formatAmount(summary.ytdNoiActual)}</td>
                  <td className={cn("text-right px-3 py-2 tabular-nums font-bold bg-slate-200 dark:bg-slate-700", noiVarYtd >= 0 ? "text-emerald-600" : "text-red-600")}>
                    {noiVarYtd >= 0 ? "+" : ""}{formatAmount(noiVarYtd)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
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
