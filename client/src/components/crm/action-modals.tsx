import { useState } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { StandardDialogShell } from "@/components/ui/standard-dialog-shell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Phone,
  Mail,
  StickyNote,
  CheckSquare,
  Building2,
  User,
  Calendar as CalendarIcon,
  Clock,
  ExternalLink,
  Send,
  PhoneIncoming,
  PhoneOutgoing,
  Loader2,
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface ActionModalsProps {
  entityType: "contact" | "company" | "deal" | "property";
  entityId: string;
  entityName: string;
  linkedCompanyId?: string;
  linkedCompanyName?: string;
  linkedContactIds?: string[];
  email?: string;
}

interface NoteModalProps extends ActionModalsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface TaskModalProps extends ActionModalsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface CallModalProps extends ActionModalsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  phone?: string;
}

interface EmailModalProps extends ActionModalsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NoteModal({
  open,
  onOpenChange,
  entityType,
  entityId,
  entityName,
  linkedCompanyId,
  linkedCompanyName,
}: NoteModalProps) {
  const [content, setContent] = useState("");
  const [isPinned, setIsPinned] = useState(false);
  const [saveToCompany, setSaveToCompany] = useState(true);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const createNoteMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/crm/notes", {
        content,
        entityType,
        entityId,
        isPinned,
        linkedCompanyId: saveToCompany && linkedCompanyId ? linkedCompanyId : undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/crm/timeline/${entityType}/${entityId}`] });
      if (linkedCompanyId && saveToCompany) {
        queryClient.invalidateQueries({ queryKey: [`/api/crm/timeline/company/${linkedCompanyId}`] });
      }
      toast({ title: "Note added successfully" });
      setContent("");
      setIsPinned(false);
      onOpenChange(false);
    },
    onError: () => {
      toast({
        title: "Failed to add note",
        variant: "destructive",
      });
    },
  });

  return (
    <StandardDialogShell
      open={open}
      onOpenChange={onOpenChange}
      title="Add Note"
      description={`Add a note to ${entityName}`}
      icon={StickyNote}
      size="md"
      primaryAction={{
        label: "Add Note",
        onClick: () => createNoteMutation.mutate(),
        disabled: !content.trim(),
        loading: createNoteMutation.isPending,
      }}
      secondaryAction={{
        label: "Cancel",
        onClick: () => onOpenChange(false),
      }}
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="note-content">Note Content</Label>
          <Textarea
            id="note-content"
            placeholder="Write your note here..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={5}
            data-testid="input-note-content"
          />
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="pin-note"
            checked={isPinned}
            onCheckedChange={(checked) => setIsPinned(checked as boolean)}
          />
          <Label htmlFor="pin-note" className="text-sm font-normal cursor-pointer">
            Pin this note to the top
          </Label>
        </div>

        {entityType === "contact" && linkedCompanyId && linkedCompanyName && (
          <div className="flex items-center space-x-2 p-3 bg-muted rounded-lg">
            <Checkbox
              id="save-to-company"
              checked={saveToCompany}
              onCheckedChange={(checked) => setSaveToCompany(checked as boolean)}
            />
            <Label htmlFor="save-to-company" className="text-sm font-normal cursor-pointer flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Also save to {linkedCompanyName}
            </Label>
          </div>
        )}
      </div>
    </StandardDialogShell>
  );
}

export function TaskModal({
  open,
  onOpenChange,
  entityType,
  entityId,
  entityName,
  linkedCompanyId,
  linkedCompanyName,
}: TaskModalProps) {
  const [title, setTitle] = useState("");
  const [taskType, setTaskType] = useState<string>("follow_up");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<string>("medium");
  const [dueDate, setDueDate] = useState<Date | undefined>();
  const [dueTime, setDueTime] = useState<string>("09:00");
  const [linkToProspecting, setLinkToProspecting] = useState(true);
  const [addToCalendar, setAddToCalendar] = useState(true);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Task types for marina/CRM workflows
  const taskTypes = [
    { value: "follow_up", label: "Follow Up" },
    { value: "call", label: "Call" },
    { value: "email", label: "Email" },
    { value: "meeting", label: "Meeting" },
    { value: "site_visit", label: "Site Visit" },
    { value: "due_diligence", label: "Due Diligence" },
    { value: "document_review", label: "Document Review" },
    { value: "proposal", label: "Send Proposal" },
    { value: "contract", label: "Contract/Agreement" },
    { value: "closing", label: "Closing Task" },
    { value: "research", label: "Research" },
    { value: "outreach", label: "Outreach" },
    { value: "reminder", label: "Reminder" },
    { value: "other", label: "Other" },
  ];

  const createTaskMutation = useMutation({
    mutationFn: async () => {
      // Combine date and time for the due date
      let fullDueDate: string | undefined;
      if (dueDate) {
        const [hours, minutes] = dueTime.split(':').map(Number);
        const combinedDate = new Date(dueDate);
        combinedDate.setHours(hours, minutes, 0, 0);
        fullDueDate = combinedDate.toISOString();
      }

      // Create the task
      const task = await apiRequest("POST", "/api/crm/tasks", {
        title,
        taskType,
        description,
        priority,
        dueDate: fullDueDate,
        entityType,
        entityId,
        linkedCompanyId,
        linkToProspecting,
        addToCalendar,
      });

      // If due date is set, also create activity log entry
      if (fullDueDate) {
        await apiRequest("POST", "/api/crm/activities", {
          type: "task_created",
          subject: `Task scheduled: ${title}`,
          description: `${taskTypes.find(t => t.value === taskType)?.label || 'Task'} scheduled for ${format(new Date(fullDueDate), "PPP 'at' p")}`,
          entityType,
          entityId,
          metadata: {
            taskType,
            priority,
            dueDate: fullDueDate,
            linkedToProspecting: linkToProspecting,
            addedToCalendar: addToCalendar,
          },
        });
      }

      return task;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/tasks"] });
      queryClient.invalidateQueries({ queryKey: [`/api/crm/timeline/${entityType}/${entityId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/activities"] });
      if (linkToProspecting) {
        queryClient.invalidateQueries({ queryKey: ["/api/prospecting"] });
      }
      if (addToCalendar) {
        queryClient.invalidateQueries({ queryKey: ["/api/calendar"] });
      }

      const successMessage = dueDate 
        ? `Task created and ${addToCalendar ? 'added to calendar' : 'scheduled'}` 
        : "Task created successfully";
      toast({ title: successMessage });

      // Reset form
      setTitle("");
      setTaskType("follow_up");
      setDescription("");
      setPriority("medium");
      setDueDate(undefined);
      setDueTime("09:00");
      onOpenChange(false);
    },
    onError: () => {
      toast({
        title: "Failed to create task",
        variant: "destructive",
      });
    },
  });

  const handleGoToProspecting = () => {
    onOpenChange(false);
    // Navigate to prospecting with context
    const params = new URLSearchParams();
    if (entityType === "contact") {
      params.set("contactId", entityId);
    } else if (entityType === "company") {
      params.set("companyId", entityId);
    } else if (entityType === "property") {
      params.set("propertyId", entityId);
    }
    setLocation(`/prospecting?${params.toString()}`);
  };

  return (
    <StandardDialogShell
      open={open}
      onOpenChange={onOpenChange}
      title="Create Task"
      description={`Create a task related to ${entityName}`}
      icon={CheckSquare}
      size="md"
      primaryAction={{
        label: "Create Task",
        onClick: () => createTaskMutation.mutate(),
        disabled: !title.trim(),
        loading: createTaskMutation.isPending,
      }}
      secondaryAction={{
        label: "Cancel",
        onClick: () => onOpenChange(false),
      }}
    >
      <div className="space-y-4">
        {/* Task Title */}
        <div className="space-y-2">
          <Label htmlFor="task-title">Task Title</Label>
          <Input
            id="task-title"
            placeholder="Enter task title..."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            data-testid="input-task-title"
          />
        </div>

        {/* Task Type - NEW */}
        <div className="space-y-2">
          <Label>Task Type</Label>
          <Select value={taskType} onValueChange={setTaskType}>
            <SelectTrigger data-testid="select-task-type">
              <SelectValue placeholder="Select task type" />
            </SelectTrigger>
            <SelectContent>
              {taskTypes.map((type) => (
                <SelectItem key={type.value} value={type.value}>
                  {type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Description */}
        <div className="space-y-2">
          <Label htmlFor="task-description">Description (optional)</Label>
          <Textarea
            id="task-description"
            placeholder="Add details about this task..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            data-testid="input-task-description"
          />
        </div>

        {/* Priority and Due Date */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Priority</Label>
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger data-testid="select-priority">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Due Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-start text-left font-normal"
                  data-testid="button-due-date"
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dueDate ? format(dueDate, "PPP") : "Pick a date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={dueDate}
                  onSelect={setDueDate}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* Time selector - shows when due date is selected */}
        {dueDate && (
          <div className="space-y-2">
            <Label>Time</Label>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <Input
                type="time"
                value={dueTime}
                onChange={(e) => setDueTime(e.target.value)}
                className="w-32"
                data-testid="input-due-time"
              />
            </div>
          </div>
        )}

        {/* Sync Options - show when due date is selected */}
        {dueDate && (
          <div className="space-y-3 p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg">
            <p className="text-sm font-medium text-blue-700 dark:text-blue-300">
              Auto-sync options
            </p>
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="add-to-calendar"
                  checked={addToCalendar}
                  onCheckedChange={(checked) => setAddToCalendar(checked as boolean)}
                />
                <Label htmlFor="add-to-calendar" className="text-sm font-normal cursor-pointer flex items-center gap-2">
                  <CalendarIcon className="h-4 w-4" />
                  Add to Calendar
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="link-to-prospecting"
                  checked={linkToProspecting}
                  onCheckedChange={(checked) => setLinkToProspecting(checked as boolean)}
                />
                <Label htmlFor="link-to-prospecting" className="text-sm font-normal cursor-pointer flex items-center gap-2">
                  <ExternalLink className="h-4 w-4" />
                  Sync to Prospecting
                </Label>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Task will also be logged to Activity Timeline
            </p>
          </div>
        )}

        {/* Linked Entities */}
        <div className="space-y-2">
          <Label className="text-sm text-muted-foreground">Linked Entities</Label>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary" className="flex items-center gap-1">
              <User className="h-3 w-3" />
              {entityName}
            </Badge>
            {linkedCompanyName && (
              <Badge variant="secondary" className="flex items-center gap-1">
                <Building2 className="h-3 w-3" />
                {linkedCompanyName}
              </Badge>
            )}
          </div>
        </div>

        {/* Go to Prospecting - Centered Button */}
        <div className="flex justify-center pt-2">
          <Button
            variant="outline"
            onClick={handleGoToProspecting}
            className="flex items-center gap-2"
            data-testid="button-go-prospecting"
          >
            <ExternalLink className="h-4 w-4" />
            Go to Prospecting
          </Button>
        </div>
      </div>
    </StandardDialogShell>
  );
}

export function CallModal({
  open,
  onOpenChange,
  entityType,
  entityId,
  entityName,
  phone,
}: CallModalProps) {
  const [direction, setDirection] = useState<string>("outbound");
  const [outcome, setOutcome] = useState<string>("");
  const [duration, setDuration] = useState<number>(0);
  const [notes, setNotes] = useState("");
  const [createFollowUp, setCreateFollowUp] = useState(false);
  const [followUpDate, setFollowUpDate] = useState<Date | undefined>();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const logCallMutation = useMutation({
    mutationFn: async () => {
      const activity = await apiRequest("POST", "/api/crm/activities", {
        type: "call",
        subject: `Call with ${entityName}`,
        description: notes || `${direction === "outbound" ? "Outgoing" : "Incoming"} call`,
        direction,
        outcome,
        duration,
        status: "completed",
        entityType,
        entityId,
        completedAt: new Date().toISOString(),
        metadata: { phone },
      });

      if (createFollowUp && followUpDate) {
        await apiRequest("POST", "/api/crm/tasks", {
          title: `Follow-up: Call with ${entityName}`,
          description: notes ? `Follow-up from call: ${notes}` : "Follow-up from previous call",
          priority: "medium",
          dueDate: followUpDate.toISOString(),
          entityType,
          entityId,
        });
      }

      return activity;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/crm/timeline/${entityType}/${entityId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/activities"] });
      if (createFollowUp) {
        queryClient.invalidateQueries({ queryKey: ["/api/crm/tasks"] });
      }
      toast({ title: "Call logged successfully" });
      resetForm();
      onOpenChange(false);
    },
    onError: () => {
      toast({
        title: "Failed to log call",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setDirection("outbound");
    setOutcome("");
    setDuration(0);
    setNotes("");
    setCreateFollowUp(false);
    setFollowUpDate(undefined);
  };

  const descriptionText = phone 
    ? `Log a call with ${entityName} (${phone})`
    : `Log a call with ${entityName}`;

  return (
    <StandardDialogShell
      open={open}
      onOpenChange={onOpenChange}
      title="Log Call"
      description={descriptionText}
      icon={Phone}
      size="md"
      primaryAction={{
        label: "Log Call",
        onClick: () => logCallMutation.mutate(),
        disabled: !outcome,
        loading: logCallMutation.isPending,
      }}
      secondaryAction={{
        label: "Cancel",
        onClick: () => onOpenChange(false),
      }}
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Direction</Label>
            <Select value={direction} onValueChange={setDirection}>
              <SelectTrigger data-testid="select-call-direction">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="outbound">
                  <div className="flex items-center gap-2">
                    <PhoneOutgoing className="h-4 w-4" />
                    Outgoing
                  </div>
                </SelectItem>
                <SelectItem value="inbound">
                  <div className="flex items-center gap-2">
                    <PhoneIncoming className="h-4 w-4" />
                    Incoming
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Duration (minutes)</Label>
            <Input
              type="number"
              min={0}
              value={duration}
              onChange={(e) => setDuration(parseInt(e.target.value) || 0)}
              data-testid="input-call-duration"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Outcome</Label>
          <Select value={outcome} onValueChange={setOutcome}>
            <SelectTrigger data-testid="select-call-outcome">
              <SelectValue placeholder="Select outcome" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="connected">Connected</SelectItem>
              <SelectItem value="left_voicemail">Left Voicemail</SelectItem>
              <SelectItem value="no_answer">No Answer</SelectItem>
              <SelectItem value="busy">Busy</SelectItem>
              <SelectItem value="wrong_number">Wrong Number</SelectItem>
              <SelectItem value="scheduled_callback">Scheduled Callback</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="call-notes">Notes (optional)</Label>
          <Textarea
            id="call-notes"
            placeholder="Add notes about this call..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            data-testid="input-call-notes"
          />
        </div>

        <div className="space-y-3 p-3 bg-muted rounded-lg">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="create-followup"
              checked={createFollowUp}
              onCheckedChange={(checked) => setCreateFollowUp(checked as boolean)}
            />
            <Label htmlFor="create-followup" className="text-sm font-normal cursor-pointer">
              Create follow-up task
            </Label>
          </div>

          {createFollowUp && (
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-start text-left font-normal"
                  data-testid="button-followup-date"
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {followUpDate ? format(followUpDate, "PPP") : "Pick follow-up date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={followUpDate}
                  onSelect={setFollowUpDate}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          )}
        </div>
      </div>
    </StandardDialogShell>
  );
}

export function EmailRedirectModal({
  open,
  onOpenChange,
  entityType,
  entityId,
  entityName,
  email,
}: EmailModalProps) {
  const [, setLocation] = useLocation();

  const handleGoToMarketing = () => {
    onOpenChange(false);
    const params = new URLSearchParams();
    if (entityType === "contact") {
      params.set("contactId", entityId);
    } else if (entityType === "company") {
      params.set("companyId", entityId);
    }
    if (email) {
      params.set("email", email);
    }
    setLocation(`/operations/marketing?${params.toString()}`);
  };

  const handleComposeEmail = () => {
    if (email) {
      window.open(`mailto:${email}`, "_blank");
    }
  };

  const descriptionText = email 
    ? `Choose how to email ${entityName} (${email})`
    : `Choose how to email ${entityName}`;

  return (
    <StandardDialogShell
      open={open}
      onOpenChange={onOpenChange}
      title="Email Options"
      description={descriptionText}
      icon={Mail}
      size="sm"
      secondaryAction={{
        label: "Cancel",
        onClick: () => onOpenChange(false),
      }}
    >
      <div className="space-y-3">
        <Button
          variant="outline"
          className="w-full justify-start h-auto py-4"
          onClick={handleGoToMarketing}
          data-testid="button-go-marketing"
        >
          <div className="flex items-start gap-3">
            <Send className="h-5 w-5 mt-0.5 text-primary" />
            <div className="text-left">
              <div className="font-medium">Marketing Module</div>
              <div className="text-sm text-muted-foreground">
                Create campaigns, sequences, and track engagement
              </div>
            </div>
          </div>
        </Button>

        {email && (
          <Button
            variant="outline"
            className="w-full justify-start h-auto py-4"
            onClick={handleComposeEmail}
            data-testid="button-compose-email"
          >
            <div className="flex items-start gap-3">
              <Mail className="h-5 w-5 mt-0.5 text-muted-foreground" />
              <div className="text-left">
                <div className="font-medium">Quick Email</div>
                <div className="text-sm text-muted-foreground">
                  Open in your default email client
                </div>
              </div>
            </div>
          </Button>
        )}
      </div>
    </StandardDialogShell>
  );
}
