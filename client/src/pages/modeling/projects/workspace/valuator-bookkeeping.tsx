import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Plus,
  Upload,
  Download,
  DollarSign,
  TrendingUp,
  TrendingDown,
  BookOpen,
  Edit,
  Trash2,
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { formatCurrency } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

interface ValuatorBookkeepingProps {
  projectId: string;
  projectName: string;
}

interface BookkeepingRow {
  id: string;
  projectId: string;
  orgId: string;
  periodMonth: string;
  revenueTotalOverride: string | null;
  expenseTotalOverride: string | null;
  noiOverride: string | null;
  importSource: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

const formatMonth = (dateStr: string): string => {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short" });
};

export default function ValuatorBookkeepingTab({ projectId, projectName }: ValuatorBookkeepingProps) {
  const { toast } = useToast();
  const csvInputRef = useRef<HTMLInputElement>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingRow, setEditingRow] = useState<BookkeepingRow | null>(null);
  const [formData, setFormData] = useState({
    periodMonth: new Date().toISOString().slice(0, 7) + "-01",
    revenueTotalOverride: "",
    expenseTotalOverride: "",
    noiOverride: "",
    importSource: "MANUAL",
    notes: "",
  });

  const { data: rows = [], isLoading } = useQuery<BookkeepingRow[]>({
    queryKey: ["/api/operations-context/projects", projectId, "assumptions", "bookkeeping"],
    queryFn: async () => {
      const res = await fetch(`/api/operations-context/projects/${projectId}/assumptions/bookkeeping`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch bookkeeping data");
      return res.json();
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      return apiRequest(`/api/operations-context/projects/${projectId}/assumptions/bookkeeping/bulk`, {
        method: "POST",
        body: JSON.stringify({
          rows: [{
            periodMonth: data.periodMonth,
            revenueTotalOverride: data.revenueTotalOverride || null,
            expenseTotalOverride: data.expenseTotalOverride || null,
            noiOverride: data.noiOverride || null,
            importSource: data.importSource,
            notes: data.notes || null,
          }],
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/operations-context/projects", projectId] });
      toast({ title: "Saved", description: "Bookkeeping entry saved" });
      setShowAddDialog(false);
      setEditingRow(null);
      resetForm();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to save bookkeeping entry", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(`/api/operations-context/projects/${projectId}/assumptions/bookkeeping/${id}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/operations-context/projects", projectId] });
      toast({ title: "Deleted", description: "Bookkeeping entry removed" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete entry", variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData({
      periodMonth: new Date().toISOString().slice(0, 7) + "-01",
      revenueTotalOverride: "",
      expenseTotalOverride: "",
      noiOverride: "",
      importSource: "MANUAL",
      notes: "",
    });
  };

  const openEditDialog = (row: BookkeepingRow) => {
    setEditingRow(row);
    setFormData({
      periodMonth: row.periodMonth,
      revenueTotalOverride: row.revenueTotalOverride || "",
      expenseTotalOverride: row.expenseTotalOverride || "",
      noiOverride: row.noiOverride || "",
      importSource: row.importSource || "MANUAL",
      notes: row.notes || "",
    });
    setShowAddDialog(true);
  };

  const totalRevenue = rows.reduce((sum, r) => sum + (parseFloat(r.revenueTotalOverride || "0") || 0), 0);
  const totalExpenses = rows.reduce((sum, r) => sum + (parseFloat(r.expenseTotalOverride || "0") || 0), 0);
  const totalNoi = rows.reduce((sum, r) => {
    if (r.noiOverride) return sum + (parseFloat(r.noiOverride) || 0);
    return sum + ((parseFloat(r.revenueTotalOverride || "0") || 0) - (parseFloat(r.expenseTotalOverride || "0") || 0));
  }, 0);

  const handleCsvImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const text = await file.text();
    const lines = text.split("\n").filter((l) => l.trim());
    if (lines.length < 2) {
      toast({ title: "Error", description: "CSV must have a header row and at least one data row", variant: "destructive" });
      return;
    }

    const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
    const dateIdx = headers.findIndex((h) => h.includes("date") || h.includes("month") || h.includes("period"));
    const revIdx = headers.findIndex((h) => h.includes("revenue") || h.includes("income"));
    const expIdx = headers.findIndex((h) => h.includes("expense") || h.includes("cost"));
    const noiIdx = headers.findIndex((h) => h.includes("noi") || h.includes("net"));

    if (dateIdx === -1) {
      toast({ title: "Error", description: "CSV must have a date/month/period column", variant: "destructive" });
      return;
    }

    const importRows = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
      if (cols.length < dateIdx + 1) continue;
      const row: Record<string, string | null> = {
        periodMonth: cols[dateIdx],
        revenueTotalOverride: revIdx >= 0 ? cols[revIdx] : null,
        expenseTotalOverride: expIdx >= 0 ? cols[expIdx] : null,
        noiOverride: noiIdx >= 0 ? cols[noiIdx] : null,
        importSource: "CSV_IMPORT",
        notes: null,
      };
      importRows.push(row);
    }

    try {
      await apiRequest(`/api/operations-context/projects/${projectId}/assumptions/bookkeeping/bulk`, {
        method: "POST",
        body: JSON.stringify({ rows: importRows }),
      });
      queryClient.invalidateQueries({ queryKey: ["/api/operations-context/projects", projectId] });
      toast({ title: "Import Complete", description: `${importRows.length} rows imported` });
    } catch {
      toast({ title: "Error", description: "Failed to import CSV data", variant: "destructive" });
    }

    if (csvInputRef.current) csvInputRef.current.value = "";
  };

  const handleExport = () => {
    if (rows.length === 0) return;
    const headers = ["Period,Revenue,Expenses,NOI,Source,Notes"];
    const csvRows = rows.map((r) => {
      const noi = r.noiOverride || String((parseFloat(r.revenueTotalOverride || "0") || 0) - (parseFloat(r.expenseTotalOverride || "0") || 0));
      return `${r.periodMonth},${r.revenueTotalOverride || 0},${r.expenseTotalOverride || 0},${noi},${r.importSource || ""},${(r.notes || "").replace(/,/g, ";")}`;
    });
    const csv = [...headers, ...csvRows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bookkeeping-${projectId.slice(0, 8)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-indigo-500" />
            Bookkeeping / GL Summary
          </h3>
          <p className="text-sm text-muted-foreground">
            Revenue and expense overrides for {projectName}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => csvInputRef.current?.click()}>
            <Upload className="h-4 w-4 mr-2" />
            Import CSV
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport} disabled={rows.length === 0}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
          <Button size="sm" onClick={() => { resetForm(); setEditingRow(null); setShowAddDialog(true); }}>
            <Plus className="h-4 w-4 mr-2" />
            Add Entry
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-emerald-50 rounded-lg">
                <TrendingUp className="h-4 w-4 text-emerald-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Revenue</p>
                <p className="text-lg font-bold">{formatCurrency(totalRevenue)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-red-50 rounded-lg">
                <TrendingDown className="h-4 w-4 text-red-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Expenses</p>
                <p className="text-lg font-bold">{formatCurrency(totalExpenses)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-blue-50 rounded-lg">
                <DollarSign className="h-4 w-4 text-blue-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total NOI</p>
                <p className="text-lg font-bold">{formatCurrency(totalNoi)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {rows.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <BookOpen className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-medium mb-2">No Bookkeeping Data</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Add revenue and expense overrides for financial modeling, or import from a CSV file.
            </p>
            <Button onClick={() => { resetForm(); setEditingRow(null); setShowAddDialog(true); }}>
              <Plus className="h-4 w-4 mr-2" />
              Add First Entry
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">GL Summary by Period</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Period</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                  <TableHead className="text-right">Expenses</TableHead>
                  <TableHead className="text-right">NOI</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => {
                  const rev = parseFloat(row.revenueTotalOverride || "0") || 0;
                  const exp = parseFloat(row.expenseTotalOverride || "0") || 0;
                  const noi = row.noiOverride ? parseFloat(row.noiOverride) : rev - exp;
                  return (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium">{formatMonth(row.periodMonth)}</TableCell>
                      <TableCell className="text-right font-mono">{formatCurrency(rev)}</TableCell>
                      <TableCell className="text-right font-mono">{formatCurrency(exp)}</TableCell>
                      <TableCell className={`text-right font-mono ${noi >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                        {formatCurrency(noi)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {row.importSource || "MANUAL"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                        {row.notes || "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openEditDialog(row)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => deleteMutation.mutate(row.id)}>
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingRow ? "Edit GL Entry" : "Add GL Entry"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Period (YYYY-MM-DD)</Label>
              <Input
                type="date"
                value={formData.periodMonth}
                onChange={(e) => setFormData({ ...formData, periodMonth: e.target.value })}
              />
            </div>
            <div>
              <Label>Total Revenue</Label>
              <Input
                type="number"
                placeholder="0.00"
                value={formData.revenueTotalOverride}
                onChange={(e) => setFormData({ ...formData, revenueTotalOverride: e.target.value })}
              />
            </div>
            <div>
              <Label>Total Expenses</Label>
              <Input
                type="number"
                placeholder="0.00"
                value={formData.expenseTotalOverride}
                onChange={(e) => setFormData({ ...formData, expenseTotalOverride: e.target.value })}
              />
            </div>
            <div>
              <Label>NOI Override (optional)</Label>
              <Input
                type="number"
                placeholder="Auto-calculated if blank"
                value={formData.noiOverride}
                onChange={(e) => setFormData({ ...formData, noiOverride: e.target.value })}
              />
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea
                placeholder="Optional notes..."
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>Cancel</Button>
            <Button onClick={() => saveMutation.mutate(formData)} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <input
        ref={csvInputRef}
        type="file"
        accept=".csv"
        className="hidden"
        onChange={handleCsvImport}
      />
    </div>
  );
}
