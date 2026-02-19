import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { 
  ArrowLeft, Upload, FileSpreadsheet, Brain, CheckCircle2, AlertCircle, 
  Clock, Settings, Inbox, Trash2, Eye, Loader2, MoreVertical, RefreshCw,
  FileText
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { MultiDocumentReview } from "./MultiDocumentReview";
import { CategoryManager } from "./CategoryManager";
import { HoldingStation } from "./HoldingStation";
import type { DocIntelUpload, PnlCategory, CustomDocumentType } from "@shared/schema";

interface UploadWithStats extends DocIntelUpload {
  stats?: {
    total: number;
    pending: number;
    confirmed: number;
    rejected: number;
    needsReview: number;
    highConfidence: number;
    lowConfidence: number;
  };
}

const BUILTIN_DOC_TYPES: Record<string, string> = {
  pnl: "P&L Statement",
  rent_roll: "Rent Roll",
  balance_sheet: "Balance Sheet",
  rate_sheet: "Rate Sheet",
  invoice: "Invoice",
  other: "Other",
};

export default function DocumentIntelligence() {
  const { projectId } = useParams<{ projectId: string }>();
  const [location, navigate] = useLocation();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("upload");
  
  const [isMultiReviewMode, setIsMultiReviewMode] = useState(false);
  const [initialDocumentId, setInitialDocumentId] = useState<string | null>(null);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleteConfirmName, setDeleteConfirmName] = useState<string>("");

  useEffect(() => {
    const fullUrl = window.location.href;
    let uploadParam: string | null = null;
    
    const urlParams = new URLSearchParams(window.location.search);
    uploadParam = urlParams.get('upload');
    
    if (!uploadParam && fullUrl.includes('%3F')) {
      const decodedUrl = decodeURIComponent(fullUrl);
      const queryStart = decodedUrl.indexOf('?');
      if (queryStart !== -1) {
        const queryString = decodedUrl.substring(queryStart + 1);
        const params = new URLSearchParams(queryString);
        uploadParam = params.get('upload');
      }
    }
    
    if (uploadParam) {
      const ids = uploadParam.split(',').filter(Boolean);
      if (ids.length > 0) {
        setInitialDocumentId(ids[0]);
        setIsMultiReviewMode(true);
      }
    }
  }, [location]);

  const { data: uploads = [], isLoading: uploadsLoading } = useQuery<UploadWithStats[]>({
    queryKey: ["/api/modeling/projects", projectId, "documents"],
    enabled: !!projectId,
    refetchInterval: isMultiReviewMode ? 2000 : false,
  });

  const { data: categories = [] } = useQuery<PnlCategory[]>({
    queryKey: ["/api/modeling/doc-intel/categories"],
  });

  const { data: holdingQueue = [], isLoading: holdingLoading } = useQuery<DocIntelUpload[]>({
    queryKey: ["/api/modeling/projects", projectId, "documents", "holding"],
    queryFn: async () => {
      const res = await fetch(`/api/modeling/projects/${projectId}/documents?holdingOnly=true`);
      if (!res.ok) throw new Error("Failed to fetch holding queue");
      return res.json();
    },
    enabled: !!projectId,
    refetchInterval: (data) => {
      const hasProcessing = data?.state?.data?.some(
        (doc) => doc.status === "uploaded" || doc.status === "processing"
      );
      return hasProcessing ? 2000 : false;
    },
  });

  const { data: customDocTypes = [] } = useQuery<CustomDocumentType[]>({
    queryKey: ["/api/doc-intel/custom-document-types"],
  });

  const pnlDocuments = holdingQueue.filter((doc) => doc.docType === "pnl");
  const parsedPnlDocuments = pnlDocuments.filter(
    (doc) => doc.status === "parsed" || doc.status === "reviewing"
  );
  const processingPnlDocuments = pnlDocuments.filter(
    (doc) => doc.status === "uploaded" || doc.status === "processing"
  );
  const allPnlReady = pnlDocuments.length > 0 && 
    processingPnlDocuments.length === 0 && 
    parsedPnlDocuments.length === pnlDocuments.length;

  const initMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/modeling/doc-intel/init");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/modeling/doc-intel/categories"] });
      toast({ title: "Initialized", description: "Default categories and patterns have been created." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to initialize document intelligence.", variant: "destructive" });
    },
  });

  const deleteDocumentMutation = useMutation({
    mutationFn: async (documentId: string) => {
      return apiRequest("DELETE", `/api/modeling/projects/${projectId}/documents/${documentId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/modeling/projects", projectId, "documents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/modeling/projects", projectId, "documents", "holding"] });
      setDeleteConfirmId(null);
      setDeleteConfirmName("");
      toast({ title: "Deleted", description: "Document has been removed." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete document.", variant: "destructive" });
    },
  });

  const retryParseMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("POST", `/api/modeling/projects/${projectId}/documents/${id}/retry`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/modeling/projects", projectId, "documents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/modeling/projects", projectId, "documents", "holding"] });
      toast({ title: "Retrying", description: "Document has been queued for re-processing." });
    },
    onError: (error: any) => {
      toast({ title: "Retry failed", description: error.message || "Could not retry parsing", variant: "destructive" });
    },
  });

  const handleReviewDocuments = (documentIds: string[]) => {
    if (documentIds.length === 0) return;
    setInitialDocumentId(documentIds[0]);
    setIsMultiReviewMode(true);
  };

  const handleStartReview = () => {
    const readyIds = parsedPnlDocuments.map((doc) => doc.id);
    if (readyIds.length === 0) return;
    handleReviewDocuments(readyIds);
  };

  const handleCloseMultiReview = () => {
    setInitialDocumentId(null);
    setIsMultiReviewMode(false);
    queryClient.invalidateQueries({ queryKey: ["/api/modeling/projects", projectId, "documents"] });
    queryClient.invalidateQueries({ queryKey: ["/api/modeling/projects", projectId, "documents", "holding"] });
  };

  const handleReviewComplete = () => {
    setInitialDocumentId(null);
    setIsMultiReviewMode(false);
    queryClient.invalidateQueries({ queryKey: ["/api/modeling/projects", projectId, "documents"] });
    queryClient.invalidateQueries({ queryKey: ["/api/modeling/projects", projectId, "documents", "holding"] });
    queryClient.invalidateQueries({ queryKey: ["/api/modeling/projects", projectId, "actuals"] });
    toast({ title: "Import complete", description: "All documents have been imported. Redirecting to Historical P&L..." });
    navigate(`/modeling/projects/${projectId}?tab=historical`);
  };

  const handleUploadComplete = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/modeling/projects", projectId, "documents", "holding"] });
    setActiveTab("review");
    toast({ title: "P&L documents queued", description: "Your P&L documents are now in the Review queue." });
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleBatchDelete = async () => {
    for (const id of selectedIds) {
      await deleteDocumentMutation.mutateAsync(id);
    }
    setSelectedIds(new Set());
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getDocTypeLabel = (docType: string) => {
    if (BUILTIN_DOC_TYPES[docType]) return BUILTIN_DOC_TYPES[docType];
    const custom = customDocTypes.find(t => t.id === docType || t.name === docType);
    return custom?.name || docType;
  };

  if (isMultiReviewMode && uploads.length > 0) {
    return (
      <MultiDocumentReview
        projectId={projectId!}
        uploads={uploads}
        categories={categories}
        onClose={handleCloseMultiReview}
        onComplete={handleReviewComplete}
        initialDocumentId={initialDocumentId}
      />
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(`/modeling/projects/${projectId}`)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold" data-testid="page-title">Document Intelligence</h1>
            <p className="text-muted-foreground">AI-powered P&L and Rent Roll import with smart categorization</p>
          </div>
        </div>
        {categories.length === 0 && (
          <Button onClick={() => initMutation.mutate()} disabled={initMutation.isPending} data-testid="button-initialize">
            {initMutation.isPending ? "Initializing..." : "Initialize Categories"}
          </Button>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="upload" data-testid="tab-upload">
            <Upload className="h-4 w-4 mr-2" />
            Upload Documents
          </TabsTrigger>
          <TabsTrigger value="review" data-testid="tab-review" className="relative">
            <Eye className="h-4 w-4 mr-2" />
            Review Documents
            {pnlDocuments.length > 0 && (
              <Badge variant="secondary" className="ml-2 h-5 px-1.5 text-[10px]">
                {pnlDocuments.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="categories" data-testid="tab-categories">
            <Settings className="h-4 w-4 mr-2" />
            Categories & Aliases
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upload" className="space-y-6">
          <HoldingStation
            projectId={projectId!}
            onReviewDocuments={handleReviewDocuments}
            onUploadComplete={handleUploadComplete}
          />
        </TabsContent>

        <TabsContent value="review" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <FileSpreadsheet className="h-5 w-5" />
                    P&L Review Queue
                    {processingPnlDocuments.length > 0 && (
                      <Badge variant="secondary" className="ml-2">
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                        {processingPnlDocuments.length} processing
                      </Badge>
                    )}
                  </CardTitle>
                  <CardDescription>
                    P&L documents uploaded and awaiting review. Click "Review Documents" to start confirming line items.
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  {selectedIds.size > 0 && (
                    <Button variant="destructive" size="sm" onClick={handleBatchDelete}>
                      <Trash2 className="h-4 w-4 mr-1" />
                      Delete ({selectedIds.size})
                    </Button>
                  )}
                  {allPnlReady && parsedPnlDocuments.length > 0 && (
                    <Button onClick={handleStartReview} size="lg">
                      <Brain className="h-4 w-4 mr-2" />
                      Review Documents ({parsedPnlDocuments.length})
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {holdingLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : pnlDocuments.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <FileSpreadsheet className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="font-medium">No P&L Documents in Queue</p>
                  <p className="text-sm mt-1">Upload P&L documents from the Upload tab — they will appear here automatically.</p>
                  <Button 
                    variant="outline" 
                    className="mt-4"
                    onClick={() => setActiveTab("upload")}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Go to Upload
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  {pnlDocuments.map((doc) => (
                    <div
                      key={doc.id}
                      className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <Checkbox
                        checked={selectedIds.has(doc.id)}
                        onCheckedChange={() => toggleSelect(doc.id)}
                      />
                      {doc.originalName?.endsWith(".pdf") ? (
                        <FileText className="h-8 w-8 text-red-600 flex-shrink-0" />
                      ) : (
                        <FileSpreadsheet className="h-8 w-8 text-green-600 flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{doc.originalName}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{getDocTypeLabel(doc.docType || "pnl")}</span>
                          {doc.year && <span>• {doc.year}</span>}
                          <span>• {formatFileSize(doc.fileSize)}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge 
                          variant={
                            doc.status === "parsed" || doc.status === "reviewing" ? "default" : 
                            doc.status === "error" ? "destructive" : "secondary"
                          } 
                          className="text-xs"
                        >
                          {doc.status === "uploaded" && <Clock className="h-3 w-3 mr-1" />}
                          {doc.status === "processing" && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                          {(doc.status === "parsed" || doc.status === "reviewing") && <CheckCircle2 className="h-3 w-3 mr-1" />}
                          {doc.status === "error" && <AlertCircle className="h-3 w-3 mr-1" />}
                          {doc.status === "uploaded" ? "Queued" : 
                           doc.status === "processing" ? "Processing..." : 
                           doc.status === "parsed" || doc.status === "reviewing" ? "Ready for Review" :
                           doc.status === "error" ? "Error" :
                           doc.status}
                        </Badge>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {(doc.status === "uploaded" || doc.status === "processing" || doc.status === "error") && (
                              <DropdownMenuItem 
                                onClick={() => retryParseMutation.mutate(doc.id)}
                                disabled={retryParseMutation.isPending}
                              >
                                <RefreshCw className="h-4 w-4 mr-2" />
                                Retry Processing
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onClick={() => {
                              setDeleteConfirmId(doc.id);
                              setDeleteConfirmName(doc.originalName || "this document");
                            }}>
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="categories">
          <CategoryManager />
        </TabsContent>
      </Tabs>

      <AlertDialog open={!!deleteConfirmId} onOpenChange={(open) => {
        if (!open) {
          setDeleteConfirmId(null);
          setDeleteConfirmName("");
        }
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Document</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteConfirmName}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteConfirmId) {
                  deleteDocumentMutation.mutate(deleteConfirmId);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteDocumentMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
