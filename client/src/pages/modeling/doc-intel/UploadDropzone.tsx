import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Upload, FileSpreadsheet, X, AlertCircle, Loader2, CheckCircle2, FileText, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
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

interface UploadDropzoneProps {
  projectId: string;
  onUploadComplete: (upload: DocIntelUpload) => void;
}

interface CustomDocumentType {
  id: number;
  name: string;
  orgId: number;
  sortOrder: number;
  createdAt: string;
}

type DocTypeEnum = "pnl" | "t12" | "rent_roll" | "balance_sheet" | "rate_sheet" | "invoice" | "other";

interface StagedFile {
  id: string;
  file: File;
  docType: DocTypeEnum;
  customTypeId: string | null;
  customTypeName: string;
  year: string;
  t12StartMonth?: string;
  t12StartYear?: string;
  t12EndMonth?: string;
  t12EndYear?: string;
  status: "pending" | "uploading" | "complete" | "error";
  progress: number;
  errorMessage?: string;
}

const MONTH_OPTIONS = [
  { value: '1', label: 'Jan' }, { value: '2', label: 'Feb' }, { value: '3', label: 'Mar' },
  { value: '4', label: 'Apr' }, { value: '5', label: 'May' }, { value: '6', label: 'Jun' },
  { value: '7', label: 'Jul' }, { value: '8', label: 'Aug' }, { value: '9', label: 'Sep' },
  { value: '10', label: 'Oct' }, { value: '11', label: 'Nov' }, { value: '12', label: 'Dec' },
];

const BUILT_IN_DOC_TYPES: Record<DocTypeEnum, { label: string }> = {
  pnl: { label: "P&L Statement" },
  t12: { label: "T12" },
  rent_roll: { label: "Rent Roll" },
  balance_sheet: { label: "Balance Sheet" },
  rate_sheet: { label: "Rate Sheet" },
  invoice: { label: "Invoice" },
  other: { label: "Other" },
};

function guessDocType(filename: string): DocTypeEnum {
  const lower = filename.toLowerCase();
  if (lower.includes("t12") || lower.includes("trailing")) {
    return "t12";
  }
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
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function UploadDropzone({ projectId, onUploadComplete }: UploadDropzoneProps) {
  const { toast } = useToast();
  const [stagedFiles, setStagedFiles] = useState<StagedFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  // NEW: Processing message state for overlay
  const [processingMessage, setProcessingMessage] = useState("");

  const { data: customTypes = [], refetch: refetchCustomTypes } = useQuery<CustomDocumentType[]>({
    queryKey: ['/api/doc-intel/custom-document-types'],
  });

  const createCustomTypeMutation = useMutation({
    mutationFn: async (name: string) => {
      return apiRequest('/api/doc-intel/custom-document-types', {
        method: 'POST',
        body: JSON.stringify({ name }),
        headers: { 'Content-Type': 'application/json' },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/doc-intel/custom-document-types'] });
    },
  });

  const updateStagedFile = (id: string, updates: Partial<StagedFile>) => {
    setStagedFiles((prev) => prev.map((f) => (f.id === id ? { ...f, ...updates } : f)));
  };

  const removeStagedFile = (id: string) => {
    setStagedFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const getDocTypeLabel = (staged: StagedFile): string => {
    if (staged.customTypeId) {
      const customType = customTypes.find((ct) => ct.id.toString() === staged.customTypeId);
      return customType?.name || "Other";
    }
    return BUILT_IN_DOC_TYPES[staged.docType]?.label || "Other";
  };

  const handleDocTypeChange = (stagedId: string, value: string) => {
    if (value.startsWith("custom_")) {
      const customId = value.replace("custom_", "");
      updateStagedFile(stagedId, { docType: "other", customTypeId: customId, customTypeName: "" });
    } else {
      updateStagedFile(stagedId, { docType: value as DocTypeEnum, customTypeId: null, customTypeName: "" });
    }
  };

  const getCurrentSelectValue = (staged: StagedFile): string => {
    if (staged.customTypeId) {
      return `custom_${staged.customTypeId}`;
    }
    return staged.docType;
  };

  const saveCustomTypeIfNeeded = async (typeName: string): Promise<string | null> => {
    const existingCustom = customTypes.find(
      (ct) => ct.name.toLowerCase() === typeName.toLowerCase()
    );
    if (existingCustom) {
      return existingCustom.id.toString();
    }
    try {
      const newType = await createCustomTypeMutation.mutateAsync(typeName);
      await refetchCustomTypes();
      return newType.id?.toString() || null;
    } catch (error: any) {
      toast({ 
        title: "Failed to save custom type", 
        description: error.message || "Please try again.",
        variant: "destructive" 
      });
      return null;
    }
  };

  const uploadSingleFile = async (staged: StagedFile): Promise<DocIntelUpload | null> => {
    try {
      updateStagedFile(staged.id, { status: "uploading", progress: 20 });

      if (staged.docType === "other" && staged.customTypeName.trim() && !staged.customTypeId) {
        const newId = await saveCustomTypeIfNeeded(staged.customTypeName.trim());
        if (newId) {
          updateStagedFile(staged.id, { customTypeId: newId });
        }
      }

      updateStagedFile(staged.id, { progress: 40 });

      const csrfToken = await ensureCsrfToken();
      const formData = new FormData();
      formData.append("file", staged.file);
      formData.append("docType", staged.docType);
      formData.append("year", staged.year);

      if (staged.docType === 't12') {
        if (staged.t12StartMonth) formData.append('t12StartMonth', staged.t12StartMonth);
        if (staged.t12StartYear) formData.append('t12StartYear', staged.t12StartYear);
        if (staged.t12EndMonth) formData.append('t12EndMonth', staged.t12EndMonth);
        if (staged.t12EndYear) formData.append('t12EndYear', staged.t12EndYear);
      }

      if (staged.customTypeId) {
        const customType = customTypes.find((ct) => ct.id.toString() === staged.customTypeId);
        if (customType) {
          formData.append("customTypeName", customType.name);
          formData.append("customTypeId", staged.customTypeId);
        }
      } else if (staged.docType === "other" && staged.customTypeName.trim()) {
        formData.append("customTypeName", staged.customTypeName.trim());
      }

      const headers: Record<string, string> = {};
      if (csrfToken) {
        headers['X-CSRF-Token'] = csrfToken;
      }

      updateStagedFile(staged.id, { progress: 60 });

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

      const upload = await response.json();
      updateStagedFile(staged.id, { status: "complete", progress: 100 });
      return upload;
    } catch (error: any) {
      updateStagedFile(staged.id, { 
        status: "error", 
        errorMessage: error.message || "Upload failed" 
      });
      return null;
    }
  };

  // UPDATED: uploadAllFiles with processing feedback
  const uploadAllFiles = async () => {
    if (isUploading) return;

    const pendingFiles = stagedFiles.filter((f) => f.status === "pending");
    if (pendingFiles.length === 0) return;

    setIsUploading(true);
    setProcessingMessage("Uploading documents...");
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < pendingFiles.length; i++) {
      const staged = pendingFiles[i];
      setProcessingMessage(`Processing document ${i + 1} of ${pendingFiles.length}...`);
      const upload = await uploadSingleFile(staged);
      if (upload) {
        onUploadComplete(upload);
        successCount++;
      } else {
        errorCount++;
      }
    }

    if (successCount > 0) {
      setProcessingMessage("Queued for AI processing...");
      // Brief delay to show the queued message
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    setIsUploading(false);
    setProcessingMessage("");

    setTimeout(() => {
      setStagedFiles((prev) => prev.filter((f) => f.status !== "complete"));
    }, 2000);

    if (successCount > 0) {
      toast({ 
        title: "Upload complete", 
        description: `${successCount} document${successCount > 1 ? 's' : ''} uploaded and queued for AI processing.` 
      });
    }
    if (errorCount > 0) {
      toast({ 
        title: "Some uploads failed", 
        description: `${errorCount} document${errorCount > 1 ? 's' : ''} failed to upload.`,
        variant: "destructive"
      });
    }
  };

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const now = new Date();
    const newStagedFiles: StagedFile[] = acceptedFiles.map((file) => {
      const docType = guessDocType(file.name);
      const base: StagedFile = {
        id: crypto.randomUUID(),
        file,
        docType,
        customTypeId: null,
        customTypeName: "",
        year: now.getFullYear().toString(),
        status: "pending" as const,
        progress: 0,
      };
      if (docType === 't12') {
        base.t12StartMonth = (now.getMonth() + 1).toString();
        base.t12StartYear = (now.getFullYear() - 1).toString();
        base.t12EndMonth = (now.getMonth() + 1).toString();
        base.t12EndYear = now.getFullYear().toString();
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
    multiple: true,
    maxSize: 50 * 1024 * 1024,
  });

  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 10 }, (_, i) => (currentYear - i).toString());

  const handleSaveCustomType = async (stagedId: string, typeName: string) => {
    if (!typeName.trim()) return;

    const normalizedName = typeName.trim();
    const existingCustom = customTypes.find(
      (ct) => ct.name.toLowerCase() === normalizedName.toLowerCase()
    );

    if (existingCustom) {
      updateStagedFile(stagedId, { customTypeId: existingCustom.id.toString(), customTypeName: "" });
      toast({ title: "Type already exists", description: `Using existing "${existingCustom.name}" type.` });
      return;
    }

    try {
      const newType = await createCustomTypeMutation.mutateAsync(normalizedName);
      await refetchCustomTypes();
      updateStagedFile(stagedId, { customTypeId: newType.id?.toString() || null, customTypeName: "" });
      toast({ title: "Custom type saved", description: `"${normalizedName}" is now available in the dropdown.` });
    } catch {
      toast({ title: "Failed to save custom type", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-4">
      {/* NEW: Processing Overlay */}
      {isUploading && processingMessage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-4 p-8 rounded-lg bg-card border shadow-lg max-w-sm">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <div className="text-center">
              <p className="text-lg font-semibold">Processing Documents</p>
              <p className="text-sm text-muted-foreground mt-1">{processingMessage}</p>
            </div>
          </div>
        </div>
      )}

      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
          isDragActive
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/25 hover:border-primary/50"
        }`}
        data-testid="dropzone"
      >
        <input {...getInputProps()} data-testid="input-file" />
        <Upload className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
        {isDragActive ? (
          <p className="font-medium">Drop files here...</p>
        ) : (
          <>
            <p className="font-medium">Drag & drop files here</p>
            <p className="text-sm text-muted-foreground mt-1">or click to browse your files</p>
            <p className="text-xs text-muted-foreground mt-3">
              Supported formats: Excel (.xlsx, .xls), CSV, PDF • Max size: 50MB
            </p>
          </>
        )}
      </div>

      {stagedFiles.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-sm">Files to Upload ({stagedFiles.length})</h3>
            <Button 
              onClick={uploadAllFiles} 
              size="sm" 
              disabled={isUploading || !stagedFiles.some((f) => f.status === "pending")}
            >
              {isUploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload All
                </>
              )}
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {stagedFiles.map((staged) => (
              <div
                key={staged.id}
                className={`p-3 rounded-lg border ${
                  staged.status === "complete"
                    ? "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950"
                    : staged.status === "error"
                    ? "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950"
                    : "border-border"
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    {staged.file.name.endsWith(".pdf") ? (
                      <FileText className="h-6 w-6 text-red-600 flex-shrink-0" />
                    ) : (
                      <FileSpreadsheet className="h-6 w-6 text-green-600 flex-shrink-0" />
                    )}
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate" title={staged.file.name}>
                        {staged.file.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatFileSize(staged.file.size)}
                      </p>
                    </div>
                  </div>
                  {staged.status === "pending" && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 flex-shrink-0"
                      onClick={() => removeStagedFile(staged.id)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  )}
                  {staged.status === "complete" && (
                    <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
                  )}
                  {staged.status === "error" && (
                    <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
                  )}
                  {staged.status === "uploading" && (
                    <Loader2 className="h-5 w-5 animate-spin text-primary flex-shrink-0" />
                  )}
                </div>

                {staged.status === "pending" && (
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs">Type</Label>
                        <Select
                          value={staged.docType === 't12' ? 'pnl' : getCurrentSelectValue(staged)}
                          onValueChange={(v) => handleDocTypeChange(staged.id, v)}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue>{staged.docType === 't12' ? 'P&L Statement' : getDocTypeLabel(staged)}</SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(BUILT_IN_DOC_TYPES).filter(([k]) => k !== "other" && k !== "t12").map(([value, { label }]) => (
                              <SelectItem key={value} value={value}>
                                {label}
                              </SelectItem>
                            ))}
                            {customTypes.length > 0 && (
                              <>
                                <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground border-t mt-1 pt-1">
                                  Custom Types
                                </div>
                                {customTypes.map((ct) => (
                                  <SelectItem key={ct.id} value={`custom_${ct.id}`}>
                                    {ct.name}
                                  </SelectItem>
                                ))}
                              </>
                            )}
                            <div className="border-t mt-1 pt-1">
                              <SelectItem value="other">Other (Add New)</SelectItem>
                            </div>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs">Year</Label>
                        <Select
                          value={staged.docType === 't12' ? 'T12' : staged.year}
                          onValueChange={(v) => {
                            if (v === 'T12') {
                              const now = new Date();
                              const endMonth = (now.getMonth() + 1).toString();
                              const endYear = now.getFullYear().toString();
                              const startMonth = endMonth;
                              const startYear = (now.getFullYear() - 1).toString();
                              updateStagedFile(staged.id, {
                                docType: 't12' as DocTypeEnum,
                                t12StartMonth: staged.t12StartMonth || startMonth,
                                t12StartYear: staged.t12StartYear || startYear,
                                t12EndMonth: staged.t12EndMonth || endMonth,
                                t12EndYear: staged.t12EndYear || endYear,
                              });
                            } else {
                              if (staged.docType === 't12') {
                                updateStagedFile(staged.id, { docType: 'pnl' as DocTypeEnum, year: v });
                              } else {
                                updateStagedFile(staged.id, { year: v });
                              }
                            }
                          }}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="T12">T12</SelectItem>
                            {yearOptions.map((y) => (
                              <SelectItem key={y} value={y}>
                                {y}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    {staged.docType === 't12' && (
                      <div className="flex items-center gap-2 flex-wrap text-xs">
                        <span className="text-muted-foreground font-medium">From:</span>
                        <Select value={staged.t12StartMonth || '1'} onValueChange={(v) => updateStagedFile(staged.id, { t12StartMonth: v })}>
                          <SelectTrigger className="h-6 w-[80px] text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {MONTH_OPTIONS.map(m => (
                              <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Select value={staged.t12StartYear || new Date().getFullYear().toString()} onValueChange={(v) => updateStagedFile(staged.id, { t12StartYear: v })}>
                          <SelectTrigger className="h-6 w-[76px] text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {yearOptions.map(y => (
                              <SelectItem key={y} value={y}>{y}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <span className="text-muted-foreground font-medium ml-1">To:</span>
                        <Select value={staged.t12EndMonth || '12'} onValueChange={(v) => updateStagedFile(staged.id, { t12EndMonth: v })}>
                          <SelectTrigger className="h-6 w-[80px] text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {MONTH_OPTIONS.map(m => (
                              <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Select value={staged.t12EndYear || new Date().getFullYear().toString()} onValueChange={(v) => updateStagedFile(staged.id, { t12EndYear: v })}>
                          <SelectTrigger className="h-6 w-[76px] text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {yearOptions.map(y => (
                              <SelectItem key={y} value={y}>{y}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    {staged.docType === "other" && !staged.customTypeId && (
                      <div>
                        <div className="flex gap-1">
                          <Input
                            className="h-8 text-xs flex-1"
                            placeholder="Document Type"
                            value={staged.customTypeName}
                            onChange={(e) => updateStagedFile(staged.id, { customTypeName: e.target.value })}
                          />
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleSaveCustomType(staged.id, staged.customTypeName)}
                            disabled={!staged.customTypeName.trim() || createCustomTypeMutation.isPending}
                            title="Save as custom type"
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {staged.status === "uploading" && (
                  <Progress value={staged.progress} className="h-1.5 mt-2" />
                )}

                {staged.status === "error" && staged.errorMessage && (
                  <p className="text-xs text-red-600 mt-1">{staged.errorMessage}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}