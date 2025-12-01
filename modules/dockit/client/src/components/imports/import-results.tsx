import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  CheckCircle2, AlertCircle, Download, RefreshCw, Users, Anchor, MapPin, FileText,
  AlertTriangle, Info, FileSpreadsheet, ArrowUpRight
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ImportResultsProps {
  job: {
    id: string;
    fileName?: string;
    status: 'completed' | 'failed';
    totalRows?: number;
    processedRows?: number;
    successCount?: number;
    errorCount?: number;
    startedAt?: string;
    finishedAt?: string;
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
  };
  errors: Array<{
    id: string;
    entity: string;
    rowIndex: number;
    code: string;
    message: string;
    rawData: Record<string, any>;
    suggestion?: string;
  }>;
  onNewImport: () => void;
}

export default function ImportResults({ job, errors, onNewImport }: ImportResultsProps) {
  const { toast } = useToast();
  const [selectedError, setSelectedError] = useState<string | null>(null);

  const isSuccess = job.status === 'completed' && (job.errorCount || 0) === 0;
  const hasPartialSuccess = job.status === 'completed' && (job.successCount || 0) > 0 && (job.errorCount || 0) > 0;
  const isFailure = job.status === 'failed' || ((job.errorCount || 0) > 0 && (job.successCount || 0) === 0);

  const getOverallStatus = () => {
    if (isSuccess) {
      return {
        icon: <CheckCircle2 className="h-6 w-6 text-green-500" />,
        title: "Import Completed Successfully",
        description: `All ${job.successCount} records were imported successfully.`,
        variant: "default" as const
      };
    } else if (hasPartialSuccess) {
      return {
        icon: <AlertTriangle className="h-6 w-6 text-orange-500" />,
        title: "Import Completed with Warnings",
        description: `${job.successCount} records imported successfully, ${job.errorCount} had errors.`,
        variant: "default" as const
      };
    } else {
      return {
        icon: <AlertCircle className="h-6 w-6 text-red-500" />,
        title: "Import Failed",
        description: `Import failed with ${job.errorCount} errors. No records were imported.`,
        variant: "destructive" as const
      };
    }
  };

  const status = getOverallStatus();

  const getDuration = () => {
    if (!job.startedAt || !job.finishedAt) return 'Unknown';
    
    const start = new Date(job.startedAt);
    const end = new Date(job.finishedAt);
    const duration = end.getTime() - start.getTime();
    
    const seconds = Math.floor(duration / 1000);
    const minutes = Math.floor(seconds / 60);
    
    if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  };

  const getSummaryStats = () => {
    if (!job.summary) return [];
    
    const stats = [
      { 
        icon: <Users className="h-4 w-4" />, 
        label: 'Customers', 
        created: job.summary.customersCreated || 0,
        updated: job.summary.customersUpdated || 0,
        color: 'bg-blue-500'
      },
      { 
        icon: <Anchor className="h-4 w-4" />, 
        label: 'Boats', 
        created: job.summary.boatsCreated || 0,
        updated: job.summary.boatsUpdated || 0,
        color: 'bg-green-500'
      },
      { 
        icon: <MapPin className="h-4 w-4" />, 
        label: 'Slips', 
        created: job.summary.slipsCreated || 0,
        updated: job.summary.slipsUpdated || 0,
        color: 'bg-purple-500'
      },
      { 
        icon: <FileText className="h-4 w-4" />, 
        label: 'Leases', 
        created: job.summary.leasesCreated || 0,
        updated: job.summary.leasesUpdated || 0,
        color: 'bg-orange-500'
      }
    ];
    
    return stats.filter(stat => stat.created > 0 || stat.updated > 0);
  };

  const errorsByEntity = errors.reduce((acc, error) => {
    if (!acc[error.entity]) {
      acc[error.entity] = [];
    }
    acc[error.entity].push(error);
    return acc;
  }, {} as Record<string, typeof errors>);

  const downloadErrorReport = () => {
    if (errors.length === 0) return;
    
    const csvContent = [
      // Header
      ['Row', 'Entity', 'Error Code', 'Message', 'Suggestion', 'Raw Data'].join(','),
      // Data
      ...errors.map(error => [
        error.rowIndex + 1,
        error.entity,
        error.code,
        `"${error.message.replace(/"/g, '""')}"`,
        `"${(error.suggestion || '').replace(/"/g, '""')}"`,
        `"${JSON.stringify(error.rawData).replace(/"/g, '""')}"`
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `import-errors-${job.id}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);

    toast({
      title: "Error report downloaded",
      description: "The error report has been saved as a CSV file.",
    });
  };

  return (
    <div className="space-y-6">
      {/* Overall Status */}
      <Alert variant={status.variant}>
        <div className="flex items-start gap-3">
          {status.icon}
          <div className="flex-1">
            <h3 className="font-semibold text-lg">{status.title}</h3>
            <p className="text-sm mt-1">{status.description}</p>
          </div>
        </div>
      </Alert>

      {/* Summary Statistics */}
      <Card>
        <CardHeader>
          <CardTitle>Import Summary</CardTitle>
          <CardDescription>
            {job.fileName && `File: ${job.fileName} • `}
            Duration: {getDuration()} • 
            Completed: {new Date(job.finishedAt || '').toLocaleString()}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold text-gray-600">{job.totalRows || 0}</div>
              <div className="text-sm text-muted-foreground">Total Rows</div>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold text-green-600" data-testid="final-success-count">
                {job.successCount || 0}
              </div>
              <div className="text-sm text-muted-foreground">Successful</div>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold text-red-600" data-testid="final-error-count">
                {job.errorCount || 0}
              </div>
              <div className="text-sm text-muted-foreground">Errors</div>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold text-blue-600">
                {Math.round(((job.successCount || 0) / (job.totalRows || 1)) * 100)}%
              </div>
              <div className="text-sm text-muted-foreground">Success Rate</div>
            </div>
          </div>

          {/* Detailed Breakdown */}
          {getSummaryStats().length > 0 && (
            <div className="space-y-3">
              <h4 className="font-medium">Records Processed</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {getSummaryStats().map((stat, index) => (
                  <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-2">
                      {stat.icon}
                      <span className="font-medium">{stat.label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {stat.created > 0 && (
                        <Badge variant="outline" className="text-green-600 border-green-200">
                          +{stat.created} created
                        </Badge>
                      )}
                      {stat.updated > 0 && (
                        <Badge variant="outline" className="text-blue-600 border-blue-200">
                          {stat.updated} updated
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Error Details */}
      {errors.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-red-500" />
                  Import Errors ({errors.length})
                </CardTitle>
                <CardDescription>
                  Review and fix these errors before re-importing
                </CardDescription>
              </div>
              <Button variant="outline" onClick={downloadErrorReport} data-testid="button-download-errors">
                <Download className="mr-2 h-4 w-4" />
                Download Report
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="all" className="space-y-4">
              <TabsList>
                <TabsTrigger value="all" data-testid="tab-all-errors">
                  All Errors ({errors.length})
                </TabsTrigger>
                {Object.entries(errorsByEntity).map(([entity, entityErrors]) => (
                  <TabsTrigger key={entity} value={entity} data-testid={`tab-${entity}-errors`}>
                    {entity} ({entityErrors.length})
                  </TabsTrigger>
                ))}
              </TabsList>

              <TabsContent value="all">
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {errors.map((error) => (
                    <div key={error.id} className="border rounded-lg p-3 hover:bg-muted/50">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="outline">{error.entity}</Badge>
                            <Badge variant="destructive">{error.code}</Badge>
                            <span className="text-sm text-muted-foreground">Row {error.rowIndex + 1}</span>
                          </div>
                          <p className="text-sm">{error.message}</p>
                          {error.suggestion && (
                            <p className="text-xs text-blue-600 mt-1">
                              <Info className="inline h-3 w-3 mr-1" />
                              {error.suggestion}
                            </p>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedError(selectedError === error.id ? null : error.id)}
                          data-testid={`button-toggle-error-${error.id}`}
                        >
                          <ArrowUpRight className="h-4 w-4" />
                        </Button>
                      </div>
                      
                      {selectedError === error.id && (
                        <div className="mt-3 p-3 bg-muted rounded border">
                          <h5 className="font-medium text-sm mb-2">Raw Data:</h5>
                          <pre className="text-xs overflow-x-auto">
                            {JSON.stringify(error.rawData, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </TabsContent>

              {Object.entries(errorsByEntity).map(([entity, entityErrors]) => (
                <TabsContent key={entity} value={entity}>
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {entityErrors.map((error) => (
                      <div key={error.id} className="border rounded-lg p-3 hover:bg-muted/50">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant="destructive">{error.code}</Badge>
                              <span className="text-sm text-muted-foreground">Row {error.rowIndex + 1}</span>
                            </div>
                            <p className="text-sm">{error.message}</p>
                            {error.suggestion && (
                              <p className="text-xs text-blue-600 mt-1">
                                <Info className="inline h-3 w-3 mr-1" />
                                {error.suggestion}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </TabsContent>
              ))}
            </Tabs>
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <div className="flex justify-between">
        <div className="space-x-2">
          {errors.length > 0 && (
            <Button variant="outline" onClick={downloadErrorReport} data-testid="button-download-errors-bottom">
              <FileSpreadsheet className="mr-2 h-4 w-4" />
              Export Errors
            </Button>
          )}
        </div>
        
        <Button onClick={onNewImport} data-testid="button-new-import-results">
          <RefreshCw className="mr-2 h-4 w-4" />
          Start New Import
        </Button>
      </div>
    </div>
  );
}