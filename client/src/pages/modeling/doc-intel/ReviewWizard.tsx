import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, FileSpreadsheet, Brain, Check, X, Zap, Download, ListChecks, Eye, CheckCircle2, AlertTriangle, Building2, ChevronDown, ChevronRight, Pencil, Table2, List, LayoutGrid, Search, Filter, Clock, XCircle, MinusCircle, Layers, TrendingUp, TrendingDown, Minus, Loader2 } from "lucide-react";
import { PLTableView } from "@/components/doc-intel/PLTableView";
import { PLReviewGrid } from "@/components/doc-intel/PLReviewGrid";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { getEnabledRevenueCogsDepts } from "@/lib/pnl-categories";
import type { DocIntelUpload, DocIntelExtractedItem, PnlCategory } from "@shared/schema";

interface ExtractedItemWithCategory extends DocIntelExtractedItem {
  suggestedCategory?: PnlCategory;
  confirmedCategory?: PnlCategory;
}

interface ReviewWizardProps {
  projectId: string;
  upload: DocIntelUpload;
  categories: PnlCategory[];
  onClose: () => void;
  onComplete: () => void;
}

const DEPARTMENTS = [
  { value: "marina_ops", label: "Marina Operations" },
  { value: "fuel_dock", label: "Fuel Dock" },
  { value: "ship_store", label: "Ship Store" },
  { value: "restaurant", label: "Restaurant" },
  { value: "boat_sales", label: "Boat Sales" },
  { value: "service_dept", label: "Service Department" },
  { value: "storage", label: "Storage" },
  { value: "commercial_leases", label: "Commercial Leases" },
  { value: "admin", label: "Administration" },
  { value: "other", label: "Other" },
];

const WIZARD_STEPS = [
  { id: 1, title: "Parse Document", description: "Extract line items from file", icon: FileSpreadsheet },
  { id: 2, title: "Auto-Categorize", description: "Apply pattern matching rules", icon: Brain },
  { id: 3, title: "Review Items", description: "Confirm categories & departments", icon: ListChecks },
  { id: 4, title: "Variance Preview", description: "Review impact to P&L", icon: Eye },
  { id: 5, title: "Approve & Apply", description: "Finalize and save data", icon: CheckCircle2 },
];

function getStepFromStatus(status: string): number {
  switch (status) {
    case 'completed':
    case 'applied':
      return 5;
    case 'approved':
      return 5;
    case 'reviewing':
      return 3;
    case 'parsed':
      return 2;
    case 'processing':
    case 'validated':
    case 'uploaded':
    case 'error':
    default:
      return 1;
  }
}

function getMaxAllowedStep(status: string): number {
  switch (status) {
    case 'completed':
    case 'applied':
      return 5;
    case 'approved':
      return 5;
    case 'reviewing':
      return 5;
    case 'parsed':
      return 3;
    default:
      return 1;
  }
}

interface VarianceItem {
  categoryId: string;
  categoryName: string;
  categoryType: string;
  currentAmount: number;
  importAmount: number;
  variance: number;
  variancePercent: number;
  itemCount: number;
}

function sanitizeDisplayText(text: string | null): string {
  if (!text) return '(no description)';
  const printableRatio = (text.match(/[a-zA-Z0-9\s.,\-$%()/]/g) || []).length / Math.max(text.length, 1);
  if (printableRatio < 0.5 && text.length > 10) {
    return text.replace(/[^a-zA-Z0-9\s.,\-$%()/&'":;]/g, '').trim() || '(garbled text)';
  }
  return text.replace(/[\u0000-\u001F\u007F-\u009F]/g, '').trim();
}

export function ReviewWizard({ projectId, upload, categories, onClose, onComplete }: ReviewWizardProps) {
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(() => getStepFromStatus(upload.status));
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [approvalNotes, setApprovalNotes] = useState("");
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'list' | 'table' | 'spreadsheet' | 'grouped'>('spreadsheet');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'confirmed' | 'rejected' | 'excluded'>('all');
  const [searchText, setSearchText] = useState("");
  
  const maxAllowedStep = getMaxAllowedStep(upload.status);
  
  useEffect(() => {
    const newStep = getStepFromStatus(upload.status);
    if (newStep > currentStep) {
      setCurrentStep(newStep);
    }
  }, [upload.status]);
  
  
  const handleStepClick = (stepId: number) => {
    if (stepId <= maxAllowedStep) {
      setCurrentStep(stepId);
    }
  };

  const { data: items = [], isLoading: itemsLoading, refetch: refetchItems } = useQuery<ExtractedItemWithCategory[]>({
    queryKey: ["/api/modeling/projects", projectId, "documents", upload.id, "items"],
  });

  const { data: existingPnlData = [] } = useQuery<{ categoryId: string; amount: number }[]>({
    queryKey: ["/api/modeling/projects", projectId, "pnl-summary"],
    enabled: currentStep >= 4,
  });

  const { data: projectConfig } = useQuery<any>({
    queryKey: ["/api/modeling/projects", projectId, "config"],
  });

  const enabledRevCogsDepts = useMemo(() => {
    if (!projectConfig?.profitCenters) return undefined;
    return getEnabledRevenueCogsDepts(projectConfig.profitCenters);
  }, [projectConfig]);

  const parseMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/modeling/projects/${projectId}/documents/${upload.id}/parse`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/modeling/projects", projectId, "documents"] });
      refetchItems();
      setCurrentStep(2);
    },
    onError: () => {
      toast({ title: "Parse failed", description: "Could not extract items from document.", variant: "destructive" });
    },
  });

  const categorizeMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/modeling/projects/${projectId}/documents/${upload.id}/categorize`, 
        enabledRevCogsDepts ? { enabledDepartments: enabledRevCogsDepts } : undefined
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/modeling/projects", projectId, "documents"] });
      refetchItems();
      setCurrentStep(3);
    },
    onError: () => {
      toast({ title: "Categorization failed", description: "Could not auto-categorize items.", variant: "destructive" });
    },
  });

  const confirmItemMutation = useMutation({
    mutationFn: async ({ itemId, categoryId, amount, department }: { itemId: string; categoryId: string; amount?: number; department?: string }) => {
      return apiRequest("POST", `/api/modeling/projects/${projectId}/documents/${upload.id}/items/${itemId}/confirm`, { 
        categoryId, 
        amount,
        department 
      });
    },
    onSuccess: () => {
      refetchItems();
    },
  });

  const rejectItemMutation = useMutation({
    mutationFn: async (itemId: string) => {
      return apiRequest("POST", `/api/modeling/projects/${projectId}/documents/${upload.id}/items/${itemId}/reject`);
    },
    onSuccess: () => {
      refetchItems();
    },
  });

  const excludeItemMutation = useMutation({
    mutationFn: async (itemId: string) => {
      return apiRequest("POST", `/api/modeling/projects/${projectId}/documents/${upload.id}/items/${itemId}/exclude`);
    },
    onSuccess: () => {
      refetchItems();
    },
  });

  const bulkExcludeMutation = useMutation({
    mutationFn: async (itemIds: string[]) => {
      return apiRequest("PATCH", `/api/doc-intel/uploads/${upload.id}/items/bulk`, {
        itemIds,
        updates: { status: "excluded" },
      });
    },
    onSuccess: (_, variables) => {
      refetchItems();
      setSelectedItems(new Set());
      toast({ title: "Excluded", description: `${variables.length} items excluded from import.` });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to exclude items.", variant: "destructive" });
    },
  });

  const handleBulkExcludeSelected = () => {
    const ids = Array.from(selectedItems);
    if (ids.length === 0) return;
    bulkExcludeMutation.mutate(ids);
  };

  const handleExcludeAllFiltered = () => {
    const ids = filteredItems
      .filter(i => i.status === "pending" || i.status === "needs_review")
      .map(i => i.id);
    if (ids.length === 0) return;
    bulkExcludeMutation.mutate(ids);
  };

  const toggleSelectItem = (id: string) => {
    setSelectedItems(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    const selectableIds = filteredItems.filter(i => i.status !== "excluded").map(i => i.id);
    const allSelected = selectableIds.every(id => selectedItems.has(id));
    if (allSelected) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(selectableIds));
    }
  };

  const autoConfirmMutation = useMutation({
    mutationFn: async (threshold: number) => {
      return apiRequest("POST", `/api/modeling/projects/${projectId}/documents/${upload.id}/items/confirm-high-confidence`, { threshold });
    },
    onSuccess: (data: { confirmed: number }) => {
      refetchItems();
      toast({ title: "Auto-confirmed", description: `${data.confirmed} high-confidence items confirmed.` });
    },
  });

  const approveMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/modeling/projects/${projectId}/documents/${upload.id}/approve`, { 
        notes: approvalNotes 
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/modeling/projects", projectId, "documents"] });
      toast({ title: "Approved", description: "Document approved and ready to apply." });
    },
    onError: () => {
      toast({ title: "Approval failed", description: "Could not approve document.", variant: "destructive" });
    },
  });

  const importMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/modeling/projects/${projectId}/documents/${upload.id}/import`, { fiscalYear: upload.year });
    },
    onSuccess: (data: { imported: number }) => {
      toast({ title: "Import complete", description: `${data.imported} line items imported to P&L.` });
      onComplete();
    },
    onError: () => {
      toast({ title: "Import failed", description: "Could not import items to P&L.", variant: "destructive" });
    },
  });

  const pendingItems = items.filter(i => i.status === "pending");
  const confirmedItems = items.filter(i => i.status === "confirmed");
  const rejectedItems = items.filter(i => i.status === "rejected");
  const excludedItems = items.filter(i => i.status === "excluded");
  const highConfidenceItems = items.filter(i => i.confidenceScore && parseFloat(i.confidenceScore) >= 0.9);
  const mediumConfidenceItems = items.filter(i => i.confidenceScore && parseFloat(i.confidenceScore) >= 0.7 && parseFloat(i.confidenceScore) < 0.9);
  const lowConfidenceItems = items.filter(i => !i.confidenceScore || parseFloat(i.confidenceScore) < 0.7);

  const matchesSearch = (item: ExtractedItemWithCategory, search: string): boolean => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      (item.rawText && item.rawText.toLowerCase().includes(searchLower)) ||
      (item.amount && item.amount.includes(searchLower)) ||
      categories.find(c => c.id === (item.categoryConfirmed || item.categorySuggested))?.name?.toLowerCase().includes(searchLower) ||
      getDepartmentLabel(item.departmentConfirmed || item.departmentSuggested)?.toLowerCase().includes(searchLower) ||
      false
    );
  };

  const matchesFilter = (item: ExtractedItemWithCategory): boolean => {
    if (statusFilter !== 'all' && item.status !== statusFilter) return false;
    if (searchText.trim() && !matchesSearch(item, searchText.trim())) return false;
    return true;
  };

  const filteredItems = useMemo(() => {
    return items.filter(matchesFilter);
  }, [items, statusFilter, searchText, categories]);

  const varianceData = useMemo<VarianceItem[]>(() => {
    if (confirmedItems.length === 0) return [];
    
    const categoryTotals = new Map<string, { amount: number; count: number }>();
    
    confirmedItems.forEach(item => {
      const catId = item.categoryConfirmed || item.categorySuggested;
      if (!catId) return;
      
      const existing = categoryTotals.get(catId) || { amount: 0, count: 0 };
      const amount = item.amountConfirmed 
        ? parseFloat(item.amountConfirmed) 
        : (item.amount ? parseFloat(item.amount) : 0);
      
      categoryTotals.set(catId, {
        amount: existing.amount + amount,
        count: existing.count + 1,
      });
    });

    return Array.from(categoryTotals.entries()).map(([catId, data]) => {
      const category = categories.find(c => c.id === catId);
      const existingAmount = existingPnlData.find(e => e.categoryId === catId)?.amount || 0;
      const variance = data.amount - existingAmount;
      const variancePercent = existingAmount !== 0 ? (variance / existingAmount) * 100 : 100;
      
      return {
        categoryId: catId,
        categoryName: category?.name || "Unknown",
        categoryType: category?.categoryType || "other",
        currentAmount: existingAmount,
        importAmount: data.amount,
        variance,
        variancePercent,
        itemCount: data.count,
      };
    }).sort((a, b) => Math.abs(b.variance) - Math.abs(a.variance));
  }, [confirmedItems, categories, existingPnlData]);

  const totalImportAmount = varianceData.reduce((sum, v) => sum + v.importAmount, 0);
  const totalVariance = varianceData.reduce((sum, v) => sum + v.variance, 0);

  const getCategoryOptions = () => {
    const parentCategories = categories.filter(c => !c.parentId);
    return parentCategories.map(parent => ({
      ...parent,
      children: categories.filter(c => c.parentId === parent.id),
    }));
  };

  const getConfidenceBadge = (score: string | null) => {
    if (!score) return <Badge variant="outline">No match</Badge>;
    const num = parseFloat(score);
    if (num >= 0.9) return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">High ({(num * 100).toFixed(0)}%)</Badge>;
    if (num >= 0.7) return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100">Medium ({(num * 100).toFixed(0)}%)</Badge>;
    return <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100">Low ({(num * 100).toFixed(0)}%)</Badge>;
  };

  const formatAmount = (amount: string | number | null) => {
    if (amount === null || amount === undefined) return "-";
    const num = typeof amount === "string" ? parseFloat(amount) : amount;
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(num);
  };

  const formatPercent = (percent: number) => {
    const sign = percent >= 0 ? "+" : "";
    return `${sign}${percent.toFixed(1)}%`;
  };

  const getDepartmentLabel = (value: string | null) => {
    if (!value) return null;
    return DEPARTMENTS.find(d => d.value === value)?.label;
  };

  const toggleCategoryExpanded = (categoryId: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  };

  const itemsByCategory = useMemo(() => {
    const grouped = new Map<string, ExtractedItemWithCategory[]>();
    items.forEach(item => {
      const catId = item.categoryConfirmed || item.categorySuggested || "uncategorized";
      const existing = grouped.get(catId) || [];
      grouped.set(catId, [...existing, item]);
    });
    return grouped;
  }, [items]);

  return (
    <div className="container mx-auto py-6 space-y-6">
      {autoConfirmMutation.isPending && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-4 p-8 rounded-lg bg-card border shadow-lg">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <div className="text-center">
              <p className="text-lg font-semibold">Auto-Confirming Items</p>
              <p className="text-sm text-muted-foreground">Processing high confidence items...</p>
            </div>
          </div>
        </div>
      )}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onClose} data-testid="button-back">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{upload.originalName}</h1>
            <p className="text-muted-foreground">Review Wizard - Step {currentStep} of {WIZARD_STEPS.length}</p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between bg-muted/50 p-4 rounded-lg overflow-x-auto">
        {WIZARD_STEPS.map((step, index) => {
          const isAccessible = step.id <= maxAllowedStep;
          const isCompleted = step.id < currentStep;
          const isCurrent = step.id === currentStep;
          
          return (
            <div key={step.id} className="flex items-center flex-shrink-0">
              <button
                onClick={() => handleStepClick(step.id)}
                disabled={!isAccessible}
                className={`flex items-center gap-2 transition-colors ${
                  isAccessible 
                    ? (isCurrent || isCompleted ? "text-primary hover:text-primary/80" : "text-muted-foreground hover:text-muted-foreground/80")
                    : "text-muted-foreground/40 cursor-not-allowed"
                }`}
                data-testid={`wizard-step-${step.id}`}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                  isCompleted ? "bg-primary text-primary-foreground" :
                  isCurrent ? "border-2 border-primary" : 
                  isAccessible ? "border-2 border-muted-foreground/30" : "border-2 border-muted-foreground/20"
                }`}>
                  {isCompleted ? <Check className="h-4 w-4" /> : <step.icon className="h-4 w-4" />}
                </div>
                <div className="hidden lg:block text-left">
                  <p className="font-medium text-sm">{step.title}</p>
                  <p className="text-xs text-muted-foreground">{step.description}</p>
                </div>
              </button>
              {index < WIZARD_STEPS.length - 1 && (
                <Separator className="w-8 mx-2 lg:w-12 lg:mx-4" />
              )}
            </div>
          );
        })}
      </div>

      {currentStep === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Step 1: Parse Document</CardTitle>
            <CardDescription>
              Extract line items from your {upload.docType?.toUpperCase() || "document"} file
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {upload.status === 'error' && upload.errorMessage && (
              <div className="bg-destructive/10 border border-destructive/20 p-4 rounded-lg">
                <p className="text-sm text-destructive font-medium">Previous parsing attempt failed:</p>
                <p className="text-sm text-destructive/80 mt-1">{upload.errorMessage}</p>
                <p className="text-sm text-muted-foreground mt-2">Click "Parse Document" below to try again.</p>
              </div>
            )}
            {upload.holdingNotes?.includes('OCR') && (
              <div className="bg-yellow-500/10 border border-yellow-500/20 p-4 rounded-lg flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-yellow-800 dark:text-yellow-200 font-medium">OCR Processing Note</p>
                  <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">{upload.holdingNotes}</p>
                </div>
              </div>
            )}
            <div className="bg-muted p-4 rounded-lg">
              <div className="flex items-center gap-4 mb-4">
                <FileSpreadsheet className="h-12 w-12 text-green-600" />
                <div>
                  <p className="font-medium">{upload.originalName}</p>
                  <p className="text-sm text-muted-foreground">
                    {upload.docType?.toUpperCase()} • {upload.year || "Year not specified"} • {upload.dataGranularity === 'annual' ? 'Annualized' : 'Monthly'} • {(upload.fileSize / 1024).toFixed(1)} KB
                  </p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                Click "Parse Document" to extract all line items from this file. The system will identify
                descriptions, amounts, and dates automatically.
              </p>
            </div>
            <div className="flex justify-end">
              <Button onClick={() => parseMutation.mutate()} disabled={parseMutation.isPending} data-testid="button-parse">
                {parseMutation.isPending ? "Parsing..." : upload.status === 'error' ? "Retry Parsing" : "Parse Document"}
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {currentStep === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Step 2: Auto-Categorize</CardTitle>
            <CardDescription>
              Apply AI-powered pattern matching to suggest categories and departments for each line item
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {upload.holdingNotes?.includes('OCR') && (
              <div className="bg-yellow-500/10 border border-yellow-500/20 p-4 rounded-lg flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-yellow-800 dark:text-yellow-200 font-medium">OCR Processing Note</p>
                  <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">{upload.holdingNotes}</p>
                </div>
              </div>
            )}
            <div className="bg-muted p-4 rounded-lg">
              <div className="flex items-center gap-4 mb-4">
                <Brain className="h-12 w-12 text-purple-600" />
                <div>
                  <p className="font-medium">{items.length} line items extracted</p>
                  <p className="text-sm text-muted-foreground">
                    Ready to categorize using marina-specific patterns
                  </p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                The system will match each line item against your organization's category patterns
                to suggest the most appropriate P&L category and department.
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setCurrentStep(1)} data-testid="button-back-step">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <Button onClick={() => categorizeMutation.mutate()} disabled={categorizeMutation.isPending} data-testid="button-categorize">
                {categorizeMutation.isPending ? "Categorizing..." : "Categorize Items"}
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {currentStep === 3 && (
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xl">Step 3: Review Line Items</CardTitle>
                <CardDescription className="mt-1">
                  Review AI suggestions and confirm categories for each extracted line item
                </CardDescription>
              </div>
              <Button
                variant="default"
                size="sm"
                onClick={() => autoConfirmMutation.mutate(0.9)}
                disabled={autoConfirmMutation.isPending || pendingItems.filter(i => i.confidenceScore && parseFloat(i.confidenceScore) >= 0.9).length === 0}
                className="bg-green-600 hover:bg-green-700"
                data-testid="button-auto-confirm"
              >
                <Zap className="h-4 w-4 mr-2" />
                Auto-Confirm High Confidence ({pendingItems.filter(i => i.confidenceScore && parseFloat(i.confidenceScore) >= 0.9).length})
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <button
                onClick={() => setStatusFilter(statusFilter === 'pending' ? 'all' : 'pending')}
                className={`p-3 rounded-lg border-2 transition-all text-left ${
                  statusFilter === 'pending' 
                    ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/50' 
                    : 'border-transparent bg-amber-50/50 dark:bg-amber-950/30 hover:border-amber-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-amber-600" />
                  <span className="text-2xl font-bold text-amber-700 dark:text-amber-400">{pendingItems.length}</span>
                </div>
                <p className="text-xs text-amber-600 dark:text-amber-500 mt-1">Pending Review</p>
              </button>
              <button
                onClick={() => setStatusFilter(statusFilter === 'confirmed' ? 'all' : 'confirmed')}
                className={`p-3 rounded-lg border-2 transition-all text-left ${
                  statusFilter === 'confirmed' 
                    ? 'border-green-500 bg-green-50 dark:bg-green-950/50' 
                    : 'border-transparent bg-green-50/50 dark:bg-green-950/30 hover:border-green-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <span className="text-2xl font-bold text-green-700 dark:text-green-400">{confirmedItems.length}</span>
                </div>
                <p className="text-xs text-green-600 dark:text-green-500 mt-1">Confirmed</p>
              </button>
              <button
                onClick={() => setStatusFilter(statusFilter === 'rejected' ? 'all' : 'rejected')}
                className={`p-3 rounded-lg border-2 transition-all text-left ${
                  statusFilter === 'rejected' 
                    ? 'border-red-500 bg-red-50 dark:bg-red-950/50' 
                    : 'border-transparent bg-red-50/50 dark:bg-red-950/30 hover:border-red-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-red-600" />
                  <span className="text-2xl font-bold text-red-700 dark:text-red-400">{rejectedItems.length}</span>
                </div>
                <p className="text-xs text-red-600 dark:text-red-500 mt-1">Rejected</p>
              </button>
              <button
                onClick={() => setStatusFilter(statusFilter === 'excluded' ? 'all' : 'excluded')}
                className={`p-3 rounded-lg border-2 transition-all text-left ${
                  statusFilter === 'excluded' 
                    ? 'border-gray-500 bg-gray-50 dark:bg-gray-950/50' 
                    : 'border-transparent bg-gray-50/50 dark:bg-gray-950/30 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <MinusCircle className="h-4 w-4 text-gray-600" />
                  <span className="text-2xl font-bold text-gray-700 dark:text-gray-400">{excludedItems.length}</span>
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-500 mt-1">Excluded</p>
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-3 py-2">
              <div className="relative flex-1 min-w-[200px] max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={viewMode === 'spreadsheet' ? "Switch view to filter..." : "Search line items..."}
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  className="pl-9"
                  disabled={viewMode === 'spreadsheet'}
                />
              </div>
              <div className="flex items-center gap-1 border rounded-lg p-1 bg-muted/30">
                <Button
                  variant={viewMode === 'spreadsheet' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('spreadsheet')}
                  className="h-8 px-3"
                  title="Spreadsheet View"
                >
                  <LayoutGrid className="h-4 w-4 mr-1" />
                  <span className="hidden sm:inline text-xs">Grid</span>
                </Button>
                <Button
                  variant={viewMode === 'grouped' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('grouped')}
                  className="h-8 px-3"
                  title="Grouped by Category"
                >
                  <Layers className="h-4 w-4 mr-1" />
                  <span className="hidden sm:inline text-xs">Grouped</span>
                </Button>
                <Button
                  variant={viewMode === 'table' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('table')}
                  className="h-8 px-3"
                  title="Table View"
                >
                  <Table2 className="h-4 w-4 mr-1" />
                  <span className="hidden sm:inline text-xs">Table</span>
                </Button>
                <Button
                  variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('list')}
                  className="h-8 px-3"
                  title="Card View"
                >
                  <List className="h-4 w-4 mr-1" />
                  <span className="hidden sm:inline text-xs">Cards</span>
                </Button>
              </div>
              {statusFilter !== 'all' && (
                <Button variant="ghost" size="sm" onClick={() => setStatusFilter('all')} className="h-8">
                  <X className="h-3 w-3 mr-1" />
                  Clear filter
                </Button>
              )}
            </div>

            {selectedItems.size > 0 && viewMode !== 'spreadsheet' && (
              <div className="flex items-center gap-3 p-3 bg-primary/5 border border-primary/20 rounded-lg">
                <Checkbox
                  checked={filteredItems.filter(i => i.status !== "excluded").every(i => selectedItems.has(i.id)) && filteredItems.length > 0}
                  onCheckedChange={toggleSelectAll}
                />
                <span className="text-sm font-medium">{selectedItems.size} selected</span>
                <Separator orientation="vertical" className="h-5" />
                <Button
                  size="sm"
                  variant="outline"
                  className="text-red-600 hover:text-red-700 border-red-200 hover:border-red-300 hover:bg-red-50"
                  onClick={handleBulkExcludeSelected}
                  disabled={bulkExcludeMutation.isPending}
                >
                  <MinusCircle className="h-4 w-4 mr-1" />
                  Exclude Selected ({selectedItems.size})
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setSelectedItems(new Set())}
                >
                  Clear Selection
                </Button>
              </div>
            )}

            {viewMode !== 'spreadsheet' && selectedItems.size === 0 && (
              <div className="flex items-center gap-3">
                <Button
                  size="sm"
                  variant="outline"
                  className="text-red-600 hover:text-red-700 border-red-200 hover:border-red-300 hover:bg-red-50"
                  onClick={handleExcludeAllFiltered}
                  disabled={bulkExcludeMutation.isPending || filteredItems.filter(i => i.status === "pending" || i.status === "needs_review").length === 0}
                >
                  <MinusCircle className="h-4 w-4 mr-1" />
                  Exclude All Pending ({filteredItems.filter(i => i.status === "pending" || i.status === "needs_review").length})
                </Button>
              </div>
            )}

            <div className="flex items-center gap-4 text-xs text-muted-foreground border-b pb-2">
              <span className="font-medium">Confidence:</span>
              <div className="flex items-center gap-1">
                <TrendingUp className="h-3 w-3 text-green-600" />
                <span className="text-green-700 dark:text-green-400">High: {highConfidenceItems.length}</span>
              </div>
              <div className="flex items-center gap-1">
                <Minus className="h-3 w-3 text-amber-600" />
                <span className="text-amber-700 dark:text-amber-400">Medium: {mediumConfidenceItems.length}</span>
              </div>
              <div className="flex items-center gap-1">
                <TrendingDown className="h-3 w-3 text-red-600" />
                <span className="text-red-700 dark:text-red-400">Low: {lowConfidenceItems.length}</span>
              </div>
              <span className="ml-auto">
                Showing {filteredItems.length} of {items.length} items
              </span>
            </div>

            <Progress 
              value={(confirmedItems.length / Math.max(items.length, 1)) * 100} 
              className="h-2"
            />

            {viewMode === 'spreadsheet' ? (
              <div className="min-h-[500px]">
                <PLReviewGrid
                  projectId={projectId}
                  uploadId={upload.id}
                  onApplyToModeling={() => setCurrentStep(4)}
                  statusFilter={statusFilter}
                />
              </div>
            ) : viewMode === 'grouped' ? (
              <ScrollArea className="h-[500px]">
                <div className="space-y-4">
                  {itemsLoading ? (
                    <div className="flex justify-center py-8">
                      <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
                    </div>
                  ) : (
                    Array.from(itemsByCategory.entries()).map(([catId, catItems]) => {
                      const category = categories.find(c => c.id === catId);
                      const categoryName = category?.name || (catId === "uncategorized" ? "Uncategorized" : "Unknown");
                      const filteredCatItems = catItems.filter(matchesFilter);
                      if (filteredCatItems.length === 0) return null;
                      const isExpanded = expandedCategories.has(catId);
                      const confirmedCount = filteredCatItems.filter(i => i.status === "confirmed").length;
                      const pendingCount = filteredCatItems.filter(i => i.status === "pending").length;
                      const totalAmount = filteredCatItems.reduce((sum, i) => sum + (parseFloat(i.amount || "0")), 0);
                      
                      return (
                        <Collapsible key={catId} open={isExpanded} onOpenChange={() => toggleCategoryExpanded(catId)}>
                          <CollapsibleTrigger asChild>
                            <button className="w-full flex items-center justify-between p-3 bg-muted/50 rounded-lg hover:bg-muted/70 transition-colors">
                              <div className="flex items-center gap-3">
                                {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                <span className="font-medium">{categoryName}</span>
                                <Badge variant="outline" className="text-xs">
                                  {filteredCatItems.length} items
                                </Badge>
                                {confirmedCount > 0 && (
                                  <Badge className="bg-green-100 text-green-700 text-xs">
                                    {confirmedCount} confirmed
                                  </Badge>
                                )}
                                {pendingCount > 0 && (
                                  <Badge className="bg-amber-100 text-amber-700 text-xs">
                                    {pendingCount} pending
                                  </Badge>
                                )}
                              </div>
                              <span className="font-mono text-sm">{formatAmount(totalAmount)}</span>
                            </button>
                          </CollapsibleTrigger>
                          <CollapsibleContent className="mt-2 pl-7 space-y-2">
                            {filteredCatItems.map((item) => (
                              <div
                                key={item.id}
                                className={`flex items-center justify-between p-2 border rounded-md text-sm ${
                                  item.status === "confirmed" ? "bg-green-50 border-green-200 dark:bg-green-950/30" :
                                  item.status === "rejected" ? "bg-red-50 border-red-200 dark:bg-red-950/30" :
                                  item.status === "excluded" ? "bg-gray-50 border-gray-200 opacity-60" :
                                  "bg-background"
                                }`}
                              >
                                <div className="flex-1 min-w-0">
                                  <p className="truncate">{sanitizeDisplayText(item.rawText)}</p>
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                  <span className="font-mono">{formatAmount(item.amount)}</span>
                                  {getConfidenceBadge(item.confidenceScore)}
                                  {item.status === "pending" && (
                                    <div className="flex gap-1">
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6 text-green-600 hover:bg-green-100"
                                        onClick={() => {
                                          if (item.categorySuggested) {
                                            confirmItemMutation.mutate({
                                              itemId: item.id,
                                              categoryId: item.categorySuggested,
                                              amount: item.amount ? parseFloat(item.amount) : undefined,
                                              department: item.departmentSuggested || undefined,
                                            });
                                          }
                                        }}
                                        disabled={!item.categorySuggested}
                                      >
                                        <Check className="h-3 w-3" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6 text-red-600 hover:bg-red-100"
                                        onClick={() => rejectItemMutation.mutate(item.id)}
                                      >
                                        <X className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  )}
                                  {item.status === "confirmed" && <Check className="h-4 w-4 text-green-600" />}
                                  {item.status === "rejected" && <X className="h-4 w-4 text-red-600" />}
                                </div>
                              </div>
                            ))}
                          </CollapsibleContent>
                        </Collapsible>
                      );
                    })
                  )}
                </div>
              </ScrollArea>
            ) : viewMode === 'table' ? (
              <div className="border rounded-lg overflow-hidden">
                <div className="max-h-[500px] overflow-auto">
                  <table className="w-full">
                    <thead className="bg-muted/50 sticky top-0 z-10">
                      <tr>
                        <th className="p-3 w-10 bg-muted/50">
                          <Checkbox
                            checked={filteredItems.filter(i => i.status !== "excluded").length > 0 && filteredItems.filter(i => i.status !== "excluded").every(i => selectedItems.has(i.id))}
                            onCheckedChange={toggleSelectAll}
                          />
                        </th>
                        <th className="text-left p-3 font-medium text-sm bg-muted/50">Status</th>
                        <th className="text-left p-3 font-medium text-sm bg-muted/50">Category</th>
                        <th className="text-left p-3 font-medium text-sm bg-muted/50">Department</th>
                        <th className="text-left p-3 font-medium text-sm bg-muted/50">Line Item</th>
                        <th className="text-right p-3 font-medium text-sm bg-muted/50">Amount</th>
                        <th className="text-center p-3 font-medium text-sm bg-muted/50">Confidence</th>
                        <th className="text-center p-3 font-medium text-sm bg-muted/50">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {itemsLoading ? (
                        <tr>
                          <td colSpan={8} className="text-center py-8">
                            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto" />
                          </td>
                        </tr>
                      ) : filteredItems.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="text-center py-8 text-muted-foreground">
                            No items match your filter criteria
                          </td>
                        </tr>
                      ) : (
                        filteredItems.map((item) => (
                        <tr 
                          key={item.id}
                          className={`border-t ${
                            item.status === "confirmed" ? "bg-green-50 dark:bg-green-950/30" :
                            item.status === "rejected" ? "bg-red-50 dark:bg-red-950/30" :
                            item.status === "excluded" ? "bg-gray-50 dark:bg-gray-950/30 opacity-60" :
                            "hover:bg-muted/30"
                          }`}
                          data-testid={`table-row-${item.id}`}
                        >
                          <td className="p-3">
                            <Checkbox
                              checked={selectedItems.has(item.id)}
                              onCheckedChange={() => toggleSelectItem(item.id)}
                              disabled={item.status === "excluded"}
                            />
                          </td>
                          <td className="p-3">
                            {item.status === "pending" && (
                              <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-100 text-xs">
                                <Clock className="h-3 w-3 mr-1" />
                                Pending
                              </Badge>
                            )}
                            {item.status === "confirmed" && (
                              <Badge className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-100 text-xs">
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                Confirmed
                              </Badge>
                            )}
                            {item.status === "rejected" && (
                              <Badge className="bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-100 text-xs">
                                <XCircle className="h-3 w-3 mr-1" />
                                Rejected
                              </Badge>
                            )}
                            {item.status === "excluded" && (
                              <Badge className="bg-gray-100 text-gray-700 dark:bg-gray-900 dark:text-gray-100 text-xs">
                                <MinusCircle className="h-3 w-3 mr-1" />
                                Excluded
                              </Badge>
                            )}
                          </td>
                          <td className="p-3 text-sm">
                            {categories.find(c => c.id === (item.categoryConfirmed || item.categorySuggested))?.name || '-'}
                          </td>
                          <td className="p-3 text-sm">
                            {getDepartmentLabel(item.departmentConfirmed || item.departmentSuggested) || '-'}
                          </td>
                          <td className="p-3 text-sm max-w-[300px] truncate" title={sanitizeDisplayText(item.rawText)}>
                            {sanitizeDisplayText(item.rawText)}
                          </td>
                          <td className="p-3 text-sm text-right font-mono">
                            {formatAmount(item.amountConfirmed || item.amount)}
                          </td>
                          <td className="p-3 text-center">
                            {getConfidenceBadge(item.confidenceScore)}
                          </td>
                          <td className="p-3 text-center">
                            {item.status === "pending" && (
                              <div className="flex justify-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-green-600 hover:text-green-700 hover:bg-green-100"
                                  onClick={() => {
                                    if (item.categorySuggested) {
                                      confirmItemMutation.mutate({
                                        itemId: item.id,
                                        categoryId: item.categorySuggested,
                                        amount: item.amount ? parseFloat(item.amount) : undefined,
                                        department: item.departmentSuggested || undefined,
                                      });
                                    }
                                  }}
                                  disabled={!item.categorySuggested}
                                  data-testid={`table-confirm-${item.id}`}
                                >
                                  <Check className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-red-600 hover:text-red-700 hover:bg-red-100"
                                  onClick={() => rejectItemMutation.mutate(item.id)}
                                  data-testid={`table-reject-${item.id}`}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            ) : (
            <ScrollArea className="h-[500px]">
              <div className="space-y-2">
                {itemsLoading ? (
                  <div className="flex justify-center py-8">
                    <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
                  </div>
                ) : filteredItems.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No items match your filter criteria
                  </div>
                ) : (
                  filteredItems.map((item) => (
                    <div
                      key={item.id}
                      className={`p-3 border rounded-lg transition-colors ${
                        item.status === "confirmed" ? "bg-green-50 border-green-200 dark:bg-green-950/50 dark:border-green-800" :
                        item.status === "rejected" ? "bg-red-50 border-red-200 dark:bg-red-950/50 dark:border-red-800" :
                        item.status === "excluded" ? "bg-gray-50 border-gray-200 dark:bg-gray-950/50 dark:border-gray-800 opacity-60" :
                        "bg-background hover:bg-muted/50"
                      }`}
                      data-testid={`item-row-${item.id}`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          <Checkbox
                            checked={selectedItems.has(item.id)}
                            onCheckedChange={() => toggleSelectItem(item.id)}
                            disabled={item.status === "excluded"}
                            className="mt-1"
                          />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{sanitizeDisplayText(item.rawText)}</p>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <span className="text-sm font-mono">{formatAmount(item.amount)}</span>
                            {item.sourcePage && <span className="text-xs text-muted-foreground">Page {item.sourcePage}</span>}
                            <span className="text-xs text-muted-foreground">Row {item.sourceRow}</span>
                            {(item.departmentConfirmed || item.departmentSuggested) && (
                              <Badge variant="outline" className="text-xs">
                                <Building2 className="h-3 w-3 mr-1" />
                                {getDepartmentLabel(item.departmentConfirmed || item.departmentSuggested)}
                              </Badge>
                            )}
                          </div>
                        </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {getConfidenceBadge(item.confidenceScore)}
                          {item.status === "pending" && (
                            <>
                              <Select
                                value={item.categorySuggested || ""}
                                onValueChange={(categoryId) => {
                                  confirmItemMutation.mutate({
                                    itemId: item.id,
                                    categoryId,
                                    amount: item.amount ? parseFloat(item.amount) : undefined,
                                  });
                                }}
                              >
                                <SelectTrigger className="w-40" data-testid={`select-category-${item.id}`}>
                                  <SelectValue placeholder="Category">
                                    {item.suggestedCategory?.name || "Select..."}
                                  </SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                  {getCategoryOptions().map(parent => (
                                    <div key={parent.id}>
                                      <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">
                                        {parent.name}
                                      </div>
                                      {parent.children.map(child => (
                                        <SelectItem key={child.id} value={child.id}>
                                          {child.name}
                                        </SelectItem>
                                      ))}
                                    </div>
                                  ))}
                                </SelectContent>
                              </Select>
                              <Select
                                value={item.departmentSuggested || ""}
                                onValueChange={(dept) => {
                                  if (item.categorySuggested) {
                                    confirmItemMutation.mutate({
                                      itemId: item.id,
                                      categoryId: item.categorySuggested,
                                      amount: item.amount ? parseFloat(item.amount) : undefined,
                                      department: dept,
                                    });
                                  }
                                }}
                              >
                                <SelectTrigger className="w-36" data-testid={`select-department-${item.id}`}>
                                  <SelectValue placeholder="Dept">
                                    {getDepartmentLabel(item.departmentSuggested) || "Select..."}
                                  </SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                  {DEPARTMENTS.map(dept => (
                                    <SelectItem key={dept.value} value={dept.value}>
                                      {dept.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-green-600 hover:text-green-700 hover:bg-green-100"
                                onClick={() => {
                                  if (item.categorySuggested) {
                                    confirmItemMutation.mutate({
                                      itemId: item.id,
                                      categoryId: item.categorySuggested,
                                      amount: item.amount ? parseFloat(item.amount) : undefined,
                                      department: item.departmentSuggested || undefined,
                                    });
                                  }
                                }}
                                disabled={!item.categorySuggested}
                                data-testid={`button-confirm-${item.id}`}
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-red-600 hover:text-red-700 hover:bg-red-100"
                                onClick={() => rejectItemMutation.mutate(item.id)}
                                data-testid={`button-reject-${item.id}`}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                          {item.status === "confirmed" && (
                            <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
                              <Check className="h-3 w-3 mr-1" />
                              {item.confirmedCategory?.name || "Confirmed"}
                            </Badge>
                          )}
                          {item.status === "rejected" && (
                            <Badge variant="secondary" className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100">
                              <X className="h-3 w-3 mr-1" />
                              Rejected
                            </Badge>
                          )}
                          {item.status === "excluded" && (
                            <Badge variant="secondary" className="bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-100">
                              Excluded
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
            )}
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => setCurrentStep(2)} data-testid="button-back-step3">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <Button 
                onClick={() => setCurrentStep(4)} 
                disabled={confirmedItems.length === 0}
                data-testid="button-next-step4"
              >
                Preview Variance
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {currentStep === 4 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Step 4: Variance Preview
            </CardTitle>
            <CardDescription>
              Review how this import will affect your P&L data before applying
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-blue-50 dark:bg-blue-950/50 p-4 rounded-lg text-center">
                <p className="text-2xl font-bold text-blue-600">{confirmedItems.length}</p>
                <p className="text-sm text-muted-foreground">Items to Import</p>
              </div>
              <div className="bg-green-50 dark:bg-green-950/50 p-4 rounded-lg text-center">
                <p className="text-2xl font-bold text-green-600">{formatAmount(totalImportAmount)}</p>
                <p className="text-sm text-muted-foreground">Total Amount</p>
              </div>
              <div className={`p-4 rounded-lg text-center ${totalVariance >= 0 ? "bg-green-50 dark:bg-green-950/50" : "bg-red-50 dark:bg-red-950/50"}`}>
                <p className={`text-2xl font-bold ${totalVariance >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {formatAmount(totalVariance)}
                </p>
                <p className="text-sm text-muted-foreground">Net Variance</p>
              </div>
            </div>

            <div className="border rounded-lg">
              <div className="bg-muted/50 p-3 border-b">
                <h4 className="font-medium">Category Impact Analysis</h4>
              </div>
              <ScrollArea className="h-[350px]">
                <div className="divide-y">
                  {varianceData.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground">
                      No variance data to display. Confirm items in the previous step.
                    </div>
                  ) : (
                    varianceData.map((variance) => (
                      <Collapsible 
                        key={variance.categoryId}
                        open={expandedCategories.has(variance.categoryId)}
                        onOpenChange={() => toggleCategoryExpanded(variance.categoryId)}
                      >
                        <CollapsibleTrigger asChild>
                          <div className="p-3 hover:bg-muted/50 cursor-pointer">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                {expandedCategories.has(variance.categoryId) ? (
                                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                ) : (
                                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                )}
                                <div>
                                  <p className="font-medium">{variance.categoryName}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {variance.itemCount} items • {variance.categoryType}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-4 text-right">
                                <div>
                                  <p className="text-sm text-muted-foreground">Current</p>
                                  <p className="font-mono">{formatAmount(variance.currentAmount)}</p>
                                </div>
                                <div>
                                  <p className="text-sm text-muted-foreground">Import</p>
                                  <p className="font-mono">{formatAmount(variance.importAmount)}</p>
                                </div>
                                <div className="min-w-[100px]">
                                  <p className="text-sm text-muted-foreground">Variance</p>
                                  <p className={`font-mono font-bold ${variance.variance >= 0 ? "text-green-600" : "text-red-600"}`}>
                                    {formatAmount(variance.variance)}
                                  </p>
                                  <p className={`text-xs ${variance.variance >= 0 ? "text-green-600" : "text-red-600"}`}>
                                    {formatPercent(variance.variancePercent)}
                                  </p>
                                </div>
                                {Math.abs(variance.variancePercent) > 25 && (
                                  <AlertTriangle className="h-5 w-5 text-yellow-500" />
                                )}
                              </div>
                            </div>
                          </div>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <div className="px-8 pb-3 space-y-1">
                            {itemsByCategory.get(variance.categoryId)?.filter(i => i.status === "confirmed").map(item => (
                              <div key={item.id} className="flex justify-between text-sm p-2 bg-muted/30 rounded">
                                <span className="truncate max-w-[300px]">{sanitizeDisplayText(item.rawText)}</span>
                                <span className="font-mono">{formatAmount(item.amountConfirmed || item.amount)}</span>
                              </div>
                            ))}
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    ))
                  )}
                </div>
              </ScrollArea>
            </div>

            {varianceData.some(v => Math.abs(v.variancePercent) > 50) && (
              <div className="bg-yellow-50 dark:bg-yellow-950/50 border border-yellow-200 dark:border-yellow-800 p-4 rounded-lg flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-yellow-800 dark:text-yellow-200">Large variance detected</p>
                  <p className="text-sm text-yellow-700 dark:text-yellow-300">
                    Some categories show significant variance (&gt;50%). Please review carefully before proceeding.
                  </p>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setCurrentStep(3)} data-testid="button-back-step4">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Review
              </Button>
              <Button 
                onClick={() => setCurrentStep(5)}
                data-testid="button-next-step5"
              >
                Proceed to Approval
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {currentStep === 5 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5" />
              Step 5: Approve & Apply
            </CardTitle>
            <CardDescription>
              Finalize the import and write {confirmedItems.length} line items to your P&L data
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-green-50 dark:bg-green-950/50 p-4 rounded-lg text-center">
                <p className="text-3xl font-bold text-green-600">{confirmedItems.length}</p>
                <p className="text-sm text-muted-foreground">Items to Import</p>
              </div>
              <div className="bg-muted p-4 rounded-lg text-center">
                <p className="text-3xl font-bold">{rejectedItems.length}</p>
                <p className="text-sm text-muted-foreground">Items Rejected</p>
              </div>
              <div className="bg-muted p-4 rounded-lg text-center">
                <p className="text-3xl font-bold">{pendingItems.length}</p>
                <p className="text-sm text-muted-foreground">Items Skipped</p>
              </div>
              <div className="bg-blue-50 dark:bg-blue-950/50 p-4 rounded-lg text-center">
                <p className="text-3xl font-bold text-blue-600">{formatAmount(totalImportAmount)}</p>
                <p className="text-sm text-muted-foreground">Total Value</p>
              </div>
            </div>

            <div className="bg-muted p-4 rounded-lg space-y-3">
              <h4 className="font-medium">Import Details</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Target: P&L Lines for this Modeling Project</li>
                <li>• Fiscal Year: {upload.year || "Not specified"}</li>
                <li>• Source Document: {upload.originalName}</li>
                <li>• Categories and departments will be preserved</li>
                <li>• Line item links will be maintained for audit trail</li>
              </ul>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Approval Notes</label>
              <Textarea
                placeholder="Add any notes about this import for audit purposes..."
                value={approvalNotes}
                onChange={(e) => setApprovalNotes(e.target.value)}
                className="h-20"
                data-testid="input-approval-notes"
              />
            </div>

            {upload.status === 'approved' && (
              <div className="bg-green-50 dark:bg-green-950/50 border border-green-200 dark:border-green-800 p-4 rounded-lg flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-green-800 dark:text-green-200">Document Approved</p>
                  <p className="text-sm text-green-700 dark:text-green-300">
                    This document has been approved. Click "Apply to P&L" to write the data.
                  </p>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setCurrentStep(4)} data-testid="button-back-step5">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Preview
              </Button>
              {upload.status !== 'approved' && upload.status !== 'applied' && upload.status !== 'completed' && (
                <Button 
                  variant="outline"
                  onClick={() => approveMutation.mutate()}
                  disabled={approveMutation.isPending || confirmedItems.length === 0}
                  data-testid="button-approve"
                >
                  {approveMutation.isPending ? "Approving..." : "Approve"}
                  <Check className="h-4 w-4 ml-2" />
                </Button>
              )}
              <Button 
                onClick={() => importMutation.mutate()} 
                disabled={importMutation.isPending || confirmedItems.length === 0}
                data-testid="button-import"
              >
                {importMutation.isPending ? "Applying..." : "Apply to P&L"}
                <Download className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
