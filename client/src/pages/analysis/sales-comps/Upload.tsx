import { useState, useCallback, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ArrowLeft, Upload as UploadIcon, X, Check, AlertTriangle, Plus, Pencil, Eye } from "lucide-react";
import { useDropzone } from "react-dropzone";
import { useMutation, useQuery } from "@tanstack/react-query";
import { salesCompsApi } from "@/lib/salescomps/api";
import { queryClient } from "@/lib/queryClient";
import { queryKeys } from "@/lib/salescomps/queryKeys";
import { formatFileSize } from "@/lib/salescomps/format";
import ColumnMapperSimple from "@/components/salescomps/sales-comps/ColumnMapperSimple";
import { useToast } from "@/hooks/use-toast";

interface UploadProps {
  onClose: () => void;
  onImportComplete?: () => void;
}

export default function Upload({ onClose, onImportComplete }: UploadProps) {
  const { toast } = useToast();
  const [step, setStep] = useState<'upload' | 'mapping' | 'mode' | 'preview' | 'review' | 'processing' | 'complete'>('upload');
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
  const [importMode, setImportMode] = useState<'insert' | 'update' | 'upsert'>('upsert');
  const [updateBlankValues, setUpdateBlankValues] = useState(false);
  const [previewData, setPreviewData] = useState<{
    toInsert: number;
    toUpdate: number;
    toSkip: number;
    toReview: number;
    duplicateMatches: Array<{ row: any; match: any; confidence: number; action: 'insert' | 'update' | 'skip' | 'review'; rowIndex: number }>;
    plan?: {
      rows: Array<{ rowIndex: number; rowData: any; action: 'insert' | 'update' | 'skip' | 'review'; confidence: number; matchedComp?: any; reason?: string; reviewReasons?: string[] }>;
      summary: { toInsert: number; toUpdate: number; toSkip: number; toReview: number };
    };
  } | null>(null);
  const [excludedRows, setExcludedRows] = useState<number[]>([]);
  const [selectedFilter, setSelectedFilter] = useState<'insert' | 'update' | 'skip' | 'review' | null>(null);
  const [reviewRows, setReviewRows] = useState<Array<{ rowIndex: number; rowData: Record<string, any>; reasons: string[]; editing: boolean }>>([]);
  const [importResults, setImportResults] = useState<any>(null);
  const [linkToPortfolio, setLinkToPortfolio] = useState(false);
  const [selectedPortfolioId, setSelectedPortfolioId] = useState<string>("");
  const [showNewPortfolioDialog, setShowNewPortfolioDialog] = useState(false);
  const [newPortfolioName, setNewPortfolioName] = useState("");
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch existing portfolio comps
  const { data: portfoliosData } = useQuery({
    queryKey: queryKeys.comps.portfolios,
    queryFn: () => salesCompsApi.getComps({ isPortfolio: true }),
    enabled: linkToPortfolio,
  });

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


  const previewMutation = useMutation({
    mutationFn: ({ importId, mapping, normalization, importMode, updateBlankValues }: any) =>
      salesCompsApi.previewImport(importId, mapping, normalization, importMode, updateBlankValues),
    onSuccess: (data) => {
      setPreviewData(data);
      setStep('preview');
    },
    onError: (error) => {
      toast({
        title: "Preview Failed",
        description: (error as Error).message,
        variant: "destructive",
      });
    },
  });

  const commitMutation = useMutation({
    mutationFn: ({ importId, mapping, normalization, excludedRows, parentPortfolioId, importMode, updateBlankValues }: any) =>
      salesCompsApi.commitImport(importId, mapping, normalization, excludedRows, parentPortfolioId, importMode, updateBlankValues),
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

  const createPortfolioMutation = useMutation({
    mutationFn: (name: string) => salesCompsApi.createComp({ 
      marina: name, 
      isPortfolio: true,
    } as any),
    onSuccess: (newPortfolio) => {
      toast({
        title: "Success",
        description: "Portfolio created successfully",
      });
      setSelectedPortfolioId(newPortfolio.id);
      setShowNewPortfolioDialog(false);
      setNewPortfolioName("");
      queryClient.invalidateQueries({ queryKey: queryKeys.comps.portfolios });
    },
    onError: (error) => {
      toast({
        title: "Error",
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


  const submitReviewMutation = useMutation({
    mutationFn: ({ importId, reviewedRows, parentPortfolioId }: any) =>
      salesCompsApi.submitReviewedRows(importId, reviewedRows, parentPortfolioId),
    onSuccess: (data) => {
      toast({
        title: "Review Records Submitted",
        description: `${data.successCount} reviewed records imported successfully${data.errorCount > 0 ? `, ${data.errorCount} failed` : ''}`,
      });
      queryClient.invalidateQueries({ queryKey: ['comps'] });
      queryClient.invalidateQueries({ queryKey: ['/api/sales-comps'] });
    },
  });

  const handleBack = () => {
    if (step === 'mapping') {
      setStep('upload');
    } else if (step === 'mode') {
      setStep('mapping');
    } else if (step === 'preview') {
      setStep('mode');
    } else if (step === 'review') {
      setStep('preview');
    }
  };

  const handleNextFromMapping = () => {
    setStep('mode');
  };

  const handleNextFromMode = () => {
    if (!uploadData) return;
    
    previewMutation.mutate({
      importId: uploadData.importId,
      mapping,
      normalization,
      importMode,
      updateBlankValues,
    });
  };

  const handleConfirmImport = () => {
    if (!uploadData) return;
    
    const reviewRowsFromPlan = previewData?.plan?.rows?.filter(r => r.action === 'review') || [];
    if (reviewRowsFromPlan.length > 0) {
      setReviewRows(reviewRowsFromPlan.map(r => ({
        rowIndex: r.rowIndex,
        rowData: { ...r.rowData },
        reasons: r.reviewReasons || ['Needs review'],
        editing: false,
      })));
      setStep('review');
      return;
    }

    commitMutation.mutate({
      importId: uploadData.importId,
      mapping,
      normalization,
      excludedRows,
      parentPortfolioId: linkToPortfolio ? selectedPortfolioId : undefined,
      importMode,
      updateBlankValues,
    });
  };

  const handleCommitWithoutReview = () => {
    if (!uploadData) return;
    const reviewRowIndices = reviewRows.map(r => r.rowIndex);
    commitMutation.mutate({
      importId: uploadData.importId,
      mapping,
      normalization,
      excludedRows: [...excludedRows, ...reviewRowIndices],
      parentPortfolioId: linkToPortfolio ? selectedPortfolioId : undefined,
      importMode,
      updateBlankValues,
    });
  };

  const handleCommitWithReview = async () => {
    if (!uploadData) return;
    const reviewRowIndices = reviewRows.map(r => r.rowIndex);
    
    commitMutation.mutate({
      importId: uploadData.importId,
      mapping,
      normalization,
      excludedRows: [...excludedRows, ...reviewRowIndices],
      parentPortfolioId: linkToPortfolio ? selectedPortfolioId : undefined,
      importMode,
      updateBlankValues,
    });

    const completedReviewRows = reviewRows
      .filter(r => r.rowData.marina && String(r.rowData.marina).trim())
      .map(r => r.rowData);
    
    if (completedReviewRows.length > 0) {
      submitReviewMutation.mutate({
        importId: uploadData.importId,
        reviewedRows: completedReviewRows,
        parentPortfolioId: linkToPortfolio ? selectedPortfolioId : undefined,
      });
    }
  };

  const updateReviewRow = (rowIndex: number, field: string, value: any) => {
    setReviewRows(prev => prev.map(r => 
      r.rowIndex === rowIndex 
        ? { ...r, rowData: { ...r.rowData, [field]: value } }
        : r
    ));
  };

  const toggleReviewRowEditing = (rowIndex: number) => {
    setReviewRows(prev => prev.map(r => 
      r.rowIndex === rowIndex ? { ...r, editing: !r.editing } : r
    ));
  };

  const removeReviewRow = (rowIndex: number) => {
    setReviewRows(prev => prev.filter(r => r.rowIndex !== rowIndex));
  };

  const getActiveImportCount = () => {
    if (!previewData?.plan?.rows) {
      return (previewData?.toInsert || 0) + (previewData?.toUpdate || 0);
    }
    return previewData.plan.rows.filter(r => 
      (r.action === 'insert' || r.action === 'update') && !excludedRows.includes(r.rowIndex)
    ).length;
  };

  const getReviewCount = () => {
    return previewData?.toReview || 0;
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

          <ColumnMapperSimple
            analysis={uploadData.analysis}
            mapping={mapping}
            onMappingChange={setMapping}
          />

          {/* Portfolio Selection */}
          <Card className="mt-6 p-4">
            <div className="space-y-3">
              <div className="flex items-center space-x-3">
                <Checkbox
                  checked={linkToPortfolio}
                  onCheckedChange={(checked) => {
                    setLinkToPortfolio(!!checked);
                    if (!checked) {
                      setSelectedPortfolioId("");
                    }
                  }}
                  data-testid="checkbox-link-to-portfolio-upload"
                />
                <Label className="text-sm font-medium cursor-pointer" onClick={() => setLinkToPortfolio(!linkToPortfolio)}>
                  Portfolio Sale
                </Label>
              </div>

              {linkToPortfolio && (
                <div className="flex gap-2 ml-6">
                  <div className="flex-1">
                    <Select 
                      value={selectedPortfolioId} 
                      onValueChange={setSelectedPortfolioId}
                    >
                      <SelectTrigger data-testid="select-portfolio-upload">
                        <SelectValue placeholder="Select a portfolio..." />
                      </SelectTrigger>
                      <SelectContent>
                        {portfoliosData?.comps && portfoliosData.comps.length > 0 ? (
                          portfoliosData.comps.map((portfolio) => (
                            <SelectItem key={portfolio.id} value={portfolio.id}>
                              {portfolio.marina}
                            </SelectItem>
                          ))
                        ) : (
                          <SelectItem value="no-portfolios" disabled>
                            No portfolios available
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowNewPortfolioDialog(true)}
                    data-testid="button-new-portfolio-upload"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    New Portfolio
                  </Button>
                </div>
              )}
            </div>
          </Card>
        </>
      )}
    </div>
  );

  const renderModeStep = () => (
    <div>
      <div className="mb-6">
        <h3 className="text-lg font-medium text-foreground mb-2">Step 3: Choose Import Mode</h3>
        <p className="text-sm text-muted-foreground">How should we handle existing records?</p>
      </div>

      <RadioGroup value={importMode} onValueChange={(value: any) => setImportMode(value)}>
        <Card className="p-4 mb-3 cursor-pointer hover:border-primary" onClick={() => setImportMode('upsert')}>
          <div className="flex items-start space-x-3">
            <RadioGroupItem value="upsert" id="mode-upsert" className="mt-1" />
            <div className="flex-1">
              <Label htmlFor="mode-upsert" className="text-base font-medium cursor-pointer">
                Upsert (Recommended)
              </Label>
              <p className="text-sm text-muted-foreground mt-1">
                Add new records and update existing ones. Matches are based on marina name, city, and state.
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-4 mb-3 cursor-pointer hover:border-primary" onClick={() => setImportMode('insert')}>
          <div className="flex items-start space-x-3">
            <RadioGroupItem value="insert" id="mode-insert" className="mt-1" />
            <div className="flex-1">
              <Label htmlFor="mode-insert" className="text-base font-medium cursor-pointer">
                Insert Only
              </Label>
              <p className="text-sm text-muted-foreground mt-1">
                Only add new records. Skip any records that already exist.
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-4 cursor-pointer hover:border-primary" onClick={() => setImportMode('update')}>
          <div className="flex items-start space-x-3">
            <RadioGroupItem value="update" id="mode-update" className="mt-1" />
            <div className="flex-1">
              <Label htmlFor="mode-update" className="text-base font-medium cursor-pointer">
                Update Only
              </Label>
              <p className="text-sm text-muted-foreground mt-1">
                Only update existing records. Ignore new records that don't have a match.
              </p>
            </div>
          </div>
        </Card>
      </RadioGroup>

      {(importMode === 'update' || importMode === 'upsert') && (
        <Card className="p-4 mt-4">
          <div className="flex items-center space-x-3">
            <Checkbox
              checked={updateBlankValues}
              onCheckedChange={(checked) => setUpdateBlankValues(!!checked)}
              id="update-blanks"
            />
            <div className="flex-1">
              <Label htmlFor="update-blanks" className="text-sm font-medium cursor-pointer">
                Overwrite existing data with blank values
              </Label>
              <p className="text-xs text-muted-foreground mt-1">
                If unchecked, blank cells in your import file will preserve existing data
              </p>
            </div>
          </div>
        </Card>
      )}
    </div>
  );

  const renderMappingVerification = () => {
    if (!uploadData?.analysis || !mapping) return null;
    const mappedFields = Object.entries(mapping).filter(([_, target]) => target);
    const sampleData = uploadData.analysis.sampleRows?.slice(0, 3) || [];

    return (
      <Card className="p-4 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <Eye className="h-4 w-4 text-primary" />
          <h4 className="font-medium text-foreground">Mapping Verification</h4>
          <span className="text-xs text-muted-foreground">({mappedFields.length} fields mapped)</span>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          Verify how your data will be mapped. Showing first {sampleData.length} rows as a preview.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-border">
                <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">Row</th>
                {mappedFields.map(([source, target]) => (
                  <th key={source} className="px-2 py-1.5 text-left">
                    <div className="font-medium text-foreground">{target}</div>
                    <div className="font-normal text-muted-foreground truncate max-w-[100px]">{source}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sampleData.map((row: any, idx: number) => (
                <tr key={idx} className="border-b border-border/50">
                  <td className="px-2 py-1.5 text-muted-foreground">{idx + 1}</td>
                  {mappedFields.map(([source]) => (
                    <td key={source} className="px-2 py-1.5 truncate max-w-[120px]">
                      {row[source] !== null && row[source] !== undefined ? String(row[source]) : <span className="text-muted-foreground italic">empty</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    );
  };

  const renderPreviewStep = () => {
    const getFilteredRows = () => {
      if (!previewData?.plan?.rows || !selectedFilter) return [];
      return previewData.plan.rows.filter(r => r.action === selectedFilter);
    };

    const filteredRows = getFilteredRows();

    const getActiveCount = (action: 'insert' | 'update' | 'skip' | 'review') => {
      if (!previewData?.plan?.rows) return 0;
      if (action === 'review') return previewData.plan.rows.filter(r => r.action === 'review').length;
      return previewData.plan.rows.filter(r => r.action === action && !excludedRows.includes(r.rowIndex)).length;
    };

    const toggleRowExclusion = (rowIndex: number) => {
      setExcludedRows(prev => 
        prev.includes(rowIndex) 
          ? prev.filter(i => i !== rowIndex)
          : [...prev, rowIndex]
      );
    };

    const toggleAllInFilter = (include: boolean) => {
      if (!selectedFilter) return;
      const filterRows = getFilteredRows();
      if (include) {
        setExcludedRows(prev => prev.filter(i => !filterRows.some(r => r.rowIndex === i)));
      } else {
        setExcludedRows(prev => [...new Set([...prev, ...filterRows.map(r => r.rowIndex)])]);
      }
    };

    const totalFileRows = uploadData?.analysis?.estimatedRows || 0;
    const totalPlanRows = previewData?.plan?.rows?.length || 0;
    const totalActiveImport = getActiveCount('insert') + getActiveCount('update');

    const unmappedColumns = uploadData?.analysis?.headers?.filter(
      (h: string) => !mapping[h]
    ) || [];

    return (
      <div>
        <div className="mb-6">
          <h3 className="text-lg font-medium text-foreground mb-2">Step 4: Preview & Verify Import</h3>
          <p className="text-sm text-muted-foreground">Verify mapping accuracy and review record categories before importing</p>
        </div>

        <Card className="p-4 mb-4 border-primary/30 bg-primary/5">
          <div className="flex items-start gap-3">
            <div className="flex-1">
              <h4 className="font-medium text-foreground mb-2">Import Summary</h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground">File rows parsed:</span>
                  <span className="font-semibold ml-1">{totalFileRows}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Rows in plan:</span>
                  <span className="font-semibold ml-1">{totalPlanRows}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Will import:</span>
                  <span className="font-semibold text-green-600 dark:text-green-400 ml-1">{totalActiveImport}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Columns mapped:</span>
                  <span className="font-semibold ml-1">{Object.keys(mapping).filter(k => mapping[k]).length} / {uploadData?.analysis?.headers?.length || 0}</span>
                </div>
              </div>
              {unmappedColumns.length > 0 && (
                <div className="mt-2 text-xs text-muted-foreground">
                  <span className="font-medium">Unmapped columns</span> (stored as custom data): {unmappedColumns.slice(0, 8).join(', ')}
                  {unmappedColumns.length > 8 && ` +${unmappedColumns.length - 8} more`}
                </div>
              )}
              {totalFileRows > 0 && totalPlanRows < totalFileRows && totalPlanRows > 0 && (
                <div className="mt-2 text-xs text-amber-600 dark:text-amber-400">
                  {totalFileRows - totalPlanRows} row(s) were empty and filtered out during parsing.
                </div>
              )}
            </div>
          </div>
        </Card>

        {renderMappingVerification()}

        {previewData && (
          <div className="space-y-4">
            <div className={`grid gap-4 ${getActiveCount('review') > 0 ? 'grid-cols-4' : 'grid-cols-3'}`}>
              <Card 
                className={`p-4 text-center cursor-pointer transition-all hover:border-green-500 ${selectedFilter === 'insert' ? 'ring-2 ring-green-500 border-green-500' : ''}`}
                onClick={() => setSelectedFilter(selectedFilter === 'insert' ? null : 'insert')}
              >
                <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {getActiveCount('insert')}
                </div>
                <div className="text-sm text-muted-foreground mt-1">Will be added</div>
                {excludedRows.length > 0 && previewData.plan && (
                  <div className="text-xs text-orange-500 mt-1">
                    {previewData.plan.rows.filter(r => r.action === 'insert' && excludedRows.includes(r.rowIndex)).length} excluded
                  </div>
                )}
              </Card>
              <Card 
                className={`p-4 text-center cursor-pointer transition-all hover:border-blue-500 ${selectedFilter === 'update' ? 'ring-2 ring-blue-500 border-blue-500' : ''}`}
                onClick={() => setSelectedFilter(selectedFilter === 'update' ? null : 'update')}
              >
                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {getActiveCount('update')}
                </div>
                <div className="text-sm text-muted-foreground mt-1">Will be updated</div>
                {excludedRows.length > 0 && previewData.plan && (
                  <div className="text-xs text-orange-500 mt-1">
                    {previewData.plan.rows.filter(r => r.action === 'update' && excludedRows.includes(r.rowIndex)).length} excluded
                  </div>
                )}
              </Card>
              {getActiveCount('review') > 0 && (
                <Card 
                  className={`p-4 text-center cursor-pointer transition-all hover:border-amber-500 ${selectedFilter === 'review' ? 'ring-2 ring-amber-500 border-amber-500' : ''}`}
                  onClick={() => setSelectedFilter(selectedFilter === 'review' ? null : 'review')}
                >
                  <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                    {getActiveCount('review')}
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">Need review</div>
                </Card>
              )}
              <Card 
                className={`p-4 text-center cursor-pointer transition-all hover:border-gray-500 ${selectedFilter === 'skip' ? 'ring-2 ring-gray-500 border-gray-500' : ''}`}
                onClick={() => setSelectedFilter(selectedFilter === 'skip' ? null : 'skip')}
              >
                <div className="text-2xl font-bold text-gray-600 dark:text-gray-400">
                  {previewData.toSkip}
                </div>
                <div className="text-sm text-muted-foreground mt-1">Will be skipped</div>
              </Card>
            </div>

            {selectedFilter && filteredRows.length > 0 && (
              <Card className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium text-foreground">
                    {selectedFilter === 'insert' && 'Records to Add'}
                    {selectedFilter === 'update' && 'Records to Update'}
                    {selectedFilter === 'skip' && 'Records to Skip'}
                    {selectedFilter === 'review' && 'Records Needing Review'}
                    <span className="text-muted-foreground font-normal ml-2">({filteredRows.length} records)</span>
                  </h4>
                  {selectedFilter !== 'skip' && selectedFilter !== 'review' && (
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => toggleAllInFilter(true)}
                      >
                        Include All
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => toggleAllInFilter(false)}
                      >
                        Exclude All
                      </Button>
                    </div>
                  )}
                </div>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {filteredRows.map((row, i) => {
                    const isExcluded = excludedRows.includes(row.rowIndex);
                    return (
                      <div 
                        key={i} 
                        className={`flex items-center gap-3 p-2 rounded text-sm ${isExcluded ? 'bg-muted/30 opacity-60' : 'bg-muted/50'}`}
                      >
                        {selectedFilter !== 'skip' && selectedFilter !== 'review' && (
                          <Checkbox
                            checked={!isExcluded}
                            onCheckedChange={() => toggleRowExclusion(row.rowIndex)}
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <span className={`font-medium ${isExcluded ? 'line-through' : ''}`}>
                            {row.rowData.marina || <span className="italic text-amber-600">No marina name</span>}
                          </span>
                          <span className="text-muted-foreground ml-2">
                            {row.rowData.city && row.rowData.state ? `(${row.rowData.city}, ${row.rowData.state})` : ''}
                          </span>
                          {row.rowData.salePrice && (
                            <span className="text-muted-foreground ml-2">
                              ${Number(row.rowData.salePrice).toLocaleString()}
                            </span>
                          )}
                        </div>
                        {row.reason && (selectedFilter === 'skip' || selectedFilter === 'review') && (
                          <span className="text-xs text-muted-foreground italic">
                            {row.reason}
                          </span>
                        )}
                        <span className={`text-xs px-2 py-1 rounded ${
                          selectedFilter === 'insert' ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300' :
                          selectedFilter === 'update' ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300' :
                          selectedFilter === 'review' ? 'bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300' :
                          'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
                        }`}>
                          {selectedFilter === 'insert' ? 'Add' : selectedFilter === 'update' ? 'Update' : selectedFilter === 'review' ? 'Review' : 'Skip'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </Card>
            )}

            {selectedFilter && filteredRows.length === 0 && (
              <Card className="p-4 text-center text-muted-foreground">
                No records in this category
              </Card>
            )}

            {excludedRows.length > 0 && (
              <div className="flex items-center justify-between p-3 bg-orange-50 dark:bg-orange-950 border border-orange-200 dark:border-orange-800 rounded-lg">
                <span className="text-sm text-orange-700 dark:text-orange-300">
                  {excludedRows.length} record(s) excluded from import
                </span>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => setExcludedRows([])}
                  className="text-orange-700 dark:text-orange-300 hover:text-orange-800"
                >
                  Reset
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderReviewStep = () => {
    const REVIEW_FIELDS = [
      { key: 'marina', label: 'Marina Name', required: true },
      { key: 'city', label: 'City' },
      { key: 'state', label: 'State' },
      { key: 'salePrice', label: 'Sale Price' },
      { key: 'saleYear', label: 'Sale Year' },
      { key: 'wetSlips', label: 'Wet Slips' },
      { key: 'dryRacks', label: 'Dry Racks' },
      { key: 'address', label: 'Address' },
      { key: 'zip', label: 'ZIP' },
      { key: 'capRate', label: 'Cap Rate' },
      { key: 'noi', label: 'NOI' },
      { key: 'notes', label: 'Notes' },
    ];

    const completedCount = reviewRows.filter(r => r.rowData.marina && String(r.rowData.marina).trim()).length;

    return (
      <div>
        <div className="mb-6">
          <h3 className="text-lg font-medium text-foreground mb-2">Step 5: Review Incomplete Records</h3>
          <p className="text-sm text-muted-foreground">
            {reviewRows.length} record(s) need your attention. Edit to complete or remove records you don't want to import.
          </p>
        </div>

        <div className="flex items-center justify-between mb-4">
          <div className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{completedCount}</span> of {reviewRows.length} ready to import
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setReviewRows(prev => prev.map(r => ({ ...r, editing: true })))}>
              Edit All
            </Button>
            <Button variant="outline" size="sm" onClick={() => setReviewRows(prev => prev.map(r => ({ ...r, editing: false })))}>
              Collapse All
            </Button>
          </div>
        </div>

        <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
          {reviewRows.map((row, idx) => (
            <Card key={row.rowIndex} className={`p-3 ${row.rowData.marina ? 'border-green-200 dark:border-green-800' : 'border-amber-200 dark:border-amber-800'}`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-muted-foreground">Row {row.rowIndex + 1}</span>
                  {row.reasons.map((reason, ri) => (
                    <span key={ri} className="text-xs px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300">
                      {reason}
                    </span>
                  ))}
                  {row.rowData.marina && String(row.rowData.marina).trim() && (
                    <Check className="h-3.5 w-3.5 text-green-600" />
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => toggleReviewRowEditing(row.rowIndex)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => removeReviewRow(row.rowIndex)}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              {!row.editing ? (
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                  {REVIEW_FIELDS.filter(f => row.rowData[f.key]).map(f => (
                    <span key={f.key}>
                      <span className="text-muted-foreground">{f.label}:</span>{' '}
                      <span className="text-foreground">{String(row.rowData[f.key])}</span>
                    </span>
                  ))}
                  {!row.rowData.marina && (
                    <span className="text-amber-600 italic cursor-pointer" onClick={() => toggleReviewRowEditing(row.rowIndex)}>
                      Click edit to add marina name
                    </span>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {REVIEW_FIELDS.map(f => (
                    <div key={f.key}>
                      <Label className="text-xs text-muted-foreground">{f.label}{f.required ? ' *' : ''}</Label>
                      <Input
                        className="h-7 text-xs"
                        value={row.rowData[f.key] || ''}
                        onChange={(e) => updateReviewRow(row.rowIndex, f.key, e.target.value)}
                        placeholder={f.label}
                      />
                    </div>
                  ))}
                </div>
              )}
            </Card>
          ))}
        </div>

        {reviewRows.length === 0 && (
          <Card className="p-8 text-center text-muted-foreground">
            All review records have been removed. Click "Import" to proceed with the main records.
          </Card>
        )}
      </div>
    );
  };

  const renderProcessingStep = () => (
    <div>
      <div className="mb-6">
        <h3 className="text-lg font-medium text-foreground mb-2">Importing Data</h3>
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
            {importStatus.summary?.reviewCount > 0 && ` (${importStatus.summary.reviewCount} sent to review)`}
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
          {step === 'mode' && renderModeStep()}
          {step === 'preview' && renderPreviewStep()}
          {step === 'review' && renderReviewStep()}
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
              {(step === 'mapping' || step === 'mode' || step === 'preview' || step === 'review') && (
                <ArrowLeft className="h-4 w-4 mr-2" />
              )}
              {(step === 'mapping' || step === 'mode' || step === 'preview' || step === 'review') ? 'Back' : ''}
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
                  onClick={handleNextFromMapping}
                  data-testid="button-next"
                >
                  Next: Choose Import Mode
                </Button>
              )}

              {step === 'mode' && (
                <Button 
                  onClick={handleNextFromMode}
                  disabled={previewMutation.isPending}
                  data-testid="button-preview"
                >
                  {previewMutation.isPending ? 'Analyzing...' : 'Next: Preview Import'}
                </Button>
              )}

              {step === 'preview' && (
                <Button 
                  onClick={handleConfirmImport}
                  disabled={commitMutation.isPending}
                  data-testid="button-confirm-import"
                >
                  {commitMutation.isPending ? 'Starting Import...' : getReviewCount() > 0 
                    ? `Next: Review ${getReviewCount()} Records & Import ${getActiveImportCount()}`
                    : `Confirm & Import ${getActiveImportCount()} Records`}
                </Button>
              )}

              {step === 'review' && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    onClick={handleCommitWithoutReview}
                    disabled={commitMutation.isPending || submitReviewMutation.isPending}
                  >
                    Skip Review Records
                  </Button>
                  <Button 
                    onClick={handleCommitWithReview}
                    disabled={commitMutation.isPending || submitReviewMutation.isPending}
                  >
                    {(commitMutation.isPending || submitReviewMutation.isPending) 
                      ? 'Importing...' 
                      : `Import All (${getActiveImportCount() + reviewRows.filter(r => r.rowData.marina && String(r.rowData.marina).trim()).length} Records)`}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* New Portfolio Dialog */}
      <Dialog open={showNewPortfolioDialog} onOpenChange={setShowNewPortfolioDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Portfolio</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="portfolio-name-upload">Portfolio Name *</Label>
              <Input
                id="portfolio-name-upload"
                value={newPortfolioName}
                onChange={(e) => setNewPortfolioName(e.target.value)}
                placeholder="Enter portfolio name..."
                data-testid="input-new-portfolio-name-upload"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowNewPortfolioDialog(false);
                setNewPortfolioName("");
              }}
              data-testid="button-cancel-new-portfolio-upload"
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (newPortfolioName.trim()) {
                  createPortfolioMutation.mutate(newPortfolioName.trim());
                }
              }}
              disabled={!newPortfolioName.trim() || createPortfolioMutation.isPending}
              data-testid="button-create-portfolio-upload"
            >
              {createPortfolioMutation.isPending ? "Creating..." : "Create Portfolio"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
