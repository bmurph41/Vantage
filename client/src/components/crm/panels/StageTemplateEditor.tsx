import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus, Trash2, ListChecks, Clock, AlertTriangle } from "lucide-react";
import type { CrmPipelineStage } from "@shared/schema";

interface TaskTemplate {
  title: string;
  description?: string;
  priority?: "low" | "medium" | "high" | "critical";
  daysFromNow?: number;
}

interface StageTemplates {
  stageId: string;
  stageName: string;
  taskTemplates: TaskTemplate[];
  requiredFields: string[];
  slaWarningDays: number | null;
  slaMaxDays: number | null;
}

interface StageTemplateEditorProps {
  stageId: string;
  stageName: string;
  onClose?: () => void;
}

export function StageTemplateEditor({ stageId, stageName, onClose }: StageTemplateEditorProps) {
  const { toast } = useToast();
  const [addTemplateOpen, setAddTemplateOpen] = useState(false);
  const [newTemplate, setNewTemplate] = useState<TaskTemplate>({ title: "", description: "", priority: "medium", daysFromNow: 3 });

  const { data: templates, isLoading } = useQuery<StageTemplates>({
    queryKey: ["/api/stages", stageId, "templates"],
  });

  const updateMutation = useMutation({
    mutationFn: async (updates: Partial<StageTemplates>) =>
      apiRequest(`/api/stages/${stageId}/templates`, { method: "PUT", body: JSON.stringify(updates) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/stages", stageId, "templates"] });
      toast({ title: "Stage templates updated" });
    },
    onError: () => toast({ title: "Failed to update templates", variant: "destructive" }),
  });

  const handleAddTemplate = () => {
    if (!newTemplate.title.trim()) return;
    
    const currentTemplates = templates?.taskTemplates || [];
    updateMutation.mutate({
      taskTemplates: [...currentTemplates, newTemplate],
    });
    setAddTemplateOpen(false);
    setNewTemplate({ title: "", description: "", priority: "medium", daysFromNow: 3 });
  };

  const handleRemoveTemplate = (index: number) => {
    const currentTemplates = templates?.taskTemplates || [];
    updateMutation.mutate({
      taskTemplates: currentTemplates.filter((_, i) => i !== index),
    });
  };

  const handleUpdateSLA = (field: "slaWarningDays" | "slaMaxDays", value: number | null) => {
    updateMutation.mutate({ [field]: value });
  };

  if (isLoading) {
    return <div className="p-4 text-muted-foreground">Loading...</div>;
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ListChecks className="h-5 w-5" />
          {stageName} - Stage Configuration
        </CardTitle>
        <CardDescription>
          Configure task templates that auto-create when a deal enters this stage, and set SLA thresholds.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
              SLA Warning (days)
            </Label>
            <Input
              type="number"
              value={templates?.slaWarningDays ?? ""}
              onChange={(e) => handleUpdateSLA("slaWarningDays", e.target.value ? parseInt(e.target.value) : null)}
              placeholder="Days before warning"
              data-testid="input-sla-warning"
            />
            <p className="text-xs text-muted-foreground">Show warning after this many days in stage</p>
          </div>
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-red-500" />
              SLA Maximum (days)
            </Label>
            <Input
              type="number"
              value={templates?.slaMaxDays ?? ""}
              onChange={(e) => handleUpdateSLA("slaMaxDays", e.target.value ? parseInt(e.target.value) : null)}
              placeholder="Maximum days allowed"
              data-testid="input-sla-max"
            />
            <p className="text-xs text-muted-foreground">Maximum days allowed before SLA breach</p>
          </div>
        </div>

        <div className="border-t pt-4">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-medium">Task Templates</h4>
            <Dialog open={addTemplateOpen} onOpenChange={setAddTemplateOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline" data-testid="button-add-task-template">
                  <Plus className="h-4 w-4 mr-1" /> Add Task Template
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Task Template</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Task Title</Label>
                    <Input
                      value={newTemplate.title}
                      onChange={(e) => setNewTemplate({ ...newTemplate, title: e.target.value })}
                      placeholder="e.g., Schedule site visit"
                      data-testid="input-template-title"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Description</Label>
                    <Textarea
                      value={newTemplate.description}
                      onChange={(e) => setNewTemplate({ ...newTemplate, description: e.target.value })}
                      placeholder="Detailed instructions for the task..."
                      data-testid="input-template-description"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Priority</Label>
                      <Select
                        value={newTemplate.priority}
                        onValueChange={(value: "low" | "medium" | "high" | "critical") => 
                          setNewTemplate({ ...newTemplate, priority: value })
                        }
                      >
                        <SelectTrigger data-testid="select-template-priority">
                          <SelectValue placeholder="Select priority" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                          <SelectItem value="critical">Critical</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Due in (days)</Label>
                      <Input
                        type="number"
                        value={newTemplate.daysFromNow ?? ""}
                        onChange={(e) => setNewTemplate({ ...newTemplate, daysFromNow: e.target.value ? parseInt(e.target.value) : undefined })}
                        placeholder="3"
                        data-testid="input-template-days"
                      />
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    onClick={handleAddTemplate}
                    disabled={!newTemplate.title.trim() || updateMutation.isPending}
                    data-testid="button-confirm-add-template"
                  >
                    Add Template
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {!templates?.taskTemplates?.length ? (
            <p className="text-sm text-muted-foreground">No task templates configured. Tasks will be created automatically when deals enter this stage.</p>
          ) : (
            <div className="space-y-2">
              {templates.taskTemplates.map((template, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                  data-testid={`task-template-${index}`}
                >
                  <div className="flex-1">
                    <p className="font-medium">{template.title}</p>
                    {template.description && (
                      <p className="text-sm text-muted-foreground line-clamp-1">{template.description}</p>
                    )}
                    <div className="flex gap-2 mt-1">
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        template.priority === 'critical' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
                        template.priority === 'high' ? 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200' :
                        template.priority === 'medium' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
                        'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
                      }`}>
                        {template.priority || 'medium'}
                      </span>
                      {template.daysFromNow && (
                        <span className="text-xs text-muted-foreground">
                          Due in {template.daysFromNow} days
                        </span>
                      )}
                    </div>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => handleRemoveTemplate(index)}
                    data-testid={`button-remove-template-${index}`}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        {onClose && (
          <div className="flex justify-end pt-4 border-t">
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
