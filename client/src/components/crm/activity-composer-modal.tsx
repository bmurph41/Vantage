/**
 * ActivityComposerModal
 * 
 * Full-featured activity logging modal with per-type fields:
 *   - Note: rich text body, pinnable
 *   - Call: duration, outcome, follow-up toggle
 *   - Email: subject, body, direction (sent/received)
 *   - Meeting: attendees, location, duration, outcome
 *   - Task: due date, assignee, priority, status
 * 
 * Replaces: NoteModal, TaskModal, CallModal, EmailRedirectModal
 * 
 * Usage:
 *   <ActivityComposerModal
 *     open={open}
 *     onOpenChange={setOpen}
 *     entityType="deal"
 *     entityId={dealId}
 *     entityName="Harborview Marina"
 *     defaultType="call"
 *   />
 */

import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  StickyNote, Phone, Mail, Users, CheckSquare,
  Loader2, Calendar, Clock, MapPin, User, Flag,
  ArrowUp, ArrowDown, Minus, Send, Inbox,
  Pin, AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Contact } from "@shared/schema";

// ─── Types ────────────────────────────────────────────────────────

type ActivityType = "note" | "call" | "email" | "meeting" | "task";

interface ActivityComposerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityType: "deal" | "contact" | "company" | "property";
  entityId: string;
  entityName?: string;
  defaultType?: ActivityType;
  linkedCompanyId?: string;
  linkedCompanyName?: string;
}

const ACTIVITY_TYPES: { value: ActivityType; label: string; icon: typeof StickyNote; color: string }[] = [
  { value: "note", label: "Note", icon: StickyNote, color: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300" },
  { value: "call", label: "Call", icon: Phone, color: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" },
  { value: "email", label: "Email", icon: Mail, color: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300" },
  { value: "meeting", label: "Meeting", icon: Users, color: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300" },
  { value: "task", label: "Task", icon: CheckSquare, color: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900 dark:text-cyan-300" },
];

const CALL_OUTCOMES = [
  { value: "connected", label: "Connected" },
  { value: "voicemail", label: "Left Voicemail" },
  { value: "no_answer", label: "No Answer" },
  { value: "busy", label: "Busy" },
  { value: "wrong_number", label: "Wrong Number" },
];

const MEETING_OUTCOMES = [
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
  { value: "rescheduled", label: "Rescheduled" },
  { value: "no_show", label: "No Show" },
];

const TASK_PRIORITIES = [
  { value: "low", label: "Low", icon: ArrowDown, color: "text-blue-500" },
  { value: "medium", label: "Medium", icon: Minus, color: "text-amber-500" },
  { value: "high", label: "High", icon: ArrowUp, color: "text-red-500" },
];

// ─── Component ────────────────────────────────────────────────────

export function ActivityComposerModal({
  open, onOpenChange, entityType, entityId, entityName,
  defaultType = "note", linkedCompanyId, linkedCompanyName,
}: ActivityComposerModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [activityType, setActivityType] = useState<ActivityType>(defaultType);
  const [body, setBody] = useState("");
  const [subject, setSubject] = useState("");
  const [isPinned, setIsPinned] = useState(false);

  // Call fields
  const [callDuration, setCallDuration] = useState("");
  const [callOutcome, setCallOutcome] = useState("");
  const [createFollowUp, setCreateFollowUp] = useState(false);
  const [followUpDate, setFollowUpDate] = useState("");

  // Email fields
  const [emailDirection, setEmailDirection] = useState<"sent" | "received">("sent");

  // Meeting fields
  const [meetingLocation, setMeetingLocation] = useState("");
  const [meetingDuration, setMeetingDuration] = useState("60");
  const [meetingOutcome, setMeetingOutcome] = useState("");
  const [meetingDate, setMeetingDate] = useState("");
  const [attendees, setAttendees] = useState("");

  // Task fields
  const [taskDueDate, setTaskDueDate] = useState("");
  const [taskPriority, setTaskPriority] = useState("medium");
  const [taskAssignee, setTaskAssignee] = useState("");
  const [taskStatus, setTaskStatus] = useState("pending");

  // Reset on open/type change
  useEffect(() => {
    if (open) {
      setActivityType(defaultType);
      resetFields();
    }
  }, [open]);

  const resetFields = () => {
    setBody("");
    setSubject("");
    setIsPinned(false);
    setCallDuration("");
    setCallOutcome("");
    setCreateFollowUp(false);
    setFollowUpDate("");
    setEmailDirection("sent");
    setMeetingLocation("");
    setMeetingDuration("60");
    setMeetingOutcome("");
    setMeetingDate("");
    setAttendees("");
    setTaskDueDate("");
    setTaskPriority("medium");
    setTaskAssignee("");
    setTaskStatus("pending");
  };

  // Fetch contacts for assignee
  const { data: contacts = [] } = useQuery<Contact[]>({
    queryKey: ["/api/contacts"],
    enabled: open && activityType === "task",
  });

  // ─── Submit ─────────────────────────────────────────────────────

  const submitMutation = useMutation({
    mutationFn: async () => {
      const payload: Record<string, any> = {
        entityType,
        entityId,
        type: activityType,
        content: body,
        subject: subject || undefined,
        isPinned,
        metadata: {},
      };

      // Add linked company if available
      if (linkedCompanyId) {
        payload.linkedCompanyId = linkedCompanyId;
      }

      // Type-specific metadata
      switch (activityType) {
        case "call":
          payload.metadata = {
            duration: callDuration ? parseInt(callDuration) : undefined,
            outcome: callOutcome || undefined,
          };
          break;
        case "email":
          payload.metadata = {
            direction: emailDirection,
            subject: subject || undefined,
          };
          break;
        case "meeting":
          payload.metadata = {
            location: meetingLocation || undefined,
            duration: meetingDuration ? parseInt(meetingDuration) : undefined,
            outcome: meetingOutcome || undefined,
            scheduledAt: meetingDate || undefined,
            attendees: attendees ? attendees.split(",").map((a) => a.trim()) : undefined,
          };
          break;
        case "task":
          payload.metadata = {
            dueDate: taskDueDate || undefined,
            priority: taskPriority,
            assignee: taskAssignee || undefined,
            status: taskStatus,
          };
          break;
      }

      // Try primary endpoint, fall back
      try {
        const response = await apiRequest("POST", "/api/crm/activities", payload);
        return response.json();
      } catch {
        // Fallback to notes endpoint for basic logging
        const notePayload = {
          entityType,
          entityId,
          content: `[${activityType.toUpperCase()}] ${subject ? subject + "\n" : ""}${body}`,
          isPinned,
        };
        const response = await apiRequest("POST", "/api/crm/notes", notePayload);
        return response.json();
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/activities"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/timeline"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/notes"] });

      const typeLabel = ACTIVITY_TYPES.find((t) => t.value === activityType)?.label || "Activity";
      toast({ title: `${typeLabel} Logged`, description: entityName ? `Added to ${entityName}` : undefined });

      // Create follow-up task if requested
      if (createFollowUp && followUpDate) {
        createFollowUpTask();
      }

      onOpenChange(false);
      resetFields();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const createFollowUpTask = async () => {
    try {
      await apiRequest("POST", "/api/crm/activities", {
        entityType,
        entityId,
        type: "task",
        content: `Follow up: ${subject || body.slice(0, 50)}`,
        metadata: {
          dueDate: followUpDate,
          priority: "medium",
          status: "pending",
          parentActivityType: activityType,
        },
      });
    } catch {
      // Silent fail — main activity was already logged
    }
  };

  const canSubmit = activityType === "task"
    ? body.trim().length > 0
    : body.trim().length > 0 || subject.trim().length > 0;

  // ─── Render ─────────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px] p-0 flex flex-col max-h-[85vh]">
        <DialogHeader className="px-6 pt-5 pb-3">
          <DialogTitle className="text-base">Log Activity</DialogTitle>
          <DialogDescription className="text-xs">
            {entityName ? `Recording for ${entityName}` : `Add to ${entityType} record`}
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 space-y-4 flex-1 overflow-y-auto pb-2">
          {/* Type Selector */}
          <div className="flex gap-1.5">
            {ACTIVITY_TYPES.map((t) => {
              const Icon = t.icon;
              const isActive = activityType === t.value;
              return (
                <button
                  key={t.value}
                  type="button"
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all border",
                    isActive ? cn(t.color, "border-current/20 ring-1 ring-offset-1") : "bg-muted/30 text-muted-foreground border-transparent hover:bg-muted/60"
                  )}
                  onClick={() => setActivityType(t.value)}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {t.label}
                </button>
              );
            })}
          </div>

          <Separator />

          {/* Subject (for email, meeting) */}
          {(activityType === "email" || activityType === "meeting") && (
            <div className="space-y-1.5">
              <Label className="text-xs">Subject</Label>
              <Input
                placeholder={activityType === "email" ? "Email subject line..." : "Meeting topic..."}
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                autoFocus
              />
            </div>
          )}

          {/* Body */}
          <div className="space-y-1.5">
            <Label className="text-xs">
              {activityType === "task" ? "Task Description" : activityType === "note" ? "Note" : "Details"}
            </Label>
            <Textarea
              placeholder={
                activityType === "note" ? "Write your note..." :
                activityType === "call" ? "Call summary and key takeaways..." :
                activityType === "email" ? "Email body or summary..." :
                activityType === "meeting" ? "Meeting notes and action items..." :
                "Describe the task..."
              }
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={activityType === "note" ? 6 : 4}
              className="resize-none"
              autoFocus={activityType !== "email" && activityType !== "meeting"}
            />
            <p className="text-[10px] text-muted-foreground text-right">
              ⌘+Enter to submit
            </p>
          </div>

          {/* ── Type-Specific Fields ───────────────────────────── */}

          {/* Call Fields */}
          {activityType === "call" && (
            <div className="space-y-3 p-3 rounded-lg bg-green-50/50 dark:bg-green-950/10 border border-green-200/50">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs flex items-center gap-1">
                    <Clock className="h-3 w-3" /> Duration (min)
                  </Label>
                  <Input
                    type="number"
                    placeholder="15"
                    value={callDuration}
                    onChange={(e) => setCallDuration(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs flex items-center gap-1">
                    <Phone className="h-3 w-3" /> Outcome
                  </Label>
                  <Select value={callOutcome} onValueChange={setCallOutcome}>
                    <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                    <SelectContent>
                      {CALL_OUTCOMES.map((o) => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-xs">Schedule follow-up</Label>
                  <p className="text-[10px] text-muted-foreground">Create a task to follow up</p>
                </div>
                <Switch checked={createFollowUp} onCheckedChange={setCreateFollowUp} />
              </div>
              {createFollowUp && (
                <div className="space-y-1.5">
                  <Label className="text-xs flex items-center gap-1">
                    <Calendar className="h-3 w-3" /> Follow-up Date
                  </Label>
                  <Input type="date" value={followUpDate} onChange={(e) => setFollowUpDate(e.target.value)} />
                </div>
              )}
            </div>
          )}

          {/* Email Fields */}
          {activityType === "email" && (
            <div className="space-y-3 p-3 rounded-lg bg-purple-50/50 dark:bg-purple-950/10 border border-purple-200/50">
              <div className="space-y-1.5">
                <Label className="text-xs">Direction</Label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition-all",
                      emailDirection === "sent" ? "bg-purple-100 text-purple-700 border-purple-300" : "bg-muted/30 text-muted-foreground border-transparent"
                    )}
                    onClick={() => setEmailDirection("sent")}
                  >
                    <Send className="h-3 w-3" /> Sent
                  </button>
                  <button
                    type="button"
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition-all",
                      emailDirection === "received" ? "bg-purple-100 text-purple-700 border-purple-300" : "bg-muted/30 text-muted-foreground border-transparent"
                    )}
                    onClick={() => setEmailDirection("received")}
                  >
                    <Inbox className="h-3 w-3" /> Received
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Meeting Fields */}
          {activityType === "meeting" && (
            <div className="space-y-3 p-3 rounded-lg bg-amber-50/50 dark:bg-amber-950/10 border border-amber-200/50">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs flex items-center gap-1">
                    <Calendar className="h-3 w-3" /> Date & Time
                  </Label>
                  <Input type="datetime-local" value={meetingDate} onChange={(e) => setMeetingDate(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs flex items-center gap-1">
                    <Clock className="h-3 w-3" /> Duration (min)
                  </Label>
                  <Select value={meetingDuration} onValueChange={setMeetingDuration}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["15", "30", "45", "60", "90", "120"].map((d) => (
                        <SelectItem key={d} value={d}>{d} min</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs flex items-center gap-1">
                  <MapPin className="h-3 w-3" /> Location
                </Label>
                <Input placeholder="Office, Zoom, marina site..." value={meetingLocation} onChange={(e) => setMeetingLocation(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs flex items-center gap-1">
                  <Users className="h-3 w-3" /> Attendees
                </Label>
                <Input placeholder="Names separated by commas..." value={attendees} onChange={(e) => setAttendees(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Outcome</Label>
                <Select value={meetingOutcome} onValueChange={setMeetingOutcome}>
                  <SelectTrigger><SelectValue placeholder="Select outcome..." /></SelectTrigger>
                  <SelectContent>
                    {MEETING_OUTCOMES.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* Task Fields */}
          {activityType === "task" && (
            <div className="space-y-3 p-3 rounded-lg bg-cyan-50/50 dark:bg-cyan-950/10 border border-cyan-200/50">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs flex items-center gap-1">
                    <Calendar className="h-3 w-3" /> Due Date
                  </Label>
                  <Input type="date" value={taskDueDate} onChange={(e) => setTaskDueDate(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs flex items-center gap-1">
                    <Flag className="h-3 w-3" /> Priority
                  </Label>
                  <Select value={taskPriority} onValueChange={setTaskPriority}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TASK_PRIORITIES.map((p) => {
                        const Icon = p.icon;
                        return (
                          <SelectItem key={p.value} value={p.value}>
                            <span className="flex items-center gap-1.5">
                              <Icon className={cn("h-3 w-3", p.color)} />
                              {p.label}
                            </span>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs flex items-center gap-1">
                  <User className="h-3 w-3" /> Assignee
                </Label>
                <Select value={taskAssignee} onValueChange={setTaskAssignee}>
                  <SelectTrigger><SelectValue placeholder="Assign to..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Unassigned</SelectItem>
                    {contacts.map((c: any) => (
                      <SelectItem key={c.id} value={String(c.id)}>
                        {[c.firstName, c.lastName].filter(Boolean).join(" ") || c.email || "Contact"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* Pin toggle (notes only) */}
          {activityType === "note" && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Pin className="h-3.5 w-3.5 text-muted-foreground" />
                <Label className="text-xs">Pin this note</Label>
              </div>
              <Switch checked={isPinned} onCheckedChange={setIsPinned} />
            </div>
          )}
        </div>

        {/* Footer */}
        <DialogFooter className="px-6 py-4 border-t bg-muted/30">
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-1.5">
              {linkedCompanyName && (
                <Badge variant="outline" className="text-[10px]">
                  Also logged to {linkedCompanyName}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={() => submitMutation.mutate()}
                disabled={!canSubmit || submitMutation.isPending}
              >
                {submitMutation.isPending && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
                {activityType === "task" ? "Create Task" : "Log Activity"}
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ActivityComposerModal;
