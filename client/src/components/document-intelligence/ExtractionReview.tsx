import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, AlertCircle, HelpCircle, Edit2, ChevronDown, ChevronRight, Download, Database } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ExtractionField {
  id: string;
  schema_key: string;
  display_label: string;
  field_group: string;
  raw_value: string;
  normalized_value: number | null;
  confidence_score: number;
  confidence_level: 'high' | 'medium' | 'low' | 'manual';
  source_page: number | null;
  source_sheet: string | null;
  source_snippet: string | null;
  is_confirmed: boolean;
  is_manually_overridden: boolean;
  override_value: number | null;
  period_label: string | null;
  proforma_field_key: string | null;
}

interface ValidationWarning {
  rule: string;
  message: string;
  severity: 'warning' | 'error';
}

interface JobStatus {
  fiscal_year: number | null;
  reporting_period: string | null;
}

interface Props {
  jobId: string;
  projectId?: string;
  onPopulate?: () => void;
}

const GROUP_LABELS: Record<string, string> = {
  income: 'Income',
  other_income: 'Other Income',
  expenses: 'Operating Expenses',
  summary: 'Summary',
  debt: 'Debt Service',
  unit_mix: 'Unit Mix',
  monthly_income: 'Monthly Income',
  monthly_expenses: 'Monthly Expenses',
  monthly_summary: 'Monthly Summary',
};

export function ExtractionReview({ jobId, projectId, onPopulate }: Props) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['income', 'expenses', 'summary']));
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null);
  const [fiscalYearOverride, setFiscalYearOverride] = useState<string>('');

  // Fetch job status to get fiscal year info
  const { data: jobStatus } = useQuery<JobStatus>({
    queryKey: ['extraction-job-status', jobId],
    queryFn: () =>
      fetch(`/api/v1/document-extraction/${jobId}/status`, { credentials: 'include' }).then(r => r.json()),
  });

  const detectedFiscalYear = jobStatus?.fiscal_year || new Date().getFullYear();
  const effectiveFiscalYear = fiscalYearOverride ? parseInt(fiscalYearOverride, 10) : detectedFiscalYear;

  const { data: fieldsData, isLoading } = useQuery<{ fields: ExtractionField[]; warnings: ValidationWarning[] }>({
    queryKey: ['extraction-fields', jobId],
    queryFn: () =>
      fetch(`/api/v1/document-extraction/${jobId}/fields`, { credentials: 'include' }).then(r => r.json()),
    refetchInterval: false
  });
  const fields = fieldsData?.fields ?? [];
  const warnings = fieldsData?.warnings ?? [];

  const updateField = useMutation({
    mutationFn: async ({ fieldId, ...body }: { fieldId: string; override_value?: number; is_confirmed?: boolean }) => {
      await fetch(`/api/v1/document-extraction/${jobId}/fields/${fieldId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body)
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['extraction-fields', jobId] })
  });

  const confirmAll = useMutation({
    mutationFn: () =>
      fetch(`/api/v1/document-extraction/${jobId}/confirm-all`, {
        method: 'POST', credentials: 'include'
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['extraction-fields', jobId] });
      toast({ title: 'High & medium confidence fields confirmed' });
    }
  });

  const populateProforma = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/v1/document-extraction/${jobId}/populate-proforma`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ fiscal_year: effectiveFiscalYear })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Failed to populate' }));
        throw new Error(err.error || 'Failed to populate');
      }
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: `Inserted ${data.actualsInserted} actuals into FY ${data.fiscalYear}` });
      onPopulate?.();
    },
    onError: (err: Error) => {
      toast({ title: 'Population failed', description: err.message, variant: 'destructive' });
    }
  });

  const groupedFields = fields.reduce<Record<string, ExtractionField[]>>((acc, f) => {
    const g = f.field_group;
    if (!acc[g]) acc[g] = [];
    acc[g].push(f);
    return acc;
  }, {});

  const confirmedCount = fields.filter(f => f.is_confirmed).length;
  const highConfCount = fields.filter(f => f.confidence_level === 'high').length;
  const totalCount = fields.length;

  const handleExportCSV = () => {
    const rows = [
      ['Field', 'Group', 'Raw Value', 'Normalized Value', 'Confidence', 'Confirmed', 'Source'].join(','),
      ...fields.map(f => [
        `"${f.display_label}"`,
        f.field_group,
        `"${f.raw_value || ''}"`,
        f.override_value ?? f.normalized_value ?? '',
        f.confidence_score,
        f.is_confirmed ? 'Yes' : 'No',
        `"${f.source_snippet?.slice(0, 50) || ''}"`
      ].join(','))
    ].join('\n');

    const blob = new Blob([rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `extraction_${jobId.slice(0, 8)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-blue-200 border-t-blue-500 rounded-full animate-spin mx-auto" />
          <p className="text-sm text-slate-500">Loading extracted fields…</p>
        </div>
      </div>
    );
  }

  if (fields.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-sm text-slate-400">No fields extracted yet. Extraction may still be in progress.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Summary bar */}
      <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center gap-4 justify-between">
        <div className="flex gap-6 text-sm">
          <span className="text-slate-500 dark:text-slate-400">
            <span className="font-semibold text-slate-800 dark:text-slate-200">{totalCount}</span> fields extracted
          </span>
          <span className="text-emerald-600 dark:text-emerald-400">
            <span className="font-semibold">{highConfCount}</span> high confidence
          </span>
          <span className="text-blue-600 dark:text-blue-400">
            <span className="font-semibold">{confirmedCount}</span> confirmed
          </span>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>
          <button
            onClick={() => confirmAll.mutate()}
            disabled={confirmAll.isPending}
            className="px-4 py-1.5 text-sm font-medium bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50 text-slate-700 dark:text-slate-300"
          >
            Accept All High Confidence
          </button>
          {confirmedCount > 0 && (
            <>
              <div className="flex items-center gap-1.5">
                <label className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">FY:</label>
                <input
                  type="number"
                  value={fiscalYearOverride || effectiveFiscalYear}
                  onChange={e => setFiscalYearOverride(e.target.value)}
                  className="w-20 px-2 py-1 text-sm border border-slate-200 dark:border-slate-700 rounded-md bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200"
                  min={2000} max={2050}
                />
                {jobStatus?.reporting_period && (
                  <span className="text-xs text-slate-400" title="Detected from document">
                    ({jobStatus.reporting_period})
                  </span>
                )}
              </div>
              <button
                onClick={() => {
                  if (!projectId) {
                    toast({ title: 'No project linked', description: 'Navigate to Document Intelligence from a project to populate Pro Forma.', variant: 'destructive' });
                    return;
                  }
                  populateProforma.mutate();
                }}
                disabled={populateProforma.isPending}
                className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50"
              >
                <Database className="w-3.5 h-3.5" />
                {populateProforma.isPending ? 'Populating...' : `Populate Pro Forma (${confirmedCount} fields)`}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Validation warnings */}
      {warnings.length > 0 && (
        <div className="px-6 py-3 border-b border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20">
          <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wider mb-1.5">Validation Warnings</p>
          <ul className="space-y-1">
            {warnings.map((w) => (
              <li key={w.rule} className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-300">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                {w.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Field groups */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
        {Object.entries(groupedFields).map(([group, groupFields]) => (
          <div key={group}>
            <button
              onClick={() => setExpandedGroups(prev => {
                const next = new Set(prev);
                next.has(group) ? next.delete(group) : next.add(group);
                return next;
              })}
              className="w-full px-6 py-3 flex items-center gap-2 text-left hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors"
            >
              {expandedGroups.has(group)
                ? <ChevronDown className="w-4 h-4 text-slate-400" />
                : <ChevronRight className="w-4 h-4 text-slate-400" />
              }
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                {GROUP_LABELS[group] || group.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
              </span>
              <span className="ml-auto text-xs text-slate-400">{groupFields.length} fields</span>
            </button>

            {expandedGroups.has(group) && (
              <div className="divide-y divide-slate-50 dark:divide-slate-900">
                {groupFields.map(field => (
                  <FieldRow
                    key={field.id}
                    field={field}
                    isEditing={editingFieldId === field.id}
                    onEdit={() => setEditingFieldId(field.id)}
                    onEditCancel={() => setEditingFieldId(null)}
                    onUpdate={(value) => {
                      updateField.mutate({ fieldId: field.id, override_value: value, is_confirmed: true });
                      setEditingFieldId(null);
                    }}
                    onToggleConfirm={() => {
                      updateField.mutate({ fieldId: field.id, is_confirmed: !field.is_confirmed });
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function FieldRow({
  field, isEditing, onEdit, onEditCancel, onUpdate, onToggleConfirm
}: {
  field: ExtractionField;
  isEditing: boolean;
  onEdit: () => void;
  onEditCancel: () => void;
  onUpdate: (value: number) => void;
  onToggleConfirm: () => void;
}) {
  const [editValue, setEditValue] = useState(String(field.override_value ?? field.normalized_value ?? ''));

  const ConfidenceIcon = field.confidence_level === 'high'
    ? CheckCircle2
    : field.confidence_level === 'medium'
    ? HelpCircle
    : AlertCircle;

  const confidenceColor = field.confidence_level === 'high'
    ? 'text-emerald-500'
    : field.confidence_level === 'medium'
    ? 'text-amber-500'
    : 'text-red-400';

  const displayValue = field.override_value ?? field.normalized_value;
  const isCurrency = field.schema_key.includes('rent') || field.schema_key.includes('income')
    || field.schema_key.includes('expense') || field.schema_key.includes('fee')
    || field.schema_key.includes('noi') || field.schema_key.includes('flow')
    || field.schema_key.includes('payment') || (displayValue !== null && displayValue !== undefined && Math.abs(Number(displayValue)) > 100);

  const formattedValue = displayValue !== null && displayValue !== undefined
    ? (isCurrency
      ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(Number(displayValue))
      : String(displayValue))
    : null;

  return (
    <div className={`px-6 py-2.5 flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors ${
      field.is_confirmed ? 'bg-emerald-50/30 dark:bg-emerald-950/10' : ''
    }`}>
      <ConfidenceIcon className={`w-4 h-4 flex-shrink-0 ${confidenceColor}`} title={`${Math.round((field.confidence_score || 0) * 100)}% confidence`} />

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate">{field.display_label}</p>
        {field.source_snippet && (
          <p className="text-xs text-slate-400 truncate mt-0.5">
            {field.source_page ? `p.${field.source_page} · ` : ''}
            {field.source_sheet ? `${field.source_sheet} · ` : ''}
            "{field.source_snippet.slice(0, 60)}"
          </p>
        )}
        {field.period_label && (
          <span className="text-xs text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
            {field.period_label}
          </span>
        )}
      </div>

      {isEditing ? (
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={editValue}
            onChange={e => setEditValue(e.target.value)}
            className="w-28 px-2 py-1 text-sm border border-blue-400 rounded focus:outline-none focus:ring-2 focus:ring-blue-300 dark:bg-slate-800 dark:text-white"
            autoFocus
            onKeyDown={e => {
              if (e.key === 'Enter') onUpdate(parseFloat(editValue));
              if (e.key === 'Escape') onEditCancel();
            }}
          />
          <button onClick={() => onUpdate(parseFloat(editValue))} className="text-xs text-blue-600 font-medium hover:text-blue-700">Save</button>
          <button onClick={onEditCancel} className="text-xs text-slate-400 hover:text-slate-600">Cancel</button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <span className="text-sm font-mono text-slate-800 dark:text-slate-200 min-w-[80px] text-right">
            {formattedValue ?? <span className="text-slate-300 dark:text-slate-600">—</span>}
          </span>
          <button onClick={onEdit} className="text-slate-300 dark:text-slate-600 hover:text-slate-500 transition-colors">
            <Edit2 className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full tabular-nums ${
        field.confidence_level === 'high'
          ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'
          : field.confidence_level === 'medium'
          ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
          : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
      }`}>
        {Math.round((field.confidence_score ?? 0) * 100)}%
      </span>

      <button
        onClick={onToggleConfirm}
        title={field.is_confirmed ? 'Click to unconfirm' : 'Click to confirm'}
        className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all flex-shrink-0 ${
          field.is_confirmed
            ? 'bg-emerald-500 border-emerald-500'
            : 'border-slate-300 dark:border-slate-600 hover:border-emerald-400'
        }`}
      >
        {field.is_confirmed && <CheckCircle2 className="w-3 h-3 text-white" />}
      </button>
    </div>
  );
}
