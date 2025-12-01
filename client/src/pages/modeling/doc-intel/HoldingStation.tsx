import { useState, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useDropzone } from "react-dropzone";
import { 
  Upload, 
  FileSpreadsheet, 
  FileText, 
  Trash2, 
  Tag, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  MoreVertical,
  Copy,
  Play,
  X,
  Filter,
  SortAsc,
  Pencil,
  Check
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { DocIntelUpload } from "@shared/schema";
import { format } from "date-fns";

type DocType = "pnl" | "rent_roll" | "balance_sheet" | "rate_sheet" | "invoice" | "other";
type HoldingStatus = "staging" | "validated" | "ready_to_process" | "processing" | "processed";

interface HoldingStationProps {
  projectId: string;
  onProcessDocument: (uploadId: string) => void;
}

interface StagedFile {
  file: File;
  id: string;
  displayName: string;
  docType: DocType;
  year: string;
  tags: string[];
  notes: string;
  status: "pending" | "uploading" | "uploaded" | "error";
  progress: number;
  errorMessage?: string;
}

const DOC_TYPE_LABELS: Record<DocType, { label: string; icon: typeof FileSpreadsheet }> = {
  pnl: { label: "P&L Statement", icon: FileSpreadsheet },
  rent_roll: { label: "Rent Roll", icon: FileText },
  balance_sheet: { label: "Balance Sheet", icon: FileSpreadsheet },
  rate_sheet: { label: "Rate Sheet", icon: FileText },
  invoice: { label: "Invoice", icon: FileText },
  other: { label: "Other", icon: FileText },
};

const HOLDING_STATUS_CONFIG: Record<HoldingStatus, { label: string; color: string; icon: typeof Clock }> = {
  staging: { label: "Staging", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300", icon: Clock },
  validated: { label: "Validated", color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300", icon: CheckCircle2 },
  ready_to_process: { label: "Ready", color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300", icon: Play },
  processing: { label: "Processing", color: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300", icon: Clock },
  processed: { label: "Processed", color: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300", icon: CheckCircle2 },
};

const COMMON_TAGS = ["2024", "2023", "2022", "Annual", "Q1", "Q2", "Q3", "Q4", "Audited", "Draft", "Final"];

export function HoldingStation({ projectId, onProcessDocument }: HoldingStationProps) {
  const { toast } = useToast();
  const [stagedFiles, setStagedFiles] = useState<StagedFile[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editingDocument, setEditingDocument] = useState<DocIntelUpload | null>(null);
  const [filterStatus, setFilterStatus] = useState<HoldingStatus | "all">("all");
  const [filterDocType, setFilterDocType] = useState<DocType | "all">("all");
  const [newTag, setNewTag] = useState("");
  const [editingFileName, setEditingFileName] = useState<string | null>(null);
  const [tempFileName, setTempFileName] = useState("");

  const { data: holdingQueue = [], isLoading, refetch } = useQuery<DocIntelUpload[]>({
    queryKey: ["/api/modeling/projects", projectId, "documents", "holding"],
    queryFn: async () => {
      const res = await fetch(`/api/modeling/projects/${projectId}/documents?holdingOnly=true`);
      if (!res.ok) throw new Error("Failed to fetch holding queue");
      return res.json();
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async (stagedFile: StagedFile) => {
      const formData = new FormData();
      formData.append("file", stagedFile.file);
      formData.append("docType", stagedFile.docType);
      formData.append("year", stagedFile.year);
      formData.append("tags", JSON.stringify(stagedFile.tags));
      formData.append("notes", stagedFile.notes);
      formData.append("holdingStatus", "staging");
      formData.append("displayName", stagedFile.displayName);

      const response = await fetch(`/api/modeling/projects/${projectId}/documents`, {
        method: "POST",
        body: formData,
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Upload failed");
      }
      return response.json();
    },
    onSuccess: () => {
      refetch();
    },
  });

  const updateDocumentMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<DocIntelUpload> }) => {
      return apiRequest("PATCH", `/api/modeling/projects/${projectId}/documents/${id}`, updates);
    },
    onSuccess: () => {
      refetch();
      setEditingDocument(null);
      toast({ title: "Updated", description: "Document has been updated." });
    },
  });

  const deleteDocumentMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/modeling/projects/${projectId}/documents/${id}`);
    },
    onSuccess: () => {
      refetch();
      toast({ title: "Deleted", description: "Document has been removed from the holding station." });
    },
  });

  const validateDocumentMutation = useMutation({
    mutationFn: async (id: string) => {
      const result = await apiRequest("POST", `/api/modeling/projects/${projectId}/documents/${id}/validate`);
      return { id, result };
    },
    onSuccess: ({ id }) => {
      refetch();
      toast({ title: "Validated", description: "Opening Review Wizard to parse document..." });
      // Auto-navigate to Review Wizard for seamless workflow
      setTimeout(() => onProcessDocument(id), 500);
    },
  });

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newStagedFiles: StagedFile[] = acceptedFiles.map((file) => ({
      file,
      id: crypto.randomUUID(),
      displayName: file.name,
      docType: guessDocType(file.name),
      year: new Date().getFullYear().toString(),
      tags: [],
      notes: "",
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
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
      "application/msword": [".doc"],
    },
    maxSize: 50 * 1024 * 1024,
  });

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

  const addTagToStagedFile = (id: string, tag: string) => {
    setStagedFiles((prev) =>
      prev.map((f) => (f.id === id && !f.tags.includes(tag) ? { ...f, tags: [...f.tags, tag] } : f))
    );
  };

  const removeTagFromStagedFile = (id: string, tag: string) => {
    setStagedFiles((prev) => prev.map((f) => (f.id === id ? { ...f, tags: f.tags.filter((t) => t !== tag) } : f)));
  };

  const startRenaming = (id: string, currentName: string) => {
    setEditingFileName(id);
    setTempFileName(currentName);
  };

  const saveRename = (id: string) => {
    if (tempFileName.trim()) {
      updateStagedFile(id, { displayName: tempFileName.trim() });
    }
    setEditingFileName(null);
    setTempFileName("");
  };

  const cancelRename = () => {
    setEditingFileName(null);
    setTempFileName("");
  };

  const uploadAllStaged = async () => {
    for (const staged of stagedFiles.filter((f) => f.status === "pending")) {
      updateStagedFile(staged.id, { status: "uploading", progress: 30 });
      try {
        await uploadMutation.mutateAsync(staged);
        updateStagedFile(staged.id, { status: "uploaded", progress: 100 });
      } catch (error: any) {
        updateStagedFile(staged.id, { status: "error", errorMessage: error.message });
      }
    }
    setTimeout(() => {
      setStagedFiles((prev) => prev.filter((f) => f.status !== "uploaded"));
    }, 2000);
  };

  const filteredQueue = holdingQueue.filter((doc) => {
    if (filterStatus !== "all" && doc.holdingStatus !== filterStatus) return false;
    if (filterDocType !== "all" && doc.docType !== filterDocType) return false;
    return true;
  });

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredQueue.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredQueue.map((d) => d.id)));
    }
  };

  const handleBatchValidate = async () => {
    for (const id of selectedIds) {
      await validateDocumentMutation.mutateAsync(id);
    }
    setSelectedIds(new Set());
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

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Upload Documents
          </CardTitle>
          <CardDescription>
            Drag and drop files to stage them for processing. You can tag, classify, and validate before importing.
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
            data-testid="holding-dropzone"
          >
            <input {...getInputProps()} data-testid="input-file-holding" />
            <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            {isDragActive ? (
              <p className="text-lg font-medium">Drop files here...</p>
            ) : (
              <>
                <p className="text-lg font-medium">Drag & drop files to stage</p>
                <p className="text-sm text-muted-foreground mt-1">or click to browse</p>
                <p className="text-xs text-muted-foreground mt-4">
                  Excel, CSV, PDF, Word • Max 50MB each
                </p>
              </>
            )}
          </div>

          {stagedFiles.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-medium">Staged Files ({stagedFiles.length})</h3>
                <Button onClick={uploadAllStaged} size="sm" data-testid="button-upload-all">
                  <Upload className="h-4 w-4 mr-2" />
                  Upload All
                </Button>
              </div>
              <ScrollArea className="h-[300px]">
                <div className="space-y-3 pr-4">
                  {stagedFiles.map((staged) => (
                    <Card key={staged.id} className="p-4">
                      <div className="flex items-start gap-4">
                        <FileSpreadsheet className="h-10 w-10 text-green-600 flex-shrink-0" />
                        <div className="flex-1 min-w-0 space-y-3">
                          <div className="flex items-center justify-between gap-2">
                            {editingFileName === staged.id ? (
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                <Input
                                  value={tempFileName}
                                  onChange={(e) => setTempFileName(e.target.value)}
                                  className="h-8 flex-1"
                                  autoFocus
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') saveRename(staged.id);
                                    if (e.key === 'Escape') cancelRename();
                                  }}
                                  data-testid={`input-rename-file-${staged.id}`}
                                />
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => saveRename(staged.id)}
                                  data-testid={`button-save-rename-${staged.id}`}
                                >
                                  <Check className="h-4 w-4 text-green-600" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={cancelRename}
                                  data-testid={`button-cancel-rename-${staged.id}`}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <p className="font-medium truncate cursor-default">
                                        {staged.displayName}
                                      </p>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>Original: {staged.file.name}</p>
                                      {staged.displayName !== staged.file.name && (
                                        <p className="text-xs text-muted-foreground">Renamed to: {staged.displayName}</p>
                                      )}
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 flex-shrink-0"
                                  onClick={() => startRenaming(staged.id, staged.displayName)}
                                  data-testid={`button-edit-filename-${staged.id}`}
                                >
                                  <Pencil className="h-3 w-3" />
                                </Button>
                              </div>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removeStagedFile(staged.id)}
                              data-testid={`button-remove-staged-${staged.id}`}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {formatFileSize(staged.file.size)}
                          </p>

                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <Label className="text-xs">Document Type</Label>
                              <Select
                                value={staged.docType}
                                onValueChange={(v) => updateStagedFile(staged.id, { docType: v as DocType })}
                              >
                                <SelectTrigger className="h-8">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {Object.entries(DOC_TYPE_LABELS).map(([key, { label }]) => (
                                    <SelectItem key={key} value={key}>
                                      {label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label className="text-xs">Fiscal Year</Label>
                              <Input
                                type="number"
                                value={staged.year}
                                onChange={(e) => updateStagedFile(staged.id, { year: e.target.value })}
                                className="h-8"
                              />
                            </div>
                          </div>

                          <div>
                            <Label className="text-xs">Tags</Label>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {staged.tags.map((tag) => (
                                <Badge key={tag} variant="secondary" className="text-xs">
                                  {tag}
                                  <button
                                    className="ml-1 hover:text-destructive"
                                    onClick={() => removeTagFromStagedFile(staged.id, tag)}
                                  >
                                    <X className="h-3 w-3" />
                                  </button>
                                </Badge>
                              ))}
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="sm" className="h-6 px-2">
                                    <Tag className="h-3 w-3 mr-1" />
                                    Add
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent>
                                  {COMMON_TAGS.filter((t) => !staged.tags.includes(t)).map((tag) => (
                                    <DropdownMenuItem
                                      key={tag}
                                      onClick={() => addTagToStagedFile(staged.id, tag)}
                                    >
                                      {tag}
                                    </DropdownMenuItem>
                                  ))}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </div>

                          {staged.status === "uploading" && (
                            <Progress value={staged.progress} className="h-2" />
                          )}
                          {staged.status === "error" && (
                            <p className="text-sm text-destructive">{staged.errorMessage}</p>
                          )}
                          {staged.status === "uploaded" && (
                            <p className="text-sm text-green-600 flex items-center gap-1">
                              <CheckCircle2 className="h-4 w-4" />
                              Uploaded successfully
                            </p>
                          )}
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Holding Station Queue
              </CardTitle>
              <CardDescription>
                Review and validate documents before processing
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as HoldingStatus | "all")}>
                <SelectTrigger className="w-[140px]">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  {Object.entries(HOLDING_STATUS_CONFIG).map(([key, { label }]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterDocType} onValueChange={(v) => setFilterDocType(v as DocType | "all")}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {Object.entries(DOC_TYPE_LABELS).map(([key, { label }]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-2 mb-4 p-3 bg-muted rounded-lg">
              <span className="text-sm font-medium">{selectedIds.size} selected</span>
              <Separator orientation="vertical" className="h-4" />
              <Button variant="outline" size="sm" onClick={handleBatchValidate}>
                <CheckCircle2 className="h-4 w-4 mr-1" />
                Validate
              </Button>
              <Button variant="outline" size="sm" onClick={handleBatchDelete} className="text-destructive">
                <Trash2 className="h-4 w-4 mr-1" />
                Delete
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>
                Clear
              </Button>
            </div>
          )}

          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
            </div>
          ) : filteredQueue.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileSpreadsheet className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No documents in holding station</p>
              <p className="text-sm">Upload documents above to get started</p>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center gap-2 px-2 py-1 text-sm text-muted-foreground">
                <Checkbox
                  checked={selectedIds.size === filteredQueue.length && filteredQueue.length > 0}
                  onCheckedChange={toggleSelectAll}
                />
                <span className="flex-1">Select all</span>
              </div>
              {filteredQueue.map((doc) => {
                const statusConfig = HOLDING_STATUS_CONFIG[doc.holdingStatus as HoldingStatus] || HOLDING_STATUS_CONFIG.staging;
                const docTypeConfig = DOC_TYPE_LABELS[doc.docType as DocType] || DOC_TYPE_LABELS.other;
                const Icon = docTypeConfig.icon;

                return (
                  <div
                    key={doc.id}
                    className={`flex items-center gap-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors ${
                      selectedIds.has(doc.id) ? "bg-muted/50 border-primary" : ""
                    }`}
                    data-testid={`holding-item-${doc.id}`}
                  >
                    <Checkbox
                      checked={selectedIds.has(doc.id)}
                      onCheckedChange={(checked) => {
                        const newSelected = new Set(selectedIds);
                        if (checked) {
                          newSelected.add(doc.id);
                        } else {
                          newSelected.delete(doc.id);
                        }
                        setSelectedIds(newSelected);
                      }}
                    />
                    <Icon className="h-8 w-8 text-green-600 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium truncate">{doc.originalName}</p>
                        {doc.isDuplicate && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger>
                                <Badge variant="outline" className="text-orange-600 border-orange-600">
                                  <Copy className="h-3 w-3 mr-1" />
                                  Duplicate
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent>
                                This file may be a duplicate of an existing document
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span>{formatFileSize(doc.fileSize)}</span>
                        <span>•</span>
                        <span>{docTypeConfig.label}</span>
                        {doc.year && (
                          <>
                            <span>•</span>
                            <span>FY {doc.year}</span>
                          </>
                        )}
                        <span>•</span>
                        <span>{format(new Date(doc.createdAt), "MMM d, yyyy")}</span>
                      </div>
                      {doc.holdingTags && doc.holdingTags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {doc.holdingTags.map((tag) => (
                            <Badge key={tag} variant="secondary" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      )}
                      {doc.validationErrors && doc.validationErrors.length > 0 && (
                        <div className="flex items-center gap-1 mt-1 text-destructive text-sm">
                          <AlertTriangle className="h-3 w-3" />
                          {doc.validationErrors.join(", ")}
                        </div>
                      )}
                    </div>
                    <Badge className={statusConfig.color}>
                      {statusConfig.label}
                    </Badge>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setEditingDocument(doc)}>
                          Edit Details
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => validateDocumentMutation.mutate(doc.id)}>
                          <CheckCircle2 className="h-4 w-4 mr-2" />
                          Validate
                        </DropdownMenuItem>
                        {(doc.holdingStatus === "validated" || doc.holdingStatus === "ready_to_process") && (
                          <DropdownMenuItem onClick={() => onProcessDocument(doc.id)}>
                            <Play className="h-4 w-4 mr-2" />
                            Process Now
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => deleteDocumentMutation.mutate(doc.id)}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!editingDocument} onOpenChange={() => setEditingDocument(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Document Details</DialogTitle>
            <DialogDescription>
              Update document classification and metadata
            </DialogDescription>
          </DialogHeader>
          {editingDocument && (
            <div className="space-y-4 py-4">
              <div>
                <Label>Document Type</Label>
                <Select
                  value={editingDocument.docType || "other"}
                  onValueChange={(v) => setEditingDocument({ ...editingDocument, docType: v as DocType })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(DOC_TYPE_LABELS).map(([key, { label }]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Fiscal Year</Label>
                <Input
                  type="number"
                  value={editingDocument.year || ""}
                  onChange={(e) => setEditingDocument({ ...editingDocument, year: parseInt(e.target.value) || null })}
                />
              </div>
              <div>
                <Label>Tags</Label>
                <div className="flex flex-wrap gap-1 mt-1">
                  {(editingDocument.holdingTags || []).map((tag) => (
                    <Badge key={tag} variant="secondary">
                      {tag}
                      <button
                        className="ml-1 hover:text-destructive"
                        onClick={() =>
                          setEditingDocument({
                            ...editingDocument,
                            holdingTags: (editingDocument.holdingTags || []).filter((t) => t !== tag),
                          })
                        }
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
                <div className="flex gap-2 mt-2">
                  <Input
                    placeholder="Add tag..."
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && newTag.trim()) {
                        setEditingDocument({
                          ...editingDocument,
                          holdingTags: [...(editingDocument.holdingTags || []), newTag.trim()],
                        });
                        setNewTag("");
                      }
                    }}
                  />
                  <Button
                    variant="outline"
                    onClick={() => {
                      if (newTag.trim()) {
                        setEditingDocument({
                          ...editingDocument,
                          holdingTags: [...(editingDocument.holdingTags || []), newTag.trim()],
                        });
                        setNewTag("");
                      }
                    }}
                  >
                    Add
                  </Button>
                </div>
              </div>
              <div>
                <Label>Notes</Label>
                <Textarea
                  value={editingDocument.holdingNotes || ""}
                  onChange={(e) => setEditingDocument({ ...editingDocument, holdingNotes: e.target.value })}
                  placeholder="Add any notes about this document..."
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingDocument(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (editingDocument) {
                  updateDocumentMutation.mutate({
                    id: editingDocument.id,
                    updates: {
                      docType: editingDocument.docType,
                      year: editingDocument.year,
                      holdingTags: editingDocument.holdingTags,
                      holdingNotes: editingDocument.holdingNotes,
                    },
                  });
                }
              }}
            >
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
