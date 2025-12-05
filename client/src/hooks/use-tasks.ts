import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ddClient } from "@/lib/ddClient";
import { useToast } from "@/hooks/use-toast";
import type { Task } from "@shared/schema";

export function useTasks(projectId: string) {
  return useQuery({
    queryKey: ['/api/dd/projects', projectId, 'tasks'],
    queryFn: () => ddClient.getTasks(projectId),
    enabled: !!projectId,
  });
}

export function useCreateTask() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({ projectId, task }: { projectId: string; task: Partial<Task> }) =>
      ddClient.createTask(projectId, task),
    onSuccess: (_, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: ['/api/dd/projects', projectId, 'tasks'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dd/projects', projectId] });
      toast({
        title: "Success",
        description: "Task created successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create task",
        variant: "destructive",
      });
    },
  });
}

interface UpdateTaskContext {
  previousTasks?: Task[];
  projectId?: string;
}

interface UpdateTaskParams {
  id: string;
  updates: Partial<Task>;
  projectId?: string;
  expectedUpdatedAt?: string | Date | null;
}

export function useUpdateTask() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({ id, updates, expectedUpdatedAt }: UpdateTaskParams) => {
      const payload = expectedUpdatedAt 
        ? { ...updates, expectedUpdatedAt: typeof expectedUpdatedAt === 'string' ? expectedUpdatedAt : expectedUpdatedAt?.toISOString() }
        : updates;
      return ddClient.updateTask(id, payload);
    },
    onMutate: async ({ id, updates, projectId }) => {
      if (!projectId) return { previousTasks: undefined, projectId: undefined };
      
      await queryClient.cancelQueries({ queryKey: ['/api/dd/projects', projectId, 'tasks'] });
      
      const previousTasks = queryClient.getQueryData<Task[]>(['/api/dd/projects', projectId, 'tasks']);
      
      queryClient.setQueryData<Task[]>(
        ['/api/dd/projects', projectId, 'tasks'],
        (old) => old?.map((task) => 
          task.id === id ? { ...task, ...updates } : task
        ) ?? []
      );
      
      return { previousTasks, projectId };
    },
    onError: (error: any, { projectId }, context: UpdateTaskContext | undefined) => {
      if (context?.previousTasks && context?.projectId) {
        queryClient.setQueryData(
          ['/api/dd/projects', context.projectId, 'tasks'],
          context.previousTasks
        );
      }
      
      let errorMessage = "Failed to update task";
      let isConflict = false;
      
      if (error?.error === 'Conflict detected') {
        isConflict = true;
        errorMessage = error.message || "This task was modified. Please refresh the page.";
        if (context?.projectId) {
          queryClient.invalidateQueries({ queryKey: ['/api/dd/projects', context.projectId, 'tasks'] });
        }
      } else if (error?.details && Array.isArray(error.details)) {
        const fieldErrors = error.details.map((d: any) => `${d.field}: ${d.message}`).join(', ');
        errorMessage = `Validation error: ${fieldErrors}`;
      } else if (error?.message) {
        errorMessage = error.message;
      }
      
      toast({
        title: isConflict ? "Conflict Detected" : "Error",
        description: errorMessage,
        variant: "destructive",
      });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/dd/projects', data.projectId, 'tasks'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dd/projects', data.projectId] });
    },
    onSettled: (data, error, variables, context: UpdateTaskContext | undefined) => {
      if (context?.projectId) {
        queryClient.invalidateQueries({ queryKey: ['/api/dd/projects', context.projectId, 'tasks'] });
      }
    },
  });
}

export function useDeleteTask() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (id: string) => ddClient.deleteTask(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/dd/projects'] });
      toast({
        title: "Success",
        description: "Task deleted successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete task",
        variant: "destructive",
      });
    },
  });
}
