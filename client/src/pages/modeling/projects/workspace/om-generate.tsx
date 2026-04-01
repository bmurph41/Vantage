/**
 * Offering Memorandum — Generate Button + Readiness Dialog
 *
 * Renders in the Investment Materials tab. On click, checks token readiness,
 * shows section toggle + missing tokens, and triggers PDF/DOCX generation with polling.
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Loader2, FileText, CheckCircle, AlertCircle, Download, Eye } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface OMGenerateButtonProps {
  dealId?: string;
  projectId: string;
}

interface OMTokenStatus {
  total: number;
  resolved: number;
  unresolved: number;
  resolvedList: Array<{ token: string; formatted: string; source: string }>;
  unresolvedList: Array<{ token: string; source: string; isManual: boolean }>;
  sectionReadiness: Array<{
    key: string;
    title: string;
    required: boolean;
    totalTokens: number;
    resolvedTokens: number;
    ready: boolean;
    autoDisabled: boolean;
  }>;
  overallReady: boolean;
}

export default function OMGenerateButton({ dealId, projectId }: OMGenerateButtonProps) {
  const [showDialog, setShowDialog] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');
  const [disabledSections, setDisabledSections] = useState<Set<string>>(new Set());
  const [exportJobId, setExportJobId] = useState<string | null>(null);
  const [watermark, setWatermark] = useState('');
  const [exportFormat, setExportFormat] = useState<'pdf' | 'docx'>('pdf');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Resolve dealId from project if not provided
  const { data: project } = useQuery<any>({
    queryKey: ['/api/modeling/projects', projectId],
    enabled: !!projectId && !dealId,
  });
  const resolvedDealId = dealId || project?.dealId;

  // Token readiness check
  const { data: tokenStatus, isLoading: checkingTokens } = useQuery<OMTokenStatus>({
    queryKey: ['/api/document-builder/om/token-status', resolvedDealId],
    queryFn: () => apiRequest('GET', `/api/document-builder/om/token-status/${resolvedDealId}?projectId=${projectId}`),
    enabled: !!resolvedDealId && showDialog,
  });

  // Generate mutation
  const generateMutation = useMutation({
    mutationFn: async () => {
      const enabledSections = (tokenStatus?.sectionReadiness || [])
        .filter(s => !s.autoDisabled && !disabledSections.has(s.key))
        .map(s => s.key);
      return apiRequest('POST', '/api/document-builder/om/generate', {
        dealId: resolvedDealId,
        projectId,
        format: exportFormat,
        sections: enabledSections.length > 0 ? enabledSections : undefined,
        options: {
          watermark: watermark || undefined,
        },
      });
    },
    onSuccess: (data: any) => {
      setExportJobId(data.exportJobId);
      toast({
        title: 'OM Generation Started',
        description: `${data.tokenSummary.resolved}/${data.tokenSummary.total} tokens resolved. ~${data.estimatedPages} pages.`,
      });
      setShowDialog(false);
    },
    onError: (err: any) => {
      toast({
        title: 'Generation Failed',
        description: err.message || 'Failed to generate Offering Memorandum',
        variant: 'destructive',
      });
    },
  });

  // Preview fetch
  const fetchPreview = async () => {
    if (!resolvedDealId) return;
    try {
      const data = await apiRequest('GET', `/api/document-builder/om/preview/${resolvedDealId}?projectId=${projectId}`);
      setPreviewHtml((data as any).html);
      setShowPreview(true);
    } catch (err: any) {
      toast({ title: 'Preview Failed', description: err.message, variant: 'destructive' });
    }
  };

  // Export job polling
  const { data: exportJob } = useQuery<any>({
    queryKey: ['/api/document-builder/export', exportJobId],
    queryFn: () => apiRequest('GET', `/api/document-builder/export-jobs/${exportJobId}`),
    enabled: !!exportJobId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status === 'completed' || status === 'failed') return false;
      return 3000;
    },
  });

  const handleOpenDialog = () => {
    setDisabledSections(new Set());
    setWatermark('');
    setExportFormat('pdf');
    setShowDialog(true);
  };

  const toggleSection = (key: string) => {
    setDisabledSections(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  if (!resolvedDealId) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-6 text-center text-muted-foreground text-sm">
          Link a deal to this project to generate an Offering Memorandum.
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4 text-[#B8976A]" />
            Offering Memorandum
          </CardTitle>
          <CardDescription>
            Generate a broker-quality investment package from live workspace data.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Button onClick={handleOpenDialog} className="bg-[#1B365D] hover:bg-[#152a4a]">
              <FileText className="h-4 w-4 mr-2" />
              Generate OM
            </Button>
            <Button variant="outline" onClick={fetchPreview}>
              <Eye className="h-4 w-4 mr-2" />
              Preview
            </Button>
          </div>

          {/* Export job status */}
          {exportJobId && exportJob && (
            <div className="flex items-center gap-2 text-sm">
              {exportJob.status === 'queued' || exportJob.status === 'processing' ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                  <span>Generating {exportFormat.toUpperCase()}...</span>
                </>
              ) : exportJob.status === 'completed' ? (
                <>
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span>{exportFormat.toUpperCase()} ready</span>
                  <Button size="sm" variant="outline" asChild>
                    <a href={`/api/document-builder/export/${exportJobId}/download`} download>
                      <Download className="h-3 w-3 mr-1" />
                      Download
                    </a>
                  </Button>
                </>
              ) : exportJob.status === 'failed' ? (
                <>
                  <AlertCircle className="h-4 w-4 text-red-500" />
                  <span className="text-red-600">Export failed: {exportJob.errorMessage}</span>
                </>
              ) : null}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Readiness Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Generate Offering Memorandum</DialogTitle>
            <DialogDescription>
              Review data readiness and configure before generating.
            </DialogDescription>
          </DialogHeader>

          {checkingTokens ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span className="ml-2 text-sm">Checking data readiness...</span>
            </div>
          ) : tokenStatus ? (
            <div className="space-y-4">
              {/* Readiness summary */}
              <div className={`p-3 rounded-md ${tokenStatus.overallReady ? 'bg-green-50 border border-green-200' : 'bg-amber-50 border border-amber-200'}`}>
                <div className="flex items-center gap-2">
                  {tokenStatus.overallReady ? (
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-amber-600" />
                  )}
                  <span className="text-sm font-medium">
                    {tokenStatus.overallReady ? 'Ready to generate' : 'Some data is missing'}
                  </span>
                </div>
                <p className="text-xs mt-1 text-muted-foreground">
                  {tokenStatus.resolved}/{tokenStatus.total} tokens resolved
                </p>
              </div>

              {/* Missing tokens */}
              {tokenStatus.unresolved > 0 && (
                <div>
                  <p className="text-sm font-medium mb-2">Missing Data ({tokenStatus.unresolved}):</p>
                  <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                    {tokenStatus.unresolvedList.slice(0, 20).map(t => (
                      <Badge key={t.token} variant={t.isManual ? 'outline' : 'destructive'} className="text-xs">
                        {t.token.replace(/_/g, ' ')}
                      </Badge>
                    ))}
                    {tokenStatus.unresolvedList.length > 20 && (
                      <Badge variant="secondary" className="text-xs">+{tokenStatus.unresolvedList.length - 20} more</Badge>
                    )}
                  </div>
                </div>
              )}

              <Separator />

              {/* Section toggles */}
              <div>
                <p className="text-sm font-medium mb-2">Sections</p>
                <div className="space-y-2">
                  {tokenStatus.sectionReadiness
                    .filter(s => !s.autoDisabled)
                    .map(s => (
                    <label key={s.key} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={!disabledSections.has(s.key)}
                        onCheckedChange={() => toggleSection(s.key)}
                      />
                      <span>{s.title}</span>
                      <span className="text-xs text-muted-foreground ml-auto">
                        {s.resolvedTokens}/{s.totalTokens}
                      </span>
                      {s.required && <Badge variant="secondary" className="text-[10px] px-1">Required</Badge>}
                    </label>
                  ))}
                </div>
                {tokenStatus.sectionReadiness.filter(s => s.autoDisabled).length > 0 && (
                  <div className="mt-3">
                    <p className="text-xs text-muted-foreground mb-1">Auto-disabled sections:</p>
                    {tokenStatus.sectionReadiness.filter(s => s.autoDisabled).map(s => (
                      <p key={s.key} className="text-xs text-muted-foreground">
                        {s.title} — missing primary data
                      </p>
                    ))}
                  </div>
                )}
              </div>

              <Separator />

              {/* Options */}
              <div className="space-y-3">
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant={exportFormat === 'pdf' ? 'default' : 'outline'}
                    onClick={() => setExportFormat('pdf')}
                  >
                    PDF
                  </Button>
                  <Button
                    size="sm"
                    variant={exportFormat === 'docx' ? 'default' : 'outline'}
                    onClick={() => setExportFormat('docx')}
                  >
                    DOCX
                  </Button>
                </div>
                <div>
                  <Label className="text-xs">Watermark (optional)</Label>
                  <Input
                    placeholder="e.g., DRAFT"
                    value={watermark}
                    onChange={e => setWatermark(e.target.value)}
                    className="mt-1 h-8 text-sm"
                  />
                </div>
              </div>
            </div>
          ) : null}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
            <Button
              onClick={() => generateMutation.mutate()}
              disabled={generateMutation.isPending}
              className="bg-[#1B365D] hover:bg-[#152a4a]"
            >
              {generateMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <FileText className="h-4 w-4 mr-2" />
              )}
              Generate {exportFormat.toUpperCase()}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-[900px] max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Offering Memorandum Preview</DialogTitle>
            <DialogDescription>
              Green underline = resolved token. Amber highlight = missing token.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-auto bg-gray-100 rounded-md">
            <iframe
              srcDoc={previewHtml}
              className="w-full h-[70vh] border-0"
              title="OM Preview"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPreview(false)}>Close</Button>
            <Button onClick={handleOpenDialog} className="bg-[#1B365D] hover:bg-[#152a4a]">
              <FileText className="h-4 w-4 mr-2" />
              Generate PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
