import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Webhook, 
  Plus, 
  Settings,
  CheckCircle,
  XCircle,
  Clock,
  ExternalLink,
  Plug,
  Activity
} from "lucide-react";
import { WebhooksPanel } from "@/components/ops/integrations/WebhooksPanel";
import { apiRequest } from "@/lib/queryClient";

export default function IntegrationsPage() {
  const [showWebhookForm, setShowWebhookForm] = useState(false);
  const queryClient = useQueryClient();

  const { data: integrations, isLoading: integrationsLoading } = useQuery({
    queryKey: ["/api/opssos/integrations"],
  });

  const { data: webhooks, isLoading: webhooksLoading } = useQuery({
    queryKey: ["/api/opssos/webhooks"],
  });

  const { data: deliveries } = useQuery({
    queryKey: ["/api/opssos/webhooks/deliveries"],
  });

  const recentDeliveries = deliveries?.slice(0, 10) || [];
  const failedDeliveries = deliveries?.filter((d: any) => d.status === "failed").length || 0;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Integrations & Webhooks</h1>
          <p className="text-sm text-muted-foreground">
            Connect external services and manage event delivery
          </p>
        </div>
        <Button onClick={() => setShowWebhookForm(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Add Webhook
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Integrations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{integrations?.length || 0}</div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Active Webhooks</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {webhooks?.filter((w: any) => w.enabled).length || 0}
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-amber-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Deliveries Today</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{deliveries?.length || 0}</div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-red-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Failed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">{failedDeliveries}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="webhooks">
        <TabsList>
          <TabsTrigger value="webhooks">Webhooks</TabsTrigger>
          <TabsTrigger value="integrations">Integrations</TabsTrigger>
          <TabsTrigger value="deliveries">Delivery Log</TabsTrigger>
        </TabsList>

        <TabsContent value="webhooks" className="space-y-4">
          <WebhooksPanel 
            webhooks={webhooks || []}
            isLoading={webhooksLoading}
            showForm={showWebhookForm}
            onShowForm={setShowWebhookForm}
          />
        </TabsContent>

        <TabsContent value="integrations" className="space-y-4">
          {integrationsLoading ? (
            <div className="text-center py-8">Loading integrations...</div>
          ) : integrations?.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Plug className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <p className="text-muted-foreground mb-4">No integrations configured</p>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Integration
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {integrations?.map((integration: any) => (
                <Card key={integration.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">{integration.provider}</CardTitle>
                      <Badge variant={integration.status === "active" ? "default" : "secondary"}>
                        {integration.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <Button variant="outline" size="sm" className="w-full">
                      <Settings className="w-4 h-4 mr-2" />
                      Configure
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="deliveries" className="space-y-4">
          {recentDeliveries.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Activity className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <p className="text-muted-foreground">No webhook deliveries yet</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {recentDeliveries.map((delivery: any) => (
                <Card key={delivery.id}>
                  <CardContent className="py-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {delivery.status === "sent" ? (
                          <CheckCircle className="w-5 h-5 text-green-500" />
                        ) : delivery.status === "failed" ? (
                          <XCircle className="w-5 h-5 text-red-500" />
                        ) : (
                          <Clock className="w-5 h-5 text-amber-500" />
                        )}
                        <div>
                          <p className="font-medium text-sm">{delivery.eventType}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(delivery.createdAt).toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {delivery.responseCode && (
                          <Badge variant={delivery.responseCode < 400 ? "default" : "destructive"}>
                            {delivery.responseCode}
                          </Badge>
                        )}
                        <Badge variant={delivery.status === "sent" ? "default" : delivery.status === "failed" ? "destructive" : "secondary"}>
                          {delivery.status}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
