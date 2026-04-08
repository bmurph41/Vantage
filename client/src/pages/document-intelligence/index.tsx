import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { DocumentUploader } from '@/components/document-intelligence/DocumentUploader';
import { ExtractionReview } from '@/components/document-intelligence/ExtractionReview';
import { ExtractionStatusPoller } from '@/components/document-intelligence/ExtractionStatusPoller';
import { Brain, History, ChevronRight, FileText, Table2, Clock } from 'lucide-react';

type View = 'upload' | 'history';

interface Props {
  projectId?: string;
}

export default function DocumentIntelligencePage({ projectId }: Props) {
  const [, navigate] = useLocation();
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<string>('pending');
  const [view, setView] = useState<View>('upload');

  return (
    <div className="h-full flex flex-col bg-white dark:bg-slate-950">
      {/* Header */}
      <div className="px-8 py-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
            <Brain className="w-4 h-4 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Document Intelligence</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              AI extracts P&amp;L and Rent Roll data directly into your Pro Forma — no copy-paste
            </p>
          </div>
        </div>
        <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
          {([['upload', 'Upload'], ['history', 'History']] as [View, string][]).map(([v, label]) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
                view === v
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {view === 'upload' ? (
        <div className="flex-1 flex min-h-0">
          {/* Left panel — Upload + Status */}
          <div className="w-96 border-r border-slate-200 dark:border-slate-800 p-6 flex flex-col gap-5 overflow-y-auto">
            <div>
              <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">Upload Document</h2>
              <DocumentUploader onJobCreated={(id) => { setJobId(id); setJobStatus('pending'); }} projectId={projectId} />
            </div>

            {jobId && (
              <div>
                <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">Extraction Status</h2>
                <ExtractionStatusPoller jobId={jobId} onStatusChange={setJobStatus} />
              </div>
            )}

            {/* How it works */}
            <div className="mt-auto pt-4 border-t border-slate-100 dark:border-slate-800">
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">How it works</p>
              <ol className="space-y-2">
                {[
                  'Upload a PDF or Excel P&L or Rent Roll',
                  'Claude AI reads and classifies every field',
                  'Review confidence scores and override any value',
                  'Populate directly into your Pro Forma model',
                ].map((step, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <span className="w-4 h-4 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 flex items-center justify-center flex-shrink-0 font-semibold text-[10px] mt-0.5">
                      {i + 1}
                    </span>
                    {step}
                  </li>
                ))}
              </ol>
            </div>
          </div>

          {/* Right panel — Review */}
          <div className="flex-1 min-w-0">
            {jobId && jobStatus === 'review_required' ? (
              <ExtractionReview
                jobId={jobId}
                projectId={projectId}
                onPopulate={(scenarioId) => {
                  const target = projectId
                    ? `/modeling/projects/${projectId}/workspace?tab=pro-forma&from_extraction=${jobId}`
                    : `/document-intelligence`;
                  navigate(target);
                }}
              />
            ) : jobId && !['failed'].includes(jobStatus) ? (
              <div className="h-full flex items-center justify-center">
                <div className="text-center space-y-4">
                  <div className="w-12 h-12 border-4 border-purple-200 dark:border-purple-800 border-t-purple-600 rounded-full animate-spin mx-auto" />
                  <div>
                    <p className="font-medium text-slate-700 dark:text-slate-300">Extracting document data…</p>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Claude is reading your document</p>
                  </div>
                </div>
              </div>
            ) : jobId && jobStatus === 'failed' ? (
              <div className="h-full flex items-center justify-center">
                <div className="text-center space-y-3">
                  <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mx-auto">
                    <span className="text-red-500 text-xl">✗</span>
                  </div>
                  <p className="font-medium text-slate-700 dark:text-slate-300">Extraction failed</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Try uploading a different file or check the error above</p>
                </div>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center">
                <div className="text-center space-y-2 max-w-sm">
                  <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto">
                    <Brain className="w-8 h-8 text-slate-400 dark:text-slate-500" />
                  </div>
                  <p className="text-lg font-semibold text-slate-700 dark:text-slate-300">Upload a document to begin</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Supports PDF and Excel P&amp;L statements and rent rolls
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <ExtractionHistory projectId={projectId} />
      )}
    </div>
  );
}

function ExtractionHistory({ projectId }: { projectId?: string }) {
  const qs = projectId ? `?project_id=${projectId}` : '';
  const { data: jobs = [], isLoading } = useQuery<any[]>({
    queryKey: ['/api/v1/document-extraction/history', projectId],
    queryFn: () =>
      fetch(`/api/v1/document-extraction/history${qs}`, { credentials: 'include' }).then(r => r.json()),
  });

  const statusColors: Record<string, string> = {
    review_required: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30',
    confirmed: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30',
    failed: 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30',
    extracting: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30',
    parsing: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30',
    pending: 'text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900',
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-slate-200 border-t-slate-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (jobs.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-2">
          <History className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto" />
          <p className="text-slate-500 dark:text-slate-400">No extraction history yet</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-3xl mx-auto space-y-2">
        {jobs.map((job: any) => (
          <div key={job.id} className="flex items-center gap-4 p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl hover:border-slate-300 dark:hover:border-slate-700 transition-colors">
            <div className="w-9 h-9 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center flex-shrink-0">
              {job.document_class === 'rent_roll' ? (
                <Table2 className="w-4 h-4 text-slate-500" />
              ) : (
                <FileText className="w-4 h-4 text-slate-500" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">{job.original_filename}</p>
              <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
                <Clock className="w-3 h-3" />
                {new Date(job.created_at).toLocaleDateString()}
                {job.field_count ? ` · ${job.field_count} fields` : ''}
                {job.confirmed_count ? ` · ${job.confirmed_count} confirmed` : ''}
              </p>
            </div>
            <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${statusColors[job.status] || statusColors.pending}`}>
              {job.status.replace(/_/g, ' ')}
            </span>
            <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
}
