import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Activity, 
  CheckCircle2, 
  XCircle, 
  RefreshCw, 
  Clock, 
  Zap,
  Database,
  TrendingUp,
  AlertTriangle,
  Fuel,
  ShoppingCart,
  Anchor,
  Wrench
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Link } from "wouter";

interface LiveDataStatusPanelProps {
  projectId: string;
  dealSource?: string | null;
  className?: string;
}

interface LiveDataSource {
  integrationKey: string;
  integrationName: string;
  isConnected: boolean;
  lastSyncAt: string | null;
  dataTypes: string[];
  targetModules: string[];
}

interface PipelineProjectResponse {
  projectId: string;
  isEligibleForLiveData: boolean;
  operationsData: {
    fuelSales?: {
      monthlyRevenue: number;
      gallonsSold: number;
      lastUpdated: string | null;
    };
    shipStore?: {
      monthlyRevenue: number;
      transactionCount: number;
      lastUpdated: string | null;
    };
    boatRentals?: {
      monthlyRevenue: number;
      reservationCount: number;
      utilizationRate: number;
      lastUpdated: string | null;
    };
    service?: {
      monthlyRevenue: number;
      workOrderCount: number;
      lastUpdated: string | null;
    };
    financials?: {
      monthlyRevenue: number;
      monthlyExpenses: number;
      ebitda: number;
      lastSyncAt: string | null;
      source: string;
    };
  } | null;
}

interface PipelineStatusResponse {
  bookkeeping: {
    pnlConnected: boolean;
    chartOfAccountsConnected: boolean;
    arConnected: boolean;
    bankTransactionsConnected: boolean;
    lastSyncAt: string | null;
    syncSource: string | null;
  };
  liveDataSources: LiveDataSource[];
}

const moduleIcons: Record<string, React.ElementType> = {
  fuelSales: Fuel,
  shipStore: ShoppingCart,
  boatRentals: Anchor,
  service: Wrench,
  financials: TrendingUp,
};

function formatTimeAgo(dateString: string | null): string {
  if (!dateString) return "Never";
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}

function DataFreshnessIndicator({ lastSync }: { lastSync: string | null }) {
  if (!lastSync) {
    return (
      <div className="flex items-center gap-1 text-muted-foreground">
        <Clock className="w-3 h-3" />
        <span className="text-xs">No sync</span>
      </div>
    );
  }

  const date = new Date(lastSync);
  const now = new Date();
  const diffHours = (now.getTime() - date.getTime()) / 3600000;

  if (diffHours < 1) {
    return (
      <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
        <Zap className="w-3 h-3" />
        <span className="text-xs">Live</span>
      </div>
    );
  } else if (diffHours < 24) {
    return (
      <div className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
        <Clock className="w-3 h-3" />
        <span className="text-xs">{formatTimeAgo(lastSync)}</span>
      </div>
    );
  } else {
    return (
      <div className="flex items-center gap-1 text-orange-600 dark:text-orange-400">
        <AlertTriangle className="w-3 h-3" />
        <span className="text-xs">{formatTimeAgo(lastSync)}</span>
      </div>
    );
  }
}

export function LiveDataStatusPanel({ projectId, dealSource, className }: LiveDataStatusPanelProps) {
  const isOwnedMarina = dealSource === "owned_marina";

  const { data: pipelineStatus, isLoading: statusLoading } = useQuery<PipelineStatusResponse>({
    queryKey: ["/api/integrations/pipeline/status"],
    enabled: isOwnedMarina,
  });

  const { data: projectData, isLoading: projectLoading, refetch } = useQuery<PipelineProjectResponse>({
    queryKey: ["/api/integrations/pipeline/project", projectId],
    enabled: isOwnedMarina && !!projectId,
  });

  if (!isOwnedMarina) {
    return (
      <Card className={cn("border-dashed", className)}>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-muted-foreground" />
            <CardTitle className="text-base">Live Operations Data</CardTitle>
          </div>
          <CardDescription>
            Live data sync is available only for owned assets
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground bg-muted/50 rounded-lg p-4">
            <p className="mb-2">
              When you mark a marina as <strong>"Owned Marina"</strong> in the deal source, 
              you can connect integrations to sync live operational data directly into your valuation model.
            </p>
            <p className="text-xs">
              This includes fuel sales, ship store revenue, service work orders, and QuickBooks financials.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (statusLoading || projectLoading) {
    return (
      <Card className={className}>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-[#1E4FAB]" />
            <CardTitle className="text-base">Live Operations Data</CardTitle>
          </div>
          <Skeleton className="h-4 w-48 mt-1" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </CardContent>
      </Card>
    );
  }

  const connectedSources = pipelineStatus?.liveDataSources || [];
  const operationsData = projectData?.operationsData;
  const hasConnections = connectedSources.length > 0;

  return (
    <Card className={cn("border-[#1E4FAB]/20", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-[#1E4FAB]" />
            <CardTitle className="text-base">Live Operations Data</CardTitle>
            {hasConnections && (
              <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800">
                <CheckCircle2 className="w-3 h-3 mr-1" />
                Active
              </Badge>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => refetch()}
            className="h-8 w-8 p-0"
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
        <CardDescription>
          Real-time data from connected integrations flows into your valuation
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!hasConnections ? (
          <div className="text-center py-6 bg-muted/30 rounded-lg">
            <XCircle className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm font-medium">No integrations connected</p>
            <p className="text-xs text-muted-foreground mt-1 mb-3">
              Connect your marina software to sync live data
            </p>
            <Link href="/settings/integrations">
              <Button size="sm" className="bg-[#1E4FAB] hover:bg-[#1a4294]">
                Connect Integrations
              </Button>
            </Link>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              {connectedSources.map((source) => (
                <div
                  key={source.integrationKey}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-[#1E4FAB]/10 flex items-center justify-center">
                      <Database className="w-4 h-4 text-[#1E4FAB]" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{source.integrationName}</p>
                      <p className="text-xs text-muted-foreground">
                        {source.dataTypes.length} data type{source.dataTypes.length !== 1 ? "s" : ""}
                      </p>
                    </div>
                  </div>
                  <DataFreshnessIndicator lastSync={source.lastSyncAt} />
                </div>
              ))}
            </div>

            {operationsData && Object.keys(operationsData).length > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Data Modules
                </div>
                <div className="space-y-2">
                  {Object.entries(operationsData).map(([key, data]) => {
                    if (!data) return null;
                    const Icon = moduleIcons[key] || Database;
                    const lastUpdated = "lastUpdated" in data ? data.lastUpdated : 
                                        "lastSyncAt" in data ? data.lastSyncAt : null;
                    
                    return (
                      <div
                        key={key}
                        className="flex items-center justify-between p-2 rounded border bg-background"
                      >
                        <div className="flex items-center gap-2">
                          <Icon className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm capitalize">
                            {key.replace(/([A-Z])/g, " $1").trim()}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          {"monthlyRevenue" in data && (
                            <span className="text-sm font-medium">
                              ${(data.monthlyRevenue || 0).toLocaleString()}/mo
                            </span>
                          )}
                          <DataFreshnessIndicator lastSync={lastUpdated} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="pt-2 border-t flex items-center justify-between">
              <div className="text-xs text-muted-foreground">
                Data syncs automatically when integrations update
              </div>
              <Link href="/operations/bookkeeping" className="text-xs text-[#1E4FAB] hover:underline">
                Manage Sync
              </Link>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
