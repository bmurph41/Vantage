import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { useMutation } from "@tanstack/react-query";
import { Upload, FileSpreadsheet, X, AlertCircle, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
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

type DocType = "pnl" | "rent_roll" | "balance_sheet" | "rate_sheet" | "invoice" | "other";
type ProcessingStage = "idle" | "uploading" | "parsing" | "categorizing" | "complete" | "error";

export function UploadDropzone({ projectId, onUploadComplete }: UploadDropzoneProps) {
  const { toast } = useToast();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [docType, setDocType] = useState<DocType>("pnl");
  const [year, setYear] = useState<string>(new Date().getFullYear().toString());
  const [processingStage, setProcessingStage] = useState<ProcessingStage>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const getProgressValue = () => {
    switch (processingStage) {
      case "uploading": return 25;
      case "parsing": return 50;
      case "categorizing": return 75;
      case "complete": return 100;
      default: return 0;
    }
  };

  const getStageLabel = () => {
    switch (processingStage) {
      case "uploading": return "Uploading document...";
      case "parsing": return "Extracting data with AI...";
      case "categorizing": return "Categorizing line items...";
      case "complete": return "Processing complete!";
      default: return "";
    }
  };

  const uploadMutation = useMutation({
    mutationFn: async (formData: FormData) => {
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

  const parseMutation = useMutation({
    mutationFn: async (uploadId: string) => {
      return apiRequest('POST', `/api/modeling/projects/${projectId}/documents/${uploadId}/parse`);
    },
  });

  const categorizeMutation = useMutation({
    mutationFn: async (uploadId: string) => {
      return apiRequest('POST', `/api/modeling/projects/${projectId}/documents/${uploadId}/categorize`);
    },
  });

  const handleUpload = async () => {
    if (!selectedFile) return;

    setErrorMessage(null);
    setProcessingStage("uploading");

    const formData = new FormData();
    formData.append("file", selectedFile);
    formData.append("docType", docType);
    if (year) {
      formData.append("year", year);
    }

    let upload: DocIntelUpload | null = null;
    
    try {
      upload = await uploadMutation.mutateAsync(formData);
      
      if (docType === "pnl" || docType === "rent_roll") {
        setProcessingStage("parsing");
        try {
          await parseMutation.mutateAsync(upload.id);
        } catch (parseError: any) {
          setProcessingStage("complete");
          setSelectedFile(null);
          onUploadComplete(upload);
          toast({ 
            title: "Document uploaded", 
            description: `${upload.originalName} uploaded. Parsing can be triggered manually.`,
            variant: "default"
          });
          return;
        }
        
        setProcessingStage("categorizing");
        try {
          await categorizeMutation.mutateAsync(upload.id);
        } catch (catError: any) {
          setProcessingStage("complete");
          setSelectedFile(null);
          onUploadComplete(upload);
          toast({ 
            title: "Document parsed", 
            description: `${upload.originalName} parsed. Categorization can be completed during review.`,
            variant: "default"
          });
          return;
        }
      }
      
      setProcessingStage("complete");
      
      setTimeout(() => {
        setSelectedFile(null);
        setProcessingStage("idle");
        onUploadComplete(upload!);
        toast({ 
          title: "Document processed", 
          description: `${upload!.originalName} is ready for review.` 
        });
      }, 1000);
      
    } catch (error: any) {
      setProcessingStage("error");
      setErrorMessage(error.message || "Upload failed");
      toast({ 
        title: "Upload failed", 
        description: error.message, 
        variant: "destructive" 
      });
    }
  };

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setSelectedFile(acceptedFiles[0]);
      setProcessingStage("idle");
      setErrorMessage(null);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
      "application/vnd.ms-excel": [".xls"],
      "text/csv": [".csv"],
      "application/pdf": [".pdf"],
    },
    maxFiles: 1,
    maxSize: 50 * 1024 * 1024,
  });

  const clearFile = () => {
    setSelectedFile(null);
    setProcessingStage("idle");
    setErrorMessage(null);
  };

  const isProcessing = ["uploading", "parsing", "categorizing"].includes(processingStage);

  return (
    <div className="space-y-4">
      {!selectedFile ? (
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
            isDragActive
              ? "border-primary bg-primary/5"
              : "border-muted-foreground/25 hover:border-primary/50"
          }`}
          data-testid="dropzone"
        >
          <input {...getInputProps()} data-testid="input-file" />
          <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          {isDragActive ? (
            <p className="text-lg font-medium">Drop your file here...</p>
          ) : (
            <>
              <p className="text-lg font-medium">Drag & drop a file here</p>
              <p className="text-sm text-muted-foreground mt-1">
                or click to browse your files
              </p>
              <p className="text-xs text-muted-foreground mt-4">
                Supported formats: Excel (.xlsx, .xls), CSV, PDF • Max size: 50MB
              </p>
            </>
          )}
        </div>
      ) : (
        <div className="border rounded-lg p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileSpreadsheet className="h-10 w-10 text-green-600" />
              <div>
                <p className="font-medium">{selectedFile.name}</p>
                <p className="text-sm text-muted-foreground">
                  {(selectedFile.size / 1024).toFixed(1)} KB
                </p>
              </div>
            </div>
            {!isProcessing && (
              <Button variant="ghost" size="icon" onClick={clearFile} data-testid="button-clear-file">
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="docType">Document Type</Label>
              <Select 
                value={docType} 
                onValueChange={(v) => setDocType(v as DocType)}
                disabled={isProcessing}
              >
                <SelectTrigger id="docType" data-testid="select-doc-type">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pnl">P&L Statement</SelectItem>
                  <SelectItem value="rent_roll">Rent Roll</SelectItem>
                  <SelectItem value="balance_sheet">Balance Sheet</SelectItem>
                  <SelectItem value="rate_sheet">Rate Sheet</SelectItem>
                  <SelectItem value="invoice">Invoice</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="year">Fiscal Year</Label>
              <Input
                id="year"
                type="number"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                placeholder="e.g., 2024"
                min={2000}
                max={2099}
                disabled={isProcessing}
                data-testid="input-year"
              />
            </div>
          </div>

          {processingStage !== "idle" && processingStage !== "error" && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                {processingStage === "complete" ? (
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                ) : (
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                )}
                <span className="text-sm font-medium">{getStageLabel()}</span>
              </div>
              <Progress value={getProgressValue()} className="h-2" />
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button 
              variant="outline" 
              onClick={clearFile} 
              disabled={isProcessing}
              data-testid="button-cancel"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleUpload} 
              disabled={isProcessing}
              data-testid="button-upload"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                "Upload & Process"
              )}
            </Button>
          </div>

          {processingStage === "error" && errorMessage && (
            <div className="flex items-center gap-2 text-destructive text-sm">
              <AlertCircle className="h-4 w-4" />
              {errorMessage}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
