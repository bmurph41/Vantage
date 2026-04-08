import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Zap, Plus, Pencil, Trash2, Play, Loader2, Settings2,
} from "lucide-react";
import { format } from "date-fns";

interface AutomationRule {
  id: string;
  name: string;
  triggerType: string;
  triggerConfig: any;
  actionType: string;
  actionConfig: any;
  isActive: boolean;
  executionCount: number;
  lastExecutedAt: string | null;
  createdAt: string;
}

const TRIGGER_TYPES = [
  { value: "stage_change", label: "Stage Change" },
  { value: "days_in_stage", label: "Days in Stage" },
  { value: "field_update", label: "Field Update" },
  { value: "manual", label: "Manual Trigger" },
];

const ACTION_TYPES = [
  { value: "move_stage", label: "Move to Stage" },
  { value: "send_notification", label: "Send Notification" },
  { value: "create_task", label: "Create Task" },
  { value: "update_field", label: "Update Field" },
  { value: "assign_owner", label: "Assign Owner" },
];

const CONDITION_FIELDS = [
  { value: "amount", label: "Deal Value" },
  { value: "probability", label: "Probability %" },
  { value: "priority", label: "Priority" },
  { value: "assetClass", label: "Asset Class" },
  { value: "forecastCategory", label: "Forecast Category" },
  { value: "daysInCurrentStage", label: "Days in Stage" },
];

const CONDITION_OPERATORS = [
  { value: "equals", label: "=" },
  { value: "not_equals", label: "≠" },
  { value: "greater_than", label: ">" },
  { value: "less_than", label: "<" },
  { value: "contains", label: "contains" },
];

function getTriggerDescription(rule: AutomationRule): string {
  const config = rule.triggerConfig || {};
  switch (rule.triggerType) {
    case "stage_change":
      return config.fromStage && config.toStage
        ? `When deal moves from "${config.fromStage}" to "${config.toStage}"`
        : config.toStage
          ? `When deal enters "${config.toStage}"`
          : "On any stage change";
    case "days_in_stage":
      return `When deal is in stage for ${config.daysThreshold || 30}+ days`;
    case "field_update":
      return `When "${config.field || 'field'}" changes to "${config.value || 'value'}"`;
    case "manual":
      return "Triggered manually";
    default:
      return rule.triggerType;
  }
}

function getActionDescription(rule: AutomationRule): string {
  const config = rule.actionConfig || {};
  switch (rule.actionType) {
    case "move_stage":
      return `Move deal to "${config.targetStage || 'stage'}"`;
    case "send_notification":
      return `Send notification: "${config.notificationTemplate || 'alert'}"`;
    case "create_task":
      return `Create task: "${config.taskTitle || 'task'}"`;
    case "update_field":
      return `Set ${config.fieldName || 'field'} = "${config.fieldValue || 'value'}"`;
    case "assign_owner":
      return "Assign deal owner";
    default:
      return rule.actionType;
  }
}

export default function AutomationRulesPanel() {
  const { toast } = useToast();
  const [showDialog, setShowDialog] = useState(false);
  const [editingRule, setEditingRule] = useState<AutomationRule | null>(null);
  const [form, setForm] = useState({
    name: "",
    triggerType: "stage_change",
    triggerConfig: {} as any,
    actionType: "send_notification",
    actionConfig: {} as any,
    // Conditions: array of { field, operator, value } ANDed together
    conditions: [] as Array<{ field: string; operator: string; value: string }>,
  });

  const { data: rules = [], isLoading } = useQuery<AutomationRule[]>({
    queryKey: ["/api/pipeline/automation/rules"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/pipeline/automation/rules", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pipeline/automation/rules"] });
      toast({ title: "Automation rule created" });
      setShowDialog(false);
      resetForm();
    },
    onError: () => toast({ title: "Failed to create rule", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: any) => {
      const res = await apiRequest("PUT", `/api/pipeline/automation/rules/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pipeline/automation/rules"] });
      toast({ title: "Rule updated" });
      setShowDialog(false);
      resetForm();
    },
    onError: () => toast({ title: "Failed to update rule", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/pipeline/automation/rules/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pipeline/automation/rules"] });
      toast({ title: "Rule deleted" });
    },
    onError: () => toast({ title: "Failed to delete rule", variant: "destructive" }),
  });

  const toggleMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/pipeline/automation/rules/${id}/toggle`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pipeline/automation/rules"] });
    },
    onError: () => toast({ title: "Failed to toggle rule", variant: "destructive" }),
  });

  const evaluateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/pipeline/automation/evaluate");
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/pipeline/automation/rules"] });
      toast({
        title: "Rules evaluated",
        description: `${data.triggered?.length || 0} actions triggered across ${data.dealsChecked || 0} deals`,
      });
    },
    onError: () => toast({ title: "Failed to evaluate rules", variant: "destructive" }),
  });

  function resetForm() {
    setForm({ name: "", triggerType: "stage_change", triggerConfig: {}, actionType: "send_notification", actionConfig: {} });
    setEditingRule(null);
  }

  function openEdit(rule: AutomationRule) {
    setEditingRule(rule);
    setForm({
      name: rule.name,
      triggerType: rule.triggerType,
      triggerConfig: rule.triggerConfig || {},
      actionType: rule.actionType,
      actionConfig: rule.actionConfig || {},
    });
    setShowDialog(true);
  }

  function handleSave() {
    if (!form.name.trim()) {
      toast({ title: "Name is required", variant: "destructive" });
      return;
    }
    if (editingRule) {
      updateMutation.mutate({ id: editingRule.id, ...form });
    } else {
      createMutation.mutate(form);
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <Loader2 className="h-6 w-6 animate-spin mx-auto text-gray-400" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Zap className="h-4 w-4 text-amber-500" />
            Pipeline Automations
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => evaluateMutation.mutate()}
              disabled={evaluateMutation.isPending}
            >
              {evaluateMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
              ) : (
                <Play className="h-3.5 w-3.5 mr-1" />
              )}
              Run All
            </Button>
            <Button
              size="sm"
              onClick={() => { resetForm(); setShowDialog(true); }}
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              Add Rule
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {rules.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Settings2 className="h-10 w-10 mx-auto mb-3 text-gray-300" />
            <h3 className="text-sm font-semibold mb-1">No automation rules</h3>
            <p className="text-xs">Create rules to automate pipeline actions like stage transitions and notifications.</p>
          </div>
        ) : (
          <div className="overflow-x-auto w-full">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Trigger</TableHead>
                <TableHead>Action</TableHead>
                <TableHead className="text-center">Runs</TableHead>
                <TableHead className="text-center">Active</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rules.map((rule) => (
                <TableRow key={rule.id}>
                  <TableCell className="font-medium">{rule.name}</TableCell>
                  <TableCell className="text-sm text-gray-600">
                    <Badge variant="outline" className="text-xs mr-1">
                      {TRIGGER_TYPES.find(t => t.value === rule.triggerType)?.label || rule.triggerType}
                    </Badge>
                    {getTriggerDescription(rule)}
                  </TableCell>
                  <TableCell className="text-sm text-gray-600">
                    <Badge variant="outline" className="text-xs mr-1">
                      {ACTION_TYPES.find(a => a.value === rule.actionType)?.label || rule.actionType}
                    </Badge>
                    {getActionDescription(rule)}
                  </TableCell>
                  <TableCell className="text-center text-sm">
                    {rule.executionCount || 0}
                    {rule.lastExecutedAt && (
                      <div className="text-[10px] text-gray-400">
                        {format(new Date(rule.lastExecutedAt), "MMM d")}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    <Switch
                      checked={rule.isActive}
                      onCheckedChange={() => toggleMutation.mutate(rule.id)}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(rule)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteMutation.mutate(rule.id)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </div>
        )}
      </CardContent>

      {/* Add/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={(open) => { if (!open) { setShowDialog(false); resetForm(); } else setShowDialog(true); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingRule ? "Edit Automation Rule" : "Add Automation Rule"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-sm">Rule Name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g., Notify on rotting deals"
                className="mt-1"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="text-sm">Trigger Type</Label>
                <Select value={form.triggerType} onValueChange={(v) => setForm({ ...form, triggerType: v, triggerConfig: {} })}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TRIGGER_TYPES.map(t => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm">Action Type</Label>
                <Select value={form.actionType} onValueChange={(v) => setForm({ ...form, actionType: v, actionConfig: {} })}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ACTION_TYPES.map(a => (
                      <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Dynamic trigger config */}
            {form.triggerType === "days_in_stage" && (
              <div>
                <Label className="text-sm">Days Threshold</Label>
                <Input
                  type="number"
                  value={form.triggerConfig.daysThreshold || ""}
                  onChange={(e) => setForm({ ...form, triggerConfig: { ...form.triggerConfig, daysThreshold: Number(e.target.value) } })}
                  placeholder="30"
                  className="mt-1"
                />
              </div>
            )}
            {form.triggerType === "stage_change" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm">From Stage (optional)</Label>
                  <Input
                    value={form.triggerConfig.fromStage || ""}
                    onChange={(e) => setForm({ ...form, triggerConfig: { ...form.triggerConfig, fromStage: e.target.value } })}
                    placeholder="Any"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-sm">To Stage</Label>
                  <Input
                    value={form.triggerConfig.toStage || ""}
                    onChange={(e) => setForm({ ...form, triggerConfig: { ...form.triggerConfig, toStage: e.target.value } })}
                    placeholder="e.g., due_diligence"
                    className="mt-1"
                  />
                </div>
              </div>
            )}
            {form.triggerType === "field_update" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm">Field Name</Label>
                  <Input
                    value={form.triggerConfig.field || ""}
                    onChange={(e) => setForm({ ...form, triggerConfig: { ...form.triggerConfig, field: e.target.value } })}
                    placeholder="priority"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-sm">New Value</Label>
                  <Input
                    value={form.triggerConfig.value || ""}
                    onChange={(e) => setForm({ ...form, triggerConfig: { ...form.triggerConfig, value: e.target.value } })}
                    placeholder="critical"
                    className="mt-1"
                  />
                </div>
              </div>
            )}

            {/* Dynamic action config */}
            {form.actionType === "move_stage" && (
              <div>
                <Label className="text-sm">Target Stage</Label>
                <Input
                  value={form.actionConfig.targetStage || ""}
                  onChange={(e) => setForm({ ...form, actionConfig: { ...form.actionConfig, targetStage: e.target.value } })}
                  placeholder="e.g., qualified"
                  className="mt-1"
                />
              </div>
            )}
            {form.actionType === "send_notification" && (
              <div>
                <Label className="text-sm">Notification Message</Label>
                <Input
                  value={form.actionConfig.notificationTemplate || ""}
                  onChange={(e) => setForm({ ...form, actionConfig: { ...form.actionConfig, notificationTemplate: e.target.value } })}
                  placeholder="Deal requires attention"
                  className="mt-1"
                />
              </div>
            )}
            {form.actionType === "create_task" && (
              <div>
                <Label className="text-sm">Task Title</Label>
                <Input
                  value={form.actionConfig.taskTitle || ""}
                  onChange={(e) => setForm({ ...form, actionConfig: { ...form.actionConfig, taskTitle: e.target.value } })}
                  placeholder="Follow up on deal"
                  className="mt-1"
                />
              </div>
            )}
            {form.actionType === "update_field" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm">Field Name</Label>
                  <Input
                    value={form.actionConfig.fieldName || ""}
                    onChange={(e) => setForm({ ...form, actionConfig: { ...form.actionConfig, fieldName: e.target.value } })}
                    placeholder="priority"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-sm">New Value</Label>
                  <Input
                    value={form.actionConfig.fieldValue || ""}
                    onChange={(e) => setForm({ ...form, actionConfig: { ...form.actionConfig, fieldValue: e.target.value } })}
                    placeholder="high"
                    className="mt-1"
                  />
                </div>
              </div>
            )}
          </div>
          {/* ── Conditions Section ── */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-gray-600 font-medium">Run conditions (optional)</Label>
              <button
                type="button"
                className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
                onClick={() => setForm(f => ({
                  ...f,
                  conditions: [...f.conditions, { field: 'amount', operator: 'greater_than', value: '' }]
                }))}
              >
                <Plus className="h-3 w-3" /> Add condition
              </button>
            </div>
            {form.conditions.length === 0 && (
              <p className="text-[11px] text-gray-400 italic">No conditions — rule fires on all matching deals</p>
            )}
            {form.conditions.map((cond, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <Select
                  value={cond.field}
                  onValueChange={v => {
                    const next = [...form.conditions];
                    next[idx] = { ...next[idx], field: v };
                    setForm(f => ({ ...f, conditions: next }));
                  }}
                >
                  <SelectTrigger className="h-7 text-xs w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CONDITION_FIELDS.map(f => (
                      <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={cond.operator}
                  onValueChange={v => {
                    const next = [...form.conditions];
                    next[idx] = { ...next[idx], operator: v };
                    setForm(f => ({ ...f, conditions: next }));
                  }}
                >
                  <SelectTrigger className="h-7 text-xs w-16">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CONDITION_OPERATORS.map(o => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  className="h-7 text-xs flex-1"
                  placeholder="value"
                  value={cond.value}
                  onChange={e => {
                    const next = [...form.conditions];
                    next[idx] = { ...next[idx], value: e.target.value };
                    setForm(f => ({ ...f, conditions: next }));
                  }}
                />
                <button
                  type="button"
                  className="text-gray-400 hover:text-red-500"
                  onClick={() => setForm(f => ({
                    ...f,
                    conditions: f.conditions.filter((_, i) => i !== idx)
                  }))}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            {form.conditions.length > 1 && (
              <p className="text-[10px] text-gray-400">All conditions must be true (AND logic)</p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowDialog(false); resetForm(); }}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={createMutation.isPending || updateMutation.isPending}>
              {(createMutation.isPending || updateMutation.isPending) && (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              )}
              {editingRule ? "Update Rule" : "Create Rule"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
