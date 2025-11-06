import { useState, useCallback, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, Upload as UploadIcon, X, Check, AlertTriangle } from "lucide-react";
import { useDropzone } from "react-dropzone";
import { useMutation, useQuery } from "@tanstack/react-query";
import { salesCompsApi } from "@/lib/salescomps/api";
import { queryClient } from "@/lib/queryClient";
import { formatFileSize } from "@/lib/salescomps/format";
import ColumnMapper from "@/components/salescomps/sales-comps/ColumnMapper";
import DuplicateReview from "@/components/salescomps/sales-comps/DuplicateReview";
import { useToast } from "@/hooks/use-toast";

interface UploadProps {
  onClose: () => void;
  onImportComplete?: () => void;
}

export default function Upload({ onClose, onImportComplete }: UploadProps) {
  const { toast } = useToast();
  const [step, setStep] = useState<'upload' | 'mapping' | 'duplicates' | 'processing' | 'complete'>('upload');
  const [uploadData, setUploadData] = useState<{
    importId: string;
    analysis: any;
  } | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [normalization, setNormalization] = useState({
    currency: true,
    months: true,
    states: true,
    undisclosed: true,
  });
  const [duplicates, setDuplicates] = useState<any[]>([]);
  const [excludedRows, setExcludedRows] = useState<number[]>([]);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const uploadMutation = useMutation({
    mutationFn: salesCompsApi.uploadFile,
    onSuccess: (data) => {
      setUploadData(data);
      setMapping(data.analysis.suggestedMapping);
      setStep('mapping');
    },
    onError: (error) => {
      toast({
        title: "Upload Failed",
        description: (error as Error).message,
        variant: "destructive",
      });
    },
  });

  const detectDuplicatesMutation = useMutation({
    mutationFn: ({ importId, mapping, normalization }: any) =>
      salesCompsApi.detectDuplicates(importId, mapping, normalization),
    onSuccess: (data) => {
      setDuplicates(data.duplicates || []);
      if (data.duplicatesFound > 0) {
        setStep('duplicates');
      } else {
        // No duplicates found, proceed directly to processing
        handleCommitAfterDuplicateCheck();
      }
    },
    onError: (error) => {
      toast({
        title: "Duplicate Detection Failed",
        description: (error as Error).message,
        variant: "destructive",
      });
    },
  });

  const commitMutation = useMutation({
    mutationFn: ({ importId, mapping, normalization, excludedRows }: any) =>
      salesCompsApi.commitImport(importId, mapping, normalization, excludedRows),
    onSuccess: () => {
      setStep('processing');
      // Poll for completion status
      pollStatus();
    },
    onError: (error) => {
      toast({
        title: "Import Failed", 
        description: (error as Error).message,
        variant: "destructive",
      });
    },
  });

  const { data: importStatus } = useQuery({
    queryKey: ['import-status', uploadData?.importId],
    queryFn: () => uploadData ? salesCompsApi.getImportStatus(uploadData.importId) : null,
    enabled: !!uploadData && step === 'processing',
    refetchInterval: step === 'processing' ? 2000 : false,
  });

  const pollStatus = () => {
    // Clear any existing interval
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
    }
    
    pollIntervalRef.current = setInterval(async () => {
      if (!uploadData) return;
      
      try {
        const status = await salesCompsApi.getImportStatus(uploadData.importId);
        if (status.status === 'completed' || status.status === 'failed') {
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }
          setStep('complete');
          
          // Invalidate sales comps cache to refresh the data grid automatically
          if (status.status === 'completed') {
            await queryClient.invalidateQueries({ queryKey: ['comps'] });
            await queryClient.invalidateQueries({ queryKey: ['/api/sales-comps'] });
            
            // Notify parent component that import is complete
            onImportComplete?.();
            
            toast({
              title: "Import Completed",
              description: `Successfully imported ${status.summary?.successCount || 0} records. The data grid will automatically refresh.`,
              variant: "default",
            });
          }
        }
      } catch (error) {
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
        console.error('Error polling status:', error);
      }
    }, 2000);
  };

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, []);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      uploadMutation.mutate(file);
    }
  }, [uploadMutation]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
    },
    maxFiles: 1,
    maxSize: 50 * 1024 * 1024, // 50MB
  });

  const handleDetectDuplicates = () => {
    if (!uploadData) return;
    
    detectDuplicatesMutation.mutate({
      importId: uploadData.importId,
      mapping,
      normalization,
    });
  };

  const handleCommitAfterDuplicateCheck = () => {
    if (!uploadData) return;
    
    commitMutation.mutate({
      importId: uploadData.importId,
      mapping,
      normalization,
      excludedRows,
    });
  };

  const handleExcludeChange = (rowIndex: number, exclude: boolean) => {
    setExcludedRows(prev => 
      exclude 
        ? [...prev, rowIndex]
        : prev.filter(idx => idx !== rowIndex)
    );
  };

  const handleBack = () => {
    if (step === 'mapping') {
      setStep('upload');
    } else if (step === 'duplicates') {
      setStep('mapping');
    }
  };

  const renderUploadStep = () => (
    <div>
      <div className="mb-6">
        <h3 className="text-lg font-medium text-foreground mb-2">Step 1: Upload File</h3>
        <p className="text-sm text-muted-foreground">Upload a CSV or Excel file containing marina sales data</p>
      </div>

      <div 
        {...getRootProps()}
        className={`upload-dropzone rounded-lg p-8 text-center mb-6 cursor-pointer border-2 border-dashed ${
          isDragActive ? 'border-primary bg-primary/10' : 'border-border'
        }`}
        data-testid="upload-dropzone"
      >
        <input {...getInputProps()} />
        <div className="mb-4">
          <UploadIcon className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <h4 className="text-lg font-medium text-foreground mb-2">
            {isDragActive ? 'Drop your file here' : 'Drop your file here'}
          </h4>
          <p className="text-sm text-muted-foreground mb-4">
            or click to browse
          </p>
          <Button variant="default" disabled={uploadMutation.isPending}>
            {uploadMutation.isPending ? 'Uploading...' : 'Choose File'}
          </Button>
        </div>
        <div className="text-xs text-muted-foreground">
          Supports CSV, Excel (.xlsx, .xls) • Max 50MB • Up to 1M rows
        </div>
      </div>
    </div>
  );

  const renderMappingStep = () => (
    <div>
      <div className="mb-6">
        <h3 className="text-lg font-medium text-foreground mb-2">Step 2: Map Columns</h3>
        <p className="text-sm text-muted-foreground">Map your file columns to MarinaMatch fields</p>
      </div>

      {uploadData && (
        <>
          {/* File Preview */}
          <Card className="p-4 mb-6">
            <div className="flex items-center gap-3 mb-3">
              <UploadIcon className="h-5 w-5 text-primary" />
              <div className="flex-1">
                <div className="font-medium text-foreground">File uploaded successfully</div>
                <div className="text-sm text-muted-foreground">
                  {uploadData.analysis.headers.length} columns • 
                  ~{uploadData.analysis.estimatedRows} rows
                </div>
              </div>
            </div>
          </Card>

          <ColumnMapper
            analysis={uploadData.analysis}
            mapping={mapping}
            onMappingChange={setMapping}
            normalization={normalization}
            onNormalizationChange={setNormalization}
          />
        </>
      )}
    </div>
  );

  const renderDuplicatesStep = () => (
    <div>
      <div className="mb-6">
        <h3 className="text-lg font-medium text-foreground mb-2">Step 3: Review Duplicates</h3>
        <p className="text-sm text-muted-foreground">
          We found {duplicates.length} potential duplicates. Review and exclude any you don't want to import.
        </p>
      </div>

      <DuplicateReview
        duplicates={duplicates}
        excludedRows={excludedRows}
        onExcludeChange={handleExcludeChange}
      />
    </div>
  );

  const renderProcessingStep = () => (
    <div>
      <div className="mb-6">
        <h3 className="text-lg font-medium text-foreground mb-2">Step 3: Importing Data</h3>
        <p className="text-sm text-muted-foreground">Processing your file and importing records</p>
      </div>

      <div className="space-y-4">
        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-foreground">Processing rows...</span>
            <span className="text-sm text-muted-foreground">
              {importStatus?.progress?.current || 0} / {importStatus?.progress?.total || 0}
            </span>
          </div>
          <Progress 
            value={importStatus?.progress?.total ? (importStatus.progress.current / importStatus.progress.total) * 100 : 0} 
          />
          {importStatus?.progress?.status && (
            <p className="text-xs text-muted-foreground mt-2">{importStatus.progress.status}</p>
          )}
        </Card>

        {importStatus?.errors && importStatus.errors.length > 0 && (
          <Card className="p-4 border-destructive">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              <h4 className="font-medium text-destructive">Errors</h4>
            </div>
            <ul className="text-sm text-muted-foreground space-y-1">
              {importStatus.errors.slice(0, 5).map((error: any, i: number) => (
                <li key={i}>{error.message}</li>
              ))}
              {importStatus.errors.length > 5 && (
                <li>... and {importStatus.errors.length - 5} more errors</li>
              )}
            </ul>
          </Card>
        )}
      </div>
    </div>
  );

  const renderCompleteStep = () => (
    <div className="text-center py-8">
      {importStatus?.status === 'completed' ? (
        <>
          <div className="mb-4">
            <div className="mx-auto w-12 h-12 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
              <Check className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
          </div>
          <h3 className="text-lg font-medium text-foreground mb-2">Import Complete</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Successfully imported {importStatus.summary?.successCount || 0} records
          </p>
          {importStatus.summary?.errorCount > 0 && (
            <p className="text-sm text-destructive mb-4">
              {importStatus.summary.errorCount} records failed to import
            </p>
          )}
          <Button onClick={onClose}>
            Done
          </Button>
        </>
      ) : (
        <>
          <div className="mb-4">
            <div className="mx-auto w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
              <X className="h-6 w-6 text-destructive" />
            </div>
          </div>
          <h3 className="text-lg font-medium text-foreground mb-2">Import Failed</h3>
          <p className="text-sm text-muted-foreground mb-4">
            {importStatus?.error || 'An unknown error occurred'}
          </p>
          <Button onClick={onClose} variant="outline">
            Close
          </Button>
        </>
      )}
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-foreground">Upload Sales Comps</h2>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={onClose}
              data-testid="button-close"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {step === 'upload' && renderUploadStep()}
          {step === 'mapping' && renderMappingStep()}
          {step === 'duplicates' && renderDuplicatesStep()}
          {step === 'processing' && renderProcessingStep()}
          {step === 'complete' && renderCompleteStep()}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border bg-background">
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              onClick={handleBack}
              disabled={step === 'upload' || step === 'processing' || step === 'complete'}
              data-testid="button-back"
            >
              {(step === 'mapping' || step === 'duplicates') && (
                <ArrowLeft className="h-4 w-4 mr-2" />
              )}
              {(step === 'mapping' || step === 'duplicates') ? 'Back' : ''}
            </Button>
            
            <div className="flex items-center gap-2">
              {step !== 'complete' && (
                <Button 
                  variant="secondary" 
                  onClick={onClose}
                  disabled={step === 'processing'}
                  data-testid="button-cancel"
                >
                  Cancel
                </Button>
              )}
              
              {step === 'mapping' && (
                <Button 
                  onClick={handleDetectDuplicates}
                  disabled={detectDuplicatesMutation.isPending}
                  data-testid="button-next"
                >
                  {detectDuplicatesMutation.isPending ? 'Checking...' : 'Next: Check for Duplicates'}
                </Button>
              )}
              
              {step === 'duplicates' && (
                <Button 
                  onClick={handleCommitAfterDuplicateCheck}
                  disabled={commitMutation.isPending}
                  data-testid="button-import"
                >
                  {commitMutation.isPending ? 'Importing...' : `Import ${duplicates.length - excludedRows.length} Records`}
                </Button>
              )}
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
