import { useState } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <StickyNote className="h-5 w-5 text-yellow-500" />
            Add Note
          </DialogTitle>
          <DialogDescription>
            Add a note to {entityName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
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

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => createNoteMutation.mutate()}
            disabled={!content.trim() || createNoteMutation.isPending}
            data-testid="button-save-note"
          >
            {createNoteMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              "Add Note"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<string>("medium");
  const [dueDate, setDueDate] = useState<Date | undefined>();
  const [linkToProspecting, setLinkToProspecting] = useState(false);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const createTaskMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/crm/tasks", {
        title,
        description,
        priority,
        dueDate: dueDate?.toISOString(),
        entityType,
        entityId,
        linkedCompanyId,
        linkToProspecting,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/tasks"] });
      queryClient.invalidateQueries({ queryKey: [`/api/crm/timeline/${entityType}/${entityId}`] });
      toast({ title: "Task created successfully" });
      setTitle("");
      setDescription("");
      setPriority("medium");
      setDueDate(undefined);
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
    if (entityType === "contact") {
      setLocation(`/crm/prospecting?contactId=${entityId}`);
    } else if (entityType === "company") {
      setLocation(`/crm/prospecting?companyId=${entityId}`);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckSquare className="h-5 w-5 text-blue-500" />
            Create Task
          </DialogTitle>
          <DialogDescription>
            Create a task related to {entityName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
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

          <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
            <div className="flex items-center gap-2">
              <ExternalLink className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">Go to Prospecting</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleGoToProspecting}
              data-testid="button-go-prospecting"
            >
              Open
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => createTaskMutation.mutate()}
            disabled={!title.trim() || createTaskMutation.isPending}
            data-testid="button-create-task"
          >
            {createTaskMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              "Create Task"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5 text-green-500" />
            Log Call
          </DialogTitle>
          <DialogDescription>
            Log a call with {entityName}
            {phone && (
              <span className="block text-sm mt-1">
                <Phone className="h-3 w-3 inline mr-1" />
                {phone}
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
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

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => logCallMutation.mutate()}
            disabled={!outcome || logCallMutation.isPending}
            data-testid="button-log-call"
          >
            {logCallMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Logging...
              </>
            ) : (
              "Log Call"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-purple-500" />
            Email Options
          </DialogTitle>
          <DialogDescription>
            Choose how to email {entityName}
            {email && (
              <span className="block text-sm mt-1 text-primary">
                {email}
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-4">
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

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
