import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, FileSpreadsheet, Brain, Check, X, Zap, Download, ListChecks } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
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

const WIZARD_STEPS = [
  { id: 1, title: "Parse Document", description: "Extract line items from file", icon: FileSpreadsheet },
  { id: 2, title: "Auto-Categorize", description: "Apply pattern matching rules", icon: Brain },
  { id: 3, title: "Review Items", description: "Confirm or edit suggestions", icon: ListChecks },
  { id: 4, title: "Import", description: "Save to P&L data", icon: Download },
];

export function ReviewWizard({ projectId, upload, categories, onClose, onComplete }: ReviewWizardProps) {
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(upload.wizardStep || 1);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

  const { data: items = [], isLoading: itemsLoading, refetch: refetchItems } = useQuery<ExtractedItemWithCategory[]>({
    queryKey: ["/api/modeling/projects", projectId, "documents", upload.id, "items", "withCategories=true"],
    enabled: currentStep >= 2,
  });

  const parseMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/modeling/projects/${projectId}/documents/${upload.id}/parse`);
    },
    onSuccess: () => {
      toast({ title: "Parsed successfully", description: "Line items have been extracted from the document." });
      setCurrentStep(2);
    },
    onError: () => {
      toast({ title: "Parse failed", description: "Could not extract items from document.", variant: "destructive" });
    },
  });

  const categorizeMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/modeling/projects/${projectId}/documents/${upload.id}/categorize`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/modeling/projects", projectId, "documents", upload.id, "items"] });
      refetchItems();
      toast({ title: "Categorized", description: "AI has suggested categories for your line items." });
      setCurrentStep(3);
    },
    onError: () => {
      toast({ title: "Categorization failed", description: "Could not apply category rules.", variant: "destructive" });
    },
  });

  const confirmItemMutation = useMutation({
    mutationFn: async ({ itemId, categoryId, amount }: { itemId: string; categoryId: string; amount?: number }) => {
      return apiRequest("POST", `/api/modeling/projects/${projectId}/documents/${upload.id}/items/${itemId}/confirm`, { categoryId, amount });
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

  const autoConfirmMutation = useMutation({
    mutationFn: async (threshold: number) => {
      return apiRequest("POST", `/api/modeling/projects/${projectId}/documents/${upload.id}/items/confirm-high-confidence`, { threshold });
    },
    onSuccess: (data: { confirmed: number }) => {
      refetchItems();
      toast({ title: "Auto-confirmed", description: `${data.confirmed} high-confidence items confirmed.` });
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
  const highConfidenceItems = items.filter(i => i.confidenceScore && parseFloat(i.confidenceScore) >= 0.9);

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
    if (num >= 0.9) return <Badge className="bg-green-100 text-green-800">High ({(num * 100).toFixed(0)}%)</Badge>;
    if (num >= 0.7) return <Badge className="bg-yellow-100 text-yellow-800">Medium ({(num * 100).toFixed(0)}%)</Badge>;
    return <Badge className="bg-red-100 text-red-800">Low ({(num * 100).toFixed(0)}%)</Badge>;
  };

  const formatAmount = (amount: string | null) => {
    if (!amount) return "-";
    const num = parseFloat(amount);
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(num);
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
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

      <div className="flex items-center justify-between bg-muted/50 p-4 rounded-lg">
        {WIZARD_STEPS.map((step, index) => (
          <div key={step.id} className="flex items-center">
            <div className={`flex items-center gap-2 ${step.id <= currentStep ? "text-primary" : "text-muted-foreground"}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                step.id < currentStep ? "bg-primary text-primary-foreground" :
                step.id === currentStep ? "border-2 border-primary" : "border-2 border-muted-foreground/30"
              }`}>
                {step.id < currentStep ? <Check className="h-4 w-4" /> : <step.icon className="h-4 w-4" />}
              </div>
              <div className="hidden md:block">
                <p className="font-medium text-sm">{step.title}</p>
                <p className="text-xs text-muted-foreground">{step.description}</p>
              </div>
            </div>
            {index < WIZARD_STEPS.length - 1 && (
              <Separator className="w-12 mx-4" />
            )}
          </div>
        ))}
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
            <div className="bg-muted p-4 rounded-lg">
              <div className="flex items-center gap-4 mb-4">
                <FileSpreadsheet className="h-12 w-12 text-green-600" />
                <div>
                  <p className="font-medium">{upload.originalName}</p>
                  <p className="text-sm text-muted-foreground">
                    {upload.docType?.toUpperCase()} • {upload.year || "Year not specified"} • {(upload.fileSize / 1024).toFixed(1)} KB
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
                {parseMutation.isPending ? "Parsing..." : "Parse Document"}
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
              Apply AI-powered pattern matching to suggest categories for each line item
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
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
                to suggest the most appropriate P&L category.
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
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Step 3: Review Line Items</CardTitle>
                <CardDescription>
                  Confirm, edit, or reject AI suggestions. {confirmedItems.length} of {items.length} confirmed.
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => autoConfirmMutation.mutate(0.9)}
                  disabled={autoConfirmMutation.isPending || highConfidenceItems.length === 0}
                  data-testid="button-auto-confirm"
                >
                  <Zap className="h-4 w-4 mr-2" />
                  Auto-Confirm High ({highConfidenceItems.length})
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Progress 
              value={(confirmedItems.length / items.length) * 100} 
              className="mb-4 h-2"
            />
            <ScrollArea className="h-[500px]">
              <div className="space-y-2">
                {itemsLoading ? (
                  <div className="flex justify-center py-8">
                    <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
                  </div>
                ) : (
                  items.map((item) => (
                    <div
                      key={item.id}
                      className={`p-3 border rounded-lg ${
                        item.status === "confirmed" ? "bg-green-50 border-green-200 dark:bg-green-950" :
                        item.status === "rejected" ? "bg-red-50 border-red-200 dark:bg-red-950" :
                        "bg-background"
                      }`}
                      data-testid={`item-row-${item.id}`}
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{item.rawText}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-sm font-mono">{formatAmount(item.amount)}</span>
                            {item.sourcePage && <span className="text-xs text-muted-foreground">Page {item.sourcePage}</span>}
                            <span className="text-xs text-muted-foreground">Row {item.sourceRow}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
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
                                <SelectTrigger className="w-48" data-testid={`select-category-${item.id}`}>
                                  <SelectValue placeholder="Select category">
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
                            <Badge variant="secondary" className="bg-green-100 text-green-800">
                              <Check className="h-3 w-3 mr-1" />
                              {item.confirmedCategory?.name || "Confirmed"}
                            </Badge>
                          )}
                          {item.status === "rejected" && (
                            <Badge variant="secondary" className="bg-red-100 text-red-800">
                              <X className="h-3 w-3 mr-1" />
                              Rejected
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
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
                Continue to Import
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {currentStep === 4 && (
        <Card>
          <CardHeader>
            <CardTitle>Step 4: Import to P&L</CardTitle>
            <CardDescription>
              Review summary and import {confirmedItems.length} confirmed line items to your P&L data
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-green-50 dark:bg-green-950 p-4 rounded-lg text-center">
                <p className="text-3xl font-bold text-green-600">{confirmedItems.length}</p>
                <p className="text-sm text-muted-foreground">Items to Import</p>
              </div>
              <div className="bg-muted p-4 rounded-lg text-center">
                <p className="text-3xl font-bold">{items.filter(i => i.status === "rejected").length}</p>
                <p className="text-sm text-muted-foreground">Items Rejected</p>
              </div>
              <div className="bg-muted p-4 rounded-lg text-center">
                <p className="text-3xl font-bold">{pendingItems.length}</p>
                <p className="text-sm text-muted-foreground">Items Skipped</p>
              </div>
            </div>

            <div className="bg-muted p-4 rounded-lg">
              <h4 className="font-medium mb-2">Import Details</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Target: P&L Lines for this Modeling Project</li>
                <li>• Fiscal Year: {upload.year || "Not specified"}</li>
                <li>• Source Document: {upload.originalName}</li>
                <li>• Categories will be preserved with line item links</li>
              </ul>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setCurrentStep(3)} data-testid="button-back-step4">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Review
              </Button>
              <Button 
                onClick={() => importMutation.mutate()} 
                disabled={importMutation.isPending || confirmedItems.length === 0}
                data-testid="button-import"
              >
                {importMutation.isPending ? "Importing..." : "Import to P&L"}
                <Download className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
