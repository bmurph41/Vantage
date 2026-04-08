import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { useMutation } from '@tanstack/react-query';
import { Upload, FileText, Table2, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';

interface Props {
  projectId?: string;
  onJobCreated: (jobId: string) => void;
}

type DocClass = 'pl' | 'rent_roll' | 'unknown';

export function DocumentUploader({ projectId, onJobCreated }: Props) {
  const [documentClass, setDocumentClass] = useState<DocClass>('unknown');
  const [fiscalYear, setFiscalYear] = useState<string>(String(new Date().getFullYear()));

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('document', file);
      formData.append('document_class', documentClass);
      if (projectId) formData.append('project_id', projectId);
      if (fiscalYear) formData.append('fiscal_year', fiscalYear);

      const res = await fetch('/api/v1/document-extraction/upload', {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Upload failed' }));
        throw new Error(err.error || 'Upload failed');
      }
      return res.json();
    },
    onSuccess: (data) => onJobCreated(data.jobId)
  });

  const onDrop = useCallback((files: File[]) => {
    if (files[0]) uploadMutation.mutate(files[0]);
  }, [uploadMutation]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
      'text/csv': ['.csv']
    },
    maxFiles: 1,
    maxSize: 50 * 1024 * 1024,
    disabled: uploadMutation.isPending
  });

  const docTypes: { value: DocClass; label: string; icon: typeof FileText }[] = [
    { value: 'pl', label: 'P&L / Income Statement', icon: FileText },
    { value: 'rent_roll', label: 'Rent Roll', icon: Table2 },
    { value: 'unknown', label: 'Auto-Detect', icon: Upload },
  ];

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {docTypes.map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            onClick={() => setDocumentClass(value)}
            className={`flex-1 flex flex-col items-center gap-1 p-3 rounded-lg border-2 text-sm font-medium transition-all ${
              documentClass === value
                ? 'border-blue-600 bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300'
                : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 text-slate-600 dark:text-slate-400'
            }`}
          >
            <Icon className="w-4 h-4" />
            <span className="text-center leading-tight">{label}</span>
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <label className="text-sm font-medium text-slate-600 dark:text-slate-400">Fiscal Year:</label>
        <input
          type="number"
          value={fiscalYear}
          onChange={e => setFiscalYear(e.target.value)}
          className="w-24 px-3 py-1.5 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200"
          min={2000} max={2050}
        />
        <span className="text-xs text-slate-400">Claude will refine from document if detected</span>
      </div>

      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all ${
          uploadMutation.isPending
            ? 'border-blue-300 bg-blue-50/50 dark:bg-blue-950/20 cursor-not-allowed'
            : isDragActive
            ? 'border-blue-400 bg-blue-50 dark:bg-blue-950/30'
            : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
        }`}
      >
        <input {...getInputProps()} />
        {uploadMutation.isPending ? (
          <div className="flex flex-col items-center gap-3 text-slate-500 dark:text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            <p className="font-medium">Uploading and parsing document…</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 text-slate-500 dark:text-slate-400">
            <Upload className="w-8 h-8" />
            <p className="font-medium text-slate-700 dark:text-slate-300">
              {isDragActive ? 'Drop your file here' : 'Drop PDF or Excel file here'}
            </p>
            <p className="text-sm">Supports .pdf, .xlsx, .xls, .csv — up to 50MB</p>
          </div>
        )}
      </div>

      {uploadMutation.isSuccess && (
        <div className="flex items-center gap-2 p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-lg">
          <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
          <p className="text-emerald-600 dark:text-emerald-400 text-sm">Document uploaded — extraction in progress</p>
        </div>
      )}

      {uploadMutation.isError && (
        <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg">
          <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
          <p className="text-red-600 dark:text-red-400 text-sm">{String((uploadMutation.error as Error)?.message)}</p>
        </div>
      )}
    </div>
  );
}
