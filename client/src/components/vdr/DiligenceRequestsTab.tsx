import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { DiligenceRequest, InsertDiligenceRequest, insertDiligenceRequestSchema } from '@shared/schema';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { FileText, Plus, Calendar, User, CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';

interface DiligenceRequestsTabProps {
  projectId: string;
}

const formSchema = insertDiligenceRequestSchema.omit({
  projectId: true,
});

export function DiligenceRequestsTab({ projectId }: DiligenceRequestsTabProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { toast } = useToast();

  const { data: requests = [], isLoading } = useQuery<DiligenceRequest[]>({
    queryKey: ['/api/vdr/projects', projectId, 'requests'],
  });

  const createMutation = useMutation({
    mutationFn: async (data: z.infer<typeof formSchema>) => {
      return await apiRequest(`/api/vdr/projects/${projectId}/requests`, {
        method: 'POST',
        body: JSON.stringify({ ...data, projectId }),
        headers: { 'Content-Type': 'application/json' },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/vdr/projects', projectId, 'requests'] });
      toast({ title: 'Diligence request created successfully' });
      setDialogOpen(false);
      form.reset();
    },
    onError: () => {
      toast({ title: 'Failed to create request', variant: 'destructive' });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      return await apiRequest(`/api/vdr/requests/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
        headers: { 'Content-Type': 'application/json' },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/vdr/projects', projectId, 'requests'] });
      toast({ title: 'Request status updated' });
    },
    onError: () => {
      toast({ title: 'Failed to update status', variant: 'destructive' });
    },
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      category: 'financial',
      title: '',
      description: '',
      priority: 'medium',
      status: 'open',
      dueDate: undefined,
    },
  });

  const onSubmit = (data: z.infer<typeof formSchema>) => {
    createMutation.mutate(data);
  };

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      financial: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
      legal: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
      operational: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
      technical: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
      environmental: 'bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-300',
      other: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300',
    };
    return colors[category] || colors.other;
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'high':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'medium':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'low':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      open: 'bg-blue-500',
      in_progress: 'bg-yellow-500',
      completed: 'bg-green-500',
      rejected: 'bg-red-500',
    };
    return colors[status] || colors.open;
  };

  if (isLoading) {
    return <div className="p-6 text-center text-muted-foreground">Loading diligence requests...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Diligence Requests</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Track document and information requests from stakeholders
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-request">
              <Plus className="h-4 w-4 mr-2" />
              New Request
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create Diligence Request</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="category"
                  render={({ field, fieldState }) => (
                    <FormItem>
                      <FormLabel className={fieldState.error ? 'text-destructive' : ''}>Category</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-request-category" className={fieldState.error ? 'border-destructive ring-destructive' : ''}>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="financial">Financial</SelectItem>
                          <SelectItem value="legal">Legal</SelectItem>
                          <SelectItem value="operational">Operational</SelectItem>
                          <SelectItem value="technical">Technical</SelectItem>
                          <SelectItem value="environmental">Environmental</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field, fieldState }) => (
                    <FormItem>
                      <FormLabel className={fieldState.error ? 'text-destructive' : ''}>Title</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="e.g., Last 3 years of audited financials"
                          data-testid="input-request-title"
                          className={fieldState.error ? 'border-destructive ring-destructive' : ''}
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
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea
                          {...field}
                          value={field.value || ''}
                          placeholder="Provide additional context about this request..."
                          className="min-h-[100px]"
                          data-testid="input-request-description"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="priority"
                    render={({ field, fieldState }) => (
                      <FormItem>
                        <FormLabel className={fieldState.error ? 'text-destructive' : ''}>Priority</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-request-priority" className={fieldState.error ? 'border-destructive ring-destructive' : ''}>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="low">Low</SelectItem>
                            <SelectItem value="medium">Medium</SelectItem>
                            <SelectItem value="high">High</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="dueDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Due Date</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type="date"
                            value={field.value ? new Date(field.value).toISOString().split('T')[0] : ''}
                            onChange={(e) => field.onChange(e.target.value ? new Date(e.target.value) : undefined)}
                            data-testid="input-request-due-date"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="flex justify-end gap-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setDialogOpen(false)}
                    data-testid="button-cancel-request"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={createMutation.isPending}
                    data-testid="button-submit-request"
                  >
                    {createMutation.isPending ? 'Creating...' : 'Create Request'}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {requests.length === 0 ? (
        <Card className="p-12 text-center">
          <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Diligence Requests</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Create requests to track documents and information needed from stakeholders
          </p>
          <Button onClick={() => setDialogOpen(true)} data-testid="button-create-first-request">
            <Plus className="h-4 w-4 mr-2" />
            Create First Request
          </Button>
        </Card>
      ) : (
        <div className="grid gap-4">
          {requests.map((request) => (
            <Card key={request.id} className="p-4" data-testid={`card-request-${request.id}`}>
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2">
                      {getPriorityIcon(request.priority)}
                      <h3 className="font-semibold" data-testid={`text-request-title-${request.id}`}>
                        {request.title}
                      </h3>
                    </div>
                    {request.description && (
                      <p className="text-sm text-muted-foreground">{request.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getCategoryColor(request.category)}`}>
                      {request.category.charAt(0).toUpperCase() + request.category.slice(1)}
                    </span>
                  </div>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <div className={`h-2 w-2 rounded-full ${getStatusColor(request.status)}`} />
                      <span className="capitalize">{request.status.replace('_', ' ')}</span>
                    </div>
                    {request.dueDate && (
                      <div className="flex items-center gap-1.5">
                        <Calendar className="h-3 w-3" />
                        <span>Due {format(new Date(request.dueDate), 'MMM d, yyyy')}</span>
                      </div>
                    )}
                  </div>
                  
                  <Select
                    value={request.status}
                    onValueChange={(status) => updateStatusMutation.mutate({ id: request.id, status })}
                  >
                    <SelectTrigger className="w-[140px] h-8 text-xs" data-testid={`select-request-status-${request.id}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="open">Open</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="rejected">Rejected</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
