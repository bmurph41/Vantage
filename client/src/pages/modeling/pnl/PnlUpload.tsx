import { useState, useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useDropzone } from "react-dropzone";
import { Upload, FileText, CheckCircle2, AlertCircle, Loader2, Clock, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiRequest } from "@/lib/queryClient";
import { Link } from "wouter";
import { useLocation } from "wouter";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface PnlJob {
  id: string;
  status: string;
  stage: string;
  retryCount: number;
  lastError: any;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

interface JobStatusResponse {
  job: PnlJob;
  reviewNeedsCount: number;
}

const STATUS_PROGRESS: Record<string, number> = {
  queued: 10,
  processing: 30,
  parsed: 50,
  mapped: 70,
  stored: 90,
  completed: 100,
  failed: 0,
};

const STATUS_LABELS: Record<string, string> = {
  queued: "Queued",
  processing: "Parsing document...",
  parsed: "Document parsed",
  mapped: "Mapping line items...",
  stored: "Storing results...",
  completed: "Complete",
  failed: "Failed",
};

export default function PnlUpload() {
  const [file, setFile] = useState<File | null>(null);
  const [yearHint, setYearHint] = useState<string>("");
  const [statementType, setStatementType] = useState<string>("pnl");
  const [jobId, setJobId] = useState<string | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const queryClient = useQueryClient();

  // Fetch available modeling projects for association
  const { data: projects = [] } = useQuery<Array<{id: string; name: string}>>({
    queryKey: ['/api/modeling/projects'],
  });

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("Select a file");
      const form = new FormData();
      form.append("file", file);
      if (yearHint) form.append("yearHint", yearHint);
      form.append("statementType", statementType);
      if (selectedProjectId) form.append("modelingProjectId", selectedProjectId);
      
      const res = await fetch("/api/pnl/upload", {
        method: "POST",
        body: form,
        credentials: "include",
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text);
      }
      return res.json() as Promise<{ documentId: string; jobId: string }>;
    },
    onSuccess: (data) => {
      setJobId(data.jobId);
      setFile(null);
    },
  });

  const jobQuery = useQuery<JobStatusResponse>({
    queryKey: ["/api/pnl/jobs", jobId],
    enabled: !!jobId,
    refetchInterval: (query) => {
      const status = query.state.data?.job?.status;
      if (status && ["completed", "failed"].includes(status)) {
        return false;
      }
      return 1500;
    },
  });

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setFile(acceptedFiles[0]);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
      "application/vnd.ms-excel": [".xls"],
      "text/csv": [".csv"],
    },
    maxFiles: 1,
  });

  const job = jobQuery.data?.job;
  const status = job?.status ?? "queued";
  const progress = STATUS_PROGRESS[status] ?? 0;
  const reviewNeedsCount = jobQuery.data?.reviewNeedsCount ?? 0;

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 10 }, (_, i) => currentYear - i);

  return (
    <div className="space-y-6 max-w-3xl mx-auto p-6">
      <div>
        <h1 className="text-2xl font-bold" data-testid="page-title">Upload P&L Statement</h1>
        <p className="text-muted-foreground mt-1">
          Upload a P&L document (PDF, Excel, or CSV) for automated extraction and mapping.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Document Upload</CardTitle>
          <CardDescription>
            Drag and drop or click to select a financial statement file
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
              isDragActive
                ? "border-primary bg-primary/5"
                : file
                ? "border-green-500 bg-green-50 dark:bg-green-900/10"
                : "border-muted-foreground/25 hover:border-primary/50"
            }`}
            data-testid="dropzone"
          >
            <input {...getInputProps()} data-testid="file-input" />
            {file ? (
              <div className="flex items-center justify-center gap-2">
                <FileText className="h-8 w-8 text-green-600" />
                <div className="text-left">
                  <p className="font-medium">{file.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
              </div>
            ) : (
              <div>
                <Upload className="h-10 w-10 mx-auto text-muted-foreground" />
                <p className="mt-2 text-sm text-muted-foreground">
                  {isDragActive
                    ? "Drop the file here..."
                    : "Drop a PDF, Excel, or CSV file here, or click to browse"}
                </p>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="yearHint">Fiscal Year (optional)</Label>
              <Select value={yearHint} onValueChange={setYearHint}>
                <SelectTrigger id="yearHint" data-testid="select-year">
                  <SelectValue placeholder="Auto-detect" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Auto-detect</SelectItem>
                  {years.map((y) => (
                    <SelectItem key={y} value={String(y)}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="statementType">Statement Type</Label>
              <Select value={statementType} onValueChange={setStatementType}>
                <SelectTrigger id="statementType" data-testid="select-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pnl">P&L / Income Statement</SelectItem>
                  <SelectItem value="balance_sheet">Balance Sheet</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="projectId">Link to Project</Label>
              <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                <SelectTrigger id="projectId">
                  <SelectValue placeholder="None (standalone)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None (standalone)</SelectItem>
                  {projects.map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button
            onClick={() => uploadMutation.mutate()}
            disabled={!file || uploadMutation.isPending}
            className="w-full"
            data-testid="button-upload"
          >
            {uploadMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Upload & Parse
              </>
            )}
          </Button>

          {uploadMutation.error && (
            <div className="p-3 bg-destructive/10 text-destructive rounded-md text-sm" data-testid="error-upload">
              {String(uploadMutation.error)}
            </div>
          )}
        </CardContent>
      </Card>

      {jobId && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Processing Status
              <Badge variant={status === "completed" ? "default" : status === "failed" ? "destructive" : "secondary"}>
                {STATUS_LABELS[status]}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Progress</span>
                <span>{progress}%</span>
              </div>
              <Progress value={progress} data-testid="progress-bar" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Job ID:</span>
                <p className="font-mono text-xs truncate" data-testid="text-job-id">{jobId}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Stage:</span>
                <p data-testid="text-stage">{job?.stage ?? "-"}</p>
              </div>
            </div>

            {status === "completed" && (
              <div className="flex flex-col gap-3 pt-4 border-t">
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle2 className="h-5 w-5" />
                  <span>Document processed successfully</span>
                </div>
                
                {reviewNeedsCount > 0 && (
                  <div className="flex items-center justify-between p-3 bg-amber-50 dark:bg-amber-900/10 rounded-md">
                    <div className="flex items-center gap-2 text-amber-600">
                      <AlertCircle className="h-5 w-5" />
                      <span>{reviewNeedsCount} items need review</span>
                    </div>
                    <Link href={`/modeling/pnl/review?jobId=${jobId}`}>
                      <Button variant="outline" size="sm" data-testid="button-review">
                        Review Now
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                )}
              </div>
            )}

            {status === "failed" && job?.lastError && (
              <div className="p-3 bg-destructive/10 text-destructive rounded-md text-sm" data-testid="error-job">
                <p className="font-medium">Processing failed</p>
                <p className="text-xs mt-1">{job.lastError.message}</p>
              </div>
            )}

            {jobQuery.isLoading && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Checking status...</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
