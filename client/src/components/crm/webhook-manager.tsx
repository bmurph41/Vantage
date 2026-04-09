import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Edit, Webhook, TestTube, Eye, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface WebhookHeader { key: string; value: string }

interface WebhookConfig {
  id?: string;
  name: string;
  url: string;
  method: "POST" | "PUT";
  events: string[];
  headers: WebhookHeader[];
  secret: string;
  active: boolean;
}

interface WebhookEntry extends WebhookConfig {
  id: string;
  successCount: number;
  failCount: number;
  createdAt: string;
}

interface TestResult { success: boolean; statusCode: number; responseTime: number }
interface LogEntry { id: string; event: string; statusCode: number; responseTime: number; success: boolean; createdAt: string; payload?: string }

const AVAILABLE_EVENTS = [
  "deal.created", "deal.updated", "deal.stage_changed", "deal.won", "deal.lost", "deal.deleted",
  "contact.created", "contact.updated", "contact.deleted",
  "company.created", "company.updated", "company.deleted",
  "activity.created", "activity.completed",
  "task.created", "task.completed",
  "note.created",
];

const EVENT_GROUPS: Record<string, string[]> = {
  Deal: AVAILABLE_EVENTS.filter(e => e.startsWith("deal.")),
  Contact: AVAILABLE_EVENTS.filter(e => e.startsWith("contact.")),
  Company: AVAILABLE_EVENTS.filter(e => e.startsWith("company.")),
  Activity: AVAILABLE_EVENTS.filter(e => e.startsWith("activity.")),
  Task: AVAILABLE_EVENTS.filter(e => e.startsWith("task.")),
  Note: AVAILABLE_EVENTS.filter(e => e.startsWith("note.")),
};

const emptyWebhook: WebhookConfig = {
  name: "", url: "", method: "POST", events: [], headers: [], secret: "", active: true,
};

export default function WebhookManager() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [editOpen, setEditOpen] = useState(false);
  const [logsOpen, setLogsOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState<WebhookConfig>({ ...emptyWebhook });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [logsWebhookId, setLogsWebhookId] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<TestResult | null>(null);

  const { data, isLoading } = useQuery<{ webhooks: WebhookEntry[] }>({
    queryKey: ["crm-webhooks"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/crm/webhooks");
      return res.json();
    },
  });

  const { data: logsData } = useQuery<{ logs: LogEntry[]; total: number }>({
    queryKey: ["crm-webhook-logs", logsWebhookId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/crm/webhooks/${logsWebhookId}/logs`);
      return res.json();
    },
    enabled: !!logsWebhookId,
  });

  const saveMutation = useMutation({
    mutationFn: async (config: WebhookConfig) => {
      const method = editingId ? "PUT" : "POST";
      const url = editingId ? `/api/crm/webhooks/${editingId}` : "/api/crm/webhooks";
      await apiRequest(method, url, config);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm-webhooks"] });
      setEditOpen(false);
      toast({ title: editingId ? "Webhook updated" : "Webhook created" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => { await apiRequest("DELETE", `/api/crm/webhooks/${id}`); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm-webhooks"] });
      setDeleteId(null);
      toast({ title: "Webhook deleted" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      await apiRequest("PUT", `/api/crm/webhooks/${id}`, { active });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["crm-webhooks"] }),
  });

  const testMutation = useMutation({
    mutationFn: async (id: string) => {
      setTestingId(id);
      const res = await apiRequest("POST", `/api/crm/webhooks/${id}/test`);
      return res.json() as Promise<TestResult>;
    },
    onSuccess: (result) => {
      setTestResult(result);
      setTestingId(null);
      toast({
        title: result.success ? "Test successful" : "Test failed",
        description: `Status ${result.statusCode} in ${result.responseTime}ms`,
        variant: result.success ? "default" : "destructive",
      });
    },
    onError: (err: Error) => {
      setTestingId(null);
      toast({ title: "Test error", description: err.message, variant: "destructive" });
    },
  });

  function openCreate() {
    setForm({ ...emptyWebhook });
    setEditingId(null);
    setEditOpen(true);
  }

  function openEdit(wh: WebhookEntry) {
    setForm({ name: wh.name, url: wh.url, method: wh.method, events: wh.events, headers: wh.headers || [], secret: wh.secret || "", active: wh.active });
    setEditingId(wh.id);
    setEditOpen(true);
  }

  function toggleEvent(event: string) {
    setForm(f => ({
      ...f,
      events: f.events.includes(event) ? f.events.filter(e => e !== event) : [...f.events, event],
    }));
  }

  function addHeader() { setForm(f => ({ ...f, headers: [...f.headers, { key: "", value: "" }] })); }

  function updateHeader(idx: number, field: "key" | "value", val: string) {
    setForm(f => ({ ...f, headers: f.headers.map((h, i) => i === idx ? { ...h, [field]: val } : h) }));
  }

  function removeHeader(idx: number) {
    setForm(f => ({ ...f, headers: f.headers.filter((_, i) => i !== idx) }));
  }

  const webhooks = data?.webhooks ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold flex items-center gap-2">
            <Webhook className="h-6 w-6" /> Webhooks
          </h2>
          <p className="text-muted-foreground text-sm mt-1">Send real-time event notifications to external services</p>
        </div>
        <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" /> Add Webhook</Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : webhooks.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-12 text-center">
            <Webhook className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No webhooks configured yet</p>
            <Button className="mt-4" onClick={openCreate}>Create your first webhook</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {webhooks.map(wh => (
            <Card key={wh.id}>
              <CardContent className="flex items-center justify-between py-4 px-6">
                <div className="flex items-center gap-4 min-w-0">
                  <Switch checked={wh.active} onCheckedChange={(active) => toggleMutation.mutate({ id: wh.id, active })} />
                  <div className="min-w-0">
                    <div className="font-medium truncate">{wh.name}</div>
                    <div className="text-sm text-muted-foreground truncate">{wh.url}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <Badge variant="outline">{wh.events.length} events</Badge>
                  <div className="flex items-center gap-1 text-sm">
                    <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                    <span>{wh.successCount}</span>
                  </div>
                  <div className="flex items-center gap-1 text-sm">
                    <XCircle className="h-3.5 w-3.5 text-red-500" />
                    <span>{wh.failCount}</span>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => testMutation.mutate(wh.id)} disabled={testingId === wh.id}>
                    {testingId === wh.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <TestTube className="h-4 w-4" />}
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => { setLogsWebhookId(wh.id); setLogsOpen(true); }}>
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => openEdit(wh)}><Edit className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => setDeleteId(wh.id)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Webhook" : "Create Webhook"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Name</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Zapier Deal Alerts" />
            </div>
            <div>
              <Label>URL</Label>
              <Input value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))} placeholder="https://hooks.example.com/webhook" />
            </div>
            <div>
              <Label>Method</Label>
              <Select value={form.method} onValueChange={(v) => setForm(f => ({ ...f, method: v as "POST" | "PUT" }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="POST">POST</SelectItem>
                  <SelectItem value="PUT">PUT</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Secret (for signature verification)</Label>
              <Input value={form.secret} onChange={e => setForm(f => ({ ...f, secret: e.target.value }))} placeholder="Optional signing secret" type="password" />
            </div>

            <div>
              <Label className="mb-2 block">Events</Label>
              <div className="space-y-3 border rounded-md p-3 max-h-48 overflow-y-auto">
                {Object.entries(EVENT_GROUPS).map(([group, events]) => (
                  <div key={group}>
                    <div className="text-xs font-semibold text-muted-foreground uppercase mb-1">{group}</div>
                    <div className="grid grid-cols-2 gap-1">
                      {events.map(event => (
                        <label key={event} className="flex items-center gap-2 text-sm cursor-pointer">
                          <Checkbox checked={form.events.includes(event)} onCheckedChange={() => toggleEvent(event)} />
                          {event.split(".")[1].replace("_", " ")}
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Custom Headers</Label>
                <Button type="button" variant="outline" size="sm" onClick={addHeader}><Plus className="h-3 w-3 mr-1" /> Add</Button>
              </div>
              {form.headers.map((h, i) => (
                <div key={i} className="flex gap-2 mb-2">
                  <Input value={h.key} onChange={e => updateHeader(i, "key", e.target.value)} placeholder="Header name" className="flex-1" />
                  <Input value={h.value} onChange={e => updateHeader(i, "value", e.target.value)} placeholder="Value" className="flex-1" />
                  <Button variant="ghost" size="icon" onClick={() => removeHeader(i)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={() => saveMutation.mutate(form)} disabled={!form.name || !form.url || form.events.length === 0 || saveMutation.isPending}>
              {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingId ? "Save Changes" : "Create Webhook"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete Webhook</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">This will permanently delete this webhook and all its delivery logs. This action cannot be undone.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteId && deleteMutation.mutate(deleteId)} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Logs Dialog */}
      <Dialog open={logsOpen} onOpenChange={(open) => { setLogsOpen(open); if (!open) setLogsWebhookId(null); }}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Delivery Logs</DialogTitle></DialogHeader>
          {!logsData?.logs?.length ? (
            <p className="text-sm text-muted-foreground text-center py-8">No delivery logs yet</p>
          ) : (
            <div className="space-y-2">
              {logsData.logs.map(log => (
                <div key={log.id} className="flex items-center justify-between border rounded-md px-4 py-2 text-sm">
                  <div className="flex items-center gap-3">
                    {log.success ? <CheckCircle className="h-4 w-4 text-green-500" /> : <XCircle className="h-4 w-4 text-red-500" />}
                    <Badge variant="outline">{log.event}</Badge>
                  </div>
                  <div className="flex items-center gap-4 text-muted-foreground">
                    <span>HTTP {log.statusCode}</span>
                    <span>{log.responseTime}ms</span>
                    <span>{new Date(log.createdAt).toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
