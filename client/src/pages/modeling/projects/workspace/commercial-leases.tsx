import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Building2,
  FileSpreadsheet,
  BarChart3,
  RefreshCw,
  ArrowRight,
  DollarSign,
  TrendingUp,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Zap,
  Info,
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/utils';
import LeaseListPage from '@/components/leases/LeaseListPage';
import { useProjectLeaseStats } from '@/hooks/use-leases';

interface CommercialLeasesWorkspaceProps {
  projectId: string;
  projectName: string;
  onTabChange?: (tab: string) => void;
}

interface ProFormaSyncStatus {
  lastSyncedAt?: string;
  syncEnabled: boolean;
  monthsSynced?: number;
}

export default function CommercialLeasesWorkspace({
  projectId,
  projectName,
  onTabChange,
}: CommercialLeasesWorkspaceProps) {
  const [subTab, setSubTab] = useState('lease-data');
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { stats } = useProjectLeaseStats(projectId);

  const { data: syncStatus, isLoading: syncStatusLoading } = useQuery<ProFormaSyncStatus>({
    queryKey: ['/api/commercial-leases/projects', projectId, 'sync-status'],
    queryFn: async () => {
      try {
        const res = await fetch(`/api/commercial-leases/projects/${projectId}/sync-status`, {
          credentials: 'include',
        });
        if (!res.ok) return { syncEnabled: true };
        return res.json();
      } catch {
        return { syncEnabled: true };
      }
    },
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/commercial-leases/projects/${projectId}/sync-to-proforma`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) throw new Error('Sync failed');
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/commercial-leases/projects', projectId, 'sync-status'] });
      queryClient.invalidateQueries({ queryKey: ['/api/modeling/projects', projectId, 'pro-forma'] });
      toast({
        title: 'Synced to Pro Forma',
        description: `${data.synced || 0} months of commercial lease revenue synced successfully.`,
      });
    },
    onError: () => {
      toast({
        title: 'Sync Failed',
        description: 'Could not sync commercial leases to Pro Forma. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const toggleSyncMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      const res = await fetch(`/api/commercial-leases/projects/${projectId}/sync-toggle`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ syncEnabled: enabled }),
      });
      if (!res.ok) throw new Error('Toggle failed');
      return res.json();
    },
    onSuccess: (_, enabled) => {
      queryClient.invalidateQueries({ queryKey: ['/api/commercial-leases/projects', projectId, 'sync-status'] });
      queryClient.invalidateQueries({ queryKey: ['/api/modeling/projects', projectId, 'pro-forma'] });
      toast({
        title: enabled ? 'Pro Forma Override Enabled' : 'Pro Forma Override Disabled',
        description: enabled
          ? 'Commercial lease data will flow into your Pro Forma automatically.'
          : 'Commercial lease data will NOT be included in your Pro Forma. You can enter values manually.',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Could not update sync setting.',
        variant: 'destructive',
      });
    },
  });

  const isSyncEnabled = syncStatus?.syncEnabled ?? true;

  return (
    <Tabs value={subTab} onValueChange={setSubTab} className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Commercial Leases
          </h3>
          <p className="text-sm text-muted-foreground">
            Full lease management — base rent, escalations, options, recoveries, TI, and percentage rent for {projectName}
          </p>
        </div>
      </div>

      <TabsList>
        <TabsTrigger value="lease-data" className="gap-2">
          <FileSpreadsheet className="h-4 w-4" />
          Lease Data
        </TabsTrigger>
        <TabsTrigger value="proforma-sync" className="gap-2">
          <BarChart3 className="h-4 w-4" />
          Pro Forma Integration
        </TabsTrigger>
      </TabsList>

      <TabsContent value="lease-data">
        <LeaseListPage projectId={projectId} />
      </TabsContent>

      <TabsContent value="proforma-sync" className="space-y-6">
        {/* Sync Status Header */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Active Leases</p>
                  <p className="text-2xl font-bold">{stats?.activeLeases ?? 0}</p>
                  <p className="text-xs text-muted-foreground">
                    {(stats?.totalSf ?? 0).toLocaleString()} total SF
                  </p>
                </div>
                <Building2 className="h-8 w-8 text-muted-foreground/50" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Avg Rent/SF/Yr</p>
                  <p className="text-2xl font-bold">
                    {stats?.avgRentPerSf ? formatCurrency(stats.avgRentPerSf) : '$0'}
                  </p>
                  <p className="text-xs text-muted-foreground">weighted average</p>
                </div>
                <DollarSign className="h-8 w-8 text-muted-foreground/50" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Pro Forma Status</p>
                  <p className="text-2xl font-bold">
                    {isSyncEnabled ? (
                      <span className="text-green-600 flex items-center gap-1">
                        <CheckCircle2 className="h-5 w-5" /> Active
                      </span>
                    ) : (
                      <span className="text-amber-600 flex items-center gap-1">
                        <AlertTriangle className="h-5 w-5" /> Override
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {syncStatus?.lastSyncedAt
                      ? `Last synced ${new Date(syncStatus.lastSyncedAt).toLocaleDateString()}`
                      : 'Not yet synced'}
                  </p>
                </div>
                <TrendingUp className="h-8 w-8 text-muted-foreground/50" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Pro Forma Override Toggle */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Pro Forma Integration
            </CardTitle>
            <CardDescription>
              Control how commercial lease revenue flows into your Pro Forma model
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/30">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <p className="font-medium">Use Commercial Lease Engine for Pro Forma</p>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <Info className="h-4 w-4 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p>
                          When enabled, your Pro Forma's "Commercial Tenants" revenue line will be automatically
                          calculated from lease data entered here. When disabled, you can manually override
                          the commercial revenue in Pro Forma inputs.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <p className="text-sm text-muted-foreground">
                  {isSyncEnabled
                    ? 'Lease engine data flows automatically to Pro Forma. Manual Pro Forma inputs for commercial tenants are overridden.'
                    : 'Pro Forma uses manual inputs for commercial tenant revenue. Lease engine data is NOT synced.'}
                </p>
              </div>
              <Switch
                checked={isSyncEnabled}
                onCheckedChange={(checked) => toggleSyncMutation.mutate(checked)}
                disabled={toggleSyncMutation.isPending}
              />
            </div>

            {isSyncEnabled && (
              <>
                <Separator />
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Sync Lease Cashflows to Pro Forma</p>
                      <p className="text-sm text-muted-foreground">
                        Recalculate all lease cashflows and push aggregated monthly revenue into the Pro Forma engine.
                        This will update the "Commercial Tenants" revenue line for all projection months.
                      </p>
                    </div>
                    <Button
                      onClick={() => syncMutation.mutate()}
                      disabled={syncMutation.isPending || (stats?.activeLeases ?? 0) === 0}
                    >
                      {syncMutation.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Syncing...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="h-4 w-4 mr-2" />
                          Sync Now
                        </>
                      )}
                    </Button>
                  </div>

                  {syncStatus?.monthsSynced && syncStatus.monthsSynced > 0 && (
                    <Alert>
                      <CheckCircle2 className="h-4 w-4" />
                      <AlertDescription>
                        {syncStatus.monthsSynced} months of commercial lease revenue are currently synced to your Pro Forma.
                        {syncStatus.lastSyncedAt && (
                          <span className="text-muted-foreground">
                            {' '}Last updated {new Date(syncStatus.lastSyncedAt).toLocaleString()}.
                          </span>
                        )}
                      </AlertDescription>
                    </Alert>
                  )}

                  {(stats?.activeLeases ?? 0) === 0 && (
                    <Alert variant="destructive">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>
                        No active leases found. Add commercial tenant leases in the "Lease Data" tab before syncing.
                      </AlertDescription>
                    </Alert>
                  )}
                </div>

                <Separator />

                <div className="space-y-3">
                  <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide">How it works</p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="flex items-start gap-3 p-3 rounded-lg border">
                      <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                        <span className="text-sm font-bold text-blue-700">1</span>
                      </div>
                      <div>
                        <p className="text-sm font-medium">Enter Lease Data</p>
                        <p className="text-xs text-muted-foreground">
                          Add tenants with base rent, escalations, options, recoveries, TI, and percentage rent
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 p-3 rounded-lg border">
                      <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                        <span className="text-sm font-bold text-blue-700">2</span>
                      </div>
                      <div>
                        <p className="text-sm font-medium">Compute Cashflows</p>
                        <p className="text-xs text-muted-foreground">
                          The engine calculates monthly cashflows across all lease terms and charge lines
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 p-3 rounded-lg border">
                      <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                        <span className="text-sm font-bold text-blue-700">3</span>
                      </div>
                      <div>
                        <p className="text-sm font-medium">Flow to Pro Forma</p>
                        <p className="text-xs text-muted-foreground">
                          Aggregated revenue syncs to the Pro Forma's "Commercial Tenants" line item
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}

            {!isSyncEnabled && (
              <>
                <Separator />
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    Pro Forma override is active. Commercial tenant revenue in your Pro Forma is set manually via
                    Inputs & Assumptions. Re-enable the toggle above to use automatically calculated lease data.
                  </AlertDescription>
                </Alert>
              </>
            )}
          </CardContent>
        </Card>

        {/* Navigate to Pro Forma */}
        <Card className="border-dashed">
          <CardContent className="flex items-center justify-between py-4">
            <div className="flex items-center gap-3">
              <BarChart3 className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="font-medium">View in Pro Forma</p>
                <p className="text-sm text-muted-foreground">
                  See how commercial lease revenue appears in your financial projections
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              onClick={() => onTabChange?.('proforma')}
            >
              Go to Pro Forma
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
