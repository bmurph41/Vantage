import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Send, Loader2, Clock, Save, Sparkles } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface ComposeEmailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTo?: string;
  defaultSubject?: string;
  dealId?: string;
  contactId?: string;
  contactName?: string;
  dealName?: string;
}

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  bodyHtml: string;
  category: string;
  tokensUsed: string[];
}

interface TemplatesResponse {
  templates: EmailTemplate[];
}

interface TokenDef {
  key: string;
  label: string;
  example: string;
}

export function ComposeEmailModal({
  open,
  onOpenChange,
  defaultTo = "",
  defaultSubject = "",
  dealId,
  contactId,
  contactName,
  dealName,
}: ComposeEmailModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [to, setTo] = useState(defaultTo);
  const [subject, setSubject] = useState(defaultSubject);
  const [body, setBody] = useState("");
  const [templateId, setTemplateId] = useState<string>("");
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduleAt, setScheduleAt] = useState<string>(() => defaultScheduleTime());
  const [saveName, setSaveName] = useState("");
  const [savingTemplate, setSavingTemplate] = useState(false);

  // Reset form when modal opens with new defaults
  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen) {
      setTo(defaultTo);
      setSubject(defaultSubject);
      setBody("");
      setTemplateId("");
      setScheduleEnabled(false);
      setScheduleAt(defaultScheduleTime());
      setSaveName("");
    }
    onOpenChange(isOpen);
  };

  // Templates
  const { data: templatesData } = useQuery<TemplatesResponse>({
    queryKey: ["/api/workflow-email/templates"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/workflow-email/templates");
      return res.json();
    },
    enabled: open,
    staleTime: 5 * 60_000,
  });
  const templates = templatesData?.templates || [];

  // Tokens (for the helper hint)
  const { data: tokensData } = useQuery<{ tokens: TokenDef[] }>({
    queryKey: ["/api/workflow-email/available-tokens"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/workflow-email/available-tokens");
      return res.json();
    },
    enabled: open,
    staleTime: Infinity,
  });
  const tokens = tokensData?.tokens || [];

  // When a template is selected, call /preview to get rendered content against
  // the current deal so the user sees what their recipient will see, not raw
  // {{tokens}}.
  const previewMutation = useMutation({
    mutationFn: async (tplId: string) => {
      const res = await apiRequest(
        "POST",
        `/api/workflow-email/templates/${tplId}/preview`,
        { dealId },
      );
      return res.json() as Promise<{ subject: string; bodyHtml: string; bodyText: string }>;
    },
    onSuccess: (data) => {
      setSubject(data.subject);
      setBody(stripEmailWrapper(data.bodyHtml));
    },
    onError: () => {
      toast({
        title: "Preview failed",
        description: "Couldn't render template — try again.",
        variant: "destructive",
      });
    },
  });

  const handleTemplateSelect = (id: string) => {
    setTemplateId(id === "__none__" ? "" : id);
    if (id && id !== "__none__") previewMutation.mutate(id);
  };

  // Send / schedule
  const sendMutation = useMutation({
    mutationFn: async () => {
      const payload: Record<string, unknown> = {
        to,
        subject,
        body,
        dealId,
        contactId,
      };
      if (templateId) payload.templateId = templateId;
      if (scheduleEnabled && scheduleAt) {
        payload.sendAt = new Date(scheduleAt).toISOString();
      }
      const res = await apiRequest("POST", "/api/workflow-email/compose-send", payload);
      return res.json();
    },
    onSuccess: (data) => {
      if (data.scheduled) {
        toast({
          title: "Email scheduled",
          description: `Will send ${new Date(data.scheduledAt).toLocaleString()}`,
        });
      } else if (data.success) {
        toast({
          title: "Email sent",
          description: `Sent to ${to}`,
        });
      } else {
        toast({
          title: "Send failed",
          description: "Email could not be delivered. Check provider configuration.",
          variant: "destructive",
        });
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["/api/activities"] });
      queryClient.invalidateQueries({ queryKey: ["/api/workflow-email/scheduled"] });
      if (dealId) {
        queryClient.invalidateQueries({ queryKey: [`/api/deals/${dealId}`] });
      }
      onOpenChange(false);
    },
    onError: (err: any) => {
      toast({
        title: "Error",
        description: err.message || "Failed to send email",
        variant: "destructive",
      });
    },
  });

  // Save as template
  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/workflow-email/templates", {
        name: saveName || subject || "Untitled template",
        subject,
        bodyHtml: body,
        category: "custom",
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Template saved" });
      queryClient.invalidateQueries({ queryKey: ["/api/workflow-email/templates"] });
      setSavingTemplate(false);
      setSaveName("");
    },
    onError: (err: any) => {
      toast({
        title: "Save failed",
        description: err.message || "Couldn't save template",
        variant: "destructive",
      });
    },
  });

  const canSend = to.trim() && subject.trim() && body.trim() && !sendMutation.isPending;
  const sendLabel = scheduleEnabled ? "Schedule" : "Send Email";
  const SendIcon = scheduleEnabled ? Clock : Send;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            Compose Email
          </DialogTitle>
          {(dealName || contactName) && (
            <div className="flex gap-2 mt-1">
              {dealName && <Badge variant="outline" className="text-xs">{dealName}</Badge>}
              {contactName && <Badge variant="secondary" className="text-xs">{contactName}</Badge>}
            </div>
          )}
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Template picker */}
          {templates.length > 0 && (
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-gray-500 flex items-center gap-1.5">
                <Sparkles className="h-3 w-3" /> Template
              </Label>
              <Select value={templateId || "__none__"} onValueChange={handleTemplateSelect}>
                <SelectTrigger>
                  <SelectValue placeholder="Start from a template (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— No template —</SelectItem>
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      <span className="font-medium">{t.name}</span>
                      {t.category && (
                        <span className="ml-2 text-[10px] text-muted-foreground uppercase">
                          {t.category}
                        </span>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="email-to" className="text-xs font-medium text-gray-500">To</Label>
            <Input
              id="email-to"
              type="email"
              placeholder="recipient@example.com"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="email-subject" className="text-xs font-medium text-gray-500">Subject</Label>
            <Input
              id="email-subject"
              placeholder="Email subject..."
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="email-body" className="text-xs font-medium text-gray-500">
                Message
              </Label>
              {tokens.length > 0 && (
                <TokenHint tokens={tokens} onInsert={(key) => setBody((b) => b + `{{${key}}}`)} />
              )}
            </div>
            <Textarea
              id="email-body"
              placeholder="Write your message... use {{deal.propertyName}} / {{contact.firstName}} etc. for merge fields."
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={10}
              className="resize-y font-mono text-sm"
            />
          </div>

          {/* Schedule toggle */}
          <div className="flex items-center gap-3 rounded-md border border-slate-200 p-3">
            <Switch
              id="schedule-toggle"
              checked={scheduleEnabled}
              onCheckedChange={setScheduleEnabled}
            />
            <Label htmlFor="schedule-toggle" className="text-xs font-medium text-gray-700 flex items-center gap-1.5 cursor-pointer">
              <Clock className="h-3 w-3" /> Schedule for later
            </Label>
            {scheduleEnabled && (
              <Input
                type="datetime-local"
                value={scheduleAt}
                onChange={(e) => setScheduleAt(e.target.value)}
                className="h-8 text-xs ml-auto w-auto"
              />
            )}
          </div>

          {/* Save as template */}
          {savingTemplate ? (
            <div className="flex items-center gap-2 rounded-md border border-dashed border-slate-200 p-3">
              <Input
                placeholder="Template name"
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                className="h-8 text-xs"
              />
              <Button
                size="sm"
                className="h-8 text-xs"
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending || !subject.trim() || !body.trim()}
              >
                {saveMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Save"}
              </Button>
              <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setSavingTemplate(false)}>
                Cancel
              </Button>
            </div>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-slate-500 h-7 px-2"
              onClick={() => setSavingTemplate(true)}
              disabled={!subject.trim() || !body.trim()}
            >
              <Save className="h-3 w-3 mr-1" /> Save as template
            </Button>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => sendMutation.mutate()}
            disabled={!canSend}
            className="bg-[#1B365D] hover:bg-[#152a4a]"
          >
            {sendMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {scheduleEnabled ? "Scheduling..." : "Sending..."}
              </>
            ) : (
              <>
                <SendIcon className="h-4 w-4 mr-2" />
                {sendLabel}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────

function defaultScheduleTime(): string {
  // Default: next hour, on the hour, local time
  const d = new Date();
  d.setHours(d.getHours() + 1, 0, 0, 0);
  // Format for <input type="datetime-local">: YYYY-MM-DDTHH:mm
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function stripEmailWrapper(html: string): string {
  // Preview endpoint wraps the body in a full email shell for display.
  // Strip the outer chrome so the user edits just their content.
  // Safe fallback: return as-is if we can't find the marker.
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  return bodyMatch ? bodyMatch[1].trim() : html;
}

function TokenHint({
  tokens,
  onInsert,
}: {
  tokens: TokenDef[];
  onInsert: (key: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        className="text-[10px] text-slate-500 hover:text-slate-700 inline-flex items-center gap-1"
        onClick={() => setOpen((o) => !o)}
      >
        <Sparkles className="h-2.5 w-2.5" /> Insert token
      </button>
      {open && (
        <div className="absolute right-0 top-5 z-50 w-64 max-h-64 overflow-y-auto bg-white border border-slate-200 rounded-md shadow-lg p-1">
          {tokens.map((t) => (
            <button
              key={t.key}
              type="button"
              className="w-full text-left px-2 py-1 text-xs hover:bg-slate-100 rounded"
              onClick={() => {
                onInsert(t.key);
                setOpen(false);
              }}
            >
              <div className="font-mono text-[10px] text-slate-500">{`{{${t.key}}}`}</div>
              <div className="text-[10px] text-slate-400">
                {t.label} — e.g. {t.example}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
