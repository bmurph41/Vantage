/**
 * DealActivityTimeline
 * 
 * Activity feed for deals with:
 * - Chronological event timeline (stage changes, notes, calls, emails, meetings)
 * - Inline activity composer (quick-log without modal)
 * - Full activity composer modal (detailed logging)
 * - Activity type filtering
 * - Relative timestamps with full date tooltips
 * 
 * Fetches from /api/crm/timeline/:entityType/:entityId
 */

import { useState, useMemo, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  MessageSquare, Phone, Mail, Calendar as CalendarIcon, FileText,
  ArrowRight, Users, Clock, Plus, Send, ChevronDown, X,
  Loader2, Filter, Trophy, XCircle, Edit3, Paperclip, AtSign
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger, DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { formatDistanceToNow, format } from "date-fns";
import { ActivityComposerModal } from "./activity-composer-modal";

// ─── Types ────────────────────────────────────────────────────────

interface DealActivityTimelineProps {
  dealId: string | number;
  entityType?: string;
  maxHeight?: string;
  showComposer?: boolean;
}

type ActivityType = "note" | "call" | "email" | "meeting" | "stage_change" | "task" | "document" | "all";

interface TimelineEvent {
  id: string;
  type: ActivityType;
  title: string;
  description?: string;
  createdAt: string;
  createdBy?: string;
  metadata?: Record<string, any>;
}

// ─── Activity Type Config ─────────────────────────────────────────

const ACTIVITY_TYPES: Record<string, { icon: typeof MessageSquare; label: string; color: string; bgColor: string }> = {
  note: { icon: MessageSquare, label: "Note", color: "text-blue-600", bgColor: "bg-blue-100 dark:bg-blue-900/40" },
  call: { icon: Phone, label: "Call", color: "text-green-600", bgColor: "bg-green-100 dark:bg-green-900/40" },
  email: { icon: Mail, label: "Email", color: "text-purple-600", bgColor: "bg-purple-100 dark:bg-purple-900/40" },
  meeting: { icon: Users, label: "Meeting", color: "text-amber-600", bgColor: "bg-amber-100 dark:bg-amber-900/40" },
  stage_change: { icon: ArrowRight, label: "Stage Change", color: "text-cyan-600", bgColor: "bg-cyan-100 dark:bg-cyan-900/40" },
  task: { icon: FileText, label: "Task", color: "text-orange-600", bgColor: "bg-orange-100 dark:bg-orange-900/40" },
  document: { icon: Paperclip, label: "Document", color: "text-slate-600", bgColor: "bg-slate-100 dark:bg-slate-900/40" },
};

const COMPOSER_TYPES = [
  { value: "note" as const, label: "Note", icon: Edit3, shortcut: "N" },
  { value: "call" as const, label: "Call", icon: Phone, shortcut: "C" },
  { value: "email" as const, label: "Email", icon: Mail, shortcut: "E" },
  { value: "meeting" as const, label: "Meeting", icon: Users, shortcut: "M" },
];

// ─── Component ────────────────────────────────────────────────────

export function DealActivityTimeline({ 
  dealId, 
  entityType = "deal",
  maxHeight = "400px",
  showComposer = true 
}: DealActivityTimelineProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeFilter, setActiveFilter] = useState<ActivityType>("all");
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerType, setComposerType] = useState<"note" | "call" | "email" | "meeting">("note");
  const [composerContent, setComposerContent] = useState("");
  const [composerSubject, setComposerSubject] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [fullComposerOpen, setFullComposerOpen] = useState(false);

  // Fetch timeline
  const { data: timelineData, isLoading } = useQuery<TimelineEvent[]>({
    queryKey: [`/api/crm/timeline/${entityType}/${dealId}`],
    enabled: !!dealId,
  });

  // Also fetch notes as fallback
  const { data: notesData } = useQuery<any[]>({
    queryKey: [`/api/crm/notes?entityType=${entityType}&entityId=${dealId}`],
    enabled: !!dealId,
  });

  // Also fetch activities
  const { data: activitiesData } = useQuery<any[]>({
    queryKey: [`/api/crm/activities?entityType=deal&entityId=${dealId}`],
    enabled: !!dealId,
  });

  // Merge and sort all events
  const events = useMemo<TimelineEvent[]>(() => {
    const merged: TimelineEvent[] = [];

    // Timeline events
    if (Array.isArray(timelineData)) {
      merged.push(...timelineData.map(e => ({
        ...e,
        type: e.type || "note" as ActivityType,
      })));
    }

    // Notes as fallback
    if (Array.isArray(notesData)) {
      notesData.forEach(note => {
        if (!merged.find(m => m.id === note.id || m.id === `note-${note.id}`)) {
          merged.push({
            id: `note-${note.id}`,
            type: "note",
            title: "Note added",
            description: note.content || note.body,
            createdAt: note.createdAt,
            createdBy: note.createdBy,
          });
        }
      });
    }

    // Activities as fallback
    if (Array.isArray(activitiesData)) {
      activitiesData.forEach(act => {
        if (!merged.find(m => m.id === act.id || m.id === `act-${act.id}`)) {
          merged.push({
            id: `act-${act.id}`,
            type: (act.type || act.activityType || "note") as ActivityType,
            title: act.title || act.subject || `${act.type || "Activity"} logged`,
            description: act.description || act.notes || act.body,
            createdAt: act.createdAt || act.activityDate,
            createdBy: act.createdBy || act.userId,
            metadata: act.metadata || { duration: act.duration, outcome: act.outcome },
          });
        }
      });
    }

    // Sort newest first
    return merged.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [timelineData, notesData, activitiesData]);

  const filteredEvents = activeFilter === "all" 
    ? events 
    : events.filter(e => e.type === activeFilter);

  // Add note mutation
  const addNoteMutation = useMutation({
    mutationFn: async (data: { type: string; content: string; subject?: string }) => {
      // Try the activities endpoint first, then notes as fallback
      try {
        const response = await apiRequest("POST", `/api/crm/activities`, {
          entityType: "deal",
          entityId: String(dealId),
          activityType: data.type,
          type: data.type,
          title: data.subject || `${data.type} logged`,
          subject: data.subject,
          description: data.content,
          notes: data.content,
          body: data.content,
        });
        return response.json();
      } catch {
        // Fallback to notes endpoint
        const response = await apiRequest("POST", `/api/crm/notes`, {
          entityType: "deal",
          entityId: String(dealId),
          content: data.content,
          type: data.type,
        });
        return response.json();
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/crm/timeline/${entityType}/${dealId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/crm/notes`] });
      queryClient.invalidateQueries({ queryKey: [`/api/crm/activities`] });
      setComposerContent("");
      setComposerSubject("");
      setComposerOpen(false);
      toast({ title: "Activity Logged", description: `${composerType} has been recorded.` });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleSubmitActivity = () => {
    if (!composerContent.trim()) return;
    addNoteMutation.mutate({
      type: composerType,
      content: composerContent.trim(),
      subject: composerSubject.trim() || undefined,
    });
  };

  // ─── Render ─────────────────────────────────────────────────────

  return (
    <div className="space-y-3">
      {/* Header + Filter */}
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-foreground">Activity</h4>
        <div className="flex items-center gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 text-xs gap-1">
                <Filter className="h-3 w-3" />
                {activeFilter === "all" ? "All" : ACTIVITY_TYPES[activeFilter]?.label}
                <ChevronDown className="h-2.5 w-2.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-36">
              <DropdownMenuItem onClick={() => setActiveFilter("all")}>
                All Activities
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {Object.entries(ACTIVITY_TYPES).map(([key, cfg]) => {
                const Icon = cfg.icon;
                return (
                  <DropdownMenuItem key={key} onClick={() => setActiveFilter(key as ActivityType)} className="gap-2">
                    <Icon className={cn("h-3.5 w-3.5", cfg.color)} />
                    {cfg.label}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>

          {showComposer && !composerOpen && (
            <>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs gap-1"
                onClick={() => {
                  setComposerOpen(true);
                  setTimeout(() => textareaRef.current?.focus(), 100);
                }}
              >
                <Plus className="h-3 w-3" />
                Quick Log
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs gap-1"
                onClick={() => setFullComposerOpen(true)}
              >
                Detailed
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Inline Composer */}
      {composerOpen && (
        <div className="border rounded-lg p-3 space-y-2 bg-muted/30">
          {/* Type Selector */}
          <div className="flex items-center gap-1">
            {COMPOSER_TYPES.map(ct => {
              const Icon = ct.icon;
              return (
                <Button
                  key={ct.value}
                  size="sm"
                  variant={composerType === ct.value ? "default" : "ghost"}
                  className={cn("h-7 text-xs gap-1", composerType === ct.value && "shadow-sm")}
                  onClick={() => setComposerType(ct.value)}
                >
                  <Icon className="h-3 w-3" />
                  {ct.label}
                </Button>
              );
            })}
            <div className="flex-1" />
            <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => setComposerOpen(false)}>
              <X className="h-3 w-3" />
            </Button>
          </div>

          {/* Subject (for emails/meetings) */}
          {(composerType === "email" || composerType === "meeting") && (
            <Input
              placeholder={composerType === "email" ? "Subject line..." : "Meeting topic..."}
              value={composerSubject}
              onChange={(e) => setComposerSubject(e.target.value)}
              className="h-8 text-sm"
            />
          )}

          {/* Content */}
          <Textarea
            ref={textareaRef}
            placeholder={
              composerType === "note" ? "Add a note..." :
              composerType === "call" ? "Call summary..." :
              composerType === "email" ? "Email content..." :
              "Meeting notes..."
            }
            value={composerContent}
            onChange={(e) => setComposerContent(e.target.value)}
            className="min-h-[60px] text-sm resize-none"
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                handleSubmitActivity();
              }
            }}
          />

          {/* Actions */}
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground">⌘+Enter to submit</span>
            <Button
              size="sm"
              className="h-7 text-xs gap-1"
              onClick={handleSubmitActivity}
              disabled={!composerContent.trim() || addNoteMutation.isPending}
            >
              {addNoteMutation.isPending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <>
                  <Send className="h-3 w-3" />
                  Log {COMPOSER_TYPES.find(c => c.value === composerType)?.label}
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Timeline */}
      <ScrollArea style={{ maxHeight }} className="pr-2">
        {isLoading ? (
          <TimelineSkeleton />
        ) : filteredEvents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Clock className="h-8 w-8 text-muted-foreground/30 mb-2" />
            <p className="text-sm text-muted-foreground">No activity yet</p>
            <p className="text-xs text-muted-foreground/60 mt-0.5">
              {showComposer ? "Log a call, note, or meeting to get started." : "Activities will appear here as they happen."}
            </p>
          </div>
        ) : (
          <div className="relative">
            {/* Vertical line */}
            <div className="absolute left-[15px] top-2 bottom-2 w-px bg-border" />

            <div className="space-y-0">
              {filteredEvents.map((event, index) => (
                <TimelineItem key={event.id} event={event} isLast={index === filteredEvents.length - 1} />
              ))}
            </div>
          </div>
        )}
      </ScrollArea>

      {/* Full Activity Composer Modal */}
      <ActivityComposerModal
        open={fullComposerOpen}
        onOpenChange={setFullComposerOpen}
        entityType={entityType}
        entityId={String(dealId)}
        defaultType={composerType}
      />
    </div>
  );
}

// ─── Timeline Item ────────────────────────────────────────────────

function TimelineItem({ event, isLast }: { event: TimelineEvent; isLast: boolean }) {
  const typeConfig = ACTIVITY_TYPES[event.type] || ACTIVITY_TYPES.note;
  const Icon = typeConfig.icon;

  return (
    <TooltipProvider>
      <div className={cn("flex gap-3 pb-4 group", isLast && "pb-0")}>
        {/* Icon */}
        <div className={cn(
          "relative z-10 flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center",
          typeConfig.bgColor
        )}>
          <Icon className={cn("h-3.5 w-3.5", typeConfig.color)} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 pt-0.5">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground leading-tight">
                {event.title}
              </p>
              {event.description && (
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">
                  {event.description}
                </p>
              )}
              {/* Metadata badges */}
              {event.metadata && (
                <div className="flex items-center gap-1.5 mt-1">
                  {event.metadata.duration && (
                    <Badge variant="outline" className="text-[10px] h-4 px-1.5">
                      <Clock className="h-2.5 w-2.5 mr-0.5" />
                      {event.metadata.duration}m
                    </Badge>
                  )}
                  {event.metadata.outcome && (
                    <Badge variant="outline" className="text-[10px] h-4 px-1.5 capitalize">
                      {event.metadata.outcome}
                    </Badge>
                  )}
                  {event.metadata.fromStage && event.metadata.toStage && (
                    <Badge variant="outline" className="text-[10px] h-4 px-1.5">
                      {event.metadata.fromStage} → {event.metadata.toStage}
                    </Badge>
                  )}
                </div>
              )}
            </div>

            <Tooltip>
              <TooltipTrigger asChild>
                <span className="text-[10px] text-muted-foreground whitespace-nowrap flex-shrink-0 mt-0.5">
                  {formatRelativeTime(event.createdAt)}
                </span>
              </TooltipTrigger>
              <TooltipContent side="left" className="text-xs">
                {event.createdAt ? format(new Date(event.createdAt), "MMM d, yyyy 'at' h:mm a") : "Unknown"}
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────

function TimelineSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map(i => (
        <div key={i} className="flex gap-3">
          <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Utilities ────────────────────────────────────────────────────

function formatRelativeTime(dateStr: string): string {
  if (!dateStr) return "";
  try {
    return formatDistanceToNow(new Date(dateStr), { addSuffix: true });
  } catch {
    return "";
  }
}

export default DealActivityTimeline;