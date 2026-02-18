import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  Clock,
  AlertCircle,
  Eye,
  Trash2,
  Brain,
  ArrowRight,
  BookKey,
  Settings,
  Loader2,
  RefreshCw,
  FolderOpen,
  Import,
  FileText,
  ChevronDown,
  ChevronRight,
  Database,
} from 'lucide-react';
import { Link } from 'wouter';
import { UploadDropzone } from '@/pages/modeling/doc-intel/UploadDropzone';
import type { DocIntelUpload } from '@shared/schema';
import { WorkflowNavigation } from '@/components/modeling/workflow-navigation';

interface WorkspaceUploadsProps {
  projectId: string;
  onTabChange?: (tab: string) => void;
}

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

interface VdrDocument {
  id: string;
  filename: string;
  originalFilename: string;
  mimeType: string;
  size: number;
  storagePath: string;
  folderName: string;
  folderPath: string;
  aiCategory: string | null;
  tags: string[] | null;
  createdAt: string;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(mimeType: string) {
  if (mimeType === 'application/pdf') {
    return <FileText className="h-5 w-5 text-red-500" />;
  }
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel') || mimeType.includes('csv')) {
    return <FileSpreadsheet className="h-5 w-5 text-green-600" />;
  }
  return <FileText className="h-5 w-5 text-muted-foreground" />;
}

export default function WorkspaceUploads({ projectId, onTabChange }: WorkspaceUploadsProps) {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleteConfirmName, setDeleteConfirmName] = useState<string>("");
  const [vdrSectionOpen, setVdrSectionOpen] = useState(true);
  const [importingDocId, setImportingDocId] = useState<string | null>(null);
  const [processingMessageIndex, setProcessingMessageIndex] = useState(0);
  const processingMessages = [
    "Analyzing document structure...",
    "Extracting line items...",
    "Classifying revenue and expenses...",
    "Matching to chart of accounts...",
    "Almost there..."
  ];
  

  const { data: uploads = [], isLoading } = useQuery<UploadWithStats[]>({
    queryKey: ['/api/modeling/projects', projectId, 'documents'],
    enabled: !!projectId,
    refetchInterval: 2000,
  });

  const { data: vdrDocuments = [], isLoading: isLoadingVdr } = useQuery<VdrDocument[]>({
    queryKey: ['/api/modeling/projects', projectId, 'vdr-documents'],
    enabled: !!projectId,
  });

  const hasProcessingUploads = uploads.some(u => (u.status === "processing" || u.status === "uploaded") && u.docType === "pnl");
  useEffect(() => {
    if (!hasProcessingUploads) return;
    const interval = setInterval(() => {
      setProcessingMessageIndex((prev) => (prev + 1) % processingMessages.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [hasProcessingUploads, processingMessages.length]);
  

  const deleteMutation = useMutation({
    mutationFn: (uploadId: string) => apiRequest('DELETE', `/api/modeling/projects/${projectId}/documents/${uploadId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/modeling/projects', projectId, 'documents'] });
      setDeleteConfirmId(null);
      setDeleteConfirmName("");
      toast({ title: 'Deleted', description: 'Document has been removed.' });
    },
    onError: () => {
      setDeleteConfirmId(null);
      setDeleteConfirmName("");
      toast({ title: 'Error', description: 'Failed to delete document.', variant: 'destructive' });
    },
  });

  const reprocessMutation = useMutation({
    mutationFn: (uploadId: string) => apiRequest('POST', `/api/modeling/projects/${projectId}/documents/${uploadId}/reprocess`),
    onSuccess: (_, uploadId) => {
      queryClient.invalidateQueries({ queryKey: ['/api/modeling/projects', projectId, 'documents'] });
      toast({ title: 'Reprocessing', description: 'Document is being reprocessed. You will be redirected to review.' });
      navigate(`/modeling/projects/${projectId}/doc-intel?upload=${uploadId}`);
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to reprocess document.', variant: 'destructive' });
    },
  });

  const importVdrMutation = useMutation({
    mutationFn: (vdrDocumentId: string) => 
      apiRequest('POST', `/api/modeling/projects/${projectId}/import-vdr-document`, { vdrDocumentId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/modeling/projects', projectId, 'documents'] });
      setImportingDocId(null);
      toast({ title: 'Imported', description: 'Document imported from Data Room and queued for AI processing.' });
    },
    onError: () => {
      setImportingDocId(null);
      toast({ title: 'Error', description: 'Failed to import document from Data Room.', variant: 'destructive' });
    },
  });

  const handleDeleteClick = (upload: UploadWithStats) => {
    setDeleteConfirmId(upload.id);
    setDeleteConfirmName(upload.originalName || upload.displayName || "this document");
  };

  const confirmDelete = () => {
    if (deleteConfirmId) {
      deleteMutation.mutate(deleteConfirmId);
    }
  };

  const handleUploadComplete = (upload: DocIntelUpload) => {
    queryClient.invalidateQueries({ queryKey: ['/api/modeling/projects', projectId, 'documents'] });
  };

  const handleReview = (uploadId: string) => {
    navigate(`/modeling/projects/${projectId}/doc-intel?upload=${uploadId}`);
  };

  const handleImportVdrDoc = (docId: string) => {
    setImportingDocId(docId);
    importVdrMutation.mutate(docId);
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: React.ReactNode; label: string }> = {
      uploaded: { variant: 'secondary', icon: <Clock className="h-3 w-3" />, label: 'Pending' },
      processing: { variant: 'default', icon: <Brain className="h-3 w-3 animate-pulse" />, label: 'AI Processing' },
      parsed: { variant: 'outline', icon: <FileSpreadsheet className="h-3 w-3" />, label: 'Ready for Review' },
      reviewing: { variant: 'default', icon: <Eye className="h-3 w-3" />, label: 'In Review' },
      completed: { variant: 'secondary', icon: <CheckCircle2 className="h-3 w-3" />, label: 'Completed' },
      error: { variant: 'destructive', icon: <AlertCircle className="h-3 w-3" />, label: 'Error' },
    };
    const config = statusConfig[status] || statusConfig.uploaded;
    return (
      <Badge variant={config.variant} className="gap-1">
        {config.icon}
        {config.label}
      </Badge>
    );
  };

  const getProgressValue = (upload: UploadWithStats) => {
    if (!upload.stats) return 0;
    const { total, confirmed, rejected } = upload.stats;
    if (total === 0) return 0;
    return Math.round(((confirmed + rejected) / total) * 100);
  };

  const completedUploads = uploads.filter(u => u.status === 'completed');
  const pendingUploads = uploads.filter(u => u.status !== 'completed');

  const vdrDocsByFolder = vdrDocuments.reduce<Record<string, VdrDocument[]>>((acc, doc) => {
    const folder = doc.folderName || 'Root';
    if (!acc[folder]) acc[folder] = [];
    acc[folder].push(doc);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {hasProcessingUploads && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-4 p-8 rounded-lg bg-card border shadow-lg max-w-md">
            <div className="relative">
              <Loader2 className="h-16 w-16 animate-spin text-primary" />
              <Brain className="h-8 w-8 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-primary" />
            </div>
            <div className="text-center">
              <p className="text-lg font-semibold">Processing Documents</p>
              <p className="text-sm text-muted-foreground mt-1">{processingMessages[processingMessageIndex]}</p>
            </div>
            <Progress value={undefined} className="w-64 h-2" />
          </div>
        </div>
      )}

      {onTabChange && (
        <WorkflowNavigation currentTab="uploads" onNavigate={onTabChange} />
      )}
      
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-semibold">Document Uploads</h2>
          <p className="text-sm text-muted-foreground">
            Upload P&L statements and rent rolls for AI-powered parsing and categorization
          </p>
        </div>
        <Link href="/modeling/settings">
          <Button variant="outline" size="sm" className="gap-2" data-testid="button-keyword-bank">
            <BookKey className="h-4 w-4" />
            Keyword Bank
          </Button>
        </Link>
      </div>

      <UploadDropzone 
        projectId={projectId} 
        onUploadComplete={handleUploadComplete}
      />

      {(vdrDocuments.length > 0 || isLoadingVdr) && (
        <Collapsible open={vdrSectionOpen} onOpenChange={setVdrSectionOpen}>
          <Card>
            <CardHeader className="pb-3">
              <CollapsibleTrigger asChild>
                <div className="flex items-center justify-between cursor-pointer">
                  <div className="flex items-center gap-2">
                    <Database className="h-5 w-5 text-blue-500" />
                    <CardTitle className="text-base">Data Room Documents</CardTitle>
                    {vdrDocuments.length > 0 && (
                      <Badge variant="secondary" className="ml-1">{vdrDocuments.length}</Badge>
                    )}
                  </div>
                  {vdrSectionOpen ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
              </CollapsibleTrigger>
              <CardDescription className="mt-1">
                Documents from this deal's Data Room available for quick import
              </CardDescription>
            </CardHeader>
            <CollapsibleContent>
              <CardContent className="pt-0">
                {isLoadingVdr ? (
                  <div className="flex items-center gap-2 py-4 justify-center text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm">Loading Data Room documents...</span>
                  </div>
                ) : vdrDocuments.length === 0 ? (
                  <div className="text-center py-4">
                    <FolderOpen className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">No documents found in the linked Data Room.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {Object.entries(vdrDocsByFolder).map(([folderName, docs]) => (
                      <div key={folderName}>
                        <div className="flex items-center gap-2 mb-2">
                          <FolderOpen className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium text-muted-foreground">{folderName}</span>
                        </div>
                        <div className="space-y-2 ml-6">
                          {docs.map((doc) => {
                            const isImporting = importingDocId === doc.id && importVdrMutation.isPending;
                            return (
                              <div
                                key={doc.id}
                                className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                              >
                                <div className="flex items-center gap-3 min-w-0 flex-1">
                                  {getFileIcon(doc.mimeType)}
                                  <div className="min-w-0 flex-1">
                                    <p className="font-medium text-sm truncate" title={doc.filename}>
                                      {doc.filename}
                                    </p>
                                    <div className="flex items-center gap-2 mt-0.5">
                                      <span className="text-xs text-muted-foreground">
                                        {formatFileSize(doc.size)}
                                      </span>
                                      {doc.aiCategory && (
                                        <Badge variant="outline" className="text-xs px-1.5 py-0">
                                          {doc.aiCategory}
                                        </Badge>
                                      )}
                                    </div>
                                  </div>
                                </div>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="gap-1.5 ml-3 flex-shrink-0"
                                  onClick={() => handleImportVdrDoc(doc.id)}
                                  disabled={isImporting}
                                >
                                  {isImporting ? (
                                    <>
                                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                      Importing...
                                    </>
                                  ) : (
                                    <>
                                      <Import className="h-3.5 w-3.5" />
                                      Import
                                    </>
                                  )}
                                </Button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      )}

      {pendingUploads.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Pending Review</CardTitle>
            <CardDescription>
              Documents awaiting AI processing or user review
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {pendingUploads.map((upload) => (
                <div
                  key={upload.id}
                  className={`flex items-center justify-between p-4 rounded-lg border transition-all duration-500 ${(upload.status === "processing" || upload.status === "uploaded") ? "border-blue-400 bg-gradient-to-r from-blue-50/80 to-indigo-50/80 dark:from-blue-950/30 dark:to-indigo-950/30 shadow-md" : ""}`}
                  data-testid={`upload-pending-${upload.id}`}
                >
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                      <FileSpreadsheet className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium truncate">{upload.originalName}</div>
                      <div className="flex items-center gap-2 mt-1">
                        {getStatusBadge(upload.status)}
                        {upload.documentType && (
                          <Badge variant="outline" className="capitalize">
                            {upload.documentType.replace('_', ' ')}
                          </Badge>
                        )}
                        {(upload as any).dataGranularity === 'annual' && (
                          <Badge variant="secondary" className="text-xs">
                            Annualized
                          </Badge>
                        )}
                      </div>
                      {upload.stats && upload.stats.total > 0 && (
                        <div className="mt-2 space-y-1">
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>Review Progress</span>
                            <span>{upload.stats.confirmed + upload.stats.rejected} / {upload.stats.total} items</span>
                          </div>
                          <Progress value={getProgressValue(upload)} className="h-1.5" />
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    {(upload.status === 'parsed' || upload.status === 'reviewing') && (
                      <Button 
                        size="sm" 
                        onClick={() => handleReview(upload.id)}
                        data-testid={`button-review-${upload.id}`}
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        Review
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteClick(upload)}
                      disabled={deleteMutation.isPending}
                      data-testid={`button-delete-${upload.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {completedUploads.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              Completed Imports
            </CardTitle>
            <CardDescription>
              Documents that have been processed and imported into your P&L
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {completedUploads.map((upload) => (
                <div
                  key={upload.id}
                  className="flex items-center justify-between p-3 rounded-lg border bg-muted/30"
                  data-testid={`upload-completed-${upload.id}`}
                >
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />
                    <div>
                      <div className="font-medium">{upload.originalName}</div>
                      <div className="text-sm text-muted-foreground">
                        {upload.stats?.confirmed || 0} line items imported
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => reprocessMutation.mutate(upload.id)}
                      disabled={reprocessMutation.isPending}
                      className="gap-1"
                    >
                      <RefreshCw className={`h-4 w-4 ${reprocessMutation.isPending ? 'animate-spin' : ''}`} />
                      Reprocess
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteClick(upload)}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {uploads.length === 0 && !isLoading && (
        <Card className="p-8 text-center">
          <FileSpreadsheet className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Documents Yet</h3>
          <p className="text-muted-foreground mb-4">
            Upload your first P&L statement or rent roll to get started with AI-powered analysis.
          </p>
        </Card>
      )}

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
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? (
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
