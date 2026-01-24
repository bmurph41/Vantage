import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Edit, Trash2, Power, PowerOff, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface DDAutomationRule {
  id: string;
  projectId: string | null;
  orgId: string;
  name: string;
  description: string | null;
  triggerType: string;
  triggerCondition: Record<string, any>;
  actionType: string;
  actionConfig: Record<string, any>;
  assigneeId: string | null;
  templateType: string | null;
  isActive: boolean;
  priority: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

const TRIGGER_TYPES = [
  { value: "project_created", label: "When project is created" },
  { value: "milestone_reached", label: "When milestone is reached" },
  { value: "task_completed", label: "When task is completed" },
  { value: "date_based", label: "On specific date" },
  { value: "status_changed", label: "When status changes" },
  { value: "deadline_approaching", label: "When deadline is approaching" },
];

const ACTION_TYPES = [
  { value: "assign_tasks", label: "Assign tasks to user" },
  { value: "send_notification", label: "Send notification" },
  { value: "update_status", label: "Update task status" },
  { value: "create_task", label: "Create new task" },
];

const TEMPLATE_TYPES = [
  { value: "environmental", label: "Environmental Assessment" },
  { value: "infrastructure", label: "Marina Infrastructure" },
  { value: "permits", label: "Permits & Licensing" },
  { value: "financial", label: "Financial Review" },
  { value: "operations", label: "Operations Assessment" },
];

interface DDAutomationRulesPanelProps {
  projectId?: string;
}

export function DDAutomationRulesPanel({ projectId }: DDAutomationRulesPanelProps) {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<DDAutomationRule | null>(null);
  const { toast } = useToast();

  const { data: rules = [], isLoading } = useQuery<DDAutomationRule[]>({
    queryKey: ["/api/dd/automation/automation-rules", projectId],
  });

  const { data: assignees = [] } = useQuery<User[]>({
    queryKey: ["/api/dd/automation/assignees"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("/api/dd/automation/automation-rules", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/dd/automation/automation-rules"] });
      setIsCreateOpen(false);
      toast({ title: "Rule created successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to create rule", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      return await apiRequest(`/api/dd/automation/automation-rules/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/dd/automation/automation-rules"] });
      setEditingRule(null);
      toast({ title: "Rule updated successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to update rule", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest(`/api/dd/automation/automation-rules/${id}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/dd/automation/automation-rules"] });
      toast({ title: "Rule deleted successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to delete rule", description: error.message, variant: "destructive" });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest(`/api/dd/automation/automation-rules/${id}/toggle`, {
        method: "POST",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/dd/automation/automation-rules"] });
    },
    onError: (error: any) => {
      toast({ title: "Failed to toggle rule", description: error.message, variant: "destructive" });
    },
  });

  const getTriggerLabel = (type: string) => {
    return TRIGGER_TYPES.find(t => t.value === type)?.label || type;
  };

  const getActionLabel = (type: string) => {
    return ACTION_TYPES.find(a => a.value === type)?.label || type;
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Automation Rules
          </CardTitle>
          <CardDescription>
            Set up automatic task assignments and notifications
          </CardDescription>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-1" />
              Add Rule
            </Button>
          </DialogTrigger>
          <RuleFormDialog
            assignees={assignees}
            onSubmit={(data) => createMutation.mutate({ ...data, projectId })}
            isSubmitting={createMutation.isPending}
          />
        </Dialog>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-4 text-muted-foreground">Loading rules...</div>
        ) : rules.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>No automation rules configured yet.</p>
            <p className="text-sm mt-2">Create rules to automatically assign tasks or send notifications.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {rules.map((rule) => (
              <div
                key={rule.id}
                className={`flex items-center justify-between p-3 rounded-lg border ${
                  rule.isActive ? "bg-background" : "bg-muted/50 opacity-60"
                }`}
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{rule.name}</span>
                    {rule.isActive ? (
                      <Badge variant="default" className="text-xs">Active</Badge>
                    ) : (
                      <Badge variant="secondary" className="text-xs">Inactive</Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {getTriggerLabel(rule.triggerType)} → {getActionLabel(rule.actionType)}
                  </p>
                  {rule.description && (
                    <p className="text-xs text-muted-foreground mt-1">{rule.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => toggleMutation.mutate(rule.id)}
                    title={rule.isActive ? "Deactivate" : "Activate"}
                  >
                    {rule.isActive ? (
                      <Power className="h-4 w-4 text-green-500" />
                    ) : (
                      <PowerOff className="h-4 w-4 text-muted-foreground" />
                    )}
                  </Button>
                  <Dialog open={editingRule?.id === rule.id} onOpenChange={(open) => !open && setEditingRule(null)}>
                    <DialogTrigger asChild>
                      <Button variant="ghost" size="icon" onClick={() => setEditingRule(rule)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                    </DialogTrigger>
                    {editingRule && (
                      <RuleFormDialog
                        assignees={assignees}
                        initialData={editingRule}
                        onSubmit={(data) => updateMutation.mutate({ id: editingRule.id, data })}
                        isSubmitting={updateMutation.isPending}
                      />
                    )}
                  </Dialog>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteMutation.mutate(rule.id)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface RuleFormDialogProps {
  assignees: User[];
  initialData?: DDAutomationRule;
  onSubmit: (data: any) => void;
  isSubmitting: boolean;
}

function RuleFormDialog({ assignees, initialData, onSubmit, isSubmitting }: RuleFormDialogProps) {
  const [name, setName] = useState(initialData?.name || "");
  const [description, setDescription] = useState(initialData?.description || "");
  const [triggerType, setTriggerType] = useState(initialData?.triggerType || "project_created");
  const [actionType, setActionType] = useState(initialData?.actionType || "assign_tasks");
  const [assigneeId, setAssigneeId] = useState(initialData?.assigneeId || "");
  const [templateType, setTemplateType] = useState(initialData?.templateType || "");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      name,
      description: description || null,
      triggerType,
      actionType,
      assigneeId: assigneeId || null,
      templateType: templateType || null,
      triggerCondition: templateType ? { templateType } : {},
      actionConfig: assigneeId ? { assigneeId } : {},
    });
  };

  return (
    <DialogContent>
      <form onSubmit={handleSubmit}>
        <DialogHeader>
          <DialogTitle>{initialData ? "Edit Rule" : "Create Automation Rule"}</DialogTitle>
          <DialogDescription>
            Configure when and how tasks should be automatically assigned or notifications sent.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">Rule Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Assign Environmental Tasks to John"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description..."
              rows={2}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>When</Label>
              <Select value={triggerType} onValueChange={setTriggerType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TRIGGER_TYPES.map((trigger) => (
                    <SelectItem key={trigger.value} value={trigger.value}>
                      {trigger.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Then</Label>
              <Select value={actionType} onValueChange={setActionType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ACTION_TYPES.map((action) => (
                    <SelectItem key={action.value} value={action.value}>
                      {action.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {triggerType === "milestone_reached" && (
            <div className="space-y-2">
              <Label>Template/Milestone Type</Label>
              <Select value={templateType} onValueChange={setTemplateType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select template type..." />
                </SelectTrigger>
                <SelectContent>
                  {TEMPLATE_TYPES.map((template) => (
                    <SelectItem key={template.value} value={template.value}>
                      {template.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {actionType === "assign_tasks" && (
            <div className="space-y-2">
              <Label>Assign To</Label>
              <Select value={assigneeId} onValueChange={setAssigneeId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select assignee..." />
                </SelectTrigger>
                <SelectContent>
                  {assignees.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name} ({user.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button type="submit" disabled={isSubmitting || !name}>
            {isSubmitting ? "Saving..." : initialData ? "Update Rule" : "Create Rule"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
