import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { 
  Loader2, 
  RefreshCw, 
  Check, 
  X, 
  Link, 
  Unlink, 
  Clock, 
  Anchor,
  Ship,
  Fuel,
  Store,
  AlertTriangle,
  Settings,
  History,
  Activity
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface MarinaIntegration {
  key: string;
  name: string;
  description: string;
  logo?: string;
  supportedModules: string[];
  authType: string;
  requiredFields: string[];
  isConnected: boolean;
  lastSyncAt: string | null;
  errorMessage: string | null;
}

interface SyncHistoryEntry {
  id: string;
  syncType: string;
  status: string;
  completedAt: string;
  recordsProcessed: number;
  recordsCreated: number;
  recordsUpdated: number;
  recordsFailed: number;
  errorCount: number;
}

interface IntegrationStatus {
  integrationKey: string;
  name: string;
  isConnected: boolean;
  lastSyncAt: string | null;
  lastSyncStatus: string | null;
  lastSyncRecords: number;
  lastSyncErrors: number;
  supportedModules: string[];
}

const MODULE_ICONS: Record<string, any> = {
  rent_roll: Anchor,
  fuel_sales: Fuel,
  ship_store: Store,
};

const MODULE_LABELS: Record<string, string> = {
  rent_roll: 'Rent Roll',
  fuel_sales: 'Fuel Sales',
  ship_store: 'Ship Store',
};

export default function OperationsIntegrations() {
  const { toast } = useToast();
  const [connectDialogOpen, setConnectDialogOpen] = useState(false);
  const [selectedIntegration, setSelectedIntegration] = useState<MarinaIntegration | null>(null);
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [historyIntegration, setHistoryIntegration] = useState<string | null>(null);

  const { data: availableData, isLoading: loadingAvailable } = useQuery<{ integrations: MarinaIntegration[] }>({
    queryKey: ['/api/marina-integrations/available'],
  });

  const { data: statusData, isLoading: loadingStatus } = useQuery<{ totalConnected: number; integrations: IntegrationStatus[] }>({
    queryKey: ['/api/marina-integrations/status'],
  });

  const { data: historyData } = useQuery<{ history: SyncHistoryEntry[] }>({
    queryKey: ['/api/marina-integrations/sync-history', historyIntegration],
    enabled: !!historyIntegration,
  });

  const connectMutation = useMutation({
    mutationFn: (data: { integrationKey: string; credentials: Record<string, string> }) =>
      apiRequest('/api/marina-integrations/connect', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/marina-integrations/available'] });
      queryClient.invalidateQueries({ queryKey: ['/api/marina-integrations/status'] });
      toast({ title: 'Connected', description: 'Integration connected successfully.' });
      setConnectDialogOpen(false);
      setCredentials({});
    },
    onError: (err: any) => {
      toast({ title: 'Connection Failed', description: err.message || 'Failed to connect integration.', variant: 'destructive' });
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: (integrationKey: string) =>
      apiRequest(`/api/marina-integrations/disconnect/${integrationKey}`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/marina-integrations/available'] });
      queryClient.invalidateQueries({ queryKey: ['/api/marina-integrations/status'] });
      toast({ title: 'Disconnected', description: 'Integration disconnected.' });
    },
    onError: (err: any) => {
      toast({ title: 'Error', description: err.message || 'Failed to disconnect.', variant: 'destructive' });
    },
  });

  const syncMutation = useMutation({
    mutationFn: (integrationKey: string) =>
      apiRequest(`/api/marina-integrations/sync/${integrationKey}`, { method: 'POST' }),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/marina-integrations/status'] });
      toast({ 
        title: 'Sync Complete', 
        description: `Processed ${data.recordsProcessed} records (${data.recordsCreated} created, ${data.recordsUpdated} updated).` 
      });
    },
    onError: (err: any) => {
      toast({ title: 'Sync Failed', description: err.message || 'Failed to sync.', variant: 'destructive' });
    },
  });

  const integrations = availableData?.integrations || [];
  const connectedIntegrations = statusData?.integrations || [];

  const handleConnect = (integration: MarinaIntegration) => {
    setSelectedIntegration(integration);
    setCredentials({});
    setConnectDialogOpen(true);
  };

  const handleSubmitConnect = () => {
    if (!selectedIntegration) return;
    connectMutation.mutate({
      integrationKey: selectedIntegration.key,
      credentials,
    });
  };

  const openHistory = (integrationKey: string) => {
    setHistoryIntegration(integrationKey);
    setHistoryDialogOpen(true);
  };

  if (loadingAvailable || loadingStatus) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Marina Integrations</h1>
          <p className="text-muted-foreground">
            Connect your marina management system to sync data automatically.
          </p>
        </div>
        <Badge variant="outline" className="text-lg px-4 py-2">
          {statusData?.totalConnected || 0} Connected
        </Badge>
      </div>

      <Tabs defaultValue="available" className="space-y-4">
        <TabsList>
          <TabsTrigger value="connected" className="gap-2">
            <Activity className="h-4 w-4" />
            Connected ({connectedIntegrations.length})
          </TabsTrigger>
          <TabsTrigger value="available" className="gap-2">
            <Settings className="h-4 w-4" />
            Available ({integrations.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="connected" className="space-y-4">
          {connectedIntegrations.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center text-muted-foreground py-8">
                  <Anchor className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No integrations connected yet.</p>
                  <p className="text-sm">Switch to the Available tab to connect your first integration.</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {connectedIntegrations.map((integration) => (
                <Card key={integration.integrationKey}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2">
                        <Ship className="h-5 w-5 text-blue-500" />
                        {integration.name}
                      </CardTitle>
                      <Badge variant="secondary" className="bg-green-100 text-green-700">
                        <Check className="h-3 w-3 mr-1" />
                        Connected
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex flex-wrap gap-1">
                      {integration.supportedModules.map((mod) => {
                        const Icon = MODULE_ICONS[mod] || Anchor;
                        return (
                          <Badge key={mod} variant="outline" className="gap-1">
                            <Icon className="h-3 w-3" />
                            {MODULE_LABELS[mod] || mod}
                          </Badge>
                        );
                      })}
                    </div>
                    
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      {integration.lastSyncAt ? (
                        <span>Last synced {formatDistanceToNow(new Date(integration.lastSyncAt))} ago</span>
                      ) : (
                        <span>Never synced</span>
                      )}
                    </div>

                    {integration.lastSyncStatus && (
                      <div className="flex items-center gap-4 text-sm">
                        <span>{integration.lastSyncRecords} records</span>
                        {integration.lastSyncErrors > 0 && (
                          <span className="text-red-500">{integration.lastSyncErrors} errors</span>
                        )}
                      </div>
                    )}
                  </CardContent>
                  <CardFooter className="gap-2">
                    <Button 
                      size="sm" 
                      onClick={() => syncMutation.mutate(integration.integrationKey)}
                      disabled={syncMutation.isPending}
                    >
                      {syncMutation.isPending ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4 mr-2" />
                      )}
                      Sync Now
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => openHistory(integration.integrationKey)}
                    >
                      <History className="h-4 w-4 mr-2" />
                      History
                    </Button>
                    <Button 
                      size="sm" 
                      variant="ghost"
                      className="text-red-500 hover:text-red-600"
                      onClick={() => disconnectMutation.mutate(integration.integrationKey)}
                      disabled={disconnectMutation.isPending}
                    >
                      <Unlink className="h-4 w-4 mr-2" />
                      Disconnect
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="available" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {integrations.map((integration) => (
              <Card key={integration.key} className={integration.isConnected ? 'border-green-200 bg-green-50/50' : ''}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <Ship className="h-5 w-5 text-blue-500" />
                      {integration.name}
                    </CardTitle>
                    {integration.isConnected && (
                      <Badge variant="secondary" className="bg-green-100 text-green-700">
                        <Check className="h-3 w-3 mr-1" />
                        Connected
                      </Badge>
                    )}
                  </div>
                  <CardDescription>{integration.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-1 mb-4">
                    {integration.supportedModules.map((mod) => {
                      const Icon = MODULE_ICONS[mod] || Anchor;
                      return (
                        <Badge key={mod} variant="outline" className="gap-1">
                          <Icon className="h-3 w-3" />
                          {MODULE_LABELS[mod] || mod}
                        </Badge>
                      );
                    })}
                  </div>
                  
                  {integration.errorMessage && (
                    <Alert variant="destructive" className="mt-2">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>{integration.errorMessage}</AlertDescription>
                    </Alert>
                  )}
                </CardContent>
                <CardFooter>
                  {integration.isConnected ? (
                    <Button 
                      variant="outline" 
                      className="w-full"
                      onClick={() => disconnectMutation.mutate(integration.key)}
                      disabled={disconnectMutation.isPending}
                    >
                      <Unlink className="h-4 w-4 mr-2" />
                      Disconnect
                    </Button>
                  ) : (
                    <Button 
                      className="w-full"
                      onClick={() => handleConnect(integration)}
                    >
                      <Link className="h-4 w-4 mr-2" />
                      Connect
                    </Button>
                  )}
                </CardFooter>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={connectDialogOpen} onOpenChange={setConnectDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Ship className="h-5 w-5" />
              Connect {selectedIntegration?.name}
            </DialogTitle>
            <DialogDescription>
              Enter your {selectedIntegration?.name} credentials to connect your account.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {selectedIntegration?.requiredFields.map((field) => (
              <div key={field} className="space-y-2">
                <Label htmlFor={field} className="capitalize">{field.replace(/([A-Z])/g, ' $1').trim()}</Label>
                <Input
                  id={field}
                  type={field.toLowerCase().includes('key') || field.toLowerCase().includes('secret') || field.toLowerCase().includes('password') ? 'password' : 'text'}
                  value={credentials[field] || ''}
                  onChange={(e) => setCredentials({ ...credentials, [field]: e.target.value })}
                  placeholder={`Enter your ${field.replace(/([A-Z])/g, ' $1').toLowerCase()}`}
                />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConnectDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSubmitConnect}
              disabled={connectMutation.isPending || !selectedIntegration?.requiredFields.every(f => credentials[f])}
            >
              {connectMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Link className="h-4 w-4 mr-2" />
              )}
              Connect
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={historyDialogOpen} onOpenChange={setHistoryDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Sync History
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            {historyData?.history && historyData.history.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Processed</TableHead>
                    <TableHead className="text-right">Created</TableHead>
                    <TableHead className="text-right">Updated</TableHead>
                    <TableHead className="text-right">Errors</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {historyData.history.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="text-sm">
                        {entry.completedAt ? formatDistanceToNow(new Date(entry.completedAt)) + ' ago' : '-'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={entry.status === 'completed' ? 'secondary' : 'destructive'}>
                          {entry.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">{entry.recordsProcessed}</TableCell>
                      <TableCell className="text-right text-green-600">{entry.recordsCreated}</TableCell>
                      <TableCell className="text-right text-blue-600">{entry.recordsUpdated}</TableCell>
                      <TableCell className="text-right text-red-600">{entry.errorCount || 0}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No sync history found.
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
