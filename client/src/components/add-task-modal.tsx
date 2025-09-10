import { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Clock, DollarSign, Users, AlertCircle, Save, CheckCircle, XCircle, Calendar, Play, Circle } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { useCreateTask, useUpdateTask } from "@/hooks/use-tasks";
import { marinaDueDiligenceTaskTemplates, taskCategories, searchTasks, type TaskTemplate } from "@/data/marina-due-diligence-tasks";
import type { Task } from "@shared/schema";

const addTaskFormSchema = z.object({
  title: z.string().min(1, "Task title is required"),
  description: z.string().optional(),
  startStrategy: z.enum(["fixed", "offset"]),
  startDate: z.string().optional(),
  startOffsetDays: z.number().optional(),
  // New deadline fields
  deadlineType: z.enum(["dd_expiration"]).default("dd_expiration"),
  assignee: z.string().optional(),
  companyHired: z.string().optional(),
  repName: z.string().optional(),
  repEmail: z.string().optional(),
  repPhone: z.string().optional(),
  priority: z.enum(["low", "med", "high"]),
  status: z.enum(["to_do", "scheduled", "in_progress", "completed", "not_started", "blocked"]).default("to_do"),
  paymentStatus: z.enum(["not_paid", "paid"]).default("not_paid"),
  dateOnSite: z.string().optional(),
  completedAt: z.string().optional(),
  cost: z.string().optional(),
  notes: z.string().optional(),
  showOnTimeline: z.boolean().default(false),
});

interface AddTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  editingTask?: Task | null;
}

export function AddTaskModal({ isOpen, onClose, projectId, editingTask }: AddTaskModalProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedTemplate, setSelectedTemplate] = useState<TaskTemplate | null>(null);
  const [step, setStep] = useState<"browse" | "customize">("browse");
  const [autoSaveStatus, setAutoSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  
  const { toast } = useToast();
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const [autoSaveTimeout, setAutoSaveTimeout] = useState<NodeJS.Timeout | null>(null);
  
  const isEditMode = !!editingTask;

  // Currency formatting utility
  const formatCurrency = (value: string): string => {
    if (!value) return "";
    
    // Remove any non-numeric characters except decimal points
    const numericValue = value.replace(/[^\d.]/g, "");
    
    // If empty or just a decimal point, return as is
    if (!numericValue || numericValue === ".") return numericValue;
    
    // Parse as number and format with commas and dollar sign
    const number = parseFloat(numericValue);
    if (isNaN(number)) return numericValue;
    
    // Format with dollar sign and commas, no decimal places for whole numbers
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: number % 1 === 0 ? 0 : 2,
      maximumFractionDigits: 2
    }).format(number);
  };

  // Handle cost field formatting
  const handleCostBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const formatted = formatCurrency(e.target.value);
    form.setValue("cost", formatted);
  };

  const form = useForm<z.infer<typeof addTaskFormSchema>>({
    resolver: zodResolver(addTaskFormSchema),
    defaultValues: {
      title: "",
      description: "",
      startStrategy: "offset",
      startDate: "",
      startOffsetDays: 0,

      deadlineType: "dd_expiration",

      assignee: "",
      companyHired: "",
      repName: "",
      repEmail: "",
      repPhone: "",
      priority: "med",
      status: "to_do",
      paymentStatus: "not_paid",
      dateOnSite: "",
      completedAt: "",
      cost: "",
      notes: "",
      showOnTimeline: false,
    },
  });

  // Reset form when editingTask changes or modal opens
  useEffect(() => {
    if (isOpen) {
      if (editingTask) {
        // Populate form with editing task data
        form.reset({
          title: editingTask.title || "",
          description: editingTask.description || "",
          startStrategy: editingTask.startStrategy || "offset",
          startDate: editingTask.startDate || "",
          startOffsetDays: editingTask.startOffsetDays || 0,
          deadlineType: "dd_expiration",
          assignee: editingTask.assignee || "",
          companyHired: editingTask.companyHired || "",
          repName: editingTask.repName || "",
          repEmail: editingTask.repEmail || "",
          repPhone: editingTask.repPhone || "",
          priority: editingTask.priority || "med",
          status: editingTask.status || "to_do",
          paymentStatus: editingTask.paymentStatus || "not_paid",
          dateOnSite: editingTask.dateOnSite || "",
          completedAt: editingTask.completedAt ? new Date(editingTask.completedAt).toISOString().slice(0, 16) : "",
          cost: editingTask.cost || "",
          notes: editingTask.notes || "",
          showOnTimeline: editingTask.showOnTimeline || false,
        });
        setStep("customize"); // Go directly to customize step for editing
      } else {
        // Reset form for new task
        form.reset({
          title: "",
          description: "",
          startStrategy: "offset",
          startDate: "",
          startOffsetDays: 0,
    
          deadlineType: "dd_expiration",
    
          assignee: "",
          companyHired: "",
          repName: "",
          repEmail: "",
          repPhone: "",
          priority: "med",
          status: "to_do",
          paymentStatus: "not_paid",
          dateOnSite: "",
          completedAt: "",
          cost: "",
          notes: "",
          showOnTimeline: false,
        });
        setStep("browse"); // Start with browse step for new tasks
      }
    }
  }, [isOpen, editingTask, form]);

  // Auto-save functionality
  const autoSave = useCallback(
    (formData: z.infer<typeof addTaskFormSchema>) => {
      if (isEditMode && editingTask) {
        setAutoSaveStatus("saving");
        // Transform completedAt string to Date object
        const transformedData = {
          ...formData,
          completedAt: formData.completedAt ? new Date(formData.completedAt) : undefined,
        };
        updateTask.mutate(
          {
            id: editingTask.id,
            updates: transformedData,
          },
          {
            onSuccess: () => {
              setAutoSaveStatus("saved");
              setTimeout(() => setAutoSaveStatus("idle"), 2000); // Show "saved" for 2 seconds
            },
            onError: () => {
              setAutoSaveStatus("error");
              setTimeout(() => setAutoSaveStatus("idle"), 3000); // Show error for 3 seconds
            },
          }
        );
      }
    },
    [isEditMode, editingTask, updateTask]
  );

  // Watch form changes and auto-save after 2 seconds of inactivity
  useEffect(() => {
    if (!isEditMode || !editingTask) return;

    const subscription = form.watch((formData) => {
      // Clear previous timeout
      if (autoSaveTimeout) {
        clearTimeout(autoSaveTimeout);
      }

      // Set new timeout for auto-save
      const timeout = setTimeout(() => {
        const validationResult = addTaskFormSchema.safeParse(formData);
        if (validationResult.success) {
          autoSave(validationResult.data);
        }
      }, 2000); // Auto-save after 2 seconds of inactivity

      setAutoSaveTimeout(timeout);
    });

    return () => {
      subscription.unsubscribe();
      if (autoSaveTimeout) {
        clearTimeout(autoSaveTimeout);
      }
    };
  }, [form, autoSave, isEditMode, editingTask, autoSaveTimeout]);

  // Filter tasks based on search and category
  const filteredTasks = marinaDueDiligenceTaskTemplates.filter(task => {
    const matchesSearch = searchTerm === "" || searchTasks(searchTerm).includes(task);
    const matchesCategory = selectedCategory === "all" || task.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleTemplateSelect = (template: TaskTemplate) => {
    setSelectedTemplate(template);
    
    // Populate form with template data
    form.reset({
      title: template.name,
      description: template.description,
      startStrategy: "offset",
      startOffsetDays: template.startOffsetDays,
      deadlineType: "dd_expiration" as const,
      assignee: template.defaultAssignee || "",
      companyHired: "",
      priority: template.priority as "low" | "med" | "high",
      cost: template.estimatedCost || "",
      notes: "",
      showOnTimeline: false,
    });
    
    setStep("customize");
  };

  const handleCreateCustomTask = () => {
    setSelectedTemplate(null);
    
    // Reset form with blank data for custom task
    form.reset({
      title: "",
      description: "",
      startStrategy: "offset",
      startDate: "",
      startOffsetDays: 0,
      deadlineType: "dd_expiration",
      assignee: "",
      companyHired: "",
      repName: "",
      repEmail: "",
      repPhone: "",
      priority: "med",
      status: "to_do",
      paymentStatus: "not_paid",
      dateOnSite: "",
      completedAt: "",
      cost: "",
      notes: "",
      showOnTimeline: false,
    });
    
    setStep("customize");
  };

  const handleBack = () => {
    setStep("browse");
    setSelectedTemplate(null);
    form.reset();
  };

  const handleClose = () => {
    setStep("browse");
    setSelectedTemplate(null);
    setSearchTerm("");
    setSelectedCategory("all");
    form.reset();
    onClose();
  };

  const onSubmit = (data: z.infer<typeof addTaskFormSchema>) => {
    // Transform completedAt string to Date object
    const transformedData = {
      ...data,
      completedAt: data.completedAt ? new Date(data.completedAt) : undefined,
    };

    if (isEditMode && editingTask) {
      // Update existing task
      updateTask.mutate(
        {
          id: editingTask.id,
          updates: transformedData,
        },
        {
          onSuccess: () => {
            toast({
              title: "Success",
              description: "Task updated successfully",
            });
            handleClose();
          },
        }
      );
    } else {
      // Create new task
      const taskData = {
        ...transformedData,
        projectId,
        status: "to_do" as const,
      };

      createTask.mutate(
        { projectId, task: taskData },
        {
          onSuccess: () => {
            toast({
              title: "Success",
              description: "Task added successfully",
            });
            handleClose();
          },
        }
      );
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high": return "bg-red-100 text-red-800";
      case "med": return "bg-yellow-100 text-yellow-800";
      case "low": return "bg-green-100 text-green-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const getAutoSaveIndicator = () => {
    switch (autoSaveStatus) {
      case "saving":
        return (
          <div className="flex items-center space-x-1 text-blue-600">
            <Save className="h-3 w-3 animate-pulse" />
            <span className="text-xs">Saving...</span>
          </div>
        );
      case "saved":
        return (
          <div className="flex items-center space-x-1 text-green-600">
            <CheckCircle className="h-3 w-3" />
            <span className="text-xs">Saved</span>
          </div>
        );
      case "error":
        return (
          <div className="flex items-center space-x-1 text-red-600">
            <XCircle className="h-3 w-3" />
            <span className="text-xs">Save failed</span>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>
              {isEditMode 
                ? "Edit Task" 
                : step === "browse" 
                  ? "Add Due Diligence Task" 
                  : `Customize: ${selectedTemplate?.name}`
              }
            </DialogTitle>
            {isEditMode && getAutoSaveIndicator()}
          </div>
          <DialogDescription>
            {isEditMode 
              ? "Modify the task details and save your changes" 
              : step === "browse" 
                ? "Choose from our comprehensive marina due diligence task library" 
                : "Review and customize the task details before adding to your project"
            }
          </DialogDescription>
        </DialogHeader>

        {isEditMode ? (
          // Edit mode - show customize form directly
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <ScrollArea className="h-96 pr-4">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="title">Task Title *</Label>
                  <Input
                    id="title"
                    {...form.register("title")}
                    data-testid="input-task-title"
                  />
                  {form.formState.errors.title && (
                    <p className="text-sm text-destructive mt-1">{form.formState.errors.title.message}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    {...form.register("description")}
                    rows={3}
                    data-testid="textarea-task-description"
                  />
                </div>

                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <Label htmlFor="deadlineType">Deadline *</Label>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-medium">DD Expiration</span>
                      <p className="text-sm text-muted-foreground">Task will be due on DD expiration date</p>
                    </div>
                  </div>
                </div>


                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <Label htmlFor="priority">Priority</Label>
                    <Select
                      value={form.watch("priority")}
                      onValueChange={(value: string) => form.setValue("priority", value as "low" | "med" | "high")}
                    >
                      <SelectTrigger data-testid="select-priority">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="med">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="status">Status</Label>
                    <Select
                      value={form.watch("status")}
                      onValueChange={(value: string) => form.setValue("status", value as any)}
                    >
                      <SelectTrigger data-testid="select-status">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="to_do">
                          <div className="flex items-center gap-2">
                            <Circle className="h-4 w-4 text-gray-500" />
                            <span>To Do</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="scheduled">
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-blue-500" />
                            <span>Scheduled</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="in_progress">
                          <div className="flex items-center gap-2">
                            <Play className="h-4 w-4 text-orange-500" />
                            <span>In Progress</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="completed">
                          <div className="flex items-center gap-2">
                            <CheckCircle className="h-4 w-4 text-green-500" />
                            <span>Completed</span>
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="paymentStatus">Payment</Label>
                    <Select
                      value={form.watch("paymentStatus")}
                      onValueChange={(value: string) => form.setValue("paymentStatus", value as "not_paid" | "paid")}
                    >
                      <SelectTrigger data-testid="select-payment-status">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="not_paid">
                          <div className="flex items-center gap-2">
                            <XCircle className="h-4 w-4 text-red-500" />
                            <span>Not Paid</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="paid">
                          <div className="flex items-center gap-2">
                            <CheckCircle className="h-4 w-4 text-green-500" />
                            <span>Paid</span>
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="completedAt">Completion Date</Label>
                    <Input
                      id="completedAt"
                      type="datetime-local"
                      {...form.register("completedAt")}
                      data-testid="input-completion-date"
                    />
                  </div>
                </div>

                {/* Conditional Date On-Site field when status is "scheduled" */}
                {form.watch("status") === "scheduled" && (
                  <div className="grid grid-cols-1 gap-4">
                    <div>
                      <Label htmlFor="dateOnSite">Date On-Site *</Label>
                      <Input
                        id="dateOnSite"
                        type="text"
                        placeholder="MM/DD/YYYY"
                        {...form.register("dateOnSite")}
                        data-testid="input-date-on-site"
                        pattern="^(0[1-9]|1[012])/(0[1-9]|[12][0-9]|3[01])/[0-9]{4}$"
                        title="Please enter date in MM/DD/YYYY format"
                      />
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="assignee">Task Owner</Label>
                    <Input
                      id="assignee"
                      placeholder="Assign to team member"
                      {...form.register("assignee")}
                      data-testid="input-assignee"
                    />
                  </div>

                  <div>
                    <Label htmlFor="companyHired">Company Hired</Label>
                    <Input
                      id="companyHired"
                      placeholder="Third-party company"
                      {...form.register("companyHired")}
                      data-testid="input-company-hired"
                    />
                  </div>
                </div>

                {/* Rep Contact Info */}
                {form.watch("companyHired") && (
                  <div className="space-y-3 bg-gray-50 p-3 rounded-md">
                    <div className="text-sm font-medium text-gray-700">Rep Contact Information</div>
                    <div className="grid grid-cols-1 gap-3">
                      <div>
                        <Label htmlFor="repName">Rep Name</Label>
                        <Input
                          id="repName"
                          placeholder="Representative name"
                          {...form.register("repName")}
                          data-testid="input-rep-name"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label htmlFor="repEmail">Rep Email</Label>
                          <Input
                            id="repEmail"
                            type="email"
                            placeholder="rep@company.com"
                            {...form.register("repEmail")}
                            data-testid="input-rep-email"
                          />
                        </div>
                        <div>
                          <Label htmlFor="repPhone">Rep Phone</Label>
                          <Input
                            id="repPhone"
                            type="tel"
                            placeholder="(555) 123-4567"
                            {...form.register("repPhone")}
                            data-testid="input-rep-phone"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div>
                  <Label htmlFor="cost">Estimated Cost</Label>
                  <Input
                    id="cost"
                    placeholder="e.g., 5000 or $5,000"
                    {...form.register("cost")}
                    onBlur={handleCostBlur}
                    data-testid="input-cost"
                  />
                </div>

                <div>
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    placeholder="Additional notes or requirements"
                    {...form.register("notes")}
                    rows={2}
                    data-testid="textarea-notes"
                  />
                </div>

                {/* Timeline Display Toggle */}
                <div className="flex items-center space-x-3 p-4 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="showOnTimeline"
                      {...form.register("showOnTimeline")}
                      className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                      data-testid="checkbox-show-on-timeline"
                    />
                    <Label htmlFor="showOnTimeline" className="text-sm font-medium text-gray-900">
                      Display on Timeline
                    </Label>
                  </div>
                  <p className="text-xs text-gray-600">
                    Show this task on the main project timeline overview
                  </p>
                </div>
              </div>
            </ScrollArea>

            {/* Form Actions */}
            <div className="flex justify-end pt-4">
              <div className="flex space-x-2">
                <Button type="button" variant="outline" onClick={handleClose} data-testid="button-cancel">
                  Cancel
                </Button>
                <Button type="submit" disabled={updateTask.isPending} data-testid="button-save-task">
                  {updateTask.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </div>
          </form>
        ) : step === "browse" ? (
          <div className="space-y-4">
            {/* Create Custom Task Button */}
            <div className="flex justify-center p-4 bg-slate-50 rounded-lg border border-slate-200">
              <Button 
                onClick={handleCreateCustomTask}
                className="w-full max-w-sm"
                data-testid="button-create-custom-task"
              >
                Create Custom Task
              </Button>
            </div>
            
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  Or choose from templates
                </span>
              </div>
            </div>

            {/* Search and Filters */}
            <div className="flex space-x-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search tasks, descriptions, or companies..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                  data-testid="input-task-search"
                />
              </div>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="w-64" data-testid="select-task-category">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {taskCategories.map(category => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Task List */}
            <ScrollArea className="h-96">
              <div className="space-y-3">
                {filteredTasks.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No tasks found. Try adjusting your search or category filter.
                  </div>
                ) : (
                  filteredTasks.map((task, index) => (
                    <Card key={index} className="cursor-pointer hover:shadow-md transition-shadow" data-testid={`task-template-${index}`}>
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <div className="space-y-2 flex-1">
                            <CardTitle className="text-lg">{task.name}</CardTitle>
                            <div className="flex items-center space-x-3 text-sm text-muted-foreground">
                              {task.estimatedCost && (
                                <div className="flex items-center">
                                  <DollarSign className="w-4 h-4 mr-1" />
                                  {task.estimatedCost}
                                </div>
                              )}
                              <Badge className={getPriorityColor(task.priority)}>
                                {task.priority.toUpperCase()}
                              </Badge>
                            </div>
                          </div>
                          <Button 
                            size="sm" 
                            onClick={() => handleTemplateSelect(task)}
                            data-testid={`button-select-task-${index}`}
                          >
                            Select
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <p className="text-sm text-muted-foreground mb-3">{task.description}</p>
                        <div className="flex items-center justify-between">
                          <Badge variant="outline">{task.category}</Badge>
                          {task.typicalCompanies && task.typicalCompanies.length > 0 && (
                            <div className="flex items-center text-xs text-muted-foreground">
                              <Users className="w-3 h-3 mr-1" />
                              {task.typicalCompanies[0]}
                              {task.typicalCompanies.length > 1 && ` +${task.typicalCompanies.length - 1} more`}
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
        ) : (
          /* Customize Form */
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <ScrollArea className="h-96 pr-4">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="title">Task Title *</Label>
                  <Input
                    id="title"
                    {...form.register("title")}
                    data-testid="input-task-title"
                  />
                  {form.formState.errors.title && (
                    <p className="text-sm text-destructive mt-1">{form.formState.errors.title.message}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    {...form.register("description")}
                    rows={3}
                    data-testid="textarea-task-description"
                  />
                </div>


                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <Label htmlFor="priority">Priority</Label>
                    <Select
                      value={form.watch("priority")}
                      onValueChange={(value: string) => form.setValue("priority", value as "low" | "med" | "high")}
                    >
                      <SelectTrigger data-testid="select-priority">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="med">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="status">Status</Label>
                    <Select
                      value={form.watch("status")}
                      onValueChange={(value: string) => form.setValue("status", value as any)}
                    >
                      <SelectTrigger data-testid="select-status">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="to_do">
                          <div className="flex items-center gap-2">
                            <Circle className="h-4 w-4 text-gray-500" />
                            <span>To Do</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="scheduled">
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-blue-500" />
                            <span>Scheduled</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="in_progress">
                          <div className="flex items-center gap-2">
                            <Play className="h-4 w-4 text-orange-500" />
                            <span>In Progress</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="completed">
                          <div className="flex items-center gap-2">
                            <CheckCircle className="h-4 w-4 text-green-500" />
                            <span>Completed</span>
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="paymentStatus">Payment</Label>
                    <Select
                      value={form.watch("paymentStatus")}
                      onValueChange={(value: string) => form.setValue("paymentStatus", value as "not_paid" | "paid")}
                    >
                      <SelectTrigger data-testid="select-payment-status">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="not_paid">
                          <div className="flex items-center gap-2">
                            <XCircle className="h-4 w-4 text-red-500" />
                            <span>Not Paid</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="paid">
                          <div className="flex items-center gap-2">
                            <CheckCircle className="h-4 w-4 text-green-500" />
                            <span>Paid</span>
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="completedAt">Completion Date</Label>
                    <Input
                      id="completedAt"
                      type="datetime-local"
                      {...form.register("completedAt")}
                      data-testid="input-completion-date"
                    />
                  </div>
                </div>

                {/* Conditional Date On-Site field when status is "scheduled" */}
                {form.watch("status") === "scheduled" && (
                  <div className="grid grid-cols-1 gap-4">
                    <div>
                      <Label htmlFor="dateOnSite">Date On-Site *</Label>
                      <Input
                        id="dateOnSite"
                        type="text"
                        placeholder="MM/DD/YYYY"
                        {...form.register("dateOnSite")}
                        data-testid="input-date-on-site"
                        pattern="^(0[1-9]|1[012])/(0[1-9]|[12][0-9]|3[01])/[0-9]{4}$"
                        title="Please enter date in MM/DD/YYYY format"
                      />
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="assignee">Task Owner</Label>
                    <Input
                      id="assignee"
                      placeholder="Assign to team member"
                      {...form.register("assignee")}
                      data-testid="input-assignee"
                    />
                  </div>

                  <div>
                    <Label htmlFor="companyHired">Company Hired</Label>
                    <Input
                      id="companyHired"
                      placeholder="Third-party company"
                      {...form.register("companyHired")}
                      data-testid="input-company-hired"
                    />
                  </div>
                </div>

                {/* Rep Contact Info */}
                {form.watch("companyHired") && (
                  <div className="space-y-3 bg-gray-50 p-3 rounded-md">
                    <div className="text-sm font-medium text-gray-700">Rep Contact Information</div>
                    <div className="grid grid-cols-1 gap-3">
                      <div>
                        <Label htmlFor="repName">Rep Name</Label>
                        <Input
                          id="repName"
                          placeholder="Representative name"
                          {...form.register("repName")}
                          data-testid="input-rep-name"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label htmlFor="repEmail">Rep Email</Label>
                          <Input
                            id="repEmail"
                            type="email"
                            placeholder="rep@company.com"
                            {...form.register("repEmail")}
                            data-testid="input-rep-email"
                          />
                        </div>
                        <div>
                          <Label htmlFor="repPhone">Rep Phone</Label>
                          <Input
                            id="repPhone"
                            type="tel"
                            placeholder="(555) 123-4567"
                            {...form.register("repPhone")}
                            data-testid="input-rep-phone"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div>
                  <Label htmlFor="cost">Estimated Cost</Label>
                  <Input
                    id="cost"
                    placeholder="e.g., 5000 or $5,000"
                    {...form.register("cost")}
                    onBlur={handleCostBlur}
                    data-testid="input-cost"
                  />
                </div>

                <div>
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    placeholder="Additional notes or requirements"
                    {...form.register("notes")}
                    rows={2}
                    data-testid="textarea-notes"
                  />
                </div>

                {/* Template Info */}
                {selectedTemplate && selectedTemplate.typicalCompanies && (
                  <div className="bg-blue-50 p-3 rounded-md">
                    <div className="flex items-center mb-2">
                      <AlertCircle className="w-4 h-4 text-blue-600 mr-2" />
                      <span className="text-sm font-medium text-blue-900">Typical Companies for this task:</span>
                    </div>
                    <p className="text-sm text-blue-800">
                      {selectedTemplate.typicalCompanies.join(", ")}
                    </p>
                  </div>
                )}
              </div>
            </ScrollArea>

            {/* Form Actions */}
            <div className="flex justify-between pt-4">
              <Button type="button" variant="outline" onClick={handleBack} data-testid="button-back">
                Back to Browse
              </Button>
              <div className="flex space-x-2">
                <Button type="button" variant="outline" onClick={handleClose} data-testid="button-cancel">
                  Cancel
                </Button>
                <Button type="submit" disabled={createTask.isPending} data-testid="button-add-task">
                  {createTask.isPending ? "Adding..." : selectedTemplate ? "Add Task from Template" : "Add Custom Task"}
                </Button>
              </div>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}