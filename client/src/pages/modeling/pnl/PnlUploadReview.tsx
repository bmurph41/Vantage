import { useState, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useDropzone } from "react-dropzone";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { 
  Upload, 
  FileSpreadsheet, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  ChevronRight,
  FileText,
  ArrowLeft,
  RefreshCw,
  Check,
  X,
  Loader2,
  Table2,
  List
} from "lucide-react";

interface PnlDocument {
  id: string;
  originalFilename: string;
  mimeType: string;
  byteSize: number;
  createdAt: string;
  sha256: string;
}

interface PnlJob {
  id: string;
  documentId: string;
  status: string;
  stage: string;
  createdAt: string;
  completedAt: string | null;
}

interface ReviewItem {
  id: string;
  extractedLabel: string;
  normalizedLabel: string;
  suggestedCanonicalLineItemId: string | null;
  suggestionJson: any;
  confidence: string;
  status: string;
}

interface CanonicalLineItem {
  id: string;
  canonicalKey: string;
  displayName: string;
  department: string;
  section: string;
}

interface ParsedRow {
  label: string;
  normalizedLabel: string;
  values: Array<{
    periodIndex: number;
    value: number | null;
    trace: any;
  }>;
  mapping?: {
    canonicalLineItemId: string | null;
    mappingMethod: string;
    mappingConfidence: number;
  };
}

interface ParsedStatement {
  periods: Array<{ label: string; year: number; type: string }>;
  rows: ParsedRow[];
  confidence: number;
}

export default function PnlUploadReview() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const { data: projects = [] } = useQuery<Array<{id: string; name: string}>>({
    queryKey: ['/api/modeling/projects'],
  });

  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"list" | "table">("table");
  const [yearHint, setYearHint] = useState<number>(new Date().getFullYear());

  const { data: documents, isLoading: docsLoading } = useQuery<{ documents: PnlDocument[] }>({
    queryKey: ["/api/pnl/documents"],
  });

  const { data: jobData, isLoading: jobLoading, refetch: refetchJob } = useQuery<{ job: PnlJob; reviewNeedsCount: number }>({
    queryKey: [`/api/pnl/jobs/${selectedJobId}`],
    enabled: !!selectedJobId,
  });

  const { data: reviewData, isLoading: reviewLoading } = useQuery<{ items: ReviewItem[] }>({
    queryKey: [`/api/pnl/jobs/${selectedJobId}/review`],
    enabled: !!selectedJobId,
  });

  const { data: parsedData, isLoading: parsedLoading } = useQuery<ParsedStatement>({
    queryKey: [`/api/pnl/jobs/${selectedJobId}/parsed`],
    enabled: !!selectedJobId,
  });

  const { data: canonicalData } = useQuery<{ items: CanonicalLineItem[] }>({
    queryKey: ["/api/pnl/canonical-items"],
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("yearHint", String(yearHint));
        if (selectedProjectId) formData.append("modelingProjectId", selectedProjectId);
      
      const response = await fetch("/api/pnl/upload", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Upload failed");
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      toast({ title: "Upload successful", description: "Processing your P&L document..." });
      queryClient.invalidateQueries({ queryKey: ["/api/pnl/documents"] });
      setSelectedJobId(data.jobId);
      
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: [`/api/pnl/jobs/${data.jobId}`] });
        queryClient.invalidateQueries({ queryKey: [`/api/pnl/jobs/${data.jobId}/review`] });
        queryClient.invalidateQueries({ queryKey: [`/api/pnl/jobs/${data.jobId}/parsed`] });
      }, 2000);
    },
    onError: (error: Error) => {
      toast({ title: "Upload failed", description: error.message, variant: "destructive" });
    },
  });

  const remapMutation = useMutation({
    mutationFn: async ({ extractedLabel, canonicalLineItemId, department, bucket }: { 
      extractedLabel: string; 
      canonicalLineItemId: string;
      department?: string;
      bucket?: string;
    }) => {
      const response = await apiRequest("POST", `/api/pnl/jobs/${selectedJobId}/remap`, {
        extractedLabel,
        canonicalLineItemId,
        saveAsAlias: true,
        addToKeywordBank: true,
        department: department || "General",
        bucket: bucket || "Revenue",
      });
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Mapping saved", description: "This mapping will be remembered for future imports." });
      queryClient.invalidateQueries({ queryKey: [`/api/pnl/jobs/${selectedJobId}/review`] });
      queryClient.invalidateQueries({ queryKey: [`/api/pnl/jobs/${selectedJobId}`] });
    },
    onError: (error: Error) => {
      toast({ title: "Mapping failed", description: error.message, variant: "destructive" });
    },
  });

  const seedCanonicalMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/pnl/canonical-items/seed", {});
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Chart of accounts created", description: "Standard marina P&L categories are now available." });
      queryClient.invalidateQueries({ queryKey: ["/api/pnl/canonical-items"] });
    },
  });

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      uploadMutation.mutate(acceptedFiles[0]);
    }
  }, [uploadMutation, yearHint]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
      "application/vnd.ms-excel": [".xls"],
      "text/csv": [".csv"],
      "application/pdf": [".pdf"],
    },
    maxFiles: 1,
  });

  const canonicalItems = canonicalData?.items || [];
  const reviewItems = reviewData?.items || [];
  const pendingReviewItems = reviewItems.filter(item => item.status === "needs_review");
  const job = jobData?.job;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge className="bg-green-100 text-green-800"><CheckCircle2 className="h-3 w-3 mr-1" />Complete</Badge>;
      case "failed":
        return <Badge variant="destructive"><AlertCircle className="h-3 w-3 mr-1" />Failed</Badge>;
      case "stored":
      case "needs_review":
        return <Badge className="bg-amber-100 text-amber-800"><Clock className="h-3 w-3 mr-1" />Needs Review</Badge>;
      case "processing":
      case "parsed":
      case "mapped":
        return <Badge className="bg-blue-100 text-blue-800"><Loader2 className="h-3 w-3 mr-1 animate-spin" />Processing</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.85) return "text-green-600";
    if (confidence >= 0.7) return "text-amber-600";
    return "text-red-600";
  };

  const formatMoney = (value: number | null) => {
    if (value === null) return "-";
    return new Intl.NumberFormat("en-US", { 
      style: "currency", 
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <div className="container mx-auto p-6 max-w-7xl">

      {/* Project Association */}
      <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg border mb-4">
        <Label className="text-sm font-medium whitespace-nowrap">Link to Project:</Label>
        <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
          <SelectTrigger className="w-[280px]">
            <SelectValue placeholder="None (standalone upload)" />
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
      </div>      <div className="flex items-center gap-4 mb-6">
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => navigate("/modeling")}
          data-testid="button-back"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <div>
          <h1 className="text-2xl font-bold">P&L Parser</h1>
          <p className="text-muted-foreground">Upload and categorize your P&L statements</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Upload Document</CardTitle>
              <CardDescription>Excel, CSV, or PDF files supported</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium">Fiscal Year:</label>
                <Select value={String(yearHint)} onValueChange={(v) => setYearHint(Number(v))}>
                  <SelectTrigger className="w-24" data-testid="select-year">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[2020, 2021, 2022, 2023, 2024, 2025].map((year) => (
                      <SelectItem key={year} value={String(year)}>{year}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                  isDragActive ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50"
                }`}
                data-testid="dropzone-upload"
              >
                <input {...getInputProps()} data-testid="input-file" />
                {uploadMutation.isPending ? (
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="text-sm text-muted-foreground">Uploading...</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <Upload className="h-8 w-8 text-muted-foreground" />
                    <p className="text-sm font-medium">
                      {isDragActive ? "Drop file here" : "Drag & drop or click to upload"}
                    </p>
                    <p className="text-xs text-muted-foreground">.xlsx, .xls, .csv, .pdf</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5" />
                Recent Uploads
              </CardTitle>
            </CardHeader>
            <CardContent>
              {docsLoading ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : documents?.documents?.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No documents uploaded yet</p>
              ) : (
                <ScrollArea className="h-[300px]">
                  <div className="space-y-2">
                    {documents?.documents?.slice(0, 10).map((doc) => (
                      <div
                        key={doc.id}
                        className="p-2 border rounded hover:bg-muted/50 cursor-pointer text-sm"
                        onClick={() => {
                          toast({ title: "Select a job to review", description: "Click on a processing job below" });
                        }}
                        data-testid={`doc-${doc.id}`}
                      >
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <span className="truncate flex-1">{doc.originalFilename}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(doc.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>

          {canonicalItems.length === 0 && (
            <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/30">
              <CardContent className="pt-4">
                <p className="text-sm mb-3">No chart of accounts found. Create standard marina categories?</p>
                <Button 
                  size="sm" 
                  onClick={() => seedCanonicalMutation.mutate()}
                  disabled={seedCanonicalMutation.isPending}
                  data-testid="button-seed-canonical"
                >
                  {seedCanonicalMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Create Standard Categories
                </Button>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="lg:col-span-2">
          {job ? (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">Review Extracted Data</CardTitle>
                    <CardDescription>
                      {pendingReviewItems.length > 0 
                        ? `${pendingReviewItems.length} items need categorization`
                        : "All items have been categorized"
                      }
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(job.status)}
                    <div className="flex border rounded-lg overflow-hidden">
                      <Button 
                        variant={viewMode === "table" ? "default" : "ghost"} 
                        size="sm" 
                        className="rounded-none"
                        onClick={() => setViewMode("table")}
                        data-testid="button-view-table"
                      >
                        <Table2 className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant={viewMode === "list" ? "default" : "ghost"} 
                        size="sm" 
                        className="rounded-none"
                        onClick={() => setViewMode("list")}
                        data-testid="button-view-list"
                      >
                        <List className="h-4 w-4" />
                      </Button>
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => {
                        queryClient.invalidateQueries({ queryKey: [`/api/pnl/jobs/${selectedJobId}`] });
                        queryClient.invalidateQueries({ queryKey: [`/api/pnl/jobs/${selectedJobId}/review`] });
                        queryClient.invalidateQueries({ queryKey: [`/api/pnl/jobs/${selectedJobId}/parsed`] });
                      }}
                      data-testid="button-refresh"
                    >
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {jobLoading || reviewLoading || parsedLoading ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin" />
                  </div>
                ) : viewMode === "table" ? (
                  <div className="border rounded-lg overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/50">
                          <tr>
                            <th className="text-left p-3 font-medium">Line Item</th>
                            <th className="text-left p-3 font-medium">Category</th>
                            {parsedData?.periods?.slice(0, 4).map((period, i) => (
                              <th key={i} className="text-right p-3 font-medium whitespace-nowrap">
                                {period.label}
                              </th>
                            ))}
                            <th className="text-center p-3 font-medium w-20">Confidence</th>
                            <th className="text-center p-3 font-medium w-24">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {parsedData?.rows?.map((row, idx) => {
                            const reviewItem = pendingReviewItems.find(
                              r => r.normalizedLabel === row.normalizedLabel
                            );
                            const needsReview = !!reviewItem;
                            const mappedCanonical = canonicalItems.find(
                              c => c.id === row.mapping?.canonicalLineItemId
                            );
                            
                            return (
                              <tr 
                                key={idx} 
                                className={`border-t ${needsReview ? "bg-amber-50 dark:bg-amber-950/30" : ""}`}
                                data-testid={`row-${idx}`}
                              >
                                <td className="p-3 max-w-[200px] truncate" title={row.label}>
                                  {row.label}
                                </td>
                                <td className="p-3">
                                  {needsReview ? (
                                    <Select
                                      value={reviewItem?.suggestedCanonicalLineItemId || ""}
                                      onValueChange={(value) => {
                                        if (value) {
                                          remapMutation.mutate({
                                            extractedLabel: row.label,
                                            canonicalLineItemId: value,
                                          });
                                        }
                                      }}
                                    >
                                      <SelectTrigger className="h-8 text-xs" data-testid={`select-category-${idx}`}>
                                        <SelectValue placeholder="Select category..." />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {["revenue", "cogs", "expense", "payroll"].map((section) => (
                                          <div key={section}>
                                            <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase">
                                              {section}
                                            </div>
                                            {canonicalItems
                                              .filter(c => c.section === section)
                                              .map((item) => (
                                                <SelectItem key={item.id} value={item.id}>
                                                  {item.displayName}
                                                </SelectItem>
                                              ))
                                            }
                                          </div>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  ) : (
                                    <span className="text-xs text-muted-foreground">
                                      {mappedCanonical?.displayName || "-"}
                                    </span>
                                  )}
                                </td>
                                {parsedData?.periods?.slice(0, 4).map((_, periodIdx) => {
                                  const valueObj = row.values?.find(v => v.periodIndex === periodIdx);
                                  return (
                                    <td key={periodIdx} className="p-3 text-right font-mono text-xs">
                                      {formatMoney(valueObj?.value ?? null)}
                                    </td>
                                  );
                                })}
                                <td className="p-3 text-center">
                                  {row.mapping?.mappingConfidence !== undefined && (
                                    <span className={`text-xs font-medium ${getConfidenceColor(row.mapping.mappingConfidence)}`}>
                                      {Math.round(row.mapping.mappingConfidence * 100)}%
                                    </span>
                                  )}
                                </td>
                                <td className="p-3 text-center">
                                  {needsReview && reviewItem?.suggestedCanonicalLineItemId && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 w-7 p-0 text-green-600 hover:text-green-700 hover:bg-green-100"
                                      onClick={() => {
                                        remapMutation.mutate({
                                          extractedLabel: row.label,
                                          canonicalLineItemId: reviewItem.suggestedCanonicalLineItemId!,
                                        });
                                      }}
                                      data-testid={`button-confirm-${idx}`}
                                    >
                                      <Check className="h-4 w-4" />
                                    </Button>
                                  )}
                                  {!needsReview && row.mapping?.canonicalLineItemId && (
                                    <CheckCircle2 className="h-4 w-4 text-green-600 mx-auto" />
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <ScrollArea className="h-[500px]">
                    <div className="space-y-2">
                      {pendingReviewItems.map((item) => (
                        <div 
                          key={item.id} 
                          className="p-3 border rounded-lg bg-amber-50 dark:bg-amber-950/30"
                          data-testid={`review-item-${item.id}`}
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <p className="font-medium truncate">{item.extractedLabel}</p>
                              {item.suggestionJson?.suggestion && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  Matched: "{item.suggestionJson.suggestion.keyword}" 
                                  ({item.suggestionJson.suggestion.matchType})
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <Select
                                value={item.suggestedCanonicalLineItemId || ""}
                                onValueChange={(value) => {
                                  if (value) {
                                    remapMutation.mutate({
                                      extractedLabel: item.extractedLabel,
                                      canonicalLineItemId: value,
                                      department: item.suggestionJson?.department,
                                      bucket: item.suggestionJson?.bucket,
                                    });
                                  }
                                }}
                              >
                                <SelectTrigger className="w-[200px]" data-testid={`select-category-list-${item.id}`}>
                                  <SelectValue placeholder="Select category..." />
                                </SelectTrigger>
                                <SelectContent>
                                  {canonicalItems.map((cat) => (
                                    <SelectItem key={cat.id} value={cat.id}>
                                      {cat.displayName}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              {item.suggestedCanonicalLineItemId && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="text-green-600 border-green-600 hover:bg-green-50"
                                  onClick={() => {
                                    remapMutation.mutate({
                                      extractedLabel: item.extractedLabel,
                                      canonicalLineItemId: item.suggestedCanonicalLineItemId!,
                                      department: item.suggestionJson?.department,
                                      bucket: item.suggestionJson?.bucket,
                                    });
                                  }}
                                  data-testid={`button-confirm-list-${item.id}`}
                                >
                                  <Check className="h-4 w-4 mr-1" />
                                  Confirm
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                      {pendingReviewItems.length === 0 && (
                        <div className="text-center py-12 text-muted-foreground">
                          <CheckCircle2 className="h-12 w-12 mx-auto mb-4 text-green-500" />
                          <p className="font-medium">All items categorized!</p>
                          <p className="text-sm">Your P&L data has been successfully mapped.</p>
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card className="h-full">
              <CardContent className="flex flex-col items-center justify-center h-[400px] text-center">
                <FileSpreadsheet className="h-16 w-16 text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-medium mb-2">Upload a P&L Document</h3>
                <p className="text-muted-foreground max-w-sm">
                  Upload your profit & loss statement to automatically extract and categorize line items.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
