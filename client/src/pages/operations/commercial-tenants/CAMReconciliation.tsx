import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Calculator, Plus, DollarSign, Loader2, FileSpreadsheet } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ExpensePoolEntry {
  id: string;
  category: string;
  description: string | null;
  budgetAmount: string;
  actualAmount: string | null;
  fiscalYear: number;
}

interface ReconciliationEntry {
  id: string;
  leaseId: string;
  tenantName: string;
  unit: string | null;
  sqft: number | null;
  tenantProRataShare: string | null;
  estimatedCam: string | null;
  actualCam: string | null;
  varianceAmount: string | null;
  status: string;
  reconciledAt: string | null;
  fiscalYear: number;
}

const CAM_CATEGORIES = [
  { value: "insurance", label: "Insurance" },
  { value: "taxes", label: "Real Estate Taxes" },
  { value: "maintenance", label: "Maintenance" },
  { value: "utilities", label: "Utilities" },
  { value: "management", label: "Management Fees" },
  { value: "landscaping", label: "Landscaping" },
  { value: "security", label: "Security" },
  { value: "other", label: "Other" },
];

const statusConfig: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
  pending: { variant: "secondary", label: "Pending" },
  reconciled: { variant: "default", label: "Reconciled" },
  invoiced: { variant: "outline", label: "Invoiced" },
  paid: { variant: "default", label: "Paid" },
};

const formatCurrency = (value: string | number | null | undefined) => {
  if (value === null || value === undefined) return "-";
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "-";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
};

interface CAMReconciliationProps {
  marinaId?: string;
}

export default function CAMReconciliation({ marinaId }: CAMReconciliationProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const currentYear = new Date().getFullYear();

  const [fiscalYear, setFiscalYear] = useState(currentYear);
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [newCategory, setNewCategory] = useState("maintenance");
  const [newDescription, setNewDescription] = useState("");
  const [newBudget, setNewBudget] = useState("");
  const [newActual, setNewActual] = useState("");

  const effectiveMarinaId = marinaId || "default";

  const { data: expenses, isLoading: expensesLoading } = useQuery<ExpensePoolEntry[]>({
    queryKey: ["/api/cam/expense-pool", effectiveMarinaId, fiscalYear],
    queryFn: async () => {
      const res = await fetch(
        `/api/cam/expense-pool?marinaId=${effectiveMarinaId}&fiscalYear=${fiscalYear}`,
        { credentials: "include" }
      );
      if (!res.ok) throw new Error("Failed to load expense pool");
      return res.json();
    },
  });

  const { data: reconciliations, isLoading: reconciliationsLoading } = useQuery<ReconciliationEntry[]>({
    queryKey: ["/api/cam/reconciliation", effectiveMarinaId, fiscalYear],
    queryFn: async () => {
      const res = await fetch(
        `/api/cam/reconciliation?marinaId=${effectiveMarinaId}&fiscalYear=${fiscalYear}`,
        { credentials: "include" }
      );
      if (!res.ok) throw new Error("Failed to load reconciliation");
      return res.json();
    },
  });

  const addExpenseMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/cam/expense-pool", {
        marinaId: effectiveMarinaId,
        fiscalYear,
        category: newCategory,
        description: newDescription || undefined,
        budgetAmount: newBudget,
        actualAmount: newActual || null,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Expense added" });
      queryClient.invalidateQueries({ queryKey: ["/api/cam/expense-pool"] });
      setShowAddExpense(false);
      setNewCategory("maintenance");
      setNewDescription("");
      setNewBudget("");
      setNewActual("");
    },
    onError: (err: any) => {
      toast({ title: "Failed to add expense", description: err.message, variant: "destructive" });
    },
  });

  const computeMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/cam/reconciliation/compute", {
        marinaId: effectiveMarinaId,
        fiscalYear,
      });
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Reconciliation computed",
        description: `Computed allocations for ${data.tenantCount} tenants. Total CAM: ${formatCurrency(data.totalActualCam)}`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/cam/reconciliation"] });
    },
    onError: (err: any) => {
      toast({ title: "Failed to compute reconciliation", description: err.message, variant: "destructive" });
    },
  });

  const markInvoicedMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/cam/reconciliation/${id}/mark-invoiced`);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Marked as invoiced" });
      queryClient.invalidateQueries({ queryKey: ["/api/cam/reconciliation"] });
    },
    onError: (err: any) => {
      toast({ title: "Failed to update status", description: err.message, variant: "destructive" });
    },
  });

  const totalBudget = expenses?.reduce((sum, e) => sum + parseFloat(e.budgetAmount || "0"), 0) || 0;
  const totalActual = expenses?.reduce((sum, e) => sum + parseFloat(e.actualAmount || "0"), 0) || 0;

  const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

  return (
    <div className="space-y-6">
      {/* Year Selector */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">CAM Reconciliation</h2>
          <p className="text-sm text-muted-foreground">
            Common Area Maintenance expense allocation and tenant reconciliation
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-sm">Fiscal Year:</Label>
          <Select value={String(fiscalYear)} onValueChange={(v) => setFiscalYear(Number(v))}>
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {yearOptions.map((year) => (
                <SelectItem key={year} value={String(year)}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Expense Pool Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Expense Pool</CardTitle>
              <CardDescription>CAM expense categories with budget and actual amounts</CardDescription>
            </div>
            <Button size="sm" onClick={() => setShowAddExpense(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Expense
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {expensesLoading ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : !expenses?.length ? (
            <div className="text-center py-8">
              <DollarSign className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">No expense pool entries for {fiscalYear}</p>
              <Button variant="outline" className="mt-3" onClick={() => setShowAddExpense(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add First Expense
              </Button>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto w-full">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Category</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Budget</TableHead>
                    <TableHead className="text-right">Actual</TableHead>
                    <TableHead className="text-right">Variance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expenses.map((expense) => {
                    const budget = parseFloat(expense.budgetAmount || "0");
                    const actual = parseFloat(expense.actualAmount || "0");
                    const variance = actual - budget;
                    return (
                      <TableRow key={expense.id}>
                        <TableCell className="font-medium capitalize">{expense.category}</TableCell>
                        <TableCell className="text-muted-foreground">{expense.description || "-"}</TableCell>
                        <TableCell className="text-right">{formatCurrency(budget)}</TableCell>
                        <TableCell className="text-right">{expense.actualAmount ? formatCurrency(actual) : "-"}</TableCell>
                        <TableCell className={`text-right ${variance > 0 ? "text-red-600" : variance < 0 ? "text-green-600" : ""}`}>
                          {expense.actualAmount ? formatCurrency(variance) : "-"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  <TableRow className="font-semibold border-t-2">
                    <TableCell>Total</TableCell>
                    <TableCell></TableCell>
                    <TableCell className="text-right">{formatCurrency(totalBudget)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(totalActual)}</TableCell>
                    <TableCell className={`text-right ${(totalActual - totalBudget) > 0 ? "text-red-600" : (totalActual - totalBudget) < 0 ? "text-green-600" : ""}`}>
                      {formatCurrency(totalActual - totalBudget)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Tenant Allocations Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Tenant Allocations</CardTitle>
              <CardDescription>
                Pro-rata CAM allocation by tenant based on leased square footage
              </CardDescription>
            </div>
            <Button
              size="sm"
              onClick={() => computeMutation.mutate()}
              disabled={computeMutation.isPending || !expenses?.length}
            >
              {computeMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Calculator className="h-4 w-4 mr-2" />
              )}
              Compute Reconciliation
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {reconciliationsLoading ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : !reconciliations?.length ? (
            <div className="text-center py-8">
              <FileSpreadsheet className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">No reconciliation data for {fiscalYear}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Add expense pool entries and click "Compute Reconciliation" to generate tenant allocations.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto w-full">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tenant</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead className="text-right">SF</TableHead>
                  <TableHead className="text-right">Pro-Rata Share</TableHead>
                  <TableHead className="text-right">Estimated CAM</TableHead>
                  <TableHead className="text-right">Actual Allocation</TableHead>
                  <TableHead className="text-right">Variance</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[100px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reconciliations.map((rec) => {
                  const variance = parseFloat(rec.varianceAmount || "0");
                  const config = statusConfig[rec.status] || { variant: "outline" as const, label: rec.status };
                  return (
                    <TableRow key={rec.id}>
                      <TableCell className="font-medium">{rec.tenantName}</TableCell>
                      <TableCell>{rec.unit || "-"}</TableCell>
                      <TableCell className="text-right">{rec.sqft?.toLocaleString() || "-"}</TableCell>
                      <TableCell className="text-right">
                        {rec.tenantProRataShare ? `${parseFloat(rec.tenantProRataShare).toFixed(2)}%` : "-"}
                      </TableCell>
                      <TableCell className="text-right">{formatCurrency(rec.estimatedCam)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(rec.actualCam)}</TableCell>
                      <TableCell className={`text-right font-medium ${variance > 0 ? "text-red-600" : variance < 0 ? "text-green-600" : ""}`}>
                        {formatCurrency(variance)}
                        {variance !== 0 && (
                          <span className="text-xs ml-1">
                            ({variance > 0 ? "owes" : "credit"})
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={config.variant}>{config.label}</Badge>
                      </TableCell>
                      <TableCell>
                        {rec.status === "reconciled" && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => markInvoicedMutation.mutate(rec.id)}
                            disabled={markInvoicedMutation.isPending}
                          >
                            Invoice
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Expense Dialog */}
      <Dialog open={showAddExpense} onOpenChange={setShowAddExpense}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add CAM Expense</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={newCategory} onValueChange={setNewCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CAM_CATEGORIES.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Description (optional)</Label>
              <Input
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="e.g., Building insurance premium"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Budget Amount *</Label>
                <Input
                  type="number"
                  value={newBudget}
                  onChange={(e) => setNewBudget(e.target.value)}
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                />
              </div>
              <div className="space-y-2">
                <Label>Actual Amount</Label>
                <Input
                  type="number"
                  value={newActual}
                  onChange={(e) => setNewActual(e.target.value)}
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddExpense(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => addExpenseMutation.mutate()}
              disabled={!newBudget || addExpenseMutation.isPending}
            >
              {addExpenseMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Plus className="h-4 w-4 mr-2" />
              )}
              Add Expense
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
