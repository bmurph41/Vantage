import { useState, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { Activity } from "lucide-react";
import { StandardDialogShell } from "@/components/ui/standard-dialog-shell";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { insertActivitySchema, type ActivityTemplate } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";

const activityFormSchema = insertActivitySchema.extend({
  scheduledAt: z.string().optional(),
  entityId: z.string().nullable().optional(),
});

type ActivityFormValues = z.infer<typeof activityFormSchema>;

interface ActivityComposerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templates: ActivityTemplate[];
  defaultDate?: Date;
}

export function ActivityComposerModal({ 
  open,
  onOpenChange,
  templates, 
  defaultDate
}: ActivityComposerModalProps) {
  const { toast } = useToast();
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const formRef = useRef<HTMLFormElement>(null);

  const form = useForm<ActivityFormValues>({
    resolver: zodResolver(activityFormSchema),
    defaultValues: {
      type: "call",
      subject: "",
      description: "",
      status: "completed",
      direction: "outbound",
      entityType: "general",
      entityId: undefined,
      scheduledAt: defaultDate ? (() => {
        const d = new Date(defaultDate);
        d.setHours(12, 0, 0, 0);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const hours = String(d.getHours()).padStart(2, '0');
        const minutes = String(d.getMinutes()).padStart(2, '0');
        return `${year}-${month}-${day}T${hours}:${minutes}`;
      })() : "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (values: ActivityFormValues) => {
      const data = {
        ...values,
        entityId: values.entityId || null,
        scheduledAt: values.scheduledAt ? new Date(values.scheduledAt).toISOString() : undefined,
      };
      return apiRequest('/api/activities', {
        method: 'POST',
        body: JSON.stringify(data),
        headers: { 'Content-Type': 'application/json' },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/activities'] });
      toast({ title: "Activity created successfully" });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({ title: "Failed to create activity", description: error.message, variant: "destructive" });
    },
  });

  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplate(templateId);
    const template = templates.find(t => t.id === templateId);
    if (template) {
      form.setValue("type", template.type);
      form.setValue("subject", template.subjectTemplate || "");
      form.setValue("description", template.descriptionTemplate || "");
      if (template.defaultDuration) {
        form.setValue("duration", template.defaultDuration);
      }
      if (template.defaultDirection) {
        form.setValue("direction", template.defaultDirection);
      }
    }
  };

  const onSubmit = (values: ActivityFormValues) => {
    createMutation.mutate(values);
  };

  const handlePrimaryAction = () => {
    formRef.current?.requestSubmit();
  };

  return (
    <StandardDialogShell
      open={open}
      onOpenChange={onOpenChange}
      title="Create Activity"
      icon={Activity}
      size="lg"
      primaryAction={{
        label: "Create Activity",
        onClick: handlePrimaryAction,
        disabled: createMutation.isPending,
        loading: createMutation.isPending,
      }}
      secondaryAction={{
        label: "Cancel",
        onClick: () => onOpenChange(false),
      }}
    >
      <div data-testid="modal-activity-composer">
        <Form {...form}>
          <form ref={formRef} onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {templates.length > 0 && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Template</label>
                <Select value={selectedTemplate} onValueChange={handleTemplateSelect}>
                  <SelectTrigger data-testid="select-activity-template">
                    <SelectValue placeholder="Choose a template..." />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map((template) => (
                      <SelectItem key={template.id} value={template.id}>
                        {template.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Activity Type</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger data-testid="select-activity-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="call">Call</SelectItem>
                      <SelectItem value="email">Email</SelectItem>
                      <SelectItem value="sms">SMS</SelectItem>
                      <SelectItem value="meeting">Meeting</SelectItem>
                      <SelectItem value="showing">Property Showing</SelectItem>
                      <SelectItem value="note">Note</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="subject"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Subject</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value || ""} placeholder="Activity subject" data-testid="input-activity-subject" />
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
                    <Textarea 
                      {...field} 
                      placeholder="Activity details..." 
                      rows={4}
                      data-testid="textarea-activity-description"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select value={field.value || "completed"} onValueChange={field.onChange}>
                      <SelectTrigger data-testid="select-activity-status">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="scheduled">Scheduled</SelectItem>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="direction"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Direction</FormLabel>
                    <Select value={field.value || ""} onValueChange={field.onChange}>
                      <SelectTrigger data-testid="select-activity-direction">
                        <SelectValue placeholder="Select direction" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="inbound">Inbound</SelectItem>
                        <SelectItem value="outbound">Outbound</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="scheduledAt"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Scheduled Date/Time</FormLabel>
                  <FormControl>
                    <Input 
                      type="datetime-local" 
                      {...field} 
                      value={field.value || ""}
                      data-testid="input-activity-scheduled"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </form>
        </Form>
      </div>
    </StandardDialogShell>
  );
}
