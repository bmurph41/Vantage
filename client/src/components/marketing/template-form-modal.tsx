import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { z } from "zod";
import { FileText } from "lucide-react";
import { StandardDialogShell } from "@/components/ui/standard-dialog-shell";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { EmailTemplate } from "@shared/schema";

const templateFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  subject: z.string().min(1, "Subject is required"),
  htmlBody: z.string().min(1, "Email body is required"),
  category: z.string().optional(),
});

type TemplateFormData = z.infer<typeof templateFormSchema>;

interface TemplateFormModalProps {
  open: boolean;
  onClose: () => void;
  template?: EmailTemplate | null;
}

export function TemplateFormModal({ open, onClose, template }: TemplateFormModalProps) {
  const { toast } = useToast();
  const isEditing = !!template;

  const form = useForm<TemplateFormData>({
    resolver: zodResolver(templateFormSchema),
    defaultValues: {
      name: "",
      description: "",
      subject: "",
      htmlBody: "",
      category: "",
    },
  });

  useEffect(() => {
    if (template) {
      form.reset({
        name: template.name,
        description: template.description || "",
        subject: template.subject,
        htmlBody: template.htmlBody,
        category: template.category || "",
      });
    } else {
      form.reset({
        name: "",
        description: "",
        subject: "",
        htmlBody: "",
        category: "",
      });
    }
  }, [template]);

  const createMutation = useMutation({
    mutationFn: async (data: TemplateFormData) => {
      return await apiRequest("/api/email-templates", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/email-templates"] });
      toast({
        title: "Template created",
        description: "Email template has been created successfully.",
      });
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create template. Please try again.",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: TemplateFormData) => {
      return await apiRequest(`/api/email-templates/${template!.id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/email-templates"] });
      toast({
        title: "Template updated",
        description: "Email template has been updated successfully.",
      });
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update template. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: TemplateFormData) => {
    if (isEditing) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <StandardDialogShell
      open={open}
      onOpenChange={(open) => !open && onClose()}
      title={isEditing ? "Edit Email Template" : "Create Email Template"}
      description={isEditing 
        ? "Update your email template"
        : "Create a reusable email template for your sequences"}
      icon={FileText}
      size="lg"
      primaryAction={{
        label: isEditing ? "Update Template" : "Create Template",
        onClick: form.handleSubmit(onSubmit),
        disabled: isPending,
        loading: isPending,
      }}
      secondaryAction={{
        label: "Cancel",
        onClick: onClose,
        disabled: isPending,
      }}
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" data-testid="modal-template-form">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Template Name *</FormLabel>
                <FormControl>
                  <Input 
                    placeholder="e.g., Welcome Email, Follow-up #1" 
                    {...field} 
                    data-testid="input-template-name"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="category"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Category</FormLabel>
                <FormControl>
                  <Input 
                    placeholder="e.g., Onboarding, Sales, Support" 
                    {...field} 
                    data-testid="input-template-category"
                  />
                </FormControl>
                <FormDescription>
                  Optional category to organize your templates
                </FormDescription>
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
                  <Input 
                    placeholder="Brief description of this template" 
                    {...field} 
                    data-testid="input-template-description"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="subject"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email Subject *</FormLabel>
                <FormControl>
                  <Input 
                    placeholder="Welcome to MarinaMatch!" 
                    {...field} 
                    data-testid="input-template-subject"
                  />
                </FormControl>
                <FormDescription>
                  You can use variables like {"{firstName}"}, {"{companyName}"}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="htmlBody"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email Body *</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Hi {firstName},&#10;&#10;Welcome to MarinaMatch...&#10;&#10;Best regards,&#10;The Team"
                    className="min-h-[200px] font-mono text-sm"
                    {...field}
                    data-testid="input-template-body"
                  />
                </FormControl>
                <FormDescription>
                  You can use HTML and variables like {"{firstName}"}, {"{lastName}"}, {"{companyName}"}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </form>
      </Form>
    </StandardDialogShell>
  );
}
