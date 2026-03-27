import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format, formatDistanceToNow } from "date-fns";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Link2,
  Webhook,
  Key,
  AlertCircle,
  CheckCircle,
  Clock,
  ArrowDownUp,
  RefreshCw,
  Copy,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  Activity,
} from "lucide-react";

interface IntegrationMapping {
  id: string;
  entityType: string;
  marinaMatchId: string;
  externalId: string;
  externalSystem: string;
  syncStatus: string;
  lastSyncedAt: string | null;
  lastExternalUpdate: string | null;
  createdAt: string;
}

interface WebhookLog {
  id: string;
  direction: string;
  eventType: string;
  externalSystem: string;
  statusCode: number | null;
  errorMessage: string | null;
  retryCount: number;
  createdAt: string;
  requestPayload?: any;
  responsePayload?: any;
}

interface IntegrationApiKey {
  id: string;
  name: string;
  externalSystem: string;
  keyPrefix: string;
  scopes: string[];
  isActive: boolean;
  lastUsedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

interface IntegrationStats {
  totalMappings: number;
  syncedCount: number;
  pendingCount: number;
  errorCount: number;
  webhooksLast24h: number;
  inboundCount: number;
  outboundCount: number;
  errorWebhooks: number;
}

const apiKeyFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  externalSystem: z.string().min(1, "External system is required"),
  scopes: z.array(z.string()).min(1, "At least one scope is required"),
});

type ApiKeyFormData = z.infer<typeof apiKeyFormSchema>;

export default function IntegrationsPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("overview");
  const [showApiKeyDialog, setShowApiKeyDialog] = useState(false);
  const [newApiKey, setNewApiKey] = useState<string | null>(null);
  const [showNewKey, setShowNewKey] = useState(false);

  const { data: stats, isLoading: statsLoading } = useQuery<IntegrationStats>({
    queryKey: ["/api/integrations/stats"],
  });

  const { data: mappings, isLoading: mappingsLoading } = useQuery<IntegrationMapping[]>({
    queryKey: ["/api/integrations/mappings-dashboard"],
  });

  const { data: webhookLogs, isLoading: webhooksLoading } = useQuery<WebhookLog[]>({
    queryKey: ["/api/integrations/webhooks/logs"],
  });

  const { data: apiKeys, isLoading: apiKeysLoading } = useQuery<IntegrationApiKey[]>({
    queryKey: ["/api/integrations/api-keys"],
  });

  const form = useForm<ApiKeyFormData>({
    resolver: zodResolver(apiKeyFormSchema),
    defaultValues: {
      name: "",
      externalSystem: "crm",
      scopes: ["projects.read", "projects.write", "tenants.read", "tenants.write"],
    },
  });

  const createApiKeyMutation = useMutation({
    mutationFn: async (data: ApiKeyFormData) => {
      const response = await apiRequest("POST", "/api/integrations/api-keys", data);
      return response.json();
    },
    onSuccess: (data: any) => {
      setNewApiKey(data.apiKey);
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/api-keys"] });
      form.reset();
      toast({
        title: "API Key Created",
        description: "Copy the key now - it won't be shown again.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create API key",
        variant: "destructive",
      });
    },
  });

  const revokeApiKeyMutation = useMutation({
    mutationFn: async (keyId: string) => {
      await apiRequest("DELETE", `/api/integrations/api-keys/${keyId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/api-keys"] });
      toast({
        title: "API Key Revoked",
        description: "The API key has been revoked successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to revoke API key",
        variant: "destructive",
      });
    },
  });

  const handleCopyApiKey = () => {
    if (newApiKey) {
      navigator.clipboard.writeText(newApiKey);
      toast({
        title: "Copied!",
        description: "API key copied to clipboard.",
      });
    }
  };

  const onSubmitApiKey = (data: ApiKeyFormData) => {
    createApiKeyMutation.mutate(data);
  };

  const getSyncStatusBadge = (status: string) => {
    switch (status) {
      case "synced":
        return <Badge variant="default"><CheckCircle className="w-3 h-3 mr-1" />Synced</Badge>;
      case "pending":
        return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
      case "error":
        return <Badge variant="destructive"><AlertCircle className="w-3 h-3 mr-1" />Error</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getWebhookStatusBadge = (statusCode: number | null, errorMessage: string | null) => {
    if (errorMessage) {
      return <Badge variant="destructive"><AlertCircle className="w-3 h-3 mr-1" />Error</Badge>;
    }
    if (statusCode && statusCode >= 200 && statusCode < 300) {
      return <Badge variant="default"><CheckCircle className="w-3 h-3 mr-1" />{statusCode}</Badge>;
    }
    if (statusCode) {
      return <Badge variant="destructive">{statusCode}</Badge>;
    }
    return <Badge variant="secondary">Pending</Badge>;
  };

  const getDirectionBadge = (direction: string) => {
    if (direction === "inbound") {
      return <Badge variant="outline"><ArrowDownUp className="w-3 h-3 mr-1" />Inbound</Badge>;
    }
    return <Badge variant="outline"><ArrowDownUp className="w-3 h-3 mr-1" />Outbound</Badge>;
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="text-page-title">Integrations</h1>
          <p className="text-sm text-muted-foreground">
            Manage CRM synchronization, API keys, and webhook monitoring
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            queryClient.invalidateQueries({ queryKey: ["/api/integrations"] });
          }}
          data-testid="button-refresh"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview" data-testid="tab-overview">
            <Activity className="w-4 h-4 mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="mappings" data-testid="tab-mappings">
            <Link2 className="w-4 h-4 mr-2" />
            Mappings
          </TabsTrigger>
          <TabsTrigger value="webhooks" data-testid="tab-webhooks">
            <Webhook className="w-4 h-4 mr-2" />
            Webhooks
          </TabsTrigger>
          <TabsTrigger value="api-keys" data-testid="tab-api-keys">
            <Key className="w-4 h-4 mr-2" />
            API Keys
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Mappings</CardTitle>
                <Link2 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold tabular-nums" data-testid="stat-total-mappings">
                  {statsLoading ? "..." : stats?.totalMappings ?? 0}
                </div>
                <p className="text-xs text-muted-foreground">
                  Entity links between systems
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Synced</CardTitle>
                <CheckCircle className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold tabular-nums" data-testid="stat-synced">
                  {statsLoading ? "..." : stats?.syncedCount ?? 0}
                </div>
                <p className="text-xs text-muted-foreground">
                  Successfully synchronized
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Pending</CardTitle>
                <Clock className="h-4 w-4 text-yellow-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold tabular-nums" data-testid="stat-pending">
                  {statsLoading ? "..." : stats?.pendingCount ?? 0}
                </div>
                <p className="text-xs text-muted-foreground">
                  Awaiting sync
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Errors</CardTitle>
                <AlertCircle className="h-4 w-4 text-destructive" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold tabular-nums" data-testid="stat-errors">
                  {statsLoading ? "..." : stats?.errorCount ?? 0}
                </div>
                <p className="text-xs text-muted-foreground">
                  Failed to sync
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Webhook Activity (24h)</CardTitle>
                <CardDescription>Recent webhook events</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Total Events</span>
                    <span className="font-semibold tabular-nums" data-testid="stat-webhooks-24h">
                      {statsLoading ? "..." : stats?.webhooksLast24h ?? 0}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Inbound</span>
                    <span className="font-semibold tabular-nums" data-testid="stat-inbound">
                      {statsLoading ? "..." : stats?.inboundCount ?? 0}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Outbound</span>
                    <span className="font-semibold tabular-nums" data-testid="stat-outbound">
                      {statsLoading ? "..." : stats?.outboundCount ?? 0}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-destructive">Errors</span>
                    <span className="font-semibold tabular-nums text-destructive" data-testid="stat-webhook-errors">
                      {statsLoading ? "..." : stats?.errorWebhooks ?? 0}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Quick Actions</CardTitle>
                <CardDescription>Common integration tasks</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => setActiveTab("api-keys")}
                  data-testid="button-manage-api-keys"
                >
                  <Key className="w-4 h-4 mr-2" />
                  Manage API Keys
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => setActiveTab("webhooks")}
                  data-testid="button-view-webhooks"
                >
                  <Webhook className="w-4 h-4 mr-2" />
                  View Webhook Logs
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => setActiveTab("mappings")}
                  data-testid="button-view-mappings"
                >
                  <Link2 className="w-4 h-4 mr-2" />
                  View Entity Mappings
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="mappings">
          <Card>
            <CardHeader>
              <CardTitle>Entity Mappings</CardTitle>
              <CardDescription>
                Links between MarinaMatch entities and external CRM records
              </CardDescription>
            </CardHeader>
            <CardContent>
              {mappingsLoading ? (
                <div className="text-center py-8 text-muted-foreground">Loading mappings...</div>
              ) : !mappings || mappings.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No entity mappings found. Mappings are created when data is synchronized from the CRM.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Entity Type</TableHead>
                      <TableHead>MarinaMatch ID</TableHead>
                      <TableHead>External ID</TableHead>
                      <TableHead>System</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Last Synced</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mappings.map((mapping) => (
                      <TableRow key={mapping.id} data-testid={`row-mapping-${mapping.id}`}>
                        <TableCell className="font-medium capitalize">{mapping.entityType}</TableCell>
                        <TableCell className="font-mono text-xs">{mapping.marinaMatchId.slice(0, 8)}...</TableCell>
                        <TableCell className="font-mono text-xs">{mapping.externalId.slice(0, 8)}...</TableCell>
                        <TableCell className="uppercase">{mapping.externalSystem}</TableCell>
                        <TableCell>{getSyncStatusBadge(mapping.syncStatus)}</TableCell>
                        <TableCell>
                          {mapping.lastSyncedAt
                            ? formatDistanceToNow(new Date(mapping.lastSyncedAt), { addSuffix: true })
                            : "Never"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="webhooks">
          <Card>
            <CardHeader>
              <CardTitle>Webhook Logs</CardTitle>
              <CardDescription>
                Recent webhook events for debugging and monitoring
              </CardDescription>
            </CardHeader>
            <CardContent>
              {webhooksLoading ? (
                <div className="text-center py-8 text-muted-foreground">Loading webhook logs...</div>
              ) : !webhookLogs || webhookLogs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No webhook logs found. Logs are created when integration events occur.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Direction</TableHead>
                      <TableHead>Event Type</TableHead>
                      <TableHead>System</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Retries</TableHead>
                      <TableHead>Time</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {webhookLogs.map((log) => (
                      <TableRow key={log.id} data-testid={`row-webhook-${log.id}`}>
                        <TableCell>{getDirectionBadge(log.direction)}</TableCell>
                        <TableCell className="font-mono text-xs">{log.eventType}</TableCell>
                        <TableCell className="uppercase">{log.externalSystem}</TableCell>
                        <TableCell>{getWebhookStatusBadge(log.statusCode, log.errorMessage)}</TableCell>
                        <TableCell className="tabular-nums">{log.retryCount}</TableCell>
                        <TableCell>
                          {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true })}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="api-keys">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <div>
                <CardTitle>API Keys</CardTitle>
                <CardDescription>
                  Manage API keys for external system integrations
                </CardDescription>
              </div>
              <Dialog open={showApiKeyDialog} onOpenChange={setShowApiKeyDialog}>
                <DialogTrigger asChild>
                  <Button data-testid="button-create-api-key">
                    <Plus className="w-4 h-4 mr-2" />
                    Create API Key
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  {newApiKey ? (
                    <>
                      <DialogHeader>
                        <DialogTitle>API Key Created</DialogTitle>
                        <DialogDescription>
                          Copy this key now. It will only be shown once.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div className="flex items-center gap-2">
                          <Input
                            type={showNewKey ? "text" : "password"}
                            value={newApiKey}
                            readOnly
                            className="font-mono text-sm"
                            data-testid="input-new-api-key"
                          />
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => setShowNewKey(!showNewKey)}
                          >
                            {showNewKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={handleCopyApiKey}
                            data-testid="button-copy-api-key"
                          >
                            <Copy className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                      <DialogFooter>
                        <Button
                          onClick={() => {
                            setNewApiKey(null);
                            setShowNewKey(false);
                            setShowApiKeyDialog(false);
                          }}
                          data-testid="button-done"
                        >
                          Done
                        </Button>
                      </DialogFooter>
                    </>
                  ) : (
                    <>
                      <DialogHeader>
                        <DialogTitle>Create API Key</DialogTitle>
                        <DialogDescription>
                          Generate a new API key for external system integration.
                        </DialogDescription>
                      </DialogHeader>
                      <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmitApiKey)} className="space-y-4">
                          <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Name</FormLabel>
                                <FormControl>
                                  <Input
                                    placeholder="e.g., CRM Production"
                                    {...field}
                                    data-testid="input-api-key-name"
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="externalSystem"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>External System</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                  <FormControl>
                                    <SelectTrigger data-testid="select-external-system">
                                      <SelectValue placeholder="Select system" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="crm">CRM</SelectItem>
                                    <SelectItem value="erp">ERP</SelectItem>
                                    <SelectItem value="other">Other</SelectItem>
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <DialogFooter>
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => setShowApiKeyDialog(false)}
                            >
                              Cancel
                            </Button>
                            <Button
                              type="submit"
                              disabled={createApiKeyMutation.isPending}
                              data-testid="button-submit-api-key"
                            >
                              {createApiKeyMutation.isPending ? "Creating..." : "Create Key"}
                            </Button>
                          </DialogFooter>
                        </form>
                      </Form>
                    </>
                  )}
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {apiKeysLoading ? (
                <div className="text-center py-8 text-muted-foreground">Loading API keys...</div>
              ) : !apiKeys || apiKeys.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No API keys found. Create one to enable external integrations.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Key Prefix</TableHead>
                      <TableHead>System</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Last Used</TableHead>
                      <TableHead>Expires</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {apiKeys.map((key) => (
                      <TableRow key={key.id} data-testid={`row-api-key-${key.id}`}>
                        <TableCell className="font-medium">{key.name}</TableCell>
                        <TableCell className="font-mono text-xs">{key.keyPrefix}...</TableCell>
                        <TableCell className="uppercase">{key.externalSystem}</TableCell>
                        <TableCell>
                          {key.isActive ? (
                            <Badge variant="default"><CheckCircle className="w-3 h-3 mr-1" />Active</Badge>
                          ) : (
                            <Badge variant="secondary">Inactive</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {key.lastUsedAt
                            ? formatDistanceToNow(new Date(key.lastUsedAt), { addSuffix: true })
                            : "Never"}
                        </TableCell>
                        <TableCell>
                          {key.expiresAt
                            ? format(new Date(key.expiresAt), "MM/dd/yyyy")
                            : "Never"}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => revokeApiKeyMutation.mutate(key.id)}
                            disabled={revokeApiKeyMutation.isPending}
                            data-testid={`button-revoke-${key.id}`}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
