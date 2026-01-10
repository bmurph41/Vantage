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
  Play,
  X,
  Filter,
  Pencil,
  Check,
  Loader2,
  Brain,
  Plus
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { DocIntelUpload, CustomDocumentType } from "@shared/schema";
import { format } from "date-fns";

type DocType = "pnl" | "rent_roll" | "balance_sheet" | "rate_sheet" | "invoice" | "other" | string;
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
  customTypeName?: string;
  year: string;
  tags: string[];
  notes: string;
  status: "pending" | "uploading" | "uploaded" | "error";
  progress: number;
  errorMessage?: string;
}

const BUILTIN_DOC_TYPES: Record<string, { label: string; icon: typeof FileSpreadsheet }> = {
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
  const [newCustomTypeName, setNewCustomTypeName] = useState("");
  const [showAddTypeDialog, setShowAddTypeDialog] = useState(false);
  const [parsingDocId, setParsingDocId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleteConfirmName, setDeleteConfirmName] = useState<string>("");

  const { data: holdingQueue = [], isLoading, refetch } = useQuery<DocIntelUpload[]>({
    queryKey: ["/api/modeling/projects", projectId, "documents", "holding"],
    queryFn: async () => {
      const res = await fetch(`/api/modeling/projects/${projectId}/documents?holdingOnly=true`);
      if (!res.ok) throw new Error("Failed to fetch holding queue");
      return res.json();
    },
  });

  const { data: customDocTypes = [] } = useQuery<CustomDocumentType[]>({
    queryKey: ["/api/doc-intel/custom-document-types"],
  });

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
      formData.append("year", stagedFile.year);
      formData.append("tags", JSON.stringify(stagedFile.tags));
      formData.append("notes", stagedFile.notes);
      formData.append("holdingStatus", "staging");
      formData.append("displayName", stagedFile.displayName);
      if (stagedFile.customTypeName) {
        formData.append("customTypeName", stagedFile.customTypeName);
      }

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

  const deleteDocumentMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/modeling/projects/${projectId}/documents/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/modeling/projects", projectId, "documents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/modeling/projects", projectId, "documents", "holding"] });
      setDeleteConfirmId(null);
      setDeleteConfirmName("");
      toast({ title: "Deleted", description: "Document has been removed." });
    },
    onError: (error: any) => {
      toast({ title: "Delete failed", description: error.message || "Could not delete document", variant: "destructive" });
      setDeleteConfirmId(null);
      setDeleteConfirmName("");
    },
  });

  const parseDocumentMutation = useMutation({
    mutationFn: async (id: string) => {
      setParsingDocId(id);
      await apiRequest("POST", `/api/modeling/projects/${projectId}/documents/${id}/parse`);
      return id;
    },
    onSuccess: (id) => {
      refetch();
      setParsingDocId(null);
      toast({ title: "Parsed", description: "Document parsed successfully. Ready for review." });
      onProcessDocument(id);
    },
    onError: (error: any) => {
      setParsingDocId(null);
      toast({ title: "Parse failed", description: error.message || "Failed to parse document", variant: "destructive" });
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
    },
    maxSize: 50 * 1024 * 1024,
    multiple: true,
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

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredQueue.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredQueue.map((d) => d.id)));
    }
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
    if (BUILTIN_DOC_TYPES[docType]) {
      return BUILTIN_DOC_TYPES[docType].label;
    }
    const custom = customDocTypes.find(t => t.id === docType || t.name === docType);
    return custom?.name || docType;
  };

  const allDocTypes = [
    ...Object.entries(BUILTIN_DOC_TYPES).map(([key, { label }]) => ({ key, label })),
    ...customDocTypes.map(t => ({ key: t.id, label: t.name })),
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Upload className="h-5 w-5" />
            Document Uploads
          </CardTitle>
          <CardDescription>
            Upload P&L statements and rent rolls for AI-powered parsing and categorization
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
              isDragActive
                ? "border-primary bg-primary/5"
                : "border-muted-foreground/25 hover:border-primary/50"
            }`}
          >
            <input {...getInputProps()} />
            <Upload className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
            {isDragActive ? (
              <p className="font-medium">Drop files here...</p>
            ) : (
              <>
                <p className="font-medium">Drag & drop a file here</p>
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
                <h3 className="font-medium text-sm">Staged Files ({stagedFiles.length})</h3>
                <Button onClick={uploadAllStaged} size="sm">
                  <Upload className="h-4 w-4 mr-2" />
                  Upload All
                </Button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {stagedFiles.map((staged) => (
                  <Card key={staged.id} className="p-3">
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <FileSpreadsheet className="h-8 w-8 text-green-600 flex-shrink-0" />
                          <div className="min-w-0">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <p className="font-medium text-sm truncate">{staged.displayName}</p>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>{staged.file.name}</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                            <p className="text-xs text-muted-foreground">{formatFileSize(staged.file.size)}</p>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 flex-shrink-0"
                          onClick={() => removeStagedFile(staged.id)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-xs">Document Type</Label>
                          <Select
                            value={staged.docType}
                            onValueChange={(v) => {
                              updateStagedFile(staged.id, { docType: v as DocType, customTypeName: undefined });
                            }}
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {allDocTypes.map(({ key, label }) => (
                                <SelectItem key={key} value={key}>{label}</SelectItem>
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
                            className="h-8 text-xs"
                          />
                        </div>
                      </div>

                      {staged.docType === "other" && (
                        <div>
                          <Label className="text-xs">Custom Type Name</Label>
                          <div className="flex gap-2">
                            <Input
                              value={staged.customTypeName || ""}
                              onChange={(e) => updateStagedFile(staged.id, { customTypeName: e.target.value })}
                              placeholder="Enter custom type name"
                              className="h-8 text-xs flex-1"
                            />
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 px-2"
                              onClick={() => {
                                if (staged.customTypeName?.trim()) {
                                  createCustomTypeMutation.mutate(staged.customTypeName.trim());
                                }
                              }}
                              disabled={!staged.customTypeName?.trim() || createCustomTypeMutation.isPending}
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      )}

                      {staged.status === "uploading" && (
                        <Progress value={staged.progress} className="h-1.5" />
                      )}
                      {staged.status === "error" && (
                        <p className="text-xs text-destructive">{staged.errorMessage}</p>
                      )}
                      {staged.status === "uploaded" && (
                        <p className="text-xs text-green-600 flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" />
                          Uploaded
                        </p>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Clock className="h-5 w-5" />
                Pending Review
              </CardTitle>
              <CardDescription>
                Documents awaiting AI processing or user review
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAddTypeDialog(true)}
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Type
              </Button>
              {selectedIds.size > 0 && (
                <Button variant="destructive" size="sm" onClick={handleBatchDelete}>
                  <Trash2 className="h-4 w-4 mr-1" />
                  Delete ({selectedIds.size})
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredQueue.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileSpreadsheet className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="font-medium">No Documents Yet</p>
              <p className="text-sm">Upload your first P&L statement or rent roll to get started with AI-powered analysis.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredQueue.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <Checkbox
                    checked={selectedIds.has(doc.id)}
                    onCheckedChange={() => toggleSelect(doc.id)}
                  />
                  <FileSpreadsheet className="h-8 w-8 text-green-600 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{doc.originalName}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{getDocTypeLabel(doc.docType || "other")}</span>
                      {doc.year && <span>• {doc.year}</span>}
                      <span>• {formatFileSize(doc.fileSize)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={doc.status === "parsed" ? "default" : "secondary"} className="text-xs">
                      {doc.status === "uploaded" && <Clock className="h-3 w-3 mr-1" />}
                      {doc.status === "parsed" && <CheckCircle2 className="h-3 w-3 mr-1" />}
                      {doc.status === "reviewing" && <Brain className="h-3 w-3 mr-1" />}
                      {doc.status === "uploaded" ? "Pending" : doc.status}
                    </Badge>
                    {doc.status === "uploaded" && (
                      <Button
                        size="sm"
                        onClick={() => parseDocumentMutation.mutate(doc.id)}
                        disabled={parsingDocId === doc.id}
                      >
                        {parsingDocId === doc.id ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                            Parsing...
                          </>
                        ) : (
                          <>
                            <Brain className="h-4 w-4 mr-1" />
                            Parse
                          </>
                        )}
                      </Button>
                    )}
                    {(doc.status === "parsed" || doc.status === "reviewing") && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onProcessDocument(doc.id)}
                      >
                        <CheckCircle2 className="h-4 w-4 mr-1" />
                        Review
                      </Button>
                    )}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => {
                          setDeleteConfirmId(doc.id);
                          setDeleteConfirmName(doc.originalFileName || doc.displayName || "this document");
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

      <Dialog open={showAddTypeDialog} onOpenChange={setShowAddTypeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Custom Document Type</DialogTitle>
            <DialogDescription>
              Create a new document type that will be available across all your projects.
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
              Are you sure you want to delete "{deleteConfirmName}"? This action cannot be undone and will permanently remove the document and all its extracted data.
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
