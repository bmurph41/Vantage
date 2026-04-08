import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { StandardDialogShell } from "@/components/ui/standard-dialog-shell";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, ClipboardList } from "lucide-react";
import { format } from "date-fns";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import { insertTaskSchema, type Task, type Deal, type Contact, type Company } from "@shared/schema";
import { cn } from "@/lib/utils";

interface TaskFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: Task | null;
}

const taskTypes = [
  { value: "call", label: "Call", emoji: "📞" },
  { value: "email", label: "Email", emoji: "📧" },
  { value: "meeting", label: "Meeting", emoji: "🤝" },
  { value: "follow_up", label: "Follow Up", emoji: "🔄" },
  { value: "todo", label: "To Do", emoji: "📋" },
];

const priorities = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
];

export default function TaskFormModal({ isOpen, onClose, task }: TaskFormModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: deals = [] } = useQuery<Deal[]>({
    queryKey: ['/api/deals'],
    enabled: isOpen,
  });

  const { data: contacts = [] } = useQuery<Contact[]>({
    queryKey: ['/api/contacts'],
    enabled: isOpen,
  });

  const { data: companies = [] } = useQuery<Company[]>({
    queryKey: ['/api/companies'],
    enabled: isOpen,
  });

  // Prepare contact options for searchable select
  const contactOptions = useMemo(() => {
    const options = contacts.map((contact) => ({
      value: contact.id,
      label: `${contact.firstName} ${contact.lastName}${contact.email ? ` (${contact.email})` : ''}`,
    }));
    return [{ value: "none", label: "No contact" }, ...options];
  }, [contacts]);

  // Prepare company options for searchable select
  const companyOptions = useMemo(() => {
    const options = companies.map((company) => ({
      value: company.id,
      label: company.name,
    }));
    return [{ value: "none", label: "No company" }, ...options];
  }, [companies]);

  const form = useForm({
    resolver: zodResolver(insertTaskSchema.extend({
      description: insertTaskSchema.shape.description.optional(),
      dueDate: z.date().optional().or(z.undefined()),
      dealId: insertTaskSchema.shape.dealId.optional(),
      contactId: insertTaskSchema.shape.contactId.optional(),
      companyId: insertTaskSchema.shape.companyId.optional(),
    })),
    defaultValues: {
      title: "",
      description: "",
      type: "call",
      priority: "medium",
      status: "pending",
      dueDate: undefined,
      dealId: "none",
      contactId: "none",
      companyId: "none",
    },
  });

  useEffect(() => {
    if (task) {
      form.reset({
        title: task.title,
        description: task.description || "",
        type: task.type,
        priority: task.priority,
        status: task.status,
        dueDate: task.dueDate ? new Date(task.dueDate) : undefined,
        dealId: task.dealId || "none",
        contactId: task.contactId || "none",
        companyId: task.companyId || "none",
      });
    } else {
      form.reset({
        title: "",
        description: "",
        type: "call",
        priority: "medium",
        status: "pending",
        dueDate: undefined,
        dealId: "none",
        contactId: "none",
        companyId: "none",
      });
    }
  }, [task]);

  const createTaskMutation = useMutation({
    mutationFn: async (data: any) => {
      const cleanData = { 
        ...data,
        dueDate: data.dueDate?.toISOString(),
      };
      
      Object.keys(cleanData).forEach(key => {
        if (cleanData[key] === "" || cleanData[key] === undefined) {
          delete cleanData[key];
        }
      });
      
      return await apiRequest('POST', '/api/tasks', cleanData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tasks/upcoming'] });
      queryClient.invalidateQueries({ queryKey: ['/api/tasks'] });
      toast({ title: "Task created successfully" });
      onClose();
      form.reset();
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to create task", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  const updateTaskMutation = useMutation({
    mutationFn: async (data: any) => {
      const cleanData = { 
        ...data,
        dueDate: data.dueDate?.toISOString(),
      };
      
      Object.keys(cleanData).forEach(key => {
        if (cleanData[key] === "" || cleanData[key] === undefined) {
          delete cleanData[key];
        }
      });
      
      return await apiRequest('PUT', `/api/tasks/${task!.id}`, cleanData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tasks/upcoming'] });
      queryClient.invalidateQueries({ queryKey: ['/api/tasks'] });
      toast({ title: "Task updated successfully" });
      onClose();
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to update task", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  const onSubmit = (data: any) => {
    if (task) {
      updateTaskMutation.mutate(data);
    } else {
      createTaskMutation.mutate(data);
    }
  };

  const isLoading = createTaskMutation.isPending || updateTaskMutation.isPending;

  return (
    <StandardDialogShell
      open={isOpen}
      onOpenChange={onClose}
      title={task ? 'Edit Task' : 'Add New Task'}
      icon={ClipboardList}
      size="md"
      showProgressBar={true}
      primaryAction={{
        label: task ? 'Update' : 'Create',
        onClick: form.handleSubmit(onSubmit),
        disabled: isLoading,
        loading: isLoading,
      }}
      secondaryAction={{
        label: 'Back',
        onClick: onClose,
        disabled: isLoading,
      }}
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" data-testid="task-form-modal">
          <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Task Title</FormLabel>
                <FormControl>
                  <Input placeholder="Call prospect about proposal" {...field} data-testid="input-task-title" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Task Type</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-task-type">
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {taskTypes.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.emoji} {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="priority"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Priority</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-priority">
                        <SelectValue placeholder="Select priority" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {priorities.map((priority) => (
                        <SelectItem key={priority.value} value={priority.value}>
                          {priority.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="dueDate"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>Due Date</FormLabel>
                <Popover>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full pl-3 text-left font-normal",
                          !field.value && "text-muted-foreground"
                        )}
                        data-testid="button-select-due-date"
                      >
                        {field.value ? (
                          format(field.value, "PPP")
                        ) : (
                          <span>Pick a date</span>
                        )}
                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={field.value}
                      onSelect={field.onChange}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="space-y-4">
            <FormField
              control={form.control}
              name="dealId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Related Deal</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-deal">
                        <SelectValue placeholder="Select deal" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">No deal</SelectItem>
                      {deals.map((deal: Deal) => (
                        <SelectItem key={deal.id} value={deal.id}>
                          {deal.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="contactId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Related Contact</FormLabel>
                  <FormControl>
                    <SearchableSelect
                      options={contactOptions}
                      value={field.value}
                      onValueChange={field.onChange}
                      placeholder="Search contacts..."
                      searchPlaceholder="Type to search contacts..."
                      emptyText="No contacts found"
                      testId="select-contact"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="companyId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Related Company</FormLabel>
                  <FormControl>
                    <SearchableSelect
                      options={companyOptions}
                      value={field.value}
                      onValueChange={field.onChange}
                      placeholder="Search companies..."
                      searchPlaceholder="Type to search companies..."
                      emptyText="No companies found"
                      testId="select-company"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Description</FormLabel>
                <FormControl>
                  <Textarea 
                    placeholder="Task description and notes..." 
                    rows={3}
                    {...field} 
                    data-testid="textarea-description"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </form>
      </Form>
    </StandardDialogShell>
  );
}
