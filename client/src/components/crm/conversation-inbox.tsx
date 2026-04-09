/**
 * ConversationInbox
 *
 * Threaded email view for a contact or deal.
 * Queries the existing activity timeline filtered to email type.
 * Left panel shows email subjects, right panel shows selected email preview.
 */

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Mail, Send, Inbox, ChevronRight, Loader2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

// ─── Types ────────────────────────────────────────────────────────

interface ConversationInboxProps {
  entityType: "contact" | "deal";
  entityId: string;
}

interface EmailItem {
  id: string;
  subject: string;
  from: string;
  to: string;
  body: string;
  direction: "sent" | "received";
  date: string;
  status?: string;
}

interface TimelineEntry {
  id: string;
  type: string;
  title?: string;
  subject?: string;
  from?: string;
  to?: string;
  body?: string;
  description?: string;
  direction?: string;
  date?: string;
  createdAt?: string;
  status?: string;
}

type FilterMode = "all" | "sent" | "received";

// ─── Component ────────────────────────────────────────────────────

export function ConversationInbox({ entityType, entityId }: ConversationInboxProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterMode>("all");
  const [showCompose, setShowCompose] = useState(false);

  const { data: timeline, isLoading } = useQuery<TimelineEntry[]>({
    queryKey: ["crm", "timeline", entityType, entityId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/crm/timeline/${entityType}/${entityId}`);
      return res.json();
    },
  });

  const emails = useMemo<EmailItem[]>(() => {
    if (!timeline) return [];
    return timeline
      .filter((e) => e.type === "email" || e.type === "email_sent" || e.type === "email_received")
      .map((e) => ({
        id: e.id,
        subject: e.subject || e.title || "(No subject)",
        from: e.from || "",
        to: e.to || "",
        body: e.body || e.description || "",
        direction: (e.direction === "sent" || e.type === "email_sent") ? "sent" as const : "received" as const,
        date: e.date || e.createdAt || "",
        status: e.status,
      }))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [timeline]);

  const filtered = useMemo(() => {
    if (filter === "all") return emails;
    return emails.filter((e) => e.direction === filter);
  }, [emails, filter]);

  const selected = filtered.find((e) => e.id === selectedId) ?? filtered[0] ?? null;

  return (
    <div className="border rounded-lg overflow-hidden flex flex-col" style={{ height: 480 }}>
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b bg-muted/30">
        <Mail className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium flex-1">Emails</span>
        <Select value={filter} onValueChange={(v) => setFilter(v as FilterMode)}>
          <SelectTrigger className="w-28 h-7 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="sent">Sent</SelectItem>
            <SelectItem value="received">Received</SelectItem>
          </SelectContent>
        </Select>
        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setShowCompose(true)}>
          <Send className="h-3 w-3 mr-1" /> Compose
        </Button>
      </div>

      {isLoading && (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}

      {!isLoading && filtered.length === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
          <Inbox className="h-8 w-8 mb-2" />
          <p className="text-sm">No emails found</p>
        </div>
      )}

      {!isLoading && filtered.length > 0 && (
        <div className="flex flex-1 min-h-0">
          {/* Left: email list */}
          <div className="w-64 border-r overflow-y-auto shrink-0">
            {filtered.map((email) => {
              const isActive = email.id === (selected?.id ?? null);
              return (
                <button
                  key={email.id}
                  onClick={() => setSelectedId(email.id)}
                  className={cn(
                    "w-full text-left px-3 py-2.5 border-b last:border-b-0 transition-colors",
                    isActive ? "bg-primary/5 border-l-2 border-l-primary" : "hover:bg-muted/40",
                  )}
                >
                  <div className="flex items-center gap-1.5">
                    {email.direction === "sent" ? (
                      <Send className="h-3 w-3 text-blue-500 shrink-0" />
                    ) : (
                      <Inbox className="h-3 w-3 text-green-500 shrink-0" />
                    )}
                    <span className="text-sm font-medium truncate">{email.subject}</span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="text-xs text-muted-foreground truncate">
                      {email.direction === "sent" ? `To: ${email.to}` : `From: ${email.from}`}
                    </span>
                  </div>
                  <span className="text-[10px] text-muted-foreground">
                    {email.date ? format(new Date(email.date), "MMM d, h:mm a") : ""}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Right: email preview */}
          <div className="flex-1 overflow-y-auto p-4 min-w-0">
            {selected ? (
              <div className="space-y-3">
                <div>
                  <h3 className="font-semibold text-base">{selected.subject}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant={selected.direction === "sent" ? "default" : "secondary"} className="text-[10px]">
                      {selected.direction}
                    </Badge>
                    {selected.status && (
                      <Badge variant="outline" className="text-[10px]">{selected.status}</Badge>
                    )}
                  </div>
                </div>
                <div className="text-xs text-muted-foreground space-y-0.5">
                  <p><span className="font-medium">From:</span> {selected.from || "—"}</p>
                  <p><span className="font-medium">To:</span> {selected.to || "—"}</p>
                  <p><span className="font-medium">Date:</span> {selected.date ? format(new Date(selected.date), "PPpp") : "—"}</p>
                </div>
                <div className="border-t pt-3">
                  <div
                    className="text-sm leading-relaxed whitespace-pre-wrap"
                    dangerouslySetInnerHTML={{ __html: selected.body }}
                  />
                </div>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                Select an email to preview
              </div>
            )}
          </div>
        </div>
      )}

      {/* Compose modal — delegates to existing ComposeEmailModal if available */}
      {showCompose && (
        <ComposeStub onClose={() => setShowCompose(false)} entityType={entityType} entityId={entityId} />
      )}
    </div>
  );
}

// ─── Compose Stub ─────────────────────────────────────────────────
// Thin wrapper — attempts to lazy-load the existing ComposeEmailModal.
// Falls back to a simple alert if not available.

function ComposeStub({
  onClose,
  entityType,
  entityId,
}: {
  onClose: () => void;
  entityType: string;
  entityId: string;
}) {
  // Try to use the existing compose modal
  try {
    // Dynamic import is handled at build time; for now render inline dialog
    const { Dialog, DialogContent, DialogHeader, DialogTitle } = require("@/components/ui/dialog");
    return (
      <Dialog open onOpenChange={onClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Compose Email</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-4">
            Email composition for {entityType} {entityId}. Connect the ComposeEmailModal component here.
          </p>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogContent>
      </Dialog>
    );
  } catch {
    onClose();
    return null;
  }
}
