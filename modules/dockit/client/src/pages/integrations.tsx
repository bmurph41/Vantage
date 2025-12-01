import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import Sidebar from "@/components/layout/sidebar";
import TopBar from "@/components/layout/top-bar";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Ship, Anchor, Calendar, Settings, Plug, CheckCircle, AlertCircle } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Integration } from "@shared/schema";

interface IntegrationPlatform {
  id: string;
  name: string;
  description: string;
  icon: any;
  features: string[];
  documentation?: string;
}

const platforms: IntegrationPlatform[] = [
  {
    id: 'speedydock',
    name: 'SpeedyDock',
    description: 'Real-time boat launch scheduling and dry stack management',
    icon: Ship,
    features: [
      'Real-time launch scheduling',
      'Customer notifications',
      'Staff task management',
      'Boat location tracking'
    ],
    documentation: 'https://speedydock.com/api-docs'
  },
  {
    id: 'dockwa',
    name: 'Dockwa',
    description: 'Marina reservations and online booking platform',
    icon: Anchor,
    features: [
      'Online slip reservations',
      'Payment processing',
      'Customer management',
      'Inventory sync'
    ],
    documentation: 'https://dockwa.com/developers'
  },
  {
    id: 'snag_a_slip',
    name: 'Snag-a-Slip',
    description: 'Marina booking widget and reservation management',
    icon: Calendar,
    features: [
      'Embeddable booking widget',
      'Reservation synchronization',
      'Real-time availability',
      'Marketing exposure'
    ],
    documentation: 'https://snagaslip.com/button'
  }
];

export default function Integrations() {
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);
  const [configData, setConfigData] = useState<Record<string, string>>({});

  const { toast } = useToast();

  const { data: integrations = [], isLoading } = useQuery<Integration[]>({
    queryKey: ['/api/integrations'],
  });

  const updateIntegrationMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Integration> }) => {
      return apiRequest('PUT', `/api/integrations/${id}`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/integrations'] });
      toast({
        title: "Integration Updated",
        description: "Integration settings have been saved successfully.",
      });
      setSelectedPlatform(null);
      setConfigData({});
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update integration. Please try again.",
        variant: "destructive",
      });
    },
  });

  const getIntegrationStatus = (platformId: string) => {
    const integration = integrations.find(i => i.platform === platformId);
    return integration || null;
  };

  const getStatusBadge = (integration: Integration | null) => {
    if (!integration) {
      return <Badge variant="outline">Not Configured</Badge>;
    }
    
    switch (integration.syncStatus) {
      case 'connected':
        return <Badge className="bg-accent text-accent-foreground">Connected</Badge>;
      case 'error':
        return <Badge variant="destructive">Error</Badge>;
      case 'pending':
        return <Badge variant="secondary">Connecting</Badge>;
      case 'disconnected':
      default:
        return <Badge variant="outline">Disconnected</Badge>;
    }
  };

  const handleConnect = (platformId: string) => {
    setSelectedPlatform(platformId);
    const integration = getIntegrationStatus(platformId);
    if (integration?.config) {
      setConfigData(integration.config);
    }
  };

  const handleSaveConfig = () => {
    if (!selectedPlatform) return;
    
    const integration = getIntegrationStatus(selectedPlatform);
    if (integration) {
      updateIntegrationMutation.mutate({
        id: integration.id,
        updates: {
          isEnabled: true,
          syncStatus: 'connected',
          config: configData,
        }
      });
    }
  };

  const handleDisconnect = (integration: Integration) => {
    updateIntegrationMutation.mutate({
      id: integration.id,
      updates: {
        isEnabled: false,
        syncStatus: 'disconnected',
      }
    });
  };

  const formatLastSync = (lastSync: string | null) => {
    if (!lastSync) return 'Never';
    return new Date(lastSync).toLocaleString();
  };

  if (isLoading) {
    return (
      <div className="flex h-screen bg-background">
        <Sidebar />
        <main className="flex-1 overflow-auto">
          <TopBar />
          <div className="p-6">
            <div className="animate-pulse space-y-4">
              <div className="h-8 bg-muted rounded w-64" />
              <div className="grid gap-4">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-48 bg-muted rounded-lg" />
                ))}
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      
      <main className="flex-1 overflow-auto">
        <TopBar />
        
        <div className="p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Platform Integrations</h1>
              <p className="text-muted-foreground">Connect with SpeedyDock, Dockwa, Snag-a-Slip, and other marina platforms</p>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-accent rounded-full status-indicator" />
              <span className="text-sm text-muted-foreground">
                {integrations.filter(i => i.syncStatus === 'connected').length} of {platforms.length} connected
              </span>
            </div>
          </div>

          <div className="grid gap-6">
            {platforms.map((platform) => {
              const Icon = platform.icon;
              const integration = getIntegrationStatus(platform.id);
              const isConnected = integration?.syncStatus === 'connected';
              
              return (
                <Card key={platform.id} data-testid={`platform-${platform.id}`}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="w-12 h-12 bg-chart-1 rounded-lg flex items-center justify-center">
                          <Icon className="text-white" size={24} />
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold">{platform.name}</h3>
                          <p className="text-muted-foreground">{platform.description}</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-4">
                        {getStatusBadge(integration)}
                        {isConnected ? (
                          <div className="flex space-x-2">
                            <Button variant="outline" size="sm" onClick={() => handleConnect(platform.id)} data-testid={`button-configure-${platform.id}`}>
                              <Settings size={16} className="mr-2" />
                              Configure
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => integration && handleDisconnect(integration)} data-testid={`button-disconnect-${platform.id}`}>
                              Disconnect
                            </Button>
                          </div>
                        ) : (
                          <Button onClick={() => handleConnect(platform.id)} data-testid={`button-connect-${platform.id}`}>
                            <Plug size={16} className="mr-2" />
                            Connect
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <h4 className="font-medium mb-3">Features</h4>
                        <ul className="space-y-2">
                          {platform.features.map((feature, index) => (
                            <li key={index} className="flex items-center space-x-2 text-sm">
                              <CheckCircle size={16} className="text-accent" />
                              <span>{feature}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      
                      {integration && (
                        <div>
                          <h4 className="font-medium mb-3">Integration Status</h4>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Status:</span>
                              <span>{integration.syncStatus}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Last Sync:</span>
                              <span>{formatLastSync(integration.lastSync?.toString() || null)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Enabled:</span>
                              <span>{integration.isEnabled ? 'Yes' : 'No'}</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {platform.documentation && (
                      <div className="mt-4 pt-4 border-t border-border">
                        <p className="text-sm text-muted-foreground">
                          Need help? Check out the{' '}
                          <a href={platform.documentation} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                            integration documentation
                          </a>
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {selectedPlatform && (
            <Card data-testid="configuration-panel">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">
                    Configure {platforms.find(p => p.id === selectedPlatform)?.name}
                  </h3>
                  <Button variant="ghost" onClick={() => setSelectedPlatform(null)}>
                    Cancel
                  </Button>
                </div>
              </CardHeader>
              
              <CardContent className="space-y-4">
                {selectedPlatform === 'speedydock' && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="speedydock-api-key">API Key</Label>
                      <Input
                        id="speedydock-api-key"
                        type="password"
                        placeholder="Enter SpeedyDock API key"
                        value={configData.apiKey || ''}
                        onChange={(e) => setConfigData({...configData, apiKey: e.target.value})}
                        data-testid="input-speedydock-api-key"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="speedydock-marina-id">Marina ID</Label>
                      <Input
                        id="speedydock-marina-id"
                        placeholder="Enter Marina ID"
                        value={configData.marinaId || ''}
                        onChange={(e) => setConfigData({...configData, marinaId: e.target.value})}
                        data-testid="input-speedydock-marina-id"
                      />
                    </div>
                  </>
                )}

                {selectedPlatform === 'dockwa' && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="dockwa-api-key">API Key</Label>
                      <Input
                        id="dockwa-api-key"
                        type="password"
                        placeholder="Enter Dockwa API key"
                        value={configData.apiKey || ''}
                        onChange={(e) => setConfigData({...configData, apiKey: e.target.value})}
                        data-testid="input-dockwa-api-key"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="dockwa-webhook-url">Webhook URL</Label>
                      <Input
                        id="dockwa-webhook-url"
                        placeholder="Enter webhook URL for notifications"
                        value={configData.webhookUrl || ''}
                        onChange={(e) => setConfigData({...configData, webhookUrl: e.target.value})}
                        data-testid="input-dockwa-webhook-url"
                      />
                    </div>
                  </>
                )}

                {selectedPlatform === 'snag_a_slip' && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="snag-marina-id">Marina ID</Label>
                      <Input
                        id="snag-marina-id"
                        placeholder="Enter Snag-a-Slip Marina ID"
                        value={configData.marinaId || ''}
                        onChange={(e) => setConfigData({...configData, marinaId: e.target.value})}
                        data-testid="input-snag-marina-id"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="snag-widget-config">Widget Configuration</Label>
                      <Textarea
                        id="snag-widget-config"
                        placeholder="Enter widget HTML configuration"
                        value={configData.widgetConfig || ''}
                        onChange={(e) => setConfigData({...configData, widgetConfig: e.target.value})}
                        rows={4}
                        data-testid="textarea-snag-widget-config"
                      />
                    </div>
                  </>
                )}

                <div className="flex items-center space-x-2 pt-4">
                  <Button 
                    onClick={handleSaveConfig}
                    disabled={updateIntegrationMutation.isPending}
                    data-testid="button-save-configuration"
                  >
                    {updateIntegrationMutation.isPending ? "Saving..." : "Save Configuration"}
                  </Button>
                  <Button variant="outline" onClick={() => setSelectedPlatform(null)}>
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}
