import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bot, Plus, Edit, Trash2, Play, Pause, Calendar, X } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertWorkflowSchema, type Workflow, type InsertWorkflow } from "@shared/schema";
import { z } from "zod";

interface AutomationWorkflowsProps {
  showFullView?: boolean;
}

// Form schema extending insertWorkflowSchema
const workflowFormSchema = insertWorkflowSchema.extend({
  trigger: z.object({
    type: z.string(),
    pipelineId: z.string().optional(),
    stageId: z.string().optional(),
    labelId: z.string().optional(),
    entityType: z.string().optional(),
    field: z.string().optional(),
  }),
  conditions: z.array(z.object({
    field: z.string(),
    operator: z.enum(['equals', 'not_equals', 'greater_than', 'less_than', 'contains', 'not_contains']),
    value: z.any(),
  })).optional(),
  actions: z.array(z.object({
    type: z.string(),
    templateId: z.string().optional(),
    to: z.string().optional(),
    title: z.string().optional(),
    assigneeId: z.string().optional(),
    labelId: z.string().optional(),
    field: z.string().optional(),
    value: z.any().optional(),
    url: z.string().optional(),
    method: z.string().optional(),
  })),
});

type WorkflowFormData = z.infer<typeof workflowFormSchema>;

export default function AutomationWorkflows({ showFullView = false }: AutomationWorkflowsProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingWorkflow, setEditingWorkflow] = useState<Workflow | null>(null);

  const { data: workflows = [], isLoading } = useQuery<Workflow[]>({
    queryKey: ['/api/workflows'],
  });

  const createMutation = useMutation({
    mutationFn: (data: InsertWorkflow) => apiRequest('/api/workflows', 'POST', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/workflows'] });
      setIsModalOpen(false);
      toast({ title: 'Workflow created successfully' });
    },
    onError: (error: any) => {
      toast({ title: 'Error creating workflow', description: error.message, variant: 'destructive' });
    },
  });

  const updateWorkflowMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data?: Partial<InsertWorkflow> }) => {
      return await apiRequest(`/api/workflows/${id}`, 'PUT', data || {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/workflows'] });
      setIsModalOpen(false);
      setEditingWorkflow(null);
      toast({ title: "Workflow updated successfully" });
    },
    onError: () => {
      toast({ title: "Failed to update workflow", variant: "destructive" });
    },
  });

  const deleteWorkflowMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest('DELETE', `/api/workflows/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/workflows'] });
      toast({ title: "Workflow deleted successfully" });
    },
    onError: () => {
      toast({ title: "Failed to delete workflow", variant: "destructive" });
    },
  });

  const handleToggleWorkflow = (workflow: Workflow) => {
    updateWorkflowMutation.mutate({ id: workflow.id, data: { isActive: !workflow.isActive } });
  };

  const handleDeleteWorkflow = (id: string) => {
    if (confirm('Are you sure you want to delete this workflow?')) {
      deleteWorkflowMutation.mutate(id);
    }
  };

  const handleOpenModal = (workflow?: Workflow) => {
    if (workflow) {
      setEditingWorkflow(workflow);
    } else {
      setEditingWorkflow(null);
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingWorkflow(null);
  };

  const handleSubmitWorkflow = (data: InsertWorkflow) => {
    if (editingWorkflow) {
      updateWorkflowMutation.mutate({ id: editingWorkflow.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const getWorkflowTypeIcon = (trigger: any) => {
    if (trigger?.type === 'lead_created') return '👋';
    if (trigger?.type === 'deal_stage_changed') return '🔄';
    if (trigger?.type === 'task_overdue') return '⏰';
    return '🤖';
  };

  if (isLoading) {
    return (
      <Card className="border border-gray-100">
        <CardHeader className="border-b border-gray-200">
          <CardTitle className="text-lg font-semibold text-gray-900">Active Automations</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="bg-gray-50 rounded-lg p-4 border border-gray-200 animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2 mb-3"></div>
                <div className="h-3 bg-gray-200 rounded w-1/4"></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border border-gray-100" data-testid="automation-workflows">
      <CardHeader className="border-b border-gray-200">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold text-gray-900">Active Automations</CardTitle>
          <Button 
            variant="ghost" 
            size="sm" 
            className="text-primary hover:text-primary/80 font-medium"
            onClick={() => handleOpenModal()}
            data-testid="button-create-workflow"
          >
            <Plus className="w-4 h-4 mr-1" />
            Create Workflow
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-6">
        <div className="space-y-4">
          {workflows.length === 0 ? (
            <div className="text-center py-8">
              <Bot className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No workflows yet</h3>
              <p className="text-gray-500 mb-6">Create automated workflows to streamline your sales process</p>
              <Button onClick={() => handleOpenModal()} data-testid="button-create-first-workflow">
                <Plus className="w-4 h-4 mr-2" />
                Create Your First Workflow
              </Button>
            </div>
          ) : (
            workflows.slice(0, showFullView ? workflows.length : 3).map((workflow: Workflow) => (
              <div
                key={workflow.id}
                className={`rounded-lg p-4 border transition-all ${
                  workflow.isActive 
                    ? 'automation-glow bg-gradient-to-r from-primary/10 to-orange-100 border-primary/20' 
                    : 'bg-gray-50 border-gray-200'
                }`}
                data-testid={`workflow-${workflow.id}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <span className="text-lg">{getWorkflowTypeIcon(workflow.trigger)}</span>
                    <h3 className="font-medium text-gray-900" data-testid={`workflow-name-${workflow.id}`}>
                      {workflow.name}
                    </h3>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge 
                      className={workflow.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}
                      data-testid={`workflow-status-${workflow.id}`}
                    >
                      {workflow.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleToggleWorkflow(workflow)}
                      data-testid={`button-toggle-workflow-${workflow.id}`}
                    >
                      {workflow.isActive ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleOpenModal(workflow)}
                      data-testid={`button-edit-workflow-${workflow.id}`}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-500 hover:text-red-700"
                      onClick={() => handleDeleteWorkflow(workflow.id)}
                      data-testid={`button-delete-workflow-${workflow.id}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                <p className="text-sm text-gray-600 mb-3" data-testid={`workflow-description-${workflow.id}`}>
                  {workflow.description}
                </p>
                <div className="flex items-center justify-between text-sm text-gray-500">
                  <span data-testid={`workflow-trigger-count-${workflow.id}`}>
                    Triggered {workflow.triggerCount} times
                  </span>
                  <span className="flex items-center" data-testid={`workflow-updated-${workflow.id}`}>
                    <Calendar className="w-4 h-4 mr-1" />
                    Updated {new Date(workflow.updatedAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        {!showFullView && workflows.length > 3 && (
          <Button variant="ghost" className="w-full mt-6 text-sm text-gray-500 hover:text-gray-700 py-2" data-testid="button-view-all-workflows">
            View all workflows
            <Bot className="w-4 h-4 ml-2" />
          </Button>
        )}
      </CardContent>
      <WorkflowFormModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        workflow={editingWorkflow}
        onSubmit={handleSubmitWorkflow}
        isPending={createMutation.isPending || updateWorkflowMutation.isPending}
      />
    </Card>
  );
}

interface WorkflowFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  workflow: Workflow | null;
  onSubmit: (data: InsertWorkflow) => void;
  isPending: boolean;
}

function WorkflowFormModal({ isOpen, onClose, workflow, onSubmit, isPending }: WorkflowFormModalProps) {
  const form = useForm<WorkflowFormData>({
    resolver: zodResolver(workflowFormSchema),
    defaultValues: workflow
      ? {
          name: workflow.name,
          description: workflow.description ?? '',
          trigger: workflow.trigger as any,
          conditions: (workflow.conditions as any) || [],
          actions: workflow.actions as any,
          isActive: workflow.isActive ?? true,
        }
      : {
          name: '',
          description: '',
          trigger: { type: 'deal_stage_changed' },
          conditions: [],
          actions: [],
          isActive: true,
        },
  });

  const [conditions, setConditions] = useState<any[]>((workflow?.conditions as any) || []);
  const [actions, setActions] = useState<any[]>((workflow?.actions as any) || []);

  const handleSubmit = (data: WorkflowFormData) => {
    onSubmit({
      ...data,
      conditions: conditions.length > 0 ? conditions : [],
      actions: actions,
    } as any);
  };

  const addCondition = () => {
    setConditions([...conditions, { field: '', operator: 'equals', value: '' }]);
  };

  const removeCondition = (index: number) => {
    setConditions(conditions.filter((_, i) => i !== index));
  };

  const updateCondition = (index: number, field: string, value: any) => {
    const updated = [...conditions];
    updated[index] = { ...updated[index], [field]: value };
    setConditions(updated);
  };

  const addAction = () => {
    setActions([...actions, { type: 'send_email' }]);
  };

  const removeAction = (index: number) => {
    setActions(actions.filter((_, i) => i !== index));
  };

  const updateAction = (index: number, field: string, value: any) => {
    const updated = [...actions];
    updated[index] = { ...updated[index], [field]: value };
    setActions(updated);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{workflow ? 'Edit Workflow' : 'Create Workflow'}</DialogTitle>
          <DialogDescription>
            Configure triggers, conditions, and actions for automated workflows
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Workflow Name</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="e.g., Assign tasks on deal close" data-testid="input-workflow-name" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea {...field} value={field.value ?? ''} placeholder="Optional description" data-testid="input-workflow-description" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-3">
              <FormLabel>Trigger</FormLabel>
              <FormField
                control={form.control}
                name="trigger.type"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger data-testid="select-trigger-type">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="deal_stage_changed">Deal Stage Changed</SelectItem>
                          <SelectItem value="deal_created">Deal Created</SelectItem>
                          <SelectItem value="label_added">Label Added</SelectItem>
                          <SelectItem value="field_updated">Field Updated</SelectItem>
                          <SelectItem value="contact_created">Contact Created</SelectItem>
                          <SelectItem value="lead_created">Lead Created</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <FormLabel>Conditions</FormLabel>
                <Button type="button" variant="outline" size="sm" onClick={addCondition} data-testid="button-add-condition">
                  <Plus className="h-4 w-4 mr-1" /> Add Condition
                </Button>
              </div>
              {conditions.map((condition, index) => (
                <div key={index} className="flex gap-2 items-start border p-3 rounded">
                  <Input
                    placeholder="Field"
                    value={condition.field}
                    onChange={(e) => updateCondition(index, 'field', e.target.value)}
                    data-testid={`input-condition-field-${index}`}
                  />
                  <Select
                    value={condition.operator}
                    onValueChange={(value) => updateCondition(index, 'operator', value)}
                  >
                    <SelectTrigger className="w-[180px]" data-testid={`select-condition-operator-${index}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="equals">Equals</SelectItem>
                      <SelectItem value="not_equals">Not Equals</SelectItem>
                      <SelectItem value="greater_than">Greater Than</SelectItem>
                      <SelectItem value="less_than">Less Than</SelectItem>
                      <SelectItem value="contains">Contains</SelectItem>
                      <SelectItem value="not_contains">Not Contains</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    placeholder="Value"
                    value={condition.value}
                    onChange={(e) => updateCondition(index, 'value', e.target.value)}
                    data-testid={`input-condition-value-${index}`}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeCondition(index)}
                    data-testid={`button-remove-condition-${index}`}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <FormLabel>Actions</FormLabel>
                <Button type="button" variant="outline" size="sm" onClick={addAction} data-testid="button-add-action">
                  <Plus className="h-4 w-4 mr-1" /> Add Action
                </Button>
              </div>
              {actions.map((action, index) => (
                <div key={index} className="border p-3 rounded space-y-2">
                  <div className="flex gap-2 items-start">
                    <Select
                      value={action.type}
                      onValueChange={(value) => updateAction(index, 'type', value)}
                    >
                      <SelectTrigger data-testid={`select-action-type-${index}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="send_email">Send Email</SelectItem>
                        <SelectItem value="create_task">Create Task</SelectItem>
                        <SelectItem value="add_label">Add Label</SelectItem>
                        <SelectItem value="update_field">Update Field</SelectItem>
                        <SelectItem value="webhook">Call Webhook</SelectItem>
                        <SelectItem value="create_activity">Create Activity</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeAction(index)}
                      data-testid={`button-remove-action-${index}`}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  {action.type === 'send_email' && (
                    <div className="space-y-2">
                      <Select
                        value={action.recipientType || 'deal_owner'}
                        onValueChange={(value) => {
                          const to = value === 'deal_owner' ? 'deal_owner' : value === 'contact' ? 'primary_contact' : '';
                          updateAction(index, 'recipientType', value);
                          updateAction(index, 'to', to);
                        }}
                      >
                        <SelectTrigger data-testid={`select-action-recipient-${index}`}>
                          <SelectValue placeholder="Recipient" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="deal_owner">Deal Owner</SelectItem>
                          <SelectItem value="contact">Primary Contact</SelectItem>
                          <SelectItem value="custom">Custom Email</SelectItem>
                        </SelectContent>
                      </Select>
                      {action.recipientType === 'custom' && (
                        <Input
                          placeholder="email@example.com or {{contact.email}}"
                          value={action.to || ''}
                          onChange={(e) => updateAction(index, 'to', e.target.value)}
                          data-testid={`input-action-to-${index}`}
                        />
                      )}
                      <Input
                        placeholder="Subject (supports {{tokens}})"
                        value={action.subject || ''}
                        onChange={(e) => updateAction(index, 'subject', e.target.value)}
                        data-testid={`input-action-subject-${index}`}
                      />
                    </div>
                  )}
                  {action.type === 'create_task' && (
                    <Input
                      placeholder="Task title"
                      value={action.title || ''}
                      onChange={(e) => updateAction(index, 'title', e.target.value)}
                      data-testid={`input-action-title-${index}`}
                    />
                  )}
                  {action.type === 'webhook' && (
                    <Input
                      placeholder="Webhook URL"
                      value={action.url || ''}
                      onChange={(e) => updateAction(index, 'url', e.target.value)}
                      data-testid={`input-action-url-${index}`}
                    />
                  )}
                </div>
              ))}
            </div>

            <FormField
              control={form.control}
              name="isActive"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between border p-3 rounded">
                  <div>
                    <FormLabel>Active</FormLabel>
                    <FormDescription>Enable this workflow to run automatically</FormDescription>
                  </div>
                  <FormControl>
                    <Switch checked={field.value ?? true} onCheckedChange={field.onChange} data-testid="switch-workflow-active" />
                  </FormControl>
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={onClose} data-testid="button-cancel">
                Cancel
              </Button>
              <Button type="submit" disabled={isPending} data-testid="button-submit-workflow">
                {isPending ? 'Saving...' : workflow ? 'Update Workflow' : 'Create Workflow'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
