import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { 
  Plus, Settings, TestTube, CheckCircle, AlertTriangle, XCircle, 
  Clock, Trash2, ExternalLink, Wifi, WifiOff, Activity, RefreshCw 
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import type { ProjectIntegration } from "@shared/schema";

// Integration form validation schema
const integrationFormSchema = z.object({
  provider: z.string().min(1, "Provider name is required"),
  webhookUrl: z.string().url("Invalid webhook URL"),
  apiKey: z.string().min(1, "API key is required"),
  enabled: z.boolean().default(true),
  description: z.string().optional(),
  config: z.object({
    syncFrequency: z.enum(["realtime", "hourly", "daily"]).default("realtime"),
    retryAttempts: z.number().min(1).max(10).default(3),
    timeout: z.number().min(5).max(300).default(30),
  }).default({
    syncFrequency: "realtime",
    retryAttempts: 3,
    timeout: 30,
  }),
});

type IntegrationFormData = z.infer<typeof integrationFormSchema>;

interface ProjectIntegrationSettingsProps {
  projectId: string;
}

interface IntegrationWithStatus extends ProjectIntegration {
  status?: {
    connectionHealth: {
      status: string;
      message: string;
      lastTestAt?: string;
      daysSinceLastTest?: number;
    };
    syncStatus?: {
      lastSyncAt?: string;
      lastSyncStatus?: string;
      consecutiveFailures?: number;
    };
  };
}

export function ProjectIntegrationSettings({ projectId }: ProjectIntegrationSettingsProps) {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingIntegration, setEditingIntegration] = useState<ProjectIntegration | null>(null);
  const [testingIntegration, setTestingIntegration] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch integrations for this project
  const { data: integrations = [], isLoading, refetch } = useQuery({
    queryKey: ['/api/dd/projects', projectId, 'integrations'],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/dd/projects/${projectId}/integrations`);
      return response.json();
    },
  });

  // Create integration mutation
  const createIntegration = useMutation({
    mutationFn: async (data: IntegrationFormData) => {
      const response = await apiRequest('POST', `/api/dd/projects/${projectId}/integrations/docs/register`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/dd/projects', projectId, 'integrations'] });
      setIsAddDialogOpen(false);
      setEditingIntegration(null);
      toast({
        title: "Integration registered successfully",
        description: "Your document app integration has been configured.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Registration failed",
        description: error.message || "Failed to register integration",
        variant: "destructive",
      });
    },
  });

  // Update integration mutation
  const updateIntegration = useMutation({
    mutationFn: async ({ id, ...data }: { id: string } & Partial<IntegrationFormData>) => {
      const response = await apiRequest('PATCH', `/api/dd/projects/${projectId}/integrations/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/dd/projects', projectId, 'integrations'] });
      setEditingIntegration(null);
      toast({
        title: "Integration updated",
        description: "Integration settings have been saved.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Update failed",
        description: error.message || "Failed to update integration",
        variant: "destructive",
      });
    },
  });

  // Delete integration mutation
  const deleteIntegration = useMutation({
    mutationFn: async (integrationId: string) => {
      const response = await apiRequest('DELETE', `/api/dd/projects/${projectId}/integrations/${integrationId}`);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/dd/projects', projectId, 'integrations'] });
      toast({
        title: "Integration deleted",
        description: "The integration has been removed.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Delete failed",
        description: error.message || "Failed to delete integration",
        variant: "destructive",
      });
    },
  });

  // Test webhook mutation
  const testWebhook = useMutation({
    mutationFn: async (integrationId: string) => {
      const response = await apiRequest('POST', `/api/dd/integrations/${integrationId}/test-webhook`);
      return response.json();
    },
    onSuccess: (data, integrationId) => {
      setTestingIntegration(null);
      refetch(); // Refresh to get updated test status
      toast({
        title: data.success ? "Webhook test successful" : "Webhook test failed",
        description: data.message,
        variant: data.success ? "default" : "destructive",
      });
    },
    onError: (error: any, integrationId) => {
      setTestingIntegration(null);
      toast({
        title: "Test failed",
        description: error.message || "Failed to test webhook",
        variant: "destructive",
      });
    },
  });

  // Form for add/edit integration
  const form = useForm<IntegrationFormData>({
    resolver: zodResolver(integrationFormSchema),
    defaultValues: {
      provider: "",
      webhookUrl: "",
      apiKey: "",
      enabled: true,
      description: "",
      config: {
        syncFrequency: "realtime",
        retryAttempts: 3,
        timeout: 30,
      },
    },
  });

  // Reset form when editing
  useEffect(() => {
    if (editingIntegration) {
      const config = editingIntegration.config as any;
      form.reset({
        provider: editingIntegration.provider,
        webhookUrl: config.webhookUrl || "",
        apiKey: config.apiKey || "",
        enabled: config.enabled !== false,
        description: config.description || "",
        config: {
          syncFrequency: config.syncFrequency || "realtime",
          retryAttempts: config.retryAttempts || 3,
          timeout: config.timeout || 30,
        },
      });
    } else {
      form.reset();
    }
  }, [editingIntegration]);

  const onSubmit = (data: IntegrationFormData) => {
    if (editingIntegration) {
      updateIntegration.mutate({ id: editingIntegration.id, ...data });
    } else {
      createIntegration.mutate(data);
    }
  };

  const handleTestWebhook = (integrationId: string) => {
    setTestingIntegration(integrationId);
    testWebhook.mutate(integrationId);
  };

  const handleToggleIntegration = (integration: ProjectIntegration, enabled: boolean) => {
    updateIntegration.mutate({
      id: integration.id,
      config: {
        ...(integration.config as any),
        enabled,
      },
    });
  };

  // Helper to get health status badge
  const getHealthBadge = (status?: string) => {
    const variants = {
      healthy: "default" as const,
      warning: "secondary" as const,
      stale: "outline" as const,
      unhealthy: "destructive" as const,
      unknown: "outline" as const,
    };
    
    const icons = {
      healthy: CheckCircle,
      warning: AlertTriangle,
      stale: Clock,
      unhealthy: XCircle,
      unknown: Activity,
    };

    const variant = variants[status as keyof typeof variants] || "outline";
    const Icon = icons[status as keyof typeof icons] || Activity;

    return (
      <Badge variant={variant} className="flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {status || "unknown"}
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Document Integrations</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-muted rounded w-3/4"></div>
            <div className="h-4 bg-muted rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="project-integration-settings">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Document Integrations</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Connect external document management systems to sync data and receive real-time updates
            </p>
          </div>
          <Dialog open={isAddDialogOpen || !!editingIntegration} onOpenChange={(open) => {
            if (!open) {
              setIsAddDialogOpen(false);
              setEditingIntegration(null);
            }
          }}>
            <DialogTrigger asChild>
              <Button onClick={() => setIsAddDialogOpen(true)} data-testid="button-add-integration">
                <Plus className="h-4 w-4 mr-2" />
                Add Integration
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md" data-testid="dialog-integration-form">
              <DialogHeader>
                <DialogTitle>
                  {editingIntegration ? "Edit Integration" : "Add Document Integration"}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div>
                  <Label htmlFor="provider">Provider Name</Label>
                  <Input
                    id="provider"
                    placeholder="e.g., DocuSign, Dropbox, SharePoint"
                    {...form.register("provider")}
                    data-testid="input-provider"
                  />
                  {form.formState.errors.provider && (
                    <p className="text-sm text-destructive mt-1">{form.formState.errors.provider.message}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="webhookUrl">Webhook URL</Label>
                  <Input
                    id="webhookUrl"
                    type="url"
                    placeholder="https://api.example.com/webhooks/documents"
                    {...form.register("webhookUrl")}
                    data-testid="input-webhook-url"
                  />
                  {form.formState.errors.webhookUrl && (
                    <p className="text-sm text-destructive mt-1">{form.formState.errors.webhookUrl.message}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="apiKey">API Key</Label>
                  <Input
                    id="apiKey"
                    type="password"
                    placeholder="Enter your API key"
                    {...form.register("apiKey")}
                    data-testid="input-api-key"
                  />
                  {form.formState.errors.apiKey && (
                    <p className="text-sm text-destructive mt-1">{form.formState.errors.apiKey.message}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    placeholder="Brief description of this integration"
                    rows={2}
                    {...form.register("description")}
                    data-testid="textarea-description"
                  />
                </div>

                <div className="space-y-4">
                  <Label className="text-base font-medium">Configuration</Label>
                  
                  <div>
                    <Label htmlFor="syncFrequency">Sync Frequency</Label>
                    <Select
                      value={form.watch("config.syncFrequency")}
                      onValueChange={(value) => form.setValue("config.syncFrequency", value as any)}
                    >
                      <SelectTrigger data-testid="select-sync-frequency">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="realtime">Real-time</SelectItem>
                        <SelectItem value="hourly">Hourly</SelectItem>
                        <SelectItem value="daily">Daily</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="retryAttempts">Retry Attempts</Label>
                      <Input
                        id="retryAttempts"
                        type="number"
                        min="1"
                        max="10"
                        {...form.register("config.retryAttempts", { valueAsNumber: true })}
                        data-testid="input-retry-attempts"
                      />
                    </div>
                    <div>
                      <Label htmlFor="timeout">Timeout (seconds)</Label>
                      <Input
                        id="timeout"
                        type="number"
                        min="5"
                        max="300"
                        {...form.register("config.timeout", { valueAsNumber: true })}
                        data-testid="input-timeout"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <Label htmlFor="enabled">Enable Integration</Label>
                    <Switch
                      id="enabled"
                      checked={form.watch("enabled")}
                      onCheckedChange={(checked) => form.setValue("enabled", checked)}
                      data-testid="switch-enabled"
                    />
                  </div>
                </div>

                <div className="flex justify-end space-x-2 pt-4">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => {
                      setIsAddDialogOpen(false);
                      setEditingIntegration(null);
                    }}
                    data-testid="button-cancel"
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={createIntegration.isPending || updateIntegration.isPending}
                    data-testid="button-save-integration"
                  >
                    {createIntegration.isPending || updateIntegration.isPending 
                      ? "Saving..." 
                      : editingIntegration ? "Update" : "Create"
                    }
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {integrations.length === 0 ? (
          <div className="text-center py-8">
            <div className="mx-auto w-12 h-12 bg-muted rounded-full flex items-center justify-center mb-4">
              <ExternalLink className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium mb-2">No integrations configured</h3>
            <p className="text-muted-foreground mb-4 max-w-sm mx-auto">
              Connect your document management systems to automatically sync data and receive updates.
            </p>
            <Button onClick={() => setIsAddDialogOpen(true)} data-testid="button-add-first-integration">
              <Plus className="h-4 w-4 mr-2" />
              Add Your First Integration
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {integrations.map((integration: IntegrationWithStatus) => {
              const config = integration.config as any;
              const isEnabled = config.enabled !== false;
              
              return (
                <div key={integration.id} className="border rounded-lg p-4 space-y-4" data-testid={`integration-${integration.id}`}>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h4 className="font-medium">{integration.provider}</h4>
                        {getHealthBadge(integration.status?.connectionHealth?.status)}
                        <Badge variant={isEnabled ? "default" : "secondary"}>
                          {isEnabled ? "Enabled" : "Disabled"}
                        </Badge>
                      </div>
                      
                      {config.description && (
                        <p className="text-sm text-muted-foreground mb-2">{config.description}</p>
                      )}
                      
                      <div className="text-sm text-muted-foreground space-y-1">
                        <div className="flex items-center gap-2">
                          <ExternalLink className="h-3 w-3" />
                          <span className="font-mono text-xs">{config.webhookUrl}</span>
                        </div>
                        
                        {integration.status?.connectionHealth?.lastTestAt && (
                          <div className="flex items-center gap-2">
                            <Clock className="h-3 w-3" />
                            <span>
                              Last tested {formatDistanceToNow(new Date(integration.status.connectionHealth.lastTestAt), { addSuffix: true })}
                            </span>
                          </div>
                        )}
                        
                        {integration.status?.syncStatus?.lastSyncAt && (
                          <div className="flex items-center gap-2">
                            <RefreshCw className="h-3 w-3" />
                            <span>
                              Last sync {formatDistanceToNow(new Date(integration.status.syncStatus.lastSyncAt), { addSuffix: true })}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Switch
                        checked={isEnabled}
                        onCheckedChange={(checked) => handleToggleIntegration(integration, checked)}
                        data-testid={`switch-integration-${integration.id}`}
                      />
                      
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleTestWebhook(integration.id)}
                        disabled={testingIntegration === integration.id}
                        data-testid={`button-test-${integration.id}`}
                      >
                        {testingIntegration === integration.id ? (
                          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <TestTube className="h-4 w-4 mr-2" />
                        )}
                        Test
                      </Button>
                      
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEditingIntegration(integration)}
                        data-testid={`button-edit-${integration.id}`}
                      >
                        <Settings className="h-4 w-4" />
                      </Button>
                      
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button 
                            variant="outline" 
                            size="sm"
                            data-testid={`button-delete-${integration.id}`}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Integration</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete the integration with {integration.provider}? 
                              This action cannot be undone and will stop all webhook communication.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deleteIntegration.mutate(integration.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              data-testid={`confirm-delete-${integration.id}`}
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>

                  {integration.status?.connectionHealth?.message && (
                    <div className="text-sm">
                      <span className="text-muted-foreground">Status: </span>
                      <span className={
                        integration.status.connectionHealth.status === 'healthy' 
                          ? 'text-green-600' 
                          : integration.status.connectionHealth.status === 'unhealthy'
                          ? 'text-red-600'
                          : 'text-yellow-600'
                      }>
                        {integration.status.connectionHealth.message}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}