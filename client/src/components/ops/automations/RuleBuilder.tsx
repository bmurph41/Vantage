import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2, Zap } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface RuleBuilderProps {
  rule: any | null;
  onClose: () => void;
  onSave: () => void;
}

const TRIGGER_TYPES = [
  { value: "deal_created", label: "Deal Created" },
  { value: "deal_stage_changed", label: "Deal Stage Changed" },
  { value: "task_completed", label: "Task Completed" },
  { value: "message_received", label: "Message Received" },
  { value: "document_uploaded", label: "Document Uploaded" },
];

const ACTION_TYPES = [
  { value: "create_task", label: "Create Task" },
  { value: "post_note", label: "Post Note" },
  { value: "schedule_message", label: "Schedule Message" },
  { value: "assign_user", label: "Assign User" },
  { value: "update_field", label: "Update Field" },
];

const OPERATORS = [
  { value: "equals", label: "Equals" },
  { value: "contains", label: "Contains" },
  { value: "in", label: "Is In" },
  { value: "not", label: "Not" },
];

export function RuleBuilder({ rule, onClose, onSave }: RuleBuilderProps) {
  const [name, setName] = useState(rule?.name || "");
  const [enabled, setEnabled] = useState(rule?.enabled ?? true);
  const [triggerType, setTriggerType] = useState(rule?.triggerType || "");
  const [conditions, setConditions] = useState<any[]>(rule?.conditions || []);
  const [actions, setActions] = useState<any[]>(rule?.actions || []);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const data = {
        name,
        enabled,
        triggerType,
        conditions,
        actions,
      };
      if (rule?.id) {
        return apiRequest(`/api/opssos/automations/rules/${rule.id}`, {
          method: "PATCH",
          body: JSON.stringify(data),
        });
      }
      return apiRequest("/api/opssos/automations/rules", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      onSave();
    },
  });

  const addCondition = () => {
    setConditions([...conditions, { field: "", operator: "equals", value: "" }]);
  };

  const updateCondition = (index: number, updates: any) => {
    const newConditions = [...conditions];
    newConditions[index] = { ...newConditions[index], ...updates };
    setConditions(newConditions);
  };

  const removeCondition = (index: number) => {
    setConditions(conditions.filter((_, i) => i !== index));
  };

  const addAction = () => {
    setActions([...actions, { type: "", config: {} }]);
  };

  const updateAction = (index: number, updates: any) => {
    const newActions = [...actions];
    newActions[index] = { ...newActions[index], ...updates };
    setActions(newActions);
  };

  const removeAction = (index: number) => {
    setActions(actions.filter((_, i) => i !== index));
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5" />
            {rule ? "Edit Automation Rule" : "Create Automation Rule"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Rule Name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Assign new deals to team lead"
              />
            </div>
            <div className="space-y-2">
              <Label>Trigger</Label>
              <Select value={triggerType} onValueChange={setTriggerType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select trigger..." />
                </SelectTrigger>
                <SelectContent>
                  {TRIGGER_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Switch checked={enabled} onCheckedChange={setEnabled} />
            <Label>Rule is active</Label>
          </div>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Conditions (optional)</CardTitle>
                <Button variant="ghost" size="sm" onClick={addCondition}>
                  <Plus className="w-4 h-4 mr-1" />
                  Add
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {conditions.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No conditions - rule will run for all matching triggers
                </p>
              ) : (
                conditions.map((condition, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Input
                      value={condition.field}
                      onChange={(e) => updateCondition(index, { field: e.target.value })}
                      placeholder="Field"
                      className="flex-1"
                    />
                    <Select
                      value={condition.operator}
                      onValueChange={(v) => updateCondition(index, { operator: v })}
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {OPERATORS.map((op) => (
                          <SelectItem key={op.value} value={op.value}>
                            {op.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      value={condition.value}
                      onChange={(e) => updateCondition(index, { value: e.target.value })}
                      placeholder="Value"
                      className="flex-1"
                    />
                    <Button variant="ghost" size="icon" onClick={() => removeCondition(index)}>
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Actions</CardTitle>
                <Button variant="ghost" size="sm" onClick={addAction}>
                  <Plus className="w-4 h-4 mr-1" />
                  Add
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {actions.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Add at least one action to run when triggered
                </p>
              ) : (
                actions.map((action, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Select
                      value={action.type}
                      onValueChange={(v) => updateAction(index, { type: v })}
                    >
                      <SelectTrigger className="w-48">
                        <SelectValue placeholder="Select action..." />
                      </SelectTrigger>
                      <SelectContent>
                        {ACTION_TYPES.map((a) => (
                          <SelectItem key={a.value} value={a.value}>
                            {a.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      value={JSON.stringify(action.config || {})}
                      onChange={(e) => {
                        try {
                          updateAction(index, { config: JSON.parse(e.target.value) });
                        } catch {}
                      }}
                      placeholder="Config (JSON)"
                      className="flex-1"
                    />
                    <Button variant="ghost" size="icon" onClick={() => removeAction(index)}>
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={!name || !triggerType || actions.length === 0 || saveMutation.isPending}
          >
            {saveMutation.isPending ? "Saving..." : rule ? "Update Rule" : "Create Rule"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
