import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Cloud, Database, FileSpreadsheet, Plug, CheckCircle2, XCircle, RefreshCw, Trash2, Settings as SettingsIcon, Eye, EyeOff } from "lucide-react";
import { format } from "date-fns";
import { ContextIntegrationsPanel } from "@/components/integrations/ContextIntegrationsPanel";

type FuelIntegration = {
  id: string;
  orgId: string;
  provider: string;
  isEnabled: boolean;
  apiUrl: string | null;
  accessToken: string | null;
  refreshToken: string | null;
  lastSyncAt: string | null;
  syncFrequency: number;
  autoSyncEnabled: boolean;
  fieldMapping: Record<string, any>;
  settings: Record<string, any>;
  createdAt: string;
  updatedAt: string;
};

type FuelImportLog = {
  id: string;
  source: string;
  status: string;
  recordsImported: number;
  recordsFailed: number;
  startedAt: string;
  completedAt: string | null;
};

const PROVIDERS = [
  {
    id: "fuelcloud",
    name: "FuelCloud",
    description: "Connect to FuelCloud API for real-time fuel sales sync",
    icon: Cloud,
    requiresApiConfig: true,
  },
  {
    id: "marinago",
    name: "MARINAGO Office",
    description: "Import fuel sales from MARINAGO Office system",
    icon: Database,
    requiresApiConfig: true,
  },
  {
    id: "marinaoffice",
    name: "MarinaOffice",
    description: "Sync fuel transactions from MarinaOffice",
    icon: Database,
    requiresApiConfig: true,
  },
  {
    id: "dockwa",
    name: "Dockwa",
    description: "Import fuel sales from Dockwa reservations",
    icon: Plug,
    requiresApiConfig: true,
  },
  {
    id: "manual_csv",
    name: "Manual CSV",
    description: "Manually upload CSV files with fuel transactions",
    icon: FileSpreadsheet,
    requiresApiConfig: false,
  },
];

const DEFAULT_FIELD_MAPPING = {
  date: "transaction_date",
  boatName: "boat_name",
  slipNumber: "slip_number",
  fuelType: "fuel_type",
  gallons: "gallons",
  pricePerGallon: "price_per_gallon",
  totalAmount: "total_amount",
  paymentMethod: "payment_method",
};

export default function IntegrationSettings() {
  const { toast } = useToast();
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [showDisconnectDialog, setShowDisconnectDialog] = useState(false);
  const [showAccessToken, setShowAccessToken] = useState(false);
  const [showRefreshToken, setShowRefreshToken] = useState(false);
  const [formData, setFormData] = useState({
    provider: "",
    apiUrl: "",
    accessToken: "",
    refreshToken: "",
    autoSyncEnabled: false,
    syncFrequency: 15,
    isEnabled: true,
    fieldMapping: DEFAULT_FIELD_MAPPING,
  });

  const { data: integration, isLoading: loadingIntegration } = useQuery<FuelIntegration | null>({
    queryKey: ["/api/operations/fuel-integrations"],
  });

  const { data: importLogs = [], isLoading: loadingLogs } = useQuery<FuelImportLog[]>({
    queryKey: ["/api/operations/fuel-integrations/import-logs"],
  });

  const createIntegrationMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("/api/operations/fuel-integrations", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/operations/fuel-integrations"] });
      toast({
        title: "Success",
        description: "Integration connected successfully",
      });
      setSelectedProvider(null);
      resetForm();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to connect integration",
        variant: "destructive",
      });
    },
  });

  const updateIntegrationMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      return apiRequest(`/api/operations/fuel-integrations/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/operations/fuel-integrations"] });
      toast({
        title: "Success",
        description: "Integration settings updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update integration",
        variant: "destructive",
      });
    },
  });

  const deleteIntegrationMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(`/api/operations/fuel-integrations/${id}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/operations/fuel-integrations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/operations/fuel-integrations/import-logs"] });
      toast({
        title: "Success",
        description: "Integration disconnected successfully",
      });
      setShowDisconnectDialog(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to disconnect integration",
        variant: "destructive",
      });
    },
  });

  const testConnectionMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(`/api/operations/fuel-integrations/${id}/test`, {
        method: "POST",
      });
    },
    onSuccess: (data: any) => {
      toast({
        title: "Connection Test",
        description: data.message || "Connection successful",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Connection Failed",
        description: error.message || "Failed to connect",
        variant: "destructive",
      });
    },
  });

  const syncNowMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(`/api/operations/fuel-integrations/${id}/sync`, {
        method: "POST",
      });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/operations/fuel-integrations/import-logs"] });
      toast({
        title: "Sync Initiated",
        description: data.message || "Sync started successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Sync Failed",
        description: error.message || "Failed to start sync",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setFormData({
      provider: "",
      apiUrl: "",
      accessToken: "",
      refreshToken: "",
      autoSyncEnabled: false,
      syncFrequency: 15,
      isEnabled: true,
      fieldMapping: DEFAULT_FIELD_MAPPING,
    });
  };

  const handleProviderSelect = (providerId: string) => {
    setSelectedProvider(providerId);
    setFormData({
      ...formData,
      provider: providerId,
    });
  };

  const handleConnect = () => {
    const provider = PROVIDERS.find((p) => p.id === selectedProvider);
    if (!provider) return;

    if (provider.requiresApiConfig && (!formData.apiUrl || !formData.accessToken)) {
      toast({
        title: "Missing Configuration",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    createIntegrationMutation.mutate(formData);
  };

  const handleUpdateSettings = () => {
    if (!integration) return;
    updateIntegrationMutation.mutate({
      id: integration.id,
      data: formData,
    });
  };

  const handleDisconnect = () => {
    if (!integration) return;
    deleteIntegrationMutation.mutate(integration.id);
  };

  const handleTestConnection = () => {
    if (!integration) return;
    testConnectionMutation.mutate(integration.id);
  };

  const handleSyncNow = () => {
    if (!integration) return;
    syncNowMutation.mutate(integration.id);
  };

  const handleResetFieldMapping = () => {
    setFormData({
      ...formData,
      fieldMapping: DEFAULT_FIELD_MAPPING,
    });
  };

  if (loadingIntegration) {
    return (
      <div className="p-8">
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="w-8 h-8 animate-spin text-gray-400" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900" data-testid="text-page-title">Integration Settings</h1>
        <p className="text-gray-600 mt-2">
          Connect external systems to automatically sync fuel sales data
        </p>
      </div>

      <ContextIntegrationsPanel contextKey="fuelSales" />

      {integration ? (
        <>
          {/* Active Integration Card */}
          <Card data-testid="card-active-integration">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    {PROVIDERS.find((p) => p.id === integration.provider)?.name || integration.provider}
                    <Badge variant={integration.isEnabled ? "default" : "secondary"} data-testid="badge-integration-status">
                      {integration.isEnabled ? "Enabled" : "Disabled"}
                    </Badge>
                  </CardTitle>
                  <CardDescription>
                    {integration.lastSyncAt
                      ? `Last synced: ${format(new Date(integration.lastSyncAt), "MMM d, yyyy 'at' h:mm a")}`
                      : "Never synced"}
                  </CardDescription>
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setShowDisconnectDialog(true)}
                  data-testid="button-disconnect"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Disconnect
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {PROVIDERS.find((p) => p.id === integration.provider)?.requiresApiConfig && (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="apiUrl">API URL</Label>
                      <Input
                        id="apiUrl"
                        value={formData.apiUrl || integration.apiUrl || ""}
                        onChange={(e) => setFormData({ ...formData, apiUrl: e.target.value })}
                        placeholder="https://api.fuelcloud.com"
                        data-testid="input-api-url"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="accessToken">Access Token</Label>
                      <div className="relative">
                        <Input
                          id="accessToken"
                          type={showAccessToken ? "text" : "password"}
                          value={formData.accessToken || integration.accessToken || ""}
                          onChange={(e) => setFormData({ ...formData, accessToken: e.target.value })}
                          placeholder="Enter access token"
                          data-testid="input-access-token"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-0 top-0 h-full px-3"
                          onClick={() => setShowAccessToken(!showAccessToken)}
                          data-testid="button-toggle-access-token"
                        >
                          {showAccessToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="refreshToken">Refresh Token</Label>
                      <div className="relative">
                        <Input
                          id="refreshToken"
                          type={showRefreshToken ? "text" : "password"}
                          value={formData.refreshToken || integration.refreshToken || ""}
                          onChange={(e) => setFormData({ ...formData, refreshToken: e.target.value })}
                          placeholder="Enter refresh token"
                          data-testid="input-refresh-token"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-0 top-0 h-full px-3"
                          onClick={() => setShowRefreshToken(!showRefreshToken)}
                          data-testid="button-toggle-refresh-token"
                        >
                          {showRefreshToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Button
                        variant="outline"
                        onClick={handleTestConnection}
                        disabled={testConnectionMutation.isPending}
                        className="w-full"
                        data-testid="button-test-connection"
                      >
                        {testConnectionMutation.isPending ? (
                          <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <CheckCircle2 className="w-4 h-4 mr-2" />
                        )}
                        Test Connection
                      </Button>
                    </div>
                  </div>

                  <div className="border-t pt-6">
                    <h3 className="text-lg font-semibold mb-4">Sync Settings</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label htmlFor="autoSync">Auto-Sync</Label>
                          <p className="text-sm text-gray-500">Automatically sync data at set intervals</p>
                        </div>
                        <Switch
                          id="autoSync"
                          checked={formData.autoSyncEnabled ?? integration.autoSyncEnabled}
                          onCheckedChange={(checked) =>
                            setFormData({ ...formData, autoSyncEnabled: checked })
                          }
                          data-testid="switch-auto-sync"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="syncFrequency">Sync Frequency</Label>
                        <Select
                          value={String(formData.syncFrequency || integration.syncFrequency)}
                          onValueChange={(value) =>
                            setFormData({ ...formData, syncFrequency: parseInt(value) })
                          }
                        >
                          <SelectTrigger id="syncFrequency" data-testid="select-sync-frequency">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="15">Every 15 minutes</SelectItem>
                            <SelectItem value="30">Every 30 minutes</SelectItem>
                            <SelectItem value="60">Every hour</SelectItem>
                            <SelectItem value="120">Every 2 hours</SelectItem>
                            <SelectItem value="240">Every 4 hours</SelectItem>
                            <SelectItem value="0">Manual only</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="mt-4 flex gap-2">
                      <Button onClick={handleUpdateSettings} disabled={updateIntegrationMutation.isPending} data-testid="button-save-settings">
                        {updateIntegrationMutation.isPending ? "Saving..." : "Save Settings"}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={handleSyncNow}
                        disabled={syncNowMutation.isPending}
                        data-testid="button-sync-now"
                      >
                        {syncNowMutation.isPending ? (
                          <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <RefreshCw className="w-4 h-4 mr-2" />
                        )}
                        Sync Now
                      </Button>
                    </div>
                  </div>
                </>
              )}

              {/* Field Mapping Section */}
              <div className="border-t pt-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">Field Mapping</h3>
                  <Button variant="outline" size="sm" onClick={handleResetFieldMapping} data-testid="button-reset-mapping">
                    Reset to Defaults
                  </Button>
                </div>
                <div className="border rounded-lg overflow-x-auto w-full">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Internal Field</TableHead>
                        <TableHead>External Field</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {Object.entries(formData.fieldMapping || integration.fieldMapping || DEFAULT_FIELD_MAPPING).map(
                        ([key, value]) => (
                          <TableRow key={key}>
                            <TableCell className="font-medium">{key}</TableCell>
                            <TableCell>
                              <Input
                                value={value as string}
                                onChange={(e) =>
                                  setFormData({
                                    ...formData,
                                    fieldMapping: { ...formData.fieldMapping, [key]: e.target.value },
                                  })
                                }
                                data-testid={`input-field-mapping-${key}`}
                              />
                            </TableCell>
                          </TableRow>
                        )
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Import History Preview */}
          <Card data-testid="card-import-history">
            <CardHeader>
              <CardTitle>Import History</CardTitle>
              <CardDescription>Recent sync and import operations</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingLogs ? (
                <div className="flex items-center justify-center h-32">
                  <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
                </div>
              ) : importLogs.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No import history yet. Sync data to see import logs.
                </div>
              ) : (
                <div className="border rounded-lg overflow-x-auto w-full">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Timestamp</TableHead>
                        <TableHead>Source</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Records Imported</TableHead>
                        <TableHead className="text-right">Errors</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {importLogs.map((log) => (
                        <TableRow key={log.id}>
                          <TableCell>
                            {format(new Date(log.startedAt), "MM/dd/yyyy h:mm a")}
                          </TableCell>
                          <TableCell>{log.source}</TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                log.status === "completed"
                                  ? "default"
                                  : log.status === "failed"
                                  ? "destructive"
                                  : "secondary"
                              }
                              data-testid={`badge-import-status-${log.id}`}
                            >
                              {log.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">{log.recordsImported}</TableCell>
                          <TableCell className="text-right">{log.recordsFailed}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      ) : (
        <>
          {/* Provider Selection */}
          <Card data-testid="card-provider-selection">
            <CardHeader>
              <CardTitle>Select Provider</CardTitle>
              <CardDescription>Choose an integration provider to connect your fuel sales data</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {PROVIDERS.map((provider) => {
                  const Icon = provider.icon;
                  const isSelected = selectedProvider === provider.id;
                  return (
                    <Card
                      key={provider.id}
                      className={`cursor-pointer transition-all hover:shadow-md ${
                        isSelected ? "ring-2 ring-blue-500" : ""
                      }`}
                      onClick={() => handleProviderSelect(provider.id)}
                      data-testid={`card-provider-${provider.id}`}
                    >
                      <CardHeader>
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                            <Icon className="w-6 h-6 text-blue-600" />
                          </div>
                          <div>
                            <CardTitle className="text-lg">{provider.name}</CardTitle>
                          </div>
                        </div>
                        <CardDescription className="mt-2">{provider.description}</CardDescription>
                      </CardHeader>
                    </Card>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Configuration Form */}
          {selectedProvider && (
            <Card data-testid="card-configuration-form">
              <CardHeader>
                <CardTitle>Configure {PROVIDERS.find((p) => p.id === selectedProvider)?.name}</CardTitle>
                <CardDescription>Enter the connection details to set up this integration</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {PROVIDERS.find((p) => p.id === selectedProvider)?.requiresApiConfig ? (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="new-apiUrl">API URL</Label>
                      <Input
                        id="new-apiUrl"
                        value={formData.apiUrl}
                        onChange={(e) => setFormData({ ...formData, apiUrl: e.target.value })}
                        placeholder="https://api.example.com"
                        data-testid="input-new-api-url"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="new-accessToken">Access Token *</Label>
                      <Input
                        id="new-accessToken"
                        type="password"
                        value={formData.accessToken}
                        onChange={(e) => setFormData({ ...formData, accessToken: e.target.value })}
                        placeholder="Enter your access token"
                        data-testid="input-new-access-token"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="new-refreshToken">Refresh Token</Label>
                      <Input
                        id="new-refreshToken"
                        type="password"
                        value={formData.refreshToken}
                        onChange={(e) => setFormData({ ...formData, refreshToken: e.target.value })}
                        placeholder="Enter your refresh token"
                        data-testid="input-new-refresh-token"
                      />
                    </div>
                  </>
                ) : (
                  <div className="text-center py-4 text-gray-600">
                    No API configuration required. You can upload CSV files directly from the Transactions page.
                  </div>
                )}

                <div className="flex gap-2 pt-4">
                  <Button
                    onClick={handleConnect}
                    disabled={createIntegrationMutation.isPending}
                    data-testid="button-connect"
                  >
                    {createIntegrationMutation.isPending ? "Connecting..." : "Connect"}
                  </Button>
                  <Button variant="outline" onClick={() => setSelectedProvider(null)} data-testid="button-cancel">
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Disconnect Confirmation Dialog */}
      <AlertDialog open={showDisconnectDialog} onOpenChange={setShowDisconnectDialog}>
        <AlertDialogContent data-testid="dialog-disconnect-confirmation">
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect Integration</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to disconnect this integration? This will stop automatic syncing of fuel sales data.
              You can reconnect at any time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-disconnect">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDisconnect}
              className="bg-red-600 hover:bg-red-700"
              data-testid="button-confirm-disconnect"
            >
              Disconnect
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
