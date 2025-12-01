import { useState, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import Sidebar from "@/components/layout/sidebar";
import TopBar from "@/components/layout/top-bar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Upload, FileSpreadsheet, Download, AlertCircle, CheckCircle2, Clock, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";
import FileUploadZone from "@/components/imports/file-upload-zone";
import ColumnMappingInterface from "@/components/imports/column-mapping-interface";
import ImportPreview from "@/components/imports/import-preview";
import ImportProgress from "@/components/imports/import-progress";
import ImportResults from "@/components/imports/import-results";

interface ImportJob {
  id: string;
  source: string;
  fileName?: string;
  fileSize?: number;
  status: 'queued' | 'running' | 'completed' | 'failed';
  totalRows?: number;
  processedRows?: number;
  successCount?: number;
  errorCount?: number;
  startedAt?: string;
  finishedAt?: string;
  createdAt: string;
  createdBy?: string;
  config?: {
    columnMappings?: Record<string, any>;
    duplicateHandling?: 'skip' | 'update' | 'error';
    validationRules?: Record<string, any>;
  };
  summary?: {
    customersCreated?: number;
    customersUpdated?: number;
    boatsCreated?: number;
    boatsUpdated?: number;
    slipsCreated?: number;
    slipsUpdated?: number;
    leasesCreated?: number;
    leasesUpdated?: number;
  };
}

interface ImportError {
  id: string;
  jobId: string;
  entity: string;
  rowIndex: number;
  code: string;
  message: string;
  rawData: Record<string, any>;
  suggestion?: string;
  createdAt: string;
}

type WizardStep = 'upload' | 'mapping' | 'preview' | 'processing' | 'results';

export default function Imports() {
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState<WizardStep>('upload');
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [filePreview, setFilePreview] = useState<any>(null);
  const [mappingSuggestions, setMappingSuggestions] = useState<any>(null);
  const [columnMappings, setColumnMappings] = useState<Record<string, any>>({});
  const [duplicateStrategy, setDuplicateStrategy] = useState<'skip' | 'update' | 'error'>('skip');

  // Fetch import jobs
  const { data: importJobs, isLoading: jobsLoading } = useQuery<ImportJob[]>({
    queryKey: ['/api/imports'],
    refetchInterval: 5000, // Poll every 5 seconds for status updates
  });

  // Fetch current job details
  const { data: currentJob } = useQuery<ImportJob>({
    queryKey: ['/api/imports', currentJobId],
    enabled: !!currentJobId,
    refetchInterval: currentJobId && currentStep === 'processing' ? 2000 : false,
  });

  // Fetch import errors for current job
  const { data: importErrors } = useQuery<ImportError[]>({
    queryKey: ['/api/imports', currentJobId, 'errors'],
    enabled: !!currentJobId && (currentStep === 'results' || currentJob?.status === 'completed' || currentJob?.status === 'failed'),
  });

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch('/api/imports/upload', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Upload failed');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      setCurrentJobId(data.job.id);
      setFilePreview(data.preview);
      setMappingSuggestions(data.mappingSuggestions);
      setCurrentStep('mapping');
      toast({
        title: "File uploaded successfully",
        description: `${data.preview.totalRows} rows detected`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/imports'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Start import mutation
  const startImportMutation = useMutation({
    mutationFn: async ({ jobId, mappings, strategy }: { 
      jobId: string; 
      mappings: Record<string, any>; 
      strategy: string;
    }) => {
      return apiRequest(`/api/imports/${jobId}/start`, {
        method: 'POST',
        body: JSON.stringify({
          mappings,
          duplicateStrategy: strategy,
          validateOnly: false,
        }),
      });
    },
    onSuccess: () => {
      setCurrentStep('processing');
      toast({
        title: "Import started",
        description: "Processing your data...",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/imports'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to start import",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete job mutation
  const deleteJobMutation = useMutation({
    mutationFn: async (jobId: string) => {
      return apiRequest(`/api/imports/${jobId}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      toast({
        title: "Import job deleted",
        description: "Job and its errors have been removed",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/imports'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to delete job",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleFileUpload = useCallback((file: File) => {
    uploadMutation.mutate(file);
  }, [uploadMutation]);

  const handleStartImport = useCallback(() => {
    if (!currentJobId) return;
    
    startImportMutation.mutate({
      jobId: currentJobId,
      mappings: columnMappings,
      strategy: duplicateStrategy,
    });
  }, [currentJobId, columnMappings, duplicateStrategy, startImportMutation]);

  const handleNewImport = useCallback(() => {
    setCurrentStep('upload');
    setCurrentJobId(null);
    setFilePreview(null);
    setMappingSuggestions(null);
    setColumnMappings({});
    setDuplicateStrategy('skip');
  }, []);

  const handleJobSelect = useCallback((job: ImportJob) => {
    setCurrentJobId(job.id);
    if (job.status === 'completed' || job.status === 'failed') {
      setCurrentStep('results');
    } else if (job.status === 'running') {
      setCurrentStep('processing');
    }
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-500';
      case 'failed': return 'bg-red-500';
      case 'running': return 'bg-blue-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle2 className="h-4 w-4" />;
      case 'failed': return <AlertCircle className="h-4 w-4" />;
      case 'running': return <Clock className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  // Monitor job completion
  useEffect(() => {
    if (currentJob && currentStep === 'processing' && 
        (currentJob.status === 'completed' || currentJob.status === 'failed')) {
      setCurrentStep('results');
      if (currentJob.status === 'completed') {
        toast({
          title: "Import completed",
          description: `Successfully processed ${currentJob.successCount || 0} records`,
        });
      } else {
        toast({
          title: "Import failed",
          description: "Check the results for error details",
          variant: "destructive",
        });
      }
    }
  }, [currentJob, currentStep, toast]);

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      
      <main className="flex-1 overflow-auto">
        <TopBar />
        
        <div className="p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Data Import</h1>
              <p className="text-muted-foreground">
                Import customer, boat, slip, and lease data from files or external platforms
              </p>
            </div>
            <Button onClick={handleNewImport} data-testid="button-new-import">
              <Upload className="mr-2 h-4 w-4" />
              New Import
            </Button>
          </div>

          <Tabs defaultValue="wizard" className="space-y-6">
            <TabsList>
              <TabsTrigger value="wizard" data-testid="tab-wizard">Import Wizard</TabsTrigger>
              <TabsTrigger value="history" data-testid="tab-history">Import History</TabsTrigger>
            </TabsList>

            <TabsContent value="wizard" className="space-y-6">
              {/* Progress indicator */}
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-2">
                      <div className={`w-2 h-2 rounded-full ${currentStep === 'upload' ? 'bg-blue-500' : 'bg-gray-300'}`} />
                      <span className={currentStep === 'upload' ? 'font-medium' : 'text-muted-foreground'}>Upload</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className={`w-2 h-2 rounded-full ${currentStep === 'mapping' ? 'bg-blue-500' : 'bg-gray-300'}`} />
                      <span className={currentStep === 'mapping' ? 'font-medium' : 'text-muted-foreground'}>Mapping</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className={`w-2 h-2 rounded-full ${currentStep === 'preview' ? 'bg-blue-500' : 'bg-gray-300'}`} />
                      <span className={currentStep === 'preview' ? 'font-medium' : 'text-muted-foreground'}>Preview</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className={`w-2 h-2 rounded-full ${currentStep === 'processing' ? 'bg-blue-500' : 'bg-gray-300'}`} />
                      <span className={currentStep === 'processing' ? 'font-medium' : 'text-muted-foreground'}>Processing</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className={`w-2 h-2 rounded-full ${currentStep === 'results' ? 'bg-blue-500' : 'bg-gray-300'}`} />
                      <span className={currentStep === 'results' ? 'font-medium' : 'text-muted-foreground'}>Results</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Step content */}
              {currentStep === 'upload' && (
                <FileUploadZone
                  onFileUpload={handleFileUpload}
                  isUploading={uploadMutation.isPending}
                />
              )}

              {currentStep === 'mapping' && filePreview && mappingSuggestions && (
                <ColumnMappingInterface
                  preview={filePreview}
                  suggestions={mappingSuggestions}
                  mappings={columnMappings}
                  onMappingsChange={setColumnMappings}
                  duplicateStrategy={duplicateStrategy}
                  onDuplicateStrategyChange={setDuplicateStrategy}
                  onNext={() => setCurrentStep('preview')}
                  onBack={() => setCurrentStep('upload')}
                />
              )}

              {currentStep === 'preview' && filePreview && (
                <ImportPreview
                  preview={filePreview}
                  mappings={columnMappings}
                  duplicateStrategy={duplicateStrategy}
                  onStartImport={handleStartImport}
                  onBack={() => setCurrentStep('mapping')}
                  isStarting={startImportMutation.isPending}
                />
              )}

              {currentStep === 'processing' && currentJob && (
                <ImportProgress
                  job={currentJob}
                  onCancel={() => setCurrentStep('results')}
                />
              )}

              {currentStep === 'results' && currentJob && (
                <ImportResults
                  job={currentJob}
                  errors={importErrors || []}
                  onNewImport={handleNewImport}
                />
              )}
            </TabsContent>

            <TabsContent value="history" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Import History</CardTitle>
                  <CardDescription>
                    View and manage your recent import jobs
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {jobsLoading ? (
                    <div className="text-center py-8">Loading import history...</div>
                  ) : !importJobs || importJobs.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No import jobs found. Start your first import!
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {importJobs.map((job) => (
                        <div
                          key={job.id}
                          className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 cursor-pointer"
                          onClick={() => handleJobSelect(job)}
                          data-testid={`job-item-${job.id}`}
                        >
                          <div className="flex items-center space-x-4">
                            <div className="flex items-center space-x-2">
                              {getStatusIcon(job.status)}
                              <Badge className={getStatusColor(job.status)}>
                                {job.status}
                              </Badge>
                            </div>
                            <div>
                              <div className="font-medium">{job.fileName || job.source}</div>
                              <div className="text-sm text-muted-foreground">
                                {new Date(job.createdAt).toLocaleString()}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center space-x-4">
                            {job.totalRows && (
                              <div className="text-sm text-muted-foreground">
                                {job.processedRows || 0} / {job.totalRows} rows
                              </div>
                            )}
                            {job.status === 'completed' && job.summary && (
                              <div className="text-sm text-green-600">
                                {Object.values(job.summary).reduce((a, b) => (a || 0) + (b || 0), 0)} records imported
                              </div>
                            )}
                            {job.errorCount && job.errorCount > 0 && (
                              <div className="text-sm text-red-600">
                                {job.errorCount} errors
                              </div>
                            )}
                            {(job.status === 'completed' || job.status === 'failed') && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deleteJobMutation.mutate(job.id);
                                }}
                                data-testid={`button-delete-${job.id}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}