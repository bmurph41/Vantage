import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Webhook, 
  Plus, 
  Settings,
  Trash2,
  ExternalLink,
  Copy
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface WebhooksPanelProps {
  webhooks: any[];
  isLoading: boolean;
  showForm: boolean;
  onShowForm: (show: boolean) => void;
}

const EVENT_TYPES = [
  { value: "deal.created", label: "Deal Created" },
  { value: "deal.updated", label: "Deal Updated" },
  { value: "deal.closed", label: "Deal Closed" },
  { value: "task.created", label: "Task Created" },
  { value: "task.completed", label: "Task Completed" },
  { value: "message.sent", label: "Message Sent" },
  { value: "document.uploaded", label: "Document Uploaded" },
  { value: "statement.generated", label: "Statement Generated" },
];

export function WebhooksPanel({ webhooks, isLoading, showForm, onShowForm }: WebhooksPanelProps) {
  const queryClient = useQueryClient();
  const [url, setUrl] = useState("");
  const [secret, setSecret] = useState("");
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);

  const createMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("/api/opssos/webhooks", {
        method: "POST",
        body: JSON.stringify({
          url,
          secret,
          eventTypes: selectedEvents,
          enabled: true,
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/opssos/webhooks"] });
      onShowForm(false);
      setUrl("");
      setSecret("");
      setSelectedEvents([]);
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      return apiRequest(`/api/opssos/webhooks/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ enabled }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/opssos/webhooks"] });
    },
  });

  const toggleEvent = (event: string) => {
    setSelectedEvents((prev) =>
      prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event]
    );
  };

  if (isLoading) {
    return <div className="text-center py-8">Loading webhooks...</div>;
  }

  return (
    <div className="space-y-4">
      {webhooks.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Webhook className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <p className="text-muted-foreground mb-4">No webhooks configured</p>
            <Button onClick={() => onShowForm(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Webhook
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {webhooks.map((webhook) => (
            <Card key={webhook.id}>
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <Switch
                      checked={webhook.enabled}
                      onCheckedChange={(enabled) => toggleMutation.mutate({ id: webhook.id, enabled })}
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm truncate max-w-xs">{webhook.url}</p>
                        <Button variant="ghost" size="icon" className="h-6 w-6">
                          <Copy className="w-3 h-3" />
                        </Button>
                      </div>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {webhook.eventTypes?.slice(0, 3).map((event: string) => (
                          <Badge key={event} variant="secondary" className="text-xs">
                            {event}
                          </Badge>
                        ))}
                        {webhook.eventTypes?.length > 3 && (
                          <Badge variant="outline" className="text-xs">
                            +{webhook.eventTypes.length - 3} more
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={webhook.enabled ? "default" : "secondary"}>
                      {webhook.enabled ? "Active" : "Paused"}
                    </Badge>
                    <Button variant="ghost" size="icon">
                      <Settings className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showForm} onOpenChange={onShowForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Webhook className="w-5 h-5" />
              Add Webhook
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Endpoint URL</Label>
              <Input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://your-server.com/webhook"
              />
            </div>

            <div className="space-y-2">
              <Label>Secret (optional)</Label>
              <Input
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
                placeholder="Signing secret for verification"
                type="password"
              />
            </div>

            <div className="space-y-2">
              <Label>Events</Label>
              <div className="grid grid-cols-2 gap-2">
                {EVENT_TYPES.map((event) => (
                  <div key={event.value} className="flex items-center gap-2">
                    <Checkbox
                      checked={selectedEvents.includes(event.value)}
                      onCheckedChange={() => toggleEvent(event.value)}
                    />
                    <span className="text-sm">{event.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onShowForm(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={!url || selectedEvents.length === 0 || createMutation.isPending}
            >
              {createMutation.isPending ? "Creating..." : "Create Webhook"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
