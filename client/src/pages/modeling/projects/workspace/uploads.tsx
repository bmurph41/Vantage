import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
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
  Settings
} from 'lucide-react';
import { Link } from 'wouter';
import { UploadDropzone } from '@/pages/modeling/doc-intel/UploadDropzone';
import type { DocIntelUpload } from '@shared/schema';

interface WorkspaceUploadsProps {
  projectId: string;
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

export default function WorkspaceUploads({ projectId }: WorkspaceUploadsProps) {
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const { data: uploads = [], isLoading } = useQuery<UploadWithStats[]>({
    queryKey: ['/api/modeling/projects', projectId, 'documents'],
    enabled: !!projectId,
  });

  const deleteMutation = useMutation({
    mutationFn: (uploadId: string) => apiRequest('DELETE', `/api/modeling/doc-intel/uploads/${uploadId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/modeling/projects', projectId, 'documents'] });
      toast({ title: 'Deleted', description: 'Document has been removed.' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to delete document.', variant: 'destructive' });
    },
  });

  const handleUploadComplete = (upload: DocIntelUpload) => {
    queryClient.invalidateQueries({ queryKey: ['/api/modeling/projects', projectId, 'documents'] });
  };

  const handleReview = (uploadId: string) => {
    navigate(`/modeling/projects/${projectId}/doc-intel?upload=${uploadId}`);
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

  return (
    <div className="space-y-6">
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
                  className="flex items-center justify-between p-4 rounded-lg border"
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
                      onClick={() => deleteMutation.mutate(upload.id)}
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
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteMutation.mutate(upload.id)}
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
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
    </div>
  );
}
