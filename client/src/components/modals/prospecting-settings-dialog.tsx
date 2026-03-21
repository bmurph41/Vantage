import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Settings, Plus, Trash2, Edit } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { CrmProspectingUserSettings, CrmProspectingGoalTemplate } from "@shared/schema";

export function ProspectingSettingsDialog() {
  const [open, setOpen] = useState(false);
  const [weekStartDay, setWeekStartDay] = useState<'monday' | 'sunday'>('monday');
  const [editingTemplate, setEditingTemplate] = useState<CrmProspectingGoalTemplate | null>(null);
  const [isAddingTemplate, setIsAddingTemplate] = useState(false);
  const [templateForm, setTemplateForm] = useState({
    name: '',
    frequency: 'weekly' as 'weekly' | 'monthly',
    metricType: 'calls' as string,
    targetValue: ''
  });
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch user settings
  const { data: settings } = useQuery<CrmProspectingUserSettings>({
    queryKey: ['/api/prospecting/settings'],
    enabled: open
  });

  // Fetch goal templates
  const { data: templates = [] } = useQuery<CrmProspectingGoalTemplate[]>({
    queryKey: ['/api/prospecting/goal-templates'],
    enabled: open
  });

  // Update settings when data loads
  useEffect(() => {
    if (settings?.weekStartDay) {
      setWeekStartDay(settings.weekStartDay);
    }
  }, [settings]);

  // Update settings mutation
  const updateSettingsMutation = useMutation({
    mutationFn: async (updates: Partial<CrmProspectingUserSettings>) => {
      return apiRequest('/api/prospecting/settings', {
        method: 'PUT',
        body: JSON.stringify(updates),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/prospecting/settings'] });
      toast({
        title: "Settings updated",
        description: "Your prospecting settings have been saved.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update settings.",
        variant: "destructive",
      });
    }
  });

  // Create template mutation
  const createTemplateMutation = useMutation({
    mutationFn: async (template: any) => {
      return apiRequest('/api/prospecting/goal-templates', {
        method: 'POST',
        body: JSON.stringify(template),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/prospecting/goal-templates'] });
      setIsAddingTemplate(false);
      resetTemplateForm();
      toast({
        title: "Template created",
        description: "Goal template has been added.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create template.",
        variant: "destructive",
      });
    }
  });

  // Update template mutation
  const updateTemplateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: any }) => {
      return apiRequest(`/api/prospecting/goal-templates/${id}`, {
        method: 'PUT',
        body: JSON.stringify(updates),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/prospecting/goal-templates'] });
      setEditingTemplate(null);
      resetTemplateForm();
      toast({
        title: "Template updated",
        description: "Goal template has been saved.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update template.",
        variant: "destructive",
      });
    }
  });

  // Delete template mutation
  const deleteTemplateMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(`/api/prospecting/goal-templates/${id}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/prospecting/goal-templates'] });
      toast({
        title: "Template deleted",
        description: "Goal template has been removed.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete template.",
        variant: "destructive",
      });
    }
  });

  const resetTemplateForm = () => {
    setTemplateForm({
      name: '',
      frequency: 'weekly',
      metricType: 'calls',
      targetValue: ''
    });
  };

  const handleWeekStartChange = (value: string) => {
    const newValue = value as 'monday' | 'sunday';
    setWeekStartDay(newValue);
    updateSettingsMutation.mutate({ weekStartDay: newValue });
  };

  const handleSaveTemplate = () => {
    const targetValue = parseInt(templateForm.targetValue);
    if (!templateForm.name || isNaN(targetValue)) {
      toast({
        title: "Validation error",
        description: "Please fill in all fields with valid values.",
        variant: "destructive",
      });
      return;
    }

    const templateData = {
      name: templateForm.name,
      frequency: templateForm.frequency,
      metricsPayload: {
        metricType: templateForm.metricType,
        targetValue
      }
    };

    if (editingTemplate) {
      updateTemplateMutation.mutate({
        id: editingTemplate.id,
        updates: templateData
      });
    } else {
      createTemplateMutation.mutate(templateData);
    }
  };

  const startEditTemplate = (template: CrmProspectingGoalTemplate) => {
    setEditingTemplate(template);
    setIsAddingTemplate(true);
    const metrics = template.metricsPayload as any;
    setTemplateForm({
      name: template.name,
      frequency: template.frequency,
      metricType: metrics?.metricType || 'calls',
      targetValue: metrics?.targetValue?.toString() || ''
    });
  };

  const handleCancelEdit = () => {
    setEditingTemplate(null);
    setIsAddingTemplate(false);
    resetTemplateForm();
  };

  const metricTypeOptions = [
    { value: 'calls', label: 'Calls Made' },
    { value: 'emails', label: 'Emails Sent' },
    { value: 'meetings', label: 'Meetings Booked' },
    { value: 'contacts', label: 'Contacts Added' },
    { value: 'deals', label: 'Deals Created' },
    { value: 'activities', label: 'Total Activities' }
  ];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" data-testid="button-prospecting-settings">
          <Settings className="w-4 h-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="w-full sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Prospecting Settings</DialogTitle>
          <DialogDescription>
            Customize your prospecting preferences and recurring goal templates.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="week-start" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="week-start" data-testid="tab-week-start">Week Start Day</TabsTrigger>
            <TabsTrigger value="recurring-goals" data-testid="tab-recurring-goals">Recurring Goals</TabsTrigger>
          </TabsList>

          <TabsContent value="week-start" className="space-y-4 mt-4">
            <div className="space-y-3">
              <Label>Select your preferred week start day</Label>
              <RadioGroup value={weekStartDay} onValueChange={handleWeekStartChange}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="monday" id="monday" data-testid="radio-monday" />
                  <Label htmlFor="monday" className="cursor-pointer">Monday</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="sunday" id="sunday" data-testid="radio-sunday" />
                  <Label htmlFor="sunday" className="cursor-pointer">Sunday</Label>
                </div>
              </RadioGroup>
              <p className="text-sm text-muted-foreground">
                This setting affects how weeks are calculated in your prospecting tracker.
              </p>
            </div>
          </TabsContent>

          <TabsContent value="recurring-goals" className="space-y-4 mt-4">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-muted-foreground">
                Create templates for goals that recur weekly or monthly.
              </p>
              {!isAddingTemplate && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsAddingTemplate(true)}
                  data-testid="button-add-template"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Template
                </Button>
              )}
            </div>

            {isAddingTemplate && (
              <Card>
                <CardContent className="pt-6 space-y-4">
                  <div>
                    <Label htmlFor="template-name">Goal Name</Label>
                    <Input
                      id="template-name"
                      value={templateForm.name}
                      onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })}
                      placeholder="e.g., Weekly Outreach Target"
                      data-testid="input-template-name"
                    />
                  </div>

                  <div>
                    <Label htmlFor="template-frequency">Frequency</Label>
                    <Select
                      value={templateForm.frequency}
                      onValueChange={(value) => setTemplateForm({ ...templateForm, frequency: value as 'weekly' | 'monthly' })}
                    >
                      <SelectTrigger id="template-frequency" data-testid="select-template-frequency">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="template-metric">Metric Type</Label>
                    <Select
                      value={templateForm.metricType}
                      onValueChange={(value) => setTemplateForm({ ...templateForm, metricType: value })}
                    >
                      <SelectTrigger id="template-metric" data-testid="select-template-metric">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {metricTypeOptions.map(option => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="template-target">Target Value</Label>
                    <Input
                      id="template-target"
                      type="number"
                      value={templateForm.targetValue}
                      onChange={(e) => setTemplateForm({ ...templateForm, targetValue: e.target.value })}
                      placeholder="e.g., 50"
                      data-testid="input-template-target"
                    />
                  </div>

                  <div className="flex gap-2 justify-end">
                    <Button
                      variant="outline"
                      onClick={handleCancelEdit}
                      data-testid="button-cancel-template"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleSaveTemplate}
                      disabled={createTemplateMutation.isPending || updateTemplateMutation.isPending}
                      data-testid="button-save-template"
                    >
                      {editingTemplate ? 'Update' : 'Create'} Template
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="space-y-2">
              {templates.map((template) => {
                const metrics = template.metricsPayload as any;
                const metricLabel = metricTypeOptions.find(opt => opt.value === metrics?.metricType)?.label || metrics?.metricType;
                
                return (
                  <Card key={template.id} data-testid={`template-card-${template.id}`}>
                    <CardContent className="pt-4 pb-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-medium">{template.name}</h4>
                          <p className="text-sm text-muted-foreground">
                            {template.frequency.charAt(0).toUpperCase() + template.frequency.slice(1)} • {metricLabel}: {metrics?.targetValue}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => startEditTemplate(template)}
                            data-testid={`button-edit-template-${template.id}`}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteTemplateMutation.mutate(template.id)}
                            disabled={deleteTemplateMutation.isPending}
                            data-testid={`button-delete-template-${template.id}`}
                          >
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}

              {templates.length === 0 && !isAddingTemplate && (
                <p className="text-center text-sm text-muted-foreground py-8">
                  No recurring goal templates yet. Click "Add Template" to create one.
                </p>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
