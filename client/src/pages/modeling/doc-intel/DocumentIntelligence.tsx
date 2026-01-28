import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { ArrowLeft, Upload, FileSpreadsheet, Brain, CheckCircle2, AlertCircle, Clock, Settings, Inbox, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { UploadDropzone } from "./UploadDropzone";
import { MultiDocumentReview } from "./MultiDocumentReview";
import { CategoryManager } from "./CategoryManager";
import { HoldingStation } from "./HoldingStation";
import type { DocIntelUpload, PnlCategory } from "@shared/schema";

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

export default function DocumentIntelligence() {
  const { projectId } = useParams<{ projectId: string }>();
  const [location, navigate] = useLocation();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("holding");
  
  // Multi-document review state
  const [reviewingDocumentIds, setReviewingDocumentIds] = useState<string[]>([]);
  const [isMultiReviewMode, setIsMultiReviewMode] = useState(false);

  // Read upload parameter from URL on mount
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
    
    // Handle comma-separated list of upload IDs
    if (uploadParam) {
      const ids = uploadParam.split(',').filter(Boolean);
      if (ids.length > 0) {
        setReviewingDocumentIds(ids);
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
      toast({ title: "Deleted", description: "Document has been removed." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete document.", variant: "destructive" });
    },
  });

  const deleteAllDocumentsMutation = useMutation({
    mutationFn: async () => {
      const deletePromises = uploads.map(upload => 
        apiRequest("DELETE", `/api/modeling/projects/${projectId}/documents/${upload.id}`)
      );
      return Promise.all(deletePromises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/modeling/projects", projectId, "documents"] });
      toast({ title: "All deleted", description: "All documents have been removed." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete documents.", variant: "destructive" });
    },
  });

  const handleDeleteDocument = (e: React.MouseEvent, documentId: string) => {
    e.stopPropagation();
    if (confirm("Are you sure you want to delete this document?")) {
      deleteDocumentMutation.mutate(documentId);
    }
  };

  const handleDeleteAll = () => {
    if (confirm(`Are you sure you want to delete all ${uploads.length} documents?`)) {
      deleteAllDocumentsMutation.mutate();
    }
  };

  /**
   * Called from HoldingStation when user clicks "Review All"
   * Enters multi-document review mode with tabs
   */
  const handleReviewDocuments = (documentIds: string[]) => {
    if (documentIds.length === 0) return;
    setReviewingDocumentIds(documentIds);
    setIsMultiReviewMode(true);
  };

  /**
   * Exit multi-document review mode
   */
  const handleCloseMultiReview = () => {
    setReviewingDocumentIds([]);
    setIsMultiReviewMode(false);
    queryClient.invalidateQueries({ queryKey: ["/api/modeling/projects", projectId, "documents"] });
  };

  /**
   * Called when all documents have been applied to the model
   */
  const handleReviewComplete = () => {
    setReviewingDocumentIds([]);
    setIsMultiReviewMode(false);
    queryClient.invalidateQueries({ queryKey: ["/api/modeling/projects", projectId, "documents"] });
    toast({ title: "Import complete", description: "All documents have been imported to your model." });
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ReactNode; label: string }> = {
      uploaded: { variant: "secondary", icon: <Clock className="h-3 w-3" />, label: "Pending" },
      processing: { variant: "default", icon: <Clock className="h-3 w-3 animate-spin" />, label: "Processing" },
      parsed: { variant: "outline", icon: <FileSpreadsheet className="h-3 w-3" />, label: "Parsed" },
      reviewing: { variant: "default", icon: <Brain className="h-3 w-3" />, label: "Reviewing" },
      completed: { variant: "secondary", icon: <CheckCircle2 className="h-3 w-3" />, label: "Completed" },
      error: { variant: "destructive", icon: <AlertCircle className="h-3 w-3" />, label: "Error" },
    };
    const config = statusConfig[status] || statusConfig.uploaded;
    return (
      <Badge variant={config.variant} className="gap-1">
        {config.icon}
        {config.label}
      </Badge>
    );
  };

  // MULTI-DOCUMENT REVIEW MODE
  if (isMultiReviewMode && reviewingDocumentIds.length > 0) {
    const reviewUploads = uploads.filter(u => reviewingDocumentIds.includes(u.id));
    
    return (
      <MultiDocumentReview
        projectId={projectId!}
        uploads={reviewUploads}
        categories={categories}
        onClose={handleCloseMultiReview}
        onComplete={handleReviewComplete}
      />
    );
  }

  // NORMAL VIEW
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
          <TabsTrigger value="holding" data-testid="tab-holding">
            <Inbox className="h-4 w-4 mr-2" />
            Upload & Process
          </TabsTrigger>
          <TabsTrigger value="categories" data-testid="tab-categories">
            <Settings className="h-4 w-4 mr-2" />
            Categories & Aliases
          </TabsTrigger>
        </TabsList>

        <TabsContent value="holding" className="space-y-6">
          <HoldingStation
            projectId={projectId!}
            onReviewDocuments={handleReviewDocuments}
          />
        </TabsContent>

        <TabsContent value="categories">
          <CategoryManager />
        </TabsContent>
      </Tabs>
    </div>
  );
}