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

export function useUpdateTask() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Task> }) =>
      ddClient.updateTask(id, updates),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/dd/projects', data.projectId, 'tasks'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dd/projects', data.projectId] });
      toast({
        title: "Success",
        description: "Task updated successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update task",
        variant: "destructive",
      });
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
