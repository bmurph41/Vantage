import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { RefreshCw, Check, AlertCircle, Clock, Database } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface SyncOverviewResponse {
  connectedCount: number;
  integrations: Array<{
    integrationKey: string;
    integrationName: string;
    category: string;
    isConnected: boolean;
    lastSyncAt: string | null;
    errorMessage: string | null;
    dataMappingsCount: number;
    availableModules: string[];
    migrationSupport: {
      supportsHistoricalImport: boolean;
      canExportAll: boolean;
    } | null;
  }>;
  moduleCoverage: Record<string, { 
    integrations: string[]; 
    canSync: string[] 
  }>;
}

interface SyncStatusPanelProps {
  showModuleCoverage?: boolean;
  onSyncComplete?: () => void;
}

const MODULE_LABELS: Record<string, string> = {
  rentRoll: "Rent Roll",
  crm: "CRM",
  financials: "Financials",
  boatRentals: "Boat Rentals",
  fuelSales: "Fuel Sales",
  analytics: "Analytics",
  marketing: "Marketing",
  service: "Service",
  bookkeeping: "Bookkeeping",
  documents: "Documents",
};

export function SyncStatusPanel({ showModuleCoverage = true, onSyncComplete }: SyncStatusPanelProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: syncOverview, isLoading, refetch } = useQuery<SyncOverviewResponse>({
    queryKey: ['/api/integrations/sync/overview'],
  });

  const syncMutation = useMutation({
    mutationFn: async (integrationKey: string) => {
      return apiRequest(`/api/integrations/${integrationKey}/sync`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
    },
    onSuccess: (data, integrationKey) => {
      toast({
        title: "Sync Started",
        description: `Sync queued for ${integrationKey}`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/integrations/sync/overview'] });
      onSyncComplete?.();
    },
    onError: (error: Error, integrationKey) => {
      toast({
        title: "Sync Failed",
        description: `Failed to start sync for ${integrationKey}`,
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />
          <p className="text-sm text-muted-foreground mt-2">Loading sync status...</p>
        </CardContent>
      </Card>
    );
  }

  if (!syncOverview || syncOverview.connectedCount === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Database className="w-5 h-5" />
            Data Sync
          </CardTitle>
          <CardDescription>Connect integrations to sync data from external systems</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">
            <p className="text-sm text-muted-foreground">No integrations connected yet.</p>
            <p className="text-xs text-muted-foreground mt-1">
              Connect to marina management systems to import and sync data automatically.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Database className="w-5 h-5" />
              Data Sync Overview
            </CardTitle>
            <CardDescription>
              {syncOverview.connectedCount} integration{syncOverview.connectedCount !== 1 ? 's' : ''} connected
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isLoading}
          >
            <RefreshCw className={`w-4 h-4 mr-1.5 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          {syncOverview.integrations.map((integration) => (
            <div
              key={integration.integrationKey}
              className="flex items-center justify-between p-3 rounded-lg border bg-card"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#1E4FAB] to-[#152d6b] flex items-center justify-center text-white font-semibold text-xs">
                  {integration.integrationName.charAt(0)}
                </div>
                <div>
                  <p className="font-medium text-sm">{integration.integrationName}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-muted-foreground">{integration.category}</span>
                    {integration.errorMessage ? (
                      <Badge variant="destructive" className="text-[10px] h-4">
                        <AlertCircle className="w-2.5 h-2.5 mr-0.5" />
                        Error
                      </Badge>
                    ) : integration.lastSyncAt ? (
                      <Badge variant="secondary" className="text-[10px] h-4">
                        <Check className="w-2.5 h-2.5 mr-0.5" />
                        Synced
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] h-4">
                        <Clock className="w-2.5 h-2.5 mr-0.5" />
                        Not synced
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {integration.lastSyncAt && (
                  <span className="text-xs text-muted-foreground hidden sm:block">
                    {new Date(integration.lastSyncAt).toLocaleString()}
                  </span>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => syncMutation.mutate(integration.integrationKey)}
                  disabled={syncMutation.isPending}
                >
                  <RefreshCw className={`w-3.5 h-3.5 mr-1 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
                  Sync
                </Button>
              </div>
            </div>
          ))}
        </div>

        {showModuleCoverage && Object.keys(syncOverview.moduleCoverage).length > 0 && (
          <div className="border-t pt-4">
            <h4 className="text-sm font-medium mb-3">Module Coverage</h4>
            <div className="grid gap-2 sm:grid-cols-2">
              {Object.entries(syncOverview.moduleCoverage).map(([module, coverage]) => (
                <div
                  key={module}
                  className="p-2 rounded border bg-muted/30"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">
                      {MODULE_LABELS[module] || module}
                    </span>
                    <Badge variant="outline" className="text-[10px]">
                      {coverage.integrations.length} source{coverage.integrations.length !== 1 ? 's' : ''}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {coverage.canSync.map((entity) => (
                      <span
                        key={entity}
                        className="px-1.5 py-0.5 bg-background rounded text-[10px] text-muted-foreground"
                      >
                        {entity}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default SyncStatusPanel;
