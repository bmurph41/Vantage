import { useState, useMemo } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  getSortedRowModel,
  SortingState,
} from "@tanstack/react-table";
import type { ColumnDef } from "@tanstack/react-table";
import { 
  Check, 
  X, 
  Loader2, 
  ArrowUpDown, 
  Eye,
  EyeOff,
  ChevronDown,
  Save,
  RefreshCw
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  CategoryTier,
  CATEGORY_TIER_OPTIONS,
  getDeptOptionsForTier,
  getDeptLabel,
  CATEGORY_TIER_LABELS,
} from "@/lib/pnl-categories";

interface ExtractedItem {
  id: string;
  rawText: string;
  amount: string | null;
  status: "pending" | "confirmed" | "rejected" | "needs_review" | "excluded";
  categoryTierSuggested: CategoryTier | null;
  categoryTierConfirmed: CategoryTier | null;
  revenueCogsDeptSuggested: string | null;
  revenueCogsDeptConfirmed: string | null;
  expenseDeptSuggested: string | null;
  expenseDeptConfirmed: string | null;
  confidenceScore: string | null;
  periodKey: string | null;
  sourcePage: number | null;
  sourceRow: number | null;
  amountConfirmed: string | null;
}

interface PLReviewGridProps {
  projectId: string;
  uploadId: string;
  onApplyToModeling?: () => void;
}

function formatCurrency(value: string | number | null): string {
  if (value === null || value === undefined) return "-";
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "-";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
}

export function PLReviewGrid({ projectId, uploadId, onApplyToModeling }: PLReviewGridProps) {
  const { toast } = useToast();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editingCell, setEditingCell] = useState<{ id: string; field: string } | null>(null);
  const [localEdits, setLocalEdits] = useState<Record<string, Partial<ExtractedItem>>>({});
  const [showExcluded, setShowExcluded] = useState(false);
  const [excludeDialog, setExcludeDialog] = useState<{ open: boolean; item: ExtractedItem | null; reason: string }>({
    open: false,
    item: null,
    reason: "",
  });

  const { data: items = [], isLoading, refetch } = useQuery<ExtractedItem[]>({
    queryKey: ["/api/doc-intel/uploads", uploadId, "items"],
    queryFn: async () => {
      const res = await fetch(`/api/doc-intel/uploads/${uploadId}/items`);
      if (!res.ok) throw new Error("Failed to fetch items");
      return res.json();
    },
  });

  const updateItemMutation = useMutation({
    mutationFn: async ({ itemId, updates }: { itemId: string; updates: Partial<ExtractedItem> }) => {
      return apiRequest("PATCH", `/api/doc-intel/items/${itemId}`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/doc-intel/uploads", uploadId, "items"] });
    },
  });

  const bulkUpdateMutation = useMutation({
    mutationFn: async (updates: { itemIds: string[]; updates: Partial<ExtractedItem> }) => {
      return apiRequest("PATCH", `/api/doc-intel/uploads/${uploadId}/items/bulk`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/doc-intel/uploads", uploadId, "items"] });
      setSelectedIds(new Set());
      toast({ title: "Updated", description: "Selected items have been updated." });
    },
  });

  const applyToModelingMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/modeling/projects/${projectId}/documents/${uploadId}/import`, {
        method: "POST",
        body: JSON.stringify({}),
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        if (res.status === 403) {
          throw new Error("You don't have permission to perform this action.");
        }
        if (res.status === 401) {
          throw new Error("Please log in to continue.");
        }
        throw new Error(errorData.message || errorData.error || `Failed to import (${res.status})`);
      }
      
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/doc-intel/uploads", uploadId, "items"] });
      queryClient.invalidateQueries({ queryKey: ["/api/modeling/projects", projectId, "pnl"] });
      const count = Array.isArray(data) ? data.length : 0;
      toast({ 
        title: "Applied to Modeling", 
        description: count > 0 
          ? `${count} confirmed items imported to your P&L model.`
          : "Items imported successfully."
      });
      onApplyToModeling?.();
    },
    onError: (error: any) => {
      toast({ 
        title: "Import Failed", 
        description: error.message || "Failed to apply data to modeling.", 
        variant: "destructive" 
      });
    },
  });

  const getEffectiveValue = (item: ExtractedItem, field: keyof ExtractedItem) => {
    const local = localEdits[item.id];
    if (local && field in local) return local[field];
    return item[field];
  };

  const handleLocalEdit = (itemId: string, field: string, value: any) => {
    setLocalEdits((prev) => ({
      ...prev,
      [itemId]: { ...prev[itemId], [field]: value },
    }));
  };

  const saveLocalEdits = async (itemId: string) => {
    const edits = localEdits[itemId];
    if (!edits) return;

    await updateItemMutation.mutateAsync({ itemId, updates: edits });
    setLocalEdits((prev) => {
      const next = { ...prev };
      delete next[itemId];
      return next;
    });
    setEditingCell(null);
  };

  const handleCategoryTierChange = (itemId: string, tier: CategoryTier) => {
    handleLocalEdit(itemId, "categoryTierConfirmed", tier);
    handleLocalEdit(itemId, "revenueCogsDeptConfirmed", null);
    handleLocalEdit(itemId, "expenseDeptConfirmed", null);
  };

  const handleDeptChange = (itemId: string, tier: CategoryTier, dept: string) => {
    if (tier === "revenue" || tier === "cogs") {
      handleLocalEdit(itemId, "revenueCogsDeptConfirmed", dept);
    } else {
      handleLocalEdit(itemId, "expenseDeptConfirmed", dept);
    }
  };

  const handleConfirm = async (itemId: string) => {
    const edits = localEdits[itemId] || {};
    await updateItemMutation.mutateAsync({
      itemId,
      updates: { ...edits, status: "confirmed" },
    });
    setLocalEdits((prev) => {
      const next = { ...prev };
      delete next[itemId];
      return next;
    });
  };

  const openExcludeDialog = (item: ExtractedItem) => {
    setExcludeDialog({ open: true, item, reason: "" });
  };

  const confirmExclude = async () => {
    if (!excludeDialog.item) return;
    
    const itemId = excludeDialog.item.id;
    const reason = excludeDialog.reason.trim();
    
    await updateItemMutation.mutateAsync({
      itemId,
      updates: { 
        status: "excluded",
        reviewNotes: reason || undefined,
      },
    });
    
    toast({ 
      title: "Excluded", 
      description: reason 
        ? "Item excluded. Reason saved for future AI training." 
        : "Item excluded from import." 
    });
    
    setExcludeDialog({ open: false, item: null, reason: "" });
  };

  const handleBulkConfirm = () => {
    bulkUpdateMutation.mutate({
      itemIds: Array.from(selectedIds),
      updates: { status: "confirmed" },
    });
  };

  const handleBulkExclude = () => {
    bulkUpdateMutation.mutate({
      itemIds: Array.from(selectedIds),
      updates: { status: "excluded" },
    });
  };

  const filteredItems = useMemo(() => {
    if (showExcluded) return items;
    return items.filter((item) => item.status !== "excluded");
  }, [items, showExcluded]);

  const columns = useMemo<ColumnDef<ExtractedItem>[]>(
    () => [
      {
        id: "select",
        header: ({ table }) => (
          <Checkbox
            checked={table.getIsAllPageRowsSelected()}
            onCheckedChange={(value) => {
              table.toggleAllPageRowsSelected(!!value);
              if (value) {
                setSelectedIds(new Set(filteredItems.map((i) => i.id)));
              } else {
                setSelectedIds(new Set());
              }
            }}
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={selectedIds.has(row.original.id)}
            onCheckedChange={(value) => {
              const next = new Set(selectedIds);
              if (value) {
                next.add(row.original.id);
              } else {
                next.delete(row.original.id);
              }
              setSelectedIds(next);
            }}
          />
        ),
        size: 40,
      },
      {
        accessorKey: "rawText",
        header: ({ column }) => (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Line Item
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        ),
        cell: ({ row }) => {
          const item = row.original;
          const isEditing = editingCell?.id === item.id && editingCell?.field === "rawText";
          const value = getEffectiveValue(item, "rawText") as string;

          if (isEditing) {
            return (
              <Input
                value={value}
                onChange={(e) => handleLocalEdit(item.id, "rawText", e.target.value)}
                onBlur={() => saveLocalEdits(item.id)}
                onKeyDown={(e) => e.key === "Enter" && saveLocalEdits(item.id)}
                autoFocus
                className="h-8"
              />
            );
          }

          return (
            <div
              className="cursor-pointer hover:bg-muted/50 px-2 py-1 rounded text-sm max-w-[300px] truncate"
              onClick={() => setEditingCell({ id: item.id, field: "rawText" })}
              title={value}
            >
              {value}
            </div>
          );
        },
        size: 300,
      },
      {
        accessorKey: "amount",
        header: ({ column }) => (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Amount
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        ),
        cell: ({ row }) => {
          const item = row.original;
          const isEditing = editingCell?.id === item.id && editingCell?.field === "amount";
          const confirmedAmount = getEffectiveValue(item, "amountConfirmed");
          const displayAmount = confirmedAmount || item.amount;

          if (isEditing) {
            return (
              <Input
                type="number"
                value={confirmedAmount || item.amount || ""}
                onChange={(e) => handleLocalEdit(item.id, "amountConfirmed", e.target.value)}
                onBlur={() => saveLocalEdits(item.id)}
                onKeyDown={(e) => e.key === "Enter" && saveLocalEdits(item.id)}
                autoFocus
                className="h-8 w-28"
              />
            );
          }

          return (
            <div
              className="cursor-pointer hover:bg-muted/50 px-2 py-1 rounded text-sm font-mono text-right"
              onClick={() => setEditingCell({ id: item.id, field: "amount" })}
            >
              {formatCurrency(displayAmount)}
            </div>
          );
        },
        size: 120,
      },
      {
        id: "categoryTier",
        header: "Category",
        cell: ({ row }) => {
          const item = row.original;
          const currentTier = (getEffectiveValue(item, "categoryTierConfirmed") ||
            item.categoryTierSuggested) as CategoryTier | null;

          return (
            <Select
              value={currentTier || ""}
              onValueChange={(v) => handleCategoryTierChange(item.id, v as CategoryTier)}
            >
              <SelectTrigger className="h-8 w-[140px]">
                <SelectValue placeholder="Select...">
                  {currentTier ? CATEGORY_TIER_LABELS[currentTier] : "Select..."}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {CATEGORY_TIER_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          );
        },
        size: 150,
      },
      {
        id: "department",
        header: "Department",
        cell: ({ row }) => {
          const item = row.original;
          const currentTier = (getEffectiveValue(item, "categoryTierConfirmed") ||
            item.categoryTierSuggested) as CategoryTier | null;

          if (!currentTier) {
            return <span className="text-muted-foreground text-sm">Select category first</span>;
          }

          const deptOptions = getDeptOptionsForTier(currentTier);
          const currentDept =
            currentTier === "expense"
              ? (getEffectiveValue(item, "expenseDeptConfirmed") || item.expenseDeptSuggested)
              : (getEffectiveValue(item, "revenueCogsDeptConfirmed") || item.revenueCogsDeptSuggested);

          return (
            <Select
              value={(currentDept as string) || ""}
              onValueChange={(v) => handleDeptChange(item.id, currentTier, v)}
            >
              <SelectTrigger className="h-8 w-[160px]">
                <SelectValue placeholder="Select...">
                  {currentDept ? getDeptLabel(currentTier, currentDept as string) : "Select..."}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {deptOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          );
        },
        size: 180,
      },
      {
        accessorKey: "confidenceScore",
        header: "Confidence",
        cell: ({ row }) => {
          const score = row.original.confidenceScore;
          if (!score) return <span className="text-muted-foreground">-</span>;
          const pct = (parseFloat(score) * 100).toFixed(0);
          return (
            <Badge variant={parseFloat(score) >= 0.8 ? "default" : "secondary"}>
              {pct}%
            </Badge>
          );
        },
        size: 90,
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => {
          const status = row.original.status;
          const statusColors: Record<string, string> = {
            pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
            confirmed: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
            excluded: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400",
            needs_review: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300",
            rejected: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
          };
          return (
            <Badge className={statusColors[status] || ""}>
              {status.replace("_", " ")}
            </Badge>
          );
        },
        size: 100,
      },
      {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => {
          const item = row.original;
          const hasEdits = !!localEdits[item.id];

          return (
            <div className="flex items-center gap-1">
              {hasEdits && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => saveLocalEdits(item.id)}
                        disabled={updateItemMutation.isPending}
                      >
                        <Save className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Save changes</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-green-600 hover:text-green-700 hover:bg-green-50"
                      onClick={() => handleConfirm(item.id)}
                      disabled={updateItemMutation.isPending || item.status === "confirmed"}
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Confirm</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-red-600 hover:text-red-700 hover:bg-red-50"
                      onClick={() => openExcludeDialog(item)}
                      disabled={updateItemMutation.isPending || item.status === "excluded"}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Exclude</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          );
        },
        size: 120,
      },
    ],
    [selectedIds, editingCell, localEdits, filteredItems, updateItemMutation.isPending]
  );

  const table = useReactTable({
    data: filteredItems,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setSorting,
    state: { sorting },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const confirmedCount = items.filter((i) => i.status === "confirmed").length;
  const excludedCount = items.filter((i) => i.status === "excluded").length;
  const pendingCount = items.filter((i) => i.status === "pending" || i.status === "needs_review").length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm">
            <Badge variant="outline" className="bg-green-50">
              {confirmedCount} confirmed
            </Badge>
            <Badge variant="outline" className="bg-yellow-50">
              {pendingCount} pending
            </Badge>
            <Badge variant="outline" className="bg-gray-50">
              {excludedCount} excluded
            </Badge>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowExcluded(!showExcluded)}
          >
            {showExcluded ? (
              <>
                <EyeOff className="h-4 w-4 mr-1" />
                Hide Excluded
              </>
            ) : (
              <>
                <Eye className="h-4 w-4 mr-1" />
                Show Excluded
              </>
            )}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-1" />
            Refresh
          </Button>
        </div>
        <div className="flex items-center gap-2">
          {selectedIds.size > 0 && (
            <>
              <span className="text-sm text-muted-foreground">
                {selectedIds.size} selected
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={handleBulkConfirm}
                disabled={bulkUpdateMutation.isPending}
              >
                <Check className="h-4 w-4 mr-1" />
                Confirm All
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleBulkExclude}
                disabled={bulkUpdateMutation.isPending}
              >
                <X className="h-4 w-4 mr-1" />
                Exclude All
              </Button>
            </>
          )}
          {confirmedCount > 0 && (
            <Button 
              size="sm" 
              onClick={() => applyToModelingMutation.mutate()}
              disabled={applyToModelingMutation.isPending}
            >
              {applyToModelingMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  Applying...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4 mr-1" />
                  Apply to Modeling ({confirmedCount} items)
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    style={{ width: header.getSize() }}
                    className="bg-muted/50"
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  No line items found.
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  className={
                    row.original.status === "excluded"
                      ? "opacity-50 bg-muted/30"
                      : row.original.status === "confirmed"
                      ? "bg-green-50/30 dark:bg-green-950/20"
                      : ""
                  }
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} style={{ width: cell.column.getSize() }}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={excludeDialog.open} onOpenChange={(open) => !open && setExcludeDialog({ open: false, item: null, reason: "" })}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Exclude Line Item</DialogTitle>
            <DialogDescription>
              Why are you excluding this item? This helps train the AI to recognize similar items in the future.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="bg-muted/50 p-3 rounded-md">
              <p className="text-sm font-medium">"{excludeDialog.item?.rawText}"</p>
              {excludeDialog.item?.amount && (
                <p className="text-sm text-muted-foreground mt-1">
                  Amount: {formatCurrency(excludeDialog.item.amount)}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="exclude-reason">Reason (optional)</Label>
              <Textarea
                id="exclude-reason"
                placeholder="e.g., This is a subtotal row, not an actual expense"
                value={excludeDialog.reason}
                onChange={(e) => setExcludeDialog((prev) => ({ ...prev, reason: e.target.value }))}
                rows={3}
              />
              <p className="text-xs text-muted-foreground">
                Adding a reason helps the AI learn to automatically exclude similar items.
              </p>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setExcludeDialog({ open: false, item: null, reason: "" })}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmExclude}
              disabled={updateItemMutation.isPending}
            >
              {updateItemMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Exclude Item
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
