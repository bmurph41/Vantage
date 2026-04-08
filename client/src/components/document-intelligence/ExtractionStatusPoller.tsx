import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, Clock, AlertCircle, FileSearch, Brain, RefreshCw } from 'lucide-react';

const STATUS_CONFIG = {
  pending: { label: 'Queued', icon: Clock, color: 'text-slate-400' },
  parsing: { label: 'Parsing document structure…', icon: FileSearch, color: 'text-blue-500' },
  extracting: { label: 'Claude extracting fields…', icon: Brain, color: 'text-purple-500' },
  review_required: { label: 'Ready for review', icon: CheckCircle2, color: 'text-emerald-500' },
  confirmed: { label: 'Confirmed & populated', icon: CheckCircle2, color: 'text-emerald-600' },
  failed: { label: 'Extraction failed', icon: AlertCircle, color: 'text-red-500' },
};

const PROGRESS_WIDTH: Record<string, string> = {
  pending: '10%', parsing: '35%', extracting: '70%',
  review_required: '100%', confirmed: '100%', failed: '100%'
};

interface Props {
  jobId: string;
  onStatusChange: (status: string) => void;
}

export function ExtractionStatusPoller({ jobId, onStatusChange }: Props) {
  const { data: job } = useQuery({
    queryKey: ['extraction-job-status', jobId],
    queryFn: () =>
      fetch(`/api/v1/document-extraction/${jobId}/status`, { credentials: 'include' })
        .then(r => r.json()),
    refetchInterval: (query) => {
      const data = query.state.data as any;
      return data?.status && ['review_required', 'confirmed', 'failed'].includes(data.status)
        ? false : 2000;
    }
  });

  useEffect(() => {
    if (job?.status) onStatusChange(job.status);
  }, [job?.status, onStatusChange]);

  if (!job) return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 flex items-center gap-3">
      <RefreshCw className="w-4 h-4 animate-spin text-slate-400" />
      <p className="text-sm text-slate-500">Checking status…</p>
    </div>
  );

  const config = STATUS_CONFIG[job.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.pending;
  const Icon = config.icon;

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 space-y-3">
      <div className="flex items-center gap-3">
        <Icon className={`w-5 h-5 flex-shrink-0 ${config.color}`} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">
            {job.original_filename}
          </p>
          <p className={`text-xs ${config.color}`}>{config.label}</p>
        </div>
      </div>

      <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5">
        <div
          className={`h-1.5 rounded-full transition-all duration-1000 ${
            job.status === 'failed' ? 'bg-red-400' : 'bg-blue-500'
          }`}
          style={{ width: PROGRESS_WIDTH[job.status] || '0%' }}
        />
      </div>

      {(job.page_count || job.document_class) && (
        <p className="text-xs text-slate-400">
          {job.page_count ? `${job.page_count} pages` : ''}
          {job.page_count && job.document_class ? ' · ' : ''}
          {job.document_class ? job.document_class.toUpperCase().replace('_', ' ') : ''}
        </p>
      )}

      {job.error_message && (
        <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg p-2">
          <p className="text-xs text-red-600 dark:text-red-400">{job.error_message}</p>
        </div>
      )}
    </div>
  );
}
