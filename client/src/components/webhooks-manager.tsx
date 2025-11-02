import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Trash2, TestTube, Eye, Check, X, Loader2 } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { formatDistanceToNow } from "date-fns";

const webhookFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  url: z.string().url("Must be a valid URL"),
  method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]),
  events: z.array(z.string()).min(1, "Select at least one event"),
  isActive: z.boolean().default(true),
});

type WebhookFormData = z.infer<typeof webhookFormSchema>;

interface Webhook {
  id: string;
  name: string;
  url: string;
  method: string;
  events: string[];
  headers: Record<string, string> | null;
  isActive: boolean;
  totalCalls: number;
  successfulCalls: number;
  failedCalls: number;
  lastCalledAt: string | null;
  lastStatus: number | null;
  createdAt: string;
}

interface WebhookLog {
  id: string;
  webhookId: string;
  event: string;
  payload: any;
  statusCode: number | null;
  responseBody: string | null;
  responseTime: number;
  success: boolean;
  errorMessage: string | null;
  createdAt: string;
}

const availableEvents = [
  "deal.created",
  "deal.updated",
  "deal.deleted",
  "contact.created",
  "contact.updated",
  "contact.deleted",
  "company.created",
  "company.updated",
  "company.deleted",
  "lead.created",
  "lead.updated",
  "lead.deleted",
  "lead.converted",
  "task.created",
  "task.completed",
];

export default function WebhooksManager() {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingWebhook, setEditingWebhook] = useState<Webhook | null>(null);
  const [selectedWebhookForLogs, setSelectedWebhookForLogs] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const form = useForm<WebhookFormData>({
    resolver: zodResolver(webhookFormSchema),
    defaultValues: {
      name: "",
      url: "",
      method: "POST",
      events: [],
      isActive: true,
    },
  });

  const { data: webhooks = [], isLoading } = useQuery<Webhook[]>({
    queryKey: ["/api/webhooks"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: WebhookFormData) => {
      return await apiRequest("/api/webhooks", "POST", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/webhooks"] });
      setIsDialogOpen(false);
      form.reset();
      toast({ title: "Success", description: "Webhook created successfully" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to create webhook", 
        variant: "destructive" 
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: WebhookFormData }) => {
      return await apiRequest(`/api/webhooks/${id}`, "PUT", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/webhooks"] });
      setIsDialogOpen(false);
      setEditingWebhook(null);
      form.reset();
      toast({ title: "Success", description: "Webhook updated successfully" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to update webhook", 
        variant: "destructive" 
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest(`/api/webhooks/${id}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/webhooks"] });
      setDeleteConfirmId(null);
      toast({ title: "Success", description: "Webhook deleted successfully" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to delete webhook", 
        variant: "destructive" 
      });
    },
  });

  const testMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/webhooks/${id}/test`, {
        method: "POST",
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error(await response.text());
      }
      return response.json();
    },
    onSuccess: (result: { success: boolean; statusCode?: number; error?: string }) => {
      if (result.success) {
        toast({ 
          title: "Test Successful", 
          description: `Webhook responded with status ${result.statusCode}` 
        });
      } else {
        toast({ 
          title: "Test Failed", 
          description: result.error || "Webhook test failed", 
          variant: "destructive" 
        });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/webhooks"] });
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to test webhook", 
        variant: "destructive" 
      });
    },
  });

  const handleCreateNew = () => {
    setEditingWebhook(null);
    form.reset({
      name: "",
      url: "",
      method: "POST",
      events: [],
      isActive: true,
    });
    setIsDialogOpen(true);
  };

  const handleEdit = (webhook: Webhook) => {
    setEditingWebhook(webhook);
    form.reset({
      name: webhook.name,
      url: webhook.url,
      method: webhook.method as any,
      events: webhook.events,
      isActive: webhook.isActive,
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (data: WebhookFormData) => {
    if (editingWebhook) {
      updateMutation.mutate({ id: editingWebhook.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Webhooks</CardTitle>
            <CardDescription>Configure webhook endpoints for real-time event notifications</CardDescription>
          </div>
          <Button onClick={handleCreateNew} data-testid="button-create-webhook">
            <Plus className="w-4 h-4 mr-2" />
            Create Webhook
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ) : webhooks.length === 0 ? (
            <div className="text-center p-8 text-gray-500">
              No webhooks configured. Create your first webhook to get started.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>URL</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Events</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Calls</TableHead>
                  <TableHead>Last Called</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {webhooks.map((webhook) => (
                  <TableRow key={webhook.id} data-testid={`row-webhook-${webhook.id}`}>
                    <TableCell className="font-medium">{webhook.name}</TableCell>
                    <TableCell className="max-w-xs truncate" title={webhook.url}>
                      {webhook.url}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{webhook.method}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {webhook.events.slice(0, 2).map((event) => (
                          <Badge key={event} variant="secondary" className="text-xs">
                            {event}
                          </Badge>
                        ))}
                        {webhook.events.length > 2 && (
                          <Badge variant="secondary" className="text-xs">
                            +{webhook.events.length - 2}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {webhook.isActive ? (
                        <Badge className="bg-green-500">Active</Badge>
                      ) : (
                        <Badge variant="secondary">Inactive</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="text-green-600 flex items-center gap-1">
                          <Check className="w-3 h-3" />
                          {webhook.successfulCalls}
                        </span>
                        <span className="text-red-600 flex items-center gap-1">
                          <X className="w-3 h-3" />
                          {webhook.failedCalls}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {webhook.lastCalledAt ? (
                        <div>
                          <div className="text-sm">
                            {formatDistanceToNow(new Date(webhook.lastCalledAt), { addSuffix: true })}
                          </div>
                          {webhook.lastStatus && (
                            <Badge
                              variant={webhook.lastStatus >= 200 && webhook.lastStatus < 300 ? "default" : "destructive"}
                              className="text-xs mt-1"
                            >
                              {webhook.lastStatus}
                            </Badge>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-400">Never</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedWebhookForLogs(webhook.id)}
                          data-testid={`button-view-logs-${webhook.id}`}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => testMutation.mutate(webhook.id)}
                          disabled={testMutation.isPending}
                          data-testid={`button-test-${webhook.id}`}
                        >
                          <TestTube className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(webhook)}
                          data-testid={`button-edit-${webhook.id}`}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteConfirmId(webhook.id)}
                          data-testid={`button-delete-${webhook.id}`}
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingWebhook ? "Edit Webhook" : "Create Webhook"}</DialogTitle>
            <DialogDescription>
              Configure a webhook endpoint to receive real-time event notifications
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input placeholder="My Webhook" {...field} data-testid="input-webhook-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="url"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Endpoint URL</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="https://api.example.com/webhook" 
                        {...field} 
                        data-testid="input-webhook-url"
                      />
                    </FormControl>
                    <FormDescription>The URL where webhook events will be sent</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="method"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>HTTP Method</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-webhook-method">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="GET" data-testid="option-method-get">GET</SelectItem>
                        <SelectItem value="POST" data-testid="option-method-post">POST</SelectItem>
                        <SelectItem value="PUT" data-testid="option-method-put">PUT</SelectItem>
                        <SelectItem value="PATCH" data-testid="option-method-patch">PATCH</SelectItem>
                        <SelectItem value="DELETE" data-testid="option-method-delete">DELETE</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="events"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Events to Subscribe</FormLabel>
                    <div className="border rounded-md p-4 max-h-60 overflow-y-auto space-y-2">
                      {availableEvents.map((event) => (
                        <div key={event} className="flex items-center">
                          <input
                            type="checkbox"
                            id={`event-${event}`}
                            checked={field.value.includes(event)}
                            onChange={(e) => {
                              const newEvents = e.target.checked
                                ? [...field.value, event]
                                : field.value.filter((e) => e !== event);
                              field.onChange(newEvents);
                            }}
                            className="mr-2"
                            data-testid={`checkbox-event-${event}`}
                          />
                          <label htmlFor={`event-${event}`} className="text-sm">
                            {event}
                          </label>
                        </div>
                      ))}
                    </div>
                    <FormDescription>Select which events should trigger this webhook</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-2">
                    <FormControl>
                      <input
                        type="checkbox"
                        checked={field.value}
                        onChange={field.onChange}
                        data-testid="checkbox-webhook-active"
                      />
                    </FormControl>
                    <FormLabel className="!mt-0">Active</FormLabel>
                    <FormDescription className="!mt-0">
                      Inactive webhooks will not receive events
                    </FormDescription>
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsDialogOpen(false)}
                  data-testid="button-cancel-webhook"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={createMutation.isPending || updateMutation.isPending}
                  data-testid="button-save-webhook"
                >
                  {createMutation.isPending || updateMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    editingWebhook ? "Update" : "Create"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Webhook</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this webhook? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setDeleteConfirmId(null)}
              data-testid="button-cancel-delete"
            >
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={() => deleteConfirmId && deleteMutation.mutate(deleteConfirmId)}
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Webhook Logs Dialog */}
      {selectedWebhookForLogs && (
        <WebhookLogsDialog
          webhookId={selectedWebhookForLogs}
          onClose={() => setSelectedWebhookForLogs(null)}
        />
      )}
    </div>
  );
}

function WebhookLogsDialog({ webhookId, onClose }: { webhookId: string; onClose: () => void }) {
  const { data: logs = [], isLoading } = useQuery<WebhookLog[]>({
    queryKey: ["/api/webhooks", webhookId, "logs"],
    queryFn: async () => {
      const response = await fetch(`/api/webhooks/${webhookId}/logs?limit=50`, {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to fetch logs");
      }
      return response.json();
    },
  });

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Webhook Logs</DialogTitle>
          <DialogDescription>Recent webhook calls and their responses</DialogDescription>
        </DialogHeader>

        <div className="overflow-y-auto max-h-[60vh]">
          {isLoading ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center p-8 text-gray-500">
              No logs found for this webhook
            </div>
          ) : (
            <div className="space-y-3">
              {logs.map((log) => (
                <Card key={log.id} className={log.success ? "border-green-200" : "border-red-200"}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <Badge variant={log.success ? "default" : "destructive"}>
                          {log.success ? "Success" : "Failed"}
                        </Badge>
                        <span className="text-sm font-medium">{log.event}</span>
                        {log.statusCode && (
                          <Badge variant="outline" className="text-xs">
                            {log.statusCode}
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-gray-500">
                        {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true })}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-sm mb-2">
                      <div>
                        <span className="text-gray-500">Response Time:</span>{" "}
                        <span className="font-medium">{log.responseTime}ms</span>
                      </div>
                    </div>

                    {log.errorMessage && (
                      <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-800">
                        <strong>Error:</strong> {log.errorMessage}
                      </div>
                    )}

                    {log.responseBody && (
                      <details className="mt-2">
                        <summary 
                          className="cursor-pointer text-sm text-gray-600 hover:text-gray-800"
                          data-testid={`toggle-response-${log.id}`}
                        >
                          View Response
                        </summary>
                        <pre className="mt-2 p-2 bg-gray-50 rounded text-xs overflow-x-auto">
                          {log.responseBody}
                        </pre>
                      </details>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button onClick={onClose} data-testid="button-close-logs">Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
