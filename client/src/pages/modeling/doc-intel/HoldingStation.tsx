import { useState, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useDropzone } from "react-dropzone";
import { 
  Upload, 
  FileSpreadsheet, 
  FileText, 
  AlertTriangle, 
  CheckCircle2, 
  X,
  Loader2,
  Brain,
  Plus,
  Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { DocIntelUpload } from "@shared/schema";

function getCsrfToken(): string {
  const match = document.cookie.match(/(?:^|; )csrf_token=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : '';
}

async function ensureCsrfToken(): Promise<string> {
  let token = getCsrfToken();
  if (!token) {
    await fetch('/api/auth/me', { credentials: 'include' });
    token = getCsrfToken();
  }
  return token;
}

type DocType = "pnl" | "rent_roll" | "balance_sheet" | "rate_sheet" | "invoice" | "other" | string;

interface HoldingStationProps {
  projectId: string;
  onReviewDocuments: (uploadIds: string[]) => void;
  onUploadComplete?: () => void;
}

interface StagedFile {
  file: File;
  id: string;
  displayName: string;
  docType: DocType;
  customTypeName?: string;
  year: string;
  isT12?: boolean;
  t12StartMonth?: string;
  t12StartYear?: string;
  t12EndMonth?: string;
  t12EndYear?: string;
  status: "pending" | "uploading" | "uploaded" | "parsing" | "parsed" | "error";
  progress: number;
  errorMessage?: string;
  uploadId?: string;
}

const MONTHS = [
  { value: '1', label: 'Jan' }, { value: '2', label: 'Feb' }, { value: '3', label: 'Mar' },
  { value: '4', label: 'Apr' }, { value: '5', label: 'May' }, { value: '6', label: 'Jun' },
  { value: '7', label: 'Jul' }, { value: '8', label: 'Aug' }, { value: '9', label: 'Sep' },
  { value: '10', label: 'Oct' }, { value: '11', label: 'Nov' }, { value: '12', label: 'Dec' },
];

function parseDateRange(filename: string): { startMonth: string; startYear: string; endMonth: string; endYear: string } | null {
  const dateRangePattern = /(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})\s*[-–—]+\s*(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/;
  const match = filename.match(dateRangePattern);
  if (!match) return null;
  const [, startMonth, , startYearRaw, endMonth, , endYearRaw] = match;
  const sm = parseInt(startMonth);
  const em = parseInt(endMonth);
  if (sm < 1 || sm > 12 || em < 1 || em > 12) return null;
  const startYear = startYearRaw.length === 2 ? `20${startYearRaw}` : startYearRaw;
  const endYear = endYearRaw.length === 2 ? `20${endYearRaw}` : endYearRaw;
  return { startMonth: sm.toString(), startYear, endMonth: em.toString(), endYear };
}

const BUILTIN_DOC_TYPES: Record<string, { label: string; icon: typeof FileSpreadsheet }> = {
  pnl: { label: "P&L Statement", icon: FileSpreadsheet },
  rent_roll: { label: "Rent Roll", icon: FileText },
  balance_sheet: { label: "Balance Sheet", icon: FileSpreadsheet },
  rate_sheet: { label: "Rate Sheet", icon: FileText },
  invoice: { label: "Invoice", icon: FileText },
  other: { label: "Other", icon: FileText },
};

export function HoldingStation({ projectId, onReviewDocuments, onUploadComplete }: HoldingStationProps) {
  const { toast } = useToast();
  const [stagedFiles, setStagedFiles] = useState<StagedFile[]>([]);
  const [newCustomTypeName, setNewCustomTypeName] = useState("");
  const [showAddTypeDialog, setShowAddTypeDialog] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingMessage, setProcessingMessage] = useState("");
  // Explicit state to track when processing has just completed - shows prominent Review CTA
  const [processingJustCompleted, setProcessingJustCompleted] = useState(false);

  // Fetch documents from server
  const { data: holdingQueue = [], isLoading, refetch } = useQuery<DocIntelUpload[]>({
    queryKey: ["/api/modeling/projects", projectId, "documents", "holding"],
    queryFn: async () => {
      const res = await fetch(`/api/modeling/projects/${projectId}/documents?holdingOnly=true`);
      if (!res.ok) throw new Error("Failed to fetch holding queue");
      return res.json();
    },
    refetchInterval: (data) => {
      // Poll more frequently while documents are processing
      const hasProcessingDocs = data?.state?.data?.some(
        (doc) => doc.status === "uploaded" || doc.status === "processing"
      );
      return hasProcessingDocs ? 2000 : false;
    },
  });

  // Check if ALL documents are ready for review (parsed or reviewing status)
  const parsedDocuments = holdingQueue.filter(
    (doc) => doc.status === "parsed" || doc.status === "reviewing"
  );
  const processingDocuments = holdingQueue.filter(
    (doc) => doc.status === "uploaded" || doc.status === "processing"
  );
  const allDocumentsReady = holdingQueue.length > 0 && 
    processingDocuments.length === 0 && 
    parsedDocuments.length === holdingQueue.length;

  const createCustomTypeMutation = useMutation({
    mutationFn: async (name: string) => {
      return apiRequest("POST", "/api/doc-intel/custom-document-types", { name });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/doc-intel/custom-document-types"] });
      toast({ title: "Created", description: "Custom document type added." });
      setShowAddTypeDialog(false);
      setNewCustomTypeName("");
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to create custom type", variant: "destructive" });
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async (stagedFile: StagedFile) => {
      const formData = new FormData();
      formData.append("file", stagedFile.file);
      formData.append("docType", stagedFile.docType === "other" && stagedFile.customTypeName ? "other" : stagedFile.docType);
      formData.append("year", stagedFile.isT12 ? (stagedFile.t12EndYear || new Date().getFullYear().toString()) : stagedFile.year);
      formData.append("holdingStatus", "staging");
      formData.append("displayName", stagedFile.displayName);
      if (stagedFile.customTypeName) {
        formData.append("customTypeName", stagedFile.customTypeName);
      }
      if (stagedFile.isT12) {
        formData.append("isT12", "true");
        if (stagedFile.t12StartMonth) formData.append("t12StartMonth", stagedFile.t12StartMonth);
        if (stagedFile.t12StartYear) formData.append("t12StartYear", stagedFile.t12StartYear);
        if (stagedFile.t12EndMonth) formData.append("t12EndMonth", stagedFile.t12EndMonth);
        if (stagedFile.t12EndYear) formData.append("t12EndYear", stagedFile.t12EndYear);
      }

      const csrfToken = await ensureCsrfToken();
      const headers: Record<string, string> = {};
      if (csrfToken) {
        headers['X-CSRF-Token'] = csrfToken;
      }

      const response = await fetch(`/api/modeling/projects/${projectId}/documents`, {
        method: "POST",
        body: formData,
        headers,
        credentials: 'include',
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Upload failed");
      }
      return response.json();
    },
  });

  const parseDocumentMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("POST", `/api/modeling/projects/${projectId}/documents/${id}/parse`);
      return id;
    },
  });


  const onDrop = useCallback((acceptedFiles: File[]) => {
    const now = new Date();
    const newStagedFiles: StagedFile[] = acceptedFiles.map((file) => {
      const isT12 = guessIsT12(file.name);
      const base: StagedFile = {
        file,
        id: crypto.randomUUID(),
        displayName: file.name,
        docType: guessDocType(file.name),
        year: isT12 ? "T12" : now.getFullYear().toString(),
        isT12,
        status: "pending" as const,
        progress: 0,
      };
      if (isT12) {
        const parsed = parseDateRange(file.name);
        if (parsed) {
          base.t12StartMonth = parsed.startMonth;
          base.t12StartYear = parsed.startYear;
          base.t12EndMonth = parsed.endMonth;
          base.t12EndYear = parsed.endYear;
        } else {
          base.t12StartMonth = (now.getMonth() + 1).toString();
          base.t12StartYear = (now.getFullYear() - 1).toString();
          base.t12EndMonth = (now.getMonth() + 1).toString();
          base.t12EndYear = now.getFullYear().toString();
        }
      }
      return base;
    });
    setStagedFiles((prev) => [...prev, ...newStagedFiles]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
      "application/vnd.ms-excel": [".xls"],
      "text/csv": [".csv"],
      "application/pdf": [".pdf"],
    },
    maxSize: 50 * 1024 * 1024,
    multiple: true,
  });

  const guessIsT12 = (filename: string): boolean => {
    const lower = filename.toLowerCase();
    if (lower.includes("t12") || lower.includes("trailing")) return true;
    if (parseDateRange(filename)) return true;
    return false;
  };

  const guessDocType = (filename: string): DocType => {
    const lower = filename.toLowerCase();
    if (lower.includes("p&l") || lower.includes("pnl") || lower.includes("profit") || lower.includes("income")) {
      return "pnl";
    }
    if (lower.includes("rent") || lower.includes("roll") || lower.includes("tenant")) {
      return "rent_roll";
    }
    if (lower.includes("balance")) {
      return "balance_sheet";
    }
    if (lower.includes("rate")) {
      return "rate_sheet";
    }
    if (lower.includes("invoice")) {
      return "invoice";
    }
    return "other";
  };

  const updateStagedFile = (id: string, updates: Partial<StagedFile>) => {
    setStagedFiles((prev) => prev.map((f) => (f.id === id ? { ...f, ...updates } : f)));
  };

  const removeStagedFile = (id: string) => {
    setStagedFiles((prev) => prev.filter((f) => f.id !== id));
  };

  /**
   * MAIN WORKFLOW: Upload all staged files, then automatically parse them
   */
  const uploadAndParseAll = async () => {
    const pendingFiles = stagedFiles.filter((f) => f.status === "pending");
    if (pendingFiles.length === 0) return;

    const t12Missing = pendingFiles.filter(
      (f) => f.isT12 && (!f.t12StartMonth || !f.t12StartYear || !f.t12EndMonth || !f.t12EndYear)
    );
    if (t12Missing.length > 0) {
      toast({
        title: "Missing T12 period",
        description: `Please set the start and end month/year for: ${t12Missing.map(f => f.displayName).join(", ")}`,
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    setProcessingMessage(`Uploading ${pendingFiles.length} document(s)...`);

    const uploadedIds: string[] = [];

    // Step 1: Upload all files
    for (let i = 0; i < pendingFiles.length; i++) {
      const staged = pendingFiles[i];
      setProcessingMessage(`Uploading ${i + 1} of ${pendingFiles.length}: ${staged.displayName}`);
      updateStagedFile(staged.id, { status: "uploading", progress: 30 });
      
      try {
        const result = await uploadMutation.mutateAsync(staged);
        updateStagedFile(staged.id, { status: "uploaded", progress: 60, uploadId: result.id });
        uploadedIds.push(result.id);
      } catch (error: any) {
        updateStagedFile(staged.id, { status: "error", errorMessage: error.message });
      }
    }

    // Step 2: Automatically trigger parsing for all uploaded documents
    if (uploadedIds.length > 0) {
      setProcessingMessage(`AI parsing ${uploadedIds.length} document(s)...`);
      
      // Update staged files to show parsing status
      stagedFiles.forEach((f) => {
        if (f.uploadId && uploadedIds.includes(f.uploadId)) {
          updateStagedFile(f.id, { status: "parsing", progress: 80 });
        }
      });

      // Trigger parse for each document (in parallel)
      const parsePromises = uploadedIds.map(async (uploadId) => {
        try {
          await parseDocumentMutation.mutateAsync(uploadId);
          return { uploadId, success: true };
        } catch (error: any) {
          console.error(`Parse failed for ${uploadId}:`, error);
          return { uploadId, success: false, error: error.message };
        }
      });

      const parseResults = await Promise.all(parsePromises);
      
      // Update staged file statuses based on parse results
      parseResults.forEach((result) => {
        const staged = stagedFiles.find((f) => f.uploadId === result.uploadId);
        if (staged) {
          if (result.success) {
            updateStagedFile(staged.id, { status: "parsed", progress: 100 });
          } else {
            updateStagedFile(staged.id, { status: "error", errorMessage: result.error });
          }
        }
      });

      const successCount = parseResults.filter((r) => r.success).length;
      const failCount = parseResults.filter((r) => !r.success).length;

      if (successCount > 0) {
        toast({ 
          title: "Processing complete", 
          description: `${successCount} document(s) parsed successfully.${failCount > 0 ? ` ${failCount} failed.` : ''}` 
        });
      }
    }

    // Refetch the holding queue to get updated statuses
    await refetch();

    // Clear completed staged files after a delay
    setTimeout(() => {
      setStagedFiles((prev) => prev.filter((f) => f.status !== "parsed" && f.status !== "uploaded"));
    }, 2000);

    setIsProcessing(false);
    setProcessingMessage("");
    
    // If we successfully processed P&L documents, switch to the Review tab
    const hasPnlDocs = pendingFiles.some((f) => f.docType === "pnl");
    if (uploadedIds.length > 0 && hasPnlDocs && onUploadComplete) {
      onUploadComplete();
    } else if (uploadedIds.length > 0) {
      setProcessingJustCompleted(true);
    }
  };

  const handleReviewAll = () => {
    const readyDocIds = parsedDocuments.map((doc) => doc.id);
    setProcessingJustCompleted(false); // Clear the flag when user clicks Review
    onReviewDocuments(readyDocIds);
  };


  const currentYear = new Date().getFullYear();
  const yearOptions = ["T12", ...Array.from({ length: 10 }, (_, i) => (currentYear - i).toString())];
  const t12YearOptions = Array.from({ length: 12 }, (_, i) => (currentYear + 1 - i).toString());

  return (
    <div className="space-y-6">
      {/* FULL-SCREEN PROCESSING OVERLAY */}
      {isProcessing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-4 p-8 rounded-lg bg-card border shadow-lg max-w-md">
            <div className="relative">
              <Loader2 className="h-16 w-16 animate-spin text-primary" />
              <Brain className="h-8 w-8 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-primary" />
            </div>
            <div className="text-center">
              <p className="text-lg font-semibold">Processing Documents</p>
              <p className="text-sm text-muted-foreground mt-1">{processingMessage}</p>
            </div>
            <Progress value={undefined} className="w-64 h-2" />
          </div>
        </div>
      )}

      {/* PROCESSING COMPLETE - REVIEW NOW BANNER */}
      {processingJustCompleted && allDocumentsReady && parsedDocuments.length > 0 && (
        <Card className="border-green-300 bg-green-50 dark:bg-green-950/30 dark:border-green-800">
          <CardContent className="py-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
                  <CheckCircle2 className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-green-800 dark:text-green-200">
                    Processing Complete!
                  </h3>
                  <p className="text-sm text-green-700 dark:text-green-300">
                    {parsedDocuments.length} document{parsedDocuments.length > 1 ? 's are' : ' is'} ready for review. 
                    Click the button to review and confirm line items.
                  </p>
                </div>
              </div>
              <Button 
                size="lg" 
                onClick={handleReviewAll}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                <Eye className="h-5 w-5 mr-2" />
                Review Documents ({parsedDocuments.length})
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Upload Dropzone Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Upload Documents
          </CardTitle>
          <CardDescription>
            Drop P&L statements, rent rolls, or other financial documents for AI-powered analysis
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
              isDragActive
                ? "border-primary bg-primary/5"
                : "border-muted-foreground/25 hover:border-primary/50"
            }`}
          >
            <input {...getInputProps()} />
            <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            {isDragActive ? (
              <p className="font-medium text-lg">Drop files here...</p>
            ) : (
              <>
                <p className="font-medium text-lg">Drag & drop files here</p>
                <p className="text-sm text-muted-foreground mt-1">or click to browse</p>
                <p className="text-xs text-muted-foreground mt-3">
                  Supported: Excel (.xlsx, .xls), CSV, PDF • Max 50MB
                </p>
              </>
            )}
          </div>

          {/* Staged Files List */}
          {stagedFiles.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-medium">Files to Upload ({stagedFiles.length})</h4>
                <Button 
                  onClick={uploadAndParseAll} 
                  disabled={isProcessing || !stagedFiles.some((f) => f.status === "pending")}
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Upload & Process
                    </>
                  )}
                </Button>
              </div>

              <div className="space-y-2">
                {stagedFiles.map((staged) => (
                  <div
                    key={staged.id}
                    className={`flex items-center gap-3 p-3 border rounded-lg ${
                      staged.status === "parsed" ? "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950" :
                      staged.status === "error" ? "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950" :
                      "border-border"
                    }`}
                  >
                    <FileSpreadsheet className="h-8 w-8 text-green-600 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{staged.displayName}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatFileSize(staged.file.size)}
                      </p>
                    </div>

                    {staged.status === "pending" && (
                      <div className="flex items-center gap-2 flex-wrap justify-end">
                        <Select
                          value={staged.docType}
                          onValueChange={(v) => updateStagedFile(staged.id, { docType: v as DocType })}
                        >
                          <SelectTrigger className="w-32 h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(BUILTIN_DOC_TYPES).map(([key, { label }]) => (
                              <SelectItem key={key} value={key}>{label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Select
                          value={staged.year}
                          onValueChange={(v) => {
                            const now = new Date();
                            const updates: Partial<StagedFile> = { year: v };
                            if (v === "T12") {
                              updates.isT12 = true;
                              if (!staged.t12StartMonth) {
                                updates.t12StartMonth = (now.getMonth() + 1).toString();
                                updates.t12StartYear = (now.getFullYear() - 1).toString();
                                updates.t12EndMonth = (now.getMonth() + 1).toString();
                                updates.t12EndYear = now.getFullYear().toString();
                              }
                            } else {
                              updates.isT12 = false;
                              updates.t12StartMonth = undefined;
                              updates.t12StartYear = undefined;
                              updates.t12EndMonth = undefined;
                              updates.t12EndYear = undefined;
                            }
                            updateStagedFile(staged.id, updates);
                          }}
                        >
                          <SelectTrigger className="w-20 h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {yearOptions.map((y) => (
                              <SelectItem key={y} value={y}>
                                {y === "T12" ? <span className="font-semibold text-primary">T12</span> : y}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => removeStagedFile(staged.id)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                        {staged.isT12 && (
                          <div className="w-full flex items-center gap-1.5 mt-1 pl-10">
                            <span className="text-xs text-muted-foreground whitespace-nowrap">From:</span>
                            <Select
                              value={staged.t12StartMonth || "1"}
                              onValueChange={(v) => updateStagedFile(staged.id, { t12StartMonth: v })}
                            >
                              <SelectTrigger className="w-16 h-7 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {MONTHS.map((m) => (
                                  <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Select
                              value={staged.t12StartYear || currentYear.toString()}
                              onValueChange={(v) => updateStagedFile(staged.id, { t12StartYear: v })}
                            >
                              <SelectTrigger className="w-[72px] h-7 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {t12YearOptions.map((y) => (
                                  <SelectItem key={y} value={y}>{y}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <span className="text-xs text-muted-foreground whitespace-nowrap">To:</span>
                            <Select
                              value={staged.t12EndMonth || "1"}
                              onValueChange={(v) => updateStagedFile(staged.id, { t12EndMonth: v })}
                            >
                              <SelectTrigger className="w-16 h-7 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {MONTHS.map((m) => (
                                  <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Select
                              value={staged.t12EndYear || currentYear.toString()}
                              onValueChange={(v) => updateStagedFile(staged.id, { t12EndYear: v })}
                            >
                              <SelectTrigger className="w-[72px] h-7 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {t12YearOptions.map((y) => (
                                  <SelectItem key={y} value={y}>{y}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                      </div>
                    )}

                    {staged.status === "uploading" && (
                      <div className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span className="text-xs text-muted-foreground">Uploading...</span>
                      </div>
                    )}

                    {staged.status === "parsing" && (
                      <div className="flex items-center gap-2">
                        <Brain className="h-4 w-4 animate-pulse text-primary" />
                        <span className="text-xs text-muted-foreground">AI Parsing...</span>
                      </div>
                    )}

                    {staged.status === "parsed" && (
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                    )}

                    {staged.status === "error" && (
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5 text-red-600" />
                        <span className="text-xs text-red-600">{staged.errorMessage}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Custom Type Dialog */}
      <Dialog open={showAddTypeDialog} onOpenChange={setShowAddTypeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Custom Document Type</DialogTitle>
            <DialogDescription>
              Create a new document type for categorizing your uploads.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="customTypeName">Document Type Name</Label>
              <Input
                id="customTypeName"
                value={newCustomTypeName}
                onChange={(e) => setNewCustomTypeName(e.target.value)}
                placeholder="e.g., Insurance Certificate, Lease Agreement"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddTypeDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => createCustomTypeMutation.mutate(newCustomTypeName.trim())}
              disabled={!newCustomTypeName.trim() || createCustomTypeMutation.isPending}
            >
              {createCustomTypeMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Type"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}