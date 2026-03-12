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
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { formatPeriodLabel } from "@/lib/period-utils";
import {
  CategoryTier,
  CATEGORY_TIER_OPTIONS,
  getDeptOptionsForTier,
  getFilteredDeptOptionsForTier,
  getEnabledRevenueCogsDepts,
  getDeptLabel,
  CATEGORY_TIER_LABELS,
  EXPENSE_DEPT_OPTIONS,
  REVENUE_COGS_DEPT_OPTIONS,
  type RevenueCogsDept,
} from "@/lib/pnl-categories";
import type { ProjectConfig } from "@/types/modeling";
import { AutoConfirmedBadge } from "./AutoConfirmedBadge";

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
  autoConfirmed?: boolean;
  confidence?: 'high' | 'medium' | 'low';
  ruleId?: string;
  learningRuleApplied?: boolean;
}

interface MonthlyDataItem {
  id: string;
  periodKey: string;
  amount: number | null;
  status: string;
  categoryConfirmed?: string | null;
  categorySuggested?: string | null;
  categoryTierConfirmed?: CategoryTier | null;
  categoryTierSuggested?: CategoryTier | null;
  revenueCogsDeptConfirmed?: string | null;
  revenueCogsDeptSuggested?: string | null;
  expenseDeptConfirmed?: string | null;
  expenseDeptSuggested?: string | null;
  confidenceScore?: string | null;
}

interface GroupedLineItem {
  lineItemName: string;
  sourceRow: number;
  entityName: string | null;
  parentItemId: string | null;
  isTotal: boolean;
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

// Derived structure for entity grouping UI
interface EntityGroup {
  entityName: string;
  isTotal: boolean;
  rows: GroupedLineItem[];
}


interface PLReviewGridProps {
  projectId: string;
  uploadId: string;
  onApplyToModeling?: () => void;
  statusFilter?: 'all' | 'pending' | 'confirmed' | 'rejected' | 'excluded';
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
  disabled,
  enabledRevCogsDepts 
}: { 
  items: ExtractedItem[];
  selectedIds: Set<string>;
  onDeptChange: (tier: CategoryTier, dept: string) => void;
  disabled: boolean;
  enabledRevCogsDepts?: RevenueCogsDept[];
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

  const deptOptions = getFilteredDeptOptionsForTier(commonTier, enabledRevCogsDepts);

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


// ─── Sortable column header helper ───────────────────────────────────────────
function SortableHead({
  label,
  field,
  activeField,
  dir,
  onToggle,
  className = '',
}: {
  label: string;
  field: string;
  activeField: string | null;
  dir: 'asc' | 'desc';
  onToggle: (f: any) => void;
  className?: string;
}) {
  const isActive = activeField === field;
  return (
    <button
      type="button"
      className={`flex items-center gap-1 text-xs font-medium text-left w-full hover:text-foreground transition-colors ${isActive ? 'text-foreground' : 'text-muted-foreground'} ${className}`}
      onClick={() => onToggle(field)}
    >
      {label}
      <span className="flex flex-col leading-none ml-0.5">
        <span className={`text-[8px] leading-none ${isActive && dir === 'asc' ? 'text-primary' : 'text-muted-foreground/40'}`}>▲</span>
        <span className={`text-[8px] leading-none ${isActive && dir === 'desc' ? 'text-primary' : 'text-muted-foreground/40'}`}>▼</span>
      </span>
    </button>
  );
}

export function PLReviewGrid({ projectId, uploadId, onApplyToModeling, statusFilter = 'all' }: PLReviewGridProps) {
  const { toast } = useToast();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [groupedSortField, setGroupedSortField] = useState<'lineItemName' | 'totalAmount' | 'status' | null>(null);
  const [groupedSortDir, setGroupedSortDir] = useState<'asc' | 'desc'>('asc');

  const toggleGroupedSort = (field: 'lineItemName' | 'totalAmount' | 'status') => {
    if (groupedSortField === field) {
      setGroupedSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setGroupedSortField(field);
      setGroupedSortDir('asc');
    }
  };
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editingCell, setEditingCell] = useState<{ id: string; field: string } | null>(null);
  const [localEdits, setLocalEdits] = useState<Record<string, Partial<ExtractedItem>>>({});
  const [pendingMonthlyEdits, setPendingMonthlyEdits] = useState<Record<string, number>>({});
  const [showExcluded, setShowExcluded] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [expandedEntities, setExpandedEntities] = useState<Set<string>>(new Set(['__TOTALS__']));
  const toggleEntityExpanded = (entityName: string) => {
    setExpandedEntities(prev => {
      const next = new Set(prev);
      if (next.has(entityName)) next.delete(entityName); else next.add(entityName);
      return next;
    });
  };
  const [selectedRowKeys, setSelectedRowKeys] = useState<Set<string>>(new Set());
  const [excludeDialog, setExcludeDialog] = useState<{ open: boolean; item: ExtractedItem | null; reason: string }>({
    open: false,
    item: null,
    reason: "",
  });
  
  // Optimistic state for category/department changes (per line item name)
  const [optimisticCategories, setOptimisticCategories] = useState<Record<string, CategoryTier>>({});
  const [optimisticDepartments, setOptimisticDepartments] = useState<Record<string, string>>({});

  const { data: projectConfig } = useQuery<ProjectConfig>({
    queryKey: ['/api/modeling/projects', projectId, 'config'],
  });

  const enabledRevCogsDepts = useMemo(
    () => getEnabledRevenueCogsDepts(projectConfig?.profitCenters),
    [projectConfig?.profitCenters]
  );

  const { data: items = [], isLoading, refetch } = useQuery<ExtractedItem[]>({
    queryKey: ["/api/modeling/projects", projectId, "documents", uploadId, "items"],
    queryFn: async () => {
      const res = await fetch(`/api/modeling/projects/${projectId}/documents/${uploadId}/items`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch items");
      return res.json();
    },
  });

  const { data: groupedData, isLoading: isLoadingGrouped, error: groupedError } = useQuery<GroupedItemsResponse>({
    queryKey: ["/api/modeling/projects", projectId, "documents", uploadId, "items", "grouped"],
    queryFn: async () => {
      const res = await fetch(`/api/modeling/projects/${projectId}/documents/${uploadId}/items?grouped=true`, { credentials: "include" });
      if (!res.ok) {
        const errorText = await res.text();
        console.error("GROUPED API ERROR:", res.status, errorText);
        throw new Error("Failed to fetch grouped items");
      }
      const data = await res.json();
      return data;
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

  const updateItemMutation = useMutation({
    mutationFn: async ({ itemId, updates }: { itemId: string; updates: Partial<ExtractedItem> }) => {
      const res = await apiRequest("PATCH", `/api/doc-intel/items/${itemId}`, updates);
      return res;
    },
    onSuccess: async (data: any, variables) => {
      const invalidations = [
        queryClient.invalidateQueries({ queryKey: ["/api/modeling/projects", projectId, "documents", uploadId, "items"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/modeling/projects", projectId, "documents", uploadId, "items", "grouped"] }),
      ];
      if (data?._propagation?.affectedUploadIds?.length > 0) {
        for (const siblingUploadId of data._propagation.affectedUploadIds) {
          invalidations.push(
            queryClient.invalidateQueries({ queryKey: ["/api/modeling/projects", projectId, "documents", siblingUploadId, "items"] }),
            queryClient.invalidateQueries({ queryKey: ["/api/modeling/projects", projectId, "documents", siblingUploadId, "items", "grouped"] }),
          );
        }
      }
      await Promise.all(invalidations);
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

  const [bulkOpLabel, setBulkOpLabel] = useState<string>("");

  const bulkUpdateMutation = useMutation({
    mutationFn: async (updates: { itemIds: string[]; updates: Partial<ExtractedItem>; lineItemKey?: string; silent?: boolean }) => {
      const status = updates.updates.status;
      const count = updates.itemIds.length;
      if (status === "confirmed") {
        setBulkOpLabel(`Confirming ${count} item${count !== 1 ? "s" : ""}…`);
      } else if (status === "rejected") {
        setBulkOpLabel(`Rejecting ${count} item${count !== 1 ? "s" : ""}…`);
      } else if (updates.updates.categoryTierConfirmed) {
        setBulkOpLabel(`Updating category for ${count} item${count !== 1 ? "s" : ""}…`);
      } else if (updates.updates.expenseDeptConfirmed || updates.updates.revenueCogsDeptConfirmed) {
        setBulkOpLabel(`Updating department for ${count} item${count !== 1 ? "s" : ""}…`);
      } else {
        setBulkOpLabel(`Updating ${count} item${count !== 1 ? "s" : ""}…`);
      }
      return apiRequest("PATCH", `/api/doc-intel/uploads/${uploadId}/items/bulk`, { itemIds: updates.itemIds, updates: updates.updates });
    },
    onSuccess: async (data: any, variables) => {
      const invalidations = [
        queryClient.invalidateQueries({ queryKey: ["/api/modeling/projects", projectId, "documents", uploadId, "items"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/modeling/projects", projectId, "documents", uploadId, "items", "grouped"] }),
      ];
      if (data?._propagation?.affectedUploadIds?.length > 0) {
        for (const siblingUploadId of data._propagation.affectedUploadIds) {
          invalidations.push(
            queryClient.invalidateQueries({ queryKey: ["/api/modeling/projects", projectId, "documents", siblingUploadId, "items"] }),
            queryClient.invalidateQueries({ queryKey: ["/api/modeling/projects", projectId, "documents", siblingUploadId, "items", "grouped"] }),
          );
        }
      }
      await Promise.all(invalidations);
      setSelectedIds(new Set());
      if (variables.lineItemKey) {
        setOptimisticCategories(prev => {
          const next = { ...prev };
          delete next[variables.lineItemKey!];
          return next;
        });
        setOptimisticDepartments(prev => {
          const next = { ...prev };
          delete next[variables.lineItemKey!];
          return next;
        });
      }
      if (!variables.silent && variables.itemIds.length > 1 && !variables.lineItemKey) {
        toast({ title: "Updated", description: "Selected items have been updated." });
      }
      setBulkOpLabel("");
    },
    onError: (error: any) => {
      setBulkOpLabel("");
      toast({
        title: "Cannot Confirm",
        description: error.message || "Items must have both Category and Department set before confirming.",
        variant: "destructive",
      });
    },
  });

  const applyToModelingMutation = useMutation({
    mutationFn: async () => {
      return apiRequest(`/api/modeling/projects/${projectId}/documents/${uploadId}/import`, {
        method: "POST",
        body: JSON.stringify({}),
        headers: { "Content-Type": "application/json" },
      });
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

  const openRejectDialog = (item: ExtractedItem) => {
    setExcludeDialog({ open: true, item, reason: "" });
  };

  const confirmReject = async () => {
    if (!excludeDialog.item) return;
    
    const itemId = excludeDialog.item.id;
    const reason = excludeDialog.reason.trim();
    
    await updateItemMutation.mutateAsync({
      itemId,
      updates: { 
        status: "rejected",
        reviewNotes: reason || undefined,
      },
    });
    
    toast({ 
      title: "Rejected", 
      description: reason 
        ? "Item rejected. Reason saved for future AI training." 
        : "Item rejected from import." 
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

  const handleBulkReject = () => {
    bulkUpdateMutation.mutate({
      itemIds: Array.from(selectedIds),
      updates: { status: "rejected" },
    });
  };

  const visiblePendingItems = useMemo(() => {
    const base = showExcluded ? items : items.filter((i) => i.status !== "excluded");
    return base.filter((i) => i.status === "pending" || i.status === "needs_review");
  }, [items, showExcluded]);

  // Calculate pending items from grouped data for accurate count
  const pendingItemsFromGrouped = useMemo(() => {
    if (!groupedData?.lineItems) return [];
    const pendingLineItems = groupedData.lineItems.filter(
      (li) => li.status === "pending" || li.status === "needs_review" || li.status === "mixed"
    );
    // Flatten to get all individual pending item IDs
    return pendingLineItems.flatMap((li) => 
      li.monthlyData.filter((m) => m.status === "pending" || m.status === "needs_review").map((m) => m.id)
    );
  }, [groupedData?.lineItems]);

  const confirmablePendingItems = useMemo(() => {
    if (!groupedData?.lineItems) return [];
    const validIds: string[] = [];
    for (const li of groupedData.lineItems) {
      if (li.status === "confirmed" || li.status === "excluded" || li.status === "rejected") continue;
      const firstItem = li.monthlyData[0];
      if (!firstItem) continue;
      const tier = (firstItem.categoryTierConfirmed || firstItem.categoryTierSuggested) as CategoryTier | null;
      if (!tier) continue;
      const dept = tier === "expense"
        ? (firstItem.expenseDeptConfirmed || firstItem.expenseDeptSuggested)
        : (firstItem.revenueCogsDeptConfirmed || firstItem.revenueCogsDeptSuggested);
      if (!dept) continue;
      for (const m of li.monthlyData) {
        if (m.status === "pending" || m.status === "needs_review") {
          validIds.push(m.id);
        }
      }
    }
    return validIds;
  }, [groupedData?.lineItems]);

  const skippedPendingCount = useMemo(() => {
    return pendingItemsFromGrouped.length - confirmablePendingItems.length;
  }, [pendingItemsFromGrouped, confirmablePendingItems]);

  const handleConfirmAllPending = () => {
    if (confirmablePendingItems.length === 0) {
      toast({
        title: "Cannot Confirm",
        description: "All pending items need both a Category and Department set before confirming.",
        variant: "destructive",
      });
      return;
    }
    bulkUpdateMutation.mutate({
      itemIds: confirmablePendingItems,
      updates: { status: "confirmed" },
      silent: true,
    });
    if (skippedPendingCount > 0) {
      toast({
        title: "Partial Confirm",
        description: `${confirmablePendingItems.length} items confirmed. ${skippedPendingCount} items skipped (missing Category or Department).`,
      });
    }
  };

  const handleRejectAllPending = () => {
    if (visiblePendingItems.length === 0) return;
    bulkUpdateMutation.mutate({
      itemIds: visiblePendingItems.map((i) => i.id),
      updates: { status: "rejected" },
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
              className="cursor-pointer hover:bg-muted/50 px-2 py-1 rounded text-sm max-w-[300px] flex items-center gap-2"
              onClick={() => setEditingCell({ id: item.id, field: "rawText" })}
              title={value}
            >
              <span className="truncate">{value}</span>
              {(item.autoConfirmed || item.learningRuleApplied) && (
                <AutoConfirmedBadge item={item} variant="compact" />
              )}
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
              className="cursor-pointer hover:bg-muted/50 px-2 py-1 rounded text-sm text-right tabular-nums"
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

          const deptOptions = getFilteredDeptOptionsForTier(currentTier, enabledRevCogsDepts);
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
                      onClick={() => openRejectDialog(item)}
                      disabled={updateItemMutation.isPending || item.status === "rejected"}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Reject</TooltipContent>
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

  // Filter + sort lineItems — must be before any early returns
  const filteredLineItems = useMemo(() => {
    if (!groupedData?.lineItems) return [];
    let list = statusFilter === 'all'
      ? groupedData.lineItems
      : groupedData.lineItems.filter((lineItem) => {
          if (statusFilter === 'pending') return lineItem.status === 'pending' || lineItem.status === 'needs_review';
          return lineItem.status === statusFilter;
        });

    if (groupedSortField) {
      const dir = groupedSortDir === 'asc' ? 1 : -1;
      list = [...list].sort((a, b) => {
        if (groupedSortField === 'lineItemName') {
          return dir * a.lineItemName.localeCompare(b.lineItemName);
        }
        if (groupedSortField === 'totalAmount') {
          return dir * ((a.totalAmount ?? 0) - (b.totalAmount ?? 0));
        }
        if (groupedSortField === 'status') {
          return dir * a.status.localeCompare(b.status);
        }
        return 0;
      });
    }
    return list;
  }, [groupedData?.lineItems, statusFilter, groupedSortField, groupedSortDir]);

  // Derived: group filteredLineItems into entity sections (TOTALS as parent, entities as children)
  const hasEntityGrouping = (filteredLineItems.length > 0 && filteredLineItems.some(li => li.entityName && li.entityName !== 'TOTALS'));
  const entityGroups = useMemo<EntityGroup[]>(() => {
    // Always return groups — single passthrough group when no entity data
    if (!hasEntityGrouping) {
      return [{ entityName: '', isTotal: false, rows: filteredLineItems }];
    }
    const groupMap = new Map<string, GroupedLineItem[]>();
    // TOTALS rows first
    for (const li of filteredLineItems) {
      if (li.isTotal || !li.entityName) {
        if (!groupMap.has('__TOTALS__')) groupMap.set('__TOTALS__', []);
        groupMap.get('__TOTALS__')!.push(li);
      } else {
        if (!groupMap.has(li.entityName)) groupMap.set(li.entityName, []);
        groupMap.get(li.entityName)!.push(li);
      }
    }
    const result: EntityGroup[] = [];
    const totals = groupMap.get('__TOTALS__');
    if (totals) result.push({ entityName: 'TOTALS', isTotal: true, rows: totals });
    for (const [name, rows] of groupMap.entries()) {
      if (name !== '__TOTALS__') result.push({ entityName: name, isTotal: false, rows });
    }
    return result;
  }, [filteredLineItems, hasEntityGrouping]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const confirmedCount = items.filter((i) => i.status === "confirmed").length;
  const rejectedCount = items.filter((i) => i.status === "rejected").length;
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
            <Badge variant="outline" className="bg-red-50">
              {rejectedCount} rejected
            </Badge>
            {excludedCount > 0 && (
              <Badge variant="outline" className="bg-gray-50">
                {excludedCount} excluded
              </Badge>
            )}
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
          <Separator orientation="vertical" className="h-6" />
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleConfirmAllPending}
                  disabled={bulkUpdateMutation.isPending || confirmablePendingItems.length === 0}
                  className="text-green-600 hover:text-green-700 border-green-200 hover:border-green-300 hover:bg-green-50"
                >
                  {bulkUpdateMutation.isPending && bulkOpLabel.startsWith("Confirming") ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4 mr-1" />
                  )}
                  Confirm All ({confirmablePendingItems.length})
                  {skippedPendingCount > 0 && (
                    <span className="ml-1 text-amber-600">({skippedPendingCount} need classification)</span>
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {skippedPendingCount > 0
                  ? `${skippedPendingCount} items missing Category or Department will be skipped`
                  : "Confirm all pending items that have Category and Department set"}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <Button
            size="sm"
            variant="outline"
            onClick={handleRejectAllPending}
            disabled={bulkUpdateMutation.isPending || visiblePendingItems.length === 0}
            className="text-red-600 hover:text-red-700 border-red-200 hover:border-red-300 hover:bg-red-50"
          >
            {bulkUpdateMutation.isPending && bulkOpLabel.startsWith("Rejecting") ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <X className="h-4 w-4 mr-1" />
            )}
            Reject All ({visiblePendingItems.length})
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
                enabledRevCogsDepts={enabledRevCogsDepts}
              />
              <Button
                size="sm"
                variant="outline"
                onClick={handleBulkConfirm}
                disabled={bulkUpdateMutation.isPending}
              >
                {bulkUpdateMutation.isPending && bulkOpLabel.startsWith("Confirming") ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <Check className="h-4 w-4 mr-1" />
                )}
                Confirm
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleBulkReject}
                disabled={bulkUpdateMutation.isPending}
              >
                {bulkUpdateMutation.isPending && bulkOpLabel.startsWith("Rejecting") ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <X className="h-4 w-4 mr-1" />
                )}
                Reject
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="border rounded-lg overflow-hidden relative">
        {bulkUpdateMutation.isPending && (
          <div className="absolute inset-0 z-20 bg-background/60 backdrop-blur-[2px] flex flex-col items-center justify-center gap-3 transition-opacity duration-200">
            <div className="relative">
              <div className="h-10 w-10 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
            </div>
            <p className="text-sm font-medium text-foreground animate-pulse">
              {bulkOpLabel || "Processing…"}
            </p>
          </div>
        )}
        {isLoadingGrouped ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : groupedError ? (
          <div className="flex flex-col items-center justify-center h-48 gap-2">
            <AlertCircle className="h-8 w-8 text-red-500" />
            <p className="text-red-600">Error loading grouped data</p>
            <p className="text-sm text-muted-foreground">{String(groupedError)}</p>
          </div>
        ) : !groupedData || !groupedData.lineItems ? (
          <div className="flex flex-col items-center justify-center h-48 gap-2">
            <p className="text-muted-foreground">No data available.</p>
            <p className="text-xs text-muted-foreground">
              groupedData: {JSON.stringify(groupedData)}
            </p>
          </div>
        ) : (
          <>
            {/* Bulk Action Bar - sticky inline below toolbar */}
            {selectedRowKeys.size > 0 && (
              <div className="sticky top-0 z-30 bg-primary text-primary-foreground px-3 py-2 flex items-center justify-between gap-4 shadow-md rounded-t-lg">
                <div className="flex items-center gap-3">
                  <span className="font-medium">{selectedRowKeys.size} row{selectedRowKeys.size !== 1 ? 's' : ''} selected</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-primary-foreground hover:bg-primary-foreground/20 h-7 px-2"
                    onClick={() => setSelectedRowKeys(new Set())}
                  >
                    <X className="h-4 w-4 mr-1" />
                    Clear
                  </Button>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">Category:</span>
                    <Select
                      onValueChange={(tier) => {
                        const allItemIds: string[] = [];
                        selectedRowKeys.forEach(key => {
                          const lineItem = groupedData.lineItems.find(li => `${li.lineItemName}__${li.sourceRow}` === key);
                          if (lineItem) {
                            lineItem.monthlyData.forEach(m => allItemIds.push(m.id));
                          }
                        });
                        if (allItemIds.length > 0) {
                          bulkUpdateMutation.mutate({
                            itemIds: allItemIds,
                            updates: {
                              categoryTierConfirmed: tier as CategoryTier,
                              revenueCogsDeptConfirmed: null,
                              expenseDeptConfirmed: null,
                            },
                          });
                        }
                      }}
                    >
                      <SelectTrigger className="w-[120px] h-8 bg-primary-foreground text-primary">
                        <SelectValue placeholder="Set category" />
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORY_TIER_OPTIONS.map(opt => (
                          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm">Department:</span>
                    {(() => {
                      // Check if all selected rows have same tier
                      const tiers = new Set<CategoryTier>();
                      selectedRowKeys.forEach(key => {
                        const lineItem = groupedData.lineItems.find(li => `${li.lineItemName}__${li.sourceRow}` === key);
                        if (lineItem?.monthlyData[0]) {
                          const tier = (lineItem.monthlyData[0].categoryTierConfirmed || lineItem.monthlyData[0].categoryTierSuggested) as CategoryTier | null;
                          if (tier) tiers.add(tier);
                        }
                      });
                      const hasMixedTiers = tiers.size > 1;
                      const commonTier = tiers.size === 1 ? Array.from(tiers)[0] : null;
                      
                      if (hasMixedTiers) {
                        return (
                          <span className="text-xs text-primary-foreground/70 italic">
                            Mixed categories - set individually
                          </span>
                        );
                      }
                      
                      return (
                        <Select
                          onValueChange={(dept) => {
                            if (!commonTier) return;
                            const allItemIds: string[] = [];
                            selectedRowKeys.forEach(key => {
                              const lineItem = groupedData.lineItems.find(li => `${li.lineItemName}__${li.sourceRow}` === key);
                              if (lineItem) {
                                lineItem.monthlyData.forEach(m => allItemIds.push(m.id));
                              }
                            });
                            if (allItemIds.length > 0) {
                              const updates = commonTier === 'expense'
                                ? { expenseDeptConfirmed: dept }
                                : { revenueCogsDeptConfirmed: dept };
                              bulkUpdateMutation.mutate({ itemIds: allItemIds, updates });
                            }
                          }}
                          disabled={!commonTier}
                        >
                          <SelectTrigger className="w-[130px] h-8 bg-primary-foreground text-primary">
                            <SelectValue placeholder={commonTier ? "Set department" : "Set category first"} />
                          </SelectTrigger>
                          <SelectContent>
                            {getFilteredDeptOptionsForTier(commonTier, enabledRevCogsDepts).map(opt => (
                              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      );
                    })()}
                  </div>
                  {(() => {
                    const confirmableIds: string[] = [];
                    const allIds: string[] = [];
                    selectedRowKeys.forEach(key => {
                      const li = groupedData.lineItems.find(li => `${li.lineItemName}__${li.sourceRow}` === key);
                      if (li) {
                        const first = li.monthlyData[0];
                        const tier = first ? (first.categoryTierConfirmed || first.categoryTierSuggested) as CategoryTier | null : null;
                        const dept = tier === "expense"
                          ? (first?.expenseDeptConfirmed || first?.expenseDeptSuggested)
                          : (first?.revenueCogsDeptConfirmed || first?.revenueCogsDeptSuggested);
                        const valid = !!tier && !!dept;
                        li.monthlyData.forEach(m => {
                          allIds.push(m.id);
                          if (valid) confirmableIds.push(m.id);
                        });
                      }
                    });
                    const unclassifiedCount = allIds.length - confirmableIds.length;
                    return (
                      <>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span>
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  className="h-8"
                                  disabled={confirmableIds.length === 0}
                                  onClick={() => {
                                    if (confirmableIds.length > 0) {
                                      bulkUpdateMutation.mutate({ itemIds: confirmableIds, updates: { status: 'confirmed' } });
                                      setSelectedRowKeys(new Set());
                                    }
                                  }}
                                >
                                  <Check className="h-4 w-4 mr-1" />
                                  Confirm Selected
                                </Button>
                              </span>
                            </TooltipTrigger>
                            {unclassifiedCount > 0 && (
                              <TooltipContent>
                                {confirmableIds.length === 0
                                  ? "All selected items need a Category and Department before confirming"
                                  : `${unclassifiedCount} item(s) missing Category/Department will be skipped`}
                              </TooltipContent>
                            )}
                          </Tooltip>
                        </TooltipProvider>
                        <Button
                          variant="secondary"
                          size="sm"
                          className="h-8 text-red-100 bg-red-600/80 hover:bg-red-600"
                          onClick={() => {
                            if (allIds.length > 0) {
                              bulkUpdateMutation.mutate({ itemIds: allIds, updates: { status: 'rejected' } });
                              setSelectedRowKeys(new Set());
                            }
                          }}
                        >
                          <X className="h-4 w-4 mr-1" />
                          Reject Selected
                        </Button>
                      </>
                    );
                  })()}
                </div>
              </div>
            )}
            <div className="overflow-x-auto">
              <Table className="w-full table-fixed">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8 bg-muted/50 sticky left-0 z-20">
                      <Checkbox
                        checked={selectedRowKeys.size > 0 && selectedRowKeys.size === filteredLineItems.length}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            const allKeys = new Set(filteredLineItems.map(li => `${li.lineItemName}__${li.sourceRow}`));
                            setSelectedRowKeys(allKeys);
                          } else {
                            setSelectedRowKeys(new Set());
                          }
                        }}
                        aria-label="Select all rows"
                      />
                    </TableHead>
                    <TableHead className="bg-muted/50 sticky left-8 z-20 w-[160px]">
                      <SortableHead label="Line Item" field="lineItemName" activeField={groupedSortField} dir={groupedSortDir} onToggle={toggleGroupedSort} />
                    </TableHead>
                    <TableHead className="bg-muted/50 w-[130px] px-1">Category</TableHead>
                    <TableHead className="bg-muted/50 w-[140px] px-1">Department</TableHead>
                    {groupedData.isMultiColumn ? (
                      groupedData.periods.map((period) => (
                        <TableHead key={period} className="bg-muted/50 text-center w-[70px] px-1 text-xs">
                          {formatPeriodLabel(period)}
                        </TableHead>
                      ))
                    ) : (
                      <TableHead className="bg-muted/50 text-right w-[80px]">
                        <SortableHead label="Amount" field="totalAmount" activeField={groupedSortField} dir={groupedSortDir} onToggle={toggleGroupedSort} className="justify-end" />
                      </TableHead>
                    )}
                    {groupedData.isMultiColumn && (
                      <TableHead className="bg-muted/50 text-right w-[75px] sticky right-[140px] z-20 px-1">
                        <SortableHead label="Total" field="totalAmount" activeField={groupedSortField} dir={groupedSortDir} onToggle={toggleGroupedSort} className="justify-end" />
                      </TableHead>
                    )}
                    <TableHead className="bg-muted/50 text-center w-[70px] sticky right-[70px] z-20 px-1">
                      <SortableHead label="Status" field="status" activeField={groupedSortField} dir={groupedSortDir} onToggle={toggleGroupedSort} className="justify-center" />
                    </TableHead>
                    <TableHead className="bg-muted/50 text-center w-[70px] sticky right-0 z-20 px-1">Actions</TableHead>
                  </TableRow>
                </TableHeader>
              <TableBody>
                {filteredLineItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={groupedData.isMultiColumn ? groupedData.periods.length + 7 : 7} className="h-24 text-center">
                      {statusFilter !== 'all' ? 'No items match the selected filter.' : 'No line items found.'}
                    </TableCell>
                  </TableRow>
                ) : (
                  // ── Entity-grouped view (always) — header shown only when multiple groups ──
                  entityGroups.map((group) => {
                    const entityKey = group.entityName;
                    const isEntityExpanded = expandedEntities.has(entityKey);
                    const colSpan = groupedData.isMultiColumn ? groupedData.periods.length + 7 : 7;
                    const confirmedInGroup = group.rows.filter(r => r.status === 'confirmed').length;
                    const pendingInGroup = group.rows.filter(r => r.status === 'pending' || r.status === 'needs_review').length;
                    return (
                      <Fragment key={entityKey}>
                        {/* Entity section header row — only when multiple groups exist */}
                        {entityGroups.length > 1 && <TableRow
                          className="bg-muted/60 hover:bg-muted/80 cursor-pointer select-none border-t-2 border-border"
                          onClick={() => toggleEntityExpanded(entityKey)}
                        >
                          <TableCell colSpan={colSpan} className="py-2 px-4">
                            <div className="flex items-center gap-3">
                              {isEntityExpanded
                                ? <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                : <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />}
                              <span className="font-semibold text-sm">
                                {group.isTotal ? '∑ TOTALS' : group.entityName}
                              </span>
                              {group.isTotal && (
                                <span className="text-xs text-muted-foreground font-normal">combined across all entities</span>
                              )}
                              <div className="flex items-center gap-1.5 ml-auto">
                                <span className="text-xs text-muted-foreground">{group.rows.length} line items</span>
                                {pendingInGroup > 0 && (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded-sm text-[10px] font-medium bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400">
                                    {pendingInGroup} pending
                                  </span>
                                )}
                                {confirmedInGroup > 0 && (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded-sm text-[10px] font-medium bg-green-100 text-green-700 dark:bg-green-950/50 dark:text-green-400">
                                    {confirmedInGroup} confirmed
                                  </span>
                                )}
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>}
                        {/* Line item rows — always shown when single group, collapsible otherwise */}
                        {(entityGroups.length === 1 || isEntityExpanded) && group.rows.map((lineItem) => {
                          const rowKey = `${lineItem.lineItemName}__${lineItem.sourceRow}`;
                          const isExpanded = expandedRows.has(rowKey);
                    
                    return (
                      <Fragment key={rowKey}>
                        <TableRow
                          className={
                            lineItem.status === "excluded"
                              ? "opacity-50 bg-muted/30"
                              : lineItem.status === "rejected"
                              ? "opacity-60 bg-red-50/30 dark:bg-red-950/20"
                              : lineItem.status === "confirmed"
                              ? "bg-green-50/30 dark:bg-green-950/20"
                              : (() => {
                                  const first = lineItem.monthlyData[0];
                                  if (!first) return "";
                                  const oTier = optimisticCategories[rowKey];
                                  const sTier = (first.categoryTierConfirmed || first.categoryTierSuggested) as CategoryTier | null;
                                  const tier = oTier || sTier;
                                  const oDept = optimisticDepartments[rowKey];
                                  const sDept = tier === "expense"
                                    ? (first.expenseDeptConfirmed || first.expenseDeptSuggested)
                                    : (first.revenueCogsDeptConfirmed || first.revenueCogsDeptSuggested);
                                  const dept = oDept || sDept;
                                  if (!tier || !dept) return "bg-amber-50/40 dark:bg-amber-950/20 border-l-2 border-l-amber-400";
                                  return "";
                                })()
                          }
                        >
                          <TableCell className="p-2 sticky left-0 z-10 bg-background">
                            <div className="flex items-center gap-1">
                              <Checkbox
                                checked={selectedRowKeys.has(rowKey)}
                                onCheckedChange={(checked) => {
                                  setSelectedRowKeys(prev => {
                                    const next = new Set(prev);
                                    if (checked) {
                                      next.add(rowKey);
                                    } else {
                                      next.delete(rowKey);
                                    }
                                    return next;
                                  });
                                }}
                                aria-label={`Select ${lineItem.lineItemName}`}
                              />
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
                            </div>
                          </TableCell>
                          <TableCell className="font-medium sticky left-8 z-10 bg-background w-[160px] px-1">
                            <span className="truncate block max-w-[150px] text-sm" title={lineItem.lineItemName}>
                              {lineItem.lineItemName}
                            </span>
                          </TableCell>
                          <TableCell className="px-1">
                            {(() => {
                              const firstItem = lineItem.monthlyData[0];
                              if (!firstItem) return "-";
                              // Use optimistic state if available, otherwise fall back to server data
                              const optimisticTier = optimisticCategories[rowKey];
                              const serverTier = (firstItem.categoryTierConfirmed || firstItem.categoryTierSuggested) as CategoryTier | null;
                              const currentTier = optimisticTier || serverTier;
                              return (
                                <Select
                                  value={currentTier || ""}
                                  onValueChange={(v) => {
                                    const newTier = v as CategoryTier;
                                    // Optimistic update - immediately show the selected value
                                    setOptimisticCategories(prev => ({ ...prev, [rowKey]: newTier }));
                                    // Clear department when category changes
                                    setOptimisticDepartments(prev => {
                                      const next = { ...prev };
                                      delete next[rowKey];
                                      return next;
                                    });
                                    const itemIds = lineItem.monthlyData.map((m) => m.id);
                                    bulkUpdateMutation.mutate({
                                      itemIds,
                                      updates: { 
                                        categoryTierConfirmed: newTier,
                                        revenueCogsDeptConfirmed: null,
                                        expenseDeptConfirmed: null,
                                      },
                                      lineItemKey: rowKey,
                                      silent: true,
                                    });
                                  }}
                                >
                                  <SelectTrigger className={`h-7 w-[90px] text-xs ${!currentTier && lineItem.status === 'pending' ? 'border-amber-400 bg-amber-50/50 dark:bg-amber-950/30' : ''}`}>
                                    <SelectValue placeholder="Select...">
                                      {currentTier ? CATEGORY_TIER_LABELS[currentTier] : (
                                        <span className="text-amber-600 dark:text-amber-400 flex items-center gap-0.5">
                                          <AlertCircle className="h-3 w-3" />
                                          Required
                                        </span>
                                      )}
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
                            })()}
                          </TableCell>
                          <TableCell className="px-1">
                            {(() => {
                              const firstItem = lineItem.monthlyData[0];
                              if (!firstItem) return "-";
                              // Use optimistic state for category
                              const optimisticTier = optimisticCategories[rowKey];
                              const serverTier = (firstItem.categoryTierConfirmed || firstItem.categoryTierSuggested) as CategoryTier | null;
                              const currentTier = optimisticTier || serverTier;
                              if (!currentTier) return (
                                <span className="text-xs text-amber-500 flex items-center gap-0.5">
                                  <AlertCircle className="h-3 w-3" />
                                  Set category first
                                </span>
                              );
                              const deptOptions = getFilteredDeptOptionsForTier(currentTier, enabledRevCogsDepts);
                              const optimisticDept = optimisticDepartments[rowKey];
                              const serverDept = currentTier === "expense"
                                ? (firstItem.expenseDeptConfirmed || firstItem.expenseDeptSuggested)
                                : (firstItem.revenueCogsDeptConfirmed || firstItem.revenueCogsDeptSuggested);
                              const currentDept = optimisticDept || serverDept;
                              return (
                                <Select
                                  value={currentDept || ""}
                                  onValueChange={(v) => {
                                    setOptimisticDepartments(prev => ({ ...prev, [rowKey]: v }));
                                    const itemIds = lineItem.monthlyData.map((m) => m.id);
                                    const updates = currentTier === "expense"
                                      ? { expenseDeptConfirmed: v }
                                      : { revenueCogsDeptConfirmed: v };
                                    bulkUpdateMutation.mutate({
                                      itemIds,
                                      updates,
                                      lineItemKey: rowKey,
                                      silent: true,
                                    });
                                  }}
                                >
                                  <SelectTrigger className={`h-7 w-[100px] text-xs ${!currentDept && lineItem.status === 'pending' ? 'border-amber-400 bg-amber-50/50 dark:bg-amber-950/30' : ''}`}>
                                    <SelectValue placeholder="Select...">
                                      {currentDept ? getDeptLabel(currentTier, currentDept) : (
                                        <span className="text-amber-600 dark:text-amber-400 flex items-center gap-0.5">
                                          <AlertCircle className="h-3 w-3" />
                                          Required
                                        </span>
                                      )}
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
                            })()}
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
                                  className={`text-center text-sm tabular-nums ${statusColor} ${!isEditingThisCell ? 'cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-950/30' : ''}`}
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
                                  className={`text-right tabular-nums ${statusColor} ${!isEditingThisCell ? 'cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-950/30' : ''}`}
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
                            <TableCell className="text-right font-semibold sticky right-[140px] z-10 bg-background px-1 text-sm">
                              {formatCurrency(lineItem.totalAmount)}
                            </TableCell>
                          )}
                          <TableCell className="text-center sticky right-[70px] z-10 bg-background px-1">
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
                              className={`text-xs px-1.5 py-0.5 ${
                                lineItem.status === "confirmed"
                                  ? "bg-green-100 text-green-800"
                                  : lineItem.status === "pending"
                                  ? "bg-yellow-100 text-yellow-800"
                                  : ""
                              }`}
                            >
                              {lineItem.status === "confirmed" ? "✓" : lineItem.status === "pending" ? "..." : lineItem.status.charAt(0).toUpperCase()}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center sticky right-0 z-10 bg-background px-1">
                            <div className="flex items-center justify-center gap-0.5">
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 w-6 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                                        onClick={() => {
                                          const itemIds = lineItem.monthlyData.map((m) => m.id);
                                          bulkUpdateMutation.mutate({
                                            itemIds,
                                            updates: { status: "confirmed" },
                                            silent: true,
                                          });
                                        }}
                                        disabled={bulkUpdateMutation.isPending || lineItem.status === "confirmed" || (() => {
                                          const first = lineItem.monthlyData[0];
                                          if (!first) return true;
                                          const tier = (first.categoryTierConfirmed || first.categoryTierSuggested) as CategoryTier | null;
                                          if (!tier) return true;
                                          const dept = tier === "expense"
                                            ? (first.expenseDeptConfirmed || first.expenseDeptSuggested)
                                            : (first.revenueCogsDeptConfirmed || first.revenueCogsDeptSuggested);
                                          return !dept;
                                        })()}
                                      >
                                        <Check className="h-3.5 w-3.5" />
                                      </Button>
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    {(() => {
                                      const first = lineItem.monthlyData[0];
                                      const tier = first ? (first.categoryTierConfirmed || first.categoryTierSuggested) as CategoryTier | null : null;
                                      const dept = tier === "expense"
                                        ? (first?.expenseDeptConfirmed || first?.expenseDeptSuggested)
                                        : (first?.revenueCogsDeptConfirmed || first?.revenueCogsDeptSuggested);
                                      if (!tier || !dept) return "Set Category and Department first";
                                      return "Confirm all months";
                                    })()}
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 w-6 p-0 text-red-500 hover:text-red-600 hover:bg-red-50"
                                      onClick={() => {
                                        const itemIds = lineItem.monthlyData.map((m) => m.id);
                                        bulkUpdateMutation.mutate({
                                          itemIds,
                                          updates: { status: "rejected" },
                                          silent: true,
                                        });
                                      }}
                                      disabled={bulkUpdateMutation.isPending || lineItem.status === "rejected"}
                                    >
                                      <X className="h-3.5 w-3.5" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Reject all months</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </div>
                          </TableCell>
                        </TableRow>
                        {isExpanded && (
                          <TableRow className="bg-muted/20">
                            <TableCell colSpan={groupedData.isMultiColumn ? groupedData.periods.length + 7 : 7} className="p-4">
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
                                    <div className="flex items-center justify-between mt-2">
                                      <Badge
                                        variant="outline"
                                        className={`text-xs ${
                                          month.status === "confirmed"
                                            ? "border-green-500 text-green-700"
                                            : month.status === "excluded"
                                            ? "border-gray-400 text-gray-500"
                                            : "border-yellow-500 text-yellow-700"
                                        }`}
                                      >
                                        {month.status}
                                      </Badge>
                                      <div className="flex gap-1">
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="h-6 w-6 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                                          title={(() => {
                                            const tier = (month.categoryTierConfirmed || month.categoryTierSuggested) as CategoryTier | null;
                                            const dept = tier === "expense"
                                              ? (month.expenseDeptConfirmed || month.expenseDeptSuggested)
                                              : (month.revenueCogsDeptConfirmed || month.revenueCogsDeptSuggested);
                                            if (!tier || !dept) return "Set Category and Department first";
                                            return "Confirm";
                                          })()}
                                          onClick={() => {
                                            bulkUpdateMutation.mutate({
                                              itemIds: [month.id],
                                              updates: { status: "confirmed" },
                                              silent: true,
                                            });
                                          }}
                                          disabled={bulkUpdateMutation.isPending || month.status === "confirmed" || (() => {
                                            const tier = (month.categoryTierConfirmed || month.categoryTierSuggested) as CategoryTier | null;
                                            if (!tier) return true;
                                            const dept = tier === "expense"
                                              ? (month.expenseDeptConfirmed || month.expenseDeptSuggested)
                                              : (month.revenueCogsDeptConfirmed || month.revenueCogsDeptSuggested);
                                            return !dept;
                                          })()}
                                        >
                                          <Check className="h-3.5 w-3.5" />
                                        </Button>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="h-6 w-6 p-0 text-red-500 hover:text-red-600 hover:bg-red-50"
                                          onClick={() => {
                                            bulkUpdateMutation.mutate({
                                              itemIds: [month.id],
                                              updates: { status: "rejected" },
                                              silent: true,
                                            });
                                          }}
                                          disabled={bulkUpdateMutation.isPending || month.status === "rejected"}
                                        >
                                          <X className="h-3.5 w-3.5" />
                                        </Button>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </Fragment>
                    );
                  })}
                      </Fragment>
                    );
                  })}
              </TableBody>
              </Table>
            </div>
          </>
        )}
      </div>

      <Dialog open={excludeDialog.open} onOpenChange={(open) => !open && setExcludeDialog({ open: false, item: null, reason: "" })}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reject Line Item</DialogTitle>
            <DialogDescription>
              Why are you rejecting this item? This helps train the AI to recognize similar items in the future.
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
              <Label htmlFor="reject-reason">Reason (optional)</Label>
              <Textarea
                id="reject-reason"
                placeholder="e.g., This is a subtotal row, not an actual expense"
                value={excludeDialog.reason}
                onChange={(e) => setExcludeDialog((prev) => ({ ...prev, reason: e.target.value }))}
                rows={3}
              />
              <p className="text-xs text-muted-foreground">
                Adding a reason helps the AI learn to automatically reject similar items.
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
              onClick={confirmReject}
              disabled={updateItemMutation.isPending}
            >
              {updateItemMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Reject Item
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}