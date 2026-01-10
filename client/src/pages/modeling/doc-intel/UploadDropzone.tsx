import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Upload, FileSpreadsheet, X, AlertCircle, Loader2, CheckCircle2, FileText } from "lucide-react";
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

interface StagedFile {
  id: string;
  file: File;
  docType: string;
  customTypeName: string;
  year: string;
  status: "pending" | "uploading" | "complete" | "error";
  progress: number;
  errorMessage?: string;
}

const BUILT_IN_DOC_TYPES = [
  { value: "pnl", label: "P&L Statement" },
  { value: "rent_roll", label: "Rent Roll" },
  { value: "balance_sheet", label: "Balance Sheet" },
  { value: "rate_sheet", label: "Rate Sheet" },
  { value: "invoice", label: "Invoice" },
  { value: "other", label: "Other" },
];

function guessDocType(filename: string): string {
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

  const { data: customTypes = [] } = useQuery<CustomDocumentType[]>({
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

  const allDocTypeOptions = [
    ...BUILT_IN_DOC_TYPES,
    ...customTypes.map((ct) => ({ value: `custom_${ct.id}`, label: ct.name })),
  ];

  const updateStagedFile = (id: string, updates: Partial<StagedFile>) => {
    setStagedFiles((prev) => prev.map((f) => (f.id === id ? { ...f, ...updates } : f)));
  };

  const removeStagedFile = (id: string) => {
    setStagedFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const saveCustomTypeIfNeeded = async (staged: StagedFile): Promise<string> => {
    if (staged.docType === "other" && staged.customTypeName.trim()) {
      const existingCustom = customTypes.find(
        (ct) => ct.name.toLowerCase() === staged.customTypeName.trim().toLowerCase()
      );
      if (existingCustom) {
        return `custom_${existingCustom.id}`;
      }
      try {
        const newType = await createCustomTypeMutation.mutateAsync(staged.customTypeName.trim());
        return `custom_${newType.id}`;
      } catch {
        return staged.customTypeName.trim();
      }
    }
    return staged.docType;
  };

  const uploadSingleFile = async (staged: StagedFile): Promise<DocIntelUpload | null> => {
    try {
      updateStagedFile(staged.id, { status: "uploading", progress: 20 });

      const finalDocType = await saveCustomTypeIfNeeded(staged);
      
      updateStagedFile(staged.id, { progress: 40 });
      
      const csrfToken = await ensureCsrfToken();
      const formData = new FormData();
      formData.append("file", staged.file);
      formData.append("docType", finalDocType);
      formData.append("year", staged.year);

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

  const uploadAllFiles = async () => {
    if (isUploading) return;
    
    const pendingFiles = stagedFiles.filter((f) => f.status === "pending");
    if (pendingFiles.length === 0) return;

    setIsUploading(true);
    let successCount = 0;
    let errorCount = 0;

    for (const staged of pendingFiles) {
      const upload = await uploadSingleFile(staged);
      if (upload) {
        onUploadComplete(upload);
        successCount++;
      } else {
        errorCount++;
      }
    }

    setIsUploading(false);

    setTimeout(() => {
      setStagedFiles((prev) => prev.filter((f) => f.status !== "complete"));
    }, 2000);
    
    if (successCount > 0) {
      toast({ 
        title: "Upload complete", 
        description: `${successCount} document${successCount > 1 ? 's' : ''} uploaded successfully.` 
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
    const newStagedFiles: StagedFile[] = acceptedFiles.map((file) => ({
      id: crypto.randomUUID(),
      file,
      docType: guessDocType(file.name),
      customTypeName: "",
      year: new Date().getFullYear().toString(),
      status: "pending" as const,
      progress: 0,
    }));
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

  return (
    <div className="space-y-4">
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
                          value={staged.docType}
                          onValueChange={(v) => updateStagedFile(staged.id, { docType: v, customTypeName: "" })}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {allDocTypeOptions.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs">Year</Label>
                        <Select
                          value={staged.year}
                          onValueChange={(v) => updateStagedFile(staged.id, { year: v })}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {yearOptions.map((y) => (
                              <SelectItem key={y} value={y}>
                                {y}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    {staged.docType === "other" && (
                      <div>
                        <Input
                          className="h-8 text-xs"
                          placeholder="Document Type"
                          value={staged.customTypeName}
                          onChange={(e) => updateStagedFile(staged.id, { customTypeName: e.target.value })}
                        />
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
