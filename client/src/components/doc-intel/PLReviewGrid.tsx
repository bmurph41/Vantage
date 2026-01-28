import { useState, useMemo, Fragment } from "react";
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
  ChevronRight,
  RefreshCw,
  LayoutGrid,
  Calendar,
  AlertCircle,
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

interface MonthlyDataItem {
  id: string;
  periodKey: string;
  amount: number | null;
  status: string;
  categoryConfirmed?: string | null;
  categorySuggested?: string | null;
  confidenceScore?: string | null;
}

interface GroupedLineItem {
  lineItemName: string;
  sourceRow: number;
  monthlyData: MonthlyDataItem[];
  totalAmount: number;
  status: "pending" | "confirmed" | "excluded" | "mixed";
  suggestedCategory?: any;
  confirmedCategory?: any;
}

interface GroupedItemsResponse {
  lineItems: GroupedLineItem[];
  periods: string[];
  isMultiColumn: boolean;
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

function BulkDepartmentSelect({ 
  items, 
  selectedIds, 
  onDeptChange, 
  disabled 
}: { 
  items: ExtractedItem[];
  selectedIds: Set<string>;
  onDeptChange: (tier: CategoryTier, dept: string) => void;
  disabled: boolean;
}) {
  const commonTier = useMemo(() => {
    const selectedItems = items.filter(i => selectedIds.has(i.id));
    if (selectedItems.length === 0) return null;
    
    const tiers = selectedItems.map(i => i.categoryTierConfirmed || i.categoryTierSuggested);
    const uniqueTiers = [...new Set(tiers.filter(Boolean))];
    
    if (uniqueTiers.length === 1) return uniqueTiers[0] as CategoryTier;
    return null;
  }, [items, selectedIds]);

  if (!commonTier) {
    return (
      <Select disabled>
        <SelectTrigger className="h-8 w-[140px]">
          <SelectValue placeholder="Set Dept..." />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="_">Select same category first</SelectItem>
        </SelectContent>
      </Select>
    );
  }

  const deptOptions = getDeptOptionsForTier(commonTier);

  return (
    <Select
      value=""
      onValueChange={(v) => onDeptChange(commonTier, v)}
      disabled={disabled}
    >
      <SelectTrigger className="h-8 w-[140px]">
        <SelectValue placeholder="Set Dept..." />
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
}

export function PLReviewGrid({ projectId, uploadId, onApplyToModeling }: PLReviewGridProps) {
  const { toast } = useToast();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editingCell, setEditingCell] = useState<{ id: string; field: string } | null>(null);
  const [localEdits, setLocalEdits] = useState<Record<string, Partial<ExtractedItem>>>({});
  const [pendingMonthlyEdits, setPendingMonthlyEdits] = useState<Record<string, number>>({});
  const [showExcluded, setShowExcluded] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [excludeDialog, setExcludeDialog] = useState<{ open: boolean; item: ExtractedItem | null; reason: string }>({
    open: false,
    item: null,
    reason: "",
  });

  const { data: items = [], isLoading, refetch } = useQuery<ExtractedItem[]>({
    queryKey: ["/api/modeling/projects", projectId, "documents", uploadId, "items"],
    queryFn: async () => {
      const res = await fetch(`/api/modeling/projects/${projectId}/documents/${uploadId}/items`);
      if (!res.ok) throw new Error("Failed to fetch items");
      return res.json();
    },
  });

  const { data: groupedData, isLoading: isLoadingGrouped } = useQuery<GroupedItemsResponse>({
    queryKey: ["/api/modeling/projects", projectId, "documents", uploadId, "items", "grouped"],
    queryFn: async () => {
      const res = await fetch(`/api/modeling/projects/${projectId}/documents/${uploadId}/items?grouped=true`);
      if (!res.ok) throw new Error("Failed to fetch grouped items");
      return res.json();
    },
  });

  const toggleRowExpanded = (key: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const formatPeriodLabel = (periodKey: string): string => {
    if (periodKey === "single") return "";
    const [year, month] = periodKey.split("-");
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const monthIdx = parseInt(month, 10) - 1;
    return `${months[monthIdx] || month} '${year?.slice(-2) || year}`;
  };

  const updateItemMutation = useMutation({
    mutationFn: async ({ itemId, updates }: { itemId: string; updates: Partial<ExtractedItem> }) => {
      return apiRequest("PATCH", `/api/doc-intel/items/${itemId}`, updates);
    },
    onSuccess: async (_, variables) => {
      // Invalidate and wait for refetch to complete before clearing pending state
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/modeling/projects", projectId, "documents", uploadId, "items"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/modeling/projects", projectId, "documents", uploadId, "items", "grouped"] }),
      ]);
      // Now clear pending edit - fresh data is already in cache
      setPendingMonthlyEdits(prev => {
        const next = { ...prev };
        delete next[variables.itemId];
        return next;
      });
    },
    onError: (error: any, variables) => {
      // Clear pending edit on error immediately
      setPendingMonthlyEdits(prev => {
        const next = { ...prev };
        delete next[variables.itemId];
        return next;
      });
      toast({
        title: "Update Failed",
        description: error.message || "Failed to save changes. Please try again.",
        variant: "destructive",
      });
    },
  });

  const bulkUpdateMutation = useMutation({
    mutationFn: async (updates: { itemIds: string[]; updates: Partial<ExtractedItem> }) => {
      return apiRequest("PATCH", `/api/doc-intel/uploads/${uploadId}/items/bulk`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/modeling/projects", projectId, "documents", uploadId, "items"] });
      queryClient.invalidateQueries({ queryKey: ["/api/modeling/projects", projectId, "documents", uploadId, "items", "grouped"] });
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
      queryClient.invalidateQueries({ queryKey: ["/api/modeling/projects", projectId, "documents", uploadId, "items"] });
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

  const handleCategoryTierChange = async (itemId: string, tier: CategoryTier) => {
    const updates: Partial<ExtractedItem> = {
      categoryTierConfirmed: tier,
      revenueCogsDeptConfirmed: null,
      expenseDeptConfirmed: null,
    };
    await updateItemMutation.mutateAsync({ itemId, updates });
  };

  const handleDeptChange = async (itemId: string, tier: CategoryTier, dept: string) => {
    const updates: Partial<ExtractedItem> = tier === "expense"
      ? { expenseDeptConfirmed: dept }
      : { revenueCogsDeptConfirmed: dept };
    await updateItemMutation.mutateAsync({ itemId, updates });
  };

  const hasValidCategorization = (item: ExtractedItem): boolean => {
    const tier = (item.categoryTierConfirmed || item.categoryTierSuggested) as CategoryTier | null;
    if (!tier) return false;
    
    const dept = tier === "expense"
      ? (item.expenseDeptConfirmed || item.expenseDeptSuggested)
      : (item.revenueCogsDeptConfirmed || item.revenueCogsDeptSuggested);
    
    return !!dept;
  };

  const canConfirmItem = (item: ExtractedItem): boolean => {
    return hasValidCategorization(item) && item.status !== "confirmed";
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

  const getConfirmableSelectedIds = (): string[] => {
    return Array.from(selectedIds).filter((id) => {
      const item = items.find((i) => i.id === id);
      return item && hasValidCategorization(item) && item.status !== "confirmed";
    });
  };

  const handleBulkConfirm = () => {
    const confirmableIds = getConfirmableSelectedIds();
    if (confirmableIds.length === 0) {
      toast({ 
        title: "Cannot Confirm", 
        description: "All selected items need category and department set first.",
        variant: "destructive"
      });
      return;
    }
    bulkUpdateMutation.mutate({
      itemIds: confirmableIds,
      updates: { status: "confirmed" },
    });
  };

  const handleBulkExclude = () => {
    bulkUpdateMutation.mutate({
      itemIds: Array.from(selectedIds),
      updates: { status: "excluded" },
    });
  };

  const handleBulkCategoryChange = (tier: CategoryTier) => {
    bulkUpdateMutation.mutate({
      itemIds: Array.from(selectedIds),
      updates: { 
        categoryTierConfirmed: tier,
        revenueCogsDeptConfirmed: null,
        expenseDeptConfirmed: null,
      },
    });
  };

  const handleBulkDeptChange = (tier: CategoryTier, dept: string) => {
    const updates: Partial<ExtractedItem> = tier === "expense"
      ? { expenseDeptConfirmed: dept }
      : { revenueCogsDeptConfirmed: dept };
    bulkUpdateMutation.mutate({
      itemIds: Array.from(selectedIds),
      updates,
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
          const currentTier = (item.categoryTierConfirmed ||
            item.categoryTierSuggested) as CategoryTier | null;

          return (
            <Select
              value={currentTier || ""}
              onValueChange={(v) => handleCategoryTierChange(item.id, v as CategoryTier)}
              disabled={updateItemMutation.isPending}
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
          const currentTier = (item.categoryTierConfirmed ||
            item.categoryTierSuggested) as CategoryTier | null;

          if (!currentTier) {
            return <span className="text-muted-foreground text-sm">Select category first</span>;
          }

          const deptOptions = getDeptOptionsForTier(currentTier);
          const currentDept =
            currentTier === "expense"
              ? (item.expenseDeptConfirmed || item.expenseDeptSuggested)
              : (item.revenueCogsDeptConfirmed || item.revenueCogsDeptSuggested);

          return (
            <Select
              value={(currentDept as string) || ""}
              onValueChange={(v) => handleDeptChange(item.id, currentTier, v)}
              disabled={updateItemMutation.isPending}
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
          const canConfirm = canConfirmItem(item);
          const missingCategory = !hasValidCategorization(item);

          return (
            <div className="flex items-center gap-1">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className={`h-7 w-7 ${canConfirm ? "text-green-600 hover:text-green-700 hover:bg-green-50" : "text-gray-300"}`}
                      onClick={() => handleConfirm(item.id)}
                      disabled={updateItemMutation.isPending || !canConfirm}
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {missingCategory ? "Select category & department first" : "Confirm"}
                  </TooltipContent>
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
        size: 100,
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
              <Select
                value=""
                onValueChange={(v) => handleBulkCategoryChange(v as CategoryTier)}
                disabled={bulkUpdateMutation.isPending}
              >
                <SelectTrigger className="h-8 w-[130px]">
                  <SelectValue placeholder="Set Category" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORY_TIER_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <BulkDepartmentSelect 
                items={items} 
                selectedIds={selectedIds}
                onDeptChange={handleBulkDeptChange}
                disabled={bulkUpdateMutation.isPending}
              />
              <Button
                size="sm"
                variant="outline"
                onClick={handleBulkConfirm}
                disabled={bulkUpdateMutation.isPending}
              >
                <Check className="h-4 w-4 mr-1" />
                Confirm
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleBulkExclude}
                disabled={bulkUpdateMutation.isPending}
              >
                <X className="h-4 w-4 mr-1" />
                Exclude
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
        {isLoadingGrouped ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : !groupedData || !groupedData.lineItems ? (
          <div className="flex items-center justify-center h-48">
            <p className="text-muted-foreground">No data available.</p>
          </div>
        ) : (
            <div className="overflow-x-auto">
              <Table className="min-w-max">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8 bg-muted/50 sticky left-0 z-20"></TableHead>
                    <TableHead className="bg-muted/50 sticky left-8 z-20 min-w-[200px]">Line Item</TableHead>
                    {groupedData.isMultiColumn ? (
                      groupedData.periods.map((period) => (
                        <TableHead key={period} className="bg-muted/50 text-center min-w-[90px]">
                          {formatPeriodLabel(period)}
                        </TableHead>
                      ))
                    ) : (
                      <TableHead className="bg-muted/50 text-right min-w-[100px]">Amount</TableHead>
                    )}
                    {groupedData.isMultiColumn && (
                      <TableHead className="bg-muted/50 text-right min-w-[100px] sticky right-[180px] z-20">Total</TableHead>
                    )}
                    <TableHead className="bg-muted/50 text-center min-w-[90px] sticky right-[90px] z-20">Status</TableHead>
                    <TableHead className="bg-muted/50 text-center min-w-[90px] sticky right-0 z-20">Actions</TableHead>
                  </TableRow>
                </TableHeader>
              <TableBody>
                {groupedData.lineItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={groupedData.isMultiColumn ? groupedData.periods.length + 5 : 5} className="h-24 text-center">
                      No line items found.
                    </TableCell>
                  </TableRow>
                ) : (
                  groupedData.lineItems.map((lineItem) => {
                    const rowKey = `${lineItem.lineItemName}__${lineItem.sourceRow}`;
                    const isExpanded = expandedRows.has(rowKey);
                    
                    return (
                      <Fragment key={rowKey}>
                        <TableRow
                          className={
                            lineItem.status === "excluded"
                              ? "opacity-50 bg-muted/30"
                              : lineItem.status === "confirmed"
                              ? "bg-green-50/30 dark:bg-green-950/20"
                              : ""
                          }
                        >
                          <TableCell className="p-2 sticky left-0 z-10 bg-background">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                              onClick={() => toggleRowExpanded(rowKey)}
                            >
                              {isExpanded ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                            </Button>
                          </TableCell>
                          <TableCell className="font-medium sticky left-8 z-10 bg-background min-w-[200px]">
                            <span className="truncate block max-w-[250px]" title={lineItem.lineItemName}>
                              {lineItem.lineItemName}
                            </span>
                          </TableCell>
                          {groupedData.isMultiColumn ? (
                            groupedData.periods.map((period) => {
                              const monthData = lineItem.monthlyData.find(
                                (m) => m.periodKey === period
                              );
                              const statusColor = monthData?.status === "confirmed" 
                                ? "bg-green-50 dark:bg-green-950/30" 
                                : monthData?.status === "excluded"
                                ? "bg-gray-100 dark:bg-gray-800/50"
                                : "";
                              const isEditingThisCell = editingCell?.id === monthData?.id && editingCell?.field === "amount";
                              
                              return (
                                <TableCell 
                                  key={period} 
                                  className={`text-center text-sm font-mono ${statusColor} ${!isEditingThisCell ? 'cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-950/30' : ''}`}
                                  onClick={() => {
                                    if (monthData && !isEditingThisCell) {
                                      setEditingCell({ id: monthData.id, field: "amount" });
                                    }
                                  }}
                                >
                                  {isEditingThisCell && monthData ? (
                                    <Input
                                      type="number"
                                      defaultValue={monthData.amount || ""}
                                      className="h-7 w-20 text-center text-sm"
                                      autoFocus
                                      onBlur={(e) => {
                                        const newAmount = e.target.value;
                                        const newAmountNum = parseFloat(newAmount) || 0;
                                        if (newAmount !== String(monthData.amount || "")) {
                                          setPendingMonthlyEdits(prev => ({
                                            ...prev,
                                            [monthData.id]: newAmountNum,
                                          }));
                                          updateItemMutation.mutate({
                                            itemId: monthData.id,
                                            updates: { amountConfirmed: newAmount },
                                          });
                                        }
                                        setEditingCell(null);
                                      }}
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                          (e.target as HTMLInputElement).blur();
                                        } else if (e.key === "Escape") {
                                          setEditingCell(null);
                                        }
                                      }}
                                      onClick={(e) => e.stopPropagation()}
                                    />
                                  ) : (
                                    (() => {
                                      const pendingValue = monthData ? pendingMonthlyEdits[monthData.id] : undefined;
                                      const displayValue = pendingValue !== undefined ? pendingValue : monthData?.amount;
                                      const isPending = pendingValue !== undefined;
                                      return displayValue != null ? (
                                        <span className={isPending ? "opacity-70" : ""}>
                                          {formatCurrency(displayValue)}
                                          {isPending && <Loader2 className="h-3 w-3 ml-1 inline animate-spin" />}
                                        </span>
                                      ) : "-";
                                    })()
                                  )}
                                </TableCell>
                              );
                            })
                          ) : (
                            (() => {
                              const singleItem = lineItem.monthlyData[0];
                              const isEditingThisCell = singleItem && editingCell?.id === singleItem.id && editingCell?.field === "amount";
                              const statusColor = singleItem?.status === "confirmed" 
                                ? "bg-green-50 dark:bg-green-950/30" 
                                : singleItem?.status === "excluded"
                                ? "bg-gray-100 dark:bg-gray-800/50"
                                : "";
                              
                              return (
                                <TableCell 
                                  className={`text-right font-mono ${statusColor} ${!isEditingThisCell ? 'cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-950/30' : ''}`}
                                  onClick={() => {
                                    if (singleItem && !isEditingThisCell) {
                                      setEditingCell({ id: singleItem.id, field: "amount" });
                                    }
                                  }}
                                >
                                  {isEditingThisCell && singleItem ? (
                                    <Input
                                      type="number"
                                      defaultValue={singleItem.amount || ""}
                                      className="h-7 w-24 text-right text-sm ml-auto"
                                      autoFocus
                                      onBlur={(e) => {
                                        const newAmount = e.target.value;
                                        const newAmountNum = parseFloat(newAmount) || 0;
                                        if (newAmount !== String(singleItem.amount || "")) {
                                          setPendingMonthlyEdits(prev => ({
                                            ...prev,
                                            [singleItem.id]: newAmountNum,
                                          }));
                                          updateItemMutation.mutate({
                                            itemId: singleItem.id,
                                            updates: { amountConfirmed: newAmount },
                                          });
                                        }
                                        setEditingCell(null);
                                      }}
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                          (e.target as HTMLInputElement).blur();
                                        } else if (e.key === "Escape") {
                                          setEditingCell(null);
                                        }
                                      }}
                                      onClick={(e) => e.stopPropagation()}
                                    />
                                  ) : (
                                    (() => {
                                      const pendingValue = singleItem ? pendingMonthlyEdits[singleItem.id] : undefined;
                                      const displayValue = pendingValue !== undefined ? pendingValue : singleItem?.amount;
                                      const isPending = pendingValue !== undefined;
                                      return displayValue != null ? (
                                        <span className={isPending ? "opacity-70" : ""}>
                                          {formatCurrency(displayValue)}
                                          {isPending && <Loader2 className="h-3 w-3 ml-1 inline animate-spin" />}
                                        </span>
                                      ) : "-";
                                    })()
                                  )}
                                </TableCell>
                              );
                            })()
                          )}
                          {groupedData.isMultiColumn && (
                            <TableCell className="text-right font-semibold sticky right-[180px] z-10 bg-background">
                              {formatCurrency(lineItem.totalAmount)}
                            </TableCell>
                          )}
                          <TableCell className="text-center sticky right-[90px] z-10 bg-background">
                            <Badge
                              variant={
                                lineItem.status === "confirmed"
                                  ? "default"
                                  : lineItem.status === "excluded"
                                  ? "secondary"
                                  : lineItem.status === "mixed"
                                  ? "outline"
                                  : "secondary"
                              }
                              className={
                                lineItem.status === "confirmed"
                                  ? "bg-green-100 text-green-800"
                                  : lineItem.status === "pending"
                                  ? "bg-yellow-100 text-yellow-800"
                                  : ""
                              }
                            >
                              {lineItem.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center sticky right-0 z-10 bg-background">
                            <div className="flex items-center justify-center gap-1">
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 w-7 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                                      onClick={() => {
                                        const itemIds = lineItem.monthlyData.map((m) => m.id);
                                        bulkUpdateMutation.mutate({
                                          itemIds,
                                          updates: { status: "confirmed" },
                                        });
                                      }}
                                      disabled={bulkUpdateMutation.isPending || lineItem.status === "confirmed"}
                                    >
                                      <Check className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Confirm all months</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 w-7 p-0 text-red-500 hover:text-red-600 hover:bg-red-50"
                                      onClick={() => {
                                        const itemIds = lineItem.monthlyData.map((m) => m.id);
                                        bulkUpdateMutation.mutate({
                                          itemIds,
                                          updates: { status: "excluded" },
                                        });
                                      }}
                                      disabled={bulkUpdateMutation.isPending || lineItem.status === "excluded"}
                                    >
                                      <X className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Exclude all months</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </div>
                          </TableCell>
                        </TableRow>
                        {isExpanded && (
                          <TableRow className="bg-muted/20">
                            <TableCell colSpan={groupedData.isMultiColumn ? groupedData.periods.length + 5 : 5} className="p-4">
                              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
                                {lineItem.monthlyData.map((month) => (
                                  <div
                                    key={month.id}
                                    className="p-3 bg-background rounded-md border"
                                  >
                                    <div className="text-xs text-muted-foreground mb-1">
                                      {formatPeriodLabel(month.periodKey)}
                                    </div>
                                    <div className="font-medium">
                                      {month.amount != null
                                        ? formatCurrency(month.amount)
                                        : "-"}
                                    </div>
                                    <Badge
                                      variant="outline"
                                      className={`mt-1 text-xs ${
                                        month.status === "confirmed"
                                          ? "border-green-500 text-green-700"
                                          : month.status === "excluded"
                                          ? "border-gray-400 text-gray-500"
                                          : "border-yellow-500 text-yellow-700"
                                      }`}
                                    >
                                      {month.status}
                                    </Badge>
                                  </div>
                                ))}
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </Fragment>
                    );
                  })
                )}
              </TableBody>
              </Table>
            </div>
          )}
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
