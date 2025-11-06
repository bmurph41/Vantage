// TODO: Missing SalesComps-specific components and utilities:
// - @/lib/api (salesCompsApi)
// - @/lib/queryClient
// - @/lib/format (formatFileSize, estimateRowCount)
// - @/components/sales-comps/ColumnMapper
// - @/components/sales-comps/DuplicateReview

import { useState, useCallback, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, Upload as UploadIcon, X, Check, AlertTriangle } from "lucide-react";
import { useDropzone } from "react-dropzone";
import { useMutation, useQuery } from "@tanstack/react-query";
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

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      // TODO: Implement upload when API is available
      toast({
        title: "TODO",
        description: "Upload functionality pending API integration",
        variant: "destructive",
      });
    }
  }, [toast]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
    },
    maxFiles: 1,
    maxSize: 50 * 1024 * 1024,
  });

  const handleDetectDuplicates = () => {
    // TODO: Implement when API is available
    toast({
      title: "TODO",
      description: "Duplicate detection pending API integration",
      variant: "destructive",
    });
  };

  const handleCommitAfterDuplicateCheck = () => {
    // TODO: Implement when API is available
    toast({
      title: "TODO",
      description: "Import commit pending API integration",
      variant: "destructive",
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
          <Button variant="default">
            Choose File
          </Button>
        </div>
        <div className="text-xs text-muted-foreground">
          Supports CSV, Excel (.xlsx, .xls) • Max 50MB • Up to 1M rows
        </div>
      </div>
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
          {step !== 'upload' && (
            <div className="p-8 text-center text-muted-foreground">
              Upload workflow steps pending API integration
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border bg-background">
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              onClick={(step === 'mapping' || step === 'duplicates') ? handleBack : undefined}
              disabled={step === 'upload' || step === 'processing'}
              data-testid="button-back"
            >
              {(step === 'mapping' || step === 'duplicates') && (
                <ArrowLeft className="h-4 w-4 mr-2" />
              )}
              {(step === 'mapping' || step === 'duplicates') ? 'Back' : ''}
            </Button>
            
            <Button 
              variant="secondary" 
              onClick={onClose}
              data-testid="button-cancel"
            >
              Cancel
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
