import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { RefreshCw, CheckCircle2, AlertCircle, Clock, Loader2, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";

interface SyncStatus {
  integrationKey: string;
  integrationName: string;
  isConnected: boolean;
  lastSyncAt: string | null;
  lastSyncStatus: 'completed' | 'failed' | 'partial' | null;
  lastSyncRecords: number;
  healthScore: number;
}

interface SyncResult {
  success: boolean;
  integrationKey: string;
  syncId: string;
  recordsProcessed: number;
  recordsCreated: number;
  recordsUpdated: number;
  errors: Array<{ code: string; message: string }>;
}

interface SyncStatusBannerProps {
  moduleName: 'fuel' | 'rent-roll' | 'ship-store';
  showSettings?: boolean;
}

export function SyncStatusBanner({ moduleName, showSettings = false }: SyncStatusBannerProps) {
  const { toast } = useToast();
  const [selectedIntegration, setSelectedIntegration] = useState<string>("");

  const { data: syncStatus, isLoading } = useQuery<SyncStatus[]>({
    queryKey: ['/api/operations/sync/status'],
    staleTime: 30 * 1000,
  });

  const syncMutation = useMutation({
    mutationFn: async (integrationKey: string) => {
      const response = await apiRequest('POST', `/api/operations/sync/${integrationKey}`, {
        entityTypes: getEntityTypesForModule(moduleName),
      });
      return response.json() as Promise<SyncResult>;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/operations/sync/status'] });
      if (moduleName === 'fuel') {
        queryClient.invalidateQueries({ queryKey: ['/api/fuel'] });
      } else if (moduleName === 'rent-roll') {
        queryClient.invalidateQueries({ queryKey: ['/api/rent-rolls'] });
      } else if (moduleName === 'ship-store') {
        queryClient.invalidateQueries({ queryKey: ['/api/ship-store'] });
      }
      
      toast({
        title: data.success ? "Sync Complete" : "Sync Completed with Errors",
        description: `Processed ${data.recordsProcessed} records. Created: ${data.recordsCreated}, Updated: ${data.recordsUpdated}`,
        variant: data.success ? "default" : "destructive",
      });
    },
    onError: (error) => {
      toast({
        title: "Sync Failed",
        description: error instanceof Error ? error.message : "Failed to sync data",
        variant: "destructive",
      });
    },
  });

  const connectedIntegrations = syncStatus?.filter(s => s.isConnected) || [];
  const hasIntegrations = connectedIntegrations.length > 0;

  if (isLoading) {
    return (
      <Card className="mb-4 bg-muted/30">
        <CardContent className="py-3 px-4 flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Loading sync status...</span>
        </CardContent>
      </Card>
    );
  }

  if (!hasIntegrations) {
    return (
      <Card className="mb-4 border-dashed">
        <CardContent className="py-3 px-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Settings className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              Connect a marina management system to sync data automatically
            </span>
          </div>
          <Button variant="outline" size="sm" asChild>
            <a href="/settings/integrations">Connect Integration</a>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const effectiveIntegration = selectedIntegration 
    ? connectedIntegrations.find(i => i.integrationKey === selectedIntegration)
    : connectedIntegrations[0];

  return (
    <Card className="mb-4">
      <CardContent className="py-3 px-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 flex-1">
            {connectedIntegrations.length > 1 && (
              <Select 
                value={selectedIntegration || connectedIntegrations[0]?.integrationKey} 
                onValueChange={setSelectedIntegration}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Select integration" />
                </SelectTrigger>
                <SelectContent>
                  {connectedIntegrations.map((integration) => (
                    <SelectItem key={integration.integrationKey} value={integration.integrationKey}>
                      {integration.integrationName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {connectedIntegrations.length === 1 && (
              <Badge variant="outline" className="font-normal">
                {connectedIntegrations[0].integrationName}
              </Badge>
            )}

            <div className="flex items-center gap-2">
              <SyncStatusIndicator status={effectiveIntegration?.lastSyncStatus} />
              {effectiveIntegration?.lastSyncAt && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="text-sm text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Last sync: {formatDistanceToNow(new Date(effectiveIntegration.lastSyncAt), { addSuffix: true })}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{new Date(effectiveIntegration.lastSyncAt).toLocaleString()}</p>
                      <p className="text-muted-foreground">{effectiveIntegration.lastSyncRecords} records synced</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>

            {effectiveIntegration && effectiveIntegration.healthScore < 100 && (
              <Badge variant="destructive" className="font-normal">
                Health: {effectiveIntegration.healthScore}%
              </Badge>
            )}
          </div>

          <Button 
            variant="outline" 
            size="sm"
            onClick={() => {
              const key = selectedIntegration || connectedIntegrations[0]?.integrationKey;
              if (key) syncMutation.mutate(key);
            }}
            disabled={syncMutation.isPending}
          >
            {syncMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Sync Now
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function SyncStatusIndicator({ status }: { status: 'completed' | 'failed' | 'partial' | null }) {
  if (!status) {
    return (
      <Badge variant="secondary" className="font-normal">
        Never synced
      </Badge>
    );
  }

  switch (status) {
    case 'completed':
      return (
        <Badge variant="default" className="bg-green-600 font-normal">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          Synced
        </Badge>
      );
    case 'partial':
      return (
        <Badge variant="secondary" className="bg-yellow-500 text-white font-normal">
          <AlertCircle className="h-3 w-3 mr-1" />
          Partial
        </Badge>
      );
    case 'failed':
      return (
        <Badge variant="destructive" className="font-normal">
          <AlertCircle className="h-3 w-3 mr-1" />
          Failed
        </Badge>
      );
    default:
      return null;
  }
}

function getEntityTypesForModule(moduleName: string): string[] {
  switch (moduleName) {
    case 'fuel':
      return ['transactions'];
    case 'rent-roll':
      return ['slips', 'tenants'];
    case 'ship-store':
      return ['transactions'];
    default:
      return ['slips', 'tenants', 'transactions'];
  }
}
