import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ddClient } from "@/lib/ddClient";
import { useToast } from "@/hooks/use-toast";
import type { TaskDependency, InsertTaskDependency } from "@shared/schema";

export function useProjectTaskDependencies(projectId: string) {
  return useQuery({
    queryKey: ['/api/dd/projects', projectId, 'task-dependencies'],
    queryFn: () => ddClient.getProjectTaskDependencies(projectId),
    enabled: !!projectId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 3,
  });
}

export function useTaskDependencies(taskId: string) {
  return useQuery({
    queryKey: ['/api/dd/tasks', taskId, 'dependencies'],
    queryFn: () => ddClient.getTaskDependencies(taskId),
    enabled: !!taskId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useCreateTaskDependency() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({ projectId, dependency }: { projectId: string; dependency: InsertTaskDependency }) =>
      ddClient.createTaskDependency(projectId, dependency),
    onSuccess: (data, { projectId }) => {
      // Invalidate project dependencies
      queryClient.invalidateQueries({ queryKey: ['/api/dd/projects', projectId, 'task-dependencies'] });
      
      // Invalidate task-specific dependencies for both successor and predecessor
      queryClient.invalidateQueries({ queryKey: ['/api/dd/tasks', data.successorId, 'dependencies'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dd/tasks', data.predecessorId, 'dependencies'] });
      
      // Invalidate project tasks to trigger critical path recalculation
      queryClient.invalidateQueries({ queryKey: ['/api/dd/projects', projectId, 'tasks'] });
      
      toast({
        title: "Success",
        description: "Task dependency created successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "Failed to create task dependency",
        variant: "destructive",
      });
    },
  });
}

export function useUpdateTaskDependency() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<InsertTaskDependency> }) =>
      ddClient.updateTaskDependency(id, updates),
    onSuccess: (data) => {
      // Get project ID from the successor task to invalidate correctly
      const successorTaskQueries = queryClient.getQueriesData({ queryKey: ['/api/dd/tasks', data.successorId] });
      
      // Invalidate project dependencies 
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          const key = query.queryKey;
          return Array.isArray(key) && key.includes('task-dependencies');
        }
      });
      
      // Invalidate task-specific dependencies
      queryClient.invalidateQueries({ queryKey: ['/api/dd/tasks', data.successorId, 'dependencies'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dd/tasks', data.predecessorId, 'dependencies'] });
      
      // Invalidate all project tasks to trigger critical path recalculation
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          const key = query.queryKey;
          return Array.isArray(key) && key.includes('tasks');
        }
      });
      
      toast({
        title: "Success",
        description: "Task dependency updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "Failed to update task dependency",
        variant: "destructive",
      });
    },
  });
}

export function useDeleteTaskDependency() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (id: string) => ddClient.deleteTaskDependency(id),
    onSuccess: () => {
      // Invalidate all task dependency queries to ensure UI consistency
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          const key = query.queryKey;
          return Array.isArray(key) && (key.includes('task-dependencies') || key.includes('dependencies'));
        }
      });
      
      // Invalidate all task queries to trigger critical path recalculation
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          const key = query.queryKey;
          return Array.isArray(key) && key.includes('tasks');
        }
      });
      
      toast({
        title: "Success",
        description: "Task dependency deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error", 
        description: error?.message || "Failed to delete task dependency",
        variant: "destructive",
      });
    },
  });
}

export function useDeleteAllTaskDependencies() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (taskId: string) => ddClient.deleteAllTaskDependencies(taskId),
    onSuccess: (_, taskId) => {
      // Invalidate all dependency-related queries
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          const key = query.queryKey;
          return Array.isArray(key) && (key.includes('task-dependencies') || key.includes('dependencies'));
        }
      });
      
      // Invalidate task queries
      queryClient.invalidateQueries({ queryKey: ['/api/dd/tasks', taskId, 'dependencies'] });
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          const key = query.queryKey;
          return Array.isArray(key) && key.includes('tasks');
        }
      });
      
      toast({
        title: "Success",
        description: "All task dependencies cleared successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "Failed to clear task dependencies",
        variant: "destructive",
      });
    },
  });
}