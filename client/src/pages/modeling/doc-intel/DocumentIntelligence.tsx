import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation, Link } from "wouter";
import * as XLSX from "xlsx";
import { 
  ArrowLeft, Upload, FileSpreadsheet, Brain, CheckCircle2, AlertCircle, 
  Clock, Settings, Inbox, Trash2, Eye, Loader2, MoreVertical, RefreshCw,
  FileText, ListChecks
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiRequest, queryClient, ensureCsrfToken } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { MultiDocumentReview } from "./MultiDocumentReview";
import { CategoryManager } from "./CategoryManager";
import { HoldingStation } from "./HoldingStation";
import type { DocIntelUpload, PnlCategory, CustomDocumentType } from "@shared/schema";

const MONTHS = [
  { value: "1", label: "Jan" }, { value: "2", label: "Feb" }, { value: "3", label: "Mar" },
  { value: "4", label: "Apr" }, { value: "5", label: "May" }, { value: "6", label: "Jun" },
  { value: "7", label: "Jul" }, { value: "8", label: "Aug" }, { value: "9", label: "Sep" },
  { value: "10", label: "Oct" }, { value: "11", label: "Nov" }, { value: "12", label: "Dec" },
];

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

  const [reuploadDoc, setReuploadDoc] = useState<DocIntelUpload | null>(null);
  const reuploadInputRef = useRef<HTMLInputElement>(null);

  const [reuploadDialogOpen, setReuploadDialogOpen] = useState(false);
  const [reuploadDocType, setReuploadDocType] = useState("pnl");
  const [reuploadCustomTypeName, setReuploadCustomTypeName] = useState("");
  const [reuploadYear, setReuploadYear] = useState(String(new Date().getFullYear()));
  const [reuploadIsT12, setReuploadIsT12] = useState(false);
  const [reuploadT12StartMonth, setReuploadT12StartMonth] = useState("1");
  const [reuploadT12StartYear, setReuploadT12StartYear] = useState(String(new Date().getFullYear() - 1));
  const [reuploadT12EndMonth, setReuploadT12EndMonth] = useState(String(new Date().getMonth() + 1));
  const [reuploadT12EndYear, setReuploadT12EndYear] = useState(String(new Date().getFullYear()));

  const [reuploadPendingFile, setReuploadPendingFile] = useState<File | null>(null);
  const [reuploadSheetSelectorOpen, setReuploadSheetSelectorOpen] = useState(false);
  const [reuploadAvailableSheets, setReuploadAvailableSheets] = useState<{ index: number; name: string; rowCount: number }[]>([]);
  const [reuploadPrevSheetName, setReuploadPrevSheetName] = useState<string | undefined>(undefined);
  const [reuploadStep, setReuploadStep] = useState<"uploading" | "deleting" | "parsing" | null>(null);
  const [reuploadProgress, setReuploadProgress] = useState<number>(0);

  const reuploadStorageKey = projectId ? `doc_intel_reupload_${projectId}` : null;
  const hasRestoredReupload = useRef(false);

  useEffect(() => {
    if (!reuploadDoc || !reuploadStorageKey) return;
    const state = {
      docId: reuploadDoc.id,
      docType: reuploadDocType,
      customTypeName: reuploadCustomTypeName,
      year: reuploadYear,
      isT12: reuploadIsT12,
      t12StartMonth: reuploadT12StartMonth,
      t12StartYear: reuploadT12StartYear,
      t12EndMonth: reuploadT12EndMonth,
      t12EndYear: reuploadT12EndYear,
    };
    sessionStorage.setItem(reuploadStorageKey, JSON.stringify(state));
  }, [
    reuploadDoc, reuploadDocType, reuploadCustomTypeName, reuploadYear, reuploadIsT12,
    reuploadT12StartMonth, reuploadT12StartYear, reuploadT12EndMonth, reuploadT12EndYear,
    reuploadStorageKey,
  ]);

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

  useEffect(() => {
    if (hasRestoredReupload.current || uploadsLoading || holdingLoading || !reuploadStorageKey) return;
    hasRestoredReupload.current = true;
    const stored = sessionStorage.getItem(reuploadStorageKey);
    if (!stored) return;
    try {
      const state = JSON.parse(stored);
      const doc = [...uploads, ...holdingQueue].find((u) => u.id === state.docId);
      if (!doc) {
        sessionStorage.removeItem(reuploadStorageKey);
        return;
      }
      const now = new Date();
      setReuploadDoc(doc);
      setReuploadDocType(state.docType || "pnl");
      setReuploadCustomTypeName(state.customTypeName || "");
      setReuploadYear(state.year || String(now.getFullYear()));
      setReuploadIsT12(!!state.isT12);
      setReuploadT12StartMonth(state.t12StartMonth || "1");
      setReuploadT12StartYear(state.t12StartYear || String(now.getFullYear() - 1));
      setReuploadT12EndMonth(state.t12EndMonth || String(now.getMonth() + 1));
      setReuploadT12EndYear(state.t12EndYear || String(now.getFullYear()));
      setReuploadDialogOpen(true);
    } catch {
      sessionStorage.removeItem(reuploadStorageKey);
    }
  }, [uploadsLoading, holdingLoading, uploads, holdingQueue, reuploadStorageKey]);

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

  const REVIEWABLE_STATUSES = ["parsed", "reviewing", "completed"];
  const reviewablePnlDocuments = pnlDocuments.filter(
    (doc) => REVIEWABLE_STATUSES.includes(doc.status ?? "")
  );
  const selectedReviewableDocs = pnlDocuments.filter(
    (doc) => selectedIds.has(doc.id) && REVIEWABLE_STATUSES.includes(doc.status ?? "")
  );

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

  const reuploadMutation = useMutation({
    mutationFn: async ({ file, doc, sheetName, sheetIndex }: { file: File; doc: DocIntelUpload; sheetName?: string; sheetIndex?: number }) => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("docType", reuploadDocType || doc.docType || "pnl");
      if (reuploadDocType === "other" && reuploadCustomTypeName.trim()) {
        formData.append("customTypeName", reuploadCustomTypeName.trim());
      }
      const effectiveYear = reuploadIsT12
        ? (reuploadT12EndYear || String(new Date().getFullYear()))
        : (reuploadYear || String(doc.year || new Date().getFullYear()));
      formData.append("year", effectiveYear);
      formData.append("holdingStatus", "staging");
      const sheetSuffix = sheetName ? ` → ${sheetName}` : "";
      formData.append("displayName", file.name + sheetSuffix);
      if (reuploadIsT12) {
        formData.append("isT12", "true");
        if (reuploadT12StartMonth) formData.append("t12StartMonth", reuploadT12StartMonth);
        if (reuploadT12StartYear) formData.append("t12StartYear", reuploadT12StartYear);
        if (reuploadT12EndMonth) formData.append("t12EndMonth", reuploadT12EndMonth);
        if (reuploadT12EndYear) formData.append("t12EndYear", reuploadT12EndYear);
      }
      if (sheetName != null) {
        formData.append("sheetName", sheetName);
      }
      if (sheetIndex != null) {
        formData.append("sheetIndex", String(sheetIndex));
      }

      const csrfToken = await ensureCsrfToken();

      setReuploadStep("uploading");
      setReuploadProgress(0);
      const uploaded = await new Promise<DocIntelUpload>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", `/api/modeling/projects/${projectId}/documents`);
        xhr.withCredentials = true;
        if (csrfToken) xhr.setRequestHeader("X-CSRF-Token", csrfToken);
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            setReuploadProgress(Math.round((event.loaded / event.total) * 100));
          }
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              resolve(JSON.parse(xhr.responseText));
            } catch {
              reject(new Error("Invalid response from server"));
            }
          } else {
            try {
              const err = JSON.parse(xhr.responseText);
              reject(new Error(err.error || "Upload failed"));
            } catch {
              reject(new Error("Upload failed"));
            }
          }
        };
        xhr.onerror = () => reject(new Error("Network error during upload"));
        xhr.send(formData);
      });

      setReuploadStep("deleting");
      await apiRequest("DELETE", `/api/modeling/projects/${projectId}/documents/${doc.id}`);

      setReuploadStep("parsing");
      await apiRequest("POST", `/api/modeling/projects/${projectId}/documents/${uploaded.id}/parse`);
      return uploaded;
    },
    onSuccess: () => {
      setReuploadStep(null);
      setReuploadProgress(0);
      if (reuploadStorageKey) sessionStorage.removeItem(reuploadStorageKey);
      queryClient.invalidateQueries({ queryKey: ["/api/modeling/projects", projectId, "documents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/modeling/projects", projectId, "documents", "holding"] });
      setReuploadDoc(null);
      toast({ title: "Re-uploaded", description: "The document has been replaced and is now processing." });
    },
    onError: (error: unknown) => {
      setReuploadStep(null);
      setReuploadProgress(0);
      setReuploadDoc(null);
      const message = error instanceof Error ? error.message : "Could not replace document.";
      toast({ title: "Re-upload failed", description: message, variant: "destructive" });
    },
  });

  const isExcelFile = (file: File) =>
    /\.(xlsx|xls)$/i.test(file.name) ||
    file.type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    file.type === "application/vnd.ms-excel";

  const handleReuploadClick = (doc: DocIntelUpload) => {
    const now = new Date();

    // If there is a stored draft for this exact document, restore it
    if (reuploadStorageKey) {
      try {
        const stored = sessionStorage.getItem(reuploadStorageKey);
        if (stored) {
          const state = JSON.parse(stored);
          if (state.docId === doc.id) {
            setReuploadDoc(doc);
            setReuploadDocType(state.docType || "pnl");
            setReuploadCustomTypeName(state.customTypeName || "");
            setReuploadYear(state.year || String(now.getFullYear()));
            setReuploadIsT12(!!state.isT12);
            setReuploadT12StartMonth(state.t12StartMonth || "1");
            setReuploadT12StartYear(state.t12StartYear || String(now.getFullYear() - 1));
            setReuploadT12EndMonth(state.t12EndMonth || String(now.getMonth() + 1));
            setReuploadT12EndYear(state.t12EndYear || String(now.getFullYear()));
            const meta = doc.periodMetadata as { sheetName?: string } | null | undefined;
            setReuploadPrevSheetName(meta?.sheetName);
            setReuploadDialogOpen(true);
            return;
          }
        }
      } catch {
        // fall through to default behavior
      }
    }

    // Default: derive settings from the document's own stored metadata
    setReuploadDoc(doc);
    const inherited = doc.docType || "pnl";
    const inheritedIsT12 = doc.isT12 ?? false;
    const meta = doc.periodMetadata as { t12StartMonth?: number; t12StartYear?: number; t12EndMonth?: number; t12EndYear?: number; customTypeName?: string; sheetName?: string; sheetIndex?: number } | null | undefined;
    setReuploadDocType(inherited);
    setReuploadCustomTypeName(meta?.customTypeName ?? "");
    setReuploadIsT12(inheritedIsT12);
    setReuploadPrevSheetName(meta?.sheetName);
    if (inheritedIsT12 && meta) {
      setReuploadT12StartMonth(meta.t12StartMonth ? String(meta.t12StartMonth) : "1");
      setReuploadT12StartYear(meta.t12StartYear ? String(meta.t12StartYear) : String(now.getFullYear() - 1));
      setReuploadT12EndMonth(meta.t12EndMonth ? String(meta.t12EndMonth) : String(now.getMonth() + 1));
      setReuploadT12EndYear(meta.t12EndYear ? String(meta.t12EndYear) : String(now.getFullYear()));
    } else {
      setReuploadT12StartMonth("1");
      setReuploadT12StartYear(String(now.getFullYear() - 1));
      setReuploadT12EndMonth(String(now.getMonth() + 1));
      setReuploadT12EndYear(String(now.getFullYear()));
    }
    setReuploadYear(doc.year ? String(doc.year) : String(now.getFullYear()));
    setReuploadDialogOpen(true);
  };

  const handleReuploadConfirm = () => {
    setReuploadDialogOpen(false);
    if (reuploadInputRef.current) {
      reuploadInputRef.current.value = "";
      reuploadInputRef.current.click();
    }
  };

  const handleReuploadFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !reuploadDoc) return;

    if (isExcelFile(file)) {
      try {
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: "array" });
        if (workbook.SheetNames.length > 1) {
          const sheets = workbook.SheetNames.map((name, index) => {
            const ws = workbook.Sheets[name];
            const range = ws["!ref"];
            let rowCount = 0;
            if (range) {
              const decoded = XLSX.utils.decode_range(range);
              rowCount = decoded.e.r - decoded.s.r + 1;
            }
            return { index, name, rowCount };
          });
          setReuploadAvailableSheets(sheets);
          setReuploadPendingFile(file);
          setReuploadSheetSelectorOpen(true);
          return;
        }
      } catch {
        // fall through to single-file upload if sheet reading fails
      }
    }

    reuploadMutation.mutate({ file, doc: reuploadDoc });
  };

  const handleReuploadSheetConfirm = (sheetIdx: number, sheetNm: string) => {
    setReuploadSheetSelectorOpen(false);
    const pendingFile = reuploadPendingFile;
    const pendingDoc = reuploadDoc;
    setReuploadPendingFile(null);
    setReuploadAvailableSheets([]);
    if (pendingFile && pendingDoc) {
      reuploadMutation.mutate({ file: pendingFile, doc: pendingDoc, sheetName: sheetNm, sheetIndex: sheetIdx });
    }
  };

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
          <TabsTrigger
            value="review"
            data-testid="tab-review"
            className={reviewablePnlDocuments.length > 0 ? "relative data-[state=inactive]:text-amber-600 data-[state=inactive]:font-medium" : "relative"}
          >
            <Eye className="h-4 w-4 mr-2" />
            Review Documents
            {reviewablePnlDocuments.length > 0 && (
              <span className="relative ml-2 inline-flex">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-60" />
                <Badge className="relative h-5 px-1.5 text-[10px] bg-amber-500 hover:bg-amber-500 text-white border-0">
                  {reviewablePnlDocuments.length}
                </Badge>
              </span>
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
                  {selectedIds.size > 0 ? (
                    <>
                      {selectedReviewableDocs.length > 0 && (
                        <Button
                          size="sm"
                          onClick={() => handleReviewDocuments(selectedReviewableDocs.map((d) => d.id))}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          {selectedReviewableDocs.length === 1
                            ? "Review Document"
                            : `Review Documents (${selectedReviewableDocs.length})`}
                        </Button>
                      )}
                      <Button variant="destructive" size="sm" onClick={handleBatchDelete}>
                        <Trash2 className="h-4 w-4 mr-1" />
                        Delete ({selectedIds.size})
                      </Button>
                    </>
                  ) : (
                    reviewablePnlDocuments.length > 0 && (
                      <Button
                        onClick={() => handleReviewDocuments(reviewablePnlDocuments.map((d) => d.id))}
                        size="lg"
                      >
                        <Brain className="h-4 w-4 mr-2" />
                        Review Documents ({reviewablePnlDocuments.length})
                      </Button>
                    )
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
                  {pnlDocuments.map((doc) => {
                    const errMsg = doc.errorMessage?.toLowerCase() ?? "";
                    const isMigrationLost =
                      doc.status === "error" &&
                      !!doc.errorMessage &&
                      (errMsg.includes("no longer available") ||
                        errMsg.includes("migration"));
                    const isReuploading = reuploadMutation.isPending && reuploadDoc?.id === doc.id;
                    const reuploadStepLabel =
                      reuploadStep === "uploading" ? `Uploading new file… ${reuploadProgress}%` :
                      reuploadStep === "deleting" ? "Removing old file…" :
                      reuploadStep === "parsing" ? "Queuing for processing…" : null;
                    return (
                    <div key={doc.id} className="space-y-0">
                    <div
                      className={`flex items-center gap-3 p-3 border transition-colors ${
                        isReuploading
                          ? "border-blue-300 bg-blue-50/60 dark:border-blue-800 dark:bg-blue-950/20 opacity-80 rounded-t-lg"
                          : isMigrationLost
                          ? "border-amber-300 bg-amber-50/60 dark:border-amber-800 dark:bg-amber-950/20 hover:bg-amber-50 dark:hover:bg-amber-950/30 rounded-lg"
                          : "rounded-lg hover:bg-muted/50"
                      }`}
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
                        {doc.status === "error" && !isMigrationLost && doc.errorMessage && (
                          <p className="text-xs text-red-600 dark:text-red-400 mt-0.5 truncate">{doc.errorMessage}</p>
                        )}
                        {isMigrationLost && (
                          <p className="text-xs text-amber-800 dark:text-amber-300 mt-0.5 font-medium">
                            File lost during storage migration — re-upload required
                          </p>
                        )}
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
                        {doc.status === "error" && (
                          <Button
                            size="sm"
                            variant={isMigrationLost ? "default" : "outline"}
                            className={
                              isMigrationLost
                                ? "h-7 px-3 text-xs gap-1 bg-amber-600 hover:bg-amber-700 text-white border-amber-600"
                                : "h-7 px-2 text-xs gap-1"
                            }
                            disabled={reuploadMutation.isPending && reuploadDoc?.id === doc.id}
                            onClick={() => handleReuploadClick(doc)}
                          >
                            {reuploadMutation.isPending && reuploadDoc?.id === doc.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Upload className="h-3 w-3" />
                            )}
                            Re-upload
                          </Button>
                        )}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {REVIEWABLE_STATUSES.includes(doc.status ?? "") && (
                              <DropdownMenuItem onClick={() => handleReviewDocuments([doc.id])}>
                                <Eye className="h-4 w-4 mr-2" />
                                Review Document
                              </DropdownMenuItem>
                            )}
                            {(doc.status === "uploaded" || doc.status === "processing" || doc.status === "error") && (
                              <DropdownMenuItem 
                                onClick={() => retryParseMutation.mutate(doc.id)}
                                disabled={retryParseMutation.isPending}
                              >
                                <RefreshCw className="h-4 w-4 mr-2" />
                                Retry Processing
                              </DropdownMenuItem>
                            )}
                            {(doc.status === "parsed" || doc.status === "reviewing") && (
                              <DropdownMenuItem asChild>
                                <Link href={`/modeling/doc-intel/${doc.id}/coa-review`}>
                                  <ListChecks className="h-4 w-4 mr-2" />
                                  COA Mapping Review
                                </Link>
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
                    {isReuploading && reuploadStepLabel && (
                      <div className="flex items-center gap-2 px-3 py-1.5 rounded-b-lg bg-blue-100 dark:bg-blue-950/40 border border-t-0 border-blue-300 dark:border-blue-800 text-xs text-blue-700 dark:text-blue-300">
                        <Loader2 className="h-3 w-3 animate-spin flex-shrink-0" />
                        <span className="font-medium">Replacing document —</span>
                        <span>{reuploadStepLabel}</span>
                        <div className="ml-auto flex gap-1">
                          {(["uploading", "deleting", "parsing"] as const).map((step) => (
                            <div
                              key={step}
                              className={`h-1.5 w-8 rounded-full transition-colors ${
                                reuploadStep === step
                                  ? "bg-blue-500 dark:bg-blue-400"
                                  : (reuploadStep === "deleting" && step === "uploading") ||
                                    (reuploadStep === "parsing" && (step === "uploading" || step === "deleting"))
                                  ? "bg-blue-300 dark:bg-blue-600"
                                  : "bg-blue-200 dark:bg-blue-800"
                              }`}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                    </div>
                  );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="categories">
          <CategoryManager />
        </TabsContent>
      </Tabs>

      <input
        ref={reuploadInputRef}
        type="file"
        accept=".pdf,.xlsx,.xls,.csv"
        className="hidden"
        onChange={handleReuploadFileChange}
      />

      <Dialog open={reuploadDialogOpen} onOpenChange={(open) => {
        if (!open) {
          setReuploadDialogOpen(false);
          setReuploadDoc(null);
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Re-upload Document
            </DialogTitle>
            <DialogDescription>
              Review and adjust the document settings below, then choose a replacement file.
              {reuploadDoc && (
                <span className="block mt-1 font-medium text-foreground truncate">
                  Replacing: {reuploadDoc.originalName}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Document Type</Label>
              <Select value={reuploadDocType} onValueChange={setReuploadDocType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pnl">P&L Statement</SelectItem>
                  <SelectItem value="rent_roll">Rent Roll</SelectItem>
                  <SelectItem value="balance_sheet">Balance Sheet</SelectItem>
                  <SelectItem value="rate_sheet">Rate Sheet</SelectItem>
                  <SelectItem value="invoice">Invoice</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                  {customDocTypes.map((ct) => (
                    <SelectItem key={ct.id} value={ct.id}>{ct.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {reuploadDocType === "other" && (
              <div className="space-y-1.5">
                <Label>Custom Type Name <span className="text-muted-foreground text-xs">(optional)</span></Label>
                <Input
                  placeholder="e.g. Operating Statement"
                  value={reuploadCustomTypeName}
                  onChange={(e) => setReuploadCustomTypeName(e.target.value)}
                />
              </div>
            )}

            <div className="flex items-center gap-2">
              <Checkbox
                id="reupload-is-t12"
                checked={reuploadIsT12}
                onCheckedChange={(checked) => setReuploadIsT12(!!checked)}
              />
              <Label htmlFor="reupload-is-t12" className="cursor-pointer">
                Trailing 12-Month (T12) document
              </Label>
            </div>

            {reuploadIsT12 ? (
              <div className="space-y-3 border rounded-md p-3 bg-muted/30">
                <p className="text-xs text-muted-foreground font-medium">T12 Date Range</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Start</Label>
                    <div className="flex gap-1">
                      <Select value={reuploadT12StartMonth} onValueChange={setReuploadT12StartMonth}>
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder="Mo" />
                        </SelectTrigger>
                        <SelectContent>
                          {MONTHS.map((m) => (
                            <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select value={reuploadT12StartYear} onValueChange={setReuploadT12StartYear}>
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder="Year" />
                        </SelectTrigger>
                        <SelectContent>
                          {Array.from({ length: 12 }, (_, i) => String(new Date().getFullYear() + 1 - i)).map((y) => (
                            <SelectItem key={y} value={y}>{y}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">End</Label>
                    <div className="flex gap-1">
                      <Select value={reuploadT12EndMonth} onValueChange={setReuploadT12EndMonth}>
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder="Mo" />
                        </SelectTrigger>
                        <SelectContent>
                          {MONTHS.map((m) => (
                            <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select value={reuploadT12EndYear} onValueChange={setReuploadT12EndYear}>
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder="Year" />
                        </SelectTrigger>
                        <SelectContent>
                          {Array.from({ length: 12 }, (_, i) => String(new Date().getFullYear() + 1 - i)).map((y) => (
                            <SelectItem key={y} value={y}>{y}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label>Fiscal Year</Label>
                <Select value={reuploadYear} onValueChange={setReuploadYear}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select year" />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 10 }, (_, i) => String(new Date().getFullYear() - i)).map((y) => (
                      <SelectItem key={y} value={y}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => {
              setReuploadDialogOpen(false);
              setReuploadDoc(null);
            }}>
              Cancel
            </Button>
            <Button onClick={handleReuploadConfirm}>
              <Upload className="h-4 w-4 mr-2" />
              Choose File &amp; Upload
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={reuploadSheetSelectorOpen} onOpenChange={(open) => {
        if (!open) {
          setReuploadSheetSelectorOpen(false);
          setReuploadPendingFile(null);
          setReuploadAvailableSheets([]);
          setReuploadPrevSheetName(undefined);
        }
      }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              Select Sheet
            </DialogTitle>
            <DialogDescription>
              This Excel workbook has multiple sheets. Choose one to upload.
            </DialogDescription>
          </DialogHeader>
          {reuploadPrevSheetName && (
            <p className="text-xs text-muted-foreground pb-1">
              Previously used: <span className="font-medium text-foreground">{reuploadPrevSheetName}</span>
            </p>
          )}
          <div className="space-y-2 py-2 max-h-64 overflow-y-auto">
            {reuploadAvailableSheets.map((sheet) => {
              const isPrev = reuploadPrevSheetName && sheet.name === reuploadPrevSheetName;
              return (
                <button
                  key={sheet.index}
                  className={`w-full flex items-center justify-between p-3 border rounded-lg transition-colors text-left ${
                    isPrev
                      ? "border-primary bg-primary/5 hover:bg-primary/10"
                      : "hover:bg-muted/50"
                  }`}
                  onClick={() => handleReuploadSheetConfirm(sheet.index, sheet.name)}
                >
                  <span className="font-medium text-sm">{sheet.name}</span>
                  <div className="flex items-center gap-2">
                    {isPrev && (
                      <Badge variant="outline" className="text-[10px] px-1.5 h-4 border-primary text-primary">
                        previous
                      </Badge>
                    )}
                    <span className="text-xs text-muted-foreground">{sheet.rowCount} rows</span>
                  </div>
                </button>
              );
            })}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setReuploadSheetSelectorOpen(false);
              setReuploadPendingFile(null);
              setReuploadAvailableSheets([]);
            }}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
