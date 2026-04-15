import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { 
  Plus, Settings, Trash2, Play, Pause, 
  ChevronRight, Zap, Mail, Phone, 
  Calendar, User, Building, Handshake,
  Clock, Filter, Target, ArrowRight
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

interface WorkflowTrigger {
  type: 'contact_created' | 'deal_created' | 'deal_stage_changed' | 'property_created' | 'activity_created' | 'task_overdue' | 'lead_score_changed' | 'no_activity';
  conditions?: {
    field?: string;
    operator?: 'equals' | 'not_equals' | 'contains' | 'greater_than' | 'less_than' | 'exists' | 'not_exists';
    value?: any;
  }[];
  delay?: number; // minutes
}

interface WorkflowAction {
  type: 'create_task' | 'send_email' | 'assign_to_user' | 'update_field' | 'add_tag' | 'change_stage' | 'create_activity' | 'send_sms';
  parameters: Record<string, any>;
  delay?: number; // minutes
}

interface WorkflowRule {
  id: string;
  name: string;
  description: string;
  isActive: boolean;
  trigger: WorkflowTrigger;
  actions: WorkflowAction[];
  createdAt: string;
  triggerCount: number;
}

interface WorkflowBuilderProps {
  workflow?: WorkflowRule;
  onSave: (workflow: Partial<WorkflowRule>) => void;
  isOpen: boolean;
  onClose: () => void;
}

export default function WorkflowBuilder({ workflow, onSave, isOpen, onClose }: WorkflowBuilderProps) {
  const [formData, setFormData] = useState<Partial<WorkflowRule>>({
    name: workflow?.name || '',
    description: workflow?.description || '',
    isActive: workflow?.isActive ?? true,
    trigger: workflow?.trigger || { type: 'contact_created' },
    actions: workflow?.actions || [],
  });

  const { toast } = useToast();

  const handleSave = () => {
    if (!formData.name?.trim()) {
      toast({ title: "Please enter a workflow name", variant: "destructive" });
      return;
    }
    if (!formData.actions?.length) {
      toast({ title: "Please add at least one action", variant: "destructive" });
      return;
    }
    onSave(formData);
    onClose();
  };

  const addCondition = () => {
    setFormData(prev => ({
      ...prev,
      trigger: {
        ...prev.trigger!,
        conditions: [
          ...(prev.trigger?.conditions || []),
          { field: '', operator: 'equals', value: '' }
        ]
      }
    }));
  };

  const updateCondition = (index: number, condition: any) => {
    setFormData(prev => ({
      ...prev,
      trigger: {
        ...prev.trigger!,
        conditions: prev.trigger?.conditions?.map((c, i) => i === index ? condition : c) || []
      }
    }));
  };

  const removeCondition = (index: number) => {
    setFormData(prev => ({
      ...prev,
      trigger: {
        ...prev.trigger!,
        conditions: prev.trigger?.conditions?.filter((_, i) => i !== index) || []
      }
    }));
  };

  const addAction = (type: WorkflowAction['type']) => {
    const newAction: WorkflowAction = {
      type,
      parameters: getDefaultParameters(type),
    };
    
    setFormData(prev => ({
      ...prev,
      actions: [...(prev.actions || []), newAction]
    }));
  };

  const updateAction = (index: number, action: WorkflowAction) => {
    setFormData(prev => ({
      ...prev,
      actions: prev.actions?.map((a, i) => i === index ? action : a) || []
    }));
  };

  const removeAction = (index: number) => {
    setFormData(prev => ({
      ...prev,
      actions: prev.actions?.filter((_, i) => i !== index) || []
    }));
  };

  const getDefaultParameters = (type: WorkflowAction['type']): Record<string, any> => {
    switch (type) {
      case 'create_task':
        return { title: '', description: '', type: 'call', priority: 'medium', dueInDays: 1 };
      case 'send_email':
        return { recipientType: 'deal_owner', to: 'deal_owner', subject: '', body: '' };
      case 'assign_to_user':
        return { userId: '', notifyUser: true };
      case 'update_field':
        return { field: '', value: '' };
      case 'add_tag':
        return { tags: [] };
      case 'change_stage':
        return { stage: '' };
      case 'create_activity':
        return { type: 'note', description: '' };
      case 'send_sms':
        return { template: '', personalizedContent: true };
      default:
        return {};
    }
  };

  const getTriggerIcon = (type: string) => {
    switch (type) {
      case 'contact_created': return User;
      case 'deal_created': return Handshake;
      case 'deal_stage_changed': return ArrowRight;
      case 'property_created': return Building;
      case 'activity_created': return Calendar;
      case 'task_overdue': return Clock;
      case 'lead_score_changed': return Target;
      case 'no_activity': return Filter;
      default: return Zap;
    }
  };

  const getActionIcon = (type: string) => {
    switch (type) {
      case 'create_task': return Calendar;
      case 'send_email': return Mail;
      case 'assign_to_user': return User;
      case 'send_sms': return Phone;
      default: return Settings;
    }
  };

  const triggerTypes = [
    { value: 'contact_created', label: 'Contact Created' },
    { value: 'deal_created', label: 'Deal Created' },
    { value: 'deal_stage_changed', label: 'Deal Stage Changed' },
    { value: 'property_created', label: 'Property Listed' },
    { value: 'activity_created', label: 'Activity Logged' },
    { value: 'task_overdue', label: 'Task Overdue' },
    { value: 'lead_score_changed', label: 'Lead Score Changed' },
    { value: 'no_activity', label: 'No Activity for X Days' },
  ];

  const actionTypes = [
    { value: 'create_task', label: 'Create Task', icon: Calendar },
    { value: 'send_email', label: 'Send Email', icon: Mail },
    { value: 'assign_to_user', label: 'Assign to User', icon: User },
    { value: 'update_field', label: 'Update Field', icon: Settings },
    { value: 'add_tag', label: 'Add Tag', icon: Target },
    { value: 'change_stage', label: 'Change Stage', icon: ArrowRight },
    { value: 'create_activity', label: 'Log Activity', icon: Calendar },
    { value: 'send_sms', label: 'Send SMS', icon: Phone },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {workflow ? 'Edit Workflow' : 'Create New Workflow'}
          </DialogTitle>
          <DialogDescription>
            Set up automated actions that trigger when specific events occur in your CRM.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Basic Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Workflow Name</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g. Welcome New Contacts"
              />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select 
                value={formData.isActive ? 'active' : 'inactive'}
                onValueChange={(value) => setFormData(prev => ({ ...prev, isActive: value === 'active' }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Describe what this workflow does and when it should run..."
              rows={2}
            />
          </div>

          {/* Trigger Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Zap className="w-5 h-5" />
                Trigger
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>When this happens...</Label>
                <Select 
                  value={formData.trigger?.type}
                  onValueChange={(value) => setFormData(prev => ({
                    ...prev,
                    trigger: { ...prev.trigger!, type: value as any }
                  }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {triggerTypes.map(trigger => (
                      <SelectItem key={trigger.value} value={trigger.value}>
                        {trigger.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Conditions */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Additional Conditions (optional)</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addCondition}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Condition
                  </Button>
                </div>

                {formData.trigger?.conditions?.map((condition, index) => (
                  <div key={index} className="flex items-center gap-2 p-3 border rounded-lg">
                    <Select 
                      value={condition.field}
                      onValueChange={(value) => updateCondition(index, { ...condition, field: value })}
                    >
                      <SelectTrigger className="w-[150px]">
                        <SelectValue placeholder="Field" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="leadScore">Lead Score</SelectItem>
                        <SelectItem value="leadStatus">Lead Status</SelectItem>
                        <SelectItem value="dealValue">Deal Value</SelectItem>
                        <SelectItem value="propertyType">Property Type</SelectItem>
                        <SelectItem value="tags">Tags</SelectItem>
                      </SelectContent>
                    </Select>

                    <Select 
                      value={condition.operator}
                      onValueChange={(value) => updateCondition(index, { ...condition, operator: value as any })}
                    >
                      <SelectTrigger className="w-[120px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="equals">Equals</SelectItem>
                        <SelectItem value="not_equals">Not Equals</SelectItem>
                        <SelectItem value="greater_than">Greater Than</SelectItem>
                        <SelectItem value="less_than">Less Than</SelectItem>
                        <SelectItem value="contains">Contains</SelectItem>
                      </SelectContent>
                    </Select>

                    <Input
                      value={condition.value}
                      onChange={(e) => updateCondition(index, { ...condition, value: e.target.value })}
                      placeholder="Value"
                      className="flex-1"
                    />

                    <Button 
                      type="button" 
                      variant="outline" 
                      size="sm"
                      onClick={() => removeCondition(index)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>

              {/* Delay */}
              {formData.trigger?.type !== 'task_overdue' && (
                <div className="space-y-2">
                  <Label>Wait before triggering (optional)</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      value={formData.trigger?.delay || ''}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        trigger: { ...prev.trigger!, delay: Number(e.target.value) || undefined }
                      }))}
                      placeholder="0"
                      className="w-24"
                    />
                    <span className="text-sm text-gray-500">minutes</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Actions Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Settings className="w-5 h-5" />
                Actions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Do these actions...</Label>
                <div className="flex gap-2">
                  {actionTypes.slice(0, 4).map(action => {
                    const Icon = action.icon;
                    return (
                      <Button
                        key={action.value}
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => addAction(action.value as any)}
                        title={action.label}
                      >
                        <Icon className="w-4 h-4" />
                      </Button>
                    );
                  })}
                </div>
              </div>

              {formData.actions?.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  No actions configured. Add an action above to get started.
                </div>
              )}

              {formData.actions?.map((action, index) => (
                <ActionEditor
                  key={index}
                  action={action}
                  index={index}
                  onUpdate={(updatedAction) => updateAction(index, updatedAction)}
                  onRemove={() => removeAction(index)}
                />
              ))}
            </CardContent>
          </Card>

          {/* Save/Cancel */}
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleSave}>
              {workflow ? 'Update Workflow' : 'Create Workflow'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface ActionEditorProps {
  action: WorkflowAction;
  index: number;
  onUpdate: (action: WorkflowAction) => void;
  onRemove: () => void;
}

function ActionEditor({ action, index, onUpdate, onRemove }: ActionEditorProps) {
  const { data: templatesData } = useQuery<{ templates: { id: string; name: string; subject: string; category: string }[] }>({
    queryKey: ['/api/workflow-email/templates', 'active'],
    queryFn: async () => {
      const res = await fetch('/api/workflow-email/templates?isActive=true');
      if (!res.ok) return { templates: [] };
      return res.json();
    },
    enabled: action.type === 'send_email',
  });

  const emailTemplates = templatesData?.templates || [];

  const getActionIcon = (type: string) => {
    switch (type) {
      case 'create_task': return Calendar;
      case 'send_email': return Mail;
      case 'assign_to_user': return User;
      case 'send_sms': return Phone;
      default: return Settings;
    }
  };

  const Icon = getActionIcon(action.type);

  return (
    <div className="p-4 border rounded-lg space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
            <Icon className="w-4 h-4 text-blue-600" />
          </div>
          <span className="font-medium capitalize">
            {action.type.replace('_', ' ')}
          </span>
          <Badge variant="secondary">#{index + 1}</Badge>
        </div>
        <Button variant="outline" size="sm" onClick={onRemove}>
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>

      {/* Action-specific parameters */}
      {action.type === 'create_task' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Task Title</Label>
            <Input
              value={action.parameters.title}
              onChange={(e) => onUpdate({
                ...action,
                parameters: { ...action.parameters, title: e.target.value }
              })}
              placeholder="Follow up with contact"
            />
          </div>
          <div>
            <Label className="text-xs">Task Type</Label>
            <Select 
              value={action.parameters.type}
              onValueChange={(value) => onUpdate({
                ...action,
                parameters: { ...action.parameters, type: value }
              })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="call">Call</SelectItem>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="meeting">Meeting</SelectItem>
                <SelectItem value="follow_up">Follow Up</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {action.type === 'send_email' && (
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Recipient</Label>
            <Select
              value={action.parameters.recipientType || 'deal_owner'}
              onValueChange={(value) => {
                const to = value === 'deal_owner' ? 'deal_owner' : value === 'contact' ? 'primary_contact' : '';
                onUpdate({
                  ...action,
                  parameters: { ...action.parameters, recipientType: value, to }
                });
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="deal_owner">Deal Owner</SelectItem>
                <SelectItem value="contact">Primary Contact</SelectItem>
                <SelectItem value="custom">Custom Email</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {action.parameters.recipientType === 'custom' && (
            <div>
              <Label className="text-xs">Email Address</Label>
              <Input
                value={action.parameters.to || ''}
                onChange={(e) => onUpdate({
                  ...action,
                  parameters: { ...action.parameters, to: e.target.value }
                })}
                placeholder="email@example.com or {{contact.email}}"
              />
            </div>
          )}
          <div>
            <Label className="text-xs">Content Source</Label>
            <Select
              value={action.parameters.templateId !== undefined ? 'template' : 'custom'}
              onValueChange={(value) => {
                if (value === 'template') {
                  // Initialize templateId to empty string to enter template mode
                  onUpdate({
                    ...action,
                    parameters: { ...action.parameters, templateId: '', subject: undefined, body: undefined }
                  });
                } else {
                  // Remove templateId to enter custom mode
                  const { templateId: _removed, ...rest } = action.parameters;
                  onUpdate({ ...action, parameters: rest });
                }
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="template">Use Template</SelectItem>
                <SelectItem value="custom">Custom Content</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {action.parameters.templateId !== undefined ? (
            <div>
              <Label className="text-xs">Select Template</Label>
              <Select
                value={action.parameters.templateId || ''}
                onValueChange={(val) => onUpdate({
                  ...action,
                  parameters: { ...action.parameters, templateId: val }
                })}
              >
                <SelectTrigger className="text-sm">
                  <SelectValue placeholder="Choose a template..." />
                </SelectTrigger>
                <SelectContent>
                  {emailTemplates.length === 0 && (
                    <div className="px-3 py-2 text-xs text-gray-400 italic">No templates available</div>
                  )}
                  {emailTemplates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      <span>{t.name}</span>
                      <span className="text-gray-400 text-xs ml-2">({t.category})</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <>
              <div>
                <Label className="text-xs">Subject</Label>
                <Input
                  value={action.parameters.subject || ''}
                  onChange={(e) => onUpdate({
                    ...action,
                    parameters: { ...action.parameters, subject: e.target.value }
                  })}
                  placeholder="{{deal.propertyName}} — Update"
                />
              </div>
              <div>
                <Label className="text-xs">Body</Label>
                <Textarea
                  value={action.parameters.body || ''}
                  onChange={(e) => onUpdate({
                    ...action,
                    parameters: { ...action.parameters, body: e.target.value }
                  })}
                  placeholder="<p>Hello {{contact.firstName}},</p>"
                  rows={3}
                  className="font-mono text-xs"
                />
              </div>
            </>
          )}
        </div>
      )}

      {/* Delay */}
      <div className="flex items-center gap-2">
        <Label className="text-xs">Wait before action:</Label>
        <Input
          type="number"
          value={action.delay || ''}
          onChange={(e) => onUpdate({
            ...action,
            delay: Number(e.target.value) || undefined
          })}
          placeholder="0"
          className="w-20"
        />
        <span className="text-xs text-gray-500">minutes</span>
      </div>
    </div>
  );
}
