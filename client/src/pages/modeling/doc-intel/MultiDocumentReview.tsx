import React, { useState, useEffect, useMemo, useRef } from "react";
import { useQueries, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { 
  ArrowLeft, 
  FileSpreadsheet, 
  Brain, 
  Check, 
  X, 
  Zap, 
  CheckCircle2, 
  AlertTriangle,
  ChevronDown, 
  ChevronRight, 
  ChevronLeft,
  Search, 
  Clock, 
  XCircle, 
  Loader2,
  Download,
  FileText,
  LayoutGrid,
  List,
  Table2,
  StopCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { PLReviewGrid } from "@/components/doc-intel/PLReviewGrid";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { DocIntelUpload, DocIntelExtractedItem, PnlCategory } from "@shared/schema";

interface ExtractedItemWithCategory extends DocIntelExtractedItem {
  suggestedCategory?: PnlCategory;
  confirmedCategory?: PnlCategory;
}

interface MultiDocumentReviewProps {
  projectId: string;
  uploads: DocIntelUpload[];
  categories: PnlCategory[];
  onClose: () => void;
  onComplete: () => void;
  onTabChange?: (tab: string) => void;
}

interface DocumentItemsState {
  [uploadId: string]: ExtractedItemWithCategory[];
}

const DEPARTMENTS = [
  { value: "marina_ops", label: "Marina Operations" },
  { value: "fuel_dock", label: "Fuel Dock" },
  { value: "ship_store", label: "Ship Store" },
  { value: "restaurant", label: "Restaurant" },
  { value: "boat_sales", label: "Boat Sales" },
  { value: "service_dept", label: "Service Department" },
  { value: "storage", label: "Storage" },
  { value: "admin", label: "Administration" },
  { value: "other", label: "Other" },
];

function sanitizeDisplayText(text: string | null): string {
  if (!text) return '(no description)';
  const printableRatio = (text.match(/[a-zA-Z0-9\s.,\-$%()/]/g) || []).length / Math.max(text.length, 1);
  if (printableRatio < 0.5 && text.length > 10) {
    return text.replace(/[^a-zA-Z0-9\s.,\-$%()/&'":;]/g, '').trim() || '(garbled text)';
  }
  return text.replace(/[\u0000-\u001F\u007F-\u009F]/g, '').trim();
}

// Error Boundary component for category dropdown (Requirement H)
class CategorySelectErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode; fallback: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Category Select Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

export function MultiDocumentReview({ 
  projectId, 
  uploads, 
  categories, 
  onClose, 
  onComplete,
  onTabChange 
}: MultiDocumentReviewProps) {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [activeDocumentId, setActiveDocumentId] = useState(uploads[0]?.id || "");
  const [documentItems, setDocumentItems] = useState<DocumentItemsState>({});
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'confirmed' | 'rejected'>('all');
  const [searchText, setSearchText] = useState("");
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [isApplying, setIsApplying] = useState(false);
  const [viewMode, setViewMode] = useState<'matrix' | 'list'>('matrix');

  // NEW: Confirm All state (Requirement G)
  const [isConfirmingAll, setIsConfirmingAll] = useState(false);
  const [confirmProgress, setConfirmProgress] = useState({ current: 0, total: 0, skipped: 0 });
  const abortControllerRef = useRef<AbortController | null>(null);

  // Fetch items for each document using useQueries (Requirement F - ensures all docs are fetched)
  const itemQueries = useQueries({
    queries: uploads.map(upload => ({
      queryKey: ["/api/modeling/projects", projectId, "documents", upload.id, "items"] as const,
      enabled: !!upload.id,
      refetchInterval: 3000,
    })),
  });

  // Build reactive document items from query data
  const queryDataMap = useMemo(() => {
    const map: DocumentItemsState = {};
    uploads.forEach((upload, index) => {
      const query = itemQueries[index];
      if (query.data) {
        map[upload.id] = query.data;
      }
    });
    return map;
  }, [uploads, itemQueries]);

  // Update local state for components that need it
  useEffect(() => {
    setDocumentItems(queryDataMap);
  }, [queryDataMap]);

  // Calculate totals across all documents
  const allItems = useMemo(() => {
    return Object.values(queryDataMap).flat();
  }, [queryDataMap]);

  const totalPending = allItems.filter(i => i.status === "pending").length;
  const totalConfirmed = allItems.filter(i => i.status === "confirmed").length;
  const totalRejected = allItems.filter(i => i.status === "rejected").length;
  const totalItems = allItems.length;

  // Check if all items are processed (no pending items)
  const allItemsProcessed = totalPending === 0 && totalItems > 0;

  // Check if ALL non-excluded items are fully classified with both category AND department (Requirement I)
  const allItemsClassified = useMemo(() => {
    if (totalItems === 0) return false;
    // Only check items that are not excluded - excluded items don't need classification
    const nonExcludedItems = allItems.filter(item => item.status !== 'excluded');
    if (nonExcludedItems.length === 0) return false;
    return nonExcludedItems.every(item => {
      // Check category tier (using correct field names)
      const hasCategory = item.categoryTierConfirmed || item.categoryTierSuggested;
      if (!hasCategory) return false;
      
      // Check department based on category tier
      const tier = item.categoryTierConfirmed || item.categoryTierSuggested;
      if (tier === 'expense') {
        return !!(item.expenseDeptConfirmed || item.expenseDeptSuggested);
      } else {
        // Revenue or Cost of Goods
        return !!(item.revenueCogsDeptConfirmed || item.revenueCogsDeptSuggested);
      }
    });
  }, [allItems, totalItems]);

  // Apply button enabled only when ALL items classified AND at least one confirmed (Requirement I)
  const canApplyToModel = allItemsClassified && totalConfirmed > 0;

  // Current document items
  const currentItems = documentItems[activeDocumentId] || [];
  const currentUpload = uploads.find(u => u.id === activeDocumentId);

  const filteredItems = useMemo(() => {
    return currentItems.filter(item => {
      if (statusFilter !== 'all' && item.status !== statusFilter) return false;
      if (searchText.trim()) {
        const searchLower = searchText.toLowerCase();
        const matchesText = item.rawText?.toLowerCase().includes(searchLower);
        const matchesCategory = categories
          .find(c => c.id === (item.categoryConfirmed || item.categorySuggested))
          ?.name?.toLowerCase().includes(searchLower);
        if (!matchesText && !matchesCategory) return false;
      }
      return true;
    });
  }, [currentItems, statusFilter, searchText, categories]);

  // Mutations
  const confirmItemMutation = useMutation({
    mutationFn: async ({ uploadId, itemId, categoryId, amount, department }: { 
      uploadId: string; 
      itemId: string; 
      categoryId: string; 
      amount?: number; 
      department?: string 
    }) => {
      return apiRequest("POST", `/api/modeling/projects/${projectId}/documents/${uploadId}/items/${itemId}/confirm`, { 
        categoryId, 
        amount,
        department 
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ 
        queryKey: ["/api/modeling/projects", projectId, "documents", variables.uploadId, "items"] 
      });
    },
  });

  const rejectItemMutation = useMutation({
    mutationFn: async ({ uploadId, itemId }: { uploadId: string; itemId: string }) => {
      return apiRequest("POST", `/api/modeling/projects/${projectId}/documents/${uploadId}/items/${itemId}/reject`);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ 
        queryKey: ["/api/modeling/projects", projectId, "documents", variables.uploadId, "items"] 
      });
    },
  });

  const autoConfirmMutation = useMutation({
    mutationFn: async ({ uploadId, threshold }: { uploadId: string; threshold: number }) => {
      return apiRequest("POST", `/api/modeling/projects/${projectId}/documents/${uploadId}/items/confirm-high-confidence`, { threshold });
    },
    onSuccess: (data: { confirmed: number }, variables) => {
      queryClient.invalidateQueries({ 
        queryKey: ["/api/modeling/projects", projectId, "documents", variables.uploadId, "items"] 
      });
      toast({ title: "Auto-confirmed", description: `${data.confirmed} high-confidence items confirmed.` });
    },
  });

  // NEW: Mutation to persist category/department immediately (Requirement H)
  const updateItemMutation = useMutation({
    mutationFn: async ({ uploadId, itemId, categoryId, department }: { 
      uploadId: string; 
      itemId: string; 
      categoryId?: string; 
      department?: string 
    }) => {
      return apiRequest("PATCH", `/api/modeling/projects/${projectId}/documents/${uploadId}/items/${itemId}`, { 
        categoryId, 
        department 
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ 
        queryKey: ["/api/modeling/projects", projectId, "documents", variables.uploadId, "items"] 
      });
    },
    onError: (error) => {
      console.error('Failed to update item:', error);
      toast({ 
        title: "Update failed", 
        description: "Could not save category/department. Please try again.",
        variant: "destructive" 
      });
    },
  });

  const importMutation = useMutation({
    mutationFn: async (uploadId: string) => {
      return apiRequest("POST", `/api/modeling/projects/${projectId}/documents/${uploadId}/import`, { 
        fiscalYear: uploads.find(u => u.id === uploadId)?.year 
      });
    },
    onSuccess: (data: { imported: number }) => {
      return data;
    },
    onError: () => {
      toast({ title: "Import failed", description: "Could not import items.", variant: "destructive" });
    },
  });

  // Apply all documents to model - only writes CONFIRMED items (Requirement I)
  const handleApplyToModel = async () => {
    if (!canApplyToModel) return;

    setIsApplying(true);
    let totalImported = 0;
    let errors = 0;

    for (const upload of uploads) {
      const items = documentItems[upload.id] || [];
      // Only import CONFIRMED items (Requirement I)
      const confirmedCount = items.filter(i => i.status === "confirmed").length;

      if (confirmedCount > 0) {
        try {
          const result = await importMutation.mutateAsync(upload.id);
          totalImported += result.imported;
        } catch {
          errors++;
        }
      }
    }

    setIsApplying(false);

    if (errors === 0) {
      toast({ 
        title: "Applied to Model", 
        description: `${totalImported} confirmed line items imported from ${uploads.length} documents.` 
      });
      
      // Invalidate Historical tab caches so fresh data loads
      queryClient.invalidateQueries({ queryKey: ['/api/modeling/projects', projectId, 'historical-pl'] });
      // Invalidate all actuals queries for this project (includes year param variations)
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          const key = query.queryKey[0];
          return typeof key === 'string' && key.startsWith(`/api/modeling/projects/${projectId}/actuals`);
        }
      });
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          const key = query.queryKey[0];
          return typeof key === 'string' && key.startsWith(`/api/modeling/projects/${projectId}/data-sources`);
        }
      });
      
      // Navigate to Historical tab (Requirement I)
      if (onTabChange) {
        onTabChange('historical');
      } else {
        navigate(`/modeling/projects/${projectId}?tab=historical`);
      }
    } else {
      toast({ 
        title: "Partial Success", 
        description: `${totalImported} items imported. ${errors} document(s) had errors.`,
        variant: "destructive"
      });
    }
  };

  // NEW: Confirm All with cancellation, validation, and partial confirm (Requirement G)
  const handleConfirmAll = async () => {
    // Get all pending items across all documents
    const pendingItemsByDoc: { uploadId: string; item: ExtractedItemWithCategory }[] = [];

    for (const upload of uploads) {
      const items = queryDataMap[upload.id] || [];
      items
        .filter(i => i.status === "pending")
        .forEach(item => pendingItemsByDoc.push({ uploadId: upload.id, item }));
    }

    if (pendingItemsByDoc.length === 0) {
      toast({ title: "No pending items", description: "All items have already been reviewed." });
      return;
    }

    // Validate: items need both category AND department (Requirement G)
    const validItems = pendingItemsByDoc.filter(({ item }) => 
      (item.categoryConfirmed || item.categorySuggested) && 
      (item.departmentConfirmed || item.departmentSuggested)
    );
    const invalidItems = pendingItemsByDoc.filter(({ item }) => 
      !(item.categoryConfirmed || item.categorySuggested) || 
      !(item.departmentConfirmed || item.departmentSuggested)
    );

    if (validItems.length === 0) {
      toast({ 
        title: "Cannot confirm", 
        description: `${invalidItems.length} items are missing Category or Department. Please classify all items first.`,
        variant: "destructive"
      });
      return;
    }

    // Setup abort controller for cancellation
    abortControllerRef.current = new AbortController();
    setIsConfirmingAll(true);
    setConfirmProgress({ current: 0, total: validItems.length, skipped: invalidItems.length });

    let confirmed = 0;
    let errors = 0;

    for (const { uploadId, item } of validItems) {
      // Check if cancelled
      if (abortControllerRef.current.signal.aborted) {
        break;
      }

      try {
        await confirmItemMutation.mutateAsync({
          uploadId,
          itemId: item.id,
          categoryId: item.categoryConfirmed || item.categorySuggested!,
          department: item.departmentConfirmed || item.departmentSuggested || undefined,
        });
        confirmed++;
        setConfirmProgress(p => ({ ...p, current: confirmed }));
      } catch (e) {
        errors++;
        // Continue on error
      }
    }

    setIsConfirmingAll(false);
    abortControllerRef.current = null;

    // Show summary (Requirement G)
    const wasAborted = confirmed < validItems.length && errors === 0;
    toast({
      title: wasAborted ? "Confirm All Cancelled" : "Confirm All Complete",
      description: `Confirmed ${confirmed} items.${invalidItems.length > 0 ? ` ${invalidItems.length} items skipped (missing Category/Department).` : ''}${errors > 0 ? ` ${errors} errors.` : ''}`,
    });

    // Refresh all queries
    for (const upload of uploads) {
      queryClient.invalidateQueries({ 
        queryKey: ["/api/modeling/projects", projectId, "documents", upload.id, "items"] 
      });
    }
  };

  // Cancel Confirm All (Requirement G)
  const handleCancelConfirmAll = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  const handleAutoConfirmAll = async () => {
    for (const upload of uploads) {
      await autoConfirmMutation.mutateAsync({ uploadId: upload.id, threshold: 0.9 });
    }
  };

  const formatAmount = (amount: string | number | null) => {
    if (amount === null || amount === undefined) return "-";
    const num = typeof amount === "string" ? parseFloat(amount) : amount;
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(num);
  };

  const getConfidenceBadge = (score: string | null) => {
    if (!score) return <Badge variant="outline">No match</Badge>;
    const num = parseFloat(score);
    if (num >= 0.9) return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">High ({(num * 100).toFixed(0)}%)</Badge>;
    if (num >= 0.7) return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100">Medium ({(num * 100).toFixed(0)}%)</Badge>;
    return <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100">Low ({(num * 100).toFixed(0)}%)</Badge>;
  };

  const getDepartmentLabel = (value: string | null) => {
    if (!value) return null;
    return DEPARTMENTS.find(d => d.value === value)?.label || value;
  };

  const getCategoryName = (categoryId: string | null) => {
    if (!categoryId) return "Uncategorized";
    return categories.find(c => c.id === categoryId)?.name || "Unknown";
  };

  // Get per-document stats
  const getDocumentStats = (uploadId: string) => {
    const items = queryDataMap[uploadId] || [];
    return {
      total: items.length,
      pending: items.filter(i => i.status === "pending" || i.status === "needs_review").length,
      confirmed: items.filter(i => i.status === "confirmed").length,
      rejected: items.filter(i => i.status === "rejected").length,
      excluded: items.filter(i => i.status === "excluded").length,
    };
  };

  // Safe category select handler with error handling (Requirement H)
  const handleCategoryChange = (uploadId: string, itemId: string, categoryId: string, currentDepartment?: string) => {
    try {
      // Persist immediately (Requirement H)
      updateItemMutation.mutate({
        uploadId,
        itemId,
        categoryId,
        department: currentDepartment,
      });
    } catch (error) {
      console.error('Category change error:', error);
      toast({
        title: "Error",
        description: "Failed to update category. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Safe department select handler (Requirement H)
  const handleDepartmentChange = (uploadId: string, itemId: string, department: string, currentCategoryId?: string) => {
    try {
      updateItemMutation.mutate({
        uploadId,
        itemId,
        categoryId: currentCategoryId,
        department,
      });
    } catch (error) {
      console.error('Department change error:', error);
      toast({
        title: "Error",
        description: "Failed to update department. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Workflow Navigation */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b py-3 -mx-6 px-6 mb-2">
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            onClick={() => {
              if (onTabChange) {
                onTabChange('uploads');
              } else {
                onClose();
              }
            }}
            className="gap-2"
          >
            <ChevronLeft className="h-4 w-4" />
            Previous: Uploads
          </Button>

          <div className="text-sm text-muted-foreground">
            Review Documents
          </div>

          <Button
            onClick={() => {
              if (onTabChange) {
                onTabChange('historical');
              } else {
                navigate(`/modeling/projects/${projectId}?tab=historical`);
              }
            }}
            className="gap-2"
          >
            Next: Historical
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Processing Overlay */}
      {(autoConfirmMutation.isPending || isApplying) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-4 p-8 rounded-lg bg-card border shadow-lg">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <div className="text-center">
              <p className="text-lg font-semibold">
                {isApplying ? "Applying to Model" : "Auto-Confirming Items"}
              </p>
              <p className="text-sm text-muted-foreground">
                {isApplying ? "Importing confirmed line items..." : "Processing high confidence items..."}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* NEW: Confirm All Progress Overlay (Requirement G) */}
      {isConfirmingAll && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-4 p-8 rounded-lg bg-card border shadow-lg max-w-md w-full">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <div className="text-center w-full">
              <p className="text-lg font-semibold">Confirming All Items</p>
              <p className="text-sm text-muted-foreground mt-1">
                {confirmProgress.current} of {confirmProgress.total} items confirmed
                {confirmProgress.skipped > 0 && (
                  <span className="text-amber-600"> • {confirmProgress.skipped} skipped</span>
                )}
              </p>
              <Progress 
                value={(confirmProgress.current / Math.max(confirmProgress.total, 1)) * 100} 
                className="h-2 mt-3"
              />
            </div>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleCancelConfirmAll}
              className="mt-2"
            >
              <StopCircle className="h-4 w-4 mr-2" />
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onClose}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Review Documents</h1>
            <p className="text-muted-foreground">
              Reviewing {uploads.length} document{uploads.length > 1 ? 's' : ''} • {totalItems} line items
            </p>
          </div>
        </div>
      </div>

      {/* Overall Progress Card */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-4">
            <div className="space-y-1">
              <h3 className="font-semibold">Overall Progress</h3>
              <p className="text-sm text-muted-foreground">
                {totalConfirmed} confirmed • {totalRejected} rejected • {totalPending} pending
              </p>
            </div>
            <div className="flex items-center gap-3">
              {/* NEW: Confirm All button (Requirement G) */}
              <Button 
                variant="outline" 
                size="sm"
                onClick={handleConfirmAll}
                disabled={isConfirmingAll || totalPending === 0}
              >
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Confirm All
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={handleAutoConfirmAll}
                disabled={autoConfirmMutation.isPending || totalPending === 0}
              >
                <Zap className="h-4 w-4 mr-2" />
                Auto-Confirm High Confidence
              </Button>
              <Button
                onClick={handleApplyToModel}
                disabled={!canApplyToModel || isApplying}
                className={canApplyToModel ? "" : "opacity-50"}
                title={!allItemsClassified ? "Classify all items (Category + Department) before applying" : undefined}
              >
                {isApplying ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Applying...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4 mr-2" />
                    Apply to Model
                  </>
                )}
              </Button>
            </div>
          </div>
          <Progress 
            value={totalItems > 0 ? ((totalConfirmed + totalRejected) / totalItems) * 100 : 0} 
            className="h-3"
          />
          {!allItemsClassified && totalItems > 0 && (
            <p className="text-sm text-amber-600 dark:text-amber-400 mt-2 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              All items must have Category AND Department selected to enable "Apply to Model".
            </p>
          )}
          {allItemsClassified && !allItemsProcessed && totalPending > 0 && (
            <p className="text-sm text-amber-600 dark:text-amber-400 mt-2 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              {totalPending} items still pending. Confirm or reject all items before applying.
            </p>
          )}
          {canApplyToModel && (
            <p className="text-sm text-green-600 dark:text-green-400 mt-2 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              All items reviewed! Ready to apply {totalConfirmed} confirmed items to the model.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Document Tabs (Requirement F - shows ALL uploaded documents) */}
      <Tabs value={activeDocumentId} onValueChange={setActiveDocumentId}>
        <TabsList className="w-full justify-start overflow-x-auto">
          {uploads.map((upload) => {
            const stats = getDocumentStats(upload.id);
            const isComplete = stats.pending === 0 && stats.total > 0;
            return (
              <TabsTrigger 
                key={upload.id} 
                value={upload.id}
                className="flex items-center gap-2 min-w-fit"
              >
                <FileSpreadsheet className="h-4 w-4" />
                <span className="truncate max-w-[150px]" title={upload.originalName}>
                  {upload.originalName}
                </span>
                {isComplete ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                ) : stats.pending > 0 ? (
                  <Badge variant="secondary" className="text-xs">
                    {stats.pending}
                  </Badge>
                ) : null}
              </TabsTrigger>
            );
          })}
        </TabsList>

        {/* Guidance for returning users */}
        <div className="flex items-center gap-2 px-1 py-2 text-sm text-muted-foreground">
          <FileSpreadsheet className="h-4 w-4" />
          <span>Click on a document above to review and verify its line items</span>
        </div>

        {uploads.map((upload) => (
          <TabsContent key={upload.id} value={upload.id} className="space-y-4">
            {/* Document Stats */}
            <Card>
              <CardContent className="pt-4">
                <div className="grid grid-cols-4 gap-4">
                  <div className="text-center p-3 bg-muted rounded-lg">
                    <p className="text-2xl font-bold">{getDocumentStats(upload.id).total}</p>
                    <p className="text-xs text-muted-foreground">Total Items</p>
                  </div>
                  <div className="text-center p-3 bg-amber-50 dark:bg-amber-950 rounded-lg">
                    <p className="text-2xl font-bold text-amber-600">{getDocumentStats(upload.id).pending}</p>
                    <p className="text-xs text-muted-foreground">Pending</p>
                  </div>
                  <div className="text-center p-3 bg-green-50 dark:bg-green-950 rounded-lg">
                    <p className="text-2xl font-bold text-green-600">{getDocumentStats(upload.id).confirmed}</p>
                    <p className="text-xs text-muted-foreground">Confirmed</p>
                  </div>
                  <div className="text-center p-3 bg-red-50 dark:bg-red-950 rounded-lg">
                    <p className="text-2xl font-bold text-red-600">{getDocumentStats(upload.id).rejected}</p>
                    <p className="text-xs text-muted-foreground">Rejected</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* View Controls & Filters */}
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search line items..."
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="Filter status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Items</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="confirmed">Confirmed</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => autoConfirmMutation.mutate({ uploadId: upload.id, threshold: 0.9 })}
                  disabled={autoConfirmMutation.isPending || getDocumentStats(upload.id).pending === 0}
                >
                  <Zap className="h-4 w-4 mr-2" />
                  Auto-Confirm
                </Button>
              </div>

              {/* View Mode Toggle */}
              <ToggleGroup type="single" value={viewMode} onValueChange={(v) => v && setViewMode(v as 'matrix' | 'list')}>
                <ToggleGroupItem value="matrix" aria-label="Matrix view" title="P&L Matrix View (shows periods)">
                  <Table2 className="h-4 w-4" />
                </ToggleGroupItem>
                <ToggleGroupItem value="list" aria-label="List view" title="Simple List View">
                  <List className="h-4 w-4" />
                </ToggleGroupItem>
              </ToggleGroup>
            </div>

            {/* Line Items Display - Matrix or List View */}
            {viewMode === 'matrix' ? (
              /* P&L Matrix View with periods as columns */
              <PLReviewGrid
                projectId={projectId}
                uploadId={upload.id}
                statusFilter={statusFilter}
                onApplyToModeling={() => {
                  queryClient.invalidateQueries({ queryKey: ["/api/modeling/projects", projectId, "documents", upload.id, "items"] });
                }}
              />
            ) : (
              /* Fallback List View with error boundary (Requirement H) */
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Line Items</CardTitle>
                  <CardDescription>
                    Review and confirm AI categorization for each line item
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[500px]">
                    <div className="space-y-2">
                      {filteredItems.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                          <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                          <p>No items match your filter</p>
                        </div>
                      ) : (
                        filteredItems.map((item) => (
                          <div
                            key={item.id}
                            className={`p-4 border rounded-lg ${
                              item.status === "confirmed" 
                                ? "border-green-200 bg-green-50/50 dark:border-green-800 dark:bg-green-950/50" 
                                : item.status === "rejected"
                                ? "border-red-200 bg-red-50/50 dark:border-red-800 dark:bg-red-950/50"
                                : "border-border"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1 min-w-0">
                                <p className="font-medium truncate">
                                  {sanitizeDisplayText(item.rawText)}
                                </p>
                                <div className="flex items-center gap-2 mt-1 flex-wrap">
                                  <span className="text-lg font-semibold">
                                    {formatAmount(item.amountConfirmed || item.amount)}
                                  </span>
                                  {getConfidenceBadge(item.confidenceScore)}
                                  <Badge variant="outline">
                                    {getCategoryName(item.categoryConfirmed || item.categorySuggested)}
                                  </Badge>
                                  {(item.departmentConfirmed || item.departmentSuggested) && (
                                    <Badge variant="secondary">
                                      {getDepartmentLabel(item.departmentConfirmed || item.departmentSuggested)}
                                    </Badge>
                                  )}
                                </div>
                              </div>

                              {item.status === "pending" && (
                                <div className="flex items-center gap-2 flex-shrink-0">
                                  {/* Category Select with Error Boundary (Requirement H) */}
                                  <CategorySelectErrorBoundary
                                    fallback={
                                      <Button variant="outline" size="sm" disabled>
                                        Error loading categories
                                      </Button>
                                    }
                                  >
                                    {categories && categories.length > 0 ? (
                                      <Select
                                        value={item.categoryConfirmed || item.categorySuggested || ""}
                                        onValueChange={(categoryId) => {
                                          handleCategoryChange(
                                            upload.id, 
                                            item.id, 
                                            categoryId, 
                                            item.departmentConfirmed || item.departmentSuggested || undefined
                                          );
                                        }}
                                      >
                                        <SelectTrigger className="w-[180px]">
                                          <SelectValue placeholder="Select category" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {categories.map((cat) => (
                                            <SelectItem key={cat.id} value={cat.id}>
                                              {cat.name}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    ) : (
                                      <Button variant="outline" size="sm" disabled>
                                        Loading categories...
                                      </Button>
                                    )}
                                  </CategorySelectErrorBoundary>

                                  {/* Department Select (Requirement H - persists immediately) */}
                                  <Select
                                    value={item.departmentConfirmed || item.departmentSuggested || ""}
                                    onValueChange={(department) => {
                                      handleDepartmentChange(
                                        upload.id,
                                        item.id,
                                        department,
                                        item.categoryConfirmed || item.categorySuggested || undefined
                                      );
                                    }}
                                  >
                                    <SelectTrigger className="w-[150px]">
                                      <SelectValue placeholder="Department" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {DEPARTMENTS.map((dept) => (
                                        <SelectItem key={dept.value} value={dept.value}>
                                          {dept.label}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>

                                  <Button
                                    size="icon"
                                    variant="outline"
                                    className="text-green-600 hover:bg-green-50"
                                    onClick={() => {
                                      const categoryId = item.categoryConfirmed || item.categorySuggested;
                                      if (categoryId) {
                                        confirmItemMutation.mutate({
                                          uploadId: upload.id,
                                          itemId: item.id,
                                          categoryId,
                                          department: item.departmentConfirmed || item.departmentSuggested || undefined,
                                        });
                                      }
                                    }}
                                    disabled={!item.categorySuggested && !item.categoryConfirmed}
                                  >
                                    <Check className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    size="icon"
                                    variant="outline"
                                    className="text-red-600 hover:bg-red-50"
                                    onClick={() => {
                                      rejectItemMutation.mutate({
                                        uploadId: upload.id,
                                        itemId: item.id,
                                      });
                                    }}
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </div>
                              )}

                              {item.status === "confirmed" && (
                                <CheckCircle2 className="h-6 w-6 text-green-600 flex-shrink-0" />
                              )}

                              {item.status === "rejected" && (
                                <XCircle className="h-6 w-6 text-red-600 flex-shrink-0" />
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}