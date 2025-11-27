import { useState, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload, FileSpreadsheet, ArrowRight, ArrowLeft, Check, X, AlertTriangle, Database, RefreshCw, Plus, Loader2 } from "lucide-react";
import { useDropzone } from "react-dropzone";
import { useToast } from "@/hooks/use-toast";
import { ColumnMappingStep } from "./ColumnMappingStep";
import { DataPreviewStep } from "./DataPreviewStep";
import { ConflictResolutionStep } from "./ConflictResolutionStep";
import { ImportProgressStep } from "./ImportProgressStep";

export type ImportTarget = 'salesComps' | 'rateComps' | 'marinaDatabase';

export interface ParsedFileData {
  headers: string[];
  rows: Record<string, any>[];
  fileName: string;
  rowCount: number;
  columnTypes: Record<string, string>;
}

export interface ColumnMapping {
  sourceColumn: string;
  targetField: string;
  confidence: number;
  transform?: string;
}

export interface ConflictRecord {
  rowIndex: number;
  sourceData: Record<string, any>;
  existingRecord?: Record<string, any>;
  matchField: string;
  matchValue: string;
  action: 'skip' | 'update' | 'add';
}

interface DataImportWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetModule: ImportTarget;
  onImportComplete?: () => void;
}

type WizardStep = 'upload' | 'mapping' | 'preview' | 'conflicts' | 'importing' | 'complete';

const STEP_ORDER: WizardStep[] = ['upload', 'mapping', 'preview', 'conflicts', 'importing', 'complete'];

const TARGET_LABELS: Record<ImportTarget, string> = {
  salesComps: 'Sales Comps',
  rateComps: 'Rate Comps',
  marinaDatabase: 'Marina Database',
};

export function DataImportWizard({ 
  open, 
  onOpenChange, 
  targetModule,
  onImportComplete 
}: DataImportWizardProps) {
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState<WizardStep>('upload');
  const [parsedData, setParsedData] = useState<ParsedFileData | null>(null);
  const [columnMappings, setColumnMappings] = useState<ColumnMapping[]>([]);
  const [conflicts, setConflicts] = useState<ConflictRecord[]>([]);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0, errors: 0 });
  const [isProcessing, setIsProcessing] = useState(false);

  const resetWizard = () => {
    setCurrentStep('upload');
    setParsedData(null);
    setColumnMappings([]);
    setConflicts([]);
    setImportProgress({ current: 0, total: 0, errors: 0 });
    setIsProcessing(false);
  };

  const handleClose = () => {
    resetWizard();
    onOpenChange(false);
  };

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    setIsProcessing(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('targetModule', targetModule);

      const response = await fetch('/api/import/parse', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to parse file');
      }

      const data = await response.json();
      setParsedData({
        headers: data.headers,
        rows: data.rows,
        fileName: file.name,
        rowCount: data.rowCount,
        columnTypes: data.columnTypes,
      });

      if (data.suggestedMappings) {
        setColumnMappings(data.suggestedMappings);
      }

      setCurrentStep('mapping');
    } catch (error) {
      console.error('Error parsing file:', error);
      toast({
        title: "Error parsing file",
        description: "Please make sure you're uploading a valid CSV or Excel file.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  }, [targetModule, toast]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
    },
    maxFiles: 1,
  });

  const handleMappingComplete = (mappings: ColumnMapping[]) => {
    setColumnMappings(mappings);
    setCurrentStep('preview');
  };

  const handlePreviewConfirm = async () => {
    setIsProcessing(true);
    try {
      const response = await fetch('/api/import/check-conflicts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetModule,
          mappings: columnMappings,
          rows: parsedData?.rows,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to check conflicts');
      }

      const data = await response.json();
      setConflicts(data.conflicts || []);
      
      if (data.conflicts && data.conflicts.length > 0) {
        setCurrentStep('conflicts');
      } else {
        await executeImport();
      }
    } catch (error) {
      console.error('Error checking conflicts:', error);
      toast({
        title: "Error",
        description: "Failed to validate data. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConflictResolution = (resolvedConflicts: ConflictRecord[]) => {
    setConflicts(resolvedConflicts);
  };

  const executeImport = async () => {
    setCurrentStep('importing');
    setIsProcessing(true);
    
    try {
      const rowsToImport = parsedData?.rows || [];
      setImportProgress({ current: 0, total: rowsToImport.length, errors: 0 });

      const response = await fetch('/api/import/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetModule,
          mappings: columnMappings,
          rows: rowsToImport,
          conflicts: conflicts,
        }),
      });

      if (!response.ok) {
        throw new Error('Import failed');
      }

      const result = await response.json();
      setImportProgress({
        current: result.imported + result.updated + result.skipped,
        total: rowsToImport.length,
        errors: result.errors || 0,
      });
      
      setCurrentStep('complete');
      
      if (onImportComplete) {
        onImportComplete();
      }

      toast({
        title: "Import complete",
        description: `Successfully imported ${result.imported} new records and updated ${result.updated} existing records.`,
      });
    } catch (error) {
      console.error('Import error:', error);
      toast({
        title: "Import failed",
        description: "An error occurred during import. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const getStepIndex = (step: WizardStep) => STEP_ORDER.indexOf(step);
  const progressPercent = ((getStepIndex(currentStep) + 1) / STEP_ORDER.length) * 100;

  const canGoBack = currentStep !== 'upload' && currentStep !== 'importing' && currentStep !== 'complete';
  const canGoNext = currentStep !== 'complete' && !isProcessing;

  const handleBack = () => {
    const currentIndex = getStepIndex(currentStep);
    if (currentIndex > 0) {
      setCurrentStep(STEP_ORDER[currentIndex - 1]);
    }
  };

  const handleNext = () => {
    switch (currentStep) {
      case 'mapping':
        handleMappingComplete(columnMappings);
        break;
      case 'preview':
        handlePreviewConfirm();
        break;
      case 'conflicts':
        executeImport();
        break;
      default:
        break;
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Import to {TARGET_LABELS[targetModule]}
          </DialogTitle>
          <DialogDescription>
            Upload your data file and map columns to import records
          </DialogDescription>
          <div className="pt-4">
            <div className="flex items-center justify-between mb-2 text-sm text-muted-foreground">
              <span>Step {getStepIndex(currentStep) + 1} of {STEP_ORDER.length}</span>
              <span className="capitalize">{currentStep.replace(/([A-Z])/g, ' $1').trim()}</span>
            </div>
            <Progress value={progressPercent} className="h-2" />
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-auto px-6 py-4">
          {currentStep === 'upload' && (
            <div className="space-y-6">
              <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors ${
                  isDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'
                }`}
                data-testid="dropzone-upload"
              >
                <input {...getInputProps()} data-testid="input-file" />
                {isProcessing ? (
                  <div className="flex flex-col items-center gap-4">
                    <Loader2 className="h-12 w-12 animate-spin text-primary" />
                    <p className="text-lg font-medium">Processing file...</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-4">
                    <Upload className="h-12 w-12 text-muted-foreground" />
                    <div>
                      <p className="text-lg font-medium">
                        {isDragActive ? 'Drop your file here' : 'Drag and drop your file here'}
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">
                        or click to browse. Supports CSV, XLS, XLSX
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <FileSpreadsheet className="h-4 w-4" />
                    Supported Formats
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">.csv</Badge>
                      <span className="text-sm text-muted-foreground">Comma-separated values</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">.xlsx</Badge>
                      <span className="text-sm text-muted-foreground">Excel Workbook</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">.xls</Badge>
                      <span className="text-sm text-muted-foreground">Excel 97-2003</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {currentStep === 'mapping' && parsedData && (
            <ColumnMappingStep
              parsedData={parsedData}
              targetModule={targetModule}
              columnMappings={columnMappings}
              onMappingsChange={setColumnMappings}
            />
          )}

          {currentStep === 'preview' && parsedData && (
            <DataPreviewStep
              parsedData={parsedData}
              columnMappings={columnMappings}
              targetModule={targetModule}
            />
          )}

          {currentStep === 'conflicts' && (
            <ConflictResolutionStep
              conflicts={conflicts}
              onResolutionChange={handleConflictResolution}
            />
          )}

          {currentStep === 'importing' && (
            <ImportProgressStep
              progress={importProgress}
              isProcessing={isProcessing}
            />
          )}

          {currentStep === 'complete' && (
            <div className="flex flex-col items-center justify-center py-12 space-y-6">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
                <Check className="h-8 w-8 text-green-600" />
              </div>
              <div className="text-center">
                <h3 className="text-xl font-semibold">Import Complete!</h3>
                <p className="text-muted-foreground mt-2">
                  Successfully processed {importProgress.total} records
                </p>
              </div>
              {importProgress.errors > 0 && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    {importProgress.errors} records could not be imported due to errors.
                  </AlertDescription>
                </Alert>
              )}
              <div className="flex gap-4">
                <Button variant="outline" onClick={resetWizard} data-testid="button-import-another">
                  <Plus className="h-4 w-4 mr-2" />
                  Import Another File
                </Button>
                <Button onClick={handleClose} data-testid="button-done">
                  Done
                </Button>
              </div>
            </div>
          )}
        </div>

        {currentStep !== 'complete' && currentStep !== 'importing' && (
          <DialogFooter className="px-6 py-4 border-t flex-shrink-0">
            <div className="flex items-center justify-between w-full">
              <Button
                variant="outline"
                onClick={handleBack}
                disabled={!canGoBack}
                data-testid="button-back"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              
              <div className="flex items-center gap-2">
                <Button variant="ghost" onClick={handleClose} data-testid="button-cancel">
                  Cancel
                </Button>
                {currentStep !== 'upload' && (
                  <Button
                    onClick={handleNext}
                    disabled={!canGoNext || isProcessing}
                    data-testid="button-next"
                  >
                    {isProcessing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    {currentStep === 'conflicts' ? 'Start Import' : 'Continue'}
                    {!isProcessing && <ArrowRight className="h-4 w-4 ml-2" />}
                  </Button>
                )}
              </div>
            </div>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
