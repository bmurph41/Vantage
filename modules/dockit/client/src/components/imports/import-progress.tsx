import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Loader2, Clock, CheckCircle2, AlertCircle, Users, Anchor, MapPin, FileText } from "lucide-react";

interface ImportProgressProps {
  job: {
    id: string;
    fileName?: string;
    status: 'queued' | 'running' | 'completed' | 'failed';
    totalRows?: number;
    processedRows?: number;
    successCount?: number;
    errorCount?: number;
    startedAt?: string;
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
  onCancel: () => void;
}

export default function ImportProgress({ job, onCancel }: ImportProgressProps) {
  const progressPercentage = job.totalRows && job.processedRows 
    ? Math.round((job.processedRows / job.totalRows) * 100)
    : 0;

  const getStatusInfo = () => {
    switch (job.status) {
      case 'queued':
        return {
          icon: <Clock className="h-5 w-5" />,
          label: 'Queued',
          description: 'Waiting to start processing...',
          color: 'bg-gray-500'
        };
      case 'running':
        return {
          icon: <Loader2 className="h-5 w-5 animate-spin" />,
          label: 'Processing',
          description: 'Import is currently running...',
          color: 'bg-blue-500'
        };
      case 'completed':
        return {
          icon: <CheckCircle2 className="h-5 w-5" />,
          label: 'Completed',
          description: 'Import finished successfully',
          color: 'bg-green-500'
        };
      case 'failed':
        return {
          icon: <AlertCircle className="h-5 w-5" />,
          label: 'Failed',
          description: 'Import encountered errors',
          color: 'bg-red-500'
        };
      default:
        return {
          icon: <Clock className="h-5 w-5" />,
          label: 'Unknown',
          description: 'Status unknown',
          color: 'bg-gray-500'
        };
    }
  };

  const statusInfo = getStatusInfo();

  const formatElapsedTime = () => {
    if (!job.startedAt) return 'Not started';
    
    const startTime = new Date(job.startedAt);
    const now = new Date();
    const elapsed = now.getTime() - startTime.getTime();
    
    const seconds = Math.floor(elapsed / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
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
        updated: job.summary.customersUpdated || 0
      },
      { 
        icon: <Anchor className="h-4 w-4" />, 
        label: 'Boats', 
        created: job.summary.boatsCreated || 0,
        updated: job.summary.boatsUpdated || 0
      },
      { 
        icon: <MapPin className="h-4 w-4" />, 
        label: 'Slips', 
        created: job.summary.slipsCreated || 0,
        updated: job.summary.slipsUpdated || 0
      },
      { 
        icon: <FileText className="h-4 w-4" />, 
        label: 'Leases', 
        created: job.summary.leasesCreated || 0,
        updated: job.summary.leasesUpdated || 0
      }
    ];
    
    return stats.filter(stat => stat.created > 0 || stat.updated > 0);
  };

  return (
    <div className="space-y-6" data-testid="import-progress">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            {statusInfo.icon}
            Import Progress
            <Badge className={statusInfo.color}>
              {statusInfo.label}
            </Badge>
          </CardTitle>
          <CardDescription>
            {job.fileName && `Processing: ${job.fileName}`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Progress</span>
              <span>{progressPercentage}%</span>
            </div>
            <Progress 
              value={progressPercentage} 
              className="h-2"
              data-testid="import-progress-bar"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>
                {job.processedRows || 0} of {job.totalRows || 0} rows processed
              </span>
              <span>Elapsed: {formatElapsedTime()}</span>
            </div>
          </div>

          {/* Status Details */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold text-green-600" data-testid="success-count">
                {job.successCount || 0}
              </div>
              <div className="text-sm text-muted-foreground">Successful</div>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold text-red-600" data-testid="error-count">
                {job.errorCount || 0}
              </div>
              <div className="text-sm text-muted-foreground">Errors</div>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold text-blue-600">
                {(job.processedRows || 0) - (job.successCount || 0) - (job.errorCount || 0)}
              </div>
              <div className="text-sm text-muted-foreground">Remaining</div>
            </div>
          </div>

          {/* Real-time Summary (if available) */}
          {job.summary && getSummaryStats().length > 0 && (
            <div className="space-y-3">
              <h4 className="font-medium">Import Summary</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {getSummaryStats().map((stat, index) => (
                  <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-2">
                      {stat.icon}
                      <span className="font-medium">{stat.label}</span>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {stat.created > 0 && <span className="text-green-600">+{stat.created} created</span>}
                      {stat.created > 0 && stat.updated > 0 && <span className="mx-1">•</span>}
                      {stat.updated > 0 && <span className="text-blue-600">{stat.updated} updated</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Status Message */}
          <div className="p-4 bg-muted rounded-lg">
            <p className="text-sm">{statusInfo.description}</p>
            {job.status === 'running' && (
              <p className="text-xs text-muted-foreground mt-1">
                This page will automatically update as the import progresses.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex justify-between">
        <div>
          {job.status === 'running' && (
            <Button variant="outline" onClick={onCancel} data-testid="button-view-progress">
              View Current Results
            </Button>
          )}
        </div>
        
        <div className="space-x-2">
          {(job.status === 'completed' || job.status === 'failed') && (
            <Button onClick={onCancel} data-testid="button-view-results">
              View Results
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}