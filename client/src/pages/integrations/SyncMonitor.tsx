import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'wouter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  Activity,
  ArrowDownToLine,
  ArrowUpFromLine,
  Settings,
  Loader2,
  Wifi,
  WifiOff,
  Database,
  Anchor
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

interface IntegrationSync {
  id: string;
  name: string;
  type: 'marina_management' | 'accounting' | 'crm' | 'data';
  provider: string;
  status: 'connected' | 'syncing' | 'error' | 'disconnected' | 'pending';
  lastSync: Date | null;
  nextSync: Date | null;
  recordsImported: number;
  recordsExported: number;
  errorCount: number;
  healthScore: number;
}

interface SyncHistoryItem {
  id: string;
  integrationId: string;
  integrationName: string;
  type: 'import' | 'export' | 'full_sync';
  status: 'success' | 'partial' | 'failed';
  startTime: Date;
  endTime: Date;
  recordsProcessed: number;
  errors: number;
  message: string;
}

interface IntegrationSyncRaw extends Omit<IntegrationSync, 'lastSync' | 'nextSync'> {
  lastSync: string | null;
  nextSync: string | null;
}

interface SyncHistoryItemRaw extends Omit<SyncHistoryItem, 'startTime' | 'endTime'> {
  startTime: string;
  endTime: string;
}


function getStatusIcon(status: IntegrationSync['status']) {
  switch (status) {
    case 'connected':
      return <CheckCircle2 className="h-4 w-4 text-green-600" />;
    case 'syncing':
      return <RefreshCw className="h-4 w-4 text-blue-600 animate-spin" />;
    case 'error':
      return <XCircle className="h-4 w-4 text-red-600" />;
    case 'disconnected':
      return <WifiOff className="h-4 w-4 text-gray-500" />;
    case 'pending':
      return <Clock className="h-4 w-4 text-yellow-600" />;
    default:
      return null;
  }
}

function getStatusBadge(status: IntegrationSync['status']) {
  const variants: Record<IntegrationSync['status'], 'default' | 'secondary' | 'destructive' | 'outline'> = {
    connected: 'default',
    syncing: 'secondary',
    error: 'destructive',
    disconnected: 'outline',
    pending: 'outline',
  };
  return (
    <Badge variant={variants[status]} className="capitalize">
      {status}
    </Badge>
  );
}

function getSyncStatusBadge(status: SyncHistoryItem['status']) {
  if (status === 'success') {
    return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Success</Badge>;
  }
  if (status === 'partial') {
    return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">Partial</Badge>;
  }
  return <Badge variant="destructive">Failed</Badge>;
}

function getTypeIcon(type: IntegrationSync['type']) {
  switch (type) {
    case 'marina_management':
      return <Anchor className="h-4 w-4" />;
    case 'accounting':
      return <Database className="h-4 w-4" />;
    case 'crm':
      return <Activity className="h-4 w-4" />;
    default:
      return <Settings className="h-4 w-4" />;
  }
}

export default function SyncMonitor() {
  const [activeTab, setActiveTab] = useState('overview');
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: integrations, isLoading } = useQuery<IntegrationSyncRaw[], Error, IntegrationSync[], string[]>({
    queryKey: ['/api/integrations/sync-status'],
    select: (data: IntegrationSyncRaw[]): IntegrationSync[] =>
      data.map((item) => ({
        ...item,
        lastSync: item.lastSync ? new Date(item.lastSync) : null,
        nextSync: item.nextSync ? new Date(item.nextSync) : null,
      })),
  });

  const { data: history } = useQuery<SyncHistoryItemRaw[], Error, SyncHistoryItem[], string[]>({
    queryKey: ['/api/integrations/sync-history'],
    select: (data: SyncHistoryItemRaw[]): SyncHistoryItem[] =>
      data.map((item) => ({
        ...item,
        startTime: new Date(item.startTime),
        endTime: new Date(item.endTime),
      })),
  });

  const syncMutation = useMutation({
    mutationFn: async (integrationId: string) => {
      const res = await fetch(`/api/integrations/${integrationId}/sync`, { method: 'POST' });
      if (!res.ok) throw new Error('Sync failed');
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Sync Started", description: "Integration sync has been initiated." });
      queryClient.invalidateQueries({ queryKey: ['/api/integrations/sync-status'] });
      queryClient.invalidateQueries({ queryKey: ['/api/integrations/sync-history'] });
    },
    onError: () => {
      toast({ title: "Sync Failed", description: "Unable to start sync. Please try again.", variant: "destructive" });
    },
  });

  const syncAllMutation = useMutation({
    mutationFn: async () => {
      const syncable = integrations?.filter(i => i.status === 'connected' || i.status === 'error') || [];
      await Promise.all(syncable.map(i => 
        fetch(`/api/integrations/${i.id}/sync`, { method: 'POST' })
      ));
      return { success: true };
    },
    onSuccess: () => {
      toast({ title: "Sync All Started", description: "All integrations are being synced." });
      queryClient.invalidateQueries({ queryKey: ['/api/integrations/sync-status'] });
      queryClient.invalidateQueries({ queryKey: ['/api/integrations/sync-history'] });
    },
  });

  const connectedCount = integrations?.filter(i => i.status === 'connected' || i.status === 'syncing').length || 0;
  const errorCount = integrations?.filter(i => i.status === 'error').length || 0;
  const totalRecords = integrations?.reduce((sum, i) => sum + i.recordsImported + i.recordsExported, 0) || 0;
  const avgHealth = integrations?.length 
    ? Math.round(integrations.reduce((sum, i) => sum + i.healthScore, 0) / integrations.length)
    : 0;

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (integrations && integrations.length === 0) {
    return (
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Activity className="h-6 w-6 text-primary" />
            Integration Sync Monitor
          </h1>
          <p className="text-muted-foreground">
            Monitor and manage data synchronization across all connected systems
          </p>
        </div>
        <Card className="max-w-lg mx-auto mt-16">
          <CardContent className="pt-12 pb-12 text-center">
            <Wifi className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No integrations connected yet</h3>
            <p className="text-muted-foreground mb-6">
              Visit the Integrations Marketplace to connect QuickBooks, Dockwa, DockMaster, and other data sources.
            </p>
            <Link href="/integrations">
              <Button>Browse Integrations</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Activity className="h-6 w-6 text-primary" />
            Integration Sync Monitor
          </h1>
          <p className="text-muted-foreground">
            Monitor and manage data synchronization across all connected systems
          </p>
        </div>
        <Button 
          onClick={() => syncAllMutation.mutate()}
          disabled={syncAllMutation.isPending}
        >
          {syncAllMutation.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" />
          )}
          Sync All
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Connected</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Wifi className="h-5 w-5 text-green-600" />
              <span className="text-2xl font-bold">{connectedCount}</span>
              <span className="text-muted-foreground">/ {integrations?.length || 0}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Errors</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <AlertTriangle className={`h-5 w-5 ${errorCount > 0 ? 'text-red-600' : 'text-green-600'}`} />
              <span className="text-2xl font-bold">{errorCount}</span>
              <span className="text-muted-foreground">integrations</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Records Synced</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Database className="h-5 w-5 text-blue-600" />
              <span className="text-2xl font-bold">{totalRecords.toLocaleString()}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Health Score</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-2xl font-bold">{avgHealth}%</span>
              </div>
              <Progress value={avgHealth} className="h-2" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="history">Sync History</TabsTrigger>
          <TabsTrigger value="errors">Errors</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Connected Integrations</CardTitle>
              <CardDescription>Real-time status of all marina management system connections</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto w-full">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Integration</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last Sync</TableHead>
                    <TableHead>Next Sync</TableHead>
                    <TableHead className="text-center">Imported</TableHead>
                    <TableHead className="text-center">Exported</TableHead>
                    <TableHead className="text-center">Health</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {integrations?.map((integration) => (
                    <TableRow key={integration.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          {getTypeIcon(integration.type)}
                          <div>
                            <div className="font-medium">{integration.name}</div>
                            <div className="text-xs text-muted-foreground">{integration.provider}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getStatusIcon(integration.status)}
                          {getStatusBadge(integration.status)}
                        </div>
                      </TableCell>
                      <TableCell>
                        {integration.lastSync ? (
                          <span className="text-sm">
                            {formatDistanceToNow(integration.lastSync, { addSuffix: true })}
                          </span>
                        ) : (
                          <span className="text-sm text-muted-foreground">Never</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {integration.nextSync ? (
                          <span className="text-sm">
                            {formatDistanceToNow(integration.nextSync, { addSuffix: true })}
                          </span>
                        ) : (
                          <span className="text-sm text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <ArrowDownToLine className="h-3 w-3 text-green-600" />
                          <span>{integration.recordsImported.toLocaleString()}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <ArrowUpFromLine className="h-3 w-3 text-blue-600" />
                          <span>{integration.recordsExported.toLocaleString()}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-2">
                          <Progress value={integration.healthScore} className="h-2 w-16" />
                          <span className="text-xs">{integration.healthScore}%</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => syncMutation.mutate(integration.id)}
                          disabled={integration.status === 'syncing' || integration.status === 'pending' || syncMutation.isPending}
                        >
                          {integration.status === 'syncing' ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <RefreshCw className="h-4 w-4" />
                          )}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Sync History</CardTitle>
              <CardDescription>Recent synchronization activity across all integrations</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto w-full">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Integration</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead className="text-center">Records</TableHead>
                    <TableHead>Message</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history?.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.integrationName}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {item.type.replace('_', ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell>{getSyncStatusBadge(item.status)}</TableCell>
                      <TableCell>
                        <span className="text-sm">
                          {formatDistanceToNow(item.startTime, { addSuffix: true })}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">{item.recordsProcessed}</TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">{item.message}</span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="errors" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Integration Errors</CardTitle>
              <CardDescription>Issues requiring attention</CardDescription>
            </CardHeader>
            <CardContent>
              {errorCount === 0 ? (
                <div className="text-center py-12">
                  <CheckCircle2 className="h-12 w-12 mx-auto text-green-600 mb-4" />
                  <h3 className="text-lg font-semibold">All Systems Operational</h3>
                  <p className="text-muted-foreground">No integration errors to display</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {integrations?.filter(i => i.status === 'error').map((integration) => (
                    <Card key={integration.id} className="border-red-200 bg-red-50">
                      <CardContent className="pt-4">
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-3">
                            <XCircle className="h-5 w-5 text-red-600 mt-0.5" />
                            <div>
                              <h4 className="font-semibold">{integration.name}</h4>
                              <p className="text-sm text-muted-foreground">{integration.provider}</p>
                              <p className="text-sm text-red-700 mt-2">
                                {integration.errorCount} error(s) detected. Last sync failed {integration.lastSync ? formatDistanceToNow(integration.lastSync, { addSuffix: true }) : 'never'}.
                              </p>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button variant="outline" size="sm">
                              <Settings className="h-4 w-4 mr-2" />
                              Configure
                            </Button>
                            <Button size="sm" onClick={() => syncMutation.mutate(integration.id)}>
                              <RefreshCw className="h-4 w-4 mr-2" />
                              Retry
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
