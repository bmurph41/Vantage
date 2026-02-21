/**
 * Admin Data Sources Configuration Page
 *
 * Full CRUD for managing platform-level data providers (Zillow, Redfin, MLS).
 * Features:
 * - Card grid with connection status indicators
 * - Click-to-configure modal with credential entry
 * - Test connection button
 * - Sync controls (manual trigger, history/logs)
 * - Health dashboard (quota usage, error rates)
 *
 * Add to: client/src/pages/admin/DataSourcesAdmin.tsx
 * Register in App.tsx: <Route path="/admin/data-sources" component={DataSourcesAdmin} />
 */

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import {
  Database,
  Plus,
  Settings,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  Wifi,
  WifiOff,
  Clock,
  BarChart3,
  History,
  Trash2,
  Zap,
} from "lucide-react";
import { format } from "date-fns";

interface DataSource {
  id: string;
  key: string;
  name: string;
  description: string;
  providerType: string;
  authType: string;
  status: string;
  statusMessage: string | null;
  enabled: boolean;
  syncFrequency: string;
  lastSyncAt: string | null;
  lastTestedAt: string | null;
  totalRecordsSynced: number;
  errorCount: number;
  hasCredentials: boolean;
  supportedAssetClasses: string[];
  capabilities: Record<string, boolean>;
  rateLimits: Record<string, any>;
}

interface AdapterRegistryEntry {
  key: string;
  name: string;
  description: string;
  providerType: string;
  authType: string;
  credentialFields: Array<{
    key: string;
    label: string;
    type: string;
    required: boolean;
    helpText?: string;
    placeholder?: string;
  }>;
  supportedAssetClasses: string[];
  capabilities: Record<string, boolean>;
  defaultRateLimits: { requestsPerSecond: number; requestsPerDay: number };
}

interface SyncLog {
  id: string;
  status: string;
  startedAt: string;
  completedAt: string | null;
  recordsFetched: number;
  recordsCreated: number;
  recordsUpdated: number;
  recordsFailed: number;
  errorMessage: string | null;
  triggeredBy: string;
  durationMs: number | null;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  connected: { label: "Connected", color: "text-green-600 bg-green-50", icon: CheckCircle2 },
  disconnected: { label: "Disconnected", color: "text-gray-500 bg-gray-50", icon: WifiOff },
  syncing: { label: "Syncing", color: "text-blue-600 bg-blue-50", icon: Loader2 },
  error: { label: "Error", color: "text-red-600 bg-red-50", icon: XCircle },
  rate_limited: { label: "Rate Limited", color: "text-yellow-600 bg-yellow-50", icon: AlertCircle },
  suspended: { label: "Suspended", color: "text-orange-600 bg-orange-50", icon: AlertCircle },
};

export default function DataSourcesAdmin() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [selectedAdapter, setSelectedAdapter] = useState<AdapterRegistryEntry | null>(null);
  const [selectedSource, setSelectedSource] = useState<DataSource | null>(null);
  const [credentialValues, setCredentialValues] = useState<Record<string, string>>({});
  const [syncFrequency, setSyncFrequency] = useState("daily");
  const [enabled, setEnabled] = useState(false);

  const [logsDialogOpen, setLogsDialogOpen] = useState(false);
  const [logsSourceId, setLogsSourceId] = useState<string | null>(null);

  const { data: sourcesData, isLoading: sourcesLoading } = useQuery<{ sources: DataSource[] }>({
    queryKey: ["/api/admin/data-sources"],
  });

  const { data: adaptersData } = useQuery<{ adapters: AdapterRegistryEntry[] }>({
    queryKey: ["/api/property-data/adapters"],
  });

  const { data: logsData, isLoading: logsLoading } = useQuery<{ logs: SyncLog[] }>({
    queryKey: ["/api/admin/data-sources", logsSourceId, "logs"],
    enabled: !!logsSourceId,
  });

  const saveMutation = useMutation({
    mutationFn: async (data: any) => apiRequest("POST", "/api/admin/data-sources", data),
    onSuccess: () => {
      toast({ title: "Data source saved" });
      qc.invalidateQueries({ queryKey: ["/api/admin/data-sources"] });
      setConfigDialogOpen(false);
    },
    onError: () => toast({ title: "Failed to save data source", variant: "destructive" }),
  });

  const testMutation = useMutation({
    mutationFn: async (id: string) => {
      const resp = await apiRequest("POST", `/api/admin/data-sources/${id}/test`);
      return resp.json();
    },
    onSuccess: (data: any) => {
      if (data.ok) {
        toast({ title: "Connection successful" });
      } else {
        toast({ title: "Connection failed", description: data.error, variant: "destructive" });
      }
      qc.invalidateQueries({ queryKey: ["/api/admin/data-sources"] });
    },
  });

  const syncMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("POST", `/api/admin/data-sources/${id}/sync`),
    onSuccess: () => {
      toast({ title: "Sync started" });
      qc.invalidateQueries({ queryKey: ["/api/admin/data-sources"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/admin/data-sources/${id}`),
    onSuccess: () => {
      toast({ title: "Data source removed" });
      qc.invalidateQueries({ queryKey: ["/api/admin/data-sources"] });
    },
  });

  const sources = sourcesData?.sources || [];
  const adapters = adaptersData?.adapters || [];
  const logs = logsData?.logs || [];

  const connectedKeys = new Set(sources.map((s) => s.key));
  const availableAdapters = adapters.filter((a) => !connectedKeys.has(a.key));

  const openConfigDialog = (adapter: AdapterRegistryEntry, existingSource?: DataSource) => {
    setSelectedAdapter(adapter);
    setSelectedSource(existingSource || null);
    setCredentialValues({});
    setSyncFrequency(existingSource?.syncFrequency || "daily");
    setEnabled(existingSource?.enabled || false);
    setConfigDialogOpen(true);
  };

  const handleSave = () => {
    if (!selectedAdapter) return;

    saveMutation.mutate({
      key: selectedAdapter.key,
      name: selectedAdapter.name,
      description: selectedAdapter.description,
      providerType: selectedAdapter.providerType,
      authType: selectedAdapter.authType,
      credentials: credentialValues,
      syncFrequency,
      supportedAssetClasses: selectedAdapter.supportedAssetClasses,
      enabled,
      rateLimits: selectedAdapter.defaultRateLimits,
      capabilities: selectedAdapter.capabilities,
    });
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Database className="h-6 w-6" />
            Data Sources
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage external property data providers. Connections are platform-level and shared across all users.
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Connected</p>
                <p className="text-2xl font-bold">{sources.filter((s) => s.status === "connected").length}</p>
              </div>
              <Wifi className="h-8 w-8 text-green-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Records</p>
                <p className="text-2xl font-bold">{sources.reduce((a, s) => a + (s.totalRecordsSynced || 0), 0).toLocaleString()}</p>
              </div>
              <BarChart3 className="h-8 w-8 text-blue-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Errors</p>
                <p className="text-2xl font-bold">{sources.reduce((a, s) => a + (s.errorCount || 0), 0)}</p>
              </div>
              <AlertCircle className="h-8 w-8 text-red-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Available</p>
                <p className="text-2xl font-bold">{availableAdapters.length}</p>
              </div>
              <Plus className="h-8 w-8 text-gray-400 opacity-50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Connected Sources */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Connected Sources</h2>
        {sourcesLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground py-8 justify-center">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading...
          </div>
        ) : sources.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              No data sources configured yet. Add one below to get started.
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sources.map((source) => {
              const statusInfo = STATUS_CONFIG[source.status] || STATUS_CONFIG.disconnected;
              const StatusIcon = statusInfo.icon;
              const adapter = adapters.find((a) => a.key === source.key);

              return (
                <Card key={source.id} className="relative">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-base">{source.name}</CardTitle>
                        <CardDescription className="text-xs mt-1">{source.description}</CardDescription>
                      </div>
                      <Badge className={`${statusInfo.color} text-xs`}>
                        <StatusIcon className={`h-3 w-3 mr-1 ${source.status === "syncing" ? "animate-spin" : ""}`} />
                        {statusInfo.label}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-muted-foreground">Records:</span>
                        <span className="ml-1 font-medium">{(source.totalRecordsSynced || 0).toLocaleString()}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Frequency:</span>
                        <span className="ml-1 font-medium capitalize">{source.syncFrequency}</span>
                      </div>
                      <div className="col-span-2">
                        <span className="text-muted-foreground">Last Sync:</span>
                        <span className="ml-1 font-medium">
                          {source.lastSyncAt ? format(new Date(source.lastSyncAt), "MMM d, h:mm a") : "Never"}
                        </span>
                      </div>
                    </div>

                    {source.statusMessage && (
                      <p className="text-xs text-red-600 bg-red-50 rounded p-2">{source.statusMessage}</p>
                    )}

                    <Separator />

                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 text-xs"
                        onClick={() => adapter && openConfigDialog(adapter, source)}
                      >
                        <Settings className="h-3 w-3 mr-1" />
                        Configure
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs"
                        onClick={() => testMutation.mutate(source.id)}
                        disabled={testMutation.isPending}
                      >
                        <Zap className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs"
                        onClick={() => syncMutation.mutate(source.id)}
                        disabled={syncMutation.isPending || source.status === "syncing"}
                      >
                        <RefreshCw className={`h-3 w-3 ${source.status === "syncing" ? "animate-spin" : ""}`} />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs"
                        onClick={() => {
                          setLogsSourceId(source.id);
                          setLogsDialogOpen(true);
                        }}
                      >
                        <History className="h-3 w-3" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Available Sources */}
      {availableAdapters.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3">Available Sources</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {availableAdapters.map((adapter) => (
              <Card key={adapter.key} className="border-dashed opacity-80 hover:opacity-100 transition-opacity">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{adapter.name}</CardTitle>
                  <CardDescription className="text-xs">{adapter.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-1 mb-3">
                    {Object.entries(adapter.capabilities)
                      .filter(([, v]) => v)
                      .map(([cap]) => (
                        <Badge key={cap} variant="secondary" className="text-[10px]">
                          {cap.replace(/([A-Z])/g, " $1").trim()}
                        </Badge>
                      ))}
                  </div>
                  <Button
                    size="sm"
                    className="w-full"
                    onClick={() => openConfigDialog(adapter)}
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Add Source
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Configuration Dialog */}
      <Dialog open={configDialogOpen} onOpenChange={setConfigDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {selectedSource ? "Configure" : "Add"} {selectedAdapter?.name}
            </DialogTitle>
            <DialogDescription>{selectedAdapter?.description}</DialogDescription>
          </DialogHeader>

          {selectedAdapter && (
            <div className="space-y-4 pt-2">
              {selectedAdapter.credentialFields.map((field) => (
                <div key={field.key} className="space-y-1">
                  <Label htmlFor={`cred-${field.key}`}>
                    {field.label}
                    {field.required && <span className="text-red-500 ml-1">*</span>}
                  </Label>
                  <Input
                    id={`cred-${field.key}`}
                    type={field.type === "secret" ? "password" : "text"}
                    placeholder={field.placeholder || ""}
                    value={credentialValues[field.key] || ""}
                    onChange={(e) =>
                      setCredentialValues((prev) => ({ ...prev, [field.key]: e.target.value }))
                    }
                  />
                  {field.helpText && (
                    <p className="text-xs text-muted-foreground">{field.helpText}</p>
                  )}
                </div>
              ))}

              <div className="space-y-1">
                <Label>Sync Frequency</Label>
                <Select value={syncFrequency} onValueChange={setSyncFrequency}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hourly">Hourly</SelectItem>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="manual">Manual Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="source-enabled">Enable this source</Label>
                <Switch
                  id="source-enabled"
                  checked={enabled}
                  onCheckedChange={setEnabled}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                {selectedSource && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => {
                      deleteMutation.mutate(selectedSource.id);
                      setConfigDialogOpen(false);
                    }}
                  >
                    <Trash2 className="h-3 w-3 mr-1" />
                    Remove
                  </Button>
                )}
                <div className="flex-1" />
                <Button variant="outline" onClick={() => setConfigDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSave} disabled={saveMutation.isPending}>
                  {saveMutation.isPending ? "Saving..." : "Save & Connect"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Sync Logs Dialog */}
      <Dialog open={logsDialogOpen} onOpenChange={setLogsDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Sync History</DialogTitle>
          </DialogHeader>

          {logsLoading ? (
            <div className="flex items-center gap-2 justify-center py-8">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading...
            </div>
          ) : logs.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No sync history yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Started</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Fetched</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Trigger</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-xs">
                      {format(new Date(log.startedAt), "MMM d, h:mm a")}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          log.status === "completed"
                            ? "default"
                            : log.status === "failed"
                              ? "destructive"
                              : "secondary"
                        }
                        className="text-[10px]"
                      >
                        {log.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">{log.recordsFetched}</TableCell>
                    <TableCell className="text-xs">{log.recordsCreated}</TableCell>
                    <TableCell className="text-xs">{log.recordsUpdated}</TableCell>
                    <TableCell className="text-xs">
                      {log.durationMs ? `${(log.durationMs / 1000).toFixed(1)}s` : "-"}
                    </TableCell>
                    <TableCell className="text-xs capitalize">{log.triggeredBy}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
