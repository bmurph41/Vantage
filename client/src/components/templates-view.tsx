import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, X, Loader2 } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState } from "react";
import { ddClient } from "@/lib/ddClient";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { insertProjectTemplateSchema } from "@shared/schema";

interface TemplatesViewProps {
  projectId: string;
}

// Form schema for template creation
const templateFormSchema = insertProjectTemplateSchema.extend({
  description: z.string().default(""),
  tasksBlueprint: z.array(z.string().min(1, "Task name cannot be empty")).min(1, "At least one task is required"),
}).omit({ orgId: true });

type TemplateFormData = z.infer<typeof templateFormSchema>;

export function TemplatesView({ projectId }: TemplatesViewProps) {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isApplyDialogOpen, setIsApplyDialogOpen] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const { toast } = useToast();

  const { data: projectTemplates = [] } = useQuery({
    queryKey: ['/api/dd/project-templates'],
    queryFn: () => ddClient.getProjectTemplates(),
  });

  const form = useForm<TemplateFormData>({
    resolver: zodResolver(templateFormSchema),
    defaultValues: {
      name: "",
      description: "",
      tasksBlueprint: [""],
    },
  });

  const createTemplateMutation = useMutation({
    mutationFn: (data: TemplateFormData) => ddClient.createProjectTemplate(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/dd/project-templates'] });
      setIsCreateModalOpen(false);
      form.reset();
      toast({
        title: "Template created",
        description: "The template has been created successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create template. Please try again.",
        variant: "destructive",
      });
    },
  });

  const applyTemplateMutation = useMutation({
    mutationFn: (templateId: string) => ddClient.applyTemplate(projectId, templateId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/dd/projects', projectId, 'tasks'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dd/projects', projectId] });
      setIsApplyDialogOpen(false);
      setSelectedTemplateId(null);
      toast({
        title: "Template applied",
        description: "The template has been applied successfully. Tasks have been created.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to apply template. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleCreateTemplate = (data: TemplateFormData) => {
    createTemplateMutation.mutate(data);
  };

  const handleApplyTemplate = () => {
    if (selectedTemplateId) {
      applyTemplateMutation.mutate(selectedTemplateId);
    }
  };

  const addTaskField = () => {
    const currentTasks = form.getValues("tasksBlueprint");
    form.setValue("tasksBlueprint", [...currentTasks, ""]);
  };

  const removeTaskField = (index: number) => {
    const currentTasks = form.getValues("tasksBlueprint");
    if (currentTasks.length > 1) {
      form.setValue("tasksBlueprint", currentTasks.filter((_, i) => i !== index));
    }
  };

  return (
    <div className="max-w-4xl mx-auto" data-testid="templates-view">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Templates</CardTitle>
            <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
              <DialogTrigger asChild>
                <Button size="sm" data-testid="button-create-template">
                  <Plus className="h-4 w-4 mr-2" />
                  New Template
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                  <DialogTitle>Create New Template</DialogTitle>
                </DialogHeader>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(handleCreateTemplate)} className="space-y-4">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Template Name</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Enter template name"
                              data-testid="input-template-name"
                              {...field}
                            />
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
                          <FormLabel>Description (Optional)</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Enter template description"
                              data-testid="input-template-description"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="space-y-2">
                      <FormLabel>Tasks</FormLabel>
                      {form.watch("tasksBlueprint").map((_, index) => (
                        <FormField
                          key={index}
                          control={form.control}
                          name={`tasksBlueprint.${index}`}
                          render={({ field }) => (
                            <FormItem>
                              <div className="flex gap-2">
                                <FormControl>
                                  <Input
                                    placeholder={`Task ${index + 1} name`}
                                    data-testid={`input-task-${index}`}
                                    {...field}
                                  />
                                </FormControl>
                                {form.watch("tasksBlueprint").length > 1 && (
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="icon"
                                    onClick={() => removeTaskField(index)}
                                    data-testid={`button-remove-task-${index}`}
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      ))}
                      <Button
                        type="button"
                        variant="outline"
                        onClick={addTaskField}
                        className="w-full"
                        data-testid="button-add-task"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add Task
                      </Button>
                    </div>
                    <div className="flex justify-end gap-2 pt-4">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setIsCreateModalOpen(false);
                          form.reset();
                        }}
                        data-testid="button-cancel-template"
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        disabled={createTemplateMutation.isPending}
                        data-testid="button-save-template"
                      >
                        {createTemplateMutation.isPending && (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        )}
                        Create Template
                      </Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {projectTemplates.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No templates available
              </div>
            ) : (
              projectTemplates.map((template) => (
                <div 
                  key={template.id}
                  className="p-4 border border-border rounded-lg hover:bg-accent/50 transition-colors"
                  data-testid={`project-template-${template.id}`}
                >
                  <div className="flex justify-between items-start gap-3">
                    <div className="flex-1">
                      <div className="font-medium text-lg mb-1">{template.name}</div>
                      <div className="text-sm text-muted-foreground mb-3">
                        {template.description || "No description"}
                      </div>
                      {template.tasksBlueprint && template.tasksBlueprint.length > 0 && (
                        <div className="text-xs text-muted-foreground">
                          <span className="font-medium">
                            {template.tasksBlueprint.length} task{template.tasksBlueprint.length !== 1 ? 's' : ''}
                          </span>
                          : {template.tasksBlueprint.slice(0, 3).join(", ")}
                          {template.tasksBlueprint.length > 3 && ` +${template.tasksBlueprint.length - 3} more`}
                        </div>
                      )}
                    </div>
                    <Button
                      size="sm"
                      onClick={() => {
                        setSelectedTemplateId(template.id);
                        setIsApplyDialogOpen(true);
                      }}
                      disabled={applyTemplateMutation.isPending}
                      data-testid={`button-apply-template-${template.id}`}
                    >
                      {applyTemplateMutation.isPending && selectedTemplateId === template.id ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : null}
                      Apply Template
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={isApplyDialogOpen} onOpenChange={setIsApplyDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apply Template</AlertDialogTitle>
            <AlertDialogDescription>
              This will create new tasks based on the selected template. Are you sure you want to proceed?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setIsApplyDialogOpen(false);
                setSelectedTemplateId(null);
              }}
              data-testid="button-cancel-apply"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleApplyTemplate}
              disabled={applyTemplateMutation.isPending}
              data-testid="button-confirm-apply"
            >
              {applyTemplateMutation.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Apply Template
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}