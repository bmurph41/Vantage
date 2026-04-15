/**
 * Investment Materials Tab — Document Studio
 *
 * Unified experience for generating IC Deal Review Decks and Offering Memoranda
 * directly from live workspace data.
 */

import { useState, useCallback, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Loader2,
  FileText,
  CheckCircle,
  AlertCircle,
  Download,
  Eye,
  Clock,
  Presentation,
  BookOpen,
  ChevronDown,
  ChevronUp,
  XCircle,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format as formatDate } from 'date-fns';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ICDeckTokenStatus {
  ready: boolean;
  requiredTokens: Array<{ token: string; resolved: boolean; value?: string }>;
  optionalTokens: Array<{ token: string; resolved: boolean; value?: string }>;
  sectionsEnabled: string[];
  sectionsDisabled: Array<{ key: string; reason: string }>;
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

interface NormalizedSection {
  key: string;
  title: string;
  resolvedTokens: number;
  totalTokens: number;
  autoDisabled: boolean;
  required: boolean;
}

interface NormalizedTokenStatus {
  overallReady: boolean;
  totalTokens: number;
  resolvedTokens: number;
  sections: NormalizedSection[];
  missingItems: Array<{ label: string; critical: boolean }>;
}

type ExportStatus = 'queued' | 'processing' | 'completed' | 'failed';

interface ExportJobRecord {
  jobId: string;
  format: 'pdf' | 'docx';
  generatedAt: string;
  estimatedPages?: number;
  tokenSummary?: { resolved: number; total: number };
  status: ExportStatus;
}

type DocType = 'ic-deck' | 'om';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normalizeICDeckStatus(raw: ICDeckTokenStatus): NormalizedTokenStatus {
  const all = [...raw.requiredTokens, ...raw.optionalTokens];
  return {
    overallReady: raw.ready,
    totalTokens: all.length,
    resolvedTokens: all.filter(t => t.resolved).length,
    sections: raw.sectionsEnabled.map(key => ({
      key,
      title: key.replace(/^ic_/, '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
      resolvedTokens: 0,
      totalTokens: 0,
      autoDisabled: false,
      required: false,
    })),
    missingItems: raw.requiredTokens
      .filter(t => !t.resolved)
      .map(t => ({ label: t.token.replace(/_/g, ' '), critical: true })),
  };
}

function normalizeOMStatus(raw: OMTokenStatus): NormalizedTokenStatus {
  return {
    overallReady: raw.overallReady,
    totalTokens: raw.total,
    resolvedTokens: raw.resolved,
    sections: raw.sectionReadiness
      .filter(s => !s.autoDisabled)
      .map(s => ({
        key: s.key,
        title: s.title,
        resolvedTokens: s.resolvedTokens,
        totalTokens: s.totalTokens,
        autoDisabled: false,
        required: s.required,
      })),
    missingItems: raw.unresolvedList.slice(0, 30).map(t => ({
      label: t.token.replace(/_/g, ' '),
      critical: !t.isManual,
    })),
  };
}

function historyStorageKey(projectId: string, docType: DocType) {
  return `doc_history_${projectId}_${docType}`;
}

function loadHistory(projectId: string, docType: DocType): ExportJobRecord[] {
  try {
    const raw = localStorage.getItem(historyStorageKey(projectId, docType));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function persistHistory(projectId: string, docType: DocType, records: ExportJobRecord[]) {
  localStorage.setItem(historyStorageKey(projectId, docType), JSON.stringify(records.slice(0, 10)));
}

// ─── Export Job Status Poller ─────────────────────────────────────────────────

interface ExportStatusPollerProps {
  jobId: string;
  format: 'pdf' | 'docx';
  onStatusChange?: (jobId: string, status: ExportStatus) => void;
}

function ExportStatusPoller({ jobId, format, onStatusChange }: ExportStatusPollerProps) {
  const { data: exportJob } = useQuery<any>({
    queryKey: ['/api/document-builder/export-jobs', jobId],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/document-builder/export-jobs/${jobId}`);
      return res.json();
    },
    enabled: !!jobId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status === 'completed' || status === 'failed') return false;
      return 3000;
    },
  });

  const status: ExportStatus | undefined = exportJob?.status;

  useEffect(() => {
    if (status && onStatusChange) {
      onStatusChange(jobId, status);
    }
  }, [jobId, status]);

  if (!exportJob) return null;

  return (
    <div className="flex items-center gap-2 text-sm">
      {status === 'queued' || status === 'processing' ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin text-blue-500 flex-shrink-0" />
          <span className="text-muted-foreground">Generating {format.toUpperCase()}…</span>
        </>
      ) : status === 'completed' ? (
        <>
          <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
          <span>{format.toUpperCase()} ready</span>
          <Button size="sm" variant="outline" className="h-7 text-xs ml-1" asChild>
            <a href={`/api/document-builder/export/${jobId}/download`} download>
              <Download className="h-3 w-3 mr-1" />
              Download
            </a>
          </Button>
        </>
      ) : status === 'failed' ? (
        <>
          <XCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
          <span className="text-red-600 text-xs">Generation failed</span>
        </>
      ) : null}
    </div>
  );
}

// ─── Document Generator Card ──────────────────────────────────────────────────

interface DocumentGeneratorCardProps {
  title: string;
  description: string;
  docType: DocType;
  estimatedPages: number;
  projectId: string;
  dealId: string;
  accentColor?: string;
}

function DocumentGeneratorCard({
  title,
  description,
  docType,
  estimatedPages,
  projectId,
  dealId,
  accentColor = '#1B365D',
}: DocumentGeneratorCardProps) {
  const { toast } = useToast();
  const isOM = docType === 'om';
  const routePrefix = `/api/document-builder/${docType}`;

  const [showDialog, setShowDialog] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');
  const [disabledSections, setDisabledSections] = useState<Set<string>>(new Set());
  const [exportFormat, setExportFormat] = useState<'pdf' | 'docx'>('pdf');
  const [watermark, setWatermark] = useState('');
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [history, setHistory] = useState<ExportJobRecord[]>(() =>
    loadHistory(projectId, docType)
  );
  const [showHistory, setShowHistory] = useState(false);

  // ── Token readiness — fetched at card level (always-on) ──────────────────
  const { data: rawStatus, isLoading: loadingStatus } = useQuery<any>({
    queryKey: [routePrefix + '/token-status', dealId, projectId],
    queryFn: async () => {
      const res = await apiRequest(
        'GET',
        `${routePrefix}/token-status/${dealId}?projectId=${projectId}`
      );
      return res.json();
    },
    enabled: !!dealId,
    staleTime: 60_000,
  });

  const tokenStatus: NormalizedTokenStatus | null = rawStatus
    ? isOM
      ? normalizeOMStatus(rawStatus as OMTokenStatus)
      : normalizeICDeckStatus(rawStatus as ICDeckTokenStatus)
    : null;

  // ── Generate mutation ─────────────────────────────────────────────────────
  const generateMutation = useMutation({
    mutationFn: async () => {
      const enabledSections = tokenStatus
        ? tokenStatus.sections
            .filter(s => !disabledSections.has(s.key))
            .map(s => s.key)
        : [];

      const body = isOM
        ? {
            dealId,
            projectId,
            format: exportFormat,
            sections: enabledSections.length > 0 ? enabledSections : undefined,
            options: { watermark: watermark || undefined },
          }
        : {
            dealId,
            projectId,
            format: 'pdf',
            sections: enabledSections.length > 0 ? enabledSections : undefined,
          };

      const res = await apiRequest('POST', `${routePrefix}/generate`, body);
      return res.json() as Promise<{
        exportJobId: string;
        estimatedPages?: number;
        tokenSummary?: { resolved: number; total: number };
      }>;
    },
    onSuccess: (data) => {
      const jobId = data.exportJobId;
      setActiveJobId(jobId);

      const record: ExportJobRecord = {
        jobId,
        format: isOM ? exportFormat : 'pdf',
        generatedAt: new Date().toISOString(),
        estimatedPages: data.estimatedPages,
        tokenSummary: data.tokenSummary,
        status: 'queued',
      };
      const updated = [record, ...history];
      setHistory(updated);
      persistHistory(projectId, docType, updated);

      const summaryParts: string[] = [];
      if (data.tokenSummary) {
        summaryParts.push(`${data.tokenSummary.resolved}/${data.tokenSummary.total} tokens resolved`);
      }
      if (data.estimatedPages) summaryParts.push(`~${data.estimatedPages} pages`);

      toast({
        title: `${title} Generation Started`,
        description: summaryParts.join(' · ') || 'Generation queued.',
      });
      setShowDialog(false);
    },
    onError: (err: any) => {
      toast({
        title: 'Generation Failed',
        description: err.message || `Failed to generate ${title}`,
        variant: 'destructive',
      });
    },
  });

  // ── Preview fetch ─────────────────────────────────────────────────────────
  const fetchPreview = async () => {
    if (!dealId) return;
    try {
      const res = await apiRequest(
        'GET',
        `${routePrefix}/preview/${dealId}?projectId=${projectId}`
      );
      const data = await res.json();
      setPreviewHtml(data.html);
      setShowPreview(true);
    } catch (err: any) {
      toast({ title: 'Preview Failed', description: err.message, variant: 'destructive' });
    }
  };

  // ── History status updater ────────────────────────────────────────────────
  const handleJobStatusChange = useCallback(
    (jobId: string, status: ExportStatus) => {
      setHistory(prev => {
        const record = prev.find(r => r.jobId === jobId);
        if (!record || record.status === status) return prev;
        const updated = prev.map(r => (r.jobId === jobId ? { ...r, status } : r));
        persistHistory(projectId, docType, updated);
        return updated;
      });
    },
    [projectId, docType]
  );

  const handleOpenDialog = useCallback(() => {
    setDisabledSections(new Set());
    setWatermark('');
    setExportFormat('pdf');
    setShowDialog(true);
  }, []);

  const toggleSection = (key: string) => {
    setDisabledSections(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const readinessPercent = tokenStatus
    ? Math.round((tokenStatus.resolvedTokens / Math.max(tokenStatus.totalTokens, 1)) * 100)
    : 0;

  return (
    <>
      <Card className="flex flex-col h-full">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              {isOM ? (
                <BookOpen className="h-5 w-5 flex-shrink-0" style={{ color: accentColor }} />
              ) : (
                <Presentation className="h-5 w-5 flex-shrink-0" style={{ color: accentColor }} />
              )}
              <CardTitle className="text-base">{title}</CardTitle>
            </div>
            <Badge variant="secondary" className="text-xs flex-shrink-0">
              ~{estimatedPages} pages
            </Badge>
          </div>
          <CardDescription className="mt-1">{description}</CardDescription>
        </CardHeader>

        <CardContent className="space-y-4 flex-1 flex flex-col">
          {/* Token readiness */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Token readiness</span>
              {loadingStatus ? (
                <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
              ) : tokenStatus ? (
                <span className="font-medium tabular-nums">
                  {tokenStatus.resolvedTokens}/{tokenStatus.totalTokens}
                  <span className="text-muted-foreground ml-1">({readinessPercent}%)</span>
                </span>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${readinessPercent}%`,
                  backgroundColor:
                    readinessPercent >= 80
                      ? '#22c55e'
                      : readinessPercent >= 50
                      ? '#f59e0b'
                      : '#ef4444',
                }}
              />
            </div>
            {tokenStatus && tokenStatus.overallReady && (
              <p className="text-xs text-green-600 flex items-center gap-1">
                <CheckCircle className="h-3 w-3" />
                Ready to generate
              </p>
            )}
          </div>

          {/* Formats */}
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span>Formats:</span>
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">PDF</Badge>
            {isOM && <Badge variant="outline" className="text-[10px] px-1.5 py-0">DOCX</Badge>}
          </div>

          {/* Actions */}
          <div className="flex gap-2 flex-wrap mt-auto">
            <Button
              onClick={handleOpenDialog}
              size="sm"
              className="text-white"
              style={{ backgroundColor: accentColor }}
            >
              <FileText className="h-3.5 w-3.5 mr-1.5" />
              Generate
            </Button>
            <Button variant="outline" size="sm" onClick={fetchPreview}>
              <Eye className="h-3.5 w-3.5 mr-1.5" />
              HTML Preview
            </Button>
          </div>

          {/* Active job status */}
          {activeJobId && (
            <ExportStatusPoller
              jobId={activeJobId}
              format={isOM ? exportFormat : 'pdf'}
              onStatusChange={handleJobStatusChange}
            />
          )}

          <Separator className="my-1" />

          {/* History */}
          <div>
            <button
              className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors w-full"
              onClick={() => setShowHistory(v => !v)}
            >
              <Clock className="h-3.5 w-3.5" />
              <span>History ({history.length})</span>
              {showHistory ? (
                <ChevronUp className="h-3 w-3 ml-auto" />
              ) : (
                <ChevronDown className="h-3 w-3 ml-auto" />
              )}
            </button>

            {showHistory && (
              <div className="mt-2 space-y-2">
                {history.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">No generates yet.</p>
                ) : (
                  history.map(record => (
                    <div
                      key={record.jobId}
                      className="flex items-center justify-between gap-2 p-2 rounded-md bg-muted/40 border text-xs"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <Badge variant="outline" className="text-[10px] px-1 py-0 uppercase">
                            {record.format}
                          </Badge>
                          {record.estimatedPages && (
                            <span className="text-muted-foreground">~{record.estimatedPages}p</span>
                          )}
                          {record.tokenSummary && (
                            <span className="text-muted-foreground">
                              {record.tokenSummary.resolved}/{record.tokenSummary.total} tokens
                            </span>
                          )}
                        </div>
                        <p className="text-muted-foreground mt-0.5 truncate">
                          {formatDate(new Date(record.generatedAt), 'MMM d, yyyy h:mm a')}
                        </p>
                      </div>
                      {record.status === 'completed' ? (
                        <Button size="sm" variant="ghost" className="h-6 px-2 text-xs flex-shrink-0" asChild>
                          <a href={`/api/document-builder/export/${record.jobId}/download`} download>
                            <Download className="h-3 w-3 mr-1" />
                            Download
                          </a>
                        </Button>
                      ) : record.status === 'failed' ? (
                        <span className="text-xs text-red-500 flex-shrink-0">Failed</span>
                      ) : (
                        <span className="text-xs text-muted-foreground flex-shrink-0 flex items-center gap-1">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          Generating…
                        </span>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── Generate Dialog ───────────────────────────────────────────────── */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Generate {title}</DialogTitle>
            <DialogDescription>
              Review data readiness and configure before generating.
            </DialogDescription>
          </DialogHeader>

          {loadingStatus ? (
            <div className="flex items-center justify-center py-10 gap-3">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-sm text-muted-foreground">Checking data readiness…</span>
            </div>
          ) : tokenStatus ? (
            <div className="space-y-4">
              {/* Readiness banner */}
              <div
                className={`p-3 rounded-md border text-sm ${
                  tokenStatus.overallReady
                    ? 'bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800'
                    : 'bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800'
                }`}
              >
                <div className="flex items-center gap-2">
                  {tokenStatus.overallReady ? (
                    <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-amber-600 flex-shrink-0" />
                  )}
                  <span className="font-medium">
                    {tokenStatus.overallReady ? 'Ready to generate' : 'Some data is missing'}
                  </span>
                </div>
                <p className="text-xs mt-1 text-muted-foreground">
                  {tokenStatus.resolvedTokens}/{tokenStatus.totalTokens} tokens resolved
                </p>
              </div>

              {/* Missing tokens */}
              {tokenStatus.missingItems.length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-2">Missing Data:</p>
                  <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                    {tokenStatus.missingItems.map((item, i) => (
                      <Badge
                        key={i}
                        variant={item.critical ? 'destructive' : 'outline'}
                        className="text-xs capitalize"
                      >
                        {item.label}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <Separator />

              {/* Section toggles */}
              {tokenStatus.sections.length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-2">
                    Sections (
                    {tokenStatus.sections.filter(s => !disabledSections.has(s.key)).length} enabled)
                  </p>
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {tokenStatus.sections.map(s => (
                      <label key={s.key} className="flex items-center gap-2 text-sm cursor-pointer">
                        <Checkbox
                          checked={!disabledSections.has(s.key)}
                          onCheckedChange={() => toggleSection(s.key)}
                        />
                        <span className="flex-1 leading-tight">{s.title}</span>
                        {s.totalTokens > 0 && (
                          <span className="text-xs text-muted-foreground tabular-nums">
                            {s.resolvedTokens}/{s.totalTokens}
                          </span>
                        )}
                        {s.required && (
                          <Badge variant="secondary" className="text-[10px] px-1">
                            Required
                          </Badge>
                        )}
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <Separator />

              {/* Options */}
              <div className="space-y-3">
                <div>
                  <Label className="text-xs mb-1.5 block">Format</Label>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant={exportFormat === 'pdf' ? 'default' : 'outline'}
                      onClick={() => setExportFormat('pdf')}
                    >
                      PDF
                    </Button>
                    {isOM && (
                      <Button
                        size="sm"
                        variant={exportFormat === 'docx' ? 'default' : 'outline'}
                        onClick={() => setExportFormat('docx')}
                      >
                        DOCX
                      </Button>
                    )}
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Watermark (optional)</Label>
                  <Input
                    placeholder="e.g., DRAFT · CONFIDENTIAL"
                    value={watermark}
                    onChange={e => setWatermark(e.target.value)}
                    className="mt-1 h-8 text-sm"
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Could not load readiness data. You can still generate.
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => generateMutation.mutate()}
              disabled={generateMutation.isPending}
              className="text-white"
              style={{ backgroundColor: accentColor }}
            >
              {generateMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <FileText className="h-4 w-4 mr-2" />
              )}
              Generate {(isOM ? exportFormat : 'pdf').toUpperCase()}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── HTML Preview Dialog ───────────────────────────────────────────── */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-[960px] max-h-[92vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>{title} — HTML Preview</DialogTitle>
            <DialogDescription>
              Green underline = resolved token · Amber highlight = missing token
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-auto bg-muted rounded-md min-h-0">
            <iframe
              srcDoc={previewHtml}
              className="w-full h-[68vh] border-0"
              title={`${title} Preview`}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPreview(false)}>
              Close
            </Button>
            <Button
              onClick={handleOpenDialog}
              className="text-white"
              style={{ backgroundColor: accentColor }}
            >
              <FileText className="h-4 w-4 mr-2" />
              Generate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── Investment Materials Tab ─────────────────────────────────────────────────

interface InvestmentMaterialsTabProps {
  projectId: string;
  dealId?: string | number | null;
}

export default function InvestmentMaterialsTab({ projectId, dealId }: InvestmentMaterialsTabProps) {
  const resolvedDealId = dealId ? String(dealId) : null;

  if (!resolvedDealId) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-12 text-center space-y-2">
          <FileText className="h-10 w-10 mx-auto text-muted-foreground/50" />
          <p className="font-medium text-muted-foreground">No deal linked to this project</p>
          <p className="text-sm text-muted-foreground">
            Link a deal in the Overview tab to enable document generation.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-[#1B365D]" />
          Document Studio
        </h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Generate polished investment materials from live workspace data. All tokens resolve in
          real time from your financial model, deal record, and uploaded documents.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <DocumentGeneratorCard
          title="IC Deal Review Deck"
          description="Data-driven investment committee presentation covering deal overview, financial metrics, debt structure, return scenarios, and risk factors."
          docType="ic-deck"
          estimatedPages={18}
          projectId={projectId}
          dealId={resolvedDealId}
          accentColor="#1B365D"
        />

        <DocumentGeneratorCard
          title="Offering Memorandum"
          description="Broker-quality investment package for buyers and capital partners — market overview, financials, comps, and a full narrative."
          docType="om"
          estimatedPages={32}
          projectId={projectId}
          dealId={resolvedDealId}
          accentColor="#B8976A"
        />
      </div>
    </div>
  );
}
